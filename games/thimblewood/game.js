/* THIMBLEWOOD: a little paper forest to explore.
 *
 * Everything is drawn procedurally on a canvas as paper cut-outs: a coloured
 * face, a white cut margin, a thin ink line, and a thick darker cardboard side
 * (the "extrusion") that makes every character and prop look chunky. Sprites
 * are painted once per screen scale and cached, so a frame is mostly drawImage.
 *
 * World units: the shorter screen side always shows about VIEWMIN units.
 * Each area is a diorama board (w x h units); y < GT is back scenery (layered
 * parallax paper trees), the board's cardboard front edge shows below y = h.
 *
 * Controls: arrows/WASD walk; Space/Enter/Z/E talk, read, advance; X/Escape
 * closes; M mutes. Touch: drag on the left side (stick), tap A or the right side.
 * Only original art. No third-party assets.
 */
'use strict';
(() => {
const QS = new URLSearchParams(location.search);
const SHOT = QS.has('shot');            // card-image capture: staged scene, no UI
const ROOT = document.documentElement;
if (QS.has('notouch') || SHOT) ROOT.classList.add('no-touch-ui');

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const mmss = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hexRgb(h) { h = h.replace('#', ''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(h, k) { const c = hexRgb(h).map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)); return 'rgb(' + c.join(',') + ')'; }
const FONT = '"Arial Rounded MT Bold","Varela Round","Nunito","Trebuchet MS",system-ui,sans-serif';
const INK = '#3a2a22', CREAM = '#fff8ec', CARD = '#f6ecd6';

// ---------------------------------------------------------------- canvas & scale
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const VIEWMIN = 236, VIEWMIN_PORTRAIT = 200;
let DPR = 1, CW = 1, CH = 1, SC = 1, VW = 1, VH = 1;
const SPR = new Map();
let vignette = null;

function resize() {
  DPR = Math.min(2.25, window.devicePixelRatio || 1);
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  CW = cv.width = Math.round(w * DPR); CH = cv.height = Math.round(h * DPR);
  SC = Math.min(CW, CH) / (SHOT ? 212 : CH > CW * 1.3 ? VIEWMIN_PORTRAIT : VIEWMIN);
  if (Math.max(CW, CH) / SC > 640) SC = Math.max(CW, CH) / 640;
  VW = CW / SC; VH = CH / SC;
  SPR.clear(); groundFor = null;
  vignette = document.createElement('canvas'); vignette.width = CW; vignette.height = CH;
  const g = vignette.getContext('2d');
  const rg = g.createRadialGradient(CW / 2, CH * .45, Math.min(CW, CH) * .35, CW / 2, CH * .5, Math.hypot(CW, CH) * .62);
  rg.addColorStop(0, 'rgba(40,24,10,0)'); rg.addColorStop(1, 'rgba(40,24,10,.34)');
  g.fillStyle = rg; g.fillRect(0, 0, CW, CH);
}

// ---------------------------------------------------------------- paper texture
const TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = rng(7);
  const id = g.createImageData(128, 128);
  for (let i = 0; i < id.data.length; i += 4) { const v = r(); const n = v > .5 ? 255 : 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = Math.abs(v - .5) * 46; }
  g.putImageData(id, 0, 0);
  g.lineWidth = .7;
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = r() < .5 ? 'rgba(255,255,255,.22)' : 'rgba(60,40,20,.10)';
    const x = r() * 128, y = r() * 128, a = r() * TAU, l = 5 + r() * 12;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * l / 2, y + Math.sin(a + .6) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
})();
function texFill(g) {
  const p = g.createPattern(TEX, 'repeat');
  if (p && p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(1.4 / SC));
  return p;
}

// ---------------------------------------------------------------- shapes (Path2D)
const P = () => new Path2D();
function circ(x, y, r) { const p = P(); p.arc(x, y, r, 0, TAU); return p; }
function ell(x, y, rx, ry, rot) { const p = P(); p.ellipse(x, y, rx, ry, rot || 0, 0, TAU); return p; }
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); const p = P();
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p;
}
function poly(pts, close = true) { const p = P(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (close) p.closePath(); return p; }
// bumpy "cloud" outline: canopies, bushes, rocks
function cloud(x, y, rx, ry, n, seed, bulge = 1.2, j = .08) {
  const r = rng(seed), p = P(), ks = [];
  for (let i = 0; i < n; i++) ks.push(1 - j + r() * 2 * j);
  const pt = (a, k) => [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k];
  const s = pt(0, ks[0]); p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, k1 = ks[(i + 1) % n];
    const c = pt((a0 + a1) / 2, (ks[i] + k1) / 2 * bulge), e = pt(a1, k1);
    p.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  }
  p.closePath(); return p;
}
function leafP(x, y, len, w, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), T = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const p = P(), a = T(0, 0), b = T(len, 0), l = T(len * .5, -w), r = T(len * .5, w);
  p.moveTo(a[0], a[1]); p.quadraticCurveTo(l[0], l[1], b[0], b[1]); p.quadraticCurveTo(r[0], r[1], a[0], a[1]); p.closePath(); return p;
}

// ---------------------------------------------------------------- the paper look
// o: { c face colour, t thickness (units), m white cut margin, e side colour, mc margin colour, tex, hl }
function paper(g, p, o) {
  const c = o.c, t = o.t == null ? 3 : o.t, m = o.m == null ? 1.3 : o.m, e = o.e || shade(c, -.36), mc = o.mc || CREAM;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  // ink halo around the whole extruded silhouette
  g.strokeStyle = o.ink || 'rgba(50,34,24,.34)'; g.lineWidth = m * 2 + 1.1;
  for (let i = t; i >= 0; i -= .5) { g.save(); g.translate(0, i); g.stroke(p); g.restore(); }
  // cardboard side: darkest at the bottom
  for (let i = t; i > 0; i -= .5) {
    g.save(); g.translate(0, i); g.fillStyle = g.strokeStyle = i > t - .6 ? shade(c, -.55) : e;
    if (m > 0) { g.lineWidth = m * 2; g.stroke(p); } g.fill(p); g.restore();
  }
  // face
  if (m > 0) { g.strokeStyle = mc; g.lineWidth = m * 2; g.stroke(p); }
  g.fillStyle = c; g.fill(p);
  if (o.tex !== false || o.hl) {
    g.save(); g.clip(p);
    if (o.hl) { // soft light from the top-left
      const [x0, y0, x1, y1] = o.hl, lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, 'rgba(255,255,240,.30)'); lg.addColorStop(.55, 'rgba(255,255,240,0)'); lg.addColorStop(1, 'rgba(40,20,0,.14)');
      g.fillStyle = lg; g.fillRect(-400, -400, 800, 800);
    }
    if (o.tex !== false) { g.globalAlpha = .55; g.fillStyle = texFill(g); g.fillRect(-400, -400, 800, 800); }
    g.restore();
  }
  g.restore();
}
// thin printed / glued-on detail (eyes, spots): a hairline shadow under it
function decal(g, p, c, dy = .6, a = .22) {
  g.save(); g.translate(0, dy); g.fillStyle = 'rgba(40,25,15,' + a + ')'; g.fill(p); g.restore();
  g.fillStyle = c; g.fill(p);
}
function line(g, pts, c, w) { g.save(); g.strokeStyle = c; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.stroke(poly(pts, false)); g.restore(); }

// sprite cache: painted at the current scale, anchored at (ax, ay) = the spot on the ground
function sprite(key, w, h, ax, ay, draw) {
  let s = SPR.get(key); if (s) return s;
  const pad = 4, c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((w + pad * 2) * SC)); c.height = Math.max(1, Math.ceil((h + pad * 2) * SC));
  const g = c.getContext('2d'); g.scale(SC, SC); g.translate(ax + pad, ay + pad); draw(g);
  s = { c, w: w + pad * 2, h: h + pad * 2, ax: ax + pad, ay: ay + pad }; SPR.set(key, s); return s;
}
function blit(g, s, x, y, sx = 1, sy = 1, rot = 0, a = 1) {
  if (a !== 1) { g.save(); g.globalAlpha *= a; }
  if (rot || sx !== 1 || sy !== 1) { g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(sx, sy); g.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); g.restore(); }
  else g.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  if (a !== 1) g.restore();
}
const GLOW = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.25, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return c; })();
const tinted = {};
function glowOf(col) { if (tinted[col]) return tinted[col]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.drawImage(GLOW, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 64, 64); return (tinted[col] = c); }
const SHADOW = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
  g.scale(1, .5); const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(45,30,15,.42)'); rg.addColorStop(.6, 'rgba(45,30,15,.22)'); rg.addColorStop(1, 'rgba(45,30,15,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return c; })();
function shadow(g, x, y, rx, ry, a = 1) { if (a !== 1) { g.save(); g.globalAlpha *= a; } g.drawImage(SHADOW, x - rx, y - ry, rx * 2, ry * 2); if (a !== 1) g.restore(); }

// ---------------------------------------------------------------- palettes
const TREE = {
  green: ['#3c7d4c', '#4f9a55', '#74ba5e'], autumn: ['#b4472b', '#d96a32', '#f0a03e'],
  gold: ['#a5772a', '#cf9d34', '#efc95c'], plum: ['#58487a', '#7461a0', '#9c88c6'], teal: ['#2f6e6a', '#3f8c80', '#64ad93'],
};
const AP = {
  meadow: { sky: ['#fde8be', '#d3e8c6'], sun: [.72, 'rgba(255,236,180,.85)'], layers: ['#b9d6b0', '#90bd8f', '#6ba374'], ground: '#87bf62', ground2: '#a3d06f', path: '#e6c891', trees: ['green', 'autumn', 'gold', 'green'], branch: 'autumn', motes: 'rgba(255,250,215,.9)', rays: .09 },
  river: { sky: ['#e8f3dc', '#bfe0d4'], sun: [.25, 'rgba(255,245,205,.75)'], layers: ['#acd0c3', '#82b6a3', '#5f9a82'], ground: '#7ab766', ground2: '#97cb78', path: '#ddc28f', trees: ['green', 'teal', 'autumn'], branch: 'green', motes: 'rgba(230,255,240,.9)', rays: .07 },
  grove: { sky: ['#eedcf0', '#b4a5d6'], sun: [.5, 'rgba(255,220,250,.55)'], layers: ['#ab9ecb', '#8577ad', '#625a8f'], ground: '#5e9871', ground2: '#78ae81', path: '#cdb38a', trees: ['plum', 'teal', 'plum', 'green'], branch: 'plum', motes: 'rgba(190,255,230,.95)', rays: .05, tint: 'rgba(70,40,130,.10)', fireflies: 22 },
  hollow: { sky: ['#fcdcab', '#eab98b'], sun: [.3, 'rgba(255,215,150,.8)'], layers: ['#dab48b', '#b98d68', '#91684c'], ground: '#90ad58', ground2: '#abc16a', path: '#dfc08a', trees: ['autumn', 'gold', 'autumn', 'green'], branch: 'gold', motes: 'rgba(255,225,160,.95)', rays: .08, tint: 'rgba(255,140,40,.06)', fireflies: 10 },
  glade: { sky: ['#fff4d2', '#d9f0cf'], sun: [.55, 'rgba(255,248,210,.95)'], layers: ['#c9e4bf', '#a1d1a1', '#7cb985'], ground: '#8dcb6c', ground2: '#aadc80', path: '#e9d3a0', trees: ['green', 'gold', 'teal'], branch: 'green', motes: 'rgba(255,255,220,.95)', rays: .13, fireflies: 16 },
};

