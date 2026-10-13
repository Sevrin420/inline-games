/* DEATH RACE client: Mode 7 renderer, sprite-stacked cars, networking, HUD, shop. */
(function () {
'use strict';
const S = window.DRShared;
let W = 480; const H = 270, HOR = 88, F = 252, CH = 21, CAMD = 44, ZMAX = 1500;
const cv = document.getElementById('view'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerp = (a, b, t) => a + (b - a) * t;
const ITEM_ICON = { boost: '⚡', shield: '🛡️', rockets: '🚀', repair: '🔧', cash: '💰', mine: '💣' };
let COLORS = ['#ff3b30', '#22d3ee', '#facc15', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#e5e7eb', '#3b82f6', '#84cc16',
  '#f43f5e', '#14b8a6', '#eab308', '#8b5cf6', '#10b981', '#fb923c', '#d946ef', '#94a3b8', '#0ea5e9', '#65a30d'];
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbs(r, g, b, a) { return a == null ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function shade(hex, k) { const [r, g, b] = hexRGB(hex); return k >= 0 ? rgbs(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : rgbs(r * (1 + k), g * (1 + k), b * (1 + k)); }
const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;

// ================= ground textures =================
function makeTex(fn, seed) {
  const N = 64, [c, x] = mk(N, N), r = rng(seed); fn(x, r, N);
  const d = x.getImageData(0, 0, N, N).data, out = new Uint32Array(N * N), far = new Uint32Array(N * N);
  for (let i = 0; i < N * N; i++) out[i] = pack(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  // box-blurred copy for distant rows (kills shimmer)
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    let R = 0, G = 0, B = 0;
    for (let k = 0; k < 16; k++) { const j = (((y + (k >> 2) - 1) & 63) * N + ((xx + (k & 3) - 1) & 63)) * 4; R += d[j]; G += d[j + 1]; B += d[j + 2]; }
    far[y * N + xx] = pack(R >> 4, G >> 4, B >> 4);
  }
  return [out, far];
}
function tnoise(x, r, N, base, amt, cnt) { for (let i = 0; i < cnt; i++) { const v = (r() - 0.5) * amt; x.fillStyle = rgbs(base[0] + v, base[1] + v, base[2] + v * 1.2); x.fillRect((r() * N) | 0, (r() * N) | 0, 1 + (r() < 0.3 ? 1 : 0), 1); } }
const TEX = {
  asph: makeTex((x, r, N) => {
    x.fillStyle = '#3a3646'; x.fillRect(0, 0, N, N); tnoise(x, r, N, [58, 54, 70], 26, 2600);
    x.fillStyle = 'rgba(20,16,28,.5)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(r() * N, r() * N, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(18,14,24,.9)'; x.lineWidth = 1;
    for (let i = 0; i < 4; i++) { let px = r() * N, py = r() * N; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 14; py += (r() - 0.5) * 14; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = 'rgba(120,110,140,.25)'; for (let i = 0; i < 30; i++) x.fillRect(r() * N, r() * N, 1, 1);
  }, 11),
  side: makeTex((x, r, N) => {
    x.fillStyle = '#6d6478'; x.fillRect(0, 0, N, N); tnoise(x, r, N, [112, 102, 124], 22, 1500);
    x.fillStyle = '#4a4254'; for (let i = 0; i < N; i += 16) { x.fillRect(i, 0, 1, N); x.fillRect(0, i, N, 1); }
    x.fillStyle = 'rgba(40,30,40,.5)'; for (let i = 0; i < 3; i++) x.fillRect(((r() * 4) | 0) * 16 + 1, ((r() * 4) | 0) * 16 + 1, 15, 15);
  }, 23),
  dirt: makeTex((x, r, N) => {
    x.fillStyle = '#4a3a38'; x.fillRect(0, 0, N, N); tnoise(x, r, N, [84, 66, 58], 34, 2400);
    for (let i = 0; i < 26; i++) { const v = 60 + r() * 70; x.fillStyle = rgbs(v, v * 0.85, v * 0.8); x.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 2); }
    x.fillStyle = 'rgba(30,20,20,.6)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(r() * N, r() * N, 2 + r() * 4, 0, 7); x.fill(); }
    x.fillStyle = '#5a6a3a'; for (let i = 0; i < 40; i++) x.fillRect(r() * N, r() * N, 1, 2);
  }, 37),
  lot: makeTex((x, r, N) => {
    x.fillStyle = '#2a2430'; x.fillRect(0, 0, N, N); tnoise(x, r, N, [44, 38, 50], 18, 1800);
    x.fillStyle = '#bdb48a'; for (let i = 0; i < N; i += 32) x.fillRect(i, 0, 1, N);
  }, 41)
};
const C = {
  yellow: pack(255, 206, 40), white: pack(232, 228, 240), curbA: pack(200, 196, 206), curbB: pack(190, 40, 60), base: pack(16, 12, 22), stop: pack(240, 236, 245)
};

// ================= sky =================
const sky = (() => {
  const SW = 1600, [c, x] = mk(SW, HOR + 2), r = rng(5);
  const g = x.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, '#12002a'); g.addColorStop(0.35, '#3d0a5a'); g.addColorStop(0.62, '#a3185f'); g.addColorStop(0.82, '#ff5a3c'); g.addColorStop(1, '#ffb347');
  x.fillStyle = g; x.fillRect(0, 0, SW, HOR + 2);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; x.fillRect(r() * SW, r() * HOR * 0.4, 1, 1); }
  // two synthwave suns (sky wraps around 360)
  for (const sx of [400, 1200]) {
    const sg = x.createLinearGradient(0, HOR - 64, 0, HOR); sg.addColorStop(0, '#fff27a'); sg.addColorStop(0.5, '#ff9a3c'); sg.addColorStop(1, '#ff2f78');
    x.fillStyle = sg; x.beginPath(); x.arc(sx, HOR - 6, 46, Math.PI, 0); x.fill();
    x.fillStyle = 'rgba(255,90,60,1)';
    for (let k = 0; k < 7; k++) { const yy = HOR - 30 + k * 4.6; x.globalCompositeOperation = 'destination-out'; x.fillRect(sx - 50, yy, 100, 1 + k * 0.45); x.globalCompositeOperation = 'source-over'; }
  }
  // repaint gradient behind the cut sun stripes
  x.globalCompositeOperation = 'destination-over'; x.fillStyle = g; x.fillRect(0, 0, SW, HOR + 2); x.globalCompositeOperation = 'source-over';
  // smoke plumes
  for (let i = 0; i < 7; i++) {
    const px = r() * SW, w = 18 + r() * 30;
    for (let k = 0; k < 26; k++) { x.fillStyle = `rgba(${30 + k},${10 + k},${30 + k},${0.08 + r() * 0.08})`; x.beginPath(); x.arc(px + Math.sin(k * 0.5) * 8 + k * 2.4, HOR - 8 - k * 2.6, w * (0.3 + k / 40), 0, 7); x.fill(); }
  }
  // far skyline
  const layer = (col, win, hMin, hMax, y0) => {
    for (let px = 0; px < SW;) {
      const bw = 8 + r() * 26, bh = hMin + r() * (hMax - hMin);
      x.fillStyle = col; x.fillRect(px, HOR - bh + y0, bw, bh);
      if (r() < 0.2) x.fillRect(px + bw / 2 - 1, HOR - bh - 8 + y0, 1, 8);
      if (r() < 0.25) { x.fillRect(px + 2, HOR - bh - 3 + y0, bw - 4, 3); }
      if (r() < 0.12) { x.clearRect(px + bw * 0.3, HOR - bh + y0, bw * 0.4, bh * 0.25); x.fillStyle = col; } // broken top
      for (let wy = HOR - bh + 3 + y0; wy < HOR - 2; wy += 3) for (let wx = px + 2; wx < px + bw - 2; wx += 3) if (r() < win) { x.fillStyle = r() < 0.7 ? '#ffcf6a' : '#ff5ad0'; x.fillRect(wx, wy, 1, 1); }
      x.fillStyle = col; px += bw + (r() < 0.2 ? r() * 10 : 0);
    }
  };
  layer('#3a1450', 0.04, 10, 40, 0); layer('#1e0a2e', 0.08, 6, 30, 1);
  // fires on the horizon
  for (let i = 0; i < 10; i++) { const px = r() * SW, fg = x.createRadialGradient(px, HOR, 0, px, HOR, 22); fg.addColorStop(0, 'rgba(255,170,60,.8)'); fg.addColorStop(1, 'rgba(255,60,30,0)'); x.fillStyle = fg; x.fillRect(px - 22, HOR - 22, 44, 24); }
  return { c, SW };
})();
const FOG = [255, 120, 90];

// ================= building textures =================
const SIGNS = ['MOTEL', 'ARCADE', 'VIDEO', 'PAWN', 'DINER', 'GUNS', 'BAR', 'DISCO', 'LIQUOR', 'HOTEL', 'GARAGE', 'RADIO', 'PIZZA', 'GYM', 'CINEMA', 'TAXI'];
const WALLC = ['#5a2f4a', '#3f3a5c', '#6a4a3a', '#2f4a5a', '#5a5a6a', '#4a2a2a', '#3a4a3a', '#6a3a5a', '#2a2a40', '#705040'];
const NEON = ['#ff2fa0', '#29e6ff', '#ffe24a', '#7dff6a', '#ff6a2a', '#c86aff'];
const bCache = new Map();
function buildingTex(id, len, ht) {
  let t = bCache.get(id); if (t) return t;
  const r = rng(id * 2654435761), TW = Math.max(8, Math.round(len * 1.6)), TH = Math.max(8, Math.round(ht * 1.6));
  const [c, x] = mk(TW, TH);
  const wc = WALLC[(r() * WALLC.length) | 0];
  x.fillStyle = wc; x.fillRect(0, 0, TW, TH);
  // brick / panel noise
  for (let i = 0; i < TW * TH / 6; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.05)'; x.fillRect(r() * TW, r() * TH, 2, 1); }
  const style = r();
  // floors
  const fh = 12 + ((r() * 4) | 0), ww = 5 + ((r() * 3) | 0), gap = 4 + ((r() * 3) | 0);
  for (let fy = 6; fy < TH - 22; fy += fh) {
    x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, fy + fh - 2, TW, 1);
    for (let wx = 3; wx < TW - ww - 2; wx += ww + gap) {
      const k = r(); let col;
      if (k < 0.18) col = '#ffcf6a'; else if (k < 0.24) col = NEON[(r() * NEON.length) | 0]; else if (k < 0.5) col = '#1a1626'; else if (k < 0.62) col = '#000'; else col = '#2c2a44';
      x.fillStyle = col; x.fillRect(wx, fy + 2, ww, fh - 6);
      if (col === '#000' && r() < 0.6) { x.fillStyle = '#6a5040'; x.fillRect(wx, fy + 3, ww, 2); x.fillRect(wx, fy + fh - 7, ww, 2); } // boarded
      if (col === '#ffcf6a') { x.fillStyle = 'rgba(255,240,180,.5)'; x.fillRect(wx, fy + 2, ww, 1); }
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(wx, fy + fh - 4, ww, 1);
    }
  }
  if (style < 0.35) { // fire escape
    x.strokeStyle = '#1a1420'; x.lineWidth = 1;
    const ex = (r() * (TW - 20)) | 0 + 4;
    for (let fy = 6 + fh - 3; fy < TH - 22; fy += fh) { x.strokeRect(ex + 0.5, fy + 0.5, 16, 0); for (let k = 0; k < 16; k += 3) x.fillRect(ex + k, fy - 4, 1, 4); x.beginPath(); x.moveTo(ex + 2, fy); x.lineTo(ex + 14, fy + fh); x.stroke(); }
  }
  // storefront ground floor
  const sf = TH - 20;
  x.fillStyle = '#15101c'; x.fillRect(0, sf, TW, 20);
  for (let sx = 2; sx < TW - 10; sx += 18 + ((r() * 10) | 0)) {
    const shut = r() < 0.5;
    x.fillStyle = shut ? '#5a5866' : '#2a3a5a'; x.fillRect(sx, sf + 5, 14, 15);
    if (shut) { x.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 15; k += 2) x.fillRect(sx, sf + 5 + k, 14, 1); }
    else { x.fillStyle = 'rgba(160,220,255,.35)'; x.fillRect(sx + 1, sf + 6, 3, 8); }
  }
  // awning
  if (r() < 0.6) { const ac = NEON[(r() * NEON.length) | 0]; for (let k = 0; k < TW; k += 4) { x.fillStyle = (k / 4) & 1 ? ac : '#eee'; x.fillRect(k, sf, 4, 4); } }
  // neon sign
  if (r() < 0.8) {
    const word = SIGNS[(r() * SIGNS.length) | 0], nc = NEON[(r() * NEON.length) | 0];
    const fs = 8 + ((r() * 4) | 0);
    x.font = `bold ${fs}px monospace`; const tw = x.measureText(word).width;
    if (tw < TW - 6) {
      const vy = r() < 0.5 ? sf - 4 : 6 + fs;
      const sx = 3 + r() * (TW - tw - 6);
      x.fillStyle = '#0a0612'; x.fillRect(sx - 2, vy - fs, tw + 4, fs + 3);
      x.shadowColor = nc; x.shadowBlur = 6; x.fillStyle = nc; x.fillText(word, sx, vy); x.shadowBlur = 0;
      x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText(word, sx, vy - 0.5);
      x.fillStyle = nc; x.globalAlpha = 0.6; x.fillText(word, sx, vy); x.globalAlpha = 1;
    }
  }
  // graffiti & scorch
  for (let i = 0; i < 3; i++) if (r() < 0.6) { x.strokeStyle = NEON[(r() * 6) | 0]; x.lineWidth = 1; x.beginPath(); let gx = r() * TW, gy = sf + 6 + r() * 10; x.moveTo(gx, gy); for (let k = 0; k < 6; k++) { gx += 2 + r() * 3; gy += (r() - 0.5) * 6; x.lineTo(gx, gy); } x.stroke(); }
  for (let i = 0; i < 2; i++) if (r() < 0.6) { const gx = r() * TW, gy = r() * TH * 0.7, gr = x.createRadialGradient(gx, gy, 0, gx, gy, 14); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(gx - 14, gy - 14, 28, 28); }
  // roof edge + rooftop junk
  x.fillStyle = shade(wc, -0.4); x.fillRect(0, 0, TW, 3); x.fillStyle = shade(wc, 0.3); x.fillRect(0, 3, TW, 1);
  // dusk light from the sun side
  const lg = x.createLinearGradient(0, 0, 0, TH); lg.addColorStop(0, 'rgba(255,120,90,.18)'); lg.addColorStop(1, 'rgba(20,0,40,.35)'); x.fillStyle = lg; x.fillRect(0, 0, TW, TH);
  const ao = x.createLinearGradient(0, TH - 26, 0, TH); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = ao; x.fillRect(0, TH - 26, TW, 26);
  const sideL = x.createLinearGradient(0, 0, TW, 0); sideL.addColorStop(0, 'rgba(255,140,100,.10)'); sideL.addColorStop(1, 'rgba(30,0,60,.18)'); x.fillStyle = sideL; x.fillRect(0, 0, TW, TH);
  // soft light halo around lit windows
  x.globalCompositeOperation = 'lighter';
  const d0 = x.getImageData(0, 0, TW, TH).data;
  for (let k = 0; k < 40; k++) { const px = (r() * TW) | 0, py = (r() * (TH - 20)) | 0, i = (py * TW + px) * 4; if (d0[i] > 200 && d0[i + 1] > 150) { const hg = x.createRadialGradient(px, py, 0, px, py, 8); hg.addColorStop(0, 'rgba(255,200,120,.25)'); hg.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = hg; x.fillRect(px - 8, py - 8, 16, 16); } }
  x.globalCompositeOperation = 'source-over';
  t = { c, TW, TH, fire: r() < 0.22, fx: r() };
  if (bCache.size > 260) bCache.delete(bCache.keys().next().value);
  bCache.set(id, t); return t;
}
function buildingsInBlock(b) {
  // returns list of {y0,y1,ht,id} for one side of block b
  const out = []; let y = b * S.BLOCK + S.CROSS_W; const end = (b + 1) * S.BLOCK;
  let k = 0;
  while (y < end - 8) {
    const len = Math.min(end - y, 60 + S.hash(b * 31 + k * 7) * 90);
    out.push({ y0: y, y1: y + len, k }); y += len; k++;
  }
  return out;
}

// ================= sprites =================
function zombieSprites() {
  const frames = [];
  const draw = (brute, f, back) => {
    const w = brute ? 18 : 12, h = brute ? 24 : 18, [c, x] = mk(w, h);
    const skin = brute ? '#8a6aa0' : '#7fae5a', dark = brute ? '#5a3a70' : '#4f7a34', cloth = brute ? '#3a2a20' : ['#5a3a6a', '#3a5a7a', '#7a3a3a'][f % 3];
    const cx = w / 2, step = f & 1 ? 1 : -1;
    // legs
    x.fillStyle = '#2a2230'; x.fillRect(cx - 3, h - 6, 2, 6 + step); x.fillRect(cx + 1, h - 6, 2, 6 - step);
    // torso
    x.fillStyle = cloth; x.fillRect(cx - 4 - (brute ? 2 : 0), h * 0.42, 8 + (brute ? 4 : 0), h * 0.36);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx - 4, h * 0.65, 3, 2);
    x.fillStyle = '#8a1010'; x.fillRect(cx + 1, h * 0.5, 2, 2);
    // arms reaching forward
    x.fillStyle = skin; if (!back) { x.fillRect(cx - 6 - (brute ? 2 : 0), h * 0.44 + step, 2, 6); x.fillRect(cx + 4 + (brute ? 2 : 0), h * 0.44 - step, 2, 6); }
    else { x.fillRect(cx - 6, h * 0.46, 2, 5); x.fillRect(cx + 4, h * 0.46, 2, 5); }
    // head
    x.fillStyle = skin; x.fillRect(cx - 3, h * 0.12, 6 + (brute ? 1 : 0), h * 0.3);
    x.fillStyle = dark; x.fillRect(cx - 3, h * 0.12, 6, 1);
    if (!back) { x.fillStyle = '#ffef5a'; x.fillRect(cx - 2, h * 0.24, 1, 1); x.fillRect(cx + 1, h * 0.24, 1, 1); x.fillStyle = '#300'; x.fillRect(cx - 1, h * 0.34, 3, 1); }
    else { x.fillStyle = dark; x.fillRect(cx - 2, h * 0.2, 4, 3); }
    // outline pass
    const d = x.getImageData(0, 0, w, h), o = x.createImageData(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if (d.data[i + 3]) { o.data.set(d.data.subarray(i, i + 4), i); continue; }
      const n = (dx, dy) => { const X = xx + dx, Y = yy + dy; return X >= 0 && Y >= 0 && X < w && Y < h && d.data[(Y * w + X) * 4 + 3]; };
      if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) { o.data[i] = 20; o.data[i + 1] = 6; o.data[i + 2] = 20; o.data[i + 3] = 255; }
    }
    x.putImageData(o, 0, 0);
    const Q = 3, [c2, x2] = mk(w * Q, h * Q); x2.drawImage(c, 0, 0, w * Q, h * Q);
    x2.globalCompositeOperation = 'source-atop';
    const g = x2.createLinearGradient(0, 0, w * Q, h * Q); g.addColorStop(0, 'rgba(255,170,120,.28)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,0,40,.5)');
    x2.fillStyle = g; x2.fillRect(0, 0, w * Q, h * Q);
    const g2 = x2.createLinearGradient(0, h * Q * 0.6, 0, h * Q); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.45)'); x2.fillStyle = g2; x2.fillRect(0, 0, w * Q, h * Q);
    return c2;
  };
  for (let b = 0; b < 2; b++) { frames[b] = []; for (let f = 0; f < 4; f++) frames[b].push([draw(b, f, false), draw(b, f, true)]); }
  return frames;
}
const ZSPR = zombieSprites();

