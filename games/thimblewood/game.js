/* THIMBLEWOOD (HD-2D edition): a little autumn forest to explore.
 *
 * Pixel-art characters and props inside a small 3D diorama, in the spirit of
 * "HD-2D" games: every sprite is authored in code as a tiny pixel grid (shaded
 * with ordered dithering and a darker selective outline), shown as an upright
 * billboard with nearest-neighbour filtering, standing on a real 3D heightfield
 * with cliffs, a stream, real shadow-mapped shadows and point lights. The frame
 * is rendered at a reduced internal resolution for chunky pixels, then run
 * through a post pass: tilt-shift depth-of-field, bloom, warm/violet colour
 * grade and vignette. UI (pixel font, pixel boxes) is drawn crisp on a 2D
 * canvas on top. No imported art: only three.js (MIT) and the Pixelify Sans
 * font (OFL) are vendored, see vendor/.
 *
 * World units: one game unit = one three.js unit. x = east, z = south (the
 * old top-down "y"), y = up. Sprites use a fixed texel size (U units/texel).
 *
 * Controls: arrows/WASD walk; Space/Enter/Z/E talk, read, advance; X/Escape
 * closes; M mutes. Touch: drag on the left side (stick), tap A or the right side.
 * Quality: adapts automatically (?q=high|med|low forces a tier).
 */
import * as THREE from './vendor/three.module.min.js';

const QS = new URLSearchParams(location.search);
const SHOT = QS.has('shot');            // card-image capture: staged scene, no UI
const ROOT = document.documentElement;
if (QS.has('notouch') || SHOT) ROOT.classList.add('no-touch-ui');
THREE.ColorManagement.enabled = false;  // colours are authored as-is (stylised, not physical)

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const mmss = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RGB = new Map();
function rgb(c) { if (Array.isArray(c)) return c; let v = RGB.get(c); if (!v) { const n = parseInt(c.replace('#', ''), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; RGB.set(c, v); } return v; }
const mix = (a, b, t) => { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
const dark = (c, k) => mix(c, [24, 12, 28], k);
const lite = (c, k) => mix(c, [255, 244, 214], k);
const css = c => { c = rgb(c); return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; };
const FONT = '"Pixelify Sans", "Lucida Console", monospace';
const INK = '#24161c', CREAM = '#fff4dc', CARD = '#f2dfb4';

// ---------------------------------------------------------------- pixel-art toolkit
// A Pix is a tiny RGBA grid. Shapes are rasterised without anti-aliasing; ell()
// shades a pseudo-sphere with a palette (dark -> light) lit from the top-left,
// using a 4x4 Bayer matrix to dither between palette steps. done() adds a
// "selout" outline (each edge pixel takes a darkened tint of its neighbour).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
const LX = -.55, LY = -.62, LZ = .56;
class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.a = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return; const i = (y * this.w + x) * 4, v = rgb(c); this.a[i] = v[0]; this.a[i + 1] = v[1]; this.a[i + 2] = v[2]; this.a[i + 3] = a; }
  on(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.a[(y * this.w + x) * 4 + 3] > 0; }
  col(x, y) { const i = (y * this.w + x) * 4; return [this.a[i], this.a[i + 1], this.a[i + 2]]; }
  clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  shadeOf(pal, l, x, y, dith = 1) { const n = pal.length; const t = clamp(l * (n - 1) + BAYER[(y & 3) * 4 + (x & 3)] * dith, 0, n - 1); return pal[Math.round(t)]; }
  // shaded ellipse; pal = colour or palette array (dark -> light); o.only(x,y) can mask
  ell(cx, cy, rx, ry, pal, o = {}) {
    const flat = !Array.isArray(pal), lift = o.lift || 0;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
      if (o.only && !o.only(x, y)) continue;
      if (flat) { this.set(x, y, pal); continue; }
      const nz = Math.sqrt(Math.max(0, 1 - d)), l = clamp((LX * nx + LY * ny + LZ * nz) * .85 + .38 + lift, 0, 1);
      this.set(x, y, this.shadeOf(pal, l, x, y, o.dith == null ? 1 : o.dith));
    }
    return this;
  }
  // vertical cylinder-ish shading for a box (trunks, posts)
  col_(x, y, w, h, pal) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = (i + .5) / w; this.set(x + i, y + j, this.shadeOf(pal, clamp(1 - Math.abs(u - .32) * 1.7, 0, 1), x + i, y + j)); } return this; }
  line(x0, y0, x1, y1, c) { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return this; }
  // filled polygon, shaded by height (top lighter) when pal is an array
  poly(pts, pal, o = {}) {
    const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = []; const yc = y + .5;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
        if (!Array.isArray(pal)) { this.set(x, y, pal); continue; }
        const u = (x - xs[k]) / Math.max(1, xs[k + 1] - xs[k]), v = (y - y0) / Math.max(1, y1 - y0);
        this.set(x, y, this.shadeOf(pal, clamp((o.vert ? 1 - v : 1 - u * .9) * .9 + .1 - (o.vert ? 0 : v * .15), 0, 1), x, y));
      }
    }
    return this;
  }
  // leaf shape: a little pointed oval along angle a
  leaf(x, y, len, wid, a, pal) { const ca = Math.cos(a), sa = Math.sin(a);
    for (let t = 0; t <= len; t += .5) { const w = Math.sin(t / len * Math.PI) * wid; for (let s = -w; s <= w; s += .5) this.set(x + ca * t - sa * s, y + sa * t + ca * s, Array.isArray(pal) ? pal[s < 0 ? 0 : Math.min(pal.length - 1, 1 + (t > len * .5 ? 1 : 0))] : pal); } return this; }
  done(o = {}) {
    if (o.outline !== false) {
      const add = [], ink = rgb(o.ink || INK), k = o.k == null ? .62 : o.k;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.on(x, y)) continue; let n = null;
        if (this.on(x, y + 1)) n = [x, y + 1]; else if (this.on(x, y - 1)) n = [x, y - 1]; else if (this.on(x + 1, y)) n = [x + 1, y]; else if (this.on(x - 1, y)) n = [x - 1, y];
        if (n) add.push([x, y, mix(this.col(n[0], n[1]), ink, k)]);
      }
      for (const [x, y, c] of add) this.set(x, y, c);
    }
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.a, this.w, this.h), 0, 0);
    c.ax = o.ax == null ? this.w / 2 : o.ax; c.ay = o.ay == null ? this.h - 1 : o.ay;   // foot anchor (texels)
    return c;
  }
}
const pal = (base, n = 5, lo = .55, hi = .38) => { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); out.push(t < .6 ? dark(base, lo * (1 - t / .6)) : lite(base, hi * (t - .6) / .4)); } return out; };

// ---------------------------------------------------------------- palettes (autumn)
const TREE = {
  autumn: ['#b4472b', '#d96a32', '#f0a03e'], gold: ['#a5772a', '#cf9d34', '#efc95c'], plum: ['#5a2a4e', '#8a4a6e', '#b0607a'],
  crimson: ['#7e2626', '#a8352e', '#d0533a'], amber: ['#b0601e', '#de8a2a', '#f6b746'], rust: ['#74361c', '#9e4c26', '#c56e36'],
};
const treePal = k => { const c = TREE[k] || TREE.autumn; return [dark(c[0], .55), dark(c[0], .25), c[0], c[1], c[2], lite(c[2], .35)]; };
// sky: background gradient; fog: haze colour; sun: key light; hemi: sky/ground fill; grade: [shadow tint, light tint]
const AP = {
  meadow: { sky: ['#f6c27a', '#b86a5a'], fog: '#c98a6a', sun: '#ffd49a', hemi: ['#ffe0b0', '#6a4a6a'], ground: '#9a7c34', ground2: '#a8662c', path: '#d0a46c', trees: ['autumn', 'amber', 'crimson', 'gold', 'rust'], fireflies: 16, rays: 1, grade: [[.72, .62, 1], [1, .8, .55]], mist: '#ffe2c4' },
  river: { sky: ['#f0c88a', '#9a6a6a'], fog: '#b98a74', sun: '#ffdca6', hemi: ['#ffe6c0', '#5a4a6a'], ground: '#8e7c38', ground2: '#a4662c', path: '#c8a070', trees: ['amber', 'autumn', 'gold', 'rust'], fireflies: 14, rays: .9, grade: [[.7, .66, 1], [1, .84, .6]], mist: '#f2e2d6' },
  grove: { sky: ['#d898a0', '#4e3a6a'], fog: '#7a5a84', sun: '#ffc0c8', hemi: ['#e0b8e0', '#3a2a5a'], ground: '#6a5a36', ground2: '#7a4636', path: '#b8987a', trees: ['crimson', 'plum', 'rust', 'crimson'], fireflies: 30, rays: .75, grade: [[.62, .55, 1], [1, .8, .9]], mist: '#d8c4ff' },
  hollow: { sky: ['#eea86a', '#8a4a40'], fog: '#b06a4a', sun: '#ffc888', hemi: ['#ffd0a0', '#5a3a5a'], ground: '#926c30', ground2: '#a4582a', path: '#cca06a', trees: ['autumn', 'rust', 'gold', 'crimson'], fireflies: 20, rays: 1, grade: [[.7, .58, .95], [1, .78, .5]], mist: '#ffd8bc' },
  glade: { sky: ['#ffe0a0', '#c88a5a'], fog: '#e0b080', sun: '#fff0c0', hemi: ['#fff0c8', '#7a5a6a'], ground: '#a48a3c', ground2: '#b4722e', path: '#dab47e', trees: ['gold', 'amber', 'autumn'], fireflies: 28, rays: 1, grade: [[.76, .66, .98], [1, .86, .6]], mist: '#fff0d6' },
};
const AUT = ['#c4542f', '#e08a2a', '#f5b445', '#b23a32', '#a5502a', '#d8583e', '#e9c24a'];

// ---------------------------------------------------------------- characters (all original designs)
const SKIN = ['#8a4a3a', '#c4785a', '#eaa47c', '#ffc89c', '#ffe0c0'], CAPP = ['#5a2010', '#9a3a16', '#d0642a', '#f08a3a', '#ffb860'];
const TUNIC = ['#163a40', '#1f5a5a', '#2c7c74', '#44a08a', '#72c4a4'], SCARF = ['#7a1a1a', '#b8302a', '#e0503a'];
const BOOT = '#4a2a1c', HAIR = ['#3a1e14', '#5a3220', '#7a4a2c'];
// hero: 20x28 texels; dir: 'down' | 'up' | 'side' (side faces right; flipped for left); f: walk frame 0..3; blink
function paintHero(dir, f, blink) {
  const p = new Pix(20, 28), bob = f === 1 || f === 3 ? 1 : 0, Y = bob;
  // legs + boots
  if (dir === 'side') {
    const sw = [0, 2, 0, -2][f];
    for (const [lx, back] of [[9 - sw, 1], [10 + sw, 0]]) { p.rect(lx, 22 + Y, 2, 3, back ? '#2a3448' : '#3a4a64'); p.rect(lx - (back ? 0 : 0), 25, 3, 2, back ? dark(BOOT, .3) : BOOT); }
  } else {
    const up = [[0, 0], [1, 0], [0, 0], [0, 1]][f];
    p.rect(7, 22 + Y - up[0], 2, 3, '#3a4a64'); p.rect(6, 25 - up[0], 3, 2, BOOT);
    p.rect(11, 22 + Y - up[1], 2, 3, '#3a4a64'); p.rect(11, 25 - up[1], 3, 2, BOOT);
  }
  // body / tunic
  if (dir === 'side') p.ell(10, 19.5 + Y, 4.6, 4.4, TUNIC); else p.ell(10, 19.5 + Y, 5.6, 4.4, TUNIC);
  p.rect(dir === 'side' ? 6 : 5, 22 + Y, dir === 'side' ? 9 : 11, 1, '#5a3420'); if (dir === 'down') p.set(10, 22 + Y, '#f0c040');
  if (dir === 'up') { p.ell(10, 19 + Y, 3.4, 3, ['#4a2a18', '#6e4426', '#94603a', '#b47e4e']); p.line(7, 16 + Y, 13, 16 + Y, '#4a2a18'); }   // satchel on the back
  // arms
  const sw = [0, 1, 0, -1][f];
  if (dir === 'side') { p.ell(10 + sw, 19 + Y, 1.6, 2.6, TUNIC.slice(1)); p.set(10 + sw, 21 + Y, SKIN[3]); p.set(11 + sw, 21 + Y, SKIN[2]); }
  else { p.ell(4.5, 19 + Y + sw, 1.5, 2.4, TUNIC.slice(0, 3)); p.ell(15.5, 19 + Y - sw, 1.5, 2.4, TUNIC.slice(1, 4)); p.set(4, 21 + Y + sw, SKIN[2]); p.set(16, 21 + Y - sw, SKIN[3]); }
  // scarf
  p.rect(dir === 'side' ? 6 : 5, 15 + Y, dir === 'side' ? 9 : 10, 2, SCARF[1]); p.rect(dir === 'side' ? 6 : 5, 15 + Y, dir === 'side' ? 9 : 10, 1, SCARF[2]);
  const fl = f % 2;
  if (dir === 'side') { p.rect(3 - fl, 15 + Y, 3, 1, SCARF[1]); p.rect(2 - fl, 16 + Y + fl, 2, 1, SCARF[0]); }
  else if (dir === 'down') { p.rect(13, 17 + Y, 2, 2 + fl, SCARF[1]); p.set(13, 19 + Y + fl, SCARF[0]); }
  else { p.rect(9, 17 + Y, 2, 3, SCARF[1]); p.set(9, 20 + Y, SCARF[0]); }
  // head
  const hx = dir === 'side' ? 10.5 : 10;
  p.ell(hx, 10 + Y, dir === 'side' ? 6.6 : 7, 6.4, SKIN);
  if (dir === 'up') p.ell(hx, 10.5 + Y, 7, 6, HAIR, { only: (x, y) => y >= 8 + Y });
  else if (dir === 'side') { p.ell(hx - 3, 10 + Y, 3.6, 5, HAIR, { only: (x, y) => x <= 7 && y >= 8 + Y }); }
  else { p.set(3, 9 + Y, HAIR[1]); p.set(4, 10 + Y, HAIR[1]); p.set(16, 9 + Y, HAIR[1]); p.set(15, 10 + Y, HAIR[2]); }
  // leaf cap
  p.ell(hx, 6.4 + Y, 7.8, 4.8, CAPP, { only: (x, y) => y <= 7 + Y });
  p.rect(Math.round(hx - 7), 7 + Y, 15, 1, CAPP[1]);
  p.line(Math.round(hx) - 4, 4 + Y, Math.round(hx) + 3, 6 + Y, CAPP[1]);
  p.rect(Math.round(hx), 0 + Y, 1, 2, '#5a3a1e'); p.set(Math.round(hx) + 1, Y, '#5a3a1e'); p.set(Math.round(hx) - 1, 1 + Y, '#7a9a3a'); p.set(Math.round(hx) - 2, 1 + Y, '#9aba4a');
  // face
  const E = '#24161c';
  if (dir === 'down') {
    if (blink) { p.rect(6, 12 + Y, 2, 1, E); p.rect(12, 12 + Y, 2, 1, E); }
    else { p.rect(7, 11 + Y, 1, 2, E); p.rect(12, 11 + Y, 1, 2, E); p.set(7, 11 + Y, '#5a4a6a'); p.set(12, 11 + Y, '#5a4a6a'); }
    p.set(5, 13 + Y, '#f07a6a'); p.set(6, 13 + Y, '#f49a84'); p.set(14, 13 + Y, '#f07a6a'); p.set(13, 13 + Y, '#f49a84');
    p.set(9, 14 + Y, '#9a3a2a'); p.set(10, 14 + Y, '#9a3a2a');
  } else if (dir === 'side') {
    if (blink) p.rect(13, 12 + Y, 2, 1, E); else p.rect(14, 11 + Y, 1, 2, E);
    p.set(17, 12 + Y, SKIN[2]); p.set(13, 13 + Y, '#f07a6a'); p.set(15, 14 + Y, '#9a3a2a');
  }
  return p.done();
}
function paintHedgehog(f, blink) {    // Bramble: 26x20, faces right
  const p = new Pix(26, 21), br = f ? .4 : 0;
  const SP = ['#2e1a12', '#4a2c1c', '#6e4428', '#946038', '#b47e4e'];
  p.ell(11, 12, 10, 7.6 + br, SP);
  for (let x = 3; x <= 19; x += 2) { const t = (x - 11) / 10, top = 12 - (7.6 + br) * Math.sqrt(Math.max(0, 1 - t * t)); p.set(x, Math.round(top) - 1, SP[1]); p.set(x - 1, Math.round(top) - 2, SP[0]); }
  for (let i = 0; i < 14; i++) { const x = 4 + (i * 7) % 14, y = 8 + (i * 5) % 8; p.set(x, y, SP[4]); p.set(x + 1, y + 1, SP[1]); }
  p.ell(19, 14, 5.4, 4.4, ['#9a6a44', '#c8945e', '#e8c08a', '#f8dcb0']);
  p.ell(15.5, 8.5, 1.6, 1.6, ['#c8945e', '#e8c08a']); p.set(15, 8, '#7a4a30');
  p.rect(24, 13, 2, 2, '#24161c'); p.set(24, 13, '#6a5a6a');
  if (blink) p.rect(19, 13, 2, 1, '#24161c'); else { p.rect(20, 12, 1, 2, '#24161c'); }
  p.set(21, 15, '#f07a6a'); p.set(19, 16, '#7a3a2a'); p.set(20, 16, '#7a3a2a');
  p.rect(14, 16, 3, 2, '#5a8a3a'); p.set(15, 18, '#3e6a2a');       // green neckerchief
  p.rect(6, 19, 3, 2, '#3a2418'); p.rect(15, 19, 3, 2, '#3a2418');
  return p.done();
}
function paintFrog(f, blink) {        // Pip: 20x16
  const p = new Pix(20, 17), G = ['#1e4a24', '#2e6e2e', '#4a9a3a', '#72c04e', '#a4dc72'], pf = f ? 1 : 0;
  p.ell(10, 11, 8, 5.2, G);
  p.ell(10, 13.4, 4.4 + pf * .6, 2.6 + pf * .5, ['#b8c878', '#dce8a0', '#f0f6c8']);
  for (const ex of [5, 15]) { p.ell(ex, 5.5, 2.8, 2.8, G); p.ell(ex, 5.5, 1.8, 1.8, '#fff6dc'); if (blink) p.rect(ex - 1, 5, 3, 1, '#1e4a24'); else p.rect(ex, 5, 1, 2, '#24161c'); }
  p.line(6, 10, 14, 10, '#1e3a1c'); p.set(5, 9, '#1e3a1c'); p.set(15, 9, '#1e3a1c');
  p.set(6, 11, '#f08a7a'); p.set(14, 11, '#f08a7a');
  p.rect(3, 15, 4, 1, G[1]); p.rect(13, 15, 4, 1, G[1]);
  return p.done();
}
function paintSnail(f, blink) {       // Sorrel: 26x20, faces right
  const p = new Pix(26, 20), S_ = ['#4a1a3a', '#7a2e5a', '#b04a7e', '#d8709e', '#f4a8c8'], w = f ? 1 : 0;
  p.ell(13, 18, 11, 2.4, ['#8a7258', '#bca07a', '#e0c8a0']);
  p.ell(21, 13.5, 3, 5, ['#8a7258', '#bca07a', '#e0c8a0', '#f2e0bc']);
  p.line(20, 9, 19 + w, 4, '#a08866'); p.line(22, 9, 23 + w, 5, '#bca07a');
  p.ell(19 + w, 3.5, 1.4, 1.4, '#3a2a2a'); p.ell(23 + w, 4.5, 1.4, 1.4, '#3a2a2a');
  if (blink) { p.set(19 + w, 3, '#bca07a'); p.set(23 + w, 4, '#bca07a'); } else { p.set(19 + w, 3, '#fff'); p.set(23 + w, 4, '#fff'); }
  p.set(23, 14, '#f07a8a');
  p.ell(12, 10, 7.6, 7.6, S_);
  for (let a = 0; a < 9; a += .25) { const r = 6.6 - a * .7; if (r < .6) break; p.set(Math.round(12 + Math.cos(a * 1.4) * r), Math.round(10 + Math.sin(a * 1.4) * r), S_[1]); }
  return p.done();
}
function paintOwl(f, blink) {         // Old Wick: 22x26
  const p = new Pix(22, 26), B = ['#2e2018', '#4a3426', '#6a4e3a', '#8a6c52', '#aa8a6c'];
  p.poly([[3, 7], [5, 1], [8, 6]], B[1]); p.poly([[14, 6], [17, 1], [19, 7]], B[1]);
  p.ell(11, 15, 9, 10, B);
  p.ell(11, 18 + (f ? .4 : 0), 5.6, 6.4, ['#a88a68', '#d0b890', '#ecdab4']);
  for (let y = 15; y < 23; y += 3) for (let x = 8; x < 15; x += 3) { p.set(x, y, '#8a6c52'); p.set(x + 1, y + 1, '#8a6c52'); }
  p.ell(11, 10, 7.4, 5.4, ['#9a8060', '#c4aa86', '#e0ccaa']);
  for (const ex of [7.5, 14.5]) { p.ell(ex, 10, 2.9, 2.9, '#c8a040'); p.ell(ex, 10, 2.2, 2.2, '#fff2c0'); if (blink) { p.rect(Math.round(ex) - 2, 9, 4, 2, B[2]); p.rect(Math.round(ex) - 2, 11, 4, 1, B[1]); } else p.rect(Math.round(ex) - 1, 9, 2, 2, '#24161c'); }
  p.line(10, 10, 12, 10, '#c8a040');
  p.rect(10, 12, 2, 2, '#e8902a'); p.set(10, 13, '#b0601a');
  p.rect(7, 25, 3, 1, '#e8902a'); p.rect(12, 25, 3, 1, '#e8902a');
  return p.done();
}
const CRIT = { hedgehog: paintHedgehog, frog: paintFrog, snail: paintSnail, owl: paintOwl };

