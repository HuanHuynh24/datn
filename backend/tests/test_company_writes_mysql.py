import os
import secrets
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import Depends
from sqlalchemy import func, select, update
from test_auth_mysql_integration import mysql_auth as mysql_auth

from app.auth.dependencies import require_approved_company
from app.companies.repository import CompanyRepository
from app.core.passwords import verify_password

pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(
        os.getenv("RUN_COMPANY_MYSQL_TESTS") != "1",
        reason="Company MySQL opt-in required",
    ),
]
REGISTER = "/api/v1/auth/register/employer"
COMPANY = "/api/v1/companies/me"
MEMBERS = COMPANY + "/members"


def package(database, limit=5):
    table = database.tables["goidoanhnghiep"]
    key = database.connection.execute(
        table.insert().values(
            magoi="E5_" + secrets.token_hex(8),
            tengoi="E5 test",
            sotaikhoantoida=limit,
            giathang=Decimal("0.00"),
            mota="Rollback-only E5 fixture",
        )
    ).inserted_primary_key[0]
    database.track("goidoanhnghiep", key)
    return str(key)


def credentials():
    return {
        "email": "e5-" + secrets.token_hex(8) + "@example.com",
        "full_name": "E5 User",
        "password": secrets.token_urlsafe(24),
    }


def register_data(package_id):
    return credentials() | {
        "company_name": "E5 Company",
        "tax_code": secrets.token_hex(10),
        "package_id": package_id,
    }


def headers(database, data):
    response = database.client.post(
        "/api/v1/auth/login", json={"email": data["email"], "password": data["password"]}
    )
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def owner(database, limit=5):
    data = register_data(package(database, limit))
    response = database.client.post(REGISTER, json=data)
    assert response.status_code == 201
    ids = response.json()
    database.track("taikhoan", int(ids["account_id"]))
    database.track("thanhviendoanhnghiep", int(ids["account_id"]))
    database.track("doanhnghiep", int(ids["company_id"]))
    return data, ids, headers(database, data)


def recruiter(database, auth):
    data = credentials()
    response = database.client.post(MEMBERS, headers=auth, json=data)
    assert response.status_code == 201
    key = int(response.json()["account_id"])
    database.track("taikhoan", key)
    database.track("thanhviendoanhnghiep", key)
    return data, response.json()


def counts(database):
    return {
        name: database.connection.scalar(select(func.count()).select_from(table))
        for name, table in database.tables.items()
    }


def test_mysql_employer_register_creates_exact_specialization_and_dates(mysql_auth):
    data, ids, auth = owner(mysql_auth)
    company = mysql_auth.client.get(COMPANY, headers=auth).json()
    assert ids["role"] == "COMPANY_MEMBER" and ids["internal_role"] == "OWNER"
    assert company["approval_status"] == "PENDING" and company["active_member_count"] == 1
    assert company["package_started_on"] == datetime.now(UTC).date().isoformat()
    assert company["package_expires_on"] is None
    account = mysql_auth.tables["taikhoan"]
    row = (
        mysql_auth.connection.execute(
            select(account).where(account.c.idtaikhoan == int(ids["account_id"]))
        )
        .mappings()
        .one()
    )
    assert verify_password(data["password"], row["matkhaubam"])[0]
    assert row["matkhaubam"].startswith("$argon2id$") and row["trangthai"] == "ACTIVE"
    assert counts(mysql_auth)["hosoungvien"] == 0
    me = mysql_auth.client.get("/api/v1/auth/me", headers=auth).json()
    assert me["company_id"] == ids["company_id"] and me["internal_role"] == "OWNER"


@pytest.mark.parametrize("limit", [None, 0, -1])
def test_mysql_register_rejects_unconfigured_quota_without_partial_account(mysql_auth, limit):
    data = register_data(package(mysql_auth, limit))
    before = counts(mysql_auth)
    assert mysql_auth.client.post(REGISTER, json=data).status_code == 409
    assert counts(mysql_auth) == before


@pytest.mark.parametrize("field", ["email", "tax_code"])
def test_mysql_employer_duplicate_registration_rolls_back(mysql_auth, field):
    original, _, _ = owner(mysql_auth)
    data = register_data(original["package_id"])
    data[field] = original[field].upper()
    before = counts(mysql_auth)
    response = mysql_auth.client.post(REGISTER, json=data)
    assert response.status_code == 409 and "Duplicate entry" not in response.text
    assert counts(mysql_auth) == before


@pytest.mark.parametrize(
    "fields",
    [
        {"role": "ADMIN"},
        {"internal_role": "OWNER"},
        {"status": "ACTIVE"},
        {"company_id": "1"},
        {"approval_status": "APPROVED"},
        {"tax_code": " "},
        {"package_id": "9223372036854775807"},
    ],
)
def test_mysql_register_rejects_privilege_input_and_invalid_package(mysql_auth, fields):
    data = register_data(package(mysql_auth))
    before = counts(mysql_auth)
    assert mysql_auth.client.post(REGISTER, json=data | fields).status_code == 422
    assert counts(mysql_auth) == before


