import secrets
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, OperationalError

from app.auth.registration import CandidateRegistrationService, RegistrationConflict
from app.auth.schemas import CandidateRegistrationRequest
from app.core.passwords import verify_password
from app.db.session import get_db
from app.main import create_app


def payload():
    return {
        "email": "candidate@example.com",
        "full_name": "  Candidate Name  ",
        "password": secrets.token_urlsafe(16),
    }


def session_for_registration():
    session = MagicMock()
    session.execute.side_effect = [
        MagicMock(inserted_primary_key=(101,)),
        MagicMock(inserted_primary_key=(202,)),
    ]
    return session


def test_registration_owns_transaction_hash_and_profile_identity():
    session = session_for_registration()
    data = payload()
    result = CandidateRegistrationService(session).register(CandidateRegistrationRequest(**data))
    assert result.model_dump() == {"account_id": "101", "candidate_id": "202", "role": "CANDIDATE"}
    account, profile = [call.args[0].compile().params for call in session.execute.call_args_list]
    assert verify_password(data["password"], account["matkhaubam"])[0]
    assert account["matkhaubam"].startswith("$argon2id$")
    assert account["hovaten"] == "Candidate Name"
    assert account["vaitro"] == "CANDIDATE" and account["trangthai"] == "ACTIVE"
    assert profile["idtaikhoan"] == 101
    assert account["thoigiantao"] == profile["thoigiancapnhat"]
    assert account["thoigiantao"].tzinfo is None
    session.begin.return_value.__exit__.assert_called_once_with(None, None, None)
    assert "password" not in result.model_dump()


def test_profile_failure_exits_transaction_with_error_instead_of_partial_success():
    session = session_for_registration()
    error = OperationalError("synthetic failure", {}, Exception("no database"))
    session.execute.side_effect = [MagicMock(inserted_primary_key=(101,)), error]
    with pytest.raises(OperationalError):
        CandidateRegistrationService(session).register(CandidateRegistrationRequest(**payload()))
    assert session.begin.return_value.__exit__.call_args.args[1] is error


def test_unique_conflict_is_translated_after_transaction_exit():
    session = session_for_registration()
    session.execute.side_effect = IntegrityError("insert", {}, Exception(1062, "duplicate"))
    with pytest.raises(RegistrationConflict):
        CandidateRegistrationService(session).register(CandidateRegistrationRequest(**payload()))
    assert session.begin.return_value.__exit__.call_args.args[0] is IntegrityError


def test_register_http_validation_errors_and_openapi(settings):
    session = session_for_registration()
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: session
    data = payload()
    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()
        operation = schema["paths"]["/api/v1/auth/register/candidate"]["post"]
        assert {"201", "409", "422", "503"} <= operation["responses"].keys()
        for extra in ("role", "status", "account_id", "candidate_id", "internal_role"):
            response = client.post("/api/v1/auth/register/candidate", json=data | {extra: "ADMIN"})
            assert response.status_code == 422 and data["password"] not in response.text
        for invalid in ({"password": "short"}, {"full_name": " "}, {"email": "invalid"}):
            response = client.post("/api/v1/auth/register/candidate", json=data | invalid)
            assert response.status_code == 422 and data["password"] not in response.text
        session.execute.assert_not_called()
        created = client.post("/api/v1/auth/register/candidate", json=data)
        assert created.status_code == 201 and created.headers["cache-control"] == "no-store"
        assert set(created.json()) == {"account_id", "candidate_id", "role"}
        for error, status in [
            (IntegrityError("private sql", {}, Exception(1062, "private")), 409),
            (OperationalError("private sql", {}, Exception("private")), 503),
        ]:
            session.execute.side_effect = error
            response = client.post("/api/v1/auth/register/candidate", json=data)
            assert response.status_code == status
            assert "private" not in response.text and data["password"] not in response.text
