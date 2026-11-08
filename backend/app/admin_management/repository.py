from sqlalchemy import func, or_, select, update

from app.models import (
    DoanhNghiep,
    DonUngTuyen,
    GoiDoanhNghiep,
    HoSoCV,
    HoSoUngVien,
    KyNang,
    NganhNghe,
    TaiKhoan,
    TinTuyenDung,
)

TABLES = {
    "accounts": TaiKhoan.__table__,
    "candidates": HoSoUngVien.__table__,
    "companies": DoanhNghiep.__table__,
    "jobs": TinTuyenDung.__table__,
    "industries": NganhNghe.__table__,
    "skills": KyNang.__table__,
    "packages": GoiDoanhNghiep.__table__,
    "applications": DonUngTuyen.__table__,
    "cvs": HoSoCV.__table__,
}


class AdminRepository:
    def __init__(self, session):
        self.session = session

    def query(self, resource):
        t = TABLES[resource]
        pk = next(iter(t.primary_key))
        columns = [pk.label("id")]
        source = t
        fields = {
            "accounts": {
                "hovaten": "name",
                "email": "email",
                "vaitro": "role",
                "trangthai": "status",
                "thoigiantao": "created_at",
            },
            "candidates": {"idtaikhoan": "account_id", "vitrimongmuon": "position"},
            "companies": {
                "tencongty": "name",
                "masothue": "tax_code",
                "trangthaiduyet": "status",
                "thoigiantao": "created_at",
                "gioithieu": "description",
            },
            "jobs": {
                "tieude": "name",
                "trangthai": "status",
                "iddoanhnghiep": "company_id",
                "mota": "description",
                "yeucau": "requirements",
            },
            "industries": {"tennganhnghe": "name", "trangthai": "status"},
            "skills": {"tenkynang": "name", "trangthai": "status"},
            "packages": {
                "tengoi": "name",
                "magoi": "package_code",
                "mota": "description",
                "sotaikhoantoida": "member_limit",
                "giathang": "monthly_price",
            },
        }[resource]
        columns += [t.c[name].label(alias) for name, alias in fields.items()]
        if resource == "candidates":
            account = TABLES["accounts"]
            source = t.join(account, t.c.idtaikhoan == account.c.idtaikhoan)
            columns += [
                account.c.hovaten.label("name"),
                account.c.email.label("email"),
                account.c.trangthai.label("status"),
            ]
        if resource == "jobs":
            company = TABLES["companies"]
            source = t.join(company, t.c.iddoanhnghiep == company.c.iddoanhnghiep)
            columns.append(company.c.tencongty.label("company_name"))
        return select(*columns).select_from(source)

    def listing(self, resource, *, q, status, role, limit, offset):
        view = self.query(resource).subquery()
        query = select(view)
        if q:
            fields = [
                view.c[key]
                for key in ("name", "email", "tax_code", "company_name", "package_code")
                if key in view.c
            ]
            query = query.where(or_(*(field.contains(q, autoescape=True) for field in fields)))
        if status:
            query = query.where(view.c.status == status)
        if role:
            query = query.where(view.c.role == role)
        total = self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (
            self.session.execute(query.order_by(view.c.id.desc()).limit(limit).offset(offset))
            .mappings()
            .all()
        )
        return rows, total

    def detail(self, resource, key):
        table = TABLES[resource]
        return (
            self.session.execute(
                self.query(resource).where(next(iter(table.primary_key)) == int(key))
            )
            .mappings()
            .one_or_none()
        )

    def dashboard(self):
        values = {
            name: self.session.scalar(select(func.count()).select_from(table))
            for name, table in TABLES.items()
        }
        for name, field in [
            ("accounts", "trangthai"),
            ("companies", "trangthaiduyet"),
            ("jobs", "trangthai"),
            ("applications", "trangthai"),
        ]:
            table = TABLES[name]
            values[name + "_by_status"] = dict(
                self.session.execute(
                    select(table.c[field], func.count()).group_by(table.c[field])
                ).all()
            )
        return values

    def lock(self, resource, key):
        table = TABLES[resource]
        return (
            self.session.execute(
                select(table).where(next(iter(table.primary_key)) == int(key)).with_for_update()
            )
            .mappings()
            .one_or_none()
        )

    def update(self, resource, key, values):
        table = TABLES[resource]
        self.session.execute(
            update(table).where(next(iter(table.primary_key)) == int(key)).values(**values)
        )

    def create(self, resource, values):
        return self.session.execute(
            TABLES[resource].insert().values(**values)
        ).inserted_primary_key[0]

    def name_exists(self, resource, column, name, exclude=None):
        table = TABLES[resource]
        query = select(next(iter(table.primary_key))).where(table.c[column] == name)
        if exclude is not None:
            query = query.where(next(iter(table.primary_key)) != int(exclude))
        return self.session.scalar(query) is not None
