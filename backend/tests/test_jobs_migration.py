import importlib.util
from pathlib import Path

import pytest
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateTable

from app.core.config import Settings
from app.db.jobs_migration_permissions import JOBS_TABLES, require_e6_settings
from app.db.migration_permissions import DatabaseApplicationNotApproved
from app.models import Base


def revision():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261103_02_jobs.py"
    spec = importlib.util.spec_from_file_location("jobs_snapshot_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_jobs_snapshot_matches_models_and_only_five_tables():
    frozen = revision()
    assert frozen.revision == "20261103_02" and frozen.down_revision == "20261102_01"
    tables = frozen.review_tables()
    assert {t.name for t in tables} == JOBS_TABLES
    assert sum(len(t.c) for t in tables) == 38
    assert sum(len(t.foreign_keys) for t in tables) == 9
    assert sum(bool(c.autoincrement is True) for t in tables for c in t.c) == 4
    position = {t.name: i for i, t in enumerate(tables)}
    for table in tables:
        current = Base.metadata.tables[table.name]
        assert str(CreateTable(table).compile(dialect=mysql.dialect())) == str(
            CreateTable(current).compile(dialect=mysql.dialect())
        )
        assert all(c.server_default is None for c in table.c)
        for fk in table.foreign_keys:
            assert fk.ondelete == fk.onupdate == "RESTRICT"
            if fk.column.table.name in JOBS_TABLES:
                assert position[fk.column.table.name] < position[table.name]


def test_development_requires_separate_explicit_gate(monkeypatch):
    settings = Settings(mysql_password="unit-only-random-password")
    monkeypatch.delenv("JOBS_DEVELOPMENT_DDL_APPROVED", raising=False)
    with pytest.raises(DatabaseApplicationNotApproved, match="Separate"):
        require_e6_settings(settings, "jobs-development")
    with pytest.raises(DatabaseApplicationNotApproved, match="Unknown"):
        require_e6_settings(settings, "anything")
    monkeypatch.setenv("JOBS_DEVELOPMENT_DDL_APPROVED", "20261103_02")
    require_e6_settings(settings, "jobs-development")
    with pytest.raises(DatabaseApplicationNotApproved, match="settings mismatch"):
        require_e6_settings(
            settings.model_copy(update={"mysql_database": "other_db"}), "jobs-development"
        )


def test_revision_refuses_automatic_downgrade():
    with pytest.raises(RuntimeError, match="No automatic DROP"):
        revision().downgrade()
