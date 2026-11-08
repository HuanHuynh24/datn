"""Candidate registration owns a single account/profile transaction, without business seeds."""

from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.schemas import (
    AccountStatus,
    CandidateRegistrationRequest,
    CandidateRegistrationResponse,
    ConfirmedSystemRole,
)
from app.core.passwords import hash_password
from app.models import HoSoUngVien, TaiKhoan


class RegistrationConflict(Exception):
    """The public error never includes a database error, email or stored hash."""


class CandidateRegistrationRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_account(self, email: str, full_name: str, password_hash: str, now: datetime) -> int:
        result = self.session.execute(
            TaiKhoan.__table__.insert().values(
                vaitro=ConfirmedSystemRole.CANDIDATE.value,
                email=email,
                hovaten=full_name,
                matkhaubam=password_hash,
                trangthai=AccountStatus.ACTIVE.value,
                thoigiantao=now,
                khoaden=None,
            )
        )
        return result.inserted_primary_key[0]

    def create_profile(self, account_id: int, now: datetime) -> int:
        result = self.session.execute(
            HoSoUngVien.__table__.insert().values(
                idtaikhoan=account_id,
                thoigiancapnhat=now,
            )
        )
        return result.inserted_primary_key[0]


class CandidateRegistrationService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = CandidateRegistrationRepository(session)

    def register(self, request: CandidateRegistrationRequest) -> CandidateRegistrationResponse:
        # Hash before opening the transaction; optional fields and the four
        # approved SQL defaults are left to the existing schema, not invented.
        password_hash = hash_password(request.password.get_secret_value())
        now = datetime.now(UTC).replace(tzinfo=None)
        try:
            with self.session.begin():
                account_id = self.repository.create_account(
                    str(request.email), request.full_name, password_hash, now
                )
                candidate_id = self.repository.create_profile(account_id, now)
                result = CandidateRegistrationResponse(
                    account_id=str(account_id), candidate_id=str(candidate_id)
                )
            # Return only after commit; a profile or commit failure rolls back
            # the account too. The MySQL unique index arbitrates duplicate races.
            return result
        except IntegrityError as error:
            if error.orig.args and error.orig.args[0] == 1062:
                raise RegistrationConflict() from None
            raise
