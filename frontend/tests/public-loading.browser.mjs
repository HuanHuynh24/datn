// Concurrency/freshness/auth contract checks, controlled HTTP only; no database writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
let mode='hold',releases=[],catalogCalls=0,jobCalls=0,companyCalls=0,optionCalls=0,revision=1,jobError=0,role='CANDIDATE';
const checks=[];const publicHeaders=[];
const catalog={industries:[{id:'91',name:'Công nghệ'}],provinces:[{id:'92',name:'Hà Nội'}],skills:[],wards:[]};
const job=()=>({id:'31',title:'Public revision '+revision,company_id:'45',company_name:'Public Company',industry_id:'91',industry_name:'Công nghệ',province_id:'92',province_name:'Hà Nội',description:null,requirements:null,ward_id:null,street:null,level:null,minimum_salary:null,maximum_salary:null,years_experience:null,work_type:null,application_deadline:null,status:'APPROVED',created_at:'2026-11-14T00:00:00Z',skills:[]});
await withBrowser(async(url,request)=>{
  const p=url.pathname;
  if(p==='/api/v1/auth/login')return {body:{access_token:'public-test-memory-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'46',role,company_id:null,internal_role:null}};
  if(p==='/api/v1/admin/dashboard'){
    assert(Object.entries(request.headers).some(([key,value])=>key.toLowerCase()==='authorization'&&value==='Bearer public-test-memory-only'));
    return {body:{accounts:1,candidates:0,companies:0,jobs:0,applications:0,cvs:0,industries:0,skills:0,packages:0,accounts_by_status:{ACTIVE:1},companies_by_status:{},jobs_by_status:{},applications_by_status:{},generated_at:'2026-11-14T00:00:00Z'}};
  }
  if(p==='/api/v1/candidates/me/profile'){
    assert(Object.entries(request.headers).some(([key,value])=>key.toLowerCase()==='authorization'&&value==='Bearer public-test-memory-only'));
    return {body:{account_id:'46',candidate_id:'47',full_name:'Public Test',email:'consumer@example.com',education:[],experience:[],updated_at:'2026-11-14T00:00:00Z'}};
  }
  assert.equal(request.method,'GET');
  publicHeaders.push(Object.keys(request.headers).some(key=>key.toLowerCase()==='authorization'));
  if(p==='/api/v1/job-catalog'){
    catalogCalls++;if(mode==='hold')await new Promise(resolve=>releases.push(resolve));
    return mode==='error'?{status:503,body:{detail:'Unavailable'}}:{body:catalog};
  }
  if(p==='/api/v1/jobs'){
    jobCalls++;await new Promise(resolve=>setTimeout(resolve,80));
    return jobError?{status:jobError,body:{detail:'Unavailable'}}:{body:{items:[job()],total:31,limit:15,offset:Number(url.searchParams.get('offset')??0)}};
  }
  if(p==='/api/v1/companies/filters'){optionCalls++;await new Promise(resolve=>setTimeout(resolve,80));return {body:{industries:['Công nghệ'],locations:['Hà Nội']}};}
  if(p==='/api/v1/companies'){companyCalls++;await new Promise(resolve=>setTimeout(resolve,80));return {body:{items:[{company_id:'45',company_name:'Company revision '+revision,industry:'Công nghệ',address:'Hà Nội',logo_url:null,open_job_count:1}],total:13,limit:12,offset:Number(url.searchParams.get('offset')??0)}};}
  throw new Error('Unexpected API '+p);
},async({send,evaluate,until,fill,click})=>{
  async function navigate(path){await send('Page.navigate',{url:'http://localhost:3000'+path});}
  async function client(path){await evaluate(`history.pushState(null,'',${JSON.stringify(path)})`);await until(`location.pathname+location.search===${JSON.stringify(path)}`);}
  async function ready(){await until('!!document.querySelector("[data-job-id]")');}
  function release(){mode='ready';releases.forEach(resolve=>resolve());releases=[];}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('/jobs');await ready();assert.equal(catalogCalls,1);assert.equal(jobCalls,1);assert(releases.length===1);
  checks.push('Jobs render before delayed catalog; StrictMode shares one request per public URL');
  await evaluate('document.querySelector(".cl-filter-trigger").click()');await until('!!document.querySelector(".search-filter-options [role=status]")');
  assert(await evaluate('document.querySelector(".search-filter-actions button[type=submit]").disabled'));
  release();await until('!!document.querySelector("input[name=industry_id][value=\\"91\\"]")');
  checks.push('Catalog loading is visible and Apply is blocked until options arrive');
  await client('/jobs?page=2');await until('document.querySelector(".cl-results-pagination [aria-current=page]")?.textContent==="2"&&!!document.querySelector("[data-job-id]")');
  assert.equal(catalogCalls,1);assert.equal(jobCalls,2);
  checks.push('Pagination fetches only results and reuses mounted catalog');
  revision=2;await client('/jobs');await until('document.body.innerText.includes("Public revision 2")');assert.equal(jobCalls,3);
  checks.push('Returning to completed URL fetches fresh results, never a settled cache');
  mode='hold';catalogCalls=0;jobCalls=0;await navigate('/jobs?province_id=92');await until('!!document.querySelector(".cl-filter-trigger")');
  for(let i=0;i<100&&(jobCalls===0||catalogCalls===0);i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(catalogCalls,1);assert.equal(jobCalls,1);assert(!await evaluate('!!document.querySelector("[data-job-id]")'));
  release();await ready();checks.push('Canonical ID results fetch in parallel but wait for catalog validation before display');
  mode='hold';catalogCalls=0;jobCalls=0;await navigate('/jobs?location=H%C3%A0+N%E1%BB%99i');
  for(let i=0;i<100&&catalogCalls===0;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(jobCalls,0);release();await ready();assert.equal(jobCalls,1);
  checks.push('Legacy location waits for catalog resolution instead of silently dropping the filter');
  mode='error';catalogCalls=0;await navigate('/jobs');await ready();await evaluate('document.querySelector(".cl-filter-trigger").click()');
  await until('!!document.querySelector(".search-filter-options [role=alert]")');const before=jobCalls;
  mode='ready';await click('Thử tải lại danh mục');await until('!!document.querySelector("input[name=industry_id][value=\\"91\\"]")');assert.equal(jobCalls,before);assert.equal(catalogCalls,2);
  checks.push('Catalog errors do not hide unfiltered jobs; retry is fresh without refetching results');
  jobError=503;await client('/jobs?q=retry');await until('!!document.querySelector(".cl-results-empty[role=alert]")');
  jobError=0;await client('/jobs');await ready();await client('/jobs?q=retry');await ready();
  checks.push('Failed result request is released; returning to its URL can retry successfully');
  await navigate('/companies');await until('!!document.querySelector("[data-company-id]")');assert.equal(companyCalls,1);assert.equal(optionCalls,1);
  await click('Trang sau');await until('location.search.includes("page=2")&&!!document.querySelector("[data-company-id]")');assert.equal(companyCalls,2);assert.equal(optionCalls,1);
  checks.push('Company list/options share concurrent calls; pagination does not refetch options');
  revision=3;await client('/companies');await until('document.body.innerText.includes("Company revision 3")');assert.equal(companyCalls,3);
  checks.push('Company navigation reads fresh completed data after changes');
  await navigate('/sign-in?next=%2Fjobs');await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','consumer@example.com');await fill('#auth-password','Public-consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');await ready();
  assert(publicHeaders.length>0&&publicHeaders.every(value=>value===false));
  assert(await evaluate('document.querySelector(".site-header").dataset.mode==="candidate"'));
  checks.push('Public requests omit Bearer even while logged in; private profile retains Bearer');
  jobError=401;await client('/jobs?q=public401');await until('!!document.querySelector(".cl-results-empty[role=alert]")');
  assert(await evaluate('document.querySelector(".site-header").dataset.mode==="candidate"'));
  checks.push('Public HTTP401 cannot log out the authenticated session');
  role='ADMIN';await navigate('/admin/sign-in');await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','admin-consumer@example.com');await fill('#auth-password','Public-consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
  await until('location.pathname==="/admin"&&!!document.querySelector(".admin-stats")');
  assert.equal(await evaluate('document.querySelector(".admin-stats strong").textContent'),'1');
  checks.push('Lazy Admin bundle renders authenticated dashboard; private request still carries Bearer');
},{debugPort:9235});
console.log(JSON.stringify({status:'PASS',kind:'Controlled concurrency/freshness/auth consumers, no database writes',checks},null,2));
