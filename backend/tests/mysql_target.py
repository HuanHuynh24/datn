"""Explicit test target guard: never fall back to the application's database."""

import os
import re
import secrets
from collections.abc import Mapping

from app.core.config import Settings


def auth_test_settings(environment: Mapping[str, str] | None = None) -> Settings:
    values = os.environ if environment is None else environment
    required = [
        "AUTH_TEST_DATABASE",
        "AUTH_TEST_DATABASE_CONFIRM",
        "AUTH_TEST_MYSQL_HOST",
        "AUTH_TEST_MYSQL_PORT",
        "AUTH_TEST_MYSQL_USER",
        "AUTH_TEST_MYSQL_PASSWORD",
    ]
    if any(not values.get(name) for name in required):
        raise ValueError("Explicit AUTH_TEST_* connection and database confirmation required")
    database = values["AUTH_TEST_DATABASE"]
    if (
        not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", database)
        or not database.endswith("_test")
        or values["AUTH_TEST_DATABASE_CONFIRM"] != database
        or values["AUTH_TEST_MYSQL_USER"].lower().split("@")[0] == "root"
    ):
        raise ValueError(
            "Only an explicitly confirmed *_test database and non-root user are allowed"
        )
    return Settings(
        _env_file=None,
        mysql_host=values["AUTH_TEST_MYSQL_HOST"],
        mysql_port=int(values["AUTH_TEST_MYSQL_PORT"]),
        mysql_database=database,
        mysql_user=values["AUTH_TEST_MYSQL_USER"],
        mysql_password=values["AUTH_TEST_MYSQL_PASSWORD"],
        jwt_secret=secrets.token_urlsafe(48),
        swagger_enabled=True,
        cors_origins="",
    )
