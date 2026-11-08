"""Pinned test permissions and the completed, closed one-time Development migration scope."""

import hashlib
import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from sqlalchemy import event, inspect

TEST_DATABASE = "recruitment_auth_test"
TEST_USER = "auth_test_migrator"
SERVER_UUID = "e71fb0d9-d68a-11f1-b475-0242ac120002"
REVISION = "20261102_01"
REVISION_SHA256 = "3cef6cc58683733a9819648743bac2b703775d927e0faf5deea1da65991ee9ab"
TABLES = frozenset(
    {
        "taikhoan",
        "hosoungvien",
        "doanhnghiep",
        "thanhviendoanhnghiep",
        "goidoanhnghiep",
        "tinhthanh",
        "alembic_version",
    }
)
_connection = ContextVar("p1_test_migration_connection", default=None)
_development_connection = ContextVar("development_migration_connection", default=None)
DEVELOPMENT_DATABASE = "recruitment_db"
DEVELOPMENT_USER = "recruitment_app"
# Approved initial Development revision has been applied; close the one-time DDL gate again.
DEVELOPMENT_DDL_APPROVED = False


class DatabaseApplicationNotApproved(RuntimeError):
    pass


def require_database_application_approval():
    from app.db.cv_migration_permissions import active_e7_scope, require_e7_scope

    if active_e7_scope() is not None:
        require_e7_scope()
        return
    from app.db.jobs_migration_permissions import active_e6_scope, require_e6_scope

    if active_e6_scope() is not None:
        require_e6_scope()
        return
    # Independent contexts are entered only by the corresponding verified target scope.
    development = _development_connection.get()
    if development is not None:
        require_development_ddl_approval()
        verify_development_connection(development)
        return
    connection = _connection.get()
    if connection is None:
        raise DatabaseApplicationNotApproved(
            "Only a verified P1 test migration scope is authorized"
        )
    verify_test_connection(connection)


def require_test_migration_settings(settings):
    if (settings.mysql_host, settings.mysql_port, settings.mysql_database, settings.mysql_user) != (
        "mysql",
        3306,
        TEST_DATABASE,
        TEST_USER,
    ):
        raise DatabaseApplicationNotApproved(
            "P1 requires explicit local test database/migrator settings"
        )
    require_revision_fingerprint()


def require_revision_fingerprint():
    path = Path(__file__).resolve().parents[2] / "alembic/versions/20261102_01_auth_foundation.py"
    if hashlib.sha256(path.read_bytes()).hexdigest() != REVISION_SHA256:
        raise DatabaseApplicationNotApproved("Approved revision fingerprint changed")


def require_development_ddl_approval():
    if not DEVELOPMENT_DDL_APPROVED:
        raise DatabaseApplicationNotApproved("Development DDL awaits explicit user confirmation")


def require_development_migration_settings(settings):
    require_development_ddl_approval()
    if (settings.mysql_host, settings.mysql_port, settings.mysql_database, settings.mysql_user) != (
        "mysql",
        3306,
        DEVELOPMENT_DATABASE,
        DEVELOPMENT_USER,
    ):
        raise DatabaseApplicationNotApproved("Development database/executor settings mismatch")
    require_revision_fingerprint()


def verify_development_connection(connection):
    database, server_uuid, account = connection.exec_driver_sql(
        "SELECT DATABASE(), @@server_uuid, CURRENT_USER()"
    ).one()
    if (database, server_uuid, account.split("@", 1)[0]) != (
        DEVELOPMENT_DATABASE,
        SERVER_UUID,
        DEVELOPMENT_USER,
    ):
        raise DatabaseApplicationNotApproved("Live Development target/executor mismatch")


def guard_development_statement(connection, cursor, statement, parameters, context, executemany):
    require_development_ddl_approval()
    sql = statement.strip()
    if re.match(r"^(SELECT|SHOW|DESCRIBE)\b", sql, re.I):
        return
    create = re.match(r"^CREATE\s+TABLE\s+`?(\w+)`?\s*\(", sql, re.I)
    history = re.fullmatch(
        r"INSERT\s+INTO\s+`?alembic_version`?\s*\(version_num\)\s*"
        r"VALUES\s*\('20261102_01'\)\s*;?",
        sql,
        re.I,
    )
    if not ((create and create.group(1) in TABLES) or history):
        raise DatabaseApplicationNotApproved("Statement outside initial Development Auth scope")
    verify_development_connection(connection)


@contextmanager
def approved_development_migration(connection):
    require_development_ddl_approval()
    verify_development_connection(connection)
    if inspect(connection).get_table_names():
        raise DatabaseApplicationNotApproved(
            "Initial Development migration requires empty database"
        )
    connection.rollback()
    token = _development_connection.set(connection)
    event.listen(connection, "before_cursor_execute", guard_development_statement)
    try:
        yield
    finally:
        event.remove(connection, "before_cursor_execute", guard_development_statement)
        _development_connection.reset(token)


def verify_test_connection(connection):
    database, server_uuid, account = connection.exec_driver_sql(
        "SELECT DATABASE(), @@server_uuid, CURRENT_USER()"
    ).one()
    if (
        database != TEST_DATABASE
        or server_uuid != SERVER_UUID
        or account.split("@", 1)[0] != TEST_USER
    ):
        raise DatabaseApplicationNotApproved("Live migration target/executor mismatch")


def guard_p1_statement(connection, cursor, statement, parameters, context, executemany):
    sql = statement.strip()
    if re.match(r"^(SELECT|SHOW|DESCRIBE)\b", sql, re.I):
        return
    create = re.match(r"^CREATE\s+TABLE\s+`?(\w+)`?\s*\(", sql, re.I)
    history = re.match(r"^INSERT\s+INTO\s+`?alembic_version`?\s*\(", sql, re.I)
    if not ((create and create.group(1) in TABLES) or history):
        raise DatabaseApplicationNotApproved("Statement outside P1 CREATE/history scope")
    verify_test_connection(connection)


@contextmanager
def approved_test_migration(connection):
    verify_test_connection(connection)
    if inspect(connection).get_table_names():
        raise DatabaseApplicationNotApproved("Initial P1 migration requires an empty test database")
    # Finish read-only preflight autobegin before Alembic owns the transaction.
    connection.rollback()
    token = _connection.set(connection)
    event.listen(connection, "before_cursor_execute", guard_p1_statement)
    try:
        yield
    finally:
        event.remove(connection, "before_cursor_execute", guard_p1_statement)
        _connection.reset(token)


def require_auth_fixture_dml_approval(settings=None, connection=None):
    # User explicitly approved P2. This never authorizes dev or a migration.
    if settings is None or (
        settings.mysql_host,
        settings.mysql_port,
        settings.mysql_database,
        settings.mysql_user,
    ) != ("mysql", 3306, TEST_DATABASE, "auth_test_runner"):
        raise DatabaseApplicationNotApproved("P2 requires the explicit Auth test runner target")
    if connection is not None:
        database, uuid, account = connection.exec_driver_sql(
            "SELECT DATABASE(), @@server_uuid, CURRENT_USER()"
        ).one()
        if (database, uuid, account.split("@", 1)[0]) != (
            TEST_DATABASE,
            SERVER_UUID,
            "auth_test_runner",
        ):
            raise DatabaseApplicationNotApproved("Live P2 database/server/executor mismatch")
