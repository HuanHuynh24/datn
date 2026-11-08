import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { publicJobs } from '../public-data';
import JobCard from '../components/JobCard';
import Icon, { type IconName } from '../components/Icon';
import Dropdown from '../components/Dropdown';
import Dialog from '../components/Dialog';
import {useViewState,useListReturn} from '../view-state';
import {useJobCatalog} from '../job-catalog';

interface Props { onNavigate:(page:string,data?:unknown)=>void }
const featuredJobIds = new Set(publicJobs.map(job => job.id));
const groups:{key:string;label:string;icon:IconName;items:{value:string;label:string}[]}[]=[
  {key:'category',label:'Ngành nghề',icon:'building',items:[{value:'Engineering',label:'IT - Phần mềm'},{value:'Design',label:'Thiết kế'},{value:'Finance',label:'Kế toán / Tài chính'},{value:'Sales',label:'Kinh doanh'},{value:'Marketing',label:'Marketing'},{value:'Operations',label:'Sản xuất / Vận hành'},{value:'Education',label:'Giáo dục'},{value:'Data',label:'Dữ liệu'}]},
  {key:'level',label:'Cấp bậc',icon:'briefcase',items:[{value:'Junior',label:'Mới đi làm'},{value:'Mid-level',label:'Nhân viên'},{value:'Senior',label:'Chuyên viên'},{value:'Lead',label:'Trưởng nhóm'}]},
  {key:'experience',label:'Kinh nghiệm',icon:'clock',items:[{value:'Junior',label:'Dưới 1 năm'},{value:'Mid-level',label:'1 - 3 năm'},{value:'Senior',label:'3 - 5 năm'},{value:'Lead',label:'Trên 5 năm'}]},
  {key:'salary',label:'Mức lương',icon:'coins',items:[{value:'negotiable',label:'Thương lượng / Cạnh tranh'},{value:'listed',label:'Có mức lương cụ thể'}]},
  {key:'workStyle',label:'Hình thức làm việc',icon:'globe',items:[{value:'Remote',label:'Làm từ xa'},{value:'On-site',label:'Tại văn phòng'},{value:'Hybrid',label:'Kết hợp'}]},
  {key:'workType',label:'Loại công việc',icon:'briefcase',items:[{value:'Full-time',label:'Toàn thời gian'},{value:'Part-time',label:'Bán thời gian'},{value:'Contract',label:'Hợp đồng'},{value:'Internship',label:'Thực tập'}]},
  {key:'posted',label:'Đăng trong',icon:'document',items:[{value:'1',label:'24 giờ qua'},{value:'3',label:'3 ngày qua'},{value:'7',label:'7 ngày qua'}]},
];
export default function JobSearchPage(props:Props) {
  const params=useSearchParams();
  return <SearchContent {...props} key={params.toString()} initialKeyword={params.get('keyword')??''} initialLocation={params.get('location')??''} initialCategory={params.get('category')??''}/>;
}
function SearchContent({onNavigate,initialKeyword,initialLocation,initialCategory}:Props & {initialKeyword:string;initialLocation:string;initialCategory:string}) {
  const {available:allJobs,loading,error}=useJobCatalog();
  const viewKey='jobs:'+JSON.stringify([initialKeyword,initialLocation,initialCategory]);
  const remember=useListReturn(viewKey);
  const [keyword,setKeyword]=useViewState(viewKey+':keyword',initialKeyword);
  const [location,setLocation]=useViewState(viewKey+':location',initialLocation);
  const [filters,setFilters]=useViewState<Record<string,string[]>>(viewKey+':filters',initialCategory?{category:[initialCategory]}:{});
  const [sort,setSort]=useViewState(viewKey+':sort','Most relevant');
  const [page,setPage]=useViewState(viewKey+':page',1);
  const [drawer,setDrawer]=useState(false);
  const [openFilter,setOpenFilter]=useState<string|null>(null);
  const [alert,setAlert]=useState(false);
  const toggle=(key:string,value:string)=>{setFilters(current=>({...current,[key]:(current[key]??[]).includes(value)?current[key].filter(item=>item!==value):[...(current[key]??[]),value]}));setPage(1);};
  const filtered=allJobs.filter(job=>{
    const kw=keyword.trim().toLowerCase();
    if(kw && ![job.title,job.company.name,...job.skills].some(text=>text.toLowerCase().includes(kw)))return false;
    if(location && !job.location.toLowerCase().includes(location.trim().toLowerCase()))return false;
    return Object.entries(filters).every(([key,values])=>{
      if(!values.length)return true;
      if(key==='salary')return values.includes(job.salaryMin===0?'negotiable':'listed');
      if(key==='posted')return values.some(value=>job.postedDays<=Number(value));
      const value=key==='category'?job.category:key==='workType'?job.workType:key==='workStyle'?job.workStyle:job.level;
      return values.includes(value);
    });
  });
  const sorted=[...filtered].sort((a,b)=>sort==='Newest'?a.postedDays-b.postedDays:sort==='Salary: High to low'?b.salaryMax-a.salaryMax:sort==='Best match'?(b.match??0)-(a.match??0):0);
  const pages=Math.max(1,Math.ceil(sorted.length/15));
  const currentPage=Math.min(page,pages);
  const filterFields=(group:typeof groups[number])=><>{group.items.map(item=><label key={item.value}><input type="checkbox" checked={(filters[group.key]??[]).includes(item.value)} onChange={()=>toggle(group.key,item.value)} /><span>{item.label}</span></label>)}</>;
  const submit=(e:React.FormEvent)=>{e.preventDefault();onNavigate('job-search',{keyword,location});};
  const resetSearch=()=>{setFilters({});setKeyword('');setLocation('');setPage(1);setOpenFilter(null);onNavigate('job-search');};
  return <div className="cl-results-page">
    <form className="cl-results-mobile-search" onSubmit={submit}><input aria-label="Từ khóa tìm việc" value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1);}} placeholder="Bạn muốn tìm việc gì?" /><input className="cl-results-location" aria-label="Địa điểm tìm việc" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Tỉnh, thành phố" /><button aria-label="Tìm kiếm"><Icon name="search" /></button></form>
    <div className="cl-filter-bar"><div className="cl-filter-inner">{groups.map((group,index)=><Dropdown key={group.key} className="cl-filter" triggerClassName="cl-filter-trigger" panelClassName="cl-filter-panel" align={index>4?'end':'start'} open={openFilter===group.key} onOpenChange={open=>setOpenFilter(open?group.key:null)} label={<><Icon name={group.icon} /><span>{group.label}</span>{!!filters[group.key]?.length&&<span className="cl-filter-count">{filters[group.key].length}</span>}<Icon name="down" /></>}>{filterFields(group)}</Dropdown>)}</div></div>
    <div className="cl-results-wrap cl-results-wrap-grid"><div>
      <div className="cl-results-heading"><h1>{keyword?`Việc làm “${keyword}”`:'Tất cả việc làm'}</h1><button aria-pressed={alert} onClick={()=>setAlert(!alert)}><Icon name="bell" />{alert?'Đang theo dõi (demo)':'Theo dõi tìm kiếm này'}</button></div>
      <div className="cl-results-sort"><p><strong>{filtered.length}</strong> việc làm</p><button className="cl-mobile-filter-button" onClick={()=>setDrawer(true)}>Bộ lọc</button><label>Sắp xếp<select aria-label="Sắp xếp việc làm" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="Most relevant">Phù hợp nhất</option><option value="Newest">Mới cập nhật</option><option value="Salary: High to low">Lương cao nhất</option><option value="Best match">Độ tương thích</option></select></label></div>
      {Object.values(filters).some(values=>values.length>0)&&<div className="cl-filter-chips">{groups.flatMap(group=>(filters[group.key]??[]).map(value=><button key={group.key+value} onClick={()=>toggle(group.key,value)}>{group.items.find(item=>item.value===value)?.label??value} ×</button>))}<button onClick={()=>{setFilters({});setPage(1);}}>Xóa bộ lọc</button></div>}
      {loading?<div className="cl-results-empty" role="status"><Icon name="search" /><h2>Đang tải việc làm</h2><p>Dữ liệu đang được lấy từ hệ thống.</p></div>:error?<div className="cl-results-empty" role="alert"><Icon name="search" /><h2>Chưa tải được việc làm</h2><p>{error}</p></div>:sorted.length?<div className="cl-hot-grid cl-results-grid">{sorted.slice((currentPage-1)*15,currentPage*15).map(job=><JobCard key={job.id} job={job} compact featured={featuredJobIds.has(job.id)} headingLevel={2} showMatch={false} onView={()=>onNavigate('job-detail',{...job,returnTo:remember()})} />)}</div>:<div className="cl-results-empty"><Icon name="search" /><h2>Chưa tìm thấy việc làm phù hợp</h2><p>Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc.</p><button onClick={resetSearch}>Xem tất cả việc làm</button></div>}
      {sorted.length>0&&<p className="ui-results-range">Hiển thị {(currentPage-1)*15+1}–{Math.min(currentPage*15,sorted.length)} trong {sorted.length} việc làm</p>}
      {pages>1&&<nav className="cl-results-pagination" aria-label="Phân trang">{Array.from({length:pages},(_,index)=><button key={index} aria-label={`Trang ${index+1}`} aria-current={currentPage===index+1?'page':undefined} onClick={()=>{setPage(index+1);window.scrollTo({top:0,behavior:'smooth'});}}>{index+1}</button>)}</nav>}
    </div></div>
    {drawer&&<Dialog title="Bộ lọc tìm kiếm" onClose={()=>setDrawer(false)}><div className="ui-filter-form">{groups.map(group=><fieldset key={group.key}><legend>{group.label}</legend><div className="cl-filter-panel-static">{filterFields(group)}</div></fieldset>)}</div><div className="ui-form-actions"><button className="ui-btn" onClick={()=>{setFilters({});setPage(1);}}>Xóa bộ lọc</button><button className="ui-btn ui-btn-primary" onClick={()=>setDrawer(false)}>Xem {filtered.length} việc làm</button></div></Dialog>}
  </div>;
}



