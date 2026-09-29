// End-to-end check of the web app in real Chrome (Pixel 7 emulation, 2 fake cameras, fake mic)
// with a mocked micro:bit for Bluetooth (UART service) and USB (DAPLink, V1 control + V2 bulk).
// Run: npm install && npm test          (BASE=https://... npm test to test a deployed copy)
import { chromium, devices } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MODELS = {
  image: 'https://teachablemachine.withgoogle.com/models/_hpiK-Ruz/',
  pose: 'https://teachablemachine.withgoogle.com/models/-QwNBElaH/',
  audio: 'https://teachablemachine.withgoogle.com/models/-pKvmR_PQ/',
};

// Tiny static server for the repo root unless BASE is given.
let BASE = process.env.BASE, server;
if (!BASE) {
  const root = path.resolve(import.meta.dirname, '..');
  server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }).end(fs.readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  BASE = `http://127.0.0.1:${server.address().port}/`;
}

// Runs in the page before its scripts: fake micro:bit over Web Bluetooth and WebUSB.
function mockMicrobit() {
  const UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  window.__ble = { bytes: [], chunks: [] };
  window.__usb = { baud: null, bytes: [], bad: [] };
  const bytesOf = v => new Uint8Array(v.buffer ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v);

  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {
    requestDevice: async () => {
      const on = {};
      const rx = { properties: { write: true, writeWithoutResponse: true }, writeValue: async v => {
        const b = bytesOf(v);
        if (b.length > 20) throw new Error('mock: BLE write > 20 bytes');
        __ble.chunks.push(b.length); __ble.bytes.push(...b);
      } };
      const tx = { properties: { indicate: true } };
      const device = { name: 'BBC micro:bit [mock]', addEventListener: (t, f) => (on[t] = f), gatt: {
        connect: async () => ({ getPrimaryService: async u => {
          if (u !== UART) throw new Error('mock: no service ' + u);
          return { getCharacteristics: async () => [tx, rx] };
        } }),
        disconnect: () => on.gattserverdisconnected?.(),
      } };
      window.__bleDevice = device;
      return device;
    },
  } });

  Object.defineProperty(navigator, 'usb', { configurable: true, value: {
    addEventListener() {},
    requestDevice: async () => {
      const bulk = window.__usbBulk; // true = micro:bit V2 (bulk endpoints), false = V1 (HID control transfers)
      let last = 0;
      const handle = data => {
        const b = bytesOf(data);
        if (b.length !== 64) __usb.bad.push('packet length ' + b.length);
        last = b[0];
        if (b[0] === 0x82) __usb.baud = b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24);
        else if (b[0] === 0x84) { if (b[1] > 62) __usb.bad.push('write len ' + b[1]); __usb.bytes.push(...b.slice(2, 2 + b[1])); }
        else __usb.bad.push('unknown cmd ' + b[0]);
      };
      const reply = () => ({ status: 'ok', data: new DataView(new Uint8Array(64).fill(0).map((x, i) => (i === 0 ? last : x)).buffer) });
      const dev = {
        configuration: null,
        open: async () => {},
        selectConfiguration: async () => { dev.configuration = { interfaces: [
          { interfaceNumber: 0, alternates: [{ interfaceClass: 0x08, endpoints: [] }] }, // mass storage, must be skipped
          { interfaceNumber: 3, alternates: [{ interfaceClass: 0xff, endpoints: bulk ? [{ direction: 'in', endpointNumber: 4 }, { direction: 'out', endpointNumber: 5 }] : [] }] },
        ] }; },
        claimInterface: async n => { if (n !== 3) __usb.bad.push('claimed interface ' + n); },
        controlTransferOut: async (s, data) => {
          if (bulk || s.request !== 0x09 || s.value !== 0x200 || s.index !== 3) __usb.bad.push('bad controlTransferOut ' + JSON.stringify(s));
          handle(data); return { status: 'ok' };
        },
        controlTransferIn: async s => { if (bulk || s.request !== 0x01 || s.value !== 0x100) __usb.bad.push('bad controlTransferIn'); return reply(); },
        transferOut: async (ep, data) => { if (!bulk || ep !== 5) __usb.bad.push('bad transferOut ep ' + ep); handle(data); return { status: 'ok' }; },
        transferIn: async ep => { if (!bulk || ep !== 4) __usb.bad.push('bad transferIn ep ' + ep); return reply(); },
        close: async () => {},
      };
      return dev;
    },
  } });
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-device-for-media-stream=device-count=2', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['camera', 'microphone'] });
await ctx.addInitScript(mockMicrobit);
let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' – ' + detail : ''}`); };

async function open(model) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(BASE + (model ? '?model=' + encodeURIComponent(model) : ''));
  await page.$eval('#th', el => { el.value = 0.5; el.dispatchEvent(new Event('input')); });
  return page;
}
async function load(page) {
  await page.click('#load');
  await page.waitForFunction(() => /model ·|Error/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  return page.textContent('#status');
}
const lines = bytes => new TextDecoder().decode(new Uint8Array(bytes)).split('\n').filter(Boolean);

// 1. camera preview without a model, and switching between cameras
{
  const page = await open();
  await page.click('#camStart');
  await page.waitForFunction(() => !document.getElementById('camSel').hidden, null, { timeout: 15000 });
  const opts = await page.$$eval('#camSel option', os => os.map(o => o.value));
  const lit = await page.$eval('#canvas', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2]; return n > 0; });
  check(opts.length === 2 && lit, 'camera preview + picker', `${opts.length} cameras, canvas drawn: ${lit}`);
  await page.selectOption('#camSel', opts[1]);
  await page.waitForTimeout(1500);
  const active = await page.evaluate(() => document.getElementById('camSel').value);
  const saved = await page.evaluate(() => localStorage.getItem('tm-cam'));
  check(active === opts[1] && saved === opts[1], 'camera switch remembered');
  await page.reload();
  await page.click('#camStart');
  await page.waitForFunction(() => !document.getElementById('camSel').hidden, null, { timeout: 15000 });
  check(await page.evaluate(() => document.getElementById('camSel').value) === opts[1], 'preferred camera used after reload');
  check(!page.errors.length, 'no console errors (camera)', page.errors.join(' | '));
  await page.close();
}

// 2. every model type over Bluetooth, USB V1 and USB V2
for (const [name, url] of Object.entries(MODELS)) {
  for (const mode of ['ble', 'usb-v1', 'usb-v2']) {
    const page = await open(url);
    await page.evaluate(b => (window.__usbBulk = b), mode === 'usb-v2');
    const status = await load(page);
    await page.click(mode === 'ble' ? '#ble' : '#usb');
    await page.waitForTimeout(4000);
    const labels = await page.$$eval('#bars b', bs => bs.map(b => b.textContent));
    const pcts = await page.$$eval('#bars em', els => els.map(e => parseInt(e.textContent || '0')));
    const sum = pcts.reduce((a, b) => a + b, 0);
    const r = await page.evaluate(() => ({ ble: window.__ble, usb: window.__usb, linkName: document.getElementById('linkName').textContent }));
    const bytes = mode === 'ble' ? r.ble.bytes : r.usb.bytes;
    const sent = lines(bytes);
    const protoOk = mode === 'ble' ? r.ble.chunks.every(n => n <= 20) : r.usb.baud === 115200 && !r.usb.bad.length;
    check(!/Error/.test(status) && sum >= 95 && sum <= 105 && sent.length > 0 && sent.every(s => labels.includes(s)) && protoOk,
      `${name} over ${mode}`, `${status}; sent ${JSON.stringify(sent.slice(0, 4))}${sent.length > 4 ? '…' : ''}; ${mode === 'ble' ? 'chunks ' + r.ble.chunks.slice(0, 4) : 'baud ' + r.usb.baud + ' ' + r.usb.bad.join(',')}`);
    await page.click('#disconnect');
    check(await page.isVisible('#connectRow'), `${name} over ${mode}: disconnect restores buttons`);
    check(!page.errors.length, `${name} over ${mode}: no console errors`, page.errors.slice(0, 3).join(' | '));
    await page.close();
  }
}

// 3. a class name longer than one BLE packet / one USB packet is chunked and reassembled
{
  const page = await open();
  const long = 'A very long Teachable Machine class name that spans several packets – ünïcödé';
  for (const mode of ['ble', 'usb-v2']) {
    await page.evaluate(b => (window.__usbBulk = b), mode === 'usb-v2');
    await page.click(mode === 'ble' ? '#ble' : '#usb');
    await page.waitForTimeout(500);
    await page.evaluate(l => send(l), long);
    await page.waitForTimeout(500);
    const got = await page.evaluate(m => (m === 'ble' ? window.__ble.bytes : window.__usb.bytes), mode);
    check(lines(got).at(-1) === long, `long UTF-8 label over ${mode}`);
    await page.click('#disconnect');
  }
  await page.close();
}

await browser.close();
server?.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
