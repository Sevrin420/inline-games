/* LAST TOWER v4 (chikn edition): 3/4 top-down pixel survival, reskinned in the hens.farm cartoon vibe (HENS-STYLE-NOTES.md).
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
  asphalt: ['#e2c08a', '#d0a96e', '#b48c56', '#86643c'],   // dirt farm track
  walk: ['#ffe68a', '#f6cf55', '#d9ab38', '#9c7424'],      // straw verge
  plaza: ['#fffdf5', '#f3ecd4', '#ddd1ac', '#a99c76'],     // cream farmyard
  grass: ['#52e67e', '#22d457', '#0aa83f', '#036b2b'],
  dirt: ['#c39260', '#a77748', '#855a36', '#5a3c26'],      // tilled field
  brick: ['#ff6470', '#ef3646', '#bd2232', '#7c1422'],     // barn red
  conc: ['#ffffff', '#efebde', '#cfc8b2', '#8f8a78'],      // whitewash
  tower: ['#f0c27e', '#d69e5a', '#a87840', '#6e4c28'],     // coop planks
  roof: ['#7a8894', '#5f6c78', '#47525d', '#2c343c'],      // slate barn roof
  rust: ['#ffb24a', '#f0901e', '#c06a16', '#7e420e'],
  metal: ['#e4e8ea', '#bfc6cb', '#939ba2', '#5c636a'],
  hazard: ['#ffe066', '#ffc42f', '#d89a14', '#8c6214'],
  car1: ['#56e886', '#14c94e', '#0a9238', '#055a22'],      // tractor green
  car2: ['#ff6a78', '#ff3347', '#c8202f', '#80141f'],      // tractor red
  car3: ['#ffe066', '#ffc42f', '#d49a1c', '#8c6214'],      // tractor yellow
  glass: ['#e2f6ff', '#8ed8ff', '#58aedc', '#2e6c96'],
  lit: ['#fff4b0', '#ffd23f', '#e09a20', '#8a5a14'],
  wood: ['#d09a5a', '#a87440', '#7e5430', '#523620'],
  fire: ['#fff6c8', '#ffc42f', '#ff7a1a', '#d0301c'],
  water: ['#b8e8ff', '#8ed8ff', '#5ab0e0', '#2f6f9a'],
  blood: ['#9ac83a', '#6e9a26', '#4c701a', '#2e4610'],      // zombie goo (green, cartoon-friendly)
  hay: ['#fff0a0', '#ffd659', '#e2ae2e', '#a07418'],
  worm: ['#ffc4ca', '#ff9aa4', '#e0606a', '#a03a44'],
  leaf: ['#5ce88a', '#22c95a', '#0d9a42', '#056028'],
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
const DARK_SHADOW = 'rgba(9,11,10,0.26)'; // hard ink offset shadows, like hens.farm's 6px 7px 0 ink card shadows
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
  '<': [0x08, 0x14, 0x22, 0x41], '(': [0x1C, 0x22, 0x41], ')': [0x41, 0x22, 0x1C], '&': [0x36, 0x49, 0x55, 0x22, 0x50], "'": [0x05, 0x03], '*': [0x2A, 0x1C, 0x3E, 0x1C, 0x2A], '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12],
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
    if ((opt.flat || '').includes(m)) t = 1;
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
const bob = (upper) => ['.'.repeat(upper[0].length), ...upper.slice(0, upper.length - 1)];
function henFrames(down, up, side) {
  const dW2 = HLEGS.dWalk.map(flipRow);
  const D = [[...down, ...HLEGS.dStand], [...bob(down), ...HLEGS.dWalk], [...down, ...HLEGS.dStand], [...bob(down), ...dW2]];
  const U = [[...up, ...HLEGS.dStand], [...bob(up), ...HLEGS.dWalk], [...up, ...HLEGS.dStand], [...bob(up), ...dW2]];
  const R = [[...side, ...HLEGS.sStand], [...bob(side), ...HLEGS.sStride], [...side, ...HLEGS.sPass], [...bob(side), ...HLEGS.sStride]];
  const Lf = R.map((f) => f.map(flipRow));
  return [D, U, Lf, R]; // rows: down, up, left, right
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
function atlas(frames, mats, opt) {
  const cw = frames[0][0][0].length, ch = frames[0][0].length;
  const [c, x] = mk(cw * 4, ch * 4);
  frames.forEach((row, ri) => row.forEach((f, fi) => x.drawImage(paint(f, mats, opt), fi * cw, ri * ch)));
  // silhouette version (outline recoloured bright, body faint) for the "never hidden" pass
  const [s, sx] = mk(c.width, c.height); sx.drawImage(c, 0, 0);
  const id = sx.getImageData(0, 0, c.width, c.height), d = id.data, [or, og, ob] = hex(OUT);
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; if (d[i] === or && d[i + 1] === og && d[i + 2] === ob) { d[i] = 255; d[i + 1] = 214; d[i + 2] = 60; } else { d[i] = 255; d[i + 1] = 250; d[i + 2] = 230; d[i + 3] = 80; } }
  sx.putImageData(id, 0, 0);
  return { img: c, sil: s, cw, ch };
}
const zFrames = (seed) => henFrames(zombify(HEN_DOWN, seed), zombify(HEN_UP, seed + 1), zombify(HEN_SIDE, seed + 2));
const HEN_MATS = { R: 'comb', W: 'feather', w: 'fshade', k: 'ink', Y: 'beak', O: 'leg', A: 'bandana' };
const SPR = {
  player: atlas(henFrames(HEN_DOWN, HEN_UP, HEN_SIDE), HEN_MATS, { flat: 'RkYOAw', noFold: 'kYRA' }),
  zombies: ['zf1', 'zf2', 'zf3'].map((f, i) => atlas(zFrames(11 + i * 7), { R: 'zcomb', W: f, w: f, e: 'eyeZ', Y: 'beak', O: 'leg', g: 'blood' }, { flat: 'eYOg', dark: 'w', noFold: 'eY' })),
  brute: atlas(zFrames(99).map((row) => row.map(widen)), { R: 'comb', W: 'rooster', w: 'rtail', e: 'eyeB', Y: 'beak', O: 'leg', g: 'blood' }, { flat: 'eYOg', noFold: 'eY' }),
};
// ---- items (16x16 cells): chikn pantry and farm arsenal
const ITEMS = ['food', 'mre', 'med', 'ammo', 'shells', 'pipe', 'machete', 'pistol', 'shotgun', 'water'];
const ITEM_ART = {
  food: [['.....YY...', '....YyYY..', '....YYyY..', '...YyYYY..', '...YYyYY..', '..gYyYYg..', '..ggYYgg..', '.gg.gg.gg.', '.g..gg..g.'], { Y: 'hazard', y: 'rust', g: 'leaf' }],          // corn cob
  mre: [['..t....t..', '...tttt...', '..ssssss..', '.ssssssss.', '.sBBBBBBs.', '.sBssssBs.', '.sBBBBBBs.', '.ssssssss.', '..ssssss..'], { s: 'tower', t: 'wood', B: 'brick' }],            // $FEED sack
  med: [['...GGGG...', '..GgGGGG..', '.GgGGGGGG.', '.GGGGGGGG.', 'GGGGGGGGGG', 'GGGGGGGGGG', 'GGGGGGGGGG', '.GGGGGGGG.', '..GGGGGG..'], { G: 'hazard', g: 'glint' }],              // golden HEGG
  ammo: [['.ee...ee...ee.', 'eeee.eeee.eeee', 'eeee.eeee.eeee', 'cccccccccccccc', 'cCcCcCcCcCcCcc'], { e: 'feather', c: 'tower', C: 'wood' }],                                         // eggs
  shells: [['....yy....', '...yYYy...', '..yYYYYy..', '.yYYyYYYy.', 'yYYYYYyYYy', 'yyyyyyyyyy'], { Y: 'hazard', y: 'rust' }],                                                          // corn kernels
  pipe: [['......m.m.m', '......mmmmm', '........w..', '.......w...', '......w....', '.....w.....', '....w......', '...w.......', '..w........', '.w.........'], { m: 'metal', w: 'wood' }], // rake
  machete: [['.....m.m.m', '.....m.m.m', '.....mmmmm', '.......w..', '......w...', '.....w....', '....w.....', '...w......', '..w.......', '.w........'], { m: 'metal', w: 'wood' }],    // pitchfork
  pistol: [['...ee......', '..eeeegggg.', '.gggggggggg', '.gggggg....', '.gb........', '.bb........'], { e: 'feather', g: 'car2', b: 'wood' }],                                         // egg blaster
  shotgun: [['...YYYY.....', '..YyYyY.....', 'gggggggggwww', 'gggggggwwwww', '.......wwwww', '........ww..'], { g: 'car1', w: 'wood', Y: 'hazard', y: 'rust' }],                       // corn shotgun
  water: [['....pp......', '...pppp..pp.', '..pp..pppppp', '.pp....pp...', 'pp..........'], { p: 'worm' }],                                                                              // juicy worm
};
const ITEM_IMG = (() => {
  const [c, x] = mk(16 * ITEMS.length, 16);
  ITEMS.forEach((k, i) => { const [g, m] = ITEM_ART[k]; const p = paint(['', ...g.map((r) => '.' + r)], m, { flat: 'gyCtBe' }); x.drawImage(p, i * 16 + Math.floor((16 - p.width) / 2), 16 - p.height - 1); });
  return c;
})();

// ================================================================ world: 80x80 metatiles of 16x16, with height levels (3/4 view, pre-projected)
const TS = 16, MW = 80, MH = 80, WPX = MW * TS;
const K = { ASPH: 0, WALK: 1, GRASS: 2, PLAZA: 3, DIRT: 4, RUBTOP: 5, LEDGE: 6, TROOF: 7, BED: 8, BROOF: 10, BWALL: 11, TFACE: 12, RFACE: 13, CAR: 14, BARRIER: 15, PROP: 16, PARAPET: 17, LADDER: 18 };
const kind = new Uint8Array(MW * MH), lvl = new Int8Array(MW * MH);
const id = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? -1 : y * MW + x);
function setT(x, y, k, l) { const i = id(x, y); if (i < 0) return; kind[i] = k; lvl[i] = l; }
const isFace = (i) => i >= 0 && (kind[i] === K.TFACE || kind[i] === K.RFACE || kind[i] === K.LADDER);
const WR = rng(2026);
const buildings = [], ruins = [], cars = [], props = [], ledges = [];
const TOWER = { x0: 34, x1: 45, ry0: 24, ry1: 31, fy0: 32, fy1: 45, ROOF: 7 };
// v3: one step up onto the tower (A jump), then a ladder straight up the face to the roof
const LADDER = { x0: 39, x1: 40, y0: 32, y1: 43, cx: 40 * 16, top: 31 * 16 + 12, bot: 44 * 16 + 10 };
const NEST = { x: 40 * TS + 8, y: 27 * TS + 12 }; // campfire (world px)
function genWorld() {
  kind.fill(K.ASPH); lvl.fill(0);
  const inCenter = (x, y) => x >= 32 && x <= 49 && y >= 22 && y <= 49;
  for (let bx = 0; bx < 5; bx++) for (let by = 0; by < 5; by++) {
    const x0 = bx * 16 + 3, y0 = by * 16 + 3, x1 = bx * 16 + 15, y1 = by * 16 + 15;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) setT(x, y, (x === x0 || y === y0 || x === x1 || y === y1) ? K.WALK : K.DIRT, 0);
    if ((bx === 2 && (by === 1 || by === 2))) continue;
    lot(x0 + 1, y0 + 1, x1 - 1, y1 - 1, bx * 7 + by * 13);
    // corner lamps on the sidewalk
    if (WR() < 0.7) addProp('lamp', x0, y0); if (WR() < 0.5) addProp('lamp', x1, y1);
  }
  // plaza around the tower
  for (let x = 32; x <= 49; x++) for (let y = 22; y <= 49; y++) setT(x, y, K.PLAZA, 0);
  // the tower: roof (level 7) + tall south face; a single entrance step (level 1) and a ladder up the face
  const T = TOWER;
  for (let x = T.x0; x <= T.x1; x++) { for (let y = T.ry0; y <= T.ry1; y++) setT(x, y, K.TROOF, T.ROOF); for (let y = T.fy0; y <= T.fy1; y++) setT(x, y, K.TFACE, -1); }
  for (let x = T.x0; x <= T.x1; x++) { setT(x, T.ry0, K.PARAPET, -1); if (x < LADDER.x0 || x > LADDER.x1) setT(x, T.ry1, K.PARAPET, -1); }
  for (let y = T.ry0; y <= T.ry1; y++) { setT(T.x0, y, K.PARAPET, -1); setT(T.x1, y, K.PARAPET, -1); }
  [[37, 44, 6]].forEach(([x, y, w], i) => { for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < 2; dy++) setT(x + dx, y + dy, K.LEDGE, i + 1); ledges.push({ x, y, w, level: i + 1 }); });
  for (let x = LADDER.x0; x <= LADDER.x1; x++) for (let y = LADDER.y0; y <= LADDER.y1; y++) setT(x, y, K.LADDER, -1);
  setT(40, 27, K.PROP, -1); setT(43, 26, K.PROP, -1); props.push({ type: 'campfire', tx: 40, ty: 27 }, { type: 'crate', tx: 43, ty: 26, static: true });
  setT(36, 27, K.BED, 7); setT(36, 28, K.BED, 7);
  setT(35, 25, K.PROP, -1); props.push({ type: 'antenna', tx: 35, ty: 25 });
  // plaza dressing
  for (const [x, y] of [[32, 47], [49, 47], [32, 23], [49, 23]]) addProp('lamp', x, y);
  addProp('barrel', 47, 47); addProp('barrel', 33, 40);
  // roads: wrecks
  for (let n = 0; n < 34; n++) {
    const horiz = WR() < 0.5;
    const x = horiz ? 4 + Math.floor(WR() * 70) : Math.floor(WR() * 5) * 16 + Math.floor(WR() * 2), y = horiz ? Math.floor(WR() * 5) * 16 + Math.floor(WR() * 2) : 4 + Math.floor(WR() * 70);
    addCar(x, y, horiz);
  }
  // border: junk barricade
  for (let i = 0; i < MW; i++) { setT(i, 0, K.BARRIER, -1); setT(i, MH - 1, K.BARRIER, -1); setT(0, i, K.BARRIER, -1); setT(MW - 1, i, K.BARRIER, -1); }
}
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
function spk(x0, y0, w, h, n, cols, r) { for (let i = 0; i < n; i++) R_(x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), 1, 1, cols[Math.floor(r() * cols.length)]); }
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
function drawTower() { // THE COOP: tall plank hen-house face, white trim, nest-box holes, chikn ramp up the middle
  const T = TOWER, X = T.x0 * TS, W = (T.x1 - T.x0 + 1) * TS, FY = T.fy0 * TS, FH = (T.fy1 - T.fy0 + 1) * TS, C = RAMP.brick, r = rng(77);
  R_(X, FY, W, FH, C[1]);
  for (let xx = 0; xx < W; xx += 4) { R_(X + xx, FY, 1, FH, C[2]); R_(X + xx + 1, FY, 1, FH, C[0]); }
  for (let yy = 48; yy < FH - 8; yy += 64) { R_(X, FY + yy, W, 3, '#ffffff'); R_(X, FY + yy + 3, W, 1, C[3]); } // white floor bands
  // nest-box holes with straw lips, a few with an egg or a sleepy hen glow
  for (let row = 1; row < (T.fy1 - T.fy0 + 1) - 1; row += 2) for (let col = 0; col < 12; col += 2) {
    const wx = X + col * TS + 9, wy = FY + row * TS + 2; if (Math.abs(wx + 6 - LADDER.cx) < 24) continue;
    R_(wx, wy, 14, 11, OUT); R_(wx + 1, wy + 1, 12, 9, '#ffffff'); R_(wx + 2, wy + 2, 10, 7, '#2a1c14');
    const lit = r() < 0.18; if (lit) { R_(wx + 2, wy + 2, 10, 7, RAMP.lit[1]); R_(wx + 2, wy + 2, 10, 1, RAMP.lit[0]); }
    R_(wx + 2, wy + 7, 10, 2, RAMP.hay[1]); R_(wx + 3, wy + 6, 2, 1, RAMP.hay[0]); R_(wx + 8, wy + 6, 3, 1, RAMP.hay[2]);
    if (!lit && r() < 0.3) { R_(wx + 5, wy + 4, 3, 3, '#ffffff'); R_(wx + 5, wy + 4, 1, 1, RAMP.hazard[0]); }
  }
  // trim: white eave + corner boards, ink outline, light from top-left
  R_(X, FY, W, 5, '#ffffff'); R_(X, FY + 5, W, 1, C[3]); R_(X, FY, W, 1, OUT);
  R_(X + 1, FY, 3, FH, '#ffffff'); R_(X + W - 4, FY, 3, FH, '#e4e7ea');
  R_(X, FY + FH - 5, W, 5, RAMP.wood[2]); R_(X, FY + FH - 5, W, 1, RAMP.wood[0]);
  R_(X - 1, FY, 1, FH, OUT); R_(X + W, FY, 1, FH, OUT); R_(X, FY + FH - 1, W, 1, OUT);
  // the chikn ramp: one wide plank with cross slats (a classic hen-house ladder)
  { const lx = LADDER.x0 * TS + 2, lw = (LADDER.x1 - LADDER.x0 + 1) * TS - 4, ly = FY - 2, lh = (LADDER.y1 + 1) * TS - ly, Wd = RAMP.wood;
    R_(lx - 1, ly, lw + 2, lh, OUT); R_(lx, ly, lw, lh, Wd[1]); R_(lx, ly, 2, lh, Wd[0]); R_(lx + lw - 2, ly, 2, lh, Wd[2]);
    for (let xx = lx + 9; xx < lx + lw - 4; xx += 9) R_(xx, ly, 1, lh, Wd[2]);
    for (let yy = ly + 3; yy < ly + lh - 1; yy += 6) { R_(lx + 1, yy, lw - 2, 3, Wd[0]); R_(lx + 1, yy + 2, lw - 2, 1, Wd[3]); R_(lx + 1, yy + 3, lw - 2, 1, OUT); }
    // painted gold UP arrows beside the ramp
    for (const ax of [lx - 9, lx + lw + 8]) for (const ay of [FY + FH - 70, FY + 70]) { R_(ax - 2, ay - 11, 5, 11, OUT); R_(ax - 5, ay - 8, 11, 4, OUT); R_(ax - 1, ay - 10, 3, 9, RAMP.hazard[1]); R_(ax - 4, ay - 7, 9, 2, RAMP.hazard[1]); R_(ax - 3, ay - 8, 7, 1, RAMP.hazard[1]); } }
  // the perch step: a sturdy plank platform with a gold edge
  for (const L of ledges) {
    const lx = L.x * TS, ly = L.y * TS, lw = L.w * TS, lh = 2 * TS, Wd = RAMP.wood;
    R_(lx, ly + lh, lw, 6, DARK_SHADOW); R_(lx + 3, ly + lh, 4, 7, OUT); R_(lx + lw - 7, ly + lh, 4, 7, OUT);
    R_(lx, ly, lw, lh - 4, Wd[1]);
    for (let gy = 0; gy < lh - 4; gy += 4) { R_(lx, ly + gy, lw, 1, Wd[0]); R_(lx, ly + gy + 3, lw, 1, Wd[2]); }
    for (let gx = 12; gx < lw; gx += 24) R_(lx + gx, ly, 1, lh - 4, Wd[3]);
    R_(lx, ly + lh - 4, lw, 4, RAMP.hazard[1]); R_(lx, ly + lh - 2, lw, 2, RAMP.hazard[2]);
    R_(lx - 1, ly - 1, lw + 2, 1, OUT); R_(lx - 1, ly - 1, 1, lh + 1, OUT); R_(lx + lw, ly - 1, 1, lh + 1, OUT); R_(lx - 1, ly + lh, lw + 2, 1, OUT);
  }
  // east cast shadow (light from top-left)
  R_(X + W + 1, T.ry0 * TS + 4, 7, (T.fy1 - T.ry0 + 1) * TS - 4, DARK_SHADOW);
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
  for (const b of buildings) { drawBuilding(b); R_((b.x0 + b.w) * TS + 1, b.y0 * TS + 4, 6, b.h * TS - 4, DARK_SHADOW); }
  drawTower();
  for (const c of cars) { M.drawImage(carCanvas(c), c.x * TS, c.y * TS); R_((c.x + c.w) * TS, c.y * TS + 4, 3, c.h * TS - 6, DARK_SHADOW); }
  // static props: bedroll and crate on the roof, barrels
  { const X = 36 * TS + 1, Y = 27 * TS + 4, H = RAMP.hay; R_(X - 1, Y - 1, 16, 26, OUT); R_(X, Y, 14, 24, H[1]); R_(X, Y, 14, 2, H[0]); R_(X, Y + 22, 14, 2, H[2]); R_(X + 3, Y + 4, 8, 16, H[2]); R_(X + 3, Y + 4, 8, 1, H[3]);
    for (const [ex, ey] of [[4, 7], [7, 10], [4, 13]]) { R_(X + ex - 1, Y + ey - 1, 6, 7, OUT); R_(X + ex, Y + ey, 4, 5, ey === 10 ? RAMP.hazard[1] : '#ffffff'); R_(X + ex, Y + ey, 1, 1, '#ffffff'); } } // straw nest with eggs (one golden)
  box3(43 * TS + 1, 26 * TS + 2, 14, 6, 7, RAMP.wood); R_(43 * TS + 4, 26 * TS + 10, 8, 3, RAMP.brick[1]); // $FEED crate
  for (const p of props) if (p.type === 'barrel') { const X = p.tx * TS + 3, Y = p.ty * TS + 1; R_(X - 1, Y - 1, 12, 16, OUT); R_(X, Y, 10, 14, RAMP.metal[2]); R_(X, Y, 10, 3, RAMP.metal[3]); R_(X + 1, Y + 1, 8, 1, '#1a0c08'); R_(X, Y + 3, 2, 11, RAMP.metal[0]); R_(X + 8, Y + 3, 2, 11, RAMP.metal[3]); R_(X, Y + 5, 10, 1, RAMP.brick[1]); R_(X, Y + 10, 10, 1, RAMP.brick[1]); }
  M = null;
}

// ================================================================ game state
const BEST_KEY = 'lasttower.best';
let best = { days: 0, kills: 0 }; try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || best; } catch (e) {}
const WEAPONS = {
  fists:   { name: 'PECK',    kind: 'melee', dmg: 1, reach: 15, arc: 1.5, cd: 0.36, stam: 7, icon: -1 },
  pipe:    { name: 'RAKE',    kind: 'melee', dmg: 2, reach: 20, arc: 1.8, cd: 0.48, stam: 11, icon: 5 },
  machete: { name: 'PITCHFORK', kind: 'melee', dmg: 3.5, reach: 22, arc: 2.0, cd: 0.42, stam: 12, icon: 6 },
  pistol:  { name: 'EGG BLASTER', kind: 'gun', dmg: 3, range: 200, cd: 0.32, ammo: 'ammo', pellets: 1, spread: 0, icon: 7 },
  shotgun: { name: 'CORN SHOTGUN', kind: 'gun', dmg: 2.2, range: 120, cd: 0.85, ammo: 'shells', pellets: 6, spread: 0.55, icon: 8 },
};
const ORDER = ['fists', 'pipe', 'machete', 'pistol', 'shotgun'];
const DAY_LEN = 180, NIGHT_LEN = 120, CYCLE = DAY_LEN + NIGHT_LEN;
let G = null;
const player = { x: 0, y: 0, level: 7, air: false, jz: 0, vz: 0, maxL: 7, sx: 0, sy: 0, fx: 0, fy: 1, dir: 0, anim: 0, atkT: 0, hurtT: 0, kb: [0, 0], moving: false };
const itemPool = [], zombiePool = [];
function newGame() {
  G = {
    state: 'play', t: 20, day: 1, kills: 0, msg: [], hp: 100, hunger: 85, stam: 100,
    inv: { food: 2, mre: 0, med: 1, ammo: 0, shells: 0 }, owned: ['fists', 'pipe'], weapon: 'pipe',
    resting: false, menuI: 0, shake: 0, flash: 0, deathCause: '', tracers: [], hits: [], cdT: 0, lightning: 0, swing: null,
  };
  Object.assign(player, { x: 38 * TS + 8, y: 29 * TS + 8, level: TOWER.ROOF, air: false, climb: false, jz: 0, vz: 0, fx: 0, fy: 1, dir: 0, kb: [0, 0] });
  zombiePool.length = 0; itemPool.length = 0; flowT = 0;
  scatterLoot(40, true);
  say('THE FARM HAS TURNED. FORAGE.', 4);
  say('BE BACK IN THE COOP BY NIGHT.', 4);
}
function say(s, t = 2.5) { if (!G || !G.msg) return; G.msg.push({ s, t }); if (G.msg.length > 3) G.msg.shift(); }
const isNight = () => !!G && (G.t % CYCLE) >= DAY_LEN;
const onTower = () => player.level === TOWER.ROOF && !player.air;
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
function jump() {
  if (player.climb) return;
  if (player.air) { player.jumpBuf = 0.12; return; }
  if (G.stam < 4) { say('TOO TIRED TO FLAP', 1); return; }
  Object.assign(player, { air: true, vz: JUMP_V, jz: 0, maxL: player.level + 1, sx: player.x, sy: player.y });
  G.stam = Math.max(0, G.stam - 4); sfx('jump');
}
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
  if (drop >= 3) hurtPlayer((drop - 2) * 10, null, 'A BAD FLAP'); else if (drop > 0 || guard) sfx('land');
  if (player.jumpBuf > 0) { player.jumpBuf = 0; jump(); }
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
  if (r < 0.32) return 'food'; if (r < 0.42) return 'mre'; if (r < 0.48) return 'water'; if (r < 0.58) return 'med';
  if (r < 0.74) return 'ammo'; if (r < 0.84) return 'shells';
  const w = ['pipe', 'machete', 'pistol', 'shotgun'][Math.floor(Math.random() * 4)]; return G.owned.includes(w) ? (w === 'shotgun' ? 'shells' : 'ammo') : w;
}
function randomTile(pred, tries = 200) { for (let t = 0; t < tries; t++) { const x = 2 + Math.floor(Math.random() * (MW - 4)), y = 2 + Math.floor(Math.random() * (MH - 4)); const i = id(x, y); if (pred(i, x, y)) return [x, y]; } return null; }
function dropItem(kind_, x, y, level) { itemPool.push({ alive: true, kind: kind_, x, y, level, ph: Math.random() * 6 }); }
function scatterLoot(n, first) {
  for (let k = 0; k < n; k++) {
    const p = randomTile((i, x, y) => (lvl[i] === 0 || lvl[i] === 1) && kind[i] !== K.PLAZA && Math.hypot(x - 40, y - 36) > 9);
    if (p) { const i = id(p[0], p[1]); dropItem(lootRoll(), p[0] * TS + 8, p[1] * TS + 10, lvl[i]); }
  }
  if (first) for (const [k, d] of [['pistol', 13], ['ammo', 11], ['machete', 18], ['shotgun', 26], ['shells', 22]]) {
    const p = randomTile((i, x, y) => lvl[i] === 0 && kind[i] !== K.PLAZA && Math.abs(Math.hypot(x - 40, y - 40) - d) < 2, 600);
    if (p) dropItem(k, p[0] * TS + 8, p[1] * TS + 10, 0);
  }
}
function pickup(it) {
  const k = it.kind; it.alive = false; sfx('pick');
  if (WEAPONS[k]) { if (!G.owned.includes(k)) { G.owned.push(k); G.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); } G.weapon = k; say('FOUND ' + WEAPONS[k].name + (k === 'pistol' ? ' +6 EGGS' : k === 'shotgun' ? ' +4 KERNELS' : '')); if (k === 'pistol') G.inv.ammo += 6; if (k === 'shotgun') G.inv.shells += 4; return; }
  if (k === 'food') { G.inv.food++; say('+1 CORN COB'); }
  else if (k === 'mre') { G.inv.mre++; say('+1 SACK OF $FEED'); }
  else if (k === 'water') { G.inv.food++; G.stam = 100; say('+1 JUICY WORM. STAMINA FULL'); }
  else if (k === 'med') { G.inv.med++; say('+1 GOLDEN HEGG'); }
  else if (k === 'ammo') { const n = 5 + Math.floor(Math.random() * 5); G.inv.ammo += n; say('+' + n + ' EGGS'); }
  else if (k === 'shells') { const n = 3 + Math.floor(Math.random() * 3); G.inv.shells += n; say('+' + n + ' CORN KERNELS'); }
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
function spawnZombie(brute, near) {
  const night = isNight(), ptx = player.x / TS, pty = player.y / TS;
  const p = randomTile((i, x, y) => { if (lvl[i] !== 0 || kind[i] === K.CAR) return false; const d = Math.hypot(x - ptx, y - pty); return near ? d > 6 && d < 16 : d > 13 && d < 30 && (night || Math.hypot(x - 40, y - 40) > 9); }, 60);
  if (!p) return null;
  const z = { alive: true, brute, x: p[0] * TS + 8, y: p[1] * TS + 12, level: 0, air: false, hp: brute ? 12 : 4, max: brute ? 12 : 4,
    speed: (brute ? 26 : 22 + Math.random() * 9) * (night ? 1.35 : 1), anim: Math.random() * 4, dir: 0, fx: 0, fy: 1, atk: 0, cool: 0, hurt: 0, kb: [0, 0],
    state: 'wander', wx: 0, wy: 0, wt: 0, groan: 2 + Math.random() * 8, dead: 0, spr: brute ? SPR.brute : SPR.zombies[zombiePool.length % 3] };
  zombiePool.push(z); return z;
}
function hurtZombie(z, dmg, kx, ky) {
  z.hp -= dmg; z.hurt = 0.18; z.kb = [kx * (z.brute ? 40 : 110), ky * (z.brute ? 40 : 110)]; z.state = 'chase';
  G.hits.push({ x: z.x, y: z.y - 12, t: 0.25 });
  if (z.hp <= 0) { z.alive = false; z.dead = 0.6; G.kills++; sfx('splat'); if (Math.random() < (z.brute ? 0.9 : 0.28)) dropItem(lootRoll(), z.x, z.y, z.level); }
  else sfx('thud');
}
function updateZombies(dt) {
  const night = isNight(), sense = (night ? 14 : 9) * TS;
  flowT -= dt; const key = Math.floor(player.x / TS) + Math.floor(player.y / TS) * MW + player.level * 9999;
  if (flowT <= 0 || key !== flowKey) { buildFlow(); flowT = 0.4; flowKey = key; }
  let alive = 0, brutes = 0;
  for (const z of zombiePool) {
    if (!z.alive) { z.dead -= dt; continue; }
    alive++; if (z.brute) brutes++;
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
      z.wt -= dt; if (z.wt <= 0 || Math.hypot(z.wx - z.x, z.wy - z.y) < 6) { z.wt = 3 + Math.random() * 5; const a = Math.random() * 6.28; z.wx = z.x + Math.cos(a) * 70; z.wy = z.y + Math.sin(a) * 70; if (night) { z.wx = lerp(z.wx, 40 * TS, 0.3); z.wy = lerp(z.wy, 46 * TS, 0.3); } }
      tx = z.wx; ty = z.wy; sp = z.speed * 0.4;
    }
    let vx = tx - z.x, vy = ty - z.y; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const reach = Math.abs(dx) < 13 && Math.abs(dy) < 10 && player.level - z.level <= 1 && !(player.air && player.jz > 9);
    if (reach || z.atk > 0) sp = 0;
    if (z.hurt > 0) { z.hurt -= dt; sp *= 0.2; }
    const hit = moveBody(z, (vx * sp + z.kb[0]) * dt, (vy * sp + z.kb[1]) * dt, 4);
    if (hit && z.state === 'wander') z.wt = 0;
    z.kb[0] *= Math.pow(0.001, dt); z.kb[1] *= Math.pow(0.001, dt);
    if (sp > 1) { z.anim += dt * 6 * (sp / 24); z.fx = vx; z.fy = vy; }
    if (z.atk > 0) { z.atk -= dt; if (z.atk <= 0 && !z.struck) { z.struck = true; z.cool = 1.1; if (Math.abs(player.x - z.x) < 16 && Math.abs(player.y - z.y) < 12 && player.level - z.level <= 1 && G.state !== 'dead') hurtPlayer(z.brute ? 17 : 8, z, z.brute ? 'A ZOMBIE ROOSTR' : 'THE UNDEAD FLOCK'); } }
    else { z.cool -= dt; if (reach && z.cool <= 0 && G.state !== 'dead') { z.atk = 0.4; z.struck = false; z.fx = dx; z.fy = dy; } }
    z.groan -= dt; if (z.groan <= 0) { z.groan = 4 + Math.random() * 9; if (d < 12 * TS) sfx('groan'); }
  }
  for (let i = 0; i < zombiePool.length; i++) { const a = zombiePool[i]; if (!a.alive) continue; for (let j = i + 1; j < zombiePool.length; j++) { const b = zombiePool[j]; if (!b.alive) continue; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 < 100 && d2 > 0.01) { const d = Math.sqrt(d2), p = (10 - d) / 2, ux = dx / d * p, uy = dy / d * p; moveBody(a, -ux, -uy, 4); moveBody(b, ux, uy, 4); } } }
  for (let i = zombiePool.length - 1; i >= 0; i--) if (!zombiePool[i].alive && zombiePool[i].dead <= 0) zombiePool.splice(i, 1);
  const target = night ? Math.min(70, 40 + G.day * 4) : Math.min(30, 14 + G.day * 2);
  G.spawnT = (G.spawnT || 0) - dt;
  if (alive < target && G.spawnT <= 0) { G.spawnT = night ? 0.25 : 0.6; spawnZombie(G.day >= 2 && brutes < (night ? 2 + G.day : G.day - 1) && Math.random() < 0.18); }
  _alive = alive;
}

// ================================================================ combat
function dirVec() { const l = Math.hypot(player.fx, player.fy) || 1; return [player.fx / l, player.fy / l]; }
function attack() {
  const w = WEAPONS[G.weapon]; if (G.cdT > 0) return;
  const [fx, fy] = dirVec();
  if (w.kind === 'gun') {
    if (G.inv[w.ammo] <= 0) { sfx('click'); say('OUT OF ' + (w.ammo === 'ammo' ? 'EGGS' : 'KERNELS') + (L('SELECT') === 'SWAP' ? ' - TAP SWAP' : ' - ' + L('SELECT') + ' TO SWAP'), 1.6); G.cdT = 0.3; return; }
    G.inv[w.ammo]--; G.cdT = w.cd; player.atkT = 0.18; G.shake = w.pellets > 1 ? 3 : 1.5; G.flash = 0.05; sfx(w.pellets > 1 ? 'shotgun' : 'pistol');
    let ax = fx, ay = fy, bestD = 1e9;
    for (const z of zombiePool) { if (!z.alive) continue; const dx = z.x - player.x, dy = (z.y - 8) - (player.y - 8), d = Math.hypot(dx, dy); if (d > w.range) continue; const dot = (dx * fx + dy * fy) / (d || 1); if (dot > 0.86 && d < bestD) { bestD = d; ax = dx / d; ay = dy / d; } }
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.atan2(ay, ax) + (w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread + (Math.random() - 0.5) * 0.08 : 0), dx = Math.cos(a), dy = Math.sin(a);
      let hitD = w.range, hitZ = null;
      for (let s = 8; s < hitD; s += 4) { const k = kind[tileAt(player.x + dx * s, player.y - 8 + dy * s)]; if (k === K.BROOF || k === K.BWALL || k === K.BARRIER) { hitD = s; break; } }
      for (const z of zombiePool) { if (!z.alive) continue; const rx = z.x - player.x, ry = (z.y - 8) - (player.y - 8), t = rx * dx + ry * dy; if (t < 0 || t > hitD) continue; if (Math.abs(rx * dy - ry * dx) < (z.brute ? 9 : 7)) { hitD = t; hitZ = z; } }
      G.tracers.push({ k: G.weapon, x0: player.x + dx * 8, y0: player.y - 10 - player.jz + dy * 8, x1: player.x + dx * hitD, y1: player.y - 10 - player.jz + dy * hitD, t: 0.12 });
      if (hitZ) hurtZombie(hitZ, w.dmg, dx, dy);
    }
    for (const z of zombiePool) if (z.alive && Math.hypot(z.x - player.x, z.y - player.y) < 20 * TS) z.state = 'chase';
    return;
  }
  if (G.stam < w.stam * 0.5) { say('TOO TIRED - ROOST OR WAIT', 1.2); G.cdT = 0.3; return; }
  G.stam = Math.max(0, G.stam - w.stam); G.cdT = w.cd; player.atkT = 0.2; sfx('swing');
  G.swing = { t: 0.16, a: Math.atan2(fy, fx), reach: w.reach, w: G.weapon };
  for (const z of zombiePool) {
    if (!z.alive || Math.abs(z.level - player.level) > 1) continue; const dx = z.x - player.x, dy = z.y - player.y, d = Math.hypot(dx, dy);
    if (d > w.reach + 6) continue;
    let da = Math.atan2(dy, dx) - Math.atan2(fy, fx); while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < w.arc / 2 || d < 8) hurtZombie(z, w.dmg, dx / (d || 1), dy / (d || 1));
  }
}
function hurtPlayer(dmg, from, cause) {
  if (!G || !['play', 'bag', 'camp'].includes(G.state)) return;
  G.hp -= dmg; player.hurtT = 0.3; G.shake = 3; sfx('hurt'); G.resting = false;
  if (from && !player.air) { const dx = player.x - from.x, dy = player.y - from.y, d = Math.hypot(dx, dy) || 1; player.kb = [dx / d * 90, dy / d * 90]; }
  if (G.hp <= 0) die(cause);
}
function die(cause) {
  G.hp = 0; G.state = 'dead'; G.deadT = 0; G.deathCause = cause; sfx('die');
  if (G.day > best.days || (G.day === best.days && G.kills > best.kills)) { best = { days: G.day, kills: G.kills }; try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) {} G.newBest = true; }
}
function updatePlayer(dt) {
  let mx = held.right - held.left, my = held.down - held.up;
  if (stick.on && Math.hypot(stick.x, stick.y) > 0.18) { mx = stick.x; my = stick.y; }
  let m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; m = 1; }
  if (G.state !== 'play' || G.resting) { mx = my = 0; m = 0; }
  player.moving = m > 0.1;
  if (player.moving) { player.fx = mx / m; player.fy = my / m; player.anim += dt * 8 * m; player.dir = Math.abs(mx) > Math.abs(my) * 1.05 ? (mx < 0 ? 2 : 3) : (my > 0 ? 0 : 1); }
  // LADDER: hold up on the entrance step (or down at the roof gap) to grab it; climb with up/down
  const onLadderCol = Math.abs(player.x - LADDER.cx) < 12;
  if (!player.climb && !player.air && G.state === 'play' && onLadderCol && !G.resting) {
    if (player.level === 1 && my < -0.5 && kind[tileAt(player.x, player.y - 9)] === K.LADDER) { player.climb = true; player.x = LADDER.cx; }
    else if (player.level === TOWER.ROOF && my > 0.5 && kind[tileAt(player.x, player.y + 6)] === K.LADDER) { player.climb = true; player.x = LADDER.cx; player.y = LADDER.top + 2; }
  }
  if (player.climb) {
    player.kb[0] = player.kb[1] = 0; player.dir = 1; player.moving = Math.abs(my) > 0.2; player.fx = 0; player.fy = -1;
    if (player.moving) { player.y += Math.sign(my) * 60 * dt; player.anim += dt * 7; if (Math.random() < dt * 5) sfx('rung'); }
    if (player.y >= LADDER.bot) { player.y = LADDER.bot; player.climb = false; player.level = 1; }
    else if (player.y <= LADDER.top) { player.y = LADDER.top; player.climb = false; player.level = TOWER.ROOF; say('SAFE IN THE COOP. BOK.', 2); }
    else player.level = player.y > (LADDER.y1 - 1) * TS ? 1 : TOWER.ROOF - 1; // zombies can only reach your heels at the bottom
    player.atkT = Math.max(0, player.atkT - dt); player.hurtT = Math.max(0, player.hurtT - dt); G.cdT = Math.max(0, G.cdT - dt);
    return;
  }
  const spd = (G.hunger <= 0 ? 52 : 70) * (player.air ? 1.2 : 1);
  const kb = player.kb;
  const hit = moveBody(player, (mx * spd + kb[0]) * dt, (my * spd + kb[1]) * dt, 4);
  if (hit && !player.air && player.moving) tryAutoHop(mx, my);
  kb[0] *= Math.pow(0.002, dt); kb[1] *= Math.pow(0.002, dt);
  if (player.air) { player.vz -= GRAV * dt; player.jz += player.vz * dt; if (player.jz <= 0 && player.vz < 0) land(); }
  player.atkT = Math.max(0, player.atkT - dt); player.hurtT = Math.max(0, player.hurtT - dt); player.jumpBuf = Math.max(0, (player.jumpBuf || 0) - dt);
  G.cdT = Math.max(0, G.cdT - dt);
  for (const it of itemPool) if (it.alive && Math.abs(it.x - player.x) < 10 && Math.abs(it.y - player.y) < 10 && it.level === player.level) pickup(it);
}
// ================================================================ input (keyboard = shell buttons = touch)
const held = { up: 0, down: 0, left: 0, right: 0 };
const stick = { x: 0, y: 0, on: false };
const queue = [];
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
  ' ': 'A', z: 'A', k: 'A', x: 'B', j: 'B', Enter: 'START', Escape: 'START', p: 'START', q: 'SELECT', Shift: 'SELECT', Tab: 'SELECT', e: 'SELECT',
};
let lastInput = touchDev ? 'touch' : 'keys';
function keyName(e) { if (e.code === 'Space') return ' '; const k = e.key; return k && k.length === 1 ? k.toLowerCase() : k; }
addEventListener('keydown', (e) => {
  const k = keyName(e); if (k === 'm') { toggleMute(); return; }
  const a = KEYMAP[k]; if (!a) return;
  e.preventDefault(); audioInit();
  if (e.handheld) lastInput = 'shell'; else if (e.isTrusted) lastInput = 'keys';
  if (a in held) { if (!held[a]) queue.push(a); held[a] = 1; } else if (!e.repeat) queue.push(a);
});
addEventListener('keyup', (e) => { const a = KEYMAP[keyName(e)]; if (a in held) held[a] = 0; });
addEventListener('blur', () => { for (const k in held) held[k] = 0; });
// touch controls (only shown without the shell)
{
  const base = $('tBase'), knob = $('tKnob'), area = $('tStick'); let id = null, ox = 0, oy = 0;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
  area.addEventListener('pointerdown', (e) => { audioInit(); lastInput = 'touch'; id = e.pointerId; area.setPointerCapture(id); const r = area.getBoundingClientRect(); ox = e.clientX; oy = e.clientY; base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; stick.on = true; stick.x = stick.y = 0; setKnob(0, 0); });
  area.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy), mx = 48; if (l > mx) { dx *= mx / l; dy *= mx / l; } setKnob(dx, dy); stick.x = dx / mx; stick.y = dy / mx; const mag = Math.hypot(stick.x, stick.y);
    if (mag > 0.5) { const dir = Math.abs(stick.x) > Math.abs(stick.y) ? (stick.x < 0 ? 'left' : 'right') : (stick.y < 0 ? 'up' : 'down'); if (dir !== stick.lastDir) { stick.lastDir = dir; queue.push(dir); } } else stick.lastDir = null; });
  const end = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; stick.lastDir = null; setKnob(0, 0); };
  area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  for (const [elId, act] of [['tA', 'A'], ['tB', 'B'], ['tSwap', 'SELECT'], ['tBag', 'START']]) {
    const el = $(elId);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); lastInput = 'touch'; el.classList.add('on'); queue.push(act); });
    const up = () => el.classList.remove('on'); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
}
// controls labels: every on-screen hint names the real control for the current mode
function mode() { if (shellOn()) return 'shell'; if (touchDev && lastInput !== 'keys') return 'touch'; return 'keys'; }
const LABELS = {
  shell: { move: 'D-PAD', up: 'UP', A: 'A', B: 'B', START: 'START', SELECT: 'SELECT' },
  touch: { move: 'STICK', up: 'STICK UP', A: 'A', B: 'B', START: 'BAG', SELECT: 'SWAP' },
  keys: { move: 'WASD', up: 'W', A: 'SPACE', B: 'X', START: 'ENTER', SELECT: 'Q' },
};
const L = (k) => LABELS[mode()][k];

// ================================================================ audio (WebAudio synth, honours the shell mute)
let AC = null, master = null, rainGain = null, muted = false;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(AC.destination);
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
addEventListener('handheld:power', (e) => { powered = !(e.detail && e.detail.on === false); if (!powered && G && G.state === 'play') openMenu('bag'); });
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
    case 'swing': noise(0.12, 1800, 0.12, 2); break;
    case 'thud': noise(0.1, 220, 0.3); tone(110, 60, 0.1, 'square', 0.08); break;
    case 'splat': noise(0.25, 400, 0.35); tone(90, 40, 0.25, 'sawtooth', 0.08); break;
    case 'pistol': noise(0.18, 1200, 0.45, 0.6); tone(300, 80, 0.12, 'square', 0.1); break;
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

// ================================================================ menus
const MENUS = {
  bag: () => {
    const top = onTower();
    return [
      { t: 'RESUME', go: () => closeMenu() },
      { t: 'GOLDEN HEGG x' + G.inv.med + '  (+45 HP)', dis: !G.inv.med || G.hp >= 100, go: () => { G.inv.med--; G.hp = Math.min(100, G.hp + 45); sfx('heal'); say('GOLDEN HEGG. FEELING BOK.'); closeMenu(); } },
      { t: top ? 'PECK CORN x' + G.inv.food + '  (+30 FEED)' : 'EAT: ONLY SAFE IN THE COOP', dis: !top || !G.inv.food, go: () => eat('food') },
      { t: top ? 'EAT $FEED x' + G.inv.mre + '  (+60 FEED)' : 'CLIMB TO THE COOP TO EAT', dis: !top || !G.inv.mre, go: () => eat('mre') },
      { t: 'WEAPON: ' + WEAPONS[G.weapon].name + '  (SWAP)', go: () => { swapWeapon(); } },
    ];
  },
  camp: () => [
    { t: 'ROOST ' + (isNight() ? 'UNTIL DAWN' : 'A WHILE') + '  (HEAL)', go: () => { closeMenu(); G.resting = true; G.restT = 0; say('ROOSTING BY THE FIRE...'); } },
    { t: 'PECK CORN x' + G.inv.food + '  (+30 FEED)', dis: !G.inv.food, go: () => eat('food') },
    { t: 'EAT $FEED x' + G.inv.mre + '  (+60 FEED)', dis: !G.inv.mre, go: () => eat('mre') },
    { t: 'GOLDEN HEGG x' + G.inv.med + '  (+45 HP)', dis: !G.inv.med || G.hp >= 100, go: () => { G.inv.med--; G.hp = Math.min(100, G.hp + 45); sfx('heal'); } },
    { t: 'BACK TO THE FARM', go: () => closeMenu() },
  ],
};
function openMenu(m) { G.state = m; G.menuI = 0; sfx('menu'); }
function closeMenu() { G.state = 'play'; }
function eat(k) {
  if (k === 'food' && G.inv.food) { G.inv.food--; G.hunger = Math.min(100, G.hunger + 30); G.hp = Math.min(100, G.hp + 6); }
  else if (k === 'mre' && G.inv.mre) { G.inv.mre--; G.hunger = Math.min(100, G.hunger + 60); G.hp = Math.min(100, G.hp + 15); }
  else return; sfx('eat'); say('NOM. FEED ' + Math.round(G.hunger) + '%  +KG');
}
function swapWeapon() { const i = G.owned.indexOf(G.weapon); G.weapon = G.owned[(i + 1) % G.owned.length]; sfx('menu'); say(WEAPONS[G.weapon].name + (WEAPONS[G.weapon].kind === 'gun' ? '  AMMO ' + G.inv[WEAPONS[G.weapon].ammo] : ''), 1.5); }
function nearFire() { return onTower() && Math.hypot(player.x - NEST.x, player.y - NEST.y) < 28; }

function handleButtons() {
  while (queue.length) {
    const b = queue.shift();
    if (STATE === 'title') { if (b === 'A' || b === 'START') { STATE = 'game'; newGame(); sfx('dawn'); } continue; }
    if (G.state === 'dead') { if ((b === 'A' || b === 'START') && G.deadT > 1.2) { newGame(); } continue; }
    if (G.resting) { if (b === 'A' || b === 'B' || b === 'START') { G.resting = false; say('UP AND READY'); } continue; }
    if (G.state === 'bag' || G.state === 'camp') {
      const items = MENUS[G.state]();
      if (b === 'up') { G.menuI = (G.menuI + items.length - 1) % items.length; sfx('menu'); }
      else if (b === 'down') { G.menuI = (G.menuI + 1) % items.length; sfx('menu'); }
      else if (b === 'A') { const it = items[G.menuI]; if (it.dis) sfx('click'); else it.go(); }
      else if (b === 'B' || (b === 'START' && G.state === 'bag')) closeMenu();
      else if (b === 'START' && G.state === 'camp') openMenu('bag');
      else if (b === 'SELECT') swapWeapon();
      continue;
    }
    if (player.climb && (b === 'A' || b === 'B')) continue; // hands full on the ladder
    if (b === 'A') jump();
    else if (b === 'B') { if (nearFire()) openMenu('camp'); else attack(); }
    else if (b === 'START') openMenu('bag');
    else if (b === 'SELECT') swapWeapon();
  }
}
let _alive = 0;
function updateSurvival(dt, gdt) {
  const hungerRate = 100 / 420;
  G.hunger = Math.max(0, G.hunger - hungerRate * dt * (G.resting ? 3 : 1));
  if (G.hunger <= 0) { G.hp -= 1.1 * dt; if (Math.random() < dt * 0.3) say('EMPTY CROP... EAT IN THE COOP', 1.5); if (G.hp <= 0) die('AN EMPTY CROP'); }
  const regen = (G.hunger < 15 ? 6 : 15) * (G.resting ? 3 : 1);
  if (G.cdT <= 0) G.stam = Math.min(100, G.stam + regen * dt);
  if (G.resting) {
    G.restT += dt; G.hp = Math.min(100, G.hp + (G.hunger > 0 ? 5 : 0) * dt);
    const ph = G.t % CYCLE;
    if (!isNight() && G.restT > 1.5 && (G.hp >= 100 || G.restT > 14)) { G.resting = false; say('ROOSTED. HP ' + Math.round(G.hp)); }
  } else if (onTower() && G.hunger > 50) G.hp = Math.min(100, G.hp + 0.35 * dt); // slow recovery at the nest when fed
}
let lastPhaseNight = false;
function updateClock(dt) {
  const scale = G.resting ? (isNight() ? 12 : 8) : 1;
  const before = G.t % CYCLE; G.t += dt * scale; const ph = G.t % CYCLE;
  if (before < DAY_LEN - 30 && ph >= DAY_LEN - 30) say('DUSK SOON. HEAD FOR THE COOP.', 4);
  if (before < DAY_LEN && ph >= DAY_LEN) { say('NIGHT FALLS. THE UNDEAD FLOCK STIRS.', 4); sfx('dusk'); }
  if (ph < before) { G.day++; say('DAY ' + G.day + '. GM. YOU MADE IT.', 4); sfx('dawn'); if (G.resting) { G.resting = false; } const n = itemPool.filter((i) => i.alive).length; scatterLoot(Math.max(0, 34 - n)); }
  return scale;
}
function clockStr() { const ph = G ? G.t % CYCLE : 40; let h; if (ph < DAY_LEN) h = 6 + ph / DAY_LEN * 14; else h = 20 + (ph - DAY_LEN) / NIGHT_LEN * 10; h %= 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function daylight() {
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
  for (const k in defs) { const [c, x] = mk(7, 6); defs[k].forEach((row, y) => [...row].forEach((ch, X) => { const col = ch === '#' ? cols[k][0] : ch === 'o' ? (cols[k][1] || '#6a4a2a') : ch === 'k' ? '#090b0a' : ch === 'y' ? '#ffc42f' : null; if (col) px(x, col, X, y); })); out[k] = c; }
  return out;
})();
const INK = '#090b0a', CREAM = '#f8f5e9', HGREEN = '#08d14a', HRED = '#ff3347', HGOLD = '#ffc42f';
// real hens.farm art (permission from the community), pixelated to the game grid: title hen, plucked hen, golden HEGG
const ART = {}; for (const k of ['hen-title', 'hen-plucked', 'hegg']) { const im = new Image(); im.src = k + '.png'; ART[k] = im; }
const artOk = (k) => ART[k].complete && ART[k].naturalWidth > 0;
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
function hintText() {
  const mv = L('move'), A = L('A'), B = L('B'), S = L('START'), SE = L('SELECT'), bag = S === 'BAG' ? 'BAG' : S + ' BAG', swp = SE === 'SWAP' ? 'SWAP WEAPON' : SE + ' SWAP WEAPON';
  if (G.resting) return 'ROOSTING - ' + A + ' / ' + B + ' TO GET UP';
  if (nearFire()) return B + ' NEST: EAT / ROOST    ' + bag;
  if (G.t < 34 && G.day === 1) return mv + ' MOVE  ' + A + ' FLAP  ' + B + ' PECK';
  if (G.t < 48 && G.day === 1) return bag + ' / PAUSE   ' + swp;
  if (player.climb) return 'HOLD ' + L('up') + ' TO CLIMB  (DOWN TO DESCEND)';
  if (player.level === 1 && !player.air) return Math.abs(player.x - LADDER.cx) < 12 ? 'HOLD ' + L('up') + ' TO CLIMB THE CHIKN RAMP' : 'WALK TO THE RAMP, HOLD ' + L('up');
  const nearTower = player.level === 0 && Math.abs(player.x / TS - 40) < 9 && player.y / TS > 44 && player.y / TS < 52;
  if (nearTower) return A + ' FLAP ONTO THE PERCH, THEN CLIMB';
  if (onTower() && Math.abs(player.x - LADDER.cx) < 12 && player.y > 30 * TS) return 'HOLD DOWN TO CLIMB DOWN';
  const w = WEAPONS[G.weapon]; if (w.kind === 'gun' && G.inv[w.ammo] <= 0) return 'OUT OF AMMO - ' + swp;
  return '';
}
function drawHUD(dt, t) {
    if (STATE === 'title') { drawTitle(t); return; }
  // low-HP vignette / hurt flash
  if (G.hp < 30 || player.hurtT > 0) { const a = player.hurtT > 0 ? 0.35 : (0.15 + Math.sin(t * 5) * 0.08); hx.fillStyle = `rgba(160,20,20,${a})`; hx.fillRect(0, 0, N, 3); hx.fillRect(0, N - 3, N, 3); hx.fillRect(0, 0, 3, N); hx.fillRect(N - 3, 0, 3, N); }
  if (G.flash > 0) { hx.fillStyle = `rgba(255,230,180,${G.flash * 2})`; hx.fillRect(0, 0, N, N); G.flash -= dt; }
  if (G.resting) { hx.fillStyle = 'rgba(8,6,12,.45)'; hx.fillRect(0, 0, N, N); }
  // stat bars (top-left)
  const bw = Math.round(N * 0.2);
  panel(2, 2, bw + 16, 26);
  bar(5, 5, bw, G.hp, HRED, 'heart');
  bar(5, 13, bw, G.hunger, G.hunger < 20 ? '#ff9d00' : HGOLD, 'food');
  bar(5, 21, bw, G.stam, HGREEN, 'bolt'); // 21+6 = 27
  // clock (top-right)
  const night = isNight(); const ct = clockStr();
  panel(N - 56, 2, 54, 18);
  hx.drawImage(ICONS[night ? 'moon' : 'sun'], N - 52, 8);
  inkText('DAY ' + G.day, N - 5, 2, INK, 'right'); inkText(ct, N - 5, 10, night ? '#2e6c96' : '#c06a16', 'right');
  // weapon + ammo (bottom-left)
  const w = WEAPONS[G.weapon], ww = Math.max(74, 22 + w.name.length * 6);
  panel(2, N - 22, ww, 20);
  if (w.icon >= 0) drawItemIcon(w.icon, 5, N - 19); else { hx.fillStyle = INK; hx.fillRect(7, N - 14, 7, 5); hx.fillStyle = HGOLD; hx.fillRect(8, N - 13, 5, 3); hx.fillRect(13, N - 12, 2, 1); } // beak
  inkText(w.name, 19, N - 20);
  if (w.kind === 'gun') inkText((w.ammo === 'ammo' ? 'EGGS ' : 'KERNELS ') + G.inv[w.ammo], 19, N - 11, G.inv[w.ammo] ? '#c06a16' : HRED);
  else { const sx = 19; hx.fillStyle = INK; hx.fillRect(sx, N - 7, 40, 3); hx.fillStyle = G.cdT > 0 ? '#b9c0c6' : HGREEN; hx.fillRect(sx + 1, N - 6, Math.round(38 * (1 - G.cdT / w.cd)), 1); }
  // supplies (bottom-right): corn + $FEED, golden HEGGs
  panel(N - 58, N - 20, 56, 18);
  drawItemIcon(0, N - 56, N - 17); inkText('' + (G.inv.food + G.inv.mre), N - 43, N - 14);
  if (artOk('hegg')) hx.drawImage(ART.hegg, N - 29, N - 18); else drawItemIcon(2, N - 30, N - 17);
  inkText('' + G.inv.med, N - 15, N - 14);
  // kill count + safe marker
  panel(2, 31, 22 + String(G.kills).length * 6 + (onTower() ? 32 : 0), 11);
  hx.drawImage(ICONS.skull, 5, 33); inkText('' + G.kills, 14, 32);
  if (onTower()) inkText('SAFE', 22 + String(G.kills).length * 6, 32, '#0a8a3a');
  else { // compass arrow to the coop when it is off-screen
    const p = w2s(LADDER.cx, 45 * TS);
    if (p[0] < 6 || p[0] > N - 6 || p[1] < 6 || p[1] > N - 6) { const c = N / 2, a = Math.atan2(p[1] - c, p[0] - c), r = N / 2 - 34; const ax = c + Math.cos(a) * r, ay = c + Math.sin(a) * r; const ac = night ? HRED : HGOLD; for (let k = 0; k < 4; k++) { const bx = ax - Math.cos(a) * k * 2, by = ay - Math.sin(a) * k * 2; hx.fillStyle = INK; hx.fillRect(Math.round(bx - (3 - k) / 2) - 1, Math.round(by - (3 - k) / 2) - 1, 6 - k, 6 - k); hx.fillStyle = ac; hx.fillRect(Math.round(bx - (3 - k) / 2), Math.round(by - (3 - k) / 2), 4 - k, 4 - k); } text('COOP', Math.round(ax), Math.round(ay + 4), 8, ac, 'center'); }
  }
  // messages
  let my = 40; for (const m of G.msg) { text(m.s, N / 2, my, 8, '#e8d6a8', 'center'); my += 9; m.t -= dt; }
  G.msg = G.msg.filter((m) => m.t > 0);
  // context hint
  const h = hintText(); if (h && G.state === 'play') text(h, N / 2, N - 33, 8, '#f0c050', 'center');
  if (G.state === 'bag' || G.state === 'camp') drawMenu();
  if (G.state === 'dead') drawDead(t);
}
function pixLine(x0, y0, x1, y1, col) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0; hx.fillStyle = col; while (n++ < 600) { hx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
function drawMenu() {
  const items = MENUS[G.state](), w = Math.min(N - 16, 200), h = 26 + items.length * 11, x = Math.round((N - w) / 2), y = Math.round((N - h) / 2) - 6;
  hx.fillStyle = 'rgba(9,11,10,.4)'; hx.fillRect(0, 0, N, N);
  panel(x, y, w, h, 0.97);
  inkText(G.state === 'camp' ? 'THE NEST' : 'BAG  -  PAUSED', N / 2, y + 3, '#bd2232', 'center');
  items.forEach((it, i) => { const sel = i === G.menuI, yy = y + 15 + i * 11; if (sel) { hx.fillStyle = HGOLD; hx.fillRect(x + 3, yy - 1, w - 6, 10); hx.fillStyle = INK; hx.fillRect(x + 3, yy + 8, w - 6, 1); inkText('>', x + 6, yy); } inkText(it.t, x + 14, yy, it.dis ? '#a99c76' : INK); });
  const inv = 'CORN ' + G.inv.food + '  $FEED ' + G.inv.mre + '  EGGS ' + G.inv.ammo + '  KERNELS ' + G.inv.shells;
  inkText(inv, N / 2, y + h - 10, '#855a36', 'center');
  text(L('A') + ' SELECT   ' + L('B') + ' BACK   ' + L('move') + ' CHOOSE', N / 2, y + h + 4, 8, CREAM, 'center');
}
function drawDead(t) {
  G.deadT += 1 / 60;
  hx.fillStyle = `rgba(9,11,10,${Math.min(0.55, G.deadT * 0.5)})`; hx.fillRect(0, 0, N, N);
  const y = N / 2 - 46, pw = Math.min(N - 12, 196), px0 = Math.round(N / 2 - pw / 2);
  panel(px0, y - 6, pw, 94);
  if (artOk('hen-plucked')) hx.drawImage(ART['hen-plucked'], px0 + 4, y + 34);
  text('PLUCKED', N / 2, y, 16, HRED, 'center');
  inkText('TAKEN BY ' + G.deathCause, N / 2, y + 22, INK, 'center');
  inkText('DAY ' + G.day + '  PECKED ' + G.kills, N / 2 + 26, y + 38, '#c06a16', 'center');
  inkText((G.newBest ? 'NEW BEST ' : 'BEST ') + 'DAY ' + best.days + ' / ' + best.kills, N / 2 + 26, y + 50, G.newBest ? '#0a8a3a' : '#855a36', 'center');
  inkText('BILLIONS MUST BOK.', N / 2 + 26, y + 62, INK, 'center');
  if (G.deadT > 1.2 && (t % 1) < 0.65) text(L('A') + ' TO HATCH AGAIN', N / 2, y + 92, 8, CREAM, 'center');
}
function drawTitle(t) {
  hx.fillStyle = 'rgba(9,11,10,.18)'; hx.fillRect(0, 0, N, N);
  const y = Math.round(N * 0.08), cw = Math.min(N - 16, 210), cx0 = Math.round(N / 2 - cw / 2);
  panel(cx0, y - 4, cw, 86);
  if (artOk('hen-title')) { const bobY = Math.round(Math.sin(t * 3) * 1); hx.drawImage(ART['hen-title'], cx0 + cw - 52, y + 10 + bobY); }
  const tx = cx0 + Math.round((cw - 56) / 2);
  text('LAST', tx, y, 16, HRED, 'center');
  text('TOWER', tx, y + 17, 16, '#ffffff', 'center');
  inkText('CHIKN EDITION', tx, y + 38, '#0a8a3a', 'center');
  inkText('FORAGE BY DAY.', tx, y + 50, INK, 'center'); inkText('ROOST BY NIGHT.', tx, y + 59, INK, 'center');
  inkText('BILLIONS MUST BOK.', tx, y + 70, '#855a36', 'center');
  const m = mode(), cy = Math.max(y + 96, Math.round(N * 0.5));
  panel(Math.round(N / 2 - 82), cy - 5, 164, 53);
  const rows = [[L('move'), 'MOVE'], [L('A'), 'FLAP / CONFIRM'], [L('B'), 'PECK / USE / BACK'], [L('START'), 'PAUSE & ITEMS'], [L('SELECT'), 'NEXT WEAPON']];
  rows.forEach(([k, v], i) => { inkText(k, N / 2 - 30, cy + i * 9, '#bd2232', 'right'); inkText(v, N / 2 - 24, cy + i * 9); });
  if ((t % 1) < 0.65) text('PRESS ' + (m === 'keys' ? 'SPACE' : 'A') + ' TO START', N / 2, N - 32, 8, HGOLD, 'center');
  if (best.days) text('BEST: DAY ' + best.days + '  /  ' + best.kills + ' PECKED', N / 2, N - 20, 8, CREAM, 'center');
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
  return { lamp: lamp(true), lampOff: lamp(false), tree: tree(), antenna: antenna(), fire: [0, 1, 2].map(fire) };
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
function applyLight(t) {
  const dl = daylight(); if (dl >= 1 && !(G && G.lightning > 0)) return;
  const dusk = dl > 0 && dl < 1 ? 1 - Math.abs(dl * 2 - 1) : 0;
  let r = lerp(58, 255, dl), g = lerp(62, 255, dl), b = lerp(112, 255, dl);
  r = lerp(r, 255, dusk * 0.4); g = lerp(g, 160, dusk * 0.45); b = lerp(b, 130, dusk * 0.5);
  if (G && G.lightning > 0) { r = g = b = 255; G.lightning = Math.max(0, G.lightning - 0.08); }
  const L = light.x; L.globalCompositeOperation = 'source-over'; L.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; L.fillRect(0, 0, N, N);
  L.globalCompositeOperation = 'lighter';
  const k = 1 - dl, add = (wx, wy, rad, col) => { const [sx, sy] = w2s(wx, wy); if (sx < -rad || sy < -rad || sx > N + rad || sy > N + rad) return; L.globalAlpha = k; L.drawImage(disc(rad, col), sx - rad, sy - rad); };
  if (G && G.state !== 'dead') add(player.x, player.y - 6 - player.jz, 46, '#d8a070');
  const fl = Math.sin(t * 12) > -0.6;
  for (const p of props) {
    if (p.type === 'lamp' && p.lit && (!p.flick || ((t * 3 + p.seed) % 7) > 0.5)) add(p.tx * TS + 12, p.ty * TS + 10, 36, '#c8b080');
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
function renderWorld(dt, t) {
  hx.fillStyle = '#0e0a14'; hx.fillRect(0, 0, N, N);
  hx.drawImage(MAPC, -camX, -camY);
  const list = [];
  // items
  for (const it of itemPool) if (it.alive) { const bobY = Math.round(Math.sin(t * 3 + it.ph) * 1.5); list.push({ y: it.y, draw: () => { const [sx, sy] = w2s(it.x, it.y); hx.drawImage(SHADOW.i, sx - 5, sy - 3); hx.drawImage(ITEM_IMG, ITEMS.indexOf(it.kind) * 16, 0, 16, 16, sx - 8, sy - 15 + bobY, 16, 16); if (((t * 2 + it.ph) % 3) < 0.15) { hx.fillStyle = '#fff4c0'; hx.fillRect(sx + 3, sy - 13 + bobY, 1, 1); } } }); }
  // zombies (live and falling corpses)
  for (const z of zombiePool) {
    const s = z.spr, row = actorRow(z.fx, z.fy), col = z.alive ? Math.floor(z.anim) % 4 : 0, w = s.cw, h = s.ch;
    const rect = [z.x - w / 2, z.y - h + 1, w, h];
    list.push({ y: z.y, rect, actor: true, draw: () => {
      const [sx, sy] = w2s(z.x, z.y);
      hx.drawImage(z.brute ? SHADOW.b : SHADOW.s, sx - (z.brute ? 8 : 6), sy - 3);
      if (!z.alive) { // collapse: draw squashed frames sinking, then gone
        const k = clamp(z.dead / 0.6, 0, 1), hh = Math.max(4, Math.round(h * k));
        hx.globalAlpha = 0.5 + k * 0.5; hx.drawImage(s.img, ...spriteFrame(s, row, 0), Math.round(sx - w / 2), sy - hh + 1, w, hh); hx.globalAlpha = 1; return; }
      if (z.hurt > 0 && Math.floor(t * 30) % 2) { hx.drawImage(s.sil, ...spriteFrame(s, row, col), Math.round(sx - w / 2), sy - h + 1, w, h); return; }
      const lunge = z.atk > 0 ? Math.round(Math.sin((0.4 - z.atk) / 0.4 * Math.PI) * 3) : 0;
      hx.drawImage(s.img, ...spriteFrame(s, row, col), Math.round(sx - w / 2 + Math.sign(z.fx) * lunge * (row > 1 ? 1 : 0)), sy - h + 1 + (row === 0 ? lunge : row === 1 ? -lunge : 0), w, h);
    } });
  }
  // player
  const ps = SPR.player, pcol = player.moving && !player.air ? Math.floor(player.anim) % 4 : (player.air ? 1 : 0);
  const prect = [player.x - 8, player.y - 22 - player.jz, 16, 22];
  const drawPlayer = (sil) => {
    const [sx, sy] = w2s(player.x, player.y), py = sy - 21 - Math.round(player.jz);
    if (!sil && !player.climb) { const sh = player.jz > 6 ? SHADOW.i : SHADOW.s; hx.drawImage(sh, sx - sh.width / 2, sy - 3); }
    if (!sil && player.hurtT > 0 && Math.floor(t * 30) % 2) return;
    hx.drawImage(sil ? ps.sil : ps.img, ...spriteFrame(ps, player.dir, pcol), sx - 8, py, 16, 22);
    if (!sil && player.atkT > 0) { const w = WEAPONS[G.weapon]; if (w.icon >= 0) { const [fx, fy] = dirVec(); const ox = Math.round(fx * 9), oy = Math.round(fy * 7); if (fx < -0.3) { hx.save(); hx.translate(sx + ox, 0); hx.scale(-1, 1); hx.drawImage(ITEM_IMG, w.icon * 16, 0, 16, 16, -8, py + 6 + oy, 16, 16); hx.restore(); } else hx.drawImage(ITEM_IMG, w.icon * 16, 0, 16, 16, sx - 8 + ox, py + 6 + oy, 16, 16); } }
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
  if (covered) drawPlayer(true);
  // effects
  if (G && G.swing && G.swing.t > 0) { const sw = G.swing; sw.t -= dt; const prog = 1 - sw.t / 0.16, [px0, py0] = w2s(player.x, player.y - 10 - player.jz);
    for (let k = 0; k <= 8; k++) { const a = sw.a - 1.0 + Math.min(prog, 1) * 2.0 * (k / 8); const rr = sw.reach; hx.fillStyle = k > 6 ? '#fff4c0' : '#c8c0b0'; hx.fillRect(Math.round(px0 + Math.cos(a) * rr), Math.round(py0 + Math.sin(a) * rr * 0.85), 2, 2); } }
  if (G && G.tracers) { for (const tr of G.tracers) { const a = w2s(tr.x0, tr.y0), b = w2s(tr.x1, tr.y1);
    if (tr.k === 'shotgun') { const n = Math.max(2, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 11)); for (let q = 1; q <= n; q++) { const qx = Math.round(a[0] + (b[0] - a[0]) * q / n), qy = Math.round(a[1] + (b[1] - a[1]) * q / n); hx.fillStyle = OUT; hx.fillRect(qx - 1, qy - 1, 4, 4); hx.fillStyle = '#ffc42f'; hx.fillRect(qx, qy, 2, 2); } } // corn kernels
    else if (tr.k === 'pistol') { pixLine(a[0], a[1], b[0], b[1], 'rgba(255,255,255,.55)'); hx.fillStyle = OUT; hx.fillRect(b[0] - 2, b[1] - 3, 5, 6); hx.fillStyle = '#ffffff'; hx.fillRect(b[0] - 1, b[1] - 2, 3, 4); hx.fillStyle = '#ffc42f'; hx.fillRect(b[0], b[1] - 1, 1, 2); } // egg
    else pixLine(a[0], a[1], b[0], b[1], '#ffe9a0'); tr.t -= dt; } G.tracers = G.tracers.filter((q) => q.t > 0); }
  if (G && G.hits) { for (const h of G.hits) { const p = w2s(h.x, h.y); for (let k = 0; k < 6; k++) { hx.fillStyle = k % 2 ? '#ffffff' : RAMP.blood[0]; hx.fillRect(p[0] + Math.round((Math.random() - 0.5) * 9), p[1] + Math.round((Math.random() - 0.5) * 9), 2, 1); } hx.fillStyle = '#ffc42f'; hx.fillRect(p[0], p[1], 1, 1); h.t -= dt; } G.hits = G.hits.filter((q) => q.t > 0); }
  applyLight(t);
  drawWeather(dt);
  return covered;
}

// ================================================================ main loop
let STATE = 'title', last = performance.now(), T0 = 0, lastCovered = false;
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
  handleButtons();
  if (STATE === 'title') {
    if (!G) { G = { t: 40, day: 1, owned: ['fists'], state: 'title', msg: [], kills: 0, tracers: [], hits: [] }; Object.assign(player, { x: 40 * TS, y: 36 * TS, level: 0 }); for (let i = 0; i < 18; i++) spawnZombie(false, true); }
    const a = T0 * 0.15; player.x = 40 * TS + Math.sin(a) * 120; player.y = 38 * TS + Math.cos(a * 0.7) * 70;
    for (const z of zombiePool) { z.wt -= dt; if (z.wt <= 0) { z.wt = 3 + Math.random() * 4; z.wx = z.x + (Math.random() - 0.5) * 60; z.wy = z.y + (Math.random() - 0.5) * 60; } const vx = z.wx - z.x, vy = z.wy - z.y, l = Math.hypot(vx, vy); if (l > 3) { moveBody(z, vx / l * 10 * dt, vy / l * 10 * dt, 4); z.anim += dt * 3; z.fx = vx; z.fy = vy; } }
    updateCamera(dt, T0 < 0.1);
    renderWorld(dt, T0); drawHUD(dt, T0); return;
  }
  if (G.state === 'play' || G.state === 'dead') {
    const scale = G.state === 'play' ? updateClock(dt) : 1;
    if (G.state === 'play') { updatePlayer(dt); updateSurvival(dt, dt * scale); }
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
window.__lt = { get G() { return G; }, player, get state() { return STATE; }, newGame: () => { STATE = 'game'; newGame(); }, zombies: zombiePool, items: itemPool, ledges, LADDER, NEST, TOWER, TS, get N() { return N; }, setTime: (t) => { G.t = t; },
  get muted() { return muted; }, get mode() { return mode(); }, get covered() { return lastCovered; }, get cam() { return [camX, camY]; }, spawnZombie, lvlAt: (x, y) => lvl[tileAt(x, y)], kindAt: (x, y) => kind[tileAt(x, y)], props };
