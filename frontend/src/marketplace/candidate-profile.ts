import type { CandidateProfile } from './auth-client';

const completionFields = [
  ['full_name', 'Họ và tên'], ['phone', 'Điện thoại'], ['address', 'Địa chỉ'],
  ['introduction', 'Giới thiệu'], ['desired_position', 'Vị trí mong muốn'],
  ['education', 'Học vấn'], ['experience', 'Kinh nghiệm'],
] as const;

function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasContent);
  if (value && typeof value === 'object') return Object.values(value).some(hasContent);
  return value != null && value !== false;
}

export function profileCompletion(profile: CandidateProfile | null | undefined) {
  const missing = completionFields.filter(([key]) => !hasContent(profile?.[key])).map(([, label]) => label);
  return { percent: Math.round((completionFields.length - missing.length) / completionFields.length * 100), missing };
}

export function profileDraft(profile: CandidateProfile) {
  return {
    full_name: profile.full_name, phone: profile.phone || '', address: profile.address || '',
    introduction: profile.introduction || '', desired_position: profile.desired_position || '',
    minimum_salary: profile.minimum_salary ?? '', maximum_salary: profile.maximum_salary ?? '',
    profile_public: profile.profile_public, province_id: profile.province_id || '',
    desired_work_type: profile.desired_work_type || '', avatar_url: profile.avatar_url || '',
  };
}

export type ProfileDraft = ReturnType<typeof profileDraft>;

// Compare against the snapshot opened in the editor, not a later background refresh.
// Preserve legacy JSON and every untouched field, including uploaded avatar URLs.
export function profilePatch(draft: ProfileDraft, original: ProfileDraft) {
  const patch: Record<string, string | boolean | null> = {};
  for (const key of Object.keys(draft) as (keyof ProfileDraft)[]) {
    if (draft[key] === original[key]) continue;
    const value = typeof draft[key] === 'string' ? draft[key].trim() : draft[key];
    patch[key] = value === '' && key !== 'full_name' ? null : value;
  }
  return patch;
}

export function profileSalary(profile: Pick<CandidateProfile, 'minimum_salary' | 'maximum_salary'>) {
  const format = (value: string) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value));
  const low = profile.minimum_salary, high = profile.maximum_salary;
  if (low != null && high != null) return `${format(low)} – ${format(high)} VND`;
  if (low != null) return `Từ ${format(low)} VND`;
  if (high != null) return `Đến ${format(high)} VND`;
  return 'Chưa cập nhật';
}
