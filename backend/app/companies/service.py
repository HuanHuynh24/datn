from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.auth.schemas import Principal
from app.companies.repository import PACKAGE_COLUMNS, CompanyRepository
from app.companies.schemas import (
    CompanyResponse,
    CompanyUpdate,
    EmployerRegistrationRequest,
    EmployerRegistrationResponse,
    MemberCreate,
    MemberResponse,
    MemberUpdate,
    PackageResponse,
    PublicCompanyPage,
    PublicCompanyResponse,
)
from app.core.passwords import hash_password


class CompanyNotFound(Exception):
    pass


class CompanyError(Exception):
    def __init__(self, status: int, detail: str):
        self.status, self.detail = status, detail
        super().__init__(detail)


class CompanyService:
    def __init__(self, session: Session):
        self.repository = CompanyRepository(session)

    @staticmethod
    def public_response(row) -> PublicCompanyResponse:
        if row is None:
            raise CompanyNotFound()
        return PublicCompanyResponse(**(dict(row) | {"company_id": str(row["company_id"])}))

    def public_listing(self, **filters) -> PublicCompanyPage:
        rows, total = self.repository.public_listing(**filters)
        return PublicCompanyPage(
            items=[self.public_response(row) for row in rows],
            total=total,
            limit=filters.get("limit", 12),
            offset=filters.get("offset", 0),
        )

    def public_detail(self, company_id: str) -> PublicCompanyResponse:
        return self.public_response(self.repository.public_detail(company_id))

    @staticmethod
    def package_response(row) -> PackageResponse:
        return PackageResponse(**(dict(row) | {"package_id": str(row["package_id"])}))

    def packages(self) -> list[PackageResponse]:
        return [self.package_response(row) for row in self.repository.packages()]

    def current_company(self, account_id: str, company_id: str) -> CompanyResponse:
        row = self.repository.company_for_member(account_id, company_id)
        if row is None:
            raise CompanyNotFound()
        values = dict(row)
        package = {key: values.pop("package_" + key) for key in PACKAGE_COLUMNS}
        values["package"] = self.package_response(package)
        values["company_id"] = str(values["company_id"])
        values["created_at"] = values["created_at"].replace(tzinfo=UTC)
        return CompanyResponse(**values)

    @staticmethod
    def member_response(row) -> MemberResponse:
        values = dict(row)
        values["account_id"] = str(values["account_id"])
        values["added_at"] = values["added_at"].replace(tzinfo=UTC)
        return MemberResponse(**values)

    @staticmethod
    def require_quota(package, count: int):
        limit = package["sotaikhoantoida"]
        if limit is None or limit <= 0:
            raise CompanyError(409, "Package quota is not configured")
        if count >= limit:
            raise CompanyError(409, "Company member quota reached")

    def register(self, request: EmployerRegistrationRequest) -> EmployerRegistrationResponse:
        password_hash = hash_password(request.password.get_secret_value())
        now = datetime.now(UTC).replace(tzinfo=None)
        with self.repository.session.begin():
            package = self.repository.lock_package(request.package_id)
            if package is None:
                raise CompanyError(422, "Selected package is unavailable")
            self.require_quota(package, 0)
            account_id = self.repository.create_account(
                str(request.email), request.full_name, password_hash, now
            )
            company_id = self.repository.create_company(
                request.package_id, request.company_name, request.tax_code, now
            )
            self.repository.create_member(account_id, company_id, "OWNER", now)
            result = EmployerRegistrationResponse(
                account_id=str(account_id), company_id=str(company_id)
            )
        return result

    def owner_scope(self, principal: Principal):
        package = self.repository.lock_owner_scope(principal.account_id, principal.company_id)
        if package is None:
            raise CompanyError(403, "Owner role required")
        return package

    def update(self, principal: Principal, request: CompanyUpdate) -> CompanyResponse:
        self.owner_scope(principal)
        values = request.model_dump(exclude_unset=True)
        for key in ("website", "logo_url"):
            if values.get(key) is not None:
                values[key] = str(values[key])
        self.repository.update_company(principal.company_id, values)
        result = self.current_company(principal.account_id, principal.company_id)
        self.repository.session.commit()
        return result

    def list_members(self, principal: Principal) -> list[MemberResponse]:
        return [self.member_response(row) for row in self.repository.members(principal.company_id)]

    def add_member(self, principal: Principal, request: MemberCreate) -> MemberResponse:
        password_hash = hash_password(request.password.get_secret_value())
        now = datetime.now(UTC).replace(tzinfo=None)
        package = self.owner_scope(principal)
        self.require_quota(
            package, self.repository.active_member_count_locked(principal.company_id)
        )
        account_id = self.repository.create_account(
            str(request.email), request.full_name, password_hash, now
        )
        self.repository.create_member(account_id, principal.company_id, "RECRUITER", now)
        result = self.member_response(
            self.repository.members(principal.company_id, str(account_id))[0]
        )
        self.repository.session.commit()
        return result

    def change_member(
        self, principal: Principal, account_id: str, request: MemberUpdate
    ) -> MemberResponse:
        package = self.owner_scope(principal)
        rows = self.repository.members(principal.company_id, account_id, lock=True)
        if not rows:
            raise CompanyError(404, "Member not found")
        member = rows[0]
        if member["internal_role"] != "RECRUITER":
            raise CompanyError(403, "Owner membership cannot be changed")
        if member["status"] != request.status.value:
            if request.status.value == "ACTIVE":
                self.require_quota(
                    package, self.repository.active_member_count_locked(principal.company_id)
                )
            self.repository.update_member(principal.company_id, account_id, request.status.value)
        result = self.member_response(self.repository.members(principal.company_id, account_id)[0])
        self.repository.session.commit()
        return result
