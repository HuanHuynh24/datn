

export const pagePaths: Record<string, string> = {
  home: '/',
  admin: '/admin',
  'signin-admin': '/admin/sign-in',
  'job-search': '/jobs',
  companies: '/companies',
  career: '/career',
  signin: '/sign-in',
  'signup-candidate': '/sign-up/candidate',
  'signup-recruiter': '/sign-up/recruiter',
  'candidate-home': '/candidate',
  'candidate-recommended': '/candidate/recommended',
  'candidate-applications': '/candidate/applications',
  'candidate-saved': '/candidate/saved',
  'candidate-profile': '/candidate/profile',
  'cv-upload': '/candidate/cvs',
  'recruiter-home': '/recruiter',
  'recruiter-jobs': '/recruiter/jobs',
  'recruiter-create-job': '/recruiter/jobs/new',
  'recruiter-applicants': '/recruiter/applicants',
  'recruiter-search': '/recruiter/talent-search',
  'recruiter-pipeline': '/recruiter/pipeline',
  'recruiter-recommended': '/recruiter/recommended',
  'recruiter-company': '/recruiter/company',
};

export interface PageRoute {
  page: string;
  itemId?: string;
}

export const routes: Record<string, PageRoute> = Object.fromEntries([
  ...Object.entries(pagePaths).map(([page, pathname]) => [pathname, { page }]),

]);

export function resolveRoute(path: string): PageRoute | undefined {
  const candidate = /^\/recruiter\/candidates\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (candidate) return { page: 'recruiter-candidate', itemId: candidate[1] };
  const company = /^\/companies\/([1-9][0-9]{0,18})$/.exec(path);
  if (company) return { page: 'company-detail', itemId: company[1] };
  const job = /^\/jobs\/([1-9][0-9]{0,18})$/.exec(path);
  if (job) return { page: 'job-detail', itemId: job[1] };
  const edit = /^\/recruiter\/jobs\/([1-9][0-9]{0,18})\/edit$/.exec(path);
  if (edit) return { page: 'recruiter-edit-job', itemId: edit[1] };
  return routes[path];
}

export function safeReturnPath(value: unknown, fallback = '/candidate'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const url = new URL(value, 'https://talentiq.local');
    const route = resolveRoute(url.pathname);
    if (url.origin !== 'https://talentiq.local' || !route || ['signin-admin', 'signin', 'signup-candidate', 'signup-recruiter'].includes(route.page)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}

export function signInFor(path: string, intent: 'apply' | 'save') {
  const target = new URL(safeReturnPath(path, '/jobs'), 'https://talentiq.local');
  target.searchParams.set('intent', intent);
  return getPageUrl('signin', { next: target.pathname + target.search });
}

export function getPageUrl(page: string, data?: unknown): string {
  // Keep old internal navigation calls compatible without generating duplicate pages.
  if (page === 'candidate-jobs') page = 'job-search';
  if (page === 'candidate-job-detail') page = 'job-detail';
  const payload: Record<string, unknown> = data && typeof data === 'object'
    ? data as Record<string, unknown>
    : {};
  if (page === 'job-detail' && 'id' in payload) {
    const url = `/jobs/${encodeURIComponent(String(payload.id))}`;
    return payload.returnTo ? `${url}?${new URLSearchParams({ returnTo: safeReturnPath(payload.returnTo, '/jobs') })}` : url;
  }
  if (page === 'recruiter-candidate' && 'id' in payload) {
    const url = `/recruiter/candidates/${encodeURIComponent(String(payload.id))}`;
    return payload.returnTo ? `${url}?${new URLSearchParams({ returnTo: safeReturnPath(payload.returnTo, '/recruiter/applicants') })}` : url;
  }
  const pathname = pagePaths[page] ?? '/';
  if (['signin-admin', 'signin', 'signup-candidate', 'signup-recruiter'].includes(page) && payload.next) return `${pathname}?${new URLSearchParams({ next: safeReturnPath(payload.next) })}`;
  if (page === 'recruiter-applicants' && typeof payload.jobId === 'string') return `${pathname}?${new URLSearchParams({ jobId: payload.jobId, ...(typeof payload.returnTo === 'string' ? { returnTo: safeReturnPath(payload.returnTo, '/recruiter/jobs') } : {}) })}`;
  if (page === 'candidate-applications' && typeof payload.status === 'string' && ['all', 'active', 'Interview', 'Rejected'].includes(payload.status)) {
    return `${pathname}?${new URLSearchParams({ status: payload.status })}`;
  }
  if (page === 'career' && typeof payload.article === 'string') return `${pathname}?${new URLSearchParams({article:payload.article})}`;
  if (page === 'job-search' || page === 'recruiter-search') {
    const query = new URLSearchParams();
    for (const key of ['keyword', 'location', 'category', 'province_id', 'industry_id', 'skill_id', 'minimum_salary', 'work_type', 'sort', 'page']) {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        query.set(key, payload[key].trim());
      }
    }
    return query.size ? `${pathname}?${query.toString()}` : pathname;
  }
  return pathname;
}
