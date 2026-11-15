"""Self-service password updates on the existing account table; no schema changes."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.auth.policy import ApprovedAccountPolicy
from app.auth.repository import SqlAlchemyAccountReader
from app.core.passwords import hash_password, verify_password
from app.models import TaiKhoan


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: SecretStr = Field(min_length=1, max_length=1024)
    new_password: SecretStr = Field(min_length=8, max_length=1024)

    @model_validator(mode="after")
    def different_password(self):
        if self.current_password.get_secret_value() == self.new_password.get_secret_value():
            raise ValueError("New password must differ from current password")
        return self


class PasswordChangeResponse(BaseModel):
    message: str = "Password changed. Sign in again."


class IncorrectCurrentPassword(Exception):
    pass


class PasswordChangeDenied(Exception):
    pass


class PasswordChangeRepository:
    def __init__(self, session: Session):
        self.session = session

    def locked_account(self, account_id: str):
        return SqlAlchemyAccountReader(self.session).by_id(account_id, lock=True)

    def replace_hash(self, account_id: str, password_hash: str):
        table = TaiKhoan.__table__
        self.session.execute(
            update(table)
            .where(table.c.idtaikhoan == int(account_id))
            .values(matkhaubam=password_hash)
        )


class PasswordChangeService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = PasswordChangeRepository(session)

    def change(self, account_id: str, request: PasswordChangeRequest):
        # Authentication already started the request's transaction. Re-lock/read
        # current account/membership so concurrent password updates are serialized.
        try:
            account = self.repository.locked_account(account_id)
            if account is None or ApprovedAccountPolicy().principal_for(account) is None:
                raise PasswordChangeDenied()
            valid, _ = verify_password(
                request.current_password.get_secret_value(), account.password_hash
            )
            if not valid:
                raise IncorrectCurrentPassword()
            self.repository.replace_hash(
                account_id, hash_password(request.new_password.get_secret_value())
            )
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
