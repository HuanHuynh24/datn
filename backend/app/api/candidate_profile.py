from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentPrincipal
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import AuthErrorResponse, Principal
from app.candidates.schemas import ProfileResponse, ProfileUpdate
from app.candidates.service import CandidateProfileService, InvalidProfile, ProfileNotFound
from app.db.session import get_db

router = APIRouter(prefix="/api/v1/candidates/me/profile", tags=["Candidate Profile"])


def require_candidate(principal: CurrentPrincipal) -> Principal:
    if principal.role != "CANDIDATE":
        raise HTTPException(status_code=403, detail="Candidate account required")
    return principal


Candidate = Annotated[Principal, Depends(require_candidate)]
Database = Annotated[Session, Depends(get_db)]
ERRORS = {
    **AUTH_ERROR_RESPONSES,
    404: {"model": AuthErrorResponse, "description": "Profile not found"},
}


@router.get(
    "",
    response_model=ProfileResponse,
    summary="Read the authenticated Candidate profile",
    description="Owner only. Identity comes from JWT/current account, never a client ID.",
    responses=ERRORS,
)
def get_profile(principal: Candidate, session: Database, response: Response) -> ProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return CandidateProfileService(session).get(principal.account_id)
    except ProfileNotFound:
        raise HTTPException(status_code=404, detail="Profile not found") from None
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Profile backend unavailable") from None


@router.patch(
    "",
    response_model=ProfileResponse,
    summary="Update the authenticated Candidate profile",
    description=(
        "PATCH: omitted fields unchanged; nullable fields accept null. "
        "Account/profile update atomically. UTC updated_at is server assigned."
    ),
    responses=ERRORS,
)
def update_profile(
    request: ProfileUpdate, principal: Candidate, session: Database, response: Response
) -> ProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return CandidateProfileService(session).update(principal.account_id, request)
    except ProfileNotFound:
        session.rollback()
        raise HTTPException(status_code=404, detail="Profile not found") from None
    except InvalidProfile as error:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from None
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=503, detail="Profile backend unavailable") from None
