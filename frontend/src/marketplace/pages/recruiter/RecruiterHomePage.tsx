import { useEffect,useState } from 'react';
import { useAuthSession, setCurrentCompany } from '../../auth-client';
import { getMyCompany } from '../../company-client';
import {getJobs} from '../../jobs-client';
import DashboardWelcome from '../../components/DashboardWelcome';
import Icon from '../../components/Icon';
import { Panel, Notice, Stat, type Navigate } from '../../ui';

export default function RecruiterHomePage({ onNavigate }: { onNavigate: Navigate }) {
  const company = useAuthSession()?.company;
  const [counts,setCounts]=useState({total:0,pending:0,approved:0});const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [version,setVersion]=useState(0);
  useEffect(() => {
    let active=true;
    Promise.all([getMyCompany(),getJobs('limit=1&offset=0',true),getJobs('limit=1&offset=0&status=PENDING',true),getJobs('limit=1&offset=0&status=APPROVED',true)]).then(([profile,all,pending,approved])=>{if(active){setCurrentCompany(profile);setCounts({total:all.total,pending:pending.total,approved:approved.total});}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Chưa tải được tổng quan tuyển dụng.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  }, [version]);
  const approved = company?.approval_status === 'APPROVED';
  return <div className="cl-home cl-workspace-home">
    <DashboardWelcome audience="recruiter" title="Xây dựng đội ngũ, tạo bước tiến mới" description={'Chào mừng '+(company?.company_name||'doanh nghiệp của bạn')+'. Quản lý tin tuyển dụng và kết nối với ứng viên tại một nơi.'} href={approved?'/recruiter/jobs/new':'/recruiter/company'} action={approved?'Đăng tin tuyển dụng':'Hoàn thiện doanh nghiệp'} secondaryHref="/recruiter/jobs" secondaryAction="Quản lý tin đã đăng"/>
    <section className="cl-section cl-container cl-member-section">
      <div className="cl-section-heading"><h2>{company?.company_name||'Doanh nghiệp của bạn'}</h2><button onClick={()=>onNavigate('recruiter-company')}>Hồ sơ công ty<Icon name="right"/></button></div>
      <p className="cl-overview-description">Quản lý doanh nghiệp, đội ngũ và hoạt động tuyển dụng tại một nơi.</p>
      {!approved&&<Notice>Doanh nghiệp {company?.approval_status==='REJECTED'?'chưa được duyệt':'đang chờ duyệt'}. Bạn vẫn có thể hoàn thiện hồ sơ; nghiệp vụ tuyển dụng cần Admin phê duyệt.</Notice>}
      {error&&<div><Notice error>{error}</Notice><button className="ui-link" onClick={()=>{setError('');setLoading(true);setVersion(v=>v+1);}}>Thử tải lại tổng quan</button></div>}
      <div className="ui-stats"><Stat title="Tổng tin tuyển dụng" value={loading?'…':error?'—':counts.total} icon="briefcase" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Đang chờ duyệt" value={loading?'…':error?'—':counts.pending} icon="clock" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Tin đã duyệt" value={loading?'…':error?'—':counts.approved} icon="check" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Thành viên hoạt động" value={company?.active_member_count??'…'} icon="users" onClick={()=>onNavigate('recruiter-company')}/></div>
      <div className="cl-member-grid"><Panel title="Hồ sơ doanh nghiệp"><h3>{company?.company_name}</h3><p className="ui-muted">{company?.industry||'Chưa cập nhật lĩnh vực'}</p><p>{company?.address||'Chưa cập nhật địa chỉ'}</p><button className="ui-link" onClick={()=>onNavigate('recruiter-company')}>Cập nhật hồ sơ →</button></Panel><Panel title="Gói & thành viên"><h3>{company?.package.name||'Đang tải gói'}</h3><p>Thành viên hoạt động: {company?.active_member_count??'…'} / {company?.package.member_limit??'Chưa cấu hình'}</p><p className="ui-small ui-muted">Hạn mức bao gồm OWNER.</p></Panel><Panel title="Tuyển dụng"><p>{approved?'Doanh nghiệp đã được phê duyệt và có thể quản lý tin tuyển dụng.':'Doanh nghiệp cần được phê duyệt trước khi đăng tin.'}</p><button className="ui-btn ui-btn-primary" disabled={!approved} onClick={()=>onNavigate('recruiter-create-job')}>Đăng tin tuyển dụng</button></Panel></div>
    </section>
  </div>;
}