// ---------------------------------------------------------------- props
function paintTree(o) {
  const r = rng(o.seed), C = treePal(o.pal), p = new Pix(76, 96);
  const BK = ['#3a2218', '#5a3624', '#7a4e34', '#9a6a48'];
  p.col_(33, 50, 10, 44, BK); p.poly([[30, 95], [33, 86], [43, 86], [46, 95]], BK.slice(0, 3));
  p.line(38, 60, 26, 48, BK[1]); p.line(38, 60, 25, 49, BK[2]); p.line(40, 56, 52, 46, BK[1]);
  for (let i = 0; i < 6; i++) p.set(35 + (r() * 6 | 0), 60 + (r() * 30 | 0), BK[0]);
  const blobs = [[38, 30, 26, 20], [22, 40, 15, 12], [55, 38, 16, 13], [30, 18, 15, 12], [50, 20, 14, 12], [38, 46, 18, 9]];
  for (const [x, y, rx, ry] of blobs) p.ell(x + (r() - .5) * 4, y + (r() - .5) * 4, rx + r() * 3, ry + r() * 2, C);
  for (let i = 0; i < 70; i++) { const x = 12 + r() * 52 | 0, y = 8 + r() * 46 | 0; if (p.on(x, y) && p.on(x, y + 1)) { p.set(x, y, C[(r() * 2 | 0) + (y < 30 ? 3 : 1)]); } }
  for (let i = 0; i < 4; i++) { const x = 20 + r() * 36 | 0, y = 20 + r() * 26 | 0; p.clear(x, y); p.clear(x + 1, y); }   // gaps the light peeks through
  return p.done({ ax: 38, ay: 95 });
}
function paintPine(o) {
  const r = rng(o.seed), p = new Pix(52, 84), G = ['#14261e', '#1e3a2c', '#2c5038', '#3e6a46', '#5a8656'];
  p.col_(23, 66, 6, 17, ['#3a2218', '#5a3624', '#7a4e34']);
  for (let t = 0; t < 4; t++) { const y = 6 + t * 16, w = 10 + t * 6; p.poly([[26, y - 6], [26 + w, y + 18], [26 - w, y + 18]], G); }
  for (let i = 0; i < 18; i++) { const x = 8 + r() * 36 | 0, y = 10 + r() * 60 | 0; if (p.on(x, y)) p.set(x, y, ['#a04a2a', '#d0842a', '#5a8656'][i % 3]); }
  return p.done({ ax: 26, ay: 83 });
}
function paintBush(o) {
  const r = rng(o.seed), C = treePal(o.pal), p = new Pix(36, 26);
  p.ell(11, 15, 9, 8, C); p.ell(25, 15, 9, 8, C); p.ell(18, 10, 10, 8.5, C);
  if (o.berries !== false) for (let i = 0; i < 6; i++) { const x = 6 + r() * 24 | 0, y = 6 + r() * 14 | 0; if (p.on(x, y)) { p.set(x, y, '#c02a3a'); p.set(x, y - 1, '#ff6a6a'); } }
  return p.done({ ax: 18, ay: 24 });
}
function paintMush(o) {
  const s = o.s || 1, W = Math.round(30 * s) + 4, H = Math.round(34 * s) + 4, p = new Pix(W, H), cx = W / 2;
  const cap = o.cap || '#c4542f', CP = pal(cap, 5, .55, .4), SPOT = o.spot || '#fff2dc';
  p.col_(Math.round(cx - 4 * s), Math.round(H - 15 * s - 1), Math.max(3, Math.round(8 * s)), Math.round(15 * s), ['#a8987e', '#d8ccb0', '#f4ecd8']);
  p.ell(cx, H - 15 * s - 1, 14 * s, 11 * s, CP, { only: (x, y) => y <= H - 15 * s + 1 });
  const r = rng(o.seed || 3);
  for (let i = 0; i < 5; i++) { const a = -2.6 + i * .55 + r() * .2, d = (.45 + r() * .3); const x = cx + Math.cos(a) * 14 * s * d, y = H - 15 * s - 1 + Math.sin(a) * 11 * s * d; p.ell(x, y, Math.max(1, 1.8 * s), Math.max(1, 1.4 * s), SPOT); }
  p.rect(Math.round(cx - 11 * s), Math.round(H - 15 * s), Math.round(22 * s), 1, dark(cap, .45));
  return p.done({ ax: Math.round(cx), ay: H - 2 });
}
function paintRock(o) { const p = new Pix(32, 22), G = pal(o.c || '#9a968a', 5, .5, .3); p.ell(16, 13, 14, 9, G); p.ell(12, 7, 7, 3, ['#5a6a2a', '#7a8a34', '#9aaa44'], { only: (x, y) => p.on(x, y + 2) }); return p.done({ ax: 16, ay: 21 }); }
function paintStump() { const p = new Pix(26, 24), BK = ['#3a2218', '#5a3624', '#7a4e34', '#9a6a48']; p.col_(4, 7, 18, 15, BK); p.ell(13, 7, 9, 4, ['#a8784a', '#c8965e', '#e0b47a']); p.ell(13, 7, 5, 2, '#b88654'); p.ell(13, 7, 2, 1, '#a8784a'); p.rect(3, 21, 20, 2, BK[1]); return p.done({ ax: 13, ay: 22 }); }
function paintLog() { const p = new Pix(54, 20), BK = ['#3a2218', '#5a3624', '#7a4e34', '#9a6a48', '#b4845a']; for (let x = 4; x < 46; x++) for (let y = 4; y < 18; y++) p.set(x, y, p.shadeOf(BK, 1 - Math.abs((y - 8) / 9), x, y)); p.ell(47, 11, 5, 7, ['#a8784a', '#c8965e', '#e0b47a']); p.ell(47, 11, 2, 3, '#a8784a'); p.ell(14, 4, 6, 1.6, '#7a8a34'); p.ell(30, 4, 4, 1.2, '#9aaa44'); return p.done({ ax: 26, ay: 18 }); }
function paintFern(o) {
  const p = new Pix(40, 24), r = rng(o.seed), c = o.c || ['#c9962e', '#b8702a', '#a8862e'][o.seed % 3], P_ = [dark(c, .35), c, lite(c, .3)];
  for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .42, L = 12 + r() * 6; for (let t = 2; t < L; t += 1.5) { const x = 20 + Math.cos(a) * t, y = 22 + Math.sin(a) * t * .9 + t * t * .012; p.set(x, y, P_[0]); p.leaf(x, y, 3, .8, a - 1.2, P_); p.leaf(x, y, 3, .8, a + 1.2 - Math.PI, P_); } }
  return p.done({ ax: 20, ay: 23 });
}
function paintFlowers(o) { const p = new Pix(20, 18), r = rng(o.seed), cols = ['#9a6fc0', '#f2b63c', '#fff0d8', '#b07ad0']; for (let i = 0; i < 4; i++) { const x = 3 + r() * 14 | 0, y = 5 + r() * 6 | 0; p.line(x, y, x + (r() * 2 | 0), 17, '#6e7a34'); const c = cols[(r() * 4) | 0]; p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y + 1, c); p.set(x, y, '#e8a23b'); } return p.done({ ax: 10, ay: 17 }); }
function paintReeds(o) { const p = new Pix(18, 36), r = rng(o.seed); for (let i = 0; i < 5; i++) { const x = 3 + i * 3, h = 18 + r() * 14 | 0; p.line(x, 35, x + (r() < .5 ? 1 : -1), 35 - h, i % 2 ? '#7a8a3a' : '#a09a44'); if (i % 2 === 0) p.rect(x - 1 + (r() < .5 ? 1 : 0), 35 - h, 2, 5, '#6a3a20'); } return p.done({ ax: 9, ay: 35 }); }
function paintSign() { const p = new Pix(40, 34), W = ['#5a3624', '#8a5a36', '#b07c4c', '#d0a06a']; p.col_(18, 14, 4, 20, W); p.rect(3, 4, 34, 12, W[2]); p.rect(3, 4, 34, 1, W[3]); p.rect(3, 15, 34, 1, W[1]);
  const A = '#3a2218'; p.line(6, 10, 10, 10, A); p.line(6, 10, 8, 8, A); p.line(6, 10, 8, 12, A); p.line(20, 6, 20, 12, A); p.line(20, 6, 18, 8, A); p.line(20, 6, 22, 8, A); p.line(30, 10, 34, 10, A); p.line(34, 10, 32, 8, A); p.line(34, 10, 32, 12, A); return p.done({ ax: 20, ay: 33 }); }
function paintLantern() { const p = new Pix(12, 30); p.col_(5, 8, 2, 22, ['#2a2a2a', '#4a4a4a', '#6a6a6a']); p.rect(2, 4, 8, 8, '#3a3030'); p.rect(3, 5, 6, 6, '#ffd070'); p.rect(4, 6, 4, 4, '#fff4c0'); p.rect(1, 3, 10, 1, '#4a4040'); p.set(6, 2, '#4a4040'); return p.done({ ax: 6, ay: 29 }); }
function paintBasket() { const p = new Pix(22, 18), W = ['#7a4a26', '#a8703a', '#d09a5a']; for (let y = 6; y < 17; y++) for (let x = 2; x < 20; x++) p.set(x, y, W[(x + y) % 3 === 0 ? 0 : (x + y) % 2 ? 1 : 2]); p.ell(11, 6, 9, 2, '#5a3420'); for (let x = 4; x <= 18; x++) p.set(x, Math.round(6 - Math.sin((x - 4) / 14 * Math.PI) * 5), W[0]); p.set(8, 5, '#c98a45'); p.set(13, 5, '#c98a45'); return p.done({ ax: 11, ay: 17 }); }
function paintPedestal() { const p = new Pix(24, 22), G = pal('#9aa098', 5, .5, .3); p.col_(6, 6, 12, 15, G); p.ell(12, 6, 8, 3, G); p.ell(12, 5, 5, 1.5, '#9ab868'); p.rect(4, 19, 16, 2, G[1]); return p.done({ ax: 12, ay: 21 }); }
function paintLeafPile(o) { const p = new Pix(34, 16), r = rng(o.seed); p.ell(17, 11, 15, 4.6, pal('#9e4c26', 4)); for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()); p.leaf(17 + Math.cos(a) * 13 * d - 2, 10 + Math.sin(a) * 4 * d - (1 - d) * 4, 3 + r() * 2, 1.1, r() * TAU, pal(AUT[(r() * AUT.length) | 0], 3)); } return p.done({ ax: 17, ay: 15 }); }
function paintPumpkin(o) { const c = o.c || '#e07a22', p = new Pix(24, 22), Pp = pal(c, 5, .5, .35); p.ell(6.5, 13, 5.5, 7, Pp); p.ell(17.5, 13, 5.5, 7, Pp); p.ell(12, 13, 6.5, 7.6, Pp); p.line(9, 8, 9, 19, dark(c, .35)); p.line(15, 8, 15, 19, dark(c, .35)); p.rect(11, 2, 2, 4, '#5a4a22'); p.leaf(13, 4, 5, 1.6, -.3, ['#5a6a2a', '#7a8a3a', '#9aaa4a']); return p.done({ ax: 12, ay: 21 }); }
function paintBigTree() {
  const p = new Pix(220, 210), r = rng(31), BK = ['#2e1a12', '#4a2c1c', '#6a4228', '#8a5a38', '#a87448'];
  // trunk with roots
  for (let y = 70; y < 208; y++) { const w = 34 + Math.max(0, y - 150) * .9 + Math.sin(y * .2) * 1.5; for (let x = -w; x <= w; x++) { const u = (x / w + 1) / 2; p.set(110 + x, y, p.shadeOf(BK, clamp(1 - Math.abs(u - .33) * 1.6, 0, 1) + (((x * 7 + (y >> 2) * 3) % 11) === 0 ? -.3 : 0), 110 + x, y)); } }
  for (const [x0, dir] of [[78, -1], [142, 1], [96, -1], [126, 1]]) for (let t = 0; t < 26; t++) p.ell(x0 + dir * t * 1.4, 200 + t * .3, 6 - t * .15, 4, BK.slice(0, 4));
  for (let i = 0; i < 40; i++) { const x = 84 + r() * 52 | 0, y = 80 + r() * 110 | 0; p.line(x, y, x, y + 4 + r() * 6, BK[1]); }
  // door: dark arch with warm light
  for (let y = 150; y < 206; y++) for (let x = 92; x <= 128; x++) { const dx = (x - 110) / 18, top = 168 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 20; if (y >= top) p.set(x, y, '#c8965e'); }
  for (let y = 154; y < 206; y++) for (let x = 95; x <= 125; x++) { const dx = (x - 110) / 15, top = 170 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 17; if (y >= top) { const g = clamp(1 - Math.hypot((x - 110) / 16, (y - 196) / 30), 0, 1); p.set(x, y, p.shadeOf(['#1e100c', '#4a2410', '#a85a1e', '#f0a040', '#ffd27a'], g, x, y)); } }
  p.ell(126, 118, 8, 8, '#c8965e'); p.ell(126, 118, 6, 6, ['#4a2410', '#c8782a', '#ffd27a']);
  // canopy
  const C = treePal('autumn'), G = treePal('gold');
  const blobs = [[110, 52, 90, 40, C], [70, 64, 44, 26, G], [152, 62, 48, 28, C], [96, 30, 50, 24, G], [140, 34, 40, 22, C], [110, 74, 60, 18, C]];
  for (const [x, y, rx, ry, P_] of blobs) p.ell(x, y, rx, ry, P_);
  for (let i = 0; i < 260; i++) { const x = 20 + r() * 180 | 0, y = 8 + r() * 80 | 0; if (p.on(x, y) && p.on(x, y + 1) && y < 92) p.set(x, y, (y < 50 ? C[4] : C[2])); }
  p.ell(150, 98, 18, 4, BK.slice(1));   // branch stub
  return p.done({ ax: 110, ay: 207 });
}
function paintLily() { const p = new Pix(22, 14); p.ell(11, 7, 10, 6, ['#2a5a2a', '#3e7a34', '#5a9a44', '#7aba5a'], { only: (x, y) => !(x > 11 && Math.abs(y - 7) < 1.5 + (x - 11) * .2) }); p.set(6, 4, '#f4a8c8'); p.set(7, 4, '#ffd0e0'); return p.done({ ax: 11, ay: 7 }); }
function paintAcorn() { const p = new Pix(11, 14); p.ell(5.5, 8.6, 4.6, 5.2, ['#7a4a22', '#a86a34', '#d0904c', '#ecb46c']); p.ell(5.5, 4.6, 5.2, 2.8, ['#3e2412', '#5e3a1e', '#7e5230'], { only: (x, y) => y <= 5 }); for (let x = 2; x < 10; x += 2) p.set(x, 4, '#8e6440'); p.rect(5, 0, 1, 2, '#4a2c16'); p.set(6, 0, '#4a2c16'); return p.done({ ax: 5, ay: 13 }); }
function paintGoldLeaf() { const p = new Pix(14, 14); p.leaf(2, 12, 13, 4.2, -.8, ['#b8861c', '#f2c541', '#fff09a']); p.line(2, 12, 10, 4, '#9b6f18'); p.line(1, 13, 2, 12, '#7a5410'); return p.done({ ax: 7, ay: 13 }); }
function paintLeafBit() { const p = new Pix(5, 4); p.set(0, 2, '#ffffff'); p.rect(1, 1, 3, 2, '#e8e8e8'); p.set(4, 1, '#ffffff'); p.set(2, 0, '#cfcfcf'); p.set(2, 3, '#bdbdbd'); return p.done({ outline: false }); }

