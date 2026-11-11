from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.companies.schemas import PublicCompanyResponse
from app.db.session import get_db
from app.main import create_app


def test_public_company_openapi_has_no_internal_fields_or_security(settings):
    with TestClient(create_app(settings)) as client:
        schema = client.get("/openapi.json").json()
        for path in [
            "/api/v1/companies",
            "/api/v1/companies/{company_id}",
            "/api/v1/companies/{company_id}/jobs",
        ]:
            operation = schema["paths"][path]["get"]
            assert not operation.get("security")
            assert {"200", "422", "503"} <= operation["responses"].keys()
        assert client.get("/api/v1/companies/me").status_code == 401
        assert client.get("/api/v1/companies/me/jobs").status_code == 401
    assert set(PublicCompanyResponse.model_fields) == {
        "company_id",
        "company_name",
        "industry",
        "size",
        "address",
        "website",
        "logo_url",
        "introduction",
        "open_job_count",
    }


@pytest.mark.parametrize(
    "path", ["/api/v1/companies", "/api/v1/companies/1", "/api/v1/companies/1/jobs"]
)
def test_public_company_db_errors_are_sanitized(settings, path):
    session = Mock()
    error = OperationalError("private SQL", {}, Exception("private credentials"))
    session.scalar.side_effect = error
    session.execute.side_effect = error
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as client:
        response = client.get(path)
    assert response.status_code == 503
    assert "private" not in response.text
    session.commit.assert_not_called()
