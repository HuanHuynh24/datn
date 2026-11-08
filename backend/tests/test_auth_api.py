import secrets
from datetime import UTC, datetime
from unittest.mock import Mock

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.exc import OperationalError

from app.auth.dependencies import require_approved_company
from app.core.passwords import hash_password
from app.db.session import get_db
from app.main import create_app


@pytest.fixture
def auth_api(settings):
    password = secrets.token_urlsafe(24)
    row = dict(
        account_id=1,
        email="user@example.com",
        password_hash=hash_password(password),
        role="ADMIN",
        status="ACTIVE",
        email_verified=False,
        locked_until=None,
        candidate_id=None,
        member_company_id=None,
        member_status=None,
        member_title=None,
        company_id=None,
        company_approval_status=None,
    )
    session = Mock()
    session.execute.return_value.mappings.return_value.one_or_none.side_effect = lambda: dict(row)
    app = create_app(
        settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    )

    def scoped_session():
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = scoped_session

    @app.get("/test/recruit", dependencies=[Depends(require_approved_company)])
    def recruit():
        return {"allowed": True}

    with TestClient(app) as client:
        yield client, row, password, session


def credentials(row, password):
    return {"email": row["email"], "password": password}


def test_login_real_service_and_current_status_reread(auth_api):
    client, row, password, session = auth_api
    response = client.post("/api/v1/auth/login", json=credentials(row, password))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    token = response.json()
    assert token["expires_in"] == 1800 and token["token_type"] == "bearer"
    headers = {"Authorization": "Bearer " + token["access_token"]}
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json() == dict(
        account_id="1",
        role="ADMIN",
        company_id=None,
        internal_role=None,
        company_approval_status=None,
    )
    assert "password" not in me.text and "hash" not in me.text
    row["status"] = "DISABLED"
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/login", json=credentials(row, password)).status_code == 401
    session.commit.assert_not_called()
    session.add.assert_not_called()
    assert session.close.call_count >= 4


@pytest.mark.parametrize("approval", ["PENDING", "REJECTED", "APPROVED"])
def test_company_login_is_separate_from_recruitment_permission(auth_api, approval):
    client, row, password, _ = auth_api
    row.update(
        role="COMPANY_MEMBER",
        member_company_id=20,
        company_id=20,
        member_status="ACTIVE",
        member_title="OWNER",
        company_approval_status=approval,
    )
    login = client.post("/api/v1/auth/login", json=credentials(row, password))
    assert login.status_code == 200
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert (
        client.get("/api/v1/auth/me", headers=headers).json()["company_approval_status"] == approval
    )
    assert client.get("/test/recruit", headers=headers).status_code == (
        200 if approval == "APPROVED" else 403
    )
    row["member_status"] = "INACTIVE"
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_wrong_password_missing_account_and_privilege_input(auth_api):
    client, row, password, session = auth_api
    wrong = client.post("/api/v1/auth/login", json=credentials(row, password + "wrong"))
    assert wrong.status_code == 401
    assert wrong.headers["www-authenticate"] == "Bearer"
    session.execute.return_value.mappings.return_value.one_or_none.side_effect = lambda: None
    missing = client.post("/api/v1/auth/login", json=credentials(row, password))
    assert missing.status_code == 401 and missing.json() == wrong.json()
    for key in ["role", "status", "internal_role", "company_id"]:
        response = client.post(
            "/api/v1/auth/login", json=credentials(row, password) | {key: "ADMIN"}
        )
        assert response.status_code == 422
        assert password not in response.text
        assert all("input" not in error for error in response.json()["detail"])
    assert (
        client.post("/api/v1/auth/register/admin", json=credentials(row, password)).status_code
        == 404
    )


def test_database_or_unresolved_lock_does_not_issue_a_token(auth_api):
    client, row, password, session = auth_api
    row["locked_until"] = datetime.now(UTC)
    locked = client.post("/api/v1/auth/login", json=credentials(row, password))
    assert locked.status_code == 503 and "access_token" not in locked.text
    session.execute.side_effect = OperationalError(
        "private sql", {}, Exception("secret DB details")
    )
    response = client.post("/api/v1/auth/login", json=credentials(row, password))
    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication backend unavailable"}
    assert "private" not in response.text and "secret" not in response.text


def test_current_user_requires_bearer_and_openapi_has_actual_routes(auth_api):
    client, _, _, _ = auth_api
    assert client.get("/api/v1/auth/me").status_code == 401
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/v1/auth/me"]["get"]["security"] == [{"AccessToken": []}]
    assert "security" not in schema["paths"]["/api/v1/auth/login"]["post"]
    assert {"401", "503", "422"} <= schema["paths"]["/api/v1/auth/login"]["post"][
        "responses"
    ].keys()
