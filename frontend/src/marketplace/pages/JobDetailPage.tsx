import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {signInFor} from '../routes';
import {useAuthSession} from '../auth-client';
import ReturnLink from '../components/ReturnLink';
import type {Job} from '../data';
import {allJobs} from '../public-data';
import {jobCopy} from '../job-copy';
import {useDemo,updateDemo,toggleSavedJob,applyToJob} from '../demo-store';
import {Panel,Field,Notice,label,type Navigate} from '../ui';
import CompanyMark from '../components/CompanyMark';
import {MatchDetail} from '../components/MatchBadge';
import Dialog from '../components/Dialog';
import Icon from '../components/Icon';
import JobCard from '../components/JobCard';

export default function JobDetailPage({job:original,onNavigate,candidateMode=false}:{job:Job;onNavigate:Navigate;candidateMode?:boolean}) {

  const {profile,cvs,defaultCvId,savedJobs,applications,jobTitles,jobStatuses}=useDemo();
  const candidateSession=useAuthSession()?.user.role==='CANDIDATE';
  const job=jobCopy({...original,title:jobTitles[original.id]??original.title});
  const unavailable=jobStatuses[job.id]==='Closed'||jobStatuses[job.id]==='Paused';
  const saved=candidateSession&&savedJobs.includes(job.id);
  const applied=candidateSession&&applications.some(a=>a.jobId===job.id);
  const params=useSearchParams();const router=useRouter();
  const [applicationOpen,setApplying]=useState<boolean|null>(null);
  const applying=applicationOpen??(candidateSession&&params.get('intent')==='apply'&&!applied&&!unavailable);
  const clearIntent=()=>{const query=new URLSearchParams(params.toString());query.delete('intent');router.replace(window.location.pathname+(query.size?'?'+query:''),{scroll:false});};
  const closeApplication=()=>{setApplying(false);if(params.has('intent'))clearIntent();};
  const startApply=()=>{if(!candidateSession){router.push(signInFor(window.location.pathname+window.location.search,'apply'));return;}setApplying(true);};
  const save=()=>{if(!candidateSession){router.push(signInFor(window.location.pathname+window.location.search,'save'));return;}toggleSavedJob(job.id);};
  useEffect(()=>{if(!candidateSession||params.get('intent')!=='save')return;
    updateDemo(state=>({savedJobs:state.savedJobs.includes(job.id)?state.savedJobs:[...state.savedJobs,job.id]}));
    const query=new URLSearchParams(params.toString());query.delete('intent');router.replace(window.location.pathname+(query.size?'?'+query:''),{scroll:false});
  },[candidateSession,job.id,params,router]);
  const [share,setShare]=useState('');
  const [notice,setNotice]=useState('');
  const salary=job.salaryLabel??(job.salaryMin.toLocaleString('vi-VN')+' – '+job.salaryMax.toLocaleString('vi-VN')+' '+job.currency);
  const related=allJobs.filter(j=>j.id!==job.id&&j.category===job.category).slice(0,3);

  return <div className="ui-page ui-job-page"><div className="ui-container">
    <ReturnLink fallback="/jobs">Quay lại danh sách việc làm</ReturnLink>
    <nav className="ui-breadcrumb" aria-label="Đường dẫn"><button onClick={()=>onNavigate(candidateMode?'candidate-home':'home')}>{candidateMode?'Tổng quan':'Trang chủ'}</button><Icon name="right"/><button onClick={()=>onNavigate('job-search')}>Tìm việc làm</button><Icon name="right"/><span>{label(job.category)}</span></nav>
    {notice&&<Notice>{notice}</Notice>}
    <Panel className="ui-job-hero">
      <div className="ui-row ui-job-heading"><CompanyMark company={job.company} className="ui-job-company-mark"/><div className="ui-grow"><h1 className="ui-job-title">{job.title}</h1><p className="ui-job-company-name">{job.company.name}</p><div className="ui-job-meta"><span><Icon name="pin"/>{label(job.location)}</span><span><Icon name="briefcase"/>{label(job.workType)}</span><span>Đăng {job.postedDays} ngày trước</span></div></div></div>
      <div className="ui-job-action-row"><div><span className="ui-job-salary-label">Mức lương</span><p className="ui-salary">{salary}</p></div><div className="ui-actions ui-detail-actions"><button className="ui-btn ui-btn-primary" disabled={applied||unavailable} onClick={startApply}>{applied?'Đã ứng tuyển':unavailable?(jobStatuses[job.id]==='Closed'?'Tin đã đóng':'Tạm dừng tuyển'):'Ứng tuyển ngay'}{!applied&&!unavailable&&<Icon name="send"/>}</button><button className="ui-btn" aria-pressed={saved} onClick={save}><Icon name="heart" fill={saved?'currentColor':'none'}/>{saved?'Đã lưu':'Lưu việc làm'}</button><button className="ui-link ui-job-share" onClick={async()=>{const url=window.location.origin+'/jobs/'+encodeURIComponent(job.id);try{await navigator.clipboard.writeText(url);setNotice('Đã sao chép liên kết việc làm.');}catch{setShare(url);}}}>Chia sẻ</button></div></div>
      {unavailable&&<p className="ui-job-application-note">Vị trí này hiện không nhận hồ sơ mới. <button className="ui-link" onClick={()=>onNavigate('job-search')}>Tìm công việc khác</button></p>}
      {applied&&<p className="ui-job-application-note">Bạn có thể theo dõi hồ sơ tại <button className="ui-link" onClick={()=>onNavigate('candidate-applications')}>Việc làm đã ứng tuyển</button>.</p>}
    </Panel>
    <div className="ui-columns ui-job-body"><div className="ui-stack">
      <Panel className="ui-job-details"><section><h2>Mô tả công việc</h2><p className="ui-text">{job.description}</p></section>{[['Trách nhiệm chính',job.responsibilities],['Yêu cầu ứng viên',job.requirements],['Quyền lợi',job.benefits]].map(([title,items])=><section key={String(title)}><h2>{title}</h2><ul className="ui-bullets">{(items as string[]).map((s,i)=><li key={i}>{s}</li>)}</ul></section>)}{job.skills.length>0&&<section><h2>Kỹ năng</h2><div className="ui-tags">{job.skills.map(s=><span key={s} className="ui-tag">{s}</span>)}</div></section>}</Panel>
      <Panel title="Thông tin nhà tuyển dụng"><div className="ui-row"><CompanyMark company={job.company} className="size-14"/><div><h3>{job.company.name}</h3><p className="ui-small ui-muted">{job.company.location} · {job.company.size} nhân viên</p></div></div><p className="ui-text" style={{marginTop:16}}>{job.id.startsWith('ref-')?job.company.description:job.company.name+' đang tìm kiếm những thành viên cùng phát triển sản phẩm và dịch vụ. Xem thêm các vị trí tuyển dụng để tìm cơ hội phù hợp với bạn.'}</p><button className="ui-link" style={{marginTop:16}} onClick={()=>onNavigate('job-search',{keyword:job.company.name})}>Xem việc làm của công ty →</button></Panel>
      {related.length>0&&<section><div className="ui-panel-heading"><h2>Việc làm tương tự</h2></div><div className="cl-job-collection">{related.map(j=><JobCard key={j.id} job={j} showMatch={false} onView={()=>onNavigate('job-detail',j)}/>)}</div></section>}
    </div><aside className="ui-stack ui-sticky ui-job-sidebar">
      <Panel title="Thông tin chung"><dl className="ui-summary">{[['Địa điểm',label(job.location)],['Cấp bậc',label(job.level)],['Loại công việc',label(job.workType)],['Hình thức',label(job.workStyle)]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></Panel>
      <section className="ui-job-cv-note"><Icon name="document"/><div><h2>Chuẩn bị hồ sơ ứng tuyển</h2><p>Chọn CV phù hợp với vị trí này.</p><button className="ui-link" onClick={()=>onNavigate('cv-upload')}>Quản lý CV →</button></div></section>
      {candidateSession&&job.match!==undefined&&<MatchDetail score={job.match} matchedSkills={job.matchedSkills??[]} missingSkills={job.missingSkills??[]} label="Độ phù hợp với hồ sơ"/>}
    </aside></div>
    {applying&&<Dialog title="Ứng tuyển công việc" onClose={closeApplication}><form className="ui-form" onSubmit={e=>{e.preventDefault();if(unavailable){closeApplication();setNotice('Tin hiện không nhận hồ sơ mới.');return;}const form=e.currentTarget;const selectedId=String(new FormData(form).get('cv'));applyToJob(job.id,cvs.find(cv=>cv.id===selectedId)?.name??'Hồ sơ nghề nghiệp trên Talentiq',{contactName:(form.elements.namedItem('apply-name') as HTMLInputElement).value.trim(),contactEmail:(form.elements.namedItem('apply-email') as HTMLInputElement).value.trim(),coverLetter:(form.elements.namedItem('apply-letter') as HTMLTextAreaElement).value.trim()});closeApplication();setNotice('Đã thêm hồ sơ ứng tuyển vào phiên demo. Chưa gửi thông tin đến nhà tuyển dụng.');}}><div><h3 style={{fontSize:18,fontWeight:700}}>{job.title}</h3><p className="ui-small ui-muted">{job.company.name}</p></div><Field id="apply-name" label="Họ và tên *"><input id="apply-name" defaultValue={profile.name} required autoComplete="name"/></Field><Field id="apply-email" label="Email liên hệ *"><input id="apply-email" type="email" defaultValue={profile.email} required autoComplete="email"/></Field><Field id="apply-profile" label="Hồ sơ ứng tuyển"><select id="apply-profile" name="cv" defaultValue={defaultCvId||'profile'}><option value="profile">Hồ sơ nghề nghiệp trên Talentiq</option>{cvs.map(cv=><option key={cv.id} value={cv.id}>{cv.name}{cv.id===defaultCvId?' (mặc định)':''}</option>)}</select></Field><Field id="apply-letter" label="Lời giới thiệu" hint="Chia sẻ ngắn gọn lý do bạn phù hợp với vị trí."><textarea id="apply-letter" rows={3} placeholder="Kính gửi nhà tuyển dụng..."/></Field><p className="ui-small ui-muted">Thao tác được mô phỏng trong trình duyệt, chưa gửi hồ sơ ra ngoài.</p><div className="ui-form-actions"><button type="button" className="ui-btn" onClick={closeApplication}>Hủy</button><button className="ui-btn ui-btn-primary">Xác nhận ứng tuyển</button></div></form></Dialog>}
    {share&&<Dialog title="Chia sẻ việc làm" onClose={()=>setShare('')}><Field id="share-url" label="Sao chép liên kết"><input id="share-url" value={share} readOnly onFocus={e=>e.target.select()}/></Field></Dialog>}
  </div></div>;
}
