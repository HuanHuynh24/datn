import { useState } from 'react';
import type { JobCatalog, LiveJob } from '../jobs-client';
import Icon from './Icon';

export default function JobSkillsField({ catalog, initial }: { catalog: JobCatalog['skills']; initial: LiveJob['skills'] }) {
  const [selected, setSelected] = useState(initial);
  const available = catalog.filter(skill => !selected.some(item => item.skill_id === skill.id));
  return <fieldset className="job-skills-field">
    <legend>Kỹ năng tuyển dụng</legend>
    <p id="job-skills-hint" className="ui-small ui-muted">Chọn kỹ năng, đánh dấu yêu cầu bắt buộc và nhập độ ưu tiên theo nhu cầu tuyển dụng.</p>
    <label htmlFor="job-skills" className="ui-small">Thêm kỹ năng</label>
    <select id="job-skills" aria-describedby="job-skills-hint" value="" disabled={selected.length >= 100 || !available.length}
      onChange={event => { const skill = catalog.find(item => item.id === event.target.value); if (skill) setSelected(items => [...items, { skill_id: skill.id, name: skill.name, required: false, priority: 0 }]); }}>
      <option value="">{selected.length >= 100 ? 'Đã đạt giới hạn 100 kỹ năng' : available.length ? 'Chọn kỹ năng để thêm' : 'Không còn kỹ năng khả dụng để thêm'}</option>
      {available.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
    </select>
    {!selected.length && <p className="ui-small ui-muted">Chưa chọn kỹ năng nào.</p>}
    <div className="job-skills-list">{selected.map(skill => <div className="job-skill-row" key={skill.skill_id} data-skill-id={skill.skill_id}>
      <div className="job-skill-name"><strong>{skill.name}</strong>{!catalog.some(item => item.id === skill.skill_id) && <small>Đã ngừng chọn mới</small>}<input type="hidden" name="skill_ids" value={skill.skill_id}/></div>
      <label className="job-skill-required"><input type="checkbox" name={'skill_required_' + skill.skill_id} defaultChecked={skill.required}/> Bắt buộc<span className="sr-only">: {skill.name}</span></label>
      <div className="ui-field"><label htmlFor={'skill-priority-' + skill.skill_id}>Độ ưu tiên<span className="sr-only">: {skill.name}</span></label><input id={'skill-priority-' + skill.skill_id} name={'skill_priority_' + skill.skill_id} type="number" min="0" max="2147483647" step="1" required defaultValue={skill.priority}/></div>
      <button type="button" className="ui-btn" aria-label={'Bỏ kỹ năng ' + skill.name} onClick={() => setSelected(items => items.filter(item => item.skill_id !== skill.skill_id))}><Icon name="close"/><span>Bỏ</span></button>
    </div>)}</div>
    <p className="ui-small ui-muted">Độ ưu tiên là số nguyên không âm. Bạn có thể chọn tối đa 100 kỹ năng.</p>
  </fieldset>;
}
