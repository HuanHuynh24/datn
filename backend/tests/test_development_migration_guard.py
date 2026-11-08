from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.db import migration_permissions as permissions


def settings(database="recruitment_db", user="recruitment_app"):
    return SimpleNamespace(
        mysql_host="mysql", mysql_port=3306, mysql_database=database, mysql_user=user
    )


def test_development_preparation_does_not_authorize_ddl():
    with pytest.raises(permissions.DatabaseApplicationNotApproved, match="confirmation"):
        permissions.require_development_migration_settings(settings())


def test_development_alembic_path_stops_before_connecting():
    import runpy
    from pathlib import Path

    from alembic.config import Config

    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    context = Mock(config=config)
    context.get_x_argument.return_value = {"target": "development"}
    context.is_offline_mode.return_value = False
    with (
        patch("alembic.context", context),
        patch("app.core.config.Settings", return_value=settings()),
        patch("app.db.session.build_engine") as engine,
    ):
        with pytest.raises(permissions.DatabaseApplicationNotApproved, match="confirmation"):
            runpy.run_path(str(root / "alembic/env.py"))
    engine.assert_not_called()
    context.configure.assert_not_called()


def test_final_offline_sql_is_accepted_only_inside_the_future_development_scope():
    import re

    from app.db.export_auth_migration import render_auth_migration_sql

    sql = "\n".join(
        line
        for line in render_auth_migration_sql().splitlines()
        if not line.lstrip().startswith("--")
    )
    writes = [s.strip() for s in sql.split(";") if re.match(r"\s*(CREATE|INSERT)\b", s)]
    assert len(writes) == 8  # Seven tables including history, one exact revision INSERT.
    connection = Mock()
    connection.exec_driver_sql.return_value.one.return_value = (
        "recruitment_db",
        permissions.SERVER_UUID,
        "recruitment_app@%",
    )
    with patch.object(permissions, "DEVELOPMENT_DDL_APPROVED", True):
        for statement in writes:
            permissions.guard_development_statement(connection, None, statement, None, None, False)
    assert connection.exec_driver_sql.call_count == 8


@pytest.mark.parametrize(
    "database,user",
    [
        ("recruitment_auth_test", "auth_test_migrator"),
        ("recruitment_db", "root"),
        ("production", "recruitment_app"),
    ],
)
def test_even_future_development_approval_rejects_other_targets(database, user):
    with patch.object(permissions, "DEVELOPMENT_DDL_APPROVED", True):
        with pytest.raises(permissions.DatabaseApplicationNotApproved):
            permissions.require_development_migration_settings(settings(database, user))


def test_development_scope_checks_live_target_and_empty_inventory():
    connection = Mock()
    connection.exec_driver_sql.return_value.one.return_value = (
        "recruitment_db",
        permissions.SERVER_UUID,
        "recruitment_app@%",
    )
    with (
        patch.object(permissions, "DEVELOPMENT_DDL_APPROVED", True),
        patch.object(permissions, "inspect") as inspector,
        patch.object(permissions.event, "listen"),
        patch.object(permissions.event, "remove"),
    ):
        permissions.require_development_migration_settings(settings())
        inspector.return_value.get_table_names.return_value = []
        with permissions.approved_development_migration(connection):
            permissions.require_database_application_approval()
        inspector.return_value.get_table_names.return_value = ["alembic_version"]
        with pytest.raises(permissions.DatabaseApplicationNotApproved, match="empty"):
            with permissions.approved_development_migration(connection):
                pytest.fail("Must not enter existing schema")
        connection.exec_driver_sql.return_value.one.return_value = (
            "recruitment_db",
            "other-server",
            "recruitment_app@%",
        )
        with pytest.raises(permissions.DatabaseApplicationNotApproved):
            permissions.verify_development_connection(connection)


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE taikhoan",
        "CREATE TABLE recruitment_db.taikhoan (id BIGINT)",
        "CREATE TABLE hosocv (id BIGINT)",
        "INSERT INTO taikhoan VALUES (1)",
        "INSERT INTO alembic_version (version_num) VALUES ('wrong')",
        "USE recruitment_auth_test",
    ],
)
def test_future_development_scope_rejects_unapproved_statements(sql):
    with patch.object(permissions, "DEVELOPMENT_DDL_APPROVED", True):
        with pytest.raises(permissions.DatabaseApplicationNotApproved):
            permissions.guard_development_statement(Mock(), None, sql, None, None, False)
