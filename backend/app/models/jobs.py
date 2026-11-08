"""ERD mappings: unresolved nullable/default decisions block schema DDL."""

from sqlalchemy import (
    DECIMAL,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)

from app.models.base import Base, erd_column


class TinTuyenDung(Base):
    __table__ = Table(
        "tintuyendung",
        Base.metadata,
        erd_column(
            "idtin",
            BigInteger(),
            nullable=False,
            primary_key=True,
            decision_id="E6_tintuyendung_idtin",
        ),
        erd_column(
            "iddoanhnghiep",
            BigInteger(),
            ForeignKey(
                "doanhnghiep.iddoanhnghiep",
                name="fk_tintuyendung_iddoanhnghiep",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E6_tintuyendung_iddoanhnghiep",
        ),
        erd_column(
            "idnguoidang",
            BigInteger(),
            ForeignKey(
                "thanhviendoanhnghiep.idtaikhoan",
                name="fk_tintuyendung_idnguoidang",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E6_tintuyendung_idnguoidang",
        ),
        erd_column(
            "trangthai", String(30), nullable=False, decision_id="E6_tintuyendung_trangthai"
        ),
        erd_column(
            "thoigiantao", DateTime(), nullable=False, decision_id="E6_tintuyendung_thoigiantao"
        ),
        erd_column(
            "thoigiandong", DateTime(), nullable=True, decision_id="E6_tintuyendung_thoigiandong"
        ),
        erd_column("tieude", String(255), nullable=False, decision_id="E6_tintuyendung_tieude"),
        erd_column("mota", Text(), nullable=True, decision_id="E6_tintuyendung_mota"),
        erd_column("yeucau", Text(), nullable=True, decision_id="E6_tintuyendung_yeucau"),
        erd_column(
            "idnganhnghe",
            BigInteger(),
            ForeignKey(
                "nganhnghe.idnganhnghe",
                name="fk_tintuyendung_idnganhnghe",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E6_tintuyendung_idnganhnghe",
        ),
        erd_column(
            "idtinhthanh",
            BigInteger(),
            ForeignKey(
                "tinhthanh.idtinhthanh",
                name="fk_tintuyendung_idtinhthanh",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E6_tintuyendung_idtinhthanh",
        ),
        erd_column(
            "idxaphuong",
            BigInteger(),
            ForeignKey(
                "xaphuong.idxaphuong",
                name="fk_tintuyendung_idxaphuong",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=True,
            decision_id="E6_tintuyendung_idxaphuong",
        ),
        erd_column("tenduong", String(255), nullable=True, decision_id="E6_tintuyendung_tenduong"),
        erd_column("capbac", String(100), nullable=True, decision_id="E6_tintuyendung_capbac"),
        erd_column(
            "luongtoithieu",
            DECIMAL(15, 2),
            nullable=True,
            decision_id="E6_tintuyendung_luongtoithieu",
        ),
        erd_column(
            "luongtoida", DECIMAL(15, 2), nullable=True, decision_id="E6_tintuyendung_luongtoida"
        ),
        erd_column(
            "namkinhnghiem",
            DECIMAL(4, 1),
            nullable=True,
            decision_id="E6_tintuyendung_namkinhnghiem",
        ),
        erd_column(
            "hinhthuclamviec",
            String(60),
            nullable=True,
            decision_id="E6_tintuyendung_hinhthuclamviec",
        ),
        erd_column("hannophoso", Date(), nullable=True, decision_id="E6_tintuyendung_hannophoso"),
        erd_column(
            "idnguoiduyet",
            BigInteger(),
            ForeignKey(
                "taikhoan.idtaikhoan",
                name="fk_tintuyendung_idnguoiduyet",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=True,
            decision_id="E6_tintuyendung_idnguoiduyet",
        ),
        erd_column("lydotuchoi", Text(), nullable=True, decision_id="E6_tintuyendung_lydotuchoi"),
        erd_column(
            "thoigianduyet", DateTime(), nullable=True, decision_id="E6_tintuyendung_thoigianduyet"
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class KyNangTin(Base):
    __table__ = Table(
        "kynangtin",
        Base.metadata,
        erd_column(
            "idtin",
            BigInteger(),
            ForeignKey(
                "tintuyendung.idtin",
                name="fk_kynangtin_idtin",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            primary_key=True,
            decision_id="E6_kynangtin_idtin",
        ),
        erd_column(
            "idkynang",
            BigInteger(),
            ForeignKey(
                "kynang.idkynang",
                name="fk_kynangtin_idkynang",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            primary_key=True,
            decision_id="E6_kynangtin_idkynang",
        ),
        erd_column("batbuoc", Boolean(), nullable=False, decision_id="E6_kynangtin_batbuoc"),
        erd_column(
            "mucdouutien", Integer(), nullable=False, decision_id="E6_kynangtin_mucdouutien"
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
