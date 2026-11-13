'use client';

import {useState, type ReactNode, type FormEvent} from 'react';
import Link from 'next/link';
import Icon from '../components/Icon';
import {applicationStatuses, type ApplicationPage, type ApplicationStatus} from '../applications-client';
import './candidate-applications.css';

interface Props {
  result?:ApplicationPage; loading:boolean; error:string; status:string; jobId:string; page:number;
  navigate:(values:Record<string,string>,resetPage?:boolean)=>void;
  retry:()=>void; download:(id:string)=>Promise<void>; children:ReactNode;
}
const statusNotes:Record<ApplicationStatus,string>={
  APPLIED:'Hồ sơ đã được gửi đến nhà tuyển dụng.',
  REVIEWING:'Nhà tuyển dụng đang xem xét hồ sơ của bạn.',
  INTERVIEW:'Hồ sơ đã chuyển sang giai đoạn phỏng vấn.',
  OFFER:'Hồ sơ đã chuyển sang giai đoạn đề nghị tuyển dụng.',
  HIRED:'Nhà tuyển dụng đã đánh dấu hồ sơ được tuyển.',
  REJECTED:'Hồ sơ chưa được chọn cho vị trí này. Bạn có thể tìm thêm cơ hội khác.',
};
const date=(value:string)=>new Date(value).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});

