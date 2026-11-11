import { Field } from '../ui';

export function editableHistory(value: unknown): string[] | null {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
}

export function ProfileHistory({ value }: { value: unknown }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return <p className="ui-muted">Chưa cập nhật.</p>;
  if (Array.isArray(value)) return <ul className="ui-stack">{value.map((item, index) => <li key={index}><ProfileHistory value={item} /></li>)}</ul>;
  if (typeof value === 'object') return <dl className="ui-stack">{Object.entries(value).map(([key, item]) => <div key={key}><dt className="ui-small ui-muted">{key}</dt><dd><ProfileHistory value={item} /></dd></div>)}</dl>;
  return <p className="ui-preline">{String(value)}</p>;
}

export default function ProfileHistoryEditor({ title, prefix, value, onChange }: { title: string; prefix: string; value: unknown; onChange: (items: string[]) => void }) {
  const items = editableHistory(value);
  return <fieldset className="ui-stack"><legend>{title}</legend>{items === null ? <><ProfileHistory value={value} /><p className="ui-small ui-muted">Định dạng hồ sơ cũ được giữ nguyên khi lưu. Chưa hỗ trợ sửa định dạng này trong biểu mẫu.</p></> : <>
    {items.map((item, index) => <div key={index} className="ui-stack"><Field id={`${prefix}-${index}`} label={`${title} ${index + 1}`}><textarea id={`${prefix}-${index}`} rows={3} maxLength={2000} value={item} onChange={event => onChange(items.map((current, key) => key === index ? event.target.value : current))} placeholder={prefix === 'education' ? 'Trường, chuyên ngành, bằng cấp và thời gian học' : 'Công ty, vị trí, thời gian làm việc và thành tích'} /></Field><button type="button" className="ui-btn" onClick={() => onChange(items.filter((_, key) => key !== index))}>Xóa mục {title.toLowerCase()} {index + 1}</button></div>)}
    <button type="button" className="ui-btn" disabled={items.length >= 15} onClick={() => onChange([...items, ''])}>Thêm {title.toLowerCase()}</button>
    <p className="ui-small ui-muted">Tối đa 15 mục mô tả, 2.000 ký tự mỗi mục.</p>
  </>}</fieldset>;
}
