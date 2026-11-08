from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, model_validator

from app.auth.schemas import (
    AccountId,
    AccountStatus,
    CandidateRegistrationRequest,
    CompanyApprovalStatus,
    InternalCompanyRole,
    MemberStatus,
)


class PackageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    package_id: AccountId
    code: str
    name: str
    member_limit: int | None
    monthly_price: Decimal
    description: str | None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_id: AccountId
    company_name: str
    tax_code: str
    industry: str | None
    size: str | None
    address: str | None
    website: str | None
    logo_url: str | None
    introduction: str | None
    profile_url: str | None
    approval_status: CompanyApprovalStatus
    created_at: datetime
    package_started_on: date | None
    package_expires_on: date | None
    package: PackageResponse
    active_member_count: int


class EmployerRegistrationRequest(CandidateRegistrationRequest):
    company_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    tax_code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
    package_id: AccountId


class EmployerRegistrationResponse(BaseModel):
    account_id: AccountId
    company_id: AccountId
    role: Literal["COMPANY_MEMBER"] = "COMPANY_MEMBER"
    internal_role: InternalCompanyRole = InternalCompanyRole.OWNER
    approval_status: CompanyApprovalStatus = CompanyApprovalStatus.PENDING


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
        | None
    ) = None
    industry: str | None = Field(default=None, max_length=200)
    size: str | None = Field(default=None, max_length=60)
    address: str | None = Field(default=None, max_length=255)
    website: HttpUrl | None = Field(default=None, max_length=255)
    logo_url: HttpUrl | None = Field(default=None, max_length=500)
    introduction: str | None = Field(default=None, max_length=16000)

    @model_validator(mode="after")
    def name_cannot_be_null(self):
        if "company_name" in self.model_fields_set and self.company_name is None:
            raise ValueError("company_name cannot be null")
        return self


class MemberCreate(CandidateRegistrationRequest):
    pass


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: MemberStatus


class MemberResponse(BaseModel):
    account_id: AccountId
    full_name: str
    email: str
    internal_role: InternalCompanyRole
    status: MemberStatus
    account_status: AccountStatus
    added_at: datetime
