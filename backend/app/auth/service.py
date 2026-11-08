import secrets
from dataclasses import dataclass, field
from functools import lru_cache

from app.auth.accounts import AccountAccessPolicy, AccountReader
from app.auth.schemas import LoginRequest, Principal
from app.core.passwords import hash_password, verify_password


class InvalidCredentials(Exception):
    """Same public result for an unknown account, wrong password or denied account."""


@dataclass(frozen=True)
class VerifiedLogin:
    principal: Principal
    replacement_hash: str | None = field(default=None, repr=False)


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    # Runtime random material only, never a default account or known credential.
    return hash_password(secrets.token_urlsafe(48))


class CredentialService:
    """Verify credentials without inventing status values or mutating account data.

    The caller must supply an approved access policy. A future transaction owner
    persists replacement_hash after success; this object never commits or emits
    tokens before that transaction completes.
    """

    def __init__(self, reader: AccountReader, policy: AccountAccessPolicy):
        self.reader = reader
        self.policy = policy

    def verify_login(self, request: LoginRequest) -> VerifiedLogin:
        account = self.reader.by_email(str(request.email))
        stored_hash = account.password_hash if account else _dummy_password_hash()
        valid, replacement = verify_password(request.password.get_secret_value(), stored_hash)
        if account is None or not valid:
            raise InvalidCredentials()
        principal = self.policy.principal_for(account)
        if (
            principal is None
            or not principal.authentication_allowed
            or principal.account_id != account.account_id
        ):
            raise InvalidCredentials()
        return VerifiedLogin(principal=principal, replacement_hash=replacement)


class AccountPrincipalResolver:
    """Re-read account and policy for every authenticated request, without caching roles."""

    def __init__(self, reader: AccountReader, policy: AccountAccessPolicy):
        self.reader = reader
        self.policy = policy

    def resolve(self, account_id: str) -> Principal | None:
        account = self.reader.by_id(account_id)
        if account is None or account.account_id != account_id:
            return None
        principal = self.policy.principal_for(account)
        if principal is None or principal.account_id != account_id:
            return None
        return principal
