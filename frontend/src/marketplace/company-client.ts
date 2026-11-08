'use client';

import { apiRequest, setCurrentCompany } from './auth-client';

export interface CompanyPackage {
  package_id: string; code: string; name: string; member_limit: number | null;
  monthly_price: string; description: string | null;
}

export interface CompanyProfile {
  company_id: string; company_name: string; tax_code: string; industry: string | null;
  size: string | null; address: string | null; website: string | null; logo_url: string | null;
  introduction: string | null; profile_url: string | null;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED'; created_at: string;
  package_started_on: string | null; package_expires_on: string | null; package: CompanyPackage;
  active_member_count: number;
}

export const getCompanyPackages = () => apiRequest<CompanyPackage[]>('/api/v1/company-packages');
export const getMyCompany = () => apiRequest<CompanyProfile>('/api/v1/companies/me');
export interface CompanyMember {
  account_id: string; full_name: string; email: string; internal_role: 'OWNER' | 'RECRUITER';
  status: 'ACTIVE' | 'INACTIVE'; account_status: 'ACTIVE' | 'DISABLED'; added_at: string;
}
export interface EmployerRegistration {
  email: string; full_name: string; password: string; company_name: string;
  tax_code: string; package_id: string;
}
export const registerEmployer = (data: EmployerRegistration) => apiRequest<{ account_id: string; company_id: string }>('/api/v1/auth/register/employer', { method: 'POST', body: JSON.stringify(data) });
export async function updateMyCompany(data: Partial<Pick<CompanyProfile, 'company_name' | 'industry' | 'size' | 'address' | 'website' | 'logo_url' | 'introduction'>>) {
  const company = await apiRequest<CompanyProfile>('/api/v1/companies/me', { method: 'PATCH', body: JSON.stringify(data) });
  setCurrentCompany(company);
  return company;
}
export const getCompanyMembers = () => apiRequest<CompanyMember[]>('/api/v1/companies/me/members');
export const createCompanyMember = (data: { full_name: string; email: string; password: string }) => apiRequest<CompanyMember>('/api/v1/companies/me/members', { method: 'POST', body: JSON.stringify(data) });
export const changeCompanyMemberStatus = (id: string, status: 'ACTIVE' | 'INACTIVE') => apiRequest<CompanyMember>('/api/v1/companies/me/members/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ status }) });
