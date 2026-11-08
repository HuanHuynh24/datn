"""Admin browser API uses only the rollback-isolated E7 test database."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock

import uvicorn
from cv_target import mysql_cv
from sqlalchemy import update
from sqlalchemy.orm import Session
from test_jobs_mysql import auth, draft

from app.core.passwords import hash_password
from app.db.session import get_db
from app.main import create_app


def main():
    with TemporaryDirectory(prefix="e8a-browser-") as directory:
        fixture = mysql_cv.__wrapped__(Path(directory))
        state = next(fixture)
        admin = state.create_identity("ADMIN")
        account = state.tables["taikhoan"]
        state.connection.execute(
            update(account)
            .where(account.c.idtaikhoan == admin.account_id)
            .values(
                email=os.environ["BROWSER_ADMIN_EMAIL"],
                matkhaubam=hash_password(os.environ["BROWSER_ADMIN_PASSWORD"]),
            )
        )
        for index in range(12):
            candidate = state.create_identity("CANDIDATE")
            state.connection.execute(
                update(account)
                .where(account.c.idtaikhoan == candidate.account_id)
                .values(hovaten=f"E8 Candidate {index:02}")
            )
        state.create_identity("COMPANY_MEMBER", approval="PENDING")
        _, employer = auth(state)
        job = draft(state, employer)
        response = state.client.post(
            f"/api/v1/companies/me/jobs/{job['id']}/submit", headers=employer
        )
        assert response.status_code == 200
        app = create_app(
            state.settings.model_copy(
                update={"cors_origins": "http://localhost:3000,http://127.0.0.1:3000"}
            )
        )
        lock = Lock()

        def serialized():
            with (
                lock,
                Session(bind=state.connection, join_transaction_mode="create_savepoint") as session,
            ):
                yield session

        app.dependency_overrides[get_db] = serialized
        try:
            uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False, log_level="warning")
        finally:
            fixture.close()
            print("Admin browser rollback verified: all 13 test table counts restored")


if __name__ == "__main__":
    main()
