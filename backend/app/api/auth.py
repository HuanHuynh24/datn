from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentPrincipal, get_credential_service, get_token_codec
from app.auth.errors import AUTH_ERROR_RESPONSES, auth_unavailable, unauthorized
from app.auth.password_change import (
    IncorrectCurrentPassword,
    PasswordChangeDenied,
    PasswordChangeRequest,
    PasswordChangeResponse,
    PasswordChangeService,
)
from app.auth.policy import UnresolvedLoginPolicy
from app.auth.registration import CandidateRegistrationService, RegistrationConflict
from app.auth.schemas import (
    AuthErrorResponse,
    CandidateRegistrationRequest,
    CandidateRegistrationResponse,
    CurrentUserResponse,
    LoginRequest,
    TokenResponse,
)
from app.auth.service import CredentialService, InvalidCredentials
from app.auth.tokens import TokenCodec
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post(
    "/change-password",
    response_model=PasswordChangeResponse,
    summary="Change the authenticated account's password using its current password",
    description=(
        "All three roles may change only their own password. Argon2id, transaction/row locks. "
        "Client signs out after success. Existing stateless JWT copies are not revoked "
        "and expire within the existing 30-minute lifetime. No role/ID/status changes."
    ),
    responses={**AUTH_ERROR_RESPONSES, 400: {"description": "Incorrect current password"}},
)
def change_password(
    body: PasswordChangeRequest,
    principal: CurrentPrincipal,
    response: Response,
    session: Annotated[Session, Depends(get_db)],
) -> PasswordChangeResponse:
    try:
        PasswordChangeService(session).change(principal.account_id, body)
    except IncorrectCurrentPassword:
        raise HTTPException(status_code=400, detail="Current password is incorrect") from None
    except PasswordChangeDenied:
        raise unauthorized() from None
    except (SQLAlchemyError, UnresolvedLoginPolicy):
        raise auth_unavailable() from None
    response.headers["Cache-Control"] = "no-store"
    return PasswordChangeResponse()


@router.post(
    "/register/candidate",
    response_model=CandidateRegistrationResponse,
    status_code=201,
    summary="Create a Candidate account and its private profile atomically",
    description=(
        "Public Candidate registration only. ACTIVE account; email unverified, profile private. "
        "Server assigns both IDs and UTC timestamps. Password: 8–1024 characters, Argon2id. "
        "No automatic login, package, company membership or admin registration."
    ),
    responses={
        409: {
            "model": AuthErrorResponse,
            "description": "Registration conflicts with existing data",
        },
        503: {"model": AuthErrorResponse, "description": "Registration database unavailable"},
    },
)
def register_candidate(
    registration: CandidateRegistrationRequest,
    response: Response,
    session: Annotated[Session, Depends(get_db)],
) -> CandidateRegistrationResponse:
    try:
        result = CandidateRegistrationService(session).register(registration)
    except RegistrationConflict:
        raise HTTPException(
            status_code=409, detail="Unable to register with these details"
        ) from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Registration backend unavailable") from None
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=200,
    summary="Verify account credentials and issue a 30-minute access token",
    description=(
        "Requires existing ERD account tables. Role/status and specialization are checked. "
        "Five consecutive wrong passwords lock the account for fifteen minutes in UTC. "
        "Successful login or expiry resets the counter. "
        "No refresh or server-side logout/revocation."
    ),
    responses=AUTH_ERROR_RESPONSES,
)
def login(
    credentials: LoginRequest,
    response: Response,
    codec: Annotated[TokenCodec, Depends(get_token_codec)],
    service: Annotated[CredentialService, Depends(get_credential_service)],
) -> TokenResponse:
    try:
        verified = service.verify_login(credentials)
    except InvalidCredentials:
        raise unauthorized() from None
    except (SQLAlchemyError, UnresolvedLoginPolicy):
        raise auth_unavailable() from None
    # Counter/lock updates have committed before issuing the access token.
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return TokenResponse(access_token=codec.create_access_token(verified.principal.account_id))


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    status_code=200,
    summary="Read current identity and server-resolved company scope",
    description="Re-reads account/member status on every request; no role claims are trusted.",
    responses=AUTH_ERROR_RESPONSES,
)
def current_user(principal: CurrentPrincipal, response: Response) -> CurrentUserResponse:
    response.headers["Cache-Control"] = "no-store"
    return CurrentUserResponse(
        account_id=principal.account_id,
        role=principal.role,
        company_id=principal.company_id,
        internal_role=principal.internal_role,
        company_approval_status=principal.company_approval_status,
    )
