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
    map.set(g.id, { id: g.id, title: String(g.title || g.id), access: g.access, scoreTrusted: g.scoreTrusted === true, scoreOrder, bestOutcome });
  }
  return map;
}
