'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, logout, useAuthSession } from '../auth-client';
import { getMyCompany, type CompanyProfile } from '../company-client';
import { getJob, getJobCatalog, getJobs, jobAction, jobStatusText, listReviewCompanies, reviewCompany, reviewJob, saveJob, type CompanyReviewRow, type JobCatalog, type JobPage, type LiveJob } from '../jobs-client';
import { Badge, Empty, Field, Notice, Page, Panel } from '../ui';
import { ApplyToJob } from './LiveApplications';
import { liveJobToPresentation } from '../job-catalog';
import CompanyMark from '../components/CompanyMark';
import Icon from '../components/Icon';
import ReturnLink from '../components/ReturnLink';
import PresentationJobCard from '../components/JobCard';

const explain = (error: unknown) => error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
const money = (job: LiveJob) => job.minimum_salary || job.maximum_salary ? `${job.minimum_salary ?? '…'} – ${job.maximum_salary ?? '…'} VND` : 'Thỏa thuận';
const emptyPage: JobPage = { items: [], total: 0, offset: 0, limit: 10 };
function JobCard({ job, own = false }: { job: LiveJob; own?: boolean }) {
  return <Panel title={job.title}><p>{job.company_name} · {job.province_name} · {job.industry_name}</p><p>{money(job)} · {jobStatusText[job.status]}</p><p>Hạn nộp: {job.application_deadline ?? 'Không có hạn cố định'}</p><Link className="ui-btn" href={own ? `/recruiter/jobs/${job.id}/edit` : `/jobs/${job.id}`}>{own ? 'Quản lý tin' : 'Xem chi tiết'}</Link></Panel>;
}

