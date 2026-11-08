"""E6-specific incremental migration scope; never loosens the Auth test scope."""

import hashlib
import json
import os
import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from sqlalchemy import event, inspect

from app.db.migration_permissions import SERVER_UUID, TABLES, DatabaseApplicationNotApproved

REVISION = "20261103_02"
JOBS_TABLES = {"nganhnghe", "xaphuong", "kynang", "tintuyendung", "kynangtin"}
ALL_TABLES = set(TABLES) | JOBS_TABLES
_scope = ContextVar("e6_migration_scope", default=None)


def active_e6_scope():
    return _scope.get()


def verify(connection, database, user):
    d, uuid, account = connection.exec_driver_sql(
        "SELECT DATABASE(), @@server_uuid, CURRENT_USER()"
    ).one()
    if (d, uuid, account.split("@", 1)[0]) != (database, SERVER_UUID, user):
        raise DatabaseApplicationNotApproved("E6 live database/server/executor mismatch")


def require_e6_scope():
    from app.db.cv_migration_permissions import active_e7_scope, require_e7_scope

    if active_e7_scope() is not None:
        require_e7_scope()
        return
    value = _scope.get()
    if value is None:
        raise DatabaseApplicationNotApproved("Verified E6 scope required")
    verify(*value)


def require_e6_settings(settings, target):
    if target not in {"jobs-test", "jobs-development"}:
        raise DatabaseApplicationNotApproved("Unknown E6 migration target")
    if target == "jobs-development" and os.getenv("JOBS_DEVELOPMENT_DDL_APPROVED") != REVISION:
        raise DatabaseApplicationNotApproved("Separate E6 Development DDL approval required")
    expected = (
        ("recruitment_jobs_test", "jobs_test_migrator")
        if target == "jobs-test"
        else ("recruitment_db", "recruitment_app")
    )
    if (settings.mysql_host, settings.mysql_port, settings.mysql_database, settings.mysql_user) != (
        "mysql",
        3306,
        *expected,
    ):
        raise DatabaseApplicationNotApproved("E6 settings mismatch")
    root = Path(__file__).resolve().parents[2]
    manifest = json.loads((root / "app/db/jobs_migration_manifest.json").read_text())
    for name, sha in manifest.items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != sha:
            raise DatabaseApplicationNotApproved("E6 revision/snapshot fingerprint changed")


@contextmanager
def e6_migration(connection, target):
    database, user = (
        ("recruitment_jobs_test", "jobs_test_migrator")
        if target == "jobs-test"
        else ("recruitment_db", "recruitment_app")
    )
    verify(connection, database, user)
    names = set(inspect(connection).get_table_names())
    if target == "jobs-test":
        if names:
            raise DatabaseApplicationNotApproved("Initial E6 test migration requires empty DB")
    else:
        if names != set(TABLES) or connection.exec_driver_sql(
            "SELECT version_num FROM alembic_version"
        ).scalars().all() != ["20261102_01"]:
            raise DatabaseApplicationNotApproved("E6 Development baseline mismatch")
    connection.rollback()

    def guard(conn, cursor, statement, parameters, context, executemany):
        sql = statement.strip()
        if re.match(r"^(SELECT|SHOW|DESCRIBE)\b", sql, re.I):
            return
        create = re.match(r"CREATE\s+TABLE\s+`?(\w+)`?\s*\(", sql, re.I)
        allowed = ALL_TABLES if target == "jobs-test" else JOBS_TABLES
        history_insert = re.fullmatch(
            r"INSERT INTO alembic_version \(version_num\) VALUES \('20261102_01'\)", sql
        )
        history_update = re.fullmatch(
            r"UPDATE alembic_version SET version_num='20261103_02' "
            r"WHERE alembic_version.version_num = '20261102_01'",
            sql,
        )
        if not (
            (create and create[1] in allowed)
            or (target == "jobs-test" and history_insert)
            or history_update
        ):
            raise DatabaseApplicationNotApproved("SQL outside E6 CREATE/history scope")
        verify(conn, database, user)

    token = _scope.set((connection, database, user))
    event.listen(connection, "before_cursor_execute", guard)
    try:
        yield
    finally:
        event.remove(connection, "before_cursor_execute", guard)
        _scope.reset(token)
