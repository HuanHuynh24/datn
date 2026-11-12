from fastapi.testclient import TestClient

from app.main import create_app


def test_image_body_limit_precedes_multipart_spooling(settings):
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/v1/candidates/me/avatar",
            content=b"x" * (6 * 1024 * 1024 + 1),
            headers={"Content-Type": "multipart/form-data; boundary=invalid"},
        )
        assert response.status_code == 413


def test_image_openapi_and_guest_guards(settings):
    with TestClient(create_app(settings)) as client:
        paths = client.get("/openapi.json").json()["paths"]
        for path in ["/api/v1/candidates/me/avatar", "/api/v1/companies/me/logo"]:
            assert paths[path]["post"]["security"] == [{"AccessToken": []}]
            assert "multipart/form-data" in paths[path]["post"]["requestBody"]["content"]
            assert {"413", "415", "503"} <= paths[path]["post"]["responses"].keys()
            assert client.get(path).status_code == 401
            assert (
                paths[path]["get"]["responses"]["200"]["content"]["image/png"]["schema"]["format"]
                == "binary"
            )
        assert (
            "security" not in paths["/api/v1/media/companies/{company_id}/logos/{filename}"]["get"]
        )
