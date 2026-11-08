import pytest
from cv_target import mysql_cv as mysql_cv
from test_jobs_mysql import auth, catalog, draft

pytestmark = pytest.mark.mysql
BASE = "/api/v1/admin"
RESOURCES = ["accounts", "candidates", "companies", "jobs", "industries", "skills", "packages"]


@pytest.mark.parametrize("resource", RESOURCES)
def test_admin_lists_and_reads_sanitized_details(mysql_cv, resource):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    auth(db, "CANDIDATE")
    _, employer = auth(db)
    draft(db, employer)
    result = db.client.get(f"{BASE}/management/{resource}", headers=admin)
    assert result.status_code == 200
    page = result.json()
    assert page["total"] >= 1 and page["items"]
    item = page["items"][0]
    detail = db.client.get(f"{BASE}/management/{resource}/{item['id']}", headers=admin)
    assert detail.status_code == 200 and detail.json() == item
    for secret in ["matkhaubam", "khoaden", "duongdantep", "duongdanbanluucv", "access_token"]:
        assert secret not in detail.text
    assert detail.headers["cache-control"] == "no-store"
    assert (
        db.client.get(
            f"{BASE}/management/{resource}/9223372036854775807", headers=admin
        ).status_code
        == 404
    )


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER"])
@pytest.mark.parametrize(
    "path",
    [
        "/dashboard",
        "/management/accounts",
        "/management/candidates/1",
        "/management/companies",
        "/management/packages",
        "/management/jobs",
    ],
)
def test_admin_management_denies_other_actors(mysql_cv, role, path):
    _, headers = auth(mysql_cv, role)
    assert mysql_cv.client.get(BASE + path, headers=headers).status_code == 403


def test_dashboard_counts_real_rows_and_no_private_cv_access(mysql_cv):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    auth(db, "CANDIDATE")
    _, employer = auth(db)
    draft(db, employer)
    result = db.client.get(BASE + "/dashboard", headers=admin)
    assert result.status_code == 200
    data = result.json()
    assert data["accounts"] == 3 and data["candidates"] == 1 and data["companies"] == 1
    assert data["jobs_by_status"] == {"DRAFT": 1}
    assert data["applications"] == data["cvs"] == 0
    assert db.client.get("/api/v1/candidates/me/cvs", headers=admin).status_code == 403
    assert db.client.get("/api/v1/applications/1/cv", headers=admin).status_code == 404


def test_filters_pagination_and_literal_search(mysql_cv):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    auth(db, "CANDIDATE")
    catalog(db)
    result = db.client.get(
        BASE + "/management/accounts?role=CANDIDATE&status=ACTIVE", headers=admin
    )
    assert result.json()["total"] == 1 and result.json()["items"][0]["role"] == "CANDIDATE"
    page = db.client.get(BASE + "/management/accounts?limit=1&offset=1", headers=admin).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    for term in ["%", "_", "' OR 1=1 --"]:
        assert (
            db.client.get(
                BASE + "/management/industries", headers=admin, params={"q": term}
            ).json()["total"]
            == 0
        )
    assert (
        db.client.get(BASE + "/management/industries?q=Software", headers=admin).json()["total"]
        == 1
    )


@pytest.mark.parametrize(
    "suffix",
    [
        "accounts?limit=0",
        "accounts?offset=-1",
        "accounts?status=LOCKED",
        "packages?status=ACTIVE",
        "skills?role=ADMIN",
        "secrets",
    ],
)
def test_invalid_admin_filters(mysql_cv, suffix):
    _, admin = auth(mysql_cv, "ADMIN")
    assert mysql_cv.client.get(BASE + "/management/" + suffix, headers=admin).status_code == 422


def test_no_auth_cannot_read_dashboard(mysql_cv):
    assert mysql_cv.client.get(BASE + "/dashboard").status_code == 401


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER"])
def test_disable_invalidates_old_jwt_without_deleting_data(mysql_cv, role):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    identity, headers = auth(db, role)
    path = f"{BASE}/accounts/{identity.account_id}/status"
    assert db.client.patch(path, headers=admin, json={"status": "DISABLED"}).status_code == 200
    assert db.client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert db.login(identity).status_code == 401
    assert db.client.patch(path, headers=admin, json={"status": "ACTIVE"}).status_code == 200
    assert db.client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert db.row_for("taikhoan", identity)["vaitro"] == role


