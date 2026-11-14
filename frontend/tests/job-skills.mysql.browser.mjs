// Requires the existing isolated API8001 fixture. All writes roll back on teardown.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const loginResponse=await fetch('http://localhost:8001/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:env.BROWSER_EMPLOYER_EMAIL,password:env.BROWSER_EMPLOYER_PASSWORD})});
assert(loginResponse.ok,'Test employer login failed');
const headers={Authorization:'Bearer '+(await loginResponse.json()).access_token};
const catalogResponse=await fetch('http://localhost:8001/api/v1/job-catalog',{headers});assert(catalogResponse.ok);
const catalog=await catalogResponse.json();assert(catalog.skills.length&&catalog.industries.length&&catalog.provinces.length);
const skillId=catalog.skills[0].id;const checks=[];
await withBrowser(null,async({send,evaluate,until,fill,click,responses})=>{
  async function login(path){
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?'+new URLSearchParams({audience:'recruiter',next:path})});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email',env.BROWSER_EMPLOYER_EMAIL);await fill('#auth-password',env.BROWSER_EMPLOYER_PASSWORD);await evaluate('document.querySelector("form").requestSubmit()');
    await until(`location.pathname===${JSON.stringify(path)}&&!!document.querySelector('.actor-job-editor')`);
  }
  async function select(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  async function read(id){const r=await fetch('http://localhost:8001/api/v1/companies/me/jobs/'+id,{headers});assert(r.ok);return r.json();}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await login('/recruiter/jobs/new');await fill('#job-title','MySQL UI skills rollback test');
  await select('#job-industry',catalog.industries[0].id);await select('#job-province',catalog.provinces[0].id);await select('#job-skills',skillId);
  await until(`!!document.querySelector('#skill-priority-${skillId}')`);
  await evaluate(`document.querySelector('[name="skill_required_${skillId}"]').click()`);await fill('#skill-priority-'+skillId,'3');await click('Lưu tin nháp');
  await until('/^\\/recruiter\\/jobs\\/[0-9]+\\/edit$/.test(location.pathname)&&!!document.querySelector(".actor-job-editor")');
  const path=await evaluate('location.pathname');const id=path.split('/')[3];
  let job=await read(id);assert.equal(job.status,'DRAFT');assert.equal(job.skills.length,1);assert.equal(job.skills[0].skill_id,skillId);assert.equal(job.skills[0].required,true);assert.equal(job.skills[0].priority,3);
  assert(responses.some(r=>r.path==='/api/v1/companies/me/jobs'&&r.status===201));
  checks.push('Create UI sends real catalog IDs; MySQL returns required=true, priority=3');
  await login(path);assert(await evaluate(`document.querySelector('#skill-priority-${skillId}').value==='3'&&document.querySelector('[name="skill_required_${skillId}"]').checked`));
  checks.push('Fresh login reloads persisted MySQL skill settings');
  await fill('#skill-priority-'+skillId,'5');await evaluate(`document.querySelector('[name="skill_required_${skillId}"]').click()`);await click('Lưu tin nháp');await until('document.body.innerText.includes("Đã lưu tin nháp")');
  job=await read(id);assert.equal(job.skills[0].required,false);assert.equal(job.skills[0].priority,5);
  checks.push('Edit UI persists required=false, priority=5 through MySQL PATCH');
  await login(path);const before=responses.filter(r=>r.path.endsWith('/jobs/'+id)&&r.status===200).length;
  await fill('#skill-priority-'+skillId,'-1');await evaluate('document.querySelector(".actor-job-editor").requestSubmit()');
  assert(!await evaluate('document.querySelector(".actor-job-editor").checkValidity()'));job=await read(id);assert.equal(job.skills[0].priority,5);
  assert.equal(responses.filter(r=>r.path.endsWith('/jobs/'+id)&&r.status===200).length,before);
  checks.push('Invalid priority cannot mutate the persisted MySQL value');
  await evaluate('document.querySelector(".job-skill-row button").click()');await click('Lưu tin nháp');await until('document.body.innerText.includes("Đã lưu tin nháp")');
  job=await read(id);assert.deepEqual(job.skills,[]);checks.push('Removing all skills persists empty relationship set');
},{mysqlTest:true});
console.log(JSON.stringify({status:'PASS',target:'API8001 isolated MySQL fixture; outer rollback',checks},null,2));