// Sprite-stacked car: top-down layers, rendered to 32 rotation frames per colour.
const CAR_L = 26, CAR_W = 15, LAYERS = 9;
function carLayers(col) {
  const out = [];
  const body = col, lite = shade(col, 0.35), dark = shade(col, -0.45), glass = '#1b2440', chrome = '#c8c8d8';
  for (let l = 0; l < LAYERS; l++) {
    const [c, x] = mk(CAR_W, CAR_L);
    const R = (a, b, w, h, s) => { x.fillStyle = s; x.fillRect(a, b, w, h); };
    if (l <= 1) { // wheels + chassis (front = top of bitmap = +y)
      R(2, 2, 11, 22, '#1a1620');
      for (const [a, b] of [[0, 3], [11, 3], [0, 18], [11, 18]]) { R(a, b, 4, 6, '#0c0a10'); R(a + (a ? 0 : 3), b + 1, 1, 4, l ? '#55505e' : '#2a2630'); }
    } else if (l <= 4) {
      R(1, 1, 13, 24, l === 4 ? lite : body);
      R(1, 1, 13, 1, dark); R(1, 24, 13, 1, dark); R(1, 1, 1, 24, dark); R(13, 1, 1, 24, dark);
      if (l === 2) { R(0, 0, 15, 2, chrome); R(0, 24, 15, 2, chrome); R(2, 0, 1, 1, '#ddd'); R(6, 0, 1, 1, '#ddd'); R(10, 0, 1, 1, '#ddd'); }
      if (l === 3) { R(2, 0, 3, 1, '#fff6b0'); R(10, 0, 3, 1, '#fff6b0'); R(2, 25, 3, 1, '#ff2020'); R(10, 25, 3, 1, '#ff2020'); R(6, 25, 3, 1, '#ffa040'); }
      if (l === 4) { R(3, 4, 9, 2, dark); R(7, 2, 1, 6, dark); R(2, 20, 11, 1, dark); } // hood scoop + trunk seam
      if (l === 3) { R(0, 8, 1, 10, '#222'); R(14, 8, 1, 10, '#222'); for (let k = 9; k < 18; k += 3) { R(0, k, 1, 1, chrome); R(14, k, 1, 1, chrome); } } // armour plates + rivets
    } else if (l <= 6) { // cabin glass ring
      R(2, 8, 11, 11, glass); R(3, 9, 9, 9, body);
      R(3, 8, 9, 1, '#5d78b0'); R(2, 18, 11, 1, '#0d1020');
    } else { // roof + turret mount
      R(3, 9, 9, 9, l === 8 ? lite : body); R(3, 9, 9, 1, dark);
      if (l === 8) { R(5, 11, 5, 5, '#2a2a34'); R(6, 12, 3, 3, '#4a4a58'); }
    }
    // spikes on the front bumper
    if (l === 2) { x.fillStyle = '#aaa'; for (let k = 1; k < 15; k += 3) x.fillRect(k, -1 + 0, 1, 1); }
    out.push(c);
  }
  return out;
}
const SQUASH = 0.42, LAYER_H = 1.25, NANG = 32;
const carFrameCache = new Map();
function carFrames(ci) {
  let f = carFrameCache.get(ci); if (f) return f;
  const layers = carLayers(COLORS[ci] || '#ff3b30'); f = [];
  const Q = 3, size = 40 * Q, cxp = size / 2, cyp = size - 12 * Q;
  // pre-shade each slice: lower slices darker (ambient occlusion), upper slices catch the sunset
  const shaded = layers.map((L, l) => {
    const [c, x] = mk(CAR_W * Q, CAR_L * Q); x.imageSmoothingEnabled = false; x.drawImage(L, 0, 0, CAR_W * Q, CAR_L * Q);
    x.globalCompositeOperation = 'source-atop';
    const k = l / (LAYERS - 1);
    x.fillStyle = `rgba(10,0,25,${0.55 * (1 - k)})`; x.fillRect(0, 0, CAR_W * Q, CAR_L * Q);
    if (l >= 4) { const g = x.createLinearGradient(0, 0, 0, CAR_L * Q); g.addColorStop(0, 'rgba(255,190,140,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,90,140,.25)'); x.fillStyle = g; x.fillRect(0, 0, CAR_W * Q, CAR_L * Q); }
    return c;
  });
  for (let a = 0; a < NANG; a++) {
    const [c, x] = mk(size, size); x.imageSmoothingEnabled = true; const ang = a / NANG * Math.PI * 2;
    const sg = x.createRadialGradient(cxp, cyp + Q, 0, cxp, cyp + Q, 16 * Q); sg.addColorStop(0, 'rgba(0,0,0,.6)'); sg.addColorStop(0.6, 'rgba(0,0,0,.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sg; x.save(); x.translate(cxp, cyp + Q); x.scale(1, 0.5); x.translate(-cxp, -cyp - Q); x.fillRect(0, 0, size, size); x.restore();
    for (let l = 0; l < LAYERS; l++) {
      for (let s = 0; s < 3; s++) {
        x.save(); x.translate(cxp, cyp - (l * LAYER_H + s * 0.42) * Q); x.scale(1, SQUASH); x.rotate(ang);
        x.drawImage(shaded[l], -CAR_W * Q / 2, -CAR_L * Q / 2); x.restore();
      }
    }
    // specular glint on the roof
    x.globalCompositeOperation = 'source-atop';
    const hg = x.createRadialGradient(cxp - 4 * Q, cyp - 13 * Q, 0, cxp - 4 * Q, cyp - 13 * Q, 9 * Q); hg.addColorStop(0, 'rgba(255,240,220,.35)'); hg.addColorStop(1, 'rgba(255,240,220,0)'); x.fillStyle = hg; x.fillRect(0, 0, size, size);
    x.globalCompositeOperation = 'source-over';
    f.push(c);
  }
  carFrameCache.set(ci, f); return f;
}
function propSprites() {
  const P = {};
  { // street lamp
    const [c, x] = mk(14, 46); x.fillStyle = '#2a2232'; x.fillRect(6, 6, 2, 40); x.fillRect(2, 5, 9, 2); x.fillStyle = '#ffe9a0'; x.fillRect(1, 7, 4, 2);
    x.fillStyle = 'rgba(255,220,140,.35)'; x.beginPath(); x.arc(3, 8, 4, 0, 7); x.fill(); P.lamp = c;
  }
  { // palm tree
    const [c, x] = mk(36, 64); x.strokeStyle = '#3a2a24'; x.lineWidth = 3; x.beginPath(); x.moveTo(18, 64); x.quadraticCurveTo(13, 34, 19, 10); x.stroke();
    x.fillStyle = '#4a3428'; for (let k = 14; k < 62; k += 4) x.fillRect(15 + (64 - k) * 0.06, k, 5, 1);
    x.fillStyle = '#1c3a2a';
    for (let a = 0; a < 7; a++) { const an = -Math.PI / 2 + (a - 3) * 0.5; x.save(); x.translate(19, 10); x.rotate(an); for (let k = 0; k < 16; k++) { x.fillRect(k, Math.sin(k / 5) * 3 + k * 0.25, 2, 2 + (k < 10 ? 1 : 0)); } x.restore(); }
    x.fillStyle = 'rgba(255,90,90,.18)'; x.fillRect(0, 0, 36, 20); P.palm = c;
  }
  { // burning barrel
    const [c, x] = mk(10, 14); x.fillStyle = '#4a3a30'; x.fillRect(1, 5, 8, 9); x.fillStyle = '#2a201c'; x.fillRect(1, 8, 8, 1); x.fillRect(1, 11, 8, 1); P.barrel = c;
  }
  for (const [k, col] of [['wreck0', '#4a3a3a'], ['wreck1', '#3a4458']]) { // burnt-out cars
    const [c, x] = mk(30, 18); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(1, 14, 28, 4);
    x.fillStyle = col; x.fillRect(2, 6, 26, 9); x.fillRect(7, 2, 15, 5); x.fillStyle = '#120c10'; x.fillRect(8, 3, 6, 3); x.fillRect(15, 3, 6, 3);
    x.fillStyle = '#7a3a1a'; for (let i = 0; i < 20; i++) x.fillRect(2 + Math.random() * 26, 6 + Math.random() * 9, 2, 1);
    x.fillStyle = '#111'; x.fillRect(4, 13, 6, 4); x.fillRect(20, 13, 6, 4); P[k] = c;
  }
  { // billboard
    const [c, x] = mk(52, 40); x.fillStyle = '#222'; x.fillRect(12, 20, 2, 20); x.fillRect(38, 20, 2, 20);
    x.fillStyle = '#ff2fa0'; x.fillRect(0, 0, 52, 24); x.fillStyle = '#12002a'; x.fillRect(2, 2, 48, 20);
    x.font = 'bold 8px monospace'; x.fillStyle = '#ffe24a'; x.fillText('TURN', 6, 11); x.fillStyle = '#29e6ff'; x.fillText('BACK', 24, 19);
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(30, 2, 8, 9); P.board = c;
  }
  { // crate pickup
    const [c, x] = mk(14, 14); x.fillStyle = '#ffe24a'; x.fillRect(0, 0, 14, 14); x.fillStyle = '#ff2fa0'; x.fillRect(1, 1, 12, 12); x.fillStyle = '#ffe24a'; x.font = 'bold 11px monospace'; x.fillText('?', 4, 11); P.crate = c;
  }
  return P;
}
const PROP = propSprites();
const ITEM_COL = ['#29e6ff', '#7dff6a', '#ff6a2a', '#ff5a5a', '#ffe24a', '#c86aff'];

// ================= networking =================
let ws = null, myCar = 0, myRole = '', joined = false, connected = false;
let snaps = [], meta = { cars: [], results: null, players: 0 }, lastSnapAt = 0;
const carMeta = (id) => meta.cars.find((c) => c.id === id);
function wsURL() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/death-race/ws';
}
let pendingJoin = null;
function connect() {
  try { ws = new WebSocket(wsURL()); } catch (e) { setTimeout(connect, 2000); return; }
  ws.onopen = () => { connected = true; $('status').textContent = 'online · pick a seat'; if (pendingJoin) send(pendingJoin); else send({ t: 'spec' }); };
  ws.onclose = () => { connected = false; $('status').textContent = 'reconnecting…'; setTimeout(connect, 1500); };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 's') { m.at = performance.now(); snaps.push(m); if (snaps.length > 8) snaps.shift(); lastSnapAt = m.at; handleFx(m.fx); }
    else if (m.t === 'm') { meta = m; if (!$('shop').classList.contains('hidden')) renderShop(); }
    else if (m.t === 'you') { myCar = m.car; myRole = m.role; joined = true; if (m.colors) COLORS = m.colors; onJoined(); }
    else if (m.t === 'full') $('status').textContent = 'Race is full (20 cars). Try again soon.';
  };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

