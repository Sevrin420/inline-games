// All configuration comes from environment variables (see .env.example).
// Nothing secret is required to boot: sessions are random tokens stored as
// hashes, so there is no signing key. The only value that may carry a
// credential is NFT_GATE_RPC_URL (some RPC providers put an API key in it).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function bool(v, dflt) {
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(v);
}
function int(v, dflt, name) {
  if (v === undefined || v === '') return dflt;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer, got "${v}"`);
  return n;
}

export function loadConfig(env = process.env) {
  const publicOrigin = (env.PUBLIC_ORIGIN || 'https://membersonly.cc').replace(/\/+$/, '');
  const allowedOrigins = (env.ALLOWED_ORIGINS || publicOrigin)
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

  const gate = {
    chainId: env.NFT_GATE_CHAIN_ID ? int(env.NFT_GATE_CHAIN_ID, null, 'NFT_GATE_CHAIN_ID') : null,
    rpcUrl: env.NFT_GATE_RPC_URL || null,
    contract: env.NFT_GATE_CONTRACT || null,
    minBalance: BigInt(env.NFT_GATE_MIN_BALANCE || '1'),
    cacheSeconds: int(env.NFT_GATE_CACHE_SECONDS, 45, 'NFT_GATE_CACHE_SECONDS'),
  };
  gate.configured = Boolean(gate.chainId && gate.rpcUrl && gate.contract);

  const cfg = {
    host: env.HOST || '127.0.0.1',
    port: int(env.PORT, 3100, 'PORT'),
    dbPath: env.DB_PATH || path.join(here, '..', 'data', 'inline-games.sqlite'),
    gamesFile: env.GAMES_FILE || path.join(here, '..', 'games.json'),
    publicOrigin,
    allowedOrigins,
    siweDomain: env.SIWE_DOMAIN || new URL(publicOrigin).host,
    siweChainId: int(env.SIWE_CHAIN_ID, 1, 'SIWE_CHAIN_ID'),
    cookieDomain: env.COOKIE_DOMAIN === undefined ? '.membersonly.cc' : (env.COOKIE_DOMAIN || null),
    cookieSecure: bool(env.COOKIE_SECURE, true),
    trustProxy: env.TRUST_PROXY === undefined ? '127.0.0.1' : (env.TRUST_PROXY || false),
    stalePlayHours: int(env.STALE_PLAY_HOURS, 24, 'STALE_PLAY_HOURS'),
    devStaticDir: env.DEV_STATIC_DIR || null,
    logLevel: env.LOG_LEVEL || 'info',
    gate,
    // Admin-only endpoints (leaderboard moderation). Unset or short = disabled.
    adminToken: env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 24 ? env.ADMIN_TOKEN : null,
  };
  return cfg;
}

// Problems worth shouting about at startup, without refusing to boot.
export function configWarnings(cfg, games) {
  const w = [];
  if (!cfg.gate.configured) {
    const nftGames = games.filter(g => g.access === 'nft').map(g => g.id);
    w.push('NFT gate not configured (NFT_GATE_CHAIN_ID, NFT_GATE_RPC_URL, NFT_GATE_CONTRACT). ' +
      (nftGames.length ? `These nft-level games will refuse entry: ${nftGames.join(', ')}` : 'No game needs it yet.'));
  }
  if (cfg.cookieSecure && cfg.publicOrigin.startsWith('http://') && !/^http:\/\/localhost(:|$)/.test(cfg.publicOrigin)) {
    w.push('COOKIE_SECURE is on but PUBLIC_ORIGIN is http://, so browsers will drop the session cookie.');
  }
  if (cfg.devStaticDir) w.push(`DEV_STATIC_DIR is set: serving ${cfg.devStaticDir} (local development only).`);
  return w;
}
