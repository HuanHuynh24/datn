import json
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    JsonValue,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.auth.schemas import AccountId

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Salary = Annotated[Decimal, Field(ge=0, max_digits=15, decimal_places=2)]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    full_name: Name | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)
    introduction: str | None = Field(default=None, max_length=16000)
    avatar_url: HttpUrl | None = Field(default=None, max_length=500)
    profile_public: bool | None = Field(default=None, strict=True)
    education: JsonValue | None = None
    experience: JsonValue | None = None
    desired_position: str | None = Field(default=None, max_length=255)
    province_id: AccountId | None = None
    minimum_salary: Salary | None = None
    maximum_salary: Salary | None = None
    desired_work_type: str | None = Field(default=None, max_length=60)

    @field_validator("education", "experience")
    @classmethod
    def bounded_json(cls, value):
        if len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode()) > 65535:
            raise ValueError("JSON field exceeds 65535 bytes")
        return value

    @model_validator(mode="after")
    def required_values_cannot_be_cleared(self):
        for name in ("full_name", "profile_public"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: AccountId
    candidate_id: AccountId
    full_name: str
    email: str
    phone: str | None
    address: str | None
    introduction: str | None
    avatar_url: str | None
    profile_public: bool
    education: JsonValue | None
    experience: JsonValue | None
    desired_position: str | None
    province_id: AccountId | None
    minimum_salary: Decimal | None
    maximum_salary: Decimal | None
    desired_work_type: str | None
    updated_at: datetime
