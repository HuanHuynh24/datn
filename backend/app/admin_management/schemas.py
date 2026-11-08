from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.auth.schemas import AccountId

Resource = Literal[
    "accounts", "candidates", "companies", "jobs", "industries", "skills", "packages"
]


class AdminRecord(BaseModel):
    id: AccountId
    name: str
    status: str | None = None
    email: str | None = None
    role: str | None = None
    account_id: AccountId | None = None
    company_id: AccountId | None = None
    company_name: str | None = None
    tax_code: str | None = None
    created_at: datetime | None = None
    description: str | None = None
    requirements: str | None = None
    position: str | None = None
    package_code: str | None = None
    member_limit: int | None = None
    monthly_price: str | None = None


class AdminPage(BaseModel):
    items: list[AdminRecord]
    total: int
    limit: int
    offset: int


class Dashboard(BaseModel):
    accounts: int
    candidates: int
    companies: int
    jobs: int
    applications: int
    cvs: int
    industries: int
    skills: int
    packages: int
    accounts_by_status: dict[str, int]
    companies_by_status: dict[str, int]
    jobs_by_status: dict[str, int]
    applications_by_status: dict[str, int]
    generated_at: datetime


class AccountStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ACTIVE", "DISABLED"]


class CatalogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=150)
    status: Literal["ACTIVE", "INACTIVE"]

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError("Control characters are not allowed")
        return value


class CatalogUpdate(CatalogCreate):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    status: Literal["ACTIVE", "INACTIVE"] | None = None

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Supply at least one non-null name or status")
        return self
