import Image from 'next/image';
import Icon from './Icon';
import type { reference } from '../public-data';
export function SectionHeading({title,onView}:{title:string;onView:()=>void}) {
  return <div className="cl-section-heading"><h2>{title}</h2><button onClick={onView}>Xem tất cả<Icon name="right" /></button></div>;
}
export function CarouselControls({page,count,onChange,label}:{page:number;count:number;onChange:(page:number)=>void;label:string}) {
  return <div className="cl-carousel-controls" aria-label={label}>
    <button className="cl-carousel-prev" onClick={()=>onChange((page+count-1)%count)} aria-label={`${label} trước`}><Icon name="right" /></button>
    <div className="cl-carousel-dots">{Array.from({length:count},(_,index)=><button key={index} aria-label={`${label} ${index+1}`} aria-pressed={page===index} onClick={()=>onChange(index)} />)}</div>
    <button className="cl-carousel-next" onClick={()=>onChange((page+1)%count)} aria-label={`${label} tiếp theo`}><Icon name="right" /></button>
  </div>;
}
export function CompanyCard({company,onView}:{company:(typeof reference.companies)[number];onView:()=>void}) {
  return <article className="cl-company-card">
    <Image unoptimized src={company.image} alt="" width={320} height={130} className="cl-company-cover" />
    <div className="cl-company-body"><div className="cl-company-logo"><Image unoptimized src={company.logo} alt={company.name} width={70} height={70} /></div><h3><button onClick={onView}>{company.name}</button></h3><p>{company.hiring}</p></div>
    <div className="cl-company-footer"><button onClick={onView}>{company.count}</button><small><Icon name="pin" />{company.location || 'Việt Nam'}</small></div>
  </article>;
}

