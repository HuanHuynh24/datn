// Direct read-only comparison against the same actual MySQL job across public pages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
const job=(await(await fetch('http://localhost:8000/api/v1/jobs?limit=1')).json()).items[0];
assert(job,'Requires a public Development job');
const folder=new URL('../../.local-backups/shared-job-cards/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const checks=[];
await withBrowser(()=>{throw new Error('Unexpected intercepted request')},async({send,evaluate,until})=>{
  await send('Fetch.disable');
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    let baseline;
    for(const [name,path] of [['home','/'],['jobs','/jobs'],['company','/companies/'+job.company_id]]){
      await send('Page.navigate',{url:'http://localhost:3000'+path});
      const selector=JSON.stringify(`[data-job-id="${job.id}"]`);
      await until(`[...document.querySelectorAll(${selector})].some(e=>e.getBoundingClientRect().width>0)`);
      await evaluate('document.fonts.ready');
      const shape=await evaluate(`(()=>{const card=[...document.querySelectorAll(${selector})].find(e=>e.getBoundingClientRect().width>0);const sample=(element,keys)=>{const s=getComputedStyle(element);return Object.fromEntries(keys.map(k=>[k,s[k]]))};return {card:sample(card,['display','height','padding','borderRadius','borderTopWidth','borderTopColor','backgroundColor','columnGap']),logo:sample(card.querySelector('.cl-job-logo'),['width','height','padding','borderRadius']),title:sample(card.querySelector('.cl-job-title'),['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing']),company:sample(card.querySelector('.cl-job-company'),['fontFamily','fontSize','color']),salary:sample(card.querySelector('.cl-job-salary'),['fontFamily','fontSize','fontWeight','color']),meta:sample(card.querySelector('.cl-job-meta'),['fontSize','color'])}})()`);
      assert.equal(shape.card.display,'flex');
      if(name==='home')baseline=shape;
      else{assert.deepEqual(shape,baseline,name+' differs from homepage at '+width);checks.push(name+' card matches homepage dimensions, logo, typography, salary and border at '+width+'px');}
      const overflow=await evaluate('({scroll:document.documentElement.scrollWidth,viewport:innerWidth,outside:[...document.querySelectorAll("main *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,5).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))})');
      assert(overflow.scroll<=overflow.viewport,name+' overflow at '+width+': '+JSON.stringify(overflow));
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(name+'-'+width+'.png',folder),Buffer.from(shot.data,'base64'));
    }
    checks.push('Public job-card pages fit viewport at '+width+'px');
  }
},{debugPort:9230});
console.log(JSON.stringify({status:'PASS',kind:'Direct read-only actual API/card style comparison',checks},null,2));
