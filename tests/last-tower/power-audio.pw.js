// Zombie Farm v22: power switch <-> audio. OFF silences everything (music, SFX, announcer) and suspends the AudioContext;
// ON restarts the music; off/on cycles never stack music loops or leak nodes; mute still wins while powered on.
// Run: serve games/ on :8732, then BASE=http://localhost:8732/last-tower/ DEV=iphone14|pixel7|desktop CHROME=/usr/bin/google-chrome node tests/last-tower/power-audio.pw.js
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8732/last-tower/', dev = process.env.DEV || 'desktop';
const DEV = { iphone14: { width: 390, height: 844, dpr: 3, m: true }, pixel7: { width: 412, height: 915, dpr: 2.625, m: true }, desktop: { width: 1440, height: 860, dpr: 1, m: false } }[dev];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: DEV.width, height: DEV.height }, isMobile: DEV.m, hasTouch: DEV.m, deviceScaleFactor: DEV.dpr })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // instrument WebAudio before the game loads: count oscillators / buffer sources created, and setInterval(musicTick) calls
  await p.addInitScript(() => { window.__nodes = { osc: 0, src: 0 }; const P = (window.AudioContext || window.webkitAudioContext).prototype;
    const co = P.createOscillator, cb = P.createBufferSource; P.createOscillator = function () { window.__nodes.osc++; return co.call(this); }; P.createBufferSource = function () { window.__nodes.src++; return cb.call(this); };
    const si = window.setInterval; window.__musicLoops = 0; window.setInterval = function (f, ms, ...a) { if (f && f.name === 'musicTick') window.__musicLoops++; return si.call(this, f, ms, ...a); };
    window.__ltNoLB = true; });
  await p.goto(BASE + '?flock=0'); await p.waitForTimeout(1500);
  let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const W = (ms) => p.waitForTimeout(ms);
  const tap = () => p.evaluate(() => { if (!window.__an && AC && PWR.gain) { const a = AC.createAnalyser(); a.fftSize = 2048; PWR.gain.connect(a); window.__an = a; } });
  const rms = () => p.evaluate(() => { const a = window.__an; if (!a) return -1; const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); let s = 0; for (const x of d) s += x * x; return Math.sqrt(s / d.length); });
  const peakRms = async (ms) => { let m = 0; for (let i = 0; i < ms / 50; i++) { m = Math.max(m, await rms()); await W(50); } return m; };
  const oscRate = async (ms) => { const a = await p.evaluate(() => window.__nodes.osc); await W(ms); return ((await p.evaluate(() => window.__nodes.osc)) - a) / (ms / 1000); };
  const st = () => p.evaluate(() => ({ state: __lt.state, power: Handheld.current && Handheld.current.power, ac: AC && AC.state, off: PWR.off, gate: PWR.gain && +PWR.gain.gain.value.toFixed(3), loops: window.__musicLoops, started: MUS.started }));
  const on = async () => { await p.keyboard.press('Enter'); await W(300); }, off = async () => { await p.keyboard.press('p'); };
  // first boot
  ok((await st()).power === false, 'visit starts powered OFF');
  await on(); await tap(); await W(1200);
  let s = await st(); const r1 = await oscRate(3000), a1 = await peakRms(1000);
  ok(s.power && s.ac === 'running' && s.loops === 1 && a1 > 0.005, `power ON -> music plays (rms ${a1.toFixed(4)}, ${r1.toFixed(1)} osc/s, loops ${s.loops}) ${JSON.stringify(s)}`);
  // off: silent within ~150 ms, context suspended, announcer refused
  await off(); await W(150); const a0 = await peakRms(100); s = await st();
  ok(s.off && (s.ac === 'suspended' || (a0 < 0.002 && s.gate < 0.01)), `power OFF -> silent within 150 ms (context ${s.ac}, gate ${s.gate}, rms ${a0.toFixed(5)}) ${JSON.stringify(s)}`);
  await W(400); s = await st(); const said = await p.evaluate(() => announce('slayer', 9, true)); const n0 = await p.evaluate(() => window.__nodes.osc); await W(1000); const n1 = await p.evaluate(() => window.__nodes.osc);
  ok(s.ac === 'suspended' && !said && n1 === n0, `while OFF: AudioContext suspended, announcer refused, 0 new oscillators (${n1 - n0}) ${JSON.stringify(s)}`);
  // 6 more off/on cycles (some fast) -> still one loop, same note rate, music back each time
  let rates = [];
  for (let i = 0; i < 6; i++) { await on(); await W(i % 2 ? 150 : 1200); if (i % 2 === 0) rates.push(await oscRate(2000)); await off(); await W(i % 2 ? 100 : 500); }
  await on(); const bar = await p.evaluate(() => MUS.bar); await W(1200); const rEnd = await oscRate(3000), aEnd = await peakRms(1000); s = await st();
  ok(s.loops === 1 && rEnd < r1 * 1.6 && rEnd > r1 * 0.4 && aEnd > 0.005 && rates.every((r) => r < r1 * 1.6), `after 7 off/on cycles: 1 music loop, note rate ${rEnd.toFixed(1)}/s vs ${r1.toFixed(1)}/s at first boot (cycles ${rates.map((r) => r.toFixed(1)).join(',')}), music back (rms ${aEnd.toFixed(4)})`);
  ok(s.state === 'intro' || s.state === 'title', 'power ON replays the intro / title: ' + s.state);
  // music restarts from bar 1 with the fade-in
  ok(bar <= 1, 'music restarted from the top (bar ' + bar + ')');
  // mute overrides power ON
  await p.evaluate(() => setMuted(true)); await W(300); const am = await peakRms(800), sm = await st(); ok(am < 0.002 || sm.ac === 'suspended', `powered ON + muted -> silent (rms ${am.toFixed(5)}, context ${sm.ac})`);
  await p.evaluate(() => setMuted(false)); await W(800); ok((await peakRms(1000)) > 0.005, 'unmute -> music again');
  // off while muted, on again: still muted state respected
  await p.evaluate(() => setMuted(true)); await off(); await W(500); await on(); await W(800); { const a = await peakRms(800), q = await st(); ok(a < 0.002 || q.ac === 'suspended', 'muted survives an off/on cycle (context ' + q.ac + ')'); }
  await p.evaluate(() => setMuted(false));
  // v22 visibility: a hidden tab suspends the context (no choppy 1 Hz music in the background), visible resumes it
  const vis = (h) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await W(600); await vis(true); await W(400); { const q = await st(), n0 = await p.evaluate(() => window.__nodes.osc); await W(1200); const n1 = await p.evaluate(() => window.__nodes.osc); ok(q.ac === 'suspended' && n1 === n0, `hidden tab: context ${q.ac}, ${n1 - n0} new oscillators`); }
  await vis(false); await W(900); { const q = await st(), a = await peakRms(800); ok(q.ac === 'running' && a > 0.005 && q.loops === 1, `visible again: context ${q.ac}, music rms ${a.toFixed(4)}, loops ${q.loops}`); }
  await off(); await W(400); await vis(true); await W(200); await vis(false); await W(500); ok((await st()).ac === 'suspended', 'powered OFF stays silent after hide/show');
  await on(); await W(800); ok((await peakRms(800)) > 0.005, 'power ON after hide/show -> music');
  ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
  console.log('fails', fails); await b.close(); process.exit(fails ? 1 : 0);
})();
