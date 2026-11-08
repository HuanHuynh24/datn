from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.companies import CompanyMember, operation
from app.auth.dependencies import require_admin, require_approved_company
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import AccountId, Principal
from app.db.session import get_db
from app.jobs.schemas import JobContentInput, JobPage, JobResponse, JobReview, JobStatus, JobUpdate
from app.jobs.service import JobService
from app.models import KyNang, NganhNghe, TinhThanh, XaPhuong

router = APIRouter(tags=["Jobs"])
Database = Annotated[Session, Depends(get_db)]
Approved = Annotated[Principal, Depends(require_approved_company)]
Admin = Annotated[Principal, Depends(require_admin)]
ERRORS = {
    **AUTH_ERROR_RESPONSES,
    404: {"description": "Job not found"},
    409: {"description": "Invalid state transition"},
    422: {"description": "Validation failure"},
}


@router.get(
    "/api/v1/job-catalog",
    summary="Read actual industry/province/ward/skill catalogs",
    responses=ERRORS,
)
def catalogs(session: Database) -> dict:
    def act():
        data = {}
        for key, t, pk, name in [
            ("industries", NganhNghe.__table__, "idnganhnghe", "tennganhnghe"),
            ("provinces", TinhThanh.__table__, "idtinhthanh", "tentinhthanh"),
            ("wards", XaPhuong.__table__, "idxaphuong", "tenxaphuong"),
            ("skills", KyNang.__table__, "idkynang", "tenkynang"),
        ]:
            query = select(t)
            if "trangthai" in t.c:
                query = query.where(t.c.trangthai == "ACTIVE")
            data[key] = [
                {
                    "id": str(r[pk]),
                    "name": r[name],
                    **({"province_id": str(r["idtinhthanh"])} if key == "wards" else {}),
                }
                for r in session.execute(query.order_by(t.c[pk])).mappings()
            ]
        return data

    return operation(session, act)


@router.get(
    "/api/v1/jobs",
    response_model=JobPage,
    response_model_exclude_unset=True,
    summary="Public effective APPROVED jobs, search/filter/pagination",
    responses=ERRORS,
)
def public_jobs(
    session: Database,
    q: Annotated[str | None, Query(max_length=200)] = None,
    province_id: AccountId | None = None,
    industry_id: AccountId | None = None,
    skill_id: AccountId | None = None,
    minimum_salary: Annotated[Decimal | None, Query(ge=0)] = None,
    work_type: Annotated[str | None, Query(max_length=60)] = None,
    sort: Literal["newest", "salary_asc", "salary_desc"] = "newest",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    return operation(
        session,
        lambda: JobService(session).listing(
            public=True,
            q=q,
            province_id=province_id,
            industry_id=industry_id,
            skill_id=skill_id,
            minimum_salary=minimum_salary,
            work_type=work_type,
            sort=sort,
            limit=limit,
            offset=offset,
        ),
    )


@router.get(
    "/api/v1/jobs/{job_id}",
    response_model=JobResponse,
    response_model_exclude_unset=True,
    summary="Read a publicly visible job",
    responses=ERRORS,
)
def public_job(job_id: AccountId, session: Database) -> JobResponse:
    service = JobService(session)
    return operation(session, lambda: service.response(service.repo.detail(job_id, public=True)))


@router.get(
    "/api/v1/companies/me/jobs",
    response_model=JobPage,
    summary="Company member lists own jobs in all states",
    responses=ERRORS,
)
def own_jobs(
    principal: CompanyMember,
    session: Database,
    response: Response,
    status: JobStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: JobService(session).listing(
            internal=True,
            company_id=principal.company_id,
            status=status,
            limit=limit,
            offset=offset,
        ),
    )


@router.get(
    "/api/v1/companies/me/jobs/{job_id}",
    response_model=JobResponse,
    summary="Company-scoped job detail",
    responses=ERRORS,
)
def own_job(
    job_id: AccountId, principal: CompanyMember, session: Database, response: Response
) -> JobResponse:
    response.headers["Cache-Control"] = "no-store"
    service = JobService(session)
    return operation(
        session,
        lambda: service.response(
            service.repo.detail(job_id, company_id=principal.company_id), True
        ),
    )


@router.post(
    "/api/v1/companies/me/jobs",
    response_model=JobResponse,
    status_code=201,
    summary="Create DRAFT; APPROVED company member only",
    responses=ERRORS,
)
def create_job(request: JobContentInput, principal: Approved, session: Database) -> JobResponse:
    return operation(session, lambda: JobService(session).create(principal, request))


@router.patch(
    "/api/v1/companies/me/jobs/{job_id}",
    response_model=JobResponse,
    summary="Edit own job; content edits return to DRAFT and need review",
    responses=ERRORS,
)
def update_job(
    job_id: AccountId, request: JobUpdate, principal: Approved, session: Database
) -> JobResponse:
    return operation(session, lambda: JobService(session).update(principal, job_id, request))


@router.post(
    "/api/v1/companies/me/jobs/{job_id}/{action}",
    response_model=JobResponse,
    summary="Submit/pause/reopen/close with validated state transitions",
    responses=ERRORS,
    description=(
        "NULL deadline has no fixed deadline; dated deadline is inclusive through that UTC day. "
        "Reopen PAUSED returns PENDING for Admin review. No hard delete."
    ),
)
def action(
    job_id: AccountId,
    action: Literal["submit", "pause", "reopen", "close"],
    principal: Approved,
    session: Database,
) -> JobResponse:
    return operation(session, lambda: JobService(session).action(principal, job_id, action))


@router.get(
    "/api/v1/admin/jobs",
    response_model=JobPage,
    summary="ADMIN lists jobs for moderation",
    responses=ERRORS,
)
def admin_jobs(
    principal: Admin,
    session: Database,
    response: Response,
    status: JobStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: JobService(session).listing(
            internal=True, status=status, limit=limit, offset=offset
        ),
    )


@router.patch(
    "/api/v1/admin/jobs/{job_id}/review",
    response_model=JobResponse,
    summary="ADMIN approves/rejects only PENDING jobs",
    responses=ERRORS,
)
def review_job(
    job_id: AccountId, request: JobReview, principal: Admin, session: Database
) -> JobResponse:
    return operation(session, lambda: JobService(session).review(principal, job_id, request))
