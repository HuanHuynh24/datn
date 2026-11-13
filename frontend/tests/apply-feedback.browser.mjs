// Controlled HTTP errors; login/CV reads use the rollback-only fixture on8001.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const jobs=await(await fetch('http://localhost:8001/api/v1/jobs')).json();
const id=jobs.items[0].id;
let failCV=true, submissions=0;
await withBrowser(async(url,request)=>{
  if(url.pathname==='/api/v1/candidates/me/cvs'&&request.method==='GET'&&failCV)
    return {status:503,body:{detail:'Không thể tải CV lúc này.'}};
  if(url.pathname===`/api/v1/jobs/${id}/applications`&&request.method==='POST'){
    submissions++;return {status:409,body:{detail:'Already applied to this job'}};
  }
  assert(request.method==='GET'||(request.method==='POST'&&url.pathname==='/api/v1/auth/login'),'Unexpected test write');
  const headers=Object.fromEntries(Object.entries(request.headers).filter(([name])=>['authorization','content-type'].includes(name.toLowerCase())));
  const response=await fetch('http://localhost:8001'+url.pathname+url.search,{method:request.method,headers,...(request.postData?{body:request.postData}:{})});
  return {status:response.status,body:await response.json()};
},async({send,evaluate,until,fill,click})=>{
  await send('Page.navigate',{url:'http://localhost:3000/sign-in?next='+encodeURIComponent('/jobs/'+id+'?intent=apply')});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email',env.BROWSER_CANDIDATE_EMAIL);await fill('#auth-password',env.BROWSER_CANDIDATE_PASSWORD);
  await evaluate('document.querySelector("form").requestSubmit()');
  await until('!!document.querySelector("dialog[open]")');
  assert(await evaluate('document.querySelector("dialog[open]").innerText.includes("Không thể tải danh sách CV")'));
  assert(!await evaluate('document.querySelector("dialog[open]").innerText.includes("Bạn chưa có CV hoạt động")'));
  failCV=false;
  await evaluate(`[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Thử tải lại CV').click()`);
  await until('!!document.querySelector("#apply-cv")&&!document.querySelector("dialog[open]")');
  await click('Nộp hồ sơ');
  await until('!!document.querySelector("dialog[open]")');
  assert(await evaluate('document.querySelector("dialog[open]").innerText.includes("Bạn đã ứng tuyển công việc này.")'));
  assert(!await evaluate('document.body.innerText.includes("Đã nộp hồ sơ.")'));
  await click('Đóng');
  await until('!document.querySelector("dialog[open]")');
  assert(await evaluate('!!document.querySelector("#apply-cv")'));
});
assert.equal(submissions,1);
console.log(JSON.stringify({status:'PASS',kind:'Controlled HTTP errors, not MySQL submission tests',checks:['CV fetch error has separate popup; retry restores form','Submission rejection displays reason without false success; close preserves form']},null,2));
