from sqlalchemy import BigInteger, Boolean, DateTime, String, column, select, table
from sqlalchemy.orm import Session

from app.auth.accounts import AccountSnapshot
from app.auth.schemas import validate_account_id

# Lightweight query expressions, not Table/MetaData/ORM declarations. These cannot
# emit CREATE TABLE or assign nullable/default/PK/enum choices to an existing DB.
accounts = table(
    "taikhoan",
    column("idtaikhoan", BigInteger),
    column("email", String(255)),
    column("matkhaubam", String(255)),
    column("vaitro", String(30)),
    column("trangthai", String(30)),
    column("daxacthucemail", Boolean),
    column("khoaden", DateTime),
)
candidates = table("hosoungvien", column("idungvien", BigInteger), column("idtaikhoan", BigInteger))
members = table(
    "thanhviendoanhnghiep",
    column("idtaikhoan", BigInteger),
    column("iddoanhnghiep", BigInteger),
    column("trangthai", String(30)),
    column("chucvunoibo", String(100)),
)
companies = table(
    "doanhnghiep", column("iddoanhnghiep", BigInteger), column("trangthaiduyet", String(30))
)


def account_projection():
    joined = (
        accounts.outerjoin(candidates, candidates.c.idtaikhoan == accounts.c.idtaikhoan)
        .outerjoin(members, members.c.idtaikhoan == accounts.c.idtaikhoan)
        .outerjoin(companies, companies.c.iddoanhnghiep == members.c.iddoanhnghiep)
    )
    return select(
        accounts.c.idtaikhoan.label("account_id"),
        accounts.c.email,
        accounts.c.matkhaubam.label("password_hash"),
        accounts.c.vaitro.label("role"),
        accounts.c.trangthai.label("status"),
        accounts.c.daxacthucemail.label("email_verified"),
        accounts.c.khoaden.label("locked_until"),
        candidates.c.idungvien.label("candidate_id"),
        members.c.iddoanhnghiep.label("member_company_id"),
        members.c.trangthai.label("member_status"),
        members.c.chucvunoibo.label("member_title"),
        companies.c.iddoanhnghiep.label("company_id"),
        companies.c.trangthaiduyet.label("company_approval_status"),
    ).select_from(joined)


class SqlAlchemyAccountReader:
    """Read-only account lookup. The owning service controls session/transaction."""

    def __init__(self, session: Session):
        self.session = session

    def by_email(self, email: str) -> AccountSnapshot | None:
        return self._read(account_projection().where(accounts.c.email == email))

    def by_id(self, account_id: str) -> AccountSnapshot | None:
        validate_account_id(account_id)
        return self._read(account_projection().where(accounts.c.idtaikhoan == int(account_id)))

    def _read(self, statement) -> AccountSnapshot | None:
        row = self.session.execute(statement).mappings().one_or_none()
        if row is None:
            return None
        values = dict(row)
        for key in ("account_id", "candidate_id", "member_company_id", "company_id"):
            if values[key] is not None:
                values[key] = validate_account_id(str(values[key]))
        return AccountSnapshot(**values)