// prop table: painter, collision (in game units, foot-relative), sway, low = lies flat
const PROPDEF = {
  tree: { paint: paintTree, solid: [[0, 0, 9]], sway: .012 },
  pine: { paint: paintPine, solid: [[0, 0, 8]], sway: .012 },
  bush: { paint: paintBush, solid: [[0, -2, 11]], sway: .02 },
  mush: { paint: paintMush, solid: p => [[0, 0, 6 * (p.s || 1)]], sway: .02 },
  rock: { paint: paintRock, solid: [[0, -2, 11]] },
  stump: { paint: paintStump, solid: [[0, -3, 10]] },
  log: { paint: paintLog, solid: [[-16, -4, 9], [0, -4, 9], [16, -4, 9]] },
  fern: { paint: paintFern, sway: .05 },
  flowers: { paint: paintFlowers, sway: .06 },
  reeds: { paint: paintReeds, sway: .06 },
  sign: { paint: paintSign, solid: [[0, 0, 4]] },
  lantern: { paint: paintLantern, solid: [[0, 0, 3]], light: ['#ffbf5a', 26, 1] },
  basket: { paint: paintBasket, solid: [[0, -2, 7]] },
  pedestal: { paint: paintPedestal, solid: [[0, -2, 9]] },
  bigtree: { paint: paintBigTree, solid: [[-56, -6, 15], [-32, -10, 20], [0, -12, 20], [32, -10, 20], [56, -6, 15]], sway: .002 },
  stone: { low: true },
  leafpile: { paint: paintLeafPile },
  pumpkin: { paint: paintPumpkin, solid: [[0, -2, 8]] },
  lily: { paint: paintLily, low: true },
};
const pv = (v, p) => typeof v === 'function' ? v(p) : v;

// ---------------------------------------------------------------- canvases & scale
// #gl: the 3D view, rendered at a reduced internal resolution (IW x IH) and upscaled
// with nearest-neighbour (CSS image-rendering: pixelated). #c: crisp UI on top, in
// "UI units" (the short screen side shows ~VIEWMIN units), also receives input.
const glc = document.getElementById('gl');
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const VIEWMIN = 236, VIEWMIN_PORTRAIT = 200;
let DPR = 1, CW = 1, CH = 1, SC = 1, VW = 1, VH = 1;
let IW = 1, IH = 1, PS = 1, psBoost = 1;
const U = 1.25;   // world units per sprite texel (same for every sprite: consistent pixel density)

// ---------------------------------------------------------------- the world
const GT = 56;            // ground top edge: above it is the layered back scenery
const PR = 6;             // player foot radius
const ACORNS = 12, LEAVES = 3;
const streamX = y => 250 + 16 * Math.sin(y / 55 + .6);
const STREAM_HW = 32;

const AREADEF = {
  clearing: {
    name: 'Sunny Clearing', pal: 'meadow', w: 480, h: 400,
    exits: [{ e: 'n', a: 208, b: 272, to: 'grove', sx: 240, sy: 378 }, { e: 'e', a: 226, b: 284, to: 'stream', sx: 16, sy: 255 }, { e: 'w', a: 226, b: 284, to: 'hollow', sx: 464, sy: 255 }],
    paths: [[[240, 40], [238, 150], [244, 252], [330, 258], [490, 254]], [[244, 252], [150, 256], [-10, 254]]],
    props: [['tree', 108, 168, { pal: 'autumn' }], ['tree', 395, 338, { pal: 'amber' }], ['tree', 66, 362, { pal: 'gold' }], ['bush', 322, 150, { pal: 'amber' }], ['bush', 168, 118, { pal: 'autumn', berries: false }],
      ['rock', 392, 200, {}], ['stump', 166, 308, {}], ['basket', 148, 318, {}], ['sign', 286, 222, {}], ['log', 322, 330, {}],
      ['leafpile', 140, 220, {}], ['flowers', 300, 290, {}], ['leafpile', 256, 352, {}], ['leafpile', 60, 330, {}], ['fern', 438, 196, {}], ['fern', 64, 196, {}], ['pumpkin', 128, 324, {}], ['pumpkin', 116, 332, { c: '#e9a43a' }], ['mush', 98, 228, { s: .5, cap: '#b84a2c' }], ['mush', 352, 182, { s: .55, cap: '#e2493b' }], ['mush', 362, 188, { s: .4, cap: '#f08a3c' }]],
    items: [['a1', 'acorn', 88, 318], ['a2', 'acorn', 408, 128], ['a3', 'acorn', 366, 374]],
    npcs: ['bramble'], objs: ['sign'],
  },
  stream: {
    name: 'Stepping Stream', pal: 'river', w: 480, h: 400,
    exits: [{ e: 'w', a: 226, b: 284, to: 'clearing', sx: 464, sy: 255 }],
    paths: [[[-10, 255], [150, 256], [streamX(256) - 40, 255]], [[streamX(256) + 40, 255], [380, 250], [440, 200]]],
    water: (x, y) => y > GT - 4 && Math.abs(x - streamX(y)) < STREAM_HW,
    island: { x: 244, y: 140, r: 12 },
    stones: (() => { const s = [], sx = streamX(256); for (let i = 0; i < 4; i++) s.push({ x: sx - 24 + i * 16, y: 255 + [1, -2, 2, -1][i], r: 11, seed: 40 + i });
      s.push({ x: 258, y: 147, r: 9.5, seed: 50, hidden: true }, { x: 272, y: 153, r: 9.5, seed: 51, hidden: true }); return s; })(),
    props: [['tree', 80, 150, { pal: 'amber' }], ['tree', 404, 176, { pal: 'autumn' }], ['pine', 360, 352, {}], ['rock', 140, 330, {}], ['log', 404, 290, {}], ['bush', 66, 306, { pal: 'rust' }],
      ['reeds', streamX(100) - 38, 100, {}], ['reeds', streamX(190) - 39, 190, {}], ['reeds', streamX(330) - 38, 330, {}], ['reeds', streamX(372) - 39, 372, {}],
      ['reeds', streamX(110) + 38, 110, {}], ['reeds', streamX(300) + 38, 300, {}], ['reeds', streamX(360) + 39, 360, {}],
      ['leafpile', 120, 210, {}], ['flowers', 330, 120, {}], ['fern', 450, 230, {}], ['leafpile', 330, 330, {}], ['mush', 176, 330, { s: .5, cap: '#c4542f' }], ['mush', 168, 120, { s: .5, cap: '#f08a3c' }],
      ['lily', streamX(330) - 15, 336, {}], ['lily', streamX(200) + 10, 200, {}], ['lily', streamX(355) + 14, 355, {}]],
    items: [['a4', 'acorn', 112, 116], ['a5', 'acorn', 424, 124], ['a6', 'acorn', 444, 348], ['g1', 'leaf', 244, 138]],
    npcs: ['pip'], objs: [],
  },
  grove: {
    name: 'Mushroom Grove', pal: 'grove', w: 480, h: 400,
    exits: [{ e: 's', a: 208, b: 272, to: 'clearing', sx: 240, sy: 84 }],
    paths: [[[240, 410], [236, 300], [250, 220], [300, 170]]],
    props: [['mush', 118, 176, { s: 1.35, cap: '#e2493b' }], ['mush', 352, 150, { s: 1.45, cap: '#8a5cc9', spot: '#e9dcff', glow: '#c9a8ff' }], ['mush', 404, 300, { s: 1.25, cap: '#2f9e9a', spot: '#d8fff6', glow: '#8fffe3' }],
      ['mush', 88, 318, { s: 1.15, cap: '#f08a3c' }], ['mush', 250, 176, { s: 1.5, cap: '#ef7fb2', spot: '#fff0f7', id: 'bouncy', seed: 9 }],
      ['mush', 176, 252, { s: .55, cap: '#8a5cc9', glow: '#c9a8ff' }], ['mush', 188, 258, { s: .4, cap: '#2f9e9a', glow: '#8fffe3' }], ['mush', 312, 226, { s: .5, cap: '#e2493b' }],
      ['mush', 156, 366, { s: .6, cap: '#2f9e9a', glow: '#8fffe3' }], ['mush', 334, 368, { s: .5, cap: '#8a5cc9', glow: '#c9a8ff' }], ['mush', 346, 372, { s: .38, cap: '#ef7fb2' }],
      ['rock', 60, 150, { c: '#9a9eb2' }], ['fern', 420, 200, { c: '#a8742a' }], ['fern', 70, 240, { c: '#b8862e' }], ['leafpile', 380, 250, {}], ['leafpile', 130, 290, {}], ['stump', 290, 312, {}]],
    items: [['a7', 'acorn', 58, 232], ['a8', 'acorn', 436, 214], ['a9', 'acorn', 212, 332]],
    npcs: ['sorrel'], objs: ['bouncy'],
  },
  hollow: {
    name: 'The Old Hollow', pal: 'hollow', w: 480, h: 400,
    exits: [{ e: 'e', a: 226, b: 284, to: 'clearing', sx: 16, sy: 255 }, { e: 'n', a: 102, b: 132, to: 'glade', sx: 180, sy: 282, hidden: true }],
    paths: [[[490, 255], [330, 250], [250, 200]]],
    props: [['bigtree', 240, 172, {}], ['stump', 336, 206, {}], ['lantern', 172, 214, {}], ['lantern', 322, 262, {}],
      ['bush', 117, GT + 22, { pal: 'autumn', id: 'fakebush', berries: false }],
      ['mush', 92, 210, { s: .6, cap: '#f08a3c' }], ['mush', 102, 216, { s: .42, cap: '#e2493b' }], ['rock', 400, 150, { c: '#a8a296' }],
      ['tree', 92, 330, { pal: 'gold' }], ['fern', 380, 340, {}], ['fern', 168, 300, {}], ['leafpile', 270, 320, {}], ['pumpkin', 432, 212, {}], ['pumpkin', 418, 220, { c: '#d06a1e' }], ['log', 300, 360, {}], ['leafpile', 150, 250, {}]],
    items: [['a10', 'acorn', 56, 300], ['a11', 'acorn', 424, 330]],
    npcs: ['wick'], objs: ['door'],
  },
  glade: {
    name: 'Hidden Glade', pal: 'glade', w: 360, h: 300,
    exits: [{ e: 's', a: 160, b: 200, to: 'hollow', sx: 117, sy: 86 }],
    paths: [[[180, 310], [182, 250], [230, 200], [262, 160]]],
    water: (x, y) => Math.hypot((x - 128) / 1.25, y - 168) < 34,
    props: [['pedestal', 268, 152, {}], ['leafpile', 210, 120, {}], ['flowers', 300, 210, {}], ['leafpile', 90, 240, {}], ['mush', 250, 262, { s: .55, cap: '#c4542f', glow: '#ffb070' }], ['flowers', 150, 110, {}], ['mush', 318, 160, { s: .5, cap: '#8a5cc9', glow: '#c9a8ff' }],
      ['mush', 60, 150, { s: .6, cap: '#ef7fb2' }], ['mush', 300, 110, { s: .5, cap: '#f6d14b' }], ['fern', 320, 250, {}], ['reeds', 84, 196, {}], ['reeds', 176, 190, {}],
      ['lily', 116, 160, {}], ['lily', 140, 178, {}]],
    items: [['g3', 'leaf', 268, 134]],
    npcs: [], objs: [],
  },
};

// NPCs and things you can talk to / poke
const NPCS = {
  bramble: { area: 'clearing', kind: 'hedgehog', name: 'Bramble', color: '#9a6440', x: 196, y: 300, h: 34, range: 34 },
  pip: { area: 'stream', kind: 'frog', name: 'Pip', color: '#4f9a45', x: streamX(330) - 15, y: 334, h: 26, range: 34, front: true },
  sorrel: { area: 'grove', kind: 'snail', name: 'Sorrel', color: '#c86d93', x: 304, y: 282, h: 28, range: 30 },
  wick: { area: 'hollow', kind: 'owl', name: 'Old Wick', color: '#7a604c', x: 336, y: 207, dy: -15, h: 50, range: 34, front: true },
};

