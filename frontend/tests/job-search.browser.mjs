/* Consumer tests: controlled HTTP responses, no MySQL or Development writes.
 * Run with a Frontend server on localhost:3000: node tests/job-search.browser.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://localhost:3000';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'datn-search-'));
const catalog = { industries: [{ id: '91', name: 'Ngành kiểm thử' }], provinces: [{ id: '92', name: 'Hà Nội' }], skills: [{ id: '93', name: 'Python' }], wards: [] };
const job = { id: '94', title: 'Python Engineer', company_id: '95', company_name: 'Consumer Test', industry_id: '91', industry_name: 'Ngành kiểm thử', province_id: '92', province_name: 'Hà Nội', street: null, ward_id: null, description: 'Consumer fixture', requirements: 'Python', level: null, minimum_salary: '100', maximum_salary: '200', years_experience: null, work_type: 'Full-time', application_deadline: null, status: 'APPROVED', created_at: '2026-11-01T00:00:00Z', skills: [{ skill_id: '93', name: 'Python', required: true, priority: 0 }] };
const requests = [];
const checks = [];
const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9225', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, send;
async function main() {
  try {
    let tab;
    for (let i = 0; i < 50; i++) {
      try { tab = await (await fetch('http://127.0.0.1:9225/json/new?about:blank', { method: 'PUT' })).json(); break; } catch { await wait(200); }
    }
    assert(tab, 'Browser unavailable');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => { pending.delete(key); reject(new Error('Protocol timeout: ' + method)); }, 15000);
      pending.set(key, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
    ws.onmessage = async event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = pending.get(message.id);
        if (entry) { clearTimeout(entry.timer); pending.delete(message.id); if(message.error) entry.reject(new Error('Protocol error')); else entry.resolve(message.result); }
      }
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      try {
        if (!url.pathname.startsWith('/api/v1/')) { await send('Fetch.continueRequest', { requestId }); return; }
        assert(['GET', 'OPTIONS'].includes(request.method), 'Unexpected API write');
        requests.push(url);
        const status = url.searchParams.get('q') === 'force-error' ? 503 : 200;
        const offset = Number(url.searchParams.get('offset') || 0);
        const items = url.searchParams.get('q') === 'no-results' ? [] : [job];
        const payload = url.pathname === '/api/v1/job-catalog' ? catalog : url.pathname === '/api/v1/jobs/94' ? job : { items, total: items.length ? 16 : 0, limit: 15, offset };
        await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: base }, { name: 'Access-Control-Allow-Headers', value: '*' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') });
      } catch (error) { console.error(error.message); }
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    const evaluate = async expression => {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error('Browser expression failed: '+expression+'; '+response.exceptionDetails.exception?.description);
      return response.result.value;
    };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(200); } throw new Error('Assertion timeout: ' + expression); };
    const navigate = async query => { await send('Page.navigate', { url: base + '/jobs' + query }); };
    const ready = () => until('!!document.querySelector(".cl-results-grid")');
    const lastQuery = () => requests.filter(url => url.pathname === '/api/v1/jobs').at(-1).searchParams;
    await navigate('?keyword=Python&province_id=92&industry_id=91&skill_id=93&minimum_salary=100&work_type=Full-time&sort=salary_desc&page=2');
    await ready();
    for (const [key, value] of Object.entries({ q: 'Python', province_id: '92', industry_id: '91', skill_id: '93', minimum_salary: '100', work_type: 'Full-time', sort: 'salary_desc', limit: '15', offset: '15' })) assert.equal(lastQuery().get(key), value, key);
    checks.push('URL maps every supported API filter and server offset');
    assert(await evaluate('document.body.innerText.includes("16 việc làm")&&document.body.innerText.includes("Hiển thị 16–16 trong 16")'));
    checks.push('Uses server total and offset for result range');
    await send('Page.reload'); await ready(); assert.equal(lastQuery().get('offset'), '15');
    checks.push('Reload preserves filters and page');
    await evaluate(`document.querySelector('select[aria-label="Sắp xếp việc làm"]').value='salary_asc';document.querySelector('select[aria-label="Sắp xếp việc làm"]').dispatchEvent(new Event('change',{bubbles:true}))`);
    await until('location.search.includes("sort=salary_asc")&&!!document.querySelector(".cl-results-grid")');
    assert.equal(lastQuery().get('offset'), '0'); assert.equal(lastQuery().get('sort'), 'salary_asc');
    checks.push('Sort changes API query and resets page');
    await evaluate(`document.querySelector('button[aria-label="Trang 2"]').click()`);
    await until('location.search.includes("page=2")&&!!document.querySelector(".cl-results-grid")'); assert.equal(lastQuery().get('offset'), '15');
    checks.push('Pagination requests next server page');
    await evaluate(`document.querySelector('input[name="skill_id"][value="93"]')?.click()`);
    // Dropdown contents are mounted only while open.
    await evaluate(`([...document.querySelectorAll('.cl-filter-trigger')].find(button=>button.textContent.includes('Kỹ năng'))).click()`);
    await until(`!!document.querySelector('input[name="skill_id"]')`);
    await evaluate(`document.querySelector('input[name="skill_id"]:checked').click();document.querySelector('input[name="skill_id"]').click()`);
    await until('!location.search.includes("skill_id=")&&!!document.querySelector(".cl-results-grid")');
    assert.equal(lastQuery().has('skill_id'),false); assert.equal(lastQuery().get('offset'),'0');
    checks.push('Catalog radio selection updates URL and resets server page');
    const returnPath=await evaluate('location.pathname+location.search');
    await evaluate('document.querySelector(".cl-job-title button").click()');
    await until('location.pathname==="/jobs/94"&&!!document.querySelector(".ui-return-link")');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("returnTo")'),returnPath);
    await evaluate('document.querySelector(".ui-return-link").click()'); await ready();
    assert.equal(await evaluate('location.pathname+location.search'),returnPath);
    checks.push('Detail and return preserve search URL');
    await navigate('?location=Ha%20Noi'); await ready(); assert.equal(lastQuery().get('province_id'), '92');
    checks.push('Legacy location resolves to real catalog ID');
    await navigate('?province_id=999'); await until('!!document.querySelector(".cl-results-empty[role=alert]")');
    checks.push('Unavailable catalog ID displays error');
    await navigate('?keyword=no-results'); await until('document.body.innerText.includes("Chưa tìm thấy việc làm phù hợp")');
    checks.push('Empty API result has no mock fallback');
    await navigate('?keyword=force-error'); await until('!!document.querySelector(".cl-results-empty[role=alert]")');
    checks.push('API failure displays error');
    await navigate(''); await ready();
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelector(".cl-mobile-filter-button").click()'); await until('!!document.querySelector("dialog[open]")');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert(await evaluate('document.querySelector("dialog").innerText.includes("Ngành kiểm thử")'));
    checks.push('Mobile filters use catalog and fit viewport');
    console.log(JSON.stringify({ status: 'PASS', kind: 'Frontend consumer responses; not MySQL integration', checks }, null, 2));
  } finally {
    if (send) { try { await send('Browser.close'); } catch { /* Already stopped. */ } }
    if (ws) ws.close();
    browser.kill();
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('datn-search-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* OS removes locked temp files later. */ }
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
