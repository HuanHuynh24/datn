from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.candidate_profile import Candidate, Database
from app.api.companies import WRITE_ERRORS, CompanyMember
from app.applications.schemas import (
    ApplicationCreate,
    ApplicationPage,
    ApplicationResponse,
    ApplicationStatus,
    ApplicationUpdate,
    CVResponse,
    CVUpdate,
)
from app.applications.service import CVApplicationService
from app.auth.dependencies import CurrentPrincipal
from app.auth.schemas import AccountId
from app.companies.service import CompanyError
from app.cv.storage import InvalidCVFile, PrivateCVStorage

router = APIRouter(prefix="/api/v1", tags=["CV and Applications"], responses=WRITE_ERRORS)


def service(request, session):
    return CVApplicationService(
        session, PrivateCVStorage(request.app.state.settings.cv_storage_dir)
    )


def operation(session, action):
    try:
        return action()
    except CompanyError as error:
        session.rollback()
        raise HTTPException(error.status, error.detail) from None
    except InvalidCVFile:
        session.rollback()
        raise HTTPException(422, "A valid PDF or DOCX up to 10 MiB is required") from None
    except (OSError, SQLAlchemyError):
        session.rollback()
        raise HTTPException(503, "CV/application backend unavailable") from None


def download(result, key):
    stream, suffix = result

    def chunks():
        try:
            while chunk := stream.read(65536):
                yield chunk
        finally:
            stream.close()

    media = (
        "application/pdf"
        if suffix == "pdf"
        else ("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    )
    return StreamingResponse(
        chunks(),
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="cv-{key}.{suffix}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/candidates/me/cvs", response_model=list[CVResponse])
def list_cvs(request: Request, principal: Candidate, session: Database, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return operation(session, lambda: service(request, session).list_cvs(principal))


@router.post(
    "/candidates/me/cvs",
    response_model=CVResponse,
    status_code=201,
    summary="Upload a private PDF/DOCX CV, maximum 10 MiB",
)
def upload_cv(
    request: Request, principal: Candidate, session: Database, file: Annotated[UploadFile, File()]
):
    try:
        return operation(session, lambda: service(request, session).upload(principal, file))
    finally:
        file.file.close()


@router.patch("/candidates/me/cvs/{cv_id}", response_model=CVResponse)
def update_cv(
    cv_id: AccountId, body: CVUpdate, request: Request, principal: Candidate, session: Database
):
    return operation(
        session,
        lambda: service(request, session).update_cv(principal, cv_id, primary=body.is_primary),
    )


@router.delete(
    "/candidates/me/cvs/{cv_id}",
    response_model=CVResponse,
    summary="Archive an owned CV; preserve application history",
)
def archive_cv(cv_id: AccountId, request: Request, principal: Candidate, session: Database):
    return operation(
        session, lambda: service(request, session).update_cv(principal, cv_id, archive=True)
    )


@router.get("/candidates/me/cvs/{cv_id}/download", response_class=StreamingResponse)
def download_cv(cv_id: AccountId, request: Request, principal: Candidate, session: Database):
    return download(
        operation(session, lambda: service(request, session).cv_download(principal, cv_id)), cv_id
    )


@router.post("/jobs/{job_id}/applications", response_model=ApplicationResponse, status_code=201)
def apply(
    job_id: AccountId,
    body: ApplicationCreate,
    request: Request,
    principal: Candidate,
    session: Database,
):
    return operation(session, lambda: service(request, session).apply(principal, job_id, body))


def listing(request, principal, session, response, status, job_id, limit, offset):
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: service(request, session).listing(
            principal, status=status, job_id=job_id, limit=limit, offset=offset
        ),
    )


@router.get("/candidates/me/applications", response_model=ApplicationPage)
def candidate_applications(
    request: Request,
    principal: Candidate,
    session: Database,
    response: Response,
    status: ApplicationStatus | None = None,
    job_id: AccountId | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return listing(request, principal, session, response, status, job_id, limit, offset)


@router.get("/companies/me/applications", response_model=ApplicationPage)
def company_applications(
    request: Request,
    principal: CompanyMember,
    session: Database,
    response: Response,
    status: ApplicationStatus | None = None,
    job_id: AccountId | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return listing(request, principal, session, response, status, job_id, limit, offset)


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def application_detail(
    application_id: AccountId,
    request: Request,
    principal: CurrentPrincipal,
    session: Database,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    app = service(request, session)
    return operation(session, lambda: app.response(app.repo.detail(principal, application_id)))


@router.patch("/companies/me/applications/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: AccountId,
    body: ApplicationUpdate,
    request: Request,
    principal: CompanyMember,
    session: Database,
):
    return operation(
        session,
        lambda: service(request, session).update_application(principal, application_id, body),
    )


@router.get(
    "/applications/{application_id}/cv",
    response_class=StreamingResponse,
    summary="Download the immutable application snapshot; owner/company only",
)
def download_application_cv(
    application_id: AccountId, request: Request, principal: CurrentPrincipal, session: Database
):
    return download(
        operation(
            session,
            lambda: service(request, session).application_download(principal, application_id),
        ),
        application_id,
    )