// ---------------------------------------------------------------- characters (all original)
const HERO_S = .8; // the hero is painted at 0.8 so the chunky proportions read at phone size
function paintHero(g, back) {
  g.scale(HERO_S, HERO_S);
  const T = 4.6;
  // satchel strap + satchel (behind body when seen from the front)
  if (!back) paper(g, rr(-15, -17, 9, 10, 3), { c: '#c98f4e', t: 2.4, m: 1 });
  // chunky tunic body
  paper(g, rr(-12, -26, 24, 24, 11), { c: '#2fa39a', t: T, hl: [-12, -26, 12, -2] });
  decal(g, rr(-12, -9, 24, 3, 1.5), '#24857e', .4, .12);
  // scarf
  paper(g, ell(0, -25, 11.5, 4.4), { c: '#e8523f', t: 2.4, m: 1.1 });
  paper(g, rr(back ? 3 : -10, -25, 5, 11, 2.4), { c: '#e8523f', t: 2.2, m: 1 });
  if (back) paper(g, rr(-15, -19, 9, 10, 3), { c: '#c98f4e', t: 2.4, m: 1 });
  // head
  paper(g, circ(0, -38, 12.5), { c: '#ffdcb8', t: T, hl: [-12, -50, 10, -26] });
  if (!back) {
    decal(g, ell(3.4, -38, 1.6, 2.4), INK); decal(g, ell(9.2, -38, 1.5, 2.3), INK);
    g.fillStyle = '#fff'; g.fill(circ(3.9, -39, .55)); g.fill(circ(9.6, -39, .5));
    g.globalAlpha = .55; decal(g, circ(1.2, -33.6, 2.2), '#ff8f7c', 0); decal(g, circ(10.6, -33.8, 1.8), '#ff8f7c', 0); g.globalAlpha = 1;
    g.save(); g.strokeStyle = INK; g.lineWidth = .8; g.lineCap = 'round'; g.beginPath(); g.arc(6.6, -34.5, 1.6, .3, Math.PI - .3); g.stroke(); g.restore();
  } else {
    decal(g, ell(0, -41, 10, 7), '#f3c9a0', 0, 0);
  }
  // leaf cap
  const cap = P(); cap.moveTo(-13.5, -41); cap.quadraticCurveTo(-10, -57, 6, -54); cap.quadraticCurveTo(16, -51, 14, -41); cap.quadraticCurveTo(0, -46.5, -13.5, -41); cap.closePath();
  paper(g, cap, { c: '#7cc24f', t: 2.8, m: 1.1, hl: [-12, -56, 10, -40] });
  line(g, [[-10, -44], [-2, -48], [11, -47]], 'rgba(40,90,30,.5)', .8);
  line(g, [[1, -54], [3, -59], [7, -60]], '#6b4a2b', 1.6);
}
function paintHedgehog(g) {
  g.scale(.92, .92);
  const back = [], n = 15;
  for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * (Math.PI * 1.08), k = i % 2 ? 1 : 1.32; back.push([-3 + Math.cos(a) * 15 * k, -12 + Math.sin(a) * 12 * k]); }
  back.push([10, -4], [8, 0], [-14, 0]);
  paper(g, poly(back), { c: '#7a5236', t: 4.2, hl: [-18, -28, 10, 0] });
  paper(g, leafP(-9, -24, 10, 3.6, -.5), { c: '#e0722e', t: 1.4, m: .8 });
  paper(g, ell(8, -11, 9.5, 8.5), { c: '#f3d9b1', t: 3.4 });
  paper(g, circ(3, -20, 3.2), { c: '#e5b98a', t: 1.6, m: .8 });
  decal(g, circ(17.4, -12.5, 2.3), INK); decal(g, ell(10, -14, 1.4, 2.1), INK);
  g.fillStyle = '#fff'; g.fill(circ(10.4, -14.8, .5));
  g.globalAlpha = .5; decal(g, circ(11.5, -9.5, 1.8), '#ff8f7c', 0); g.globalAlpha = 1;
  // little green apron bow
  paper(g, rr(1, -7, 13, 6, 2.5), { c: '#5aa35a', t: 1.6, m: .8 });
  paper(g, ell(-10, -1, 4, 2.2), { c: '#4a3122', t: 1.4, m: .7 }); paper(g, ell(6, -1, 4, 2.2), { c: '#4a3122', t: 1.4, m: .7 });
}
function paintFrog(g) {
  paper(g, ell(0, -9, 12, 9.5), { c: '#5fb54a', t: 3.6, hl: [-12, -18, 10, 0] });
  paper(g, ell(1, -6, 7, 5.5), { c: '#d9efa0', t: 1.4, m: .7 });
  paper(g, circ(-5.5, -18, 4.8), { c: '#5fb54a', t: 3 }); paper(g, circ(5.5, -18, 4.8), { c: '#5fb54a', t: 3 });
  decal(g, circ(-5.5, -18.6, 3.2), '#fffdf2', .3); decal(g, circ(5.5, -18.6, 3.2), '#fffdf2', .3);
  decal(g, circ(-4.8, -18.4, 1.7), INK, 0); decal(g, circ(6.2, -18.4, 1.7), INK, 0);
  g.save(); g.strokeStyle = '#2d6b25'; g.lineWidth = .9; g.lineCap = 'round'; g.beginPath(); g.arc(0, -12, 4.6, .35, Math.PI - .35); g.stroke(); g.restore();
  g.globalAlpha = .55; decal(g, circ(-8, -11, 1.8), '#ff8f7c', 0); decal(g, circ(8, -11, 1.8), '#ff8f7c', 0); g.globalAlpha = 1;
}
function paintSnail(g) {
  paper(g, rr(-15, -8, 32, 8, 4), { c: '#cfc5b6', t: 3 });
  line(g, [[12, -6], [13, -16]], '#a99f90', 1.3); line(g, [[15, -6], [18, -15]], '#a99f90', 1.3);
  paper(g, circ(13, -17, 2), { c: '#cfc5b6', t: 1, m: .7 }); paper(g, circ(18.4, -16, 2), { c: '#cfc5b6', t: 1, m: .7 });
  decal(g, circ(13.4, -17, .9), INK, 0); decal(g, circ(18.8, -16, .9), INK, 0);
  paper(g, circ(-2, -15, 11), { c: '#e58fae', t: 4.2, hl: [-13, -26, 9, -4] });
  const sp = P(); for (let a = 0; a < 13; a += .2) { const r = 9.5 - a * .7; const x = -2 + Math.cos(a) * r, y = -15 + Math.sin(a) * r; a ? sp.lineTo(x, y) : sp.moveTo(x, y); }
  g.save(); g.strokeStyle = '#b5587c'; g.lineWidth = 1.3; g.lineCap = 'round'; g.stroke(sp); g.restore();
  g.globalAlpha = .5; decal(g, circ(14, -3, 1.4), '#ff8f7c', 0); g.globalAlpha = 1;
}
function paintOwl(g) {
  paper(g, poly([[-9, -26], [-11, -34], [-4, -28]]), { c: '#7a604c', t: 2, m: .9 });
  paper(g, poly([[9, -26], [11, -34], [4, -28]]), { c: '#7a604c', t: 2, m: .9 });
  paper(g, ell(0, -15, 12, 15), { c: '#8b6f5a', t: 4.4, hl: [-12, -30, 10, 0] });
  paper(g, ell(-11, -13, 4, 9, .2), { c: '#6f5645', t: 2, m: .8 }); paper(g, ell(11, -13, 4, 9, -.2), { c: '#6f5645', t: 2, m: .8 });
  paper(g, ell(0, -10, 7.5, 9), { c: '#eadbc0', t: 1.4, m: .7 });
  for (let i = 0; i < 3; i++) line(g, [[-3 + i * 3 - 1.2, -11 + (i % 2) * 4], [-3 + i * 3, -10 + (i % 2) * 4], [-3 + i * 3 + 1.2, -11 + (i % 2) * 4]], '#b39b7c', .7);
  paper(g, circ(-4.6, -22, 5.6), { c: '#f2e6d0', t: 1.4, m: .6 }); paper(g, circ(4.6, -22, 5.6), { c: '#f2e6d0', t: 1.4, m: .6 });
  decal(g, circ(-4.6, -22, 3.2), '#f6c444', 0); decal(g, circ(4.6, -22, 3.2), '#f6c444', 0);
  decal(g, circ(-4.3, -22, 1.6), INK, 0); decal(g, circ(4.3, -22, 1.6), INK, 0);
  g.save(); g.strokeStyle = '#3b2a20'; g.lineWidth = .8; g.stroke(circ(-4.6, -22, 4.2)); g.stroke(circ(4.6, -22, 4.2)); g.beginPath(); g.moveTo(-.6, -22.5); g.lineTo(.6, -22.5); g.stroke(); g.restore();
  paper(g, poly([[-1.6, -18.6], [1.6, -18.6], [0, -15.6]]), { c: '#e8a23b', t: 1, m: .5 });
  paper(g, ell(-4, 0, 3, 1.6), { c: '#e8a23b', t: 1, m: .6 }); paper(g, ell(4, 0, 3, 1.6), { c: '#e8a23b', t: 1, m: .6 });
}
const NPCPAINT = { hedgehog: [paintHedgehog, 44, 40, 22, 34], frog: [paintFrog, 32, 30, 16, 26], snail: [paintSnail, 40, 34, 18, 28], owl: [paintOwl, 34, 42, 17, 36] };
const npcSprite = kind => { const d = NPCPAINT[kind]; return sprite('npc|' + kind, d[1], d[2], d[3], d[4], d[0]); };
const heroSprite = back => sprite('hero|' + (back ? 'b' : 'f'), 40, 56, 20, 50, g => paintHero(g, back));

// ---------------------------------------------------------------- props
function paintTree(g, p) {
  const r = rng(p.seed), C = TREE[p.pal] || TREE.green;
  const tr = P(); tr.moveTo(-9, 0); tr.quadraticCurveTo(-4, -8, -5, -36); tr.lineTo(5, -36); tr.quadraticCurveTo(4, -8, 9, 0); tr.quadraticCurveTo(0, 2.5, -9, 0); tr.closePath();
  paper(g, tr, { c: '#8b5a3c', t: 4, hl: [-9, -30, 9, 0] });
  line(g, [[-2, -6], [-1.5, -18]], 'rgba(60,35,20,.4)', .9); line(g, [[2.5, -12], [2, -26]], 'rgba(60,35,20,.35)', .9);
  const cx = (r() - .5) * 6, sz = .9 + r() * .25;
  paper(g, cloud(cx, -60 * sz, 34 * sz, 27 * sz, 9, p.seed + 1, 1.18), { c: C[0], t: 5.2, hl: [-30, -90, 30, -30] });
  paper(g, cloud(cx - 7, -66 * sz, 25 * sz, 19 * sz, 8, p.seed + 2, 1.2), { c: C[1], t: 4, hl: [-30, -90, 20, -40] });
  paper(g, cloud(cx + 9, -54 * sz, 18 * sz, 13 * sz, 7, p.seed + 3, 1.22), { c: C[2], t: 3, hl: [-10, -70, 25, -40] });
  for (let i = 0; i < 5; i++) { const a = r() * TAU, d = r() * 20; decal(g, leafP(cx + Math.cos(a) * d * 1.3, -62 * sz + Math.sin(a) * d * .8, 5, 2, r() * TAU), shade(C[2], .25), .5, .15); }
}
function paintPine(g, p) {
  const C = ['#2c5e48', '#37745a', '#4b8e6c'];
  paper(g, rr(-4, -14, 8, 15, 2), { c: '#7d5136', t: 3 });
  for (let k = 0; k < 3; k++) {
    const y0 = -12 - k * 20, wv = 26 - k * 6, top = y0 - 30 + k * 2, pts = [[0, top]];
    const teeth = 4;
    for (let i = 0; i <= teeth; i++) { const u = i / teeth; pts.push([wv * u, top + (y0 - top) * u + (i % 2 ? -4 : 0)]); }
    for (let i = teeth; i >= 0; i--) { const u = i / teeth; pts.push([-wv * u, top + (y0 - top) * u + (i % 2 ? -4 : 0)]); }
    const pp = poly(pts.map((q, i) => i && i <= teeth + 1 ? q : q));
    paper(g, smoothPoly(pts), { c: C[k], t: 4 - k * .6, hl: [-20, top, 20, y0] });
  }
}
function smoothPoly(pts) { const p = P(), n = pts.length; const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const a = pts[i], m = mid(a, pts[(i + 1) % n]); p.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
  p.closePath(); return p; }
