"""Approved E6 job contracts; incomplete DRAFT content is checked on submission."""

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.auth.schemas import AccountId

Money = Annotated[Decimal, Field(ge=0, max_digits=15, decimal_places=2)]


class JobStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"


class JobSkillInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skill_id: AccountId
    required: bool = Field(strict=True)
    priority: int = Field(ge=0, le=2147483647, strict=True)


class JobContentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    description: str | None = Field(default=None, max_length=16000)
    requirements: str | None = Field(default=None, max_length=16000)
    industry_id: AccountId
    province_id: AccountId
    ward_id: AccountId | None = None
    street: str | None = Field(default=None, max_length=255)
    level: str | None = Field(default=None, max_length=100)
    minimum_salary: Money | None = None
    maximum_salary: Money | None = None
    years_experience: Annotated[Decimal, Field(ge=0, max_digits=4, decimal_places=1)] | None = None
    work_type: str | None = Field(default=None, max_length=60)
    application_deadline: date | None = None
    skills: list[JobSkillInput] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def consistent_values(self):
        if self.minimum_salary is not None and self.maximum_salary is not None:
            if self.minimum_salary > self.maximum_salary:
                raise ValueError("minimum_salary must not exceed maximum_salary")
        ids = [skill.skill_id for skill in self.skills]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate skill_id")
        return self


class JobUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
        | None
    ) = None
    description: str | None = Field(default=None, max_length=16000)
    requirements: str | None = Field(default=None, max_length=16000)
    industry_id: AccountId | None = None
    province_id: AccountId | None = None
    ward_id: AccountId | None = None
    street: str | None = Field(default=None, max_length=255)
    level: str | None = Field(default=None, max_length=100)
    minimum_salary: Money | None = None
    maximum_salary: Money | None = None
    years_experience: Annotated[Decimal, Field(ge=0, max_digits=4, decimal_places=1)] | None = None
    work_type: str | None = Field(default=None, max_length=60)
    application_deadline: date | None = None
    skills: list[JobSkillInput] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def nonnullable_values(self):
        for key in ("title", "industry_id", "province_id", "skills"):
            if key in self.model_fields_set and getattr(self, key) is None:
                raise ValueError(f"{key} cannot be null")
        if self.skills is not None:
            ids = [r.skill_id for r in self.skills]
            if len(ids) != len(set(ids)):
                raise ValueError("Duplicate skill_id")
        return self


class JobReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Annotated[str, Field(pattern="^(APPROVED|REJECTED)$")]
    reason: str | None = Field(default=None, max_length=16000)

    @model_validator(mode="after")
    def rejection_reason(self):
        if self.status == "REJECTED" and not (self.reason or "").strip():
            raise ValueError("Rejection reason required")
        return self


class JobSkillResponse(JobSkillInput):
    name: str


class JobResponse(BaseModel):
    id: AccountId
    company_id: AccountId
    company_name: str
    company_logo_url: str | None = None
    title: str
    description: str | None
    requirements: str | None
    industry_id: AccountId
    industry_name: str
    province_id: AccountId
    province_name: str
    ward_id: AccountId | None
    street: str | None
    level: str | None
    minimum_salary: Decimal | None
    maximum_salary: Decimal | None
    years_experience: Decimal | None
    work_type: str | None
    application_deadline: date | None
    status: JobStatus
    created_at: datetime
    skills: list[JobSkillResponse]
    poster_id: AccountId | None = None
    reviewer_id: AccountId | None = None
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None


class JobPage(BaseModel):
    items: list[JobResponse]
    total: int
    limit: int
    offset: int
