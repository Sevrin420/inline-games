/* LAST TOWER: HD-2D zombie survival. Flat pixel sprites in a small 3D ruined city (three.js r160, vendored). */
import * as THREE from './vendor/three.module.min.js';

// ================================================================ basics
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ROOT = document.documentElement;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const shellOn = () => { const H = window.Handheld && window.Handheld.current; const on = ROOT.classList.contains('hh-active') && !!H && H.visible !== false; ROOT.classList.toggle('lt-shell', on); return on; };
const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (touchDev) ROOT.classList.add('lt-touch');
const QS = new URLSearchParams(location.search);

// ================================================================ renderer: true square, integer pixel scale
const glc = $('gl'), hud = $('hud'), hx = hud.getContext('2d');
let R = null;
try { R = new THREE.WebGLRenderer({ canvas: glc, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { R = null; }
if (!R) { $('nogl').style.display = 'flex'; throw new Error('no webgl'); }
R.setPixelRatio(1);
let camera = null;
let N = 0; // game pixels per side (square)
function resize() {
  shellOn();
  const box = $('stage').getBoundingClientRect(), dpr = Math.min(4, window.devicePixelRatio || 1);
  const css = Math.max(1, Math.min(box.width, box.height));
  const dev = Math.floor(css * dpr + 0.01);
  const k = Math.max(1, Math.ceil(dev / 320));           // device px per game px: always an integer
  const n = Math.max(96, Math.floor(dev / k));
  if (n !== N) { N = n; R.setSize(N, N, false); hud.width = N; hud.height = N; hx.imageSmoothingEnabled = false; }
  // size the canvases to exactly N*k device pixels and snap them onto the device-pixel grid (no resampling blur)
  // the shell scales its device with a CSS transform, so convert visual px back to layout px
  const lay = parseFloat(getComputedStyle($('stage')).width) || box.width, sc = box.width / lay || 1;
  const sz = N * k / dpr;
  const fx = ((box.left + (box.width - sz) / 2) * dpr), fy = ((box.top + (!shellOn() && touchDev && box.height > box.width * 1.2 ? Math.min(12, (box.height - sz) / 2) : (box.height - sz) / 2)) * dpr);
  const ox = (Math.round(fx) / dpr) - box.left, oy = (Math.round(fy) / dpr) - box.top;
  for (const c of [glc, hud]) { c.style.width = (sz / sc) + 'px'; c.style.height = (sz / sc) + 'px'; c.style.left = (ox / sc) + 'px'; c.style.top = (oy / sc) + 'px'; c.style.right = 'auto'; c.style.bottom = 'auto'; }
  if (camera) { camera.aspect = 1; camera.updateProjectionMatrix(); }
}
addEventListener('resize', () => { resize(); setTimeout(resize, 120); });

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

// ================================================================ textures
function tex(c, rep) { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function speckle(x, r, w, h, n, cols) { for (let i = 0; i < n; i++) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect((r() * w) | 0, (r() * h) | 0, r() < 0.25 ? 2 : 1, 1); } }
const MAP = 44; // world spans -MAP..MAP in X and Z
function groundCanvas() {
  const S = 704, PX = S / (MAP * 2); // 8 texels per world unit
  const [c, x] = mk(S, S), r = rng(7);
  x.fillStyle = '#29282c'; x.fillRect(0, 0, S, S);
  speckle(x, r, S, S, 52000, ['#302e33', '#242327', '#36333a', '#2c2a2d', '#3a3631']);
  // sidewalks / roads: grid of blocks centred at k*14, block 10, road 4
  for (let k = -3; k <= 3; k++) for (let j = -3; j <= 3; j++) {
    const cx = (k * 14 + MAP) * PX, cz = (j * 14 + MAP) * PX, hb = 5.6 * PX;
    x.fillStyle = '#3a3836'; x.fillRect(cx - hb, cz - hb, hb * 2, hb * 2);
    x.fillStyle = '#4a4744'; x.fillRect(cx - hb, cz - hb, hb * 2, 2); x.fillRect(cx - hb, cz - hb, 2, hb * 2);
    x.fillStyle = '#2a2826'; x.fillRect(cx - hb, cz + hb - 2, hb * 2, 2);
    for (let q = 0; q < 300; q++) { x.fillStyle = r() < 0.5 ? '#34322f' : '#45413d'; x.fillRect(cx - hb + r() * hb * 2, cz - hb + r() * hb * 2, 1, 1); }
    // faded lane dashes on the road east and south of block
    x.fillStyle = '#7a6a3a';
    for (let q = 0; q < 10; q++) { if (r() < 0.35) continue; x.fillRect(cx + 7 * PX - 1, cz - hb + q * 9, 2, 4); x.fillRect(cx - hb + q * 9, cz + 7 * PX - 1, 4, 2); }
  }
  // plaza around the tower
  const pc = MAP * PX, ph = 6.2 * PX;
  x.fillStyle = '#34302e'; x.fillRect(pc - ph, pc - ph, ph * 2, ph * 2);
  for (let i = -ph; i < ph; i += 8) for (let j = -ph; j < ph; j += 8) { x.fillStyle = ((i + j) / 8) & 1 ? '#3a3532' : '#2f2b29'; x.fillRect(pc + i, pc + j, 7, 7); }
  // cracks
  x.strokeStyle = '#16151a'; x.lineWidth = 1;
  for (let i = 0; i < 160; i++) { let px = r() * S, py = r() * S; x.beginPath(); x.moveTo(px | 0, py | 0); for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 20; py += (r() - 0.5) * 20; x.lineTo(px | 0, py | 0); } x.stroke(); }
  // puddles with a sky glint, blood smears, oil
  for (let i = 0; i < 70; i++) { const px = r() * S, py = r() * S, rw = 4 + r() * 14, rh = 2 + r() * 6; x.fillStyle = '#19202c'; x.beginPath(); x.ellipse(px | 0, py | 0, rw, rh, 0, 0, 7); x.fill(); x.fillStyle = '#2c3a4e'; x.fillRect((px - rw * 0.4) | 0, (py - 1) | 0, (rw * 0.5) | 0, 1); }
  for (let i = 0; i < 40; i++) { const px = r() * S, py = r() * S; x.fillStyle = '#3e1a18'; for (let k = 0; k < 14; k++) x.fillRect(px + (r() - 0.5) * 10, py + (r() - 0.5) * 6, 2, 1); }
  for (let i = 0; i < 1600; i++) { const v = r(); x.fillStyle = v < 0.4 ? '#4a4038' : v < 0.7 ? '#5a3a24' : '#5e5854'; x.fillRect(r() * S, r() * S, 1 + (r() * 2 | 0), 1 + (r() * 2 | 0)); }
  return c;
}
const FACADES = [['#4a4648', '#3a3638'], ['#5a4a3e', '#463a30'], ['#3e4448', '#30363a'], ['#584038', '#44302a'], ['#4c4c44', '#3a3a34'], ['#3c3a44', '#2e2c36']];
function facadeCanvas(seed, floors, lit) {
  const r = rng(seed), W = 32, H = 16 * floors, [c, x] = mk(W, H);
  const base = FACADES[(r() * FACADES.length) | 0];
  x.fillStyle = base[0]; x.fillRect(0, 0, W, H);
  speckle(x, r, W, H, (W * H / 3) | 0, [base[1], '#2e2a2c', '#5e5854']);
  for (let f = 0; f < floors; f++) {
    const y = f * 16;
    x.fillStyle = base[1]; x.fillRect(0, y + 14, W, 2); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, y + 14, W, 1);
    if (f === floors - 1) continue; // bottom floor drawn below
    for (let wx = 3; wx < W - 5; wx += 10) {
      const k = r(); let col = '#14161c';
      if (k < lit) col = r() < 0.7 ? '#c8923e' : '#6a94a6'; else if (k < lit + 0.25) col = '#050506'; else if (k < lit + 0.42) col = '#5a4030';
      x.fillStyle = '#1e1a1c'; x.fillRect(wx - 1, y + 3, 8, 10);
      x.fillStyle = col; x.fillRect(wx, y + 4, 6, 8);
      if (col === '#5a4030') { x.fillStyle = '#3a2a1e'; x.fillRect(wx, y + 6, 6, 1); x.fillRect(wx, y + 9, 6, 1); x.fillStyle = '#6e5038'; x.fillRect(wx + 1, y + 4, 1, 8); }
      else if (col === '#c8923e') { x.fillStyle = '#e8c070'; x.fillRect(wx + 1, y + 5, 2, 1); x.fillStyle = '#8a5a2a'; x.fillRect(wx, y + 10, 6, 2); }
      else { x.fillStyle = '#5a6874'; x.fillRect(wx, y + 4, 1, 2); x.fillRect(wx + 4, y + 10, 2, 1); }
      x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(wx - 1, y + 13, 8, 1);
    }
  }
  for (let i = 0; i < 7; i++) { const sx = (r() * W) | 0, sy = (r() * H) | 0, len = 6 + r() * 26; for (let k = 0; k < len; k++) { x.fillStyle = k % 3 ? 'rgba(120,58,28,.5)' : 'rgba(156,82,40,.55)'; x.fillRect(sx, sy + k, 1, 1); } }
  for (let i = 0; i < 3; i++) { const sx = r() * W, sy = r() * H, g = x.createRadialGradient(sx, sy, 0, sx, sy, 9); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(sx - 9, sy - 9, 18, 18); }
  // ground floor: shutter, door, graffiti
  const gy = H - 16;
  x.fillStyle = '#34343a'; x.fillRect(3, gy + 3, 18, 13); x.fillStyle = '#26262c'; for (let k = 0; k < 13; k += 2) x.fillRect(3, gy + 3 + k, 18, 1);
  if (r() < 0.5) { x.fillStyle = '#0a0a0c'; x.fillRect(6, gy + 9, 10, 7); }
  x.fillStyle = '#2a1e18'; x.fillRect(23, gy + 5, 6, 11); x.fillStyle = '#4a3020'; x.fillRect(23, gy + 5, 6, 1);
  if (r() < 0.6) { x.fillStyle = ['#b8442a', '#c8a03a', '#4a8a7a', '#a8a8a0'][(r() * 4) | 0]; for (let k = 0; k < 9; k++) x.fillRect(4 + k * 2, gy + 6 + ((Math.sin(k * 1.7 + seed) * 3) | 0), 2, 2); }
  return c;
}
function roofCanvas(seed) {
  const r = rng(seed), [c, x] = mk(32, 32); x.fillStyle = '#2a2628'; x.fillRect(0, 0, 32, 32);
  speckle(x, r, 32, 32, 320, ['#342e2e', '#1e1a1c', '#3a3230', '#2a3030']);
  x.fillStyle = '#4a3a30'; if (r() < 0.7) { const vx = 4 + r() * 18 | 0, vy = 4 + r() * 18 | 0; x.fillRect(vx, vy, 7, 5); x.fillStyle = '#2a201a'; x.fillRect(vx + 1, vy + 1, 5, 1); }
  x.fillStyle = '#1a1416'; x.fillRect(0, 0, 32, 1); x.fillRect(0, 0, 1, 32);
  x.fillStyle = '#18242e'; if (r() < 0.5) x.fillRect(16 + r() * 8, 18 + r() * 8, 6, 3);
  return c;
}
function towerCanvas() {
  // 64 x 160: concrete tower, 10 floors, slit windows, rebar, big painted sign
  const r = rng(99), W = 64, H = 160, [c, x] = mk(W, H);
  x.fillStyle = '#4a4744'; x.fillRect(0, 0, W, H);
  speckle(x, r, W, H, 4200, ['#53504c', '#3e3b39', '#5a5652', '#45403c']);
  for (let f = 0; f < 10; f++) {
    const y = f * 16; x.fillStyle = '#34312f'; x.fillRect(0, y + 15, W, 1); x.fillStyle = '#5e5a55'; x.fillRect(0, y, W, 1);
    for (let wx = 4; wx < W - 4; wx += 12) { const k = r(); x.fillStyle = '#121216'; x.fillRect(wx, y + 5, 7, 6); if (k < 0.2) { x.fillStyle = '#a06a30'; x.fillRect(wx + 1, y + 6, 5, 4); } else if (k < 0.5) { x.fillStyle = '#3a2a1e'; x.fillRect(wx, y + 7, 7, 1); x.fillRect(wx, y + 9, 7, 1); } x.fillStyle = 'rgba(110,52,24,.6)'; x.fillRect(wx + 3, y + 11, 1, 3 + (r() * 6 | 0)); }
  }
  for (let i = 0; i < 12; i++) { const sx = r() * W | 0, sy = r() * H | 0; for (let k = 0; k < 20; k++) { x.fillStyle = 'rgba(130,64,30,.55)'; x.fillRect(sx, sy + k, 1, 1); } }
  // giant faded hazard band near top and a painted "SAFE" arrow
  for (let k = 0; k < W; k += 8) { x.fillStyle = '#8a6a22'; x.fillRect(k, 4, 4, 3); x.fillStyle = '#2a2622'; x.fillRect(k + 4, 4, 4, 3); }
  x.fillStyle = '#9a3a24'; x.fillRect(26, 18, 12, 2); x.fillRect(31, 14, 2, 10); x.fillRect(29, 16, 6, 1);
  return c;
}
function metalCanvas(seed, base, rust) {
  const r = rng(seed), [c, x] = mk(16, 16); x.fillStyle = base; x.fillRect(0, 0, 16, 16);
  speckle(x, r, 16, 16, 90, [rust, '#2a201a', '#6a5a4a']);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 15, 16, 1); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, 16, 1);
  return c;
}

