import { apiRequest } from './auth-client';
import type { JobPage } from './jobs-client';
export interface PublicCompany {
  company_id: string; company_name: string; industry: string | null; size: string | null;
  address: string | null; website: string | null; logo_url: string | null;
  introduction: string | null; open_job_count: number;
}
export interface PublicCompanyPage { items: PublicCompany[]; total: number; limit: number; offset: number }
export const listPublicCompanies = (query = '') => apiRequest<PublicCompanyPage>('/api/v1/companies?' + query);
export const getPublicCompany = (id: string) => apiRequest<PublicCompany>('/api/v1/companies/' + encodeURIComponent(id));
export const getPublicCompanyJobs = (id: string, offset = 0) => apiRequest<JobPage>(`/api/v1/companies/${encodeURIComponent(id)}/jobs?limit=10&offset=${offset}`);
export const safePublicUrl = (value: string | null) => value && /^https?:\/\//i.test(value) ? value : undefined;
