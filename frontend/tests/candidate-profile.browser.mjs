// Controlled consumer checks: API failures, partial PATCH, JSON preservation and responsive editor.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-consumer.mjs';

const original = { account_id:'46', candidate_id:'47', full_name:'Profile Consumer', email:'candidate@example.com', phone:null, address:null, introduction:null, avatar_url:null, profile_public:false, education:{school:'Legacy school'}, experience:[], desired_position:null, province_id:'92', minimum_salary:'0.00', maximum_salary:null, desired_work_type:null, updated_at:'2026-11-15T00:00:00Z' };
let profile = {...original}, failRead = false, failWrite = false, failCatalog = true;
const writes = [], checks = [];
await withBrowser(async (url, request) => {
  const path = url.pathname;
  if (path === '/api/v1/auth/login') return {body:{access_token:'profile-consumer-only',expires_in:1800}};
  if (path === '/api/v1/auth/me') return {body:{account_id:'46',role:'CANDIDATE',company_id:null,internal_role:null}};
  if (path === '/api/v1/candidates/me/profile') {
    if (request.method === 'PATCH') {
      const patch = JSON.parse(request.postData); writes.push(patch);
      if (failWrite) return {status:503,body:{detail:'Unavailable'}};
      profile = {...profile,...patch}; return {body:profile};
    }
    return failRead ? {status:503,body:{detail:'Unavailable'}} : {body:profile};
  }
  if (path === '/api/v1/job-catalog') return failCatalog ? {status:503,body:{detail:'Unavailable'}} : {body:{industries:[],skills:[],wards:[],provinces:[{id:'92',name:'Hà Nội'}]}};
  if (path === '/api/v1/jobs') return {body:{items:[],total:0,limit:15,offset:0}};
  throw new Error('Unexpected API '+path);
}, async ({send,evaluate,until,fill,click}) => {
  await send('Page.navigate',{url:'http://localhost:3000/sign-in?audience=candidate&next=/candidate/profile'});
  await until(`(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof f[k].onSubmit==='function')})()`);
  await fill('#auth-email','candidate@example.com'); await fill('#auth-password','consumer-only-123');
  await evaluate('document.querySelector("form").requestSubmit()');
  await until('location.pathname==="/candidate/profile"&&!!document.querySelector("progress")');
  assert(await evaluate('document.body.innerText.includes("Từ 0 VND")'));
  checks.push('Zero and one-sided salary display correctly; missing fields are explained');

  await click('Chỉnh sửa thông tin'); await until('!!document.querySelector("#profile-name")');
  await click('Lưu thay đổi'); await until('!document.querySelector("dialog")');
  assert.equal(writes.length,0); checks.push('Unchanged form sends no PATCH');

  await click('Chỉnh sửa thông tin'); await until('!!document.querySelector("#profile-phone")');
  await fill('#profile-phone','0900000000'); await fill('#profile-minimum','200'); await fill('#profile-maximum','100');
  await click('Lưu thay đổi'); await until('document.querySelector("dialog").innerText.includes("Lương tối đa phải")');
  assert.equal(writes.length,0); checks.push('Invalid salary range is explained before any request');

  await fill('#profile-minimum','0.00'); await fill('#profile-maximum',''); failWrite=true;
  await click('Lưu thay đổi'); await until('!!document.querySelector("dialog [role=alert]")');
  assert.equal(await evaluate('document.querySelector("#profile-phone").value'),'0900000000');
  failWrite=false; await click('Lưu thay đổi'); await until('!document.querySelector("dialog")');
  assert.deepEqual(writes.at(-1),{phone:'0900000000'});
  assert.deepEqual(profile.education,original.education);
  checks.push('Failed save retains edits; retry patches only changed fields and preserves legacy JSON');

  failRead=true; failCatalog=false; await click('Thử tải lại danh mục');
  await until('document.body.innerText.includes("Thử tải lại hồ sơ")');
  assert(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Chỉnh sửa thông tin").disabled'));
  failRead=false; await click('Thử tải lại hồ sơ'); await until('!!document.querySelector("progress")');
  assert(await evaluate('document.body.innerText.includes("Hà Nội")'));
  checks.push('Failed read hides stale profile; retry restores profile and real province options');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('Chỉnh sửa thông tin'); await until('!!document.querySelector("dialog")');
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await fill('#profile-phone',''); await click('Lưu thay đổi'); await until('!document.querySelector("dialog")');
  assert.deepEqual(writes.at(-1),{phone:null});
  checks.push('Mobile editor fits viewport; clearing optional information sends explicit null');
});
console.log(JSON.stringify({status:'PASS',checks},null,2));
