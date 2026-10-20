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
// Admin (X-Admin-Token = ADMIN_TOKEN): list entries, soft-delete one, reset a
// whole board (v22: soft-removes every entry, closes unfinished plays of that
// game and bumps the board's season, which every board GET serves).
// v22 share links (TIME CARD): POST /plays/share/:gameId makes a link for a
// finished run of the caller's, from the server's own records;
// GET /plays/s/:id is the page X unfurls, GET /plays/s/:id.png its card.
import crypto from 'node:crypto';
import { cleanName, escapeHtml, NAME_MAX } from './names.js';
import { tx } from './db.js';
import { cardPng, fmtTime } from './sharepng.js';

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
    season: db.prepare('SELECT season, reset_at FROM board_seasons WHERE game_id = ?'),
    setSeason: db.prepare('INSERT INTO board_seasons (game_id, season, reset_at) VALUES (?, ?, ?) ON CONFLICT(game_id) DO UPDATE SET season = excluded.season, reset_at = excluded.reset_at'),
    removeAll: db.prepare('UPDATE leaderboard_entries SET removed_at = ? WHERE game_id = ? AND removed_at IS NULL'),
    closeOpen: db.prepare("UPDATE play_events SET ended_at = ?, outcome = 'reset' WHERE game_id = ? AND ended_at IS NULL"),
    entryOfPlay: db.prepare('SELECT id, name, value FROM leaderboard_entries WHERE play_id = ? AND removed_at IS NULL'),
    onBoard: db.prepare('SELECT 1 AS y FROM leaderboard_entries WHERE game_id = ? AND player_key = ? AND removed_at IS NULL LIMIT 1'),
    shareOfPlay: db.prepare('SELECT * FROM run_shares WHERE play_id = ?'),
    share: db.prepare('SELECT * FROM run_shares WHERE id = ?'),
    shareInsert: db.prepare('INSERT INTO run_shares (id, game_id, play_id, player_key, name, ms, kills, ach, rank, total, season, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  };
  const seasonOf = gameId => { const r = q.season.get(gameId); return r ? r.season : 1; };
  for (const dir of ['asc', 'desc']) {
    const cmp = dir === 'asc' ? '<' : '>';
    q[`top_${dir}`] = db.prepare(`SELECT id, name, value, player_key FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL ORDER BY value ${dir.toUpperCase()}, id ASC LIMIT ?`);
    q[`best_${dir}`] = db.prepare(`SELECT id, name, value FROM leaderboard_entries WHERE game_id = ? AND player_key = ? AND removed_at IS NULL ORDER BY value ${dir.toUpperCase()}, id ASC LIMIT 1`);
    // rank of an existing entry: everyone strictly better, plus equal values posted earlier
    q[`rank_${dir}`] = db.prepare(`SELECT COUNT(*) + 1 AS r FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL AND (value ${cmp} ? OR (value = ? AND id < ?))`);
    // rank a not-yet-posted value would get (ties go after existing entries)
    q[`would_${dir}`] = db.prepare(`SELECT COUNT(*) + 1 AS r FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL AND value ${cmp}= ?`);
    // bestPerPlayer boards (Last Tower): one row per player, their best entry
    const D = dir.toUpperCase(), AGG = dir === 'asc' ? 'MIN' : 'MAX';
    q[`ptop_${dir}`] = db.prepare(`SELECT id, name, value, player_key FROM (SELECT id, name, value, player_key, ROW_NUMBER() OVER (PARTITION BY player_key ORDER BY value ${D}, id ASC) AS rn FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL) WHERE rn = 1 ORDER BY value ${D}, id ASC LIMIT ?`);
    // players (other than this one) whose best beats or ties the value
    q[`prank_${dir}`] = db.prepare(`SELECT COUNT(*) + 1 AS r FROM (SELECT ${AGG}(value) AS v FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL AND player_key <> ? GROUP BY player_key) WHERE v ${cmp}= ?`);
  }
  q.ptotal = db.prepare('SELECT COUNT(DISTINCT player_key) AS n FROM leaderboard_entries WHERE game_id = ? AND removed_at IS NULL');

  const boardOf = gameId => { const g = games.get(gameId); return g && g.leaderboard ? g : null; };
  const outOf = game => e => {
    const o = { id: e.id, name: escapeHtml(e.name), value: e.value };
    if (game.leaderboard.metric === 'survival') { o.ms = Math.floor(e.value / 100_000) * 100; o.kills = e.value % 100_000; }
    return o;
  };
  // rank of a value; for bestPerPlayer boards, among the other players' bests
  const rankOf = (game, playerKey, value, id) => {
    const dir = game.leaderboard.order;
    if (game.leaderboard.bestPerPlayer) return q[`prank_${dir}`].get(game.id, playerKey || '', value).r;
    return id ? q[`rank_${dir}`].get(game.id, value, value, id).r : q[`would_${dir}`].get(game.id, value).r;
  };

  // The value a play would be ranked by, or an error.
  function eligibility(game, play, player, { forShare = false } = {}) {
    const lb = game.leaderboard;
    if (!play || !player || play.player_key !== player.key) return { status: 404, error: 'unknown_play', message: 'No such play.' };
    if (play.game_id !== game.id) return { status: 409, error: 'wrong_game', message: 'That play is for another game.' };
    if (!play.ended_at) return { status: 409, error: 'not_finished', message: 'Finish the run first.' };
    if (lb.outcome && play.outcome !== lb.outcome) return { status: 409, error: 'not_eligible', message: 'Only a win can go on the board.' };
    if (Date.parse(play.ended_at) < now() - lb.postWindowHours * 3_600_000) return { status: 409, error: 'too_late', message: 'This run is too old to post.' };
    let value, meta = null;
    try { meta = play.meta ? JSON.parse(play.meta) : null; } catch { meta = null; }
    if (lb.metric === 'survival') {
      const serverMs = Date.parse(play.ended_at) - Date.parse(play.started_at);
      const clientMs = meta && Number.isSafeInteger(meta.ms) && meta.ms >= 0 ? meta.ms : serverMs;
      const ms = Math.min(serverMs, clientMs), kills = play.score;
      if (!Number.isSafeInteger(ms) || ms < lb.minMs) return { status: 409, error: 'implausible', message: 'That run was too short to count.' };
      if (lb.maxMs && ms > lb.maxMs) return { status: 409, error: 'implausible', message: 'That run was implausibly long.' };
      if (!Number.isSafeInteger(kills) || kills < 0 || kills > 99_999) return { status: 409, error: 'no_score', message: 'This run has no kill count.' };
      if (lb.maxScorePerSec && kills > (ms / 1000) * lb.maxScorePerSec + 30) return { status: 409, error: 'implausible', message: 'That many kills is not plausible.' };
      value = Math.floor(ms / 100) * 100_000 + kills;
    } else if (lb.metric === 'duration') {
      value = Date.parse(play.ended_at) - Date.parse(play.started_at);
      if (!Number.isSafeInteger(value) || value < lb.minMs) return { status: 409, error: 'implausible', message: 'That run was too fast to count.' };
    } else {
      value = play.score;
      if (!Number.isSafeInteger(value)) return { status: 409, error: 'no_score', message: 'This run has no score.' };
    }
    if (forShare) return { value, meta };
    if (q.byPlay.get(play.id)) return { status: 409, error: 'already_posted', message: 'This run is already on the board.' };
    return { value };
  }

  function board(game, player, extra = {}) {
    const lb = game.leaderboard, dir = lb.order, out = outOf(game), per = lb.bestPerPlayer;
    const top = q[`${per ? 'ptop' : 'top'}_${dir}`].all(game.id, lb.top || TOP).map((e, i) => ({ rank: i + 1, ...out(e), mine: Boolean(player && e.player_key === player.key) }));
    let me = null;
    if (player) {
      const b = q[`best_${dir}`].get(game.id, player.key);
      if (b) me = { rank: rankOf(game, player.key, b.value, b.id), ...out(b) };
    }
    return {
      game_id: game.id, metric: lb.metric === 'duration' ? 'duration_ms' : lb.metric === 'survival' ? 'survival' : 'score', order: dir,
      nameMax: Math.min(NAME_MAX, lb.nameMax || NAME_MAX), ...(lb.nameMin > 1 ? { nameMin: lb.nameMin } : {}), total: (per ? q.ptotal : q.total).get(game.id).n, top, me, season: seasonOf(game.id), ...extra,
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
      if (u) { const lbc = game.leaderboard, c = cleanName(u.username.slice(0, Math.min(NAME_MAX, lbc.nameMax || NAME_MAX)), { min: lbc.nameMin || 1, max: lbc.nameMax || NAME_MAX }); prefill = c.ok ? c.name : null; }
    }
    let candidate;
    if (req.query.play_id !== undefined) {
      const id = Number(req.query.play_id);
      const e = eligibility(game, Number.isInteger(id) ? q.play.get(id) : null, player);
      candidate = e.error ? { play_id: id, eligible: false, error: e.error, message: e.message }
        : { play_id: id, eligible: true, value: e.value, rank: rankOf(game, player && player.key, e.value, null) };
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
    // A board with blankName takes a blank name (Last Tower v19: OK works on an empty name) and stores the default instead.
    const rawName = req.body?.name, blank = rawName === undefined || rawName === null || (typeof rawName === 'string' && !rawName.trim());
    const n = cleanName(blank && game.leaderboard.blankName ? game.leaderboard.blankName : rawName, { min: game.leaderboard.nameMin || 1, max: game.leaderboard.nameMax || NAME_MAX });
    if (!n.ok) return fail(reply, 400, n.error, n.message);
    if (limited(reply, `lb:player:${player.key}`, game.leaderboard.postsPerPlayer || 6, 10 * MINUTE)) return;
    let entryId;
    try {
      entryId = Number(q.insert.run(game.id, id, player.key, player.accountId, n.name, e.value, iso()).lastInsertRowid);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return fail(reply, 409, 'already_posted', 'This run is already on the board.');
      throw err;
    }
    reply.code(201);
    return board(game, player, { entry: { rank: rankOf(game, player.key, e.value, entryId), ...outOf(game)({ id: entryId, name: n.name, value: e.value }) } });
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

  // v22: wipe a whole board and start a new season. Body { confirm: "<gameId>" } so a
  // stray call can't do it. Only that game's rows are touched.
  app.post('/plays/leaderboard/:gameId/reset', async (req, reply) => {
    if (limited(reply, `admin:ip:${req.ip}`, 30, MINUTE)) return;
    if (!admin(req, reply)) return;
    const game = boardOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_leaderboard', 'This game has no leaderboard.');
    if (req.body?.confirm !== game.id) return fail(reply, 400, 'confirm_required', `Send {"confirm":"${game.id}"} to reset this board.`);
    const at = iso();
    const r = tx(db, () => {
      const removed = Number(q.removeAll.run(at, game.id).changes), closed = Number(q.closeOpen.run(at, game.id).changes);
      const season = seasonOf(game.id) + 1; q.setSeason.run(game.id, season, at);
      return { removed, closed, season };
    });
    req.log.info({ game: game.id, ...r }, 'leaderboard reset by admin');
    return { ok: true, game_id: game.id, removed_entries: r.removed, closed_plays: r.closed, season: r.season, reset_at: at };
  });

  // ---- v22 share links (TIME CARD)
  const SHARE_GAMES = new Set(['last-tower']);
  const shareUrl = id => `${cfg.publicOrigin}/plays/s/${id}`;
  const shareOut = s => ({ id: s.id, url: shareUrl(s.id), image: `${shareUrl(s.id)}.png`, name: s.name, ms: s.ms, kills: s.kills, ach: s.ach, rank: s.rank, total: s.total, season: s.season });
  app.post('/plays/share/:gameId', async (req, reply) => {
    const game = boardOf(req.params.gameId);
    if (!game || !SHARE_GAMES.has(game.id)) return fail(reply, 404, 'no_share', 'This game has no share cards.');
    if (limited(reply, `share:ip:${req.ip}`, 20, 10 * MINUTE)) return;
    const player = playerOf(req);
    const id = Number(req.body?.play_id), play = Number.isInteger(id) ? q.play.get(id) : null;
    const e = eligibility(game, play, player, { forShare: true });
    if (e.error) return fail(reply, e.status, e.error, e.message);
    const had = q.shareOfPlay.get(id);
    if (had) return shareOut(had);
    if (limited(reply, `share:player:${player.key}`, 8, 10 * MINUTE)) return;
    const lb = game.leaderboard, ms = Math.floor(e.value / 100_000) * 100, kills = e.value % 100_000;
    const ach = Math.max(0, Math.min(100, Number.isInteger(e.meta?.ach) ? e.meta.ach : 0)); // recorded at run end, cosmetic only
    const entry = q.entryOfPlay.get(id);
    let name;
    if (entry) name = entry.name;
    else {
      const raw = req.body?.name, blank = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim());
      const n = cleanName(blank ? (lb.blankName || 'ANON HEN') : raw, { min: lb.nameMin || 1, max: lb.nameMax || NAME_MAX });
      name = n.ok ? n.name : (lb.blankName || 'ANON HEN');
    }
    const rank = rankOf(game, player.key, e.value, entry ? entry.id : null);
    const total = (lb.bestPerPlayer ? q.ptotal : q.total).get(game.id).n + (entry || (lb.bestPerPlayer && q.onBoard.get(game.id, player.key)) ? 0 : 1);
    const sid = crypto.randomBytes(9).toString('base64url');
    try { q.shareInsert.run(sid, game.id, id, player.key, name, ms, kills, ach, rank, total, seasonOf(game.id), iso()); }
    catch (err) { if (String(err.message).includes('UNIQUE')) { const s2 = q.shareOfPlay.get(id); if (s2) return shareOut(s2); } throw err; }
    reply.code(201);
    return shareOut(q.share.get(sid));
  });

  const pngCache = new Map();
  app.get('/plays/s/:file', async (req, reply) => {
    const m = /^([A-Za-z0-9_-]{12})(\.png)?$/.exec(req.params.file || '');
    const s = m ? q.share.get(m[1]) : null;
    if (!s) return fail(reply, 404, 'unknown_share', 'No such card.');
    if (m[2]) {
      let png = pngCache.get(s.id);
      if (!png) { png = cardPng({ name: s.name, ms: s.ms, rank: s.rank, total: s.total, kills: s.kills, ach: s.ach }); pngCache.set(s.id, png); if (pngCache.size > 300) pngCache.delete(pngCache.keys().next().value); }
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.type('image/png').send(png);
    }
    const t = fmtTime(s.ms), title = `${escapeHtml(s.name)} survived ${t} on ZOMBIE FARM`;
    const desc = s.rank ? `Ranked #${s.rank}${s.total ? ` of ${s.total}` : ''} with ${s.kills} kills. Billions must bok. Can you beat it?` : `${s.kills} kills. Billions must bok. Can you beat it?`;
    const img = `${shareUrl(s.id)}.png`, play = `${cfg.publicOrigin}/zombie-farm/`;
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website"><meta property="og:site_name" content="membersonly.cc">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
<meta property="og:url" content="${shareUrl(s.id)}"><meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="675"><meta property="og:image:alt" content="ZOMBIE FARM time card: ${t}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${img}">
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#160d2e;color:#fff;font:600 16px system-ui,sans-serif}img{width:min(92vw,900px);image-rendering:pixelated;border:3px solid #090b0a;border-radius:6px}a{color:#090b0a;background:#ffc42f;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:800}</style>
</head><body><img src="${img}" alt="ZOMBIE FARM time card"><a href="${play}">PLAY ZOMBIE FARM</a>
<script>setTimeout(function(){location.replace(${JSON.stringify(play)})},2500)</script></body></html>`);
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
