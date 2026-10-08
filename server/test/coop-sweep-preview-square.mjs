// Renders games/coop-sweep/previ-square.jpg (1080x1080 square X card image for /coop-sweep/x/) from the game
// itself, using its ?shot mode. Needs Chrome (CHROME_PATH, default /usr/bin/google-chrome).
//   node test/coop-sweep-preview-square.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const gamesDir = path.join(here, '..', '..', 'games');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const f = path.join(gamesDir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(gamesDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 480, deviceScaleFactor: 2.25 });
await page.goto(`http://127.0.0.1:${srv.address().port}/coop-sweep/?shot`);
await page.waitForFunction(() => window.__CS && window.__CS.henImagesLoaded() === (window.COOP_HENS || []).length);
await new Promise(r => setTimeout(r, 500));
const out = path.join(gamesDir, 'coop-sweep', 'previ-square.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await browser.close(); srv.close();
console.log('wrote', out);