function paintBush(g, p) {
  const r = rng(p.seed), C = TREE[p.pal] || TREE.green;
  paper(g, cloud(0, -10, 17, 11.5, 8, p.seed, 1.25), { c: C[1], t: 4, hl: [-16, -22, 14, 0] });
  paper(g, cloud(-4, -13, 9, 6, 6, p.seed + 5, 1.25), { c: C[2], t: 2, m: 1 });
  if (p.berries !== false) for (let i = 0; i < 5; i++) decal(g, circ(-10 + r() * 20, -14 + r() * 9, 1.6), r() < .5 ? '#e0483a' : '#f2f0e6', .5);
}
function paintMush(g, p) {
  const s = p.s || 1, cap = p.cap || '#e2493b';
  g.scale(s, s);
  const st = P(); st.moveTo(-5.5, 0); st.quadraticCurveTo(-3.5, -7, -4.5, -15); st.lineTo(4.5, -15); st.quadraticCurveTo(3.5, -7, 5.5, 0); st.quadraticCurveTo(0, 1.8, -5.5, 0); st.closePath();
  paper(g, st, { c: '#f4e6cf', t: 2.6, hl: [-5, -15, 5, 0] });
  paper(g, ell(0, -15, 13, 3.4), { c: '#d4b48c', t: 1, m: .7 });
  const cp = P(); cp.moveTo(-16, -15); cp.bezierCurveTo(-16, -37, 16, -37, 16, -15); cp.quadraticCurveTo(0, -19, -16, -15); cp.closePath();
  paper(g, cp, { c: cap, t: 3.8, hl: [-16, -34, 14, -14] });
  const r = rng(p.seed || 3);
  const spots = [[-8, -24, 2.6], [1, -29, 3], [9, -22, 2.2], [-2, -20, 1.6], [12, -17.5, 1.4], [-12, -18, 1.5]];
  spots.forEach(q => decal(g, ell(q[0] + (r() - .5), q[1], q[2] * 1.1, q[2] * .85), p.spot || '#fff8ec', .4, .14));
}
function paintRock(g, p) {
  paper(g, cloud(0, -8, 15, 10, 7, p.seed, 1.12, .12), { c: p.c || '#a2a9a2', t: 5, hl: [-14, -18, 12, 0] });
  decal(g, cloud(-3, -15, 8, 3, 6, p.seed + 2, 1.3), '#7fae5e', .4, .15);
}
function paintStump(g) {
  paper(g, rr(-11, -14, 22, 15, 4), { c: '#8b5a3c', t: 3.6, hl: [-11, -14, 11, 1] });
  paper(g, ell(0, -14, 11, 4.4), { c: '#e0b07c', t: 1.4, m: .8 });
  g.save(); g.strokeStyle = 'rgba(140,90,50,.6)'; g.lineWidth = .6; g.stroke(ell(0, -14, 7, 2.8)); g.stroke(ell(0, -14, 3.4, 1.3)); g.restore();
}
function paintLog(g) {
  paper(g, rr(-27, -13, 52, 13, 6.5), { c: '#7b4f33', t: 4, hl: [-27, -13, 25, 0] });
  paper(g, ell(25, -6.5, 4.5, 6.8), { c: '#e0b07c', t: 1.2, m: .8 });
  g.save(); g.strokeStyle = 'rgba(140,90,50,.6)'; g.lineWidth = .5; g.stroke(ell(25, -6.5, 2.6, 4)); g.restore();
  decal(g, cloud(-12, -12, 9, 2.6, 6, 4, 1.3), '#7fae5e', .4, .12); decal(g, cloud(6, -12.5, 5, 2, 5, 9, 1.3), '#8fc068', .4, .12);
}
function paintFern(g, p) {
  const C = p.c || '#4f9a58', r = rng(p.seed);
  for (let i = 0; i < 7; i++) { const a = -Math.PI + .35 + i / 6 * (Math.PI - .7) + (r() - .5) * .2; paper(g, leafP(0, 0, 18 + r() * 6, 3.6, a), { c: i % 2 ? C : shade(C, .12), t: 1.4, m: .8 }); }
}
function paintFlowers(g, p) {
  const r = rng(p.seed), cols = ['#f6d14b', '#f28aa6', '#fff6e8', '#9fb8ff', '#ff9c57'];
  for (let i = 0; i < 4; i++) {
    const x = -8 + r() * 16, h = 6 + r() * 7, c = cols[(r() * cols.length) | 0];
    line(g, [[x * .3, 0], [x, -h]], '#4f8f45', 1);
    paper(g, leafP(x * .5, -h * .4, 4, 1.4, -Math.PI / 2 - .7), { c: '#6db35a', t: .8, m: .5 });
    const fl = P(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; fl.moveTo(x + Math.cos(a) * 2.2 + 1.5, -h + Math.sin(a) * 2.2); fl.arc(x + Math.cos(a) * 2.2, -h + Math.sin(a) * 2.2, 1.5, 0, TAU); }
    paper(g, fl, { c, t: 1, m: .6 }); decal(g, circ(x, -h, 1.1), '#e8a23b', .2);
  }
}
function paintReeds(g, p) {
  const r = rng(p.seed);
  for (let i = 0; i < 5; i++) { const x = -6 + i * 3 + r() * 2, h = 18 + r() * 12; paper(g, leafP(x, 2, h, 1.6, -Math.PI / 2 + (r() - .5) * .4), { c: i % 2 ? '#5e9c4c' : '#73b05a', t: 1, m: .6 }); }
  paper(g, rr(-2.6, -28, 4, 9, 2), { c: '#8a5a36', t: 1.2, m: .6 }); paper(g, rr(3, -24, 3.6, 8, 1.8), { c: '#8a5a36', t: 1.2, m: .6 });
}
function paintSign(g) {
  paper(g, rr(-2.5, -24, 5, 25, 1.5), { c: '#a2724a', t: 2.6 });
  paper(g, rr(-21, -36, 42, 16, 3), { c: '#d7a868', t: 3, hl: [-21, -36, 21, -20] });
  g.save(); g.fillStyle = '#5a3b22'; g.font = '800 7px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('\u2190  \u2191  \u2192', 0, -27.6); g.restore();
}
function paintLantern(g) {
  paper(g, rr(-1.5, -26, 3, 27, 1), { c: '#5b4434', t: 2 });
  paper(g, rr(-1.5, -27, 9, 2.4, 1), { c: '#5b4434', t: 1.2, m: .6 });
  paper(g, rr(2.5, -25, 7, 9, 2), { c: '#ffd36b', t: 2, m: .9 }); decal(g, rr(4.5, -23, 3, 5, 1.2), '#fff4c4', 0);
}
function paintBasket(g) {
  paper(g, P2(g => { g.moveTo(-10, -9); g.lineTo(10, -9); g.lineTo(8, 0); g.lineTo(-8, 0); g.closePath(); }), { c: '#c48a4c', t: 2.6 });
  for (let i = -6; i <= 6; i += 4) line(g, [[i, -8], [i * .8, -1]], 'rgba(110,70,30,.5)', .7);
  g.save(); g.strokeStyle = '#a06c38'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, -9, 9, 8, 0, Math.PI, TAU); g.stroke(); g.restore();
}
function P2(f) { const p = P(); f(p); return p; }
function paintStone(g, p) { paper(g, cloud(0, 0, 9, 5.4, 6, p.seed, 1.12, .1), { c: p.hidden ? '#8fb7c4' : '#b2b6ac', t: 3, m: 1, hl: [-9, -5, 9, 5] }); }
function paintLily(g, p) { const pp = P(); pp.moveTo(0, 0); pp.ellipse(0, 0, 11, 6, 0, .35, TAU - .1); pp.closePath(); paper(g, pp, { c: '#4f9a45', t: 1.6, m: .8 }); line(g, [[0, 0], [-8, -2]], 'rgba(40,90,30,.4)', .6); }
function paintPedestal(g) { paper(g, cloud(0, -6, 11, 7, 7, 21, 1.12, .1), { c: '#9aa79a', t: 5 }); decal(g, cloud(0, -11, 7, 2.5, 6, 3, 1.3), '#7fbf68', .3, .12); }
function paintBigTree(g) {
  // roots
  const roots = [[-70, 2, -40, -16], [-48, 6, -26, -20], [62, 3, 38, -18], [40, 7, 24, -20]];
  roots.forEach(q => paper(g, P2(p => { p.moveTo(q[0], q[1]); p.quadraticCurveTo(q[2], q[1] - 2, q[2] + (q[0] < 0 ? 18 : -18), q[3]); p.lineTo(q[2] + (q[0] < 0 ? 26 : -26), q[3] + 10); p.quadraticCurveTo((q[0] + q[2]) / 2, q[1] + 4, q[0], q[1]); p.closePath(); }), { c: '#7f5236', t: 4 }));
  const tr = P(); tr.moveTo(-56, 0); tr.quadraticCurveTo(-36, -14, -38, -70); tr.quadraticCurveTo(-40, -120, -30, -150); tr.lineTo(30, -150); tr.quadraticCurveTo(40, -118, 38, -70); tr.quadraticCurveTo(36, -14, 56, 0); tr.quadraticCurveTo(0, 8, -56, 0); tr.closePath();
  paper(g, tr, { c: '#8b5a3c', t: 6, hl: [-50, -150, 50, 0] });
  for (let i = 0; i < 9; i++) { const x = -28 + i * 7; line(g, [[x, -146], [x + (i % 2 ? 3 : -3), -100], [x, -50 + (i % 3) * 8]], 'rgba(70,40,22,.32)', 1.2); }
  // door hollow with a warm glow
  const door = P(); door.moveTo(-15, -1); door.lineTo(-15, -26); door.quadraticCurveTo(0, -48, 15, -26); door.lineTo(15, -1); door.closePath();
  g.save(); g.fillStyle = '#c99a62'; g.lineWidth = 4; g.strokeStyle = '#a7754a'; g.stroke(door); g.restore();
  decal(g, door, '#2e1b12', 0); g.save(); g.clip(door); const rg = g.createRadialGradient(0, -6, 2, 0, -12, 26); rg.addColorStop(0, 'rgba(255,190,90,.75)'); rg.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = rg; g.fillRect(-20, -50, 40, 50); g.restore();
  // round window
  decal(g, circ(16, -92, 8), '#2e1b12', 0); g.save(); g.lineWidth = 2.5; g.strokeStyle = '#c99a62'; g.stroke(circ(16, -92, 8)); g.restore();
  g.save(); g.globalAlpha = .7; decal(g, circ(16, -92, 5.5), '#ffcf7a', 0); g.restore();
  // canopy
  const C = TREE.gold, A = TREE.autumn;
  paper(g, cloud(0, -176, 112, 54, 14, 31, 1.14), { c: A[0], t: 7, hl: [-100, -230, 90, -120] });
  paper(g, cloud(-26, -186, 80, 40, 12, 32, 1.16), { c: C[1], t: 5, hl: [-100, -230, 60, -140] });
  paper(g, cloud(40, -166, 54, 26, 10, 33, 1.18), { c: A[2], t: 4 });
  paper(g, cloud(-54, -160, 40, 20, 9, 34, 1.2), { c: C[2], t: 3.4 });
  // branch stubs
  paper(g, rr(30, -128, 24, 6, 3), { c: '#8b5a3c', t: 3 });
}
const PROPDEF = {
  tree: { dim: [96, 112, 48, 102], paint: paintTree, solid: [[0, 0, 9]], sway: .012, shadow: [26, 8] },
  pine: { dim: [64, 100, 32, 92], paint: paintPine, solid: [[0, 0, 8]], sway: .012, shadow: [22, 7] },
  bush: { dim: [44, 34, 22, 27], paint: paintBush, solid: [[0, -2, 11]], sway: .02, shadow: [18, 6] },
  mush: { dim: p => { const s = p.s || 1; return [36 * s + 6, 42 * s + 8, 18 * s + 3, 36 * s + 4]; }, paint: paintMush, solid: p => [[0, 0, 6 * (p.s || 1)]], sway: .02, shadow: p => [15 * (p.s || 1), 5 * (p.s || 1)] },
  rock: { dim: [38, 30, 19, 22], paint: paintRock, solid: [[0, -2, 11]], shadow: [17, 6] },
  stump: { dim: [30, 28, 15, 22], paint: paintStump, solid: [[0, -3, 10]], shadow: [14, 5] },
  log: { dim: [66, 26, 32, 20], paint: paintLog, solid: [[-16, -4, 9], [0, -4, 9], [16, -4, 9]], shadow: [30, 7] },
  fern: { dim: [52, 30, 26, 26], paint: paintFern, sway: .05, shadow: [14, 4] },
  flowers: { dim: [28, 22, 14, 19], paint: paintFlowers, sway: .06, shadow: [9, 3] },
  reeds: { dim: [24, 44, 12, 38], paint: paintReeds, sway: .06, shadow: [8, 3] },
  sign: { dim: [50, 44, 25, 38], paint: paintSign, solid: [[0, 0, 4]], shadow: [10, 3] },
  lantern: { dim: [16, 32, 4, 29], paint: paintLantern, solid: [[0, 0, 3]], shadow: [6, 2], glow: [6, -21, '#ffcf6b', 34] },
  basket: { dim: [24, 22, 12, 16], paint: paintBasket, solid: [[0, -2, 7]], shadow: [10, 3] },
  pedestal: { dim: [28, 24, 14, 18], paint: paintPedestal, solid: [[0, -2, 9]], shadow: [12, 4] },
  bigtree: { dim: [290, 290, 145, 254], paint: paintBigTree, solid: [[-56, -6, 15], [-32, -10, 20], [0, -12, 20], [32, -10, 20], [56, -6, 15]], sway: .003, shadow: [78, 16] },
  stone: { dim: [24, 16, 12, 7], paint: paintStone, low: true },
  lily: { dim: [26, 16, 13, 8], paint: paintLily, low: true },
};
const pv = (v, p) => typeof v === 'function' ? v(p) : v;
function propSprite(p) {
  const d = PROPDEF[p.k], dim = pv(d.dim, p);
  return sprite('p|' + p.k + '|' + (p.pal || '') + '|' + (p.seed || 0) + '|' + (p.s || 1) + '|' + (p.cap || '') + '|' + (p.hidden ? 1 : 0) + '|' + (p.c || ''), dim[0], dim[1], dim[2], dim[3], g => d.paint(g, p));
}
function paintAcorn(g) {
  paper(g, ell(0, 2.5, 5.2, 6.2), { c: '#c98a45', t: 2.2, m: 1, hl: [-5, -4, 5, 8] });
  paper(g, P2(p => { p.moveTo(-6.4, -1); p.bezierCurveTo(-6.4, -8, 6.4, -8, 6.4, -1); p.quadraticCurveTo(0, 1, -6.4, -1); p.closePath(); }), { c: '#7a4a2a', t: 1.8, m: 1 });
  for (let i = -4; i <= 4; i += 2.5) line(g, [[i - 1, -5], [i + 1, -1]], 'rgba(255,220,180,.25)', .5);
  line(g, [[0, -6], [1.4, -9]], '#5a361e', 1.4);
}
function paintGoldLeaf(g) {
  paper(g, leafP(-7, 3, 15, 5.2, -.55), { c: '#f2c541', t: 2.2, m: 1.1, e: '#b98b1c', hl: [-8, -8, 8, 4] });
  line(g, [[-6, 2.4], [5.5, -4.6]], 'rgba(160,110,10,.55)', .7);
  line(g, [[-8.6, 4.4], [-6, 2.4]], '#9b6f18', 1.2);
}
const acornSprite = () => sprite('acorn', 16, 20, 8, 10, paintAcorn);
const leafSprite = () => sprite('gleaf', 20, 18, 10, 9, paintGoldLeaf);

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
    props: [['tree', 108, 168, { pal: 'autumn' }], ['tree', 395, 338, { pal: 'green' }], ['tree', 66, 362, { pal: 'gold' }], ['bush', 322, 150, { pal: 'green' }], ['bush', 168, 118, { pal: 'autumn', berries: false }],
      ['rock', 392, 200, {}], ['stump', 166, 308, {}], ['basket', 148, 318, {}], ['sign', 286, 222, {}], ['log', 322, 330, {}],
      ['flowers', 140, 220, {}], ['flowers', 300, 290, {}], ['flowers', 256, 352, {}], ['flowers', 60, 330, {}], ['fern', 438, 196, {}], ['fern', 64, 196, {}], ['mush', 352, 182, { s: .55, cap: '#e2493b' }], ['mush', 362, 188, { s: .4, cap: '#f08a3c' }]],
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
    props: [['tree', 80, 150, { pal: 'green' }], ['tree', 404, 176, { pal: 'autumn' }], ['pine', 360, 352, {}], ['rock', 140, 330, {}], ['log', 404, 290, {}], ['bush', 66, 306, { pal: 'teal' }],
      ['reeds', streamX(100) - 38, 100, {}], ['reeds', streamX(190) - 39, 190, {}], ['reeds', streamX(330) - 38, 330, {}], ['reeds', streamX(372) - 39, 372, {}],
      ['reeds', streamX(110) + 38, 110, {}], ['reeds', streamX(300) + 38, 300, {}], ['reeds', streamX(360) + 39, 360, {}],
      ['flowers', 120, 210, {}], ['flowers', 330, 120, {}], ['fern', 450, 230, {}], ['mush', 168, 120, { s: .5, cap: '#f08a3c' }],
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
      ['rock', 60, 150, { c: '#9a9eb2' }], ['fern', 420, 200, { c: '#3f8c80' }], ['fern', 70, 240, { c: '#3f8c80' }], ['stump', 290, 312, {}]],
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
      ['tree', 92, 330, { pal: 'gold' }], ['fern', 380, 340, {}], ['fern', 168, 300, {}], ['flowers', 270, 320, {}], ['flowers', 430, 210, {}], ['log', 300, 360, {}]],
    items: [['a10', 'acorn', 56, 300], ['a11', 'acorn', 424, 330]],
    npcs: ['wick'], objs: ['door'],
  },
  glade: {
    name: 'Hidden Glade', pal: 'glade', w: 360, h: 300,
    exits: [{ e: 's', a: 160, b: 200, to: 'hollow', sx: 117, sy: 86 }],
    paths: [[[180, 310], [182, 250], [230, 200], [262, 160]]],
    water: (x, y) => Math.hypot((x - 128) / 1.25, y - 168) < 34,
    props: [['pedestal', 268, 152, {}], ['flowers', 210, 120, {}], ['flowers', 300, 210, {}], ['flowers', 90, 240, {}], ['flowers', 250, 260, {}], ['flowers', 150, 110, {}],
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
  dlg: null, trans: null, banner: null, toasts: [], floaters: [], pops: {}, confetti: [], hud: 0,
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
    if (A.props.some(p => Math.hypot(p.x - x, p.y - y) < 26)) continue;
    add(r() < .5 ? 'flowers' : 'fern', x, y, {}); i++;
  }
  A.solids = [];
  for (const p of A.props) { const sd = pv(PROPDEF[p.k].solid, p); if (sd && p.id !== 'fakebush') sd.forEach(s => A.solids.push({ x: p.x + s[0], y: p.y + s[1], r: s[2] })); }
  for (const nid of d.npcs) { const n = NPCS[nid]; A.solids.push({ x: n.x, y: n.y, r: n.kind === 'frog' ? 1 : 8 }); }
  A.items = d.items.map(q => ({ id: q[0], type: q[1], x: q[2], y: q[3], ph: r() * TAU }));
  A.motes = []; const nm = ap.fireflies || 7;
  for (let i = 0; i < nm; i++) A.motes.push({ x: r() * A.w, y: GT + r() * (A.h - GT), ph: r() * TAU, sp: .3 + r() * .5, glow: !!ap.fireflies });
  A.ripples = []; for (let i = 0; i < 26; i++) A.ripples.push({ u: r(), off: (r() - .5) * 1.5, len: 4 + r() * 6, sp: .05 + r() * .05 });
  return A;
}
for (const id in AREADEF) AREAS[id] = buildArea(id);
const bouncy = AREAS.grove.props.find(p => p.id === 'bouncy');
const fakeBush = AREAS.hollow.props.find(p => p.id === 'fakebush');