// ---------------------------------------------------------------- state
const S = {
  mode: 'title', area: null, A: null, px: 240, py: 300, facing: 1, flip: 1, back: false, walk: 0, moving: false,
  got: new Set(), acorns: 0, leaves: 0, flags: {}, t: 0, playT: 0, finishT: null,
  dlg: null, trans: null, banner: null, toasts: [], floaters: [], sparks: [], pops: {}, confetti: [], hud: 0, dir: 'down',
  camX: 0, camY: 0, target: null, playP: null,
};
const AREAS = {};
function distSeg(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; const t = l ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0, 1) : 0; return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); }
function nearPath(A, x, y, d) { return A.paths.some(pl => pl.some((q, i) => i && distSeg(x, y, pl[i - 1], q) < d)); }
function buildArea(id) {
  const d = AREADEF[id], ap = AP[d.pal], r = rng(id.length * 977 + d.w);
  const A = Object.assign({ id, ap, stones: [] }, d); A.props = [];
  const add = (k, x, y, o) => A.props.push(Object.assign({ k, x, y, seed: (x * 7 + y * 13) | 0, ph: r() * TAU }, o || {}));
  const inExit = (e, v, m) => A.exits.some(x => x.e === e && v > x.a - m && v < x.b + m) || (id === 'stream' && e === 'n' && Math.abs(v - streamX(GT)) < 34 + m);
  const treePal = () => ap.trees[(r() * ap.trees.length) | 0];
  // border: a back row of trees along the top, trees down the sides, low bushes along the front
  for (let x = 6 + r() * 10; x < A.w; x += 30 + r() * 12) if (!inExit('n', x, 22)) add(r() < .3 ? 'pine' : 'tree', x, GT + 12 + r() * 12, { pal: treePal() });
  for (let x = 20 + r() * 20; x < A.w; x += 44 + r() * 20) if (!inExit('n', x, 30)) add(r() < .4 ? 'pine' : 'tree', x, GT - 2 + r() * 6, { pal: treePal() });
  for (const side of ['w', 'e']) for (let y = GT + 52 + r() * 10; y < A.h - 14; y += 38 + r() * 14) {
    if (inExit(side, y, 26)) continue;
    const x = side === 'w' ? 6 + r() * 8 : A.w - 6 - r() * 8; add(r() < .3 ? 'bush' : r() < .5 ? 'pine' : 'tree', x, y, { pal: treePal() });
  }
  for (let x = 10 + r() * 10; x < A.w; x += 30 + r() * 14) if (!inExit('s', x, 22)) add(r() < .7 ? 'bush' : 'fern', x, A.h - 2 - r() * 4, { pal: treePal(), berries: r() < .4 });
  d.props.forEach(q => add(q[0], q[1], q[2], q[3]));
  // a sprinkle of low decoration away from paths and water
  for (let i = 0, tries = 0; i < 9 && tries < 200; tries++) {
    const x = 30 + r() * (A.w - 60), y = GT + 40 + r() * (A.h - GT - 70);
    if (nearPath(A, x, y, 22) || (A.water && A.water(x, y)) || (A.water && A.water(x + 14, y)) || (A.water && A.water(x - 14, y))) continue;
    if (A.props.some(p => Math.hypot(p.x - x, p.y - y) < 26) || d.npcs.some(n => Math.hypot(NPCS[n].x - x, NPCS[n].y - y) < 40)) continue;
    { const q = r(); add(q < .45 ? 'leafpile' : q < .75 ? 'fern' : q < .9 ? 'mush' : 'flowers', x, y, q >= .75 && q < .9 ? { s: .4 + r() * .2, cap: ['#c4542f', '#e08a2a', '#9a6fc0'][(r() * 3) | 0] } : {}); } i++;
  }
  A.solids = [];
  for (const p of A.props) { const sd = pv(PROPDEF[p.k].solid, p); if (sd && p.id !== 'fakebush') sd.forEach(s => A.solids.push({ x: p.x + s[0], y: p.y + s[1], r: s[2] })); }
  for (const nid of d.npcs) { const n = NPCS[nid]; A.solids.push({ x: n.x, y: n.y, r: n.kind === 'frog' ? 1 : 8 }); }
  A.items = d.items.map(q => ({ id: q[0], type: q[1], x: q[2], y: q[3], ph: r() * TAU }));
  A.motes = []; const nm = ap.fireflies || 7;
  for (let i = 0; i < nm; i++) A.motes.push({ x: r() * A.w, y: GT + r() * (A.h - GT), ph: r() * TAU, sp: .3 + r() * .5, glow: true, z: 4 + r() * 30 });
  // god-ray beams pouring through canopy gaps: top point, angle, width, length (+ a few dust motes each)
  A.beams = []; const nb = id === 'glade' ? 4 : 3;
  for (let i = 0; i < nb; i++) {
    const x0 = (i + .5) / nb * A.w + (r() - .5) * 40 + 120, a = .34 + r() * .1, yEnd = A.h * .62 + r() * A.h * .34;
    A.beams.push({ x0, y0: -60, a, w: 70 + r() * 50, L: (yEnd + 60) / Math.cos(a), ph: r() * TAU, dust: Array.from({ length: 7 }, () => ({ u: r(), v: r() - .5, sp: .012 + r() * .02, ph: r() * TAU })) });
  }
  if (id === 'glade') Object.assign(A.beams[2], { x0: 268 + Math.tan(.38) * 212, a: .38, w: 64, L: 212 / Math.cos(.38) }); // a beam lands on the golden-leaf pedestal
  A.ripples = []; for (let i = 0; i < 26; i++) A.ripples.push({ u: r(), off: (r() - .5) * 1.5, len: 4 + r() * 6, sp: .05 + r() * .05 });
  return A;
}
for (const id in AREADEF) AREAS[id] = buildArea(id);
const bouncy = AREAS.grove.props.find(p => p.id === 'bouncy');
const fakeBush = AREAS.hollow.props.find(p => p.id === 'fakebush');

// ---------------------------------------------------------------- sound (tiny, optional)
let AC = null, muted = false;
function audioInit() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
function tone(f, d, type = 'sine', v = .07, slide = 0, delay = 0) {
  if (!AC || muted) return; const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .03);
}
const sfx = {
  acorn() { tone(784, .12, 'triangle', .07); tone(1175, .2, 'triangle', .06, 0, .07); },
  leaf() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, .3, 'triangle', .06, 0, i * .08)); },
  blip() { tone(560 + Math.random() * 90, .035, 'square', .018); },
  page() { tone(320, .16, 'triangle', .04, .55); },
  bounce() { tone(170, .32, 'sine', .12, 2.6); },
  done() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .32, 'triangle', .07, 0, i * .11)); },
};

// ---------------------------------------------------------------- dialogue & interactions
function say(name, color, portrait, lines, onEnd) {
  S.dlg = { name, color, portrait, lines, i: 0, shown: 0, onEnd, wrapped: null };
}
function talkTo(nid) {
  const n = NPCS[nid], F = S.flags; let lines, onEnd;
  if (nid === 'bramble') {
    if (F.done) lines = S.leaves < LEAVES ? ['Stay as long as you like. The wood is yours to wander.', 'They say ' + (LEAVES - S.leaves) + ' golden leaf' + (LEAVES - S.leaves > 1 ? 'ves are' : ' is') + ' still hiding somewhere...'] : ['Three golden leaves! You know Thimblewood better than I do.'];
    else if (!F.metBramble) { lines = ['Oh! A visitor! I\'m Bramble.', 'Last night a gust tipped my basket and scattered my acorns all over Thimblewood.', 'Twelve acorns. Without them there\'s no Harvest Supper!', 'Could you find them? Try the stream to the east, the grove up north and the old hollow to the west.']; onEnd = () => { F.metBramble = true; }; }
    else if (S.acorns >= ACORNS) { lines = ['All twelve! Every last one!', 'The Harvest Supper is saved. Acorn cakes for the whole wood!']; onEnd = finish; }
    else lines = [[S.acorns ? S.acorns + ' of 12 so far. Lovely!' : 'No acorns yet? They roll everywhere!', 'Keep looking, I\'ll keep the kettle on.'][0], S.acorns >= 6 ? 'Have you poked around the old hollow? Owls hoard things.' : 'Mind the stepping stones on the stream.'];
  } else if (nid === 'pip') {
    lines = S.got.has('g1') ? ['Ribbit! You found the island leaf. Nobody ever spots those low stones.'] : ['Ribbit. Mind the stones, they\'re slippery.', 'Some stones sit so low you\'d hardly see them. Look upstream, by the little island.'];
  } else if (nid === 'sorrel') {
    lines = F.bounced ? ['Told you it was springy.', 'Sloooow down and enjoy the glow, little one.'] : ['Sloooow down, little one...', 'That big pink mushroom is ever so springy.', 'Go on. Give it a poke.'];
  } else if (nid === 'wick') {
    lines = F.metWick ? ['Hoo. Still wandering? Good.', 'Not every bush along the north edge is as thick as it looks.'] : ['Hoo. A young sprout, wandering alone?', 'This tree was old before the stream learned to run.', 'If you\'re after acorns, try reaching into the hollow. And mind the north bushes. Not all of them are as thick as they look.'];
    onEnd = () => { F.metWick = true; };
  }
  say(n.name, n.color, n.kind, lines, onEnd);
}
const OBJS = {
  sign: { area: 'clearing', x: 286, y: 224, h: 44, range: 26, use() { say('Signpost', '#a2724a', null, ['West: The Old Hollow  \u00b7  North: Mushroom Grove  \u00b7  East: Stepping Stream', 'Someone has carved a tiny acorn into the post.']); } },
  bouncy: { area: 'grove', x: 250, y: 178, h: 64, range: 30, use() {
    S.bounceT = 1; sfx.bounce();
    if (!S.flags.bounced) { S.flags.bounced = true; const it = { id: 'g2', type: 'leaf', x: 268, y: 208, ph: 0, pop: { t: 0, x0: 250, y0: 150 } }; AREAS.grove.items.push(it); }
  } },
  door: { area: 'hollow', x: 240, y: 186, h: 56, range: 28, use() {
    if (!S.flags.door) { S.flags.door = true; say('The Old Hollow', '#8b5a3c', null, ['You reach into the warm, dark hollow...', 'An acorn! Someone tucked it away for safekeeping.'], () => collect({ id: 'a12', type: 'acorn', x: 240, y: 190 })); }
    else say('The Old Hollow', '#8b5a3c', null, ['Just dust, a lost button and a very sleepy beetle.']);
  } },
};
function collect(it) {
  if (S.got.has(it.id)) return; S.got.add(it.id);
  if (it.type === 'acorn') { S.acorns++; S.hud = 1; sfx.acorn(); S.floaters.push({ x: it.x, y: it.y - 14, t: 0, text: S.acorns + '/12' });
    if (S.acorns === ACORNS && !S.flags.done) toast('That\'s all twelve! Take them back to Bramble.');
  } else { S.leaves++; S.hud = 1; sfx.leaf(); toast('Golden leaf! Secret ' + S.leaves + ' of ' + LEAVES); burst(it.x, it.y, 18); }
}
function toast(text) { S.toasts.push({ text, t: 0 }); }
function finish() {
  S.flags.done = true; S.finishT = S.playT; S.mode = 'end'; sfx.done();
  for (let i = 0; i < 90; i++) S.confetti.push({ x: Math.random() * VW, y: -Math.random() * VH * .6, vx: (Math.random() - .5) * 20, vy: 30 + Math.random() * 40, r: Math.random() * TAU, vr: (Math.random() - .5) * 8, c: ['#c4512c', '#f0a03e', '#e9c24a', '#b23a32', '#8a5cc9', '#72c4a4', '#fff4dc'][i % 7] });
  const A = window.MembersAuth; const secs = Math.round(S.finishT);
  if (A && S.playP) S.playP.then(id => id && A.endPlay(id, { outcome: 'win', score: secs, meta: { leaves: S.leaves } })).catch(() => {});
}
function burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 30; S.sparks.push({ x, y: 10, z: y, vx: Math.cos(a) * v, vy: 30 + Math.random() * 40, vz: Math.sin(a) * v, t: 0 }); } }
function interactables() {
  const out = [];
  for (const nid of S.A.npcs) { const n = NPCS[nid]; out.push({ x: n.x, y: n.y, h: n.h + (n.dy ? -n.dy : 0), range: n.range, use: () => talkTo(nid), nid }); }
  for (const oid of S.A.objs) { const o = OBJS[oid]; out.push({ x: o.x, y: o.y, h: o.h, range: o.range, use: o.use, oid }); }
  return out;
}
function act() {
  audioInit();
  if (S.mode === 'title') return start();
  if (S.mode === 'end') { S.mode = 'play'; return; }
  if (S.trans) return;
  if (S.dlg) return advance();
  if (S.target) S.target.use();
}
function back() {
  if (S.mode === 'end') { S.mode = 'play'; return; }
  if (S.dlg) { const d = S.dlg; S.dlg = null; if (d.onEnd) d.onEnd(); }
}
function advance() {
  const d = S.dlg, full = d.lines[d.i].length;
  if (d.shown < full) { d.shown = full; return; }
  d.i++; d.shown = 0; d.wrapped = null; sfx.page();
  if (d.i >= d.lines.length) { S.dlg = null; if (d.onEnd) d.onEnd(); }
}
function start() {
  S.mode = 'play'; ROOT.classList.remove('tw-title'); S.playT = 0; setBanner(S.A.name);
  const A = window.MembersAuth; S.playP = A && A.startPlay ? A.startPlay('thimblewood').catch(() => null) : null;
  if (!S.flags.metBramble) setTimeout(() => { if (S.mode === 'play' && !S.dlg) toast('Bramble the hedgehog looks worried. Say hello!'); }, 900);
}
function setBanner(text) { S.banner = { text, t: 0 }; }

// ---------------------------------------------------------------- input: keyboard (also used by on-screen overlays)
const held = { up: 0, down: 0, left: 0, right: 0 };
const KEYS = { ArrowUp: 'up', KeyW: 'up', w: 'up', ArrowDown: 'down', KeyS: 'down', s: 'down', ArrowLeft: 'left', KeyA: 'left', a: 'left', ArrowRight: 'right', KeyD: 'right', d: 'right',
  ' ': 'act', Space: 'act', Spacebar: 'act', Enter: 'act', NumpadEnter: 'act', KeyZ: 'act', z: 'act', KeyE: 'act', e: 'act',
  Escape: 'back', Esc: 'back', KeyX: 'back', x: 'back', KeyM: 'mute', m: 'mute' };
function keyOf(e) { return KEYS[e.code] || KEYS[e.key] || (e.key && KEYS[e.key.toLowerCase()]); }
function typing(e) { const t = e.target; return t && t !== document && t !== window && t.closest && t.closest('input,textarea,select,[contenteditable],.mo-panel'); }
// capture phase on window: sees key events dispatched on window, document or any element
window.addEventListener('keydown', e => {
  if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; const k = keyOf(e); if (!k) return;
  e.preventDefault();
  if (k in held) { held[k] = 1; audioInit(); if (S.mode === 'title' && !SHOT) start(); }
  else if (!e.repeat) { if (k === 'act') act(); else if (k === 'back') back(); else if (k === 'mute') { muted = !muted; toast(muted ? 'Sound off (M)' : 'Sound on (M)'); } }
}, true);
window.addEventListener('keyup', e => { const k = keyOf(e); if (k && k in held) held[k] = 0; }, true);
window.addEventListener('blur', () => { for (const k in held) held[k] = 0; });

