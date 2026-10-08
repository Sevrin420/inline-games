import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, client, ANON_COOKIE } from './helpers.js';
import { cleanName, isBlocked, escapeHtml } from '../src/names.js';

const ADMIN = 'test-admin-token-0123456789abcdef';
const LB = { metric: 'duration', order: 'asc', outcome: 'win', minMs: 2000, postWindowHours: 24 };
const GAMES = [
  { id: 'coop-sweep', title: 'Coop Sweep', access: 'open', scoreOrder: 'asc', bestOutcome: 'win', leaderboard: LB },
  { id: 'lunch-rush', title: 'Lunch Rush', access: 'open', leaderboard: null },
  { id: 'hi-score', title: 'Score game', access: 'open', leaderboard: { metric: 'score', order: 'desc', outcome: null, minMs: 0, postWindowHours: 24 } },
];
const B = '/plays/leaderboard/coop-sweep';

async function setup(env = { ADMIN_TOKEN: ADMIN }) {
  const ctx = await makeApp({ games: GAMES, env });
  // A finished play lasting `ms` of server time. The client-sent score is junk on purpose.
  ctx.play = async (c, ms, outcome = 'win', game = 'coop-sweep', score = 1) => {
    const s = await c.post('/plays/start', { game_id: game });
    assert.equal(s.status, 201);
    ctx.clock.t += ms;
    if (outcome) assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { outcome, score })).status, 200);
    return s.json.play_id;
  };
  // Step the clock past the per-player/per-IP post limits before each post.
  ctx.post = async (c, playId, name, game = 'coop-sweep') => { ctx.clock.t += 31_000; return c.post(`/plays/leaderboard/${game}`, { play_id: playId, name }); };
  return ctx;
}

test('a win can be posted once; the ranked time is the server-measured duration, not the client score', async () => {
  const { app, play, post } = await setup();
  const c = client(app);
  const id = await play(c, 31_250);
  const pre = await c.get(`${B}?play_id=${id}`);
  assert.equal(pre.status, 200);
  assert.deepEqual(pre.json.candidate, { play_id: id, eligible: true, value: 31_250, rank: 1 });
  assert.equal(pre.json.metric, 'duration_ms');
  assert.equal(pre.json.prefill, null, 'guests get no prefill');
  const r = await post(c, id, '  Hen   Wrangler ');
  assert.equal(r.status, 201);
  assert.deepEqual(r.json.entry, { rank: 1, id: r.json.entry.id, name: 'Hen Wrangler', value: 31_250 });
  assert.deepEqual(r.json.top.map(e => [e.rank, e.name, e.value, e.mine]), [[1, 'Hen Wrangler', 31_250, true]]);
  const again = await post(c, id, 'Again');
  assert.equal(again.status, 409); assert.equal(again.json.error, 'already_posted');
  assert.equal((await c.get(`${B}?play_id=${id}`)).json.candidate.error, 'already_posted');
  // a client can't smuggle a value in
  const id2 = await play(c, 40_000);
  const sneaky = await c.post(B, { play_id: id2, name: 'Sneaky', value: 1, score: 1, ms: 1 });
  assert.equal(sneaky.status, 201); assert.equal(sneaky.json.entry.value, 40_000);
});

test('only finished wins for this game, by their owner, can be posted', async () => {
  const { app, play, post, clock } = await setup();
  const owner = client(app);
  const loss = await play(owner, 30_000, 'loss');
  assert.equal((await post(owner, loss, 'Loser')).json.error, 'not_eligible');
  const abandoned = await play(owner, 30_000, 'abandoned');
  assert.equal((await post(owner, abandoned, 'Quitter')).status, 409);
  const open = await play(owner, 30_000, null);
  const o = await post(owner, open, 'Early');
  assert.equal(o.status, 409); assert.equal(o.json.error, 'not_finished');
  const tooFast = await play(owner, 1_500);
  assert.equal((await post(owner, tooFast, 'Speedy')).json.error, 'implausible');
  const otherGame = await play(owner, 30_000, 'win', 'lunch-rush');
  assert.equal((await post(owner, otherGame, 'Wrong')).json.error, 'wrong_game');
  assert.equal((await post(owner, otherGame, 'Wrong', 'lunch-rush')).status, 404, 'no board for lunch-rush');
  assert.equal((await owner.get('/plays/leaderboard/lunch-rush')).json.error, 'no_leaderboard');
  assert.equal((await owner.get('/plays/leaderboard/nope')).status, 404);
  assert.equal((await post(owner, 999_999, 'Ghost')).json.error, 'unknown_play');

  const win = await play(owner, 30_000);
  // another guest, a signed-in stranger, and nobody at all: all see "no such play"
  const guest = client(app); await play(guest, 30_000);
  const stranger = client(app); await stranger.post('/auth/signup', { username: 'stranger', password: 'password1' });
  for (const c of [guest, stranger, client(app)]) {
    const r = await post(c, win, 'Thief');
    assert.equal(r.status, 404); assert.equal(r.json.error, 'unknown_play');
    assert.equal((await c.get(`${B}?play_id=${win}`)).json.candidate.eligible, false);
  }
  // too late
  clock.t += 25 * 3_600_000;
  assert.equal((await post(owner, win, 'Late')).json.error, 'too_late');
  const fresh = await play(owner, 30_000);
  assert.equal((await post(owner, fresh, 'Owner')).status, 201);
});

