"""Rollback-only browser fixture; no requests reach Development."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock

import uvicorn
from cv_target import mysql_cv
from sqlalchemy import update
from sqlalchemy.orm import Session
from test_jobs_mysql import approve, auth, draft

from app.core.passwords import hash_password
from app.db.session import get_db
from app.main import create_app


def main():
    with TemporaryDirectory(prefix="e7-browser-") as directory:
        fixture = mysql_cv.__wrapped__(Path(directory))
        state = next(fixture)
        for role, prefix in [("CANDIDATE", "CANDIDATE"), ("COMPANY_MEMBER", "EMPLOYER")]:
            identity, headers = auth(state, role, internal="OWNER")
            if role == "COMPANY_MEMBER":
                approve(state, headers, draft(state, headers))
            account = state.tables["taikhoan"]
            state.connection.execute(
                update(account)
                .where(account.c.idtaikhoan == identity.account_id)
                .values(
                    email=os.environ[f"BROWSER_{prefix}_EMAIL"],
                    matkhaubam=hash_password(os.environ[f"BROWSER_{prefix}_PASSWORD"]),
                )
            )
        app = create_app(
            state.settings.model_copy(
                update={
                    "cors_origins": "http://localhost:3000,http://127.0.0.1:3000",
                    "image_storage_dir": Path(directory) / "images",
                    "public_api_url": "http://localhost:8001",
                }
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
            print("E7 browser fixture rollback verified; all 13 table row counts restored")


if __name__ == "__main__":
    main()
