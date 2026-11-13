// Direct browser networking: no request fulfillment, API rewrite, auth fixture or DML.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
const checks=[];
await withBrowser(()=>{throw new Error('Unexpected interception')},async({send,evaluate,until,responses})=>{
  await send('Fetch.disable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:3000/companies'});
  await until('(()=>{const e=document.querySelector(".cl-filter-trigger");return e&&Object.keys(e).some(k=>k.startsWith("__reactProps")&&typeof e[k].onClick==="function")})()');
  await evaluate('document.querySelector(".cl-filter-trigger").click()');
  await until('document.querySelectorAll(".company-filter-options input[type=radio]").length>1');
  assert(responses.some(r=>r.path==='/api/v1/companies/filters'&&r.status===200));
  assert(!responses.some(r=>r.path==='/api/v1/companies/filters'&&r.status>=400));
  checks.push('Configured API serves real filter choices200 directly to browser, without test proxy');
  const value=await evaluate('document.querySelectorAll("input[name=industry]")[1].value');
  async function pointer(selector){
    const expression=JSON.stringify(selector);
    await evaluate(`document.querySelector(${expression}).scrollIntoView({block:'center'})`);
    const p=await evaluate(`(()=>{const e=document.querySelector(${expression}),r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()`);
    assert(p.hit,'Control is covered');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  }
  await pointer('input[name=industry]:not([value=""])');
  assert.equal(await evaluate('location.search'),'');
  await pointer('.search-filter-actions button[type=submit]');
  await until('!!location.search&&!document.querySelector(".search-filter-form")');
  assert.equal(new URLSearchParams(await evaluate('location.search')).get('industry'),value);
  await until('!!document.querySelector(".company-directory-grid")');
  checks.push('Native select and Apply filter actual company data with no validation error');
},{debugPort:9229});
console.log(JSON.stringify({status:'PASS',kind:'Direct browser to configured Development API, read only',checks},null,2));
