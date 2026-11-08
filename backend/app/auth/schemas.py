from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    StringConstraints,
)


def validate_account_id(value: str) -> str:
    if not value.isascii() or not value.isdecimal() or value.startswith("0"):
        raise ValueError("Account ID must be a positive decimal BIGINT string")
    if len(value) > 19 or int(value) > 9223372036854775807:
        raise ValueError("Account ID exceeds signed BIGINT range")
    return value


AccountId = Annotated[str, AfterValidator(validate_account_id)]


class ConfirmedSystemRole(StrEnum):
    # Approved by the user on 2026-11-02. These are API codes, not MySQL ENUMs.
    CANDIDATE = "CANDIDATE"
    COMPANY_MEMBER = "COMPANY_MEMBER"
    ADMIN = "ADMIN"


class AccountStatus(StrEnum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class MemberStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class CompanyApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class InternalCompanyRole(StrEnum):
    OWNER = "OWNER"
    RECRUITER = "RECRUITER"


class LoginRequest(BaseModel):
    """JSON login input; role/status/owner fields cannot be assigned by clients."""

    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=255)
    password: SecretStr = Field(min_length=1)


class CandidateRegistrationRequest(BaseModel):
    """The public route fixes the role; no IDs, status or profile ownership input."""

    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=255)
    full_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    password: SecretStr = Field(min_length=8, max_length=1024)


class CandidateRegistrationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: AccountId
    candidate_id: AccountId
    role: Literal["CANDIDATE"] = "CANDIDATE"


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str = Field(repr=False, min_length=1)
    token_type: Literal["bearer"] = "bearer"
    expires_in: Literal[1800] = 1800


class AccessClaims(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)
    sub: AccountId
    iss: str
    aud: str
    iat: int
    nbf: int
    exp: int
    token_use: Literal["access"]


class Principal(BaseModel):
    """Server-resolved identity; never constructed from JWT role/company claims."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    account_id: AccountId
    role: str = Field(min_length=1, max_length=30)
    authentication_allowed: bool = False
    company_id: AccountId | None = None
    internal_role: str | None = None
    company_approval_status: str | None = None


class CurrentUserResponse(BaseModel):
    account_id: AccountId
    role: ConfirmedSystemRole
    company_id: AccountId | None = None
    internal_role: InternalCompanyRole | None = None
    company_approval_status: CompanyApprovalStatus | None = None


class AuthErrorResponse(BaseModel):
    detail: str
