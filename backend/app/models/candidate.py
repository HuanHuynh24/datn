"""ERD mappings: unresolved nullable/default decisions block schema DDL."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
)

from app.models.base import Base, erd_column


class HoSoCV(Base):
    __table__ = Table(
        "hosocv",
        Base.metadata,
        erd_column(
            "idcv", BigInteger(), nullable=False, primary_key=True, decision_id="E7_hosocv_idcv"
        ),
        erd_column(
            "idungvien",
            BigInteger(),
            ForeignKey(
                "hosoungvien.idungvien",
                name="fk_hosocv_idungvien",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E7_hosocv_idungvien",
        ),
        erd_column("duongdantep", String(500), nullable=False, decision_id="E7_hosocv_duongdantep"),
        erd_column("cvchinh", Boolean(), nullable=False, decision_id="E7_hosocv_cvchinh"),
        erd_column("trangthai", String(30), nullable=False, decision_id="E7_hosocv_trangthai"),
        erd_column("thoigiantao", DateTime(), nullable=False, decision_id="E7_hosocv_thoigiantao"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


class UngVienKyNang(Base):
    __table__ = Table(
        "ungvienkynang",
        Base.metadata,
        erd_column(
            "idungvien",
            BigInteger(),
            ForeignKey("hosoungvien.idungvien", name="fk_ungvienkynang_idungvien"),
            nullable=False,
            primary_key=True,
        ),
        erd_column(
            "idkynang",
            BigInteger(),
            ForeignKey("kynang.idkynang", name="fk_ungvienkynang_idkynang"),
            nullable=False,
            primary_key=True,
        ),
        erd_column("mucdothanhthao", String(60), nullable=None),
        erd_column("nguoncapnhat", String(60), nullable=None),
        erd_column("thoigiancapnhat", DateTime(), nullable=None),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )


class DonUngTuyen(Base):
    __table__ = Table(
        "donungtuyen",
        Base.metadata,
        erd_column(
            "iddon",
            BigInteger(),
            nullable=False,
            primary_key=True,
            decision_id="E7_donungtuyen_iddon",
        ),
        erd_column(
            "idungvien",
            BigInteger(),
            ForeignKey(
                "hosoungvien.idungvien",
                name="fk_donungtuyen_idungvien",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E7_donungtuyen_idungvien",
        ),
        erd_column(
            "idtin",
            BigInteger(),
            ForeignKey(
                "tintuyendung.idtin",
                name="fk_donungtuyen_idtin",
                ondelete="RESTRICT",
                onupdate="RESTRICT",
            ),
            nullable=False,
            decision_id="E7_donungtuyen_idtin",
        ),
        erd_column(
            "idcv",
            BigInteger(),
            ForeignKey(
                "hosocv.idcv", name="fk_donungtuyen_idcv", ondelete="RESTRICT", onupdate="RESTRICT"
            ),
            nullable=True,
            decision_id="E7_donungtuyen_idcv",
        ),
        erd_column(
            "duongdanbanluucv",
            String(500),
            nullable=True,
            decision_id="E7_donungtuyen_duongdanbanluucv",
        ),
        erd_column("thugiothieu", Text(), nullable=True, decision_id="E7_donungtuyen_thugiothieu"),
        erd_column("trangthai", String(40), nullable=False, decision_id="E7_donungtuyen_trangthai"),
        erd_column(
            "thoigiannop", DateTime(), nullable=False, decision_id="E7_donungtuyen_thoigiannop"
        ),
        erd_column(
            "thoigiancapnhat",
            DateTime(),
            nullable=False,
            decision_id="E7_donungtuyen_thoigiancapnhat",
        ),
        UniqueConstraint("idungvien", "idtin", name="uq_donungtuyen_idungvien_idtin"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
