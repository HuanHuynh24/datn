// Read-only Development profile. Dev compilation and polling affect page-ready samples.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {withBrowser} from './browser-consumer.mjs';
const stage=process.argv[2]??'current';assert(['before','after','current'].includes(stage));
const api=[];const pages=[];
for(const path of ['/api/v1/job-catalog','/api/v1/jobs?limit=15&offset=0&sort=newest','/api/v1/companies?limit=12&offset=0','/api/v1/companies/filters']){
  const samples=[];
  for(let i=0;i<3;i++){const start=performance.now();const r=await fetch('http://localhost:8000'+path);assert(r.ok,path);await r.arrayBuffer();samples.push(Math.round(performance.now()-start));}
  api.push({path,samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[1]});
}
await withBrowser(()=>{throw new Error('Expected direct read-only API')},async({send,evaluate,until})=>{
  await send('Fetch.disable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  for(const [path,selector] of [['/jobs','[data-job-id]'],['/companies','[data-company-id]']]){
    for(let i=0;i<3;i++){
      await send('Page.navigate',{url:'about:blank'});await until('location.href==="about:blank"');
      await send('Page.navigate',{url:'http://localhost:3000'+path});
      await until(`location.pathname===${JSON.stringify(path)}&&!!document.querySelector(${JSON.stringify(selector)})`);
      const readyMs=await evaluate('Math.round(performance.now())');
      await new Promise(resolve=>setTimeout(resolve,250));
      const requests=await evaluate(`performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/api/v1/')).map(r=>({path:new URL(r.name).pathname+new URL(r.name).search,startMs:Math.round(r.startTime),durationMs:Math.round(r.duration),endMs:Math.round(r.responseEnd)}))`);
      const scripts=await evaluate(`(()=>{const entries=performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script');return {count:entries.length,encodedBytes:entries.reduce((sum,r)=>sum+r.encodedBodySize,0)}})()`);
      pages.push({path,sample:i+1,readyMs,requests,scripts});
    }
  }
},{debugPort:9234});
const report={stage,environment:'Local Development; API GET only; uncached full page loads; page-ready polled at200ms; not a production benchmark',api,pages};
const folder=new URL('../../.local-backups/public-loading/',import.meta.url);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(new URL(stage+'.json',folder),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
