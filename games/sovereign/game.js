/* SOVEREIGN v2: an open-world zombie survival + base-building tower-defence game for the MEMBERSONLY POCKET handheld.
   Scavenge a seeded 3072x3072-tile world (about 15 minutes on foot edge to edge), sell what you find, found a camp anywhere,
   build walls / traps / a bed, farm through the seasons, survive the nights (watch or skip the wave), recruit survivors.
   One bite = death. Kills give nothing. Permadeath; the run saves to localStorage while you are alive.
   All art is drawn in code (pixel art, Paper-Mario style cardboard standees that flip); all sound is synthesised with Web Audio.
   See DESIGN.md. */
'use strict';
// ================================================================ basics
const VERSION = 7;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ROOT = document.documentElement;
const QS = new URLSearchParams(location.search);
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function hash2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function hashS(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy); }
function fbm(x, y, s, o = 4) { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += vnoise(x * f, y * f, s + i * 131) * a; t += a; a *= 0.5; f *= 2.03; } return v / t; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = clamp(t, 0, 1); const qx = ax + dx * t - px, qy = ay + dy * t - py; return Math.sqrt(qx * qx + qy * qy); }
const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touchDev) ROOT.classList.add('sv-touch');
const shellOn = () => { const H = window.Handheld && window.Handheld.current; const on = ROOT.classList.contains('hh-active') && !!H && H.visible !== false; ROOT.classList.toggle('sv-shell', on); return on; };

// ================================================================ screen: one square canvas, integer device-pixel scale
const cv = $('c'), hx = cv.getContext('2d', { alpha: false });
let N = 0, KPX = 1;
const lightC = { c: null, x: null };
function resize() {
  shellOn();
  const box = $('stage').getBoundingClientRect(), dpr = Math.min(4, window.devicePixelRatio || 1);
  const css = Math.max(1, Math.min(box.width, box.height));
  const dev = Math.floor(css * dpr + 0.01);
  const k = Math.max(1, Math.ceil(dev / 260));
  const n = Math.max(160, Math.floor(dev / k));
  KPX = k;
  if (n !== N) { N = n; cv.width = N; cv.height = N; hx.imageSmoothingEnabled = false; [lightC.c, lightC.x] = mk(N, N); }
  const lay = parseFloat(getComputedStyle($('stage')).width) || box.width, sc = box.width / lay || 1;
  const sz = Math.min(css, N * k / dpr);
  const fx = (box.left + (box.width - sz) / 2) * dpr, fy = (box.top + (box.height - sz) / 2) * dpr;
  const ox = Math.round(fx) / dpr - box.left, oy = Math.round(fy) / dpr - box.top;
  Object.assign(cv.style, { width: sz / sc + 'px', height: sz / sc + 'px', left: ox / sc + 'px', top: oy / sc + 'px' });
}
addEventListener('resize', () => { resize(); setTimeout(resize, 120); });

// ================================================================ palette (shared with Zombie Farm: ink outlines, cream paper, dusk grade)
const INK = '#0a080c', CREAM = '#e8dcc4', CARD = '#8a6240', CARD2 = '#5a3a22';
const PAL = {
  grass: ['#4a7a38', '#3a6430', '#2e5226', '#1e3a1a'], tall: ['#527e3c', '#3e6630', '#325226', '#203a18'],
  dirt: ['#8a6844', '#725436', '#5a422c', '#3e2c1c'], sand: ['#c4ae78', '#a89460', '#8a7850', '#6a5a3c'],
  water: ['#3a6a88', '#2a5470', '#1e4060', '#142c48'], shallow: ['#5a8498', '#446c80', '#345868', '#244050'],
  road: ['#4a484c', '#3a383c', '#2c2a2e', '#1e1c20'], side: ['#8a8478', '#726c62', '#5a544c', '#403c36'],
  wood: ['#8a6840', '#725434', '#5a4028', '#3e2c1a'], tile: ['#9a9288', '#827a70', '#6a625a', '#4e4840'],
  conc: ['#7a7874', '#666460', '#52504c', '#3a3834'], gravel: ['#7a7064', '#665c52', '#504840', '#38322c'],
  rock: ['#6a6058', '#564c46', '#423a34', '#2c2622'], leaf: ['#2e6a30', '#245428', '#1a3e1e', '#102814'],
  pine: ['#286040', '#1e4a32', '#143626', '#0c2418'], field: ['#8a7040', '#725a34', '#5a4628', '#3e301c'],
  tilled: ['#5a3e28', '#4a3220', '#3a2618', '#281a10'], wet: ['#3e2a1a', '#321e14', '#261610', '#1a100a'],
  brick: ['#8a4034', '#723028', '#5a241e', '#3e1814'], metal: ['#7a8288', '#626a70', '#4a5258', '#343a40'],
  roofs: [['#8a3028', '#6a221c'], ['#2e4460', '#223448'], ['#3e3e44', '#2c2c32'], ['#6a4e2c', '#523c22'], ['#2a5a42', '#1e4432'], ['#6a6660', '#504c48']],
};
const DARK = 'rgba(8,6,10,0.5)';
// ================================================================ crisp pixel text: "Sovereign Serif" — an original hand-made 5x7 pixel face (v7)
// rows top->bottom, '#' = ink. 8th row = descender. Rendered with a 3-band metallic ramp + drop shadow (16-bit JRPG window text look).
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#..##', '#.#.#', '#.#.#', '#.#.#', '##..#', '.###.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'], '.': ['.', '.', '.', '.', '.', '#', '#'], ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
  ':': ['.', '#', '#', '.', '#', '#', '.'], ';': ['..', '.#', '.#', '..', '.#', '.#', '#.'], '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'], '-': ['....', '....', '....', '####', '....', '....', '....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'], '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'], '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'], ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'], "'": ['#', '#', '.', '.', '.', '.', '.'], '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'], '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'], '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'], '=': ['....', '....', '####', '....', '####', '....', '....'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'], '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  '|': ['#', '#', '#', '#', '#', '#', '#'], '·': ['.', '.', '.', '#', '.', '.', '.'], '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '→': ['.....', '...#.', '....#', '#####', '....#', '...#.', '.....'], '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '~': ['.....', '.....', '.#..#', '#.##.', '.....', '.....', '.....'],
};
const FONT = {}; for (const k in GLYPHS) { const g = GLYPHS[k], w = g[0].length, cols = []; for (let i = 0; i < w; i++) { let m = 0; for (let r = 0; r < g.length; r++) if (g[r][i] === '#') m |= 1 << r; cols.push(m); } FONT[k] = cols; }
// a compact 3x5 font for dense HUD numbers / small labels
// UI text sits on blue windows now: map the old "ink on paper" colours to window-text colours
const UIMAP = { [INK]: '#f4f4fc', '#6a5a4a': '#aab6e4', '#8a7a6a': '#7a86ac', '#5a4a3a': '#d4d8ec', '#8a6a2a': '#f4d478', '#a83a2a': '#ff8070', '#3a8a3a': '#90f080', '#3a5a8a': '#90ccff', '#3a8a5a': '#90f0b0' };
function hexRGB(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function uiCol(c) { if (UIMAP[c]) return UIMAP[c]; if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) return c; const [r, g, b] = hexRGB(c), l = (r * 0.3 + g * 0.59 + b * 0.11) / 255; if (l >= 0.5) return c; const k = 0.62 - l * 0.4; return rgbHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k); }
const textCache = new Map();
function textImg(str, col, outline, sc = 1) {
  const key = str + '|' + col + '|' + outline + '|' + sc;
  let c = textCache.get(key); if (c) return c;
  const glyphs = [...str.toUpperCase()].map((ch) => FONT[ch] || FONT['?']);
  const w0 = glyphs.reduce((a, g) => a + g.length + 1, 0) - 1;
  const w = (w0 + 3) * sc, h = 10 * sc; let x;
  [c, x] = mk(Math.max(1, w), h);
  const hi = col[0] === '#' && col.length === 7 ? shade(col, 34) : col, lo = col[0] === '#' && col.length === 7 ? shade(col, -40) : col;
  const draw = (ox, oy, fill) => { let cx = 1; for (const g of glyphs) { for (let i = 0; i < g.length; i++) for (let b = 0; b < 8; b++) if (g[i] >> b & 1) { x.fillStyle = fill || (b < 2 ? hi : b < 5 ? col : lo); x.fillRect((cx + i) * sc + ox, (b + 1) * sc + oy, sc, sc); } cx += g.length + 1; } };
  if (outline) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) draw(dx * sc, dy * sc, '#0c0a1c'); draw(sc, sc, '#0c0a1c'); draw(sc, 2 * sc, 'rgba(12,10,28,0.55)'); }
  else draw(sc, sc, 'rgba(6,6,24,0.85)');
  draw(0, 0, null);
  if (textCache.size > 1200) textCache.clear();
  textCache.set(key, c); return c;
}
function text(str, x, y, col = CREAM, align = 'left', outline = true, sc = 1) {
  if (!outline) col = uiCol(col);
  const t = textImg(String(str), col, outline, sc), tw = t.width - 2 * sc;
  const dx = align === 'center' ? Math.round(x - tw / 2) : align === 'right' ? Math.round(x - tw) : Math.round(x);
  hx.drawImage(t, dx, Math.round(y)); return tw;
}
function textW(str, sc = 1) { let w = 0; for (const ch of String(str).toUpperCase()) w += ((FONT[ch] || FONT['?']).length + 1); return (w + 1) * sc; }
function fitText(str, maxW) { str = String(str); while (str.length > 1 && textW(str) > maxW) str = str.slice(0, -1); return str; }
function rect(x, y, w, h, c) { hx.fillStyle = c; hx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function shade(hexc, d) { const n = parseInt(hexc.slice(1), 16); const f = (v) => clamp(v + d, 0, 255); return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join(''); }
// ---- 16-bit JRPG window boxes (original design): banded blue gradient, dark rim, bright bevelled border, rounded corners
const UI = { bar: 'rgba(10,14,56,0.55)', sel: 'rgba(150,176,255,0.30)', strip: 'rgba(6,8,34,0.55)', div: '#8a96d0' };
const WIN = { blue: ['#5a6ee0', '#101a62'], gold: ['#6a64c8', '#1a1858', '#f0d070'], red: ['#b84a5a', '#3a0e22', '#ffb0a0'], green: ['#4a8a7a', '#0e2a2c', '#b0f0a0'], dark: ['rgba(30,40,110,0.82)', 'rgba(8,10,40,0.82)'] };
function winBox(x, y, w, h, kind = 'blue', sh = 2) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); const K = WIN[kind] || WIN.blue;
  if (sh) rect(x + sh, y + sh, w, h, 'rgba(4,4,16,0.5)');
  hx.fillStyle = '#06061a'; hx.fillRect(x + 1, y - 1, w - 2, h + 2); hx.fillRect(x - 1, y + 1, w + 2, h - 2); hx.fillRect(x, y, w, h);
  if (kind === 'dark') { rect(x + 1, y + 1, w - 2, h - 2, K[0]); rect(x + 1, y + (h >> 1), w - 2, h - 1 - (h >> 1), K[1]); }
  else { const [a, b] = [hexRGB(K[0]), hexRGB(K[1])], bands = Math.max(2, Math.min(16, h >> 1)); for (let i = 0; i < bands; i++) { const t = i / (bands - 1), y0 = y + 1 + Math.floor((h - 2) * i / bands), y1 = y + 1 + Math.floor((h - 2) * (i + 1) / bands); rect(x + 1, y0, w - 2, y1 - y0, rgbHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))); } }
  const L = K[2] || '#e8ecfc'; hx.fillStyle = L; hx.fillRect(x + 1, y, w - 2, 1); hx.fillRect(x, y + 1, 1, h - 2); // light top/left
  hx.fillStyle = kind === 'dark' ? '#6a76b8' : shade(L.length === 7 ? L : '#e8ecfc', -70); hx.fillRect(x + 1, y + h - 1, w - 2, 1); hx.fillRect(x + w - 1, y + 1, 1, h - 2); // bevel shade
  hx.fillStyle = 'rgba(255,255,255,0.18)'; hx.fillRect(x + 2, y + 1, w - 4, 1);
}
// the old paper panels now render as windows; the fill colour picks the window tint
function panel(x, y, w, h, fill = CREAM, sh = 2) {
  const k = fill === '#ffd76a' ? 'gold' : fill === '#ff5a4a' ? 'red' : fill === '#8af06a' ? 'green' : (fill === CREAM || fill === '#efe2c4') ? 'blue' : 'dark';
  if (k === 'dark' && w <= 20 && h <= 20) { x = Math.round(x); y = Math.round(y); rect(x - 1, y - 1, w + 2, h + 2, '#06061a'); rect(x, y, w, h, fill === '#3a3040' ? '#28307a' : '#1a2058'); rect(x, y, w, 1, '#0a0e34'); rect(x, y, 1, h, '#0a0e34'); rect(x + w - 1, y + 1, 1, h - 1, '#5a66b0'); rect(x + 1, y + h - 1, w - 1, 1, '#5a66b0'); return; }
  winBox(x, y, w, h, k, sh);
}
// pointing-glove menu cursor (original 9x7 art)
const HAND_ROWS = ['..####...', '.#bbbb#..', '#bwwwwb##', '#bwwwwwwb', '#bwwwwb##', '.#bbbbb#.', '..#####..'];
let HAND = null;
function handCursor(x, y) { if (!HAND) { const [c, cx] = mk(9, 7); HAND_ROWS.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; cx.fillStyle = ch === '#' ? '#0c0a1c' : ch === 'b' ? '#a8acc8' : '#f8f8ff'; cx.fillRect(i, j, 1, 1); })); HAND = c; } hx.drawImage(HAND, Math.round(x + (((G && G.clock || 0) * 3 | 0) & 1)), Math.round(y)); }
// ================================================================ world: seeded, chunk-streamed, 3072 x 3072 tiles (~15 min on foot)
const TS = 16, WS = 3072, CH = 32, NC = WS / CH;
const T = { GRASS: 0, TALL: 1, DIRT: 2, SAND: 3, WATER: 4, SHAL: 5, ROAD: 6, LINE: 7, SIDE: 8, WOOD: 9, TILE: 10, WALL: 11, DOOR: 12, TREE: 13, ROCK: 14,
  GRAVEL: 15, BRIDGE: 16, GLASS: 17, FIELD: 18, CONC: 19, FENCE: 20, MINE: 21, BUSH: 22, FLOWER: 23, PINE: 24, TILLED: 25, WALLW: 26, WALLC: 27, SEA: 28 };
const SOLID = new Uint8Array(32); [T.WATER, T.WALL, T.TREE, T.ROCK, T.FENCE, T.PINE, T.WALLW, T.WALLC, T.SEA, T.MINE].forEach((t) => (SOLID[t] = 1));
const WALLISH = new Uint8Array(32); [T.WALL, T.WALLW, T.WALLC].forEach((t) => (WALLISH[t] = 1));
const SURF = {}; // footstep surface per tile
[[T.GRASS, 'grass'], [T.TALL, 'grass'], [T.FLOWER, 'grass'], [T.FIELD, 'grass'], [T.BUSH, 'grass'], [T.DIRT, 'dirt'], [T.TILLED, 'dirt'], [T.SAND, 'dirt'],
  [T.GRAVEL, 'gravel'], [T.ROAD, 'hard'], [T.LINE, 'hard'], [T.SIDE, 'hard'], [T.CONC, 'hard'], [T.WOOD, 'wood'], [T.BRIDGE, 'wood'], [T.DOOR, 'wood'],
  [T.TILE, 'tile'], [T.SHAL, 'water'], [T.GLASS, 'glass']].forEach(([t, s]) => (SURF[t] = s));
const TOWN_NAMES = ['MAPLE CREEK', 'DUSTWATER', 'ASHFORD', 'PINE HOLLOW', 'RED FORK', 'MILLBROOK', 'COLD SPRINGS', 'HARLOW', 'BRANDT', 'OAKRIDGE'];
const SURV_NAMES = ['MAE', 'JUNE', 'OTIS', 'RUTH', 'CAL', 'IVY', 'DEX', 'NORA', 'GUS', 'LENA', 'HANK', 'ROSA', 'ABE', 'FERN', 'MOSE', 'TESS', 'WADE', 'PIA', 'RAY', 'EDIE'];
let WD = null; // the world description (macro features), rebuilt from the seed
function genWorld(seed) {
  const R = rng(seed * 7 + 13), W = { seed, corner: (R() * 4) | 0, rivers: [], lakes: [], sets: [], roads: [], dirt: [], mines: [] };
  W.cx = (W.corner & 1) ? WS - 200 : 200; W.cy = (W.corner & 2) ? WS - 200 : 200;
  // main river: north to south, a meandering polyline; one tributary from a side edge
  let x = WS * (0.32 + R() * 0.36); const main = [];
  for (let y = -40; y <= WS + 40; y += 40) { x += (R() - 0.5) * 70 + (WS / 2 - x) * 0.02; main.push([x, y]); }
  const seg = (p, w0) => { for (let i = 0; i + 1 < p.length; i++) { const w = w0 + 1.6 * vnoise(i * 0.3, 7, seed); W.rivers.push({ ax: p[i][0], ay: p[i][1], bx: p[i + 1][0], by: p[i + 1][1], w }); } };
  seg(main, 4.2);
  { const side = R() < 0.5 ? -40 : WS + 40, j = 18 + ((R() * 30) | 0), J = main[j]; let ty = WS * (0.15 + R() * 0.25); const tri = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; const tx = lerp(side, J[0], t); ty = lerp(ty, J[1], 0.12) + (R() - 0.5) * 30; tri.push([tx, i === 24 ? J[1] : ty]); } seg(tri, 2.6); }
  W.main = main;
  const elev0 = (px, py) => clamp(1 - Math.hypot(px - W.cx, py - W.cy) / 1450, 0, 1) * 0.8 + (fbm(px / 260, py / 260, seed + 7, 3) - 0.5) * 0.55;
  W.elev = elev0;
  const riverD = (px, py) => { let d = 1e9; for (const s of W.rivers) { if (Math.abs(px - s.ax) > 80 + 40 && Math.abs(px - s.bx) > 120) continue; const e = segDist(px, py, s.ax, s.ay, s.bx, s.by) - s.w; if (e < d) d = e; } return d; };
  W.riverD = riverD;
  const far = (px, py, list, d) => list.every((s) => Math.hypot(s.x - px, s.y - py) > d + (s.r || 0));
  // the big city straddles the river
  for (let a = 0; a < 60; a++) { const i = ((0.35 + R() * 0.3) * main.length) | 0; const px = main[i][0] + (R() - 0.5) * 80, py = main[i][1];
    if (elev0(px, py) > 0.38 || a < 59 && (px < 450 || px > WS - 450 || py < 450 || py > WS - 450)) continue; W.sets.push({ kind: 'city', x: px | 0, y: py | 0, r: 280, name: 'NEW HAVEN' }); break; }
  if (!W.sets.length) W.sets.push({ kind: 'city', x: WS / 2, y: WS / 2, r: 280, name: 'NEW HAVEN' });
  const city = W.sets[0];
  // lakes
  for (let a = 0; a < 400 && W.lakes.length < 6; a++) { const px = 150 + R() * (WS - 300), py = 150 + R() * (WS - 300), rx = 22 + R() * 50, ry = 18 + R() * 40;
    if (elev0(px, py) > 0.45 || Math.hypot(px - city.x, py - city.y) < city.r + 120 || riverD(px, py) < 60 + rx || !W.lakes.every((l) => Math.hypot(l.x - px, l.y - py) > 260)) continue;
    W.lakes.push({ x: px, y: py, rx, ry }); }
  const lakeV = (px, py) => { let v = 9; for (const l of W.lakes) { const dx = (px - l.x) / l.rx, dy = (py - l.y) / l.ry; if (Math.abs(dx) > 1.6 || Math.abs(dy) > 1.6) continue; const q = dx * dx + dy * dy + (fbm(px / 18, py / 18, seed + 21, 2) - 0.5) * 0.6; if (q < v) v = q; } return v; };
  W.lakeV = lakeV;
  const wet = (px, py, m) => riverD(px, py) < m || lakeV(px, py) < 1 + m / 30;
  // towns
  let ni = 0; const names = TOWN_NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [names[i], names[j]] = [names[j], names[i]]; }
  for (let a = 0; a < 3000 && ni < 8; a++) { const px = 220 + R() * (WS - 440), py = 220 + R() * (WS - 440), r = 70 + R() * 36;
    if (elev0(px, py) > 0.5 || wet(px, py, 40) || !far(px, py, W.sets, r + 330)) continue; W.sets.push({ kind: 'town', x: px | 0, y: py | 0, r: r | 0, name: names[ni++] }); }
  // factories: two on the city's edge, one out in the country by the river
  for (let a = 0, n = 0; a < 2000 && n < 3; a++) { const ang = R() * 6.283, d = n < 2 ? city.r + 70 + R() * 60 : 400 + R() * 900;
    const px = (n < 2 ? city.x : main[(main.length * (0.2 + R() * 0.6)) | 0][0] + 60) + Math.cos(ang) * (n < 2 ? d : 40), py = (n < 2 ? city.y : main[(main.length * R()) | 0][1]) + Math.sin(ang) * (n < 2 ? d : 40);
    if (px < 120 || py < 120 || px > WS - 120 || py > WS - 120 || elev0(px, py) > 0.5 || wet(px, py, 45) || !far(px, py, W.sets, 70)) continue; W.sets.push({ kind: 'factory', x: px | 0, y: py | 0, r: 52, name: n < 2 ? 'MILLWORKS' : 'RIVER PLANT' }); n++; }
  // mines in the mountains
  for (let a = 0; a < 4000 && W.mines.length < 4; a++) { const px = 100 + R() * (WS - 200), py = 100 + R() * (WS - 200), e = elev0(px, py);
    if (e < 0.52 || e > 0.6 || wet(px, py, 30) || !far(px, py, W.sets, 120)) continue; const s = { kind: 'mine', x: px | 0, y: py | 0, r: 18, name: 'OLD MINE' }; W.sets.push(s); W.mines.push(s); }
  // highways: minimum spanning tree over city/towns/factories/mines + a few extra links
  const nodes = W.sets.slice(); const inT = [0], E = [];
  while (inT.length < nodes.length) { let best = null; for (const i of inT) for (let j = 0; j < nodes.length; j++) { if (inT.includes(j)) continue; const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); if (!best || d < best[2]) best = [i, j, d]; } inT.push(best[1]); E.push(best); }
  const extra = []; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (!E.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) extra.push([i, j, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)]);
  extra.sort((a, b) => a[2] - b[2]); E.push(...extra.slice(0, 3));
  for (const [i, j] of E) { const A = nodes[i], B = nodes[j], dirt = A.kind === 'mine' || B.kind === 'mine', L = Math.hypot(B.x - A.x, B.y - A.y);
    const mx = (A.x + B.x) / 2 + (B.y - A.y) / L * (R() - 0.5) * L * 0.25, my = (A.y + B.y) / 2 - (B.x - A.x) / L * (R() - 0.5) * L * 0.25;
    const list = dirt ? W.dirt : W.roads; list.push({ ax: A.x, ay: A.y, bx: mx, by: my, w: dirt ? 1.3 : 2.4 }, { ax: mx, ay: my, bx: B.x, by: B.y, w: dirt ? 1.3 : 2.4 }); }
  const roadD = (px, py) => { let d = 1e9; for (const s of W.roads) { const e = segDist(px, py, s.ax, s.ay, s.bx, s.by); if (e < d) d = e; } return d; };
  W.roadD = roadD;
  // farms, gas stations along the highways; hunter cabins in the forests
  for (let a = 0, n = 0; a < 3000 && n < 14; a++) { const s = W.roads[(R() * W.roads.length) | 0], t = 0.15 + R() * 0.7, L = Math.hypot(s.bx - s.ax, s.by - s.ay); if (L < 60) continue;
    const side = R() < 0.5 ? -1 : 1, ox = -(s.by - s.ay) / L * side, oy = (s.bx - s.ax) / L * side, rx = s.ax + (s.bx - s.ax) * t, ry = s.ay + (s.by - s.ay) * t, px = rx + ox * 26, py = ry + oy * 26;
    if (elev0(px, py) > 0.48 || wet(px, py, 30) || !far(px, py, W.sets, 60) || roadD(px, py) < 18) continue; W.sets.push({ kind: 'farm', x: px | 0, y: py | 0, r: 28, name: 'FARM' }); W.dirt.push({ ax: px, ay: py, bx: rx, by: ry, w: 1.2 }); n++; }
  for (let k = 0; k < W.roads.length; k += 2) { const s = W.roads[k], L = Math.hypot(s.bx - s.ax, s.by - s.ay); if (L < 260) continue; const rx = (s.ax + s.bx) / 2, ry = (s.ay + s.by) / 2;
    const ox = -(s.by - s.ay) / L, oy = (s.bx - s.ax) / L, px = rx + ox * 11, py = ry + oy * 11; if (wet(px, py, 14) || !far(px, py, W.sets, 30)) continue; W.sets.push({ kind: 'gas', x: px | 0, y: py | 0, r: 14, name: 'GAS STATION' }); }
  W.forest = (px, py) => fbm(px / 150, py / 150, seed + 11, 4);
  for (let a = 0, n = 0; a < 6000 && n < 12; a++) { const px = 100 + R() * (WS - 200), py = 100 + R() * (WS - 200); if (W.forest(px, py) < 0.62 || elev0(px, py) > 0.48 || wet(px, py, 12) || !far(px, py, W.sets, 80)) continue;
    W.sets.push({ kind: 'cabin', x: px | 0, y: py | 0, r: 12, name: 'CABIN' }); n++; }
  W.sets.forEach((s, i) => { s.id = i; s.bb = [s.x - s.r - 40, s.y - s.r - 40, s.x + s.r + 40, s.y + s.r + 40]; });
  // spawn hint: east of a town (buildings often reach ~r+P); findWalkableSpawn refines onto a road/ground tile
  const towns = W.sets.filter((s) => s.kind === 'town'); const home = towns[(R() * towns.length) | 0] || city; W.home = home.id;
  W.spawn = { x: home.x + home.r + 22, y: home.y + 0.5 };
  return W;
}
// ---- settlement layouts (lazy, deterministic)
const LAYOUTS = new Map();
const KIND_LOOT = { house: ['fridge', 'cabinet', 'dresser', 'desk', 'cabinet', 'dresser'], store: ['shelf', 'shelf', 'shelf', 'shelf', 'register', 'fridge', 'shelf', 'shelf'], hardware: ['shelf', 'toolbox', 'toolbox', 'crate', 'shelf', 'toolbox', 'crate'],
  pharmacy: ['medcab', 'medcab', 'medcab', 'shelf', 'register', 'medcab', 'cabinet'], clothing: ['rack', 'rack', 'rack', 'rack', 'register', 'rack', 'dresser'], police: ['locker', 'locker', 'gunsafe', 'desk', 'locker', 'desk'],
  garage: ['toolbox', 'toolbox', 'crate', 'gascan', 'toolbox', 'crate'], trader: [], apartment: ['fridge', 'cabinet', 'dresser', 'desk', 'fridge', 'cabinet', 'dresser', 'cabinet'], office: ['desk', 'desk', 'desk', 'cabinet', 'desk', 'desk', 'cabinet', 'desk'],
  mall: ['rack', 'rack', 'shelf', 'shelf', 'register', 'rack', 'shelf', 'register', 'rack', 'shelf'], hospital: ['medcab', 'medcab', 'cabinet', 'medcab', 'medcab', 'desk', 'medcab', 'locker'], gunstore: ['gunsafe', 'gunsafe', 'shelf', 'register', 'gunsafe', 'locker'],
  bank: ['safe', 'safe', 'desk', 'register', 'safe', 'desk'], warehouse: ['crate', 'crate', 'crate', 'toolbox', 'locker', 'crate', 'crate', 'crate', 'toolbox', 'crate'], farmhouse: ['fridge', 'cabinet', 'dresser', 'desk', 'cabinet'], barn: ['crate', 'toolbox', 'seedbox', 'gascan', 'crate', 'toolbox'],
  gasstore: ['shelf', 'shelf', 'fridge', 'register', 'shelf', 'toolbox'], shack: ['crate', 'toolbox', 'locker', 'crate'], cabin: ['cabinet', 'locker', 'fridge', 'dresser', 'cabinet'] };
const KIND_ROOF = { house: 0, store: 1, hardware: 3, pharmacy: 4, clothing: 1, police: 1, garage: 2, trader: 3, apartment: 0, office: 5, mall: 1, hospital: 5, gunstore: 2, bank: 5, warehouse: 2, farmhouse: 0, barn: 0, gasstore: 4, shack: 3, cabin: 3 };
const KIND_LABEL = { store: 'STORE', hardware: 'HARDWARE', pharmacy: 'PHARMACY', clothing: 'CLOTHES', police: 'POLICE', garage: 'GARAGE', trader: 'TRADER', mall: 'MALL', hospital: 'HOSPITAL', gunstore: 'GUNS', bank: 'BANK', gasstore: 'GAS', warehouse: 'DEPOT' };
// multi-room interiors: interior wall tiles + door gaps (painted in genChunk)
function planInterior(b, R) {
  const iw = Object.create(null), id = Object.create(null);
  const ix0 = b.x + 1, iy0 = b.y + 1, ix1 = b.x + b.w - 2, iy1 = b.y + b.h - 2;
  const W = b.w - 2, H = b.h - 2;
  const wallV = (x, y0, y1, doorAt) => { for (let y = y0; y <= y1; y++) { if (doorAt != null && y === doorAt) id[x + ',' + y] = 1; else iw[x + ',' + y] = 1; } };
  const wallH = (y, x0, x1, doorAt) => { for (let x = x0; x <= x1; x++) { if (doorAt != null && x === doorAt) id[x + ',' + y] = 1; else iw[x + ',' + y] = 1; } };
  if (W >= 5 && H >= 4) {
    const kind = b.kind;
    const housey = /house|apartment|cabin|farmhouse|office|hospital|police|bank|pharmacy|clothing|gunstore|hardware|store|gasstore|trader/.test(kind);
    const warey = /warehouse|barn|garage|mall|shack/.test(kind);
    if (W >= 8 && H >= 6 && housey) {
      const vx = ix0 + Math.floor(W * (0.38 + R() * 0.22));
      wallV(vx, iy0, iy1, iy0 + 1 + ((R() * Math.max(1, H - 3)) | 0));
      if (H >= 7) {
        const leftW = vx - ix0, rightW = ix1 - vx;
        if (leftW >= 4) wallH(iy0 + Math.floor(H * (0.42 + R() * 0.18)), ix0, vx - 1, ix0 + 1 + ((R() * Math.max(1, leftW - 3)) | 0));
        if (rightW >= 4 && W >= 10) wallH(iy0 + Math.floor(H * (0.32 + R() * 0.28)), vx + 1, ix1, vx + 2 + ((R() * Math.max(1, rightW - 4)) | 0));
      }
      if (W >= 12 && H >= 9) { const bx = ix1 - 3; wallV(bx, iy0, iy0 + 3, iy0 + 2); wallH(iy0 + 3, bx, ix1, bx + 1); }
      if (W >= 14 && H >= 11) { const by = iy1 - 3; wallH(by, ix0, ix0 + 4, ix0 + 2); wallV(ix0 + 4, by, iy1, by + 1); }
    } else if (W >= 10 && H >= 7 && warey) {
      for (let x = ix0 + 4; x < ix1 - 2; x += 5) wallV(x, iy0 + 1, iy1 - 1, iy0 + 2 + ((R() * Math.max(1, H - 5)) | 0));
      if (H >= 12) wallH(iy0 + ((H / 2) | 0), ix0 + 1, ix1 - 1, ix0 + 3 + ((R() * 4) | 0));
    } else if (W >= 6 && H >= 5) {
      if (W >= H) wallV(ix0 + (W >> 1), iy0, iy1, iy0 + (H >> 1));
      else wallH(iy0 + (H >> 1), ix0, ix1, ix0 + (W >> 1));
    }
  }
  const [dx, dy] = b.door;
  const inward = dy === b.y ? [dx, dy + 1] : dy === b.y + b.h - 1 ? [dx, dy - 1] : dx === b.x ? [dx + 1, dy] : [dx - 1, dy];
  delete iw[dx + ',' + dy]; delete iw[inward[0] + ',' + inward[1]]; delete id[dx + ',' + dy];
  for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { delete iw[(inward[0] + ox) + ',' + (inward[1] + oy)]; }
  b.iwalls = iw; b.idoors = id;
}
function layoutOf(S) {
  let L = LAYOUTS.get(S.id); if (L) return L;
  const R = rng(WD.seed * 31 + S.id * 977 + 5), fills = [], bl = [], objs = [], vehs = [], npcs = [];
  L = { fills, bl, objs, vehs, npcs }; LAYOUTS.set(S.id, L);
  const okSpot = (x, y, w, h, m = 3) => { for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]]) { if (WD.riverD(px, py) < m || WD.lakeV(px, py) < 1.15 || WD.roadD(px, py) < 3.5) return false; } return true; };
  const addB = (x, y, w, h, kind, doorSide, wall) => {
    w = Math.max(5, w | 0); h = Math.max(5, h | 0);
    if (kind !== 'trader' && !okSpot(x, y, w, h)) return null;
    const b = { x, y, w, h, kind, id: S.id + ':' + bl.length, wall: wall || (kind === 'warehouse' || kind === 'shack' ? T.WALLC : (kind === 'house' || kind === 'farmhouse' || kind === 'barn' || kind === 'cabin' ? T.WALLW : T.WALL)) };
    b.floor = kind === 'warehouse' || kind === 'garage' || kind === 'barn' || kind === 'shack' ? T.CONC : (kind === 'house' || kind === 'farmhouse' || kind === 'cabin' || kind === 'apartment' ? T.WOOD : T.TILE);
    const dx = doorSide === 0 || doorSide === 2 ? x + ((w / 2) | 0) : doorSide === 3 ? x : x + w - 1, dy = doorSide === 0 ? y : doorSide === 2 ? y + h - 1 : y + ((h / 2) | 0);
    b.door = [dx, dy]; b.roof = KIND_ROOF[kind] || 0; bl.push(b);
    planInterior(b, R);
    const types = KIND_LOOT[kind] || ['cabinet']; const spots = [];
    for (let i = x + 1; i < x + w - 1; i++) { spots.push([i, y + 1]); spots.push([i, y + h - 2]); }
    for (let j = y + 2; j < y + h - 2; j++) { spots.push([x + 1, j]); spots.push([x + w - 2, j]); }
    if (w * h > 120) for (let j = y + 3; j < y + h - 3; j += 3) for (let i = x + 3; i < x + w - 3; i += 4) spots.push([i, j]);
    const blocked = (sx, sy) => b.iwalls[sx + ',' + sy] || b.idoors[sx + ',' + sy] || (Math.abs(sx - dx) + Math.abs(sy - dy) <= 2);
    const free = spots.filter(([sx, sy]) => !blocked(sx, sy));
    const n = Math.min(free.length, Math.max(types.length, 2 + ((w * h) / 45) | 0));
    for (let k = 0; k < n; k++) { const q = free.splice((R() * free.length) | 0, 1)[0]; if (!q) break; const ct = types[k % types.length]; objs.push({ x: q[0], y: q[1], k: ct, id: b.id + ':' + k, bk: kind, lock: ct === 'gunsafe' || ct === 'safe' }); }
    if (kind === 'trader') { objs.push({ x: x + ((w / 2) | 0), y: y + 2, k: 'trader', id: b.id + ':t', bk: kind }); }
    else if (kind === 'house' || kind === 'apartment' || kind === 'farmhouse' || kind === 'cabin') { const p = kind === 'cabin' ? 0.35 : kind === 'farmhouse' ? 0.28 : 0.1;
      if (R() < p) npcs.push({ x: x + 2 + R() * (w - 4), y: y + 2 + R() * (h - 4), id: 'n' + b.id }); }
    return b;
  };
  const car = (x, y, a, p = 0.3) => { const r = R(); vehs.push({ x, y, ang: a, type: r < 0.08 ? 'moto' : r < 0.2 ? 'bike' : 'car', ok: R() < p, fuel: R() < 0.55 ? 0 : Math.round(1 + R() * 7), id: 'v' + S.id + ':' + vehs.length, col: (R() * 5) | 0 }); };
  if (S.kind === 'town' || S.kind === 'city') {
    const city = S.kind === 'city', P = city ? 42 : 34, RW = city ? 6 : 4, cells = new Set(), x0 = Math.floor((S.x - S.r) / P) * P, y0 = Math.floor((S.y - S.r) / P) * P;
    for (let gx = x0; gx <= S.x + S.r; gx += P) for (let gy = y0; gy <= S.y + S.r; gy += P) { const d = Math.hypot(gx + P / 2 - S.x, gy + P / 2 - S.y); if (d < S.r * (0.72 + 0.4 * hash2(gx, gy, WD.seed))) cells.add(gx + ',' + gy); }
    let traderAt = null, tb = 1e9; for (const c of cells) { const [gx, gy] = c.split(',').map(Number); const d = Math.hypot(gx + P / 2 - S.x, gy + P / 2 - S.y); if (d < tb && okSpot(gx + RW, gy + RW, P - RW, P - RW, 2)) { tb = d; traderAt = c; } }
    if (!traderAt) for (const c of cells) { const [gx, gy] = c.split(',').map(Number); const d = Math.hypot(gx + P / 2 - S.x, gy + P / 2 - S.y); if (d < tb) { tb = d; traderAt = c; } }
    for (const c of cells) { const [gx, gy] = c.split(',').map(Number);
      fills.push({ x: gx, y: gy, w: P + RW, h: RW, t: T.ROAD }, { x: gx, y: gy, w: RW, h: P + RW, t: T.ROAD });
      if (!cells.has(gx + P + ',' + gy)) fills.push({ x: gx + P, y: gy, w: RW, h: P + RW, t: T.ROAD });
      if (!cells.has(gx + ',' + (gy + P))) fills.push({ x: gx, y: gy + P, w: P + RW, h: RW, t: T.ROAD });
      const bx = gx + RW, by = gy + RW, B = P - RW; if (city) fills.push({ x: bx, y: by, w: B, h: B, t: T.SIDE, glass: 0.05 });
      if (c === traderAt) { addB(bx + 2, by + 2, city ? 18 : 12, city ? 14 : 11, 'trader', 2); if (!city) { addB(bx + 16, by + 2, 12, 11, 'store', 2); } continue; }
      const h = hash2(gx, gy, WD.seed + 3);
      if (city) { const dc = Math.hypot(gx - S.x, gy - S.y) / S.r;
        if (h < 0.1) { fills.push({ x: bx + 1, y: by + 1, w: B - 2, h: B - 2, t: T.GRASS, trees: 0.12 }); continue; }
        if (h < 0.2) { fills.push({ x: bx + 1, y: by + 1, w: B - 2, h: B - 2, t: T.CONC }); for (let k = 0; k < 6; k++) car(bx + 3 + (k % 3) * 7, by + 6 + ((k / 3) | 0) * 10, 0, 0.18); continue; }
        if (h < 0.55) { const big = ['mall', 'hospital', 'office', 'apartment', 'warehouse', 'apartment', 'office'][(R() * 7) | 0]; addB(bx + 2, by + 2, B - 4, B - 4, dc < 0.35 && R() < 0.4 ? 'office' : big, 2); }
        else if (h < 0.78) { addB(bx + 2, by + 1, B - 4, 14, ['apartment', 'gunstore', 'bank', 'police', 'store', 'apartment', 'pharmacy', 'clothing'][(R() * 8) | 0], 0); addB(bx + 2, by + B - 15, B - 4, 14, ['apartment', 'store', 'office', 'hardware', 'apartment'][(R() * 5) | 0], 2); }
        else { for (let k = 0; k < 4; k++) addB(bx + 1 + (k % 2) * 17, by + 1 + ((k / 2) | 0) * 17, 15, 15, ['apartment', 'store', 'pharmacy', 'apartment', 'clothing', 'gunstore', 'house'][(R() * 7) | 0], k < 2 ? 0 : 2); }
        if (R() < 0.5) car(gx + 2 + R() * (P - 4), gy + 1.5, 0, 0.25); if (R() < 0.4) car(gx + 1.5, gy + 2 + R() * (P - 4), 1.57, 0.25);
      } else {
        const slots = [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (const [si, sj] of slots) {
          if (R() < 0.14) { if (R() < 0.5) fills.push({ x: bx + si * 14 + 4, y: by + sj * 14 + 4, w: 1, h: 1, t: T.TREE }); continue; }
          const w = 11 + ((R() * 4) | 0), hh = 10 + ((R() * 3) | 0);
          const lx = bx + si * 15 + ((15 - w) >> 1), ly = by + sj * 15 + ((15 - hh) >> 1);
          const r = R(), kind = r < 0.1 ? 'store' : r < 0.16 ? 'hardware' : r < 0.21 ? 'pharmacy' : r < 0.26 ? 'clothing' : r < 0.29 ? 'police' : r < 0.36 ? 'garage' : 'house';
          const side = sj === 0 ? 0 : 2;
          if (addB(lx, ly, w, hh, kind, side) && R() < 0.35) {
            R() < 0.5 ? car(lx + w + 0.5, ly + hh / 2, 0, 0.35) : vehs.push({ x: lx - 0.6, y: ly + hh / 2, ang: 0, type: R() < 0.6 ? 'bike' : 'moto', ok: true, fuel: R() < 0.6 ? 0 : 1 + ((R() * 3) | 0), id: 'v' + S.id + ':' + vehs.length, col: (R() * 5) | 0 });
          }
        }
      }
    }
  } else if (S.kind === 'factory') {
    const x = S.x - 40, y = S.y - 28; fills.push({ x, y, w: 80, h: 56, t: T.CONC }, { x, y, w: 80, h: 1, t: T.FENCE }, { x, y: y + 55, w: 80, h: 1, t: T.FENCE }, { x, y, w: 1, h: 56, t: T.FENCE }, { x: x + 79, y, w: 1, h: 56, t: T.FENCE }, { x: x + 36, y: y + 55, w: 8, h: 1, t: T.CONC }, { x: x + 36, y, w: 8, h: 1, t: T.CONC });
    addB(x + 4, y + 4, 28, 20, 'warehouse', 2); addB(x + 40, y + 4, 28, 20, 'warehouse', 2); addB(x + 8, y + 30, 22, 18, 'warehouse', 0); addB(x + 50, y + 34, 16, 12, 'garage', 3); addB(x + 34, y + 28, 12, 10, 'office', 2);
    for (let k = 0; k < 12; k++) objs.push({ x: x + 34 + (k % 3) * 5, y: y + 8 + ((k / 3) | 0) * 5, k: 'crate', id: S.id + ':yard' + k, bk: 'warehouse' });
    vehs.push({ x: x + 40, y: y + 28, ang: 0, type: 'moto', ok: R() < 0.7, fuel: 1 + ((R() * 3) | 0), id: 'v' + S.id + ':m', col: 2 }); car(x + 66, y + 50, 0, 0.5);
  } else if (S.kind === 'farm') {
    fills.push({ x: S.x - 20, y: S.y - 16, w: 40, h: 32, t: T.GRASS }, { x: S.x - 18, y: S.y + 2, w: 36, h: 12, t: T.FIELD });
    addB(S.x - 18, S.y - 14, 14, 12, 'farmhouse', 2); addB(S.x + 2, S.y - 14, 16, 12, 'barn', 2);
    if (R() < 0.7) car(S.x - 4, S.y - 1, 0, 0.45);
  } else if (S.kind === 'gas') {
    fills.push({ x: S.x - 12, y: S.y - 9, w: 24, h: 18, t: T.CONC }); addB(S.x - 11, S.y - 8, 12, 9, 'gasstore', 2);
    objs.push({ x: S.x + 4, y: S.y + 2, k: 'pump', id: S.id + ':p0', fuel: 3 + ((R() * 14) | 0) }, { x: S.x + 7, y: S.y + 2, k: 'pump', id: S.id + ':p1', fuel: R() < 0.5 ? 0 : 2 + ((R() * 8) | 0) });
    car(S.x - 4, S.y + 5, 0, 0.4);
  } else if (S.kind === 'mine') {
    fills.push({ x: S.x - 14, y: S.y - 11, w: 28, h: 22, t: T.GRAVEL }); addB(S.x - 12, S.y - 2, 10, 8, 'shack', 1);
    objs.push({ x: S.x + 3, y: S.y - 8, k: 'mine', id: S.id + ':mine' }, { x: S.x + 5, y: S.y - 6, k: 'orecart', id: S.id + ':cart', bk: 'mine' }, { x: S.x + 1, y: S.y - 6, k: 'orecart', id: S.id + ':cart2', bk: 'mine' }, { x: S.x + 6, y: S.y + 3, k: 'crate', id: S.id + ':c', bk: 'shack' });
  } else if (S.kind === 'cabin') {
    fills.push({ x: S.x - 8, y: S.y - 7, w: 16, h: 14, t: T.GRASS }); addB(S.x - 5, S.y - 5, 10, 9, 'cabin', 2, T.WALLW);
  }
  return L;
}
// ---- chunks
const CHUNKS = new Map(); let chunkOrder = [];
const MOD = new Map();   // player changes to tiles: key -> tile (tilled soil, chopped trees)
const tkey = (x, y) => y * WS + x;
function genChunk(cx, cy) {
  const x0 = cx * CH, y0 = cy * CH, t = new Uint8Array(CH * CH), s = WD.seed, objs = [], bl = [];
  const pad = 12, inb = (b) => b[0] < x0 + CH + pad && b[2] > x0 - pad && b[1] < y0 + CH + pad && b[3] > y0 - pad;
  const rv = WD.rivers.filter((r) => inb([Math.min(r.ax, r.bx) - r.w, Math.min(r.ay, r.by) - r.w, Math.max(r.ax, r.bx) + r.w, Math.max(r.ay, r.by) + r.w]));
  const lk = WD.lakes.filter((l) => inb([l.x - l.rx * 1.6, l.y - l.ry * 1.6, l.x + l.rx * 1.6, l.y + l.ry * 1.6]));
  const rd = WD.roads.filter((r) => inb([Math.min(r.ax, r.bx) - 4, Math.min(r.ay, r.by) - 4, Math.max(r.ax, r.bx) + 4, Math.max(r.ay, r.by) + 4]));
  const dr = WD.dirt.filter((r) => inb([Math.min(r.ax, r.bx) - 2, Math.min(r.ay, r.by) - 2, Math.max(r.ax, r.bx) + 2, Math.max(r.ay, r.by) + 2]));
  const st = WD.sets.filter((S) => inb(S.bb));
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
    const x = x0 + i, y = y0 + j, h = hash2(x, y, s); let v;
    if (x < 6 || y < 6 || x >= WS - 6 || y >= WS - 6) { t[j * CH + i] = T.SEA; continue; }
    const e = WD.elev(x, y);
    if (e > 0.5) { v = T.GRAVEL; if (e > 0.6 && fbm(x / 9, y / 9, s + 40, 2) > 0.52) v = T.ROCK; else if (h < 0.04) v = T.ROCK; else if (h < 0.08 && e < 0.62) v = T.PINE; }
    else { const f = WD.forest(x, y); v = T.GRASS;
      if (f > 0.6) v = h < (e > 0.38 ? 0.34 : 0.3) ? (e > 0.38 || f > 0.68 ? T.PINE : T.TREE) : h < 0.42 ? T.BUSH : h < 0.6 ? T.TALL : T.GRASS;
      else if (f > 0.55) v = h < 0.08 ? T.TREE : h < 0.12 ? T.BUSH : T.GRASS;
      else { const g = fbm(x / 14, y / 14, s + 50, 2); v = g > 0.63 ? T.TALL : h < 0.012 ? T.TREE : h < 0.03 ? T.FLOWER : h < 0.036 ? T.BUSH : T.GRASS; }
      if (e > 0.44 && h < 0.015) v = T.ROCK; }
    let wd = 9; for (const r of rv) { const d = segDist(x, y, r.ax, r.ay, r.bx, r.by) - r.w; if (d < wd) wd = d; }
    if (wd < -1.1) v = T.WATER; else if (wd < 0) v = T.SHAL; else if (wd < 1.6 && v !== T.ROCK) v = T.SAND;
    if (lk.length) { let q = 9; for (const l of lk) { const dx = (x - l.x) / l.rx, dy = (y - l.y) / l.ry; const qq = dx * dx + dy * dy + (fbm(x / 18, y / 18, s + 21, 2) - 0.5) * 0.6; if (qq < q) q = qq; }
      if (q < 0.82) v = T.WATER; else if (q < 1) v = T.SHAL; else if (q < 1.14) v = T.SAND; }
    for (const r of dr) { if (segDist(x, y, r.ax, r.ay, r.bx, r.by) < r.w) v = v === T.WATER || v === T.SHAL ? T.BRIDGE : T.DIRT; }
    for (const r of rd) { const d = segDist(x, y, r.ax, r.ay, r.bx, r.by); if (d < r.w) v = v === T.WATER || v === T.SHAL || v === T.BRIDGE ? T.BRIDGE : (d < 0.5 && ((x + y) >> 1) % 3 ? T.LINE : T.ROAD); }
    t[j * CH + i] = v;
  }
  const set = (x, y, v) => { const i = x - x0, j = y - y0; if (i >= 0 && j >= 0 && i < CH && j < CH) { const o = t[j * CH + i]; if (o === T.WATER || o === T.SHAL || o === T.BRIDGE) { if (v === T.ROAD || v === T.SIDE || v === T.CONC) t[j * CH + i] = T.BRIDGE; return; } t[j * CH + i] = v; } };
  for (const S of st) { const L = layoutOf(S);
    for (const f of L.fills) { if (f.x > x0 + CH || f.y > y0 + CH || f.x + f.w < x0 || f.y + f.h < y0) continue;
      for (let y = Math.max(f.y, y0); y < Math.min(f.y + f.h, y0 + CH); y++) for (let x = Math.max(f.x, x0); x < Math.min(f.x + f.w, x0 + CH); x++) {
        let v = f.t; const h = hash2(x, y, s + 9); if (f.glass && h < f.glass) v = T.GLASS; if (f.trees && h < f.trees) v = T.TREE; if (v === T.ROAD && f.w > 2 && f.h > 2 && ((f.w > f.h ? y - f.y : x - f.x) === ((Math.min(f.w, f.h) / 2) | 0)) && ((x + y) >> 1) % 3 === 0) v = T.LINE; set(x, y, v); } }
    for (const b of L.bl) { if (b.x > x0 + CH || b.y > y0 + CH || b.x + b.w < x0 || b.y + b.h < y0) continue; bl.push(b);
      for (let y = Math.max(b.y, y0); y < Math.min(b.y + b.h, y0 + CH); y++) for (let x = Math.max(b.x, x0); x < Math.min(b.x + b.w, x0 + CH); x++) {
        const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1; let v = edge ? b.wall : b.floor;
        const key = x + ',' + y;
        if (!edge && b.iwalls && b.iwalls[key]) v = b.wall;
        if (!edge && b.idoors && b.idoors[key]) v = T.DOOR;
        if (x === b.door[0] && y === b.door[1]) v = T.DOOR;
        if (!edge && v === b.floor && b.floor !== T.CONC && hash2(x, y, s + 77) < (WD.sets[+b.id.split(':')[0]].kind === 'city' ? 0.04 : 0.018)) v = T.GLASS;
        const i = x - x0, j = y - y0; t[j * CH + i] = v; } }
    for (const o of L.objs) if (o.x >= x0 && o.y >= y0 && o.x < x0 + CH && o.y < y0 + CH) objs.push(o);
  }
  for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) { const m = MOD.get(tkey(x0 + i, y0 + j)); if (m !== undefined) t[j * CH + i] = m; }
  return { cx, cy, t, objs, bl };
}
function chunk(cx, cy) {
  const k = cy * NC + cx; let c = CHUNKS.get(k);
  if (!c) { c = genChunk(cx, cy); CHUNKS.set(k, c); chunkOrder.push(k); onChunkNew(c); if (chunkOrder.length > 260) { const old = chunkOrder.shift(); CHUNKS.delete(old); } }
  return c;
}
function tileAt(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= WS || y >= WS) return T.SEA; const c = chunk((x / CH) | 0, (y / CH) | 0); return c.t[(y % CH) * CH + (x % CH)]; }
function setTile(x, y, v) { MOD.set(tkey(x, y), v); const c = CHUNKS.get(((y / CH) | 0) * NC + ((x / CH) | 0)); if (c) c.t[(y % CH) * CH + (x % CH)] = v; }
function buildingAt(x, y) { x = Math.floor(x); y = Math.floor(y); const c = chunk((x / CH) | 0, (y / CH) | 0); for (const b of c.bl) if (x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1) return b; return null; }
// ================================================================ items: every item has weight (kg) and a base value ($)
const IT = {};
function D(id, n, w, v, s, c, x = {}) { IT[id] = Object.assign({ id, n, w, v, s, c }, x); }
// food & drink
D('beans', 'CANNED BEANS', 0.45, 6, 5, 'food', { food: 28, ic: 'can', col: '#c8503c' }); D('soup', 'SOUP CAN', 0.4, 6, 5, 'food', { food: 22, water: 6, ic: 'can', col: '#e0b040' });
D('chips', 'CHIPS', 0.15, 3, 5, 'food', { food: 10, ic: 'bag', col: '#e8c040' }); D('bar', 'ENERGY BAR', 0.08, 5, 8, 'food', { food: 12, sta: 30, ic: 'bar', col: '#5aa0e0' });
D('mre', 'MRE', 0.6, 16, 3, 'food', { food: 55, ic: 'bag', col: '#7a8a4a' }); D('apple', 'APPLE', 0.2, 2, 6, 'food', { food: 10, water: 5, ic: 'fruit', col: '#d83a3a' });
D('jerky', 'JERKY', 0.1, 6, 6, 'food', { food: 18, ic: 'bar', col: '#8a4a2a' }); D('water', 'WATER', 0.55, 4, 4, 'drink', { water: 40, ic: 'bottle', col: '#8ed8ff' });
D('soda', 'SODA', 0.4, 3, 5, 'drink', { water: 25, sta: 15, ic: 'can', col: '#40b860' }); D('whiskey', 'WHISKEY', 1.0, 22, 2, 'val', { ic: 'bottle', col: '#c87a2a' });
// produce + cooking
D('turnip', 'TURNIP', 0.3, 3, 10, 'food', { food: 14, ic: 'veg', col: '#e8d8f0' }); D('potato', 'POTATO', 0.3, 4, 10, 'food', { food: 16, ic: 'veg', col: '#c8a060' });
D('carrot', 'CARROT', 0.2, 3, 10, 'food', { food: 12, water: 4, ic: 'veg', col: '#f08a28' }); D('tomato', 'TOMATO', 0.25, 4, 10, 'food', { food: 10, water: 10, ic: 'fruit', col: '#e83a2a' });
D('corn', 'CORN', 0.35, 5, 10, 'food', { food: 18, ic: 'veg', col: '#f0d040' }); D('berry', 'BERRIES', 0.1, 3, 15, 'food', { food: 8, water: 6, ic: 'fruit', col: '#7a40c8' });
D('pumpkin', 'PUMPKIN', 2.5, 12, 3, 'food', { food: 40, ic: 'fruit', col: '#f08a20' }); D('wheat', 'WHEAT', 0.2, 3, 15, 'mat', { ic: 'veg', col: '#e8c870' });
D('bakedpot', 'BAKED POTATO', 0.3, 7, 6, 'food', { food: 40, ic: 'veg', col: '#a87a40' }); D('stew', 'VEGGIE STEW', 0.6, 18, 4, 'food', { food: 85, water: 10, ic: 'can', col: '#a85a2a' });
D('bread', 'BREAD', 0.4, 10, 5, 'food', { food: 60, ic: 'bar', col: '#d8a860' }); D('psoup', 'PUMPKIN SOUP', 0.6, 25, 4, 'food', { food: 110, water: 20, ic: 'can', col: '#f0a040' });
D('fish', 'FISH', 0.5, 5, 5, 'food', { food: 20, ic: 'fish', col: '#a0b8c8' }); D('rfish', 'GRILLED FISH', 0.4, 9, 5, 'food', { food: 45, ic: 'fish', col: '#c89050' });
// seeds
const CROPS = {
  turnip: { n: 'TURNIP', days: 3, seas: [0], yield: [1, 2], col: '#e8d8f0' }, potato: { n: 'POTATO', days: 5, seas: [0], yield: [2, 3], col: '#c8a060' },
  carrot: { n: 'CARROT', days: 4, seas: [0, 2], yield: [1, 3], col: '#f08a28' }, wheat: { n: 'WHEAT', days: 4, seas: [0, 2], yield: [2, 4], col: '#e8c870' },
  tomato: { n: 'TOMATO', days: 6, seas: [1], yield: [2, 3], regrow: 3, col: '#e83a2a' }, corn: { n: 'CORN', days: 8, seas: [1, 2], yield: [1, 2], regrow: 4, col: '#f0d040' },
  berry: { n: 'BERRIES', days: 5, seas: [1], yield: [3, 5], regrow: 2, col: '#7a40c8' }, pumpkin: { n: 'PUMPKIN', days: 9, seas: [2], yield: [1, 1], col: '#f08a20' },
};
for (const k in CROPS) D('s_' + k, CROPS[k].n + ' SEEDS', 0.02, { turnip: 2, potato: 3, carrot: 2, wheat: 2, tomato: 4, corn: 4, berry: 5, pumpkin: 6 }[k], 30, 'seed', { crop: k, ic: 'seed', col: CROPS[k].col });
// tools & weapons (dmg vs zombie hp 3; noise in tiles)
D('hoe', 'HOE', 1.6, 14, 1, 'tool', { ic: 'hoe' }); D('wcan', 'WATERING CAN', 1.2, 12, 1, 'tool', { ic: 'wcan', cap: 12 }); D('hammer', 'HAMMER', 0.8, 10, 1, 'tool', { ic: 'hammer', dmg: 1, rate: 0.45, noise: 5, reach: 1.1 });
D('rod', 'FISHING ROD', 0.9, 14, 1, 'tool', { ic: 'rod' });
D('axe', 'AXE', 2.2, 20, 1, 'weap', { ic: 'axe', dmg: 3, rate: 0.75, noise: 6, reach: 1.3, two: true });
D('crowbar', 'CROWBAR', 1.4, 12, 1, 'weap', { ic: 'crowbar', dmg: 2, rate: 0.55, noise: 5, reach: 1.25, pry: true }); D('knife', 'KNIFE', 0.3, 6, 1, 'weap', { ic: 'knife', dmg: 1, rate: 0.32, noise: 2, reach: 0.95 });
D('bat', 'BASEBALL BAT', 1.0, 8, 1, 'weap', { ic: 'bat', dmg: 1.5, rate: 0.55, noise: 5, reach: 1.3 }); D('pipe', 'LEAD PIPE', 1.5, 5, 1, 'weap', { ic: 'pipe', dmg: 1.5, rate: 0.62, noise: 6, reach: 1.25 });
D('machete', 'MACHETE', 0.9, 24, 1, 'weap', { ic: 'machete', dmg: 3, rate: 0.5, noise: 4, reach: 1.25 });
D('pistol', 'PISTOL', 0.9, 70, 1, 'gun', { ic: 'pistol', dmg: 3, rate: 0.35, noise: 30, range: 9, ammo: 'a9', spread: 0.06 });
D('shotgun', 'SHOTGUN', 3.2, 120, 1, 'gun', { ic: 'shotgun', dmg: 1.6, pel: 5, rate: 0.9, noise: 40, range: 6, ammo: 'shell', spread: 0.28, two: true });
D('rifle', 'HUNTING RIFLE', 4.0, 150, 1, 'gun', { ic: 'rifle', dmg: 7, rate: 1.1, noise: 45, range: 14, ammo: 'r556', spread: 0.015, pierce: 3, two: true });
D('a9', '9MM ROUNDS', 0.012, 0.8, 60, 'ammo', { ic: 'ammo', col: '#e0c060' }); D('shell', 'SHELLS', 0.04, 1.6, 30, 'ammo', { ic: 'ammo', col: '#d84a3a' }); D('r556', 'RIFLE ROUNDS', 0.025, 1.6, 40, 'ammo', { ic: 'ammo', col: '#a0a060' });
// clothes
D('sneakers', 'SNEAKERS', 0.6, 10, 1, 'wear', { slot: 'feet', ic: 'shoe', col: '#c8c8d0', quiet: 0.55 }); D('boots', 'WORK BOOTS', 1.2, 24, 1, 'wear', { slot: 'feet', ic: 'shoe', col: '#5a3a22', quiet: 1.15 });
D('hoodie', 'HOODIE', 0.7, 8, 1, 'wear', { slot: 'body', ic: 'shirt', col: '#5a6ac8', warm: 1 }); D('jacket', 'LEATHER JACKET', 1.5, 26, 1, 'wear', { slot: 'body', ic: 'shirt', col: '#5a3a2a', warm: 2 });
D('pack_s', 'SCHOOL BACKPACK', 0.5, 18, 1, 'wear', { slot: 'back', ic: 'pack', col: '#d84a6a', slots: 6, kg: 6 }); D('pack_h', 'HIKING PACK', 1.2, 50, 1, 'wear', { slot: 'back', ic: 'pack', col: '#3a8a5a', slots: 10, kg: 12 });
D('pack_m', 'MILITARY PACK', 1.8, 110, 1, 'wear', { slot: 'back', ic: 'pack', col: '#6a7040', slots: 14, kg: 18 });
// materials, medicine, valuables, kits
D('plank', 'PLANKS', 1.5, 3, 10, 'mat', { ic: 'plank' }); D('scrap', 'SCRAP METAL', 1.0, 3, 10, 'mat', { ic: 'scrap' }); D('nails', 'NAILS', 0.01, 0.15, 200, 'mat', { ic: 'nails' });
D('rope', 'ROPE', 0.3, 4, 5, 'mat', { ic: 'rope' }); D('cloth', 'CLOTH', 0.1, 2, 10, 'mat', { ic: 'cloth' }); D('elec', 'ELECTRONICS', 0.5, 16, 5, 'mat', { ic: 'elec' }); D('battery', 'BATTERIES', 0.2, 5, 10, 'mat', { ic: 'battery' });
D('bandage', 'BANDAGE', 0.05, 4, 10, 'med', { ic: 'med', heal: 15 }); D('pills', 'PAINKILLERS', 0.05, 8, 10, 'med', { ic: 'pills', heal: 6, sta: 25 }); D('medkit', 'MEDKIT', 0.6, 35, 3, 'med', { ic: 'med', heal: 60, col: '#e83a3a' });
D('watch', 'GOLD WATCH', 0.1, 40, 5, 'val', { ic: 'gem', col: '#f0c040' }); D('ring', 'DIAMOND RING', 0.05, 55, 5, 'val', { ic: 'gem', col: '#c8f0ff' }); D('phone', 'PHONE', 0.2, 22, 5, 'val', { ic: 'elec', col: '#303040' });
D('laptop', 'LAPTOP', 2.0, 65, 1, 'val', { ic: 'elec', col: '#8a8a9a' }); D('gold', 'GOLD NUGGET', 0.5, 180, 5, 'val', { ic: 'gem', col: '#ffd040' }); D('comic', 'COMIC BOOK', 0.2, 7, 5, 'val', { ic: 'book', col: '#e84a8a' });
D('gascan', 'GAS CAN', 0.8, 8, 1, 'fuel', { ic: 'gascan', cap: 10 }); D('bedroll', 'BEDROLL', 2.5, 20, 1, 'kit', { ic: 'bed' });
D('spear', 'SPEAR', 1.4, 16, 1, 'weap', { ic: 'pipe', dmg: 2.2, rate: 0.55, noise: 4, reach: 1.55, two: true });
D('shield', 'WOOD SHIELD', 2.0, 18, 1, 'weap', { ic: 'plank', dmg: 0.8, rate: 0.7, noise: 3, reach: 0.9 });
D('torch', 'TORCH', 0.4, 4, 8, 'kit', { ic: 'bar', col: '#ff8a2a' });
D('charcoal', 'CHARCOAL', 0.2, 2, 20, 'mat', { ic: 'scrap', col: '#2a2a2a' });
// worth of an item stack (a gas can is worth its fuel)
const valOf = (s) => (IT[s.id].v + (s.id === 'gascan' ? (s.q || 0) * 5 : 0)) * (s.n || 1);
const wOf = (s) => (IT[s.id].w + (s.id === 'gascan' ? (s.q || 0) * 0.75 : s.id === 'wcan' ? (s.q || 0) * 0.1 : 0)) * (s.n || 1);
// ---- loot tables: [id, weight, nmin, nmax]; 'cash' = money
const LOOT = {
  fridge: [[0, 1.4], ['water', 3, 1, 2], ['soda', 3, 1, 2], ['apple', 2, 1, 3], ['beans', 1], ['jerky', 1]],
  cabinet: [[0, 1], ['beans', 4, 1, 2], ['soup', 3], ['chips', 3, 1, 2], ['bar', 1], ['pills', 1], ['bandage', 1, 1, 2], ['nails', 1, 5, 15], ['battery', 1], ['cloth', 1, 1, 3], ['s_turnip', 0.6, 2, 5], ['s_potato', 0.4, 2, 4], ['whiskey', 0.3], ['rod', 0.15]],
  dresser: [[0, 1], ['bedroll', 0.35], ['hoodie', 2], ['jacket', 0.5], ['sneakers', 1.6], ['boots', 0.5], ['pack_s', 0.7], ['watch', 0.6], ['ring', 0.4], ['cash', 1.5, 2, 12], ['cloth', 2, 1, 3], ['comic', 1]],
  desk: [[0, 1], ['phone', 1.5], ['battery', 2, 1, 3], ['elec', 1], ['cash', 1, 2, 15], ['laptop', 0.35], ['comic', 1], ['knife', 0.4]],
  register: [[0, 0.6], ['cash', 3, 5, 30]],
  medcab: [[0, 0.7], ['bandage', 3, 1, 3], ['pills', 3, 1, 2], ['medkit', 0.5]],
  rack: [[0, 0.8], ['hoodie', 3], ['jacket', 1.4], ['sneakers', 2], ['boots', 1.2], ['pack_s', 1], ['pack_h', 0.45], ['cloth', 1, 2, 4]],
  locker: [[0, 0.8], ['boots', 1], ['jacket', 1], ['bat', 0.8], ['crowbar', 0.6], ['pistol', 0.25], ['a9', 1, 6, 15], ['pack_m', 0.12], ['knife', 1], ['rifle', 0.08]],
  gunsafe: [['pistol', 2], ['shotgun', 1], ['rifle', 0.5], ['a9', 2, 10, 30], ['shell', 2, 5, 12], ['r556', 1, 5, 15]],
  safe: [['cash', 3, 40, 150], ['gold', 1], ['ring', 2, 1, 2], ['watch', 2, 1, 2]],
  toolbox: [[0, 0.5], ['nails', 3, 10, 30], ['hammer', 1], ['crowbar', 0.8], ['scrap', 1, 1, 2], ['battery', 1], ['knife', 0.5], ['pipe', 0.6], ['rope', 1], ['hoe', 0.3], ['wcan', 0.3]],
  crate: [[0, 0.8], ['plank', 3, 1, 3], ['scrap', 2.5, 1, 3], ['nails', 2, 10, 25], ['rope', 1], ['cloth', 1, 1, 3], ['elec', 0.6], ['gascan', 0.25]],
  seedbox: [['s_turnip', 2, 3, 8], ['s_potato', 2, 3, 6], ['s_carrot', 1.5, 3, 6], ['s_wheat', 1.5, 3, 8], ['s_tomato', 1, 2, 5], ['s_corn', 1, 2, 5], ['s_berry', 0.8, 2, 4], ['s_pumpkin', 0.8, 1, 3], ['hoe', 0.5], ['wcan', 0.5]],
  gascan: [[0, 0.5], ['gascan', 3]], orecart: [[0, 1], ['scrap', 2, 1, 3], ['gold', 0.7], ['pipe', 0.5]],
  trunk: [[0, 1.6], ['gascan', 0.4], ['water', 1], ['beans', 1], ['pack_s', 0.25], ['crowbar', 0.3], ['cash', 0.6, 3, 20], ['bat', 0.3], ['rope', 0.5], ['jerky', 0.6]],
  shelf_store: [[0, 0.6], ['beans', 3, 1, 2], ['soup', 3, 1, 2], ['chips', 3, 1, 3], ['bar', 2, 1, 2], ['water', 3, 1, 2], ['soda', 2], ['jerky', 1], ['mre', 0.25], ['s_turnip', 0.4, 2, 5]],
  shelf_hardware: [[0, 0.4], ['nails', 3, 10, 30], ['plank', 2, 1, 2], ['scrap', 1.5], ['rope', 2], ['hammer', 1], ['hoe', 0.8], ['wcan', 0.8], ['axe', 0.4], ['crowbar', 0.6], ['pipe', 0.6], ['s_potato', 0.8, 3, 6], ['s_carrot', 0.8, 3, 6], ['s_corn', 0.5, 2, 4], ['gascan', 0.3], ['rod', 0.3]],
  shelf_pharmacy: [[0, 0.5], ['bandage', 3, 1, 3], ['pills', 3, 1, 2], ['medkit', 0.4], ['water', 1], ['bar', 1]],
  shelf_gunstore: [[0, 0.4], ['a9', 3, 10, 25], ['shell', 2, 4, 10], ['r556', 1, 5, 10], ['knife', 1], ['machete', 0.6]],
  shelf_mall: [[0, 0.6], ['hoodie', 1], ['sneakers', 1], ['pack_s', 0.6], ['pack_h', 0.25], ['chips', 1], ['soda', 1], ['phone', 1], ['comic', 1], ['watch', 0.4]],
};
LOOT.shelf_gasstore = LOOT.shelf_store; LOOT.shelf_trader = LOOT.shelf_store;
function rollLoot(o) {
  const tab = LOOT[o.k === 'shelf' ? 'shelf_' + o.bk : o.k] || LOOT.cabinet, R = rng(hashS(o.id) ^ (WD.seed * 2654435761));
  const S = WD.sets[+String(o.id).replace(/^\D+/, '').split(':')[0]] || null, rich = S && S.kind === 'city' ? 1.35 : 1;
  const out = []; let money = 0; const tot = tab.reduce((a, e) => a + (e[0] === 0 ? e[1] : e[1] * (IT[e[0]] && IT[e[0]].v > 30 ? rich : 1)), 0);
  const rolls = o.k === 'safe' || o.k === 'gunsafe' ? 2 : 1 + ((R() * (o.k === 'shelf' || o.k === 'crate' ? 3 : 2.2)) | 0);
  for (let r = 0; r < rolls; r++) { let q = R() * tot; for (const e of tab) { q -= e[0] === 0 ? e[1] : e[1] * (IT[e[0]] && IT[e[0]].v > 30 ? rich : 1); if (q > 0) continue;
    if (e[0] === 0) break; const n = e[2] ? e[2] + ((R() * (e[3] - e[2] + 1)) | 0) : 1;
    if (e[0] === 'cash') { money += n; break; }
    const ex = out.find((s) => s.id === e[0] && IT[e[0]].s > 1); if (ex) ex.n += n; else out.push({ id: e[0], n, q: e[0] === 'gascan' ? 1 + ((R() * 5) | 0) : e[0] === 'wcan' ? 0 : undefined }); break; } }
  return { items: out, money };
}
// ---- the player's inventory: two hands, pocket slots, backpack slots, worn clothes
function newInv() { return { hands: [null, null], pockets: [null, null, null, null], pack: [], wear: { feet: null, body: null, back: null } }; }
function invLists(I) { return [['hands', I.hands], ['pockets', I.pockets], ['pack', I.pack]]; }
function allSlots(I) { const out = []; for (const [k, a] of invLists(I)) for (let i = 0; i < a.length; i++) out.push({ k, a, i }); return out; }
function invWeight(I) { let w = 0; for (const s of allSlots(I)) if (s.a[s.i]) w += wOf(s.a[s.i]); for (const k in I.wear) if (I.wear[k]) w += wOf(I.wear[k]) * 0.5; return w; }
function twoHanded(I) { const h = I.hands[0]; return !!(h && IT[h.id].two); }
function addItem(I, id, n = 1, q) {
  const d = IT[id]; let left = n;
  if (d.s > 1) for (const s of allSlots(I)) { const it = s.a[s.i]; if (it && it.id === id && it.n < d.s) { const k = Math.min(left, d.s - it.n); it.n += k; left -= k; if (!left) return 0; } }
  const order = [['pockets'], ['pack'], ['hands', 1], ['hands', 0]];
  for (const [k, only] of order) { const a = I[k]; for (let i = 0; i < a.length; i++) { if (only !== undefined && i !== only) continue; if (k === 'hands' && i === 1 && twoHanded(I)) continue; if (k === 'hands' && i === 0 && IT[id].two && I.hands[1]) continue;
    if (!a[i]) { const k2 = Math.min(left, d.s); a[i] = { id, n: k2, q }; left -= k2; if (!left) return 0; } } }
  return left;
}
function countItem(I, id) { let n = 0; for (const s of allSlots(I)) { const it = s.a[s.i]; if (it && it.id === id) n += it.n; } return n; }
function takeItem(I, id, n = 1) { for (const s of allSlots(I).reverse()) { const it = s.a[s.i]; if (it && it.id === id) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (!it.n) s.a[s.i] = null; if (!n) return true; } } return n <= 0; }
function packSlots(I) { const b = I.wear.back; return b ? IT[b.id].slots : 0; }
function resizePack(I) { const n = packSlots(I); const spill = []; while (I.pack.length > n) { const it = I.pack.pop(); if (it) spill.push(it); } while (I.pack.length < n) I.pack.push(null); return spill; }
// ================================================================ art (v7): original 16-bit JRPG-style pixel art, all drawn in code
// 5-tone ramps (0 = lit .. 4 = deep shadow), dithering, selective dark outlines. Everything here is hand-authored for Sovereign.
function P(x, X, Y, w, h, c) { x.fillStyle = c; x.fillRect(X, Y, w, h); }
const R5 = {
  grass: ['#a2bc6c', '#80a252', '#638842', '#4a6c34', '#334c28'], tall: ['#98b462', '#76984a', '#5a7c3c', '#42602e', '#2c4222'],
  dirt: ['#c8a274', '#a8845a', '#886846', '#6a4e36', '#4a3626'], sand: ['#e6d4a0', '#d0b882', '#b49a68', '#927a50', '#665438'],
  water: ['#b8e0f0', '#6aa4cc', '#4a82b0', '#36648e', '#24466c'], sea: ['#a0cce8', '#5a8cc0', '#3e6aa0', '#2c4e80', '#1c345c'],
  shal: ['#c8e8e8', '#88c0c8', '#6aa4b0', '#548890', '#3e6a70'],
  cob: ['#bab2a2', '#9a9282', '#7c7466', '#5e584e', '#403c36'], flag: ['#d2c6aa', '#b4a88e', '#968a72', '#766c5a', '#524a3e'],
  plank: ['#d8a86c', '#b8884e', '#966a3a', '#74502c', '#50361e'], checker: ['#e0d8c8', '#c0b8a8', '#9a9284', '#787064', '#544e46'],
  slab: ['#a8a8a0', '#8c8c86', '#72726c', '#585852', '#3e3e3a'], gravel: ['#a89a88', '#8a7c6c', '#6e6254', '#544a40', '#3a322c'],
  rock: ['#b0a898', '#8e8678', '#6e675c', '#504a42', '#36322c'], stone: ['#c4bcae', '#a49c8e', '#867e72', '#686258', '#4a463e'],
  brick: ['#d08870', '#b06a54', '#8e5040', '#6c3a30', '#4a2620'], plaster: ['#ece2c8', '#d4c8a8', '#b8aa8a', '#968a6c', '#6e644e'],
  timber: ['#a07448', '#825a36', '#664428', '#4c301c', '#321e12'], metal: ['#a4acb4', '#848c96', '#666e78', '#4a525c', '#30363e'],
  leaf: ['#8cc060', '#62a048', '#468238', '#30642c', '#1e4422'], pine: ['#6aa070', '#4a8258', '#326644', '#224a34', '#143024'],
  wheat: ['#f0d888', '#d8b860', '#b89444', '#8e7032', '#644e24'], tilled: ['#8a6444', '#6e4c32', '#563a26', '#3e2a1c', '#2a1c12'],
};
const ATLAS_V = 4; let ATLAS = null, EDGE = null;
function paintTile(x, ox, oy, t, v) {
  const r = rng(977 + v * 131 + t * 7919), q = (X, Y, c) => P(x, ox + X, oy + Y, 1, 1, c), f = (X, Y, w, h, c) => P(x, ox + X, oy + Y, w, h, c);
  const dith = (X, Y, w, h, c, ph = 0) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((X + i + Y + j + ph) & 1) === 0) q(X + i, Y + j, c); };
  const blob = (X, Y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (i + 0.5) / w - 0.5, dy = (j + 0.5) / h - 0.5; if (dx * dx + dy * dy < 0.25) q(X + i, Y + j, c); } };
  const ri = (a, b) => a + ((r() * (b - a + 1)) | 0);
  const grass = (C = R5.grass, n = 6) => {
    f(0, 0, 16, 16, C[2]);
    for (let i = 0; i < 3; i++) { const X = ri(0, 10), Y = ri(0, 10); for (let j = 0; j < 5; j++) for (let k = 0; k < 6; k++) if (((X + k + Y + j) & 1) === 0 && (k - 2.5) ** 2 / 9 + (j - 2) ** 2 / 6 < 1) q((X + k) & 15, (Y + j) & 15, C[1]); }
    for (let i = 0; i < n; i++) { const X = ri(1, 13), Y = ri(1, 13); q(X, Y, C[0]); q(X + 2, Y, C[0]); q(X + 1, Y + 1, C[1]); q(X, Y + 1, C[3]); q(X + 2, Y + 1, C[3]); q(X + 1, Y + 2, C[3]); }
    for (let i = 0; i < 5; i++) q(ri(0, 15), ri(0, 15), C[3]);
  };
  const stone = (X, Y, w, h, C, mortar) => { f(X, Y, w, h, C[2]); f(X, Y, w - 1, 1, C[1]); f(X, Y, 1, h - 1, C[1]); q(X, Y, C[0]); q(X + 1, Y, C[0]); f(X + w - 1, Y + 1, 1, h - 1, C[3]); f(X + 1, Y + h - 1, w - 1, 1, C[3]); if (mortar) { f(X, Y + h, w + 1, 1, mortar); f(X + w, Y, 1, h, mortar); } };
  switch (t) {
    case T.GRASS: case T.TREE: case T.PINE: grass(); if (v === 1) { q(5, 10, '#d8d0c0'); q(6, 10, '#a09888'); q(5, 11, '#686050'); } if (v === 2) { q(10, 4, '#f0e8a0'); q(4, 12, '#e8b8c8'); } if (v === 3) dith(3, 8, 7, 4, R5.grass[3]); break;
    case T.FENCE: { grass(); const W = R5.timber; // original picket fence: posts + two rails
      f(0, 5, 16, 2, W[1]); f(0, 5, 16, 1, W[0]); f(0, 7, 16, 1, W[4]); f(0, 10, 16, 2, W[1]); f(0, 10, 16, 1, W[0]); f(0, 12, 16, 1, W[4]);
      for (const X of [2, 12]) { f(X - 1, 2, 4, 13, W[4]); f(X, 3, 2, 12, W[2]); f(X, 3, 1, 11, W[0]); q(X, 2, W[0]); q(X + 1, 2, W[1]); f(X - 1, 15, 4, 1, 'rgba(0,0,0,0.35)'); }
      f(0, 13, 16, 1, 'rgba(10,20,10,0.35)'); break; }
    case T.TALL: { grass(R5.tall, 2); const C = R5.tall; for (let i = 0; i < 9; i++) { const X = ri(0, 14), Y = ri(2, 12), hgt = ri(3, 5); f(X, Y - hgt + 3, 1, hgt, C[4]); f(X + 1, Y - hgt + 2, 1, hgt, C[0]); q(X + 1, Y - hgt + 2, '#c8d890'); } break; }
    case T.FLOWER: { grass(R5.grass, 3); const cols = [['#f8e070', '#c89a30'], ['#f090a8', '#b04a68'], ['#f0f0f8', '#a8a8c0'], ['#a890f0', '#6a50b0']];
      for (let i = 0; i < 4; i++) { const X = ri(2, 12), Y = ri(2, 12), [a, b] = cols[ri(0, 3)]; q(X + 1, Y, a); q(X, Y + 1, a); q(X + 2, Y + 1, a); q(X + 1, Y + 2, b); q(X + 1, Y + 1, '#f8f0c0'); q(X + 1, Y + 3, R5.grass[4]); } break; }
    case T.BUSH: { grass(); const L = R5.leaf; blob(1, 3, 14, 12, '#142a18'); blob(2, 4, 12, 10, L[3]); blob(3, 4, 9, 8, L[2]); blob(4, 4, 6, 5, L[1]);
      for (let i = 0; i < 6; i++) { const X = ri(3, 11), Y = ri(5, 11); q(X, Y, L[0]); q(X + 1, Y + 1, L[2]); } dith(3, 10, 10, 3, L[4]); q(5, 5, '#c8e890'); q(6, 5, L[0]); f(3, 14, 10, 1, 'rgba(10,20,10,0.4)');
      if (v & 1) { q(8, 7, '#e84a4a'); q(11, 9, '#e84a4a'); q(6, 10, '#e84a4a'); } break; }
    case T.DIRT: { const C = R5.dirt; f(0, 0, 16, 16, C[2]); dith(ri(0, 6), ri(0, 6), 8, 6, C[1]); dith(ri(4, 10), ri(6, 10), 6, 5, C[3], 1);
      for (let i = 0; i < 4; i++) { const X = ri(1, 13), Y = ri(1, 13); q(X, Y, C[0]); q(X + 1, Y, C[1]); q(X, Y + 1, C[3]); q(X + 1, Y + 1, C[4]); }
      for (let i = 0; i < 6; i++) q(ri(0, 15), ri(0, 15), r() < 0.5 ? C[3] : C[1]); if (v === 3) { f(3, 7, 9, 1, C[3]); f(5, 8, 6, 1, C[4]); } break; }
    case T.SAND: { const C = R5.sand; f(0, 0, 16, 16, C[1]); dith(0, ri(0, 8), 16, 3, C[2]); for (let i = 0; i < 3; i++) { const Y = ri(2, 13), X = ri(0, 8); f(X, Y, 6, 1, C[2]); f(X + 1, Y - 1, 4, 1, C[0]); }
      for (let i = 0; i < 6; i++) q(ri(0, 15), ri(0, 15), r() < 0.5 ? C[3] : C[0]); if (v === 2) { q(8, 9, '#f0e8e0'); q(9, 9, '#c8a8a0'); q(8, 10, '#a08070'); } break; }
    case T.WATER: case T.SEA: case T.SHAL: { const C = t === T.SEA ? R5.sea : t === T.SHAL ? R5.shal : R5.water; f(0, 0, 16, 16, C[2]);
      // world-periodic shimmer: same pattern on every tile, phase-shifted per frame -> rolling water
      dith(0, 0, 16, 16, C[3], 0); for (let j = 0; j < 4; j++) { const Y = j * 4 + 1, X = (j * 5 + v * 2) & 15; f(0, Y, 16, 2, C[2]); for (let k = 0; k < 5; k++) q((X + k) & 15, Y, C[1]); q((X + 1) & 15, Y - 1 & 15, C[0]); q((X + 2) & 15, Y - 1 & 15, C[0]); for (let k = 0; k < 3; k++) q((X + 8 + k) & 15, Y + 2, C[1]); }
      if (((v + 1) & 3) === 0) q(11, 6, '#f8ffff'); if (t === T.SHAL) { dith(0, 10, 16, 6, R5.sand[3], v & 1); } break; }
    case T.ROAD: case T.LINE: { const C = R5.cob, M = C[4]; // cobblestone, staggered rows
      f(0, 0, 16, 16, M); for (let row = 0; row < 4; row++) { const off = row & 1 ? 2 : 0; for (let col = 0; col < 5; col++) { const X = col * 5 - off, x0 = Math.max(0, X), x1 = Math.min(16, X + 4); if (x1 - x0 < 1) continue; stone(x0, row * 4, x1 - x0, 3, r() < 0.2 ? R5.slab : C); } }
      if (t === T.LINE) { for (let col = 0; col < 3; col++) stone(1 + col * 5, 6, 4, 3, R5.flag); }
      if (v === 1) { f(9, 8, 4, 3, M); q(10, 9, '#4a6a88'); q(11, 9, '#7aa0c0'); } if (v === 2) { q(3, 3, '#5a7a40'); q(4, 3, '#4a6a34'); q(13, 11, '#5a7a40'); } if (v === 3) { f(5, 4, 1, 3, M); q(6, 6, M); } break; }
    case T.SIDE: case T.GLASS: { const C = R5.flag, M = C[4]; f(0, 0, 16, 16, M); stone(0, 0, 7, 7, C, null); stone(8, 0, 7, 7, C, null); stone(0, 8, 9, 7, C, null); stone(10, 8, 5, 7, C, null);
      if (v & 1) { q(3, 3, C[3]); q(4, 4, C[3]); q(4, 5, C[3]); } if (v & 2) { dith(9, 2, 4, 3, C[3]); }
      if (t === T.GLASS) for (let i = 0; i < 5; i++) { const X = ri(1, 13), Y = ri(1, 13); q(X, Y, '#e8f8ff'); q(X + 1, Y, '#90b8d0'); q(X, Y + 1, '#4a6a88'); } break; }
    case T.WOOD: { const C = R5.plank; for (let i = 0; i < 4; i++) { const Y = i * 4; f(0, Y, 16, 4, C[2]); f(0, Y, 16, 1, C[1]); f(0, Y + 3, 16, 1, C[4]); const cut = ((i * 7 + v * 3) % 12) + 2; f(cut, Y, 1, 3, C[4]); q(cut + 1, Y + 1, C[1]);
        for (let k = 0; k < 3; k++) { const X = ri(0, 13); f(X, Y + 1 + (k & 1), 3, 1, C[3]); } q((cut + 3) & 15, Y + 1, C[0]); q((cut + 13) & 15, Y + 2, C[4]); }
      if (v === 2) { dith(4, 6, 5, 3, '#5a2a1a'); } break; }
    case T.TILE: { const C = R5.checker; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const lit = (i + j) & 1, X = i * 8, Y = j * 8, A = lit ? C : R5.slab; f(X, Y, 8, 8, A[2]); f(X, Y, 7, 1, A[0]); f(X, Y, 1, 7, A[1]); f(X + 7, Y, 1, 8, A[4]); f(X, Y + 7, 8, 1, A[4]); q(X + 2, Y + 2, A[1]); q(X + 5, Y + 5, A[3]); }
      if (v === 3) dith(4, 5, 6, 4, '#5a3a2a'); break; }
    case T.CONC: { const C = R5.slab; f(0, 0, 16, 16, C[2]); f(0, 0, 15, 1, C[1]); f(0, 0, 1, 15, C[1]); f(15, 0, 1, 16, C[4]); f(0, 15, 16, 1, C[4]); dith(2, 2, 12, 12, C[3], v); for (let i = 0; i < 5; i++) q(ri(1, 14), ri(1, 14), C[1]);
      if (v === 1) { q(5, 4, C[4]); q(6, 5, C[4]); q(6, 6, C[4]); q(7, 7, C[4]); } break; }
    case T.GRAVEL: { const C = R5.gravel; f(0, 0, 16, 16, C[3]); for (let i = 0; i < 26; i++) { const X = ri(0, 14), Y = ri(0, 14); q(X, Y, C[ri(0, 1)]); q(X + 1, Y + 1, C[4]); } break; }
    case T.ROCK: { grass(); const C = R5.rock; blob(1, 2, 14, 13, '#1a1814'); blob(2, 3, 12, 11, C[3]); blob(2, 3, 10, 9, C[2]); blob(3, 3, 7, 6, C[1]); f(5, 4, 3, 1, C[0]); q(4, 5, C[0]); dith(3, 10, 10, 3, C[4]); f(8, 7, 1, 3, C[4]); q(9, 6, C[4]); f(2, 14, 12, 1, 'rgba(10,15,10,0.4)'); break; }
    case T.BRIDGE: { const C = R5.plank; f(0, 0, 16, 16, C[4]); for (let i = 0; i < 4; i++) { const X = i * 4; f(X, 0, 3, 16, C[2]); f(X, 0, 1, 16, C[1]); q(X + 1, 2, '#2a2a2a'); q(X + 1, 13, '#2a2a2a'); f(X + 2, ri(3, 9), 1, 3, C[3]); } f(0, 0, 16, 1, R5.timber[3]); f(0, 15, 16, 1, R5.timber[4]); break; }
    case T.FIELD: { const C = R5.wheat; f(0, 0, 16, 16, R5.dirt[3]); for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const X = i * 3 - (j & 1) + 1, Y = j * 4; f(X, Y, 1, 4, C[3]); q(X, Y, C[0]); q(X + 1, Y + 1, C[1]); q(X - 1, Y + 1, C[2]); } break; }
    case T.TILLED: { const C = R5.tilled; f(0, 0, 16, 16, C[2]); for (let i = 0; i < 4; i++) { const Y = i * 4; f(0, Y, 16, 1, C[4]); f(0, Y + 1, 16, 1, C[0]); f(0, Y + 2, 16, 1, C[1]); for (let k = 0; k < 4; k++) q(ri(0, 15), Y + 2, C[3]); } break; }
    case T.MINE: { const C = R5.rock, W = R5.timber; f(0, 0, 16, 16, C[3]); dith(0, 0, 16, 16, C[2]); f(2, 4, 12, 12, '#0c0a10'); f(3, 6, 10, 10, '#05040a'); f(1, 3, 14, 2, W[1]); f(1, 3, 14, 1, W[0]); f(1, 3, 2, 13, W[2]); f(13, 3, 2, 13, W[2]); f(1, 3, 1, 13, W[0]); f(14, 3, 1, 13, W[4]); q(6, 4, '#f0c060'); break; }
    case T.WALL: case T.WALLW: case T.WALLC: {
      const face = v !== 0, C = t === T.WALL ? R5.stone : t === T.WALLW ? R5.plaster : R5.metal;
      if (!face) { // wall top (seen from above): dark coping with a lit lip
        const D = t === T.WALLW ? R5.timber : C; f(0, 0, 16, 16, D[3]); dith(0, 0, 16, 16, D[4]); f(0, 0, 16, 2, D[2]); f(0, 0, 16, 1, D[1]); f(0, 14, 16, 2, D[4]);
        if (t === T.WALL) for (let i = 0; i < 4; i++) f(i * 4 + 3, 2, 1, 12, D[4]); break; }
      // 3/4 wall face
      if (t === T.WALL) { f(0, 0, 16, 16, C[4]); for (let row = 0; row < 4; row++) { const off = row & 1 ? 4 : 0; for (let k = 0; k < 4; k++) { const X = k * 8 - off, x0 = Math.max(0, X), x1 = Math.min(16, X + 7); if (x1 - x0 < 1) continue; stone(x0, row * 4, x1 - x0, 3, row === 3 ? R5.rock : C); } } }
      else if (t === T.WALLW) { f(0, 0, 16, 16, C[1]); dith(0, 8, 16, 8, C[2]); f(0, 0, 16, 1, C[0]); const W = R5.timber; f(0, 0, 2, 16, W[2]); f(0, 0, 1, 16, W[1]); f(14, 0, 2, 16, W[3]); f(0, 2, 16, 2, W[2]); f(0, 2, 16, 1, W[1]); f(0, 13, 16, 3, W[3]); f(0, 13, 16, 1, W[2]); if (v < 2) { for (let i = 0; i < 6; i++) q(ri(3, 12), ri(5, 11), C[3]); } }
      else { f(0, 0, 16, 16, C[2]); for (let i = 0; i < 4; i++) { f(i * 4, 0, 1, 16, C[0]); f(i * 4 + 1, 0, 1, 16, C[1]); f(i * 4 + 3, 0, 1, 16, C[4]); } f(0, 0, 16, 1, C[0]); f(0, 15, 16, 1, C[4]); q(2, 4, '#a86a3a'); q(9, 11, '#a86a3a'); dith(8, 9, 5, 4, '#8a5a32'); }
      f(0, 15, 16, 1, 'rgba(0,0,0,0.45)');
      if (v >= 2 && t !== T.WALLC) { // shuttered window, warm candlelight in some
        const lit = v === 3, F = R5.timber; f(3, 4, 10, 9, '#161018'); f(4, 5, 8, 7, '#1a2a44'); f(4, 5, 8, 3, '#2a4466');
        if (lit) { f(4, 5, 8, 7, '#c88a3a'); f(4, 5, 8, 3, '#f0c060'); q(5, 6, '#fff0b0'); } else { q(5, 6, '#8ab0d0'); q(6, 5, '#6a90b8'); }
        f(7, 5, 2, 7, F[3]); f(4, 8, 8, 1, F[3]); f(2, 4, 1, 9, F[1]); f(13, 4, 1, 9, F[2]); f(2, 12, 12, 2, F[1]); f(2, 12, 12, 1, F[0]); f(2, 3, 12, 1, F[2]);
      }
      break; }
    case T.DOOR: { const W = R5.timber, Pk = R5.plank; f(0, 0, 16, 16, '#141018'); f(1, 0, 14, 16, W[3]); f(1, 0, 1, 16, W[1]); f(14, 0, 1, 16, W[4]); // frame
      f(3, 2, 10, 14, Pk[3]); for (let i = 0; i < 3; i++) { f(3 + i * 3 + (i > 1 ? 1 : 0), 2, 3, 14, Pk[2]); f(3 + i * 3 + (i > 1 ? 1 : 0), 2, 1, 14, Pk[1]); } f(4, 1, 8, 1, Pk[2]); f(5, 0, 6, 1, W[3]);
      f(3, 5, 10, 1, '#3a3a44'); f(3, 11, 10, 1, '#3a3a44'); f(3, 5, 10, 1, '#5a5a66'); q(11, 8, '#f0c868'); q(11, 9, '#a07830'); f(2, 15, 12, 1, R5.stone[2]); break; }
  }
}
function buildAtlas() {
  const [c, x] = mk(16 * 32, 16 * ATLAS_V); for (let t = 0; t < 32; t++) for (let v = 0; v < ATLAS_V; v++) paintTile(x, t * 16, v * 16, t, v);
  ATLAS = c; buildEdges();
}
// ---- transition overlays: grass fringe spilling onto paths/floors, and lapping shorelines (rows: grass N,E,S,W | shore N,E,S,W x2 frames)
function buildEdges() {
  const [c, x] = mk(16 * 4, 16 * 3), G5 = R5.grass, rr = rng(4242);
  const jag = []; for (let i = 0; i < 16; i++) jag.push(1 + ((rr() * 3) | 0));
  for (let d = 0; d < 4; d++) { const ox = d * 16;
    for (let i = 0; i < 16; i++) { const L = jag[i] + (i & 1); for (let k = 0; k < L + 1; k++) { const col = k === L ? 'rgba(20,30,10,0.45)' : k === L - 1 ? G5[3] : G5[2]; let X, Y; if (d === 0) { X = i; Y = k; } else if (d === 2) { X = i; Y = 15 - k; } else if (d === 1) { X = 15 - k; Y = i; } else { X = k; Y = i; } P(x, ox + X, Y, 1, 1, col); } if (L > 1 && (i % 3) === 0) { const k = 0; let X, Y; if (d === 0) { X = i; Y = k; } else if (d === 2) { X = i; Y = 15; } else if (d === 1) { X = 15; Y = i; } else { X = 0; Y = i; } P(x, ox + X, Y, 1, 1, G5[1]); } }
    for (let fr = 0; fr < 2; fr++) { const oy = 16 + fr * 16;
      for (let i = 0; i < 16; i++) { const w = ((i + fr * 3) % 5) < 2 ? 2 : 1; for (let k = 0; k < w + 2; k++) { const col = k < w ? '#e8f4ff' : k === w ? 'rgba(200,230,255,0.55)' : 'rgba(10,20,40,0.35)'; let X, Y; if (d === 0) { X = i; Y = k; } else if (d === 2) { X = i; Y = 15 - k; } else if (d === 1) { X = 15 - k; Y = i; } else { X = k; Y = i; } P(x, ox + X, oy + Y, 1, 1, col); } } } }
  EDGE = c;
}
const GRASSY = new Uint8Array(40), WATERY = new Uint8Array(40), FRINGED = new Uint8Array(40);
for (const t of ['GRASS', 'TALL', 'FLOWER', 'BUSH', 'TREE', 'PINE', 'FENCE', 'ROCK']) GRASSY[T[t]] = 1;
for (const t of ['WATER', 'SEA', 'SHAL']) WATERY[T[t]] = 1;
for (const t of ['DIRT', 'SAND', 'ROAD', 'LINE', 'SIDE', 'GRAVEL', 'FIELD', 'TILLED', 'GLASS', 'CONC']) FRINGED[T[t]] = 1;
// ---- selective 1px outline (16-bit style): each rim pixel = a deep shade of the colour it borders; plus a soft top-light pass
function outline1(src, light = true) {
  const w = src.width + 2, h = src.height + 2, [c, x] = mk(w, h); x.drawImage(src, 1, 1);
  const id = x.getImageData(0, 0, w, h), d = id.data, o = new Uint8ClampedArray(d), A = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : d[(j * w + i) * 4 + 3];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4;
    if (d[k + 3] < 128) { let n = -1; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (A(i + dx, j + dy) >= 128) { n = ((j + dy) * w + i + dx) * 4; break; }
      if (n >= 0) { o[k] = d[n] * 0.22 + 14; o[k + 1] = d[n + 1] * 0.18 + 8; o[k + 2] = d[n + 2] * 0.22 + 22; o[k + 3] = 255; } }
    else if (light) { if (A(i, j - 1) < 128 || A(i - 1, j) < 128) { o[k] = Math.min(255, d[k] * 1.12 + 10); o[k + 1] = Math.min(255, d[k + 1] * 1.12 + 10); o[k + 2] = Math.min(255, d[k + 2] * 1.1 + 8); }
      else if (A(i, j + 1) < 128 || A(i + 1, j) < 128) { o[k] = d[k] * 0.78; o[k + 1] = d[k + 1] * 0.78; o[k + 2] = d[k + 2] * 0.84; } } }
  id.data.set(o); x.putImageData(id, 0, 0); return c;
}
// legacy name used by props / icons / vehicles: now the 1px selective outline (rim arg ignored)
function cutout(src) { return outline1(src); }
function silhouette(src, col) { const [c, x] = mk(src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }
// ---- chibi people: 16x24, 4 directions (0 down, 1 up, 2 left, 3 right=mirror) x 4 frames (stand, stepA, stepB, action)
const SPR = new Map();
function paintPerson(x, L, dir, f) {
  const p = (X, Y, w, h, col) => { if (col) P(x, X, Y, w, h, col); }, q = (X, Y, col) => p(X, Y, 1, 1, col);
  const z = !!L.zombie, fat = !!L.fat, sk = L.skin, skD = L.skinD, skH = shade(sk, 22);
  const hr = L.hair, hD = shade(hr, -26), hH = shade(hr, 34);
  const sh = L.shirt || sk, shD = L.shirt ? L.shirtD : skD, shH = shade(sh, 26), shDD = shade(shD, -24);
  const pa = L.pants, paD = L.pantsD, paH = shade(pa, 20);
  const so = L.shoes || skD, soD = L.shoes ? (L.shoesD || shade(so, -30)) : shade(skD, -20);
  const hy = z ? 1 : 0, hx0 = z && dir === 2 ? -1 : 0; // zombies hunch (head drops / juts forward)
  const walk = f === 1 ? 1 : f === 2 ? 2 : 0, act = f === 3;
  const BLOOD = '#8a1414', BLOOD2 = '#5a0a0a';
  // ---------- legs + shoes
  if (dir !== 2) {
    p(4, 18, 8, 1, paD); const lUp = walk === 1 ? 1 : 0, rUp = walk === 2 ? 1 : 0;
    p(5, 18, 3, 4 - lUp, pa); q(5, 18, paH); p(5, 19, 1, 3 - lUp, paH); p(8, 18, 3, 4 - rUp, pa); p(10, 18, 1, 4 - rUp, paD); p(7, 19, 2, 1, paD);
    p(4, 22 - lUp, 4, 2, so); p(4, 23 - lUp, 4, 1, soD); p(8, 22 - rUp, 4, 2, so); p(8, 23 - rUp, 4, 1, soD);
    if (dir === 0) { q(5, 22 - lUp, shade(so, 30)); q(9, 22 - rUp, shade(so, 30)); }
    if (z && L.torn) { q(6, 20 - lUp, skD); q(9, 21 - rUp, sk); }
  } else {
    if (walk === 0) { p(6, 18, 2, 4, pa); q(6, 18, paH); p(8, 18, 2, 4, paD); p(4, 22, 5, 2, so); p(4, 23, 5, 1, soD); p(8, 22, 2, 2, soD); }
    else { const A = walk === 1 ? pa : paD, B = walk === 1 ? paD : pa;
      p(8, 18, 2, 1, B); p(9, 19, 2, 1, B); p(10, 20, 2, 2, B); p(10, 22, 3, 2, walk === 1 ? soD : so);
      p(6, 18, 3, 1, A); p(5, 19, 3, 1, A); p(4, 20, 3, 1, A); p(4, 21, 2, 1, A); p(2, 22, 4, 2, walk === 1 ? so : soD); p(2, 23, 4, 1, soD); }
  }
  // ---------- torso
  const tx = fat ? 3 : 4, tw = fat ? 10 : 8;
  if (dir !== 2) {
    p(tx - 1, 11, tw + 2, 2, sh); p(tx, 13, tw, 5, sh); p(tx, 11, 1, 6, shH); p(tx + tw - 2, 12, 2, 5, shD); p(tx + tw, 11, 1, 2, shD);
    if (fat) { p(5, 14, 6, 3, shH); p(6, 16, 4, 1, sh); }
    if (dir === 0) { p(6, 11, 4, 1, skD); q(7, 12, skD); q(8, 12, skD); if (L.shirt && !z) { q(6, 12, shD); q(9, 12, shD); } }
    else { p(6, 11, 4, 1, skD); }
    p(tx, 17, tw, 1, '#241a24'); if (!z && L.shirt) { q(7, 17, '#d8b050'); q(8, 17, '#a07830'); }
    if (L.pack) { if (dir === 1) { p(5, 12, 6, 6, L.pack); p(5, 12, 6, 1, shade(L.pack, 30)); p(5, 14, 6, 1, shade(L.pack, -30)); p(10, 13, 1, 5, shade(L.pack, -30)); q(7, 15, '#d8b050'); } else { p(5, 11, 1, 4, shade(L.pack, -20)); p(10, 11, 1, 4, shade(L.pack, -40)); } }
    if (z) { if (L.torn) { q(tx + 2, 17, null); x.clearRect(tx + 1, 17, 1, 1); x.clearRect(tx + 4, 17, 1, 1); x.clearRect(tx + tw - 2, 17, 1, 1); p(tx + 2, 14, 2, 2, sk); q(tx + 2, 14, skD); p(tx + tw - 3, 12, 1, 2, skD); }
      if (L.blood) { p(6, 13, 2, 3, BLOOD); q(5, 15, BLOOD2); q(8, 14, BLOOD2); q(9, 16, BLOOD); } }
  } else {
    p(5, 11, 6, 7, sh); p(5, 11, 1, 6, shH); p(9, 12, 2, 5, shD); p(6, 11, 2, 1, skD); p(5, 17, 6, 1, '#241a24');
    if (fat) { p(4, 13, 2, 4, sh); q(4, 13, shH); }
    if (L.pack) { p(10, 11, 4, 7, L.pack); p(10, 11, 4, 1, shade(L.pack, 30)); p(13, 12, 1, 6, shade(L.pack, -30)); p(10, 14, 4, 1, shade(L.pack, -25)); }
    if (z) { if (L.torn) { x.clearRect(6, 17, 1, 1); x.clearRect(9, 17, 1, 1); p(6, 14, 2, 1, sk); } if (L.blood) { p(5, 12, 2, 3, BLOOD); q(7, 15, BLOOD2); } }
  }
  // ---------- arms
  const sleeveFull = L.sleeve || !L.shirt || z, armC = (row) => (sleeveFull || row < 13 ? sh : sk), armCD = (row) => (sleeveFull || row < 13 ? shD : skD);
  const hand = z ? shade(sk, -8) : sk;
  if (dir !== 2) {
    if (act || z) { // raised / reaching claws
      const lift = z ? 0 : -3, ax = fat ? -1 : 0;
      p(2 + ax, 11 + lift, 2, 3, armC(12)); p(1 + ax, 13 + lift, 2, 1, armCD(13)); p(0 + ax, 13 + lift + (z ? 1 : 0), 2, 2, hand); if (z) { q(0 + ax, 16 + lift, skD); }
      p(12 - ax, 11 + lift, 2, 3, armCD(12)); p(13 - ax, 13 + lift, 2, 1, armCD(13)); p(14 - ax, 13 + lift + (z ? 1 : 0), 2, 2, hand); if (z) { q(15 - ax, 16 + lift, skD); q(14 - ax, 15 + lift, BLOOD); }
    } else {
      const lA = walk === 1 ? -1 : 0, rA = walk === 2 ? -1 : 0, ax = fat ? -1 : 0;
      p(2 + ax, 12 + lA, 2, 3, armC(12)); q(2 + ax, 12 + lA, shH); p(2 + ax, 15 + lA, 2, 1, armC(15)); p(2 + ax, 16 + lA, 2, 1, hand);
      p(12 - ax, 12 + rA, 2, 3, armCD(12)); p(12 - ax, 15 + rA, 2, 1, armCD(15)); p(12 - ax, 16 + rA, 2, 1, shade(hand, -18));
    }
  } else {
    if (act || z) { p(3, 12, 5, 2, armC(12)); q(3, 12, shH); p(1, 12, 2, 2, hand); if (z) { q(0, 13, skD); q(1, 14, BLOOD); } }
    else if (walk === 1) { p(6, 12, 2, 2, armC(12)); p(5, 14, 2, 1, armC(14)); p(4, 15, 2, 1, hand); }
    else if (walk === 2) { p(8, 12, 2, 2, armCD(12)); p(9, 14, 2, 1, armCD(14)); p(10, 15, 2, 1, hand); }
    else { p(7, 12, 2, 3, armC(12)); q(7, 12, shH); p(7, 15, 2, 1, armC(15)); p(7, 16, 2, 1, hand); }
  }
  // ---------- head
  const Y = hy, X = hx0;
  if (dir === 0) {
    p(X + 3, Y + 4, 10, 6, sk); p(X + 4, Y + 10, 8, 1, skD); p(X + 12, Y + 5, 1, 5, skD); q(X + 3, Y + 9, skD); q(X + 3, Y + 5, skH); q(X + 4, Y + 5, skH);
    // hair
    p(X + 5, Y + 0, 6, 1, hr); p(X + 3, Y + 1, 10, 1, hr); p(X + 2, Y + 2, 12, 3, hr); p(X + 2, Y + 5, 1, 3, hr); p(X + 13, Y + 5, 1, 3, hD);
    p(X + 5, Y + 1, 4, 1, hH); p(X + 3, Y + 2, 2, 1, hH); p(X + 12, Y + 2, 2, 3, hD); q(X + 5, Y + 4, sk); q(X + 6, Y + 4, sk); q(X + 9, Y + 4, sk); q(X + 10, Y + 4, sk); q(X + 4, Y + 4, hD); q(X + 11, Y + 4, hD);
    if (L.hairS === 1) { p(X + 1, Y + 4, 2, 8, hr); p(X + 13, Y + 4, 2, 8, hD); q(X + 1, Y + 4, hH); }
    else if (L.hairS === 2) { p(X + 4, Y - 1 + 1, 8, 1, hr); p(X + 1, Y + 2, 1, 4, hr); p(X + 14, Y + 2, 1, 4, hD); q(X + 7, Y, hH); }
    else if (L.hairS === 3) { p(X + 5, Y + 0, 6, 2, sk); p(X + 6, Y + 1, 3, 1, skH); q(X + 4, Y + 1, sk); p(X + 3, Y + 2, 2, 1, hr); }
    // face
    if (z) { q(X + 5, Y + 6, '#ff4020'); q(X + 10, Y + 6, '#ff4020'); q(X + 5, Y + 7, '#801010'); q(X + 10, Y + 7, '#801010'); p(X + 6, Y + 9, 4, 1, '#2a0808'); q(X + 7, Y + 9, '#c8c0a0'); q(X + 7, Y + 10, BLOOD); q(X + 4, Y + 8, skD); q(X + 11, Y + 5, shade(skD, -10)); if (L.blood) { q(X + 9, Y + 9, BLOOD); q(X + 9, Y + 10, BLOOD2); } }
    else { p(X + 5, Y + 6, 1, 2, '#1a1028'); p(X + 10, Y + 6, 1, 2, '#1a1028'); q(X + 5, Y + 5, hD); q(X + 10, Y + 5, hD); q(X + 4, Y + 8, '#e89080'); q(X + 11, Y + 8, '#d08070'); p(X + 7, Y + 9, 2, 1, shade(sk, -34)); }
  } else if (dir === 1) {
    p(X + 5, Y + 0, 6, 1, hr); p(X + 3, Y + 1, 10, 1, hr); p(X + 2, Y + 2, 12, 7, hr); p(X + 3, Y + 9, 10, 1, hr); p(X + 4, Y + 10, 8, 1, hD);
    p(X + 5, Y + 1, 4, 1, hH); p(X + 3, Y + 2, 3, 2, hH); p(X + 12, Y + 2, 2, 7, hD); p(X + 3, Y + 8, 10, 1, hD); q(X + 2, Y + 6, sk); q(X + 13, Y + 6, skD);
    if (L.hairS === 1) { p(X + 3, Y + 10, 10, 2, hr); p(X + 3, Y + 11, 10, 1, hD); }
    if (L.hairS === 3) { p(X + 5, Y + 0, 6, 3, sk); p(X + 6, Y + 1, 3, 1, skH); q(X + 8, Y + 5, sk); }
    if (z && L.blood) { q(X + 9, Y + 4, BLOOD); q(X + 10, Y + 5, BLOOD2); }
  } else {
    p(X + 3, Y + 4, 7, 6, sk); p(X + 4, Y + 10, 5, 1, skD); q(X + 2, Y + 7, sk); q(X + 2, Y + 8, skD); q(X + 3, Y + 5, skH);
    p(X + 6, Y + 0, 5, 1, hr); p(X + 4, Y + 1, 8, 1, hr); p(X + 3, Y + 2, 10, 2, hr); p(X + 3, Y + 4, 3, 1, hr); p(X + 8, Y + 4, 5, 5, hr); p(X + 9, Y + 9, 3, 1, hD);
    p(X + 5, Y + 1, 4, 1, hH); p(X + 4, Y + 2, 2, 1, hH); p(X + 11, Y + 3, 2, 6, hD); q(X + 3, Y + 4, hD);
    p(X + 8, Y + 6, 1, 2, sk); q(X + 9, Y + 7, skD);
    if (L.hairS === 1) { p(X + 9, Y + 9, 4, 3, hr); p(X + 12, Y + 4, 1, 8, hD); }
    if (L.hairS === 3) { p(X + 5, Y + 0, 6, 3, sk); q(X + 6, Y + 1, skH); }
    if (z) { q(X + 4, Y + 6, '#ff4020'); q(X + 4, Y + 7, '#801010'); p(X + 3, Y + 9, 2, 1, '#2a0808'); q(X + 3, Y + 10, BLOOD); }
    else { p(X + 4, Y + 6, 1, 2, '#1a1028'); q(X + 4, Y + 5, hD); q(X + 4, Y + 9, shade(sk, -34)); q(X + 5, Y + 8, '#e89080'); }
  }
  if (L.hat) { const H = L.hat, HH = shade(H, 30), HD = shade(H, -30);
    if (dir === 2) { p(X + 5, Y - 1, 6, 4, H); p(X + 5, Y - 1, 6, 1, HH); p(X + 1, Y + 3, 12, 1, HD); p(X + 1, Y + 2, 4, 1, H); q(X + 10, Y, HD); }
    else { p(X + 4, Y - 1, 8, 4, H); p(X + 4, Y - 1, 8, 1, HH); p(X + 11, Y, 1, 3, HD); p(X + 1, Y + 3, 14, 1, HD); p(X + 2, Y + 2, 12, 1, H); p(X + 4, Y + 2, 8, 1, shade(H, -50)); }
  }
}
function personFrames(L) {
  const key = JSON.stringify(L); let S = SPR.get(key); if (S) return S;
  const d = [[], [], [], []];
  for (let dir = 0; dir < 3; dir++) for (let f = 0; f < 4; f++) { const [c, x] = mk(16, 25); x.translate(0, 1); paintPerson(x, L, dir, f); d[dir].push(outline1(c)); }
  for (let f = 0; f < 4; f++) { const s = d[2][f], [c, x] = mk(s.width, s.height); x.translate(s.width, 0); x.scale(-1, 1); x.drawImage(s, 0, 0); d[3].push(c); }
  S = { d, frames: d[0] }; SPR.set(key, S); if (SPR.size > 600) SPR.delete(SPR.keys().next().value); return S;
}
const SKINS = [['#f8d0a8', '#d8a078'], ['#e0a878', '#b87c50'], ['#b07850', '#86562e'], ['#7e4e2e', '#5a341c'], ['#fce0c4', '#e0b090']];
const ZSKINS = [['#8a9a78', '#5e6e54'], ['#94a088', '#66705c'], ['#7c8a80', '#545e58'], ['#9a9478', '#6c6650'], ['#a0a890', '#707a64'], ['#7a8a70', '#4e5c48']];
function playerLook() {
  const I = PL.inv, sh = I.wear.body, ft = I.wear.feet, bk = I.wear.back;
  return { skin: SKINS[0][0], skinD: SKINS[0][1], hair: '#c0702e', hairS: 2, pants: '#3a4a8c', pantsD: '#26306a', shirt: sh ? IT[sh.id].col : '#c8c0a8', shirtD: sh ? shade(IT[sh.id].col, -34) : '#948a74', sleeve: true,
    shoes: ft ? IT[ft.id].col : '#6a4428', shoesD: ft ? shade(IT[ft.id].col, -40) : '#42281a', pack: bk ? IT[bk.id].col : null };
}
function zombieLook(seed) { const r = rng(seed), s = ZSKINS[(r() * ZSKINS.length) | 0], sh = ['#7a6450', '#4e6478', '#8a4434', '#56683e', '#86827a', '#64507a', '#9a8460'][(r() * 7) | 0], pa = ['#3e3e52', '#54402c', '#2e4054', '#4e4c3a', '#40342a'][(r() * 5) | 0];
  return { skin: s[0], skinD: s[1], hair: ['#2a2018', '#4a4a48', '#1a1a1e', '#5a4028', '#3a1a14'][(r() * 5) | 0], hairS: (r() * 4) | 0, pants: pa, pantsD: shade(pa, -22), shirt: sh, shirtD: shade(sh, -32), zombie: true, torn: r() < 0.85, blood: r() < 0.92,
    shoes: r() < 0.5 ? '#2a2420' : null, shoesD: '#16120e' }; }
function survivorLook(seed) { const r = rng(seed), s = SKINS[(r() * SKINS.length) | 0], sh = ['#d8a040', '#c84a5a', '#4a8ac8', '#5ab870', '#e8e0c8', '#8a5ac8'][(r() * 6) | 0], pa = ['#3a5a8c', '#5a4a3a', '#3a3a3a', '#6a6a4a'][(r() * 4) | 0];
  return { skin: s[0], skinD: s[1], hair: ['#3a2a1a', '#d8b870', '#8a3a1a', '#1a1a1a', '#c8c8c8'][(r() * 5) | 0], hairS: (r() * 3) | 0, pants: pa, pantsD: shade(pa, -20), shirt: sh, shirtD: shade(sh, -30), sleeve: r() < 0.5,
    shoes: '#5a3a2a', shoesD: '#3a2a1a', hat: r() < 0.3 ? ['#c8a060', '#5a3a2a', '#c84a3a'][(r() * 3) | 0] : null }; }
// facing from movement (0 down, 1 up, 2 left, 3 right); kept off the entity so saves stay small
const DIRS = new WeakMap();
function dir4(e, fs) { let m = DIRS.get(e); if (!m) { m = { x: e.x, y: e.y, d: fs < 0 ? 2 : fs > 0 ? 3 : 0 }; DIRS.set(e, m); }
  const dx = e.x - m.x, dy = e.y - m.y; m.x = e.x; m.y = e.y; if (Math.abs(dx) + Math.abs(dy) > 0.002) m.d = Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); return m.d; }
const WALK4 = [1, 0, 2, 0];
// draw a person: feet at (sx, sy) screen px. fs kept for old callers (sign = left/right when no dir given)
function drawStandee(S, fr, sx, sy, fs, bob = 0, tilt = 0, alpha = 1, dir) {
  if (dir == null) dir = fs < -0.3 ? 2 : fs > 0.3 ? 3 : 0;
  const img = S.d[dir][fr], w = img.width, h = img.height, X = Math.round(sx), Y = Math.round(sy);
  hx.globalAlpha = alpha * 0.5; hx.fillStyle = '#06040c'; hx.fillRect(X - 5, Y - 2, 10, 3); hx.fillRect(X - 6, Y - 1, 12, 1); hx.globalAlpha = alpha;
  hx.drawImage(img, X - (w >> 1) + (tilt > 0.04 ? 1 : tilt < -0.04 ? -1 : 0), Y - h + 2 + Math.round(bob)); hx.globalAlpha = 1;
}
// ---- props (containers, furniture, built structures) 16x18 + 1px selective outline
const PROP = {};
function propImg(k, open) {
  const key = k + (open ? '_o' : ''); if (PROP[key]) return PROP[key];
  const [c, x] = mk(16, 18), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col), q = (X, Y, col) => P(x, X, Y, 1, 1, col);
  const W = R5.plank, Tm = R5.timber, M = R5.metal, GOLD = ['#fff0a0', '#f0c850', '#c89430', '#8a6020'];
  const dith = (X, Y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((i + j) & 1) === 0) q(X + i, Y + j, col); };
  switch (k) {
    case 'barrel': // banded oak barrel
      p(3, 3, 10, 15, W[2]); p(2, 5, 12, 11, W[2]); p(3, 3, 2, 15, W[1]); p(2, 5, 2, 11, W[1]); p(11, 3, 2, 15, W[3]); p(12, 5, 2, 11, W[3]); p(6, 4, 1, 13, W[3]); p(9, 4, 1, 13, W[3]);
      p(3, 2, 10, 2, W[3]); p(4, 2, 8, 1, open ? '#1a120c' : W[1]); if (!open) { p(5, 2, 6, 1, W[0]); }
      for (const Y of [5, 14]) { p(2, Y, 12, 1, M[3]); p(3, Y, 4, 1, M[1]); q(4, Y, M[0]); }
      dith(3, 15, 10, 2, W[4]); break;
    case 'chest': // iron-bound treasure chest
      p(1, 9, 14, 8, W[2]); p(1, 9, 14, 1, W[1]); p(1, 9, 1, 8, W[1]); p(14, 9, 1, 8, W[4]); dith(2, 14, 12, 3, W[3]);
      if (open) { p(1, 3, 14, 6, '#24140c'); p(2, 6, 12, 3, '#3a2214'); p(1, 2, 14, 2, W[3]); }
      else { p(1, 4, 14, 5, W[2]); p(2, 3, 12, 1, W[1]); p(1, 4, 14, 1, W[0]); p(1, 8, 14, 1, W[4]); }
      for (const X of [3, 11]) { p(X, open ? 2 : 3, 2, 15, GOLD[2]); q(X, open ? 2 : 3, GOLD[0]); p(X, 9, 1, 8, GOLD[1]); }
      p(7, 8, 2, 3, GOLD[1]); q(7, 8, GOLD[0]); q(8, 10, '#2a1a10'); break;
    case 'crate': case 'seedbox': {
      p(1, 4, 14, 13, W[2]); p(1, 4, 14, 2, W[1]); p(1, 4, 14, 1, W[0]); p(1, 4, 1, 13, W[1]); p(14, 5, 1, 12, W[4]); p(1, 16, 14, 1, W[4]); p(1, 10, 14, 1, W[3]);
      p(2, 6, 1, 10, Tm[3]); p(13, 6, 1, 10, Tm[3]); for (let i = 0; i < 9; i++) { q(3 + i, 6 + i, Tm[2]); q(4 + i, 6 + i, Tm[3]); } dith(2, 12, 12, 4, W[3]);
      for (const [X, Y] of [[2, 5], [13, 5], [2, 15], [13, 15]]) q(X, Y, '#a8a8b0');
      if (k === 'seedbox') { p(4, 7, 8, 5, '#e8dcb8'); p(4, 7, 8, 1, '#fff4d8'); p(7, 8, 2, 3, '#4a9a58'); q(6, 9, '#6a4a28'); q(9, 10, '#d89a30'); }
      if (open) { p(2, 5, 12, 4, '#24140c'); q(4, 6, '#3a2214'); }
      break; }
    case 'shelf': // wooden bookshelf with books / jars
      p(0, 1, 16, 17, Tm[2]); p(0, 1, 16, 1, Tm[0]); p(0, 1, 1, 17, Tm[1]); p(15, 1, 1, 17, Tm[4]); p(1, 2, 14, 15, '#1e140e');
      for (let i = 0; i < 3; i++) { const Y = 2 + i * 5; p(1, Y + 4, 14, 1, Tm[1]); q(1, Y + 4, Tm[0]);
        if (!open) { const books = [['#b83a3a', '#7a2020'], ['#3a6ab8', '#22407a'], ['#4a9a58', '#2a6034'], ['#d8a840', '#8a6020'], ['#8a5ab8', '#583878']]; let X = 2;
          for (let b = 0; b < 5 && X < 14; b++) { const [a, d] = books[(i * 2 + b) % 5], bw = 1 + ((i + b) % 2), bh = 3 + ((b + i) % 2); p(X, Y + 4 - bh, bw, bh, a); q(X, Y + 4 - bh, shade(a, 40)); if (bw > 1) p(X + 1, Y + 4 - bh, 1, bh, d); X += bw + (b === 2 ? 2 : 0); }
          if (i === 1) { p(11, Y + 1, 3, 3, '#a8c8d8'); p(11, Y + 1, 3, 1, '#5a3a22'); q(12, Y + 2, '#e8f8ff'); } } }
      break;
    case 'cabinet': case 'dresser':
      p(1, 4, 14, 14, Tm[2]); p(1, 3, 14, 2, Tm[1]); p(1, 3, 14, 1, Tm[0]); p(1, 4, 1, 14, Tm[1]); p(14, 4, 1, 14, Tm[4]); p(1, 17, 14, 1, Tm[4]);
      if (k === 'dresser') for (let i = 0; i < 3; i++) { const Y = 6 + i * 4; p(2, Y, 12, 3, Tm[1]); p(2, Y + 3, 12, 1, Tm[4]); q(2, Y, Tm[0]); p(7, Y + 1, 2, 1, GOLD[1]); }
      else { p(2, 6, 6, 10, Tm[1]); p(8, 6, 6, 10, Tm[1]); p(7, 6, 1, 10, Tm[4]); p(2, 6, 1, 10, Tm[0]); p(8, 6, 1, 10, Tm[0]); q(6, 11, GOLD[1]); q(9, 11, GOLD[1]); }
      if (open) { p(2, 6, 12, 6, '#1e140e'); q(4, 9, '#a8a8b0'); }
      break;
    case 'bunk': case 'bed': { const Q = k === 'bed' ? ['#d86a6a', '#b84a4a', '#8a2e3a', '#5a1e28'] : ['#7a96c8', '#5a76a8', '#3e5684', '#283a5c'];
      p(0, 2, 16, 15, Tm[2]); p(0, 2, 16, 2, Tm[1]); p(0, 2, 16, 1, Tm[0]); p(0, 16, 16, 2, Tm[4]); p(0, 2, 1, 15, Tm[1]); p(15, 2, 1, 15, Tm[3]);
      p(2, 4, 12, 4, '#f0ece0'); p(2, 4, 12, 1, '#ffffff'); p(2, 7, 12, 1, '#c8c0b0'); // pillow
      p(1, 8, 14, 8, Q[1]); p(1, 8, 14, 1, Q[0]); dith(1, 12, 14, 4, Q[2]); for (let i = 0; i < 3; i++) p(3 + i * 4, 9, 2, 6, Q[2]); p(1, 9, 14, 1, Q[0]); p(1, 15, 14, 1, Q[3]);
      if (k === 'bunk') { p(0, 0, 2, 17, Tm[3]); p(14, 0, 2, 17, Tm[3]); } break; }
    case 'workbench':
      p(0, 7, 16, 3, W[1]); p(0, 7, 16, 1, W[0]); p(0, 10, 16, 1, W[4]); p(1, 11, 2, 7, Tm[3]); p(13, 11, 2, 7, Tm[3]); p(1, 15, 14, 1, Tm[3]); q(1, 11, Tm[1]);
      p(2, 4, 4, 3, M[2]); p(2, 4, 4, 1, M[0]); p(7, 5, 1, 2, Tm[2]); p(6, 4, 3, 1, M[1]); p(10, 3, 1, 4, Tm[1]); p(9, 3, 3, 2, M[2]); q(9, 3, M[0]); p(12, 6, 3, 1, '#c84a3a'); break;
    case 'campfire':
      for (let i = 0; i < 7; i++) { const X = 1 + i * 2; p(X, 14, 2, 2, R5.rock[i & 1 ? 2 : 1]); q(X, 14, R5.rock[0]); q(X + 1, 15, R5.rock[3]); }
      p(3, 11, 10, 2, Tm[2]); p(3, 11, 10, 1, Tm[1]); p(5, 12, 6, 2, Tm[3]); q(3, 11, '#e8c890'); q(12, 11, '#e8c890'); p(6, 13, 4, 1, '#3a2018'); break;
    case 'woodwall': // sharpened log palisade
      for (let i = 0; i < 4; i++) { const X = i * 4; p(X, 3, 4, 15, Tm[2]); p(X, 3, 1, 15, Tm[0]); p(X + 1, 3, 1, 15, Tm[1]); p(X + 3, 3, 1, 15, Tm[4]); p(X + 1, 1, 2, 2, Tm[1]); q(X + 1, 0, Tm[0]); q(X + 2, 2, Tm[3]); }
      p(0, 7, 16, 2, '#8a7050'); p(0, 7, 16, 1, '#c8a878'); p(0, 13, 16, 2, '#8a7050'); p(0, 13, 16, 1, '#c8a878'); dith(0, 15, 16, 3, Tm[4]); break;
    case 'deadz': { const s = '#7a8a6a';
      p(1, 13, 14, 4, '#5a3030'); dith(0, 15, 16, 3, '#6a1414'); p(2, 12, 5, 4, s); p(2, 12, 5, 1, shade(s, 24)); p(8, 12, 6, 4, '#6a5a4a'); p(8, 12, 6, 1, '#8a7a6a'); q(3, 13, '#2a0808'); q(5, 13, '#2a0808'); p(13, 13, 3, 2, s); p(10, 14, 2, 1, '#8a1414'); break; }
  }
  if (PROP_DONE[k]) { PROP[key] = cutout(c); return PROP[key]; }
  x.clearRect(0, 0, 16, 18); return (PROP[key] = propOld(k, open));
}
const PROP_DONE = { barrel: 1, chest: 1, crate: 1, seedbox: 1, shelf: 1, cabinet: 1, dresser: 1, bunk: 1, bed: 1, workbench: 1, campfire: 1, woodwall: 1, deadz: 1 };
function propOld(k, open) {
  const [c, x] = mk(16, 18), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col);
  switch (k) {
    case 'fridge':
      p(2, 0, 12, 18, '#c8ccd2'); p(2, 0, 3, 18, '#a8acb4'); p(2, 0, 12, 1, '#e8ecf0');
      p(2, 8, 12, 1, '#7a8088'); p(12, 2, 1, 4, '#5a6068'); p(12, 10, 1, 5, '#5a6068');
      p(3, 1, 9, 6, '#b8bcc4'); p(3, 9, 9, 8, '#b0b4bc');
      if (open) { p(5, 1, 8, 6, '#1a1e24'); p(6, 2, 3, 2, '#ffe8a0'); p(6, 5, 2, 1, '#e8e0d0'); }
      else { p(4, 3, 2, 1, '#8a9098'); p(4, 11, 2, 1, '#8a9098'); }
      break;
    case 'cabinet': case 'dresser':
      p(1, 4, 14, 14, PAL.wood[1]); p(1, 4, 14, 2, PAL.wood[0]); p(1, 4, 1, 14, PAL.wood[2]); p(14, 4, 1, 14, PAL.wood[3]);
      p(1, 10, 14, 1, PAL.wood[3]); p(7, 7, 2, 1, '#c8a050'); p(7, 14, 2, 1, '#c8a050');
      if (k === 'dresser') { p(1, 7, 14, 1, PAL.wood[3]); p(1, 13, 14, 1, PAL.wood[3]); p(7, 11, 2, 1, '#c8a050'); }
      p(2, 5, 12, 1, shade(PAL.wood[0], 20));
      if (open) p(2, 11, 12, 5, '#2a1a10');
      break;
    case 'desk':
      p(0, 8, 16, 4, PAL.wood[1]); p(0, 8, 16, 1, PAL.wood[0]); p(1, 12, 2, 6, PAL.wood[3]); p(13, 12, 2, 6, PAL.wood[3]);
      p(0, 8, 1, 4, PAL.wood[2]); p(15, 8, 1, 4, PAL.wood[3]);
      p(4, 1, 8, 7, '#2a2a34'); p(5, 2, 6, 5, open ? '#1a1a20' : '#4a8ab0');
      p(5, 2, 2, 1, '#8ab8d0'); p(9, 2, 1, 5, '#2a3a48');
      break;
    case 'shelf':
      p(0, 1, 16, 17, '#6a7078'); p(1, 2, 14, 15, '#3a3e48');
      for (let i = 0; i < 3; i++) {
        p(1, 5 + i * 5, 14, 1, '#8a909a'); p(1, 5 + i * 5, 14, 1, shade('#8a909a', 20));
        if (!open) {
          p(2, 2 + i * 5, 3, 3, ['#a83828', '#b89830', '#3a7ab0'][i]);
          p(6, 3 + i * 5, 3, 2, ['#4a8860', '#c86820', '#d0d0d0'][i]);
          p(11, 2 + i * 5, 3, 3, ['#a83868', '#6a4a28', '#485868'][i]);
          p(2, 2 + i * 5, 1, 1, 'rgba(255,255,255,.3)');
        }
      }
      break;
    case 'register':
      p(0, 9, 16, 9, PAL.wood[2]); p(0, 9, 16, 2, PAL.wood[0]); p(0, 9, 1, 9, PAL.wood[3]);
      p(3, 3, 10, 6, '#3a3a44'); p(4, 4, 8, 3, '#78c070'); p(4, 4, 3, 1, '#a8e8a0');
      p(12, 5, 2, 2, '#2a2a30'); if (open) p(4, 8, 8, 2, '#1a1a1a');
      break;
    case 'medcab':
      p(1, 2, 14, 14, '#e0e0e4'); p(1, 2, 3, 14, '#c0c0c8'); p(1, 2, 14, 1, '#f0f0f4');
      p(7, 4, 2, 8, '#c82828'); p(3, 7, 10, 3, '#c82828'); p(7, 4, 2, 1, '#e85050');
      if (open) { p(2, 3, 12, 12, '#a0a8b0'); p(4, 5, 3, 2, '#e8e8e8'); p(9, 8, 3, 4, '#d0d8e0'); }
      break;
    case 'rack':
      p(1, 1, 14, 1, '#6a7078'); p(1, 1, 1, 17, '#6a7078'); p(14, 1, 1, 17, '#6a7078');
      p(1, 8, 14, 1, '#5a6068');
      if (!open) for (let i = 0; i < 4; i++) {
        const cols = ['#3a4a98', '#a83848', '#d0c8b0', '#2a6840'];
        p(2 + i * 3, 2, 3, 9, cols[i]); p(2 + i * 3, 2, 3, 1, shade(cols[i], 30)); p(2 + i * 3, 10, 3, 1, shade(cols[i], -30));
      }
      break;
    case 'locker':
      p(2, 0, 12, 18, '#4a5a6a'); p(2, 0, 2, 18, '#3a4a58'); p(2, 0, 12, 1, '#6a7a8a');
      p(8, 0, 1, 18, '#2a3440'); for (let i = 0; i < 4; i++) p(4, 2 + i * 2, 3, 1, '#2a3440');
      p(12, 8, 1, 2, '#c8a050'); if (open) p(9, 1, 4, 16, '#12161c');
      break;
    case 'gunsafe': case 'safe':
      p(1, 2, 14, 16, '#2a2e38'); p(1, 2, 14, 2, '#4a505c'); p(1, 2, 14, 1, '#6a707c');
      p(3, 5, 10, 11, '#1a1e26'); p(7, 8, 3, 3, '#a8a8b0'); p(8, 9, 1, 1, '#2a2e38');
      p(4, 4, 2, 1, '#6a7078'); if (open) p(2, 5, 12, 12, '#0a0a0e');
      break;
    case 'toolbox':
      p(1, 9, 14, 8, '#b82820'); p(1, 9, 14, 2, '#d84838'); p(1, 9, 14, 1, '#e86850');
      p(4, 5, 8, 4, '#1a1a1a'); p(5, 6, 6, 2, '#b82820'); p(6, 6, 4, 1, '#d84838');
      if (open) p(2, 10, 12, 3, '#3a3a3a');
      break;
    case 'crate': case 'seedbox': case 'orecart':
      if (k === 'orecart') {
        p(1, 7, 14, 8, '#5a4a3a'); p(1, 7, 14, 1, '#7a6a5a'); p(2, 15, 3, 3, INK); p(11, 15, 3, 3, INK);
        p(2, 15, 3, 1, '#4a4a50'); p(11, 15, 3, 1, '#4a4a50');
        if (!open) { p(3, 3, 4, 4, '#7a7068'); p(7, 2, 5, 5, '#908880'); p(9, 4, 2, 2, '#c8a040'); }
        break;
      }
      p(1, 3, 14, 14, PAL.wood[1]); p(1, 3, 14, 1, PAL.wood[0]); p(1, 3, 1, 14, PAL.wood[2]); p(14, 3, 1, 14, PAL.wood[2]);
      p(1, 16, 14, 1, PAL.wood[3]);
      for (let i = 0; i < 11; i++) { p(2 + i, 4 + i, 1, 1, PAL.wood[3]); p(13 - i, 4 + i, 1, 1, PAL.wood[3]); }
      p(2, 4, 12, 1, shade(PAL.wood[0], 15));
      if (k === 'seedbox') { p(4, 8, 8, 5, '#d8d0b8'); p(7, 9, 2, 2, '#4a8860'); p(5, 10, 1, 1, '#6a5030'); }
      if (open) p(2, 4, 12, 5, '#2a1a10');
      break;
    case 'gascan':
      p(3, 5, 10, 12, '#b82020'); p(3, 5, 10, 2, '#d84038'); p(3, 5, 10, 1, '#e85848');
      p(10, 1, 3, 4, '#1a1a1a'); p(5, 2, 5, 3, '#b82020'); p(6, 8, 4, 2, '#1a1a1a');
      break;
    case 'pump':
      p(3, 1, 10, 17, '#d0d0d0'); p(3, 1, 10, 3, '#b82020'); p(3, 1, 10, 1, '#d84038');
      p(5, 5, 6, 4, '#1a1a28'); p(6, 6, 4, 2, open ? '#3a3a3a' : '#78c070');
      p(12, 7, 3, 7, '#1a1a1a'); p(13, 8, 1, 5, '#3a3a42'); p(4, 14, 8, 1, '#8a8a90');
      break;
    case 'mine':
      p(0, 4, 16, 14, PAL.rock[2]); p(2, 6, 12, 12, '#100a0c'); p(3, 8, 10, 8, '#080508');
      p(1, 5, 14, 2, PAL.wood[2]); p(1, 5, 2, 13, PAL.wood[2]); p(13, 5, 2, 13, PAL.wood[2]);
      p(5, 6, 2, 1, '#c8a050');
      break;
    case 'trader':
      p(0, 10, 16, 8, PAL.wood[1]); p(0, 10, 16, 2, PAL.wood[0]); p(0, 10, 1, 8, PAL.wood[3]);
      p(2, 6, 4, 4, '#c8a030'); p(10, 5, 4, 5, '#4a8860'); p(3, 7, 2, 1, shade('#c8a030', 40));
      break;
    case 'woodwall':
      p(0, 0, 16, 18, PAL.wood[2]); for (let i = 0; i < 4; i++) { p(i * 4, 0, 3, 18, PAL.wood[1]); p(i * 4, 0, 1, 18, PAL.wood[0]); p(i * 4 + 2, 0, 1, 18, PAL.wood[3]); }
      p(0, 4, 16, 2, PAL.wood[3]); p(0, 12, 16, 2, PAL.wood[3]); p(2, 4, 1, 1, '#a8a8a8'); p(11, 12, 1, 1, '#a8a8a8');
      break;
    case 'metalwall':
      p(0, 0, 16, 18, PAL.metal[1]); p(0, 0, 16, 2, PAL.metal[0]); p(0, 8, 16, 1, PAL.metal[3]);
      p(4, 0, 1, 18, PAL.metal[2]); p(11, 0, 1, 18, PAL.metal[2]); p(2, 3, 1, 1, '#4a4a4a'); p(13, 11, 1, 1, '#4a4a4a');
      p(6, 12, 4, 4, '#a86830'); p(7, 13, 2, 2, '#c88840');
      break;
    case 'gate':
      p(0, 2, 2, 16, PAL.wood[3]); p(14, 2, 2, 16, PAL.wood[3]);
      p(2, 4, 12, 2, PAL.wood[1]); p(2, 11, 12, 2, PAL.wood[1]);
      for (let i = 0; i < 10; i++) p(2 + i, 4 + ((i * 7) / 10 | 0), 1, 2, PAL.wood[2]);
      p(7, 7, 2, 2, '#c8a050');
      break;
    case 'spikes':
      p(1, 12, 14, 5, PAL.wood[2]); p(1, 12, 14, 1, PAL.wood[0]);
      for (let i = 0; i < 5; i++) { p(2 + i * 3, 5, 1, 7, '#b0b0b8'); p(2 + i * 3, 4, 1, 1, '#e8e8f0'); p(3 + i * 3, 7, 1, 5, '#707078'); }
      break;
    case 'beartrap':
      p(1, 10, 14, 6, '#4a4a52'); p(2, 11, 12, 4, '#1a1a20');
      for (let i = 0; i < 6; i++) { p(2 + i * 2, 8, 1, 3, '#b0b0b8'); p(3 + i * 2, 14, 1, 3, '#b0b0b8'); }
      p(7, 12, 2, 1, '#a86830');
      break;
    case 'wire':
      for (let i = 0; i < 3; i++) { p(0, 5 + i * 4, 16, 1, '#707078'); for (let j = 0; j < 5; j++) p(1 + j * 3 + (i & 1) * 2, 4 + i * 4, 1, 3, '#b0b0b8'); }
      p(0, 3, 1, 14, PAL.wood[3]); p(15, 3, 1, 14, PAL.wood[3]);
      break;
    case 'turret':
      p(2, 10, 12, 8, PAL.metal[2]); p(2, 10, 12, 2, PAL.metal[0]); p(4, 4, 8, 6, '#2a2e38');
      p(10, 5, 6, 2, '#1a1a1a'); p(5, 5, 2, 1, '#b82020'); p(6, 6, 4, 2, '#3a3e48');
      break;
    case 'campfire':
      p(1, 13, 14, 4, PAL.wood[3]); p(2, 12, 5, 2, PAL.wood[1]); p(9, 12, 5, 2, PAL.wood[1]);
      for (let i = 0; i < 6; i++) p(2 + i * 2 + (i & 1), 14, 2, 2, '#5a5048');
      p(6, 11, 4, 2, '#3a3028');
      break;
    case 'chest':
      p(1, 5, 14, 12, PAL.wood[1]); p(1, 5, 14, 3, PAL.wood[0]); p(1, 9, 14, 1, PAL.wood[3]);
      p(7, 9, 2, 3, '#c8a050'); p(1, 5, 1, 12, PAL.wood[3]); p(14, 5, 1, 12, PAL.wood[3]);
      p(2, 6, 12, 1, shade(PAL.wood[0], 25)); p(6, 10, 4, 1, '#a88840');
      break;
    case 'bunk': case 'bed':
      p(0, 3, 16, 14, k === 'bed' ? '#3a5a38' : PAL.wood[2]);
      p(1, 4, 14, 12, k === 'bed' ? '#5a7a48' : '#b8a890');
      p(1, 4, 6, 5, '#e0d8c8'); p(1, 4, 6, 1, '#f0e8dc');
      p(1, 10, 14, 6, k === 'bed' ? '#3a5a30' : '#6a4040');
      p(0, 3, 16, 1, k === 'bed' ? '#2a4a28' : PAL.wood[0]);
      break;
    case 'barrel':
      p(2, 2, 12, 16, '#3a5a78'); p(2, 2, 12, 2, '#5a7a98'); p(2, 2, 12, 1, '#7a9ab0');
      p(2, 8, 12, 1, '#1a2a38'); p(2, 13, 12, 1, '#1a2a38'); p(4, 3, 8, 1, '#6ab0c8');
      p(3, 4, 1, 12, shade('#3a5a78', 20)); p(13, 4, 1, 12, shade('#3a5a78', -25));
      break;
    case 'sprinkler':
      p(6, 10, 4, 7, PAL.metal[2]); p(3, 14, 10, 2, PAL.metal[3]); p(7, 6, 2, 4, PAL.metal[0]);
      p(4, 6, 8, 1, '#6ab0c8'); p(5, 5, 1, 1, '#8ad0e8'); p(10, 5, 1, 1, '#8ad0e8');
      break;
    case 'workbench':
      p(0, 8, 16, 9, PAL.wood[2]); p(0, 8, 16, 2, PAL.wood[0]); p(1, 4, 14, 4, PAL.wood[1]);
      p(2, 5, 3, 2, '#5a6068'); p(6, 5, 4, 2, '#8a909a'); p(11, 5, 3, 2, '#3a4048');
      p(1, 17, 2, 2, PAL.wood[3]); p(13, 17, 2, 2, PAL.wood[3]);
      break;
    case 'anvil':
      p(2, 10, 12, 7, '#3a3e48'); p(3, 6, 10, 4, '#5a6068'); p(4, 4, 8, 2, '#8a909a');
      p(1, 14, 14, 3, '#2a2e38'); p(5, 7, 2, 1, '#c8a050');
      break;
    case 'forge':
      p(1, 8, 14, 10, '#3a2a28'); p(2, 4, 12, 4, '#5a3a30'); p(4, 2, 8, 2, '#2a1a18');
      p(5, 5, 6, 5, '#ff6a2a'); p(6, 6, 4, 3, '#ffd76a'); p(3, 12, 10, 2, '#1a1010');
      break;
    case 'deadz':
      p(0, 12, 16, 5, '#4a6840'); p(1, 13, 5, 3, '#5a7850'); p(10, 13, 5, 3, '#3a2a22');
      p(7, 14, 3, 1, '#5a1010'); p(3, 12, 2, 1, '#3a1818'); p(12, 15, 2, 1, '#2a1010');
      break;
  }
  return cutout(c);
}
// ---- vehicles (8 headings, top-down), item icons (10x10)
const VEH = {};
function vehImg(type, col, dir) {
  const key = type + col + dir; if (VEH[key]) return VEH[key];
  const CC = ['#a83828', '#2a5a98', '#c8c0a8', '#2a2a32', '#3a8860'][col % 5]; let w = 28, h = 14; if (type === 'moto') { w = 18; h = 8; } if (type === 'bike') { w = 16; h = 8; }
  const [c, x] = mk(w, h), p = (X, Y, ww, hh, cc) => P(x, X, Y, ww, hh, cc);
  if (type === 'car') {
    p(1, 2, 26, 10, CC); p(1, 2, 26, 2, shade(CC, 35)); p(1, 10, 26, 2, shade(CC, -40));
    p(1, 2, 1, 10, shade(CC, 20)); p(26, 2, 1, 10, shade(CC, -25));
    p(8, 3, 11, 8, '#1a2430'); p(9, 4, 4, 6, '#4a88a8'); p(14, 4, 4, 6, '#3a7090');
    p(9, 4, 4, 1, '#7ab0c8'); p(18, 5, 1, 4, '#1a2838');
    p(24, 3, 3, 2, '#fff0a0'); p(24, 9, 3, 2, '#fff0a0'); p(24, 3, 1, 2, '#ffffff');
    p(1, 3, 2, 2, '#c82820'); p(1, 9, 2, 2, '#c82820');
    p(3, 0, 5, 2, INK); p(18, 0, 5, 2, INK); p(3, 12, 5, 2, INK); p(18, 12, 5, 2, INK);
    p(4, 1, 3, 1, '#3a3a42'); p(19, 1, 3, 1, '#3a3a42');
    p(12, 11, 4, 1, shade(CC, -50)); // under shadow
  } else if (type === 'moto') {
    p(1, 3, 16, 3, '#1a1a1a'); p(4, 2, 9, 4, CC); p(4, 2, 9, 1, shade(CC, 30));
    p(0, 2, 4, 4, INK); p(14, 2, 4, 4, INK); p(1, 3, 2, 2, '#4a4a52'); p(15, 3, 2, 2, '#4a4a52');
    p(13, 0, 1, 8, '#707078'); p(6, 1, 4, 1, shade(CC, -20)); p(8, 5, 2, 1, '#c8a050');
  } else {
    p(0, 2, 5, 4, INK); p(11, 2, 5, 4, INK); p(1, 3, 3, 2, '#606068'); p(12, 3, 3, 2, '#606068');
    p(3, 3, 10, 2, CC); p(3, 3, 10, 1, shade(CC, 30)); p(7, 1, 3, 2, '#2a2a2a');
    p(11, 0, 1, 8, '#707078'); p(5, 2, 2, 1, '#1a1a1a'); p(9, 5, 1, 1, '#c8a050');
  }
  const base = cutout(c, false), D = Math.max(base.width, base.height) + 2, [r, rx] = mk(D, D);
  rx.translate(D / 2, D / 2); rx.rotate(dir * Math.PI / 4); rx.drawImage(base, -base.width / 2, -base.height / 2); VEH[key] = r; return r;
}
const ICO = {};
function iconImg(id) {
  if (ICO[id]) return ICO[id]; const d = IT[id], [c, x] = mk(10, 10), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col), C = d.col || '#c8c8c8';
  switch (d.ic) {
    case 'can': p(2, 1, 6, 8, '#c8ccd2'); p(2, 3, 6, 4, C); p(2, 1, 6, 1, '#e8ecf0'); break;
    case 'bag': p(2, 1, 6, 8, C); p(2, 1, 6, 1, shade(C, 40)); p(3, 4, 4, 2, '#fff8e0'); break;
    case 'bar': p(1, 3, 8, 4, C); p(1, 3, 8, 1, shade(C, 40)); p(3, 4, 3, 2, '#fff8e0'); break;
    case 'bottle': p(3, 3, 4, 6, C); p(4, 1, 2, 2, C); p(4, 0, 2, 1, '#3a6ac8'); p(3, 5, 4, 2, '#e8f8ff'); break;
    case 'fruit': p(2, 3, 6, 6, C); p(1, 4, 8, 4, C); p(3, 3, 2, 2, shade(C, 50)); p(5, 1, 1, 2, '#5a3a22'); p(6, 1, 2, 1, '#5ab870'); break;
    case 'veg': p(3, 3, 4, 6, C); p(2, 4, 6, 3, C); p(3, 3, 1, 2, shade(C, 40)); p(4, 0, 1, 3, '#5ab870'); p(5, 1, 2, 2, '#5ab870'); break;
    case 'fish': p(1, 3, 7, 4, C); p(7, 2, 2, 6, C); p(2, 4, 1, 1, INK); p(1, 3, 7, 1, shade(C, 40)); break;
    case 'seed': p(2, 1, 6, 8, '#e8dcb8'); p(2, 1, 6, 1, '#c8b890'); p(3, 3, 4, 4, C); p(4, 4, 2, 2, '#5ab870'); break;
    case 'hoe': p(5, 1, 1, 8, PAL.wood[2]); p(2, 1, 4, 2, '#a8aeb8'); break;
    case 'wcan': p(2, 4, 5, 5, '#6a9ac8'); p(2, 4, 5, 1, '#8abae8'); p(7, 3, 2, 2, '#6a9ac8'); p(8, 2, 1, 1, '#6a9ac8'); p(3, 2, 3, 1, '#4a7aa8'); break;
    case 'hammer': p(5, 3, 1, 6, PAL.wood[2]); p(2, 1, 6, 3, '#8a909a'); break;
    case 'rod': for (let i = 0; i < 8; i++) p(1 + i, 8 - i, 1, 1, PAL.wood[1]); p(9, 1, 1, 7, '#e8e8e8'); break;
    case 'axe': p(5, 1, 1, 8, PAL.wood[2]); p(2, 1, 3, 4, '#a8aeb8'); p(1, 2, 1, 2, '#e8e8f0'); break;
    case 'crowbar': for (let i = 0; i < 7; i++) p(2 + i, 8 - i, 1, 1, '#c84a3a'); p(8, 1, 1, 2, '#c84a3a'); break;
    case 'knife': p(1, 6, 3, 2, INK); for (let i = 0; i < 5; i++) p(4 + i, 6 - i, 1, 1, '#d8dce0'); break;
    case 'bat': for (let i = 0; i < 8; i++) p(1 + i, 8 - i, i > 4 ? 2 : 1, i > 4 ? 2 : 1, PAL.wood[0]); break;
    case 'pipe': for (let i = 0; i < 8; i++) p(1 + i, 8 - i, 1, 1, '#8a909a'); p(8, 0, 2, 2, '#6a7078'); break;
    case 'machete': p(1, 7, 3, 2, INK); for (let i = 0; i < 6; i++) p(3 + i, 7 - i, 2, 1, '#d8dce0'); break;
    case 'pistol': p(1, 2, 7, 3, '#3a3a42'); p(1, 2, 7, 1, '#6a6a72'); p(2, 5, 3, 4, '#5a3a2a'); break;
    case 'shotgun': p(0, 3, 10, 2, '#3a3a42'); p(0, 5, 4, 3, PAL.wood[2]); p(5, 5, 2, 1, '#3a3a42'); break;
    case 'rifle': p(0, 3, 10, 1, '#3a3a42'); p(0, 4, 5, 3, PAL.wood[1]); p(4, 2, 3, 1, '#3a3a42'); break;
    case 'ammo': p(1, 4, 8, 5, '#5a5a40'); p(2, 1, 2, 3, C); p(5, 1, 2, 3, C); p(2, 1, 2, 1, '#f8e8a0'); p(5, 1, 2, 1, '#f8e8a0'); break;
    case 'shoe': p(1, 5, 5, 4, C); p(1, 7, 8, 2, C); p(1, 9, 8, 1, '#2a2a2a'); p(2, 5, 3, 1, shade(C, 40)); break;
    case 'shirt': p(2, 2, 6, 7, C); p(0, 2, 2, 4, C); p(8, 2, 2, 4, C); p(4, 2, 2, 1, shade(C, -40)); break;
    case 'pack': p(2, 2, 6, 7, C); p(3, 1, 4, 1, C); p(3, 5, 4, 3, shade(C, -30)); p(2, 2, 6, 1, shade(C, 40)); break;
    case 'plank': p(0, 3, 10, 3, PAL.wood[1]); p(0, 6, 10, 2, PAL.wood[2]); p(0, 3, 10, 1, PAL.wood[0]); break;
    case 'scrap': p(1, 4, 5, 4, '#a8aeb8'); p(4, 2, 5, 4, '#8a909a'); p(5, 6, 3, 3, '#c87a3a'); break;
    case 'nails': for (let i = 0; i < 4; i++) { p(2 + i * 2, 2 + (i & 1), 1, 6, '#c8ccd2'); p(1 + i * 2, 2 + (i & 1), 3, 1, '#8a909a'); } break;
    case 'rope': p(2, 2, 6, 6, '#c8a868'); p(4, 4, 2, 2, '#7a5a30'); p(2, 2, 6, 1, '#e8c888'); break;
    case 'cloth': p(1, 3, 8, 5, '#e8e0d0'); p(1, 5, 8, 1, '#c8c0b0'); break;
    case 'elec': p(1, 2, 8, 6, C === '#c8c8c8' ? '#3a8a5a' : C); p(2, 3, 2, 2, '#e8c040'); p(6, 4, 2, 2, '#c8c8d0'); p(1, 8, 1, 1, '#c8c8d0'); p(8, 8, 1, 1, '#c8c8d0'); break;
    case 'battery': p(2, 2, 3, 7, '#3a3a42'); p(5, 2, 3, 7, '#3a3a42'); p(2, 2, 3, 2, '#e8c040'); p(5, 2, 3, 2, '#e8c040'); break;
    case 'med': p(1, 2, 8, 7, d.col || '#f0f0f0'); p(4, 3, 2, 5, d.col ? '#ffffff' : '#e83a3a'); p(2, 4, 6, 2, d.col ? '#ffffff' : '#e83a3a'); break;
    case 'pills': p(3, 2, 4, 7, '#f0a040'); p(3, 2, 4, 2, '#ffffff'); break;
    case 'gem': p(3, 2, 4, 2, C); p(2, 4, 6, 2, C); p(3, 6, 4, 1, C); p(4, 7, 2, 1, C); p(3, 2, 1, 1, '#ffffff'); break;
    case 'book': p(2, 1, 6, 8, C); p(2, 1, 1, 8, shade(C, -40)); p(4, 3, 3, 2, '#fff8e0'); break;
    case 'gascan': p(2, 3, 6, 6, '#d82a2a'); p(2, 3, 6, 1, '#f04a4a'); p(6, 1, 2, 2, '#2a2a2a'); break;
    case 'bed': p(0, 3, 10, 5, '#5a7a4a'); p(0, 3, 3, 5, '#e8e0d0'); p(0, 7, 10, 1, '#3a5a2a'); break;
    default: p(2, 2, 6, 6, C);
  }
  ICO[id] = cutout(c, false); return ICO[id];
}
// ================================================================ run state, entities, movement, noise, zombies, combat, vehicles
let G = null, PL = null, ZOMS = [], FX = [], NOISE = [];
const VEHS = new Map(), NPCS = new Map(), BUILD = new Map(), ACTIVE = new Set();
const BDEF = {
  woodwall: { n: 'WOOD WALL', cost: { plank: 2, nails: 4 }, hp: 60, zs: 1, ps: 1, d: 'BLOCKS ZOMBIES. 60 HP' },
  metalwall: { n: 'METAL WALL', cost: { scrap: 3, nails: 6 }, hp: 160, zs: 1, ps: 1, d: 'TOUGH WALL. 160 HP' },
  gate: { n: 'GATE', cost: { plank: 3, nails: 6, scrap: 1 }, hp: 80, zs: 1, d: 'YOU PASS, THEY DONT. 80 HP' },
  spikes: { n: 'SPIKE TRAP', cost: { plank: 1, nails: 8 }, hp: 4, trap: 1, d: 'KILLS ON STEP. 4 USES' },
  beartrap: { n: 'BEAR TRAP', cost: { scrap: 2, nails: 2 }, hp: 6, trap: 1, d: 'HOLDS + HURTS. 6 USES' },
  wire: { n: 'BARBED WIRE', cost: { scrap: 1, nails: 10 }, hp: 30, trap: 1, d: 'SLOWS + CUTS' },
  turret: { n: 'PISTOL TURRET', cost: { pistol: 1, scrap: 4, elec: 2 }, hp: 50, zs: 1, ps: 1, d: 'SHOOTS AT NIGHT. LOAD 9MM' },
  campfire: { n: 'CAMPFIRE', cost: { plank: 1 }, hp: 20, ps: 1, zs: 1, d: 'LIGHT + COOKING' },
  chest: { n: 'CHEST', cost: { plank: 3, nails: 6 }, hp: 40, ps: 1, zs: 1, d: 'STORAGE. CAMP FOOD GOES HERE' },
  workbench: { n: 'WORKBENCH', cost: { plank: 4, nails: 8 }, hp: 50, ps: 1, zs: 1, d: 'CRAFT TOOLS, GEAR, AMMO' },
  anvil: { n: 'ANVIL', cost: { scrap: 6, nails: 4 }, hp: 80, ps: 1, zs: 1, d: 'CRAFT WEAPONS + METAL' },
  forge: { n: 'FORGE', cost: { scrap: 8, plank: 2, nails: 6 }, hp: 70, ps: 1, zs: 1, d: 'ADVANCED METALWORK' },
  bunk: { n: 'BUNK', cost: { plank: 4, cloth: 2, nails: 8 }, hp: 30, zs: 1, d: 'A BED FOR ONE RECRUIT' },
  barrel: { n: 'RAIN BARREL', cost: { plank: 2, scrap: 1 }, hp: 30, ps: 1, zs: 1, d: 'FILLS 2 WATERS A DAY. 5 IF RAIN' },
  sprinkler: { n: 'SPRINKLER', cost: { scrap: 2, elec: 1 }, hp: 20, d: 'WATERS 3X3 EVERY MORNING' },
};
const BORDER = ['woodwall', 'metalwall', 'gate', 'spikes', 'beartrap', 'wire', 'turret', 'campfire', 'chest', 'workbench', 'anvil', 'forge', 'bunk', 'barrel', 'sprinkler'];
function newRun(seed) {
  WD = genWorld(seed); CHUNKS.clear(); chunkOrder = []; MOD.clear(); LAYOUTS.clear(); VEHS.clear(); NPCS.clear(); BUILD.clear(); ACTIVE.clear(); ZOMS = []; FX = []; NOISE = [];
  G = { seed, v: VERSION, day: 1, time: 7 * 60, money: 15, base: null, crops: {}, recruits: [], looted: {}, zk: {}, fog: new Uint8Array(NC * NC), npc: {}, gone: {}, rain: false, kills: 0, stock: {}, pumps: {}, seenNames: {}, log: [], playId: null, started: Date.now(), msgs: [], alive: true, wave: null, awake: 0 };
  PL = { x: WD.spawn.x, y: WD.spawn.y, dir: [1, 0], face: 1, fs: 1, hp: 100, sta: 100, hun: 80, thi: 80, str: 1, strXP: 0, inv: newInv(), veh: null, sneak: false, sprint: false, anim: 0, swingT: 0, cd: 0, aim: 0, step: 0, hurtT: 0, moving: false, invuln: 0, _bid: null, flash: 0 };
  addItem(PL.inv, 'water', 1); addItem(PL.inv, 'chips', 1);
  const sp = findWalkableSpawn(PL.x, PL.y); PL.x = sp.x; PL.y = sp.y; WD.spawn = { x: sp.x, y: sp.y };
}
/** True if floor(x,y) sits on any building footprint (walls + interior) — roofs cover these outdoors. */
function onBuildingFootprint(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  const cx0 = ((x / CH) | 0) - 1, cy0 = ((y / CH) | 0) - 1;
  for (let cy = cy0; cy <= cy0 + 2; cy++) for (let cx = cx0; cx <= cx0 + 2; cx++) {
    if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue;
    for (const b of chunk(cx, cy).bl) if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) return true;
  }
  return false;
}
/** Outdoor walkable tile: not solid, not water, not under a roof / inside a building. */
function spawnTileOk(x, y) {
  const t = tileAt(x, y);
  if (SOLID[t] || t === T.WATER || t === T.SEA || t === T.SHAL) return false;
  if (buildingAt(x, y) || onBuildingFootprint(x, y)) return false;
  return freeAt(x + 0.5, y + 0.5, 0.28, 'p');
}
function spawnTileScore(x, y) {
  const t = tileAt(x, y);
  if (t === T.ROAD || t === T.LINE || t === T.SIDE) return 0;
  if (t === T.DIRT || t === T.CONC || t === T.GRAVEL || t === T.BRIDGE) return 1;
  if (t === T.GRASS || t === T.TALL || t === T.SAND || t === T.FIELD || t === T.FLOWER || t === T.TILLED) return 2;
  return 3;
}
/** Spiral-search from (ox,oy) for a walkable outdoor tile. Used by newRun and any restart spawn. */
function findWalkableSpawn(ox, oy) {
  const ix = Math.floor(ox), iy = Math.floor(oy);
  if (spawnTileOk(ix, iy)) return { x: ix + 0.5, y: iy + 0.5 };
  let best = null, bestS = 99;
  for (let r = 1; r < 96; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ix + dx, y = iy + dy;
      if (x < 8 || y < 8 || x >= WS - 8 || y >= WS - 8) continue;
      if (!spawnTileOk(x, y)) continue;
      const s = spawnTileScore(x, y);
      if (s < bestS) { bestS = s; best = { x: x + 0.5, y: y + 0.5 }; if (s === 0) return best; }
    }
    if (best && bestS <= 2) return best;
  }
  return best || { x: ox, y: oy };
}
const season = () => ((G.day - 1) / 7 | 0) % 4; const SEASONS = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
const isNight = () => G.time >= 21 * 60 || G.time < 6 * 60;
function nightK() { const t = G.time / 60; if (t >= 7 && t <= 17.5) return 0; if (t >= 20 || t < 5.5) return 1; if (t > 17.5) return (t - 17.5) / 2.5; return 1 - (t - 5.5) / 1.5; }
function msg(s, col = CREAM) { G.msgs.push({ s, col, t: 3.2 }); if (G.msgs.length > 4) G.msgs.shift(); }
// ---- collision
function buildAt(x, y) { return BUILD.get(tkey(Math.floor(x), Math.floor(y))); }
function solidAt(x, y, who) {
  const t = tileAt(x, y); if (SOLID[t]) return true;
  const b = BUILD.size ? buildAt(x, y) : null; if (b) { const d = BDEF[b.k]; if (who === 'z' ? d.zs : d.ps) return true; }
  return false;
}
function freeAt(x, y, r, who) { return !solidAt(x - r, y - r, who) && !solidAt(x + r, y - r, who) && !solidAt(x - r, y + r, who) && !solidAt(x + r, y + r, who); }
function moveC(e, dx, dy, r, who) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2)); let hit = false;
  for (let i = 0; i < n; i++) { const sx = dx / n, sy = dy / n;
    if (freeAt(e.x + sx, e.y, r, who)) e.x += sx; else hit = true;
    if (freeAt(e.x, e.y + sy, r, who)) e.y += sy; else hit = true; }
  return hit;
}
const BLOCKV = new Uint8Array(32); [T.WALL, T.WALLW, T.WALLC, T.TREE, T.PINE, T.ROCK, T.MINE].forEach((t) => (BLOCKV[t] = 1));
function los(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.4); for (let i = 1; i < n; i++) { const t = i / n; if (BLOCKV[tileAt(ax + (bx - ax) * t, ay + (by - ay) * t)]) return false; } return true; }
// ---- noise: every sound the player makes is a circle zombies can hear (shown on the HUD meter)
function noise(x, y, r, src) { NOISE.push({ x, y, r, t: 0.6 }); if (src !== 'step') PL.noiseMax = Math.max(PL.noiseMax || 0, r);
  for (const z of ZOMS) { if (z.dead || z.st === 'chase' || z.st === 'lunge') continue; const d = Math.hypot(z.x - x, z.y - y); if (d < r) { z.st = 'alert'; z.tx = x + (Math.random() - 0.5) * 2; z.ty = y + (Math.random() - 0.5) * 2; z.t = 8 + Math.random() * 4; } } }
// ---- player stats derived from gear
function capKg() { const b = PL.inv.wear.back; return 6 + 3 * PL.str + (b ? IT[b.id].kg : 0); }
function loadK() { const w = invWeight(PL.inv), c = capKg(); return w <= c ? 1 : Math.max(0.35, 1 - (w - c) / c * 1.3); }
function held() { return PL.inv.hands[0] || PL.inv.hands[1]; }
// ---- the chunk hook: vehicles, survivors, roadside wrecks
function onChunkNew(c) {
  const x0 = c.cx * CH, y0 = c.cy * CH, inC = (o) => o.x >= x0 && o.y >= y0 && o.x < x0 + CH && o.y < y0 + CH;
  for (const S of WD.sets) { if (S.bb[0] > x0 + CH || S.bb[2] < x0 || S.bb[1] > y0 + CH || S.bb[3] < y0) continue; const L = layoutOf(S);
    for (const v of L.vehs) if (inC(v) && !VEHS.has(v.id) && !G.gone[v.id]) VEHS.set(v.id, Object.assign({ trunk: null }, v));
    for (const n of L.npcs) if (inC(n) && !G.npc[n.id] && !NPCS.has(n.id)) { const R = rng(hashS(n.id) ^ WD.seed); NPCS.set(n.id, { id: n.id, x: n.x, y: n.y, hx: n.x, hy: n.y, name: SURV_NAMES[(R() * SURV_NAMES.length) | 0], look: survivorLook(hashS(n.id)), want: 1 + ((R() * 3) | 0), face: 1, fs: 1, t: 0 }); } }
  const h = hash2(c.cx, c.cy, WD.seed + 99);
  if (h < 0.22) { const id = 'w' + c.cx + ':' + c.cy; if (!VEHS.has(id) && !G.gone[id]) { const R = rng(hashS(id));
    for (let k = 0; k < 40; k++) { const i = (R() * CH) | 0, j = (R() * CH) | 0, t = c.t[j * CH + i]; if (t === T.ROAD || t === T.LINE) { VEHS.set(id, { id, x: x0 + i + 0.5, y: y0 + j + 0.5, ang: ((R() * 8) | 0) * Math.PI / 4, type: R() < 0.85 ? 'car' : 'moto', ok: R() < 0.22, fuel: R() < 0.5 ? 0 : 1 + ((R() * 9) | 0), col: (R() * 5) | 0, trunk: null }); break; } } } }
}
// ---- zombie population per chunk (kills persist and regrow a little each day)
const DENS = new Map();
function chunkDensity(cx, cy) { const k = cy * NC + cx; if (DENS.has(k)) return DENS.get(k); const x = cx * CH + 16, y = cy * CH + 16; let d = WD.elev(x, y) > 0.5 ? 0.15 : 0.35;
  for (const S of WD.sets) { const r = Math.hypot(S.x - x, S.y - y); if (r > S.r + 20) continue; d = Math.max(d, { city: 6, town: 3.2, factory: 4, farm: 1.2, gas: 1.2, mine: 1.5, cabin: 0.6 }[S.kind]); }
  DENS.set(k, d); return d; }
function spawnZ(x, y, kind, seed, hk) { const r = rng(seed); const z = { x, y, hp: kind === 'fat' ? 6 : 3, kind, st: 'wander', tx: x, ty: y, t: r() * 3, look: zombieLook(seed), hk, face: r() < 0.5 ? 1 : -1, fs: 1, anim: r() * 9, lT: 0, stun: 0, id: seed, atkT: 0 };
  z.fs = z.face; ZOMS.push(z); return z; }
function zKind(R) { const r = R(), d = G.day; return r < Math.min(0.18, 0.03 + d * 0.01) ? 'runner' : r < 0.12 + Math.min(0.1, d * 0.006) ? 'fat' : 'walker'; }
function updateActive() {
  const pcx = (PL.x / CH) | 0, pcy = (PL.y / CH) | 0, mult = Math.min(1.7, 0.7 + G.day * 0.06);
  for (const k of [...ACTIVE]) { const cx = k % NC, cy = (k / NC) | 0; if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) > 3) { ACTIVE.delete(k); ZOMS = ZOMS.filter((z) => z.hk !== k || z.st === 'chase'); } }
  for (let cy = pcy - 2; cy <= pcy + 2; cy++) for (let cx = pcx - 2; cx <= pcx + 2; cx++) { if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue; const k = cy * NC + cx; if (ACTIVE.has(k)) continue; ACTIVE.add(k);
    const R = rng(hash2(cx, cy, WD.seed + G.day * 7)); let n = chunkDensity(cx, cy) * mult; n = Math.floor(n) + (R() < n % 1 ? 1 : 0); n = Math.max(0, n - (G.zk[k] || 0));
    const c = chunk(cx, cy);
    for (let i = 0; i < n && ZOMS.length < 90; i++) for (let a = 0; a < 12; a++) { const x = cx * CH + R() * CH, y = cy * CH + R() * CH; if (solidAt(x, y, 'z') || tileAt(x, y) === T.SHAL) continue;
      if (Math.hypot(x - PL.x, y - PL.y) < 11) continue; if (G.base && Math.hypot(x - G.base.x, y - G.base.y) < 22) continue; spawnZ(x, y, zKind(R), (R() * 1e9) | 0, k); break; }
    void c; }
}
// ---- flow fields (zombies route around walls and through doors; built walls get attacked)
function flowField(tx, ty, R) {
  const W = R * 2 + 1, x0 = Math.floor(tx) - R, y0 = Math.floor(ty) - R, d = new Float32Array(W * W).fill(1e9), cost = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const x = x0 + i, y = y0 + j, t = tileAt(x, y); let c = SOLID[t] ? 1e9 : t === T.SHAL ? 2 : 1; const b = BUILD.get(tkey(x, y)); if (b && BDEF[b.k].zs) c = 6 + b.hp / 12; cost[j * W + i] = c; }
  const s = (Math.floor(ty) - y0) * W + (Math.floor(tx) - x0); d[s] = 0; const q = [s]; let qi = 0; const inq = new Uint8Array(W * W);
  while (qi < q.length) { const cur = q[qi++]; inq[cur] = 0; const ci = cur % W, cj = (cur / W) | 0, cd = d[cur];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= W) continue; const n = nj * W + ni, c = cost[n]; if (c >= 1e9) continue;
      if (di && dj && (cost[cj * W + ni] >= 1e9 || cost[nj * W + ci] >= 1e9 || cost[cj * W + ni] > 1 || cost[nj * W + ci] > 1)) continue;
      const nd = cd + c * (di && dj ? 1.414 : 1); if (nd < d[n]) { d[n] = nd; if (!inq[n]) { inq[n] = 1; q.push(n); } } } }
  return { x0, y0, W, d, tx, ty };
}
function fieldStep(F, x, y) { const i = Math.floor(x) - F.x0, j = Math.floor(y) - F.y0; if (i < 1 || j < 1 || i >= F.W - 1 || j >= F.W - 1) return null; let best = F.d[j * F.W + i], bi = 0, bj = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const v = F.d[(j + dj) * F.W + i + di]; if (v < best - 0.01) { best = v; bi = di; bj = dj; } }
  if (best >= 1e9) return null; return [F.x0 + i + bi + 0.5, F.y0 + j + bj + 0.5]; }
let CHASEF = null, chaseFT = 0;
// ---- zombie AI: wander, hear, see, chase, lunge (0.35 s wind-up), one bite kills
function playerVisibleTo(z, d) {
  const night = nightK(); let sight = lerp(7.2, 3.6, night);
  // slow walkers are much harder to spot; sneak nearly invisible at range; sprint/vehicles still obvious
  if (PL.sneak) sight *= 0.38; else if (!PL.sprint && !PL.veh) sight *= 0.52;
  if (PL.sprint) sight *= 1.15;
  const t = tileAt(PL.x, PL.y);
  if ((t === T.BUSH || t === T.TALL) && (PL.sneak || !PL.sprint)) sight = Math.min(sight, PL.sneak ? 1.4 : 2.4);
  if (PL.veh) sight *= 1.45; if (G.base && night > 0.5 && nearFire(PL.x, PL.y)) sight = Math.max(sight, 7);
  // indoors: tighter vision cones (gloom)
  if (buildingAt(PL.x, PL.y)) sight *= 0.72;
  return d < sight && los(z.x, z.y, PL.x, PL.y);
}
function nearFire(x, y) { for (const b of BUILD.values()) if (b.k === 'campfire' && Math.hypot(b.x + 0.5 - x, b.y + 0.5 - y) < 5) return true; return false; }
function updateZombies(dt) {
  chaseFT -= dt; const anyChase = ZOMS.some((z) => z.st === 'chase');
  if (anyChase && chaseFT <= 0 && !G.wave) { CHASEF = flowField(PL.x, PL.y, 22); chaseFT = 0.5; }
  const pv = PL.veh ? VEHS.get(PL.veh) : null;
  for (const z of ZOMS) {
    if (z.dead) { z.dt = (z.dt || 0) + dt; continue; }
    z.anim += dt; if (z.stun > 0) { z.stun -= dt; continue; }
    if (z.held > 0) { z.held -= dt; continue; }
    const dx = PL.x - z.x, dy = PL.y - z.y, d = Math.hypot(dx, dy);
    if (G.wave) { waveZombie(z, dt); continue; }
    if (PL.dead) { z.st = 'wander'; }
    let spd = z.kind === 'runner' ? 4.3 : z.kind === 'fat' ? 1.7 : 2.6; if (nightK() > 0.5) spd *= 1.12;
    if (z.st !== 'chase' && z.st !== 'lunge' && !PL.dead && d < 7 && playerVisibleTo(z, d)) { if (z.st !== 'alert' || Math.random() < 0.5) { z.st = 'chase'; z.lost = 0; sfx('groan', z.x, z.y); } }
    if (z.st === 'wander') { z.t -= dt; if (z.t <= 0) { z.t = 2 + Math.random() * 5; const a = Math.random() * 6.283; z.tx = z.x + Math.cos(a) * 4; z.ty = z.y + Math.sin(a) * 4; }
      stepTo(z, z.tx, z.ty, 0.55, dt); if (Math.random() < dt * 0.04) sfx('groan', z.x, z.y); }
    else if (z.st === 'alert') { z.t -= dt; if (stepTo(z, z.tx, z.ty, spd * 0.6, dt) < 0.6 || z.t <= 0) { z.st = 'wander'; z.t = 2; } }
    else if (z.st === 'chase') {
      if (PL.dead) { z.st = 'wander'; continue; }
      if (playerVisibleTo(z, d) || d < 2.2) { z.lost = 0; z.lx = PL.x; z.ly = PL.y; } else { z.lost += dt; if (z.lost > 6) { z.st = 'alert'; z.tx = z.lx; z.ty = z.ly; z.t = 6; continue; } }
      if (d > 26) { z.st = 'wander'; continue; }
      let tgt = null; if (d > 1.6 && CHASEF) tgt = fieldStep(CHASEF, z.x, z.y);
      if (!tgt) tgt = [PL.x, PL.y];
      if (stepTo(z, tgt[0], tgt[1], spd, dt) === -1) attackBuildNear(z, tgt, dt);
      if (pv && pv.type === 'car') { if (d < 1.3) { z.atkT += dt; if (z.atkT > 1.2) { z.atkT = 0; sfx('thud', z.x, z.y); } } }
      else if (d < 1.05) { z.st = 'lunge'; z.lT = 0.35; sfx('lunge', z.x, z.y); }
    } else if (z.st === 'lunge') { z.lT -= dt; if (z.lT <= 0) { if (d < 1.3 && !PL.dead && !(pv && pv.type === 'car')) bite(z); z.st = 'chase'; z.stun = 0.25; } }
    z.face = dx > 0 ? 1 : -1; if (z.st === 'wander' || z.st === 'alert') z.face = z.tx > z.x ? 1 : -1;
    z.fs = lerp(z.fs, z.face, Math.min(1, dt * 9));
  }
  for (let i = ZOMS.length - 1; i >= 0; i--) if (ZOMS[i].dead && ZOMS[i].dt > 12) ZOMS.splice(i, 1);
}
function stepTo(z, tx, ty, spd, dt) {
  const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy); if (d < 0.05) return d;
  let m = spd * dt; const t = tileAt(z.x, z.y); if (t === T.SHAL) m *= 0.6; if (t === T.BUSH || t === T.TALL) m *= 0.85; const b = BUILD.size ? buildAt(z.x, z.y) : null; if (b && b.k === 'wire') m *= 0.3;
  // separation from other zombies
  let sx = 0, sy = 0; for (const o of ZOMS) { if (o === z || o.dead) continue; const ox = z.x - o.x, oy = z.y - o.y, q = ox * ox + oy * oy; if (q < 0.36 && q > 0.0001) { sx += ox / q * 0.02; sy += oy / q * 0.02; } }
  const hit = moveC(z, dx / d * Math.min(m, d) + clamp(sx, -0.1, 0.1), dy / d * Math.min(m, d) + clamp(sy, -0.1, 0.1), 0.28, 'z');
  zTrap(z, dt);
  return hit && d > 0.3 ? -1 : d;
}
function attackBuildNear(z, tgt, dt) {
  const ax = Math.floor(tgt[0]), ay = Math.floor(tgt[1]); let b = BUILD.get(tkey(ax, ay));
  if (!b || !BDEF[b.k].zs) { for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = BUILD.get(tkey(Math.floor(z.x + ox * 0.6), Math.floor(z.y + oy * 0.6))); if (q && BDEF[q.k].zs) { b = q; break; } } }
  if (!b || !BDEF[b.k].zs) return; z.atkT += dt; if (z.atkT > 0.8) { z.atkT = 0; damageBuild(b, z.kind === 'fat' ? 9 : 5); }
}
function damageBuild(b, n) { b.hp -= n; sfx(b.k === 'metalwall' || b.k === 'turret' ? 'clang' : 'thud', b.x + 0.5, b.y + 0.5); puff(b.x + 0.5, b.y + 0.5, b.k === 'metalwall' ? '#a6aeb6' : PAL.wood[1], 3);
  if (b.hp <= 0) { BUILD.delete(tkey(b.x, b.y)); sfx('break', b.x + 0.5, b.y + 0.5); puff(b.x + 0.5, b.y + 0.5, PAL.wood[2], 10); if (G.wave) G.wave.broke++; markFieldDirty(); } }
function markFieldDirty() { if (G.wave) G.wave.fT = 0; }
function zTrap(z, dt) {
  if (!BUILD.size) return; const b = buildAt(z.x, z.y); if (!b || !BDEF[b.k].trap) return;
  if (b.k === 'spikes' && !z.onTrap) { z.onTrap = b; hurtZ(z, 3, 0, 0, 'trap'); b.hp--; sfx('spike', z.x, z.y); if (b.hp <= 0) { BUILD.delete(tkey(b.x, b.y)); msgW('A SPIKE TRAP BROKE'); } }
  else if (b.k === 'beartrap' && !z.onTrap) { z.onTrap = b; z.held = 5; hurtZ(z, 1.5, 0, 0, 'trap'); b.hp--; sfx('snap', z.x, z.y); if (b.hp <= 0) { BUILD.delete(tkey(b.x, b.y)); msgW('A BEAR TRAP BROKE'); } }
  else if (b.k === 'wire') { z.wireT = (z.wireT || 0) + dt; if (z.wireT > 1) { z.wireT = 0; hurtZ(z, 0.6, 0, 0, 'trap'); b.hp -= 2; if (b.hp <= 0) BUILD.delete(tkey(b.x, b.y)); } }
  if (z.onTrap && buildAt(z.x, z.y) !== z.onTrap) z.onTrap = null;
}
function msgW(s) { if (G.wave) G.wave.log.push(s); else msg(s); }
function hurtZ(z, dmg, kx, ky, src) {
  if (z.dead) return; z.hp -= dmg; z.stun = Math.max(z.stun, src === 'trap' ? 0.2 : 0.35); if (z.st === 'lunge') z.st = 'chase';
  if (kx || ky) moveC(z, kx, ky, 0.28, 'z'); blood(z.x, z.y - 0.6, 4);
  if (z.hp <= 0) { z.dead = true; z.dt = 0; G.kills++; if (z.hk >= 0) G.zk[z.hk] = (G.zk[z.hk] || 0) + 1; if (G.wave) G.wave.killed++; sfx('zdie', z.x, z.y); blood(z.x, z.y - 0.4, 10); }
  else if (z.st !== 'chase' && !G.wave) { z.st = 'chase'; z.lost = 0; }
}
function bite(z) { if (PL.dead) return; if ((PL.invuln || 0) > 0) { sfx('thud', PL.x, PL.y); puff(PL.x, PL.y - 0.5, '#8ad0ff', 4); return; } blood(PL.x, PL.y - 0.6, 18); sfx('bite', PL.x, PL.y); die('BITTEN'); }
// ---- player combat
function swing() {
  const h = held(), d = h ? IT[h.id] : null;
  if (d && d.c === 'gun') return shoot(h, d);
  if (PL.cd > 0) return; const dmg = d && d.dmg ? d.dmg : 0.5, rate = d && d.rate ? d.rate : 0.45, reach = d && d.reach ? d.reach : 0.95;
  const st = d && d.two ? 12 : 8; const weak = PL.sta < st; PL.sta = Math.max(0, PL.sta - st); PL.cd = rate * (weak ? 1.8 : 1); PL.swingT = 0.22;
  noise(PL.x, PL.y, d ? d.noise || 5 : 3, 'melee'); sfx(d ? 'swing' : 'punch', PL.x, PL.y); PL.strXP += 0.15;
  let hit = 0; const [fx, fy] = PL.dir;
  for (const z of ZOMS) { if (z.dead) continue; const dx = z.x - PL.x, dy = (z.y - 0.2) - PL.y, dd = Math.hypot(dx, dy); if (dd > reach + 0.35) continue; if (dd > 0.35 && (dx * fx + dy * fy) / dd < 0.25) continue;
    hurtZ(z, dmg * (weak ? 0.6 : 1), dx / (dd || 1) * 0.6, dy / (dd || 1) * 0.6, 'melee'); hit++; if (!d || !d.two) break; }
  if (hit) sfx('hit', PL.x + fx, PL.y + fy);
}
function shoot(h, d) {
  if (PL.cd > 0) return; if (!countItem(PL.inv, d.ammo)) { PL.cd = 0.4; sfx('click', PL.x, PL.y); msg('NO ' + IT[d.ammo].n); return; }
  takeItem(PL.inv, d.ammo, 1); PL.cd = d.rate; PL.swingT = 0.15; noise(PL.x, PL.y, d.noise, 'gun'); sfx(h.id, PL.x, PL.y); PL.flash = 0.06;
  // aim assist: the nearest visible zombie in a 40 degree cone
  let [ax, ay] = PL.dir, best = null, bd = d.range; for (const z of ZOMS) { if (z.dead) continue; const dx = z.x - PL.x, dy = z.y - PL.y, dd = Math.hypot(dx, dy); if (dd > d.range || dd < 0.1) continue; if ((dx * ax + dy * ay) / dd < 0.77) continue; if (dd < bd && los(PL.x, PL.y, z.x, z.y)) { bd = dd; best = z; } }
  if (best) { const dd = Math.hypot(best.x - PL.x, best.y - PL.y); ax = (best.x - PL.x) / dd; ay = (best.y - PL.y) / dd; }
  for (let p = 0; p < (d.pel || 1); p++) { const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 2 * d.spread, cx = Math.cos(a), cy = Math.sin(a); let pierce = d.pierce || 1, end = d.range;
    const hits = []; for (const z of ZOMS) { if (z.dead) continue; const dx = z.x - PL.x, dy = z.y - PL.y, t = dx * cx + dy * cy; if (t < 0 || t > d.range) continue; const off = Math.abs(dx * cy - dy * cx); if (off < 0.42) hits.push([t, z]); }
    hits.sort((a2, b2) => a2[0] - b2[0]); for (const [t, z] of hits) { if (!los(PL.x, PL.y, z.x, z.y)) break; hurtZ(z, d.dmg, cx * 0.4, cy * 0.4, 'gun'); end = t; if (--pierce <= 0) break; }
    FX.push({ k: 'tracer', x: PL.x, y: PL.y - 0.55, x2: PL.x + cx * end, y2: PL.y - 0.55 + cy * end, t: 0.08 }); }
}
// ---- particles
function puff(x, y, col, n) { for (let i = 0; i < n; i++) FX.push({ k: 'p', x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.8) * 3, t: 0.4 + Math.random() * 0.3, col }); }
function blood(x, y, n) { puff(x, y, '#9a1a1a', n); FX.push({ k: 'stain', x: x + (Math.random() - 0.5) * 0.4, y: y + 0.5, t: 40, col: 'rgba(120,20,20,0.45)' }); }
function updateFX(dt) { for (const f of FX) { f.t -= dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 6 * dt; } } FX = FX.filter((f) => f.t > 0); if (FX.length > 400) FX.splice(0, FX.length - 400);
  for (const n of NOISE) n.t -= dt; NOISE = NOISE.filter((n) => n.t > 0); }
// ---- vehicles: d-pad points the way, the vehicle turns toward it. Fuel, noise, trunks.
const VSPEC = { bike: { max: 7, acc: 6, turn: 4.2, tank: 0, use: 0, noise: 2.5, kg: 5, n: 'BICYCLE' }, moto: { max: 12, acc: 9, turn: 3.4, tank: 6, use: 0.008, noise: 25, kg: 15, n: 'MOTORCYCLE' }, car: { max: 14, acc: 7, turn: 2.4, tank: 40, use: 0.02, noise: 30, kg: 60, n: 'CAR' } };
function vehicleNear(x, y, r = 1.6) { let best = null, bd = r; for (const v of VEHS.values()) { const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; } } return best; }
function trunkKg(v) { if (!v.trunk) return 0; return v.trunk.reduce((a, s) => a + wOf(s), 0); }
function ensureTrunk(v) { if (v.trunk) return; v.trunk = []; if (v.type === 'car') { const L = rollLoot({ k: 'trunk', id: v.id + ':trunk' }); v.trunk = L.items; if (L.money) v.trunk.push({ id: 'cash', n: L.money }); } }
function driveUpdate(v, dt, ix, iy) {
  const S = VSPEC[v.type]; v.spd = v.spd || 0; const want = ix || iy; const fuelOK = v.type === 'bike' || v.fuel > 0;
  if (want && fuelOK) { const ta = Math.atan2(iy, ix); let da = ta - v.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const turn = S.turn * dt * (0.4 + Math.min(1, v.spd / 4)); v.ang += clamp(da, -turn, turn);
    const t = tileAt(v.x, v.y), off = !(t === T.ROAD || t === T.LINE || t === T.BRIDGE || t === T.CONC || t === T.SIDE || t === T.DIRT || t === T.GRAVEL || t === T.GLASS);
    const max = S.max * (off ? (v.type === 'car' ? 0.55 : 0.75) : 1) * (Math.abs(da) > 1.8 ? 0.4 : 1); if (v.type === 'bike') { PL.sta = Math.max(0, PL.sta - dt * 3); }
    v.spd = Math.min(max * (v.type === 'bike' && PL.sta < 5 ? 0.5 : 1), v.spd + S.acc * dt); }
  else v.spd = Math.max(0, v.spd - (want ? 4 : 9) * dt);
  if (!fuelOK && want && !v._nf) { v._nf = 1; msg('OUT OF GAS', '#ff8a6a'); sfx('sputter', v.x, v.y); }
  const dx = Math.cos(v.ang) * v.spd * dt, dy = Math.sin(v.ang) * v.spd * dt, r = v.type === 'car' ? 0.55 : 0.35;
  if (v.spd > 0.1) { const hit = moveC(v, dx, dy, r, 'p'); if (hit && v.spd > 3) { if (v.spd > 7) sfx('crash', v.x, v.y); v.spd *= 0.2; noise(v.x, v.y, 14, 'crash'); } else if (hit) v.spd *= 0.5;
    if (S.use) { v.fuel = Math.max(0, v.fuel - Math.hypot(dx, dy) * S.use); }
    for (const z of ZOMS) { if (z.dead) continue; const d = Math.hypot(z.x - v.x, z.y - v.y); if (d < r + 0.45 && v.spd > 3.5) { hurtZ(z, v.type === 'car' ? 9 : 2.5, Math.cos(v.ang), Math.sin(v.ang), 'ram'); sfx('thud', z.x, z.y); v.spd *= v.type === 'car' ? 0.85 : 0.55; } } }
  if (v.type !== 'bike' && fuelOK) { v.noiseT = (v.noiseT || 0) - dt; if (v.noiseT <= 0) { v.noiseT = 0.5; noise(v.x, v.y, S.noise * (v.spd > 1 ? 1 : 0.6), 'veh'); } }
  PL.x = v.x; PL.y = v.y; v.moved = true; v.dir = Math.round(v.ang / (Math.PI / 4)) & 7;
}
// ================================================================ time, needs, farming, base, recruits, the night wave
const BASE_R = 16;
function inBase(x, y, r = BASE_R) { return G.base && Math.hypot(x - G.base.x - 0.5, y - G.base.y - 0.5) < r; }
function updateTime(dt, rate = 2) {
  const before = G.time; G.time += dt * rate; const hrs = dt * rate / 60, sleeping = G.sleeping;
  if (!sleeping) G.awake += hrs;
  const sk = sleeping ? 0.5 : 1, sprint = PL.sprint && PL.moving ? 1.6 : 1;
  PL.hun = Math.max(0, PL.hun - 4.5 * hrs * sk); PL.thi = Math.max(0, PL.thi - 6 * hrs * sk * sprint * (season() === 1 ? 1.15 : 1));
  if (PL.hun <= 0) hurtP(3 * hrs, 'STARVED'); if (PL.thi <= 0) hurtP(3.5 * hrs, 'DIED OF THIRST'); if (G.awake > 30) hurtP(2 * hrs, 'EXHAUSTION');
  if (PL.hun > 45 && PL.thi > 45 && !PL.dead) PL.hp = Math.min(100, PL.hp + (sleeping ? 7 : 1.2) * hrs);
  if (season() === 3 && isNight() && !PL.inv.wear.body && !G.sleeping && !buildingAt(PL.x, PL.y) && !nearFire(PL.x, PL.y)) hurtP(2.5 * hrs, 'FROZE');
  if (before < 22 * 60 && G.time >= 22 * 60 && !G.wave && G.base) startWave(inBase(PL.x, PL.y, BASE_R + 6) || G.sleeping);
  if (G.time >= 1440) G.time -= 1440;
  if (before < 6 * 60 && G.time >= 6 * 60) morning();
  else if (before > G.time && G.time >= 6 * 60) morning();
}
function hurtP(n, why) { if (PL.dead || n <= 0) return; PL.hp -= n; if (PL.hp <= 0) die(why); }
// ---- farming (Stardew-style: till, plant, water daily, seasons, harvest)
const TILLABLE = new Set([T.GRASS, T.DIRT, T.TALL, T.FLOWER, T.FIELD, T.SAND]);
function cropAt(x, y) { return G.crops[tkey(Math.floor(x), Math.floor(y))]; }
function waterCrop(k) { const c = G.crops[k]; if (c) c.w = 1; else G.wetT = G.wetT || {}; }
function growCrops(report) {
  const s = season(); let grown = 0, died = 0;
  for (const k in G.crops) { const c = G.crops[k], C = CROPS[c.c];
    if (!C.seas.includes(s)) { delete G.crops[k]; died++; continue; }
    if (c.w) { c.dry = 0; if (c.age < C.days) { c.age++; grown++; } } else { c.dry = (c.dry || 0) + 1; if (c.dry >= 3) { delete G.crops[k]; died++; continue; } }
    c.w = G.rain ? 1 : 0; }
  // sprinklers water their 3x3, farmers water everything inside the camp
  for (const b of BUILD.values()) if (b.k === 'sprinkler') for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = G.crops[tkey(b.x + i, b.y + j)]; if (c) c.w = 1; }
  if (report) { report.grown = grown; report.died = died; }
}
function harvest(k, toChest) {
  const c = G.crops[k], C = CROPS[c.c]; if (!c || c.age < C.days) return 0;
  const n = C.yield[0] + ((Math.random() * (C.yield[1] - C.yield[0] + 1)) | 0);
  let left = n; if (toChest) left = chestAdd(c.c, n); else left = addItem(PL.inv, c.c, n);
  if (left) dropItem(c.c, left, (k % WS) + 0.5, Math.floor(k / WS) + 0.5);
  if (C.regrow) c.age = C.days - C.regrow; else delete G.crops[k];
  return n;
}
// ---- ground drops (things you couldn't carry)
function dropItem(id, n, x, y, q) { G.drops = G.drops || []; const ex = G.drops.find((d) => d.id === id && Math.hypot(d.x - x, d.y - y) < 0.8 && IT[id].s > 1); if (ex) ex.n += n; else G.drops.push({ id, n, x, y, q }); }
// ---- base storage: chests inside the camp
function chests() { const out = []; for (const b of BUILD.values()) if (b.k === 'chest') { b.items = b.items || []; out.push(b); } return out; }
function chestAdd(id, n, q) { for (const b of chests()) { if (IT[id].s > 1) { const ex = b.items.find((s) => s.id === id && s.n < IT[id].s * 4); if (ex) { ex.n += n; return 0; } } if (b.items.length < 24) { b.items.push({ id, n, q }); return 0; } } return n; }
function chestFood() { let best = null, bc = null; for (const b of chests()) for (const s of b.items) if (IT[s.id].c === 'food' && (!best || IT[s.id].v < IT[best.id].v)) { best = s; bc = b; } return best ? [bc, best] : null; }
function chestCount(id) { let n = 0; for (const b of chests()) for (const s of b.items) if (s.id === id) n += s.n; return n; }
function chestTake(id, n) { for (const b of chests()) for (let i = b.items.length - 1; i >= 0 && n > 0; i--) { const s = b.items[i]; if (s.id !== id) continue; const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) b.items.splice(i, 1); } return n <= 0; }
// materials for building: from the pack first, then camp chests
function haveMat(id, n) { return countItem(PL.inv, id) + (inBase(PL.x, PL.y) ? chestCount(id) : 0) >= n; }
function useMat(id, n) { const a = Math.min(n, countItem(PL.inv, id)); if (a) takeItem(PL.inv, id, a); if (n - a) chestTake(id, n - a); }
function canBuild(k) { for (const id in BDEF[k].cost) if (!haveMat(id, BDEF[k].cost[id])) return false; return true; }
function placeBuild(k, x, y) {
  const d = BDEF[k]; if (!canBuild(k)) { msg('NOT ENOUGH MATERIALS', '#ff8a6a'); sfx('deny'); return false; }
  const t = tileAt(x, y); if (SOLID[t] || t === T.SHAL || BUILD.has(tkey(x, y)) || G.crops[tkey(x, y)] || Math.abs(x + 0.5 - PL.x) < 0.6 && Math.abs(y + 0.5 - PL.y) < 0.6 && (d.ps || d.zs)) { msg('CANT BUILD THERE', '#ff8a6a'); sfx('deny'); return false; }
  for (const id in d.cost) useMat(id, d.cost[id]);
  const b = { k, x, y, hp: d.hp, mx: d.hp }; if (k === 'turret') { b.ammo = 0; const a = Math.min(40, countItem(PL.inv, 'a9')); if (a) { takeItem(PL.inv, 'a9', a); b.ammo = a; } }
  if (k === 'barrel') b.wt = 2; BUILD.set(tkey(x, y), b); sfx('build', x + 0.5, y + 0.5); noise(x + 0.5, y + 0.5, 6, 'build'); puff(x + 0.5, y + 0.5, PAL.wood[0], 6); PL.strXP += 0.5; markFieldDirty(); return true;
}
function removeBuild(b) { const d = BDEF[b.k]; for (const id in d.cost) { const n = Math.floor(d.cost[id] / 2); if (n && id !== 'pistol') { const left = addItem(PL.inv, id, n); if (left) dropItem(id, left, b.x + 0.5, b.y + 0.5); } }
  if (b.k === 'turret') { addItem(PL.inv, 'pistol', 1) && dropItem('pistol', 1, b.x + 0.5, b.y + 0.5); if (b.ammo) addItem(PL.inv, 'a9', b.ammo); }
  if (b.items) for (const s of b.items) dropItem(s.id, s.n, b.x + 0.5, b.y + 0.5, s.q);
  BUILD.delete(tkey(b.x, b.y)); sfx('break', b.x + 0.5, b.y + 0.5); markFieldDirty(); }
function foundBase(x, y) {
  if (G.base) { msg('YOU ALREADY HAVE A CAMP', '#ff8a6a'); return; }
  G.base = { x, y, day: G.day }; takeItem(PL.inv, 'bedroll', 1); sfx('build'); msg('CAMP FOUNDED. BUILD WALLS + TRAPS BEFORE 22:00', '#ffd76a');
  for (const z of ZOMS) if (!z.dead && Math.hypot(z.x - x, z.y - y) < 10 && z.st !== 'chase') z.dead = true, z.dt = 99;
}
function bunks() { const out = []; for (const b of BUILD.values()) if (b.k === 'bunk') out.push(b); return out; }
function freeBunk() { const used = new Set(G.recruits.map((r) => r.bunk)); return bunks().find((b) => !used.has(tkey(b.x, b.y))); }
function campSize() { return 1 + G.recruits.length; }
function campTier() { const n = campSize(); return n >= 10 ? 'UTOPIA' : n >= 6 ? 'VILLAGE' : n >= 3 ? 'OUTPOST' : 'CAMP'; }
function recruit(n) {
  const b = freeBunk(); if (!b) { msg('NO FREE BUNK', '#ff8a6a'); return false; }
  const r = { id: n.id, name: n.name, look: n.look, job: 'farmer', bunk: tkey(b.x, b.y), x: b.x + 0.5, y: b.y + 1.2, face: 1, fs: 1, hungry: 0, t: 0, day: G.day };
  G.recruits.push(r); G.npc[n.id] = 'joined'; NPCS.delete(n.id); msg(n.name + ' JOINED YOUR CAMP!', '#8af06a'); sfx('join'); return true;
}
// ---- the morning: day count, crops, rain barrels, recruits eat and work
function morning() {
  if (G.wave) endWave();
  const rep = { day: G.day, grown: 0, died: 0, ate: 0, left: [], lost: [], found: [], fixed: 0, wave: G.lastWave || null };
  G.day++; G.awake = Math.min(G.awake, 4); G.rain = rng(hash2(G.day, 3, G.seed))() < (season() === 3 ? 0.1 : 0.28);
  for (const k in G.zk) { G.zk[k] = Math.floor(G.zk[k] * 0.6); if (!G.zk[k]) delete G.zk[k]; }
  ACTIVE.clear(); ZOMS = ZOMS.filter((z) => !z.dead && Math.hypot(z.x - PL.x, z.y - PL.y) < 30 && z.hk !== -1);
  G.stock = {}; for (const k in G.pumps) G.pumps[k] = Math.min(G.pumps[k] + 0.5, 99);
  for (const b of BUILD.values()) if (b.k === 'barrel') b.wt = Math.min(5, (b.wt || 0) + (G.rain ? 5 : 2));
  for (const r of G.recruits.slice()) { if (r.dead) continue;
    const f = chestFood(); if (f) { const [cb, s] = f; s.n--; if (!s.n) cb.items.splice(cb.items.indexOf(s), 1); r.hungry = 0; rep.ate++; } else { r.hungry++; if (r.hungry >= 2) { rep.left.push(r.name); G.recruits.splice(G.recruits.indexOf(r), 1); continue; } }
    if (r.job === 'farmer') { for (const k in G.crops) { const c = G.crops[k], x = k % WS, y = Math.floor(k / WS); if (!inBase(x, y, BASE_R + 4)) continue; if (c.age >= CROPS[c.c].days) harvest(+k, true); if (G.crops[k]) G.crops[k].w = 1; } }
    if (r.job === 'scavenger') { if (Math.random() < 0.04 + G.day * 0.002) { rep.lost.push(r.name + ' NEVER CAME BACK'); G.recruits.splice(G.recruits.indexOf(r), 1); continue; }
      const L = rollLoot({ k: ['cabinet', 'crate', 'dresser', 'fridge', 'toolbox', 'shelf'][(Math.random() * 6) | 0], bk: 'store', id: 'scav' + G.day + r.id + Math.random() }); for (const s of L.items) { chestAdd(s.id, s.n, s.q); rep.found.push(s.n + ' ' + IT[s.id].n); } if (L.money) { G.money += L.money; rep.found.push('$' + L.money); } }
    if (r.job === 'builder') for (const b of BUILD.values()) { const d = BDEF[b.k]; if (b.hp < b.mx) { b.hp = Math.min(b.mx, b.hp + (d.trap ? 2 : 30)); rep.fixed++; } }
  }
  growCrops(rep);
  G.lastWave = null; G.report = rep; G.saveDirty = true;
}
// ---- the night wave: zombies come from a ring around your camp at 22:00
function startWave(live) {
  const n = 2 + G.day + Math.floor(G.day * G.day / 12), R = rng(hash2(G.day, 77, G.seed));
  G.wave = { total: n, spawned: 0, killed: 0, broke: 0, lostR: [], log: [], next: 0, live, F: null, fT: 0, bx: G.base.x + 0.5, by: G.base.y + 0.5, groups: Math.min(5, 2 + (G.day / 4 | 0)), R, breach: 0 };
  if (live && !G.sleeping) { msg('THEY ARE COMING. ' + n + ' ZOMBIES', '#ff6a5a'); sfx('horde'); }
  if (!live) { runWaveHeadless(); }
}
function waveSpawn(W, dt) {
  W.next -= dt; if (W.spawned >= W.total || W.next > 0) return;
  const per = Math.ceil(W.total / W.groups), a0 = W.R() * 6.283;
  for (let i = 0; i < per && W.spawned < W.total; i++) { for (let tr = 0; tr < 20; tr++) { const a = a0 + (W.R() - 0.5) * 1.2, r = 20 + W.R() * 6, x = W.bx + Math.cos(a) * r, y = W.by + Math.sin(a) * r;
    if (solidAt(x, y, 'z') || tileAt(x, y) === T.SHAL) continue; const z = spawnZ(x, y, zKind(W.R), (W.R() * 1e9) | 0, -1); z.st = 'wave'; break; } W.spawned++; }
  W.next = 18 + W.R() * 10;
}
function waveZombie(z, dt) {
  const W = G.wave; const spd = (z.kind === 'runner' ? 4.0 : z.kind === 'fat' ? 1.6 : 2.4);
  // the player (if awake and close) is the juicier target
  const dP = Math.hypot(PL.x - z.x, PL.y - z.y), huntP = !G.sleeping && !PL.dead && dP < 9 && (dP < 2 || los(z.x, z.y, PL.x, PL.y));
  if (huntP) { if (z.st === 'lunge') { z.lT -= dt; if (z.lT <= 0) { if (dP < 1.3) bite(z); z.st = 'wave'; z.stun = 0.25; } return; }
    if (dP < 1.05) { z.st = 'lunge'; z.lT = 0.35; sfx('lunge', z.x, z.y); return; } }
  if (z.st === 'lunge' && !huntP) z.st = 'wave';
  // recruits: guards fight back; bunks are soft targets
  for (const r of G.recruits) { if (r.dead) continue; const d = Math.hypot(r.x - z.x, r.y - z.y); if (d < 1.0) { z.gT = (z.gT || 0) + dt; if (z.gT > 0.9) { z.gT = 0; if (Math.random() < (r.job === 'guard' ? 0.18 : 0.6)) { r.dead = true; W.lostR.push(r.name); blood(r.x, r.y - 0.5, 14); sfx('scream', r.x, r.y); } } } }
  let tgt; if (huntP) tgt = CHASEF && dP > 1.6 ? fieldStep(CHASEF, z.x, z.y) : null; if (!tgt && huntP) tgt = [PL.x, PL.y];
  if (!tgt) { if (!W.F || W.fT <= 0) { W.F = flowField(W.bx, W.by, 30); W.fT = 3; } tgt = fieldStep(W.F, z.x, z.y) || [W.bx, W.by]; }
  if (stepTo(z, tgt[0], tgt[1], spd, dt) === -1) attackBuildNear(z, tgt, dt);
  z.face = tgt[0] > z.x ? 1 : -1; z.fs = lerp(z.fs, z.face, Math.min(1, dt * 9));
  // only the WATCH sleeper is yanked awake / eaten; SKIP resolves via breach damage
  if (G.sleeping && G.sleepWatch && Math.hypot(W.bx - z.x, W.by - z.y) < 5.5) wakeUp();
  if (Math.hypot(W.bx - z.x, W.by - z.y) < 0.9) {
    if (G.sleeping && G.sleepWatch) { blood(PL.x, PL.y - 0.6, 18); sfx('bite'); die('EATEN IN YOUR SLEEP'); return; }
    if (G.sleeping || !inBase(PL.x, PL.y, 3)) { W.breach++; z.dead = true; z.dt = 99; const vic = G.recruits.find((r) => !r.dead && r.job !== 'guard') || G.recruits.find((r) => !r.dead); if (vic) { vic.dead = true; W.lostR.push(vic.name); } else { const bs = [...BUILD.values()].filter((b) => b.k !== 'spikes' && b.k !== 'chest'); if (bs.length) damageBuild(bs[(Math.random() * bs.length) | 0], 40); } }
  }
}
function waveDefense(dt) {
  const W = G.wave;
  for (const b of BUILD.values()) { if (b.k !== 'turret' || !b.ammo) continue; b.cd = (b.cd || 0) - dt; if (b.cd > 0) continue; let best = null, bd = 7.5;
    for (const z of ZOMS) { if (z.dead) continue; const d = Math.hypot(z.x - b.x - 0.5, z.y - b.y - 0.5); if (d < bd && los(b.x + 0.5, b.y + 0.5, z.x, z.y)) { bd = d; best = z; } }
    if (best) { b.cd = 0.6; b.ammo--; hurtZ(best, 3, 0, 0, 'gun'); FX.push({ k: 'tracer', x: b.x + 0.5, y: b.y + 0.1, x2: best.x, y2: best.y - 0.5, t: 0.08 }); if (!W.headless) sfx('pistol', b.x, b.y); } }
  for (const r of G.recruits) { if (r.dead || r.job !== 'guard') continue; r.cd = (r.cd || 0) - dt; let best = null, bd = 1.4;
    for (const z of ZOMS) { if (z.dead) continue; const d = Math.hypot(z.x - r.x, z.y - r.y); if (d < bd) { bd = d; best = z; } }
    if (best && r.cd <= 0) { r.cd = 0.8; hurtZ(best, 1.5, (best.x - r.x) * 0.4, (best.y - r.y) * 0.4, 'melee'); r.face = best.x > r.x ? 1 : -1; if (!W.headless) sfx('hit', r.x, r.y); } }
}
function guardPost(r, i) { const n = Math.max(1, G.recruits.filter((q) => q.job === 'guard' && !q.dead).length), a = i / n * 6.283; return [G.base.x + 0.5 + Math.cos(a) * 2.2, G.base.y + 0.5 + Math.sin(a) * 2.2]; }
function updateWave(dt) {
  const W = G.wave; if (!W) return; W.fT -= dt; waveSpawn(W, dt); waveDefense(dt);
  if (!W.headless && !G.sleeping && !PL.dead) { W.cT = (W.cT || 0) - dt; if (W.cT <= 0) { W.cT = 0.6; CHASEF = flowField(PL.x, PL.y, 16); } }
  const alive = ZOMS.filter((z) => !z.dead && z.hk === -1).length;
  if ((W.spawned >= W.total && !alive) || (G.time >= 6 * 60 && G.time < 12 * 60)) endWave();
}
function endWave() {
  const W = G.wave; if (!W) return; G.recruits = G.recruits.filter((r) => !r.dead);
  G.lastWave = { total: W.total, killed: W.killed, broke: W.broke, lost: W.lostR.slice(), breach: W.breach };
  ZOMS = ZOMS.filter((z) => z.hk !== -1 || z.dead); G.wave = null; CHASEF = null;
  if (!G.sleeping && !W.headless && !PL.dead) msg('THE WAVE IS OVER. ' + W.killed + ' DOWN', '#8af06a');
}
// synchronous night: the same simulation, no drawing (used when you skip, or when you are away from camp)
function runWaveHeadless() {
  const W = G.wave; W.headless = true; const keep = ZOMS; ZOMS = keep.filter((z) => z.hk === -1 && !z.dead);
  const saveSfx = SFX_ON.v; SFX_ON.v = false; let t = 0;
  while (G.wave && t < 600) { const dt = 0.1; t += dt; for (const r of G.recruits) { if (r.job === 'guard') { const p = guardPost(r, G.recruits.indexOf(r)); r.x = p[0]; r.y = p[1]; } }
    updateZombies(dt); updateWave(dt); if (PL.dead || !W.headless) break; if (W.spawned >= W.total && !ZOMS.some((z) => !z.dead && z.hk === -1)) { endWave(); break; } W.next = Math.min(W.next, 6); }
  SFX_ON.v = saveSfx; if (G.wave && !W.headless) { ZOMS = keep.filter((z) => z.hk !== -1).concat(ZOMS.filter((z) => !z.dead)); return; }
  if (G.wave) endWave(); ZOMS = keep.filter((z) => z.hk !== -1);
}
// ================================================================ rendering: world, roofs, people, light, HUD, minimap, map
const CAM = { x: 0, y: 0, shake: 0 }; let OPT = { dusk: true, sfx: true, music: true };
try { Object.assign(OPT, JSON.parse(localStorage.getItem('sovereign.opt') || '{}')); } catch (e) { }
const saveOpt = () => { try { localStorage.setItem('sovereign.opt', JSON.stringify(OPT)); } catch (e) { } };
let TREE_IMG = null, PINE_IMG = null, STUMP = null; const TREES = [], PINES = [];
const BAYER = [[0, 2], [3, 1]];
// sphere-shaded leaf clusters with ordered dithering (original 16-bit style tree art)
function canopy(x, L, clusters, seed) {
  const r = rng(seed);
  for (const [cx, cy, rad] of clusters) {
    for (let j = Math.floor(cy - rad - 1); j <= cy + rad + 1; j++) for (let i = Math.floor(cx - rad - 1); i <= cx + rad + 1; i++) { const d = Math.hypot(i + 0.5 - cx, (j + 0.5 - cy) * 1.1); if (d < rad + 1 && d >= rad) P(x, i, j, 1, 1, L[4]); }
    for (let j = Math.floor(cy - rad); j <= cy + rad; j++) for (let i = Math.floor(cx - rad); i <= cx + rad; i++) { const dx = i + 0.5 - cx, dy = (j + 0.5 - cy) * 1.1, d = Math.hypot(dx, dy); if (d >= rad) continue;
      let t = ((dx * 0.55 + dy * 0.85) / rad) * 1.6 + 1.7 + (d / rad) * 0.6; t += (BAYER[j & 1][i & 1] / 4 - 0.4) * 0.9; if (((i * 7 + j * 13) % 9) === 0) t += 1; const k = clamp(Math.round(t), 0, 4); P(x, i, j, 1, 1, L[k]); }
    for (let n = 0; n < rad; n++) { const a = r() * 6.28, rr = r() * rad * 0.6, X = Math.round(cx - rad * 0.3 + Math.cos(a) * rr), Y = Math.round(cy - rad * 0.35 + Math.sin(a) * rr * 0.8); P(x, X, Y, 1, 1, L[0]); P(x, X + 1, Y + 1, 1, 1, L[2]); }
  }
}
function buildTrees() {
  const L = R5.leaf, Pn = R5.pine, Tb = R5.timber;
  for (let v = 0; v < 3; v++) { const [c, x] = mk(28, 34), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col);
    // ground shadow + trunk with root flare
    for (let i = 0; i < 18; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1 && ((i - 9) ** 2 / 81 + (j - 1.5) ** 2 / 4) < 1) p(5 + i, 29 + j, 1, 1, 'rgba(8,16,8,0.55)');
    p(12, 19, 4, 12, Tb[2]); p(12, 19, 1, 12, Tb[1]); p(15, 19, 1, 12, Tb[4]); p(11, 29, 6, 2, Tb[2]); p(10, 30, 2, 1, Tb[3]); p(16, 30, 2, 1, Tb[3]); p(13, 23, 1, 2, Tb[4]); p(14, 26, 1, 2, Tb[3]); p(12, 19, 4, 2, Tb[4]);
    const cl = v === 0 ? [[14, 15, 8], [7, 14, 6], [21, 14, 6], [14, 8, 8], [9, 9, 5], [19, 9, 5]] : v === 1 ? [[14, 16, 7], [8, 12, 6], [20, 12, 6], [14, 7, 7]] : [[14, 15, 9], [14, 7, 7], [8, 11, 5], [20, 10, 5]];
    canopy(x, L, cl, 77 + v); if (v === 1) { p(9, 12, 1, 1, '#e85a5a'); p(18, 16, 1, 1, '#e85a5a'); p(15, 8, 1, 1, '#e85a5a'); }
    TREES.push(outline1(c, false)); }
  for (let v = 0; v < 2; v++) { const [c, x] = mk(22, 36), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col);
    for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) if ((i + j) & 1) p(4 + i, 32 + j, 1, 1, 'rgba(8,16,8,0.55)');
    p(10, 27, 3, 7, Tb[2]); p(10, 27, 1, 7, Tb[1]); p(12, 27, 1, 7, Tb[4]);
    const tiers = v ? 4 : 5;
    for (let ti = 0; ti < tiers; ti++) { const y0 = 1 + ti * (v ? 6 : 5), hh = v ? 9 : 8, maxw = 4 + ti * (v ? 2.4 : 1.8);
      for (let j = 0; j < hh; j++) { const hw = Math.max(1, Math.round(maxw * (j + 1) / hh)); for (let i = -hw; i < hw; i++) { const X = 11 + i, Y = y0 + j; let t = (i + hw) / (2 * hw) * 3 + (j / hh) * 1.2 + (BAYER[Y & 1][X & 1] / 4 - 0.4); if (j === hh - 1 && ((X + ti) & 1)) continue; if (i === -hw || i === hw - 1) t += 0.8; p(X, Y, 1, 1, Pn[clamp(Math.round(t), 0, 4)]); } }
      p(11 - Math.round(maxw * 0.5), y0 + hh - 2, 2, 1, Pn[0]); }
    p(11, 1, 1, 1, Pn[0]); PINES.push(outline1(c, false)); }
  TREE_IMG = TREES[0]; PINE_IMG = PINES[0];
}
const W2S = (wx, wy) => [Math.round(wx * TS - CAM.px + N / 2), Math.round(wy * TS - CAM.py + N / 2)];
function tileVar(t, x, y) {
  if (WALLISH[t]) { const b = tileAt(x, y + 1); let v = WALLISH[b] ? 0 : 1; if (v && hash2(x, y, 5) < 0.35 && t !== T.WALLC && !WALLISH[tileAt(x - 1, y + 1)] && WALLISH[tileAt(x - 1, y)] && WALLISH[tileAt(x + 1, y)]) v = hash2(x, y, 9) < 0.55 ? 3 : 2; return v; }
  if (t === T.WATER || t === T.SEA || t === T.SHAL) return ((G.clock * 2.2) | 0) & 3;
  return (hash2(x, y, 2) * 4) | 0;
}
function drawWorld() {
  CAM.px = Math.round(CAM.x * TS + (CAM.shake ? (Math.random() - 0.5) * CAM.shake * 6 : 0)); CAM.py = Math.round(CAM.y * TS + (CAM.shake ? (Math.random() - 0.5) * CAM.shake * 6 : 0));
  const half = N / 2 / TS, x0 = Math.floor(CAM.x - half) - 1, y0 = Math.floor(CAM.y - half) - 1, x1 = Math.ceil(CAM.x + half) + 1, y1 = Math.ceil(CAM.y + half) + 2;
  const trees = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = tileAt(x, y), [sx, sy] = W2S(x, y);
    hx.drawImage(ATLAS, t * 16, tileVar(t, x, y) * 16, 16, 16, sx, sy, 16, 16);
    if (FRINGED[t]) { if (GRASSY[tileAt(x, y - 1)]) hx.drawImage(EDGE, 0, 0, 16, 16, sx, sy, 16, 16); if (GRASSY[tileAt(x + 1, y)]) hx.drawImage(EDGE, 16, 0, 16, 16, sx, sy, 16, 16); if (GRASSY[tileAt(x, y + 1)]) hx.drawImage(EDGE, 32, 0, 16, 16, sx, sy, 16, 16); if (GRASSY[tileAt(x - 1, y)]) hx.drawImage(EDGE, 48, 0, 16, 16, sx, sy, 16, 16); }
    else if (WATERY[t]) { const fy = 16 + (((G.clock * 2) | 0) & 1) * 16, nb = (a) => !WATERY[a] && a !== T.BRIDGE; if (nb(tileAt(x, y - 1))) hx.drawImage(EDGE, 0, fy, 16, 16, sx, sy, 16, 16); if (nb(tileAt(x + 1, y))) hx.drawImage(EDGE, 16, fy, 16, 16, sx, sy, 16, 16); if (nb(tileAt(x, y + 1))) hx.drawImage(EDGE, 32, fy, 16, 16, sx, sy, 16, 16); if (nb(tileAt(x - 1, y))) hx.drawImage(EDGE, 48, fy, 16, 16, sx, sy, 16, 16); }
    if (!WALLISH[t] && !SOLID[t] && WALLISH[tileAt(x, y - 1)]) { hx.fillStyle = 'rgba(8,4,16,0.38)'; hx.fillRect(sx, sy, 16, 3); hx.fillStyle = 'rgba(8,4,16,0.18)'; hx.fillRect(sx, sy + 3, 16, 2); }
    if (t === T.TREE || t === T.PINE) trees.push({ y: y + 1, x, t, sx, sy });
    if (t === T.TILLED) { const c = G.crops[tkey(x, y)]; if (c && c.w || G.rain) { hx.globalAlpha = 0.55; hx.drawImage(ATLAS, T.TILLED * 16, 0, 16, 16, sx, sy, 16, 16); hx.fillStyle = 'rgba(40,20,10,0.45)'; hx.fillRect(sx, sy, 16, 16); hx.globalAlpha = 1; }
      if (c) drawCrop(c, sx, sy); }
  }
  { const b0 = buildingAt(PL.x, PL.y); if (b0) drawRug(b0); } ROOFS_VIS = [];
  for (const f of FX) if (f.k === 'stain') { const [sx, sy] = W2S(f.x, f.y); rect(sx - 2, sy - 1, 4, 2, f.col); }
  // drops on the ground
  if (G.drops) for (const d of G.drops) { const [sx, sy] = W2S(d.x, d.y); if (sx < -20 || sy < -20 || sx > N + 20 || sy > N + 20) continue; hx.drawImage(iconImg(d.id), sx - 7, sy - 10 + Math.round(Math.sin(G.clock * 3 + d.x) * 1)); }
  // sprites: y-sorted
  const myB = buildingAt(PL.x, PL.y), S = [], vis = (x, y) => { const b = buildingAt(x, y); return !b || b === myB; }, onS = (x, y, m = 2) => { const [sx, sy] = W2S(x, y); return sx > -16 * m && sy > -16 * m && sx < N + 16 * m && sy < N + 16 * m * 2; };
  const cx0 = Math.floor(x0 / CH), cy0 = Math.floor(y0 / CH), cx1 = Math.floor(x1 / CH), cy1 = Math.floor(y1 / CH);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue; const c = chunk(cx, cy);
    for (const o of c.objs) { if (!onS(o.x, o.y) || !vis(o.x + 0.5, o.y + 0.5)) continue; S.push({ y: o.y + 0.9, d: () => { const [sx, sy] = W2S(o.x, o.y); const open = !!G.looted[o.id] || (o.k === 'pump' && pumpFuel(o) <= 0); const im = propImg(o.k, open); hx.drawImage(im, sx + 8 - im.width / 2, sy + 18 - im.height); if (o.k === 'trader') drawTrader(o, sx, sy); } }); } }
  for (const b of BUILD.values()) { if (!onS(b.x, b.y) || !vis(b.x + 0.5, b.y + 0.5)) continue; const k = b.k === 'bed' ? 'bed' : b.k;
    S.push({ y: b.y + (BDEF[b.k].trap ? 0.2 : 0.95), d: () => { const [sx, sy] = W2S(b.x, b.y); const im = propImg(k); hx.drawImage(im, sx + 8 - im.width / 2, sy + 18 - im.height);
      if (b.k === 'campfire') drawFire(sx + 8, sy + 12); if (b.hp < b.mx && !BDEF[b.k].trap) { rect(sx + 2, sy - 1, 12, 2, INK); rect(sx + 2, sy - 1, Math.round(12 * b.hp / b.mx), 2, b.hp / b.mx > 0.5 ? '#8af06a' : '#ff6a5a'); } } }); }
  if (G.base && onS(G.base.x, G.base.y)) S.push({ y: G.base.y + 0.6, d: () => { const [sx, sy] = W2S(G.base.x, G.base.y); const im = propImg('bed'); hx.drawImage(im, sx + 8 - im.width / 2, sy + 18 - im.height); } });
  for (const v of VEHS.values()) { if (!onS(v.x, v.y) || !vis(v.x, v.y)) continue; S.push({ y: v.y + 0.3, d: () => { const [sx, sy] = W2S(v.x, v.y); const im = vehImg(v.type, v.col, Math.round(v.ang / (Math.PI / 4)) & 7); hx.drawImage(im, sx - im.width / 2, sy - im.height / 2 - 2); if (!v.ok) { rect(sx - 1, sy - 9, 3, 3, INK); rect(sx, sy - 8, 1, 1, '#ff6a5a'); }
      if (PL.veh === v.id) { if (v.type === 'car') { rect(sx - 2, sy - 9, 5, 5, INK); rect(sx - 1, sy - 8, 3, 3, playerLook().skin || '#e8b890'); } else drawStandee(personFrames(playerLook()), 0, sx, sy + 1, PL.fs, 0, 0, 1, plDir()); } } }); }
  for (const z of ZOMS) { if (!onS(z.x, z.y) || !vis(z.x, z.y)) continue; S.push({ y: z.y, d: () => drawZombie(z) }); }
  for (const n of NPCS.values()) { if (!onS(n.x, n.y) || !vis(n.x, n.y)) continue; S.push({ y: n.y, d: () => { const [sx, sy] = W2S(n.x, n.y); drawStandee(personFrames(n.look), 0, sx, sy, n.fs, 0, 0, 1, dir4(n, n.fs)); if (Math.sin(G.clock * 3) > 0) text('!', sx, sy - 34, '#ffd76a', 'center'); } }); }
  for (const r of G.recruits) { if (!onS(r.x, r.y) || !vis(r.x, r.y) || G.sleeping && !G.wave) continue; S.push({ y: r.y, d: () => { const [sx, sy] = W2S(r.x, r.y); const mv = r.mv; drawStandee(personFrames(r.look), mv ? WALK4[(G.clock * 9 | 0) & 3] : 0, sx, sy, r.fs, 0, 0, 1, dir4(r, r.fs)); } }); }
  if (!PL.veh && !(G.sleeping)) S.push({ y: PL.y, d: drawPlayer });
  for (const t of trees) S.push({ y: t.y - 0.05, d: () => { const hv = (hash2(t.x, t.y, 3) * 9) | 0, im = t.t === T.TREE ? TREES[hv % 3] : PINES[hv & 1]; const ch = G.chop && G.chop.k === tkey(t.x, t.y) ? Math.sin(G.clock * 40) * G.chop.sh : 0; hx.drawImage(im, t.sx + 8 - (im.width >> 1) + Math.round(ch), t.sy + 18 - im.height); } });
  S.sort((a, b) => a.y - b.y);
  // roofs over every building you are not inside (interiors hidden)
  const roofs = [];
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue; for (const b of chunk(cx, cy).bl) if (b !== myB && !roofs.includes(b)) roofs.push(b); }
  // sprites above the roof line draw first, then roofs, then the rest (simple depth)
  let si = 0; roofs.sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const b of roofs) { const by = b.y + b.h - 0.5; while (si < S.length && S[si].y < b.y) S[si++].d(); drawRoof(b); void by; }
  while (si < S.length) S[si++].d();
  for (const f of FX) { if (f.k === 'p') { const [sx, sy] = W2S(f.x, f.y); rect(sx, sy, 1, 1, f.col); } else if (f.k === 'tracer') { const [ax, ay] = W2S(f.x, f.y), [bx, by] = W2S(f.x2, f.y2); hx.strokeStyle = '#fff2a0'; hx.lineWidth = 1; hx.beginPath(); hx.moveTo(ax + 0.5, ay + 0.5); hx.lineTo(bx + 0.5, by + 0.5); hx.stroke(); } }
  // noise rings (fade quickly) so the player learns what is loud
  for (const n of NOISE) { if (n.r < 3) continue; const [sx, sy] = W2S(n.x, n.y); hx.strokeStyle = 'rgba(255,240,200,' + (n.t * 0.5).toFixed(2) + ')'; hx.beginPath(); hx.arc(sx, sy, n.r * TS * (1.15 - n.t * 0.25), 0, 6.283); hx.stroke(); }
  if (G.ui === 'build' && G.bsel) drawGhost();
}
function drawCrop(c, sx, sy) { const C = CROPS[c.c], f = Math.min(1, c.age / C.days), ripe = c.age >= C.days, dry = c.dry > 0 && !c.w;
  const g = dry ? '#a8a04a' : '#4aa83c'; if (f < 0.3) { rect(sx + 7, sy + 9, 2, 3, g); rect(sx + 6, sy + 8, 1, 1, g); rect(sx + 9, sy + 8, 1, 1, g); }
  else if (!ripe) { rect(sx + 7, sy + 5, 2, 8, g); rect(sx + 4, sy + 6, 3, 2, g); rect(sx + 9, sy + 8, 3, 2, g); if (f > 0.7) rect(sx + 7, sy + 4, 2, 2, shade(C.col, -30)); }
  else { rect(sx + 7, sy + 4, 2, 9, g); rect(sx + 4, sy + 5, 3, 2, g); rect(sx + 9, sy + 7, 3, 2, g); rect(sx + 5, sy + 2, 6, 5, INK); rect(sx + 6, sy + 3, 4, 3, C.col); rect(sx + 6, sy + 3, 1, 1, '#ffffff'); }
}
function drawFire(x, y) { const t = G.clock * 12; for (let i = 0; i < 4; i++) { const h = 3 + ((Math.sin(t + i * 2) + 1) * 2 | 0); rect(x - 4 + i * 2, y - h, 2, h, i & 1 ? '#ffb030' : '#ff6a2a'); } rect(x - 1, y - 6 - ((Math.sin(t * 1.3) + 1) | 0), 2, 3, '#ffe890'); }
function drawTrader(o, sx, sy) { const look = survivorLook(hashS(o.id)); look.hat = '#c8a060'; drawStandee(personFrames(look), 0, sx + 8, sy + 14, 0, 0, 0, 1, Math.sin(G.clock * 0.7) > 0.6 ? 3 : 0); text('$', sx + 8, sy - 16, '#ffd76a', 'center'); }
// ---- buildings: cached 3/4 roof + south facade (original shingle/plaster/stone art)
const ROOF5 = [['#f0a070', '#d06040', '#a83c30', '#7a2828', '#4a1820'], ['#a0c0f0', '#6a8ad0', '#4a62a8', '#32427a', '#1e2650'], ['#b8b8c8', '#8a8aa0', '#686880', '#4a4a60', '#2c2c3e'],
  ['#d8b080', '#b0844e', '#86603a', '#5e4028', '#3a2618'], ['#a8d090', '#6aa860', '#4a8048', '#305a34', '#1c3a22'], ['#c8b0d8', '#9a80b0', '#745c8a', '#523e66', '#2e2240']];
const SHUT = ['#3a7a4a', '#3a5a9a', '#9a3a3a', '#7a5a2a'];
const ROOFC = new Map(); let ROOFS_VIS = [];
function roofImg(b) {
  let R = ROOFC.get(b.id); if (R) return R;
  if (ROOFC.size > 90) ROOFC.delete(ROOFC.keys().next().value);
  const W = b.w * TS, RW = W + 4, TOP = 14, H = b.h * TS + TOP, F = clamp(Math.round(b.h * TS * 0.36), 18, 26), RH = H - F, C = ROOF5[b.roof % ROOF5.length], hs = hashS(b.id);
  const [c, x] = mk(RW, H), p = (X, Y, w, h, col) => P(x, X, Y, w, h, col), q = (X, Y, col) => P(x, X, Y, 1, 1, col), D = '#120c18';
  const wins = [], ridge = Math.max(8, Math.round(RH * 0.3)), y0 = 4;
  // back slope
  for (let y = y0; y < ridge; y++) { const row = ((y - y0) / 3) | 0, ln = (y - y0) % 3; for (let X = 1; X < RW - 1; X++) { let col = ln === 2 ? C[2] : C[1]; if (ln < 2 && ((X + (row & 1) * 2) & 3) === 0) col = C[2]; else if (ln === 0 && ((X + (row & 1) * 2) & 3) === 1) col = C[0]; q(X, y, col); } }
  // ridge cap
  p(1, ridge, RW - 2, 1, C[0]); p(1, ridge + 1, RW - 2, 1, C[2]); for (let X = 3; X < RW - 3; X += 6) { q(X, ridge, '#ffffff'); q(X + 1, ridge + 1, C[3]); }
  // front slope: 4px shingle rows, darker toward the eave with ordered dither
  for (let y = ridge + 2; y < RH; y++) { const row = ((y - ridge - 2) / 4) | 0, ln = (y - ridge - 2) & 3, t = (y - ridge) / (RH - ridge);
    for (let X = 1; X < RW - 1; X++) { let k = 1 + t * 1.8 + (BAYER[y & 1][X & 1] / 4 - 0.4) * 0.8; if (ln === 3) k += (X & 1) ? 1.4 : 0.9; else if (((X + (row & 1) * 3) % 6) === 0) k += 1.2; else if (ln === 0 && ((X + (row & 1) * 3) % 6) === 1) k -= 1; q(X, y, C[clamp(Math.round(k), 0, 4)]); } }
  // gable edges / outline / eave
  p(0, y0, 1, RH - y0, D); p(RW - 1, y0, 1, RH - y0, D); p(0, y0 - 1, RW, 1, D); p(1, y0, 1, RH - y0, C[0]); p(RW - 2, y0, 1, RH - y0, C[4]);
  p(0, RH - 2, RW, 1, C[4]); p(0, RH - 1, RW, 1, D);
  // chimney on the back slope
  let chim = null; if (b.w >= 4 && hs % 3 !== 0) { const cx = RW - 12 - (hs % 5) * 2; chim = [cx + 3, 0]; const S5 = R5.brick || R5.stone;
    p(cx - 1, 0, 8, ridge - 1, D); p(cx, 1, 6, ridge - 2, S5[2]); for (let j = 2; j < ridge - 1; j += 3) { p(cx, j, 6, 1, S5[3]); q(cx + ((j / 3 & 1) ? 1 : 4), j + 1, S5[3]); } p(cx, 1, 1, ridge - 2, S5[1]); p(cx - 1, 0, 8, 2, R5.rock[3]); p(cx, 0, 6, 1, R5.rock[1]); }
  // facade
  const FX0 = 2, FY0 = RH, wall = b.wall, M = wall === T.WALLC ? R5.metal : wall === T.WALLW ? R5.plaster : R5.stone, log = b.kind === 'cabin' || b.kind === 'barn' || b.kind === 'shack';
  p(FX0 - 1, FY0, W + 2, F, D); p(FX0, FY0, W, F - 1, M[2]);
  for (let j = 0; j < F - 1; j++) for (let i = 0; i < W; i++) { const X = FX0 + i, Y = FY0 + j;
    if (log && wall !== T.WALLC) { const k = j % 4; q(X, Y, R5.timber[k === 0 ? 1 : k === 3 ? 4 : 2 + ((i * 3 + j) % 7 === 0 ? 1 : 0)]); }
    else if (wall === T.WALLC) q(X, Y, M[(i % 4) === 0 ? 1 : (i % 4) === 3 ? 3 : 2]);
    else if (wall === T.WALLW) { let k = 2; if ((i + j * 3 + hs) % 11 === 0) k = 1; if (((i + j) & 1) && j > F - 6) k = 3; q(X, Y, M[k]); }
    else { const row = (j / 5) | 0, ln = j % 5, off = (row & 1) * 5; let k = 2; if (ln === 4 || ((i + off) % 10) === 0) k = 4; else if (ln === 0 || ((i + off) % 10) === 1) k = 1; else if (((i * 7 + j * 3) % 13) === 0) k = 3; q(X, Y, M[k]); } }
  if (wall === T.WALLW && !log) { const Tm = R5.timber; p(FX0, FY0 + 2, W, 2, Tm[2]); p(FX0, FY0 + 2, W, 1, Tm[1]); for (let i = 0; i <= b.w; i++) { const X = FX0 + Math.min(W - 2, i * TS); p(X, FY0 + 2, 2, F - 3, Tm[3]); q(X, FY0 + 2, Tm[1]); } }
  p(FX0, FY0, W, 2, 'rgba(10,6,20,0.55)'); p(FX0, FY0 + F - 3, W, 2, R5.rock[3]); p(FX0, FY0 + F - 3, W, 1, R5.rock[2]);
  // door (south) + windows with shutters, flower boxes, lit glass
  const [ddx, ddy] = b.door, south = ddy === b.y + b.h - 1, dcol = ddx - b.x, sh = SHUT[hs % 4], WD5 = R5.plank;
  if (south) { const X = FX0 + dcol * TS + 2, Y = FY0 + 4, dh = F - 6;
    p(X - 1, Y - 1, 14, dh + 1, D); p(X, Y, 12, dh, WD5[2]); for (let i = 0; i < 12; i += 3) { p(X + i, Y, 1, dh, WD5[3]); q(X + i + 1, Y, WD5[1]); } p(X, Y, 12, 1, WD5[1]); p(X, Y + 3, 12, 1, WD5[4]); p(X, Y + dh - 4, 12, 1, WD5[4]); q(X + 9, Y + (dh >> 1), '#f0c850');
    p(X - 2, Y + dh, 16, 2, R5.slab ? R5.slab[2] : R5.rock[2]); p(X - 2, Y + dh, 16, 1, R5.rock[1]);
    p(X + 13, Y + 1, 2, 3, '#2a2028'); q(X + 13, Y + 2, '#ffe890'); q(X + 14, Y + 2, '#ffb040'); wins.push([X + 14, Y + 2, 1]); }
  for (let i = 0; i < b.w; i++) { if (south && Math.abs(i - dcol) < 1) continue; if (i === 0 || i === b.w - 1 ? b.w > 3 : false) continue; if (((i + hs) % 2) && b.w > 3) continue;
    const X = FX0 + i * TS + 3, Y = FY0 + 4, lit = hash2(i, hs & 255, 11) < 0.45, wh = Math.min(9, F - 10);
    p(X - 1, Y - 1, 12, wh + 2, D); p(X, Y, 10, wh, lit ? '#f8c860' : '#1c2440'); if (lit) { p(X, Y + wh - 3, 10, 3, '#e0903a'); p(X + 1, Y + 1, 3, 2, '#fff4c0'); } else { p(X + 1, Y + 1, 3, 2, '#4a6488'); q(X + 6, Y + 4, '#34486a'); }
    p(X + 4, Y, 2, wh, D); p(X, Y + (wh >> 1), 10, 1, D);
    if (b.w > 2) { p(X - 4, Y - 1, 3, wh + 2, sh); p(X + 11, Y - 1, 3, wh + 2, sh); for (let j = 0; j < wh + 2; j += 2) { p(X - 4, Y - 1 + j, 3, 1, shade(sh, -30)); p(X + 11, Y - 1 + j, 3, 1, shade(sh, -30)); } }
    if (wall === T.WALLW && b.kind !== 'barn') { p(X - 1, Y + wh + 1, 12, 2, WD5[3]); for (let k = 0; k < 5; k++) q(X + k * 2, Y + wh, ['#e85a7a', '#f0e070', '#ffffff', '#e85a7a', '#a070e0'][(k + hs) % 5]); }
    if (lit) wins.push([X + 5, Y + 4, 0]); }
  // barrels / crates by the door
  if (south && dcol > 0 && dcol < b.w - 1) { const bx = FX0 + dcol * TS - 7, by = FY0 + F - 10; p(bx - 1, by - 1, 8, 10, D); p(bx, by, 6, 8, WD5[2]); p(bx, by, 2, 8, WD5[1]); p(bx + 5, by, 1, 8, WD5[4]); p(bx, by + 2, 6, 1, R5.metal[3]); p(bx, by + 6, 6, 1, R5.metal[3]); p(bx + 1, by, 4, 1, WD5[0]);
    const kx = FX0 + (dcol + 1) * TS + 2, ky = FY0 + F - 9; if (hs & 1) { p(kx - 1, ky - 1, 9, 9, D); p(kx, ky, 7, 7, WD5[2]); p(kx, ky, 7, 1, WD5[0]); p(kx, ky + 3, 7, 1, WD5[3]); p(kx, ky, 1, 7, WD5[1]); for (let k = 0; k < 6; k++) q(kx + k, ky + 1 + k, WD5[3]); } }
  // other door markers
  if (ddy === b.y) { const X = FX0 + dcol * TS + 2; p(X - 1, 0, 14, 5, D); p(X, 1, 12, 3, WD5[2]); p(X, 1, 12, 1, WD5[1]); }
  else if (!south && ddx === b.x) { const Y = TOP + (ddy - b.y) * TS; p(0, Y + 2, 3, 12, D); p(1, Y + 3, 1, 10, WD5[1]); }
  else if (!south) { const Y = TOP + (ddy - b.y) * TS; p(RW - 3, Y + 2, 3, 12, D); p(RW - 2, Y + 3, 1, 10, WD5[2]); }
  // hanging shop sign on the front slope
  const lab = KIND_LABEL[b.kind]; if (lab && W > textW(lab) + 10) { const tw = textW(lab), gold = b.kind === 'trader', sx0 = Math.round(RW / 2 - tw / 2 - 4), sy0 = Math.round((ridge + RH) / 2 - 6);
    p(sx0 - 1, sy0 - 1, tw + 10, 13, D); p(sx0, sy0, tw + 8, 11, gold ? '#c89430' : WD5[2]); p(sx0, sy0, tw + 8, 1, gold ? '#fff0a0' : WD5[0]); p(sx0, sy0 + 10, tw + 8, 1, gold ? '#8a6020' : WD5[4]); p(sx0 + 1, sy0 + 1, tw + 6, 1, gold ? '#f0c850' : WD5[1]);
    q(sx0 + 2, sy0 + 2, '#d8d8e0'); q(sx0 + tw + 5, sy0 + 2, '#d8d8e0'); x.drawImage(textImg(lab, gold ? '#2a1a08' : '#fff4d8', !gold), Math.round(RW / 2 - tw / 2) - (gold ? 0 : 1), sy0 + 1 - (gold ? 0 : 1)); }
  R = { c, wins, chim, TOP }; ROOFC.set(b.id, R); return R;
}
function drawRoof(b) {
  const [sx, sy] = W2S(b.x, b.y), w = b.w * TS, R = roofImg(b), top = sy - R.TOP, bot = sy + b.h * TS;
  if (sx - 4 > N || sx + w + 4 < 0 || bot < 0 || top > N) return;
  hx.fillStyle = 'rgba(6,4,14,0.35)'; hx.fillRect(sx + 3, bot, w, 3); hx.fillRect(sx + w + 2, top + 8, 3, bot - top - 5);
  hx.drawImage(R.c, sx - 2, top); ROOFS_VIS.push([b, sx - 2, top, R]);
  if (R.chim) { for (let i = 0; i < 3; i++) { const t = (G.clock * 0.6 + i / 3) % 1, X = sx - 2 + R.chim[0] + Math.round(Math.sin(t * 6 + i) * 2 + t * 4), Y = top - Math.round(t * 18), s = 2 + Math.round(t * 3); hx.globalAlpha = 0.45 * (1 - t); rect(X - (s >> 1), Y - s, s, s, '#a8a0b8'); } hx.globalAlpha = 1; }
  if (G.looted['b' + b.id]) { rect(sx + 3, top + 6, 4, 4, '#120c18'); rect(sx + 4, top + 7, 2, 2, '#8af06a'); }
}
// interior rug under the room's centre (cosmetic)
const RUGC = {};
function drawRug(b) { if (b.w < 5 || b.h < 5) return; const rw = Math.min(5, b.w - 3) * TS - 4, rh = Math.min(3, b.h - 3) * TS - 4, key = rw + 'x' + rh + (hashS(b.id) % 3);
  if (!RUGC[key]) { const [c, x] = mk(rw, rh), pal = [['#a83040', '#6a1a2a', '#e8b850', '#3a1018'], ['#3a5aa8', '#22346a', '#e8d8a0', '#141c3a'], ['#4a7a3a', '#2a4a24', '#e8c870', '#14240e']][hashS(b.id) % 3];
    P(x, 0, 0, rw, rh, pal[3]); P(x, 1, 1, rw - 2, rh - 2, pal[2]); P(x, 3, 3, rw - 6, rh - 6, pal[0]);
    for (let j = 4; j < rh - 4; j++) for (let i = 4; i < rw - 4; i++) { const u = Math.abs(((i - 4) % 12) - 6) + Math.abs(((j - 4) % 10) - 5); if (u === 4) P(x, i, j, 1, 1, pal[2]); else if (u < 3 && ((i + j) & 1)) P(x, i, j, 1, 1, pal[1]); }
    for (let i = 2; i < rw - 2; i += 2) { P(x, i, 0, 1, 1, pal[2]); P(x, i, rh - 1, 1, 1, pal[2]); } RUGC[key] = c; }
  const [sx, sy] = W2S(b.x + b.w / 2, b.y + b.h / 2); hx.drawImage(RUGC[key], Math.round(sx - rw / 2), Math.round(sy - rh / 2)); }
function drawZombie(z) {
  const [sx, sy] = W2S(z.x, z.y);
  if (z.dead) { const a = Math.max(0, 1 - z.dt / 12); hx.globalAlpha = a; const im = propImg('deadz'); hx.drawImage(im, sx - im.width / 2, sy - im.height + 3); hx.globalAlpha = 1; return; }
  const S = personFrames(z.kind === 'fat' ? fatLook(z.look) : z.look), dir = dir4(z, z.fs);
  const fast = z.st === 'chase' || z.st === 'wave', mv = z.st !== 'lunge' && !z.held && !z.stun, fr = z.st === 'lunge' ? 3 : mv ? WALK4[((z.anim * (fast ? 9 : 4.5)) | 0) & 3] : 0;
  const shake = z.st === 'lunge' ? (Math.random() - 0.5) * 2 : 0, tilt = mv ? Math.sin(z.anim * 6) * 0.08 : z.stun > 0 ? -0.25 * z.face : 0;
  drawStandee(S, fr, sx + shake, sy, z.fs, 0, tilt, 1, dir);
  if (z.st === 'lunge') text('!', sx, sy - 34, '#ff4a3a', 'center');
  else if (z.st === 'chase' && (z.anim % 2) < 0.2) text('!', sx, sy - 34, '#ff8a6a', 'center');
}
const FATL = new WeakMap(); function fatLook(l) { let f = FATL.get(l); if (!f) { f = Object.assign({}, l, { fat: 1 }); FATL.set(l, f); } return f; }
function plDir() { const d = PL.dir || [0, 1]; return d[0] < 0 ? 2 : d[0] > 0 ? 3 : d[1] < 0 ? 1 : 0; }
function drawPlayer() {
  const [sx, sy] = W2S(PL.x, PL.y), S = personFrames(playerLook()), mv = PL.moving, sp = PL.sprint ? 15 : PL.sneak ? 6 : 9, dir = plDir();
  const fr = PL.swingT > 0 ? 3 : mv ? WALK4[((PL.anim * sp) | 0) & 3] : 0;
  const h = held(), drawHeld = () => { if (!h) return; const im = iconImg(h.id), sw = PL.swingT > 0 ? Math.sin(PL.swingT * 14) * 4 : 0, f = dir === 2 ? -1 : 1, ox = dir === 2 ? -7 : dir === 3 ? 7 : dir === 0 ? 7 : -7; hx.save(); hx.translate(sx + ox + f * sw, sy - 11); hx.scale(f, 1); hx.drawImage(im, -2, -im.height / 2); hx.restore(); };
  if (dir === 1) drawHeld();
  drawStandee(S, fr, sx, sy, PL.fs, 0, 0, PL.sneak ? 0.8 : 1, dir);
  if (dir !== 1) drawHeld();
  if (PL.flash > 0) { rect(sx + PL.dir[0] * 14 - 2, sy - 11 + PL.dir[1] * 10 - 2, 5, 5, '#fff2a0'); }
  if (PL.hurtT > 0) { hx.globalAlpha = PL.hurtT; rect(sx - 6, sy - 22, 12, 20, 'rgba(255,40,40,0.4)'); hx.globalAlpha = 1; }
  if ((PL.invuln || 0) > 0) { const a = 0.25 + 0.2 * Math.sin(G.totalT * 10); hx.globalAlpha = a; rect(sx - 8, sy - 24, 16, 24, '#8ad0ff'); hx.globalAlpha = 1; hx.strokeStyle = '#c8f0ff'; hx.lineWidth = 1; hx.strokeRect(sx - 8.5, sy - 24.5, 17, 25); }
}
function drawGhost() { const [tx, ty] = facingTile(), [sx, sy] = W2S(tx, ty), ok = canBuild(G.bsel) && !SOLID[tileAt(tx, ty)] && !BUILD.has(tkey(tx, ty));
  hx.globalAlpha = 0.6; const im = propImg(G.bsel); hx.drawImage(im, sx + 8 - im.width / 2, sy + 18 - im.height); hx.globalAlpha = 1;
  hx.strokeStyle = ok ? '#8af06a' : '#ff5a4a'; hx.strokeRect(sx + 0.5, sy + 0.5, 15, 15); }
// ---- night, dusk grade, rain
function drawLight() {
  const k = nightK(), L = lightC.x; const indoors = !!buildingAt(PL.x, PL.y);
  let a = k * 0.9 + (G.rain ? 0.14 : 0) + (OPT.dusk && k < 0.4 ? 0.08 : 0);
  if (indoors) a = Math.max(a, 0.55 + k * 0.25);
  if (G.sleeping && !G.wave) a = Math.max(a, 0.55);
  // dusk grade with subtle vertical gradient (sky darker at top)
  if (OPT.dusk) {
    const g = hx.createLinearGradient(0, 0, 0, N);
    g.addColorStop(0, 'rgba(40,22,78,0.30)'); g.addColorStop(0.5, 'rgba(90,40,90,0.12)'); g.addColorStop(1, 'rgba(190,80,30,0.16)');
    hx.fillStyle = g; hx.fillRect(0, 0, N, N);
    hx.fillStyle = 'rgba(180,90,40,0.06)'; hx.fillRect(0, 0, N, N);
  }
  hx.fillStyle = 'rgba(18,12,16,0.1)'; hx.fillRect(0, 0, N, N);
  // soft vignette for depth on phone screens
  {
    const vg = hx.createRadialGradient(N / 2, N / 2, N * 0.35, N / 2, N / 2, N * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,6,10,0.28)');
    hx.fillStyle = vg; hx.fillRect(0, 0, N, N);
  }
  if (a < 0.02) return;
  L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, N, N); L.fillStyle = `rgba(6,5,10,${a.toFixed(3)})`; L.fillRect(0, 0, N, N);
  L.globalCompositeOperation = 'destination-out';
  const hole = (wx, wy, r, s = 1) => {
    const [sx, sy] = W2S(wx, wy), R = r * TS;
    const g = L.createRadialGradient(sx, sy, R * 0.08, sx, sy, R);
    g.addColorStop(0, `rgba(0,0,0,${s})`);
    g.addColorStop(0.45, `rgba(0,0,0,${(s * 0.55).toFixed(2)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    L.fillStyle = g; L.fillRect(sx - R, sy - R, R * 2, R * 2);
  };
  hole(PL.x, PL.y - 0.5, PL.veh ? 3 : (indoors ? 2.4 : 3.2), indoors ? 0.95 : 0.8);
  // warm interior lamp pools from nearby furniture when indoors
  if (indoors) {
    const myB = buildingAt(PL.x, PL.y);
    if (myB) {
      const cx0 = Math.floor(myB.x / CH), cy0 = Math.floor(myB.y / CH);
      for (let cy = cy0; cy <= cy0 + 1; cy++) for (let cx = cx0; cx <= cx0 + 1; cx++) {
        if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) continue;
        for (const o of chunk(cx, cy).objs) {
          if (o.x < myB.x || o.y < myB.y || o.x >= myB.x + myB.w || o.y >= myB.y + myB.h) continue;
          if (o.k === 'fridge' || o.k === 'desk' || o.k === 'register' || o.k === 'medcab') hole(o.x + 0.5, o.y + 0.4, 1.6, 0.55);
          else if (o.k === 'shelf' || o.k === 'locker') hole(o.x + 0.5, o.y + 0.4, 1.2, 0.4);
        }
      }
    }
  }
  if (k > 0.2) for (const [, ox, oy, R] of ROOFS_VIS) for (const w of R.wins) { const X = ox + w[0], Y = oy + w[1], r = w[2] ? 18 : 22, g = L.createRadialGradient(X, Y, 1, X, Y, r); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(X - r, Y - r, r * 2, r * 2); }
  for (const b of BUILD.values()) if (b.k === 'campfire') hole(b.x + 0.5, b.y + 0.5, 5.5 + Math.sin(G.clock * 9) * 0.2, 1);
  if (PL.veh) { const v = VEHS.get(PL.veh); if (v && v.type !== 'bike') hole(v.x + Math.cos(v.ang) * 4, v.y + Math.sin(v.ang) * 4, 4, 0.9); }
  if (PL.flash > 0) hole(PL.x, PL.y, 6, 1);
  for (const f of FX) if (f.k === 'tracer') hole(f.x2, f.y2, 1.5, 0.6);
  hx.drawImage(lightC.c, 0, 0);
  // warm rim on light holes (subtle, phone-cheap — one full-screen pass already done)
  if (indoors || k > 0.3) {
    hx.globalCompositeOperation = 'lighter';
    hx.fillStyle = 'rgba(255,200,120,0.03)'; hx.fillRect(0, 0, N, N);
    hx.globalCompositeOperation = 'source-over';
  }
}
function drawRain() { if (!G.rain) return; hx.fillStyle = 'rgba(200,220,255,0.35)'; const t = G.clock; for (let i = 0; i < 70; i++) { const x = ((i * 53 + t * 140) % (N + 40)) - 20, y = ((i * 97 + t * 420) % (N + 20)) - 10; hx.fillRect(x | 0, y | 0, 1, 4); } }
// ---- minimap (real tiles, 1 px = 2 tiles) + world map (macro features, built progressively)
const MM = { c: null, x: null, t: 0, n: 0 };
const MCOL = {}; (() => { const m = { [T.GRASS]: '#3a6a2c', [T.TALL]: '#2e5a24', [T.FLOWER]: '#3a6a2c', [T.BUSH]: '#2a5e2c', [T.DIRT]: '#7a5a36', [T.SAND]: '#a89460', [T.WATER]: '#245870', [T.SEA]: '#1a3a58', [T.SHAL]: '#3a7088',
  [T.ROAD]: '#2e2c30', [T.LINE]: '#2e2c30', [T.SIDE]: '#6a6458', [T.GLASS]: '#6a6458', [T.WOOD]: '#6a4a2a', [T.TILE]: '#7a7468', [T.WALL]: '#5a281e', [T.WALLW]: '#4a3218', [T.WALLC]: '#3a4248', [T.DOOR]: '#8a6840',
  [T.TREE]: '#2c7230', [T.PINE]: '#20583a', [T.ROCK]: '#6a6058', [T.GRAVEL]: '#948878', [T.BRIDGE]: '#bf8b52', [T.FIELD]: '#b08e48', [T.CONC]: '#8e8c86', [T.FENCE]: '#7a5430', [T.MINE]: '#1a1418', [T.TILLED]: '#603e26' }; Object.assign(MCOL, m); })();
function drawMinimap(x, y, s) {
  if (!MM.c || MM.n !== s) { [MM.c, MM.x] = mk(s, s); MM.n = s; MM.t = 0; }
  MM.t -= 1 / 60; if (MM.t <= 0) { MM.t = 0.5; const img = MM.x.createImageData(s, s), d = img.data, px0 = Math.floor(PL.x) - s, py0 = Math.floor(PL.y) - s;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const wx = px0 + i * 2, wy = py0 + j * 2, cx = (wx / CH) | 0, cy = (wy / CH) | 0; const ck = CHUNKS.get(cy * NC + cx); let col = '#2a2430';
      if (ck && wx >= 0 && wy >= 0 && wx < WS && wy < WS) col = MCOL[ck.t[(wy % CH) * CH + (wx % CH)]] || '#5aa83c';
      const n = parseInt(col.slice(1), 16), o = (j * s + i) * 4; d[o] = n >> 16; d[o + 1] = n >> 8 & 255; d[o + 2] = n & 255; d[o + 3] = 255; }
    MM.x.putImageData(img, 0, 0); MM.cx = PL.x; MM.cy = PL.y; }
  winBox(x - 2, y - 2, s + 4, s + 4, 'blue'); hx.drawImage(MM.c, x, y); hx.strokeStyle = '#05061c'; hx.strokeRect(x - 0.5, y - 0.5, s + 1, s + 1);
  const m2 = (wx, wy) => [x + s / 2 + (wx - MM.cx) / 2, y + s / 2 + (wy - MM.cy) / 2];
  if (G.base) { const [bx, by] = m2(G.base.x, G.base.y); if (bx > x && by > y && bx < x + s && by < y + s) { rect(bx - 2, by - 2, 4, 4, INK); rect(bx - 1, by - 1, 2, 2, '#ffd76a'); } }
  for (const z of ZOMS) { if (z.dead) continue; const [zx, zy] = m2(z.x, z.y); if (z.st === 'chase' || z.st === 'wave') if (zx > x && zy > y && zx < x + s && zy < y + s) rect(zx, zy, 1, 1, '#ff4a3a'); }
  const [px, py] = m2(PL.x, PL.y); rect(px - 1, py - 1, 3, 3, INK); rect(px, py, 1, 1, '#ffffff');
}
const MAPI = { c: null, x: null, row: 0, img: null, S: 384 };
function mapCol(x, y) {
  if (x < 6 || y < 6 || x > WS - 6 || y > WS - 6) return '#245886';
  for (const S of WD.sets) { const d = Math.hypot(S.x - x, S.y - y); if (d < S.r * (S.kind === 'city' ? 0.95 : 0.85)) { if (WD.riverD(x, y) < 0) return '#3384c0'; return S.kind === 'city' ? (((x / 30 | 0) + (y / 30 | 0)) & 1 ? '#8e8c86' : '#a4a29c') : S.kind === 'farm' ? '#c8a65a' : S.kind === 'factory' ? '#6e6c66' : S.kind === 'mine' ? '#5e5648' : '#b4ad9e'; } }
  if (WD.riverD(x, y) < 0.5 || WD.lakeV(x, y) < 0.9) return '#3384c0';
  if (WD.roadD(x, y) < 3) return '#38363c';
  for (const r of WD.dirt) if (segDist(x, y, r.ax, r.ay, r.bx, r.by) < 2) return '#93693c';
  const e = WD.elev(x, y); if (e > 0.6) return '#6a6058'; if (e > 0.5) return '#948878';
  const f = WD.forest(x, y); return f > 0.6 ? (e > 0.38 ? '#20583a' : '#2c7230') : f > 0.55 ? '#3a8e3c' : '#5aa83c';
}
function buildMapRows(n) { const S = MAPI.S; if (!MAPI.c) { [MAPI.c, MAPI.x] = mk(S, S); MAPI.img = MAPI.x.createImageData(S, 1); MAPI.row = 0; }
  for (let k = 0; k < n && MAPI.row < S; k++) { const j = MAPI.row++, d = MAPI.img.data; for (let i = 0; i < S; i++) { const n2 = parseInt(mapCol(i * 8 + 4, j * 8 + 4).slice(1), 16); d[i * 4] = n2 >> 16; d[i * 4 + 1] = n2 >> 8 & 255; d[i * 4 + 2] = n2 & 255; d[i * 4 + 3] = 255; } MAPI.x.putImageData(MAPI.img, 0, j); } }
function markFog() { const cx = (PL.x / CH) | 0, cy = (PL.y / CH) | 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i, y = cy + j; if (x >= 0 && y >= 0 && x < NC && y < NC) G.fog[y * NC + x] = 1; } }
function drawMap() {
  rect(0, 0, N, N, '#1a1418'); const S = MAPI.S, z = G.mapZoom || 1, sz = Math.floor((N - 24) * z), ox = Math.round(N / 2 - sz * ((G.mapCX ?? PL.x) / WS)) , oy = Math.round((N - 14) / 2 + 7 - sz * ((G.mapCY ?? PL.y) / WS));
  const ox2 = z === 1 ? Math.round((N - sz) / 2) : ox, oy2 = z === 1 ? 16 : oy;
  hx.drawImage(MAPI.c, 0, 0, S, S, ox2, oy2, sz, sz);
  const cpx = sz / NC; hx.fillStyle = '#2a2230';
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) if (!G.fog[j * NC + i]) { let w = 1; while (i + w < NC && !G.fog[j * NC + i + w]) w++; hx.fillRect(Math.floor(ox2 + i * cpx), Math.floor(oy2 + j * cpx), Math.ceil(w * cpx), Math.ceil(cpx)); i += w - 1; }
  const m = (wx, wy) => [ox2 + wx / WS * sz, oy2 + wy / WS * sz];
  for (const s of WD.sets) { if (s.kind !== 'city' && s.kind !== 'town' && s.kind !== 'factory') continue; const k = ((s.y / CH) | 0) * NC + ((s.x / CH) | 0); if (!G.fog[k] && !G.seenNames[s.id]) continue; const [x, y] = m(s.x, s.y); text(s.name, x, y - 4, s.kind === 'city' ? '#ffd76a' : CREAM, 'center'); }
  if (G.base) { const [x, y] = m(G.base.x, G.base.y); rect(x - 3, y - 3, 6, 6, INK); rect(x - 2, y - 2, 4, 4, '#ffd76a'); }
  const [px, py] = m(PL.x, PL.y); if ((G.clock * 3 | 0) & 1) { rect(px - 2, py - 2, 5, 5, INK); rect(px - 1, py - 1, 3, 3, '#ffffff'); }
  panel(4, 3, N - 8, 11, CREAM, 1); text('MAP  ' + (z === 1 ? 'A: ZOOM' : 'A: ZOOM OUT  D-PAD: PAN') + '  B: CLOSE', N / 2, 3, INK, 'center', false);
  if (MAPI.row < S) text('CHARTING ' + ((MAPI.row / S * 100) | 0) + '%', N / 2, N - 12, CREAM, 'center');
}
// ---- the HUD
function bar(x, y, w, v, col, lab) { const f = Math.round(w * clamp(v, 0, 100) / 100), c2 = v < 20 && (G.clock * 4 | 0) & 1 ? '#ffffff' : col; rect(x - 1, y - 1, w + 2, 5, '#05061c'); rect(x, y, w, 3, '#1c2256'); rect(x, y + 2, w, 1, '#141a44'); rect(x, y, f, 3, c2); rect(x, y, f, 1, shade(c2, 60)); rect(x, y + 2, f, 1, shade(c2, -45)); text(lab, x - 9, y - 3, col, 'left'); }
function drawHUD() {
  const small = N < 200, bw = small ? 30 : 40;
  // stats
  panel(2, 2, bw + 14, 31, 'rgba(10,8,12,0.72)', 0);
  bar(13, 5, bw, PL.hp, '#ff5a5a', 'H'); bar(13, 12, bw, PL.sta, '#ffd76a', 'S'); bar(13, 19, bw, PL.hun, '#f0a040', 'F'); bar(13, 26, bw, PL.thi, '#6ac8ff', 'W');
  text('$' + G.money, 3, 35, '#ffd76a'); const w = invWeight(PL.inv), c = capKg(); text(w.toFixed(1) + '/' + c.toFixed(0) + 'KG', 3, 45, w > c ? '#ff6a5a' : CREAM);
  // minimap + clock
  const ms = small ? 40 : 52; drawMinimap(N - ms - 3, 3, ms);
  const hh = (G.time / 60) | 0, mm = (G.time % 60 | 0); const clock = String(hh).padStart(2, '0') + ':' + String(mm - mm % 10).padStart(2, '0');
  text(clock, N - 3, ms + 5, isNight() ? '#8ab0ff' : CREAM, 'right'); text('DAY ' + G.day, N - 3, ms + 15, '#ffd76a', 'right'); text(SEASONS[season()] + (G.rain ? ' RAIN' : ''), N - 3, ms + 25, '#c8e0a0', 'right');
  // hands + noise
  const hy = N - 22; for (let i = 0; i < 2; i++) { const s = PL.inv.hands[i], x = 3 + i * 18; panel(x, hy, 16, 16, i === 0 ? '#3a3040' : '#2a2430', 1); if (s) { hx.drawImage(iconImg(s.id), x + 1, hy + 1); if (s.n > 1) text(String(s.n), x + 17, hy + 7, CREAM, 'right'); } else if (i === 1 && twoHanded(PL.inv)) text('2H', x + 8, hy + 4, '#8a8090', 'center'); }
  const h = held(); if (h && IT[h.id].c === 'gun') text(String(countItem(PL.inv, IT[h.id].ammo)), 41, hy + 4, '#ffd76a');
  const nz = clamp(PL.noise / 30, 0, 1), nx = 3, ny = hy - 8; rect(nx - 1, ny - 1, 36, 5, INK); rect(nx, ny, 34, 3, '#3a3040'); rect(nx, ny, Math.round(34 * nz), 3, nz > 0.6 ? '#ff5a4a' : nz > 0.25 ? '#ffb040' : '#8af06a'); text(PL.sneak ? 'SNEAK' : PL.sprint && PL.moving ? 'SPRINT' : 'NOISE', nx + 37, ny - 3, PL.sneak ? '#a0c8ff' : CREAM);
  if (PL.veh) { const v = VEHS.get(PL.veh); if (v && v.type !== 'bike') { const S = VSPEC[v.type]; text('GAS ' + v.fuel.toFixed(1) + 'L', N - 3, N - 34, v.fuel < S.tank * 0.15 ? '#ff6a5a' : '#ffd76a', 'right'); } text(VSPEC[v.type].n, N - 3, N - 44, CREAM, 'right'); }
  // prompt
  if (G.prompt && !G.ui) { const t = G.prompt, tw = textW(t); panel(N / 2 - tw / 2 - 3, N - 20, tw + 6, 13, '#ffd76a', 1); text(t, N / 2, N - 18, INK, 'center', false); }
  if (G.chan) { const f = G.chan.t / G.chan.max; panel(N / 2 - 30, N / 2 + 16, 60, 6, INK, 1); rect(N / 2 - 29, N / 2 + 17, Math.round(58 * f), 4, '#ffd76a'); text(G.chan.lab, N / 2, N / 2 + 24, CREAM, 'center'); }
  // messages
  let my = small ? 50 : 58; for (const m of G.msgs) { const s = fitText(m.s, N - 8); hx.globalAlpha = Math.min(1, m.t * 2); text(s, N / 2, my, m.col, 'center'); hx.globalAlpha = 1; my += 10; }
  if (G.wave && G.wave.live) { const left = G.wave.total - G.wave.killed; panel(N / 2 - 36, 3, 72, 12, '#ff5a4a', 1); text('WAVE ' + left + ' LEFT', N / 2, 4, INK, 'center', false); }
  if (G.ui === 'build') { const d = BDEF[G.bsel]; const t = d.n + '  A: PLACE  B: DONE'; const tw = textW(t); panel(N / 2 - tw / 2 - 3, N - 20, tw + 6, 13, '#8af06a', 1); text(t, N / 2, N - 18, INK, 'center', false); }
}
// ================================================================ audio: everything synthesized with WebAudio (no samples)
const SFX_ON = { v: true }; let AC = null, MASTER = null, SFXG = null, MUSG = null, AMBG = null, NBUF = null, MUTED = false, POWER = true;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  MASTER = AC.createGain(); MASTER.gain.value = MUTED ? 0 : 0.8; MASTER.connect(AC.destination);
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.connect(MASTER);
  SFXG = AC.createGain(); SFXG.gain.value = OPT.sfx ? 0.9 : 0; SFXG.connect(comp);
  MUSG = AC.createGain(); MUSG.gain.value = OPT.music ? 0.22 : 0; MUSG.connect(comp);
  AMBG = AC.createGain(); AMBG.gain.value = OPT.sfx ? 0.5 : 0; AMBG.connect(comp);
  NBUF = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate); const d = NBUF.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ambInit();
}
function audioLevels() { if (!AC) return; const t = AC.currentTime; MASTER.gain.setTargetAtTime(MUTED || !POWER ? 0 : 0.8, t, 0.05); SFXG.gain.setTargetAtTime(OPT.sfx ? 0.9 : 0, t, 0.05); AMBG.gain.setTargetAtTime(OPT.sfx ? 0.5 : 0, t, 0.05); MUSG.gain.setTargetAtTime(OPT.music ? 0.22 : 0, t, 0.05); }
addEventListener('handheld:mute', (e) => { MUTED = !!(e.detail && e.detail.muted); audioLevels(); });
addEventListener('handheld:power', (e) => { POWER = !(e.detail && e.detail.on === false); audioLevels(); if (typeof onHandheldPower === 'function') onHandheldPower(POWER); });
document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); });
function tone(type, f0, f1, dur, vol, dl = 0, out = SFXG) { const t = AC.currentTime + dl, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
function nz(dur, vol, ft, f0, f1, q = 1, dl = 0, out = SFXG) { const t = AC.currentTime + dl, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NBUF; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  f.type = ft; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); }
const rnd = (a, b) => a + Math.random() * (b - a);
const SND = {
  // feet
  step_grass: (v) => nz(0.07, 0.16 * v, 'lowpass', 900, 400, 0.7), step_dirt: (v) => { nz(0.06, 0.2 * v, 'lowpass', 600, 250); tone('sine', 90, 60, 0.05, 0.08 * v); },
  step_wood: (v) => { tone('triangle', rnd(140, 170), 90, 0.07, 0.22 * v); nz(0.03, 0.08 * v, 'bandpass', 1800, 1800, 2); }, step_hard: (v) => { nz(0.035, 0.18 * v, 'highpass', 1800, 1800); tone('sine', 120, 80, 0.03, 0.07 * v); },
  step_tile: (v) => { nz(0.03, 0.2 * v, 'bandpass', 3000, 2500, 3); tone('sine', 900, 700, 0.02, 0.04 * v); },
  step_gravel: (v) => { for (let i = 0; i < 3; i++) nz(0.03, 0.14 * v, 'bandpass', rnd(2500, 4500), 2000, 2, i * 0.018); },
  step_water: (v) => { nz(0.16, 0.22 * v, 'bandpass', 1200, 500, 1.5); tone('sine', rnd(500, 700), 300, 0.08, 0.05 * v, 0.03); },
  step_glass: (v) => { nz(0.05, 0.22 * v, 'highpass', 4000, 4000); for (let i = 0; i < 2; i++) tone('sine', rnd(3200, 5200), rnd(2500, 4000), 0.06, 0.06 * v, i * 0.02); },
  // zombies
  groan: (v) => { const f = rnd(80, 120); tone('sawtooth', f, f * 0.7, 0.7, 0.07 * v); nz(0.6, 0.05 * v, 'bandpass', 500, 300, 4); },
  lunge: (v) => { tone('sawtooth', 220, 110, 0.3, 0.14 * v); nz(0.3, 0.12 * v, 'bandpass', 900, 600, 3); },
  bite: (v) => { nz(0.25, 0.5 * v, 'lowpass', 2500, 300); tone('square', 160, 50, 0.4, 0.2 * v); },
  zdie: (v) => { tone('sawtooth', 140, 40, 0.5, 0.12 * v); nz(0.2, 0.2 * v, 'lowpass', 900, 200, 1, 0.05); },
  scream: (v) => { tone('sawtooth', 700, 300, 0.6, 0.12 * v); tone('square', 520, 260, 0.6, 0.05 * v); },
  horde: (v) => { for (let i = 0; i < 5; i++) tone('sawtooth', rnd(70, 110), rnd(50, 70), 1.4, 0.05 * v, i * 0.15); nz(1.6, 0.06 * v, 'bandpass', 300, 200, 2); },
  // combat
  swing: (v) => nz(0.12, 0.18 * v, 'bandpass', 600, 2200, 1.5), punch: (v) => { nz(0.06, 0.2 * v, 'lowpass', 800, 300); tone('sine', 110, 60, 0.07, 0.15 * v); },
  hit: (v) => { nz(0.08, 0.35 * v, 'lowpass', 1400, 300); tone('square', 90, 50, 0.08, 0.12 * v); }, click: (v) => tone('square', 1800, 1700, 0.02, 0.08 * v),
  pistol: (v) => { nz(0.18, 0.7 * v, 'lowpass', 5000, 300); tone('square', 160, 50, 0.1, 0.3 * v); }, shotgun: (v) => { nz(0.4, 0.9 * v, 'lowpass', 3500, 150); tone('square', 90, 35, 0.25, 0.4 * v); },
  rifle: (v) => { nz(0.3, 0.8 * v, 'lowpass', 6000, 250); tone('sawtooth', 220, 40, 0.15, 0.3 * v); nz(0.5, 0.1 * v, 'bandpass', 800, 300, 1, 0.08); },
  // building + traps
  thud: (v) => { tone('sine', 90, 45, 0.18, 0.35 * v); nz(0.1, 0.18 * v, 'lowpass', 600, 200); }, clang: (v) => { tone('square', 420, 400, 0.25, 0.08 * v); tone('sine', 1260, 1200, 0.3, 0.06 * v); nz(0.05, 0.2 * v, 'highpass', 2000, 2000); },
  break: (v) => { for (let i = 0; i < 4; i++) nz(0.12, 0.3 * v, 'bandpass', rnd(400, 1600), 300, 1.5, i * 0.05); tone('sine', 80, 40, 0.3, 0.3 * v); },
  spike: (v) => { nz(0.08, 0.3 * v, 'bandpass', 1500, 600, 2); tone('sawtooth', 160, 80, 0.2, 0.1 * v); }, snap: (v) => { tone('square', 900, 200, 0.06, 0.3 * v); nz(0.08, 0.3 * v, 'highpass', 2500, 2500); tone('sine', 600, 580, 0.3, 0.06 * v, 0.05); },
  build: (v) => { for (let i = 0; i < 3; i++) { tone('triangle', rnd(180, 240), 120, 0.06, 0.25 * v, i * 0.11); nz(0.04, 0.15 * v, 'bandpass', 2500, 2500, 2, i * 0.11); } },
  till: (v) => { nz(0.12, 0.3 * v, 'lowpass', 900, 250); tone('sine', 100, 60, 0.1, 0.15 * v); }, plant: (v) => { nz(0.06, 0.15 * v, 'lowpass', 1200, 500); tone('sine', 600, 900, 0.08, 0.06 * v, 0.05); },
  water: (v) => { for (let i = 0; i < 4; i++) nz(0.12, 0.12 * v, 'bandpass', rnd(1200, 2400), 900, 2, i * 0.06); }, harvest: (v) => { nz(0.08, 0.2 * v, 'lowpass', 1500, 400); tone('square', 660, 660, 0.06, 0.06 * v, 0.06); tone('square', 990, 990, 0.08, 0.06 * v, 0.12); },
  chop: (v) => { tone('triangle', 200, 120, 0.08, 0.35 * v); nz(0.08, 0.3 * v, 'bandpass', 1400, 600, 2); }, treefall: (v) => { for (let i = 0; i < 6; i++) nz(0.15, 0.2 * v, 'bandpass', rnd(300, 900), 200, 1, i * 0.07); tone('sine', 70, 35, 0.6, 0.35 * v, 0.4); },
  pry: (v) => { tone('sawtooth', 300, 500, 0.3, 0.08 * v); tone('square', 120, 90, 0.1, 0.2 * v, 0.3); nz(0.1, 0.25 * v, 'highpass', 2000, 2000, 1, 0.3); },
  dig: (v) => { nz(0.15, 0.3 * v, 'lowpass', 700, 200); tone('square', 600, 580, 0.05, 0.08 * v, 0.03); },
  // vehicles
  sputter: (v) => { for (let i = 0; i < 4; i++) tone('sawtooth', 60, 40, 0.08, 0.15 * v, i * 0.14); }, crash: (v) => { nz(0.4, 0.6 * v, 'lowpass', 3000, 200); tone('square', 80, 40, 0.3, 0.25 * v); for (let i = 0; i < 3; i++) tone('sine', rnd(1500, 3000), 1200, 0.15, 0.05 * v, 0.05 + i * 0.04); },
  start: (v) => { for (let i = 0; i < 3; i++) tone('sawtooth', 50 + i * 15, 70 + i * 15, 0.12, 0.15 * v, i * 0.13); }, door: (v) => { tone('triangle', 160, 120, 0.1, 0.2 * v); nz(0.12, 0.08 * v, 'bandpass', 900, 600, 4); }, bell: (v) => { tone('sine', 1200, 1200, 0.4, 0.1 * v); tone('sine', 1800, 1800, 0.3, 0.05 * v); },
  // looting + items
  open: (v) => { tone('triangle', 260, 200, 0.08, 0.15 * v); nz(0.15, 0.1 * v, 'bandpass', 1200, 700, 2, 0.04); }, loot: (v) => { nz(0.1, 0.15 * v, 'bandpass', 2000, 1000, 1.5); tone('sine', 520, 520, 0.05, 0.06 * v, 0.05); },
  pickup: (v) => { tone('square', 520, 520, 0.04, 0.06 * v); tone('square', 780, 780, 0.05, 0.06 * v, 0.05); }, coin: (v) => { tone('square', 990, 990, 0.05, 0.07 * v); tone('square', 1320, 1320, 0.12, 0.07 * v, 0.06); },
  eat: (v) => { for (let i = 0; i < 3; i++) nz(0.05, 0.18 * v, 'bandpass', rnd(800, 1600), 600, 2, i * 0.09); }, drink: (v) => { for (let i = 0; i < 3; i++) tone('sine', rnd(300, 450), 200, 0.08, 0.1 * v, i * 0.12); },
  fish: (v) => { nz(0.25, 0.25 * v, 'bandpass', 1400, 400, 1.2); tone('square', 660, 880, 0.1, 0.06 * v, 0.1); }, splash: (v) => nz(0.3, 0.2 * v, 'bandpass', 1300, 400, 1),
  // ui
  ui: (v) => tone('square', 660, 660, 0.03, 0.05 * v), uiok: (v) => { tone('square', 660, 660, 0.04, 0.06 * v); tone('square', 990, 990, 0.06, 0.06 * v, 0.04); }, back: (v) => tone('square', 440, 330, 0.06, 0.05 * v),
  deny: (v) => { tone('square', 200, 200, 0.08, 0.07 * v); tone('square', 150, 150, 0.1, 0.07 * v, 0.08); }, join: (v) => { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.12, 0.06 * v, i * 0.09)); },
  sleep: (v) => { [523, 440, 349, 262].forEach((f, i) => tone('triangle', f, f, 0.4, 0.08 * v, i * 0.25)); }, morning: (v) => { [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.35, 0.08 * v, i * 0.16)); },
  death: (v) => { [330, 262, 220, 165].forEach((f, i) => tone('square', f, f * 0.98, 0.45, 0.08 * v, i * 0.35)); nz(1.5, 0.08 * v, 'lowpass', 600, 100, 1, 0.2); },
};
function sfx(name, x, y) {
  if (!AC || !SFX_ON.v || !SND[name]) return; let v = 1;
  if (x !== undefined && PL) { const d = Math.hypot(x - PL.x, y - PL.y); if (G.sleeping && G.base) { v = 1 - Math.hypot(x - G.base.x, y - G.base.y) / 26; } else v = 1 - d / 20; if (v <= 0.03) return; }
  if (SND[name].last && AC.currentTime - SND[name].last < 0.03) return; SND[name].last = AC.currentTime;
  try { SND[name](v); } catch (e) { }
}
// ---- engines (one continuous voice for the vehicle you drive)
let ENG = null;
function engineUpdate() {
  if (!AC) return; const v = PL && PL.veh ? VEHS.get(PL.veh) : null, on = v && v.type !== 'bike' && v.fuel > 0 && !PL.dead;
  if (on && !ENG) { const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(SFXG); o.start(); o2.start(); ENG = { o, o2, g, f }; }
  if (!ENG) return; const t = AC.currentTime;
  if (!on) { ENG.g.gain.setTargetAtTime(0, t, 0.08); if (ENG.g.gain.value < 0.005) { ENG.o.stop(); ENG.o2.stop(); ENG = null; } return; }
  const k = Math.abs(v.spd || 0) / VSPEC[v.type].max, base = v.type === 'moto' ? 70 : 45; ENG.o.frequency.setTargetAtTime(base + k * base * 2.2, t, 0.05); ENG.o2.frequency.setTargetAtTime((base + k * base * 2.2) * 0.502, t, 0.05); ENG.g.gain.setTargetAtTime(0.05 + k * 0.05, t, 0.05); ENG.f.frequency.setTargetAtTime(500 + k * 1500, t, 0.05);
}
// ---- ambience: wind by day, crickets at night, rain; birds now and then
let AMB = null;
function ambInit() { const mk2 = (ft, f, q) => { const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NBUF; s.loop = true; fl.type = ft; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(AMBG); s.start(); return { g, fl }; };
  AMB = { wind: mk2('bandpass', 400, 0.6), rain: mk2('highpass', 1500, 0.5), bird: 0, cr: 0 }; }
function ambUpdate(dt) {
  if (!AC || !AMB || !G) return; const t = AC.currentTime, n = nightK(), inside = PL && buildingAt(PL.x, PL.y);
  AMB.wind.g.gain.setTargetAtTime((inside ? 0.04 : 0.12) * (1 - n * 0.4) + (season() === 3 ? 0.08 : 0), t, 0.5); AMB.wind.fl.frequency.setTargetAtTime(300 + Math.sin(G.clock * 0.3) * 120, t, 0.5);
  AMB.rain.g.gain.setTargetAtTime(G.rain ? (inside ? 0.08 : 0.22) : 0, t, 0.5);
  AMB.bird -= dt; if (AMB.bird <= 0 && n < 0.3 && !G.rain && season() !== 3) { AMB.bird = rnd(2, 7); const f = rnd(2200, 3800); for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone('sine', f, f * rnd(0.8, 1.3), 0.07, 0.03, i * 0.1, AMBG); }
  AMB.cr -= dt; if (AMB.cr <= 0 && n > 0.6 && season() !== 3) { AMB.cr = rnd(0.6, 1.6); for (let i = 0; i < 4; i++) tone('square', 4400, 4400, 0.02, 0.012, i * 0.05, AMBG); }
}
// ---- music: a slow, lonely pentatonic melody over a drone; tense when a wave is on
let MUS = { t: 0, i: 0 };
const SCALE = [0, 3, 5, 7, 10, 12, 15];
function musicUpdate(dt) {
  if (!AC || !OPT.music) return; MUS.t -= dt; if (MUS.t > 0) return; const tense = G && G.wave && !G.wave.headless, root = tense ? 110 : (G && isNight() ? 98 : 131);
  MUS.t = tense ? 0.42 : 0.9; MUS.i++;
  if (MUS.i % 8 === 0) { tone('triangle', root / 2, root / 2, MUS.t * 7, 0.09, 0, MUSG); tone('sine', root * 0.75, root * 0.75, MUS.t * 7, 0.04, 0, MUSG); }
  if (Math.random() < (tense ? 0.75 : 0.45)) { const st = SCALE[(Math.random() * SCALE.length) | 0], f = root * 2 * Math.pow(2, st / 12); tone(tense ? 'square' : 'triangle', f, f, MUS.t * 1.6, tense ? 0.035 : 0.05, 0, MUSG); }
  if (tense && MUS.i % 2 === 0) nz(0.05, 0.08, 'lowpass', 300, 100, 1, 0, MUSG);
}
// ================================================================ interaction, player, recruits, npcs
function facingTile() { return [Math.floor(PL.x + PL.dir[0] * 0.8), Math.floor(PL.y - 0.15 + PL.dir[1] * 0.8)]; }
function pumpFuel(o) { return G.pumps[o.id] ?? o.fuel; }
function nearObjs(r) { const out = [], cx = (PL.x / CH) | 0, cy = (PL.y / CH) | 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const x = cx + i, y = cy + j; if (x < 0 || y < 0 || x >= NC || y >= NC) continue; for (const o of chunk(x, y).objs) { const d = Math.hypot(o.x + 0.5 - PL.x, o.y + 0.7 - PL.y); if (d < r) out.push([o, d]); } } return out; }
const PROP_NAME = { fridge: 'FRIDGE', cabinet: 'CABINET', dresser: 'DRESSER', desk: 'DESK', register: 'TILL', medcab: 'MED CABINET', rack: 'CLOTHES RACK', locker: 'LOCKER', gunsafe: 'GUN SAFE', safe: 'SAFE', toolbox: 'TOOLBOX', crate: 'CRATE', seedbox: 'SEED BOX', gascan: 'JERRY CANS', orecart: 'ORE CART', shelf: 'SHELF' };
function heldId() { const h = held(); return h ? h.id : null; }
function gasCan() { for (const s of allSlots(PL.inv)) { const it = s.a[s.i]; if (it && it.id === 'gascan') return it; } return null; }
function zombieInFront() { for (const z of ZOMS) { if (z.dead) continue; const dx = z.x - PL.x, dy = z.y - PL.y, d = Math.hypot(dx, dy); if (d < 1.7 && (d < 0.6 || (dx * PL.dir[0] + dy * PL.dir[1]) / d > 0.2)) return true; } return false; }
function findInteract() {
  if (PL.veh) { const v = VEHS.get(PL.veh); return { lab: v.type === 'car' ? 'GET OUT' : 'GET OFF', fn: exitVeh }; }
  if (zombieInFront() && held()) return null;
  const C = [], add = (d, lab, fn) => C.push({ d, lab, fn });
  for (const n of NPCS.values()) { const d = Math.hypot(n.x - PL.x, n.y - PL.y); if (d < 1.6) add(d - 0.3, 'TALK TO ' + n.name, () => openTalk(n)); }
  for (const r of G.recruits) { const d = Math.hypot(r.x - PL.x, r.y - PL.y); if (d < 1.3) add(d, r.name + ' (' + r.job.toUpperCase() + ')', () => { G.ui = 'menu'; G.tab = 2; G.sel = 1 + G.recruits.indexOf(r); sfx('ui'); }); }
  for (const [o, d] of nearObjs(1.4)) {
    if (o.k === 'trader') add(d - 0.3, 'TRADE', () => openShop(o));
    else if (o.k === 'pump') add(d, pumpFuel(o) > 0 ? 'PUMP GAS (' + pumpFuel(o).toFixed(0) + 'L)' : 'PUMP IS DRY', () => usePump(o));
    else if (o.k === 'mine') add(d, 'MINE ORE', () => mineOre(o));
    else { const nm = PROP_NAME[o.k] || o.k.toUpperCase(), L = G.looted[o.id];
      const lab = L ? ('STOCKPILE ' + nm) : (o.lock ? 'PRY OPEN ' + nm : 'SEARCH ' + nm);
      add(d, lab, () => searchObj(o)); }
  }
  for (const b of BUILD.values()) { const d = Math.hypot(b.x + 0.5 - PL.x, b.y + 0.6 - PL.y); if (d > 1.3) continue;
    if (b.k === 'chest') add(d, 'OPEN CHEST', () => openLoot('CHEST', b.items = b.items || [], 'stash'));
    else if (b.k === 'workbench' || b.k === 'anvil' || b.k === 'forge') add(d, 'CRAFT (' + BDEF[b.k].n + ')', () => openCraft(b.k));
    else if (b.k === 'campfire') add(d, 'COOK / CRAFT', () => { G.ui = 'list'; G.list = { title: 'CAMPFIRE', items: [{ t: 'COOK FOOD', fn: () => { G.ui = 'cook'; G.sel = 0; } }, { t: 'CRAFT HERE', fn: () => openCraft('campfire') }, { t: 'LEAVE', fn: () => { G.ui = null; } }] }; G.sel = 0; sfx('ui'); });
    else if (b.k === 'barrel') add(d, b.wt > 0 ? 'DRINK RAINWATER (' + b.wt + ')' : 'BARREL EMPTY', () => { if (b.wt > 0) { const can = PL.inv.hands.find((s) => s && s.id === 'wcan'); if (can && (can.q || 0) < IT.wcan.cap) { can.q = IT.wcan.cap; b.wt--; sfx('water'); msg('CAN FILLED'); } else { b.wt--; PL.thi = Math.min(100, PL.thi + 40); sfx('drink'); } } });
    else if (b.k === 'turret') add(d, 'TURRET: ' + (b.ammo || 0) + ' ROUNDS' + (countItem(PL.inv, 'a9') ? ' (LOAD)' : ''), () => { const n = Math.min(60 - (b.ammo || 0), countItem(PL.inv, 'a9')); if (n > 0) { takeItem(PL.inv, 'a9', n); b.ammo = (b.ammo || 0) + n; sfx('click'); msg('LOADED ' + n + ' ROUNDS'); } else msg('NEEDS 9MM ROUNDS'); });
  }
  if (G.base) { const d = Math.hypot(G.base.x + 0.5 - PL.x, G.base.y + 0.6 - PL.y); if (d < 1.3) add(d, 'SLEEP', trySleep); }
  if (G.drops) for (const dr of G.drops) { const d = Math.hypot(dr.x - PL.x, dr.y - PL.y); if (d < 1.0) add(d - 0.2, 'PICK UP ' + IT[dr.id].n + (dr.n > 1 ? ' x' + dr.n : ''), () => pickDrop(dr)); }
  const v = vehicleNear(PL.x, PL.y, 1.6); if (v) add(Math.hypot(v.x - PL.x, v.y - PL.y), VSPEC[v.type].n + (v.ok ? '' : ' (BROKEN)'), () => openVeh(v));
  // things the held tool does to the tile you face
  const [tx, ty] = facingTile(), t = tileAt(tx, ty), h = heldId(), k = tkey(tx, ty), crop = G.crops[k];
  if (crop && crop.age >= CROPS[crop.c].days) add(0.5, 'HARVEST ' + IT[crop.c].n, () => { const n = harvest(k); sfx('harvest', tx, ty); msg('+' + n + ' ' + IT[crop.c].n, '#8af06a'); });
  if (h === 'hoe' && TILLABLE.has(t) && !BUILD.has(k) && !G.crops[k]) add(0.8, 'TILL SOIL', () => { if (PL.sta < 6) { msg('TOO TIRED'); return; } PL.sta -= 6; PL.swingT = 0.2; setTile(tx, ty, T.TILLED); sfx('till', tx, ty); puff(tx + 0.5, ty + 0.5, PAL.dirt[1], 5); PL.strXP += 0.2; });
  if (h && h.startsWith('s_') && t === T.TILLED && !crop) { const c = h.slice(2), C = CROPS[c]; add(0.8, 'PLANT ' + IT[c].n + (C.seas.includes(season()) ? '' : ' (WRONG SEASON)'), () => { if (!C.seas.includes(season())) { msg(IT[c].n + ' GROWS IN ' + C.seas.map((s) => SEASONS[s]).join('/'), '#ff8a6a'); sfx('deny'); return; } takeItem(PL.inv, h, 1); G.crops[k] = { c, age: 0, w: G.rain ? 1 : 0, dry: 0 }; sfx('plant', tx, ty); }); }
  if (h === 'wcan') { const can = held(); if (t === T.WATER || t === T.SHAL || t === T.SEA) add(0.8, 'FILL CAN', () => { can.q = IT.wcan.cap; sfx('water', tx, ty); });
    else if (t === T.TILLED) add(0.8, 'WATER (' + (can.q || 0) + ')', () => { if (!(can.q > 0)) { msg('THE CAN IS EMPTY. FILL IT AT WATER'); sfx('deny'); return; } can.q--; let n = 0; for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const c2 = G.crops[tkey(tx + i, ty + j)]; if (c2 && (i === 0 && j === 0 || n < 2)) { c2.w = 1; n++; } } if (crop) crop.w = 1; sfx('water', tx, ty); puff(tx + 0.5, ty + 0.4, '#8ed8ff', 6); }); }
  if (h === 'axe' && (t === T.TREE || t === T.PINE)) add(0.8, 'CHOP TREE', () => chop(tx, ty));
  if (h === 'rod' && (t === T.WATER || t === T.SHAL || t === T.SEA)) add(0.8, 'FISH', () => channel(3.5, 'FISHING', () => { if (Math.random() < 0.55) { const l = addItem(PL.inv, 'fish', 1); if (l) dropItem('fish', 1, PL.x, PL.y); sfx('fish'); msg('CAUGHT A FISH!', '#8af06a'); } else { sfx('splash'); msg('NOTHING BITES'); } }, 1));
  if (h === 'bedroll' && !G.base) add(0.7, 'MAKE CAMP HERE', () => makeCamp());
  if (!h && (t === T.WATER || t === T.SHAL) && PL.thi < 98) add(1.0, 'DRINK (DIRTY)', () => { PL.thi = Math.min(100, PL.thi + 22); sfx('drink'); if (Math.random() < 0.3) { hurtP(8, 'DYSENTERY'); msg('YOUR STOMACH TURNS...', '#ff8a6a'); } });
  if (!C.length) return null; C.sort((a, b) => a.d - b.d); return C[0];
}
function makeCamp() { const x = Math.floor(PL.x), y = Math.floor(PL.y); if (SOLID[tileAt(x, y)] || tileAt(x, y) === T.SHAL || BUILD.has(tkey(x, y))) { msg('CANT CAMP HERE'); return; }
  for (const s of WD.sets) if (s.kind === 'city' && Math.hypot(s.x - x, s.y - y) < s.r * 0.7) { msg('TOO DANGEROUS IN THE CITY', '#ff8a6a'); return; }
  foundBase(x, y); G.saveDirty = true; }
function channel(sec, lab, fn, nz2) { G.chan = { t: 0, max: sec, lab, fn, nz: nz2 || 0, x: PL.x, y: PL.y }; }
function updateChan(dt) { const c = G.chan; if (!c) return; if (Math.hypot(PL.x - c.x, PL.y - c.y) > 0.15 || G.ui) { G.chan = null; msg('INTERRUPTED'); return; } c.t += dt; if (c.nz) { c.nT = (c.nT || 0) - dt; if (c.nT <= 0) { c.nT = 0.7; noise(PL.x, PL.y, c.nz, 'work'); } } if (c.t >= c.max) { G.chan = null; c.fn(); } }
function chop(tx, ty) { if (PL.cd > 0) return; if (PL.sta < 10) { msg('TOO TIRED'); return; } PL.sta -= 10; PL.cd = 0.6; PL.swingT = 0.22; const k = tkey(tx, ty); if (!G.chop || G.chop.k !== k) G.chop = { k, n: 0, sh: 0 }; G.chop.n++; G.chop.sh = 2; sfx('chop', tx, ty); noise(tx, ty, 7, 'chop'); PL.strXP += 0.4; puff(tx + 0.5, ty + 0.3, PAL.wood[1], 4);
  if (G.chop.n >= 4) { setTile(tx, ty, T.GRASS); G.chop = null; sfx('treefall', tx, ty); const l = addItem(PL.inv, 'plank', 2); if (l) dropItem('plank', l, tx + 0.5, ty + 0.5); msg('+2 PLANKS', '#8af06a'); } }
function searchObj(o) {
  const L = G.looted[o.id]; if (L) { openLoot('STOCKPILE', L, 'stash'); return; }
  const open = () => { const r = rollLoot(o); G.looted[o.id] = r.items; if (r.money) { G.money += r.money; sfx('coin'); msg('+$' + r.money, '#ffd76a'); } sfx('open', o.x, o.y); if (r.items.length) openLoot(PROP_NAME[o.k] || 'BOX', r.items, 'stash'); else { msg('EMPTY — YOU CAN STOCKPILE HERE', '#8af06a'); openLoot('STOCKPILE', G.looted[o.id], 'stash'); } G.saveDirty = true; };
  if (o.lock) { const h = PL.inv.hands.find((s) => s && IT[s.id].pry); if (!h) { msg('LOCKED. A CROWBAR COULD PRY IT', '#ff8a6a'); sfx('deny'); return; } channel(2.5, 'PRYING', () => { sfx('pry', o.x, o.y); open(); }, 11); return; }
  channel(o.k === 'shelf' ? 0.5 : 0.8, 'SEARCHING', open, 2); sfx('open', o.x, o.y);
}
function pickDrop(dr) { const l = addItem(PL.inv, dr.id, dr.n, dr.q); if (l === dr.n) { msg('NO ROOM'); sfx('deny'); return; } sfx('pickup'); dr.n = l; if (!l) G.drops.splice(G.drops.indexOf(dr), 1); }
function usePump(o) { const f = pumpFuel(o); if (f <= 0) { msg('THE TANK IS DRY'); return; } const can = gasCan(); if (!can) { msg('YOU NEED A GAS CAN', '#ff8a6a'); sfx('deny'); return; }
  const n = Math.min(f, IT.gascan.cap - (can.q || 0)); if (n <= 0) { msg('YOUR CAN IS FULL'); return; } channel(1.5, 'PUMPING', () => { can.q = (can.q || 0) + n; G.pumps[o.id] = f - n; sfx('water'); msg('+' + n.toFixed(1) + 'L GAS', '#ffd76a'); }, 3); }
function mineOre(o) { const k = 'mine:' + o.id; G.stock[k] = G.stock[k] || 0; if (G.stock[k] >= 3) { msg('THE SEAM IS SPENT TODAY'); return; } const h = held(); if (!h || !(IT[h.id].dmg >= 1.5 || h.id === 'hammer' || IT[h.id].pry)) { msg('YOU NEED A HEAVY TOOL'); sfx('deny'); return; }
  if (PL.sta < 25) { msg('TOO TIRED'); return; } channel(3, 'MINING', () => { G.stock[k]++; PL.sta -= 25; PL.strXP += 1.5; G.time += 30; sfx('dig'); const n = 1 + (Math.random() * 2 | 0); let got = n + ' SCRAP'; addItem(PL.inv, 'scrap', n) && dropItem('scrap', n, PL.x, PL.y); if (Math.random() < 0.22) { addItem(PL.inv, 'gold', 1) && dropItem('gold', 1, PL.x, PL.y); got += ' + GOLD!'; } msg('+' + got, '#ffd76a'); }, 12); }
// ---- vehicles
function openVeh(v) { v.touched = 1; const S = VSPEC[v.type], can = gasCan(), opts = [];
  if (v.ok) opts.push({ t: v.type === 'car' ? 'DRIVE' : 'RIDE', fn: () => enterVeh(v) });
  if (v.type !== 'bike') { opts.push({ t: 'TRUNK (' + trunkKg(v).toFixed(0) + '/' + S.kg + 'KG)', fn: () => { ensureTrunk(v); for (let i = v.trunk.length - 1; i >= 0; i--) if (v.trunk[i].id === 'cash') { G.money += v.trunk[i].n; msg('+$' + v.trunk[i].n, '#ffd76a'); sfx('coin'); v.trunk.splice(i, 1); } openLoot(S.n + ' TRUNK', v.trunk, 'trunk', v); } });
    opts.push({ t: 'TANK ' + v.fuel.toFixed(1) + '/' + S.tank + 'L', dis: true });
    if (can && can.q > 0 && v.fuel < S.tank) opts.push({ t: 'POUR GAS CAN (' + can.q.toFixed(1) + 'L)', fn: () => { const n = Math.min(can.q, S.tank - v.fuel); v.fuel += n; can.q -= n; v._nf = 0; sfx('water'); msg('+' + n.toFixed(1) + 'L IN THE TANK'); G.ui = null; } });
    if (can && v.fuel > 0.2 && (can.q || 0) < IT.gascan.cap) opts.push({ t: 'SIPHON INTO CAN', fn: () => { G.ui = null; channel(2, 'SIPHONING', () => { const n = Math.min(v.fuel, IT.gascan.cap - (can.q || 0)); v.fuel -= n; can.q = (can.q || 0) + n; sfx('drink'); msg('+' + n.toFixed(1) + 'L GAS', '#ffd76a'); }); } });
    if (!v.ok) opts.push({ t: 'FIX (2 SCRAP, 1 ELEC, HAMMER)', fn: () => { if (countItem(PL.inv, 'scrap') < 2 || countItem(PL.inv, 'elec') < 1 || !countItem(PL.inv, 'hammer')) { msg('MISSING PARTS', '#ff8a6a'); sfx('deny'); return; } G.ui = null; channel(4, 'REPAIRING', () => { takeItem(PL.inv, 'scrap', 2); takeItem(PL.inv, 'elec', 1); v.ok = true; sfx('start', v.x, v.y); msg('IT RUNS!', '#8af06a'); }, 8); } }); }
  opts.push({ t: 'LEAVE', fn: () => { G.ui = null; } });
  if (opts.length === 2 && v.type === 'bike' && v.ok) { enterVeh(v); return; }
  G.ui = 'list'; G.list = { title: S.n, items: opts }; G.sel = 0; sfx('ui'); }
function enterVeh(v) { G.ui = null; if (PL.inv.hands[0] && IT[PL.inv.hands[0].id].two && v.type !== 'car') { msg('HANDS FULL (TWO-HANDED)'); return; } PL.veh = v.id; v.spd = 0; v.touched = 1; G.gone[v.id] = 1; sfx(v.type === 'bike' ? 'door' : 'start', v.x, v.y); if (v.type !== 'bike' && v.fuel <= 0) msg('THE TANK IS EMPTY', '#ff8a6a'); }
function exitVeh() { const v = VEHS.get(PL.veh); if (!v) { PL.veh = null; return; } if (v.spd > 3) { msg('SLOW DOWN FIRST'); return; }
  const a = v.ang + Math.PI / 2; for (const [ox, oy] of [[Math.cos(a), Math.sin(a)], [-Math.cos(a), -Math.sin(a)], [Math.cos(v.ang + Math.PI), Math.sin(v.ang + Math.PI)], [Math.cos(v.ang), Math.sin(v.ang)]]) { const x = v.x + ox * 0.9, y = v.y + oy * 0.9; if (freeAt(x, y, 0.25, 'p')) { PL.x = x; PL.y = y; break; } }
  PL.veh = null; v.spd = 0; sfx('door', v.x, v.y); }
// ---- npcs + recruits
function openTalk(n) { G.ui = 'talk'; G.talk = n; G.sel = 0; sfx('ui'); n.face = PL.x > n.x ? 1 : -1; }
function talkInfo(n) {
  const food = foodCount(); if (!G.base) return { say: ['NOT DEAD? ME NEITHER.', "I'D JOIN A REAL CAMP.", 'GOT A BED SOMEWHERE?'], ok: false };
  if (!freeBunk()) return { say: ['A CAMP, HUH?', 'WHERE WOULD I SLEEP?', 'BUILD ME A BUNK FIRST.'], ok: false };
  return { say: ["I HAVEN'T EATEN IN DAYS.", 'GIVE ME ' + n.want + ' FOOD AND', "I'LL WORK FOR YOUR CAMP."], ok: food >= n.want };
}
function foodCount() { let n = 0; for (const s of allSlots(PL.inv)) { const it = s.a[s.i]; if (it && IT[it.id].c === 'food') n += it.n; } return n; }
function payFood(n) { while (n > 0) { let best = null; for (const s of allSlots(PL.inv)) { const it = s.a[s.i]; if (it && IT[it.id].c === 'food' && (!best || IT[it.id].v < IT[best.id].v)) best = it; } if (!best) return; takeItem(PL.inv, best.id, 1); n--; } }
function npcHint(n) { // the nearest trader and the city, so talking is how you learn the map
  let best = null, bd = 1e9; for (const S of WD.sets) { if (S.kind !== 'town' && S.kind !== 'city') continue; const d = Math.hypot(S.x - n.x, S.y - n.y); if (d < bd && d > 40) { bd = d; best = S; } }
  const city = WD.sets.find((s) => s.kind === 'city'); const dir = (S) => { const a = Math.atan2(S.y - n.y, S.x - n.x), i = Math.round(a / (Math.PI / 4)) & 7; return ['EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH', 'NORTH-EAST'][i]; };
  if (best) G.seenNames[best.id] = 1; if (city) G.seenNames[city.id] = 1;
  return [best ? best.name + ' IS ' + dir(best) + '.' : '', city ? 'THE CITY, ' + city.name + ',' : '', city ? 'IS ' + dir(city) + '. RICH. DEADLY.' : ''];
}
function updateNPCs(dt) {
  for (const n of NPCS.values()) { const d = Math.hypot(n.x - PL.x, n.y - PL.y); if (d < 5) n.face = PL.x > n.x ? 1 : -1; n.fs = lerp(n.fs, n.face || 1, Math.min(1, dt * 8)); }
  for (const [i, r] of G.recruits.entries()) { r.t -= dt; let tx = r.tx, ty = r.ty;
    if (G.wave && r.job === 'guard') { [tx, ty] = guardPost(r, i); }
    else if (G.wave || isNight()) { const b = BUILD.get(r.bunk); if (b) { tx = b.x + 0.5; ty = b.y + 1.1; } }
    else if (r.t <= 0 || tx === undefined) { r.t = 3 + Math.random() * 5; const b = BUILD.get(r.bunk) || G.base; const a = Math.random() * 6.283, rr = 1 + Math.random() * 4; r.tx = tx = (b ? b.x : G.base.x) + 0.5 + Math.cos(a) * rr; r.ty = ty = (b ? b.y : G.base.y) + 0.5 + Math.sin(a) * rr; }
    if (tx === undefined) continue; const dx = tx - r.x, dy = ty - r.y, dd = Math.hypot(dx, dy); r.mv = dd > 0.2; if (r.mv) { const m = Math.min(dd, 2.2 * dt); moveC(r, dx / dd * m, dy / dd * m, 0.25, 'p'); r.face = dx > 0 ? 1 : -1; } r.fs = lerp(r.fs, r.face || 1, Math.min(1, dt * 8)); }
}
// ---- the player
const SURF_NOISE = { grass: 1, dirt: 1, wood: 1.1, hard: 1, tile: 1.05, gravel: 1.2, water: 1.3, glass: 1.5 };
function updatePlayer(dt, ix, iy) {
  PL.cd -= dt; PL.swingT -= dt; PL.hurtT = Math.max(0, PL.hurtT - dt * 2); PL.flash -= dt; PL.invuln = Math.max(0, (PL.invuln || 0) - dt); if (G.chop) G.chop.sh = Math.max(0, G.chop.sh - dt * 8);
  // door enter/exit: 3s bite invulnerability
  { const b = buildingAt(PL.x, PL.y), bid = b ? b.id : null; if (PL._bid !== bid) { if (PL._bid != null || bid != null) { PL.invuln = 3; sfx('door'); G.syncSoon = 0.6; } PL._bid = bid; } }
  PL.noise = Math.max(PL.noise - dt * 30, PL.noiseMax || 0); PL.noiseMax = 0;
  if (PL.str < 3) PL.str = 1 + Math.min(2, PL.strXP / 160);
  if (PL.veh) { const v = VEHS.get(PL.veh); if (v) { driveUpdate(v, dt, ix, iy); PL.moving = v.spd > 0.3; if (ix) PL.face = ix > 0 ? 1 : -1; PL.fs = lerp(PL.fs, PL.face, Math.min(1, dt * 10)); if (v.spd > 0.5) PL.dir = [Math.cos(v.ang), Math.sin(v.ang)]; } PL.sta = Math.min(100, PL.sta + dt * (v && v.type === 'bike' ? 0 : 8)); return; }
  const mv = ix || iy; PL.moving = !!mv;
  if (mv) { const l = Math.hypot(ix, iy); ix /= l; iy /= l; PL.dir = [ix, iy]; if (Math.abs(ix) > 0.1) PL.face = ix > 0 ? 1 : -1; }
  PL.sprint = KEYS.b && G.bT > 0.18 && mv && PL.sta > 1 && !PL.exh; if (PL.sprint) PL.sneak = false;
  const ft = PL.inv.wear.feet; let spd = 3.4 * (ft ? 1 : 0.88) * (PL.sprint ? 1.75 : 1) * (PL.sneak ? 0.5 : 1) * loadK(); const t = tileAt(PL.x, PL.y); if (t === T.SHAL) spd *= 0.6; else if (t === T.BUSH || t === T.TALL) spd *= 0.85; const bb = buildAt(PL.x, PL.y); if (bb && bb.k === 'wire') spd *= 0.4;
  if (PL.sprint) { PL.sta -= dt * 17; if (PL.sta <= 0) { PL.exh = true; msg('OUT OF BREATH'); } } else PL.sta = Math.min(100, PL.sta + dt * (PL.hun < 15 || G.awake > 20 ? 6 : 13)); if (PL.exh && PL.sta > 30) PL.exh = false;
  if (mv) { const x0 = PL.x, y0 = PL.y; moveC(PL, ix * spd * dt, iy * spd * dt, 0.27, 'p'); const dd = Math.hypot(PL.x - x0, PL.y - y0); PL.anim += dt; PL.step += dd;
    if (loadK() < 1) PL.strXP += dd * 0.01;
    const stride = PL.sprint ? 0.8 : PL.sneak ? 0.75 : 0.65; if (PL.step > stride) { PL.step = 0; const s = SURF[tileAt(PL.x, PL.y)] || 'grass'; const q = ft ? IT[ft.id].quiet || 1 : 0.85, base = PL.sprint ? 11 : PL.sneak ? 0.35 : 0.9, r = base * q * (SURF_NOISE[s] || 1);
      noise(PL.x, PL.y, r, 'step'); PL.noise = Math.max(PL.noise, r); sfx('step_' + s, PL.x, PL.y); if (SND['step_' + s]) { /* volume tracks sneak */ }
      if (s === 'glass' && (!ft || (ft.id === 'sneakers' && Math.random() < 0.5))) { hurtP(ft ? 2 : 4, 'BLED OUT ON GLASS'); PL.hurtT = 0.5; blood(PL.x, PL.y - 0.1, 2); if (!G.glassMsg) { G.glassMsg = 1; msg('OUCH! BROKEN GLASS. FIND SHOES', '#ff8a6a'); } } } }
  PL.fs = lerp(PL.fs, PL.face, Math.min(1, dt * 10));
}
function useItem(s, from) {
  const d = IT[s.id];
  if (d.c === 'food' || d.c === 'drink') { PL.hun = Math.min(100, PL.hun + (d.food || 0)); PL.thi = Math.min(100, PL.thi + (d.water || 0)); PL.sta = Math.min(100, PL.sta + (d.sta || 0)); sfx(d.c === 'drink' ? 'drink' : 'eat'); takeOne(s, from); msg((d.c === 'drink' ? 'DRANK ' : 'ATE ') + d.n); return; }
  if (d.c === 'med') { PL.hp = Math.min(100, PL.hp + (d.heal || 0)); PL.sta = Math.min(100, PL.sta + (d.sta || 0)); sfx('pickup'); takeOne(s, from); msg('USED ' + d.n); return; }
  if (s.id === 'whiskey') { PL.thi = Math.max(0, PL.thi - 5); PL.sta = Math.min(100, PL.sta + 30); takeOne(s, from); sfx('drink'); msg('WARM INSIDE.'); return; }
}
function takeOne(s, from) { s.n--; if (s.n <= 0) from.a[from.i] = null; }
function die(why) {
  if (PL.dead) return; PL.dead = true; G.alive = false; G.why = why; G.deadT = 0; G.sleeping = false; G.ui = null; G.chan = null; sfx('death'); CAM.shake = 0.5;
  endStoredRun(false); lbRunEnd();
}
// ================================================================ menus + UI (every screen works with the d-pad + A/B, and with taps)
let UIHIT = [];
const hitR = (x, y, w, h, fn) => UIHIT.push({ x, y, w, h, fn });
const RH = 11;
function rowsUI(x, y, w, rows, sel, maxRows, onPick) {
  const n = rows.length, top = clamp(sel - (maxRows >> 1), 0, Math.max(0, n - maxRows));
  for (let i = top; i < Math.min(n, top + maxRows); i++) { const r = rows[i], yy = y + (i - top) * RH, on = i === sel;
    if (on) { rect(x, yy, w, RH - 1, r.dis ? 'rgba(120,120,160,0.22)' : UI.sel); handCursor(Math.max(0, x - 9), yy + 1); }
    let tx = x + 2; if (r.ic) { hx.drawImage(iconImg(r.ic), x + 1, yy); tx = x + 13; }
    text(fitText(r.t, w - (tx - x) - (r.r ? textW(r.r) + 4 : 2)), tx, yy, r.dis ? '#8a7a6a' : r.col || INK, 'left', false);
    if (r.r) text(r.r, x + w - 2, yy, r.rc || (r.dis ? '#8a7a6a' : '#5a4a3a'), 'right', false);
    hitR(x, yy, w, RH, () => { if (G.sel === i) onPick && onPick(i); else { G.sel = i; sfx('ui'); } }); }
  if (top > 0) text('^', x + w - 4, y - 9, INK, 'center', false); if (top + maxRows < n) text('V', x + w - 4, y + maxRows * RH - 2, INK, 'center', false);
}
function frame(title, hint) { panel(4, 4, N - 8, N - 8, CREAM, 2); rect(6, 6, N - 12, 10, UI.bar); text(title, N / 2, 5, CREAM, 'center'); if (hint) { rect(6, N - 16, N - 12, 10, UI.strip); text(fitText(hint, N - 12), N / 2, N - 15, '#6a5a4a', 'center', false); } }
const MAXR = () => Math.floor((N - 50) / RH);
// ---- START menu: PACK / BUILD / CAMP / SYS
const TABS = ['PACK', 'BUILD', 'CAMP', 'SYS'];
function packRows() { const I = PL.inv, out = [], name = (s) => s ? IT[s.id].n + (s.n > 1 ? ' x' + s.n : '') + (s.id === 'gascan' ? ' ' + (s.q || 0).toFixed(1) + 'L' : s.id === 'wcan' ? ' ' + (s.q || 0) + '/12' : '') : '-';
  out.push({ t: 'CRAFTING…', r: 'OPEN', rc: '#3a8a3a', col: '#3a5a8a', craft: 1 });
  for (let i = 0; i < 2; i++) { const s = I.hands[i]; out.push({ t: (i ? 'L HAND: ' : 'R HAND: ') + (s ? name(s) : i === 1 && twoHanded(I) ? '(BOTH HANDS)' : '-'), r: s ? wOf(s).toFixed(1) : '', ic: s && s.id, ref: { a: I.hands, i }, dis: !s }); }
  for (let i = 0; i < I.pockets.length; i++) { const s = I.pockets[i]; out.push({ t: 'POCKET: ' + name(s), r: s ? wOf(s).toFixed(1) : '', ic: s && s.id, ref: { a: I.pockets, i }, dis: !s }); }
  for (let i = 0; i < I.pack.length; i++) { const s = I.pack[i]; out.push({ t: 'PACK: ' + name(s), r: s ? wOf(s).toFixed(1) : '', ic: s && s.id, ref: { a: I.pack, i }, dis: !s }); }
  for (const k of ['feet', 'body', 'back']) { const s = I.wear[k]; out.push({ t: k.toUpperCase() + ': ' + (s ? IT[s.id].n : k === 'feet' ? 'BAREFOOT' : '-'), ic: s && s.id, ref: { wear: k }, dis: !s, col: '#3a5a8a' }); }
  return out; }
function slotOf(ref) { return ref.wear ? PL.inv.wear[ref.wear] : ref.a[ref.i]; }
function itemActions(ref) {
  const s = slotOf(ref); if (!s) return; const d = IT[s.id], o = [], from = ref.a ? { a: ref.a, i: ref.i } : null, back = () => { G.ui = 'menu'; };
  if (ref.wear) { o.push({ t: 'TAKE OFF', fn: () => { PL.inv.wear[ref.wear] = null; const l = addItem(PL.inv, s.id, 1, s.q); if (l) dropItem(s.id, 1, PL.x, PL.y); if (ref.wear === 'back') for (const sp of resizePack(PL.inv)) { const l2 = addItem(PL.inv, sp.id, sp.n, sp.q); if (l2) dropItem(sp.id, l2, PL.x, PL.y, sp.q); } sfx('pickup'); back(); } }); }
  else {
    if (d.c === 'food' || d.c === 'drink' || d.c === 'med' || s.id === 'whiskey') o.push({ t: d.c === 'drink' || s.id === 'whiskey' ? 'DRINK' : d.c === 'med' ? 'USE' : 'EAT', fn: () => { useItem(s, from); back(); } });
    if (d.c === 'wear') o.push({ t: 'WEAR', fn: () => { const old = PL.inv.wear[d.slot]; ref.a[ref.i] = null; PL.inv.wear[d.slot] = { id: s.id, n: 1 }; if (old) { const l = addItem(PL.inv, old.id, 1); if (l) dropItem(old.id, 1, PL.x, PL.y); } if (d.slot === 'back' || old && IT[old.id].slot === 'back') for (const sp of resizePack(PL.inv)) { const l2 = addItem(PL.inv, sp.id, sp.n, sp.q); if (l2) dropItem(sp.id, l2, PL.x, PL.y, sp.q); } sfx('pickup'); msg('WEARING ' + d.n); back(); } });
    if (ref.a !== PL.inv.hands) o.push({ t: 'HOLD', fn: () => { const H = PL.inv.hands; if (d.two) { const a = H[0], b = H[1]; H[0] = s; H[1] = null; ref.a[ref.i] = null; for (const x of [a, b]) if (x) { const l = addItem(PL.inv, x.id, x.n, x.q); if (l) dropItem(x.id, l, PL.x, PL.y, x.q); } } else { const i = H[0] && !twoHanded(PL.inv) && !H[1] ? 1 : 0; const old = H[i]; H[i] = s; ref.a[ref.i] = old && !IT[old.id].two ? old : null; if (old && IT[old.id].two) { H[1] = null; const l = addItem(PL.inv, old.id, old.n, old.q); if (l) dropItem(old.id, l, PL.x, PL.y, old.q); } } sfx('pickup'); back(); } });
    else { o.push({ t: 'STOW', fn: () => { let put = false; for (const L of [PL.inv.pockets, PL.inv.pack]) for (let i = 0; i < L.length && !put; i++) if (!L[i]) { L[i] = s; put = true; } if (!put) { msg('NO FREE POCKET'); sfx('deny'); } else { ref.a[ref.i] = null; sfx('pickup'); } back(); } });
      if (ref.i === 1 && PL.inv.hands[0] && !twoHanded(PL.inv)) o.push({ t: 'SWAP HANDS', fn: () => { const H = PL.inv.hands; [H[0], H[1]] = [H[1], H[0]]; back(); } }); }
    if (s.id === 'bedroll') o.push({ t: G.base ? 'CAMP EXISTS' : 'MAKE CAMP HERE', dis: !!G.base, fn: () => { G.ui = null; makeCamp(); } });
    if (s.id === 'gascan' && s.q > 0) { const v = vehicleNear(PL.x, PL.y, 2.2); if (v && v.type !== 'bike') o.push({ t: 'REFUEL ' + VSPEC[v.type].n, fn: () => { const n = Math.min(s.q, VSPEC[v.type].tank - v.fuel); v.fuel += n; s.q -= n; v.touched = 1; sfx('water'); msg('+' + n.toFixed(1) + 'L'); back(); } }); }
    if (s.n > 1) o.push({ t: 'DROP ONE', fn: () => { s.n--; dropItem(s.id, 1, PL.x, PL.y, s.q); sfx('pickup'); back(); } });
    o.push({ t: s.n > 1 ? 'DROP ALL' : 'DROP', fn: () => { ref.a[ref.i] = null; dropItem(s.id, s.n, PL.x, PL.y, s.q); sfx('pickup'); back(); } });
  }
  o.push({ t: 'BACK', fn: back }); G.ui = 'list'; G.list = { title: d.n, items: o, desc: itemDesc(s), back }; G.sel = 0; sfx('ui');
}
function itemDesc(s) { const d = IT[s.id]; const p = [];
  if (d.food) p.push('FOOD +' + d.food); if (d.water) p.push('WATER +' + d.water); if (d.heal) p.push('HEAL +' + d.heal); if (d.dmg) p.push('DMG ' + d.dmg); if (d.noise) p.push('NOISE ' + d.noise); if (d.ammo) p.push('AMMO ' + IT[d.ammo].n); if (d.slots) p.push(d.slots + ' SLOTS +' + d.kg + 'KG'); if (d.two) p.push('2 HANDS'); if (d.quiet) p.push(d.quiet < 1 ? 'QUIET' : 'STURDY');
  p.push(d.w + 'KG'); p.push('WORTH $' + Math.floor(valOf(s) * 0.5 / (s.n || 1)) + ' EA'); return p.join('  '); }
function buildRows() { if (!G.base) return [{ t: 'NO CAMP YET.', dis: true }, { t: 'HOLD A BEDROLL + PRESS A', dis: true }, { t: 'OR USE IT FROM YOUR PACK.', dis: true }, { t: 'BEDROLLS: TRADERS, $26', dis: true }];
  const out = BORDER.map((k) => { const d = BDEF[k], ok = canBuild(k); return { t: d.n, r: Object.entries(d.cost).map(([id, n]) => n + ' ' + IT[id].n.split(' ')[0]).join(' '), dis: !ok, k, desc: d.d + '  HAVE: ' + Object.entries(d.cost).map(([id, n]) => IT[id].n.split(' ')[0] + ' ' + matCount(id) + '/' + n).join(' ') }; });
  out.push({ t: 'REMOVE WHAT YOU FACE (50% BACK)', k: 'remove', col: '#a83a2a' }); return out; }
function matCount(id) { return countItem(PL.inv, id) + (inBase(PL.x, PL.y) ? chestCount(id) : 0); }
function campRows() { const out = []; const t = campTier(); out.push({ t: (G.base ? t : 'NO CAMP') + '  ' + campSize() + ' SOULS  ' + bunks().length + ' BUNKS', dis: true, col: '#3a5a8a' });
  for (const r of G.recruits) out.push({ t: r.name, r: r.job.toUpperCase(), rc: { farmer: '#3a8a3a', guard: '#a83a2a', scavenger: '#8a6a2a', builder: '#3a5a8a' }[r.job], r0: r });
  if (!G.recruits.length) out.push({ t: 'NO RECRUITS. SURVIVORS HIDE IN TOWNS.', dis: true }, { t: 'FEED THEM AND GIVE THEM A BUNK.', dis: true });
  const n = 2 + G.day + Math.floor(G.day * G.day / 12); out.push({ t: 'TONIGHT: ' + n + ' ZOMBIES AT 22:00', dis: true, col: '#a83a2a' });
  let cf = 0; for (const b of chests()) for (const s of b.items) if (IT[s.id].c === 'food') cf += s.n; out.push({ t: 'FOOD IN CHESTS: ' + cf + ' (RECRUITS EAT 1/DAY)', dis: true }); return out; }
const JOBS = ['farmer', 'guard', 'scavenger', 'builder'], JOB_D = { farmer: 'HARVESTS + WATERS CROPS', guard: 'FIGHTS AT NIGHT', scavenger: 'LOOTS BY DAY. RISKY', builder: 'REPAIRS WALLS' };
function sysRows() { return [{ t: 'DUSK PALETTE', r: OPT.dusk ? 'ON' : 'OFF' }, { t: 'SOUND', r: OPT.sfx ? 'ON' : 'OFF' }, { t: 'MUSIC', r: OPT.music ? 'ON' : 'OFF' }, { t: 'CONTROLS' }, { t: 'MAP (SELECT)' }, { t: 'QUIT TO TITLE', col: '#a83a2a' }]; }
function menuRows() { return [packRows, buildRows, campRows, sysRows][G.tab](); }
function menuPick(i) { const rows = menuRows(), r = rows[i]; if (!r) return;
  if (G.tab === 0) { if (r.craft) { openCraft(null); return; } if (r.dis) { sfx('deny'); return; } itemActions(r.ref); }
  else if (G.tab === 1) { if (!r.k) return; if (r.k === 'remove') { const [tx, ty] = facingTile(), b = BUILD.get(tkey(tx, ty)); if (!b) { msg('FACE A BUILT THING FIRST'); sfx('deny'); } else { removeBuild(b); sfx('break'); } G.ui = null; return; } if (r.dis) { sfx('deny'); msg('MISSING MATERIALS'); return; } G.ui = 'build'; G.bsel = r.k; sfx('ui'); }
  else if (G.tab === 2) { if (!r.r0) return; const j = JOBS.indexOf(r.r0.job); r.r0.job = JOBS[(j + 1) % 4]; sfx('ui'); msg(r.r0.name + ': ' + JOB_D[r.r0.job]); }
  else { if (i === 0) { OPT.dusk = !OPT.dusk; } else if (i === 1) { OPT.sfx = !OPT.sfx; audioLevels(); } else if (i === 2) { OPT.music = !OPT.music; audioLevels(); } else if (i === 3) { G.ui = 'help'; } else if (i === 4) { openMap(); } else if (i === 5) { saveGame('quit'); toTitle(); } saveOpt(); sfx('ui'); } }
function drawMenu() {
  frame('', ''); const tw = (N - 8) / 4; for (let i = 0; i < 4; i++) { const x = 4 + i * tw; rect(x, 4, tw - 1, 12, i === G.tab ? UI.sel : UI.bar); text(TABS[i], x + tw / 2, 5, i === G.tab ? INK : CREAM, 'center', i !== G.tab); hitR(x, 4, tw, 12, () => { G.tab = i; G.sel = 0; sfx('ui'); }); }
  const rows = menuRows(); G.sel = clamp(G.sel, 0, rows.length - 1);
  rowsUI(8, 20, N - 16, rows, G.sel, MAXR() - 1, menuPick);
  let hint = ''; const r = rows[G.sel];
  if (G.tab === 0) { const w = invWeight(PL.inv), c = capKg(); hint = w.toFixed(1) + '/' + c.toFixed(0) + 'KG  STR ' + PL.str.toFixed(2) + (r && !r.dis && r.ref && slotOf(r.ref) ? '  ' + itemDesc(slotOf(r.ref)) : ''); }
  else if (G.tab === 1) hint = r && r.desc ? r.desc : 'BUILD INSIDE YOUR CAMP (16 TILES)';
  else if (G.tab === 2) hint = r && r.r0 ? 'A: CHANGE JOB. ' + JOB_D[r.r0.job] : 'SCORE ' + score() + '. CAMP: 3 OUTPOST 6 VILLAGE 10 UTOPIA';
  else hint = 'SEED ' + G.seed + '  B: CLOSE';
  rect(6, N - 28, N - 12, 22, UI.strip); const words = wrap(hint, N - 14); for (let i = 0; i < Math.min(2, words.length); i++) text(words[i], 8, N - 27 + i * 10, '#6a5a4a', 'left', false);
}
function wrap(s, w) { const out = []; let line = ''; for (const wd of String(s).split(' ')) { const t = line ? line + ' ' + wd : wd; if (textW(t) > w && line) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); return out; }
// ---- generic option list
function drawList() { const L = G.list; frame(L.title, ''); const top = 20; let y = top; if (L.desc) { for (const ln of wrap(L.desc, N - 20)) { text(ln, 10, y, '#6a5a4a', 'left', false); y += 10; } y += 4; }
  if (L.say) { for (const ln of L.say) { text(ln, 10, y, INK, 'left', false); y += 10; } y += 4; }
  rowsUI(8, y, N - 16, L.items.map((o) => ({ t: o.t, dis: o.dis })), G.sel, Math.floor((N - y - 10) / RH), listPick); }
function listPick(i) { const o = G.list.items[i]; if (!o || o.dis || !o.fn) { sfx('deny'); return; } sfx('uiok'); o.fn(); }
// ---- loot: container on the left, you on the right
function openLoot(title, items, kind, ref) { G.ui = 'loot'; G.loot = { title, items, kind, ref, col: 0 }; G.sel = 0; sfx('open'); }
function myItems() { return allSlots(PL.inv).filter((s) => s.a[s.i]); }
function drawLoot() { const L = G.loot; frame(L.title, 'A: MOVE  L/R: SIDE  B: DONE'); const w = (N - 20) / 2, mr = MAXR() - 1;
  const left = L.items.map((s) => ({ t: IT[s.id].n + (s.n > 1 ? ' x' + s.n : ''), ic: s.id, r: wOf(s).toFixed(1) })); if (L.items.length) left.unshift({ t: 'TAKE ALL', col: '#3a8a3a' }); else left.push({ t: '(EMPTY)', dis: true });
  const right = myItems().map((s) => { const it = s.a[s.i]; return { t: IT[it.id].n + (it.n > 1 ? ' x' + it.n : ''), ic: it.id, r: wOf(it).toFixed(1) }; }); if (!right.length) right.push({ t: '(NOTHING)', dis: true });
  text(L.kind === 'trunk' ? 'TRUNK ' + trunkKg(L.ref).toFixed(0) + '/' + VSPEC[L.ref.type].kg : (L.kind === 'stash' || L.kind === 'chest' ? 'STOCKPILE' : 'IN HERE'), 8 + w / 2, 18, '#6a5a4a', 'center', false); text('YOU ' + invWeight(PL.inv).toFixed(1) + '/' + capKg().toFixed(0), 12 + w * 1.5, 18, invWeight(PL.inv) > capKg() ? '#c83a2a' : '#6a5a4a', 'center', false);
  const sel0 = L.col === 0 ? G.sel : -1, sel1 = L.col === 1 ? G.sel : -1;
  rowsUI(6, 30, w, left, sel0, mr - 1, (i) => { L.col = 0; G.sel = i; lootPick(); }); rowsUI(14 + w, 30, w, right, sel1, mr - 1, (i) => { L.col = 1; G.sel = i; lootPick(); });
  for (const h of UIHIT.slice(-left.length - right.length)) { const f = h.fn, col = h.x < N / 2 ? 0 : 1; h.fn = () => { if (L.col !== col) { L.col = col; G.sel = -1; } f(); }; }
  rect(N / 2 - 1, 30, 1, mr * RH - 12, UI.div); }
function lootPick() { const L = G.loot;
  if (L.col === 0) { if (!L.items.length) return; if (G.sel === 0) { let moved = 0; for (let i = 0; i < L.items.length; i++) { const s = L.items[i]; const l = addItem(PL.inv, s.id, s.n, s.q); if (l < s.n) moved++; s.n = l; } for (let i = L.items.length - 1; i >= 0; i--) if (!L.items[i].n) L.items.splice(i, 1); sfx(moved ? 'loot' : 'deny'); if (L.items.length) msg('NO ROOM FOR THE REST'); G.saveDirty = true; return; }
    const s = L.items[G.sel - 1]; if (!s) return; const l = addItem(PL.inv, s.id, s.n, s.q); if (l === s.n) { msg('NO ROOM. WEAR A BACKPACK'); sfx('deny'); return; } s.n = l; if (!l) L.items.splice(G.sel - 1, 1); sfx('loot'); G.sel = Math.min(G.sel, L.items.length); }
  else { const my = myItems(); const sl = my[G.sel]; if (!sl) return; const it = sl.a[sl.i];
    if (L.kind === 'trunk' && trunkKg(L.ref) + wOf(it) > VSPEC[L.ref.type].kg) { msg('THE TRUNK IS FULL'); sfx('deny'); return; }
    if (L.kind === 'chest' || L.kind === 'stash' || L.kind === 'obj') { const nStacks = L.items.length; if (!L.items.find((x) => x.id === it.id && IT[x.id].s > 1) && nStacks >= 24) { msg('STORAGE FULL'); sfx('deny'); return; } }
    const ex = IT[it.id].s > 1 && L.items.find((x) => x.id === it.id); if (ex) ex.n += it.n; else L.items.push({ id: it.id, n: it.n, q: it.q }); sl.a[sl.i] = null; sfx('pickup'); G.sel = Math.min(G.sel, myItems().length - 1); }
  G.saveDirty = true; }
// ---- the trader
const SHOP_TOWN = ['water', 'beans', 'chips', 'SEEDS', 'plank', 'nails', 'scrap', 'rope', 'cloth', 'hoe', 'wcan', 'hammer', 'bedroll', 'bandage', 'sneakers', 'pack_s', 'gascan', 'GAS', 'knife', 'bat', 'a9'];
const SHOP_CITY = ['pistol', 'shotgun', 'shell', 'medkit', 'pack_h', 'boots', 'elec', 'axe', 'crowbar', 'machete', 'mre', 'rod', 'r556'];
const BUNDLE = { nails: 20, a9: 12, shell: 6, r556: 10 };
function traderSet(o) { return WD.sets[+String(o.id).split(':')[0]] || null; }
function shopStock(o) { const key = o.id + '@' + G.day; if (G.stock[key]) return G.stock[key]; const S = traderSet(o), R = rng(hashS(key) ^ G.seed), st = {};
  const list = SHOP_TOWN.concat(S && S.kind === 'city' ? SHOP_CITY : []); for (const k of list) { if (k === 'SEEDS') { for (const c in CROPS) if (CROPS[c].seas.includes(season())) st['s_' + c] = 2 + ((R() * 3) | 0); continue; } if (k === 'GAS') { st.GAS = 8; continue; }
    const d = IT[k]; st[k] = d.v > 60 ? (R() < 0.6 ? 1 : 0) : d.v > 15 ? 1 + ((R() * 2) | 0) : 2 + ((R() * 5) | 0); }
  G.stock = Object.fromEntries(Object.entries(G.stock).filter(([k2]) => !k2.includes('@') || k2.endsWith('@' + G.day))); G.stock[key] = st; return st; }
const bundle = (id) => BUNDLE[id] || (id.startsWith('s_') ? 5 : 1);
const buyPrice = (id) => id === 'GAS' ? 6 : Math.ceil(IT[id].v * 1.3 * bundle(id));
const sellPrice = (it) => Math.floor(valOf(it) * 0.5);
function openShop(o) { G.ui = 'shop'; G.shop = { o, tab: 0 }; G.sel = 0; sfx('bell'); }
function shopRows() { const Sh = G.shop, st = shopStock(Sh.o);
  if (Sh.tab === 0) return Object.keys(st).map((id) => ({ t: id === 'GAS' ? 'GASOLINE 1L (INTO YOUR CAN)' : IT[id].n + (bundle(id) > 1 ? ' x' + bundle(id) : ''), ic: id === 'GAS' ? 'gascan' : id, r: '$' + buyPrice(id) + ' (' + st[id] + ')', dis: !st[id] || G.money < buyPrice(id), id }));
  const out = myItems().map((s) => { const it = s.a[s.i]; return { t: IT[it.id].n + (it.n > 1 ? ' x' + it.n : ''), ic: it.id, r: '$' + sellPrice(it), s }; }); if (!out.length) out.push({ t: 'NOTHING TO SELL', dis: true }); return out; }
function shopPick(i) { const Sh = G.shop, r = shopRows()[i]; if (!r || r.dis) { sfx('deny'); if (r && r.id && G.money < buyPrice(r.id)) msg('NOT ENOUGH MONEY'); return; } const st = shopStock(Sh.o);
  if (Sh.tab === 0) { if (r.id === 'GAS') { const can = gasCan(); if (!can) { msg('BUY OR FIND A GAS CAN FIRST'); sfx('deny'); return; } if ((can.q || 0) + 1 > IT.gascan.cap) { msg('YOUR CAN IS FULL'); sfx('deny'); return; } can.q = (can.q || 0) + 1; }
    else { const l = addItem(PL.inv, r.id, bundle(r.id), r.id === 'wcan' ? 0 : r.id === 'gascan' ? 0 : undefined); if (l === bundle(r.id)) { msg('NO ROOM'); sfx('deny'); return; } if (l) dropItem(r.id, l, PL.x, PL.y); }
    G.money -= buyPrice(r.id); st[r.id]--; sfx('coin'); }
  else { const it = r.s.a[r.s.i]; const one = it.n > 1 ? { id: it.id, n: 1, q: it.q } : it, p = sellPrice(one); G.money += p; it.n--; if (it.n <= 0) r.s.a[r.s.i] = null; sfx('coin'); msg('+$' + p, '#ffd76a'); }
  G.saveDirty = true; }
function drawShop() { const Sh = G.shop, S = traderSet(Sh.o); frame('', 'L/R: BUY / SELL   A: DEAL   B: LEAVE');
  for (let i = 0; i < 2; i++) { const w = (N - 8) / 2, x = 4 + i * w; rect(x, 4, w - 1, 12, i === Sh.tab ? UI.sel : UI.bar); text(i ? 'SELL' : 'BUY', x + w / 2, 5, i === Sh.tab ? INK : CREAM, 'center', i !== Sh.tab); hitR(x, 4, w, 12, () => { Sh.tab = i; G.sel = 0; sfx('ui'); }); }
  text((S ? S.name : 'TRADER') + '  $' + G.money, N / 2, 18, '#8a6a2a', 'center', false);
  rowsUI(8, 30, N - 16, shopRows(), G.sel, MAXR() - 2, shopPick); }
// ---- cooking at a campfire
const RECIPES = [{ out: 'bakedpot', need: { potato: 1 } }, { out: 'rfish', need: { fish: 1 } }, { out: 'bread', need: { wheat: 2 } }, { out: 'stew', need: { turnip: 1, carrot: 1, water: 1 } }, { out: 'psoup', need: { pumpkin: 1, water: 1 } }];
function cookRows() { return RECIPES.map((r) => ({ t: IT[r.out].n + ' (FOOD ' + IT[r.out].food + ')', ic: r.out, r: Object.entries(r.need).map(([id, n]) => n + ' ' + IT[id].n.split(' ')[0]).join('+'), dis: !Object.entries(r.need).every(([id, n]) => haveMat(id, n)) })); }
function cookPick(i) { const r = RECIPES[i]; if (!Object.entries(r.need).every(([id, n]) => haveMat(id, n))) { sfx('deny'); msg('MISSING INGREDIENTS'); return; } for (const [id, n] of Object.entries(r.need)) useMat(id, n); const l = addItem(PL.inv, r.out, 1); if (l) dropItem(r.out, 1, PL.x, PL.y); sfx('eat'); msg('COOKED ' + IT[r.out].n, '#8af06a'); G.time += 20; }
function drawCook() { frame('CAMPFIRE', 'A: COOK (20 MIN)  B: BACK'); text('COOKED FOOD FILLS YOU FAR MORE', N / 2, 18, '#6a5a4a', 'center', false); rowsUI(8, 30, N - 16, cookRows(), G.sel, MAXR() - 2, cookPick); }
// ---- talk
function drawTalk() { const n = G.talk, I = talkInfo(n); frame(n.name, 'A: CHOOSE  B: BYE');
  const S = personFrames(n.look); hx.save(); hx.translate(30, 70); hx.scale(2, 2); drawStandee(S, 0, 0, 0, 0, 0, 0, 1, 0); hx.restore();
  let y = 24; for (const ln of G.talkSay || I.say) { text(ln, 54, y, INK, 'left', false); y += 10; }
  const items = [{ t: 'GIVE ' + n.want + ' FOOD (HAVE ' + foodCount() + ')', dis: !I.ok }, { t: 'ANY NEWS?' }, { t: 'BYE' }];
  rowsUI(8, Math.max(80, y + 8), N - 16, items, G.sel, 4, talkPick); }
function talkPick(i) { const n = G.talk; if (i === 0) { if (!talkInfo(n).ok) { sfx('deny'); return; } payFood(n.want); recruit(n); NPCS.delete(n.id); G.ui = null; G.talkSay = null; sfx('join'); G.saveDirty = true; }
  else if (i === 1) { G.talkSay = npcHint(n); sfx('ui'); } else { G.ui = null; G.talkSay = null; } }
// ---- sleep
function trySleep() { const t = G.time; if (!(t >= 18 * 60 || t < 6 * 60)) { msg('TOO EARLY. SLEEP AFTER 18:00', '#ffb040'); sfx('deny'); return; }
  G.ui = 'list'; G.sel = 0; G.list = { title: 'SLEEP', desc: (G.wave ? 'THEY ARE HERE. ' : 'THE HORDE COMES AT 22:00. ') + (2 + G.day + Math.floor(G.day * G.day / 12)) + ' ZOMBIES. ' + (BUILD.size ? 'YOUR DEFENCES HOLD OR THEY DONT.' : 'YOU HAVE NO DEFENCES!'), items: [
    { t: 'SLEEP + WATCH THE NIGHT', fn: () => goSleep(true) }, { t: 'SLEEP + SKIP TO MORNING', fn: () => goSleep(false) }, { t: 'NOT YET', fn: () => { G.ui = null; } }], back: () => { G.ui = null; } }; }
function goSleep(watch) { G.ui = null; G.sleeping = true; G.sleepWatch = watch; PL.x = G.base.x + 0.5; PL.y = G.base.y + 0.7; G.chan = null; sfx('sleep'); saveGame('sleep');
  if (!watch) skipNight(); }
function skipNight() { let guard = 0; while (G.sleeping && !PL.dead && guard++ < 400) { updateTime(5, 2); if (G.wave && G.wave.live && !G.wave.headless && G.sleeping) runWaveHeadless(); if (G.report) break; } }
function wakeUp() { if (!G.sleeping) return; G.sleeping = false; G.sleepWatch = false; G.ui = null; if (G.wave) { G.wave.headless = false; G.wave.live = true; } SFX_ON.v = true; sfx('horde'); CAM.shake = 0.4; msg('YOU WAKE TO GROANING! DEFEND THE CAMP!', '#ff5a4a'); }
function drawReport() { const R = G.report; frame('DAY ' + R.day + ' DAWN', 'A: GET UP'); let y = 22; const L = (s, c = INK) => { for (const ln of wrap(s, N - 20)) { text(ln, 10, y, c, 'left', false); y += 10; } };
  const W = R.wave; if (W) L('NIGHT: ' + W.killed + '/' + W.total + ' ZOMBIES KILLED' + (W.breach ? ', ' + W.breach + ' BROKE IN' : ''), '#a83a2a');
  if (W && W.lost && W.lost.length) L('LOST: ' + W.lost.join(', '), '#a83a2a');
  const LB = { grown: 'CROPS GREW', died: 'CROPS DIED', ate: 'RECRUITS ATE', left: 'LEFT (HUNGRY)', lost: 'MISSING', found: 'SCAVENGED', fixed: 'REPAIRS' }; for (const k in LB) if (R[k] && (Array.isArray(R[k]) ? R[k].length : R[k])) L(LB[k] + ': ' + (Array.isArray(R[k]) ? R[k].slice(0, 6).join(', ') : R[k]));
  L(SEASONS[season()] + ' DAY ' + (((G.day - 1) % 7) + 1) + '/7' + (G.rain ? '. IT IS RAINING (CROPS WATERED)' : ''), '#3a5a8a');
  L('CAMP: ' + campTier() + ', ' + campSize() + ' SOULS. SCORE ' + score(), '#8a6a2a'); }
// ---- help
const HELP = ['D-PAD / WASD: MOVE (OR STEER)', 'A / SPACE: USE, SEARCH, ATTACK, ENTER', 'B / SHIFT: HOLD TO SPRINT, TAP: SNEAK', 'START / ENTER: PACK, BUILD, CAMP', 'SELECT / M: MAP.', 'YOUR RUN FOLLOWS YOU: CLOSE + COME BACK.', 'DEATH IS FINAL. POWER OFF→ON = FRESH RUN.', 'DOORS: 3s SAFE ENTER/EXIT.', 'STOCKPILE IN CRATES / CHESTS / LOCKERS.', 'CRAFT AT WORKBENCH / ANVIL / FORGE.', 'RECIPES NEED MATERIALS + TOOLS.', 'WALK QUIET. ONE BITE KILLS.', 'SELL LOOT. FOUND CAMP WITH BEDROLL.', 'HORDE AT 22:00. FEED TO RECRUIT.'];
function drawHelp() { frame('HOW TO SURVIVE', 'B: BACK'); let y = 22; for (const l of HELP) { text(fitText(l, N - 18), 10, y, INK, 'left', false); y += 10; } hitR(0, 0, N, N, () => { G.ui = G.helpFrom || 'menu'; }); }
// ---- map
function openMap() { G.ui = 'map'; G.mapZoom = 1; G.mapCX = PL.x; G.mapCY = PL.y; sfx('ui'); }
// ================================================================ crafting (Minecraft-like recipe book; needs materials + tools + station)
const CRAFT_CATS = ['ALL', 'MAT', 'TOOLS', 'WEAP', 'AMMO', 'MED', 'GEAR', 'CAMP'];
const STATION_N = { workbench: 'WORKBENCH', anvil: 'ANVIL', forge: 'FORGE', campfire: 'CAMPFIRE' };
/** Recipes: out/n, need{}, optional tool id, optional station key, cat. */
const CRAFT = [
  // materials
  { out: 'nails', n: 12, need: { scrap: 1 }, tool: 'hammer', station: 'workbench', cat: 'MAT' },
  { out: 'rope', n: 1, need: { cloth: 3 }, station: 'workbench', cat: 'MAT' },
  { out: 'cloth', n: 2, need: { hoodie: 1 }, station: 'workbench', cat: 'MAT' },
  { out: 'scrap', n: 2, need: { pipe: 1 }, tool: 'hammer', station: 'anvil', cat: 'MAT' },
  { out: 'scrap', n: 1, need: { bat: 1 }, tool: 'hammer', station: 'workbench', cat: 'MAT' },
  { out: 'elec', n: 1, need: { phone: 1, battery: 1 }, tool: 'hammer', station: 'workbench', cat: 'MAT' },
  { out: 'elec', n: 2, need: { laptop: 1 }, tool: 'hammer', station: 'workbench', cat: 'MAT' },
  // tools
  { out: 'hammer', n: 1, need: { scrap: 1, plank: 1 }, station: 'workbench', cat: 'TOOLS' },
  { out: 'hoe', n: 1, need: { plank: 2, scrap: 1, nails: 4 }, tool: 'hammer', station: 'workbench', cat: 'TOOLS' },
  { out: 'wcan', n: 1, need: { scrap: 2, nails: 4 }, tool: 'hammer', station: 'workbench', cat: 'TOOLS' },
  { out: 'rod', n: 1, need: { plank: 2, rope: 1, cloth: 1 }, station: 'workbench', cat: 'TOOLS' },
  { out: 'crowbar', n: 1, need: { scrap: 2, nails: 2 }, tool: 'hammer', station: 'anvil', cat: 'TOOLS' },
  // weapons
  { out: 'knife', n: 1, need: { scrap: 1, cloth: 1 }, tool: 'hammer', station: 'workbench', cat: 'WEAP' },
  { out: 'bat', n: 1, need: { plank: 2, nails: 4 }, tool: 'hammer', station: 'workbench', cat: 'WEAP' },
  { out: 'pipe', n: 1, need: { scrap: 2 }, tool: 'hammer', station: 'anvil', cat: 'WEAP' },
  { out: 'axe', n: 1, need: { plank: 2, scrap: 2, nails: 6 }, tool: 'hammer', station: 'anvil', cat: 'WEAP' },
  { out: 'machete', n: 1, need: { scrap: 3, cloth: 1, nails: 2 }, tool: 'hammer', station: 'anvil', cat: 'WEAP' },
  { out: 'spear', n: 1, need: { plank: 2, knife: 1, rope: 1 }, station: 'workbench', cat: 'WEAP' },
  { out: 'shield', n: 1, need: { plank: 3, scrap: 1, nails: 8 }, tool: 'hammer', station: 'workbench', cat: 'WEAP' },
  // ammo / parts
  { out: 'a9', n: 6, need: { scrap: 1, nails: 4 }, tool: 'hammer', station: 'workbench', cat: 'AMMO' },
  { out: 'shell', n: 2, need: { scrap: 1, nails: 6 }, tool: 'hammer', station: 'workbench', cat: 'AMMO' },
  { out: 'r556', n: 3, need: { scrap: 1, elec: 1, nails: 4 }, tool: 'hammer', station: 'forge', cat: 'AMMO' },
  { out: 'gascan', n: 1, need: { scrap: 2, cloth: 1 }, tool: 'hammer', station: 'workbench', cat: 'AMMO' },
  // medical
  { out: 'bandage', n: 2, need: { cloth: 2 }, station: null, cat: 'MED' },
  { out: 'bandage', n: 4, need: { cloth: 3 }, station: 'workbench', cat: 'MED' },
  { out: 'pills', n: 2, need: { berry: 2, cloth: 1 }, station: 'campfire', cat: 'MED' },
  { out: 'medkit', n: 1, need: { bandage: 3, pills: 1, cloth: 1 }, station: 'workbench', cat: 'MED' },
  // gear / wear
  { out: 'hoodie', n: 1, need: { cloth: 4, rope: 1 }, station: 'workbench', cat: 'GEAR' },
  { out: 'jacket', n: 1, need: { cloth: 5, rope: 2 }, station: 'workbench', cat: 'GEAR' },
  { out: 'sneakers', n: 1, need: { cloth: 3, rope: 1 }, station: 'workbench', cat: 'GEAR' },
  { out: 'boots', n: 1, need: { cloth: 2, scrap: 1, rope: 1 }, tool: 'hammer', station: 'workbench', cat: 'GEAR' },
  { out: 'pack_s', n: 1, need: { cloth: 4, rope: 2 }, station: 'workbench', cat: 'GEAR' },
  { out: 'pack_h', n: 1, need: { cloth: 6, rope: 3, scrap: 1 }, tool: 'hammer', station: 'workbench', cat: 'GEAR' },
  { out: 'bedroll', n: 1, need: { cloth: 4, rope: 2 }, station: 'workbench', cat: 'GEAR' },
  // camp / survival
  { out: 'torch', n: 2, need: { plank: 1, cloth: 1 }, station: 'campfire', cat: 'CAMP' },
  { out: 'charcoal', n: 2, need: { plank: 1 }, station: 'campfire', cat: 'CAMP' },
  { out: 'scrap', n: 2, need: { charcoal: 1, nails: 10 }, tool: 'hammer', station: 'forge', cat: 'CAMP' },
  { out: 'nails', n: 20, need: { scrap: 1, charcoal: 1 }, tool: 'hammer', station: 'forge', cat: 'CAMP' },
  { out: 'pipe', n: 1, need: { scrap: 2, charcoal: 1 }, tool: 'hammer', station: 'forge', cat: 'WEAP' },
  { out: 'crowbar', n: 1, need: { scrap: 3, charcoal: 1 }, tool: 'hammer', station: 'forge', cat: 'TOOLS' },
  { out: 'machete', n: 1, need: { scrap: 4, charcoal: 1, cloth: 1 }, tool: 'hammer', station: 'forge', cat: 'WEAP' },
  { out: 'axe', n: 1, need: { plank: 1, scrap: 3, charcoal: 1 }, tool: 'hammer', station: 'forge', cat: 'WEAP' },
];
// filter hide + ensure IT exists for new craft outputs
const CRAFT_R = CRAFT.filter((r) => !r.hide);

function nearStation(k) {
  if (!k) return true;
  if (k === 'campfire') return nearFire(PL.x, PL.y);
  for (const b of BUILD.values()) if (b.k === k && Math.hypot(b.x + 0.5 - PL.x, b.y + 0.5 - PL.y) < 2.4) return true;
  return false;
}
function haveTool(id) { return !id || countItem(PL.inv, id) > 0; }
function craftHaveNeed(r) { return Object.entries(r.need).every(([id, n]) => !n || haveMat(id, n)); }
function craftReady(r) { return craftHaveNeed(r) && haveTool(r.tool) && nearStation(r.station); }
function craftMissing(r) {
  const m = [];
  for (const [id, n] of Object.entries(r.need)) if (n && !haveMat(id, n)) m.push(n + ' ' + (IT[id] ? IT[id].n : id));
  if (r.tool && !haveTool(r.tool)) m.push('NEED ' + IT[r.tool].n);
  if (r.station && !nearStation(r.station)) m.push('AT ' + (STATION_N[r.station] || r.station));
  return m;
}
function openCraft(station) {
  G.ui = 'craft'; G.craft = { station: station || null, cat: 0, filter: station || null }; G.sel = 0; sfx('ui');
}
function craftList() {
  const C = G.craft || {}, want = CRAFT_CATS[C.cat || 0], st = C.filter;
  return CRAFT_R.filter((r) => {
    if (want !== 'ALL' && r.cat !== want) return false;
    // at a station: that station's recipes + hand (no-station) recipes
    if (st) { if (r.station && r.station !== st) return false; }
    return true;
  });
}
function craftRows() {
  return craftList().map((r) => {
    const miss = craftMissing(r), ok = !miss.length;
    const need = Object.entries(r.need).filter(([, n]) => n).map(([id, n]) => n + '×' + (IT[id] ? IT[id].n.split(' ')[0] : id)).join(' ');
    const extra = [r.tool ? IT[r.tool].n.split(' ')[0] : '', r.station ? STATION_N[r.station] : 'HANDS'].filter(Boolean).join(' · ');
    return { t: IT[r.out].n + (r.n > 1 ? ' x' + r.n : ''), ic: r.out, r: ok ? extra : miss[0], dis: !ok, rc: ok ? '#3a8a3a' : '#a83a2a', ref: r, need, miss };
  });
}
function craftPick(i) {
  const rows = craftRows(), row = rows[i]; if (!row || !row.ref) return;
  const r = row.ref; if (!craftReady(r)) { sfx('deny'); msg(craftMissing(r)[0] || 'MISSING', '#ff8a6a'); return; }
  for (const [id, n] of Object.entries(r.need)) if (n) useMat(id, n);
  const left = addItem(PL.inv, r.out, r.n); if (left) { dropItem(r.out, left, PL.x, PL.y); msg('NO ROOM — DROPPED', '#ffd76a'); }
  else msg('CRAFTED ' + IT[r.out].n + (r.n > 1 ? ' x' + r.n : ''), '#8af06a');
  sfx('uiok'); G.saveDirty = true; G.time += 8;
}
function drawCraft() {
  const C = G.craft || {}, list = craftRows(), st = C.filter;
  frame(st ? 'CRAFT · ' + (STATION_N[st] || st) : 'CRAFTING', 'A: MAKE  L/R: CAT  B: BACK');
  const cw = (N - 10) / CRAFT_CATS.length;
  for (let i = 0; i < CRAFT_CATS.length; i++) {
    const x = 5 + i * cw; rect(x, 16, cw - 1, 10, i === C.cat ? UI.sel : UI.bar);
    text(CRAFT_CATS[i].slice(0, 4), x + cw / 2, 16, i === C.cat ? INK : CREAM, 'center', false);
    hitR(x, 16, cw, 10, () => { C.cat = i; G.sel = 0; sfx('ui'); });
  }
  if (!list.length) { text('NO RECIPES HERE', N / 2, N / 2, '#6a5a4a', 'center'); return; }
  G.sel = clamp(G.sel, 0, list.length - 1);
  rowsUI(8, 30, N - 16, list, G.sel, MAXR() - 3, craftPick);
  const row = list[G.sel];
  let hint = '';
  if (row) {
    const bits = [];
    if (row.need) bits.push(row.need);
    if (row.ref.tool) bits.push('TOOL ' + IT[row.ref.tool].n);
    if (row.ref.station) bits.push(STATION_N[row.ref.station]);
    else bits.push('HANDS');
    if (row.miss && row.miss.length) bits.push('NEED: ' + row.miss.join(', '));
    hint = bits.join(' · ');
  }
  rect(6, N - 28, N - 12, 12, UI.strip); text(fitText(hint, N - 12), N / 2, N - 27, '#6a5a4a', 'center', false);
}
// ================================================================ input, title, save/load, death + best runs, main loop
const SAVE_KEY = 'sovereign.save1', NAME_KEY = 'sovereign.name', LOCAL_LB_KEY = 'sovereign.lb', LB_GAME = 'sovereign', BLANK_NAME = 'SURVIVOR';
let MODE = 'title', lbName = null; try { lbName = localStorage.getItem(NAME_KEY); } catch (e) { }
const KEYS = { up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false };
const KMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ' ': 'a', e: 'a', E: 'a', z: 'a', Z: 'a', j: 'a', J: 'a', x: 'b', X: 'b', Shift: 'b', k: 'b', K: 'b', Escape: 'back', Backspace: 'back', Enter: 'start', Tab: 'start', i: 'start', I: 'start', m: 'select', M: 'select', c: 'sneak', C: 'sneak', q: 'sneak', Q: 'sneak' };
const score = () => (G.day | 0) * 100 + Math.min(99, campSize());
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (NE.on && MODE === 'play' && PL.dead && e.key.length === 1 && /[a-z0-9\-_.]/i.test(e.key) && !e.repeat) { neType(e.key.toUpperCase()); e.preventDefault(); return; }
  if (NE.on && e.key === 'Backspace') { neType('DEL'); e.preventDefault(); return; }
  const b = KMAP[e.key]; if (!b) return; e.preventDefault(); audioInit();
  const dir = b === 'up' || b === 'down' || b === 'left' || b === 'right';
  if (e.repeat && !dir) return;
  if (b === 'back') { press('b'); return; } if (b === 'sneak') { if (MODE === 'play' && !G.ui && !PL.dead) toggleSneak(); return; }
  if (!KEYS[b] || dir) { if (b === 'b' && !KEYS.b) { G.bT = 0; G.bUI = !!G.ui || MODE !== 'play'; } if (b === 'a' && !KEYS.a) G.aT = 0; KEYS[b] = true; press(b); }
});
addEventListener('keyup', (e) => { const b = KMAP[e.key]; if (!b || !(b in KEYS)) return; KEYS[b] = false;
  if (b === 'b' && MODE === 'play' && !G.bUI && !G.ui && !PL.dead && (G.bT || 0) < 0.22 && !G.sleeping) toggleSneak(); });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
function toggleSneak() { if (PL.veh) return; PL.sneak = !PL.sneak; sfx('ui'); msg(PL.sneak ? 'SNEAKING (QUIET, SLOW)' : 'WALKING'); }
cv.addEventListener('pointerdown', (e) => { audioInit(); const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * N, y = (e.clientY - r.top) / r.height * N;
  for (let i = UIHIT.length - 1; i >= 0; i--) { const h = UIHIT[i]; if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) { e.preventDefault(); h.fn(); return; } } });
// ---- one button press, routed by screen
function navSel(d, n) { if (n <= 0) return; G.sel = ((G.sel || 0) + d + n) % n; sfx('ui'); }
function uiCount() { switch (G.ui) { case 'menu': return menuRows().length; case 'list': return G.list.items.length; case 'shop': return shopRows().length; case 'cook': return RECIPES.length; case 'craft': return craftRows().length; case 'talk': return 3;
  case 'loot': return G.loot.col === 0 ? Math.max(1, G.loot.items.length + (G.loot.items.length ? 1 : 0)) : Math.max(1, myItems().length); } return 0; }
function press(b) {
  if (MODE === 'title') return titlePress(b);
  if (PL.dead) return deadPress(b);
  if (G.sleeping) { if (b === 'b' || b === 'a') { if (G.wave) wakeUp(); else { G.sleeping = false; msg('YOU GET UP.'); } } return; }
  const ui = G.ui, up = b === 'up', dn = b === 'down';
  if (!ui) { if (b === 'a') { if (G.chan) return; const it = findInteract(); if (it) it.fn(); else if (!PL.veh) swing(); } else if (b === 'start') { G.ui = 'menu'; G.tab = G.tab || 0; G.sel = 0; sfx('open'); } else if (b === 'select') openMap(); return; }
  if (ui === 'build') { if (b === 'a') { const [tx, ty] = facingTile(); if (!inBase(tx + 0.5, ty + 0.5)) { msg('ONLY INSIDE YOUR CAMP', '#ff8a6a'); sfx('deny'); return; } if (placeBuild(G.bsel, tx, ty)) { G.saveDirty = true; if (!canBuild(G.bsel)) { msg('OUT OF MATERIALS'); G.ui = null; } } } else if (b === 'b') G.ui = null; else if (b === 'start') { G.ui = 'menu'; G.tab = 1; } return; }
  if (ui === 'map') { if (b === 'a') { G.mapZoom = G.mapZoom === 1 ? 3 : 1; G.mapCX = PL.x; G.mapCY = PL.y; sfx('ui'); } else if (b === 'b' || b === 'select' || b === 'start') G.ui = null; else if (G.mapZoom > 1) { const s = 60; if (up) G.mapCY -= s; if (dn) G.mapCY += s; if (b === 'left') G.mapCX -= s; if (b === 'right') G.mapCX += s; G.mapCX = clamp(G.mapCX, 0, WS); G.mapCY = clamp(G.mapCY, 0, WS); } return; }
  if (ui === 'report') { if (b === 'a' || b === 'b' || b === 'start') { G.ui = null; G.report = null; sfx('uiok'); } return; }
  if (ui === 'help') { if (b === 'a' || b === 'b' || b === 'start') G.ui = G.helpFrom || 'menu'; return; }
  if (up) return navSel(-1, uiCount()); if (dn) return navSel(1, uiCount());
  if (ui === 'menu') { if (b === 'left' || b === 'right') { G.tab = (G.tab + (b === 'left' ? 3 : 1)) % 4; G.sel = 0; sfx('ui'); } else if (b === 'a') menuPick(G.sel); else if (b === 'b' || b === 'start') { G.ui = null; sfx('back'); } else if (b === 'select') openMap(); return; }
  if (ui === 'list') { if (b === 'a') listPick(G.sel); else if (b === 'b') { if (G.list.back) G.list.back(); else G.ui = null; sfx('back'); } return; }
  if (ui === 'loot') { if (b === 'left' || b === 'right') { G.loot.col = b === 'left' ? 0 : 1; G.sel = clamp(G.sel, 0, uiCount() - 1); sfx('ui'); } else if (b === 'a') lootPick(); else if (b === 'b' || b === 'start') { G.ui = null; sfx('back'); } return; }
  if (ui === 'shop') { if (b === 'left' || b === 'right') { G.shop.tab = b === 'left' ? 0 : 1; G.sel = 0; sfx('ui'); } else if (b === 'a') shopPick(G.sel); else if (b === 'b' || b === 'start') { G.ui = null; sfx('back'); } return; }
  if (ui === 'cook') { if (b === 'a') cookPick(G.sel); else if (b === 'b') G.ui = null; return; }
  if (ui === 'craft') { if (b === 'left' || b === 'right') { const C = G.craft || (G.craft = { cat: 0 }); C.cat = (C.cat + (b === 'left' ? CRAFT_CATS.length - 1 : 1)) % CRAFT_CATS.length; G.sel = 0; sfx('ui'); } else if (b === 'a') craftPick(G.sel); else if (b === 'b' || b === 'start') { G.ui = null; sfx('back'); } return; }
  if (ui === 'talk') { if (b === 'a') talkPick(G.sel); else if (b === 'b') { G.ui = null; G.talkSay = null; } return; }
}
// ---- v6: the run in progress is remembered silently (server first, this device as a cache). No save/load UI:
// it syncs on a timer, on door enter/exit, at sleep/dawn, and when the page is hidden. Death or power off→on ends it for good.
const ENDED_KEY = 'sovereign.ended';
const G_KEEP = ['seed', 'v', 'day', 'time', 'money', 'base', 'crops', 'recruits', 'looted', 'zk', 'npc', 'gone', 'rain', 'kills', 'stock', 'pumps', 'seenNames', 'started', 'awake', 'drops', 'totalT', 'tab', 'rid'];
const P_KEEP = ['x', 'y', 'dir', 'face', 'hp', 'sta', 'hun', 'thi', 'str', 'strXP', 'inv', 'veh', 'sneak'];
const SYNC = { busy: false, last: 0, pending: false, dead: new Set(), okAt: 0, flushP: null, n: 0 };
function newRid() { const a = new Uint8Array(16); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 16; i++) a[i] = (Math.random() * 256) | 0; } return 'r' + Array.from(a, (b) => (b % 36).toString(36)).join(''); }
function endedList() { try { const l = JSON.parse(localStorage.getItem(ENDED_KEY)); return Array.isArray(l) ? l.filter((e) => e && typeof e === 'object') : []; } catch (e) { return []; } }
function setEnded(l) { try { localStorage.setItem(ENDED_KEY, JSON.stringify(l.slice(-24))); } catch (e) { } }
function isEnded(rid) { return !!rid && (SYNC.dead.has(rid) || endedList().some((e) => e.r === rid)); }
function validRun(s) { return !!(s && typeof s === 'object' && s.v >= 5 && s.v <= VERSION && typeof s.seed === 'number' && s.g && typeof s.g === 'object' && s.p && Array.isArray(s.mod) && Array.isArray(s.build)); }
function hasSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return validRun(s) && !isEnded(s.g.rid) ? s : null; } catch (e) { return null; } }
function runSnapshot() {
  const g = {}; for (const k of G_KEEP) g[k] = G[k];
  const r = []; let cur = 0, n = 0; for (let i = 0; i < G.fog.length; i++) { const v = G.fog[i] ? 1 : 0; if (v === cur) n++; else { r.push(n); cur = v; n = 1; } } r.push(n); g.fogR = r; // run-length fog (0s first)
  const p = {}; for (const k of P_KEEP) p[k] = PL[k];
  const vehs = []; for (const v of VEHS.values()) if (v.touched || v.trunk) { G.gone[v.id] = 1; vehs.push(v); }
  return { v: VERSION, seed: G.seed, g, p, mod: [...MOD.entries()], build: [...BUILD.values()], vehs, at: Date.now() }; }
/** Remember the run (silent): this device now, the server right after (throttled). */
function saveGame(why) {
  if (MODE !== 'play' || !G || G.demo || PL.dead || !G.rid || isEnded(G.rid)) return false;
  const data = runSnapshot(); let ok = false;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); ok = true; } catch (e) { }
  G.saveDirty = false; pushRun(data, why === 'hide'); return ok; }
function pushRun(data, hide) {
  const A = MA(); if (!A || !A.runPut) { SYNC.pending = true; SYNC.last = Date.now(); return; }
  const rid = data.g.rid; if (isEnded(rid)) return;
  const t = Date.now(); if (!hide && (SYNC.busy || t - SYNC.last < 4000)) { SYNC.pending = true; return; }
  SYNC.last = t; SYNC.pending = false; if (!hide) SYNC.busy = true;
  const gate = Promise.all([RUN && RUN.startP, SYNC.flushP]); // a guest's first id comes from startPlay; wipes go out first
  gate.then(() => (isEnded(rid) ? null : A.runPut(LB_GAME, rid, data, hide))).then((r) => { if (!hide) SYNC.busy = false;
    if (r && r.status === 200) { SYNC.okAt = Date.now(); SYNC.n++; }
    else if (r && r.status === 410 && G.rid === rid && MODE === 'play' && !PL.dead) runEndedElsewhere(rid); }).catch(() => { if (!hide) SYNC.busy = false; }); }
/** End the stored run for good (death, abandon, power-cycle): drop this device's copy and tell the server (retried until it lands). */
function endStoredRun(all) {
  const s = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } })();
  const rids = [...new Set([G && !G.demo ? G.rid : null, s && s.g ? s.g.rid : null].filter(Boolean))];
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  const l = endedList(); for (const r of rids) { SYNC.dead.add(r); l.push({ r, all: all ? 1 : 0, t: Date.now() }); }
  if (all && !rids.length) l.push({ r: null, all: 1, t: Date.now() }); setEnded(l); return flushEnded(); }
function flushEnded() {
  const A = window.MembersAuth; if (!A || !A.ready) return Promise.resolve();
  const p = A.ready.then(() => { if (!A.available || !A.runEnd) return; const todo = endedList().filter((e) => !e.done);
    return Promise.all(todo.map((e) => A.runEnd(LB_GAME, e.r, e.all).then((r) => { if (r && r.status === 200) { const l = endedList(); for (const x of l) if (x.r === e.r && x.t === e.t) x.done = 1; setEnded(l); } }))); }).catch(() => { });
  SYNC.flushP = p; return p; }
function runEndedElsewhere(rid) { SYNC.dead.add(rid); try { localStorage.removeItem(SAVE_KEY); } catch (e) { } toTitle(); TT.note = 'THAT RUN ENDED ON ANOTHER DEVICE.'; }
function loadGame(s) {
  newRun(s.seed); Object.assign(G, s.g); G.fog = new Uint8Array(NC * NC);
  if (Array.isArray(s.g.fogR)) { let i = 0, v = 0; for (const n of s.g.fogR) { const e = Math.min(G.fog.length, i + (n | 0)); if (v) G.fog.fill(1, i, e); i = e; v ^= 1; } delete G.fogR; }
  else if (typeof s.g.fog === 'string') for (let i = 0; i < s.g.fog.length; i++) G.fog[i] = s.g.fog[i] === '1' ? 1 : 0;
  if (!G.rid) G.rid = newRid();
  G.msgs = []; G.wave = null; G.alive = true; G.drops = G.drops || []; G.totalT = G.totalT || 0; Object.assign(PL, s.p);
  for (const [k, t] of s.mod) MOD.set(k, t); for (const b of s.build) BUILD.set(tkey(b.x, b.y), b); for (const v of s.vehs) VEHS.set(v.id, v);
  if (PL.veh && !VEHS.has(PL.veh)) PL.veh = null; resizePack(PL.inv);
  PL.invuln = 0; { const b = buildingAt(PL.x, PL.y); PL._bid = b ? b.id : null; }
  for (const r of G.recruits) { const b = BUILD.get(r.bunk); if (b) { r.x = b.x + 0.5; r.y = b.y + 1.2; } }
  if (G.base && (G.time >= 22 * 60 || G.time < 5 * 60)) startWave(inBase(PL.x, PL.y, BASE_R + 6));
}
addEventListener('pagehide', () => saveGame('hide')); document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame('hide'); });
// ---- one leaderboard record per run session (server when signed in, else this device)
const MA = () => (window.MembersAuth && window.MembersAuth.available ? window.MembersAuth : null);
let RUN = null;
function lbRunStart() { const r = { g: G, play: null, board: null, posted: false, posting: false, local: false, done: false }; RUN = r; const A = window.MembersAuth;
  if (A && A.ready) r.startP = A.ready.then(() => (A.available ? A.startPlay(LB_GAME) : null)).then((id) => { r.play = id || null; }).catch(() => { }); }
function localBoard() { let l = []; try { l = JSON.parse(localStorage.getItem(LOCAL_LB_KEY)) || []; } catch (e) { } return Array.isArray(l) ? l : []; }
function lbRunEnd() {
  const r = RUN; if (!r || r.g !== G || r.done) return; r.done = true; r.score = score(); r.days = G.day; r.camp = campSize(); r.kills = G.kills;
  const A = MA(), fallback = () => { if (r.local) return; r.local = true; r.wantPost = true; r.board = null; };
  if (!A || !r.play) { fallback(); return; }
  A.endPlay(r.play, { outcome: 'died', score: r.score, meta: { days: r.days, camp: r.camp, kills: r.kills, ms: Math.round((G.totalT || 0) * 1000) } })
    .then((p) => (p ? A.leaderboard(LB_GAME) : null))
    .then((b) => { if (!b || b.status !== 200 || !b.json) { fallback(); return; } r.board = b.json; const me = b.json.me; r.wantPost = !me || r.score > me.value; if (!r.wantPost) r.posted = true; else if (r.postOnReady) lbPost(r); })
    .catch(fallback);
}
function lbPost(r) { if (!r) return; r.postOnReady = true; if (r.posted || r.posting || lbName === null) return;
  if (r.local) { const l = localBoard(), me = { name: lbName || BLANK_NAME, score: r.score, days: r.days, camp: r.camp, t: Date.now() }; l.push(me); l.sort((a, b) => b.score - a.score || a.t - b.t); const top = l.slice(0, 20); try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(top)); } catch (e) { }
    r.board = { local: true, top: top.map((e, i) => ({ rank: i + 1, name: e.name, value: e.score, mine: e === me })) }; r.posted = true; return; }
  if (!r.board) return; const A = MA(); if (!A) return; r.posting = true;
  A.postLeaderboard(LB_GAME, r.play, lbName || '').then((res) => { r.posting = false;
    if (res.status === 201 && res.json) { r.posted = true; r.board = res.json; r.entry = res.json.entry; return; }
    const err = res.json && res.json.error; if (err === 'name_not_allowed' || err === 'bad_name') { lbName = null; try { localStorage.removeItem(NAME_KEY); } catch (e) { } neOpen(); return; }
    r.posted = true; r.err = err || 'offline'; }).catch(() => { r.posting = false; r.posted = true; r.err = 'offline'; }); }
// ---- name entry grid
const NE = { on: false, name: '', cur: 0 }, NE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.', NE_KEYS = NE_CHARS.split('').concat(['SPC', 'DEL', 'OK']), NE_COLS = 8;
function neOpen() { NE.on = true; NE.name = lbName || ''; NE.cur = 0; }
function neType(k) { if (k === 'OK') { const nm = NE.name.trim(); lbName = nm; try { localStorage.setItem(NAME_KEY, nm); } catch (e) { } NE.on = false; sfx('uiok'); if (RUN) lbPost(RUN); return; }
  if (k === 'DEL') NE.name = NE.name.slice(0, -1); else if (k === 'SPC') { if (NE.name.length < 12 && NE.name) NE.name += ' '; } else if (NE.name.length < 12) NE.name += k; sfx('ui'); }
function drawNameGrid() { const cw = Math.floor((N - 24) / NE_COLS), ch = 13, x0 = Math.floor((N - cw * NE_COLS) / 2), y0 = 64;
  panel(6, 26, N - 12, N - 40, CREAM, 2); text('NAME FOR THE BEST RUNS', N / 2, 30, INK, 'center', false);
  panel(x0, 42, cw * NE_COLS, 14, '#efe2c4', 1); text((NE.name || '') + ((G.clock * 2 | 0) & 1 ? '_' : ' '), N / 2, 45, INK, 'center', false);
  NE_KEYS.forEach((k, i) => { const cx = x0 + (i % NE_COLS) * cw, cy = y0 + ((i / NE_COLS) | 0) * ch; if (i === NE.cur) rect(cx, cy, cw - 1, ch - 1, '#ffd76a'); text(k, cx + cw / 2, cy + 2, k === 'OK' ? '#3a8a3a' : k === 'DEL' ? '#a83a2a' : INK, 'center', false); hitR(cx, cy, cw, ch, () => { NE.cur = i; neType(k); }); });
  text(lbName === null && !NE.name ? 'BLANK = ' + BLANK_NAME : '', N / 2, y0 + 6 * ch + 4, '#6a5a4a', 'center', false); }
// ---- death screen
function deadPress(b) { if (G.deadT < 1.2) return;
  if (NE.on) { const n = NE_KEYS.length; if (b === 'left') NE.cur = (NE.cur + n - 1) % n; else if (b === 'right') NE.cur = (NE.cur + 1) % n; else if (b === 'up') NE.cur = (NE.cur + n - NE_COLS) % n; else if (b === 'down') NE.cur = (NE.cur + NE_COLS) % n; else if (b === 'a') neType(NE_KEYS[NE.cur]); else if (b === 'b') neType('DEL'); else if (b === 'start') neType('OK'); if (b !== 'a') sfx('ui'); return; }
  if (b === 'a' || b === 'start') { toTitle(); sfx('uiok'); } }
function drawDead() { const t = G.deadT; hx.fillStyle = 'rgba(40,0,0,' + Math.min(0.75, t * 0.5) + ')'; hx.fillRect(0, 0, N, N); if (t < 1.2) return;
  const r = RUN; if (r && r.wantPost && !r.posted && lbName === null && !NE.on && !r.asked) { r.asked = true; neOpen(); } if (r && r.wantPost && !r.posted && lbName !== null && !r.posting) lbPost(r);
  if (NE.on) return drawNameGrid();
  panel(8, 8, N - 16, N - 16, CREAM, 2); text('YOU DIED', N / 2, 13, '#a83a2a', 'center', false, 2); text(G.why || '', N / 2, 34, INK, 'center', false);
  text('DAYS ' + G.day + '   CAMP ' + campSize() + '   KILLS ' + G.kills, N / 2, 46, '#5a4a3a', 'center', false); text('SCORE ' + score(), N / 2, 57, '#8a6a2a', 'center', false);
  const B = r && r.board; let y = 72; text(B && B.local ? 'BEST RUNS (THIS DEVICE)' : 'BEST RUNS', N / 2, y, '#3a5a8a', 'center', false); y += 11;
  if (!B) text(r && r.posting ? 'POSTING...' : r && !r.done ? '' : 'LOADING...', N / 2, y, '#6a5a4a', 'center', false);
  else { const rows = (B.top || []).slice(0, Math.floor((N - y - 26) / 10)); for (const e of rows) { const mine = e.mine || (r.entry && e.id === r.entry.id); if (mine) rect(14, y - 1, N - 28, 10, '#ffd76a'); text(e.rank + '. ' + String(e.name).replace(/&amp;/g, '&').slice(0, 12), 18, y, INK, 'left', false); text(String(e.value), N - 18, y, '#5a4a3a', 'right', false); y += 10; }
    if (B.me && !rows.some((e) => e.mine)) text('YOU: #' + B.me.rank + '  ' + B.me.value, N / 2, y + 2, '#8a6a2a', 'center', false); }
  text('A: NEW RUN', N / 2, N - 22, INK, 'center', false); hitR(8, N - 26, N - 16, 16, () => deadPress('a')); }
// ---- title screen (the next world pans behind it)
const TT = { sel: 0, sub: null, t: 0, board: null, save: null, note: null };
const BOOT = { on: true };
function toTitle() { MODE = 'title'; TT.save = hasSave(); TT.note = null; TT.confirm = false; const seed = TT.save ? TT.save.seed : (Math.random() * 1e9) | 0; if (!WD || G.seed !== seed || !G.demo) { newRun(seed); MAPI.row = 0; } G.demo = true; G.drops = []; TT.sel = 0; TT.sub = null; NE.on = false; CAM.x = PL.x; CAM.y = PL.y; }
/** Shell power off→on: wipe mid-run save and cold-boot to title (fresh world), like Last Tower bootOn. */
function onHandheldPower(on) {
  if (!on) return;
  BOOT.on = false; endStoredRun(true); // this device + the server copy
  NE.on = false;
  if (G) { G.ui = null; G.wave = null; G.report = null; G.sleeping = false; G.chan = null; G.loot = null; }
  newRun((Math.random() * 1e9) | 0); MAPI.row = 0;
  MODE = 'title'; G.demo = true; G.drops = [];
  TT.save = null; TT.sel = 0; TT.sub = null; TT.confirm = false; TT.board = null;
  CAM.x = PL.x; CAM.y = PL.y;
}
function titleItems() { if (BOOT.on) return []; return (TT.save ? [{ t: 'BACK TO DAY ' + TT.save.g.day, fn: () => startGame(true) }] : []).concat([{ t: 'NEW RUN', fn: () => startGame(false) }, { t: 'BEST RUNS', fn: openBest }, { t: 'HOW TO SURVIVE', fn: () => { TT.sub = 'help'; } }]); }
function openBest() { TT.sub = 'best'; TT.board = { local: localBoard() }; const A = window.MembersAuth; if (A && A.ready) A.ready.then(() => (A.available ? A.leaderboard(LB_GAME) : null)).then((b) => { if (b && b.status === 200 && b.json) TT.board.server = b.json; }).catch(() => { }); }
function titlePress(b) { if (BOOT.on) return; if (TT.sub) { if (b === 'a' || b === 'b' || b === 'start') { TT.sub = null; sfx('back'); } return; } if (TT.confirm) { if (b === 'a') { TT.confirm = false; startGame(false, true); } else if (b === 'b') TT.confirm = false; return; }
  const it = titleItems(); if (b === 'up') { TT.sel = (TT.sel + it.length - 1) % it.length; sfx('ui'); } else if (b === 'down') { TT.sel = (TT.sel + 1) % it.length; sfx('ui'); } else if (b === 'a' || b === 'start') { sfx('uiok'); it[TT.sel].fn(); } }
function startGame(cont, sure) {
  if (cont) { const s = typeof cont === 'object' ? cont : hasSave(); if (s) { loadGame(s); MAPI.row = 0; } else return; }
  else { if (TT.save && !sure) { TT.confirm = true; return; } const seed = TT.save ? (Math.random() * 1e9) | 0 : G.seed; if (TT.save) endStoredRun(false); if (seed !== G.seed) MAPI.row = 0; newRun(seed);
    G.totalT = 0; G.drops = []; G.rid = newRid(); }
  TT.save = null; TT.confirm = false;
  MODE = 'play'; G.demo = false; G.ui = null; G.sel = 0; G.tab = 0; CAM.x = PL.x; CAM.y = PL.y; lbRunStart();
  if (!cont) { msg('WALK QUIET. EVERY DOOR OPENS.', '#c8a050'); msg('ONE BITE AND YOU ARE DEAD.', '#c85040'); } else msg('DAY ' + G.day + '. WELCOME BACK.', '#ffd76a');
  saveGame(); }
function drawTitle() { TT.t += 1 / 60;
  const big = N >= 220 ? 3 : 2; winBox(10, 14, N - 20, 36 + 6 * big, 'blue'); text('SOVEREIGN', N / 2, 21, '#f0c850', 'center', true, big);
  { const oy = 21 + 7 * big + 3, hw = Math.min(70, N / 2 - 22); rect(N / 2 - hw, oy, hw - 4, 1, '#c89430'); rect(N / 2 + 4, oy, hw - 4, 1, '#c89430'); rect(N / 2 - 2, oy - 1, 4, 3, '#f0c850'); rect(N / 2 - 1, oy - 2, 2, 5, '#f0c850'); rect(N / 2 - 1, oy, 2, 1, '#fff4c0'); }
  text('ONE BITE. BUILD ANYWAY.', N / 2, 30 + 8 * big, '#c8d0ff', 'center');
  if (TT.sub === 'help') { panel(8, 62, N - 16, N - 72, CREAM, 2); let y = 66; for (const l of HELP) { text(fitText(l, N - 24), 12, y, INK, 'left', false); y += 10; } hitR(0, 0, N, N, () => titlePress('b')); return; }
  if (TT.sub === 'best') { panel(8, 62, N - 16, N - 72, CREAM, 2); const S = TT.board.server, rows = S ? S.top || [] : TT.board.local.map((e, i) => ({ rank: i + 1, name: e.name, value: e.score })); text(S ? 'BEST RUNS' : 'BEST RUNS (THIS DEVICE)', N / 2, 66, '#3a5a8a', 'center', false); let y = 78;
    if (!rows.length) text('NO RUNS YET. SURVIVE!', N / 2, y, '#6a5a4a', 'center', false);
    for (const e of rows.slice(0, Math.floor((N - 100) / 10))) { text(e.rank + '. ' + String(e.name).replace(/&amp;/g, '&').slice(0, 12), 14, y, e.mine ? '#a83a2a' : INK, 'left', false); text(String(e.value), N - 14, y, '#5a4a3a', 'right', false); y += 10; }
    text('SCORE = DAYS x100 + CAMP', N / 2, N - 22, '#6a5a4a', 'center', false); hitR(0, 0, N, N, () => titlePress('b')); return; }
  const it = titleItems(), y0 = Math.round(N * 0.5); panel(N / 2 - 70, y0 - 6, 140, it.length * 14 + 10, CREAM, 2);
  it.forEach((o, i) => { const y = y0 + i * 14; if (i === TT.sel) { rect(N / 2 - 66, y - 2, 132, 13, UI.sel); handCursor(N / 2 - 64, y + 1); } text(o.t, N / 2, y, INK, 'center', false); hitR(N / 2 - 70, y - 3, 140, 14, () => { TT.sel = i; titlePress('a'); }); });
  if (TT.confirm) { panel(14, N / 2 - 20, N - 28, 40, '#ffd76a', 2); text(fitText('ABANDON THIS RUN FOR GOOD?', N - 32), N / 2, N / 2 - 14, INK, 'center', false); text('A: YES    B: NO', N / 2, N / 2 + 2, INK, 'center', false); hitR(14, N / 2 - 20, (N - 28) / 2, 40, () => titlePress('a')); hitR(N / 2, N / 2 - 20, (N - 28) / 2, 40, () => titlePress('b')); }
  if (BOOT.on) text('WAKING UP' + '.'.repeat((G.clock * 3 | 0) % 4), N / 2, y0, CREAM, 'center');
  if (TT.note) text(fitText(TT.note, N - 16), N / 2, y0 - 18, '#ff8a6a', 'center');
  text(touchDev ? 'A: SELECT' : 'ARROWS + SPACE', N / 2, N - 12, CREAM, 'center'); }
// ---- main loop
let lastT = performance.now(), saveT = 20, promptT = 0, fogT = 0;
function step(dt) {
  G.clock = (G.clock || 0) + dt; buildMapRows(MODE === 'title' ? 2 : 3); CAM.shake = Math.max(0, CAM.shake - dt * 2);
  if (MODE === 'title') { const t = G.clock * 0.05; CAM.x = WD.spawn.x + Math.sin(t) * 40; CAM.y = WD.spawn.y + Math.sin(t * 0.7) * 24; PL.x = CAM.x; PL.y = CAM.y; G.time = 7 * 60 + Math.sin(t * 0.3) * 0; updateActive(); updateZombies(dt); updateFX(dt); ambUpdate(dt); musicUpdate(dt); return; }
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter((m) => m.t > 0);
  if (PL.dead) { G.deadT += dt; updateZombies(dt); updateFX(dt); musicUpdate(dt); return; }
  if (KEYS.b) G.bT = (G.bT || 0) + dt; if (KEYS.a) G.aT = (G.aT || 0) + dt;
  const paused = G.ui && G.ui !== 'build';
  if (!paused) {
    G.totalT = (G.totalT || 0) + dt;
    const rate = G.sleeping ? (G.wave ? 2 : 22) : 2; updateTime(dt, rate);
    if (G.report) { if (G.sleeping) { G.sleeping = false; G.ui = 'report'; sfx('uiok'); saveGame(); } else { const W = G.report.wave; msg('DAWN. DAY ' + G.day + (W ? '. ' + W.killed + '/' + W.total + ' KILLED' : ''), '#ffd76a'); if (G.report.left.length) msg(G.report.left.join(', ') + ' LEFT HUNGRY', '#ff8a6a'); G.report = null; } }
    updateActive(); updateZombies(dt); updateWave(dt); updateNPCs(dt);
    let ix = 0, iy = 0; if (!G.sleeping) { ix = (KEYS.right ? 1 : 0) - (KEYS.left ? 1 : 0); iy = (KEYS.down ? 1 : 0) - (KEYS.up ? 1 : 0); updatePlayer(dt, ix, iy); }
    updateChan(dt); if (KEYS.a && G.aT > 0.35 && !G.ui && !G.chan && !PL.veh && !G.sleeping && !G.aInteract) swing();
    updateFX(dt);
  }
  promptT -= dt; if (promptT <= 0) { promptT = 0.12; const it = !G.ui && !G.sleeping && !G.chan ? findInteract() : null; G.prompt = it ? 'A: ' + it.lab : null; G.aInteract = !!it; }
  const tx = G.sleeping && G.base ? G.base.x + 0.5 : PL.x, ty = G.sleeping && G.base ? G.base.y + 0.5 : PL.y; if (Math.hypot(CAM.x - tx, CAM.y - ty) > 12) { CAM.x = tx; CAM.y = ty; } else { const k = Math.min(1, dt * 10); CAM.x = lerp(CAM.x, tx, k); CAM.y = lerp(CAM.y, ty, k); }
  fogT -= dt; if (fogT <= 0) { fogT = 0.5; markFog(); }
  engineUpdate(); ambUpdate(dt); musicUpdate(dt);
  saveT -= dt; if (saveT <= 0) { saveT = 15; saveGame('tick'); }
  if (G.syncSoon > 0) { G.syncSoon -= dt; if (G.syncSoon <= 0) { G.syncSoon = 0; saveGame('door'); } }
  if (SYNC.pending && !SYNC.busy && Date.now() - SYNC.last > 4200) saveGame('retry');
}
function render() {
  UIHIT = []; hx.setTransform(1, 0, 0, 1, 0, 0); hx.globalAlpha = 1;
  if (MODE === 'title') { drawWorld(); drawLight(); drawTitle(); return; }
  if (G.ui === 'map') { drawMap(); hitR(0, 0, N, N, () => press('a')); hitR(4, 3, N - 8, 11, () => press('b')); return; }
  drawWorld(); drawRain(); drawLight();
  if (PL.dead) { drawDead(); return; }
  drawHUD(); const ms = N < 200 ? 40 : 52; if (!G.ui) { hitR(N - ms - 3, 3, ms, ms, () => openMap()); hitR(3, N - 22, 34, 16, () => press('start')); }
  if (G.sleeping) { const t = (G.clock * 2 | 0) % 4; panel(N / 2 - 50, N / 2 - 40, 100, 24, 'rgba(14,11,16,0.7)', 0); text('SLEEPING' + '.'.repeat(t), N / 2, N / 2 - 37, '#8ab0ff', 'center'); text(G.wave ? 'THE HORDE IS HERE' : 'A/B: GET UP', N / 2, N / 2 - 27, CREAM, 'center'); }
  switch (G.ui) { case 'menu': drawMenu(); break; case 'list': drawList(); break; case 'loot': drawLoot(); break; case 'shop': drawShop(); break; case 'cook': drawCook(); break; case 'craft': drawCraft(); break; case 'talk': drawTalk(); break; case 'report': drawReport(); hitR(0, 0, N, N, () => press('a')); break; case 'help': drawHelp(); break; }
  if (G.ui && G.ui !== 'build' && G.ui !== 'report' && G.ui !== 'help') hitR(N - 18, 4, 14, 12, () => press('b')), text('X', N - 11, 5, CREAM, 'center');
}
function loop(now) { const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now; if (POWER) { try { step(dt); render(); } catch (e) { console.error(e); window.__sovErr = String(e && e.stack || e); } } requestAnimationFrame(loop); }
// ---- boot
// v6 boot: resume the run this player is in (server copy wins; this device's copy covers offline), else the title.
function bootResume() {
  const A = window.MembersAuth, local = hasSave(), wait = (ms) => new Promise((r) => setTimeout(() => r('timeout'), ms));
  const ask = (A && A.ready ? A.ready : Promise.resolve()).then(() => { if (!A || !A.available || !A.runGet) return null; return flushEnded().then(() => A.runGet(LB_GAME, local && local.g.rid)); });
  Promise.race([ask, wait(6000)]).then((r) => pickRun(local, r), () => pickRun(local, null)); }
function pickRun(local, r) {
  if (!BOOT.on) return; BOOT.on = false; local = local && hasSave() ? local : null; let run = local;
  if (r && r.status === 200 && r.json) {
    const s = r.json.run, sv = validRun(s) && !isEnded(s.g.rid) ? s : null;
    if (sv) run = local && local.g.rid && local.g.rid === sv.g.rid && (local.at || 0) > (sv.at || 0) ? local : sv;
    else if (r.json.ended) { if (local) { SYNC.dead.add(local.g.rid); try { localStorage.removeItem(SAVE_KEY); } catch (e) { } } run = null; } }
  BOOT.src = run ? (run === local ? 'local' : 'server') : 'none';
  if (MODE !== 'title') return; if (run) startGame(run); else toTitle(); }
addEventListener('resize', resize); resize(); buildAtlas(); buildTrees(); toTitle(); requestAnimationFrame(loop); bootResume();
window.__sov = { get G() { return G; }, get PL() { return PL; }, get MODE() { return MODE; }, press, saveGame, startGame, endStoredRun, hasSave, SYNC, BOOT, runSnapshot, onHandheldPower, get TT() { return TT; }, KEYS, WD: () => WD, BUILD, VEHS, NPCS, get ZOMS() { return ZOMS; }, IT, addItem, foundBase: (x, y) => foundBase(x, y), die, openCraft, CRAFT_R, craftReady, spawnZ, buildingAt, chunk, get NC() { return NC; }, get CH() { return CH; }, get N() { return N; } };
