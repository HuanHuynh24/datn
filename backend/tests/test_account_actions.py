from dataclasses import replace
from unittest.mock import Mock

import jwt
import pytest
from pydantic import SecretStr
from test_account_policy import snapshot

from app.auth.account_actions import (
    AccountActionCodec,
    AccountActionService,
    ActionInvalid,
    EmailCooldown,
)
from app.auth.tokens import InvalidAccessToken, TokenCodec
from app.core.mail import MailUnavailable, SMTPMailer


def configured(settings):
    return settings.model_copy(
        update={
            "jwt_secret": SecretStr("unit-action-key-" + "x" * 40),
            "smtp_host": "smtp.example.com",
            "smtp_username": "sender@example.com",
            "smtp_password": SecretStr("unit-smtp-secret"),
            "smtp_from_email": "sender@example.com",
        }
    )


def test_action_tokens_are_bound_to_password_email_purpose_and_expire(settings):
    settings = configured(settings)
    codec = AccountActionCodec(settings)
    account = snapshot()
    token = codec.issue(account, "password_reset")
    codec.verify(token, account, "password_reset")
    for target, purpose in [
        (replace(account, password_hash="changed"), "password_reset"),
        (replace(account, email="changed@example.com"), "password_reset"),
        (account, "email_verification"),
    ]:
        with pytest.raises(ActionInvalid):
            codec.verify(token, target, purpose)
    payload = jwt.decode(token, options={"verify_signature": False})
    for key in ["iat", "nbf", "exp"]:
        payload[key] -= 901
    expired = jwt.encode(payload, codec.key(account, "password_reset"), algorithm="HS256")
    with pytest.raises(ActionInvalid):
        codec.verify(expired, account, "password_reset")
    with pytest.raises(InvalidAccessToken):
        TokenCodec(
            settings.jwt_secret, settings.jwt_issuer, settings.jwt_audience
        ).verify_access_token(token)


def test_mail_links_only_in_message_fragment_not_response_or_database(settings):
    session, mailer = Mock(), Mock()
    service = AccountActionService(session, configured(settings), mailer, EmailCooldown())
    service.reader = Mock()
    service.reader.by_email.return_value = snapshot()
    assert service.request_email("password_reset", email="user@example.com") is None
    message = mailer.deliver.call_args.args[0]
    assert "#token=" in message.get_content() and "?token=" not in message.get_content()
    assert snapshot().password_hash not in message.get_content()
    session.execute.assert_not_called()
    session.commit.assert_not_called()
    assert session.rollback.call_count >= 1
    service.reader.by_email.assert_called_once_with("user@example.com")


def test_smtp_requires_configuration_and_authenticated_tls(settings, monkeypatch):
    with pytest.raises(MailUnavailable):
        SMTPMailer(settings).ensure_configured()
    client = Mock()
    client.__enter__ = Mock(return_value=client)
    client.__exit__ = Mock(return_value=False)
    client.noop.return_value = (250, b"OK")
    constructor = Mock(return_value=client)
    monkeypatch.setattr("app.core.mail.smtplib.SMTP", constructor)
    SMTPMailer(configured(settings)).deliver(None)
    client.starttls.assert_called_once()
    client.login.assert_called_once_with("sender@example.com", "unit-smtp-secret")
    client.send_message.assert_not_called()
    client.noop.assert_called_once()


def test_cooldown_hashes_keys_and_releases_failed_sends():
    cooldown = EmailCooldown()
    key = cooldown.reserve("User@example.com", "password_reset")
    assert key and "example.com" not in repr(cooldown.entries)
    assert cooldown.reserve("user@example.com", "password_reset") is None
    assert cooldown.reserve("user@example.com", "email_verification") is not None
    cooldown.release(key)
    assert cooldown.reserve("user@example.com", "password_reset")
