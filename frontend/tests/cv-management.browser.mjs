// Synthetic responses test recovery semantics; no runtime demo data or database writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
const base='/api/v1/candidates/me/cvs';
let cvs=[{id:'51',is_primary:true,status:'ACTIVE',format:'pdf',created_at:'2026-11-15T00:00:00Z'},{id:'52',is_primary:false,status:'ACTIVE',format:'docx',created_at:'2026-11-15T00:00:00Z'}];
let failList=true,failDownload=true,failWrite=false,failRefresh=false;
const calls=[],checks=[];
await withBrowser(async(url,request)=>{
  const path=url.pathname;calls.push({path,method:request.method});
  if(path==='/api/v1/auth/login')return {body:{access_token:'cv-consumer-only',expires_in:1800}};
  if(path==='/api/v1/auth/me')return {body:{account_id:'46',role:'CANDIDATE',company_id:null,internal_role:null}};
  if(path==='/api/v1/candidates/me/profile')return {body:{account_id:'46',candidate_id:'47',full_name:'CV Consumer',email:'candidate@example.com'}};
  if(path===base)return failList?{status:503,body:{detail:'Unavailable'}}:{body:cvs};
  if(path.endsWith('/download'))return failDownload?{status:503,body:{detail:'Unavailable'}}:{type:'application/pdf',raw:'%PDF-1.4\n%%EOF'};
  if(path===base+'/52'){
    if(failWrite)return {status:503,body:{detail:'Unavailable'}};
    if(request.method==='PATCH'){
      const primary=JSON.parse(request.postData).is_primary;
      cvs=cvs.map(cv=>({...cv,is_primary:cv.id==='52'?primary:primary?false:cv.is_primary}));
      if(failRefresh)failList=true;
      return {body:cvs.find(cv=>cv.id==='52')};
    }
    if(request.method==='DELETE'){
      const archived={...cvs.find(cv=>cv.id==='52'),status:'ARCHIVED',is_primary:false};cvs=cvs.filter(cv=>cv.id!=='52');
      if(failRefresh)failList=true;
      return {body:archived};
    }
  }
  throw new Error('Unexpected API '+path);
},async({send,evaluate,until,fill,click})=>{
  const row=id=>`[...document.querySelectorAll('.ui-cv-card')].find(e=>e.querySelector('h3')?.textContent==='CV #${id}')`;
  const cvButton=async(id,text)=>{
    const expression=`[...(${row(id)}).querySelectorAll('button')].find(b=>!b.disabled&&b.textContent.trim()===${JSON.stringify(text)})`;
    await until(`!!(${expression})`);await evaluate(`(${expression}).click()`);
  };
  await send('Page.navigate',{url:'http://localhost:3000/sign-in?next=/candidate/cvs'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','candidate@example.com');await fill('#auth-password','consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
  await until('document.body.innerText.includes("Thử tải lại danh sách CV")');
  assert(!await evaluate('document.querySelector(".ui-cv-overview").innerText.includes("0 CV")'));
  failList=false;await click('Thử tải lại danh sách CV');await until(`!!(${row('52')})`);
  checks.push('CV list read failure shows unknown count and GET retry restores active CVs');
  const reads=calls.filter(c=>c.path===base).length;
  await cvButton('51','Tải xuống');await until('!!document.querySelector("[role=alert]")');
  assert(await evaluate(`!!(${row('52')})`));assert.equal(calls.filter(c=>c.path===base).length,reads);
  failDownload=false;await cvButton('51','Tải xuống');await until('document.body.innerText.includes("Đã tải tệp.")');
  assert.equal(calls.filter(c=>c.path===base).length,reads);
  checks.push('Download errors preserve CV cards; downloads do not refetch the list');
  failRefresh=true;await cvButton('52','Đặt mặc định');await until('document.body.innerText.includes("Thao tác đã thành công nhưng")');
  assert(await evaluate(`(${row('52')}).dataset.default==='true'&&(${row('51')}).dataset.default==='false'`));
  assert(await evaluate('document.body.innerText.includes("Đã cập nhật CV chính.")'));
  const patches=calls.filter(c=>c.method==='PATCH').length;
  failList=false;await click('Thử tải lại danh sách CV');await until('!document.body.innerText.includes("Thử tải lại danh sách CV")');
  assert.equal(calls.filter(c=>c.method==='PATCH').length,patches);
  checks.push('Committed primary change remains successful after refresh failure; GET retry never repeats PATCH');
  failWrite=true;await cvButton('52','Lưu trữ');await until('!!document.querySelector("[role=alert]")');
  assert(await evaluate(`!!(${row('52')})`));assert(!await evaluate('document.body.innerText.includes("Đã lưu trữ CV.")'));
  checks.push('Rejected archive retains card and never claims success');
  failWrite=false;await cvButton('52','Lưu trữ');await until('document.body.innerText.includes("Thao tác đã thành công nhưng")');
  assert(!await evaluate(`!!(${row('52')})`));assert(await evaluate('document.body.innerText.includes("Đã lưu trữ CV.")'));
  const deletes=calls.filter(c=>c.method==='DELETE').length;
  failList=false;await click('Thử tải lại danh sách CV');await until('!document.body.innerText.includes("Thử tải lại danh sách CV")');
  assert.equal(calls.filter(c=>c.method==='DELETE').length,deletes);
  checks.push('Committed archive removes known CV locally; GET retry never repeats archive');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  checks.push('CV management fits mobile after recoveries');
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
