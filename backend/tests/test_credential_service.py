import secrets
from dataclasses import replace
from unittest.mock import Mock

import pytest
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.auth.accounts import AccountSnapshot
from app.auth.schemas import LoginRequest, Principal
from app.auth.service import AccountPrincipalResolver, CredentialService, InvalidCredentials
from app.core.passwords import hash_password, verify_password


@pytest.fixture
def credential_setup():
    password = secrets.token_urlsafe(24)
    account = AccountSnapshot(
        account_id="1",
        email="user@example.com",
        password_hash=hash_password(password),
        role="ADMIN",
        status="test-policy-value",
        email_verified=False,
        locked_until=None,
        candidate_id=None,
        member_company_id=None,
        member_status=None,
        member_title=None,
        company_id=None,
    )
    reader, policy = Mock(), Mock()
    reader.by_email.return_value = account
    reader.by_id.return_value = account
    policy.principal_for.return_value = Principal(
        account_id="1", role="ADMIN", authentication_allowed=True
    )
    return password, account, reader, policy


def test_password_verified_before_access_policy(credential_setup):
    password, account, reader, policy = credential_setup
    service = CredentialService(reader, policy)
    request = LoginRequest(email=account.email, password=password)
    verified = service.verify_login(request)
    assert verified.principal.account_id == "1"
    assert verified.replacement_hash is None
    reader.by_email.assert_called_once_with(account.email)
    policy.principal_for.assert_called_once_with(account)
    policy.reset_mock()
    with pytest.raises(InvalidCredentials):
        service.verify_login(LoginRequest(email=account.email, password=password + "wrong"))
    policy.principal_for.assert_not_called()


def test_unknown_account_has_same_error_and_runs_password_verification(
    credential_setup, monkeypatch
):
    password, account, reader, policy = credential_setup
    reader.by_email.return_value = None
    actual_verify = Mock(wraps=verify_password)
    monkeypatch.setattr("app.auth.service.verify_password", actual_verify)
    with pytest.raises(InvalidCredentials) as error:
        CredentialService(reader, policy).verify_login(
            LoginRequest(email=account.email, password=password)
        )
    assert not str(error.value)
    actual_verify.assert_called_once()
    policy.principal_for.assert_not_called()


@pytest.mark.parametrize(
    "principal",
    [
        None,
        Principal(account_id="1", role="ADMIN"),
        Principal(account_id="2", role="ADMIN", authentication_allowed=True),
    ],
)
def test_denied_or_mismatched_identity_never_succeeds(credential_setup, principal):
    password, account, reader, policy = credential_setup
    policy.principal_for.return_value = principal
    with pytest.raises(InvalidCredentials):
        CredentialService(reader, policy).verify_login(
            LoginRequest(email=account.email, password=password)
        )


def test_rehash_is_returned_privately_to_transaction_owner(credential_setup):
    password, account, reader, policy = credential_setup
    old = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=1024, parallelism=1),))
    reader.by_email.return_value = replace(account, password_hash=old.hash(password))
    result = CredentialService(reader, policy).verify_login(
        LoginRequest(email=account.email, password=password)
    )
    assert result.replacement_hash is not None
    assert result.replacement_hash not in repr(result)
    assert verify_password(password, result.replacement_hash) == (True, None)


def test_resolver_reloads_account_and_policy_for_each_request(credential_setup):
    _, account, reader, policy = credential_setup
    resolver = AccountPrincipalResolver(reader, policy)
    assert resolver.resolve("1").authentication_allowed is True
    policy.principal_for.return_value = None
    assert resolver.resolve("1") is None
    assert reader.by_id.call_count == 2
    reader.by_id.return_value = replace(account, account_id="2")
    policy.reset_mock()
    assert resolver.resolve("1") is None
    policy.principal_for.assert_not_called()
    reader.by_id.return_value = None
    assert resolver.resolve("1") is None


def test_malformed_stored_hash_is_not_authenticated(credential_setup):
    password, account, reader, policy = credential_setup
    reader.by_email.return_value = replace(account, password_hash="invalid-stored-value")
    with pytest.raises(InvalidCredentials):
        CredentialService(reader, policy).verify_login(
            LoginRequest(email=account.email, password=password)
        )
    policy.principal_for.assert_not_called()