export default function CandidateApplicationsView({result,loading,error,status,jobId,page,navigate,retry,download,children}:Props) {
  const [downloading,setDownloading]=useState<string>();
  const [downloadError,setDownloadError]=useState('');
  const filtered=!!(status||jobId);
  const pages=Math.max(1,Math.ceil((result?.total??0)/10));
  async function saveCV(id:string) {
    if(downloading)return;
    setDownloading(id);setDownloadError('');
    try { await download(id); }
    catch(reason) { setDownloadError(reason instanceof Error?reason.message:'Không thể tải CV. Vui lòng thử lại.'); }
    finally { setDownloading(undefined); }
  }
  function filter(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({status:String(new FormData(event.currentTarget).get('status')||'')},true);
  }
  return <div className="candidate-applications"><div className="ca-shell">
    <header className="ca-heading"><div><p className="ca-eyebrow">HÀNH TRÌNH NGHỀ NGHIỆP</p><h1>Việc làm đã ứng tuyển</h1><p>Theo dõi hồ sơ đã gửi và những bước tiếp theo của bạn.</p></div><Link className="ca-primary" href="/jobs"><Icon name="search"/>Tìm việc phù hợp</Link></header>
    <div className="ca-layout"><section className="ca-main" aria-label="Danh sách đơn ứng tuyển">
      <form className="ca-filters" onSubmit={filter}><div className="ca-filter-field"><label htmlFor="application-status">Trạng thái hồ sơ</label><select id="application-status" name="status" defaultValue={status}><option value="">Tất cả trạng thái</option>{Object.entries(applicationStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><button className="ca-primary" type="submit"><Icon name="search"/>Lọc hồ sơ</button>{filtered&&<Link className="ca-reset" href="/candidate/applications">Xóa bộ lọc</Link>}</form>
      {jobId&&<div className="ca-context">Đang lọc hồ sơ của một tin tuyển dụng.<button onClick={()=>navigate({jobId:'',job_id:''},true)}>Xem tất cả tin<Icon name="close"/></button></div>}
      <div className="ca-list-heading"><h2>Hồ sơ của bạn</h2>{!loading&&!error&&result&&<span>{result.total} đơn ứng tuyển</span>}</div>
      {downloadError&&<div className="ca-error" role="alert"><Icon name="bell"/><p>{downloadError}</p><button aria-label="Đóng thông báo lỗi tải CV" onClick={()=>setDownloadError('')}><Icon name="close"/></button></div>}
      {error?<div className="ca-state ca-failure" role="alert"><span className="ca-state-icon"><Icon name="bell"/></span><h3>Chưa tải được hồ sơ</h3><p>{error}</p><div className="ca-state-actions"><button className="ca-primary" onClick={retry}>Thử lại</button><Link className="ca-secondary" href="/candidate/applications">Xóa bộ lọc</Link></div></div>:loading?<div className="ca-loading" role="status" aria-live="polite"><p>Đang tải đơn ứng tuyển…</p><div className="ca-skeleton" aria-hidden="true"/><div className="ca-skeleton" aria-hidden="true"/></div>:result?.items.length?<div className="ca-list">{result.items.map(item=><article className="ca-card" key={item.id}>
        <div className="ca-card-heading"><span className="ca-company-mark" aria-hidden="true">{item.company_name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('')}</span><div className="ca-card-title"><h3><button onClick={()=>navigate({application_id:item.id})}>{item.job_title}</button></h3><p>{item.company_name}</p></div><span className="ca-status" data-status={item.status}><span/>{applicationStatuses[item.status]}</span></div>
        <div className="ca-card-meta"><span><Icon name="clock"/>Đã nộp {date(item.submitted_at)}</span><span><Icon name="document"/>CV tại thời điểm ứng tuyển</span></div><p className="ca-status-note">{statusNotes[item.status]}</p>
        <footer className="ca-card-actions"><button className="ca-detail" onClick={()=>navigate({application_id:item.id})}>Chi tiết đơn #{item.id}<Icon name="arrow"/></button><button className="ca-download" disabled={!!downloading} onClick={()=>void saveCV(item.id)}><Icon name="document"/>{downloading===item.id?'Đang tải CV…':'Tải CV đã nộp'}</button></footer>
      </article>)}</div>:<div className="ca-state"><span className="ca-state-icon"><Icon name={filtered?'search':'send'}/></span><p className="ca-state-kicker">{filtered?'KẾT QUẢ TÌM KIẾM':'SẴN SÀNG CHO CƠ HỘI MỚI'}</p><h3>{filtered?'Chưa có đơn phù hợp':page>1?'Trang này chưa có hồ sơ':'Bạn chưa ứng tuyển công việc nào'}</h3><p>{filtered?'Chưa tìm thấy hồ sơ theo bộ lọc đã chọn. Hãy thử trạng thái khác hoặc xem tất cả đơn.':page>1?'Quay lại các trang trước để xem hồ sơ bạn đã gửi.':'Khám phá công việc phù hợp, chọn CV và gửi hồ sơ. Bạn sẽ theo dõi trạng thái ứng tuyển ngay tại đây.'}</p><div className="ca-state-actions">{filtered?<Link className="ca-primary" href="/candidate/applications">Xem tất cả hồ sơ</Link>:page>1?<button className="ca-primary" onClick={()=>navigate({page:'1',application_id:''})}>Về trang đầu</button>:<Link className="ca-primary" href="/jobs"><Icon name="search"/>Khám phá việc làm</Link>}<Link className="ca-secondary" href="/candidate/cvs">Quản lý CV</Link></div></div>}
      {!loading&&!error&&result&&(result.total>10||page>1)&&<nav className="ca-pagination" aria-label="Phân trang đơn ứng tuyển"><button disabled={page===1} onClick={()=>navigate({page:String(page-1),application_id:''})}>Trang trước</button><span>Trang {page} / {pages}</span><button disabled={page*10>=result.total} onClick={()=>navigate({page:String(page+1),application_id:''})}>Trang sau</button></nav>}
    </section><aside className="ca-aside"><section className="ca-guide"><span className="ca-guide-icon"><Icon name="document"/></span><h2>Mỗi hồ sơ, một cơ hội</h2><p>Chuẩn bị CV đầy đủ và theo dõi kết quả tại một nơi.</p><ol><li><span>1</span><div><strong>Chuẩn bị CV</strong><p>Tải CV PDF hoặc DOCX, tối đa 10 MiB.</p></div></li><li><span>2</span><div><strong>Gửi hồ sơ ứng tuyển</strong><p>Chọn CV cho vị trí bạn quan tâm.</p></div></li><li><span>3</span><div><strong>Theo dõi trạng thái</strong><p>Xem cập nhật từ nhà tuyển dụng tại đây.</p></div></li></ol><Link href="/candidate/cvs">Đến CV của tôi<Icon name="arrow"/></Link></section><div className="ca-privacy"><Icon name="shield"/><p>CV được lưu riêng tư. Nhà tuyển dụng nhận bản CV bạn đã chọn khi ứng tuyển.</p></div></aside></div>
    {children}
  </div></div>;
}
