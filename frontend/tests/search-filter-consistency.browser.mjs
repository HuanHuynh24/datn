// Controlled HTTP consumer checks; no writes reach MySQL.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
const catalog={industries:[{id:'91',name:'Công nghệ'}],provinces:[{id:'92',name:'Hà Nội'}],skills:[{id:'93',name:'Python'}],wards:[]};
const job={id:'94',title:'Consumer Job',company_id:'95',company_name:'Consumer Company',industry_id:'91',industry_name:'Công nghệ',province_id:'92',province_name:'Hà Nội',street:null,ward_id:null,description:'Test',requirements:'Python',level:null,minimum_salary:null,maximum_salary:null,years_experience:null,work_type:'Full-time',application_deadline:null,status:'APPROVED',created_at:'2026-11-13T00:00:00Z',skills:[]};
const company={company_id:'95',company_name:'Consumer Company',industry:'Công nghệ',address:'Hà Nội',logo_url:null,open_job_count:1};
const checks=[];
await withBrowser(async(url,request)=>{
  assert.equal(request.method,'GET');
  if(url.pathname==='/api/v1/job-catalog')return {body:catalog};
  if(url.pathname==='/api/v1/companies/filters')return {body:{industries:['Công nghệ'],locations:['Hà Nội']}};
  if(url.pathname==='/api/v1/jobs')return {body:{items:[job],total:20,offset:Number(url.searchParams.get('offset')),limit:15}};
  if(url.pathname==='/api/v1/companies')return {body:{items:[company],total:20,offset:Number(url.searchParams.get('offset')),limit:12}};
  throw new Error('Unexpected route '+url.pathname);
},async({send,evaluate,until,fill,requests})=>{
  const navigate=async path=>{await send('Page.navigate',{url:'http://localhost:3000'+path});await until('!!document.querySelector(".cl-results-grid,[data-company-id]")');};
  const open=async text=>{await evaluate(`[...document.querySelectorAll('.cl-filter-trigger')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);await until('!!document.querySelector(".search-filter-form")');};
  const apply=()=>evaluate('document.querySelector(".search-filter-form").requestSubmit()');
  const escape=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector(".search-filter-form")');};
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('/jobs?keyword=Python&page=2');await open('Tỉnh/thành');
  let before=requests.length;
  await evaluate('document.querySelector("input[name=province_id][value]").click()');
  assert(!await evaluate('location.search.includes("province_id=")'));assert.equal(requests.length,before);
  await escape();await open('Tỉnh/thành');
  assert(!await evaluate('document.querySelector("input[name=province_id][value]").checked'));
  await evaluate('document.querySelector("input[name=province_id][value]").click()');await apply();
  await until('location.search.includes("province_id=92")&&!location.search.includes("page=")&&!!document.querySelector(".cl-results-grid")');
  assert(await evaluate('location.search.includes("keyword=Python")'));
  checks.push('Jobs draft sends no request; closing discards draft; Apply preserves keyword and resets page');
  await open('Tỉnh/thành');await evaluate('document.querySelector(".search-filter-actions button[type=button]").click()');
  await until('!location.search.includes("province_id=")&&!document.querySelector(".search-filter-form")');
  checks.push('Jobs explicit Clear removes only that filter and closes dropdown');
  await open('Lương & hình thức');before=requests.length;
  await fill('input[aria-label="Mức lương từ (VND)"]','1000');await fill('input[aria-label="Hình thức làm việc"]','Full-time');
  assert(await evaluate('document.querySelector(".search-filter-field input").getBoundingClientRect().width>150'));
  assert.equal(requests.length,before);await apply();
  await until('location.search.includes("minimum_salary=1000")&&location.search.includes("work_type=Full-time")&&!document.querySelector(".search-filter-form")');
  checks.push('Salary/work-type inputs have usable width and batch on explicit Apply');
  await navigate('/companies?q=Python&page=2');await open('Lĩnh vực');before=requests.length;
  await until('!!document.querySelector("input[name=industry][value]")');
  before=requests.length;await evaluate('document.querySelectorAll("input[name=industry]")[1].click()');assert(!await evaluate('location.search.includes("industry=")'));assert.equal(requests.length,before);
  await escape();await open('Lĩnh vực');assert(await evaluate('document.querySelector("input[name=industry]").checked'));
  await evaluate('document.querySelectorAll("input[name=industry]")[1].click()');await apply();
  await until('location.search.includes("industry=")&&!location.search.includes("page=")&&!!document.querySelector("[data-company-id]")');
  assert(await evaluate('location.search.includes("q=Python")'));
  checks.push('Companies draft follows the same close/discard/Apply and pagination behavior');
  for(const width of [390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});
    for(const path of ['/jobs','/companies']){
      await navigate(path);await evaluate('document.querySelector(".cl-mobile-filter-button").click()');await until('!!document.querySelector("dialog[open]")');
      before=requests.length;
      if(path==='/jobs'){
        await evaluate('document.querySelector("dialog input[name=province_id][value]").click();document.querySelector("dialog input[name=skill_id][value]").click()');
      }else{await until('document.querySelectorAll("dialog input[name=industry]").length>1');await evaluate('document.querySelectorAll("dialog input[name=industry]")[1].click();document.querySelectorAll("dialog input[name=location]")[1].click()');}
      assert.equal(requests.length,before);assert.equal(await evaluate('location.search'),'');
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      await evaluate('document.querySelector("dialog form").requestSubmit()');
      await until('!!location.search&&!document.querySelector("dialog[open]")');
      const applied=new URLSearchParams(await evaluate('location.search'));
      assert.equal(applied.get(path==='/jobs'?'province_id':'location'),path==='/jobs'?'92':'Hà Nội');
      assert.equal(applied.get(path==='/jobs'?'skill_id':'industry'),path==='/jobs'?'93':'Công nghệ');
    }
    checks.push('Both mobile filters batch conditions on Apply without overflow at '+width+'px');
  }
  await evaluate('document.querySelector(".cl-mobile-filter-button").click()');await until('!!document.querySelector("dialog[open]")');
  await evaluate('document.querySelector("dialog .search-filter-actions button[type=button]").click()');
  await until('!location.search&&!document.querySelector("dialog[open]")');
  checks.push('Mobile Clear all closes dialog and clears applied conditions');
  await navigate('/jobs');await evaluate('document.querySelector(".cl-mobile-filter-button").click()');await until('!!document.querySelector("dialog[open]")');
  await evaluate('document.querySelector("dialog .search-filter-actions button[type=button]").click()');
  await until('!document.querySelector("dialog[open]")&&!location.search');
  checks.push('Jobs Clear all also closes dialog when URL was already empty');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled filter interaction, no database writes',checks},null,2));
