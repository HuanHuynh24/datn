// Read-only Development smoke. Relay actual API responses; no fixtures or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../../.local-backups/demo-import/import-plan.json', import.meta.url), 'utf8'));
const sourceJob = plan.jobs[0];
const company = plan.companies.find(item => item.key === sourceJob.company_key);
const checks = [];
await withBrowser(async (url, request) => {
  assert.equal(request.method, 'GET', 'Development smoke forbids API writes');
  const response = await fetch('http://localhost:8000' + url.pathname + url.search);
  return { status: response.status, body: await response.json() };
}, async ({ send, evaluate, until, requests }) => {
  const navigate = async path => send('Page.navigate', { url: 'http://localhost:3000' + path });
  await navigate('/jobs?' + new URLSearchParams({ keyword: sourceJob.title }));
  await until('!!document.querySelector("[data-job-id]")');
  assert(await evaluate(`document.querySelector('.cl-job-title').textContent.includes(${JSON.stringify(sourceJob.title)})`));
  const jobId = await evaluate('document.querySelector("[data-job-id]").dataset.jobId');
  assert(/^[1-9][0-9]*$/.test(jobId));
  checks.push('Imported source job displays with a MySQL numeric ID through actual API');
  await evaluate('document.querySelector(".cl-job-title button").click()');
  await until('location.pathname.startsWith("/jobs/")&&document.body.innerText.includes("chưa xác minh ngoài thực tế")');
  assert(await evaluate('document.body.innerText.includes("USD")'));
  checks.push('Job detail retains Development provenance and original USD salary');
  await navigate('/companies?' + new URLSearchParams({ q: company.name }));
  await until('!!document.querySelector("[data-company-id]")');
  assert(await evaluate(`document.querySelector('[data-company-id]').textContent.includes(${JSON.stringify(company.name)})`));
  const companyId = await evaluate('document.querySelector("[data-company-id]").dataset.companyId');
  await navigate('/companies/' + companyId);
  await until('!!document.querySelector("[data-job-id]")');
  assert(await evaluate('document.body.innerText.includes("chưa xác minh ngoài thực tế")'));
  checks.push('Imported company detail and related jobs use actual database records');
  assert(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)));
  checks.push('Development browser smoke performed no fixture or business DML');
});
console.log(JSON.stringify({ status: 'PASS', kind: 'Read-only browser with actual Development API relay; not a fixture database', checks }, null, 2));
