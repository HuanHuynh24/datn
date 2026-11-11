import {useViewState,useListReturn} from '../../view-state';
import {useJobCatalog} from '../../job-catalog';
import JobCard from '../../components/JobCard';
import Icon from '../../components/Icon';
import {WorkspacePhoto} from '../../components/WorkspaceHero';
import {Page,Empty,type Navigate} from '../../ui';

export default function RecommendedJobsPage({onNavigate}:{onNavigate:Navigate}) {
  const {available,loading,error,reload}=useJobCatalog();
  const viewKey='candidate-recommended';
  const remember=useListReturn(viewKey);
  const [storedSort,setSort]=useViewState(viewKey+':sort','newest');
  const sort=storedSort==='salary'?'salary':'newest';
  const [search,setSearch]=useViewState(viewKey+':search','');
  const visible=available.filter(j=>(j.title+' '+j.company.name+' '+j.location).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='salary'?b.salaryMax-a.salaryMax:a.postedDays-b.postedDays);
  return <Page visual="candidate" eyebrow="Không gian ứng viên" title="Khám phá việc làm" description="Hiển thị tối đa 100 tin công khai mới nhất, chưa cá nhân hóa theo hồ sơ. Dùng trang tìm việc để lọc và xem toàn bộ kết quả." actions={<button className="ui-btn" onClick={()=>onNavigate('job-search')}>Xem tất cả việc làm<Icon name="right"/></button>}>
    <div className="ui-columns">
      <div>
        <div className="ui-toolbar"><label className="ui-search"><Icon name="search"/><input aria-label="Tìm trong danh sách việc làm" placeholder="Tên vị trí, công ty, địa điểm" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
        <div className="cl-results-sort">
          <p aria-live="polite"><strong>{visible.length}</strong> việc làm trong danh sách</p>
          <label>Sắp xếp<select aria-label="Sắp xếp việc làm" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Mới nhất</option><option value="salary">Lương cao nhất</option></select></label>
        </div>
        {loading?<p role="status">Đang tải việc làm…</p>:error?<div role="alert"><p>{error}</p><button className="ui-btn" onClick={reload}>Thử lại</button></div>:visible.length?<div className="cl-hot-grid cl-workspace-job-grid">{visible.map(job=><JobCard key={job.id} job={job} compact onView={()=>onNavigate('job-detail',{...job,returnTo:remember()})}/>)}</div>:<Empty icon="search" title="Chưa tìm thấy việc làm" text="Thử từ khóa khác hoặc xem tất cả việc làm." action={<button className="ui-btn ui-btn-primary" onClick={()=>search?setSearch(''):onNavigate('job-search')}>{search?'Xóa từ khóa':'Khám phá việc làm'}</button>}/>}
      </div>
      <aside className="ui-stack">
        <section className="ui-panel ui-photo-panel"><WorkspacePhoto visual="career"/><div className="ui-photo-panel-copy"><h2>Sẵn sàng ứng tuyển</h2><p className="ui-text">Chuẩn bị CV để ứng tuyển ngay khi tìm được công việc phù hợp.</p><button className="ui-btn ui-btn-primary" onClick={()=>onNavigate('cv-upload')}>Quản lý CV<Icon name="right"/></button></div></section>
        <button className="ui-link" onClick={()=>onNavigate('candidate-applications')}>Theo dõi đơn ứng tuyển →</button>
      </aside>
    </div>
  </Page>;
}

