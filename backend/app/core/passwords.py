"""Password hashing primitives; account storage and authentication follow separately."""

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash the exact password with Argon2 and an independently generated salt."""
    return _password_hash.hash(password)


def verify_password(password: str, stored_hash: str) -> tuple[bool, str | None]:
    """Return verification and an optional replacement hash for policy upgrades.

    A future account service must persist a replacement only after successful
    verification and within its transaction. Unknown hash formats fail closed.
    """
    try:
        return _password_hash.verify_and_update(password, stored_hash)
    except (UnknownHashError, ValueError):
        return False, None
