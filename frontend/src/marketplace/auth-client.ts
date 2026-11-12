'use client';

import { useSyncExternalStore } from 'react';
import type { SystemRoleCode } from './auth-codes';
import type { CompanyProfile } from './company-client';

export interface CurrentUser {
  account_id: string;
  role: SystemRoleCode;
  company_id: string | null;
  internal_role: string | null;
  company_approval_status: string | null;
}

export interface CandidateProfile {
  account_id: string; candidate_id: string; full_name: string; email: string;
  phone: string | null; address: string | null; introduction: string | null;
  avatar_url: string | null; profile_public: boolean; education: unknown;
  experience: unknown; desired_position: string | null; province_id: string | null;
  minimum_salary: string | null; maximum_salary: string | null;
  desired_work_type: string | null; updated_at: string;
}

interface AuthSession {
  accessToken: string; expiresAt: number; user: CurrentUser; profile: CandidateProfile | null;
  company: CompanyProfile | null;
}

let session: AuthSession | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const snapshot = () => session;
const serverSnapshot = () => null;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useAuthSession = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);

export function logout() {
  clearTimeout(expiryTimer);
  session = null;
  listeners.forEach(listener => listener());
  // Client logout clears memory only. Copies of a JWT remain valid until expiry.
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}, token = session?.accessToken): Promise<T> {
  if (token && token === session?.accessToken && session.expiresAt <= Date.now()) {
    logout();
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: 'no-store', credentials: 'omit' }); }
  catch { throw new ApiError(0, 'Không thể kết nối máy chủ. Vui lòng thử lại.'); }
  if (!response.ok) {
    if (response.status === 401 && token === session?.accessToken) logout();
    const messages: Record<number, string> = {
      401: 'Email hoặc mật khẩu không hợp lệ, hoặc phiên đăng nhập đã hết hạn.',
      403: 'Tài khoản không có quyền thực hiện thao tác này.',
      409: 'Không thể đăng ký với thông tin này. Nếu đã có tài khoản, hãy đăng nhập.',
      413: 'Tệp quá lớn. Ảnh tối đa 5 MiB/16 megapixel; CV tối đa 10 MiB.',
      415: 'Ảnh phải là JPEG, PNG hoặc WebP hợp lệ, không phải ảnh động.',
      422: 'Thông tin chưa hợp lệ. Kiểm tra độ dài, định dạng và khoảng lương.',
      503: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
    };
    const payload = await response.json().catch(() => null);
    const businessMessages: Record<string, string> = {
      'Company member quota reached': 'Đã đạt giới hạn thành viên hoạt động của gói.',
      'Package quota is not configured': 'Gói chưa được cấu hình hạn mức thành viên.',
      'Selected package is unavailable': 'Gói đã chọn không khả dụng. Hãy tải lại danh mục gói.',
      'Email or tax code already in use': 'Email hoặc mã số thuế đã được sử dụng.',
      'Owner role required': 'Chỉ người quản lý OWNER có quyền thực hiện thao tác này.',
      'Owner membership cannot be changed': 'Không thể thay đổi trạng thái của OWNER.',
      'Member not found': 'Không tìm thấy thành viên trong doanh nghiệp của bạn.',
      'Job not found': 'Tin không tồn tại hoặc bạn không có quyền truy cập.',
      'Approved company membership required': 'Doanh nghiệp cần được Admin phê duyệt trước khi tuyển dụng.',
      'Invalid job state transition': 'Trạng thái hiện tại không cho phép thao tác này. Hãy tải lại tin.',
      'Closed jobs cannot be edited': 'Tin đã đóng không thể chỉnh sửa.',
      'Only PENDING jobs can be reviewed': 'Chỉ tin đang chờ duyệt mới được kiểm duyệt.',
      'Company must be APPROVED': 'Doanh nghiệp cần được duyệt trước khi duyệt tin.',
      'Application deadline has passed': 'Hạn nộp đã qua. Hãy cập nhật trước khi gửi duyệt.',
      'Title, description and requirements are required for submission': 'Cần điền tiêu đề, mô tả và yêu cầu trước khi gửi duyệt.',
      'Ward does not belong to province': 'Xã/phường không thuộc tỉnh/thành đã chọn.',
      'Invalid catalog selection': 'Danh mục đã chọn không còn khả dụng.',
      'Invalid skill selection': 'Kỹ năng đã chọn không còn khả dụng.',
      'Invalid salary range': 'Lương tối thiểu không được lớn hơn lương tối đa.',
      'Catalog name already exists': 'Tên danh mục đã tồn tại, kể cả danh mục ngừng hoạt động.',
      'Catalog name exceeds schema length': 'Tên danh mục vượt quá độ dài cho phép.',
      'Admin accounts cannot be modified here': 'Không được thay đổi tài khoản Admin qua chức năng này.',
      'Administrative resource not found': 'Không tìm thấy bản ghi quản trị.',
      'Already applied to this job': 'Bạn đã ứng tuyển công việc này. Không thể nộp lại trong MVP.',
      'Invalid application state transition': 'Không thể chuyển sang trạng thái đã chọn. Hãy tải lại danh sách.',
      'Job is not accepting applications': 'Tin hiện không nhận hồ sơ ứng tuyển.',
      'Active owned CV required': 'Hãy chọn CV đang hoạt động của bạn.',
      'A valid PDF or DOCX up to 10 MiB is required': 'CV phải là PDF hoặc DOCX hợp lệ, tối đa 10 MiB.',
    };
    throw new ApiError(response.status, (typeof payload?.detail === 'string' && businessMessages[payload.detail]) || messages[response.status] || 'Không thể hoàn tất thao tác.');
  }
  return response.json() as Promise<T>;
}

