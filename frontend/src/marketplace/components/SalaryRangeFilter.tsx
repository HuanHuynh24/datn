export const salaryRanges = [
  { value: '', label: 'Tất cả mức lương', minimum: '', maximum: '' },
  { value: 'upto10', label: 'Đến 10 triệu', minimum: '', maximum: '10000000' },
  { value: '10to15', label: '10 – 15 triệu', minimum: '10000000', maximum: '15000000' },
  { value: '15to20', label: '15 – 20 triệu', minimum: '15000000', maximum: '20000000' },
  { value: '20to30', label: '20 – 30 triệu', minimum: '20000000', maximum: '30000000' },
  { value: '30to50', label: '30 – 50 triệu', minimum: '30000000', maximum: '50000000' },
  { value: '50plus', label: 'Từ 50 triệu', minimum: '50000000', maximum: '' },
];
export function salarySelection(params: URLSearchParams) {
  return salaryRanges.find(range => range.minimum === (params.get('minimum_salary') ?? '') && range.maximum === (params.get('maximum_salary') ?? ''))?.value ?? 'custom';
}
export function salaryBounds(value: string, params: URLSearchParams) {
  const range = salaryRanges.find(item => item.value === value);
  return { minimum_salary: range?.minimum ?? params.get('minimum_salary') ?? '', maximum_salary: range?.maximum ?? params.get('maximum_salary') ?? '' };
}
export function salaryLabel(params: URLSearchParams) {
  const range = salaryRanges.find(item => item.value === salarySelection(params));
  if (range) return range.label;
  const format = (value: string) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('vi-VN') : value;
  const min = params.get('minimum_salary'), max = params.get('maximum_salary');
  return min && max ? `${format(min)} – ${format(max)} VND` : min ? `Từ ${format(min)} VND` : `Đến ${format(max ?? '')} VND`;
}
export default function SalaryRangeFilter({ value, onChange, params }: { value: string; onChange: (value: string) => void; params: URLSearchParams }) {
  return <div className="job-salary-options"><div className="search-filter-options">{salaryRanges.map(range => <label key={range.value}><input type="radio" name="salary_range" value={range.value} checked={value === range.value} onChange={() => onChange(range.value)}/><span>{range.label}</span></label>)}{salarySelection(params) === 'custom' && <label><input type="radio" name="salary_range" value="custom" checked={value === 'custom'} onChange={() => onChange('custom')}/><span>{salaryLabel(params)} (từ liên kết)</span></label>}</div><p className="search-filter-hint">Đơn vị VND. Hiển thị tin có khoảng lương giao với mức đã chọn; không gồm tin chỉ ghi thỏa thuận.</p></div>;
}
