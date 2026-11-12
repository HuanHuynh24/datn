'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ExperienceLevel, Job, WorkStyle, WorkType } from './data';
import { getJobs, type LiveJob } from './jobs-client';
import { safePublicUrl } from './public-company-client';

const workTypes: WorkType[] = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const levels: ExperienceLevel[] = ['Junior', 'Mid-level', 'Senior', 'Lead'];
const workStyles: WorkStyle[] = ['Remote', 'On-site', 'Hybrid'];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]?.toUpperCase()).join('') || 'DN';
}

function lines(value: string | null) {
  return value?.split(/\r?\n/).map(item => item.replace(/^[-*•]\s*/, '').trim()).filter(Boolean) ?? [];
}

function normalized<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  const match = values.find(item => item.toLowerCase() === value?.trim().toLowerCase());
  return match ?? fallback;
}

export function liveJobToPresentation(job: LiveJob): Job {
  const created = new Date(job.created_at).getTime();
  const postedDays = Number.isFinite(created) ? Math.max(0, Math.floor((Date.now() - created) / 86_400_000)) : 0;
  const company = job.company_name || 'Doanh nghiệp';
  const minimum = job.minimum_salary === null ? 0 : Number(job.minimum_salary);
  const maximum = job.maximum_salary === null ? 0 : Number(job.maximum_salary);
  const rawWorkType = job.work_type?.trim() ?? '';
  return {
    id: job.id,
    title: job.title,
    company: {
      id: job.company_id,
      name: company,
      logo: initials(company),
      logoImage: safePublicUrl(job.company_logo_url ?? null),
      industry: job.industry_name,
      size: 'Chưa cập nhật',
      location: job.province_name,
      description: `${company} đang tuyển dụng tại ${job.province_name}.`,
      openRoles: 0,
      verified: true,
    },
    location: [job.street, job.province_name].filter(Boolean).join(', ') || job.province_name,
    workType: normalized(rawWorkType, workTypes, 'Full-time'),
    workStyle: normalized(rawWorkType, workStyles, 'On-site'),
    level: normalized(job.level, levels, 'Mid-level'),
    salaryMin: Number.isFinite(minimum) ? minimum : 0,
    salaryMax: Number.isFinite(maximum) ? maximum : 0,
    currency: 'VND',
    salaryLabel: job.minimum_salary === null && job.maximum_salary === null
      ? 'Thỏa thuận'
      : `${minimum.toLocaleString('vi-VN')} – ${maximum.toLocaleString('vi-VN')} VND`,
    postedLabel: postedDays === 0 ? 'Hôm nay' : `${postedDays} ngày trước`,
    description: job.description ?? 'Nhà tuyển dụng chưa cập nhật mô tả.',
    responsibilities: [],
    requirements: lines(job.requirements),
    skills: job.skills.map(item => item.name),
    benefits: [],
    postedDays,
    applicants: 0,
    category: job.industry_name,
  };
}

/** Dữ liệu việc làm thật, chuyển sang view-model của giao diện gốc. */
export function useJobCatalog({ own = false }: { own?: boolean } = {}) {
  const [source, setSource] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    getJobs('limit=100&offset=0', own)
      .then(result => { if (active) setSource(result.items); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải việc làm.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [own, version]);

  const all = useMemo(() => source.map(liveJobToPresentation), [source]);
  const available = useMemo(
    () => own ? all : source.filter(item => item.status === 'APPROVED').map(liveJobToPresentation),
    [all, own, source],
  );
  return { all, available, source, loading, error, reload: () => { setLoading(true); setError(''); setVersion(value => value + 1); } };
}