// ================================================================ pixel sprites (16x24 humanoids: 5 frames x 4 facings)
// rows: 0 down (toward camera), 1 up, 2 left, 3 right. cols: walk 0..3, 4 = attack
const CW = 16, CH = 24;
function px(x, c, X, Y, w = 1, h = 1) { x.fillStyle = c; x.fillRect(X, Y, w, h); }
function drawHuman(x, ox, oy, P, face, f) {
  const ph = f === 4 ? 0 : [0, 1, 0, -1][f], atk = f === 4, Z = P.zombie;
  const bob = (f === 1 || f === 3) ? 1 : 0;
  const o = (X, Y, w, h, c) => px(x, c, ox + X, oy + Y + (Y < 16 ? bob : 0), w, h);
  const OUT = '#0e0a0c';
  if (face === 0 || face === 1) {
    // legs
    const ll = ph === 1 ? 1 : 0, rl = ph === -1 ? 1 : 0;
    o(5, 15, 3, 8 - ll, OUT); o(8, 15, 3, 8 - rl, OUT);
    o(6, 16, 1, 5 - ll, P.pants); o(9, 16, 1, 5 - rl, P.pants); o(5, 16, 1, 5 - ll, P.pants2); o(10, 16, 1, 5 - rl, P.pants2);
    o(5, 21 - ll, 2, 1, P.boots); o(9, 21 - rl, 2, 1, P.boots);
    // torso
    o(3, 8, 10, 9, OUT); o(4, 9, 8, 7, P.shirt); o(4, 14, 8, 1, P.shirt2); o(4, 15, 8, 1, P.belt || P.pants2);
    if (P.tear) { o(6, 11, 1, 2, P.skin); o(9, 13, 2, 1, '#5a1c18'); }
    if (P.accent) { if (face === 0) { o(5, 9, 6, 1, P.accent); o(7, 10, 2, 2, P.accent); } else o(4, 9, 8, 1, P.accent); }
    if (face === 1 && P.pack) { o(4, 9, 8, 6, OUT); o(5, 10, 6, 4, P.pack); o(5, 10, 6, 1, '#6a5a3a'); o(7, 12, 2, 1, '#2a2418'); }
    // arms
    if (Z && face === 0) { o(2, 9, 2, 3, OUT); o(12, 9, 2, 3, OUT); o(3, 10, 1, 1, P.shirt2); o(12, 10, 1, 1, P.shirt2); o(4, 11, 2, 2, P.skin); o(10, 11, 2, 2, P.skin); }
    else { const as = atk ? -2 : ph; o(2, 9, 2, 6, OUT); o(12, 9, 2, 6, OUT); o(2, 10, 1, 4 + (as > 0 ? 1 : 0), P.shirt2); o(13, 10, 1, 4 + (as < 0 ? 1 : 0), P.shirt2); o(2, 14 + (as > 0 ? 1 : 0), 1, 1, P.skin); o(13, 14 + (as < 0 ? 1 : 0), 1, 1, P.skin); }
    // head
    o(4, 1, 8, 8, OUT); o(5, 2, 6, 6, P.skin); o(5, 7, 6, 1, P.skin2);
    if (face === 0) {
      if (P.hood) { o(4, 1, 8, 2, P.hood); o(4, 2, 1, 5, P.hood); o(11, 2, 1, 5, P.hood); }
      else { o(5, 2, 6, 1, P.hair); o(5, 3, 1, 1, P.hair); }
      if (P.goggles) { o(5, 4, 6, 2, '#1a1a1e'); o(6, 4, 1, 1, '#c8e0e8'); o(9, 4, 1, 1, '#c8e0e8'); o(5, 6, 6, 2, P.mask || P.skin2); }
      else if (Z) { o(6, 4, 1, 1, P.eye); o(9, 4, 1, 1, P.eye); o(6, 6, 4, 1, '#2a0e0e'); o(7, 6, 1, 1, '#c8c0a0'); o(10, 3, 1, 2, '#5a1c18'); }
      else { o(6, 4, 1, 1, '#1a1214'); o(9, 4, 1, 1, '#1a1214'); }
    } else { if (P.hood) o(5, 2, 6, 5, P.hood); else o(5, 2, 6, 4, P.hair); }
  } else {
    // side view, facing right (left = mirrored afterward)
    const fwd = ph, a = atk;
    o(6, 15, 4, 8, OUT);
    o(7 + fwd, 16, 2, 5, P.pants); o(7 - fwd, 16, 2, 5, P.pants2);
    o(7 + fwd, 21, 3, 1, P.boots); o(7 - fwd, 21, 3, 1, P.boots);
    o(5, 8, 7, 9, OUT); o(6, 9, 5, 7, P.shirt); o(6, 14, 5, 1, P.shirt2); o(6, 15, 5, 1, P.belt || P.pants2);
    if (P.pack) { o(3, 9, 4, 6, OUT); o(4, 10, 2, 4, P.pack); }
    if (P.accent) o(9, 9, 2, 1, P.accent);
    if (Z || a) { o(9, 10, 6, 3, OUT); o(10, 11, 3, 1, P.shirt2); o(13, 11, 2, 1, P.skin); }
    else { o(7 - fwd, 9, 3, 6, OUT); o(8 - fwd, 10, 1, 4, P.shirt2); o(8 - fwd, 14, 1, 1, P.skin); }
    o(5, 1, 7, 8, OUT); o(6, 2, 5, 6, P.skin); o(6, 7, 5, 1, P.skin2);
    if (P.hood) { o(5, 1, 6, 2, P.hood); o(5, 2, 2, 5, P.hood); }
    else { o(6, 2, 5, 1, P.hair); o(6, 3, 2, 2, P.hair); }
    if (P.goggles) { o(9, 4, 2, 2, '#1a1a1e'); o(10, 4, 1, 1, '#c8e0e8'); o(8, 6, 3, 2, P.mask || P.skin2); }
    else if (Z) { o(9, 4, 1, 1, P.eye); o(9, 6, 2, 1, '#2a0e0e'); }
    else o(9, 4, 1, 1, '#1a1214');
  }
}
function humanAtlas(P) {
  const [c, x] = mk(CW * 5, CH * 4);
  for (let f = 0; f < 5; f++) { drawHuman(x, f * CW, 0, P, 0, f); drawHuman(x, f * CW, CH, P, 1, f); drawHuman(x, f * CW, CH * 3, P, 3, f); }
  // mirror right row into left row
  const [m, mx] = mk(CW, CH);
  for (let f = 0; f < 5; f++) { mx.clearRect(0, 0, CW, CH); mx.save(); mx.translate(CW, 0); mx.scale(-1, 1); mx.drawImage(c, f * CW, CH * 3, CW, CH, 0, 0, CW, CH); mx.restore(); x.drawImage(m, f * CW, CH * 2); }
  return c;
}
const PLAYER_P = { skin: '#c89a78', skin2: '#a87a5a', hair: '#2a1e18', hood: '#3e4a34', shirt: '#4a5638', shirt2: '#323c26', pants: '#3a3a44', pants2: '#2a2a32', boots: '#1e1a16', accent: '#c8642a', pack: '#5a4a2e', goggles: true, mask: '#3a3a3a', belt: '#5a4028' };
const ZOMBIE_PS = [
  { zombie: true, skin: '#8a9a78', skin2: '#6a7a5a', hair: '#2a2420', shirt: '#4a5a6a', shirt2: '#34404c', pants: '#3a3228', pants2: '#2a241c', boots: '#1a1612', eye: '#e8e0a0', tear: true },
  { zombie: true, skin: '#9a9a80', skin2: '#7a7a60', hair: '#4a3a2a', shirt: '#7a3a2a', shirt2: '#5a2a1e', pants: '#2e3240', pants2: '#22252f', boots: '#1a1612', eye: '#f04a3a', tear: true },
  { zombie: true, skin: '#7a8a80', skin2: '#5a6a60', hair: '#18161a', shirt: '#8a8a7a', shirt2: '#6a6a5a', pants: '#4a3e30', pants2: '#3a3024', boots: '#1a1612', eye: '#e8e0a0', tear: true },
];
const BRUTE_P = { zombie: true, skin: '#7a8468', skin2: '#5a644a', hair: '#1a1614', shirt: '#3a3a3e', shirt2: '#2a2a2e', pants: '#2a2e22', pants2: '#1e221a', boots: '#141210', eye: '#ff5a2a', tear: true, accent: '#c8a03a' };