// ---------------------------------------------------------------- ground boards (cached per area at current scale)
let groundFor = null, groundCanvas = null;
function groundOf(A) {
  if (groundFor === A.id && groundCanvas) return groundCanvas;
  const c = document.createElement('canvas'); c.width = Math.ceil(A.w * SC); c.height = Math.ceil(A.h * SC);
  const g = c.getContext('2d'); g.scale(SC, SC); paintGround(g, A);
  groundFor = A.id; groundCanvas = c; return c;
}
function paintGround(g, A) {
  const ap = A.ap, r = rng(A.w * 3 + A.id.charCodeAt(0));
  // board top edge is a hand-cut wavy line
  const top = P(); top.moveTo(0, A.h + 1); top.lineTo(0, GT);
  for (let x = 0; x <= A.w; x += 12) top.lineTo(x, GT - 3 + Math.sin(x * .09) * 2 + r() * 2);
  top.lineTo(A.w, A.h + 1); top.closePath();
  const lg = g.createLinearGradient(0, GT, 0, A.h); lg.addColorStop(0, shade(ap.ground, -.18)); lg.addColorStop(.25, ap.ground); lg.addColorStop(1, shade(ap.ground, .05));
  g.save(); g.lineJoin = 'round'; g.strokeStyle = 'rgba(50,34,24,.35)'; g.lineWidth = 3.4; g.stroke(top); g.strokeStyle = CREAM; g.lineWidth = 2.2; g.stroke(top); g.fillStyle = lg; g.fill(top); g.clip(top);
  g.globalAlpha = .6; g.fillStyle = texFill(g); g.fillRect(0, 0, A.w, A.h); g.globalAlpha = 1;
  // felt patches, layered like cut paper
  for (let i = 0; i < 20; i++) {
    const x = r() * A.w, y = GT + 20 + r() * (A.h - GT), p = cloud(x, y, 20 + r() * 34, 9 + r() * 14, 8, i * 7 + 3, 1.15, .15);
    g.save(); g.translate(0, 1.4); g.fillStyle = 'rgba(40,60,20,.10)'; g.fill(p); g.restore();
    g.fillStyle = r() < .5 ? ap.ground2 : shade(ap.ground, -.07); g.fill(p);
  }
  // paths
  for (const pl of A.paths) {
    const pp = poly(pl, false); g.lineCap = g.lineJoin = 'round';
    g.save(); g.translate(0, 1.6); g.strokeStyle = 'rgba(70,45,20,.22)'; g.lineWidth = 30; g.stroke(pp); g.restore();
    g.strokeStyle = CREAM; g.lineWidth = 30; g.stroke(pp);
    g.strokeStyle = ap.path; g.lineWidth = 27; g.stroke(pp);
    g.strokeStyle = shade(ap.path, .18); g.lineWidth = 15; g.stroke(pp);
  }
  for (let i = 0; i < 120; i++) { // pebbles on paths
    const x = r() * A.w, y = GT + r() * (A.h - GT); if (!nearPath(A, x, y, 12)) continue;
    decal(g, ell(x, y, 1.2 + r() * 1.6, .8 + r(), r() * 3), shade(ap.path, -.18 - r() * .1), .5, .18);
  }
  // water
  if (A.id === 'stream') paintStream(g, A);
  if (A.id === 'glade') paintPond(g, A);
  // grass tufts, flowers and fallen leaves
  for (let i = 0; i < A.w * A.h / 900; i++) {
    const x = r() * A.w, y = GT + 6 + r() * (A.h - GT); if (nearPath(A, x, y, 15) || (A.water && A.water(x, y + 2)) || (A.water && A.water(x, y - 6))) continue;
    const s = .7 + r() * .7, col = shade(ap.ground, r() < .5 ? -.22 : .2);
    const t = P(); t.moveTo(x - 3 * s, y); t.lineTo(x - 2.4 * s, y - 5 * s); t.lineTo(x - 1 * s, y - .8); t.lineTo(x, y - 7 * s); t.lineTo(x + 1 * s, y - .8); t.lineTo(x + 2.6 * s, y - 5 * s); t.lineTo(x + 3 * s, y); t.closePath();
    decal(g, t, col, .6, .12);
  }
  const fc = ['#f6d14b', '#f28aa6', '#fff6e8', '#9fb8ff', '#ff9c57'];
  for (let i = 0; i < A.w * A.h / 2600; i++) {
    const x = r() * A.w, y = GT + 10 + r() * (A.h - GT); if (nearPath(A, x, y, 15) || (A.water && A.water(x, y))) continue;
    const c = fc[(r() * fc.length) | 0], fl = P();
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; fl.moveTo(x + Math.cos(a) * 1.7 + 1.1, y + Math.sin(a) * 1.7); fl.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.1, 0, TAU); }
    decal(g, fl, c, .5, .2); decal(g, circ(x, y, .8), '#e8a23b', 0);
  }
  const lc = ['#d96a32', '#f0a03e', '#c4542f', '#efc95c'];
  for (let i = 0; i < A.w * A.h / 4200; i++) {
    const x = r() * A.w, y = GT + 10 + r() * (A.h - GT); if (A.water && A.water(x, y)) continue;
    decal(g, leafP(x, y, 4 + r() * 2, 1.7, r() * TAU), lc[(r() * lc.length) | 0], .5, .16);
  }
  // depth: the back of the board is a touch darker
  const sg = g.createLinearGradient(0, GT, 0, GT + 70); sg.addColorStop(0, 'rgba(30,40,20,.22)'); sg.addColorStop(1, 'rgba(30,40,20,0)'); g.fillStyle = sg; g.fillRect(0, GT - 6, A.w, 80);
  g.restore();
}
function paintStream(g, A) {
  const band = (hw, y0 = GT - 6) => { const L = [], R = []; for (let y = y0; y <= A.h + 4; y += 6) { L.push([streamX(y) - hw, y]); R.push([streamX(y) + hw, y]); } return poly(L.concat(R.reverse())); };
  g.save(); g.translate(0, 1.5); g.fillStyle = 'rgba(40,30,15,.28)'; g.fill(band(STREAM_HW + 5)); g.restore();
  g.fillStyle = CREAM; g.fill(band(STREAM_HW + 5));
  g.fillStyle = '#9a7650'; g.fill(band(STREAM_HW + 3.6));
  g.fillStyle = '#2f78a8'; g.fill(band(STREAM_HW));
  g.save(); g.translate(0, -1.2); g.fillStyle = '#3f8fc0'; g.fill(band(STREAM_HW - 6)); g.restore();
  g.save(); g.translate(0, -2.2); g.fillStyle = '#5aa8d6'; g.fill(band(STREAM_HW - 15)); g.restore();
  g.save(); g.globalAlpha = .45; g.fillStyle = texFill(g); g.fill(band(STREAM_HW)); g.restore();
  // the secret island
  const I = A.island, ip = cloud(I.x, I.y + 1, I.r + 2, I.r * .75 + 1, 8, 77, 1.12, .1);
  paper(g, ip, { c: '#8a6a48', t: 2.6, m: 1 });
  paper(g, cloud(I.x, I.y - 1, I.r, I.r * .65, 8, 78, 1.12, .1), { c: '#86c063', t: 1, m: 0 });
}
function paintPond(g) {
  const pp = r => { const p = P(); p.ellipse(128, 168, r * 1.25, r, 0, 0, TAU); return p; };
  g.save(); g.translate(0, 1.5); g.fillStyle = 'rgba(40,30,15,.25)'; g.fill(pp(40)); g.restore();
  g.fillStyle = CREAM; g.fill(pp(40)); g.fillStyle = '#9a7650'; g.fill(pp(38.6));
  g.fillStyle = '#2f78a8'; g.fill(pp(35)); g.save(); g.translate(0, -1.2); g.fillStyle = '#4796c6'; g.fill(pp(28)); g.restore();
  g.save(); g.translate(0, -2.2); g.fillStyle = '#6cb8e0'; g.fill(pp(17)); g.restore();
}

