"""Explicit local Development fixture import. Never imported by FastAPI startup.

Source provenance remains synthetic. The caller owns target checks, backup,
credentials and transaction. No DDL, UPDATE, DELETE or implicit commits.
"""

import hashlib
import re
import unicodedata
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.core.passwords import hash_password
from app.models import Base

PROVINCES = (
    "Hà Nội",
    "Hồ Chí Minh",
    "Đà Nẵng",
    "Lạng Sơn",
    "Phú Thọ",
    "Thái Nguyên",
    "Đồng Nai",
    "Cần Thơ",
    "Bà Rịa - Vũng Tàu",
    "Bình Dương",
    "Tây Ninh",
    "Bình Phước",
    "Long An",
    "Hải Phòng",
    "Bắc Ninh",
    "Gia Lai",
    "Thanh Hóa",
    "Vĩnh Phúc",
)
NOTICE = "Dữ liệu mẫu nhập vào MySQL Development, chưa xác minh ngoài thực tế."


def stable_key(value):
    normalized = " ".join(unicodedata.normalize("NFKC", value).casefold().split())
    return hashlib.sha256(normalized.encode()).hexdigest()[:20]


def primary_province(location, fallback=None):
    # Preserve all source locations in street/description; single FK uses first mention.
    text = location.casefold()
    matches = [(text.index(name.casefold()), name) for name in PROVINCES if name.casefold() in text]
    if matches:
        name = min(matches)[1]
        return "Thành phố Hồ Chí Minh" if name == "Hồ Chí Minh" else name
    if text == "remote" and fallback:
        return primary_province(fallback)
    raise ValueError("Source location cannot be mapped without invention")


def vnd_salary(raw):
    # Currency-less MySQL salary fields must never contain USD numbers.
    if raw.get("currency") == "VND":
        return Decimal(str(raw["salaryMin"])), Decimal(str(raw["salaryMax"]))
    text = raw.get("salary", "").casefold()
    if "triệu" not in text or "usd" in text:
        return None, None
    numbers = [
        Decimal(n.replace(",", ".")) * 1_000_000 for n in re.findall(r"\d+(?:[.,]\d+)?", text)
    ]
    if len(numbers) == 2 and numbers[0] <= numbers[1]:
        return tuple(numbers)
    return None, None


def build_plan(manifest):
    if manifest.get("version") != 1 or manifest.get("target_database") != "recruitment_db":
        raise ValueError("Unexpected manifest")
    fixtures, reference = manifest["fixtures"], manifest["reference"]
    companies = {}
    for source in [*fixtures["companies"], *reference["companies"]]:
        key = stable_key(source["name"])
        companies.setdefault(key, source)
    for job in reference["jobs"]:
        companies.setdefault(
            stable_key(job["company"]),
            {"name": job["company"], "location": job["location"], "logo": job.get("logo")},
        )
    planned_companies = []
    for key, company in sorted(companies.items()):
        logo = company.get("logoImage") or company.get("logo", "")
        logo = (
            "http://localhost:3000" + logo
            if logo.startswith("/images/") and ".." not in logo
            else None
        )
        planned_companies.append(
            {
                "key": key,
                "name": company["name"],
                "location": company.get("location") or None,
                "industry": company.get("industry"),
                "size": company.get("size"),
                "introduction": NOTICE
                + "\n"
                + (company.get("description") or company.get("hiring") or ""),
                "logo": logo,
            }
        )
    jobs = []
    for index, source in enumerate([*fixtures["jobs"], *reference["jobs"]]):
        legacy = index < len(fixtures["jobs"])
        company = source["company"] if legacy else companies[stable_key(source["company"])]
        name = company["name"]
        location = source["location"]
        minimum, maximum = vnd_salary(source)
        marker = stable_key(name + "\n" + source["title"] + "\n" + location)
        original_salary = (
            f"{source['salaryMin']}–{source['salaryMax']} {source['currency']}"
            if legacy
            else source.get("salary", "")
        )
        description = (
            f"[DEV-SOURCE:{marker}]\n{NOTICE}\nĐịa điểm gốc: {location}\n"
            f"Lương trong nguồn: {original_salary}\n"
        )
        description += source.get(
            "description",
            "Thông tin tham chiếu giao diện; liên hệ nhà tuyển dụng để xác nhận yêu cầu thực tế.",
        )
        for field, label in [("responsibilities", "Công việc"), ("benefits", "Quyền lợi")]:
            if source.get(field):
                description += "\n" + label + ":\n" + "\n".join(source[field])
        jobs.append(
            {
                "key": marker,
                "company_key": stable_key(name),
                "title": source["title"],
                "province": primary_province(location, company.get("location")),
                "street": location,
                "industry": source.get("category", "Chưa phân loại (DEV)"),
                "minimum_salary": str(minimum) if minimum is not None else None,
                "maximum_salary": str(maximum) if maximum is not None else None,
                "description": description,
                "requirements": "\n".join(source.get("requirements", []))
                or "Yêu cầu chi tiết chưa có trong nguồn dữ liệu; cần xác nhận với nhà tuyển dụng.",
                "skills": source.get("skills", []),
                "level": source.get("level"),
                "work_type": "Remote" if location == "Remote" else source.get("workType"),
            }
        )
    candidates = [
        {
            "key": stable_key("candidate:" + c["id"]),
            "name": c["name"],
            "location": c["location"],
            "province": primary_province(c["location"]),
            "introduction": NOTICE + "\n" + c["about"],
            "education": [c["education"]],
            "experience": [f"{c['experience']} năm kinh nghiệm — dữ liệu hồ sơ mẫu"],
            "desired_position": c["role"],
        }
        for c in fixtures["candidates"]
    ]
    industries = (
        {c["name"] for c in fixtures["categories"]}
        | {c["label"] for c in reference["categories"]}
        | {j["industry"] for j in jobs}
    )
    skills = {s for j in jobs for s in j["skills"]} | {
        s for c in fixtures["candidates"] for s in c["skills"]
    }
    return {
        "companies": planned_companies,
        "jobs": jobs,
        "candidates": candidates,
        "industries": sorted(industries),
        "skills": sorted(skills),
        "provinces": sorted({j["province"] for j in jobs} | {c["province"] for c in candidates}),
        "source_sha256": manifest["source_sha256"],
    }


