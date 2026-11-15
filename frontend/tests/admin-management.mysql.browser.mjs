// Admin browser traffic exclusively uses rollback-isolated API8001 / recruitment_cv_test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {withBrowser} from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.admin-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const checks=[];
await withBrowser(null,async({send,evaluate,until,fill,click,requests})=>{
  const section=async name=>{await evaluate(`([...document.querySelectorAll('.admin-sidebar nav button')].find(b=>b.textContent===${JSON.stringify(name)})).click()`);await until('!!document.querySelector("#admin-query")&&!document.querySelector(".admin-heading button").disabled');};
  const search=async text=>{await fill('#admin-query',text);await evaluate('document.querySelector(".admin-filters").requestSubmit()');await until('!document.querySelector(".admin-heading button").disabled');};
  const detail=async()=>{await click('Chi tiết');await until('!!document.querySelector("dialog .admin-detail")');};
  const close=async()=>{await evaluate('document.querySelector("dialog button[aria-label]").click()');await until('!document.querySelector("dialog")');};
  const select=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await send('Page.navigate',{url:'http://localhost:3000/admin/sign-in'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email',env.BROWSER_ADMIN_EMAIL);await fill('#auth-password',env.BROWSER_ADMIN_PASSWORD);await evaluate('document.querySelector("form").requestSubmit()');
  await until('!!document.querySelector(".admin-stats")');assert(await evaluate('[...document.querySelectorAll(".admin-stats strong")].some(e=>Number(e.textContent)>=12)'));checks.push('Admin dashboard reads real fixture counts');
  await section('Tài khoản');assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'),10);
  await click('Trang sau');await until('document.body.innerText.includes("Trang 2")&&!document.querySelector(".admin-heading button").disabled');
  await search('E8 Candidate 00');await detail();await click('Vô hiệu hóa tài khoản');await click('Xác nhận trạng thái');await until('!document.querySelector("dialog")&&document.querySelector("tbody")?.innerText.includes("Vô hiệu hóa")');
  await detail();await click('Kích hoạt tài khoản');await click('Xác nhận trạng thái');await until('!document.querySelector("dialog")&&document.querySelector("tbody")?.innerText.includes("Hoạt động")');
  checks.push('Account pagination/search and confirmed DISABLED/ACTIVE updates persist in MySQL');
  await search(env.BROWSER_ADMIN_EMAIL);await detail();assert(!await evaluate('document.querySelector("dialog").innerText.includes("Vô hiệu hóa tài khoản")'));await close();
  await section('Ứng viên');await search('E8 Candidate 00');await detail();assert(!await evaluate('document.querySelector("dialog").innerText.includes("Tải CV")'));await close();checks.push('ADMIN cannot edit its own status; Candidate detail exposes no private CV action');
  for(const title of ['Ngành nghề','Kỹ năng']){
    const name='Recovery '+randomBytes(8).toString('hex');await section(title);await click('Thêm danh mục');await until('!!document.querySelector("#catalog-name")');await fill('#catalog-name',name);await click('Lưu danh mục');await until('!document.querySelector("dialog")&&!document.querySelector(".admin-heading button").disabled');
    await search(name);await detail();await click('Sửa danh mục');await until('!!document.querySelector("#catalog-name")');await select('#catalog-status','INACTIVE');await click('Lưu danh mục');await until('!document.querySelector("dialog")&&document.querySelector("tbody")?.innerText.includes("Ngừng hoạt động")');
    await click('Thêm danh mục');await until('!!document.querySelector("#catalog-name")');await fill('#catalog-name',name);await click('Lưu danh mục');await until('!!document.querySelector("dialog [role=alert]")');assert.equal(await evaluate('document.querySelector("#catalog-name").value'),name);await close();
    checks.push(title+' create/inactivate/duplicate validation uses real API');
  }
  await section('Doanh nghiệp');await select('#admin-status','PENDING');await search('');await detail();await click('Duyệt doanh nghiệp');await click('Xác nhận');await until('!document.querySelector("dialog")&&document.body.innerText.includes("Đã phê duyệt.")&&!document.querySelector(".admin-heading button").disabled');checks.push('Company moderation is confirmed and saved to MySQL');
  await section('Tin tuyển dụng');await select('#admin-status','PENDING');await search('');await detail();await click('Từ chối tin');assert(await evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Xác nhận").disabled'));await fill('#admin-reason','Rollback-only browser review');await click('Xác nhận');await until('!document.querySelector("dialog")&&document.body.innerText.includes("Đã từ chối.")&&!document.querySelector(".admin-heading button").disabled');checks.push('Job rejection requires a reason and persists through real API');
  await section('Gói doanh nghiệp');await detail();assert(!await evaluate('[...document.querySelectorAll("dialog button")].some(b=>b.textContent.includes("Lưu")||b.textContent.includes("Sửa"))'));await close();
  assert(!requests.some(r=>r.method==='DELETE'));checks.push('Packages remain read-only and no hard-delete API is called');
},{mysqlTest:true});
console.log(JSON.stringify({status:'PASS',checks},null,2));
