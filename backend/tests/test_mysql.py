"""Opt-in, read-only connectivity checks; never create or mutate schema."""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import Settings
from app.main import create_app

pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(os.getenv("RUN_MYSQL_TESTS") != "1", reason="MySQL checks are opt-in"),
]


def test_mysql_84_and_readiness():
    app = create_app(Settings())
    with TestClient(app) as client:
        assert client.get("/health/ready").json() == {"status": "ready"}
        with app.state.engine.connect() as connection:
            version = connection.scalar(text("SELECT VERSION()"))
            assert version.startswith("8.4."), version
            charset = connection.scalar(text("SELECT @@character_set_database"))
            assert charset == "utf8mb4"
