/* ZOMBIE FARM v26 (intro TOP 10 as a large falling overlay; the buff hen back in his normal close-up) v25 (gold cards: 1.5 s hold, one start per 8 s, the backlog merges into one card) v24 (quote band 70% size, flush bottom-right beside the gun panel, fades to 35% over the hen) v23 (achievement pop-up + quote band timings back to v21; v22 positions kept) v22 (the power switch drives all audio, a hidden tab suspends it; slower, raised achievement pop-ups; the intro buff hen stands on the silo dome; a shareable TIME CARD after each run; board seasons) v21 (off-white paper back for the player hen, smaller shell hen, REAL audio: Halo Reach multi-kills + Slayer/Game Over, UT99 streaks + First Blood, SF2 UI sounds; rare callouts with a shared 13 s cooldown) v20 (renamed from Last Tower; static dusk grade, sickly green/grey/brown zombies with blood, Paper-Mario cardboard standees with flip turns, buff-hen-on-the-silo intro, /zombie-farm/ alias) LAST TOWER v19 (OK lit at once: a blank name is fine and shows as ANON HEN; music ~2x louder via compressor + makeup gain, master limiter) v18 (100 achievements + count-only credits, big bottom-band flock cards, always bright day, full A-Z 0-9 name grid up to 12) v17 (blank name entry before the first credits: tappable letters, D-pad wheel, check; v16 auto names dropped) v16 (ending-credits death roll + global TOP 20 FLOCK leaderboard + arcade name, shoot restarts any time, original chiptune polka BOK-A-POLKA, no-hit streak meter, wordless shell) v15 (2 guns MG + SHOTGUN with per-minute tiers, faster ammo, THE FLOCK community pfps) v14 (round analog SHOOT stick, no pause, no instructions) v13 (3x pickups, achievements, single big START) v12 (2-button diagonal chord window 110 ms + tap-fires-on-release) v11 (hens.farm skin: real hens.farm art layers + skinned shell; 2-button diagonal shooting) v10 (twin-stick: compass SHOOT pad, no life drain — only hits hurt) v9 (swarm edition: enemy attack moves, guns + machine gun, punchier colours) (chikn edition, survival + egg throwers; interrupted meals are lost): no tower, draining life, eat on crates. v4: 3/4 top-down pixel survival, reskinned in the hens.farm cartoon vibe (HENS-STYLE-NOTES.md).
   Rendering rules from v2 (16-bit SNES adventure style):
   Original art, all generated in code: 16x16 metatiles, 4bpp-style sprites with near-black outlines,
   3-tone ramps lit from the top-left, drop shadows, ledge hopping. See STYLE-NOTES.md in the repo root. */

// ================================================================ basics
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ROOT = document.documentElement;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
// v9 "make the colours pop": one-off saturation + contrast pass over every baked canvas (map, props, items, sprite sheet). ?pop=0 = the v8 look.
const POP = !/[?&]pop=0\b/.test(location.search);
const HENS_LOCK = [[8, 209, 74], [248, 245, 233], [9, 11, 10], [255, 196, 47], [255, 51, 71], [142, 216, 255], [255, 255, 255]]; // green, cream, ink, gold, red, sky, white
function popCanvas(c, sat = 1.38, con = 1.16) {
  if (!POP || !c || !c.width) return c; const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const r = d[i], g = d[i + 1], b = d[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (HENS_LOCK.some((q) => Math.abs(q[0] - r) + Math.abs(q[1] - g) + Math.abs(q[2] - b) < 10)) continue; // v11: hens.farm palette colours stay exact
    for (let k = 0; k < 3; k++) { let v = l + (d[i + k] - l) * sat; if (v < 170) v = 170 - (170 - v) * con; d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; } } // deepen mids/darks, keep the cream highlights
  x.putImageData(im, 0, 0); return c;
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const shellOn = () => { const H = window.Handheld && window.Handheld.current; const on = ROOT.classList.contains('hh-active') && !!H && H.visible !== false; ROOT.classList.toggle('lt-shell', on); return on; };
const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touchDev) ROOT.classList.add('lt-touch');

// ================================================================ screen: one square canvas, integer device-pixel scale
const cv = $('c'), hx = cv.getContext('2d', { alpha: false });
function px(x, c, X, Y, w = 1, h = 1) { x.fillStyle = c; x.fillRect(X, Y, w, h); }
const light = { c: null, x: null, resize(n) { [this.c, this.x] = mk(n, n); } };
let N = 0;
function resize() {
  shellOn();
  const box = $('stage').getBoundingClientRect(), dpr = Math.min(4, window.devicePixelRatio || 1);
  const css = Math.max(1, Math.min(box.width, box.height));
  const dev = Math.floor(css * dpr + 0.01);
  const k = Math.max(1, Math.ceil(dev / 300));            // device px per game px: always an integer
  const n = Math.max(96, Math.floor(dev / k));
  if (n !== N) { N = n; cv.width = N; cv.height = N; hx.imageSmoothingEnabled = false; light.resize(N); }
  // the shell scales its device with a CSS transform: convert visual px back to layout px; snap to the device grid
  const lay = parseFloat(getComputedStyle($('stage')).width) || box.width, sc = box.width / lay || 1;
  const sz = N * k / dpr;
  const topAlign = !shellOn() && touchDev && box.height > box.width * 1.2;
  const fx = (box.left + (box.width - sz) / 2) * dpr, fy = (box.top + (topAlign ? Math.min(12, (box.height - sz) / 2) : (box.height - sz) / 2)) * dpr;
  const ox = Math.round(fx) / dpr - box.left, oy = Math.round(fy) / dpr - box.top;
  Object.assign(cv.style, { width: sz / sc + 'px', height: sz / sc + 'px', left: ox / sc + 'px', top: oy / sc + 'px' });
}
addEventListener('resize', () => { resize(); setTimeout(resize, 120); });

// ================================================================ palette: hens.farm vibe, bright flat cartoon farm (see HENS-STYLE-NOTES.md)
// ink outlines (#090b0a), cream, bright grass green #08d14a, gold #ffc42f, red #ff3347, sky #8ed8ff; ramps kept short and flat.
const OUT = '#090b0a';
const RAMP = {
  asphalt: ['#efe3c4', '#e2d2a8', '#c9b482', '#8f7c52'],   // v11: cream-tan farm track (sits between cream and gold)
  walk: ['#ffe08a', '#ffc42f', '#d89a14', '#8c6214'],      // v11: straw verge = hens.farm gold
  plaza: ['#fffdf5', '#f8f5e9', '#e4dcc2', '#a99c76'],     // hens.farm cream     // cream farmyard
  grass: ['#3fe070', '#08d14a', '#06a83b', '#036b2b'],      // hens.farm green
  dirt: ['#c39260', '#a77748', '#855a36', '#5a3c26'],      // tilled field
  brick: ['#ff6470', '#ff3347', '#c8202f', '#80141f'],     // barn red = hens.farm comb red
  conc: ['#ffffff', '#f8f5e9', '#e4dcc2', '#a99c76'],      // whitewash = hens.farm cream
  tower: ['#f0c27e', '#d69e5a', '#a87840', '#6e4c28'],     // coop planks
  roof: ['#4a504c', '#2e3330', '#1c201e', '#090b0a'],      // v11: ink barn roofs
  rust: ['#ffb24a', '#f0901e', '#c06a16', '#7e420e'],
  metal: ['#e4e8ea', '#bfc6cb', '#939ba2', '#5c636a'],
  hazard: ['#ffe066', '#ffc42f', '#d89a14', '#8c6214'],
  car1: ['#56e886', '#14c94e', '#0a9238', '#055a22'],      // tractor green
  car2: ['#ff6a78', '#ff3347', '#c8202f', '#80141f'],      // tractor red
  car3: ['#ffe066', '#ffc42f', '#d49a1c', '#8c6214'],      // tractor yellow
  glass: ['#e2f6ff', '#8ed8ff', '#58aedc', '#2e6c96'],    // hens.farm sky
  lit: ['#fff4b0', '#ffc42f', '#d89a14', '#8c6214'],
  wood: ['#d09a5a', '#a87440', '#7e5430', '#523620'],
  fire: ['#fff6c8', '#ffc42f', '#ff7a1a', '#d0301c'],
  water: ['#b8e8ff', '#8ed8ff', '#5ab0e0', '#2f6f9a'],
  blood: ['#9ac83a', '#6e9a26', '#4c701a', '#2e4610'],      // zombie goo (green, cartoon-friendly)
  hay: ['#fff0a0', '#ffc42f', '#d89a14', '#8c6214'],
  worm: ['#ffc4ca', '#ff9aa4', '#e0606a', '#a03a44'],
  leaf: ['#3fe070', '#08d14a', '#06a83b', '#036b2b'],      // v11: trees = hens.farm green
  // actors: hens
  feather: ['#ffffff', '#ffffff', '#e4e7ea', '#b9c0c6'],
  fshade: ['#d9dde1', '#d9dde1', '#c2c8ce', '#a0a8b0'],
  comb: ['#ff4b5a', '#ff3347', '#d4202f', '#8a1420'],
  beak: ['#ffd65a', '#ffc42f', '#e39a12', '#a06a0a'],
  leg: ['#ffb84a', '#ff9d00', '#d47c00', '#8c5000'],
  ink: ['#090b0a', '#090b0a', '#090b0a', '#090b0a'],
  bandana: ['#4fc3ff', '#1a9be6', '#0f6fb0', '#0a4a78'],    // the hero hen's blue bandana
  // undead flock
  zf1: ['#e0edbc', '#c2d99a', '#9cb874', '#6a8250'],
  zf2: ['#e6dccb', '#c9b9a0', '#a2907a', '#6e6050'],
  zf3: ['#ddd3ea', '#bcaed2', '#9586ad', '#64587a'],
  zcomb: ['#b4505c', '#94384a', '#6c2836', '#461824'],
  rooster: ['#a07a5a', '#7e5c44', '#5c4232', '#3a2a22'],
  rtail: ['#4a9a80', '#2c6e60', '#1c4c44', '#10302c'],
  eyeZ: ['#d8ff40', '#d8ff40', '#d8ff40', '#d8ff40'],
  eyeB: ['#ff5030', '#ff5030', '#ff5030', '#ff5030'],
  glint: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
};
const DARK_SHADOW = 'rgba(9,11,10,0.4)'; // hard ink offset shadows, like hens.farm's 6px 7px 0 ink card shadows
// ================================================================ crisp pixel text: built-in 5x7 bitmap font (no smoothing, no font loading)
const FONT = {
  A: [0x7C, 0x12, 0x11, 0x12, 0x7C], B: [0x7F, 0x49, 0x49, 0x49, 0x36], C: [0x3E, 0x41, 0x41, 0x41, 0x22], D: [0x7F, 0x41, 0x41, 0x22, 0x1C],
  E: [0x7F, 0x49, 0x49, 0x49, 0x41], F: [0x7F, 0x09, 0x09, 0x09, 0x01], G: [0x3E, 0x41, 0x49, 0x49, 0x7A], H: [0x7F, 0x08, 0x08, 0x08, 0x7F],
  I: [0x41, 0x7F, 0x41], J: [0x20, 0x40, 0x41, 0x3F, 0x01], K: [0x7F, 0x08, 0x14, 0x22, 0x41], L: [0x7F, 0x40, 0x40, 0x40, 0x40],
  M: [0x7F, 0x02, 0x0C, 0x02, 0x7F], N: [0x7F, 0x04, 0x08, 0x10, 0x7F], O: [0x3E, 0x41, 0x41, 0x41, 0x3E], P: [0x7F, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3E, 0x41, 0x51, 0x21, 0x5E], R: [0x7F, 0x09, 0x19, 0x29, 0x46], S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [0x01, 0x01, 0x7F, 0x01, 0x01],
  U: [0x3F, 0x40, 0x40, 0x40, 0x3F], V: [0x1F, 0x20, 0x40, 0x20, 0x1F], W: [0x3F, 0x40, 0x38, 0x40, 0x3F], X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  0: [0x3E, 0x51, 0x49, 0x45, 0x3E], 1: [0x42, 0x7F, 0x40], 2: [0x42, 0x61, 0x51, 0x49, 0x46], 3: [0x21, 0x41, 0x45, 0x4B, 0x31],
  4: [0x18, 0x14, 0x12, 0x7F, 0x10], 5: [0x27, 0x45, 0x45, 0x45, 0x39], 6: [0x3C, 0x4A, 0x49, 0x49, 0x30], 7: [0x01, 0x71, 0x09, 0x05, 0x03],
  8: [0x36, 0x49, 0x49, 0x49, 0x36], 9: [0x06, 0x49, 0x49, 0x29, 0x1E],
  ' ': [0, 0], '.': [0x60, 0x60], ',': [0x80, 0x60], ':': [0x36, 0x36], '!': [0x5F], '?': [0x02, 0x01, 0x51, 0x09, 0x06], '-': [0x08, 0x08, 0x08, 0x08],
  '/': [0x60, 0x18, 0x06, 0x01], '+': [0x08, 0x08, 0x3E, 0x08, 0x08], '%': [0x23, 0x13, 0x08, 0x64, 0x62], '>': [0x41, 0x22, 0x14, 0x08],
  '<': [0x08, 0x14, 0x22, 0x41], '(': [0x1C, 0x22, 0x41], ')': [0x41, 0x22, 0x1C], '&': [0x36, 0x49, 0x55, 0x22, 0x50], "'": [0x05, 0x03], '*': [0x2A, 0x1C, 0x3E, 0x1C, 0x2A], '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12], '@': [0x3E, 0x41, 0x5D, 0x55, 0x1E], '_': [0x40, 0x40, 0x40, 0x40], '#': [0x14, 0x7F, 0x14, 0x7F, 0x14],
};
const textCache = new Map();
function textImg(str, size, col, outline) {
  const key = str + '|' + size + '|' + col + '|' + outline;
  let c = textCache.get(key); if (c) return c;
  const sc = size >= 16 ? 2 : 1, glyphs = [...str.toUpperCase()].map((ch) => FONT[ch] || FONT['?']);
  const w0 = glyphs.reduce((a, g) => a + g.length + 1, 0) - 1;
  const w = (w0 + 2) * sc, h = 10 * sc; let x;
  [c, x] = mk(Math.max(1, w), h);
  const draw = (ox, oy, fill) => { x.fillStyle = fill; let cx = 1; for (const g of glyphs) { for (let i = 0; i < g.length; i++) for (let b = 0; b < 8; b++) if (g[i] >> b & 1) x.fillRect((cx + i) * sc + ox, (b + 1) * sc + oy, sc, sc); cx += g.length + 1; } };
  if (outline) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) draw(dx * (sc > 1 ? sc / 2 : 1), dy * (sc > 1 ? sc / 2 : 1), '#0e090c');
  draw(0, 0, col);
  if (textCache.size > 600) textCache.clear();
  textCache.set(key, c); return c;
}
function text(str, x, y, size = 8, col = '#e8d6a8', align = 'left', outline = true) {
  const t = textImg(String(str), size, col, outline);
  const dx = align === 'center' ? Math.round(x - t.width / 2) : align === 'right' ? Math.round(x - t.width) : Math.round(x);
  hx.drawImage(t, dx, Math.round(y)); return t.width;
}


// ================================================================ sprite painter: material grid -> ramp shading (light top-left) -> 1px outline
const pad = (r, w) => (r + '.'.repeat(w)).slice(0, w);
function paint(grid, mats, opt = {}) {
  const H = grid.length, W = Math.max(...grid.map((r) => r.length)), g = grid.map((r) => pad(r, W));
  const [c, x] = mk(W, H), img = x.createImageData(W, H), d = img.data;
  const at = (X, Y) => (X < 0 || Y < 0 || X >= W || Y >= H ? '.' : g[Y][X]);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const m = g[Y][X]; if (m === '.') continue;
    const ramp = RAMP[mats[m]] || RAMP.conc; let t = 1;
    const up = at(X, Y - 1), lf = at(X - 1, Y), dn = at(X, Y + 1), rt = at(X + 1, Y);
    if (dn === '.' || rt === '.') t = 2;
    if (up === '.' || lf === '.') t = (dn === '.' || rt === '.') ? 1 : 0;
    if (up !== '.' && up !== m && !(opt.noFold || '').includes(m)) t = Math.max(t, 2); // fold shadow under an overlapping part
    if ((opt.flat || '').includes(m) || !opt.shade) t = 1; // v5: hens.farm flat fills (no SNES ramp shading) unless asked
    if ((opt.dark || '').includes(m)) t = Math.min(3, t + 1);
    const [r, gg, b] = hex(ramp[t]); const i = (Y * W + X) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  // outline: near-black, 4-neighbour
  const [or, og, ob] = hex(OUT), filled = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H && g[Y][X] !== '.';
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    if (g[Y][X] !== '.') continue;
    if (filled(X - 1, Y) || filled(X + 1, Y) || filled(X, Y - 1) || filled(X, Y + 1)) { const i = (Y * W + X) * 4; d[i] = or; d[i + 1] = og; d[i + 2] = ob; d[i + 3] = 255; }
  }
  x.putImageData(img, 0, 0); return c;
}
const flipRow = (r) => [...r].reverse().join('');
// ---- hens (16 wide x 22 tall: 18 body rows + 4 leg rows). Proportions taken from the hens.farm base-hen
// reference sheet (front / back / right-profile): round white body, big red comb, yellow beak, red wattle, orange legs.
const HEN_DOWN = [
  '................', '................', '.......RR.......', '......RRRR......', '.....RRRRRR.....', '.....WWWWWW.....',
  '....WWWWWWWW....', '....WkWWWWkW....', '....WWWYYWWW....', '....WWWRRWWW....', '..wWWAAAAAAWWw..', '.wWWWWAAAAWWWWw.',
  '.wWWWWWWWWWWWWw.', '.wwWWWWWWWWWWww.', '..wwWWWWWWWWww..', '..wwWWWWWWWWww..', '...wwWWWWWWww...', '.....wwwwww.....'];
const HEN_UP = [
  '................', '................', '.......RR.......', '......RRRR......', '.....RRRRRR.....', '.....WWWWWW.....',
  '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '.....WWWWWW.....', '..wWWAAAAAAWWw..', '.wWWWWWAAWWWWWw.',
  '.wWWwWWAAWWwWWw.', '.wwWWwWWWWwWWww.', '..wwWWwWWwWWww..', '..wwWWWWWWWWww..', '...wwWWWWWWww...', '.....wwwwww.....'];
const HEN_SIDE = [
  '................', '................', '..........RR....', '.........RRRR...', '.........RRRRR..', '........WWWWWW..',
  '........WWWWkW..', '..ww....WWWWWWY.', '.wWWw...WWWWWWY.', '.wWWWw..WWWWRR..', '.wWWWWwAAAAAW...', '..wWWWWWWWWWWW..',
  '..wWWWWwwwwWWWW.', '..wWWWWWwwwWWWW.', '...wWWWWWWWWWWW.', '....wWWWWWWWWW..', '.....wwWWWWWw...', '.......wwwww....'];
const HLEGS = {
  dStand: ['......O..O......', '......O..O......', '.....OO..OO.....', '....OOO..OOO....'],
  dWalk: ['......O..O......', '......O..O......', '.....OO..OO.....', '....OOO.........'],
  sStand: ['........O.......', '........O.......', '........OO......', '.......OOOO.....'],
  sStride: ['.......O..O.....', '......O....O....', '......OO...OO...', '.....OOO...OOOO.'],
  sPass: ['.........O......', '.........O......', '........OOO.....', '........OOOO....'],
};
// ---- PECK frame: the head (comb, eyes, beak, wattle) thrusts forward in the facing direction
const over = (a, b) => [...b].map((c, i) => (a[i] && a[i] !== '.' ? a[i] : c)).join('');
function peckDown(rows) { // toward the camera: head dips 3 rows over the chest, beak stretched
  const out = rows.map((r, y) => (y >= 2 && y <= 9 ? '.'.repeat(r.length) : r));
  for (let y = 9; y >= 2; y--) out[y + 3] = over(rows[y], out[y + 3]);
  out[12] = over('.......YY.......', out[12]); out[13] = over('.......RR.......', out[13]);
  return out;
}
function peckUp(rows) { // away from the camera: neck stretches up, head 3 rows higher
  const out = rows.map((r) => r);
  for (let y = 2; y <= 9; y++) out[y - 2] = over(rows[y], out[y - 2]);
  out[0] = over('.......RR.......', out[0]);
  return out;
}
function peckSide(rows) { // facing right: head lunges 2px forward and 2 rows down, beak spears out
  const W = rows[0].length, out = rows.map((r, y) => (y >= 2 && y <= 10 ? r.slice(0, 8) + '.'.repeat(W - 8) : r));
  for (let y = 10; y >= 2; y--) { const src = rows[y]; let line = out[y + 2].split(''); for (let x = 8; x < W; x++) { const c = src[x]; if (c !== '.' && x + 2 < W) line[x + 2] = c; } out[y + 2] = line.join(''); }
  out[9] = over('..............YY', out[9]); out[10] = over('...............Y', out[10]);
  out[6] = over('........WW......', out[6]); out[7] = over('........WWW.....', out[7]); out[8] = over('.........WW.....', out[8]); // neck
  return out;
}
const bob = (upper) => ['.'.repeat(upper[0].length), ...upper.slice(0, upper.length - 1)];
function henFrames(down, up, side, peck) {
  const dW2 = HLEGS.dWalk.map(flipRow);
  const D = [[...down, ...HLEGS.dStand], [...bob(down), ...HLEGS.dWalk], [...down, ...HLEGS.dStand], [...bob(down), ...dW2]];
  const U = [[...up, ...HLEGS.dStand], [...bob(up), ...HLEGS.dWalk], [...up, ...HLEGS.dStand], [...bob(up), ...dW2]];
  const R = [[...side, ...HLEGS.sStand], [...bob(side), ...HLEGS.sStride], [...side, ...HLEGS.sPass], [...bob(side), ...HLEGS.sStride]];
  if (peck) { D.push([...peckDown(down), ...HLEGS.dStand]); U.push([...peckUp(up), ...HLEGS.dStand]); R.push([...peckSide(side), ...HLEGS.sStand]); }
  const Lf = R.map((f) => f.map(flipRow));
  return [D, U, Lf, R]; // rows: down, up, left, right; column 4 (player only) = peck
}
// undead flock: glowing eyes, no bandana, droopy torn comb, goo stains, plucked gaps along the wing edge
function zombify(rows, seed) {
  const r = rng(seed);
  return rows.map((row, y) => {
    let s = row.replace(/k/g, 'e').replace(/A/g, 'W');
    if (y >= 2 && y <= 4) s = s.replace(/R/g, (m, i) => (r() < 0.3 ? '.' : m)); // torn comb
    s = [...s].map((c, x) => {
      if (c === 'W' && y > 10 && r() < 0.07) return 'g';                         // goo
      if (c === 'w' && y > 9 && r() < 0.18) return '.';                         // plucked
      return c;
    }).join('');
    return s;
  });
}
function widen(f) { // bulkier "roostr" variant: duplicate the centre columns and a torso row
  const w = f.map((r) => r.slice(0, 8) + r.slice(7, 9) + r.slice(8)); w.splice(12, 0, w[12]); return w;
}
const PLAYER_PAPER = { edge: '#c9c3b6', back: '#d8d2c4', rib: '#c2bcae', ink: [92, 88, 82] }; // v21: the player's cardboard back is shaded off-white, not brown
function atlas(frames, mats, opt, pc) {
  const cw = frames[0][0][0].length, ch = frames[0][0].length;
  const [c, x] = mk(cw * frames[0].length, ch * 4);
  frames.forEach((row, ri) => row.forEach((f, fi) => x.drawImage(paint(f, mats, opt), fi * cw, ri * ch)));
  return sheetAtlas(c, cw, ch, pc);
}
function sheetAtlas(c, cw, ch, pc = {}) { // pc (v21): paper colours {edge, back, rib, ink}; the player hen uses a shaded off-white back
  // silhouette version (outline recoloured bright, body faint) for the "never hidden" pass
  const [s, sx] = mk(c.width, c.height); sx.drawImage(c, 0, 0);
  const id = sx.getImageData(0, 0, c.width, c.height), d = id.data, [or, og, ob] = hex(OUT);
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; if (d[i] === or && d[i + 1] === og && d[i + 2] === ob) { d[i] = 255; d[i + 1] = 214; d[i + 2] = 60; } else { d[i] = 255; d[i + 1] = 250; d[i + 2] = 230; d[i + 3] = 80; } }
  sx.putImageData(id, 0, 0);
  // hard offset drop shadow (hens.farm card shadow): every opaque pixel -> ink
  const [h, hxx] = mk(c.width, c.height); hxx.drawImage(c, 0, 0); hxx.globalCompositeOperation = 'source-in'; hxx.fillStyle = OUT; hxx.fillRect(0, 0, c.width, c.height);
  // v9: hit flash (all white) and wind-up warning tint (all red)
  const [wh, whx] = mk(c.width, c.height); whx.drawImage(c, 0, 0); whx.globalCompositeOperation = 'source-in'; whx.fillStyle = '#ffffff'; whx.fillRect(0, 0, c.width, c.height);
  const [rd, rdx] = mk(c.width, c.height); rdx.drawImage(c, 0, 0); rdx.globalCompositeOperation = 'source-in'; rdx.fillStyle = '#ff2a3c'; rdx.fillRect(0, 0, c.width, c.height);
  // v20 Paper cutouts: cardboard edge (thickness layers) + the plain cardboard BACK, and a golden dusk rim light on the sun (west) side
  const [cb, cbx] = mk(c.width, c.height); cbx.drawImage(c, 0, 0); cbx.globalCompositeOperation = 'source-in'; cbx.fillStyle = pc.edge || '#8a6238'; cbx.fillRect(0, 0, c.width, c.height);
  const [bk, bkx] = mk(c.width, c.height); bkx.drawImage(c, 0, 0); bkx.globalCompositeOperation = 'source-in'; bkx.fillStyle = pc.back || '#5e4229'; bkx.fillRect(0, 0, c.width, c.height);
  bkx.globalCompositeOperation = 'source-atop'; bkx.fillStyle = pc.rib || '#4a321e'; for (let y = 1; y < c.height; y += 3) bkx.fillRect(0, y, c.width, 1); // corrugated cardboard ribs
  const bd = bkx.getImageData(0, 0, c.width, c.height), sd = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, rim = new ImageData(c.width, c.height), rd2 = rim.data, Wd = c.width;
  for (let p = 0; p < sd.length / 4; p++) { const i = p * 4; if (!sd[i + 3]) continue; const ink = sd[i] < 40 && sd[i + 1] < 40 && sd[i + 2] < 40;
    if (ink) { const k = pc.ink || [30, 20, 12]; bd.data[i] = k[0]; bd.data[i + 1] = k[1]; bd.data[i + 2] = k[2]; continue; }
    const X = p % Wd, l = X > 0 ? p - 1 : -1; if (l >= 0 && sd[l * 4] < 40 && sd[l * 4 + 1] < 40 && sd[l * 4 + 2] < 40 && sd[l * 4 + 3] && X % cw > 0) { rd2[i] = 255; rd2[i + 1] = 196; rd2[i + 2] = 96; rd2[i + 3] = 200; } }
  bkx.putImageData(bd, 0, 0); const [rm, rmx] = mk(c.width, c.height); rmx.putImageData(rim, 0, 0);
  return { img: c, sil: s, shd: h, wht: wh, red: rd, crd: cb, back: bk, rim: rm, cw, ch, nf: Math.round(c.width / cw) };
}
const zFrames = (seed) => henFrames(zombify(HEN_DOWN, seed), zombify(HEN_UP, seed + 1), zombify(HEN_SIDE, seed + 2));
const HEN_MATS = { R: 'comb', W: 'feather', w: 'fshade', k: 'ink', Y: 'beak', O: 'leg', A: 'bandana' };
const SPR = {
  player: atlas(henFrames(HEN_DOWN, HEN_UP, HEN_SIDE, true), HEN_MATS, { flat: 'RkYOAw', noFold: 'kYRA' }, PLAYER_PAPER),
  zombies: ['zf1', 'zf2', 'zf3'].map((f, i) => atlas(zFrames(11 + i * 7), { R: 'zcomb', W: f, w: f, e: 'eyeZ', Y: 'beak', O: 'leg', g: 'blood' }, { flat: 'eYOg', dark: 'w', noFold: 'eY' })),
  brute: atlas(zFrames(99).map((row) => row.map(widen)), { R: 'comb', W: 'rooster', w: 'rtail', e: 'eyeB', Y: 'beak', O: 'leg', g: 'blood' }, { flat: 'eYOg', noFold: 'eY' }),
};
// ---- items (16x16 cells): chikn pantry and farm arsenal
// v5: the real hens.farm characters, pixelated (hens-sprites.png, built from the hens.farm base-hen reference sheet).
// Player 30x33 cells x5 (stand, step, stand, step, PECK) per direction; undead flock 3 recolours 30x33 x4; zombie roostr 38x37 x4.
// The hand-pixeled 16x22 hens above stay as the fallback until the sheet loads.
// v20 (Zombie Farm): the undead flock in sickly green / grave grey / mud brown with red blood (wounds, beak drips).
// The player hen is untouched (bright white) so she pops. Roostr = wide silhouette + dark hide + red comb; egg-slinger = pale bone + lime rot.
const Z_PAL = [
  { ramp: ['#2c3a24', '#56703f', '#8fa86a'], mot: '#6d6a52' },  // sickly green
  { ramp: ['#34383a', '#666d6a', '#9ea59f'], mot: '#5a6b48' },  // grave grey (green mottling)
  { ramp: ['#3a2c20', '#6a523b', '#998060'], mot: '#58683f' },  // mud brown (green rot)
  { ramp: ['#2a221e', '#52443a', '#7d6d5e'], mot: '#3f4a33', comb: true }, // roostr: dark hide, red comb kept bright
  { ramp: ['#4a4a36', '#8a8866', '#c8c49c'], mot: '#9fcf3a', accent: true }, // egg-slinger: pale bone + lime rot
];
function zTint(c, P, cw, ch, seed) {
  const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width, H = c.height, R = P.ramp.map(hex), M = hex(P.mot);
  const hsh = (a, b, k) => { let h = (a * 374761393 + b * 668265263 + k * 2147483647 + seed * 1013904223) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const kind = new Uint8Array(W * H); // 0 none, 1 ink, 2 red, 3 beak/leg, 4 body
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (!d[i + 3]) continue;
    if (Math.max(r, g, b) < 56) kind[p] = 1; else if (r > 170 && g < 110 && b < 120) kind[p] = 2; else if (r > 185 && g > 95 && b < 95 && r - b > 110) kind[p] = 3; else kind[p] = 4; }
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const p = y * W + X, i = p * 4, k = kind[p]; if (!k || k === 1) continue;
    const cx = X % cw, cy = y % ch, row = Math.floor(y / ch);
    if (k === 2) { if (!P.comb) { d[i] = 176; d[i + 1] = 28; d[i + 2] = 40; } continue; } // combs/wattles go blood-dark (roostr keeps the bright accent)
    if (k === 3) { d[i] = d[i] * 0.72 + 40; d[i + 1] = d[i + 1] * 0.62 + 30; d[i + 2] = d[i + 2] * 0.6 + 24; // dirty yellow beak/legs
      if (y + 1 < H && kind[p + W] === 4 && hsh(cx, cy, row) < 0.45) { kind[p + W] = 5; } continue; } // beak drip below
    const r = d[i], g = d[i + 1], b = d[i + 2], L = (0.3 * r + 0.59 * g + 0.11 * b) / 255, q = L < 0.42 ? (L / 0.42) * 0.5 : 0.5 + Math.min(1, (L - 0.42) / 0.5) * 0.5;
    const A = q < 0.5 ? R[0] : R[1], B = q < 0.5 ? R[1] : R[2], u = q < 0.5 ? q * 2 : (q - 0.5) * 2;
    let o = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
    const n = hsh(cx >> 1, cy >> 1, 7); if (n < (P.accent ? 0.16 : 0.12)) o = o.map((v, j) => v * 0.45 + M[j] * 0.55); // rot / mould mottling (2x2 blobs)
    if (cy > ch * 0.3 && hsh(cx >> 1, cy, row + 3) < 0.03) o = [168, 24, 36]; // open wounds
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
  for (let p = 0; p < W * H; p++) if (kind[p] === 5) { const i = p * 4; d[i] = 200; d[i + 1] = 30; d[i + 2] = 44; if (p + W < W * H && kind[p + W] === 4 && (p % 3)) { const j = (p + W) * 4; d[j] = 150; d[j + 1] = 20; d[j + 2] = 32; } }
  x.putImageData(im, 0, 0); return c; }
const HENS_SHEET = new Image();
HENS_SHEET.onload = () => {
  const cut = (x, y, w, h) => { const [c, cx] = mk(w, h); cx.drawImage(HENS_SHEET, x, y, w, h, 0, 0, w, h); return c; };
  const ZF = HENS_SHEET.width >= 228 ? 6 : 4; // v9 sheet: 4 walk + STRIKE + WIND-UP frames for every enemy
  SPR.player = sheetAtlas(popCanvas(cut(0, 0, 150, 132)), 30, 33, PLAYER_PAPER);
  SPR.zombies = [0, 1, 2].map((i) => sheetAtlas(zTint(popCanvas(cut(0, 132 + i * 132, 30 * ZF, 132)), Z_PAL[i], 30, 33, 5 + i), 30, 33));
  SPR.brute = sheetAtlas(zTint(popCanvas(cut(0, 528, 38 * ZF, 148)), Z_PAL[3], 38, 37, 9), 38, 37);
  if (HENS_SHEET.height >= 808) SPR.thrower = sheetAtlas(zTint(popCanvas(cut(0, 676, 30 * ZF, 132)), Z_PAL[4], 30, 33, 13), 30, 33);
  SPR.real = true;
};
SPR.thrower = SPR.zombies[0];
HENS_SHEET.src = 'hens-sprites.png?v=20';
const ITEMS = ['shells', 'shotgun', 'mg', 'belt', 'ammobox']; // v15: two guns + their ammo only
const ITEM_ART = {
  shells: [['....yy....', '...yYYy...', '..yYYYYy..', '.yYYyYYYy.', 'yYYYYYyYYy', 'yyyyyyyyyy'], { Y: 'hazard', y: 'rust' }],                                                          // corn kernels
  shotgun: [['...YYYY.....', '..YyYyY.....', 'gggggggggwww', 'gggggggwwwww', '.......wwwww', '........ww..'], { g: 'car1', w: 'wood', Y: 'hazard', y: 'rust' }],                       // corn shotgun
  mg: [['.........m....', 'mmmmmmmmmmmmmm', '....rrrrrrrwww', '....rrrrrrwwww', '.....yy.r...ww', '.....yy.......'], { m: 'metal', r: 'roof', w: 'wood', y: 'hazard' }],                    // v9 machine gun
  belt: [['.y.y.y.y.y.', 'yYyYyYyYyYy', 'yYyYyYyYyYy', 'mmmmmmmmmmm', 'm.........m'], { y: 'hazard', Y: 'rust', m: 'wood' }],                                                     // v9 belt of rounds
  ammobox: [['.gggggggggg.', 'gGGGGGGGGGGg', 'gGyyyGGrrrGg', 'gGyyyGGrrrGg', 'gGGGGGGGGGGg', 'gggggggggggg'], { g: 'car1', G: 'leaf', y: 'hazard', r: 'car2' }],                  // v9 ammo crate
};
// v15: gun pickups tinted per tier (I natural, II green, III blue, IV purple, V+ gold)
const _tierImg = new Map();
function itemTierImg(kind_, tier) { const t = Math.min(5, tier || 1), key = kind_ + t; let c = _tierImg.get(key); if (c) return c; let x; [c, x] = mk(16, 16);
  x.drawImage(ITEM_IMG, ITEMS.indexOf(kind_) * 16, 0, 16, 16, 0, 0, 16, 16); const col = TIER_COL[t];
  if (col) { x.globalCompositeOperation = 'source-atop'; x.globalAlpha = t >= 5 ? 0.62 : 0.5; x.fillStyle = col; x.fillRect(0, 0, 16, 16); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  _tierImg.set(key, c); return c; }
const ITEM_IMG = (() => {
  const [c, x] = mk(16 * ITEMS.length, 16);
  ITEMS.forEach((k, i) => { const [g, m] = ITEM_ART[k]; const p = paint(['', ...g.map((r) => '.' + r)], m, { flat: 'gyCtBe' }); x.drawImage(p, i * 16 + Math.floor((16 - p.width) / 2), 16 - p.height - 1); });
  return popCanvas(c);
})();
// ---- v19 "everything is eggs": guns are BLACK (light outline so they read on dark ground), gun pickups are BLACK EGGS with a small
// coloured gun mark (MG = gold, SHOTGUN = red) + tier pips; ammo pickups are LIGHT eggs (nest of kernels-eggs, egg belt, egg carton).
const EGG_TIER = ['', '#f8f5e9', '#3fd46b', '#3aa0ff', '#b25cff', '#ffc42f']; // pips: I cream, II green, III blue, IV purple, V gold (= TIER_COL)
function pixArt(rows, pal, w = 16, h = 16, oy = null, outline = '#f8f5e9') { // rows of chars -> 16x16 canvas, centred, 1px light outline
  const [c, x] = mk(w, h), H = rows.length, W = Math.max(...rows.map((r) => r.length)), ox = Math.floor((w - W) / 2), y0 = oy === null ? h - H - 1 : oy;
  const on = (i, j) => j >= 0 && j < H && i >= 0 && i < rows[j].length && rows[j][i] !== '.';
  if (outline) { x.fillStyle = outline; for (let j = -1; j <= H; j++) for (let i = -1; i <= W; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) x.fillRect(ox + i, y0 + j, 1, 1); }
  for (let j = 0; j < H; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(ox + i, y0 + j, 1, 1); } }
  return c;
}
const GUN_ART = {
  mg: ['..........a....', '.kkkkkkkkkkkkkk', 'kkkgggggkkkkk..', 'kkkkkkkkkkk....', 'kk..kkkk.kk....', '....kaak..kk...', '....kkkk.......'],
  shotgun: ['.....kkkkkkkkkkk', 'kkkkkkkgggggkkkk', 'kkkkkkkkaaaa....', 'kkkk............', 'kkk.............'],
};
const _gunImg = new Map();
function gunImg(k, tier) { const t = Math.min(5, tier || 1), key = k + t; let c = _gunImg.get(key); if (c) return c; // black gun, accent = tier colour (I: gold MG / red shotgun)
  c = pixArt(GUN_ART[k] || GUN_ART.mg, { k: '#090b0a', g: '#3a3f3d', a: t > 1 ? EGG_TIER[t] : k === 'shotgun' ? '#ff3347' : '#ffc42f' }); _gunImg.set(key, c); return c; }
const EGG_SHAPE = ['....kkkk....', '...kkkkkk...', '..kkkkkkkk..', '.kkkkkkkkkk.', '.kkkkkkkkkk.', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '..kkkkkkkk..', '....kkkk....'];
const EGG_MARK = { mg: ['a.aaaaa', 'aaaa...', 'a..a...'], shotgun: ['..aaaaa', 'aaaa...', 'aa.....'] }; // tiny gun silhouettes on the shell
const _eggImg = new Map();
function eggImg(k, tier) { const t = Math.min(5, tier || 1), key = k + t; let c = _eggImg.get(key); if (c) return c;
  const rows = EGG_SHAPE.map((r) => r.split('')); rows[2][4] = rows[2][5] = 'g'; rows[3][3] = rows[4][2] = 'g'; // glossy highlight
  EGG_MARK[k].forEach((r, j) => r.split('').forEach((ch, i) => { if (ch === 'a') rows[6 + j][2 + i] = 'a'; }));
  if (k === 'mg') { rows[6][10] = rows[7][10] = rows[8][10] = 'a'; } else { rows[5][10] = 'a'; rows[7][10] = 'a'; rows[9][10] = 'a'; } // MG: a dotted rapid line; SHOTGUN: a spread
  for (let i = 0; i < t; i++) rows[11][2 + i * 2 - (t > 4 ? 1 : 0)] = 'p'; // tier pips
  c = pixArt(rows.map((r) => r.join('')), { k: '#090b0a', g: '#4a504c', a: k === 'shotgun' ? '#ff3347' : '#ffc42f', p: EGG_TIER[t] }); _eggImg.set(key, c); return c; }
const AMMO_ART = { // light, egg-themed, clearly not black
  shells: [['..cc..cc..cc..', '.cccccccccccc.', '.cwcc.cwcc.cwc', 'ssssssssssssss', '.SsSsSsSsSsSs.', '..SSSSSSSSSS..'], { c: '#fffdf5', w: '#ffffff', s: '#ffc42f', S: '#d89a14' }], // a straw nest of eggs (shotgun ammo)
  belt: [['.cc.cc.cc.cc.', 'ccccccccccccc', 'cwccwccwccwcc', 'ggggggggggggg', 'G...........G'], { c: '#fffdf5', w: '#ffffff', g: '#ffc42f', G: '#d89a14' }],                           // an egg belt (MG ammo)
  ammobox: [['.rrrrrrrrrrrr.', 'rcccrcccrcccrr', 'rcwcrcwcrcwcrr', 'rrrrrrrrrrrrrr', 'rRRRRRRRRRRRRr', 'rRRRRRRRRRRRRr', '.rrrrrrrrrrrr.'], { r: '#e9d6a8', R: '#d8c08a', c: '#fffdf5', w: '#ffffff' }], // an egg carton
};
const AMMO_IMG = {}; for (const k in AMMO_ART) AMMO_IMG[k] = pixArt(AMMO_ART[k][0], AMMO_ART[k][1], 16, 16, null, '#090b0a');
{ const x = ITEM_IMG.getContext('2d'); ITEMS.forEach((k, i) => { const im = AMMO_IMG[k] || (k === 'mg' || k === 'shotgun' ? eggImg(k, 1) : null); if (im) { x.clearRect(i * 16, 0, 16, 16); x.drawImage(im, i * 16, 0); } }); }

// ================================================================ world: 80x80 metatiles of 16x16, with height levels (3/4 view, pre-projected)
const TS = 16, MW = 80, MH = 80, WPX = MW * TS;
const K = { ASPH: 0, WALK: 1, GRASS: 2, PLAZA: 3, DIRT: 4, RUBTOP: 5, LEDGE: 6, TROOF: 7, BED: 8, BROOF: 10, BWALL: 11, TFACE: 12, RFACE: 13, CAR: 14, BARRIER: 15, PROP: 16, PARAPET: 17, LADDER: 18, CRATE: 19, CFACE: 20 };
const kind = new Uint8Array(MW * MH), lvl = new Int8Array(MW * MH);
const id = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? -1 : y * MW + x);
function setT(x, y, k, l) { const i = id(x, y); if (i < 0) return; kind[i] = k; lvl[i] = l; }
const isFace = (i) => i >= 0 && (kind[i] === K.TFACE || kind[i] === K.RFACE || kind[i] === K.LADDER || kind[i] === K.CFACE);
const WR = rng(2026);
const buildings = [], ruins = [], cars = [], props = [], ledges = [], crates = [];
// v5: no tower. Open farmyard survival; spawn in the middle of the yard. Crates (2x2: level-1 top + front face) are the only perches.
const SPAWN = { x: 40 * 16 + 8, y: 36 * 16 + 8 };
function genWorld() {
  kind.fill(K.ASPH); lvl.fill(0);
  for (let bx = 0; bx < 5; bx++) for (let by = 0; by < 5; by++) {
    const x0 = bx * 16 + 3, y0 = by * 16 + 3, x1 = bx * 16 + 15, y1 = by * 16 + 15;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) setT(x, y, (x === x0 || y === y0 || x === x1 || y === y1) ? K.WALK : K.DIRT, 0);
    if ((bx === 2 && (by === 1 || by === 2))) continue;
    lot(x0 + 1, y0 + 1, x1 - 1, y1 - 1, bx * 7 + by * 13);
    // corner lamps on the sidewalk
    if (WR() < 0.7) addProp('lamp', x0, y0); if (WR() < 0.5) addProp('lamp', x1, y1);
  }
  // open farmyard in the middle (spawn)
  for (let x = 32; x <= 49; x++) for (let y = 22; y <= 49; y++) setT(x, y, K.PLAZA, 0);
  // plaza dressing
  for (const [x, y] of [[32, 47], [49, 47], [32, 23], [49, 23]]) addProp('lamp', x, y);
  addProp('barrel', 47, 47); addProp('barrel', 33, 40);
  for (const [x, y] of [[44, 30], [35, 43], [46, 41]]) addCrate(x, y); // a few perches near the spawn
  // roads: wrecks
  for (let n = 0; n < 34; n++) {
    const horiz = WR() < 0.5;
    const x = horiz ? 4 + Math.floor(WR() * 70) : Math.floor(WR() * 5) * 16 + Math.floor(WR() * 2), y = horiz ? Math.floor(WR() * 5) * 16 + Math.floor(WR() * 2) : 4 + Math.floor(WR() * 70);
    addCar(x, y, horiz);
  }
  // crates scattered across the farm: limited safe spots
  for (let n = 0, tries = 0; n < 11 && tries < 900; tries++) { const x = 3 + Math.floor(WR() * 73), y = 3 + Math.floor(WR() * 73); if (Math.hypot(x - 40, y - 36) < 12) continue; if (crates.some((c) => Math.hypot(c.x - x, c.y - y) < 12)) continue; if (addCrate(x, y)) n++; }
  // border: junk barricade
  for (let i = 0; i < MW; i++) { setT(i, 0, K.BARRIER, -1); setT(i, MH - 1, K.BARRIER, -1); setT(0, i, K.BARRIER, -1); setT(MW - 1, i, K.BARRIER, -1); }
}
const CRATE_OK = (k) => k === K.ASPH || k === K.WALK || k === K.GRASS || k === K.PLAZA || k === K.DIRT;
function addCrate(x, y) { if (!areaIs(x - 1, y - 1, 4, 4, CRATE_OK)) return false; for (let dx = 0; dx < 2; dx++) { setT(x + dx, y, K.CRATE, 1); setT(x + dx, y + 1, K.CFACE, -1); } crates.push({ x, y, seed: Math.floor(WR() * 1e6) }); return true; }
function areaIs(x0, y0, w, h, ok) { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) { const i = id(x, y); if (i < 0 || !ok(kind[i], lvl[i], x, y)) return false; } return true; }
function addCar(x, y, horiz) {
  const w = horiz ? 3 : 2, h = horiz ? 2 : 3;
  if (!areaIs(x - 1, y - 1, w + 2, h + 2, (k) => k === K.ASPH || k === K.DIRT || k === K.WALK)) return false;
  if (!areaIs(x, y, w, h, (k) => k === K.ASPH || k === K.DIRT)) return false;
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) setT(x + dx, y + dy, K.CAR, -1);
  cars.push({ x, y, w, h, horiz, c: ['car1', 'car2', 'car3'][Math.floor(WR() * 3)], seed: Math.floor(WR() * 1e6) }); return true;
}
function addProp(type, tx, ty) { const i = id(tx, ty); if (i < 0 || lvl[i] !== 0) return; setT(tx, ty, K.PROP, -1); props.push({ type, tx, ty, seed: Math.floor(WR() * 1e6), lit: WR() < 0.7, flick: WR() < 0.4 }); }
function plateau(x0, y0, w, h, store = true) { // top rows level 1, last row is a jumpable face
  for (let x = x0; x < x0 + w; x++) { for (let y = y0; y < y0 + h - 1; y++) setT(x, y, K.RUBTOP, 1); setT(x, y0 + h - 1, K.RFACE, -1); }
  if (store) ruins.push({ x0, y0, w, h });
}
function building(x0, y0, w, h) {
  const wallRows = Math.min(h - 3, 2 + Math.floor(WR() * 3));
  for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) setT(x, y, y >= y0 + h - wallRows ? K.BWALL : K.BROOF, -1);
  buildings.push({ x0, y0, w, h, wallRows, mat: WR() < 0.55 ? 'brick' : 'conc', seed: Math.floor(WR() * 1e6) });
}
function lot(x0, y0, x1, y1, seed) {
  const W = x1 - x0 + 1, H = y1 - y0 + 1, t = WR();
  if (t < 0.16) { // empty lot: dead grass, rubble mounds, fire barrel, dead tree
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (WR() < 0.55) setT(x, y, K.GRASS, 0);
    for (let n = 0; n < 2; n++) { const w = 2 + Math.floor(WR() * 2), h = 2 + Math.floor(WR() * 2), x = x0 + 1 + Math.floor(WR() * (W - w - 2)), y = y0 + 1 + Math.floor(WR() * (H - h - 2)); if (areaIs(x - 1, y - 1, w + 2, h + 2, (k) => k === K.DIRT || k === K.GRASS)) plateau(x, y, w, h); }
    for (let n = 0; n < 2; n++) { const x = x0 + 1 + Math.floor(WR() * (W - 2)), y = y0 + 1 + Math.floor(WR() * (H - 2)); if (areaIs(x - 1, y - 1, 3, 3, (k) => k === K.DIRT || k === K.GRASS)) addProp(n ? 'tree' : 'barrel', x, y); }
  } else if (t < 0.32) { // collapsed low building: a walkable rubble plateau (level 1)
    const w = 6 + Math.floor(WR() * (W - 6)), h = 5 + Math.floor(WR() * (H - 6));
    const x = x0 + Math.floor(WR() * (W - w + 1)), y = y0 + Math.floor(WR() * (H - h));
    plateau(x, y, w, h);
    if (WR() < 0.5) addProp('tree', x0 + (x === x0 ? W - 1 : 0), y1);
  } else if (t < 0.66) {
    const w = 8 + Math.floor(WR() * (W - 7)), h = 8 + Math.floor(WR() * (H - 8));
    building(x0 + Math.floor((W - w) / 2), y0, w, h);
  } else if (t < 0.9) { // two buildings side by side
    const gap = 1, wa = Math.floor((W - gap) / 2);
    building(x0, y0, wa, 7 + Math.floor(WR() * (H - 7)));
    building(x0 + wa + gap, y0, W - wa - gap, 7 + Math.floor(WR() * (H - 7)));
  } else { // parking lot of wrecks
    for (let n = 0; n < 4; n++) addCar(x0 + 1 + Math.floor(WR() * (W - 4)), y0 + 1 + Math.floor(WR() * (H - 4)), WR() < 0.5);
    addProp('barrel', x0 + Math.floor(W / 2), y0 + Math.floor(H / 2));
  }
}

// ================================================================ static layer (BG): pre-rendered once
function outline(c) { // 1px near-black outline around every opaque pixel (4-neighbour)
  const x = c.getContext('2d'), W = c.width, H = c.height, im = x.getImageData(0, 0, W, H), d = im.data, src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const [r, g, b] = hex(OUT);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { const i = y * W + X; if (src[i]) continue; if ((X > 0 && src[i - 1]) || (X < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; } }
  x.putImageData(im, 0, 0); return c;
}
let M = null; // map context
const R_ = (x, y, w, h, c) => { M.fillStyle = c; M.fillRect(x, y, w, h); };
function spk(x0, y0, w, h, n, cols, r) { n = Math.round(n * 0.3); for (let i = 0; i < n; i++) R_(x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), 1, 1, cols[Math.floor(r() * cols.length)]); }
function drawTile(tx, ty) {
  const i = id(tx, ty), k = kind[i], X = tx * TS, Y = ty * TS, r = rng(i * 7919 + 13);
  const ground = (ramp, n = 10) => { R_(X, Y, TS, TS, ramp[1]); spk(X, Y, TS, TS, n, [ramp[0], ramp[2]], r); };
  const straw = (H, n) => { for (let s = 0; s < n; s++) { const sx = X + Math.floor(r() * 14), sy = Y + Math.floor(r() * 15), c = r() < 0.5 ? H[0] : H[2]; R_(sx, sy, 2, 1, c); R_(sx + 2, sy - (r() < 0.5 ? 1 : 0), 1, 1, c); } };
  switch (k) {
    case K.ASPH: case K.CAR: case K.PROP: { // farm track: packed earth with tractor ruts and pebbles
      const A = RAMP.asphalt; ground(A, 8);
      const cx = tx % 16, cy = ty % 16, vert = cx < 3, horiz = cy < 3;
      if (vert && !horiz) { if (cx === 0) { R_(X + 10, Y, 2, TS, A[2]); R_(X + 10, Y, 1, TS, A[3]); } if (cx === 2) { R_(X + 4, Y, 2, TS, A[2]); R_(X + 4, Y, 1, TS, A[3]); } }
      if (horiz && !vert) { if (cy === 0) { R_(X, Y + 10, TS, 2, A[2]); R_(X, Y + 10, TS, 1, A[3]); } if (cy === 2) { R_(X, Y + 4, TS, 2, A[2]); R_(X, Y + 4, TS, 1, A[3]); } }
      if (r() < 0.25) { const px0 = X + Math.floor(r() * 13), py0 = Y + Math.floor(r() * 13); R_(px0, py0, 3, 2, RAMP.conc[2]); R_(px0, py0, 2, 1, RAMP.conc[0]); R_(px0, py0 + 2, 3, 1, A[3]); } // pebble
      if (r() < 0.05) { R_(X + 3, Y + 6, 10, 5, RAMP.dirt[2]); R_(X + 2, Y + 7, 12, 3, RAMP.dirt[2]); R_(X + 4, Y + 7, 5, 1, RAMP.dirt[1]); } // mud puddle
      if (r() < 0.05) { const gx = X + 3 + Math.floor(r() * 9), gy = Y + 4 + Math.floor(r() * 8); R_(gx, gy, 1, 3, RAMP.grass[1]); R_(gx + 2, gy - 1, 1, 4, RAMP.grass[2]); R_(gx + 4, gy, 1, 3, RAMP.grass[1]); } // weed tuft
      break; }
    case K.WALK: { const H = RAMP.hay; ground(H, 4); straw(H, 9); if (r() < 0.08) { R_(X + 6, Y + 6, 3, 3, '#ffffff'); R_(X + 7, Y + 7, 1, 1, RAMP.hazard[1]); } break; } // straw verge, daisies
    case K.PLAZA: { // cream farmyard: scratched earth, feathers and chikn footprints
      const P = RAMP.plaza; ground(P, 8);
      if (r() < 0.35) { const fx = X + 3 + Math.floor(r() * 8), fy = Y + 3 + Math.floor(r() * 8), c = P[3]; R_(fx + 2, fy, 1, 3, c); R_(fx, fy, 1, 1, c); R_(fx + 1, fy + 1, 1, 1, c); R_(fx + 4, fy, 1, 1, c); R_(fx + 3, fy + 1, 1, 1, c); } // footprint
      if (r() < 0.12) { const fx = X + 2 + Math.floor(r() * 10), fy = Y + 2 + Math.floor(r() * 10); R_(fx, fy, 4, 1, '#ffffff'); R_(fx + 1, fy + 1, 3, 1, P[2]); } // feather
      if (r() < 0.06) { R_(X + 5, Y + 6, 5, 3, RAMP.hay[1]); R_(X + 6, Y + 6, 3, 1, RAMP.hay[0]); } // spilled corn
      break; }
    case K.GRASS: { const G = RAMP.grass; ground(G, 6); for (let n = 0; n < 4; n++) { const gx = X + 1 + Math.floor(r() * 13), gy = Y + 2 + Math.floor(r() * 12); R_(gx, gy, 1, 2, G[0]); R_(gx + 2, gy, 1, 2, G[0]); R_(gx + 1, gy + 1, 1, 2, G[3]); }
      if (r() < 0.12) { const fx = X + 3 + Math.floor(r() * 9), fy = Y + 3 + Math.floor(r() * 9), c = r() < 0.5 ? '#ffffff' : RAMP.hazard[1]; R_(fx, fy, 3, 3, c); R_(fx + 1, fy + 1, 1, 1, r() < 0.5 ? RAMP.hazard[2] : RAMP.brick[1]); } break; }
    case K.DIRT: { // tilled field rows with sprouts
      const D = RAMP.dirt; R_(X, Y, TS, TS, D[1]);
      for (let yy = 0; yy < TS; yy += 4) { R_(X, Y + yy, TS, 1, D[0]); R_(X, Y + yy + 3, TS, 1, D[2]); }
      spk(X, Y, TS, TS, 6, [D[0], D[2]], r);
      if ((tx + ty * 3) % 5 === 0 || r() < 0.2) for (let s = 0; s < 3; s++) { const gx = X + 2 + s * 5, gy = Y + 1 + 4 * Math.floor(r() * 4); R_(gx, gy, 1, 2, RAMP.grass[2]); R_(gx - 1, gy, 1, 1, RAMP.grass[1]); R_(gx + 1, gy, 1, 1, RAMP.grass[1]); }
      break; }
    case K.RUBTOP: case K.RFACE: case K.BED: { const H = RAMP.hay; ground(H, 5); straw(H, 12); break; } // hay mound top
    case K.TROOF: { // coop loft floor: planks under straw
      const T = RAMP.tower; R_(X, Y, TS, TS, T[1]);
      for (let yy = 0; yy < TS; yy += 4) { R_(X, Y + yy, TS, 1, T[0]); R_(X, Y + yy + 3, TS, 1, T[2]); R_(X + ((ty * 4 + yy) * 5) % 16, Y + yy, 1, 4, T[3]); }
      if (r() < 0.6) straw(RAMP.hay, 5);
      break; }
    case K.BARRIER: { // farm fence on grass
      const G = RAMP.grass, W = RAMP.wood; R_(X, Y, TS, TS, G[1]); spk(X, Y, TS, TS, 6, [G[0], G[2]], r);
      R_(X, Y + 4, TS, 3, W[0]); R_(X, Y + 6, TS, 1, W[2]); R_(X, Y + 9, TS, 3, W[0]); R_(X, Y + 11, TS, 1, W[2]);
      for (const px0 of [2, 10]) { R_(X + px0 - 1, Y + 1, 5, 14, OUT); R_(X + px0, Y + 2, 3, 12, W[1]); R_(X + px0, Y + 2, 1, 12, W[0]); }
      R_(X, Y + 3, TS, 1, OUT); R_(X, Y + 13, TS, 1, 'rgba(9,11,10,.35)');
      break; }
    default: R_(X, Y, TS, TS, RAMP.asphalt[1]);
  }
}
function drawBuilding(b) { // barns (red) and farmhouses (whitewash): slate roof with a ridge, plank walls, white trim
  const r = rng(b.seed), X = b.x0 * TS, Y = b.y0 * TS, W = b.w * TS, RH = (b.h - b.wallRows) * TS, WH = b.wallRows * TS, Rf = b.mat === 'brick' ? RAMP.roof : RAMP.brick;
  // roof: shingle rows, ridge line across the middle, lit top-left
  R_(X, Y, W, RH, Rf[1]);
  for (let yy = 4; yy < RH; yy += 5) { R_(X, Y + yy, W, 1, Rf[2]); for (let xx = ((yy / 5) % 2) * 4; xx < W; xx += 8) R_(X + xx, Y + yy - 4, 1, 4, Rf[2]); }
  const ry = Y + Math.floor(RH / 2) - 2; R_(X, ry, W, 3, Rf[0]); R_(X, ry + 3, W, 1, Rf[3]);
  R_(X, Y, W, 2, Rf[0]); R_(X, Y, 2, RH, Rf[0]); R_(X + W - 2, Y, 2, RH, Rf[3]); R_(X, Y + RH - 2, W, 2, Rf[3]);
  R_(X, Y, W, 1, OUT); R_(X, Y, 1, RH + WH, OUT); R_(X + W - 1, Y, 1, RH + WH, OUT);
  // roof furniture: hay bale, chimney, skylight, cupola
  const n = Math.floor(b.w * (b.h - b.wallRows) / 22) + 1;
  for (let i = 0; i < n; i++) {
    const t = r(), fx = X + 6 + Math.floor(r() * (W - 26)), fy = Y + 6 + Math.floor(r() * Math.max(1, RH - 26));
    if (t < 0.35) { box3(fx, fy, 14, 6, 7, RAMP.hay); R_(fx + 4, fy, 1, 13, RAMP.hay[3]); R_(fx + 9, fy, 1, 13, RAMP.hay[3]); }
    else if (t < 0.6) { box3(fx, fy, 8, 5, 10, RAMP.brick); R_(fx + 2, fy + 1, 4, 3, OUT); }
    else if (t < 0.8) { R_(fx - 1, fy - 1, 14, 10, OUT); R_(fx, fy, 12, 8, RAMP.glass[1]); R_(fx, fy, 12, 1, RAMP.glass[0]); R_(fx + 6, fy, 1, 8, '#ffffff'); R_(fx, fy + 4, 12, 1, '#ffffff'); }
    else { box3(fx, fy, 12, 6, 9, RAMP.conc); R_(fx + 3, fy + 8, 6, 5, OUT); R_(fx + 4, fy + 9, 4, 4, RAMP.glass[2]); }
  }
  // wall (south face)
  const barn = b.mat === 'brick', Wm = barn ? RAMP.brick : RAMP.conc, WY = Y + RH, trim = barn ? '#ffffff' : RAMP.wood[1];
  R_(X, WY, W, WH, Wm[1]);
  if (barn) for (let xx = 0; xx < W; xx += 4) { R_(X + xx, WY, 1, WH, Wm[2]); R_(X + xx + 1, WY, 1, WH, Wm[0]); }
  else for (let yy = 0; yy < WH; yy += 4) { R_(X, WY + yy + 3, W, 1, Wm[2]); R_(X, WY + yy, W, 1, Wm[0]); }
  R_(X, WY, W, 2, OUT); R_(X, WY + 2, W, 2, trim); R_(X + 1, WY, 2, WH, trim); R_(X + W - 3, WY, 2, WH, trim); // white trim under the eave and at corners
  R_(X, WY + 4, W, 1, Wm[3]);
  for (let row = 0; row < b.wallRows; row++) for (let col = 0; col < b.w; col++) {
    const wx = X + col * TS, wy = WY + row * TS, groundRow = row === b.wallRows - 1;
    if (col === 0 || col === b.w - 1) continue;
    if (groundRow) {
      const t = r();
      if (t < 0.3 && col < b.w - 2) { // big barn door with the white X brace (2 tiles wide)
        R_(wx + 1, wy + 2, 30, 14, OUT); R_(wx + 2, wy + 3, 28, 13, Wm[2]); R_(wx + 2, wy + 3, 28, 2, trim); R_(wx + 2, wy + 3, 2, 13, trim); R_(wx + 28, wy + 3, 2, 13, trim); R_(wx + 15, wy + 3, 2, 13, trim);
        for (let s = 0; s < 11; s++) { R_(wx + 4 + s, wy + 5 + s, 2, 1, trim); R_(wx + 14 - s, wy + 5 + s, 2, 1, trim); R_(wx + 17 + s, wy + 5 + s, 2, 1, trim); R_(wx + 27 - s, wy + 5 + s, 2, 1, trim); }
        col++; }
      else if (t < 0.55) { R_(wx + 3, wy + 3, 10, 13, OUT); R_(wx + 4, wy + 4, 8, 12, RAMP.wood[1]); R_(wx + 4, wy + 9, 8, 1, RAMP.wood[3]); R_(wx + 4, wy + 4, 8, 1, RAMP.wood[0]); R_(wx + 10, wy + 11, 1, 1, RAMP.hazard[1]); } // stable door
      else if (t < 0.8) { R_(wx + 2, wy + 3, 12, 9, OUT); R_(wx + 3, wy + 4, 10, 7, RAMP.glass[1]); R_(wx + 3, wy + 4, 10, 1, RAMP.glass[0]); R_(wx + 8, wy + 4, 1, 7, trim); R_(wx + 2, wy + 12, 12, 3, RAMP.wood[1]); R_(wx + 3, wy + 11, 2, 1, RAMP.brick[1]); R_(wx + 7, wy + 11, 2, 1, '#ffffff'); R_(wx + 11, wy + 11, 2, 1, RAMP.hazard[1]); } // window + flower box
    } else {
      const t = r(); R_(wx + 3, wy + 3, 10, 10, OUT);
      if (t < 0.22) { R_(wx + 4, wy + 4, 8, 8, RAMP.lit[1]); R_(wx + 4, wy + 4, 8, 1, RAMP.lit[0]); R_(wx + 8, wy + 4, 1, 8, trim); R_(wx + 4, wy + 8, 8, 1, trim); b.lit = (b.lit || []).concat([[wx + 8, wy + 8]]); }
      else if (t < 0.45) { R_(wx + 4, wy + 4, 8, 8, RAMP.wood[1]); for (let s = 0; s < 3; s++) R_(wx + 4, wy + 5 + s * 3, 8, 1, RAMP.wood[3]); R_(wx + 4, wy + 4, 8, 1, RAMP.wood[0]); } // hay-loft shutter
      else { R_(wx + 4, wy + 4, 8, 8, RAMP.glass[1]); R_(wx + 4, wy + 4, 3, 1, RAMP.glass[0]); R_(wx + 8, wy + 4, 1, 8, trim); R_(wx + 4, wy + 8, 8, 1, trim); }
      R_(wx + 3, wy + 13, 10, 1, trim);
    }
  }
  R_(X, WY + WH - 1, W, 1, OUT);
}
function box3(x, y, w, top, front, ramp) { R_(x - 1, y - 1, w + 2, top + front + 2, OUT); R_(x, y, w, top, ramp[0]); R_(x, y + top, w, front, ramp[2]); R_(x, y + top, w, 1, ramp[3]); R_(x, y, 1, top, ramp[0]); R_(x + w - 1, y, 1, top + front, ramp[3]); R_(x + 1, y + 1, w - 2, top - 2, ramp[1]); }
function drawCrate(c) { // a stack of $FEED crates: plank lid (the perch) + slatted front face, ink outline, hard shadow
  const X = c.x * TS, Y = c.y * TS, W = 2 * TS, Wd = RAMP.wood, r = rng(c.seed);
  R_(X + W + 1, Y + 4, 5, 2 * TS - 2, DARK_SHADOW); R_(X + 2, Y + 2 * TS, W, 4, DARK_SHADOW);
  R_(X, Y, W, TS, Wd[0]); for (let yy = 3; yy < TS; yy += 4) R_(X, Y + yy, W, 1, Wd[1]); // lid planks
  R_(X + 1, Y + 1, W - 2, 1, '#fff3c8'); R_(X + 15, Y, 1, TS, Wd[2]);
  for (let s2 = 0; s2 < 5; s2++) R_(X + 2 + Math.floor(r() * 26), Y + 2 + Math.floor(r() * 12), 2, 1, RAMP.hay[0]); // straw on the lid
  const FY = Y + TS; R_(X, FY, W, TS, Wd[1]); for (let xx = 0; xx < W; xx += 5) R_(X + xx, FY, 1, TS, Wd[2]);
  R_(X, FY, W, 2, Wd[3]); R_(X, FY + TS - 3, W, 3, Wd[3]);
  for (let s2 = 0; s2 < 13; s2++) { R_(X + 2 + s2 * 2, FY + 2 + s2, 2, 1, Wd[0]); } // diagonal brace
  R_(X + 9, FY + 5, 14, 6, OUT); R_(X + 10, FY + 6, 12, 4, RAMP.hazard[1]); R_(X + 12, FY + 7, 8, 2, RAMP.brick[1]); // gold $FEED label
  R_(X - 1, Y - 1, W + 2, 1, OUT); R_(X - 1, Y - 1, 1, 2 * TS + 1, OUT); R_(X + W, Y - 1, 1, 2 * TS + 1, OUT); R_(X - 1, FY - 1, W + 2, 1, OUT); R_(X - 1, FY + TS - 1, W + 2, 1, OUT);
}
function drawParapet(tx, ty) { // white picket rail around the coop loft
  const X = tx * TS, Y = ty * TS, T = RAMP.tower; R_(X, Y, TS, TS, T[2]);
  R_(X, Y + 4, TS, 3, '#ffffff'); R_(X, Y + 10, TS, 3, '#ffffff'); R_(X, Y + 7, TS, 1, '#c2c8ce'); R_(X, Y + 13, TS, 1, '#c2c8ce');
  for (const px0 of [1, 9]) { R_(X + px0, Y, 6, 15, OUT); R_(X + px0 + 1, Y + 1, 4, 13, '#ffffff'); R_(X + px0 + 4, Y + 1, 1, 13, '#d9dde1'); }
  R_(X, Y + 15, TS, 1, OUT);
}
function drawRuin(p) { // the front face of a hay-bale stack: gold bales with twine
  const H = RAMP.hay, r = rng(p.x0 * 31 + p.y0), X = p.x0 * TS, FY = (p.y0 + p.h - 1) * TS, W = p.w * TS;
  R_(X, FY, W, TS, H[1]);
  for (let xx = 0; xx < W; xx += 16) { R_(X + xx, FY, 1, TS, OUT); R_(X + xx + 1, FY, 1, TS, H[0]); R_(X + xx + 5, FY, 1, TS, RAMP.wood[2]); R_(X + xx + 11, FY, 1, TS, RAMP.wood[2]); }
  for (let s = 0; s < W / 3; s++) { const sx = X + Math.floor(r() * W), sy = FY + 1 + Math.floor(r() * 13); R_(sx, sy, 2, 1, r() < 0.5 ? H[2] : H[0]); }
  R_(X, FY, W, 1, H[0]); R_(X, FY + TS - 2, W, 2, H[3]); R_(X - 1, FY, 1, TS, OUT); R_(X + W, FY, 1, TS, OUT); R_(X, FY + TS - 1, W, 1, OUT);
  const TY = p.y0 * TS; R_(X - 1, TY - 1, W + 2, 1, OUT); R_(X - 1, TY, 1, FY - TY, OUT); R_(X + W, TY, 1, FY - TY, OUT);
  R_(X, TY, W, 1, H[0]); R_(X, TY, 1, FY - TY, H[0]);
  R_(X + W + 1, TY + 3, 5, (p.h) * TS - 3, DARK_SHADOW);
}
function carCanvas(car) { // abandoned tractors and hay wagons
  const r = rng(car.seed), Cr = RAMP[car.c], G = RAMP.glass, wagon = (car.seed % 10) < 3;
  const w = car.w * TS - 2, h = car.h * TS - 2, [c, x] = mk(w + 2, h + 2), P = (a, b, cw, ch, col) => { x.fillStyle = col; x.fillRect(a + 1, b + 1, cw, ch); };
  const wheel = (a, b, d) => { P(a, b, d, d, OUT); P(a + 1, b + 1, d - 2, d - 2, '#2a2e32'); for (let k = 2; k < d - 2; k += 3) P(a + 1, b + k, d - 2, 1, '#14171a'); P(a + d / 2 - 2, b + d / 2 - 2, 4, 4, RAMP.hazard[1]); };
  if (wagon) { const Wd = RAMP.wood, H = RAMP.hay;
    P(1, 3, w - 2, h - 9, Wd[1]); for (let k = 3; k < h - 6; k += 4) P(1, k, w - 2, 1, Wd[2]);
    P(4, 1, w - 8, h - 14, H[1]); for (let s = 0; s < 30; s++) P(4 + Math.floor(r() * (w - 10)), 1 + Math.floor(r() * (h - 15)), 2, 1, r() < 0.5 ? H[0] : H[2]);
    if (car.horiz) { wheel(4, h - 9, 9); wheel(w - 13, h - 9, 9); } else { wheel(0, h - 10, 8); wheel(w - 8, h - 10, 8); }
    return outline(c); }
  if (car.horiz) { // side-on: long hood, cab at the back, giant rear wheel
    const top = 14;
    P(2, 4, w - 18, top - 2, Cr[1]); P(2, 4, w - 18, 1, Cr[0]); P(2, 4, 1, top - 2, Cr[0]);                 // hood top
    P(8, 0, 3, 6, RAMP.metal[2]); P(8, 0, 1, 6, RAMP.metal[0]);                                              // exhaust
    P(w - 18, 0, 16, top + 4, '#ffffff'); P(w - 16, 2, 12, top - 2, G[1]); P(w - 16, 2, 12, 1, G[0]);        // cab
    P(0, top + 2, w - 14, h - top - 8, Cr[2]); P(0, top + 2, w - 14, 1, Cr[0]); P(2, top + 4, 6, 3, RAMP.conc[2]); // body side, grille
    wheel(w - 17, h - 15, 15); wheel(4, h - 9, 9);
  } else { // facing the camera: cab at the top, hood and grille at the bottom, wheels at the sides
    const face = 9;
    P(5, 0, w - 10, 14, '#ffffff'); P(7, 2, w - 14, 9, G[1]); P(7, 2, w - 14, 1, G[0]);
    P(7, 14, w - 14, h - face - 14, Cr[1]); P(7, 14, 1, h - face - 14, Cr[0]); P(w - 8, 14, 1, h - face - 14, Cr[2]);
    P(7, h - face, w - 14, face, Cr[2]); P(9, h - face + 2, w - 18, 4, RAMP.conc[2]); P(9, h - face + 2, 3, 3, RAMP.lit[1]); P(w - 12, h - face + 2, 3, 3, RAMP.lit[1]);
    wheel(0, 2, 7); P(0, 2, 6, 16, OUT); P(1, 3, 4, 14, '#2a2e32'); P(w - 6, 2, 6, 16, OUT); P(w - 5, 3, 4, 14, '#2a2e32');
    P(0, h - 12, 6, 10, OUT); P(w - 6, h - 12, 6, 10, OUT);
  }
  for (let n = 0; n < 3; n++) { const a = Math.floor(r() * (w - 6)), b = Math.floor(r() * (h - 6)); x.fillStyle = RAMP.dirt[r() < 0.5 ? 1 : 2]; x.fillRect(a + 1, b + 1, 2 + Math.floor(r() * 3), 2); } // mud
  return outline(c);
}
let MAPC = null;
function renderMap() {
  let x; [MAPC, x] = mk(WPX, WPX); M = x;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) drawTile(tx, ty);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (kind[id(tx, ty)] === K.PARAPET) drawParapet(tx, ty);
  for (const p of ruins) drawRuin(p);
  for (const b of buildings) { drawBuilding(b); R_((b.x0 + b.w) * TS + 1, b.y0 * TS + 4, 6, b.h * TS - 4, DARK_SHADOW); R_((b.x0 + b.w) * TS + 7, b.y0 * TS + 10, 26, b.h * TS - 8, 'rgba(46,22,70,0.16)'); R_((b.x0 + b.w) * TS + 33, b.y0 * TS + 16, 14, b.h * TS - 14, 'rgba(46,22,70,0.08)'); } // v20 long dusk shadows (sun low in the west)
  for (const c of crates) { M.fillStyle = 'rgba(46,22,70,0.16)'; M.fillRect((c.x + 2) * TS, c.y * TS + 6, 22, TS * 2 - 6); M.fillStyle = 'rgba(46,22,70,0.08)'; M.fillRect((c.x + 2) * TS + 22, c.y * TS + 9, 12, TS * 2 - 9); }
  for (const c of crates) drawCrate(c);
  for (const c of cars) { M.drawImage(carCanvas(c), c.x * TS, c.y * TS); R_((c.x + c.w) * TS, c.y * TS + 4, 3, c.h * TS - 6, DARK_SHADOW); }
  for (const p of props) if (p.type === 'barrel') { const X = p.tx * TS + 3, Y = p.ty * TS + 1; R_(X - 1, Y - 1, 12, 16, OUT); R_(X, Y, 10, 14, RAMP.metal[2]); R_(X, Y, 10, 3, RAMP.metal[3]); R_(X + 1, Y + 1, 8, 1, '#1a0c08'); R_(X, Y + 3, 2, 11, RAMP.metal[0]); R_(X + 8, Y + 3, 2, 11, RAMP.metal[3]); R_(X, Y + 5, 10, 1, RAMP.brick[1]); R_(X, Y + 10, 10, 1, RAMP.brick[1]); }
  // v9 shadows, one light direction (sun top-left -> shadows fall right/down): trees, lamps, antennas, barrels, fences
  const ell = (cx, cy, rx, ry, a) => { M.fillStyle = `rgba(9,11,10,${a})`; for (let y = -ry; y <= ry; y++) { const h = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); M.fillRect(Math.round(cx - h), Math.round(cy + y), h * 2, 1); } };
  for (const p of props) { const bx = p.tx * TS, by = p.ty * TS;
    if (p.type === 'tree') { ell(bx + 12, by + 14, 15, 5, 0.26); ell(bx + 18, by + 10, 10, 4, 0.16); ell(bx + 34, by + 13, 18, 4, 0.12); }
    else if (p.type === 'lamp' || p.type === 'antenna') { M.fillStyle = 'rgba(9,11,10,0.24)'; for (let k = 0; k < 16; k++) M.fillRect(bx + 4 + k, by + 14 + (k >> 2), 2, 1); ell(bx + 4, by + 15, 4, 1, 0.3); }
    else if (p.type === 'barrel' || p.type === 'campfire') ell(bx + 10, by + 15, 8, 2, 0.28); }
  for (let ty = 0; ty < MH - 1; ty++) for (let tx = 0; tx < MW; tx++) if (kind[id(tx, ty)] === K.BARRIER && kind[id(tx, ty + 1)] !== K.BARRIER) R_(tx * TS + 2, ty * TS + TS, TS, 2, 'rgba(9,11,10,0.26)');
  popCanvas(MAPC); duskGrade(MAPC);
  M = null;
}

// ================================================================ game state
const BEST_KEY = 'lasttower.best5'; // v5: best = longest survival time (seconds)
let best = { time: 0, kills: 0, days: 0 }; try { best = Object.assign(best, JSON.parse(localStorage.getItem(BEST_KEY)) || {}); } catch (e) {}
// ---- v5 tuning (all in one place) ----
const TUNE = {
  drain: 0,              // v10: NO drain. Life only drops when an attack hits you
  zDmg: 30, bDmg: 66, zCool: 0.9,       // v7: x3 damage. zombie / brute hit, seconds between swipes
  startZ: 22,                            // v9 swarm: 22 on the farm at spawn
  zWind: 0.45, zStrike: 0.16,            // v9 zombie hen: wind-up (crouch + shake) -> lunging peck; damage on the strike frame
  bWind: 0.62, bHop: 0.24, bStompR: [26, 18], // v9 roostr: crouch -> hop -> STOMP shockwave (dodge by moving)
  waveAfter: 35, waveEvery: 38, waveN: (st) => Math.min(40, 12 + Math.floor(st / 8)), // v9 swarm waves
  sense: [16, 20],                       // v9: chase radius in tiles (day, night)
  target: (st, night) => Math.min(190, Math.round((24 + st * 0.45) * (night ? 1.35 : 1))), // v9: big hordes // horde size vs seconds survived
  spawnEvery: (st, night) => Math.max(0.05, (0.34 - st / 900) * (night ? 0.6 : 1)),
  zSpeed: (st) => 24 + Math.min(14, st / 15),                                        // + up to 10 random
  bruteAfter: 45, bruteEvery: 18, bruteMax: (st) => 1 + Math.floor(st / 60),
  // v6 thrower: rare, keeps its distance and lobs rotten eggs (arc + ground telegraph); can hit you on a crate
  tAfter: 70, tEvery: 30, tMax: (st) => (st < 180 ? 1 : 2), tHp: 5, tKeep: [64, 120], tRange: 150, tWind: 0.7, tCool: 5.5, tDmg: 30, tFlight: (d) => 0.75 + d / 300, tHitR: [10, 9],
  loot0: 30, lootFloor: 26, lootEvery: 12, lootAdd: 5, dropZ: 0.42, dropB: 1, gunEvery: 30, // v9: much easier guns + ammo
  // v15: ammo comes faster every minute (m = whole minutes survived)
  zHpAt: (st) => 1 + 0.32 * (st / 60) + 0.04 * Math.pow(st / 60, 2), itemCap: 80,
  lootEveryAt: (m) => Math.max(3, 12 * Math.pow(0.8, m)), lootAddAt: (m) => 5 + Math.min(10, m), lootFloorAt: (m) => 26 + Math.min(24, 4 * m), dropZAt: (m) => Math.min(0.8, 0.42 + 0.06 * m),
};
const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const WEAPONS = {
  fists:   { name: 'PECK',    kind: 'melee', dmg: 1.4, reach: 16, arc: 1.2, cd: 0.3, stam: 6, icon: -1 },
  shotgun: { name: 'SHOTGUN I', kind: 'gun', dmg: 4, range: 120, cd: 0.7, ammo: 'shells', pellets: 8, spread: 0.7, kb: 2.4, icon: 8, pierce: 0, tier: 1 },
  mg:      { name: 'MG I', kind: 'gun', dmg: 1.6, range: 170, cd: 0.08, ammo: 'belt', pellets: 1, spread: 0, jitter: 0.07, kb: 0.6, icon: 10, pierce: 0, tier: 1 },
};
// v15: only two guns (+ PECK when dry). Each minute survived unlocks the next tier as pickups + drops.
const ORDER = ['fists', 'shotgun', 'mg'];
const AMMO_NAME = { shells: 'KERNELS', belt: 'ROUNDS' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const roman = (t) => ROMAN[t] || String(t);
const GUN_LABEL = { mg: 'MG', shotgun: 'SHOTGUN' };
function gunStats(k, t) { const u = t - 1; // tier t >= 1
  if (k === 'mg') return { name: 'MG ' + roman(t), tier: t, dmg: +(1.6 * (1 + 0.2 * u)).toFixed(2), cd: +Math.max(0.05, 0.08 * Math.pow(0.94, u)).toFixed(3), jitter: +(0.07 * Math.pow(0.78, u)).toFixed(3), pierce: Math.floor((u + 1) / 2), range: 170 + 10 * u, kb: 0.6 + 0.1 * u };
  return { name: 'SHOTGUN ' + roman(t), tier: t, pellets: Math.min(16, 8 + u), dmg: +(4 * (1 + 0.15 * u)).toFixed(2), kb: +(2.4 + 0.4 * u).toFixed(2), range: Math.min(200, 120 + 12 * u), spread: +(0.7 + 0.03 * u).toFixed(2), cd: +Math.max(0.5, 0.7 * Math.pow(0.97, u)).toFixed(3), pierce: Math.floor(u / 3) }; }
const TIER_COL = ['', null, '#3fd46b', '#3aa0ff', '#b25cff', '#ffc42f']; // I = natural, II green, III blue, IV purple, V+ gold
const tierCol = (t) => TIER_COL[Math.min(5, t)] || null;
const availTier = () => 1 + Math.floor(((G && G.st) || 0) / 60);
function setTier(k, t) { G.tier[k] = t; Object.assign(WEAPONS[k], gunStats(k, Math.max(1, t))); if (t > 0 && !G.owned.includes(k)) { G.owned.push(k); G.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); } }
// v7 auto-equip: rank by effective DPS x reach (recomputed live: tiers change the numbers)
function wScore(k) { const w = WEAPONS[k]; return w.kind === 'gun' ? w.dmg * w.pellets * (w.pellets > 1 ? 0.35 : 1) * (1 + 0.5 * (w.pierce || 0)) / w.cd * (1 + w.range / 100) : w.dmg / w.cd * (w.reach / 16) * Math.sqrt(w.arc / 1.2); }
function bestWeapon() { let b = 'fists'; for (const k of G.owned) { const w = WEAPONS[k]; if (w.kind === 'gun' && G.inv[w.ammo] <= 0) continue; if (wScore(k) > wScore(b)) b = k; } return b; }
function autoEquip() { const b = bestWeapon(); if (b !== G.weapon) { G.weapon = b; G.equip = { name: WEAPONS[b].name, t: 1.6 }; sfx('menu'); } }
const DAY_LEN = 180, NIGHT_LEN = 120, CYCLE = DAY_LEN + NIGHT_LEN;
let G = null;
const player = { x: 0, y: 0, level: 7, air: false, jz: 0, vz: 0, maxL: 7, sx: 0, sy: 0, fx: 0, fy: 1, dir: 0, anim: 0, atkT: 0, hurtT: 0, kb: [0, 0], moving: false };
const itemPool = [], zombiePool = [];
function newGame() { if (typeof flockNewRun === "function" && FLOCK.length) flockNewRun();
  G = {
    state: 'play', t: 20, day: 1, st: 0, kills: 0, msg: [], hp: 100, stam: 100, lootT: TUNE.lootEvery,
    inv: { shells: 0, belt: 0 }, owned: ['fists'], weapon: 'fists', tier: { mg: 0, shotgun: 0 }, tierSeen: 1,
    menuI: 0, shake: 0, flash: 0, deathCause: '', tracers: [], hits: [], cdT: 0, lightning: 0, swing: null, spawnT: 2, bruteT: 0, throwT: 0, proj: [], splats: [], eggHits: 0, foodLost: 0, parts: [], waves: [], muzzle: null, waveT: TUNE.waveAfter, shots: 0, swarmMax: 0,
  };
  Object.assign(player, { x: SPAWN.x, y: SPAWN.y, level: 0, air: false, climb: false, jz: 0, vz: 0, fx: 0, fy: 1, dir: 0, kb: [0, 0], atkT: 0 });
  zombiePool.length = 0; itemPool.length = 0; flowT = 0;
  scatterLoot(TUNE.loot0, true);
  for (let i = 0; i < TUNE.startZ; i++) spawnZombie(false);
  setTier('mg', 0); setTier('shotgun', 0); G.owned = ['fists']; // v15: tiers reset each run
  achRunStart(); if (!window.__ltNoLB) lbRunStart(); // v18 run stats + lifetime runs // v16 leaderboard play record
}
function say(s, t = 2.5) { if (!G || !G.msg) return; const last = G.msg[G.msg.length - 1]; if (last && last.s === s) { last.t = Math.max(last.t, t); return; } G.msg.push({ s, t }); if (G.msg.length > 3) G.msg.shift(); }
const isNight = () => false; // v18: always bright day (no night, no darkening; lamps are props only)
const onCrate = () => !player.air && !player.climb && kind[tileAt(player.x, player.y - 2)] === K.CRATE; // perched: only brutes can reach you
const onTower = onCrate;
const tileAt = (x, y) => id(Math.floor(x / TS), Math.floor(y / TS));

// ================================================================ movement with height levels (ALttP-style ledges)
// grounded: only tiles of your own level. airborne (A jump): pass over wall faces, land on <= start level + 1.
function tileOk(i, b) {
  if (i < 0) return false; const L = lvl[i];
  if (b.air) return isFace(i) || (L >= 0 && L <= b.maxL);
  return L === b.level;
}
function boxOk(x, y, b, hw = 4) { return tileOk(tileAt(x - hw, y - 4), b) && tileOk(tileAt(x + hw - 1, y - 4), b) && tileOk(tileAt(x - hw, y), b) && tileOk(tileAt(x + hw - 1, y), b); }
function moveBody(b, dx, dy, hw) {
  let hit = 0;
  if (dx) { if (boxOk(b.x + dx, b.y, b, hw)) b.x += dx; else hit |= 1; }
  if (dy) { if (boxOk(b.x, b.y + dy, b, hw)) b.y += dy; else hit |= 2; }
  return hit;
}
const JUMP_V = 110, GRAV = 420, HOP_V = 60;
function jump() {} // v10: jumping / flapping is gone. Just run and shoot (walking off a ledge still hops you down).
function hop() { Object.assign(player, { air: true, vz: HOP_V, jz: 0, maxL: player.level, sx: player.x, sy: player.y, hopT: 0.0 }); sfx('jump'); }
function tryAutoHop(mx, my) { // walking off a ledge edge hops you down, like ALttP cliffs
  const sx = Math.sign(Math.round(mx * 2)), sy = Math.sign(Math.round(my * 2)); if (!sx && !sy) return false;
  let tx = Math.floor((player.x + sx * 6) / TS), ty = Math.floor((player.y - 2 + sy * 6) / TS);
  for (let s = 0; s < 4; s++) {
    const i = id(tx, ty); if (i < 0) return false;
    if (isFace(i)) { tx += sx; ty += sy; continue; }
    if (lvl[i] >= 0 && lvl[i] < player.level) { hop(); return true; }
    return false;
  }
  return false;
}
function land() {
  let i = tileAt(player.x, player.y - 2), guard = 0;
  while (isFace(i) && guard++ < 40) { player.y += 4; i = tileAt(player.x, player.y - 2); } // missed: slide down the wall face
  const L = i >= 0 ? lvl[i] : -1;
  if (L < 0 || !boxOk(player.x, player.y, { air: false, level: L })) { // landed in something solid: back to the take-off point
    const fix = findLanding(player.x, player.y, L);
    if (fix) { player.x = fix[0]; player.y = fix[1]; } else { player.x = player.sx; player.y = player.sy; player.air = false; player.jz = 0; return; }
  }
  const L2 = lvl[tileAt(player.x, player.y - 2)], drop = player.level - L2;
  player.level = L2; player.air = false; player.jz = 0; player.vz = 0;
  if (kind[tileAt(player.x, player.y - 2)] === K.CRATE) { player.perchT = 0.45; sfx('land'); }
  if (drop > 0 || guard) sfx('land'); // v10: no fall damage. Only enemy attacks hurt
}
function findLanding(x, y) { // nudge a few px to the nearest spot the feet fit
  for (let r = 2; r <= 10; r += 2) for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) {
    const i = tileAt(x + dx, y + dy - 2); if (i < 0 || lvl[i] < 0) continue;
    if (lvl[i] <= player.maxL && boxOk(x + dx, y + dy, { air: false, level: lvl[i] })) return [x + dx, y + dy];
  }
  return null;
}

// ================================================================ loot
function lootRoll() {
  const r = Math.random();
  // v9: ~half of all loot is guns + ammo
  // v10: no food. Its loot slots became ammo
  // v15: two ammo types + the two guns at the tier unlocked so far
  if (r < 0.38) return 'shells'; if (r < 0.74) return 'belt'; if (r < 0.88) return 'ammobox';
  const w = Math.random() < 0.5 ? 'shotgun' : 'mg'; return (G.tier[w] || 0) >= availTier() ? (w === 'shotgun' ? 'shells' : 'belt') : w;
}
const gunTierOf = (k) => (k === 'mg' || k === 'shotgun' ? availTier() : 0);
function upgradeWanted() { const t = availTier(); return ['shotgun', 'mg'].find((k) => (G.tier[k] || 0) < t); }
function killDrop(z) { // v9: kills feed the guns; every gunEvery kills a gun you don't have yet drops
  if (G.kills % TUNE.gunEvery === 0 || z.brute) { const g = upgradeWanted(); if (g) return g; if (z.brute) return 'ammobox'; }
  const r = Math.random(); return r < 0.45 ? 'shells' : r < 0.88 ? 'belt' : 'ammobox'; // v15: two ammo types
}
function randomTile(pred, tries = 200) { for (let t = 0; t < tries; t++) { const x = 2 + Math.floor(Math.random() * (MW - 4)), y = 2 + Math.floor(Math.random() * (MH - 4)); const i = id(x, y); if (pred(i, x, y)) return [x, y]; } return null; }
function aliveItems() { let n = 0; for (const it of itemPool) if (it.alive) n++; return n; }
function dropItem(kind_, x, y, level, tier) { if (itemPool.length > 120) { let j = 0; for (const it of itemPool) if (it.alive) itemPool[j++] = it; itemPool.length = j; } // v15: compact picked-up items
  itemPool.push({ alive: true, kind: kind_, x, y, level, ph: Math.random() * 6, tier: tier || gunTierOf(kind_) }); }
function scatterLoot(n, first) {
  for (let k = 0; k < n; k++) {
    const p = randomTile((i, x, y) => lvl[i] === 0 && kind[i] !== K.CRATE && kind[i] !== K.PLAZA && Math.hypot(x - player.x / TS, y - player.y / TS) > (first ? 9 : 6));
    if (p) { const i = id(p[0], p[1]); dropItem(lootRoll(), p[0] * TS + 8, p[1] * TS + 10, lvl[i]); }
  }
  if (first) for (const [k, d] of [['shotgun', 5], ['shells', 6], ['belt', 6], ['shells', 9], ['ammobox', 9], ['belt', 10], ['shells', 13], ['belt', 14], ['belt', 18], ['ammobox', 24], ['shells', 26], ['mg', 30]]) { // v9: a shotgun ~5 tiles from the spawn
    const p = randomTile((i, x, y) => lvl[i] === 0 && Math.abs(Math.hypot(x - 40, y - 36) - d) < 2, 600);
    if (p) dropItem(k, p[0] * TS + 8, p[1] * TS + 10, 0);
  }
}
function pickup(it) {
  const k = it.kind; it.alive = false; sfx('pick');
  if (k === 'mg' || k === 'shotgun') { // v15: a higher tier replaces yours and tops up its ammo; same/lower tier = ammo
    const t = it.tier || 1, top = k === 'mg' ? 60 + 30 * t : 8 + 4 * t, am = k === 'mg' ? 'belt' : 'shells';
    if (t > (G.tier[k] || 0)) { const first = !G.tier[k]; setTier(k, t); G.inv[am] += top; say('+' + top + ' ' + AMMO_NAME[am]); if (!first || t > 1) upgradePop(k, t); G.weapon = ''; autoEquip(); }
    else { G.inv[am] += Math.round(top / 2); say('+' + Math.round(top / 2) + ' ' + AMMO_NAME[am]); autoEquip(); }
    return; }
  if (k === 'shells') { const n = 6 + Math.floor(Math.random() * 4); G.inv.shells += n; say('+' + n + ' CORN KERNELS'); }
  else if (k === 'belt') { const n = 30 + Math.floor(Math.random() * 16); G.inv.belt += n; say('+' + n + ' ROUNDS'); }
  else if (k === 'ammobox') { G.inv.shells += 8; G.inv.belt += 40; say('AMMO CRATE! +8 KERNELS +40 ROUNDS'); }
}

// ================================================================ zombies: flow-field pathing on the ground level
const flow = new Int16Array(MW * MH); let flowT = 0, flowKey = -1;
function buildFlow() {
  flow.fill(-1);
  const ptx = Math.floor(player.x / TS), pty = Math.floor((player.y - 2) / TS), q = new Int32Array(MW * MH); let h = 0, t = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (player.level !== 0 && Math.abs(dx) + Math.abs(dy) === 0) continue;
    if (player.level === 0 && (dx || dy)) continue;
    const i = id(ptx + dx, pty + dy); if (i >= 0 && lvl[i] === 0 && flow[i] < 0) { flow[i] = player.level === 0 ? 0 : Math.abs(dx) + Math.abs(dy); q[t++] = i; }
  }
  while (h < t) { const i = q[h++], d = flow[i]; if (d > 44) continue; const x = i % MW, y = (i / MW) | 0; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = id(x + ax, y + ay); if (j >= 0 && lvl[j] === 0 && flow[j] < 0) { flow[j] = d + 1; q[t++] = j; } } }
}
function spawnZombie(brute, near, thrower) {
  const night = isNight(), ptx = player.x / TS, pty = player.y / TS;
  const p = randomTile((i, x, y) => { if (lvl[i] !== 0 || kind[i] === K.CAR) return false; const d = Math.hypot(x - ptx, y - pty); return near ? d > 6 && d < 16 : d > 11 && d < 24; }, 60);
  if (!p) return null;
  const hp0 = Math.round((brute ? 12 : thrower ? TUNE.tHp : 4) * TUNE.zHpAt((G && G.st) || 0) * 10) / 10; // v15: the flock toughens every minute (outpaces the guns eventually)
  const z = { alive: true, brute, thrower: !!thrower && !brute, tcool: 1.5, wind: 0, strikeT: 0, jz: 0, hop: null, x: p[0] * TS + 8, y: p[1] * TS + 12, level: 0, air: false, hp: hp0, max: hp0,
    speed: (brute ? 28 + Math.min(10, (G.st || 0) / 30) : TUNE.zSpeed(G.st || 0) + Math.random() * 10) * (night ? 1.25 : 1), anim: Math.random() * 4, dir: 0, fx: 0, fy: 1, atk: 0, cool: 0, hurt: 0, kb: [0, 0],
    state: 'wander', wx: 0, wy: 0, wt: 0, groan: 2 + Math.random() * 8, dead: 0, sprI: zombiePool.length % 3 };
  if (z.thrower) z.speed *= 0.75;
  zombiePool.push(z); return z;
}
function lob(z, d) { // a rotten egg in an arc at where the hen is standing now (dodge by moving)
  const tx = player.x + (Math.random() - 0.5) * 28, ty = player.y + (Math.random() - 0.5) * 20; // wobbly aim: ~2 in 3 hit a hen that never moves
  G.proj.push({ x0: z.x + Math.sign(player.x - z.x) * 4, y0: z.y, x1: tx, y1: ty, t: 0, T: TUNE.tFlight(d), peak: 22 + d * 0.15, z0: 20 }); sfx('throw');
}
function updateProj(dt) {
  if (!G.proj) return;
  for (const p of G.proj) { p.t += dt; if (p.t >= p.T && !p.done) { p.done = true; G.splats.push({ kind: 'egg', x: p.x1, y: p.y1, t: 0.9, T: 0.9 }); sfx('splat');
    if (G.state === 'play' && Math.abs(player.x - p.x1) < TUNE.tHitR[0] && Math.abs(player.y - p.y1) < TUNE.tHitR[1] && !(player.air && player.jz > 14)) { G.eggHits = (G.eggHits || 0) + 1; say('SPLAT! ROTTEN EGG', 1.4); hurtPlayer(TUNE.tDmg, null, 'A ROTTEN EGG'); } } }
  G.proj = G.proj.filter((p) => !p.done);
  for (const s of G.splats) s.t -= dt; G.splats = G.splats.filter((s) => s.t > 0);
}
const sepGrid = new Map();
function spawnWave(n) { // v9: a pack of n zombies appears ~12 tiles away on one side and charges
  const ptx = player.x / TS, pty = player.y / TS; let c = null;
  for (let k = 0; k < 24 && !c; k++) { const a = Math.random() * 6.283, r = 11 + Math.random() * 3, x = Math.round(ptx + Math.cos(a) * r), y = Math.round(pty + Math.sin(a) * r), i = id(x, y); if (i >= 0 && lvl[i] === 0 && kind[i] !== K.CAR) c = [x, y]; }
  if (!c) return 0; let made = 0;
  for (let k = 0; k < n * 3 && made < n && zombiePool.length < 230; k++) { const x = c[0] + Math.round((Math.random() - 0.5) * 6), y = c[1] + Math.round((Math.random() - 0.5) * 6), i = id(x, y); if (i < 0 || lvl[i] !== 0 || kind[i] === K.CAR) continue;
    const z = spawnZombie(false); if (!z) break; z.x = x * TS + 8; z.y = y * TS + 12; z.state = 'chase'; made++; }
  if (made) { say('A SWARM IS COMING!', 2); sfx('groan'); } G.wavesN = (G.wavesN || 0) + 1; return made;
}
function stomp(z, perched) { // v9 roostr landing: shockwave ring + damage in an ellipse
  const big = perched, rx = TUNE.bStompR[0] + (big ? 6 : 0), ry = TUNE.bStompR[1] + (big ? 8 : 0);
  G.waves.push({ x: z.x, y: z.y, t: 0, T: 0.34, rx, ry }); G.shake = Math.max(G.shake, 3.5); sfx('thud');
  if (G.state !== 'dead' && Math.abs(player.x - z.x) < rx && Math.abs(player.y - z.y) < ry && player.level - z.level <= 1 && !(player.air && player.jz > 8)) { hurtPlayer(TUNE.bDmg, z, 'A ZOMBIE ROOSTR'); if (perched && G.state !== 'dead') knockOff(z); }
}
const PART_MAX = 360;
function gibs(z, kx, ky) { // v9: feathers + goo burst on a kill
  const pal = z.brute ? ['#7d6d5e', '#52443a', '#d0202e'] : z.thrower ? ['#c8c49c', '#9fcf3a', '#d0202e'] : [['#8fa86a', '#56703f', '#c81e30'], ['#9ea59f', '#666d6a', '#c81e30'], ['#998060', '#6a523b', '#c81e30']][z.sprI || 0]; // v20 zombie hides + blood
  const n = z.brute ? 16 : 10;
  for (let k = 0; k < n; k++) { const feather = k < n * 0.65; G.parts.push({ x: z.x, y: z.y, z: 6 + Math.random() * 10, vx: (kx || 0) * 50 + (Math.random() - 0.5) * 80, vy: (ky || 0) * 40 + (Math.random() - 0.5) * 60, vz: 30 + Math.random() * 70, t: 0, T: 2 + Math.random() * 1.5, k: feather ? 'f' : 'g', c: feather ? pal[k % 2] : (k % 3 ? pal[2] : '#7a0e1a') }); }
  for (let k = 0; k < (z.brute ? 8 : 5); k++) G.parts.push({ x: z.x + (Math.random() - 0.5) * 8, y: z.y + (Math.random() - 0.5) * 4, z: 0, vx: (kx || 0) * 30 + (Math.random() - 0.5) * 50, vy: (ky || 0) * 20 + (Math.random() - 0.5) * 30, vz: 0, t: 0, T: 4 + Math.random() * 2, k: 'g', c: k % 2 ? '#c81e30' : '#8a1020' }); // red splats on the ground
  if (G.parts.length > PART_MAX) G.parts.splice(0, G.parts.length - PART_MAX);
}
function hurtZombie(z, dmg, kx, ky, kbk = 1) {
  z.hp -= dmg; z.hurt = 0.18; z.flash = 0.07; z.kb = [kx * (z.brute ? 40 : 110) * kbk, ky * (z.brute ? 40 : 110) * kbk]; z.state = 'chase'; if (!z.brute || (kbk >= 2 && !z.hop)) z.atk = 0; // a hit interrupts a hen's wind-up; roostrs only stagger from a shotgun blast
  G.hits.push({ x: z.x, y: z.y - 12, t: 0.25 }); if (G.parts) for (let k = 0; k < 2; k++) G.parts.push({ x: z.x, y: z.y, z: 8 + Math.random() * 6, vx: kx * 40 + (Math.random() - 0.5) * 40, vy: ky * 30 + (Math.random() - 0.5) * 30, vz: 20 + Math.random() * 40, t: 0, T: 2.5, k: 'g', c: k ? '#c81e30' : '#8a1020' }); // v20 blood drops
  if (z.hp <= 0) { z.alive = false; z.dead = 0.6; z.jz = 0; G.kills++; achKill(z); sfx('splat'); gibs(z, kx, ky); if ((G.kills % TUNE.gunEvery === 0 || z.brute || aliveItems() < TUNE.itemCap) && (G.kills % TUNE.gunEvery === 0 || Math.random() < (z.brute ? TUNE.dropB : z.thrower ? 0.7 : TUNE.dropZAt(Math.floor(G.st / 60))))) dropItem(killDrop(z), z.x, z.y, 0); }
  else sfx('thud');
}
function updateZombies(dt) {
  const night = isNight(), sense = TUNE.sense[night ? 1 : 0] * TS * ((G.st || 0) < 12 ? 0.55 : 1), perched = onCrate(); // v9: a 12 s opening where the flock is slower to notice you
  flowT -= dt; const key = Math.floor(player.x / TS) + Math.floor(player.y / TS) * MW + player.level * 9999;
  if (flowT <= 0 || key !== flowKey) { buildFlow(); flowT = 0.4; flowKey = key; }
  let alive = 0, brutes = 0, throwers = 0;
  for (const z of zombiePool) {
    if (!z.alive) { z.dead -= dt; continue; }
    alive++; if (z.brute) brutes++; if (z.thrower) throwers++;
    const dx = player.x - z.x, dy = player.y - z.y, d = Math.hypot(dx, dy);
    if (d > 40 * TS) { z.alive = false; z.dead = 0; continue; }
    const ti = tileAt(z.x, z.y - 2), fd = flow[ti];
    if (d < sense && fd >= 0 && fd < 30 && G.state !== 'dead') z.state = 'chase'; else if (z.state === 'chase' && (d > sense * 1.8 || fd < 0)) z.state = 'wander';
    let tx, ty, sp;
    if (z.state === 'chase') {
      sp = z.speed;
      if (fd === 0 || fd < 0) { tx = player.x; ty = player.y; }
      else { const zx = ti % MW, zy = (ti / MW) | 0; let bestD = fd, bx = zx, by = zy;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const j = id(zx + ax, zy + ay); if (j < 0 || flow[j] < 0) continue; if (ax && ay && (lvl[id(zx + ax, zy)] !== 0 || lvl[id(zx, zy + ay)] !== 0)) continue; if (flow[j] < bestD) { bestD = flow[j]; bx = zx + ax; by = zy + ay; } }
        tx = bx * TS + 8; ty = by * TS + 10; }
    } else {
      z.wt -= dt; if (z.wt <= 0 || Math.hypot(z.wx - z.x, z.wy - z.y) < 6) { z.wt = 3 + Math.random() * 5; const a = Math.random() * 6.28; z.wx = z.x + Math.cos(a) * 70; z.wy = z.y + Math.sin(a) * 70; if (night) { z.wx = lerp(z.wx, player.x, 0.3); z.wy = lerp(z.wy, player.y, 0.3); } }
      tx = z.wx; ty = z.wy; sp = z.speed * 0.4;
    }
    let vx = tx - z.x, vy = ty - z.y; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    if (z.thrower && z.state === 'chase' && G.state === 'play') { // keep the distance, face the hen, wind up and lob
      if (d < TUNE.tKeep[0]) { vx = -dx / (d || 1); vy = -dy / (d || 1); sp = z.speed; } else if (d <= TUNE.tKeep[1]) sp = 0;
      z.tcool -= dt;
      if (z.wind > 0) { sp = 0; z.fx = dx; z.fy = dy; z.wind -= dt; if (z.wind <= 0) { lob(z, d); z.strikeT = 0.22; } }
      else if (z.tcool <= 0 && d < TUNE.tRange && d > 36) { z.wind = TUNE.tWind; z.tcool = TUNE.tCool; sfx('windup'); }
      if (sp <= 1) { z.fx = dx; z.fy = dy; }
    }
    const big = perched && z.brute, reach = !z.thrower && Math.abs(dx) < (big ? 30 : 13) && Math.abs(dy) < (big ? 24 : 10) && player.level - z.level <= 1 && !(player.air && player.jz > 9); // roostrs reach up onto crates
    if (reach || z.atk > 0 || z.hop) sp = 0;
    if (z.hurt > 0) { z.hurt -= dt; sp *= 0.2; }
    const hit = moveBody(z, (vx * sp + z.kb[0]) * dt, (vy * sp + z.kb[1]) * dt, 4);
    if (hit && z.state === 'wander') z.wt = 0;
    z.kb[0] *= Math.pow(0.001, dt); z.kb[1] *= Math.pow(0.001, dt);
    if (sp > 1) { z.anim += dt * 6 * (sp / 24); z.fx = vx; z.fy = vy; }
    if (z.strikeT > 0) z.strikeT -= dt; if (z.flash > 0) z.flash -= dt;
    if (z.brute) { // v9 ROOSTR STOMP: crouch (wind-up) -> hop at where you stood -> land = shockwave; damage only on landing
      if (z.hop) { z.hop.t += dt; const u = Math.min(1, z.hop.t / TUNE.bHop), rem = Math.max(dt, TUNE.bHop - z.hop.t + dt); moveBody(z, (z.hop.x - z.x) * Math.min(1, dt / rem), (z.hop.y - z.y) * Math.min(1, dt / rem), 4); z.jz = Math.sin(u * Math.PI) * 12;
        if (u >= 1) { z.hop = null; z.jz = 0; z.strikeT = 0.18; z.cool = TUNE.zCool + 0.5; stomp(z, perched); } }
      else if (z.atk > 0) { z.atk -= dt; z.fx = dx; z.fy = dy; if (z.atk <= 0) { const l = d || 1, m = Math.min(16, d); z.hop = { t: 0, x: z.x + dx / l * m, y: z.y + dy / l * m }; sfx('swing'); } }
      else { z.cool -= dt; if (reach && z.cool <= 0 && G.state !== 'dead') { z.atk = TUNE.bWind; z.fx = dx; z.fy = dy; sfx('windup'); } }
    } else if (!z.thrower) { // v9 ZOMBIE HEN: crouch + shake (wind-up) -> lunging peck; dodge by stepping away during the wind-up
      if (z.atk > 0) { z.atk -= dt; if (z.atk <= 0) { const l = d || 1; z.lx = dx / l; z.ly = dy / l; z.fx = dx; z.fy = dy; z.strikeT = TUNE.zStrike; z.cool = TUNE.zCool; moveBody(z, z.lx * 4, z.ly * 4, 4); if (d < 9 * TS) sfx('zpeck');
        if (Math.abs(player.x - z.x) < 15 && Math.abs(player.y - z.y) < 11 && player.level - z.level <= 1 && G.state !== 'dead' && !(player.air && player.jz > 9)) {
          if (perched) sfx('thud'); // claws at the crate: no damage
          else hurtPlayer(TUNE.zDmg, z, 'THE UNDEAD FLOCK'); } } }
      else { z.cool -= dt; if (reach && z.cool <= 0 && G.state !== 'dead') { z.atk = TUNE.zWind; z.fx = dx; z.fy = dy; } }
    }
    z.groan -= dt; if (z.groan <= 0) { z.groan = 4 + Math.random() * 9; if (d < 12 * TS) sfx('groan'); }
  }
  // v9 perf: separation via a 16px spatial hash (was O(n^2))
  sepGrid.clear(); for (let i = 0; i < zombiePool.length; i++) { const a = zombiePool[i]; if (!a.alive) continue; a.si = i; const k = ((a.x >> 4) & 1023) | (((a.y >> 4) & 1023) << 10); let bk = sepGrid.get(k); if (!bk) { bk = []; sepGrid.set(k, bk); } bk.push(a); }
  for (const a of zombiePool) { if (!a.alive) continue; const cx = a.x >> 4, cy = a.y >> 4;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const bk = sepGrid.get(((cx + ox) & 1023) | (((cy + oy) & 1023) << 10)); if (!bk) continue;
      for (const b of bk) { if (b.si <= a.si || !b.alive) continue; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 < 100 && d2 > 0.01) { const d = Math.sqrt(d2), p = (10 - d) / 2, ux = dx / d * p, uy = dy / d * p; moveBody(a, -ux, -uy, 4); moveBody(b, ux, uy, 4); } } } }
  for (let i = zombiePool.length - 1; i >= 0; i--) if (!zombiePool[i].alive && zombiePool[i].dead <= 0) zombiePool.splice(i, 1);
  const st = G.st || 0, target = TUNE.target(st, night); G.target = target;
  G.spawnT = (G.spawnT || 0) - dt;
  if (alive < target && G.spawnT <= 0 && G.state === 'play') { G.spawnT = TUNE.spawnEvery(st, night); spawnZombie(false); }
  G.bruteT = (G.bruteT === undefined ? 0 : G.bruteT) - dt; // zombie roostrs arrive on their own clock, even when the flock is full
  if (st >= TUNE.bruteAfter && brutes < TUNE.bruteMax(st) && G.bruteT <= 0 && G.state === 'play') { if (spawnZombie(true)) G.bruteT = TUNE.bruteEvery; }
  G.waveT = (G.waveT === undefined ? TUNE.waveAfter : G.waveT) - dt; // v9 swarm waves: a pack charges in from one side
  if (st >= TUNE.waveAfter && G.waveT <= 0 && G.state === 'play') { G.waveT = TUNE.waveEvery; spawnWave(TUNE.waveN(st)); }
  G.swarmMax = Math.max(G.swarmMax || 0, alive);
  G.throwT = (G.throwT || 0) - dt; // rare egg throwers, on their own clock
  if (st >= TUNE.tAfter && throwers < TUNE.tMax(st) && G.throwT <= 0 && G.state === 'play') { const z = spawnZombie(false, false, true); if (z) { G.throwT = TUNE.tEvery; z.state = 'chase'; } }
  updateProj(dt);
  _alive = alive;
}

// ================================================================ combat
function dirVec() { const l = Math.hypot(player.fx, player.fy) || 1; return [player.fx / l, player.fy / l]; }
function attack() {
  autoEquip(); const w = WEAPONS[G.weapon]; if (G.cdT > 0) return;
  const [fx, fy] = dirVec();
  if (w.kind === 'gun') {
    if (G.inv[w.ammo] <= 0) { sfx('click'); say('OUT OF ' + AMMO_NAME[w.ammo], 1.6); G.cdT = 0.3; return; }
    G.inv[w.ammo]--; G.cdT = w.cd; G.shots = (G.shots || 0) + 1; if (G.inv[w.ammo] <= 0) autoEquip(); player.atkT = 0.18; G.shake = Math.max(G.shake, w.pellets > 1 ? 4.5 : G.weapon === 'mg' ? 1.2 : 1.5); if (w.pellets > 1) G.flash = 0.06; sfx(w.pellets > 1 ? 'shotgun' : G.weapon === 'mg' ? 'mg' : 'pistol');
    G.muzzle = { t: w.pellets > 1 ? 0.07 : 0.045, a: Math.atan2(fy, fx), big: w.pellets > 1, k: G.weapon }; // v9 muzzle flash + an ejected casing / kernel husk
    G.parts.push({ x: player.x, y: player.y - 1, z: 10 + player.jz, vx: -fy * 50 + (Math.random() - 0.5) * 30, vy: fx * 40 + (Math.random() - 0.5) * 20, vz: 50 + Math.random() * 30, t: 0, T: 1.4, k: 'c', c: w.pellets > 1 ? '#ff3347' : '#ffc42f' }); if (G.parts.length > PART_MAX) G.parts.shift();
    if (w.pellets > 1) { player.kb = [-fx * 70, -fy * 70]; } // shotgun recoil
    let ax = fx, ay = fy, bestD = 1e9, anyHit = false;
    for (const z of zombiePool) { if (!z.alive) continue; const dx = z.x - player.x, dy = (z.y - 8) - (player.y - 8), d = Math.hypot(dx, dy); if (d > w.range) continue; const dot = (dx * fx + dy * fy) / (d || 1); if (dot > 0.86 && d < bestD) { bestD = d; ax = dx / d; ay = dy / d; } }
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.atan2(ay, ax) + (w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread + (Math.random() - 0.5) * 0.08 : (Math.random() - 0.5) * 2 * (w.jitter || 0)), dx = Math.cos(a), dy = Math.sin(a);
      let hitD = w.range, hitZ = null;
      for (let s = 8; s < hitD; s += 4) { const k = kind[tileAt(player.x + dx * s, player.y - 8 + dy * s)]; if (k === K.BROOF || k === K.BWALL || k === K.BARRIER) { hitD = s; break; } }
      const hz = []; for (const z of zombiePool) { if (!z.alive) continue; const rx = z.x - player.x, ry = (z.y - 8) - (player.y - 8), t = rx * dx + ry * dy; if (t < 0 || t > hitD) continue; if (Math.abs(rx * dy - ry * dx) < (z.brute ? 9 : 7)) hz.push([t, z]); }
      hz.sort((a, b) => a[0] - b[0]); const hits = hz.slice(0, 1 + (w.pierce || 0)); if (hits.length) hitD = hits[hits.length - 1][0]; // v15: pierce = extra zombies per bullet
      G.tracers.push({ k: G.weapon, tier: w.tier, T: w.pellets > 1 ? 0.15 : 0.12, x0: player.x + dx * 8, y0: player.y - 10 - player.jz + dy * 8, x1: player.x + dx * hitD, y1: player.y - 10 - player.jz + dy * hitD, t: 0.12 });
      for (const [, hzz] of hits) hurtZombie(hzz, w.dmg, dx, dy, w.kb || 1); if (hits.length) anyHit = true;
    }
    if (anyHit) G.shotHits = (G.shotHits || 0) + 1; // v18 accuracy
    for (const z of zombiePool) if (z.alive && Math.hypot(z.x - player.x, z.y - player.y) < 20 * TS) z.state = 'chase';
    return;
  }
  if (G.stam < w.stam * 0.5) { say('TOO TIRED', 1.2); G.cdT = 0.3; return; }
  G.stam = Math.max(0, G.stam - w.stam); G.cdT = w.cd; player.atkT = 0.2; player.peck = G.weapon === 'fists'; sfx(player.peck ? 'peck' : 'swing');
  G.swing = { t: 0.16, a: Math.atan2(fy, fx), reach: w.reach, w: G.weapon };
  for (const z of zombiePool) {
    if (!z.alive || Math.abs(z.level - player.level) > 1) continue; const dx = z.x - player.x, dy = z.y - player.y, d = Math.hypot(dx, dy);
    if (d > w.reach + 6) continue;
    let da = Math.atan2(dy, dx) - Math.atan2(fy, fx); while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < w.arc / 2 || d < 8) { hurtZombie(z, w.dmg, dx / (d || 1), dy / (d || 1)); if (player.peck) G.hits.push({ x: player.x + fx * 13, y: player.y - 10 + fy * 9, t: 0.14, peck: true }); }
  }
}
function hurtPlayer(dmg, from, cause) {
  if (!G || !['play', 'bag', 'camp'].includes(G.state)) return;
  // v8: every hit counts (no invulnerability window; several hits in one frame all land)
  G.hp -= dmg; achHurt(dmg, cause); player.hurtT = 0.3; G.shake = 3; sfx('hurt'); if (G.eat) cancelEat('HIT!');
  if (from && typeof from === 'object' && !player.air) { const dx = player.x - from.x, dy = player.y - from.y, d = Math.hypot(dx, dy) || 1; player.kb = [dx / d * 90, dy / d * 90]; }
  if (G.hp <= 0) die(cause);
}
function knockOff(z) { // a zombie roostr bowls you off the crate
  const dx = player.x - z.x, dy = player.y - z.y, d = Math.hypot(dx, dy) || 1;
  Object.assign(player, { air: true, vz: 90, jz: 0, maxL: player.level, sx: player.x, sy: player.y }); player.kb = [dx / d * 140, dy / d * 140 + 30];
  say('KNOCKED OFF THE CRATE!', 1.5);
}
function die(cause) {
  G.hp = 0; G.state = 'dead'; G.deadT = 0; G.deathCause = cause; G.eat = null; sfx('die');
  if (G.st > best.time) { best = { time: Math.floor(G.st), kills: G.kills, days: G.day }; try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) {} G.newBest = true; }
  achRunEnd(); if (!window.__ltNoLB) lbRunEnd(); // v16: end the server play, fetch the TOP 20
}
function cancelEat() {} // v10: eating is gone (no meals, no healing). Kept as a no-op for old call sites.
function updatePlayer(dt) { if (G.state === 'play') autoEquip();
  let mx = held.right - held.left, my = held.down - held.up;
  if (stick.on && Math.hypot(stick.x, stick.y) > 0.18) { mx = stick.x; my = stick.y; }
  let m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; m = 1; }
  if (G.state !== 'play') { mx = my = 0; m = 0; }
  player.moving = m > 0.1;
  if (player.moving) { player.fx = mx / m; player.fy = my / m; player.anim += dt * 8 * m; player.dir = Math.abs(mx) > Math.abs(my) * 1.05 ? (mx < 0 ? 2 : 3) : (my > 0 ? 0 : 1); }
  // v10: SHOOT pad held = aim that way (twin-stick: facing follows the aim, not the walk) and fire on cooldown (guns auto, melee repeats)
  // v11: two buttons at once (N+E, E+S, S+W, W+N; or a thumb between them; or two arrow keys) = that diagonal.
  //      A 110 ms (wall-clock) chord window (a tap shorter than that fires on release) on the first press lets the second finger land before the first shot goes out.
  // v14: the round analog SHOOT stick (aimStick) overrides the keys: its knob angle is the exact 360-degree aim, past a small deadzone it auto-fires.
  { const sm = aimStick.on ? Math.hypot(aimStick.x, aimStick.y) : 0, an = sm > AIM_DEAD, n = held.SU + held.SD + held.SL + held.SR;
    let ax = held.SR - held.SL, ay = held.SD - held.SU; if (an) { ax = aimStick.x; ay = aimStick.y; }
    player.aim = Math.max(0, (player.aim || 0) - dt);
    if ((ax || ay) && G.state === 'play') { const al = Math.hypot(ax, ay); player.fx = ax / al; player.fy = ay / al; player.aim = 0.2; player.diag = an || !!(ax && ay);
      player.shootT = (player.shootT || 0) + dt;
      if (an) player.dir = Math.abs(ax) >= Math.abs(ay) * 0.75 ? (ax < 0 ? 2 : 3) : (ay > 0 ? 0 : 1);
      else player.dir = ax && (!ay || Math.abs(ax) >= Math.abs(ay)) ? (ax < 0 ? 2 : 3) : (ay > 0 ? 0 : 1); // diagonals use the side profile so the gun points the right way
      if (G.cdT <= 0 && (an || performance.now() - shootT0 >= 110 || (ax && ay))) { attack(); if (!an) shootFired = true; } }
    else if (!n) { player.shootT = 0; if (!shootFired && G.state === 'play') { shootFired = true; G.cdT = 0; attack(); } } } // a quick tap still fires once, on release
  const spd = 70 * (player.air ? 1.2 : 1);
  const kb = player.kb;
  const hit = moveBody(player, (mx * spd + kb[0]) * dt, (my * spd + kb[1]) * dt, 4);
  player.perchT = Math.max(0, (player.perchT || 0) - dt);
  if (hit && !player.air && player.moving && !(player.perchT > 0)) tryAutoHop(mx, my); // just landed on a crate: don't walk straight off it
  kb[0] *= Math.pow(0.002, dt); kb[1] *= Math.pow(0.002, dt);
  if (player.air) { player.vz -= GRAV * dt; player.jz += player.vz * dt;
    // sticky perch: coming down over a crate lid lands you on it (no pixel-perfect release needed)
    if (player.vz < 0 && player.maxL >= 1 && player.level === 0 && kind[tileAt(player.x, player.y - 2)] === K.CRATE && boxOk(player.x, player.y, { air: false, level: 1 }, 3)) { player.jz = 0; land(); }
    else if (player.jz <= 0 && player.vz < 0) land(); }
  player.atkT = Math.max(0, player.atkT - dt); player.hurtT = Math.max(0, player.hurtT - dt); player.jumpBuf = Math.max(0, (player.jumpBuf || 0) - dt);
  G.cdT = Math.max(0, G.cdT - dt);
  for (const it of itemPool) if (it.alive && Math.abs(it.x - player.x) < 22 && Math.abs(it.y - player.y) < 20 && it.level === player.level) pickup(it); // v13: 3x pickups, 3x reach
}
// ================================================================ input (keyboard = shell buttons = touch)
const held = { up: 0, down: 0, left: 0, right: 0, SU: 0, SD: 0, SL: 0, SR: 0 }; // v10: the four SHOOT directions are held (aim + auto-fire)
const SHOOTS = ['SU', 'SD', 'SL', 'SR'];
let shootT0 = 0, shootFired = true; // shootFired: a shot has gone out since the first press (a quick tap fires on release)
// v11: wall-clock time of the first shoot press (chord window for 2-button diagonals)
const isShoot = (b) => b === 'SU' || b === 'SD' || b === 'SL' || b === 'SR';
const stick = { x: 0, y: 0, on: false };
const aimStick = { x: 0, y: 0, on: false }, AIM_DEAD = 0.22; // v14 round analog SHOOT stick (shell + touch)
const queue = [];
const KEYMAP = { // v14: WASD move, ARROWS (or IJKL) 8-way aim + shoot, SPACE (or any shoot key) starts / restarts. No pause.
  w: 'up', s: 'down', a: 'left', d: 'right',
  ArrowUp: 'SU', ArrowDown: 'SD', ArrowLeft: 'SL', ArrowRight: 'SR', i: 'SU', k: 'SD', j: 'SL', l: 'SR',
  ' ': 'GO',
};
let lastInput = touchDev ? 'touch' : 'keys';
function keyName(e) { if (e.code === 'Space') return ' '; const k = e.key; return k && k.length === 1 ? k.toLowerCase() : k; }
addEventListener('keydown', (e) => {
  const k = keyName(e);
  if (nameEntryOn()) { // v17: a real keyboard types the name; the shell D-pad (synthetic WASD) and arrows move the wheel; Enter / Space / shoot confirm
    e.preventDefault(); audioInit(); if (e.repeat && k !== 'Backspace') return;
    if (e.handheld && KEYMAP[k] && KEYMAP[k] in held && !isShoot(KEYMAP[k])) { if (!held[KEYMAP[k]]) queue.push(KEYMAP[k]); held[KEYMAP[k]] = 1; return; }
    if (e.handheld) return;
    if (/^[a-z0-9_.\-]$/.test(k)) neType(k.toUpperCase()); else if (k === 'Backspace' || k === 'Delete') neType('<');
    else if (k === 'Enter') { if (G.deadT > 0.25) nameConfirm(); } else if (k === ' ') { if (G.deadT > 0.25) nameSelect(); }
    else if (k === 'ArrowUp') nameNav('up'); else if (k === 'ArrowDown') nameNav('down'); else if (k === 'ArrowLeft') nameNav('left'); else if (k === 'ArrowRight') nameNav('right');
    return; }
  if (k === 'm') { toggleMute(); return; }
  const a = KEYMAP[k]; if (!a) return;
  e.preventDefault(); audioInit();
  if (e.handheld) lastInput = 'shell'; else if (e.isTrusted) lastInput = 'keys';
  if (isShoot(a) && !SHOOTS.some((d) => held[d])) { shootT0 = performance.now(); shootFired = false; }
  if (a in held) { if (!held[a]) queue.push(a); held[a] = 1; } else if (!e.repeat) queue.push(a);
});
addEventListener('keyup', (e) => { const a = KEYMAP[keyName(e)]; if (a in held) held[a] = 0; });
addEventListener('blur', () => { for (const k in held) held[k] = 0; });
// touch controls (only shown without the shell)
{
  const base = $('tBase'), knob = $('tKnob'), area = $('tStick'); let id = null, ox = 0, oy = 0;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
  area.addEventListener('pointerdown', (e) => { audioInit(); queue.push('TAP'); lastInput = 'touch'; id = e.pointerId; area.setPointerCapture(id); const r = area.getBoundingClientRect(); ox = e.clientX; oy = e.clientY; base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; stick.on = true; stick.x = stick.y = 0; setKnob(0, 0); });
  area.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy), mx = 48; if (l > mx) { dx *= mx / l; dy *= mx / l; } setKnob(dx, dy); stick.x = dx / mx; stick.y = dy / mx; const mag = Math.hypot(stick.x, stick.y);
    if (mag > 0.5) { const dir = Math.abs(stick.x) > Math.abs(stick.y) ? (stick.x < 0 ? 'left' : 'right') : (stick.y < 0 ? 'up' : 'down'); if (dir !== stick.lastDir) { stick.lastDir = dir; queue.push(dir); } } else stick.lastDir = null; });
  const end = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; stick.lastDir = null; setKnob(0, 0); };
  area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  // v14: tap anywhere on the game screen starts / restarts (title + death screens)
  $('stage').addEventListener('pointerdown', (e) => { audioInit(); if (stageTap(e)) return; queue.push('GO'); }); // v17: taps on the name keys / your leaderboard row
}
// v14: round analog SHOOT stick. Ring + knob; the knob follows the thumb (clamped to the ring) and springs back on release.
// Mounted in the shell's pad slot (the compass buttons are hidden by CSS) and in the touch overlay (#tAim). Multitouch-safe: own pointer id.
const aimEls = [];
function mountAimStick(host) {
  if (!host || host.querySelector('.lt-astick')) return;
  const el = document.createElement('div'); el.className = 'lt-astick'; el.innerHTML = '<div class="lt-astick-ring"><i class="lt-astick-dz"></i></div><i class="lt-astick-knob"></i>';
  host.appendChild(el); aimEls.push(el); const knob = el.querySelector('.lt-astick-knob'); let id = null;
  const at = (e) => { const r = el.getBoundingClientRect(), R = r.width * 0.31; let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; aimStick.x = dx / R; aimStick.y = dy / R; el.classList.toggle('lt-astick-fire', Math.hypot(aimStick.x, aimStick.y) > AIM_DEAD); };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); if (lastInput !== 'shell') lastInput = shellOn() ? 'shell' : 'touch';
    if (id !== null) return; id = e.pointerId; try { el.setPointerCapture(id); } catch (_) {} aimStick.on = true; el.classList.add('lt-astick-on'); at(e); queue.push('GO'); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; e.preventDefault(); e.stopPropagation(); at(e); });
  const end = (e) => { if (e.pointerId !== id) return; e.stopPropagation(); id = null; aimStick.on = false; aimStick.x = aimStick.y = 0; knob.style.transform = ''; el.classList.remove('lt-astick-on', 'lt-astick-fire'); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  for (const t of ['touchstart', 'touchmove', 'contextmenu']) el.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}
mountAimStick($('tAim'));
{ let n = 0; const tick = setInterval(() => { const sp = document.querySelector('.hh-spad'); if (sp) mountAimStick(sp); if ((sp && sp.querySelector('.lt-astick')) || ++n > 200) clearInterval(tick); }, 50); }
// idle hint without words: the stick ring pulses gold on the title + death screens
setInterval(() => { const idle = STATE === 'title' || (G && G.state === 'dead' && G.deadT > 0.25); for (const el of aimEls) el.classList.toggle('lt-astick-idle', !!idle); }, 150);
function updateTouchLabels() {}
// controls labels: every on-screen hint names the real control for the current mode
function mode() { if (shellOn()) return 'shell'; if (touchDev && lastInput !== 'keys') return 'touch'; return 'keys'; }
const LABELS = { // v10: no A/B, no eat, no flap. shoot = the compass pad (or arrows)
  shell: { move: 'D-PAD', shoot: 'SHOOT PAD', START: 'START' },
  touch: { move: 'STICK', shoot: 'SHOOT PAD', START: 'PAUSE' },
  keys: { move: 'WASD', shoot: 'ARROWS', START: 'ENTER' },
};
const L = (k) => LABELS[mode()][k];

// ================================================================ audio (WebAudio synth, honours the shell mute)
let AC = null, master = null, rainGain = null, muted = false;
const PWR = { off: false, gain: null, susT: 0, cycles: 0 }; // v22: the handheld power switch gates ALL game audio
const LT_BOOT = !/[?&]handheld=0/.test(location.search) && !/[?&]boot=0/.test(location.search); // v19 power-on boot (see bootOn)
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.6;
  // v19: a brick-wall-ish limiter on the whole mix, so the louder music + gunfire never clip
  const lim = AC.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  const pwr = AC.createGain(); pwr.gain.value = PWR.off ? 0 : 1; master.connect(pwr); pwr.connect(lim); lim.connect(AC.destination); master.lim = lim; PWR.gain = pwr; // v22: power gate (mute is upstream on master, so it still overrides)
  const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
  rainGain = AC.createGain(); rainGain.gain.value = 0.05; src.connect(f); f.connect(rainGain); rainGain.connect(master); src.start();
}
let noiseBuf = null;
function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.6; }
function toggleMute() { const H = window.Handheld && window.Handheld.current; if (H && typeof H.setMuted === 'function') H.setMuted(!muted); else setMuted(!muted); }
addEventListener('handheld:mute', (e) => setMuted(e.detail && e.detail.muted));
setTimeout(() => { const H = window.Handheld && window.Handheld.current; if (H && H.muted) setMuted(true); }, 0);
let powered = true;
addEventListener('handheld:power', (e) => { powered = !(e.detail && e.detail.on === false); }); // v14: no pause (power-off just blanks the shell)
function tone(f0, f1, dur, type = 'square', vol = 0.15, delay = 0) {
  if (!AC || muted) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol = 0.2, q = 1, delay = 0) {
  if (!AC || muted || !noiseBuf) return; const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
function sfx(n) {
  switch (n) {
    case 'jump': tone(220, 420, 0.12, 'square', 0.06); break;
    case 'land': noise(0.08, 300, 0.12); break;
    case 'peck': tone(1500, 900, 0.035, 'square', 0.06); noise(0.03, 3200, 0.12, 4); break; // sharp tok
    case 'windup': tone(300, 700, 0.5, 'triangle', 0.05); break;
    case 'throw': noise(0.15, 1400, 0.15, 2); tone(500, 250, 0.15, 'square', 0.04); break;
    case 'swing': noise(0.12, 1800, 0.12, 2); break;
    case 'thud': noise(0.1, 220, 0.3); tone(110, 60, 0.1, 'square', 0.08); break;
    case 'splat': noise(0.25, 400, 0.35); tone(90, 40, 0.25, 'sawtooth', 0.08); break;
    case 'pistol': noise(0.18, 1200, 0.45, 0.6); tone(300, 80, 0.12, 'square', 0.1); break;
    case 'mg': noise(0.06, 1600, 0.28, 0.8); tone(220, 90, 0.05, 'square', 0.06); break;
    case 'zpeck': tone(760, 380, 0.05, 'square', 0.035); break;
    case 'shotgun': noise(0.4, 700, 0.6, 0.4); tone(150, 40, 0.3, 'sawtooth', 0.12); break;
    case 'rung': tone(640, 600, 0.03, 'square', 0.035); break;
    case 'click': tone(1200, 1100, 0.03, 'square', 0.05); break;
    case 'pick': tone(660, 660, 0.06, 'square', 0.07); tone(990, 990, 0.08, 'square', 0.07, 0.06); break;
    case 'hurt': tone(200, 70, 0.25, 'sawtooth', 0.15); noise(0.15, 500, 0.25); break;
    case 'eat': for (let i = 0; i < 3; i++) noise(0.06, 900, 0.15, 3, i * 0.12); break;
    case 'heal': tone(440, 880, 0.3, 'triangle', 0.1); break;
    case 'groan': { if (!AC || muted) break; tone(90 + Math.random() * 40, 60, 0.7, 'sawtooth', 0.035); break; }
    case 'thunder': noise(1.8, 90, 0.5, 0.5); noise(1.2, 160, 0.3, 0.6, 0.2); break;
    case 'menu': tone(520, 520, 0.04, 'square', 0.05); break;
    case 'dusk': tone(196, 196, 0.5, 'triangle', 0.08); tone(147, 147, 0.8, 'triangle', 0.08, 0.5); break;
    case 'dawn': tone(262, 262, 0.3, 'triangle', 0.07); tone(392, 392, 0.5, 'triangle', 0.07, 0.3); break;
    case 'die': tone(220, 40, 1.4, 'sawtooth', 0.15); break;
  }
}

// ================================================================ v14: no menus, no pause. v16: shoot restarts at ANY moment of the death credits
function handleButtons() { // D-pad / WASD = run, SHOOT stick / arrows = aim + fire (held, see updatePlayer). Any shoot input / Space / screen tap starts + restarts.
  while (queue.length) {
    const b = queue.shift();
    const go = isShoot(b) || b === 'GO';
    if (STATE === 'off') continue;
    if (STATE === 'intro') { if (go || b === 'TAP') { introEnd(); queue.length = 0; return; } continue; } // v19: shoot skips the intro (to the title, not into a run)
    if (STATE === 'title') { if (T0 - INTRO.popAt < 0.45) continue; if (go || b === 'TAP') { STATE = 'game'; newGame(); sfx('dawn'); uiSnd('select'); } continue; }
    if (G.state === 'dead') {
      const dir = b === 'up' || b === 'down' || b === 'left' || b === 'right';
      if (TC.on) { if (go && T0 - TC.openAt > 0.35) tcPress(TC.cur); else if (dir) tcNav(b); continue; } // v22 time card: shoot = the focused button (CONTINUE unless moved)
      if (go && T0 - TC.closeAt < 0.3) continue;
      if (NE.on) { if (go && G.deadT > 0.25) nameSelect(); else if (dir) nameNav(b); continue; } // v18 name grid: shoot presses the key under the cursor (OK greyed until valid)
      if (go && G.deadT > 0.25) { creditsRestart(); queue.length = 0; return; } // 0.25 s guard: a shot fired in the same instant as the fatal hit doesn't skip the credits
      continue; }
  }
}
// v14: buttons handled in menus.js (no pause)
let _alive = 0;
// v10: no drain at all. Life only drops when an attack lands (peck, stomp, rotten egg); nothing heals it (no food, no eating).
function updateSurvival(dt) {
  G.st += dt;
  if (G.cdT <= 0) G.stam = Math.min(100, G.stam + 16 * dt);
  updateAch(); // v13
  G.lootT -= dt;
  const m = Math.floor(G.st / 60); // v15: ammo spawns speed up every minute
  if (G.lootT <= 0) { G.lootT = TUNE.lootEveryAt(m); const n = itemPool.filter((i) => i.alive).length; if (n < TUNE.lootFloorAt(m)) scatterLoot(TUNE.lootAddAt(m)); }
  // v15: each minute mark unlocks the next gun tier: announce it and drop one of each upgraded gun 6-14 tiles away
  const at = availTier(); if (at > (G.tierSeen || 1)) { G.tierSeen = at; tierDropPop(at);
    for (const k of ['mg', 'shotgun']) { const p = randomTile((i, x, y) => lvl[i] === 0 && kind[i] !== K.CRATE && kind[i] !== K.PLAZA && Math.abs(Math.hypot(x - player.x / TS, y - player.y / TS) - 10) < 4, 400); if (p) dropItem(k, p[0] * TS + 8, p[1] * TS + 10, 0, at); } }
}
let lastPhaseNight = false;
function updateClock(dt) {
  const before = G.t % CYCLE; G.t += dt; const ph = G.t % CYCLE;
  if (ph < before) G.day++; // v18: no dusk / night (always day)
  return 1;
}
function clockStr() { const ph = G ? G.t % CYCLE : 40; let h; if (ph < DAY_LEN) h = 6 + ph / DAY_LEN * 14; else h = 20 + (ph - DAY_LEN) / NIGHT_LEN * 10; h %= 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function daylight() { return 1; } // v18: always bright day
function daylightOld() {
  if (!G) return 0.85; const ph = G.t % CYCLE, tr = 18;
  if (ph < tr) return ph / tr;                       // dawn
  if (ph < DAY_LEN - tr) return 1;
  if (ph < DAY_LEN) return (DAY_LEN - ph) / tr;      // dusk
  return 0;
}
// ================================================================ HUD
const ICONS = (() => { // tiny 7x6 pixel icons. chars: # main, o second, k ink, y beak
  const defs = {
    heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
    food: ['...##..', '..####.', '..#o##.', '.####..', 'kk##...', 'k......'],          // corn
    bolt: ['...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
    sun: ['#..#..#', '.#####.', '.#####.', '#######', '.#####.', '#..#..#'], moon: ['..###..', '.##....', '##.....', '##.....', '.##....', '..###..'],
    skull: ['..oo...', '.####..', '.#k##yy', '.####y.', '..##...', '.o..o..'],          // zombie chikn head
  };
  const cols = { heart: ['#ff3347'], food: ['#ffc42f', '#d89a14'], bolt: ['#22d457'], sun: ['#ffc42f'], moon: ['#8ed8ff'], skull: ['#c2d99a', '#94384a'] }, out = {};
  for (const k in defs) { const [c, x] = mk(7, 6); defs[k].forEach((row, y) => [...row].forEach((ch, X) => { const col = ch === '#' ? cols[k][0] : ch === 'o' ? (cols[k][1] || INK) : ch === 'k' ? '#090b0a' : ch === 'y' ? '#ffc42f' : null; if (col) px(x, col, X, y); })); out[k] = c; }
  return out;
})();
const INK = '#090b0a', CREAM = '#f8f5e9', HGREEN = '#08d14a', HRED = '#ff3347', HGOLD = "#ffc42f";
// real hens.farm art (permission from the community), pixelated to the game grid: title hen, plucked hen, golden HEGG
const ART = {}; for (const k of ['hen-title', 'hen-plucked', 'hegg', 'hen-faces']) { const im = new Image(); im.src = k + '.png'; ART[k] = im; }
const artOk = (k) => ART[k].complete && ART[k].naturalWidth > 0;
// v11 hens.farm skin: the real hens.farm artwork is shown as crisp, full-resolution <img>/<div> layers over the canvas
// (HUD portrait, title hero, death and pause hens), placed in canvas coordinates. ?skin=classic = the v10 pixel versions.
const SKIN = (() => { const L = document.getElementById('skinLayer'); if (!L || /[?&]skin=classic/.test(location.search)) { if (L) L.remove(); return null; }
  document.documentElement.classList.add('lt-skin'); const o = {}; for (const el of L.children) o[el.dataset.k] = { el, on: false, key: '' }; return o; })();
const skinOn = (k) => !!(SKIN && SKIN[k] && SKIN[k].ok !== false && (SKIN[k].el.tagName !== 'IMG' || (SKIN[k].el.complete && SKIN[k].el.naturalWidth > 0)));
let _skinUsed = {};
function skinShow(k, x, y, w, h, extra) { if (!skinOn(k)) return false; const s = SKIN[k]; _skinUsed[k] = 1;
  const key = [x, y, w, h, extra, N].join(','); if (key !== s.key) { s.key = key; const st = s.el.style; st.left = (x / N * 100) + '%'; st.top = (y / N * 100) + '%'; st.width = (w / N * 100) + '%'; st.height = (h / N * 100) + '%'; if (extra !== undefined) st.backgroundPosition = extra; }
  if (!s.on) { s.on = true; s.el.style.display = 'block'; } return true; }
function skinBegin() { _skinUsed = {}; }
function skinEnd() { if (!SKIN) return; for (const k in SKIN) if (!_skinUsed[k] && SKIN[k].on) { SKIN[k].on = false; SKIN[k].el.style.display = 'none'; } }
function bar(x, y, w, v, col, icon) {
  hx.drawImage(ICONS[icon], x, y);
  hx.fillStyle = INK; hx.fillRect(x + 9, y, w + 2, 6);
  hx.fillStyle = '#e8e2cc'; hx.fillRect(x + 10, y + 1, w, 4);
  const f = Math.round(w * clamp(v / 100, 0, 1)); hx.fillStyle = col; hx.fillRect(x + 10, y + 1, f, 4);
  hx.fillStyle = 'rgba(255,255,255,.45)'; hx.fillRect(x + 10, y + 1, f, 1);
}
// hens.farm card: cream fill, 1px ink border, hard ink offset shadow
function panel(x, y, w, h, a = 0.92) { hx.fillStyle = 'rgba(9,11,10,.55)'; hx.fillRect(x + 2, y + 2, w, h); hx.fillStyle = `rgba(248,245,233,${Math.max(a, 0.86)})`; hx.fillRect(x, y, w, h); hx.fillStyle = INK; hx.fillRect(x, y, w, 1); hx.fillRect(x, y + h - 1, w, 1); hx.fillRect(x, y, 1, h); hx.fillRect(x + w - 1, y, 1, h); }
const inkText = (s, x, y, col = INK, align = 'left') => text(s, x, y, 8, col, align, false);
function drawItemIcon(i, x, y) { hx.drawImage(ITEM_IMG, i * 16, 0, 16, 16, x - 2, y - 3, 16, 16); }
function startTxt() { const m = mode(); return m === 'keys' ? 'PRESS SPACE' : m === 'shell' ? 'PRESS START' : 'TAP SHOOT PAD'; }
function hintText() {
  const mv = L('move'), SH = L('shoot'), S = L('START');
  if (WEAPONS[G.weapon].kind === 'gun' && (G.shots || 0) < 4) return 'HOLD ' + SH + ' TO FIRE ' + WEAPONS[G.weapon].name; // v9
  if (G.st < 7) return mv + ' RUN   ' + SH + ' AIM + SHOOT';
  if (G.st < 14) return (L('shoot') === 'ARROWS' ? 'TWO ARROWS' : 'TWO SHOOT BUTTONS') + ' = DIAGONAL (NE/SE/SW/NW)';
  if (G.st < 17) return 'ONLY HITS HURT. NO HEALING. KEEP MOVING';
  if (G.st < 20) return S + ' = PAUSE.  BEST WEAPON AUTO-EQUIPS';
  if (G.hp < 35) return 'LOW LIFE. DON\'T GET HIT';
  return '';
}
function nearestCrate() { let best = null; for (const c of crates) { const x = (c.x + 1) * TS, y = c.y * TS + 10, d = Math.hypot(x - player.x, y - player.y); if (!best || d < best.d) best = { x, y, d }; } return best; }
function drawHUD(dt, t) { skinBegin(); drawHUD0(dt, t); skinEnd(); }
function drawHUD0(dt, t) {
    if (STATE === 'title') { drawTitle(t); return; }
  // low-HP vignette / hurt flash
  if (G.hp < 30 || player.hurtT > 0) { const a = player.hurtT > 0 ? 0.35 : (0.15 + Math.sin(t * 5) * 0.08); hx.fillStyle = `rgba(160,20,20,${a})`; hx.fillRect(0, 0, N, 3); hx.fillRect(0, N - 3, N, 3); hx.fillRect(0, 0, 3, N); hx.fillRect(N - 3, 0, 3, N); }
  if (G.flash > 0) { hx.fillStyle = `rgba(255,230,180,${G.flash * 2})`; hx.fillRect(0, 0, N, N); G.flash -= dt; }
  // stat bars (top-left)
  const bw = Math.round(N * 0.2);
  const FX = artOk('hen-faces') || skinOn('face') ? 31 : 0; panel(2, 2, bw + 16 + FX, 26);
  if (FX) { const fi = player.hurtT > 0 ? 3 : G.hp < 35 ? 2 : G.hp > 65 ? 0 : 1; if (!(G.state !== 'dead' && skinShow('face', 3, 3, 30, 24, (fi * 100 / 3) + '% 0'))) hx.drawImage(ART['hen-faces'], fi * 30, 0, 30, 24, 3, 3, 30, 24); } // real hens.farm hen, mood follows LIFE
  // LIFE: one big bar. v10: it only moves when you get hit (no drain, no ticking stripe).
  const bx = 5 + FX; hx.drawImage(ICONS.heart, bx, 5 + (Math.floor(t * 2) % 2)); hx.fillStyle = INK; hx.fillRect(bx + 9, 5, bw + 2, 10); hx.fillStyle = '#e8e2cc'; hx.fillRect(bx + 10, 6, bw, 8);
  { const f = Math.round(bw * clamp(G.hp / 100, 0, 1)); hx.fillStyle = G.hp < 30 && Math.floor(t * 4) % 2 ? '#ff9d00' : HRED; hx.fillRect(bx + 10, 6, f, 8); hx.fillStyle = 'rgba(255,255,255,.45)'; hx.fillRect(bx + 10, 6, f, 1); }
  inkText('LIFE', bx + 11 + bw - 1, 6, G.hp < 30 ? '#ffffff' : 'rgba(9,11,10,.75)', 'right');
  bar(bx, 19, bw, G.stam, HGREEN, 'bolt'); // 19+6 = 25
  // clock (top-right)
  const night = isNight(); const ct = clockStr();
  panel(N - 56, 2, 54, 18);
  hx.drawImage(ICONS[night ? 'moon' : 'sun'], N - 52, 8);
  inkText(fmtTime(G.st), N - 5, 6, HRED, 'right'); // v18: always day: time survived only
  // weapon + ammo (bottom-left)
  const w = WEAPONS[G.weapon], ww = Math.max(74, 22 + w.name.length * 6);
  panel(2, N - 22, ww, 20);
  if (w.icon >= 0) hx.drawImage(gunImg(G.weapon, w.tier), 0, 0, 16, 16, 3, N - 22, 16, 16); else { hx.fillStyle = INK; hx.fillRect(7, N - 14, 7, 5); hx.fillStyle = HGOLD; hx.fillRect(8, N - 13, 5, 3); hx.fillRect(13, N - 12, 2, 1); } // beak
  inkText(w.name, 19, N - 20, w.tier >= 2 ? (w.tier >= 5 ? '#b07800' : '#036b2b') : INK); // v15: name + tier (e.g. MG III)
  if (w.kind === 'gun') inkText(AMMO_NAME[w.ammo] + ' ' + G.inv[w.ammo], 19, N - 11, G.inv[w.ammo] ? INK : HRED);
  else { const sx = 19; hx.fillStyle = INK; hx.fillRect(sx, N - 7, 40, 3); hx.fillStyle = G.cdT > 0 ? '#b9c0c6' : HGREEN; hx.fillRect(sx + 1, N - 6, Math.round(38 * (1 - G.cdT / w.cd)), 1); }
  if (G.equip && G.equip.t > 0) { G.equip.t -= dt; const s = 'EQUIPPED: ' + G.equip.name, pw = s.length * 6 + 12, px = Math.round(N / 2 - pw / 2), py = Math.round(N / 2 + 22 + Math.max(0, G.equip.t - 1.4) * 30); // v7 auto-equip popup, under the hen
    panel(px, py, pw, 14); hx.fillStyle = HGOLD; hx.fillRect(px + 1, py + 1, pw - 2, 2); inkText(s, px + 6, py + 4, (G.equip.t * 6 | 0) % 2 && G.equip.t > 1.2 ? HRED : INK); }
  // kill count + safe marker
  panel(2, 31, 22 + String(G.kills).length * 6, 11);
  hx.drawImage(ICONS.skull, 5, 33); inkText('' + G.kills, 14, 32);
  drawCleanMeter(t); // v16 no-hit streak
  // messages
  let my = 40; const achOn = G.achQ && G.achQ.length && G.achQ[0].t > 0; // v25: only while a card is actually up for (const m of G.msg) { if (!achOn) text(m.s, N / 2, my, 8, CREAM, 'center'); my += 9; m.t -= dt; }
  if (G.state === 'play') drawAch(dt); // v13 achievement pop-up (top band)
  flockGhost(); // v24: see-through quote band over the hen
  G.msg = G.msg.filter((m) => m.t > 0);
  if (G.state === 'dead') drawCredits(t, dt); // v16 ending credits (credits.js)
}
function pixLine(x0, y0, x1, y1, col) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0; hx.fillStyle = col; while (n++ < 600) { hx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
// v16: the death panel became the ending-credits roll (credits.js drawCredits)
function drawTitle(t) {
  hx.fillStyle = 'rgba(9,11,10,.18)'; hx.fillRect(0, 0, N, N);
  const pk = clamp((T0 - INTRO.popAt) / 0.4, 0, 1), pop = pk >= 1 ? 0 : Math.round(-N * 0.6 * Math.pow(1 - pk, 3) + Math.sin(pk * Math.PI) * 10); // v19: the title pops in after the intro
  if (pk < 1) { hx.fillStyle = `rgba(255,255,255,${0.8 * (1 - pk)})`; hx.fillRect(0, 0, N, N); }
  const y = Math.round(N * 0.08) + pop, cw = Math.min(N - 16, 210), cx0 = Math.round(N / 2 - cw / 2);
  panel(cx0, y - 4, cw, 76);
  { const bobY = Math.round(Math.sin(t * 3) * 1); if (!skinShow('title', cx0 + cw - 60, y + 2 + bobY, 56, 60)) { if (artOk('hen-title')) hx.drawImage(ART['hen-title'], cx0 + cw - 52, y + 10 + bobY); } }
  skinShow('egg', cx0 + 6, y + 53, 12, 15);
  const tx = cx0 + Math.round((cw - 56) / 2);
  text('ZOMBIE', tx, y, 16, HRED, 'center'); // v20: the game is ZOMBIE FARM now
  text('FARM', tx, y + 17, 16, '#ffffff', 'center');
  inkText('CHIKN EDITION', tx, y + 38, '#036b2b', 'center');
  inkText('BILLIONS MUST BOK.', tx, y + 58, INK, 'center'); // v14: no instructions
  const cy = Math.max(y + 96, Math.round(N * 0.5)); // v14: controls panel + start prompt removed
  { const ids = Object.keys(ACH_UNLOCKED).sort((a, b) => ACH_UNLOCKED[b] - ACH_UNLOCKED[a]); text('TROPHIES ' + achCount() + '/' + ACH_TOTAL + (ids.length ? '  ' + achDef(ids[0])[0] : ''), N / 2, cy + 40, 8, HGOLD, 'center'); }
  if (best.time) text('BEST: LASTED ' + fmtTime(best.time) + '  /  ' + best.kills + ' PECKED', N / 2, N - 20, 8, CREAM, 'center');
}
// ================================================================ v18: 100 achievements (big gold pop-ups, queued + merged, saved in localStorage)
// ids from v13-v17 are kept, so trophies already earned still count. Lifetime stats live in lasttower.life1.
const ACH_KEY = 'lasttower.ach1', LIFE_KEY = 'lasttower.life1';
const ACH_LIST = [ // [id, title, subtitle, check(run R, lifetime L)] ; check is evaluated while playing (null = awarded by an event)
  // minutes survived (13)
  ['m1', "STILL BOKKIN'", '1:00 SURVIVED', (R) => R.st >= 60], ['m2', 'HARD-BOILED', '2:00 SURVIVED', (R) => R.st >= 120], ['m3', 'FREE RANGE LEGEND', '3:00 SURVIVED', (R) => R.st >= 180],
  ['m4', 'COOP CHAMPION', '4:00 SURVIVED', (R) => R.st >= 240], ['m5', 'BILLIONS MUST BOK', '5:00 SURVIVED', (R) => R.st >= 300], ['m6', 'NEST EGG', '6:00 SURVIVED', (R) => R.st >= 360],
  ['m7', 'SEVEN-LAYER YOLK', '7:00 SURVIVED', (R) => R.st >= 420], ['m8', 'OVER EASY, NEVER OVER', '8:00 SURVIVED', (R) => R.st >= 480], ['m9', 'NINE LIVES (WRONG ANIMAL)', '9:00 SURVIVED', (R) => R.st >= 540],
  ['m10', 'UNPLUCKABLE', '10:00 SURVIVED', (R) => R.st >= 600], ['m12', 'A DOZEN EGGS', '12:00 SURVIVED', (R) => R.st >= 720], ['m15', 'FIFTEEN MINUTES OF FLAME', '15:00 SURVIVED', (R) => R.st >= 900],
  ['m20', 'ETERNAL ROOST', '20:00 SURVIVED', (R) => R.st >= 1200],
  // kills in one run (9)
  ['k10', 'FIRST BLOOD-ISH', '10 UNDEAD PLUCKED', (R) => R.kills >= 10], ['k25', 'PECKING ORDER', '25 UNDEAD PLUCKED', (R) => R.kills >= 25], ['k50', 'FOWL PLAY', '50 UNDEAD PLUCKED', (R) => R.kills >= 50],
  ['k100', 'CENTURY CHIKN', '100 UNDEAD PLUCKED', (R) => R.kills >= 100], ['k150', 'BUCKET OF WINGS', '150 UNDEAD PLUCKED', (R) => R.kills >= 150], ['k250', 'HEN-DEMIC', '250 UNDEAD PLUCKED', (R) => R.kills >= 250],
  ['k500', 'COOP DE GRACE', '500 UNDEAD PLUCKED', (R) => R.kills >= 500], ['k750', 'FEATHER STORM', '750 UNDEAD PLUCKED', (R) => R.kills >= 750], ['k1000', 'KILLERGAINZ', '1000 UNDEAD PLUCKED', (R) => R.kills >= 1000],
  // no-hit streaks (5)
  ['clean1', 'UNTOUCHED', '1 MINUTE WITHOUT A HIT', null], ['clean2', 'FEATHERS INTACT', '2 MINUTES WITHOUT A HIT', null], ['clean3', 'TEFLON HEN', '3 MINUTES WITHOUT A HIT', null],
  ['clean4', 'NON-STICK NUGGET', '4 MINUTES WITHOUT A HIT', null], ['clean5', 'GHOST CHIKN', '5 MINUTES WITHOUT A HIT', null],
  // guns + tiers (10)
  ['gun1', 'LOCKED AND BOKKED', 'FIRST GUN', (R) => R.ownGun], ['mg', 'BRRRT-AWK!', 'MACHINE GUN ACQUIRED', (R) => R.ownMg], ['sg', 'POP GOES THE CORN', 'SHOTGUN ACQUIRED', (R) => R.ownSg],
  ['both', 'DUAL WIELD DIVA', 'MG AND SHOTGUN IN ONE RUN', (R) => R.ownMg && R.ownSg], ['up1', 'UPGRADED', 'A TIER II GUN', (R) => R.tmax >= 2], ['mg3', 'BELT-FED BIRD', 'MG III', (R) => R.tmg >= 3],
  ['sg3', 'KERNEL PANIC', 'SHOTGUN III', (R) => R.tsg >= 3], ['tier4', 'PURPLE REIGN', 'A TIER IV GUN', (R) => R.tmax >= 4], ['gold', 'GOLDEN GUN', 'A TIER V GUN', (R) => R.tmax >= 5],
  ['maxt', 'MAX TIER', 'BOTH GUNS AT TIER V', (R) => R.tmin >= 5],
  // multi-kills (5)
  ['spree', 'FRENZY!', '10 KILLS IN 3 SECONDS', null], ['spree20', 'FEEDING FRENZY', '20 KILLS IN 5 SECONDS', null], ['shot3', 'HAT TRICK HEN', '3 KILLS IN ONE SHOTGUN BLAST', null],
  ['shot5', 'CORN-SPLOSION!', '5 KILLS IN ONE SHOTGUN BLAST', null], ['shot8', 'POPCORN APOCALYPSE', '8 KILLS IN ONE SHOTGUN BLAST', null],
  // roostrs + egg-slingers (8)
  ['roostr', 'ROOSTR SLAYER', 'A ZOMBIE ROOSTR GOES DOWN', (R) => R.roostr >= 1], ['roostr5', 'COCK-A-DOODLE-DONE', '5 ROOSTRS IN ONE RUN', (R) => R.roostr >= 5],
  ['roostr20', 'ROOSTR ROAST', '20 ROOSTRS IN ONE RUN', (R) => R.roostr >= 20], ['thrower', 'EGG-SLINGER DOWN', 'NO MORE ROTTEN EGGS (FOR NOW)', (R) => R.thrower >= 1],
  ['thrower5', 'RETURN TO SENDER', '5 EGG-SLINGERS IN ONE RUN', (R) => R.thrower >= 5], ['thrower20', 'OMELETTE DU FROMAGE', '20 EGG-SLINGERS IN ONE RUN', (R) => R.thrower >= 20],
  ['splat', 'EGG ON YOUR FACE', 'TAKE A ROTTEN EGG AND LIVE', (R, L, G) => G.eggHits > 0 && G.hp > 0], ['stomped', 'STOMP AND SHRUG', 'SURVIVE A ROOSTR STOMP', (R) => R.stompHit],
  // close calls (4)
  ['close', 'CLOSE CALL', 'STILL ALIVE AT 10 LIFE OR LESS', (R, L, G) => G.hp > 0 && G.hp <= 10], ['close5', 'BY A FEATHER', 'STILL ALIVE AT 5 LIFE OR LESS', (R, L, G) => G.hp > 0 && G.hp <= 5],
  ['clutch', 'CLUTCH CLUCK', '30 SECONDS AT 10 LIFE OR LESS', (R) => R.closeT >= 30], ['lowmin', 'RUNNING ON FUMES', 'A MINUTE AT 25 LIFE OR LESS', (R) => R.lowT >= 60],
  // kill streaks without being hit (3)
  ['streak25', 'UNTOUCHABLE 25', '25 KILLS WITHOUT A HIT', (R) => R.streak >= 25], ['streak50', 'UNTOUCHABLE 50', '50 KILLS WITHOUT A HIT', (R) => R.streak >= 50],
  ['streak100', 'UNTOUCHABLE 100', '100 KILLS WITHOUT A HIT', (R) => R.streak >= 100],
  // distance (4)
  ['run1', 'LEG DAY', 'RUN 300 TILES IN ONE RUN', (R) => R.dist >= 300], ['run2', 'FREE RANGE CARDIO', 'RUN 1000 TILES IN ONE RUN', (R) => R.dist >= 1000],
  ['run3', 'MARATHON MOTHER HEN', 'RUN 3000 TILES IN ONE RUN', (R) => R.dist >= 3000], ['lrun', 'ROAD RUNNER (WRONG BIRD)', 'RUN 20000 TILES, ALL RUNS', (R, L) => L.dist + R.dist >= 20000],
  // shots (4) + accuracy (2)
  ['sh100', 'TRIGGER CLUCKY', '100 SHOTS IN ONE RUN', (R) => R.shots >= 100], ['sh500', 'SPRAY AND PRAY', '500 SHOTS IN ONE RUN', (R) => R.shots >= 500],
  ['sh2000', 'BULLET HELL HEN', '2000 SHOTS IN ONE RUN', (R) => R.shots >= 2000], ['lsh', 'AMMO ECONOMY', '10000 SHOTS, ALL RUNS', (R, L) => L.shots + R.shots >= 10000],
  ['acc50', 'SHARPSHOOTER', '50% HITS (100+ SHOTS)', (R) => R.shots >= 100 && R.hits / R.shots >= 0.5], ['acc75', "EAGLE EYE (HEN'S EYE)", '75% HITS (100+ SHOTS)', (R) => R.shots >= 100 && R.hits / R.shots >= 0.75],
  // pickups (4)
  ['pk10', 'MAGPIE', '10 PICKUPS IN ONE RUN', (R) => R.pickups >= 10], ['pk40', 'SCAVENGER HEN', '40 PICKUPS IN ONE RUN', (R) => R.pickups >= 40],
  ['pk100', 'HOARDER OF THE COOP', '100 PICKUPS IN ONE RUN', (R) => R.pickups >= 100], ['lpk', 'DRAGON OF THE NEST', '1000 PICKUPS, ALL RUNS', (R, L) => L.pickups + R.pickups >= 1000],
  // lifetime kills (4) + time (2) + runs (4)
  ['lk500', 'SEASONED', '500 KILLS, ALL RUNS', (R, L) => L.kills + R.kills >= 500], ['lk2500', 'EXTRA CRISPY', '2500 KILLS, ALL RUNS', (R, L) => L.kills + R.kills >= 2500],
  ['lk10k', 'FAMILY BUCKET', '10000 KILLS, ALL RUNS', (R, L) => L.kills + R.kills >= 10000], ['lk50k', 'COLONEL OF THE COOP', '50000 KILLS, ALL RUNS', (R, L) => L.kills + R.kills >= 50000],
  ['lt10', 'REGULAR AT THE ROOST', '10 MINUTES SURVIVED, ALL RUNS', (R, L) => L.time + R.st >= 600], ['lt60', 'ONE HOUR OF BOK', '1 HOUR SURVIVED, ALL RUNS', (R, L) => L.time + R.st >= 3600],
  ['runs1', 'GM, CHIKN', 'YOUR FIRST RUN', (R, L) => L.runs >= 1], ['runs10', 'BACK FOR SECONDS', '10 RUNS', (R, L) => L.runs >= 10],
  ['runs50', 'COOP COMMUTER', '50 RUNS', (R, L) => L.runs >= 50], ['runs100', 'CERTIFIED HEN-THUSIAST', '100 RUNS', (R, L) => L.runs >= 100],
  // chikn lore + oddities (17)
  ['egg', '$EGG STACKER', 'HOLD 200+ MG ROUNDS', (R, L, G) => G.inv.belt >= 200], ['hegg', 'HEGG HUNTER', '5 GUN UPGRADES IN ONE RUN', (R) => R.upgrades >= 5],
  ['wagmi', 'WAGMI', '3:00 AND 300 KILLS', (R) => R.st >= 180 && R.kills >= 300], ['hodl', 'DIAMOND CLAWS', 'STAND STILL 10 SECONDS, NO HIT', (R) => R.stillT >= 10],
  ['pacifist', 'PACIFIST PULLET', 'SURVIVE 1:00 WITH ZERO KILLS', (R) => R.st >= 60 && R.kills === 0], ['pecker', 'BEAK MODE', '25 PECK KILLS IN ONE RUN', (R) => R.peck >= 25],
  ['dry', 'DRY CLUCK', 'OUT OF AMMO? 5 PECK KILLS AFTER A GUN', (R) => R.dryPeck >= 5], ['swarm', 'SWARM SURFER', '40 UNDEAD ON SCREEN, STILL ALIVE', (R) => R.onScreen >= 40],
  ['switch', 'QUICK DRAW', 'MG KILL + SHOTGUN KILL IN 2 SECONDS', null], ['feed', 'FEED THE COOP', '5 AMMO CRATES IN ONE RUN', (R) => R.boxes >= 5],
  ['bok', 'BOK BOK BOK!', '3 ACHIEVEMENTS IN 10 SECONDS', null], ['flock', 'FLOCK TOGETHER', 'MEET EVERY COMMUNITY HEN', null],
  ['paper', 'PAPER WINGS', 'PLUCKED IN UNDER 10 SECONDS', null], ['ngmi', 'NGMI', 'PLUCKED WITH ZERO KILLS', null], ['rug', 'RUG PULLED', 'PLUCKED 5 S AFTER AN UPGRADE', null],
  ['name', 'NAME IN LIGHTS', 'CHOOSE YOUR NAME', null], ['top20', 'MADE THE FLOCK', 'A SPOT ON THE TOP 20', null],
  // meta (2)
  ['half', 'HALF-BOILED', '50 ACHIEVEMENTS UNLOCKED', null], ['all', 'COMPLETIONIST CHIKN', '99 ACHIEVEMENTS UNLOCKED', null],
];
const ACH_DEF = {}; for (const [id, t1, t2] of ACH_LIST) ACH_DEF[id] = [t1, t2];
const ACH_TOTAL = ACH_LIST.length; // 100
let ACH_UNLOCKED = {}; try { ACH_UNLOCKED = JSON.parse(localStorage.getItem(ACH_KEY)) || {}; } catch (e) {}
let LIFE = { kills: 0, shots: 0, pickups: 0, dist: 0, time: 0, runs: 0 }; try { Object.assign(LIFE, JSON.parse(localStorage.getItem(LIFE_KEY)) || {}); } catch (e) {}
const saveLife = () => { try { localStorage.setItem(LIFE_KEY, JSON.stringify(LIFE)); } catch (e) {} };
const achCount = () => ACH_LIST.reduce((n, a) => n + (ACH_UNLOCKED[a[0]] ? 1 : 0), 0);
const MULTI = {}; let _multiN = 0;
function achDef(id) { if (ACH_DEF[id]) return ACH_DEF[id]; if (MULTI[id]) return MULTI[id];
  { const u = /^up:(\w+):(\d+)$/.exec(id); if (u) return [GUN_LABEL[u[1]] + ' ' + roman(+u[2]), 'UPGRADED + AMMO TOPPED UP']; const d = /^drop:(\d+)$/.exec(id); if (d) return ['MG ' + roman(+d[1]) + ' DROPPING', '+ SHOTGUN ' + roman(+d[1])]; } return [id, '']; }
function unlockSave(id) { const isNew = !ACH_UNLOCKED[id]; if (isNew) { ACH_UNLOCKED[id] = Math.floor(Date.now() / 1000); try { localStorage.setItem(ACH_KEY, JSON.stringify(ACH_UNLOCKED)); } catch (e) {} } return isNew; }
function metaCheck() { const n = achCount(); if (n >= 50 && !ACH_UNLOCKED.half) achEvent('half'); if (n >= 99 && !ACH_UNLOCKED.all) achEvent('all'); }
// an achievement earned when no pop-up can show (death, name entry): saved + counted for this run, no card
function achEvent(id) { if (!G) return; if (G.state !== 'dead' && award(id)) return; G.achGot = G.achGot || {}; if (G.achGot[id]) return; G.achGot[id] = 1; (G.achList = G.achList || []).push(id); unlockSave(id); metaCheck(); }
// v19 no-hit fix. v18 bug: every hit DID reset the no-hit clock, but the award only joined the BACK of the pop-up queue (2.6 s a card,
// bursts merge), so an UNTOUCHED / UNTOUCHABLE card could appear several seconds after it was earned, i.e. right after you'd been hit
// (and the flock quote "untouched. unbothered." with it). Now no-hit awards jump the queue (shown at once, the current card is cut short),
// never merge, and are re-validated when the card would show: a hit since it was earned cancels the award (un-saved; earn it again).
const NOHIT_ACH = new Set(['clean1', 'clean2', 'clean3', 'clean4', 'clean5', 'streak25', 'streak50', 'streak100', 'hodl']);
function achRevoke(a) { if (!G || !G.achGot) return; G.achGot[a.id] = Math.max(0, (G.achGot[a.id] || 1) - 1); if (!G.achGot[a.id]) delete G.achGot[a.id];
  const L = G.achList || [], i = L.lastIndexOf(a.id); if (i >= 0) L.splice(i, 1);
  if (a.isNew) { delete ACH_UNLOCKED[a.id]; try { localStorage.setItem(ACH_KEY, JSON.stringify(ACH_UNLOCKED)); } catch (e) {} }
  (G.achRevoked = G.achRevoked || []).push(a.id); }
function award(id, repeatable) {
  if (!G || G.state === 'dead') return false;
  G.achGot = G.achGot || {}; if (G.achGot[id] && !repeatable) return false;
  G.achGot[id] = (G.achGot[id] || 0) + 1; (G.achList = G.achList || []).push(id);
  const isNew = unlockSave(id);
  // v25 queue: cards start at most every 8 s; whatever waits is merged into one card when the slot opens (see drawAch)
  const q = (G.achQ = G.achQ || []);
  if (NOHIT_ACH.has(id)) { const e = { id, t: 0, isNew, nohit: true, hitN: G.hitN || 0 }; if (q.length && q[0].t > 0) q.splice(1, 0, e); else q.unshift(e); } // no-hit awards lead the next card
  else q.push({ id, t: 0, isNew });
  if (id !== 'bok') { const R = G.rs; if (R) { R.awT.push(G.st); while (R.awT.length && G.st - R.awT[0] > 10) R.awT.shift(); if (R.awT.length >= 3) award('bok'); } }
  metaCheck(); return true;
}
function runStats() { return { st: 0, kills: 0, dist: 0, shots: 0, hits: 0, pickups: 0, boxes: 0, roostr: 0, thrower: 0, peck: 0, dryPeck: 0, upgrades: 0, streak: 0, closeT: 0, lowT: 0, stillT: 0, onScreen: 0,
  stompHit: false, lastUpT: -99, mgKillT: -99, sgKillT: -99, awT: [], px: player.x, py: player.y, lastSt: 0, scanT: 0, committed: false }; }
function achRunStart() { G.rs = runStats(); G.lastHit = 0; G.cleanTier = 0; LIFE.runs++; saveLife(); }
function achRunEnd() { const R = G.rs; if (!R || R.committed) return; R.committed = true; R.st = G.st; R.kills = G.kills;
  LIFE.kills += R.kills; LIFE.shots += R.shots; LIFE.pickups += R.pickups; LIFE.dist += Math.round(R.dist); LIFE.time += Math.round(R.st); saveLife();
  if (G.st < 10) achEvent('paper'); if (G.kills === 0) achEvent('ngmi'); if (G.st - R.lastUpT <= 5) achEvent('rug'); }
function achKill(z) { if (!G || !G.rs) return; const R = G.rs, now = G.st; (G.killT = G.killT || []).push(now); while (G.killT.length && now - G.killT[0] > 5) G.killT.shift();
  if (G.killT.filter((t) => now - t <= 3).length >= 10) award('spree'); if (G.killT.length >= 20) award('spree20');
  if (z.brute) R.roostr++; if (z.thrower) R.thrower++; R.streak++;
  if (G.weapon === 'fists') { R.peck++; if (G.owned.some((w) => WEAPONS[w].kind === 'gun')) R.dryPeck++; }
  if (G.weapon === 'mg') R.mgKillT = now; if (G.weapon === 'shotgun') R.sgKillT = now; if (Math.abs(R.mgKillT - R.sgKillT) <= 2) award('switch'); }
function achHurt(dmg, cause) { if (G && dmg > 0) { G.lastHit = G.st; G.hitN = (G.hitN || 0) + 1; G.cleanTier = 0; if (G.rs) { G.rs.streak = 0; G.rs.stillT = 0; if (cause === 'A ZOMBIE ROOSTR') G.rs.stompPend = true; } } }
function updateAch() {
  if (!G || G.state !== 'play' || !G.rs) return; const R = G.rs, dt = Math.max(0, G.st - R.lastSt); R.lastSt = G.st;
  R.st = G.st; R.kills = G.kills; R.shots = G.shots || 0; R.hits = G.shotHits || 0;
  const mv = Math.hypot(player.x - R.px, player.y - R.py); if (mv < 40) R.dist += mv / TS; R.px = player.x; R.py = player.y;
  R.stillT = mv < 0.05 ? R.stillT + dt : 0;
  if (G.hp > 0 && G.hp <= 10) R.closeT += dt; if (G.hp > 0 && G.hp <= 25) R.lowT += dt;
  if (R.stompPend && G.hp > 0) R.stompHit = true;
  R.scanT -= dt; if (R.scanT <= 0) { R.scanT = 0.5; let n = 0; const h = N / 2 + 8; for (const z of zombiePool) if (z.alive && Math.abs(z.x - player.x) < h && Math.abs(z.y - player.y) < h) n++; R.onScreen = Math.max(R.onScreen, n); }
  R.ownGun = G.owned.some((w) => WEAPONS[w].kind === 'gun'); R.ownMg = G.owned.includes('mg'); R.ownSg = G.owned.includes('shotgun');
  const a = G.tier.mg || 0, b = G.tier.shotgun || 0; R.tmg = a; R.tsg = b; R.tmax = Math.max(a, b); R.tmin = Math.min(a, b);
  for (const [id, , , chk] of ACH_LIST) if (chk && !(G.achGot && G.achGot[id]) && chk(R, LIFE, G)) award(id);
  const clean = G.st - (G.lastHit || 0), tier = Math.min(5, Math.floor(clean / 60)); // tiered, repeatable once a streak is broken and rebuilt
  if (tier > (G.cleanTier || 0)) { G.cleanTier = tier; award('clean' + tier, true); }
}
// shotgun multi-kill: count kills inside one blast
{ const _attack = attack; attack = function () { const k0 = G ? G.kills : 0, w = G && G.weapon; _attack(); if (w === 'shotgun') { const k = G.kills - k0; if (k >= 3) award('shot3'); if (k >= 5) award('shot5'); if (k >= 8) award('shot8'); } }; }
// pickups + upgrades
{ const _pk = pickup; pickup = function (it) { const R = G && G.rs; if (R) { R.pickups++; if (it.kind === 'ammobox') R.boxes++; if ((it.kind === 'mg' || it.kind === 'shotgun') && (it.tier || 1) > (G.tier[it.kind] || 0) && G.tier[it.kind]) { R.upgrades++; R.lastUpT = G.st; } } _pk(it); }; }
function sfxAch() { tone(523, 523, 0.08, 'square', 0.07); tone(659, 659, 0.08, 'square', 0.07, 0.08); tone(784, 784, 0.1, 'square', 0.07, 0.16); tone(1046, 1046, 0.22, 'triangle', 0.08, 0.26); noise(0.05, 2600, 0.1, 3, 0.26); } // bok-bok-BOK fanfare
// the pop-up: cached card (gold title, 3px ink outline, hard ink offset shadow), punchy scale-in, top band so it never covers the hen
const _achImg = new Map();
function achCard(id) {
  let c = _achImg.get(id); if (c) return c; const [t1, t2] = achDef(id);
  const big = textImg(t1, 16, HGOLD, false), inkB = textImg(t1, 16, INK, false), sub = textImg(t2, 8, CREAM, true), lab = textImg(id.startsWith('up:') ? 'UPGRADE' : id.startsWith('drop:') ? 'NEW TIER' : 'ACHIEVEMENT', 8, INK, false);
  const w = Math.max(big.width + 10, sub.width + 8, 90), h = big.height + 30; let x; [c, x] = mk(w + 6, h + 6);
  // label tab
  x.fillStyle = INK; x.fillRect(Math.floor(w / 2 - lab.width / 2) - 4, 0, lab.width + 10, 12); x.fillStyle = HGOLD; x.fillRect(Math.floor(w / 2 - lab.width / 2) - 3, 1, lab.width + 6, 10); x.drawImage(lab, Math.floor(w / 2 - lab.width / 2), 1);
  const by = 13; // big text: hard offset shadow (+3,+3) then a 2px ink outline then gold
  for (let k = 1; k <= 4; k++) x.drawImage(inkB, 5 + k, by + k); // hard offset shadow
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (dx || dy) x.drawImage(inkB, 5 + dx, by + dy); // 2px ink outline
  x.drawImage(big, 5, by);
  x.drawImage(sub, Math.floor(w / 2 - sub.width / 2) + 1, by + big.height + 3);
  _achImg.set(id, c); return c;
}
// v23: timings back to v21 exactly (hold 2.6 s, backlog 1.6 s, in 0.22 s / out 0.25 s, no gap, 3+ queued merge); v22's raised position stays.
const ACH_TOP = 33; // the HUD's top row (life + timer panels and their shadows) ends at y = 32
// v25: a card holds 1.5 s on screen (0.22 s pop in + 0.25 s shrink out inside that), and a new card starts at most every 8 s
// (start to start). Achievements earned meanwhile wait; 2+ waiting when the slot opens become ONE card: the first one's name
// + '+N MORE'. Every one of them is saved and counts toward x/100 at the moment it's earned, shown or not.
const ACH_T = 1.5, ACH_EVERY = 8;
// v15 gun-tier pop-ups share the big gold card (not saved as trophies)
function upgradePop(k, t) { (G.achQ = G.achQ || []).push({ id: 'up:' + k + ':' + t, t: 0, isNew: false }); }
function tierDropPop(t) { (G.achQ = G.achQ || []).push({ id: 'drop:' + t, t: 0, isNew: false }); }
function drawAch(dt) {
  if (!G) return; G.achClk = (G.achClk || 0) + dt; // the card clock (runs while playing)
  const q = G.achQ; if (!q || !q.length) return;
  if (q[0].t === 0) { // waiting for the next slot
    if (G.achClk < (G.achNext || 0)) return;
    // v19 kept: a no-hit card isn't shown after a hit landed (it stays earned + counted, v25), so 'UNTOUCHED' never shows right after a hit
    for (let i = q.length - 1; i >= 0; i--) if (q[i].nohit && (G.hitN || 0) > q[i].hitN) { (G.achHidden = G.achHidden || []).push(q[i].id); q.splice(i, 1); }
    if (!q.length) return;
    if (q.length >= 2) { const names = q.map((x) => achDef(x.id)[0]), mid = 'multi:' + (++_multiN), isNew = q.some((x) => x.isNew);
      MULTI[mid] = [names[0], '+' + (names.length - 1) + ' MORE']; const ids = q.map((x) => x.id); q.length = 0; q.push({ id: mid, t: 0, isNew, multi: true, names, ids }); }
    G.achNext = G.achClk + ACH_EVERY; (G.achStarts = G.achStarts || []).push(+G.achClk.toFixed(2));
  }
  const a = q[0], AT = ACH_T;
  if (a.t === 0) { sfxAch(); flockPop(a.id); } a.t += dt;
  const c = achCard(a.id), e = Math.min(1, a.t / 0.22), s = a.t < 0.22 ? 0.3 + 0.95 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.18 : a.t > AT - 0.25 ? Math.max(0.05, (AT - a.t) / 0.25) : 1;
  const fit = Math.min(1, (N - 6) / c.width); // never wider than the screen
  const w = Math.round(c.width * s * fit), h = Math.round(c.height * s * fit), fh0 = Math.round(c.height * fit), cx = Math.round(N / 2), cy = Math.max(Math.round(N * 0.17), ACH_TOP + (fh0 >> 1)); // v22: higher (was 0.29 N), but never under the top HUD row; the hen is always at screen centre
  hx.drawImage(c, cx - (w >> 1), cy - (h >> 1), w, h);
  const fw = Math.round(c.width * fit), fh = Math.round(c.height * fit), steady = a.t > 0.25 && a.t < AT - 0.25;
  if (a.isNew && steady) text('NEW!', cx + (fw >> 1) - 12, cy + (fh >> 1) + 2, 8, HRED, 'center'); // v22: tags under the card (clear of the label tab + the HUD)
  if (a.t >= AT) G.achQ.shift();
}
// v16 no-hit streak meter (under the kill count): fills over each minute without a hit, one gold pip per minute banked
// (UNTOUCHED / FEATHERS INTACT / TEFLON HEN), flashes red and empties when a hit lands. Wordless.
function drawCleanMeter(t) {
  if (!G || G.state !== 'play') return; const clean = G.st - (G.lastHit || 0), tier = Math.min(5, Math.floor(clean / 60)), f = tier >= 5 ? 1 : (clean % 60) / 60;
  const x = 2, y = 44, w = 56; panel(x, y, w, 9); const hit = player.hurtT > 0;
  hx.fillStyle = hit ? HRED : tier ? HGOLD : '#9fb3a6'; hx.fillRect(x + 3, y + 2, 5, 3); hx.fillRect(x + 4, y + 5, 3, 1); hx.fillRect(x + 5, y + 6, 1, 1);
  hx.fillStyle = INK; hx.fillRect(x + 10, y + 3, 26, 3); hx.fillStyle = hit ? HRED : HGOLD; hx.fillRect(x + 10, y + 3, Math.round(26 * f), 3);
  for (let i = 0; i < 5; i++) { hx.fillStyle = i < tier ? HGOLD : 'rgba(9,11,10,.25)'; hx.fillRect(x + 39 + i * 3, y + 3, 2, 3); }
}
// ================================================================ v15 THE FLOCK: community hens (X pfps of people posting about hens.farm) cheer your achievements
// Data: flock/manifest.json {flock:[{handle,file,posted_about_url}]}. Remove a hen = delete its entry. ?flock=0 turns it off.
const FLOCK = [], _flockRecent = [], _flockDeck = [];
const FLOCK_LAYER = (() => { const st = document.getElementById('stage'); if (!st || /[?&]flock=0/.test(location.search)) return null; const L = document.createElement('div'); L.id = 'flockLayer'; st.appendChild(L); return L; })();
if (FLOCK_LAYER) fetch('flock/manifest.json?v=20').then((r) => r.json()).then((m) => { for (const f of (m.flock || [])) { if (!f.handle || !f.file) continue; const img = new Image(); img.src = 'flock/' + f.file + '?v=20'; FLOCK.push({ h: f.handle, src: img.src, img, w: 1 + Math.max(0, +f.hegg || 0), req: !!f.requested, lines: Array.isArray(f.lines) ? f.lines.filter((x) => typeof x === 'string' && x.includes('{h}')) : [] }); } FLOCK.sort((a, b) => b.w - a.w); _flockDeck.length = 0; flockCredits(); }).catch(() => {});
const FLOCK_LINES = { // {h} = @handle. "{h}: '...'" shows as a quote, anything else as a caption
  m1: ["{h}: 'one whole minute? i'd have laid an egg by now'", "{h} clocked it. 60 seconds of pure bok.", "{h}: 'still bokkin'. respect.'"],
  m2: ["{h}: 'hard-boiled. no notes.'", "{h} is already telling the whole coop", "{h}: 'two minutes and not a scratch on the vibe'"],
  m3: ["{h}: 'free range, full send'", "{h}: 'legend status. framing this.'", "{h} called their mom about you"],
  m4: ["{h} crowns you coop champion", "{h}: 'four minutes?! who raised you?'", "{h}: 'the farm has a new main character'"],
  m5: ["{h}: 'BILLIONS. MUST. BOK.'", "{h} just shed a single proud feather", "{h}: 'five minutes. i'm not crying, you're crying'"],
  mX: ["{h}: 'unpluckable. scientists baffled.'", "{h} has run out of clucks to give", "{h}: 'at this point the zombies are scared of YOU'"],
  k25: ["{h}: 'pecking order: established'", "{h}: '25? cute. keep going'", "{h} is keeping score. so far: you"],
  k50: ["{h}: 'fowl play detected'", "{h} counted all 50. twice.", "{h}: 'half a century of undead hens'"],
  k100: ["{h}: 'bok bok, that's a century'", "{h}: 'a hundred? the farm will remember this'", "{h} is ordering a trophy egg"],
  k250: ["{h}: 'it's officially a hen-demic'", "{h} is reporting you to the coop council (with pride)", "{h}: '250 and climbing. who IS she'"],
  k500: ["{h}: 'coop de grace. chef's kiss.'", "{h}: '500?! save some for the rest of us'", "{h} needs a bigger abacus"],
  k1000: ["{h}: 'KILLERGAINZ. say less.'", "{h} has never seen a number go this up", "{h}: 'one thousand. put her on the egg.'"],
  clean1: ["{h} has never seen a hen this clean", "{h}: 'not one feather out of place'", "{h}: 'untouched. unbothered. unpecked.'"],
  clean2: ["{h}: 'feathers intact. moisturized. thriving.'", "{h}: 'how are you THIS untouched?'", "{h} checked twice: zero scratches"],
  clean3: ["{h}: 'teflon hen. nothing sticks.'", "{h} is checking you for cheat codes", "{h}: 'three minutes clean? suspicious. iconic.'"],
  close: ["{h}: 'i had to look away'", "{h}: 'heart rate: 190 bpm'", "{h} is clutching their eggs", "{h}: 'that was TOO close. do it again'"],
  gun1: ["{h}: 'locked, loaded, bokked'", "{h}: 'oh she's armed now'", "{h} hears a safety click off"],
  mg: ["{h}: 'BRRRT-AWK! say it with me'", "{h} hears the belt feed and smiles", "{h}: 'the coop just got louder'"],
  spree: ["{h}: 'frenzy! someone stop her (don't)'", "{h} couldn't even count that fast", "{h}: 'ten in three? feathers everywhere'"],
  shot5: ["{h}: 'corn-splosion. five in one. art.'", "{h}: 'that's popcorn now'", "{h} felt that one from the next farm"],
  roostr: ["{h}: 'the roostr has been ROOSTED'", "{h}: 'big bird down'", "{h}: 'sleep tight, cock-a-doodle-don't'"],
  thrower: ["{h}: 'no more rotten eggs (for now)'", "{h}: 'return to sender'", "{h} catches the last egg. omelette."],
  up1: ["{h}: 'tier II? we're so back'", "{h} approves this glow-up"],
  gold: ["{h}: 'GOLDEN GUN. the hens.farm dream'", "{h} is blinded by the drip"],
  maxt: ["{h}: 'max tier. the farm fears you.'", "{h}: 'fully loaded. fully bokked.'"],
  up: ["{h}: 'upgrade secured. bok.'", "{h} approves this loadout", "{h}: 'shinier. louder. better.'"],
  drop: ["{h}: 'new guns just dropped'", "{h} spotted shiny crates", "{h}: 'the minute bell rang. tier up.'"],
  any: ["{h}: 'bok!'", "{h} is cheering from the coop", "{h}: 'put that one on the egg'", "{h}: 'the coop group chat is going OFF'", "{h}: 'certified bok moment'", "{h} saw that. everyone saw that.", "{h}: 'we are so back'", "{h}: 'screenshot this'"],
};
function flockLinesFor(id) { if (id.startsWith('up:')) return FLOCK_LINES.up; if (id.startsWith('drop:')) return FLOCK_LINES.drop; if (/^m\d+$/.test(id)) return FLOCK_LINES[id] || FLOCK_LINES.mX; return FLOCK_LINES[id] || FLOCK_LINES.any; }
const _lineLast = {};
// v19: a no-repeat DECK. Nobody repeats until everyone has appeared, so rapid/merged pop-ups still rotate faces.
// Order is weighted by $HEGG posting volume (w): big posters come early; the user-requested hens are dealt first.
function flockDeal(first) {
  const key = (f) => Math.pow(Math.random(), 1 / f.w); // Efraimidis-Spirakis weighted shuffle
  let rest = FLOCK.map((f) => [key(f), f]).sort((x, y) => y[0] - x[0]).map((x) => x[1]);
  if (first) { const req = rest.filter((f) => f.req); for (let i = req.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [req[i], req[j]] = [req[j], req[i]]; }
    rest = rest.filter((f) => !f.req); // requested hens at slots 0,2,4,6 (a big poster in between)
    const out = []; while (req.length || rest.length) { if (req.length && (out.length % 2 === 0 || !rest.length)) out.push(req.shift()); else out.push(rest.shift()); } rest = out; }
  else rest = rest.filter((f) => !_flockRecent.includes(f.h)).concat(rest.filter((f) => _flockRecent.includes(f.h))); // no back-to-back across decks
  _flockDeck.push(...rest); }
function flockNewRun() { _flockDeck.length = 0; flockDeal(true); }
function flockPick(n = 1) {
  const out = [];
  while (out.length < Math.min(n, FLOCK.length)) { if (!_flockDeck.length) flockDeal(!_flockRecent.length); const f = _flockDeck.shift(); if (!out.includes(f)) out.push(f); }
  for (const f of out) { _flockRecent.push(f.h); if (_flockRecent.length > Math.min(5, Math.max(0, FLOCK.length - 2))) _flockRecent.shift(); }
  return out; }
const _esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// v24: the quote band sits in the bottom-right corner at 70% size. Its left edge clears the gun/ammo panel (bottom-left, width depends
// on the gun name): 65.8% wide (70% of v23's 94%) when that fits, narrower otherwise (the quote auto-fits). While the player hen is
// under the band or its pfp, the band fades to 35% instead of moving.
const FK_W = 0.658;
function flockPlace(el) { const w = WEAPONS[G && G.weapon] || { name: 'PECK' }, ww = Math.max(74, 22 + w.name.length * 6), hudR = (2 + ww + 2 + 3) / N; // panel + ink shadow + 3 px air
  const left = Math.max(hudR, 1 - 0.012 - FK_W); el.style.left = (left * 100).toFixed(2) + '%'; }
function flockGhost() { const el = _flockPopEl; if (!el || !el.parentNode || !player) return; const c = document.getElementById('c'), cb = c && c.getBoundingClientRect(); if (!cb || !cb.width) return;
  const k = N / cb.width, img = el.querySelector('img'), rs = [el.getBoundingClientRect(), img && img.getBoundingClientRect()].filter(Boolean);
  const [sx, sy] = w2s(player.x, player.y), px0 = sx - 12, px1 = sx + 12, py0 = sy - 32 - Math.round(player.jz || 0), py1 = sy + 3;
  const hit = rs.some((r) => { const x0 = (r.left - cb.left) * k, x1 = (r.right - cb.left) * k, y0 = (r.top - cb.top) * k, y1 = (r.bottom - cb.top) * k; return px1 > x0 && px0 < x1 && py1 > y0 && py0 < y1; });
  el.classList.toggle('fk-ghost', hit); }
function flockFont() { if (!FLOCK_LAYER) return; const w = FLOCK_LAYER.offsetWidth || 256; /* layout px: the shell scales the screen with a CSS transform */ FLOCK_LAYER.style.fontSize = (w / 256 * 7.4).toFixed(2) + 'px'; }
let _flockPopEl = null, _flockSide = 0;
function flockPop(id) {
  if (!FLOCK_LAYER || !FLOCK.length) return; const [f] = flockPick(1); if (!f) return;
  const lines = f.lines && f.lines.length && Math.random() < 0.5 ? f.lines : flockLinesFor(id); let k = Math.floor(Math.random() * lines.length); if (lines.length > 1 && k === _lineLast[id]) k = (k + 1) % lines.length; _lineLast[id] = k;
  const raw = lines[k], quote = raw.startsWith('{h}: '), body = quote ? '\u201c' + raw.slice(5).replace(/^'|'$/g, '') + '\u201d' : raw.replace('{h} ', '');
  // slide in from the edge the hen is NOT aiming at (she always sits at screen centre, the card stays in the side gutter)
  const side = 'bottom'; _flockSide++; // v18: big card in the bottom band (the hen is always at screen centre; the gold title is in the top band)
  try { const seen = new Set(JSON.parse(localStorage.getItem('lasttower.flockseen') || '[]')); seen.add(f.h); localStorage.setItem('lasttower.flockseen', JSON.stringify([...seen])); if (FLOCK.length >= 10 && FLOCK.every((x) => seen.has(x.h))) achEvent('flock'); } catch (e) {}
  flockFont(); if (_flockPopEl) _flockPopEl.remove();
  const el = document.createElement('div'); el.className = 'fk-pop fk-' + side;
  el.innerHTML = `<img src="${_esc(f.src)}" alt=""><div class="fk-txt"><b>@${_esc(f.h)}</b><span>${_esc(body)}</span></div>`;
  FLOCK_LAYER.appendChild(el); flockPlace(el); _flockPopEl = el; setTimeout(() => { if (el.parentNode) el.remove(); if (_flockPopEl === el) _flockPopEl = null; }, 2000);
  { const tx = el.querySelector('.fk-txt'), sp = el.querySelector('.fk-txt span'); for (let z = 3.2; z >= 1.5; z -= 0.1) { sp.style.fontSize = z.toFixed(1) + 'em'; if (tx.scrollHeight <= tx.clientHeight + 1 && tx.scrollWidth <= tx.clientWidth + 1) break; } } // v19: biggest quote that fits the slim band
}
// death screen: 2-3 cheering hens ("the flock salutes you"), placed in canvas coords
let _salute = null;
function flockSalute(on, x, y, size) {
  if (!FLOCK_LAYER) return;
  if (!on) { if (_salute) { _salute.el.remove(); _salute = null; } return; }
  if (_salute && _salute.g === G) return; if (!FLOCK.length) return; if (_salute) _salute.el.remove();
  const n = Math.min(3, FLOCK.length), hens = flockPick(n), el = document.createElement('div'); el.className = 'fk-salute';
  el.style.left = (x / N * 100) + '%'; el.style.top = (y / N * 100) + '%'; el.style.height = (size / N * 100) + '%'; flockFont();
  el.innerHTML = hens.map((f, i) => `<i style="animation-delay:${i * 0.12}s"><img src="${_esc(f.src)}" alt=""><b>@${_esc(f.h)}</b></i>`).join('');
  FLOCK_LAYER.appendChild(el); _salute = { el, g: G };
}
// credits ticker on the title screen
let _cred = null;
function flockCredits() { if (!FLOCK_LAYER || !FLOCK.length || _cred) return; _cred = document.createElement('div'); _cred.className = 'fk-cred';
  const s = 'THE FLOCK: ' + FLOCK.map((f) => '@' + _esc(f.h)).join('  \u00b7  ') + '  \u00b7  '; _cred.innerHTML = `<span>${s}${s}</span>`; FLOCK_LAYER.appendChild(_cred); }
setInterval(() => { if (_cred) _cred.style.display = STATE === 'title' ? 'block' : 'none'; if (STATE !== 'game' || !G || G.state !== 'dead') flockSalute(false); }, 150);
addEventListener('resize', flockFont);
// ================================================================ v16 death = ending credits + THE GLOBAL TOP 20 FLOCK + arcade name entry (v17: blank, must be filled)
// Death screen is a movie-credits roll (rises bottom -> top, loops): PLUCKED + stats, the run's achievements as a cast list
// (big gold title + "...... @hen" with her pfp), the TOP 20 FLOCK leaderboard, then THE FLOCK credits.
// Shoot (stick / arrows / Space / screen tap) restarts at any moment. D-pad / WASD edits the name bar (dice = random chikn name).
// Leaderboard: the shared membersonly.cc API (server/src/leaderboard.js, game "last-tower": survival time measured by the
// server, capped by the run clock, ties by kills, best per player, top 20). No API -> a local top 20 on this device.
const LB_GAME = 'last-tower', NAME_KEY = 'lasttower.name2', LOCAL_LB_KEY = 'lasttower.lb1';
const validName = (s) => typeof s === 'string' && /^[A-Z0-9_.\-]{0,12}$/.test(s) && (s === '' || /[A-Z0-9]/.test(s)); // v19: blank, or 1-12 of A-Z 0-9 - _ .
const BLANK_NAME = 'ANON HEN'; // v19: a blank name shows (and posts) as this; the server maps a blank post to the same (games.json blankName)
const showName = (s) => (s ? s : BLANK_NAME);
let lbName = null; try { const s = localStorage.getItem(NAME_KEY); if (s !== null && validName(s)) lbName = s; localStorage.removeItem('lasttower.name'); } catch (e) {} // v17: v16's auto-assigned names (old key) are dropped, so everyone picks their own
const saveName = (s) => { lbName = s; try { localStorage.setItem(NAME_KEY, s); } catch (e) {} };
const MA = () => (window.MembersAuth && window.MembersAuth.available ? window.MembersAuth : null);
// ---- one record per run: play id (server), death result, board
let RUN = null;
function lbRunStart() { // called by newGame
  const r = { g: G, play: null, board: null, posted: false, posting: false, local: false, st: 0, kills: 0, done: false, entry: null };
  RUN = r; const A = window.MembersAuth;
  if (A && A.ready) A.ready.then(() => (A.available ? A.startPlay(LB_GAME) : null)).then((id) => { r.play = id || null; }).catch(() => {});
}
// ---- v22 board seasons: the API serves a season id with every board; an admin reset bumps it. A device that last saw an
// older season starts fresh: no remembered name (blank name grid), no achievements / lifetime stats, an empty device board.
const SEASON_KEY = 'lasttower.season';
const SEASON = { seen: null, wiped: null };
function seasonWipe() { lbName = null; ACH_UNLOCKED = {}; for (const k in LIFE) LIFE[k] = 0; best = { time: 0, kills: 0, days: 0 };
  for (const k of [NAME_KEY, ACH_KEY, LIFE_KEY, LOCAL_LB_KEY, BEST_KEY, 'lasttower.flockseen']) { try { localStorage.removeItem(k); } catch (e) {} } }
function seasonCheck(s) { if (!Number.isSafeInteger(s) || s < 1) return; SEASON.seen = s; let had = null; try { had = localStorage.getItem(SEASON_KEY); } catch (e) {}
  const h = had === null ? 1 : Number(had); if (h !== s) { seasonWipe(); SEASON.wiped = s; } try { localStorage.setItem(SEASON_KEY, String(s)); } catch (e) {} }
// v25: the same page-load GET (and one per power-on) also feeds the intro's TOP 10 scroll (ILB). Read-only, never starts a play.
const ILB = { rows: null, pend: false, show: null, x0: null };
function ilbFetch() { const A = window.MembersAuth; if (!A || !A.ready || ILB.pend) return; ILB.pend = true;
  A.ready.then(() => (A.available ? A.leaderboard(LB_GAME) : null)).then((b) => { ILB.pend = false; if (!b || b.status !== 200 || !b.json) return; seasonCheck(b.json.season);
    if (Array.isArray(b.json.top)) ILB.rows = b.json.top.slice(0, 10).map((e) => ({ rank: e.rank | 0, name: String(e.name || '').toUpperCase().replace(/&AMP;/g, '&').replace(/[^A-Z0-9_.\- ]/g, '').slice(0, 12) || BLANK_NAME, ms: Math.max(0, e.ms | 0) })); }).catch(() => { ILB.pend = false; }); }
ilbFetch();
function localBoard() { let l = []; try { l = JSON.parse(localStorage.getItem(LOCAL_LB_KEY)) || []; } catch (e) {} return Array.isArray(l) ? l : []; }
function lbRunEnd() { // called by die()
  const r = RUN; if (!r || r.g !== G || r.done) return; r.done = true; r.st = G.st; r.kills = G.kills; r.ms = Math.round(G.st * 1000);
  const A = MA(), fallback = () => { if (r.local) return; r.local = true; const l = localBoard(), me = { name: lbName === null ? '???' : showName(lbName), ms: r.ms, kills: r.kills, t: Date.now() };
    if (r.ms >= 5000) l.push(me); l.sort((a, b) => b.ms - a.ms || b.kills - a.kills); const top = l.slice(0, 20); try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(top)); } catch (e) {}
    r.localMe = me; r.board = { local: true, total: l.length, top: top.map((e, i) => ({ rank: i + 1, name: e.name, ms: e.ms, kills: e.kills, mine: e === me })) }; r.posted = true; if (top.includes(me)) achEvent('top20'); };
  if (!A || !r.play) { fallback(); return; }
  A.endPlay(r.play, { outcome: 'died', score: r.kills, meta: { ms: r.ms, mg: G.tier.mg || 0, sg: G.tier.shotgun || 0, ach: achCount() } })
    .then((p) => (p ? A.leaderboard(LB_GAME) : null))
    .then((b) => { if (!b || b.status !== 200 || !b.json) { fallback(); return; } seasonCheck(b.json.season); r.board = b.json;
      const me = b.json.me; r.wantPost = r.ms >= 5000 && (!me || r.ms > me.ms || (r.ms - (r.ms % 100) === me.ms && r.kills > me.kills)); if (!r.wantPost) r.posted = true; else if (r.postOnReady) lbPost(r); })
    .catch(fallback);
}
function lbPost(r, onRestart) { // post this run under the current name (on restart, or once the board scrolls into view)
  if (r && onRestart) r.postOnReady = true;
  if (!r || r.posted || r.posting || !r.board || r.local || lbName === null) return; const A = MA(); if (!A) return; r.posting = true;
  const name = showName(lbName); A.postLeaderboard(LB_GAME, r.play, name).then((res) => { r.posting = false;
    if (res.status === 201 && res.json) { r.posted = true; r.board = res.json; r.entry = res.json.entry; if (r.entry && r.entry.rank <= 20) achEvent('top20'); return; }
    const err = res.json && res.json.error; if (err === 'name_not_allowed' || err === 'bad_name') { lbName = null; try { localStorage.removeItem(NAME_KEY); } catch (e) {} if (G === r.g && G.state === 'dead') nameOpen('death'); return; } // refused: ask again
    r.posted = true; r.err = err || 'offline'; }).catch(() => { r.posting = false; r.posted = true; });
}
// ---- v18 name entry: a full alphabet grid on the first death (or whenever no name is saved), BEFORE the credits roll.
// A-Z, 0-9, - _ . + DEL + OK. D-pad moves the gold cursor, shoot presses the key under it; on phones just tap a key.
// v19: 0-12 characters, blank at the start; OK is lit right away (blank = ANON HEN). It only greys for a typed name the
// board won't take (no letter/digit, or the same blocklist as the server). Credits + restart wait for it; shoot never restarts from here. A keyboard can type, Backspace, Enter.
// Change it later: tap your gold row on the TOP 20 (or the "YOU: #n" line).
const NE = { on: false, name: '', cur: 0, blink: 0, shake: 0, keys: null, from: null };
const NE_MAX = 12, NE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.';
const NE_GRID = (() => { const k = []; for (let i = 0; i < 36; i++) k.push({ ch: NE_CHARS[i], r: Math.floor(i / 9), c: i % 9, w: 1 });
  k.push({ ch: '-', r: 4, c: 0, w: 1 }, { ch: '_', r: 4, c: 1, w: 1 }, { ch: '.', r: 4, c: 2, w: 1 }, { ch: 'DEL', r: 4, c: 3, w: 3 }, { ch: 'OK', r: 4, c: 6, w: 3 }); return k; })();
// mirror of server/src/names.js isBlocked (leet + squash + collapse), so OK only lights for names the board will take
const NB_ANY = ['fuck', 'fuk', 'fck', 'shit', 'cunt', 'nigg', 'faggot', 'fag', 'kike', 'retard', 'whore', 'slut', 'bitch', 'pussy', 'penis', 'vagina', 'porn', 'nazi', 'hitler', 'kkk', 'tranny', 'dyke', 'wank', 'twat', 'bastard',
  'asshole', 'jizz', 'dildo', 'blowjob', 'handjob', 'molest', 'cocksuck', 'motherf', 'beaner', 'wetback', 'raghead', 'towelhead', 'semen', 'boner', 'clit', 'heil'];
const NB_WORD = new Set(['rape', 'rapist', 'cum', 'ass', 'arse', 'tit', 'tits', 'dick', 'cock', 'spic', 'chink', 'coon', 'gook', 'homo', 'hoe', 'pedo', 'paki', 'jap', 'negro', 'sex', 'anal', 'nig', 'nigs', 'lesbo', 'kys']);
const NB_LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };
function nameBlocked(s) { const l = s.toLowerCase().replace(/[0-9]/g, (d) => NB_LEET[d] || d), sq = l.replace(/[^a-z]/g, ''), col = (x) => x.replace(/(.)\1+/g, '$1');
  if ([sq, col(sq)].some((f) => NB_ANY.some((w) => f.includes(w)))) return true; const words = l.split(/[^a-z]+/).filter(Boolean); return words.some((w) => NB_WORD.has(w) || NB_WORD.has(col(w))) || NB_WORD.has(sq); }
const neName = () => NE.name;
const neValid = () => NE.name === '' || (validName(NE.name) && !nameBlocked(NE.name));
function nameOpen(from) { NE.on = true; NE.from = from || 'death'; NE.name = from === 'change' && lbName ? lbName : ''; NE.cur = 0; NE.blink = 0; }
function nameConfirm() {
  if (!neValid()) { NE.shake = 0.3; sfx('zpeck'); return; }
  const s = NE.name, sn = showName(s); saveName(s); NE.on = false; if (!uiSnd('select')) sfx('pick'); if (s) achEvent('name'); const r = RUN && RUN.g === G ? RUN : null;
  if (r) { if (r.local && r.localMe) { r.localMe.name = sn; r.board.top.forEach((e) => { if (e.mine) e.name = sn; }); try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(localBoard().map((e) => (e.t === r.localMe.t ? Object.assign(e, { name: sn }) : e)))); } catch (e) {} }
    else if (!r.posted) lbPost(r, true); }
  if (NE.from === 'death') CR.t = 0; // the high scores roll starts now
}
function neType(ch) { NE.blink = 0; if (ch === '<' || ch === 'DEL') { NE.name = NE.name.slice(0, -1); if (!uiSnd('cursor', 0.8)) sfx('click'); return; } if (ch === 'OK') { nameConfirm(); return; }
  if (NE.name.length >= NE_MAX) { NE.shake = 0.2; sfx('zpeck'); return; } NE.name += ch; if (!uiSnd('slam', 1.15, 0.7)) sfx('click'); }
function nameSelect() { neType(NE_GRID[NE.cur].ch); } // shoot = press the key under the cursor
function nameNav(dir) { NE.blink = 0; if (!uiSnd('cursor')) sfx('click'); const k = NE_GRID[NE.cur];
  if (dir === 'left' || dir === 'right') { const row = NE_GRID.map((q, i) => [q, i]).filter(([q]) => q.r === k.r), j = row.findIndex(([, i]) => i === NE.cur); NE.cur = row[(j + (dir === 'right' ? 1 : row.length - 1)) % row.length][1]; return; }
  const r = (k.r + (dir === 'down' ? 1 : 4)) % 5, mid = k.c + (k.w - 1) / 2; NE.cur = NE_GRID.findIndex((q) => q.r === r && mid >= q.c - 0.01 && mid < q.c + q.w); }
const nameEntryOn = () => NE.on && STATE === 'game' && G && G.state === 'dead';
function stageTap(e) {
  if (!(STATE === 'game' && G && G.state === 'dead')) return false; const c = document.getElementById('c'), b = c.getBoundingClientRect(); if (!b.width) return false;
  const x = (e.clientX - b.left) / b.width * N, y = (e.clientY - b.top) / b.height * N, inR = (q) => q && x >= q[0] && x < q[0] + q[2] && y >= q[1] && y < q[1] + q[3];
  if (NE.on) { audioInit(); const i = NE.keys ? NE.keys.findIndex((q) => inR(q)) : -1; if (i >= 0) { NE.cur = i; neType(NE_GRID[i].ch); } return true; } // never restarts from the name grid
  if (TC.on) { audioInit(); const i = TC.btns ? TC.btns.findIndex((q) => inR(q)) : -1; if (i >= 0 && T0 - TC.openAt > 0.35) { TC.cur = i; tcPress(i); } return true; } // v22: taps only hit the card buttons
  if (CR.mineR && inR(CR.mineR) && G.deadT > 0.25) { nameOpen('change'); return true; }
  return false;
}
function drawNameEntry(t, dt) {
  NE.blink += dt; NE.shake = Math.max(0, NE.shake - dt);
  hx.fillStyle = 'rgba(9,11,10,.18)'; hx.fillRect(0, 0, N, N); // bright: the farm stays visible
  const pw = Math.min(N - 6, 248), px = Math.round(N / 2 - pw / 2) + (NE.shake > 0 ? Math.round(Math.sin(NE.shake * 60) * 3) : 0), py = Math.round(N * 0.05), ph = Math.min(N - py - 4, 236);
  panel(px, py, pw, ph); hx.fillStyle = HGOLD; hx.fillRect(px + 1, py + 1, pw - 2, 3);
  // header: the plucked hen + this run, no instructions
  if (artOk('hen-plucked')) hx.drawImage(ART['hen-plucked'], 0, 0, 50, 53, px + 4, py + 5, 30, 32);
  text('PLUCKED', px + 40, py + 7, 16, HRED, 'left'); inkText(fmtTime(G.st) + '  /  ' + G.kills, px + 40, py + 27, INK);
  // name slots (12)
  const sw = Math.min(19, Math.floor((pw - 12) / NE_MAX)), sx = Math.round(px + pw / 2 - (sw * NE_MAX) / 2), sy = py + 44;
  for (let i = 0; i < NE_MAX; i++) { const x = sx + i * sw, ch = NE.name[i], here = i === NE.name.length;
    hx.fillStyle = 'rgba(9,11,10,.07)'; hx.fillRect(x + 1, sy, sw - 2, 22);
    if (ch) text(ch, x + sw / 2, sy + 2, 16, INK, 'center', false);
    else if (!NE.name && BLANK_NAME[i] && BLANK_NAME[i] !== ' ') text(BLANK_NAME[i], x + sw / 2, sy + 2, 16, 'rgba(9,11,10,.2)', 'center', false); // v19: faint ANON HEN = what a blank name shows as
    hx.fillStyle = here ? (Math.floor(NE.blink * 3) % 2 ? 'rgba(255,196,47,.3)' : '#d99a00') : 'rgba(9,11,10,.3)'; hx.fillRect(x + 2, sy + 21, sw - 4, 2); }
  // the grid
  const ok = neValid(), cw = Math.floor((pw - 8) / 9), ch = Math.min(24, Math.floor((py + ph - (sy + 32) - 6) / 5) - 2), gx = Math.round(px + pw / 2 - (cw * 9) / 2), gy = sy + 32; NE.keys = [];
  NE_GRID.forEach((k, i) => { const x = gx + k.c * cw, y = gy + k.r * (ch + 2), w = cw * k.w - 2, sel = i === NE.cur; NE.keys.push([x, y, w, ch]);
    const isOk = k.ch === 'OK', isDel = k.ch === 'DEL', dis = isOk && !ok;
    hx.fillStyle = sel ? HGOLD : isOk ? (ok ? HGREEN : '#d9d4c3') : isDel ? '#ffd3d8' : '#ffffff'; hx.fillRect(x, y, w, ch);
    hx.fillStyle = INK; hx.fillRect(x, y + ch - 2, w, 2); hx.fillRect(x, y, w, 1); hx.fillRect(x, y, 1, ch); hx.fillRect(x + w - 1, y, 1, ch);
    if (sel) { hx.fillStyle = INK; hx.fillRect(x - 1, y - 1, w + 2, 1); hx.fillRect(x - 1, y + ch, w + 2, 1); hx.fillRect(x - 1, y - 1, 1, ch + 2); hx.fillRect(x + w, y - 1, 1, ch + 2); }
    const col = dis ? 'rgba(9,11,10,.35)' : INK, ty = y + Math.round(ch / 2) - 5;
    if (isOk) { text('OK', x + w / 2 + 5, ty, 8, col, 'center', false); hx.fillStyle = col; for (const [a, b2] of [[0, 3], [1, 4], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [7, 0]]) hx.fillRect(x + w / 2 - 18 + a, ty + 2 + b2, 2, 2); }
    else if (isDel) { hx.fillStyle = INK; for (let q = 0; q < 4; q++) hx.fillRect(x + w / 2 - 22 + q, ty + 4 - q, 1, 1 + q * 2); hx.fillRect(x + w / 2 - 18, ty + 2, 5, 5); text('DEL', x + w / 2 + 5, ty, 8, INK, 'center', false); }
    else text(k.ch, x + w / 2, ty, 8, col, 'center', false); });
}
// ---- the credits roll
const CR = { g: null, rows: null, H: 0, t: 0 };
const CW = (s, sz) => textImg(String(s), sz, '#fff', false).width;
function pfp(f, x, y, s) { if (!f || !f.img || !f.img.complete || !f.img.naturalWidth) return; hx.fillStyle = INK; hx.fillRect(x - 1, y - 1, s + 2, s + 2); hx.drawImage(f.img, x, y, s, s); }
function bigGold(s, x, y, maxW) { const sz = CW(s, 16) <= maxW ? 16 : 8, img = textImg(s, sz, HGOLD, false), ink = textImg(s, sz, INK, false), dx = Math.round(x - img.width / 2);
  for (let k = 1; k <= (sz > 8 ? 3 : 1); k++) hx.drawImage(ink, dx + k, y + k); for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) hx.drawImage(ink, dx + a, y + b); hx.drawImage(img, dx, y); return sz; }
const fmtMs = (ms) => { const s = ms / 1000; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + Math.floor((ms % 1000) / 100); };
function buildCredits() {
  const rows = [], add = (h, draw, mark) => rows.push({ h, draw, mark }), W = N - 10, r = RUN && RUN.g === G ? RUN : null;
  const hens = FLOCK.length ? flockPick(Math.min(FLOCK.length, 3)) : [];
  // v19: a SHORT intro (no hen picture, no cause, no weapons), so the TOP 20 arrives fast
  add(22, (y) => { bigGold('PLUCKED', N / 2, y, W); });
  add(20, (y) => { text('LASTED ' + fmtTime(G.st), N / 2, y, 16, '#ffffff', 'center'); });
  add(12, (y) => { const s = 'PECKED ' + G.kills + '   ' + (G.newBest ? 'NEW BEST!' : 'BEST ' + fmtTime(best.time)), w = CW(s, 8); hx.drawImage(ICONS.skull, Math.round(N / 2 - w / 2 - 10), y + 1); text(s, N / 2, y, 8, G.newBest ? HGOLD : CREAM, 'center'); });
  add(14, (y) => { const n = new Set(G.achList || []).size; text('ACHIEVEMENTS ' + achCount() + '/' + ACH_TOTAL + (n ? '   +' + n : ''), N / 2, y + 2, 8, HGOLD, 'center'); }, 'ach');
  add(12, () => {});
  // 3. TOP 20 FLOCK
  add(24, (y) => bigGold('TOP 20 FLOCK', N / 2, y, W), 'board');
  add(14, (y) => { const b = r && r.board; text(!b ? 'CALLING THE COOP...' : b.local ? 'THIS DEVICE (OFFLINE)' : 'WORLDWIDE  /  ' + (b.total || 0) + ' HENS', N / 2, y, 8, CREAM, 'center'); });
  const bw = Math.min(N - 12, 220), bx = Math.round(N / 2 - bw / 2);
  for (let i = 0; i < 20; i++) add(11, (y) => { const b = r && r.board, e = b && b.top && b.top[i];
    const mine = e && e.mine, col = mine ? INK : i < 3 ? HGOLD : CREAM;
    if (mine) { hx.fillStyle = HGOLD; hx.fillRect(bx - 2, y - 1, bw + 4, 11); CR.mineR = [bx - 2, y - 3, bw + 4, 15]; } // tap = change name
    text(String(i + 1), bx + 14, y, 8, col, 'right', !mine);
    if (e) { text(e.name, bx + 22, y, 8, col, 'left', !mine); text(fmtMs(e.ms), bx + bw - 34, y, 8, col, 'right', !mine); text(String(e.kills), bx + bw, y, 8, mine ? INK : HRED, 'right', !mine); }
    else text('- - - - - -', bx + 22, y, 8, 'rgba(248,245,233,.3)', 'left', false); });
  add(14, (y) => { const b = r && r.board; if (!b || b.local) return; const me = b.me, onTop = b.top && b.top.some((e) => e.mine);
    if (me && !onTop) CR.mineR = [0, y - 2, N, 14];
    if (me && !onTop) text('YOU: #' + me.rank + '  ' + me.name + '  ' + fmtMs(me.ms), N / 2, y + 2, 8, HGOLD, 'center');
    else if (r.posting || (!r.posted && r.wantPost)) text('POSTING ' + showName(lbName), N / 2, y + 2, 8, CREAM, 'center'); });
  add(30, () => {});
  // 4. v19: the community, at the very end: the flock salutes you, then THE FLOCK credits, then the last line
  if (hens.length) { const sal = hens.slice(0, 3); add(12, (y) => text('THE FLOCK SALUTES YOU', N / 2, y, 8, HGOLD, 'center'));
    add(30, (y) => sal.forEach((f, i) => { const x = Math.round(N / 2 + (i - (sal.length - 1) / 2) * 30 - 10), b = Math.round(Math.abs(Math.sin(CR.t * 5 + i * 1.3)) * -3); pfp(f, x, y + 2 + b, 20); })); add(16, () => {}); }
  if (FLOCK.length) { add(24, (y) => bigGold('THE FLOCK', N / 2, y, W)); add(14, (y) => text('COMMUNITY HENS OF HENS.FARM', N / 2, y, 8, CREAM, 'center'));
    for (let i = 0; i < FLOCK.length; i += 2) { const a = FLOCK[i], b = FLOCK[i + 1];
      add(20, (y) => { for (const [f, cx] of [[a, N * 0.27], [b, N * 0.73]]) if (f) { pfp(f, Math.round(cx - 7), y, 14); text('@' + f.h.toUpperCase(), cx, y + 15, 8, CREAM, 'center'); } });
      add(4, () => {}); } }
  add(30, () => {});
  add(24, (y) => bigGold('BILLIONS MUST BOK.', N / 2, y, W));
  { const c = (y, m) => text(m, N / 2, y, 8, 'rgba(248,245,233,.6)', 'center', false), src = typeof ANN !== 'undefined' ? Object.values(ANN.src) : []; // v21 real-audio credits
    add(10, () => {}); add(10, (y) => c(y, 'REAL GAME AUDIO, USED UNDER PARODY LICENSE:'));
    if (src.includes('halo')) add(10, (y) => c(y, 'HALO: REACH ANNOUNCER (C) MICROSOFT / BUNGIE'));
    if (src.includes('ut')) add(10, (y) => c(y, 'UNREAL TOURNAMENT ANNOUNCER (C) EPIC GAMES'));
    if (src.includes('sf2')) add(10, (y) => c(y, 'STREET FIGHTER II SOUNDS (C) CAPCOM')); }
  add(Math.round(N * 0.45), () => {});
  CR.rows = rows; CR.H = rows.reduce((a, r) => a + r.h, 0); CR.g = G; CR.t = 0; CR.n = N;
}
function drawCredits(t, dt) {
  if (CR.g !== G || CR.n !== N || (CR.flockN !== FLOCK.length)) { buildCredits(); CR.flockN = FLOCK.length; }
  G.deadT = (G.deadT || 0) + dt; if (CR.askG !== G) { CR.askG = G; if (lbName === null) nameOpen('death'); }
  if (NE.on) { drawNameEntry(t, dt); return; } // the roll waits for a name
  if (TC.g !== G && G.deadT > 0.7) tcOpen(); // v22: the TIME CARD, once per death, after the name
  if (TC.on) { drawTimeCard(t, dt); return; }
  CR.t += dt; CR.mineR = null;
  hx.fillStyle = `rgba(9,11,10,${Math.min(0.42, 0.1 + G.deadT * 0.6)})`; hx.fillRect(0, 0, N, N); // v18: no going dark, the farm stays bright
  const sp = N / 256 * 19, L = CR.H + N, pos = (CR.t * sp + N * 0.42) % L; let y = Math.round(N - pos);
  const r = RUN && RUN.g === G ? RUN : null; let boardY = null;
  for (const row of CR.rows) { if (y + row.h > -4 && y < N) row.draw(y); if (row.mark === 'board') boardY = y; y += row.h; }
  if (r && boardY !== null && boardY < N * 0.9) lbPost(r); if (r && G.deadT > 14) lbPost(r);
  // soft top/bottom fades so lines appear and disappear like a film roll
  for (let i = 0; i < 14; i++) { hx.fillStyle = `rgba(9,11,10,${0.3 * (1 - i / 14)})`; hx.fillRect(0, i, N, 1); hx.fillRect(0, N - 1 - i, N, 1); }
}
function creditsRestart() { const r = RUN; if (r && r.g === G) lbPost(r, true); newGame(); sfx('dawn'); }
// ================================================================ v22 TIME CARD: a shareable 1200x675 card right after the run
// (after the name grid, once the rank is known). sharecard.js draws it, the same file the server uses for a share link's
// og:image. Buttons: CONTINUE (default focus: a plain shoot goes on to the credits), SHARE ON X, SAVE IMAGE. D-pad moves the
// focus, shoot presses it; on phones tap a button. Share: Web Share with the PNG when the device can share files, else the
// X post intent; the text links the server share page (/plays/s/<id>, og:image = this card) when the run is on the board.
const TC = { on: false, g: null, cur: 0, openAt: 0, closeAt: -9, key: '', cv: null, blob: null, file: null, link: null, linking: false, btns: null, msg: '', msgT: 0, pend: null };
const TC_PLAY = 'https://membersonly.cc/zombie-farm/';
function tcOpen() { Object.assign(TC, { on: true, g: G, cur: 0, openAt: T0, key: '', blob: null, file: null, link: null, linking: false, btns: null, msg: '', msgT: 0, pend: null });
  const r = RUN && RUN.g === G ? RUN : null; if (r) lbPost(r); uiSnd('select'); }
function tcClose() { TC.on = false; TC.closeAt = T0; CR.t = 0; } // the credits roll starts now
function tcStats() { // what the card shows for this run; pending until the board answers (max ~6 s, then OFFLINE)
  const r = RUN && RUN.g === G ? RUN : null, ms = Math.round(G.st * 1000), o = { name: showName(lbName || ''), ms, kills: G.kills, ach: achCount(), achMax: ACH_TOTAL };
  const late = T0 - TC.openAt > 6;
  if (!r || r.local || (r.board && r.board.local)) { o.offline = true; return o; }
  if (r.entry) { o.rank = r.entry.rank; o.total = r.board && r.board.total; return o; }
  if (r.posted && r.board && !r.local) { const me = r.board.me; if (me && !r.err) { o.rank = me.rank; o.total = r.board.total; o.rankLabel = 'YOUR BEST'; return o; } o.offline = true; o.rankText = r.ms < 5000 ? 'UNRANKED' : 'OFFLINE'; return o; }
  if (late) { o.offline = true; return o; }
  o.pending = true; return o;
}
function tcFmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function tcText(o) { return 'I survived ' + tcFmt(o.ms) + ' on ZOMBIE FARM' + (o.rank && !o.rankLabel ? ' and ranked #' + o.rank : '') + ' \u{1F414}\u{1F9DF} Billions must bok. Can you beat me?'; }
function tcRender(o) { // (re)draw the card when what it shows changes; the PNG blob/File is prepared ahead so a share runs inside the tap
  const key = JSON.stringify(o); if (key === TC.key && TC.cv) return; TC.key = key; const Z = window.ZFCard; if (!Z) return;
  const img = Z.render(o); let cv = TC.cv; if (!cv) { cv = TC.cv = document.createElement('canvas'); cv.width = img.w; cv.height = img.h; }
  cv.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0); TC.blob = null; TC.file = null;
  if (!o.pending) { const k = key; cv.toBlob((b) => { if (!b || TC.key !== k) return; TC.blob = b; try { TC.file = new File([b], 'zombie-farm-' + tcFmt(o.ms).replace(':', 'm') + 's.png', { type: 'image/png' }); } catch (e) { TC.file = null; } }, 'image/png'); }
  // the share link: only for a run the server has (a rank), made once per run
  const r = RUN && RUN.g === G ? RUN : null, A = MA();
  if (o.rank && r && r.play && A && A.share && !TC.link && !TC.linking) { TC.linking = true; A.share(LB_GAME, r.play, showName(lbName || '')).then((res) => { if (TC.g !== r.g) return; if (res && (res.status === 200 || res.status === 201) && res.json && res.json.url) TC.link = res.json.url; }).catch(() => {}); }
}
function tcNav(dir) { if (!uiSnd('cursor')) sfx('click'); if (dir === 'left') TC.cur = TC.cur === 2 ? 1 : TC.cur === 1 ? 0 : 2; else if (dir === 'right') TC.cur = TC.cur === 0 ? 1 : TC.cur === 1 ? 2 : 0; else TC.cur = TC.cur === 0 ? 1 : 0; }
// Web Share / window.open / downloads need a fresh user gesture. A key press or mouse click still counts while the game loop
// handles it; a phone touch only counts once the finger lifts, so then the action runs in the next pointerup / touchend.
function tcGesture(fn) { const ua = navigator.userActivation; if (ua && ua.isActive) { fn(); return; }
  TC.pend = fn; const go = () => { off(); const f = TC.pend; TC.pend = null; if (f) f(); }, off = () => { for (const ev of ['pointerup', 'touchend', 'click', 'keyup']) window.removeEventListener(ev, go, true); };
  for (const ev of ['pointerup', 'touchend', 'click', 'keyup']) window.addEventListener(ev, go, true); setTimeout(() => { if (TC.pend === fn) { off(); TC.pend = null; fn(); } }, 1200); }
function tcPress(i) { if (i === 0) { uiSnd('select'); tcClose(); queue.length = 0; return; }
  uiSnd('select'); const o = tcStats(); if (o.pending) { TC.msg = 'ONE SEC: RANKING...'; TC.msgT = 1.6; return; }
  tcGesture(i === 1 ? () => tcShare(o) : () => tcSave(o)); }
function tcSave(o) { if (!TC.blob) { TC.msg = 'ONE SEC...'; TC.msgT = 1.2; return; }
  const u = URL.createObjectURL(TC.blob), a = document.createElement('a'); a.href = u; a.download = TC.file ? TC.file.name : 'zombie-farm.png'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30000); TC.msg = 'IMAGE SAVED'; TC.msgT = 2; TC.did = 'save'; }
function tcShare(o) { const url = TC.link || TC_PLAY, text = tcText(o);
  const data = TC.file ? { files: [TC.file], text: text + ' ' + url, title: 'ZOMBIE FARM' } : null;
  if (data && navigator.canShare && navigator.share) { let ok = false; try { ok = navigator.canShare(data); } catch (e) { ok = false; }
    if (ok) { TC.did = 'webshare'; navigator.share(data).then(() => { TC.msg = 'SHARED!'; TC.msgT = 2; }).catch((e) => { if (e && e.name === 'NotAllowedError') tcIntent(text, url); }); return; } }
  tcIntent(text, url); }
function tcIntent(text, url) { const u = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url); TC.did = 'intent'; TC.lastIntent = u;
  const w = window.open(u, '_blank', 'noopener'); if (!w) { try { window.top.location.href = u; } catch (e) { location.href = u; } } TC.msg = 'OPENING X...'; TC.msgT = 2; }
function drawTimeCard(t, dt) {
  const o = tcStats(); tcRender(o); TC.msgT = Math.max(0, TC.msgT - dt);
  const a = Math.min(1, (T0 - TC.openAt) / 0.22), e = 1 - Math.pow(1 - a, 3);
  hx.fillStyle = `rgba(9,11,10,${0.55 * e})`; hx.fillRect(0, 0, N, N);
  const cw = Math.min(N - 8, 520), ch = Math.round(cw * 675 / 1200), s = 0.86 + 0.14 * e, w = Math.round(cw * s), h = Math.round(ch * s);
  const bh = 22, gap = 6, totalH = ch + gap + bh + 4 + bh, y0 = Math.max(4, Math.round((N - totalH) / 2) - 6), x = Math.round(N / 2 - w / 2), y = Math.round(y0 + (ch - h) / 2);
  hx.fillStyle = INK; hx.fillRect(x - 2, y - 2, w + 4, h + 4);
  if (TC.cv) { const sm = hx.imageSmoothingEnabled; hx.imageSmoothingEnabled = true; try { hx.imageSmoothingQuality = 'high'; } catch (er) {} hx.drawImage(TC.cv, x, y, w, h); hx.imageSmoothingEnabled = sm; }
  if (a < 1) { hx.fillStyle = `rgba(255,196,47,${0.6 * (1 - a)})`; hx.fillRect(x, y, w, h); }
  // buttons: [SHARE ON X] [SAVE IMAGE] / [CONTINUE]
  const by = y0 + ch + gap, bw = Math.floor((cw - 6) / 2), bx = Math.round(N / 2 - cw / 2);
  TC.btns = [[bx, by + bh + 4, cw, bh], [bx, by, bw, bh], [bx + bw + 6, by, bw, bh]];
  const lab = ['CONTINUE', 'SHARE ON X', 'SAVE IMAGE'], col = ['#ffffff', HGOLD, '#ffffff'];
  TC.btns.forEach((q, i) => { const sel = i === TC.cur, [qx, qy, qw, qh] = q;
    hx.fillStyle = sel ? HGOLD : col[i] === HGOLD ? '#fff1c2' : '#ffffff'; hx.fillRect(qx, qy, qw, qh);
    hx.fillStyle = INK; hx.fillRect(qx, qy + qh - 2, qw, 2); hx.fillRect(qx, qy, qw, 1); hx.fillRect(qx, qy, 1, qh); hx.fillRect(qx + qw - 1, qy, 1, qh);
    if (sel) { hx.fillRect(qx - 1, qy - 1, qw + 2, 1); hx.fillRect(qx - 1, qy + qh, qw + 2, 1); hx.fillRect(qx - 1, qy - 1, 1, qh + 2); hx.fillRect(qx + qw, qy - 1, 1, qh + 2); }
    if (i === 1) { const lx = Math.round(qx + qw / 2 - CW(lab[i], 8) / 2) - 8, ly = qy + Math.round(qh / 2) - 4; hx.fillStyle = INK; for (let k = 0; k < 7; k++) { hx.fillRect(lx + k, ly + k, 2, 1); hx.fillRect(lx + 6 - k, ly + k, 1, 1); } text(lab[i], qx + qw / 2 + 5, qy + Math.round(qh / 2) - 5, 8, INK, 'center', false); }
    else text(lab[i] + (i === 0 ? (lastInput === 'touch' ? '' : '  (SHOOT)') : ''), qx + qw / 2, qy + Math.round(qh / 2) - 5, 8, INK, 'center', false); });
  if (TC.msgT > 0) { const m = TC.msg, mw = CW(m, 8) + 12, mx = Math.round(N / 2 - mw / 2), my = y + h - 22; hx.fillStyle = INK; hx.fillRect(mx, my, mw, 16); text(m, N / 2, my + 3, 8, HGOLD, 'center', false); }
}
// ================================================================ v16 "BOK-A-POLKA": an ORIGINAL chiptune polka (not the Chicken Dance melody)
// 2/4 oom-pah: triangle bass on the beat, square chord "pah" on the off-beat, a 12.5% pulse lead with tick-tick-tick-tick
// bursts, noise clap on beat 2, and bok / bwak cluck hits written into the arrangement. 48 bars (A B C) ~ 44 s at 132 bpm, loops.
// Scheduled ahead on the WebAudio clock (light: ~4 short nodes per 16th). Goes through the game master gain, so the shell mute /
// handheld:mute / power-off apply. Ducks under gunfire + achievement fanfares. Tempo +3 bpm per minute survived (cap 156).
// Death credits: a mellow, slowed (78 bpm) triangle version behind a low-pass. ?music=0 turns it off.
const MUS_BOOST = 1.3, MUS_COMP_DB = -20; // v19 music makeup gain (after the compressor) + its threshold
const MUS = { on: !/[?&]music=0/.test(location.search), started: false, bus: null, lp: null, duck: 1, duckT: 0, nextT: 0, step: 0, bar: 0, pulse: null };
const NOTE = (n) => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; return 440 * Math.pow(2, (k - 69) / 12); };
const CHORD = { C: ['C3', 'E4', 'G4', 'C5'], F: ['F2', 'F4', 'A4', 'C5'], G: ['G2', 'D4', 'G4', 'B4'], G7: ['G2', 'F4', 'G4', 'B4'], Am: ['A2', 'E4', 'A4', 'C5'], D7: ['D3', 'F#4', 'A4', 'C5'], Dm: ['D3', 'F4', 'A4', 'D5'] };
// lead lines: 8 sixteenths per 2/4 bar. note | '-' hold | '.' rest | 'X' bwak (two-part cluck) | 'x' bok (single cluck)
const SONG = [
  // A: the tick-tick-tick-tick hook (I I V V V V I I, twice)
  ['C', 'C6 C6 C6 C6 G5 . E5 .'], ['C', 'D5 E5 . G5 - - . x'], ['G7', 'B5 B5 B5 B5 G5 . D5 .'], ['G7', 'C5 D5 . F5 - - . x'],
  ['G7', 'D6 D6 D6 D6 C6 . B5 .'], ['G7', 'E5 . D5 . B4 . G4 .'], ['C', 'C5 E5 G5 C6 - . G5 .'], ['C', 'C6 . . . X . X .'],
  ['C', 'C6 C6 C6 C6 G5 . E5 .'], ['C', 'D5 E5 . G5 - - . x'], ['G7', 'B5 B5 B5 B5 G5 . D5 .'], ['G7', 'C5 D5 . F5 - - . x'],
  ['G7', 'F5 F5 F5 F5 A5 . G5 .'], ['G7', 'F5 . D5 . B4 . D5 .'], ['G', 'D5 D5 D5 D5 B4 . G4 .'], ['C', 'C5 . G4 . C5 . X .'],
  // B: the strut (IV IV I I V V I I, twice)
  ['F', 'A5 . C6 . A5 . F5 .'], ['F', 'G5 A5 G5 F5 E5 . . x'], ['C', 'G5 . E5 . C5 . E5 .'], ['C', 'G5 G5 G5 G5 - . . .'],
  ['G7', 'F5 . D5 . B4 . D5 .'], ['G7', 'F5 E5 D5 C5 B4 . G4 .'], ['C', 'C5 . E5 . G5 . E5 .'], ['C', 'C5 . X . x x . .'],
  ['F', 'A5 . C6 . A5 . F5 .'], ['F', 'Bb5 A5 G5 F5 E5 . . x'], ['C', 'G5 . E5 . C5 . G5 .'], ['D7', 'F#5 F#5 F#5 F#5 - . A5 .'],
  ['G7', 'G5 . F5 . D5 . B4 .'], ['G7', 'D5 E5 F5 G5 A5 B5 . .'], ['C', 'C6 . G5 . E5 . G5 .'], ['C', 'C6 . . . X . . .'],
  // C: bridge (arpeggio runs, then a bok-bok call and response that speeds up into the loop)
  ['Am', 'A4 C5 E5 A5 E5 C5 A4 C5'], ['F', 'F4 A4 C5 F5 C5 A4 F4 A4'], ['G', 'G4 B4 D5 G5 D5 B4 G4 B4'], ['C', 'C5 E5 G5 C6 - x . x'],
  ['Am', 'A4 C5 E5 A5 E5 C5 A4 C5'], ['Dm', 'D5 F5 A5 D6 A5 F5 D5 F5'], ['G7', 'G4 B4 D5 F5 G5 F5 D5 B4'], ['C', 'C5 . . . X . X .'],
  ['C', 'E6 E6 E6 E6 . . . .'], ['C', 'x . x . x . X .'], ['G7', 'D6 D6 D6 D6 . . . .'], ['G7', 'x . x . x . X .'],
  ['C', 'E6 E6 E6 E6 G6 . E6 .'], ['G7', 'D6 D6 D6 D6 B5 . G5 .'], ['G7', 'F5 G5 A5 B5 C6 D6 E6 F6'], ['C', 'G6 . . . X . X .'],
].map(([c, l]) => [c, l.split(' ')]);
const ACCEL = { 44: 1.03, 45: 1.06, 46: 1.09, 47: 1.12 }; // the bridge ending rushes into the loop, polka-style
function musicStart() {
  if (!MUS.on || MUS.started || !AC) return; MUS.started = true;
  MUS.lp = AC.createBiquadFilter(); MUS.lp.type = 'lowpass'; MUS.lp.frequency.value = 9000; MUS.bus = AC.createGain(); MUS.bus.gain.value = 0;
  // v19: ~2x louder. Bus -> low-pass -> compressor (evens out the peaks) -> makeup gain -> master (-> limiter).
  MUS.comp = AC.createDynamicsCompressor(); MUS.comp.threshold.value = MUS_COMP_DB; MUS.comp.knee.value = 8; MUS.comp.ratio.value = 4; MUS.comp.attack.value = 0.004; MUS.comp.release.value = 0.2;
  MUS.out = AC.createGain(); MUS.out.gain.value = MUS_BOOST;
  MUS.bus.connect(MUS.lp); MUS.lp.connect(MUS.comp); MUS.comp.connect(MUS.out); MUS.out.connect(master); MUS.bus.gain.setTargetAtTime(0.5, AC.currentTime, 0.6);
  // 12.5% pulse (NES duty 1) for the lead
  const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.125) * 1.2; MUS.pulse = AC.createPeriodicWave(re, im);
  MUS.nextT = AC.currentTime + 0.1; MUS.step = 0; MUS.bar = 0; setInterval(musicTick, 40);
}
{ const _ai = audioInit; audioInit = function () { _ai(); try { musicStart(); } catch (e) {} }; } // first user gesture (mobile autoplay rules)
function musicDuck(a = 0.55, t = 0.18) { MUS.duck = Math.min(MUS.duck, a); MUS.duckT = Math.max(MUS.duckT, t); }
{ const _s = sfx; sfx = function (n) { if (n === 'mg' || n === 'shotgun' || n === 'pistol' || n === 'hurt') musicDuck(n === 'mg' ? 0.7 : 0.55, n === 'mg' ? 0.12 : 0.25); _s(n); }; }
{ const _a = sfxAch; sfxAch = function () { musicDuck(0.35, 0.7); _a(); }; }
function musicMode() { if (STATE === 'intro') return 'play'; if (STATE === 'game' && G && G.state === 'dead') return 'dead'; if (STATE === 'game' && G && G.state === 'play') return 'play'; return 'title'; }
function mOsc(type, f, t, d, v, wave) { const o = AC.createOscillator(), g = AC.createGain(); if (wave) o.setPeriodicWave(wave); else o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setValueAtTime(v, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + d + 0.02); }
function mNoise(t, d, f, v, q = 1) { if (!noiseBuf) return; const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); s.connect(fl); fl.connect(g); g.connect(MUS.bus); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.02); }
function mCluck(t, two, soft) { // "bok" = one beak blip, "bwak" = bok + a higher squawk
  const v = soft ? 0.05 : 0.11, sw = (f0, f1, at, d) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + d);
    g.gain.setValueAtTime(v, t + at); g.gain.exponentialRampToValueAtTime(0.0008, t + at + d); o.connect(g); g.connect(MUS.bus); o.start(t + at); o.stop(t + at + d + 0.02); };
  sw(820, 430, 0, 0.055); mNoise(t, 0.03, 2400, v * 1.4, 3); if (two) { sw(1250, 620, 0.07, 0.09); mNoise(t + 0.07, 0.04, 3000, v * 1.2, 3); } }
function musicTick() {
  if (!AC || !MUS.bus) return; const now = AC.currentTime;
  if (MUS.nextT < now - 0.25) MUS.nextT = now + 0.05; // tab was asleep: skip ahead instead of bursting
  const mode = musicMode(), dead = mode === 'dead';
  // duck + mode mix
  if (MUS.duckT > 0) MUS.duckT -= 0.04; else MUS.duck = Math.min(1, MUS.duck + 0.04);
  const base = muted ? 0 : dead ? 0.36 : mode === 'title' ? 0.42 : 0.5; MUS.bus.gain.setTargetAtTime(base * MUS.duck, now, 0.05);
  MUS.lp.frequency.setTargetAtTime(dead ? 900 : 9000, now, 0.4);
  if (muted || PWR.off || PWR.hidden) { MUS.nextT = now + 0.05; return; } // nothing to hear (muted / powered off): don't spend nodes
  while (MUS.nextT < now + 0.16) {
    const [ch, line] = SONG[MUS.bar], s = MUS.step, t = MUS.nextT;
    const bpm = dead ? 78 : mode === 'play' ? Math.min(156, 132 + 3 * Math.floor(((G && G.st) || 0) / 60)) : 126, sixteenth = 60 / bpm / 4 / (dead ? 1 : ACCEL[MUS.bar] || 1);
    const C = CHORD[ch];
    // oom (bass on each beat, root then fifth) + pah (off-beat chord stab)
    if (s === 0 || s === 4) { const f = NOTE(C[0]) * (s === 4 && !dead ? 1.5 : 1); mOsc('triangle', f, t, sixteenth * 1.8, 0.32); }
    if ((s === 2 || s === 6) && !dead) for (let i = 1; i < 4; i++) mOsc('square', NOTE(C[i]), t, sixteenth * 0.7, 0.028);
    if ((s === 2 || s === 6) && dead) mOsc('triangle', NOTE(C[2]), t, sixteenth * 1.5, 0.07);
    // drums: clap on beat 2, tick hats on the off sixteenths
    if (!dead) { if (s === 4) mNoise(t, 0.09, 1500, 0.22, 0.9); if (s % 2 === 1) mNoise(t, 0.022, 7000, 0.05, 2); }
    // lead
    const tok = line[s];
    if (tok === 'X' || tok === 'x') mCluck(t, tok === 'X', dead);
    else if (tok !== '.' && tok !== '-') { let n = 1; while (line[s + n] === '-') n++; const f = NOTE(tok) * (dead ? 0.5 : 1);
      if (dead) mOsc('triangle', f, t, sixteenth * n * 1.4, 0.16); else mOsc(null, f, t, sixteenth * (n === 1 ? 0.8 : n * 0.95), 0.085, MUS.pulse); }
    MUS.nextT += sixteenth; MUS.step++; if (MUS.step >= 8) { MUS.step = 0; MUS.bar = (MUS.bar + 1) % SONG.length; }
  }
}

// ================================================================ dynamic props (tall things that can stand in front of the player: they fade)
const PROP_IMG = (() => {
  const lamp = (lit) => { const [c, x] = mk(16, 48), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }, Wd = RAMP.wood; // wooden pole with a hanging farm lantern
    P(5, 8, 3, 38, Wd[1]); P(5, 8, 1, 38, Wd[0]); P(4, 44, 5, 3, Wd[2]); P(5, 6, 9, 2, Wd[2]); P(11, 8, 1, 2, OUT);
    P(9, 10, 5, 7, RAMP.metal[3]); P(10, 11, 3, 5, lit ? RAMP.lit[0] : RAMP.glass[2]); P(10, 9, 3, 1, RAMP.brick[1]);
    return outline(c); };
  const tree = () => { const [c, x] = mk(32, 44), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }, W = RAMP.wood, Lf = RAMP.leaf, r = rng(4); // cartoon round tree
    P(14, 24, 5, 19, W[1]); P(14, 24, 1, 19, W[0]); P(18, 24, 1, 19, W[2]); P(12, 40, 9, 3, W[2]);
    const blob = (cx, cy, rad, col) => { for (let y = -rad; y <= rad; y++) { const hw = Math.round(Math.sqrt(rad * rad - y * y)); P(cx - hw, cy + y, hw * 2, 1, col); } };
    blob(16, 15, 13, Lf[2]); blob(14, 13, 11, Lf[1]); blob(12, 10, 6, Lf[0]); blob(22, 20, 6, Lf[2]);
    for (let n = 0; n < 5; n++) { const ax = 7 + Math.floor(r() * 18), ay = 6 + Math.floor(r() * 16); P(ax, ay, 3, 3, OUT); P(ax, ay, 2, 2, RAMP.brick[1]); } // apples
    return outline(c); };
  const antenna = () => { const [c, x] = mk(16, 44), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }; // rooster weathervane
    P(7, 12, 2, 32, RAMP.metal[2]); P(7, 12, 1, 32, RAMP.metal[0]); P(5, 41, 6, 3, RAMP.metal[3]);
    P(1, 16, 14, 1, RAMP.metal[2]); P(0, 15, 2, 3, RAMP.metal[2]); P(14, 15, 2, 3, RAMP.metal[2]);           // E-W arrow
    P(4, 4, 9, 5, OUT); P(10, 1, 3, 4, OUT); P(12, 2, 2, 1, RAMP.hazard[1]); P(2, 2, 3, 5, OUT); P(6, 9, 1, 3, OUT); P(9, 9, 1, 3, OUT); // rooster silhouette
    P(10, 0, 2, 1, RAMP.brick[1]);
    return outline(c); };
  const fire = (f) => { const [c, x] = mk(12, 14), r = rng(5 + f * 31);
    for (let y = 0; y < 14; y++) for (let X = 0; X < 12; X++) { const dx = (X - 5.5) / 6, dy = (13 - y) / 14, w = (1 - dy) * (1 - Math.abs(dx) * 1.5) + (r() - 0.5) * 0.3 + Math.sin(y * 0.9 + f * 2.1 + X) * 0.12; if (w > 0.15) { x.fillStyle = w > 0.6 ? RAMP.fire[0] : w > 0.4 ? RAMP.fire[1] : RAMP.fire[2]; x.fillRect(X, y, 1, 1); } }
    return c; };
  return { lamp: popCanvas(lamp(true)), lampOff: popCanvas(lamp(false)), tree: popCanvas(tree()), antenna: popCanvas(antenna()), fire: [0, 1, 2].map((f) => popCanvas(fire(f))) };
})();
const SHADOW = (() => { const mkS = (w, h) => { const [c, x] = mk(w, h); x.fillStyle = 'rgba(9,11,10,0.32)'; for (let y = 0; y < h; y++) { const t = (y + 0.5) / h * 2 - 1, half = Math.round(w / 2 * Math.sqrt(1 - t * t)); x.fillRect(w / 2 - half, y, half * 2, 1); } return c; }; return { s: mkS(12, 5), b: mkS(16, 6), i: mkS(10, 4) }; })();

// ================================================================ light map ("colour math"): ambient + banded light pools, multiplied over the scene
const discCache = new Map();
function disc(r, col) { // posterised 3-band light pool with a 1px ordered-dither seam between bands (hard pixels, no blur)
  const key = r + col; let c = discCache.get(key); if (c) return c;
  const [cr, cg, cb] = hex(col); let x; [c, x] = mk(r * 2, r * 2);
  const im = x.createImageData(r * 2, r * 2), d = im.data;
  for (let y = 0; y < r * 2; y++) for (let X = 0; X < r * 2; X++) {
    const q = Math.hypot(X - r + 0.5, y - r + 0.5) / r; if (q >= 1) continue;
    const dith = ((X + y) & 1) ? 0.04 : -0.04, v = q + dith < 0.45 ? 1 : q + dith < 0.72 ? 0.62 : 0.32, i = (y * r * 2 + X) * 4;
    d[i] = cr * v; d[i + 1] = cg * v; d[i + 2] = cb * v; d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0); discCache.set(key, c); return c;
}
let camX = 0, camY = 0;
const w2s = (x, y) => [Math.round(x - camX), Math.round(y - camY)];
// v20 static DUSK: a warm-orange (top) to violet (bottom) soft-light wash. Soft-light keeps mid-tones put, so overall brightness/readability stays the same.
const DUSK = !/[?&]dusk=0/.test(location.search); let _duskG = null, _duskV = null, _duskN = 0; const DUSK_V = +((location.search.match(/[?&]dv=([\d.]+)/) || [])[1] || 0.5), DUSK_LIFT = +((location.search.match(/[?&]lift=([\d.]+)/) || [])[1] || 0.16);
function duskOverlay() { if (!DUSK) return; if (!_duskG || _duskN !== N) { _duskN = N; const [c, x] = mk(N, N), g = x.createLinearGradient(0, 0, N * 0.25, N);
    g.addColorStop(0, '#ffa04a'); g.addColorStop(0.55, '#ff8a6a'); g.addColorStop(1, '#8a5ac8'); x.fillStyle = g; x.fillRect(0, 0, N, N); _duskG = c;
    const [c2, x2] = mk(N, N), rg = x2.createRadialGradient(N / 2, N * 0.58, N * 0.28, N / 2, N * 0.5, N * 0.78); rg.addColorStop(0, 'rgba(120,70,200,0)'); rg.addColorStop(1, 'rgba(120,70,200,0.85)'); x2.fillStyle = rg; x2.fillRect(0, 0, N, N);
    const tg = x2.createLinearGradient(0, 0, 0, N * 0.3); tg.addColorStop(0, 'rgba(150,80,200,0.5)'); tg.addColorStop(1, 'rgba(150,80,200,0)'); x2.fillStyle = tg; x2.fillRect(0, 0, N, N); _duskV = c2; }
  hx.globalCompositeOperation = 'soft-light'; hx.globalAlpha = 0.34; hx.drawImage(_duskG, 0, 0); hx.globalCompositeOperation = 'color'; hx.globalAlpha = DUSK_V; hx.drawImage(_duskV, 0, 0); /* violet dusk edges + sky band: hue only, luminance kept */ hx.globalCompositeOperation = 'screen'; hx.globalAlpha = DUSK_LIFT; hx.fillStyle = '#ffb27a'; hx.fillRect(0, 0, N, N); hx.globalAlpha = 1; /* tiny warm lift = same brightness as plain day */ hx.globalCompositeOperation = 'source-over'; }
// v20: bake the dusk colour grade into the map (warm highlights, violet shadows) at the SAME luminance per pixel
function duskGrade(c) { if (!DUSK) return; const x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const r = d[i], g = d[i + 1], b = d[i + 2], L = 0.299 * r + 0.587 * g + 0.114 * b; if (L < 1) continue;
    const u = Math.min(1, Math.max(0, (L - 60) / 150)), mr = 0.97 + 0.15 * u, mg = 0.9 + 0.07 * u, mb = 1.16 - 0.3 * u;
    let R = r * mr, Gg = g * mg, B = b * mb; const L2 = 0.299 * R + 0.587 * Gg + 0.114 * B, k = L / L2; R *= k; Gg *= k; B *= k;
    d[i] = R > 255 ? 255 : R; d[i + 1] = Gg > 255 ? 255 : Gg; d[i + 2] = B > 255 ? 255 : B; }
  x.putImageData(im, 0, 0); }
function applyLight(t) {
  const dl = daylight(); if (dl >= 1 && !(G && G.lightning > 0)) return;
  const dusk = dl > 0 && dl < 1 ? 1 - Math.abs(dl * 2 - 1) : 0;
  let r = lerp(52, 255, dl), g = lerp(84, 255, dl), b = lerp(112, 255, dl); // v11: hens.farm night (deep sky-teal), golden dusk
  r = lerp(r, 255, dusk * 0.4); g = lerp(g, 196, dusk * 0.45); b = lerp(b, 110, dusk * 0.5);
  if (G && G.lightning > 0) { r = g = b = 255; G.lightning = Math.max(0, G.lightning - 0.08); }
  const L = light.x; L.globalCompositeOperation = 'source-over'; L.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; L.fillRect(0, 0, N, N);
  L.globalCompositeOperation = 'lighter';
  const k = 1 - dl, add = (wx, wy, rad, col) => { const [sx, sy] = w2s(wx, wy); if (sx < -rad || sy < -rad || sx > N + rad || sy > N + rad) return; L.globalAlpha = k; L.drawImage(disc(rad, col), sx - rad, sy - rad); };
  if (G && G.state !== 'dead') add(player.x, player.y - 6 - player.jz, 46, '#e0b860');
  if (G && G.muzzle && G.muzzle.t > 0) add(player.x, player.y - 10 - player.jz, G.muzzle.big ? 60 : 40, '#ffc42f'); // v9 muzzle light at night
  const fl = Math.sin(t * 12) > -0.6;
  for (const p of props) {
    if (p.type === 'lamp' && p.lit && (!p.flick || ((t * 3 + p.seed) % 7) > 0.5)) add(p.tx * TS + 12, p.ty * TS + 10, 36, '#d8b050');
    else if (p.type === 'barrel') add(p.tx * TS + 8, p.ty * TS + 4, fl ? 34 : 32, '#e08840');
    else if (p.type === 'campfire') add(p.tx * TS + 8, p.ty * TS + 8, fl ? 52 : 50, '#f09048');
    
  }
  for (const bd of buildings) if (bd.lit) for (const [wx, wy] of bd.lit) add(wx, wy + 10, 14, '#a07038');
  L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
  hx.globalCompositeOperation = 'multiply'; hx.drawImage(light.c, 0, 0); hx.globalCompositeOperation = 'source-over';
}
// screen-space rain: thin diagonal streaks
const drops = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
let rainAmt = 0;
function drawWeather(dt) {
  const night = isNight(); rainAmt += ((night ? 0.55 : 0) - rainAmt) * dt * 0.2; // sunny farm days, drizzly nights
  const n = Math.floor(drops.length * rainAmt);
  hx.fillStyle = night ? '#7a8ab8' : '#c8d8f0';
  for (let i = 0; i < n; i++) { const d = drops[i]; d.y += dt * 1.5 * d.s; d.x -= dt * 0.35 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random() * 1.3; } if (d.x < 0) d.x += 1.3; const X = Math.floor(d.x * N), Y = Math.floor(d.y * N); for (let k = 0; k < 4; k++) hx.fillRect(X - (k >> 1), Y + k, 1, 1); }
  for (let i = 0; i < 5 * rainAmt; i++) { const X = Math.floor(Math.random() * N), Y = Math.floor(Math.random() * N); hx.fillRect(X - 1, Y, 1, 1); hx.fillRect(X + 1, Y, 1, 1); }
}

// ================================================================ world render
function rectsOverlap(a, b) { return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]; }
function spriteFrame(s, row, col) { return [col * s.cw, row * s.ch, s.cw, s.ch]; }
function actorRow(fx, fy) { return Math.abs(fx) > Math.abs(fy) * 1.05 ? (fx < 0 ? 2 : 3) : (fy > 0 ? 0 : 1); }
function drawShotEgg(x, y, big, tier) { // v19 player egg: WHITE shell, ink outline (MG small 3x4, shotgun 4x5); tier II+ gets a coloured band, V is a golden egg
  x = Math.round(x); y = Math.round(y); const r = big ? [[1, 2], [0, 4], [0, 4], [0, 4], [1, 2]] : [[1, 1], [0, 3], [0, 3], [1, 1]], h = r.length, lx = x - (big ? 2 : 1), top = y - (h >> 1);
  hx.fillStyle = OUT; for (let i = 0; i < h; i++) hx.fillRect(lx + r[i][0] - 1, top + i, r[i][1] + 2, 1); hx.fillRect(lx + r[0][0], top - 1, r[0][1], 1); hx.fillRect(lx + r[h - 1][0], top + h, r[h - 1][1], 1);
  hx.fillStyle = tier >= 5 ? '#ffc42f' : '#fffdf5'; for (let i = 0; i < h; i++) hx.fillRect(lx + r[i][0], top + i, r[i][1], 1);
  if (tier >= 2 && tier < 5) { hx.fillStyle = EGG_TIER[tier]; hx.fillRect(lx + r[2][0], top + 2, r[2][1], 1); }
  hx.fillStyle = '#ffffff'; hx.fillRect(lx + r[1][0], top + 1, 1, 1); }
function drawEgg(x, y, spin) { // rotten egg: ink outline, rounded pale sickly shell, green rot spots, tumbling
  const r = spin % 2 ? [[1, 4], [0, 6], [0, 6], [0, 6], [1, 4]] : [[2, 2], [1, 4], [0, 6], [0, 6], [0, 6], [1, 4]];
  const h = r.length, top = y - h, lx = x - 3; hx.fillStyle = OUT;
  for (let i = 0; i < h; i++) hx.fillRect(lx + r[i][0] - 1, top + i, r[i][1] + 2, 1);
  hx.fillRect(lx + r[0][0], top - 1, r[0][1], 1); hx.fillRect(lx + r[h - 1][0], top + h, r[h - 1][1], 1);
  hx.fillStyle = '#b4d24a'; for (let i = 0; i < h; i++) hx.fillRect(lx + r[i][0], top + i, r[i][1], 1); // v19: clearly ROTTEN (sickly green), never mistaken for the hen's white eggs
  hx.fillStyle = '#4e7a12'; hx.fillRect(lx + 3, top + 2, 2, 1); hx.fillRect(lx + 1, top + h - 2, 1, 1); hx.fillStyle = '#ffffff'; hx.fillRect(lx + r[1][0], top + 1, 1, 1); }
function drawPart(p) { const [x, y] = w2s(p.x, p.y), Y = y - Math.round(p.z), a = p.t > p.T - 0.5 ? (p.T - p.t) / 0.5 : 1; if (a < 1) hx.globalAlpha = Math.max(0, a);
  if (p.k === 'f') { hx.fillStyle = OUT; hx.fillRect(x - 2, Y - 1, 5, 3); hx.fillStyle = p.c; hx.fillRect(x - 1, Y, 3, 1); if (p.z <= 0) { hx.fillStyle = 'rgba(9,11,10,.25)'; hx.fillRect(x - 1, y + 1, 3, 1); } }
  else if (p.k === 'c') { hx.fillStyle = OUT; hx.fillRect(x - 1, Y - 1, 4, 3); hx.fillStyle = p.c; hx.fillRect(x, Y, 2, 1); }
  else { hx.fillStyle = OUT; hx.fillRect(x - 1, Y - 1, 3, 3); hx.fillStyle = p.c; hx.fillRect(x, Y, 1 + (p.z <= 0 ? 1 : 0), 1); }
  if (a < 1) hx.globalAlpha = 1; }
// ================================================================ v20 Paper Mario cutouts: every chicken is a THICK cardboard standee.
// East/west: the full flat image (plus a 3-layer cardboard edge behind it). North/south: the standee is turned partly edge-on,
// drawn ~60% wide with half of it showing the plain cardboard BACK. Any facing change plays a quick paper-flip squash.
// Pure drawing: hitboxes are untouched. ?paper=0 = the old flat sprites.
const PAPER = !/[?&]paper=0/.test(location.search), PAPER_FLIP = 0.14, PAPER_THICK = 3;
function paperState(o, row, t) { let P = o._pp; if (!P || o._ppG !== G) { P = o._pp = { row, sign: row === 2 ? -1 : 1, t0: -9, prev: null }; o._ppG = G; }
  if (row !== P.row) { P.prev = { row: P.row, sign: P.sign }; P.row = row; if (row === 2) P.sign = -1; else if (row === 3) P.sign = 1; P.t0 = t; } return P; }
const paperGeom = (L) => ({ sign: L.sign, scale: L.row < 2 ? 0.6 : 1, dark: L.row === 1 ? 'head' : L.row === 0 ? 'tail' : null });
function paperDraw(o, s, img, row, col, cx, Y, h, t, opt = {}) {
  const w = s.cw, ch = s.ch;
  if (!PAPER || !s.crd) { hx.drawImage(img, col * w, row * ch, w, ch, Math.round(cx - w / 2), Y, w, h); return; }
  const P = paperState(o, row, t), k = (t - P.t0) / PAPER_FLIP; let g = paperGeom(P), sc = g.scale;
  if (k >= 0 && k < 1 && P.prev) { if (k < 0.5) { g = paperGeom(P.prev); sc = g.scale * (1 - k * 2); } else sc = g.scale * ((k - 0.5) * 2); sc = Math.max(0.1, sc); }
  const fx = col * w, fy = (g.sign < 0 ? 2 : 3) * ch, dw = Math.max(2, Math.round(w * sc)), X = Math.round(cx - dw / 2), Yr = Math.round(Y);
  if (opt.edge !== false) { const ex = sc < 0.95 ? 1 : -g.sign; for (let q = PAPER_THICK; q >= 1; q--) { hx.globalAlpha = q === PAPER_THICK ? 0.85 : 1; hx.drawImage(s.crd, fx, fy, w, ch, X + q * ex, Yr + (q > 1 ? 1 : 0), dw, h); } hx.globalAlpha = 1; } // cardboard thickness
  hx.drawImage(img, fx, fy, w, ch, X, Yr, dw, h);
  const full = img === s.img;
  if (full && opt.rim && s.rim && g.sign > 0) hx.drawImage(s.rim, fx, fy, w, ch, X, Yr, dw, h); // golden dusk rim (sun in the west, so only the west-facing side catches it)
  if (full && g.dark && s.back) { const half = w / 2, cover = (g.dark === 'head') === (g.sign > 0), d2 = Math.round(dw / 2);
    hx.drawImage(s.back, cover ? fx + half : fx, fy, half, ch, cover ? X + dw - d2 : X, Yr, d2, h); } // half seen from behind: plain cardboard
}
// v20 dusk: long soft shadows thrown east by the low sun
function longShadow(sx, sy, w) { hx.globalAlpha = 0.55; hx.drawImage(SHADOW.b, Math.round(sx - w * 0.35), sy - 3, Math.round(w * 2.3), 6); hx.globalAlpha = 0.3; hx.drawImage(SHADOW.b, Math.round(sx + w * 0.6), sy - 2, Math.round(w * 2.2), 4); hx.globalAlpha = 1; }
function renderWorld(dt, t) {
  hx.fillStyle = '#0e0a14'; hx.fillRect(0, 0, N, N);
  hx.drawImage(MAPC, -camX, -camY);
  const list = [];
  // v9 particles (feathers, goo, casings): integrate, then draw the grounded ones under everything
  if (G && G.parts && G.parts.length) { const P = G.parts; let n = 0;
    for (const p of P) { p.t += dt; if (p.t >= p.T) continue; P[n++] = p;
      if (p.z > 0 || p.vz > 0) { if (p.k === 'f') { p.vz = Math.max(-18, p.vz - 90 * dt); p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.2, dt); p.x += Math.sin(p.t * 7 + p.T * 9) * 10 * dt; } else p.vz -= 320 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; if (p.k === 'c' && p.vz < -40) { p.vz *= -0.35; p.vx *= 0.5; p.vy *= 0.5; } else p.vz = 0; } } }
    P.length = n;
    for (const p of P) if (p.z <= 0) drawPart(p); }
  // items
  // v13: pickups 3x (48 px) with a gold pulsing halo + bob + sparkle. Drawn as a ground layer BEFORE every actor, so they can never hide the hen.
  for (const it of itemPool) if (it.alive) { const [sx, sy] = w2s(it.x, it.y); if (sx < -30 || sx > N + 30 || sy < -10 || sy > N + 52) continue;
    const bobY = Math.round(Math.sin(t * 3 + it.ph) * 3), pulse = 0.5 + 0.5 * Math.sin(t * 5 + it.ph), gun = it.kind === 'mg' || it.kind === 'shotgun', tc = gun ? (tierCol(it.tier) || HGOLD) : HGOLD, big = gun && it.tier >= 5, rx = 20 + Math.round(pulse * (big ? 6 : 3)), ry = 7 + Math.round(pulse * (big ? 2 : 1));
    hx.globalAlpha = 0.28 + pulse * (big ? 0.5 : 0.3); hx.fillStyle = tc; hx.beginPath(); hx.ellipse(sx, sy - 1, rx, ry, 0, 0, 6.283); hx.fill();
    hx.globalAlpha = 0.9; hx.strokeStyle = INK; hx.lineWidth = 1; hx.beginPath(); hx.ellipse(sx, sy - 1, rx, ry, 0, 0, 6.283); hx.stroke(); hx.globalAlpha = 1;
    hx.drawImage(SHADOW.i, sx - 5, sy - 3, 10, 5);
    if (gun) { hx.drawImage(eggImg(it.kind, it.tier), 0, 0, 16, 16, sx - 24, sy - 45 + bobY, 48, 48); const r = roman(it.tier || 1); text(r, sx + 18, sy - 44 + bobY, 8, tc === HGOLD && it.tier < 5 ? CREAM : tc, 'center'); }
    else hx.drawImage(ITEM_IMG, ITEMS.indexOf(it.kind) * 16, 0, 16, 16, sx - 24, sy - 45 + bobY, 48, 48);
    if (((t * 2 + it.ph) % 2) < 0.25) { const k = Math.floor(it.ph * 7) % 3; hx.fillStyle = '#ffffff'; const px = sx + [-14, 10, 4][k], py = sy - 36 + bobY + [0, 6, -4][k]; hx.fillRect(px - 2, py, 5, 1); hx.fillRect(px, py - 2, 1, 5); } }
  // zombies (live and falling corpses)
  let onScreen = 0; const slashes = [];
  for (const z of zombiePool) {
    { const q = w2s(z.x, z.y); if (q[0] < -40 || q[0] > N + 40 || q[1] < -16 || q[1] > N + 50) continue; } // v9 perf: cull off-screen enemies
    if (z.alive) onScreen++;
    const s = z.brute ? SPR.brute : z.thrower ? SPR.thrower : SPR.zombies[z.sprI], row = actorRow(z.fx, z.fy), nf = s.nf || 4, w = s.cw, h = s.ch, jz = Math.round(z.jz || 0);
    const winding = z.alive && ((z.atk > 0 && !z.hop) || z.wind > 0);
    let col = z.alive ? Math.floor(z.anim) % 4 : 0; if (z.alive && nf >= 6) { if (z.strikeT > 0) col = 4; else if (winding) col = 5; } // v9: STRIKE / WIND-UP frames
    const rect = [z.x - w / 2, z.y - h + 1 - jz, w, h];
    list.push({ y: z.y, rect, actor: true, draw: () => {
      const [sx, sy] = w2s(z.x, z.y);
      if (z.alive) { const sh = z.brute ? SHADOW.b : SHADOW.s; longShadow(sx, sy, sh.width); hx.drawImage(sh, Math.round(sx - sh.width / 2) + 1, sy - 3); } // v9 contact shadow + v20 long dusk shadow
      if (s.shd && z.alive && !jz) { hx.globalAlpha = 0.38; paperDraw(z, s, s.shd, row, col, sx + 2, sy - h + 2, h, t, { edge: false }); hx.globalAlpha = 1; } // hard offset ink shadow
      if (!z.alive) { // collapse: draw squashed frames sinking, then gone
        const k = clamp(z.dead / 0.6, 0, 1), hh = Math.max(4, Math.round(h * k));
        hx.globalAlpha = 0.5 + k * 0.5; hx.drawImage(s.img, ...spriteFrame(s, row, 0), Math.round(sx - w / 2), sy - hh + 1, w, hh); hx.globalAlpha = 1; return; }
      const shake = winding && !z.thrower ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0, X = Math.round(sx - w / 2) + shake, Y = sy - h + 1 - jz, fr = spriteFrame(s, row, col);
      const PX = X + w / 2;
      if (z.flash > 0 && s.wht) { paperDraw(z, s, s.wht, row, col, PX, Y, h, t); return; } // v9 hit flash
      if (z.hurt > 0 && Math.floor(t * 30) % 2) { paperDraw(z, s, s.sil, row, col, PX, Y, h, t, { edge: false }); return; }
      paperDraw(z, s, s.img, row, col, PX, Y, h, t, { rim: true });
      if (winding && s.red && Math.floor(t * 14) % 2) { hx.globalAlpha = 0.42; paperDraw(z, s, s.red, row, col, PX, Y, h, t, { edge: false }); hx.globalAlpha = 1; } // v9 wind-up warning blink
      if (z.alive && z.strikeT > 0 && !z.brute && !z.thrower) slashes.push(z); // v9 peck strike slash: drawn on top of everything below
      if (z.alive && z.thrower && z.strikeT > 0) { const k = z.strikeT / 0.22, dx2 = Math.sign(player.x - z.x) || 1; hx.fillStyle = '#ffffff'; for (let q = 0; q < 4; q++) hx.fillRect(sx + dx2 * (4 + q * 2), sy - h + 4 + q - Math.round(k * 3), 2, 1); } // release swoosh
      if (z.thrower && z.wind > 0) { const k = 1 - z.wind / TUNE.tWind, ex = sx + (row === 2 ? 5 : row === 3 ? -5 : 0), ey = sy - h - 2 - Math.round(k * 4); // the tell: a rotten egg raised overhead + flashing !
        drawEgg(ex, ey, 0); if (Math.floor(t * 10) % 2) { hx.fillStyle = OUT; hx.fillRect(sx + 8, sy - h - 12, 4, 10); hx.fillStyle = '#ff3347'; hx.fillRect(sx + 9, sy - h - 11, 2, 5); hx.fillRect(sx + 9, sy - h - 5, 2, 2); } }
    } });
  }
  // player
  const pecking = player.peck && player.atkT > 0.04, ps = SPR.player, pcol = pecking ? 4 : player.moving && !player.air ? Math.floor(player.anim) % 4 : (player.air ? 1 : 0);
  const pk = pecking ? Math.round(Math.sin((1 - player.atkT / 0.2) * Math.PI) * 2) : 0, pdx = player.dir === 2 ? -pk : player.dir === 3 ? pk : 0, pdy = player.dir === 0 ? pk : player.dir === 1 ? -pk : 0; // body lunge
  const PW = ps.cw, PH = ps.ch, prect = [player.x - PW / 2, player.y - PH - player.jz, PW, PH];
  const drawPlayer = (sil) => {
    const [sx, sy] = w2s(player.x, player.y), py = sy - PH + 1 - Math.round(player.jz);
    if (!sil && player.jz > 2) { const sh = player.jz > 6 ? SHADOW.i : SHADOW.s; hx.drawImage(sh, sx - sh.width / 2, sy - 3); } // airborne: ground spot
    else if (!sil) { longShadow(sx, sy, 12); hx.drawImage(SHADOW.s, sx - 5, sy - 3); } // v9 contact shadow + v20 long dusk shadow
    else if (!sil && ps.shd) { hx.globalAlpha = 0.38; hx.drawImage(ps.shd, ...spriteFrame(ps, player.dir, pcol), sx - PW / 2 + pdx + 2, py + pdy + 1, PW, PH); hx.globalAlpha = 1; } // hard offset ink shadow
    if (!sil && player.hurtT > 0 && Math.floor(t * 30) % 2) return;
    paperDraw(player, ps, sil ? ps.sil : ps.img, player.dir, pcol, sx + pdx, py + pdy, PH, t, { edge: !sil, rim: !sil });
    if (!sil && pecking && player.atkT < 0.16 && player.atkT > 0.08) { const [fx, fy] = [[0, 1], [0, -1], [-1, 0], [1, 0]][player.dir], tx0 = sx + pdx + fx * (PW / 2 + 1), ty0 = py + pdy + Math.round(PH * 0.42) + fy * Math.round(PH * 0.42) + (fx ? -2 : 0); // tok! spark at the beak tip
      hx.fillStyle = OUT; hx.fillRect(tx0 - 2, ty0 - 1, 5, 3); hx.fillRect(tx0 - 1, ty0 - 2, 3, 5); hx.fillStyle = '#ffffff'; hx.fillRect(tx0 - 1, ty0, 3, 1); hx.fillRect(tx0, ty0 - 1, 1, 3); }
    if (!sil && player.atkT > 0 && !player.peck) { const w = WEAPONS[G.weapon]; if (w.icon >= 0) { const [fx, fy] = dirVec(); const ox = Math.round(fx * 9), oy = Math.round(fy * 7); if (fx < -0.3) { hx.save(); hx.translate(sx + ox, 0); hx.scale(-1, 1); hx.drawImage(gunImg(G.weapon, w.tier), 0, 0, 16, 16, -8, py + PH - 16 + oy, 16, 16); hx.restore(); } else hx.drawImage(gunImg(G.weapon, w.tier), 0, 0, 16, 16, sx - 8 + ox, py + PH - 16 + oy, 16, 16); } }
  };
  const showPlayer = STATE === 'game' && (G.state !== 'dead' || G.deadT < 0.5);
  if (showPlayer) list.push({ y: player.y, player: true, draw: () => drawPlayer(false) });
  // tall props
  for (const p of props) {
    let img = null, ox = 0, oy = 0;
    if (p.type === 'lamp') { img = p.lit && (!p.flick || ((t * 3 + p.seed) % 7) > 0.5) ? PROP_IMG.lamp : PROP_IMG.lampOff; ox = 0; oy = 48; }
    else if (p.type === 'tree') { img = PROP_IMG.tree; ox = -8; oy = 44; }
    else if (p.type === 'antenna') { img = PROP_IMG.antenna; ox = 2; oy = 44; }
    else if (p.type === 'barrel' || p.type === 'campfire') { img = PROP_IMG.fire[Math.floor(t * 9 + p.tx) % 3]; ox = 2; oy = p.type === 'barrel' ? 26 : 18; }
    if (!img) continue;
    const wx = p.tx * TS + ox, wy = p.ty * TS + TS - oy, baseY = p.ty * TS + TS;
    if (wx - camX > N || wx + img.width - camX < 0 || wy - camY > N || wy + img.height - camY < 0) continue;
    const rect = [wx, wy, img.width, img.height];
    list.push({ y: baseY, rect, prop: true, draw: (fade) => {
      if (p.type === 'campfire') { const [sx, sy] = w2s(p.tx * TS, p.ty * TS); hx.fillStyle = RAMP.wood[2]; hx.fillRect(sx + 2, sy + 11, 12, 3); hx.fillStyle = OUT; hx.fillRect(sx + 2, sy + 14, 12, 1); for (let k = 0; k < 6; k++) { hx.fillStyle = RAMP.conc[k % 2]; hx.fillRect(sx + 1 + k * 2 + (k > 2 ? 2 : 0), sy + 13, 2, 2); } }
      hx.globalAlpha = fade ? 0.3 : 1; hx.drawImage(img, wx - camX, wy - camY); hx.globalAlpha = 1;
      
    } });
  }
  list.sort((a, b) => a.y - b.y);
  let afterPlayer = false, covered = false;
  for (const e of list) {
    if (e.player) { afterPlayer = true; e.draw(); continue; }
    // NEVER HIDE THE PLAYER: props in front that overlap the player fade out; anything else overlapping triggers the silhouette pass
    const over = afterPlayer && showPlayer && e.rect && rectsOverlap(e.rect, prect);
    if (over) covered = true;
    e.draw(over && e.prop);
  }
  if (G && G.parts) for (const p of G.parts) if (p.z > 0) drawPart(p);
  // v9 roostr stomp shockwaves
  if (G && G.waves && G.waves.length) { for (const w of G.waves) { w.t += dt; const u = Math.min(1, w.t / w.T), [cx, cy] = w2s(w.x, w.y), rx = 4 + (w.rx - 4) * u, ry = 2 + (w.ry - 2) * u;
      for (let k = 0; k < 28; k++) { const a = k / 28 * 6.283, X = Math.round(cx + Math.cos(a) * rx), Y = Math.round(cy - 2 + Math.sin(a) * ry); hx.fillStyle = OUT; hx.fillRect(X - 1, Y - 1, 3, 3); hx.fillStyle = u < 0.5 ? '#ffffff' : '#ffc42f'; hx.fillRect(X, Y, 1, 1); }
      if (u < 0.4) { hx.fillStyle = '#c39260'; for (let k = 0; k < 6; k++) hx.fillRect(cx + Math.round(Math.cos(k) * rx * 0.6), cy - 2 - Math.round(u * 10) + (k % 3), 2, 2); } }
    G.waves = G.waves.filter((w) => w.t < w.T); }
  // v9 muzzle flash
  if (G && G.muzzle && G.muzzle.t > 0) { const m = G.muzzle, [px0, py0] = w2s(player.x, player.y - 10 - player.jz), ca = Math.cos(m.a), sa = Math.sin(m.a), mx = px0 + Math.round(ca * 12), my = py0 + Math.round(sa * 9), L = m.big ? 9 : m.k === 'mg' ? 6 : 5;
    for (const [da, len] of [[0, L], [0.6, L * 0.55], [-0.6, L * 0.55], [1.6, 2], [-1.6, 2]]) { for (let q = 0; q <= len; q++) { const X = Math.round(mx + Math.cos(m.a + da) * q), Y = Math.round(my + Math.sin(m.a + da) * q); hx.fillStyle = OUT; hx.fillRect(X - 1, Y - 1, 3, 3); } }
    for (const [da, len] of [[0, L], [0.6, L * 0.55], [-0.6, L * 0.55]]) { for (let q = 0; q <= len; q++) { const X = Math.round(mx + Math.cos(m.a + da) * q), Y = Math.round(my + Math.sin(m.a + da) * q); hx.fillStyle = q < 2 ? '#ffffff' : q < len * 0.6 ? '#ffe066' : '#ff7a1a'; hx.fillRect(X, Y, q < 2 && m.big ? 2 : 1, q < 2 && m.big ? 2 : 1); } }
    m.t -= dt; }
  for (const z of slashes) { const [sx, sy] = w2s(z.x, z.y), lx = z.lx || 0, ly = z.ly || 0, a0 = Math.atan2(ly, lx), cx = sx + Math.round(lx * 11), cy = sy - 11 + Math.round(ly * 7), R = 6 + Math.round((1 - z.strikeT / TUNE.zStrike) * 3); // white slash crescent, any direction
    for (let k = -3; k <= 3; k++) { const a = a0 + k * 0.32, X2 = Math.round(cx + Math.cos(a) * R), Y2 = Math.round(cy + Math.sin(a) * R * 0.8); hx.fillStyle = OUT; hx.fillRect(X2 - 1, Y2 - 1, 4, 4); hx.fillStyle = Math.abs(k) < 2 ? '#ffffff' : '#ff3347'; hx.fillRect(X2, Y2, 2, 2); } }
  window.__ltOnScreen = onScreen;
  if (covered) { drawPlayer(true); const [sx, sy] = w2s(player.x, player.y); if (Math.floor(t * 6) % 2) { hx.fillStyle = '#ffc42f'; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; hx.fillRect(Math.round(sx + Math.cos(a) * 11), Math.round(sy - 1 + Math.sin(a) * 5), 2, 1); } } } // v9: buried in the swarm? a gold ring marks you
  // v6: rotten eggs in flight: ground telegraph at the landing spot + a shadow under the egg + the egg on its arc
  if (G && G.proj) for (const p of G.proj) { const u = clamp(p.t / p.T, 0, 1), [txs, tys] = w2s(p.x1, p.y1), r = Math.round(8 - u * 4);
    hx.fillStyle = OUT; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; hx.fillRect(Math.round(txs + Math.cos(a) * r) - 1, Math.round(tys + Math.sin(a) * r * 0.6) - 1, 3, 3); }
    hx.fillStyle = Math.floor(t * 12) % 2 ? '#ff3347' : '#ffc42f'; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; hx.fillRect(Math.round(txs + Math.cos(a) * r), Math.round(tys + Math.sin(a) * r * 0.6), 1, 1); }
    hx.fillRect(txs - 1, tys, 3, 1);
    const gx = lerp(p.x0, p.x1, u), gy = lerp(p.y0, p.y1, u), h = p.z0 * (1 - u) + 4 * p.peak * u * (1 - u), [ex, ey] = w2s(gx, gy);
    hx.drawImage(SHADOW.i, ex - 5, ey - 2); drawEgg(ex, Math.round(ey - h), Math.floor(t * 12) % 4); }
  if (G && G.splats) for (const s of G.splats) { const [sx, sy] = w2s(s.x, s.y), k = 1 - s.t / s.T;
    if (s.kind === 'egg') { hx.fillStyle = OUT; hx.fillRect(sx - 7, sy - 3, 15, 6); hx.fillStyle = '#c8d860'; hx.fillRect(sx - 6, sy - 2, 13, 4); hx.fillStyle = '#ffc42f'; hx.fillRect(sx - 2, sy - 2, 5, 3); hx.fillStyle = '#f8f5e9'; hx.fillRect(sx - 8 - Math.round(k * 4), sy - 4 - Math.round(k * 3), 3, 2); hx.fillRect(sx + 6 + Math.round(k * 4), sy - 5 - Math.round(k * 2), 3, 2); }
  }
  // effects
  if (G && STATE === 'game' && G.state === 'play' && player.aim > 0) { // v11 aim marker: two ink/gold pips + a tip along the shot line (shows diagonals clearly)
    const [ax0, ay0] = w2s(player.x, player.y - 10 - player.jz), [fx, fy] = dirVec(), col = player.diag ? '#ffc42f' : '#ffffff';
    for (const [r, s] of [[15, 3], [20, 3], [25, 5]]) { const X = Math.round(ax0 + fx * r), Y = Math.round(ay0 + fy * r * 0.85); hx.fillStyle = OUT; hx.fillRect(X - (s >> 1) - 1, Y - (s >> 1) - 1, s + 2, s + 2); hx.fillStyle = r === 25 ? HRED : col; hx.fillRect(X - (s >> 1), Y - (s >> 1), s, s); } }
  if (G && G.swing && G.swing.t > 0 && G.swing.w !== 'fists') { const sw = G.swing; sw.t -= dt; const prog = 1 - sw.t / 0.16, [px0, py0] = w2s(player.x, player.y - 10 - player.jz);
    for (let k = 0; k <= 8; k++) { const a = sw.a - 1.0 + Math.min(prog, 1) * 2.0 * (k / 8); const rr = sw.reach; hx.fillStyle = k > 6 ? '#fff4c0' : '#c8c0b0'; hx.fillRect(Math.round(px0 + Math.cos(a) * rr), Math.round(py0 + Math.sin(a) * rr * 0.85), 2, 2); } }
  if (G && G.tracers) { for (const tr of G.tracers) { const a = w2s(tr.x0, tr.y0), b = w2s(tr.x1, tr.y1), T = tr.T || 0.12, u = 1 - Math.pow(Math.max(0, tr.t) / T, 1.4); // v19: player shots are flying EGGS
    const ex = a[0] + (b[0] - a[0]) * u, ey = a[1] + (b[1] - a[1]) * u, tx = a[0] + (b[0] - a[0]) * Math.max(0, u - 0.18), ty = a[1] + (b[1] - a[1]) * Math.max(0, u - 0.18);
    hx.fillStyle = 'rgba(255,253,245,.55)'; hx.fillRect(Math.round(tx), Math.round(ty), 1, 1); hx.fillRect(Math.round((tx + ex) / 2), Math.round((ty + ey) / 2), 1, 1); // a faint streak
    drawShotEgg(ex, ey, tr.k === 'shotgun', tr.tier || 1); tr.t -= dt; } G.tracers = G.tracers.filter((q) => q.t > 0); }
  if (G && G.hits) { for (const h of G.hits) { const p = w2s(h.x, h.y); if (h.peck) { const r = Math.round((0.14 - h.t) * 40) + 2; hx.fillStyle = '#ffc42f'; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) hx.fillRect(p[0] + Math.round(ax * r), p[1] + Math.round(ay * r), 2, 2); hx.fillStyle = '#ffffff'; hx.fillRect(p[0] - 1, p[1] - 1, 3, 3); h.t -= dt; continue; } for (let k = 0; k < 6; k++) { hx.fillStyle = k % 2 ? '#ffffff' : RAMP.blood[0]; hx.fillRect(p[0] + Math.round((Math.random() - 0.5) * 9), p[1] + Math.round((Math.random() - 0.5) * 9), 2, 1); } hx.fillStyle = '#ffc42f'; hx.fillRect(p[0], p[1], 1, 1); h.t -= dt; } G.hits = G.hits.filter((q) => q.t > 0); }
  applyLight(t); duskOverlay();
  drawWeather(dt);
  return covered;
}

// ================================================================ v19 BARNYARD AUDIO: lots more (original, synthesized) chicken sounds + the arena announcer
// Every sound here is synthesized WebAudio (no samples) and goes through the game master gain (mute / power-off / limiter apply).
// Randomized pitch + pick, per-sound throttles and a small voice budget so a 60-zombie swarm stays music, not noise.
const SND = { last: {}, budget: 0, budgetT: 0 };
function sndOk(key, gap) { if (!AC || muted) return false; const now = AC.currentTime; if (now - (SND.last[key] || -9) < gap) return false;
  if (now - SND.budgetT > 0.1) { SND.budgetT = now; SND.budget = 0; } if (SND.budget >= 4) return false; SND.budget++; SND.last[key] = now; return true; }
const rr = (a, b) => a + Math.random() * (b - a);
function cluckV(f0, f1, at, d, v, type = 'square') { const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02); }
function bokSnd(kind) { const p = rr(0.85, 1.2), v = 0.06;
  switch (kind) {
    case 'bok': cluckV(820 * p, 420 * p, 0, 0.06, v); noise(0.03, 2400 * p, 0.08, 3); break;                                      // one beak blip
    case 'bokbok': cluckV(800 * p, 420 * p, 0, 0.055, v); cluckV(860 * p, 440 * p, 0.09, 0.055, v); noise(0.03, 2500, 0.07, 3, 0.09); break;
    case 'bwak': cluckV(780 * p, 400 * p, 0, 0.05, v); cluckV(1300 * p, 620 * p, 0.065, 0.11, v * 1.1); noise(0.05, 3000, 0.08, 3, 0.065); break; // battle cluck
    case 'happy': cluckV(700 * p, 1100 * p, 0, 0.07, v); cluckV(900 * p, 1500 * p, 0.08, 0.09, v); break;                          // pickup "bok-BOK?"
    case 'squawk': cluckV(1500 * p, 500 * p, 0, 0.22, v * 1.3, 'sawtooth'); noise(0.18, 2200 * p, 0.12, 2); break;                 // ouch
    case 'zgroan': cluckV(150 * p, 90 * p, 0, 0.45, 0.035, 'sawtooth'); cluckV(300 * p, 180 * p, 0.05, 0.3, 0.02, 'square'); break;  // undead hen moan
    case 'zcluck': cluckV(420 * p, 210 * p, 0, 0.09, 0.045, 'sawtooth'); cluckV(380 * p, 190 * p, 0.12, 0.09, 0.04, 'sawtooth'); break; // rattly bok-bok
    case 'zwind': cluckV(240 * p, 520 * p, 0, 0.28, 0.04, 'sawtooth'); break;                                                        // windup growl
    case 'zdie': cluckV(1100 * p, 260 * p, 0, 0.16, 0.05, 'sawtooth'); cluckV(600 * p, 120 * p, 0.1, 0.18, 0.03, 'square'); break;    // death squawk
    case 'pop': cluckV(1500 * p, 700 * p, 0, 0.025, 0.035, 'triangle'); break;                                                       // egg leaves the "gun"
    case 'crack': noise(0.035, 3200 * p, 0.09, 5); cluckV(2000 * p, 1200 * p, 0, 0.02, 0.02, 'square'); break;                       // egg hits
    case 'chime': for (let i = 0; i < 3; i++) cluckV([1318, 1568, 2093][i] * (p * 0.1 + 0.95), [1318, 1568, 2093][i], i * 0.055, 0.12, 0.035, 'triangle'); break;
  } }
{ const _s = sfx; sfx = function (n) { _s(n);
    if (n === 'mg') { if (sndOk('pop', 0.11)) bokSnd('pop'); } else if (n === 'shotgun') { if (sndOk('pop', 0.05)) { bokSnd('pop'); bokSnd('crack'); } }
    if ((n === 'mg' || n === 'shotgun') && Math.random() < 0.06 && sndOk('battle', 1.6)) bokSnd(Math.random() < 0.5 ? 'bwak' : 'bokbok');
    else if (n === 'splat' && sndOk('zdie', 0.09)) bokSnd('zdie');
    else if (n === 'windup' && sndOk('zwind', 0.3)) bokSnd('zwind');
    else if (n === 'zpeck' && STATE === 'game' && G && G.state === 'play' && sndOk('zcluck', 0.5)) bokSnd('zcluck');
    else if (n === 'hurt' && sndOk('squawk', 0.12)) bokSnd('squawk');
    else if (n === 'pick' && sndOk('happy', 0.15)) { bokSnd('happy'); bokSnd('chime'); } }; }
{ const _h = hurtZombie; hurtZombie = function (z, ...a) { const was = z.alive; _h(z, ...a); if (was && z.alive && sndOk('crack', 0.06)) bokSnd('crack'); }; }
{ const _sp = spawnZombie; spawnZombie = function (...a) { const z = _sp(...a); if (z && STATE === 'game' && G && G.state === 'play' && Math.random() < 0.35 && sndOk('zgroan', 0.7)) bokSnd(Math.random() < 0.5 ? 'zgroan' : 'zcluck'); return z; }; }
// ---- REAL clips (v21): the announcers + Street Fighter II UI sounds. All are the original game audio (no TTS, no recreations), used
// under the site owner's parody license: Halo: Reach multiplayer announcer (c) Microsoft / Bungie (sfx/halo/), Unreal Tournament (UT99)
// announcer (c) Epic Games (sfx/ut/), Street Fighter II Turbo SNES UI sounds (c) Capcom (sfx/sf2/). Sources: the README in each folder.
// Mix: HALO says 'Slayer' at the start, the multi-kill chain (Double Kill ... Killionaire) and 'Game Over'; UT says First Blood and the big
// no-hit streak tiers. ?announcer=original swaps the voices for the old synthesized voice (sfx/original/), ?announcer=0 silences them.
// Every file is fetched at page load (small mp3s), decoded once the audio unlocks, and played through the master bus (so mute works).
// RARE triggers: one global cooldown (ANN_CD s) shared by both announcers; routine kills never speak.
const ANN = { mode: /[?&]announcer=0\b/.test(location.search) ? 'off' : /[?&]announcer=original\b/.test(location.search) ? 'original' : 'real', buf: {}, src: {}, raw: {}, cur: null, curP: 0, curEnd: 0, lastT: -99,
  chain: 0, evT: -9, pend: 0, pendT: 0, q: null, kills: 0 };
const ANN_FILES = ANN.mode === 'original'
  ? { slayer: 'original/slayer', double: 'original/double', triple: 'original/triple', overkill: 'original/overkill', killtacular: 'original/killtacular', spree: 'original/spree', rampage: 'original/rampage', dominating: 'original/frenzy', unstoppable: 'original/unstoppable', godlike: 'original/untouchable', gameover: 'original/gameover' }
  : { slayer: 'halo/slayer', double: 'halo/double', triple: 'halo/triple', overkill: 'halo/overkill', killtacular: 'halo/killtacular', killtrocity: 'halo/killtrocity', killamanjaro: 'halo/killamanjaro', killtastrophe: 'halo/killtastrophe', killpocalypse: 'halo/killpocalypse', killionaire: 'halo/killionaire', gameover: 'halo/gameover',
      firstblood: 'ut/firstblood', spree: 'ut/spree', rampage: 'ut/rampage', dominating: 'ut/dominating', unstoppable: 'ut/unstoppable', godlike: 'ut/godlike' };
const UI_FILES = { cursor: 'sf2/cursor', select: 'sf2/select', mode: 'sf2/mode', slam: 'sf2/slam' }; // SF2: cursor move, character-select confirm, mode select, fierce-hit thunk
const ANN_CD = 13, ANN_MULTI_GAP = 0.6, ANN_SAME = 0.05; // global cooldown (s) | max gap between kills in a multi-kill | kills this close = one blast
const MULTI_LINE = (n) => (n >= 10 ? 'killionaire' : ['', '', 'double', 'triple', 'overkill', 'killtacular', 'killtrocity', 'killamanjaro', 'killtastrophe', 'killpocalypse'][n] || null);
const STREAK_LINE = { 25: 'spree', 50: 'rampage', 100: 'dominating', 200: 'unstoppable', 300: 'godlike' }; // kills in a row without being hit (UT)
// preload: raw bytes now, decode when the AudioContext exists
for (const [k, f] of Object.entries(ANN.mode === 'off' ? UI_FILES : Object.assign({}, ANN_FILES, UI_FILES))) { ANN.src[k] = f.split('/')[0];
  ANN.raw[k] = fetch('sfx/' + f + '.mp3?v=21').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null); }
function annLoad() { if (ANN.decoding || !AC) return; ANN.decoding = true;
  for (const [k, pr] of Object.entries(ANN.raw)) pr.then((ab) => ab && new Promise((res, rej) => AC.decodeAudioData(ab, res, rej))).then((b) => { if (b) ANN.buf[k] = b; }).catch(() => {}); }
{ const _ai = audioInit; audioInit = function () { _ai(); try { annLoad(); } catch (e) {} }; }
function annNow() { return performance.now() / 1000; }
// SF2 UI sound (waits up to 0.4 s for its decode on the very first gesture)
function uiSnd(k, rate = 1, gain = 0.9, tries = 0) { if (!AC) return false; const b = ANN.buf[k]; if (!b) { if (tries < 8 && ANN.raw[k]) setTimeout(() => uiSnd(k, rate, gain, tries + 1), 50); return false; }
  const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain; s.connect(g); g.connect(master); s.start(); (window.__ltUi = window.__ltUi || []).push(k); return true; }
function announce(k, prio = 1, force = false) { if (ANN.mode === 'off' || !ANN_FILES[k] || PWR.off) return false; const t = annNow();
  if (!force && t - ANN.lastT < ANN_CD) return false; // the shared global cooldown (Slayer / Game Over use force)
  (window.__ltAnnTry = window.__ltAnnTry || []).push(k); ANN.lastT = t; if (!AC) return false; const b = ANN.buf[k]; if (!b) return false; const now = AC.currentTime;
  if (ANN.cur && now < ANN.curEnd) { if (prio <= ANN.curP) return false; try { ANN.cur.stop(); } catch (e) {} }
  const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; g.gain.value = 1.15; s.connect(g); g.connect(master); s.start(); ANN.cur = s; ANN.curP = prio; ANN.curEnd = now + b.duration;
  musicDuck(0.45, b.duration + 0.15); (window.__ltAnn = window.__ltAnn || []).push(k); return true; }
// multi-kill = kill EVENTS each <= 0.6 s after the last (kills within 50 ms, e.g. one shotgun blast, count as one event), said 0.35 s after it ends
{ const _k = achKill; achKill = function (z) { _k(z); if (!G || G.state !== 'play') return; const t = annNow(); ANN.kills++;
    if (ANN.kills === 1 && ANN_FILES.firstblood) ANN.q = { k: 'firstblood', hit: -1, exp: t + 20 }; // waits out the Slayer cooldown, gives up after 20 s
    if (t - ANN.evT > ANN_SAME) { ANN.chain = t - ANN.evT <= ANN_MULTI_GAP ? ANN.chain + 1 : 1; ANN.evT = t; if (ANN.chain >= 2) { ANN.pend = ANN.chain; ANN.pendT = t + 0.35; } }
    const st = G.rs ? G.rs.streak : 0; if (STREAK_LINE[st]) ANN.q = { k: STREAK_LINE[st], hit: G.hitN || 0, exp: t + 30 }; }; }
setInterval(() => { if (!G || G.state !== 'play' || STATE !== 'game') { ANN.pend = 0; ANN.q = null; return; } const t = annNow(), q = ANN.q;
  if (q && ((q.hit >= 0 && (G.hitN || 0) !== q.hit) || t > q.exp)) ANN.q = null; // streak broken (or too late) before it could be said: drop it
  else if (q && t - ANN.lastT >= ANN_CD) { ANN.q = null; announce(q.k, 2); } // queued lines wait out the cooldown, then get one try
  if (ANN.pend && t >= ANN.pendT) { const n = ANN.pend; ANN.pend = 0; const k = MULTI_LINE(n); if (k && !ANN.q) announce(k, 1); } }, 50); // a multi-kill inside the cooldown is dropped
{ const _ng = newGame; newGame = function () { _ng(); ANN.chain = 0; ANN.pend = 0; ANN.q = null; ANN.evT = -9; ANN.kills = 0; setTimeout(() => { if (STATE === 'game' && G && G.state === 'play') announce('slayer', 3, true); }, 350); }; }
{ const _d = die; die = function (cause) { _d(cause); ANN.pend = 0; ANN.q = null; announce('gameover', 4, true); }; }
// ================================================================ v19 power-on boot: the handheld starts OFF every visit (nothing remembered).
// Slide (or tap) the power switch, or press Enter / Space / P: the screen fades in, the music starts (that gesture unlocks WebAudio),
// a <5 s cinematic intro plays (the hen running for her life, close-ups of the undead flock), then the title pops up. Shoot skips it.
// Sliding the switch off turns the game off again (P toggles too). ?handheld=0 (no shell) or ?boot=0 skips all of this.
const INTRO = { t: 0, T: 5.6, cuts: [0, 1.7, 2.8, 3.9], popAt: -9, shot: -1 }; // v20: silo intro
function bootOn() { resize(); setTimeout(resize, 60); setTimeout(resize, 400); STATE = 'intro'; INTRO.t = 0; INTRO.shot = -1; INTRO.slam = false; setTimeout(() => uiSnd('mode'), 30); /* v21 SF2 power-on */ G = null; zombiePool.length = 0; itemPool.length = 0; NE.on = false; if (_flockPopEl) { _flockPopEl.remove(); _flockPopEl = null; } queue.length = 0; for (const k in held) held[k] = 0; }
function bootOff() { STATE = 'off'; NE.on = false; if (_flockPopEl) { _flockPopEl.remove(); _flockPopEl = null; } skinBegin(); skinEnd(); }
// v22 power audio: OFF = quick fade (80 ms) of everything, the announcer clip is stopped and its queue cleared, the music scheduler idles,
// then the AudioContext is suspended (no CPU, no stray notes). ON = resume, the gate opens and the polka restarts from bar 1 with the same
// fade-in as the first boot. One music scheduler for the page lifetime (musicStart runs once), so off/on cycles never stack loops.
function powerAudio(on) { PWR.off = !on; clearTimeout(PWR.susT); if (!AC) return; const now = AC.currentTime;
  if (!on) { PWR.cycles++; if (PWR.gain) { PWR.gain.gain.cancelScheduledValues(now); PWR.gain.gain.setValueAtTime(PWR.gain.gain.value, now); PWR.gain.gain.linearRampToValueAtTime(0, now + 0.08); }
    if (ANN.cur) { try { ANN.cur.stop(now + 0.09); } catch (e) {} } ANN.cur = null; ANN.q = null; ANN.pend = 0;
    if (MUS.bus) { MUS.bus.gain.cancelScheduledValues(now); MUS.bus.gain.setTargetAtTime(0, now, 0.03); }
    PWR.susT = setTimeout(() => { if (PWR.off && AC && AC.state === 'running') AC.suspend().catch(() => {}); }, 250); return; }
  const open = () => { const t = AC.currentTime; if (PWR.gain) { PWR.gain.gain.cancelScheduledValues(t); PWR.gain.gain.setValueAtTime(1, t); }
    if (MUS.bus) { MUS.bus.gain.cancelScheduledValues(t); MUS.bus.gain.setValueAtTime(0, t); MUS.bus.gain.setTargetAtTime(0.5, t, 0.6); } MUS.nextT = t + 0.1; MUS.step = 0; MUS.bar = 0; MUS.duck = 1; MUS.duckT = 0; };
  if (AC.state === 'suspended') AC.resume().then(open, open); else open(); }
{ const _off = bootOff, _on = bootOn; bootOff = function () { _off(); powerAudio(false); }; bootOn = function () { _on(); powerAudio(true); ILB.show = null; ilbFetch(); }; }
// v22 hidden tab: the game loop (rAF) stops but timers keep ticking at ~1 Hz, so the 0.16 s music lookahead came out as
// choppy blips in a background tab. Hidden = suspend the AudioContext; visible again = resume (unless powered off or muted).
document.addEventListener('visibilitychange', () => { if (!AC) return;
  if (document.hidden) { PWR.hidden = true; if (AC.state === 'running') AC.suspend().catch(() => {}); return; }
  PWR.hidden = false; if (PWR.off || muted) return; const go = () => { MUS.nextT = AC.currentTime + 0.05; }; if (AC.state === 'suspended') AC.resume().then(go, go); else go(); });
function introEnd() { if (STATE !== 'intro') return; STATE = 'title'; INTRO.popAt = T0; sfx('dawn'); }
if (LT_BOOT) {
  addEventListener('handheld:power', (e) => { if (e.detail && e.detail.on === false) bootOff(); else bootOn(); });
  const H = () => (window.Handheld && window.Handheld.current) || null;
  const unlock = () => { audioInit(); if (AC && AC.state === 'suspended') try { AC.resume(); } catch (e) {} };
  // the switch's own handler runs first (starts its 1.25 s boot); inside the same gesture we finish the boot instantly + unlock audio
  const hook = () => { const h = H(); const pw = document.querySelector('.hh-pwr'); if (!h || !pw) return false; if (pw.__ltHooked) return true; pw.__ltHooked = true;
    pw.addEventListener('pointerup', () => { const hh = H(); if (hh && hh.power) { hh.setPower(true, true); unlock(); } });
    if (!h.power) return true; h.setPower(false, true); return true; }; // every visit starts OFF
  { let n = 0; const tk = setInterval(() => { if (hook() || ++n > 120) { clearInterval(tk); if (!H()) { STATE = STATE === 'off' ? 'title' : STATE; } } }, 25); } // no shell after 3 s: just play
  addEventListener('keydown', (e) => { if (e.handheldPower) return; const h = H(); if (!h) return; const k = keyName(e);
    if (!h.power && (k === ' ' || k === 'Enter' || k === 'p')) { e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return; h.setPower(true, true); unlock(); }
    else if (h.power && k === 'p' && !nameEntryOn()) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) h.setPower(false); } }, true);
}
// ---- the intro: hand-cut shots, pixel-crisp (integer scales of the real hens.farm pixel sprites), letterboxed, hard cuts with a white pop
function sprDraw(s, row, col, x, y, k, shadow = true, tint) { const cw = s.cw, ch = s.ch, nf = s.nf || 4; col = col % nf; x = Math.round(x); y = Math.round(y);
  if (shadow) hx.drawImage(s.shd, col * cw, row * ch, cw, ch, x + k, y + k, cw * k, ch * k); hx.drawImage(tint ? s[tint] : s.img, col * cw, row * ch, cw, ch, x, y, cw * k, ch * k); }
function introBg(t, speed, a, b, horizon) { const hy = Math.round(N * horizon); hx.fillStyle = a; hx.fillRect(0, 0, N, hy); hx.fillStyle = b; hx.fillRect(0, hy, N, N - hy);
  const off = (t * speed) % 32; hx.fillStyle = 'rgba(9,11,10,.18)'; for (let x = -32; x < N + 32; x += 32) hx.fillRect(Math.round(x - off), hy + 2, 14, N); // ground stripes rushing past
  hx.fillStyle = '#ffc42f'; for (let x = -64; x < N + 64; x += 64) hx.fillRect(Math.round(x - (t * speed * 1.6) % 64), Math.round(N * 0.82), 30, 3); // track dashes (faster: parallax)
  hx.fillStyle = OUT; hx.fillRect(0, hy, N, 1); }
function speedLines(t, col, n = 26) { const r = rng(7); for (let i = 0; i < n; i++) { const y = Math.round(r() * N), L = 20 + r() * 60, x = ((r() * N - t * (500 + r() * 400)) % (N + 80) + N + 80) % (N + 80) - 40; hx.fillStyle = col; hx.fillRect(Math.round(x), y, Math.round(L), 1 + (i % 3 === 0)); } }
// v20 (Zombie Farm) intro: a BUFF hen on top of the farm silo, dual-wielding two machine guns, mowing down waves of zombie hens below.
// WIDE -> CLOSE-UP (guns blazing) -> GROUND (zombies popping, red bits) -> WIDE + 'ZOMBIE FARM' title slam. 5.6 s, shoot skips.
const BUFF = new Image(); BUFF.src = 'buff-hen.png?v=20'; const BUFF_MZ = [[31, 30], [48, 30]]; // muzzle tips in the 50x48 art
let _silo = null;
function siloImg() { if (_silo) return _silo; const w = 44, h = 132, [c, x] = mk(w + 2, h + 2), R = (X, Y, W, H, col) => { x.fillStyle = col; x.fillRect(X + 1, Y + 1, W, H); };
  // dome (galvanised steel) + red brick-ish staves, ink outline, warm dusk rim on the west edge
  for (let y = 0; y < 18; y++) { const half = Math.round(w / 2 * Math.sqrt(1 - Math.pow((18 - y) / 18, 2))); R(w / 2 - half, y, half * 2, 1, y < 3 ? '#cfd4d8' : '#9aa2a8'); R(w / 2 - half, y, 2, 1, '#ffd08a'); }
  R(0, 18, w, h - 18, '#b5342c'); for (let X = 0; X < w; X += 6) R(X, 18, 1, h - 18, '#8c2420'); R(w - 8, 18, 8, h - 18, '#7a1f1c'); R(0, 18, 3, h - 18, '#ff9a5a');
  for (let Y = 26; Y < h; Y += 12) R(0, Y, w, 2, '#5e1814'); R(0, 18, w, 3, '#6b737a');
  R(w / 2 - 6, h - 24, 12, 24, '#3a1a14'); R(w / 2 - 5, h - 23, 10, 22, '#5a2a1c'); // door
  for (let Y = 30; Y < h - 30; Y += 6) R(w - 14, Y, 6, 1, '#d8d8d8'); R(w - 14, 28, 1, h - 56, '#d8d8d8'); R(w - 9, 28, 1, h - 56, '#d8d8d8'); // ladder
  const im = x.getImageData(0, 0, w + 2, h + 2), d = im.data, o = new Uint8ClampedArray(d); // 1px ink outline
  for (let y = 0; y < h + 2; y++) for (let X = 0; X < w + 2; X++) { const i = (y * (w + 2) + X) * 4; if (d[i + 3]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w + 2 || yy >= h + 2) continue; if (d[(yy * (w + 2) + xx) * 4 + 3]) { o[i] = 9; o[i + 1] = 11; o[i + 2] = 10; o[i + 3] = 255; break; } } }
  im.data.set(o); x.putImageData(im, 0, 0); return (_silo = c); }
function introSky(t, hz) { const H = Math.round(N * hz), g = hx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1b52'); g.addColorStop(0.55, '#a8456a'); g.addColorStop(1, '#ff9a48'); hx.fillStyle = g; hx.fillRect(0, 0, N, H);
  hx.fillStyle = '#ffd36a'; const sr = Math.round(N * 0.07), sx = Math.round(N * 0.12), sy = H - Math.round(sr * 0.6); hx.beginPath(); hx.arc(sx, sy, sr, 0, 6.283); hx.fill(); // low sun in the west
  hx.fillStyle = '#3a2148'; const r = rng(3); for (let x = 0; x < N; x += 6) { const hh = 3 + Math.round(r() * 5); hx.fillRect(x, H - hh, 6, hh); } // far tree line
  hx.fillRect(Math.round(N * 0.66), H - 16, 26, 16); hx.beginPath(); hx.moveTo(N * 0.66 - 2, H - 16); hx.lineTo(N * 0.66 + 13, H - 26); hx.lineTo(N * 0.66 + 28, H - 16); hx.fill(); // far barn
  hx.fillStyle = '#5a4a2e'; hx.fillRect(0, H, N, N - H); hx.fillStyle = '#6e5a34'; for (let y = H + 4; y < N; y += 7) hx.fillRect(0, y, N, 2); // dusk field
  hx.fillStyle = OUT; hx.fillRect(0, H, N, 1); return H; }
const ZI = { z: [], p: [], tr: [], fire: 0, seed: 1 };
function ziReset() { ZI.z.length = 0; ZI.p.length = 0; ZI.tr.length = 0; ZI.fire = 0; ZI.init = false; }
function ziPop(x, y, k) { for (let i = 0; i < 9; i++) ZI.p.push({ x, y, vx: (Math.random() - 0.4) * 90 * k, vy: -40 * k - Math.random() * 70 * k, t: 0, T: 0.7 + Math.random() * 0.4, c: i % 3 ? '#c81e30' : i % 2 ? '#56703f' : '#8a1020', s: Math.max(1, Math.round(k)) }); }
function ziStep(dt, k, gy, sx0, sx1, spawnX, dir) { // zombie wave walkers + bursts (positions in screen px)
  if (!ZI.init) { ZI.init = true; for (let i = 0; i < 11; i++) ZI.z.push({ x: N * (sx0 + i * 0.065) + Math.random() * 8, y: gy + Math.round(Math.random() * 18 * k) - 6 * k, v: (22 + Math.random() * 18) * k, i: i % 3, alive: true, a: Math.random() * 4 }); }
  if (ZI.z.filter((z) => z.alive).length < 12 && Math.random() < dt * 14) ZI.z.push({ x: spawnX + Math.random() * 30 * dir * -1, y: gy + Math.round(Math.random() * 18 * k) - 6 * k, v: (22 + Math.random() * 18) * k, i: Math.floor(Math.random() * 3), alive: true, a: Math.random() * 4 });
  for (const z of ZI.z) if (z.alive) { z.x -= z.v * dt * dir; z.a += dt * 10; }
  for (const q of ZI.p) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * k * dt; }
  ZI.p = ZI.p.filter((q) => q.t < q.T); ZI.tr = ZI.tr.filter((q) => (q.t += dt) < 0.07); ZI.z = ZI.z.filter((z) => z.alive && z.x > -60 && z.x < N + 80); }
function ziDraw(k) { const Z = SPR.zombies; for (const z of [...ZI.z].sort((a, b) => a.y - b.y)) sprDraw(Z[z.i], 2, Math.floor(z.a), z.x - 15 * k, z.y - 33 * k, k);
  for (const q of ZI.p) { hx.fillStyle = OUT; hx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, q.s + 2, q.s + 2); hx.fillStyle = q.c; hx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); } }
function ziShoot(mx, my, k) { const live = ZI.z.filter((z) => z.alive && z.x > mx + 10); if (!live.length) return; const z = live[Math.floor(Math.random() * live.length)], tx = z.x, ty = z.y - 14 * k;
  ZI.tr.push({ x0: mx, y0: my, x1: tx, y1: ty, t: 0 }); if (Math.random() < 0.55) { z.alive = false; ziPop(tx, ty, k); } }
function ziTracers() { for (const q of ZI.tr) { pixLine(q.x0, q.y0 + 1, q.x1, q.y1 + 1, OUT); pixLine(q.x0, q.y0, q.x1, q.y1, '#ffc42f'); const e = 0.6 + q.t * 5; hx.fillStyle = '#fffdf5'; hx.fillRect(Math.round(q.x0 + (q.x1 - q.x0) * Math.min(1, e)) - 1, Math.round(q.y0 + (q.y1 - q.y0) * Math.min(1, e)) - 1, 3, 2); } }
function flash(x, y, k, big) { const r = Math.round((big ? 5 : 3) * k); hx.fillStyle = '#fff6c8'; hx.fillRect(x - r, y - 1, r * 2 + 2, 3); hx.fillRect(x, y - r, 3, r * 2 + 2); hx.fillStyle = '#ffc42f'; hx.fillRect(x - Math.round(r / 2), y - Math.round(r / 2), r + 2, r + 2); hx.fillStyle = '#ffffff'; hx.fillRect(x, y, 2, 2); }
function buffDraw(x, y, k, t, fire) { if (!BUFF.complete || !BUFF.naturalWidth) return; const rec = fire ? Math.round(Math.sin(t * 60) * k * 0.6) : 0; hx.drawImage(BUFF, Math.round(x) - rec, Math.round(y), 50 * k, 48 * k);
  if (fire) BUFF_MZ.forEach(([mx, my], i) => { if ((Math.floor(t * 30) + i) % 2) flash(Math.round(x + mx * k) - rec, Math.round(y + my * k), k, k > 2); }); }
// v22: the hen must always STAND on the silo. domeTop() = the close-up's silo roof: a wide galvanised dome cap (pixel rows, radial seams,
// rivets, ink top contour, warm west rim) whose apex sits 2 art-px under the feet, so his whole stance rests on it. feetShadow() = contact shadow.
function domeTop(cx, feetY, k) { const R = 70 * k, top = feetY - 2 * k, y1 = N; hx.fillStyle = OUT;
  for (let y = top; y < y1; y++) { const d = y - top, half = Math.round(Math.sqrt(Math.max(0, 2 * R * d - d * d))); if (half <= 0) continue; const x0 = Math.round(cx - half), w = half * 2;
    hx.fillStyle = OUT; hx.fillRect(x0 - k, y, w + 2 * k, 1); // ink contour
    hx.fillStyle = d < 3 * k ? '#cfd4d8' : d < 9 * k ? '#aeb5ba' : '#9aa2a8'; hx.fillRect(x0, y + (d < k ? k - d : 0), w, 1);
    hx.fillStyle = '#ffd08a'; hx.fillRect(x0, y, Math.max(1, Math.round(k * 1.5)), 1); // golden dusk rim (sun in the west)
    hx.fillStyle = '#7d858c'; for (let a = -3; a <= 3; a++) { const sx = Math.round(cx + a * 12 * k * Math.min(1, d / (20 * k) + 0.35)); if (sx > x0 + k && sx < x0 + w - k) hx.fillRect(sx, y, Math.max(1, k >> 1), 1); } } // radial seams
  hx.fillStyle = '#6b737a'; for (let a = -3; a <= 3; a++) for (let r = 1; r < 6; r++) { const yy = top + r * 7 * k, d = yy - top, sx = Math.round(cx + a * 12 * k * Math.min(1, d / (20 * k) + 0.35) + 3 * k); if (yy < y1) hx.fillRect(sx, yy, k, k); } } // rivets
function feetShadow(cx, feetY, k, wArt = 32) { hx.fillStyle = 'rgba(9,11,10,.42)'; const rx = wArt / 2 * k, ry = Math.max(1, Math.round(1.6 * k));
  for (let y = -ry; y <= ry; y++) { const h = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); hx.fillRect(Math.round(cx - h), Math.round(feetY + y), h * 2, 1); } }
// ---- v26 intro TOP 10: a LARGE overlay that falls down the whole screen over the intro (centred, 2-3x pixel font with a heavy ink
// outline + drop shadow, a light see-through strip per row). Stacked bottom-up so the TOP 10 header enters first, then #1 ... #10.
// One pass from 0.4 s to 5.4 s. Only shows rows the page-load / power-on fetch already has at 0.4 s; nothing ready = no overlay, the
// intro never waits. At most 10 rows. Single-line rows (rank, name, time) when they fit, else name on one line and rank + time below.
const ilbFmt = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' + Math.floor(ms / 100) % 10; };
const ILB_INK = '#0e090c';
function bigText(str, x, y, k, col, align) { const img = textImg(str, 8, col, false), ink = textImg(str, 8, ILB_INK, false), w = img.width * k, h = img.height * k;
  const dx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), dy = Math.round(y);
  hx.drawImage(ink, dx + k + 1, dy + k + 1, w, h); // drop shadow
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) hx.drawImage(ink, dx + ox * k, dy + oy * k, w, h); // 1 font-pixel ink outline
  hx.drawImage(img, dx, dy, w, h); return w; }
const ILB_RUN = 2.0; // s of scrolling (from 0.4 s) before the ~3 s hold
function ilbLayout() { if (INTRO.t < 0.4) { ILB.show = null; return null; }
  if (ILB.show === null) { ILB.show = ILB.rows && ILB.rows.length ? ILB.rows.slice(0, 10) : false;
    if (ILB.show) { const r = ILB.show, W = (q) => textImg(q, 8, '#fff', false).width, rw = Math.max(...r.map((e) => W('#' + e.rank))), nw = Math.max(...r.map((e) => W(e.name))), tw = Math.max(...r.map((e) => W(ilbFmt(e.ms)))), one = rw + 6 + nw + 10 + tw;
      let k = 3; while (k > 2 && one * k > N - 10) k--; ILB.two = one * k > N - 10; ILB.k = k; ILB.rw = rw; ILB.nw = nw; ILB.tw = tw;
      ILB.rowW = (ILB.two ? Math.max(rw + 6 + nw, tw + rw + 6) : one) * k; ILB.lh = (ILB.two ? 20 * k + 4 : 10 * k + 5); ILB.head = 10 * k + 12; } }
  return ILB.show ? ILB : null; }
function ilbDraw(t) { const L = ilbLayout(); if (!L) return; const rows = L.show, k = L.k, lh = L.lh, n = rows.length, bar = Math.round(N * 0.08);
  // credits-style countdown: the list (TOP 10 header, #1 .. #n top to bottom) falls in from above, so #n shows first and #1 last;
  // fast through the lower ranks, easing out (quadratic) by 2.4 s, then HOLDS with the header + top ranks on screen until the intro ends
  const ys = bar - L.head - n * lh, ye = bar + 4, q = Math.max(0, Math.min(1, (t - 0.4) / ILB_RUN)), pr = 1 - (1 - q) * (1 - q);
  const a = Math.min(1, (t - 0.4) / 0.2, Math.max(0, (INTRO.T - 0.05 - t) / 0.2)), y0 = Math.round(ys + pr * (ye - ys));
  const x0 = Math.round(N / 2 - L.rowW / 2), x1 = x0 + L.rowW;
  hx.save(); hx.globalAlpha = a;
  if (y0 < N && y0 + 10 * k > 0) { hx.fillStyle = 'rgba(9,11,10,.3)'; hx.fillRect(0, y0 - 3, N, 10 * k + 4); bigText('TOP 10', N / 2, y0, k, HGOLD, 'center'); }
  // once ZOMBIE FARM slams in (shot 3, +0.45 s) the rows behind the title band fade back to 25% so the title reads; rows clear of it stay full
  const sl = t - INTRO.cuts[3] - 0.45, dimA = sl > 0 ? a * (1 - 0.75 * Math.min(1, sl / 0.15)) : a, tb0 = N * 0.38, tb1 = N * 0.66;
  rows.forEach((r, i) => { const y = y0 + L.head + i * lh; if (y > N || y + lh < 0) return; hx.globalAlpha = y + lh - 5 > tb0 && y - 2 < tb1 ? dimA : a;
    hx.fillStyle = 'rgba(9,11,10,.26)'; hx.fillRect(0, y - 2, N, lh - 3);
    const rc = r.rank === 1 ? HGOLD : r.rank <= 3 ? '#ffd98a' : '#cfe9b8';
    if (!L.two) { bigText('#' + r.rank, x0 + L.rw * k, y, k, rc, 'right'); bigText(r.name, x0 + (L.rw + 6) * k, y, k, CREAM, 'left'); bigText(ilbFmt(r.ms), x1, y, k, '#ff8a8a', 'right'); }
    else { bigText(r.name, x0 + (L.rw + 6) * k, y, k, CREAM, 'left'); bigText('#' + r.rank, x0 + L.rw * k, y + 10 * k + 2, k, rc, 'right'); bigText(ilbFmt(r.ms), x0 + (L.rw + 6) * k, y + 10 * k + 2, k, '#ff8a8a', 'left'); } });
  hx.restore(); ILB.drawn = (ILB.drawn || 0) + 1; ILB.lastY = y0; ILB.x0 = x0; ILB.x1 = x1; ILB.bar = bar; }
function drawIntro(dt) {
  INTRO.t += dt; const t = INTRO.t, C = INTRO.cuts; if (t >= INTRO.T) { introEnd(); return; }
  if (t - dt <= 0) ziReset();
  skinBegin(); skinEnd(); hx.imageSmoothingEnabled = false;
  const shot = t < C[1] ? 0 : t < C[2] ? 1 : t < C[3] ? 2 : 3, st = t - C[shot], u = N / 256;
  if (shot !== INTRO.shot) { INTRO.shot = shot; ziReset(); }
  const shake = (a) => [Math.round((Math.random() - 0.5) * a), Math.round((Math.random() - 0.5) * a)];
  if (shot === 0 || shot === 3) { // WIDE: silo on the left, the buff hen on the dome, the undead flock pouring in from the right
    const H = introSky(t, 0.6), k = Math.max(1, Math.round(u)), sk = Math.max(1, Math.round(u)), si = siloImg(), [ox, oy] = shake(shot === 3 && st > 0.5 && st < 0.8 ? 8 : 1.5);
    const sx = Math.round(N * 0.12) + ox, sy = Math.round(N * 0.9) - si.height * sk + oy, gy = Math.round(N * 0.84);
    ziStep(dt, k, gy, 0.45, N, N + 20, 1);
    hx.drawImage(si, sx, sy, si.width * sk, si.height * sk);
    const bx = sx + Math.round(si.width * sk / 2) - 25 * k, by = sy + 6 * sk - 47 * k; feetShadow(bx + 24 * k, by + 46 * k, k, 30); buffDraw(bx, by, k, t, true); // v22: feet on the dome (row 6: 30+ px wide), not its tip
    ZI.fire -= dt; if (ZI.fire <= 0) { ZI.fire = 0.05; const m = BUFF_MZ[Math.floor(t * 20) % 2]; ziShoot(bx + m[0] * k, by + m[1] * k, k); }
    ziDraw(k); ziTracers();
  } else if (shot === 1) { // CLOSE-UP: guns blazing against the dusk sky, casings flying
    const k = Math.max(3, Math.floor(N * 0.62 / 50)), [ox, oy] = shake(4); introSky(t * 0.5, 0.95);
    const bx = Math.round(N * 0.5 - 25 * k - st * 10 * u) + ox, by = Math.round(N * 0.56 - 24 * k) + oy, fy = by + 46 * k; domeTop(bx + 24 * k, fy + k, k); feetShadow(bx + 24 * k, fy + k, k); buffDraw(bx, by, k, t, true); // v22: standing on the silo roof
    for (let i = 0; i < 8; i++) { const ph = (st * 3 + i * 0.13) % 1, m = BUFF_MZ[i % 2]; const cx = bx + m[0] * k - 20 * k * 0.3 - ph * 30 * u, cy = by + m[1] * k - 8 * u - ph * 50 * u + ph * ph * 90 * u; hx.fillStyle = OUT; hx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 4 * Math.ceil(u), 3 * Math.ceil(u)); hx.fillStyle = '#ffc42f'; hx.fillRect(Math.round(cx), Math.round(cy), 2 * Math.ceil(u), Math.ceil(u)); } // ejected casings
    hx.fillStyle = 'rgba(255,196,47,.9)'; for (let i = 0; i < 6; i++) { const y0 = by + 30 * k + i * 3, x0 = bx + 48 * k + ((st * 900 + i * 37) % (N)); hx.fillRect(Math.round(x0), Math.round(y0 + (x0 - bx) * 0.25), 10 * Math.ceil(u), Math.ceil(u)); } // tracer streaks leaving frame
  } else { // GROUND: zombie hens charge the camera's left and burst under the rain of fire
    const k = Math.max(2, Math.floor(3 * u)), H = introSky(t, 0.42), gy = Math.round(N * 0.82), [ox, oy] = shake(3);
    hx.save(); hx.translate(ox, oy); ziStep(dt, k, gy, 0.2, N, N + 30, 1);
    ZI.fire -= dt; if (ZI.fire <= 0) { ZI.fire = 0.045; ziShoot(-10, -10 + Math.random() * N * 0.2, k); }
    ziDraw(k); ziTracers(); hx.restore();
  }
  const bar = Math.round(N * 0.08); hx.fillStyle = OUT; hx.fillRect(0, 0, N, bar); hx.fillRect(0, N - bar, N, bar); // letterbox
  ilbDraw(t); // v26 TOP 10 overlay: counts down #10 -> #1 fast, then holds on the top ranks; under the title slam
  // title slam in the last wide shot
  if (shot === 3 && st > 0.45 && !INTRO.slam) { INTRO.slam = true; uiSnd('slam', 0.9, 1); } // SF2 thunk on the title slam
  if (shot === 3 && st > 0.45) { const e = Math.min(1, (st - 0.45) / 0.18), sc = 1 + (1 - e) * 2.2, sz = 16, img = textImg('ZOMBIE FARM', sz, HRED, false), ink = textImg('ZOMBIE FARM', sz, INK, false), k2 = Math.max(1, Math.round((N * 0.8) / img.width * 2) / 2) * sc;
    const w = Math.round(img.width * k2), h = Math.round(img.height * k2), x = Math.round(N / 2 - w / 2), y = Math.round(N * 0.5 - h / 2);
    for (let q = 1; q <= Math.round(3 * k2 / sc); q++) hx.drawImage(ink, x + q, y + q, w, h); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) hx.drawImage(ink, x + dx, y + dy, w, h); hx.drawImage(img, x, y, w, h);
    if (e >= 1) { const s2 = textImg('BILLIONS MUST BOK.', 8, HGOLD, true); hx.drawImage(s2, Math.round(N / 2 - s2.width / 2), y + h + 6); } }
  // hard-cut white pop + fade in from the dark screen (letterbox drawn above, under the TOP 10)
  const sinceCut = shot ? t - C[shot] : 9; if (sinceCut < 0.07) { hx.fillStyle = `rgba(255,255,255,${0.9 * (1 - sinceCut / 0.07)})`; hx.fillRect(0, 0, N, N); }
  if (shot === 3 && st > 0.45 && st < 0.6) { hx.fillStyle = `rgba(255,255,255,${0.7 * (1 - (st - 0.45) / 0.15)})`; hx.fillRect(0, 0, N, N); } // slam flash
  if (t < 0.5) { hx.fillStyle = `rgba(0,0,0,${1 - t / 0.5})`; hx.fillRect(0, 0, N, N); }
  if (t > INTRO.T - 0.18) { hx.fillStyle = `rgba(255,255,255,${(t - (INTRO.T - 0.18)) / 0.18})`; hx.fillRect(0, 0, N, N); }
}
// ================================================================ main loop
let STATE = LT_BOOT ? 'off' : 'title', last = performance.now(), T0 = 0, lastCovered = false;
function updateCamera(dt, snap) {
  const tx = player.x - N / 2, ty = player.y - player.jz - 12 - N / 2;
  const k = snap ? 1 : Math.min(1, dt * 10);
  camX = lerp(camX, tx, k); camY = lerp(camY, ty, k);
  // keep the player well inside the screen and clear of the HUD corners, even at map edges
  camX = clamp(camX, -48, WPX - N + 48); camY = clamp(camY, -48, WPX - N + 48);
  camX = clamp(camX, player.x - N + 60, player.x - 60); camY = clamp(camY, player.y - N + 46, player.y - 60);
  if (G && G.shake > 0) { camX += (Math.random() - 0.5) * G.shake; camY += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 12); }
  camX = Math.round(camX); camY = Math.round(camY);
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!N) resize();
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T0 += dt;
  updateTouchLabels();
  handleButtons();
  if (STATE === 'off') { hx.fillStyle = '#000'; hx.fillRect(0, 0, N, N); return; } // v19: the handheld is off
  if (STATE === 'intro') { drawIntro(dt); return; }
  if (window.__ltFreeze && STATE === 'game') { updateCamera(0, true); lastCovered = renderWorld(0, T0); drawHUD(0, T0); return; } // test hook: hold a frame
  if (STATE === 'title') {
    if (!G) { G = { t: 40, day: 1, owned: ['fists'], state: 'title', msg: [], kills: 0, tracers: [], hits: [] }; Object.assign(player, { x: 40 * TS, y: 36 * TS, level: 0 }); for (let i = 0; i < 18; i++) spawnZombie(false, true); }
    const a = T0 * 0.15; player.x = 40 * TS + Math.sin(a) * 120; player.y = 38 * TS + Math.cos(a * 0.7) * 70;
    for (const z of zombiePool) { z.wt -= dt; if (z.wt <= 0) { z.wt = 3 + Math.random() * 4; z.wx = z.x + (Math.random() - 0.5) * 60; z.wy = z.y + (Math.random() - 0.5) * 60; } const vx = z.wx - z.x, vy = z.wy - z.y, l = Math.hypot(vx, vy); if (l > 3) { moveBody(z, vx / l * 10 * dt, vy / l * 10 * dt, 4); z.anim += dt * 3; z.fx = vx; z.fy = vy; } }
    updateCamera(dt, T0 < 0.1);
    renderWorld(dt, T0); drawHUD(dt, T0); return;
  }
  if (G.state === 'play' || G.state === 'dead') {
    const scale = G.state === 'play' ? updateClock(dt) : 1;
    if (G.state === 'play') { updatePlayer(dt); updateSurvival(dt); }
    updateZombies(dt);
    if (isNight() && Math.random() < dt * 0.03) { G.lightning = 1; setTimeout(() => sfx('thunder'), 300 + Math.random() * 900); }
    if (G.state === 'dead') G.deadT += 0; // advanced in drawDead
  }
  updateCamera(dt, false);
  lastCovered = renderWorld(dt, T0);
  if (rainGain) rainGain.gain.value = 0.03 + rainAmt * 0.04;
  drawHUD(dt, T0);
}
genWorld(); renderMap();
resize();
requestAnimationFrame(frame);
window.__lt = { get G() { return G; }, player, get state() { return STATE; }, newGame: () => { STATE = 'game'; newGame(); }, zombies: zombiePool, items: itemPool, crates, TUNE, onCrate, SPAWN, TS, lob, get N() { return N; }, setTime: (t) => { G.t = t; },
  get muted() { return muted; }, get mode() { return mode(); }, get covered() { return lastCovered; }, get cam() { return [camX, camY]; }, spawnZombie, lvlAt: (x, y) => lvl[tileAt(x, y)], kindAt: (x, y) => kind[tileAt(x, y)], props };
