// Zombie Farm v22 TIME CARD + board season (LOCAL server only; it resets the local last-tower board). Run: start server/ on :8732 with
// DEV_STATIC_DIR=../games and ADMIN_TOKEN=<24+ chars>, then ADMIN_TOKEN=... DEV=iphone14|pixel7|desktop node tests/last-tower/timecard.pw.js
const { chromium } = require('playwright-core'); const fs = require('fs');
const dev = process.env.DEV || 'iphone14', OUT = process.env.OUT || '/tmp', BASE = process.env.BASE || 'http://localhost:8732';
const DEV = { iphone14: { width: 390, height: 844, dpr: 3, m: true }, pixel7: { width: 412, height: 915, dpr: 2.625, m: true }, desktop: { width: 1440, height: 860, dpr: 1, m: false } }[dev];
const ADMIN = process.env.ADMIN_TOKEN || ''; // the LOCAL server's token (the season test resets the local board)
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) { console.error('local server only'); process.exit(2); }
let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
async function ctxPage(b, extra = {}) { const c = await b.newContext({ viewport: { width: DEV.width, height: DEV.height }, isMobile: DEV.m, hasTouch: DEV.m, deviceScaleFactor: DEV.dpr, acceptDownloads: true, ...extra });
  const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return { c, p }; }
