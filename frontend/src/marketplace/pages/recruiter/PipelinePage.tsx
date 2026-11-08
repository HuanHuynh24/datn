import {useListReturn} from '../../view-state';
import ProfilePhoto from '../../components/ProfilePhoto';
import {useState} from 'react';
import {candidates,pipelineCandidate,type PipelineStage} from '../../data';
import {useDemo,setCandidateStage} from '../../demo-store';
import {Page,Notice,label,type Navigate} from '../../ui';
import {MatchBadge} from '../../components/MatchBadge';
const stages:PipelineStage[]=['New','Review','Interview','Offer','Hired'];
export default function PipelinePage({onNavigate}:{onNavigate:Navigate}){
 const remember=useListReturn('recruiter-pipeline');
 const {candidateStatuses}=useDemo();const [dragging,setDragging]=useState<string|null>(null);const [over,setOver]=useState<string|null>(null);const [notice,setNotice]=useState('');
 const all=[...candidates,pipelineCandidate].map(c=>({...c,status:candidateStatuses[c.id]??c.status}));
 const move=(id:string,stage:PipelineStage)=>{setCandidateStage(id,stage);setNotice((all.find(c=>c.id===id)?.name??'Ứng viên')+' đã chuyển sang '+label(stage).toLowerCase()+'.');setDragging(null);setOver(null);};
 return <Page visual="recruiter" eyebrow="Không gian nhà tuyển dụng" title="Quy trình tuyển dụng" description="Theo dõi hồ sơ qua từng giai đoạn. Kéo thả thẻ hoặc chọn trạng thái ngay trên mỗi hồ sơ." actions={<button className="ui-btn" onClick={()=>onNavigate('recruiter-applicants')}>Danh sách ứng viên</button>}>
 {notice&&<Notice>{notice}</Notice>}<div className="ui-kanban" role="region" aria-label="Bảng quy trình tuyển dụng" tabIndex={0}><div className="ui-kanban-track">{stages.map(stage=><section className="ui-kanban-column" key={stage} data-stage={stage} data-over={over===stage} onDragOver={e=>{e.preventDefault();setOver(stage);}} onDragLeave={()=>setOver(null)} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain')||dragging;if(id&&all.some(c=>c.id===id))move(id,stage);}}><div className="ui-kanban-heading"><h2>{label(stage)}</h2><span className="ui-badge">{all.filter(c=>c.status===stage).length}</span></div>{all.filter(c=>c.status===stage).map(c=><article key={c.id} className="ui-kanban-card" draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',c.id);setDragging(c.id);}} onDragEnd={()=>{setDragging(null);setOver(null);}}><div className="ui-row"><ProfilePhoto id={c.id} initials={c.avatar}/><div className="ui-grow"><h2><button onClick={()=>onNavigate('recruiter-candidate',{...c,returnTo:remember()})}>{c.name}</button></h2><p className="ui-small ui-muted">{c.role}</p></div></div><div style={{marginTop:12}}><MatchBadge score={c.match} size="sm"/></div><label><span className="sr-only">Trạng thái của {c.name}</span><select className="ui-select" value={c.status} onChange={e=>move(c.id,e.target.value as PipelineStage)}>{stages.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label></article>)}{!all.some(c=>c.status===stage)&&<div className="ui-kanban-empty">Chưa có hồ sơ ở giai đoạn này.<br/>Kéo một hồ sơ vào đây để cập nhật.</div>}</section>)}</div></div></Page>;
}
