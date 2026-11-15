"""Approved five failures / fifteen minute UTC lock; serialized on account rows."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.auth.policy import ApprovedAccountPolicy, lock_is_active
from app.auth.repository import SqlAlchemyAccountReader
from app.auth.service import (
    CredentialService,
    InvalidCredentials,
    VerifiedLogin,
    _dummy_password_hash,
)
from app.core.passwords import verify_password
from app.models import TaiKhoan


class TransactionalCredentialService(CredentialService):
    def __init__(self, session):
        super().__init__(SqlAlchemyAccountReader(session), ApprovedAccountPolicy())
        self.session = session

    def verify_login(self, request):
        try:
            account = self.reader.by_email(str(request.email), lock=True)
            valid, replacement = verify_password(
                request.password.get_secret_value(),
                account.password_hash if account else _dummy_password_hash(),
            )
            if account is None or lock_is_active(account.locked_until):
                raise InvalidCredentials()
            principal = self.policy.principal_for(replace(account, locked_until=None))
            if principal is None:
                raise InvalidCredentials()
            table = TaiKhoan.__table__
            now = datetime.now(UTC).replace(tzinfo=None)
            count = 0 if account.locked_until is not None else account.failed_login_count
            if not valid:
                count += 1
                self.session.execute(
                    update(table)
                    .where(table.c.idtaikhoan == int(account.account_id))
                    .values(
                        solandangsai=count,
                        khoaden=now + timedelta(minutes=15) if count >= 5 else None,
                    )
                )
                self.session.commit()
                raise InvalidCredentials()
            values = {"solandangsai": 0, "khoaden": None}
            if replacement:
                values["matkhaubam"] = replacement
            self.session.execute(
                update(table).where(table.c.idtaikhoan == int(account.account_id)).values(**values)
            )
            self.session.commit()
            return VerifiedLogin(principal=principal)
        except Exception:
            self.session.rollback()
            raise
