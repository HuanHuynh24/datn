import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, useAuthSession } from '../../auth-client';
import { useJobCatalog } from '../../job-catalog';
import { useListReturn } from '../../view-state';
import ProfilePhoto from '../../components/ProfilePhoto';
import DashboardWelcome from '../../components/DashboardWelcome';
import JobCard from '../../components/JobCard';
import Icon from '../../components/Icon';
import { SectionHeading } from '../../components/ReferenceSections';
import { Panel, Stat, Badge, Notice, type Navigate } from '../../ui';

type Application = { id:string; job_id:string; job_title:string; status:string };
type ApplicationPage = { items:Application[]; total:number };
type CV = { id:string; is_primary:boolean; format:string };
const statusLabel:Record<string,string>={APPLIED:'Applied',REVIEWING:'Under Review',INTERVIEW:'Interview',OFFER:'Offer',HIRED:'Hired',REJECTED:'Rejected'};

export default function CandidateHomePage({ onNavigate }: { onNavigate: Navigate }) {
  const remember=useListReturn('candidate-home');
  const profile = useAuthSession()?.profile;
  const accountName = profile?.full_name || 'Ứng viên';
  const [applications,setApplications]=useState<Application[]>([]);
  const [cvs,setCvs]=useState<CV[]>([]);
  const [applicationTotal,setApplicationTotal]=useState(0);const [interviewTotal,setInterviewTotal]=useState(0);
  const [overviewLoading,setOverviewLoading]=useState(true);const [overviewError,setOverviewError]=useState('');const [overviewVersion,setOverviewVersion]=useState(0);
  useEffect(()=>{let active=true;Promise.all([apiRequest<ApplicationPage>('/api/v1/candidates/me/applications?limit=10&offset=0'),apiRequest<CV[]>('/api/v1/candidates/me/cvs'),apiRequest<ApplicationPage>('/api/v1/candidates/me/applications?status=INTERVIEW&limit=1&offset=0')]).then(([apps,items,interviews])=>{if(active){setApplications(apps.items);setApplicationTotal(apps.total);setInterviewTotal(interviews.total);setCvs(items);}}).catch(reason=>{if(active)setOverviewError(reason instanceof Error?reason.message:'Chưa tải được tổng quan hồ sơ.');}).finally(()=>{if(active)setOverviewLoading(false);});return()=>{active=false;};},[overviewVersion]);
  const profileFields = [profile?.full_name, profile?.phone, profile?.address, profile?.introduction, profile?.desired_position, profile?.education, profile?.experience];
  const complete = Math.round(profileFields.filter(value => typeof value === 'string' ? value.trim() : Array.isArray(value)?value.length:typeof value==='object'&&value?Object.keys(value).length:Boolean(value)).length / profileFields.length * 100);
  const {available,loading,error:jobsError,reload:reloadJobs}=useJobCatalog();
  const recommended = available.slice(0,6);
  const primaryCV=cvs.find(cv=>cv.is_primary)??cvs[0];
  return <div className="cl-home cl-workspace-home">
    <DashboardWelcome audience="candidate" title={'Chào mừng trở lại, '+accountName.split(' ').slice(-2).join(' ')} description="Cập nhật hồ sơ hôm nay, sẵn sàng cho cơ hội nghề nghiệp tiếp theo." href="/jobs" action="Khám phá việc làm" secondaryHref="/candidate/profile" secondaryAction="Hoàn thiện hồ sơ"/>
    <section className="cl-section cl-container cl-member-section">
      <div className="cl-section-heading"><h2>Hồ sơ & hoạt động</h2><button onClick={()=>onNavigate('candidate-profile')}>Chỉnh sửa hồ sơ<Icon name="right"/></button></div>
      <p className="cl-overview-description">Theo dõi hồ sơ, CV và tiến độ ứng tuyển của bạn tại một nơi.</p>
      {overviewError&&<div><Notice error>{overviewError}</Notice><button className="ui-link" onClick={()=>{setOverviewError('');setOverviewLoading(true);setOverviewVersion(v=>v+1);}}>Thử tải lại tổng quan</button></div>}
      <div className="ui-stats"><Stat title="Việc làm trong danh sách" value={loading?'…':jobsError?'—':available.length} icon="briefcase" onClick={()=>onNavigate('candidate-recommended')}/><Stat title="CV của tôi" value={overviewLoading?'…':overviewError?'—':cvs.length} icon="document" onClick={()=>onNavigate('cv-upload')}/><Stat title="Đơn ứng tuyển" value={overviewLoading?'…':overviewError?'—':applicationTotal} icon="send" onClick={()=>onNavigate('candidate-applications')}/><Stat title="Đơn ở bước phỏng vấn" value={overviewLoading?'…':overviewError?'—':interviewTotal} icon="clock" onClick={()=>onNavigate('candidate-applications',{status:'Interview'})}/></div>
      <div className="cl-member-grid">
        <Panel title="Hồ sơ nghề nghiệp"><div className="ui-row"><ProfilePhoto id="self" initials={accountName.split(' ').slice(-2).map(value=>value[0]).join('')}/><div><h3>{accountName}</h3><p className="ui-small ui-muted">{profile?.desired_position||'Chưa cập nhật vị trí mong muốn'}</p></div></div><div className="cl-profile-progress"><div className="ui-row ui-row-between"><span>Hoàn thiện hồ sơ</span><strong>{complete}%</strong></div><progress className="ui-progress" max="100" value={complete}/></div><button className="ui-link" onClick={()=>onNavigate('candidate-profile')}>Chỉnh sửa hồ sơ →</button></Panel>
        <Panel title="CV của bạn"><div className="ui-file"><Icon name="document"/><div><strong>{overviewLoading?'Đang tải CV…':overviewError?'Chưa tải được CV':primaryCV?`CV #${primaryCV.id}`:'Chưa có CV'}</strong><p className="ui-small ui-muted">{primaryCV?.format.toUpperCase()||'PDF hoặc DOCX · Tối đa 10 MiB'}</p></div></div><p className="ui-text">CV được lưu riêng tư trên hệ thống và chỉ được chia sẻ khi bạn ứng tuyển.</p><button className="ui-link" onClick={()=>onNavigate('cv-upload')}>{primaryCV?'Quản lý CV':'Tải CV lên'} →</button></Panel>
        <Panel title="Cập nhật ứng tuyển" action={<button className="ui-link" onClick={()=>onNavigate('candidate-applications')}>Xem tất cả</button>}><div className="ui-list">{applications.slice(0,3).map(app=><div className="ui-list-item cl-application-update" key={app.id}><Link href={'/candidate/applications?'+new URLSearchParams({application_id:app.id})}>{app.job_title}</Link><Badge value={statusLabel[app.status]??app.status}/></div>)}{overviewLoading?<p role="status">Đang tải hồ sơ…</p>:overviewError?<p className="ui-muted">Chưa tải được cập nhật ứng tuyển.</p>:!applications.length&&<p className="ui-muted">Bạn chưa ứng tuyển công việc nào.</p>}</div></Panel>
      </div>
    </section>
    <section className="cl-section cl-container cl-hot-section"><SectionHeading title="Một số việc làm đang tuyển" onView={()=>onNavigate('candidate-recommended')}/>{loading?<p className="ui-muted">Đang tải việc làm…</p>:jobsError?<div><Notice error>{jobsError}</Notice><button className="ui-link" onClick={reloadJobs}>Thử tải lại việc làm</button></div>:<div className="cl-hot-grid">{recommended.slice(0,3).map(job=><JobCard key={job.id} job={job} compact showMatch={false} onView={()=>onNavigate('job-detail',{...job,returnTo:remember()})}/>)}</div>}<div className="cl-section-more"><button className="ui-btn" onClick={()=>onNavigate('job-search')}>Khám phá tất cả việc làm<Icon name="right"/></button></div></section>
  </div>;
}