export async function registerCandidate(email: string, fullName: string, password: string) {
  return request<{ account_id: string; candidate_id: string; role: 'CANDIDATE' }>('/api/v1/auth/register/candidate', {
    method: 'POST', body: JSON.stringify({ email, full_name: fullName, password }),
  }, undefined);
}

export async function signIn(email: string, password: string, expectedRole: SystemRoleCode) {
  // Never retain a previous identity when attempting a new login.
  logout();
  const token = await request<{ access_token: string; expires_in: number }>('/api/v1/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }, undefined);
  const user = await request<CurrentUser>('/api/v1/auth/me', {}, token.access_token);
  if (user.role !== expectedRole) throw new ApiError(403, 'Hãy chọn đúng loại tài khoản để đăng nhập.');
  const profile = user.role === 'CANDIDATE'
    ? await request<CandidateProfile>('/api/v1/candidates/me/profile', {}, token.access_token) : null;
  const company = user.role === 'COMPANY_MEMBER'
    ? await request<CompanyProfile>('/api/v1/companies/me', {}, token.access_token) : null;
  session = { accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000, user, profile, company };
  expiryTimer = setTimeout(logout, token.expires_in * 1000);
  listeners.forEach(listener => listener());
  return user;
}

export function setCandidateProfile(profile: CandidateProfile) {
  if (session?.user.account_id !== profile.account_id) return;
  session = { ...session, profile };
  listeners.forEach(listener => listener());
}

export const getCandidateProfile = () => request<CandidateProfile>('/api/v1/candidates/me/profile');
export { request as apiRequest };
export async function getPrivateImage(path: '/api/v1/candidates/me/avatar' | '/api/v1/companies/me/logo') {
  if (!session || session.expiresAt <= Date.now()) {
    logout(); throw new ApiError(401, 'Vui lòng đăng nhập lại.');
  }
  const token = session.accessToken;
  const response = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) {
    if (response.status === 401 && token === session?.accessToken) logout();
    throw new ApiError(response.status, 'Chưa tải được ảnh đã lưu.');
  }
  return response.blob();
}
export async function downloadPrivateCV(path: string, filename: string) {
  if (!session || session.expiresAt <= Date.now()) {
    logout(); throw new ApiError(401, 'Vui lòng đăng nhập lại.');
  }
  const token = session.accessToken;
  const response = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) {
    if (response.status === 401 && token === session?.accessToken) logout();
    throw new ApiError(response.status, 'Không thể tải CV hoặc bạn không có quyền truy cập.');
  }
  const extension = response.headers.get('content-type')?.includes('pdf') ? 'pdf' : 'docx';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = `${filename}.${extension}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function setCurrentCompany(company: CompanyProfile) {
  if (session?.user.company_id !== company.company_id) return;
  session = { ...session, company, user: { ...session.user, company_approval_status: company.approval_status } };
  listeners.forEach(listener => listener());
}
export async function updateCandidateProfile(values: Partial<Omit<CandidateProfile, 'account_id' | 'candidate_id' | 'email' | 'updated_at'>>) {
  const profile = await request<CandidateProfile>('/api/v1/candidates/me/profile', {
    method: 'PATCH', body: JSON.stringify(values),
  });
  setCandidateProfile(profile);
  return profile;
}
