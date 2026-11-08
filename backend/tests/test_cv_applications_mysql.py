"""E7 real MySQL workflows; every fixture is isolated and rolled back."""

import io
from pathlib import Path

import pytest
from cv_target import mysql_cv as mysql_cv
from sqlalchemy import select, update
from sqlalchemy.exc import OperationalError
from test_jobs_mysql import approve, auth, draft

from app.applications.schemas import TRANSITIONS

pytestmark = pytest.mark.mysql
CV = "/api/v1/candidates/me/cvs"
PDF = b"%PDF-1.7\n1 0 obj <</Type /Catalog>> endobj\n%%EOF"


def upload(db, headers, content=PDF, name="cv.pdf"):
    return db.client.post(
        CV, headers=headers, files={"file": (name, io.BytesIO(content), "application/pdf")}
    )


def setup_application(db):
    _, candidate = auth(db, "CANDIDATE")
    _, employer = auth(db)
    job, admin = approve(db, employer, draft(db, employer))
    cv = upload(db, candidate)
    assert cv.status_code == 201
    response = db.client.post(
        f"/api/v1/jobs/{job['id']}/applications",
        headers=candidate,
        json={"cv_id": cv.json()["id"], "cover_letter": "Application"},
    )
    assert response.status_code == 201, response.status_code
    return candidate, employer, admin, job, cv.json(), response.json()


def test_cv_private_primary_and_archive(mysql_cv):
    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    first, second = upload(db, candidate).json(), upload(db, candidate).json()
    for cv in [first, second]:
        assert not cv["is_primary"] and "duongdantep" not in cv
        assert (
            db.client.patch(
                f"{CV}/{cv['id']}", headers=candidate, json={"is_primary": True}
            ).status_code
            == 200
        )
    rows = db.client.get(CV, headers=candidate).json()
    assert sum(r["is_primary"] for r in rows) == 1
    assert db.client.get(f"{CV}/{first['id']}/download", headers=candidate).content == PDF
    archived = db.client.delete(f"{CV}/{second['id']}", headers=candidate)
    assert archived.json()["status"] == "ARCHIVED" and not archived.json()["is_primary"]
    assert len(db.client.get(CV, headers=candidate).json()) == 1
    assert db.client.get(f"{CV}/{second['id']}/download", headers=candidate).status_code == 404


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER", "ADMIN"])
def test_other_actor_cannot_access_owned_cv(mysql_cv, role):
    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    cv = upload(db, candidate).json()
    _, other = auth(db, role)
    for method, suffix, args in [
        ("get", "/download", {}),
        ("delete", "", {}),
        ("patch", "", {"json": {"is_primary": True}}),
    ]:
        assert getattr(db.client, method)(
            f"{CV}/{cv['id']}{suffix}", headers=other, **args
        ).status_code in {403, 404}


@pytest.mark.parametrize(
    "content,name",
    [
        (b"", "cv.pdf"),
        (b"not-pdf", "cv.pdf"),
        (PDF, "cv.exe"),
        (PDF, "../cv.pdf"),
        (b"x" * (10 * 1024 * 1024 + 1), "cv.pdf"),
    ],
)
def test_invalid_upload_is_atomic(mysql_cv, content, name):
    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    assert upload(db, candidate, content, name).status_code == 422
    assert db.client.get(CV, headers=candidate).json() == []
    assert not list(Path(db.settings.cv_storage_dir).glob("*"))


def test_apply_snapshot_survives_archive_and_prevents_duplicate(mysql_cv):
    db = mysql_cv
    candidate, employer, admin, job, cv, application = setup_application(db)
    path = f"/api/v1/applications/{application['id']}/cv"
    assert db.client.delete(f"{CV}/{cv['id']}", headers=candidate).status_code == 200
    for actor in [candidate, employer]:
        result = db.client.get(path, headers=actor)
        assert result.status_code == 200 and result.content == PDF
        assert result.headers["cache-control"] == "no-store"
    assert db.client.get(path, headers=admin).status_code == 404
    original = db.connection.scalar(select(db.tables["hosocv"].c.duongdantep))
    snapshot = db.connection.scalar(select(db.tables["donungtuyen"].c.duongdanbanluucv))
    assert original != snapshot
    assert original not in str(application) and snapshot not in str(application)
    again = db.client.post(
        f"/api/v1/jobs/{job['id']}/applications", headers=candidate, json={"cv_id": cv["id"]}
    )
    assert again.status_code == 409


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER"])
def test_application_idor(mysql_cv, role):
    db = mysql_cv
    *_, application = setup_application(db)
    _, other = auth(db, role)
    path = f"/api/v1/applications/{application['id']}"
    assert db.client.get(path, headers=other).status_code == 404
    assert db.client.get(path + "/cv", headers=other).status_code == 404
    assert db.client.patch(
        f"/api/v1/companies/me/applications/{application['id']}",
        headers=other,
        json={"status": "REVIEWING"},
    ).status_code in {403, 404}


