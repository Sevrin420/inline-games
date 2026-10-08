// Real-Chrome check of Coop Sweep:
//  - 480x480 inside a cross-site iframe (the X player card), mouse + keyboard
//  - phone size (390x844 @3x, touch), top-level page
//  - no API at all, and no hen art at all
// Plays automated runs, checks there are no console errors, and checks the
// runs land in the local server's database.
//   CHROME_PATH=/usr/bin/google-chrome node test/browser-coop-sweep.mjs [screenshot.png]
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
const shotPath = process.argv[2] || path.join(os.tmpdir(), 'coop-sweep-screenshot.png');
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const apiPort = await freePort(), topPort = await freePort(), barePort = await freePort();
const origin = `http://localhost:${apiPort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-browser-'));
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
const bare = http.createServer((req, res) => { // games with NO API behind them
  const f = path.join(gamesDir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(gamesDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(barePort, '127.0.0.1');
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)); }

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const cleanup = async () => { await browser.close().catch(() => {}); srv.kill('SIGTERM'); top.close(); bare.close(); fs.rmSync(dir, { recursive: true, force: true }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log(`  ok  ${m}`);
const plays = () => new DatabaseSync(dbPath, { readOnly: true }).prepare("SELECT * FROM play_events WHERE game_id = 'coop-sweep' ORDER BY id").all();

async function open(url, viewport, { embedded = false, block } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (block) { await page.setRequestInterception(true); page.on('request', r => (block.test(r.url()) ? r.abort() : r.continue())); }
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'load' });
  let frame = page.mainFrame();
  if (embedded) frame = await (await page.waitForSelector('#card')).contentFrame();
  await frame.waitForFunction(() => window.__CS && window.__CS.G);
  return { page, frame, errors };
}
// Screen point (top-page CSS px) of a logical point; the iframe sits at 0,0.
const pt = (frame, lx, ly) => frame.evaluate((x, y) => window.__CS.screen(x, y), lx, ly);
const cellPt = async (frame, i) => { const [x, y] = await frame.evaluate(j => window.__CS.cellCenter(j), i); return pt(frame, x, y); };
const state = frame => frame.evaluate(() => window.__CS.G.state);
// Indexes of cells by kind, read from the live game.
const cells = (frame, kind) => frame.evaluate(k => window.__CS.G.cells.map((c, i) => [c, i]).filter(([c]) =>
  k === 'safe' ? !c.hen && !c.open : k === 'hen' ? c.hen : k === 'unflaggedHen' ? c.hen && !c.flag : false).map(([, i]) => i), kind);

const tapper = (page, touch) => async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
async function longPress(page, x, y, touch) {
  if (touch) { await page.touchscreen.touchStart(x, y); await wait(520); await page.touchscreen.touchEnd(); }
  else { await page.mouse.move(x, y); await page.mouse.down(); await wait(520); await page.mouse.up(); }
}
// Win a fresh board with real taps: first tap, flag two hens (long-press), dig every safe patch.
async function winRun(page, frame, { touch = false, screenshot = null } = {}) {
  const tap = tapper(page, touch);
  const first = await frame.evaluate(() => window.__CS.idx(3, 4));
  await tap(...await cellPt(frame, first));
  assert.equal(await state(frame), 'play');
  const hens = await cells(frame, 'hen');
  for (const h of hens.slice(0, 2)) await longPress(page, ...await cellPt(frame, h), touch);
  assert.equal(await frame.evaluate(() => window.__CS.G.flags), 2, 'long-press flags');
  let safe = await cells(frame, 'safe'), n = 0;
  while (safe.length) {
    await tap(...await cellPt(frame, safe[0]));
    if (++n === 6 && screenshot) { await wait(450); await page.screenshot({ path: screenshot }); }
    safe = await cells(frame, 'safe');
  }
  assert.equal(await state(frame), 'won');
}

// After a win (with the API up) the leaderboard panel appears: the post form,
// or (for these very fast automated wins, under the 2 s floor) a view with a
// note. Dismiss it with its last button (Skip / Close).
async function skipBoard(frame) {
  await frame.waitForSelector('.lb-veil .lb-row .lb-btn', { timeout: 8000 });
  await frame.evaluate(() => [...document.querySelectorAll('.lb-row .lb-btn')].pop().click());
  assert.equal(await frame.$('.lb-veil'), null);
}

try {
  // ---------------------------------------------------------- 480x480 X card (cross-site iframe)
  const card = await open(`http://127.0.0.1:${topPort}/`, { width: 480, height: 480, deviceScaleFactor: 2 }, { embedded: true });
  const f = card.frame;
  await f.waitForFunction(() => window.__CS.henImagesLoaded() === 6);
  await f.waitForSelector('.mo-chip');
  const dpr = await f.evaluate(() => [document.getElementById('c').width, innerWidth, devicePixelRatio]);
  assert.equal(dpr[0], dpr[1] * dpr[2], 'canvas backing store matches devicePixelRatio');
  ok(`loads at 480x480 in a cross-site iframe; 6 hen images; canvas ${dpr[0]}px for ${dpr[1]}css @${dpr[2]}x`);
  await wait(1100); // let a second tick so the winning time is > 0
  await winRun(card.page, f, { screenshot: shotPath });
  await skipBoard(f);
  ok('run 1 (mouse): first click safe, two long-press flags, cleared the pasture -> won (leaderboard offered, skipped)');
  // restart via the hen button, then lose by digging a hen
  await wait(1000);
  await card.page.mouse.click(...await pt(f, 64, 11));
  assert.equal(await state(f), 'ready');
  await card.page.mouse.click(...await cellPt(f, 0));
  const hen = (await cells(f, 'hen'))[0];
  await card.page.mouse.click(...await cellPt(f, hen));
  assert.equal(await state(f), 'lost');
  ok('run 2 (mouse): dug up a hen -> lost (BAWK)');
  // flag mode toggle + keyboard, then R restarts mid-run (recorded as abandoned)
  await wait(1000);
  await card.page.mouse.click(...await pt(f, 64, 76)); // tap after the end panel = new game
  assert.equal(await state(f), 'ready');
  await card.page.mouse.click(...await pt(f, 78, 143)); // FLAG
  assert.equal(await f.evaluate(() => window.__CS.mode), 'flag');
  await card.page.mouse.click(...await cellPt(f, 63));
  assert.equal(await f.evaluate(() => window.__CS.G.cells[63].flag), true, 'flag mode tap flags');
  await card.page.mouse.click(...await pt(f, 50, 143)); // DIG
  await f.focus('canvas');
  await card.page.keyboard.press('ArrowLeft'); await card.page.keyboard.press('ArrowUp');
  await card.page.keyboard.press('Space');
  assert.equal(await state(f), 'play', 'keyboard dig started the run');
  await card.page.keyboard.press('ArrowUp'); await card.page.keyboard.press('f');
  // pause on tab hide
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const t0 = await f.evaluate(() => window.__CS.G.t); await wait(600);
  const [paused, t1] = await f.evaluate(() => [window.__CS.G.paused, window.__CS.G.t]);
  assert.ok(paused && t1 === t0, 'clock frozen while hidden');
  await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await card.page.mouse.click(...await pt(f, 64, 76));
  assert.equal(await f.evaluate(() => window.__CS.G.paused), false, 'tap resumes');
  await card.page.keyboard.press('r');
  assert.equal(await state(f), 'ready');
  ok('run 3: FLAG/DIG toggle, keyboard (arrows, Space, F, R), pause on tab hide and tap to resume');
  // first click is always safe: 40 fresh boards
  const safeFirst = await f.evaluate(() => {
    const C = window.__CS; let ok = 0;
    for (let k = 0; k < 40; k++) {
      C.restart(); const i = Math.floor(Math.random() * 64); C.reveal(i);
      const G = C.G, near = [i, ...G.cells.map((_, j) => j).filter(j => Math.abs(j % 8 - i % 8) <= 1 && Math.abs((j / 8 | 0) - (i / 8 | 0)) <= 1)];
      if (G.state !== 'lost' && near.every(j => !G.cells[j].hen) && G.cells.filter(c => c.hen).length === C.HENS) ok++;
    }
    C.restart(); return ok;
  });
  assert.equal(safeFirst, 40);
  ok('first dig is always safe (40/40 random boards), always exactly 10 hens');
  await wait(500);
  let rows = plays();
  const outcomes = rows.map(r => r.outcome);
  assert.deepEqual(outcomes.slice(0, 3), ['win', 'loss', 'abandoned']);
  assert.ok(rows.every(r => /^anon:/.test(r.player_key) && r.access_level === 'open'));
  assert.ok(rows[0].score >= 1 && Number.isInteger(rows[0].score));
  assert.equal(JSON.parse(rows[0].meta).board, '8x8/10');
  ok(`runs recorded from the iframe: ${outcomes.slice(0, 3).join(', ')} (win score ${rows[0].score}s)`);
  assert.deepEqual(card.errors, [], 'no console errors in the X card');

  // ---------------------------------------------------------- phone, touch, top-level
  const phone = await open(`${origin}/coop-sweep/`, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await phone.frame.waitForFunction(() => window.__CS.henImagesLoaded() === 6);
  assert.equal(await phone.frame.evaluate(() => document.getElementById('c').width), 390 * 3);
  await wait(1100);
  await winRun(phone.page, phone.frame, { touch: true });
  await skipBoard(phone.frame);
  const mine = await phone.page.evaluate(() => fetch('/plays/mine?game_id=coop-sweep').then(r => r.json()));
  assert.equal(mine.player, 'anon'); assert.equal(mine.stats.plays, 1); assert.ok(mine.stats.best >= 1);
  assert.deepEqual(phone.errors, []);
  ok(`phone 390x844 @3x with touch: tap digs, long-press flags, won; recorded via cookie (best ${mine.stats.best}s)`);
  // sign in from the chip, then a run goes to the account
  await phone.page.evaluate(() => window.MembersAuth.signup('sweeper_1', 'a long password'));
  await phone.page.touchscreen.tap(...await pt(phone.frame, 64, 11));
  await winRun(phone.page, phone.frame, { touch: true });
  await skipBoard(phone.frame);
  const last = plays().at(-1);
  assert.match(last.player_key, /^account:\d+$/); assert.equal(last.outcome, 'win');
  ok('signed in on the phone: next win recorded to the account');

  // ---------------------------------------------------------- no API, and no hen art
  const noApi = await open(`http://127.0.0.1:${barePort}/coop-sweep/`, { width: 480, height: 480 });
  await wait(400);
  assert.equal(await noApi.frame.$('.mo-chip'), null);
  await winRun(noApi.page, noApi.frame);
  assert.deepEqual(noApi.errors.filter(e => !/Failed to load resource/.test(e)), []);
  ok('no API: plays and wins normally, no sign-in chip, no script errors');
  const noArt = await open(`http://127.0.0.1:${barePort}/coop-sweep/`, { width: 480, height: 480 }, { block: /\/hens\// });
  await wait(400);
  assert.equal(await noArt.frame.evaluate(() => window.__CS.henImagesLoaded()), 0);
  await noArt.frame.evaluate(() => { const C = window.__CS; C.reveal(0); C.reveal(C.G.cells.findIndex(c => c.hen)); C.step(2); });
  assert.equal(await state(noArt.frame), 'lost');
  await noArt.page.screenshot({ path: path.join(os.tmpdir(), 'coop-sweep-no-art.png') });
  assert.deepEqual(noArt.errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e)), []);
  ok('hens/ folder missing: falls back to drawn paper hens, still playable');

  console.log(`\nCoop Sweep browser check passed. Gameplay screenshot: ${shotPath}`);
  await cleanup(); process.exit(0);
} catch (e) {
  console.error('\nCOOP SWEEP CHECK FAILED:', e);
  await cleanup(); process.exit(1);
}