// items: 12x12 cells
const ITEMS = ['food', 'mre', 'med', 'ammo', 'shells', 'pipe', 'machete', 'pistol', 'shotgun', 'water'];
function itemAtlas() {
  const [c, x] = mk(12 * ITEMS.length, 12), O = '#0e0a0c';
  const d = (i, fn) => { x.save(); x.translate(i * 12, 0); fn((X, Y, w, h, col) => px(x, col, X, Y, w, h)); x.restore(); };
  d(0, (p) => { p(3, 2, 6, 9, O); p(4, 3, 4, 7, '#a8a8a8'); p(4, 5, 4, 3, '#b8442a'); p(5, 6, 2, 1, '#e8d6a8'); p(4, 3, 4, 1, '#d8d8d8'); });
  d(1, (p) => { p(2, 3, 8, 7, O); p(3, 4, 6, 5, '#7a6a3a'); p(3, 4, 6, 1, '#9a8a4a'); p(5, 6, 2, 1, '#2a2418'); });
  d(2, (p) => { p(2, 3, 8, 7, O); p(3, 4, 6, 5, '#e8e0d0'); p(5, 5, 2, 3, '#c8302a'); p(4, 6, 4, 1, '#c8302a'); p(5, 2, 2, 2, O); });
  d(3, (p) => { p(2, 4, 8, 6, O); p(3, 5, 6, 4, '#4a5a3a'); p(4, 6, 1, 2, '#d8b040'); p(6, 6, 1, 2, '#d8b040'); p(3, 5, 6, 1, '#6a7a4a'); });
  d(4, (p) => { p(2, 4, 8, 6, O); p(3, 5, 6, 4, '#6a2a22'); p(4, 6, 1, 2, '#c8302a'); p(6, 6, 1, 2, '#c8302a'); p(4, 8, 1, 1, '#d8b040'); p(6, 8, 1, 1, '#d8b040'); });
  d(5, (p) => { for (let k = 0; k < 8; k++) { p(2 + k, 9 - k, 2, 2, O); } for (let k = 0; k < 7; k++) p(3 + k, 9 - k, 1, 1, '#8a8a90'); p(2, 9, 2, 2, '#5a3a2a'); });
  d(6, (p) => { for (let k = 0; k < 7; k++) { p(3 + k, 8 - k, 2, 2, O); p(4 + k, 8 - k, 1, 1, '#d0d4d8'); } p(2, 9, 3, 2, '#3a2418'); p(1, 10, 1, 1, O); });
  d(7, (p) => { p(2, 4, 8, 4, O); p(3, 5, 6, 2, '#3a3a40'); p(3, 5, 6, 1, '#6a6a70'); p(3, 7, 3, 3, O); p(4, 7, 1, 2, '#4a3020'); });
  d(8, (p) => { p(0, 4, 12, 4, O); p(1, 5, 10, 1, '#4a4a50'); p(1, 6, 7, 1, '#3a3a40'); p(7, 6, 4, 2, '#6a4024'); p(2, 7, 2, 2, O); });
  d(9, (p) => { p(4, 1, 4, 10, O); p(5, 2, 2, 8, '#6aa0c0'); p(5, 2, 2, 1, '#e8e8e8'); });
  return c;
}
function fireCanvas() {
  const [c, x] = mk(36, 16), r = rng(5);
  for (let f = 0; f < 3; f++) {
    const ox = f * 12;
    for (let y = 0; y < 16; y++) for (let X = 0; X < 12; X++) {
      const dx = (X - 5.5) / 6, dy = (15 - y) / 16, w = (1 - dy) * (1 - Math.abs(dx) * 1.4) + (r() - 0.5) * 0.35 + Math.sin(y * 0.9 + f * 2.1 + X) * 0.12;
      if (w > 0.15) px(x, w > 0.6 ? '#ffe9a0' : w > 0.38 ? '#ffa030' : '#c8401a', ox + X, y);
    }
    px(x, '#3a2418', ox + 1, 14, 10, 2); px(x, '#5a3a24', ox + 2, 14, 3, 1); px(x, '#5a3a24', ox + 7, 15, 3, 1);
  }
  return c;
}
function glowCanvas(col) { const [c, x] = mk(32, 32), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return c; }
function shadowCanvas() { const [c, x] = mk(16, 8); x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.ellipse(8, 4, 7, 3, 0, 0, 7); x.fill(); return c; }

// ================================================================ scene
const scene = new THREE.Scene();
const FOG_DAY = new THREE.Color('#5e5a54'), FOG_NIGHT = new THREE.Color('#0d1018'), FOG_DUSK = new THREE.Color('#5a3a30');
scene.fog = new THREE.Fog(FOG_DAY.clone(), 14, 44);
scene.background = scene.fog.color;
camera = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
const hemi = new THREE.HemisphereLight(0xb8b0a0, 0x2a2420, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b8, 1.2); sun.position.set(-8, 20, 10); scene.add(sun); scene.add(sun.target);
const lantern = new THREE.PointLight(0xffb060, 0, 9, 1.6); scene.add(lantern);
const fireLight = new THREE.PointLight(0xff8a30, 6, 12, 1.4); scene.add(fireLight);

const colliders = []; // {minx,maxx,minz,maxz,bot,top}
const occluders = []; // {minx,maxx,minz,maxz,top,mats:[]}
const addCol = (cx, cz, w, d, bot, top, extra) => { const c = Object.assign({ minx: cx - w / 2, maxx: cx + w / 2, minz: cz - d / 2, maxz: cz + d / 2, bot, top }, extra || {}); colliders.push(c); return c; };

function boxGeo(w, h, d, uScale = 3.2, topScale = 0) {
  const P = [], Nn = [], U = [], I = []; let v = 0;
  const hw = w / 2, hd = d / 2;
  const quad = (a, b, c, e, n, uv) => { P.push(...a, ...b, ...c, ...e); for (let i = 0; i < 4; i++) Nn.push(...n); U.push(...uv); I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
  const us = (len) => (uScale ? len / uScale : 1);
  quad([-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], [0, 0, 1], [0, 0, us(w), 0, us(w), 1, 0, 1]);
  quad([hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], [0, 0, -1], [0, 0, us(w), 0, us(w), 1, 0, 1]);
  quad([hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd], [1, 0, 0], [0, 0, us(d), 0, us(d), 1, 0, 1]);
  quad([-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], [-1, 0, 0], [0, 0, us(d), 0, us(d), 1, 0, 1]);
  const sideCount = I.length;
  const tu = topScale ? w / topScale : 1, tv = topScale ? d / topScale : 1;
  quad([-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd], [0, 1, 0], [0, 0, tu, 0, tu, tv, 0, tv]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I); g.addGroup(0, sideCount, 0); g.addGroup(sideCount, I.length - sideCount, 1);
  return g;
}
function lam(map, extra) { return new THREE.MeshLambertMaterial(Object.assign({ map }, extra || {})); }
function addBox(cx, y, cz, w, h, d, side, top, opts = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, opts.uScale ?? 3.2, opts.topScale ?? 0), [side, top]);
  m.position.set(cx, y, cz); scene.add(m);
  if (opts.col !== false) addCol(cx, cz, w, d, y, y + h, opts.colExtra);
  return m;
}

// ground
const groundTex = tex(groundCanvas());
const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, MAP * 2), lam(groundTex));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
// dark rim outside the map so the fog edge reads as endless ruins
const rim = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x1c1a1c }));
rim.rotation.x = -Math.PI / 2; rim.position.y = -0.02; scene.add(rim);

