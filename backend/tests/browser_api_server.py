"""Temporary real-MySQL browser test API; all HTTP writes stay inside one rolled-back fixture."""

import os
from threading import Lock

import uvicorn
from sqlalchemy.orm import Session
from test_auth_mysql_integration import mysql_auth

from app.db.session import get_db
from app.main import create_app


def main():
    fixture = mysql_auth.__wrapped__()
    state = next(fixture)  # Existing schema/identity/gate/strict-mode checks apply.
    if os.getenv("BROWSER_COMPANY_FIXTURE") == "1":
        for code, name, limit in [
            ("BROWSER_FREE", "Free browser test", 1),
            ("BROWSER_PRO", "Pro browser test", 5),
        ]:
            key = state.connection.execute(
                state.tables["goidoanhnghiep"]
                .insert()
                .values(
                    magoi=code,
                    tengoi=name,
                    sotaikhoantoida=limit,
                    giathang=0,
                    mota="Rollback-only browser fixture, not Development seed",
                )
            ).inserted_primary_key[0]
            state.track("goidoanhnghiep", key)
    app = create_app(
        state.settings.model_copy(
            update={
                "cors_origins": "http://localhost:3000,http://127.0.0.1:3000",
            }
        )
    )
    # React can issue concurrent GETs (including StrictMode effects). A single
    # outer fixture Connection cannot be shared concurrently across HTTP threads.
    # Serialize this temporary test adapter only; production uses pooled Sessions.
    request_lock = Lock()

    def serialized_session():
        with request_lock:
            with Session(
                bind=state.connection, join_transaction_mode="create_savepoint"
            ) as session:
                yield session

    app.dependency_overrides[get_db] = serialized_session
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False, log_level="warning")
    finally:
        fixture.close()


if __name__ == "__main__":
    main()
