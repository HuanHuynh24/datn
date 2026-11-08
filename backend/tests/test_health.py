from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_engine
from app.main import create_app


def test_liveness_and_docs_do_not_connect_to_database(settings):
    app = create_app(settings)
    with TestClient(app) as client:
        # A failed DB must not prevent the process or documentation from starting.
        assert client.get("/health/live").json() == {"status": "ok"}
        schema_response = client.get("/openapi.json")
        assert schema_response.status_code == 200
        schema = schema_response.json()
        assert set(schema["paths"]) == {
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
        operations = [
            value["get"] for key, value in schema["paths"].items() if key.startswith("/health/")
        ]
        assert len({op["operationId"] for op in operations}) == 2
        assert "503" in schema["paths"]["/health/ready"]["get"]["responses"]
        assert schema["components"]["securitySchemes"]["AccessToken"]["scheme"] == "bearer"
        assert all("security" not in op for op in operations)
        assert "LoginRequest" in schema["components"]["schemas"]
        for path in ("/docs", "/redoc"):
            response = client.get(path)
            assert response.status_code == 200
            assert "text/html" in response.headers["content-type"]


def test_readiness_failure_is_503_without_credentials(settings):
    app = create_app(settings)
    engine = MagicMock()
    engine.connect.side_effect = OperationalError(
        "SELECT 1", {}, Exception("private-password-and-host-details")
    )
    app.dependency_overrides[get_engine] = lambda: engine
    with TestClient(app) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json() == {"detail": "Database unavailable"}
        assert "private-password" not in response.text
        assert client.get("/health/live").status_code == 200


def test_docs_can_be_disabled_and_cors_restricts_origin(settings):
    app = create_app(settings.model_copy(update={"swagger_enabled": False}))
    with TestClient(app) as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404
        response = client.get("/health/live", headers={"Origin": "http://localhost:3000"})
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
        response = client.get("/health/live", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in response.headers
