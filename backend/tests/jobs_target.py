"""Dedicated E6 target. No schema changes, and every fixture transaction rolls back."""

import os
import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session
from test_auth_mysql_integration import AuthDatabaseFixture

from app.core.config import Settings
from app.db.jobs_migration_permissions import ALL_TABLES, SERVER_UUID
from app.db.session import build_engine, get_db
from app.main import create_app
from app.models import Base


@pytest.fixture
def mysql_jobs():
    if os.getenv("RUN_JOBS_MYSQL_TESTS") != "1":
        pytest.skip("Explicit E6 MySQL test opt-in required")
    assert os.environ["JOBS_TEST_DATABASE"] == "recruitment_jobs_test"
    assert os.environ["JOBS_TEST_USER"] == "jobs_test_runner"
    assert os.environ["JOBS_TEST_HOST"] == "mysql"
    settings = Settings(
        jwt_secret=secrets.token_urlsafe(48),
        mysql_host="mysql",
        mysql_database="recruitment_jobs_test",
        mysql_user="jobs_test_runner",
        mysql_password=os.environ["JOBS_TEST_PASSWORD"],
    )
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            db, server, user = connection.exec_driver_sql(
                "SELECT DATABASE(),@@server_uuid,CURRENT_USER()"
            ).one()
            assert (db, server, user.split("@")[0]) == (
                "recruitment_jobs_test",
                SERVER_UUID,
                "jobs_test_runner",
            )
            assert set(inspect(connection).get_table_names()) == ALL_TABLES
            assert connection.exec_driver_sql(
                "SELECT version_num FROM alembic_version"
            ).scalars().all() == ["20261103_02"]
            tables = {name: Base.metadata.tables[name] for name in ALL_TABLES - {"alembic_version"}}
            before = {
                n: connection.scalar(select(func.count()).select_from(t)) for n, t in tables.items()
            }
            assert all(count == 0 for count in before.values())
            connection.rollback()
            outer = connection.begin()
            app = create_app(settings)

            def scoped():
                with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                    yield session

            app.dependency_overrides[get_db] = scoped
            try:
                with TestClient(app) as client:
                    yield AuthDatabaseFixture(connection, tables, client, settings)
            finally:
                outer.rollback()
                after = {
                    n: connection.scalar(select(func.count()).select_from(t))
                    for n, t in tables.items()
                }
                assert after == before, "Fixture data survived rollback"
    finally:
        engine.dispose()