// ================= interpolation =================
const DELAY = 90;
function sampleWorld(now) {
  if (!snaps.length) return null;
  const rt = now - DELAY;
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].at <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const span = b.at - a.at, t = span > 0 ? clamp((rt - a.at) / span, 0, 1.3) : 1;
  const latest = snaps[snaps.length - 1];
  const amap = new Map(a.cars.map((c) => [c[0], c]));
  const cars = b.cars.map((cb) => {
    const ca = amap.get(cb[0]) || cb;
    let x = lerp(ca[1], cb[1], t), y = lerp(ca[2], cb[2], t), h = ca[3] + wrapA(cb[3] - ca[3]) * t;
    if (cb[0] === myCar) { // own car: newest state, extrapolated
      const cl = latest.cars.find((c) => c[0] === myCar) || cb, dt = Math.min(0.12, (now - latest.at) / 1000);
      h = cl[3]; x = cl[1] + Math.sin(h) * cl[4] * dt; y = cl[2] + Math.cos(h) * cl[4] * dt;
    }
    return { id: cb[0], x, y, h, spd: cb[4], hp: cb[5], maxhp: cb[6], fl: cb[7], aim: cb[8], cash: cb[9], ci: cb[10], kills: cb[11], item: cb[12] };
  });
  const zam = new Map(a.z.map((z) => [z[0], z]));
  const zombies = b.z.map((zb) => { const za = zam.get(zb[0]) || zb; return { id: zb[0], x: lerp(za[1], zb[1], t), y: lerp(za[2], zb[2], t), d: zb[3], k: zb[4] }; });
  const dtb = (rt - b.at) / 1000;
  const bullets = b.b.map((q) => ({ x: q[0] + q[2] * Math.max(-0.07, dtb), y: q[1] + q[3] * Math.max(-0.07, dtb), vx: q[2], vy: q[3], rk: q[4] }));
  return { ph: latest.ph, tl: latest.tl - (now - latest.at) / 1000, fy: lerp(a.fy, b.fy, t), race: latest.race, cars, zombies, bullets, pickups: b.p, mines: b.m };
}

