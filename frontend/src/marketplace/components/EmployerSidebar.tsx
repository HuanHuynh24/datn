import Link from 'next/link';
import Icon,{type IconName} from './Icon';
import {useAuthSession} from '../auth-client';

const links:{href:string;label:string;icon:IconName;pages:string[]}[]=[
  {href:'/recruiter',label:'Tổng quan',icon:'chart',pages:['recruiter-home']},
  {href:'/recruiter/jobs',label:'Tin tuyển dụng',icon:'briefcase',pages:['recruiter-jobs','recruiter-create-job','recruiter-edit-job']},
  {href:'/recruiter/applicants',label:'Hồ sơ ứng tuyển',icon:'users',pages:['recruiter-applicants']},
  {href:'/recruiter/pipeline',label:'Quy trình tuyển dụng',icon:'chart',pages:['recruiter-pipeline']},
  {href:'/recruiter/company',label:'Công ty & thành viên',icon:'building',pages:['recruiter-company']},
];
export default function EmployerSidebar({page}:{page:string}) {
  const company=useAuthSession()?.company;
  const approved=company?.approval_status==='APPROVED';
  return <aside className="actor-sidebar"><div className="actor-sidebar-caption">KHÔNG GIAN TUYỂN DỤNG</div><nav aria-label="Quản lý tuyển dụng">{links.map(link=><Link key={link.href} href={link.href} aria-current={link.pages.includes(page)?'page':undefined}><Icon name={link.icon}/><span>{link.label}</span></Link>)}</nav><section className="actor-sidebar-company"><span className="actor-sidebar-company-icon"><Icon name="building"/></span><h2>{company?.company_name||'Doanh nghiệp của bạn'}</h2><p className="actor-approval" data-approved={approved}>{approved?'Đã xác thực doanh nghiệp':company?.approval_status==='REJECTED'?'Cần hoàn thiện hồ sơ':'Đang chờ phê duyệt'}</p><Link href="/recruiter/company">Xem hồ sơ công ty<Icon name="arrow"/></Link></section><Link className="actor-sidebar-explore" href="/jobs"><Icon name="globe"/>Xem trang tìm việc</Link></aside>;
}
