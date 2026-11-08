"""E6 browser API on an isolated MySQL connection; teardown rolls back all rows."""

import os
from threading import Lock

import uvicorn
from jobs_target import mysql_jobs
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.passwords import hash_password
from app.db.session import get_db
from app.main import create_app


def main():
    fixture = mysql_jobs.__wrapped__()
    state = next(fixture)
    identity = state.create_identity("ADMIN")
    account = state.tables["taikhoan"]
    state.connection.execute(
        update(account)
        .where(account.c.idtaikhoan == identity.account_id)
        .values(
            email=os.environ["BROWSER_ADMIN_EMAIL"],
            matkhaubam=hash_password(os.environ["BROWSER_ADMIN_PASSWORD"]),
        )
    )
    for code, name, limit in [("FREE", "Free browser test", 1), ("PRO", "Pro browser test", 5)]:
        state.connection.execute(
            state.tables["goidoanhnghiep"]
            .insert()
            .values(
                magoi=code,
                tengoi=name,
                sotaikhoantoida=limit,
                giathang=0,
                mota="Rollback-only E6 browser fixture",
            )
        )
    for table, name_field, names in [
        ("nganhnghe", "tennganhnghe", ["Phát triển phần mềm", "Marketing"]),
        ("tinhthanh", "tentinhthanh", ["Hà Nội", "Thành phố Hồ Chí Minh"]),
        ("kynang", "tenkynang", ["Python", "FastAPI", "SQL", "Docker"]),
    ]:
        for name in names:
            values = {name_field: name}
            if table != "tinhthanh":
                values["trangthai"] = "ACTIVE"
            state.connection.execute(state.tables[table].insert().values(**values))
    app = create_app(
        state.settings.model_copy(
            update={
                "cors_origins": "http://localhost:3000,http://127.0.0.1:3000",
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


if __name__ == "__main__":
    main()
