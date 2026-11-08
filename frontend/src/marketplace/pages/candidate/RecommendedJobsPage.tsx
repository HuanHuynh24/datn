import {useViewState,useListReturn} from '../../view-state';
import {useJobCatalog} from '../../job-catalog';
import JobCard from '../../components/JobCard';
import Icon from '../../components/Icon';
import {WorkspacePhoto} from '../../components/WorkspaceHero';
import {Page,Empty,type Navigate} from '../../ui';

export default function RecommendedJobsPage({onNavigate,savedOnly=false}:{onNavigate:Navigate;savedOnly?:boolean}) {
  const {available}=useJobCatalog();
  const viewKey=savedOnly?'candidate-saved':'candidate-recommended';
  const remember=useListReturn(viewKey);
  const [sort,setSort]=useViewState(viewKey+':sort','match');
  const [search,setSearch]=useViewState(viewKey+':search','');
  const source=savedOnly?[]:available;
  const visible=source.filter(j=>(j.title+' '+j.company.name+' '+j.location).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='salary'?b.salaryMax-a.salaryMax:sort==='newest'?a.postedDays-b.postedDays:(b.match??0)-(a.match??0));
  return <Page visual="candidate" eyebrow="Không gian ứng viên" title={savedOnly?'Việc làm đã lưu':'Việc làm phù hợp'} description={savedOnly?'Lưu lại cơ hội bạn quan tâm để xem và ứng tuyển khi sẵn sàng.':'Tham khảo những cơ hội phù hợp với kỹ năng và kinh nghiệm trong hồ sơ.'} actions={<button className="ui-btn" onClick={()=>onNavigate('job-search')}>Xem tất cả việc làm<Icon name="right"/></button>}>
    <div className="ui-columns">
      <div>
        <div className="ui-toolbar"><label className="ui-search"><Icon name="search"/><input aria-label="Tìm trong danh sách việc làm" placeholder="Tên vị trí, công ty, địa điểm" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
        <div className="cl-results-sort">
          <p aria-live="polite"><strong>{visible.length}</strong> việc làm{savedOnly?' đã lưu':''}</p>
          <label>Sắp xếp<select aria-label="Sắp xếp việc làm" value={sort} onChange={e=>setSort(e.target.value)}><option value="match">Phù hợp nhất</option><option value="newest">Mới nhất</option><option value="salary">Lương cao nhất</option></select></label>
        </div>
        {visible.length?<div className="cl-hot-grid cl-workspace-job-grid">{visible.map(job=><JobCard key={job.id} job={job} compact onView={()=>onNavigate('job-detail',{...job,returnTo:remember()})}/>)}</div>:<Empty icon={savedOnly?'heart':'search'} title={search?'Không có kết quả phù hợp':savedOnly?'Bạn chưa lưu việc làm nào':'Chưa có gợi ý phù hợp'} text={search?'Thử tìm bằng từ khóa khác.':'Khám phá việc làm và nhấn biểu tượng trái tim để lưu cơ hội bạn quan tâm.'} action={<button className="ui-btn ui-btn-primary" onClick={()=>search?setSearch(''):onNavigate('job-search')}>{search?'Xóa từ khóa':'Khám phá việc làm'}</button>}/>}
      </div>
      <aside className="ui-stack">
        <section className="ui-panel ui-photo-panel"><WorkspacePhoto visual="career"/><div className="ui-photo-panel-copy"><h2>Sẵn sàng ứng tuyển</h2><p className="ui-text">Chuẩn bị CV để ứng tuyển ngay khi tìm được công việc phù hợp.</p><button className="ui-btn ui-btn-primary" onClick={()=>onNavigate('cv-upload')}>Quản lý CV<Icon name="right"/></button></div></section>
        <button className="ui-link" onClick={()=>onNavigate('candidate-applications')}>Theo dõi đơn ứng tuyển →</button>
      </aside>
    </div>
  </Page>;
}

