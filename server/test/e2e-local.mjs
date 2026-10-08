// Local end-to-end check against a REAL server process (no mocks):
// boots src/server.js on a free port with a throwaway DB, serves games/ too,
// then signs up, plays as a guest, claims, records a play, fetches it, signs
// in with a freshly generated wallet (SIWE), and checks the static pages.
//   npm run e2e
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = await new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const origin = `http://localhost:${port}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-e2e-'));

const env = {
  ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: path.join(dir, 'db.sqlite'),
  PUBLIC_ORIGIN: origin, SIWE_DOMAIN: `localhost:${port}`, COOKIE_DOMAIN: '', COOKIE_SECURE: 'false',
  TRUST_PROXY: '', DEV_STATIC_DIR: path.join(here, '..', '..', 'games'), LOG_LEVEL: 'warn',
};
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(here, '..', 'src', 'server.js')], { env, stdio: ['ignore', 'inherit', 'inherit'] });
const stop = () => { try { srv.kill('SIGTERM'); } catch { /* gone */ } fs.rmSync(dir, { recursive: true, force: true }); };
process.on('exit', stop);

for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 100));
}

function agent() {
  const jar = new Map();
  return async function call(method, url, body, headers = {}) {
    const h = { ...headers, ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}) };
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(origin + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    for (const sc of res.headers.getSetCookie()) {
      const [kv] = sc.split(';'); const i = kv.indexOf('=');
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (!v || /Max-Age=0/i.test(sc)) jar.delete(k); else jar.set(k, v);
    }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };
}

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ok  ${name}`); };

try {
  const p = agent();
  await step('config served', async () => {
    const r = await p('GET', '/auth/config');
    assert.equal(r.status, 200); assert.equal(r.json.siweDomain, `localhost:${port}`);
  });
  let guestBest;
  await step('guest plays Lunch Rush (anonymous play recorded)', async () => {
    const s = await p('POST', '/plays/start', { game_id: 'lunch-rush' });
    assert.equal(s.status, 201); assert.equal(s.json.player, 'anon');
    const e = await p('POST', `/plays/${s.json.play_id}/end`, { outcome: 'completed', score: 73, meta: { ms: 73400 } });
    assert.equal(e.status, 200); guestBest = 73;
  });
  await step('signup with username + password claims the guest play', async () => {
    const r = await p('POST', '/auth/signup', { username: 'e2e_player', password: 'a long password' });
    assert.equal(r.status, 201); assert.equal(r.json.anonClaimed, true);
  });
  await step('/auth/me returns the account', async () => {
    const r = await p('GET', '/auth/me');
    assert.equal(r.status, 200); assert.equal(r.json.username, 'e2e_player'); assert.equal(r.json.wallet, null);
  });
  await step('signed-in play recorded and fetched back', async () => {
    const s = await p('POST', '/plays/start', { game_id: 'lunch-rush' });
    assert.equal(s.json.player, 'account');
    await p('POST', `/plays/${s.json.play_id}/end`, { outcome: 'completed', score: 121 });
    const m = await p('GET', '/plays/mine?game_id=lunch-rush');
    assert.equal(m.json.player, 'account'); assert.equal(m.json.stats.plays, 2); assert.equal(m.json.stats.best, 121);
    assert.deepEqual(m.json.plays.map(x => x.score).sort((a, b) => a - b), [guestBest, 121]);
  });
  await step('logout, then login again', async () => {
    assert.equal((await p('POST', '/auth/logout', {})).status, 200);
    assert.equal((await p('GET', '/auth/me')).status, 401);
    assert.equal((await p('POST', '/auth/login', { username: 'E2E_PLAYER', password: 'a long password' })).status, 200);
  });
  const wal = privateKeyToAccount(generatePrivateKey());
  await step('link a wallet with SIWE', async () => {
    const n = await p('POST', '/auth/siwe/nonce', { purpose: 'link', address: wal.address });
    const r = await p('POST', '/auth/siwe/link', { message: n.json.message, signature: await wal.signMessage({ message: n.json.message }) });
    assert.equal(r.status, 200); assert.equal(r.json.account.wallet, wal.address);
  });
  await step('a new browser signs in with that wallet and lands on the same account', async () => {
    const q = agent();
    const n = await q('POST', '/auth/siwe/nonce', { purpose: 'login', address: wal.address });
    const r = await q('POST', '/auth/siwe/login', { message: n.json.message, signature: await wal.signMessage({ message: n.json.message }) });
    assert.equal(r.json.account.username, 'e2e_player');
    assert.equal((await q('GET', '/plays/mine')).json.stats.plays, 2);
  });
  await step('embedded (token) mode works without cookies', async () => {
    const f = agent();
    const r = await f('POST', '/auth/login', { username: 'e2e_player', password: 'a long password' }, { 'x-auth-mode': 'token' });
    assert.ok(r.json.token);
    const me = await fetch(`${origin}/auth/me`, { headers: { authorization: `Bearer ${r.json.token}` } }).then(x => x.json());
    assert.equal(me.username, 'e2e_player');
  });
  await step('static pages: Lunch Rush (card tags intact), shared client, account page', async () => {
    const g = await p('GET', '/lunch-rush/');
    assert.equal(g.status, 200);
    assert.match(g.text, /<meta name="twitter:card" content="player">/);
    assert.match(g.text, /<meta name="twitter:player" content="https:\/\/membersonly\.cc\/lunch-rush\/">/);
    assert.match(g.text, /src="\.\.\/shared\/auth\.js" async/);
    assert.equal((await p('GET', '/shared/auth.js')).status, 200);
    assert.equal((await p('GET', '/account/')).status, 200);
  });
  console.log(`\nE2E passed: ${steps.length} steps against ${origin}`);
  stop();
  process.exit(0);
} catch (e) {
  console.error('\nE2E FAILED after', steps.length, 'steps:', e);
  stop();
  process.exit(1);
}
