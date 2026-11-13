from datetime import UTC, datetime, timedelta

import pytest
from jobs_target import mysql_jobs as mysql_jobs
from sqlalchemy import update
from test_jobs_mysql import approve, auth, draft

pytestmark = pytest.mark.mysql
PATH = "/api/v1/companies"


def test_public_filter_choices_empty_without_approved_company(mysql_jobs):
    response = mysql_jobs.client.get(PATH + "/filters")
    assert response.status_code == 200
    assert response.json() == {"industries": [], "locations": []}


def test_public_filter_choices_distinct_nonblank_and_only_approved(mysql_jobs):
    db = mysql_jobs
    table = db.tables["doanhnghiep"]
    for approval, industry, address in [
        ("APPROVED", " Software ", " Hà Nội "),
        ("APPROVED", "Software", "Hà Nội"),
        ("APPROVED", " ", None),
        ("APPROVED", "Education", "Đà Nẵng"),
        ("PENDING", "Private Pending", "Private Address"),
        ("REJECTED", "Private Rejected", "Rejected Address"),
    ]:
        identity, _ = auth(db, approval=approval)
        db.connection.execute(
            update(table)
            .where(table.c.iddoanhnghiep == company_id(db, identity))
            .values(linhvuc=industry, diachi=address)
        )
    assert len(db.client.get(PATH, params={"limit": 1}).json()["items"]) == 1
    response = db.client.get(PATH + "/filters")
    assert response.status_code == 200
    assert response.json() == {
        "industries": ["Education", "Software"],
        "locations": ["Đà Nẵng", "Hà Nội"],
    }
    assert response.headers["cache-control"] == "no-store"
    for industry in response.json()["industries"]:
        assert db.client.get(PATH, params={"industry": industry}).json()["total"] > 0


def company_id(db, identity):
    return db.row_for("doanhnghiep", identity)["iddoanhnghiep"]


def test_public_directory_only_approved_and_safe_fields(mysql_jobs):
    db = mysql_jobs
    approved, _ = auth(db)
    for state in ["PENDING", "REJECTED"]:
        hidden, _ = auth(db, approval=state)
        key = company_id(db, hidden)
        assert db.client.get(f"{PATH}/{key}").status_code == 404
        assert db.client.get(f"{PATH}/{key}/jobs").status_code == 404
    response = db.client.get(PATH)
    assert response.status_code == 200
    assert response.json()["total"] == 1
    item = response.json()["items"][0]
    assert item["company_id"] == str(company_id(db, approved))
    assert item["open_job_count"] == 0
    assert not {"tax_code", "package", "profile_url", "active_member_count", "email"} & item.keys()
    assert db.client.get(f"{PATH}/{item['company_id']}").json() == item
    assert response.headers["cache-control"] == "no-store"


def test_public_directory_filters_literal_search_and_pagination(mysql_jobs):
    db = mysql_jobs
    first, _ = auth(db)
    second, _ = auth(db)
    table = db.tables["doanhnghiep"]
    for identity, name, location in [
        (first, "Literal%_Company", "Hà Nội"),
        (second, "Other Company", "Đà Nẵng"),
    ]:
        db.connection.execute(
            update(table)
            .where(table.c.iddoanhnghiep == company_id(db, identity))
            .values(tencongty=name, linhvuc="Software", diachi=location)
        )
    for params in [
        {"q": "%_"},
        {"location": "Hà Nội", "industry": "Software"},
        {"q": "Literal", "location": "Hà Nội"},
    ]:
        result = db.client.get(PATH, params=params).json()
        assert result["total"] == 1
        assert result["items"][0]["company_id"] == str(company_id(db, first))
    assert db.client.get(PATH, params={"q": "' OR 1=1 --"}).json()["total"] == 0
    assert db.client.get(PATH, params={"q": "Literal", "location": "Đà Nẵng"}).json()["total"] == 0
    pages = [
        db.client.get(PATH, params={"limit": 1, "offset": offset}).json() for offset in range(3)
    ]
    assert all(page["total"] == 2 for page in pages)
    assert pages[0]["items"][0]["company_id"] != pages[1]["items"][0]["company_id"]
    assert pages[2]["items"] == []


@pytest.mark.parametrize("state", ["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "CLOSED"])
def test_company_jobs_and_count_obey_job_visibility(mysql_jobs, state):
    db = mysql_jobs
    identity, employer = auth(db)
    job, _ = approve(db, employer, draft(db, employer))
    _, other = auth(db)
    approve(db, other, draft(db, other))
    table = db.tables["tintuyendung"]
    db.connection.execute(
        update(table).where(table.c.idtin == int(job["id"])).values(trangthai=state)
    )
    key = company_id(db, identity)
    profile = db.client.get(f"{PATH}/{key}").json()
    result = db.client.get(f"{PATH}/{key}/jobs").json()
    assert result["total"] == profile["open_job_count"] == (1 if state == "APPROVED" else 0)
    assert all(row["company_id"] == str(key) for row in result["items"])
    assert all("poster_id" not in row and "rejection_reason" not in row for row in result["items"])


@pytest.mark.parametrize("expiry", ["deadline", "closed"])
def test_company_jobs_hide_expired_and_revoked_company(mysql_jobs, expiry):
    db = mysql_jobs
    identity, employer = auth(db)
    job, _ = approve(db, employer, draft(db, employer))
    now = datetime.now(UTC).replace(tzinfo=None)
    values = (
        {"hannophoso": now.date() - timedelta(days=1)}
        if expiry == "deadline"
        else {"thoigiandong": now - timedelta(seconds=1)}
    )
    table = db.tables["tintuyendung"]
    db.connection.execute(update(table).where(table.c.idtin == int(job["id"])).values(**values))
    key = company_id(db, identity)
    assert db.client.get(f"{PATH}/{key}").json()["open_job_count"] == 0
    assert db.client.get(f"{PATH}/{key}/jobs").json()["total"] == 0
    table = db.tables["doanhnghiep"]
    db.connection.execute(
        update(table).where(table.c.iddoanhnghiep == key).values(trangthaiduyet="REJECTED")
    )
    assert db.client.get(f"{PATH}/{key}").status_code == 404
    assert db.client.get(f"{PATH}/{key}/jobs").status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        PATH + "?limit=0",
        PATH + "?offset=-1",
        PATH + "?q=" + "x" * 201,
        PATH + "/0",
        PATH + "/invalid",
        PATH + "/1/jobs?limit=101",
    ],
)
def test_public_company_input_validation(mysql_jobs, path):
    assert mysql_jobs.client.get(path).status_code == 422
