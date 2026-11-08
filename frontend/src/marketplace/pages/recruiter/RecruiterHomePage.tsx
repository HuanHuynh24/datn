import { useEffect } from 'react';
import { useAuthSession, setCurrentCompany } from '../../auth-client';
import { getMyCompany } from '../../company-client';
import { useJobCatalog } from '../../job-catalog';
import HomeHero from '../../components/HomeHero';
import Icon from '../../components/Icon';
import { Panel, Notice, Stat, type Navigate } from '../../ui';

export default function RecruiterHomePage({ onNavigate }: { onNavigate: Navigate }) {
  const company = useAuthSession()?.company;
  useEffect(() => {
    getMyCompany().then(setCurrentCompany).catch(() => { /* Auth client handles expired sessions. */ });
  }, []);
  const approved = company?.approval_status === 'APPROVED';
  const {source:jobs,loading}=useJobCatalog({own:true});
  return <div className="cl-home cl-workspace-home">
    <h1 className="sr-only">Tổng quan nhà tuyển dụng {company?.company_name||''}</h1>
    <HomeHero onNavigate={onNavigate}/>
    <section className="cl-section cl-container cl-member-section">
      <div className="cl-section-heading"><h2>{company?.company_name||'Doanh nghiệp của bạn'}</h2><button onClick={()=>onNavigate('recruiter-company')}>Hồ sơ công ty<Icon name="right"/></button></div>
      <p className="cl-overview-description">Quản lý doanh nghiệp, đội ngũ và hoạt động tuyển dụng tại một nơi.</p>
      {!approved&&<Notice>Doanh nghiệp {company?.approval_status==='REJECTED'?'chưa được duyệt':'đang chờ duyệt'}. Bạn vẫn có thể hoàn thiện hồ sơ; nghiệp vụ tuyển dụng cần Admin phê duyệt.</Notice>}
      <div className="ui-stats"><Stat title="Tổng tin tuyển dụng" value={loading?'…':jobs.length} icon="briefcase" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Đang chờ duyệt" value={jobs.filter(job=>job.status==='PENDING').length} icon="clock" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Tin đang công khai" value={jobs.filter(job=>job.status==='APPROVED').length} icon="check" onClick={()=>onNavigate('recruiter-jobs')}/><Stat title="Thành viên hoạt động" value={company?.active_member_count??'…'} icon="users" onClick={()=>onNavigate('recruiter-company')}/></div>
      <div className="cl-member-grid"><Panel title="Hồ sơ doanh nghiệp"><h3>{company?.company_name}</h3><p className="ui-muted">{company?.industry||'Chưa cập nhật lĩnh vực'}</p><p>{company?.address||'Chưa cập nhật địa chỉ'}</p><button className="ui-link" onClick={()=>onNavigate('recruiter-company')}>Cập nhật hồ sơ →</button></Panel><Panel title="Gói & thành viên"><h3>{company?.package.name||'Đang tải gói'}</h3><p>Thành viên hoạt động: {company?.active_member_count??'…'} / {company?.package.member_limit??'Chưa cấu hình'}</p><p className="ui-small ui-muted">Hạn mức bao gồm OWNER.</p></Panel><Panel title="Tuyển dụng"><p>{approved?'Doanh nghiệp đã được phê duyệt và có thể quản lý tin tuyển dụng.':'Doanh nghiệp cần được phê duyệt trước khi đăng tin.'}</p><button className="ui-btn ui-btn-primary" disabled={!approved} onClick={()=>onNavigate('recruiter-create-job')}>Đăng tin tuyển dụng</button></Panel></div>
    </section>
  </div>;
}