// ---------------------------------------------------------------- input: touch stick + A button
const touchEl = document.getElementById('touch'), stickEl = document.getElementById('stick'), knobEl = document.getElementById('knob'), btnA = document.getElementById('btnA');
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const touchOn = () => !ROOT.classList.contains('no-touch-ui');
function setTouchUI(on) { ROOT.classList.toggle('no-touch-ui', !on); if (on) ROOT.classList.add('touch-ui'); restStick(); }
function restStick() { stickEl.style.left = (82) + 'px'; stickEl.style.top = (innerHeight - 118) + 'px'; knobEl.style.transform = ''; stickEl.classList.remove('on'); }
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) ROOT.classList.add('touch-ui');
cv.addEventListener('pointerdown', e => {
  audioInit(); cv.focus({ preventScroll: true });
  if (e.pointerType !== 'mouse') ROOT.classList.add('touch-ui');
  if (S.mode === 'title') { if (!SHOT) start(); return; }
  if (S.mode === 'end' || S.dlg) { act(); return; }
  if (e.pointerType !== 'mouse' && touchOn() && e.clientX < innerWidth * .6 && stick.id === null) {
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.classList.add('on');
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    return;
  }
  act();
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), R = 42;
  if (d > R) { dx *= R / d; dy *= R / d; }
  stick.x = dx / R; stick.y = dy / R; knobEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
});
const endStick = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; restStick(); };
cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
btnA.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btnA.classList.add('down'); act(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btnA.addEventListener(t, () => btnA.classList.remove('down')));
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------------------------------------------------------------- simulation
function enterArea(id, x, y) {
  S.area = id; S.A = AREAS[id]; S.px = x; S.py = y; const c = camTarget(); S.camX = c[0]; S.camY = c[1];
  for (const p of S.A.props) p.rustle = 0;
  onEnterArea(S.A);
}
function onSafe(A, x, y) {
  for (const s of A.stones) if (Math.hypot(x - s.x, (y - s.y) * 1.15) < s.r) return true;
  if (A.island && Math.hypot(x - A.island.x, (y - A.island.y) * 1.3) < A.island.r) return true;
  return false;
}
const canStand = (A, x, y) => !A.water || !A.water(x, y) || onSafe(A, x, y);
function clampBounds(A, x, y) {
  const inExit = (e, v) => A.exits.some(q => q.e === e && v >= q.a && v <= q.b);
  if (x < 10 && !inExit('w', y)) x = 10; if (x > A.w - 10 && !inExit('e', y)) x = A.w - 10;
  if (y < GT + 18 && !inExit('n', x)) y = GT + 18; if (y > A.h - 8 && !inExit('s', x)) y = A.h - 8;
  return [x, y];
}
function update(dt) {
  S.t += dt; const A = S.A;
  if (S.mode === 'play' && !S.flags.done) S.playT += dt;
  // transition between areas
  if (S.trans) {
    const T = S.trans; T.t += dt;
    if (!T.swapped && T.t >= T.dur / 2) { T.swapped = true; enterArea(T.to, T.sx, T.sy); setBanner(S.A.name); }
    if (T.t >= T.dur) S.trans = null;
  }
  // dialogue typing
  if (S.dlg) { const d = S.dlg, full = d.lines[d.i].length; if (d.shown < full) { const before = Math.floor(d.shown); d.shown = Math.min(full, d.shown + dt * 52); if (Math.floor(d.shown) !== before && before % 3 === 0) sfx.blip(); } }
  // walking
  let mx = held.right - held.left + stick.x, my = held.down - held.up + stick.y;
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const canMove = S.mode === 'play' && !S.dlg && !S.trans;
  S.moving = canMove && ml > .15;
  if (S.moving) {
    const sp = 74; let nx = S.px + mx * sp * dt, ny = S.py;
    if (!canStand(A, nx, ny)) nx = S.px;
    ny = S.py + my * sp * dt; if (!canStand(A, nx, ny)) ny = S.py;
    for (const s of A.solids) { const dx = nx - s.x, dy = ny - s.y, d = Math.hypot(dx, dy), mn = s.r + PR; if (d < mn && d > .001) { nx = s.x + dx / d * mn; ny = s.y + dy / d * mn; } }
    [nx, ny] = clampBounds(A, nx, ny);
    if (canStand(A, nx, ny)) { S.px = nx; S.py = ny; }
    S.walk += dt;
    if (Math.abs(mx) > .2) S.facing = mx > 0 ? 1 : -1;
    if (my < -.35 && Math.abs(my) > Math.abs(mx) * .7) S.back = true; else if (my > .2 || Math.abs(mx) > .35) S.back = false;
    S.dir = Math.abs(my) > Math.abs(mx) * .8 ? (my < 0 ? 'up' : 'down') : 'side';
    // exits
    for (const q of A.exits) {
      const hit = q.e === 'w' ? S.px < 3 : q.e === 'e' ? S.px > A.w - 3 : q.e === 'n' ? S.py < GT + 6 : S.py > A.h - 1;
      if (hit && !S.trans) { S.trans = { t: 0, dur: .9, to: q.to, sx: q.sx, sy: q.sy, dir: q.e, swapped: false }; sfx.page(); }
    }
  }
  const tf = S.facing, df = tf - S.flip; S.flip += Math.sign(df) * Math.min(Math.abs(df), dt * 9);
  // pickups
  if (S.mode === 'play') for (const it of A.items) if (!S.got.has(it.id) && !(it.pop && it.pop.t < 1) && Math.hypot(S.px - it.x, (S.py - it.y) * 1.2) < 12) collect(it);
  for (const it of A.items) if (it.pop && it.pop.t < 1) it.pop.t = Math.min(1, it.pop.t + dt * 1.4);
  // what can we talk to?
  S.target = null;
  if (S.mode === 'play' && !S.dlg && !S.trans) { let best = 1e9; for (const o of interactables()) { const d = Math.hypot(S.px - o.x, (S.py - o.y) * 1.2); if (d < o.range && d < best) { best = d; S.target = o; } } }
  // rustling plants, NPCs turning to look at you
  for (const p of A.props) { if (p.rustle) p.rustle = Math.max(0, p.rustle - dt * 2.2);
    if ((p.k === 'bush' || p.k === 'fern' || p.k === 'flowers' || p.k === 'reeds' || p.k === 'leafpile') && S.moving && Math.hypot(S.px - p.x, S.py - p.y) < 20) p.rustle = 1; }
  for (const nid of A.npcs) { const n = NPCS[nid]; if (n.front) continue; const want = Math.hypot(S.px - n.x, S.py - n.y) < 90 ? (S.px > n.x ? 1 : -1) : 1; n.flip = n.flip == null ? 1 : n.flip; n.flip += Math.sign(want - n.flip) * Math.min(Math.abs(want - n.flip), dt * 7); }
  if (S.bounceT > 0) S.bounceT = Math.max(0, S.bounceT - dt * 1.1);
  // camera
  const c = camTarget(), k = Math.min(1, dt * 6); S.camX += (c[0] - S.camX) * k; S.camY += (c[1] - S.camY) * k;
  // effects
  S.hud = Math.max(0, S.hud - dt * 2.5);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > 3) S.banner = null; }
  S.toasts.forEach(q => q.t += dt); S.toasts = S.toasts.filter(q => q.t < 3.2);
  S.floaters.forEach(f => { f.t += dt; }); S.floaters = S.floaters.filter(f => f.t < 1.1);
  S.sparks.forEach(f => { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= 90 * dt; }); S.sparks = S.sparks.filter(f => f.t < 1);
  for (const q of S.confetti) { q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; q.vx += Math.sin(S.t * 2 + q.r) * 10 * dt; }
  S.confetti = S.confetti.filter(q => q.y < VH + 10);
}


// ================================================================ 3D
let R = null;
try { R = new THREE.WebGLRenderer({ canvas: glc, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }); } catch (e) { R = null; }
const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
// quality tiers: 2 high (shadows 2048, bloom x2, tilt-shift), 1 med (shadows 1024, bloom, tilt-shift), 0 low (blob shadows only, no post blur/bloom)
const Q = { tier: 2, forced: null };
{ const q = QS.get('q'); if (q in { low: 1, med: 1, high: 1 }) Q.forced = Q.tier = { low: 0, med: 1, high: 2 }[q]; }
if (Q.forced == null && COARSE) Q.tier = 1;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1, 20, 4000);
let PITCH = .66, CAMD = 400; const camOff = { zb: 120, zt: -200, hw: 150 };
function placeCam(x, z) { cam.position.set(x, Math.sin(PITCH) * CAMD, z + Math.cos(PITCH) * CAMD); cam.lookAt(x, 0, z); cam.updateMatrixWorld(); }
function setupCamera() {
  const asp = IW / IH, portrait = asp < .8; cam.aspect = asp;
  PITCH = portrait ? .84 : .62; cam.fov = portrait ? 30 : 26;
  const tv = Math.tan(cam.fov * Math.PI / 360), wantW = SHOT ? 300 : portrait ? 164 : 300;
  CAMD = Math.max(wantW / (2 * tv * asp), SHOT ? 0 : 230 * Math.sin(PITCH) / (2 * tv));
  cam.updateProjectionMatrix(); placeCam(0, 0);
  const hit = (nx, ny) => { const v = new THREE.Vector3(nx, ny, .5).unproject(cam).sub(cam.position).normalize(); if (v.y >= -.01) return null; const t = -cam.position.y / v.y; return cam.position.clone().addScaledVector(v, t); };
  const b = hit(0, -1), t = hit(0, 1), m = hit(1, 0);
  camOff.zb = b ? b.z : 150; camOff.zt = t ? t.z : -600; camOff.hw = m ? m.x : 150;
  FXMAT && (FXMAT.uniforms.uPx.value = IH / (2 * tv));
}
function camTarget() {
  const A = S.A, hw = camOff.hw;
  const tx = A.w <= hw * 2 - 30 ? A.w / 2 : clamp(S.px, hw - 15, A.w - hw + 15);
  const portrait = IW < IH * .8, zmax = A.h + (portrait ? 92 : 30) - camOff.zb, zmin = GT - 150 - camOff.zt;
  let tz = SHOT ? 178 : clamp(S.py - (portrait ? 30 : 12), zmin, zmax); if (zmin > zmax) tz = zmax;
  return [SHOT ? 214 : tx, tz];
}

// ---------------------------------------------------------------- textures, billboards
function tex(c, rep, linear) { const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps = false; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const GEO = new Map();
function bbGeo(c) {    // upright quad, origin at the foot; normals lean up so sprites catch the sun from above
  const key = c.width + 'x' + c.height + '@' + c.ax + ',' + c.ay; let g = GEO.get(key); if (g) return g;
  g = new THREE.PlaneGeometry(c.width * U, c.height * U);
  g.translate((c.width / 2 - c.ax) * U, ((c.ay + 1) - c.height / 2) * U, 0);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, .5, .866);
  GEO.set(key, g); return g;
}
const MATS = [];
function spriteMat(t, o = {}) {
  const m = new THREE.MeshLambertMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide });
  if (o.glow) { m.emissive = new THREE.Color(o.glow); m.emissiveMap = t; m.emissiveIntensity = o.gi || .6; }
  MATS.push(m); return m;
}
function bb(c, o = {}) {
  const t = c.tex || (c.tex = tex(c));
  const m = new THREE.Mesh(bbGeo(c), spriteMat(t, o));
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5 });
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  return m;
}
function setFrame(m, c) { if (!c.tex) c.tex = tex(c); if (m.material.map !== c.tex) { m.material.map = c.tex; m.customDepthMaterial.map = c.tex; if (m.material.emissiveMap) m.material.emissiveMap = c.tex; } }
const SPRC = new Map();
function cached(key, f) { let c = SPRC.get(key); if (!c) { c = f(); SPRC.set(key, c); } return c; }
const heroFrames = {}; for (const d of ['down', 'up', 'side']) for (let f = 0; f < 4; f++) for (const b of [0, 1]) heroFrames[d + f + b] = paintHero(d, f, b);
const critFrames = k => cached('crit|' + k, () => [0, 1].flatMap(f => [0, 1].map(b => CRIT[k](f, b))));
const ACORN = paintAcorn(), GLEAF = paintGoldLeaf();

// soft round blob + glow textures (linear filtered on purpose: light, not pixels)
function radialTex(stops, size = 64) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(s => rg.addColorStop(s[0], s[1])); g.fillStyle = rg; g.fillRect(0, 0, size, size); return tex(c, false, true); }
const BLOB = radialTex([[0, 'rgba(20,8,24,.55)'], [.6, 'rgba(20,8,24,.3)'], [1, 'rgba(20,8,24,0)']], 32);
const POOL = radialTex([[0, 'rgba(255,220,150,1)'], [.5, 'rgba(255,200,120,.45)'], [1, 'rgba(255,190,110,0)']]);
const GLOWT = radialTex([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
const BEAMT = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(.3, 'rgba(255,255,255,.5)'); h.addColorStop(.5, 'rgba(255,255,255,1)'); h.addColorStop(.7, 'rgba(255,255,255,.5)'); h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.25, 'rgba(0,0,0,.8)'); v.addColorStop(.85, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256); return tex(c, false, true); })();
const MISTC = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'), r = rng(11);
  for (let i = 0; i < 18; i++) { const x = r() * 256, y = 26 + r() * 18, rx = 26 + r() * 40; for (const dx of [-256, 0, 256]) { g.save(); g.translate(x + dx, y); g.scale(1, .35); const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx); rg.addColorStop(0, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore(); } }
  return c; })();

// ---------------------------------------------------------------- noise & terrain
const hash2 = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi, s), hash2(xi + 1, yi, s), u), lerp(hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s), u), v); }
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const WATER_Y = -3, CLIFF_Z = GT - 8, CLIFF_D = 40;
function hAt(A, x, z) {
  if (A.id === 'stream' && z > GT - 30) { const d = Math.abs(x - streamX(z)); if (d < STREAM_HW + 3) return -9 * (1 - smooth((d - (STREAM_HW - 5)) / 8)); }
  if (A.id === 'glade') { const e = Math.hypot((x - 128) / 1.25, z - 168); if (e < 37) return -7 * (1 - smooth((e - 28) / 9)); }
  return (vnoise(x * .025, z * .025, 3) - .5) * 2.4;
}
function standY(A, x, z) {   // height of whatever the hero stands on
  for (const s of A.stones) if (Math.hypot(x - s.x, (z - s.y) * 1.15) < s.r + 2) return s.hidden ? WATER_Y - .8 : WATER_Y + 1.6;
  if (A.island && Math.hypot(x - A.island.x, (z - A.island.y) * 1.3) < A.island.r + 3) return .6;
  return hAt(A, x, z);
}
function pathDist(A, x, z) { let d = 1e9; for (const pl of A.paths) for (let i = 1; i < pl.length; i++) d = Math.min(d, distSeg(x, z, pl[i - 1], pl[i])); return d; }

function groundTexture(A, X0, Z0, TW, TH) {
  const ap = A.ap, p = new Pix(TW, TH), r = rng(A.w * 7 + A.id.length);
  const G1 = pal(ap.ground, 6, .5, .25), G2 = pal(ap.ground2, 6, .5, .25), PP = pal(ap.path, 5, .35, .3), BED = pal('#5a4630', 4, .5, .2), BANK = pal('#4a3420', 3, .4, .2);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const x = X0 + (i + .5) * U, z = Z0 + (j + .5) * U;
    const n = vnoise(x * .03, z * .03, 1), n2 = vnoise(x * .11, z * .11, 2), patch = vnoise(x * .014 + 9, z * .014, 5);
    let v = .3 + n * .42 + n2 * .22; if (z < GT + 34) v -= (GT + 34 - z) / 34 * .3; if (z > A.h + 2) v -= .15;
    let c = p.shadeOf(patch > .58 ? G2 : G1, clamp(v, 0, 1), i, j);
    const pd = pathDist(A, x, z);
    if (pd < 13.5) c = pd > 11.5 ? p.shadeOf(PP, .15, i, j) : p.shadeOf(PP, clamp(.55 + n2 * .35 - pd / 40, 0, 1), i, j);
    if (A.water) { const wat = A.water(x, z) || (A.id === 'glade' && Math.hypot((x - 128) / 1.25, z - 168) < 36); const near = !wat && (A.water(x + 5, z) || A.water(x - 5, z) || A.water(x, z + 5) || A.water(x, z - 5));
      if (wat) c = p.shadeOf(BED, clamp(.3 + n2 * .6, 0, 1), i, j); else if (near) c = p.shadeOf(BANK, n2, i, j); }
    p.set(i, j, c);
  }
  const toT = (x, z) => [Math.floor((x - X0) / U), Math.floor((z - Z0) / U)];
  const wet = (x, z) => A.water && A.water(x, z);
  // grass tufts
  for (let k = 0; k < TW * TH / 60; k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (pathDist(A, x, z) < 13 || wet(x, z)) continue; const [i, j] = toT(x, z), base = p.col(clamp(i, 0, TW - 1), clamp(j, 0, TH - 1));
    const d = dark(base, .35), l = lite(base, .25); p.set(i, j, d); p.set(i - 1, j - 1, d); p.set(i + 1, j - 1, d); p.set(i, j - 1, l); p.set(i, j - 2, l); }
  // fallen leaves: drifts + scatter, a few asters
  for (let k = 0; k < 16; k++) { const cx = X0 + r() * TW * U, cz = GT + 10 + r() * (A.h - GT); for (let q = 0; q < 40; q++) { const a = r() * TAU, d = Math.sqrt(r()) * 24, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * .55; if (wet(x, z)) continue; const [i, j] = toT(x, z), c = AUT[(r() * AUT.length) | 0]; p.set(i, j, c); p.set(i + 1, j, dark(c, .2)); if (r() < .5) p.set(i, j - 1, lite(c, .2)); } }
  for (let k = 0; k < TW * TH / 50; k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (wet(x, z)) continue; const [i, j] = toT(x, z), c = AUT[(r() * AUT.length) | 0]; p.set(i, j, c); if (r() < .6) p.set(i + 1, j, dark(c, .25)); }
  for (let k = 0; k < TW * TH / 900; k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (wet(x, z) || pathDist(A, x, z) < 14) continue; const [i, j] = toT(x, z), c = ['#9a6fc0', '#f2b63c', '#fff0d8'][k % 3]; p.set(i, j, c); p.set(i - 1, j, c); p.set(i + 1, j, c); p.set(i, j - 1, c); p.set(i, j + 1, '#6e7a34'); }
  return p.done({ outline: false });
}
function tileTex(kind, ap) {   // 32x32 repeating pixel tiles for the cliffs
  return cached('tile|' + kind + '|' + ap.ground, () => {
    const p = new Pix(32, 32), r = rng(kind === 'rock' ? 5 : 9);
    if (kind === 'rock') { const RK = pal('#7a6a62', 6, .55, .3);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const band = Math.floor((j + Math.floor(vnoise(i * .2, 0, 4) * 4)) / 8), v = .35 + vnoise(i * .25 + band * 7, j * .25, 6) * .45 - ((j % 8) === 7 ? .3 : 0) + ((j % 8) === 0 ? .15 : 0); p.set(i, j, p.shadeOf(RK, clamp(v, 0, 1), i, j)); }
      for (let k = 0; k < 14; k++) { const i = r() * 32 | 0, j = r() * 32 | 0; p.set(i, j, ['#7a8a34', '#5a6a2a', '#c4542f', '#e08a2a'][k % 4]); }
    } else { const G1 = pal(ap.ground, 5, .5, .2);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, p.shadeOf(G1, clamp(.25 + vnoise(i * .3, j * .3, 8) * .5, 0, 1), i, j));
      for (let k = 0; k < 40; k++) { const i = r() * 32 | 0, j = r() * 32 | 0; p.set(i, j, AUT[k % AUT.length]); }
    }
    return p.done({ outline: false });
  });
}

// ---------------------------------------------------------------- shaders
const FSV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const WATER_V = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const WATER_F = `uniform float uT; uniform float uFlow; uniform vec3 cDeep; uniform vec3 cMid; uniform vec3 cHi; varying vec3 vW;
void main(){ vec2 p = floor(vW.xz / ${U.toFixed(2)}) * ${U.toFixed(2)};
  float w1 = sin(p.x * .31 + p.y * .07 - uT * 1.3 * (1.0 - uFlow)) ;
  float w2 = sin(p.y * .19 - uT * 2.8 * uFlow + sin(p.x * .13 + uT * .7) * 1.6);
  float w3 = sin((p.x + p.y) * .09 + uT * .9);
  float k = w1 * .3 + w2 * .5 + w3 * .2;
  vec3 c = mix(cDeep, cMid, .5 + .5 * w3);
  c = mix(c, cHi, step(.62, k) * .75);
  c += step(.86, k) * .25;
  gl_FragColor = vec4(c, .8); }`;
