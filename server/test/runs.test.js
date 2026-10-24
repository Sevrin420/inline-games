import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, client, ANON_COOKIE } from './helpers.js';

const GAMES = [
  { id: 'sovereign', title: 'Sovereign', access: 'open', runs: { maxBytes: 8192 } },
  { id: 'lunch-rush', title: 'Lunch Rush', access: 'open', runs: null },
];
const put = (c, rid, run, x) => c.req('PUT', '/plays/run/sovereign', { rid, run }, x);
const del = (c, qs) => c.req('DELETE', `/plays/run/sovereign?${qs}`);

test('runs: guest stores, reads back and resumes its run; others cannot see or overwrite it', async () => {
  const { app } = await makeApp({ games: GAMES });
  const a = client(app);
  assert.deepEqual((await a.get('/plays/run/sovereign')).json, { run: null, rid: null, updated_at: null, ended: false });
  const p = await put(a, 'runAAAA1111', { day: 3, x: 1 });
  assert.equal(p.status, 200);
  assert.ok(a.jar.get(ANON_COOKIE), 'first PUT gives a guest id');
  const g = await a.get('/plays/run/sovereign?rid=runAAAA1111');
  assert.deepEqual(g.json.run, { day: 3, x: 1 });
  assert.equal(g.json.rid, 'runAAAA1111');
  assert.equal(g.json.ended, false);
  // another guest has its own (empty) slot and its writes never touch a's run
  const b = client(app);
  assert.equal((await b.get('/plays/run/sovereign')).json.run, null);
  assert.equal((await put(b, 'runAAAA1111', { day: 99 })).status, 200);
  assert.deepEqual((await a.get('/plays/run/sovereign')).json.run, { day: 3, x: 1 });
  // a forged guest id is ignored (not a known guest)
  const f = client(app); f.jar.set(ANON_COOKIE, '00000000-0000-4000-8000-000000000000');
  assert.equal((await f.get('/plays/run/sovereign')).json.run, null);
});

test('runs: death ends the run for good (no reviving it with a late upload)', async () => {
  const { app } = await makeApp({ games: GAMES });
  const a = client(app);
  await put(a, 'runBBBB2222', { day: 5 });
  assert.equal((await del(a, 'rid=runBBBB2222')).json.removed, 1);
  const g = await a.get('/plays/run/sovereign?rid=runBBBB2222');
  assert.equal(g.json.run, null);
  assert.equal(g.json.ended, true);
  const late = await put(a, 'runBBBB2222', { day: 5 });
  assert.equal(late.status, 410);
  assert.equal((await a.get('/plays/run/sovereign')).json.run, null);
  // a new run is fine
  assert.equal((await put(a, 'runCCCC3333', { day: 1 })).status, 200);
  // ending an old run id does not touch the current one
  assert.equal((await del(a, 'rid=runBBBB2222')).json.removed, 0);
  assert.deepEqual((await a.get('/plays/run/sovereign')).json.run, { day: 1 });
});

test('runs: power-cycle wipe (all=1) removes whatever is stored and tombstones it', async () => {
  const { app } = await makeApp({ games: GAMES });
  const a = client(app);
  await put(a, 'runDDDD4444', { day: 2 });
  assert.equal((await del(a, 'rid=runZZZZ0000&all=1')).json.removed, 1);
  assert.equal((await a.get('/plays/run/sovereign')).json.run, null);
  assert.equal((await put(a, 'runDDDD4444', { day: 2 })).status, 410);
  assert.equal((await a.get('/plays/run/sovereign?rid=runDDDD4444')).json.ended, true);
});

test('runs: validation, size cap, same-origin, unknown game', async () => {
  const { app } = await makeApp({ games: GAMES });
  const a = client(app);
  assert.equal((await put(a, 'x', { day: 1 })).status, 400);
  assert.equal((await put(a, 'runEEEE5555', [1, 2])).status, 400);
  assert.equal((await put(a, 'runEEEE5555', 'str')).status, 400);
  assert.equal((await put(a, 'runEEEE5555', { pad: 'x'.repeat(9000) })).status, 413);
  assert.equal((await put(a, 'runEEEE5555', { pad: 'x'.repeat(2_000_000) })).status, 413);
  assert.equal((await a.req('PUT', '/plays/run/lunch-rush', { rid: 'runEEEE5555', run: {} })).status, 404);
  assert.equal((await a.get('/plays/run/nope')).status, 404);
  assert.equal((await del(a, '')).status, 200, 'no player: nothing to delete');
  const evil = client(app, { origin: 'https://evil.example' });
  assert.equal((await put(evil, 'runEEEE5555', { day: 1 })).status, 403);
});

test('runs: signed-in run follows the account across devices; guest run moves to the account on sign-in', async () => {
  const { app } = await makeApp({ games: GAMES });
  const phone = client(app);
  await put(phone, 'runFFFF6666', { day: 4 });
  await phone.post('/auth/signup', { username: 'sev', password: 'password1' });
  assert.deepEqual((await phone.get('/plays/run/sovereign')).json.run, { day: 4 }, 'guest run claimed');
  const laptop = client(app);
  await laptop.post('/auth/login', { username: 'sev', password: 'password1' });
  assert.deepEqual((await laptop.get('/plays/run/sovereign')).json.run, { day: 4 });
  await put(laptop, 'runFFFF6666', { day: 6 });
  assert.deepEqual((await phone.get('/plays/run/sovereign')).json.run, { day: 6 });
  await del(laptop, 'rid=runFFFF6666');
  assert.equal((await phone.get('/plays/run/sovereign?rid=runFFFF6666')).json.ended, true);
  // a different account never sees it
  const other = client(app);
  await other.post('/auth/signup', { username: 'mike', password: 'password1' });
  await put(phone, 'runGGGG7777', { day: 1 });
  assert.equal((await other.get('/plays/run/sovereign')).json.run, null);
});

test('runs: token mode (embedded) guest gets its id back', async () => {
  const { app } = await makeApp({ games: GAMES });
  const c = client(app, { headers: { 'x-auth-mode': 'token' } });
  const p = await put(c, 'runHHHH8888', { day: 1 });
  assert.match(p.json.anonId, /^[0-9a-f-]{36}$/);
  const e = client(app, { headers: { 'x-anon-id': p.json.anonId } });
  assert.deepEqual((await e.get('/plays/run/sovereign')).json.run, { day: 1 });
});
