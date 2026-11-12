import { apiRequest } from './auth-client';

export type JobStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'CLOSED';
export const jobStatusText: Record<JobStatus, string> = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', PAUSED: 'Tạm dừng', CLOSED: 'Đã đóng' };
export interface CatalogItem { id: string; name: string; province_id?: string }
export interface JobCatalog { industries: CatalogItem[]; provinces: CatalogItem[]; wards: CatalogItem[]; skills: CatalogItem[] }
export interface LiveJob {
  company_logo_url?: string | null;
  id: string; company_id: string; company_name: string; title: string;
  description: string | null; requirements: string | null;
  industry_id: string; industry_name: string; province_id: string; province_name: string;
  ward_id: string | null; street: string | null; level: string | null;
  minimum_salary: string | null; maximum_salary: string | null; years_experience: string | null;
  work_type: string | null; application_deadline: string | null; status: JobStatus;
  created_at: string; rejection_reason?: string | null;
  skills: { skill_id: string; name: string; required: boolean; priority: number }[];
}
export interface JobPage { items: LiveJob[]; total: number; limit: number; offset: number }
export interface CompanyReviewRow { company_id: string; company_name: string; tax_code: string; approval_status: string }
export const getJobCatalog = () => apiRequest<JobCatalog>('/api/v1/job-catalog');
export const getJobs = (query = '', own = false, admin = false) => apiRequest<JobPage>(`${admin ? '/api/v1/admin/jobs' : own ? '/api/v1/companies/me/jobs' : '/api/v1/jobs'}?${query}`);
export const getJob = (id: string, own = false) => apiRequest<LiveJob>(`${own ? '/api/v1/companies/me/jobs' : '/api/v1/jobs'}/${encodeURIComponent(id)}`);
export const saveJob = (body: object, id?: string) => apiRequest<LiveJob>(`/api/v1/companies/me/jobs${id ? '/' + encodeURIComponent(id) : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
export const jobAction = (id: string, action: string) => apiRequest<LiveJob>(`/api/v1/companies/me/jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
export const reviewJob = (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) => apiRequest<LiveJob>(`/api/v1/admin/jobs/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
export const listReviewCompanies = (query = '') => apiRequest<CompanyReviewRow[]>(`/api/v1/admin/companies?${query}`);
export const reviewCompany = (id: string, status: 'APPROVED' | 'REJECTED') => apiRequest<CompanyReviewRow>(`/api/v1/admin/companies/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify({ status }) });