// shared small textures
const T = {
  roofs: [0, 1, 2, 3].map((i) => tex(roofCanvas(40 + i), true)),
  rust: tex(metalCanvas(3, '#5a3a28', '#7a4a2a'), true),
  car1: tex(metalCanvas(4, '#4a5258', '#6a4a30'), true),
  car2: tex(metalCanvas(5, '#6a3a2e', '#8a5a34'), true),
  car3: tex(metalCanvas(6, '#5a5a4a', '#7a5a30'), true),
  glass: tex(metalCanvas(8, '#1a2028', '#2a3a4a'), true),
  concrete: tex(metalCanvas(9, '#4a4744', '#3a3634'), true),
  crate: tex((() => { const [c, x] = mk(16, 16); x.fillStyle = '#6a4a2a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#4a3018'; for (let k = 0; k < 16; k += 4) x.fillRect(0, k, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16); x.fillStyle = '#8a6a3a'; x.fillRect(2, 2, 12, 1); return c; })(), true),
  ledge: tex((() => { const [c, x] = mk(16, 16); x.fillStyle = '#5a5248'; x.fillRect(0, 0, 16, 16); speckle(x, rng(11), 16, 16, 60, ['#6a5a3a', '#3a3028', '#7a4a2a']); for (let k = 0; k < 16; k += 4) { x.fillStyle = '#c89a2a'; x.fillRect(k, 0, 2, 2); x.fillStyle = '#1e1a16'; x.fillRect(k + 2, 0, 2, 2); } return c; })(), true),
  tower: tex(towerCanvas()),
  fire: (() => { const t = tex(fireCanvas()); t.repeat.set(1 / 3, 1); return t; })(),
  glowW: tex(glowCanvas('rgba(255,190,110,1)')),
  glowR: tex(glowCanvas('rgba(255,60,40,1)')),
  glowB: tex(glowCanvas('rgba(140,190,255,1)')),
  shadow: tex(shadowCanvas()),
  items: tex(itemAtlas()),
};
T.glowW.minFilter = T.glowW.magFilter = THREE.LinearFilter; // soft glow only on additive light sprites
T.glowR.minFilter = T.glowR.magFilter = THREE.LinearFilter; T.glowB.minFilter = T.glowB.magFilter = THREE.LinearFilter;
const ATLAS = { player: tex(humanAtlas(PLAYER_P)), zombies: ZOMBIE_PS.map((p) => tex(humanAtlas(p))), brute: tex(humanAtlas(BRUTE_P)) };

const glows = []; // flicker sprites {mesh, base, phase, kind}
function glow(x, y, z, size, t, op = 0.55, kind = 'steady', ground = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.position.set(x, y, z); if (ground) m.rotation.x = -Math.PI / 2; else m.rotation.x = -0.6;
  scene.add(m); glows.push({ mesh: m, base: op, phase: Math.random() * 100, kind }); return m;
}
const fires = []; // animated flame sprites
function flame(x, y, z, s = 1) {
  const t = T.fire.clone(); t.repeat.set(1 / 3, 1); t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * s, 1.0 * s), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, fog: false }));
  m.geometry.translate(0, 0.5 * s, 0); m.position.set(x, y, z); m.rotation.x = -0.35; scene.add(m);
  fires.push({ mesh: m, tex: t, ph: Math.random() * 3 }); return m;
}

// ---------------------------------------------------------------- city blocks
const WR = rng(2026);
const spawnSpots = []; // open ground points for loot/zombies
function building(cx, cz, w, d, floors, seed) {
  const h = floors * 1.6;
  const ft = tex(facadeCanvas(seed, floors, 0.12 + WR() * 0.12), true);
  const side = lam(ft), top = lam(T.roofs[seed % 4]);
  T.roofs[seed % 4].repeat.set(1, 1);
  const m = new THREE.Mesh(boxGeo(w, h, d, 3.2, 3.2), [side, top]); m.position.set(cx, 0, cz); scene.add(m);
  addCol(cx, cz, w, d, 0, h);
  occluders.push({ minx: cx - w / 2, maxx: cx + w / 2, minz: cz - d / 2, maxz: cz + d / 2, top: h, mats: [side, top], fade: 1 });
  // rooftop junk: water tank or antenna
  if (WR() < 0.35) { const tk = addBox(cx + (WR() - 0.5) * (w - 2), h, cz + (WR() - 0.5) * (d - 2), 1.2, 1.1, 1.2, lam(T.rust), lam(T.rust), { uScale: 1.2, col: false }); occluders[occluders.length - 1].mats.push(...tk.material); }
}
function ruin(cx, cz, w, d, seed) {
  // a collapsed one-storey shell: low enough to jump onto (zombies can't)
  const h = 1.2;
  const ft = tex(facadeCanvas(seed, 1, 0), true);
  addBox(cx, 0, cz, w, h, d, lam(ft), lam(T.concrete), { uScale: 3.2, topScale: 2 });
  for (let i = 0; i < 4; i++) addBox(cx + (WR() - 0.5) * w * 0.7, h, cz + (WR() - 0.5) * d * 0.7, 0.6 + WR() * 0.8, 0.3 + WR() * 0.4, 0.6 + WR() * 0.8, lam(T.concrete), lam(T.concrete), { uScale: 1, col: false });
}
function car(cx, cz, alongX, texi) {
  const t = [T.car1, T.car2, T.car3][texi % 3];
  const w = alongX ? 3.4 : 1.7, d = alongX ? 1.7 : 3.4;
  addBox(cx, 0, cz, w, 0.85, d, lam(t), lam(t), { uScale: 1.2, topScale: 1.2 });
  const cw = alongX ? 1.7 : 1.4, cd = alongX ? 1.4 : 1.7;
  addBox(cx + (alongX ? -0.2 : 0), 0.85, cz + (alongX ? 0 : 0.2), cw, 0.5, cd, lam(T.glass), lam(t), { uScale: 1.4, topScale: 1.2 });
}
function lamp(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 5), new THREE.MeshLambertMaterial({ color: 0x2a2624 }));
  pole.position.set(x, 1.8, z); scene.add(pole);
  const head = new THREE.Mesh(boxGeo(0.7, 0.14, 0.24, 0), [new THREE.MeshLambertMaterial({ color: 0x1e1a18 }), new THREE.MeshLambertMaterial({ color: 0x1e1a18 })]); head.position.set(x + 0.3, 3.6, z); scene.add(head);
  addCol(x, z, 0.25, 0.25, 0, 3.6);
  const lit = WR() < 0.75;
  if (lit) { glow(x + 0.5, 3.45, z, 1.6, T.glowW, 0.5, WR() < 0.5 ? 'flicker' : 'steady'); glow(x + 0.5, 0.04, z, 4.2, T.glowW, 0.16, 'pool', true); }
}
function barrelFire(x, z) {
  addBox(x, 0, z, 0.7, 0.9, 0.7, lam(T.rust), lam(T.rust), { uScale: 0.7 });
  flame(x, 0.9, z, 0.9); glow(x, 1.4, z, 2.2, T.glowW, 0.45, 'fire'); glow(x, 0.05, z, 5, T.glowW, 0.2, 'firepool', true);
}
for (let k = -3; k <= 3; k++) for (let j = -3; j <= 3; j++) {
  const cx = k * 14, cz = j * 14; if (k === 0 && j === 0) continue;
  const seed = (k + 5) * 17 + (j + 5) * 131, t = WR();
  if (t < 0.14) { // empty lot: rubble + crates
    for (let i = 0; i < 5; i++) addBox(cx + (WR() - 0.5) * 7, 0, cz + (WR() - 0.5) * 7, 0.9 + WR(), 0.4 + WR() * 0.6, 0.9 + WR(), lam(T.concrete), lam(T.concrete), { uScale: 1 });
    for (let i = 0; i < 5; i++) spawnSpots.push([cx + (WR() - 0.5) * 8, cz + (WR() - 0.5) * 8]);
    if (WR() < 0.6) barrelFire(cx + (WR() - 0.5) * 4, cz + (WR() - 0.5) * 4);
  } else if (t < 0.3) {
    ruin(cx, cz, 6 + WR() * 2.5, 6 + WR() * 2.5, seed);
  } else if (t < 0.6) {
    building(cx, cz, 7 + WR() * 2.2, 7 + WR() * 2.2, 2 + ((WR() * 5) | 0), seed);
  } else { // split block
    const alongX = WR() < 0.5, g = 0.8, a = 4.4 - g / 2;
    for (const s of [-1, 1]) {
      const f = 2 + ((WR() * 5) | 0), w = alongX ? a : 8.6, d = alongX ? 8.6 : a;
      const ox = alongX ? s * (a / 2 + g / 2) : 0, oz = alongX ? 0 : s * (a / 2 + g / 2);
      if (WR() < 0.2) ruin(cx + ox, cz + oz, w, d, seed + s); else building(cx + ox, cz + oz, w, d, f, seed + s + 3);
    }
    spawnSpots.push([cx, cz]);
  }
}
// roads: cars, lamps, barrels, spawn spots
for (let k = -3; k <= 3; k++) for (let j = -3; j <= 3; j++) {
  const cx = k * 14 + 7, cz = j * 14 + 7;
  if (k < 3 && j < 3) { spawnSpots.push([cx, cz]); }
  spawnSpots.push([k * 14, cz], [cx, j * 14]);
  if (Math.abs(cx) < MAP - 2 && WR() < 0.33 && !(Math.abs(cx) < 8 && Math.abs(j * 14) < 8)) car(cx + (WR() - 0.5) * 0.8, j * 14 + (WR() - 0.5) * 6, false, (WR() * 3) | 0);
  if (Math.abs(cz) < MAP - 2 && WR() < 0.33 && !(Math.abs(k * 14) < 8 && Math.abs(cz) < 8)) car(k * 14 + (WR() - 0.5) * 6, cz + (WR() - 0.5) * 0.8, true, (WR() * 3) | 0);
  if (WR() < 0.42 && Math.abs(cx) < MAP && Math.abs(cz) < MAP) lamp(k * 14 + 5.4, j * 14 + 5.4);
  if (WR() < 0.08) barrelFire(cx + 1.2, cz - 1.2);
}
// map boundary: barricade of junk (collision walls) at the edge, hidden by fog/smog
for (const [x, z, w, d] of [[0, -MAP, MAP * 2, 1], [0, MAP, MAP * 2, 1], [-MAP, 0, 1, MAP * 2], [MAP, 0, 1, MAP * 2]]) addBox(x, 0, z, w, 2.4, d, lam(T.rust), lam(T.rust), { uScale: 2 });

