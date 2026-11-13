// Read-only live API checks and screenshots for the Jobs UI sample.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
const folder=new URL('../../.local-backups/job-search-ui/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const stage=process.argv.includes('--before')?'before':'after';
const checks=[];
await withBrowser(async(url,request)=>{
  assert.equal(request.method,'GET');
  const response=await fetch('http://localhost:8000'+url.pathname+url.search);
  return {status:response.status,body:await response.json()};
},async({send,evaluate,until})=>{
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    await send('Page.navigate',{url:'http://localhost:3000/jobs'});
    await until('!!document.querySelector(".cl-results-grid")');
    if(stage==='after')await until('getComputedStyle(document.querySelector(".cl-job-compact")).display==="flex"');
    await evaluate('document.fonts.ready');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal overflow at '+width);
    assert(await evaluate('document.querySelectorAll("[data-job-id]").length>0'));
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    fs.writeFileSync(new URL(stage+'-'+width+'.png',folder),Buffer.from(screenshot.data,'base64'));
    checks.push('Real API results render without horizontal overflow at '+width+'px');
    if(stage==='after'){
      const id=await evaluate('document.querySelector("[data-job-id]").dataset.jobId');
      await evaluate('document.querySelector(".cl-results-grid .cl-job-title button").scrollIntoView({block:"center"})');
      const point=await evaluate('(()=>{const e=document.querySelector(".cl-results-grid .cl-job-title button");const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y))}})()');
      assert(point.hit,'Detail action is covered');
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      await until(`location.pathname==='/jobs/${id}'`);
      assert.equal(new URLSearchParams(await evaluate('location.search')).get('returnTo'),'/jobs');
      checks.push('Native detail action preserves return path at '+width+'px');
    }
  }
  if(stage==='after'){
    await send('Page.navigate',{url:'http://localhost:3000/'});
    await until('!!document.querySelector(".cl-job-compact")');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".cl-job-compact")).display'),'flex');
    assert(!await evaluate('!!document.querySelector(".jobs-ui-sample")'));
    checks.push('Shared homepage cards keep their original layout');
  }
});
console.log(JSON.stringify({status:'PASS',stage,checks},null,2));
