from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError

from app.admin_management.repository import AdminRepository
from app.companies.service import CompanyError

STATUSES = {
    "accounts": {"ACTIVE", "DISABLED"},
    "candidates": {"ACTIVE", "DISABLED"},
    "companies": {"PENDING", "APPROVED", "REJECTED"},
    "jobs": {"DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "CLOSED"},
    "industries": {"ACTIVE", "INACTIVE"},
    "skills": {"ACTIVE", "INACTIVE"},
    "packages": set(),
}


class AdminService:
    def __init__(self, session):
        self.session = session
        self.repo = AdminRepository(session)

    @staticmethod
    def record(row):
        result = dict(row)
        for key in ["id", "account_id", "company_id", "monthly_price"]:
            if result.get(key) is not None:
                result[key] = str(result[key])
        if result.get("created_at") is not None:
            result["created_at"] = result["created_at"].replace(tzinfo=UTC)
        return result

    def listing(self, resource, **filters):
        if filters["status"] and filters["status"] not in STATUSES[resource]:
            raise CompanyError(422, "Unsupported status filter")
        if filters["role"] and (
            resource != "accounts"
            or filters["role"] not in {"CANDIDATE", "COMPANY_MEMBER", "ADMIN"}
        ):
            raise CompanyError(422, "Unsupported role filter")
        rows, total = self.repo.listing(resource, **filters)
        return {
            "items": [self.record(row) for row in rows],
            "total": total,
            "limit": filters["limit"],
            "offset": filters["offset"],
        }

    def detail(self, resource, key):
        row = self.repo.detail(resource, key)
        if row is None:
            raise CompanyError(404, "Administrative resource not found")
        return self.record(row)

    def dashboard(self):
        return self.repo.dashboard() | {"generated_at": datetime.now(UTC)}

    def set_account_status(self, key, request):
        row = self.repo.lock("accounts", key)
        if row is None:
            raise CompanyError(404, "Administrative resource not found")
        if row["vaitro"] not in {"CANDIDATE", "COMPANY_MEMBER"}:
            raise CompanyError(403, "Admin accounts cannot be modified here")
        self.repo.update("accounts", key, {"trangthai": request.status})
        result = self.detail("accounts", key)
        self.session.commit()
        return result

    def save_catalog(self, resource, request, key=None):
        column, maximum = ("tennganhnghe", 150) if resource == "industries" else ("tenkynang", 120)
        if key is not None and self.repo.lock(resource, key) is None:
            raise CompanyError(404, "Administrative resource not found")
        changes = request.model_dump(exclude_unset=True)
        values = {}
        if "name" in changes:
            if len(changes["name"]) > maximum:
                raise CompanyError(422, "Catalog name exceeds schema length")
            if self.repo.name_exists(resource, column, changes["name"], key):
                raise CompanyError(409, "Catalog name already exists")
            values[column] = changes["name"]
        if "status" in changes:
            values["trangthai"] = changes["status"]
        try:
            if key is None:
                key = self.repo.create(resource, values)
            else:
                self.repo.update(resource, key, values)
            result = self.detail(resource, key)
            self.session.commit()
            return result
        except IntegrityError as error:
            self.session.rollback()
            if error.orig.args and error.orig.args[0] == 1062:
                raise CompanyError(409, "Catalog name already exists") from None
            raise
