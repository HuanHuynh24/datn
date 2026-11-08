import type { ReactNode } from 'react';
import Icon, { type IconName } from './components/Icon';
import WorkspaceHero, { type WorkspaceVisual } from './components/WorkspaceHero';
export type Navigate = (page: string, data?: unknown) => void;
export const labels: Record<string,string> = {'Full-time':'Toàn thời gian','Part-time':'Bán thời gian',Contract:'Hợp đồng',Internship:'Thực tập',Remote:'Làm từ xa','On-site':'Tại văn phòng',Hybrid:'Kết hợp',Junior:'Mới đi làm','Mid-level':'Nhân viên',Senior:'Chuyên viên',Lead:'Trưởng nhóm',Applied:'Đã ứng tuyển','Under Review':'Đang xem xét',Interview:'Phỏng vấn',Offer:'Đề nghị nhận việc',Rejected:'Chưa phù hợp',New:'Mới nhận',Review:'Đang xem xét',Hired:'Đã tuyển',Active:'Đang tuyển',Paused:'Tạm dừng',Closed:'Đã đóng',Engineering:'CNTT - Phần mềm',Design:'Thiết kế',Marketing:'Marketing',Data:'Dữ liệu',Finance:'Tài chính',Operations:'Vận hành',Education:'Giáo dục'};
export const label = (value:string) => labels[value] ?? value;
export const formatDate = (value:string) => new Date(value).toLocaleDateString('vi-VN');
export function Page({title,description,eyebrow,actions,children,visual,featured=false}:{title:string;description?:string;eyebrow?:string;actions?:ReactNode;children:ReactNode;visual?:WorkspaceVisual;featured?:boolean}) {
  return <div className={`ui-page ${visual?'ui-workspace-page':''} ${featured?'ui-workspace-dashboard':''}`}>
    {visual&&<WorkspaceHero title={title} description={description} eyebrow={eyebrow} actions={actions} visual={visual} featured={featured}/>}
    <div className="ui-container">
      {!visual&&<div className="ui-page-heading"><div>{eyebrow&&<p className="ui-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="ui-description">{description}</p>}</div>{actions&&<div className="ui-actions">{actions}</div>}</div>}
      {children}
    </div>
  </div>;
}
export function Panel({title,action,children,className=''}:{title?:string;action?:ReactNode;children:ReactNode;className?:string}) { return <section className={`ui-panel ${className}`}>{title&&<div className="ui-panel-heading"><h2>{title}</h2>{action}</div>}{children}</section>; }
export function Empty({title,text,action,icon='search'}:{title:string;text:string;action?:ReactNode;icon?:IconName}) { return <div className="ui-empty"><span><Icon name={icon}/></span><h2>{title}</h2><p>{text}</p>{action}</div>; }
export function Badge({value}:{value:string}) { return <span className={`ui-badge ${['Hired','Active','Offer'].includes(value)?'ui-badge-green':['Review','Under Review','Paused'].includes(value)?'ui-badge-orange':['Rejected','Closed','Draft'].includes(value)?'ui-badge-grey':''}`}>{value==='Draft'?'Bản nháp':label(value)}</span>; }
export function Field({label:text,id,hint,children}:{label:string;id:string;hint?:string;children:ReactNode}) { return <div className="ui-field"><label htmlFor={id}>{text}</label>{children}{hint&&<small>{hint}</small>}</div>; }
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}) { return <p className={`ui-notice ${error?'ui-notice-error':''}`} role={error?'alert':'status'}><Icon name={error?'bell':'check'}/><span>{children}</span></p>; }
export function Stat({title,value,icon,onClick}:{title:string;value:number|string;icon:IconName;onClick:()=>void}) { return <button className="ui-stat" onClick={onClick}><span className="ui-stat-icon"><Icon name={icon}/></span><span><strong>{value}</strong><small>{title}</small></span><Icon name="right"/></button>; }
