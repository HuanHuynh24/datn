import Brand from './Brand';
const groups=[
  {title:'Về Talentiq',links:[{label:'Giới thiệu',page:'home'},{label:'Công ty',page:'companies'},{label:'Cẩm nang việc làm',page:'career'},{label:'Đăng ký tài khoản',page:'signup-candidate'}]},
  {title:'Dành cho ứng viên',links:[{label:'Tìm việc làm',page:'job-search'},{label:'Công ty',page:'companies'},{label:'Cẩm Nang Việc Làm',page:'career'},{label:'Quản lý CV',page:'cv-upload'}]},
];
export default function Footer({onNavigate}:{onNavigate:(page:string,data?:unknown)=>void}) {
  return <footer className="cl-footer">
    <div className="cl-footer-main"><div className="cl-footer-columns">
      {groups.map(group=><div key={group.title}><h3>{group.title}</h3>{group.links.map((link,index)=><button key={index} onClick={()=>onNavigate(link.page)}>{link.label}</button>)}{group.title==='Dành cho ứng viên'&&<div className="cl-footer-subgroup"><h3>Dành cho nhà tuyển dụng</h3><button onClick={()=>onNavigate('recruiter-home')}>Quản lý tuyển dụng</button><button onClick={()=>onNavigate('recruiter-create-job')}>Đăng tin tuyển dụng</button><button onClick={()=>onNavigate('recruiter-search')}>Tìm kiếm ứng viên</button></div>}</div>)}
      <div><h3>Việc làm theo khu vực</h3>{['Hồ Chí Minh','Hà Nội','Đà Nẵng','Hải Phòng','Cần Thơ'].map(location=><button key={location} onClick={()=>onNavigate('job-search',{location})}>{location}</button>)}<div className="cl-footer-subgroup"><h3>Việc làm theo ngành nghề</h3>{[{label:'Kế toán',category:'Finance'},{label:'Kinh doanh',category:'Sales'},{label:'IT - Phần mềm',category:'Engineering'},{label:'Thiết kế',category:'Design'}].map(item=><button key={item.category} onClick={()=>onNavigate('job-search',{category:item.category})}>{item.label}</button>)}</div></div>
      <div><h3>Hồ sơ của bạn</h3><button onClick={()=>onNavigate('candidate-home')}>Trang ứng viên</button><button onClick={()=>onNavigate('candidate-profile')}>Quản lý hồ sơ</button><button onClick={()=>onNavigate('candidate-saved')}>Việc làm đã lưu</button><button onClick={()=>onNavigate('candidate-applications')}>Việc làm đã ứng tuyển</button><div className="cl-footer-subgroup"><h3>Tài khoản</h3><button onClick={()=>onNavigate('signin')}>Đăng nhập</button><button onClick={()=>onNavigate('signup-candidate')}>Đăng ký ứng viên</button><button onClick={()=>onNavigate('signup-recruiter')}>Đăng ký nhà tuyển dụng</button></div></div>
    </div></div>
    <div className="cl-footer-bottom"><button onClick={()=>onNavigate('home')} aria-label="Talentiq - Trang chủ"><Brand /></button><p>Tuyển dụng, tìm kiếm việc làm trực tuyến tại Talentiq</p><p>© 2026 Talentiq</p></div>
  </footer>;
}


