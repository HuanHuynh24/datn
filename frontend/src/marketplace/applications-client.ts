import { apiRequest } from './auth-client';

export const applicationStatuses = {
  APPLIED: 'Đã nộp', REVIEWING: 'Đang xem xét', INTERVIEW: 'Phỏng vấn',
  OFFER: 'Đề nghị tuyển dụng', HIRED: 'Đã tuyển', REJECTED: 'Từ chối',
} as const;
export type ApplicationStatus = keyof typeof applicationStatuses;
export const applicationTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['REVIEWING', 'REJECTED'], REVIEWING: ['INTERVIEW', 'OFFER', 'REJECTED'],
  INTERVIEW: ['OFFER', 'REJECTED'], OFFER: ['HIRED', 'REJECTED'], HIRED: [], REJECTED: [],
};
export interface ApplicationRecord {
  id: string; candidate_id: string; candidate_name: string; candidate_email: string;
  job_id: string; job_title: string; company_id: string; company_name: string;
  cv_id: string | null; cover_letter: string | null; status: ApplicationStatus;
  submitted_at: string; updated_at: string;
}
export interface ApplicationPage { items: ApplicationRecord[]; total: number; limit: number; offset: number }
export const listApplications = (employer: boolean, query: string) => apiRequest<ApplicationPage>(`/api/v1/${employer ? 'companies' : 'candidates'}/me/applications?${query}`);
export const getApplication = (id: string) => apiRequest<ApplicationRecord>(`/api/v1/applications/${encodeURIComponent(id)}`);
export const updateApplicationStatus = (id: string, status: ApplicationStatus) => apiRequest<ApplicationRecord>(`/api/v1/companies/me/applications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
