import WorkspaceHero from '../../components/WorkspaceHero';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Icon from '../../components/Icon';
import Dialog from '../../components/Dialog';
import {useViewState} from '../../view-state';

interface Props { onNavigate: (page: string) => void }
const options = {
  category: ['Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Dữ liệu', 'Quản lý sản phẩm', 'Kinh doanh', 'Tài chính / Kế toán', 'Sản xuất / Vận hành'],
  location: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai', 'Hải Phòng', 'Cần Thơ'],
  workType: ['Toàn thời gian', 'Bán thời gian', 'Hợp đồng', 'Thực tập'],
  workStyle: ['Tại văn phòng', 'Làm từ xa', 'Kết hợp'],
  experience: ['Chưa có kinh nghiệm', 'Dưới 1 năm', '1 – 3 năm', '3 – 5 năm', 'Trên 5 năm'],
  education: ['Không yêu cầu', 'Trung cấp', 'Cao đẳng', 'Đại học', 'Sau đại học'],
};
const steps = ['Thông tin cơ bản', 'Mô tả công việc', 'Yêu cầu ứng viên', 'Lương & phúc lợi'];
const initialDraft = {
  title: '', category: '', location: '', workType: '', workStyle: '',
  description: '', responsibilities: '', experience: '', education: 'Không yêu cầu',
  requirements: '', salaryMin: '', salaryMax: '', currency: 'VND', benefits: '',
};