// back scenery: three tiling paper silhouette layers with parallax
const LAYER_W = 420;
function layerSprite(A, i) {
  const ap = A.ap, col = ap.layers[i];
  return sprite('layer|' + A.ap.sky[0] + '|' + i, LAYER_W, 150, 0, 120, g => {
    const r = rng(i * 31 + A.w + ap.layers[0].length), p = P();
    const n = [16, 12, 10][i], hmin = [62, 46, 28][i], hvar = [36, 30, 26][i];
    const shapes = [];
    for (let k = 0; k < n; k++) shapes.push([k / n * LAYER_W + r() * 12, hmin + r() * hvar, 12 + r() * 10, r()]);
    for (const [x, h, rw, kind] of shapes) for (const dx of [-LAYER_W, 0, LAYER_W]) {
      const X = x + dx; if (X < -40 || X > LAYER_W + 40) continue;
      if (A.id === 'grove' && i === 1 && kind < .45) { // giant mushroom silhouettes
        p.moveTo(X - 4, 0); p.lineTo(X - 3, -h + 14); p.lineTo(X + 3, -h + 14); p.lineTo(X + 4, 0);
        p.moveTo(X - rw * 1.4, -h + 15); p.bezierCurveTo(X - rw * 1.4, -h - 10, X + rw * 1.4, -h - 10, X + rw * 1.4, -h + 15); p.closePath();
      } else if (kind < .35) { // pine
        p.moveTo(X, -h - 10); p.lineTo(X + rw, -h * .3); p.lineTo(X + rw * .6, -h * .3); p.lineTo(X + rw * 1.1, 0); p.lineTo(X - rw * 1.1, 0); p.lineTo(X - rw * .6, -h * .3); p.lineTo(X - rw, -h * .3); p.closePath();
      } else {
        p.rect(X - 2.5, -h * .5, 5, h * .5);
        p.addPath(cloud(X, -h + rw * .6, rw, rw * .9, 7, (X * 3) | 0, 1.2));
      }
    }
    p.rect(-60, -8, LAYER_W + 120, 40);
    paper(g, p, { c: col, t: 1.2 + i, m: .7 + i * .2, mc: shade(col, .35), ink: 'rgba(40,30,30,.15)', tex: true });
    // mist at the foot of the layer
    const mg = g.createLinearGradient(0, -30, 0, 10); mg.addColorStop(0, 'rgba(255,255,245,0)'); mg.addColorStop(1, 'rgba(255,255,245,' + (.32 - i * .08) + ')');
    g.fillStyle = mg; g.fillRect(-10, -30, LAYER_W + 20, 50);
  });
}
const branchSprite = pal => sprite('branch|' + pal, 130, 70, 0, 0, g => {
  const C = TREE[pal], r = rng(5);
  const tw = P(); tw.moveTo(-6, 4); tw.quadraticCurveTo(50, 26, 118, 22); tw.quadraticCurveTo(52, 32, -6, 12); tw.closePath();
  paper(g, tw, { c: '#7b4f33', t: 2.4 });
  for (let i = 0; i < 16; i++) {
    const u = i / 16, x = u * 112, y = 8 + u * 16 + Math.sin(u * 3) * 4;
    paper(g, leafP(x, y, 14 + r() * 8, 5, (i % 2 ? .9 : 2.2) + (r() - .5) * .6), { c: C[(r() * 3) | 0], t: 2.4, m: 1 });
  }
});
const fallLeaf = (i, pal) => sprite('fl|' + pal + i, 12, 8, 6, 4, g => paper(g, leafP(-5, 0, 10, 3.4, 0), { c: TREE[pal][i % 3], t: 1, m: .7 }));

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
  sign: { area: 'clearing', x: 286, y: 224, h: 44, range: 26, use() { say('Signpost', '#a2724a', null, ['\u2190 The Old Hollow     \u2191 Mushroom Grove     \u2192 Stepping Stream', 'Someone has carved a tiny acorn into the post.']); } },
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
  for (let i = 0; i < 90; i++) S.confetti.push({ x: Math.random() * VW, y: -Math.random() * VH * .6, vx: (Math.random() - .5) * 20, vy: 30 + Math.random() * 40, r: Math.random() * TAU, vr: (Math.random() - .5) * 8, c: ['#e8603f', '#f0a03e', '#7cc24f', '#2fa39a', '#8a5cc9', '#ef7fb2', '#f6d14b'][i % 7] });
  const A = window.MembersAuth; const secs = Math.round(S.finishT);
  if (A && S.playP) S.playP.then(id => id && A.endPlay(id, { outcome: 'win', score: secs, meta: { leaves: S.leaves } })).catch(() => {});
}
function burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 40; S.floaters.push({ x, y: y - 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, spark: true }); } }
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
}
function camTarget() {
  const A = S.A, minY = -16, maxY = A.h + 20; let tx, ty;
  tx = VW >= A.w ? (A.w - VW) / 2 : clamp(S.px - VW / 2, 0, A.w - VW);
  ty = VH >= maxY - minY ? (minY + maxY - VH) / 2 : SHOT ? minY : clamp(S.py - 16 - VH / 2, minY, maxY - VH);
  return [tx, ty];
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
    if ((p.k === 'bush' || p.k === 'fern' || p.k === 'flowers' || p.k === 'reeds') && S.moving && Math.hypot(S.px - p.x, S.py - p.y) < 20) p.rustle = 1; }
  for (const nid of A.npcs) { const n = NPCS[nid]; if (n.front) continue; const want = Math.hypot(S.px - n.x, S.py - n.y) < 90 ? (S.px > n.x ? 1 : -1) : 1; n.flip = n.flip == null ? 1 : n.flip; n.flip += Math.sign(want - n.flip) * Math.min(Math.abs(want - n.flip), dt * 7); }
  if (S.bounceT > 0) S.bounceT = Math.max(0, S.bounceT - dt * 1.1);
  // camera
  const c = camTarget(), k = Math.min(1, dt * 6); S.camX += (c[0] - S.camX) * k; S.camY += (c[1] - S.camY) * k;
  // effects
  S.hud = Math.max(0, S.hud - dt * 2.5);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > 3) S.banner = null; }
  S.toasts.forEach(q => q.t += dt); S.toasts = S.toasts.filter(q => q.t < 3.2);
  S.floaters.forEach(f => { f.t += dt; if (f.spark) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; } else f.y -= 16 * dt; }); S.floaters = S.floaters.filter(f => f.t < (f.spark ? .8 : 1.1));
  for (const q of S.confetti) { q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; q.vx += Math.sin(S.t * 2 + q.r) * 10 * dt; }
  S.confetti = S.confetti.filter(q => q.y < VH + 10);
  for (const l of FALL) { l.y += l.vy * dt; l.x += (l.vx + Math.sin(S.t * 1.2 + l.ph) * 10) * dt; l.r += l.vr * dt; if (l.y > VH + 8 || l.x < -10 || l.x > VW + 10) { l.y = -8; l.x = Math.random() * VW; } }
}
const FALL = []; for (let i = 0; i < 9; i++) FALL.push({ x: Math.random() * 400, y: Math.random() * 300, vx: -6 + Math.random() * 6, vy: 9 + Math.random() * 9, r: Math.random() * TAU, vr: (Math.random() - .5) * 3, ph: Math.random() * TAU, i });

