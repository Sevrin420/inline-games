// Real-Chrome check of the Tweetcraft-style X card pages for Coop Sweep:
//  - builds games/coop-sweep/play/ (tools/build-play-pages.mjs)
//  - /coop-sweep/play/ at 480x480 in a cross-site iframe (the X player card):
//    game + bird art load through <base>, "Play in new tab" shows (top-right,
//    inside the frame, links to the full page), sign-in chip is there, a win
//    posts a name to the leaderboard
//  - /coop-sweep/play/ top-level: no "Play in new tab"; ?shot framed: none either
//  - /coop-sweep/x/ sends people to /coop-sweep/
//   CHROME_PATH=/usr/bin/google-chrome node test/browser-play-page.mjs
import { spawn, execFileSync } from 'node:child_process';
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
const repo = path.join(here, '..', '..');
const gamesDir = path.join(repo, 'games');
execFileSync(process.execPath, [path.join(repo, 'tools', 'build-play-pages.mjs')], { stdio: 'inherit' });

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const apiPort = await freePort(), topPort = await freePort();
const origin = `http://localhost:${apiPort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-browser-'));
const dbPath = path.join(dir, 'db.sqlite');
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(here, '..', 'src', 'server.js')], {
  env: { ...process.env, PORT: String(apiPort), DB_PATH: dbPath, PUBLIC_ORIGIN: origin, SIWE_DOMAIN: `localhost:${apiPort}`,
    COOKIE_DOMAIN: '', COOKIE_SECURE: 'false', TRUST_PROXY: '', DEV_STATIC_DIR: gamesDir, LOG_LEVEL: 'warn' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const top = http.createServer((req, res) => {
  const q = req.url.includes('shot') ? '?shot' : '';
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><title>fake x.com</title><body style="margin:0;background:#000"><iframe id="card" src="${origin}/coop-sweep/play/${q}" width="480" height="480" style="border:0"></iframe></body>`);
}).listen(topPort, '127.0.0.1');
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)); }

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const cleanup = async () => { await browser.close().catch(() => {}); srv.kill('SIGTERM'); top.close(); fs.rmSync(dir, { recursive: true, force: true }); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log(`  ok  ${m}`);

async function open(url, viewport, { embedded = false } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`requestfailed ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400 && !/\/auth\/me/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
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
async function winRun(page, frame) {
  await page.mouse.click(...await cellPt(frame, await frame.evaluate(() => window.__CS.idx(3, 4))));
  assert.equal(await state(frame), 'play');
  await wait(2300);
  let safe = await safeCells(frame);
  while (safe.length) { await page.mouse.click(...await cellPt(frame, safe[0])); safe = await safeCells(frame); }
  assert.equal(await state(frame), 'won');
}

try {
  // ---------------------------------------------------------- 480x480 X card, cross-site iframe
  const card = await open(`http://127.0.0.1:${topPort}/`, { width: 480, height: 480, deviceScaleFactor: 2 }, { embedded: true });
  const f = card.frame;
  assert.equal(new URL(f.url()).pathname, '/coop-sweep/play/');
  await f.waitForFunction(() => window.__CS.henImagesLoaded() === window.__CS.ART.length && window.__CS.ART.length > 0, { timeout: 8000 });
  await f.waitForFunction(() => window.__CS.lbReady, { timeout: 8000 });
  await f.waitForSelector('.mo-chip', { timeout: 8000 });
  const nt = await f.$eval('#mo-newtab', a => { const r = a.getBoundingClientRect(); return { href: a.href, target: a.target, text: a.textContent, r: [r.left, r.top, r.right, r.bottom] }; });
  assert.equal(nt.href, 'https://membersonly.cc/coop-sweep/'); assert.equal(nt.target, '_blank'); assert.match(nt.text, /Play in new tab/);
  assert.ok(nt.r[0] >= 0 && nt.r[1] >= 0 && nt.r[2] <= 480 && nt.r[3] <= 22, `button sits in the top strip: ${nt.r}`);
  await card.page.screenshot({ path: path.join(os.tmpdir(), 'play-card.png') });
  ok(`480x480 cross-site iframe: game + ${await f.evaluate(() => window.__CS.ART.length)} bird images load via <base>, sign-in chip shown, "Play in new tab" at [${nt.r.map(Math.round)}] -> ${nt.href}`);

  await winRun(card.page, f);
  await f.waitForSelector('.lb-form input', { timeout: 6000 });
  await (await f.$('.lb-form input')).type('Play Page');
  await (await f.$('.lb-form button')).click();
  await f.waitForFunction(() => { const m = document.querySelector('.lb-list li.me'); return m && /Play Page/.test(m.textContent); }, { timeout: 6000 });
  const rows = new DatabaseSync(dbPath, { readOnly: true }).prepare('SELECT name, game_id FROM leaderboard_entries').all();
  assert.deepEqual(rows.map(r => [r.name, r.game_id]), [['Play Page', 'coop-sweep']]);
  await card.page.screenshot({ path: path.join(os.tmpdir(), 'play-card-posted.png') });
  assert.deepEqual(card.errors, [], 'no errors in the card');
  ok('win in the card -> "Play Page" posted to the coop-sweep leaderboard (local test DB)');

  // ---------------------------------------------------------- top-level and ?shot: no button
  const solo = await open(`${origin}/coop-sweep/play/`, { width: 480, height: 480 });
  await solo.frame.waitForFunction(() => window.__CS.henImagesLoaded() === window.__CS.ART.length, { timeout: 8000 });
  assert.equal(await solo.frame.$('#mo-newtab'), null);
  assert.deepEqual(solo.errors, []);
  const shot = await open(`http://127.0.0.1:${topPort}/?shot`, { width: 480, height: 480 }, { embedded: true });
  await wait(500);
  assert.equal(await shot.frame.$('#mo-newtab'), null);
  ok('top-level /coop-sweep/play/: plays, no "Play in new tab"; framed ?shot: none either');

  // ---------------------------------------------------------- card page sends people to the game
  const xp = await browser.newPage();
  await xp.goto(`${origin}/coop-sweep/x/?v=4`, { waitUntil: 'load' });
  await xp.waitForFunction(() => location.pathname === '/coop-sweep/' && window.__CS && window.__CS.G, { timeout: 8000 });
  ok('/coop-sweep/x/?v=4 -> /coop-sweep/');

  console.log('play page browser checks passed');
  await cleanup();
} catch (e) {
  await cleanup();
  throw e;
}
