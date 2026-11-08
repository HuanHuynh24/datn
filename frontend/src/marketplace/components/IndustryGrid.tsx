import { useState } from 'react';
import Image from 'next/image';
import { reference } from '../public-data';
import { CarouselControls } from './ReferenceSections';

const values: Record<string, string> = {
  'Kế toán / Kiểm toán': 'Finance',
  'Nghệ thuật / Thiết kế / Giải trí': 'Design',
  'CNTT - Phần mềm': 'Engineering',
  'Quảng cáo / Khuyến mãi / Đối ngoại': 'Marketing',
  'Giáo dục / Đào tạo / Thư viện': 'Education',
};

export default function IndustryGrid({ onNavigate }: { onNavigate: (page: string, data?: unknown) => void }) {
  return <>
    <IndustryPages className="cl-industries-desktop" pageSize={12} onNavigate={onNavigate} />
    <IndustryPages className="cl-industries-mobile" pageSize={6} onNavigate={onNavigate} />
  </>;
}

function IndustryPages({ className, pageSize, onNavigate }: { className: string; pageSize: number; onNavigate: (page: string, data?: unknown) => void }) {
  const [page, setPage] = useState(0);
  const count = Math.ceil(reference.categories.length / pageSize);
  return <div className={className}>
    <div className="cl-industry-grid">
      {reference.categories.slice(page * pageSize, (page + 1) * pageSize).map(category => (
        <button key={category.label} className="cl-industry" onClick={() => onNavigate('job-search', { category: values[category.label] ?? category.label })}>
          <span className="cl-category-icon"><Image unoptimized src={category.image} alt="" width={60} height={60} /></span>
          <span className="cl-industry-name">{category.label}</span>
          <small>{category.count}</small>
        </button>
      ))}
    </div>
    <div className="cl-industry-pagination"><CarouselControls page={page} count={count} onChange={setPage} label="Trang ngành nghề" /><span aria-live="polite">{page + 1} / {count}</span></div>
  </div>;
}
