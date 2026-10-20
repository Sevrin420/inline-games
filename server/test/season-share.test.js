// v22: board seasons + admin reset, and TIME CARD share links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeApp, client } from './helpers.js';

const ADMIN = 'test-admin-token-0123456789abcdef';
const LT = { metric: 'survival', order: 'desc', outcome: 'died', minMs: 5000, maxMs: 7_200_000, maxScorePerSec: 15, postWindowHours: 2, top: 20, bestPerPlayer: true, nameMin: 1, nameMax: 12, blankName: 'ANON HEN', postsPerPlayer: 20 };
const CS = { metric: 'duration', order: 'asc', outcome: 'win', minMs: 2000, postWindowHours: 24 };
const GAMES = [{ id: 'last-tower', title: 'Zombie Farm', access: 'open', leaderboard: LT }, { id: 'coop-sweep', title: 'Coop Sweep', access: 'open', leaderboard: CS }];
const LTB = '/plays/leaderboard/last-tower', CSB = '/plays/leaderboard/coop-sweep';

async function setup() {
  const ctx = await makeApp({ games: GAMES, env: { ADMIN_TOKEN: ADMIN } });
  ctx.start = async (c, game = 'last-tower') => { const s = await c.post('/plays/start', { game_id: game }); assert.equal(s.status, 201); return s.json.play_id; };
  ctx.run = async (c, ms, kills, meta = {}) => {
    const id = await ctx.start(c); ctx.clock.t += ms;
    assert.equal((await c.post(`/plays/${id}/end`, { outcome: 'died', score: kills, meta: { ms, ...meta } })).status, 200); return id;
  };
  ctx.post = async (c, id, name, game = 'last-tower') => { ctx.clock.t += 1000; return c.post(`/plays/leaderboard/${game}`, { play_id: id, name }); };
  ctx.reset = (body, token = ADMIN, game = 'last-tower') => client(ctx.app).post(`/plays/leaderboard/${game}/reset`, body, token ? { 'x-admin-token': token } : {});
  return ctx;
}

test('board GET serves season 1 by default; admin reset wipes only that board, closes its open plays and bumps the season', async () => {
  const { app, db, run, post, start, reset, clock } = await setup();
  const a = client(app), b = client(app);
  assert.equal((await a.get(LTB)).json.season, 1);
  assert.equal((await post(a, await run(a, 30_000, 10), 'SEV')).status, 201);
  assert.equal((await post(b, await run(b, 20_000, 5), 'BOK')).status, 201);
  const openLt = await start(a); // a stale unfinished play
  const cs = await start(b, 'coop-sweep'); clock.t += 5000;
  assert.equal((await b.post(`/plays/${cs}/end`, { outcome: 'win', score: 1 })).status, 200);
  assert.equal((await post(b, cs, 'Sweeper', 'coop-sweep')).status, 201);
  const openCs = await start(b, 'coop-sweep');
  assert.equal((await reset({ confirm: 'last-tower' }, null)).status, 403);
  assert.equal((await reset({ confirm: 'last-tower' }, 'wrong')).status, 403);
  assert.equal((await reset({})).json.error, 'confirm_required');
  assert.equal((await reset({ confirm: 'coop-sweep' })).json.error, 'confirm_required', 'confirm must name this board');
  const r = await reset({ confirm: 'last-tower' });
  assert.equal(r.status, 200);
  assert.equal(r.json.removed_entries, 2); assert.equal(r.json.closed_plays, 1); assert.equal(r.json.season, 2);
  const after = (await a.get(LTB)).json;
  assert.equal(after.total, 0); assert.deepEqual(after.top, []); assert.equal(after.me, null); assert.equal(after.season, 2);
  assert.equal(db.prepare('SELECT outcome FROM play_events WHERE id = ?').get(openLt).outcome, 'reset');
  assert.equal(db.prepare('SELECT ended_at FROM play_events WHERE id = ?').get(openCs).ended_at, null, 'coop-sweep plays untouched');
  const csb = (await b.get(CSB)).json; assert.equal(csb.total, 1); assert.equal(csb.season, 1, 'coop-sweep board untouched');
  // the old (closed) play can't be ended or posted; a fresh run posts to the new season
  assert.equal((await a.post(`/plays/${openLt}/end`, { outcome: 'died', score: 3 })).status, 409);
  assert.equal((await post(a, await run(a, 12_000, 4), 'NEWHEN')).status, 201);
  assert.equal((await a.get(LTB)).json.total, 1);
  assert.equal((await reset({ confirm: 'last-tower' })).json.season, 3);
  assert.equal((await client(app, { origin: 'https://evil.example' }).post(`${LTB}/reset`, { confirm: 'last-tower' }, { 'x-admin-token': ADMIN })).status, 403, 'origin check');
});

