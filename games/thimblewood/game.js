/* THIMBLEWOOD (HD-2D edition): a little autumn forest to explore, and the
 * medieval town of Hearthvale beyond it (Harvest Road -> gate -> market square,
 * Lantern Lane, the forge, the Mossy Mug tavern, Chapel Hill and the keep).
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
  apple: ['#5a7a2a', '#8aa03a', '#c8c050'], hedge: ['#3a5a26', '#557a30', '#8a9a40'],
};
const treePal = k => { const c = TREE[k] || TREE.autumn; return [dark(c[0], .55), dark(c[0], .25), c[0], c[1], c[2], lite(c[2], .35)]; };
// sky: background gradient; fog: haze colour; sun: key light; hemi: sky/ground fill; grade: [shadow tint, light tint]
const AP = {
  meadow: { sky: ['#f6c27a', '#b86a5a'], fog: '#c98a6a', sun: '#ffd49a', hemi: ['#ffe0b0', '#6a4a6a'], ground: '#9a7c34', ground2: '#a8662c', path: '#d0a46c', trees: ['autumn', 'amber', 'crimson', 'gold', 'rust'], fireflies: 16, rays: 1, grade: [[.72, .62, 1], [1, .8, .55]], mist: '#ffe2c4' },
  river: { sky: ['#f0c88a', '#9a6a6a'], fog: '#b98a74', sun: '#ffdca6', hemi: ['#ffe6c0', '#5a4a6a'], ground: '#8e7c38', ground2: '#a4662c', path: '#c8a070', trees: ['amber', 'autumn', 'gold', 'rust'], fireflies: 14, rays: .9, grade: [[.7, .66, 1], [1, .84, .6]], mist: '#f2e2d6' },
  grove: { sky: ['#d898a0', '#4e3a6a'], fog: '#7a5a84', sun: '#ffc0c8', hemi: ['#e0b8e0', '#3a2a5a'], ground: '#6a5a36', ground2: '#7a4636', path: '#b8987a', trees: ['crimson', 'plum', 'rust', 'crimson'], fireflies: 30, rays: .75, grade: [[.62, .55, 1], [1, .8, .9]], mist: '#d8c4ff' },
  hollow: { sky: ['#eea86a', '#8a4a40'], fog: '#b06a4a', sun: '#ffc888', hemi: ['#ffd0a0', '#5a3a5a'], ground: '#926c30', ground2: '#a4582a', path: '#cca06a', trees: ['autumn', 'rust', 'gold', 'crimson'], fireflies: 20, rays: 1, grade: [[.7, .58, .95], [1, .78, .5]], mist: '#ffd8bc' },
  town: { sky: ['#f8d49a', '#a8786a'], fog: '#d4a888', sun: '#ffe2b4', hemi: ['#fff0d0', '#6a5068'], ground: '#8a7a40', ground2: '#9a6a34', path: '#c8b08a', cobble: '#a49680', trees: ['amber', 'autumn', 'gold', 'crimson'], fireflies: 8, rays: .85, grade: [[.74, .64, 1], [1, .82, .58]], mist: '#ffe8d0' },
  dusk: { sky: ['#f4945a', '#5a3a6a'], fog: '#9a6070', sun: '#ffa060', hemi: ['#ffc0a0', '#3a2a5a'], grade: [[.62, .52, 1], [1, .72, .48]], mist: '#ffc8b0', sunI: 1.45, hemiI: 1.15, rays: .7 },
  night: { sky: ['#4a4488', '#16123a'], fog: '#3a3468', sun: '#a0acf0', hemi: ['#b0a8ec', '#3a3060'], grade: [[.66, .62, 1], [1, .84, .6]], mist: '#9a98d8', sunI: 1.05, hemiI: 1.35, rays: .25 },
  inn: { sky: ['#2a1a14', '#140a08'], fog: '#2a1810', sun: '#ffc890', hemi: ['#ffd0a0', '#3a2018'], ground: '#7a5030', ground2: '#6a4028', path: '#8a6040', trees: ['autumn'], fireflies: 0, rays: .5, grade: [[.7, .58, .9], [1, .8, .55]], mist: '#ffd8b0', sunI: .85, hemiI: .95 },
  glade: { sky: ['#ffe0a0', '#c88a5a'], fog: '#e0b080', sun: '#fff0c0', hemi: ['#fff0c8', '#7a5a6a'], ground: '#a48a3c', ground2: '#b4722e', path: '#dab47e', trees: ['gold', 'amber', 'autumn'], fireflies: 28, rays: 1, grade: [[.76, .66, .98], [1, .86, .6]], mist: '#fff0d6' },
};
const AUT = ['#c4542f', '#e08a2a', '#f5b445', '#b23a32', '#a5502a', '#d8583e', '#e9c24a'];

// ---------------------------------------------------------------- characters (all original designs)
const SKIN = ['#8a4a3a', '#c4785a', '#eaa47c', '#ffc89c', '#ffe0c0'], CAPP = ['#5a2010', '#9a3a16', '#d0642a', '#f08a3a', '#ffb860'];
const TUNIC = ['#163a40', '#1f5a5a', '#2c7c74', '#44a08a', '#72c4a4'], SCARF = ['#7a1a1a', '#b8302a', '#e0503a'];
const BOOT = '#4a2a1c', HAIR = ['#3a1e14', '#5a3220', '#7a4a2c'];
// hero: 20x28 texels; dir: 'down' | 'up' | 'side' (side faces right; flipped for left); f: walk frame 0..3; blink
function paintHero(dir, f, blink, ribbon) {
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
  if (ribbon) { const bx = Math.round(hx) - (dir === 'side' ? 6 : 5), by = 4 + Y; p.rect(bx - 1, by - 1, 2, 3, '#e8b84a'); p.rect(bx + 2, by - 1, 2, 3, '#e8b84a'); p.set(bx + 1, by, '#fff0a0'); p.set(bx - 1, by + 2, '#c8902a'); p.set(bx + 3, by + 2, '#c8902a'); }
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
// ---- Hearthvale townsfolk (all original designs; same pixel language as the forest cast)
const EYE = '#24161c';
function eyes(p, pts, blink, lid) { for (const [x, y] of pts) { if (blink) p.rect(x - 1, y + 1, 2, 1, lid || EYE); else { p.rect(x, y, 1, 2, EYE); p.set(x, y, '#5a4a6a'); } } }
function ring(p, cx, cy, r, c) { for (let a = 0; a < TAU; a += .25) p.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c); }
function paintCrow(f, blink) {        // Corvin, gate guard: a crow in a kettle helm with a spear
  const p = new Pix(28, 38), B = ['#12121c', '#1e1e2e', '#2e2e44', '#42425e', '#5a5a7c'], b = f ? .5 : 0;
  p.rect(22, 6, 1, 31, '#6a4a2a'); p.rect(23, 6, 1, 31, '#8a6a3a');
  p.poly([[22.5, 0], [25.5, 6], [19.5, 6]], ['#5a6070', '#8a94a4', '#c8d0dc', '#eef2f8']); p.rect(20, 6, 6, 1, '#4a5060');
  p.ell(12, 26, 8.5, 9.5 + b, B);
  p.poly([[6, 20], [18, 20], [17, 33], [7, 33]], ['#5a1414', '#8a2420', '#b4382c', '#d8503a'], { vert: true });
  p.rect(6, 20, 12, 1, '#e8b84a'); p.rect(7, 32, 10, 1, '#c8982a');
  p.ell(12, 26.5, 2.2, 2.6, ['#a8781a', '#e8b84a', '#fff0a0']); p.ell(12, 24, 2.6, 1.2, '#6a4a1a');
  p.ell(20, 25 + b, 2.6, 4.6, B.slice(1));
  p.ell(12, 13, 7, 6.4, B);
  p.ell(12, 9, 8.6, 4.4, ['#3a4050', '#626c7c', '#96a0b0', '#cad2de', '#eef2f8'], { only: (x, y) => y <= 10 });
  p.rect(3, 10, 19, 1, '#4a5060'); p.rect(4, 11, 17, 1, '#2a2e3a');
  p.poly([[16, 13], [24, 15.5], [16, 17]], ['#a0701a', '#d8a030', '#f8d070']);
  if (blink) p.rect(12, 14, 3, 1, '#8a8aa8'); else { p.rect(12, 13, 3, 2, '#f4ecd8'); p.rect(13, 13, 2, 2, EYE); p.set(14, 13, '#ffffff'); }
  p.rect(8, 35, 3, 3, '#d8a030'); p.rect(14, 35, 3, 3, '#d8a030');
  return p.done();
}
function paintRabbit(f, blink) {      // Clover, the baker: rabbit with a red kerchief and a floury apron
  const p = new Pix(26, 38), W = ['#a89888', '#cfc0b0', '#ece2d4', '#fffaf0'], e = f ? 1 : 0;
  p.ell(9 - e * .5, 6.5, 2.6, 6.5, W); p.ell(16 + e * .5, 6, 2.6, 6.5, W);
  p.ell(9 - e * .5, 7, 1.1, 4.4, '#f2a8a8'); p.ell(16 + e * .5, 6.5, 1.1, 4.4, '#f2a8a8');
  p.ell(12.5, 28, 8.4, 8.6, ['#7a3a2a', '#a8503a', '#cc6c4a', '#e88c5e']);
  p.poly([[7, 21], [18, 21], [19, 35], [6, 35]], ['#c8bca8', '#e8e0d0', '#fff8ec'], { vert: true });
  p.rect(7, 23, 11, 1, '#d8ccb8'); p.rect(11, 27, 4, 3, '#e8d4a8'); p.set(9, 31, '#ffffff'); p.set(15, 25, '#ffffff');
  p.ell(4.8, 27, 2, 3.5, W); p.ell(20.2, 27, 2, 3.5, W);
  p.ell(12.5, 16, 7.4, 6.8, W);
  p.ell(12.5, 11, 7, 2.8, ['#8a2020', '#c83a2a', '#e85a3a', '#f88a5a'], { only: (x, y) => y <= 11 });
  for (const x of [8, 12, 16]) p.set(x, 10, '#fff0e0');
  eyes(p, [[10, 15], [15, 15]], blink, W[0]);
  p.set(12, 18, '#e87a8a'); p.set(13, 18, '#e87a8a'); p.set(12, 19, '#8a4a4a');
  p.set(8, 18, '#f4a0a0'); p.set(17, 18, '#f4a0a0'); p.set(6, 14, '#ffffff'); p.set(7, 13, '#ffffff');
  p.rect(7, 36, 4, 2, W[1]); p.rect(14, 36, 4, 2, W[1]);
  return p.done();
}
function paintMouse(f, blink) {       // Tansy, the apothecary: field mouse with spectacles and a moss shawl
  const p = new Pix(22, 28), M = ['#5a5058', '#7e747a', '#a49aa0', '#c8c0c2'], b = f ? .4 : 0;
  p.line(3, 26, 0, 20, '#e8a8b0'); p.set(0, 19, '#e8a8b0');
  p.ell(4.5, 7, 4, 4, M); p.ell(17.5, 7, 4, 4, M); p.ell(4.5, 7, 2.2, 2.2, '#e8a8b0'); p.ell(17.5, 7, 2.2, 2.2, '#e8a8b0');
  p.ell(11, 21, 7, 6.2 + b, ['#2a4a2e', '#3a6a3a', '#5a8a4a', '#7aaa5a']);
  p.rect(5, 17, 12, 2, '#7aaa5a'); for (let x = 5; x < 18; x += 2) p.set(x, 27, '#3a6a3a');
  p.ell(11, 12, 6.4, 5.6, M); p.ell(11, 14.6, 3.2, 2, M[3]);
  ring(p, 8, 11.5, 2, '#c8a040'); ring(p, 14, 11.5, 2, '#c8a040'); p.set(11, 11, '#c8a040');
  eyes(p, [[8, 11], [14, 11]], blink, M[1]);
  p.set(11, 14, '#e87a8a'); p.line(13, 15, 17, 14, '#d8d0d4'); p.line(9, 15, 5, 14, '#d8d0d4');
  p.rect(16, 19, 3, 5, '#7ad0c0'); p.rect(16, 19, 3, 1, '#c8fff0'); p.rect(17, 17, 1, 2, '#a07a4a');
  p.ell(16, 22, 1.6, 1.6, M[2]);
  return p.done();
}
function paintFox(f, blink) {         // Russet, the tailor: fox with a tape measure and a needle
  const p = new Pix(28, 34), O = ['#7a2e10', '#b04a1a', '#d8692a', '#f08c40'], b = f ? .4 : 0, s = f ? 1 : 0;
  p.ell(5 - s * .5, 25, 4.5, 6.5, O); p.ell(3.5 - s * .5, 20, 2.6, 2.6, '#f8eee0');
  p.ell(14, 26, 7.6, 7.2 + b, ['#3a1e4a', '#5a2e6e', '#7a4690', '#9a62b0']);
  p.rect(9, 25, 10, 1, '#c8a8e0');
  p.poly([[8, 10], [9, 2], [13, 8]], O); p.poly([[15, 8], [19, 2], [20, 10]], O); p.set(9, 5, '#3a1a10'); p.set(19, 5, '#3a1a10');
  p.ell(14, 13.5, 7, 6, O); p.ell(14, 16.5, 4, 2.6, '#f8eee0'); p.ell(9, 15, 2, 2, '#f8eee0'); p.ell(19, 15, 2, 2, '#f8eee0');
  p.set(14, 15, EYE); p.set(13, 15, '#3a1a10');
  eyes(p, [[11, 12], [17, 12]], blink, O[0]);
  p.rect(8, 20, 12, 1, '#f0d040'); for (let x = 8; x < 20; x += 2) p.set(x, 20, '#a8801a'); p.line(10, 21, 9, 28, '#f0d040');
  p.ell(7.5, 25, 1.8, 3.4, O); p.ell(20.5, 25, 1.8, 3.4, O);
  p.line(21, 23, 25, 18, '#c0c8d0'); p.set(25, 18, '#ffffff'); p.line(25, 18, 26, 22, '#d83a3a');
  p.rect(10, 33, 3, 1, O[0]); p.rect(16, 33, 3, 1, O[0]);
  return p.done();
}
function paintBadger(f, blink) {      // Hob, the blacksmith: badger in a leather apron with a hammer
  const p = new Pix(30, 32), G = ['#2a2a30', '#44444c', '#66666e', '#8a8a92'], b = f ? .5 : 0, hy = f ? 2 : 0;
  p.line(24, 28, 26, 15 + hy, '#6a4a2a'); p.line(25, 28, 27, 15 + hy, '#8a6a3a');
  p.rect(23, 12 + hy, 7, 4, '#4a4e56'); p.rect(23, 12 + hy, 7, 1, '#9aa0aa');
  p.ell(14, 23, 10.5, 8.5 + b, G);
  p.poly([[7, 18], [21, 18], [22, 31], [6, 31]], ['#4a2a16', '#6e4024', '#8e5a34', '#a87048'], { vert: true });
  p.line(8, 18, 10, 14, '#4a2a16'); p.line(20, 18, 18, 14, '#4a2a16'); p.rect(12, 24, 5, 3, '#5a3420');
  p.ell(4, 23, 2.6, 4, G); p.ell(24, 23, 2.6, 4, G);
  p.ell(14, 11, 8, 6.6, ['#b8b4ac', '#dcd8d0', '#f4f0e8']);
  p.ell(10, 10, 2.2, 6.6, ['#141418', '#24242a', '#34343c'], { only: (x, y) => y >= 4 && y <= 14 });
  p.ell(18, 10, 2.2, 6.6, ['#141418', '#24242a', '#34343c'], { only: (x, y) => y >= 4 && y <= 14 });
  p.ell(6.5, 6, 1.8, 1.8, G); p.ell(21.5, 6, 1.8, 1.8, G);
  if (blink) { p.rect(9, 11, 2, 1, '#8a8a92'); p.rect(17, 11, 2, 1, '#8a8a92'); } else { p.rect(10, 10, 1, 2, '#fff4dc'); p.rect(18, 10, 1, 2, '#fff4dc'); }
  p.rect(13, 15, 3, 2, EYE); p.set(13, 15, '#5a4a5a');
  p.rect(8, 30, 4, 2, G[0]); p.rect(17, 30, 4, 2, G[0]);
  return p.done();
}
function paintMole(f, blink) {        // Barnaby, the innkeeper: velvet mole with a frothy mug
  const p = new Pix(30, 28), V = ['#2a2030', '#3e3046', '#56465e', '#6e5e78'], b = f ? .5 : 0;
  p.ell(13, 18, 10, 9 + b, V);
  p.poly([[7, 14], [19, 14], [20, 27], [6, 27]], ['#c8c0b4', '#e8e2d8', '#fffaf0'], { vert: true }); p.rect(7, 19, 12, 1, '#d8d0c4');
  p.ell(13, 10, 7.5, 6, V); p.ell(13, 13, 3, 2.2, ['#d07a8a', '#f0a0b0', '#ffd0d8']);
  if (blink) { p.rect(9, 9, 2, 1, V[0]); p.rect(16, 9, 2, 1, V[0]); } else { p.set(10, 9, '#0a0610'); p.set(16, 9, '#0a0610'); p.set(10, 8, '#8a7a9a'); }
  p.ell(4, 19, 2.8, 2.4, '#e8a8b8'); p.ell(22, 18, 2.6, 2.2, '#e8a8b8');
  p.rect(22, 12 - (f ? 1 : 0), 6, 7, '#b88a4a'); p.rect(22, 12 - (f ? 1 : 0), 6, 1, '#d8aa6a'); p.rect(22, 10 - (f ? 1 : 0), 6, 2, '#fff8e8'); p.set(23, 9 - (f ? 1 : 0), '#fff8e8');
  p.rect(28, 14 - (f ? 1 : 0), 1, 3, '#8a6030'); p.rect(22, 15 - (f ? 1 : 0), 6, 1, '#7a5428');
  p.rect(8, 26, 4, 2, V[0]); p.rect(15, 26, 4, 2, V[0]);
  return p.done();
}
function paintDuck(f, blink) {        // Puddle, the bard: duck in a feathered cap with a lute
  const p = new Pix(28, 30), Wd = ['#a8a8a0', '#d0d0c8', '#eeeee6', '#ffffff'];
  p.ell(13, 21, 8.5, 7.5, Wd);
  p.ell(14, 10, 6, 5.6, Wd); p.ell(20, 12, 3.6, 1.8, ['#c06010', '#e88a2a', '#ffb850']);
  p.ell(13.5, 6.5, 6.6, 3, ['#1e4a3a', '#2e6a50', '#4a8a6a'], { only: (x, y) => y <= 7 }); p.rect(7, 7, 13, 1, '#1e4a3a');
  p.line(9, 5, 4, 0, '#d84a3a'); p.line(10, 5, 5, 1, '#f08a5a');
  eyes(p, [[16, 9]], blink, Wd[0]);
  p.ell(10, 22, 5, 4, ['#7a4a1e', '#a86a2e', '#d0904a']); p.ell(10, 22, 1.2, 1.2, '#3a2010'); p.line(14, 20, 23, 14, '#5a3418'); p.rect(22, 13, 3, 2, '#3a2010');
  p.ell(9 + (f ? 1 : -1), 19, 2, 1.6, Wd);
  p.rect(9, 28, 4, 2, '#e88a2a'); p.rect(15, 28, 4, 2, '#e88a2a');
  return p.done();
}
function paintToad(f, blink) {        // Fen, a regular at the Mossy Mug: an old toad with a tankard
  const p = new Pix(22, 18), G = ['#3a2a18', '#5a4224', '#7a6034', '#9a7e48', '#baa068'], pf = f ? 1 : 0;
  p.ell(11, 12, 8.5, 5.4, G);
  for (const [x, y] of [[6, 11], [9, 14], [14, 10], [16, 13], [11, 9]]) p.set(x, y, G[1]);
  p.ell(11, 14.4, 4.4 + pf * .5, 2.4, ['#c8b888', '#e0d4a8']);
  for (const ex of [6, 16]) { p.ell(ex, 6.5, 2.8, 2.6, G); p.ell(ex, 6.5, 1.7, 1.6, '#f8e0a0'); if (blink) p.rect(ex - 1, 6, 3, 1, G[1]); else p.rect(ex, 6, 1, 2, EYE); }
  p.line(7, 11, 15, 11, '#3a2a18');
  p.ell(11, 3.5, 4.2, 1.6, ['#5a2a4a', '#8a3a6a']); p.rect(6, 4, 10, 1, '#5a2a4a');
  p.rect(17, 9, 4, 5, '#9aa0a8'); p.rect(17, 9, 4, 1, '#fff8e8'); p.set(21, 11, '#6a7078');
  p.rect(4, 16, 4, 1, G[1]); p.rect(14, 16, 4, 1, G[1]);
  return p.done();
}
function paintTortoise(f, blink) {    // Lady Marigold, steward of the keep: tortoise in a lace bonnet
  const p = new Pix(34, 26), SK = ['#5a6a3a', '#7a8a4a', '#9aaa5a', '#bac87a'], h = f ? .5 : 0;
  p.ell(6, 22, 2.6, 2.6, SK); p.ell(20, 22.5, 2.6, 2.6, SK); p.ell(11, 23, 2.4, 2.2, SK.slice(0, 3));
  p.ell(14, 15, 11, 8.5, ['#3a2a1a', '#5a3e22', '#7a5a2e', '#9a7838', '#b8964a']);
  for (const [x, y] of [[9, 11], [15, 9], [20, 12], [12, 16], [18, 17], [7, 17]]) { ring(p, x, y, 2.2, '#4a3418'); p.set(x, y, '#c8a860'); }
  p.rect(3, 20, 23, 2, '#c8a860'); p.rect(3, 22, 23, 1, '#8a6a30');
  p.line(6, 10, 20, 21, '#8a5ab0'); p.line(7, 10, 21, 21, '#b07ad0');
  p.ell(25, 16, 3, 3.4, SK); p.ell(28.5, 11.5 + h, 4.6, 4.2, SK);
  p.ell(28.5, 8 + h, 4.6, 2.2, ['#e8d8e0', '#fff4f8'], { only: (x, y) => y <= 8 + h }); p.set(24, 9 + h, '#f4c0d0'); p.set(33, 9 + h, '#f4c0d0');
  ring(p, 30, 11.5 + h, 1.6, '#c8a040'); if (blink) p.rect(29, 12 + h, 2, 1, SK[0]); else p.set(30, 11 + h, EYE);
  p.set(33, 13 + h, '#5a3a3a'); p.set(32, 14 + h, '#c86a6a');
  return p.done();
}
function paintSquirrel(f, blink) {    // Nutmeg, the bell-ringer: red squirrel in a little blue tunic
  const p = new Pix(28, 30), R_ = ['#6a2a10', '#9a4218', '#c8622a', '#e88a44'], s = f ? .6 : 0;
  p.ell(7, 16 - s, 6, 10, R_); p.ell(9, 6.5 - s, 4.4, 4.4, R_); p.line(5, 10, 8, 22, '#f0a060');
  p.ell(16, 22, 6.5, 7, ['#1e3a6a', '#2e528a', '#4470aa', '#6a94c8']); p.ell(16, 20, 2.6, 3.4, '#f4e0c0');
  p.ell(17, 12, 6, 5.4, R_); p.poly([[12, 9], [13, 3], [15, 8]], R_); p.poly([[19, 8], [21, 3], [22, 9]], R_);
  p.ell(19.5, 14.5, 3.2, 2, '#f4e0c0'); p.set(22, 13, EYE);
  eyes(p, [[15, 11], [19, 11]], blink, R_[1]);
  p.ell(23, 22, 2.2, 2.6, ['#a8781a', '#e8b84a', '#fff0a0']); p.set(23, 25, '#7a5410');
  p.rect(12, 28, 3, 2, R_[0]); p.rect(18, 28, 3, 2, R_[0]);
  return p.done();
}
// ambient critters (not talkable): a sleepy cat and wandering hens
function paintCat(f, blink) {
  const p = new Pix(20, 16), C = ['#3a2a2a', '#5a4038', '#8a6450', '#b08868'], t = f ? 1 : 0;
  p.line(16, 13, 18 + t, 6, C[1]); p.line(17, 13, 19 + t, 7, C[2]);
  p.ell(10, 11, 7, 4.6, C);
  p.ell(5.5, 7, 4.2, 3.8, C); p.poly([[2, 5], [2.5, 1], [5, 4]], C[1]); p.poly([[6, 4], [8.5, 1], [9, 5]], C[1]);
  if (blink || f) { p.rect(3, 7, 2, 1, EYE); p.rect(6, 7, 2, 1, EYE); } else { p.set(4, 6, '#c8d040'); p.set(4, 7, EYE); p.set(7, 6, '#c8d040'); p.set(7, 7, EYE); }
  p.set(5, 9, '#f08a8a');
  return p.done();
}
function paintHen(f) {
  const p = new Pix(16, 16), Wh = ['#b8a890', '#dcd0bc', '#f4ecdc', '#ffffff'], pk = f ? 2 : 0;
  p.ell(7, 10, 6, 4.4, Wh); p.poly([[1, 7], [3, 4], [4, 9]], Wh.slice(1));
  p.ell(11.5, 5 + pk, 2.8, 2.8, Wh); p.rect(11, 1 + pk, 2, 2, '#d83a2a'); p.set(13, 2 + pk, '#d83a2a');
  p.rect(14, 5 + pk, 2, 1, '#e8a030'); p.set(12, 4 + pk, EYE); p.set(13, 7 + pk, '#d83a2a');
  p.rect(5, 14, 1, 2, '#e8a030'); p.rect(9, 14, 1, 2, '#e8a030');
  return p.done();
}
const CRIT = { hedgehog: paintHedgehog, frog: paintFrog, snail: paintSnail, owl: paintOwl,
  crow: paintCrow, rabbit: paintRabbit, mouse: paintMouse, fox: paintFox, badger: paintBadger, mole: paintMole, duck: paintDuck, toad: paintToad, tortoise: paintTortoise, squirrel: paintSquirrel, cat: paintCat, hen: paintHen };

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

// ---- Hearthvale props
const WOOD = ['#3a2416', '#5a3a22', '#7a5434', '#9a7048', '#b88a5e'];
const IRON = ['#1e1e24', '#34343c', '#50505a', '#70707c', '#9a9aa6'];
function bricks(p, x0, y0, w, h, base, bw = 6, bh = 3, seed = 1) {
  const P_ = pal(base, 5, .45, .3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const row = Math.floor(j / bh), off = row % 2 ? bw >> 1 : 0, col = Math.floor((i + off) / bw), li = (i + off) % bw, lj = j % bh;
    const v = li === 0 || lj === bh - 1 ? .08 : .34 + hash2(col, row, seed) * .38 + (lj === 0 ? .22 : 0);
    p.set(x0 + i, y0 + j, p.shadeOf(P_, clamp(v, 0, 1), x0 + i, y0 + j)); }
}
function fire(p, x0, y0, x1, y1, seed) {   // a glowing fire mouth: dark edges, white-hot core at the bottom
  const r = rng(seed), cx = (x0 + x1) / 2, w = (x1 - x0) / 2, F = ['#2a0804', '#6a1806', '#c0400c', '#f07a1a', '#ffb03a', '#ffe48a'];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const dx = (x + .5 - cx) / w, top = y0 + (1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * (y1 - y0) * .45; if (y < top) continue;
    p.set(x, y, p.shadeOf(F, clamp(1 - Math.hypot(dx * .9, (y1 - y) / (y1 - y0) * 1.1) + .15, 0, 1), x, y)); }
  for (let i = 0; i < (x1 - x0) * 1.2; i++) { const x = x0 + 1 + r() * (x1 - x0 - 2) | 0, y = y1 - 1 - r() * 3 | 0; p.set(x, y, r() < .5 ? '#3a1a10' : '#ff9a3a'); }
}
// an emissive mask: a copy of the warm, bright pixels of a sprite (windows, flames)
function glowMask(c, test) { const g = c.getContext('2d').getImageData(0, 0, c.width, c.height), d = g.data;
  for (let i = 0; i < d.length; i += 4) { const ok = d[i + 3] > 0 && (test ? test(d[i], d[i + 1], d[i + 2]) : d[i] > 200 && d[i + 1] > 110 && d[i + 2] < 190); if (!ok) { d[i] = d[i + 1] = d[i + 2] = 0; } }
  const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; m.getContext('2d').putImageData(g, 0, 0); return m; }
function paintBarrel() { const p = new Pix(18, 22); p.col_(2, 3, 14, 18, WOOD); for (const y of [5, 11, 17]) { p.rect(2, y, 14, 1, IRON[1]); p.set(5, y, IRON[3]); } p.ell(9, 3, 7, 2, WOOD.slice(1, 4)); p.ell(9, 3, 4.6, 1, WOOD[0]); return p.done({ ax: 9, ay: 21 }); }
function crateAt(p, x, y, w, h) { p.rect(x, y, w, 3, '#c89a64'); p.rect(x, y + 3, w, h - 3, '#9a6a3a'); for (let j = y + 6; j < y + h; j += 4) p.rect(x, j, w, 1, '#7a4e2a'); p.line(x + 1, y + h - 1, x + w - 2, y + 4, '#b88a54'); p.rect(x, y + 3, 1, h - 3, '#6a4020'); p.rect(x + w - 1, y + 3, 1, h - 3, '#6a4020'); }
function paintCrate(o) { const p = new Pix(24, o.stack ? 34 : 20); if (o.stack) { crateAt(p, 1, 15, 22, 19); crateAt(p, 5, 1, 15, 14); } else crateAt(p, 1, 0, 22, 20);
  if (o.fill) { const r = rng(o.seed || 2); for (let i = 0; i < 6; i++) p.ell(4 + i * 3 + r(), o.stack ? 1 : 0, 2, 1.6, pal(o.fill, 4, .5, .4)); } return p.done({ ax: 12, ay: p.h - 1 }); }
function paintHay() { const p = new Pix(32, 20), H = ['#8a6a1e', '#b8902e', '#d8b048', '#f0d070']; p.ell(16, 11, 15, 8.5, H); for (let i = 0; i < 40; i++) { const x = 3 + (i * 7) % 27, y = 4 + (i * 5) % 13; if (p.on(x, y)) p.line(x, y, x + 2, y + 1, i % 2 ? H[0] : H[3]); } p.rect(9, 3, 1, 16, '#7a4a1e'); p.rect(22, 3, 1, 16, '#7a4a1e'); return p.done({ ax: 16, ay: 19 }); }
function wheel(p, cx, cy, R) { for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) { const d = Math.hypot(x, y); if (d < R + .5 && d > R - 1.6) p.set(cx + x, cy + y, d > R - .6 ? WOOD[0] : WOOD[2]); }
  for (let a = 0; a < TAU; a += TAU / 6) p.line(cx, cy, cx + Math.cos(a) * (R - 1), cy + Math.sin(a) * (R - 1), WOOD[1]); p.rect(cx - 1, cy - 1, 3, 3, IRON[2]); }
function paintCart(o) { const p = new Pix(62, 40);
  if (o.load === 'hay') p.ell(30, 15, 24, 10, ['#8a6a1e', '#b8902e', '#d8b048', '#f0d070']);
  else for (const [x, y, c] of [[14, 17, '#e07a22'], [25, 15, '#e9a43a'], [36, 17, '#d06a1e'], [46, 17, '#e07a22'], [30, 9, '#c84a2a'], [20, 9, '#e07a22'], [40, 10, '#f0b040']]) p.ell(x, y, 6, 5, pal(c, 4, .5, .35));
  p.rect(4, 20, 50, 10, WOOD[2]); p.rect(4, 20, 50, 2, WOOD[4]); for (let x = 8; x < 54; x += 8) p.rect(x, 22, 1, 8, WOOD[1]); p.rect(4, 29, 50, 1, WOOD[0]);
  p.line(54, 26, 61, 31, WOOD[1]); p.line(54, 27, 61, 32, WOOD[3]); wheel(p, 16, 31, 8); wheel(p, 42, 31, 8);
  return p.done({ ax: 30, ay: 39 }); }
function paintWell() { const p = new Pix(42, 54), RF = pal('#b8482a', 5, .5, .3);
  p.col_(6, 10, 3, 34, WOOD); p.col_(33, 10, 3, 34, WOOD);
  p.poly([[0, 14], [21, 1], [42, 14]], RF, { vert: true }); p.rect(2, 13, 38, 2, '#5a2416');
  p.rect(8, 19, 26, 2, WOOD[1]); p.rect(20, 21, 1, 10, '#c8a870'); p.rect(18, 30, 5, 5, WOOD[2]); p.rect(18, 31, 5, 1, IRON[1]);
  bricks(p, 3, 40, 36, 13, '#9a8e80', 6, 3, 8); p.ell(21, 40, 18, 4, pal('#9a8e80', 4, .4, .3)); p.ell(21, 40, 14, 2.6, '#1a1620'); p.ell(21, 40.5, 10, 1.4, '#2e4a5a');
  return p.done({ ax: 21, ay: 53 }); }
function paintLamp() { const p = new Pix(16, 48); p.col_(7, 12, 2, 33, IRON.slice(0, 3)); p.rect(5, 44, 6, 4, IRON[1]); p.rect(4, 44, 8, 1, IRON[2]);
  p.rect(4, 3, 8, 9, '#2a2630'); p.rect(5, 4, 6, 7, '#ffcf6a'); p.rect(6, 5, 4, 5, '#fff2c0'); p.poly([[3, 3], [8, -1], [13, 3]], '#2a2630'); p.rect(7, 11, 2, 2, '#2a2630'); p.rect(7, 4, 1, 7, '#3a3036');
  return p.done({ ax: 8, ay: 47 }); }
function paintBench() { const p = new Pix(36, 18); p.rect(2, 8, 32, 3, WOOD[3]); p.rect(2, 8, 32, 1, WOOD[4]); p.rect(2, 2, 32, 3, WOOD[2]); p.rect(2, 2, 32, 1, WOOD[3]); p.rect(4, 11, 2, 7, WOOD[1]); p.rect(30, 11, 2, 7, WOOD[1]); p.rect(4, 5, 2, 3, WOOD[1]); p.rect(30, 5, 2, 3, WOOD[1]); return p.done({ ax: 18, ay: 17 }); }
function paintPlanter(o) { const p = new Pix(30, 18), r = rng(o.seed || 5);
  for (let i = 0; i < 8; i++) p.leaf(3 + r() * 24, 10, 3, 1, -2 + r(), ['#2e5a2a', '#4a7a34', '#6a9a44']);
  for (let i = 0; i < 12; i++) { const x = 3 + r() * 24 | 0, y = 3 + r() * 6 | 0; p.line(x, y, x, 10, '#4a6a2a'); const c = ['#e04a5a', '#f2b63c', '#fff0d8', '#b07ad0', '#f07a3a'][(r() * 5) | 0]; p.set(x, y, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y, '#f8e070'); }
  p.rect(2, 10, 26, 7, WOOD[2]); p.rect(2, 10, 26, 1, WOOD[4]); p.rect(2, 16, 26, 1, WOOD[0]); p.rect(9, 10, 1, 7, WOOD[1]); p.rect(20, 10, 1, 7, WOOD[1]);
  return p.done({ ax: 15, ay: 17 }); }
const STALLS = { baker: ['#c83a2a', '#fff0dc'], apoth: ['#3a7a5a', '#f0e8c8'], produce: ['#d8902a', '#fff0dc'] };
function paintStall(o) { const aw = STALLS[o.kind], p = new Pix(70, 58), r = rng(o.kind.length * 7);
  p.col_(4, 14, 3, 43, WOOD); p.col_(63, 14, 3, 43, WOOD);
  // goods on the counter
  if (o.kind === 'baker') { for (let i = 0; i < 5; i++) { const x = 10 + i * 11; p.ell(x, 33, 5, 3.2, ['#7a3a12', '#a85a1e', '#d08a3a', '#f0b864']); p.line(x - 2, 32, x + 1, 31, '#f8d898'); }
    p.ell(30, 27, 7, 3, ['#8a4a1a', '#c07a34', '#e8a858']); p.ell(30, 26, 5, 1.6, '#f8e0b0'); for (let i = 0; i < 4; i++) p.set(27 + i * 2, 26, '#c03a3a');
    p.line(46, 24, 56, 34, '#c88a3a'); p.line(47, 24, 57, 34, '#e8b060'); p.line(50, 23, 58, 31, '#d89a4a'); }
  else if (o.kind === 'apoth') { const C = ['#7ad0c0', '#e07ab0', '#f0c040', '#9a7ad8', '#e85a4a', '#8ad87a'];
    for (let i = 0; i < 9; i++) { const x = 9 + i * 6, h = 4 + (i * 5) % 4, c = C[i % 6]; p.rect(x, 36 - h, 4, h, c); p.rect(x, 36 - h, 4, 1, lite(c, .4)); p.rect(x + 1, 34 - h, 2, 2, '#c8b898'); p.set(x + 1, 33 - h, '#8a5a34'); }
    for (let i = 0; i < 5; i++) { const x = 12 + i * 11; p.line(x, 16, x, 21, '#6a5a3a'); p.leaf(x, 21, 4, 1.4, 1.57, ['#4a6a2a', '#6a8a3a', '#9aaa5a']); } }
  else { for (let i = 0; i < 6; i++) p.ell(10 + i * 10, 32, 5, 4, pal(['#e07a22', '#c83a2a', '#e9a43a', '#7a9a3a', '#d06a1e', '#b8302a'][i], 4, .5, .35)); for (let i = 0; i < 4; i++) p.ell(16 + i * 12, 27, 4, 3, pal(['#c83a2a', '#e8c040', '#9ab040', '#c83a2a'][i], 4, .5, .35)); }
  p.rect(2, 36, 66, 4, WOOD[4]); p.rect(2, 36, 66, 1, lite(WOOD[4], .3)); p.rect(2, 40, 66, 17, WOOD[2]); for (let x = 2; x < 68; x += 6) p.rect(x, 40, 1, 17, WOOD[1]); p.rect(2, 56, 66, 1, WOOD[0]);
  p.poly([[0, 5], [70, 5], [64, 0], [6, 0]], pal(aw[0], 4, .5, .3));
  for (let y = 5; y < 15; y++) for (let x = 0; x < 70; x++) { const c = aw[Math.floor(x / 7) % 2]; p.set(x, y, y < 7 ? lite(c, .15) : y > 12 ? dark(c, .15) : c); }
  for (let k = 0; k < 10; k++) p.ell(k * 7 + 3.5, 15, 3.5, 2.4, aw[k % 2], { only: (x, y) => y >= 15 });
  return p.done({ ax: 35, ay: 57 }); }
function paintBanner(o) { const c = o.c || '#b8302a', p = new Pix(20, 72); p.col_(2, 4, 2, 67, ['#3a2a1e', '#5a4430', '#7a5e40']); p.ell(3, 3, 2.2, 2.2, ['#a8781a', '#e8b84a', '#fff0a0']);
  p.rect(3, 8, 16, 1, '#5a4430'); p.poly([[4, 9], [18, 9], [18, 44], [11, 38], [4, 44]], pal(c, 5, .45, .3), { vert: true }); p.rect(4, 9, 15, 1, '#e8b84a');
  p.ell(11, 23, 3.2, 3.6, ['#a8781a', '#e8b84a', '#fff0a0']); p.ell(11, 19.6, 3.6, 1.6, '#7a4a1e'); p.set(11, 17, '#7a4a1e');
  return p.done({ ax: 3, ay: 71 }); }
function paintAnvil() { const p = new Pix(30, 24); p.col_(8, 15, 14, 9, WOOD); p.poly([[2, 5], [26, 5], [30, 7], [22, 10], [20, 14], [10, 14], [8, 10], [2, 8]], IRON); p.rect(2, 5, 25, 1, IRON[4]); p.rect(10, 13, 10, 3, IRON[1]); p.rect(20, 3, 6, 2, '#ff8a3a'); p.rect(21, 3, 4, 1, '#ffd070'); return p.done({ ax: 15, ay: 23 }); }
function paintHearth() { const p = new Pix(56, 46); bricks(p, 2, 8, 52, 38, '#8a4a3a', 6, 3, 4);
  p.poly([[4, 9], [52, 9], [44, 0], [12, 0]], pal('#5a4a48', 5, .5, .3)); fire(p, 12, 20, 44, 42, 7); p.rect(0, 42, 56, 4, '#6a5a50'); p.rect(0, 42, 56, 1, '#9a8a7a');
  return p.done({ ax: 28, ay: 45 }); }
function paintBellows() { const p = new Pix(36, 18); p.poly([[3, 4], [22, 2], [24, 9], [22, 16], [3, 14]], ['#4a2a16', '#6e4024', '#8e5a34', '#a87048']);
  p.rect(2, 2, 22, 2, WOOD[3]); p.rect(2, 14, 22, 2, WOOD[2]); p.rect(23, 8, 12, 2, IRON[2]); p.rect(33, 7, 2, 4, IRON[1]); p.rect(0, 1, 3, 3, WOOD[1]); p.rect(0, 14, 3, 3, WOOD[1]);
  for (let x = 6; x < 22; x += 4) p.line(x, 4, x, 14, '#3a2010'); return p.done({ ax: 17, ay: 17 }); }
function paintTrough() { const p = new Pix(40, 16); p.rect(2, 4, 36, 9, WOOD[2]); p.rect(2, 4, 36, 1, WOOD[4]); p.rect(4, 5, 32, 3, '#3a7a90'); p.rect(4, 5, 32, 1, '#9ad0d8'); p.set(12, 6, '#d8f0f0'); p.set(26, 6, '#d8f0f0'); p.rect(4, 13, 3, 3, WOOD[1]); p.rect(33, 13, 3, 3, WOOD[1]); return p.done({ ax: 20, ay: 15 }); }
function paintCoal() { const p = new Pix(28, 12), r = rng(4); for (let i = 0; i < 26; i++) p.ell(4 + r() * 20, 6 + r() * 5, 2 + r() * 1.5, 1.6, ['#141418', '#24242a', '#3a3a44']); p.set(12, 6, '#ff7a2a'); return p.done({ ax: 14, ay: 11 }); }
function paintLaundry(o) { const p = new Pix(96, 46), r = rng(o.seed || 3); p.col_(2, 4, 3, 41, WOOD); p.col_(91, 4, 3, 41, WOOD);
  const yAt = x => 6 + Math.sin((x - 3) / 90 * Math.PI) * 6; for (let x = 4; x < 92; x++) p.set(x, yAt(x), '#d8d0c0');
  const C = ['#c83a2a', '#e8c040', '#3a7aa8', '#fff4e0', '#8a5ab0', '#5a9a5a', '#f07a3a'];
  for (let x = 10; x < 84;) { const w = 8 + (r() * 9 | 0), c = C[(r() * C.length) | 0], y0 = Math.round(yAt(x + w / 2)) + 1, h = 8 + (r() * 10 | 0), P_ = pal(c, 4, .35, .3);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y0 + j, p.shadeOf(P_, clamp(.75 - j / h * .4 + ((i + (j >> 1)) % 5 === 0 ? -.2 : 0), 0, 1), x + i, y0 + j));
    if (r() < .5) for (let i = 0; i < w; i += 3) p.rect(x + i, y0 + 2, 1, h - 2, dark(c, .2)); p.set(x + 1, y0 - 1, '#8a6a4a'); p.set(x + w - 2, y0 - 1, '#8a6a4a'); x += w + 3 + (r() * 4 | 0); }
  return p.done({ ax: 48, ay: 45 }); }
function paintAppleTree(o) { const r = rng(o.seed || 12), C = treePal('apple'), p = new Pix(76, 96), BK = ['#3a2218', '#5a3624', '#7a4e34', '#9a6a48'];
  p.col_(33, 50, 10, 44, BK); p.poly([[30, 95], [33, 86], [43, 86], [46, 95]], BK.slice(0, 3)); p.line(38, 60, 24, 48, BK[1]); p.line(40, 56, 54, 46, BK[1]);
  for (const [x, y, rx, ry] of [[38, 32, 27, 21], [20, 42, 15, 12], [56, 40, 16, 13], [30, 18, 15, 12], [50, 20, 14, 12]]) p.ell(x + (r() - .5) * 4, y + (r() - .5) * 4, rx + r() * 3, ry + r() * 2, C);
  for (let i = 0; i < 60; i++) { const x = 12 + r() * 52 | 0, y = 8 + r() * 46 | 0; if (p.on(x, y) && p.on(x, y + 1)) p.set(x, y, C[(r() * 2 | 0) + (y < 30 ? 3 : 1)]); }
  const AP_ = [[22, 30], [50, 26], [36, 44], [28, 14], [58, 40], [14, 42]]; for (let i = 0; i < (o.n == null ? 6 : o.n + 3); i++) { const [x, y] = AP_[i % AP_.length]; p.ell(x, y, 2.6, 2.6, ['#7a1414', '#b82424', '#e04a3a', '#ff8a6a']); p.set(x, y - 3, '#4a2a10'); }
  return p.done({ ax: 38, ay: 95 }); }
function paintDummy() { const p = new Pix(26, 44); p.col_(12, 14, 2, 30, WOOD); p.rect(3, 17, 20, 2, WOOD[2]); p.ell(13, 24, 6, 8, ['#8a6a1e', '#b8902e', '#d8b048', '#f0d070']); p.ell(13, 24, 3, 3, '#c83a2a'); p.ell(13, 24, 1.5, 1.5, '#fff0dc');
  p.ell(13, 10, 5, 5, ['#a88a5a', '#c8aa78', '#e0c890']); p.ell(13, 6.5, 6, 3, IRON.slice(1), { only: (x, y) => y <= 7 }); p.rect(7, 7, 13, 1, IRON[1]); p.set(11, 10, '#5a4020'); p.set(15, 10, '#5a4020'); return p.done({ ax: 13, ay: 43 }); }
function paintHive() { const p = new Pix(20, 24), H = ['#8a6a1e', '#b8902e', '#d8b048', '#f0d070']; p.rect(3, 21, 14, 3, WOOD[1]); for (let k = 0; k < 5; k++) p.ell(10, 18 - k * 3.4, 8.5 - k * 1.4, 2.6, H); p.ell(10, 18, 2, 1.6, '#2a1a0a'); return p.done({ ax: 10, ay: 23 }); }
function paintScope() { const p = new Pix(26, 36); p.line(13, 18, 5, 35, WOOD[1]); p.line(13, 18, 21, 35, WOOD[2]); p.line(13, 18, 13, 35, WOOD[0]);
  for (let k = -1; k <= 1; k++) p.line(4, 19 + k, 22, 9 + k, k ? '#a8781a' : '#e8b84a'); p.ell(22.5, 9, 1.6, 2.4, '#9ad0f0'); p.rect(3, 18, 3, 3, '#7a5410'); return p.done({ ax: 13, ay: 35 }); }
function paintKeg() { const p = new Pix(26, 28); p.rect(3, 22, 20, 6, WOOD[1]); p.rect(3, 22, 20, 1, WOOD[3]);
  p.ell(13, 12, 10.5, 10.5, WOOD); ring(p, 13, 12, 10, IRON[1]); ring(p, 13, 12, 6.5, WOOD[1]); p.ell(13, 12, 3, 3, WOOD[3]); p.rect(12, 20, 3, 3, '#c8a040'); p.set(13, 23, '#c8a040'); return p.done({ ax: 13, ay: 27 }); }
function paintTable(o) { const p = new Pix(44, 28), r = rng(o.seed || 3); p.rect(2, 10, 40, 4, WOOD[3]); p.rect(2, 10, 40, 1, WOOD[4]); p.rect(2, 14, 40, 2, WOOD[1]); p.rect(5, 16, 3, 12, WOOD[1]); p.rect(36, 16, 3, 12, WOOD[1]);
  for (const x of [7, 30]) { p.rect(x, 5, 4, 5, '#b88a4a'); p.rect(x, 4, 4, 2, '#fff8e8'); p.set(x + 4, 7, '#8a6030'); }
  p.rect(20, 3, 2, 7, '#f8e8c8'); p.set(20, 1, '#ffd070'); p.set(21, 0, '#fff2c0'); p.set(20, 2, '#ffb040');
  if (r() < .7) { p.ell(14 + r() * 2, 9, 4, 1.4, '#e8dcc8'); p.ell(14, 8, 2.6, 1.2, ['#a85a1e', '#d08a3a']); } return p.done({ ax: 22, ay: 27 }); }
function paintStool() { const p = new Pix(14, 12); p.ell(7, 3, 6, 2, WOOD.slice(2)); p.rect(3, 4, 2, 8, WOOD[1]); p.rect(9, 4, 2, 8, WOOD[1]); return p.done({ ax: 7, ay: 11 }); }
function paintBar() { const p = new Pix(100, 28), r = rng(9); p.rect(0, 8, 100, 20, WOOD[2]); for (let x = 0; x < 100; x += 10) { p.rect(x, 10, 1, 18, WOOD[1]); p.rect(x + 3, 13, 4, 11, WOOD[1]); p.rect(x + 3, 13, 4, 1, WOOD[3]); }
  p.rect(0, 5, 100, 4, WOOD[4]); p.rect(0, 5, 100, 1, lite(WOOD[4], .3)); p.rect(0, 27, 100, 1, WOOD[0]);
  for (let i = 0; i < 7; i++) { const x = 6 + i * 13 + r() * 4 | 0; if (i % 3 === 1) { p.rect(x, 0, 3, 5, ['#4a8a4a', '#8a3a2a', '#c8a040'][i % 3]); p.rect(x + 1, -1, 1, 2, '#c8b898'); } else { p.rect(x, 1, 4, 4, '#b88a4a'); p.rect(x, 0, 4, 1, '#fff8e8'); } }
  return p.done({ ax: 50, ay: 27 }); }
function paintFireplace() { const p = new Pix(72, 70); bricks(p, 2, 0, 68, 70, '#8a8478', 8, 4, 9); p.rect(0, 24, 72, 4, WOOD[3]); p.rect(0, 24, 72, 1, WOOD[4]); p.rect(0, 28, 72, 1, WOOD[0]);
  for (const [x, c] of [[8, '#c8a040'], [16, '#8a5ab0'], [56, '#4a8a6a'], [62, '#c83a2a']]) { p.rect(x, 18, 4, 6, c); p.rect(x + 1, 16, 2, 2, '#c8b898'); }
  p.ell(36, 20, 6, 4, ['#3a3a44', '#5a5a66', '#7a7a88']); p.rect(30, 34, 42 - 30, 1, '#1a1010');
  for (let y = 32; y < 68; y++) for (let x = 14; x < 58; x++) { const dx = (x - 36) / 22, top = 44 - Math.sqrt(Math.max(0, 1 - dx * dx)) * 12; if (y >= top) p.set(x, y, '#1a0e0a'); }
  fire(p, 20, 46, 52, 66, 3); p.rect(22, 63, 28, 3, WOOD[1]); p.rect(26, 61, 20, 2, WOOD[2]); p.rect(10, 66, 52, 4, '#6a6258');
  return p.done({ ax: 36, ay: 69 }); }
function paintShelf() { const p = new Pix(48, 54), r = rng(21), C = ['#c83a2a', '#e8c040', '#4a8a6a', '#8a5ab0', '#7ad0c0', '#e07a22', '#f0e8d8'];
  p.rect(0, 0, 48, 54, WOOD[1]); p.rect(2, 2, 44, 50, '#3a2416');
  for (const y of [16, 32, 48]) { p.rect(2, y, 44, 3, WOOD[3]); p.rect(2, y, 44, 1, WOOD[4]); for (let x = 4; x < 44;) { const w = 3 + (r() * 4 | 0), h = 5 + (r() * 8 | 0), c = C[(r() * C.length) | 0]; if (r() < .4) p.ell(x + 2.5, y - 3, 2.6, 3, pal(c, 3, .4, .4)); else { p.rect(x, y - h, w, h, c); p.rect(x, y - h, w, 1, lite(c, .4)); } x += w + 1 + (r() * 3 | 0); } }
  return p.done({ ax: 24, ay: 53 }); }
function paintFrame() { const p = new Pix(30, 24); p.rect(0, 0, 30, 24, '#a8781a'); p.rect(1, 1, 28, 22, '#e8b84a'); p.rect(3, 3, 24, 18, '#7aa0c8'); p.rect(3, 13, 24, 8, '#5a8a3a'); p.ell(15, 11, 5, 4, treePal('autumn')); p.rect(14, 14, 2, 4, '#5a3624'); p.ell(23, 6, 2, 2, '#fff0a0'); return p.done({ ax: 15, ay: 23 }); }
function paintWindowIn() { const p = new Pix(36, 40); p.rect(0, 0, 36, 40, WOOD[1]); p.rect(3, 3, 30, 30, '#2a3a6a'); for (let y = 3; y < 33; y++) for (let x = 3; x < 33; x++) p.set(x, y, p.shadeOf(['#1a2450', '#2a3a6a', '#3a5a8a', '#6a8ab0'], 1 - y / 40, x, y));
  p.rect(17, 3, 2, 30, WOOD[2]); p.rect(3, 17, 30, 2, WOOD[2]); p.rect(0, 33, 36, 4, WOOD[3]); p.set(8, 8, '#fff8d0'); p.set(26, 10, '#fff8d0'); p.set(12, 24, '#fff8d0');
  p.ell(8, 34, 3, 2, '#4a7a34'); p.set(8, 31, '#e04a5a'); p.set(28, 31, '#f2b63c'); p.ell(28, 34, 3, 2, '#4a7a34'); return p.done({ ax: 18, ay: 39 }); }
function paintRack() { const p = new Pix(34, 38); p.rect(2, 8, 30, 3, WOOD[2]); p.rect(2, 30, 30, 3, WOOD[2]); p.rect(3, 8, 2, 30, WOOD[1]); p.rect(29, 8, 2, 30, WOOD[1]);
  for (let i = 0; i < 4; i++) { const x = 8 + i * 6; p.rect(x, 2, 1, 32, WOOD[3]); p.poly([[x + .5, 0], [x + 2, 4], [x - 1, 4]], IRON.slice(2)); }
  p.ell(17, 22, 6, 7, ['#5a1414', '#8a2420', '#b4382c']); p.ell(17, 22, 2, 2.4, ['#a8781a', '#e8b84a']); return p.done({ ax: 17, ay: 37 }); }
function paintNotice() { const p = new Pix(42, 46); p.col_(4, 8, 3, 38, WOOD); p.col_(35, 8, 3, 38, WOOD); p.rect(1, 6, 40, 26, WOOD[2]); p.rect(3, 8, 36, 22, '#8a6a44'); p.poly([[0, 7], [21, 0], [42, 7]], pal('#b8482a', 4, .5, .3));
  p.rect(5, 9, 18, 19, '#f4e4c4'); p.rect(7, 11, 14, 3, '#c83a2a'); for (let y = 16; y < 26; y += 2) p.rect(7, y, 10 + (y % 4), 1, '#8a7a6a'); p.ell(14, 23, 2, 2, '#e8b84a');
  p.rect(25, 10, 12, 9, '#fff0d8'); p.rect(27, 12, 8, 1, '#8a7a6a'); p.rect(27, 14, 6, 1, '#8a7a6a'); p.rect(26, 21, 11, 7, '#e8f0d8'); p.rect(28, 23, 6, 1, '#7a8a6a');
  for (const [x, y] of [[14, 9], [31, 10], [31, 21]]) p.set(x, y, '#c83a2a'); return p.done({ ax: 21, ay: 45 }); }
function paintCoin() { const p = new Pix(10, 10); p.ell(5, 5, 4.6, 4.6, ['#7a4a1a', '#b8702a', '#e8a040', '#ffd27a']); ring(p, 5, 5, 3, '#a8601a'); p.rect(4, 3, 2, 4, '#ffe8a0'); return p.done({ ax: 5, ay: 9 }); }
function paintApple() { const p = new Pix(10, 11); p.ell(5, 6.5, 4.4, 4.2, ['#6a1010', '#a82020', '#d84030', '#ff7a5a']); p.rect(5, 0, 1, 3, '#4a2a10'); p.leaf(6, 2, 3, 1.2, -.4, ['#4a6a2a', '#6a8a3a', '#9aaa5a']); p.set(3, 5, '#ffc0a0'); return p.done({ ax: 5, ay: 10 }); }
function paintGlowcap() { const p = new Pix(12, 14); p.col_(4, 6, 4, 7, ['#a8b8c8', '#d8e8f0', '#f4fcff']); p.ell(6, 6, 5.6, 4.4, ['#1a5a8a', '#2a8ac0', '#5ac8f0', '#a8f0ff'], { only: (x, y) => y <= 7 }); p.set(4, 4, '#e8ffff'); p.set(8, 3, '#e8ffff'); return p.done({ ax: 6, ay: 13 }); }
function paintHoney() { const p = new Pix(12, 13); p.rect(2, 4, 8, 8, '#e8a020'); p.rect(3, 5, 6, 6, '#f8c040'); p.rect(3, 5, 2, 3, '#ffe890'); p.rect(1, 2, 10, 2, '#e8dcc8'); p.rect(2, 1, 8, 1, '#c83a2a'); p.rect(4, 7, 4, 3, '#fff4dc'); p.set(5, 8, '#c8902a'); p.set(6, 8, '#c8902a'); return p.done({ ax: 6, ay: 12 }); }
function paintTin() { const p = new Pix(14, 9); p.poly([[1, 2], [13, 2], [11, 8], [3, 8]], IRON.slice(1)); p.rect(0, 1, 14, 2, IRON[4]); p.rect(2, 3, 10, 1, IRON[1]); return p.done({ ax: 7, ay: 8 }); }
function paintPie() { const p = new Pix(18, 11); p.poly([[1, 5], [17, 5], [15, 10], [3, 10]], IRON.slice(1)); p.ell(9, 5, 8, 3.4, ['#8a4a1a', '#c07a34', '#e8a858', '#f8d090']); for (let i = 0; i < 3; i++) p.line(4 + i * 4, 3, 6 + i * 4, 6, '#a85a24'); p.set(9, 2, '#c03a3a'); return p.done({ ax: 9, ay: 10 }); }
function paintInvite() { const p = new Pix(14, 10); p.rect(0, 1, 14, 9, '#f4e4c4'); p.line(0, 1, 7, 6, '#c8b090'); p.line(13, 1, 7, 6, '#c8b090'); p.ell(7, 6, 2, 2, ['#8a1a1a', '#c83a2a']); return p.done({ ax: 7, ay: 9 }); }
function paintPaperLantern(o) { const c = o.c || '#ff8a3a', p = new Pix(8, 10); p.rect(3, 0, 2, 1, '#2a2020'); p.ell(4, 5, 3.6, 4, [dark(c, .2), c, lite(c, .4), lite(c, .7)]); p.rect(2, 9, 4, 1, '#2a2020'); return p.done({ ax: 4, ay: 0, outline: false }); }
function paintBell() { const p = new Pix(18, 18); p.ell(9, 9, 7, 8, ['#6a4a10', '#a8781a', '#e8b84a', '#fff0a0'], { only: (x, y) => y >= 2 }); p.rect(1, 15, 16, 2, '#a8781a'); p.rect(8, 0, 2, 3, IRON[2]); p.ell(9, 17, 1.6, 1.4, IRON[1]); return p.done({ ax: 9, ay: 0 }); }
function paintRope() { const p = new Pix(6, 40); for (let y = 0; y < 34; y++) p.set(2 + ((y >> 1) % 2), y, y % 2 ? '#c8a870' : '#a88850'); p.ell(3, 36, 2.6, 3.4, ['#8a1a1a', '#c83a2a', '#e85a4a']); return p.done({ ax: 3, ay: 39 }); }

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
  lantern: { paint: paintLantern, solid: [[0, 0, 3]], light: ['#ffbf5a', 24, 1] },
  basket: { paint: paintBasket, solid: [[0, -2, 7]] },
  pedestal: { paint: paintPedestal, solid: [[0, -2, 9]] },
  bigtree: { paint: paintBigTree, solid: [[-56, -6, 15], [-32, -10, 20], [0, -12, 20], [32, -10, 20], [56, -6, 15]], sway: .002 },
  stone: { low: true },
  leafpile: { paint: paintLeafPile },
  pumpkin: { paint: paintPumpkin, solid: [[0, -2, 8]] },
  lily: { paint: paintLily, low: true },
  // Hearthvale ('inst': drawn as one instanced mesh per sprite; 'emi': glowing pixels; 'light': [colour, height, strength])
  barrel: { paint: paintBarrel, solid: [[0, -2, 9]], inst: true },
  crate: { paint: paintCrate, solid: [[0, -3, 12]], inst: true },
  hay: { paint: paintHay, solid: [[-6, -3, 11], [6, -3, 11]], inst: true },
  cart: { paint: paintCart, solid: [[-22, -4, 12], [0, -4, 12], [22, -4, 12]] },
  well: { paint: paintWell, solid: [[0, -4, 20]] },
  lamp: { paint: paintLamp, solid: [[0, 0, 3]], light: ['#ffbf5a', 50, 1], emi: 'lamp' },
  bench: { paint: paintBench, solid: [[-12, -2, 7], [12, -2, 7]], inst: true },
  planter: { paint: paintPlanter, solid: [[-8, -3, 8], [8, -3, 8]], inst: true, seeded: true },
  stall: { paint: paintStall, solid: [[-34, -3, 8], [-12, -3, 10], [12, -3, 10], [34, -3, 8]] },
  banner: { paint: paintBanner, solid: [[0, 0, 3]], sway: .004 },
  anvil: { paint: paintAnvil, solid: [[0, -3, 11]] },
  hearth: { paint: paintHearth, light: ['#ff8a3a', 30, 1.5], emi: 'fire' },
  bellows: { paint: paintBellows, solid: [[0, -3, 12]] },
  trough: { paint: paintTrough, solid: [[-10, -3, 9], [10, -3, 9]] },
  coal: { paint: paintCoal, solid: [[0, -2, 9]] },
  laundry: { paint: paintLaundry, solid: [[-46, -1, 3], [46, -1, 3]] },
  appletree: { paint: paintAppleTree, solid: [[0, 0, 10]], sway: .008 },
  dummy: { paint: paintDummy, solid: [[0, -1, 6]], inst: true },
  hive: { paint: paintHive, solid: [[0, -2, 8]], inst: true },
  scope: { paint: paintScope, solid: [[0, -2, 7]] },
  keg: { paint: paintKeg, solid: [[0, -3, 11]], inst: true },
  table: { paint: paintTable, solid: [[-12, -3, 10], [12, -3, 10]], light: ['#ffb060', 22, .5], emi: 'lamp' },
  stool: { paint: paintStool, inst: true },
  bar: { paint: paintBar, solid: [[-50, -4, 10], [-30, -4, 10], [-10, -4, 10], [10, -4, 10], [30, -4, 10], [50, -4, 10]] },
  fireplace: { paint: paintFireplace, light: ['#ff9a3a', 22, 1.7], emi: 'fire', solid: [[-30, -2, 10], [0, -2, 12], [30, -2, 10]] },
  shelf: { paint: paintShelf, inst: true },
  frame: { paint: paintFrame },
  winin: { paint: paintWindowIn },
  rack: { paint: paintRack, solid: [[0, -2, 12]] },
  notice: { paint: paintNotice, solid: [[-14, -1, 4], [14, -1, 4]] },
  rope: { paint: paintRope },
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
const ACORNS = 12, LEAVES = 5, COINS = 8;
const streamX = y => 250 + 16 * Math.sin(y / 55 + .6);
const STREAM_HW = 32;

const AREADEF = {
  clearing: {
    name: 'Sunny Clearing', pal: 'meadow', w: 480, h: 400,
    exits: [{ e: 'n', a: 208, b: 272, to: 'grove', sx: 240, sy: 378 }, { e: 'e', a: 226, b: 284, to: 'stream', sx: 16, sy: 255 }, { e: 'w', a: 226, b: 284, to: 'hollow', sx: 464, sy: 255 }, { e: 's', a: 208, b: 272, to: 'road', sx: 240, sy: GT + 24 }],
    paths: [[[240, 40], [238, 150], [244, 252], [330, 258], [490, 254]], [[244, 252], [150, 256], [-10, 254]], [[244, 252], [238, 330], [240, 410]]],
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
    items: [['a7', 'acorn', 58, 232], ['a8', 'acorn', 436, 214], ['a9', 'acorn', 212, 332], ['gc', 'glowcap', 118, 262]],
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
  // ---------------- Hearthvale: the road out of the wood, the town gate, and the town beyond
  road: {
    name: 'Harvest Road', pal: 'meadow', w: 480, h: 400,
    exits: [{ e: 'n', a: 208, b: 272, to: 'clearing', sx: 240, sy: 384 }, { e: 'e', a: 226, b: 284, to: 'gate', sx: 16, sy: 255 }],
    paths: [[[240, 40], [236, 160], [262, 236], [340, 256], [490, 255]]],
    props: [['tree', 96, 150, { pal: 'gold' }], ['tree', 410, 150, { pal: 'autumn' }], ['cart', 140, 244, { load: 'pumpkins' }], ['hay', 92, 288, {}], ['hay', 122, 306, {}], ['sign', 330, 214, {}], ['lantern', 300, 300, {}], ['lantern', 196, 120, {}],
      ['pumpkin', 182, 292, {}], ['pumpkin', 196, 300, { c: '#e9a43a' }], ['leafpile', 380, 320, {}], ['fern', 60, 200, {}], ['mush', 420, 300, { s: .5, cap: '#e2493b' }], ['flowers', 300, 140, {}], ['rock', 70, 360, {}], ['bush', 440, 360, { pal: 'amber' }], ['banner', 452, 214, { c: '#b8302a' }]],
    items: [['c1', 'coin', 380, 120]],
    npcs: [], objs: ['roadsign'],
  },
  gate: {
    name: 'Hearthvale Gate', pal: 'town', kind: 'town', back: 'wall', border: 'forest', ground: 'grass', w: 480, h: 400,
    exits: [{ e: 'w', a: 226, b: 284, to: 'road', sx: 464, sy: 255 }, { e: 'n', a: 214, b: 266, to: 'market', sx: 280, sy: 404, need: 'gateOpen' }],
    paths: [[[-10, 255], [140, 258], [232, 206], [240, 40]]],
    props: [['lamp', 200, 80, {}], ['lamp', 280, 80, {}], ['barrel', 350, 88, {}], ['barrel', 366, 96, {}], ['crate', 150, 90, { stack: true }], ['crate', 126, 96, {}], ['hay', 380, 214, {}], ['cart', 386, 306, { load: 'hay' }], ['notice', 132, 176, {}],
      ['tree', 70, 330, { pal: 'amber' }], ['tree', 446, 150, { pal: 'gold' }], ['pumpkin', 424, 252, {}], ['pumpkin', 410, 262, { c: '#d06a1e' }], ['leafpile', 96, 140, {}], ['flowers', 200, 340, {}], ['planter', 176, 84, { seed: 2 }], ['planter', 316, 84, { seed: 3 }]],
    items: [['c2', 'coin', 420, 364]],
    npcs: ['corvin'], objs: ['notice'],
    strings: [[[-40, 47, 47], [190, 47, 47], 6], [[290, 47, 47], [520, 47, 47], 6]],
    critters: [['hen', 330, 160], ['hen', 300, 190]],
  },
  market: {
    name: 'Market Square', pal: 'town', kind: 'town', back: 'houses', ground: 'cobble', plaza: [280, 236, 96], w: 560, h: 420,
    exits: [{ e: 's', a: 256, b: 304, to: 'gate', sx: 240, sy: GT + 26 }, { e: 'e', a: 226, b: 284, to: 'lanes', sx: 16, sy: 255 }, { e: 'w', a: 226, b: 284, to: 'forge', sx: 404, sy: 255 }, { e: 'n', a: 262, b: 298, to: 'keep', sx: 240, sy: 386 }],
    paths: [[[280, 430], [280, 330]], [[280, 140], [280, 40]], [[-10, 255], [184, 250]], [[376, 250], [570, 255]]],
    shops: [{ x0: 70, x1: 180, style: 'cream', roof: 'tile', sign: 'bread', door: .5, gable: true, chim: true, h: 52 }, { x0: 384, x1: 470, style: 'sage', roof: 'slate', sign: 'herb', door: .4, h: 50 }],
    fountain: { x: 280, y: 236, r: 34 },
    props: [['stall', 128, 140, { kind: 'baker' }], ['stall', 432, 140, { kind: 'apoth' }], ['stall', 472, 334, { kind: 'produce' }],
      ['lamp', 194, 168, {}], ['lamp', 366, 168, {}], ['lamp', 194, 312, {}], ['lamp', 366, 312, {}],
      ['banner', 36, 110, { c: '#b8302a' }], ['banner', 522, 110, { c: '#2e5a8a' }], ['banner', 36, 362, { c: '#2e5a8a' }], ['banner', 522, 362, { c: '#b8302a' }],
      ['barrel', 62, 150, {}], ['barrel', 74, 158, {}], ['crate', 204, 120, { fill: '#e07a22' }], ['crate', 360, 120, { stack: true }], ['barrel', 500, 160, {}], ['planter', 236, 124, { seed: 1 }], ['planter', 324, 124, { seed: 4 }],
      ['cart', 100, 354, { load: 'pumpkins' }], ['pumpkin', 418, 352, {}], ['pumpkin', 432, 362, { c: '#e9a43a' }], ['hay', 520, 400, {}]],
    items: [['c3', 'coin', 56, 300]],
    npcs: ['clover', 'tansy', 'fbramble', 'fpip', 'fsorrel', 'fwick', 'fhob', 'frusset', 'fpuddle'], objs: ['fountain'],
    strings: [[[36, 84, 112], [522, 84, 112], 10], [[280, 40, 236], [70, 62, 48], 14], [[280, 40, 236], [490, 62, 48], 14]],
    critters: [['cat', 470, 176], ['hen', 120, 250], ['hen', 150, 270]],
  },
  lanes: {
    name: 'Lantern Lane', pal: 'town', kind: 'town', back: 'houses', ground: 'cobble', w: 520, h: 400,
    exits: [{ e: 'w', a: 226, b: 284, to: 'market', sx: 544, sy: 255 }, { e: 'n', a: 300, b: 336, to: 'chapel', sx: 240, sy: 386 }],
    paths: [[[-10, 255], [200, 250], [318, 200], [318, 40]], [[160, 60], [166, 140], [200, 250]]],
    shops: [{ x0: 96, x1: 224, style: 'ochre', roof: 'thatch', sign: 'mug', door: .5, big: true, gable: true, h: 58, chim: true }, { x0: 384, x1: 468, style: 'rose', roof: 'tile', sign: 'needle', door: .35, h: 50 }],
    props: [['keg', 84, 86, {}], ['barrel', 238, 88, {}], ['barrel', 252, 96, {}], ['crate', 62, 100, { stack: true }], ['lamp', 128, 82, {}], ['lamp', 278, 186, {}], ['lamp', 470, 240, {}],
      ['laundry', 420, 300, { seed: 4 }], ['well', 90, 330, {}], ['bench', 200, 330, {}], ['planter', 360, 86, { seed: 2 }], ['planter', 490, 100, { seed: 3 }], ['cart', 460, 150, { load: 'hay' }], ['crate', 380, 360, { fill: '#c83a2a' }]],
    items: [['c4', 'coin', 486, 368]],
    npcs: ['russet'], objs: ['taverndoor'],
    strings: [[[96, 60, 47], [224, 60, 47], 8], [[384, 52, 47], [470, 52, 47], 6], [[128, 58, 82], [278, 58, 186], 12]],
    critters: [['cat', 252, 82], ['hen', 300, 320]],
  },
  forge: {
    name: "Hob's Forge", pal: 'town', kind: 'town', back: 'forge', ground: 'cobble', w: 420, h: 400, reserve: [[100, 320]],
    exits: [{ e: 'e', a: 226, b: 284, to: 'market', sx: 16, sy: 255 }],
    paths: [[[430, 255], [300, 250], [212, 150]]],
    props: [['hearth', 210, GT - 40, {}], ['bellows', 156, 90, {}], ['anvil', 252, 120, {}], ['trough', 330, 118, {}], ['coal', 108, 112, {}], ['rack', 70, 150, {}], ['barrel', 360, 90, {}], ['barrel', 376, 98, {}],
      ['crate', 60, 300, { stack: true }], ['hay', 340, 330, {}], ['lamp', 300, 200, {}], ['cart', 120, 340, { load: 'hay' }]],
    items: [['c5', 'coin', 54, 220]],
    npcs: ['hob'], objs: ['bellows'],
    critters: [['hen', 260, 300]],
  },
  tavern: {
    name: 'The Mossy Mug', pal: 'inn', kind: 'inside', ground: 'wood', w: 360, h: 300,
    exits: [{ e: 's', a: 160, b: 200, to: 'lanes', sx: 160, sy: GT + 30 }],
    paths: [],
    props: [['fireplace', 250, GT - 2, {}], ['shelf', 50, GT - 4, {}], ['winin', 150, GT - 6, { lift: 24 }], ['frame', 330, GT - 6, { lift: 40 }], ['keg', 110, GT + 2, {}], ['keg', 132, GT + 4, {}], ['bar', 96, 132, {}],
      ['table', 214, 186, { seed: 1 }], ['table', 290, 242, { seed: 2 }], ['table', 84, 236, { seed: 3 }], ['stool', 190, 196, {}], ['stool', 238, 196, {}], ['stool', 266, 252, {}], ['stool', 314, 252, {}], ['stool', 60, 246, {}], ['stool', 108, 246, {}], ['barrel', 336, 120, {}], ['barrel', 20, 160, {}]],
    items: [['c6', 'coin', 326, 284]],
    npcs: ['barnaby', 'puddle', 'fen'], objs: ['brick'],
    strings: [[[-6, 74, GT - 6], [366, 74, GT - 6], 6]],
    critters: [['cat', 214, 92]],
  },
  chapel: {
    name: 'Chapel Hill', pal: 'town', kind: 'town', back: 'chapel', ground: 'cobble', view: 'e', w: 480, h: 400, reserve: [[70, 330]],
    exits: [{ e: 's', a: 220, b: 260, to: 'lanes', sx: 318, sy: GT + 26 }],
    paths: [[[240, 410], [236, 230], [130, 120], [108, 60]]],
    props: [['rope', 108, GT + 20, {}], ['tree', 420, 150, { pal: 'gold' }], ['tree', 40, 330, { pal: 'crimson' }], ['hive', 370, 300, {}], ['hive', 394, 312, {}], ['bench', 330, 236, {}], ['scope', 440, 228, {}], ['lamp', 176, 150, {}],
      ['planter', 300, 90, { seed: 1 }], ['planter', 336, 90, { seed: 2 }], ['flowers', 380, 180, {}], ['flowers', 140, 300, {}], ['leafpile', 300, 360, {}], ['pumpkin', 70, 180, {}]],
    items: [['c7', 'coin', 64, 236]],
    npcs: ['nutmeg'], objs: ['bellrope', 'scope'],
    strings: [[[136, 74, 48], [420, 54, 150], 10]],
  },
  keep: {
    name: 'Keep Courtyard', pal: 'town', kind: 'town', back: 'keep', ground: 'cobble', w: 480, h: 400, reserve: [[10, 470]],
    exits: [{ e: 's', a: 220, b: 260, to: 'market', sx: 280, sy: GT + 26 }],
    paths: [[[240, 410], [240, 220], [240, 60]]],
    props: [['appletree', 380, 170, { id: 'appletree' }], ['bush', 84, 84, { pal: 'hedge', berries: false }], ['bush', 84, 112, { pal: 'hedge', berries: false, id: 'fakehedge' }], ['bush', 84, 146, { pal: 'hedge', berries: false }],
      ['bush', 52, 150, { pal: 'hedge', berries: false }], ['bush', 20, 150, { pal: 'hedge', berries: false }], ['dummy', 300, 300, {}], ['dummy', 340, 306, {}], ['rack', 400, 290, {}], ['hay', 430, 340, {}], ['well', 136, 270, {}],
      ['banner', 180, 92, { c: '#2e5a8a' }], ['banner', 300, 92, { c: '#2e5a8a' }], ['crate', 440, 96, { stack: true }], ['barrel', 420, 92, {}], ['lamp', 200, 200, {}], ['cart', 90, 352, { load: 'pumpkins' }]],
    items: [['c8', 'coin', 440, 364], ['g5', 'leaf', 38, 98]],
    npcs: ['marigold'], objs: ['appletree'],
    strings: [[[120, 120, 38], [362, 120, 38], 18]],
    critters: [['hen', 200, 330], ['hen', 230, 350], ['hen', 330, 210]],
  },
};

// NPCs and things you can talk to / poke
const NPCS = {
  bramble: { area: 'clearing', kind: 'hedgehog', name: 'Bramble', color: '#9a6440', x: 196, y: 300, h: 34, range: 34 },
  pip: { area: 'stream', kind: 'frog', name: 'Pip', color: '#4f9a45', x: streamX(330) - 15, y: 334, h: 26, range: 34, front: true },
  sorrel: { area: 'grove', kind: 'snail', name: 'Sorrel', color: '#c86d93', x: 304, y: 282, h: 28, range: 30 },
  wick: { area: 'hollow', kind: 'owl', name: 'Old Wick', color: '#7a604c', x: 336, y: 207, dy: -15, h: 50, range: 34, front: true },
  // Hearthvale
  corvin: { area: 'gate', kind: 'crow', name: 'Corvin', color: '#4a4a6a', x: 300, y: 96, h: 40, top: 50, range: 34 },
  clover: { area: 'market', kind: 'rabbit', name: 'Clover', color: '#c0605a', x: 150, y: 168, h: 40, top: 50, range: 32 },
  tansy: { area: 'market', kind: 'mouse', name: 'Tansy', color: '#4a8a5a', x: 412, y: 168, h: 30, top: 36, range: 30 },
  russet: { area: 'lanes', kind: 'fox', name: 'Russet', color: '#c8642a', x: 350, y: 296, h: 36, top: 44, range: 32, hideFest: true },
  hob: { area: 'forge', kind: 'badger', name: 'Hob', color: '#5a5a66', x: 212, y: 128, h: 36, top: 42, range: 34, hideFest: true },
  barnaby: { area: 'tavern', kind: 'mole', name: 'Barnaby', color: '#6a4a7a', x: 96, y: 108, h: 32, top: 40, range: 48 },
  puddle: { area: 'tavern', kind: 'duck', name: 'Puddle', color: '#2e7a7a', x: 300, y: 126, h: 34, top: 40, range: 32, hideFest: true },
  fen: { area: 'tavern', kind: 'toad', name: 'Fen', color: '#7a6034', x: 240, y: 206, h: 20, top: 26, range: 30 },
  marigold: { area: 'keep', kind: 'tortoise', name: 'Lady Marigold', color: '#8a5ab0', x: 214, y: 150, h: 30, top: 38, range: 36 },
  nutmeg: { area: 'chapel', kind: 'squirrel', name: 'Nutmeg', color: '#b8582a', x: 168, y: 112, h: 34, top: 42, range: 32 },
  // the festival crowd in the square (only there once the bell has rung)
  fbramble: { area: 'market', kind: 'hedgehog', name: 'Bramble', color: '#9a6440', x: 220, y: 326, h: 34, range: 32, fest: true },
  fpip: { area: 'market', kind: 'frog', name: 'Pip', color: '#4f9a45', x: 254, y: 340, h: 20, top: 24, range: 28, fest: true, land: true },
  fsorrel: { area: 'market', kind: 'snail', name: 'Sorrel', color: '#c86d93', x: 392, y: 262, h: 28, range: 30, fest: true },
  fwick: { area: 'market', kind: 'owl', name: 'Old Wick', color: '#7a604c', x: 164, y: 232, h: 40, top: 40, range: 32, fest: true, land: true, front: true },
  fhob: { area: 'market', kind: 'badger', name: 'Hob', color: '#5a5a66', x: 392, y: 206, h: 36, top: 42, range: 32, fest: true },
  frusset: { area: 'market', kind: 'fox', name: 'Russet', color: '#c8642a', x: 222, y: 150, h: 36, top: 44, range: 32, fest: true },
  fpuddle: { area: 'market', kind: 'duck', name: 'Puddle', color: '#2e7a7a', x: 340, y: 330, h: 34, top: 40, range: 32, fest: true },
};

// ---------------------------------------------------------------- state
const S = {
  mode: 'title', area: null, A: null, px: 240, py: 300, facing: 1, flip: 1, back: false, walk: 0, moving: false,
  got: new Set(), acorns: 0, leaves: 0, coins: 0, apples: 0, flags: {}, talks: {}, t: 0, playT: 0, finishT: null, endKind: 'supper',
  heat: 0, heatT: 0, gateT: 9, bellT: 0, dk: 0, idle: 0, qShow: 0, qa: 0, festT: null, fw: [], musT: 0, musI: 0,
  dlg: null, trans: null, banner: null, toasts: [], floaters: [], sparks: [], pops: {}, confetti: [], hud: 0, dir: 'down',
  camX: 0, camY: 0, target: null, playP: null,
};
const AREAS = {};
function distSeg(px, py, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; const t = l ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0, 1) : 0; return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); }
function nearPath(A, x, y, d) { return A.paths.some(pl => pl.some((q, i) => i && distSeg(x, y, pl[i - 1], q) < d)); }
function buildArea(id) {
  const d = AREADEF[id], ap = AP[d.pal], r = rng(id.length * 977 + d.w);
  const A = Object.assign({ id, ap, stones: [], kind: 'forest' }, d); A.props = [];
  A.border = d.border || (A.kind === 'forest' ? 'forest' : A.kind);
  const add = (k, x, y, o) => A.props.push(Object.assign({ k, x, y, seed: (x * 7 + y * 13) | 0, ph: r() * TAU }, o || {}));
  const inExit = (e, v, m) => A.exits.some(x => x.e === e && v > x.a - m && v < x.b + m) || (id === 'stream' && e === 'n' && Math.abs(v - streamX(GT)) < 34 + m);
  const treePal = () => (ap.trees || AP.meadow.trees)[(r() * (ap.trees || AP.meadow.trees).length) | 0];
  // border: a back row of trees along the top (forest only: town areas have buildings), then the sides and the front
  if (A.kind === 'forest') {
    for (let x = 6 + r() * 10; x < A.w; x += 30 + r() * 12) if (!inExit('n', x, 22)) add(r() < .3 ? 'pine' : 'tree', x, GT + 12 + r() * 12, { pal: treePal() });
    for (let x = 20 + r() * 20; x < A.w; x += 44 + r() * 20) if (!inExit('n', x, 30)) add(r() < .4 ? 'pine' : 'tree', x, GT - 2 + r() * 6, { pal: treePal() });
  }
  if (A.border === 'forest') {
    for (const side of ['w', 'e']) for (let y = GT + 52 + r() * 10; y < A.h - 14; y += 38 + r() * 14) {
      if (inExit(side, y, 26)) continue;
      const x = side === 'w' ? 6 + r() * 8 : A.w - 6 - r() * 8; add(r() < .3 ? 'bush' : r() < .5 ? 'pine' : 'tree', x, y, { pal: treePal() });
    }
    for (let x = 10 + r() * 10; x < A.w; x += 30 + r() * 14) if (!inExit('s', x, 22)) add(r() < .7 ? 'bush' : 'fern', x, A.h - 2 - r() * 4, { pal: treePal(), berries: r() < .4 });
  } else if (A.border === 'town') {   // crates, barrels, flower boxes and hedges where the square meets the houses
    const pick = () => { const q = r(); return q < .28 ? ['barrel', {}] : q < .5 ? ['crate', { stack: r() < .4 }] : q < .75 ? ['planter', { seed: 1 + (r() * 4 | 0) }] : ['bush', { pal: 'hedge', berries: false }]; };
    for (const side of ['w', 'e']) { if (side === 'e' && A.view === 'e') continue; for (let y = GT + 44 + r() * 10; y < A.h - 14; y += 36 + r() * 18) {
      if (inExit(side, y, 26)) continue; const [k, o] = pick(); add(k, side === 'w' ? 4 + r() * 5 : A.w - 4 - r() * 5, y, o); } }
    for (let x = 14 + r() * 10; x < A.w; x += 32 + r() * 18) { if (inExit('s', x, 24) || (A.view === 'e' && x > A.w - 30)) continue; const [k, o] = pick(); add(k, x, A.h - 1 - r() * 3, o); }
  }
  d.props.forEach(q => add(q[0], q[1], q[2], q[3]));
  // a sprinkle of low decoration away from paths and water
  const nDeco = A.kind === 'inside' ? 0 : A.kind === 'town' ? (A.ground === 'grass' ? 7 : 4) : 9;
  for (let i = 0, tries = 0; i < nDeco && tries < 200; tries++) {
    const x = 30 + r() * (A.w - 60), y = GT + 40 + r() * (A.h - GT - 70);
    if (nearPath(A, x, y, 22) || (A.water && A.water(x, y)) || (A.water && A.water(x + 14, y)) || (A.water && A.water(x - 14, y))) continue;
    if (A.fountain && Math.hypot(x - A.fountain.x, y - A.fountain.y) < A.fountain.r + 30) continue;
    if (A.props.some(p => Math.hypot(p.x - x, p.y - y) < 26) || d.npcs.some(n => Math.hypot(NPCS[n].x - x, NPCS[n].y - y) < 40)) continue;
    if (A.kind === 'town') { add(r() < .6 ? 'leafpile' : 'flowers', x, y, {}); i++; continue; }
    { const q = r(); add(q < .45 ? 'leafpile' : q < .75 ? 'fern' : q < .9 ? 'mush' : 'flowers', x, y, q >= .75 && q < .9 ? { s: .4 + r() * .2, cap: ['#c4542f', '#e08a2a', '#9a6fc0'][(r() * 3) | 0] } : {}); } i++;
  }
  A.solids = [];
  for (const p of A.props) { const sd = pv(PROPDEF[p.k].solid, p); if (sd && p.id !== 'fakebush' && p.id !== 'fakehedge') sd.forEach(s => A.solids.push({ x: p.x + s[0], y: p.y + s[1], r: s[2] })); }
  if (A.fountain) A.solids.push({ x: A.fountain.x, y: A.fountain.y, r: A.fountain.r + 1 });
  for (const nid of d.npcs) { const n = NPCS[nid]; A.solids.push({ x: n.x, y: n.y, r: n.kind === 'frog' && !n.land ? 1 : n.kind === 'tortoise' ? 12 : 8, fest: n.fest, hideFest: n.hideFest }); }
  A.items = d.items.map(q => ({ id: q[0], type: q[1], x: q[2], y: q[3], ph: r() * TAU }));
  A.motes = []; const nm = ap.fireflies || 7;
  for (let i = 0; i < nm; i++) A.motes.push({ x: r() * A.w, y: GT + r() * (A.h - GT), ph: r() * TAU, sp: .3 + r() * .5, glow: true, z: 4 + r() * 30 });
  // god-ray beams pouring through canopy gaps: top point, angle, width, length (+ a few dust motes each)
  A.beams = []; const nb = id === 'glade' ? 4 : A.kind === 'inside' ? 2 : A.kind === 'town' ? 2 : 3;
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
const fakeHedge = AREAS.keep.props.find(p => p.id === 'fakehedge');

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
  coin() { tone(1319, .08, 'square', .03); tone(1976, .22, 'triangle', .05, 0, .06); },
  item() { [659, 880, 1109].forEach((f, i) => tone(f, .22, 'triangle', .06, 0, i * .07)); },
  thud() { tone(110, .18, 'sine', .14, .5); },
  whoosh() { tone(240, .28, 'sawtooth', .03, .35); },
  roar() { tone(90, .7, 'sawtooth', .05, 1.8); tone(180, .5, 'triangle', .05, 1.5, .1); },
  clang() { [0, .3, .55].forEach(d => { tone(1480, .25, 'square', .025, .8, d); tone(990, .3, 'triangle', .05, 0, d); }); },
  gate() { tone(80, 1.1, 'sawtooth', .04, 1.6); for (let i = 0; i < 6; i++) tone(300 + i * 20, .05, 'square', .02, 0, i * .15); },
  door() { tone(150, .14, 'triangle', .08, .7); tone(110, .2, 'sine', .08, 0, .1); },
  bell() { for (let k = 0; k < 3; k++) { tone(196, 1.6, 'sine', .12, 0, k * .9); tone(392, 1.2, 'sine', .05, 0, k * .9); tone(587, .8, 'triangle', .03, 0, k * .9); } },
};
// a little festival tune (lute-ish triangle notes), and Puddle strumming in the tavern
const TUNE = [659, 784, 880, 784, 659, 587, 523, 587, 659, 659, 784, 880, 988, 880, 784, 659];

// ---------------------------------------------------------------- dialogue & interactions
function say(name, color, portrait, lines, onEnd) {
  S.dlg = { name, color, portrait, lines: lines.filter(Boolean), i: 0, shown: 0, onEnd, wrapped: null };
}
const festReady = () => !!(S.flags.done && S.flags.pie);
function questPing() { S.qShow = 5; }
function give(flag, text) { if (S.flags[flag]) return; S.flags[flag] = true; toast(text); sfx.item(); questPing(); checkReady(); }
function checkReady() { if (festReady() && !S.flags.readyToast && !S.flags.fest) { S.flags.readyToast = true; setTimeout(() => toast('Supper and pie are ready! Ring the chapel bell in Hearthvale.'), 600); } }
const hint = (nid, arr) => { const k = (S.talks[nid] = (S.talks[nid] || 0) + 1); return arr[(k - 1) % arr.length]; };
function talkTo(nid) {
  const n = NPCS[nid], F = S.flags; let lines, onEnd;
  const left = LEAVES - S.leaves;
  if (nid === 'bramble') {
    if (F.done) lines = F.fest ? ['What a night! Go on, the festival is in the market square.'] : F.pie ? ['The pie is baked? Then ring the chapel bell in Hearthvale! Up Lantern Lane.'] : ['Supper\'s ready! Now Hearthvale needs its pie.', F.gateOpen ? 'Clover the baker is in the market square.' : 'Take the road south and show Corvin my invitation at the gate.', left ? 'They say ' + left + ' golden leaf' + (left > 1 ? 'ves are' : ' is') + ' still hiding somewhere...' : 'All five golden leaves! You know these parts better than I do.'];
    else if (!F.metBramble) { lines = ['Oh! A visitor! I\'m Bramble.', 'Last night a gust tipped my basket and scattered my acorns all over Thimblewood.', 'Twelve acorns. Without them there\'s no Harvest Supper!', 'Could you find them? Try the stream to the east, the grove up north and the old hollow to the west.', 'And take this invitation! The town of Hearthvale, down the south road, holds its Harvest Festival tonight.']; onEnd = () => { F.metBramble = true; give('invite', 'Got: Festival invitation'); }; }
    else if (S.acorns >= ACORNS) { lines = ['All twelve! Every last one!', 'The Harvest Supper is saved. Acorn cakes for the whole wood!']; onEnd = supper; }
    else lines = [S.acorns ? S.acorns + ' of 12 so far. Lovely!' : 'No acorns yet? They roll everywhere!', S.acorns >= 6 ? 'Have you poked around the old hollow? Owls hoard things.' : 'Mind the stepping stones on the stream.', !F.gateOpen ? 'Don\'t forget my invitation for Corvin at the Hearthvale gate.' : null];
  } else if (nid === 'pip') {
    lines = S.got.has('g1') ? ['Ribbit! You found the island leaf. Nobody ever spots those low stones.'] : ['Ribbit. Mind the stones, they\'re slippery.', 'Some stones sit so low you\'d hardly see them. Look upstream, by the little island.'];
  } else if (nid === 'sorrel') {
    lines = F.bounced ? ['Told you it was springy.', F.askedGlow && !F.glowcap && !F.honey ? 'Glowcaps? The blue ones glow over by the west side of the grove.' : 'Sloooow down and enjoy the glow, little one.'] : ['Sloooow down, little one...', 'That big pink mushroom is ever so springy.', 'Go on. Give it a poke.'];
  } else if (nid === 'wick') {
    lines = F.metWick ? ['Hoo. Still wandering? Good.', 'Not every bush along the north edge is as thick as it looks.'] : ['Hoo. A young sprout, wandering alone?', 'This tree was old before the stream learned to run.', 'If you\'re after acorns, try reaching into the hollow. And mind the north bushes. Not all of them are as thick as they look.'];
    onEnd = () => { F.metWick = true; };
  } else if (nid === 'corvin') {
    if (!F.gateOpen && !F.invite) lines = ['Halt! Who goes... oh. A sprout.', 'Hearthvale\'s gate stays shut until the Harvest Festival. Invited guests only.', 'Bramble the hedgehog hands out invitations, if you know her. Sunny Clearing, up the road.'];
    else if (!F.gateOpen) { lines = ['An invitation, signed by Bramble herself! Caw!', 'Raise the portcullis! Welcome to Hearthvale, little traveller.']; onEnd = () => { F.gateOpen = true; S.gateT = 0; sfx.gate(); questPing(); toast('The gate is open! Market Square lies beyond.'); }; }
    else lines = F.fest ? ['Caw! Even guards get pie tonight.'] : [hint('corvin', ['Market Square\'s just through the gate. Mind the hens.', 'Lost coins? Russet the tailor was wailing about her purse all morning. Lantern Lane, east of the square.', 'Between you and me: the hedge in the keep courtyard has a soft spot in its north-west corner.'])];
  } else if (nid === 'clover') {
    const hasAll = F.honey && F.tin && S.apples >= 3;
    if (F.fest) lines = ['Best festival in years! Have a slice, there\'s plenty.'];
    else if (F.pie) lines = [F.done ? 'The pie\'s cooling! Now Nutmeg can ring the chapel bell. Up Lantern Lane, then north.' : 'The pie\'s cooling! Now we only need Bramble\'s Harvest Supper from the wood.', F.done ? null : 'Twelve acorns, she said. Then come and ring the bell!'];
    else if (!F.metClover) { lines = ['Oh, a customer! I\'m Clover, Hearthvale\'s baker.', F.invite ? 'Bramble\'s invitation! Then you\'re here for the Harvest Festival.' : null, 'I\'ve promised the town my Harvest Pie tonight, but I\'m missing three things:', 'A jar of honey, a new pie tin and three good apples.', 'Tansy at the apothecary stall has honey. Hob the smith makes tins. And the best apples grow in the keep courtyard, north of here.']; onEnd = () => { F.metClover = true; questPing(); }; }
    else if (hasAll) { lines = ['Honey, a shiny tin and three perfect apples!', 'Into the oven it goes... smell that?', 'The Harvest Pie is baking!']; onEnd = () => { S.apples -= 3; F.pie = true; sfx.done(); toast('Harvest Pie: baked!'); burst(150, 168, 24); questPing(); checkReady(); }; }
    else { const need = []; if (!F.honey) need.push('honey from Tansy'); if (!F.tin) need.push('a pie tin from Hob'); if (S.apples < 3) need.push((3 - S.apples) + ' more apple' + (3 - S.apples > 1 ? 's' : '') + ' from the keep'); lines = ['Still need ' + need.join(', ') + '.', 'Hurry back, the oven\'s warm!']; }
  } else if (nid === 'tansy') {
    if (F.fest) lines = ['A night-light tonic, brewed with your glowcap. Look how it shines!'];
    else if (F.honey) lines = [hint('tansy', ['Don\'t eat it all on the way, mind.', 'Nutmeg\'s telescope up on Chapel Hill sees the whole town. Lovely view.'])];
    else if (F.glowcap) { lines = ['Is that... a glowcap? Perfect for my night-light tonic!', 'Here: one jar of wildflower honey. A fair trade.']; onEnd = () => { F.glowcap = false; give('honey', 'Got: Jar of honey'); }; }
    else { lines = ['Tansy, apothecary. Tinctures, tonics, honey for coughs.', 'Honey for Clover\'s pie? I\'ll trade you a jar for a glowcap.', 'Little glowing blue mushrooms. They grow in the Mushroom Grove, deep in Thimblewood.']; onEnd = () => { F.askedGlow = true; questPing(); }; }
  } else if (nid === 'hob') {
    if (F.tin) lines = ['Good fire. Good day.', 'Clover\'ll want that tin back full, you watch.'];
    else if (F.forgeHot) { lines = ['That\'s the stuff! Now watch...', '*CLANG* *CLANG* *clang*', 'One pie tin, still warm. Don\'t tell Clover I dented the rim.']; onEnd = () => { give('tin', 'Got: Pie tin'); sfx.clang(); }; }
    else { lines = ['Hob. Smith. Forge has gone cold, see.', F.metClover ? 'A pie tin for Clover? Need the fire roaring first.' : 'Need the fire roaring before I make anything.', 'Work the bellows. Quick pumps, mind! Four of them, before it cools.']; onEnd = () => { F.metHob = true; }; }
  } else if (nid === 'russet') {
    if (F.ribbon) lines = ['That ribbon suits you! Every flag in the square, I stitched myself.'];
    else if (S.coins >= COINS) { lines = ['All eight coins! You\'re a treasure.', 'Here, a festival ribbon for your cap. Made it myself!']; onEnd = () => { give('ribbon', 'Got: Festival ribbon (it\'s on your cap!)'); }; }
    else if (!F.metRusset) { lines = ['Oh! Hello! Russet, tailor. I\'d sew you a cape if I weren\'t so flustered.', 'I dropped my purse on the road from the wood and eight coins rolled off everywhere!', S.coins ? 'You\'ve found ' + S.coins + ' already? Bless you!' : 'If you find any, I\'d be ever so grateful.']; onEnd = () => { F.metRusset = true; questPing(); }; }
    else lines = [S.coins + ' of 8 so far. Thank you!', hint('russet', ['One rolled all the way to the forge, I think.', 'Another bounced into the Mossy Mug. And one up Chapel Hill!', 'Did one fly over the keep wall? I hope not.'])];
  } else if (nid === 'barnaby') {
    lines = F.fest ? ['Tonight the cider\'s on the house!'] : [hint('barnaby', ['Welcome to the Mossy Mug! Barnaby\'s the name, cider\'s the game.', 'Festival tonight, so we\'re brewing double.', 'My granddad hid his treasures behind a loose brick by the fireplace. Never found what he left there.'])];
    if (!F.metBarnaby) { lines = ['Welcome to the Mossy Mug! Barnaby\'s the name, cider\'s the game.', 'Festival tonight, so we\'re brewing double.', 'Psst. My granddad hid his treasures behind a loose brick by the fireplace. Never did find what he left there.']; onEnd = () => { F.metBarnaby = true; }; }
  } else if (nid === 'puddle' || nid === 'fpuddle') {
    lines = F.fest ? ['~ Oh the leaves come down in Thimblewood, and the lanterns rise in Hearthvale... ~', 'Dance! Everybody dance!'] : ['~ La la, the Mossy Mug... ~', 'Puddle, bard. I play here every night. Tonight, the whole square!'];
  } else if (nid === 'fen') {
    lines = [hint('fen', ['Mrrrp. Fen. Been sat here since spring.', 'Glowcaps grow in the Mushroom Grove, west side, if you\'ve the legs for it. I haven\'t.', 'That brick by the fire wobbles. Barnaby pretends it doesn\'t.'])];
  } else if (nid === 'marigold') {
    if (F.fest) lines = ['A marvellous festival, dear. The keep hasn\'t seen such lanterns in years.'];
    else if (!F.metMarigold) { lines = ['Lady Marigold, steward of Hearthvale Keep. Charmed.', 'Apples for Clover\'s pie? The orchard tree is right over there.', 'The low branches are bare, I\'m afraid. Give the trunk a good shake.']; onEnd = () => { F.metMarigold = true; }; }
    else lines = [S.apples >= 3 || F.pie ? 'Slow and steady fills the basket, dear.' : 'Shake the tree, dear. Gently!', hint('marigold', ['The hedge in the corner? Purely ornamental. Rather thin, if I\'m honest.', 'The bell is rung from Chapel Hill, at the top of Lantern Lane.'])];
  } else if (nid === 'nutmeg') {
    if (F.fest) lines = ['Lovely ringing, that! You\'ve a knack.'];
    else if (festReady()) lines = ['Pie baked AND the wood\'s supper ready? Then it\'s time!', 'Pull the bell rope by the tower door. Hard as you can!'];
    else lines = ['Nutmeg, bell-ringer! I ring the chapel bell to start the Harvest Festival.', 'But not until Clover\'s pie is baked and Bramble\'s supper is ready. Tradition!', hint('nutmeg', ['Have a look through my telescope while you\'re up here.', 'From up here you can see the whole town, and the wood beyond.'])];
  } else if (n.fest) {
    lines = { fbramble: ['Acorn cakes AND Clover\'s pie! Best supper ever.', 'You brought the whole wood and the whole town together.'], fpip: ['Ribbit! The fountain\'s nice. Not as nice as the stream.'], fsorrel: ['Sloooow dance, everyone...'], fwick: ['Hoo. I haven\'t seen lanterns like these in a hundred autumns.'], fhob: ['Made the lantern hooks myself. Good iron.'], frusset: ['Look at all the bunting! I stitched every flag.'] }[nid] || ['What a night!'];
  }
  say(n.name, n.color, n.kind, lines, onEnd);
}
function shakeTree() {
  const F = S.flags, A = AREAS.keep, P = A.props.find(p => p.id === 'appletree');
  if (!F.metMarigold) return say('Apple tree', '#8a6a3a', null, ['A fine apple tree. It belongs to the keep. Better ask the steward first.']);
  P.rustle = 1; sfx.thud();
  if ((F.shakes || 0) >= 3) return toast('No more apples within reach.');
  const k = F.shakes = (F.shakes || 0) + 1, spots = [[346, 198], [410, 200], [380, 214]], [x, y] = spots[k - 1];
  A.items.push({ id: 'ap' + k, type: 'apple', x, y, ph: 0, pop: { t: 0, x0: P.x + (x - P.x) * .3, y0: P.y - 70 } });
  toast(k < 3 ? 'An apple drops!' : 'The last apple drops!');
}
function pumpBellows() {
  const F = S.flags; if (F.forgeHot) return toast('The forge is roaring already.');
  S.heat = Math.min(4, (S.heat || 0) + 1); S.heatT = 2.4; sfx.whoosh(); burst(210, GT - 30, 6);
  if (S.heat >= 4) { F.forgeHot = true; sfx.roar(); toast('The forge roars to life!'); burst(210, GT - 30, 30); questPing(); }
}
function ringBell() {
  const F = S.flags; S.bellT = 1.6; sfx.bell();
  if (F.fest) return toast('Dong... dong...');
  if (!festReady()) return say('Bell rope', '#7a5a3a', null, ['You give the rope a tug. The bell gives a sleepy \u201cbong\u201d.', 'Nutmeg pokes her head out: "Not yet! The pie and the supper have to be ready first!"']);
  say('The chapel bell', '#b8902a', null, ['DONG... DONG... DONG...', 'The bell\'s song rolls over the rooftops and deep into the wood.', 'Everyone is heading for the market square!'], startFestival);
}
function startFestival() {
  S.trans = { t: 0, dur: 1.6, to: 'market', sx: 280, sy: 372, dir: 'n', swapped: false, onSwap: () => { S.flags.fest = true; S.dk = 2; S.festT = 0; S.dir = 'up'; S.back = true; questPing(); } };
}
function festivalSpeech() {
  say('Clover', '#c0605a', 'rabbit', ['The bell! The Harvest Festival begins!', 'Bramble\'s acorn cakes, my Harvest Pie, Puddle\'s music, Hob\'s lantern hooks...', 'Thank you, little traveller. Thimblewood and Hearthvale, together again!'], festivalEnd);
}
const OBJS = {
  sign: { area: 'clearing', x: 286, y: 224, h: 44, range: 26, use() { say('Signpost', '#a2724a', null, ['West: The Old Hollow  \u00b7  North: Mushroom Grove  \u00b7  East: Stepping Stream  \u00b7  South: Hearthvale', 'Someone has carved a tiny acorn into the post.']); } },
  bouncy: { area: 'grove', x: 250, y: 178, h: 64, top: 50, range: 30, use() {
    S.bounceT = 1; sfx.bounce();
    if (!S.flags.bounced) { S.flags.bounced = true; const it = { id: 'g2', type: 'leaf', x: 268, y: 208, ph: 0, pop: { t: 0, x0: 250, y0: 150 } }; AREAS.grove.items.push(it); }
  } },
  door: { area: 'hollow', x: 240, y: 186, h: 56, top: 62, range: 28, use() {
    if (!S.flags.door) { S.flags.door = true; say('The Old Hollow', '#8b5a3c', null, ['You reach into the warm, dark hollow...', 'An acorn! Someone tucked it away for safekeeping.'], () => collect({ id: 'a12', type: 'acorn', x: 240, y: 190 })); }
    else say('The Old Hollow', '#8b5a3c', null, ['Just dust, a lost button and a very sleepy beetle.']);
  } },
  roadsign: { area: 'road', x: 330, y: 216, h: 44, range: 26, use() { say('Signpost', '#a2724a', null, ['North: Thimblewood  \u00b7  East: Hearthvale', 'Below, a painted lantern: "Harvest Festival tonight!"']); } },
  notice: { area: 'gate', x: 132, y: 178, h: 50, top: 56, range: 28, use() { say('Notice board', '#a2724a', null, ['HARVEST FESTIVAL - TONIGHT! Market Square, Hearthvale.', 'Pie by Clover  \u00b7  Supper by Bramble  \u00b7  Music by Puddle', 'The bell is rung by Nutmeg when all is ready.', 'Small print: "LOST - one purse, eight coins. Reward! - Russet, Lantern Lane"']); } },
  fountain: { area: 'market', x: 280, y: 272, h: 40, top: 40, range: 30, use() { say('Fountain', '#5a8aa8', null, S.flags.fest ? ['The lanterns shimmer in the water.', 'Someone has tossed in a wish: "more pie".'] : ['A stone fountain topped with a carved acorn.', 'The water is cold and very clear.']); } },
  taverndoor: { area: 'lanes', x: 160, y: GT + 22, h: 30, top: 34, range: 26, use() { sfx.door(); S.trans = { t: 0, dur: .9, to: 'tavern', sx: 180, sy: 282, dir: 'n', swapped: false }; } },
  bellows: { area: 'forge', x: 156, y: 94, h: 20, top: 26, range: 28, use: pumpBellows },
  brick: { area: 'tavern', x: 204, y: GT + 18, h: 30, top: 34, range: 26, use() {
    if (S.got.has('g4')) return say('Loose brick', '#8a6a5a', null, ['Just a cosy little hole now.']);
    say('Loose brick', '#8a6a5a', null, ['You wiggle the loose brick beside the fireplace...', 'Behind it: a golden leaf, warm from the fire!'], () => collect({ id: 'g4', type: 'leaf', x: 204, y: GT + 18 })); } },
  bellrope: { area: 'chapel', x: 108, y: GT + 22, h: 40, top: 44, range: 28, use: ringBell },
  scope: { area: 'chapel', x: 440, y: 230, h: 40, top: 40, range: 28, use() { say('Telescope', '#a8781a', null, ['You peer through the brass telescope...', 'Rooftops, chimney smoke, and the wood beyond, all gold and red.', 'Down in the keep courtyard, something glints behind the north-west hedge.']); } },
  appletree: { area: 'keep', x: 380, y: 182, h: 80, top: 70, range: 32, use: shakeTree },
};
function collect(it) {
  if (S.got.has(it.id)) return; S.got.add(it.id);
  if (it.type === 'acorn') { S.acorns++; S.hud = 1; sfx.acorn(); S.floaters.push({ x: it.x, y: it.y - 14, t: 0, text: S.acorns + '/12' });
    if (S.acorns === ACORNS && !S.flags.done) toast('That\'s all twelve! Take them back to Bramble.');
  } else if (it.type === 'coin') { S.coins++; S.hud = 1; sfx.coin(); S.floaters.push({ x: it.x, y: it.y - 14, t: 0, text: S.coins + '/' + COINS }); if (S.coins === COINS && !S.flags.ribbon) toast('All eight coins! Russet will be thrilled.'); questPing(); }
  else if (it.type === 'apple') { S.apples++; sfx.acorn(); S.floaters.push({ x: it.x, y: it.y - 14, t: 0, text: 'apple ' + Math.min(3, S.apples) + '/3' }); questPing(); }
  else if (it.type === 'glowcap') { S.flags.glowcap = true; sfx.leaf(); toast('A glowcap mushroom! Tansy wanted one of these.'); burst(it.x, it.y, 12); questPing(); }
  else { S.leaves++; S.hud = 1; sfx.leaf(); toast('Golden leaf! Secret ' + S.leaves + ' of ' + LEAVES); burst(it.x, it.y, 18); }
}
function toast(text) { S.toasts.push({ text, t: 0 }); if (S.toasts.length > 3) S.toasts.shift(); }
function confetti(n) { for (let i = 0; i < n; i++) S.confetti.push({ x: Math.random() * VW, y: -Math.random() * VH * .6, vx: (Math.random() - .5) * 20, vy: 30 + Math.random() * 40, r: Math.random() * TAU, vr: (Math.random() - .5) * 8, c: ['#c4512c', '#f0a03e', '#e9c24a', '#b23a32', '#8a5cc9', '#72c4a4', '#fff4dc'][i % 7] }); }
function supper() {   // the forest quest: a chapter card, the story continues in town
  S.flags.done = true; S.mode = 'end'; S.endKind = 'supper'; sfx.done(); confetti(70); questPing(); checkReady();
}
function festivalEnd() {   // the real ending
  S.flags.ended = true; S.finishT = S.playT; S.mode = 'end'; S.endKind = 'festival'; sfx.done(); confetti(140);
  const A = window.MembersAuth; const secs = Math.round(S.finishT);
  if (A && S.playP) S.playP.then(id => id && A.endPlay(id, { outcome: 'win', score: secs, meta: { leaves: S.leaves, coins: S.coins } })).catch(() => {});
}
function burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 30; S.sparks.push({ x, y: 10, z: y, vx: Math.cos(a) * v, vy: 30 + Math.random() * 40, vz: Math.sin(a) * v, t: 0 }); } }
const npcOn = n => !(n.fest && !S.flags.fest) && !(n.hideFest && S.flags.fest);
function interactables() {
  const out = [];
  for (const nid of S.A.npcs) { const n = NPCS[nid]; if (!npcOn(n)) continue; out.push({ x: n.x, y: n.y, h: n.h + (n.dy ? -n.dy : 0), range: n.range, use: () => talkTo(nid), nid }); }
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
const touchOn = () => !ROOT.classList.contains('no-touch-ui') && !ROOT.classList.contains('tw-shell');
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
  S.area = id; S.A = AREAS[id]; S.px = x; S.py = y; if (!S.trans) { camSnap = true; easeCam(0); } const c = camTarget(); S.camX = c[0]; S.camY = c[1];
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
  const inExit = (e, v) => A.exits.some(q => q.e === e && v >= q.a && v <= q.b && (!q.need || S.flags[q.need]));
  if (x < 10 && !inExit('w', y)) x = 10; if (x > A.w - 10 && !inExit('e', y)) x = A.w - 10;
  if (y < GT + 18 && !inExit('n', x)) y = GT + 18; if (y > A.h - 8 && !inExit('s', x)) y = A.h - 8;
  return [x, y];
}
function update(dt) {
  S.t += dt; const A = S.A;
  if (S.mode === 'play' && S.finishT == null) S.playT += dt;
  // transition between areas
  if (S.trans) {
    const T = S.trans; T.t += dt;
    if (!T.swapped && T.t >= T.dur / 2) { T.swapped = true; enterArea(T.to, T.sx, T.sy); if (T.onSwap) T.onSwap(); setBanner(S.flags.fest && T.to === 'market' ? 'Harvest Festival!' : S.A.name); }
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
    for (const s of A.solids) { if ((s.fest && !S.flags.fest) || (s.hideFest && S.flags.fest)) continue; const dx = nx - s.x, dy = ny - s.y, d = Math.hypot(dx, dy), mn = s.r + PR; if (d < mn && d > .001) { nx = s.x + dx / d * mn; ny = s.y + dy / d * mn; } }
    [nx, ny] = clampBounds(A, nx, ny);
    if (canStand(A, nx, ny)) { S.px = nx; S.py = ny; }
    S.walk += dt;
    if (Math.abs(mx) > .2) S.facing = mx > 0 ? 1 : -1;
    if (my < -.35 && Math.abs(my) > Math.abs(mx) * .7) S.back = true; else if (my > .2 || Math.abs(mx) > .35) S.back = false;
    S.dir = Math.abs(my) > Math.abs(mx) * .8 ? (my < 0 ? 'up' : 'down') : 'side';
    // exits
    for (const q of A.exits) {
      if (q.need && !S.flags[q.need]) continue;
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
    if ((p.k === 'bush' || p.k === 'appletree' || p.k === 'fern' || p.k === 'flowers' || p.k === 'reeds' || p.k === 'leafpile') && S.moving && Math.hypot(S.px - p.x, S.py - p.y) < 20) p.rustle = 1; }
  for (const nid of A.npcs) { const n = NPCS[nid]; if (n.front || !npcOn(n)) continue; const want = Math.hypot(S.px - n.x, S.py - n.y) < 90 ? (S.px > n.x ? 1 : -1) : 1; n.flip = n.flip == null ? 1 : n.flip; n.flip += Math.sign(want - n.flip) * Math.min(Math.abs(want - n.flip), dt * 7); }
  if (S.bounceT > 0) S.bounceT = Math.max(0, S.bounceT - dt * 1.1);
  // town bits: forge heat cools, the gate rises, the bell swings, dusk deepens as the quests progress
  if (S.heatT > 0) S.heatT -= dt; else if (S.heat > 0 && !S.flags.forgeHot) S.heat = Math.max(0, S.heat - dt * 1.4);
  S.gateT += dt; S.bellT = Math.max(0, S.bellT - dt * .6);
  { const F = S.flags, n = [F.gateOpen, F.honey, F.tin, S.apples >= 3 || F.pie, F.pie, F.done].filter(Boolean).length, tg = F.fest ? 2 : n / 6 * .95; S.dk += clamp(tg - S.dk, -dt * .12, dt * .12); }
  S.idle = S.moving || S.dlg ? 0 : S.idle + dt; S.qShow = Math.max(0, S.qShow - dt);
  S.qa += clamp((S.mode === 'play' && !S.dlg && !S.trans && (S.qShow > 0 || S.idle > 3.5) ? 1 : 0) - S.qa, -dt * 4, dt * 4);
  if (S.flags.fest && S.festT != null && !S.trans) { S.festT += dt; if (S.festT > 2.4 && !S.flags.festTalk && S.mode === 'play' && !S.dlg) { S.flags.festTalk = true; festivalSpeech(); } }
  // music: the festival tune in the square, Puddle's strumming in the tavern
  if (AC && !muted && ((S.flags.fest && S.area === 'market') || S.area === 'tavern')) { S.musT -= dt; if (S.musT <= 0) { const f = TUNE[S.musI++ % TUNE.length], q = S.area === 'tavern' ? .5 : 1; S.musT = S.area === 'tavern' ? .42 : .26; tone(f * q, .3, 'triangle', .035); if (S.musI % 4 === 1) tone(f * q / 2, .5, 'sine', .04); } }
  // camera
  easeCam(dt); const c = camTarget(), k = Math.min(1, dt * 6); S.camX += (c[0] - S.camX) * k; S.camY += (c[1] - S.camY) * k;
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
let PITCH = .66, CAMD = 400, PITCH0 = .66, CAMD0 = 400, camZ = 1, camP = 0, camSnap = true; const camOff = { zb: 120, zt: -200, hw: 150 };
// town areas pull the camera back and tilt it down a touch so facades, roofs and signs read; interiors a little
function camWant(A) { const sq = IW < IH * 1.15; if (!A || SHOT) return [1, 0];
  return A.kind === 'town' ? (sq ? [1.3, .05] : [1.42, .04]) : A.kind === 'inside' ? [sq ? 1.12 : 1.08, .03] : [1, 0]; }
function frameCam() {
  PITCH = PITCH0 + camP; CAMD = CAMD0 * camZ; placeCam(0, 0);
  const hit = (nx, ny) => { const v = new THREE.Vector3(nx, ny, .5).unproject(cam).sub(cam.position).normalize(); if (v.y >= -.01) return null; const t = -cam.position.y / v.y; return cam.position.clone().addScaledVector(v, t); };
  const b = hit(0, -1), t = hit(0, 1), m = hit(1, 0);
  camOff.zb = b ? b.z : 150; camOff.zt = t ? t.z : -600; camOff.hw = m ? m.x : 150;
  if (scene.fog) { scene.fog.near = CAMD * .9; scene.fog.far = CAMD * 2.4; }
}
function easeCam(dt) { const [z, p] = camWant(S.A); if (camSnap) { camZ = z; camP = p; camSnap = false; frameCam(); return; }
  if (Math.abs(z - camZ) < .002 && Math.abs(p - camP) < .0005) return; const k = Math.min(1, dt * 2.2); camZ += (z - camZ) * k; camP += (p - camP) * k; frameCam(); }
function placeCam(x, z) { cam.position.set(x, Math.sin(PITCH) * CAMD, z + Math.cos(PITCH) * CAMD); cam.lookAt(x, 0, z); cam.updateMatrixWorld(); }
function setupCamera() {
  const asp = IW / IH, portrait = asp < .8; cam.aspect = asp;
  PITCH0 = portrait ? .84 : .62; cam.fov = portrait ? 30 : 26;
  const tv = Math.tan(cam.fov * Math.PI / 360), wantW = SHOT ? 300 : portrait ? 164 : 300;
  CAMD0 = Math.max(wantW / (2 * tv * asp), SHOT ? 0 : 230 * Math.sin(PITCH0) / (2 * tv));
  cam.updateProjectionMatrix(); frameCam();
  FXMAT && (FXMAT.uniforms.uPx.value = IH / (2 * tv));
}
function camTarget() {
  const A = S.A, hw = camOff.hw;
  const tx = A.w <= hw * 2 - 30 ? A.w / 2 : clamp(S.px, hw - 15, A.w - hw + 15);
  const portrait = IW < IH * .8, zmax = A.h + (portrait ? 92 : 30) - camOff.zb, zmin = GT - 150 - camOff.zt - (A.kind === 'town' ? 260 * Math.min(1, Math.max(0, camZ - 1) / .3) : 0);
  let tz = SHOT ? 178 : clamp(S.py - (portrait ? 30 : 12) - Math.max(0, camZ - 1) * (IW < IH * 1.15 ? 40 : 110), zmin, zmax); if (zmin > zmax) tz = zmax;
  return [SHOT ? 214 : tx, tz];
}

// ---------------------------------------------------------------- textures, billboards
// big repeating surfaces (terrain, walls, roofs) get mipmaps for minification: nearest when magnified (chunky pixels),
// trilinear when minified so the small phone render doesn't alias into noise (1008 = LinearMipmapLinearFilter)
const mip = t => { t.minFilter = 1008; t.generateMipmaps = true; return t; };
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
  else if (o.emi) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = o.emi.tex || (o.emi.tex = tex(o.emi)); m.emissiveIntensity = 1; EMIS.push({ m, k: o.ek || 'lamp' }); }
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
let heroRib = null;   // frames with Russet's festival ribbon, painted when earned
const critFrames = k => cached('crit|' + k, () => [0, 1].flatMap(f => [0, 1].map(b => CRIT[k](f, b))));
const ACORN = paintAcorn(), GLEAF = paintGoldLeaf(), COIN = paintCoin(), APPLE = paintApple(), GLOWCAP = paintGlowcap(), HONEY = paintHoney(), TIN = paintTin(), PIE = paintPie(), INVITE = paintInvite();
const ITEMSPR = { acorn: [ACORN], leaf: [GLEAF, '#ffd040', .7], coin: [COIN, '#ffb040', .25], apple: [APPLE], glowcap: [GLOWCAP, '#5ac8f0', .9] };

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
  if (A.kind === 'inside') return 0;
  if (A.kind === 'town') { if (A.view === 'e' && x > A.w - 2) return -70 * smooth((x - A.w + 2) / 24); return A.ground === 'grass' ? (vnoise(x * .025, z * .025, 3) - .5) * 2 : (vnoise(x * .05, z * .05, 3) - .5) * .5; }
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
  const COB = pal(ap.cobble || '#a49680', 6, .55, .3), FLAG = pal('#c0b096', 5, .45, .25);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const x = X0 + (i + .5) * U, z = Z0 + (j + .5) * U;
    const n = vnoise(x * .03, z * .03, 1), n2 = vnoise(x * .11, z * .11, 2), patch = vnoise(x * .014 + 9, z * .014, 5);
    let v = .3 + n * .42 + n2 * .22; if (z < GT + 34) v -= (GT + 34 - z) / 34 * .3; if (z > A.h + 2) v -= .15;
    let c = p.shadeOf(patch > .58 ? G2 : G1, clamp(v, 0, 1), i, j);
    const pd = pathDist(A, x, z);
    if (pd < 13.5) c = pd > 11.5 ? p.shadeOf(PP, .15, i, j) : p.shadeOf(PP, clamp(.55 + n2 * .35 - pd / 40, 0, 1), i, j);
    if (A.water) { const wat = A.water(x, z) || (A.id === 'glade' && Math.hypot((x - 128) / 1.25, z - 168) < 36); const near = !wat && (A.water(x + 5, z) || A.water(x - 5, z) || A.water(x, z + 5) || A.water(x, z - 5));
      if (wat) c = p.shadeOf(BED, clamp(.3 + n2 * .6, 0, 1), i, j); else if (near) c = p.shadeOf(BANK, n2, i, j); }
    if (A.kind !== 'forest') c = townGround(A, p, x, z, i, j, c, pd, n2, COB, FLAG);
    p.set(i, j, c);
  }
  const toT = (x, z) => [Math.floor((x - X0) / U), Math.floor((z - Z0) / U)];
  if (A.ground === 'wood') return p.done({ outline: false });
  const paved = A.kind === 'town' && A.ground !== 'grass';
  const wet = (x, z) => A.water && A.water(x, z);
  // grass tufts
  for (let k = 0; k < (paved ? 0 : TW * TH / 60); k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (pathDist(A, x, z) < 13 || wet(x, z)) continue; const [i, j] = toT(x, z), base = p.col(clamp(i, 0, TW - 1), clamp(j, 0, TH - 1));
    const d = dark(base, .35), l = lite(base, .25); p.set(i, j, d); p.set(i - 1, j - 1, d); p.set(i + 1, j - 1, d); p.set(i, j - 1, l); p.set(i, j - 2, l); }
  // fallen leaves: drifts + scatter, a few asters
  for (let k = 0; k < (paved ? 6 : 16); k++) { const cx = X0 + r() * TW * U, cz = GT + 10 + r() * (A.h - GT); for (let q = 0; q < 40; q++) { const a = r() * TAU, d = Math.sqrt(r()) * 24, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * .55; if (wet(x, z)) continue; const [i, j] = toT(x, z), c = AUT[(r() * AUT.length) | 0]; p.set(i, j, c); p.set(i + 1, j, dark(c, .2)); if (r() < .5) p.set(i, j - 1, lite(c, .2)); } }
  for (let k = 0; k < TW * TH / (paved ? 160 : 50); k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (wet(x, z)) continue; const [i, j] = toT(x, z), c = AUT[(r() * AUT.length) | 0]; p.set(i, j, c); if (r() < .6) p.set(i + 1, j, dark(c, .25)); }
  for (let k = 0; k < (paved ? 0 : TW * TH / 900); k++) { const x = X0 + r() * TW * U, z = Z0 + r() * TH * U; if (wet(x, z) || pathDist(A, x, z) < 14) continue; const [i, j] = toT(x, z), c = ['#9a6fc0', '#f2b63c', '#fff0d8'][k % 3]; p.set(i, j, c); p.set(i - 1, j, c); p.set(i + 1, j, c); p.set(i, j - 1, c); p.set(i, j + 1, '#6e7a34'); }
  return p.done({ outline: false });
}
function tileTex(kind, ap) {   // 32x32 repeating pixel tiles for the cliffs
  return cached('tile|' + kind + '|' + ap.ground, () => {
    const p = new Pix(32, 32), r = rng(kind === 'rock' ? 5 : 9);
    if (kind === 'cob') { const C = pal('#988a76', 6, .55, .3); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, cobble(p, i * U, j * U, i, j, C, null, 6.25, 5)); return p.done({ outline: false }); }
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

// cobbles (running bond, or rings around a plaza centre), flagstone paths, wooden planks
function cobble(p, x, z, i, j, P_, plaza, sw = 6.2, sh = 4.6) {
  let cid = null, li, lj;
  if (plaza) { const dx = x - plaza[0], dz = (z - plaza[1]) * 1.15, d = Math.hypot(dx, dz); if (d < plaza[2] && d > 3) { const ring = Math.floor(d / sh), circ = Math.max(4, Math.round(TAU * (ring + .5) * sh / sw)), a = ((Math.atan2(dz, dx) / TAU + 1) % 1) * circ + ring * .37, seg = Math.floor(a); cid = ring * 97 + (seg % circ); li = (a - seg) * sw; lj = d - ring * sh; } }
  if (cid == null) { const row = Math.floor(z / sh), off = (row & 1) * sw * .5 + hash2(row, 0, 5) * 2, col = Math.floor((x + off) / sw); cid = row * 131 + col; li = x + off - col * sw; lj = z - row * sh; }
  const h = hash2(cid, 7, 3);
  if (li < 1.2 || lj < 1.2) return p.shadeOf(P_, .06 + h * .12, i, j);
  return p.shadeOf(P_, clamp(.36 + h * .34 + (lj < 2.4 ? .16 : 0) - (li > sw - 1.4 ? .1 : 0), 0, 1), i, j);
}
function townGround(A, p, x, z, i, j, c, pd, n2, COB, FLAG) {
  if (A.ground === 'wood') {
    const row = Math.floor(z / 7.5), off = hash2(row, 1, 4) * 40, seg = Math.floor((x + off) / 37), h = hash2(row, seg, 6);
    let v = .38 + h * .3 + (z - row * 7.5 < 1.6 ? .14 : 0); if (z - row * 7.5 < .9 || (x + off) - seg * 37 < 1) v = .02;
    let col = p.shadeOf(WOOD.slice(0, 5), clamp(v, 0, 1), i, j);
    const rx = (x - A.w / 2) / 84, rz = (z - A.h * .62) / 46, rd = Math.hypot(rx, rz);
    if (rd < 1) col = rd > .9 ? '#e8b84a' : rd > .8 ? '#8a2420' : (Math.floor(rd * 10 + Math.abs(Math.atan2(rz, rx)) * 2) % 3 === 0 ? '#c8902a' : '#a8302a');
    if (Math.abs(x - 180) < 24 && z > A.h - 14 && z < A.h + 4) col = ((i + j) & 1) ? '#7a6a3a' : '#9a8a4a';
    if (z > A.h + 6) col = dark(col, clamp((z - A.h - 6) / 40, 0, .8));
    return col;
  }
  if (A.ground === 'grass') return pd < 15 ? cobble(p, x, z, i, j, pd > 12.5 ? COB : FLAG, null, 9, 6.5) : c;
  let col = pd < 14 ? cobble(p, x, z, i, j, FLAG, null, 10, 7) : cobble(p, x, z, i, j, COB, A.plaza);
  if (vnoise(x * .04, z * .04, 8) > .66 && n2 > .45) col = mix(col, '#6a7a3a', .45);
  if (z < GT + 12) col = dark(col, (GT + 12 - z) / 12 * .35);
  if (A.view === 'e' && x > A.w - 2) col = mix(col, '#5a6a3a', .5);
  return col;
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
  c += hiTint * smoothstep(.55, 1.0, l) * .05;
  c = (c - .5) * 1.03 + .5;
  c = mix(vec3(l), c, 1.1);
  vec3 o = max(c - .78, 0.0); c = min(c, .78) + o / (1.0 + o * 4.5);   // soft shoulder: no blown-out whites
  vec2 q = (vUv - .5) * vec2(1.0, 1.15); c *= 1.0 - .45 * pow(clamp(length(q) * 1.25, 0.0, 1.0), 2.6);
  c = mix(c, vec3(.08, .04, .1), uFade);
  gl_FragColor = vec4(c, 1.0); }`;
const FX_V = `attribute vec4 aCol; attribute float aSize; uniform float uPx; varying vec4 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, floor(aSize * uPx / -mv.z + .5)); vC = aCol; }`;
const FX_F = 'varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb, vC.a); }';
const SM_F = 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - smoothstep(.25, .5, r))); }';

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
// chimney smoke (normal blending, soft round puffs)
const SMN = 260, smPos = new Float32Array(SMN * 3), smCol = new Float32Array(SMN * 4), smSize = new Float32Array(SMN);
const smGeo = new THREE.BufferGeometry(); smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3)); smGeo.setAttribute('aCol', new THREE.BufferAttribute(smCol, 4)); smGeo.setAttribute('aSize', new THREE.BufferAttribute(smSize, 1));
const smk = new THREE.Points(smGeo, new THREE.ShaderMaterial({ vertexShader: FX_V, fragmentShader: SM_F, uniforms: { uPx: FXMAT.uniforms.uPx }, transparent: true, depthWrite: false })); smk.frustumCulled = false; smk.renderOrder = 4; scene.add(smk);
let smN = 0;
function smAdd(x, y, z, c, a, s) { if (smN >= SMN) return; const i = smN++; smPos[i * 3] = x; smPos[i * 3 + 1] = y; smPos[i * 3 + 2] = z; c = rgb(c); smCol[i * 4] = c[0] / 255; smCol[i * 4 + 1] = c[1] / 255; smCol[i * 4 + 2] = c[2] / 255; smCol[i * 4 + 3] = a; smSize[i] = s; }
function fxAdd(x, y, z, c, a, s) { if (fxN >= FXN) return; const i = fxN++; fxPos[i * 3] = x; fxPos[i * 3 + 1] = y; fxPos[i * 3 + 2] = z; c = rgb(c); fxCol[i * 4] = c[0] / 255; fxCol[i * 4 + 1] = c[1] / 255; fxCol[i * 4 + 2] = c[2] / 255; fxCol[i * 4 + 3] = a; fxSize[i] = s; }
// falling pixel leaves
const LEAFN = 56, leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(5 * U, 4 * U), new THREE.MeshBasicMaterial({ map: tex(paintLeafBit()), alphaTest: .5, side: THREE.DoubleSide }), LEAFN);
leafMesh.frustumCulled = false; scene.add(leafMesh);
const LEAVES3 = []; { const col = new THREE.Color(); for (let i = 0; i < LEAFN; i++) { LEAVES3.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, rx: Math.random() * TAU, ry: Math.random() * TAU, rz: 0, sp: 1 + Math.random() * 2, ph: Math.random() * TAU }); leafMesh.setColorAt(i, col.set(AUT[i % AUT.length])); } }
const dummy = new THREE.Object3D();

// ---------------------------------------------------------------- Hearthvale: 3D buildings (merged boxes + pixel tile textures)
const WALLST = { cream: ['#ecdcbc', '#5a3622'], ochre: ['#e2b470', '#5a3622'], rose: ['#e6ae9c', '#4a2a22'], sage: ['#c6cca4', '#4a3a26'], sky: ['#b8c8d0', '#3e3446'] };
const ROOFC = { tile: '#b8482a', slate: '#566282', thatch: '#c8a048', moss: '#8a6a3a' };
const SHUT = ['#3a6a8a', '#4a7a3a', '#a83a2a', '#6a4a8a', '#2e6a6a'];
const EMIS = [];   // emissive materials driven by time of day: { m, k: 'win' | 'lamp' | 'fire' | 'fest' }
function wallTiles(style) {   // [colour tile, window-glow mask], 32x32 texels, repeating
  return cached('wt|' + style, () => {
    const p = new Pix(32, 32), e = new Pix(32, 32);
    if (style === 'stone' || style === 'keep' || style === 'wall') {
      bricks(p, 0, 0, 32, 32, style === 'keep' ? '#9e9686' : style === 'wall' ? '#a49a88' : '#a8987e', 8, 4, style.length);
      for (let k = 0; k < 5; k++) p.set((k * 11 + 3) % 32, (k * 7 + 2) % 32, '#6a7a3a');
    } else if (style === 'inwall') { const PL = pal('#d8b88a', 5, .3, .2);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, p.shadeOf(PL, clamp(.5 + (vnoise(i * .3, j * .3, 7) - .5) * .4, 0, 1), i, j));
      p.rect(0, 0, 32, 2, WOOD[1]); p.rect(0, 0, 2, 20, WOOD[2]); p.rect(16, 0, 2, 20, WOOD[2]);
      for (let j = 20; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, i % 8 === 0 ? WOOD[0] : p.shadeOf(WOOD.slice(1), clamp(.5 + (hash2(i >> 3, 3, 1) - .5) * .4, 0, 1), i, j));
      p.rect(0, 19, 32, 2, WOOD[3]);
    } else if (style === 'wood') { for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, j % 8 === 7 ? WOOD[0] : p.shadeOf(WOOD.slice(1), clamp(.45 + (hash2(j >> 3, i >> 4, 2) - .5) * .4, 0, 1), i, j)); }
    else { const [pl, tm] = WALLST[style], PL = pal(pl, 5, .28, .2), TM = pal(tm, 4, .4, .3);
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) p.set(i, j, p.shadeOf(PL, clamp(.55 + (vnoise(i * .3, j * .3, 7) - .5) * .45, 0, 1), i, j));
      p.rect(0, 0, 32, 2, TM[1]); p.rect(0, 30, 32, 2, TM[1]); p.rect(0, 0, 2, 32, TM[2]); p.rect(16, 0, 2, 32, TM[2]);
      p.line(2, 29, 15, 2, TM[1]); p.line(3, 29, 15, 3, TM[2]);
      p.rect(21, 8, 8, 13, TM[0]); for (let j = 9; j < 20; j++) for (let i = 22; i < 28; i++) { p.set(i, j, '#34405e'); e.set(i, j, '#ffffff'); }
      for (let j = 9; j < 20; j++) { p.set(24, j, TM[1]); e.clear(24, j); } for (let i = 22; i < 28; i++) { p.set(i, 14, TM[1]); e.clear(i, 14); }
      p.set(22, 9, '#8aa0c0'); p.set(23, 10, '#8aa0c0');
      const sc = SHUT[style.length % SHUT.length]; p.rect(19, 8, 2, 13, sc); p.rect(29, 8, 2, 13, sc);
      p.rect(20, 21, 10, 2, '#8a5a34'); p.set(21, 20, '#e04a5a'); p.set(24, 20, '#f2b63c'); p.set(27, 20, '#e04a5a'); p.set(23, 20, '#4a7a34'); p.set(26, 20, '#4a7a34');
    }
    return [p.done({ outline: false }), e.done({ outline: false })];
  });
}
function roofTile(kind) { return cached('rt|' + kind, () => { const p = new Pix(32, 32), P_ = pal(ROOFC[kind], 6, .5, .3);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { let v;
    if (kind === 'thatch') v = .45 + (hash2(i, j >> 1, 3) - .5) * .5 + ((j % 8) < 2 ? .2 : 0) - ((j % 8) === 7 ? .3 : 0);
    else { const row = j >> 2, off = row % 2 ? 3 : 0, col = Math.floor((i + off) / 6), li = (i + off) % 6, lj = j % 4; v = .42 + hash2(col, row, kind.length) * .26 + (lj === 3 ? .26 : lj === 0 ? -.28 : 0) + (li === 0 ? -.22 : 0); }
    p.set(i, j, p.shadeOf(P_, clamp(v, 0, 1), i, j)); }
  if (kind !== 'thatch') for (let k = 0; k < 6; k++) { const i = (k * 13) % 32, j = (k * 7 + 3) % 32; p.set(i, j, '#7a8a3a'); p.set(i + 1, j, '#5a6a2a'); }
  return p.done({ outline: false }); }); }
const SIGNS = {
  bread: (p, x, y) => { p.ell(x + 5, y + 4, 4, 2.4, ['#7a3a12', '#a85a1e', '#d08a3a', '#f0b864']); p.line(x + 3, y + 3, x + 6, y + 2, '#f8d898'); },
  mug: (p, x, y) => { p.rect(x + 2, y + 2, 5, 5, '#c8a040'); p.rect(x + 2, y + 1, 5, 2, '#fff8e8'); p.rect(x + 7, y + 3, 1, 3, '#a8781a'); },
  needle: (p, x, y) => { p.line(x + 1, y + 6, x + 8, y + 1, '#8a96a4'); p.set(x + 8, y + 1, '#ffffff'); p.line(x + 2, y + 2, x + 7, y + 6, '#d83a3a'); },
  herb: (p, x, y) => { p.rect(x + 3, y + 2, 4, 5, '#4aa090'); p.rect(x + 4, y + 1, 2, 1, '#a08a68'); p.set(x + 1, y + 6, '#4a7a2a'); p.set(x + 2, y + 5, '#6a9a3a'); },
  hammer: (p, x, y) => { p.line(x + 2, y + 7, x + 7, y + 2, WOOD[2]); p.rect(x + 5, y + 1, 4, 3, IRON[2]); },
};
function window_(p, e, x, y, w, h, sc, TM, shop) {
  p.rect(x - 1, y - 1, w + 2, h + 2, TM[0]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { p.set(x + i, y + j, j < 2 ? '#4a5a7a' : '#34405e'); e.set(x + i, y + j, '#ffffff'); }
  const mx = x + (w >> 1), my = y + (h >> 1); for (let j = 0; j < h; j++) { p.set(mx, y + j, TM[1]); e.clear(mx, y + j); } for (let i = 0; i < w; i++) { p.set(x + i, my, TM[1]); e.clear(x + i, my); }
  p.set(x, y, '#9ab0d0'); p.set(x + 1, y + 1, '#9ab0d0');
  if (!shop) { p.rect(x - 3, y - 1, 2, h + 2, sc); p.rect(x + w + 1, y - 1, 2, h + 2, sc); p.rect(x - 3, y + 2, 2, 1, dark(sc, .3)); p.rect(x + w + 1, y + 2, 2, 1, dark(sc, .3)); }
  p.rect(x - 2, y + h + 1, w + 4, 2, '#8a5a34'); for (let i = 0; i < w + 2; i += 2) p.set(x - 1 + i, y + h, ['#e04a5a', '#f2b63c', '#4a7a34', '#fff0d8'][(i + x) % 4]);
}
function door_(p, e, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (i + .5 - w / 2) / (w / 2), top = (1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * 3; if (j < top) continue; p.set(x + i, y + j, i % 3 === 0 ? WOOD[1] : WOOD[(i + j) % 7 === 0 ? 3 : 2]); }
  p.rect(x, y + 4, w, 1, IRON[1]); p.rect(x, y + h - 4, w, 1, IRON[1]); p.set(x + w - 3, y + (h >> 1), '#e8b84a');
  p.rect(x + (w >> 1) - 1, y - 4, 3, 3, '#ffcf6a'); p.set(x + (w >> 1), y - 5, IRON[1]); e.rect(x + (w >> 1) - 1, y - 4, 3, 3, '#ffffff');
}
function paintFacade(o) {   // a half-timbered (or stone) house front, with an optional gable on top
  const W = Math.max(8, Math.round(o.w / U)), H = Math.round(o.h / U), GH = o.gable ? Math.round(o.gh / U) : 0, r = rng(o.seed);
  const p = new Pix(W, H + GH), e = new Pix(W, H + GH), Y0 = GH, stone = o.style === 'stone';
  const [plc, tmc] = WALLST[o.style] || WALLST.cream, PL = pal(plc, 5, .28, .2), TM = pal(tmc, 4, .4, .3), sc = SHUT[(o.seed >> 2) % SHUT.length];
  for (let y = 0; y < GH; y++) { const hw = (y + 1) / GH * W / 2; for (let x = 0; x < W; x++) if (Math.abs(x + .5 - W / 2) <= hw) p.set(x, y, stone ? '#a8987e' : p.shadeOf(PL, clamp(.62 + (vnoise(x * .3, y * .3, 9) - .5) * .4, 0, 1), x, y)); }
  if (GH) { for (let y = 0; y < GH; y++) { const hw = (y + 1) / GH * W / 2; for (const x of [Math.round(W / 2 - hw), Math.round(W / 2 + hw) - 1]) { p.set(x, y, TM[1]); p.set(x + (x < W / 2 ? 1 : -1), y, TM[2]); } }
    const cy = Math.round(GH * .6), cx = W / 2; p.ell(cx, cy, 3.4, 3.4, hx(TM[0])); p.ell(cx, cy, 2.4, 2.4, '#34405e'); e.ell(cx, cy, 2.4, 2.4, '#ffffff'); p.rect(Math.floor(cx), cy - 2, 1, 5, TM[1]); e.rect(Math.floor(cx), cy - 2, 1, 5, '#000000'); }
  if (stone) bricks(p, 0, Y0, W, H, '#a8987e', 8, 4, o.seed);
  else for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) p.set(x, y, p.shadeOf(PL, clamp(.58 + (vnoise(x * .25, y * .25, o.seed % 7) - .5) * .45, 0, 1), x, y));
  const plinth = 5, fl = Y0 + Math.round(H * .46);
  bricks(p, 0, Y0 + H - plinth, W, plinth, '#8a8070', 6, 3, 2);
  if (!stone) {
    p.rect(0, Y0, W, 2, TM[1]); p.rect(0, fl, W, 2, TM[1]); p.rect(0, fl + 2, W, 1, dark(plc, .45)); p.rect(0, Y0 + H - plinth - 1, W, 1, TM[0]);
    const nPost = Math.max(2, Math.round(W / 13)), posts = []; for (let k = 0; k <= nPost; k++) posts.push(Math.min(W - 2, Math.round(k * (W - 2) / nPost)));
    posts.forEach(x => { p.rect(x, Y0, 2, H - plinth, TM[2]); p.set(x + 1, Y0 + 2, TM[3]); });
    for (let k = 0; k < posts.length - 1; k++) if (k % 2 === (o.seed & 1)) p.line(posts[k] + 2, fl - 1, posts[k + 1] - 1, Y0 + 2, TM[1]);
  } else p.rect(0, fl, W, 1, '#7a7060');
  const nWin = Math.max(1, Math.floor(W / 18));
  for (let k = 0; k < nWin; k++) { const cx = Math.round((k + .5) * W / nWin); window_(p, e, cx - 3, Y0 + 4, 7, Math.max(6, fl - Y0 - 8), sc, TM); }
  const dw = o.big ? 12 : 9, dcx = Math.round(clamp(o.door == null ? .3 + r() * .4 : o.door, .15, .85) * W), dh = o.big ? 17 : 14, dy = Y0 + H - dh;
  const sx = dcx < W / 2 ? dcx + (dw >> 1) + 5 : 4, sw = Math.min(14, dcx < W / 2 ? W - sx - 4 : dcx - (dw >> 1) - 9);
  if (sw >= 6) window_(p, e, sx, fl + 6, sw, Math.max(5, Y0 + H - plinth - fl - 9), sc, TM, true);
  door_(p, e, dcx - (dw >> 1), dy, dw, dh);
  if (o.sign && SIGNS[o.sign]) { const bx = dcx + (dw >> 1) + 3, by = fl + 3; p.rect(bx - 1, by, 9, 1, IRON[1]); p.set(bx + 1, by + 1, IRON[1]); p.set(bx + 6, by + 1, IRON[1]); p.rect(bx, by + 2, 10, 9, WOOD[1]); p.rect(bx + 1, by + 3, 8, 7, '#e8d8b0'); SIGNS[o.sign](p, bx, by + 2); }
  return [p.done({ outline: false }), e.done({ outline: false })];
}
function paintChapelFront(o) {
  const W = Math.round(o.w / U), H = Math.round(o.h / U), GH = Math.round(o.gh / U), T = H + GH, p = new Pix(W, T), e = new Pix(W, T), cx = W / 2;
  bricks(p, 0, 0, W, T, '#a8987e', 8, 4, 11);
  for (let y = 0; y < GH; y++) { const hw = (y + 1) / GH * W / 2; for (let x = 0; x < W; x++) if (Math.abs(x + .5 - cx) > hw) p.clear(x, y); }
  const G = ['#c83a2a', '#3a6aa8', '#e8b84a', '#5a9a5a', '#8a5ab0', '#3a6aa8'], ry = GH + 8;
  p.ell(cx, ry, 10.5, 10.5, '#7a7060'); for (let y = ry - 9; y <= ry + 9; y++) for (let x = Math.floor(cx - 9); x <= cx + 9; x++) { const dx = x + .5 - cx, dy = y + .5 - ry, d = Math.hypot(dx, dy); if (d > 8.6) continue;
    const a = (Math.atan2(dy, dx) / TAU + 1) % 1, sec = Math.floor(a * 8); const lead = Math.abs(a * 8 - Math.round(a * 8)) < .12 * (6 / Math.max(d, 1)) || Math.abs(d - 4.5) < .55;
    p.set(x, y, lead ? '#3a3040' : d < 2.2 ? '#f8e070' : G[sec % G.length]); if (!lead) e.set(x, y, d < 2.2 ? '#ffffff' : '#c0c0c0'); }
  for (const lx of [Math.round(W * .2), Math.round(W * .8) - 4]) { for (let y = GH + 18; y < T - 12; y++) for (let x = lx; x < lx + 5; x++) { const top = GH + 18 + Math.abs(x + .5 - lx - 2.5) * .9; if (y < top) continue; p.set(x, y, G[(y >> 2) % G.length]); e.set(x, y, '#b0b0b0'); } p.rect(lx - 1, T - 12, 7, 1, '#7a7060'); }
  const dw = 16, dh = 24, dx0 = Math.round(cx - dw / 2);
  for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) { const u = Math.abs(i + .5 - dw / 2) / (dw / 2), top = (1 - Math.sqrt(Math.max(0, 1 - u * u * .9))) * 9 + u * 3; if (j < top - 3) continue; p.set(dx0 + i, T - dh + j, j < top - 1 ? '#7a7060' : i === dw >> 1 ? WOOD[0] : WOOD[(i % 3 ? 2 : 1)]); }
  p.rect(dx0 + 1, T - 12, dw - 2, 1, IRON[1]); p.set(dx0 + 6, T - 10, '#e8b84a'); p.set(dx0 + 9, T - 10, '#e8b84a');
  return [p.done({ outline: false }), e.done({ outline: false })];
}
function paintBelfry(w, h) { const W = Math.round(w / U), H = Math.round(h / U), p = new Pix(W, H); bricks(p, 0, 0, W, H, '#a8987e', 8, 4, 13);
  const ow = W - 12, ox = 6; for (let j = 4; j < H - 3; j++) for (let i = 0; i < ow; i++) { const u = (i + .5 - ow / 2) / (ow / 2), top = 4 + (1 - Math.sqrt(Math.max(0, 1 - u * u))) * ow * .5; if (j >= top) p.set(ox + i, j, '#1a1420'); }
  p.rect(0, H - 3, W, 3, '#7a7060'); return p.done({ outline: false }); }
function paintKeepFront(o) { const W = Math.round(o.w / U), H = Math.round(o.h / U), p = new Pix(W, H), e = new Pix(W, H), cx = W / 2; bricks(p, 0, 0, W, H, '#9e9686', 8, 4, 17);
  for (const [x, y] of [[cx - 30, 22], [cx + 27, 22], [cx - 30, 52], [cx + 27, 52], [cx - 2, 18]]) { p.rect(Math.round(x) - 1, y - 1, 5, 13, '#6a6458'); p.rect(Math.round(x), y, 3, 11, '#2a2430'); e.rect(Math.round(x), y + 2, 3, 9, '#ffffff'); }
  const gw = 26, gh = 34, gx = Math.round(cx - gw / 2);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const u = (i + .5 - gw / 2) / (gw / 2), top = (1 - Math.sqrt(Math.max(0, 1 - u * u))) * 11; if (j < top - 2) continue; p.set(gx + i, H - gh + j, j < top ? '#6a6458' : i % 4 === 0 ? WOOD[0] : WOOD[2]); }
  for (let j = H - gh + 14; j < H; j += 6) for (let i = gx + 2; i < gx + gw - 2; i += 4) p.set(i, j, IRON[3]);
  p.ell(cx, H - gh - 9, 6, 7, ['#5a1414', '#8a2420', '#b4382c', '#d8503a']); p.ell(cx, H - gh - 8, 2.4, 2.8, ['#a8781a', '#e8b84a', '#fff0a0']); p.ell(cx, H - gh - 11, 2.8, 1.3, '#7a4a1e');
  return [p.done({ outline: false }), e.done({ outline: false })]; }
function paintBigBanner(c) { const p = new Pix(18, 48), P_ = pal(c, 5, .45, .3); p.rect(0, 0, 18, 2, '#5a4430');
  for (let y = 2; y < 48; y++) for (let x = 1; x < 17; x++) { if (y > 40 && Math.abs(x - 8.5) < (y - 40) * 1.1) continue; p.set(x, y, p.shadeOf(P_, clamp(.7 - Math.abs(x - 6) * .04 - y * .004, 0, 1), x, y)); }
  p.rect(1, 2, 16, 1, '#e8b84a'); p.rect(1, 3, 1, 37, '#e8b84a'); p.rect(16, 3, 1, 37, '#e8b84a');
  p.ell(8.5, 18, 4, 4.6, ['#a8781a', '#e8b84a', '#fff0a0']); p.ell(8.5, 13.6, 4.6, 2, '#7a4a1e'); p.set(8, 10, '#7a4a1e'); return p.done({ ax: 9, ay: 0, outline: false }); }
function paintPortcullis(w, h) { const W = Math.round(w / U), H = Math.round(h / U), p = new Pix(W, H);
  for (let x = 1; x < W - 1; x += 5) { p.rect(x, 0, 2, H - 3, IRON[2]); p.rect(x, 0, 1, H - 3, IRON[3]); p.poly([[x - .5, H - 3], [x + 2.5, H - 3], [x + 1, H]], IRON[1]); }
  for (let y = 3; y < H - 4; y += 6) p.rect(0, y, W, 2, IRON[1]); return p.done({ outline: false }); }
function paintArchFill(w, h) { const W = Math.round(w / U), H = Math.round(h / U), p = new Pix(W, H); bricks(p, 0, 0, W, H, '#a49a88', 8, 4, 21);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x + .5 - W / 2) / (W / 2 - 1), top = H - Math.sqrt(Math.max(0, 1 - u * u)) * (H - 2); if (y >= top && Math.abs(u) < 1) p.clear(x, y); else if (y >= top - 2.5 && Math.abs(u) < 1.05) p.set(x, y, (Math.floor(Math.atan2(y - H, x - W / 2) * 6) % 2) ? '#8a8070' : '#c0b6a2'); }
  p.rect(Math.round(W / 2) - 2, 0, 4, 5, '#d0c6b0'); return p.done({ outline: false }); }
// geometry accumulator: quads grouped by material key, flushed into one mesh per material
const TMAT = new Map();
function townMat(key) { let m = TMAT.get(key); if (m) return m; const i = key.indexOf('|'), kind = key.slice(0, i), style = key.slice(i + 1);
  if (kind === 'w') { const [c, e] = wallTiles(style); m = new THREE.MeshLambertMaterial({ map: mip(tex(c, true)), side: THREE.DoubleSide }); if (WALLST[style]) { m.emissiveMap = tex(e, true); m.emissive = new THREE.Color('#ffb060'); m.emissiveIntensity = 0; EMIS.push({ m, k: 'win' }); } }
  else if (kind === 'r') m = new THREE.MeshLambertMaterial({ map: mip(tex(roofTile(style), true)), side: THREE.DoubleSide });
  else m = new THREE.MeshLambertMaterial({ color: style, side: THREE.DoubleSide });
  MATS.push(m); TMAT.set(key, m); return m; }
function townBuilder() {
  const acc = {}, T = 32 * U;
  const B = { acc, T,
    q(key, a, b, c, d, ua, ub, uc, ud) { const A_ = acc[key] || (acc[key] = { p: [], u: [] }); A_.p.push(...a, ...b, ...c, ...a, ...c, ...d); A_.u.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); },
    tri(key, a, b, c, ua, ub, uc) { const A_ = acc[key] || (acc[key] = { p: [], u: [] }); A_.p.push(...a, ...b, ...c); A_.u.push(...ua, ...ub, ...uc); },
    box(key, x0, x1, y0, y1, z0, z1, o = {}) {
      if (!o.noFront) B.q(key, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0 / T, y0 / T], [x1 / T, y0 / T], [x1 / T, y1 / T], [x0 / T, y1 / T]);
      if (!o.noBack) B.q(key, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1 / T, y0 / T], [x0 / T, y0 / T], [x0 / T, y1 / T], [x1 / T, y1 / T]);
      B.q(key, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [z0 / T, y0 / T], [z1 / T, y0 / T], [z1 / T, y1 / T], [z0 / T, y1 / T]);
      B.q(key, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [z1 / T, y0 / T], [z0 / T, y0 / T], [z0 / T, y1 / T], [z1 / T, y1 / T]);
      if (!o.noTop) B.q(o.top || key, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [x0 / T, -z1 / T], [x1 / T, -z1 / T], [x1 / T, -z0 / T], [x0 / T, -z0 / T]);
    },
    merlons(key, x0, x1, y, z0, z1, step = 12, w = 7, h = 8) { for (let x = x0; x + w <= x1 + .01; x += step) B.box(key, x, x + w, y, y + h, z0, z1); },
  };
  return B;
}
function flushBuilder(B, G) { for (const key in B.acc) { const a = B.acc[key], g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, townMat(key)); m.castShadow = m.receiveShadow = true; G.add(m); } }
function facadeMesh(G, c, e, x0, x1, y0, z) {   // a painted front, its windows glowing at dusk
  const w = c.width * U, h = c.height * U, m = new THREE.MeshLambertMaterial({ map: tex(c), alphaTest: .5, side: THREE.DoubleSide });
  if (e) { m.emissiveMap = tex(e); m.emissive = new THREE.Color('#ffb060'); m.emissiveIntensity = 0; EMIS.push({ m, k: 'win' }); }
  MATS.push(m); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set((x0 + x1) / 2, y0 + h / 2, z); me.receiveShadow = true; G.add(me); return me; }
function cylUV(g, r, h, kind) { const T = 32 * U, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * r / T, uv.getY(i) * h / T); return g; }
// one house: walls, a painted front, a pitched roof (ridge along x, or along z with a gable front), maybe a smoking chimney
function house(B, G, out, o) {
  const { x0, x1, z0, z1, h } = o, y0 = o.base || 0, w = x1 - x0, d = z1 - z0, ov = 4, wk = 'w|' + o.style, rk = 'r|' + o.roof, T = B.T, Y1 = y0 + h, r = rng(o.seed || 1);
  B.q(wk, [x0, y0, z0], [x0, y0, z1], [x0, Y1, z1], [x0, Y1, z0], [z0 / T, y0 / T], [z1 / T, y0 / T], [z1 / T, Y1 / T], [z0 / T, Y1 / T]);
  B.q(wk, [x1, y0, z1], [x1, y0, z0], [x1, Y1, z0], [x1, Y1, z1], [z1 / T, y0 / T], [z0 / T, y0 / T], [z0 / T, Y1 / T], [z1 / T, Y1 / T]);
  let rh, ridgeY;
  if (o.gable) {
    rh = w * .42; const xc = (x0 + x1) / 2, s = rh / (w / 2), L = Math.hypot(w / 2 + ov, rh + ov * s) / T, ey = Y1 - ov * s; ridgeY = Y1 + rh;
    B.q(rk, [x0 - ov, ey, z1 + ov], [xc, Y1 + rh, z1 + ov], [xc, Y1 + rh, z0 - ov], [x0 - ov, ey, z0 - ov], [-(z1 + ov) / T, 0], [-(z1 + ov) / T, L], [-(z0 - ov) / T, L], [-(z0 - ov) / T, 0]);
    B.q(rk, [x1 + ov, ey, z0 - ov], [xc, Y1 + rh, z0 - ov], [xc, Y1 + rh, z1 + ov], [x1 + ov, ey, z1 + ov], [(z0 - ov) / T, 0], [(z0 - ov) / T, L], [(z1 + ov) / T, L], [(z1 + ov) / T, 0]);
    B.tri(wk, [x1, Y1, z0], [x0, Y1, z0], [xc, Y1 + rh, z0], [x1 / T, Y1 / T], [x0 / T, Y1 / T], [xc / T, (Y1 + rh) / T]);
    if (!o.facade) { B.q(wk, [x0, y0, z1], [x1, y0, z1], [x1, Y1, z1], [x0, Y1, z1], [x0 / T, y0 / T], [x1 / T, y0 / T], [x1 / T, Y1 / T], [x0 / T, Y1 / T]); B.tri(wk, [x0, Y1, z1], [x1, Y1, z1], [xc, Y1 + rh, z1], [x0 / T, Y1 / T], [x1 / T, Y1 / T], [xc / T, (Y1 + rh) / T]); }
  } else {
    rh = Math.min(34, d * .5); const zc = (z0 + z1) / 2, s = rh / (d / 2), L = Math.hypot(d / 2 + ov, rh + ov * s) / T, ey = Y1 - ov * s; ridgeY = Y1 + rh;
    B.q(rk, [x0 - ov, ey, z1 + ov], [x1 + ov, ey, z1 + ov], [x1 + ov, Y1 + rh, zc], [x0 - ov, Y1 + rh, zc], [(x0 - ov) / T, 0], [(x1 + ov) / T, 0], [(x1 + ov) / T, L], [(x0 - ov) / T, L]);
    B.q(rk, [x1 + ov, ey, z0 - ov], [x0 - ov, ey, z0 - ov], [x0 - ov, Y1 + rh, zc], [x1 + ov, Y1 + rh, zc], [(x1 + ov) / T, 0], [(x0 - ov) / T, 0], [(x0 - ov) / T, L], [(x1 + ov) / T, L]);
    B.tri(wk, [x0, Y1, z0], [x0, Y1, z1], [x0, Y1 + rh, zc], [z0 / T, Y1 / T], [z1 / T, Y1 / T], [zc / T, (Y1 + rh) / T]);
    B.tri(wk, [x1, Y1, z1], [x1, Y1, z0], [x1, Y1 + rh, zc], [z1 / T, Y1 / T], [z0 / T, Y1 / T], [zc / T, (Y1 + rh) / T]);
    if (!o.facade) B.q(wk, [x0, y0, z1], [x1, y0, z1], [x1, Y1, z1], [x0, Y1, z1], [x0 / T, y0 / T], [x1 / T, y0 / T], [x1 / T, Y1 / T], [x0 / T, Y1 / T]);
  }
  if (o.facade) { const gh = o.gable ? rh : 0, key = 'fac|' + [o.style, Math.round(w), h, o.gable ? 1 : 0, o.sign || '', o.door == null ? '' : o.door, o.big ? 1 : 0, o.seed].join(',');
    const [c, e] = cached(key, () => paintFacade({ w, h, gh, gable: !!o.gable, style: o.style, seed: o.seed || 1, sign: o.sign, door: o.door, big: o.big })); facadeMesh(G, c, e, x0, x1, y0, z1 + .15); }
  if (o.chim) { const cx = x0 + w * (.22 + r() * .56), cz = o.gable ? z0 + d * .35 : (z0 + z1) / 2 - 3; B.box('w|stone', cx - 4, cx + 4, ridgeY - rh * .55, ridgeY + 9, cz - 4, cz + 4, { top: 'c|#2a2024' }); out.smoke.push({ x: cx, y: ridgeY + 10, z: cz, ph: r(), sp: .8 + r() * .5 }); }
  return ridgeY;
}
const HSTY = ['cream', 'ochre', 'rose', 'sage', 'cream', 'sky'], HROOF = ['tile', 'tile', 'slate', 'thatch', 'tile', 'moss'];
function buildTown(A, G, out, r) {
  const B = townBuilder(), ZF = GT - 10;
  if (A.kind === 'inside') { buildInside(A, B, G, out, r); flushBuilder(B, G); return; }
  // ground beyond the play area (streets, plazas), slightly below the terrain
  { const t = mip(tex(tileTex('cob', A.ap), true)); const m = new THREE.MeshLambertMaterial({ map: t }); MATS.push(m);
    const slab = (x0, x1, z0, z1, y) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), uv = g.attributes.uv, ps = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / B.T, -ps.getZ(i) / B.T); const q = new THREE.Mesh(g, m); q.receiveShadow = true; G.add(q); };
    // the terrain mesh covers x -90..w+90, z GT-24..h+110: streets only behind and beside it, never under it
    slab(-640, A.w + 640, GT - 800, GT - 22, A.view === 'e' ? -1 : -2.5);
    slab(-640, -88, GT - 22, A.h + 400, -2.5); if (A.view !== 'e') slab(A.w + 88, A.w + 640, GT - 22, A.h + 400, -2.5);
    if (A.view === 'e') slab(A.w + 30, A.w + 640, GT - 22, A.h + 400, -70); }
  const sty = () => HSTY[(r() * HSTY.length) | 0], rf = () => HROOF[(r() * HROOF.length) | 0];
  const mk = (x0, x1, o = {}) => house(B, G, out, Object.assign({ x0, x1, z0: (o.z1 || ZF) - (o.d || 44 + r() * 16), z1: ZF, h: 44 + Math.round(r() * 5) * 5, style: sty(), roof: rf(), gable: r() < .4, seed: (Math.abs(x0) * 13 + A.w + (o.z1 || 0)) | 0, facade: true, chim: r() < .55 }, o));
  const gaps = A.exits.filter(e => e.e === 'n').map(e => [e.a - 8, e.b + 8]);
  const blocks = gaps.concat(A.reserve || [], (A.shops || []).map(s => [s.x0, s.x1])).sort((a, b) => a[0] - b[0]);
  if (A.back !== 'wall') {
    for (let x = -170; x < A.w + 170;) {
      const inB = blocks.find(q => x >= q[0] - 2 && x < q[1]); if (inB) { x = inB[1]; continue; }
      const next = blocks.find(q => q[0] > x); let x1 = x + 54 + r() * 34; if (next && x1 > next[0]) x1 = next[0];
      if (x1 - x >= 22) mk(x, x1); x = x1;
    }
    for (const s of A.shops || []) mk(s.x0, s.x1, s);
    for (const g of gaps) { mk(g[0] - 40, g[1] + 40, { z1: ZF - 150, d: 50, chim: true }); }   // the street's far end
  }
  if (A.back === 'wall') {   // the town wall with a gatehouse and portcullis; rooftops peek over it
    const g = gaps[0], z0 = ZF - 26, z1 = ZF, H = 50;
    B.box('w|wall', -300, g[0] - 36, 0, H, z0, z1, { noBack: true }); B.box('w|wall', g[1] + 36, A.w + 300, 0, H, z0, z1, { noBack: true });
    B.merlons('w|wall', -300, g[0] - 40, H, z1 - 6, z1); B.merlons('w|wall', g[1] + 40, A.w + 300, H, z1 - 6, z1);
    for (const [a, b] of [[g[0] - 38, g[0]], [g[1], g[1] + 38]]) { B.box('w|wall', a, b, 0, 82, z0 - 8, z1 + 6); B.merlons('w|wall', a, b, 82, z1, z1 + 6, 9, 5, 8);
      const cone = cylUV(new THREE.CylinderGeometry(0, 30, 40, 4, 1, true).rotateY(Math.PI / 4), 30, 40); const cm = new THREE.Mesh(cone, townMat('r|slate')); cm.position.set((a + b) / 2, 82 + 8 + 20, (z0 + z1) / 2 - 1); cm.castShadow = true; G.add(cm);
      const bnr = cached('bigban|#b8302a', () => paintBigBanner('#b8302a')), bm = bb(bnr, { cast: false }); bm.position.set((a + b) / 2, 74, z1 + 6.4); G.add(bm); out.banners.push(bm); }
    B.box('w|wall', g[0], g[1], 44, 82, z0 - 8, z1 + 6, { noFront: false });
    { const c = cached('archfill', () => paintArchFill(g[1] - g[0], 26)); const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * U, c.height * U), new THREE.MeshLambertMaterial({ map: tex(c), alphaTest: .5 })); MATS.push(m.material); m.position.set((g[0] + g[1]) / 2, 44 - c.height * U / 2, z1 + 6.3); G.add(m); }
    { const c = cached('portc', () => paintPortcullis(g[1] - g[0], 46)); const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * U, c.height * U), new THREE.MeshLambertMaterial({ map: tex(c), alphaTest: .5, side: THREE.DoubleSide }));
      m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.material.map, alphaTest: .5 }); m.castShadow = true; MATS.push(m.material); m.position.set((g[0] + g[1]) / 2, c.height * U / 2, z0 + 4); G.add(m); out.portcullis = m; }
    for (let x = -260; x < A.w + 260;) { const w = 50 + r() * 40; if (x + w < g[0] - 50 || x > g[1] + 50) mk(x, x + w, { z1: z0 - 20, d: 50, h: 46 + r() * 30, facade: false }); x += w; }
    mk(g[0] - 30, g[1] + 30, { z1: z0 - 50, d: 50, h: 52, chim: true });
  }
  if (A.back === 'forge') {   // stone smithy: back wall, a short awning over the big hearth, a tall chimney
    const x0 = A.reserve[0][0] + 4, x1 = A.reserve[0][1] - 4, zb = GT - 54;
    B.box('w|stone', x0, x1, 0, 72, zb - 14, zb, { noBack: true }); B.box('w|stone', x0 - 6, x0 + 4, 0, 56, zb - 14, ZF + 8); B.box('w|stone', x1 - 4, x1 + 6, 0, 56, zb - 14, ZF + 8);
    B.q('r|slate', [x0 - 8, 84, zb - 16], [x1 + 8, 84, zb - 16], [x1 + 8, 74, zb + 22], [x0 - 8, 74, zb + 22], [(x0 - 8) / B.T, 1], [(x1 + 8) / B.T, 1], [(x1 + 8) / B.T, 0], [(x0 - 8) / B.T, 0]);
    const cx = (x0 + x1) / 2; B.box('w|stone', cx - 16, cx + 16, 72, 118, zb - 14, zb + 4, { top: 'c|#2a2024' }); out.smoke.push({ x: cx, y: 120, z: zb - 5, ph: .2, sp: 1.3, big: true });
  }
  if (A.back === 'chapel') {   // bell tower + chapel nave
    const [rx0, rx1] = A.reserve[0], tx0 = rx0 + 10, tx1 = tx0 + 56, tz0 = ZF - 62, tz1 = ZF - 2, TH_ = 128, tcx = (tx0 + tx1) / 2;
    B.box('w|stone', tx0, tx1, 0, TH_, tz0, tz1, { top: 'c|#5a5450' }); B.merlons('w|stone', tx0, tx1, TH_, tz1 - 5, tz1, 10, 6, 6);
    const cone = cylUV(new THREE.CylinderGeometry(0, 44, 62, 4, 1, true).rotateY(Math.PI / 4), 44, 62); const cm = new THREE.Mesh(cone, townMat('r|slate')); cm.position.set(tcx, TH_ + 31, (tz0 + tz1) / 2); cm.castShadow = true; G.add(cm);
    const bc = cached('belfry', () => paintBelfry(tx1 - tx0, 36)), bm = new THREE.Mesh(new THREE.PlaneGeometry(bc.width * U, bc.height * U), new THREE.MeshLambertMaterial({ map: tex(bc) })); MATS.push(bm.material); bm.position.set(tcx, 88 + bc.height * U / 2, tz1 + .2); G.add(bm);
    const bell = bb(cached('bell', paintBell), { cast: false }); bell.position.set(tcx, 118, tz1 - 4); G.add(bell); out.bell = bell;
    { const [c, e] = cached('towerdoor', () => paintFacade({ w: tx1 - tx0, h: 40, style: 'stone', seed: 3, door: .5, big: true })); facadeMesh(G, c, e, tx0, tx1, 0, tz1 + .15); B.box('w|stone', tx0, tx1, 40, 88, tz1, tz1 + .1, { noBack: true, noTop: true }); }
    const nx0 = tx1, nx1 = rx1 - 6, nw = nx1 - nx0, nh = 66, rh = nw * .42;
    house(B, G, out, { x0: nx0, x1: nx1, z0: ZF - 120, z1: ZF - 6, h: nh, style: 'stone', roof: 'slate', gable: true, facade: false, seed: 5 });
    const [c, e] = cached('chapelfront', () => paintChapelFront({ w: nw, h: nh, gh: rh })); facadeMesh(G, c, e, nx0, nx1, 0, ZF - 5.85);
  }
  if (A.back === 'keep') {   // the keep: a great stone block, two round towers with cone roofs, curtain walls, banners
    const kx0 = 150, kx1 = 330, kz0 = ZF - 130, kz1 = ZF - 22, KH = 118;
    B.box('w|keep', kx0, kx1, 0, KH, kz0, kz1, { noFront: true, top: 'c|#6a6458' }); B.merlons('w|keep', kx0, kx1, KH, kz1 - 6, kz1, 12, 7, 9); B.merlons('w|keep', kx0, kx1, KH, kz0, kz0 + 6, 12, 7, 9);
    const [c, e] = cached('keepfront', () => paintKeepFront({ w: kx1 - kx0, h: KH })); facadeMesh(G, c, e, kx0, kx1, 0, kz1 + .1);
    for (const tx of [118, 362]) { const tr = 30, th = 146, cg = cylUV(new THREE.CylinderGeometry(tr, tr + 2, th, 14, 1, true), tr, th); const tm = new THREE.Mesh(cg, townMat('w|keep')); tm.position.set(tx, th / 2, ZF - 40); tm.castShadow = tm.receiveShadow = true; G.add(tm);
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; B.box('w|keep', tx + Math.cos(a) * tr - 3, tx + Math.cos(a) * tr + 3, th, th + 8, ZF - 40 + Math.sin(a) * tr - 3, ZF - 40 + Math.sin(a) * tr + 3); }
      const cone = cylUV(new THREE.CylinderGeometry(0, tr + 6, 52, 14, 1, true), tr + 6, 52), cm = new THREE.Mesh(cone, townMat('r|tile')); cm.position.set(tx, th + 8 + 26, ZF - 40); cm.castShadow = true; G.add(cm);
      const fl = bb(cached('bigban|#2e5a8a', () => paintBigBanner('#2e5a8a')), { cast: false }); fl.position.set(tx, th - 6, ZF - 40 + tr + 2.5); G.add(fl); out.banners.push(fl); }
    for (const bx of [kx0 + 40, kx1 - 40]) { const bm = bb(cached('bigban|#b8302a', () => paintBigBanner('#b8302a')), { cast: false }); bm.position.set(bx, KH - 14, kz1 + .6); bm.scale.set(1.4, 1.6, 1); G.add(bm); out.banners.push(bm); }
    B.box('w|keep', 20, 90, 0, 56, ZF - 44, ZF - 18, { noBack: true }); B.merlons('w|keep', 20, 90, 56, ZF - 24, ZF - 18); B.box('w|keep', 390, 460, 0, 56, ZF - 44, ZF - 18, { noBack: true }); B.merlons('w|keep', 390, 460, 56, ZF - 24, ZF - 18);
  }
  // side rows of houses (the playable area is a little square or lane between them)
  if (A.border === 'town' || !A.border) for (const side of ['w', 'e']) {
    const ex = A.exits.filter(e => e.e === side).map(e => [e.a - 16, e.b + 16]), low = A.view === 'e' && side === 'e';
    for (let z = ZF - 30; z < A.h + 120;) { const d = 60 + r() * 30, g = ex.find(q => z + d > q[0] && z < q[1]);
      if (g) { const zz = g[0]; if (zz - z > 30) house(B, G, out, { x0: side === 'w' ? -100 : A.w + 16, x1: side === 'w' ? -16 : A.w + 100, z0: z, z1: zz, h: 44 + r() * 20, style: sty(), roof: rf(), seed: z | 0, chim: r() < .5, base: 0 }); z = g[1]; continue; }
      const x0 = side === 'w' ? -100 - r() * 20 : A.w + 16 + (low ? 30 : 0), x1 = side === 'w' ? -16 : A.w + 100 + r() * 20 + (low ? 30 : 0);
      house(B, G, out, { x0, x1, z0: z, z1: z + d, h: 44 + r() * 22, style: sty(), roof: rf(), seed: z | 0, chim: r() < .5, base: low ? -70 : 0 }); z += d; }
    for (const g of ex) house(B, G, out, { x0: side === 'w' ? -260 : A.w + 170, x1: side === 'w' ? -170 : A.w + 260, z0: g[0] - 10, z1: g[1] + 10, h: 50, style: sty(), roof: rf(), seed: 77 + g[0] | 0 });
  }
  if (A.view === 'e') B.box('w|stone', A.w - 6, A.w + 2, 0, 9, GT - 10, A.h + 60, { top: 'c|#c0b6a2' });
  // skyline: rows of rooftops fading into the haze
  for (let row = 0; row < 3; row++) { const zf = ZF - 210 - row * 110; for (let x = -320; x < A.w + 320;) { const w = 50 + r() * 50; house(B, G, out, { x0: x, x1: x + w, z0: zf - 50, z1: zf, h: 44 + r() * 50 + row * 6, style: sty(), roof: rf(), seed: (x * 3 + row) | 0, gable: r() < .3, chim: false }); x += w; } }
  // landmarks on the skyline: the keep's towers and the chapel spire
  if (A.back !== 'keep') for (const [lx, lz] of [[A.w * .72, ZF - 420]]) { const cg = cylUV(new THREE.CylinderGeometry(26, 28, 190, 12, 1, true), 26, 190), m = new THREE.Mesh(cg, townMat('w|keep')); m.position.set(lx, 95, lz); G.add(m);
    const cm = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(0, 32, 54, 12, 1, true), 32, 54), townMat('r|tile')); cm.position.set(lx, 190 + 27, lz); G.add(cm); }
  if (A.back !== 'chapel') { const sx = A.w * .2, sz = ZF - 380; B.box('w|stone', sx - 18, sx + 18, 0, 170, sz - 18, sz + 18); const cm = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(0, 28, 70, 4, 1, true).rotateY(Math.PI / 4), 28, 70), townMat('r|slate')); cm.position.set(sx, 205, sz); G.add(cm); }
  flushBuilder(B, G);
}
function buildInside(A, B, G, out, r) {   // the Mossy Mug: a cut-away room
  const H = 100, ZB = GT - 8, X0 = -8, X1 = A.w + 8;
  B.box('w|inwall', X0 - 40, X1 + 40, 0, H, ZB - 14, ZB, { noBack: true, top: 'c|#3a2416' });
  B.box('w|inwall', X0 - 16, X0, 0, H, ZB - 14, A.h + 70, { top: 'c|#3a2416' }); B.box('w|inwall', X1, X1 + 16, 0, H, ZB - 14, A.h + 70, { top: 'c|#3a2416' });
  B.box('c|#4a2e1c', X0 - 16, X1 + 16, H - 10, H, ZB - 14, ZB + 6);
  for (const x of [A.w * .33, A.w * .67]) B.box('c|#4a2e1c', x - 4, x + 4, H - 10, H, ZB - 14, ZB + 140);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(A.w + 600, 900).rotateX(-Math.PI / 2).translate(A.w / 2, -2, A.h / 2), new THREE.MeshBasicMaterial({ color: '#140a08' })); G.add(g);
}
// bunting and festival lanterns: sagging strings between anchor points
const BUNT = ['#c83a2a', '#e8c040', '#3a7aa8', '#fff4e0', '#8a5ab0', '#5a9a5a', '#f07a3a'];
const LANT = ['#ff8a3a', '#ffd04a', '#ff5a5a', '#ffb03a', '#f07ad0'];
function buildStrings(A, G, out) {
  if (!A.strings) return;
  const fp = [], fc = [], lpos = [], lcol = [];
  for (const [a, b, sag] of A.strings) { const len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(6, Math.round(len / 7)), dx = (b[0] - a[0]) / len, dz = (b[2] - a[2]) / len;
    const pt = t => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)];
    for (let i = 0; i < n; i++) { const p0 = pt(i / n), p1 = pt((i + .45) / n), pm = pt((i + .22) / n), c = rgb(BUNT[Math.abs(i + a[0] | 0) % BUNT.length]).map(v => v / 255);
      fp.push(...p0, ...p1, pm[0], pm[1] - 5.5, pm[2] + .1); for (let k = 0; k < 3; k++) fc.push(...c);
      fp.push(...pt(i / n), ...pt((i + 1) / n), ...pt((i + 1) / n).map((v, k) => k === 1 ? v - .6 : v)); for (let k = 0; k < 3; k++) fc.push(.2, .14, .12);
      if (i % 2 === 1) { const q = pt((i + .7) / n); lpos.push(q); lcol.push(LANT[(i >> 1) % LANT.length]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); MATS.push(m); const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; G.add(mesh);
  // paper lanterns (one instanced draw, unlit and bright: bloom does the glowing); shown for the festival
  const lc = cached('plant', () => paintPaperLantern({ c: '#ffffff' })), lm = new THREE.MeshBasicMaterial({ map: lc.tex || (lc.tex = tex(lc)), alphaTest: .5, side: THREE.DoubleSide, fog: false });
  const im = new THREE.InstancedMesh(bbGeo(lc), lm, lpos.length), col = new THREE.Color();
  lpos.forEach((q, i) => { dummy.position.set(q[0], q[1] - .5, q[2] + .3); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.85); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, col.set(lcol[i]).multiplyScalar(1.6)); });
  im.frustumCulled = false; im.visible = false; G.add(im); out.lanterns = im; out.lanternPts = lpos;
}

// ---------------------------------------------------------------- area dioramas (built on first visit)
const W3 = {};
function waterMat(flow) { return new THREE.ShaderMaterial({ vertexShader: WATER_V, fragmentShader: WATER_F, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uFlow: { value: flow }, cDeep: { value: new THREE.Color('#1e4a66') }, cMid: { value: new THREE.Color('#2e6e88') }, cHi: { value: new THREE.Color('#9ad0d8') } } }); }
function itemMesh(W, it) { const sp = ITEMSPR[it.type] || ITEMSPR.acorn, m = bb(sp[0], { glow: sp[1] || null, gi: sp[2] || .6 }), b = blob(10, 5); W.G.add(m, b); W.items[it.id] = { m, b }; return W.items[it.id]; }
function build3D(A) {
  const G = new THREE.Group(), ap = A.ap, out = { G, props: [], items: {}, npcs: {}, beams: [], lights: [], water: [], mist: [], smoke: [], banners: [], crit: [], embers: [] };
  const r = rng(A.w + A.id.charCodeAt(1) * 31);
  // terrain heightfield with a painted pixel texture
  const X0 = -90, X1 = A.w + 90, Z0 = GT - 24, Z1 = A.h + 110, TW = Math.round((X1 - X0) / U), TH = Math.round((Z1 - Z0) / U);
  const gg = new THREE.PlaneGeometry(TW * U, TH * U, Math.round(TW * U / 5), Math.round(TH * U / 5)); gg.rotateX(-Math.PI / 2); gg.translate(X0 + TW * U / 2, 0, Z0 + TH * U / 2);
  const gp = gg.attributes.position; for (let i = 0; i < gp.count; i++) gp.setY(i, hAt(A, gp.getX(i), gp.getZ(i))); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ map: mip(tex(groundTexture(A, X0, Z0, TW, TH))) })); ground.receiveShadow = true; MATS.push(ground.material); G.add(ground);
  const CH_ = 34;
  if (A.kind !== 'forest') buildTown(A, G, out, r); else {
  // the back cliff: stepped rock blocks with gaps for north exits and the waterfall, a plateau behind
  const gaps = A.exits.filter(e => e.e === 'n').map(e => [e.a - 4, e.b + 4, true]); if (A.id === 'stream') gaps.push([streamX(GT) - STREAM_HW - 2, streamX(GT) + STREAM_HW + 2, false]);
  const sides = [], tops = [], uvS = [], uvT = [];
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
  const rockM = new THREE.MeshLambertMaterial({ map: mip(tex(tileTex('rock', ap), true)) }), topM = new THREE.MeshLambertMaterial({ map: mip(tex(tileTex('top', ap), true)) }); MATS.push(rockM, topM);
  const cliffS = new THREE.Mesh(mkGeo(sides, uvS), rockM), cliffT = new THREE.Mesh(mkGeo(tops, uvT), topM);
  for (const m of [cliffS, cliffT]) { m.castShadow = m.receiveShadow = true; G.add(m); }
  const ptx = mip(tex(tileTex('top', ap), true)); ptx.repeat.set((A.w + 1400) / T, 800 / T); const pM = new THREE.MeshLambertMaterial({ map: ptx }); MATS.push(pM);
  const plateau = new THREE.Mesh(new THREE.PlaneGeometry(A.w + 1400, 800).rotateX(-Math.PI / 2).translate(A.w / 2, CH_ - 1, CLIFF_Z - CLIFF_D - 398), pM); plateau.receiveShadow = true; G.add(plateau);
  // backdrop forest on the plateau (fog fades it into the haze)
  const bt = []; for (let i = 0; i < 6; i++) bt.push(paintTree({ seed: 900 + i, pal: ap.trees[i % ap.trees.length] }));
  for (let i = 0; i < 70; i++) { const c = bt[i % bt.length], m = bb(c, { recv: false }); const z = CLIFF_Z - CLIFF_D - 6 - r() * 330, s = 1.1 + r() * .9 + (CLIFF_Z - z) / 300; m.position.set(-260 + r() * (A.w + 520), CH_ - 1, z); m.scale.setScalar(s); m.castShadow = z > CLIFF_Z - CLIFF_D - 60; G.add(m); }
  }
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
  // props (repeated static props share one instanced draw per sprite)
  const inst = new Map();
  for (const p of A.props) {
    if (p.k === 'stone') continue;
    const d = PROPDEF[p.k];
    const key = 'p|' + p.k + '|' + JSON.stringify([p.pal, d.inst && !d.seeded ? 0 : p.seed, p.s, p.cap, p.c, p.berries === false ? 0 : 1, p.stack, p.kind, p.load, p.fill, p.n]);
    const c = cached(key, () => d.paint(p));
    if (d.inst && !p.id && !p.glow) { let L = inst.get(key); if (!L) inst.set(key, L = { c, list: [] }); L.list.push(p); continue; }
    let m;
    if (d.low) { m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * U, c.height * U).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: c.tex || (c.tex = tex(c)), alphaTest: .5 })); MATS.push(m.material); m.position.set(p.x, WATER_Y + .25, p.y); m.receiveShadow = true; }
    else { m = bb(c, { glow: p.glow, gi: .32, emi: d.emi ? cached(key + '|emi', () => glowMask(c, (r_, g_, b_) => r_ > 225 && g_ > 120 && b_ < 215 && r_ - b_ > 40)) : null, ek: d.emi }); m.position.set(p.x, hAt(A, p.x, p.y) - .5 + (p.lift || 0), p.y); if (p.k === 'leafpile' || p.k === 'flowers' || p.lift) m.castShadow = false; }
    m.userData.p = p; G.add(m); out.props.push(m);
    if (p.glow) out.lights.push({ x: p.x, y: 14 * (p.s || 1), z: p.y + 4, c: p.glow, i: 260 * (p.s || 1), flick: .1 });
    if (d.light) out.lights.push({ x: p.x, y: d.light[1], z: p.y + 3, c: d.light[0], i: 300 * d.light[2], flick: d.emi === 'fire' ? .35 : .2, lamp: d.emi === 'lamp', fire: d.emi === 'fire' });
    if (d.emi === 'fire') out.embers.push({ x: p.x, y: p.k === 'hearth' ? 14 : 10, z: p.y + 3, n: p.k === 'hearth' ? 14 : 8, forge: p.k === 'hearth' });
  }
  for (const [, L] of inst) { const t = L.c.tex || (L.c.tex = tex(L.c)), im = new THREE.InstancedMesh(bbGeo(L.c), spriteMat(t), L.list.length);
    im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5 });
    L.list.forEach((p, i) => { dummy.position.set(p.x, hAt(A, p.x, p.y) - .5, p.y); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; G.add(im); }
  if (A.id === 'hollow') out.lights.push({ x: 240, y: 14, z: 186, c: '#ff9a3a', i: 650, flick: .2 });
  if (A.id === 'glade') out.lights.push({ x: 268, y: 22, z: 160, c: '#ffd86a', i: 420, flick: .05 });
  // items
  for (const it of A.items) itemMesh(out, it);
  // NPCs
  for (const nid of A.npcs) { const n = NPCS[nid], fr = critFrames(n.kind), m = bb(fr[0]), b = blob(n.kind === 'owl' ? 18 : n.kind === 'tortoise' ? 30 : 22, 9); G.add(m, b); out.npcs[nid] = { m, b, fr }; }
  // ambient critters: hens that wander (and scatter when you run at them), cats that doze
  for (const [k, x, y] of A.critters || []) { const fr = critFrames(k), m = bb(fr[0]), b = blob(k === 'cat' ? 18 : 12, 6); G.add(m, b); out.crit.push({ k, x, y, hx: x, hy: y, tx: x, ty: y, wait: Math.random() * 3, m, b, fr, flip: 1, mv: 0, ph: Math.random() * 9 }); }
  // the market fountain: stone basin, a pillar with a bowl, water in both, a carved acorn on top
  if (A.fountain) { const F = A.fountain, stoneM = townMat('w|stone');
    const bas = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(F.r, F.r + 2, 9, 22), F.r, 9), stoneM); bas.position.set(F.x, 4.5, F.y); bas.castShadow = bas.receiveShadow = true; G.add(bas);
    const wm = waterMat(0); out.water.push(wm); const w1 = new THREE.Mesh(new THREE.CircleGeometry(F.r - 3, 22).rotateX(-Math.PI / 2), wm); w1.position.set(F.x, 9.2, F.y); w1.renderOrder = 2; G.add(w1);
    const pil = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(3.5, 5, 28, 8), 4, 28), stoneM); pil.position.set(F.x, 14, F.y); pil.castShadow = true; G.add(pil);
    const bowl = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(12, 6, 5, 14), 12, 5), stoneM); bowl.position.set(F.x, 29, F.y); bowl.castShadow = true; G.add(bowl);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(10, 14).rotateX(-Math.PI / 2), wm); w2.position.set(F.x, 31.6, F.y); w2.renderOrder = 2; G.add(w2);
    const ac = bb(ACORN, { cast: true }); ac.scale.setScalar(1.6); ac.position.set(F.x, 31, F.y); G.add(ac); out.fount = F; }
  buildStrings(A, G, out);
  // god rays: tall additive shafts slanting down from the canopy to the ground, plus warm pools where they land
  for (const b of A.beams) {
    const ex = clamp(b.x0 - Math.sin(b.a) * b.L, 20, A.w - 20), ez = clamp(-60 + Math.cos(b.a) * b.L, GT + 30, A.h - 10);
    const Tp = new THREE.Vector3(ex + 120, 230, ez - 90), Bp = new THREE.Vector3(ex, hAt(A, ex, ez), ez), w = b.w * .8;
    const dir = Bp.clone().sub(Tp).normalize(), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
    const mk = off => { const g = new THREE.BufferGeometry(), t1 = off.clone().multiplyScalar(1.5);
      g.setAttribute('position', new THREE.Float32BufferAttribute([...Tp.clone().sub(t1).toArray(), ...Tp.clone().add(t1).toArray(), ...Bp.clone().add(off).toArray(), ...Bp.clone().sub(off).toArray()], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); g.setIndex([0, 2, 1, 0, 3, 2]); return g; };
    const mat = new THREE.MeshBasicMaterial({ map: BEAMT, color: ap.sun, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: .3 });
    const q1 = new THREE.Mesh(mk(new THREE.Vector3(w / 2, 0, 0)), mat), q2 = new THREE.Mesh(mk(new THREE.Vector3(w * .3, 0, 0)), mat); q2.position.z = -14; q2.position.x = 6; q2.visible = A.kind === 'forest';
    const pm = new THREE.MeshBasicMaterial({ map: POOL, color: ap.sun, transparent: true, depthWrite: false, fog: false, opacity: .5 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.1, w * 1.1).rotateX(-Math.PI / 2), pm); pool.position.set(ex + 4, Bp.y + .6, ez - 2);
    for (const q of [q1, q2, pool]) { q.renderOrder = 4; G.add(q); }
    out.beams.push({ b, Tp, Bp, w, mat, pm, dust: Array.from({ length: 12 }, () => ({ u: Math.random(), v: Math.random() - .5, s: Math.random() - .5, sp: .02 + Math.random() * .03, ph: Math.random() * TAU })) });
  }
  // drifting ground mist (vertical sheets at a few depths: parallax for free)
  if (A.kind !== 'inside') for (const [z, y, h, a] of A.kind === 'town' ? [[A.h * .52, 6, 22, .1], [A.h + 6, 6, 26, .14], [GT - 160, 70, 70, .35], [GT - 330, 90, 120, .5]] : [[GT + 26, 9, 34, .32], [A.h * .52, 6, 26, .18], [A.h + 6, 6, 30, .22], [CLIFF_Z - CLIFF_D - 70, CH_ + 14, 70, .5], [CLIFF_Z - CLIFF_D - 200, CH_ + 30, 120, .55]]) {
    const t = tex(MISTC, true, true); t.repeat.set(4, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, h), new THREE.MeshBasicMaterial({ map: t, color: ap.mist, transparent: true, opacity: a, depthWrite: false, fog: z < 0 }));
    m.position.set(A.w / 2, y, z); m.renderOrder = 3; G.add(m); out.mist.push({ m, t, sp: .004 + Math.random() * .006, a });
  }
  // fireflies
  out.flies = Array.from({ length: ap.fireflies || 0 }, () => ({ x: 20 + r() * (A.w - 40), y: 6 + r() * 34, z: GT + 20 + r() * (A.h - GT - 30), ph: r() * TAU, sp: .3 + r() * .5 }));
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
const brightM = sm(BRIGHT_F, { t: { value: null }, px: { value: new THREE.Vector2() }, th: { value: .84 } });
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
// time of day: palettes blend day -> dusk -> night (S.dk 0..2) as the quests progress; strongest in town
const hx = c => '#' + rgb(c).map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function mixPal(a, b, t) { if (t <= 0) return a; const m = (x, y) => hx(mix(x, y, t));
  return Object.assign({}, a, { sky: [m(a.sky[0], b.sky[0]), m(a.sky[1], b.sky[1])], fog: m(a.fog, b.fog), sun: m(a.sun, b.sun), hemi: [m(a.hemi[0], b.hemi[0]), m(a.hemi[1], b.hemi[1])],
    grade: [0, 1].map(k => a.grade[k].map((v, i) => lerp(v, b.grade[k][i], t))), mist: m(a.mist, b.mist), sunI: lerp(a.sunI || 1.9, b.sunI || 1.9, t), hemiI: lerp(a.hemiI || 1.35, b.hemiI || 1.35, t), rays: lerp(a.rays, b.rays == null ? a.rays : b.rays, t) }); }
function litPal(A) { const k = S.dk; if (A.kind === 'inside') return A.ap; const town = A.kind === 'town';
  let P = mixPal(A.ap, AP.dusk, Math.min(1, k) * (town ? 1 : .5)); if (k > 1) P = mixPal(P, AP.night, (k - 1) * (town ? 1 : .7)); return P; }
let curP = AP.meadow, litK = -9;
function applyLight(A) {
  const P = curP = litPal(A); litK = S.dk; skyTex(P);
  if (!scene.fog) scene.fog = new THREE.Fog(P.fog, CAMD * .9, CAMD * 2.4); scene.fog.color.set(P.fog); scene.fog.near = CAMD * .9; scene.fog.far = CAMD * 2.4;
  hemi.color.set(P.hemi[0]); hemi.groundColor.set(P.hemi[1]); hemi.intensity = P.hemiI || 1.35; sun.color.set(P.sun); sun.intensity = P.sunI || 1.9;
  for (const c of COMP) { c.uniforms.shTint.value.fromArray(P.grade[0]); c.uniforms.hiTint.value.fromArray(P.grade[1]); }
  if (curW) for (const m of curW.mist) m.m.material.color.set(P.mist);
}
function onEnterArea(A) {
  if (!R) return;
  if (!W3[A.id]) W3[A.id] = build3D(A);
  for (const k in W3) W3[k].G.visible = k === A.id;
  curW = W3[A.id];
  sun.position.set(A.w / 2 - 200, 330, A.h / 2 + 260); sun.target.position.set(A.w / 2, 0, A.h / 2 - 20);
  applyLight(A);
  PL.forEach(l => { l.userData = null; l.intensity = 0; }); assignLights();
  for (const l of LEAVES3) l.y = -999;
}
// only a few real point lights: the ones nearest the view; the rest glow through emissive pixels + bloom
function assignLights() { const W = curW, nA = W.flies.length ? NPL - 2 : NPL, cx = S.camX, cz = S.camY - 20;
  const ls = W.lights.length > nA ? W.lights.slice().sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)) : W.lights;
  PL.forEach((l, i) => { const q = i < nA ? ls[i] || null : null; if (l.userData !== q) { l.userData = q; if (q) { l.position.set(q.x, q.y, q.z); l.color.set(q.c); } else l.intensity = 0; } }); W.lt = S.t; }
const skyCv = document.createElement('canvas'); skyCv.width = 2; skyCv.height = 128; let skyTx = null;
function skyTex(ap) {   // a vertical gradient behind everything
  const g = skyCv.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 128);
  lg.addColorStop(0, ap.sky[1]); lg.addColorStop(.55, ap.sky[0]); lg.addColorStop(1, ap.fog); g.fillStyle = lg; g.fillRect(0, 0, 2, 128);
  if (!skyTx) skyTx = tex(skyCv, false, true); else skyTx.needsUpdate = true; scene.background = skyTx;
}
function beamLight(x, z) { let k = 0; if (!curW) return 0; for (const B of curW.beams) { const dx = Math.abs(x - (B.Bp.x + 8)) / (B.w * .5), dz = Math.abs(z - (B.Bp.z - 5)) / 18; if (dx < 1 && dz < 1) k = Math.max(k, (1 - dx) * (1 - dz * .6)); } return k; }
function fadeOccluders(W, dt) {
  const tp = Math.tan(PITCH), hx = S.px, hz = S.py;
  for (const m of W.props) { const p = m.userData.p; if (!p || p.lift) continue; const dz = p.y - hz; let want = 1;
    if (dz > 1 && dz < 140) { const bb_ = m.userData.bb || (m.geometry.boundingBox || m.geometry.computeBoundingBox(), m.userData.bb = m.geometry.boundingBox);
      const top = bb_.max.y * (m.scale.y || 1); if (top > 18 && dz * tp < top - 4 && hx > p.x + bb_.min.x - 6 && hx < p.x + bb_.max.x + 6) want = .3; }
    const mt = m.material, o = mt.userData.fade == null ? 1 : mt.userData.fade; if (o === want) continue;
    const n = want < o ? Math.max(want, o - dt * 4) : Math.min(want, o + dt * 3); mt.userData.fade = n;
    const tr = n < .999; if (mt.transparent !== tr) { mt.transparent = tr; mt.depthWrite = !tr; mt.alphaTest = tr ? .05 : .5; mt.needsUpdate = true; }
    mt.opacity = n; }
}
function update3D(dt) {
  const A = S.A, W = curW, t = S.t;
  placeCam(S.camX, S.camY); fadeOccluders(W, dt);
  // hero
  const f = S.moving ? Math.floor(S.walk * 9) % 4 : 0, blink = (t % 3.9) < .13 ? 1 : 0;
  if (S.flags.ribbon && !heroRib) { heroRib = {}; for (const d of ['down', 'up', 'side']) for (let q = 0; q < 4; q++) for (const b of [0, 1]) heroRib[d + q + b] = paintHero(d, q, b, true); }
  setFrame(hero, (S.flags.ribbon ? heroRib : heroFrames)[S.dir + f + blink]);
  const hy = standY(A, S.px, S.py);
  hero.position.set(S.px, hy - .4, S.py); hero.scale.x = S.dir === 'side' && S.facing < 0 ? -1 : 1;
  heroBlob.position.set(S.px, hy + .15, S.py + 1); heroBlob.visible = S.mode !== 'title' || true;
  const hl = beamLight(S.px, S.py) * curP.rays; hero.material.emissive.setRGB(.14 * hl, .1 * hl, .05 * hl);
  // NPCs
  for (const nid in W.npcs) {
    const n = NPCS[nid], o = W.npcs[nid], on = npcOn(n); o.m.visible = o.b.visible = on; if (!on) continue; const fr = o.fr, idle = Math.floor(t * 1.7 + n.x) % 2, bl = ((t + n.x * .37) % 4.3) < .14 ? 1 : 0;
    setFrame(o.m, fr[idle * 2 + bl]);
    const y = n.kind === 'frog' && !n.land ? WATER_Y + .6 : n.kind === 'owl' && !n.land ? 17.5 : hAt(A, n.x, n.y);
    o.m.position.set(n.x, y - .3, n.y + (n.kind === 'owl' && !n.land ? 1.5 : 0)); o.m.scale.x = n.front ? 1 : (n.flip == null || n.flip >= 0 ? 1 : -1);
    o.b.position.set(n.x, y + .2, n.y + 1); o.b.visible = n.kind !== 'owl' || !!n.land;
    const k = beamLight(n.x, n.y) * curP.rays; o.m.material.emissive.setRGB(.14 * k, .1 * k, .05 * k);
  }
  // items
  for (const it of A.items) {
    const o = W.items[it.id] || itemMesh(W, it); const got = S.got.has(it.id); o.m.visible = o.b.visible = !got; if (got) continue;
    let x = it.x, z = it.y, y = hAt(A, x, z) + 3 + Math.sin(t * 3 + it.ph) * 1.6;
    if (it.pop && it.pop.t < 1) { const k = it.pop.t; x = lerp(it.pop.x0, it.x, k); z = lerp(it.pop.y0 + 30, it.y, k); y = 4 + Math.sin(k * Math.PI) * 60; }
    o.m.position.set(x, y, z); o.m.scale.x = Math.abs(Math.cos(t * 2.4 + it.ph)) < .2 ? .2 * Math.sign(Math.cos(t * 2.4 + it.ph) || 1) : Math.cos(t * 2.4 + it.ph);
    o.b.position.set(x, hAt(A, x, z) + .2, z + .5); o.b.scale.set(8 - (y - hAt(A, x, z)) * .3, 1, 4);
  }
  // props: sway, rustle, the bouncy mushroom
  for (const m of W.props) { const p = m.userData.p, d = PROPDEF[p.k]; if (d.low) continue;
    m.rotation.z = (d.sway ? Math.sin(t * .9 + p.ph) * d.sway : 0) + (p.rustle ? Math.sin(t * 40) * .07 * p.rustle : 0);
    if (p.id === 'appletree') { const n = 3 - Math.min(3, S.flags.shakes || 0); if (m.userData.n !== n) { m.userData.n = n; setFrame(m, cached('appletree|' + n, () => paintAppleTree({ seed: 12, n }))); } }
    if (p.id === 'bouncy') { const b = S.bounceT || 0; m.scale.y = 1 - Math.sin(b * Math.PI * 4) * .2 * b; m.scale.x = 1 + Math.sin(b * Math.PI * 4) * .12 * b; } }
  // beams breathe; dust drifts inside them
  fxN = 0; const lowFx = Q.tier === 0;
  for (const B of W.beams) {
    const a = curP.rays * (A.kind === 'town' ? .55 : .8) * (.13 + .03 * Math.sin(t * .45 + B.b.ph) + .015 * Math.sin(t * 1.7 + B.b.ph * 2)); B.mat.opacity = a; B.pm.opacity = a * .9;
    if (!lowFx || true) for (const d of B.dust) { const u = (d.u + t * d.sp) % 1; if (lowFx && d.ph > 3) continue;
      const x = lerp(B.Tp.x, B.Bp.x, u) + d.v * B.w * .8 + Math.sin(t * .7 + d.ph) * 2, y = lerp(B.Tp.y, B.Bp.y, u), z = lerp(B.Tp.z, B.Bp.z, u) + d.s * 16;
      fxAdd(x, y, z, '#fff0c8', Math.sin(u * Math.PI) * (.45 + .45 * Math.sin(t * 2.2 + d.ph)), 1.3); }
  }
  // fireflies (+2 wandering point lights)
  const fc = A.id === 'grove' ? '#a8ffd8' : '#ffd88a';
  townFx(A, W, t, dt, lowFx);
  W.flies.forEach((m, i) => { if (lowFx && i % 2) return; const x = m.x + Math.sin(t * m.sp + m.ph) * 26, z = m.z + Math.cos(t * m.sp * 1.3 + m.ph) * 16, y = m.y + Math.sin(t * m.sp * 2 + m.ph) * 6, a = .5 + .5 * Math.sin(t * 3 + m.ph);
    fxAdd(x, y, z, fc, a, 1.5); fxAdd(x, y, z, fc, a * .22, 4.5); });
  PL.forEach((l, i) => { const q = l.userData;
    if (q) l.intensity = (q.lamp ? .3 + .75 * Math.min(1, S.dk) : 1) * q.i * (1 - q.flick + q.flick * (Math.sin(t * 7 + i) * .5 + .5) * (Math.sin(t * 2.3 + i * 2) * .5 + .5));
    else if (i >= NPL - 2 && W.flies.length) { const m = W.flies[(i * 7) % W.flies.length]; l.position.set(m.x + Math.sin(t * m.sp + m.ph) * 26, m.y + 6, m.z + Math.cos(t * m.sp * 1.3 + m.ph) * 16); l.color.set(fc); l.intensity = 140 * (.5 + .5 * Math.sin(t * 3 + m.ph)); }
    else l.intensity = 0; });
  // secret sparkles
  const sec = [];
  if (A.id === 'stream') A.stones.forEach(s => s.hidden && sec.push([s.x, WATER_Y + 2, s.y]));
  if (A.id === 'hollow') sec.push([fakeBush.x, 16, fakeBush.y]);
  if (A.id === 'grove' && !S.flags.bounced) sec.push([bouncy.x, 46, bouncy.y]);
  if (A.id === 'glade') sec.push([268, 24, 152]);
  if (A.id === 'keep' && !S.got.has('g5')) sec.push([fakeHedge.x, 16, fakeHedge.y]);
  if (A.id === 'tavern' && !S.got.has('g4')) sec.push([204, 22, GT + 4]);
  if (A.id === 'grove' && !S.got.has('gc') && S.flags.askedGlow) sec.push([118, 14, 262]);
  sec.forEach((q, i) => { for (let k = 0; k < 4; k++) { const ph = t * 1.4 + i * 1.7 + k * 1.6, a = Math.max(0, Math.sin(ph)), cyc = Math.floor(ph / Math.PI);
    fxAdd(q[0] + Math.sin(k * 3.1 + cyc * 1.9) * 12, q[1] + Math.cos(k * 2.3 + cyc * 2.7) * 7, q[2] + 2, '#fff2b0', a, 1.6); } });
  for (const s of S.sparks) fxAdd(s.x, s.y, s.z, '#ffe27a', 1 - s.t, 1.8);
  fxGeo.attributes.position.needsUpdate = fxGeo.attributes.aCol.needsUpdate = fxGeo.attributes.aSize.needsUpdate = true; fxGeo.setDrawRange(0, fxN);
  // falling leaves (tumbling, around the view)
  const nL = A.kind === 'inside' ? 0 : lowFx || A.kind === 'town' ? LEAFN / 2 : LEAFN, hw = camOff.hw * 1.3;
  for (let i = 0; i < LEAFN; i++) { const l = LEAVES3[i];
    if (i >= nL) { dummy.position.set(0, -999, 0); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix); continue; }
    if (l.y < hAt(A, l.x, l.z) - 1 || Math.abs(l.x - S.camX) > hw + 60) { l.x = S.camX + (Math.random() * 2 - 1) * hw; l.z = S.camY + camOff.zt * .7 + Math.random() * (camOff.zb - camOff.zt * .7); l.y = l.y < -500 ? Math.random() * 140 : 120 + Math.random() * 40; l.vx = -6 + Math.random() * 4; l.vy = -(9 + Math.random() * 9); }
    l.y += l.vy * dt; l.x += (l.vx + Math.sin(t * 1.3 + l.ph) * 9) * dt; l.rx += dt * l.sp * 2.2; l.ry += dt * l.sp * 1.6; l.rz += dt * l.sp;
    dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(-PITCH, 0, l.rz); dummy.scale.set(Math.cos(l.ry) || .1, 1, 1); dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix); }
  dummy.scale.set(1, 1, 1);
  leafMesh.instanceMatrix.needsUpdate = true;
  for (const w of W.water) w.uniforms.uT.value = t;
  for (const m of W.mist) m.t.offset.x = (t * m.sp) % 1;
  if (Math.abs(S.dk - litK) > .015) applyLight(A);
  if (W.lights.length > PL.length - 2 && t - (W.lt || 0) > .3) assignLights();
}
// Hearthvale per-frame effects: smoke, embers, fountain spray, critters, gate, bell, lanterns, fireworks, glowing windows
const fwV = new THREE.Vector3();
function townFx(A, W, t, dt, lowFx) {
  const dk = S.dk, night = clamp(dk - 1, 0, 1), F = S.flags;
  const winK = smooth((dk - .3) / .8) * 1.15, lampK = .55 + .6 * Math.min(1, dk);
  for (const e of EMIS) e.m.emissiveIntensity = e.k === 'win' ? winK : e.k === 'fire' ? .95 + .2 * Math.sin(t * 9 + e.m.id) * Math.sin(t * 3.1) : lampK;
  smN = 0; const sc = hx(mix('#e8dcd2', '#6a6488', night));
  for (const c of W.smoke) for (let k = 0; k < (c.big ? 10 : 7); k++) { const u = (t * .12 * (c.sp || 1) + k / (c.big ? 10 : 7) + c.ph) % 1;
    smAdd(c.x + Math.sin(u * 5 + c.ph * 9) * 3 + u * 22, c.y + u * (c.big ? 70 : 48), c.z - u * 8, sc, Math.sin(u * Math.PI) * (c.big ? .5 : .38) * (1 - u * .3), (c.big ? 6 : 4) + u * (c.big ? 14 : 9)); }
  smGeo.attributes.position.needsUpdate = smGeo.attributes.aCol.needsUpdate = smGeo.attributes.aSize.needsUpdate = true; smGeo.setDrawRange(0, smN);
  for (const e of W.embers) { const n = e.forge ? (F.forgeHot ? 16 : 3 + (S.heat || 0) * 3) : e.n; for (let k = 0; k < n; k++) { const ph = k * 2.39, u = (t * (.35 + (k % 3) * .1) + k / n) % 1;
    fxAdd(e.x + Math.sin(ph * 3 + t * 2) * 10 * u + Math.sin(ph) * 8, e.y + u * (e.forge ? 70 : 34), e.z + 2, u < .4 ? '#ffd070' : '#ff7a2a', (1 - u) * .9, 1.3); } }
  if (W.fount) { const Fn = W.fount; for (let k = 0; k < (lowFx ? 12 : 24); k++) { const u = (t * .8 + k / 24) % 1, a = k * 2.39, rr = 2 + u * 9;
    fxAdd(Fn.x + Math.cos(a) * rr, 34 + u * 7 - u * u * 26, Fn.y + Math.sin(a) * rr * .8, '#d8f0ff', .5 * (1 - u * .5), 1.2); } }
  for (const c of W.crit) { const fr = c.fr;
    if (c.k === 'hen') { const d = Math.hypot(S.px - c.x, S.py - c.y);
      if (d < 26 && S.moving) { c.tx = c.x + (c.x - S.px) / (d || 1) * 40; c.ty = c.y + (c.y - S.py) / (d || 1) * 30; c.wait = 0; c.fast = 1; }
      else if (c.wait > 0) c.wait -= dt; else if (Math.hypot(c.tx - c.x, c.ty - c.y) < 2) { c.tx = c.hx + (Math.random() - .5) * 80; c.ty = c.hy + (Math.random() - .5) * 50; c.wait = 1 + Math.random() * 3; c.fast = 0; }
      c.tx = clamp(c.tx, 14, A.w - 14); c.ty = clamp(c.ty, GT + 22, A.h - 12);
      const dx = c.tx - c.x, dy = c.ty - c.y, L = Math.hypot(dx, dy), sp = (c.fast ? 70 : 20) * dt; c.mv = L > 1.5 && c.wait <= 0;
      if (c.mv) { c.x += dx / L * Math.min(sp, L); c.y += dy / L * Math.min(sp, L); if (Math.abs(dx) > .5) c.flip = dx > 0 ? 1 : -1; }
      setFrame(c.m, fr[(c.mv ? Math.floor(t * 8) % 2 : Math.sin(t * 2 + c.ph) > .6 ? 1 : 0) * 2]);
    } else setFrame(c.m, fr[(Math.floor(t * .8 + c.ph) % 2) * 2 + 1]);
    const y = hAt(A, c.x, c.y); c.m.position.set(c.x, y - .3, c.y); c.m.scale.x = c.flip; c.b.position.set(c.x, y + .2, c.y + 1); }
  if (W.portcullis) { const k = F.gateOpen ? ease(clamp(S.gateT / 2.4, 0, 1)) : 0; W.portcullis.position.y = W.portcullis.geometry.parameters.height / 2 + k * 42; }
  if (W.bell) W.bell.rotation.z = Math.sin(t * 7) * .45 * Math.min(1, S.bellT);
  for (const b of W.banners) b.rotation.z = Math.sin(t * 1.3 + b.position.x) * .03;
  if (W.lanterns) W.lanterns.visible = !!F.fest;
  if (F.fest && A.id === 'market') {   // fireworks, placed so they burst inside the current view over the back rooftops
    const gap = lowFx ? 1.6 : 1.0;
    if (!S.fw.length || S.fw[S.fw.length - 1].t > gap) {
      const x = S.camX + (Math.random() * 2 - 1) * camOff.hw * .7, z = GT + 14 + Math.random() * 30, ny = .38 + Math.random() * .4;
      let lo = 20, hi = 400; for (let k = 0; k < 14; k++) { const h = (lo + hi) / 2; fwV.set(x, h, z).project(cam); if (fwV.y < ny) lo = h; else hi = h; }
      S.fw.push({ x, z, h: lo, t: 0, c: ['#ff7a5a', '#ffd04a', '#7ad0ff', '#c88aff', '#8aff9a'][(Math.random() * 5) | 0] });
    }
    const nP = lowFx ? 14 : 30, sz = lowFx ? 8 : 6.5;
    for (const f of S.fw) { f.t += dt; if (f.t < .7) fxAdd(f.x, f.h * (.3 + .7 * f.t / .7), f.z, '#ffe0a0', 1, 5); else { const u = (f.t - .7) / 1.6, rr = 10 + Math.sqrt(u) * 52; fxAdd(f.x, f.h, f.z, f.c, .45 * Math.max(0, 1 - u * 1.6), 60); for (let k = 0; k < nP; k++) { const a = k / nP * TAU; fxAdd(f.x + Math.cos(a) * rr, f.h + Math.sin(a) * rr * .8 - u * u * 28, f.z, f.c, Math.max(0, 1 - u) * .95, sz); } } }
    S.fw = S.fw.filter(f => f.t < 2.4);
  }
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
    comp.uniforms.tB.value = tier === 2 ? rtB[3].texture : rtB[0].texture; comp.uniforms.uBloom.value = tier === 2 ? .6 : .5;
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
function questLines() {
  const F = S.flags, L = [];
  L.push([F.done, F.done ? 'Harvest Supper ready' : 'Acorns for Bramble ' + S.acorns + '/12']);
  if (F.metBramble || F.invite) L.push([F.gateOpen, F.gateOpen ? 'Hearthvale gate open' : 'Show Bramble\'s invite to Corvin']);
  if (F.metClover) L.push([F.pie, F.pie ? 'Harvest Pie baked' : 'Pie: honey' + (F.honey ? ' ok' : '') + ', tin' + (F.tin ? ' ok' : '') + ', apples ' + Math.min(3, S.apples) + '/3']);
  if (festReady() || F.fest) L.push([F.fest, 'Ring the chapel bell']);
  if (F.fest) L.push([F.ended, 'Enjoy the Harvest Festival']);
  if (F.metRusset) L.push([F.ribbon, 'Russet\'s coins ' + S.coins + '/8']);
  return L;
}
function drawQuests() {
  const L = questLines(), w = Math.min(176, VW - 16), h = 16 + L.length * 12, a = ease(S.qa), x = Math.round(VW - 6 - w * a + (1 - a) * 8), y = 28;
  ctx.globalAlpha = a; pbox(x, y, w, h, '#f6e6c2'); txt('Quests', x + 7, y + 7.5, 8, '#b8482a', 'left', null, true);
  L.forEach(([ok, t], i) => { const yy = y + 18 + i * 12; fr(x + 7, yy - 4, 7, 7, ok ? '#7aa04a' : '#fff4dc'); fr(x + 7, yy - 4, 7, 1, INK); fr(x + 7, yy + 2, 7, 1, INK); fr(x + 7, yy - 4, 1, 7, INK); fr(x + 13, yy - 4, 1, 7, INK);
    if (ok) { fr(x + 9, yy, 1, 1, CREAM); fr(x + 10, yy + 1, 1, 1, CREAM); fr(x + 11, yy - 1, 1, 1, CREAM); fr(x + 12, yy - 2, 1, 1, CREAM); }
    txt(t, x + 18, yy, 7.5, ok ? '#8a7a64' : '#3a2418', 'left', null, false, w - 24); });
  ctx.globalAlpha = 1;
}
function drawHud() {
  const y = 5, t1 = S.acorns + '/' + ACORNS, w1 = 24 + tw(t1, 10, true);
  pbox(5, y, w1, 18); icon(ACORN, 9, y + 2 - S.hud * 2, 1);
  txt(t1, 23, y + 9.5, 10, '#6a3a1e', 'left', 'rgba(255,255,255,.5)', true);
  let xx = 10 + w1;
  if (S.leaves > 0) { const t2 = S.leaves + '/' + LEAVES, w2 = 26 + tw(t2, 10, true); pbox(xx, y, w2, 18); icon(GLEAF, xx + 3, y + 2, 1); txt(t2, xx + 19, y + 9.5, 10, '#8a6410', 'left', 'rgba(255,255,255,.5)', true); xx += w2 + 5; }
  if (S.coins > 0 || S.flags.metRusset) { const t3 = S.coins + '/' + COINS, w3 = 24 + tw(t3, 10, true); pbox(xx, y, w3, 18); icon(COIN, xx + 4, y + 9 - COIN.height / 2, 1); txt(t3, xx + 18, y + 9.5, 10, '#8a5a10', 'left', 'rgba(255,255,255,.5)', true); }
  if (S.mode === 'play' && S.qa > .01) drawQuests();
  if (S.mode === 'play' && S.area === 'forge' && !S.flags.forgeHot && S.heat > 0) {   // bellows heat meter
    const [hx_, hy_] = toScreen(156, 44, 94), X = Math.round(hx_) - 18, Y = Math.round(hy_);
    pbox(X, Y, 36, 9, '#3a2a2a', INK, '#5a4a4a', '#24161c'); for (let i = 0; i < 4; i++) fr(X + 3 + i * 8, Y + 3, 6, 3, i < Math.ceil(S.heat) ? ['#ffd04a', '#ffa83a', '#ff7a2a', '#ff4a2a'][i] : '#5a4040');
  }
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
  const n = o.nid && NPCS[o.nid], top = n && n.top ? n.top : o.oid && OBJS[o.oid].top ? OBJS[o.oid].top : n ? (n.kind === 'owl' ? 52 : n.kind === 'frog' ? 20 : n.kind === 'snail' ? 28 : 30) : o.oid === 'bouncy' ? 50 : o.oid === 'door' ? 62 : 46;
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
  const fest = S.endKind === 'festival', w = Math.min(VW - 20, 262), h = fest ? 150 : 134, x = Math.round((VW - w) / 2), y = Math.round((VH - h) / 2 - 8);
  ctx.fillStyle = 'rgba(30,14,30,.4)'; ctx.fillRect(0, 0, CW, CH);
  pbox(x, y, w, h);
  if (!fest) {
    txt('Harvest Supper!', VW / 2, y + 20, 17, '#b8482a', 'center', 'rgba(60,20,10,.35)', true);
    txt('All 12 acorns found in ' + mmss(S.playT || 0), VW / 2, y + 46, 9.5, '#3a2418', 'center', null);
    txt('Chapter 1 of 2 complete', VW / 2, y + 62, 9.5, '#3a2418', 'center', null);
    txt(S.flags.pie ? 'The pie is baked too! Ring the chapel bell in Hearthvale.' : 'Next: Hearthvale needs its Harvest Pie. The town is south of the clearing.', VW / 2, y + 80, 7.5, '#6a4a34', 'center', null, false, w - 14);
  } else {
    txt('Harvest Festival!', VW / 2, y + 20, 17, '#b8482a', 'center', 'rgba(60,20,10,.35)', true);
    txt('Thimblewood and Hearthvale, together again', VW / 2, y + 40, 8, '#6a4a34', 'center', null, false, w - 14);
    txt('Finished in ' + mmss(S.finishT || 0), VW / 2, y + 58, 9.5, '#3a2418', 'center', null);
    txt('Golden leaves: ' + S.leaves + ' / ' + LEAVES + (S.leaves === LEAVES ? '  - all found!' : ''), VW / 2, y + 73, 9.5, '#3a2418', 'center', null);
    txt('Russet\'s coins: ' + S.coins + ' / ' + COINS + (S.flags.ribbon ? '  - ribbon earned!' : ''), VW / 2, y + 88, 9.5, '#3a2418', 'center', null);
  }
  const iy = y + (fest ? 104 : 92);
  for (let i = 0; i < 5; i++) icon(fest && i % 2 ? APPLE : ACORN, VW / 2 - 34 + i * 14, iy + (Math.sin(S.t * 5 + i) > 0 ? -2 : 0), 1, Math.cos(S.t * 2 + i) < 0 ? -1 : 1);
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
const stageEl = document.getElementById('stage');
// true while the shared handheld shell is mounted and showing (its own buttons replace the touch UI)
const inShell = () => { const H = window.Handheld && window.Handheld.current; return !!(H && H.visible); };
function resize() {
  ROOT.classList.toggle('tw-shell', inShell());
  // size from our own box: the whole window, or the handheld shell's screen
  const box = (stageEl || cv).getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width) || window.innerWidth), h = Math.max(1, Math.round(box.height) || window.innerHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CW = cv.width = Math.round(w * DPR); CH = cv.height = Math.round(h * DPR);
  SC = Math.min(CW, CH) / (SHOT ? 212 : CH > CW * 1.3 ? VIEWMIN_PORTRAIT : VIEWMIN);
  if (Math.max(CW, CH) / SC > 640) SC = Math.max(CW, CH) / 640;
  VW = CW / SC; VH = CH / SC;
  const base = SHOT ? 315 : inShell() ? 210 : h > w * 1.3 ? 300 : 380;   // the small shell screen gets chunkier pixels
  PS = Math.max(1, Math.min(w, h) / base) * psBoost;
  IW = Math.max(120, Math.round(w / PS)); IH = Math.max(90, Math.round(h / PS));
  if (!R) return;
  R.setSize(IW, IH, false); sizeTargets(); setupCamera();
  camSnap = true; if (S.A) easeCam(0);
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
  state: () => ({ mode: S.mode, t: Math.round(S.t * 1000) / 1000, area: S.area, x: Math.round(S.px), y: Math.round(S.py), acorns: S.acorns, leaves: S.leaves, coins: S.coins, apples: S.apples, endKind: S.mode === 'end' ? S.endKind : null, dk: Math.round(S.dk * 100) / 100, quests: questLines().map(([ok, t]) => (ok ? '[x] ' : '[ ] ') + t),
    town: (F => ({ invite: !!F.invite, gateOpen: !!F.gateOpen, glowcap: !!F.glowcap, honey: !!F.honey, tin: !!F.tin, forgeHot: !!F.forgeHot, pie: !!F.pie, supper: !!F.done, festival: !!F.fest, ended: !!F.ended, ribbon: !!F.ribbon }))(S.flags), dialog: S.dlg ? S.dlg.name : null, trans: !!S.trans, tier: Q.tier, internal: IW + 'x' + IH, fps: Math.round(fpsNow * 10) / 10, webgl: R ? (R.capabilities.isWebGL2 ? 2 : 1) : 0 }),
  setQuality: q => { Q.forced = Q.tier = q; applyTier(); },
};
if (QS.has('debug')) window.Thimblewood._debug = { S, AREAS, NPCS, OBJS, canStand, clampBounds, GT, PR, scene, cam, hero, W3, R, fakeHedge, Q,
  goto: (id, x, y) => { enterArea(id, x, y); if (S.mode === 'title') start(); },
  talk: nid => talkTo(nid), use: oid => OBJS[oid].use(),
  collect: id => { for (const k in AREAS) { const it = AREAS[k].items.find(i => i.id === id); if (it) { collect(it); return true; } } return false; },
  skip: () => { for (let k = 0; k < 40 && S.dlg; k++) { const d = S.dlg; S.dlg = null; if (d.onEnd) d.onEnd(); } if (S.mode === 'end') S.mode = 'play'; },
  give: (k, v) => { if (k === 'acorns') S.acorns = v; else if (k === 'coins') S.coins = v; else if (k === 'apples') S.apples = v; else S.flags[k] = v; } };
boot();
