import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, useAuthSession, setCurrentCompany } from '../../auth-client';
import { changeCompanyMemberStatus, createCompanyMember, getCompanyMembers, getMyCompany, updateMyCompany, type CompanyMember, type CompanyProfile } from '../../company-client';
import { Page, Panel, Field, Notice, type Navigate } from '../../ui';
import ImageUpload, { ManagedImage } from '../../components/ImageUpload';

const approvalLabels = { PENDING: 'Đang chờ duyệt', APPROVED: 'Đã được duyệt', REJECTED: 'Chưa được duyệt' };
export default function CompanyProfilePage({ onNavigate }: { onNavigate: Navigate }) {
  const auth = useAuthSession();
  const isOwner = auth?.user.internal_role === 'OWNER';
  const [company, setCompany] = useState<CompanyProfile | null>(auth?.company || null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ company_name: '', industry: '', size: '', address: '', website: '', logo_url: '', introduction: '' });
  const original = useRef<typeof draft | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(true);
  const [companyError, setCompanyError] = useState('');
  const [memberError, setMemberError] = useState('');
  const [companyVersion, setCompanyVersion] = useState(0);
  const [memberVersion, setMemberVersion] = useState(0);
  useEffect(() => {
    let active = true;
    getMyCompany().then(value => { if (active) { setCompany(value); setCurrentCompany(value); } })
      .catch(reason => { if (active) setCompanyError(reason instanceof Error ? reason.message : 'Không thể tải thông tin doanh nghiệp.'); })
      .finally(() => { if (active) setCompanyLoading(false); });
    return () => { active = false; };
  }, [companyVersion]);
  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    getCompanyMembers().then(value => { if (active) setMembers(value); })
      .catch(reason => { if (active) setMemberError(reason instanceof Error ? reason.message : 'Không thể tải danh sách thành viên.'); })
      .finally(() => { if (active) setMemberLoading(false); });
    return () => { active = false; };
  }, [isOwner, memberVersion]);
  function reloadCompany() { setCompanyError(''); setCompanyLoading(true); setCompanyVersion(value => value + 1); }
  function reloadMembers() { setMemberError(''); setMemberLoading(true); setMemberVersion(value => value + 1); }
  function refreshAfterMemberChange() { reloadCompany(); reloadMembers(); }
  const companyReady = Boolean(company) && !companyLoading && !companyError;
  const membersReady = companyReady && !memberLoading && !memberError && members.length > 0;
  const limit = company?.package.member_limit;
  const quotaConfigured = limit != null && limit > 0;
  const full = !quotaConfigured || (company?.active_member_count || 0) >= limit;

  function edit() {
    if (!company || !companyReady || busy) return;
    const value = { company_name: company.company_name, industry: company.industry || '', size: company.size || '', address: company.address || '', website: company.website || '', logo_url: company.logo_url || '', introduction: company.introduction || '' };
    original.current = value; setDraft(value);
    setEditing(true); setError(''); setNotice('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    if (!draft.company_name.trim()) { setError('Vui lòng nhập tên công ty.'); return; }
    const changes: Partial<typeof draft> = {};
    for (const key of Object.keys(draft) as (keyof typeof draft)[]) {
      if (original.current?.[key] !== draft[key]) changes[key] = draft[key].trim();
    }
    for (const key of ['website', 'logo_url'] as const) {
      if (!changes[key]) continue;
      try {
        const url = new URL(changes[key]);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      } catch { setError('Website và URL logo mới phải là địa chỉ HTTP hoặc HTTPS hợp lệ.'); return; }
    }
    if (!Object.keys(changes).length) { setEditing(false); setNotice('Bạn chưa thay đổi hồ sơ doanh nghiệp.'); return; }
    setBusy(true); setError('');
    try {
      const value = await updateMyCompany(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value || null])));
      setCompany(value); setEditing(false); setNotice('Đã lưu hồ sơ doanh nghiệp.');
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 422 ? 'Thông tin chưa hợp lệ. Kiểm tra tên công ty, độ dài và URL HTTP/HTTPS.' : reason instanceof Error ? reason.message : 'Không thể lưu hồ sơ.'); }
    finally { setBusy(false); }
  }
  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || full || !membersReady || editing) return;
    const form = event.currentTarget;
    const data = { full_name: (form.elements.namedItem('member-full-name') as HTMLInputElement).value.trim(), email: (form.elements.namedItem('member-email') as HTMLInputElement).value.trim(), password: (form.elements.namedItem('member-password') as HTMLInputElement).value };
    if (!data.full_name) { setError('Vui lòng nhập họ và tên thành viên.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await createCompanyMember(data); form.reset();
      setNotice('Đã tạo tài khoản RECRUITER. Cung cấp thông tin đăng nhập riêng cho thành viên.');
      refreshAfterMemberChange();
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Email đã được sử dụng hoặc gói đã hết suất. Hãy kiểm tra danh sách và hạn mức trước khi thử lại.' : reason instanceof Error ? reason.message : 'Không thể tạo thành viên.'); }
    finally { setBusy(false); }
  }
  async function toggle(member: CompanyMember) {
    if (busy || !membersReady || editing) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await changeCompanyMemberStatus(member.account_id, member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      setNotice('Đã cập nhật trạng thái thành viên.'); refreshAfterMemberChange();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể thay đổi trạng thái.'); }
    finally { setBusy(false); }
  }

  return <Page visual="team" eyebrow="Không gian nhà tuyển dụng" title={companyReady ? company?.company_name || 'Hồ sơ công ty' : 'Hồ sơ công ty'} description="Thông tin doanh nghiệp, gói dịch vụ và thành viên của bạn." actions={isOwner && companyReady && !editing ? <button className="ui-btn ui-btn-primary" disabled={busy} onClick={edit}>Chỉnh sửa hồ sơ</button> : undefined}>
    {error && <div role="alert"><Notice error>{error}</Notice></div>}
    {notice && <div role="status"><Notice>{notice}</Notice></div>}
    {companyLoading ? <p role="status">Đang tải thông tin doanh nghiệp…</p> : companyError ? <Panel title="Chưa tải được hồ sơ công ty"><div role="alert"><Notice error>{companyError}</Notice></div><button className="ui-btn" disabled={busy} onClick={reloadCompany}>Thử tải lại hồ sơ công ty</button></Panel> : !company ? <Notice error>Không tìm thấy doanh nghiệp.</Notice> : <>
      <Notice>{approvalLabels[company.approval_status]}{company.approval_status !== 'APPROVED' ? '. Cần được Admin duyệt trước khi thực hiện nghiệp vụ tuyển dụng.' : ''}</Notice>
      {editing && <Panel title="Chỉnh sửa hồ sơ doanh nghiệp"><form className="ui-form" onSubmit={save} aria-busy={busy}><fieldset className="ui-stack" disabled={busy}><legend>Thông tin công ty</legend>
        <Field id="company-name" label="Tên công ty *"><input id="company-name" required maxLength={255} value={draft.company_name} onChange={e => setDraft({ ...draft, company_name: e.target.value })} /></Field>
        <div className="ui-two">
          <Field id="company-industry" label="Lĩnh vực"><input id="company-industry" maxLength={200} value={draft.industry} onChange={e => setDraft({ ...draft, industry: e.target.value })} /></Field>
          <Field id="company-size" label="Quy mô"><input id="company-size" maxLength={60} value={draft.size} onChange={e => setDraft({ ...draft, size: e.target.value })} /></Field>
        </div>
        <Field id="company-address" label="Địa chỉ"><input id="company-address" maxLength={255} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field id="company-website" label="Website"><input id="company-website" inputMode="url" maxLength={255} value={draft.website} onChange={e => setDraft({ ...draft, website: e.target.value })} /></Field>
        <Field id="company-logo" label="URL logo" hint="URL mới cần HTTP/HTTPS. Đường dẫn cũ được giữ nguyên nếu không sửa; có thể tải logo ở phần hồ sơ."><input id="company-logo" inputMode="url" maxLength={500} value={draft.logo_url} onChange={e => setDraft({ ...draft, logo_url: e.target.value })} /></Field>
        <Field id="company-introduction" label="Giới thiệu"><textarea id="company-introduction" rows={5} maxLength={16000} value={draft.introduction} onChange={e => setDraft({ ...draft, introduction: e.target.value })} /></Field>
        </fieldset><p className="ui-small ui-muted">Mã số thuế, trạng thái duyệt và gói không được thay đổi qua biểu mẫu này.</p>
        <div className="ui-form-actions"><button className="ui-btn" type="button" disabled={busy} onClick={() => setEditing(false)}>Hủy</button><button className="ui-btn ui-btn-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu hồ sơ doanh nghiệp'}</button></div>
      </form></Panel>}
      <div className="ui-columns"><div className="ui-stack">
        <Panel title={company.company_name}><p>{company.industry || 'Chưa cập nhật lĩnh vực'}</p><p>{company.address || 'Chưa cập nhật địa chỉ'}</p>{isOwner?<ImageUpload endpoint="/api/v1/companies/me/logo" url={company.logo_url} label="Logo doanh nghiệp" disabled={busy||editing} onBusy={setBusy} onUploaded={url=>{const value={...company,logo_url:url};setCompany(value);setCurrentCompany(value);}}/>:<ManagedImage endpoint="/api/v1/companies/me/logo" url={company.logo_url} alt="Logo doanh nghiệp"/>}</Panel>
        <Panel title="Giới thiệu công ty"><p className="ui-preline">{company.introduction || 'Chưa cập nhật giới thiệu doanh nghiệp.'}</p></Panel>
      </div><aside className="ui-stack">
        <Panel title="Thông tin doanh nghiệp"><dl className="ui-summary">{[['Mã số thuế', company.tax_code], ['Quy mô', company.size || 'Chưa cập nhật'], ['Website', company.website || 'Chưa cập nhật']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Panel>
        <Panel title="Gói doanh nghiệp"><p>{company.package.name}</p><p>Thành viên hoạt động: {company.active_member_count} / {company.package.member_limit ?? 'Chưa cấu hình'}</p><p>Hạn mức bao gồm OWNER.</p><p>Giá tháng: {Number(company.package.monthly_price).toLocaleString('vi-VN')} (chưa tích hợp thanh toán)</p></Panel>
        {company.approval_status === 'APPROVED' && <Panel title="Tuyển dụng"><button className="ui-btn" onClick={() => onNavigate('recruiter-create-job')}>Đến mục tuyển dụng</button></Panel>}
      </aside></div>
      {isOwner && <>
        <Panel title="Thành viên doanh nghiệp">{memberLoading ? <p role="status">Đang tải thành viên…</p> : memberError ? <div><div role="alert"><Notice error>{memberError}</Notice></div><p>Thao tác đã được báo thành công sẽ không được gửi lại. Hãy tải lại để xem danh sách mới nhất.</p><button className="ui-btn" onClick={reloadMembers} disabled={busy}>Thử tải lại thành viên</button></div> : <div className="ui-list">{!members.length && <p>Danh sách thành viên hiện không có dữ liệu. Hãy tải lại trước khi tạo thành viên.</p>}{members.map(member => <div className="ui-list-item" key={member.account_id} data-member-id={member.account_id}>
          <div><strong>{member.full_name}</strong><p>{member.email}</p><small>{member.internal_role} · {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã tắt'}{member.account_status === 'DISABLED' ? ' · Tài khoản đã bị vô hiệu hóa' : ''}</small></div>
          {member.internal_role === 'RECRUITER' ? <button className="ui-btn" disabled={busy || editing || !membersReady || (member.status !== 'ACTIVE' && full)} onClick={() => toggle(member)}>{member.status === 'ACTIVE' ? 'Tắt thành viên' : 'Bật lại'}</button> : <span>Chủ doanh nghiệp</span>}
        </div>)}</div>}<button className="ui-link" disabled={busy || editing || memberLoading} onClick={reloadMembers}>Làm mới danh sách thành viên</button></Panel>
        <Panel title="Thêm RECRUITER">{!quotaConfigured ? <Notice>Gói chưa được cấu hình hạn mức. Không thể tạo hoặc kích hoạt thêm thành viên; OWNER vẫn được tắt RECRUITER.</Notice> : full && <Notice>Đã đạt giới hạn thành viên ACTIVE của gói, bao gồm OWNER. Có thể tắt RECRUITER không còn hoạt động để giải phóng suất.</Notice>}
          <p className="ui-small ui-muted">Chỉ tạo tài khoản RECRUITER mới. Không chuyển tài khoản có sẵn vào doanh nghiệp hoặc cấp thêm OWNER.</p>
          <form className="ui-form" onSubmit={addMember} aria-busy={busy}><fieldset className="ui-stack" disabled={busy || full || !membersReady || editing}>
            <Field id="member-full-name" label="Họ và tên *"><input id="member-full-name" required maxLength={255} autoComplete="off" /></Field>
            <Field id="member-email" label="Email *"><input id="member-email" type="email" required maxLength={255} autoComplete="off" /></Field>
            <Field id="member-password" label="Mật khẩu ban đầu *"><input id="member-password" type="password" required minLength={8} maxLength={1024} autoComplete="new-password" /></Field>
            <button className="ui-btn ui-btn-primary" disabled={busy || full || !membersReady || editing} type="submit">{busy ? 'Đang xử lý…' : 'Tạo thành viên'}</button></fieldset>
          </form>
        </Panel>
      </>}
    </>}
  </Page>;
}
