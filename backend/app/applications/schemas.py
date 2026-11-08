from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.auth.schemas import AccountId


class ApplicationStatus(StrEnum):
    APPLIED = "APPLIED"
    REVIEWING = "REVIEWING"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    HIRED = "HIRED"
    REJECTED = "REJECTED"


TRANSITIONS = {
    "APPLIED": {"REVIEWING", "REJECTED"},
    "REVIEWING": {"INTERVIEW", "OFFER", "REJECTED"},
    "INTERVIEW": {"OFFER", "REJECTED"},
    "OFFER": {"HIRED", "REJECTED"},
    "HIRED": set(),
    "REJECTED": set(),
}


class CVUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_primary: bool = Field(strict=True)


class CVResponse(BaseModel):
    id: AccountId
    is_primary: bool
    status: Literal["ACTIVE", "ARCHIVED"]
    created_at: datetime
    format: Literal["pdf", "docx"]


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cv_id: AccountId
    cover_letter: str | None = Field(default=None, max_length=16000)


class ApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: ApplicationStatus


class ApplicationResponse(BaseModel):
    id: AccountId
    candidate_id: AccountId
    candidate_name: str
    candidate_email: str
    job_id: AccountId
    job_title: str
    company_id: AccountId
    company_name: str
    cv_id: AccountId | None
    cover_letter: str | None
    status: ApplicationStatus
    submitted_at: datetime
    updated_at: datetime


class ApplicationPage(BaseModel):
    items: list[ApplicationResponse]
    total: int
    limit: int
    offset: int
