import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, client, wallet, siwe, ANON_COOKIE } from './helpers.js';

const GAMES = [
  { id: 'lunch-rush', title: 'Lunch Rush', access: 'open' },
  { id: 'acct', title: 'Account game', access: 'account' },
  { id: 'wal', title: 'Wallet game', access: 'wallet' },
  { id: 'gated', title: 'NFT game', access: 'nft' },
];

test('anonymous play: anon cookie created, play recorded and fetched', async () => {
  const { app, db } = await makeApp({ games: GAMES });
  const c = client(app);
  const s = await c.post('/plays/start', { game_id: 'lunch-rush' });
  assert.equal(s.status, 201);
  assert.equal(s.json.player, 'anon');
  const ck = s.res.cookies.find(x => x.name === ANON_COOKIE);
  assert.ok(ck && ck.httpOnly && ck.secure && ck.sameSite === 'Lax');
  assert.equal(ck.maxAge, 365 * 86400);
  const e = await c.post(`/plays/${s.json.play_id}/end`, { outcome: 'completed', score: 42 });
  assert.equal(e.status, 200);
  const mine = await c.get('/plays/mine?game_id=lunch-rush');
  assert.equal(mine.json.stats.plays, 1);
  assert.equal(mine.json.stats.best, 42);
  const row = db.prepare('SELECT * FROM play_events').get();
  assert.equal(row.player_key, `anon:${ck.value}`);
  assert.equal(row.account_id, null);
  assert.equal(row.access_level, 'open');
});

test('server decides the player: client-supplied player fields are ignored, others cannot end your play', async () => {
  const { app, db } = await makeApp({ games: GAMES });
  const a = client(app);
  await a.post('/auth/signup', { username: 'lena', password: 'password1' });
  const s = await a.post('/plays/start', { game_id: 'lunch-rush', player_key: 'account:999', account_id: 999, started_at: '2000-01-01' });
  const row = db.prepare('SELECT * FROM play_events WHERE id = ?').get(s.json.play_id);
  assert.equal(row.player_key, `account:${row.account_id}`);
  assert.notEqual(row.account_id, 999);
  assert.notEqual(row.started_at, '2000-01-01');
  const other = client(app);
  await other.post('/auth/signup', { username: 'mike', password: 'password1' });
  assert.equal((await other.post(`/plays/${s.json.play_id}/end`, { score: 1 })).status, 404);
  assert.equal((await client(app).post(`/plays/${s.json.play_id}/end`, { score: 1 })).status, 404);
  assert.equal((await a.post(`/plays/${s.json.play_id}/end`, { score: 7 })).status, 200);
  assert.equal((await a.post(`/plays/${s.json.play_id}/end`, { score: 8 })).status, 409, 'ends once');
});

