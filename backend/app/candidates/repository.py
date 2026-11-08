from datetime import datetime

from sqlalchemy import null, select, update
from sqlalchemy.orm import Session

from app.models import HoSoUngVien, TaiKhoan, TinhThanh

PROFILE_FIELDS = {
    "phone": "sodienthoai",
    "address": "diachi",
    "introduction": "gioithieu",
    "avatar_url": "anhdaidien",
    "profile_public": "congkhaihoso",
    "education": "hocvan",
    "experience": "kinhnghiem",
    "desired_position": "vitrimongmuon",
    "province_id": "idtinhthanh",
    "minimum_salary": "luongmongmuontoithieu",
    "maximum_salary": "luongmongmuontoida",
    "desired_work_type": "hinhthuclamviecmongmuon",
}


class CandidateProfileRepository:
    def __init__(self, session: Session):
        self.session = session

    def owned(self, account_id: str, *, lock: bool = False):
        account, profile = TaiKhoan.__table__, HoSoUngVien.__table__
        query = (
            select(
                account.c.idtaikhoan.label("account_id"),
                profile.c.idungvien.label("candidate_id"),
                account.c.hovaten.label("full_name"),
                account.c.email,
                profile.c.thoigiancapnhat.label("updated_at"),
                *(profile.c[column].label(field) for field, column in PROFILE_FIELDS.items()),
            )
            .select_from(account.join(profile, account.c.idtaikhoan == profile.c.idtaikhoan))
            .where(
                account.c.idtaikhoan == int(account_id),
                account.c.vaitro == "CANDIDATE",
                account.c.trangthai == "ACTIVE",
            )
        )
        if lock:
            query = query.with_for_update()
        return self.session.execute(query).mappings().one_or_none()

    def province_exists(self, province_id: str) -> bool:
        province = TinhThanh.__table__
        return (
            self.session.scalar(
                select(province.c.idtinhthanh).where(province.c.idtinhthanh == int(province_id))
            )
            is not None
        )

    def update_owned(self, account_id: str, values: dict, now: datetime):
        if "full_name" in values:
            self.session.execute(
                update(TaiKhoan.__table__)
                .where(TaiKhoan.__table__.c.idtaikhoan == int(account_id))
                .values(hovaten=values["full_name"])
            )
        updates = {PROFILE_FIELDS[k]: v for k, v in values.items() if k in PROFILE_FIELDS}
        for field in ("hocvan", "kinhnghiem"):
            if field in updates and updates[field] is None:
                updates[field] = null()
        updates["thoigiancapnhat"] = now
        self.session.execute(
            update(HoSoUngVien.__table__)
            .where(HoSoUngVien.__table__.c.idtaikhoan == int(account_id))
            .values(**updates)
        )
