import os

import pytest
from sqlalchemy import update
from test_auth_mysql_integration import mysql_auth as mysql_auth

pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(
        os.getenv("RUN_COMPANY_MYSQL_TESTS") != "1",
        reason="Company MySQL opt-in required",
    ),
]


def member(database, **options):
    identity = database.create_identity("COMPANY_MEMBER", **options)
    token = database.login(identity).json()["access_token"]
    return identity, {"Authorization": "Bearer " + token}


def test_mysql_public_catalog_is_actual_data_not_invented_defaults(mysql_auth):
    assert mysql_auth.client.get("/api/v1/company-packages").json() == []
    identity, _ = member(mysql_auth)
    package = mysql_auth.row_for("goidoanhnghiep", identity)
    response = mysql_auth.client.get("/api/v1/company-packages")
    assert response.status_code == 200
    assert response.json() == [
        {
            "package_id": str(package["idgoi"]),
            "code": package["magoi"],
            "name": package["tengoi"],
            "member_limit": 2,
            "monthly_price": "1.00",
            "description": package["mota"],
        }
    ]


def test_mysql_catalog_keeps_unknown_quota_null(mysql_auth):
    identity, _ = member(mysql_auth)
    package = mysql_auth.row_for("goidoanhnghiep", identity)
    table = mysql_auth.tables["goidoanhnghiep"]
    mysql_auth.connection.execute(
        update(table).where(table.c.idgoi == package["idgoi"]).values(sotaikhoantoida=None)
    )
    assert mysql_auth.client.get("/api/v1/company-packages").json()[0]["member_limit"] is None


@pytest.mark.parametrize("approval", ["PENDING", "APPROVED", "REJECTED"])
@pytest.mark.parametrize("role", ["OWNER", "RECRUITER"])
def test_mysql_company_read_for_active_member_all_approved_statuses(mysql_auth, approval, role):
    identity, headers = member(mysql_auth, approval=approval, internal_role=role)
    company = mysql_auth.row_for("doanhnghiep", identity)
    response = mysql_auth.client.get("/api/v1/companies/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["company_id"] == str(company["iddoanhnghiep"])
    assert response.json()["approval_status"] == approval
    assert response.json()["created_at"].endswith("Z")
    assert response.headers["cache-control"] == "no-store"
    assert "password" not in response.text and "hash" not in response.text


@pytest.mark.parametrize("role", [None, "CANDIDATE", "ADMIN"])
def test_mysql_company_read_rejects_guest_and_other_system_roles(mysql_auth, role):
    headers = {}
    if role:
        identity = mysql_auth.create_identity(role)
        headers = {"Authorization": "Bearer " + mysql_auth.login(identity).json()["access_token"]}
    response = mysql_auth.client.get("/api/v1/companies/me", headers=headers)
    assert response.status_code == (401 if role is None else 403)


def test_mysql_company_scope_cannot_be_selected_by_client(mysql_auth):
    identity, headers = member(mysql_auth)
    other, _ = member(mysql_auth)
    own = mysql_auth.row_for("doanhnghiep", identity)
    foreign = mysql_auth.row_for("doanhnghiep", other)
    response = mysql_auth.client.get(
        "/api/v1/companies/me",
        headers=headers,
        params={
            "company_id": str(foreign["iddoanhnghiep"]),
            "account_id": str(other.account_id),
        },
    )
    assert response.status_code == 200
    assert response.json()["company_id"] == str(own["iddoanhnghiep"])
    assert response.json()["tax_code"] == own["masothue"]
    assert response.json()["tax_code"] != foreign["masothue"]


@pytest.mark.parametrize("status", ["account", "member"])
def test_mysql_company_rereads_account_and_member_eligibility(mysql_auth, status):
    identity, headers = member(mysql_auth)
    table = mysql_auth.tables["taikhoan" if status == "account" else "thanhviendoanhnghiep"]
    mysql_auth.connection.execute(
        update(table)
        .where(table.c.idtaikhoan == identity.account_id)
        .values(trangthai="DISABLED" if status == "account" else "INACTIVE")
    )
    assert mysql_auth.client.get("/api/v1/companies/me", headers=headers).status_code == 401