// ---------------------------------------------------------------- the tower (centre), its spiral ledges and the rooftop nest
const TOWER_H = 10, TH = 3; // half width
const towerSide = lam(T.tower), towerTop = lam(T.concrete);
T.concrete.repeat.set(1, 1);
const towerMesh = new THREE.Mesh(boxGeo(TH * 2, TOWER_H, TH * 2, 0, 1.5), [towerSide, towerTop]); scene.add(towerMesh);
addCol(0, 0, TH * 2, TH * 2, 0, TOWER_H);
occluders.push({ minx: -TH, maxx: TH, minz: -TH, maxz: TH, top: TOWER_H, mats: [towerSide], fade: 1, tower: true });
const ledges = [];
{
  const RR = 3.9, PER = RR * 8;
  const at = (s) => { s = ((s % PER) + PER) % PER; const sd = Math.floor(s / (RR * 2)), o = s - sd * RR * 2 - RR;
    return sd === 0 ? [o, RR] : sd === 1 ? [RR, -o] : sd === 2 ? [-o, -RR] : [-RR, o]; };
  for (let i = 0; i < 11; i++) {
    const [x, z] = at(1.0 + i * 2.75), top = 0.85 * (i + 1);
    const m = addBox(x, top - 0.3, z, 1.8, 0.3, 1.8, lam(T.ledge), lam(T.ledge), { uScale: 1.8, topScale: 1.8 });
    // rusty strut back to the wall
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 4), new THREE.MeshLambertMaterial({ color: 0x4a3020 }));
    strut.position.set(x * 0.88, top - 0.75, z * 0.88); strut.rotation.z = x !== 0 ? Math.sign(x) * 0.7 : 0; strut.rotation.x = Math.abs(z) > 3.5 ? -Math.sign(z) * 0.7 : 0; scene.add(strut);
    ledges.push({ x, z, top, mesh: m });
  }
}
// parapet with a gap where the last ledge arrives (west side, z 0..2.4)
const parMat = lam(T.concrete);
for (const [x, z, w, d] of [[0, -TH + 0.15, TH * 2, 0.3], [0, TH - 0.15, TH * 2, 0.3], [TH - 0.15, 0, 0.3, TH * 2], [-TH + 0.15, -1.6, 0.3, 2.8]]) addBox(x, TOWER_H, z, w, 0.35, d, parMat, parMat, { uScale: 1 });
// nest: campfire, bedroll, stash, tarp lean-to, antenna with blinking beacon
const NEST = { x: 0.6, z: 0.4, y: TOWER_H };
flame(NEST.x, TOWER_H, NEST.z, 0.85);
fireLight.position.set(NEST.x, TOWER_H + 1.1, NEST.z + 0.3);
glow(NEST.x, TOWER_H + 0.6, NEST.z, 2.4, T.glowW, 0.55, 'fire'); glow(NEST.x, TOWER_H + 0.04, NEST.z, 5, T.glowW, 0.22, 'firepool', true);
for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; addBox(NEST.x + Math.cos(a) * 0.45, TOWER_H, NEST.z + Math.sin(a) * 0.45, 0.22, 0.14, 0.22, lam(T.concrete), lam(T.concrete), { uScale: 1, col: false }); }
addBox(-1.5, TOWER_H, -1.7, 1.6, 0.12, 0.8, new THREE.MeshLambertMaterial({ color: 0x4a3a5a }), new THREE.MeshLambertMaterial({ color: 0x5a4a6a }), { col: false });
const stash = addBox(1.8, TOWER_H, -1.6, 1.0, 0.7, 0.7, lam(T.crate), lam(T.crate), { uScale: 1, topScale: 1 });
{ const tarp = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshLambertMaterial({ color: 0x34402e, side: THREE.DoubleSide })); tarp.position.set(-1.4, TOWER_H + 0.6, -2.1); tarp.rotation.x = -0.7; scene.add(tarp); }
{ const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 5, 4), new THREE.MeshLambertMaterial({ color: 0x2a2624 })); ant.position.set(-2.4, TOWER_H + 2.5, -2.4); scene.add(ant); }
const beacon = glow(-2.4, TOWER_H + 5.1, -2.4, 1.4, T.glowR, 0.9, 'beacon');

// ================================================================ sprites in the world
const SPR_GEO = new THREE.PlaneGeometry(1, 1.5); SPR_GEO.translate(0, 0.75, 0);
const SHADOW_GEO = new THREE.PlaneGeometry(0.9, 0.45);
const TILT = -0.32; // flat cutouts lean slightly toward the camera
function makeSprite(atlasTex, scale = 1) {
  const t = atlasTex.clone(); t.repeat.set(1 / 5, 1 / 4); t.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0x000000 });
  const m = new THREE.Mesh(SPR_GEO, mat); m.scale.setScalar(scale); m.rotation.x = TILT; scene.add(m);
  const sh = new THREE.Mesh(SHADOW_GEO, new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(scale); scene.add(sh);
  return { mesh: m, tex: t, mat, shadow: sh };
}
function setFrame(s, col, row) { s.tex.offset.set(col / 5, 1 - (row + 1) / 4); }
function faceRow(dx, dz) { return Math.abs(dx) > Math.abs(dz) * 0.9 ? (dx < 0 ? 2 : 3) : (dz > 0 ? 0 : 1); }

// ================================================================ physics helpers
const STEP_P = 0.32, STEP_Z = 0.45, GRAV = 24, JUMP_V = 8.6;
function overl(c, x, z, r) { return x + r > c.minx && x - r < c.maxx && z + r > c.minz && z - r < c.maxz; }
function blocked(x, y, z, r, step, h) { for (const c of colliders) if (overl(c, x, z, r) && y < c.top - step && y + h > c.bot) return true; return false; }
function floorAt(x, z, y, r, step) { let f = 0; for (const c of colliders) if (overl(c, x, z, r) && c.top <= y + step + 0.001 && c.top > f) f = c.top; return f; }
function moveBody(b, dx, dz, step, h) {
  if (dx && !blocked(b.x + dx, b.y, b.z, b.r, step, h)) b.x += dx; else if (dx) b.hitWall = true;
  if (dz && !blocked(b.x, b.y, b.z + dz, b.r, step, h)) b.z += dz; else if (dz) b.hitWall = true;
}

// ================================================================ game state
const BEST_KEY = 'lasttower.best';
let best = { days: 0, kills: 0 }; try { best = JSON.parse(localStorage.getItem(BEST_KEY)) || best; } catch (e) {}
const WEAPONS = {
  fists:   { name: 'FISTS',   kind: 'melee', dmg: 1, reach: 1.0, arc: 1.4, cd: 0.38, stam: 7, icon: -1 },
  pipe:    { name: 'PIPE',    kind: 'melee', dmg: 2, reach: 1.35, arc: 1.7, cd: 0.5, stam: 11, icon: 5 },
  machete: { name: 'MACHETE', kind: 'melee', dmg: 3.5, reach: 1.4, arc: 1.9, cd: 0.45, stam: 12, icon: 6 },
  pistol:  { name: 'PISTOL',  kind: 'gun', dmg: 3, range: 13, cd: 0.32, ammo: 'ammo', pellets: 1, spread: 0.0, icon: 7 },
  shotgun: { name: 'SHOTGUN', kind: 'gun', dmg: 2.2, range: 7.5, cd: 0.85, ammo: 'shells', pellets: 6, spread: 0.5, icon: 8 },
};
const ORDER = ['fists', 'pipe', 'machete', 'pistol', 'shotgun'];
const DAY_LEN = 180, NIGHT_LEN = 120, CYCLE = DAY_LEN + NIGHT_LEN;
let G = null;
const player = { x: 0, y: TOWER_H, z: 0, vy: 0, r: 0.3, fx: 0, fz: 1, grounded: true, anim: 0, atkT: 0, hurtT: 0, sprite: null, lastFloor: TOWER_H, peakY: TOWER_H };
player.sprite = makeSprite(ATLAS.player, 1.15);
function newGame() {
  G = {
    state: 'play', t: 20, day: 1, kills: 0, msg: [], hp: 100, hunger: 85, stam: 100,
    inv: { food: 2, mre: 0, med: 1, ammo: 0, shells: 0 }, owned: ['fists', 'pipe'], weapon: 'pipe',
    resting: false, menu: null, menuI: 0, shake: 0, flash: 0, safe: true, deathCause: '', zombies: [], items: [], tracers: [], hits: [], cdT: 0,
  };
  Object.assign(player, { x: NEST.x - 1.4, y: TOWER_H, z: NEST.z + 1.2, vy: 0, fx: 0, fz: 1, grounded: true, lastFloor: TOWER_H, peakY: TOWER_H });
  for (const z of zombiePool) { z.alive = false; z.s.mesh.visible = z.s.shadow.visible = false; }
  for (const it of itemPool) { it.alive = false; it.mesh.visible = false; }
  scatterLoot(34);
  say('THE CITY IS DEAD. SCAVENGE.', 4);
  say('GET BACK UP THE TOWER BY NIGHT.', 4);
}
function say(s, t = 2.5) { if (!G) return; G.msg.push({ s, t }); if (G.msg.length > 3) G.msg.shift(); }
const isNight = () => G && (G.t % CYCLE) >= DAY_LEN;
function onTower() { return player.y >= TOWER_H - 0.05 && Math.abs(player.x) < TH + 0.1 && Math.abs(player.z) < TH + 0.1; }