const FALLS_F = `uniform float uT; varying vec2 vUv; void main(){ vec2 p = floor(vUv * vec2(26.0, 40.0)) / vec2(26.0, 40.0);
  float s = sin(p.x * 61.0) * .5 + .5; float f = fract(p.y * 2.0 + uT * (1.2 + s * .8) + s * 3.0);
  vec3 c = mix(vec3(.24,.52,.66), vec3(.62,.86,.94), step(.55, f)); c = mix(c, vec3(1.0,.98,.92), step(.86, f));
  c = mix(c, vec3(1.0), smoothstep(.12, .0, p.y) * .8); gl_FragColor = vec4(c, .92); }`;
const BRIGHT_F = `uniform sampler2D t; uniform vec2 px; uniform float th; varying vec2 vUv;
void main(){ vec3 c = (texture2D(t, vUv + px * vec2(-.5,-.5)).rgb + texture2D(t, vUv + px * vec2(.5,-.5)).rgb + texture2D(t, vUv + px * vec2(-.5,.5)).rgb + texture2D(t, vUv + px * vec2(.5,.5)).rgb) * .25;
  float b = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .22, b), 1.0); }`;
const BLUR_F = `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 c = texture2D(t, vUv).rgb * .227;
  c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * .316;
  c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * .07;
  gl_FragColor = vec4(c, 1.0); }`;
const COMP_F = `uniform sampler2D tS; uniform sampler2D tB; uniform vec2 res; uniform float uBloom; uniform float uDof; uniform vec3 shTint; uniform vec3 hiTint; uniform float uT; uniform float uFade; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tS, vUv).rgb;
#ifdef DOF
  // tilt-shift: a sharp horizontal band, blur growing toward the top and bottom of the frame
  float d = max(smoothstep(.62, .98, vUv.y) * 1.25, smoothstep(.3, .02, vUv.y));
  float r = d * uDof;
  if (r > .35) {
    vec3 acc = c; float n = 1.0;
    for (int i = 0; i < 12; i++) { float fi = float(i); float a = fi * 2.39996; float rr = sqrt((fi + .5) / 12.0) * r;
      acc += texture2D(tS, vUv + vec2(cos(a), sin(a)) * rr / res).rgb; n += 1.0; }
    c = acc / n;
  }
#endif
#ifdef BLOOM
  c += texture2D(tB, vUv).rgb * uBloom;
#endif
  // grade: violet in the shadows, warm gold in the highlights, a touch of contrast
  float l = dot(c, vec3(.299, .587, .114));
  c = mix(c * shTint, c, smoothstep(.0, .62, l));
  c += hiTint * smoothstep(.45, 1.0, l) * .12;
  c = (c - .5) * 1.06 + .5;
  c = mix(vec3(l), c, 1.18);
  vec2 q = (vUv - .5) * vec2(1.0, 1.15); c *= 1.0 - .45 * pow(clamp(length(q) * 1.25, 0.0, 1.0), 2.6);
  c = mix(c, vec3(.08, .04, .1), uFade);
  gl_FragColor = vec4(c, 1.0); }`;
const FX_V = `attribute vec4 aCol; attribute float aSize; uniform float uPx; varying vec4 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, floor(aSize * uPx / -mv.z + .5)); vC = aCol; }`;
const FX_F = 'varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb, vC.a); }';

// ---------------------------------------------------------------- lights, shared objects
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.35); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.camera.left = -330; sun.shadow.camera.right = 330; sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300; sun.shadow.camera.near = 10; sun.shadow.camera.far = 1200;
sun.shadow.bias = -.0012; sun.shadow.normalBias = .6;
const NPL = 6, PL = []; for (let i = 0; i < NPL; i++) { const l = new THREE.PointLight(0xffaa55, 0, 110, 1.6); PL.push(l); scene.add(l); }
const hero = bb(heroFrames.down00); scene.add(hero);
const blobMat = new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function blob(w, d) { const m = new THREE.Mesh(blobGeo, blobMat); m.scale.set(w, 1, d); m.renderOrder = 1; return m; }
const heroBlob = blob(22, 10); scene.add(heroBlob);
// FX points: fireflies, motes in the beams, secret sparkles, pickup bursts (one draw call)
const FXN = 640, fxPos = new Float32Array(FXN * 3), fxCol = new Float32Array(FXN * 4), fxSize = new Float32Array(FXN);
const fxGeo = new THREE.BufferGeometry(); fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxGeo.setAttribute('aCol', new THREE.BufferAttribute(fxCol, 4)); fxGeo.setAttribute('aSize', new THREE.BufferAttribute(fxSize, 1));
const FXMAT = new THREE.ShaderMaterial({ vertexShader: FX_V, fragmentShader: FX_F, uniforms: { uPx: { value: 800 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const fx = new THREE.Points(fxGeo, FXMAT); fx.frustumCulled = false; fx.renderOrder = 5; scene.add(fx);
let fxN = 0;
function fxAdd(x, y, z, c, a, s) { if (fxN >= FXN) return; const i = fxN++; fxPos[i * 3] = x; fxPos[i * 3 + 1] = y; fxPos[i * 3 + 2] = z; c = rgb(c); fxCol[i * 4] = c[0] / 255; fxCol[i * 4 + 1] = c[1] / 255; fxCol[i * 4 + 2] = c[2] / 255; fxCol[i * 4 + 3] = a; fxSize[i] = s; }
// falling pixel leaves
const LEAFN = 56, leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(5 * U, 4 * U), new THREE.MeshBasicMaterial({ map: tex(paintLeafBit()), alphaTest: .5, side: THREE.DoubleSide }), LEAFN);
leafMesh.frustumCulled = false; scene.add(leafMesh);
const LEAVES3 = []; { const col = new THREE.Color(); for (let i = 0; i < LEAFN; i++) { LEAVES3.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, rx: Math.random() * TAU, ry: Math.random() * TAU, rz: 0, sp: 1 + Math.random() * 2, ph: Math.random() * TAU }); leafMesh.setColorAt(i, col.set(AUT[i % AUT.length])); } }
const dummy = new THREE.Object3D();

// ---------------------------------------------------------------- area dioramas (built on first visit)
const W3 = {};
function waterMat(flow) { return new THREE.ShaderMaterial({ vertexShader: WATER_V, fragmentShader: WATER_F, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uFlow: { value: flow }, cDeep: { value: new THREE.Color('#1e4a66') }, cMid: { value: new THREE.Color('#2e6e88') }, cHi: { value: new THREE.Color('#9ad0d8') } } }); }
function build3D(A) {
  const G = new THREE.Group(), ap = A.ap, out = { G, props: [], items: {}, npcs: {}, beams: [], lights: [], water: [], mist: [] };
  const r = rng(A.w + A.id.charCodeAt(1) * 31);
  // terrain heightfield with a painted pixel texture
  const X0 = -90, X1 = A.w + 90, Z0 = GT - 24, Z1 = A.h + 110, TW = Math.round((X1 - X0) / U), TH = Math.round((Z1 - Z0) / U);
  const gg = new THREE.PlaneGeometry(TW * U, TH * U, Math.round(TW * U / 5), Math.round(TH * U / 5)); gg.rotateX(-Math.PI / 2); gg.translate(X0 + TW * U / 2, 0, Z0 + TH * U / 2);
  const gp = gg.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, hAt(A, gp.getX(i), gp.getZ(i))); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ map: tex(groundTexture(A, X0, Z0, TW, TH)) })); ground.receiveShadow = true; MATS.push(ground.material); G.add(ground);
  // the back cliff: stepped rock blocks with gaps for north exits and the waterfall, a plateau behind
  const gaps = A.exits.filter(e => e.e === 'n').map(e => [e.a - 4, e.b + 4, true]); if (A.id === 'stream') gaps.push([streamX(GT) - STREAM_HW - 2, streamX(GT) + STREAM_HW + 2, false]);
  const CH_ = 34, sides = [], tops = [], uvS = [], uvT = [];
  const quad = (arr, uv, a, b, c, d, ua, ub, uc, ud) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
  const T = 32 * U;
  const box = (x0, x1, y1, z0, z1) => {
    quad(sides, uvS, [x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1], [x0 / T, 0], [x1 / T, 0], [x1 / T, y1 / T], [x0 / T, y1 / T]);
    quad(sides, uvS, [x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0], [z0 / T, 0], [z1 / T, 0], [z1 / T, y1 / T], [z0 / T, y1 / T]);
    quad(sides, uvS, [x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1], [z1 / T, 0], [z0 / T, 0], [z0 / T, y1 / T], [z1 / T, y1 / T]);
    quad(tops, uvT, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [x0 / T, -z1 / T], [x1 / T, -z1 / T], [x1 / T, -z0 / T], [x0 / T, -z0 / T]);
  };
  for (let x = -200; x < A.w + 200;) {
    const w = 18 + r() * 16, x1 = Math.min(x + w, A.w + 200);
    const g = gaps.find(q => x1 > q[0] && x < q[1]);
    if (g) { if (x < g[0]) box(x, g[0], CH_ - 2 + r() * 8, CLIFF_Z - CLIFF_D, CLIFF_Z); x = g[1]; continue; }
    box(x, x1, CH_ - 4 + Math.round(r() * 3) * 4, CLIFF_Z - CLIFF_D, CLIFF_Z);
    if (r() < .45) box(x + 2, x1 - 2, 8 + Math.round(r() * 2) * 4, CLIFF_Z - 4, CLIFF_Z + 5);   // a lower step
    x = x1;
  }
  for (const g of gaps) if (g[2]) {   // ramps up through the gaps
    quad(tops, uvT, [g[0], .2, CLIFF_Z + 4], [g[1], .2, CLIFF_Z + 4], [g[1], CH_, CLIFF_Z - CLIFF_D], [g[0], CH_, CLIFF_Z - CLIFF_D], [g[0] / T, 0], [g[1] / T, 0], [g[1] / T, 1.4], [g[0] / T, 1.4]);
  }
  const mkGeo = (pos, uv) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
  const rockM = new THREE.MeshLambertMaterial({ map: tex(tileTex('rock', ap), true) }), topM = new THREE.MeshLambertMaterial({ map: tex(tileTex('top', ap), true) }); MATS.push(rockM, topM);
  const cliffS = new THREE.Mesh(mkGeo(sides, uvS), rockM), cliffT = new THREE.Mesh(mkGeo(tops, uvT), topM);
  for (const m of [cliffS, cliffT]) { m.castShadow = m.receiveShadow = true; G.add(m); }
  const ptx = tex(tileTex('top', ap), true); ptx.repeat.set((A.w + 1400) / T, 800 / T); const pM = new THREE.MeshLambertMaterial({ map: ptx }); MATS.push(pM);
  const plateau = new THREE.Mesh(new THREE.PlaneGeometry(A.w + 1400, 800).rotateX(-Math.PI / 2).translate(A.w / 2, CH_ - 1, CLIFF_Z - CLIFF_D - 398), pM); plateau.receiveShadow = true; G.add(plateau);
  // backdrop forest on the plateau (fog fades it into the haze)
  const bt = []; for (let i = 0; i < 6; i++) bt.push(paintTree({ seed: 900 + i, pal: ap.trees[i % ap.trees.length] }));
  for (let i = 0; i < 70; i++) { const c = bt[i % bt.length], m = bb(c, { recv: false }); const z = CLIFF_Z - CLIFF_D - 6 - r() * 330, s = 1.1 + r() * .9 + (CLIFF_Z - z) / 300; m.position.set(-260 + r() * (A.w + 520), CH_ - 1, z); m.scale.setScalar(s); m.castShadow = z > CLIFF_Z - CLIFF_D - 60; G.add(m); }
  // water
  if (A.id === 'stream') {
    const pos = [], idx = []; let n = 0;
    for (let z = GT - 30; z <= A.h + 110; z += 6) { pos.push(streamX(z) - STREAM_HW - 1, WATER_Y, z, streamX(z) + STREAM_HW + 1, WATER_Y, z); if (n) idx.push(n - 2, n, n - 1, n - 1, n, n + 1); n += 2; }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setIndex(idx);
    const wm = waterMat(1); out.water.push(wm); const wmesh = new THREE.Mesh(wg, wm); wmesh.renderOrder = 2; G.add(wmesh);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(STREAM_HW * 2 - 6, 420).rotateX(-Math.PI / 2).translate(streamX(GT), CH_ + .3, CLIFF_Z - CLIFF_D - 210 + 4), wm); G.add(top);
    const fm = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FALLS_F, transparent: true, uniforms: { uT: { value: 0 } } });
    out.water.push(fm); const falls = new THREE.Mesh(new THREE.PlaneGeometry(STREAM_HW * 2 + 2, CH_ - WATER_Y + 1), fm); falls.position.set(streamX(GT), (CH_ + WATER_Y) / 2, CLIFF_Z - 14); G.add(falls);
    for (const s of A.stones) { const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r * .95, s.r * 1.05, 6, 9), new THREE.MeshLambertMaterial({ color: s.hidden ? '#7a9494' : '#8e887c', flatShading: true })); m.position.set(s.x, (s.hidden ? WATER_Y - .8 : WATER_Y + 1.6) - 3, s.y); m.scale.z = .85; m.castShadow = m.receiveShadow = true; MATS.push(m.material); G.add(m); }
    const I = A.island, isl = new THREE.Mesh(new THREE.CylinderGeometry(I.r + 1, I.r + 4, 10, 12), new THREE.MeshLambertMaterial({ color: '#8a7a3a', flatShading: true })); isl.position.set(I.x, -4.4, I.y); isl.scale.z = .8; isl.receiveShadow = true; MATS.push(isl.material); G.add(isl);
  }
  if (A.id === 'glade') { const wm = waterMat(0); out.water.push(wm); const pond = new THREE.Mesh(new THREE.CircleGeometry(36, 28).rotateX(-Math.PI / 2), wm); pond.scale.x = 1.25; pond.position.set(128, -2.5, 168); pond.renderOrder = 2; G.add(pond); }
  // props
  for (const p of A.props) {
    if (p.k === 'stone') continue;
    const d = PROPDEF[p.k];
    const c = cached('p|' + p.k + '|' + (p.pal || '') + '|' + (p.seed || 0) + '|' + (p.s || 1) + '|' + (p.cap || '') + '|' + (p.c || '') + '|' + (p.berries === false ? 0 : 1), () => d.paint(p));
    let m;
    if (d.low) { m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * U, c.height * U).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: c.tex || (c.tex = tex(c)), alphaTest: .5 })); MATS.push(m.material); m.position.set(p.x, WATER_Y + .25, p.y); m.receiveShadow = true; }
    else { m = bb(c, { glow: p.glow, gi: .32 }); m.position.set(p.x, hAt(A, p.x, p.y) - .5, p.y); if (p.k === 'leafpile' || p.k === 'flowers') m.castShadow = false; }
    m.userData.p = p; G.add(m); out.props.push(m);
    if (p.glow) out.lights.push({ x: p.x, y: 14 * (p.s || 1), z: p.y + 4, c: p.glow, i: 260 * (p.s || 1), flick: .1 });
    if (d.light) out.lights.push({ x: p.x, y: 24, z: p.y + 3, c: d.light[0], i: 300, flick: .25 });
  }
  if (A.id === 'hollow') out.lights.push({ x: 240, y: 14, z: 186, c: '#ff9a3a', i: 650, flick: .2 });
  if (A.id === 'glade') out.lights.push({ x: 268, y: 22, z: 160, c: '#ffd86a', i: 420, flick: .05 });
  // items
  for (const it of A.items) { const m = bb(it.type === 'acorn' ? ACORN : GLEAF, { glow: it.type === 'leaf' ? '#ffd040' : null, gi: .7 }); const b = blob(10, 5); G.add(m, b); out.items[it.id] = { m, b }; }
  // NPCs
  for (const nid of A.npcs) { const n = NPCS[nid], fr = critFrames(n.kind), m = bb(fr[0]), b = blob(n.kind === 'owl' ? 18 : 22, 9); G.add(m, b); out.npcs[nid] = { m, b, fr }; }
  // god rays: tall additive shafts slanting down from the canopy to the ground, plus warm pools where they land
  for (const b of A.beams) {
    const ex = clamp(b.x0 - Math.sin(b.a) * b.L, 20, A.w - 20), ez = clamp(-60 + Math.cos(b.a) * b.L, GT + 30, A.h - 10);
    const Tp = new THREE.Vector3(ex + 120, 230, ez - 90), Bp = new THREE.Vector3(ex, hAt(A, ex, ez), ez), w = b.w * .8;
    const dir = Bp.clone().sub(Tp).normalize(), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
    const mk = off => { const g = new THREE.BufferGeometry(), t1 = off.clone().multiplyScalar(1.5);
      g.setAttribute('position', new THREE.Float32BufferAttribute([...Tp.clone().sub(t1).toArray(), ...Tp.clone().add(t1).toArray(), ...Bp.clone().add(off).toArray(), ...Bp.clone().sub(off).toArray()], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); g.setIndex([0, 2, 1, 0, 3, 2]); return g; };
    const mat = new THREE.MeshBasicMaterial({ map: BEAMT, color: ap.sun, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, opacity: .3 });
    const q1 = new THREE.Mesh(mk(new THREE.Vector3(w / 2, 0, 0)), mat), q2 = new THREE.Mesh(mk(new THREE.Vector3(w * .3, 0, 0)), mat); q2.position.z = -14; q2.position.x = 6;
    const pm = new THREE.MeshBasicMaterial({ map: POOL, color: ap.sun, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: .5 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.1, w * 1.1).rotateX(-Math.PI / 2), pm); pool.position.set(ex + 4, Bp.y + .6, ez - 2);
    for (const q of [q1, q2, pool]) { q.renderOrder = 4; G.add(q); }
    out.beams.push({ b, Tp, Bp, w, mat, pm, dust: Array.from({ length: 12 }, () => ({ u: Math.random(), v: Math.random() - .5, s: Math.random() - .5, sp: .02 + Math.random() * .03, ph: Math.random() * TAU })) });
  }
  // drifting ground mist (vertical sheets at a few depths: parallax for free)
  for (const [z, y, h, a] of [[GT + 26, 9, 34, .32], [A.h * .52, 6, 26, .18], [A.h + 6, 6, 30, .22], [CLIFF_Z - CLIFF_D - 70, CH_ + 14, 70, .5], [CLIFF_Z - CLIFF_D - 200, CH_ + 30, 120, .55]]) {
    const t = tex(MISTC, true, true); t.repeat.set(4, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, h), new THREE.MeshBasicMaterial({ map: t, color: ap.mist, transparent: true, opacity: a, depthWrite: false, fog: z < 0 }));
    m.position.set(A.w / 2, y, z); m.renderOrder = 3; G.add(m); out.mist.push({ m, t, sp: .004 + Math.random() * .006 });
  }
  // fireflies
  out.flies = Array.from({ length: ap.fireflies }, () => ({ x: 20 + r() * (A.w - 40), y: 6 + r() * 34, z: GT + 20 + r() * (A.h - GT - 30), ph: r() * TAU, sp: .3 + r() * .5 }));
  G.visible = false; scene.add(G);
  return out;
}

