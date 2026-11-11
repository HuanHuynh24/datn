'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, logout, useAuthSession } from '../auth-client';
import { reviewCompany, reviewJob } from '../jobs-client';
import Dialog from '../components/Dialog';
import { Field, Notice, Panel } from '../ui';
import './admin-management.css';

type Resource = 'accounts' | 'candidates' | 'companies' | 'jobs' | 'industries' | 'skills' | 'packages';
type RecordRow = { id: string; name: string; status?: string | null; email?: string | null; role?: string | null; account_id?: string | null; company_name?: string | null; tax_code?: string | null; created_at?: string | null; description?: string | null; requirements?: string | null; position?: string | null; package_code?: string | null; member_limit?: number | null; monthly_price?: string | null };
type Results = { items: RecordRow[]; total: number; limit: number; offset: number };
type Dashboard = Record<Resource | 'applications' | 'cvs', number> & { accounts_by_status: Record<string, number>; companies_by_status: Record<string, number>; jobs_by_status: Record<string, number>; applications_by_status: Record<string, number>; generated_at: string };
const labels: Record<Resource, string> = { accounts: 'Tài khoản', candidates: 'Ứng viên', companies: 'Doanh nghiệp', jobs: 'Tin tuyển dụng', industries: 'Ngành nghề', skills: 'Kỹ năng', packages: 'Gói doanh nghiệp' };
const statusLabels: Record<string, string> = { ACTIVE: 'Hoạt động', DISABLED: 'Vô hiệu hóa', INACTIVE: 'Ngừng hoạt động', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', DRAFT: 'Bản nháp', PAUSED: 'Tạm dừng', CLOSED: 'Đã đóng', APPLIED: 'Đã nộp', REVIEWING: 'Đang xem xét', INTERVIEW: 'Phỏng vấn', OFFER: 'Đề nghị tuyển dụng', HIRED: 'Đã tuyển' };
const filters: Record<Resource, string[]> = { accounts: ['ACTIVE', 'DISABLED'], candidates: ['ACTIVE', 'DISABLED'], companies: ['PENDING', 'APPROVED', 'REJECTED'], jobs: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'CLOSED'], industries: ['ACTIVE', 'INACTIVE'], skills: ['ACTIVE', 'INACTIVE'], packages: [] };
const explain = (error: unknown) => error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.';

