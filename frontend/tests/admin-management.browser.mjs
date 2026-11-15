// Controlled Admin recovery and confirmation isolation; no database writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
let failDashboard=true,failList=true,failDetail=true,failCatalog=false,holdDetail=false,holdWrite=false,releaseDetail,releaseWrite;
let account={id:'51',name:'Candidate Consumer',email:'candidate@example.com',role:'CANDIDATE',status:'ACTIVE'};
const administrator={id:'52',name:'Admin Consumer',email:'admin@example.com',role:'ADMIN',status:'ACTIVE'};
let skill={id:'61',name:'Consumer skill',status:'ACTIVE'};
const calls=[],checks=[];
await withBrowser(async(url,request)=>{
  const path=url.pathname;calls.push({path,method:request.method,query:url.search});
  if(path==='/api/v1/auth/login')return {body:{access_token:'admin-consumer-only',expires_in:1800}};
  if(path==='/api/v1/auth/me')return {body:{account_id:'52',role:'ADMIN',company_id:null,internal_role:null}};
  if(path==='/api/v1/admin/dashboard')return failDashboard?{status:503,body:{detail:'Unavailable'}}:{body:{accounts:2,candidates:1,companies:0,jobs:0,applications:0,cvs:0,industries:0,skills:1,packages:0,accounts_by_status:{ACTIVE:2},companies_by_status:{},jobs_by_status:{},applications_by_status:{},generated_at:'2026-11-15T00:00:00Z'}};
  if(path==='/api/v1/admin/management/accounts')return failList?{status:503,body:{detail:'Unavailable'}}:{body:{items:[account,administrator],total:2,limit:10,offset:0}};
  if(path==='/api/v1/admin/management/accounts/51'){
    if(holdDetail){holdDetail=false;await new Promise(resolve=>{releaseDetail=resolve;});}
    return failDetail?{status:503,body:{detail:'Unavailable'}}:{body:account};
  }
  if(path==='/api/v1/admin/management/accounts/52')return {body:administrator};
  if(path==='/api/v1/admin/accounts/51/status'){
    if(holdWrite)await new Promise(resolve=>{releaseWrite=resolve;});
    account={...account,status:JSON.parse(request.postData).status};failList=true;return {body:account};
  }
  if(path==='/api/v1/admin/management/skills')return {body:{items:[skill],total:1,limit:10,offset:0}};
  if(path==='/api/v1/admin/management/skills/61')return {body:skill};
  if(path==='/api/v1/admin/catalog/skills/61'){
    if(failCatalog)return {status:409,body:{detail:'Catalog name already exists'}};
    skill={...skill,...JSON.parse(request.postData)};return {body:skill};
  }
  throw new Error('Unexpected API '+path);
},async({send,evaluate,until,fill,click})=>{
  const close=async()=>{await evaluate('document.querySelector("dialog button[aria-label]").click()');await until('!document.querySelector("dialog")');};
  const detail=async id=>{await evaluate(`([...document.querySelectorAll('tbody tr')].find(row=>row.cells[0].textContent===${JSON.stringify(id)})).querySelector('button').click()`);await until('!!document.querySelector("dialog")&&!document.body.innerText.includes("Đang tải chi tiết")');};
  await send('Page.navigate',{url:'http://localhost:3000/admin/sign-in'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','admin@example.com');await fill('#auth-password','consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
  await until('!!document.querySelector(".admin-content [role=alert]")');assert(!await evaluate('!!document.querySelector(".admin-stats")'));
  failDashboard=false;await click('Tải lại');await until('!!document.querySelector(".admin-stats")');checks.push('Dashboard failure has retry without fake zero statistics');
  await click('Tài khoản');await until('!!document.querySelector(".admin-content [role=alert]")');failList=false;await click('Tải lại');await until('!!document.querySelector("tbody")');
  await fill('#admin-query','Candidate');await click('Tìm kiếm');await until('!document.querySelector(".admin-heading button").disabled');
  assert(calls.some(c=>new URLSearchParams(c.query).get('q')==='Candidate'));
  await click('Xóa bộ lọc');await until('!document.querySelector(".admin-heading button").disabled');assert.equal(await evaluate('document.querySelector("#admin-query").value'),'');
  checks.push('Directory retry and reset filters use fresh server reads');
  await detail('51');assert(await evaluate('document.querySelector("dialog").innerText.includes("Thử tải lại chi tiết")'));assert(await evaluate('!!document.querySelector("tbody")'));
  failDetail=false;await click('Thử tải lại chi tiết');await until('document.querySelector("dialog")?.innerText.includes("Candidate Consumer")');checks.push('Detail errors remain in dialog and preserve directory; retry restores detail');
  await click('Vô hiệu hóa tài khoản');assert(await evaluate('document.querySelector("dialog").innerText.includes("Xác nhận trạng thái")'));await close();await detail('52');
  assert(!await evaluate('document.querySelector("dialog").innerText.includes("Xác nhận trạng thái")'));assert(!await evaluate('document.querySelector("dialog").innerText.includes("Vô hiệu hóa tài khoản")'));await close();
  checks.push('Closing one account clears confirmation; ADMIN has no status action');
  holdDetail=true;await evaluate('document.querySelector("tbody tr button").click()');await until('document.querySelector("dialog")?.innerText.includes("Đang tải chi tiết")');await close();await detail('52');releaseDetail();
  await new Promise(resolve=>setTimeout(resolve,250));assert.equal(await evaluate('document.querySelector("dialog").getAttribute("aria-label")'),'Admin Consumer');await close();
  checks.push('Canceled slow detail cannot replace a later account dialog');
  await detail('51');await click('Vô hiệu hóa tài khoản');holdWrite=true;await click('Xác nhận trạng thái');
  await until('[...document.querySelectorAll(".admin-sidebar nav button")].every(b=>b.disabled)');
  assert(await evaluate('document.querySelector("dialog button").disabled===false')); // Close handler itself blocks while busy.
  await evaluate('document.querySelector("dialog button[aria-label]").click()');assert(await evaluate('!!document.querySelector("dialog")'));
  releaseWrite();await until('!document.querySelector("dialog")&&!!document.querySelector(".admin-content [role=alert]")');
  assert(await evaluate('document.body.innerText.includes("Đã cập nhật trạng thái tài khoản")'));
  const writes=calls.filter(c=>c.path.endsWith('/status')).length;failList=false;await click('Tải lại');await until('!!document.querySelector("tbody")');assert.equal(calls.filter(c=>c.path.endsWith('/status')).length,writes);
  checks.push('Busy write blocks navigation/close; committed success survives refresh failure; retry never repeats PATCH');
  await click('Kỹ năng');await until('!!document.querySelector("tbody")');await click('Chi tiết');await until('document.querySelector("dialog")?.innerText.includes("Consumer skill")');await click('Sửa danh mục');
  await click('Lưu danh mục');await until('!document.querySelector("dialog")');assert(!calls.some(c=>c.path.includes('/catalog/')));checks.push('Unchanged catalog editor sends no write');
  await click('Chi tiết');await until('document.querySelector("dialog")?.innerText.includes("Consumer skill")');await click('Sửa danh mục');await fill('#catalog-name','Updated skill');failCatalog=true;await click('Lưu danh mục');
  await until('!!document.querySelector("dialog [role=alert]")');assert.equal(await evaluate('document.querySelector("#catalog-name").value'),'Updated skill');assert(await evaluate('!!document.querySelector("tbody")'));
  failCatalog=false;await click('Lưu danh mục');await until('!document.querySelector("dialog")&&document.querySelector("tbody")?.innerText.includes("Updated skill")');
  checks.push('Catalog validation error retains input and directory; corrected retry saves');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));checks.push('Admin recovery UI fits mobile');
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
