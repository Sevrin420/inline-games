// Real-Chrome check of the shared handheld shell (games/shared/handheld) and Lunch Rush inside it.
// Static files only (no API), at 390x844 (phone, touch, @3x) and 1280x800 (desktop).
//   CHROME_PATH=/usr/bin/google-chrome node test/browser-handheld.mjs [screenshot-dir]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const gamesDir = path.join(here, '..', '..', 'games');
const shots = process.argv[2] || path.join(os.tmpdir(), 'handheld-shots');
fs.mkdirSync(shots, { recursive: true });
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const f = path.join(gamesDir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(gamesDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1');
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log(`  ok  ${m}`);
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESK = { width: 1280, height: 800, deviceScaleFactor: 1 };

async function open(url, viewport, ready) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // no API here, so auth.js's probe 404s; anything else is a real error
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(ready);
  await wait(250);
  return { page, errors };
}
const center = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
// press-and-hold on a control with touch (or mouse), then release
async function hold(page, sel, ms, { touch = true, dx = 0, dy = 0 } = {}) {
  const [x, y] = await center(page, sel);
  if (touch) { await page.touchscreen.touchStart(x + dx, y + dy); await wait(ms); await page.touchscreen.touchEnd(); }
  else { await page.mouse.move(x + dx, y + dy); await page.mouse.down(); await wait(ms); await page.mouse.up(); }
}
const tapCtl = (page, sel, opts) => hold(page, sel, 60, opts);

try {
  // ------------------------------------------------------------ demo page: key events
  for (const [vp, tag, layout] of [[PHONE, '390x844', 'port'], [DESK, '1280x800', 'land']]) {
    const { page, errors } = await open(`${base}/shared/handheld/demo.html`, vp, () => window.__HH && window.Handheld && window.Handheld.current);
    const info = await page.evaluate(() => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), H = window.Handheld.current;
      return { layout: H.layout, cw: c.width, rw: r.width, dpr: devicePixelRatio, inShell: !!c.closest('.hh-screen'),
        fits: (() => { const d = document.querySelector('.hh-device').getBoundingClientRect(); return d.left >= -1 && d.top >= -1 && d.right <= innerWidth + 1 && d.bottom <= innerHeight + 1; })() }; });
    assert.equal(info.layout, layout, `${tag} layout`); assert.ok(info.inShell); assert.ok(info.fits, 'whole handheld fits the viewport');
    assert.ok(Math.abs(info.cw - info.rw * Math.min(3, info.dpr)) <= 3, 'crisp canvas');
    const touch = !!vp.hasTouch;
    await hold(page, '.hh-dpad', 700, { touch, dx: 40 }); // right edge of the pad: hold -> repeats
    let log = await page.evaluate(() => window.__HH.log.splice(0));
    assert.deepEqual(log[0], ['down', 'ArrowRight', 'ArrowRight', 39, false]);
    assert.ok(log.filter(l => l[0] === 'down' && l[4]).length >= 3, 'press-and-hold repeats');
    assert.deepEqual(log.at(-1), ['up', 'ArrowRight', 'ArrowRight', 39, false]);
    assert.ok(await page.evaluate(() => window.__HH.P.x > 100), 'dot moved right');
    await tapCtl(page, '.hh-btn-a .hh-cap', { touch }); await tapCtl(page, '.hh-btn-b .hh-cap', { touch });
    await tapCtl(page, '.hh-start .hh-pill', { touch }); await tapCtl(page, '.hh-select .hh-pill', { touch });
    log = await page.evaluate(() => window.__HH.log.splice(0));
    assert.deepEqual(log.map(l => l[0] + ':' + l[2]), ['down:Space', 'up:Space', 'down:KeyX', 'up:KeyX', 'down:Enter', 'up:Enter', 'down:Escape', 'up:Escape']);
    ok(`${tag}: ${layout === 'port' ? 'portrait' : 'landscape'} shell fits, crisp canvas; D-pad hold sends ArrowRight + repeats; A/B/START/SELECT send Space/x/Enter/Escape`);
    if (touch) {
      // slide across the D-pad: right -> down -> left without lifting
      const [x, y] = await center(page, '.hh-dpad');
      const cdp = await page.createCDPSession();
      const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([px, py], id) => ({ x: px, y: py, id })) });
      await t('touchStart', [[x + 40, y]]); await wait(40);
      for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; await t('touchMove', [[x + Math.cos(a) * 40, y + Math.sin(a) * 40]]); await wait(15); }
      await t('touchEnd', []);
      log = await page.evaluate(() => window.__HH.log.filter(l => !l[4]).splice(0).map(l => l[0] + ':' + l[1]));
      await page.evaluate(() => window.__HH.log.splice(0));
      assert.ok(log.indexOf('down:ArrowDown') > log.indexOf('down:ArrowRight') && log.indexOf('down:ArrowLeft') > log.indexOf('up:ArrowRight'), 'slide: ' + log.join(' '));
      assert.equal(await page.evaluate(() => window.__HH.held.size), 0, 'nothing stuck');
      // two fingers: hold UP on the pad and A at the same time
      const [ax, ay] = await center(page, '.hh-btn-a .hh-cap');
      await t('touchStart', [[x, y - 40]]); await wait(30);
      await t('touchStart', [[x, y - 40], [ax, ay]]); await wait(60);
      const both = await page.evaluate(() => [...window.__HH.held].sort());
      await t('touchEnd', [[x, y - 40]]); await t('touchEnd', []);
      assert.deepEqual(both, [' ', 'ArrowUp']);
      assert.equal(await page.evaluate(() => window.__HH.held.size), 0);
      ok(`${tag}: slide across the D-pad (right -> down -> left), two-finger UP + A together, all released`);
      const noZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.hh-root')).touchAction + '/' + getComputedStyle(document.querySelector('.hh-root')).userSelect);
      assert.equal(noZoom, 'none/none');
    }
    // taps on the screen still reach the game, through the glass layers
    const [sx, sy] = await center(page, '#c');
    if (touch) await page.touchscreen.tap(sx, sy); else await page.mouse.click(sx, sy);
    const tap = await page.evaluate(() => window.__HH.taps.at(-1));
    assert.ok(Math.abs(tap[0] - 0.5) < 0.02 && Math.abs(tap[1] - 0.5) < 0.02 && tap[2]);
    await hold(page, '.hh-dpad', 450, { touch, dy: -40 });
    await page.screenshot({ path: path.join(shots, `demo-${tag}.png`) });
    assert.deepEqual(errors, []);
    ok(`${tag}: direct tap on the screen reaches the game canvas; no console errors`);
    await page.close();
  }

  // ------------------------------------------------------------ Lunch Rush
  const lrReady = () => window.__LR && window.__LR.G && window.Handheld && window.Handheld.current;
  for (const [vp, tag] of [[PHONE, '390x844'], [DESK, '1280x800']]) {
    const touch = !!vp.hasTouch;
    const { page, errors } = await open(`${base}/lunch-rush/`, vp, lrReady);
    await page.evaluate(() => { localStorage.clear(); });
    const meta = await page.evaluate(() => [document.querySelector('meta[name="twitter:card"]').content, document.querySelector('meta[property="og:image"]').content]);
    assert.deepEqual(meta, ['summary_large_image', 'https://membersonly.cc/lunch-rush/previ.png']);
    await wait(1500); // boot flash
    await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-title.png`) });
    assert.equal(await page.evaluate(() => window.__LR.mode), 'title');
    await tapCtl(page, '.hh-start .hh-pill', { touch });
    assert.equal(await page.evaluate(() => window.__LR.mode), 'play', 'START starts a run');
    // D-pad moves the cursor; A taps where it is
    const c0 = await page.evaluate(() => window.Handheld.current.cursor);
    await hold(page, '.hh-dpad', 500, { touch, dy: 40 });
    const c1 = await page.evaluate(() => window.Handheld.current.cursor);
    assert.ok(c1.shown && c1.y > c0.y + 0.1 && Math.abs(c1.x - c0.x) < 0.01, 'cursor moved down');
    // aim the cursor at an empty board tile and press A
    const target = await page.evaluate(() => {
      const L = window.__LR, scr = document.querySelector('.hh-screen').getBoundingClientRect();
      const [lx, ly] = L.P(1.5, 3.5), [x, y] = L.screen(lx, ly);
      window.Handheld.current.setCursor((x - scr.left) / scr.width, (y - scr.top) / scr.height); return [x, y];
    });
    await tapCtl(page, '.hh-btn-a .hh-cap', { touch });
    assert.deepEqual(await page.evaluate(() => window.__LR.sel), { c: 1, r: 3 }, 'A tapped the tile under the cursor');
    await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-cursor-menu.png`) });
    await tapCtl(page, '.hh-btn-b .hh-cap', { touch });
    assert.equal(await page.evaluate(() => window.__LR.sel), null, 'B deselects');
    // a real tap on the screen still selects directly
    if (touch) await page.touchscreen.tap(...target); else await page.mouse.click(...target);
    assert.deepEqual(await page.evaluate(() => window.__LR.sel), { c: 1, r: 3 }, 'direct tap selects');
    assert.equal(await page.evaluate(() => window.Handheld.current.cursor.shown), false, 'direct tap hides the cursor');
    ok(`${tag} Lunch Rush: START starts, D-pad moves the cursor, A taps the tile under it, B deselects, direct taps still work`);

    // themes, screen effect, hide/show; remembered
    await page.click('.hh-menu .hh-mbtn:nth-child(1)'); await page.click('.hh-menu .hh-mbtn:nth-child(2)');
    assert.deepEqual(await page.evaluate(() => [window.Handheld.current.theme, window.Handheld.current.fx]), ['grape', 'lcd']);
    await wait(1200);
    await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-grape-lcd.png`) });
    await page.evaluate(() => window.Handheld.current.setTheme('clear', true));
    await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-clear.png`) });
    for (const th of ['yolk', 'midnight', 'classic']) { await page.evaluate(t => window.Handheld.current.setTheme(t, true), th); if (tag === '390x844') await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-${th}.png`) }); }
    await page.evaluate(() => { window.Handheld.current.setTheme('grape', true); window.Handheld.current.setFx('glass', true); });
    await page.click('.hh-menu .hh-mbtn:nth-child(3)'); // HIDE
    await wait(100);
    const off = await page.evaluate(() => { const c = document.getElementById('c'), r = c.getBoundingClientRect(); return [window.Handheld.current.visible, r.width === innerWidth && r.height === innerHeight, c.width]; });
    assert.equal(off[0], false); assert.ok(off[1], 'hidden: game fills the window');
    assert.equal(off[2], Math.round(vp.width * Math.min(2, vp.deviceScaleFactor)), 'hidden: canvas back to window size');
    await page.screenshot({ path: path.join(shots, `lunch-rush-${tag}-hidden.png`) });
    if (touch) await page.touchscreen.tap(...await center(page, '.hh-show')); else await page.click('.hh-show');
    assert.equal(await page.evaluate(() => window.Handheld.current.visible), true);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(lrReady);
    assert.deepEqual(await page.evaluate(() => [window.Handheld.current.theme, window.Handheld.current.fx, window.Handheld.current.visible]), ['grape', 'glass', true], 'settings remembered');
    ok(`${tag} Lunch Rush: THEME/FX/HIDE buttons work, hidden mode is full-window, settings remembered across reloads`);
    assert.deepEqual(errors, []);
    await page.evaluate(() => localStorage.clear());
    await page.close();
  }

  // ------------------------------------------------------------ opt-outs
  const shot = await open(`${base}/lunch-rush/?shot`, { width: 1200, height: 630 }, () => window.__LR && window.__LR.G);
  assert.equal(await shot.page.$('.hh-root'), null, '?shot never wraps (card image capture)');
  const none = await open(`${base}/lunch-rush/?handheld=0`, DESK, lrReady);
  assert.equal(await none.page.evaluate(() => window.Handheld.current.visible), false);
  assert.deepEqual([...shot.errors, ...none.errors], []);
  ok('?shot (card capture) is never wrapped; ?handheld=0 starts hidden');

  console.log(`\nHandheld browser check passed. Screenshots in ${shots}`);
  await browser.close(); srv.close(); process.exit(0);
} catch (e) {
  console.error('\nHANDHELD CHECK FAILED:', e);
  await browser.close().catch(() => {}); srv.close(); process.exit(1);
}
