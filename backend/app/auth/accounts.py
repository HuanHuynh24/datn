"""Read projections of confirmed ERD columns; no ORM schema or business defaults."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from app.auth.schemas import Principal


@dataclass(frozen=True)
class AccountSnapshot:
    account_id: str
    email: str
    password_hash: str = field(repr=False)
    role: str
    status: str
    email_verified: bool
    locked_until: datetime | None
    candidate_id: str | None
    member_company_id: str | None
    member_status: str | None
    member_title: str | None
    company_id: str | None
    company_approval_status: str | None = None


class AccountReader(Protocol):
    def by_email(self, email: str) -> AccountSnapshot | None: ...

    def by_id(self, account_id: str) -> AccountSnapshot | None: ...


class AccountAccessPolicy(Protocol):
    def principal_for(self, account: AccountSnapshot) -> Principal | None:
        """Evaluate explicitly approved role/status/lock/specialization rules."""
        ...
