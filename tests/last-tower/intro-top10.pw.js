// Zombie Farm v25 intro TOP 10 scroll: 10-entry / 1-entry / offline / slow board (every board GET is stubbed, nothing posts) + shoot-to-skip.
// Run: serve games/ (or the API with DEV_STATIC_DIR) on :8732, then DEV=iphone14|pixel7|desktop node tests/last-tower/intro-top10.pw.js
const { chromium } = require('playwright-core');
const dev = process.env.DEV || 'iphone14', OUT = process.env.OUT || '/tmp', BASE = process.env.BASE || 'http://localhost:8732';
const DEV = { iphone14: { width: 390, height: 844, dpr: 3, m: true }, pixel7: { width: 412, height: 915, dpr: 2.625, m: true }, desktop: { width: 1440, height: 860, dpr: 1, m: false } }[dev];
const NAMES = ['FEW', 'BOKMASTER_99', 'HENRIETTA', 'CLUCK.NORRIS', 'EGGSTERMINATR', 'YOLK-O', 'SEV7', 'PLUCKY', 'COOP_DE_GRACE', 'ANON HEN'];
const board = (n) => ({ game_id: 'last-tower', metric: 'survival', order: 'desc', nameMax: 12, total: n, season: 2, me: null, prefill: null,
  top: NAMES.slice(0, n).map((nm, i) => ({ rank: i + 1, id: i + 1, name: nm.slice(0, 12), value: 0, ms: Math.round(122800 * Math.pow(0.82, i)), kills: 355 - i * 20, mine: false })) });
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  for (const kase of ['ten', 'one', 'offline', 'slow', 'skip']) {
    const ctx = await b.newContext({ viewport: { width: DEV.width, height: DEV.height }, isMobile: DEV.m, hasTouch: DEV.m, deviceScaleFactor: DEV.dpr }); const p = await ctx.newPage(); const errs = [], posts = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/plays/**', async (r) => { const u = r.request().url(), m = r.request().method(); if (m !== 'GET') { posts.push(u); return r.abort(); }
      if (/\/plays\/leaderboard\/last-tower/.test(u)) { if (kase === 'offline') return r.abort();
        if (kase === 'slow') { await new Promise((res) => setTimeout(res, 9000)); return r.fulfill({ json: board(10) }).catch(() => {}); }
        return r.fulfill({ json: board(kase === 'one' ? 1 : 10) }); } return r.continue(); });
    await p.goto(BASE + '/last-tower/?flock=0&music=0&announcer=0&v=25i'); await p.waitForTimeout(1500);
    const tStart = Date.now(); await p.keyboard.press('Enter');
    const wait = async (tt) => { for (let i = 0; i < 600; i++) { const t = await p.evaluate(() => (STATE === 'intro' ? INTRO.t : 99)); if (t >= tt) return t; await p.waitForTimeout(10); } };
    const sx = await p.evaluate(() => document.getElementById('c').getBoundingClientRect()), clip = { x: sx.left, y: sx.top, width: sx.width, height: sx.height };
    if (kase === 'skip') { await wait(2.0); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300); ok(await p.evaluate(() => STATE === 'title'), `[${kase}] shoot skips the intro with the scroll up`); await ctx.close(); continue; }
    await wait(1.2); if (kase === 'ten' || kase === 'one') await p.screenshot({ path: `${OUT}/${dev}-intro-top10-${kase}-wide.png`, clip });
    await wait(2.2); const cu = await p.evaluate(() => ({ show: ILB.show && ILB.show.length, x0: ILB.x0, hen: ILB.hen, N, drawn: ILB.drawn || 0 }));
    if (kase === 'ten' || kase === 'one') await p.screenshot({ path: `${OUT}/${dev}-intro-top10-${kase}-closeup.png`, clip });
    await wait(3.4); await p.waitForFunction(() => STATE !== 'intro', null, { timeout: 8000 }).catch(() => {}); const dur = (Date.now() - tStart) / 1000;
    const want = { ten: 10, one: 1, offline: 0, slow: 0 }[kase];
    ok((cu.show || 0) === want && (want ? cu.drawn > 10 : !cu.drawn), `[${kase}] ${want} rows scrolled (${JSON.stringify(cu)})`);
    if (want) ok(cu.hen && cu.hen[1] <= cu.x0 - 2 && cu.hen[0] >= 0, `[${kase}] close-up hen ${cu.hen} clear of the column at x ${cu.x0}`);
    ok(dur < 6.6, `[${kase}] intro not delayed (${dur.toFixed(2)} s from power-on to title)`);
    ok(!errs.length && !posts.length, `[${kase}] no page errors / no posts ${JSON.stringify(errs)} ${posts}`); await ctx.close(); }
  console.log('fails', fails); await b.close(); })();
