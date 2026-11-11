// Synthetic HTTP responses test Frontend consumers; never used by application runtime.
import assert from 'node:assert/strict';
import { withBrowser } from './browser-consumer.mjs';
const checks = [];
const calls = [];
let role = 'COMPANY_MEMBER', approval = 'APPROVED', denied = false, conflict = false;
let record = { id: '41', candidate_id: '42', candidate_name: 'Consumer Candidate', candidate_email: 'candidate@example.com', job_id: '43', job_title: 'Consumer Job', company_id: '44', company_name: 'Consumer Company', cv_id: '45', cover_letter: '<script>window.privateLeak=true</script>', status: 'APPLIED', submitted_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' };
async function respond(url, request) {
  const name = url.pathname;
  calls.push({ name, method: request.method, query: url.search, authorized: !!request.headers.Authorization || !!request.headers.authorization });
  if (name === '/api/v1/auth/login') return { body: { access_token: 'consumer-test-only', expires_in: 1800, token_type: 'bearer' } };
  if (name === '/api/v1/auth/me') return { body: { account_id: '46', role, company_id: role === 'COMPANY_MEMBER' ? '44' : null, internal_role: role === 'COMPANY_MEMBER' ? 'OWNER' : null, company_approval_status: role === 'COMPANY_MEMBER' ? approval : null } };
  if (name === '/api/v1/companies/me') return { body: { company_id: '44', company_name: 'Consumer Company', approval_status: approval, active_member_count: 1, package: { name: 'Test package', member_limit: 1 } } };
  if (name === '/api/v1/candidates/me/profile') return { body: { account_id: '46', candidate_id: '42', full_name: 'Consumer Candidate', email: 'candidate@example.com', updated_at: record.updated_at } };
  if (name === '/api/v1/companies/me/applications/41' && request.method === 'PATCH') {
    assert.equal(role, 'COMPANY_MEMBER');
    assert.equal(approval, 'APPROVED');
    if (conflict) return { status: 409, body: { detail: 'Invalid application state transition' } };
    const status = JSON.parse(request.postData).status;
    assert(['REVIEWING', 'REJECTED'].includes(status));
    record = { ...record, status };
    return { body: record };
  }
  if (name === '/api/v1/applications/41') return denied ? { status: 404, body: { detail: 'Application not found' } } : { body: record };
  if (name === '/api/v1/applications/41/cv') return { type: 'application/pdf', raw: '%PDF-1.4\n%%EOF' };
  if (/\/me\/applications$/.test(name)) {
    const status = url.searchParams.get('status');
    const items = status && status !== record.status ? [] : [record];
    return { body: { items, total: items.length ? 11 : 0, limit: 10, offset: Number(url.searchParams.get('offset')) } };
  }
  throw new Error('Unexpected API ' + name);
}
await withBrowser(respond, async ({ send, evaluate, until, fill, click }) => {
  const login = async (audience, next) => {
    await send('Page.navigate', { url: 'http://localhost:3000/sign-in?' + new URLSearchParams({ audience, next }) });
    await until(`(()=>{const form=document.querySelector('form');return form&&Object.keys(form).some(key=>key.startsWith('__reactProps')&&typeof form[key].onSubmit==='function')})()`);
    await fill('#auth-email', 'consumer@example.com'); await fill('#auth-password', 'Consumer-test-only-123');
    await evaluate('document.querySelector("form").requestSubmit()');
    await until('!!document.querySelector("#application-status")&&!document.body.innerText.includes("Đang tải đơn ứng tuyển")');
  };
  const detail = async () => { await click('Chi tiết đơn #41'); await until('!!document.querySelector("dialog")&&!document.querySelector("dialog").innerText.includes("Đang tải chi tiết")'); };
  const close = async () => { await evaluate('document.querySelector("dialog button[aria-label]").click()'); await until('!document.querySelector("dialog")'); };
  await login('recruiter', '/recruiter/applicants?jobId=43');
  assert(calls.some(call => call.name === '/api/v1/companies/me/applications' && new URLSearchParams(call.query).get('job_id') === '43'));
  checks.push('Employer jobId link filters API by job');
  await detail(); assert(await evaluate('document.querySelector("dialog").innerText.includes("Consumer Candidate")'));
  assert.equal(await evaluate('window.privateLeak'), undefined);
  assert(await evaluate('document.querySelector("dialog").innerText.includes("<script>")'));
  assert(calls.some(call => call.name === '/api/v1/applications/41' && call.authorized));
  checks.push('Detail uses authorized API and escapes cover letter');
  await click('Đang xem xét');
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0);
  await click('Hủy');
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0);
  checks.push('Status change requires confirmation and supports cancel');
  conflict = true; await click('Đang xem xét'); await click('Xác nhận trạng thái đơn');
  await until('document.querySelector("dialog").innerText.includes("Không thể chuyển sang trạng thái")');
  assert.equal(record.status, 'APPLIED');
  checks.push('Conflict displays error without fake success');
  conflict = false; await click('Xác nhận trạng thái đơn');
  await until('document.querySelector("dialog").innerText.includes("Đã cập nhật trạng thái đơn.")');
  assert.equal(record.status, 'REVIEWING');
  checks.push('Confirmed update calls company PATCH and refreshes status');
  await click('Tải CV đã nộp');
  for (let i = 0; i < 50 && !calls.some(call => call.name === '/api/v1/applications/41/cv'); i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert(calls.some(call => call.name === '/api/v1/applications/41/cv' && call.authorized));
  checks.push('CV snapshot download sends authorization');
  await close();
  await evaluate(`document.querySelector('a[href="/recruiter/pipeline?jobId=43"]').click()`);
  await until(`!!document.querySelector('nav[aria-label="Giai đoạn tuyển dụng"]')`);
  await click('Đang xem xét');
  await until('location.search.includes("status=REVIEWING")&&!document.body.innerText.includes("Đang tải đơn ứng tuyển")');
  assert(calls.some(call => call.name === '/api/v1/companies/me/applications' && new URLSearchParams(call.query).get('status') === 'REVIEWING'));
  await click('Trang sau'); await until('location.search.includes("page=2")&&!document.body.innerText.includes("Đang tải đơn ứng tuyển")');
  assert(calls.some(call => new URLSearchParams(call.query).get('offset') === '10'));
  checks.push('Pipeline tabs and pagination use server filters');
  await click('Từ chối'); await until('document.body.innerText.includes("Chưa có đơn ứng tuyển")');
  checks.push('Pipeline empty stage has no demo fallback');
  role = 'CANDIDATE';
  await login('candidate', '/candidate/applications?status=Interview');
  assert(calls.some(call => call.name === '/api/v1/candidates/me/applications' && new URLSearchParams(call.query).get('status') === 'INTERVIEW'));
  checks.push('Legacy Candidate status maps to confirmed server code');
  await evaluate(`document.querySelector('a[href="/candidate/applications"]').click()`);
  await until('document.body.innerText.includes("Chi tiết đơn #41")'); await detail();
  assert.equal(await evaluate(`[...document.querySelectorAll('dialog button')].some(button=>['Phỏng vấn','Từ chối','Đề nghị tuyển dụng'].includes(button.textContent.trim()))`), false);
  checks.push('Candidate has detail and download without mutation controls');
  await close(); denied = true; await detail();
  assert(await evaluate('!!document.querySelector("dialog [role=alert]")'));
  assert.equal(await evaluate('document.querySelector("dialog").innerText.includes("Consumer Candidate")'), false);
  checks.push('Scoped 404 never displays previous private detail');
  denied = false; role = 'COMPANY_MEMBER'; approval = 'PENDING';
  await login('recruiter', '/recruiter/pipeline'); await detail();
  assert.equal(await evaluate(`[...document.querySelectorAll('dialog button')].some(button=>['Phỏng vấn','Từ chối','Đề nghị tuyển dụng'].includes(button.textContent.trim()))`), false);
  checks.push('PENDING company sees no status mutation controls');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  checks.push('Mobile Application dialog fits viewport');
});
console.log(JSON.stringify({ status: 'PASS', kind: 'Frontend consumer only; MySQL authorization requires integration suite', checks }, null, 2));