// ---------------------------------------------------------------- post-processing
const RTO = { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtS = new THREE.WebGLRenderTarget(1, 1, { stencilBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtB = [new THREE.WebGLRenderTarget(1, 1, RTO), new THREE.WebGLRenderTarget(1, 1, RTO), new THREE.WebGLRenderTarget(1, 1, RTO), new THREE.WebGLRenderTarget(1, 1, RTO)];
const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); fsGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new THREE.Mesh(fsGeo); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
const sm = (f, u, defs) => new THREE.ShaderMaterial({ vertexShader: FSV, fragmentShader: f, uniforms: u, defines: defs || {}, depthTest: false, depthWrite: false });
const brightM = sm(BRIGHT_F, { t: { value: null }, px: { value: new THREE.Vector2() }, th: { value: .74 } });
const blurM = sm(BLUR_F, { t: { value: null }, dir: { value: new THREE.Vector2() } });
const compU = () => ({ tS: { value: rtS.texture }, tB: { value: null }, res: { value: new THREE.Vector2() }, uBloom: { value: 1 }, uDof: { value: 3.2 }, shTint: { value: new THREE.Vector3(.7, .6, 1) }, hiTint: { value: new THREE.Vector3(1, .8, .5) }, uT: { value: 0 }, uFade: { value: 0 } });
const COMP = [sm(COMP_F, compU()), sm(COMP_F, compU(), { BLOOM: 1, DOF: 1 }), sm(COMP_F, compU(), { BLOOM: 1, DOF: 1 })];
function pass(m, target) { fsMesh.material = m; R.setRenderTarget(target); R.render(fsScene, fsCam); }
function sizeTargets() { rtS.setSize(IW, IH); const bw = Math.max(8, IW >> 2), bh = Math.max(8, IH >> 2); rtB[0].setSize(bw, bh); rtB[1].setSize(bw, bh); rtB[2].setSize(Math.max(4, bw >> 1), Math.max(4, bh >> 1)); rtB[3].setSize(Math.max(4, bw >> 1), Math.max(4, bh >> 1)); }
function applyTier() {
  const t = Q.tier, sh = t >= 1;
  if (R.shadowMap.enabled !== sh) { R.shadowMap.enabled = sh; MATS.forEach(m => m.needsUpdate = true); for (const k in W3) W3[k].G.traverse(o => { if (o.material) o.material.needsUpdate = true; }); hero.material.needsUpdate = true; }
  const ms = t === 2 && !COARSE ? 2048 : 1024; if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
}

// ---------------------------------------------------------------- per-frame 3D update
let curW = null;
function onEnterArea(A) {
  if (!R) return;
  if (!W3[A.id]) W3[A.id] = build3D(A);
  for (const k in W3) W3[k].G.visible = k === A.id;
  curW = W3[A.id]; const ap = A.ap;
  scene.background = new THREE.Color(ap.sky[1]); scene.fog = new THREE.Fog(ap.fog, CAMD * .9, CAMD * 2.4);
  skyTex(ap);
  hemi.color.set(ap.hemi[0]); hemi.groundColor.set(ap.hemi[1]); sun.color.set(ap.sun);
  sun.position.set(A.w / 2 - 200, 330, A.h / 2 + 260); sun.target.position.set(A.w / 2, 0, A.h / 2 - 20);
  const ls = curW.lights.slice(0, NPL - 2);
  PL.forEach((l, i) => { const q = ls[i]; l.userData = q || null; if (q) { l.position.set(q.x, q.y, q.z); l.color.set(q.c); } l.intensity = 0; });
  for (const c of COMP) { c.uniforms.shTint.value.fromArray(ap.grade[0]); c.uniforms.hiTint.value.fromArray(ap.grade[1]); }
  for (const l of LEAVES3) l.y = -999;
}
function skyTex(ap) {   // a vertical gradient behind everything
  const c = document.createElement('canvas'); c.width = 2; c.height = 128; const g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, ap.sky[1]); lg.addColorStop(.55, ap.sky[0]); lg.addColorStop(1, ap.fog); g.fillStyle = lg; g.fillRect(0, 0, 2, 128);
  const t = tex(c, false, true); scene.background = t;
}
function beamLight(x, z) { let k = 0; if (!curW) return 0; for (const B of curW.beams) { const dx = Math.abs(x - (B.Bp.x + 8)) / (B.w * .5), dz = Math.abs(z - (B.Bp.z - 5)) / 18; if (dx < 1 && dz < 1) k = Math.max(k, (1 - dx) * (1 - dz * .6)); } return k; }
function update3D(dt) {
  const A = S.A, W = curW, t = S.t;
  placeCam(S.camX, S.camY);
  // hero
  const f = S.moving ? Math.floor(S.walk * 9) % 4 : 0, blink = (t % 3.9) < .13 ? 1 : 0;
  setFrame(hero, heroFrames[S.dir + f + blink]);
  const hy = standY(A, S.px, S.py);
  hero.position.set(S.px, hy - .4, S.py); hero.scale.x = S.dir === 'side' && S.facing < 0 ? -1 : 1;
  heroBlob.position.set(S.px, hy + .15, S.py + 1); heroBlob.visible = S.mode !== 'title' || true;
  const hl = beamLight(S.px, S.py) * A.ap.rays; hero.material.emissive.setRGB(.3 * hl, .22 * hl, .1 * hl);
  // NPCs
  for (const nid in W.npcs) {
    const n = NPCS[nid], o = W.npcs[nid], fr = o.fr, idle = Math.floor(t * 1.7 + n.x) % 2, bl = ((t + n.x * .37) % 4.3) < .14 ? 1 : 0;
    setFrame(o.m, fr[idle * 2 + bl]);
    const y = n.kind === 'frog' ? WATER_Y + .6 : n.kind === 'owl' ? 17.5 : hAt(A, n.x, n.y);
    o.m.position.set(n.x, y - .3, n.y + (n.kind === 'owl' ? 1.5 : 0)); o.m.scale.x = n.front ? 1 : (n.flip == null || n.flip >= 0 ? 1 : -1);
    o.b.position.set(n.x, y + .2, n.y + 1); o.b.visible = n.kind !== 'owl';
    const k = beamLight(n.x, n.y) * A.ap.rays; o.m.material.emissive.setRGB(.3 * k, .22 * k, .1 * k);
  }
  // items
  for (const it of A.items) {
    const o = W.items[it.id]; if (!o) continue; const got = S.got.has(it.id); o.m.visible = o.b.visible = !got; if (got) continue;
    let x = it.x, z = it.y, y = hAt(A, x, z) + 3 + Math.sin(t * 3 + it.ph) * 1.6;
    if (it.pop && it.pop.t < 1) { const k = it.pop.t; x = lerp(it.pop.x0, it.x, k); z = lerp(it.pop.y0 + 30, it.y, k); y = 4 + Math.sin(k * Math.PI) * 60; }
    o.m.position.set(x, y, z); o.m.scale.x = Math.abs(Math.cos(t * 2.4 + it.ph)) < .2 ? .2 * Math.sign(Math.cos(t * 2.4 + it.ph) || 1) : Math.cos(t * 2.4 + it.ph);
    o.b.position.set(x, hAt(A, x, z) + .2, z + .5); o.b.scale.set(8 - (y - hAt(A, x, z)) * .3, 1, 4);
  }
  // props: sway, rustle, the bouncy mushroom
  for (const m of W.props) { const p = m.userData.p, d = PROPDEF[p.k]; if (d.low) continue;
    m.rotation.z = (d.sway ? Math.sin(t * .9 + p.ph) * d.sway : 0) + (p.rustle ? Math.sin(t * 40) * .07 * p.rustle : 0);
    if (p.id === 'bouncy') { const b = S.bounceT || 0; m.scale.y = 1 - Math.sin(b * Math.PI * 4) * .2 * b; m.scale.x = 1 + Math.sin(b * Math.PI * 4) * .12 * b; } }
  // beams breathe; dust drifts inside them
  fxN = 0; const lowFx = Q.tier === 0;
  for (const B of W.beams) {
    const a = A.ap.rays * (.13 + .035 * Math.sin(t * .45 + B.b.ph) + .02 * Math.sin(t * 1.7 + B.b.ph * 2)); B.mat.opacity = a; B.pm.opacity = a * 1.8;
    if (!lowFx || true) for (const d of B.dust) { const u = (d.u + t * d.sp) % 1; if (lowFx && d.ph > 3) continue;
      const x = lerp(B.Tp.x, B.Bp.x, u) + d.v * B.w * .8 + Math.sin(t * .7 + d.ph) * 2, y = lerp(B.Tp.y, B.Bp.y, u), z = lerp(B.Tp.z, B.Bp.z, u) + d.s * 16;
      fxAdd(x, y, z, '#fff0c8', Math.sin(u * Math.PI) * (.45 + .45 * Math.sin(t * 2.2 + d.ph)), 1.3); }
  }
  // fireflies (+2 wandering point lights)
  const fc = A.id === 'grove' ? '#a8ffd8' : '#ffd88a';
  W.flies.forEach((m, i) => { if (lowFx && i % 2) return; const x = m.x + Math.sin(t * m.sp + m.ph) * 26, z = m.z + Math.cos(t * m.sp * 1.3 + m.ph) * 16, y = m.y + Math.sin(t * m.sp * 2 + m.ph) * 6, a = .5 + .5 * Math.sin(t * 3 + m.ph);
    fxAdd(x, y, z, fc, a, 1.5); fxAdd(x, y, z, fc, a * .22, 4.5); });
  PL.forEach((l, i) => { const q = l.userData;
    if (q) l.intensity = q.i * (1 - q.flick + q.flick * (Math.sin(t * 7 + i) * .5 + .5) * (Math.sin(t * 2.3 + i * 2) * .5 + .5));
    else if (i >= NPL - 2 && W.flies.length) { const m = W.flies[(i * 7) % W.flies.length]; l.position.set(m.x + Math.sin(t * m.sp + m.ph) * 26, m.y + 6, m.z + Math.cos(t * m.sp * 1.3 + m.ph) * 16); l.color.set(fc); l.intensity = 140 * (.5 + .5 * Math.sin(t * 3 + m.ph)); }
    else l.intensity = 0; });
  // secret sparkles
  const sec = [];
  if (A.id === 'stream') A.stones.forEach(s => s.hidden && sec.push([s.x, WATER_Y + 2, s.y]));
  if (A.id === 'hollow') sec.push([fakeBush.x, 16, fakeBush.y]);
  if (A.id === 'grove' && !S.flags.bounced) sec.push([bouncy.x, 46, bouncy.y]);
  if (A.id === 'glade') sec.push([268, 24, 152]);
  sec.forEach((q, i) => { for (let k = 0; k < 4; k++) { const ph = t * 1.4 + i * 1.7 + k * 1.6, a = Math.max(0, Math.sin(ph)), cyc = Math.floor(ph / Math.PI);
    fxAdd(q[0] + Math.sin(k * 3.1 + cyc * 1.9) * 12, q[1] + Math.cos(k * 2.3 + cyc * 2.7) * 7, q[2] + 2, '#fff2b0', a, 1.6); } });
  for (const s of S.sparks) fxAdd(s.x, s.y, s.z, '#ffe27a', 1 - s.t, 1.8);
  fxGeo.attributes.position.needsUpdate = fxGeo.attributes.aCol.needsUpdate = fxGeo.attributes.aSize.needsUpdate = true; fxGeo.setDrawRange(0, fxN);
  // falling leaves (tumbling, around the view)
  const nL = lowFx ? LEAFN / 2 : LEAFN, hw = camOff.hw * 1.3;
  for (let i = 0; i < LEAFN; i++) { const l = LEAVES3[i];
    if (i >= nL) { dummy.position.set(0, -999, 0); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix); continue; }
    if (l.y < hAt(A, l.x, l.z) - 1 || Math.abs(l.x - S.camX) > hw + 60) { l.x = S.camX + (Math.random() * 2 - 1) * hw; l.z = S.camY + camOff.zt * .7 + Math.random() * (camOff.zb - camOff.zt * .7); l.y = l.y < -500 ? Math.random() * 140 : 120 + Math.random() * 40; l.vx = -6 + Math.random() * 4; l.vy = -(9 + Math.random() * 9); }
    l.y += l.vy * dt; l.x += (l.vx + Math.sin(t * 1.3 + l.ph) * 9) * dt; l.rx += dt * l.sp * 2.2; l.ry += dt * l.sp * 1.6; l.rz += dt * l.sp;
    dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(l.rx, l.ry, l.rz); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix); }
  leafMesh.instanceMatrix.needsUpdate = true;
  for (const w of W.water) w.uniforms.uT.value = t;
  for (const m of W.mist) m.t.offset.x = (t * m.sp) % 1;
}
let fadeV = 0;
function render3D() {
  const tier = Q.tier, comp = COMP[tier];
  R.setRenderTarget(rtS); R.render(scene, cam);
  if (tier >= 1) {
    brightM.uniforms.t.value = rtS.texture; brightM.uniforms.px.value.set(1 / IW, 1 / IH); pass(brightM, rtB[0]);
    const bw = rtB[0].width, bh = rtB[0].height;
    blurM.uniforms.t.value = rtB[0].texture; blurM.uniforms.dir.value.set(1 / bw, 0); pass(blurM, rtB[1]);
    blurM.uniforms.t.value = rtB[1].texture; blurM.uniforms.dir.value.set(0, 1 / bh); pass(blurM, rtB[0]);
    if (tier === 2) { const w2 = rtB[2].width, h2 = rtB[2].height; blurM.uniforms.t.value = rtB[0].texture; blurM.uniforms.dir.value.set(2 / w2, 0); pass(blurM, rtB[2]); blurM.uniforms.t.value = rtB[2].texture; blurM.uniforms.dir.value.set(0, 2 / h2); pass(blurM, rtB[3]); }
    comp.uniforms.tB.value = tier === 2 ? rtB[3].texture : rtB[0].texture; comp.uniforms.uBloom.value = tier === 2 ? 1.1 : .9;
  }
  comp.uniforms.res.value.set(IW, IH); comp.uniforms.uT.value = S.t; comp.uniforms.uDof.value = 3.4 * Math.max(1, IH / 380);
  comp.uniforms.uFade.value = fadeV;
  pass(comp, null);
}
function toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * VW, (1 - v.y) / 2 * VH, v.z < 1]; }

