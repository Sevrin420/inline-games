import { loadConfig, configWarnings } from './config.js';
import { loadGames } from './games.js';
import { buildApp } from './app.js';

const cfg = loadConfig();
const games = loadGames(cfg.gamesFile);
const app = await buildApp({
  cfg, games,
  logger: { level: cfg.logLevel, redact: ['req.headers.authorization', 'req.headers.cookie'] },
});
for (const w of configWarnings(cfg, [...games.values()])) app.log.warn(w);

const shutdown = async sig => { app.log.info(`${sig}: shutting down`); await app.close(); process.exit(0); };
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await app.listen({ host: cfg.host, port: cfg.port });
app.log.info(`inline-games API on http://${cfg.host}:${cfg.port} (public origin ${cfg.publicOrigin}, SIWE domain ${cfg.siweDomain}, chain ${cfg.siweChainId})`);