// ================================================================ loot
const itemPool = [];
function itemSprite() {
  const t = T.items.clone(); t.repeat.set(1 / ITEMS.length, 1); t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, fog: true }));
  m.rotation.x = -0.5; scene.add(m); return { mesh: m, tex: t, alive: false };
}
function freeSpot(r = 0.5) {
  for (let tries = 0; tries < 40; tries++) {
    let x, z;
    if (Math.random() < 0.65) { const s = spawnSpots[(Math.random() * spawnSpots.length) | 0]; x = s[0] + (Math.random() - 0.5) * 3; z = s[1] + (Math.random() - 0.5) * 3; }
    else { x = (Math.random() - 0.5) * (MAP * 2 - 6); z = (Math.random() - 0.5) * (MAP * 2 - 6); }
    if (Math.abs(x) > MAP - 2 || Math.abs(z) > MAP - 2) continue;
    if (!blocked(x, 0, z, r, 0.05, 1.6)) return [x, z];
  }
  return null;
}
function lootRoll() {
  const r = Math.random();
  if (r < 0.32) return 'food'; if (r < 0.42) return 'mre'; if (r < 0.48) return 'water'; if (r < 0.58) return 'med';
  if (r < 0.74) return 'ammo'; if (r < 0.84) return 'shells';
  const w = ['pipe', 'machete', 'pistol', 'shotgun'][(Math.random() * 4) | 0]; return G.owned.includes(w) ? (w === 'shotgun' ? 'shells' : 'ammo') : w;
}
function dropItem(kind, x, z, y = 0) {
  let it = itemPool.find((i) => !i.alive); if (!it) { it = itemSprite(); itemPool.push(it); }
  it.alive = true; it.kind = kind; it.x = x; it.z = z; it.y = y; it.ph = Math.random() * 6; it.mesh.visible = true;
  it.tex.offset.set(ITEMS.indexOf(kind) / ITEMS.length, 0);
}
function scatterLoot(n) {
  for (let i = 0; i < n; i++) { const p = freeSpot(); if (!p) continue; if (Math.hypot(p[0], p[1]) < 7) continue; dropItem(lootRoll(), p[0], p[1], floorAt(p[0], p[1], 0, 0.2, 0.1)); }
  // guaranteed early weapon finds near-ish the tower
  if (G && G.day === 1 && G.t < 25) { const ring = [['pistol', 16], ['ammo', 12], ['machete', 22], ['shotgun', 30], ['shells', 26]]; for (const [k, d] of ring) { for (let a = 0; a < 20; a++) { const ang = Math.random() * Math.PI * 2, x = Math.cos(ang) * d, z = Math.sin(ang) * d; if (!blocked(x, 0, z, 0.5, 0.05, 1.6)) { dropItem(k, x, z, 0); break; } } } }
}
function pickup(it) {
  const k = it.kind; it.alive = false; it.mesh.visible = false; sfx('pick');
  if (WEAPONS[k]) { if (!G.owned.includes(k)) { G.owned.push(k); G.owned.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); } G.weapon = k; say('FOUND ' + WEAPONS[k].name + (k === 'pistol' ? ' +6 AMMO' : k === 'shotgun' ? ' +4 SHELLS' : '')); if (k === 'pistol') G.inv.ammo += 6; if (k === 'shotgun') G.inv.shells += 4; return; }
  if (k === 'food') { G.inv.food++; say('+1 CANNED FOOD'); }
  else if (k === 'mre') { G.inv.mre++; say('+1 MRE RATION'); }
  else if (k === 'water') { G.inv.food++; G.stam = 100; say('+1 WATER (COUNTS AS FOOD)'); }
  else if (k === 'med') { G.inv.med++; say('+1 MEDKIT'); }
  else if (k === 'ammo') { const n = 5 + ((Math.random() * 5) | 0); G.inv.ammo += n; say('+' + n + ' PISTOL AMMO'); }
  else if (k === 'shells') { const n = 3 + ((Math.random() * 3) | 0); G.inv.shells += n; say('+' + n + ' SHELLS'); }
}

// ================================================================ zombies
const zombiePool = [];
function spawnZombie(brute) {
  const night = isNight();
  for (let tries = 0; tries < 30; tries++) {
    const ang = Math.random() * Math.PI * 2, d = 17 + Math.random() * 20;
    const x = player.x + Math.cos(ang) * d, z = player.z + Math.sin(ang) * d;
    if (Math.abs(x) > MAP - 2 || Math.abs(z) > MAP - 2 || blocked(x, 0, z, 0.35, 0.05, 1.6) || Math.hypot(x, z) < 6) continue;
    let zb = zombiePool.find((q) => !q.alive && !(q.dead > 0) && q.brute === brute);
    if (!zb) { zb = { brute, s: makeSprite(brute ? ATLAS.brute : ATLAS.zombies[zombiePool.length % 3], brute ? 1.5 : 1.15) }; zombiePool.push(zb); }
    Object.assign(zb, { alive: true, x, z, y: 0, r: brute ? 0.42 : 0.3, hp: brute ? 12 : 4, max: brute ? 12 : 4, speed: (brute ? 1.5 : 1.35 + Math.random() * 0.5) * (night ? 1.35 : 1), anim: Math.random() * 4, atk: 0, hurt: 0, state: 'wander', wx: x, wz: z, wt: 0, groan: 2 + Math.random() * 8, fx: 0, fz: 1, kb: [0, 0], dead: 0 });
    zb.s.mesh.visible = zb.s.shadow.visible = true; zb.s.mat.color.setRGB(1, 1, 1);
    return zb;
  }
  return null;
}
function hurtZombie(z, dmg, kx, kz) {
  z.hp -= dmg; z.hurt = 0.18; z.kb = [kx * (z.brute ? 3 : 7), kz * (z.brute ? 3 : 7)]; z.state = 'chase';
  G.hits.push({ x: z.x, y: z.y + 1.0, z: z.z, t: 0.25 });
  if (z.hp <= 0) {
    z.alive = false; z.dead = 0.6; G.kills++; sfx('splat');
    if (Math.random() < (z.brute ? 0.9 : 0.28)) dropItem(lootRoll(), z.x, z.z, z.y);
  } else sfx('thud');
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
function nearFire() { return onTower() && Math.hypot(player.x - NEST.x, player.z - NEST.z) < 1.9; }

// ================================================================ combat
function attack() {
  const w = WEAPONS[G.weapon];
  if (G.cdT > 0) return;
  if (w.kind === 'gun') {
    if (G.inv[w.ammo] <= 0) { sfx('click'); say('OUT OF ' + (w.ammo === 'ammo' ? 'AMMO' : 'SHELLS') + (L('SELECT') === 'SWAP' ? ' - TAP SWAP' : ' - ' + L('SELECT') + ' TO SWAP'), 1.6); G.cdT = 0.3; return; }
    G.inv[w.ammo]--; G.cdT = w.cd; player.atkT = 0.18; G.shake = w.pellets > 1 ? 0.25 : 0.12; G.flash = 0.06; sfx(w.pellets > 1 ? 'shotgun' : 'pistol');
    // aim assist: nearest zombie within a cone of the facing direction
    let ax = player.fx, az = player.fz, bestD = 1e9;
    for (const z of zombiePool) { if (!z.alive) continue; const dx = z.x - player.x, dz = z.z - player.z, d = Math.hypot(dx, dz); if (d > w.range || Math.abs(z.y - player.y) > 3) continue; const dot = (dx * player.fx + dz * player.fz) / (d || 1); if (dot > 0.86 && d < bestD) { bestD = d; ax = dx / d; az = dz / d; } }
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.atan2(az, ax) + (w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread + (Math.random() - 0.5) * 0.08 : 0);
      const dx = Math.cos(a), dz = Math.sin(a); let hitZ = null, hitD = w.range;
      // walls stop bullets
      for (let s = 0.4; s < hitD; s += 0.3) if (blocked(player.x + dx * s, player.y + 0.9, player.z + dz * s, 0.02, 0, 0.1)) { hitD = s; break; }
      for (const z of zombiePool) { if (!z.alive) continue; const rx = z.x - player.x, rz = z.z - player.z, t = rx * dx + rz * dz; if (t < 0 || t > hitD) continue; const off = Math.abs(rx * dz - rz * dx); if (off < z.r + 0.18 && Math.abs(z.y - player.y) < 2.5) { hitD = t; hitZ = z; } }
      G.tracers.push({ x0: player.x + dx * 0.4, z0: player.z + dz * 0.4, y: player.y + 0.85, x1: player.x + dx * hitD, z1: player.z + dz * hitD, t: 0.07 });
      if (hitZ) hurtZombie(hitZ, w.dmg, dx, dz);
    }
    // gunshots draw the dead
    for (const z of zombiePool) if (z.alive && Math.hypot(z.x - player.x, z.z - player.z) < 20) z.state = 'chase';
    return;
  }
  if (G.stam < w.stam * 0.5) { say('TOO TIRED - REST OR WAIT', 1.2); G.cdT = 0.3; return; }
  G.stam = Math.max(0, G.stam - w.stam); G.cdT = w.cd; player.atkT = 0.2; sfx('swing');
  G.swing = { t: 0.14, a: Math.atan2(player.fz, player.fx), reach: w.reach };
  for (const z of zombiePool) {
    if (!z.alive) continue; const dx = z.x - player.x, dz = z.z - player.z, d = Math.hypot(dx, dz);
    if (d > w.reach + z.r || Math.abs(z.y - player.y) > 1.2) continue;
    let da = Math.atan2(dz, dx) - Math.atan2(player.fz, player.fx); while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < w.arc / 2 || d < 0.45) hurtZombie(z, w.dmg, dx / (d || 1), dz / (d || 1));
  }
}
function hurtPlayer(dmg, from, cause) {
  if (G.state !== 'play' && G.state !== 'bag' && G.state !== 'camp') return;
  G.hp -= dmg; player.hurtT = 0.3; G.shake = 0.3; sfx('hurt'); G.resting = false;
  if (from) { const dx = player.x - from.x, dz = player.z - from.z, d = Math.hypot(dx, dz) || 1; player.kb = [dx / d * 5, dz / d * 5]; }
  if (G.hp <= 0) die(cause);
}
function die(cause) {
  G.hp = 0; G.state = 'dead'; G.deadT = 0; G.deathCause = cause; sfx('die');
  const days = G.day - 1 + ((G.t % CYCLE) / CYCLE);
  if (G.day > best.days || (G.day === best.days && G.kills > best.kills)) { best = { days: G.day, kills: G.kills }; try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) {} G.newBest = true; }
}

