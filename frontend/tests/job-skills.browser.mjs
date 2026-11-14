// Controlled API contract checks; no request writes to a real database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const checks=[];const writes=[];let rejectSave=false,approval='APPROVED';
const catalog={industries:[{id:'91',name:'Công nghệ'}],provinces:[{id:'92',name:'Hà Nội'}],wards:[],skills:[{id:'93',name:'Python'},{id:'94',name:'SQL'}]};
let job={id:'31',title:'Tin kiểm thử kỹ năng',company_id:'45',company_name:'Công ty kiểm thử',industry_id:'91',industry_name:'Công nghệ',province_id:'92',province_name:'Hà Nội',description:null,requirements:null,ward_id:null,street:null,level:null,minimum_salary:null,maximum_salary:null,years_experience:null,work_type:null,application_deadline:null,status:'DRAFT',created_at:'2026-11-14T00:00:00Z',skills:[]};
const folder=new URL('../../.local-backups/job-skills/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
await withBrowser(async(url,request)=>{
  const p=url.pathname;
  if(p==='/api/v1/auth/login')return {body:{access_token:'skills-consumer-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'46',role:'COMPANY_MEMBER',company_id:'45',internal_role:'OWNER',company_approval_status:approval}};
  if(p==='/api/v1/companies/me')return {body:{company_id:'45',company_name:'Công ty kiểm thử',approval_status:approval,active_member_count:1,package:{name:'Gói kiểm thử',member_limit:5}}};
  if(p==='/api/v1/job-catalog')return {body:catalog};
  if(p==='/api/v1/companies/me/jobs/31'&&request.method==='GET')return {body:job};
  if((p==='/api/v1/companies/me/jobs'&&request.method==='POST')||(p==='/api/v1/companies/me/jobs/31'&&request.method==='PATCH')){
    const body=JSON.parse(request.postData);writes.push(body);
    assert(!Object.keys(body).some(key=>key.startsWith('skill_')),'UI-only fields leaked');
    assert(body.skills.every(skill=>typeof skill.required==='boolean'&&Number.isInteger(skill.priority)));
    if(rejectSave)return {status:503,body:{detail:'Unavailable'}};
    job={...job,...body,status:'DRAFT',skills:body.skills.map(skill=>({...skill,name:catalog.skills.find(item=>item.id===skill.skill_id)?.name??'Kỹ năng cũ'}))};
    return {status:request.method==='POST'?201:200,body:job};
  }
  throw new Error('Unexpected request '+request.method+' '+p);
},async({send,evaluate,until,fill,click})=>{
  async function login(path){
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?'+new URLSearchParams({audience:'recruiter',next:path})});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email','skills@example.com');await fill('#auth-password','Consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
    await until(`location.pathname===${JSON.stringify(path)}&&!!document.querySelector('.actor-job-editor')`);
  }
  async function select(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  async function add(id){await select('#job-skills',id);await until(`!!document.querySelector('[data-skill-id="${id}"]')`);}
  async function saved(created=false){await click('Lưu tin nháp');await until(created?'location.pathname==="/recruiter/jobs/31/edit"&&!!document.querySelector(".actor-job-editor")':'!document.querySelector(".actor-job-editor fieldset").disabled&&document.body.innerText.includes("Đã lưu tin nháp")');}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await login('/recruiter/jobs/new');await fill('#job-title','Tin kiểm thử kỹ năng');await select('#job-industry','91');await select('#job-province','92');
  await add('93');await evaluate('document.querySelector("[name=skill_required_93]").click()');await fill('#skill-priority-93','7');await add('94');
  assert(await evaluate('document.querySelector("#skill-priority-94").value==="0"&&!document.querySelector("[name=skill_required_94]").checked'));
  assert(!await evaluate('!!document.querySelector("#job-skills option[value=\\"93\\"]")'));
  checks.push('New skills default false/0, selected options cannot duplicate');
  await saved(true);
  assert.deepEqual(writes.at(-1).skills,[{skill_id:'93',required:true,priority:7},{skill_id:'94',required:false,priority:0}]);
  checks.push('Create serializes typed required/priority without UI-only fields');
  await login('/recruiter/jobs/31/edit');
  assert(await evaluate('document.querySelector("#skill-priority-93").value==="7"&&document.querySelector("[name=skill_required_93]").checked'));
  checks.push('Fresh editor restores saved per-skill values');
  for(const value of ['-1','0.5','2147483648','']){
    await fill('#skill-priority-93',value);const before=writes.length;await evaluate('document.querySelector(".actor-job-editor").requestSubmit()');
    assert(!await evaluate('document.querySelector("#skill-priority-93").checkValidity()'));assert.equal(writes.length,before);
  }
  checks.push('Negative, fractional, overflow and empty priorities block submission');
  await fill('#skill-priority-93','2147483647');await evaluate('document.querySelector("[name=skill_required_93]").click()');
  await evaluate('document.querySelector("button[aria-label=\\"Bỏ kỹ năng SQL\\"]").click()');await saved();
  assert.deepEqual(writes.at(-1).skills,[{skill_id:'93',required:false,priority:2147483647}]);
  checks.push('Edit toggles required, accepts INT max and removes unselected skill');
  await fill('#skill-priority-93','12');rejectSave=true;await click('Lưu tin nháp');await until('!!document.querySelector(".ui-notice-error")');
  assert(await evaluate('document.querySelector("#skill-priority-93").value==="12"'));
  assert(!await evaluate('document.body.innerText.includes("Đã lưu tin nháp")'));
  rejectSave=false;await saved();checks.push('Failed save preserves edits, shows no fake success; retry sends same values');
  job.skills.push({skill_id:'95',name:'Kỹ năng cũ',required:true,priority:8});await login('/recruiter/jobs/31/edit');await saved();
  assert(writes.at(-1).skills.some(skill=>skill.skill_id==='95'&&skill.required&&skill.priority===8));
  checks.push('Inactive referenced skill stays editable and survives unrelated save');
  for(const width of [390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:true});await evaluate('document.fonts.ready');
    await evaluate('document.querySelector(".job-skills-field").scrollIntoView({block:"center"})');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL('skills-'+width+'.png',folder),Buffer.from(shot.data,'base64'));
  }
  checks.push('Skill editor fits mobile 390px and 320px');
  await evaluate('document.querySelector("button[aria-label=\\"Bỏ kỹ năng Kỹ năng cũ\\"]").click()');
  assert(!await evaluate('!!document.querySelector("#job-skills option[value=\\"95\\"]")'));
  await evaluate('document.querySelector("button[aria-label=\\"Bỏ kỹ năng Python\\"]").click()');await saved();assert.deepEqual(writes.at(-1).skills,[]);
  checks.push('Removed inactive skill cannot be newly selected; clearing sends empty skills');
  job.status='CLOSED';await login('/recruiter/jobs/31/edit');assert(await evaluate('document.querySelector(".actor-job-editor>fieldset").disabled'));
  checks.push('Closed job disables every skill editing control');
  await evaluate('document.querySelector(".site-menu-toggle").click()');await until('!!document.querySelector("#site-mobile-navigation")');
  assert(!await evaluate('!!document.querySelector("a[href=\\"/recruiter/talent-search\\"],a[href=\\"/recruiter/recommended\\"]")'));
  checks.push('Employer mobile navigation exposes active modules only');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled consumer; no database writes',checks},null,2));
