"""Five Auth models with the approved E3b schema; no database application."""

from sqlalchemy import (
    DECIMAL,
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    text,
)
from sqlalchemy.orm import validates

from app.auth.schemas import (
    AccountStatus,
    CompanyApprovalStatus,
    ConfirmedSystemRole,
    InternalCompanyRole,
    MemberStatus,
)
from app.models.base import Base, erd_column


class TaiKhoan(Base):
    __table__ = Table(
        "taikhoan",
        Base.metadata,
        erd_column("idtaikhoan", BigInteger(), nullable=False, primary_key=True, decision_id="A01"),
        erd_column("vaitro", String(30), nullable=False, decision_id="A02"),
        erd_column(
            "email",
            String(255, collation="utf8mb4_0900_as_ci"),
            nullable=False,
            unique=True,
            decision_id="A03",
        ),
        erd_column("matkhaubam", String(255), nullable=False, decision_id="A04"),
        erd_column("hovaten", String(255), nullable=False, decision_id="A05"),
        erd_column("trangthai", String(30), nullable=False, decision_id="A06"),
        erd_column(
            "daxacthucemail", Boolean(), nullable=False, decision_id="A07", server_default=text("0")
        ),
        erd_column(
            "solandangsai", Integer(), nullable=False, decision_id="A08", server_default=text("0")
        ),
        erd_column("khoaden", DateTime(), nullable=True, decision_id="A09"),
        erd_column(
            "nhanemail", Boolean(), nullable=False, decision_id="A10", server_default=text("0")
        ),
        erd_column("thoigiantao", DateTime(), nullable=False, decision_id="A11"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )

    @validates("vaitro", "trangthai")
    def validate_code(self, key, value):
        code_types = {"vaitro": ConfirmedSystemRole, "trangthai": AccountStatus}
        return code_types[key](value).value


class HoSoUngVien(Base):
    __table__ = Table(
        "hosoungvien",
        Base.metadata,
        erd_column("idungvien", BigInteger(), nullable=False, primary_key=True, decision_id="A12"),
        erd_column(
            "idtaikhoan",
            BigInteger(),
            ForeignKey(
                "taikhoan.idtaikhoan",
                name="fk_hosoungvien_idtaikhoan",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            unique=True,
            decision_id="A13",
        ),
        erd_column("sodienthoai", String(20), nullable=True, decision_id="A14"),
        erd_column("diachi", String(255), nullable=True, decision_id="A15"),
        erd_column("gioithieu", Text(), nullable=True, decision_id="A16"),
        erd_column("anhdaidien", String(500), nullable=True, decision_id="A17"),
        erd_column(
            "congkhaihoso", Boolean(), nullable=False, decision_id="A18", server_default=text("0")
        ),
        erd_column("thoigiancapnhat", DateTime(), nullable=False, decision_id="A19"),
        erd_column("hocvan", JSON(), nullable=True, decision_id="A20"),
        erd_column("kinhnghiem", JSON(), nullable=True, decision_id="A21"),
        erd_column("vitrimongmuon", String(255), nullable=True, decision_id="A22"),
        erd_column(
            "idtinhthanh",
            BigInteger(),
            ForeignKey(
                "tinhthanh.idtinhthanh",
                name="fk_hosoungvien_idtinhthanh",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=True,
            decision_id="A23",
        ),
        erd_column("luongmongmuontoithieu", DECIMAL(15, 2), nullable=True, decision_id="A24"),
        erd_column("luongmongmuontoida", DECIMAL(15, 2), nullable=True, decision_id="A25"),
        erd_column("hinhthuclamviecmongmuon", String(60), nullable=True, decision_id="A26"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class DoanhNghiep(Base):
    __table__ = Table(
        "doanhnghiep",
        Base.metadata,
        erd_column(
            "iddoanhnghiep", BigInteger(), nullable=False, primary_key=True, decision_id="A27"
        ),
        erd_column(
            "idgoi",
            BigInteger(),
            ForeignKey(
                "goidoanhnghiep.idgoi",
                name="fk_doanhnghiep_idgoi",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="A28",
        ),
        erd_column("tencongty", String(255), nullable=False, decision_id="A29"),
        erd_column("masothue", String(30), nullable=False, unique=True, decision_id="A30"),
        erd_column("linhvuc", String(200), nullable=True, decision_id="A31"),
        erd_column("quymo", String(60), nullable=True, decision_id="A32"),
        erd_column("diachi", String(255), nullable=True, decision_id="A33"),
        erd_column("website", String(255), nullable=True, decision_id="A34"),
        erd_column("logo", String(500), nullable=True, decision_id="A35"),
        erd_column("gioithieu", Text(), nullable=True, decision_id="A36"),
        erd_column("trangthaiduyet", String(30), nullable=False, decision_id="A37"),
        erd_column("thoigiantao", DateTime(), nullable=False, decision_id="A38"),
        erd_column("duongdanprofile", String(500), nullable=True, decision_id="A39"),
        erd_column("ngaybatdaugoi", Date(), nullable=True, decision_id="A40"),
        erd_column("ngayhethan", Date(), nullable=True, decision_id="A41"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )

    @validates("trangthaiduyet")
    def validate_code(self, key, value):
        code_types = {"trangthaiduyet": CompanyApprovalStatus}
        return code_types[key](value).value


class ThanhVienDoanhNghiep(Base):
    __table__ = Table(
        "thanhviendoanhnghiep",
        Base.metadata,
        erd_column(
            "iddoanhnghiep",
            BigInteger(),
            ForeignKey(
                "doanhnghiep.iddoanhnghiep",
                name="fk_thanhviendoanhnghiep_iddoanhnghiep",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="A42",
        ),
        erd_column(
            "idtaikhoan",
            BigInteger(),
            ForeignKey(
                "taikhoan.idtaikhoan",
                name="fk_thanhviendoanhnghiep_idtaikhoan",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            primary_key=True,
            decision_id="A43",
        ),
        erd_column("chucvunoibo", String(100), nullable=False, decision_id="A44"),
        erd_column("trangthai", String(30), nullable=False, decision_id="A45"),
        erd_column("thoigianthem", DateTime(), nullable=False, decision_id="A46"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )

    @validates("chucvunoibo", "trangthai")
    def validate_code(self, key, value):
        code_types = {"chucvunoibo": InternalCompanyRole, "trangthai": MemberStatus}
        return code_types[key](value).value


class GoiDoanhNghiep(Base):
    __table__ = Table(
        "goidoanhnghiep",
        Base.metadata,
        erd_column("idgoi", BigInteger(), nullable=False, primary_key=True, decision_id="A47"),
        erd_column("magoi", String(30), nullable=False, unique=True, decision_id="A48"),
        erd_column("tengoi", String(80), nullable=False, decision_id="A49"),
        erd_column("sotaikhoantoida", Integer(), nullable=True, decision_id="A50"),
        erd_column("giathang", DECIMAL(15, 2), nullable=False, decision_id="A51"),
        erd_column("mota", Text(), nullable=True, decision_id="A52"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