// ================================================================ update
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
function jump() {
  if (!player.grounded) { player.jumpBuf = 0.12; return; }
  if (G.stam < 4) { say('TOO TIRED TO JUMP', 1); return; }
  player.vy = JUMP_V; player.grounded = false; G.stam = Math.max(0, G.stam - 4); sfx('jump');
}
function updatePlayer(dt) {
  let mx = held.right - held.left, mz = held.down - held.up;
  if (stick.on && Math.hypot(stick.x, stick.y) > 0.18) { mx = stick.x; mz = stick.y; }
  let m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; m = 1; }
  const playing = G.state === 'play' && !G.resting;
  if (!playing) { mx = mz = 0; m = 0; }
  const spd = (G.hunger <= 0 ? 3.2 : 4.3) * (player.grounded ? 1 : 0.92);
  player.hitWall = false;
  if (m > 0.1) { player.fx = mx / m; player.fz = mz / m; player.anim += dt * 9 * m; }
  const kb = player.kb || [0, 0];
  moveBody(player, (mx * spd + kb[0]) * dt, (mz * spd + kb[1]) * dt, STEP_P, 1.55);
  kb[0] *= Math.pow(0.002, dt); kb[1] *= Math.pow(0.002, dt); player.kb = kb;
  // vertical
  player.vy -= GRAV * dt; let ny = player.y + player.vy * dt;
  const fl = floorAt(player.x, player.z, Math.max(player.y, ny), player.r * 0.8, player.vy <= 0 ? STEP_P : 0.0);
  if (player.vy <= 0 && ny <= fl) {
    if (!player.grounded) { const fall = player.peakY - fl; if (fall > 4.2) { hurtPlayer(Math.round((fall - 4.2) * 10), null, 'A BAD FALL'); } else if (fall > 0.6) sfx('land'); }
    ny = fl; player.vy = 0; player.grounded = true; player.peakY = fl;
    if (player.jumpBuf > 0) { player.jumpBuf = 0; jump(); }
  } else { player.grounded = false; if (ny > player.peakY || player.vy > 0) player.peakY = Math.max(player.peakY, ny); }
  if (player.grounded && fl < player.y - 0.01 && ny > fl) player.grounded = false;
  player.y = ny; player.jumpBuf = Math.max(0, (player.jumpBuf || 0) - dt);
  if (player.grounded) player.peakY = player.y;
  player.x = clamp(player.x, -MAP + 1.2, MAP - 1.2); player.z = clamp(player.z, -MAP + 1.2, MAP - 1.2);
  player.atkT = Math.max(0, player.atkT - dt); player.hurtT = Math.max(0, player.hurtT - dt);
  G.cdT = Math.max(0, G.cdT - dt);
  // loot pickup
  for (const it of itemPool) if (it.alive && Math.hypot(it.x - player.x, it.z - player.z) < 0.7 && Math.abs(it.y - player.y) < 1.2) pickup(it);
}
function updateZombies(dt) {
  const night = isNight(), sense = night ? 14 : 9, pSafeH = player.y > 1.05;
  let alive = 0, brutes = 0;
  for (const z of zombiePool) {
    if (!z.alive) { if (z.dead > 0) { z.dead -= dt; z.s.mesh.rotation.z = (1 - z.dead / 0.6) * 1.4 * (z.fx < 0 ? 1 : -1); z.s.mat.color.setRGB(0.6, 0.3, 0.3); if (z.dead <= 0) { z.s.mesh.visible = z.s.shadow.visible = false; z.s.mesh.rotation.z = 0; } } continue; }
    alive++; if (z.brute) brutes++;
    const dx = player.x - z.x, dz = player.z - z.z, d = Math.hypot(dx, dz);
    if (d > 48) { z.alive = false; z.s.mesh.visible = z.s.shadow.visible = false; continue; }
    if (d < sense && G.state !== 'dead') z.state = 'chase'; else if (z.state === 'chase' && d > sense * 1.8) z.state = 'wander';
    let tx, tz, sp;
    if (z.state === 'chase') { tx = player.x; tz = player.z; sp = z.speed; }
    else { z.wt -= dt; if (z.wt <= 0 || Math.hypot(z.wx - z.x, z.wz - z.z) < 0.5) { z.wt = 3 + Math.random() * 5; const a = Math.random() * 6.28; z.wx = z.x + Math.cos(a) * 5; z.wz = z.z + Math.sin(a) * 5; if (night) { z.wx = lerp(z.wx, 0, 0.3); z.wz = lerp(z.wz, 0, 0.3); } } tx = z.wx; tz = z.wz; sp = z.speed * 0.4; }
    let vx = tx - z.x, vz = tz - z.z; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    if (z.slide > 0) { z.slide -= dt; const s = z.slideDir; const nx = -vz * s, nz = vx * s; vx = vx * 0.3 + nx; vz = vz * 0.3 + nz; }
    const close = d < z.r + player.r + 0.25 && Math.abs(player.y - z.y) < 1.0;
    if (close || z.atk > 0) sp = 0;
    if (z.hurt > 0) { z.hurt -= dt; sp *= 0.2; }
    z.hitWall = false;
    moveBody(z, (vx * sp + z.kb[0]) * dt, (vz * sp + z.kb[1]) * dt, STEP_Z, 1.5);
    z.kb[0] *= Math.pow(0.001, dt); z.kb[1] *= Math.pow(0.001, dt);
    if (z.hitWall && !(z.slide > 0)) { z.slide = 0.5 + Math.random() * 0.7; z.slideDir = Math.random() < 0.5 ? -1 : 1; }
    const fl = floorAt(z.x, z.z, z.y, z.r * 0.7, STEP_Z); z.y = fl < z.y ? Math.max(fl, z.y - 9 * dt) : fl;
    if (sp > 0.05) { z.anim += dt * 6 * (sp / 1.4); z.fx = vx; z.fz = vz; }
    // attack: wind-up then strike if still in reach
    if (z.atk > 0) { z.atk -= dt; if (z.atk <= 0 && !z.struck) { z.struck = true; z.cool = 1.1; if (d < z.r + player.r + 0.6 && Math.abs(player.y - z.y) < 1.0 && G.state !== 'dead') hurtPlayer(z.brute ? 17 : 8, z, z.brute ? 'A BRUTE' : 'THE HORDE'); } }
    else { z.cool = (z.cool || 0) - dt; if (close && z.cool <= 0 && G.state !== 'dead') { z.atk = 0.4; z.struck = false; z.fx = dx; z.fz = dz; } }
    z.groan -= dt; if (z.groan <= 0) { z.groan = 4 + Math.random() * 9; if (d < 12) sfx('groan'); }
  }
  // separation
  for (let i = 0; i < zombiePool.length; i++) { const a = zombiePool[i]; if (!a.alive) continue; for (let j = i + 1; j < zombiePool.length; j++) { const b = zombiePool[j]; if (!b.alive) continue; const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rr = a.r + b.r; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = (rr - d) / 2; const ux = dx / d * p, uz = dz / d * p; if (!blocked(a.x - ux, a.y, a.z - uz, a.r, STEP_Z, 1.5)) { a.x -= ux; a.z -= uz; } if (!blocked(b.x + ux, b.y, b.z + uz, b.r, STEP_Z, 1.5)) { b.x += ux; b.z += uz; } } } }
  // population
  const target = night ? Math.min(70, 40 + G.day * 4) : Math.min(30, 14 + G.day * 2);
  G.spawnT = (G.spawnT || 0) - dt;
  if (alive < target && G.spawnT <= 0) { G.spawnT = night ? 0.25 : 0.6; const wantBrute = G.day >= 2 && brutes < (night ? 2 + G.day : G.day - 1) && Math.random() < 0.18; spawnZombie(wantBrute); }
  _alive = alive;
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

