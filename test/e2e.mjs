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
  window.__ble = { bytes: [], chunks: [], requests: 0, hang: false, error: null };
  window.__usb = { baud: null, bytes: [], bad: [] };
  const bytesOf = v => new Uint8Array(v.buffer ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v);

  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {
    requestDevice: async () => {
      __ble.requests++;
      await new Promise(r => setTimeout(r, 200));
      if (__ble.error) throw Object.assign(new Error(__ble.error), { name: 'NotFoundError' });
      const on = {};
      const rx = { properties: { write: true, writeWithoutResponse: true }, writeValue: async v => {
        if (__ble.hang) return new Promise(() => {}); // a write that never completes
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
        disconnect: () => { on.gattserverdisconnected?.(); device.ongattserverdisconnected?.(); },
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
// When a test sets window.__qrSrc (an image data URL) the "camera" shows that image, so QR scanning can be tested.
await ctx.addInitScript(() => {
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = c => {
    if (!window.__qrSrc) return real(c);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 400;
    const x = cv.getContext('2d'), img = new Image();
    img.src = window.__qrSrc;
    (function draw() { x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 400); if (img.complete) x.drawImage(img, 20, 20, 360, 360); requestAnimationFrame(draw); })();
    return Promise.resolve(cv.captureStream(15));
  };
});
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
// Protocol: "id,confidence,name" – the name is last and may contain commas.
const msgs = bytes => lines(bytes).filter(l => !/^[@#!]/.test(l)).map(l => { const [id, conf, ...n] = l.split(','); return { id: +id, conf: +conf, name: n.join(',') }; });

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
    // The fake camera flickers between classes every frame, which the 300 ms hold filters out (see test 8).
    await page.evaluate(([b, n]) => { window.__usbBulk = b; if (n === 'image') holdMs = 0; }, [mode === 'usb-v2', name]);
    const status = await load(page);
    await page.click(mode === 'ble' ? '#ble' : '#usb');
    await page.waitForTimeout(4000);
    const labels = await page.$$eval('#bars b', bs => bs.map(b => b.textContent));
    const pcts = await page.$$eval('#bars em', els => els.map(e => parseInt(e.textContent || '0')));
    const sum = pcts.reduce((a, b) => a + b, 0);
    const r = await page.evaluate(() => ({ ble: window.__ble, usb: window.__usb, linkName: document.getElementById('linkName').textContent }));
    const bytes = mode === 'ble' ? r.ble.bytes : r.usb.bytes;
    const sent = msgs(bytes).map(m => m.name);
    const idsOk = msgs(bytes).every(m => m.id === labels.indexOf(m.name) + 1 && m.conf >= 0 && m.conf <= 100);
    const protoOk = mode === 'ble' ? r.ble.chunks.every(n => n <= 20) : r.usb.baud === 115200 && !r.usb.bad.length;
    check(!/Error/.test(status) && sum >= 95 && sum <= 105 && sent.length > 0 && sent.every(s => labels.includes(s)) && idsOk && protoOk,
      `${name} over ${mode}`, `${status}; sent ${JSON.stringify(sent.slice(0, 4))}${sent.length > 4 ? '…' : ''}; ${mode === 'ble' ? 'chunks ' + r.ble.chunks.slice(0, 4) : 'baud ' + r.usb.baud + ' ' + r.usb.bad.join(',')}`);
    check(await page.isVisible('#bleWarn') === (mode === 'ble'), `${name} over ${mode}: Bluetooth warning ${mode === 'ble' ? 'shown' : 'hidden'}`);
    await page.click('#disconnect');
    check(await page.isVisible('#connectRow') && await page.isVisible('#bleWarn'), `${name} over ${mode}: disconnect restores buttons`);
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
    await page.evaluate(l => { labels = [l]; send({ idx: 0, id: 7, conf: 90 }); }, long);
    await page.waitForTimeout(500);
    const got = await page.evaluate(m => (m === 'ble' ? window.__ble.bytes : window.__usb.bytes), mode);
    check(lines(got).at(-1) === '7,90,' + long, `long UTF-8 label over ${mode}`);
    await page.click('#disconnect');
  }
  await page.close();
}

// 4. a hung Bluetooth write doesn't block sending forever, and is retried
{
  const page = await open();
  await page.click('#ble');
  await page.waitForTimeout(500);
  await page.evaluate(() => { __ble.hang = true; labels = ['Stuck', 'After']; send({ idx: 0, id: 1, conf: 90 }); });
  await page.waitForTimeout(500);
  await page.click('#disconnect');
  await page.evaluate(() => (__ble.hang = false));
  await page.click('#ble');
  await page.waitForTimeout(4500); // hung write times out after 3 s + 1 s back-off
  await page.evaluate(() => send({ idx: 1, id: 2, conf: 90 }));
  await page.waitForTimeout(500);
  const sent = msgs(await page.evaluate(() => __ble.bytes)).map(m => m.name);
  check(sent.at(-1) === 'After' && !(await page.evaluate(() => busy)), 'sending recovers after a hung write', JSON.stringify(sent));
  await page.close();
}

// 5. double tap on Bluetooth starts one connect; errors that need a hint are shown, cancel is silent
{
  const page = await open();
  await page.evaluate(() => { document.getElementById('ble').click(); document.getElementById('ble').click(); });
  await page.waitForTimeout(800);
  check(await page.evaluate(() => __ble.requests) === 1, 'double tap = one Bluetooth connect');
  await page.click('#disconnect');
  await page.evaluate(() => (__ble.error = 'User cancelled the requestDevice() chooser.'));
  await page.click('#ble');
  await page.waitForTimeout(500);
  check(!/cancel/.test(await page.textContent('#log')), 'chooser cancel is silent');
  await page.evaluate(() => (__ble.error = 'Bluetooth adapter not available.'));
  await page.click('#ble');
  await page.waitForTimeout(500);
  check(/turn on Bluetooth/.test(await page.textContent('#log')), 'Bluetooth off shows a hint');
  await page.close();
}

// 6. link input: empty, missing https://, not a TM link
{
  const page = await open();
  // Real key presses: erasing and typing must work (a handler returning false once blocked them).
  await page.$eval('#url', el => (el.value = 'abc'));
  await page.click('#url');
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('xy');
  check(await page.inputValue('#url') === 'xy', 'link box: erase and type with the keyboard', await page.inputValue('#url'));
  for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace');
  await page.click('#load');
  const st = await page.textContent('#status');
  check(/Paste your Teachable Machine/.test(st), 'empty link explains what to paste', st);
  await page.fill('#url', MODELS.audio.replace('https://', ''));
  check(/audio model/.test(await load(page)), 'link without https:// works');
  await page.fill('#url', 'https://example.invalid/foo');
  check(/Export model/.test(await load(page)), 'wrong link explains where to get one');
  await page.close();
}

// 7. switching models (image -> pose -> audio -> image) without errors
{
  const page = await open(MODELS.image);
  let ok = true;
  for (const url of [MODELS.image, MODELS.pose, MODELS.audio, MODELS.image]) {
    await page.fill('#url', url);
    ok = /model ·/.test(await load(page)) && ok;
    await page.waitForTimeout(2500); // old model is freed after 2 s
  }
  check(ok && !page.errors.length, 'switch between models', page.errors.slice(0, 3).join(' | '));
  await page.close();
}

// 8. a class flickering every frame is not sent (hold time)
{
  const page = await open(MODELS.image);
  await load(page);
  await page.click('#ble');
  await page.waitForTimeout(4000);
  const sent = new Set(msgs(await page.evaluate(() => __ble.bytes)).map(m => m.name));
  check(sent.size <= 1, 'flickering class is not sent', `${sent.size} classes sent`);
  await page.close();
}

// 9. class IDs: editable next to each class, sent, remembered per model
{
  const page = await open(MODELS.image);
  await load(page);
  await page.evaluate(() => (holdMs = 0));
  await page.$$eval('input.cid', els => els.forEach((el, i) => { el.value = 40 + i; el.dispatchEvent(new Event('change')); }));
  await page.click('#ble');
  await page.waitForTimeout(2500);
  const labels = await page.$$eval('#bars b', bs => bs.map(b => b.textContent));
  const got = msgs(await page.evaluate(() => __ble.bytes));
  check(got.length > 0 && got.every(m => m.id === 40 + labels.indexOf(m.name)), 'edited class IDs are sent', JSON.stringify(got.slice(0, 3)));
  await page.reload();
  await load(page);
  check((await page.$$eval('input.cid', els => els.map(e => +e.value))).every((v, i) => v === 40 + i), 'class IDs remembered after reload');
  const setId = (i, v) => page.$$eval('input.cid', (els, [i, v]) => { els[i].value = v; els[i].dispatchEvent(new Event('change')); return els[i].value; }, [i, v]);
  check(await setId(0, '-5') === '0' && await setId(0, '12345') === '9999' && await setId(0, '') === '1', 'out-of-range ID is clamped, empty ID falls back to the default');
  check(!(await page.isVisible('#dupHint')), 'no duplicate-ID hint for distinct IDs');
  await setId(1, '1');
  check(await page.isVisible('#dupHint'), 'hint when two classes share an ID');
  await page.close();
}

// 10. confidence: sent with the class, resent when it moves by 5+ (at most every 250 ms)
{
  const page = await open(MODELS.audio);
  await load(page);
  await page.evaluate(() => recognizer.stopListening());
  await page.click('#ble');
  await page.waitForTimeout(300);
  const step = (p, wait) => page.evaluate(([p, w]) => new Promise(r => { show([p, 1 - p, 0, 0]); setTimeout(r, w); }), [p, wait]);
  await page.evaluate(() => { __ble.bytes.length = 0; lastSent = null; });
  await step(0.9, 300); await step(0.92, 300); await step(0.97, 50); await step(0.8, 300); await step(0.81, 300);
  // below the 50% slider: the class stays, its confidence keeps updating
  await page.evaluate(() => new Promise(r => { show([0.3, 0.3, 0.2, 0.2]); setTimeout(r, 300); }));
  const got = msgs(await page.evaluate(() => __ble.bytes));
  const confs = got.map(m => m.conf);
  check(JSON.stringify(confs) === '[90,97,81,30]' && new Set(got.map(m => m.name)).size === 1,
    'confidence updates are sent on change (80 is rate-limited), also below the slider', JSON.stringify(got));
  await page.close();
}

// 11. Greek translation
{
  const page = await open();
  await page.click('#lang');
  const el = await page.evaluate(() => [document.documentElement.lang, $('load').textContent, $('lang').textContent]);
  await page.reload();
  const kept = await page.textContent('#load');
  await page.click('#lang');
  const en = await page.textContent('#load');
  check(el.join() === 'el,Φόρτωση,EN' && kept === 'Φόρτωση' && en === 'Load', 'Greek translation toggles and is remembered', el.join() + ' / ' + kept + ' / ' + en);
  await page.close();
}

// 12. landscape phone: camera and class bars visible together
{
  const land = await browser.newContext({ ...devices['Pixel 7 landscape'], permissions: ['camera', 'microphone'] });
  await land.addInitScript(mockMicrobit);
  const page = await land.newPage();
  await page.goto(BASE + '?model=' + encodeURIComponent(MODELS.image));
  await load(page);
  const vh = page.viewportSize().height;
  const cam = await page.locator('#canvas').boundingBox(), bar = await page.locator('.bar').first().boundingBox();
  check(cam.y + cam.height <= vh && bar.y + bar.height <= vh && bar.x > cam.x + cam.width - 1, 'landscape: camera and classes side by side', JSON.stringify({ vh, cam, bar }));
  const [mb, mdl] = [await page.locator('#mb').boundingBox(), await page.locator('#model').boundingBox()];
  check(mb.y < mdl.y && mb.x > cam.x + cam.width - 1, 'landscape: micro:bit section comes right after the classes', JSON.stringify({ mb, mdl }));
  await page.screenshot({ path: path.join(import.meta.dirname, 'landscape.png') }).catch(() => {});
  await land.close();
}

// 13. switching away from an audio model frees it
{
  const page = await open(MODELS.audio);
  await load(page);
  await page.evaluate(() => (window.__oldRec = recognizer));
  await page.fill('#url', MODELS.image);
  await load(page);
  await page.waitForTimeout(2500);
  check(await page.evaluate(() => __oldRec.model.weights.every(w => w.val.isDisposed)), 'old audio model freed');
  await page.close();
}

// 14. a long (Greek) class name: no sideways scrolling, and a visible warning that it's too long for Bluetooth
{
  const long = 'Ένα πολύ μεγάλο όνομα κλάσης στα ελληνικά!'; // 42 letters, 79 bytes
  for (const dev of ['Pixel 7', 'Pixel 7 landscape']) {
    const c = await browser.newContext({ ...devices[dev], permissions: ['camera', 'microphone'] });
    await c.addInitScript(mockMicrobit);
    await c.route('**/metadata.json', async route => {
      const res = await route.fetch(), meta = await res.json();
      meta.labels[0] = long;
      route.fulfill({ response: res, json: meta });
    });
    const page = await c.newPage();
    await page.goto(BASE + '?model=' + encodeURIComponent(MODELS.image));
    const st = await load(page);
    const w = [await page.evaluate(() => document.documentElement.scrollWidth), page.viewportSize().width];
    check(w[0] <= w[1], `${dev}: long class name doesn't widen the page`, w.join(' > '));
    check(/too long for Bluetooth/.test(st), `${dev}: too-long name warned in the status line`, st);
    await c.close();
  }
}

// 15. a second link entered while a model loads: the latest one wins
{
  const page = await open(MODELS.image);
  // the image model finishes loading after the audio one has started
  await page.route(MODELS.image + 'model.json', async r => { await new Promise(w => setTimeout(w, 3000)); r.continue(); });
  await page.press('#url', 'Enter');
  await page.waitForTimeout(300);
  await page.fill('#url', MODELS.audio);
  await page.press('#url', 'Enter');
  await page.waitForFunction(() => /model ·|Error/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({ kind, model: !!model, listening: !!recognizer?.isListening(), status: $('status').textContent }));
  check(r.kind === 'audio' && !r.model && r.listening && /audio model/.test(r.status) && !page.errors.length, 'latest link wins when Enter is pressed during a load', JSON.stringify(r) + page.errors.slice(0, 3).join(' | '));
  await page.close();
}

// 16. switching language also translates text that was already shown
{
  const page = await open(MODELS.image);
  await load(page);
  await page.click('#lang');
  const r = await page.evaluate(() => [$('status').textContent, $('bars').querySelector('input').getAttribute('aria-label')]);
  check(/^μοντέλο εικόνας/.test(r[0]) && /^ID για/.test(r[1]), 'language switch re-renders status and ID labels', r.join(' / '));
  await page.click('#lang');
  await page.close();
}

// 17. class table ("@index,id,name") and every class's confidence ("#c0,c1,…") for "confidence of class ID"
{
  const page = await open(MODELS.audio);
  await load(page);
  await page.evaluate(() => recognizer.stopListening());
  await page.$$eval('input.cid', els => { els[1].value = 22; els[1].dispatchEvent(new Event('change')); });
  await page.click('#usb');
  await page.waitForTimeout(300);
  const step = (p, wait) => page.evaluate(([p, w]) => new Promise(r => { show([p, 1 - p, 0, 0]); setTimeout(r, w); }), [p, wait]);
  await step(0.9, 400); await step(0.88, 300); await step(0.7, 300);
  const all = lines(await page.evaluate(() => __usb.bytes));
  const labels = await page.$$eval('#bars b', bs => bs.map(b => b.textContent));
  const table = all.filter(l => l[0] === '@'), confs = all.filter(l => l[0] === '#');
  check(JSON.stringify(table) === JSON.stringify(labels.map((n, i) => `@${i},${i === 1 ? 22 : i + 1},${n}`)) && all.indexOf(table.at(-1)) < all.indexOf(confs[0]),
    'class table sent first, with edited IDs', JSON.stringify(table));
  check(JSON.stringify(confs) === '["#90,10,0,0","#70,30,0,0"]', 'all confidences sent when one moves by 5+', JSON.stringify(confs));
  await page.$$eval('input.cid', els => { els[1].value = 5; els[1].dispatchEvent(new Event('change')); });
  await step(0.7, 400);
  check(lines(await page.evaluate(() => __usb.bytes)).includes('@1,5,' + labels[1]), 'table resent after an ID change');
  await page.close();
}

// 18. camera start is tolerant (falls back to an unconstrained request) and explains why it can't open
{
  const fails = { picky: ['OverconstrainedError', 'OverconstrainedError'], busy: ['NotReadableError', 'NotReadableError', 'NotReadableError'], none: ['NotFoundError', 'NotFoundError', 'NotFoundError'] };
  for (const [name, errs] of Object.entries(fails)) {
    const page = await ctx.newPage();
    await page.addInitScript(errs => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let n = 0;
      navigator.mediaDevices.getUserMedia = c => (n < errs.length ? Promise.reject(Object.assign(new Error('x'), { name: errs[n++] })) : real(c));
    }, errs);
    await page.goto(BASE);
    await page.click('#camStart');
    await page.waitForTimeout(1500);
    const st = await page.textContent('#status'), shown = await page.$eval('#canvas', e => !e.hidden);
    const ok = name === 'picky' ? shown : !shown && (name === 'busy' ? /in use by another/ : /No Camera found/).test(st);
    check(ok, `camera: ${name} device`, `${shown ? 'opened' : st}`);
    await page.close();
  }
}

// 19. what can be typed or scanned: link, bare ID, model.json link, this app's share link
{
  const page = await open();
  const tm = id => `https://teachablemachine.withgoogle.com/models/${id}/`;
  const cases = [
    ['66wwsgmTN', tm('66wwsgmTN')], ['  _hpiK-Ruz ', tm('_hpiK-Ruz')], ['-8plkUnZl', tm('-8plkUnZl')],
    [tm('66wwsgmTN'), tm('66wwsgmTN')], [tm('66wwsgmTN') + 'model.json', tm('66wwsgmTN')],
    ['teachablemachine.withgoogle.com/models/66wwsgmTN', tm('66wwsgmTN')],
    ['https://ikaros-ch.github.io/tm-to-microbit/?model=66wwsgmTN', tm('66wwsgmTN')],
    ['https://ikaros-ch.github.io/tm-to-microbit/?model=' + encodeURIComponent('https://example.org/m/'), 'https://example.org/m/'],
    ['example.org/m', 'https://example.org/m/'], ['', ''],
  ];
  const got = await page.evaluate(cs => cs.map(([i]) => modelLink(i)), cases);
  const bad = cases.filter(([, want], i) => got[i] !== want).map(([i], k) => `${i} -> ${got[cases.findIndex(c => c[0] === i)]}`);
  check(!bad.length, 'model link / ID / share link are understood', bad.join(' | '));
  const strict = await page.evaluate(() => ['https://example.org/', 'hello world', 'hi', '', 'https://www.google.com/search?q=x'].map(s => modelLink(s, true)));
  check(strict.every(s => s === ''), 'QR codes that are not models are rejected', JSON.stringify(strict));
  await page.fill('#url', '_hpiK-Ruz');
  check(/image model/.test(await load(page)), 'a bare model ID loads the model');
  await page.close();
}

// 20. zoom: crop rectangle, slider, dragging, remembered
{
  const page = await open(MODELS.image);
  await load(page);
  const rect = await page.evaluate(() => { zoom = 2; cropX = cropY = .5; return cropRect(640, 480); });
  check(rect.s === 240 && rect.x === 200 && rect.y === 120, 'zoom 2 crops the centre quarter', JSON.stringify(rect));
  const edge = await page.evaluate(() => { cropX = 0; cropY = 1; return cropRect(640, 480); });
  check(edge.x === 0 && edge.y === 240, 'the crop stays inside the picture', JSON.stringify(edge));
  // The area of the camera picture that is drawn into the canvas (and so given to the model) follows the slider.
  await page.evaluate(() => { const orig = ctx.drawImage.bind(ctx); ctx.drawImage = (...a) => { window.__src = a.slice(1, 5); return orig(...a); }; });
  const drawn = async z => {
    await page.$eval('#zoom', (el, z) => { el.value = z; el.dispatchEvent(new Event('input')); }, z);
    await page.waitForTimeout(400);
    return page.evaluate(() => { const r = cropRect(video.videoWidth, video.videoHeight); return { src: window.__src, want: [r.x, r.y, r.s, r.s] }; });
  };
  await page.click('#zoomReset');
  const wide = await drawn(1), tight = await drawn(3);
  check(JSON.stringify(tight.src) === JSON.stringify(tight.want) && tight.src[2] === wide.src[2] / 3 && await page.textContent('#zv') === '3×',
    'zoom slider zooms the picture the model sees', `source square ${wide.src[2]} -> ${tight.src[2]}`);
  await page.$eval('#zoom', el => { el.value = 4; el.dispatchEvent(new Event('input')); });
  // drag the picture: the chosen area moves the other way (mirrored picture: the same way)
  const box = await page.locator('#canvas').boundingBox();
  const drag = async (dx, dy) => { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 }); await page.mouse.up(); };
  await page.$eval('#mirror', el => (el.checked = true));
  await page.evaluate(() => (cropX = cropY = .5));
  await drag(40, 0);
  const mirrored = await page.evaluate(() => [cropX, cropY]);
  await page.$eval('#mirror', el => (el.checked = false));
  await page.evaluate(() => (cropX = cropY = .5));
  await drag(40, 40);
  const plain = await page.evaluate(() => [cropX, cropY]);
  check(mirrored[0] > .5 && plain[0] < .5 && plain[1] < .5, 'dragging moves the chosen area', `mirrored ${mirrored.map(v => v.toFixed(3))} plain ${plain.map(v => v.toFixed(3))}`);
  await page.reload();
  check(await page.evaluate(() => [zoom, cropX < .5, $('zv').textContent]).then(r => r[0] === 4 && r[1] && r[2] === '4×'), 'zoom and area are remembered');
  await page.click('#zoomReset').catch(() => {}); // hidden until the camera runs: reset through the page instead
  await page.evaluate(() => { zoom = 1; cropX = cropY = .5; saveCrop(); });
  await page.close();
}

