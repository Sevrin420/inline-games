// Game registry: the ONLY place a game's access level is set (config, not code).
import fs from 'node:fs';

export const ACCESS_LEVELS = ['open', 'account', 'wallet', 'nft'];

export function loadGames(file) {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${file} must be a JSON array`);
  const map = new Map();
  for (const g of list) {
    if (!g || typeof g.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(g.id)) throw new Error(`Bad game id in ${file}: ${JSON.stringify(g)}`);
    if (!ACCESS_LEVELS.includes(g.access)) throw new Error(`Game ${g.id}: access must be one of ${ACCESS_LEVELS.join(', ')}`);
    if (map.has(g.id)) throw new Error(`Duplicate game id ${g.id}`);
    // scoreOrder: 'desc' (higher is better, default) or 'asc' (e.g. a time to clear).
    // bestOutcome: only plays with this outcome count towards "best" (default: any finished play).
    const scoreOrder = g.scoreOrder === undefined ? 'desc' : g.scoreOrder;
    if (scoreOrder !== 'asc' && scoreOrder !== 'desc') throw new Error(`Game ${g.id}: scoreOrder must be asc or desc`);
    const bestOutcome = g.bestOutcome === undefined ? null : g.bestOutcome;
    if (bestOutcome !== null && (typeof bestOutcome !== 'string' || !/^[a-z_-]{1,32}$/.test(bestOutcome))) throw new Error(`Game ${g.id}: bad bestOutcome`);
    map.set(g.id, { id: g.id, title: String(g.title || g.id), access: g.access, scoreTrusted: g.scoreTrusted === true, scoreOrder, bestOutcome,
      leaderboard: leaderboardConfig(g) });
  }
  return map;
}

// Optional per-game leaderboard. Absent = no leaderboard for that game.
//   metric           'duration': server-measured play time in ms (start -> end); can't be set by the client
//                    'score':    the client-reported score (unverified; only for games that accept that)
//   order            'asc' (smaller is better, e.g. a time) or 'desc'
//   outcome          only finished plays with this outcome can be posted (e.g. 'win')
//   minMs            duration floor: faster "wins" are refused as implausible (duration metric only)
//   postWindowHours  how long after a play ends it can still be posted
function leaderboardConfig(g) {
  const lb = g.leaderboard;
  if (lb === undefined || lb === null || lb === false) return null;
  const bad = m => { throw new Error(`Game ${g.id}: leaderboard ${m}`); };
  if (typeof lb !== 'object') bad('must be an object');
  const metric = lb.metric || 'duration';
  if (metric !== 'duration' && metric !== 'score') bad('metric must be duration or score');
  const order = lb.order || (metric === 'duration' ? 'asc' : 'desc');
  if (order !== 'asc' && order !== 'desc') bad('order must be asc or desc');
  const outcome = lb.outcome === undefined ? null : lb.outcome;
  if (outcome !== null && (typeof outcome !== 'string' || !/^[a-z_-]{1,32}$/.test(outcome))) bad('bad outcome');
  const minMs = lb.minMs === undefined ? 0 : lb.minMs;
  if (!Number.isInteger(minMs) || minMs < 0) bad('minMs must be a non-negative integer');
  const postWindowHours = lb.postWindowHours === undefined ? 24 : lb.postWindowHours;
  if (typeof postWindowHours !== 'number' || !(postWindowHours > 0)) bad('postWindowHours must be > 0');
  return { metric, order, outcome, minMs, postWindowHours };
}
