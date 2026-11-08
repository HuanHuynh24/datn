from typing import Literal

from fastapi import APIRouter, Query, Response

from app.admin_management.schemas import (
    AccountStatusUpdate,
    AdminPage,
    AdminRecord,
    CatalogCreate,
    CatalogUpdate,
    Dashboard,
    Resource,
)
from app.admin_management.service import AdminService
from app.api.admin import Admin, Database
from app.api.companies import WRITE_ERRORS, operation
from app.auth.schemas import AccountId

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Management"], responses=WRITE_ERRORS)


@router.get("/dashboard", response_model=Dashboard, summary="ADMIN aggregate counts from MySQL")
def dashboard(principal: Admin, session: Database, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: AdminService(session).dashboard())


@router.get(
    "/management/{resource}",
    response_model=AdminPage,
    summary="ADMIN searchable directory; no credentials or private CV data",
)
def listing(
    resource: Resource,
    principal: Admin,
    session: Database,
    response: Response,
    q: str = Query("", max_length=200),
    status: str | None = Query(None, max_length=30),
    role: str | None = Query(None, max_length=30),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: AdminService(session).listing(
            resource, q=q.strip(), status=status, role=role, limit=limit, offset=offset
        ),
    )


@router.get(
    "/management/{resource}/{record_id}",
    response_model=AdminRecord,
    summary="ADMIN selected management fields; no private CV access",
)
def detail(
    resource: Resource,
    record_id: AccountId,
    principal: Admin,
    session: Database,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: AdminService(session).detail(resource, record_id))


@router.patch(
    "/accounts/{account_id}/status",
    response_model=AdminRecord,
    summary="ADMIN enables/disables non-ADMIN accounts; existing JWT is rechecked",
)
def account_status(
    account_id: AccountId, request: AccountStatusUpdate, principal: Admin, session: Database
):
    return operation(session, lambda: AdminService(session).set_account_status(account_id, request))


@router.post(
    "/catalog/{resource}",
    response_model=AdminRecord,
    status_code=201,
    summary="ADMIN creates industry/skill; duplicate names rejected by MySQL uniqueness",
)
def create_catalog(
    resource: Literal["industries", "skills"],
    request: CatalogCreate,
    principal: Admin,
    session: Database,
):
    return operation(session, lambda: AdminService(session).save_catalog(resource, request))


@router.patch(
    "/catalog/{resource}/{record_id}",
    response_model=AdminRecord,
    summary="ADMIN updates name/status; existing references remain; no delete",
)
def update_catalog(
    resource: Literal["industries", "skills"],
    record_id: AccountId,
    request: CatalogUpdate,
    principal: Admin,
    session: Database,
):
    return operation(
        session, lambda: AdminService(session).save_catalog(resource, request, record_id)
    )
