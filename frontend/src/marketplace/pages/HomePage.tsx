import { useState } from 'react';
import Image from 'next/image';
import { useEffect } from 'react';
import PublicCompanyCard from '../components/PublicCompanyCard';
import { listPublicCompanies, type PublicCompanyPage } from '../public-company-client';
import { reference, careerResources } from '../editorial-data';
import { useJobCatalog } from '../job-catalog';
import JobCard from '../components/JobCard';
import IndustryGrid from '../components/IndustryGrid';
import HomeHero from '../components/PublicHomeHero';
import { SectionHeading, CarouselControls } from '../components/ReferenceSections';

interface HomePageProps { onNavigate: (page: string, data?: unknown) => void }
export default function HomePage({onNavigate}:HomePageProps) {
  const {available:jobs,loading,error}=useJobCatalog();
  const [jobPage,setJobPage]=useState(0);
  const [companyPage,setCompanyPage]=useState(0);
  const [companyResult,setCompanyResult]=useState<PublicCompanyPage>();
  const [companyError,setCompanyError]=useState('');
  useEffect(()=>{let active=true;listPublicCompanies(`limit=4&offset=${companyPage*4}`).then(value=>{if(active)setCompanyResult(value);}).catch(()=>{if(active)setCompanyError('Chưa tải được danh sách doanh nghiệp.');});return()=>{active=false;};},[companyPage]);
  const [articlePage,setArticlePage]=useState(0);
  return <div className="cl-home">
    <h1 className="sr-only">Tuyển dụng, tìm kiếm việc làm trực tuyến</h1>
    <HomeHero onNavigate={onNavigate} />
    <section className="cl-section cl-container cl-hot-section">
      <SectionHeading title="Việc làm hấp dẫn" onView={()=>onNavigate('job-search')} />
      {loading&&<p className="ui-muted" role="status">Đang tải việc làm từ hệ thống…</p>}
      {error&&<p className="ui-notice ui-notice-error" role="alert">{error}</p>}
      {!loading&&!error&&!jobs.length&&<p className="ui-muted">Chưa có việc làm đang công khai.</p>}
      <div className="cl-hot-grid">{jobs.slice(jobPage*15,jobPage*15+15).map(job=><JobCard key={job.id} job={job} compact featured showMatch={false} onView={()=>onNavigate('job-detail',job)} />)}</div>
      {jobs.length>15&&<CarouselControls page={jobPage} count={Math.ceil(jobs.length/15)} onChange={setJobPage} label="Trang việc làm" />}
    </section>
    <section className="cl-section cl-container cl-category-section">
      <SectionHeading title="Việc làm theo ngành nghề" onView={()=>onNavigate('job-search')} />
      <IndustryGrid onNavigate={onNavigate} />
    </section>
    <section className="cl-section cl-container">
      <SectionHeading title="Nhà tuyển dụng" onView={()=>onNavigate('companies')} />
      {companyError?<p role="alert">{companyError}</p>:!companyResult?<p role="status">Đang tải doanh nghiệp…</p>:!companyResult.items.length?<p>Chưa có doanh nghiệp đang công khai.</p>:<div className="cl-company-carousel">{companyResult.items.map(company=><PublicCompanyCard key={company.company_id} company={company}/>)}</div>}
      {companyResult&&companyResult.total>4&&<CarouselControls page={companyPage} count={Math.ceil(companyResult.total/4)} onChange={value=>{setCompanyPage(value);setCompanyResult(undefined);setCompanyError('');}} label="Trang nhà tuyển dụng" />}
    </section>
    <section className="cl-container cl-discovery"><button onClick={()=>onNavigate('cv-upload')} aria-label="Khám phá mẫu CV"><Image unoptimized src={reference.discovery} alt="Sự nghiệp thành công bắt đầu từ một CV tốt. Khám phá ngay." width={1300} height={200} /></button></section>
    <section className="cl-section cl-container">
      <SectionHeading title="Cẩm nang tìm việc" onView={()=>onNavigate('career')} />
      <div className="cl-article-carousel">{careerResources.slice(articlePage*5,articlePage*5+5).map(article=><button key={article.title} className="cl-article" onClick={()=>onNavigate('career',{article:article.title})}><Image unoptimized src={article.image} alt="" width={260} height={146} /><div><span>{article.tag}</span><h3>{article.title}</h3><p>{article.description}</p></div></button>)}</div>
      <CarouselControls page={articlePage} count={2} onChange={setArticlePage} label="Trang cẩm nang" />
    </section>
  </div>;
}

