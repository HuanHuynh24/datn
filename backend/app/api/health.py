from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine

router = APIRouter(tags=["Health"])


class LivenessResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"


class UnavailableResponse(BaseModel):
    detail: Literal["Database unavailable"] = "Database unavailable"


@router.get(
    "/health/live",
    summary="Check API process liveness",
    description="Does not query the database or initialize schema.",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
)
def liveness() -> LivenessResponse:
    return LivenessResponse()


@router.get(
    "/health/ready",
    summary="Check database connectivity",
    description="Executes SELECT 1 using the application database user; creates no tables.",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    responses={503: {"model": UnavailableResponse, "description": "Database unavailable"}},
)
def readiness(engine: Annotated[Engine, Depends(get_engine)]) -> ReadinessResponse:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return ReadinessResponse()
