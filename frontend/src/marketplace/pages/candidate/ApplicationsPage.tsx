
import {allJobs} from '../../public-data';
import {useDemo} from '../../demo-store';
import {Page,Badge,Empty,label,formatDate,type Navigate} from '../../ui';
import JobCard from '../../components/JobCard';
import {useSearchParams} from 'next/navigation';
import {useListReturn} from '../../view-state';

const steps=['Applied','Under Review','Interview','Offer'];

export default function ApplicationsPage({onNavigate}:{onNavigate:Navigate}) {
  const params=useSearchParams();
  const status=params.get('status')??'all';
  return <ApplicationsContent key={status} initialTab={['all','active','Interview','Rejected'].includes(status)?status:'all'} onNavigate={onNavigate}/>;
}
function ApplicationsContent({onNavigate,initialTab}:{onNavigate:Navigate;initialTab:string}) {
  const {applications}=useDemo();
  const remember=useListReturn('candidate-applications:'+initialTab);
  const tab=initialTab;
  const setTab=(status:string)=>onNavigate('candidate-applications',{status});
  const filtered=applications.filter(a=>tab==='all'||(tab==='active'?a.status!=='Rejected':a.status===tab));
  return <Page visual="candidate" eyebrow="Không gian ứng viên" title="Việc làm đã ứng tuyển" description="Theo dõi tiến độ từng hồ sơ và chuẩn bị cho các bước tiếp theo." actions={<button className="ui-btn" onClick={()=>onNavigate('job-search')}>Tìm thêm việc làm</button>}>
    <div className="ui-toolbar">
      <div className="ui-tabs" aria-label="Lọc đơn ứng tuyển">
        {[['all','Tất cả'],['active','Đang xử lý'],['Interview','Phỏng vấn'],['Rejected','Chưa phù hợp']].map(([value,text])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{text}<small>{applications.filter(a=>value==='all'||(value==='active'?a.status!=='Rejected':a.status===value)).length}</small></button>)}
      </div>
      <p className="ui-small ui-muted" aria-live="polite">{filtered.length} hồ sơ</p>
    </div>
    <div className="cl-job-collection">
      {filtered.map(a=>{
        const job=allJobs.find(j=>j.id===a.jobId);
        return job&&<JobCard key={a.id} job={job} headingLevel={2} showMatch={false} showSave={false} status={<Badge value={a.status}/>} onView={()=>onNavigate('job-detail',{...job,returnTo:remember()})}>
          <p className="ui-muted">Ứng tuyển ngày {formatDate(a.date)} · {label(job.workType)}</p>
          {a.cvName&&<p className="ui-muted">Hồ sơ đã chọn: {a.cvName}</p>}
          {(a.contactEmail||a.coverLetter)&&<details className="ui-application-copy"><summary>Thông tin đã gửi</summary><p>{a.contactName} · {a.contactEmail}</p>{a.coverLetter&&<p className="ui-preline">{a.coverLetter}</p>}</details>}
          {a.status!=='Rejected'?<ol className="ui-application-steps" aria-label="Tiến độ ứng tuyển">{steps.map((s,i)=><li key={s} data-complete={i<=steps.indexOf(a.status)} aria-current={s===a.status?'step':undefined}>{label(s)}</li>)}</ol>:<p className="ui-muted" style={{marginTop:16}}>Hồ sơ chưa phù hợp với vị trí này. Bạn có thể khám phá những cơ hội khác phù hợp hơn.</p>}
          {a.interview&&<p className="ui-interview">Lịch phỏng vấn: {a.interview}</p>}
          <button className="ui-link" style={{marginTop:18}} onClick={()=>onNavigate('job-detail',{...job,returnTo:remember()})}>Xem lại tin tuyển dụng →</button>
        </JobCard>;
      })}
    </div>
    {!filtered.length&&<Empty title="Chưa có hồ sơ trong nhóm này" text="Đơn ứng tuyển sẽ xuất hiện tại đây khi có cập nhật tương ứng." action={<button className="ui-btn" onClick={()=>setTab('all')}>Xem tất cả hồ sơ</button>}/>}
  </Page>;
}

