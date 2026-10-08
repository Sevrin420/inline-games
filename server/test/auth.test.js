import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, client, SESSION_COOKIE } from './helpers.js';

test('signup sets an HttpOnly session cookie and /auth/me works', async () => {
  const { app, db } = await makeApp();
  const c = client(app);
  const r = await c.post('/auth/signup', { username: 'alice', password: 'correct horse' });
  assert.equal(r.status, 201);
  assert.equal(r.json.account.username, 'alice');
  assert.equal(r.json.account.wallet, null);
  assert.match(r.json.warning, /no password reset without a linked wallet/);
  assert.equal(r.json.token, undefined, 'cookie mode never returns the token');
  const ck = r.res.cookies.find(x => x.name === SESSION_COOKIE);
  assert.ok(ck.httpOnly && ck.secure);
  assert.equal(ck.sameSite, 'Lax');
  assert.equal(ck.domain, '.membersonly.cc');
  assert.equal(ck.path, '/');
  const me = await c.get('/auth/me');
  assert.equal(me.status, 200);
  assert.deepEqual(Object.keys(me.json).sort(), ['accountId', 'hasPassword', 'nftStatus', 'username', 'wallet']);
  // Password stored as argon2id, token stored only as a hash.
  const row = db.prepare('SELECT password_hash FROM accounts').get();
  assert.match(row.password_hash, /^\$argon2id\$/);
  const s = db.prepare('SELECT token_hash FROM sessions').get();
  assert.notEqual(s.token_hash, ck.value);
  assert.match(s.token_hash, /^[0-9a-f]{64}$/);
});

test('usernames are case-insensitive and unique; validation errors', async () => {
  const { app } = await makeApp();
  const c = client(app);
  assert.equal((await c.post('/auth/signup', { username: 'Bob', password: 'password1' })).status, 201);
  const dup = await client(app).post('/auth/signup', { username: 'bob', password: 'password1' });
  assert.equal(dup.status, 409);
  assert.equal((await client(app).post('/auth/signup', { username: 'x', password: 'password1' })).json.error, 'bad_username');
  assert.equal((await client(app).post('/auth/signup', { username: 'carol', password: 'short' })).json.error, 'bad_password');
});

test('login: generic error for wrong password and unknown user; logout revokes', async () => {
  const { app } = await makeApp();
  await client(app).post('/auth/signup', { username: 'dave', password: 'password1' });
  const c = client(app);
  const wrong = await c.post('/auth/login', { username: 'dave', password: 'nope-nope' });
  const missing = await c.post('/auth/login', { username: 'nobody', password: 'nope-nope' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, missing.json, 'no username enumeration');
  const ok = await c.post('/auth/login', { username: 'DAVE', password: 'password1' });
  assert.equal(ok.status, 200);
  assert.equal((await c.get('/auth/me')).status, 200);
  const saved = new Map(c.jar);
  assert.equal((await c.post('/auth/logout')).status, 200);
  assert.equal((await c.get('/auth/me')).status, 401);
  // The old cookie value is dead server-side too.
  const replay = client(app); for (const [k, v] of saved) replay.jar.set(k, v);
  assert.equal((await replay.get('/auth/me')).status, 401);
});

test('state-changing POSTs need a same-origin request', async () => {
  const { app } = await makeApp();
  const evil = client(app, { origin: 'https://evil.example' });
  assert.equal((await evil.post('/auth/signup', { username: 'eve', password: 'password1' })).status, 403);
  const none = client(app, { origin: null });
  assert.equal((await none.post('/auth/login', { username: 'eve', password: 'password1' })).status, 403);
  const sfs = client(app, { origin: null, headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal((await sfs.post('/auth/signup', { username: 'eve', password: 'password1' })).status, 201);
});

test('rate limits: per account on login', async () => {
  const { app } = await makeApp();
  await client(app).post('/auth/signup', { username: 'frank', password: 'password1' });
  let last;
  for (let i = 0; i < 11; i++) last = await client(app).post('/auth/login', { username: 'frank', password: 'wrong-pass' });
  assert.equal(last.status, 429);
  assert.equal((await client(app).post('/auth/login', { username: 'frank', password: 'password1' })).status, 429, 'locked even with the right password');
});

test('sessions: 30-day sliding expiry', async () => {
  const { app, clock } = await makeApp();
  const c = client(app);
  await c.post('/auth/signup', { username: 'gina', password: 'password1' });
  const DAY = 86_400_000;
  clock.t += 20 * DAY;
  assert.equal((await c.get('/auth/me')).status, 200); // slides to day 50
  clock.t += 25 * DAY;
  assert.equal((await c.get('/auth/me')).status, 200, 'still alive at day 45 thanks to the slide');
  clock.t += 31 * DAY;
  assert.equal((await c.get('/auth/me')).status, 401, 'expired after 30 idle days');
});

test('token mode (embedded iframe): token in body, bearer header works, /auth/token handoff', async () => {
  const { app } = await makeApp();
  const c = client(app, { headers: { 'x-auth-mode': 'token' } });
  const r = await c.post('/auth/signup', { username: 'hana', password: 'password1' });
  assert.equal(r.status, 201);
  assert.ok(r.json.token);
  assert.equal(r.res.cookies.find(x => x.name === 'mo_session'), undefined, 'no cookie in token mode');
  c.token = r.json.token;
  assert.equal((await c.get('/auth/me')).json.username, 'hana');
  // Popup handoff: a cookie session can mint a bearer token.
  const popup = client(app);
  await popup.post('/auth/login', { username: 'hana', password: 'password1' });
  const t = await popup.post('/auth/token');
  assert.equal(t.status, 200);
  const frame = client(app); frame.token = t.json.token;
  assert.equal((await frame.get('/auth/me')).json.username, 'hana');
  assert.equal((await client(app).post('/auth/token')).status, 401);
});
