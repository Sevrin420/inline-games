// Leaderboards (see README "Leaderboard"). Generic per game id; a game only
// has one if server/games.json gives it a "leaderboard" block.
//
// Rules for posting a name:
//  - the play exists, belongs to the caller (same account, or same guest id),
//    is for this game, is finished, and has the board's outcome (e.g. 'win')
//  - each play can be posted once (UNIQUE play_id), within postWindowHours
//  - the ranked value comes from the server's own records: for the 'duration'
//    metric it's ended_at - started_at in ms, never a number the client sends
//  - names go through cleanName (length, characters, blocklist)
//  - rate limited per IP and per player
// Admin (X-Admin-Token = ADMIN_TOKEN): list entries, soft-delete one.
import crypto from 'node:crypto';
import { cleanName, escapeHtml, NAME_MAX } from './names.js';

const MINUTE = 60_000;
const TOP = 10;

export function registerLeaderboard(app, { db, games, cfg, now, iso, fail, limited, playerOf }) {
  const q = {
    insert: db.prepare('INSERT INTO leaderboard_entries (game_id, play_id, player_key, account_id, name, value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    byPlay: db.prepare('SELECT id FROM leaderboard_entries WHERE play_id = ?'),
    byId: db.prepare('SELECT * FROM leaderboard_entries WHERE id = ? AND game_id = ?'),
    remove: db.prepare('UPDATE leaderboard_entries SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
    total: db.prepare('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL'),
    adminList: db.prepare('SELECT id, play_id, name, value, player_key, created_at, removed_at FROM leaderboard_entries WHERE game_id = ? ORDER BY id DESC LIMIT ?'),
    play: db.prepare('SELECT * FROM play_events WHERE id = ?'),
  };
  for (const dir of ['asc', 'desc']) {
    const cmp = dir === 'asc' ? '<' : '>';
    q[`top_${dir}`] = db.prepare(`SELECT id, name, value, player_key FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL ORDER BY value ${dir.toUpperCase()}, id ASC LIMIT ?`);
    q[`best_${dir}`] = db.prepare(`SELECT id, name, value FROM leaderboard_entries WHERE game_id = ? AND player_key = ? AND removed_at IS NULL ORDER BY value ${dir.toUpperCase()}, id ASC LIMIT 1`);
    // rank of an existing entry: everyone strictly better, plus equal values posted earlier
    q[`rank_${dir}`] = db.prepare(`SELECT COUNT(*) + 1 AS r FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL AND (value ${cmp} ? OR (value = ? AND id < ?))`);
    // rank a not-yet-posted value would get (ties go after existing entries)
    q[`would_${dir}`] = db.prepare(`SELECT COUNT(*) + 1 AS r FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL AND value ${cmp}= ?`);
  }

  const boardOf = gameId => { const g = games.get(gameId); return g && g.leaderboard ? g : null; };
  const out = e => ({ id: e.id, name: escapeHtml(e.name), value: e.value });

  // The value a play would be ranked by, or an error.
  function eligibility(game, play, player) {
    const lb = game.leaderboard;
    if (!play || !player || play.player_key !== player.key) return { status: 404, error: 'unknown_play', message: 'No such play.' };
    if (play.game_id !== game.id) return { status: 409, error: 'wrong_game', message: 'That play is for another game.' };
    if (!play.ended_at) return { status: 409, error: 'not_finished', message: 'Finish the run first.' };
    if (lb.outcome && play.outcome !== lb.outcome) return { status: 409, error: 'not_eligible', message: 'Only a win can go on the board.' };
    if (Date.parse(play.ended_at) < now() - lb.postWindowHours * 3_600_000) return { status: 409, error: 'too_late', message: 'This run is too old to post.' };
    let value;
    if (lb.metric === 'duration') {
      value = Date.parse(play.ended_at) - Date.parse(play.started_at);
      if (!Number.isSafeInteger(value) || value < lb.minMs) return { status: 409, error: 'implausible', message: 'That run was too fast to count.' };
    } else {
      value = play.score;
      if (!Number.isSafeInteger(value)) return { status: 409, error: 'no_score', message: 'This run has no score.' };
    }
    if (q.byPlay.get(play.id)) return { status: 409, error: 'already_posted', message: 'This run is already on the board.' };
    return { value };
  }

  function board(game, player, extra = {}) {
    const dir = game.leaderboard.order;
    const top = q[`top_${dir}`].all(game.id, TOP).map((e, i) => ({ rank: i + 1, ...out(e), mine: Boolean(player && e.player_key === player.key) }));
    let me = null;
    if (player) {
      const b = q[`best_${dir}`].get(game.id, player.key);
      if (b) me = { rank: q[`rank_${dir}`].get(game.id, b.value, b.value, b.id).r, ...out(b) };
    }
    return {
      game_id: game.id, metric: game.leaderboard.metric === 'duration' ? 'duration_ms' : 'score', order: dir,
      nameMax: NAME_MAX, total: q.total.get(game.id).n, top, me, ...extra,
    };
  }

  // Top 10, the caller's own best entry (with its rank, even outside the top
  // 10), a name to prefill if signed in, and, with ?play_id=, whether that
  // play can be posted and where it would land.
  app.get('/plays/leaderboard/:gameId', async (req, reply) => {
    const game = boardOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_leaderboard', 'This game has no leaderboard.');
    const player = playerOf(req);
    let prefill = null;
    if (req.session) {
      const u = db.prepare('SELECT username FROM accounts WHERE id = ?').get(req.session.accountId);
      if (u) { const c = cleanName(u.username.slice(0, NAME_MAX)); prefill = c.ok ? c.name : null; }
    }
    let candidate;
    if (req.query.play_id !== undefined) {
      const id = Number(req.query.play_id);
      const e = eligibility(game, Number.isInteger(id) ? q.play.get(id) : null, player);
      candidate = e.error ? { play_id: id, eligible: false, error: e.error, message: e.message }
        : { play_id: id, eligible: true, value: e.value, rank: q[`would_${game.leaderboard.order}`].get(game.id, e.value).r };
    }
    return board(game, player, { prefill, ...(candidate ? { candidate } : {}) });
  });

  app.post('/plays/leaderboard/:gameId', async (req, reply) => {
    const game = boardOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_leaderboard', 'This game has no leaderboard.');
    // Every attempt counts per IP; actual posts also count per player.
    if (limited(reply, `lb:ip:${req.ip}`, 20, 10 * MINUTE)) return;
    const player = playerOf(req);
    const id = Number(req.body?.play_id);
    const e = eligibility(game, Number.isInteger(id) ? q.play.get(id) : null, player);
    if (e.error) return fail(reply, e.status, e.error, e.message);
    const n = cleanName(req.body?.name);
    if (!n.ok) return fail(reply, 400, n.error, n.message);
    if (limited(reply, `lb:player:${player.key}`, 6, 10 * MINUTE)) return;
    let entryId;
    try {
      entryId = Number(q.insert.run(game.id, id, player.key, player.accountId, n.name, e.value, iso()).lastInsertRowid);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return fail(reply, 409, 'already_posted', 'This run is already on the board.');
      throw err;
    }
    const dir = game.leaderboard.order;
    reply.code(201);
    return board(game, player, { entry: { rank: q[`rank_${dir}`].get(game.id, e.value, e.value, entryId).r, id: entryId, name: escapeHtml(n.name), value: e.value } });
  });

  // ---- admin
  const want = cfg.adminToken ? crypto.createHash('sha256').update(cfg.adminToken).digest() : null;
  function admin(req, reply) {
    if (!want) { fail(reply, 503, 'admin_unconfigured', 'ADMIN_TOKEN is not set on the server.'); return false; }
    const got = req.headers['x-admin-token'];
    const ok = typeof got === 'string' && crypto.timingSafeEqual(crypto.createHash('sha256').update(got).digest(), want);
    if (!ok) { fail(reply, 403, 'forbidden', 'Admin token required.'); return false; }
    return true;
  }

  app.get('/plays/leaderboard/:gameId/admin', async (req, reply) => {
    if (limited(reply, `admin:ip:${req.ip}`, 30, MINUTE)) return;
    if (!admin(req, reply)) return;
    const game = boardOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_leaderboard', 'This game has no leaderboard.');
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    return { game_id: game.id, entries: q.adminList.all(game.id, limit) };
  });

  app.delete('/plays/leaderboard/:gameId/entries/:id', async (req, reply) => {
    if (limited(reply, `admin:ip:${req.ip}`, 30, MINUTE)) return;
    if (!admin(req, reply)) return;
    const game = boardOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_leaderboard', 'This game has no leaderboard.');
    const id = Number(req.params.id);
    const e = Number.isInteger(id) ? q.byId.get(id, game.id) : null;
    if (!e || e.removed_at) return fail(reply, 404, 'unknown_entry', 'No such entry (or already removed).');
    q.remove.run(iso(), id);
    req.log.info({ entry: id, game: game.id }, 'leaderboard entry removed by admin');
    return { ok: true, removed: { id, name: e.name, value: e.value } };
  });
}
