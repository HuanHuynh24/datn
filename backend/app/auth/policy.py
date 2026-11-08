from app.auth.accounts import AccountSnapshot
from app.auth.schemas import (
    AccountStatus,
    CompanyApprovalStatus,
    ConfirmedSystemRole,
    InternalCompanyRole,
    MemberStatus,
    Principal,
)


class UnresolvedLoginPolicy(Exception):
    """Existing lock data cannot be interpreted under an unapproved lock policy."""


class ApprovedAccountPolicy:
    def principal_for(self, account: AccountSnapshot) -> Principal | None:
        if account.status != AccountStatus.ACTIVE:
            return None
        company_id = internal_role = approval = None
        if account.role == ConfirmedSystemRole.CANDIDATE:
            if account.candidate_id is None or account.member_company_id is not None:
                return None
        elif account.role == ConfirmedSystemRole.ADMIN:
            if account.candidate_id is not None or account.member_company_id is not None:
                return None
        elif account.role == ConfirmedSystemRole.COMPANY_MEMBER:
            if (
                account.candidate_id is not None
                or account.member_status != MemberStatus.ACTIVE
                or account.company_id is None
                or account.company_id != account.member_company_id
                or account.member_title not in set(InternalCompanyRole)
                or account.company_approval_status not in set(CompanyApprovalStatus)
            ):
                return None
            company_id = account.company_id
            internal_role = account.member_title
            approval = account.company_approval_status
        else:
            return None
        # No guessed threshold, duration, timestamp convention or automatic unlock.
        # NULL means there is no recorded lock to interpret; non-NULL needs policy.
        if account.locked_until is not None:
            raise UnresolvedLoginPolicy()
        return Principal(
            account_id=account.account_id,
            role=account.role,
            authentication_allowed=True,
            company_id=company_id,
            internal_role=internal_role,
            company_approval_status=approval,
        )
