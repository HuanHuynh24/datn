import Icon, { type IconName } from './Icon';
const items: {label:string;page:string;icon:IconName}[]=[
  {label:'Trang chủ',page:'home',icon:'home'}, {label:'Tìm việc',page:'job-search',icon:'search'},
  {label:'Hồ sơ',page:'candidate-profile',icon:'document'}, {label:'Đã lưu',page:'candidate-saved',icon:'heart'},
  {label:'Đã nộp đơn',page:'candidate-applications',icon:'send'},
];
const guestItems: {label:string;page:string;icon:IconName}[]=[
  {label:'Trang chủ',page:'home',icon:'home'}, {label:'Tìm việc',page:'job-search',icon:'search'},
  {label:'Công ty',page:'companies',icon:'building'}, {label:'Cẩm nang',page:'career',icon:'document'},
  {label:'Đăng nhập',page:'signin',icon:'user'},
];
export default function MobileNav({page,candidateMode=false,onNavigate}:{page:string;candidateMode?:boolean;onNavigate:(page:string)=>void}) {
  const active = page === 'job-detail' || page === 'candidate-recommended' ? 'job-search' : page === 'cv-upload' ? 'candidate-profile' : page;
  const links = candidateMode ? items.map(item => item.page === 'home' ? {...item,page:'candidate-home',label:'Tổng quan'} : item) : guestItems;
  return <nav className="cl-mobile-bottom" aria-label="Điều hướng nhanh">{links.map(item=><button key={item.page} aria-current={item.page===active?'page':undefined} onClick={()=>onNavigate(item.page)}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>;
}


