// Direct read-only Development browser/API comparison. No fixtures or writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
const checks=[];
await withBrowser(()=>{throw new Error('Expected direct API reads')},async({send,evaluate,until})=>{
  await send('Fetch.disable');await send('Page.navigate',{url:'http://localhost:3000/jobs'});
  await until('!!document.querySelector(".cl-results-grid")');
  await evaluate('[...document.querySelectorAll(".cl-filter-trigger")].find(e=>e.textContent.includes("Mức lương")).click()');
  await until('!!document.querySelector("input[name=salary_range]")');
  await evaluate('document.querySelector("input[name=salary_range][value=\\"10to15\\"]").click();document.querySelector(".search-filter-form").requestSubmit()');
  await until('location.search.includes("maximum_salary=15000000")&&!!document.querySelector(".cl-results-grid,.cl-results-empty:not([role])")');
  async function compare(query){
    const r=await fetch('http://localhost:8000/api/v1/jobs?limit=15&offset=0&sort=newest&'+query);assert(r.ok);const result=await r.json();
    const ids=await evaluate('[...document.querySelectorAll(".cl-results-grid [data-job-id]")].map(e=>e.dataset.jobId)');
    assert.deepEqual(ids,result.items.map(item=>item.id));
    for(const item of result.items){
      const lower=Number(item.minimum_salary??item.maximum_salary),upper=Number(item.maximum_salary??item.minimum_salary);
      assert((item.minimum_salary!==null||item.maximum_salary!==null)&&lower<=15000000&&upper>=10000000);
    }
    return result;
  }
  await compare('minimum_salary=10000000&maximum_salary=15000000');checks.push('Actual UI salary results match MySQL API page and overlap10–15M');
  const catalog=await(await fetch('http://localhost:8000/api/v1/job-catalog')).json();
  await evaluate('[...document.querySelectorAll(".cl-filter-trigger")].find(e=>e.textContent.includes("Hình thức làm việc")).click()');
  await until('!!document.querySelector("input[name=work_type]")');
  assert.deepEqual(await evaluate('[...document.querySelectorAll("input[name=work_type]")].map(e=>e.value).filter(Boolean)'),catalog.work_types);
  checks.push('Work-type radio choices come from actual visible MySQL jobs');
  if(catalog.work_types.length){
    await evaluate('document.querySelectorAll("input[name=work_type]")[1].click();document.querySelector(".search-filter-form").requestSubmit()');
    await until('location.search.includes("work_type=")&&!!document.querySelector(".cl-results-grid,.cl-results-empty:not([role])")');
    await compare(new URLSearchParams({minimum_salary:'10000000',maximum_salary:'15000000',work_type:catalog.work_types[0]}));
    checks.push('Combined salary/work-type results match actual MySQL API');
  }
},{debugPort:9236});
console.log(JSON.stringify({status:'PASS',kind:'Direct read-only Development API/browser',checks},null,2));