// ================= particles / fx =================
const parts = [];
let shake = 0;
function addP(o) { if (parts.length < 900) parts.push(o); }
function handleFx(list) {
  if (!list) return;
  for (const [type, x, y, a] of list) {
    const near = camState.ok ? Math.hypot(x - camState.x, y - camState.y) : 999;
    if (type === 'boom') { for (let i = 0; i < 26; i++) addP({ x, y, z: 3, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, vz: 20 + Math.random() * 50, life: 0.6 + Math.random() * 0.6, max: 1.2, k: i < 10 ? 'smoke' : 'fire', s: 3 + Math.random() * 4 }); if (near < 150) { shake = Math.max(shake, a ? 6 : 3); sfx('boom'); } }
    else if (type === 'splat') { for (let i = 0; i < 12; i++) addP({ x, y, z: 4, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, vz: 10 + Math.random() * 40, life: 0.5, max: 0.5, k: 'goo', s: 2 }); if (near < 120) sfx('splat'); }
    else if (type === 'blood') { for (let i = 0; i < 4; i++) addP({ x, y, z: 6, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, vz: 20, life: 0.3, max: 0.3, k: 'goo', s: 1.5 }); }
    else if (type === 'hit' || type === 'spark') { for (let i = 0; i < 6; i++) addP({ x, y, z: 5, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, vz: 30 + Math.random() * 30, life: 0.25, max: 0.25, k: 'spark', s: 1.2 }); if (near < 60 && type === 'hit') shake = Math.max(shake, 1.5); }
    else if (type === 'burn') { addP({ x, y, z: 4, vx: 0, vy: 0, vz: 30, life: 0.6, max: 0.6, k: 'fire', s: 4 }); }
    else if (type === 'turbo') { for (let i = 0; i < 10; i++) addP({ x, y, z: 3, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, vz: 10, life: 0.4, max: 0.4, k: a > 1 ? 'spark' : 'blue', s: 2 }); if (near < 30) sfx('turbo'); }
    else if (type === 'pick') { for (let i = 0; i < 12; i++) addP({ x, y, z: 6, vx: Math.cos(i) * 40, vy: Math.sin(i) * 40, vz: 20, life: 0.5, max: 0.5, k: 'star', s: 2 }); if (near < 40) sfx('pick'); }
    else if (type === 'rocket' && near < 40) sfx('rocket');
  }
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.k === 'smoke' || p.k === 'fire' ? -10 : 90) * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } }
}

// ================= camera + projection =================
const camState = { x: 0, y: -60, h: 0, ok: false, fx: 0, fy: 1, rx: 1, ry: 0 };
function setCam(target, dt, turret) {
  // driver: chase cam behind the car. gunner: turret cam riding the roof, facing the gun.
  const h = turret ? target.h + turretAim : target.h;
  camState.h = camState.ok ? camState.h + wrapA(h - camState.h) * Math.min(1, dt * (turret ? 22 : 7)) : h;
  const fx = Math.sin(camState.h), fy = Math.cos(camState.h);
  const back = turret ? -3 : CAMD;
  const tx = target.x - fx * back, ty = target.y - fy * back;
  if (!camState.ok || Math.hypot(tx - camState.x, ty - camState.y) > 200) { camState.x = tx; camState.y = ty; }
  else { camState.x = lerp(camState.x, tx, Math.min(1, dt * 14)); camState.y = lerp(camState.y, ty, Math.min(1, dt * 14)); }
  camState.ok = true;
  camState.fx = fx; camState.fy = fy; camState.rx = fy; camState.ry = -fx;
}
function proj(wx, wy) {
  const dx = wx - camState.x, dy = wy - camState.y;
  const z = dx * camState.fx + dy * camState.fy; if (z < 3) return null;
  const xl = dx * camState.rx + dy * camState.ry, s = F / z;
  return { sx: W / 2 + xl * s, sy: HOR + CH * s, s, z };
}

// ================= ground =================
const GH = H - HOR;
let gImg = ctx.createImageData(W, GH), gBuf = new Uint32Array(gImg.data.buffer);
const TN = 2400, cT = new Float32Array(TN), hT = new Float32Array(TN);
function drawGround() {
  const cx = camState.x, cy = camState.y, fx = camState.fx, fy = camState.fy, rx = camState.rx, ry = camState.ry;
  const base = Math.floor(cy - 700) ;
  for (let i = 0; i < TN; i++) { cT[i] = S.center(base + i); hT[i] = S.halfWidth(base + i); }
  const BL = S.BLOCK, CW = S.CROSS_W, SW = S.SIDEWALK, WL = S.WALL;
  const A = TEX.asph, SD = TEX.side, DR = TEX.dirt, LT = TEX.lot;
  let p = 0;
  for (let r = 0; r < GH; r++) {
    const z = CH * F / (r + 0.6);
    const fa = Math.min(1, Math.pow(z / ZMAX, 1.25)), fi = 1 - fa;
    const fr = FOG[0] * fa, fg = FOG[1] * fa, fb = FOG[2] * fa;
    const far = z > 260 ? 1 : 0;
    const step = z / F, lat0 = -W / 2 * step;
    let wx = cx + fx * z + rx * lat0, wy = cy + fy * z + ry * lat0;
    const dwx = rx * step, dwy = ry * step;
    const ta = far ? A[1] : A[0], ts = far ? SD[1] : SD[0], td = far ? DR[1] : DR[0], tl = far ? LT[1] : LT[0];
    const lineTol = Math.max(0.6, step * 0.7);
    for (let c = 0; c < W; c++, wx += dwx, wy += dwy) {
      let i = (wy - base) | 0; if (i < 0) i = 0; else if (i >= TN) i = TN - 1;
      const dx = wx - cT[i], ad = dx < 0 ? -dx : dx, hw = hT[i];
      const m = wy - Math.floor(wy / BL) * BL;
      const tu = (wx * 2) & 63, tv = (wy * 2) & 63, ti = (tv << 6) | tu;
      let col;
      if (ad < hw) {
        col = ta[ti];
        if (m < CW) {
          if ((m > 4 && m < 14) && (((dx + 200) / 3) | 0) % 2 === 0) col = C.white;
          else if (m > CW - 6 && m < CW - 3 && dx < 0) col = C.stop;
        } else {
          const ml = wy % 40;
          if (ad < 1.6 && ad > 0.4 && (ml < 0 ? ml + 40 : ml) < 24) col = C.yellow;
          else { const ld = ad - hw * 0.5, ml2 = wy % 30; if (ld < lineTol && ld > -lineTol && (ml2 < 0 ? ml2 + 30 : ml2) < 12) col = C.white; else if (ad > hw - 2.6 && ad < hw - 1.4) col = C.white; }
        }
      } else if (m < CW && ad < hw + WL + 170) {
        col = ad < hw + WL + 168 ? ta[ti] : C.base;
        const mm = m - CW / 2; if (mm < 1 && mm > -1 && (((ad) / 6) | 0) % 2 === 0) col = C.yellow;
      } else if (ad < hw + 2.2) col = (((wy / 6) | 0) & 1) ? C.curbA : C.curbB;
      else if (ad < hw + SW) col = ts[ti];
      else if (ad < hw + WL) col = (ad > hw + WL - 3) ? C.base : (m > BL - 160 && m < BL - 60 ? tl[ti] : td[ti]);
      else col = C.base;
      let sh = 1;
      if (ad < hw) { const e = ad / hw; sh = 1.08 - e * e * e * e * 0.3; }
      else { const wd2 = hw + WL - ad; if (wd2 < 10 && wd2 > 0) sh = 0.55 + wd2 * 0.045; else if (ad < hw + 5) sh = 0.85; }
      if (sh !== 1) { col = (col & 0xff000000) | (Math.min(255, ((col >> 16) & 255) * sh) << 16) | (Math.min(255, ((col >> 8) & 255) * sh) << 8) | Math.min(255, (col & 255) * sh); }
      gBuf[p++] = (255 << 24) | (((((col >> 16) & 255) * fi + fb) | 0) << 16) | (((((col >> 8) & 255) * fi + fg) | 0) << 8) | ((((col & 255) * fi + fr) | 0));
    }
  }
  ctx.putImageData(gImg, 0, HOR);
}

