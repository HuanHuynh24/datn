// Default: controlled HTTP consumer test. --mysql uses only the guarded fixture API on port8001.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withBrowser } from './browser-consumer.mjs';
const live = process.argv.includes('--mysql');
const checks = [], calls = [];
const sample = { company_id: '91', company_name: 'Consumer Company', industry: 'Software', size: null, address: 'Hà Nội', website: 'javascript:alert(1)', logo_url: null, introduction: '<script>window.companyLeak=true</script>', open_job_count: 1 };
const job = { id: '92', title: 'Consumer Engineer', company_id: '91', company_name: sample.company_name, industry_id: '93', industry_name: 'Software', province_id: '94', province_name: 'Hà Nội', ward_id: null, street: null, level: null, minimum_salary: null, maximum_salary: null, years_experience: null, work_type: null, application_deadline: null, status: 'APPROVED', description: 'Public description', requirements: 'Public requirements', skills: [], created_at: '2026-11-01T00:00:00Z' };
let company = sample;
if (live) {
  const response = await fetch('http://localhost:8001/api/v1/companies'); assert(response.ok);
  company = (await response.json()).items[0]; assert(company);
}
async function respond(url) {
  calls.push({ path: url.pathname, query: url.search });
  if (url.searchParams.get('q') === 'force-error') return { status: 503, body: {} };
  if (url.pathname === '/api/v1/companies') return { body: { items: url.searchParams.get('q') === 'no-match' ? [] : [sample], total: url.searchParams.get('q') === 'no-match' ? 0 : 13, limit: Number(url.searchParams.get('limit')), offset: Number(url.searchParams.get('offset')) } };
  if (url.pathname === '/api/v1/companies/91') return { body: sample };
  if (url.pathname === '/api/v1/companies/91/jobs') return { body: { items: [job], total: 1, limit: 10, offset: 0 } };
  if (/^\/api\/v1\/companies\//.test(url.pathname)) return { status: 404, body: {} };
  if (url.pathname === '/api/v1/jobs/92') return { body: job };
  if (url.pathname === '/api/v1/jobs') return { body: { items: [job], total: 1, limit: 20, offset: 0 } };
  if (url.pathname === '/api/v1/job-catalog') return { body: { industries: [], provinces: [], wards: [], skills: [] } };
  throw new Error('Unexpected API ' + url.pathname);
}
await withBrowser(respond, async ({ send, evaluate, until, fill, click, requests }) => {
  const navigate = async path => { await send('Page.navigate', { url: 'http://localhost:3000' + path }); };
  const ready = () => until('!!document.querySelector("[data-company-id]")');
  await navigate('/companies'); await ready();
  assert.equal(await evaluate('document.querySelector("[data-company-id]").dataset.companyId'), company.company_id);
  checks.push('Directory displays API company identity');
  if (!live) {
    await click('Trang sau'); await until('location.search.includes("page=2")&&!!document.querySelector("[data-company-id]")');
    assert(requests.some(item => item.path === '/api/v1/companies' && new URLSearchParams(item.query).get('offset') === '12'));
    checks.push('Server pagination uses offset12');
  }
  await fill('#company-query', company.company_name); await evaluate('document.querySelector("form").requestSubmit()');
  await until('location.search.includes("q=")&&!!document.querySelector("[data-company-id]")');
  assert(requests.some(item => item.path === '/api/v1/companies' && new URLSearchParams(item.query).get('q') === company.company_name));
  checks.push('Search submits q to directory API');
  await send('Page.reload'); await ready();
  assert.equal(await evaluate('document.querySelector("#company-query").value'), company.company_name);
  checks.push('Reload retains directory filter');
  const returnPath = await evaluate('location.pathname+location.search');
  await evaluate('document.querySelector(".cl-company-card h3 a").click()');
  await until('location.pathname.startsWith("/companies/")&&!!document.querySelector("[data-job-id]")');
  assert(await evaluate('document.body.innerText.includes("Việc làm đang mở (1)")'));
  assert.equal(await evaluate('new URLSearchParams(location.search).get("returnTo")'), returnPath);
  assert.equal(await evaluate('window.companyLeak'), undefined);
  assert.equal(await evaluate('!!document.querySelector(\'a[href^="javascript:"]\')'), false);
  checks.push('Public detail shows effective jobs and safe website/text');
  const detailPath = await evaluate('location.pathname+location.search');
  await evaluate('document.querySelector(".cl-job-title button").click()');
  await until('location.pathname.startsWith("/jobs/")&&!!document.querySelector(".ui-return-link")');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("returnTo")'), detailPath);
  await evaluate('document.querySelector(".ui-return-link").click()');
  await until('location.pathname.startsWith("/companies/")&&!!document.querySelector(".ui-return-link")');
  await evaluate('document.querySelector(".ui-return-link").click()'); await ready();
  assert.equal(await evaluate('location.pathname+location.search'), returnPath);
  checks.push('Company-to-job and return preserve directory URL');
  await navigate('/companies?q=no-match'); await until('document.body.innerText.includes("Chưa tìm thấy công ty phù hợp")');
  assert.equal(await evaluate('!!document.querySelector("[data-company-id]")'), false);
  checks.push('Empty result has no static company fallback');
  await navigate('/companies/999999999'); await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!document.querySelector("[data-job-id]")'), false);
  checks.push('Unavailable company shows error without stale jobs');
  if (!live) {
    await navigate('/companies?q=force-error'); await until('!!document.querySelector("[role=alert]")');
    checks.push('Directory API error is visible');
    await navigate('/companies?industry=Software&location=Ha%20Noi'); await ready();
    assert(calls.some(item => item.path === '/api/v1/companies' && new URLSearchParams(item.query).get('industry') === 'Software' && new URLSearchParams(item.query).get('location') === 'Ha Noi'));
    checks.push('Industry/address filters forwarded without fake IDs');
  }
  await navigate('/'); await ready();
  assert.equal(await evaluate('document.querySelector("[data-company-id]").dataset.companyId'), company.company_id);
  checks.push('Homepage company cards use actual directory API');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/companies'); await ready();
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  checks.push('Mobile directory fits viewport');
  if (live) {
    const packages = await (await fetch('http://localhost:8001/api/v1/company-packages')).json();
    const key = randomUUID().replaceAll('-', '');
    const registration = await fetch('http://localhost:8001/api/v1/auth/register/employer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'public-' + key + '@example.com', password: randomUUID(), full_name: 'Public browser owner', company_name: 'Pending browser company', tax_code: key.slice(0, 24), package_id: packages[0].package_id }) });
    assert.equal(registration.status, 201);
    const pending = await registration.json();
    await navigate('/companies/' + pending.company_id); await until('!!document.querySelector("[role=alert]")');
    assert.equal(await evaluate('document.body.innerText.includes("Pending browser company")'), false);
    checks.push('Real PENDING company is hidden from public detail');
  }
}, { mysqlTest: live });
console.log(JSON.stringify({ status: 'PASS', kind: live ? 'MySQL test API8001, outer rollback fixture' : 'Controlled HTTP consumer responses', checks }, null, 2));
