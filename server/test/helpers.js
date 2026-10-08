import { loadConfig } from '../src/config.js';
import { buildApp, SESSION_COOKIE, ANON_COOKIE } from '../src/app.js';
import { openDb } from '../src/db.js';
import { createGate } from '../src/nft.js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export const ORIGIN = 'https://membersonly.cc';

// Build an app on an in-memory DB with a controllable clock and a stubbed chain.
export async function makeApp({ env = {}, games, balances = new Map(), gateConfigured = true } = {}) {
  const cfg = loadConfig({ COOKIE_SECURE: 'true', TRUST_PROXY: '', ...env });
  const clock = { t: Date.parse('2026-10-08T00:00:00Z') };
  const now = () => clock.t;
  const db = openDb(':memory:');
  const reads = [];
  const gate = createGate({ ...cfg.gate, configured: gateConfigured, chainId: 4663, rpcUrl: 'stub', contract: '0x0000000000000000000000000000000000000001' }, {
    now,
    readBalance: async addr => { reads.push(addr); return balances.get(addr) ?? 0n; },
  });
  const gameMap = games ? new Map(games.map(g => [g.id, { scoreTrusted: false, ...g }])) : undefined;
  const app = await buildApp({ cfg, db, games: gameMap, gate: gateConfigured ? gate : createGate({ configured: false }), now });
  return { app, db, clock, reads, balances, cfg };
}

// A tiny cookie-jar client over app.inject.
export function client(app, { origin = ORIGIN, headers = {} } = {}) {
  const jar = new Map();
  const c = {
    jar,
    token: null,
    async req(method, url, body, extra = {}) {
      const h = { ...headers, ...extra };
      if (origin && method !== 'GET') h.origin = origin;
      if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
      if (c.token) h.authorization = `Bearer ${c.token}`;
      const res = await app.inject({ method, url, headers: h, ...(body !== undefined ? { payload: body } : {}) });
      for (const ck of res.cookies) {
        if (ck.maxAge === 0 || ck.value === '' || (ck.expires && ck.expires.getTime() < Date.now())) jar.delete(ck.name);
        else jar.set(ck.name, ck.value);
      }
      let json = null;
      try { json = res.json(); } catch { /* not json */ }
      return { status: res.statusCode, json, res };
    },
    get: (u, x) => c.req('GET', u, undefined, x),
    post: (u, b = {}, x) => c.req('POST', u, b, x),
  };
  return c;
}

export function wallet() {
  const acct = privateKeyToAccount(generatePrivateKey());
  return acct;
}

// Full SIWE round trip: get a server-built message, sign it, submit.
export async function siwe(c, acct, purpose, extra = {}, { tamper } = {}) {
  const n = await c.post('/auth/siwe/nonce', { purpose, address: acct.address });
  if (n.status !== 200) return n;
  let message = n.json.message;
  if (tamper) message = tamper(message, n.json);
  const signature = await acct.signMessage({ message });
  return c.post(`/auth/siwe/${purpose}`, { message, signature, ...extra });
}

export { SESSION_COOKIE, ANON_COOKIE };
