import { useDemo, toggleSavedJob } from '../demo-store';
import type { Job } from '../data';
import { useAuthSession } from '../auth-client';
import { MatchBadge } from './MatchBadge';
import CompanyMark from './CompanyMark';
import Icon from './Icon';
import type { ReactNode } from 'react';
import {useRouter} from 'next/navigation';
import {getPageUrl,signInFor} from '../routes';
import {Badge} from '../ui';
interface JobCardProps {
  job: Job;
  showMatch?: boolean;
  compact?: boolean;
  featured?: boolean;
  showSave?: boolean;
  status?: ReactNode;
  children?: ReactNode;
  headingLevel?: 2 | 3;
  onView: (job: Job) => void;
}
export default function JobCard({ job:original, showMatch = true, compact = false, featured = false, showSave = true, status, children, headingLevel = 3, onView }: JobCardProps) {
  const {savedJobs,jobTitles,jobStatuses}=useDemo();
  const candidateSession = useAuthSession()?.user.role === 'CANDIDATE';
  const job={...original,title:jobTitles[original.id]??original.title};
  const visibleStatus=status??(jobStatuses[job.id]&&jobStatuses[job.id]!=='Active'?<Badge value={jobStatuses[job.id]}/>:null);
  const router=useRouter();
  const saved = candidateSession && savedJobs.includes(job.id);
  const save = () => {if(!candidateSession){router.push(signInFor(getPageUrl('job-detail',{...job,returnTo:window.location.pathname+window.location.search}),'save'));return;}toggleSavedJob(job.id);};
  const salary = job.salaryLabel ?? `${job.salaryMin.toLocaleString('en-US')} – ${job.salaryMax.toLocaleString('en-US')} ${job.currency}`;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const compactBadge = compact && !featured && (visibleStatus || (showMatch && job.match !== undefined ? <MatchBadge score={job.match} size="sm" /> : null));
  return <article className={`cl-job ${compact ? 'cl-job-compact' : 'cl-job-list'} ${children ? 'cl-job-with-details' : ''} ${featured || compactBadge ? 'cl-job-labelled' : ''}`} data-job-id={job.id}>
    {featured && <span className="cl-hot"><Icon name="fire" fill="currentColor" />HOT JOB</span>}
    {compactBadge && <div className="cl-job-corner">{compactBadge}</div>}
    <CompanyMark company={job.company} className="cl-job-logo" />
    <div className="cl-job-content">
      <div className="cl-job-heading"><Heading className="cl-job-title"><button title={job.title} onClick={() => onView(job)}>{job.title}</button></Heading>{!compact && visibleStatus}</div>
      <p className="cl-job-company" title={job.company.name}>{job.company.name}</p>
      <div className="cl-job-meta"><span title={job.location}><Icon name="pin" />{job.location}</span><time>{job.postedLabel ?? (job.postedDays === 0 ? 'Hôm nay' : `${job.postedDays} ngày trước`)}</time></div>
      <div className="cl-job-bottom"><span className="cl-job-salary"><Icon name="coins" />{salary}</span>{!compact && <span className="cl-job-level">| &nbsp; {{Junior:'Mới đi làm','Mid-level':'Nhân viên',Senior:'Chuyên viên',Lead:'Trưởng nhóm'}[job.level]}</span>}</div>
      {!compact && showMatch && job.match !== undefined && <div className="cl-job-match"><MatchBadge score={job.match} size="sm" /></div>}
    </div>
    {showSave && <button onClick={save} aria-label={saved ? 'Bỏ lưu' : 'Lưu'} title={`${saved?'Bỏ lưu':'Lưu'} ${job.title}`} aria-pressed={saved} className="cl-save"><Icon name="heart" fill={saved ? 'currentColor' : 'none'} />{!compact && <span>{saved ? 'Đã lưu' : 'Lưu'}</span>}</button>}
    {children && <div className="cl-job-details">{children}</div>}
  </article>;
}

