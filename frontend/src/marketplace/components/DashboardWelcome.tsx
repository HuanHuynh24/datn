import Link from 'next/link';
import Icon from './Icon';

export default function DashboardWelcome({audience,title,description,href,action,secondaryHref,secondaryAction}:{audience:'candidate'|'recruiter';title:string;description:string;href:string;action:string;secondaryHref:string;secondaryAction:string}) {
  return <section className="actor-welcome cl-container"><div className="actor-welcome-panel"><div className="actor-welcome-copy"><p className="actor-welcome-eyebrow"><span/>{audience==='candidate'?'KHỞI ĐẦU CHO BƯỚC TIẾN MỚI':'KẾT NỐI ĐỘI NGŨ, PHÁT TRIỂN DOANH NGHIỆP'}</p><h1>{title}</h1><p>{description}</p><div className="actor-welcome-actions"><Link className="ui-btn ui-btn-primary" href={href}><Icon name={audience==='candidate'?'search':'briefcase'}/>{action}</Link><Link className="actor-text-link" href={secondaryHref}>{secondaryAction}<Icon name="arrow"/></Link></div></div><div className="actor-welcome-art" aria-hidden="true"><span className="actor-art-main"><Icon name={audience==='candidate'?'document':'users'}/></span><span className="actor-art-check"><Icon name="check"/></span><div className="actor-art-lines"><i/><i/><i/></div></div></div></section>;
}
