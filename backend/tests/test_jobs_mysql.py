"""Real MySQL E6 workflows, including review, ownership and transaction isolation."""

from datetime import UTC, datetime, timedelta

import pytest
from jobs_target import mysql_jobs as mysql_jobs
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.mysql
OWN = "/api/v1/companies/me/jobs"
PUBLIC = "/api/v1/jobs"


def auth(db, role="COMPANY_MEMBER", approval="APPROVED", internal="OWNER"):
    identity = db.create_identity(role, approval=approval, internal_role=internal)
    result = db.login(identity)
    assert result.status_code == 200
    return identity, {"Authorization": "Bearer " + result.json()["access_token"]}


def catalog(db):
    values = {}
    for name, field, data in [
        ("nganhnghe", "industry_id", {"tennganhnghe": "E6 Software", "trangthai": "ACTIVE"}),
        ("tinhthanh", "province_id", {"tentinhthanh": "E6 Province"}),
        ("kynang", "skill_id", {"tenkynang": "E6 Python", "trangthai": "ACTIVE"}),
    ]:
        table = db.tables[name]
        name_field = next(k for k in data if k.startswith("ten"))
        existing = db.connection.scalar(
            select(next(iter(table.primary_key))).where(table.c[name_field] == data[name_field])
        )
        values[field] = str(
            existing or db.connection.execute(table.insert().values(**data)).inserted_primary_key[0]
        )
    return values


def draft(db, headers, complete=True):
    data = catalog(db)
    skill = data.pop("skill_id")
    data.update(
        title="E6 Python Engineer", skills=[{"skill_id": skill, "required": True, "priority": 0}]
    )
    if complete:
        data.update(
            description="Build APIs",
            requirements="Python skills",
            minimum_salary="10.00",
            maximum_salary="20.00",
            work_type="FULL_TIME",
        )
    result = db.client.post(OWN, headers=headers, json=data)
    assert result.status_code == 201, result.status_code
    return result.json()


def approve(db, headers, job):
    assert db.client.post(f"{OWN}/{job['id']}/submit", headers=headers).status_code == 200
    _, admin = auth(db, "ADMIN")
    result = db.client.patch(
        f"/api/v1/admin/jobs/{job['id']}/review", headers=admin, json={"status": "APPROVED"}
    )
    assert result.status_code == 200
    return result.json(), admin


def test_company_admin_review_controls_hiring(mysql_jobs):
    db = mysql_jobs
    identity, owner = auth(db, approval="PENDING")
    company = db.row_for("doanhnghiep", identity)["iddoanhnghiep"]
    path = f"/api/v1/admin/companies/{company}/review"
    assert db.client.patch(path, headers=owner, json={"status": "APPROVED"}).status_code == 403
    _, admin = auth(db, "ADMIN")
    assert db.client.get("/api/v1/admin/companies", headers=admin).status_code == 200
    for state in ["APPROVED", "REJECTED", "APPROVED"]:
        assert db.client.patch(path, headers=admin, json={"status": state}).status_code == 200
        me = db.client.get("/api/v1/auth/me", headers=owner).json()
        assert me["company_approval_status"] == state
        data = catalog(db)
        data.pop("skill_id")
        response = db.client.post(OWN, headers=owner, json={"title": "Draft", **data})
        assert response.status_code == (201 if state == "APPROVED" else 403)


@pytest.mark.parametrize(
    "role,approval,status",
    [
        ("CANDIDATE", "APPROVED", 403),
        ("ADMIN", "APPROVED", 403),
        ("COMPANY_MEMBER", "PENDING", 403),
        ("COMPANY_MEMBER", "REJECTED", 403),
    ],
)
def test_create_requires_approved_employer(mysql_jobs, role, approval, status):
    _, headers = auth(mysql_jobs, role, approval)
    data = catalog(mysql_jobs)
    data.pop("skill_id")
    assert (
        mysql_jobs.client.post(OWN, headers=headers, json={"title": "Draft", **data}).status_code
        == status
    )


