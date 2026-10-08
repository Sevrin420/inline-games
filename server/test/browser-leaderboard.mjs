// Real-Chrome check of the Coop Sweep leaderboard against a real local server:
//  - 480x480 inside a cross-site iframe (the X player card): win -> post a name
//    -> it's on the board, highlighted; trophy button and L key show the board;
//    viewing mid-run pauses the clock; a blocked name is refused, then a good one posts
//  - phone 390x844 @3x with touch, top-level: win -> tap the field -> type ->
//    "keyboard" shrinks the viewport -> field and Post stay visible -> posted
//  - server unreachable for the post: friendly message, no script errors
//  - no API at all: no trophy, no panel, no errors
//   CHROME_PATH=/usr/bin/google-chrome node test/browser-leaderboard.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const gamesDir = path.join(here, '..', '..', 'games');
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const apiPort = await freePort(), topPort = await freePort(), barePort = await freePort();
const origin = `http://localhost:${apiPort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-browser-'));
const dbPath = path.join(dir, 'db.sqlite');
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(here, '..', 'src', 'server.js')], {
  env: { ...process.env, PORT: String(apiPort), DB_PATH: dbPath, PUBLIC_ORIGIN: origin, SIWE_DOMAIN: `localhost:${apiPort}`,
    COOKIE_DOMAIN: '', COOKIE_SECURE: 'false', TRUST_PROXY: '', DEV_STATIC_DIR: gamesDir, LOG_LEVEL: 'warn' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const top = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><title>fake x.com</title><body style="margin:0;background:#000"><iframe id="card" src="${origin}/coop-sweep/" width="480" height="480" style="border:0"></iframe></body>`);
}).listen(topPort, '127.0.0.1');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const bare = http.createServer((req, res) => {
  const f = path.join(gamesDir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(gamesDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(barePort, '127.0.0.1');
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)); }

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const cleanup = async () => { await browser.close().catch(() => {}); srv.kill('SIGTERM'); top.close(); bare.close(); fs.rmSync(dir, { recursive: true, force: true }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log(`  ok  ${m}`);
const entries = () => new DatabaseSync(dbPath, { readOnly: true }).prepare(
  'SELECT e.*, p.started_at, p.ended_at FROM leaderboard_entries e JOIN play_events p ON p.id = e.play_id ORDER BY e.id').all();

async function open(url, viewport, { embedded = false, intercept } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (intercept) { await page.setRequestInterception(true); page.on('request', r => intercept(r)); }
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'load' });
  let frame = page.mainFrame();
  if (embedded) frame = await (await page.waitForSelector('#card')).contentFrame();
  await frame.waitForFunction(() => window.__CS && window.__CS.G);
  return { page, frame, errors };
}
const pt = (frame, lx, ly) => frame.evaluate((x, y) => window.__CS.screen(x, y), lx, ly);
const cellPt = async (frame, i) => { const [x, y] = await frame.evaluate(j => window.__CS.cellCenter(j), i); return pt(frame, x, y); };
const state = frame => frame.evaluate(() => window.__CS.G.state);
const safeCells = frame => frame.evaluate(() => window.__CS.G.cells.map((c, i) => [c, i]).filter(([c]) => !c.hen && !c.open).map(([, i]) => i));
const tapper = (page, touch) => async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
// Win with real taps (first dig, then every safe patch), keeping it > minMs (2s) of server time.
async function winRun(page, frame, { touch = false } = {}) {
  const tap = tapper(page, touch);
  await tap(...await cellPt(frame, await frame.evaluate(() => window.__CS.idx(3, 4))));
  assert.equal(await state(frame), 'play');
  await wait(2300);
  let safe = await safeCells(frame);
  while (safe.length) { await tap(...await cellPt(frame, safe[0])); safe = await safeCells(frame); }
  assert.equal(await state(frame), 'won');
}
const panelText = frame => frame.$eval('.lb-paper', e => e.innerText);
async function postName(page, frame, name, { touch = false } = {}) {
  await frame.waitForSelector('.lb-form input', { timeout: 6000 });
  const input = await frame.$('.lb-form input');
  if (touch) { const b = await input.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  else await input.click();
  await frame.evaluate(() => { document.querySelector('.lb-form input').value = ''; });
  await input.type(name);
  const btn = await frame.$('.lb-form button');
  if (touch) { const b = await btn.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else await btn.click();
}

try {
  // ---------------------------------------------------------- 480x480 X card
  const card = await open(`http://127.0.0.1:${topPort}/`, { width: 480, height: 480, deviceScaleFactor: 2 }, { embedded: true });
  const f = card.frame;
  await f.waitForFunction(() => window.__CS.lbReady, { timeout: 8000 });
  await f.waitForFunction(() => window.__CS.henImagesLoaded() === 6);
  await f.evaluate(() => window.__CS.step(0.1));
  await card.page.screenshot({ path: path.join(os.tmpdir(), 'lb-card-trophy.png') });
  ok('480x480 cross-site iframe: board reachable, trophy button shown');

  await winRun(card.page, f);
  await f.waitForSelector('.lb-form input', { timeout: 6000 });
  const pre = await panelText(f);
  assert.match(pre, /\d:\d\d\.\d/); assert.match(pre, /#1 on the board/);
  assert.equal(await f.$eval('.lb-form input', e => e.value), '', 'guest: nothing to prefill');
  await card.page.screenshot({ path: path.join(os.tmpdir(), 'lb-card-post.png') });
  // a blocked name is refused with a message, the form stays
  await postName(card.page, f, 'sh1t head');
  await f.waitForFunction(() => /allowed/.test(document.querySelector('.lb-err').textContent));
  await postName(card.page, f, 'Card Champ');
  await f.waitForFunction(() => { const m = document.querySelector('.lb-list li.me'); return m && /Card Champ/.test(m.textContent); }, { timeout: 6000 });
  assert.match(await panelText(f), /Posted! Card Champ is #1/);
  await card.page.screenshot({ path: path.join(os.tmpdir(), 'lb-card-posted.png') });
  let rows = entries();
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'Card Champ'); assert.match(rows[0].player_key, /^anon:/);
  assert.equal(rows[0].value, Date.parse(rows[0].ended_at) - Date.parse(rows[0].started_at), 'ranked by server-measured time');
  assert.ok(rows[0].value >= 2000);
  ok(`win -> blocked name refused -> "Card Champ" posted (${rows[0].value} ms server time), highlighted on the board`);
  const again = await f.$$('.lb-row .lb-btn');
  await again[0].click(); // Play again
  assert.equal(await f.$('.lb-veil'), null); assert.equal(await state(f), 'ready');
  ok('"Play again" closes the panel and starts a new board');

  // trophy button shows the board (with my entry), × closes; L opens, Escape closes
  const BTN = await f.evaluate(() => window.__CS.BTN.board);
  await card.page.mouse.click(...await pt(f, BTN.x, BTN.y));
  await f.waitForFunction(() => { const m = document.querySelector('.lb-list li.me'); return m && /Card Champ/.test(m.textContent); });
  await wait(600); await card.page.mouse.click(5, 5); // tap outside (view-only) closes
  assert.equal(await f.$('.lb-veil'), null, 'tap outside closes the view');
  await f.focus('canvas'); await card.page.keyboard.press('l');
  await f.waitForSelector('.lb-list');
  await card.page.keyboard.press('Escape');
  assert.equal(await f.$('.lb-veil'), null);
  // viewing mid-run pauses the clock
  await card.page.mouse.click(...await cellPt(f, await f.evaluate(() => window.__CS.idx(3, 4))));
  await card.page.mouse.click(...await pt(f, BTN.x, BTN.y));
  await f.waitForSelector('.lb-list');
  const t0 = await f.evaluate(() => window.__CS.G.t); await wait(500);
  assert.equal(await f.evaluate(() => [window.__CS.G.paused, window.__CS.G.t]).then(([p, t]) => p && t === t0), true, 'clock paused while viewing');
  await (await f.$('.lb-x')).click();
  assert.equal(await f.evaluate(() => window.__CS.G.paused), false, 'resumes on close');
  await f.evaluate(() => window.__CS.restart());
  ok('trophy button / L key show the board with my entry; tap outside, × and Escape close it; mid-run viewing pauses the clock');

  // Skip: second win, skip posting -> new game, nothing posted
  await winRun(card.page, f);
  await f.waitForSelector('.lb-form input', { timeout: 6000 });
  await (await f.$$('.lb-row .lb-btn')).at(-1).click();
  assert.equal(await f.$('.lb-veil'), null); assert.equal(await state(f), 'ready'); assert.equal(entries().length, 1);
  ok('"Skip" closes the panel, starts a new board, posts nothing');
  assert.deepEqual(card.errors, [], 'no console errors in the X card');

  // ---------------------------------------------------------- phone, touch
  const phone = await open(`${origin}/coop-sweep/`, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = phone.frame;
  await p.waitForFunction(() => window.__CS.lbReady, { timeout: 8000 });
  await winRun(phone.page, p, { touch: true });
  await p.waitForSelector('.lb-form input', { timeout: 6000 });
  assert.notEqual(await p.evaluate(() => document.activeElement && document.activeElement.tagName), 'INPUT', 'touch: no surprise keyboard');
  const input = await p.$('.lb-form input');
  const ib = await input.boundingBox(); await phone.page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await input.type('Phone Fan');
  // the on-screen keyboard takes the bottom half: field and Post must stay on screen
  await phone.page.setViewport({ width: 390, height: 360, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await wait(500);
  const vis = await p.evaluate(() => ['.lb-form input', '.lb-form button'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
  assert.deepEqual(vis, [true, true], 'field and Post visible with the keyboard up');
  assert.equal(await p.$eval('.lb-form input', e => e.value), 'Phone Fan');
  await phone.page.screenshot({ path: path.join(os.tmpdir(), 'lb-phone-keyboard.png') });
  const pb = await (await p.$('.lb-form button')).boundingBox(); await phone.page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await p.waitForFunction(() => { const m = document.querySelector('.lb-list li.me'); return m && /Phone Fan/.test(m.textContent); }, { timeout: 6000 });
  await phone.page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await wait(300);
  await phone.page.screenshot({ path: path.join(os.tmpdir(), 'lb-phone-posted.png') });
  rows = entries();
  assert.deepEqual(rows.map(r => r.name).sort(), ['Card Champ', 'Phone Fan']);
  const names = await p.$$eval('.lb-list li .n', els => els.map(e => e.textContent));
  const want = [...rows].sort((a, b) => a.value - b.value || a.id - b.id).map(r => r.name);
  assert.deepEqual(names, want, 'board ordered fastest first');
  assert.deepEqual(phone.errors, []);
  ok(`phone 390x844 @3x touch: tap field, type, keyboard-sized viewport keeps field + Post visible, posted; board order ${names.join(' < ')}`);

  // ---------------------------------------------------------- server unreachable when posting
  const flaky = await open(`http://127.0.0.1:${topPort}/`, { width: 480, height: 480 }, {
    embedded: true, intercept: r => (r.method() === 'POST' && /\/plays\/leaderboard\//.test(r.url()) ? r.abort() : r.continue()),
  });
  await flaky.frame.waitForFunction(() => window.__CS.lbReady, { timeout: 8000 });
  await winRun(flaky.page, flaky.frame);
  await postName(flaky.page, flaky.frame, 'Offline Olly');
  await flaky.frame.waitForFunction(() => /reach the leaderboard/.test(document.querySelector('.lb-err').textContent), { timeout: 10000 });
  assert.deepEqual(flaky.errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e)), []);
  ok('post fails (server unreachable): friendly retry message, no script errors');

  // ---------------------------------------------------------- no API at all
  const noApi = await open(`http://127.0.0.1:${barePort}/coop-sweep/`, { width: 480, height: 480 });
  await wait(800);
  assert.equal(await noApi.frame.evaluate(() => window.__CS.lbReady), false);
  await winRun(noApi.page, noApi.frame);
  await wait(2500);
  assert.equal(await noApi.frame.$('.lb-veil'), null);
  assert.deepEqual(noApi.errors.filter(e => !/Failed to load resource/.test(e)), []);
  ok('no API: no trophy, no panel after a win, no script errors');

  console.log('\nLeaderboard browser check passed. Screenshots: ' + os.tmpdir() + '/lb-*.png');
  await cleanup(); process.exit(0);
} catch (e) {
  console.error('\nLEADERBOARD CHECK FAILED:', e);
  await cleanup(); process.exit(1);
}
