// Controlled consumer responses, not Development/test database fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
let mode='empty', releaseList;
const checks=[];
const folder=new URL('../../.local-backups/candidate-applications-ui/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const record={id:'41',candidate_id:'42',candidate_name:'Consumer Candidate',candidate_email:'candidate@example.com',job_id:'43',job_title:'Chuyên viên phát triển sản phẩm',company_id:'44',company_name:'Công ty kiểm thử giao diện',cv_id:'45',cover_letter:null,status:'APPLIED',submitted_at:'2026-11-13T00:00:00Z',updated_at:'2026-11-13T00:00:00Z'};
let hold=true;
await withBrowser(async(url,request)=>{
  const p=url.pathname;
  assert(request.method==='GET'||(request.method==='POST'&&p==='/api/v1/auth/login'),'Unexpected write');
  if(p==='/api/v1/auth/login')return {body:{access_token:'consumer-test-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'46',role:'CANDIDATE'}};
  if(p==='/api/v1/candidates/me/profile')return {body:{account_id:'46',candidate_id:'42',full_name:'Consumer Candidate',email:'candidate@example.com'}};
  if(p==='/api/v1/candidates/me/applications'){
    if(hold)await new Promise(resolve=>{releaseList=resolve;});
    if(mode==='error')return {status:503,body:{detail:'Unavailable'}};
    const status=url.searchParams.get('status')||'APPLIED';
    const items=mode==='empty'||status==='REJECTED'?[]:[{...record,status}];
    return {body:{items,total:items.length?11:0,offset:Number(url.searchParams.get('offset')),limit:10}};
  }
  if(p==='/api/v1/applications/41/cv')return {status:403,body:{detail:'Forbidden'}};
  throw new Error('Unexpected route '+p);
},async({send,evaluate,until,fill,click})=>{
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:3000/sign-in?next=/candidate/applications'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','candidate@example.com');await fill('#auth-password','Consumer-test-only-123');await evaluate('document.querySelector("form").requestSubmit()');
  await until('!!document.querySelector(".ca-loading")');
  assert(!await evaluate('document.body.innerText.includes("0 đơn ứng tuyển")'));
  hold=false;releaseList();
  await until('!!document.querySelector(".ca-state-actions")');
  assert(await evaluate('document.body.innerText.includes("Bạn chưa ứng tuyển công việc nào")'));
  assert(!await evaluate('!!document.querySelector("#application-job")'));
  assert(await evaluate('[...document.querySelectorAll(".ca-state-actions a")].some(a=>a.getAttribute("href")==="/jobs")'));
  checks.push('Loading does not show zero; first-use state has clear next step and no numeric job-ID input');
  async function screenshot(name){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(name+'.png',folder),Buffer.from(shot.data,'base64'));}
  await evaluate('document.fonts.ready');await screenshot('empty-desktop');
  mode='list';
  async function filter(status){await evaluate(`document.querySelector('#application-status').value=${JSON.stringify(status)};document.querySelector('.ca-filters').requestSubmit()`);}
  await filter('APPLIED');await until('!!document.querySelector(".ca-card")');
  assert(await evaluate('document.body.innerText.includes("11 đơn ứng tuyển")'));
  assert.equal(await evaluate('document.querySelector(".ca-status").dataset.status'),'APPLIED');
  checks.push('API result total and real status are displayed in readable cards');
  await screenshot('list-desktop');await click('Tải CV đã nộp');await until('!!document.querySelector(".ca-error[role=alert]")');
  assert(await evaluate('!!document.querySelector(".ca-card")'));
  checks.push('Download error remains visible without removing the application list');
  await click('Trang sau');await until('location.search.includes("page=2")&&!!document.querySelector(".ca-card")');
  await filter('INTERVIEW');await until('!location.search.includes("page=")&&document.querySelector(".ca-status")?.dataset.status==="INTERVIEW"');
  checks.push('Status filter updates URL and resets server pagination');
  mode='error';await filter('OFFER');await until('!!document.querySelector(".ca-failure")');
  mode='list';await click('Thử lại');await until('!!document.querySelector(".ca-card")');
  checks.push('List API error offers retry and recovers without false data');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await evaluate('window.scrollTo(0,0)');await screenshot('list-mobile');
  await filter('REJECTED');await until('document.body.innerText.includes("Chưa có đơn phù hợp")');
  assert(await evaluate('[...document.querySelectorAll(".ca-state-actions a")].some(a=>a.getAttribute("href")==="/candidate/applications")'));
  await screenshot('filtered-empty-mobile');
  checks.push('Mobile fits viewport and filtered empty state offers clearing filters');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled UI consumer, no database writes',checks},null,2));
