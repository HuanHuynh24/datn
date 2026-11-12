import secrets
from typing import Annotated
from unittest.mock import Mock

import pytest
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy.exc import OperationalError

from app.auth.dependencies import (
    CurrentPrincipal,
    get_principal_resolver,
    require_account_owner,
    require_admin,
    require_company_scope,
)
from app.auth.errors import AUTH_ERROR_RESPONSES
from app.auth.schemas import LoginRequest, Principal, TokenResponse
from app.main import create_app


@pytest.fixture
def protected_app(settings):
    settings = settings.model_copy(update={"jwt_secret": SecretStr(secrets.token_urlsafe(48))})
    app = create_app(settings)

    # Test-only routes exercise the real dependency graph; no fake production APIs.
    @app.get("/test/me", responses=AUTH_ERROR_RESPONSES)
    def me(principal: CurrentPrincipal) -> dict[str, str]:
        return {"account_id": principal.account_id}

    @app.get("/test/admin", responses=AUTH_ERROR_RESPONSES)
    def admin(principal: Annotated[Principal, Depends(require_admin)]) -> dict[str, str]:
        return {"account_id": principal.account_id}

    return app


def issue(app, account_id="1"):
    from app.auth.tokens import TokenCodec

    settings = app.state.settings
    return TokenCodec(
        settings.jwt_secret, settings.jwt_issuer, settings.jwt_audience
    ).create_access_token(account_id)


@pytest.mark.parametrize("header", [None, "Basic invalid", "Bearer", "Bearer invalid"])
def test_missing_invalid_credentials_are_401(protected_app, header):
    with TestClient(protected_app) as client:
        response = client.get("/test/me", headers={"Authorization": header} if header else {})
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
        assert response.json() == {"detail": "Invalid authentication credentials"}


def test_valid_token_does_not_bypass_unimplemented_database_adapter(protected_app):
    with TestClient(protected_app) as client:
        response = client.get(
            "/test/me", headers={"Authorization": "Bearer " + issue(protected_app)}
        )
        assert response.status_code == 503
        assert response.json() == {"detail": "Authentication backend unavailable"}


def test_resolver_current_state_role_and_subject_binding(protected_app):
    resolver = Mock()
    resolver.resolve.return_value = Principal(
        account_id="1", role="ADMIN", authentication_allowed=True
    )
    protected_app.dependency_overrides[get_principal_resolver] = lambda: resolver
    headers = {"Authorization": "Bearer " + issue(protected_app)}
    with TestClient(protected_app) as client:
        assert client.get("/test/admin", headers=headers).status_code == 200
        resolver.resolve.assert_called_with("1")
        resolver.resolve.return_value = Principal(
            account_id="1", role="test-unconfirmed-role", authentication_allowed=True
        )
        assert client.get("/test/admin", headers=headers).status_code == 403
        resolver.resolve.return_value = Principal(account_id="1", role="ADMIN")
        assert client.get("/test/me", headers=headers).status_code == 401
        resolver.resolve.return_value = Principal(
            account_id="2", role="ADMIN", authentication_allowed=True
        )
        assert client.get("/test/me", headers=headers).status_code == 401
        resolver.resolve.return_value = None
        assert client.get("/test/me", headers=headers).status_code == 401
        resolver.resolve.side_effect = OperationalError(
            "SELECT", {}, Exception("private DB details")
        )
        response = client.get("/test/me", headers=headers)
        assert response.status_code == 503 and "private" not in response.text


def test_owner_and_company_scope():
    principal = Principal(
        account_id="1", role="test-unconfirmed-role", company_id="10", authentication_allowed=True
    )
    require_account_owner("1", principal)
    require_company_scope("10", principal)
    for check, object_id in [(require_account_owner, "2"), (require_company_scope, "20")]:
        with pytest.raises(HTTPException) as exc:
            check(object_id, principal)
        assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        require_company_scope("10", principal.model_copy(update={"company_id": None}))
    assert exc.value.status_code == 403


def test_missing_signing_configuration_is_unavailable(protected_app):
    protected_app.state.settings = protected_app.state.settings.model_copy(
        update={"jwt_secret": None}
    )
    with TestClient(protected_app) as client:
        response = client.get("/test/me", headers={"Authorization": "Bearer any-token"})
        assert response.status_code == 503
        assert response.json() == {"detail": "Authentication backend unavailable"}


def test_account_endpoints_are_real_and_test_routes_absent(settings):
    with TestClient(create_app(settings)) as client:
        schema = client.get("/openapi.json").json()
        assert set(schema["paths"]) == {
            "/api/v1/candidates/me/avatar",
            "/api/v1/companies/me/logo",
            "/api/v1/media/companies/{company_id}/logos/{filename}",
            "/api/v1/companies",
            "/api/v1/companies/{company_id}",
            "/api/v1/companies/{company_id}/jobs",
            "/api/v1/admin/accounts/{account_id}/status",
            "/api/v1/admin/catalog/{resource}",
            "/api/v1/admin/catalog/{resource}/{record_id}",
            "/api/v1/admin/dashboard",
            "/api/v1/admin/management/{resource}",
            "/api/v1/admin/management/{resource}/{record_id}",
            "/api/v1/candidates/me/cvs",
            "/api/v1/candidates/me/cvs/{cv_id}",
            "/api/v1/candidates/me/cvs/{cv_id}/download",
            "/api/v1/jobs/{job_id}/applications",
            "/api/v1/candidates/me/applications",
            "/api/v1/companies/me/applications",
            "/api/v1/companies/me/applications/{application_id}",
            "/api/v1/applications/{application_id}",
            "/api/v1/applications/{application_id}/cv",
            "/api/v1/admin/companies",
            "/api/v1/admin/companies/{company_id}/review",
            "/api/v1/job-catalog",
            "/api/v1/jobs",
            "/api/v1/jobs/{job_id}",
            "/api/v1/companies/me/jobs",
            "/api/v1/companies/me/jobs/{job_id}",
            "/api/v1/companies/me/jobs/{job_id}/{action}",
            "/api/v1/admin/jobs",
            "/api/v1/admin/jobs/{job_id}/review",
            "/health/live",
            "/health/ready",
            "/api/v1/auth/login",
            "/api/v1/auth/me",
            "/api/v1/auth/register/candidate",
            "/api/v1/candidates/me/profile",
            "/api/v1/company-packages",
            "/api/v1/companies/me",
            "/api/v1/auth/register/employer",
            "/api/v1/companies/me/members",
            "/api/v1/companies/me/members/{account_id}",
        }
        assert "LoginRequest" in schema["components"]["schemas"]
        assert client.get("/test/me").status_code == 404


def test_schema_mass_assignment_and_password_repr():
    password = secrets.token_urlsafe(24)
    data = dict(email="user@example.com", password=password)
    assert password not in repr(LoginRequest(**data))
    for field in ("role", "account_id", "company_id", "status"):
        with pytest.raises(ValidationError):
            LoginRequest(**data, **{field: "ADMIN"})
    token = secrets.token_urlsafe(48)
    assert token not in repr(TokenResponse(access_token=token))
    assert TokenResponse(access_token=token).model_dump()["expires_in"] == 1800


def test_openapi_real_dependency_security_and_cors(protected_app):
    with TestClient(protected_app) as client:
        schema = client.get("/openapi.json").json()
        operation = schema["paths"]["/test/admin"]["get"]
        assert operation["security"] == [{"AccessToken": []}]
        assert {"401", "403", "503"} <= operation["responses"].keys()
        response = client.options(
            "/test/me",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
