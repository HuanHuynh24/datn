'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiRequest, downloadPrivateCV, useAuthSession } from '../auth-client';
import { Badge, Empty, Field, Notice, Page, Panel } from '../ui';
import Icon from '../components/Icon';
import ProfileNavigation from '../components/ProfileNavigation';

type CV = { id: string; is_primary: boolean; status: string; created_at: string; format: string };
type Application = { id: string; candidate_name: string; candidate_email: string; job_id: string; job_title: string; company_name: string; status: string; cover_letter: string | null; submitted_at: string };
type Results = { items: Application[]; total: number };
const cvPath = '/api/v1/candidates/me/cvs';
const explain = (error: unknown) => error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';
const statuses: Record<string, string> = { APPLIED: 'Đã nộp', REVIEWING: 'Đang xem xét', INTERVIEW: 'Phỏng vấn', OFFER: 'Đề nghị tuyển dụng', HIRED: 'Đã tuyển', REJECTED: 'Từ chối' };
const transitions: Record<string, string[]> = { APPLIED: ['REVIEWING', 'REJECTED'], REVIEWING: ['INTERVIEW', 'OFFER', 'REJECTED'], INTERVIEW: ['OFFER', 'REJECTED'], OFFER: ['HIRED', 'REJECTED'], HIRED: [], REJECTED: [] };

