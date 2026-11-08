import ProfilePhoto from './ProfilePhoto';
import type {Candidate} from '../data';
import {Badge} from '../ui';
import {useDemo} from '../demo-store';
import {MatchBadge} from './MatchBadge';
export default function CandidateCard({candidate,onView}:{candidate:Candidate;onView:(c:Candidate)=>void}){
 const {candidateStatuses}=useDemo();
 return <article className="ui-candidate"><div className="ui-row"><ProfilePhoto id={candidate.id} initials={candidate.avatar}/><div className="ui-grow"><h3><button onClick={()=>onView(candidate)}>{candidate.name}</button></h3><p className="ui-small ui-muted">{candidate.role}</p></div><MatchBadge score={candidate.match} size="sm"/></div><div className="ui-candidate-meta"><span>{candidate.location}</span><span>{candidate.experience} năm kinh nghiệm</span></div><div className="ui-tags">{candidate.skills.slice(0,4).map(s=><span className="ui-tag" key={s}>{s}</span>)}{candidate.skills.length>4&&<span className="ui-tag">+{candidate.skills.length-4}</span>}</div><div className="ui-candidate-footer"><button className="ui-link" onClick={()=>onView(candidate)}>Xem hồ sơ →</button><Badge value={candidateStatuses[candidate.id]??candidate.status}/></div></article>;
}
