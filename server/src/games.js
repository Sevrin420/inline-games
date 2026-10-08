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
    map.set(g.id, { id: g.id, title: String(g.title || g.id), access: g.access, scoreTrusted: g.scoreTrusted === true });
  }
  return map;
}