def test_hiring_state_machine_and_terminal_state(mysql_cv):
    db = mysql_cv
    candidate, employer, _, _, _, application = setup_application(db)
    path = f"/api/v1/companies/me/applications/{application['id']}"
    assert db.client.patch(path, headers=candidate, json={"status": "REVIEWING"}).status_code == 403
    assert db.client.patch(path, headers=employer, json={"status": "HIRED"}).status_code == 409
    for status in ["REVIEWING", "INTERVIEW", "OFFER", "HIRED"]:
        result = db.client.patch(path, headers=employer, json={"status": status})
        assert result.status_code == 200 and result.json()["status"] == status
    assert db.client.patch(path, headers=employer, json={"status": "REJECTED"}).status_code == 409
    listing = db.client.get("/api/v1/candidates/me/applications?status=HIRED", headers=candidate)
    assert listing.json()["total"] == 1


@pytest.mark.parametrize("state", ["PENDING", "REJECTED"])
def test_unapproved_company_can_read_but_not_update(mysql_cv, state):
    db = mysql_cv
    _, employer, _, _, _, application = setup_application(db)
    db.connection.execute(update(db.tables["doanhnghiep"]).values(trangthaiduyet=state))
    assert db.client.get("/api/v1/companies/me/applications", headers=employer).json()["total"] == 1
    assert (
        db.client.patch(
            f"/api/v1/companies/me/applications/{application['id']}",
            headers=employer,
            json={"status": "REVIEWING"},
        ).status_code
        == 403
    )


def test_archived_or_foreign_cv_cannot_apply(mysql_cv):
    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    _, other = auth(db, "CANDIDATE")
    _, employer = auth(db)
    job, _ = approve(db, employer, draft(db, employer))
    cv = upload(db, candidate).json()
    path = f"/api/v1/jobs/{job['id']}/applications"
    assert db.client.post(path, headers=other, json={"cv_id": cv["id"]}).status_code == 404
    assert db.client.delete(f"{CV}/{cv['id']}", headers=candidate).status_code == 200
    assert db.client.post(path, headers=candidate, json={"cv_id": cv["id"]}).status_code == 404


def test_file_and_database_rollback_on_failed_insert(mysql_cv, monkeypatch):
    from sqlalchemy.orm import Session

    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    original = Session.execute

    def fail(self, statement, *args, **kwargs):
        if getattr(statement, "is_insert", False) and statement.table.name == "hosocv":
            raise OperationalError("redacted", {}, Exception("synthetic failure"))
        return original(self, statement, *args, **kwargs)

    monkeypatch.setattr(Session, "execute", fail)
    response = upload(db, candidate)
    assert response.status_code == 503
    assert "synthetic" not in response.text
    assert db.client.get(CV, headers=candidate).json() == []
    assert not list(Path(db.settings.cv_storage_dir).glob("*"))


def test_unauthenticated_cv_denied(mysql_cv):
    assert mysql_cv.client.get(CV).status_code == 401
    assert mysql_cv.client.get("/api/v1/applications/1/cv").status_code == 401


def test_terminal_states_have_no_transitions():
    assert TRANSITIONS["HIRED"] == TRANSITIONS["REJECTED"] == set()


def test_snapshot_is_removed_when_application_insert_fails(mysql_cv, monkeypatch):
    from sqlalchemy.orm import Session

    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    _, employer = auth(db)
    job, _ = approve(db, employer, draft(db, employer))
    cv = upload(db, candidate).json()
    before = set(Path(db.settings.cv_storage_dir).iterdir())
    original = Session.execute

    def fail(self, statement, *args, **kwargs):
        if getattr(statement, "is_insert", False) and statement.table.name == "donungtuyen":
            raise OperationalError("redacted", {}, Exception("synthetic failure"))
        return original(self, statement, *args, **kwargs)

    monkeypatch.setattr(Session, "execute", fail)
    response = db.client.post(
        f"/api/v1/jobs/{job['id']}/applications", headers=candidate, json={"cv_id": cv["id"]}
    )
    assert response.status_code == 503
    assert set(Path(db.settings.cv_storage_dir).iterdir()) == before
    assert (
        db.client.get("/api/v1/candidates/me/applications", headers=candidate).json()["total"] == 0
    )


@pytest.mark.parametrize("column", ["idungvien", "idtin", "idcv"])
def test_application_fk_rejects_missing_reference(mysql_cv, column):
    from sqlalchemy.exc import IntegrityError

    db = mysql_cv
    setup_application(db)
    table = db.tables["donungtuyen"]
    with pytest.raises(IntegrityError), db.connection.begin_nested():
        db.connection.execute(update(table).values(**{column: 9223372036854775807}))


def test_application_unique_enforced_by_mysql(mysql_cv):
    from sqlalchemy.exc import IntegrityError

    db = mysql_cv
    setup_application(db)
    table = db.tables["donungtuyen"]
    values = dict(db.connection.execute(select(table)).mappings().one())
    values.pop("iddon")
    with pytest.raises(IntegrityError), db.connection.begin_nested():
        db.connection.execute(table.insert().values(**values))


def test_closed_job_rejects_application(mysql_cv):
    db = mysql_cv
    _, candidate = auth(db, "CANDIDATE")
    _, employer = auth(db)
    job, _ = approve(db, employer, draft(db, employer))
    cv = upload(db, candidate).json()
    assert (
        db.client.post(f"/api/v1/companies/me/jobs/{job['id']}/close", headers=employer).status_code
        == 200
    )
    assert (
        db.client.post(
            f"/api/v1/jobs/{job['id']}/applications", headers=candidate, json={"cv_id": cv["id"]}
        ).status_code
        == 409
    )
