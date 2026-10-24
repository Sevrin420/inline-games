// v6: "current run" storage. The server remembers the run a player is in the
// middle of, so reopening the game resumes it (Sovereign: no save/load UI; one
// bite still ends the run for good). Only games with a "runs" block in
// server/games.json have it.
//
//   GET    /plays/run/:gameId[?rid=]       -> { run, rid, updated_at, ended }
//          ended: the ?rid= run is over (died / wiped), so a cached copy must not be resumed
//   PUT    /plays/run/:gameId { rid, run } -> { ok }   upsert this player's run
//          410 run_ended if that rid was ended before (no reviving a dead run)
//   DELETE /plays/run/:gameId?rid=[&all=1] -> { ok }   end the run (tombstone rid);
//          all=1 also ends whatever run is stored (power-cycle wipe)
//
// Whose run it is comes from the session (account) or the guest id cookie,
// never from the body, so nobody can read or overwrite another player's run.
// A guest with no id yet gets one on the first PUT (as /plays/start does).
const MINUTE = 60_000;
const RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const TOMBSTONE_DAYS = 90;

export function registerRuns(app, { db, games, now, iso, fail, limited, playerOf, newGuest, tokenMode }) {
  const q = {
    get: db.prepare('SELECT run_id, data, updated_at FROM game_runs WHERE game_id = ? AND player_key = ?'),
    upsert: db.prepare(`INSERT INTO game_runs (game_id, player_key, run_id, data, bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id, player_key) DO UPDATE SET run_id = excluded.run_id, data = excluded.data, bytes = excluded.bytes, updated_at = excluded.updated_at`),
    del: db.prepare('DELETE FROM game_runs WHERE game_id = ? AND player_key = ? AND (run_id = ? OR ? = 1)'),
    tomb: db.prepare('INSERT OR IGNORE INTO run_tombstones (game_id, player_key, run_id, ended_at) VALUES (?, ?, ?, ?)'),
    isTomb: db.prepare('SELECT 1 AS y FROM run_tombstones WHERE game_id = ? AND player_key = ? AND run_id = ?'),
    purge: db.prepare('DELETE FROM run_tombstones WHERE ended_at < ?'),
  };
  const gameOf = id => { const g = games.get(id); return g && g.runs ? g : null; };
  const rid = v => (typeof v === 'string' && RID_RE.test(v) ? v : null);

  app.get('/plays/run/:gameId', async (req, reply) => {
    const game = gameOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_runs', 'This game does not keep runs.');
    const player = playerOf(req);
    const ask = rid(req.query.rid);
    if (!player) return { run: null, rid: null, updated_at: null, ended: false };
    const row = q.get.get(game.id, player.key);
    let run = null;
    if (row) { try { run = JSON.parse(row.data); } catch { run = null; } }
    return {
      run, rid: row ? row.run_id : null, updated_at: row ? row.updated_at : null,
      ended: Boolean(ask && (!row || row.run_id !== ask) && q.isTomb.get(game.id, player.key, ask)),
    };
  });

  app.put('/plays/run/:gameId', { bodyLimit: 1024 * 1024 + 4096 }, async (req, reply) => {
    const game = gameOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_runs', 'This game does not keep runs.');
    if (limited(reply, `runs:ip:${req.ip}`, 120, MINUTE)) return;
    const b = req.body || {};
    const id = rid(b.rid);
    if (!id) return fail(reply, 400, 'bad_rid', 'rid must be 8-40 letters, digits, - or _.');
    if (!b.run || typeof b.run !== 'object' || Array.isArray(b.run)) return fail(reply, 400, 'bad_run', 'run must be an object.');
    const data = JSON.stringify(b.run);
    const bytes = Buffer.byteLength(data);
    if (bytes > game.runs.maxBytes) return fail(reply, 413, 'too_large', 'This run is too large to store.');
    let player = playerOf(req), fresh = null;
    if (!player) { fresh = newGuest(reply); player = fresh; }
    if (limited(reply, `runs:p:${player.key}`, 40, MINUTE)) return;
    if (q.isTomb.get(game.id, player.key, id)) return fail(reply, 410, 'run_ended', 'That run is over.');
    q.upsert.run(game.id, player.key, id, data, bytes, iso());
    return { ok: true, player: player.accountId ? 'account' : 'anon', ...(fresh && tokenMode(req) ? { anonId: fresh.anonId } : {}) };
  });

  app.delete('/plays/run/:gameId', async (req, reply) => {
    const game = gameOf(req.params.gameId);
    if (!game) return fail(reply, 404, 'no_runs', 'This game does not keep runs.');
    if (limited(reply, `runs:ip:${req.ip}`, 120, MINUTE)) return;
    const player = playerOf(req);
    if (!player) return { ok: true, removed: 0 };
    const id = rid(req.query.rid), all = req.query.all === '1' ? 1 : 0;
    if (!id && !all) return fail(reply, 400, 'bad_rid', 'Give the run id (rid) or all=1.');
    const row = q.get.get(game.id, player.key), t = iso();
    if (id) q.tomb.run(game.id, player.key, id, t);
    if (all && row) q.tomb.run(game.id, player.key, row.run_id, t);
    const r = q.del.run(game.id, player.key, id || '', all);
    return { ok: true, removed: Number(r.changes) };
  });

  return {
    purge() { q.purge.run(iso(now() - TOMBSTONE_DAYS * 86_400_000)); },
  };
}
