// Controlled UI/contract fixtures. Only fake login POST is allowed; no database writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
let role='CANDIDATE',approval='APPROVED',memberRole='OWNER',failOverview=false;
const folder=new URL('../../.local-backups/actor-topcv-style/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const checks=[];
const job={id:'31',title:'Chuyên viên phát triển sản phẩm',company_id:'45',company_name:'Công ty kiểm thử giao diện',company_logo_url:null,industry_id:'91',industry_name:'Công nghệ',province_id:'92',province_name:'Hà Nội',street:null,ward_id:null,description:'Mô tả công việc dùng trong kiểm thử.',requirements:'Kỹ năng chuyên môn.',level:null,minimum_salary:'15000000',maximum_salary:'20000000',years_experience:null,work_type:'Full-time',application_deadline:null,status:'APPROVED',created_at:'2026-11-14T00:00:00Z',skills:[]};
const profile={account_id:'46',candidate_id:'42',full_name:'Nguyễn Minh Anh',email:'candidate@example.com',phone:'0900000000',address:'Hà Nội',introduction:'Ứng viên kiểm thử giao diện.',avatar_url:null,profile_public:false,education:[],experience:[],desired_position:'Chuyên viên sản phẩm',province_id:'92',minimum_salary:null,maximum_salary:null,desired_work_type:'Full-time',updated_at:'2026-11-14T00:00:00Z'};
const company=()=>({company_id:'45',company_name:job.company_name,tax_code:'CONSUMER-ONLY',industry:'Công nghệ',size:null,address:'Hà Nội',website:null,logo_url:null,introduction:'Doanh nghiệp kiểm thử giao diện.',profile_url:null,approval_status:approval,active_member_count:1,created_at:'2026-11-14T00:00:00Z',package_started_on:null,package_expires_on:null,package:{package_id:'99',code:'FREE',name:'Gói kiểm thử',member_limit:5,monthly_price:'0',description:null}});
const record=()=>({id:'41',candidate_id:'42',candidate_name:profile.full_name,candidate_email:profile.email,job_id:job.id,job_title:job.title,company_id:'45',company_name:job.company_name,cv_id:'43',cover_letter:'Thư giới thiệu kiểm thử.',status:role==='CANDIDATE'?'HIRED':'APPLIED',submitted_at:'2026-11-14T00:00:00Z',updated_at:'2026-11-14T00:00:00Z'});
await withBrowser(async(url,request)=>{
  const p=url.pathname;assert(request.method==='GET'||(request.method==='POST'&&p==='/api/v1/auth/login'),'Unexpected write '+p);
  if(p==='/api/v1/auth/login')return {body:{access_token:'actor-consumer-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'46',role,company_id:role==='COMPANY_MEMBER'?'45':null,internal_role:role==='COMPANY_MEMBER'?memberRole:null}};
  if(p==='/api/v1/candidates/me/profile')return {body:profile};
  if(p==='/api/v1/companies/me')return {body:company()};
  if(p==='/api/v1/companies/me/members')return {body:[{account_id:'46',full_name:'Trần Minh Quân',email:'owner@example.com',internal_role:memberRole,status:'ACTIVE',account_status:'ACTIVE'}]};
  if(p==='/api/v1/company-packages')return {body:[company().package]};
  if(p==='/api/v1/companies/filters')return {body:{industries:['Công nghệ'],locations:['Hà Nội']}};
  if(p==='/api/v1/companies')return {body:{items:[{...company(),open_job_count:1}],total:1,limit:12,offset:0}};
  if(p==='/api/v1/job-catalog')return {body:{industries:[{id:'91',name:'Công nghệ'}],provinces:[{id:'92',name:'Hà Nội'}],skills:[],wards:[]}};
  if(p==='/api/v1/jobs/31'||p==='/api/v1/companies/me/jobs/31')return {body:job};
  if(p==='/api/v1/companies/me/jobs')return {body:{items:[job],total:url.searchParams.get('status')==='PENDING'?7:url.searchParams.get('status')==='APPROVED'?23:128,offset:0,limit:Number(url.searchParams.get('limit'))}};
  if(p==='/api/v1/jobs')return {body:{items:[job],total:1,offset:0,limit:15}};
  if(p==='/api/v1/candidates/me/cvs')return {body:[]};
  if(p==='/api/v1/applications/41')return {body:record()};
  if(p.endsWith('/applications')){
    if(failOverview)return {status:503,body:{detail:'Unavailable'}};
    return {body:{items:[record()],total:url.searchParams.get('status')==='INTERVIEW'?3:24,offset:0,limit:10}};
  }
  throw new Error('Unexpected API '+p);
},async({send,evaluate,until,fill,click})=>{
  async function login(path,as){
    role=as;
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?'+new URLSearchParams({audience:as==='COMPANY_MEMBER'?'recruiter':'candidate',next:path})});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email','actor@example.com');await fill('#auth-password','Actor-consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
    await until(`location.pathname===${JSON.stringify(path)}`);
  }
  async function fit(name){
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),name+' overflows');
    assert(await evaluate('getComputedStyle(document.querySelector(".actor-ui")).getPropertyValue("--color-brand").trim()==="#00843d"'),name+' missing theme');
    assert(await evaluate('getComputedStyle(document.body).fontFamily.includes("Open Sans")'));
  }
  async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(name+'.png',folder),Buffer.from(r.data,'base64'));}
  const pages=[
    ['/candidate','CANDIDATE','.ui-stats','candidate-home'],
    ['/candidate/profile','CANDIDATE','.ui-columns','candidate-profile'],
    ['/candidate/cvs','CANDIDATE','#cv-file','candidate-cvs'],
    ['/candidate/applications','CANDIDATE','.ca-card','candidate-applications'],
    ['/candidate/recommended','CANDIDATE','.cl-workspace-job-grid','candidate-jobs'],
    ['/recruiter','COMPANY_MEMBER','.ui-stats','employer-home'],
    ['/recruiter/company','COMPANY_MEMBER','#member-email','employer-company'],
    ['/recruiter/jobs','COMPANY_MEMBER','.cl-job-list','employer-jobs'],
    ['/recruiter/jobs/new','COMPANY_MEMBER','#job-title','employer-job-new'],
    ['/recruiter/jobs/31/edit','COMPANY_MEMBER','#job-title','employer-job-edit'],
    ['/recruiter/applicants','COMPANY_MEMBER','.cl-job-collection','employer-applicants'],
    ['/recruiter/pipeline','COMPANY_MEMBER','.cl-job-collection','employer-pipeline'],
  ];
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    for(const [path,as,selector,name] of pages){
      await login(path,as);await until(`!!document.querySelector(${JSON.stringify(selector)})`);await evaluate('document.fonts.ready');await fit(name+' '+width);
      if(path==='/candidate'){
        await until('[...document.querySelectorAll(".ui-stat")].some(e=>e.querySelector("small").textContent==="Đơn ứng tuyển"&&e.querySelector("strong").textContent==="24")');
        assert(await evaluate('document.querySelector(".cl-application-update").innerText.includes("Đã tuyển")'));
      }
      if(path==='/recruiter'){
        await until('[...document.querySelectorAll(".ui-stat strong")].some(e=>e.textContent==="128")');
        assert(await evaluate('[...document.querySelectorAll(".ui-stat strong")].map(e=>e.textContent).join(",")==="128,7,23,1"'));
        const sidebar=await evaluate('getComputedStyle(document.querySelector(".actor-sidebar")).display');assert.equal(sidebar,width>=1200?'flex':'none');
      }
      await screenshot(name+'-'+width);checks.push(name+' themed and fits '+width+'px');
    }
  }
  failOverview=true;await login('/candidate','CANDIDATE');await until('!!document.querySelector(".ui-notice-error")');
  assert(await evaluate('[...document.querySelectorAll(".ui-stat")].some(e=>e.querySelector("small").textContent==="Đơn ứng tuyển"&&e.querySelector("strong").textContent==="—")'));
  failOverview=false;await click('Thử tải lại tổng quan');await until('[...document.querySelectorAll(".ui-stat strong")].some(e=>e.textContent==="24")');
  checks.push('Dashboard error is visible, never fake zero; retry restores server totals');
  approval='PENDING';await login('/recruiter','COMPANY_MEMBER');await until('!!document.querySelector(".actor-welcome-actions a")');
  assert.equal(await evaluate('document.querySelector(".actor-welcome-actions a").getAttribute("href")'),'/recruiter/company');
  checks.push('PENDING employer welcome directs to company completion');
  approval='APPROVED';memberRole='RECRUITER';await login('/recruiter/company','COMPANY_MEMBER');await until('!!document.querySelector(".ui-columns")');
  assert(!await evaluate('!!document.querySelector("#member-email")'));
  checks.push('Recruiter member does not receive Owner management controls');
  for(const path of ['/','/jobs','/companies','/sign-in','/sign-up/candidate','/sign-up/recruiter']){
    await send('Page.navigate',{url:'http://localhost:3000'+path});await until('!!document.querySelector(".actor-ui")');await fit(path);checks.push('Public/auth theme '+path+' fits mobile');
  }
  await send('Page.navigate',{url:'http://localhost:3000/admin/sign-in'});await until('!!document.querySelector("#auth-email")');assert(!await evaluate('!!document.querySelector(".actor-ui")'));
  checks.push('Admin remains outside actor redesign');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled actor UI/contract fixtures; no database writes',checks},null,2));