test('names: trimmed, 1-16 chars, letters/numbers/spaces/_-. only, blocklist; output is escaped', async () => {
  const { app, play, post } = await setup();
  const c = client(app);
  const bad = ['', '   ', 'x'.repeat(17), '<script>', 'a&b', 'Hen 🐔', 'zero\u200bwidth', 'quote"s', 'semi;colon', 'fuck', 'F.u_c-k', 'fuuuuck', 'sh1t head', 'n1gger', 'big ass', 'A S S', 'Hitler88', null, 42, ['Bob']];
  const id = await play(c, 30_000);
  for (const name of bad) {
    const r = await post(c, id, name);
    assert.equal(r.status, 400, `rejected: ${JSON.stringify(name)}`);
    assert.match(r.json.error, /^(bad_name|name_not_allowed)$/);
  }
  for (const ok of ['Bo', 'A', 'Hen_Lady-2.0', 'x'.repeat(16), 'class act', 'Grape Ape', 'Cucumber', 'Titanic', 'Dickens fan']) {
    assert.deepEqual(cleanName(ok), { ok: true, name: ok }, ok);
  }
  assert.deepEqual(cleanName(' tab\there \n '), { ok: true, name: 'tab here' }, 'whitespace normalised');
  assert.equal(isBlocked('Assassin'), false); assert.equal(isBlocked('ass'), true); assert.equal(isBlocked('torpedo'), false); assert.equal(isBlocked('pedo'), true);
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  const r = await post(c, id, 'Good Name');
  assert.equal(r.status, 201, 'the play is still postable after rejected names');
});

test('ordering: fastest first, ties by who posted first, top 10 plus your own rank outside it', async () => {
  const { app, play, post } = await setup();
  const times = [50_000, 20_000, 35_000, 20_000, 90_000, 61_000, 44_000, 70_000, 33_000, 80_000, 99_000];
  const players = [];
  for (const [i, ms] of times.entries()) {
    const c = client(app); players.push(c);
    const id = await play(c, ms);
    assert.equal((await post(c, id, `P${i}`)).status, 201);
  }
  const slow = client(app);
  const sid = await play(slow, 120_000);
  assert.equal((await slow.get(`${B}?play_id=${sid}`)).json.candidate.rank, 12);
  const r = await post(slow, sid, 'Slowpoke');
  assert.equal(r.json.entry.rank, 12);
  assert.equal(r.json.top.length, 10);
  assert.deepEqual(r.json.top.map(e => e.name), ['P1', 'P3', 'P8', 'P2', 'P6', 'P0', 'P5', 'P7', 'P9', 'P4']);
  assert.deepEqual(r.json.top.map(e => e.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(r.json.top.every(e => !e.mine));
  assert.deepEqual(r.json.me, { rank: 12, id: r.json.entry.id, name: 'Slowpoke', value: 120_000 });
  assert.equal(r.json.total, 12);
  // a tie with the leader lands behind them
  const tie = client(app); const tid = await play(tie, 20_000);
  assert.equal((await tie.get(`${B}?play_id=${tid}`)).json.candidate.rank, 3);
  // my best entry is what "me" reports
  const p3 = players[3]; const better = await play(p3, 10_000);
  const b = await post(p3, better, 'P3 again');
  assert.equal(b.json.entry.rank, 1); assert.equal(b.json.me.rank, 1);
  assert.deepEqual(b.json.top.filter(e => e.mine).map(e => e.name), ['P3 again', 'P3']);
  // a public viewer sees the board but no "me"
  const viewer = await client(app).get(B);
  assert.equal(viewer.json.me, null); assert.equal(viewer.json.top[0].name, 'P3 again');
});

test('score-metric boards rank by score, highest first (generic per game)', async () => {
  const { app, play, post } = await setup();
  const a = client(app), b = client(app);
  const ia = await play(a, 5_000, 'completed', 'hi-score', 300);
  const ib = await play(b, 5_000, 'completed', 'hi-score', 900);
  await post(a, ia, 'Ann', 'hi-score');
  const r = await post(b, ib, 'Ben', 'hi-score');
  assert.equal(r.json.metric, 'score');
  assert.deepEqual(r.json.top.map(e => [e.name, e.value]), [['Ben', 900], ['Ann', 300]]);
});

test('signed-in players get their username prefilled; a guest entry follows them when they sign up', async () => {
  const { app, play, post } = await setup();
  const c = client(app);
  const id = await play(c, 30_000);
  await post(c, id, 'Guest Me');
  await c.post('/auth/signup', { username: 'henrietta_the_great', password: 'password1' });
  const r = await c.get(B);
  assert.equal(r.json.prefill, 'henrietta_the_gr', 'clipped to 16');
  assert.equal(r.json.me.name, 'Guest Me'); assert.equal(r.json.top[0].mine, true);
  const id2 = await play(c, 25_000);
  const p = await post(c, id2, r.json.prefill);
  assert.equal(p.status, 201); assert.deepEqual(p.json.top.map(e => e.mine), [true, true]);
});

test('embedded (X iframe) mode: guest id and session travel in headers, not cookies', async () => {
  const { app, clock } = await setup();
  const h = { 'x-auth-mode': 'token' };
  const c = client(app, { headers: h });
  const s = await c.post('/plays/start', { game_id: 'coop-sweep' });
  const anonId = s.json.anonId; assert.ok(anonId);
  c.jar.clear(); // a third-party frame never sends the cookie
  clock.t += 30_000;
  const x = { 'x-anon-id': anonId };
  assert.equal((await c.post(`/plays/${s.json.play_id}/end`, { outcome: 'win' }, x)).status, 200);
  assert.equal((await c.post(B, { play_id: s.json.play_id, name: 'Framed' })).status, 404, 'no guest id, no post');
  const r = await c.post(B, { play_id: s.json.play_id, name: 'Framed' }, x);
  assert.equal(r.status, 201); assert.equal(r.json.top[0].mine, true);
  assert.equal((await c.get(B, x)).json.me.name, 'Framed');
  assert.equal((await client(app, { origin: 'https://evil.example' }).post(B, { play_id: s.json.play_id, name: 'Framed' }, x)).status, 403, 'cross-site POST refused');
});

test('posting is rate limited', async () => {
  const { app, play } = await setup();
  const c = client(app);
  const codes = [];
  for (let i = 0; i < 8; i++) { const id = await play(c, 3_000); codes.push((await c.post(B, { play_id: id, name: `Spam${i}` })).status); }
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 201, 429, 429]);
});

