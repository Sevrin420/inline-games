// HTTP API: accounts, sessions, SIWE, access levels and play tracking, as
// specified in docs/Auth_and_Accounts.md. See README "Accounts and login".
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { openDb, tx } from './db.js';
import { loadGames } from './games.js';
import { createSessions, SESSION_DAYS } from './sessions.js';
import { createSiwe, SiweError } from './siwe.js';
import { createGate } from './nft.js';
import { createLimiter } from './ratelimit.js';

export const SESSION_COOKIE = 'mo_session';
export const ANON_COOKIE = 'mo_anon';
export const SIGNUP_WARNING = 'There is no password reset without a linked wallet. If you forget your password, your account cannot be recovered. Link a wallet to be able to reset it.';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MIN_PW = 8, MAX_PW = 200;
const MINUTE = 60_000;

// Argon2id, OWASP-recommended minimum (m=19 MiB, t=2, p=1).
const ARGON = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function buildApp({ cfg, db, games, gate, now = () => Date.now(), logger = false } = {}) {
  db = db || openDb(cfg.dbPath);
  games = games || loadGames(cfg.gamesFile);
  gate = gate || createGate(cfg.gate, { now });
  const sessions = createSessions(db, now);
  const siwe = createSiwe(db, cfg, now);
  const limiter = createLimiter();
  const iso = (t = now()) => new Date(t).toISOString();
  // Used so a login for a missing user costs the same as a real one.
  const dummyHash = await argonHash(crypto.randomBytes(16).toString('hex'), ARGON);

  const app = Fastify({ logger, trustProxy: cfg.trustProxy, bodyLimit: 16 * 1024 });
  await app.register(cookie);

  const q = {
    accountByName: db.prepare('SELECT id, username, password_hash FROM accounts WHERE username = ?'),
    accountById: db.prepare('SELECT id, username, password_hash FROM accounts WHERE id = ?'),
    insertAccount: db.prepare('INSERT INTO accounts (username, password_hash, created_at) VALUES (?, ?, ?)'),
    setPassword: db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?'),
    walletByAddress: db.prepare('SELECT address, account_id FROM wallets WHERE address = ?'),
    walletByAccount: db.prepare('SELECT address FROM wallets WHERE account_id = ?'),
    insertWallet: db.prepare('INSERT INTO wallets (address, account_id, linked_at) VALUES (?, ?, ?)'),
    anon: db.prepare('SELECT anon_id, claimed_by_account_id FROM anon_players WHERE anon_id = ?'),
    insertAnon: db.prepare('INSERT INTO anon_players (anon_id, created_at) VALUES (?, ?)'),
    claimAnon: db.prepare('UPDATE anon_players SET claimed_by_account_id = ? WHERE anon_id = ? AND (claimed_by_account_id IS NULL OR claimed_by_account_id = ?)'),
    reattribute: db.prepare("UPDATE play_events SET account_id = ?, player_key = ? WHERE player_key = ?"),
    insertPlay: db.prepare('INSERT INTO play_events (game_id, player_key, account_id, started_at, access_level) VALUES (?, ?, ?, ?, ?)'),
    play: db.prepare('SELECT * FROM play_events WHERE id = ?'),
    endPlay: db.prepare('UPDATE play_events SET ended_at = ?, outcome = ?, score = ?, meta = ? WHERE id = ? AND ended_at IS NULL'),
    closeStale: db.prepare('UPDATE play_events SET ended_at = ? WHERE ended_at IS NULL AND started_at < ?'),
    playsByAccount: db.prepare('SELECT id, game_id, started_at, ended_at, outcome, score FROM play_events WHERE account_id = ? AND (? IS NULL OR game_id = ?) ORDER BY started_at DESC, id DESC LIMIT ?'),
    playsByKey: db.prepare('SELECT id, game_id, started_at, ended_at, outcome, score FROM play_events WHERE player_key = ? AND (? IS NULL OR game_id = ?) ORDER BY started_at DESC, id DESC LIMIT ?'),
    // best: MAX or MIN score per the game's scoreOrder, optionally only over one outcome (e.g. 'win').
    ...Object.fromEntries(['account_id', 'player_key'].flatMap(col => ['MAX', 'MIN'].map(fn => [`stats_${col}_${fn}`,
      db.prepare(`SELECT COUNT(*) AS plays, COUNT(outcome) AS completed, ${fn}(CASE WHEN outcome IS NOT NULL AND (? IS NULL OR outcome = ?) THEN score END) AS best FROM play_events WHERE ${col} = ? AND (? IS NULL OR game_id = ?)`)]))),
  };

  // ------------------------------------------------------------ helpers
  const fail = (reply, status, error, message) => reply.code(status).send({ error, message: message || error });
  const tokenMode = req => String(req.headers['x-auth-mode'] || '').toLowerCase() === 'token';
  const cookieOpts = maxAgeSec => ({
    path: '/', httpOnly: true, secure: cfg.cookieSecure, sameSite: 'lax', maxAge: maxAgeSec,
    ...(cfg.cookieDomain ? { domain: cfg.cookieDomain } : {}),
  });
  const limited = (reply, key, n, windowMs) => {
    if (limiter.hit(key, n, windowMs, now())) return false;
    fail(reply, 429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
    return true;
  };

  function bearer(req) {
    const h = req.headers.authorization;
    if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
    return null;
  }

  function issueSession(req, reply, accountId) {
    if (tokenMode(req)) return sessions.create(accountId, 'bearer');
    const token = sessions.create(accountId, 'cookie');
    reply.setCookie(SESSION_COOKIE, token, cookieOpts(SESSION_DAYS * 86400));
    return undefined;
  }

  function anonIdFrom(req) {
    const v = req.cookies[ANON_COOKIE] || req.headers['x-anon-id'];
    return typeof v === 'string' && UUID_RE.test(v) ? v : null;
  }

  // Anonymous -> account claim (one transaction, once per anon id).
  function claimAnon(req, reply, accountId) {
    const anonId = anonIdFrom(req);
    if (!anonId) return false;
    const claimed = tx(db, () => {
      const row = q.anon.get(anonId);
      if (!row) return false;
      if (row.claimed_by_account_id !== null && row.claimed_by_account_id !== accountId) return false;
      q.claimAnon.run(accountId, anonId, accountId);
      q.reattribute.run(accountId, `account:${accountId}`, `anon:${anonId}`);
      return true;
    });
    // Either way this anon id is spent for this browser: a later guest play
    // starts a fresh anonymous history rather than adding to a claimed one.
    if (req.cookies[ANON_COOKIE]) reply.clearCookie(ANON_COOKIE, cookieOpts(0));
    return claimed;
  }

  async function me(accountId) {
    const a = q.accountById.get(accountId);
    if (!a) return null;
    const w = q.walletByAccount.get(accountId);
    // Display hint only; access decisions re-read chain state.
    const nftStatus = w ? await gate.check(w.address) : (gate.configured ? 'no-wallet' : 'unconfigured');
    return { accountId: a.id, username: a.username, wallet: w ? w.address : null, nftStatus, hasPassword: Boolean(a.password_hash) };
  }

  async function signedIn(req, reply, accountId, extra = {}) {
    const anonClaimed = claimAnon(req, reply, accountId);
    const token = issueSession(req, reply, accountId);
    return { ok: true, account: await me(accountId), anonClaimed, ...(token ? { token } : {}), ...extra };
  }

  function checkPassword(pw) {
    if (typeof pw !== 'string' || pw.length < MIN_PW) return `Password must be at least ${MIN_PW} characters.`;
    if (pw.length > MAX_PW) return `Password must be at most ${MAX_PW} characters.`;
    return null;
  }

  function newWalletUsername(address) {
    const base = `wallet-${address.slice(2, 8).toLowerCase()}`; // '-' is not allowed in chosen names, so no clash
    if (!q.accountByName.get(base)) return base;
    for (;;) {
      const n = `${base}-${crypto.randomBytes(2).toString('hex')}`;
      if (!q.accountByName.get(n)) return n;
    }
  }

  async function checkAccess(game, req, { fresh = false } = {}) {
    if (game.access === 'open') return { ok: true };
    if (!req.session) return { ok: false, status: 401, error: 'login_required' };
    if (game.access === 'account') return { ok: true };
    const w = q.walletByAccount.get(req.session.accountId);
    if (!w) return { ok: false, status: 403, error: 'wallet_required' };
    if (game.access === 'wallet') return { ok: true };
    const s = await gate.check(w.address, { fresh });
    if (s === 'holder') return { ok: true };
    if (s === 'unconfigured') return { ok: false, status: 503, error: 'gate_unconfigured', message: 'NFT gate is not configured on the server.' };
    if (s === 'error') return { ok: false, status: 503, error: 'gate_unavailable', message: 'Could not read the NFT gate right now.' };
    return { ok: false, status: 403, error: 'nft_required' };
  }

  // ------------------------------------------------------------ hooks
  const isApi = url => /^\/(auth|plays)(\/|\?|$)|^\/healthz/.test(url);

  app.addHook('onRequest', async (req, reply) => {
    if (!isApi(req.url)) return;
    reply.header('Cache-Control', 'no-store');
    // Same-origin check on every state-changing request.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      const site = req.headers['sec-fetch-site'];
      const ok = origin ? cfg.allowedOrigins.includes(origin) : site === 'same-origin';
      if (!ok) return fail(reply, 403, 'bad_origin', 'Cross-site request refused.');
    }
    // Resolve the session: bearer token (embedded iframes) or cookie.
    req.session = null;
    const fromHeader = bearer(req);
    const token = fromHeader || req.cookies[SESSION_COOKIE];
    if (token) {
      const s = sessions.lookup(token);
      if (s) {
        req.session = s;
        if (s.slid && !fromHeader && s.kind === 'cookie') reply.setCookie(SESSION_COOKIE, token, cookieOpts(SESSION_DAYS * 86400));
      } else if (!fromHeader) {
        reply.clearCookie(SESSION_COOKIE, cookieOpts(0));
      }
    }
  });

  const requireSession = async (req, reply) => {
    if (!req.session) return fail(reply, 401, 'login_required', 'Sign in first.');
  };

  // ------------------------------------------------------------ routes
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/auth/config', async () => ({
    siweDomain: cfg.siweDomain, chainId: cfg.siweChainId, uri: cfg.publicOrigin,
    nftGate: gate.configured, signupWarning: SIGNUP_WARNING,
    username: { pattern: USERNAME_RE.source, min: 3, max: 20 }, password: { min: MIN_PW, max: MAX_PW },
  }));

  app.post('/auth/signup', async (req, reply) => {
    if (limited(reply, `signup:ip:${req.ip}`, 10, 10 * MINUTE)) return;
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) return fail(reply, 400, 'bad_username', 'Usernames are 3-20 letters, numbers or _.');
    const pwErr = checkPassword(password);
    if (pwErr) return fail(reply, 400, 'bad_password', pwErr);
    const h = await argonHash(password, ARGON);
    let id;
    try {
      id = Number(q.insertAccount.run(username, h, iso()).lastInsertRowid);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return fail(reply, 409, 'username_unavailable', 'That username can\'t be used. Try another.');
      throw e;
    }
    reply.code(201);
    return signedIn(req, reply, id, { warning: SIGNUP_WARNING });
  });

  app.post('/auth/login', async (req, reply) => {
    const { username, password } = req.body || {};
    if (limited(reply, `login:ip:${req.ip}`, 20, 10 * MINUTE)) return;
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 64 || password.length > MAX_PW) {
      return fail(reply, 401, 'invalid_credentials', 'Wrong username or password.');
    }
    if (limited(reply, `login:user:${username.toLowerCase()}`, 10, 15 * MINUTE)) return;
    const a = q.accountByName.get(username);
    const ok = await argonVerify(a?.password_hash || dummyHash, password).catch(() => false);
    if (!a || !a.password_hash || !ok) return fail(reply, 401, 'invalid_credentials', 'Wrong username or password.');
    limiter.reset(`login:user:${username.toLowerCase()}`);
    return signedIn(req, reply, a.id);
  });

  app.post('/auth/logout', async (req, reply) => {
    if (req.session) sessions.revoke(req.session.tokenHash);
    reply.clearCookie(SESSION_COOKIE, cookieOpts(0));
    return { ok: true };
  });

  // 401 when signed out, per spec. With ?optional=1 a signed-out answer is a
  // 200 {signedIn:false} instead, so games checking quietly don't log errors.
  app.get('/auth/me', async (req, reply) => {
    const m = req.session ? await me(req.session.accountId) : null;
    if (!m) return req.query.optional ? { signedIn: false } : fail(reply, 401, 'login_required', 'Not signed in.');
    return m;
  });

  // Hand a signed-in first-party page (the account popup) a bearer token for
  // an embedded game iframe, which can't see the cookie. Same-origin only.
  app.post('/auth/token', { preHandler: requireSession }, async req => ({ token: sessions.create(req.session.accountId, 'bearer') }));

  // Claim this browser's anonymous plays for the signed-in account (used after
  // a popup sign-in, where the iframe's anon id never reached the server).
  app.post('/auth/claim', { preHandler: requireSession }, async (req, reply) => ({ claimed: claimAnon(req, reply, req.session.accountId) }));

  app.post('/auth/siwe/nonce', async (req, reply) => {
    if (limited(reply, `siwe:ip:${req.ip}`, 30, 10 * MINUTE)) return;
    const { purpose, address } = req.body || {};
    if (purpose === 'link' && !req.session) return fail(reply, 401, 'login_required', 'Sign in first, then link a wallet.');
    try {
      return siwe.issue(purpose, { accountId: purpose === 'link' ? req.session.accountId : null, address: address || null });
    } catch (e) {
      if (e instanceof SiweError) return fail(reply, 400, e.code, e.message);
      throw e;
    }
  });

  async function verifySiwe(req, reply, purpose) {
    if (limited(reply, `siwe:ip:${req.ip}`, 30, 10 * MINUTE)) return null;
    const { message, signature } = req.body || {};
    try {
      return await siwe.verify(message, signature, purpose);
    } catch (e) {
      if (e instanceof SiweError) { fail(reply, 401, e.code, e.message); return null; }
      throw e;
    }
  }

  app.post('/auth/siwe/login', async (req, reply) => {
    const v = await verifySiwe(req, reply, 'login');
    if (!v) return;
    const accountId = tx(db, () => {
      const w = q.walletByAddress.get(v.address);
      if (w) return w.account_id;
      const id = Number(q.insertAccount.run(newWalletUsername(v.address), null, iso()).lastInsertRowid);
      q.insertWallet.run(v.address, id, iso());
      return id;
    });
    return signedIn(req, reply, accountId);
  });

  app.post('/auth/siwe/link', { preHandler: requireSession }, async (req, reply) => {
    const v = await verifySiwe(req, reply, 'link');
    if (!v) return;
    const accountId = req.session.accountId;
    if (v.accountId !== accountId) return fail(reply, 401, 'wrong_account', 'This message was issued for a different account.');
    const err = tx(db, () => {
      if (q.walletByAccount.get(accountId)) return ['account_has_wallet', 'This account already has a wallet.'];
      if (q.walletByAddress.get(v.address)) return ['wallet_in_use', 'That wallet is linked to another account.'];
      q.insertWallet.run(v.address, accountId, iso());
      return null;
    });
    if (err) return fail(reply, 409, err[0], err[1]);
    gate.forget(v.address);
    return { ok: true, account: await me(accountId), anonClaimed: claimAnon(req, reply, accountId) };
  });

  app.post('/auth/siwe/reset', async (req, reply) => {
    const pwErr = checkPassword(req.body?.newPassword);
    if (pwErr) return fail(reply, 400, 'bad_password', pwErr);
    const v = await verifySiwe(req, reply, 'reset');
    if (!v) return;
    const w = q.walletByAddress.get(v.address);
    if (!w) return fail(reply, 404, 'no_linked_account', 'No account is linked to this wallet.');
    q.setPassword.run(await argonHash(req.body.newPassword, ARGON), w.account_id);
    sessions.revokeAll(w.account_id); // a reset logs out every other device
    return signedIn(req, reply, w.account_id);
  });

  // ---- games and plays
  app.get('/plays/games', async () => [...games.values()].map(g => ({ id: g.id, title: g.title, access: g.access })));

  app.get('/plays/access/:gameId', async (req, reply) => {
    const game = games.get(req.params.gameId);
    if (!game) return fail(reply, 404, 'unknown_game', 'No such game.');
    const a = await checkAccess(game, req);
    return { gameId: game.id, access: game.access, allowed: a.ok, reason: a.ok ? null : a.error };
  });

  function playerOf(req) {
    if (req.session) return { key: `account:${req.session.accountId}`, accountId: req.session.accountId };
    const anonId = anonIdFrom(req);
    if (!anonId) return null;
    const row = q.anon.get(anonId);
    if (!row || row.claimed_by_account_id !== null) return null;
    return { key: `anon:${anonId}`, accountId: null, anonId };
  }

  app.post('/plays/start', async (req, reply) => {
    if (limited(reply, `plays:ip:${req.ip}`, 120, MINUTE)) return;
    const gameId = req.body?.game_id;
    const game = typeof gameId === 'string' ? games.get(gameId) : null;
    if (!game) return fail(reply, 404, 'unknown_game', 'No such game.');
    const a = await checkAccess(game, req);
    if (!a.ok) return fail(reply, a.status, a.error, a.message);
    let player = playerOf(req);
    let newAnon = null;
    if (!player) {
      newAnon = crypto.randomUUID();
      q.insertAnon.run(newAnon, iso());
      reply.setCookie(ANON_COOKIE, newAnon, cookieOpts(365 * 86400));
      player = { key: `anon:${newAnon}`, accountId: null, anonId: newAnon };
    }
    // The server, not the client, decides whose play it is and when it began.
    const id = Number(q.insertPlay.run(game.id, player.key, player.accountId, iso(), game.access).lastInsertRowid);
    reply.code(201);
    return { play_id: id, player: player.accountId ? 'account' : 'anon', ...(player.anonId && tokenMode(req) ? { anonId: player.anonId } : {}) };
  });

  app.post('/plays/:id/end', async (req, reply) => {
    const id = Number(req.params.id);
    const play = Number.isInteger(id) ? q.play.get(id) : null;
    const player = playerOf(req);
    if (!play || !player || play.player_key !== player.key) return fail(reply, 404, 'unknown_play', 'No such play.');
    if (play.ended_at) return fail(reply, 409, 'already_ended', 'This play is already over.');
    if (Date.parse(play.started_at) < now() - cfg.stalePlayHours * 3_600_000) return fail(reply, 409, 'stale', 'This play was left open too long.');
    const { outcome = 'completed', score = null, meta = null } = req.body || {};
    if (typeof outcome !== 'string' || !/^[a-z_-]{1,32}$/.test(outcome)) return fail(reply, 400, 'bad_outcome', 'outcome must be a short lowercase word.');
    if (score !== null && !(Number.isSafeInteger(score) && score >= -1e12 && score <= 1e12)) return fail(reply, 400, 'bad_score', 'score must be an integer.');
    let metaJson = null;
    if (meta !== null) {
      metaJson = JSON.stringify(meta);
      if (metaJson.length > 2048) return fail(reply, 400, 'bad_meta', 'meta is too large.');
    }
    const r = q.endPlay.run(iso(), outcome, score, metaJson, id);
    if (r.changes !== 1) return fail(reply, 409, 'already_ended', 'This play is already over.');
    return { ok: true, play: q.play.get(id) && pickPlay(q.play.get(id)) };
  });

  const pickPlay = p => ({ id: p.id, game_id: p.game_id, started_at: p.started_at, ended_at: p.ended_at, outcome: p.outcome, score: p.score });

  app.get('/plays/mine', async req => {
    const gameId = typeof req.query.game_id === 'string' ? req.query.game_id : null;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const player = playerOf(req);
    if (!player) return { player: null, stats: { plays: 0, completed: 0, best: null }, plays: [] };
    const byAcct = player.accountId !== null;
    const k = byAcct ? player.accountId : player.key;
    const plays = (byAcct ? q.playsByAccount : q.playsByKey).all(k, gameId, gameId, limit).map(pickPlay);
    const game = gameId ? games.get(gameId) : null;
    const fn = game && game.scoreOrder === 'asc' ? 'MIN' : 'MAX', only = game ? game.bestOutcome : null;
    const s = q[`stats_${byAcct ? 'account_id' : 'player_key'}_${fn}`].get(only, only, k, gameId, gameId);
    return { player: byAcct ? 'account' : 'anon', stats: { plays: s.plays, completed: s.completed, best: s.best }, plays };
  });

  // ---- housekeeping: close plays left open too long (no outcome = not completed)
  function sweep() {
    q.closeStale.run(iso(), iso(now() - cfg.stalePlayHours * 3_600_000));
    sessions.purge();
    siwe.purge();
  }
  sweep();
  const timer = setInterval(sweep, 10 * MINUTE);
  timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); });
  app.decorate('sweep', sweep);

  // ---- local development only: serve games/ so the whole thing runs on one port
  if (cfg.devStaticDir) registerDevStatic(app, path.resolve(cfg.devStaticDir));

  app.setErrorHandler((err, req, reply) => {
    if (err.validation || err.statusCode === 400 || err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') return fail(reply, 400, 'bad_request', 'Bad request.');
    if (err.statusCode === 413) return fail(reply, 413, 'too_large', 'Request too large.');
    req.log.error(err);
    return fail(reply, 500, 'server_error', 'Something went wrong.');
  });

  return app;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.jpg': 'image/jpeg' };

function registerDevStatic(app, root) {
  app.get('/*', async (req, reply) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.resolve(root, '.' + urlPath);
    if (file !== root && !file.startsWith(root + path.sep)) return reply.code(404).send('Not found');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!urlPath.endsWith('/')) return reply.redirect(urlPath + '/', 308);
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) return reply.code(404).send('Not found');
    reply.header('Cache-Control', 'no-cache');
    reply.type(TYPES[path.extname(file)] || 'application/octet-stream');
    return fs.createReadStream(file);
  });
}