def test_incomplete_draft_publish_validation_and_no_public_leak(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job = draft(db, owner, False)
    assert job["status"] == "DRAFT" and job["description"] is None
    assert db.client.get(PUBLIC).json()["total"] == 0
    assert db.client.get(f"{PUBLIC}/{job['id']}").status_code == 404
    assert db.client.post(f"{OWN}/{job['id']}/submit", headers=owner).status_code == 422
    result = db.client.patch(
        f"{OWN}/{job['id']}", headers=owner, json={"description": "API", "requirements": "Python"}
    )
    assert result.status_code == 200
    approved, _ = approve(db, owner, job)
    assert approved["application_deadline"] is None
    public = db.client.get(f"{PUBLIC}/{job['id']}").json()
    assert public["status"] == "APPROVED" and "poster_id" not in public
    assert not {"reviewer_id", "rejection_reason", "reviewed_at"} & public.keys()


def test_lifecycle_edit_requires_new_review_and_closed_is_final(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job, admin = approve(db, owner, draft(db, owner))
    key = job["id"]
    assert db.client.post(f"{OWN}/{key}/pause", headers=owner).json()["status"] == "PAUSED"
    assert db.client.get(PUBLIC).json()["total"] == 0
    assert db.client.post(f"{OWN}/{key}/reopen", headers=owner).json()["status"] == "PENDING"
    assert db.client.post(f"{OWN}/{key}/reopen", headers=owner).status_code == 409
    assert (
        db.client.patch(
            f"/api/v1/admin/jobs/{key}/review",
            headers=admin,
            json={"status": "REJECTED", "reason": "More detail"},
        ).status_code
        == 200
    )
    assert db.client.post(f"{OWN}/{key}/submit", headers=owner).status_code == 200
    assert (
        db.client.patch(
            f"/api/v1/admin/jobs/{key}/review", headers=admin, json={"status": "APPROVED"}
        ).status_code
        == 200
    )
    changed = db.client.patch(f"{OWN}/{key}", headers=owner, json={"title": "Changed"}).json()
    assert changed["status"] == "DRAFT" and changed["reviewer_id"] is None
    assert db.client.get(f"{PUBLIC}/{key}").status_code == 404
    assert db.client.post(f"{OWN}/{key}/close", headers=owner).json()["status"] == "CLOSED"
    assert db.client.patch(f"{OWN}/{key}", headers=owner, json={"title": "x"}).status_code == 409
    assert db.client.delete(f"{OWN}/{key}", headers=owner).status_code == 405


def test_cross_company_cannot_read_or_mutate(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job = draft(db, owner)
    _, stranger = auth(db)
    path = f"{OWN}/{job['id']}"
    assert db.client.get(path, headers=stranger).status_code == 404
    assert db.client.patch(path, headers=stranger, json={"title": "Stolen"}).status_code == 404
    assert db.client.post(path + "/submit", headers=stranger).status_code == 404
    assert db.client.get(OWN, headers=stranger).json()["total"] == 0


def test_catalog_fk_ward_salary_and_untrusted_identity(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job = draft(db, owner)
    path = f"{OWN}/{job['id']}"
    province = db.connection.execute(
        db.tables["tinhthanh"].insert().values(tentinhthanh="Other province")
    ).inserted_primary_key[0]
    ward = db.connection.execute(
        db.tables["xaphuong"].insert().values(tenxaphuong="Test-only ward", idtinhthanh=province)
    ).inserted_primary_key[0]
    for values in [
        {"ward_id": str(ward)},
        {"industry_id": "9223372036854775807"},
        {"minimum_salary": "30", "maximum_salary": "10"},
        {"company_id": "1"},
        {"poster_id": "1"},
        {"status": "APPROVED"},
        {"skills": [{"skill_id": "9223372036854775807"}]},
    ]:
        assert db.client.patch(path, headers=owner, json=values).status_code == 422
    assert (
        db.client.patch(
            path, headers=owner, json={"province_id": str(province), "ward_id": str(ward)}
        ).status_code
        == 200
    )


def test_search_filters_pagination_and_sql_input(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job, _ = approve(db, owner, draft(db, owner))
    for params in [
        {"q": "Python"},
        {"province_id": job["province_id"]},
        {"industry_id": job["industry_id"]},
        {"skill_id": job["skills"][0]["skill_id"]},
        {"minimum_salary": "15", "work_type": "FULL_TIME", "sort": "salary_desc"},
    ]:
        assert db.client.get(PUBLIC, params=params).json()["total"] == 1
    assert db.client.get(PUBLIC, params={"q": "' OR 1=1 --"}).json()["total"] == 0
    assert db.client.get(PUBLIC, params={"q": "%"}).json()["total"] == 0
    page = db.client.get(PUBLIC, params={"limit": 1, "offset": 1}).json()
    assert page["items"] == [] and page["total"] == 1
    assert db.client.get(PUBLIC, params={"sort": "id; DROP TABLE"}).status_code == 422


@pytest.mark.parametrize("days,visible", [(-1, False), (0, True), (1, True)])
def test_deadline_public_visibility(mysql_jobs, days, visible):
    db = mysql_jobs
    _, owner = auth(db)
    job, _ = approve(db, owner, draft(db, owner))
    table = db.tables["tintuyendung"]
    db.connection.execute(
        update(table)
        .where(table.c.idtin == int(job["id"]))
        .values(hannophoso=datetime.now(UTC).date() + timedelta(days=days))
    )
    assert db.client.get(f"{PUBLIC}/{job['id']}").status_code == (200 if visible else 404)


def test_expired_submit_and_non_admin_review_denied(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job = draft(db, owner)
    path = f"{OWN}/{job['id']}"
    yesterday = (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    assert (
        db.client.patch(path, headers=owner, json={"application_deadline": yesterday}).status_code
        == 200
    )
    assert db.client.post(path + "/submit", headers=owner).status_code == 422
    assert (
        db.client.patch(
            f"/api/v1/admin/jobs/{job['id']}/review", headers=owner, json={"status": "APPROVED"}
        ).status_code
        == 403
    )


def test_company_rejection_immediately_hides_approved_job(mysql_jobs):
    db = mysql_jobs
    identity, owner = auth(db)
    job, admin = approve(db, owner, draft(db, owner))
    company_id = db.row_for("doanhnghiep", identity)["iddoanhnghiep"]
    assert (
        db.client.patch(
            f"/api/v1/admin/companies/{company_id}/review",
            headers=admin,
            json={"status": "REJECTED"},
        ).status_code
        == 200
    )
    assert db.client.get(f"{PUBLIC}/{job['id']}").status_code == 404
    assert db.client.post(f"{OWN}/{job['id']}/submit", headers=owner).status_code == 403
    assert db.client.get(OWN, headers=owner).json()["total"] == 1


def test_skill_replacement_rollback_and_constraints(mysql_jobs):
    db = mysql_jobs
    _, owner = auth(db)
    job = draft(db, owner)
    link = db.tables["kynangtin"]
    before = db.connection.execute(select(link)).all()
    with pytest.raises(IntegrityError), db.connection.begin_nested():
        db.connection.execute(
            link.insert().values(
                idtin=int(job["id"]),
                idkynang=int(job["skills"][0]["skill_id"]),
                batbuoc=True,
                mucdouutien=0,
            )
        )
    assert db.connection.execute(select(link)).all() == before
    assert (
        db.client.patch(f"{OWN}/{job['id']}", headers=owner, json={"skills": []}).status_code == 200
    )
    assert db.connection.execute(select(link)).all() == []


def test_job_insert_failure_rolls_back_parent_and_skills(mysql_jobs, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    from app.jobs.repository import JobRepository

    db = mysql_jobs
    _, owner = auth(db)
    values = catalog(db)
    skill = values.pop("skill_id")

    def fail(*args):
        raise SQLAlchemyError("Synthetic rollback test")

    monkeypatch.setattr(JobRepository, "set_skills", fail)
    response = db.client.post(
        OWN,
        headers=owner,
        json={
            **values,
            "title": "Must roll back",
            "skills": [{"skill_id": skill, "required": False, "priority": 0}],
        },
    )
    assert response.status_code == 503
    assert db.connection.execute(select(db.tables["tintuyendung"])).all() == []
    assert db.connection.execute(select(db.tables["kynangtin"])).all() == []


@pytest.mark.parametrize("state", ["DISABLED", "INACTIVE"])
def test_token_cannot_bypass_current_account_and_member_status(mysql_jobs, state):
    db = mysql_jobs
    identity, owner = auth(db)
    job = draft(db, owner)
    table = db.tables["taikhoan" if state == "DISABLED" else "thanhviendoanhnghiep"]
    db.connection.execute(
        update(table).where(table.c.idtaikhoan == identity.account_id).values(trangthai=state)
    )
    assert db.client.get(OWN, headers=owner).status_code == 401
    assert db.client.post(f"{OWN}/{job['id']}/submit", headers=owner).status_code == 401


def test_recruiter_can_create_but_cannot_review(mysql_jobs):
    db = mysql_jobs
    _, recruiter = auth(db, internal="RECRUITER")
    job = draft(db, recruiter)
    assert job["status"] == "DRAFT"
    assert db.client.post(f"{OWN}/{job['id']}/submit", headers=recruiter).status_code == 200
    assert (
        db.client.patch(
            f"/api/v1/admin/jobs/{job['id']}/review", headers=recruiter, json={"status": "APPROVED"}
        ).status_code
        == 403
    )


def test_catalog_seed_is_idempotent_uses_database_ids_and_preserves_existing(mysql_jobs):
    from app.jobs.catalog_seed import seed_jobs_catalog

    db = mysql_jobs
    table = db.tables["kynang"]
    key = db.connection.execute(
        table.insert().values(tenkynang="Python", trangthai="INACTIVE")
    ).inserted_primary_key[0]
    first = seed_jobs_catalog(db.connection)
    second = seed_jobs_catalog(db.connection)
    assert first["inserted"] == {"nganhnghe": 2, "tinhthanh": 2, "kynang": 3}
    assert all(count == 0 for count in second["inserted"].values())
    assert first["ids"] == second["ids"] and first["ids"]["kynang"]["Python"] == str(key)
    assert (
        db.connection.scalar(select(table.c.trangthai).where(table.c.idkynang == key)) == "INACTIVE"
    )
    assert db.connection.execute(select(db.tables["xaphuong"])).all() == []
