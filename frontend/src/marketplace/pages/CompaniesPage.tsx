import {useEffect,useState,type FormEvent} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import PublicCompanyCard from '../components/PublicCompanyCard';
import {listPublicCompanies,type PublicCompanyPage} from '../public-company-client';
import {Page,Empty,Notice} from '../ui';
import Icon from '../components/Icon';
import './companies.css';
const styles={"directory":"company-directory-directory","filterPanel":"company-directory-filterPanel","filterHeading":"company-directory-filterHeading","headingIcon":"company-directory-headingIcon","label":"company-directory-label","searchRow":"company-directory-searchRow","searchInput":"company-directory-searchInput","input":"company-directory-input","submit":"company-directory-submit","reset":"company-directory-reset","chip":"company-directory-chip","refinements":"company-directory-refinements","applied":"company-directory-applied","resultsHeading":"company-directory-resultsHeading","count":"company-directory-count","approval":"company-directory-approval","grid":"company-directory-grid","pagination":"company-directory-pagination","back":"company-directory-back","loading":"company-directory-loading","feedback":"company-directory-feedback"};
const fields=[{name:'q',label:'Tìm công ty'},{name:'industry',label:'Lĩnh vực'},{name:'location',label:'Khu vực'}];
export default function CompaniesPage(){
 const params=useSearchParams();return <Directory key={params.toString()} search={params.toString()}/>;
}
function Directory({search}:{search:string}){
 const router=useRouter();const params=new URLSearchParams(search);
 const raw=Number(params.get('page')??1);const page=Number.isSafeInteger(raw)&&raw>0&&raw<=1000000?raw:1;
 const [result,setResult]=useState<PublicCompanyPage>();const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const active=fields.filter(field=>params.get(field.name)?.trim());
 useEffect(()=>{let active=true;const current=new URLSearchParams(search);const query=new URLSearchParams({limit:'12',offset:String((page-1)*12)});for(const {name} of fields){const value=current.get(name)?.trim();if(value)query.set(name,value);}listPublicCompanies(query.toString()).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Không thể tải danh sách công ty.');});return()=>{active=false;};},[search,page,version]);
 function navigate(query:URLSearchParams){router.push('/companies'+(query.size?'?'+query.toString():''));}
 function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();const query=new URLSearchParams();for(const [key,value] of new FormData(event.currentTarget))if(String(value).trim())query.set(key,String(value).trim());navigate(query);}
 function remove(name:string){const query=new URLSearchParams(search);query.delete(name);query.delete('page');navigate(query);}
 function go(nextPage:number){const query=new URLSearchParams(search);query.set('page',String(nextPage));navigate(query);}
 return <div className={styles.directory}><Page eyebrow="Khám phá doanh nghiệp" title="Nhà tuyển dụng" description="Tìm hiểu doanh nghiệp đã được phê duyệt và các vị trí đang tuyển.">
  <section className={styles.filterPanel} aria-labelledby="company-filter-heading">
   <div className={styles.filterHeading}><span className={styles.headingIcon}><Icon name="building"/></span><div><h2 id="company-filter-heading">Tìm doanh nghiệp bạn quan tâm</h2><p>Khám phá môi trường làm việc và cơ hội tiếp theo của bạn.</p></div></div>
   <form onSubmit={filter} aria-label="Bộ lọc nhà tuyển dụng">
    <label className={styles.label} htmlFor="company-query">Tìm công ty</label>
    <div className={styles.searchRow}><div className={styles.searchInput}><Icon name="search"/><input id="company-query" name="q" aria-label="Tìm công ty" maxLength={200} defaultValue={params.get('q')??''} placeholder="Tên công ty, lĩnh vực hoặc địa chỉ"/></div><button className={styles.submit} type="submit"><Icon name="search"/>Tìm kiếm</button></div>
    <div className={styles.refinements}>
     <div><label className={styles.label} htmlFor="company-industry">Lĩnh vực</label><div className={styles.input}><Icon name="briefcase"/><input id="company-industry" name="industry" maxLength={200} defaultValue={params.get('industry')??''} placeholder="Ví dụ: phần mềm, giáo dục…"/></div></div>
     <div><label className={styles.label} htmlFor="company-location">Địa chỉ/khu vực</label><div className={styles.input}><Icon name="pin"/><input id="company-location" name="location" maxLength={255} defaultValue={params.get('location')??''} placeholder="Ví dụ: Hà Nội, Đà Nẵng…"/></div></div>
     <button type="button" className={styles.reset} onClick={event=>{event.currentTarget.form?.reset();router.push('/companies');}}><Icon name="close"/>Xóa bộ lọc</button>
    </div>
   </form>
   {!!active.length&&<div className={styles.applied} aria-label="Bộ lọc đang áp dụng"><span>Đang lọc:</span>{active.map(field=><button key={field.name} className={styles.chip} type="button" onClick={()=>remove(field.name)} aria-label={'Bỏ lọc '+field.label}><span>{field.label}: <strong>{params.get(field.name)}</strong></span><Icon name="close"/></button>)}</div>}
  </section>
  <div className={styles.resultsHeading}><div><h2>Danh sách nhà tuyển dụng{result&&!error&&<span className={styles.count}>{result.total}</span>}</h2><p>{result&&!error?(result.items.length?`Hiển thị ${(page-1)*12+1}–${(page-1)*12+result.items.length} trong ${result.total} doanh nghiệp`:'Chưa có kết quả cho lựa chọn hiện tại'):'Tìm doanh nghiệp phù hợp với định hướng của bạn'}</p></div><span className={styles.approval}><Icon name="shield"/>Doanh nghiệp đã được duyệt</span></div>
  <div aria-live="polite" aria-busy={!result&&!error}>
   {error?<div className={styles.feedback}><Notice error>{error}</Notice><button className="ui-btn" onClick={()=>{setError('');setResult(undefined);setVersion(value=>value+1);}}>Thử lại</button></div>:!result?<p className={styles.loading} role="status">Đang tải doanh nghiệp…</p>:<>
    {result.items.length?<div className={'cl-directory-grid '+styles.grid}>{result.items.map(company=><PublicCompanyCard key={company.company_id} company={company} returnTo={'/companies'+(search?'?'+search:'')}/>)}</div>:<div className={styles.feedback}><Empty title="Chưa tìm thấy công ty phù hợp" text="Thử từ khóa khác hoặc bỏ bớt điều kiện lọc để xem thêm doanh nghiệp." action={active.length?<button className="ui-btn" onClick={()=>router.push('/companies')}>Xóa bộ lọc</button>:undefined}/></div>}
    {result.total>0&&<nav className={styles.pagination} aria-label="Phân trang nhà tuyển dụng"><button className="ui-btn" disabled={page===1} onClick={()=>go(page-1)}><span className={styles.back}><Icon name="right"/></span>Trang trước</button><span>Trang <strong>{page}</strong> / {Math.max(1,Math.ceil(result.total/12))}</span><button className="ui-btn" disabled={page*12>=result.total} onClick={()=>go(page+1)}>Trang sau<Icon name="right"/></button></nav>}
   </>}
  </div>
 </Page></div>;
}