def test_admin_account_protected_and_no_mass_assignment(mysql_cv):
    db = mysql_cv
    identity, admin = auth(db, "ADMIN")
    path = f"{BASE}/accounts/{identity.account_id}/status"
    assert db.client.patch(path, headers=admin, json={"status": "DISABLED"}).status_code == 403
    for payload in [
        {"status": "ACTIVE", "role": "ADMIN"},
        {"status": "ACTIVE", "password": "new"},
        {"status": "LOCKED"},
    ]:
        assert db.client.patch(path, headers=admin, json=payload).status_code == 422


@pytest.mark.parametrize("resource", ["industries", "skills"])
def test_catalog_create_rename_duplicate_and_deactivate(mysql_cv, resource):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    path = BASE + "/catalog/" + resource
    result = db.client.post(
        path, headers=admin, json={"name": "  E8 Catalog  ", "status": "ACTIVE"}
    )
    assert result.status_code == 201 and result.json()["name"] == "E8 Catalog"
    key = result.json()["id"]
    assert (
        db.client.post(
            path, headers=admin, json={"name": "e8 catalog", "status": "ACTIVE"}
        ).status_code
        == 409
    )
    renamed = db.client.patch(
        path + "/" + key, headers=admin, json={"name": "E8 Renamed", "status": "INACTIVE"}
    )
    assert renamed.status_code == 200 and renamed.json()["status"] == "INACTIVE"
    assert key not in [row["id"] for row in db.client.get("/api/v1/job-catalog").json()[resource]]
    assert (
        db.client.get(BASE + "/management/" + resource + "/" + key, headers=admin).status_code
        == 200
    )
    assert db.client.delete(path + "/" + key, headers=admin).status_code == 405


def test_inactive_catalog_preserves_existing_jobs_but_rejects_new_selection(mysql_cv):
    db = mysql_cv
    _, admin = auth(db, "ADMIN")
    _, employer = auth(db)
    job = draft(db, employer)
    for resource, key in [
        ("industries", job["industry_id"]),
        ("skills", job["skills"][0]["skill_id"]),
    ]:
        result = db.client.patch(
            f"{BASE}/catalog/{resource}/{key}", headers=admin, json={"status": "INACTIVE"}
        )
        assert result.status_code == 200
    response = db.client.patch(
        f"/api/v1/companies/me/jobs/{job['id']}",
        headers=employer,
        json={"title": "Updated with historical references"},
    )
    assert response.status_code == 200
    assert response.json()["industry_id"] == job["industry_id"]
    assert response.json()["skills"] == job["skills"]
    assert (
        db.client.post(
            f"/api/v1/companies/me/jobs/{job['id']}/submit", headers=employer
        ).status_code
        == 200
    )
    assert (
        db.client.patch(
            f"{BASE}/jobs/{job['id']}/review", headers=admin, json={"status": "APPROVED"}
        ).status_code
        == 200
    )
    assert db.client.get(f"/api/v1/jobs/{job['id']}").status_code == 200
    assert (
        db.client.post(
            "/api/v1/companies/me/jobs",
            headers=employer,
            json={
                "title": "New",
                "industry_id": job["industry_id"],
                "province_id": job["province_id"],
            },
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"name": " ", "status": "ACTIVE"},
        {"name": "X", "status": "OTHER"},
        {"name": "X", "status": "ACTIVE", "id": "1"},
        {"name": "x" * 121, "status": "ACTIVE"},
    ],
)
def test_catalog_validation(mysql_cv, payload):
    _, admin = auth(mysql_cv, "ADMIN")
    assert (
        mysql_cv.client.post(BASE + "/catalog/skills", headers=admin, json=payload).status_code
        == 422
    )


@pytest.mark.parametrize("role", ["CANDIDATE", "COMPANY_MEMBER"])
def test_admin_writes_reject_other_roles(mysql_cv, role):
    identity, actor = auth(mysql_cv, role)
    assert (
        mysql_cv.client.post(
            BASE + "/catalog/skills", headers=actor, json={"name": "X", "status": "ACTIVE"}
        ).status_code
        == 403
    )
    assert (
        mysql_cv.client.patch(
            f"{BASE}/accounts/{identity.account_id}/status",
            headers=actor,
            json={"status": "DISABLED"},
        ).status_code
        == 403
    )