// ================= glow sprites =================
function glowSprite(stops) { const [c, x] = mk(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; }
const GLOW = {
  fire: glowSprite([[0, 'rgba(255,250,200,1)'], [0.25, 'rgba(255,190,70,.9)'], [0.6, 'rgba(255,70,20,.35)'], [1, 'rgba(160,0,20,0)']]),
  smoke: glowSprite([[0, 'rgba(46,34,52,.85)'], [0.6, 'rgba(40,30,46,.45)'], [1, 'rgba(30,20,40,0)']]),
  goo: glowSprite([[0, 'rgba(140,220,70,1)'], [0.5, 'rgba(70,140,30,.8)'], [1, 'rgba(40,90,20,0)']]),
  blue: glowSprite([[0, 'rgba(220,255,255,1)'], [0.3, 'rgba(41,230,255,.8)'], [1, 'rgba(0,80,255,0)']]),
  star: glowSprite([[0, 'rgba(255,255,220,1)'], [0.3, 'rgba(255,226,74,.8)'], [1, 'rgba(255,120,0,0)']]),
  spark: glowSprite([[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,210,120,.8)'], [1, 'rgba(255,90,0,0)']]),
  shadow: glowSprite([[0, 'rgba(0,0,0,.85)'], [0.6, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]),
  lamp: glowSprite([[0, 'rgba(255,230,170,.9)'], [0.4, 'rgba(255,190,110,.35)'], [1, 'rgba(255,150,80,0)']]),
  neonP: glowSprite([[0, 'rgba(255,80,190,.8)'], [1, 'rgba(255,40,160,0)']]),
  neonC: glowSprite([[0, 'rgba(60,240,255,.75)'], [1, 'rgba(0,200,255,0)']]),
  head: glowSprite([[0, 'rgba(255,250,215,.55)'], [0.5, 'rgba(255,230,170,.2)'], [1, 'rgba(255,220,150,0)']])
};
function lightPool(spr, wx, wy, rw, alpha, up) { // additive ground light / halo
  const p = proj(wx, wy); if (!p || p.z > 1000) return;
  items.push({ z: p.z + (up ? -0.2 : 0.3), f: () => {
    const r = rw * p.s; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * fogAlpha(p.z);
    if (up) ctx.drawImage(spr, p.sx - r, p.sy - up * p.s - r, r * 2, r * 2); else ctx.drawImage(spr, p.sx - r, p.sy - r * 0.32, r * 2, r * 0.64);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  } });
}
const [bloomC, bloomX] = mk(60, 34); bloomX.imageSmoothingEnabled = true;
function bloom() {
  bloomX.globalCompositeOperation = 'copy'; bloomX.drawImage(cv, 0, 0, 60, 34);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.2; ctx.drawImage(bloomC, 0, 0, W, H); ctx.globalAlpha = 0.12; ctx.drawImage(bloomC, -12, -8, W + 24, H + 16); ctx.restore();
}

// ================= world sprites =================
let items = [];
function fogAlpha(z) { const fa = Math.min(1, Math.pow(z / ZMAX, 1.25)); return 1 - fa * fa; }
function bill(img, wx, wy, worldW, up, z0, extra) {
  const p = proj(wx, wy); if (!p || p.z > ZMAX) return;
  const w = worldW * p.s, h = img.height / img.width * w;
  if (p.sx + w < -20 || p.sx - w > W + 20) return;
  items.push({ z: p.z + (z0 || 0), f: () => { ctx.globalAlpha = fogAlpha(p.z); ctx.drawImage(img, Math.round(p.sx - w / 2), Math.round(p.sy - h - (up || 0) * p.s), Math.max(1, w), Math.max(1, h)); ctx.globalAlpha = 1; if (extra) extra(p, w, h); } });
}
function wallX(y, s) { return S.center(y) + s * (S.halfWidth(y) + S.WALL); }
function addBuildings() {
  const b0 = Math.floor((camState.y - 120) / S.BLOCK), b1 = Math.floor((camState.y + ZMAX) / S.BLOCK);
  for (let b = b0; b <= b1; b++) for (const s of [-1, 1]) {
    const list = buildingsInBlock(b);
    for (const bd of list) {
      const id = (b * 64 + bd.k * 2 + (s > 0 ? 1 : 0)) & 0x7fffffff;
      const ht = 34 + S.hash(id * 3 + 1) * 100 + (S.hash(id) < 0.15 ? 60 : 0);
      if (bd.y1 < camState.y - 60) continue;
      const len = bd.y1 - bd.y0;
      const zMid = (bd.y0 + bd.y1) / 2 - camState.y;
      if (zMid > ZMAX + 100) continue;
      const t = buildingTex(id, len, ht);
      // wall pieces
      let y = bd.y0;
      while (y < bd.y1) {
        const zz = Math.abs(y - camState.y);
        const pl = clamp(zz / 9, 5, 36);
        const ya = y, yb = Math.min(bd.y1, y + pl); y = yb;
        const A = proj(wallX(ya, s), ya), B = proj(wallX(yb, s), yb);
        if (!A || !B || A.z < 5 || B.z < 5) continue;
        if ((A.sx < -4 && B.sx < -4) || (A.sx > W + 4 && B.sx > W + 4)) continue;
        const ua = s > 0 ? (bd.y1 - ya) / len * t.TW : (ya - bd.y0) / len * t.TW;
        const ub = s > 0 ? (bd.y1 - yb) / len * t.TW : (yb - bd.y0) / len * t.TW;
        items.push({ z: (A.z + B.z) / 2, f: () => drawWall(t, A, B, ua, ub, ht) });
      }
      // street-facing end (corner) face
      const fy = bd.y0;
      if (fy > camState.y + 4) {
        const wx = wallX(fy, s), P = proj(wx, fy), Q = proj(wx + s * 70, fy);
        if (P && Q) items.push({ z: P.z - 0.01, f: () => drawWall(t, P, Q, 0, Math.min(t.TW, 70 * 1.6), ht, 0.45) });
      }
      if (zMid < 900 && zMid > 0) { const nx = wallX(bd.y0 + len * 0.5, s) - s * 6; lightPool(S.hash(id * 9) < 0.5 ? GLOW.neonP : GLOW.neonC, nx, bd.y0 + len * 0.5, 30, 0.22); if (t.fire) lightPool(GLOW.fire, wallX(bd.y0 + len * t.fx, s), bd.y0 + len * t.fx, 26, 0.5, ht); }
      if (t.fire && Math.random() < 0.25 && zMid < 900) addP({ x: wallX(bd.y0 + len * t.fx, s) + s * 10, y: bd.y0 + len * t.fx, z: ht + 2, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, vz: 18, life: 1, max: 1, k: Math.random() < 0.6 ? 'fire' : 'smoke', s: 6 + Math.random() * 6 });
    }
  }
}
function drawWall(t, A, B, ua, ub, ht, dark) {
  let P = A, Q = B, u0 = ua, u1 = ub;
  if (u1 < u0) { P = B; Q = A; u0 = ub; u1 = ua; }
  const du = Math.max(0.5, u1 - u0);
  const hP = ht * P.s, hQ = ht * Q.s, hAvg = (hP + hQ) / 2;
  const a = (Q.sx - P.sx) / du, bb = (Q.sy - P.sy) / du, d = hAvg / t.TH;
  ctx.globalAlpha = fogAlpha((A.z + B.z) / 2);
  ctx.imageSmoothingEnabled = d < 1.8; // keep big close-up walls crisp, smooth the distance
  ctx.setTransform(a, bb, 0, d, P.sx, P.sy - hAvg);
  ctx.drawImage(t.c, u0, 0, Math.min(du + 0.6, t.TW - u0), t.TH, 0, 0, Math.min(du + 0.6, t.TW - u0), t.TH);
  if (dark) { ctx.fillStyle = `rgba(10,0,20,${dark})`; ctx.fillRect(0, 0, du + 0.6, t.TH); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
}
function addProps() {
  const STEP = 58, i0 = Math.floor((camState.y - 40) / STEP), i1 = Math.floor((camState.y + 1100) / STEP);
  for (let i = i0; i <= i1; i++) for (const s of [-1, 1]) {
    const y = i * STEP + 20; if (S.isCross(y)) continue;
    const h = S.hash(i * 5 + (s > 0 ? 7 : 3)), x = S.center(y) + s * (S.halfWidth(y) + S.SIDEWALK - 5);
    if (h < 0.38) { lightPool(GLOW.lamp, x - s * 4, y, 22, 0.45); lightPool(GLOW.lamp, x - s * 1, y, 5, 0.9, 30); } if (h < 0.38) bill(PROP.lamp, x + s * 2, y, 6, 0, 0, (p, w) => { if (p.z < 600 && ((performance.now() / 90 + i) | 0) % 37) { ctx.fillStyle = 'rgba(255,220,140,.12)'; ctx.beginPath(); ctx.ellipse(p.sx - s * w * 0.3, p.sy, w * 2.2, w * 0.7, 0, 0, 7); ctx.fill(); } });
    else if (h < 0.58) bill(PROP.palm, x + s * 4, y, 22);
    else if (h < 0.68) { lightPool(GLOW.fire, x, y, 16, 0.35 + Math.sin(animT * 13 + i) * 0.08); bill(PROP.barrel, x, y, 5); if (Math.random() < 0.4) addP({ x, y, z: 6, vx: 0, vy: 0, vz: 16, life: 0.5, max: 0.5, k: 'fire', s: 2.5 }); }
    else if (h < 0.72) bill(PROP.board, x + s * 10, y, 30);
  }
  const o0 = Math.floor((camState.y - 30) / S.OB_STEP), o1 = Math.floor((camState.y + 1300) / S.OB_STEP);
  for (let i = o0; i <= o1; i++) { const o = S.obstacle(i); if (o) { bill(o.kind ? PROP.wreck1 : PROP.wreck0, o.x, o.y, 24); if (S.hash(i * 3) < 0.4 && Math.random() < 0.35) addP({ x: o.x, y: o.y, z: 6, vx: 0, vy: 0, vz: 14, life: 1.1, max: 1.1, k: S.hash(i) < 0.5 ? 'smoke' : 'fire', s: 4 }); } }
}
let animT = 0;
function addEntities(wd) {
  for (const z of wd.zombies) {
    const p = proj(z.x, z.y); if (!p || p.z > 900) continue;
    const back = Math.abs(wrapA(z.d - camState.h)) < Math.PI / 2;
    const fr = ZSPR[z.k][((animT * 6 + z.id) | 0) & 3][back ? 1 : 0];
    const zw = z.k ? 8.5 : 5.5;
    items.push({ z: p.z + 0.05, f: () => { const r = zw * p.s * 0.8; ctx.globalAlpha = 0.55 * fogAlpha(p.z); ctx.drawImage(GLOW.shadow, p.sx - r, p.sy - r * 0.35, r * 2, r * 0.7); ctx.globalAlpha = 1; } });
    bill(fr, z.x, z.y, zw);
  }
  for (const q of wd.pickups) {
    const bob = 3 + Math.sin(animT * 4 + q[0]) * 1.5, col = ITEM_COL[q[3]] || '#fff';
    bill(PROP.crate, q[1], q[2], 7, bob, 0, (p, w, h) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, p.s * 0.8); ctx.globalAlpha = 0.6 + Math.sin(animT * 8) * 0.3; ctx.beginPath(); ctx.ellipse(p.sx, p.sy, w * 0.9, w * 0.35, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
  }
  for (const m of wd.mines) { const p = proj(m[0], m[1]); if (p) items.push({ z: p.z, f: () => { ctx.fillStyle = (animT * 4 | 0) & 1 ? '#ff2020' : '#400'; ctx.fillRect(p.sx - p.s * 2, p.sy - p.s * 1.5, p.s * 4, p.s * 2); } }); }
  for (const c of wd.cars) addCar(c);
  for (const b of wd.bullets) {
    const p = proj(b.x, b.y), q = proj(b.x - b.vx * (b.rk ? 0.05 : 0.025), b.y - b.vy * (b.rk ? 0.05 : 0.025)); if (!p || !q) continue;
    items.push({ z: p.z, f: () => {
      ctx.strokeStyle = b.rk ? '#ff8a2a' : '#fff27a'; ctx.lineWidth = Math.max(1, p.s * (b.rk ? 2.5 : 1));
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy - 7 * p.s); ctx.lineTo(q.sx, q.sy - 7 * q.s); ctx.stroke();
      if (b.rk) { ctx.fillStyle = '#fff'; ctx.fillRect(p.sx - 1, p.sy - 7 * p.s - 1, 2, 2); }
    } });
    if (b.rk) addP({ x: b.x, y: b.y, z: 7, vx: 0, vy: 0, vz: 4, life: 0.5, max: 0.5, k: 'smoke', s: 2 });
  }
  for (const pt of parts) {
    const p = proj(pt.x, pt.y); if (!p || p.z > 1100 || p.z < 18) continue;
    items.push({ z: p.z, f: () => {
      const a = pt.life / pt.max, sz = Math.max(1, pt.s * p.s * (pt.k === 'smoke' ? 2 - a : 1));
      let col;
      if (pt.k === 'fire') col = a > 0.6 ? '#fff27a' : a > 0.3 ? '#ff8a2a' : '#c0202a';
      else if (pt.k === 'smoke') col = `rgba(40,30,44,${0.55 * a})`;
      else if (pt.k === 'goo') col = '#5aa02a';
      else if (pt.k === 'blue') col = '#29e6ff';
      else if (pt.k === 'star') col = '#ffe24a';
      else col = '#ffd27a';
      const gs = GLOW[pt.k] || GLOW.spark, add = pt.k !== 'smoke' && pt.k !== 'goo';
      const r = sz * (add ? 1.6 : 1.2), px = p.sx + (pt.k === 'fire' ? Math.sin(pt.life * 20 + pt.x) * sz * 0.4 : 0), py = p.sy - pt.z * p.s;
      if (add) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a * 1.4); }
      else ctx.globalAlpha = pt.k === 'smoke' ? 0.7 * a : 1;
      ctx.drawImage(gs, px - r, py - r, r * 2, r * 2);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (pt.k === 'fire' && a > 0.5) { ctx.fillStyle = col; ctx.fillRect(px - sz * 0.25, py - sz * 0.25, sz * 0.5, sz * 0.5); }
    } });
  }
}
function addCar(c) {
  const p = proj(c.x, c.y); if (!p || p.z > ZMAX) return;
  const dead = c.fl & 1;
  const bearing = Math.atan2(c.x - camState.x, c.y - camState.y);
  const va = wrapA(c.h - bearing);
  const frames = carFrames(c.ci);
  const fi = ((Math.round(va / (Math.PI * 2) * NANG) % NANG) + NANG) % NANG;
  const k = 23 / 26, size = 40 * p.s * k;
  if (size < 1.5) return;
  const mine = c.id === myCar;
  if (mine && myRole === 'shoot' && joined) return; // turret view: we ride on this car
  if (c.fl & 8 && Math.random() < 0.6) { const off = (Math.random() - 0.5) * 10; addP({ x: c.x - Math.sin(c.h) * 9 + Math.cos(c.h) * off, y: c.y - Math.cos(c.h) * 9 - Math.sin(c.h) * off, z: 1, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, vz: 20, life: 0.25, max: 0.25, k: c.fl & 128 ? 'star' : c.fl & 256 ? 'spark' : 'blue', s: 1.2 }); }
  if (c.fl & 4 && Math.random() < 0.8) addP({ x: c.x - Math.sin(c.h) * 13, y: c.y - Math.cos(c.h) * 13, z: 3, vx: -Math.sin(c.h) * 30, vy: -Math.cos(c.h) * 30, vz: 4, life: 0.25, max: 0.25, k: 'fire', s: 2.5 });
  if (c.hp < c.maxhp * 0.35 && Math.random() < 0.3) addP({ x: c.x, y: c.y, z: 8, vx: 0, vy: 0, vz: 12, life: 0.9, max: 0.9, k: 'smoke', s: 3 });
  if (dead && Math.random() < 0.5) addP({ x: c.x + (Math.random() - 0.5) * 8, y: c.y, z: 4, vx: 0, vy: 0, vz: 22, life: 0.8, max: 0.8, k: Math.random() < 0.5 ? 'fire' : 'smoke', s: 4 });
  if (!dead && p.z < 700) { lightPool(GLOW.head, c.x + Math.sin(c.h) * 34, c.y + Math.cos(c.h) * 34, 30, 0.55); }
  items.push({ z: p.z, f: () => {
    const sx = p.sx - size / 2, sy = p.sy - size * (28 / 40);
    ctx.globalAlpha = fogAlpha(p.z) * ((c.fl & 16) && ((animT * 12) | 0) % 2 ? 0.45 : 1);
    if (dead) { ctx.drawImage(PROP.wreck0, p.sx - 12 * p.s, p.sy - 14 * p.s, 24 * p.s, 15 * p.s); ctx.globalAlpha = 1; return; }
    const bounce = c.spd > 20 && ((animT * 20 + c.id) | 0) % 3 === 0 ? -Math.max(0.5, p.s * 0.4) : 0;
    ctx.drawImage(frames[fi], sx, sy + bounce, size, size);
    // roof gun
    const rel = c.h + c.aim - camState.h, gx = p.sx, gy = p.sy - 11 * p.s * k * 1.25 + bounce, gl = 9 * p.s * k;
    const ex = gx + Math.sin(rel) * gl, ey = gy - Math.cos(rel) * gl * SQUASH * 1.2;
    ctx.strokeStyle = '#0c0a10'; ctx.lineWidth = Math.max(1.5, p.s * k * 3.2); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = Math.max(1, p.s * k * 1.5); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ex, ey); ctx.stroke();
    if (c.fl & 64) { ctx.fillStyle = Math.random() < 0.5 ? '#fff27a' : '#ff8a2a'; const fs = Math.max(2, p.s * 3); ctx.fillRect(ex - fs / 2 + Math.sin(rel) * fs * 0.5, ey - fs / 2, fs, fs); }
    if (c.fl & 2) { ctx.strokeStyle = `rgba(41,230,255,${0.5 + Math.sin(animT * 20) * 0.3})`; ctx.lineWidth = Math.max(1, p.s); ctx.beginPath(); ctx.ellipse(p.sx, p.sy - size * 0.3, size * 0.55, size * 0.42, 0, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (!mine && p.z < 380) {
      const m = carMeta(c.id); const nm = m ? m.name : '';
      ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(nm, p.sx + 0.5, sy - 2.5); ctx.fillStyle = (m && (m.dh || m.gh)) ? '#ffe24a' : '#ffd0f0'; ctx.fillText(nm, p.sx, sy - 3); ctx.textAlign = 'left';
      const hw = Math.max(8, size * 0.6); ctx.fillStyle = '#300'; ctx.fillRect(p.sx - hw / 2, sy - 1.5, hw, 1.5); ctx.fillStyle = '#7dff6a'; ctx.fillRect(p.sx - hw / 2, sy - 1.5, hw * c.hp / c.maxhp, 1.5);
    }
  } });
}
function drawFireHeat(wd, me) {
  if (!me || wd.ph !== 'race') return 0;
  const gap = me.y - wd.fy;
  const k = clamp(1 - gap / 260, 0, 1);
  if (k <= 0) return gap;
  ctx.fillStyle = `rgba(255,60,20,${k * 0.25})`; ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 3) {
    const n = Math.sin(x * 0.13 + animT * 9) + Math.sin(x * 0.051 - animT * 5) + Math.sin(x * 0.31 + animT * 13) * 0.5;
    const h = k * (26 + n * 10) + (k > 0.6 ? 20 * k : 0);
    const g = ctx.createLinearGradient(0, H - h, 0, H);
    g.addColorStop(0, 'rgba(255,240,120,0)'); g.addColorStop(0.3, 'rgba(255,200,60,.9)'); g.addColorStop(0.7, 'rgba(255,90,20,.95)'); g.addColorStop(1, 'rgba(160,0,20,1)');
    ctx.fillStyle = g; ctx.fillRect(x, H - h, 3, h);
  }
  return gap;
}
function drawMinimap(wd, me) {
  const mx = W - 22, my = 26, mh = 120, mw = 16;
  ctx.fillStyle = 'rgba(10,0,24,.6)'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.strokeStyle = '#ff2fa0'; ctx.lineWidth = 1; ctx.strokeRect(mx - 1.5, my - 1.5, mw + 3, mh + 3);
  const cy = me ? me.y : camState.y, ys = 1600 / mh, top = cy + 1000;
  const toY = (y) => my + (top - y) / ys;
  ctx.fillStyle = '#4a4458';
  for (let i = 0; i <= mh; i += 2) { const y = top - i * ys; ctx.fillRect(mx + mw / 2 + (S.center(y) - S.center(cy)) / 40 - 2, my + i, 4, 2); }
  const fy = toY(wd.fy);
  if (fy < my + mh) { ctx.fillStyle = 'rgba(255,80,20,.85)'; ctx.fillRect(mx - 1, Math.max(my, fy), mw + 2, my + mh - Math.max(my, fy)); }
  for (const c of wd.cars) {
    const yy = toY(c.y); if (yy < my || yy > my + mh) continue;
    ctx.fillStyle = c.fl & 1 ? '#555' : COLORS[c.ci]; const xx = mx + mw / 2 + (c.x - S.center(cy)) / 40;
    const sz = c.id === myCar ? 4 : 2; ctx.fillRect(xx - sz / 2, yy - sz / 2, sz, sz);
    if (c.id === myCar) { ctx.strokeStyle = '#fff'; ctx.strokeRect(xx - 3, yy - 3, 6, 6); }
  }
}

// ================= input =================
const keys = {};
const inp = { s: 0, g: 1, b: 0, d: 0, i: 0, a: 0, f: 0 };
let mouse = { x: W / 2, y: HOR + 60, down: false, has: false }, touchSteer = 0, touchMode = false;
addEventListener('keydown', (e) => { if (document.activeElement === $('name')) { if (e.key === 'Enter') join(lastRole || 'drive'); return; } keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyX') inp.i = 1; if (e.code === 'KeyM') toggleMute(); if ((e.code === 'KeyR' || e.code === 'KeyF') && myRole === 'shoot') resetAim(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
function toCanvas(cx, cy) { const r = cv.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; }
cv.addEventListener('mousemove', (e) => {
  const p = toCanvas(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; mouse.has = true;
  if (myRole !== 'shoot') return;
  if (locked) { kbAim = wrapA(kbAim + e.movementX * AIM_MOUSE); aimReset = false; }
  else if (mouse.down && dragX != null) { kbAim = wrapA(kbAim + (e.clientX - dragX) * AIM_MOUSE * 1.3); dragX = e.clientX; aimReset = false; }
});
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; });
cv.addEventListener('mousedown', (e) => { if (e.button === 2) inp.i = 1; else { mouse.down = true; dragX = e.clientX; } audioInit(); if (myRole === 'shoot' && joined && !locked && cv.requestPointerLock && !matchMedia('(pointer:coarse)').matches) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} } });
addEventListener('mouseup', () => { mouse.down = false; dragX = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
let touchFire = false, tiltOn = false, tiltSteer = 0;
let kbAim = 0, turretAim = 0, aimReset = false, dragX = null, locked = false;
const AIM_KEY = 2.4, AIM_MOUSE = 0.0045, AIM_TOUCH = 0.014;
function resetAim() { aimReset = true; }
function readInput(me, dt) {
  if (myRole === 'drive') {
    let s = 0; if (keys.ArrowLeft || keys.KeyA) s -= 1; if (keys.ArrowRight || keys.KeyD) s += 1;
    if (touchSteer) s = touchSteer; else if (tiltOn) s = tiltSteer;
    inp.s = s; inp.b = keys.ArrowDown || keys.KeyS || keys.TouchBrake ? 1 : 0; inp.g = inp.b ? 0 : 1;
    inp.d = keys.Space || keys.ShiftLeft || keys.ShiftRight || keys.TouchDrift ? 1 : 0;
  } else if (myRole === 'shoot' && me) {
    if (keys.ArrowLeft || keys.KeyA) { kbAim = wrapA(kbAim - AIM_KEY * dt); aimReset = false; }
    if (keys.ArrowRight || keys.KeyD) { kbAim = wrapA(kbAim + AIM_KEY * dt); aimReset = false; }
    if (keys.KeyR || keys.KeyF) aimReset = true;
    if (aimReset) { kbAim *= Math.max(0, 1 - dt * 9); if (Math.abs(kbAim) < 0.01) { kbAim = 0; aimReset = false; } }
    aimAssist(me, dt); turretAim = kbAim; inp.a = kbAim; inp.f = mouse.down || keys.Space || touchFire ? 1 : 0;
  }
}
let sendT = 0, lastSent = '';
function sendInput(dt) {
  sendT += dt; if (sendT < 1 / 30) return; sendT = 0;
  const o = myRole === 'drive' ? { t: 'in', s: Math.round(inp.s * 100) / 100, g: inp.g, b: inp.b, d: inp.d, i: inp.i } : { t: 'in', a: Math.round(inp.a * 100) / 100, f: inp.f, i: inp.i };
  const k = JSON.stringify(o);
  if (k !== lastSent || inp.i || Math.random() < 0.15) { send(o); lastSent = k; }
  inp.i = 0;
}

// ================= audio =================
let AC = null, master = null, muted = localStorage.getItem('dr-muted') === '1', engOsc = null, engGain = null, engFilt = null, musicOn = false;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(AC.destination);
  engOsc = AC.createOscillator(); engOsc.type = 'sawtooth'; engFilt = AC.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 400;
  engGain = AC.createGain(); engGain.gain.value = 0; engOsc.connect(engFilt); engFilt.connect(engGain); engGain.connect(master); engOsc.start();
  startMusic();
}
function toggleMute() { muted = !muted; localStorage.setItem('dr-muted', muted ? '1' : '0'); $('mute').textContent = muted ? '🔇' : '🔊'; if (master) master.gain.value = muted ? 0 : 0.5; }
$('mute').textContent = muted ? '🔇' : '🔊';
$('mute').addEventListener('click', (e) => { audioInit(); toggleMute(); e.stopPropagation(); });
let noiseBuf = null;
function noise(dur, gain, f0, f1) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(f0, AC.currentTime); f.frequency.exponentialRampToValueAtTime(f1, AC.currentTime + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(gain, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(AC.currentTime + dur);
}
function tone(type, f0, f1, dur, gain, when) {
  if (!AC) return; const t = (when || AC.currentTime);
  const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function sfx(k) {
  if (!AC || muted) return;
  if (k === 'boom') noise(0.7, 0.6, 1800, 60); else if (k === 'splat') noise(0.15, 0.25, 900, 200);
  else if (k === 'gun') noise(0.05, 0.12, 4000, 1500); else if (k === 'pick') { tone('square', 660, 0, 0.08, 0.1); tone('square', 990, 0, 0.12, 0.1, AC.currentTime + 0.07); }
  else if (k === 'turbo') tone('sawtooth', 200, 900, 0.35, 0.12); else if (k === 'rocket') noise(0.4, 0.3, 3000, 400);
  else if (k === 'beep') tone('square', 440, 0, 0.15, 0.15); else if (k === 'go') tone('square', 880, 0, 0.4, 0.18);
}
function startMusic() {
  if (musicOn || !AC) return; musicOn = true;
  const bass = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49], lead = [440, 0, 523, 0, 587, 523, 440, 392, 440, 0, 659, 0, 587, 523, 494, 523];
  let step = 0, next = AC.currentTime + 0.1; const bpm = 132, st = 60 / bpm / 4;
  setInterval(() => {
    while (next < AC.currentTime + 0.2) {
      const b = bass[(step >> 1) % 8];
      if (step % 2 === 0) tone('sawtooth', b * 2, 0, st * 1.6, 0.06, next);
      if (step % 4 === 0) { tone('sine', 120, 40, 0.18, 0.25, next); }
      if (step % 8 === 4) noiseAt(next, 0.12, 0.12);
      if (step % 2 === 1) noiseAt(next, 0.03, 0.03);
      const l = lead[step % 16]; if (l && (step >> 4) % 4 >= 2) tone('square', l, 0, st * 1.8, 0.025, next);
      next += st; step++;
    }
  }, 50);
}
function noiseAt(t, dur, gain) { if (!noiseBuf) { noise(0.01, 0.0001, 100, 100); } const s = AC.createBufferSource(); s.buffer = noiseBuf; const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur); }

// ================= HUD / shop / join =================
const ORD = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH');
const UPG_INFO = { engine: ['🔥', 'ENGINE', 'Top speed + acceleration'], armor: ['🛡️', 'ARMOR', '+35 max hull'], guns: ['🔫', 'GUNS', 'Damage + fire rate'], tires: ['🛞', 'TIRES', 'Grip + off-road speed'] };
let lastRole = '', hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function join(role) {
  lastRole = role; audioInit(); goFullscreen(); buzz(15);
  const name = ($('name').value || '').trim().toUpperCase();
  localStorage.setItem('dr-name', name);
  pendingJoin = { t: 'join', role, name };
  if (connected) send(pendingJoin); else $('status').textContent = 'connecting to the race server…';
}
$('name').value = localStorage.getItem('dr-name') || '';
$('bDrive').onclick = () => join('drive');
$('bShoot').onclick = () => join('shoot');
function onJoined() {
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  if (isTouch()) { touchMode = true; showTouch(); }
  cv.style.cursor = myRole === 'shoot' ? 'grab' : 'none'; showFwd(); kbAim = 0; turretAim = 0;
}
function renderShop() {
  const m = carMeta(myCar), wd = lastWD; if (!m || !wd) return;
  const c = wd.cars.find((x) => x.id === myCar); const cash = c ? c.cash : 0;
  const mate = myRole === 'drive' ? m.g + (m.gh ? '' : ' (bot)') : m.d + (m.dh ? '' : ' (bot)');
  setText('shopCar', `CAR <b style="color:${COLORS[m.ci]}">${m.name}</b> &middot; YOU ${myRole === 'drive' ? 'DRIVE' : 'SHOOT'} &middot; PARTNER ${mate}<br>CASH <b>$${cash}</b> &middot; both seats share the wallet`);
  const g = $('shopGrid'); let html = '';
  for (const k of S.UPG) {
    const lvl = m.up[k], cost = S.UPG_COST[lvl], maxed = lvl >= S.MAX_LVL, [ic, nm, ds] = UPG_INFO[k];
    html += `<button class="up" data-k="${k}" ${maxed || cash < cost ? 'disabled' : ''}><em>${ic}</em><h3>${nm}</h3><div class="pips">${'■'.repeat(lvl)}${'□'.repeat(S.MAX_LVL - lvl)}</div><div class="cost">${maxed ? 'MAXED' : '$' + cost}</div><div class="desc">${ds}</div></button>`;
  }
  if (hudCache.shopGrid !== html) { hudCache.shopGrid = html; g.innerHTML = html; g.querySelectorAll('.up').forEach((b) => { b.onclick = () => { send({ t: 'buy', k: b.dataset.k }); sfx('pick'); }; b.addEventListener('touchstart', (e) => { e.preventDefault(); if (b.disabled) return; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); buzz(12); send({ t: 'buy', k: b.dataset.k }); sfx('pick'); }, { passive: false }); }); }
  const res = meta.results || [];
  let t = '<table><tr><th>POS</th><th>CAR</th><th>DRIVER</th><th>GUNNER</th><th>DIST</th><th>CAR KILLS</th><th>ZOMBIES</th><th>PRIZE</th></tr>';
  for (const r of res) t += `<tr class="${r.id === myCar ? 'me' : ''}"><td>${ORD(r.pos)}</td><td>${r.name}</td><td>${r.d}</td><td>${r.g}</td><td>${r.dist}m</td><td>${r.kills}</td><td>${r.zk}</td><td>$${r.prize}</td></tr>`;
  setText('results', t + '</table>');
}
let lastWD = null, lastPhase = '', lastCount = -1, gunT = 0;
function updateHud(wd, me) {
  const inShop = wd.ph === 'shop';
  if (joined) {
    $('shop').classList.toggle('hidden', !inShop);
    if (inShop) { renderShop(); setText('shopTimer', Math.max(0, Math.ceil(wd.tl)) + 's'); }
  }
  if (!me) return;
  const ranked = wd.cars.slice().sort((a, b) => b.y - a.y), pos = ranked.findIndex((c) => c.id === myCar) + 1;
  setText('hPos', `<b>${ORD(pos)}</b><small>/ ${wd.cars.length}</small>`);
  const tl = Math.max(0, wd.tl), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60);
  setText('hTime', wd.ph === 'race' ? `${mm}:${ss < 10 ? '0' : ''}${ss}` : wd.ph === 'count' ? 'READY' : 'PIT');
  $('hTime').classList.toggle('low', wd.ph === 'race' && tl < 15);
  setText('hCash', '$' + me.cash);
  const m = carMeta(myCar);
  if (m) setText('hRole', `<i>${m.name}</i><br>${myRole === 'drive' ? 'YOU DRIVE' : 'YOU SHOOT'} · ${myRole === 'drive' ? 'GUNNER ' + m.g + (m.gh ? '' : ' 🤖') : 'DRIVER ' + m.d + (m.dh ? '' : ' 🤖')}<br>KILLS ${me.kills} · ${meta.players} ONLINE`);
  const hp = clamp(me.hp / me.maxhp, 0, 1), bar = $('hHpBar').firstElementChild;
  bar.style.width = (hp * 100).toFixed(1) + '%'; bar.className = hp < 0.3 ? 'lowhp' : hp < 0.6 ? 'mid' : '';
  setText('hSpeed', `<b>${Math.round(me.spd * 1.6)}</b> MPH`);
  const it = me.item >= 0 ? S.ITEMS[me.item] : '';
  setText('hItem', `<span>${it ? ITEM_ICON[it] : ''}</span><small>${it ? it.toUpperCase() : 'ITEM'}</small>`);
  $('hItem').classList.toggle('has', !!it); setText('tItem', it ? ITEM_ICON[it] : 'ITEM'); setText('tItemG', it ? ITEM_ICON[it] : 'ITEM');
  const gap = me.y - wd.fy;
  $('hFire').classList.toggle('hidden', !(wd.ph === 'race' && gap < 320));
  if (wd.ph === 'race' && gap < 320) setText('hFire', `🔥 FIRE ${Math.max(0, Math.round(gap / 10))}m`);
  let msg = '';
  if (me.fl & 1) msg = 'WRECKED! RESPAWNING…';
  else if (wd.ph === 'race' && wd.tl > S.RACE_T - 2.5) msg = 'OUTRUN THE FIRE!';
  setText('hMsg', msg);
  let center = '';
  if (wd.ph === 'count') { const n = Math.ceil(wd.tl); center = n > 0 ? String(n) : ''; if (n !== lastCount) { lastCount = n; sfx('beep'); } }
  else if (wd.ph === 'race' && wd.tl > S.RACE_T - 1) { center = 'GO!'; if (lastCount !== 0) { lastCount = 0; sfx('go'); } }
  else if (wd.ph === 'race' && wd.tl < 10) center = String(Math.ceil(wd.tl));
  setText('hCenter', center);
}

// ================= main loop =================
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; animT += dt;
  const wd = sampleWorld(now); lastWD = wd || lastWD;
  stepParts(dt);
  let me = null, target = null;
  if (wd) {
    me = wd.cars.find((c) => c.id === myCar) || null;
    target = me || wd.cars.slice().sort((a, b) => b.y - a.y)[(animT / 8 | 0) % Math.max(1, wd.cars.length)] || null;
  }
  if (joined && me && myRole === 'shoot') readInput(me, dt);
  if (target) setCam(target, dt, joined && me && myRole === 'shoot');
  else { camState.y += 30 * dt; camState.x = S.center(camState.y); camState.h = Math.atan2(S.center(camState.y + 40) - camState.x, 40); camState.fx = Math.sin(camState.h); camState.fy = Math.cos(camState.h); camState.rx = camState.fy; camState.ry = -camState.fx; }
  if (joined && me) { if (myRole !== 'shoot') readInput(me, dt); sendInput(dt); }
  // sky
  const off = ((-camState.h / (Math.PI * 2)) * sky.SW * 2) % sky.SW;
  const ox = ((off % sky.SW) + sky.SW) % sky.SW;
  ctx.drawImage(sky.c, ox, 0, Math.min(W, sky.SW - ox), HOR + 2, 0, 0, Math.min(W, sky.SW - ox), HOR + 2);
  if (sky.SW - ox < W) ctx.drawImage(sky.c, 0, 0, W - (sky.SW - ox), HOR + 2, sky.SW - ox, 0, W - (sky.SW - ox), HOR + 2);
  drawGround();
  // horizon haze
  const hz = ctx.createLinearGradient(0, HOR - 10, 0, HOR + 14); hz.addColorStop(0, 'rgba(255,120,90,0)'); hz.addColorStop(0.5, 'rgba(255,120,90,.55)'); hz.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, HOR - 10, W, 24);
  items = [];
  addBuildings(); addProps(); if (wd) addEntities(wd);
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.f();
  if (wd) {
    drawFireHeat(wd, me);
    drawMinimap(wd, me);
    // gunner crosshair
    if (joined && myRole === 'shoot' && me) {
      const cx = W / 2 + Math.sin(wrapA(me.h + inp.a - camState.h)) * F, cy = HOR + 30;
      const col = inp.f ? '#ffe24a' : '#7df9ff';
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 14, cy); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 14); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(cx - 0.75, cy - 0.75, 1.5, 1.5); ctx.restore();
      // first-person roof gun
      const gb = H, gt = H - 64, sway = Math.sin(animT * 9) * (me.spd / 200) * 2;
      for (const off of [-9, 9]) {
        const gg = ctx.createLinearGradient(W / 2 + off - 6, 0, W / 2 + off + 6, 0); gg.addColorStop(0, '#1a1622'); gg.addColorStop(0.4, '#7a7888'); gg.addColorStop(0.6, '#4a4858'); gg.addColorStop(1, '#100c16');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(W / 2 + off * 1.8 - 9 + sway, gb); ctx.lineTo(W / 2 + off * 0.7 - 3 + sway, gt); ctx.lineTo(W / 2 + off * 0.7 + 3 + sway, gt); ctx.lineTo(W / 2 + off * 1.8 + 9 + sway, gb); ctx.fill();
        if (me.fl & 64 && Math.random() < 0.7) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GLOW.fire, W / 2 + off * 0.7 - 12 + sway, gt - 14, 24, 24); ctx.globalCompositeOperation = 'source-over'; }
      }
      const hb = ctx.createLinearGradient(0, H - 22, 0, H); hb.addColorStop(0, '#2a2632'); hb.addColorStop(1, '#0c0a10');
      ctx.fillStyle = hb; ctx.fillRect(W / 2 - 34 + sway, H - 20, 68, 20); ctx.fillStyle = COLORS[me.ci]; ctx.fillRect(W / 2 - 34 + sway, H - 20, 68, 2);
      // turret compass: where the gun points relative to the car's nose
      const ax = 40, ay = H - 64, a = inp.a;
      ctx.fillStyle = 'rgba(10,0,24,.55)'; ctx.beginPath(); ctx.arc(ax, ay, 15, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff2fa0'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(ax - 2.5, ay - 4, 5, 8);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.sin(a) * 13, ay - Math.cos(a) * 13); ctx.stroke();
    }
    if (me && (me.fl & 64)) { gunT -= dt; if (gunT <= 0) { sfx('gun'); gunT = 0.09; } }
    updateHud(wd, me);
  }
  bloom();
  // scanlines + vignette for the CRT feel
  ctx.fillStyle = 'rgba(0,0,0,.05)'; for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  ctx.drawImage(vignette, 0, 0);
  // engine
  if (AC && engOsc && me) { const sp = me.spd; engOsc.frequency.setTargetAtTime(40 + sp * 1.4 + (me.fl & 4 ? 40 : 0), AC.currentTime, 0.05); engFilt.frequency.setTargetAtTime(300 + sp * 8, AC.currentTime, 0.05); engGain.gain.setTargetAtTime(muted ? 0 : 0.05 + Math.min(0.06, sp / 2000), AC.currentTime, 0.1); }
  if (shake > 0.05) { cv.style.transform = `translate(${(Math.random() - 0.5) * shake * 3}px,${(Math.random() - 0.5) * shake * 3}px)`; shake *= Math.pow(0.02, dt); } else if (cv.style.transform) cv.style.transform = '';
}
let vignette;
function makeVignette() { const [c, x] = mk(W, H); const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,0,25,.55)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return c; }
vignette = makeVignette();
function resizeView() {
  // match the internal canvas to the screen's aspect so phones fill edge to edge (no letterbox)
  const asp = clamp(innerWidth / Math.max(1, innerHeight), 1.3, 2.4);
  const nw = Math.round(H * asp / 2) * 2;
  if (nw === W) return;
  W = nw; cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  gImg = ctx.createImageData(W, GH); gBuf = new Uint32Array(gImg.data.buffer); vignette = makeVignette();
}
addEventListener('resize', resizeView); addEventListener('orientationchange', () => setTimeout(resizeView, 200));
resizeView();
window.DeathRace = { state: () => { const wd = lastWD; const me = wd && wd.cars.find((c) => c.id === myCar); return { connected, joined, myCar, myRole, phase: wd && wd.ph, tl: wd && wd.tl, cars: wd ? wd.cars.length : 0, zombies: wd ? wd.zombies.length : 0, me: me ? { x: me.x, y: me.y, hp: me.hp, spd: me.spd, cash: me.cash, item: me.item } : null, fy: wd && wd.fy }; }, keys };

