// Zombie Farm v21: announcer trigger-rule sim (rare callouts, shared 13 s cooldown, real multi-kills only, UT streak tiers).
// Run: serve games/ on :8732, then BASE=http://localhost:8732/last-tower/ CHROME=/usr/bin/google-chrome node tests/last-tower/announcer.pw.js
// The announcer clock (annNow) is replaced by a fake clock; the game loop is frozen. Exits 1 on any failure.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8732/last-tower/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const p = await (await b.newContext({ viewport: { width: 800, height: 800 } })).newPage(); const errs = [], bad = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto(BASE + '?flock=0&music=0&boot=0' + (process.env.Q || '')); await p.waitForTimeout(1500);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const W = (ms) => p.waitForTimeout(ms);
  // events: [t, 'kill'|'hit'|'die', n]  (n kills in the same frame)
  const run = async (events, until) => {
    await p.evaluate(() => { window.__ltNoLB = true; window.__fakeT = 0; window.annNow = () => window.__fakeT; __lt.newGame(); window.__ltFreeze = true; const G = __lt.G; G.hitN = 0; window.__ltAnnTry = []; for (const z of __lt.zombies) z.alive = false; });
    await W(450); // the Slayer timeout (350 ms, real time)
    let i = 0; for (let t = 0; t <= until; t = Math.round((t + 0.05) * 100) / 100) {
      const now = events.filter((e) => Math.abs(e[0] - t) < 0.025);
      await p.evaluate(([t, now]) => { window.__fakeT = t; const G = __lt.G;
        for (const [, ev, n] of now) { if (ev === 'kill') for (let k = 0; k < (n || 1); k++) achKill({ brute: false, thrower: false, x: 0, y: 0 }); if (ev === 'hit') hurtPlayer(1, null, 'THE UNDEAD FLOCK'); if (ev === 'die') die('TEST'); } }, [t, now]);
      if (now.length || ++i % 4 === 0) await W(60); // let the 50 ms announcer tick see this time
    }
    return p.evaluate(() => { window.__ltFreeze = false; return window.__ltAnnTry.slice(); });
  };
  let r;
  // 1. Slayer at start; routine kills (1.0 s apart) never speak except First Blood, which waits out the Slayer cooldown (13 s)
  r = await run(Array.from({ length: 20 }, (_, k) => [1 + k * 1.0, 'kill']), 22); ok(r[0] === 'slayer' && r.filter((k) => k !== 'slayer' && k !== 'firstblood').length === 0 && r.includes('firstblood'), 'routine kills: only Slayer + First Blood ' + JSON.stringify(r));
  // 2. one shotgun blast (4 kills in one frame) is NOT a multi-kill
  r = await run([[2, 'kill'], [28, 'kill', 4]], 30); ok(!r.some((k) => /double|triple|overkill|killtac/.test(k)), 'single blast of 4 -> no multi-kill ' + JSON.stringify(r));
  // 3. 3 kills 0.4 s apart after the cooldowns -> Triple Kill
  r = await run([[2, 'kill'], [28, 'kill'], [28.4, 'kill'], [28.8, 'kill']], 30); ok(r.includes('triple') && r.includes('firstblood'), 'first kill at 2 s (First Blood at ~13 s), kills 0.4 s apart x3 at 28 s -> Triple Kill ' + JSON.stringify(r));
  // 4. 0.7 s gaps are too slow for a multi-kill
  r = await run([[2, 'kill'], [28, 'kill'], [28.7, 'kill'], [29.4, 'kill']], 31); ok(!r.some((k) => /double|triple/.test(k)), '0.7 s gaps -> no multi-kill ' + JSON.stringify(r));
  // 5. two multi-kills 5 s apart: the second is dropped by the 13 s cooldown
  r = await run([[2, 'kill'], [28, 'kill'], [28.3, 'kill'], [33, 'kill'], [33.3, 'kill']], 35); ok(r.filter((k) => k === 'double').length === 1, 'cooldown drops the 2nd Double Kill ' + JSON.stringify(r));
  // 6. 25 kills without a hit -> Killing Spree (UT); a hit at 20 kills resets it
  const ks = (n, t0, gap) => Array.from({ length: n }, (_, k) => [t0 + k * gap, 'kill']);
  r = await run(ks(25, 1, 1.0), 40); ok(r.filter((k) => k === 'spree').length === 1, '25 clean kills -> Killing Spree ' + JSON.stringify(r));
  r = await run([...ks(20, 1, 1.0), [21.5, 'hit'], ...ks(10, 22, 1.0)], 40); ok(!r.includes('spree'), 'hit at 20 kills -> no Killing Spree by 30 kills ' + JSON.stringify(r));
  // 7. Game Over on death even inside the cooldown
  r = await run([[2, 'die']], 3); ok(r.includes('gameover'), 'death -> Game Over (forced) ' + JSON.stringify(r));
  const loaded = await p.evaluate(() => Object.keys(ANN.raw).length); ok(loaded >= 21, 'all clips requested at page load: ' + loaded);
  ok(!errs.length && !bad.length, 'no page errors / 404s ' + JSON.stringify(errs.concat(bad)));
  console.log('fails', fails); await b.close(); process.exit(fails ? 1 : 0);
})();
