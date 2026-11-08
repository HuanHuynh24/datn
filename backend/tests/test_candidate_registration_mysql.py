"""Prepared E4 registration tests; explicit opt-in, never a Development fixture database."""

import os
import secrets

import pytest
from sqlalchemy import func, select
from test_auth_mysql_integration import mysql_auth as mysql_auth

from app.auth.registration import CandidateRegistrationRepository
from app.core.passwords import verify_password

pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(
        os.getenv("RUN_AUTH_REGISTRATION_MYSQL_TESTS") != "1"
        or os.getenv("RUN_AUTH_MYSQL_TESTS") != "1",
        reason="E4 registration MySQL fixtures require a separate explicit opt-in",
    ),
]


def request_data():
    return {
        "email": f"register-{secrets.token_hex(8)}@example.com",
        "full_name": "New Candidate",
        "password": secrets.token_urlsafe(24),
    }


def register_and_track(database, data):
    response = database.client.post("/api/v1/auth/register/candidate", json=data)
    assert response.status_code == 201
    ids = response.json()
    database.track("taikhoan", int(ids["account_id"]))
    database.track("hosoungvien", int(ids["candidate_id"]))
    return ids


def test_mysql_candidate_register_login_and_private_profile(mysql_auth):
    data = request_data()
    ids = register_and_track(mysql_auth, data)
    accounts = mysql_auth.tables["taikhoan"]
    profiles = mysql_auth.tables["hosoungvien"]
    account = (
        mysql_auth.connection.execute(
            select(accounts).where(accounts.c.idtaikhoan == int(ids["account_id"]))
        )
        .mappings()
        .one()
    )
    profile = (
        mysql_auth.connection.execute(
            select(profiles).where(profiles.c.idungvien == int(ids["candidate_id"]))
        )
        .mappings()
        .one()
    )
    assert profile["idtaikhoan"] == account["idtaikhoan"]
    assert verify_password(data["password"], account["matkhaubam"])[0]
    assert account["matkhaubam"].startswith("$argon2id$")
    assert account["trangthai"] == "ACTIVE" and account["vaitro"] == "CANDIDATE"
    assert not account["daxacthucemail"] and not account["nhanemail"]
    assert not profile["congkhaihoso"] and account["solandangsai"] == 0
    assert profile["thoigiancapnhat"] == account["thoigiantao"]
    login = mysql_auth.client.post(
        "/api/v1/auth/login", json={"email": data["email"], "password": data["password"]}
    )
    assert login.status_code == 200
    me = mysql_auth.client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer " + login.json()["access_token"]}
    )
    assert me.status_code == 200 and me.json()["account_id"] == ids["account_id"]
    assert data["password"] not in me.text and "hash" not in me.text


def test_mysql_candidate_duplicate_email_uses_case_insensitive_unique(mysql_auth):
    data = request_data()
    register_and_track(mysql_auth, data)
    duplicate = mysql_auth.client.post(
        "/api/v1/auth/register/candidate", json=data | {"email": data["email"].upper()}
    )
    assert duplicate.status_code == 409
    assert data["password"] not in duplicate.text and "Duplicate entry" not in duplicate.text
    for name in ("taikhoan", "hosoungvien"):
        assert (
            mysql_auth.connection.scalar(select(func.count()).select_from(mysql_auth.tables[name]))
            == 1
        )


def test_mysql_candidate_profile_fk_failure_rolls_back_new_account(mysql_auth, monkeypatch):
    original = CandidateRegistrationRepository.create_profile

    def fail_profile(repository, account_id, now):
        # Actual MySQL FK error during the last step, without altering the schema.
        return original(repository, 9223372036854775807, now)

    before = {
        name: mysql_auth.connection.scalar(select(func.count()).select_from(table))
        for name, table in mysql_auth.tables.items()
    }
    monkeypatch.setattr(CandidateRegistrationRepository, "create_profile", fail_profile)
    response = mysql_auth.client.post("/api/v1/auth/register/candidate", json=request_data())
    assert response.status_code == 503
    for name, table in mysql_auth.tables.items():
        assert mysql_auth.connection.scalar(select(func.count()).select_from(table)) == before[name]
