import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuthSession, setCurrentCompany } from '../../auth-client';
import { changeCompanyMemberStatus, createCompanyMember, getCompanyMembers, getMyCompany, updateMyCompany, type CompanyMember, type CompanyProfile } from '../../company-client';
import { Page, Panel, Field, Notice, type Navigate } from '../../ui';

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
  const reload = useCallback(async () => {
    const [value, people] = await Promise.all([getMyCompany(), isOwner ? getCompanyMembers() : Promise.resolve([])]);
    setCompany(value); setCurrentCompany(value); setMembers(people);
  }, [isOwner]);
  useEffect(() => {
    let active = true;
    Promise.all([getMyCompany(), isOwner ? getCompanyMembers() : Promise.resolve([])])
      .then(([value, people]) => { if (active) { setCompany(value); setCurrentCompany(value); setMembers(people); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin doanh nghiệp.'); });
    return () => { active = false; };
  }, [isOwner]);
  const limit = company?.package.member_limit;
  const full = limit === null || limit === undefined || limit <= 0 || (company?.active_member_count || 0) >= limit;

  function edit() {
    if (!company) return;
    setDraft({ company_name: company.company_name, industry: company.industry || '', size: company.size || '', address: company.address || '', website: company.website || '', logo_url: company.logo_url || '', introduction: company.introduction || '' });
    setEditing(true); setError(''); setNotice('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const value = await updateMyCompany({ company_name: draft.company_name, industry: draft.industry || null, size: draft.size || null, address: draft.address || null, website: draft.website || null, logo_url: draft.logo_url || null, introduction: draft.introduction || null });
      setCompany(value); setEditing(false); setNotice('Đã lưu hồ sơ doanh nghiệp.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu hồ sơ.'); }
    finally { setBusy(false); }
  }
  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || full) return;
    const form = event.currentTarget;
    const data = { full_name: (form.elements.namedItem('member-full-name') as HTMLInputElement).value.trim(), email: (form.elements.namedItem('member-email') as HTMLInputElement).value.trim(), password: (form.elements.namedItem('member-password') as HTMLInputElement).value };
    setBusy(true); setError(''); setNotice('');
    try {
      await createCompanyMember(data); form.reset();
      setNotice('Đã tạo tài khoản RECRUITER. Cung cấp thông tin đăng nhập riêng cho thành viên.');
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo thành viên.'); }
    finally { setBusy(false); }
  }
  async function toggle(member: CompanyMember) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await changeCompanyMemberStatus(member.account_id, member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await reload(); setNotice('Đã cập nhật trạng thái thành viên.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể thay đổi trạng thái.'); }
    finally { setBusy(false); }
  }

  return <Page visual="team" eyebrow="Không gian nhà tuyển dụng" title={company?.company_name || 'Hồ sơ công ty'} description="Thông tin doanh nghiệp, gói dịch vụ và thành viên của bạn." actions={isOwner && company && !editing ? <button className="ui-btn ui-btn-primary" onClick={edit}>Chỉnh sửa hồ sơ</button> : undefined}>
    {error && <div role="alert"><Notice error>{error}</Notice></div>}
    {notice && <Notice>{notice}</Notice>}
    {!company ? <p>Đang tải thông tin doanh nghiệp…</p> : <>
      <Notice>{approvalLabels[company.approval_status]}{company.approval_status !== 'APPROVED' ? '. Cần được Admin duyệt trước khi thực hiện nghiệp vụ tuyển dụng.' : ''}</Notice>
      {editing && <Panel title="Chỉnh sửa hồ sơ doanh nghiệp"><form className="ui-form" onSubmit={save}>
        <Field id="company-name" label="Tên công ty *"><input id="company-name" required maxLength={255} value={draft.company_name} onChange={e => setDraft({ ...draft, company_name: e.target.value })} /></Field>
        <div className="ui-two">
          <Field id="company-industry" label="Lĩnh vực"><input id="company-industry" maxLength={200} value={draft.industry} onChange={e => setDraft({ ...draft, industry: e.target.value })} /></Field>
          <Field id="company-size" label="Quy mô"><input id="company-size" maxLength={60} value={draft.size} onChange={e => setDraft({ ...draft, size: e.target.value })} /></Field>
        </div>
        <Field id="company-address" label="Địa chỉ"><input id="company-address" maxLength={255} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field id="company-website" label="Website"><input id="company-website" type="url" maxLength={255} value={draft.website} onChange={e => setDraft({ ...draft, website: e.target.value })} /></Field>
        <Field id="company-logo" label="URL logo"><input id="company-logo" type="url" maxLength={500} value={draft.logo_url} onChange={e => setDraft({ ...draft, logo_url: e.target.value })} /></Field>
        <Field id="company-introduction" label="Giới thiệu"><textarea id="company-introduction" rows={5} maxLength={16000} value={draft.introduction} onChange={e => setDraft({ ...draft, introduction: e.target.value })} /></Field>
        <div className="ui-form-actions"><button className="ui-btn" type="button" disabled={busy} onClick={() => setEditing(false)}>Hủy</button><button className="ui-btn ui-btn-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu hồ sơ doanh nghiệp'}</button></div>
      </form></Panel>}
      <div className="ui-columns"><div className="ui-stack">
        <Panel title={company.company_name}><p>{company.industry || 'Chưa cập nhật lĩnh vực'}</p><p>{company.address || 'Chưa cập nhật địa chỉ'}</p></Panel>
        <Panel title="Giới thiệu công ty"><p className="ui-preline">{company.introduction || 'Chưa cập nhật giới thiệu doanh nghiệp.'}</p></Panel>
      </div><aside className="ui-stack">
        <Panel title="Thông tin doanh nghiệp"><dl className="ui-summary">{[['Mã số thuế', company.tax_code], ['Quy mô', company.size || 'Chưa cập nhật'], ['Website', company.website || 'Chưa cập nhật']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Panel>
        <Panel title="Gói doanh nghiệp"><p>{company.package.name}</p><p>Thành viên hoạt động: {company.active_member_count} / {company.package.member_limit ?? 'Chưa cấu hình'}</p><p>Hạn mức bao gồm OWNER.</p><p>Giá tháng: {Number(company.package.monthly_price).toLocaleString('vi-VN')} (chưa tích hợp thanh toán)</p></Panel>
        {company.approval_status === 'APPROVED' && <Panel title="Tuyển dụng"><button className="ui-btn" onClick={() => onNavigate('recruiter-create-job')}>Đến mục tuyển dụng</button></Panel>}
      </aside></div>
      {isOwner && <>
        <Panel title="Thành viên doanh nghiệp"><div className="ui-list">{members.map(member => <div className="ui-list-item" key={member.account_id} data-member-id={member.account_id}>
          <div><strong>{member.full_name}</strong><p>{member.email}</p><small>{member.internal_role} · {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã tắt'}{member.account_status === 'DISABLED' ? ' · Tài khoản đã bị vô hiệu hóa' : ''}</small></div>
          {member.internal_role === 'RECRUITER' ? <button className="ui-btn" disabled={busy || (member.status !== 'ACTIVE' && full)} onClick={() => toggle(member)}>{member.status === 'ACTIVE' ? 'Tắt thành viên' : 'Bật lại'}</button> : <span>Chủ doanh nghiệp</span>}
        </div>)}</div></Panel>
        <Panel title="Thêm RECRUITER">{full && <Notice>Chưa còn suất thành viên hoạt động để tạo hoặc kích hoạt thêm người dùng.</Notice>}
          <form className="ui-form" onSubmit={addMember}>
            <Field id="member-full-name" label="Họ và tên *"><input id="member-full-name" required maxLength={255} autoComplete="off" /></Field>
            <Field id="member-email" label="Email *"><input id="member-email" type="email" required maxLength={255} autoComplete="off" /></Field>
            <Field id="member-password" label="Mật khẩu ban đầu *"><input id="member-password" type="password" required minLength={8} maxLength={1024} autoComplete="new-password" /></Field>
            <button className="ui-btn ui-btn-primary" disabled={busy || full} type="submit">Tạo thành viên</button>
          </form>
        </Panel>
      </>}
    </>}
  </Page>;
}