// ================================================================ UI (crisp, pixel-styled, drawn in UI units)
ctx.imageSmoothingEnabled = false;
const D = v => Math.round(v * SC);
function fr(x, y, w, h, c) { ctx.fillStyle = c; const X = D(x), Y = D(y); ctx.fillRect(X, Y, D(x + w) - X, D(y + h) - Y); }
function pbox(x, y, w, h, fill = CARD, edge = INK, hi = CREAM, lo = '#c8a878') {
  fr(x + 1, y + h, w - 1, 1, 'rgba(20,8,20,.35)'); fr(x + w, y + 2, 1, h - 2, 'rgba(20,8,20,.35)');
  fr(x + 1, y, w - 2, h, edge); fr(x, y + 1, w, h - 2, edge);
  fr(x + 1, y + 1, w - 2, h - 2, fill);
  fr(x + 1, y + 1, w - 2, 1, hi); fr(x + 1, y + 1, 1, h - 2, hi);
  fr(x + 1, y + h - 2, w - 2, 1, lo); fr(x + w - 2, y + 2, 1, h - 3, lo);
}
const font = (s, b) => (b ? '700 ' : '400 ') + Math.round(s * SC) + 'px ' + FONT;
function txt(t, x, y, s, c, align = 'center', sh = 'rgba(40,20,20,.35)', b = false, maxW) {
  ctx.font = font(s, b); ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (sh) { ctx.fillStyle = sh; ctx.fillText(t, D(x) + Math.max(1, D(.6)), D(y) + Math.max(1, D(.6)), maxW ? D(maxW) : undefined); }
  ctx.fillStyle = c; ctx.fillText(t, D(x), D(y), maxW ? D(maxW) : undefined);
}
const tw = (t, s, b) => { ctx.font = font(s, b); return ctx.measureText(t).width / SC; };
function icon(c, x, y, k = 1, flipX = 1) { const w = c.width * k, h = c.height * k; if (flipX < 0) { ctx.save(); ctx.translate(D(x + w / 2), 0); ctx.scale(-1, 1); ctx.drawImage(c, -D(w / 2), D(y), D(w), D(h)); ctx.restore(); } else ctx.drawImage(c, D(x), D(y), D(w), D(h)); }
function drawHud() {
  const y = 5, t1 = S.acorns + '/' + ACORNS, w1 = 24 + tw(t1, 10, true);
  pbox(5, y, w1, 18); icon(ACORN, 9, y + 2 - S.hud * 2, 1);
  txt(t1, 23, y + 9.5, 10, '#6a3a1e', 'left', 'rgba(255,255,255,.5)', true);
  if (S.leaves > 0) { const t2 = S.leaves + '/' + LEAVES, w2 = 26 + tw(t2, 10, true); pbox(10 + w1, y, w2, 18); icon(GLEAF, 13 + w1, y + 2, 1); txt(t2, 29 + w1, y + 9.5, 10, '#8a6410', 'left', 'rgba(255,255,255,.5)', true); }
  S.toasts.forEach((q, i) => {
    const a = Math.min(1, q.t * 5, (3.2 - q.t) * 3); ctx.globalAlpha = a;
    const w = Math.min(VW - 16, tw(q.text, 8) + 16), y0 = 28 + i * 19 - (1 - Math.min(1, q.t * 5)) * 6;
    pbox((VW - w) / 2, y0, w, 15, '#f6e6c2'); txt(q.text, VW / 2, y0 + 7.5, 8, '#4a2c1a', 'center', null, false, w - 8); ctx.globalAlpha = 1;
  });
}
function drawBanner() {
  const b = S.banner; if (!b || S.mode === 'title') return;
  const t = b.t, k = t < .4 ? ease(t / .4) : t > 2.5 ? 1 - ease((t - 2.5) / .5) : 1;
  const w = tw(b.text, 11, true) + 30, x = Math.round((VW - w) / 2), y = Math.round(lerp(-30, VH * .15, k));
  fr(x - 9, y + 5, 12, 14, INK); fr(x - 8, y + 6, 10, 12, '#7a2a1a'); fr(x + w - 3, y + 5, 12, 14, INK); fr(x + w - 2, y + 6, 10, 12, '#7a2a1a');
  pbox(x, y, w, 20, '#b8482a', INK, '#e87850', '#7a2a1a');
  txt(b.text, VW / 2, y + 10, 11, CREAM, 'center', '#5a1a10', true);
}
function wrap(text, maxW, s) {
  ctx.font = font(s); const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width / SC > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function drawDialog() {
  const d = S.dlg, touchPad = ROOT.classList.contains('touch-ui') && touchOn() ? 170 * DPR / SC : 0;
  const bw = Math.min(VW - 12, 330), bh = 66, bx = Math.round((VW - bw) / 2), by = Math.round(VH - bh - 10 - touchPad);
  pbox(bx, by, bw, bh);
  for (let i = bx + 4; i < bx + bw - 4; i += 4) fr(i, by + bh - 4, 2, 1, 'rgba(160,120,70,.25)');
  let tx = bx + 10;
  if (d.portrait) {
    pbox(bx + 7, by + 9, 46, 46, '#e8cfa0', INK, '#fff0d0', '#b89060');
    const fr_ = critFrames(d.portrait), talking = d.shown < d.lines[d.i].length, c = fr_[(talking && Math.floor(S.t * 8) % 2 ? 2 : 0) + ((S.t % 3.3) < .14 ? 1 : 0)], k = Math.min(1.6, 40 / Math.max(c.width, c.height));
    icon(c, bx + 30 - c.width * k / 2, by + 52 - c.height * k, k);
    tx = bx + 60;
  }
  const nw = tw(d.name, 9, true) + 14;
  pbox(bx + 8, by - 9, nw, 15, d.color, INK, css(lite(d.color, .35)), css(dark(d.color, .3)));
  txt(d.name, bx + 8 + nw / 2, by - 1.5, 9, CREAM, 'center', 'rgba(30,10,10,.5)', true);
  if (!d.wrapped) d.wrapped = wrap(d.lines[d.i], bx + bw - 10 - tx, 9);
  let left = Math.floor(d.shown), ly = by + 15;
  for (const ln of d.wrapped) { if (left <= 0) break; txt(ln.slice(0, left), tx, ly, 9, '#3a2418', 'left', 'rgba(255,255,255,.35)'); left -= ln.length + 1; ly += 13; }
  if (d.shown >= d.lines[d.i].length) { const ax = bx + bw - 12, ay = Math.round(by + bh - 11 + (Math.sin(S.t * 6) > 0 ? 1 : 0)); fr(ax - 3, ay - 2, 7, 1, '#b8482a'); fr(ax - 2, ay - 1, 5, 1, '#b8482a'); fr(ax - 1, ay, 3, 1, '#b8482a'); fr(ax, ay + 1, 1, 1, '#b8482a'); }
}
function drawPrompt(o) {
  const n = o.nid && NPCS[o.nid], top = n ? (n.kind === 'owl' ? 52 : n.kind === 'frog' ? 20 : n.kind === 'snail' ? 28 : 30) : o.oid === 'bouncy' ? 50 : o.oid === 'door' ? 62 : 46;
  const [x, y] = toScreen(o.x, top + 6, o.y), b = Math.sin(S.t * 5) > 0 ? 1 : 0, X = Math.round(x), Y = Math.round(y) - b;
  pbox(X - 6, Y - 14, 13, 13, '#fff4dc'); fr(X - 1, Y - 1, 3, 2, INK); fr(X, Y + 1, 1, 1, INK);
  txt(n ? '!' : '?', X + .5, Y - 7.3, 10, '#b8482a', 'center', null, true);
  const key = ROOT.classList.contains('touch-ui') ? 'A' : 'Space'; const kw = tw(key, 7, true) + 6;
  pbox(X - kw / 2, Y - 25, kw, 10, '#3a2a3a', INK, '#5a4a5a', '#24161c'); txt(key, X, Y - 20, 7, CREAM, 'center', null, true);
}
const LOGO_COLS = ['#e0582f', '#f0943a', '#f6c445', '#d04030', '#9ab040', '#b070c0'];
function drawLogo(cx, cy, s) {
  const text = 'Thimblewood'; ctx.font = font(s, true); const ws = [...text].map(ch => ctx.measureText(ch).width / SC), tot = ws.reduce((a, b) => a + b, 0) + (text.length - 1) * 1;
  let x = cx - tot / 2;
  [...text].forEach((ch, i) => {
    const c = LOGO_COLS[i % LOGO_COLS.length], lx = Math.round(x + ws[i] / 2), ly = Math.round(cy + (Math.sin(S.t * 2.2 + i * .7) > .3 ? -1 : 0));
    ctx.font = font(s, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const at = (dx, dy, col) => { ctx.fillStyle = col; ctx.fillText(ch, D(lx + dx), D(ly + dy)); };
    for (let k = 5; k >= 1; k--) for (const dx of [-1.2, 1.2]) at(dx, k, INK);
    for (let k = 4; k >= 1; k--) at(0, k, css(dark(c, .45)));
    for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [-1.2, -1.2], [1.2, -1.2]]) at(dx, dy, INK);
    at(0, 0, c);
    ctx.save(); ctx.beginPath(); ctx.rect(0, D(ly - s * .5), CW, D(s * .28)); ctx.clip(); at(0, 0, css(lite(c, .35))); ctx.restore();
    x += ws[i] + 1;
  });
}
function drawTitle() {
  const s = clamp(VW * (VH > VW ? .135 : .1), 22, 46), cy = Math.round(VH * (SHOT ? .17 : .19));
  drawLogo(VW / 2, cy, s);
  const sub = SHOT ? 'Explore a little autumn forest' : 'a little autumn forest', sw = tw(sub, s * .3) + 18;
  pbox(Math.round((VW - sw) / 2), Math.round(cy + s * .72), Math.round(sw), Math.round(s * .3 + 9)); txt(sub, VW / 2, cy + s * .72 + (s * .3 + 9) / 2, s * .3, '#4a2c1a', 'center', null);
  const touch = ROOT.classList.contains('touch-ui'), msg = SHOT ? 'Tap to play' : touch ? 'Tap to start' : 'Press Space to start';
  if (SHOT || Math.sin(S.t * 4) > -.3) { const mw = tw(msg, 11, true) + 24, my = SHOT ? VH - 36 : touch ? cy + s * 1.9 : VH - 40, mx = SHOT ? VW * .76 : VW / 2;
    pbox(Math.round(mx - mw / 2), Math.round(my), Math.round(mw), 21, '#b8482a', INK, '#e87850', '#7a2a1a'); txt(msg, mx, my + 10.5, 11, CREAM, 'center', '#5a1a10', true); }
  if (!SHOT && !touch) txt('Arrows / WASD walk  \u00b7  Space talk  \u00b7  M sound', VW / 2, VH - 10, 7, CREAM, 'center', 'rgba(20,8,20,.8)');
}
function drawEnd() {
  const w = Math.min(VW - 20, 252), h = 134, x = Math.round((VW - w) / 2), y = Math.round((VH - h) / 2 - 8);
  ctx.fillStyle = 'rgba(30,14,30,.4)'; ctx.fillRect(0, 0, CW, CH);
  pbox(x, y, w, h);
  txt('Harvest Supper!', VW / 2, y + 20, 17, '#b8482a', 'center', 'rgba(60,20,10,.35)', true);
  txt('All 12 acorns found in ' + mmss(S.finishT || 0), VW / 2, y + 46, 9.5, '#3a2418', 'center', null);
  txt('Golden leaves: ' + S.leaves + ' / ' + LEAVES + (S.leaves === LEAVES ? '  - all found!' : ''), VW / 2, y + 62, 9.5, '#3a2418', 'center', null);
  txt('Bramble is baking acorn cakes for the whole wood.', VW / 2, y + 80, 7.5, '#6a4a34', 'center', null, false, w - 14);
  for (let i = 0; i < 5; i++) icon(ACORN, VW / 2 - 34 + i * 14, y + 92 + (Math.sin(S.t * 5 + i) > 0 ? -2 : 0), 1, Math.cos(S.t * 2 + i) < 0 ? -1 : 1);
  if (Math.sin(S.t * 4) > -.4) txt(ROOT.classList.contains('touch-ui') ? 'Tap to keep exploring' : 'Space to keep exploring', VW / 2, y + h - 12, 8, '#b8482a', 'center', null, true);
}
function drawTrans() {
  const T = S.trans, p = T.t / T.dur, B = 12, cols = Math.ceil(VW / B), rows = Math.ceil(VH / B);
  const along = (i, j) => T.dir === 'e' ? i / cols : T.dir === 'w' ? 1 - i / cols : T.dir === 's' ? j / rows : 1 - j / rows;
  ctx.fillStyle = '#1e1420';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const th = along(i, j) * .7 + (BAYER[(j & 3) * 4 + (i & 3)] + .5) * .3;
    const on = p < .5 ? th < p * 2.3 : th > (p - .5) * 2.3 - .15;
    if (on) ctx.fillRect(D(i * B), D(j * B), D((i + 1) * B) - D(i * B), D((j + 1) * B) - D(j * B));
  }
  if (p > .3 && p < .75) { const name = AREAS[T.to].name; txt(name, VW / 2, VH / 2 + 6, 13, CREAM, 'center', '#000', true); icon(ACORN, VW / 2 - 5.5, VH / 2 - 22, 1); }
}
function drawUI() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, CW, CH); ctx.imageSmoothingEnabled = false;
  if (S.mode === 'play' && S.target && !S.trans) drawPrompt(S.target);
  for (const f of S.floaters) { const [x, y] = toScreen(f.x, 26 + f.t * 22, f.y); ctx.globalAlpha = 1 - f.t / 1.1; txt(f.text, x, y, 9, '#ffe9a8', 'center', '#3a1a10', true); ctx.globalAlpha = 1; }
  if (S.mode !== 'title') drawHud();
  drawBanner();
  if (S.dlg) drawDialog();
  if (S.mode === 'title') drawTitle();
  if (S.mode === 'end') drawEnd();
  for (const q of S.confetti) fr(q.x, q.y, 2, Math.abs(Math.cos(q.r)) * 2 + .5, q.c);
  if (S.trans) drawTrans();
}

// ================================================================ boot
function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CW = cv.width = Math.round(w * DPR); CH = cv.height = Math.round(h * DPR);
  SC = Math.min(CW, CH) / (SHOT ? 212 : CH > CW * 1.3 ? VIEWMIN_PORTRAIT : VIEWMIN);
  if (Math.max(CW, CH) / SC > 640) SC = Math.max(CW, CH) / 640;
  VW = CW / SC; VH = CH / SC;
  const base = SHOT ? 315 : h > w * 1.3 ? 300 : 380;
  PS = Math.max(1, Math.min(w, h) / base) * psBoost;
  IW = Math.max(120, Math.round(w / PS)); IH = Math.max(90, Math.round(h / PS));
  if (!R) return;
  R.setSize(IW, IH, false); sizeTargets(); setupCamera();
  if (scene.fog) { scene.fog.near = CAMD * .9; scene.fog.far = CAMD * 2.4; }
  if (S.A) { const c = camTarget(); S.camX = c[0]; S.camY = c[1]; }
}
function noGL() {
  const d = document.createElement('div'); d.id = 'nogl';
  d.innerHTML = '<div><b>Thimblewood needs WebGL</b><br>Your browser or device has 3D graphics turned off or unavailable.<br>Try a recent Chrome, Safari or Firefox, or enable hardware acceleration.</div>';
  document.body.appendChild(d);
}
let last = 0, aT = 0, aN = 0, fpsNow = 0;
function adapt(fps) {
  if (fps >= 45) return;
  if (Q.tier > 0) { Q.tier--; applyTier(); }
  else if (psBoost < 2) { psBoost = Math.min(2, psBoost * 1.25); resize(); }
}
function loop(now) {
  const raw = last ? Math.max(0, (now - last) / 1000) : 1 / 60, dt = Math.min(.05, raw); last = now;
  update(dt); update3D(dt); render3D(); drawUI();
  aT += raw; aN++; if (aT >= 2) { fpsNow = aN / aT; if (Q.forced == null && S.t > 3 && !document.hidden && raw < .5) adapt(fpsNow); aT = 0; aN = 0; }
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => { resize(); restStick(); });
document.addEventListener('visibilitychange', () => { last = 0; aT = 0; aN = 0; });
async function boot() {
  if (!R) { noGL(); return; }
  R.setPixelRatio(1); R.outputColorSpace = THREE.LinearSRGBColorSpace; R.shadowMap.type = THREE.BasicShadowMap; R.shadowMap.enabled = false;
  glc.addEventListener('webglcontextlost', e => { e.preventDefault(); });
  try { const ff = new FontFace('Pixelify Sans', 'url(vendor/PixelifySans.woff2)', { weight: '400 700' }); document.fonts.add(ff); await Promise.race([ff.load(), new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  resize(); applyTier(); restStick(); ROOT.classList.add('tw-title');
  const at = QS.get('at');
  if (SHOT) { NPCS.bramble.x = 188; NPCS.bramble.y = 206; NPCS.bramble.flip = 1; AREAS.clearing.items[1].x = 256; AREAS.clearing.items[1].y = 214; enterArea('clearing', 216, 208); S.dir = 'side'; S.facing = -1; S.t = 1.2; }
  else if (at && AREAS[at]) enterArea(at, +QS.get('x') || AREAS[at].w / 2, +QS.get('y') || 300);
  else enterArea('clearing', 240, 316);
  if (at && QS.has('play')) start();
  requestAnimationFrame(loop);
}
// small public surface for wrappers (e.g. a handheld overlay) and tests
window.Thimblewood = {
  setTouchUI,
  state: () => ({ mode: S.mode, area: S.area, x: Math.round(S.px), y: Math.round(S.py), acorns: S.acorns, leaves: S.leaves, dialog: S.dlg ? S.dlg.name : null, trans: !!S.trans, tier: Q.tier, internal: IW + 'x' + IH, fps: Math.round(fpsNow * 10) / 10, webgl: R ? (R.capabilities.isWebGL2 ? 2 : 1) : 0 }),
  setQuality: q => { Q.forced = Q.tier = q; applyTier(); },
};
if (QS.has('debug')) window.Thimblewood._debug = { S, AREAS, NPCS, OBJS, canStand, clampBounds, GT, PR, scene, cam, hero, W3, R };
boot();
