// Real API8001 / rollback-only MySQL fixture, never recruitment_db.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {withBrowser} from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const memberEmail='company-browser-'+randomBytes(8).toString('hex')+'@example.com';
const memberPassword=randomBytes(24).toString('base64url');
const checks=[];
await withBrowser(null,async({send,evaluate,until,fill,click,requests,responses})=>{
  const login=async()=>{
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?audience=recruiter&next=/recruiter/company'});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email',env.BROWSER_EMPLOYER_EMAIL);await fill('#auth-password',env.BROWSER_EMPLOYER_PASSWORD);await evaluate('document.querySelector("form").requestSubmit()');
    await until('location.pathname==="/recruiter/company"&&!!document.querySelector("#member-email")&&!document.querySelector("#member-email").matches(":disabled")');
  };
  await login();await click('Chỉnh sửa hồ sơ');await fill('#company-address','Company MySQL browser office');await click('Lưu hồ sơ doanh nghiệp');
  try { await until('!document.querySelector("#company-address")&&document.body.innerText.includes("Company MySQL browser office")'); }
  catch { throw new Error('Company save failed: '+JSON.stringify({alerts:await evaluate('[...document.querySelectorAll("[role=alert]")].map(e=>e.innerText)'),responses:responses.filter(r=>r.path==='/api/v1/companies/me')})); }
  await login();assert(await evaluate('document.body.innerText.includes("Company MySQL browser office")'));
  checks.push('OWNER updates company and reads persisted MySQL data after fresh sign-in');
  await fill('#member-full-name','Company MySQL browser recruiter');await fill('#member-email',memberEmail);await fill('#member-password',memberPassword);await click('Tạo thành viên');
  await until('document.body.innerText.includes("Company MySQL browser recruiter")&&!document.body.innerText.includes("Đang tải thành viên")');
  const memberId=await evaluate(`([...document.querySelectorAll('[data-member-id]')].find(row=>row.innerText.includes('Company MySQL browser recruiter'))).dataset.memberId`);
  assert(memberId);
  const loginResult=await fetch('http://localhost:8001/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:memberEmail,password:memberPassword})});assert(loginResult.ok);
  const token=(await loginResult.json()).access_token;
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const me=await (await fetch('http://localhost:8001/api/v1/auth/me',{headers})).json();assert.equal(me.role,'COMPANY_MEMBER');assert.equal(me.internal_role,'RECRUITER');
  assert.equal((await fetch('http://localhost:8001/api/v1/companies/me/members',{headers})).status,403);
  assert.equal((await fetch('http://localhost:8001/api/v1/companies/me',{method:'PATCH',headers,body:JSON.stringify({company_name:'Forbidden edit'})})).status,403);
  checks.push('Created account logs in as RECRUITER and cannot edit company or list members');
  await evaluate(`document.querySelector('[data-member-id="${memberId}"] button').click()`);
  await until(`document.querySelector('[data-member-id="${memberId}"]')?.innerText.includes('Đã tắt')`);
  assert.equal((await fetch('http://localhost:8001/api/v1/auth/me',{headers})).status,401);
  await evaluate(`document.querySelector('[data-member-id="${memberId}"] button').click()`);
  await until(`document.querySelector('[data-member-id="${memberId}"]')?.innerText.includes('Đang hoạt động')`);
  assert.equal((await fetch('http://localhost:8001/api/v1/auth/me',{headers})).status,200);
  assert.equal(requests.filter(r=>r.path==='/api/v1/companies/me/members'&&r.method==='POST').length,1);
  checks.push('OWNER disables/reactivates existing member; old JWT is rejected while INACTIVE; one create only');
},{mysqlTest:true});
console.log(JSON.stringify({status:'PASS',checks},null,2));
