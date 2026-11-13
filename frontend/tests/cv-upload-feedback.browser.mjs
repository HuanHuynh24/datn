// Controlled upload responses exercise pending/error states; no CV is written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const cvPath='/api/v1/candidates/me/cvs';
const saved={id:'9999999',is_primary:false,status:'ACTIVE',created_at:'2026-11-13T00:00:00Z',format:'pdf'};
let mode='success', posts=0, releaseUpload;
const checks=[];
await withBrowser(async(url,request)=>{
  if(url.pathname===cvPath&&request.method==='POST'){
    posts++;await new Promise(resolve=>{releaseUpload=resolve;});
    return mode==='failure'?{status:422,body:{detail:'A valid PDF or DOCX up to 10 MiB is required'}}:{status:201,body:saved};
  }
  if(url.pathname===cvPath&&request.method==='GET'&&posts)
    return mode==='refresh-error'?{status:503,body:{detail:'CV/application backend unavailable'}}:{body:[saved]};
  assert(request.method==='GET'||(request.method==='POST'&&url.pathname==='/api/v1/auth/login'),'Unexpected write');
  const headers=Object.fromEntries(Object.entries(request.headers).filter(([name])=>['authorization','content-type'].includes(name.toLowerCase())));
  const response=await fetch('http://localhost:8001'+url.pathname+url.search,{method:request.method,headers,...(request.postData?{body:request.postData}:{})});
  return {status:response.status,body:await response.json()};
},async({send,evaluate,until,fill,click})=>{
  await send('Page.navigate',{url:'http://localhost:3000/sign-in?next=/candidate/cvs'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email',env.BROWSER_CANDIDATE_EMAIL);await fill('#auth-password',env.BROWSER_CANDIDATE_PASSWORD);
  await evaluate('document.querySelector("form").requestSubmit()');
  await until('location.pathname==="/candidate/cvs"&&!!document.querySelector("#cv-file")&&!document.body.innerText.includes("Đang tải CV…")');
  const choose=async(name)=>evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([atob('JVBERi0xLjQKJSVFT0Y=')],${JSON.stringify(name)},{type:'application/pdf'}));const i=document.querySelector('#cv-file');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await choose('feedback.pdf');
  await until('document.querySelector(".ui-cv-dropzone").innerText.includes("feedback.pdf")');
  await click('Tải CV lên');
  await until('!!document.querySelector("progress")');
  assert(await evaluate('document.querySelector("#cv-file").disabled&&document.querySelector("form[aria-busy=true] button").disabled'));
  assert(!await evaluate('document.body.innerText.includes("Đã tải CV lên.")'));
  assert.equal(posts,1);releaseUpload();
  await until('!!document.querySelector("dialog[open]")&&!document.querySelector("progress")');
  assert(await evaluate('document.querySelector("dialog[open]").innerText.includes("Tải CV thành công")'));
  await click('Xem CV đã lưu');
  assert(await evaluate('document.querySelector("#cv-file").files.length===0'));
  checks.push('Selected filename, pending progress, locked controls and success confirmation after response');
  mode='failure';await choose('rejected.pdf');await click('Tải CV lên');await until('!!document.querySelector("progress")');releaseUpload();
  await until('!!document.querySelector("dialog[open]")&&!document.querySelector("progress")');
  assert(await evaluate('document.querySelector("dialog[open]").innerText.includes("Chưa thể tải CV lên")'));
  assert(!await evaluate('document.body.innerText.includes("Đã tải CV lên.")'));
  await click('Đóng và kiểm tra lại');
  assert(await evaluate('document.querySelector("#cv-file").files[0].name==="rejected.pdf"'));
  checks.push('Upload rejection has clear error, no success and retains selected file for correction');
  mode='refresh-error';await choose('saved.pdf');await click('Tải CV lên');await until('!!document.querySelector("progress")');releaseUpload();
  await until('!!document.querySelector("dialog[open]")&&document.querySelector("dialog[open]").innerText.includes("Không cần tải lại tệp")&&!document.querySelector("progress")');
  assert(await evaluate('document.querySelector("dialog[open]").innerText.includes("Tải CV thành công")'));
  await click('Xem CV đã lưu');
  assert(await evaluate('document.body.innerText.includes("CV #9999999")'));
  checks.push('Successful save plus refresh failure preserves saved CV and warns against reupload');
  await choose('invalid.txt');await click('Tải CV lên');
  await until('!!document.querySelector("dialog[open]")');
  assert.equal(posts,3);assert(!await evaluate('!!document.querySelector("progress")'));
  checks.push('Invalid extension is rejected before upload');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled upload feedback; no database upload',checks},null,2));
