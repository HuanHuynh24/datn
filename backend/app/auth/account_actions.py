"""One-use account action links bound to current email/password; no token table."""

import hashlib
import hmac
import secrets
from dataclasses import replace
from datetime import UTC, datetime
from email.message import EmailMessage
from threading import Lock
from time import monotonic
from typing import Literal

import jwt
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, ValidationError
from sqlalchemy import update

from app.auth.policy import ApprovedAccountPolicy
from app.auth.repository import SqlAlchemyAccountReader
from app.auth.schemas import AccountId
from app.core.passwords import hash_password, verify_password
from app.models import TaiKhoan

Purpose = Literal["password_reset", "email_verification"]
LIFETIME = {"password_reset": 900, "email_verification": 86400}


class ActionInvalid(Exception):
    pass


class EmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=255)


class ActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr = Field(min_length=1, max_length=4096)


class ResetPasswordRequest(ActionRequest):
    new_password: SecretStr = Field(min_length=8, max_length=1024)


class AccountDetails(BaseModel):
    email: EmailStr
    email_verified: bool


class ActionResponse(BaseModel):
    message: str


class ActionClaims(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sub: AccountId
    token_use: Purpose
    iss: str
    aud: str
    iat: int
    nbf: int
    exp: int
    jti: str


class AccountActionCodec:
    def __init__(self, settings):
        if settings.jwt_secret is None:
            raise ActionInvalid()
        self.secret = settings.jwt_secret.get_secret_value().encode()
        self.issuer = settings.jwt_issuer

    def key(self, account, purpose):
        # Password hashes never enter token claims. A password/email change
        # changes the signature key, invalidating every older action link.
        material = "\0".join(
            ["account-action-v1", purpose, account.account_id, account.email, account.password_hash]
        ).encode()
        return hmac.new(self.secret, material, hashlib.sha256).digest()

    def issue(self, account, purpose: Purpose):
        now = int(datetime.now(UTC).timestamp())
        payload = ActionClaims(
            sub=account.account_id,
            token_use=purpose,
            iss=self.issuer,
            aud="recruitment-account-actions",
            iat=now,
            nbf=now,
            exp=now + LIFETIME[purpose],
            jti=secrets.token_hex(16),
        )
        return jwt.encode(payload.model_dump(), self.key(account, purpose), algorithm="HS256")

    def subject(self, token: str) -> str:
        try:
            header = jwt.get_unverified_header(token)
            if (
                header.get("alg") != "HS256"
                or header.get("typ") != "JWT"
                or any(key in header for key in ["kid", "jku", "jwk", "x5u", "crit"])
            ):
                raise ActionInvalid()
            # Untrusted sub is only a bound DB lookup, never authorization.
            return ActionClaims.model_validate(
                jwt.decode(token, options={"verify_signature": False})
            ).sub
        except (jwt.InvalidTokenError, ValidationError, ValueError):
            raise ActionInvalid() from None

    def verify(self, token, account, purpose):
        try:
            self.subject(token)
            data = jwt.decode(
                token,
                self.key(account, purpose),
                algorithms=["HS256"],
                issuer=self.issuer,
                audience="recruitment-account-actions",
                options={"require": list(ActionClaims.model_fields), "strict_aud": True},
            )
            claims = ActionClaims.model_validate(data)
            if (
                claims.sub != account.account_id
                or claims.token_use != purpose
                or claims.nbf != claims.iat
                or claims.exp - claims.iat != LIFETIME[purpose]
            ):
                raise ActionInvalid()
        except (jwt.InvalidTokenError, ValidationError, ValueError):
            raise ActionInvalid() from None


class EmailCooldown:
    """Development per-process anti-repeat; stores hashed keys, never email/token."""

    def __init__(self):
        self.lock = Lock()
        self.entries = {}

    def reserve(self, email, purpose):
        key = hashlib.sha256((purpose + "\0" + email.casefold()).encode()).hexdigest()
        with self.lock:
            now = monotonic()
            self.entries = {k: until for k, until in self.entries.items() if until > now}
            if key in self.entries or len(self.entries) >= 2048:
                return None
            self.entries[key] = now + 60
            return key

    def release(self, key):
        with self.lock:
            self.entries.pop(key, None)


class AccountActionService:
    def __init__(self, session, settings, mailer=None, cooldown=None):
        self.session, self.settings, self.mailer, self.cooldown = (
            session,
            settings,
            mailer,
            cooldown,
        )
        self.reader = SqlAlchemyAccountReader(session)
        self.codec = AccountActionCodec(settings)

    @staticmethod
    def eligible(account):
        return (
            account is not None
            and ApprovedAccountPolicy().principal_for(replace(account, locked_until=None))
            is not None
        )

    def request_email(self, purpose, email=None, account_id=None):
        self.mailer.ensure_configured()
        key = None
        try:
            # Email delivery may be slow. Only consume() takes row locks;
            # requesting a link never blocks password/login writers on SMTP.
            account = self.reader.by_id(account_id) if account_id else self.reader.by_email(email)
            self.session.rollback()
            if account_id and account is None:
                raise ActionInvalid()
            # Matching response and cooldown for unknown/ineligible addresses.
            key = self.cooldown.reserve(account.email if account else email, purpose)
            if key is None:
                return
            message = None
            if self.eligible(account) and not (
                purpose == "email_verification" and account.email_verified
            ):
                token = self.codec.issue(account, purpose)
                page = "reset-password" if purpose == "password_reset" else "verify-email"
                audience = (
                    "admin"
                    if account.role == "ADMIN"
                    else "recruiter"
                    if account.role == "COMPANY_MEMBER"
                    else "candidate"
                )
                link = f"{self.settings.frontend_url}/{page}?audience={audience}#token={token}"
                message = EmailMessage()
                message["From"] = str(self.settings.smtp_from_email)
                message["To"] = account.email
                message["Subject"] = (
                    "Talentiq — Đặt lại mật khẩu"
                    if purpose == "password_reset"
                    else "Talentiq — Xác thực email"
                )
                duration = "15 phút" if purpose == "password_reset" else "24 giờ"
                message.set_content(
                    f"Bạn vừa yêu cầu {message['Subject']}.\n"
                    f"Mở liên kết sau (có hiệu lực {duration}):\n{link}\n\n"
                    "Nếu không yêu cầu, bạn có thể bỏ qua email này. Không chia sẻ liên kết."
                )
            # Probe SMTP too for unknown addresses so misconfiguration is not
            # reported as success for one address and failure for another.
            self.mailer.deliver(message)
        except Exception:
            if key:
                self.cooldown.release(key)
            raise
        finally:
            self.session.rollback()  # Email request never changes account data.

    def consume(self, token, purpose, new_password=None):
        try:
            account = self.reader.by_id(self.codec.subject(token), lock=True)
            if not self.eligible(account):
                raise ActionInvalid()
            self.codec.verify(token, account, purpose)
            values = {}
            if purpose == "password_reset":
                if verify_password(new_password, account.password_hash)[0]:
                    raise ActionInvalid()
                values = {
                    "matkhaubam": hash_password(new_password),
                    "solandangsai": 0,
                    "khoaden": None,
                }
            else:
                if account.email_verified:
                    raise ActionInvalid()
                values = {"daxacthucemail": True}
            table = TaiKhoan.__table__
            self.session.execute(
                update(table).where(table.c.idtaikhoan == int(account.account_id)).values(**values)
            )
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
