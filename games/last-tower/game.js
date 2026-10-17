/* LAST TOWER v2: 3/4 top-down pixel survival in the style rules of 16-bit SNES adventure games.
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

// ================================================================ palette: "dark world" ramps [highlight, base, shadow, deep]
// highlights lean warm/yellow, shadows lean blue/purple (hue-shifted ramps)
const OUT = '#140c18';
const RAMP = {
  asphalt: ['#5e5a6a', '#4a465a', '#39354a', '#2a2638'],
  walk: ['#9a9080', '#7e7666', '#615a52', '#463f42'],
  plaza: ['#9a9486', '#7c776c', '#605b56', '#443f44'],
  grass: ['#7a7c44', '#5e6236', '#46492e', '#30302a'],
  dirt: ['#86705a', '#6a5646', '#504038', '#382c2e'],
  brick: ['#b0684e', '#8c4c3e', '#6a3436', '#47222c'],
  conc: ['#8e8a90', '#726e7a', '#575264', '#3c374c'],
  tower: ['#9a9488', '#7a756e', '#5c5658', '#3e3942'],
  roof: ['#6a6058', '#524a46', '#3e3638', '#2a242a'],
  rust: ['#c07a40', '#9a5430', '#723a2a', '#4a2226'],
  metal: ['#b4ae9c', '#8a8578', '#66605e', '#433e44'],
  hazard: ['#f0c850', '#d09a30', '#9a6a28', '#5a3a22'],
  car1: ['#7e8a96', '#5e6a7a', '#46505e', '#2e3442'],
  car2: ['#a4584a', '#80403c', '#5e2c30', '#3e1c24'],
  car3: ['#8c8a62', '#6c6a4a', '#504e3a', '#36342a'],
  glass: ['#8ab0c4', '#5a7890', '#3c5068', '#262e44'],
  lit: ['#ffe9a0', '#f0c050', '#c08030', '#7a4a24'],
  wood: ['#a07a4a', '#7c5a36', '#5c4028', '#3c2a20'],
  fire: ['#fff4c0', '#ffc040', '#e86020', '#a02818'],
  water: ['#6a7a9a', '#4a5878', '#36405c', '#262c44'],
  blood: ['#b03030', '#842424', '#5a1a20', '#3a1018'],
  // actors
  pskin: ['#f0b890', '#c88a66', '#94604c', '#5e3a36'],
  hood: ['#7c8e52', '#5c6c3c', '#40502e', '#2a3424'],
  coat: ['#6a7848', '#4c5a36', '#36402a', '#242a20'],
  scarf: ['#f08a40', '#c85a2a', '#8c3a24', '#5a2420'],
  pants: ['#646884', '#4a4c66', '#34364c', '#242436'],
  boots: ['#6a4a34', '#4a3224', '#32221c', '#201418'],
  pack: ['#9a7a48', '#765a34', '#543e28', '#38281e'],
  gog: ['#3a3a48', '#26263a', '#1a1a2a', '#100c18'],
  zskin: ['#a8b88c', '#84946c', '#606e54', '#3e4a3c'],
  zhair: ['#4a4038', '#36302c', '#262224', '#18141a'],
  zshirt1: ['#6a7e92', '#4e6074', '#384558', '#262e3e'],
  zshirt2: ['#a05a48', '#7c4038', '#5a2c2e', '#3c1c22'],
  zshirt3: ['#9a9680', '#7a7662', '#5a5648', '#3c3a34'],
  bshirt: ['#5a5a48', '#424236', '#2e2e28', '#1e1e1c'],
  bvest: ['#e0b040', '#b08428', '#7c5a20', '#4c3618'],
  zpants: ['#5a4e40', '#443a30', '#302a24', '#201c1a'],
  eyeZ: ['#fff0a0', '#fff0a0', '#fff0a0', '#fff0a0'],
  eyeB: ['#ff7a40', '#ff7a40', '#ff7a40', '#ff7a40'],
  mouth: ['#3a1018', '#3a1018', '#3a1018', '#3a1018'],
  glint: ['#e0f0ff', '#e0f0ff', '#e0f0ff', '#e0f0ff'],
};
const DARK_SHADOW = 'rgba(28,14,48,0.42)'; // cast shadows: purple, layered like colour-math subtraction
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
  '<': [0x08, 0x14, 0x22, 0x41], '(': [0x1C, 0x22, 0x41], ')': [0x41, 0x22, 0x1C], '&': [0x36, 0x49, 0x55, 0x22, 0x50], "'": [0x05, 0x03], '*': [0x2A, 0x1C, 0x3E, 0x1C, 0x2A],
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
// ---- humanoid templates (16 wide x 22 tall, 1px margin left for the outline)
const P_DOWN = [
  '................', '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HHSSSSSSHH...', '...HGGGSSGGGH...', '...HGgGSSGgGH...', '...HSSSSSSSSH...',
  '....HMMMMMMH....', '....AAAAAAAA....', '...CCAAAAAACC...', '..CCCCAAAACCCC..', '..CCCCCCCCCCCC..', '..SCCCCCCCCCCS..', '..SCCCCCCCCCCS..', '...LLLLLLLLLL...'];
const P_UP = [
  '................', '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '....HHHHHHHH....',
  '....AAAAAAAA....', '...CCKKKKKKCC...', '..CCKKKKKKKKCC..', '..CCKkkkkkkKCC..', '..CCKKKKKKKKCC..', '..SCKKKKKKKKCS..', '..SCCKKKKKKCCS..', '...LLLLLLLLLL...'];
const P_SIDE = [
  '................', '......HHHHH.....', '.....HHHHHHH....', '....HHHHHHHHH...', '....HHHHSSSSH...', '....HHHSGGGG....', '....HHHSGgGG....', '....HHHSSSSS....',
  '.....HHMMMMM....', '......AAAAA.....', '....KKCCCAAA....', '...KKKCCCCC.....', '...KKKCCCCC.....', '...KKKCCSCC.....', '...KKKCCCCC.....', '.....LLLLL......'];
const Z_DOWN = [
  '................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hZZZZZZh....', '....ZZZZZZZZ....', '....ZeZZZZeZ....', '....ZZZZZZZZ....',
  '.....ZZmmZZ.....', '.....ZZZZZZ.....', '...TTTTTTTTTT...', '..ZTTTTRTTTTTZ..', '..ZTTTTTTTTTTZ..', '..ZTTTRTTTTTTZ..', '..ZZTTTTTTTTZZ..', '...TT.TTTT.TT...'];
const Z_UP = [
  '................', '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hZhhhhZh....', '....ZZZZZZZZ....',
  '.....ZZZZZZ.....', '.....ZZZZZZ.....', '...TTTTTTTTTT...', '..ZTTTTTTTRTTZ..', '..ZTTTTTTTTTTZ..', '..ZTTRTTTTTTTZ..', '..ZTTTTTTTTTTZ..', '...TT.TTTT.TT...'];
const Z_SIDE = [
  '................', '................', '......hhhhh.....', '.....hhhhhhh....', '.....hhZZZZZ....', '.....hZZZZeZ....', '.....hZZZZZZ....', '......ZZZmmZ....',
  '.......ZZZZ.....', '......TTTTT.....', '.....TTTTTZZZZZ.', '.....TTTTTTTTZZ.', '.....TTTTTTT....', '.....TRTTTTT....', '.....TTTTTTT....', '.....T.TTT.T....'];
const LEGS = {
  dStand: ['...PPPPPPPPPP...', '...PPPP..PPPP...', '...PPPP..PPPP...', '...PPP....PPP...', '...BBB....BBB...', '..BBBB....BBBB..'],
  dWalk: ['...PPPPPPPPPP...', '...PPPP..PPPP...', '...PPPP..PPPP...', '...BBBB...PPP...', '..BBBB....BBB...', '..........BBBB..'],
  sStand: ['.....PPPPP......', '.....PP.PP......', '.....PP.PP......', '.....PP.PP......', '.....BB.BBB.....', '....BBB.BBBB....'],
  sStride: ['.....PPPPP......', '....PP...PP.....', '....PP...PP.....', '...PP.....PP....', '..BBB.....BBB...', '..BB.......BBB..'],
  sPass: ['.....PPPPP......', '......PPP.......', '......PPP.......', '.....PPPP.......', '.....BBBBB......', '......BBBB......'],
};
const bob = (upper) => ['.'.repeat(16), ...upper.slice(0, 15)];
function humanFrames(down, up, side) {
  const dW2 = LEGS.dWalk.map(flipRow);
  const D = [[...down, ...LEGS.dStand], [...bob(down), ...LEGS.dWalk], [...down, ...LEGS.dStand], [...bob(down), ...dW2]];
  const U = [[...up, ...LEGS.dStand], [...bob(up), ...LEGS.dWalk], [...up, ...LEGS.dStand], [...bob(up), ...dW2]];
  const R = [[...side, ...LEGS.sStand], [...bob(side), ...LEGS.sStride], [...side, ...LEGS.sPass], [...bob(side), ...LEGS.sStride]];
  const Lf = R.map((f) => f.map(flipRow));
  return [D, U, Lf, R]; // rows: down, up, left, right
}
function widen(f) { // bulkier "brute" variant: duplicate the centre columns and a torso row
  const w = f.map((r) => r.slice(0, 8) + r.slice(7, 9) + r.slice(8)); w.splice(12, 0, w[12]); return w;
}
function atlas(frames, mats, opt) {
  const cw = frames[0][0][0].length, ch = frames[0][0].length;
  const [c, x] = mk(cw * 4, ch * 4);
  frames.forEach((row, ri) => row.forEach((f, fi) => x.drawImage(paint(f, mats, opt), fi * cw, ri * ch)));
  // silhouette version (outline recoloured bright, body faint) for the "never hidden" pass
  const [s, sx] = mk(c.width, c.height); sx.drawImage(c, 0, 0);
  const id = sx.getImageData(0, 0, c.width, c.height), d = id.data, [or, og, ob] = hex(OUT);
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; if (d[i] === or && d[i + 1] === og && d[i + 2] === ob) { d[i] = 255; d[i + 1] = 236; d[i + 2] = 170; } else { d[i] = 255; d[i + 1] = 236; d[i + 2] = 170; d[i + 3] = 70; } }
  sx.putImageData(id, 0, 0);
  return { img: c, sil: s, cw, ch };
}
const PLAYER_MATS = { H: 'hood', S: 'pskin', G: 'gog', g: 'glint', M: 'gog', A: 'scarf', C: 'coat', L: 'boots', P: 'pants', B: 'boots', K: 'pack', k: 'wood' };
const SPR = {
  player: atlas(humanFrames(P_DOWN, P_UP, P_SIDE), PLAYER_MATS, { flat: 'gG', noFold: 'gGS' }),
  zombies: ['zshirt1', 'zshirt2', 'zshirt3'].map((sh) => atlas(humanFrames(Z_DOWN, Z_UP, Z_SIDE), { h: 'zhair', Z: 'zskin', e: 'eyeZ', m: 'mouth', T: sh, R: 'blood', P: 'zpants', B: 'boots' }, { flat: 'em' })),
  brute: atlas(humanFrames(Z_DOWN, Z_UP, Z_SIDE).map((row) => row.map(widen)), { h: 'zhair', Z: 'zskin', e: 'eyeB', m: 'mouth', T: 'bvest', R: 'bshirt', P: 'zpants', B: 'boots' }, { flat: 'em' }),
};
// ---- items (16x16 cells)
const ITEMS = ['food', 'mre', 'med', 'ammo', 'shells', 'pipe', 'machete', 'pistol', 'shotgun', 'water'];
const ITEM_ART = {
  food: [['.....', '..cccccc..', '.cwwwwwwc.', '.cwwwwwwc.', '.crrrrrrc.', '.crYYrrrc.', '.crrrrrrc.', '.cwwwwwwc.', '.cwwwwwwc.', '..cccccc..'], { c: 'metal', w: 'metal', r: 'brick', Y: 'lit' }],
  mre: [['', '.oooooooo.', 'oOOOOOOOOo', 'oOOOOOOOOo', 'oOOttttOOo', 'oOOOOOOOOo', 'oOOOOOOOOo', '.oooooooo.'], { o: 'hood', O: 'hood', t: 'zpants' }],
  med: [['....hh....', '..hh..hh..', '.wwwwwwwww', '.wwwwrwwww', '.wwwrrrwww', '.wwwwrwwww', '.wwwwwwwww', '.wwwwwwwww'], { h: 'metal', w: 'walk', r: 'blood' }],
  ammo: [['', '.gggggggg.', 'gGGGGGGGGg', 'gGyGyGyGGg', 'gGyGyGyGGg', 'gGGGGGGGGg', '.gggggggg.'], { g: 'coat', G: 'coat', y: 'hazard' }],
  shells: [['', '.rrrrrrrr.', 'rRRRRRRRRr', 'rRsRsRsRRr', 'rRsRsRsRRr', 'rRyRyRyRRr', '.rrrrrrrr.'], { r: 'car2', R: 'car2', s: 'blood', y: 'hazard' }],
  pipe: [['.........mm', '........mm.', '.......mm..', '......mm...', '.....mm....', '....mm.....', '...mm......', '..ww.......', '.ww........'], { m: 'metal', w: 'rust' }],
  machete: [['........ss', '.......sss', '......sss.', '.....sss..', '....sss...', '...sss....', '..bb......', '.bb.......'], { s: 'metal', b: 'wood' }],
  pistol: [['', '', '..gggggggg', '..gggggggg', '..ggggg...', '..gw......', '..ww......', '..ww......'], { g: 'gog', w: 'wood' }],
  shotgun: [['', '', 'ggggggggg..', 'ggggggwwwww', '......wwwww', '.......ww..'], { g: 'gog', w: 'wood' }],
  water: [['....cc....', '...wwww...', '...wwww...', '..wWWWWw..', '..wWWWWw..', '..wWWWWw..', '..wWWWWw..', '..wwwwww..'], { c: 'metal', w: 'glass', W: 'water' }],
};
const ITEM_IMG = (() => {
  const [c, x] = mk(16 * ITEMS.length, 16);
  ITEMS.forEach((k, i) => { const [g, m] = ITEM_ART[k]; const p = paint(['', ...g.map((r) => '.' + r)], m); x.drawImage(p, i * 16 + Math.floor((16 - p.width) / 2), 16 - p.height - 1); });
  return c;
})();

// ================================================================ world: 80x80 metatiles of 16x16, with height levels (3/4 view, pre-projected)
const TS = 16, MW = 80, MH = 80, WPX = MW * TS;
const K = { ASPH: 0, WALK: 1, GRASS: 2, PLAZA: 3, DIRT: 4, RUBTOP: 5, LEDGE: 6, TROOF: 7, BED: 8, BROOF: 10, BWALL: 11, TFACE: 12, RFACE: 13, CAR: 14, BARRIER: 15, PROP: 16, PARAPET: 17 };
const kind = new Uint8Array(MW * MH), lvl = new Int8Array(MW * MH);
const id = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH ? -1 : y * MW + x);
function setT(x, y, k, l) { const i = id(x, y); if (i < 0) return; kind[i] = k; lvl[i] = l; }
const isFace = (i) => i >= 0 && (kind[i] === K.TFACE || kind[i] === K.RFACE);
const WR = rng(2026);
const buildings = [], ruins = [], cars = [], props = [], ledges = [];
const TOWER = { x0: 34, x1: 45, ry0: 24, ry1: 31, fy0: 32, fy1: 45, ROOF: 7 };
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
  // the tower: roof (level 7) + tall south face; ledges zig-zag up the face (levels 1..6)
  const T = TOWER;
  for (let x = T.x0; x <= T.x1; x++) { for (let y = T.ry0; y <= T.ry1; y++) setT(x, y, K.TROOF, T.ROOF); for (let y = T.fy0; y <= T.fy1; y++) setT(x, y, K.TFACE, -1); }
  for (let x = T.x0; x <= T.x1; x++) { setT(x, T.ry0, K.PARAPET, -1); if (x < 39 || x > 42) setT(x, T.ry1, K.PARAPET, -1); }
  for (let y = T.ry0; y <= T.ry1; y++) { setT(T.x0, y, K.PARAPET, -1); setT(T.x1, y, K.PARAPET, -1); }
  [[35, 44], [39, 42], [43, 40], [39, 38], [35, 36], [38, 33]].forEach(([x, y], i) => { for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) setT(x + dx, y + dy, K.LEDGE, i + 1); ledges.push({ x, y, level: i + 1 }); });
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
  switch (k) {
    case K.ASPH: case K.CAR: case K.PROP: {
      const A = RAMP.asphalt; ground(A, 9);
      if (r() < 0.12) { let px = X + Math.floor(r() * 16), py = Y; for (let s = 0; s < 16; s++) { R_(px, py + s, 1, 1, A[3]); R_(px + 1, py + s, 1, 1, A[0]); px += r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0; px = clamp(px, X, X + 14); } }
      // dashed centre lines
      const cx = tx % 16, cy = ty % 16, crossing = cx < 3 && cy < 3;
      if (!crossing && cx === 1 && ty % 2 === 0) { R_(X + 15, Y + 2, 2, 10, RAMP.hazard[2]); R_(X + 15, Y + 2, 1, 10, RAMP.hazard[1]); }
      if (!crossing && cy === 1 && tx % 2 === 0) { R_(X + 2, Y + 15, 10, 2, RAMP.hazard[2]); R_(X + 2, Y + 15, 10, 1, RAMP.hazard[1]); }
      if (r() < 0.05) { R_(X + 3, Y + 6, 10, 5, RAMP.water[2]); R_(X + 2, Y + 7, 12, 3, RAMP.water[2]); R_(X + 4, Y + 7, 5, 1, RAMP.water[0]); } // puddle
      if (r() < 0.03) { R_(X + 4, Y + 4, 8, 8, A[3]); R_(X + 5, Y + 5, 6, 6, A[2]); R_(X + 5, Y + 7, 6, 1, A[3]); R_(X + 5, Y + 9, 6, 1, A[3]); } // manhole
      break; }
    case K.WALK: {
      const W = RAMP.walk;
      for (let sx = 0; sx < 16; sx += 8) for (let sy = 0; sy < 16; sy += 8) {
        const cracked = r() < 0.12;
        R_(X + sx, Y + sy, 8, 8, W[1]); R_(X + sx, Y + sy, 8, 1, W[0]); R_(X + sx, Y + sy, 1, 8, W[0]); R_(X + sx, Y + sy + 7, 8, 1, W[2]); R_(X + sx + 7, Y + sy, 1, 8, W[2]);
        if (cracked) { R_(X + sx + 2, Y + sy + 2, 1, 3, W[3]); R_(X + sx + 3, Y + sy + 4, 2, 1, W[3]); }
        if (r() < 0.1) { R_(X + sx + 7, Y + sy + 6, 1, 2, RAMP.grass[0]); R_(X + sx + 6, Y + sy + 7, 1, 1, RAMP.grass[1]); }
      }
      break; }
    case K.PLAZA: { // large flagstones, staggered, lit edges top-left
      const P = RAMP.plaza;
      for (let row = 0; row < 2; row++) for (let b = -1; b < 2; b++) { const bx = X + b * 12 + (row % 2) * 6 + ((ty % 2) * 3), by = Y + row * 8; const x0 = Math.max(X, bx), x1 = Math.min(X + 16, bx + 12); if (x1 <= x0) continue; const v = r() < 0.18 ? P[2] : P[1]; R_(x0, by, x1 - x0, 8, v); R_(x0, by, x1 - x0, 1, P[0]); R_(x0, by + 7, x1 - x0, 1, P[3]); if (bx >= X) R_(bx, by, 1, 8, P[0]); if (bx + 11 < X + 16 && bx + 11 >= X) R_(bx + 11, by, 1, 8, P[3]); }
      spk(X, Y, 16, 16, 6, [P[2], P[0]], r);
      if (r() < 0.06) { R_(X + 5, Y + 6, 6, 3, RAMP.blood[2]); R_(X + 7, Y + 9, 3, 2, RAMP.blood[2]); }
      break; }
    case K.GRASS: { const G = RAMP.grass; ground(G, 6); for (let n = 0; n < 5; n++) { const gx = X + 1 + Math.floor(r() * 13), gy = Y + 2 + Math.floor(r() * 12); R_(gx, gy, 1, 2, G[0]); R_(gx + 2, gy, 1, 2, G[0]); R_(gx + 1, gy + 1, 1, 2, G[0]); R_(gx, gy + 2, 3, 1, G[2]); } break; }
    case K.DIRT: { const D = RAMP.dirt; ground(D, 12); for (let n = 0; n < 3; n++) { const gx = X + 1 + Math.floor(r() * 12), gy = Y + 1 + Math.floor(r() * 12); R_(gx, gy, 2, 2, D[0]); R_(gx + 1, gy + 1, 2, 1, D[2]); } break; }
    case K.RUBTOP: case K.RFACE: case K.BED: {
      const D = RAMP.dirt, C = RAMP.conc; ground(D, 10);
      for (let n = 0; n < 4; n++) { const gx = X + Math.floor(r() * 12), gy = Y + Math.floor(r() * 12), w = 2 + Math.floor(r() * 3); R_(gx, gy + 2, w + 1, 1, OUT); R_(gx, gy, w, 2, C[1]); R_(gx, gy, w, 1, C[0]); R_(gx + w, gy, 1, 2, OUT); }
      if (r() < 0.2) { R_(X + 2, Y + 8, 12, 1, RAMP.rust[2]); R_(X + 2, Y + 7, 12, 1, RAMP.rust[0]); } // rebar
      break; }
    case K.TROOF: { const T = RAMP.tower; R_(X, Y, TS, TS, T[1]); R_(X, Y, TS, 1, T[0]); R_(X, Y, 1, TS, T[0]); R_(X, Y + 15, TS, 1, T[2]); R_(X + 15, Y, 1, TS, T[2]); spk(X, Y, TS, TS, 8, [T[2], T[0]], r); if (r() < 0.2) { R_(X + 4, Y + 5, 7, 4, T[2]); R_(X + 5, Y + 6, 4, 1, T[3]); } break; }
    case K.BARRIER: { const C = RAMP.conc, Ru = RAMP.rust; R_(X, Y, TS, TS, C[2]); R_(X, Y, TS, 6, C[0]); R_(X, Y + 6, TS, 1, C[1]); R_(X, Y + 15, TS, 1, OUT); for (let n = 0; n < 2; n++) R_(X + Math.floor(r() * 14), Y + 7, 2, 8, Ru[2]); R_(X + 2, Y + 9, 12, 2, (tx + ty) % 2 ? RAMP.hazard[1] : C[3]); break; }
    default: R_(X, Y, TS, TS, RAMP.asphalt[1]);
  }
}
function drawBuilding(b) {
  const r = rng(b.seed), X = b.x0 * TS, Y = b.y0 * TS, W = b.w * TS, RH = (b.h - b.wallRows) * TS, WH = b.wallRows * TS, Rf = RAMP.roof;
  // roof (top surface)
  R_(X, Y, W, RH, Rf[1]); spk(X, Y, W, RH, W * RH / 40, [Rf[2], Rf[0], Rf[3]], r);
  R_(X, Y, W, RH, 'rgba(0,0,0,0)');
  // parapet rim: lit top-left, shadowed bottom-right, outer outline
  R_(X, Y, W, 3, Rf[0]); R_(X, Y, 3, RH, Rf[0]); R_(X, Y + RH - 3, W, 3, Rf[2]); R_(X + W - 3, Y, 3, RH, Rf[2]);
  R_(X + 3, Y + 3, W - 6, 1, Rf[3]); R_(X + 3, Y + 3, 1, RH - 6, Rf[3]);
  R_(X, Y, W, 1, OUT); R_(X, Y, 1, RH + WH, OUT); R_(X + W - 1, Y, 1, RH + WH, OUT);
  // roof furniture (each a little 3/4 box: lit top, darker front, outline)
  const n = Math.floor(b.w * (b.h - b.wallRows) / 18) + 1;
  for (let i = 0; i < n; i++) {
    const t = r(), fx = X + 6 + Math.floor(r() * (W - 26)), fy = Y + 6 + Math.floor(r() * Math.max(1, RH - 26));
    if (t < 0.35) box3(fx, fy, 10, 5, 5, RAMP.metal);              // vent
    else if (t < 0.6) { box3(fx, fy, 14, 6, 8, RAMP.conc); for (let g = 0; g < 4; g++) R_(fx + 2 + g * 3, fy + 8, 2, 4, RAMP.conc[3]); } // AC unit
    else if (t < 0.75) { R_(fx - 1, fy - 1, 14, 10, OUT); R_(fx, fy, 12, 8, RAMP.glass[2]); R_(fx, fy, 12, 1, RAMP.glass[0]); R_(fx + 3, fy + 3, 5, 3, RAMP.glass[3]); } // broken skylight
    else if (t < 0.88) { R_(fx, fy, 14, 9, Rf[3]); R_(fx + 2, fy + 2, 10, 6, '#0c0810'); R_(fx + 3, fy + 6, 3, 2, RAMP.conc[2]); } // collapsed hole
    else { box3(fx, fy, 14, 10, 14, RAMP.rust); R_(fx + 2, fy + 24, 2, 4, OUT); R_(fx + 10, fy + 24, 2, 4, OUT); } // water tank
  }
  // wall (south face)
  const Wm = RAMP[b.mat], WY = Y + RH;
  R_(X, WY, W, WH, Wm[1]);
  if (b.mat === 'brick') for (let yy = 0; yy < WH; yy += 4) { R_(X, WY + yy + 3, W, 1, Wm[2]); for (let xx = ((yy / 4) % 2) * 4; xx < W; xx += 8) R_(X + xx, WY + yy, 1, 3, Wm[2]); }
  else for (let xx = 0; xx < W; xx += 16) { R_(X + xx, WY, 1, WH, Wm[2]); R_(X + xx + 1, WY, 1, WH, Wm[0]); }
  spk(X, WY, W, WH, W * WH / 30, [Wm[0], Wm[2]], r);
  R_(X, WY, W, 2, Wm[3]); R_(X, WY + 2, W, 1, Wm[2]);                     // shadow under roof lip
  R_(X + 1, WY, 1, WH, Wm[0]); R_(X + W - 3, WY, 2, WH, Wm[2]);          // light from top-left
  for (let row = 0; row < b.wallRows; row++) for (let col = 0; col < b.w; col++) {
    const wx = X + col * TS, wy = WY + row * TS, ground = row === b.wallRows - 1;
    if (ground) {
      const t = r();
      if (t < 0.3) { R_(wx + 3, wy + 3, 10, 13, OUT); R_(wx + 4, wy + 4, 8, 12, RAMP.wood[2]); R_(wx + 4, wy + 4, 8, 1, RAMP.wood[0]); R_(wx + 10, wy + 10, 1, 1, RAMP.hazard[0]); }
      else if (t < 0.6) { R_(wx + 1, wy + 3, 14, 13, OUT); R_(wx + 2, wy + 4, 12, 12, RAMP.metal[2]); for (let s = 0; s < 12; s += 2) R_(wx + 2, wy + 4 + s, 12, 1, RAMP.metal[1]); if (r() < 0.5) R_(wx + 4, wy + 11, 7, 5, '#0c0810'); }
      else if (t < 0.75) { R_(wx + 1, wy + 3, 14, 12, OUT); R_(wx + 2, wy + 4, 12, 10, RAMP.glass[3]); R_(wx + 2, wy + 4, 3, 2, RAMP.glass[1]); R_(wx + 10, wy + 11, 4, 3, RAMP.glass[1]); }
      if (r() < 0.25) { const gc = [RAMP.scarf[1], RAMP.hazard[1], RAMP.zshirt1[0], RAMP.conc[0]][Math.floor(r() * 4)]; for (let g = 0; g < 6; g++) R_(wx + 2 + g * 2, wy + 6 + Math.round(Math.sin(g * 1.7 + col) * 2), 2, 2, gc); }
    } else {
      const t = r(); R_(wx + 3, wy + 3, 10, 10, OUT);
      if (t < 0.22) { R_(wx + 4, wy + 4, 8, 8, RAMP.lit[1]); R_(wx + 4, wy + 4, 8, 1, RAMP.lit[0]); R_(wx + 4, wy + 4, 1, 8, RAMP.lit[0]); R_(wx + 8, wy + 4, 1, 8, RAMP.lit[2]); R_(wx + 4, wy + 8, 8, 1, RAMP.lit[2]); b.lit = (b.lit || []).concat([[wx + 8, wy + 8]]); }
      else if (t < 0.45) { R_(wx + 4, wy + 4, 8, 8, RAMP.wood[1]); R_(wx + 4, wy + 6, 8, 1, RAMP.wood[3]); R_(wx + 4, wy + 9, 8, 1, RAMP.wood[3]); R_(wx + 4, wy + 4, 8, 1, RAMP.wood[0]); }
      else { R_(wx + 4, wy + 4, 8, 8, RAMP.glass[3]); R_(wx + 4, wy + 4, 2, 1, RAMP.glass[0]); R_(wx + 4, wy + 5, 1, 1, RAMP.glass[0]); if (t > 0.8) { R_(wx + 6, wy + 6, 3, 3, '#0c0810'); } }
      R_(wx + 3, wy + 13, 10, 1, Wm[0]);
      if (r() < 0.3) for (let s = 0; s < 6 + r() * 8; s++) R_(wx + 6 + (s % 2), wy + 14 + s, 1, 1, RAMP.rust[2]);
    }
  }
  R_(X, WY + WH - 1, W, 1, OUT);
}
function box3(x, y, w, top, front, ramp) { R_(x - 1, y - 1, w + 2, top + front + 2, OUT); R_(x, y, w, top, ramp[0]); R_(x, y + top, w, front, ramp[2]); R_(x, y + top, w, 1, ramp[3]); R_(x, y, 1, top, ramp[0]); R_(x + w - 1, y, 1, top + front, ramp[3]); R_(x + 1, y + 1, w - 2, top - 2, ramp[1]); }
function drawTower() {
  const T = TOWER, X = T.x0 * TS, W = (T.x1 - T.x0 + 1) * TS, FY = T.fy0 * TS, FH = (T.fy1 - T.fy0 + 1) * TS, C = RAMP.tower, r = rng(77);
  R_(X, FY, W, FH, C[1]);
  for (let yy = 0; yy < FH; yy += 16) { R_(X, FY + yy, W, 1, C[0]); R_(X, FY + yy + 15, W, 1, C[2]); }
  for (let xx = 0; xx < W; xx += 32) { R_(X + xx, FY, 1, FH, C[2]); R_(X + xx + 1, FY, 1, FH, C[0]); }
  spk(X, FY, W, FH, W * FH / 22, [C[0], C[2], C[3]], r);
  for (let row = 1; row < (T.fy1 - T.fy0 + 1); row += 2) for (let col = 0; col < 12; col += 2) { const wx = X + col * TS + 10, wy = FY + row * TS + 3; R_(wx - 1, wy - 1, 12, 10, OUT); const lit = r() < 0.15; R_(wx, wy, 10, 8, lit ? RAMP.lit[1] : RAMP.glass[3]); R_(wx, wy, 10, 1, lit ? RAMP.lit[0] : RAMP.glass[2]); if (!lit && r() < 0.4) { R_(wx, wy + 3, 10, 1, RAMP.wood[1]); R_(wx, wy + 5, 10, 1, RAMP.wood[1]); } for (let s = 0; s < 4 + r() * 10; s++) R_(wx + 4, wy + 9 + s, 1, 1, RAMP.rust[2]); }
  // hazard band at the top of the face, grime at the base, light top-left
  for (let xx = 0; xx < W; xx += 8) { R_(X + xx, FY + 2, 4, 4, RAMP.hazard[1]); R_(X + xx + 4, FY + 2, 4, 4, OUT); }
  R_(X, FY, W, 2, C[3]);
  R_(X, FY + FH - 6, W, 6, C[2]); R_(X, FY + FH - 2, W, 2, C[3]);
  R_(X, FY, 2, FH, C[0]); R_(X + W - 4, FY, 4, FH, C[2]); R_(X - 1, FY, 1, FH, OUT); R_(X + W, FY, 1, FH, OUT); R_(X, FY + FH - 1, W, 1, OUT);
  // painted arrows guiding the climb
  for (const [ax, ay] of [[37 * TS + 8, 46 * TS - 30]]) { R_(ax - 1, ay - 10, 3, 9, RAMP.scarf[1]); R_(ax - 4, ay - 7, 9, 2, RAMP.scarf[1]); R_(ax - 3, ay - 8, 7, 1, RAMP.scarf[1]); }
  // ledges: metal grating platforms with a hazard lip, cast shadow on the wall below, struts
  for (const L of ledges) {
    const lx = L.x * TS, ly = L.y * TS, lw = 3 * TS, lh = 2 * TS, Mt = RAMP.metal;
    R_(lx, ly + lh, lw, 6, DARK_SHADOW); R_(lx + 2, ly + lh + 6, 3, 8, OUT); R_(lx + lw - 5, ly + lh + 6, 3, 8, OUT);
    R_(lx, ly, lw, lh - 4, Mt[1]);
    for (let gx = 0; gx < lw; gx += 4) R_(lx + gx, ly, 1, lh - 4, Mt[2]);
    for (let gy = 0; gy < lh - 4; gy += 4) R_(lx, ly + gy, lw, 1, Mt[2]);
    R_(lx, ly, lw, 1, Mt[0]); R_(lx, ly, 1, lh - 4, Mt[0]);
    for (let s = 0; s < lw; s += 6) { R_(lx + s, ly + lh - 4, 3, 4, RAMP.hazard[1]); R_(lx + s + 3, ly + lh - 4, 3, 4, OUT); }
    R_(lx - 1, ly - 1, lw + 2, 1, OUT); R_(lx - 1, ly - 1, 1, lh + 1, OUT); R_(lx + lw, ly - 1, 1, lh + 1, OUT); R_(lx - 1, ly + lh, lw + 2, 1, OUT);
  }
  // east cast shadow (light from top-left)
  R_(X + W + 1, T.ry0 * TS + 4, 7, (T.fy1 - T.ry0 + 1) * TS - 4, DARK_SHADOW);
}
function drawParapet(tx, ty) { const X = tx * TS, Y = ty * TS, C = RAMP.tower; R_(X, Y, TS, TS, C[2]); R_(X, Y, TS, 9, C[0]); R_(X, Y + 1, TS, 7, C[1]); R_(X, Y + 9, TS, 1, C[3]); R_(X, Y + 15, TS, 1, OUT); if ((tx + ty) % 3 === 0) R_(X + 6, Y + 10, 2, 5, RAMP.rust[2]); }
function drawRuin(p) { // the front face of a rubble plateau: broken brick wall with jagged top
  const B = RAMP.brick, r = rng(p.x0 * 31 + p.y0), X = p.x0 * TS, FY = (p.y0 + p.h - 1) * TS, W = p.w * TS;
  R_(X, FY, W, TS, B[1]);
  for (let yy = 0; yy < TS; yy += 4) { R_(X, FY + yy + 3, W, 1, B[2]); for (let xx = ((yy / 4) % 2) * 4; xx < W; xx += 8) R_(X + xx, FY + yy, 1, 3, B[2]); }
  for (let xx = 0; xx < W; xx += 2) { const j = Math.floor(r() * 3); R_(X + xx, FY, 2, j, RAMP.dirt[1]); R_(X + xx, FY + j, 2, 1, B[0]); }
  R_(X, FY + TS - 2, W, 2, B[3]); R_(X - 1, FY, 1, TS, OUT); R_(X + W, FY, 1, TS, OUT); R_(X, FY + TS - 1, W, 1, OUT);
  // outline the top rim of the plateau so the height reads
  const TY = p.y0 * TS; R_(X - 1, TY - 1, W + 2, 1, OUT); R_(X - 1, TY, 1, FY - TY, OUT); R_(X + W, TY, 1, FY - TY, OUT);
  R_(X, TY, W, 1, RAMP.dirt[0]); R_(X, TY, 1, FY - TY, RAMP.dirt[0]);
  R_(X + W + 1, TY + 3, 5, (p.h) * TS - 3, DARK_SHADOW);
}
function carCanvas(car) {
  const r = rng(car.seed), Cr = RAMP[car.c], G = RAMP.glass, Ru = RAMP.rust;
  const w = car.w * TS - 2, h = car.h * TS - 2, [c, x] = mk(w + 2, h + 2), P = (a, b, cw, ch, col) => { x.fillStyle = col; x.fillRect(a + 1, b + 1, cw, ch); };
  if (car.horiz) { // seen from above-front: top (roof, hood, trunk) then the south side with wheels
    const top = 18;
    P(2, 2, w - 4, top, Cr[1]); P(2, 2, w - 4, 1, Cr[0]); P(2, 2, 1, top, Cr[0]);
    P(12, 4, w - 26, top - 5, Cr[0]); P(12, 4, 4, top - 5, G[1]); P(w - 18, 4, 4, top - 5, G[2]); P(17, 5, w - 36, top - 7, Cr[1]);
    P(0, top + 2, w, h - top - 6, Cr[2]); P(0, top + 2, w, 1, Cr[1]); P(14, top + 4, 8, 5, G[2]); P(w - 24, top + 4, 8, 5, G[3]);
    for (const wx of [6, w - 14]) { P(wx, h - 8, 9, 8, OUT); P(wx + 2, h - 6, 5, 4, RAMP.gog[0]); }
    P(0, top + 2, 2, 5, RAMP.lit[2]);
  } else { // pointing at the camera: hood at the bottom, front face with lights
    const face = 9;
    P(2, 0, w - 4, h - face, Cr[1]); P(2, 0, w - 4, 1, Cr[0]); P(2, 0, 1, h - face, Cr[0]); P(w - 3, 0, 1, h - face, Cr[2]);
    P(4, 8, w - 8, 18, Cr[0]); P(4, 8, w - 8, 4, G[2]); P(4, 22, w - 8, 5, G[1]); P(5, 12, w - 10, 10, Cr[1]);
    P(0, h - face, w, face, Cr[2]); P(3, h - face + 2, 5, 3, RAMP.lit[1]); P(w - 8, h - face + 2, 5, 3, G[3]); P(10, h - face + 2, w - 20, 4, RAMP.gog[1]);
    P(0, h - face - 6, 3, 8, OUT); P(w - 3, h - face - 6, 3, 8, OUT);
  }
  for (let n = 0; n < 5; n++) { const a = Math.floor(r() * (w - 6)), b = Math.floor(r() * (h - 6)); x.fillStyle = Ru[r() < 0.5 ? 1 : 2]; x.fillRect(a + 1, b + 1, 2 + Math.floor(r() * 4), 2); }
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
  { const X = 36 * TS + 2, Y = 27 * TS + 2; R_(X - 1, Y - 1, 14, 30, OUT); R_(X, Y, 12, 28, RAMP.zshirt2[1]); R_(X, Y, 12, 7, RAMP.walk[0]); R_(X, Y + 8, 12, 1, RAMP.zshirt2[2]); R_(X, Y, 1, 28, RAMP.zshirt2[0]); }
  box3(43 * TS + 1, 26 * TS + 2, 14, 6, 7, RAMP.wood);
  for (const p of props) if (p.type === 'barrel') { const X = p.tx * TS + 3, Y = p.ty * TS + 1; R_(X - 1, Y - 1, 12, 16, OUT); R_(X, Y, 10, 14, RAMP.rust[1]); R_(X, Y, 10, 3, RAMP.rust[3]); R_(X + 1, Y + 1, 8, 1, '#1a0c08'); R_(X, Y + 3, 2, 11, RAMP.rust[0]); R_(X + 8, Y + 3, 2, 11, RAMP.rust[2]); R_(X, Y + 7, 10, 1, RAMP.rust[3]); }
  M = null;
}

// ================================================================ game state
const BEST_KEY = 'lasttower.best';
let best = { days: 0, kills: 0 }; try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || best; } catch (e) {}
const WEAPONS = {
  fists:   { name: 'FISTS',   kind: 'melee', dmg: 1, reach: 15, arc: 1.5, cd: 0.36, stam: 7, icon: -1 },
  pipe:    { name: 'PIPE',    kind: 'melee', dmg: 2, reach: 20, arc: 1.8, cd: 0.48, stam: 11, icon: 5 },
  machete: { name: 'MACHETE', kind: 'melee', dmg: 3.5, reach: 22, arc: 2.0, cd: 0.42, stam: 12, icon: 6 },
  pistol:  { name: 'PISTOL',  kind: 'gun', dmg: 3, range: 200, cd: 0.32, ammo: 'ammo', pellets: 1, spread: 0, icon: 7 },
  shotgun: { name: 'SHOTGUN', kind: 'gun', dmg: 2.2, range: 120, cd: 0.85, ammo: 'shells', pellets: 6, spread: 0.55, icon: 8 },
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
  Object.assign(player, { x: 38 * TS + 8, y: 29 * TS + 8, level: TOWER.ROOF, air: false, jz: 0, vz: 0, fx: 0, fy: 1, dir: 0, kb: [0, 0] });
  zombiePool.length = 0; itemPool.length = 0; flowT = 0;
  scatterLoot(40, true);
  say('THE CITY IS DEAD. SCAVENGE.', 4);
  say('GET BACK UP THE TOWER BY NIGHT.', 4);
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
  if (player.air) { player.jumpBuf = 0.12; return; }
  if (G.stam < 4) { say('TOO TIRED TO JUMP', 1); return; }
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
  if (drop >= 3) hurtPlayer((drop - 2) * 10, null, 'A BAD FALL'); else if (drop > 0 || guard) sfx('land');
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
  if (WEAPONS[k]) { if (!G.owned.includes(k)) { G.owned.push(k); G.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); } G.weapon = k; say('FOUND ' + WEAPONS[k].name + (k === 'pistol' ? ' +6 AMMO' : k === 'shotgun' ? ' +4 SHELLS' : '')); if (k === 'pistol') G.inv.ammo += 6; if (k === 'shotgun') G.inv.shells += 4; return; }
  if (k === 'food') { G.inv.food++; say('+1 CANNED FOOD'); }
  else if (k === 'mre') { G.inv.mre++; say('+1 MRE RATION'); }
  else if (k === 'water') { G.inv.food++; G.stam = 100; say('+1 WATER (COUNTS AS FOOD)'); }
  else if (k === 'med') { G.inv.med++; say('+1 MEDKIT'); }
  else if (k === 'ammo') { const n = 5 + Math.floor(Math.random() * 5); G.inv.ammo += n; say('+' + n + ' PISTOL AMMO'); }
  else if (k === 'shells') { const n = 3 + Math.floor(Math.random() * 3); G.inv.shells += n; say('+' + n + ' SHELLS'); }
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
    if (z.atk > 0) { z.atk -= dt; if (z.atk <= 0 && !z.struck) { z.struck = true; z.cool = 1.1; if (Math.abs(player.x - z.x) < 16 && Math.abs(player.y - z.y) < 12 && player.level - z.level <= 1 && G.state !== 'dead') hurtPlayer(z.brute ? 17 : 8, z, z.brute ? 'A BRUTE' : 'THE HORDE'); } }
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
    if (G.inv[w.ammo] <= 0) { sfx('click'); say('OUT OF ' + (w.ammo === 'ammo' ? 'AMMO' : 'SHELLS') + (L('SELECT') === 'SWAP' ? ' - TAP SWAP' : ' - ' + L('SELECT') + ' TO SWAP'), 1.6); G.cdT = 0.3; return; }
    G.inv[w.ammo]--; G.cdT = w.cd; player.atkT = 0.18; G.shake = w.pellets > 1 ? 3 : 1.5; G.flash = 0.05; sfx(w.pellets > 1 ? 'shotgun' : 'pistol');
    let ax = fx, ay = fy, bestD = 1e9;
    for (const z of zombiePool) { if (!z.alive) continue; const dx = z.x - player.x, dy = (z.y - 8) - (player.y - 8), d = Math.hypot(dx, dy); if (d > w.range) continue; const dot = (dx * fx + dy * fy) / (d || 1); if (dot > 0.86 && d < bestD) { bestD = d; ax = dx / d; ay = dy / d; } }
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.atan2(ay, ax) + (w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread + (Math.random() - 0.5) * 0.08 : 0), dx = Math.cos(a), dy = Math.sin(a);
      let hitD = w.range, hitZ = null;
      for (let s = 8; s < hitD; s += 4) { const k = kind[tileAt(player.x + dx * s, player.y - 8 + dy * s)]; if (k === K.BROOF || k === K.BWALL || k === K.BARRIER) { hitD = s; break; } }
      for (const z of zombiePool) { if (!z.alive) continue; const rx = z.x - player.x, ry = (z.y - 8) - (player.y - 8), t = rx * dx + ry * dy; if (t < 0 || t > hitD) continue; if (Math.abs(rx * dy - ry * dx) < (z.brute ? 9 : 7)) { hitD = t; hitZ = z; } }
      G.tracers.push({ x0: player.x + dx * 8, y0: player.y - 10 - player.jz + dy * 8, x1: player.x + dx * hitD, y1: player.y - 10 - player.jz + dy * hitD, t: 0.07 });
      if (hitZ) hurtZombie(hitZ, w.dmg, dx, dy);
    }
    for (const z of zombiePool) if (z.alive && Math.hypot(z.x - player.x, z.y - player.y) < 20 * TS) z.state = 'chase';
    return;
  }
  if (G.stam < w.stam * 0.5) { say('TOO TIRED - REST OR WAIT', 1.2); G.cdT = 0.3; return; }
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
  shell: { move: 'D-PAD', A: 'A', B: 'B', START: 'START', SELECT: 'SELECT' },
  touch: { move: 'STICK', A: 'A', B: 'B', START: 'BAG', SELECT: 'SWAP' },
  keys: { move: 'WASD', A: 'SPACE', B: 'X', START: 'ENTER', SELECT: 'Q' },
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
      { t: 'MEDKIT x' + G.inv.med + '  (+45 HP)', dis: !G.inv.med || G.hp >= 100, go: () => { G.inv.med--; G.hp = Math.min(100, G.hp + 45); sfx('heal'); say('PATCHED UP'); closeMenu(); } },
      { t: top ? 'EAT CAN x' + G.inv.food + '  (+30 FOOD)' : 'EAT: ONLY SAFE IN THE TOWER', dis: !top || !G.inv.food, go: () => eat('food') },
      { t: top ? 'EAT MRE x' + G.inv.mre + '  (+60 FOOD)' : 'CLIMB THE TOWER TO EAT', dis: !top || !G.inv.mre, go: () => eat('mre') },
      { t: 'WEAPON: ' + WEAPONS[G.weapon].name + '  (SWAP)', go: () => { swapWeapon(); } },
    ];
  },
  camp: () => [
    { t: 'REST ' + (isNight() ? 'UNTIL DAWN' : 'A WHILE') + '  (HEAL)', go: () => { closeMenu(); G.resting = true; G.restT = 0; say('RESTING BY THE FIRE...'); } },
    { t: 'EAT CAN x' + G.inv.food + '  (+30 FOOD)', dis: !G.inv.food, go: () => eat('food') },
    { t: 'EAT MRE x' + G.inv.mre + '  (+60 FOOD)', dis: !G.inv.mre, go: () => eat('mre') },
    { t: 'MEDKIT x' + G.inv.med + '  (+45 HP)', dis: !G.inv.med || G.hp >= 100, go: () => { G.inv.med--; G.hp = Math.min(100, G.hp + 45); sfx('heal'); } },
    { t: 'LEAVE', go: () => closeMenu() },
  ],
};
function openMenu(m) { G.state = m; G.menuI = 0; sfx('menu'); }
function closeMenu() { G.state = 'play'; }
function eat(k) {
  if (k === 'food' && G.inv.food) { G.inv.food--; G.hunger = Math.min(100, G.hunger + 30); G.hp = Math.min(100, G.hp + 6); }
  else if (k === 'mre' && G.inv.mre) { G.inv.mre--; G.hunger = Math.min(100, G.hunger + 60); G.hp = Math.min(100, G.hp + 15); }
  else return; sfx('eat'); say('EATEN. HUNGER ' + Math.round(G.hunger) + '%');
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
  if (G.hunger <= 0) { G.hp -= 1.1 * dt; if (Math.random() < dt * 0.3) say('STARVING... EAT IN THE TOWER', 1.5); if (G.hp <= 0) die('STARVATION'); }
  const regen = (G.hunger < 15 ? 6 : 15) * (G.resting ? 3 : 1);
  if (G.cdT <= 0) G.stam = Math.min(100, G.stam + regen * dt);
  if (G.resting) {
    G.restT += dt; G.hp = Math.min(100, G.hp + (G.hunger > 0 ? 5 : 0) * dt);
    const ph = G.t % CYCLE;
    if (!isNight() && G.restT > 1.5 && (G.hp >= 100 || G.restT > 14)) { G.resting = false; say('RESTED. HP ' + Math.round(G.hp)); }
  } else if (onTower() && G.hunger > 50) G.hp = Math.min(100, G.hp + 0.35 * dt); // slow recovery at the nest when fed
}
let lastPhaseNight = false;
function updateClock(dt) {
  const scale = G.resting ? (isNight() ? 12 : 8) : 1;
  const before = G.t % CYCLE; G.t += dt * scale; const ph = G.t % CYCLE;
  if (before < DAY_LEN - 30 && ph >= DAY_LEN - 30) say('DUSK SOON. HEAD FOR THE TOWER.', 4);
  if (before < DAY_LEN && ph >= DAY_LEN) { say('NIGHT FALLS. THEY ARE RESTLESS.', 4); sfx('dusk'); }
  if (ph < before) { G.day++; say('DAY ' + G.day + '. YOU MADE IT.', 4); sfx('dawn'); if (G.resting) { G.resting = false; } const n = itemPool.filter((i) => i.alive).length; scatterLoot(Math.max(0, 34 - n)); }
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
const ICONS = (() => { // tiny 7x7 pixel icons: heart, food, bolt, sun, moon, skull
  const defs = {
    heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], food: ['..###..', '.#####.', '.#ooo#.', '.#ooo#.', '.#####.', '..###..'],
    bolt: ['...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'], sun: ['#..#..#', '.#####.', '.#####.', '#######', '.#####.', '#..#..#'],
    moon: ['..###..', '.##....', '##.....', '##.....', '.##....', '..###..'], skull: ['.#####.', '#######', '#.##.##', '#######', '.##.##.', '.#.#.#.'],
  };
  const cols = { heart: '#d8402e', food: '#d8a040', bolt: '#a8d850', sun: '#f0c050', moon: '#a8b8e8', skull: '#d8d0c0' }, out = {};
  for (const k in defs) { const [c, x] = mk(7, 6); defs[k].forEach((row, y) => [...row].forEach((ch, X) => { if (ch === '#') px(x, cols[k], X, y); else if (ch === 'o') px(x, '#6a4a2a', X, y); })); out[k] = c; }
  return out;
})();
function bar(x, y, w, v, col, icon) {
  hx.drawImage(ICONS[icon], x, y);
  hx.fillStyle = '#0e0a0c'; hx.fillRect(x + 9, y, w + 2, 6);
  hx.fillStyle = '#2a2024'; hx.fillRect(x + 10, y + 1, w, 4);
  const f = Math.round(w * clamp(v / 100, 0, 1)); hx.fillStyle = col; hx.fillRect(x + 10, y + 1, f, 4);
  hx.fillStyle = 'rgba(255,255,255,.25)'; hx.fillRect(x + 10, y + 1, f, 1);
}
function panel(x, y, w, h, a = 0.78) { hx.fillStyle = `rgba(14,10,12,${a})`; hx.fillRect(x, y, w, h); hx.fillStyle = '#c8642a'; hx.fillRect(x, y, w, 1); hx.fillRect(x, y + h - 1, w, 1); hx.fillStyle = '#5a3a2a'; hx.fillRect(x, y + 1, 1, h - 2); hx.fillRect(x + w - 1, y + 1, 1, h - 2); }
function drawItemIcon(i, x, y) { hx.drawImage(ITEM_IMG, i * 16, 0, 16, 16, x - 2, y - 3, 16, 16); }
function hintText() {
  const mv = L('move'), A = L('A'), B = L('B'), S = L('START'), SE = L('SELECT'), bag = S === 'BAG' ? 'BAG' : S + ' BAG', swp = SE === 'SWAP' ? 'SWAP WEAPON' : SE + ' SWAP WEAPON';
  if (G.resting) return 'RESTING - ' + A + ' / ' + B + ' TO GET UP';
  if (nearFire()) return B + ' CAMP: EAT / REST    ' + bag;
  if (G.t < 34 && G.day === 1) return mv + ' MOVE  ' + A + ' JUMP  ' + B + ' ATTACK';
  if (G.t < 48 && G.day === 1) return bag + ' / PAUSE   ' + swp;
  const nearLedge = player.level < TOWER.ROOF && Math.abs(player.x / TS - 40) < 9 && player.y / TS > 30 && player.y / TS < 50;
  if (nearLedge) return A + ' JUMP UP THE LEDGES TO THE NEST';
  const w = WEAPONS[G.weapon]; if (w.kind === 'gun' && G.inv[w.ammo] <= 0) return 'NO AMMO - ' + swp;
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
  panel(2, 2, bw + 16, 26, 0.6);
  bar(5, 5, bw, G.hp, G.hp < 30 ? '#ff4030' : '#c8302a', 'heart');
  bar(5, 13, bw, G.hunger, G.hunger < 20 ? '#ff8a20' : '#c8902a', 'food');
  bar(5, 21, bw, G.stam, '#8ab83a', 'bolt'); // 21+6 = 27
  // clock (top-right)
  const night = isNight(); const ct = clockStr();
  panel(N - 56, 2, 54, 18, 0.6);
  hx.drawImage(ICONS[night ? 'moon' : 'sun'], N - 52, 8);
  text('DAY ' + G.day, N - 5, 2, 8, '#e8d6a8', 'right'); text(ct, N - 5, 10, 8, night ? '#a8b8e8' : '#f0c050', 'right');
  // weapon + ammo (bottom-left)
  const w = WEAPONS[G.weapon];
  panel(2, N - 20, 74, 18, 0.6);
  if (w.icon >= 0) drawItemIcon(w.icon, 5, N - 17); else { hx.fillStyle = '#c89a78'; hx.fillRect(8, N - 13, 5, 4); hx.fillStyle = '#0e0a0c'; hx.fillRect(9, N - 12, 1, 1); hx.fillRect(11, N - 12, 1, 1); }
  text(w.name, 19, N - 19, 8, '#e8d6a8');
  if (w.kind === 'gun') text((w.ammo === 'ammo' ? 'AMMO ' : 'SHELLS ') + G.inv[w.ammo], 19, N - 11, 8, G.inv[w.ammo] ? '#f0c050' : '#d8402e');
  else { const sx = 19; hx.fillStyle = '#2a2024'; hx.fillRect(sx, N - 7, 40, 2); hx.fillStyle = G.cdT > 0 ? '#5a4a3a' : '#c8642a'; hx.fillRect(sx, N - 7, Math.round(40 * (1 - G.cdT / w.cd)), 2); }
  // supplies (bottom-right)
  panel(N - 58, N - 20, 56, 18, 0.6);
  drawItemIcon(0, N - 56, N - 17); text('' + (G.inv.food + G.inv.mre), N - 43, N - 15, 8);
  drawItemIcon(2, N - 30, N - 17); text('' + G.inv.med, N - 17, N - 15, 8);
  // kill count + safe marker
  hx.drawImage(ICONS.skull, 5, 31); text('' + G.kills, 14, 29, 8, '#d8d0c0');
  if (onTower()) text('SAFE', 30, 29, 8, '#8ab83a');
  else { // compass arrow to the tower when it is off-screen
    const p = w2s(40 * TS + 8, 38 * TS);
    if (p[0] < 6 || p[0] > N - 6 || p[1] < 6 || p[1] > N - 6) { const c = N / 2, a = Math.atan2(p[1] - c, p[0] - c), r = N / 2 - 34; const ax = c + Math.cos(a) * r, ay = c + Math.sin(a) * r; hx.fillStyle = night ? '#ff5a3a' : '#f0c050'; for (let k = 0; k < 4; k++) { const bx = ax - Math.cos(a) * k * 2, by = ay - Math.sin(a) * k * 2; hx.fillRect(Math.round(bx - (3 - k) / 2), Math.round(by - (3 - k) / 2), 4 - k, 4 - k); } text('TOWER', Math.round(ax), Math.round(ay + 4), 8, night ? '#ff5a3a' : '#f0c050', 'center'); }
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
  hx.fillStyle = 'rgba(8,6,10,.45)'; hx.fillRect(0, 0, N, N);
  panel(x, y, w, h, 0.92);
  text(G.state === 'camp' ? 'THE NEST' : 'BAG  -  PAUSED', N / 2, y + 3, 8, '#c8642a', 'center');
  items.forEach((it, i) => { const sel = i === G.menuI, yy = y + 15 + i * 11; if (sel) { hx.fillStyle = '#3a2420'; hx.fillRect(x + 3, yy, w - 6, 10); text('>', x + 6, yy, 8, '#f0c050'); } text(it.t, x + 14, yy, 8, it.dis ? '#6a5a50' : sel ? '#f0c050' : '#e8d6a8'); });
  const inv = 'CANS ' + G.inv.food + '  MRE ' + G.inv.mre + '  AMMO ' + G.inv.ammo + '  SHELLS ' + G.inv.shells;
  text(inv, N / 2, y + h - 10, 8, '#a89a88', 'center');
  text(L('A') + ' SELECT   ' + L('B') + ' BACK   ' + L('move') + ' CHOOSE', N / 2, y + h + 3, 8, '#e8d6a8', 'center');
}
function drawDead(t) {
  G.deadT += 1 / 60;
  hx.fillStyle = `rgba(40,4,6,${Math.min(0.6, G.deadT * 0.5)})`; hx.fillRect(0, 0, N, N);
  const y = N / 2 - 40;
  text('YOU DIED', N / 2, y, 16, '#d8402e', 'center');
  text('TAKEN BY ' + G.deathCause, N / 2, y + 22, 8, '#e8d6a8', 'center');
  text('DAY ' + G.day + '   KILLS ' + G.kills, N / 2, y + 34, 8, '#f0c050', 'center');
  text((G.newBest ? 'NEW BEST: ' : 'BEST: ') + 'DAY ' + best.days + '  /  ' + best.kills + ' KILLS', N / 2, y + 46, 8, G.newBest ? '#8ab83a' : '#a89a88', 'center');
  if (G.deadT > 1.2 && (t % 1) < 0.65) text(L('A') + ' TO TRY AGAIN', N / 2, y + 64, 8, '#e8d6a8', 'center');
}
function drawTitle(t) {
  hx.fillStyle = 'rgba(8,6,10,.35)'; hx.fillRect(0, 0, N, N);
  const y = Math.round(N * 0.16);
  text('LAST', N / 2, y, 16, '#c8642a', 'center');
  text('TOWER', N / 2, y + 17, 16, '#e8d6a8', 'center');
  text('SCAVENGE BY DAY.', N / 2, y + 38, 8, '#a89a88', 'center'); text('HOLD THE TOWER BY NIGHT.', N / 2, y + 47, 8, '#a89a88', 'center');
  const m = mode(), cy = Math.round(N * 0.56);
  panel(Math.round(N / 2 - 78), cy - 4, 156, 52, 0.7);
  const rows = [[L('move'), 'MOVE'], [L('A'), 'JUMP / CONFIRM'], [L('B'), 'ATTACK / USE / BACK'], [L('START'), 'PAUSE & ITEMS'], [L('SELECT'), 'NEXT WEAPON']];
  rows.forEach(([k, v], i) => { text(k, N / 2 - 8, cy + i * 9, 8, '#f0c050', 'right'); text(v, N / 2 - 2, cy + i * 9, 8, '#e8d6a8'); });
  if ((t % 1) < 0.65) text('PRESS ' + (m === 'keys' ? 'SPACE' : 'A') + ' TO START', N / 2, N - 32, 8, '#f0c050', 'center');
  if (best.days) text('BEST: DAY ' + best.days + '  /  ' + best.kills + ' KILLS', N / 2, N - 20, 8, '#a89a88', 'center');
}


// ================================================================ dynamic props (tall things that can stand in front of the player: they fade)
const PROP_IMG = (() => {
  const lamp = (lit) => { const [c, x] = mk(16, 48), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    P(6, 10, 3, 36, RAMP.metal[2]); P(6, 10, 1, 36, RAMP.metal[0]); P(5, 44, 5, 3, RAMP.metal[3]); P(6, 6, 7, 2, RAMP.metal[2]); P(9, 7, 6, 4, RAMP.metal[3]); P(10, 11, 4, 2, lit ? RAMP.lit[0] : RAMP.glass[3]);
    return outline(c); };
  const tree = () => { const [c, x] = mk(32, 44), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }, W = RAMP.wood;
    P(14, 18, 4, 25, W[2]); P(14, 18, 1, 25, W[1]); P(13, 40, 6, 3, W[3]);
    const br = (x0, y0, dx, dy, n) => { let a = x0, b = y0; for (let i = 0; i < n; i++) { P(Math.round(a), Math.round(b), 2, 2, i < 3 ? W[2] : W[1]); a += dx; b += dy; } };
    br(15, 20, -1, -1.2, 9); br(16, 22, 1.1, -1, 10); br(15, 14, -0.4, -1.3, 8); br(10, 12, -1, -0.6, 5); br(23, 13, 0.9, -0.8, 5); br(16, 16, 0.3, -1.4, 9); br(12, 26, -1, -0.4, 6);
    return outline(c); };
  const antenna = () => { const [c, x] = mk(12, 44), P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    P(5, 4, 2, 40, RAMP.metal[2]); P(5, 4, 1, 40, RAMP.metal[0]); for (let y = 10; y < 40; y += 8) P(2, y, 8, 1, RAMP.metal[2]); P(3, 40, 6, 3, RAMP.metal[3]);
    return outline(c); };
  const fire = (f) => { const [c, x] = mk(12, 14), r = rng(5 + f * 31);
    for (let y = 0; y < 14; y++) for (let X = 0; X < 12; X++) { const dx = (X - 5.5) / 6, dy = (13 - y) / 14, w = (1 - dy) * (1 - Math.abs(dx) * 1.5) + (r() - 0.5) * 0.3 + Math.sin(y * 0.9 + f * 2.1 + X) * 0.12; if (w > 0.15) { x.fillStyle = w > 0.6 ? RAMP.fire[0] : w > 0.4 ? RAMP.fire[1] : RAMP.fire[2]; x.fillRect(X, y, 1, 1); } }
    return c; };
  return { lamp: lamp(true), lampOff: lamp(false), tree: tree(), antenna: antenna(), fire: [0, 1, 2].map(fire) };
})();
const SHADOW = (() => { const mkS = (w, h) => { const [c, x] = mk(w, h); x.fillStyle = 'rgba(20,10,30,0.45)'; for (let y = 0; y < h; y++) { const t = (y + 0.5) / h * 2 - 1, half = Math.round(w / 2 * Math.sqrt(1 - t * t)); x.fillRect(w / 2 - half, y, half * 2, 1); } return c; }; return { s: mkS(12, 5), b: mkS(16, 6), i: mkS(10, 4) }; })();

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
    else if (p.type === 'antenna' && (t % 1.6) < 0.5) add(p.tx * TS + 6, p.ty * TS - 26, 10, '#ff3020');
  }
  for (const bd of buildings) if (bd.lit) for (const [wx, wy] of bd.lit) add(wx, wy + 10, 14, '#a07038');
  L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
  hx.globalCompositeOperation = 'multiply'; hx.drawImage(light.c, 0, 0); hx.globalCompositeOperation = 'source-over';
}
// screen-space rain: thin diagonal streaks
const drops = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
let rainAmt = 0.5;
function drawWeather(dt) {
  const night = isNight(); rainAmt += ((night ? 1 : 0.45) - rainAmt) * dt * 0.2;
  const n = Math.floor(drops.length * rainAmt);
  hx.fillStyle = night ? '#6a7aa8' : '#a8acc0';
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
    if (!sil) { const sh = player.jz > 6 ? SHADOW.i : SHADOW.s; hx.drawImage(sh, sx - sh.width / 2, sy - 3); }
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
      if (p.type === 'antenna' && (t % 1.6) < 0.5) { hx.fillStyle = '#ff4030'; hx.fillRect(wx - camX + 4, wy - camY + 1, 4, 4); hx.fillStyle = '#ffd0b0'; hx.fillRect(wx - camX + 5, wy - camY + 2, 1, 1); }
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
  if (G && G.tracers) { for (const tr of G.tracers) { const a = w2s(tr.x0, tr.y0), b = w2s(tr.x1, tr.y1); pixLine(a[0], a[1], b[0], b[1], '#ffe9a0'); tr.t -= dt; } G.tracers = G.tracers.filter((q) => q.t > 0); }
  if (G && G.hits) { for (const h of G.hits) { const p = w2s(h.x, h.y); hx.fillStyle = RAMP.blood[0]; for (let k = 0; k < 5; k++) hx.fillRect(p[0] + Math.round((Math.random() - 0.5) * 8), p[1] + Math.round((Math.random() - 0.5) * 8), 1, 1); hx.fillStyle = '#ffe9a0'; hx.fillRect(p[0], p[1], 1, 1); h.t -= dt; } G.hits = G.hits.filter((q) => q.t > 0); }
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
window.__lt = { get G() { return G; }, player, get state() { return STATE; }, newGame: () => { STATE = 'game'; newGame(); }, zombies: zombiePool, items: itemPool, ledges, NEST, TOWER, TS, get N() { return N; }, setTime: (t) => { G.t = t; },
  get muted() { return muted; }, get mode() { return mode(); }, get covered() { return lastCovered; }, get cam() { return [camX, camY]; }, spawnZombie, lvlAt: (x, y) => lvl[tileAt(x, y)], kindAt: (x, y) => kind[tileAt(x, y)], props };
