import os

import pytest
from sqlalchemy import select, update
from test_auth_mysql_integration import mysql_auth as mysql_auth

from app.candidates.repository import CandidateProfileRepository

PATH = "/api/v1/candidates/me/profile"
pytestmark = [
    pytest.mark.mysql,
    pytest.mark.skipif(
        os.getenv("RUN_CANDIDATE_PROFILE_MYSQL_TESTS") != "1",
        reason="Profile MySQL fixture opt-in required",
    ),
]


def candidate(database):
    identity = database.create_identity("CANDIDATE")
    token = database.login(identity).json()["access_token"]
    return identity, {"Authorization": "Bearer " + token}


def test_mysql_profile_read_and_update_persists_atomically(mysql_auth):
    identity, headers = candidate(mysql_auth)
    response = mysql_auth.client.get(PATH, headers=headers)
    assert response.status_code == 200
    assert response.json()["account_id"] == str(identity.account_id)
    assert response.json()["updated_at"].endswith("Z")
    assert "hash" not in response.text and identity.password not in response.text
    values = {
        "full_name": "Updated Candidate",
        "phone": "0123456789",
        "address": "New address",
        "education": [{"school": "Test University"}],
        "experience": None,
        "minimum_salary": "1000.00",
        "maximum_salary": "2000.00",
        "profile_public": True,
    }
    changed = mysql_auth.client.patch(PATH, headers=headers, json=values)
    assert changed.status_code == 200
    assert changed.json()["full_name"] == "Updated Candidate"
    assert changed.json()["minimum_salary"] == "1000.00"
    assert changed.json()["profile_public"] is True
    assert mysql_auth.client.get(PATH, headers=headers).json() == changed.json()
    profile = mysql_auth.tables["hosoungvien"]
    assert mysql_auth.connection.scalar(
        select(profile.c.kinhnghiem.is_(None)).where(profile.c.idtaikhoan == identity.account_id)
    )


def test_mysql_profile_never_accepts_another_owner(mysql_auth):
    first, headers = candidate(mysql_auth)
    other, _ = candidate(mysql_auth)
    original = mysql_auth.row_for("hosoungvien", other)
    assert (
        mysql_auth.client.patch(
            PATH,
            headers=headers,
            json={"account_id": str(other.account_id), "introduction": "overwrite"},
        ).status_code
        == 422
    )
    assert (
        mysql_auth.client.get(
            f"/api/v1/candidates/{other.account_id}/profile", headers=headers
        ).status_code
        == 404
    )
    assert (
        mysql_auth.client.patch(PATH, headers=headers, json={"introduction": "Mine"}).status_code
        == 200
    )
    assert dict(mysql_auth.row_for("hosoungvien", other)) == dict(original)
    assert mysql_auth.client.get(PATH, headers=headers).json()["account_id"] == str(
        first.account_id
    )


@pytest.mark.parametrize("role", [None, "ADMIN", "COMPANY_MEMBER"])
def test_mysql_profile_requires_authenticated_candidate(mysql_auth, role):
    headers = {}
    if role:
        identity = mysql_auth.create_identity(role)
        headers = {"Authorization": "Bearer " + mysql_auth.login(identity).json()["access_token"]}
    for response in (
        mysql_auth.client.get(PATH, headers=headers),
        mysql_auth.client.patch(PATH, headers=headers, json={"full_name": "Other"}),
    ):
        assert response.status_code == (401 if role is None else 403)


@pytest.mark.parametrize(
    "values",
    [
        {"full_name": None},
        {"full_name": " "},
        {"profile_public": None},
        {"profile_public": "yes"},
        {"email": "other@example.com"},
        {"role": "ADMIN"},
        {"minimum_salary": "-1"},
        {"minimum_salary": "100.123"},
        {"minimum_salary": "99999999999999.99"},
        {"avatar_url": "javascript:alert(1)"},
        {"phone": "0" * 21},
        {"province_id": "9223372036854775807"},
    ],
)
def test_mysql_profile_rejects_invalid_fields_without_updates(mysql_auth, values):
    _, headers = candidate(mysql_auth)
    before = mysql_auth.client.get(PATH, headers=headers).json()
    assert mysql_auth.client.patch(PATH, headers=headers, json=values).status_code == 422
    assert mysql_auth.client.get(PATH, headers=headers).json() == before


def test_mysql_profile_validates_salary_against_existing_values(mysql_auth):
    _, headers = candidate(mysql_auth)
    assert (
        mysql_auth.client.patch(
            PATH, headers=headers, json={"minimum_salary": "500", "maximum_salary": "1000"}
        ).status_code
        == 200
    )
    assert (
        mysql_auth.client.patch(PATH, headers=headers, json={"maximum_salary": "100"}).status_code
        == 422
    )
    assert mysql_auth.client.get(PATH, headers=headers).json()["maximum_salary"] == "1000.00"


def test_mysql_profile_rolls_back_account_name_when_profile_update_fails(mysql_auth, monkeypatch):
    _, headers = candidate(mysql_auth)
    before = mysql_auth.client.get(PATH, headers=headers).json()
    original = CandidateProfileRepository.update_owned

    def fail_profile(repository, account_id, values, now):
        original(repository, account_id, values, now)
        table = mysql_auth.tables["hosoungvien"]
        repository.session.execute(
            update(table)
            .where(table.c.idtaikhoan == int(account_id))
            .values(idtinhthanh=9223372036854775807)
        )

    monkeypatch.setattr(CandidateProfileRepository, "update_owned", fail_profile)
    failed = mysql_auth.client.patch(PATH, headers=headers, json={"full_name": "Must roll back"})
    assert failed.status_code == 503
    assert mysql_auth.client.get(PATH, headers=headers).json() == before