async function shot(p, f) { const s = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }); await p.screenshot({ path: `${OUT}/${f}`, clip: s }); }
async function run(p, secs) { // a real (server-timed) run with no damage, then die
  await p.evaluate(() => { __lt.newGame(); const L = __lt; L.TUNE.zDmg = L.TUNE.bDmg = L.TUNE.tDmg = 0; });
  await p.waitForFunction(() => RUN && RUN.play, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(secs * 1000); await p.evaluate(() => { G.kills = 42; die('test'); }); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  // ---- 1) season: reset the LOCAL board -> a device that remembers season 1 starts fresh
  const rs = await fetch(`${BASE}/plays/leaderboard/last-tower/reset`, { method: 'POST', headers: { 'x-admin-token': ADMIN, origin: BASE, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'last-tower' }) }).then((r) => r.json());
  ok(rs.ok && rs.season >= 2, `local reset: ${JSON.stringify(rs)}`);
  const { c, p } = await ctxPage(b);
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('lasttower.name2', 'OLDHEN'); localStorage.setItem('lasttower.ach1', '{"k25":1}'); localStorage.setItem('lasttower.lb1', '[{"name":"OLDHEN","ms":9000,"kills":1}]'); localStorage.setItem('lasttower.season', '1'); } });
  await p.goto(`${BASE}/last-tower/?boot=0&music=0&announcer=0&v=22c`); await p.waitForTimeout(2500);
  const ss = await p.evaluate(() => ({ name: localStorage.getItem('lasttower.name2'), ach: localStorage.getItem('lasttower.ach1'), lb: localStorage.getItem('lasttower.lb1'), season: localStorage.getItem('lasttower.season'), lbName, n: achCount(), wiped: SEASON.wiped }));
  ok(ss.name === null && ss.ach === null && ss.lb === null && ss.lbName === null && ss.n === 0 && +ss.season === rs.season, `season mismatch wipes name/achievements/device board: ${JSON.stringify(ss)}`);
  // ---- 2) a ranked run: name grid (blank, since the name was wiped) -> card with the rank
  await run(p, 6.2);
  await p.waitForTimeout(400); ok(await p.evaluate(() => NE.on && NE.name === ''), 'blank name grid after the season wipe');
  await p.evaluate(() => { NE.name = 'SEV7'; nameConfirm(); });
  const t0 = Date.now(); await p.waitForFunction(() => TC.on, null, { timeout: 4000 }).catch(() => {}); const tOpen = Date.now() - t0;
  ok(await p.evaluate(() => TC.on), `card opens right after the name (${tOpen} ms)`);
  await p.waitForFunction(() => { const o = tcStats(); return !o.pending; }, null, { timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => TC.link && TC.file, null, { timeout: 6000 }).catch(() => {});
  const st = await p.evaluate(() => ({ o: tcStats(), link: TC.link, file: !!TC.file, entry: RUN.entry, txt: tcText(tcStats()) }));
  ok(st.o.rank === 1 && !st.o.offline, `rank known: ${JSON.stringify(st.o)}`); ok(/\/plays\/s\/[A-Za-z0-9_-]{12}$/.test(st.link || ''), `share link ${st.link}`);
  console.log('share text:', st.txt);
  await p.waitForTimeout(400); await shot(p, `${dev}-timecard-top20.png`);
  // the server side of the link
  if (st.link) { const html = await fetch(st.link).then((r) => r.text()); const img = (html.match(/og:image" content="([^"]+)"/) || [])[1];
    ok(img && html.includes('twitter:card" content="summary_large_image"') && html.includes('SEV7 survived'), `share page og tags (${img})`);
    const png = Buffer.from(await fetch(img).then((r) => r.arrayBuffer())); ok(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 675, `server card PNG 1200x675 (${png.length} bytes)`);
    if (dev === 'iphone14') fs.writeFileSync(`${OUT}/server-card-top20.png`, png); }
  // SHARE: Web Share with files (stubbed to capture)
  await p.evaluate(() => { window.__sh = null; navigator.canShare = (d) => !!(d && d.files); navigator.share = (d) => { window.__sh = { n: d.files.length, type: d.files[0].type, size: d.files[0].size, text: d.text }; return Promise.resolve(); }; TC.cur = 1; });
  if (DEV.m) await p.touchscreen.tap(...await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(), q = TC.btns[1], k = r.width / N; return [r.left + (q[0] + q[2] / 2) * k, r.top + (q[1] + q[3] / 2) * k]; }));
  else await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(1500); const sh = await p.evaluate(() => window.__sh);
  ok(sh && sh.n === 1 && sh.type === 'image/png' && sh.size > 5000 && sh.text.includes(st.link), `Web Share got the PNG + text: ${JSON.stringify(sh)}`);
  // SHARE fallback: no file sharing -> X intent
  await p.evaluate(() => { navigator.canShare = undefined; window.__op = null; window.open = (u) => { window.__op = u; return {}; }; tcShare(tcStats()); });
  const op = await p.evaluate(() => window.__op); ok(op && op.startsWith('https://x.com/intent/post?text=') && op.includes(encodeURIComponent(st.link)) && op.includes(encodeURIComponent('Billions must bok')), `X intent fallback: ${op}`);
  // SAVE IMAGE
  const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await p.evaluate(() => tcSave(tcStats())); const d = await dl;
  if (d) { const f = `${OUT}/${dev}-timecard-saved.png`; await d.saveAs(f); const buf = fs.readFileSync(f); ok(buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 675, `SAVE IMAGE downloads ${d.suggestedFilename()} 1200x675`); } else ok(false, 'SAVE IMAGE download');
  // CONTINUE: a plain shoot goes on to the credits (focus back on CONTINUE), the same shot doesn't restart
  await p.evaluate(() => { TC.cur = 0; }); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !TC.on && G.state === 'dead'), 'shoot on CONTINUE closes the card into the credits (no restart)');
  await p.waitForTimeout(500); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300); ok(await p.evaluate(() => G.state !== 'dead'), 'next shoot restarts');
  ok(!p.errs.length, 'no page errors ' + JSON.stringify(p.errs)); await c.close();
  // ---- 3) offline card: the API is unreachable
  const o2 = await ctxPage(b); await o2.p.route('**/plays/**', (r) => r.abort()); await o2.p.route('**/auth/**', (r) => r.abort());
  await o2.p.addInitScript(() => { localStorage.setItem('lasttower.name2', 'BOKMASTER_99'); });
  await o2.p.goto(`${BASE}/last-tower/?boot=0&music=0&announcer=0&v=22c`); await o2.p.waitForTimeout(2500);
  await run(o2.p, 1.5); await o2.p.waitForFunction(() => TC.on, null, { timeout: 4000 }).catch(() => {}); await o2.p.waitForTimeout(700);
  const so = await o2.p.evaluate(() => ({ on: TC.on, o: tcStats() })); ok(so.on && so.o.offline, `offline card: ${JSON.stringify(so)}`);
  await shot(o2.p, `${dev}-timecard-offline.png`);
  await o2.p.evaluate(() => { window.__op = null; window.open = (u) => { window.__op = u; return {}; }; navigator.canShare = undefined; tcShare(tcStats()); });
  const op2 = await o2.p.evaluate(() => window.__op); ok(op2 && op2.includes(encodeURIComponent('https://membersonly.cc/zombie-farm/')), 'offline share falls back to the game URL');
  ok(!o2.p.errs.length, 'no page errors (offline) ' + JSON.stringify(o2.p.errs));
  console.log('fails', fails); await b.close(); })();
