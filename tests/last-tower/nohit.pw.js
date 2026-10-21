// Last Tower v19 (+ Zombie Farm v25 queue): no-hit achievement regression sim (the "UNTOUCHABLE shows after I got hit" bug).
// Run: serve the repo's games/ dir (e.g. `npx http-server games -p 8732`), then
//   BASE=http://localhost:8732/last-tower/ CHROME=/usr/bin/google-chrome node tests/last-tower/nohit.pw.js
// Needs playwright-core. Exits 1 on any failure.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8732/last-tower/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 800, height: 800 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '?flock=0&music=0&announcer=0&boot=0'); await p.waitForTimeout(1500);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  // drive the achievement clock by hand: freeze the game loop, set the run clock, tick updateAch/drawAch ourselves
  const sim = (steps) => p.evaluate((steps) => {
    window.__ltNoLB = true; __lt.newGame(); window.__ltFreeze = true; const G = __lt.G; G.st = 0; G.lastHit = 0; G.hitN = 0; G.achQ = []; G.achGot = {}; G.achList = []; const shown = [], see = () => { const q = G.achQ[0]; if (q && q.t > 0 && !q.__seen) { q.__seen = 1; shown.push(...(q.ids || [q.id])); } }; // a card counts as shown once drawAch has started it
    const tick = (to) => { while (G.st < to - 1e-9) { G.st = Math.min(to, G.st + 0.1); updateAch(); drawAch(0.1); see(); } };
    for (const s of steps) { if (s.to != null) tick(s.to); if (s.hit) hurtPlayer(1, null, s.hit); if (s.pushCard) G.achQ.unshift({ id: 'k25', t: 0.5, isNew: false }); if (s.drain) { for (let i = 0; i < 200; i++) { drawAch(0.1); see(); } } }
    window.__ltFreeze = false; return { shown, got: Object.keys(G.achGot || {}), revoked: G.achRevoked || [], hidden: G.achHidden || [], hp: G.hp };
  }, steps);
  // 1. control: 61 s untouched -> clean1 earned and shown
  let r = await sim([{ to: 61 }, { drain: true }]); ok(r.shown.includes('clean1') && r.got.includes('clean1'), 'no hit for 61 s -> clean1 awarded ' + JSON.stringify(r));
  // 2. hit at 59 s (zombie melee) -> nothing at 60/61 s
  r = await sim([{ to: 59 }, { hit: 'THE UNDEAD FLOCK' }, { to: 61 }, { drain: true }]); ok(!r.shown.includes('clean1') && !r.got.includes('clean1'), 'melee hit at 59 s -> no clean1 ' + JSON.stringify(r));
  // 3. same for a rotten egg and a roostr stomp
  for (const cause of ['A ROTTEN EGG', 'A ZOMBIE ROOSTR']) { r = await sim([{ to: 30 }, { hit: cause }, { to: 75 }, { drain: true }]); ok(!r.shown.includes('clean1'), cause + ' at 30 s -> no clean1 by 75 s ' + JSON.stringify(r)); }
  // 4. the real bug: clean1 earned while another card is on screen, then a hit lands BEFORE it shows -> never shown.
  //    v25: it stays earned (counts toward x/100); only its card is skipped
  r = await sim([{ to: 59.95 }, { pushCard: true }, { to: 60.05 }, { hit: 'THE UNDEAD FLOCK' }, { drain: true }]);
  ok(!r.shown.includes('clean1') && r.got.includes('clean1') && r.hidden.includes('clean1') && !r.revoked.length, 'clean1 queued behind a card, hit before display -> card skipped, still earned ' + JSON.stringify(r));
  // 5. rebuilt streak after a hit still pays out (60 s clean after the hit)
  r = await sim([{ to: 20 }, { hit: 'THE UNDEAD FLOCK' }, { to: 81 }, { drain: true }]); ok(r.shown.includes('clean1'), 'hit at 20 s, clean until 81 s -> clean1 ' + JSON.stringify(r));
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  await b.close(); process.exit(fails ? 1 : 0);
})();