// ---------------------------------------------------------------- rendering
function drawWorld() {
  const A = S.A, ap = A.ap;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sk = ctx.createLinearGradient(0, 0, 0, CH); sk.addColorStop(0, ap.sky[0]); sk.addColorStop(1, ap.sky[1]);
  ctx.fillStyle = sk; ctx.fillRect(0, 0, CW, CH);
  const ox = Math.round(-S.camX * SC), oy = Math.round(-S.camY * SC);
  ctx.setTransform(SC, 0, 0, SC, ox, oy);
  const cx0 = S.camX, cx1 = S.camX + VW;
  // sun glow
  const sx = A.w * ap.sun[0], sy = GT - 60, rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 170);
  rg.addColorStop(0, ap.sun[1]); rg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = rg; ctx.fillRect(sx - 170, sy - 170, 340, 340);
  // parallax back layers
  const F = [.25, .5, .75], BASE = [GT - 18, GT - 8, GT + 2];
  for (let i = 0; i < 3; i++) {
    const s = layerSprite(A, i), x0 = S.camX * (1 - F[i]);
    let k = Math.floor((cx0 - x0) / LAYER_W) - 1;
    for (let x = x0 + k * LAYER_W; x < cx1 + 4; x += LAYER_W) if (x + LAYER_W > cx0 - 4) blit(ctx, s, x, BASE[i]);
  }
  if (A.id === 'stream') drawWaterfall(A);
  // the table and the board's cardboard front edge
  ctx.fillStyle = '#34493b'; ctx.fillRect(cx0 - 10, A.h, VW + 20, 400);
  if (VW > A.w) { ctx.fillRect(cx0 - 10, GT - 2, -cx0 + 10, A.h); ctx.fillRect(A.w, GT - 2, cx1 - A.w + 10, A.h); }
  const sh = ctx.createLinearGradient(0, A.h, 0, A.h + 34); sh.addColorStop(0, 'rgba(10,20,10,.5)'); sh.addColorStop(1, 'rgba(10,20,10,0)');
  ctx.fillStyle = sh; ctx.fillRect(-6, A.h + 8, A.w + 12, 34);
  const eg = ctx.createLinearGradient(0, A.h, 0, A.h + 12); eg.addColorStop(0, '#a88258'); eg.addColorStop(1, '#6e5238');
  ctx.fillStyle = eg; ctx.fillRect(0, A.h - 1, A.w, 13);
  ctx.fillStyle = 'rgba(60,40,20,.18)'; for (let x = 2; x < A.w; x += 3) ctx.fillRect(x, A.h + 2, .6, 9);
  ctx.fillStyle = CREAM; ctx.fillRect(0, A.h - 1.2, A.w, 1.2);
  // the board
  ctx.drawImage(groundOf(A), 0, 0, A.w, A.h);
  if (A.id === 'stream') drawRipples(A);
  if (A.id === 'glade') drawPondShine();
  // low things lying on the ground / water
  for (const st of A.stones) blit(ctx, propSprite({ k: 'stone', seed: st.seed, hidden: st.hidden }), st.x, st.y + Math.sin(S.t * 2 + st.seed) * .3, 1, 1, 0, st.hidden ? .42 : 1);
  for (const p of A.props) if (PROPDEF[p.k].low) blit(ctx, propSprite(p), p.x, p.y + Math.sin(S.t * 1.6 + p.ph) * .5, 1, 1, Math.sin(S.t * .8 + p.ph) * .05);
  // shadows
  for (const p of A.props) { const d = PROPDEF[p.k]; if (d.low || !d.shadow) continue; const s = pv(d.shadow, p); shadow(ctx, p.x, p.y + 1, s[0], s[1], p.id === 'fakebush' && fakeNear() ? .4 : 1); }
  for (const nid of A.npcs) { const n = NPCS[nid]; if (n.kind !== 'frog') shadow(ctx, n.x, n.y + 1, 14, 4.5); }
  if (S.mode !== 'title' || true) shadow(ctx, S.px, S.py + 1, 12, 4);
  for (const it of A.items) if (!S.got.has(it.id)) shadow(ctx, it.x, it.y + 1, 6, 2, .8);
  if (A.id === 'stream') { const n = NPCS.pip; blit(ctx, propSprite({ k: 'lily', seed: 99 }), n.x, n.y + 1); }
  // y-sorted cut-outs
  const L = [];
  for (const p of A.props) if (!PROPDEF[p.k].low) L.push([p.y, 0, p]);
  for (const it of A.items) if (!S.got.has(it.id)) L.push([it.y + .1, 1, it]);
  for (const nid of A.npcs) L.push([NPCS[nid].y, 2, nid]);
  L.push([S.py + .05, 3, null]);
  L.sort((a, b) => a[0] - b[0]);
  for (const e of L) { if (e[1] === 0) drawProp(e[2]); else if (e[1] === 1) drawItem(e[2]); else if (e[1] === 2) drawNpc(e[2]); else drawHero(); }
  drawGlows(A);
  // talk prompt + floating numbers
  if (S.target && !S.dlg && S.mode === 'play') drawPrompt(S.target);
  for (const f of S.floaters) {
    const a = 1 - f.t / (f.spark ? .8 : 1.1);
    if (f.spark) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(glowOf('#ffe27a'), f.x - 4, f.y - 4, 8, 8); ctx.restore(); }
    else { ctx.save(); ctx.globalAlpha = a; textPaper(f.text, f.x, f.y, 9, '#7a4a2a'); ctx.restore(); }
  }
}
const fakeNear = () => S.area === 'hollow' && Math.hypot(S.px - fakeBush.x, S.py - fakeBush.y) < 30;
function drawProp(p) {
  const d = PROPDEF[p.k]; if (p.x < S.camX - 160 || p.x > S.camX + VW + 160 || p.y < S.camY - 20 || p.y > S.camY + VH + 300) return;
  let rot = d.sway ? Math.sin(S.t * 1.25 + p.ph) * d.sway : 0, sx = 1, sy = 1, a = 1;
  if (p.rustle) rot += Math.sin(S.t * 28) * .07 * p.rustle;
  if (p.id === 'bouncy' && S.bounceT > 0) { const k = Math.sin((1 - S.bounceT) * Math.PI * 5) * S.bounceT; sx = 1 + k * .2; sy = 1 - k * .24; }
  if (p.id === 'fakebush' && fakeNear()) a = .5;
  blit(ctx, propSprite(p), p.x, p.y, sx, sy, rot, a);
}
function drawItem(it) {
  let x = it.x, y = it.y, z = 7 + Math.sin(S.t * 3 + it.ph) * 1.6;
  if (it.pop && it.pop.t < 1) { const u = it.pop.t; x = lerp(it.pop.x0, it.x, u); y = lerp(it.pop.y0, it.y, u); z = 7 + Math.sin(u * Math.PI) * 30; }
  const c = Math.cos(S.t * 2.4 + it.ph), sx = Math.sign(c || 1) * Math.max(.14, Math.abs(c));
  if (it.type === 'leaf') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .2 * Math.sin(S.t * 4); ctx.drawImage(glowOf('#ffd84a'), x - 16, y - z - 16, 32, 32); ctx.restore();
    blit(ctx, leafSprite(), x, y - z, sx, 1, Math.sin(S.t * 1.7) * .15);
    for (let i = 0; i < 3; i++) { const a = S.t * 1.5 + i * 2.1, r = 11; star(x + Math.cos(a) * r, y - z + Math.sin(a) * r * .6, 1.6 + Math.sin(S.t * 5 + i) * .7); }
  } else blit(ctx, acornSprite(), x, y - z, sx, 1);
}
function star(x, y, r) { ctx.save(); ctx.fillStyle = '#fff6c8'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * .35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); ctx.restore(); }
function drawNpc(nid) {
  const n = NPCS[nid], s = npcSprite(n.kind), talking = S.dlg && S.dlg.portrait === n.kind;
  const hop = talking ? Math.abs(Math.sin(S.t * 10)) * 1.5 : 0, br = 1 + Math.sin(S.t * 2.2 + n.x) * .025;
  const f = n.front ? 1 : (n.flip == null ? 1 : n.flip), sx = Math.sign(f || 1) * Math.max(.12, Math.abs(f));
  if (!n.front && Math.abs(f) < .7) edgeStrip(n.x, n.y + (n.dy || 0), 26, 1 - Math.abs(f));
  blit(ctx, s, n.x, n.y + (n.dy || 0) - hop, sx, br);
}
function edgeStrip(x, y, h, k) { ctx.save(); ctx.fillStyle = '#cdb48c'; const w = k * 4.2; ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = 'rgba(60,40,20,.3)'; ctx.fillRect(x - w / 2, y - h, w * .3, h); ctx.restore(); }
function drawHero() {
  const x = S.px, y = S.py, w = S.walk * 10;
  const hop = S.moving ? Math.abs(Math.sin(w)) * 2.6 : 0, rot = S.moving ? Math.sin(w) * .045 : 0;
  const br = S.moving ? 1 : 1 + Math.sin(S.t * 2.6) * .022;
  const fo = S.moving ? Math.sin(w) * 2.4 : 0;
  // little paper boots
  for (const [bx, lift] of [[-4.4, fo], [4.4, -fo]]) {
    const fx = x + bx * Math.max(.4, Math.abs(S.flip)) + (S.back ? 0 : lift * .5 * Math.sign(S.flip)), fy = y - 1 - Math.max(0, lift) * .7;
    ctx.fillStyle = 'rgba(50,34,24,.4)'; ctx.fill(ell(fx, fy + 1.6, 4.2, 2.8)); ctx.fillStyle = '#3d2618'; ctx.fill(ell(fx, fy + 1, 3.8, 2.4)); ctx.fillStyle = '#5b3a2a'; ctx.fill(ell(fx, fy, 3.8, 2.4));
  }
  const f = S.flip, sx = Math.sign(f || 1) * Math.max(.12, Math.abs(f));
  if (Math.abs(f) < .75) edgeStrip(x, y - 2 - hop, 42, 1 - Math.abs(f));
  blit(ctx, heroSprite(S.back), x, y - 1.5 - hop, sx, br, rot);
}
function drawPrompt(o) {
  const x = o.x, y = o.y - o.h - 8 + Math.sin(S.t * 5) * 1.6;
  paper(ctx, P2(p => { p.arc(x, y, 7, 0, TAU); p.moveTo(x - 2.5, y + 6); p.lineTo(x, y + 10); p.lineTo(x + 2.5, y + 6); }), { c: CREAM, t: 1.8, m: .8, tex: false });
  ctx.fillStyle = '#e8603f'; ctx.font = '900 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.nid ? '!' : '?', x, y + .6);
  const hint = ROOT.classList.contains('touch-ui') && touchOn() ? 'A' : 'Space';
  ctx.font = '800 6px ' + FONT; ctx.fillStyle = 'rgba(255,248,236,.95)'; ctx.strokeStyle = 'rgba(58,42,34,.65)'; ctx.lineWidth = 2; ctx.strokeText(hint, x, y - 11); ctx.fillText(hint, x, y - 11);
}
function textPaper(t, x, y, size, col, align = 'center') {
  ctx.font = '900 ' + size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(50,34,24,.4)'; ctx.lineWidth = size * .38; ctx.strokeText(t, x, y + size * .12);
  ctx.strokeStyle = CREAM; ctx.lineWidth = size * .3; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
}
function drawWaterfall(A) {
  const x = streamX(GT), top = GT - 46;
  ctx.save();
  paper(ctx, cloud(x, top + 14, 30, 24, 9, 61, 1.12, .12), { c: '#8f8a80', t: 3, m: 1.2, tex: false });
  const cols = ['#3f8fc0', '#6cb8e0', '#b9e2f5', '#ffffff'];
  ctx.beginPath(); ctx.moveTo(x - 17, GT + 6); ctx.lineTo(x - 15, top + 6); ctx.quadraticCurveTo(x, top - 4, x + 15, top + 6); ctx.lineTo(x + 17, GT + 6); ctx.closePath(); ctx.clip();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i]; ctx.globalAlpha = i === 3 ? .7 : 1;
    for (let k = -1; k < 4; k++) { const yy = top + ((S.t * (26 + i * 8) + k * 18) % 72) - 18; ctx.fill(rr(x - 18 + i * 3 + (k % 2) * 6, yy, i === 3 ? 4 : 30 - i * 6, i === 3 ? 10 : 22, 3)); }
  }
  ctx.restore();
  blit(ctx, propSprite({ k: 'rock', seed: 71, c: '#9a958a' }), x - 27, GT + 2); blit(ctx, propSprite({ k: 'rock', seed: 73, c: '#a19c90' }), x + 27, GT);
  for (let i = 0; i < 6; i++) { const a = (S.t * 1.5 + i / 6) % 1; ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * (1 - a)) + ')'; ctx.fill(circ(x - 16 + i * 6.5, GT + 2 + a * 6, 2 + a * 3)); }
}
function drawRipples(A) {
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.3;
  for (const q of A.ripples) {
    const u = (q.u + S.t * q.sp) % 1, y = GT + u * (A.h - GT), x = streamX(y) + q.off * 18;
    if (y < S.camY - 10 || y > S.camY + VH + 10) continue;
    ctx.globalAlpha = Math.sin(u * Math.PI) * .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1.5, y + q.len / 2, x, y + q.len); ctx.stroke();
  }
  ctx.restore();
  // little wake rings around the stepping stones
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = .8;
  for (const st of A.stones) { const a = (S.t * .6 + st.seed * .37) % 1; ctx.globalAlpha = (1 - a) * (st.hidden ? .8 : .55); ctx.stroke(ell(st.x, st.y + 1, 9 + a * 6, 5 + a * 3)); }
  ctx.restore();
}
function drawPondShine() {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = .9;
  for (let i = 0; i < 3; i++) { const a = (S.t * .35 + i / 3) % 1; ctx.globalAlpha = 1 - a; ctx.stroke(ell(112 + i * 18, 160 + i * 8, 4 + a * 14, 2 + a * 7)); }
  ctx.restore();
}
function drawGlows(A) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of A.props) {
    if (p.glow) { const s = p.s || 1, a = .32 + .14 * Math.sin(S.t * 1.8 + p.ph), R = 34 * s; ctx.globalAlpha = a; ctx.drawImage(glowOf(p.glow), p.x - R, p.y - 26 * s - R, R * 2, R * 2); }
    const g = PROPDEF[p.k].glow; if (g) { const R = g[3], a = .45 + .12 * Math.sin(S.t * 6 + p.ph) * Math.sin(S.t * 2.3); ctx.globalAlpha = a; ctx.drawImage(glowOf(g[2]), p.x + g[0] - R, p.y + g[1] - R, R * 2, R * 2); }
  }
  if (A.id === 'hollow') { ctx.globalAlpha = .35 + .08 * Math.sin(S.t * 3); ctx.drawImage(glowOf('#ffb04a'), 240 - 40, 160 - 40, 80, 80); }
  for (const m of A.motes) {
    const x = m.x + Math.sin(S.t * m.sp + m.ph) * 22, y = m.y + Math.cos(S.t * m.sp * 1.3 + m.ph) * 14 - (m.glow ? 6 : 10);
    if (m.glow) { ctx.globalAlpha = .55 + .45 * Math.sin(S.t * 3 + m.ph); ctx.drawImage(glowOf(A.ap.motes), x - 7, y - 7, 14, 14); ctx.drawImage(glowOf('#ffffff'), x - 1.6, y - 1.6, 3.2, 3.2); }
    else { ctx.globalAlpha = .35 + .25 * Math.sin(S.t * 2 + m.ph); ctx.drawImage(glowOf(A.ap.motes), x - 3, y - 3, 6, 6); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- screen-space layers
function drawScreen(dt) {
  const A = S.A, ap = A.ap;
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  if (ap.tint) { ctx.fillStyle = ap.tint; ctx.fillRect(0, 0, VW, VH); }
  // god rays
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = VW * (.22 + i * .3) + Math.sin(S.t * .25 + i * 2) * 12 - S.camX * .08, w = 22 + i * 9, a = ap.rays * (.75 + .25 * Math.sin(S.t * .6 + i));
    const lg = ctx.createLinearGradient(0, 0, 0, VH * .9); lg.addColorStop(0, 'rgba(255,244,205,' + a + ')'); lg.addColorStop(1, 'rgba(255,244,205,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + w, -5); ctx.lineTo(x + w - VH * .45, VH); ctx.lineTo(x - VH * .45 - w * .4, VH); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // foreground hanging branches (closer than everything: they drift the most)
  const bs = clamp(VW / 430, .48, 1), bx = -((S.camX * .18) % 24);
  const br = branchSprite(ap.branch);
  blit(ctx, br, -8 + bx, -6, bs, bs, .04 + Math.sin(S.t * .9) * .025);
  blit(ctx, br, VW + 8 - bx, -8, -bs, bs, -.04 - Math.sin(S.t * .8 + 1) * .025);
  // falling leaves (they flip like paper)
  for (const l of FALL) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r); ctx.scale(Math.cos(S.t * 2.2 + l.ph) || .1, 1); const s = fallLeaf(l.i, ap.branch); ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(vignette, 0, 0);
  ctx.setTransform(SC, 0, 0, SC, 0, 0);
  if (S.mode !== 'title') drawHud();
  drawBanner();
  if (S.dlg) drawDialog();
  if (S.mode === 'title') drawTitle();
  if (S.mode === 'end') drawEnd();
  for (const q of S.confetti) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.scale(Math.cos(q.r * 1.7), 1); ctx.fillStyle = shade(q.c, -.35); ctx.fillRect(-2.5, -1.2, 5, 3.4); ctx.fillStyle = q.c; ctx.fillRect(-2.5, -1.8, 5, 3.2); ctx.restore(); }
  if (S.trans) drawTrans();
}
function card(x, y, w, h, r, c, t) { paper(ctx, rr(x, y, w, h, r), { c: c || CARD, t: t == null ? 3 : t, m: 1.2, tex: false }); }
function drawHud() {
  const y = 6, pop = 1 + S.hud * .25;
  ctx.font = '900 10px ' + FONT; const t1 = S.acorns + '/' + ACORNS, w1 = 30 + ctx.measureText(t1).width;
  card(6, y, w1, 18, 8);
  blit(ctx, acornSprite(), 16, y + 9.5, .72 * pop, .72 * pop);
  textPaper(t1, 25, y + 9.5, 10, '#7a4a2a', 'left');
  if (S.leaves > 0) { const t2 = S.leaves + '/' + LEAVES, w2 = 30 + ctx.measureText(t2).width; card(12 + w1, y, w2, 18, 8); blit(ctx, leafSprite(), 22 + w1, y + 9.5, .66, .66); textPaper(t2, 31 + w1, y + 9.5, 10, '#a37a12', 'left'); }
  // toasts
  S.toasts.forEach((q, i) => {
    const a = Math.min(1, q.t * 5, (3.2 - q.t) * 3); ctx.save(); ctx.globalAlpha = a; ctx.font = '800 8px ' + FONT;
    const w = Math.min(VW - 20, ctx.measureText(q.text).width + 20), y0 = 30 + i * 20 + (1 - Math.min(1, q.t * 5)) * -6;
    card((VW - w) / 2, y0, w, 15, 7, '#fffaf0', 2); ctx.fillStyle = '#5a3b22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(q.text, VW / 2, y0 + 8, w - 10); ctx.restore();
  });
}
function drawBanner() {
  const b = S.banner; if (!b || S.mode === 'title') return;
  const t = b.t, k = t < .4 ? ease(t / .4) : t > 2.5 ? 1 - ease((t - 2.5) / .5) : 1;
  ctx.font = '900 11px ' + FONT; const w = ctx.measureText(b.text).width + 34, x = (VW - w) / 2, y = lerp(-30, VH * .16, k);
  ctx.save(); ctx.translate(VW / 2, y + 9); ctx.rotate(Math.sin(t * 2) * .015); ctx.translate(-VW / 2, -y - 9);
  // ribbon tails
  paper(ctx, poly([[x - 10, y + 4], [x + 6, y + 4], [x + 6, y + 20], [x - 10, y + 20], [x - 5, y + 12]]), { c: '#c84a33', t: 2, m: 1, tex: false });
  paper(ctx, poly([[x + w + 10, y + 4], [x + w - 6, y + 4], [x + w - 6, y + 20], [x + w + 10, y + 20], [x + w + 5, y + 12]]), { c: '#c84a33', t: 2, m: 1, tex: false });
  card(x, y, w, 19, 4, '#e8603f', 3);
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, VW / 2, y + 10);
  ctx.restore();
}
function wrap(text, maxW) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function drawDialog() {
  const d = S.dlg, touchPad = ROOT.classList.contains('touch-ui') && touchOn() ? 170 * DPR / SC : 0;
  const bw = Math.min(VW - 14, 330), bh = 66, bx = (VW - bw) / 2, by = VH - bh - 10 - touchPad;
  card(bx, by, bw, bh, 8, CARD, 4);
  ctx.save(); ctx.clip(rr(bx, by, bw, bh, 8)); ctx.globalAlpha = .5; ctx.fillStyle = texFill(ctx); ctx.fillRect(bx, by, bw, bh); ctx.restore();
  let tx = bx + 12;
  if (d.portrait) {
    paper(ctx, circ(bx + 30, by + 34, 21), { c: shade(d.color, .55), t: 2, m: 1, tex: false });
    ctx.save(); ctx.beginPath(); ctx.arc(bx + 30, by + 34, 21, 0, TAU); ctx.clip();
    const s = npcSprite(d.portrait); const k = 1.15; blit(ctx, s, bx + 30, by + 34 + (NPCPAINT[d.portrait][2] * .42) * k + Math.abs(Math.sin(S.t * 10)) * (d.shown < d.lines[d.i].length ? 1.2 : 0), k, k);
    ctx.restore(); tx = bx + 58;
  }
  ctx.font = '900 8px ' + FONT; const nw = ctx.measureText(d.name).width + 16;
  card(bx + 10, by - 9, nw, 15, 6, d.color, 2.4);
  ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.name, bx + 10 + nw / 2, by - 1);
  ctx.font = '700 8.6px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#4a3326';
  if (!d.wrapped) d.wrapped = wrap(d.lines[d.i], bx + bw - 12 - tx);
  let left = Math.floor(d.shown), ly = by + 12;
  for (const ln of d.wrapped) { if (left <= 0) break; ctx.fillText(ln.slice(0, left), tx, ly); left -= ln.length + 1; ly += 12; }
  if (d.shown >= d.lines[d.i].length) { const ax = bx + bw - 13, ay = by + bh - 11 + Math.sin(S.t * 6) * 1.5; ctx.fillStyle = '#e8603f'; ctx.beginPath(); ctx.moveTo(ax - 4, ay - 3); ctx.lineTo(ax + 4, ay - 3); ctx.lineTo(ax, ay + 2); ctx.closePath(); ctx.fill(); }
}
const LOGO_COLS = ['#e8603f', '#f0a03e', '#7cc24f', '#2fa39a', '#8a5cc9', '#ef7fb2'];
function drawLogo(cx, cy, fs) {
  const text = 'Thimblewood'; ctx.font = '900 ' + fs + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const ws = [...text].map(ch => ctx.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + (text.length - 1) * fs * .02;
  let x = cx - tot / 2; const T = fs * .14;
  [...text].forEach((ch, i) => {
    const c = LOGO_COLS[i % LOGO_COLS.length], lx = x + ws[i] / 2, ly = cy + Math.sin(S.t * 2 + i * .7) * fs * .03;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.sin(S.t * 1.4 + i) * .05 + (i % 2 ? .04 : -.04));
    ctx.strokeStyle = 'rgba(50,34,24,.4)'; ctx.lineWidth = fs * .26; for (let k = T; k >= 0; k -= T / 4) ctx.strokeText(ch, 0, k + 1);
    ctx.fillStyle = ctx.strokeStyle = shade(c, -.42); ctx.lineWidth = fs * .2; for (let k = T; k > 0; k -= T / 5) { ctx.strokeText(ch, 0, k); ctx.fillText(ch, 0, k); }
    ctx.strokeStyle = CREAM; ctx.lineWidth = fs * .2; ctx.strokeText(ch, 0, 0); ctx.fillStyle = c; ctx.fillText(ch, 0, 0);
    ctx.restore(); x += ws[i] + fs * .02;
  });
}
function drawTitle() {
  const fs = clamp(VW * (VH > VW ? .14 : .115), 24, 52), cy = SHOT ? VH * .2 : VH * .2;
  const wash = ctx.createLinearGradient(0, 0, 0, VH * .45); wash.addColorStop(0, 'rgba(255,250,235,.55)'); wash.addColorStop(1, 'rgba(255,250,235,0)'); ctx.fillStyle = wash; ctx.fillRect(0, 0, VW, VH * .45);
  drawLogo(VW / 2, cy, fs);
  ctx.font = '800 ' + (fs * .3) + 'px ' + FONT; const sub = SHOT ? 'Explore a little paper forest' : 'a little paper forest', sw = ctx.measureText(sub).width + 22;
  card((VW - sw) / 2, cy + fs * .72, sw, fs * .48, 6, '#fffaf0', 2.4);
  ctx.fillStyle = '#5a3b22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sub, VW / 2, cy + fs * .97);
  const touch = ROOT.classList.contains('touch-ui');
  const msg = SHOT ? 'Tap to play' : touch ? 'Tap to start' : 'Press Space to start';
  const a = SHOT ? 1 : .65 + .35 * Math.sin(S.t * 4); ctx.save(); ctx.globalAlpha = a;
  ctx.font = '900 11px ' + FONT; const mw = ctx.measureText(msg).width + 26, my = SHOT ? VH - 34 : touch ? cy + fs * 1.75 : VH - 34, mx = SHOT ? VW * .74 : VW / 2;
  card(mx - mw / 2, my, mw, 20, 9, '#e8603f', 3); ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, mx, my + 10.5); ctx.restore();
  if (!SHOT && !touch) { ctx.font = '700 7px ' + FONT; ctx.fillStyle = 'rgba(255,250,240,.95)'; ctx.strokeStyle = 'rgba(50,34,24,.5)'; ctx.lineWidth = 2; const h = 'Arrows / WASD walk  \u00b7  Space talk  \u00b7  M sound'; ctx.strokeText(h, VW / 2, my + 30); ctx.fillText(h, VW / 2, my + 30); }
}
function drawEnd() {
  const w = Math.min(VW - 24, 250), h = 132, x = (VW - w) / 2, y = (VH - h) / 2 - 10;
  ctx.fillStyle = 'rgba(40,30,20,.25)'; ctx.fillRect(0, 0, VW, VH);
  card(x, y, w, h, 10, CARD, 5);
  textPaper('Harvest Supper!', VW / 2, y + 22, 17, '#e8603f');
  ctx.fillStyle = '#4a3326'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 9px ' + FONT;
  ctx.fillText('All 12 acorns found in ' + mmss(S.finishT || 0), VW / 2, y + 48);
  ctx.fillText('Golden leaves: ' + S.leaves + ' / ' + LEAVES + (S.leaves === LEAVES ? '  \u2605' : ''), VW / 2, y + 64);
  ctx.font = '700 7.5px ' + FONT; ctx.fillStyle = '#7a5a44'; ctx.fillText('Bramble is baking acorn cakes for the whole wood.', VW / 2, y + 82, w - 16);
  for (let i = 0; i < 5; i++) blit(ctx, acornSprite(), VW / 2 - 32 + i * 16, y + 100 + Math.sin(S.t * 4 + i) * 1.5, Math.cos(S.t * 2 + i), 1);
  ctx.save(); ctx.globalAlpha = .6 + .4 * Math.sin(S.t * 4); ctx.font = '800 7.5px ' + FONT; ctx.fillStyle = '#e8603f'; ctx.fillText(ROOT.classList.contains('touch-ui') ? 'Tap to keep exploring' : 'Space to keep exploring', VW / 2, y + h - 12); ctx.restore();
}
function drawTrans() {
  const T = S.trans, p = T.t / T.dur, horiz = T.dir === 'e' || T.dir === 'w', sgn = T.dir === 'e' || T.dir === 's' ? 1 : -1;
  const k = p < .5 ? ease(p * 2) : 1 + ease((p - .5) * 2);       // 0 -> 1 covering, 1 -> 2 leaving
  const span = horiz ? VW : VH, off = sgn * (1 - k) * (span + 16);
  ctx.save(); ctx.translate(horiz ? off : 0, horiz ? 0 : off);
  ctx.fillStyle = '#d8bf96'; ctx.fillRect(-4, -4, VW + 8, VH + 8);
  ctx.globalAlpha = .7; ctx.fillStyle = texFill(ctx); ctx.fillRect(-4, -4, VW + 8, VH + 8); ctx.globalAlpha = 1;
  // thick torn leading edges
  ctx.fillStyle = '#a88258';
  if (horiz) { ctx.fillRect(-10, -4, 7, VH + 8); ctx.fillRect(VW + 3, -4, 7, VH + 8); } else { ctx.fillRect(-4, -10, VW + 8, 7); ctx.fillRect(-4, VH + 3, VW + 8, 7); }
  const name = AREAS[T.to].name; ctx.font = '900 15px ' + FONT; textPaper(name, VW / 2, VH / 2, 15, '#7a4a2a');
  blit(ctx, acornSprite(), VW / 2, VH / 2 - 22, 1.2, 1.2);
  ctx.restore();
}

