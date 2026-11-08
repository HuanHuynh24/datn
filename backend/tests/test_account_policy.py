from dataclasses import replace
from datetime import UTC, datetime

import pytest

from app.auth.accounts import AccountSnapshot
from app.auth.policy import ApprovedAccountPolicy, UnresolvedLoginPolicy


def snapshot(role="ADMIN"):
    return AccountSnapshot(
        account_id="1",
        email="user@example.com",
        password_hash="opaque-test-value",
        role=role,
        status="ACTIVE",
        email_verified=False,
        locked_until=None,
        candidate_id=None,
        member_company_id=None,
        member_status=None,
        member_title=None,
        company_id=None,
    )


@pytest.mark.parametrize("role", ["ADMIN", "CANDIDATE", "COMPANY_MEMBER"])
def test_approved_role_specialization(role):
    account = snapshot(role)
    if role == "CANDIDATE":
        account = replace(account, candidate_id="10")
    if role == "COMPANY_MEMBER":
        account = replace(
            account,
            member_company_id="20",
            company_id="20",
            member_status="ACTIVE",
            member_title="RECRUITER",
            company_approval_status="APPROVED",
        )
    principal = ApprovedAccountPolicy().principal_for(account)
    assert principal.role == role and principal.authentication_allowed


@pytest.mark.parametrize("approval", ["PENDING", "APPROVED", "REJECTED"])
@pytest.mark.parametrize("internal_role", ["OWNER", "RECRUITER"])
def test_company_can_authenticate_before_approval(approval, internal_role):
    account = replace(
        snapshot("COMPANY_MEMBER"),
        member_company_id="20",
        company_id="20",
        member_status="ACTIVE",
        member_title=internal_role,
        company_approval_status=approval,
    )
    principal = ApprovedAccountPolicy().principal_for(account)
    assert principal.company_id == "20"
    assert principal.internal_role == internal_role
    assert principal.company_approval_status == approval


@pytest.mark.parametrize(
    "changes",
    [
        {"status": "DISABLED"},
        {"status": "unknown"},
        {"role": "unknown"},
        {"candidate_id": "3"},
        {"member_company_id": "4"},
        {"role": "CANDIDATE"},
        {"role": "COMPANY_MEMBER"},
        {"role": "CANDIDATE", "candidate_id": "3", "member_company_id": "4"},
        {"role": "COMPANY_MEMBER", "company_id": "4", "member_company_id": "5"},
    ],
)
def test_disabled_invalid_or_disjoint_violation_fails_closed(changes):
    assert ApprovedAccountPolicy().principal_for(replace(snapshot(), **changes)) is None


def test_lock_data_remains_blocked_pending_lock_policy():
    with pytest.raises(UnresolvedLoginPolicy):
        ApprovedAccountPolicy().principal_for(replace(snapshot(), locked_until=datetime.now(UTC)))
