import secrets

import pytest
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.passwords import hash_password, verify_password


def test_password_hashing_is_salted_and_rejects_wrong_password():
    password = secrets.token_urlsafe(24)
    first = hash_password(password)
    second = hash_password(password)
    assert first.startswith("$argon2id$")
    assert first != second
    assert password not in first
    assert len(first) <= 255  # taikhoan.matkhaubam in ERD R2.
    assert verify_password(password, first) == (True, None)
    assert verify_password(password + "wrong", first) == (False, None)


@pytest.mark.parametrize("stored_hash", ["", "plaintext", "$argon2id$invalid"])
def test_malformed_hash_fails_closed(stored_hash):
    assert verify_password(secrets.token_urlsafe(24), stored_hash) == (False, None)


def test_password_whitespace_is_not_silently_normalized():
    password = secrets.token_urlsafe(24)
    stored = hash_password(" " + password + " ")
    assert verify_password(" " + password + " ", stored) == (True, None)
    assert verify_password(password, stored) == (False, None)


def test_successful_verification_upgrades_an_outdated_hash_policy():
    password = secrets.token_urlsafe(24)
    old_hasher = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=1024, parallelism=1),))
    stored = old_hasher.hash(password)
    assert verify_password(password + "wrong", stored) == (False, None)
    valid, replacement = verify_password(password, stored)
    assert valid is True
    assert replacement is not None
    assert replacement != stored
    assert verify_password(password, replacement) == (True, None)