test('anonymous history is claimed on signup, once', async () => {
  const { app, db } = await makeApp({ games: GAMES });
  const c = client(app);
  for (let i = 0; i < 2; i++) {
    const s = await c.post('/plays/start', { game_id: 'lunch-rush' });
    await c.post(`/plays/${s.json.play_id}/end`, { score: 10 + i });
  }
  const anonId = c.jar.get(ANON_COOKIE);
  const r = await c.post('/auth/signup', { username: 'nina', password: 'password1' });
  assert.equal(r.json.anonClaimed, true);
  assert.equal(c.jar.has(ANON_COOKIE), false, 'anon cookie cleared after claim');
  const id = r.json.account.accountId;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM play_events WHERE account_id = ? AND player_key = ?').get(id, `account:${id}`).n, 2);
  assert.equal(db.prepare('SELECT claimed_by_account_id c FROM anon_players WHERE anon_id = ?').get(anonId).c, id);
  assert.equal((await c.get('/plays/mine')).json.stats.best, 11);

  // Cross-account attempt: someone else presenting the same anon id gets nothing.
  const thief = client(app); thief.jar.set(ANON_COOKIE, anonId);
  const t = await thief.post('/auth/signup', { username: 'oscar', password: 'password1' });
  assert.equal(t.json.anonClaimed, false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM play_events WHERE account_id = ?').get(t.json.account.accountId).n, 0);
  // And a claimed anon id can't be used to start new anonymous plays.
  const reuse = client(app); reuse.jar.set(ANON_COOKIE, anonId);
  const s = await reuse.post('/plays/start', { game_id: 'lunch-rush' });
  assert.notEqual(reuse.jar.get(ANON_COOKIE), anonId, 'a fresh anon id is issued');
  assert.ok(s.json.play_id);
});

test('claim on login and on wallet link; embedded iframe claims via X-Anon-Id header', async () => {
  const { app, db } = await makeApp({ games: GAMES });
  await client(app).post('/auth/signup', { username: 'pia', password: 'password1' });
  // Embedded: no cookies, anon id travels in a header.
  const frame = client(app, { headers: { 'x-auth-mode': 'token' } });
  const s = await frame.post('/plays/start', { game_id: 'lunch-rush' });
  const anonId = s.json.anonId;
  assert.ok(anonId);
  frame.jar.clear(); // iframe in a cross-site context never sees the cookie
  const e = await frame.post(`/plays/${s.json.play_id}/end`, { score: 5 }, { 'x-anon-id': anonId });
  assert.equal(e.status, 200);
  const l = await frame.post('/auth/login', { username: 'pia', password: 'password1' }, { 'x-anon-id': anonId });
  assert.equal(l.json.anonClaimed, true);
  frame.token = l.json.token;
  assert.equal((await frame.get('/plays/mine')).json.stats.plays, 1);

  // Claim on link.
  const g = client(app);
  const s2 = await g.post('/plays/start', { game_id: 'lunch-rush' });
  await g.post(`/plays/${s2.json.play_id}/end`, { score: 3 });
  const anon2 = g.jar.get(ANON_COOKIE);
  g.jar.delete(ANON_COOKIE);
  await g.post('/auth/signup', { username: 'quinn', password: 'password1' });
  g.jar.set(ANON_COOKIE, anon2);
  const linked = await siwe(g, wallet(), 'link');
  assert.equal(linked.json.anonClaimed, true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM play_events WHERE account_id = ?').get(linked.json.account.accountId).n, 1);

  // /auth/claim after a popup sign-in.
  const h = client(app, { headers: { 'x-auth-mode': 'token' } });
  const s3 = await h.post('/plays/start', { game_id: 'lunch-rush' });
  const popup = client(app);
  await popup.post('/auth/login', { username: 'quinn', password: 'password1' });
  h.token = (await popup.post('/auth/token')).json.token;
  h.jar.clear();
  assert.equal((await h.post('/auth/claim', {}, { 'x-anon-id': s3.json.anonId })).json.claimed, true);
});

test('access levels: account, wallet, nft (with stubbed chain read)', async () => {
  const balances = new Map();
  const { app, reads, clock } = await makeApp({ games: GAMES, balances });
  const anon = client(app);
  assert.equal((await anon.post('/plays/start', { game_id: 'acct' })).status, 401);
  assert.equal((await anon.post('/plays/start', { game_id: 'nope' })).status, 404);
  const c = client(app);
  await c.post('/auth/signup', { username: 'rosa', password: 'password1' });
  assert.equal((await c.post('/plays/start', { game_id: 'acct' })).status, 201);
  assert.equal((await c.post('/plays/start', { game_id: 'wal' })).json.error, 'wallet_required');
  const w = wallet();
  await siwe(c, w, 'link');
  assert.equal((await c.post('/plays/start', { game_id: 'wal' })).status, 201);
  assert.equal((await c.post('/plays/start', { game_id: 'gated' })).json.error, 'nft_required');
  balances.set(w.address, 1n);
  clock.t += 60_000; // past the cache TTL
  const ok = await c.post('/plays/start', { game_id: 'gated' });
  assert.equal(ok.status, 201);
  const row = (await c.get('/plays/mine?game_id=gated')).json;
  assert.equal(row.stats.plays, 1);
  assert.equal((await c.get('/auth/me')).json.nftStatus, 'holder');
  // Sold the NFT: loses access on the next (uncached) check.
  balances.set(w.address, 0n);
  clock.t += 60_000;
  assert.equal((await c.post('/plays/start', { game_id: 'gated' })).json.error, 'nft_required');
  assert.ok(reads.length >= 3);
  assert.deepEqual((await c.get('/plays/access/gated')).json, { gameId: 'gated', access: 'nft', allowed: false, reason: 'nft_required' });
});

test('nft games fail clearly when the gate is not configured', async () => {
  const { app } = await makeApp({ games: GAMES, gateConfigured: false });
  const c = client(app);
  await c.post('/auth/signup', { username: 'sam', password: 'password1' });
  await siwe(c, wallet(), 'link');
  const r = await c.post('/plays/start', { game_id: 'gated' });
  assert.equal(r.status, 503);
  assert.equal(r.json.error, 'gate_unconfigured');
  assert.equal((await c.get('/auth/me')).json.nftStatus, 'unconfigured');
});

test('plays left open over 24h are closed with no outcome', async () => {
  const { app, clock, db } = await makeApp({ games: GAMES });
  const c = client(app);
  const s = await c.post('/plays/start', { game_id: 'lunch-rush' });
  clock.t += 25 * 3_600_000;
  assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { score: 99 })).json.error, 'stale');
  app.sweep();
  const row = db.prepare('SELECT ended_at, outcome, score FROM play_events WHERE id = ?').get(s.json.play_id);
  assert.ok(row.ended_at);
  assert.equal(row.outcome, null);
  assert.equal(row.score, null);
  assert.equal((await c.get('/plays/mine')).json.stats.completed, 0);
});

