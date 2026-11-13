// Layout-only consumer fixtures. No API writes reach a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
let actor='CANDIDATE';
const checks=[];
const folder=new URL('../../.local-backups/layout-alignment/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const job={id:'91',title:'Chuyên viên phát triển sản phẩm',company_id:'92',company_name:'Công ty kiểm thử bố cục',industry_id:'93',industry_name:'Công nghệ',province_id:'94',province_name:'Hà Nội',street:null,ward_id:null,description:'Controlled layout fixture',requirements:'Python',level:null,minimum_salary:null,maximum_salary:null,years_experience:null,work_type:'Full-time',application_deadline:null,status:'APPROVED',created_at:'2026-11-13T00:00:00Z',skills:[]};
const company={company_id:'92',company_name:job.company_name,industry:'Công nghệ',size:null,address:'Hà Nội',website:null,logo_url:null,introduction:null,open_job_count:1,approval_status:'APPROVED',active_member_count:1,package:{name:'Test catalog',member_limit:1}};
await withBrowser(async(url,request)=>{
  const p=url.pathname;assert(request.method==='GET'||(request.method==='POST'&&p==='/api/v1/auth/login'));
  if(p==='/api/v1/auth/login')return {body:{access_token:'layout-consumer-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'95',role:actor,internal_role:actor==='COMPANY_MEMBER'?'OWNER':null}};
  if(p==='/api/v1/candidates/me/profile')return {body:{account_id:'95',candidate_id:'96',full_name:'Ứng viên kiểm thử',email:'layout@example.com',education:[],experience:[]}};
  if(p==='/api/v1/companies/me')return {body:company};
  if(p==='/api/v1/companies/filters')return {body:{industries:['Công nghệ'],locations:['Hà Nội']}};
  if(p==='/api/v1/companies')return {body:{items:[company],total:1,limit:12,offset:0}};
  if(p==='/api/v1/job-catalog')return {body:{industries:[{id:'93',name:'Công nghệ'}],provinces:[{id:'94',name:'Hà Nội'}],skills:[],wards:[]}};
  if(p.endsWith('/applications'))return {body:{items:[],total:0,limit:10,offset:0}};
  if(p.endsWith('/cvs'))return {body:[]};
  if(p.endsWith('/jobs'))return {body:{items:[job],total:1,limit:15,offset:0}};
  throw new Error('Unexpected API '+p);
},async({send,evaluate,until,fill})=>{
  async function viewport(width){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});}
  async function login(next){
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?'+new URLSearchParams({next,audience:actor==='COMPANY_MEMBER'?'recruiter':'candidate'})});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email','layout@example.com');await fill('#auth-password','Layout-consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
  }
  async function aligned(selectors,width){
    await until(`${JSON.stringify(selectors)}.every(selector=>[...document.querySelectorAll(selector)].some(e=>e.getBoundingClientRect().width>0))`);
    const bounds=await evaluate(`(()=>{const h=[...document.querySelectorAll('.site-header-inner')].find(e=>e.getBoundingClientRect().width>0);const r=h.getBoundingClientRect(),s=getComputedStyle(h);return {viewportWidth:document.documentElement.clientWidth,header:{left:r.left+parseFloat(s.paddingLeft),right:r.right-parseFloat(s.paddingRight)},items:${JSON.stringify(selectors)}.map(selector=>{const e=[...document.querySelectorAll(selector)].find(e=>e.getBoundingClientRect().width>0);if(!e)return {selector,missing:true};const r=e.getBoundingClientRect();return {selector,left:r.left,right:r.right,width:r.width}}),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert(!bounds.overflow,'Viewport overflow at '+width);
    for(const item of bounds.items){assert(!item.missing,item.selector);assert(Math.abs(item.left-bounds.header.left)<2,JSON.stringify(item)+' left != '+bounds.header.left);assert(Math.abs(item.right-bounds.header.right)<2,JSON.stringify(item)+' right != '+bounds.header.right);}
    assert(Math.abs(bounds.items[0].width-Math.min(1440,bounds.viewportWidth-(width<=767?32:48)))<2,'Content width at '+width+': '+JSON.stringify(bounds.items[0]));
  }
  for(const width of [1920,1440,1024,768,390]){
    await viewport(width);await login('/candidate');await until('!!document.querySelector(".cl-workspace-home .cl-hot-grid")');
    await aligned(['.cl-member-section .cl-section-heading','.cl-member-section .ui-stats','.cl-member-grid','.cl-hot-section .cl-section-heading','.cl-hot-grid'],width);
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL('candidate-'+width+'.png',folder),Buffer.from(shot.data,'base64'));
    checks.push('Candidate header, headings, stats, profile cards and Jobs align at '+width+'px');
  }
  actor='COMPANY_MEMBER';await viewport(1920);await login('/recruiter');await until('!!document.querySelector(".cl-member-grid")');
  await aligned(['.cl-member-section .cl-section-heading','.cl-member-section .ui-stats','.cl-member-grid'],1920);
  checks.push('Employer dashboard uses the same wide section edge');
  actor='CANDIDATE';await login('/candidate/applications');await until('!!document.querySelector(".ca-state")');await aligned(['.ca-shell'],1920);
  checks.push('Candidate applications content uses the shared width');
  for(const width of [1920,390]){
    await viewport(width);
    for(const [url,ready,selectors] of [['/','.cl-hot-grid',['.cl-section-heading','.cl-hot-grid']],['/jobs','.cl-results-grid',['.jobs-search-intro','.cl-results-wrap']],['/companies','.company-directory-grid',['.cl-results-wrap']]]){
      await send('Page.navigate',{url:'http://localhost:3000'+url});await until(`!!document.querySelector(${JSON.stringify(ready)})`);await aligned(selectors,width);
    }
    checks.push('Home, Jobs and Companies share header alignment without overflow at '+width+'px');
  }
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled layout consumer; no database writes',checks},null,2));
