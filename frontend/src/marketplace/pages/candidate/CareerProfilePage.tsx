import { useEffect, useState, type FormEvent } from 'react';
import { getCandidateProfile, setCandidateProfile, updateCandidateProfile, useAuthSession } from '../../auth-client';
import { Page, Panel, Field, Notice, type Navigate } from '../../ui';
import Dialog from '../../components/Dialog';
import ProfileNavigation from '../../components/ProfileNavigation';

export default function CareerProfilePage({ onNavigate }: { onNavigate: Navigate }) {
  const profile = useAuthSession()?.profile;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ full_name: '', phone: '', address: '', introduction: '', desired_position: '', minimum_salary: '', maximum_salary: '', profile_public: false });

  useEffect(() => {
    let active = true;
    getCandidateProfile().then(value => { if (active) setCandidateProfile(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải hồ sơ.'); });
    return () => { active = false; };
  }, []);

  function edit() {
    if (!profile) return;
    setDraft({ full_name: profile.full_name, phone: profile.phone || '', address: profile.address || '', introduction: profile.introduction || '', desired_position: profile.desired_position || '', minimum_salary: profile.minimum_salary || '', maximum_salary: profile.maximum_salary || '', profile_public: profile.profile_public });
    setError(''); setNotice(''); setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await updateCandidateProfile({ ...draft, phone: draft.phone || null, address: draft.address || null, introduction: draft.introduction || null, desired_position: draft.desired_position || null, minimum_salary: draft.minimum_salary || null, maximum_salary: draft.maximum_salary || null });
      setEditing(false); setNotice('Đã lưu thay đổi hồ sơ.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật hồ sơ.'); }
    finally { setBusy(false); }
  }

  return <Page visual="career" eyebrow="Hồ sơ & CV" title="Hồ sơ nghề nghiệp" description="Cập nhật thông tin liên hệ và mong muốn công việc của bạn." actions={<button className="ui-btn" disabled={!profile} onClick={edit}>Chỉnh sửa thông tin</button>}>
    <ProfileNavigation active="profile" />
    {error && <div role="alert"><Notice error>{error}</Notice></div>}
    {notice && <Notice>{notice}</Notice>}
    {!profile ? <p>Đang tải hồ sơ…</p> : <div className="ui-columns">
      <div className="ui-stack">
        <Panel title={profile.full_name} action={<button className="ui-link" onClick={edit}>Chỉnh sửa</button>}><p>{profile.desired_position || 'Chưa cập nhật vị trí mong muốn'}</p><p className="ui-muted">{profile.address || 'Chưa cập nhật địa chỉ'}</p></Panel>
        <Panel title="Giới thiệu bản thân"><p className="ui-preline">{profile.introduction || 'Chưa có thông tin giới thiệu.'}</p></Panel>
        <Panel title="Mong muốn công việc"><p>Mức lương: {profile.minimum_salary || 'Chưa xác định'} – {profile.maximum_salary || 'Chưa xác định'}</p><p>Hình thức làm việc: {profile.desired_work_type || 'Chưa cập nhật'}</p></Panel>
      </div>
      <aside className="ui-stack">
        <Panel title="Thông tin liên hệ"><p>{profile.email}</p><p>{profile.phone || 'Chưa cập nhật điện thoại'}</p></Panel>
        <Panel title="Quyền riêng tư"><p>{profile.profile_public ? 'Bạn đã chọn cho phép công khai hồ sơ.' : 'Hồ sơ đang ở chế độ riêng tư.'}</p><p className="ui-small ui-muted">Cập nhật: {new Date(profile.updated_at).toLocaleString('vi-VN')}</p></Panel>
        <Panel title="CV"><button className="ui-link" onClick={() => onNavigate('cv-upload')}>Quản lý CV →</button></Panel>
      </aside>
    </div>}
    {editing && <Dialog title="Chỉnh sửa thông tin cá nhân" onClose={() => { if (!busy) setEditing(false); }}>
      <form className="ui-form" onSubmit={save} aria-busy={busy}>
        <Field id="profile-name" label="Họ và tên *"><input id="profile-name" required maxLength={255} value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} /></Field>
        <Field id="profile-phone" label="Điện thoại"><input id="profile-phone" type="tel" maxLength={20} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></Field>
        <Field id="profile-address" label="Địa chỉ"><input id="profile-address" maxLength={255} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field id="profile-position" label="Vị trí mong muốn"><input id="profile-position" maxLength={255} value={draft.desired_position} onChange={e => setDraft({ ...draft, desired_position: e.target.value })} /></Field>
        <Field id="profile-about" label="Giới thiệu"><textarea id="profile-about" rows={5} maxLength={16000} value={draft.introduction} onChange={e => setDraft({ ...draft, introduction: e.target.value })} /></Field>
        <div className="ui-two">
          <Field id="profile-minimum" label="Lương tối thiểu"><input id="profile-minimum" type="number" min="0" step="0.01" value={draft.minimum_salary} onChange={e => setDraft({ ...draft, minimum_salary: e.target.value })} /></Field>
          <Field id="profile-maximum" label="Lương tối đa"><input id="profile-maximum" type="number" min="0" step="0.01" value={draft.maximum_salary} onChange={e => setDraft({ ...draft, maximum_salary: e.target.value })} /></Field>
        </div>
        <label><input type="checkbox" checked={draft.profile_public} onChange={e => setDraft({ ...draft, profile_public: e.target.checked })} /> Cho phép công khai hồ sơ</label>
        {error && <Notice error>{error}</Notice>}
        <div className="ui-form-actions"><button type="button" className="ui-btn" disabled={busy} onClick={() => setEditing(false)}>Hủy</button><button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </Dialog>}
  </Page>;
}