export default function CreateJobPage({ onNavigate }: Props) {
  const [draft, setDraft] = useViewState('job-draft-fields',initialDraft);
  const [,setSummary]=useViewState<{title:string;updatedAt:string}|null>('recruiter-draft-summary',null);
  const [skills, setSkills] = useViewState<string[]>('job-draft-skills',[]);
  const [skillInput, setSkillInput] = useState('');
  const [section, setSection] = useViewState('job-draft-step',0);
  const [negotiable, setNegotiable] = useViewState('job-draft-negotiable',false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      if(sessionStorage.getItem('talentiq-view-v1:job-draft-fields'))return;
      const saved = JSON.parse(sessionStorage.getItem('talentiq-job-draft-v1') || 'null');
      if (saved?.fields && Object.keys(initialDraft).every(key => typeof saved.fields[key] === 'string')) {
        setDraft(saved.fields);
        setSkills(Array.isArray(saved.skills) ? saved.skills.filter((value: unknown) => typeof value === 'string') : []);
        setNegotiable(saved.negotiable === true);
        setNotice('Đã khôi phục bản nháp trong phiên làm việc này.');
      }
    } catch { /* Draft storage is optional. */ }
  }, [setDraft,setSkills,setNegotiable]);
  const update = (name: keyof typeof initialDraft, value: string) => {
    setDraft(current => ({ ...current, [name]: value }));
    setNotice('');
  };
  const goToStep = (next: number) => {
    if (next > section + 1) return;
    if (next > section && !form.current?.reportValidity()) return;
    setSection(next);
    setNotice('');
    requestAnimationFrame(() => {
      document.getElementById('post-step-title')?.focus();
      form.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
  const addSkill = () => {
    const value = skillInput.trim();
    if (value && !skills.some(skill => skill.toLowerCase() === value.toLowerCase())) setSkills(current => [...current, value]);
    setSkillInput('');
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (section < steps.length - 1) goToStep(section + 1);
    else setPreview(true);
  };
  const save = () => {
    try {
      sessionStorage.setItem('talentiq-job-draft-v1', JSON.stringify({fields:draft,skills,negotiable}));
      setSummary({title:draft.title.trim()||'Tin tuyển dụng chưa có chức danh',updatedAt:new Date().toISOString()});
      setNotice('Đã lưu bản nháp. Bạn có thể tiếp tục từ danh sách tin tuyển dụng.');
      return true;
    } catch {
      setNotice('Trình duyệt chưa cho phép lưu bản nháp. Hãy giữ màn hình này để tiếp tục chỉnh sửa.');
      return false;
    }
  };
  const select = (name: keyof typeof options, label: string, required = false) => (
    <Field id={name} label={label} required={required}>
      <select id={name} name={name} value={draft[name]} onChange={event => update(name, event.target.value)} required={required}>
        <option value="">Chọn {label.toLowerCase()}</option>
        {options[name].map(value => <option key={value}>{value}</option>)}
      </select>
    </Field>
  );
  const salary = negotiable ? 'Thương lượng' : [draft.salaryMin, draft.salaryMax].filter(Boolean).map(value => Number(value).toLocaleString('vi-VN')).join(' – ') + ' ' + draft.currency + ' / tháng';

  return <div className="cl-post-page">
    <WorkspaceHero visual="recruiter" title="Đăng tin tuyển dụng" description="Một tin tuyển dụng rõ ràng giúp bạn gặp đúng người cho đội ngũ." actions={<button className="ui-btn" onClick={() => {if((draft.title||draft.description)&&!save())return;onNavigate('recruiter-jobs');}}>Quay lại danh sách</button>}/>
    <div className="cl-post-container">
      <nav className="cl-post-breadcrumb" aria-label="Đường dẫn">
        <button onClick={() => onNavigate('recruiter-home')}>Nhà tuyển dụng</button><Icon name="right" />
        <button onClick={() => onNavigate('recruiter-jobs')}>Tin tuyển dụng</button><Icon name="right" /><span>Đăng tuyển</span>
      </nav>
      <ol className="cl-post-steps" aria-label="Các bước đăng tuyển">
        {steps.map((step, index) => <li key={step} data-status={index === section ? 'current' : index < section ? 'complete' : 'upcoming'}>
          <button type="button" disabled={index > section + 1} aria-current={index === section ? 'step' : undefined} onClick={() => goToStep(index)}>
            <span className="cl-step-number">{index < section ? <Icon name="check" /> : index + 1}</span><span>{step}</span>
          </button>
        </li>)}
      </ol>
      <form ref={form} onSubmit={submit} className="cl-post-form">
        <div className="cl-post-form-title"><h2 id="post-step-title" tabIndex={-1}>{steps[section]}</h2><span><b>*</b> Thông tin bắt buộc</span></div>
        <fieldset hidden={section !== 0} disabled={section !== 0}>
          <legend className="sr-only">Thông tin cơ bản</legend>
          <Field id="title" label="Chức danh tuyển dụng" required>
            <input id="title" name="title" value={draft.title} onChange={event => update('title', event.target.value)} placeholder="Ví dụ: Lập trình viên Frontend" required />
          </Field>
          <div className="cl-post-field-row">{select('category', 'Ngành nghề', true)}{select('location', 'Địa điểm làm việc', true)}</div>
          <div className="cl-post-field-row">{select('workType', 'Loại công việc', true)}{select('workStyle', 'Hình thức làm việc', true)}</div>
        </fieldset>
        <fieldset hidden={section !== 1} disabled={section !== 1}>
          <legend className="sr-only">Mô tả công việc</legend>
          <Field id="description" label="Mô tả công việc" required hint="Giới thiệu vai trò, đội ngũ và mục tiêu của vị trí.">
            <textarea id="description" name="description" rows={5} value={draft.description} onChange={event => update('description', event.target.value)} placeholder="Ứng viên sẽ đảm nhận công việc gì?" required />
          </Field>
          <Field id="responsibilities" label="Trách nhiệm chính" hint="Mỗi nhiệm vụ viết trên một dòng.">
            <textarea id="responsibilities" name="responsibilities" rows={4} value={draft.responsibilities} onChange={event => update('responsibilities', event.target.value)} placeholder="Các nhiệm vụ cụ thể của vị trí..." />
          </Field>
        </fieldset>
        <fieldset hidden={section !== 2} disabled={section !== 2}>
          <legend className="sr-only">Yêu cầu ứng viên</legend>
          <Field id="skills" label="Kỹ năng" hint="Nhấn Enter hoặc nút Thêm để thêm kỹ năng.">
            <div className="cl-post-skills">{skills.map(skill => <span key={skill}>{skill}<button type="button" aria-label={`Xóa kỹ năng ${skill}`} onClick={() => setSkills(current => current.filter(value => value !== skill))}><Icon name="close" /></button></span>)}
              <input id="skills" value={skillInput} onChange={event => setSkillInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }} placeholder="Ví dụ: React, Tiếng Anh..." />
              <button type="button" onClick={addSkill} className="cl-skill-add">Thêm</button>
            </div>
          </Field>
          <div className="cl-post-field-row">{select('experience', 'Kinh nghiệm')}{select('education', 'Trình độ học vấn')}</div>
          <Field id="requirements" label="Yêu cầu khác"><textarea id="requirements" rows={4} value={draft.requirements} onChange={event => update('requirements', event.target.value)} placeholder="Các yêu cầu chuyên môn hoặc kỹ năng khác..." /></Field>
        </fieldset>
        <fieldset hidden={section !== 3} disabled={section !== 3}>
          <legend className="sr-only">Lương và phúc lợi</legend>
          <label className="cl-post-check"><input type="checkbox" checked={negotiable} onChange={event => setNegotiable(event.target.checked)} />Mức lương thương lượng</label>
          {!negotiable && <div className="cl-post-salary-row">
            <Field id="salaryMin" label="Lương tối thiểu" required><input id="salaryMin" type="number" min="0" value={draft.salaryMin} onChange={event => update('salaryMin', event.target.value)} placeholder="Ví dụ: 15000000" required /></Field>
            <Field id="salaryMax" label="Lương tối đa" required><input id="salaryMax" type="number" min={Number(draft.salaryMin) || 0} value={draft.salaryMax} onChange={event => update('salaryMax', event.target.value)} placeholder="Ví dụ: 25000000" required /></Field>
            <Field id="currency" label="Đơn vị"><select id="currency" value={draft.currency} onChange={event => update('currency', event.target.value)}><option>VND</option><option>USD</option></select></Field>
          </div>}
          <Field id="benefits" label="Quyền lợi & phúc lợi" hint="Mỗi quyền lợi viết trên một dòng."><textarea id="benefits" rows={5} value={draft.benefits} onChange={event => update('benefits', event.target.value)} placeholder="Bảo hiểm, thưởng, ngày nghỉ, cơ hội đào tạo..." /></Field>
        </fieldset>
        {notice && <p className="cl-post-notice" role="status"><Icon name="check" />{notice}</p>}
        <div className="cl-post-actions">
          <div>{section > 0 && <button type="button" className="cl-button-secondary" onClick={() => goToStep(section - 1)}>Quay lại</button>}<button type="button" className="cl-button-text" onClick={save}>Lưu nháp</button></div>
          <button type="submit" className="cl-button-primary">{section < steps.length - 1 ? 'Tiếp tục' : 'Xem trước tin'}<Icon name="right" /></button>
        </div>
      </form>
    </div>
    {preview && <Dialog title="Xem trước tin tuyển dụng" onClose={() => setPreview(false)}>
      <div className="cl-post-preview"><h3>{draft.title || 'Chưa nhập chức danh'}</h3><p>{[draft.location, draft.workType, draft.workStyle].filter(Boolean).join(' · ')}</p><strong>{salary}</strong>
        {[['Mô tả công việc', draft.description], ['Trách nhiệm chính', draft.responsibilities], ['Yêu cầu ứng viên', [draft.experience, draft.education, skills.join(', '), draft.requirements].filter(Boolean).join('\n')], ['Quyền lợi', draft.benefits]].filter(([,content]) => content).map(([label,content]) => <section key={label}><h4>{label}</h4><p>{content}</p></section>)}
      </div>
      <div className="cl-post-actions"><button type="button" className="cl-button-secondary" onClick={() => setPreview(false)}>Tiếp tục chỉnh sửa</button><button type="button" className="cl-button-primary" onClick={() => {if(save()){setPreview(false);onNavigate('recruiter-jobs');}}}>Lưu nháp và về danh sách</button></div>
    </Dialog>}
  </div>;
}

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <div className="cl-post-field"><label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && <small>{hint}</small>}</div>;
}