export function LiveCVs() {
  const [cvs, setCVs] = useState<CV[]>([]); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const reload = () => apiRequest<CV[]>(cvPath).then(setCVs);
  useEffect(() => { let live = true; apiRequest<CV[]>(cvPath).then(value => { if (live) setCVs(value); }).catch(error => { if (live) setError(explain(error)); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await reload(); setMessage(message); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) { setError('Chọn PDF hoặc DOCX tối đa 10 MiB.'); return; }
    void act(async () => { await apiRequest(cvPath, { method: 'POST', body: data }); form.reset(); }, 'Đã tải CV lên.');
  }
  const primary=cvs.find(cv=>cv.is_primary);
  return <Page visual="candidate" eyebrow="Hồ sơ & CV" title="Quản lý CV" description="Lưu các bản CV, tải xuống và chọn bản mặc định khi ứng tuyển.">
    <ProfileNavigation active="cvs"/>
    <div className="ui-cv-overview"><div><span className="ui-cv-side-icon"><Icon name="document"/></span><div><strong>{cvs.length} CV đang hoạt động</strong><p>PDF hoặc DOCX · Tối đa 10 MiB</p></div></div><div><span className={primary?'ui-cv-overview-check':'ui-cv-side-icon'}><Icon name={primary?'check':'document'}/></span><div><strong>{primary?'Đã chọn CV mặc định':'Chưa có CV mặc định'}</strong><p>{primary?`CV #${primary.id}`:'Tải CV đầu tiên để bắt đầu'}</p></div></div></div>
    {error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
    <div className="ui-cv-layout"><div className="ui-stack"><Panel title="Thêm CV mới" action={<span className="ui-small ui-muted">PDF, DOCX · Tối đa 10 MiB</span>}><form onSubmit={upload} className="ui-form"><label className="ui-cv-dropzone" htmlFor="cv-file"><span className="ui-cv-upload-art" aria-hidden="true"><span>CV</span><Icon name="document"/><b>↑</b></span><strong>Chọn CV từ thiết bị</strong><span className="ui-muted">Tệp được lưu riêng tư trên hệ thống</span><span className="ui-btn ui-btn-primary">Chọn tệp CV</span></label><input className="sr-only" id="cv-file" name="file" type="file" accept=".pdf,.docx" required/><button className="ui-btn ui-btn-primary" disabled={busy||loading}>Tải CV lên</button></form><p className="ui-cv-privacy"><Icon name="shield"/>Lưu trữ CV không làm thay đổi bản đã nộp trong đơn ứng tuyển.</p></Panel>
      <Panel title="CV đã lưu" action={<span className="ui-cv-count">{cvs.length}</span>}>{loading?<p role="status">Đang tải CV…</p>:!cvs.length&&!error?<Empty icon="document" title="Chưa có CV hoạt động" text="Tải CV đầu tiên để sẵn sàng ứng tuyển."/>:<div className="ui-cv-list">{cvs.map(cv=><article className="ui-cv-card" data-default={cv.is_primary} key={cv.id}><div className="ui-cv-card-main"><span className={`ui-cv-file-thumb ui-cv-file-thumb-${cv.format.toLowerCase()}`}><Icon name="document"/><span>{cv.format.toUpperCase()}</span></span><div className="ui-grow"><div className="ui-cv-card-title"><h3>CV #{cv.id}</h3>{cv.is_primary&&<span className="ui-badge ui-badge-green"><Icon name="check"/>Mặc định</span>}</div><p className="ui-small ui-muted">{new Date(cv.created_at).toLocaleString('vi-VN')}</p></div></div><div className="ui-cv-card-actions"><button className="ui-link" disabled={busy} onClick={()=>void act(()=>downloadPrivateCV(`${cvPath}/${cv.id}/download`,`cv-${cv.id}`),'Đã tải tệp.')}>Tải xuống</button><button className="ui-link" disabled={busy} onClick={()=>void act(()=>apiRequest(`${cvPath}/${cv.id}`,{method:'PATCH',body:JSON.stringify({is_primary:!cv.is_primary})}),'Đã cập nhật CV chính.')}>{cv.is_primary?'Bỏ CV chính':'Đặt mặc định'}</button><button className="ui-cv-delete" disabled={busy} onClick={()=>void act(()=>apiRequest(`${cvPath}/${cv.id}`,{method:'DELETE'}),'Đã lưu trữ CV.')}><Icon name="close"/>Lưu trữ</button></div></article>)}</div>}</Panel></div>
      <aside className="ui-stack"><Panel title="Quyền riêng tư"><p className="ui-text">CV không được công khai. Nhà tuyển dụng chỉ có thể tải bản CV được lưu cùng đơn ứng tuyển của bạn.</p></Panel><Link className="ui-btn ui-btn-primary" href="/candidate/applications">Theo dõi đơn ứng tuyển<Icon name="right"/></Link></aside>
    </div>
  </Page>;
}

export function ApplyToJob({ jobId }: { jobId: string }) {
  const session = useAuthSession(); const candidate = session?.user.role === 'CANDIDATE';
  const [cvs, setCVs] = useState<CV[]>([]); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { let live = true; if (candidate) apiRequest<CV[]>(cvPath).then(value => { if (live) setCVs(value); }).catch(error => { if (live) setError(explain(error)); }); return () => { live = false; }; }, [candidate]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await apiRequest(`/api/v1/jobs/${jobId}/applications`, { method: 'POST', body: JSON.stringify({ cv_id: data.get('cv_id'), cover_letter: data.get('cover_letter') || null }) }); setDone(true); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  if (!session) return <Link className="ui-btn" href="/sign-in">Đăng nhập để ứng tuyển</Link>;
  if (!candidate) return <p>Chỉ tài khoản ứng viên có thể ứng tuyển.</p>;
  if (done) return <Notice>Đã nộp hồ sơ. <Link href="/candidate/applications">Theo dõi đơn ứng tuyển</Link></Notice>;
  return <section><h2>Ứng tuyển</h2>{error && <Notice error>{error}</Notice>}{cvs.length ? <form onSubmit={submit} className="ui-form"><Field id="apply-cv" label="Chọn CV"><select id="apply-cv" name="cv_id" required defaultValue={cvs.find(cv => cv.is_primary)?.id ?? cvs[0].id}>{cvs.map(cv => <option key={cv.id} value={cv.id}>CV #{cv.id} · {cv.format.toUpperCase()}{cv.is_primary ? ' · CV chính' : ''}</option>)}</select></Field><Field id="cover-letter" label="Thư giới thiệu"><textarea id="cover-letter" name="cover_letter" maxLength={16000} /></Field><button className="ui-btn ui-btn-primary" disabled={busy}>Nộp hồ sơ</button></form> : <p>Cần có CV hoạt động để ứng tuyển.</p>}<Link href="/candidate/cvs">Quản lý CV</Link></section>;
}

export function LiveApplications({ employer = false }: { employer?: boolean }) {
  const session = useAuthSession(); const [result, setResult] = useState<Results>({ items: [], total: 0 });
  const [status, setStatus] = useState(''); const [jobId, setJobId] = useState(''); const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const base = employer ? '/api/v1/companies/me/applications' : '/api/v1/candidates/me/applications';
  useEffect(() => { let live = true; const query = new URLSearchParams({ limit: '10', offset: String(offset) }); if (status) query.set('status', status); if (jobId) query.set('job_id', jobId); apiRequest<Results>(`${base}?${query}`).then(value => { if (live) setResult(value); }).catch(error => { if (live) setError(explain(error)); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [base, status, jobId, offset, version]);
  async function change(id: string, next: string) {
    setBusy(true); setError(''); try { await apiRequest(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); setVersion(value => value + 1); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  return <Page visual={employer?'team':'candidate'} eyebrow={employer?'Không gian nhà tuyển dụng':'Không gian ứng viên'} title={employer?'Hồ sơ ứng tuyển':'Việc làm đã ứng tuyển'} description={employer?'Xem xét hồ sơ và cập nhật ứng viên trong quy trình tuyển dụng.':'Theo dõi tiến độ từng hồ sơ và chuẩn bị cho các bước tiếp theo.'}><form className="ui-toolbar ui-panel" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setError(''); setLoading(true); setStatus(String(data.get('status') || '')); setJobId(String(data.get('job_id') || '')); setOffset(0); setVersion(v => v + 1); }}><Field id="application-status" label="Trạng thái"><select id="application-status" name="status"><option value="">Tất cả</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></Field>{employer && <Field id="application-job" label="Mã tin tuyển dụng"><input id="application-job" name="job_id" inputMode="numeric" pattern="[1-9][0-9]*" /></Field>}<button className="ui-btn" disabled={busy}>Lọc hồ sơ</button></form>
    {error&&<Notice error>{error}</Notice>}{loading?<p role="status">Đang tải đơn ứng tuyển…</p>:<><div className="ui-toolbar"><p className="ui-muted"><strong>{result.total}</strong> đơn ứng tuyển</p></div>{result.items.length?<div className="cl-job-collection">{result.items.map(item=><Panel key={item.id} title={item.job_title}><div className="ui-row ui-row-between"><p>{item.company_name}{employer&&` · ${item.candidate_name}`}</p><Badge value={statuses[item.status]??item.status}/></div><p className="ui-small ui-muted">{new Date(item.submitted_at).toLocaleString('vi-VN')}{employer&&` · ${item.candidate_email}`}</p>{item.cover_letter&&<details open className="ui-application-copy"><summary>Thư giới thiệu</summary><p className="ui-preline">{item.cover_letter}</p></details>}<div className="ui-actions"><button className="ui-btn" onClick={()=>void downloadPrivateCV(`/api/v1/applications/${item.id}/cv`,`application-${item.id}`).catch(error=>setError(explain(error)))}>Tải CV đã nộp</button>{employer&&transitions[item.status]?.map(next=><button className="ui-btn" key={next} disabled={busy||session?.company?.approval_status!=='APPROVED'} onClick={()=>void change(item.id,next)}>{statuses[next]}</button>)}</div></Panel>)}</div>:<Empty title="Chưa có đơn ứng tuyển" text={employer?'Chưa có ứng viên phù hợp với bộ lọc hiện tại.':'Đơn ứng tuyển sẽ xuất hiện tại đây sau khi bạn nộp hồ sơ.'}/>}</>}
    <div className="ui-actions"><button className="ui-btn" disabled={loading || offset === 0} onClick={() => { setLoading(true); setOffset(Math.max(0, offset - 10)); }}>Trang trước</button><span>Trang {offset / 10 + 1}</span><button className="ui-btn" disabled={loading || offset + 10 >= result.total} onClick={() => { setLoading(true); setOffset(offset + 10); }}>Trang sau</button></div></Page>;
}
