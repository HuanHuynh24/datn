'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPublicCompany, getPublicCompanyJobs, safePublicUrl, type PublicCompany } from '../public-company-client';
import type { JobPage } from '../jobs-client';
import { liveJobToPresentation } from '../job-catalog';
import JobCard from '../components/JobCard';
import ReturnLink from '../components/ReturnLink';
import { Page, Panel, Notice, Empty } from '../ui';
export default function PublicCompanyDetail({id}:{id:string}){
 const params=useSearchParams();return <Detail key={id+':'+params.toString()} id={id} search={params.toString()}/>;
}
function Detail({id,search}:{id:string;search:string}){
 const router=useRouter();const params=new URLSearchParams(search);const raw=Number(params.get('page')??1);const page=Number.isSafeInteger(raw)&&raw>0&&raw<=1000000?raw:1;
 const [company,setCompany]=useState<PublicCompany>();const [jobs,setJobs]=useState<JobPage>();const [error,setError]=useState('');
 useEffect(()=>{let active=true;Promise.all([getPublicCompany(id),getPublicCompanyJobs(id,(page-1)*10)]).then(([profile,result])=>{if(active){setCompany(profile);setJobs(result);}}).catch(()=>{if(active)setError('Không tìm thấy doanh nghiệp đang công khai hoặc dịch vụ tạm thời không khả dụng.');});return()=>{active=false;};},[id,page]);
 function go(value:number){const query=new URLSearchParams(search);query.set('page',String(value));router.push('/companies/'+id+'?'+query);}
 const website=safePublicUrl(company?.website??null);
 return <Page title={company?.company_name??'Thông tin doanh nghiệp'} description={company?.industry??undefined}>
  <ReturnLink fallback="/companies">Quay lại danh sách công ty</ReturnLink>
  {error?<Notice error>{error}</Notice>:!company||!jobs?<p role="status">Đang tải doanh nghiệp…</p>:<>
   <div className="ui-columns"><Panel title="Giới thiệu doanh nghiệp"><p className="ui-preline">{company.introduction||'Doanh nghiệp chưa cập nhật giới thiệu.'}</p></Panel><Panel title="Thông tin chung"><p>Quy mô: {company.size||'Chưa cập nhật'}</p><p>Địa chỉ: {company.address||'Chưa cập nhật'}</p>{website&&<a className="ui-link" href={website} target="_blank" rel="noreferrer noopener">Website doanh nghiệp</a>}</Panel></div>
   <Panel title={`Việc làm đang mở (${jobs.total})`}>{jobs.items.length?<div className="cl-hot-grid cl-results-grid">{jobs.items.map(job=><JobCard key={job.id} job={liveJobToPresentation(job)} compact showMatch={false} showSave={false} onView={()=>router.push('/jobs/'+job.id+'?'+new URLSearchParams({returnTo:window.location.pathname+window.location.search}))}/>)}</div>:<Empty title="Chưa có việc làm đang mở" text="Doanh nghiệp hiện chưa có tin tuyển dụng công khai còn hiệu lực."/>}<div className="ui-actions"><button className="ui-btn" disabled={page===1} onClick={()=>go(page-1)}>Trang trước</button><span>Trang {page}</span><button className="ui-btn" disabled={page*10>=jobs.total} onClick={()=>go(page+1)}>Trang sau</button></div></Panel>
   <Link className="ui-btn" href="/jobs">Khám phá việc làm khác</Link>
  </>}
 </Page>;
}
