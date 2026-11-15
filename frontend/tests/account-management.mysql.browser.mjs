// Existing API8001 isolated MySQL fixture; changed passwords roll back on teardown.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import {withBrowser} from './browser-consumer.mjs';
const env=Object.fromEntries(fs.readFileSync(new URL('../../.env.cv-browser',import.meta.url),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const checks=[];
await withBrowser(null,async({send,evaluate,until,fill,click})=>{
  async function login(employer,password){
    const prefix=employer?'EMPLOYER':'CANDIDATE';
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?'+new URLSearchParams({audience:employer?'recruiter':'candidate',next:employer?'/recruiter':'/jobs'})});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email',env['BROWSER_'+prefix+'_EMAIL']);await fill('#auth-password',password);await evaluate('document.querySelector("form").requestSubmit()');
    await until(`location.pathname===${JSON.stringify(employer?'/recruiter':'/jobs')}&&!!document.querySelector('.site-account-trigger')`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  for(const employer of [false,true]){
    const prefix=employer?'EMPLOYER':'CANDIDATE';const next=randomBytes(24).toString('base64url');
    await login(employer,env['BROWSER_'+prefix+'_PASSWORD']);await evaluate('document.querySelector(".site-account-trigger").click()');await click('Đổi mật khẩu');await until('!!document.querySelector("#account-current-password")');
    await fill('#account-current-password',env['BROWSER_'+prefix+'_PASSWORD']);await fill('#account-new-password',next);await fill('#account-confirm-password',next);await click('Lưu mật khẩu mới');
    await until('location.pathname==="/sign-in"&&document.body.innerText.includes("Đã đổi mật khẩu thành công")');
    const old=await fetch('http://localhost:8001/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:env['BROWSER_'+prefix+'_EMAIL'],password:env['BROWSER_'+prefix+'_PASSWORD']})});assert.equal(old.status,401);
    await login(employer,next);
    checks.push(prefix+' changes password through UI/MySQL, signs out, old password fails and new password logs in');
  }
},{mysqlTest:true});
console.log(JSON.stringify({status:'PASS',target:'MySQL API8001 fixture; outer rollback',checks},null,2));
