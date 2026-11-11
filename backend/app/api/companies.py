from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentPrincipal
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import AccountId, AuthErrorResponse, Principal
from app.companies.schemas import (
    CompanyResponse,
    CompanyUpdate,
    EmployerRegistrationRequest,
    EmployerRegistrationResponse,
    MemberCreate,
    MemberResponse,
    MemberUpdate,
    PackageResponse,
    PublicCompanyPage,
    PublicCompanyResponse,
)
from app.companies.service import CompanyError, CompanyNotFound, CompanyService
from app.db.session import get_db
from app.jobs.schemas import JobPage
from app.jobs.service import JobService

router = APIRouter(tags=["Companies"])
Database = Annotated[Session, Depends(get_db)]


def require_company_member(principal: CurrentPrincipal) -> Principal:
    if principal.role != "COMPANY_MEMBER" or principal.company_id is None:
        raise HTTPException(status_code=403, detail="Company membership required")
    return principal


CompanyMember = Annotated[Principal, Depends(require_company_member)]


def require_owner(principal: CompanyMember) -> Principal:
    if principal.internal_role != "OWNER":
        raise HTTPException(status_code=403, detail="Owner role required")
    return principal


Owner = Annotated[Principal, Depends(require_owner)]
WRITE_ERRORS = {
    **AUTH_ERROR_RESPONSES,
    404: {"model": AuthErrorResponse, "description": "Scoped resource not found"},
    409: {"model": AuthErrorResponse, "description": "Duplicate or quota conflict"},
}


def operation[Result](session: Session, action: Callable[[], Result]) -> Result:
    try:
        return action()
    except CompanyError as error:
        session.rollback()
        raise HTTPException(status_code=error.status, detail=error.detail) from None
    except CompanyNotFound:
        session.rollback()
        raise HTTPException(status_code=404, detail="Company not found") from None
    except IntegrityError as error:
        session.rollback()
        if error.orig.args and error.orig.args[0] == 1062:
            raise HTTPException(
                status_code=409, detail="Email or tax code already in use"
            ) from None
        raise HTTPException(status_code=503, detail="Company backend unavailable") from None
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=503, detail="Company backend unavailable") from None


@router.post(
    "/api/v1/auth/register/employer",
    response_model=EmployerRegistrationResponse,
    status_code=201,
    summary="Register account, PENDING company and first OWNER atomically",
    description=(
        "Select a configured package; OWNER consumes one ACTIVE seat. "
        "Server sets roles, IDs and UTC dates. No payment or token issuance."
    ),
    responses=WRITE_ERRORS,
)
def register_employer(
    request: EmployerRegistrationRequest, session: Database, response: Response
) -> EmployerRegistrationResponse:
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: CompanyService(session).register(request))


@router.patch(
    "/api/v1/companies/me",
    response_model=CompanyResponse,
    summary="OWNER updates own company profile",
    responses=WRITE_ERRORS,
    description=(
        "Allowed while PENDING/REJECTED. No tax/package/approval/role changes. "
        "RECRUITER is read-only."
    ),
)
def update_company(
    request: CompanyUpdate, principal: Owner, session: Database, response: Response
) -> CompanyResponse:
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: CompanyService(session).update(principal, request))


@router.get(
    "/api/v1/companies/me/members",
    response_model=list[MemberResponse],
    summary="OWNER lists own company's members",
    responses=AUTH_ERROR_RESPONSES,
)
def members(principal: Owner, session: Database, response: Response) -> list[MemberResponse]:
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: CompanyService(session).list_members(principal))


@router.post(
    "/api/v1/companies/me/members",
    response_model=MemberResponse,
    status_code=201,
    summary="OWNER creates a new RECRUITER account within ACTIVE quota",
    responses=WRITE_ERRORS,
)
def create_member(
    request: MemberCreate, principal: Owner, session: Database, response: Response
) -> MemberResponse:
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: CompanyService(session).add_member(principal, request))


@router.patch(
    "/api/v1/companies/me/members/{account_id}",
    response_model=MemberResponse,
    summary="OWNER activates or deactivates own RECRUITER",
    responses=WRITE_ERRORS,
    description=(
        "No delete, role transfer, OWNER deactivation or cross-company access. "
        "Reactivation requires a free ACTIVE seat."
    ),
)
def change_member(
    account_id: AccountId,
    request: MemberUpdate,
    principal: Owner,
    session: Database,
    response: Response,
) -> MemberResponse:
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session, lambda: CompanyService(session).change_member(principal, account_id, request)
    )


@router.get(
    "/api/v1/company-packages",
    response_model=list[PackageResponse],
    summary="Read the actual company package catalog",
    description=(
        "Public catalog from MySQL only. Empty catalog returns []. "
        "NULL quota means not configured, not unlimited."
    ),
    responses={503: {"model": AuthErrorResponse, "description": "Catalog unavailable"}},
)
def packages(session: Database, response: Response) -> list[PackageResponse]:
    response.headers["Cache-Control"] = "no-store"
    try:
        return CompanyService(session).packages()
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Catalog unavailable") from None


@router.get(
    "/api/v1/companies/me",
    response_model=CompanyResponse,
    summary="Read the current member's company and package",
    description=(
        "Active members only, company scope resolved from database. "
        "PENDING/REJECTED may read profile; this grants no recruitment permission."
    ),
    responses={
        **AUTH_ERROR_RESPONSES,
        404: {"model": AuthErrorResponse, "description": "Company not found"},
    },
)
def current_company(
    principal: CompanyMember, session: Database, response: Response
) -> CompanyResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return CompanyService(session).current_company(principal.account_id, principal.company_id)
    except CompanyNotFound:
        raise HTTPException(status_code=404, detail="Company not found") from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Company backend unavailable") from None


PUBLIC_ERRORS = {
    404: {"model": AuthErrorResponse, "description": "Approved company not found"},
    503: {"model": AuthErrorResponse, "description": "Company backend unavailable"},
}


@router.get(
    "/api/v1/companies",
    response_model=PublicCompanyPage,
    responses=PUBLIC_ERRORS,
    summary="Public directory of approved companies",
    description=(
        "Search name/industry/address. Industry and location filter existing text fields; "
        "no geographical FK is implied. Private company/account/package fields are excluded."
    ),
)
def public_companies(
    session: Database,
    response: Response,
    q: str = Query("", max_length=200),
    industry: str | None = Query(None, max_length=200),
    location: str | None = Query(None, max_length=255),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PublicCompanyPage:
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: CompanyService(session).public_listing(
            q=q.strip(),
            industry=industry.strip() if industry else None,
            location=location.strip() if location else None,
            limit=limit,
            offset=offset,
        ),
    )


@router.get(
    "/api/v1/companies/{company_id}",
    response_model=PublicCompanyResponse,
    responses=PUBLIC_ERRORS,
    summary="Public approved company profile; no internal data",
)
def public_company(company_id: AccountId, session: Database, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: CompanyService(session).public_detail(company_id))


@router.get(
    "/api/v1/companies/{company_id}/jobs",
    response_model=JobPage,
    response_model_exclude_unset=True,
    responses=PUBLIC_ERRORS,
    summary="Effective public jobs of one approved company",
    description=(
        "Only APPROVED jobs, approved company, effective deadline/closing time. "
        "Returns 404 for hidden or missing company."
    ),
)
def public_company_jobs(
    company_id: AccountId,
    session: Database,
    response: Response,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    response.headers["Cache-Control"] = "no-store"

    def act():
        CompanyService(session).public_detail(company_id)
        return JobService(session).listing(
            public=True, company_id=company_id, limit=limit, offset=offset
        )

    return operation(session, act)
