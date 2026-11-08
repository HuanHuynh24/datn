from sqlalchemy import func, select

from app.models import DoanhNghiep, DonUngTuyen, HoSoCV, HoSoUngVien, TaiKhoan, TinTuyenDung


class ApplicationRepository:
    def __init__(self, session):
        self.session = session
        self.cv, self.app = HoSoCV.__table__, DonUngTuyen.__table__
        self.job, self.company = TinTuyenDung.__table__, DoanhNghiep.__table__

    def owned_cv(self, candidate_id, key, lock=False, active=True):
        query = select(self.cv).where(
            self.cv.c.idcv == int(key), self.cv.c.idungvien == int(candidate_id)
        )
        if active:
            query = query.where(self.cv.c.trangthai == "ACTIVE")
        if lock:
            query = query.with_for_update()
        return self.session.execute(query).mappings().one_or_none()

    def query(self):
        a, j, c = self.app, self.job, self.company
        p, u = HoSoUngVien.__table__, TaiKhoan.__table__
        return select(
            a,
            j.c.tieude.label("job_title"),
            j.c.iddoanhnghiep,
            c.c.tencongty.label("company_name"),
            u.c.hovaten.label("candidate_name"),
            u.c.email.label("candidate_email"),
        ).select_from(
            a.join(j, a.c.idtin == j.c.idtin)
            .join(c, j.c.iddoanhnghiep == c.c.iddoanhnghiep)
            .join(p, a.c.idungvien == p.c.idungvien)
            .join(u, p.c.idtaikhoan == u.c.idtaikhoan)
        )

    def scoped(self, principal, query):
        if principal.role == "CANDIDATE":
            profile = HoSoUngVien.__table__
            return query.where(
                self.app.c.idungvien.in_(
                    select(profile.c.idungvien).where(
                        profile.c.idtaikhoan == int(principal.account_id)
                    )
                )
            )
        if principal.role == "COMPANY_MEMBER" and principal.company_id is not None:
            return query.where(
                self.app.c.idtin.in_(
                    select(self.job.c.idtin).where(
                        self.job.c.iddoanhnghiep == int(principal.company_id)
                    )
                )
            )
        return query.where(False)

    def detail(self, principal, key):
        return (
            self.session.execute(
                self.scoped(principal, self.query()).where(self.app.c.iddon == int(key))
            )
            .mappings()
            .one_or_none()
        )

    def locked(self, principal, key):
        return (
            self.session.execute(
                self.scoped(principal, select(self.app))
                .where(self.app.c.iddon == int(key))
                .with_for_update()
            )
            .mappings()
            .one_or_none()
        )

    def listing(self, principal, *, status=None, job_id=None, limit=20, offset=0):
        query = self.scoped(principal, self.query())
        if status:
            query = query.where(self.app.c.trangthai == status)
        if job_id:
            query = query.where(self.app.c.idtin == int(job_id))
        total = self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (
            self.session.execute(
                query.order_by(self.app.c.iddon.desc()).limit(limit).offset(offset)
            )
            .mappings()
            .all()
        )
        return rows, total