// 21. share the current model as a QR code that decodes to the app link
{
  const page = await open(MODELS.image);
  check(await page.isHidden('#share'), 'share button appears only once a model is loaded');
  await load(page);
  await page.click('#share');
  const src = await page.getAttribute('#qrImg', 'src');
  const link = await page.textContent('#shareLink');
  const decoded = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data;
  }, src);
  check(src.startsWith('data:image') && link.endsWith('?model=_hpiK-Ruz') && decoded === link, 'share shows a QR code of the app link with the model ID', `${link} / ${decoded}`);
  await page.click('#share');
  check(await page.isHidden('#shareBox'), 'share box closes');
  await page.close();
}

// 22. scan a QR code with the camera: bare ID, model link, app share link; other QR codes are refused
{
  const gen = (page, text) => page.evaluate(t => { const q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createDataURL(8, 4); }, text);
  const tm = 'https://teachablemachine.withgoogle.com/models/_hpiK-Ruz/';
  for (const [name, text, loads] of [['bare ID', '_hpiK-Ruz', true], ['model link', tm, true], ['app share link', 'https://ikaros-ch.github.io/tm-to-microbit/?model=_hpiK-Ruz', true], ['other website', 'https://example.org/', false]]) {
    const page = await open();
    await page.evaluate(src => (window.__qrSrc = src), await gen(page, text));
    const before = await page.inputValue('#url');
    await page.click('#scan');
    if (loads) {
      await page.waitForFunction(() => /image model/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
      check(await page.inputValue('#url') === tm && !(await page.evaluate(() => scanning)), `scan QR: ${name} loads the model`, await page.inputValue('#url'));
    } else {
      await page.waitForFunction(() => /not a Teachable Machine/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
      check(await page.evaluate(() => scanning) && await page.inputValue('#url') === before, `scan QR: ${name} is refused and scanning goes on`);
      await page.click('#scan');
      check(!(await page.evaluate(() => scanning)), 'scanning can be stopped');
    }
    check(!page.errors.length, `scan QR: ${name}: no console errors`, page.errors.slice(0, 2).join(' | '));
    await page.close();
  }
}

// 23. Greek: the new texts are translated
{
  const page = await open();
  await page.click('#lang');
  const el = await page.evaluate(() => [$('scan').textContent, $('share').textContent, $('zoom').closest('label').textContent.trim()]);
  check(el[0] === 'Σάρωση QR' && el[1] === 'Κοινοποίηση ως QR' && /^Ζουμ/.test(el[2]), 'Greek: scan, share and zoom', el.join(' | '));
  await page.close();
}

// 24. the two web buttons: pressed/released like the A and B buttons, over Bluetooth and USB
{
  for (const mode of ['ble', 'usb-v1', 'usb-v2']) {
    const page = await open();
    await page.evaluate(b => (window.__usbBulk = b), mode === 'usb-v2');
    const wb = async () => lines(await page.evaluate(m => (m === 'ble' ? __ble.bytes : __usb.bytes), mode)).filter(l => l[0] === '!');
    // not connected: pressing does nothing and breaks nothing
    await page.click('#wb1');
    await page.click(mode === 'ble' ? '#ble' : '#usb');
    await page.waitForTimeout(300);
    const box = async n => { const b = await page.locator('#wb' + n).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    let [x, y] = await box(1);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForTimeout(150);
    const heldClass = await page.$eval('#wb1', el => el.classList.contains('down') && el.getAttribute('aria-pressed') === 'true');
    await page.mouse.up();
    [x, y] = await box(2);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
    for (let i = 0; i < 5; i++) { await page.evaluate(() => { webButton(1, true); webButton(1, false); }); } // fast taps are not lost
    await page.focus('#wb2'); await page.keyboard.down('Space'); await page.keyboard.up('Space');
    await page.waitForTimeout(800);
    const got = await wb();
    const want = ['!1,1', '!1,0', '!2,1', '!2,0', ...Array(5).fill(['!1,1', '!1,0']).flat(), '!2,1', '!2,0'];
    check(JSON.stringify(got) === JSON.stringify(want) && heldClass, `web buttons over ${mode}`, JSON.stringify(got));
    // released when the page loses focus; a drop releases them on screen
    await page.evaluate(() => webButton(2, true));
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    await page.waitForTimeout(300);
    check((await wb()).slice(-2).join() === '!2,1,!2,0', `web button released on blur (${mode})`);
    await page.evaluate(() => webButton(1, true));
    await page.click('#disconnect');
    check(await page.$eval('#wb1', el => !el.classList.contains('down')), `web button released on screen when disconnected (${mode})`);
    check(!page.errors.length, `web buttons (${mode}): no console errors`, page.errors.slice(0, 2).join(' | '));
    await page.close();
  }
}

await browser.close();
server?.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
