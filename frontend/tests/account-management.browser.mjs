// Controlled account UI consumers. No SMTP connection or database writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
let role='CANDIDATE',changeStatus=400,mailStatus=503,actionStatus=400;const writes=[],checks=[];
await withBrowser(async(url,request)=>{
  const p=url.pathname;
  if(request.method==='POST')writes.push({path:p,body:request.postData?JSON.parse(request.postData):null});
  if(p==='/api/v1/auth/login')return {body:{access_token:'account-consumer-only',expires_in:1800}};
  if(p==='/api/v1/auth/me')return {body:{account_id:'46',role,company_id:role==='COMPANY_MEMBER'?'45':null,internal_role:role==='COMPANY_MEMBER'?'OWNER':null}};
  if(p==='/api/v1/candidates/me/profile')return {body:{account_id:'46',candidate_id:'47',full_name:'Account Consumer',email:'consumer@example.com'}};
  if(p==='/api/v1/companies/me')return {body:{company_id:'45',company_name:'Account Consumer Company',approval_status:'APPROVED',active_member_count:1,package:{name:'Test',member_limit:5}}};
  if(p==='/api/v1/auth/account')return {body:{email:'consumer@example.com',email_verified:false}};
  if(p==='/api/v1/auth/change-password'){
    assert(Object.entries(request.headers).some(([key])=>key.toLowerCase()==='authorization'));
    return {status:changeStatus,body:changeStatus===200?{message:'Password changed. Sign in again.'}:{detail:'Unavailable'}};
  }
  if(p==='/api/v1/auth/email-verification/request')return {status:mailStatus,body:{message:'Accepted'}};
  if(p==='/api/v1/auth/password-reset/request'){
    assert(!Object.keys(request.headers).some(key=>key.toLowerCase()==='authorization'));
    return {status:mailStatus,body:mailStatus===202?{message:'Accepted'}:{detail:'Unavailable'}};
  }
  if(p.endsWith('/confirm'))return {status:actionStatus,body:actionStatus===200?{message:'Done'}:{detail:'Invalid link'}};
  if(p==='/api/v1/job-catalog')return {body:{industries:[],provinces:[],wards:[],skills:[],work_types:[]}};
  if(p==='/api/v1/jobs')return {body:{items:[],total:0,limit:15,offset:0}};
  if(p==='/api/v1/companies/me/jobs')return {body:{items:[],total:0,limit:1,offset:0}};
  if(p==='/api/v1/admin/dashboard')return {body:{accounts:1,candidates:0,companies:0,jobs:0,applications:0,cvs:0,industries:0,skills:0,packages:0,accounts_by_status:{ACTIVE:1},companies_by_status:{},jobs_by_status:{},applications_by_status:{},generated_at:'2026-11-15T00:00:00Z'}};
  throw new Error('Unexpected API '+p);
},async({send,evaluate,until,fill,click})=>{
  async function login(as,width=1440){
    role=as;await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    const path=as==='ADMIN'?'/admin/sign-in':'/sign-in?'+new URLSearchParams({audience:as==='COMPANY_MEMBER'?'recruiter':'candidate',next:'/jobs'});
    await send('Page.navigate',{url:'http://localhost:3000'+path});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email','consumer@example.com');await fill('#auth-password','old-consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
    try { await until(as==='ADMIN'?'!!document.querySelector(".admin-stats")':`location.pathname===${JSON.stringify(as==='COMPANY_MEMBER'?'/recruiter':'/jobs')}&&!!document.querySelector(".site-account-trigger")`); }
    catch { throw new Error('Login UI '+as+': '+JSON.stringify(await evaluate('({path:location.pathname,errors:[...document.querySelectorAll("[role=alert]")].map(e=>e.textContent)})'))); }
    if(as!=='ADMIN'){await evaluate(width<500?'document.querySelector(".site-menu-toggle").click()':'document.querySelector(".site-account-trigger").click()');}
  }
  for(const as of ['CANDIDATE','COMPANY_MEMBER','ADMIN']){
    await login(as);await click('Xác thực email');await until('!!document.querySelector("dialog[aria-label=\\"Email tài khoản\\"] .ui-notice")');
    assert(await evaluate('document.querySelector("dialog[aria-label=\\"Email tài khoản\\"]").innerText.includes("consumer@example.com")'));
    mailStatus=503;await click('Gửi email xác thực');await until('!!document.querySelector("dialog .ui-notice-error")');
    assert(!await evaluate('document.querySelector("dialog[aria-label=\\"Email tài khoản\\"]").innerText.includes("hãy kiểm tra hộp thư")'));
    mailStatus=202;await click('Gửi email xác thực');await until('document.querySelector("dialog[aria-label=\\"Email tài khoản\\"]").innerText.includes("24 giờ")');
    await evaluate('document.querySelector("dialog[aria-label=\\"Email tài khoản\\"] button[aria-label=\\"Đóng hộp thoại\\"]").click()');
    await click('Đổi mật khẩu');await until('!!document.querySelector("#account-current-password")');
    await fill('#account-current-password','old-consumer-only-123');await fill('#account-new-password','new-consumer-only-456');await fill('#account-confirm-password','different-confirm-only-789');
    const before=writes.length;await click('Lưu mật khẩu mới');await until('document.querySelector("dialog[aria-label=\\"Đổi mật khẩu\\"]").innerText.includes("chưa khớp")');assert.equal(writes.length,before);
    await fill('#account-confirm-password','new-consumer-only-456');changeStatus=400;await click('Lưu mật khẩu mới');await until('document.querySelector("dialog[aria-label=\\"Đổi mật khẩu\\"]").innerText.includes("hiện tại chưa đúng")');
    changeStatus=200;await click('Lưu mật khẩu mới');await until(`location.pathname===${JSON.stringify(as==='ADMIN'?'/admin/sign-in':'/sign-in')}&&document.body.innerText.includes('Đã đổi mật khẩu thành công')`);
    const body=writes.filter(write=>write.path.endsWith('/change-password')).at(-1).body;assert.deepEqual(Object.keys(body).sort(),['current_password','new_password']);
    checks.push(as+' email state/send errors and password validation/retry/logout work');
  }
  await login('CANDIDATE',390);await click('Đổi mật khẩu');await until('!!document.querySelector("#account-current-password")');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  checks.push('Candidate mobile menu exposes password change in a usable dialog');
  await send('Page.navigate',{url:'http://localhost:3000/sign-in'});await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);await click('Quên mật khẩu?');await until('!!document.querySelector("#reset-request-email")');
  await fill('#reset-request-email','consumer@example.com');mailStatus=503;await click('Gửi liên kết đặt lại');await until('!!document.querySelector("dialog .ui-notice-error")');assert(await evaluate('!!document.querySelector("#reset-request-email")'));
  mailStatus=202;await click('Gửi liên kết đặt lại');await until('document.querySelector("dialog").innerText.includes("15 phút")');
  checks.push('Forgot-password shows SMTP failure without fake success, then accepts a retry');
  await send('Page.navigate',{url:'http://localhost:3000/reset-password?audience=recruiter#token=opaque-reset-consumer-only'});await until('!!document.querySelector("#reset-new-password")');assert.equal(await evaluate('location.hash'),'');
  await fill('#reset-new-password','new-consumer-only-456');await fill('#reset-confirm-password','new-consumer-only-456');actionStatus=400;await click('Lưu mật khẩu mới');await until('!!document.querySelector(".ui-notice-error")');
  actionStatus=200;await click('Lưu mật khẩu mới');await until('document.body.innerText.includes("Đã đặt lại mật khẩu thành công")');
  assert.equal(await evaluate('document.querySelector(".ui-auth-card a").getAttribute("href")'),'/sign-in?audience=recruiter');
  checks.push('Reset fragment is scrubbed; invalid link shows error and success leads to the correct actor login');
  await send('Page.navigate',{url:'http://localhost:3000/verify-email#token=opaque-verification-consumer-only'});await until('!!document.querySelector("button.ui-btn-primary")');assert.equal(await evaluate('location.hash'),'');
  actionStatus=200;await click('Xác thực email');await until('document.body.innerText.includes("Email đã được xác thực thành công")');
  checks.push('Email verification consumes the fragment link only on explicit confirmation');
  await send('Page.navigate',{url:'http://localhost:3000/reset-password'});await until('document.body.innerText.includes("Liên kết chưa đầy đủ")');
  checks.push('Missing action link gives guidance instead of fake success');
});
console.log(JSON.stringify({status:'PASS',kind:'Controlled account UI/contract consumers; no real email or database writes',checks},null,2));
