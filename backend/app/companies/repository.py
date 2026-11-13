from datetime import datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.jobs.repository import JobRepository
from app.models import DoanhNghiep, GoiDoanhNghiep, TaiKhoan, ThanhVienDoanhNghiep

PACKAGE_COLUMNS = {
    "package_id": "idgoi",
    "code": "magoi",
    "name": "tengoi",
    "member_limit": "sotaikhoantoida",
    "monthly_price": "giathang",
    "description": "mota",
}
COMPANY_COLUMNS = {
    "company_id": "iddoanhnghiep",
    "company_name": "tencongty",
    "tax_code": "masothue",
    "industry": "linhvuc",
    "size": "quymo",
    "address": "diachi",
    "website": "website",
    "logo_url": "logo",
    "introduction": "gioithieu",
    "profile_url": "duongdanprofile",
    "approval_status": "trangthaiduyet",
    "created_at": "thoigiantao",
    "package_started_on": "ngaybatdaugoi",
    "package_expires_on": "ngayhethan",
}


class CompanyRepository:
    def __init__(self, session: Session):
        self.session = session

    def public_query(self):
        company = DoanhNghiep.__table__
        jobs = JobRepository(self.session)
        public_fields = (
            "company_id",
            "company_name",
            "industry",
            "size",
            "address",
            "website",
            "logo_url",
            "introduction",
        )
        count = (
            select(func.count())
            .select_from(jobs.job)
            .where(jobs.job.c.iddoanhnghiep == company.c.iddoanhnghiep, jobs.visible())
            .correlate(company)
            .scalar_subquery()
        )
        return select(
            *(company.c[COMPANY_COLUMNS[key]].label(key) for key in public_fields),
            count.label("open_job_count"),
        ).where(company.c.trangthaiduyet == "APPROVED")

    def public_filters(self):
        company = DoanhNghiep.__table__
        options = {}
        for name, column in [("industries", company.c.linhvuc), ("locations", company.c.diachi)]:
            value = func.trim(column)
            query = (
                select(value)
                .where(
                    company.c.trangthaiduyet == "APPROVED",
                    column.is_not(None),
                    func.length(value) > 0,
                )
                .distinct()
                .order_by(value)
            )
            options[name] = list(self.session.scalars(query).all())
        return options

    def public_listing(self, *, q="", industry=None, location=None, limit=12, offset=0):
        company = DoanhNghiep.__table__
        query = self.public_query()

        def literal_contains(column, value):
            value = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            return column.like("%" + value + "%", escape="\\")

        if q:
            query = query.where(
                or_(
                    *(
                        literal_contains(column, q)
                        for column in (
                            company.c.tencongty,
                            company.c.linhvuc,
                            company.c.diachi,
                        )
                    )
                )
            )
        for column, value in [(company.c.linhvuc, industry), (company.c.diachi, location)]:
            if value:
                query = query.where(literal_contains(column, value))
        total = self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (
            self.session.execute(
                query.order_by(company.c.iddoanhnghiep.desc()).limit(limit).offset(offset)
            )
            .mappings()
            .all()
        )
        return rows, total

    def public_detail(self, company_id: str):
        return (
            self.session.execute(
                self.public_query().where(DoanhNghiep.__table__.c.iddoanhnghiep == int(company_id))
            )
            .mappings()
            .one_or_none()
        )

    def packages(self):
        package = GoiDoanhNghiep.__table__
        return (
            self.session.execute(
                select(
                    *(package.c[column].label(field) for field, column in PACKAGE_COLUMNS.items())
                ).order_by(package.c.idgoi)
            )
            .mappings()
            .all()
        )

    def company_for_member(self, account_id: str, company_id: str):
        company, package, member = (
            DoanhNghiep.__table__,
            GoiDoanhNghiep.__table__,
            ThanhVienDoanhNghiep.__table__,
        )
        return (
            self.session.execute(
                select(
                    *(company.c[column].label(field) for field, column in COMPANY_COLUMNS.items()),
                    select(func.count())
                    .select_from(member)
                    .where(
                        member.c.iddoanhnghiep == company.c.iddoanhnghiep,
                        member.c.trangthai == "ACTIVE",
                    )
                    .correlate(company)
                    .scalar_subquery()
                    .label("active_member_count"),
                    *(
                        package.c[column].label("package_" + field)
                        for field, column in PACKAGE_COLUMNS.items()
                    ),
                )
                .select_from(
                    company.join(package, company.c.idgoi == package.c.idgoi).join(
                        member, member.c.iddoanhnghiep == company.c.iddoanhnghiep
                    )
                )
                .where(
                    member.c.idtaikhoan == int(account_id),
                    member.c.trangthai == "ACTIVE",
                    company.c.iddoanhnghiep == int(company_id),
                )
            )
            .mappings()
            .one_or_none()
        )

    def lock_package(self, package_id: str | int):
        table = GoiDoanhNghiep.__table__
        return (
            self.session.execute(
                select(table).where(table.c.idgoi == int(package_id)).with_for_update()
            )
            .mappings()
            .one_or_none()
        )

    def lock_owner_scope(self, account_id: str, company_id: str):
        company = DoanhNghiep.__table__
        package_id = self.session.scalar(
            select(company.c.idgoi).where(company.c.iddoanhnghiep == int(company_id))
        )
        if package_id is None:
            return None
        # Same order as registration: package -> company -> actor. Package
        # assignment cannot be changed by these APIs.
        package = self.lock_package(package_id)
        current = (
            self.session.execute(
                select(company).where(company.c.iddoanhnghiep == int(company_id)).with_for_update()
            )
            .mappings()
            .one_or_none()
        )
        member, account = ThanhVienDoanhNghiep.__table__, TaiKhoan.__table__
        actor = self.session.execute(
            select(member.c.idtaikhoan)
            .select_from(member.join(account, member.c.idtaikhoan == account.c.idtaikhoan))
            .where(
                member.c.idtaikhoan == int(account_id),
                member.c.iddoanhnghiep == int(company_id),
                member.c.chucvunoibo == "OWNER",
                member.c.trangthai == "ACTIVE",
                account.c.vaitro == "COMPANY_MEMBER",
                account.c.trangthai == "ACTIVE",
            )
            .with_for_update()
        ).scalar_one_or_none()
        if (
            actor is None
            or current is None
            or package is None
            or current["idgoi"] != package["idgoi"]
        ):
            return None
        return package

    def active_member_count_locked(self, company_id: str) -> int:
        table = ThanhVienDoanhNghiep.__table__
        # Locking/current read sees the latest seats after waiting for company
        # lock, including under MySQL REPEATABLE READ; snapshot COUNT is unsafe.
        return len(
            self.session.execute(
                select(table.c.idtaikhoan)
                .where(
                    table.c.iddoanhnghiep == int(company_id),
                    table.c.trangthai == "ACTIVE",
                )
                .with_for_update()
            )
            .scalars()
            .all()
        )

    def create_account(self, email: str, full_name: str, password_hash: str, now: datetime) -> int:
        return self.session.execute(
            TaiKhoan.__table__.insert().values(
                email=email,
                hovaten=full_name,
                matkhaubam=password_hash,
                vaitro="COMPANY_MEMBER",
                trangthai="ACTIVE",
                khoaden=None,
                thoigiantao=now,
            )
        ).inserted_primary_key[0]

    def create_company(self, package_id: str, name: str, tax_code: str, now: datetime) -> int:
        return self.session.execute(
            DoanhNghiep.__table__.insert().values(
                idgoi=int(package_id),
                tencongty=name,
                masothue=tax_code,
                trangthaiduyet="PENDING",
                thoigiantao=now,
                ngaybatdaugoi=now.date(),
                ngayhethan=None,
            )
        ).inserted_primary_key[0]

    def create_member(self, account_id: int, company_id: str | int, role: str, now: datetime):
        self.session.execute(
            ThanhVienDoanhNghiep.__table__.insert().values(
                idtaikhoan=account_id,
                iddoanhnghiep=int(company_id),
                chucvunoibo=role,
                trangthai="ACTIVE",
                thoigianthem=now,
            )
        )

    def update_company(self, company_id: str, values: dict):
        if values:
            self.session.execute(
                update(DoanhNghiep.__table__)
                .where(DoanhNghiep.__table__.c.iddoanhnghiep == int(company_id))
                .values(**{COMPANY_COLUMNS[k]: v for k, v in values.items()})
            )

    def members(self, company_id: str, account_id: str | None = None, *, lock: bool = False):
        member, account = ThanhVienDoanhNghiep.__table__, TaiKhoan.__table__
        query = (
            select(
                member.c.idtaikhoan.label("account_id"),
                account.c.hovaten.label("full_name"),
                account.c.email,
                account.c.trangthai.label("account_status"),
                member.c.chucvunoibo.label("internal_role"),
                member.c.trangthai.label("status"),
                member.c.thoigianthem.label("added_at"),
            )
            .select_from(member.join(account, member.c.idtaikhoan == account.c.idtaikhoan))
            .where(
                member.c.iddoanhnghiep == int(company_id),
                account.c.vaitro == "COMPANY_MEMBER",
            )
        )
        if account_id is not None:
            query = query.where(member.c.idtaikhoan == int(account_id))
        if lock:
            query = query.with_for_update()
        return (
            self.session.execute(query.order_by(member.c.chucvunoibo, member.c.idtaikhoan))
            .mappings()
            .all()
        )

    def update_member(self, company_id: str, account_id: str, status: str):
        self.session.execute(
            update(ThanhVienDoanhNghiep.__table__)
            .where(
                ThanhVienDoanhNghiep.__table__.c.iddoanhnghiep == int(company_id),
                ThanhVienDoanhNghiep.__table__.c.idtaikhoan == int(account_id),
                ThanhVienDoanhNghiep.__table__.c.chucvunoibo == "RECRUITER",
            )
            .values(trangthai=status)
        )
