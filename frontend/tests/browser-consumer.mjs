// Browser transport for controlled HTTP consumer tests. No requests reach a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function withBrowser(respond, run) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'datn-consumer-'));
  const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9226', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws, send;
  const failures = [];
  try {
    let tab;
    for (let i = 0; i < 50; i++) { try { tab = await (await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' })).json(); break; } catch { await wait(200); } }
    assert(tab, 'Browser unavailable');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => { pending.delete(key); reject(new Error('Protocol timeout: ' + method)); }, 15000);
      pending.set(key, { resolve, reject, timer }); ws.send(JSON.stringify({ id: key, method, params }));
    });
    ws.onmessage = async event => {
      const message = JSON.parse(event.data);
      if (message.id) { const entry = pending.get(message.id); if (entry) { clearTimeout(entry.timer); pending.delete(message.id); if (message.error) entry.reject(new Error('Protocol error')); else entry.resolve(message.result); } }
      if (message.method === 'Runtime.exceptionThrown') failures.push('Browser runtime exception');
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      try {
        if (!url.pathname.startsWith('/api/v1/')) { await send('Fetch.continueRequest', { requestId }); return; }
        const response = request.method === 'OPTIONS' ? { body: {} } : await respond(url, request);
        assert(response, 'Unhandled API route: ' + url.pathname);
        await send('Fetch.fulfillRequest', { requestId, responseCode: response.status ?? 200, responseHeaders: [{ name: 'Content-Type', value: response.type ?? 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,OPTIONS' }], body: Buffer.from(response.raw ?? JSON.stringify(response.body)).toString('base64') });
      } catch (error) { failures.push(error.message); await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error('Expression failed: ' + expression); return result.result.value; };
    const until = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await wait(200); } throw new Error('Assertion timeout: ' + expression); };
    const fill = async (selector, text) => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, commands: ['selectAll'] });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
      await send('Input.insertText', { text });
    };
    const click = async text => {
      const expression = `[...document.querySelectorAll('button')].find(button=>!button.disabled&&button.textContent.trim()===${JSON.stringify(text)})`;
      await until(`!!(${expression})`); await evaluate(`(${expression}).click()`);
    };
    await run({ send, evaluate, until, fill, click });
    assert.deepEqual(failures, [], 'Consumer/runtime failures');
  } finally {
    if (send) { try { await send('Browser.close'); } catch { /* Already closed. */ } }
    ws?.close(); browser.kill();
    if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('datn-consumer-')) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* OS cleanup if locked. */ }
    }
  }
}
