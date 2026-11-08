from datetime import UTC, datetime

from sqlalchemy import select

from app.companies.service import CompanyError
from app.jobs.repository import FIELDS, JobRepository
from app.models import KyNang, NganhNghe, TinhThanh, XaPhuong


class JobService:
    def __init__(self, session):
        self.session = session
        self.repo = JobRepository(session)

    def validate(self, values, publish=False, retained=None):
        retained = retained or {}
        minimum, maximum = values.get("minimum_salary"), values.get("maximum_salary")
        if minimum is not None and maximum is not None and minimum > maximum:
            raise CompanyError(422, "Invalid salary range")
        for field, table, pk, active in [
            ("industry_id", NganhNghe.__table__, "idnganhnghe", True),
            ("province_id", TinhThanh.__table__, "idtinhthanh", False),
        ]:
            query = select(table).where(table.c[pk] == int(values[field]))
            if active and str(values[field]) != str(retained.get(field)):
                query = query.where(table.c.trangthai == "ACTIVE")
            if self.session.execute(query.with_for_update(read=True)).first() is None:
                raise CompanyError(422, "Invalid catalog selection")
        if values.get("ward_id") is not None:
            t = XaPhuong.__table__
            if (
                self.session.scalar(
                    select(t.c.idxaphuong).where(
                        t.c.idxaphuong == int(values["ward_id"]),
                        t.c.idtinhthanh == int(values["province_id"]),
                    )
                )
                is None
            ):
                raise CompanyError(422, "Ward does not belong to province")
        skill = KyNang.__table__
        retained_skills = {str(item["skill_id"]) for item in retained.get("skills", [])}
        for item in values.get("skills", []):
            if (
                self.session.scalar(
                    select(skill.c.idkynang)
                    .where(
                        skill.c.idkynang == int(item["skill_id"]),
                        True
                        if str(item["skill_id"]) in retained_skills
                        else skill.c.trangthai == "ACTIVE",
                    )
                    .with_for_update(read=True)
                )
                is None
            ):
                raise CompanyError(422, "Invalid skill selection")
        if publish:
            if not all(
                (values.get(k) or "").strip() for k in ["title", "description", "requirements"]
            ):
                raise CompanyError(
                    422, "Title, description and requirements are required for submission"
                )
            if (
                values.get("application_deadline") is not None
                and values["application_deadline"] < datetime.now(UTC).date()
            ):
                raise CompanyError(422, "Application deadline has passed")

    def response(self, row, internal=False):
        if row is None:
            raise CompanyError(404, "Job not found")
        data = {key: row[col] for key, col in FIELDS.items()}
        for key in ["industry_id", "province_id", "ward_id"]:
            if data[key] is not None:
                data[key] = str(data[key])
        for key in ["minimum_salary", "maximum_salary", "years_experience"]:
            if data[key] is not None:
                data[key] = str(data[key])
        data.update(
            id=str(row["idtin"]),
            company_id=str(row["iddoanhnghiep"]),
            company_name=row["company_name"],
            industry_name=row["industry_name"],
            province_name=row["province_name"],
            status=row["trangthai"],
            created_at=row["thoigiantao"].replace(tzinfo=UTC).isoformat(),
            skills=[
                {
                    "skill_id": str(r["idkynang"]),
                    "name": r["name"],
                    "required": bool(r["batbuoc"]),
                    "priority": r["mucdouutien"],
                }
                for r in self.repo.skills(row["idtin"])
            ],
        )
        if internal:
            data.update(
                poster_id=str(row["idnguoidang"]),
                reviewer_id=str(row["idnguoiduyet"]) if row["idnguoiduyet"] else None,
                rejection_reason=row["lydotuchoi"],
                reviewed_at=row["thoigianduyet"].replace(tzinfo=UTC).isoformat()
                if row["thoigianduyet"]
                else None,
            )
        return data

    def listing(self, internal=False, **filters):
        rows, total = self.repo.listing(**filters)
        return {
            "items": [self.response(r, internal) for r in rows],
            "total": total,
            "limit": filters.get("limit", 20),
            "offset": filters.get("offset", 0),
        }

    def create(self, principal, request):
        if self.repo.actor(principal.account_id, principal.company_id) is None:
            raise CompanyError(403, "Approved company membership required")
        values = request.model_dump()
        self.validate(values)
        data = {
            col: int(values[k]) if k.endswith("_id") and values[k] is not None else values[k]
            for k, col in FIELDS.items()
        }
        key = self.session.execute(
            self.repo.job.insert().values(
                **data,
                iddoanhnghiep=int(principal.company_id),
                idnguoidang=int(principal.account_id),
                trangthai="DRAFT",
                thoigiantao=datetime.now(UTC).replace(tzinfo=None),
            )
        ).inserted_primary_key[0]
        if values["skills"]:
            self.repo.set_skills(key, values["skills"])
        result = self.response(self.repo.detail(key), True)
        self.session.commit()
        return result

    def owned(self, principal, key):
        if self.repo.actor(principal.account_id, principal.company_id) is None:
            raise CompanyError(403, "Approved company membership required")
        row = self.repo.row(key, principal.company_id, True)
        if row is None:
            raise CompanyError(404, "Job not found")
        return row

    def update(self, principal, key, request):
        row = self.owned(principal, key)
        if row["trangthai"] == "CLOSED":
            raise CompanyError(409, "Closed jobs cannot be edited")
        current = {k: row[col] for k, col in FIELDS.items()}
        for k in ["industry_id", "province_id", "ward_id"]:
            if current[k] is not None:
                current[k] = str(current[k])
        current["skills"] = [
            {
                "skill_id": str(r["idkynang"]),
                "required": bool(r["batbuoc"]),
                "priority": r["mucdouutien"],
            }
            for r in self.repo.skills(key)
        ]
        changes = request.model_dump(exclude_unset=True)
        merged = current | changes
        self.validate(merged, retained=current)
        values = {
            FIELDS[k]: int(v) if k.endswith("_id") and v is not None else v
            for k, v in changes.items()
            if k in FIELDS
        }
        if changes:
            values.update(trangthai="DRAFT", idnguoiduyet=None, thoigianduyet=None, lydotuchoi=None)
            self.repo.set_values(key, values)
            if "skills" in changes:
                self.repo.set_skills(key, changes["skills"])
        result = self.response(self.repo.detail(key), True)
        self.session.commit()
        return result

    def action(self, principal, key, action):
        row = self.owned(principal, key)
        state = row["trangthai"]
        allowed = {
            "submit": {"DRAFT", "REJECTED"},
            "pause": {"APPROVED"},
            "reopen": {"PAUSED"},
            "close": {"DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED"},
        }
        if state not in allowed[action]:
            raise CompanyError(409, "Invalid job state transition")
        target = {"submit": "PENDING", "pause": "PAUSED", "reopen": "PENDING", "close": "CLOSED"}[
            action
        ]
        values = {"trangthai": target}
        if action in {"submit", "reopen"}:
            content = {k: row[c] for k, c in FIELDS.items()}
            content["skills"] = [
                {
                    "skill_id": str(r["idkynang"]),
                    "required": bool(r["batbuoc"]),
                    "priority": r["mucdouutien"],
                }
                for r in self.repo.skills(key)
            ]
            self.validate(content, True, retained=content)
            values.update(idnguoiduyet=None, thoigianduyet=None, lydotuchoi=None)
        if action == "close":
            values["thoigiandong"] = datetime.now(UTC).replace(tzinfo=None)
        self.repo.set_values(key, values)
        result = self.response(self.repo.detail(key), True)
        self.session.commit()
        return result

    def review(self, principal, key, request):
        initial = self.repo.row(key)
        if initial is None:
            raise CompanyError(404, "Job not found")
        company = (
            self.session.execute(
                select(self.repo.company)
                .where(self.repo.company.c.iddoanhnghiep == initial["iddoanhnghiep"])
                .with_for_update()
            )
            .mappings()
            .one()
        )
        row = self.repo.row(key, lock=True)
        if row["trangthai"] != "PENDING":
            raise CompanyError(409, "Only PENDING jobs can be reviewed")
        if request.status == "APPROVED":
            if company["trangthaiduyet"] != "APPROVED":
                raise CompanyError(409, "Company must be APPROVED")
            content = {k: row[c] for k, c in FIELDS.items()}
            content["skills"] = [
                {
                    "skill_id": str(r["idkynang"]),
                    "required": bool(r["batbuoc"]),
                    "priority": r["mucdouutien"],
                }
                for r in self.repo.skills(key)
            ]
            self.validate(content, True, retained=content)
        self.repo.set_values(
            key,
            {
                "trangthai": request.status,
                "idnguoiduyet": int(principal.account_id),
                "thoigianduyet": datetime.now(UTC).replace(tzinfo=None),
                "lydotuchoi": request.reason if request.status == "REJECTED" else None,
            },
        )
        result = self.response(self.repo.detail(key), True)
        self.session.commit()
        return result
