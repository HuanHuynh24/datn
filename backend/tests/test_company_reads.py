from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.auth.dependencies import get_current_principal
from app.auth.schemas import Principal
from app.db.session import get_db
from app.main import create_app


@pytest.mark.parametrize("path", ["/api/v1/company-packages", "/api/v1/companies/me"])
def test_company_read_errors_do_not_leak_database_details(settings, path):
    session = Mock()
    session.execute.side_effect = OperationalError("private SQL", {}, Exception("private driver"))
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        account_id="1",
        role="COMPANY_MEMBER",
        company_id="2",
        internal_role="OWNER",
        authentication_allowed=True,
    )
    with TestClient(app) as client:
        response = client.get(path)
        assert response.status_code == 503 and "private" not in response.text
    session.commit.assert_not_called()


def test_company_openapi_public_catalog_and_authenticated_scope(settings):
    with TestClient(create_app(settings)) as client:
        schema = client.get("/openapi.json").json()
    catalog = schema["paths"]["/api/v1/company-packages"]["get"]
    company = schema["paths"]["/api/v1/companies/me"]["get"]
    assert not catalog.get("security")
    assert company["security"] == [{"AccessToken": []}]
    assert {"200", "401", "403", "404", "503"} <= company["responses"].keys()