// ================================================================ render helpers
const camPos = new THREE.Vector3(0, 30, 30), camLook = new THREE.Vector3();
const CAM_OFF = new THREE.Vector3(0, 14, 16);
const tmpV = new THREE.Vector3();
function project(x, y, z) { tmpV.set(x, y, z).project(camera); return [(tmpV.x * 0.5 + 0.5) * N, (-tmpV.y * 0.5 + 0.5) * N, tmpV.z]; }
function placeSprite(s, x, y, z, row, col, scale = 1) {
  s.mesh.position.set(x, y, z); setFrame(s, col, row);
  s.shadow.position.set(x, floorAt(x, z, y + 0.05, 0.05, 0.1) + 0.03, z + 0.05);
  const hgt = y - s.shadow.position.y; s.shadow.material.opacity = clamp(1 - hgt / 4, 0.2, 1);
}
function updateLighting(t) {
  const dl = daylight(), dusk = G ? clamp(1 - Math.abs(dl - 0.5) * 2, 0, 1) * (dl < 1 && dl > 0 ? 1 : 0) : 0;
  const fc = scene.fog.color; fc.copy(FOG_NIGHT).lerp(FOG_DAY, dl); fc.lerp(FOG_DUSK, dusk * 0.5);
  scene.fog.near = lerp(9, 20, dl); scene.fog.far = lerp(32, 58, dl);
  hemi.intensity = lerp(0.55, 0.95, dl); hemi.color.setRGB(lerp(0.45, 0.78, dl), lerp(0.52, 0.74, dl), lerp(0.75, 0.66, dl));
  sun.intensity = lerp(0.5, 1.2, dl); sun.color.setRGB(lerp(0.55, 1, dl) + dusk * 0.2, lerp(0.62, 0.88, dl), lerp(0.95, 0.74, dl));
  sun.position.set(player.x - 8, 20, player.z + 10); sun.target.position.set(player.x, 0, player.z);
  lantern.intensity = (1 - dl) * 16 * (G && G.state !== 'dead' ? 1 : 0); lantern.position.set(player.x, player.y + 1.6, player.z + 0.6);
  fireLight.intensity = (22 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2.5) * (1.2 - dl * 0.5);
  if (G && G.lightning > 0) { hemi.intensity += G.lightning * 2.5; G.lightning = Math.max(0, G.lightning - 0.05); }
  for (const g of glows) {
    let o = g.base;
    if (g.kind === 'flicker') o *= (Math.sin(t * 31 + g.phase) > -0.75 && ((t * 3 + g.phase) % 7) > 0.45) ? 1 : 0.1;
    else if (g.kind === 'fire' || g.kind === 'firepool') o *= 0.85 + Math.sin(t * 11 + g.phase) * 0.1 + Math.sin(t * 23 + g.phase) * 0.06;
    else if (g.kind === 'beacon') o *= ((t % 1.6) < 0.5) ? 1 : 0.08;
    g.mesh.material.opacity = o * (g.kind === 'beacon' ? 1 : lerp(1.3, 0.55, dl));
  }
  for (const f of fires) f.tex.offset.x = (Math.floor(t * 9 + f.ph * 3) % 3) / 3;
}
function updateOcclusion(dt) {
  const px = player.x, pz = player.z, py = player.y + 0.9, slope = CAM_OFF.y / CAM_OFF.z;
  for (const o of occluders) {
    let want = 1;
    if (px > o.minx - 0.5 && px < o.maxx + 0.5 && o.maxz > pz) {
      const inside = px > o.minx && px < o.maxx && pz > o.minz && pz < o.maxz && player.y >= o.top - 0.1;
      const zz = Math.max(o.minz, pz); if (!inside && py + (zz - pz) * slope < o.top) want = 0.22;
    }
    o.fade += (want - o.fade) * Math.min(1, dt * 8);
    const tr = o.fade < 0.98;
    for (const m of o.mats) { if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } m.opacity = o.fade; }
  }
}
// screen-space rain / ash (crisp pixels on the HUD layer)
const drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
const ash = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6 }));
let rainAmt = 0.6;
function drawWeather(dt, t) {
  const night = G ? isNight() : false; rainAmt += ((night ? 1 : 0.55) - rainAmt) * dt * 0.2;
  const n = Math.floor(drops.length * rainAmt);
  hx.fillStyle = night ? 'rgba(120,140,180,0.45)' : 'rgba(180,186,196,0.38)';
  for (let i = 0; i < n; i++) { const d = drops[i]; d.y += dt * 1.6 * d.s; d.x -= dt * 0.25 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random() * 1.2; } if (d.x < 0) d.x += 1.2; const X = Math.floor(d.x * N), Y = Math.floor(d.y * N), L2 = d.s > 1 ? 4 : 3; for (let k = 0; k < L2; k++) hx.fillRect(X - (k >> 1), Y + k, 1, 1); }
  hx.fillStyle = 'rgba(200,190,170,0.5)';
  for (const a of ash) { a.y += dt * 0.05; a.p += dt; if (a.y > 1) a.y -= 1; hx.fillRect(Math.floor(((a.x + Math.sin(a.p) * 0.02) % 1) * N), Math.floor(a.y * N), 1, 1); }
  // splashes
  hx.fillStyle = 'rgba(190,200,215,0.5)';
  for (let i = 0; i < 6 * rainAmt; i++) { const X = Math.floor(Math.random() * N), Y = Math.floor(N * 0.3 + Math.random() * N * 0.7); hx.fillRect(X - 1, Y, 1, 1); hx.fillRect(X + 1, Y, 1, 1); }
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
function drawItemIcon(i, x, y) { hx.drawImage(T.items.image, i * 12, 0, 12, 12, x, y, 12, 12); }
function hintText() {
  const mv = L('move'), A = L('A'), B = L('B'), S = L('START'), SE = L('SELECT'), bag = S === 'BAG' ? 'BAG' : S + ' BAG', swp = SE === 'SWAP' ? 'SWAP WEAPON' : SE + ' SWAP WEAPON';
  if (G.resting) return 'RESTING - ' + A + ' / ' + B + ' TO GET UP';
  if (nearFire()) return B + ' CAMP: EAT / REST    ' + bag;
  if (G.t < 34 && G.day === 1) return mv + ' MOVE  ' + A + ' JUMP  ' + B + ' ATTACK';
  if (G.t < 48 && G.day === 1) return bag + ' / PAUSE   ' + swp;
  const nearLedge = player.y < TOWER_H - 0.1 && Math.hypot(player.x, player.z) < 7.2;
  if (nearLedge) return A + ' JUMP UP THE LEDGES TO THE NEST';
  const w = WEAPONS[G.weapon]; if (w.kind === 'gun' && G.inv[w.ammo] <= 0) return 'NO AMMO - ' + swp;
  return '';
}
function drawHUD(dt, t) {
  hx.clearRect(0, 0, N, N);
  if (STATE === 'title') { drawWeather(dt, t); drawTitle(t); return; }
  drawWeather(dt, t);
  // tracers & hit sparks (projected world points, crisp lines)
  for (const tr of G.tracers) { const a = project(tr.x0, tr.y, tr.z0), b = project(tr.x1, tr.y, tr.z1); pixLine(a[0], a[1], b[0], b[1], '#ffe9a0'); tr.t -= dt; }
  G.tracers = G.tracers.filter((q) => q.t > 0);
  for (const h of G.hits) { const p = project(h.x, h.y, h.z); hx.fillStyle = '#c8302a'; for (let k = 0; k < 5; k++) hx.fillRect(Math.round(p[0] + (Math.random() - 0.5) * 8), Math.round(p[1] + (Math.random() - 0.5) * 8), 1, 1); hx.fillStyle = '#ffe9a0'; hx.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); h.t -= dt; }
  G.hits = G.hits.filter((q) => q.t > 0);
  if (G.swing && G.swing.t > 0) { G.swing.t -= dt; const c = project(player.x, player.y + 0.7, player.z); for (let k = -3; k <= 3; k++) { const a = G.swing.a + k * 0.25, r = G.swing.reach; const p = project(player.x + Math.cos(a) * r, player.y + 0.7, player.z + Math.sin(a) * r); hx.fillStyle = 'rgba(240,230,200,.8)'; hx.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1); } }
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
    const p = project(0, 3, 0);
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

// ================================================================ main loop
let STATE = 'title', last = performance.now(), T0 = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!N) resize();
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T0 += dt;
  handleButtons();
  if (STATE === 'title') {
    const a = T0 * 0.12; camPos.set(Math.sin(a) * 22, 15, Math.cos(a) * 22); camLook.set(0, 5, 0);
    camera.position.copy(camPos); camera.lookAt(camLook);
    player.sprite.mesh.visible = true; placeSprite(player.sprite, NEST.x - 1.2, TOWER_H, NEST.z + 0.8, 0, 0);
    // title: a few wandering dead below the tower for mood
    if (!G) { G = { t: 40, day: 1, owned: ['fists'], zombies: [], state: 'title', msg: [] }; for (let i = 0; i < 14; i++) { const z = spawnZombie(false); if (z) { const ang = Math.random() * 6.28, d = 8 + Math.random() * 10; z.x = Math.cos(ang) * d; z.z = Math.sin(ang) * d; if (blocked(z.x, 0, z.z, 0.3, 0.05, 1.5)) { z.x = 0; z.z = 8 + i; } } } }
    for (const z of zombiePool) if (z.alive) { z.wt -= dt; if (z.wt <= 0) { z.wt = 3 + Math.random() * 4; z.wx = z.x + (Math.random() - 0.5) * 4; z.wz = z.z + (Math.random() - 0.5) * 4; } const vx = z.wx - z.x, vz = z.wz - z.z, l = Math.hypot(vx, vz); if (l > 0.2) { z.hitWall = false; moveBody(z, vx / l * 0.5 * dt, vz / l * 0.5 * dt, STEP_Z, 1.5); z.anim += dt * 3; z.fx = vx; z.fz = vz; } placeSprite(z.s, z.x, z.y, z.z, faceRow(z.fx, z.fz), Math.floor(z.anim) % 4); }
    updateLighting(T0); drawItems(T0);
    R.render(scene, camera); drawHUD(dt, T0); return;
  }
  const playing = G.state === 'play' || G.state === 'dead';
  const pdt = G.state === 'play' ? dt : (G.state === 'dead' ? dt : 0);
  if (pdt > 0) {
    const scale = G.state === 'play' ? updateClock(pdt) : 1;
    if (G.state === 'play') { updatePlayer(pdt); updateSurvival(pdt, pdt * scale); }
    updateZombies(pdt);
    if (isNight() && Math.random() < pdt * 0.03) { G.lightning = 1; G.flash = 0.08; setTimeout(() => sfx('thunder'), 300 + Math.random() * 900); }
  }
  // sprites
  const pRow = faceRow(player.fx, player.fz), moving = (held.up || held.down || held.left || held.right || stick.on) && G.state === 'play' && !G.resting;
  player.sprite.mesh.visible = G.state !== 'dead' || G.deadT < 0.4;
  placeSprite(player.sprite, player.x, player.y, player.z, pRow, player.atkT > 0 ? 4 : moving ? Math.floor(player.anim) % 4 : 0);
  player.sprite.mat.emissive.setRGB(player.hurtT > 0 ? 0.6 : 0, 0, 0);
  for (const z of zombiePool) if (z.alive || z.dead > 0) { placeSprite(z.s, z.x, z.y, z.z, faceRow(z.fx, z.fz), z.atk > 0 ? 4 : Math.floor(z.anim) % 4); z.s.mat.emissive.setRGB(z.hurt > 0 ? 0.8 : 0, z.hurt > 0 ? 0.7 : 0, z.hurt > 0 ? 0.6 : 0); if (z.alive) z.s.mat.color.setRGB(1, 1, 1); }
  drawItems(T0);
  // camera
  camLook.set(player.x, player.y * 0.85 + 0.8, player.z);
  const want = tmpV.copy(camLook).add(CAM_OFF);
  camPos.lerp(want, Math.min(1, dt * 6)); if (camPos.y > 25) camPos.copy(want);
  camera.position.copy(camPos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.6; camera.position.y += (Math.random() - 0.5) * G.shake * 0.6; G.shake = Math.max(0, G.shake - dt * 1.5); }
  camera.lookAt(camPos.x - CAM_OFF.x, camPos.y - CAM_OFF.y, camPos.z - CAM_OFF.z);
  updateOcclusion(dt); updateLighting(T0);
  if (rainGain) rainGain.gain.value = 0.03 + rainAmt * 0.04;
  R.render(scene, camera);
  drawHUD(dt, T0);
}
function drawItems(t) { for (const it of itemPool) if (it.alive) { it.mesh.position.set(it.x, it.y + 0.35 + Math.sin(t * 3 + it.ph) * 0.06, it.z); } }
resize();
requestAnimationFrame(frame);
// test hooks
window.__lt = { get G() { return G; }, player, get state() { return STATE; }, newGame: () => { STATE = 'game'; newGame(); }, zombies: zombiePool, ledges, NEST, get N() { return N; }, setTime: (t) => { G.t = t; }, get muted() { return muted; }, get mode() { return mode(); } };