// ---------------------------------------------------------------- boot
function frame(dt) { update(dt); drawWorld(); drawScreen(dt); }
let last = performance.now();
function loop(now) { const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now; frame(dt); requestAnimationFrame(loop); }
window.addEventListener('resize', () => { resize(); restStick(); });
resize(); restStick(); ROOT.classList.add('tw-title');
const at = QS.get('at');
if (SHOT) { NPCS.bramble.x = 166; NPCS.bramble.y = 140; AREAS.clearing.items[1].x = 300; AREAS.clearing.items[1].y = 150; enterArea('clearing', 202, 146); { const C = AREAS.clearing; C.props = C.props.filter(p => !((p.k === 'flowers' || p.k === 'fern') && Math.hypot(p.x - 195, p.y - 125) < 60)); } S.facing = S.flip = -1; NPCS.bramble.flip = 1; S.t = 1.2; }
else if (at && AREAS[at]) { enterArea(at, +QS.get('x') || AREAS[at].w / 2, +QS.get('y') || 300); }
else enterArea('clearing', 240, 316);
if (at && QS.has('play')) start();
requestAnimationFrame(loop);
// small public surface for wrappers (e.g. a handheld overlay) and tests
window.Thimblewood = {
  setTouchUI,
  state: () => ({ mode: S.mode, area: S.area, x: Math.round(S.px), y: Math.round(S.py), acorns: S.acorns, leaves: S.leaves, dialog: S.dlg ? S.dlg.name : null, trans: !!S.trans }),
};
if (QS.has('debug')) window.Thimblewood._debug = { S, AREAS, NPCS, OBJS, canStand, clampBounds, GT, PR };
})();
