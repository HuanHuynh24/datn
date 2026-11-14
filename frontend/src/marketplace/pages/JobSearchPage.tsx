import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import JobCard from '../components/JobCard';
import Icon, { type IconName } from '../components/Icon';
import Dropdown from '../components/Dropdown';
import Dialog from '../components/Dialog';
import FilterActions from '../components/FilterActions';
import {useListReturn} from '../view-state';
import {liveJobToPresentation} from '../job-catalog';
import {getJobCatalog, getJobs, type JobCatalog, type JobPage} from '../jobs-client';

interface Props { onNavigate:(page:string,data?:unknown)=>void }
const pageSize=15;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').trim().replace(/^(thanh pho|tinh)\s+/,'');
export default function JobSearchPage(props:Props) {
  const params=useSearchParams();
  const [catalog,setCatalog]=useState<JobCatalog>();const [catalogError,setCatalogError]=useState('');const [version,setVersion]=useState(0);
  useEffect(()=>{let active=true;getJobCatalog().then(value=>{if(active)setCatalog(value);}).catch(reason=>{if(active)setCatalogError(reason instanceof Error?reason.message:'Không thể tải danh mục.');});return()=>{active=false;};},[version]);
  return <SearchContent {...props} key={params.toString()} search={params.toString()} catalog={catalog} catalogError={catalogError} retryCatalog={()=>{setCatalogError('');setVersion(value=>value+1);}}/>;
}
function SearchContent({onNavigate,search,catalog,catalogError,retryCatalog}:Props & {search:string;catalog?:JobCatalog;catalogError:string;retryCatalog:()=>void}) {
  const router=useRouter();
  const params=new URLSearchParams(search);
  const [result,setResult]=useState<JobPage>();
  const [requestError,setError]=useState('');
  const viewKey='jobs:'+search;
  const remember=useListReturn(viewKey);
  const [keyword,setKeyword]=useState(params.get('keyword')??params.get('q')??'');
  const [location,setLocation]=useState(params.get('location')??'');
  const [salary,setSalary]=useState(params.get('minimum_salary')??'');
  const [workType,setWorkType]=useState(params.get('work_type')??'');
  const rawPage=Number(params.get('page')??1);
  const page=Number.isSafeInteger(rawPage)&&rawPage>0&&rawPage<=1000000?rawPage:1;
  const sort=['newest','salary_asc','salary_desc'].includes(params.get('sort')??'')?params.get('sort')!:'newest';
  const [drawer,setDrawer]=useState(false);
  const [openFilter,setOpenFilter]=useState<string|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const resolveId=(kind:'provinces'|'industries',key:string,legacy:string)=>params.get(key)||catalog?.[kind].find(item=>normalize(item.name)===normalize(params.get(legacy)??''))?.id||'';
  const provinceId=resolveId('provinces','province_id','location');
  const industryId=resolveId('industries','industry_id','category');
  const filters:Record<string,string[]>={province_id:provinceId?[provinceId]:[],industry_id:industryId?[industryId]:[],skill_id:params.get('skill_id')?[params.get('skill_id')!]:[]};
  const groups:{key:string;label:string;icon:IconName;items:{value:string;label:string}[]}[]=[
    {key:'industry_id',label:'Ngành nghề',icon:'building',items:catalog?.industries.map(item=>({value:item.id,label:item.name}))??[]},
    {key:'province_id',label:'Tỉnh/thành',icon:'pin',items:catalog?.provinces.map(item=>({value:item.id,label:item.name}))??[]},
    {key:'skill_id',label:'Kỹ năng',icon:'briefcase',items:catalog?.skills.map(item=>({value:item.id,label:item.name}))??[]},
  ];
  const invalidCatalog=Boolean(catalog&&groups.some(group=>params.get(group.key)&&!group.items.some(item=>item.value===params.get(group.key))));
  const unresolvedLegacy=Boolean(catalog&&((params.get('location')?.trim()&&!provinceId)||(params.get('category')?.trim()&&!industryId)));
  const needsCatalog=Boolean((!params.get('province_id')&&params.get('location')?.trim())||(!params.get('industry_id')&&params.get('category')?.trim()));
  const waitingForCatalog=needsCatalog&&!catalog;
  const validatingCatalog=!catalog&&(needsCatalog||Boolean(params.get('province_id')||params.get('industry_id')||params.get('skill_id')));
  const error=requestError||(invalidCatalog||unresolvedLegacy?'Danh mục không còn khả dụng. Hãy xóa bộ lọc và chọn lại từ danh sách.':'')||(validatingCatalog?catalogError:'');
  const loading=!error&&(!result||validatingCatalog);
  useEffect(()=>{
    if(waitingForCatalog||invalidCatalog||unresolvedLegacy)return;
    let active=true;
    const query=new URLSearchParams({limit:String(pageSize),offset:String((page-1)*pageSize),sort});
    const current=new URLSearchParams(search);
    const values:Record<string,string>={q:current.get('keyword')??current.get('q')??'',province_id:provinceId,industry_id:industryId,skill_id:current.get('skill_id')??'',minimum_salary:current.get('minimum_salary')??'',work_type:current.get('work_type')??''};
    for(const [key,value] of Object.entries(values))if(value.trim())query.set(key,value.trim());
    getJobs(query.toString()).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Không thể tải việc làm.');});
    return()=>{active=false;};
  },[waitingForCatalog,invalidCatalog,unresolvedLegacy,search,provinceId,industryId,page,sort]);
  function update(values:Record<string,string>,resetPage=true){const next=new URLSearchParams(search);for(const [key,value] of Object.entries(values)){if(value.trim())next.set(key,value.trim());else next.delete(key);}if(resetPage)next.delete('page');router.push('/jobs'+(next.size?'?'+next.toString():''),{scroll:false});}
  const setPage=(value:number)=>update({page:String(value)},false);
  const setSort=(value:string)=>update({sort:value});
  const toggle=(key:string,value:string)=>update({[key]:filters[key]?.includes(value)?'':value,...(key==='province_id'?{location:''}:key==='industry_id'?{category:''}:{})});
  const legacyKey=(key:string):Record<string,string>=>key==='province_id'?{location:''}:key==='industry_id'?{category:''}:{};
  function openRefinement(key:string,open:boolean){
    if(open){
      if(key==='advanced'){setSalary(params.get('minimum_salary')??'');setWorkType(params.get('work_type')??'');}
      else setDraft(current=>({...current,[key]:filters[key]?.[0]??''}));
    }
    setOpenFilter(open?key:null);
  }
  function openDrawer(){setDraft(Object.fromEntries(groups.map(group=>[group.key,filters[group.key]?.[0]??''])));setSalary(params.get('minimum_salary')??'');setWorkType(params.get('work_type')??'');setDrawer(true);}
  function applyGroup(key:string){update({[key]:draft[key]??filters[key]?.[0]??'',...legacyKey(key)});setOpenFilter(null);}
  const sorted=result?.items.map(liveJobToPresentation)??[];
  const total=result?.total??0;
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const currentPage=page;
  const appliedKeyword=(params.get('keyword')??params.get('q')??'').trim();
  const pageNumbers=[...new Set([1,...Array.from({length:5},(_,index)=>page-2+index),pages])].filter(value=>value>0&&value<=pages).sort((a,b)=>a-b);
  const filterFields=(group:typeof groups[number])=><>{catalogError?<div role="alert"><p>{catalogError}</p><button className="ui-link" type="button" onClick={retryCatalog}>Thử tải lại danh mục</button></div>:!catalog?<p role="status">Đang tải danh mục…</p>:<><label><input type="radio" name={group.key} checked={!(draft[group.key]??filters[group.key]?.[0]??'')} onChange={()=>setDraft(current=>({...current,[group.key]:''}))}/>Tất cả</label>{group.items.map(item=><label key={item.value}><input type="radio" name={group.key} value={item.value} checked={(draft[group.key]??filters[group.key]?.[0]??'')===item.value} onChange={()=>setDraft(current=>({...current,[group.key]:item.value}))} /><span>{item.label}</span></label>)}{!group.items.length&&<p>Chưa có danh mục.</p>}</>}</>;
  const advancedFields=<><label className="ui-field search-filter-field">Mức lương từ (VND)<input aria-label="Mức lương từ (VND)" type="number" min="0" step="0.01" value={salary} onChange={event=>setSalary(event.target.value)}/></label><label className="ui-field search-filter-field">Hình thức làm việc<input aria-label="Hình thức làm việc" maxLength={60} placeholder="Ví dụ: Full-time" value={workType} onChange={event=>setWorkType(event.target.value)}/></label></>;
  const advanced=<form className="ui-form search-filter-form" onSubmit={event=>{event.preventDefault();update({minimum_salary:salary,work_type:workType});setOpenFilter(null);}}>{advancedFields}<p className="search-filter-hint">Chọn điều kiện, sau đó bấm Áp dụng.</p><FilterActions onClear={()=>{setSalary('');setWorkType('');update({minimum_salary:'',work_type:''});setOpenFilter(null);}}/></form>;
  const submit=(e:React.FormEvent)=>{e.preventDefault();update({keyword,q:'',location,province_id:location.trim()?'':provinceId});};
  const resetSearch=()=>{setDrawer(false);setOpenFilter(null);setDraft({});setSalary('');setWorkType('');setKeyword('');setLocation('');router.push('/jobs',{scroll:false});};
  return <div className="cl-results-page jobs-ui-sample">
    <form className="cl-results-mobile-search" onSubmit={submit}><input aria-label="Từ khóa tìm việc" maxLength={200} value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Bạn muốn tìm việc gì?" /><input className="cl-results-location" aria-label="Địa điểm tìm việc" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Tỉnh, thành phố" /><button aria-label="Tìm kiếm"><Icon name="search" /></button></form>
    <div className="jobs-search-intro"><div><p className="jobs-search-eyebrow"><span/>KHÁM PHÁ CƠ HỘI NGHỀ NGHIỆP</p><h1>{keyword?`Việc làm “${keyword}”`:'Tìm công việc phù hợp với bạn'}</h1><p className="jobs-search-description">Một khởi đầu mới, một bước tiến xa hơn. Khám phá vị trí tiếp theo của bạn.</p></div><span className="jobs-search-intro-icon" aria-hidden="true"><Icon name="briefcase"/></span></div>
    <div className="cl-filter-bar"><div className="cl-filter-inner"><span className="jobs-filter-caption">Lọc theo</span>{groups.map((group,index)=><Dropdown key={group.key} className="cl-filter" triggerClassName={'cl-filter-trigger'+(filters[group.key]?.length?' is-selected':'')} panelClassName="cl-filter-panel" align={index>4?'end':'start'} open={openFilter===group.key} onOpenChange={open=>openRefinement(group.key,open)} label={<><Icon name={group.icon} /><span>{group.label}</span>{!!filters[group.key]?.length&&<span className="cl-filter-count">{filters[group.key].length}</span>}<Icon name="down" /></>}><form className="ui-form search-filter-form" onSubmit={event=>{event.preventDefault();applyGroup(group.key);}}><div className="search-filter-options">{filterFields(group)}</div><p className="search-filter-hint">Chọn điều kiện, sau đó bấm Áp dụng.</p><FilterActions applyDisabled={!catalog} onClear={()=>{update({[group.key]:'',...legacyKey(group.key)});setOpenFilter(null);}}/></form></Dropdown>)}<Dropdown className="cl-filter" triggerClassName={'cl-filter-trigger'+(params.get('minimum_salary')||params.get('work_type')?' is-selected':'')} panelClassName="cl-filter-panel" open={openFilter==='advanced'} onOpenChange={open=>openRefinement('advanced',open)} label={<><Icon name="coins"/>Lương & hình thức<Icon name="down"/></>}>{advanced}</Dropdown></div></div>
    <div className="cl-results-wrap cl-results-wrap-grid"><div>
      <div className="cl-results-sort"><div><p className="jobs-results-caption">DANH SÁCH TUYỂN DỤNG</p><p>{loading?'Đang tìm kiếm…':<><strong>{total}</strong> việc làm</>}</p></div><button className="cl-mobile-filter-button" onClick={openDrawer}><Icon name="menu"/>Bộ lọc</button><label>Sắp xếp<select aria-label="Sắp xếp việc làm" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Mới cập nhật</option><option value="salary_desc">Lương cao nhất</option><option value="salary_asc">Lương thấp nhất</option></select></label></div>
      {(appliedKeyword||Object.values(filters).some(values=>values.length>0)||params.get('minimum_salary')||params.get('work_type')||unresolvedLegacy||invalidCatalog)&&<div className="cl-filter-chips" aria-label="Bộ lọc đang áp dụng">{appliedKeyword&&<button aria-label="Bỏ lọc Từ khóa" onClick={()=>update({keyword:'',q:''})}>Từ khóa: {appliedKeyword} ×</button>}{groups.flatMap(group=>(filters[group.key]??[]).map(value=><button key={group.key+value} aria-label={'Bỏ lọc '+group.label} onClick={()=>toggle(group.key,value)}>{group.label}: {group.items.find(item=>item.value===value)?.label??value} ×</button>))}{params.get('minimum_salary')&&<button aria-label="Bỏ lọc Mức lương" onClick={()=>update({minimum_salary:''})}>Lương từ {params.get('minimum_salary')} VND ×</button>}{params.get('work_type')&&<button aria-label="Bỏ lọc Hình thức làm việc" onClick={()=>update({work_type:''})}>{params.get('work_type')} ×</button>}<button onClick={resetSearch}>Xóa bộ lọc</button></div>}
      {loading?<div className="cl-results-empty" role="status"><Icon name="search" /><h2>Đang tải việc làm</h2><p>Dữ liệu đang được lấy từ hệ thống.</p></div>:error?<div className="cl-results-empty" role="alert"><Icon name="search" /><h2>Chưa tải được việc làm</h2><p>{error}</p><button onClick={resetSearch}>Xóa bộ lọc</button></div>:sorted.length?<div className="cl-hot-grid cl-results-grid">{sorted.map(job=><JobCard key={job.id} job={job} compact headingLevel={2} showMatch={false} onView={()=>onNavigate('job-detail',{id:job.id,returnTo:remember()})}/>)}</div>:<div className="cl-results-empty"><Icon name="search" /><h2>Chưa tìm thấy việc làm phù hợp</h2><p>Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc.</p><button onClick={resetSearch}>Xem tất cả việc làm</button></div>}
      {sorted.length>0&&<p className="ui-results-range">Hiển thị {(currentPage-1)*pageSize+1}–{(currentPage-1)*pageSize+sorted.length} trong {total} việc làm</p>}
      {!loading&&!error&&pages>1&&<nav className="cl-results-pagination" aria-label="Phân trang"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Trước</button>{pageNumbers.map((value,index)=><span key={value}>{index>0&&value>pageNumbers[index-1]+1&&<span>…</span>}<button aria-label={`Trang ${value}`} aria-current={currentPage===value?'page':undefined} onClick={()=>{setPage(value);window.scrollTo({top:0,behavior:'smooth'});}}>{value}</button></span>)}<button disabled={page>=pages} onClick={()=>setPage(page+1)}>Sau</button></nav>}
    </div></div>
    {drawer&&<Dialog title="Bộ lọc tìm kiếm" onClose={()=>setDrawer(false)}><form className="ui-form ui-filter-form" onSubmit={event=>{event.preventDefault();if(!catalog)return;update({...Object.fromEntries(groups.map(group=>[group.key,draft[group.key]??filters[group.key]?.[0]??''])),location:'',category:'',minimum_salary:salary,work_type:workType});setDrawer(false);}}>{groups.map(group=><fieldset key={group.key}><legend>{group.label}</legend><div className="cl-filter-panel-static">{filterFields(group)}</div></fieldset>)}{advancedFields}<p className="search-filter-hint">Chọn điều kiện, sau đó bấm Áp dụng.</p><FilterActions applyDisabled={!catalog} clearLabel="Xóa bộ lọc" onClear={resetSearch}/></form></Dialog>}
  </div>;
}



