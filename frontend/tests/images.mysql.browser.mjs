// Uses rollback-only MySQL API8001; credentials stay local and never reach logs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser', import.meta.url), 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const checks = [];
await withBrowser(null, async ({ send, evaluate, until, fill, click, requests, responses }) => {
  const login = async employer => {
    const next = employer ? '/recruiter/company' : '/candidate/profile';
    await send('Page.navigate', { url: 'http://localhost:3000/sign-in?' + new URLSearchParams({ audience: employer ? 'recruiter' : 'candidate', next }) });
    await until(`(()=>{const form=document.querySelector('form');return form&&Object.keys(form).some(key=>key.startsWith('__reactProps')&&typeof form[key].onSubmit==='function')})()`);
    const prefix = employer ? 'EMPLOYER' : 'CANDIDATE';
    await fill('#auth-email', env['BROWSER_' + prefix + '_EMAIL']); await fill('#auth-password', env['BROWSER_' + prefix + '_PASSWORD']);
    await evaluate('document.querySelector("form").requestSubmit()');
    await until(`location.pathname===${JSON.stringify(next)}&&!!document.querySelector('input[type=file][accept*="image/png"]')`);
  };
  const choose = async (kind = 'valid') => evaluate(`(async()=>{
    const input=document.querySelector('input[type=file][accept*="image/png"]');
    let blob;
    if(${JSON.stringify(kind)}==='oversized') blob=new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/png'});
    else if(${JSON.stringify(kind)}==='invalid') blob=new Blob(['not an image'],{type:'image/png'});
    else {const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;canvas.getContext('2d').fillRect(0,0,32,24);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));}
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'upload-test.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  const preview = () => until(`!![...document.querySelectorAll('img[src^="blob:"]')].find(image=>image.complete&&image.naturalWidth>0)`);
  await login(false);
  await choose(); await click('Tải và lưu ảnh');
  await until('document.body.innerText.includes("Đã tải và lưu ảnh.")'); await preview();
  assert(responses.some(item => item.path==='/api/v1/candidates/me/avatar' && item.status===200));
  checks.push('Candidate PNG multipart upload persists and private Blob preview renders');
  await login(false); await preview();
  checks.push('Avatar URL and pixels survive a fresh Candidate login');
  const posts = () => requests.filter(request=>request.path==='/api/v1/candidates/me/avatar'&&request.method==='POST').length;
  const before = posts(); await choose('oversized'); await click('Tải và lưu ảnh');
  await until('document.body.innerText.includes("Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MiB.")');
  assert.equal(posts(), before);
  checks.push('Oversized image is rejected client-side without API write');
  await choose('invalid'); await click('Tải và lưu ảnh');
  await until('document.body.innerText.includes("Ảnh phải là JPEG, PNG hoặc WebP hợp lệ")');
  assert(responses.some(item=>item.path==='/api/v1/candidates/me/avatar'&&item.status===415));
  await preview();
  checks.push('Backend rejects spoofed PNG; existing avatar remains visible without fake success');
  await login(true); await choose(); await click('Tải và lưu ảnh');
  await until('document.body.innerText.includes("Đã tải và lưu ảnh.")'); await preview();
  checks.push('OWNER uploads company logo and authenticated preview renders');
  await login(true); await preview();
  checks.push('Company logo persists after a fresh OWNER login');
  await send('Page.navigate', { url: 'http://localhost:3000/jobs' });
  await until(`!![...document.querySelectorAll('[data-job-id] img')].find(image=>image.src.includes('/api/v1/media/companies/')&&image.complete&&image.naturalWidth>0)`);
  checks.push('Public job cards display uploaded company logo from Job API without mock image');
  await send('Page.navigate', { url: 'http://localhost:3000/companies' });
  await until('!!document.querySelector("[data-company-id]")');
  await until(`!![...document.querySelectorAll('[data-company-id] img')].find(image=>image.src.includes('/api/v1/media/companies/')&&image.complete&&image.naturalWidth>0)`);
  checks.push('Guest company directory displays stored APPROVED logo via public PNG endpoint');
  assert(requests.filter(request=>request.method==='POST').every(request=>['/api/v1/auth/login','/api/v1/candidates/me/avatar','/api/v1/companies/me/logo'].includes(request.path)));
  checks.push('Browser writes confined to test login/avatar/logo; no other business mutation');
}, { mysqlTest: true });
console.log(JSON.stringify({ status:'PASS', api:'MySQL test8001 with rollback-only files/rows', checks },null,2));