test('share: a link for a finished run with server-recorded stats; page has og/twitter tags; PNG is 1200x675', async () => {
  const { app, run, post, start } = await setup();
  const a = client(app), other = client(app);
  const id = await run(a, 222_560, 312, { ach: 12 });
  assert.equal((await post(a, id, 'SEV7')).status, 201);
  const sneaky = await a.post('/plays/share/last-tower', { play_id: id, ms: 999_999_999, kills: 99999, rank: 1, name: 'HACKER' });
  assert.equal(sneaky.status, 201);
  const s = sneaky.json;
  assert.equal(s.ms, 222_500); assert.equal(s.kills, 312); assert.equal(s.ach, 12); assert.equal(s.rank, 1); assert.equal(s.total, 1); assert.equal(s.name, 'SEV7');
  assert.match(s.id, /^[A-Za-z0-9_-]{12}$/); assert.equal(s.url, `https://membersonly.cc/plays/s/${s.id}`); assert.equal(s.image, `${s.url}.png`);
  assert.equal((await a.post('/plays/share/last-tower', { play_id: id })).json.id, s.id, 'one link per play');
  assert.equal((await other.post('/plays/share/last-tower', { play_id: id })).status, 404, 'only the owner');
  assert.equal((await a.post('/plays/share/last-tower', { play_id: await start(a) })).json.error, 'not_finished');
  assert.equal((await a.post('/plays/share/coop-sweep', { play_id: id })).status, 404);
  // an unposted run (not a personal best) can still be shared: the would-be rank, name from the request
  const id2 = await run(other, 30_000, 20);
  const s2 = await other.post('/plays/share/last-tower', { play_id: id2, name: 'bok bok' });
  assert.equal(s2.status, 201); assert.equal(s2.json.rank, 2); assert.equal(s2.json.total, 2); assert.ok(s2.json.name && s2.json.name !== 'ANON HEN');
  const bad = await other.post('/plays/share/last-tower', { play_id: await run(other, 30_000, 20), name: 'FUCKER' });
  assert.equal(bad.json.name, 'ANON HEN');
  const page = await a.get(`/plays/s/${s.id}`);
  assert.equal(page.status, 200); assert.match(page.res.headers['content-type'], /text\/html/);
  const html = page.res.body;
  assert.ok(html.includes(`<meta property="og:image" content="${s.image}">`));
  assert.ok(html.includes(`<meta name="twitter:image" content="${s.image}">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(html.includes('SEV7 survived 03:42.5 on ZOMBIE FARM'));
  assert.ok(html.includes('Ranked #1 of 1'));
  const png = await a.get(`/plays/s/${s.id}.png`);
  assert.equal(png.status, 200); assert.equal(png.res.headers['content-type'], 'image/png');
  const buf = png.res.rawPayload;
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buf.readUInt32BE(16), 1200); assert.equal(buf.readUInt32BE(20), 675);
  assert.equal((await a.get('/plays/s/nope')).status, 404);
  assert.equal((await a.get('/plays/s/AAAAAAAAAAAA.png')).status, 404);
});

test('share card renderer is byte-identical in the game and the server', () => {
  const g = fs.readFileSync(new URL('../../games/last-tower/sharecard.js', import.meta.url), 'utf8');
  const sv = fs.readFileSync(new URL('../src/sharecard.js', import.meta.url), 'utf8');
  assert.equal(g, sv);
});
