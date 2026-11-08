// Approved API codes (2026-11-02). UI audiences are aliases, never granted permissions.
export const SystemRole = {
  CANDIDATE: 'CANDIDATE', COMPANY_MEMBER: 'COMPANY_MEMBER', ADMIN: 'ADMIN',
} as const;
export const AccountStatus = { ACTIVE: 'ACTIVE', DISABLED: 'DISABLED' } as const;
export const MemberStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export const CompanyApprovalStatus = {
  PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED',
} as const;
export const InternalCompanyRole = { OWNER: 'OWNER', RECRUITER: 'RECRUITER' } as const;
export const AUTH_AUDIENCE_SYSTEM_ROLE = {
  candidate: SystemRole.CANDIDATE,
  recruiter: SystemRole.COMPANY_MEMBER,
} as const;
export type AuthAudience = keyof typeof AUTH_AUDIENCE_SYSTEM_ROLE;
export type SystemRoleCode = typeof SystemRole[keyof typeof SystemRole];
export type AccountStatusCode = typeof AccountStatus[keyof typeof AccountStatus];
export type MemberStatusCode = typeof MemberStatus[keyof typeof MemberStatus];
export type CompanyApprovalStatusCode = typeof CompanyApprovalStatus[keyof typeof CompanyApprovalStatus];
export type InternalCompanyRoleCode = typeof InternalCompanyRole[keyof typeof InternalCompanyRole];
