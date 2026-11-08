from typing import Annotated, Protocol

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.errors import auth_unavailable, unauthorized
from app.auth.policy import ApprovedAccountPolicy, UnresolvedLoginPolicy
from app.auth.repository import SqlAlchemyAccountReader
from app.auth.schemas import AccessClaims, CompanyApprovalStatus, ConfirmedSystemRole, Principal
from app.auth.service import AccountPrincipalResolver, CredentialService
from app.auth.tokens import InvalidAccessToken, TokenCodec
from app.db.session import get_db

bearer_scheme = HTTPBearer(
    scheme_name="AccessToken",
    bearerFormat="JWT",
    description="HS256 access token, 30 minutes. Client logout does not revoke issued tokens.",
    auto_error=False,
)


class PrincipalResolver(Protocol):
    def resolve(self, account_id: str) -> Principal | None:
        """Read current account/role/eligibility and membership from trusted storage."""
        ...


def get_token_codec(request: Request) -> TokenCodec:
    settings = request.app.state.settings
    if settings.jwt_secret is None:
        raise auth_unavailable()
    return TokenCodec(settings.jwt_secret, settings.jwt_issuer, settings.jwt_audience)


def get_access_claims(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AccessClaims:
    if credentials is None:
        raise unauthorized()
    try:
        return get_token_codec(request).verify_access_token(credentials.credentials)
    except InvalidAccessToken:
        raise unauthorized() from None


def get_principal_resolver(
    request: Request, session: Annotated[Session, Depends(get_db)]
) -> PrincipalResolver:
    resolver = getattr(request.app.state, "principal_resolver", None)
    if resolver is None:
        return AccountPrincipalResolver(SqlAlchemyAccountReader(session), ApprovedAccountPolicy())
    return resolver


def get_credential_service(session: Annotated[Session, Depends(get_db)]) -> CredentialService:
    return CredentialService(SqlAlchemyAccountReader(session), ApprovedAccountPolicy())


def get_current_principal(
    claims: Annotated[AccessClaims, Depends(get_access_claims)],
    resolver: Annotated[PrincipalResolver, Depends(get_principal_resolver)],
) -> Principal:
    try:
        principal = resolver.resolve(claims.sub)
    except (SQLAlchemyError, UnresolvedLoginPolicy):
        raise auth_unavailable() from None
    if (
        principal is None
        or principal.account_id != claims.sub
        or not principal.authentication_allowed
    ):
        raise unauthorized()
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]


def require_admin(principal: CurrentPrincipal) -> Principal:
    if principal.role != ConfirmedSystemRole.ADMIN:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return principal


def require_approved_company(principal: CurrentPrincipal) -> Principal:
    if (
        principal.role != ConfirmedSystemRole.COMPANY_MEMBER
        or principal.company_id is None
        or principal.company_approval_status != CompanyApprovalStatus.APPROVED
    ):
        raise HTTPException(status_code=403, detail="Approved company membership required")
    return principal


def require_account_owner(account_id: str, principal: Principal) -> None:
    if principal.account_id != account_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def require_company_scope(company_id: str, principal: Principal) -> None:
    if principal.company_id is None or principal.company_id != company_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
