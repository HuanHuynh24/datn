import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getCandidateProfile, setCandidateProfile, updateCandidateProfile, useAuthSession } from '../../auth-client';
import { Page, Panel, Field, Notice, type Navigate } from '../../ui';
import Dialog from '../../components/Dialog';
import ProfileNavigation from '../../components/ProfileNavigation';
import ProfileHistoryEditor, { ProfileHistory } from '../../components/ProfileHistory';
import { getJobCatalog, type CatalogItem } from '../../jobs-client';
import ImageUpload from '../../components/ImageUpload';
import { profileCompletion, profileDraft, profilePatch, profileSalary, type ProfileDraft } from '../../candidate-profile';

export default function CareerProfilePage({ onNavigate }: { onNavigate: Navigate }) {
  const profile = useAuthSession()?.profile;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const original = useRef<ProfileDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ full_name: '', phone: '', address: '', introduction: '', desired_position: '', minimum_salary: '', maximum_salary: '', profile_public: false, province_id: '', desired_work_type: '', avatar_url: '' });
  const [provinces,setProvinces]=useState<CatalogItem[]>([]);
  const [catalogError,setCatalogError]=useState('');
  const [education,setEducation]=useState<unknown>(null);
  const [experience,setExperience]=useState<unknown>(null);
  const [historyChanges,setHistoryChanges]=useState<{education?:string[]|null;experience?:string[]|null}>({});

  useEffect(() => {
    let active = true;
    getCandidateProfile().then(value => { if (active) setCandidateProfile(value); })
      .catch(reason => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Không thể tải hồ sơ.'); })
      .finally(() => { if (active) setLoading(false); });
    getJobCatalog().then(value=>{if(active)setProvinces(value.provinces);}).catch(()=>{if(active)setCatalogError('Chưa tải được danh mục tỉnh/thành. Bạn vẫn có thể sửa các thông tin khác.');});
    return () => { active = false; };
  }, [reload]);

  function retry() { setLoadError(''); setCatalogError(''); setLoading(true); setReload(value => value + 1); }

  const completion = profileCompletion(profile);
  const canEdit = Boolean(profile) && !loading && !loadError && !busy;

  function edit() {
    if (!profile) return;
    const value = profileDraft(profile);
    original.current = value; setDraft(value);
    setEducation(profile.education);setExperience(profile.experience);setHistoryChanges({});
    setError(''); setNotice(''); setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !original.current) return;
    if (!draft.full_name.trim()) { setError('Vui lòng nhập họ và tên.'); return; }
    if (draft.minimum_salary !== '' && draft.maximum_salary !== '' && Number(draft.minimum_salary) > Number(draft.maximum_salary)) { setError('Lương tối đa phải lớn hơn hoặc bằng lương tối thiểu.'); return; }
    const changes = { ...profilePatch(draft, original.current), ...historyChanges };
    if (!Object.keys(changes).length) { setEditing(false); setNotice('Bạn chưa thay đổi thông tin hồ sơ.'); return; }
    setBusy(true); setError('');
    try {
      await updateCandidateProfile(changes);
      setEditing(false); setNotice('Đã lưu thay đổi hồ sơ.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cập nhật hồ sơ.'); }
    finally { setBusy(false); }
  }

  return <Page visual="career" eyebrow="Hồ sơ & CV" title="Hồ sơ nghề nghiệp" description="Cập nhật thông tin liên hệ và mong muốn công việc của bạn." actions={<button className="ui-btn" disabled={!canEdit} onClick={edit}>Chỉnh sửa thông tin</button>}>
    <ProfileNavigation active="profile" />
    {error && <div role="alert"><Notice error>{error}</Notice></div>}
    {notice && <Notice>{notice}</Notice>}
    {catalogError && <Notice error>{catalogError} <button className="ui-link" onClick={retry} disabled={loading || busy || editing}>Thử tải lại danh mục</button></Notice>}
    {loading ? <p role="status">Đang tải hồ sơ…</p> : loadError ? <Panel title="Chưa tải được hồ sơ"><div role="alert"><Notice error>{loadError}</Notice></div><button className="ui-btn" onClick={retry}>Thử tải lại hồ sơ</button></Panel> : !profile ? <Notice error>Không tìm thấy hồ sơ ứng viên.</Notice> : <div className="ui-columns">
      <div className="ui-stack">
        <Panel title={profile.full_name} action={<button className="ui-link" disabled={busy} onClick={edit}>Chỉnh sửa</button>}><p>{profile.desired_position || 'Chưa cập nhật vị trí mong muốn'}</p><p className="ui-muted">{profile.address || 'Chưa cập nhật địa chỉ'}</p><ImageUpload endpoint="/api/v1/candidates/me/avatar" url={profile.avatar_url} label="Ảnh đại diện" disabled={busy||editing} onBusy={setBusy} onUploaded={url=>setCandidateProfile({...profile,avatar_url:url})}/></Panel>
        <Panel title="Giới thiệu bản thân"><p className="ui-preline">{profile.introduction || 'Chưa có thông tin giới thiệu.'}</p></Panel>
        <Panel title="Mong muốn công việc"><p>Mức lương mong muốn: {profileSalary(profile)}</p><p>Hình thức làm việc: {profile.desired_work_type || 'Chưa cập nhật'}</p><p>Tỉnh/thành: {provinces.find(item=>item.id===profile.province_id)?.name || (profile.province_id?'Đã chọn tỉnh/thành':'Chưa cập nhật')}</p></Panel>
        <Panel title="Học vấn"><ProfileHistory value={profile.education}/></Panel>
        <Panel title="Kinh nghiệm"><ProfileHistory value={profile.experience}/></Panel>
      </div>
      <aside className="ui-stack">
        <Panel title="Mức độ hoàn thiện"><div className="ui-row ui-row-between"><span>Thông tin hồ sơ</span><strong>{completion.percent}%</strong></div><progress className="ui-progress" aria-label="Mức độ hoàn thiện hồ sơ" max="100" value={completion.percent}/>{completion.missing.length ? <><p className="ui-small ui-muted">Bạn có thể bổ sung:</p><ul>{completion.missing.map(label => <li key={label}>{label}</li>)}</ul><button className="ui-link" disabled={!canEdit} onClick={edit}>Bổ sung thông tin →</button></> : <p>Đã bổ sung đủ các mục thông tin cơ bản.</p>}<p className="ui-small ui-muted">Đây là gợi ý hoàn thiện, không phải điều kiện bắt buộc để ứng tuyển. Bạn cần CV còn hoạt động để nộp đơn.</p></Panel>
        <Panel title="Thông tin liên hệ"><p>{profile.email}</p><p>{profile.phone || 'Chưa cập nhật điện thoại'}</p>{profile.avatar_url&&/^https?:\/\//i.test(profile.avatar_url)&&!profile.avatar_url.includes('/api/v1/candidates/me/avatar?')&&<a className="ui-link" href={profile.avatar_url} target="_blank" rel="noreferrer noopener">Xem ảnh đại diện</a>}</Panel>
        <Panel title="Quyền riêng tư"><p>{profile.profile_public ? 'Bạn đã chọn cho phép công khai hồ sơ.' : 'Hồ sơ đang ở chế độ riêng tư.'}</p><p className="ui-small ui-muted">Lựa chọn này không công khai file CV. CV chỉ được chia sẻ theo quyền khi bạn ứng tuyển.</p><p className="ui-small ui-muted">Cập nhật: {new Date(profile.updated_at).toLocaleString('vi-VN')}</p></Panel>
        <Panel title="CV"><button className="ui-link" onClick={() => onNavigate('cv-upload')}>Quản lý CV →</button></Panel>
      </aside>
    </div>}
    {editing && <Dialog title="Chỉnh sửa thông tin cá nhân" onClose={() => { if (!busy) setEditing(false); }}>
      <form className="ui-form" onSubmit={save} aria-busy={busy}>
        <fieldset className="ui-stack" disabled={busy}><legend>Thông tin cá nhân</legend>
        <Field id="profile-name" label="Họ và tên *"><input id="profile-name" required maxLength={255} value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} /></Field>
        <Field id="profile-phone" label="Điện thoại"><input id="profile-phone" type="tel" maxLength={20} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></Field>
        <Field id="profile-address" label="Địa chỉ"><input id="profile-address" maxLength={255} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
        </fieldset><fieldset className="ui-stack" disabled={busy}><legend>Mong muốn công việc</legend>
        <Field id="profile-position" label="Vị trí mong muốn"><input id="profile-position" maxLength={255} value={draft.desired_position} onChange={e => setDraft({ ...draft, desired_position: e.target.value })} /></Field>
        <Field id="profile-province" label="Tỉnh/thành mong muốn"><select id="profile-province" value={draft.province_id} onChange={event=>setDraft({...draft,province_id:event.target.value})}><option value="">Chưa chọn</option>{draft.province_id&&!provinces.some(item=>item.id===draft.province_id)&&<option value={draft.province_id}>Tỉnh/thành đã lưu</option>}{provinces.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field id="profile-work-type" label="Hình thức làm việc mong muốn"><input id="profile-work-type" maxLength={60} value={draft.desired_work_type} onChange={event=>setDraft({...draft,desired_work_type:event.target.value})}/></Field>
        <Field id="profile-avatar" label="URL ảnh đại diện" hint="Có thể nhập URL HTTP/HTTPS hoặc tải ảnh ở phần hồ sơ bên ngoài biểu mẫu."><input id="profile-avatar" type="url" maxLength={500} pattern="https?://.*" value={draft.avatar_url} onChange={event=>setDraft({...draft,avatar_url:event.target.value})}/></Field>
        <Field id="profile-about" label="Giới thiệu"><textarea id="profile-about" rows={5} maxLength={16000} value={draft.introduction} onChange={e => setDraft({ ...draft, introduction: e.target.value })} /></Field>
        <div className="ui-two">
          <Field id="profile-minimum" label="Lương tối thiểu (VND)"><input id="profile-minimum" type="number" min="0" max="9999999999999.99" step="0.01" value={draft.minimum_salary} onChange={e => setDraft({ ...draft, minimum_salary: e.target.value })} /></Field>
          <Field id="profile-maximum" label="Lương tối đa (VND)"><input id="profile-maximum" type="number" min="0" max="9999999999999.99" step="0.01" value={draft.maximum_salary} onChange={e => setDraft({ ...draft, maximum_salary: e.target.value })} /></Field>
        </div>
        </fieldset><fieldset className="ui-stack" disabled={busy}><legend>Học vấn và kinh nghiệm</legend>
        <ProfileHistoryEditor title="Học vấn" prefix="education" value={education} onChange={items=>{setEducation(items);setHistoryChanges(current=>({...current,education:items.map(item=>item.trim()).filter(Boolean)}));}}/>
        <ProfileHistoryEditor title="Kinh nghiệm" prefix="experience" value={experience} onChange={items=>{setExperience(items);setHistoryChanges(current=>({...current,experience:items.map(item=>item.trim()).filter(Boolean)}));}}/>
        </fieldset><fieldset className="ui-stack" disabled={busy}><legend>Quyền riêng tư</legend>
        <label><input type="checkbox" checked={draft.profile_public} onChange={e => setDraft({ ...draft, profile_public: e.target.checked })} /> Cho phép công khai hồ sơ</label>
        </fieldset>
        {error && <div role="alert"><Notice error>{error}</Notice></div>}
        <div className="ui-form-actions"><button type="button" className="ui-btn" disabled={busy} onClick={() => setEditing(false)}>Hủy</button><button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </Dialog>}
  </Page>;
}
