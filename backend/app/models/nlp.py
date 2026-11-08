"""ERD mappings: unresolved nullable/default decisions block schema DDL."""

from sqlalchemy import DECIMAL, JSON, BigInteger, Boolean, DateTime, ForeignKey, String, Table, Text

from app.models.base import Base, erd_column


class KetQuaMatching(Base):
    __table__ = Table(
        "ketquamatching",
        Base.metadata,
        erd_column("idmatching", BigInteger(), nullable=False, primary_key=True),
        erd_column(
            "idcv",
            BigInteger(),
            ForeignKey("hosocv.idcv", name="fk_ketquamatching_idcv"),
            nullable=False,
        ),
        erd_column(
            "idtin",
            BigInteger(),
            ForeignKey("tintuyendung.idtin", name="fk_ketquamatching_idtin"),
            nullable=False,
        ),
        erd_column("diemtong", DECIMAL(5, 2), nullable=None),
        erd_column("diemkynang", DECIMAL(5, 2), nullable=None),
        erd_column("diemkinhnghiem", DECIMAL(5, 2), nullable=None),
        erd_column("diemhocvan", DECIMAL(5, 2), nullable=None),
        erd_column("diemvitri", DECIMAL(5, 2), nullable=None),
        erd_column("thieudulieu", Boolean(), nullable=None),
        erd_column("lydogiaithich", Text(), nullable=None),
        erd_column("thoigiantinh", DateTime(), nullable=None),
        erd_column("chitietkynang", JSON(), nullable=None),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )


class LanTrichXuat(Base):
    __table__ = Table(
        "lantrichxuat",
        Base.metadata,
        erd_column("idlantrichxuat", BigInteger(), nullable=False, primary_key=True),
        erd_column(
            "idcv",
            BigInteger(),
            ForeignKey("hosocv.idcv", name="fk_lantrichxuat_idcv"),
            nullable=False,
        ),
        erd_column("trangthai", String(30), nullable=None),
        erd_column("noidungtho", Text(), nullable=True),
        erd_column("thoigianbatdau", DateTime(), nullable=None),
        erd_column("thoigianketthuc", DateTime(), nullable=True),
        erd_column("thongbaoloi", Text(), nullable=True),
        erd_column("daxacnhan", Boolean(), nullable=None),
        erd_column("thoigianxacnhan", DateTime(), nullable=True),
        erd_column("dulieutrichxuat", JSON(), nullable=None),
        erd_column("dulieudachinh", JSON(), nullable=True),
        erd_column("truongcankiemtra", JSON(), nullable=None),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
