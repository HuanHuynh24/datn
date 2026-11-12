from datetime import UTC, datetime

from sqlalchemy import select, update

from app.models import DoanhNghiep, HoSoUngVien


class ImageRepository:
    def __init__(self, session):
        self.session = session

    def target(self, kind, owner_id, *, lock=False, public=False):
        table = HoSoUngVien.__table__ if kind == "avatars" else DoanhNghiep.__table__
        key, field = (
            ("idtaikhoan", "anhdaidien") if kind == "avatars" else ("iddoanhnghiep", "logo")
        )
        query = select(table.c[field]).where(table.c[key] == int(owner_id))
        if public:
            query = query.where(table.c.trangthaiduyet == "APPROVED")
        if lock:
            query = query.with_for_update()
        return self.session.execute(query).one_or_none()

    def update(self, kind, owner_id, url):
        table = HoSoUngVien.__table__ if kind == "avatars" else DoanhNghiep.__table__
        key, field = (
            ("idtaikhoan", "anhdaidien") if kind == "avatars" else ("iddoanhnghiep", "logo")
        )
        values = {field: url}
        if kind == "avatars":
            values["thoigiancapnhat"] = datetime.now(UTC).replace(tzinfo=None)
        self.session.execute(update(table).where(table.c[key] == int(owner_id)).values(**values))