export default function AdminManagement() {
  const session = useAuthSession();
  const router = useRouter(); const [tab, setTab] = useState<Resource | 'dashboard'>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard>(); const [result, setResult] = useState<Results>();
  const [query, setQuery] = useState(''); const [offset, setOffset] = useState(0); const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<RecordRow>(); const [detailLoading, setDetailLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [accountAction, setAccountAction] = useState<'ACTIVE' | 'DISABLED'>();
  const [editor, setEditor] = useState<{ id?: string; name: string; status: string }>();
  const [confirmation, setConfirmation] = useState<'APPROVED' | 'REJECTED'>();
  useEffect(() => {
    if (session?.user.role !== 'ADMIN') router.replace('/admin/sign-in');
  }, [router, session]);
  useEffect(() => {
    if (session?.user.role !== 'ADMIN') return;
    let live = true;
    const request = tab === 'dashboard' ? apiRequest<Dashboard>('/api/v1/admin/dashboard') : apiRequest<Results>(`/api/v1/admin/management/${tab}?${query}&limit=10&offset=${offset}`);
    request.then(data => { if (live) { if (tab === 'dashboard') setDashboard(data as Dashboard); else setResult(data as Results); } }).catch(error => { if (live) setError(explain(error)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session, tab, query, offset, version]);
  function navigate(next: Resource | 'dashboard') { if (detailLoading) return; setTab(next); setReason(''); setAccountAction(undefined); setEditor(undefined); setQuery(''); setOffset(0); setError(''); setMessage(''); setSelected(undefined); setConfirmation(undefined); setLoading(true); setVersion(v => v + 1); }
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const params = new URLSearchParams(); for (const [key, value] of data) if (String(value).trim()) params.set(key, String(value).trim()); setQuery(params.toString()); setOffset(0); setLoading(true); setError(''); setVersion(v => v + 1); }
  async function openDetail(id: string) { setDetailLoading(true); setError(''); try { setSelected(await apiRequest<RecordRow>(`/api/v1/admin/management/${tab}/${id}`)); } catch (error) { setError(explain(error)); } finally { setDetailLoading(false); } }
  async function moderate() {
    if (!selected || !confirmation || !['companies', 'jobs'].includes(tab)) return;
    setBusy(true); setError('');
    try { if (tab === 'companies') await reviewCompany(selected.id, confirmation); else await reviewJob(selected.id, confirmation, confirmation === 'REJECTED' ? reason.trim() : undefined); setMessage(confirmation === 'APPROVED' ? 'Đã phê duyệt.' : 'Đã từ chối.'); setSelected(undefined); setConfirmation(undefined); setLoading(true); setVersion(v => v + 1); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  async function saveCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor || !['industries', 'skills'].includes(tab)) return;
    setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try { await apiRequest('/api/v1/admin/catalog/' + tab + (editor.id ? '/' + editor.id : ''), { method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify({ name: String(data.get('name')).trim(), status: data.get('status') }) }); setEditor(undefined); setMessage('Đã lưu danh mục.'); setLoading(true); setVersion(v => v + 1); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  async function changeAccount() {
    if (!selected || !accountAction) return; setBusy(true); setError('');
    try { await apiRequest('/api/v1/admin/accounts/' + selected.id + '/status', { method: 'PATCH', body: JSON.stringify({ status: accountAction }) }); setSelected(undefined); setAccountAction(undefined); setMessage('Đã cập nhật trạng thái tài khoản.'); setLoading(true); setVersion(v => v + 1); } catch (error) { setError(explain(error)); } finally { setBusy(false); }
  }
  if (session?.user.role !== 'ADMIN') return <p className="ui-container" role="status">Đang kiểm tra quyền quản trị…</p>;
  return <div className="admin-layout">
    <aside className="admin-sidebar"><h1>Quản trị hệ thống</h1><nav aria-label="Chức năng Admin"><button aria-current={tab === 'dashboard' ? 'page' : undefined} onClick={() => navigate('dashboard')}>Tổng quan</button>{Object.entries(labels).map(([key, name]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => navigate(key as Resource)}>{name}</button>)}</nav><button className="ui-btn" onClick={() => { logout(); router.replace('/admin/sign-in'); }}>Đăng xuất</button></aside>
    <section className="admin-content"><header className="admin-heading"><div><p>ADMIN</p><h2>{tab === 'dashboard' ? 'Tổng quan hệ thống' : labels[tab]}</h2></div><button className="ui-btn" disabled={loading} onClick={() => { setLoading(true); setError(''); setVersion(v => v + 1); }}>Tải lại</button></header>
      {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
      {['industries', 'skills'].includes(tab) && <button className="ui-btn ui-btn-primary" disabled={loading || detailLoading} onClick={() => { setError(''); setEditor({ name: '', status: 'ACTIVE' }); }}>Thêm danh mục</button>}
      {tab === 'dashboard' ? <>{loading ? <p role="status">Đang tải thống kê…</p> : dashboard && !error && <><div className="admin-stats">{Object.entries(labels).map(([key, name]) => <button key={key} onClick={() => navigate(key as Resource)}><span>{name}</span><strong>{dashboard[key as Resource]}</strong></button>)}<div><span>Đơn ứng tuyển</span><strong>{dashboard.applications}</strong></div><div><span>CV đã lưu</span><strong>{dashboard.cvs}</strong></div></div><p>Cập nhật: {new Date(dashboard.generated_at).toLocaleString('vi-VN')}. Số liệu tổng gồm các trạng thái lưu trong hệ thống.</p><div className="admin-breakdowns">{(['accounts', 'companies', 'jobs', 'applications'] as const).map(kind => <Panel key={kind} title={kind === 'applications' ? 'Đơn ứng tuyển theo trạng thái' : labels[kind]}>{Object.entries(dashboard[`${kind}_by_status`]).length ? Object.entries(dashboard[`${kind}_by_status`]).map(([status, count]) => <p className="admin-count" key={status}><span>{statusLabels[status] ?? status}</span><strong>{count}</strong></p>) : <p>Chưa có dữ liệu.</p>}</Panel>)}</div></>}</> : <>
        <form className="admin-filters ui-panel" key={tab} onSubmit={search}><Field id="admin-query" label="Tìm kiếm"><input id="admin-query" name="q" maxLength={200} placeholder="Tên, email, công ty hoặc mã…" /></Field>{filters[tab].length > 0 && <Field id="admin-status" label="Trạng thái"><select id="admin-status" name="status"><option value="">Tất cả</option>{filters[tab].map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></Field>}{tab === 'accounts' && <Field id="admin-role" label="Vai trò"><select id="admin-role" name="role"><option value="">Tất cả</option><option>CANDIDATE</option><option>COMPANY_MEMBER</option><option>ADMIN</option></select></Field>}<button className="ui-btn" disabled={loading}>Tìm kiếm</button></form>
        {loading ? <p role="status">Đang tải danh sách…</p> : !error && result && <><p>{result.total} bản ghi</p>{result.items.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã</th><th>Tên</th><th>Thông tin</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.email ?? item.company_name ?? item.tax_code ?? item.package_code ?? '—'}{item.role && <small>{item.role}</small>}</td><td>{item.status ? statusLabels[item.status] ?? item.status : '—'}</td><td><button className="ui-btn" disabled={detailLoading} onClick={() => void openDetail(item.id)}>Chi tiết</button></td></tr>)}</tbody></table></div> : <Panel><p>Không có bản ghi phù hợp. Hãy thay đổi bộ lọc.</p></Panel>}<div className="ui-actions"><button className="ui-btn" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - 10)); setLoading(true); }}>Trang trước</button><span>Trang {offset / 10 + 1}</span><button className="ui-btn" disabled={offset + 10 >= result.total} onClick={() => { setOffset(offset + 10); setLoading(true); }}>Trang sau</button></div></>}
      </>}
      {selected && <Dialog title={selected.name} onClose={() => { if (!busy) { setSelected(undefined); setConfirmation(undefined); } }}><dl className="admin-detail"><dt>Mã</dt><dd>{selected.id}</dd>{selected.status && <><dt>Trạng thái</dt><dd>{statusLabels[selected.status]}</dd></>}{selected.email && <><dt>Email</dt><dd>{selected.email}</dd></>}{selected.role && <><dt>Vai trò</dt><dd>{selected.role}</dd></>}{selected.tax_code && <><dt>Mã số thuế</dt><dd>{selected.tax_code}</dd></>}{selected.company_name && <><dt>Doanh nghiệp</dt><dd>{selected.company_name}</dd></>}{selected.position && <><dt>Vị trí mong muốn</dt><dd>{selected.position}</dd></>}{selected.package_code && <><dt>Mã gói</dt><dd>{selected.package_code}</dd><dt>Quota thành viên ACTIVE</dt><dd>{selected.member_limit ?? 'Chưa cấu hình'}</dd><dt>Giá tháng</dt><dd>{selected.monthly_price} VND</dd></>}{selected.description && <><dt>Mô tả</dt><dd>{selected.description}</dd></>}{selected.requirements && <><dt>Yêu cầu</dt><dd>{selected.requirements}</dd></>}</dl>
        {(tab === 'companies' || (tab === 'jobs' && selected.status === 'PENDING')) && <div className="ui-actions"><button className="ui-btn" disabled={busy || selected.status === 'APPROVED'} onClick={() => setConfirmation('APPROVED')}>{tab === 'companies' ? 'Duyệt doanh nghiệp' : 'Duyệt tin'}</button><button className="ui-btn" disabled={busy || selected.status === 'REJECTED'} onClick={() => setConfirmation('REJECTED')}>{tab === 'companies' ? 'Từ chối doanh nghiệp' : 'Từ chối tin'}</button></div>}
        {tab === 'accounts' && selected.role !== 'ADMIN' && <button className="ui-btn" disabled={busy} onClick={() => setAccountAction(selected.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>{selected.status === 'ACTIVE' ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}</button>}
        {accountAction && <section className="ui-panel"><p>Xác nhận {accountAction === 'DISABLED' ? 'vô hiệu hóa' : 'kích hoạt'} tài khoản? Dữ liệu liên quan được giữ nguyên.</p><button className="ui-btn" disabled={busy} onClick={() => void changeAccount()}>Xác nhận trạng thái</button><button className="ui-btn" disabled={busy} onClick={() => setAccountAction(undefined)}>Hủy</button></section>}
        {['industries', 'skills'].includes(tab) && <button className="ui-btn" onClick={() => { setEditor({ id: selected.id, name: selected.name, status: selected.status ?? 'ACTIVE' }); setSelected(undefined); }}>Sửa danh mục</button>}
        {confirmation && <section className="ui-panel">{tab === 'jobs' && confirmation === 'REJECTED' && <Field id="admin-reason" label="Lý do từ chối"><textarea id="admin-reason" value={reason} maxLength={16000} onChange={event => setReason(event.target.value)} /></Field>}<p>Xác nhận {confirmation === 'APPROVED' ? 'phê duyệt' : 'từ chối'} “{selected.name}”?</p><div className="ui-actions"><button className="ui-btn ui-btn-primary" disabled={busy || (tab === 'jobs' && confirmation === 'REJECTED' && !reason.trim())} onClick={() => void moderate()}>Xác nhận</button><button className="ui-btn" disabled={busy} onClick={() => setConfirmation(undefined)}>Hủy</button></div></section>}{error && <Notice error>{error}</Notice>}
      </Dialog>}
      {editor && <Dialog title={editor.id ? 'Sửa danh mục' : 'Thêm danh mục'} onClose={() => { if (!busy) setEditor(undefined); }}><form className="ui-form" onSubmit={saveCatalog}><Field id="catalog-name" label="Tên"><input id="catalog-name" name="name" defaultValue={editor.name} required maxLength={tab === 'skills' ? 120 : 150} /></Field><Field id="catalog-status" label="Trạng thái"><select id="catalog-status" name="status" defaultValue={editor.status}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng chọn mới</option></select></Field><p>Ngừng chọn mới vẫn giữ các liên kết đã có.</p>{error && <Notice error>{error}</Notice>}<button className="ui-btn ui-btn-primary" disabled={busy}>Lưu danh mục</button></form></Dialog>}
    </section>
  </div>;
}
