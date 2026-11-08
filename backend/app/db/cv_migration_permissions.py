"""Approved E7 target/statement guard. Never authorizes unrelated DDL or DML."""

import hashlib
import json
import os
import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from sqlalchemy import event, inspect

from app.db.jobs_migration_permissions import ALL_TABLES as E6_TABLES
from app.db.jobs_migration_permissions import verify
from app.db.migration_permissions import DatabaseApplicationNotApproved

REVISION = "20261105_03"
CV_TABLES = {"hosocv", "donungtuyen"}
ALL_TABLES = E6_TABLES | CV_TABLES
_scope = ContextVar("e7_scope", default=None)


def active_e7_scope():
    return _scope.get()


def require_e7_scope():
    value = _scope.get()
    if value is None:
        raise DatabaseApplicationNotApproved("Verified E7 migration scope required")
    verify(*value)


def require_e7_settings(settings, target):
    if target not in {"cv-test", "cv-development"}:
        raise DatabaseApplicationNotApproved("Unknown E7 target")
    expected = (
        ("recruitment_cv_test", "cv_test_migrator")
        if target == "cv-test"
        else ("recruitment_db", "recruitment_app")
    )
    if (settings.mysql_host, settings.mysql_port, settings.mysql_database, settings.mysql_user) != (
        "mysql",
        3306,
        *expected,
    ) or os.getenv("CV_DDL_APPROVED") != REVISION:
        raise DatabaseApplicationNotApproved("E7 settings/approval mismatch")
    root = Path(__file__).resolve().parents[2]
    manifest = json.loads((root / "app/db/cv_migration_manifest.json").read_text())
    for name, digest in manifest.items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != digest:
            raise DatabaseApplicationNotApproved("E7 revision checksum changed")


@contextmanager
def e7_migration(connection, target):
    database, user = (
        ("recruitment_cv_test", "cv_test_migrator")
        if target == "cv-test"
        else ("recruitment_db", "recruitment_app")
    )
    verify(connection, database, user)
    names = set(inspect(connection).get_table_names())
    if target == "cv-test":
        if names:
            raise DatabaseApplicationNotApproved("E7 initial test DB must be empty")
    elif names != E6_TABLES or connection.exec_driver_sql(
        "SELECT version_num FROM alembic_version"
    ).scalars().all() != ["20261103_02"]:
        raise DatabaseApplicationNotApproved("E7 Development baseline mismatch")
    connection.rollback()

    def guard(conn, cursor, statement, parameters, context, executemany):
        sql = statement.strip()
        if re.match(r"^(SELECT|SHOW|DESCRIBE)\b", sql, re.I):
            return
        create = re.match(r"CREATE\s+TABLE\s+`?(\w+)`?\s*\(", sql, re.I)
        tables = ALL_TABLES if target == "cv-test" else CV_TABLES
        transitions = [("20261103_02", REVISION)]
        if target == "cv-test":
            transitions.append(("20261102_01", "20261103_02"))
        history = any(
            sql == f"UPDATE alembic_version SET version_num='{new}' "
            f"WHERE alembic_version.version_num = '{old}'"
            for old, new in transitions
        )
        initial = target == "cv-test" and sql == (
            "INSERT INTO alembic_version (version_num) VALUES ('20261102_01')"
        )
        if not ((create and create[1] in tables) or history or initial):
            raise DatabaseApplicationNotApproved("Statement outside approved E7 scope")
        verify(conn, database, user)

    token = _scope.set((connection, database, user))
    event.listen(connection, "before_cursor_execute", guard)
    try:
        yield
    finally:
        event.remove(connection, "before_cursor_execute", guard)
        _scope.reset(token)
