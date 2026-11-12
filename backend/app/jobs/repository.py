from datetime import UTC, datetime

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.models import (
    DoanhNghiep,
    KyNang,
    KyNangTin,
    NganhNghe,
    TaiKhoan,
    ThanhVienDoanhNghiep,
    TinhThanh,
    TinTuyenDung,
)

FIELDS = {
    "title": "tieude",
    "description": "mota",
    "requirements": "yeucau",
    "industry_id": "idnganhnghe",
    "province_id": "idtinhthanh",
    "ward_id": "idxaphuong",
    "street": "tenduong",
    "level": "capbac",
    "minimum_salary": "luongtoithieu",
    "maximum_salary": "luongtoida",
    "years_experience": "namkinhnghiem",
    "work_type": "hinhthuclamviec",
    "application_deadline": "hannophoso",
}


class JobRepository:
    def __init__(self, session: Session):
        self.session = session
        self.job = TinTuyenDung.__table__
        self.company = DoanhNghiep.__table__

    def actor(self, account_id, company_id):
        c, m, a = self.company, ThanhVienDoanhNghiep.__table__, TaiKhoan.__table__
        self.session.execute(
            select(c.c.iddoanhnghiep).where(c.c.iddoanhnghiep == int(company_id)).with_for_update()
        ).first()
        return self.session.execute(
            select(m.c.idtaikhoan)
            .select_from(
                m.join(a, m.c.idtaikhoan == a.c.idtaikhoan).join(
                    c, m.c.iddoanhnghiep == c.c.iddoanhnghiep
                )
            )
            .where(
                m.c.idtaikhoan == int(account_id),
                m.c.iddoanhnghiep == int(company_id),
                m.c.trangthai == "ACTIVE",
                m.c.chucvunoibo.in_(["OWNER", "RECRUITER"]),
                a.c.vaitro == "COMPANY_MEMBER",
                a.c.trangthai == "ACTIVE",
                c.c.trangthaiduyet == "APPROVED",
            )
            .with_for_update()
        ).scalar_one_or_none()

    def row(self, key, company_id=None, lock=False):
        query = select(self.job).where(self.job.c.idtin == int(key))
        if company_id is not None:
            query = query.where(self.job.c.iddoanhnghiep == int(company_id))
        if lock:
            query = query.with_for_update()
        return self.session.execute(query).mappings().one_or_none()

    def visible(self):
        j, c = self.job, self.company
        now = datetime.now(UTC).replace(tzinfo=None)
        return and_(
            j.c.trangthai == "APPROVED",
            c.c.trangthaiduyet == "APPROVED",
            or_(j.c.hannophoso.is_(None), j.c.hannophoso >= now.date()),
            or_(j.c.thoigiandong.is_(None), j.c.thoigiandong > now),
        )

    def query(self):
        j, c = self.job, self.company
        n, p = NganhNghe.__table__, TinhThanh.__table__
        return select(
            j,
            c.c.tencongty.label("company_name"),
            c.c.logo.label("company_logo_url"),
            n.c.tennganhnghe.label("industry_name"),
            p.c.tentinhthanh.label("province_name"),
        ).select_from(
            j.join(c, j.c.iddoanhnghiep == c.c.iddoanhnghiep)
            .join(n, j.c.idnganhnghe == n.c.idnganhnghe)
            .join(p, j.c.idtinhthanh == p.c.idtinhthanh)
        )

    def listing(
        self,
        *,
        public=False,
        company_id=None,
        status=None,
        q=None,
        province_id=None,
        industry_id=None,
        skill_id=None,
        minimum_salary=None,
        work_type=None,
        sort="newest",
        limit=20,
        offset=0,
    ):
        j = self.job
        query = self.query()
        if public:
            query = query.where(self.visible())
        if company_id is not None:
            query = query.where(j.c.iddoanhnghiep == int(company_id))
        if status:
            query = query.where(j.c.trangthai == status)
        if q:
            text = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.where(
                or_(
                    j.c.tieude.like("%" + text + "%", escape="\\"),
                    j.c.mota.like("%" + text + "%", escape="\\"),
                    self.company.c.tencongty.like("%" + text + "%", escape="\\"),
                )
            )
        if province_id:
            query = query.where(j.c.idtinhthanh == int(province_id))
        if industry_id:
            query = query.where(j.c.idnganhnghe == int(industry_id))
        if skill_id:
            k = KyNangTin.__table__
            query = query.where(
                select(k.c.idtin)
                .where(k.c.idtin == j.c.idtin, k.c.idkynang == int(skill_id))
                .exists()
            )
        if minimum_salary is not None:
            query = query.where(j.c.luongtoida >= minimum_salary)
        if work_type:
            query = query.where(j.c.hinhthuclamviec == work_type)
        total = self.session.scalar(select(func.count()).select_from(query.subquery()))
        order = {
            "newest": j.c.idtin.desc(),
            "salary_asc": j.c.luongtoithieu.asc(),
            "salary_desc": j.c.luongtoida.desc(),
        }[sort]
        rows = (
            self.session.execute(
                query.order_by(order, j.c.idtin.desc()).limit(limit).offset(offset)
            )
            .mappings()
            .all()
        )
        return rows, total

    def detail(self, key, *, public=False, company_id=None):
        query = self.query().where(self.job.c.idtin == int(key))
        if public:
            query = query.where(self.visible())
        if company_id is not None:
            query = query.where(self.job.c.iddoanhnghiep == int(company_id))
        return self.session.execute(query).mappings().one_or_none()

    def skills(self, key):
        link, skill = KyNangTin.__table__, KyNang.__table__
        return (
            self.session.execute(
                select(link, skill.c.tenkynang.label("name"))
                .select_from(link.join(skill, link.c.idkynang == skill.c.idkynang))
                .where(link.c.idtin == int(key))
                .order_by(link.c.idkynang)
            )
            .mappings()
            .all()
        )

    def set_skills(self, key, values):
        table = KyNangTin.__table__
        self.session.execute(delete(table).where(table.c.idtin == int(key)))
        for value in values:
            self.session.execute(
                table.insert().values(
                    idtin=int(key),
                    idkynang=int(value["skill_id"]),
                    batbuoc=value["required"],
                    mucdouutien=value["priority"],
                )
            )

    def set_values(self, key, values):
        self.session.execute(update(self.job).where(self.job.c.idtin == int(key)).values(**values))
