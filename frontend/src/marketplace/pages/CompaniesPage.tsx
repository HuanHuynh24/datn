import {useState} from 'react';
import {reference} from '../public-data';
import {CompanyCard} from '../components/ReferenceSections';
import {Page,Empty,type Navigate} from '../ui';
import Icon from '../components/Icon';
export default function CompaniesPage({onNavigate}:{onNavigate:Navigate}){
 const [keyword,setKeyword]=useState('');const [location,setLocation]=useState('');
 const cities=[...new Set(reference.companies.map(c=>c.location).filter(Boolean))];
 const filtered=reference.companies.filter(c=>(c.name+' '+c.location).toLowerCase().includes(keyword.trim().toLowerCase())&&(!location||c.location===location));
 return <Page eyebrow="Khám phá doanh nghiệp" title="Nhà tuyển dụng hàng đầu" description="Tìm hiểu doanh nghiệp và khám phá các vị trí họ đang tuyển."><div className="ui-toolbar"><label className="ui-search"><Icon name="search"/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Tên công ty, địa điểm" aria-label="Tìm công ty"/></label><label className="ui-sort">Khu vực<select value={location} onChange={e=>setLocation(e.target.value)}><option value="">Tất cả địa điểm</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label></div><p className="ui-small ui-muted" style={{marginBottom:20}} aria-live="polite">{filtered.length} nhà tuyển dụng</p><div className="cl-directory-grid">{filtered.map(c=><CompanyCard key={c.name} company={c} onView={()=>onNavigate('job-search',{keyword:c.name})}/>)}</div>{!filtered.length&&<Empty title="Chưa tìm thấy công ty phù hợp" text="Thử tìm bằng tên khác hoặc mở rộng khu vực." action={<button className="ui-btn" onClick={()=>{setKeyword('');setLocation('');}}>Xem tất cả công ty</button>}/>}</Page>;
}
