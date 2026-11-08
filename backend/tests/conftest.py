import pytest

from app.core.config import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
        mysql_password="unit-test-password-only",
        cors_origins="http://localhost:3000",
    )
