import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.db.session import build_engine


@pytest.mark.parametrize("origin", ["*", "http://localhost:3000/path", "ftp://example.com"])
def test_invalid_origins_are_rejected(origin):
    with pytest.raises(ValidationError):
        Settings(mysql_password="unit-test-password-only", cors_origins=origin)


def test_password_placeholders_are_rejected():
    with pytest.raises(ValidationError):
        Settings(mysql_password="CHANGE_ME_APPLICATION_SECRET")


@pytest.mark.parametrize("secret", ["short", "CHANGE_ME_JWT_SECRET_LONG_ENOUGH_BUT_INVALID"])
def test_invalid_jwt_secret_is_rejected(secret):
    with pytest.raises(ValidationError):
        Settings(mysql_password="unit-test-password-only", jwt_secret=secret)


def test_database_password_handles_special_characters(settings):
    secret = "special@:/?#%password-for-test"
    engine = build_engine(settings.model_copy(update={"mysql_password": settings.mysql_password}))
    try:
        assert engine.url.password == settings.mysql_password.get_secret_value()
        assert settings.mysql_password.get_secret_value() not in repr(settings)
    finally:
        engine.dispose()
    configured = Settings(mysql_password=secret)
    engine = build_engine(configured)
    try:
        assert engine.url.password == secret
        assert secret not in str(engine.url)
    finally:
        engine.dispose()
