// Read-only UI verification using actual Development API responses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withBrowser } from './browser-consumer.mjs';
const folder = new URL('../../.local-backups/company-directory-ui/', import.meta.url);
fs.mkdirSync(folder, { recursive: true });
const checks = [];
await withBrowser(async (url, request) => {
  assert.equal(request.method, 'GET');
  const response = await fetch('http://localhost:8000' + url.pathname + url.search);
  return { status: response.status, body: await response.json() };
}, async ({ send, evaluate, until, requests }) => {
  const navigate = path => send('Page.navigate', { url: 'http://localhost:3000' + path });
  const ready = () => until('!!document.querySelector("[data-company-id]")');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  const dimensions = () => evaluate(`(()=>{const search=document.querySelector('.site-search-context .cl-nav-search');const filter=document.querySelector('.cl-filter-trigger');return {height:search.getBoundingClientRect().height,width:Math.round(search.getBoundingClientRect().width),filterRadius:getComputedStyle(filter).borderRadius,filterHeight:filter.getBoundingClientRect().height}})()`);
  await navigate('/jobs'); await until('!!document.querySelector(".cl-results-grid")');
  const jobDimensions = await dimensions();
  await navigate('/companies'); await ready();
  assert.deepEqual(await dimensions(), jobDimensions);
  checks.push('Company header search dimensions and dropdown styling match Jobs exactly');
  await evaluate('document.fonts.ready');
  let screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(new URL('desktop.png', folder), Buffer.from(screenshot.data, 'base64'));
  await navigate('/companies?q=company&industry=software&location=Ha%20Noi&page=2');
  await until(`!!document.querySelector('[aria-label="Bộ lọc đang áp dụng"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label^="Bỏ lọc "]').length`), 3);
  await until(`(()=>{const el=document.querySelector('button[aria-label="Bỏ lọc Lĩnh vực"]');return el&&Object.keys(el).some(key=>key.startsWith('__reactProps')&&typeof el[key].onClick==='function')})()`);
  await evaluate(`document.querySelector('button[aria-label="Bỏ lọc Lĩnh vực"]').click()`);
  await until('!location.search.includes("industry=")&&!location.search.includes("page=")');
  const query = new URLSearchParams(await evaluate('location.search'));
  assert.equal(query.get('q'), 'company'); assert.equal(query.get('location'), 'Ha Noi');
  checks.push('Filter chips remove one condition, preserve others, reset page');
  await send('Page.reload');
  await until('!!document.querySelector("#company-query")');
  await until(`(()=>{const el=document.querySelector('form[aria-label="Tìm nhà tuyển dụng"]');return el&&Object.keys(el).some(key=>key.startsWith('__reactProps')&&typeof el[key].onSubmit==='function')})()`);
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Địa điểm công ty trên thanh điều hướng"]').value`), 'Ha Noi');
  checks.push('Applied filters remain visible after reload');
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Xóa bộ lọc').click()`);
  await ready(); await until('location.pathname==="/companies"&&!location.search');
  checks.push('Reset clears URL and restores real company records');
  await evaluate(`[...document.querySelectorAll('.cl-filter-trigger')].find(button=>button.textContent.includes('Lĩnh vực')).click()`);
  await until('document.querySelectorAll("input[name=industry]").length>1');
  const selected=await evaluate('document.querySelectorAll("input[name=industry]")[1].value');
  await evaluate('document.querySelectorAll("input[name=industry]")[1].click();document.querySelector("input[name=industry]").closest("form").requestSubmit()');
  await until('!!document.querySelector("[data-company-id]")&&!!location.search');
  assert(requests.some(request=>new URLSearchParams(request.query).get('industry')===selected));
  checks.push('Dropdown choices from actual API select a real industry and filter companies');
  await navigate('/companies'); await ready();
  for (const width of [768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: true });
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if (width<768) {
      await evaluate('document.querySelector(".cl-mobile-filter-button").click()');
      await until('!!document.querySelector("dialog[open]")');
      assert(await evaluate('document.querySelector("dialog .company-filter-options").getBoundingClientRect().right<=innerWidth'));
      await evaluate(`document.querySelector('button[aria-label="Đóng hộp thoại"]').click()`);
      await until('!document.querySelector("dialog")');
    }
    if (width===390) {
      screenshot=await send('Page.captureScreenshot', { format:'png' });
      fs.writeFileSync(new URL('mobile.png',folder),Buffer.from(screenshot.data,'base64'));
    }
  }
  checks.push('Tablet and 390/320px mobile filters remain within viewport');
  assert(requests.every(request=>['GET','OPTIONS'].includes(request.method)));
  checks.push('No Development DML during browser checks');
}, { debugPort: 9228 });
console.log(JSON.stringify({ status:'PASS', kind:'Read-only actual API relay', checks },null,2));
