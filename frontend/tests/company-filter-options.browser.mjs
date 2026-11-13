// Controlled consumer responses verify catalog loading/error; no database writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
let mode='loading', releases=[], optionCalls=0,errorStatus=503;
const choices={industries:['Công nghệ','Giáo dục'],locations:['Hà Nội','Đà Nẵng']};
const checks=[];
const folder=new URL('../../.local-backups/company-filter-options/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
await withBrowser(async(url,request)=>{
  assert.equal(request.method,'GET');
  if(url.pathname==='/api/v1/companies/filters'){
    optionCalls++;
    if(mode==='loading')await new Promise(resolve=>releases.push(resolve));
    if(mode==='error')return {status:errorStatus,body:{detail:'Unavailable'}};
    return {body:mode==='empty'?{industries:[],locations:[]}:choices};
  }
  if(url.pathname==='/api/v1/companies')return {body:{items:[{company_id:'91',company_name:'Consumer Company',industry:'Công nghệ',address:'Hà Nội',logo_url:null,open_job_count:0}],total:1,limit:12,offset:0}};
  throw new Error('Unexpected API '+url.pathname);
},async({send,evaluate,until,requests})=>{
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:3000/companies'});
  await until('!!document.querySelector("[data-company-id]")');
  async function open(){await evaluate('[...document.querySelectorAll(".cl-filter-trigger")].find(b=>b.innerText.includes("Lĩnh vực")).click()');await until('!!document.querySelector(".company-filter-options")');}
  await open();await until('!!document.querySelector(".company-filter-options [role=status]")');
  assert(await evaluate('document.querySelector(".search-filter-actions button[type=submit]").disabled'));
  mode='ready';releases.forEach(resolve=>resolve());releases=[];
  await until('document.querySelectorAll("input[name=industry]").length===3');
  assert(!await evaluate('!!document.querySelector(".company-filter-options input:not([type=radio])")'));
  checks.push('Dropdown contains radio choices, with loading state and disabled Apply until options arrive');
  const calls=optionCalls;
  await evaluate('document.querySelectorAll("input[name=industry]")[2].click()');
  assert.equal(await evaluate('location.search'),'');
  await evaluate('document.querySelector(".search-filter-form").requestSubmit()');
  await until('location.search.includes("industry=")&&!document.querySelector(".search-filter-form")');
  assert.equal(new URLSearchParams(await evaluate('location.search')).get('industry'),'Giáo dục');
  assert(requests.some(r=>new URLSearchParams(r.query).get('industry')==='Giáo dục'));
  assert.equal(optionCalls,calls);
  checks.push('Choice absent from current results still applies as text; URL changes do not refetch choices');
  await open();const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL('desktop.png',folder),Buffer.from(shot.data,'base64'));
  for(const status of [503,422,404]){
    errorStatus=status;mode='error';await send('Page.reload');await until('!!document.querySelector("[data-company-id]")');await open();await until('!!document.querySelector(".company-filter-options [role=alert]")');
    assert(await evaluate('!!document.querySelector("[data-company-id]")&&document.querySelector(".search-filter-actions button[type=submit]").disabled'));
    assert(!await evaluate('document.querySelector(".company-filter-options [role=alert]").innerText.includes("khoảng lương")'));
    mode='ready';await evaluate('[...document.querySelectorAll(".company-filter-options button")].find(b=>b.innerText==="Thử tải lại bộ lọc").click()');
    await until('document.querySelectorAll("input[name=industry]").length===3');
    checks.push('HTTP'+status+' displays relevant error and retry recovers without losing results');
  }
  mode='empty';await send('Page.reload');await until('!!document.querySelector("[data-company-id]")');await open();await until('document.querySelector(".company-filter-options").innerText.includes("Chưa có lựa chọn")');
  assert.equal(await evaluate('document.querySelectorAll("input[name=industry]").length'),1);
  assert(await evaluate('document.querySelector(".company-filter-options").innerText.includes("Điều kiện từ liên kết")'));
  checks.push('Empty catalog has All plus guidance; existing text URLs remain readable without invented options');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled filter-options consumer',checks},null,2));
