"""Approved Development subset only; caller owns target checks and transaction."""

from sqlalchemy import select

from app.models import KyNang, NganhNghe, TinhThanh

CATALOG = (
    (NganhNghe.__table__, "tennganhnghe", ("Phát triển phần mềm", "Marketing")),
    (TinhThanh.__table__, "tentinhthanh", ("Hà Nội", "Thành phố Hồ Chí Minh")),
    (KyNang.__table__, "tenkynang", ("Python", "FastAPI", "SQL", "Docker")),
)


def seed_jobs_catalog(connection):
    inserted, ids = {}, {}
    for table, field, names in CATALOG:
        inserted[table.name], ids[table.name] = 0, {}
        pk = next(iter(table.primary_key))
        for name in names:
            existing = (
                connection.execute(select(pk).where(table.c[field] == name).with_for_update())
                .scalars()
                .all()
            )
            if len(existing) > 1:
                raise ValueError("Ambiguous existing catalog; do not overwrite")
            if existing:
                key = existing[0]
            else:
                data = {field: name}
                if "trangthai" in table.c:
                    data["trangthai"] = "ACTIVE"
                key = connection.execute(table.insert().values(**data)).inserted_primary_key[0]
                inserted[table.name] += 1
            ids[table.name][name] = str(key)
    return {"inserted": inserted, "ids": ids, "updated_rows": 0, "wards_seeded": 0}
