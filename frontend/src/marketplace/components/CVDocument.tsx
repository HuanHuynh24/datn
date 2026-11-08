import type { Profile } from '../demo-store';

export default function CVDocument({profile,template='classic'}:{profile:Profile;template?:'classic'|'modern'}) {
  return <article className={`ui-cv-document ui-cv-document-${template}`} aria-label="Bản xem trước CV từ hồ sơ">
    <header><span className="ui-cv-document-monogram">{profile.name.split(' ').slice(-2).map(v=>v[0]).join('')}</span><div><h3>{profile.name}</h3><p>{profile.title}</p><div className="ui-cv-document-contact">{[profile.email,profile.phone,profile.location].filter(Boolean).map(value=><span key={value}>{value}</span>)}</div></div></header>
    <div className="ui-cv-document-body"><div>
      {([['Giới thiệu',profile.about],['Kinh nghiệm làm việc',profile.experience],['Dự án',profile.projects],['Học vấn',profile.education]] as const).filter(([,value])=>value.trim()).map(([title,value])=><section key={title}><h4>{title}</h4><p>{value}</p></section>)}
    </div><aside><section><h4>Kỹ năng</h4><ul>{profile.skills.split(',').filter(v=>v.trim()).map((skill,index)=><li key={index}>{skill.trim()}</li>)}</ul></section>{profile.languages&&<section><h4>Ngoại ngữ</h4><p>{profile.languages}</p></section>}</aside></div>
  </article>;
}
