import json
import os

import pytest
from jobs_target import mysql_jobs as mysql_jobs
from sqlalchemy import func, select
from test_development_seed import sample_manifest

from app.core.passwords import verify_password
from app.development_seed import build_plan, seed

pytestmark = pytest.mark.mysql


def setup(db):
    db.create_identity("ADMIN")
    package = db.tables["goidoanhnghiep"]
    db.connection.execute(
        package.insert().values(magoi="FREE", tengoi="Free", sotaikhoantoida=1, giathang=0)
    )
    path = os.getenv("DEVELOPMENT_SEED_TEST_MANIFEST")
    manifest = json.loads(open(path, encoding="utf-8").read()) if path else sample_manifest()
    plan = build_plan(manifest)
    credentials = {
        item["key"]: "Synthetic-test-only-password-123"
        for item in [*plan["companies"], *plan["candidates"]]
    }
    return plan, credentials


def test_import_real_mysql_idempotent_and_public(mysql_jobs):
    db = mysql_jobs
    plan, credentials = setup(db)
    result = seed(db.connection, plan, credentials)
    assert result["inserted"]["doanhnghiep"] == len(plan["companies"])
    assert result["inserted"]["tintuyendung"] == len(plan["jobs"])
    assert result["inserted"]["hosoungvien"] == len(plan["candidates"])
    assert seed(db.connection, plan, credentials)["inserted"] == {}
    item = plan["candidates"][0]
    account = db.tables["taikhoan"]
    row = (
        db.connection.execute(
            select(account).where(account.c.email == f"dev-{item['key']}@example.com")
        )
        .mappings()
        .one()
    )
    assert row["matkhaubam"].startswith("$argon2id$")
    assert verify_password(credentials[item["key"]], row["matkhaubam"])[0]
    response = db.client.get("/api/v1/jobs?limit=100")
    assert response.status_code == 200 and response.json()["total"] == len(plan["jobs"])
    companies = db.client.get("/api/v1/companies?limit=100")
    assert companies.status_code == 200 and companies.json()["total"] == len(plan["companies"])
    assert "tax_code" not in companies.json()["items"][0]
    assert "donungtuyen" not in result["inserted"] and "hosocv" not in result["inserted"]


def test_import_failure_rolls_back_all_insertions(mysql_jobs):
    db = mysql_jobs
    plan, credentials = setup(db)
    before = {
        name: db.connection.scalar(select(func.count()).select_from(table))
        for name, table in db.tables.items()
    }
    del credentials[plan["candidates"][0]["key"]]
    with pytest.raises(KeyError), db.connection.begin_nested():
        seed(db.connection, plan, credentials)
    after = {
        name: db.connection.scalar(select(func.count()).select_from(table))
        for name, table in db.tables.items()
    }
    assert after == before