export function LiveJobList({ own = false }: { own?: boolean }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<JobCatalog>();
  const [page, setPage] = useState(emptyPage);
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let live = true; if (!own) getJobCatalog().then(value => { if (live) setCatalog(value); }).catch(reason => { if (live) setError(explain(reason)); }); return () => { live = false; }; }, [own]);
  useEffect(() => {
    let live = true;
    getJobs(`${query}&limit=10&offset=${offset}`, own).then(value => { if (live) setPage(value); }).catch(reason => { if (live) setError(explain(reason)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [query, offset, own]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true); setOffset(0);
    const form = new FormData(event.currentTarget); const params = new URLSearchParams();
    for (const [key, value] of form.entries()) if (String(value).trim()) params.set(key, String(value).trim());
    setQuery(params.toString());
    if (params.toString() === query && offset === 0) setLoading(false);
  }
  return <Page visual={own?'recruiter':undefined} eyebrow={own?'Không gian nhà tuyển dụng':undefined} title={own ? 'Quản lý tin tuyển dụng' : 'Tìm việc làm'} description={own?'Theo dõi các vị trí đang tuyển và quản lý trạng thái hiển thị của tin.':undefined} actions={own ? <Link className="ui-btn ui-btn-primary" href="/recruiter/jobs/new">+ Đăng tin tuyển dụng</Link> : undefined}>
    <form className="ui-form ui-panel" onSubmit={search}>
      {own ? <Field id="filter-status" label="Trạng thái"><select id="filter-status" name="status"><option value="">Tất cả</option>{Object.entries(jobStatusText).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field> : <>
        <Field id="filter-q" label="Từ khóa"><input id="filter-q" name="q" maxLength={200} placeholder="Vị trí, công ty…" /></Field>
        {(['provinces', 'industries', 'skills'] as const).map((key, index) => <Field key={key} id={`filter-${key}`} label={['Tỉnh/thành', 'Ngành nghề', 'Kỹ năng'][index]}><select id={`filter-${key}`} name={['province_id', 'industry_id', 'skill_id'][index]}><option value="">Tất cả</option>{catalog?.[key].map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>)}
        <Field id="filter-salary" label="Mức lương từ (VND)"><input id="filter-salary" name="minimum_salary" type="number" min="0" step="0.01" /></Field>
        <Field id="filter-sort" label="Sắp xếp"><select id="filter-sort" name="sort"><option value="newest">Mới nhất</option><option value="salary_desc">Lương giảm dần</option><option value="salary_asc">Lương tăng dần</option></select></Field>
      </>}
      <button className="ui-btn" disabled={loading}>Lọc tin</button>
    </form>
    {error && <Notice error>{error}</Notice>}
    {loading ? <p role="status">Đang tải tin…</p> : !error && <><div className="ui-toolbar"><p className="ui-muted"><strong>{page.total}</strong> tin tuyển dụng</p></div>{page.items.length ? own?<div className="cl-job-collection">{page.items.map(job => <PresentationJobCard key={job.id} job={liveJobToPresentation(job)} showMatch={false} showSave={false} headingLevel={2} status={<Badge value={jobStatusText[job.status]}/>} onView={()=>router.push(`/recruiter/jobs/${job.id}/edit`)}><div className="cl-job-management-actions"><p className="ui-small ui-muted">Hạn nộp: {job.application_deadline??'Không cố định'}</p><div className="ui-actions"><Link className="ui-btn" href={`/recruiter/jobs/${job.id}/edit`}>Quản lý tin</Link><Link className="ui-btn" href={`/recruiter/applicants?jobId=${job.id}`}>Xem ứng viên</Link></div></div></PresentationJobCard>)}</div>:page.items.map(job => <JobCard key={job.id} job={job} />) : <Empty title="Chưa có tin tuyển dụng phù hợp" text="Thử thay đổi bộ lọc hoặc tạo tin tuyển dụng đầu tiên."/>}</>}
    <div className="ui-actions"><button className="ui-btn" disabled={loading || offset === 0} onClick={() => { setLoading(true); setOffset(Math.max(0, offset - 10)); }}>Trang trước</button><span>Trang {offset / 10 + 1}</span><button className="ui-btn" disabled={loading || offset + 10 >= page.total} onClick={() => { setLoading(true); setOffset(offset + 10); }}>Trang sau</button></div>
  </Page>;
}

export function LiveJobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<LiveJob>(); const [error, setError] = useState('');
  useEffect(() => { let live = true; getJob(id).then(value => { if (live) setJob(value); }).catch(reason => { if (live) setError(reason instanceof ApiError && reason.status === 404 ? 'Tin không tồn tại hoặc hiện không công khai.' : explain(reason)); }); return () => { live = false; }; }, [id]);
  if (error) return <Page title="Chi tiết việc làm"><Notice error>{error}</Notice><Link className="ui-btn" href="/jobs">Quay lại danh sách</Link></Page>;
  if (!job) return <div className="ui-page"><div className="ui-container"><p role="status">Đang tải chi tiết việc làm…</p></div></div>;
  const view = liveJobToPresentation(job);
  return <div className="ui-page ui-job-page"><div className="ui-container">
    <ReturnLink fallback="/jobs">Quay lại danh sách việc làm</ReturnLink>
    <nav className="ui-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><Icon name="right"/><Link href="/jobs">Tìm việc làm</Link><Icon name="right"/><span>{view.category}</span></nav>
    <Panel className="ui-job-hero">
      <div className="ui-row ui-job-heading"><CompanyMark company={view.company} className="ui-job-company-mark"/><div className="ui-grow"><h1 className="ui-job-title">{view.title}</h1><p className="ui-job-company-name">{view.company.name}</p><div className="ui-job-meta"><span><Icon name="pin"/>{view.location}</span><span><Icon name="briefcase"/>{view.workType}</span><span>{view.postedLabel}</span></div></div></div>
      <div className="ui-job-action-row"><div><span className="ui-job-salary-label">Mức lương</span><p className="ui-salary">{view.salaryLabel}</p></div><div className="ui-actions"><a className="ui-btn ui-btn-primary" href="#ung-tuyen">Ứng tuyển ngay<Icon name="send"/></a></div></div>
    </Panel>
    <div className="ui-columns ui-job-body"><div className="ui-stack">
      <Panel className="ui-job-details"><section><h2>Mô tả công việc</h2><p className="ui-text ui-preline">{job.description}</p></section><section><h2>Yêu cầu ứng viên</h2><p className="ui-text ui-preline">{job.requirements}</p></section>{job.skills.length>0&&<section><h2>Kỹ năng</h2><div className="ui-tags">{job.skills.map(skill=><span className="ui-tag" key={skill.skill_id}>{skill.name}{skill.required?' · Bắt buộc':''}</span>)}</div></section>}</Panel>
      <Panel title="Thông tin nhà tuyển dụng"><div className="ui-row"><CompanyMark company={view.company} className="size-14"/><div><h3>{job.company_name}</h3><p className="ui-small ui-muted">{job.industry_name} · {job.province_name}</p></div></div></Panel>
      <section id="ung-tuyen" className="ui-panel"><ApplyToJob key={job.id} jobId={job.id}/></section>
    </div><aside className="ui-stack ui-sticky ui-job-sidebar"><Panel title="Thông tin chung"><dl className="ui-summary"><div><dt>Địa điểm</dt><dd>{view.location}</dd></div><div><dt>Cấp bậc</dt><dd>{job.level || 'Chưa cập nhật'}</dd></div><div><dt>Loại công việc</dt><dd>{job.work_type || 'Chưa cập nhật'}</dd></div><div><dt>Hạn nộp</dt><dd>{job.application_deadline || 'Không có hạn cố định'}</dd></div></dl></Panel></aside></div>
  </div></div>;
}

export function LiveJobEditor({ id }: { id?: string }) {
  const router = useRouter(); const [catalog, setCatalog] = useState<JobCatalog>(); const [job, setJob] = useState<LiveJob>();
  const [company, setCompany] = useState<CompanyProfile>();
  const [province, setProvince] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; getMyCompany().then(async current => { if (live) setCompany(current); if (current.approval_status !== 'APPROVED') return; const [c, j] = await Promise.all([getJobCatalog(), id ? getJob(id, true) : Promise.resolve(undefined)]); if (live) { setCatalog(c); setJob(j); setProvince(j?.province_id ?? ''); } }).catch(reason => { if (live) setError(explain(reason)); }); return () => { live = false; }; }, [id]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget); const values: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) if (key !== 'skill_ids') values[key] = String(value).trim() || null;
    values.skills = form.getAll('skill_ids').map(value => { const skill_id = String(value); const previous = job?.skills.find(item => item.skill_id === skill_id); return { skill_id, required: previous?.required ?? false, priority: previous?.priority ?? 0 }; });
    try { const saved = await saveJob(values, id); setJob(saved); setNotice('Đã lưu tin nháp. Hãy gửi duyệt khi hoàn thiện.'); if (!id) router.replace(`/recruiter/jobs/${saved.id}/edit`); }
    catch (reason) { setError(explain(reason)); } finally { setBusy(false); }
  }
  async function action(name: string) { if (!job) return; setBusy(true); setError(''); setNotice(''); try { const saved = await jobAction(job.id, name); setJob(saved); setNotice(`Đã cập nhật: ${jobStatusText[saved.status]}.`); } catch (reason) { setError(explain(reason)); } finally { setBusy(false); } }
  return <Page visual="recruiter" eyebrow="Không gian nhà tuyển dụng" title={id ? 'Quản lý tin tuyển dụng' : 'Đăng tin tuyển dụng'} description="Soạn nội dung rõ ràng, lưu bản nháp và gửi Admin kiểm duyệt khi đã hoàn thiện." actions={<Link className="ui-btn" href="/recruiter/jobs">Quay lại danh sách</Link>}>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    {!company && !error && <p role="status">Đang tải thông tin doanh nghiệp…</p>}
    {company && company.approval_status !== 'APPROVED' && <Panel title="Doanh nghiệp cần được duyệt"><p>Hãy hoàn thiện hồ sơ và chờ Admin phê duyệt trước khi tuyển dụng.</p><Link className="ui-btn" href="/recruiter/company">Hồ sơ công ty</Link></Panel>}
    {job && <Panel><p>Trạng thái: <strong>{jobStatusText[job.status]}</strong></p>{job.rejection_reason && <Notice error>{job.rejection_reason}</Notice>}<div className="ui-actions">
      {['DRAFT', 'REJECTED'].includes(job.status) && <button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => action('submit')}>Gửi duyệt</button>}
      {job.status === 'APPROVED' && <button className="ui-btn" disabled={busy} onClick={() => action('pause')}>Tạm dừng</button>}
      {job.status === 'PAUSED' && <button className="ui-btn" disabled={busy} onClick={() => action('reopen')}>Mở lại và gửi duyệt</button>}
      {job.status !== 'CLOSED' && <button className="ui-btn" disabled={busy} onClick={() => action('close')}>Đóng tin</button>}
    </div></Panel>}
    {catalog && (!id || job) && <form key={job?.id ?? 'new'} className="ui-form ui-panel" onSubmit={save}>
      <fieldset disabled={busy || job?.status === 'CLOSED'} style={{ border: 0, padding: 0 }}>
        <Field id="job-title" label="Tiêu đề *"><input id="job-title" name="title" required maxLength={255} defaultValue={job?.title} /></Field>
        <Field id="job-industry" label="Ngành nghề *"><select id="job-industry" name="industry_id" required defaultValue={job?.industry_id ?? ''}><option value="">Chọn ngành nghề</option>{job && !catalog.industries.some(item => item.id === job.industry_id) && <option value={job.industry_id}>{job.industry_name} (đã ngừng chọn mới)</option>}{catalog.industries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field id="job-province" label="Tỉnh/thành *"><select id="job-province" name="province_id" required value={province} onChange={event => setProvince(event.target.value)}><option value="">Chọn tỉnh/thành</option>{catalog.provinces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field id="job-ward" label="Xã/phường"><select key={province} id="job-ward" name="ward_id" defaultValue={job?.province_id === province ? job.ward_id ?? '' : ''}><option value="">Chưa chọn</option>{catalog.wards.filter(item => item.province_id === province).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {([['description', 'Mô tả công việc'], ['requirements', 'Yêu cầu']] as const).map(([key, label]) => <Field key={key} id={`job-${key}`} label={`${label} (bắt buộc khi gửi duyệt)`}><textarea id={`job-${key}`} name={key} maxLength={16000} defaultValue={job?.[key] ?? ''} rows={5} /></Field>)}
        {([['street', 'Địa chỉ', 255], ['level', 'Cấp bậc', 100], ['work_type', 'Hình thức làm việc', 60]] as const).map(([key, label, max]) => <Field key={key} id={`job-${key}`} label={label}><input id={`job-${key}`} name={key} maxLength={max} defaultValue={job?.[key] ?? ''} /></Field>)}
        {([['minimum_salary', 'Lương tối thiểu', '0.01'], ['maximum_salary', 'Lương tối đa', '0.01'], ['years_experience', 'Số năm kinh nghiệm', '0.1']] as const).map(([key, label, step]) => <Field key={key} id={`job-${key}`} label={label}><input id={`job-${key}`} name={key} type="number" min="0" step={step} defaultValue={job?.[key] ?? ''} /></Field>)}
        <Field id="job-deadline" label="Hạn nộp" hint="Để trống nghĩa là không có hạn cố định; hạn có hiệu lực hết ngày UTC."><input id="job-deadline" name="application_deadline" type="date" defaultValue={job?.application_deadline ?? ''} /></Field>
        <Field id="job-skills" label="Kỹ năng (giữ Ctrl để chọn nhiều)"><select id="job-skills" name="skill_ids" multiple defaultValue={job?.skills.map(item => item.skill_id) ?? []}>{job?.skills.filter(item => !catalog.skills.some(active => active.id === item.skill_id)).map(item => <option key={item.skill_id} value={item.skill_id}>{item.name} (đã ngừng chọn mới)</option>)}{catalog.skills.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Notice>Chỉnh sửa nội dung sẽ đưa tin về bản nháp và cần gửi duyệt lại.</Notice><button className="ui-btn ui-btn-primary" disabled={busy}>Lưu tin nháp</button>
      </fieldset>
    </form>}
    <Link className="ui-btn" href="/recruiter/jobs">Danh sách tin</Link>
  </Page>;
}

export function AdminWorkspace() {
  const session = useAuthSession(); const router = useRouter();
  const [companies, setCompanies] = useState<CompanyReviewRow[]>([]); const [jobs, setJobs] = useState(emptyPage);
  const [companyState, setCompanyState] = useState('PENDING'); const [jobState, setJobState] = useState('PENDING');
  const [companyOffset, setCompanyOffset] = useState(0); const [jobOffset, setJobOffset] = useState(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [version, setVersion] = useState(0);
  useEffect(() => { if (session?.user.role !== 'ADMIN') router.replace('/admin/sign-in'); }, [router, session]);
  useEffect(() => { let live = true; if (session?.user.role === 'ADMIN') { listReviewCompanies(`status=${companyState}&limit=10&offset=${companyOffset}`).then(value => { if (live) setCompanies(value); }).catch(reason => { if (live) setError(explain(reason)); }); getJobs(`status=${jobState}&limit=10&offset=${jobOffset}`, false, true).then(value => { if (live) setJobs(value); }).catch(reason => { if (live) setError(explain(reason)); }); } return () => { live = false; }; }, [session, version, companyState, jobState, companyOffset, jobOffset]);
  async function review(kind: 'company' | 'job', id: string, status: 'APPROVED' | 'REJECTED') {
    const reason = kind === 'job' && status === 'REJECTED' ? window.prompt('Lý do từ chối') : undefined;
    if (kind === 'job' && status === 'REJECTED' && !reason?.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try { if (kind === 'company') await reviewCompany(id, status); else await reviewJob(id, status, reason ?? undefined); setNotice(`Đã ${status === 'APPROVED' ? 'phê duyệt' : 'từ chối'}.`); setVersion(value => value + 1); }
    catch (reason) { setError(explain(reason)); } finally { setBusy(false); }
  }
  if (session?.user.role !== 'ADMIN') return <p>Đang kiểm tra quyền…</p>;
  return <Page title="Admin · Kiểm duyệt" actions={<button className="ui-btn" onClick={() => { logout(); router.push('/admin/sign-in'); }}>Đăng xuất</button>}>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <Panel title="Doanh nghiệp"><select aria-label="Lọc trạng thái doanh nghiệp" value={companyState} onChange={event => { setCompanyState(event.target.value); setCompanyOffset(0); }}>{['PENDING', 'APPROVED', 'REJECTED'].map(value => <option key={value}>{value}</option>)}</select>
      {companies.map(item => <article className="ui-panel" key={item.company_id}><h3>{item.company_name}</h3><p>MST: {item.tax_code} · {item.approval_status}</p><button className="ui-btn" disabled={busy || item.approval_status === 'APPROVED'} onClick={() => review('company', item.company_id, 'APPROVED')}>Duyệt doanh nghiệp</button><button className="ui-btn" disabled={busy || item.approval_status === 'REJECTED'} onClick={() => review('company', item.company_id, 'REJECTED')}>Từ chối doanh nghiệp</button></article>)}
      {!companies.length && <p>Không có doanh nghiệp trong danh sách này.</p>}<button className="ui-btn" disabled={!companyOffset} onClick={() => setCompanyOffset(value => value - 10)}>Trước</button><button className="ui-btn" disabled={companies.length < 10} onClick={() => setCompanyOffset(value => value + 10)}>Sau</button>
    </Panel>
    <Panel title="Tin tuyển dụng"><select aria-label="Lọc trạng thái tin" value={jobState} onChange={event => { setJobState(event.target.value); setJobOffset(0); }}>{Object.entries(jobStatusText).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      {jobs.items.map(item => <article className="ui-panel" key={item.id}><h3>{item.title}</h3><p>{item.company_name} · {item.province_name}</p><p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p><p style={{ whiteSpace: 'pre-wrap' }}>{item.requirements}</p><p>{money(item)} · {item.skills.map(s => s.name).join(', ')} · Hạn: {item.application_deadline ?? 'Không cố định'}</p>{item.status === 'PENDING' && <><button className="ui-btn" disabled={busy} onClick={() => review('job', item.id, 'APPROVED')}>Duyệt tin</button><button className="ui-btn" disabled={busy} onClick={() => review('job', item.id, 'REJECTED')}>Từ chối tin</button></>}</article>)}
      {!jobs.items.length && <p>Không có tin trong danh sách này.</p>}<button className="ui-btn" disabled={!jobOffset} onClick={() => setJobOffset(value => value - 10)}>Trước</button><button className="ui-btn" disabled={jobOffset + 10 >= jobs.total} onClick={() => setJobOffset(value => value + 10)}>Sau</button>
    </Panel>
  </Page>;
}