def test_mysql_employer_last_step_failure_rolls_back_all_three_records(mysql_auth, monkeypatch):
    data = register_data(package(mysql_auth))
    before = counts(mysql_auth)
    original = CompanyRepository.create_member

    def fail(repository, account_id, company_id, role, now):
        return original(repository, account_id, 9223372036854775807, role, now)

    monkeypatch.setattr(CompanyRepository, "create_member", fail)
    assert mysql_auth.client.post(REGISTER, json=data).status_code == 503
    assert counts(mysql_auth) == before


@pytest.mark.parametrize("approval", ["PENDING", "REJECTED", "APPROVED"])
def test_mysql_owner_updates_company_without_changing_approval(mysql_auth, approval):
    _, ids, auth = owner(mysql_auth)
    table = mysql_auth.tables["doanhnghiep"]
    mysql_auth.connection.execute(
        update(table)
        .where(table.c.iddoanhnghiep == int(ids["company_id"]))
        .values(trangthaiduyet=approval)
    )
    changed = mysql_auth.client.patch(
        COMPANY,
        headers=auth,
        json={
            "company_name": "Updated Company",
            "industry": "Software",
            "address": None,
            "website": "https://example.com",
            "introduction": "Company introduction",
        },
    )
    assert changed.status_code == 200 and changed.json()["company_name"] == "Updated Company"
    assert changed.json()["approval_status"] == approval
    assert mysql_auth.client.get(COMPANY, headers=auth).json() == changed.json()


@pytest.mark.parametrize(
    "fields",
    [
        {"tax_code": "new-tax"},
        {"package_id": "1"},
        {"approval_status": "APPROVED"},
        {"company_id": "1"},
        {"email": "wrong@example.com"},
        {"benefits": "new field"},
        {"company_name": None},
        {"website": "javascript:alert(1)"},
    ],
)
def test_mysql_company_patch_whitelist_preserves_immutable_data(mysql_auth, fields):
    _, _, auth = owner(mysql_auth)
    before = mysql_auth.client.get(COMPANY, headers=auth).json()
    assert mysql_auth.client.patch(COMPANY, headers=auth, json=fields).status_code == 422
    assert mysql_auth.client.get(COMPANY, headers=auth).json() == before


def test_mysql_owner_member_lifecycle_counts_owner_and_revokes_inactive_access(mysql_auth):
    _, _, auth = owner(mysql_auth, 2)
    staff, member = recruiter(mysql_auth, auth)
    staff_auth = headers(mysql_auth, staff)
    assert member["internal_role"] == "RECRUITER" and member["status"] == "ACTIVE"
    assert mysql_auth.client.get(COMPANY, headers=auth).json()["active_member_count"] == 2
    before = counts(mysql_auth)
    assert mysql_auth.client.post(MEMBERS, headers=auth, json=credentials()).status_code == 409
    assert counts(mysql_auth) == before
    path = MEMBERS + "/" + member["account_id"]
    assert (
        mysql_auth.client.patch(path, headers=auth, json={"status": "INACTIVE"}).status_code == 200
    )
    assert mysql_auth.client.get("/api/v1/auth/me", headers=staff_auth).status_code == 401
    assert (
        mysql_auth.client.post(
            "/api/v1/auth/login", json={"email": staff["email"], "password": staff["password"]}
        ).status_code
        == 401
    )
    _, replacement = recruiter(mysql_auth, auth)
    assert mysql_auth.client.patch(path, headers=auth, json={"status": "ACTIVE"}).status_code == 409
    assert (
        mysql_auth.client.patch(
            MEMBERS + "/" + replacement["account_id"], headers=auth, json={"status": "INACTIVE"}
        ).status_code
        == 200
    )
    assert mysql_auth.client.patch(path, headers=auth, json={"status": "ACTIVE"}).status_code == 200
    assert headers(mysql_auth, staff)
    listing = mysql_auth.client.get(MEMBERS, headers=auth)
    assert listing.status_code == 200 and len(listing.json()) == 3
    assert "hash" not in listing.text and staff["password"] not in listing.text


def test_mysql_free_package_owner_uses_its_only_seat(mysql_auth):
    _, _, auth = owner(mysql_auth, 1)
    assert mysql_auth.client.post(MEMBERS, headers=auth, json=credentials()).status_code == 409
    assert mysql_auth.client.get(COMPANY, headers=auth).json()["active_member_count"] == 1


