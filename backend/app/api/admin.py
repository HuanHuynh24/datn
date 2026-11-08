from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.companies import operation
from app.auth.dependencies import require_admin
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import AccountId, CompanyApprovalStatus, Principal
from app.companies.service import CompanyError
from app.db.session import get_db
from app.models import DoanhNghiep

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])
Admin = Annotated[Principal, Depends(require_admin)]
Database = Annotated[Session, Depends(get_db)]


class CompanyReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["APPROVED", "REJECTED"]


class CompanyReviewResponse(BaseModel):
    company_id: AccountId
    company_name: str
    tax_code: str
    approval_status: CompanyApprovalStatus


def company_row(row):
    return {
        "company_id": str(row["iddoanhnghiep"]),
        "company_name": row["tencongty"],
        "tax_code": row["masothue"],
        "approval_status": row["trangthaiduyet"],
    }


@router.get(
    "/companies",
    summary="ADMIN lists companies for review",
    responses=AUTH_ERROR_RESPONSES,
    response_model=list[CompanyReviewResponse],
)
def companies(
    principal: Admin,
    session: Database,
    response: Response,
    status: Literal["PENDING", "APPROVED", "REJECTED"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[dict]:
    response.headers["Cache-Control"] = "no-store"
    table = DoanhNghiep.__table__
    query = select(table).order_by(table.c.iddoanhnghiep.desc()).limit(limit).offset(offset)
    if status:
        query = query.where(table.c.trangthaiduyet == status)
    return operation(
        session, lambda: [company_row(row) for row in session.execute(query).mappings()]
    )


@router.patch(
    "/companies/{company_id}/review",
    summary="ADMIN approves or rejects a company",
    description="Only approval status changes. No rejection-reason column exists in ERD.",
    responses=AUTH_ERROR_RESPONSES,
    response_model=CompanyReviewResponse,
)
def review_company(
    company_id: AccountId,
    request: CompanyReview,
    principal: Admin,
    session: Database,
    response: Response,
) -> dict:
    response.headers["Cache-Control"] = "no-store"

    def act():
        table = DoanhNghiep.__table__
        row = (
            session.execute(
                select(table).where(table.c.iddoanhnghiep == int(company_id)).with_for_update()
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise CompanyError(404, "Company not found")
        session.execute(
            update(table)
            .where(table.c.iddoanhnghiep == int(company_id))
            .values(trangthaiduyet=request.status)
        )
        result = company_row(dict(row) | {"trangthaiduyet": request.status})
        session.commit()
        return result

    return operation(session, act)
