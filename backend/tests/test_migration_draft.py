import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.db.export_auth_migration import render_auth_migration_sql
from app.db.migration_permissions import (
    SERVER_UUID,
    DatabaseApplicationNotApproved,
    guard_p1_statement,
    require_auth_fixture_dml_approval,
    verify_test_connection,
)
from app.db.migration_review import foundation_tables
from app.models.base import UnresolvedSchemaError

ROOT = Path(__file__).resolve().parents[1]


def load_draft():
    path = ROOT / "alembic/versions/20261102_01_auth_foundation.py"
    spec = importlib.util.spec_from_file_location("auth_revision_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_draft_history_and_dependency_order():
    scripts = ScriptDirectory.from_config(Config(str(ROOT / "alembic.ini")))
    assert scripts.get_heads() == ["20261105_03"]
    assert scripts.get_revision("20261102_01").down_revision is None
    draft_tables = load_draft().review_tables()
    assert len(draft_tables) == 6 and sum(len(t.c) for t in draft_tables) == 54
    tables = foundation_tables()
    positions = {t.name: i for i, t in enumerate(tables)}
    assert len(tables) == 6
    for table in tables:
        for fk in table.foreign_keys:
            assert positions[fk.column.table.name] < positions[table.name]
    for draft, model in zip(draft_tables, tables, strict=True):
        assert draft.name == model.name
        assert list(draft.c.keys()) == list(model.c.keys())
        assert dict(draft.dialect_kwargs) == dict(model.dialect_kwargs)
        assert sorted(
            (type(c).__name__, c.name, tuple(c.columns.keys())) for c in draft.constraints
        ) == sorted((type(c).__name__, c.name, tuple(c.columns.keys())) for c in model.constraints)
        assert {
            (f.constraint.name, f.parent.name, f.target_fullname, f.ondelete, f.onupdate)
            for f in draft.foreign_keys
        } == {
            (f.constraint.name, f.parent.name, f.target_fullname, f.ondelete, f.onupdate)
            for f in model.foreign_keys
        }
        for frozen, current in zip(draft.c, model.c, strict=True):
            assert str(frozen.type) == str(current.type)
            assert frozen.nullable is current.nullable
            assert frozen.primary_key == current.primary_key
            assert frozen.autoincrement == current.autoincrement
            # SQLAlchemy represents an omitted UNIQUE flag as None.
            assert bool(frozen.unique) == bool(current.unique)
            assert frozen.info == current.info
            assert getattr(frozen.type, "collation", None) == getattr(
                current.type, "collation", None
            )
            assert (
                str(frozen.server_default.arg) if frozen.server_default is not None else None
            ) == (str(current.server_default.arg) if current.server_default is not None else None)
            assert {f.target_fullname for f in frozen.foreign_keys} == {
                f.target_fullname for f in current.foreign_keys
            }


def test_revision_online_application_guard_precedes_all_operations():
    draft = load_draft()
    operations = Mock()
    draft.op = operations
    operations.get_context.return_value.as_sql = False
    with pytest.raises(DatabaseApplicationNotApproved):
        draft.upgrade()
    operations.invoke.assert_not_called()
    with pytest.raises(RuntimeError, match="No automatic DROP"):
        draft.downgrade()
    operations.drop_table.assert_not_called()


def test_revision_schema_guard_still_rejects_incomplete_snapshot():
    draft = load_draft()
    draft.review_tables()[0].c.magoi.nullable = None
    draft.op = Mock()
    with pytest.raises(UnresolvedSchemaError):
        draft.upgrade()
    draft.op.invoke.assert_not_called()


@pytest.mark.parametrize("read_only_attribute", [False, True])
def test_alembic_environment_blocks_before_connection_or_version_table(read_only_attribute):
    # Execute only env.py under a fake Alembic context, without a database.
    # This is not an upgrade command. Even the old application/read_only flags
    # cannot bypass the separate E3c gate or reach engine/context configuration.
    import runpy

    config = Config(str(ROOT / "alembic.ini"))
    config.attributes["read_only"] = read_only_attribute
    context = Mock(config=config)
    context.get_x_argument.return_value = {"apply_reviewed": "true"}
    context.is_offline_mode.return_value = False
    with (
        patch("alembic.context", context),
        patch("app.core.config.Settings") as settings,
        patch("app.db.session.build_engine") as engine,
    ):
        settings.return_value.mysql_database = "recruitment_db"
        with pytest.raises(DatabaseApplicationNotApproved):
            runpy.run_path(str(ROOT / "alembic/env.py"))
    engine.assert_not_called()
    context.configure.assert_not_called()
    context.run_migrations.assert_not_called()


def test_auth_mysql_fixture_cannot_connect_to_development():
    import test_auth_mysql_integration as integration

    with (
        patch.object(integration, "auth_test_settings") as settings,
        # Simulate a later migration-only approval; fixture writes stay blocked.
        patch("app.db.migration_permissions.require_database_application_approval"),
        patch.object(integration, "build_engine") as engine,
    ):
        settings.return_value = SimpleNamespace(
            mysql_host="mysql",
            mysql_port=3306,
            mysql_database="recruitment_db",
            mysql_user="auth_test_runner",
        )
        with pytest.raises(DatabaseApplicationNotApproved):
            next(integration.mysql_auth.__wrapped__())
    engine.assert_not_called()


def test_offline_revision_sql_has_exact_scope_defaults_and_no_database_access():
    import re

    with patch("app.db.session.build_engine", side_effect=AssertionError("No database allowed")):
        sql = render_auth_migration_sql()
    assert sql == render_auth_migration_sql()
    assert len(re.findall(r"CREATE TABLE", sql)) == 7
    assert sql.count("FOREIGN KEY") == 5
    assert sql.count("ON DELETE RESTRICT ON UPDATE RESTRICT") == 5
    assert sql.count("AUTO_INCREMENT") == 5
    assert sql.count("DEFAULT 0") == 4
    assert sql.count("UNIQUE (") == 4
    assert sql.count("COLLATE utf8mb4_unicode_ci") == 6
    assert "email VARCHAR(255) COLLATE utf8mb4_0900_as_ci NOT NULL" in sql
    assert "UNRESOLVED" not in sql
    assert "INSERT INTO alembic_version (version_num) VALUES ('20261102_01');" in sql
    assert not re.search(r"(?:INSERT INTO|UPDATE|DELETE FROM) (?!alembic_version)[a-z]", sql)


@pytest.mark.parametrize(
    "database,uuid,account",
    [
        ("recruitment_db", SERVER_UUID, "auth_test_migrator@host"),
        ("recruitment_auth_test", "other-server", "auth_test_migrator@host"),
        ("recruitment_auth_test", SERVER_UUID, "root@host"),
    ],
)
def test_p1_rejects_wrong_live_target_or_executor(database, uuid, account):
    connection = Mock()
    connection.exec_driver_sql.return_value.one.return_value = (database, uuid, account)
    with pytest.raises(DatabaseApplicationNotApproved):
        verify_test_connection(connection)


@pytest.mark.parametrize(
    "statement",
    [
        "CREATE TABLE recruitment_db.taikhoan (id BIGINT)",
        "CREATE TABLE unexpected_table (id BIGINT)",
        "INSERT INTO taikhoan (idtaikhoan) VALUES (1)",
        "UPDATE alembic_version SET version_num='other'",
        "DROP TABLE taikhoan",
        "USE recruitment_db",
    ],
)
def test_p1_rejects_out_of_scope_statements(statement):
    with pytest.raises(DatabaseApplicationNotApproved):
        guard_p1_statement(Mock(), None, statement, None, None, False)


def test_p2_approval_is_scoped_to_runner_and_live_test_server():
    settings = SimpleNamespace(
        mysql_host="mysql",
        mysql_port=3306,
        mysql_database="recruitment_auth_test",
        mysql_user="auth_test_runner",
    )
    require_auth_fixture_dml_approval(settings)
    connection = Mock()
    connection.exec_driver_sql.return_value.one.return_value = (
        "recruitment_auth_test",
        SERVER_UUID,
        "auth_test_runner@host",
    )
    require_auth_fixture_dml_approval(settings, connection)
    connection.exec_driver_sql.return_value.one.return_value = (
        "recruitment_db",
        SERVER_UUID,
        "auth_test_runner@host",
    )
    with pytest.raises(DatabaseApplicationNotApproved):
        require_auth_fixture_dml_approval(settings, connection)