@pytest.mark.parametrize("existing_role", ["CANDIDATE", "COMPANY_MEMBER"])
def test_mysql_owner_cannot_reuse_or_transfer_existing_account(mysql_auth, existing_role):
    existing = mysql_auth.create_identity(existing_role)
    _, _, auth = owner(mysql_auth)
    before = counts(mysql_auth)
    response = mysql_auth.client.post(
        MEMBERS, headers=auth, json=credentials() | {"email": existing.email.upper()}
    )
    assert response.status_code == 409 and counts(mysql_auth) == before
    assert mysql_auth.row_for("taikhoan", existing)["vaitro"] == existing_role
    assert mysql_auth.login(existing).status_code == 200


@pytest.mark.parametrize("limit", [None, 0])
def test_mysql_unknown_quota_blocks_grants_but_allows_deactivation(mysql_auth, limit):
    _, ids, auth = owner(mysql_auth)
    _, staff = recruiter(mysql_auth, auth)
    company = mysql_auth.client.get(COMPANY, headers=auth).json()
    table = mysql_auth.tables["goidoanhnghiep"]
    mysql_auth.connection.execute(
        update(table)
        .where(table.c.idgoi == int(company["package"]["package_id"]))
        .values(sotaikhoantoida=limit)
    )
    assert mysql_auth.client.post(MEMBERS, headers=auth, json=credentials()).status_code == 409
    path = MEMBERS + "/" + staff["account_id"]
    assert (
        mysql_auth.client.patch(path, headers=auth, json={"status": "INACTIVE"}).status_code == 200
    )
    assert mysql_auth.client.patch(path, headers=auth, json={"status": "ACTIVE"}).status_code == 409
    assert (
        mysql_auth.client.patch(
            COMPANY, headers=auth, json={"company_name": "Still editable"}
        ).status_code
        == 200
    )


def test_mysql_recruiter_is_read_only_and_cannot_manage_members(mysql_auth):
    _, ids, auth = owner(mysql_auth)
    staff, _ = recruiter(mysql_auth, auth)
    staff_auth = headers(mysql_auth, staff)
    assert mysql_auth.client.get(COMPANY, headers=staff_auth).status_code == 200
    assert (
        mysql_auth.client.patch(
            COMPANY, headers=staff_auth, json={"company_name": "Escalated"}
        ).status_code
        == 403
    )
    assert mysql_auth.client.get(MEMBERS, headers=staff_auth).status_code == 403
    assert (
        mysql_auth.client.post(MEMBERS, headers=staff_auth, json=credentials()).status_code == 403
    )
    assert (
        mysql_auth.client.patch(
            MEMBERS + "/" + ids["account_id"], headers=staff_auth, json={"status": "INACTIVE"}
        ).status_code
        == 403
    )


def test_mysql_cross_company_member_changes_and_owner_changes_are_forbidden(mysql_auth):
    _, own, auth = owner(mysql_auth)
    _, _, foreign_auth = owner(mysql_auth)
    _, foreign = recruiter(mysql_auth, foreign_auth)
    assert (
        mysql_auth.client.patch(
            MEMBERS + "/" + foreign["account_id"], headers=auth, json={"status": "INACTIVE"}
        ).status_code
        == 404
    )
    assert (
        mysql_auth.client.patch(
            MEMBERS + "/" + own["account_id"], headers=auth, json={"status": "INACTIVE"}
        ).status_code
        == 403
    )
    assert (
        mysql_auth.client.post(
            MEMBERS, headers=auth, json=credentials() | {"internal_role": "OWNER"}
        ).status_code
        == 422
    )
    assert (
        mysql_auth.client.delete(MEMBERS + "/" + own["account_id"], headers=auth).status_code == 405
    )
    assert mysql_auth.client.get(MEMBERS, headers=foreign_auth).json()[-1]["status"] == "ACTIVE"


def test_mysql_member_create_failure_rolls_back_new_account(mysql_auth, monkeypatch):
    _, _, auth = owner(mysql_auth)
    before = counts(mysql_auth)
    original = CompanyRepository.create_member

    def fail(repository, account_id, company_id, role, now):
        return original(repository, account_id, 9223372036854775807, role, now)

    monkeypatch.setattr(CompanyRepository, "create_member", fail)
    assert mysql_auth.client.post(MEMBERS, headers=auth, json=credentials()).status_code == 503
    assert counts(mysql_auth) == before


def test_mysql_pending_rejected_companies_cannot_use_approved_recruitment_guard(mysql_auth):
    _, ids, auth = owner(mysql_auth)

    @mysql_auth.client.app.get(
        "/__test__/company-approved", dependencies=[Depends(require_approved_company)]
    )
    def guarded():
        return {"allowed": True}

    table = mysql_auth.tables["doanhnghiep"]
    for status, expected in [("PENDING", 403), ("REJECTED", 403), ("APPROVED", 200)]:
        mysql_auth.connection.execute(
            update(table)
            .where(table.c.iddoanhnghiep == int(ids["company_id"]))
            .values(trangthaiduyet=status)
        )
        assert (
            mysql_auth.client.get("/__test__/company-approved", headers=auth).status_code
            == expected
        )
