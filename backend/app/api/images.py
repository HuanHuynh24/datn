from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.candidate_profile import Candidate
from app.api.companies import CompanyMember, Owner
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import AccountId, AuthErrorResponse
from app.db.session import get_db
from app.images.service import ImageNotFound, ImageService
from app.images.storage import ImageTooLarge, InvalidImage

router = APIRouter(tags=["Profile Images"])
Database = Annotated[Session, Depends(get_db)]
ERRORS = {
    **AUTH_ERROR_RESPONSES,
    404: {"model": AuthErrorResponse},
    413: {"model": AuthErrorResponse},
    415: {"model": AuthErrorResponse},
    503: {"model": AuthErrorResponse},
}


class ImageResponse(BaseModel):
    url: str
    width: int
    height: int
    size: int
    media_type: Literal["image/png"]


def operation(session, action):
    try:
        return action()
    except ImageTooLarge:
        session.rollback()
        raise HTTPException(413, "Image exceeds 5 MiB or pixel limit") from None
    except InvalidImage:
        session.rollback()
        raise HTTPException(
            415, "A valid non-animated JPEG, PNG or WebP image is required"
        ) from None
    except ImageNotFound:
        session.rollback()
        raise HTTPException(404, "Image not found") from None
    except (OSError, SQLAlchemyError):
        session.rollback()
        raise HTTPException(503, "Image storage unavailable") from None


def upload(request, session, kind, owner_id, file, response):
    response.headers["Cache-Control"] = "no-store"
    return operation(
        session,
        lambda: ImageService(session, request.app.state.settings).upload(kind, owner_id, file),
    )


def image(request, session, kind, owner_id, **options):
    path = operation(
        session,
        lambda: ImageService(session, request.app.state.settings).read(kind, owner_id, **options),
    )
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post(
    "/api/v1/candidates/me/avatar",
    response_model=ImageResponse,
    responses=ERRORS,
    summary="Upload own Candidate avatar",
    description=(
        "JPEG/PNG/WebP up to 5 MiB/16 megapixels; non-animated PNG up to 1024px. "
        "Strips metadata; updates existing avatar URL only."
    ),
)
def upload_avatar(
    request: Request,
    session: Database,
    principal: Candidate,
    response: Response,
    file: Annotated[UploadFile, File()],
):
    return upload(request, session, "avatars", principal.account_id, file, response)


@router.get(
    "/api/v1/candidates/me/avatar",
    responses=ERRORS,
    response_class=FileResponse,
    summary="Read own managed avatar",
    description="Authenticated owner only; no public Candidate image endpoint.",
)
def read_avatar(request: Request, session: Database, principal: Candidate):
    return image(request, session, "avatars", principal.account_id)


@router.post(
    "/api/v1/companies/me/logo",
    response_model=ImageResponse,
    responses=ERRORS,
    summary="OWNER uploads own company logo",
    description=(
        "Same limits as Candidate avatar. Allowed for PENDING/REJECTED companies; "
        "does not change approval or quota."
    ),
)
def upload_logo(
    request: Request,
    session: Database,
    principal: Owner,
    response: Response,
    file: Annotated[UploadFile, File()],
):
    return upload(request, session, "logos", principal.company_id, file, response)


@router.get(
    "/api/v1/companies/me/logo",
    response_class=FileResponse,
    responses=ERRORS,
    summary="Read current member's managed company logo",
)
def read_logo(request: Request, session: Database, principal: CompanyMember):
    return image(request, session, "logos", principal.company_id)


@router.get(
    "/api/v1/media/companies/{company_id}/logos/{filename}",
    response_class=FileResponse,
    responses={404: {"model": AuthErrorResponse}, 503: {"model": AuthErrorResponse}},
    summary="Read current logo of an APPROVED company",
    description=(
        "Public PNG only while company is APPROVED and URL is its current managed logo. "
        "No directory or arbitrary file access."
    ),
)
def public_company_logo(request: Request, session: Database, company_id: AccountId, filename: str):
    return image(request, session, "logos", company_id, public=True, filename=filename)
