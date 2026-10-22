// Zombie Farm v26 intro TOP 10: big centred overlay, credits-style countdown (#10 first ... #1 last), fast then a ~3 s hold on the top ranks (hen at his normal close-up spot). 10-entry / 1-entry / offline / slow board (every board GET is stubbed, nothing posts) + shoot-to-skip.
// Run: serve games/ (or the API with DEV_STATIC_DIR) on :8732, then DEV=iphone14|pixel7|desktop node tests/last-tower/intro-top10.pw.js
const { chromium } = require('playwright-core');
const dev = process.env.DEV || 'iphone14', OUT = process.env.OUT || '/tmp', BASE = process.env.BASE || 'http://localhost:8732';
const DEV = { iphone14: { width: 390, height: 844, dpr: 3, m: true }, pixel7: { width: 412, height: 915, dpr: 2.625, m: true }, desktop: { width: 1440, height: 860, dpr: 1, m: false } }[dev];
const NAMES = ['FEW', 'BOKMASTER_99', 'HENRIETTA', 'CLUCK.NORRIS', 'EGGSTERMINATR', 'YOLK-O', 'SEV7', 'PLUCKY', 'COOP_DE_GRACE', 'ANON HEN', 'ELEVENTH', 'TWELFTH', 'NO_13', 'NO_14'];
const board = (n) => ({ game_id: 'last-tower', metric: 'survival', order: 'desc', nameMax: 12, total: n, season: 2, me: null, prefill: null,
  top: NAMES.slice(0, n).map((nm, i) => ({ rank: i + 1, id: i + 1, name: nm.slice(0, 12), value: 0, ms: Math.round(122800 * Math.pow(0.82, i)), kills: 355 - i * 20, mine: false })) });
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  for (const kase of ['ten', 'one', 'offline', 'slow', 'skip']) {
    const ctx = await b.newContext({ viewport: { width: DEV.width, height: DEV.height }, isMobile: DEV.m, hasTouch: DEV.m, deviceScaleFactor: DEV.dpr }); const p = await ctx.newPage(); const errs = [], posts = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route('**/plays/**', async (r) => { const u = r.request().url(), m = r.request().method(); if (m !== 'GET') { posts.push(u); return r.abort(); }
      if (/\/plays\/leaderboard\/last-tower/.test(u)) { if (kase === 'offline') return r.abort();
        if (kase === 'slow') { await new Promise((res) => setTimeout(res, 9000)); return r.fulfill({ json: board(10) }).catch(() => {}); }
        return r.fulfill({ json: board(kase === 'one' ? 1 : 14) }); } return r.continue(); }); // 14 sent: only 10 may ever show
    await p.goto(BASE + '/last-tower/?flock=0&music=0&announcer=0&v=26i'); await p.waitForTimeout(1500);
    const tStart = Date.now(); await p.keyboard.press('Enter');
    const wait = async (tt) => { for (let i = 0; i < 600; i++) { const t = await p.evaluate(() => (STATE === 'intro' ? INTRO.t : 99)); if (t >= tt) return t; await p.waitForTimeout(10); } };
    const sx = await p.evaluate(() => document.getElementById('c').getBoundingClientRect()), clip = { x: sx.left, y: sx.top, width: sx.width, height: sx.height };
    if (kase === 'skip') { await wait(2.0); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300); ok(await p.evaluate(() => STATE === 'title'), `[${kase}] shoot skips the intro with the scroll up`); await ctx.close(); continue; }
    await p.evaluate(() => { window.__sm = []; const f = () => { if (STATE !== 'intro') return; if (ILB.show && ILB.drawn) __sm.push([INTRO.t, ILB.lastY]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const shot = async (tt, nm) => { await wait(tt); if (kase === 'ten' || kase === 'one') await p.screenshot({ path: `${OUT}/${dev}-intro-top10-${kase}-${nm}.png`, clip }); };
    await shot(0.9, 'fast'); await shot(2.0, 'closeup'); await shot(3.3, 'hold');
    const cu = await p.evaluate(() => ({ show: ILB.show && ILB.show.length, k: ILB.k, two: !!ILB.two, lh: ILB.lh, head: ILB.head, bar: ILB.bar, x0: ILB.x0, x1: ILB.x1, hen: ILB.hen, N, drawn: ILB.drawn || 0 }));
    await shot(4.9, 'title'); await p.waitForFunction(() => STATE !== 'intro', null, { timeout: 8000 }).catch(() => {}); const dur = (Date.now() - tStart) / 1000;
    const want = { ten: 10, one: 1, offline: 0, slow: 0 }[kase];
    ok((cu.show || 0) === want && (want ? cu.drawn > 10 : !cu.drawn), `[${kase}] ${want} rows scrolled (${JSON.stringify(cu)})`);
    if (want) { ok(cu.k >= 2 && cu.x0 >= 0 && cu.x1 <= cu.N && Math.abs((cu.x0 + cu.x1) / 2 - cu.N / 2) <= 1 && cu.hen === undefined, `[${kase}] big centred overlay: x${cu.k} font (${cu.two ? 'two' : 'one'}-line rows) spans ${cu.x0}..${cu.x1} of ${cu.N}; hen not shifted`);
      const sm = await p.evaluate(() => window.__sm), k = cu.k, lh = cu.lh, rowY = (y0, i) => y0 + cu.head + i * lh; // row i = rank i+1, text from y-2 to y+lh-5
      const first = []; for (let i = 0; i < want; i++) { const e = sm.find(([, y0]) => rowY(y0, i) + lh - 5 > cu.bar); first.push(e ? e[0] : 99); }
      ok(first.every((v, i) => i === 0 || v < first[i - 1]) || want === 1, `[${kase}] countdown order: #${want} appears first, #1 last (first-seen s: ${first.map((v, i) => '#' + (i + 1) + '@' + v.toFixed(2)).reverse().join(' ')})`);
      const yEnd = sm[sm.length - 1][1], hold = sm.filter(([tt, y0]) => y0 === yEnd && tt < 5.4), hs = hold.length ? hold[0][0] : 99;
      const onFull = []; for (let i = 0; i < want; i++) { const y = rowY(yEnd, i); if (y - 2 >= cu.bar && y + lh - 5 <= cu.N - cu.bar) onFull.push(i + 1); }
      const tFast = want > 3 ? sm.find(([, y0]) => rowY(y0, 3) + lh - 5 > cu.bar) : null; // when #4 shows up
      ok(5.4 - hs >= 2.8 && yEnd - 3 >= cu.bar && onFull[0] === 1 && onFull.length >= Math.min(3, want), `[${kase}] holds ${(5.4 - hs).toFixed(2)} s (from ${hs.toFixed(2)} s) with TOP 10 + #${onFull.join(', #')} fully on screen (x${k}, between the letterbox bars)`);
      if (tFast) ok(tFast[0] <= 2.0, `[${kase}] fast through the lower ranks: #10..#4 have all come in by ${tFast[0].toFixed(2)} s`); }
    ok(dur < 6.6, `[${kase}] intro not delayed (${dur.toFixed(2)} s from power-on to title)`);
    ok(!errs.length && !posts.length, `[${kase}] no page errors / no posts ${JSON.stringify(errs)} ${posts}`); await ctx.close(); }
  console.log('fails', fails); await b.close(); })();
