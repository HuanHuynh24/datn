"""All 16 entities and 23 bidirectional relationships from ERD R2."""

from sqlalchemy.orm import relationship

from app.models.auth import DoanhNghiep, GoiDoanhNghiep, HoSoUngVien, TaiKhoan, ThanhVienDoanhNghiep
from app.models.base import Base
from app.models.candidate import DonUngTuyen, HoSoCV, UngVienKyNang
from app.models.catalog import KyNang, NganhNghe, TinhThanh, XaPhuong
from app.models.jobs import KyNangTin, TinTuyenDung
from app.models.nlp import KetQuaMatching, LanTrichXuat

__all__ = [
    "Base",
    "TaiKhoan",
    "HoSoUngVien",
    "DoanhNghiep",
    "ThanhVienDoanhNghiep",
    "GoiDoanhNghiep",
    "NganhNghe",
    "TinhThanh",
    "XaPhuong",
    "KyNang",
    "TinTuyenDung",
    "KyNangTin",
    "HoSoCV",
    "UngVienKyNang",
    "DonUngTuyen",
    "KetQuaMatching",
    "LanTrichXuat",
]

TinTuyenDung.doanhnghiep = relationship(
    DoanhNghiep,
    foreign_keys=[TinTuyenDung.__table__.c.iddoanhnghiep],
    back_populates="tin_cua_doanh_nghiep",
)
DoanhNghiep.tin_cua_doanh_nghiep = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.iddoanhnghiep],
    back_populates="doanhnghiep",
    uselist=True,
    passive_deletes="all",
)
TinTuyenDung.nguoidang = relationship(
    ThanhVienDoanhNghiep,
    foreign_keys=[TinTuyenDung.__table__.c.idnguoidang],
    back_populates="thanh_vien_dang_tin",
)
ThanhVienDoanhNghiep.thanh_vien_dang_tin = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.idnguoidang],
    back_populates="nguoidang",
    uselist=True,
    passive_deletes="all",
)
TinTuyenDung.nganhnghe = relationship(
    NganhNghe, foreign_keys=[TinTuyenDung.__table__.c.idnganhnghe], back_populates="nganh_cua_tin"
)
NganhNghe.nganh_cua_tin = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.idnganhnghe],
    back_populates="nganhnghe",
    uselist=True,
    passive_deletes="all",
)
TinTuyenDung.tinhthanh = relationship(
    TinhThanh, foreign_keys=[TinTuyenDung.__table__.c.idtinhthanh], back_populates="tinh_tuyen_dung"
)
TinhThanh.tinh_tuyen_dung = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.idtinhthanh],
    back_populates="tinhthanh",
    uselist=True,
    passive_deletes="all",
)
TinTuyenDung.xaphuong = relationship(
    XaPhuong, foreign_keys=[TinTuyenDung.__table__.c.idxaphuong], back_populates="xa_tuyen_dung"
)
XaPhuong.xa_tuyen_dung = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.idxaphuong],
    back_populates="xaphuong",
    uselist=True,
    passive_deletes="all",
)
TinTuyenDung.nguoiduyet = relationship(
    TaiKhoan, foreign_keys=[TinTuyenDung.__table__.c.idnguoiduyet], back_populates="nguoi_duyet"
)
TaiKhoan.nguoi_duyet = relationship(
    TinTuyenDung,
    foreign_keys=[TinTuyenDung.__table__.c.idnguoiduyet],
    back_populates="nguoiduyet",
    uselist=True,
    passive_deletes="all",
)
DoanhNghiep.goi = relationship(
    GoiDoanhNghiep, foreign_keys=[DoanhNghiep.__table__.c.idgoi], back_populates="goi_dich_vu"
)
GoiDoanhNghiep.goi_dich_vu = relationship(
    DoanhNghiep,
    foreign_keys=[DoanhNghiep.__table__.c.idgoi],
    back_populates="goi",
    uselist=True,
    passive_deletes="all",
)
HoSoUngVien.taikhoan = relationship(
    TaiKhoan, foreign_keys=[HoSoUngVien.__table__.c.idtaikhoan], back_populates="hoso_ungvien"
)
TaiKhoan.hoso_ungvien = relationship(
    HoSoUngVien,
    foreign_keys=[HoSoUngVien.__table__.c.idtaikhoan],
    back_populates="taikhoan",
    uselist=False,
    passive_deletes="all",
)
HoSoUngVien.tinhthanh = relationship(
    TinhThanh, foreign_keys=[HoSoUngVien.__table__.c.idtinhthanh], back_populates="tinh_mong_muon"
)
TinhThanh.tinh_mong_muon = relationship(
    HoSoUngVien,
    foreign_keys=[HoSoUngVien.__table__.c.idtinhthanh],
    back_populates="tinhthanh",
    uselist=True,
    passive_deletes="all",
)
UngVienKyNang.ungvien = relationship(
    HoSoUngVien,
    foreign_keys=[UngVienKyNang.__table__.c.idungvien],
    back_populates="ky_nang_ung_vien",
)
HoSoUngVien.ky_nang_ung_vien = relationship(
    UngVienKyNang,
    foreign_keys=[UngVienKyNang.__table__.c.idungvien],
    back_populates="ungvien",
    uselist=True,
    passive_deletes="all",
)
UngVienKyNang.kynang = relationship(
    KyNang, foreign_keys=[UngVienKyNang.__table__.c.idkynang], back_populates="ky_nang_so_huu"
)
KyNang.ky_nang_so_huu = relationship(
    UngVienKyNang,
    foreign_keys=[UngVienKyNang.__table__.c.idkynang],
    back_populates="kynang",
    uselist=True,
    passive_deletes="all",
)
ThanhVienDoanhNghiep.doanhnghiep = relationship(
    DoanhNghiep,
    foreign_keys=[ThanhVienDoanhNghiep.__table__.c.iddoanhnghiep],
    back_populates="thanh_vien_doanh_nghiep",
)
DoanhNghiep.thanh_vien_doanh_nghiep = relationship(
    ThanhVienDoanhNghiep,
    foreign_keys=[ThanhVienDoanhNghiep.__table__.c.iddoanhnghiep],
    back_populates="doanhnghiep",
    uselist=True,
    passive_deletes="all",
)
ThanhVienDoanhNghiep.taikhoan = relationship(
    TaiKhoan,
    foreign_keys=[ThanhVienDoanhNghiep.__table__.c.idtaikhoan],
    back_populates="thanh_vien_theo_vai_tro",
)
TaiKhoan.thanh_vien_theo_vai_tro = relationship(
    ThanhVienDoanhNghiep,
    foreign_keys=[ThanhVienDoanhNghiep.__table__.c.idtaikhoan],
    back_populates="taikhoan",
    uselist=False,
    passive_deletes="all",
)
HoSoCV.ungvien = relationship(
    HoSoUngVien, foreign_keys=[HoSoCV.__table__.c.idungvien], back_populates="cv_ung_vien"
)
HoSoUngVien.cv_ung_vien = relationship(
    HoSoCV,
    foreign_keys=[HoSoCV.__table__.c.idungvien],
    back_populates="ungvien",
    uselist=True,
    passive_deletes="all",
)
XaPhuong.tinhthanh = relationship(
    TinhThanh, foreign_keys=[XaPhuong.__table__.c.idtinhthanh], back_populates="xa_trong_tinh"
)
TinhThanh.xa_trong_tinh = relationship(
    XaPhuong,
    foreign_keys=[XaPhuong.__table__.c.idtinhthanh],
    back_populates="tinhthanh",
    uselist=True,
    passive_deletes="all",
)
DonUngTuyen.ungvien = relationship(
    HoSoUngVien, foreign_keys=[DonUngTuyen.__table__.c.idungvien], back_populates="don_cua_ung_vien"
)
HoSoUngVien.don_cua_ung_vien = relationship(
    DonUngTuyen,
    foreign_keys=[DonUngTuyen.__table__.c.idungvien],
    back_populates="ungvien",
    uselist=True,
    passive_deletes="all",
)
DonUngTuyen.tin = relationship(
    TinTuyenDung, foreign_keys=[DonUngTuyen.__table__.c.idtin], back_populates="don_cua_tin"
)
TinTuyenDung.don_cua_tin = relationship(
    DonUngTuyen,
    foreign_keys=[DonUngTuyen.__table__.c.idtin],
    back_populates="tin",
    uselist=True,
    passive_deletes="all",
)
DonUngTuyen.cv = relationship(
    HoSoCV, foreign_keys=[DonUngTuyen.__table__.c.idcv], back_populates="cv_da_nop"
)
HoSoCV.cv_da_nop = relationship(
    DonUngTuyen,
    foreign_keys=[DonUngTuyen.__table__.c.idcv],
    back_populates="cv",
    uselist=True,
    passive_deletes="all",
)
KetQuaMatching.cv = relationship(
    HoSoCV, foreign_keys=[KetQuaMatching.__table__.c.idcv], back_populates="cv_matching"
)
HoSoCV.cv_matching = relationship(
    KetQuaMatching,
    foreign_keys=[KetQuaMatching.__table__.c.idcv],
    back_populates="cv",
    uselist=True,
    passive_deletes="all",
)
KetQuaMatching.tin = relationship(
    TinTuyenDung, foreign_keys=[KetQuaMatching.__table__.c.idtin], back_populates="tin_matching"
)
TinTuyenDung.tin_matching = relationship(
    KetQuaMatching,
    foreign_keys=[KetQuaMatching.__table__.c.idtin],
    back_populates="tin",
    uselist=True,
    passive_deletes="all",
)
LanTrichXuat.cv = relationship(
    HoSoCV, foreign_keys=[LanTrichXuat.__table__.c.idcv], back_populates="lan_trich_xuat"
)
HoSoCV.lan_trich_xuat = relationship(
    LanTrichXuat,
    foreign_keys=[LanTrichXuat.__table__.c.idcv],
    back_populates="cv",
    uselist=True,
    passive_deletes="all",
)
KyNangTin.tin = relationship(
    TinTuyenDung, foreign_keys=[KyNangTin.__table__.c.idtin], back_populates="ky_nang_tin"
)
TinTuyenDung.ky_nang_tin = relationship(
    KyNangTin,
    foreign_keys=[KyNangTin.__table__.c.idtin],
    back_populates="tin",
    uselist=True,
    passive_deletes="all",
)
KyNangTin.kynang = relationship(
    KyNang, foreign_keys=[KyNangTin.__table__.c.idkynang], back_populates="ky_nang_yeu_cau"
)
KyNang.ky_nang_yeu_cau = relationship(
    KyNangTin,
    foreign_keys=[KyNangTin.__table__.c.idkynang],
    back_populates="kynang",
    uselist=True,
    passive_deletes="all",
)
