import { useEffect, useState } from 'react';
import Icon from './Icon';
import { getJobCatalog, type CatalogItem } from '../jobs-client';
import { CarouselControls } from './ReferenceSections';

export default function IndustryGrid({ onNavigate }: { onNavigate: (page: string, data?: unknown) => void }) {
  const [items,setItems]=useState<CatalogItem[]>();
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;getJobCatalog().then(value=>{if(active)setItems(value.industries);}).catch(()=>{if(active)setError('Chưa tải được danh mục ngành nghề.');});return()=>{active=false;};},[]);
  if(error)return <p role="alert">{error}</p>;
  if(!items)return <p role="status">Đang tải ngành nghề…</p>;
  if(!items.length)return <p>Chưa có ngành nghề đang hoạt động.</p>;
  return <>
    <IndustryPages items={items} className="cl-industries-desktop" pageSize={12} onNavigate={onNavigate} />
    <IndustryPages items={items} className="cl-industries-mobile" pageSize={6} onNavigate={onNavigate} />
  </>;
}

function IndustryPages({ items, className, pageSize, onNavigate }: { items: CatalogItem[]; className: string; pageSize: number; onNavigate: (page: string, data?: unknown) => void }) {
  const [page, setPage] = useState(0);
  const count = Math.ceil(items.length / pageSize);
  return <div className={className}>
    <div className="cl-industry-grid">
      {items.slice(page * pageSize, (page + 1) * pageSize).map(category => (
        <button key={category.id} className="cl-industry" onClick={() => onNavigate('job-search', { industry_id: category.id })}>
          <span className="cl-category-icon"><Icon name="building" /></span>
          <span className="cl-industry-name">{category.name}</span>
        </button>
      ))}
    </div>
    <div className="cl-industry-pagination"><CarouselControls page={page} count={count} onChange={setPage} label="Trang ngành nghề" /><span aria-live="polite">{page + 1} / {count}</span></div>
  </div>;
}