def seed(connection, plan, credentials):
    """Only insert missing, identifiable source records; refuse existing conflicts."""
    tables = Base.metadata.tables
    now = datetime.now(UTC).replace(tzinfo=None)
    counts, ids = {}, {}

    def add(table, values):
        result = connection.execute(table.insert().values(**values))
        counts[table.name] = counts.get(table.name, 0) + 1
        return result.inserted_primary_key[0]

    def catalog(table_name, field, names):
        table = tables[table_name]
        result = {}
        for name in names:
            rows = (
                connection.execute(select(table).where(table.c[field] == name).with_for_update())
                .mappings()
                .all()
            )
            if (
                len(rows) > 1
                or rows
                and "trangthai" in table.c
                and rows[0]["trangthai"] != "ACTIVE"
            ):
                raise ValueError("Ambiguous/inactive existing catalog; no overwrite")
            data = {field: name}
            if "trangthai" in table.c:
                data["trangthai"] = "ACTIVE"
            result[name] = rows[0][next(iter(table.primary_key)).name] if rows else add(table, data)
        return result

    account, company, member, profile, job = [
        tables[n]
        for n in ["taikhoan", "doanhnghiep", "thanhviendoanhnghiep", "hosoungvien", "tintuyendung"]
    ]
    admin = (
        connection.execute(
            select(account.c.idtaikhoan)
            .where(account.c.vaitro == "ADMIN", account.c.trangthai == "ACTIVE")
            .order_by(account.c.idtaikhoan)
        )
        .scalars()
        .first()
    )
    package = (
        connection.execute(
            select(tables["goidoanhnghiep"])
            .where(tables["goidoanhnghiep"].c.magoi == "FREE")
            .with_for_update()
        )
        .mappings()
        .one()
    )
    if admin is None or package["sotaikhoantoida"] != 1 or package["giathang"] != 0:
        raise ValueError("Expected active Admin and approved FREE package")
    industry_ids = catalog("nganhnghe", "tennganhnghe", plan["industries"])
    skill_ids = catalog("kynang", "tenkynang", plan["skills"])
    province_ids = catalog("tinhthanh", "tentinhthanh", plan["provinces"])

    def create_account(key, name, role):
        email = f"dev-{key}@example.com"
        if connection.scalar(select(account.c.idtaikhoan).where(account.c.email == email)):
            raise ValueError("Existing account without matching import aggregate")
        return add(
            account,
            {
                "email": email,
                "matkhaubam": hash_password(credentials[key]),
                "hovaten": name,
                "vaitro": role,
                "trangthai": "ACTIVE",
                "thoigiantao": now,
            },
        )

    for item in plan["companies"]:
        key = item["key"]
        tax = "DEV-" + key
        existing = (
            connection.execute(select(company).where(company.c.masothue == tax).with_for_update())
            .mappings()
            .one_or_none()
        )
        if existing:
            members = (
                connection.execute(
                    select(member).where(member.c.iddoanhnghiep == existing["iddoanhnghiep"])
                )
                .mappings()
                .all()
            )
            if existing["tencongty"] != item["name"] or len(members) != 1:
                raise ValueError("Imported company edited; do not overwrite")
            owner = members[0]
            email = connection.scalar(
                select(account.c.email).where(account.c.idtaikhoan == owner["idtaikhoan"])
            )
            if (
                email != f"dev-{key}@example.com"
                or owner["chucvunoibo"] != "OWNER"
                or owner["trangthai"] != "ACTIVE"
                or existing["trangthaiduyet"] != "APPROVED"
            ):
                raise ValueError("Imported company ownership/status changed")
            ids[key] = (existing["iddoanhnghiep"], owner["idtaikhoan"])
            continue
        if connection.scalar(
            select(company.c.iddoanhnghiep).where(company.c.tencongty == item["name"])
        ):
            raise ValueError("Existing real company name collision; do not attach demo data")
        owner = create_account(key, "DEV OWNER — " + item["name"][:230], "COMPANY_MEMBER")
        company_id = add(
            company,
            {
                "idgoi": package["idgoi"],
                "tencongty": item["name"],
                "masothue": tax,
                "linhvuc": item["industry"],
                "quymo": item["size"],
                "diachi": item["location"],
                "logo": item["logo"],
                "gioithieu": item["introduction"],
                "trangthaiduyet": "APPROVED",
                "thoigiantao": now,
                "ngaybatdaugoi": now.date(),
            },
        )
        add(
            member,
            {
                "idtaikhoan": owner,
                "iddoanhnghiep": company_id,
                "chucvunoibo": "OWNER",
                "trangthai": "ACTIVE",
                "thoigianthem": now,
            },
        )
        ids[key] = (company_id, owner)
    for item in plan["candidates"]:
        key = item["key"]
        existing = (
            connection.execute(select(account).where(account.c.email == f"dev-{key}@example.com"))
            .mappings()
            .one_or_none()
        )
        if existing:
            if (
                existing["vaitro"] != "CANDIDATE"
                or connection.scalar(
                    select(profile.c.idungvien).where(
                        profile.c.idtaikhoan == existing["idtaikhoan"]
                    )
                )
                is None
            ):
                raise ValueError("Candidate aggregate mismatch")
            continue
        account_id = create_account(key, item["name"], "CANDIDATE")
        add(
            profile,
            {
                "idtaikhoan": account_id,
                "diachi": item["location"],
                "idtinhthanh": province_ids[item["province"]],
                "gioithieu": item["introduction"],
                "hocvan": item["education"],
                "kinhnghiem": item["experience"],
                "vitrimongmuon": item["desired_position"],
                "thoigiancapnhat": now,
            },
        )
    for item in plan["jobs"]:
        company_id, poster = ids[item["company_key"]]
        marker = f"[DEV-SOURCE:{item['key']}]"
        existing = (
            connection.execute(
                select(job).where(job.c.iddoanhnghiep == company_id, job.c.mota.startswith(marker))
            )
            .mappings()
            .all()
        )
        if existing:
            if len(existing) != 1 or existing[0]["tieude"] != item["title"]:
                raise ValueError("Imported job changed; no overwrite")
            continue
        if connection.scalar(
            select(job.c.idtin).where(
                job.c.iddoanhnghiep == company_id, job.c.tieude == item["title"]
            )
        ):
            raise ValueError("Existing job title collision")
        job_id = add(
            job,
            {
                "iddoanhnghiep": company_id,
                "idnguoidang": poster,
                "tieude": item["title"],
                "trangthai": "APPROVED",
                "thoigiantao": now,
                "mota": item["description"],
                "yeucau": item["requirements"],
                "idnganhnghe": industry_ids[item["industry"]],
                "idtinhthanh": province_ids[item["province"]],
                "tenduong": item["street"],
                "capbac": item["level"],
                "luongtoithieu": Decimal(item["minimum_salary"])
                if item["minimum_salary"]
                else None,
                "luongtoida": Decimal(item["maximum_salary"]) if item["maximum_salary"] else None,
                "hinhthuclamviec": item["work_type"],
                "idnguoiduyet": admin,
                "thoigianduyet": now,
            },
        )
        for skill in dict.fromkeys(item["skills"]):
            add(
                tables["kynangtin"],
                {"idtin": job_id, "idkynang": skill_ids[skill], "batbuoc": False, "mucdouutien": 0},
            )
    return {
        "inserted": counts,
        "companies": {key: value[0] for key, value in ids.items()},
        "updated_rows": 0,
        "deleted_rows": 0,
    }
