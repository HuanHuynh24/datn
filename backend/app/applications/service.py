from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.applications.repository import ApplicationRepository
from app.applications.schemas import TRANSITIONS
from app.candidates.repository import CandidateProfileRepository
from app.companies.service import CompanyError
from app.cv.storage import PrivateCVStorage, validate_cv
from app.jobs.repository import JobRepository

MAX_CV_BYTES = 10 * 1024 * 1024


def now():
    return datetime.now(UTC).replace(tzinfo=None)


class CVApplicationService:
    def __init__(self, session, storage: PrivateCVStorage):
        self.session, self.storage = session, storage
        self.repo = ApplicationRepository(session)

    def candidate(self, principal, lock=False):
        if principal.role != "CANDIDATE":
            raise CompanyError(403, "Candidate account required")
        row = CandidateProfileRepository(self.session).owned(principal.account_id, lock=lock)
        if row is None:
            raise CompanyError(404, "Candidate profile not found")
        return row["candidate_id"]

    def cv_response(self, row):
        return {
            "id": str(row["idcv"]),
            "is_primary": bool(row["cvchinh"]),
            "status": row["trangthai"],
            "created_at": row["thoigiantao"].replace(tzinfo=UTC),
            "format": row["duongdantep"].rsplit(".", 1)[-1],
        }

    def list_cvs(self, principal):
        candidate = self.candidate(principal)
        rows = self.session.execute(
            select(self.repo.cv)
            .where(self.repo.cv.c.idungvien == candidate, self.repo.cv.c.trangthai == "ACTIVE")
            .order_by(self.repo.cv.c.idcv.desc())
        ).mappings()
        return [self.cv_response(row) for row in rows]

    def upload(self, principal, upload):
        valid = validate_cv(
            upload.file, upload.filename or "", upload.content_type, max_bytes=MAX_CV_BYTES
        )
        candidate = self.candidate(principal, True)
        stored = self.storage.store(valid)
        try:
            key = self.session.execute(
                self.repo.cv.insert().values(
                    idungvien=candidate,
                    duongdantep=stored.key,
                    cvchinh=False,
                    trangthai="ACTIVE",
                    thoigiantao=now(),
                )
            ).inserted_primary_key[0]
            result = self.cv_response(self.repo.owned_cv(candidate, key))
            self.session.commit()
            return result
        except BaseException:
            self.session.rollback()
            self.storage.discard_uncommitted(stored.key)
            raise

    def update_cv(self, principal, key, *, primary=None, archive=False):
        candidate = self.candidate(principal, True)
        row = self.repo.owned_cv(candidate, key, True, active=not archive)
        if row is None:
            raise CompanyError(404, "CV not found")
        table = self.repo.cv
        if primary:
            self.session.execute(
                update(table)
                .where(table.c.idungvien == candidate, table.c.cvchinh.is_(True))
                .values(cvchinh=False)
            )
        values = {"trangthai": "ARCHIVED", "cvchinh": False} if archive else {"cvchinh": primary}
        self.session.execute(update(table).where(table.c.idcv == int(key)).values(**values))
        result = self.cv_response(self.repo.owned_cv(candidate, key, active=False))
        self.session.commit()
        return result

    def cv_download(self, principal, key):
        row = self.repo.owned_cv(self.candidate(principal), key)
        if row is None:
            raise CompanyError(404, "CV not found")
        return self.storage.open_authorized(row["duongdantep"]), row["duongdantep"].rsplit(".", 1)[
            -1
        ]

    def apply(self, principal, job_id, request):
        j, c, a = self.repo.job, self.repo.company, self.repo.app
        initial = (
            self.session.execute(select(j).where(j.c.idtin == int(job_id))).mappings().one_or_none()
        )
        if initial is None:
            raise CompanyError(404, "Job not found")
        company = (
            self.session.execute(
                select(c).where(c.c.iddoanhnghiep == initial["iddoanhnghiep"]).with_for_update()
            )
            .mappings()
            .one()
        )
        job = (
            self.session.execute(select(j).where(j.c.idtin == int(job_id)).with_for_update())
            .mappings()
            .one()
        )
        stamp = now()
        if (
            company["trangthaiduyet"] != "APPROVED"
            or job["trangthai"] != "APPROVED"
            or (job["hannophoso"] is not None and job["hannophoso"] < stamp.date())
            or (job["thoigiandong"] is not None and job["thoigiandong"] <= stamp)
        ):
            raise CompanyError(409, "Job is not accepting applications")
        candidate = self.candidate(principal, True)
        if (
            self.session.scalar(
                select(a.c.iddon)
                .where(a.c.idungvien == candidate, a.c.idtin == int(job_id))
                .with_for_update()
            )
            is not None
        ):
            raise CompanyError(409, "Already applied to this job")
        cv = self.repo.owned_cv(candidate, request.cv_id, True)
        if cv is None:
            raise CompanyError(404, "Active owned CV required")
        suffix = cv["duongdantep"].rsplit(".", 1)[-1]
        with self.storage.open_authorized(cv["duongdantep"]) as source:
            copy = self.storage.store(
                validate_cv(source, "snapshot." + suffix, None, max_bytes=MAX_CV_BYTES)
            )
        try:
            key = self.session.execute(
                a.insert().values(
                    idungvien=candidate,
                    idtin=int(job_id),
                    idcv=int(request.cv_id),
                    duongdanbanluucv=copy.key,
                    thugiothieu=request.cover_letter,
                    trangthai="APPLIED",
                    thoigiannop=stamp,
                    thoigiancapnhat=stamp,
                )
            ).inserted_primary_key[0]
            result = self.response(self.repo.detail(principal, key))
            self.session.commit()
            return result
        except BaseException as error:
            self.session.rollback()
            self.storage.discard_uncommitted(copy.key)
            if isinstance(error, IntegrityError) and error.orig.args[0] == 1062:
                raise CompanyError(409, "Already applied to this job") from None
            raise

    def response(self, row):
        if row is None:
            raise CompanyError(404, "Application not found")
        return {
            "id": str(row["iddon"]),
            "candidate_id": str(row["idungvien"]),
            "candidate_name": row["candidate_name"],
            "candidate_email": row["candidate_email"],
            "job_id": str(row["idtin"]),
            "job_title": row["job_title"],
            "company_id": str(row["iddoanhnghiep"]),
            "company_name": row["company_name"],
            "cv_id": str(row["idcv"]) if row["idcv"] else None,
            "cover_letter": row["thugiothieu"],
            "status": row["trangthai"],
            "submitted_at": row["thoigiannop"].replace(tzinfo=UTC),
            "updated_at": row["thoigiancapnhat"].replace(tzinfo=UTC),
        }

    def listing(self, principal, **filters):
        rows, total = self.repo.listing(principal, **filters)
        return {
            "items": [self.response(row) for row in rows],
            "total": total,
            "limit": filters.get("limit", 20),
            "offset": filters.get("offset", 0),
        }

    def update_application(self, principal, key, request):
        if (
            principal.role != "COMPANY_MEMBER"
            or JobRepository(self.session).actor(principal.account_id, principal.company_id) is None
        ):
            raise CompanyError(403, "Approved company membership required")
        row = self.repo.locked(principal, key)
        if row is None:
            raise CompanyError(404, "Application not found")
        if request.status not in TRANSITIONS.get(row["trangthai"], set()):
            raise CompanyError(409, "Invalid application state transition")
        self.session.execute(
            update(self.repo.app)
            .where(self.repo.app.c.iddon == int(key))
            .values(trangthai=request.status, thoigiancapnhat=now())
        )
        result = self.response(self.repo.detail(principal, key))
        self.session.commit()
        return result

    def application_download(self, principal, key):
        row = self.repo.detail(principal, key)
        if row is None or not row["duongdanbanluucv"]:
            raise CompanyError(404, "Application CV not found")
        stored = row["duongdanbanluucv"]
        return self.storage.open_authorized(stored), stored.rsplit(".", 1)[-1]
