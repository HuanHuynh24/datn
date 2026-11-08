"""ERD mappings: unresolved nullable/default decisions block schema DDL."""

from sqlalchemy import JSON, BigInteger, ForeignKey, String, Table, Text

from app.models.base import Base, erd_column


class NganhNghe(Base):
    __table__ = Table(
        "nganhnghe",
        Base.metadata,
        erd_column(
            "idnganhnghe",
            BigInteger(),
            nullable=False,
            primary_key=True,
            decision_id="E6_nganhnghe_idnganhnghe",
        ),
        erd_column(
            "tennganhnghe",
            String(150),
            nullable=False,
            unique=True,
            decision_id="E6_nganhnghe_tennganhnghe",
        ),
        erd_column("hinhanh", String(500), nullable=True, decision_id="E6_nganhnghe_hinhanh"),
        erd_column("trangthai", String(30), nullable=False, decision_id="E6_nganhnghe_trangthai"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class TinhThanh(Base):
    __table__ = Table(
        "tinhthanh",
        Base.metadata,
        erd_column(
            "idtinhthanh", BigInteger(), nullable=False, primary_key=True, decision_id="A53"
        ),
        erd_column("tentinhthanh", String(150), nullable=False, decision_id="A54"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class XaPhuong(Base):
    __table__ = Table(
        "xaphuong",
        Base.metadata,
        erd_column(
            "idxaphuong",
            BigInteger(),
            nullable=False,
            primary_key=True,
            decision_id="E6_xaphuong_idxaphuong",
        ),
        erd_column(
            "idtinhthanh",
            BigInteger(),
            ForeignKey(
                "tinhthanh.idtinhthanh",
                name="fk_xaphuong_idtinhthanh",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E6_xaphuong_idtinhthanh",
        ),
        erd_column(
            "tenxaphuong", String(150), nullable=False, decision_id="E6_xaphuong_tenxaphuong"
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class KyNang(Base):
    __table__ = Table(
        "kynang",
        Base.metadata,
        erd_column(
            "idkynang",
            BigInteger(),
            nullable=False,
            primary_key=True,
            decision_id="E6_kynang_idkynang",
        ),
        erd_column(
            "tenkynang", String(120), nullable=False, unique=True, decision_id="E6_kynang_tenkynang"
        ),
        erd_column("trangthai", String(30), nullable=False, decision_id="E6_kynang_trangthai"),
        erd_column("mota", Text(), nullable=True, decision_id="E6_kynang_mota"),
        erd_column("tudongnghia", JSON(), nullable=True, decision_id="E6_kynang_tudongnghia"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