test('admin: list and remove entries with ADMIN_TOKEN; removed entries vanish and the play stays spent', async () => {
  const { app, play, post } = await setup();
  const c = client(app);
  const id = await play(c, 30_000);
  const e = (await post(c, id, 'Rude Name')).json.entry;
  const keep = await play(client(app), 40_000);
  void keep;
  const del = (token, entry = e.id, origin) => client(app, origin ? { origin } : {}).req('DELETE', `${B}/entries/${entry}`, undefined, token ? { 'x-admin-token': token } : {});
  assert.equal((await del(null)).status, 403);
  assert.equal((await del('wrong-token-wrong-token-wrong')).status, 403);
  assert.equal((await del(ADMIN, e.id, 'https://evil.example')).status, 403, 'origin check still applies');
  assert.equal((await client(app).get(`${B}/admin`)).status, 403);
  const list = await client(app).get(`${B}/admin`, { 'x-admin-token': ADMIN });
  assert.equal(list.status, 200); assert.equal(list.json.entries[0].name, 'Rude Name'); assert.equal(list.json.entries[0].removed_at, null);
  const ok = await del(ADMIN);
  assert.equal(ok.status, 200); assert.deepEqual(ok.json, { ok: true, removed: { id: e.id, name: 'Rude Name', value: 30_000 } });
  assert.equal((await del(ADMIN)).status, 404, 'already removed');
  assert.equal((await del(ADMIN, 999)).status, 404);
  const board = await c.get(B);
  assert.equal(board.json.total, 0); assert.deepEqual(board.json.top, []); assert.equal(board.json.me, null);
  assert.equal((await post(c, id, 'Nice Name')).json.error, 'already_posted', 'a removed play cannot be reposted');
  assert.ok((await client(app).get(`${B}/admin`, { 'x-admin-token': ADMIN })).json.entries[0].removed_at);
});

test('admin endpoints are off without a (long enough) ADMIN_TOKEN', async () => {
  for (const env of [{}, { ADMIN_TOKEN: 'short' }]) {
    const { app } = await setup(env);
    const r = await client(app).req('DELETE', `${B}/entries/1`, undefined, { 'x-admin-token': 'short' });
    assert.equal(r.status, 503); assert.equal(r.json.error, 'admin_unconfigured');
  }
});

test('anon claim moves leaderboard entries only for the real owner', async () => {
  const { app, play, post, db } = await setup();
  const c = client(app);
  const id = await play(c, 30_000);
  await post(c, id, 'Mine');
  const anonId = c.jar.get(ANON_COOKIE);
  const thief = client(app); thief.jar.set(ANON_COOKIE, anonId);
  await c.post('/auth/signup', { username: 'realowner', password: 'password1' });
  await thief.post('/auth/signup', { username: 'thief', password: 'password1' });
  const row = db.prepare('SELECT player_key, account_id FROM leaderboard_entries').get();
  const owner = db.prepare("SELECT id FROM accounts WHERE username = 'realowner'").get().id;
  assert.deepEqual({ ...row }, { player_key: `account:${owner}`, account_id: owner });
});
