// Guard the active import graph and check legacy sessionStorage contamination in-browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { withBrowser } from './browser-consumer.mjs';

const root = path.resolve('src/marketplace');
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const name = path.basename(file);
  assert(!['demo-store.ts', 'cv-storage.ts', 'candidate-catalog.ts', 'public-data.ts', 'data.ts'].includes(name), `Active route imports fixture runtime: ${name}`);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function walk(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier?.text;
      const typeOnly = node.isTypeOnly || node.importClause?.isTypeOnly;
      if (!typeOnly && specifier?.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier);
        const resolved = [target + '.ts', target + '.tsx', target + '/index.ts'].find(item => fs.existsSync(item));
        if (resolved) visit(resolved);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}
visit(path.join(root, 'App.tsx'));
visit(path.join(root, 'routes.ts'));
const checks = [`Active route graph (${visited.size} modules) excludes business fixture runtime`];
const job = { id: '92', title: 'API authoritative title', company_id: '91', company_name: 'API company', industry_id: '93', industry_name: 'Software', province_id: '94', province_name: 'Hà Nội', ward_id: null, street: null, level: null, minimum_salary: null, maximum_salary: null, work_type: null, application_deadline: null, status: 'APPROVED', description: null, requirements: null, skills: [], created_at: '2026-11-01T00:00:00Z' };
let failed = false;
let role = 'CANDIDATE';
await withBrowser(url => {
  if (url.pathname === '/api/v1/auth/login') return { body: { access_token: 'consumer-test-only', expires_in: 1800, token_type: 'bearer' } };
  if (url.pathname === '/api/v1/auth/me') return { body: { account_id: '96', role, company_id: role==='COMPANY_MEMBER'?'91':null, internal_role: role==='COMPANY_MEMBER'?'OWNER':null, company_approval_status: role==='COMPANY_MEMBER'?'APPROVED':null } };
  if (url.pathname === '/api/v1/candidates/me/profile') return { body: { account_id: '96', candidate_id: '97', full_name: 'Consumer Candidate', email: 'consumer@example.com' } };
  if (url.pathname === '/api/v1/companies/me') return { body: { company_id: '91', company_name: 'Consumer Company', approval_status: 'APPROVED' } };
  if (url.pathname === '/api/v1/jobs') return failed ? { status: 503, body: {} } : { body: { items: [job], total: 1, limit: 100, offset: 0 } };
  if (url.pathname === '/api/v1/job-catalog') return { body: { industries: [], provinces: [], skills: [], wards: [] } };
  if (url.pathname === '/api/v1/companies') return { body: { items: [], total: 0, limit: 4, offset: 0 } };
  throw new Error('Unexpected API ' + url.pathname);
}, async ({ send, evaluate, until, fill, requests }) => {
  // Populate the real legacy storage key before application JavaScript runs.
  const legacy = fs.readFileSync(path.join(root, 'demo-store.ts'), 'utf8');
  const key = legacy.match(/const key\s*=\s*['"]([^'"]+)/)?.[1];
  assert(key, 'Legacy storage key not found');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem(${JSON.stringify(key)},JSON.stringify({jobTitles:{92:'CORRUPTED DEMO TITLE'},jobStatuses:{92:'Closed'},savedJobs:['92'],applications:[],profile:{},company:{}}));` });
  const navigate = async target => send('Page.navigate', { url: 'http://localhost:3000' + target });
  await navigate('/');
  await until('!!document.querySelector("[data-job-id]")');
  assert.equal(await evaluate('document.querySelector(".cl-job-title").textContent'), job.title);
  assert.equal(await evaluate('document.querySelector("[data-job-id]").innerText.includes("Closed")'), false);
  checks.push('Legacy demo title/status cannot override API records');
  assert(await evaluate('document.querySelector(".cl-save").disabled&&document.querySelector(".cl-save").title.includes("chưa khả dụng")'));
  const before = await evaluate(`sessionStorage.getItem(${JSON.stringify(key)})`);
  await evaluate('document.querySelector(".cl-save").click()');
  assert.equal(await evaluate(`sessionStorage.getItem(${JSON.stringify(key)})`), before);
  checks.push('Unavailable save retains icon, cannot simulate persistence');
  failed = true;
  await send('Page.reload');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!document.querySelector("[data-job-id]")'), false);
  checks.push('API error displays error without sample job fallback');
  await navigate('/jobs');
  await until('!!document.querySelector(".cl-results-empty[role=alert]")');
  assert.equal(await evaluate('!!document.querySelector("[data-job-id]")'), false);
  checks.push('Search error cannot fall back to demo jobs');
  assert(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)));
  checks.push('All consumer actions remain read-only');
  failed = false;
  const login = async (audience, next) => {
    await navigate('/sign-in?' + new URLSearchParams({ audience, next }));
    await until(`(()=>{const form=document.querySelector('form');return form&&Object.keys(form).some(key=>key.startsWith('__reactProps')&&typeof form[key].onSubmit==='function')})()`);
    await fill('#auth-email', 'consumer@example.com');
    await fill('#auth-password', 'Consumer-test-only-123');
    await evaluate('document.querySelector("form").requestSubmit()');
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('talentiq-view-v1:candidate-recommended:sort','"match"')` });
  await login('candidate', '/candidate/recommended');
  await until('location.pathname==="/candidate/recommended"&&!!document.querySelector("[data-job-id]")');
  assert(await evaluate('document.body.innerText.includes("chưa cá nhân hóa")'));
  assert.equal(await evaluate(`document.querySelector('select[aria-label="Sắp xếp việc làm"]').value`), 'newest');
  assert.equal(await evaluate('!!document.querySelector("option[value=match]")'), false);
  checks.push('Candidate discovery labels real public jobs, migrates legacy match sort to newest');
  await evaluate(`document.querySelector('.cl-results-sort select').value='salary';document.querySelector('.cl-results-sort select').dispatchEvent(new Event('change',{bubbles:true}))`);
  // A client sort does not fabricate server writes or matching scores.
  assert.equal(await evaluate('document.querySelector("[data-job-id]").innerText.includes("% phù hợp")'), false);
  checks.push('Discovery shows no synthetic matching score');
  failed = true;
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Xem tất cả việc làm').click()`);
  await until('location.pathname==="/jobs"&&!!document.querySelector("[role=alert]")');
  await evaluate('history.back()');
  await until('location.pathname==="/candidate/recommended"&&!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!document.querySelector("[data-job-id]")'), false);
  checks.push('Discovery API error hides records and offers retry');
  failed = false;
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Thử lại').click()`);
  await until('!!document.querySelector("[data-job-id]")&&!document.querySelector("[role=alert]")');
  checks.push('Discovery retry reloads API records');
  role = 'COMPANY_MEMBER';
  await login('recruiter', '/recruiter/candidates/92');
  await until('location.pathname==="/recruiter/candidates/92"&&document.body.innerText.includes("Chức năng tuyển dụng đang được triển khai")');
  assert.equal(await evaluate('!!document.querySelector(".ui-match-score")'), false);
  assert(!requests.some(request => /\/candidates\/92/.test(request.path)));
  checks.push('Unavailable talent route never mounts sample candidate or fetches private profile');
  assert(requests.every(request => ['GET', 'OPTIONS'].includes(request.method) || request.path==='/api/v1/auth/login'));
  checks.push('Only authentication POST is permitted; no business writes');
});
console.log(JSON.stringify({ status: 'PASS', kind: 'Static graph + controlled browser consumer; no database writes', checks }, null, 2));
