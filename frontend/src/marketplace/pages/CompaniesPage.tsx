import {useEffect,useState,type FormEvent} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import PublicCompanyCard from '../components/PublicCompanyCard';
import {listPublicCompanies,type PublicCompanyPage} from '../public-company-client';
import {Page,Empty,Field,Notice} from '../ui';
import Icon from '../components/Icon';
export default function CompaniesPage(){
 const params=useSearchParams();return <Directory key={params.toString()} search={params.toString()}/>;
}
function Directory({search}:{search:string}){
 const router=useRouter();const params=new URLSearchParams(search);
 const raw=Number(params.get('page')??1);const page=Number.isSafeInteger(raw)&&raw>0&&raw<=1000000?raw:1;
 const [result,setResult]=useState<PublicCompanyPage>();const [error,setError]=useState('');
 useEffect(()=>{let active=true;const current=new URLSearchParams(search);const query=new URLSearchParams({limit:'12',offset:String((page-1)*12)});for(const key of ['q','industry','location']){const value=current.get(key)?.trim();if(value)query.set(key,value);}listPublicCompanies(query.toString()).then(value=>{if(active)setResult(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Không thể tải danh sách công ty.');});return()=>{active=false;};},[search,page]);
 function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();const query=new URLSearchParams();for(const [key,value] of new FormData(event.currentTarget))if(String(value).trim())query.set(key,String(value).trim());router.push('/companies'+(query.size?'?'+query.toString():''));}
 function go(nextPage:number){const query=new URLSearchParams(search);query.set('page',String(nextPage));router.push('/companies?'+query);}
 return <Page eyebrow="Khám phá doanh nghiệp" title="Nhà tuyển dụng" description="Tìm hiểu doanh nghiệp đã được phê duyệt và các vị trí đang tuyển.">
  <form className="ui-toolbar ui-panel" onSubmit={filter}><Field id="company-query" label="Tìm công ty"><input id="company-query" name="q" aria-label="Tìm công ty" maxLength={200} defaultValue={params.get('q')??''} placeholder="Tên công ty, lĩnh vực hoặc địa chỉ"/></Field><Field id="company-industry" label="Lĩnh vực"><input id="company-industry" name="industry" maxLength={200} defaultValue={params.get('industry')??''}/></Field><Field id="company-location" label="Địa chỉ/khu vực"><input id="company-location" name="location" maxLength={255} defaultValue={params.get('location')??''}/></Field><button className="ui-btn"><Icon name="search"/>Tìm kiếm</button><button type="button" className="ui-btn" onClick={()=>router.push('/companies')}>Xóa bộ lọc</button></form>
  {error?<Notice error>{error}</Notice>:!result?<p role="status">Đang tải doanh nghiệp…</p>:<><p aria-live="polite">{result.total} nhà tuyển dụng</p>{result.items.length?<div className="cl-directory-grid">{result.items.map(company=><PublicCompanyCard key={company.company_id} company={company} returnTo={'/companies'+(search?'?'+search:'')}/>)}</div>:<Empty title="Chưa tìm thấy công ty phù hợp" text="Thử thay đổi bộ lọc hoặc quay lại sau."/>}<div className="ui-actions"><button className="ui-btn" disabled={page===1} onClick={()=>go(page-1)}>Trang trước</button><span>Trang {page}</span><button className="ui-btn" disabled={page*12>=result.total} onClick={()=>go(page+1)}>Trang sau</button></div></>}
 </Page>;
}
