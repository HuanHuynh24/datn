import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const data=await(await fetch('http://localhost:8000/api/v1/jobs?limit=1')).json();
const id=data.items[0].id;
const checks=[];
const folder=new URL('../../.local-backups/apply-cta/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
await withBrowser(async(url,request)=>{
  assert.equal(request.method,'GET');const response=await fetch('http://localhost:8000'+url.pathname+url.search);return {status:response.status,body:await response.json()};
},async({send,evaluate,until})=>{
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  await send('Page.navigate',{url:'http://localhost:3000/jobs/'+id});
  await until(`!!document.querySelector('.ui-job-hero a[href^="/sign-in?"]')`);
  await evaluate(`document.querySelector('.ui-job-hero a[href^="/sign-in?"]').scrollIntoView({block:'center'})`);
  const hit=await evaluate(`(()=>{const e=document.querySelector('.ui-job-hero a[href^="/sign-in?"]');const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,visible:r.width>0&&r.height>0,clickable:e.contains(document.elementFromPoint(x,y))}})()`);
  assert(hit.visible&&hit.clickable,'CTA hidden or covered at '+width);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:hit.x,y:hit.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hit.x,y:hit.y,button:'left',clickCount:1});
  await until('location.pathname==="/sign-in"');
  assert.equal(new URLSearchParams(await evaluate('location.search')).get('next'),'/jobs/'+id+'?intent=apply');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(width+'.png',folder),Buffer.from(screenshot.data,'base64'));
  checks.push('Visible native-click CTA opens sign-in with job context at '+width+'px');
 }
});
console.log(JSON.stringify({status:'PASS',kind:'Read-only native pointer checks',checks},null,2));
