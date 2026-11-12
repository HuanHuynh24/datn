import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import PublicCompanyCard from '../components/PublicCompanyCard';
import {listPublicCompanies,type PublicCompanyPage} from '../public-company-client';
import Dropdown from '../components/Dropdown';
import Dialog from '../components/Dialog';
import Icon from '../components/Icon';
import './companies.css';
const fields=[{name:'q',label:'Tìm công ty'},{name:'industry',label:'Lĩnh vực'},{name:'location',label:'Khu vực'}];
export default function CompaniesPage(){
 const params=useSearchParams();return <Directory key={params.toString()} search={params.toString()}/>;
}
function Directory({search}:{search:string}){
 const router=useRouter();const params=new URLSearchParams(search);
 const raw=Number(params.get('page')??1);const page=Number.isSafeInteger(raw)&&raw>0&&raw<=1000000?raw:1;
 const [result,setResult]=useState<PublicCompanyPage>();const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const [keyword,setKeyword]=useState(params.get('q')??'');
 const [location,setLocation]=useState(params.get('location')??'');
 const [industry,setIndustry]=useState(params.get('industry')??'');
 const [openFilter,setOpenFilter]=useState<string|null>(null);const [drawer,setDrawer]=useState(false);
 const active=fields.filter(field=>params.get(field.name)?.trim());
 useEffect(()=>{let active=true;const current=new URLSearchParams(search);const query=new URLSearchParams({limit:'12',offset:String((page-1)*12)});for(const {name} of fields){const value=current.get(name)?.trim();if(value)query.set(name,value);}listPublicCompanies(query.toString()).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Không thể tải danh sách công ty.');});return()=>{active=false;};},[search,page,version]);
 function navigate(query:URLSearchParams){router.push('/companies'+(query.size?'?'+query.toString():''));}
 function remove(name:string){const query=new URLSearchParams(search);query.delete(name);query.delete('page');navigate(query);}
 function go(nextPage:number){const query=new URLSearchParams(search);query.set('page',String(nextPage));navigate(query);}
 function update(values:Record<string,string>){const query=new URLSearchParams(search);query.delete('page');for(const [key,value] of Object.entries(values)){if(value.trim())query.set(key,value.trim());else query.delete(key);}navigate(query);}
 function reset(){setKeyword('');setIndustry('');setLocation('');setOpenFilter(null);setDrawer(false);router.push('/companies');}
 const filterInput=(name:'industry'|'location')=><label className="ui-field" htmlFor={'company-'+name}>{name==='industry'?'Lĩnh vực':'Địa chỉ/khu vực'}<input id={'company-'+name} maxLength={name==='industry'?200:255} value={name==='industry'?industry:location} onChange={event=>name==='industry'?setIndustry(event.target.value):setLocation(event.target.value)} placeholder={name==='industry'?'Ví dụ: phần mềm, giáo dục…':'Ví dụ: Hà Nội, Đà Nẵng…'}/></label>;
 return <div className="cl-results-page company-directory-page">
  <form className="cl-results-mobile-search" aria-label="Tìm nhà tuyển dụng trên điện thoại" onSubmit={event=>{event.preventDefault();update({q:keyword,location});}}>
   <input id="company-query-mobile" aria-label="Từ khóa tìm công ty" value={keyword} maxLength={200} onChange={event=>setKeyword(event.target.value)} placeholder="Bạn muốn tìm công ty nào?"/>
   <input className="cl-results-location" aria-label="Địa điểm công ty" value={location} maxLength={255} onChange={event=>setLocation(event.target.value)} placeholder="Tỉnh, thành phố"/>
   <button aria-label="Tìm kiếm"><Icon name="search"/></button>
  </form>
  <div className="cl-filter-bar"><div className="cl-filter-inner">
   {(['industry','location'] as const).map(name=><Dropdown key={name} className="cl-filter" triggerClassName="cl-filter-trigger" panelClassName="cl-filter-panel" open={openFilter===name} onOpenChange={open=>setOpenFilter(open?name:null)} label={<><Icon name={name==='industry'?'building':'pin'}/><span>{name==='industry'?'Lĩnh vực':'Khu vực'}</span>{params.get(name)&&<span className="cl-filter-count">1</span>}<Icon name="down"/></>}>
    <form className="ui-form" onSubmit={event=>{event.preventDefault();update({[name]:name==='industry'?industry:location});setOpenFilter(null);}}>{filterInput(name)}<div className="ui-form-actions"><button className="ui-btn" type="button" onClick={()=>{if(name==='industry')setIndustry('');else setLocation('');update({[name]:''});setOpenFilter(null);}}>Xóa</button><button className="ui-btn ui-btn-primary" type="submit">Áp dụng</button></div></form>
   </Dropdown>)}
  </div></div>
  <div className="cl-results-wrap cl-results-wrap-grid"><div>
   <div className="cl-results-heading"><h1>Nhà tuyển dụng</h1></div>
   <div className="cl-results-sort"><p aria-live="polite"><strong>{result&&!error?result.total:0}</strong> nhà tuyển dụng</p><button className="cl-mobile-filter-button" onClick={()=>setDrawer(true)}>Bộ lọc</button><span className="company-directory-approval"><Icon name="shield"/>Doanh nghiệp đã được duyệt</span></div>
   {!!active.length&&<div className="cl-filter-chips" aria-label="Bộ lọc đang áp dụng">{active.map(field=><button key={field.name} type="button" onClick={()=>remove(field.name)} aria-label={'Bỏ lọc '+field.label}>{field.label}: {params.get(field.name)} ×</button>)}<button onClick={reset}>Xóa bộ lọc</button></div>}
   {error?<div className="cl-results-empty" role="alert"><Icon name="search"/><h2>Chưa tải được doanh nghiệp</h2><p>{error}</p><button onClick={()=>{setError('');setResult(undefined);setVersion(value=>value+1);}}>Thử lại</button></div>:!result?<div className="cl-results-empty" role="status"><Icon name="search"/><h2>Đang tải doanh nghiệp…</h2></div>:<>
    {result.items.length?<div className="cl-directory-grid company-directory-grid">{result.items.map(company=><PublicCompanyCard key={company.company_id} company={company} returnTo={'/companies'+(search?'?'+search:'')}/>)}</div>:<div className="cl-results-empty"><Icon name="search"/><h2>Chưa tìm thấy công ty phù hợp</h2><p>Thử từ khóa khác hoặc bỏ bớt điều kiện lọc.</p><button onClick={reset}>Xóa bộ lọc</button></div>}
    {!!result.items.length&&<p className="ui-results-range">Hiển thị {(page-1)*12+1}–{(page-1)*12+result.items.length} trong {result.total} doanh nghiệp</p>}
    {result.total>12&&<nav className="cl-results-pagination" aria-label="Phân trang nhà tuyển dụng"><button disabled={page===1} onClick={()=>go(page-1)}>Trang trước</button><span>Trang {page} / {Math.ceil(result.total/12)}</span><button disabled={page*12>=result.total} onClick={()=>go(page+1)}>Trang sau</button></nav>}
   </>}
  </div></div>
  {drawer&&<Dialog title="Bộ lọc nhà tuyển dụng" onClose={()=>setDrawer(false)}><form className="ui-form ui-filter-form" onSubmit={event=>{event.preventDefault();update({industry,location});setDrawer(false);}}>{filterInput('industry')}{filterInput('location')}<div className="ui-form-actions"><button className="ui-btn" type="button" onClick={reset}>Xóa bộ lọc</button><button className="ui-btn ui-btn-primary" type="submit">Áp dụng</button></div></form></Dialog>}
 </div>;
}
