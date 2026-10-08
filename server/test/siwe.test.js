import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, client, wallet, siwe } from './helpers.js';

test('wallet sign-in creates a wallet-only account; signing in again returns it', async () => {
  const { app } = await makeApp();
  const w = wallet();
  const r = await siwe(client(app), w, 'login');
  assert.equal(r.status, 200);
  assert.equal(r.json.account.wallet, w.address);
  assert.equal(r.json.account.hasPassword, false);
  assert.match(r.json.account.username, /^wallet-[0-9a-f]{6}$/);
  const again = await siwe(client(app), w, 'login');
  assert.equal(again.json.account.accountId, r.json.account.accountId);
});

test('replay of a signed message is refused', async () => {
  const { app } = await makeApp();
  const w = wallet();
  const c = client(app);
  const n = await c.post('/auth/siwe/nonce', { purpose: 'login', address: w.address });
  const signature = await w.signMessage({ message: n.json.message });
  assert.equal((await c.post('/auth/siwe/login', { message: n.json.message, signature })).status, 200);
  const replay = await client(app).post('/auth/siwe/login', { message: n.json.message, signature });
  assert.equal(replay.status, 401);
  assert.equal(replay.json.error, 'nonce_used');
});

test('domain mismatch, chain mismatch, bad signature, unknown nonce', async () => {
  const { app } = await makeApp();
  const w = wallet();
  const dom = await siwe(client(app), w, 'login', {}, { tamper: m => m.replace(/^membersonly\.cc wants/, 'evil.example wants') });
  assert.equal(dom.json.error, 'domain_mismatch');
  const chain = await siwe(client(app), w, 'login', {}, { tamper: m => m.replace('Chain ID: 1', 'Chain ID: 5') });
  assert.equal(chain.json.error, 'chain_mismatch');
  const nonce = await siwe(client(app), w, 'login', {}, { tamper: m => m.replace(/Nonce: \w+/, 'Nonce: deadbeefdeadbeef') });
  assert.equal(nonce.json.error, 'bad_nonce');
  // Signed by someone else.
  const c = client(app);
  const n = await c.post('/auth/siwe/nonce', { purpose: 'login', address: w.address });
  const forged = await wallet().signMessage({ message: n.json.message });
  assert.equal((await c.post('/auth/siwe/login', { message: n.json.message, signature: forged })).json.error, 'bad_signature');
});

test('expired nonce/message is refused', async () => {
  const { app, clock } = await makeApp();
  const w = wallet();
  const c = client(app);
  const n = await c.post('/auth/siwe/nonce', { purpose: 'login', address: w.address });
  const signature = await w.signMessage({ message: n.json.message });
  clock.t += 6 * 60_000;
  const r = await c.post('/auth/siwe/login', { message: n.json.message, signature });
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'expired');
});

test('purpose must match the endpoint', async () => {
  const { app } = await makeApp();
  const w = wallet();
  const c = client(app);
  const n = await c.post('/auth/siwe/nonce', { purpose: 'reset', address: w.address });
  const signature = await w.signMessage({ message: n.json.message });
  const r = await c.post('/auth/siwe/login', { message: n.json.message, signature });
  assert.equal(r.json.error, 'wrong_purpose');
});

test('link: one wallet per account, one account per wallet', async () => {
  const { app } = await makeApp();
  const a = client(app);
  await a.post('/auth/signup', { username: 'ivan', password: 'password1' });
  assert.equal((await client(app).post('/auth/siwe/nonce', { purpose: 'link' })).status, 401, 'link needs a session');
  const w1 = wallet(), w2 = wallet();
  const linked = await siwe(a, w1, 'link');
  assert.equal(linked.status, 200);
  assert.equal(linked.json.account.wallet, w1.address);
  assert.equal((await siwe(a, w2, 'link')).json.error, 'account_has_wallet');
  const b = client(app);
  await b.post('/auth/signup', { username: 'judy', password: 'password1' });
  assert.equal((await siwe(b, w1, 'link')).json.error, 'wallet_in_use');
  // A link nonce issued to one account can't be used by another.
  const n = await a.post('/auth/siwe/nonce', { purpose: 'link', address: w2.address });
  const sig = await w2.signMessage({ message: n.json.message });
  assert.equal((await b.post('/auth/siwe/link', { message: n.json.message, signature: sig })).json.error, 'wrong_account');
  // Wallet sign-in now lands on ivan's account.
  assert.equal((await siwe(client(app), w1, 'login')).json.account.username, 'ivan');
});

test('reset via linked wallet sets a new password and revokes all other sessions', async () => {
  const { app } = await makeApp();
  const a = client(app);
  await a.post('/auth/signup', { username: 'kate', password: 'password1' });
  const w = wallet();
  await siwe(a, w, 'link');
  const r = await siwe(client(app), w, 'reset', { newPassword: 'brand-new-pass' });
  assert.equal(r.status, 200);
  assert.equal((await a.get('/auth/me')).status, 401, 'old session revoked');
  assert.equal((await client(app).post('/auth/login', { username: 'kate', password: 'password1' })).status, 401);
  assert.equal((await client(app).post('/auth/login', { username: 'kate', password: 'brand-new-pass' })).status, 200);
  assert.equal((await siwe(client(app), wallet(), 'reset', { newPassword: 'whatever-123' })).json.error, 'no_linked_account');
});
