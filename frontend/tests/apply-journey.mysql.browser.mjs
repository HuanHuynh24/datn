// Reproduce the guest -> login -> no CV -> upload -> return -> apply journey.
// All API traffic targets the rollback-only MySQL test server on8001.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const jobs=await(await fetch('http://localhost:8001/api/v1/jobs')).json();
const id=jobs.items[0].id;
const checks=[];
await withBrowser(null,async({send,evaluate,until,fill,click,responses})=>{
  await send('Page.navigate',{url:'http://localhost:3000/jobs/'+id});
  await until(`!![...document.querySelectorAll('a')].find(link=>link.textContent==='Đăng nhập để ứng tuyển')`);
  await evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent==='Đăng nhập để ứng tuyển').click()`);
  await until(`location.pathname==='/sign-in'&&!!document.querySelector('#auth-email')`);
  assert.equal(new URLSearchParams(await evaluate('location.search')).get('next'),'/jobs/'+id+'?intent=apply');
  checks.push('Guest apply link preserves selected job and intent through sign-in');
  await until(`(()=>{const el=document.querySelector('form');return el&&Object.keys(el).some(key=>key.startsWith('__reactProps')&&typeof el[key].onSubmit==='function')})()`);
  await fill('#auth-email',env.BROWSER_CANDIDATE_EMAIL);await fill('#auth-password',env.BROWSER_CANDIDATE_PASSWORD);
  await evaluate('document.querySelector("form").requestSubmit()');
  await until(`location.pathname==='/jobs/${id}'&&document.body.innerText.includes('Bạn chưa có CV hoạt động')`);
  checks.push('Login returns to same job and explains missing active CV');
  await evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent==='Quản lý CV').click()`);
  await until(`location.pathname==='/candidate/cvs'&&!!document.querySelector('#cv-file')`);
  assert.equal(new URLSearchParams(await evaluate('location.search')).get('returnTo'),'/jobs/'+id+'?intent=apply');
  await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([atob('JVBERi0xLjQKJSVFT0Y=')],'journey.pdf',{type:'application/pdf'}));const input=document.querySelector('#cv-file');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('Tải CV lên');await until('document.body.innerText.includes("Đã tải CV lên.")');
  assert(responses.some(r=>r.path==='/api/v1/candidates/me/cvs'&&r.status===201));
  checks.push('Upload creates a real private CV in MySQL test and retains return link');
  await evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent==='Quay lại tin để ứng tuyển').click()`);
  await until(`location.pathname==='/jobs/${id}'&&!!document.querySelector('#apply-cv')`);
  await click('Nộp hồ sơ');await until('document.body.innerText.includes("Đã nộp hồ sơ.")');
  assert(responses.some(r=>r.path===`/api/v1/jobs/${id}/applications`&&r.status===201));
  checks.push('Return to job loads uploaded CV and submits an actual application');
  await evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent==='Theo dõi đơn ứng tuyển').click()`);
  await until(`location.pathname==='/candidate/applications'&&document.body.innerText.includes('Chi tiết đơn #')`);
  checks.push('Submitted application appears in Candidate application list');
},{mysqlTest:true});
console.log(JSON.stringify({status:'PASS',target:'MySQL test8001, outer rollback',checks},null,2));
