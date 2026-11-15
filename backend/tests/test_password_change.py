from dataclasses import replace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from test_account_policy import snapshot

from app.auth.password_change import (
    IncorrectCurrentPassword,
    PasswordChangeDenied,
    PasswordChangeRequest,
    PasswordChangeService,
)
from app.core.passwords import hash_password, verify_password


@pytest.mark.parametrize("new", ["short", "same-current-password", "x" * 1025])
def test_password_change_validation_does_not_accept_bad_new_password(new):
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="same-current-password", new_password=new)


def test_password_change_uses_hash_and_commits_only_after_replacement():
    session = Mock()
    service = PasswordChangeService(session)
    service.repository = Mock()
    service.repository.locked_account.return_value = replace(
        snapshot(), password_hash=hash_password("old-value-123")
    )
    request = PasswordChangeRequest(current_password="old-value-123", new_password="new-value-456")
    service.change("1", request)
    written = service.repository.replace_hash.call_args.args
    assert written[0] == "1" and written[1].startswith("$argon2id$")
    assert verify_password("new-value-456", written[1])[0]
    session.commit.assert_called_once()
    session.rollback.assert_not_called()
    assert "old-value-123" not in repr(request) and "new-value-456" not in repr(request)


@pytest.mark.parametrize("denied", [False, True])
def test_password_change_denial_rolls_back_without_hash_update(denied):
    session = Mock()
    service = PasswordChangeService(session)
    service.repository = Mock()
    service.repository.locked_account.return_value = (
        None if denied else replace(snapshot(), password_hash=hash_password("old-value-123"))
    )
    with pytest.raises(PasswordChangeDenied if denied else IncorrectCurrentPassword):
        service.change(
            "1", PasswordChangeRequest(current_password="wrong-value", new_password="new-value-456")
        )
    service.repository.replace_hash.assert_not_called()
    session.commit.assert_not_called()
    session.rollback.assert_called_once()
