// Browser check of the X player-card situation, in real Chrome:
// a top page on one site (127.0.0.1) embeds Lunch Rush from another site
// (localhost) in a 480x480 iframe, like x.com does. Checks:
//   1. guest play works and is recorded (no cookies reach the frame)
//   2. signing in from the in-frame panel works, and the next play is the account's
//   3. the account popup signs in first-party and hands the frame a token
//   4. with NO API at all, the game still runs and shows no sign-in chip
// Needs Chrome: CHROME_PATH=/path/to/chrome npm run browser   (devDependency puppeteer-core)
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const gamesDir = path.join(here, '..', '..', 'games');
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const apiPort = await freePort(), topPort = await freePort(), bareGamesPort = await freePort();
const gameOrigin = `http://localhost:${apiPort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-browser-'));
const dbPath = path.join(dir, 'db.sqlite');

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(here, '..', 'src', 'server.js')], {
  env: { ...process.env, PORT: String(apiPort), DB_PATH: dbPath, PUBLIC_ORIGIN: gameOrigin, SIWE_DOMAIN: `localhost:${apiPort}`,
    COOKIE_DOMAIN: '', COOKIE_SECURE: 'false', TRUST_PROXY: '', DEV_STATIC_DIR: gamesDir, LOG_LEVEL: 'warn' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
// "x.com": a different site that iframes the game at the player-card size.
const embed = src => `<!doctype html><title>fake x.com</title><body style="margin:0;background:#000">
  <iframe id="card" src="${src}" width="480" height="480" style="border:0" allow="fullscreen"></iframe></body>`;
const top = http.createServer((req, res) => {
  const src = req.url.startsWith('/bare') ? `http://localhost:${bareGamesPort}/lunch-rush/` : `${gameOrigin}/lunch-rush/`;
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(embed(src));
}).listen(topPort, '127.0.0.1');
// Games served with NO API behind them (what happens if the backend is down).
const bare = http.createServer((req, res) => {
  const f = path.join(gamesDir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(gamesDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(res);
}).listen(bareGamesPort, '127.0.0.1');

for (let i = 0; i < 50; i++) { try { if ((await fetch(`${gameOrigin}/healthz`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)); }

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const cleanup = async () => { await browser.close().catch(() => {}); srv.kill('SIGTERM'); top.close(); bare.close(); fs.rmSync(dir, { recursive: true, force: true }); };
const db = () => new DatabaseSync(dbPath, { readOnly: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log(`  ok  ${m}`);

async function cardFrame(page, url) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 480, height: 480 });
  await page.goto(url, { waitUntil: 'load' });
  const handle = await page.waitForSelector('#card');
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => window.__LR && window.__LR.G);
  return { frame, errors };
}
// Start from the title screen, then run the sim until 3 misses end the run.
async function playOneRun(frame) {
  // the game-over screen ignores taps for its first second (fixes a timing flake)
  await frame.waitForFunction(() => window.__LR.mode !== 'over' || window.__LR.G.overT > 1);
  await frame.evaluate(() => window.__LR.tap(64, 100));
  await frame.waitForFunction(() => window.__LR.mode === 'play');
  await frame.evaluate(() => { for (let i = 0; i < 600 && window.__LR.mode !== 'over'; i++) window.__LR.step(1); });
  assert.equal(await frame.evaluate(() => window.__LR.mode), 'over');
  return frame.evaluate(() => Math.floor(window.__LR.G.t));
}

try {
  // 1. Guest play inside the cross-site iframe.
  const page = await browser.newPage();
  const { frame, errors } = await cardFrame(page, `http://127.0.0.1:${topPort}/`);
  assert.equal(await frame.evaluate(() => window.MembersAuth.embedded), true);
  await frame.waitForSelector('.mo-chip');
  assert.equal(await frame.$eval('.mo-chip', e => e.textContent), 'Guest \u00B7 Sign in');
  const guestScore = await playOneRun(frame);
  await wait(400);
  let rows = db().prepare('SELECT * FROM play_events ORDER BY id').all();
  assert.equal(rows.length, 1);
  assert.match(rows[0].player_key, /^anon:/);
  assert.equal(rows[0].score, guestScore);
  assert.equal(rows[0].outcome, 'completed');
  const ctx = await frame.evaluate(() => ({ cookie: document.cookie, anon: localStorage.getItem('mo_anon') }));
  assert.ok(ctx.anon, 'anon id kept in the frame\'s own storage');
  ok(`guest run recorded in the X-card iframe (score ${guestScore}s, ${rows[0].player_key.slice(0, 13)}…)`);

  // 2. Sign up from the in-frame panel.
  await frame.click('.mo-chip');
  await frame.waitForSelector('.mo-panel form');
  await frame.evaluate(() => [...document.querySelectorAll('.mo-panel button')].find(b => /Create account/.test(b.textContent)).click());
  await frame.waitForSelector('.mo-panel .mo-warn');
  await frame.type('.mo-panel input[type=text]', 'card_player');
  await frame.type('.mo-panel input[type=password]', 'a long password');
  await frame.click('.mo-panel button[type=submit]');
  await frame.waitForFunction(() => document.querySelector('.mo-chip').textContent.includes('card_player'));
  await frame.waitForFunction(() => /1 play/.test(document.querySelector('.mo-panel').textContent));
  ok('signed up from the in-frame panel; guest play claimed (panel shows 1 play)');
  await frame.evaluate(() => [...document.querySelectorAll('.mo-panel button')].find(b => b.textContent === 'Back to game').click());
  const acctScore = await playOneRun(frame);
  await wait(400);
  rows = db().prepare('SELECT * FROM play_events ORDER BY id').all();
  const acct = db().prepare("SELECT id FROM accounts WHERE username = 'card_player'").get();
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.account_id === acct.id && r.player_key === `account:${acct.id}`));
  assert.equal(rows[1].score, acctScore);
  ok(`signed-in run recorded to the account (score ${acctScore}s); both plays now account:${acct.id}`);
  assert.deepEqual(errors, []);

  // 3. Popup: sign out in the frame, sign in through the account window.
  await frame.evaluate(() => window.MembersAuth.logout());
  await frame.waitForFunction(() => document.querySelector('.mo-chip').textContent.startsWith('Guest'));
  const popupP = new Promise(r => browser.once('targetcreated', t => r(t.page())));
  await frame.evaluate(() => window.MembersAuth.openAccountWindow());
  const popup = await popupP;
  await popup.waitForSelector('#login-form');
  await popup.waitForFunction(() => !document.getElementById('signin').classList.contains('hide'));
  await popup.type('#u', 'card_player');
  await popup.type('#p', 'a long password');
  await popup.click('#login-form button[type=submit]');
  await frame.waitForFunction(() => document.querySelector('.mo-chip').textContent.includes('card_player'), { timeout: 5000 });
  ok('account popup signed in first-party and handed the iframe a token');

  // 4. No API at all: game still fully playable, no chip, no errors.
  const p2 = await browser.newPage();
  const bareRun = await cardFrame(p2, `http://127.0.0.1:${topPort}/bare`);
  await wait(500);
  assert.equal(await bareRun.frame.$('.mo-chip'), null);
  assert.equal(await bareRun.frame.evaluate(() => window.MembersAuth && window.MembersAuth.available), false);
  await playOneRun(bareRun.frame);
  assert.deepEqual(bareRun.errors, []);
  ok('with no API behind it, Lunch Rush plays as before and shows no sign-in chip');

  await page.screenshot({ path: path.join(os.tmpdir(), 'lunch-rush-card.png') });
  console.log(`\nBrowser check passed. Screenshot: ${path.join(os.tmpdir(), 'lunch-rush-card.png')}`);
  await cleanup();
  process.exit(0);
} catch (e) {
  console.error('\nBROWSER CHECK FAILED:', e);
  await cleanup();
  process.exit(1);
}
