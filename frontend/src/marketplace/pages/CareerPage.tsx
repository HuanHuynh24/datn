import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Image from 'next/image';
import {careerResources} from '../editorial-data';
import {Page,Panel,Empty,type Navigate} from '../ui';
import Icon from '../components/Icon';
const advice=[
 ['Chuẩn bị một ví dụ về cách bạn tìm hiểu nhu cầu khách hàng trước khi giới thiệu sản phẩm.','Giải thích cách bạn xử lý lời từ chối và duy trì mối quan hệ với khách hàng.','Hỏi rõ về chương trình đào tạo, mục tiêu công việc và cách đánh giá kết quả.'],
 ['Chọn ảnh rõ khuôn mặt, ánh sáng tự nhiên và nền đơn giản.','Dùng trang phục phù hợp với vị trí ứng tuyển; hạn chế bộ lọc làm thay đổi khuôn mặt.','Kiểm tra yêu cầu của nhà tuyển dụng trước khi thêm ảnh vào CV.'],
 ['Chuẩn bị ví dụ về cách tìm kiếm khách hàng và theo dõi nhu cầu của họ.','Mô tả một tình huống đàm phán và cách bạn phối hợp với các bên liên quan.','Hỏi về danh mục sản phẩm, hỗ trợ đào tạo và mục tiêu trong giai đoạn đầu.'],
 ['Ưu tiên thông tin liên quan trực tiếp đến vị trí ứng tuyển.','Dùng một trang nếu bạn có thể trình bày đầy đủ kinh nghiệm quan trọng mà vẫn dễ đọc.','Nếu cần hai trang, giữ kinh nghiệm nổi bật và thông tin liên hệ ở trang đầu.'],
 ['Đọc kỹ mô tả công việc để hiểu phạm vi trách nhiệm của vị trí HSE.','Chuẩn bị các tình huống thực tế thể hiện cách quan sát, ghi nhận và trao đổi vấn đề.','Mang theo thông tin về các khóa đào tạo và dự án chuyên môn có liên quan.'],
 ['Đặt tên ngắn gọn theo cấu trúc HoTen_ViTri_CV.','Ví dụ: NguyenMinhTuan_BackendDeveloper_CV.pdf.','Kiểm tra đúng phiên bản và định dạng được yêu cầu trước khi gửi.'],
 ['Chuẩn bị số liệu và ví dụ về công việc điều phối sản xuất bạn từng thực hiện.','Trình bày cách phối hợp với đội ngũ khi kế hoạch hoặc nguồn lực thay đổi.','Hỏi rõ về phạm vi quản lý, mục tiêu và cơ chế báo cáo của vị trí.'],
 ['Đối chiếu tên công ty và thông tin liên hệ với kênh chính thức.','Đọc kỹ mô tả công việc, địa điểm và cách thức phỏng vấn.','Giữ lại nội dung trao đổi và kiểm tra thông tin trước khi chia sẻ giấy tờ cá nhân.'],
 ['Chuẩn bị ví dụ về công việc lập kế hoạch, mua hàng hoặc logistics phù hợp với vị trí.','Nêu rõ công cụ bạn đã sử dụng và kết quả cụ thể của công việc.','Hỏi về hệ thống dữ liệu, nhóm phối hợp và mục tiêu của bộ phận.'],
 ['Chia sẻ ngắn gọn mục tiêu nghề nghiệp và vị trí bạn đang tìm.','Gửi CV cập nhật để người giới thiệu có đủ thông tin.','Chủ động tham gia quy trình tuyển dụng và cảm ơn người đã hỗ trợ bạn.'],
];
export default function CareerPage({onNavigate}:{onNavigate:Navigate}){
 const params=useSearchParams();const selected=params.get('article');const [search,setSearch]=useState('');const [tag,setTag]=useState('');
 const visible=careerResources.map((article,index)=>({...article,index})).filter(a=>(!tag||a.tag===tag)&&a.title.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.title===selected)-Number(a.title===selected));
 return <Page eyebrow="Cẩm nang nghề nghiệp" title="Chuẩn bị tốt hơn cho cơ hội mới" description="Gợi ý viết CV, chuẩn bị phỏng vấn và tìm kiếm công việc phù hợp.">
 <div className="ui-columns"><div><div className="ui-toolbar"><label className="ui-search"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Tìm bài viết" placeholder="Tìm bài viết bạn quan tâm..."/></label></div><div className="ui-tabs" style={{marginBottom:22}}>{['',...new Set(careerResources.map(a=>a.tag))].map(t=><button key={t} onClick={()=>setTag(t)} aria-pressed={tag===t}>{t||'Tất cả'}</button>)}</div><div className="ui-stack">{visible.map(a=><details className="ui-article" key={a.title} open={selected===a.title||(!selected&&a.index===0)}><summary className="ui-article-summary"><Image unoptimized src={a.image} width={210} height={130} alt=""/><div><span className="ui-badge">{a.tag}</span><h2>{a.title}</h2><p className="ui-small ui-muted">{a.description}</p><span className="ui-link">Đọc gợi ý <Icon name="down"/></span></div></summary><div className="ui-article-content"><h3>Những điểm nên chuẩn bị</h3><ul className="ui-bullets">{advice[a.index].map(t=><li key={t}>{t}</li>)}</ul></div></details>)}{!visible.length&&<Empty title="Chưa tìm thấy bài viết" text="Thử từ khóa khác hoặc chọn một chủ đề khác." action={<button className="ui-btn" onClick={()=>{setTag('');setSearch('');}}>Xem tất cả bài viết</button>}/>}</div></div>
 <aside className="ui-stack ui-sticky"><Panel title="Sẵn sàng ứng tuyển?"><p className="ui-text">Cập nhật hồ sơ và khám phá các cơ hội phù hợp với kỹ năng của bạn.</p><div className="ui-stack" style={{marginTop:20}}><button className="ui-btn ui-btn-primary" onClick={()=>onNavigate('cv-upload')}>Cập nhật CV</button><button className="ui-btn" onClick={()=>onNavigate('job-search')}>Tìm việc làm</button></div></Panel></aside></div></Page>;
}
