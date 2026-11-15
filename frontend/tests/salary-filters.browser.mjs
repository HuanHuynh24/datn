// Controlled UI/HTTP contract tests. Salary SQL is covered by the real MySQL suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
const checks=[];
const catalog={industries:[{id:'91',name:'Công nghệ'}],provinces:[{id:'92',name:'Hà Nội'}],skills:Array.from({length:200},(_,i)=>({id:String(i+100),name:'Skill '+i})),wards:[],work_types:['Full-time','Part-time']};
const job={id:'94',title:'Range filter consumer',company_id:'95',company_name:'Consumer Company',industry_id:'91',industry_name:'Công nghệ',province_id:'92',province_name:'Hà Nội',description:null,requirements:null,minimum_salary:'12000000',maximum_salary:'18000000',work_type:'Full-time',application_deadline:null,status:'APPROVED',created_at:'2026-11-15T00:00:00Z',skills:[]};
const folder=new URL('../../.local-backups/jobs-salary-filter/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
await withBrowser(async(url,request)=>{
  assert.equal(request.method,'GET');
  if(url.pathname==='/api/v1/job-catalog')return {body:catalog};
  if(url.pathname==='/api/v1/jobs')return {body:{items:[job],total:60,limit:15,offset:Number(url.searchParams.get('offset'))}};
  throw new Error('Unexpected request '+url.pathname);
},async({send,evaluate,until,requests})=>{
  async function navigate(query=''){await send('Page.navigate',{url:'http://localhost:3000/jobs'+query});await until('!!document.querySelector(".cl-results-grid")');}
  async function open(text){await evaluate(`[...document.querySelectorAll('.cl-filter-trigger')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);await until('!!document.querySelector(".search-filter-form")');}
  async function choose(value){await evaluate(`document.querySelector(${JSON.stringify('input[name="salary_range"][value="'+value+'"]')}).click()`);}
  async function apply(expected={}){await evaluate('document.querySelector(".search-filter-form").requestSubmit()');await until(`${JSON.stringify(Object.entries(expected))}.every(([key,value])=>new URLSearchParams(location.search).get(key)===value)&&!document.querySelector(".search-filter-form")&&!!document.querySelector(".cl-results-grid")`);}
  const lastQuery=()=>new URLSearchParams(requests.filter(r=>r.path==='/api/v1/jobs').at(-1).query);
  async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(name+'.png',folder),Buffer.from(s.data,'base64'));}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('?keyword=Python&province_id=92&page=3');
  assert.equal(await evaluate('document.querySelectorAll(".cl-filter-trigger").length'),4);
  assert(!await evaluate('[...document.querySelectorAll(".cl-filter-trigger")].some(e=>e.textContent.includes("Kỹ năng"))'));
  await open('Mức lương');assert.equal(await evaluate('document.querySelectorAll("input[name=salary_range]").length'),7);
  await until('getComputedStyle(document.querySelector(".job-salary-options label")).display==="flex"');
  assert(await evaluate('(()=>{const e=document.querySelector(".job-salary-options .search-filter-options");return e.clientHeight>=e.scrollHeight})()'));
  const calls=requests.length;await choose('10to15');assert.equal(requests.length,calls);assert(!await evaluate('location.search.includes("minimum_salary")'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector(".search-filter-form")');await open('Mức lương');
  assert(await evaluate('document.querySelector("input[name=salary_range][value=\\"\\"]").checked'));
  checks.push('Four concise filters, no skill list; salary is draft until Apply and closing discards edits');
  await choose('10to15');await shot('desktop-salary');await apply({minimum_salary:'10000000',maximum_salary:'15000000'});
  assert.equal(lastQuery().get('minimum_salary'),'10000000');assert.equal(lastQuery().get('maximum_salary'),'15000000');assert.equal(lastQuery().get('offset'),'0');assert.equal(lastQuery().get('q'),'Python');assert.equal(lastQuery().get('province_id'),'92');
  checks.push('Preset submits both salary bounds, resets page and preserves keyword/province');
  for(const [value,min,max] of [['upto10',null,'10000000'],['15to20','15000000','20000000'],['20to30','20000000','30000000'],['30to50','30000000','50000000'],['50plus','50000000',null]]){
    await open('Mức lương');await choose(value);await apply({minimum_salary:min,maximum_salary:max});assert.equal(lastQuery().get('minimum_salary'),min);assert.equal(lastQuery().get('maximum_salary'),max);
  }
  checks.push('All salary presets correctly replace both bounds including upper-only/lower-only ranges');
  await open('Hình thức làm việc');assert.equal(await evaluate('document.querySelectorAll("input[name=work_type]").length'),3);
  await evaluate('document.querySelector("input[name=work_type][value=\\"Part-time\\"]").click()');await shot('desktop-work-type');await apply({work_type:'Part-time'});
  assert.equal(lastQuery().get('work_type'),'Part-time');assert.equal(lastQuery().get('minimum_salary'),'50000000');
  await evaluate('document.querySelector("button[aria-label=\\"Bỏ lọc Mức lương\\"]").click()');await until('!location.search.includes("minimum_salary")&&!!document.querySelector(".cl-results-grid")');
  assert(!lastQuery().has('minimum_salary')&&!lastQuery().has('maximum_salary'));assert.equal(lastQuery().get('work_type'),'Part-time');
  checks.push('Real-catalog work types are independent; removing salary clears both bounds and keeps work type');
  await navigate('?minimum_salary=12345678&work_type=OldType');await open('Mức lương');
  assert(await evaluate('document.querySelector("input[name=salary_range][value=\\"custom\\"]").checked'));await apply();assert.equal(lastQuery().get('minimum_salary'),'12345678');
  checks.push('Legacy arbitrary salary links remain visible and retain their actual query');
  await navigate('?skill_id=123&keyword=Python&page=2');await until('!location.search.includes("skill_id")&&!location.search.includes("page=")&&!!document.querySelector(".cl-results-grid")');
  assert(requests.filter(r=>r.path==='/api/v1/jobs').every(r=>!new URLSearchParams(r.query).has('skill_id')));
  checks.push('Legacy skill URL is cleaned without applying a hidden skill filter');
  for(const width of [390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:true});await navigate();await evaluate('document.querySelector(".cl-mobile-filter-button").click()');await until('!!document.querySelector("dialog[open]")');
    assert(!await evaluate('!!document.querySelector("dialog input[name=skill_id]")'));
    assert(await evaluate('(()=>{const rows=[...document.querySelectorAll("dialog .job-salary-options label")].map(e=>e.getBoundingClientRect());return rows.every((r,i)=>!i||r.top>=rows[i-1].bottom)})()'));
    await choose('20to30');await evaluate('document.querySelector("dialog input[name=work_type][value=\\"Full-time\\"]").click()');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot('mobile-'+width);
    await evaluate('document.querySelector("dialog form").requestSubmit()');await until('location.search.includes("maximum_salary=30000000")&&location.search.includes("work_type=Full-time")&&!document.querySelector("dialog[open]")&&!!document.querySelector(".cl-results-grid")');
    assert.equal(lastQuery().get('minimum_salary'),'20000000');assert.equal(lastQuery().get('maximum_salary'),'30000000');assert.equal(lastQuery().get('work_type'),'Full-time');
  }
  checks.push('Mobile320/390 offers the same salary/work-type radio filters and applies them together without overflow');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled salary filter consumers, no database writes',checks},null,2));