test('bad input on end is rejected; API responses are not cacheable', async () => {
  const { app } = await makeApp({ games: GAMES });
  const c = client(app);
  const s = await c.post('/plays/start', { game_id: 'lunch-rush' });
  assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { score: 1.5 })).json.error, 'bad_score');
  assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { outcome: 'DROP TABLE' })).json.error, 'bad_outcome');
  assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { meta: { x: 'y'.repeat(3000) } })).json.error, 'bad_meta');
  assert.equal(s.res.headers['cache-control'], 'no-store');
});

test('best respects scoreOrder and bestOutcome (time-to-clear games)', async () => {
  const { app } = await makeApp({ games: [{ id: 'sweep', title: 'Sweep', access: 'open', scoreOrder: 'asc', bestOutcome: 'win' }, { id: 'lunch-rush', title: 'LR', access: 'open' }] });
  const c = client(app);
  for (const [outcome, score] of [['loss', 5], ['win', 80], ['win', 42], ['loss', 3]]) {
    const s = await c.post('/plays/start', { game_id: 'sweep' });
    await c.post(`/plays/${s.json.play_id}/end`, { outcome, score });
  }
  const m = (await c.get('/plays/mine?game_id=sweep')).json;
  assert.equal(m.stats.plays, 4);
  assert.equal(m.stats.best, 42, 'fastest win, losses ignored');
  const s = await c.post('/plays/start', { game_id: 'lunch-rush' });
  await c.post(`/plays/${s.json.play_id}/end`, { score: 9 });
  assert.equal((await c.get('/plays/mine?game_id=lunch-rush')).json.stats.best, 9);
});

test('the shipped registry loads: Coop Sweep open with a time leaderboard, Lunch Rush has none', async () => {
  const { loadGames } = await import('../src/games.js');
  const g = loadGames(new URL('../games.json', import.meta.url).pathname);
  assert.deepEqual(g.get('coop-sweep'), { id: 'coop-sweep', title: 'Coop Sweep', access: 'open', scoreTrusted: false, scoreOrder: 'asc', bestOutcome: 'win',
    leaderboard: { metric: 'duration', order: 'asc', outcome: 'win', minMs: 2000, postWindowHours: 24 } });
  assert.equal(g.get('lunch-rush').scoreOrder, 'desc');
  assert.equal(g.get('lunch-rush').leaderboard, null);
});