// ================= mobile controls =================
const isTouch = () => touchMode || matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function goFullscreen() {
  if (!isTouch()) return;
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    if (rq && !document.fullscreenElement) { const p = rq.call(el, { navigationUI: 'hide' }); if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {}); }
  } catch (e) {}
}
function showFwd() { $('fwdBtn').classList.toggle('hidden', myRole !== 'shoot' || isTouch()); }
function showTouch() {
  if (!joined) return;
  document.body.classList.add('touch'); const t = $('touch');
  t.classList.remove('hidden'); t.classList.toggle('gunner', myRole === 'shoot'); t.classList.toggle('driver', myRole !== 'shoot'); showFwd();
}
// generic multi-touch hold button: tracks its own touch identifiers
function holdBtn(el, down, up) {
  const ids = new Set();
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) ids.add(t.identifier); if (ids.size) { el.classList.add('on'); buzz(10); down && down(); } }, { passive: false });
  const end = (e) => { e.preventDefault(); for (const t of e.changedTouches) ids.delete(t.identifier); if (!ids.size) { el.classList.remove('on'); up && up(); } };
  el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end, { passive: false });
  el.addEventListener('mousedown', (e) => { e.stopPropagation(); el.classList.add('on'); down && down(); }); el.addEventListener('mouseup', () => { el.classList.remove('on'); up && up(); });
}
// floating analog steering stick on the left half (driver)
(function stickZone() {
  const z = $('tStick'), base = $('tBase'), knob = $('tKnob'); let id = null, ox = 0, oy = 0;
  const R = () => Math.min(innerWidth, innerHeight) * 0.16;
  z.addEventListener('touchstart', (e) => {
    e.preventDefault(); touchMode = true; if (id !== null) return; const t = e.changedTouches[0]; id = t.identifier; ox = t.clientX; oy = t.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); knob.style.transform = ''; buzz(6);
  }, { passive: false });
  z.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === id) {
      let dx = t.clientX - ox; const r = R();
      if (Math.abs(dx) > r) { ox += dx - Math.sign(dx) * r; base.style.left = ox + 'px'; dx = Math.sign(dx) * r; } // stick follows the thumb
      const n = dx / r, dead = 0.08, m = Math.max(0, (Math.abs(n) - dead) / (1 - dead));
      touchSteer = Math.sign(n) * Math.pow(m, 1.35) || 0;
      knob.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; touchSteer = 0; base.classList.remove('on'); knob.style.transform = ''; } };
  z.addEventListener('touchend', end); z.addEventListener('touchcancel', end);
})();
// right-thumb turret drag (gunner)
(function aimZone() {
  const z = $('tAim'); let id = null, lx = 0, lt = 0;
  z.addEventListener('touchstart', (e) => { e.preventDefault(); touchMode = true; if (id !== null) return; const t = e.changedTouches[0]; id = t.identifier; lx = t.clientX; lt = performance.now(); aimDragging = true; }, { passive: false });
  z.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === id) {
      const dx = t.clientX - lx, now = performance.now(), v = Math.abs(dx) / Math.max(8, now - lt); lx = t.clientX; lt = now;
      const sens = AIM_TOUCH_PX * (1 + Math.min(1.6, v * 0.9)) * (aimSensMul || 1); // flick faster, fine-aim slow
      kbAim = wrapA(kbAim + dx * sens); aimReset = false;
    }
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; aimDragging = false; } };
  z.addEventListener('touchend', end); z.addEventListener('touchcancel', end);
})();
holdBtn($('tDrift'), () => { keys.TouchDrift = true; }, () => { keys.TouchDrift = false; });
holdBtn($('tBrake'), () => { keys.TouchBrake = true; }, () => { keys.TouchBrake = false; });
holdBtn($('tItem'), () => { inp.i = 1; });
holdBtn($('tItemG'), () => { inp.i = 1; });
holdBtn($('tFire'), () => { touchFire = true; }, () => { touchFire = false; });
holdBtn($('tFwd'), () => { resetAim(); });
holdBtn($('tTilt'), () => {
  const enable = () => { tiltOn = !tiltOn; $('tTilt').textContent = tiltOn ? 'TILT ON' : 'TILT OFF'; $('touch').classList.toggle('tilt', tiltOn); };
  if (!tiltOn && window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') enable(); }).catch(() => {});
  else enable();
});
addEventListener('deviceorientation', (e) => {
  if (!tiltOn || e.beta == null) return;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const raw = ang === 90 ? e.beta : (ang === -90 || ang === 270) ? -e.beta : e.gamma;
  const n = clamp(raw / 28, -1, 1); tiltSteer = Math.abs(n) < 0.06 ? 0 : n;
});
let aimDragging = false, aimSensMul = 1;
const AIM_TOUCH_PX = 0.0075;
// gentle aim assist on touch: drift the turret toward the closest target near the crosshair
function aimAssist(me, dt) {
  if (!isTouch() || aimReset || !lastWD) return;
  let best = null, bd = 0.3;
  const consider = (x, y, w) => { const d = Math.hypot(x - me.x, y - me.y); if (d < 12 || d > 230) return; const da = wrapA(Math.atan2(x - me.x, y - me.y) - me.h - kbAim); if (Math.abs(da) * w < bd) { bd = Math.abs(da) * w; best = da; } };
  for (const z of lastWD.zombies) consider(z.x, z.y, 1);
  for (const c of lastWD.cars) if (c.id !== myCar && !(c.fl & 1)) consider(c.x, c.y, 0.8);
  if (best !== null) kbAim = wrapA(kbAim + clamp(best, -1, 1) * dt * ((touchFire ? 3.2 : 1.6) * (aimDragging ? 0.5 : 1)));
}
// no page scroll / zoom / pull-to-refresh / long-press / double-tap zoom
document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('#results')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
let lastTapT = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTapT < 320 && !(e.target.closest && e.target.closest('input,.tb,.up'))) e.preventDefault(); lastTapT = n; }, { passive: false });
document.addEventListener('touchstart', () => { touchMode = true; audioInit(); }, { passive: true });

$('fwdBtn').addEventListener('click', (e) => { resetAim(); e.stopPropagation(); });
$('fwdBtn').addEventListener('touchstart', (e) => { resetAim(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
window.DeathRace.aim = () => kbAim; window.DeathRace.inp = () => ({ ...inp, touchSteer, touchFire, W });
connect();
requestAnimationFrame(frame);
})();
