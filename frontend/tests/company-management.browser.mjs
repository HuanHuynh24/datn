// Controlled Company/Member consumers; no Development data writes.
import assert from 'node:assert/strict';
import {withBrowser} from './browser-consumer.mjs';
let role='OWNER', failCompany=false, failMembers=false, failSave=false, failCreate=false;
let company={company_id:'45',company_name:'Company Consumer',tax_code:'DEV-TEST',industry:'Software',size:null,address:null,website:'https://example.com/',logo_url:'/legacy/logo.png',introduction:'Existing introduction',profile_url:null,approval_status:'PENDING',active_member_count:1,created_at:'2026-11-15T00:00:00Z',package_started_on:null,package_expires_on:null,package:{package_id:'99',code:'PRO',name:'Test package',member_limit:2,monthly_price:'0',description:null}};
const owner={account_id:'46',full_name:'Owner Consumer',email:'owner@example.com',internal_role:'OWNER',status:'ACTIVE',account_status:'ACTIVE'};
let members=[owner];const writes=[],checks=[];
await withBrowser(async(url,request)=>{
  const path=url.pathname;
  if(path==='/api/v1/auth/login')return {body:{access_token:'company-consumer-only',expires_in:1800}};
  if(path==='/api/v1/auth/me')return {body:{account_id:'46',role:'COMPANY_MEMBER',company_id:'45',internal_role:role}};
  if(path==='/api/v1/companies/me'){
    if(request.method==='PATCH'){
      const body=JSON.parse(request.postData);writes.push({path,body});
      if(failSave)return {status:503,body:{detail:'Unavailable'}};
      company={...company,...body};return {body:company};
    }
    return failCompany?{status:503,body:{detail:'Unavailable'}}:{body:company};
  }
  if(path==='/api/v1/companies/me/members'){
    if(request.method==='POST'){
      const body=JSON.parse(request.postData);writes.push({path,body});
      if(failCreate)return {status:409,body:{detail:'Email or tax code already in use'}};
      const member={account_id:'47',full_name:body.full_name,email:body.email,internal_role:'RECRUITER',status:'ACTIVE',account_status:'ACTIVE'};
      members=[owner,member];company={...company,active_member_count:2};failMembers=true;
      return {status:201,body:member};
    }
    return failMembers?{status:503,body:{detail:'Unavailable'}}:{body:members};
  }
  if(path==='/api/v1/companies/me/members/47'){
    const body=JSON.parse(request.postData);writes.push({path,body});
    members=members.map(m=>m.account_id==='47'?{...m,status:body.status}:m);
    company={...company,active_member_count:body.status==='ACTIVE'?2:1};
    return {body:members[1]};
  }
  throw new Error('Unexpected API '+path);
},async({send,evaluate,until,fill,click,requests})=>{
  async function login(){
    await send('Page.navigate',{url:'http://localhost:3000/sign-in?audience=recruiter&next=/recruiter/company'});
    await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
    await fill('#auth-email','owner@example.com');await fill('#auth-password','consumer-only-123');await evaluate('document.querySelector("form").requestSubmit()');
    await until('location.pathname==="/recruiter/company"&&!!document.querySelector(".ui-columns")');
  }
  failMembers=true;await login();await until('document.body.innerText.includes("Thử tải lại thành viên")');
  assert(await evaluate('document.body.innerText.includes("Đang chờ duyệt")'));
  assert(await evaluate('document.querySelector("#member-email").disabled||document.querySelector("#member-email").matches(":disabled")'));
  checks.push('Member read failure preserves fresh company and prevents creating from stale quota');
  failMembers=false;await click('Thử tải lại thành viên');await until('!!document.querySelector("[data-member-id=\\"46\\"]")');
  await click('Chỉnh sửa hồ sơ');await click('Lưu hồ sơ doanh nghiệp');await until('!document.querySelector("#company-name")');assert.equal(writes.length,0);
  checks.push('Unchanged company form sends no PATCH');
  await click('Chỉnh sửa hồ sơ');await fill('#company-logo','javascript:alert(1)');await click('Lưu hồ sơ doanh nghiệp');
  await until('document.body.innerText.includes("URL logo mới phải")');assert.equal(writes.length,0);
  await fill('#company-logo','/legacy/logo.png');checks.push('New unsafe URL is rejected; unchanged legacy relative logo does not block editing');
  await fill('#company-address','New office');failSave=true;await click('Lưu hồ sơ doanh nghiệp');await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('document.querySelector("#company-address").value'),'New office');
  failSave=false;await click('Lưu hồ sơ doanh nghiệp');await until('!document.querySelector("#company-name")');
  assert.deepEqual(writes.at(-1).body,{address:'New office'});assert.equal(company.approval_status,'PENDING');assert.equal(company.introduction,'Existing introduction');
  checks.push('Company retry retains edits and patches only address; approval and other fields preserved');
  await fill('#member-full-name','Recruiter Consumer');await fill('#member-email','recruiter@example.com');await fill('#member-password','consumer-only-456');
  failCreate=true;await click('Tạo thành viên');await until('document.body.innerText.includes("Email đã được sử dụng hoặc gói đã hết suất")');
  assert.equal(await evaluate('document.querySelector("#member-email").value'),'recruiter@example.com');
  failCreate=false;await click('Tạo thành viên');await until('document.body.innerText.includes("Thử tải lại thành viên")');
  assert(await evaluate('document.body.innerText.includes("Đã tạo tài khoản RECRUITER")'));
  const postCount=writes.filter(w=>w.path.endsWith('/members')).length;
  failMembers=false;await click('Thử tải lại thành viên');await until('!!document.querySelector("[data-member-id=\\"47\\"]")');
  assert.equal(writes.filter(w=>w.path.endsWith('/members')).length,postCount);
  assert.deepEqual(Object.keys(writes.filter(w=>w.path.endsWith('/members')).at(-1).body).sort(),['email','full_name','password']);
  checks.push('Create conflict retains form; committed create remains success when refresh fails; retry sends GET only');
  assert(await evaluate('document.querySelector("#member-email").matches(":disabled")'));
  await click('Tắt thành viên');await until('document.querySelector("[data-member-id=\\"47\\"]")?.innerText.includes("Đã tắt")');
  assert(!await evaluate('document.querySelector("#member-email").matches(":disabled")'));
  await click('Bật lại');await until('document.querySelector("[data-member-id=\\"47\\"]")?.innerText.includes("Đang hoạt động")');
  checks.push('Quota includes OWNER; deactivation frees seat and reactivation consumes seat');
  company={...company,package:{...company.package,member_limit:null}};await login();await until('document.body.innerText.includes("Gói chưa được cấu hình hạn mức")');
  assert(await evaluate('document.querySelector("#member-email").matches(":disabled")'));await click('Tắt thành viên');await until('document.querySelector("[data-member-id=\\"47\\"]")?.innerText.includes("Đã tắt")');
  checks.push('Unknown quota blocks grants but allows RECRUITER deactivation');
  const readCount=requests.filter(r=>r.path.endsWith('/members')).length;role='RECRUITER';await login();
  assert(!await evaluate('!!document.querySelector("#member-email")'));assert(!await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent==="Chỉnh sửa hồ sơ")'));
  assert.equal(requests.filter(r=>r.path.endsWith('/members')).length,readCount);
  checks.push('RECRUITER reads company without member requests or OWNER controls');
  role='OWNER';company={...company,package:{...company.package,member_limit:2}};await login();
  await until('!!document.querySelector("[data-member-id=\\"47\\"]")');failCompany=true;await click('Bật lại');
  await until('document.body.innerText.includes("Thử tải lại hồ sơ công ty")');
  assert(await evaluate('document.body.innerText.includes("Đã cập nhật trạng thái thành viên")'));
  assert(!await evaluate('!!document.querySelector("#member-email")'));
  failCompany=false;await click('Thử tải lại hồ sơ công ty');await until('!!document.querySelector("[data-member-id=\\"47\\"]")');
  checks.push('Company refresh failure hides stale quota, retains committed status success and offers GET retry');
  await click('Chỉnh sửa hồ sơ');await fill('#company-address','');await click('Lưu hồ sơ doanh nghiệp');await until('!document.querySelector("#company-name")');assert.deepEqual(writes.at(-1).body,{address:null});
  failCompany=false;
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  checks.push('Optional field clearing sends null; company/member page fits mobile');
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
