import secrets

import pytest
from pydantic import ValidationError

from app.companies.schemas import (
    CompanyUpdate,
    EmployerRegistrationRequest,
    MemberCreate,
    MemberUpdate,
)
from app.companies.service import CompanyError, CompanyService


@pytest.mark.parametrize("limit,count", [(None, 0), (0, 0), (-1, 0), (1, 1), (5, 5)])
def test_quota_never_treats_null_or_owner_seat_as_unlimited(limit, count):
    with pytest.raises(CompanyError) as error:
        CompanyService.require_quota({"sotaikhoantoida": limit}, count)
    assert error.value.status == 409


def test_company_input_schemas_reject_privilege_and_immutable_fields():
    data = {
        "email": "owner@example.com",
        "full_name": "Owner",
        "password": secrets.token_urlsafe(16),
    }
    for model, values, extra in [
        (
            EmployerRegistrationRequest,
            data | {"company_name": "Company", "tax_code": "123", "package_id": "1"},
            {"internal_role": "OWNER"},
        ),
        (MemberCreate, data, {"role": "ADMIN"}),
        (MemberUpdate, {"status": "ACTIVE"}, {"internal_role": "OWNER"}),
        (CompanyUpdate, {"company_name": "Company"}, {"approval_status": "APPROVED"}),
    ]:
        with pytest.raises(ValidationError):
            model(**(values | extra))
    assert data["password"] not in repr(MemberCreate(**data))
