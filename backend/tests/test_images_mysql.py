from urllib.parse import urlsplit

import pytest
from jobs_target import mysql_jobs as mysql_jobs
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from test_image_storage import picture
from test_jobs_mysql import approve, draft

pytestmark = pytest.mark.mysql


def setup(db, tmp_path, role="CANDIDATE", **options):
    db.settings.image_storage_dir = tmp_path
    identity = db.create_identity(role, **options)
    result = db.login(identity)
    assert result.status_code == 200
    return identity, {"Authorization": "Bearer " + result.json()["access_token"]}


def test_avatar_private_persisted_replaced_and_role_guard(mysql_jobs, tmp_path):
    db = mysql_jobs
    person, headers = setup(db, tmp_path)
    path = "/api/v1/candidates/me/avatar"
    assert (
        db.client.post(path, files={"file": ("x.png", picture(), "image/png")}).status_code == 401
    )
    result = db.client.post(
        path, headers=headers, files={"file": ("x.png", picture(), "image/png")}
    )
    assert result.status_code == 200
    url = result.json()["url"]
    assert (
        db.client.get("/api/v1/candidates/me/profile", headers=headers).json()["avatar_url"] == url
    )
    assert db.client.get(urlsplit(url).path).status_code == 401
    data = db.client.get(path, headers=headers)
    assert data.status_code == 200 and data.headers["content-type"] == "image/png"
    assert data.headers["x-content-type-options"] == "nosniff"
    _, other = setup(db, tmp_path)
    assert db.client.get(path, headers=other).status_code == 404
    replacement = db.client.post(
        path, headers=headers, files={"file": ("x.jpg", picture("JPEG"), "image/jpeg")}
    )
    assert replacement.status_code == 200 and replacement.json()["url"] != url
    assert (
        db.client.post(
            path, headers=headers, files={"file": ("x.png", b"invalid", "image/png")}
        ).status_code
        == 415
    )
    assert (
        db.client.get("/api/v1/candidates/me/profile", headers=headers).json()["avatar_url"]
        == replacement.json()["url"]
    )
    _, employer = setup(db, tmp_path, "COMPANY_MEMBER")
    assert (
        db.client.post(
            path, headers=employer, files={"file": ("x.png", picture(), "image/png")}
        ).status_code
        == 403
    )
    account = db.tables["taikhoan"]
    db.connection.execute(
        update(account)
        .where(account.c.idtaikhoan == person.account_id)
        .values(trangthai="DISABLED")
    )
    assert db.client.get(path, headers=headers).status_code == 401


@pytest.mark.parametrize("approval", ["PENDING", "APPROVED", "REJECTED"])
def test_logo_owner_scope_and_public_approval(mysql_jobs, tmp_path, approval):
    db = mysql_jobs
    identity, headers = setup(
        db, tmp_path, "COMPANY_MEMBER", approval=approval, internal_role="OWNER"
    )
    path = "/api/v1/companies/me/logo"
    result = db.client.post(
        path, headers=headers, files={"file": ("logo.webp", picture("WEBP"), "image/webp")}
    )
    assert result.status_code == 200
    url = urlsplit(result.json()["url"]).path
    assert db.client.get(path, headers=headers).status_code == 200
    assert db.client.get(url).status_code == (200 if approval == "APPROVED" else 404)
    if approval == "APPROVED":
        approve(db, headers, draft(db, headers))
        jobs = db.client.get("/api/v1/jobs").json()
        assert jobs["items"][0]["company_logo_url"] == result.json()["url"]
    _, other = setup(db, tmp_path, "COMPANY_MEMBER", internal_role="OWNER")
    assert db.client.get(path, headers=other).status_code == 404
    member = db.tables["thanhviendoanhnghiep"]
    db.connection.execute(
        update(member)
        .where(member.c.idtaikhoan == identity.account_id)
        .values(chucvunoibo="RECRUITER")
    )
    assert (
        db.client.post(
            path, headers=headers, files={"file": ("x.png", picture(), "image/png")}
        ).status_code
        == 403
    )


def test_old_public_logo_unserved_after_replace_or_company_rejected(mysql_jobs, tmp_path):
    db = mysql_jobs
    identity, headers = setup(db, tmp_path, "COMPANY_MEMBER", internal_role="OWNER")
    path = "/api/v1/companies/me/logo"
    old = db.client.post(
        path, headers=headers, files={"file": ("x.png", picture(), "image/png")}
    ).json()["url"]
    new = db.client.post(
        path, headers=headers, files={"file": ("x.png", picture(), "image/png")}
    ).json()["url"]
    assert db.client.get(urlsplit(old).path).status_code == 404
    assert db.client.get(urlsplit(new).path).status_code == 200
    member, company = db.tables["thanhviendoanhnghiep"], db.tables["doanhnghiep"]
    company_id = db.connection.scalar(
        select(member.c.iddoanhnghiep).where(member.c.idtaikhoan == identity.account_id)
    )
    db.connection.execute(
        update(company)
        .where(company.c.iddoanhnghiep == company_id)
        .values(trangthaiduyet="REJECTED")
    )
    assert db.client.get(urlsplit(new).path).status_code == 404


def test_failed_commit_keeps_database_pointer_unchanged(mysql_jobs, tmp_path, monkeypatch):
    db = mysql_jobs
    _, headers = setup(db, tmp_path)

    def fail_commit(self):
        raise SQLAlchemyError("private driver details")

    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", fail_commit)
        response = db.client.post(
            "/api/v1/candidates/me/avatar",
            headers=headers,
            files={"file": ("x.png", picture(), "image/png")},
        )
        assert response.status_code == 503 and "private" not in response.text
    assert (
        db.client.get("/api/v1/candidates/me/profile", headers=headers).json()["avatar_url"]
        == "/test/avatar.png"
    )
    assert db.client.get("/api/v1/candidates/me/avatar", headers=headers).status_code == 404
