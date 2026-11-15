'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { downloadPrivateCV, useAuthSession } from '../auth-client';
import { applicationStatuses, applicationTransitions, getApplication, listApplications, updateApplicationStatus, type ApplicationPage, type ApplicationRecord, type ApplicationStatus } from '../applications-client';
import Dialog from '../components/Dialog';
import CandidateApplicationsView from './CandidateApplicationsView';
import { Badge, Empty, Field, Notice, Page, Panel } from '../ui';

const explain = (error: unknown) => error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
const validId = (value: string) => /^[1-9][0-9]{0,18}$/.test(value);
const isStatus = (value: string): value is ApplicationStatus => Object.hasOwn(applicationStatuses, value);

export default function ApplicationsWorkspace({ employer = false, pipeline = false }: { employer?: boolean; pipeline?: boolean }) {
  const params = useSearchParams();
  return <Workspace key={`${employer}:${pipeline}:${params}`} employer={employer} pipeline={pipeline} search={params.toString()} />;
}

function Workspace({ employer, pipeline, search }: { employer: boolean; pipeline: boolean; search: string }) {
  const session = useAuthSession();
  const authorized = session?.user.role === (employer ? 'COMPANY_MEMBER' : 'CANDIDATE');
  const router = useRouter();
  const pathname = usePathname();
  const params = new URLSearchParams(search);
  const rawStatus = params.get('status') ?? '';
  const legacy: Record<string, string> = { Interview: 'INTERVIEW', Rejected: 'REJECTED', all: '', active: '' };
  const status = legacy[rawStatus] ?? rawStatus;
  const jobId = params.get('jobId') ?? params.get('job_id') ?? '';
  const applicationId = params.get('application_id') ?? '';
  const rawPage = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1;
  const invalid = (!!status && !isStatus(status)) || (!!jobId && !validId(jobId)) || (!!applicationId && !validId(applicationId));
  const [result, setResult] = useState<ApplicationPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!authorized || invalid) return;
    let active = true;
    const query = new URLSearchParams({ limit: '10', offset: String((page - 1) * 10) });
    if (status) query.set('status', status);
    if (jobId) query.set('job_id', jobId);
    listApplications(employer, query.toString()).then(value => { if (active) setResult(value); })
      .catch(reason => { if (active) setError(explain(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authorized, invalid, employer, status, jobId, page, version]);

  function navigate(values: Record<string, string>, resetPage = false) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    if (resetPage) { next.delete('page'); next.delete('application_id'); }
    router.push(pathname + (next.size ? '?' + next.toString() : ''), { scroll: false });
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    navigate({ status: String(data.get('status') || ''), jobId: String(data.get('job_id') || '').trim(), job_id: '' }, true);
  }
  const failure = invalid ? 'Bộ lọc hoặc mã đơn không hợp lệ. Hãy xóa bộ lọc và chọn lại.' : error;
  function retryList() { setError(''); setLoading(true); setVersion(value => value + 1); }
  async function download(id: string) {
    if (downloading) return;
    setDownloading(id); setDownloadError('');
    try { await downloadPrivateCV(`/api/v1/applications/${id}/cv`, `application-${id}`); }
    catch (reason) { setDownloadError(explain(reason)); }
    finally { setDownloading(undefined); }
  }
  const base = employer ? '/recruiter/applicants' : '/candidate/applications';
  const jobQuery = jobId ? '?' + new URLSearchParams({ jobId }) : '';
  if (!authorized) return <p role="status">Đang kiểm tra quyền truy cập…</p>;
  if (!employer) return <CandidateApplicationsView result={result} loading={loading} error={failure} status={status} jobId={jobId} page={page} navigate={navigate} retry={()=>{setError('');setLoading(true);setVersion(value=>value+1);}} download={id=>downloadPrivateCV(`/api/v1/applications/${id}/cv`,`application-${id}`)}>
    {applicationId&&!invalid&&<ApplicationDetail key={applicationId} id={applicationId} employer={false} onClose={()=>navigate({application_id:''})} onChanged={()=>{setError('');setLoading(true);setVersion(value=>value+1);}}/>}
  </CandidateApplicationsView>;
  return <Page visual={employer ? 'team' : 'candidate'} eyebrow={employer ? 'Không gian nhà tuyển dụng' : 'Không gian ứng viên'} title={pipeline ? 'Quy trình tuyển dụng' : employer ? 'Hồ sơ ứng tuyển' : 'Việc làm đã ứng tuyển'} description={pipeline ? 'Theo dõi hồ sơ theo từng giai đoạn tuyển dụng.' : employer ? 'Xem hồ sơ và cập nhật trạng thái trong quy trình tuyển dụng.' : 'Theo dõi tiến độ từng hồ sơ đã nộp.'}>
    {employer && <nav className="ui-tabs" aria-label="Chế độ xem hồ sơ"><Link className="ui-btn" aria-current={!pipeline ? 'page' : undefined} href={'/recruiter/applicants' + jobQuery}>Danh sách hồ sơ</Link><Link className="ui-btn" aria-current={pipeline ? 'page' : undefined} href={'/recruiter/pipeline' + jobQuery}>Quy trình tuyển dụng</Link></nav>}
    {employer && session?.company?.approval_status !== 'APPROVED' && <Notice>Doanh nghiệp cần được phê duyệt để cập nhật trạng thái đơn ứng tuyển.</Notice>}
    {pipeline && <nav className="ui-tabs" aria-label="Giai đoạn tuyển dụng"><button aria-pressed={!status} onClick={() => navigate({ status: '' }, true)}>Tất cả</button>{Object.entries(applicationStatuses).map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => navigate({ status: key }, true)}>{label}</button>)}</nav>}
    <form className="ui-toolbar ui-panel" onSubmit={filter}>
      <Field id="application-status" label="Trạng thái"><select id="application-status" name="status" defaultValue={status}><option value="">Tất cả</option>{Object.entries(applicationStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field id="application-job" label="Mã tin tuyển dụng"><input id="application-job" name="job_id" inputMode="numeric" pattern="[1-9][0-9]{0,18}" defaultValue={jobId} /></Field>
      <button className="ui-btn">Lọc hồ sơ</button><Link className="ui-btn" href={pipeline ? '/recruiter/pipeline' : base}>Xóa bộ lọc</Link>
    </form>
    {downloadError && <div role="alert"><Notice error>{downloadError}</Notice><button className="ui-link" onClick={() => setDownloadError('')}>Đóng thông báo tải CV</button></div>}
    {failure ? <div role="alert"><Notice error>{failure}</Notice>{!invalid && <button className="ui-btn" onClick={retryList}>Thử tải lại đơn ứng tuyển</button>}</div> : loading ? <p role="status">Đang tải đơn ứng tuyển…</p> : result && <>
      <p className="ui-muted"><strong>{result.total}</strong> đơn ứng tuyển{status ? ` · ${applicationStatuses[status as ApplicationStatus]}` : ''}</p>
      {result.items.length ? <div className="cl-job-collection">{result.items.map(item => <Panel key={item.id} title={item.job_title}>
        <div className="ui-row ui-row-between"><p>{item.company_name}{employer ? ` · ${item.candidate_name}` : ''}</p><Badge value={applicationStatuses[item.status]} status={item.status} /></div>
        <p className="ui-small ui-muted">{new Date(item.submitted_at).toLocaleString('vi-VN')}{employer ? ` · ${item.candidate_email}` : ''}</p>
        {item.cover_letter && <details className="ui-application-copy"><summary>Thư giới thiệu</summary><p className="ui-preline">{item.cover_letter}</p></details>}
        <div className="ui-actions"><button className="ui-btn" onClick={() => navigate({ application_id: item.id })}>Chi tiết đơn #{item.id}</button><button className="ui-btn" disabled={!!downloading} onClick={() => void download(item.id)}>{downloading === item.id ? 'Đang tải CV…' : 'Tải CV đã nộp'}</button></div>
      </Panel>)}</div> : <Empty title="Chưa có đơn ứng tuyển" text="Không có đơn phù hợp với bộ lọc hiện tại." />}
      <div className="ui-actions"><button className="ui-btn" disabled={page === 1} onClick={() => navigate({ page: String(page - 1), application_id: '' })}>Trang trước</button><span>Trang {page}</span><button className="ui-btn" disabled={page * 10 >= result.total} onClick={() => navigate({ page: String(page + 1), application_id: '' })}>Trang sau</button></div>
    </>}
    {applicationId && !invalid && <ApplicationDetail key={applicationId} id={applicationId} employer={employer} onClose={() => navigate({ application_id: '' })} onChanged={() => { setError(''); setLoading(true); setVersion(value => value + 1); }} />}
  </Page>;
}

function ApplicationDetail({ id, employer, onClose, onChanged }: { id: string; employer: boolean; onClose: () => void; onChanged: () => void }) {
  const session = useAuthSession();
  const [record, setRecord] = useState<ApplicationRecord>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ApplicationStatus>();
  const [message, setMessage] = useState('');
  const [readError, setReadError] = useState('');
  const [version, setVersion] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let active = true;
    getApplication(id).then(value => { if (active) setRecord(value); }).catch(reason => { if (active) setReadError(explain(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, version]);
  function retryDetail() { if (busy || downloading) return; setReadError(''); setError(''); setLoading(true); setConfirmation(undefined); setVersion(value => value + 1); }
  async function download() {
    if (busy || downloading) return;
    setDownloading(true); setError('');
    try { await downloadPrivateCV(`/api/v1/applications/${id}/cv`, `application-${id}`); }
    catch (reason) { setError(explain(reason)); }
    finally { setDownloading(false); }
  }
  async function change() {
    if (!confirmation || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { const value = await updateApplicationStatus(id, confirmation); setRecord(value); setConfirmation(undefined); setMessage('Đã cập nhật trạng thái đơn.'); onChanged(); }
    catch (reason) { setError(explain(reason)); }
    finally { setBusy(false); }
  }
  const canManage = employer && session?.user.role === 'COMPANY_MEMBER' && session.company?.approval_status === 'APPROVED';
  return <Dialog title={`Chi tiết đơn #${id}`} onClose={() => { if (!busy) onClose(); }}>
    {loading && <p role="status">Đang tải chi tiết đơn…</p>}{readError && <div role="alert"><Notice error>{readError}</Notice><button className="ui-btn" onClick={retryDetail}>Thử tải lại chi tiết đơn</button></div>}{error && <div role="alert"><Notice error>{error}</Notice></div>}{message && <div role="status"><Notice>{message}</Notice></div>}
    {!loading && !readError && record && <div className="ui-stack">
      <h3>{record.job_title}</h3><p>{record.company_name}</p><Badge value={applicationStatuses[record.status]} status={record.status} />
      <p>Ứng viên: {record.candidate_name}</p><p>Email: {record.candidate_email}</p>
      <p>Nộp lúc: {new Date(record.submitted_at).toLocaleString('vi-VN')}</p><p>Cập nhật: {new Date(record.updated_at).toLocaleString('vi-VN')}</p>
      <section><h3>Thư giới thiệu</h3><p className="ui-preline">{record.cover_letter || 'Không có thư giới thiệu.'}</p></section>
      <p className="ui-small ui-muted">CV là bản đã lưu tại thời điểm ứng tuyển.</p>
      <button className="ui-btn" disabled={busy || downloading} onClick={() => void download()}>{downloading ? 'Đang tải CV…' : 'Tải CV đã nộp'}</button>
      <button className="ui-link" disabled={busy || downloading} onClick={retryDetail}>Làm mới chi tiết đơn</button>
      {canManage && <div className="ui-actions">{applicationTransitions[record.status].map(next => <button className="ui-btn" key={next} disabled={busy} onClick={() => { setConfirmation(next); setError(''); setMessage(''); }}>{applicationStatuses[next]}</button>)}</div>}
      {confirmation && <section className="ui-panel"><p>Xác nhận chuyển từ “{applicationStatuses[record.status]}” sang “{applicationStatuses[confirmation]}”?</p><div className="ui-actions"><button className="ui-btn ui-btn-primary" disabled={busy} onClick={() => void change()}>Xác nhận trạng thái đơn</button><button className="ui-btn" disabled={busy} onClick={() => setConfirmation(undefined)}>Hủy</button></div></section>}
    </div>}
  </Dialog>;
}
