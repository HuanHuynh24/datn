"""Read-only local Development data-quality inventory. Never export credentials or CVs."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROGRAM = r"""
import json, sys
from sqlalchemy import text
from app.core.config import Settings
from app.db.session import build_engine

try:
    s = Settings()
    assert (s.mysql_host, s.mysql_database, s.mysql_user) == (
        "mysql",
        "recruitment_db",
        "recruitment_app",
    )
    engine = build_engine(s)
    with engine.connect() as c:
        c.exec_driver_sql("SET TRANSACTION READ ONLY")
        identity = c.exec_driver_sql(
            ("SELECT DATABASE(),@@server_uuid,CURRENT_USER(),VERSION(),UTC_TIMESTAMP()")
        ).one()
        assert tuple(identity[:3]) == (
            "recruitment_db",
            "e71fb0d9-d68a-11f1-b475-0242ac120002",
            "recruitment_app@%",
        )

        def rows(sql):
            return [dict(r) for r in c.execute(text(sql)).mappings()]

        def count(sql):
            return int(c.execute(text(sql)).scalar_one())

        names = [
            "taikhoan",
            "hosoungvien",
            "doanhnghiep",
            "thanhviendoanhnghiep",
            "goidoanhnghiep",
            "tinhthanh",
            "nganhnghe",
            "xaphuong",
            "kynang",
            "tintuyendung",
            "kynangtin",
            "hosocv",
            "donungtuyen",
        ]
        result = {
            "database": identity[0],
            "mysql_version": identity[3],
            "checked_at_utc": str(identity[4]),
            "target_verified": True,
            "transaction_read_only": True,
            "revision": c.exec_driver_sql("SELECT version_num FROM alembic_version")
            .scalars()
            .all(),
            "counts": {name: count("SELECT COUNT(*) FROM " + name) for name in names},
            "roles": rows(
                (
                    "SELECT vaitro role, trangthai status,COUNT(*) total "
                    "FROM taikhoan GROUP BY vaitro,trangthai"
                )
            ),
            "companies": {},
            "jobs": {},
            "candidates": {},
        }
        checks = {
            "companies": {
                "dev_tax_code": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE masothue LIKE 'DEV-%'"
                ),
                "sample_introduction": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE gioithieu LIKE "
                    "'%chưa xác minh%'"
                ),
                "missing_industry": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE "
                    "NULLIF(TRIM(linhvuc),'') IS NULL"
                ),
                "missing_website": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE "
                    "NULLIF(TRIM(website),'') IS NULL"
                ),
                "missing_logo": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE "
                    "NULLIF(TRIM(logo),'') IS NULL"
                ),
                "localhost_logo": (
                    "SELECT COUNT(*) FROM doanhnghiep WHERE logo LIKE '%localhost%'"
                ),
                "no_jobs": (
                    "SELECT COUNT(*) FROM doanhnghiep d WHERE NOT "
                    "EXISTS(SELECT 1 FROM tintuyendung t WHERE "
                    "t.iddoanhnghiep=d.iddoanhnghiep)"
                ),
            },
            "jobs": {
                "dev_source_marker": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE mota LIKE '%[DEV-SOURCE:%'"
                ),
                "missing_deadline": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE hannophoso IS NULL"
                ),
                "expired_deadline": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE hannophoso < UTC_DATE()"
                ),
                "unclassified": (
                    "SELECT COUNT(*) FROM tintuyendung t JOIN nganhnghe n "
                    "USING(idnganhnghe) WHERE n.tennganhnghe LIKE '%Chưa "
                    "phân loại%'"
                ),
                "missing_work_type": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE "
                    "NULLIF(TRIM(hinhthuclamviec),'') IS NULL"
                ),
                "missing_experience": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE namkinhnghiem IS NULL"
                ),
                "missing_salary": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE luongtoithieu "
                    "IS NULL AND luongtoida IS NULL"
                ),
                "unconfirmed_requirements": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE yeucau LIKE "
                    "'%chưa có trong nguồn%'"
                ),
                "no_skills": (
                    "SELECT COUNT(*) FROM tintuyendung t WHERE NOT "
                    "EXISTS(SELECT 1 FROM kynangtin k WHERE k.idtin=t.idtin)"
                ),
                "invalid_salary_range": (
                    "SELECT COUNT(*) FROM tintuyendung WHERE luongtoithieu>luongtoida"
                ),
                "poster_company_mismatch": (
                    "SELECT COUNT(*) FROM tintuyendung t JOIN "
                    "thanhviendoanhnghiep m ON m.idtaikhoan=t.idnguoidang "
                    "WHERE t.iddoanhnghiep<>m.iddoanhnghiep"
                ),
            },
            "candidates": {
                "sample_introduction": (
                    "SELECT COUNT(*) FROM hosoungvien WHERE gioithieu LIKE "
                    "'%chưa xác minh%'"
                ),
                "example_email_accounts": (
                    "SELECT COUNT(*) FROM hosoungvien h JOIN taikhoan t "
                    "USING(idtaikhoan) WHERE t.email LIKE '%@example.com'"
                ),
                "missing_introduction": (
                    "SELECT COUNT(*) FROM hosoungvien WHERE "
                    "NULLIF(TRIM(gioithieu),'') IS NULL"
                ),
                "no_active_cv": (
                    "SELECT COUNT(*) FROM hosoungvien h WHERE NOT "
                    "EXISTS(SELECT 1 FROM hosocv c WHERE "
                    "c.idungvien=h.idungvien AND c.trangthai='ACTIVE')"
                ),
            },
        }
        for group, queries in checks.items():
            result[group] = {key: count(sql) for key, sql in queries.items()}
        result["company_statuses"] = rows(
            (
                "SELECT trangthaiduyet status,COUNT(*) total FROM "
                "doanhnghiep GROUP BY trangthaiduyet"
            )
        )
        result["job_statuses"] = rows(
            (
                "SELECT trangthai status,COUNT(*) total FROM "
                "tintuyendung GROUP BY trangthai"
            )
        )
        result["industry_distribution"] = rows(
            (
                "SELECT n.tennganhnghe name,COUNT(t.idtin) jobs FROM "
                "nganhnghe n LEFT JOIN tintuyendung t USING(idnganhnghe) "
                "GROUP BY n.idnganhnghe,n.tennganhnghe ORDER BY jobs "
                "DESC,name"
            )
        )
        result["provinces"] = rows(
            ("SELECT tentinhthanh name FROM tinhthanh ORDER BY tentinhthanh")
        )
        result["company_examples"] = rows(
            (
                "SELECT iddoanhnghiep id,tencongty name,linhvuc "
                "industry,CASE WHEN masothue LIKE 'DEV-%' THEN 'DEV "
                "placeholder' ELSE 'NOT VERIFIED by audit' END "
                "tax_provenance FROM doanhnghiep ORDER BY iddoanhnghiep "
                "LIMIT 8"
            )
        )
        result["job_examples"] = rows(
            (
                "SELECT idtin id,tieude title,hinhthuclamviec "
                "work_type,hannophoso deadline FROM tintuyendung ORDER "
                "BY idtin LIMIT 8"
            )
        )
        c.rollback()
    engine.dispose()
    print(json.dumps(result, ensure_ascii=False, default=str))
except Exception as error:
    print(
        json.dumps(
            {
                "status": "STOPPED",
                "error_type": type(error).__name__,
                "raw_error": "SUPPRESSED",
            }
        )
    )
    sys.exit(2)
"""


def main():
    result = subprocess.run(
        ["docker", "compose", "exec", "-T", "backend", "python", "-"],
        input=PROGRAM.encode("utf-8"),
        capture_output=True,
        cwd=ROOT,
        timeout=60,
        check=False,
    )
    if result.returncode:
        raise SystemExit("Read-only audit stopped; raw output suppressed")
    report = json.loads(result.stdout)
    target = ROOT / "docs/reports/data_quality_2026-11-15.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
