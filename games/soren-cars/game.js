/* Soren Cars — offline toddler driving game. All art and sound are original. */
'use strict';
(() => {
  const TAU = Math.PI * 2;
  const INK = '#2a1833';
  const PAINTS = [
    { id: 'red',    hex: '#ff3b3a', dark: '#b41c1c', light: '#ff8a86' },
    { id: 'blue',   hex: '#3a7dff', dark: '#1a4ab0', light: '#8ab6ff' },
    { id: 'yellow', hex: '#ffd000', dark: '#c49200', light: '#ffe66a' },
    { id: 'green',  hex: '#2dcc55', dark: '#168a32', light: '#7aeb94' }
  ];
  const CAR_IDS = ['sports', 'bus', 'police', 'fire'];
  const WHITE = { id: 'white', hex: '#f4f6fb', dark: '#b8bcc8', light: '#ffffff' };

  function paintById(id) {
    if (id === 'white') return WHITE;
    return PAINTS.find((p) => p.id === id) || PAINTS[0];
  }
  function defaultPaintId(car) {
    if (car === 'bus') return 'yellow';
    if (car === 'police') return 'white';
    return 'red';
  }

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  let W = 0, H = 0, DPR = 1;
  let time = 0, lastT = 0;

  const state = {
    scene: 'pick',       // pick | puzzle | color | town
    car: 'sports',
    paint: 'red',
    fade: 0,             // 1..0 after a transition
    fadeFrom: null,
    nextScene: null,
    nextDelay: 0,
    siren: false,
    shine: 0,
    fuel: 0.75,
    honkFlash: 0
  };

  // ---------------------------------------------------------------------------
  // Math / helpers
  // ---------------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  function angLerp(a, b, t) {
    let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + d * t;
  }
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  function mulberry(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(r + amt, 0, 255);
    g = clamp(g + amt, 0, 255);
    b = clamp(b + amt, 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function resize() {
    const vv = window.visualViewport;
    const cssW = Math.max(1, (vv ? vv.width : window.innerWidth));
    const cssH = Math.max(1, (vv ? vv.height : window.innerHeight));
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.left = ((vv && vv.offsetLeft) || 0) + 'px';
    canvas.style.top = ((vv && vv.offsetTop) || 0) + 'px';
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const bw = Math.max(1, Math.round(cssW * DPR));
    const bh = Math.max(1, Math.round(cssH * DPR));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = cssW;
    H = cssH;
  }

  function pad() {
    return { t: 16, r: 16, b: 16, l: 16 };
  }

  // ---------------------------------------------------------------------------
  // Audio (Web Audio only, generated, no files)
  // ---------------------------------------------------------------------------
  let actx = null;
  let sirenNodes = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function unlockAudio() { audio(); }

  function tone(freq, dur, type, vol, slide) {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    f.type = 'lowpass';
    f.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function blip() { tone(660, 0.12, 'triangle', 0.14, 880); }
  function snapSnd() { tone(520, 0.1, 'square', 0.08); setTimeout(() => tone(780, 0.14, 'triangle', 0.12), 40); }
  function fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.14), i * 90));
  }
  function pickupSnd() { tone(880, 0.12, 'sine', 0.12, 1320); setTimeout(() => tone(1320, 0.16, 'triangle', 0.1), 70); }
  function dropSnd() { tone(700, 0.16, 'triangle', 0.12, 420); }
  function washSnd() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const n = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 80;
    n.type = 'triangle'; n.frequency.value = 400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g); n.connect(g); g.connect(c.destination);
    o.start(t); n.start(t); o.stop(t + 1.3); n.stop(t + 1.3);
  }
  function fillSnd() { [400, 500, 600, 750].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.07), i * 100)); }
  function parkSnd() { fanfare(); }
  function honk() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    [392, 311].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(c.destination);
      o.start(t + i * 0.01); o.stop(t + 0.42);
    });
    state.honkFlash = 0.35;
  }
  function startSiren() {
    const c = audio(); if (!c) return;
    stopSiren();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, t);
    try {
      o.frequency.loop = true;
    } catch (e) {}
    // Oscillate with timed ramps for a few minutes, then the game will restart it if still on
    let f = 620;
    for (let i = 0; i < 80; i++) {
      f = (i % 2 === 0) ? 900 : 620;
      o.frequency.linearRampToValueAtTime(f, t + 0.32 * (i + 1));
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    o.connect(g); g.connect(c.destination);
    o.start(t);
    sirenNodes = { o, g, c };
  }
  function stopSiren() {
    if (!sirenNodes) return;
    try {
      const t = sirenNodes.c.currentTime;
      sirenNodes.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      sirenNodes.o.stop(t + 0.1);
    } catch (e) {}
    sirenNodes = null;
  }
  function toggleSiren() {
    state.siren = !state.siren;
    if (state.siren) startSiren(); else stopSiren();
    blip();
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------
  const particles = [];
  function burst(x, y, n, cols) {
    const colors = cols || PAINTS.map((p) => p.hex).concat(['#fff', '#ff86d5', '#ffd000']);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 120 + Math.random() * 380;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 180,
        g: 700,
        life: 0.8 + Math.random() * 0.7,
        max: 1,
        col: colors[i % colors.length],
        r: 5 + Math.random() * 8,
        kind: Math.random() < 0.4 ? 'star' : 'sq',
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 10
      });
    }
  }
  function sparkle(x, y, n) {
    for (let i = 0; i < (n || 8); i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 80,
        g: 20,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        col: '#fff6a0',
        r: 3 + Math.random() * 4,
        kind: 'star',
        rot: Math.random() * TAU,
        vr: 4
      });
    }
  }
  function bubbles(x, y, n) {
    for (let i = 0; i < (n || 12); i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30,
        vy: -50 - Math.random() * 90,
        g: -40,
        life: 0.8 + Math.random() * 0.8,
        max: 1,
        col: 'rgba(200,240,255,0.7)',
        r: 6 + Math.random() * 12,
        kind: 'bubble',
        rot: 0, vr: 0
      });
    }
  }
  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawStar(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      const b = a + TAU / 10;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(b) * r * 0.42, Math.sin(b) * r * 0.42);
    }
    c.closePath();
    c.restore();
  }
  function drawParticles(c) {
    for (const p of particles) {
      const a = clamp(p.life * 2, 0, 1);
      c.save();
      c.globalAlpha = a;
      c.fillStyle = p.col;
      if (p.kind === 'star') {
        c.beginPath();
        drawStar(c, p.x, p.y, p.r, p.rot);
        c.fill();
      } else if (p.kind === 'bubble') {
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, TAU);
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 2;
        c.fill();
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.22, 0, TAU);
        c.fill();
      } else {
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillRect(-p.r * 0.5, -p.r * 0.8, p.r, p.r * 1.6);
      }
      c.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing primitives
  // ---------------------------------------------------------------------------
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else {
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
  }
  function fs(c, fill, stroke, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw || 3;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    }
  }
  function ellipse(c, x, y, rx, ry) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  }

  function drawWheelSide(c, x, y, r, spin, chrome) {
    c.save();
    c.translate(x, y);
    // tire
    c.beginPath(); c.arc(0, 0, r, 0, TAU);
    c.fillStyle = '#1c1c22'; c.fill();
    c.strokeStyle = INK; c.lineWidth = Math.max(2, r * 0.1); c.stroke();
    // sidewall highlight
    c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU);
    c.strokeStyle = '#3a3a44'; c.lineWidth = Math.max(1.5, r * 0.08); c.stroke();
    // rim
    c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU);
    c.fillStyle = chrome ? '#e8edf4' : '#cfd5de'; c.fill();
    c.strokeStyle = '#5a6070'; c.lineWidth = Math.max(1.2, r * 0.07); c.stroke();
    c.save();
    c.rotate(spin || 0);
    c.strokeStyle = '#8a90a0';
    c.lineWidth = Math.max(1.2, r * 0.08);
    for (let i = 0; i < 5; i++) {
      c.rotate(TAU / 5);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(r * 0.52, 0);
      c.stroke();
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU);
    c.fillStyle = '#f4f6fa'; c.fill();
    c.strokeStyle = '#6a7080'; c.lineWidth = 1; c.stroke();
    c.restore();
  }

  function drawWheelTop(c, x, y, rx, ry) {
    c.save();
    ellipse(c, x, y, rx, ry);
    c.fillStyle = '#1c1c22'; c.fill();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    ellipse(c, x, y, rx * 0.5, ry * 0.5);
    c.fillStyle = '#cfd5de'; c.fill();
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // SIDE-VIEW CARS (pick / puzzle / color). Local space: length ~ 240, ground y=40
  // ---------------------------------------------------------------------------
  function glass(c) {
    const g = c.createLinearGradient(0, -40, 0, 10);
    g.addColorStop(0, 'rgba(230,248,255,0.95)');
    g.addColorStop(0.45, 'rgba(110,190,230,0.85)');
    g.addColorStop(1, 'rgba(60,130,190,0.8)');
    return g;
  }
  function bodyGrad(c, paint, x0, y0, x1, y1) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, paint.light);
    g.addColorStop(0.4, paint.hex);
    g.addColorStop(1, paint.dark);
    return g;
  }

  function drawSportsSide(c, paint, opt) {
    const o = opt || {};
    const spin = o.spin || 0;
    const ink = INK, lw = 3.2;
    c.save();
    // shadow
    ellipse(c, 4, 42, 108, 11);
    c.fillStyle = 'rgba(40,16,50,0.22)'; c.fill();
    drawWheelSide(c, -58, 28, 21, spin, true);
    drawWheelSide(c, 66, 28, 21, spin, true);

    // lower body + cabin
    c.beginPath();
    c.moveTo(-98, 20);
    c.bezierCurveTo(-112, 20, -114, 8, -104, 2);
    // spoiler
    c.lineTo(-110, -6);
    c.lineTo(-110, -16);
    c.lineTo(-86, -16);
    c.lineTo(-82, -8);
    c.lineTo(-74, -6);
    // roof
    c.bezierCurveTo(-64, -36, -28, -46, 4, -46);
    c.lineTo(28, -46);
    c.bezierCurveTo(58, -44, 72, -16, 90, -8);
    // hood / nose
    c.bezierCurveTo(108, -6, 128, 2, 126, 16);
    c.bezierCurveTo(126, 28, 112, 30, 98, 30);
    c.lineTo(-86, 30);
    c.bezierCurveTo(-104, 30, -108, 26, -98, 20);
    c.closePath();
    fs(c, bodyGrad(c, paint, 0, -48, 0, 32), ink, lw);

    // side scoop highlight
    c.beginPath();
    c.moveTo(-70, 4);
    c.bezierCurveTo(-20, -2, 40, -2, 90, 8);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 4; c.lineCap = 'round'; c.stroke();

    // window
    c.beginPath();
    c.moveTo(-62, -10);
    c.bezierCurveTo(-52, -34, -20, -38, 6, -38);
    c.lineTo(24, -38);
    c.bezierCurveTo(48, -36, 60, -16, 72, -10);
    c.lineTo(20, -8);
    c.quadraticCurveTo(-10, -6, -62, -10);
    c.closePath();
    fs(c, glass(c), ink, 2.6);
    // shine streak
    c.beginPath();
    c.moveTo(-40, -28);
    c.lineTo(16, -30);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.stroke();

    // door line + handle
    c.beginPath();
    c.moveTo(10, -6); c.lineTo(10, 28);
    c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    rr(c, -6, 6, 14, 5, 2); fs(c, paint.dark, ink, 1.5);

    // headlight
    c.beginPath();
    c.ellipse(112, 8, 10, 7, 0.15, 0, TAU);
    fs(c, '#fff6c8', ink, 2);
    c.beginPath();
    c.ellipse(114, 7, 4, 3, 0.15, 0, TAU);
    c.fillStyle = '#fff'; c.fill();
    // taillight
    rr(c, -104, 2, 10, 10, 3); fs(c, '#ff4455', ink, 2);
    // mirror
    rr(c, 52, -12, 8, 8, 3); fs(c, paint.dark, ink, 2);
    // grille
    rr(c, 118, 16, 8, 10, 2); fs(c, '#2a2a33', ink, 1.5);
    if (o.shine) drawShine(c, 0, -10, 120, 50);
    c.restore();
  }

  function drawBusSide(c, paint, opt) {
    const o = opt || {};
    const spin = o.spin || 0;
    const ink = INK, lw = 3.2;
    c.save();
    ellipse(c, 0, 44, 128, 11);
    c.fillStyle = 'rgba(40,16,50,0.22)'; c.fill();
    drawWheelSide(c, -70, 30, 20, spin, false);
    drawWheelSide(c, 28, 30, 20, spin, false);
    drawWheelSide(c, 62, 30, 20, spin, false);

    // body
    rr(c, -124, -42, 248, 68, 16);
    fs(c, bodyGrad(c, paint, 0, -42, 0, 28), ink, lw);
    // black stripe
    rr(c, -122, 10, 244, 12, 0);
    c.fillStyle = '#2a2a33'; c.fill();
    // roof cap
    rr(c, -110, -50, 200, 14, 7);
    fs(c, paint.dark, ink, 2.4);

    // windows row
    const kids = ['#ffd4a8', '#f0c090', '#e8b898', '#ffcc99', '#f5c8a0'];
    for (let i = 0; i < 5; i++) {
      const x = -88 + i * 36;
      rr(c, x, -32, 30, 28, 5);
      fs(c, glass(c), ink, 2.2);
      // little kid face
      c.beginPath(); c.arc(x + 15, -14, 8, 0, TAU);
      c.fillStyle = kids[i]; c.fill();
      c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke();
      c.beginPath(); c.arc(x + 12, -16, 1.3, 0, TAU); c.arc(x + 18, -16, 1.3, 0, TAU);
      c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(x + 15, -12, 3.2, 0.15, Math.PI - 0.15);
      c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    }
    // door
    rr(c, 96, -32, 22, 54, 4);
    fs(c, shade(paint.hex, -20), ink, 2.2);
    c.beginPath(); c.moveTo(107, -28); c.lineTo(107, 18);
    c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    rr(c, 100, -26, 14, 16, 3); fs(c, glass(c), ink, 1.6);
    rr(c, 100, -6, 14, 16, 3); fs(c, glass(c), ink, 1.6);

    // headlights + bumper
    rr(c, 116, 14, 12, 12, 3); fs(c, '#fff6c8', ink, 2);
    rr(c, -128, 16, 14, 12, 3); fs(c, '#ff4455', ink, 2);
    rr(c, -128, 24, 256, 10, 3); fs(c, '#3a3a44', ink, 2.2);
    // mirrors
    rr(c, 122, -20, 8, 16, 3); fs(c, '#3a3a44', ink, 2);
    // stop sign
    c.save();
    c.translate(-70, -58);
    c.rotate(-0.12);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * TAU / 8;
      const r = 11;
      if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    fs(c, '#e4252a', ink, 2);
    c.restore();
    // crossing lights
    c.beginPath(); c.arc(-40, -52, 5, 0, TAU); fs(c, '#3a3a44', ink, 1.6);
    c.beginPath(); c.arc(-24, -52, 5, 0, TAU); fs(c, '#3a3a44', ink, 1.6);
    if (o.shine) drawShine(c, 0, -10, 140, 55);
    c.restore();
  }

  function drawPoliceSide(c, paint, opt) {
    const o = opt || {};
    const spin = o.spin || 0;
    const ink = INK, lw = 3.2;
    const siren = o.siren;
    const t = o.t || 0;
    c.save();
    ellipse(c, 2, 42, 114, 11);
    c.fillStyle = 'rgba(40,16,50,0.22)'; c.fill();
    drawWheelSide(c, -60, 28, 20, spin, true);
    drawWheelSide(c, 66, 28, 20, spin, true);

    // body sedan
    c.beginPath();
    c.moveTo(-108, 18);
    c.bezierCurveTo(-118, 18, -118, 8, -110, 4);
    c.lineTo(-100, 2);
    c.bezierCurveTo(-88, -34, -40, -44, -8, -44);
    c.lineTo(28, -44);
    c.bezierCurveTo(64, -42, 78, -16, 94, -6);
    c.bezierCurveTo(116, -4, 128, 6, 126, 18);
    c.bezierCurveTo(126, 28, 112, 30, 100, 30);
    c.lineTo(-94, 30);
    c.bezierCurveTo(-112, 30, -116, 24, -108, 18);
    c.closePath();
    fs(c, bodyGrad(c, paint, 0, -46, 0, 32), ink, lw);

    // black hood / trunk panels
    c.beginPath();
    c.moveTo(78, -6);
    c.lineTo(118, 2);
    c.lineTo(118, 16);
    c.lineTo(76, 16);
    c.closePath();
    c.fillStyle = 'rgba(20,20,28,0.72)'; c.fill();
    c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    rr(c, -108, 0, 28, 16, 3);
    c.fillStyle = 'rgba(20,20,28,0.72)'; c.fill();
    c.strokeStyle = ink; c.lineWidth = 2; c.stroke();

    // windows
    c.beginPath();
    c.moveTo(-62, -8);
    c.bezierCurveTo(-52, -34, -20, -36, -4, -36);
    c.lineTo(28, -36);
    c.bezierCurveTo(54, -34, 64, -14, 74, -8);
    c.lineTo(-62, -8);
    c.closePath();
    fs(c, glass(c), ink, 2.6);
    c.beginPath(); c.moveTo(16, -36); c.lineTo(16, -8);
    c.strokeStyle = ink; c.lineWidth = 2.2; c.stroke();
    // shine
    c.beginPath(); c.moveTo(-36, -28); c.lineTo(8, -30);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.stroke();

    // door star badge
    c.save();
    c.translate(-16, 12);
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5;
      const b = a + TAU / 10;
      c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      c.lineTo(Math.cos(b) * 4.5, Math.sin(b) * 4.5);
    }
    c.closePath();
    fs(c, '#f0c43c', ink, 1.8);
    c.restore();

    // light bar
    rr(c, -28, -56, 62, 16, 4);
    fs(c, '#1a1a22', ink, 2.2);
    const flash = siren && Math.sin(t * 14) > 0;
    rr(c, -24, -53, 24, 10, 2);
    fs(c, (siren ? (flash ? '#ff2040' : '#661018') : '#c01828'), ink, 1.4);
    rr(c, 6, -53, 24, 10, 2);
    fs(c, (siren ? (flash ? '#661018' : '#2080ff') : '#1848c0'), ink, 1.4);
    if (siren) {
      c.globalAlpha = 0.35;
      c.fillStyle = flash ? '#ff2040' : '#2080ff';
      c.beginPath(); c.arc(flash ? -12 : 18, -48, 28, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }

    // push bumper, headlight, tail, spotlight
    rr(c, 116, 16, 14, 14, 3); fs(c, '#8a90a0', ink, 2);
    c.beginPath(); c.ellipse(112, 6, 9, 7, 0.1, 0, TAU); fs(c, '#fff6c8', ink, 2);
    rr(c, -116, 6, 10, 10, 3); fs(c, '#ff4455', ink, 2);
    c.beginPath(); c.arc(78, -4, 6, 0, TAU); fs(c, '#e8edf4', ink, 1.8);
    // antenna
    c.beginPath(); c.moveTo(-80, -4); c.lineTo(-88, -50);
    c.strokeStyle = ink; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(-88, -52, 3, 0, TAU); c.fillStyle = '#e4252a'; c.fill();
    if (o.shine) drawShine(c, 0, -10, 130, 50);
    c.restore();
  }

  function drawFireSide(c, paint, opt) {
    const o = opt || {};
    const spin = o.spin || 0;
    const ink = INK, lw = 3.2;
    const siren = o.siren;
    const t = o.t || 0;
    c.save();
    ellipse(c, 0, 44, 128, 11);
    c.fillStyle = 'rgba(40,16,50,0.22)'; c.fill();
    drawWheelSide(c, -78, 30, 20, spin, true);
    drawWheelSide(c, -40, 30, 20, spin, true);
    drawWheelSide(c, 70, 30, 20, spin, true);

    // rear body
    rr(c, -128, -28, 150, 56, 8);
    fs(c, bodyGrad(c, paint, 0, -30, 0, 30), ink, lw);
    // gold stripe
    rr(c, -126, 2, 146, 10, 0);
    c.fillStyle = '#f0c43c'; c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke();
    // compartments
    for (let i = 0; i < 3; i++) {
      rr(c, -116 + i * 42, -20, 36, 20, 4);
      fs(c, shade(paint.hex, -25), ink, 2);
      // handles
      rr(c, -106 + i * 42, -12, 16, 4, 2); fs(c, '#f0c43c', ink, 1.2);
    }
    // hose reel
    c.beginPath(); c.arc(-40, 8, 14, 0, TAU);
    fs(c, '#f0c43c', ink, 2.2);
    c.beginPath(); c.arc(-40, 8, 7, 0, TAU);
    fs(c, paint.dark, ink, 1.5);

    // cab
    rr(c, 16, -46, 110, 74, 12);
    fs(c, bodyGrad(c, paint, 70, -46, 70, 30), ink, lw);
    rr(c, 16, 2, 110, 10, 0);
    c.fillStyle = '#f0c43c'; c.fill();
    // windows
    rr(c, 28, -36, 42, 30, 6); fs(c, glass(c), ink, 2.4);
    rr(c, 76, -36, 38, 30, 6); fs(c, glass(c), ink, 2.4);
    c.beginPath(); c.moveTo(42, -28); c.lineTo(56, -30);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.stroke();
    // dalmatian in the cab window — simple, cute, readable
    c.save();
    c.translate(48, -18);
    // ears
    c.beginPath(); c.ellipse(-7, -10, 4, 5.5, -0.4, 0, TAU); fs(c, '#1c1c22', ink, 1.2);
    c.beginPath(); c.ellipse(7, -10, 4, 5.5, 0.4, 0, TAU); fs(c, '#1c1c22', ink, 1.2);
    // head
    c.beginPath(); c.arc(0, -2, 10, 0, TAU); fs(c, '#fff', ink, 1.8);
    // spots
    c.fillStyle = '#1c1c22';
    c.beginPath(); c.ellipse(-4, 0, 2.2, 1.8, 0.3, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(5, 2, 2.4, 1.8, -0.2, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(3, -6, 1.8, 1.5, 0.2, 0, TAU); c.fill();
    // eyes + smile + nose
    c.beginPath(); c.arc(-3.2, -3, 1.3, 0, TAU); c.arc(3.2, -3, 1.3, 0, TAU);
    c.fillStyle = INK; c.fill();
    c.beginPath(); c.ellipse(0, 0, 2.2, 1.5, 0, 0, TAU); fs(c, '#1c1c22', ink, 1);
    c.beginPath(); c.arc(0, 2, 4, 0.2, Math.PI - 0.2);
    c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    c.restore();

    // bumper + grill + lights
    rr(c, 114, 14, 20, 18, 4); fs(c, '#d0d5de', ink, 2.2);
    rr(c, 120, 0, 12, 12, 3); fs(c, '#fff6c8', ink, 2);
    // ladder on top
    c.save();
    c.translate(-20, -44);
    c.rotate(-0.08);
    rr(c, -90, -8, 200, 16, 3); fs(c, '#c5c9d2', ink, 2.2);
    c.strokeStyle = ink; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      c.beginPath(); c.moveTo(-80 + i * 22, -8); c.lineTo(-80 + i * 22, 8); c.stroke();
    }
    c.restore();

    // light bar
    rr(c, 36, -60, 56, 14, 4); fs(c, '#1a1a22', ink, 2);
    const flash = siren && Math.sin(t * 14) > 0;
    rr(c, 40, -57, 22, 8, 2); fs(c, (siren ? (flash ? '#ff2040' : '#661018') : '#c01828'), ink, 1.3);
    rr(c, 66, -57, 22, 8, 2); fs(c, (siren ? (flash ? '#661018' : '#ff2040') : '#c01828'), ink, 1.3);
    if (siren) {
      c.globalAlpha = 0.32;
      c.fillStyle = '#ff2040';
      c.beginPath(); c.arc(64, -52, 30, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    // bell
    c.beginPath(); c.arc(30, 10, 8, 0, TAU); fs(c, '#f0c43c', ink, 2);
    if (o.shine) drawShine(c, 0, -10, 140, 55);
    c.restore();
  }

  function drawShine(c, x, y, w, h) {
    c.save();
    c.globalAlpha = 0.45;
    const g = c.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, w * 0.4, h * 0.3, -0.5, 0, TAU);
    c.fill();
    c.restore();
  }

  function drawCarSide(c, type, paint, opt) {
    if (type === 'bus') drawBusSide(c, paint, opt);
    else if (type === 'police') drawPoliceSide(c, paint, opt);
    else if (type === 'fire') drawFireSide(c, paint, opt);
    else drawSportsSide(c, paint, opt);
  }

  // Side-view native size (for puzzle raster)
  const SIDE_W = 280, SIDE_H = 150, SIDE_CY = 86;

  function withSideCar(c, x, y, scale, type, paint, opt, fn) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    fn(c, type, paint, opt);
    c.restore();
  }
  function paintSide(c, x, y, scale, type, paint, opt) {
    withSideCar(c, x, y, scale, type, paint, opt, drawCarSide);
  }


  // Occupants drawn in car-local side-view space (same as the car drawings).
  function drawOccupantsSide(c, type, opt) {
    const o = opt || {};
    if (o.driver === false) return;
    // Window positions per car (center of the glass the driver sits in)
    let dx = 8, dy = -22, s = 0.42;
    if (type === 'bus') { dx = 107; dy = -10; s = 0.36; }
    else if (type === 'police') { dx = 4; dy = -22; s = 0.4; }
    else if (type === 'fire') { dx = 94; dy = -20; s = 0.38; }
    else { dx = 8; dy = -24; s = 0.4; }
    c.save();
    c.translate(dx, dy);
    c.scale(s, s);
    drawPerson(c, 'soren', { sit: true, face: 1, wave: 0, bust: true });
    c.restore();
    const pass = o.passengers || [];
    const slots = passengerSlotsSide(type);
    pass.forEach((id, i) => {
      if (!slots[i]) return;
      const sl = slots[i];
      c.save();
      c.translate(sl.x, sl.y);
      c.scale(sl.s, sl.s);
      drawPerson(c, id, { sit: true, face: 1, wave: 0, bust: true });
      c.restore();
    });
  }
  function passengerSlotsSide(type) {
    if (type === 'bus') return [
      { x: -70, y: -16, s: 0.34 },
      { x: -34, y: -16, s: 0.34 },
      { x: 2, y: -16, s: 0.34 }
    ];
    if (type === 'fire') return [
      { x: 48, y: -20, s: 0.36 },
      { x: -20, y: -4, s: 0.32 },
      { x: -64, y: -4, s: 0.32 }
    ];
    if (type === 'police') return [
      { x: 40, y: -22, s: 0.36 },
      { x: -30, y: -22, s: 0.34 },
      { x: -70, y: 4, s: 0.3 }
    ];
    return [
      { x: -28, y: -22, s: 0.36 },
      { x: 40, y: 8, s: 0.28 },
      { x: -70, y: 8, s: 0.28 }
    ];
  }
  function paintCarSide(c, x, y, scale, type, paint, opt) {
    const o = opt || {};
    withSideCar(c, x, y, scale, type, paint, o, (c2, t, p, op) => {
      drawCarSide(c2, t, p, op);
      drawOccupantsSide(c2, t, op);
    });
  }

  // ---------------------------------------------------------------------------
  // TOP-DOWN CARS (town). Local space: facing +x, length ~ 110, width ~ 54
  // ---------------------------------------------------------------------------
  function drawCarTop(c, type, paint, opt) {
    const o = opt || {};
    const ink = INK, lw = 3;
    c.save();
    // shadow
    ellipse(c, 6, 8, 58, 26);
    c.fillStyle = 'rgba(40,16,50,0.22)'; c.fill();

    if (type === 'bus') drawBusTop(c, paint, o, ink, lw);
    else if (type === 'police') drawPoliceTop(c, paint, o, ink, lw);
    else if (type === 'fire') drawFireTop(c, paint, o, ink, lw);
    else drawSportsTop(c, paint, o, ink, lw);

    // occupants: Soren always in the cabin, passengers peeking
    if (o.driver !== false) {
      let hx = 18, hy = -6, hs = 0.38;
      if (type === 'bus') { hx = 40; hy = 0; hs = 0.36; }
      else if (type === 'fire') { hx = 36; hy = 0; hs = 0.36; }
      else if (type === 'police') { hx = 16; hy = -6; hs = 0.36; }
      c.save();
      c.translate(hx, hy);
      c.scale(hs, hs);
      drawPerson(c, 'soren', { sit: true, bust: true, face: 1 });
      c.restore();
    }
    const pass = o.passengers || [];
    const pslots = (type === 'bus')
      ? [{ x: 0, y: 0, s: 0.32 }, { x: -28, y: 0, s: 0.32 }, { x: -52, y: 0, s: 0.32 }]
      : (type === 'fire')
        ? [{ x: 10, y: 0, s: 0.32 }, { x: -24, y: 0, s: 0.3 }, { x: -50, y: 0, s: 0.3 }]
        : [{ x: 14, y: 8, s: 0.32 }, { x: -16, y: 0, s: 0.3 }, { x: -40, y: 0, s: 0.28 }];
    pass.forEach((id, i) => {
      if (!pslots[i]) return;
      c.save();
      c.translate(pslots[i].x, pslots[i].y);
      c.scale(pslots[i].s, pslots[i].s);
      drawPerson(c, id, { sit: true, bust: true, face: 1 });
      c.restore();
    });

    // cargo on the back (items)
    const cargo = o.cargo || [];
    cargo.forEach((it, i) => {
      const cx = (type === 'sports' ? -40 : -58) + (i % 2) * 16;
      const cy = ((i / 2) | 0) * 14 - 8;
      c.save();
      c.translate(cx, cy);
      c.scale(0.55, 0.55);
      drawItemIcon(c, it.kind, 0, 0, 1);
      c.restore();
    });

    if (o.shine) {
      c.globalAlpha = 0.4;
      ellipse(c, 0, 0, 50, 22);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  }

  function drawSportsTop(c, paint, o, ink, lw) {
    // wheels
    drawWheelTop(c, -30, -26, 14, 7);
    drawWheelTop(c, 34, -26, 14, 7);
    drawWheelTop(c, -30, 26, 14, 7);
    drawWheelTop(c, 34, 26, 14, 7);
    // body
    c.beginPath();
    c.moveTo(-52, -22);
    c.quadraticCurveTo(-58, 0, -52, 22);
    c.lineTo(-20, 24);
    c.quadraticCurveTo(10, 28, 50, 18);
    c.quadraticCurveTo(66, 8, 68, 0);
    c.quadraticCurveTo(66, -8, 50, -18);
    c.quadraticCurveTo(10, -28, -20, -24);
    c.closePath();
    fs(c, bodyGrad(c, paint, 0, -28, 0, 28), ink, lw);
    // cockpit
    rr(c, -16, -16, 42, 32, 10);
    fs(c, 'rgba(80,170,220,0.7)', ink, 2.2);
    // spoiler
    rr(c, -62, -20, 12, 40, 3); fs(c, paint.dark, ink, 2);
    // lights
    rr(c, 56, -14, 8, 8, 2); fs(c, '#fff6c8', ink, 1.5);
    rr(c, 56, 6, 8, 8, 2); fs(c, '#fff6c8', ink, 1.5);
    rr(c, -56, -12, 6, 8, 2); fs(c, '#ff4455', ink, 1.5);
    rr(c, -56, 4, 6, 8, 2); fs(c, '#ff4455', ink, 1.5);
  }
  function drawBusTop(c, paint, o, ink, lw) {
    drawWheelTop(c, -48, -28, 13, 7);
    drawWheelTop(c, 10, -28, 13, 7);
    drawWheelTop(c, 40, -28, 13, 7);
    drawWheelTop(c, -48, 28, 13, 7);
    drawWheelTop(c, 10, 28, 13, 7);
    drawWheelTop(c, 40, 28, 13, 7);
    rr(c, -70, -26, 148, 52, 12);
    fs(c, bodyGrad(c, paint, 0, -26, 0, 26), ink, lw);
    // roof stripe
    rr(c, -60, -8, 110, 16, 4);
    c.fillStyle = paint.dark; c.fill();
    // windows along sides
    for (let i = 0; i < 5; i++) {
      rr(c, -56 + i * 22, -24, 16, 8, 2); fs(c, 'rgba(80,170,220,0.75)', ink, 1.3);
      rr(c, -56 + i * 22, 16, 16, 8, 2); fs(c, 'rgba(80,170,220,0.75)', ink, 1.3);
    }
    rr(c, 58, -14, 16, 28, 6); fs(c, 'rgba(80,170,220,0.7)', ink, 2);
    rr(c, 72, -10, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
    rr(c, 72, 2, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
  }
  function drawPoliceTop(c, paint, o, ink, lw) {
    drawWheelTop(c, -28, -26, 14, 7);
    drawWheelTop(c, 32, -26, 14, 7);
    drawWheelTop(c, -28, 26, 14, 7);
    drawWheelTop(c, 32, 26, 14, 7);
    c.beginPath();
    c.moveTo(-56, -20);
    c.quadraticCurveTo(-62, 0, -56, 20);
    c.lineTo(-16, 24);
    c.quadraticCurveTo(20, 26, 52, 18);
    c.quadraticCurveTo(64, 6, 64, 0);
    c.quadraticCurveTo(64, -6, 52, -18);
    c.quadraticCurveTo(20, -26, -16, -24);
    c.closePath();
    fs(c, bodyGrad(c, paint, 0, -26, 0, 26), ink, lw);
    rr(c, -14, -15, 40, 30, 10); fs(c, 'rgba(80,170,220,0.7)', ink, 2);
    // light bar
    const t = o.t || 0;
    const flash = o.siren && Math.sin(t * 14) > 0;
    rr(c, -6, -22, 28, 8, 2); fs(c, '#1a1a22', ink, 1.6);
    rr(c, -4, -20, 12, 4, 1); fs(c, (o.siren ? (flash ? '#ff2040' : '#661018') : '#c01828'), ink, 1);
    rr(c, 10, -20, 12, 4, 1); fs(c, (o.siren ? (flash ? '#661018' : '#2080ff') : '#1848c0'), ink, 1);
    if (o.siren) {
      c.globalAlpha = 0.35;
      c.fillStyle = flash ? '#ff2040' : '#2080ff';
      c.beginPath(); c.arc(8, 0, 36, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    rr(c, 54, -12, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
    rr(c, 54, 4, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
  }
  function drawFireTop(c, paint, o, ink, lw) {
    drawWheelTop(c, -52, -28, 13, 7);
    drawWheelTop(c, -22, -28, 13, 7);
    drawWheelTop(c, 42, -28, 13, 7);
    drawWheelTop(c, -52, 28, 13, 7);
    drawWheelTop(c, -22, 28, 13, 7);
    drawWheelTop(c, 42, 28, 13, 7);
    rr(c, -70, -24, 90, 48, 8);
    fs(c, bodyGrad(c, paint, 0, -24, 0, 24), ink, lw);
    rr(c, 16, -24, 62, 48, 12);
    fs(c, bodyGrad(c, paint, 40, -24, 40, 24), ink, lw);
    // gold stripe
    rr(c, -68, -4, 144, 8, 0); c.fillStyle = '#f0c43c'; c.fill();
    // ladder
    rr(c, -66, -10, 88, 20, 3); fs(c, '#c5c9d2', ink, 2);
    c.strokeStyle = ink; c.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      c.beginPath(); c.moveTo(-58 + i * 14, -10); c.lineTo(-58 + i * 14, 10); c.stroke();
    }
    rr(c, 28, -14, 36, 28, 8); fs(c, 'rgba(80,170,220,0.7)', ink, 2);
    const t = o.t || 0;
    const flash = o.siren && Math.sin(t * 14) > 0;
    rr(c, 30, -22, 28, 8, 2); fs(c, '#1a1a22', ink, 1.5);
    rr(c, 32, -20, 11, 4, 1); fs(c, (o.siren ? (flash ? '#ff2040' : '#661018') : '#c01828'), ink, 1);
    rr(c, 45, -20, 11, 4, 1); fs(c, (o.siren ? (flash ? '#661018' : '#ff2040') : '#c01828'), ink, 1);
    if (o.siren) {
      c.globalAlpha = 0.32;
      c.fillStyle = '#ff2040';
      c.beginPath(); c.arc(20, 0, 38, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    rr(c, 70, -10, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
    rr(c, 70, 2, 8, 8, 2); fs(c, '#fff6c8', ink, 1.4);
  }

  // ---------------------------------------------------------------------------
  // FAMILY CHARACTERS — original cartoon art, recognizable features
  // Origin at the feet for full body; at the head-center for bust/sit.
  // ---------------------------------------------------------------------------
  const SKIN = {
    soren: '#ffd9b3',
    grandma: '#f0c4a0',
    dad: '#e8b894',
    mom: '#e0ae88'
  };
  const SKIN_SHADOW = {
    soren: '#f0b888',
    grandma: '#e0a880',
    dad: '#d49c74',
    mom: '#c89068'
  };

  function drawPerson(c, id, opt) {
    const o = opt || {};
    const faceDir = o.face == null ? 1 : o.face;
    const wave = o.wave || 0;
    const bust = !!o.bust || !!o.sit;
    const happy = o.happy !== false;
    const jump = o.jump || 0;
    c.save();
    c.scale(faceDir, 1);
    if (bust) {
      c.translate(0, 18);
      drawPersonBust(c, id, wave, happy);
    } else {
      c.translate(0, -jump);
      drawPersonFull(c, id, wave, happy, o);
    }
    c.restore();
  }

  function drawPersonFull(c, id, wave, happy, o) {
    // shadow
    ellipse(c, 0, 4, 20, 7);
    c.fillStyle = 'rgba(40,16,50,0.2)'; c.fill();

    const skin = SKIN[id];
    const shadeS = SKIN_SHADOW[id];
    const armSwing = Math.sin(wave) * 1.05;
    const walk = o.walk || 0;
    const legL = Math.sin(walk) * 0.45;
    const legR = Math.sin(walk + Math.PI) * 0.45;

    // legs
    const pants = pantsColor(id);
    const shoe = id === 'soren' ? '#6ec8ff' : (id === 'grandma' ? '#8a6a40' : (id === 'mom' ? '#2a2a33' : '#5a4030'));
    drawLeg(c, -8, -2, legL, pants, shoe, id);
    drawLeg(c, 8, -2, legR, pants, shoe, id);

    // far arm (behind)
    drawArm(c, id, -1, -armSwing * 0.6 - 0.2, skin, shadeS, false);

    // torso
    drawTorso(c, id, skin);

    // near arm (wave)
    drawArm(c, id, 1, armSwing - 0.15, skin, shadeS, true);

    // mom's bag on top of near hip
    if (id === 'mom') drawBag(c);

    // head
    c.save();
    c.translate(0, -62);
    drawHead(c, id, happy, 1);
    c.restore();
  }

  function pantsColor(id) {
    if (id === 'grandma') return '#c6a86a'; // khaki shorts
    if (id === 'dad') return '#c4a06a';     // tan pants
    if (id === 'mom') return '#6b7a38';     // olive wide pants
    return '#5aaaef';                       // Soren: little blue shorts (shirt is the described piece)
  }

  function drawLeg(c, x, y, ang, pants, shoe, id) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const short = (id === 'grandma' || id === 'soren');
    const h = short ? 16 : 26;
    rr(c, -7, -4, 14, h, 6);
    fs(c, pants, INK, 2);
    if (short && id === 'grandma') {
      // visible lower leg
      rr(c, -5, h - 6, 10, 12, 4);
      fs(c, SKIN.grandma, INK, 1.6);
    }
    if (short && id === 'soren') {
      rr(c, -5, h - 6, 10, 10, 4);
      fs(c, SKIN.soren, INK, 1.6);
    }
    // shoe
    rr(c, -8, (short ? h + 4 : h - 4), 18, 9, 4);
    fs(c, shoe, INK, 1.8);
    c.restore();
  }

  function drawArm(c, id, side, ang, skin, shadeS, isWave) {
    c.save();
    // shoulder
    const sx = side * 18;
    const sy = -50;
    c.translate(sx, sy);
    c.rotate(side * (0.15 + ang));
    // upper arm
    rr(c, -6, 0, 12, 22, 6);
    fs(c, skin, INK, 2);
    // mom tattoo on left upper arm (side === -1 is far? side 1 is near right)
    // Place tattoo on the arm that's visible: side === -1 or 1, "arm tattoo" — draw on side === 1
    if (id === 'mom' && side === 1) {
      c.save();
      c.translate(0, 10);
      c.strokeStyle = '#5a3a6a';
      c.lineWidth = 1.4;
      // small flower
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * TAU / 5;
        c.lineTo(Math.cos(a) * 4, 4 + Math.sin(a) * 4);
        c.lineTo(Math.cos(a + 0.63) * 1.6, 4 + Math.sin(a + 0.63) * 1.6);
      }
      c.closePath();
      c.fillStyle = '#c86a9a';
      c.fill();
      c.stroke();
      c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 13); c.strokeStyle = '#3a7a3a'; c.stroke();
      c.restore();
    }
    // forearm + hand (raised when waving)
    c.translate(0, 20);
    c.rotate(isWave ? -0.4 + ang * 0.4 : 0.3);
    rr(c, -5.5, 0, 11, 18, 5);
    fs(c, skin, INK, 2);
    // hand
    c.beginPath(); c.arc(0, 18, 6.5, 0, TAU);
    fs(c, skin, INK, 1.8);
    // grandma sleeveless already shows skin; dad/soren shirts are short-sleeve — a darker cuff at top of arm
    c.restore();
    // short sleeve cuff at shoulder for dad and soren
    if (id === 'dad' || id === 'soren') {
      c.save();
      c.translate(sx, sy);
      c.rotate(side * (0.15 + ang));
      rr(c, -8, -2, 16, 12, 5);
      fs(c, id === 'dad' ? '#1a1a1e' : '#f6f6f6', INK, 1.8);
      c.restore();
    }
  }

  function drawTorso(c, id, skin) {
    if (id === 'soren') {
      // white button shirt, slightly rounded
      rr(c, -18, -56, 36, 38, 10);
      fs(c, '#f6f6f6', INK, 2.4);
      // placket + buttons
      c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -24);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.arc(0, -46 + i * 9, 2.2, 0, TAU);
        fs(c, '#f0c43c', INK, 1.1);
      }
      // collar
      c.beginPath();
      c.moveTo(-10, -56); c.lineTo(0, -48); c.lineTo(10, -56);
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else if (id === 'grandma') {
      // navy sleeveless top with white pattern
      rr(c, -20, -56, 40, 32, 8);
      fs(c, '#1e3a72', INK, 2.4);
      // white dots + little diamonds
      c.fillStyle = '#f6f6f6';
      const dots = [[-10, -46], [0, -40], [10, -46], [-8, -34], [8, -34], [0, -48], [-12, -38], [12, -38]];
      dots.forEach(([x, y], i) => {
        c.beginPath();
        if (i % 3 === 0) {
          // tiny flower
          c.arc(x, y, 2.6, 0, TAU); c.fill();
        } else {
          c.arc(x, y, 2.1, 0, TAU); c.fill();
        }
      });
      // khaki shorts already drawn as legs; add a waist
      rr(c, -18, -30, 36, 10, 3);
      fs(c, '#c6a86a', INK, 2);
    } else if (id === 'dad') {
      // black short-sleeve button shirt
      rr(c, -20, -56, 40, 40, 8);
      fs(c, '#1a1a1e', INK, 2.4);
      c.beginPath(); c.moveTo(0, -52); c.lineTo(0, -22);
      c.strokeStyle = '#3a3a44'; c.lineWidth = 1.6; c.stroke();
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.arc(0, -46 + i * 9, 2, 0, TAU);
        fs(c, '#c0c4ce', INK, 1);
      }
      // tan waist
      rr(c, -18, -22, 36, 10, 3);
      fs(c, '#c4a06a', INK, 2);
    } else if (id === 'mom') {
      // white tank
      c.beginPath();
      c.moveTo(-16, -56);
      c.lineTo(-20, -28);
      c.quadraticCurveTo(0, -24, 20, -28);
      c.lineTo(16, -56);
      c.quadraticCurveTo(0, -52, -16, -56);
      c.closePath();
      fs(c, '#f6f6f6', INK, 2.4);
      // high-waist olive wide pants
      rr(c, -22, -32, 44, 20, 8);
      fs(c, '#6b7a38', INK, 2.4);
      // gold necklace
      c.beginPath();
      c.arc(0, -54, 10, 0.25, Math.PI - 0.25);
      c.strokeStyle = '#f0c43c'; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.arc(0, -44, 3.2, 0, TAU);
      fs(c, '#f0c43c', INK, 1.2);
    }
  }

  function drawBag(c) {
    c.save();
    // strap
    c.beginPath();
    c.moveTo(14, -54);
    c.quadraticCurveTo(32, -30, 16, -18);
    c.strokeStyle = INK; c.lineWidth = 3.2; c.stroke();
    c.beginPath();
    c.moveTo(14, -54);
    c.quadraticCurveTo(32, -30, 16, -18);
    c.strokeStyle = '#2a2a33'; c.lineWidth = 2; c.stroke();
    // bag
    rr(c, 8, -22, 20, 18, 5);
    fs(c, '#2a2a33', INK, 2.2);
    rr(c, 12, -18, 12, 6, 2); fs(c, '#1a1a1e', INK, 1.2);
    c.restore();
  }

  function drawPersonBust(c, id, wave, happy) {
    // Used inside cars and HUD. Head + shoulders. Origin at head center.
    const skin = SKIN[id];
    // shoulders / shirt
    c.save();
    c.translate(0, 16);
    if (id === 'soren') {
      rr(c, -20, 0, 40, 22, 8); fs(c, '#f6f6f6', INK, 2.2);
      c.beginPath(); c.moveTo(0, 2); c.lineTo(0, 16);
      c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
      c.beginPath(); c.arc(0, 8, 2, 0, TAU); fs(c, '#f0c43c', INK, 1);
    } else if (id === 'grandma') {
      rr(c, -22, 0, 44, 22, 8); fs(c, '#1e3a72', INK, 2.2);
      c.fillStyle = '#f6f6f6';
      [[-10, 8], [0, 12], [10, 8], [0, 6]].forEach(([x, y]) => {
        c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
      });
    } else if (id === 'dad') {
      rr(c, -22, 0, 44, 22, 8); fs(c, '#1a1a1e', INK, 2.2);
      c.beginPath(); c.arc(0, 8, 2, 0, TAU); fs(c, '#c0c4ce', INK, 1);
    } else {
      rr(c, -20, 0, 40, 22, 8); fs(c, '#f6f6f6', INK, 2.2);
      // necklace
      c.beginPath(); c.arc(0, 2, 8, 0.2, Math.PI - 0.2);
      c.strokeStyle = '#f0c43c'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(0, 10, 2.6, 0, TAU); fs(c, '#f0c43c', INK, 1);
    }
    c.restore();
    drawHead(c, id, happy, 1);
    // tiny wave hand for bust if waving a lot
    if (Math.abs(wave) > 0.4) {
      c.save();
      c.translate(22, 10);
      c.rotate(-0.8 + Math.sin(wave) * 0.5);
      c.beginPath(); c.arc(0, 0, 6, 0, TAU);
      fs(c, SKIN[id], INK, 1.6);
      c.restore();
    }
  }

  function drawHead(c, id, happy, scale) {
    c.save();
    c.scale(scale, scale);
    const skin = SKIN[id];
    const shadeS = SKIN_SHADOW[id];

    // ears
    c.beginPath(); c.ellipse(-21, 2, 6, 8, 0, 0, TAU);
    fs(c, shadeS, INK, 1.6);
    c.beginPath(); c.ellipse(21, 2, 6, 8, 0, 0, TAU);
    fs(c, shadeS, INK, 1.6);

    // hair behind (mom bun, grandma bob back, Soren back)
    if (id === 'mom') {
      // bun
      c.beginPath(); c.arc(0, -22, 12, 0, TAU);
      fs(c, '#2a1a18', INK, 2.2);
      c.beginPath(); c.arc(0, -22, 6, 0, TAU);
      c.fillStyle = '#3e2824'; c.fill();
    }
    if (id === 'grandma') {
      // bob back
      c.beginPath();
      c.ellipse(0, 2, 26, 26, 0, Math.PI, 0);
      c.lineTo(24, 16); c.lineTo(-24, 16);
      c.closePath();
      fs(c, '#d0c6a4', INK, 2.2);
    }
    if (id === 'soren') {
      c.beginPath();
      c.ellipse(0, -6, 24, 22, 0, Math.PI, 0, true);
      fs(c, '#fff3c0', INK, 2);
    }

    // skull
    c.beginPath(); c.ellipse(0, 0, 22, 24, 0, 0, TAU);
    fs(c, skin, INK, 2.4);

    // dad bald shine
    if (id === 'dad') {
      c.beginPath(); c.ellipse(-6, -12, 6, 4, -0.4, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
      // stubble
      c.save();
      c.beginPath();
      c.ellipse(0, 12, 16, 10, 0, 0, TAU);
      c.clip();
      c.fillStyle = 'rgba(50,38,32,0.28)';
      c.fillRect(-18, 4, 36, 20);
      c.fillStyle = 'rgba(40,30,26,0.35)';
      for (let i = 0; i < 28; i++) {
        const sx = -14 + (i * 17) % 28;
        const sy = 8 + ((i * 11) % 14);
        c.fillRect(sx, sy, 1.4, 1.4);
      }
      c.restore();
    }

    // hair front
    if (id === 'soren') {
      // platinum blond bangs + cowlick
      c.beginPath();
      c.moveTo(-22, -4);
      c.quadraticCurveTo(-18, -26, 0, -26);
      c.quadraticCurveTo(18, -26, 22, -4);
      c.quadraticCurveTo(12, -16, 0, -14);
      c.quadraticCurveTo(-12, -16, -22, -4);
      c.closePath();
      fs(c, '#fff3c0', INK, 2.2);
      // cowlick
      c.beginPath();
      c.moveTo(4, -24);
      c.quadraticCurveTo(10, -36, 16, -30);
      c.quadraticCurveTo(10, -28, 6, -22);
      fs(c, '#fff3c0', INK, 1.8);
      c.beginPath();
      c.moveTo(-16, -10);
      c.quadraticCurveTo(-4, -16, 10, -10);
      c.strokeStyle = '#e8d48a'; c.lineWidth = 1.4; c.stroke();
    } else if (id === 'grandma') {
      // straight gray-blond bob, blunt bangs
      c.beginPath();
      c.moveTo(-24, -2);
      c.quadraticCurveTo(-24, -28, 0, -28);
      c.quadraticCurveTo(24, -28, 24, -2);
      c.lineTo(24, 6);
      c.lineTo(19, 6);
      c.lineTo(19, -2);
      c.lineTo(-19, -2);
      c.lineTo(-19, 6);
      c.lineTo(-24, 6);
      c.closePath();
      fs(c, '#d0c6a4', INK, 2.2);
      // bangs straight across
      rr(c, -18, -20, 36, 12, 3);
      fs(c, '#d8ceb0', INK, 1.6);
      // parting sheen
      c.beginPath(); c.moveTo(-8, -24); c.lineTo(-4, -10);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2; c.stroke();
    } else if (id === 'mom') {
      // dark hair pulled back, neat hairline, a few strands
      c.beginPath();
      c.moveTo(-22, 0);
      c.quadraticCurveTo(-22, -26, 0, -26);
      c.quadraticCurveTo(22, -26, 22, 0);
      c.quadraticCurveTo(12, -10, 0, -8);
      c.quadraticCurveTo(-12, -10, -22, 0);
      c.closePath();
      fs(c, '#2a1a18', INK, 2.2);
      // side strands
      c.beginPath();
      c.moveTo(-20, -4); c.quadraticCurveTo(-24, 8, -16, 14);
      c.strokeStyle = '#2a1a18'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
      c.beginPath();
      c.moveTo(20, -4); c.quadraticCurveTo(24, 8, 16, 14);
      c.stroke();
    }

    // face
    // blush
    c.fillStyle = 'rgba(255,120,120,0.35)';
    c.beginPath(); c.ellipse(-12, 8, 5, 3.2, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(12, 8, 5, 3.2, 0, 0, TAU); c.fill();
    // eyes
    const eyeY = id === 'grandma' ? 0 : 1;
    if (happy) {
      // happy curved eyes (crescents) or open dots — open with sparkle is friendlier
      [[-8, eyeY], [8, eyeY]].forEach(([ex, ey]) => {
        c.beginPath(); c.ellipse(ex, ey, 4.2, 5, 0, 0, TAU);
        fs(c, '#fff', INK, 1.4);
        c.beginPath(); c.arc(ex + 0.4, ey + 0.4, 2.3, 0, TAU);
        c.fillStyle = INK; c.fill();
        c.beginPath(); c.arc(ex + 1.6, ey - 1.2, 1.1, 0, TAU);
        c.fillStyle = '#fff'; c.fill();
      });
    } else {
      [[-8, eyeY], [8, eyeY]].forEach(([ex, ey]) => {
        c.beginPath(); c.arc(ex, ey, 2.2, 0, TAU); c.fillStyle = INK; c.fill();
      });
    }
    // grandma glasses
    if (id === 'grandma') {
      c.strokeStyle = '#3a4558';
      c.lineWidth = 1.8;
      c.beginPath(); c.ellipse(-8, 1, 6.2, 5.4, 0, 0, TAU); c.stroke();
      c.beginPath(); c.ellipse(8, 1, 6.2, 5.4, 0, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(-1.8, 1); c.lineTo(1.8, 1); c.stroke();
      c.beginPath(); c.moveTo(-14.2, 1); c.lineTo(-21, 0); c.stroke();
      c.beginPath(); c.moveTo(14.2, 1); c.lineTo(21, 0); c.stroke();
      // slight glass gleam
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(-10, -2, 3, -1, 0.4); c.stroke();
    }
    // brows
    c.strokeStyle = (id === 'soren' || id === 'grandma') ? '#c8b888' : (id === 'mom' ? '#2a1a18' : '#3a3028');
    c.lineWidth = 1.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-13, eyeY - 8); c.quadraticCurveTo(-8, eyeY - 10, -4, eyeY - 8); c.stroke();
    c.beginPath(); c.moveTo(13, eyeY - 8); c.quadraticCurveTo(8, eyeY - 10, 4, eyeY - 8); c.stroke();
    // smile
    c.beginPath();
    c.arc(0, 8, 8, 0.25, Math.PI - 0.25);
    c.strokeStyle = INK; c.lineWidth = 2; c.lineCap = 'round'; c.stroke();
    // little nose
    c.beginPath();
    c.arc(0, 6, 1.4, 0, TAU);
    c.fillStyle = shadeS; c.fill();

    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Item icons (town pickups)
  // ---------------------------------------------------------------------------
  function drawItemIcon(c, kind, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (kind === 'apple') {
      c.beginPath(); c.arc(0, 4, 14, 0, TAU); fs(c, '#e4252a', INK, 2.2);
      c.beginPath(); c.arc(-5, 0, 5, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(6, -18, 8, -10);
      c.strokeStyle = '#5a3a20'; c.lineWidth = 2.4; c.stroke();
      c.beginPath(); c.ellipse(8, -12, 6, 3, 0.5, 0, TAU); fs(c, '#3dcc55', INK, 1.4);
    } else if (kind === 'banana') {
      c.save(); c.rotate(-0.4);
      c.beginPath();
      c.moveTo(-16, 6);
      c.quadraticCurveTo(0, 20, 16, 0);
      c.quadraticCurveTo(18, -8, 12, -6);
      c.quadraticCurveTo(0, 10, -14, -2);
      c.closePath();
      fs(c, '#ffd000', INK, 2.2);
      c.restore();
    } else if (kind === 'teddy') {
      c.beginPath(); c.arc(-10, -10, 7, 0, TAU); fs(c, '#c4863a', INK, 2);
      c.beginPath(); c.arc(10, -10, 7, 0, TAU); fs(c, '#c4863a', INK, 2);
      c.beginPath(); c.arc(0, 2, 13, 0, TAU); fs(c, '#d49448', INK, 2.2);
      c.beginPath(); c.arc(-5, 0, 2, 0, TAU); c.arc(5, 0, 2, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(0, 6, 4, 0.2, Math.PI - 0.2); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      c.beginPath(); c.arc(0, 5, 3, 0, TAU); fs(c, '#e8b070', INK, 1);
    } else if (kind === 'ball') {
      c.beginPath(); c.arc(0, 0, 14, 0, TAU); fs(c, '#f6f6f6', INK, 2.2);
      c.beginPath(); c.arc(0, 0, 14, 0, TAU);
      c.strokeStyle = '#e4252a'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, 14);
      c.strokeStyle = '#3a7dff'; c.lineWidth = 2; c.stroke();
    } else if (kind === 'puppy') {
      // little golden puppy
      c.beginPath(); c.ellipse(0, 6, 14, 10, 0, 0, TAU); fs(c, '#e0a050', INK, 2);
      c.beginPath(); c.arc(10, -4, 9, 0, TAU); fs(c, '#e0a050', INK, 2);
      c.beginPath(); c.ellipse(4, -12, 5, 7, -0.4, 0, TAU); fs(c, '#e0a050', INK, 1.6);
      c.beginPath(); c.ellipse(16, -12, 5, 7, 0.4, 0, TAU); fs(c, '#c48030', INK, 1.6);
      c.beginPath(); c.arc(8, -6, 1.5, 0, TAU); c.arc(13, -6, 1.5, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.ellipse(16, -2, 3, 2, 0.3, 0, TAU); fs(c, '#f0a0a8', INK, 1);
      c.beginPath(); c.moveTo(-12, 8); c.quadraticCurveTo(-20, 4, -16, 12);
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    } else if (kind === 'balloons') {
      const cols = ['#ff3b3a', '#3a7dff', '#ffd000'];
      [[-8, -8, -0.2], [8, -12, 0.2], [0, -2, 0]].forEach(([bx, by, r], i) => {
        c.save(); c.translate(bx, by); c.rotate(r);
        c.beginPath(); c.ellipse(0, 0, 8, 11, 0, 0, TAU); fs(c, cols[i], INK, 1.8);
        c.beginPath(); c.moveTo(0, 11); c.lineTo(0, 22);
        c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
        c.restore();
      });
    }
    c.restore();
  }


  // ---------------------------------------------------------------------------
  // Sky / hills / decorative UI
  // ---------------------------------------------------------------------------
  function drawSky(c, w, h, t, groundY) {
    const gy = groundY == null ? h * 0.5 : groundY;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3eb8ff');
    g.addColorStop(0.45, '#a8e6ff');
    g.addColorStop(1, '#c8f0ff');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // sun
    const sx = w * 0.88, sy = Math.max(50, gy * 0.28);
    c.beginPath(); c.arc(sx, sy, 42, 0, TAU);
    c.fillStyle = '#ffe566'; c.fill();
    c.strokeStyle = '#f0c430'; c.lineWidth = 4; c.stroke();
    // smile
    c.beginPath(); c.arc(sx, sy + 4, 18, 0.2, Math.PI - 0.2);
    c.strokeStyle = '#d4a010'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.arc(sx - 10, sy - 6, 3.2, 0, TAU); c.arc(sx + 10, sy - 6, 3.2, 0, TAU);
    c.fillStyle = '#d4a010'; c.fill();
    // rays
    c.strokeStyle = 'rgba(255,230,80,0.55)'; c.lineWidth = 5; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + t * 0.15;
      c.beginPath();
      c.moveTo(sx + Math.cos(a) * 52, sy + Math.sin(a) * 52);
      c.lineTo(sx + Math.cos(a) * 70, sy + Math.sin(a) * 70);
      c.stroke();
    }
    // clouds
    drawCloud(c, (t * 12 + 80) % (w + 200) - 80, gy * 0.22, 1);
    drawCloud(c, (t * 8 + 400) % (w + 220) - 80, gy * 0.38, 0.75);
    drawCloud(c, (t * 10 + 700) % (w + 240) - 80, gy * 0.16, 0.85);
    // hills
    c.fillStyle = '#6ed36a';
    c.beginPath();
    c.moveTo(0, gy + 20);
    for (let x = 0; x <= w; x += 16) {
      c.lineTo(x, gy + Math.sin(x * 0.012 + 1) * 18);
    }
    c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
    c.fillStyle = '#5ec45a';
    c.beginPath();
    c.moveTo(0, gy + 70);
    for (let x = 0; x <= w; x += 16) {
      c.lineTo(x, gy + 55 + Math.sin(x * 0.018 + 3) * 16);
    }
    c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
    // flowers in the foreground grass
    const rng = mulberry(17);
    for (let i = 0; i < 40; i++) {
      const fx = rng() * w;
      const fy = gy + 80 + rng() * (h - gy - 90);
      if (fy > h - 10) continue;
      const cols = ['#ff6aa6', '#ffd000', '#ff7a3a', '#c86aff', '#fff'];
      c.beginPath(); c.arc(fx, fy, 3.5, 0, TAU);
      c.fillStyle = cols[i % cols.length]; c.fill();
      c.fillStyle = '#ffe566';
      c.beginPath(); c.arc(fx, fy, 1.4, 0, TAU); c.fill();
    }
  }
  function drawCloud(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath();
    c.arc(0, 10, 22, 0, TAU);
    c.arc(24, 6, 28, 0, TAU);
    c.arc(50, 12, 20, 0, TAU);
    c.arc(28, 18, 22, 0, TAU);
    c.fill();
    c.restore();
  }

  function homeBtn() {
    const s = Math.max(72, Math.min(96, Math.min(W, H) * 0.12));
    return { x: 14, y: 14, s };
  }
  function drawHomeBtn(c) {
    const b = homeBtn();
    // rounded card
    rr(c, b.x, b.y, b.s, b.s, 18);
    fs(c, '#fff6d8', INK, 3.5);
    // house
    const cx = b.x + b.s / 2, cy = b.y + b.s / 2 + 6;
    const hs = b.s * 0.32;
    c.beginPath();
    c.moveTo(cx, cy - hs - 6);
    c.lineTo(cx + hs + 6, cy - 4);
    c.lineTo(cx + hs, cy - 4);
    c.lineTo(cx + hs, cy + hs);
    c.lineTo(cx - hs, cy + hs);
    c.lineTo(cx - hs, cy - 4);
    c.lineTo(cx - hs - 6, cy - 4);
    c.closePath();
    fs(c, '#ff7a4a', INK, 2.6);
    rr(c, cx - hs * 0.55, cy - 2, hs * 0.4, hs * 0.7, 3);
    fs(c, '#6ed0ff', INK, 1.8);
    rr(c, cx + hs * 0.1, cy + hs * 0.15, hs * 0.36, hs * 0.55, 2);
    fs(c, '#c46a30', INK, 1.6);
  }
  function hitHome(x, y) {
    if (state.scene === 'pick') return false;
    const b = homeBtn();
    return x >= b.x && x <= b.x + b.s && y >= b.y && y <= b.y + b.s;
  }

  // ---------------------------------------------------------------------------
  // Scene: PICK
  // ---------------------------------------------------------------------------
  function pickCards() {
    const top = Math.max(20, H * 0.06);
    const bot = H - 16;
    const left = 16;
    const right = W - 16;
    const cols = 2, rows = 2;
    const gap = Math.max(12, Math.min(W, H) * 0.02);
    const cw = (right - left - gap) / 2;
    const ch = (bot - top - gap) / 2;
    return CAR_IDS.map((id, i) => {
      const col = i % 2, row = (i / 2) | 0;
      return {
        id,
        x: left + col * (cw + gap),
        y: top + row * (ch + gap),
        w: cw,
        h: ch
      };
    });
  }
  let pickBounce = [0, 0, 0, 0];
  let pickFlash = -1, pickFlashT = 0;

  function enterPick() {
    state.scene = 'pick';
    state.siren = false;
    stopSiren();
    pickFlash = -1;
    pickFlashT = 0;
    // leave paint as last chosen so town-home-repick is fresh defaults? reset paint per car on pick.
  }

  function drawPick(c, dt) {
    drawSky(c, W, H, time, H * 0.42);
    // Soren waving at the bottom-center, inviting — but cars are 2x2 full screen.
    // Put a small Soren peeking from the top? Skip — he's already in each car.
    const cards = pickCards();
    cards.forEach((card, i) => {
      pickBounce[i] = Math.sin(time * 2.4 + i * 1.2) * 7;
      const press = pickFlash === i ? (1 - pickFlashT) * 0.08 : 0;
      const x = card.x, y = card.y, w = card.w, h = card.h;
      // mat
      rr(c, x, y, w, h, 28);
      const mats = ['#ffe0e0', '#fff6c0', '#dce6ff', '#ffd8c8'];
      fs(c, mats[i], INK, 4);
      // inner shine
      rr(c, x + 8, y + 8, w - 16, h - 16, 22);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      const paint = paintById(defaultPaintId(card.id));
      const scale = Math.min(w / SIDE_W, h / SIDE_H) * 0.92;
      const cx = x + w / 2;
      const cy = y + h / 2 + 8 + pickBounce[i] - press * 20;
      const opt = {
        t: time,
        spin: time * 0.4,
        driver: true,
        siren: card.id === 'police' || card.id === 'fire' ? (Math.sin(time * 3) > 0.3) : false
      };
      paintCarSide(c, cx, cy, scale, card.id, paint, opt);
      // badge icon in the corner of the card (star / flame / bus / bolt)
      drawCarBadge(c, card.id, x + 22, y + 22, 16);
    });
    if (pickFlash >= 0) {
      pickFlashT += dt;
      if (pickFlashT > 0.45) {
        const id = CAR_IDS[pickFlash];
        state.car = id;
        state.paint = defaultPaintId(id);
        pickFlash = -1;
        goScene('puzzle');
      }
    }
  }
  function drawCarBadge(c, id, x, y, r) {
    c.save();
    c.translate(x, y);
    if (id === 'sports') {
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(r * 0.4, -r * 0.1); c.lineTo(r * 0.15, -r * 0.1);
      c.lineTo(r * 0.5, r); c.lineTo(0, r * 0.15); c.lineTo(r * 0.1, r * 0.15);
      c.lineTo(-r * 0.55, -r * 0.05); c.closePath();
      fs(c, '#ffd000', INK, 2);
    } else if (id === 'bus') {
      // little schoolhouse
      rr(c, -r, -r * 0.2, r * 2, r * 1.2, 3); fs(c, '#ffd000', INK, 2);
      c.beginPath(); c.moveTo(-r - 4, -r * 0.2); c.lineTo(0, -r); c.lineTo(r + 4, -r * 0.2);
      fs(c, '#e4252a', INK, 2);
    } else if (id === 'police') {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * TAU / 5;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        c.lineTo(Math.cos(a + TAU / 10) * r * 0.42, Math.sin(a + TAU / 10) * r * 0.42);
      }
      c.closePath();
      fs(c, '#f0c43c', INK, 2);
    } else {
      // flame
      c.beginPath();
      c.moveTo(0, r);
      c.quadraticCurveTo(-r, r * 0.2, -r * 0.3, -r * 0.5);
      c.quadraticCurveTo(0, 0, 0, -r);
      c.quadraticCurveTo(0, 0, r * 0.3, -r * 0.3);
      c.quadraticCurveTo(r, r * 0.4, 0, r);
      fs(c, '#ff7a20', INK, 2);
    }
    c.restore();
  }
  function tapPick(x, y) {
    if (pickFlash >= 0) return;
    const cards = pickCards();
    for (let i = 0; i < cards.length; i++) {
      const k = cards[i];
      if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) {
        pickFlash = i;
        pickFlashT = 0;
        blip();
        burst(k.x + k.w / 2, k.y + k.h / 2, 18);
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scene: PUZZLE
  // ---------------------------------------------------------------------------
  const puzzle = {
    pieces: [],
    canvas: null,
    done: false,
    celebrate: 0,
    held: -1,
    ox: 0, oy: 0,
    hint: 0
  };

  function rasterCar(type, paint, withDriver) {
    const s = 3;
    const oc = document.createElement('canvas');
    oc.width = SIDE_W * s;
    oc.height = SIDE_H * s;
    const o = oc.getContext('2d');
    o.scale(s, s);
    o.translate(SIDE_W / 2, SIDE_CY);
    const opt = { t: 0, spin: 0, driver: !!withDriver, siren: false };
    drawCarSide(o, type, paint, opt);
    if (withDriver) drawOccupantsSide(o, type, opt);
    // Crop to the car's actual pixels so each of the 4 pieces is full of car.
    const img = o.getImageData(0, 0, oc.width, oc.height);
    let minX = oc.width, minY = oc.height, maxX = 0, maxY = 0;
    for (let y = 0; y < oc.height; y++) {
      for (let x = 0; x < oc.width; x++) {
        if (img.data[(y * oc.width + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    const padPx = 6 * s;
    minX = Math.max(0, minX - padPx);
    minY = Math.max(0, minY - padPx);
    maxX = Math.min(oc.width, maxX + padPx + 1);
    maxY = Math.min(oc.height, maxY + padPx + 1);
    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, maxX - minX);
    cropped.height = Math.max(1, maxY - minY);
    cropped.getContext('2d').drawImage(oc, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    cropped._nativeW = cropped.width / s;
    cropped._nativeH = cropped.height / s;
    return cropped;
  }

  function enterPuzzle() {
    state.scene = 'puzzle';
    puzzle.done = false;
    puzzle.celebrate = 0;
    puzzle.held = -1;
    puzzle.hint = 0;
    const paint = paintById(state.paint);
    puzzle.canvas = rasterCar(state.car, paint, false);
    layoutPuzzle(true);
  }
  function layoutPuzzle(scatter) {
    const p = pad();
    const availW = W - p.l - p.r;
    const availH = H - p.t - p.b - 80;
    const nw = (puzzle.canvas && puzzle.canvas._nativeW) || SIDE_W;
    const nh = (puzzle.canvas && puzzle.canvas._nativeH) || SIDE_H;
    const scale = Math.min(availW / nw, availH / nh) * 0.72;
    const tw = nw * scale, th = nh * scale;
    const tx = W / 2, ty = H / 2 + 10;
    puzzle.target = { x: tx, y: ty, w: tw, h: th, scale };
    const pw = tw / 2, ph = th / 2;
    const starts = [
      { x: p.l + pw * 0.6, y: p.t + 80 + ph * 0.5 },
      { x: W - p.r - pw * 0.6, y: p.t + 80 + ph * 0.5 },
      { x: p.l + pw * 0.6, y: H - p.b - ph * 0.55 },
      { x: W - p.r - pw * 0.6, y: H - p.b - ph * 0.55 }
    ];
    // shuffle starts
    for (let i = starts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = starts[i]; starts[i] = starts[j]; starts[j] = tmp;
    }
    const old = puzzle.pieces;
    puzzle.pieces = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const i = row * 2 + col;
        const tpx = tx + (col - 0.5) * pw;
        const tpy = ty + (row - 0.5) * ph;
        let x = starts[i].x, y = starts[i].y, snapped = false;
        if (!scatter && old[i]) {
          // keep relative snapped / positions on resize
          if (old[i].snapped) { x = tpx; y = tpy; snapped = true; }
          else { x = old[i].x; y = old[i].y; }
        }
        puzzle.pieces.push({
          col, row, i,
          x, y,
          tx: tpx, ty: tpy,
          w: pw, h: ph,
          rot: scatter ? (Math.random() - 0.5) * 0.5 : (old[i] && !old[i].snapped ? old[i].rot : 0),
          snapped,
          z: i
        });
      }
    }
  }

  function drawPuzzle(c, dt) {
    drawSky(c, W, H, time, H * 0.48);
    drawHomeBtn(c);
    const T = puzzle.target;
    if (!T) return;
    // faint outline of the whole car (same crop as the pieces)
    c.save();
    c.globalAlpha = 0.32;
    if (puzzle.canvas) {
      c.drawImage(puzzle.canvas, T.x - T.w / 2, T.y - T.h / 2, T.w, T.h);
    } else {
      paintCarSide(c, T.x, T.y, T.scale, state.car, paintById(state.paint), { driver: false });
    }
    c.restore();
    // dashed target frame
    c.save();
    c.strokeStyle = 'rgba(42,24,51,0.25)';
    c.setLineDash([10, 8]);
    c.lineWidth = 3;
    rr(c, T.x - T.w / 2 - 6, T.y - T.h / 2 - 6, T.w + 12, T.h + 12, 16);
    c.stroke();
    c.restore();

    // draw snapped first, then unsnapped (held on top)
    const order = puzzle.pieces.slice().sort((a, b) => {
      if (a.snapped !== b.snapped) return a.snapped ? -1 : 1;
      return a.z - b.z;
    });
    for (const pc of order) {
      if (puzzle.held === pc.i) continue;
      drawPiece(c, pc, 1);
    }
    if (puzzle.held >= 0) drawPiece(c, puzzle.pieces[puzzle.held], 1.06);

    // hint pulse
    if (!puzzle.done) {
      puzzle.hint += dt;
      if (puzzle.hint > 8) {
        const uns = puzzle.pieces.find((p) => !p.snapped);
        if (uns) {
          c.save();
          c.globalAlpha = 0.35 + Math.sin(time * 6) * 0.15;
          c.strokeStyle = '#ffd000';
          c.lineWidth = 6;
          rr(c, uns.tx - uns.w / 2, uns.ty - uns.h / 2, uns.w, uns.h, 10);
          c.stroke();
          c.restore();
        }
      }
    }

    if (puzzle.done) {
      // assembled car shines, Soren pops in
      const pop = clamp(puzzle.celebrate / 0.35, 0, 1);
      const sc = T.scale * (0.96 + smooth(pop) * 0.08);
      paintCarSide(c, T.x, T.y, sc, state.car, paintById(state.paint), { driver: pop > 0.5, t: time });
      puzzle.celebrate += dt;
      if (puzzle.celebrate > 1.7) goScene('color');
    }
  }
  function drawPiece(c, pc, sc) {
    if (puzzle.done && pc.snapped) return;
    const canvas = puzzle.canvas;
    if (!canvas) return;
    const sw = canvas.width / 2, sh = canvas.height / 2;
    const sx = pc.col * sw, sy = pc.row * sh;
    c.save();
    c.translate(pc.x, pc.y);
    c.rotate(pc.rot);
    c.scale(sc, sc);
    // shadow
    rr(c, -pc.w / 2 + 4, -pc.h / 2 + 6, pc.w, pc.h, 12);
    c.fillStyle = 'rgba(40,16,50,0.18)'; c.fill();
    // frame
    rr(c, -pc.w / 2, -pc.h / 2, pc.w, pc.h, 12);
    fs(c, '#fffaf0', INK, 3);
    c.save();
    rr(c, -pc.w / 2 + 4, -pc.h / 2 + 4, pc.w - 8, pc.h - 8, 8);
    c.clip();
    c.drawImage(canvas, sx, sy, sw, sh, -pc.w / 2, -pc.h / 2, pc.w, pc.h);
    c.restore();
    // inner rim
    rr(c, -pc.w / 2 + 3, -pc.h / 2 + 3, pc.w - 6, pc.h - 6, 10);
    c.strokeStyle = pc.snapped ? 'rgba(45,204,85,0.7)' : 'rgba(42,24,51,0.2)';
    c.lineWidth = 3; c.stroke();
    c.restore();
  }
  function pieceAt(x, y) {
    const list = puzzle.pieces.slice().sort((a, b) => b.z - a.z);
    for (const pc of list) {
      if (pc.snapped) continue;
      if (Math.abs(x - pc.x) < pc.w * 0.52 && Math.abs(y - pc.y) < pc.h * 0.52) return pc;
    }
    return null;
  }
  function trySnap(pc) {
    const snapD = Math.max(90, pc.w * 0.48);
    if (dist(pc.x, pc.y, pc.tx, pc.ty) < snapD) {
      pc.x = pc.tx; pc.y = pc.ty; pc.rot = 0; pc.snapped = true;
      snapSnd();
      sparkle(pc.x, pc.y, 10);
      if (puzzle.pieces.every((p) => p.snapped)) {
        puzzle.done = true;
        puzzle.celebrate = 0;
        fanfare();
        burst(puzzle.target.x, puzzle.target.y, 40);
      }
      return true;
    }
    return false;
  }
  function snapAll() {
    puzzle.pieces.forEach((p) => { p.x = p.tx; p.y = p.ty; p.rot = 0; p.snapped = true; });
    puzzle.done = true;
    puzzle.celebrate = 0;
    fanfare();
    burst(puzzle.target.x, puzzle.target.y, 40);
  }

  // ---------------------------------------------------------------------------
  // Scene: COLOR
  // ---------------------------------------------------------------------------
  let colorPickT = 0, colorPicked = false, colorPreview = null;
  function enterColor() {
    state.scene = 'color';
    colorPicked = false;
    colorPickT = 0;
    colorPreview = state.paint;
  }
  function colorSwatches() {
    const n = 4;
    const landscape = W > H;
    const d = Math.min(140, landscape ? H * 0.22 : W * 0.2, 160);
    const gap = 16;
    const total = n * d + (n - 1) * gap;
    let x0, y0, dx, dy;
    if (landscape) {
      x0 = W - d - 28;
      y0 = (H - total) / 2;
      dx = 0; dy = d + gap;
    } else {
      x0 = (W - total) / 2;
      y0 = H - d - 24;
      dx = d + gap; dy = 0;
    }
    return PAINTS.map((p, i) => ({
      id: p.id, paint: p,
      x: x0 + i * dx, y: y0 + i * dy, d
    }));
  }
  function drawColor(c, dt) {
    drawSky(c, W, H, time, H * 0.52);
    drawHomeBtn(c);
    const paint = paintById(colorPreview || state.paint);
    const scale = Math.min(W / SIDE_W, H / SIDE_H) * (W > H ? 0.78 : 0.7);
    const cy = W > H ? H * 0.52 : H * 0.4;
    paintCarSide(c, W * (W > H ? 0.4 : 0.5), cy, scale, state.car, paint, {
      t: time, spin: time * 0.5, driver: true, shine: colorPicked, siren: false
    });
    const sw = colorSwatches();
    sw.forEach((s) => {
      const sel = colorPreview === s.id;
      const bob = Math.sin(time * 3 + s.x) * 3;
      c.save();
      c.translate(s.x + s.d / 2, s.y + s.d / 2 + bob);
      const r = s.d / 2 - 4;
      c.beginPath(); c.arc(0, 0, r + (sel ? 6 : 0), 0, TAU);
      fs(c, s.paint.hex, INK, sel ? 6 : 4);
      if (sel) {
        c.beginPath(); c.arc(0, 0, r * 0.35, 0, TAU);
        fs(c, '#fff', INK, 2);
        // check
        c.beginPath();
        c.moveTo(-r * 0.16, 0);
        c.lineTo(-r * 0.02, r * 0.16);
        c.lineTo(r * 0.22, -r * 0.14);
        c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      }
      // highlight
      c.beginPath(); c.ellipse(-r * 0.3, -r * 0.3, r * 0.28, r * 0.18, -0.4, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
      c.restore();
    });
    if (colorPicked) {
      colorPickT += dt;
      if (colorPickT > 1.05) goScene('town');
    }
  }
  function tapColor(x, y) {
    if (colorPicked) return;
    const sw = colorSwatches();
    for (const s of sw) {
      const cx = s.x + s.d / 2, cy = s.y + s.d / 2;
      if (dist(x, y, cx, cy) < s.d / 2 + 8) {
        colorPreview = s.id;
        state.paint = s.id;
        blip();
        sparkle(cx, cy, 12);
        sparkle(W * 0.4, H * 0.5, 16);
        colorPicked = true;
        colorPickT = 0;
        burst(W * (W > H ? 0.4 : 0.5), W > H ? H * 0.52 : H * 0.4, 24, [s.paint.hex, s.paint.light, '#fff']);
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scene transitions
  // ---------------------------------------------------------------------------
  function goScene(name, instant) {
    if (name === 'pick') enterPick();
    else if (name === 'puzzle') enterPuzzle();
    else if (name === 'color') enterColor();
    else if (name === 'town') enterTown();
    state.fade = instant ? 0 : 1;
  }
  function goHome() {
    blip();
    stopSiren();
    state.siren = false;
    goScene('pick');
  }


  // ---------------------------------------------------------------------------
  // TOWN
  // ---------------------------------------------------------------------------
  const MAP_W = 2800, MAP_H = 2200;
  const ROAD_W = 150;
  const ROADS_H = [500, 1100, 1700];
  const ROADS_V = [500, 1400, 2300];

  const PLACES = {
    farm:    { x: 500,  y: 230,  r: 200, kind: 'farm',    drop: 'fruit' },
    park:    { x: 1400, y: 230,  r: 200, kind: 'park',    drop: 'fun' },
    school:  { x: 2300, y: 230,  r: 200, kind: 'school',  drop: 'toy' },
    houses:  { x: 500,  y: 800,  r: 200, kind: 'house',   drop: 'people' },
    square:  { x: 1400, y: 800,  r: 180, kind: 'square',  drop: 'fun' },
    gas:     { x: 2300, y: 800,  r: 180, kind: 'gas' },
    store:   { x: 500,  y: 1400, r: 200, kind: 'store',   drop: 'fruit' },
    wash:    { x: 1400, y: 1400, r: 160, kind: 'wash' },
    parking: { x: 2300, y: 1400, r: 200, kind: 'parking' }
  };

  const car = {
    x: 1400, y: 1100, a: 0, v: 0,
    tx: null, ty: null, dragging: false
  };
  const cam = { x: 1400, y: 1100, s: 1 };
  let townItems = [];
  let family = [];
  let cargo = [];
  let washed = 0;
  let parkCheer = 0;
  let lastParkBay = -1;
  let gasCheer = 0;
  let trafficPhase = 0;
  let townBtns = {};
  let destMarker = null;
  let decor = [];
  let animals = [];

  function placeFamilyShot() {
    // Grandma left, mom right, dad ahead-left of the car, all on the grass.
    family[0].x = 1120; family[0].y = 1220; family[0].face = 1;
    family[0].inCar = false; family[0].place = 'square'; family[0].cooldown = 8; family[0].happyT = 3; family[0].wander = 0;
    family[1].x = 1680; family[1].y = 1220; family[1].face = -1;
    family[1].inCar = false; family[1].place = 'square'; family[1].cooldown = 8; family[1].happyT = 3; family[1].wander = 0;
    family[2].x = 1180; family[2].y = 980; family[2].face = 1;
    family[2].inCar = false; family[2].place = 'square'; family[2].cooldown = 8; family[2].happyT = 3; family[2].wander = 0;
    // square place is 1400,800 — keep them from walking off during a photo
    PLACES.square.x = 1400; // stay
    family[0].place = family[1].place = family[2].place = '_shot';
    car.x = 1400; car.y = 1180; car.a = -Math.PI / 2; car.tx = null; car.v = 0;
    cam.x = 1400; cam.y = 1180;
  }

  function enterTown() {
    state.scene = 'town';
    car.x = 1400; car.y = 1100; car.a = -Math.PI / 2; car.v = 0;
    car.tx = null; car.ty = null; car.dragging = false;
    cam.x = car.x; cam.y = car.y;
    state.fuel = 0.75;
    state.shine = 0;
    washed = 0; parkCheer = 0; lastParkBay = -1; gasCheer = 0;
    cargo = [];
    destMarker = null;
    initDecor();
    initItems();
    initFamily();
    initAnimals();
  }

  function initDecor() {
    const rng = mulberry(2026);
    decor = [];
    for (let i = 0; i < 280; i++) {
      const x = rng() * MAP_W, y = rng() * MAP_H;
      if (onRoad(x, y, 20)) continue;
      const k = rng();
      if (k < 0.55) decor.push({ kind: 'flower', x, y, c: ['#ff6aa6', '#ffd000', '#ff7a3a', '#c86aff', '#fff'][(rng() * 5) | 0], r: 4 + rng() * 4 });
      else if (k < 0.8) decor.push({ kind: 'tuft', x, y, s: 0.6 + rng() * 0.6 });
      else decor.push({ kind: 'rock', x, y, s: 0.4 + rng() * 0.5 });
    }
    // trees around edges and in parks, not on roads
    for (let i = 0; i < 50; i++) {
      const x = 80 + rng() * (MAP_W - 160), y = 80 + rng() * (MAP_H - 160);
      if (onRoad(x, y, 50)) continue;
      decor.push({ kind: 'tree', x, y, s: 0.85 + rng() * 0.5, z: y });
    }
  }
  function initItems() {
    townItems = [
      { kind: 'apple',    x: 430,  y: 280, held: false, home: false, cooldown: 0, drop: 'fruit' },
      { kind: 'apple',    x: 580,  y: 200, held: false, home: false, cooldown: 0, drop: 'fruit' },
      { kind: 'banana',   x: 360,  y: 180, held: false, home: false, cooldown: 0, drop: 'fruit' },
      { kind: 'teddy',    x: 560,  y: 860, held: false, home: false, cooldown: 0, drop: 'toy' },
      { kind: 'ball',     x: 2280, y: 300, held: false, home: false, cooldown: 0, drop: 'toy' },
      { kind: 'puppy',    x: 1480, y: 260, held: false, home: false, cooldown: 0, drop: 'fun', walk: 0, wx: 1480, wy: 260 },
      { kind: 'balloons', x: 1400, y: 760, held: false, home: false, cooldown: 0, drop: 'fun' },
      { kind: 'teddy',    x: 2360, y: 200, held: false, home: false, cooldown: 0, drop: 'toy' }
    ];
  }
  function initFamily() {
    family = [
      { id: 'grandma', x: 420,  y: 860,  inCar: false, wave: 0, face: 1, cooldown: 0, happyT: 0, place: 'houses', wander: 0 },
      { id: 'mom',     x: 560,  y: 1460, inCar: false, wave: 0, face: 1, cooldown: 0, happyT: 0, place: 'store',  wander: 1.2 },
      { id: 'dad',     x: 1320, y: 280,  inCar: false, wave: 0, face: -1, cooldown: 0, happyT: 0, place: 'park',   wander: 2.4 }
    ];
    // ?shot=family clusters everyone near the starting car for a portrait
    const q = new URLSearchParams(location.search);
    if (q.get('shot') === 'family' || q.get('family') === '1') {
      placeFamilyShot();
    }
  }
  function initAnimals() {
    animals = [
      { kind: 'cow',  x: 420, y: 200, a: 0, w: 0 },
      { kind: 'pig',  x: 600, y: 300, a: 1, w: 1 },
      { kind: 'chick',x: 500, y: 300, a: 0, w: 2 },
      { kind: 'chick',x: 540, y: 160, a: 2, w: 3 },
      { kind: 'duck', x: 1480, y: 200, a: 0, w: 0, pond: true }
    ];
  }

  function onRoad(x, y, padAmt) {
    const p = padAmt || 0;
    const hw = ROAD_W / 2 + p;
    for (const ry of ROADS_H) if (Math.abs(y - ry) < hw && x > -50 && x < MAP_W + 50) return true;
    for (const rx of ROADS_V) if (Math.abs(x - rx) < hw && y > -50 && y < MAP_H + 50) return true;
    return false;
  }

  function worldToScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.s + W / 2, y: (wy - cam.y) * cam.s + H / 2 };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / cam.s + cam.x, y: (sy - H / 2) / cam.s + cam.y };
  }

  function townButtons() {
    const s = Math.max(76, Math.min(100, Math.min(W, H) * 0.13));
    const gap = 12;
    const honk = { x: W - s - 16, y: H - s - 16, s, id: 'honk' };
    const siren = (state.car === 'police' || state.car === 'fire')
      ? { x: W - s * 2 - 16 - gap, y: H - s - 16, s, id: 'siren' }
      : null;
    return { honk, siren, home: homeBtn() };
  }
  function hitTownBtn(x, y) {
    const b = townButtons();
    const hit = (btn) => btn && x >= btn.x && x <= btn.x + btn.s && y >= btn.y && y <= btn.y + btn.s;
    if (hit(b.home)) return 'home';
    if (hit(b.honk)) return 'honk';
    if (hit(b.siren)) return 'siren';
    return null;
  }

  function passengers() {
    return family.filter((f) => f.inCar).map((f) => f.id);
  }

  function stepTown(dt) {
    // camera
    const short = Math.min(W, H);
    cam.s = short / 1280;
    cam.x = lerp(cam.x, car.x, 1 - Math.exp(-dt * 5));
    cam.y = lerp(cam.y, car.y, 1 - Math.exp(-dt * 5));
    // clamp camera so we don't show too much empty (optional, allow a bit of edge)
    const hw = W / 2 / cam.s, hh = H / 2 / cam.s;
    cam.x = clamp(cam.x, hw - 40, MAP_W - hw + 40);
    cam.y = clamp(cam.y, hh - 40, MAP_H - hh + 40);

    // drive
    if (car.tx != null) {
      const dx = car.tx - car.x, dy = car.ty - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        car.v = lerp(car.v, 0, 1 - Math.exp(-dt * 8));
        if (d < 4 && !car.dragging) { car.tx = null; car.ty = null; destMarker = null; }
      } else {
        const want = Math.atan2(dy, dx);
        car.a = angLerp(car.a, want, 1 - Math.exp(-dt * 7));
        car.v = lerp(car.v, 420, 1 - Math.exp(-dt * 4));
        // drain a tiny bit of fuel, never empty-stop
        state.fuel = Math.max(0.08, state.fuel - dt * 0.015);
      }
    } else {
      car.v = lerp(car.v, 0, 1 - Math.exp(-dt * 6));
    }
    car.x += Math.cos(car.a) * car.v * dt;
    car.y += Math.sin(car.a) * car.v * dt;
    car.x = clamp(car.x, 80, MAP_W - 80);
    car.y = clamp(car.y, 80, MAP_H - 80);

    if (state.shine > 0) state.shine -= dt;
    if (state.honkFlash > 0) state.honkFlash -= dt;
    if (washed > 0) {
      washed -= dt;
      if (Math.random() < dt * 8) bubbles(car.x + (Math.random() - 0.5) * 40, car.y, 1);
    }
    trafficPhase += dt;
    if (parkCheer > 0) parkCheer -= dt;
    if (gasCheer > 0) gasCheer -= dt;

    // family wander / wave
    for (const f of family) {
      f.wave += dt * (f.happyT > 0 ? 10 : (dist(car.x, car.y, f.x, f.y) < 160 ? 8 : 3));
      if (f.cooldown > 0) f.cooldown -= dt;
      if (f.happyT > 0) f.happyT -= dt;
      if (!f.inCar) {
        f.wander += dt;
        const ox = Math.sin(f.wander * 0.6) * 28;
        const oy = Math.cos(f.wander * 0.45) * 18;
        const home = PLACES[f.place] || (f.place === '_shot' ? null : PLACES.houses);
        if (!home) { /* stay put for a family portrait */ }
        else {
        const nx = home.x + ox, ny = home.y + oy;
        // only wander if not just dropped with happy
        if (f.happyT <= 0 && f.cooldown <= 0) {
          const dx = nx - f.x, dy = ny - f.y;
          f.x += dx * dt * 0.6;
          f.y += dy * dt * 0.6;
          if (Math.abs(dx) > 4) f.face = dx >= 0 ? 1 : -1;
        }
        }
        // pickup
        if (f.cooldown <= 0 && dist(car.x, car.y, f.x, f.y) < 85) {
          f.inCar = true;
          f.cooldown = 1.4;
          pickupSnd();
          burst(f.x, f.y, 18);
          const sc = worldToScreen(f.x, f.y);
          sparkle(sc.x, sc.y, 10);
        }
      } else {
        // ride in the car (logical pos follows)
        f.x = car.x; f.y = car.y;
      }
    }
    tryDropPeople();
    tryPickupItems(dt);
    tryDropItems();
    tryWash();
    tryGas();
    tryPark();

    // animals
    for (const a of animals) {
      a.w += dt;
      a.a += Math.sin(a.w * 0.7) * dt * 0.4;
      a.x += Math.cos(a.a) * 12 * dt;
      a.y += Math.sin(a.a) * 10 * dt;
      if (a.kind === 'cow' || a.kind === 'pig' || a.kind === 'chick') {
        a.x = clamp(a.x, 320, 700);
        a.y = clamp(a.y, 120, 380);
      }
      if (a.pond) {
        a.x = clamp(a.x, 1320, 1560);
        a.y = clamp(a.y, 140, 280);
      }
    }
    // wandering puppy on ground
    for (const it of townItems) {
      if (it.kind === 'puppy' && !it.held && !it.home) {
        it.walk = (it.walk || 0) + dt;
        it.x = (it.wx || it.x) + Math.sin(it.walk * 0.8) * 40;
        it.y = (it.wy || it.y) + Math.cos(it.walk * 0.6) * 24;
      }
      if (it.cooldown > 0) it.cooldown -= dt;
    }
    // respawn long-home items
    for (const it of townItems) {
      if (it.home && it.cooldown < -10) {
        it.home = false; it.held = false;
        it.x = it.ox; it.y = it.oy;
      }
      if (!it.ox) { it.ox = it.x; it.oy = it.y; }
    }
  }

  function tryDropPeople() {
    const zones = [PLACES.houses, PLACES.park, PLACES.store, PLACES.school, PLACES.square];
    for (const f of family) {
      if (!f.inCar || f.cooldown > 0) continue;
      for (const z of zones) {
        if (dist(car.x, car.y, z.x, z.y) < z.r * 0.7) {
          f.inCar = false;
          f.place = Object.keys(PLACES).find((k) => PLACES[k] === z) || 'houses';
          f.x = z.x + (Math.random() - 0.5) * 60;
          f.y = z.y + 40 + (Math.random() - 0.5) * 40;
          f.cooldown = 1.6;
          f.happyT = 2.4;
          dropSnd();
          fanfare();
          burst(f.x, f.y, 28);
          return;
        }
      }
    }
  }
  function tryPickupItems(dt) {
    for (const it of townItems) {
      if (it.held || it.home || it.cooldown > 0) continue;
      if (cargo.length >= 4) break;
      if (dist(car.x, car.y, it.x, it.y) < 80) {
        it.held = true;
        cargo.push(it);
        it.cooldown = 1;
        pickupSnd();
        burst(it.x, it.y, 12);
      }
    }
  }
  function tryDropItems() {
    if (!cargo.length) return;
    for (const it of cargo.slice()) {
      if (it.cooldown > 0) continue;
      for (const key of Object.keys(PLACES)) {
        const z = PLACES[key];
        if (!z.drop) continue;
        if (z.drop === it.drop && dist(car.x, car.y, z.x, z.y) < z.r * 0.7) {
          it.held = false;
          it.home = true;
          it.x = z.x + (Math.random() - 0.5) * 50;
          it.y = z.y + (Math.random() - 0.5) * 50;
          it.cooldown = 0;
          cargo = cargo.filter((c) => c !== it);
          dropSnd();
          burst(it.x, it.y, 16);
          sparkle(worldToScreen(it.x, it.y).x, worldToScreen(it.x, it.y).y, 10);
          break;
        }
      }
    }
  }
  function tryWash() {
    const z = PLACES.wash;
    if (dist(car.x, car.y, z.x, z.y) < 90) {
      if (washed <= 0) {
        washed = 2.2;
        state.shine = 16;
        washSnd();
        bubbles(car.x, car.y, 20);
      }
    }
  }
  function tryGas() {
    const z = PLACES.gas;
    if (dist(car.x, car.y, z.x, z.y) < 110) {
      if (state.fuel < 0.98) {
        const was = state.fuel;
        state.fuel = Math.min(1, state.fuel + 0.6 * 0.016);
        if (was < 0.97 && state.fuel >= 0.97 && gasCheer <= 0) {
          gasCheer = 1.2;
          fillSnd();
          burst(z.x, z.y, 16, ['#2dcc55', '#ffd000', '#fff']);
        }
      }
    }
  }
  function tryPark() {
    const bays = parkingBays();
    let inBay = -1;
    for (let i = 0; i < bays.length; i++) {
      const b = bays[i];
      if (Math.abs(car.x - b.x) < 50 && Math.abs(car.y - b.y) < 36 && car.v < 40) {
        inBay = i; break;
      }
    }
    if (inBay >= 0 && inBay !== lastParkBay && parkCheer <= 0) {
      parkCheer = 1.6;
      lastParkBay = inBay;
      parkSnd();
      burst(car.x, car.y, 32);
    }
    if (inBay < 0 && car.v > 80) lastParkBay = -1;
  }
  function parkingBays() {
    const z = PLACES.parking;
    return [
      { x: z.x - 60, y: z.y - 20 },
      { x: z.x + 20, y: z.y - 20 },
      { x: z.x - 60, y: z.y + 50 },
      { x: z.x + 20, y: z.y + 50 }
    ];
  }

  // ---- town drawing ----
  function drawTown(c, dt) {
    stepTown(dt);
    // sky-tint grass background
    c.fillStyle = '#7ad65e';
    c.fillRect(0, 0, W, H);

    // world
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(cam.s, cam.s);
    c.translate(-cam.x, -cam.y);

    // grass field (slight variation)
    c.fillStyle = '#6fce58';
    c.fillRect(-40, -40, MAP_W + 80, MAP_H + 80);
    c.fillStyle = '#7ad65e';
    c.fillRect(0, 0, MAP_W, MAP_H);

    // edge hedge
    c.fillStyle = '#3fa047';
    c.fillRect(-30, -30, MAP_W + 60, 50);
    c.fillRect(-30, MAP_H - 20, MAP_W + 60, 50);
    c.fillRect(-30, -30, 50, MAP_H + 60);
    c.fillRect(MAP_W - 20, -30, 50, MAP_H + 60);

    drawRoads(c);
    drawPlaces(c);

    // decor (flowers, tufts) under actors
    for (const d of decor) {
      if (d.kind === 'tree') continue;
      if (d.kind === 'flower') {
        c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU);
        c.fillStyle = d.c; c.fill();
        c.beginPath(); c.arc(d.x, d.y, d.r * 0.35, 0, TAU);
        c.fillStyle = '#ffe566'; c.fill();
      } else if (d.kind === 'tuft') {
        c.strokeStyle = '#4aaa40'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.quadraticCurveTo(d.x - 4 * d.s, d.y - 8 * d.s, d.x, d.y - 12 * d.s);
        c.moveTo(d.x, d.y);
        c.quadraticCurveTo(d.x + 4 * d.s, d.y - 8 * d.s, d.x + 2, d.y - 11 * d.s);
        c.stroke();
      } else {
        c.beginPath(); c.ellipse(d.x, d.y, 6 * d.s, 4 * d.s, 0.2, 0, TAU);
        c.fillStyle = '#c8c0b0'; c.fill();
      }
    }

    // destination marker
    if (destMarker) {
      c.save();
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(destMarker.x, destMarker.y, 16 + Math.sin(time * 6) * 4, 0, TAU);
      c.strokeStyle = '#ffd000'; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.arc(destMarker.x, destMarker.y, 6, 0, TAU);
      c.fillStyle = '#ff3b3a'; c.fill();
      c.restore();
    }

    // y-sorted actors: trees, buildings already drawn, animals, items, family, car
    const actors = [];
    for (const d of decor) if (d.kind === 'tree') actors.push({ y: d.y, draw: () => drawTree(c, d.x, d.y, d.s) });
    for (const a of animals) actors.push({ y: a.y, draw: () => drawAnimal(c, a) });
    for (const it of townItems) if (!it.held) actors.push({ y: it.y, draw: () => {
      c.save();
      const bob = it.kind === 'balloons' ? Math.sin(time * 3) * 6 : Math.sin(time * 2 + it.x) * 3;
      drawItemIcon(c, it.kind, it.x, it.y + bob, 1.15);
      if (it.home) {
        c.globalAlpha = 0.6;
        c.beginPath();
        drawStar(c, it.x, it.y - 24, 6, time);
        c.fillStyle = '#ffd000'; c.fill();
      }
      c.restore();
    }});
    for (const f of family) if (!f.inCar) actors.push({ y: f.y, draw: () => {
      const near = dist(car.x, car.y, f.x, f.y) < 160;
      const jump = near || f.happyT > 0 ? Math.abs(Math.sin(f.wave)) * 10 : 0;
      c.save();
      c.translate(f.x, f.y);
      c.scale(1.85, 1.85);
      drawPerson(c, f.id, { wave: f.wave, face: f.face, happy: true, jump, walk: f.wander * 3 });
      c.restore();
      // heart when near
      if (near && !f.inCar) {
        c.save();
        c.globalAlpha = 0.8;
        c.fillStyle = '#ff4a6a';
        drawHeart(c, f.x, f.y - 100 + Math.sin(time * 5) * 4, 9);
        c.restore();
      }
    }});
    actors.push({ y: car.y, draw: () => {
      const paint = paintById(state.paint);
      const opt = {
        t: time,
        siren: state.siren,
        shine: state.shine > 0,
        driver: true,
        passengers: passengers(),
        cargo: cargo.slice()
      };
      c.save();
      c.translate(car.x, car.y);
      c.rotate(car.a);
      // scale top-down car: native ~ 130 long
      const sc = 1.05;
      c.scale(sc, sc);
      drawCarTop(c, state.car, paint, opt);
      // honk lines
      if (state.honkFlash > 0) {
        c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round';
        c.globalAlpha = state.honkFlash / 0.35;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(70, -16 + i * 16, 14 + (0.35 - state.honkFlash) * 30, -0.6, 0.6);
          c.stroke();
        }
      }
      c.restore();
    }});
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    // drop-zone rings when carrying people or matching items
    drawDropHints(c);

    c.restore(); // end world

    // HUD
    drawHomeBtn(c);
    drawTownHUD(c);
    drawTownButtons(c);
  }

  function drawHeart(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(-s * 1.2, -s * 0.6, -s * 0.6, -s * 1.4, 0, -s * 0.5);
    c.bezierCurveTo(s * 0.6, -s * 1.4, s * 1.2, -s * 0.6, 0, s * 0.3);
    c.fill();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.restore();
  }

  function drawDropHints(c) {
    const peopleIn = family.some((f) => f.inCar && f.cooldown <= 0);
    const kinds = new Set(cargo.filter((it) => it.cooldown <= 0).map((it) => it.drop));
    if (!peopleIn && kinds.size === 0) return;
    const zones = [];
    if (peopleIn) zones.push(PLACES.houses, PLACES.park, PLACES.store, PLACES.school);
    for (const key of Object.keys(PLACES)) {
      const z = PLACES[key];
      if (z.drop && kinds.has(z.drop)) zones.push(z);
    }
    const seen = new Set();
    for (const z of zones) {
      if (seen.has(z)) continue;
      seen.add(z);
      c.save();
      c.globalAlpha = 0.45 + Math.sin(time * 5) * 0.15;
      c.beginPath();
      c.arc(z.x, z.y + 30, z.r * 0.55, 0, TAU);
      c.strokeStyle = '#ffd000'; c.lineWidth = 8; c.setLineDash([16, 10]); c.stroke();
      // bouncing arrow
      c.setLineDash([]);
      c.translate(z.x, z.y - 40 + Math.sin(time * 6) * 8);
      c.beginPath();
      c.moveTo(0, 22); c.lineTo(14, 0); c.lineTo(5, 0); c.lineTo(5, -18);
      c.lineTo(-5, -18); c.lineTo(-5, 0); c.lineTo(-14, 0);
      c.closePath();
      fs(c, '#ffd000', INK, 2.4);
      c.restore();
    }
  }

  function drawRoads(c) {
    const ink = '#8a909c';
    const asphalt = '#a8b0bc';
    const edge = '#f4f6fa';
    function stripH(y) {
      c.fillStyle = asphalt;
      c.fillRect(-20, y - ROAD_W / 2, MAP_W + 40, ROAD_W);
      // edges
      c.fillStyle = edge;
      c.fillRect(-20, y - ROAD_W / 2, MAP_W + 40, 6);
      c.fillRect(-20, y + ROAD_W / 2 - 6, MAP_W + 40, 6);
      // dashes
      c.fillStyle = '#ffd000';
      for (let x = 0; x < MAP_W; x += 70) {
        c.fillRect(x, y - 5, 38, 10);
      }
    }
    function stripV(x) {
      c.fillStyle = asphalt;
      c.fillRect(x - ROAD_W / 2, -20, ROAD_W, MAP_H + 40);
      c.fillStyle = edge;
      c.fillRect(x - ROAD_W / 2, -20, 6, MAP_H + 40);
      c.fillRect(x + ROAD_W / 2 - 6, -20, 6, MAP_H + 40);
      c.fillStyle = '#ffd000';
      for (let y = 0; y < MAP_H; y += 70) {
        c.fillRect(x - 5, y, 10, 38);
      }
    }
    for (const y of ROADS_H) stripH(y);
    for (const x of ROADS_V) stripV(x);
    // intersection fill (clean asphalt, no dashes mess) 
    c.fillStyle = asphalt;
    for (const x of ROADS_V) for (const y of ROADS_H) {
      c.fillRect(x - ROAD_W / 2, y - ROAD_W / 2, ROAD_W, ROAD_W);
    }
  }

  function drawPlaces(c) {
    drawFarm(c, PLACES.farm);
    drawPark(c, PLACES.park);
    drawSchool(c, PLACES.school);
    drawHouses(c, PLACES.houses);
    drawSquare(c, PLACES.square);
    drawGas(c, PLACES.gas);
    drawStore(c, PLACES.store);
    drawWash(c, PLACES.wash);
    drawParking(c, PLACES.parking);
  }

  function building(c, x, y, w, h, wall, roof, rw) {
    // 3/4: front face + roof
    const d = 28;
    // side / depth
    c.beginPath();
    c.moveTo(x + w, y);
    c.lineTo(x + w + d, y - d * 0.7);
    c.lineTo(x + w + d, y + h - d * 0.7);
    c.lineTo(x + w, y + h);
    c.closePath();
    fs(c, shade(wall, -25), INK, 2.4);
    // front
    rr(c, x, y, w, h, 4);
    fs(c, wall, INK, 2.6);
    // roof
    c.beginPath();
    c.moveTo(x - 10, y + 4);
    c.lineTo(x + w / 2, y - rw);
    c.lineTo(x + w + 10, y + 4);
    c.lineTo(x + w + d, y + 4 - d * 0.7);
    c.lineTo(x + w / 2 + d * 0.4, y - rw - d * 0.55);
    c.lineTo(x - 4 + d * 0.2, y + 4 - d * 0.5);
    c.closePath();
    fs(c, roof, INK, 2.6);
  }
  function windowPair(c, x, y, n, col) {
    for (let i = 0; i < n; i++) {
      rr(c, x + i * 28, y, 20, 20, 3);
      fs(c, col || '#8ee0ff', INK, 1.8);
      c.beginPath(); c.moveTo(x + i * 28 + 10, y); c.lineTo(x + i * 28 + 10, y + 20);
      c.moveTo(x + i * 28, y + 10); c.lineTo(x + i * 28 + 20, y + 10);
      c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();
    }
  }

  function drawFarm(c, z) {
    // paddock
    c.fillStyle = '#8fd46a';
    rr(c, z.x - 180, z.y - 150, 360, 300, 16); c.fill();
    // fence
    c.strokeStyle = '#c49a5a'; c.lineWidth = 5;
    rr(c, z.x - 170, z.y - 140, 340, 280, 8); c.stroke();
    // barn
    building(c, z.x - 130, z.y - 80, 110, 90, '#e4252a', '#8a2018', 50);
    // barn door
    rr(c, z.x - 100, z.y - 20, 50, 30, 4); fs(c, '#8a3a18', INK, 2);
    c.beginPath(); c.arc(z.x - 75, z.y - 20, 25, Math.PI, 0); fs(c, '#8a3a18', INK, 2);
    // silo
    rr(c, z.x - 10, z.y - 90, 36, 100, 8); fs(c, '#d0d5de', INK, 2.4);
    c.beginPath(); c.arc(z.x + 8, z.y - 90, 20, Math.PI, 0); fs(c, '#e4252a', INK, 2);
    // veggies
    for (let i = 0; i < 6; i++) {
      c.beginPath(); c.arc(z.x + 50 + (i % 3) * 28, z.y + 20 + ((i / 3) | 0) * 24, 8, 0, TAU);
      fs(c, i % 2 ? '#e4252a' : '#ff7a20', INK, 1.4);
      c.beginPath(); c.moveTo(z.x + 50 + (i % 3) * 28, z.y + 12 + ((i / 3) | 0) * 24);
      c.lineTo(z.x + 50 + (i % 3) * 28, z.y + 4 + ((i / 3) | 0) * 24);
      c.strokeStyle = '#3a7a30'; c.lineWidth = 2; c.stroke();
    }
  }
  function drawPark(c, z) {
    c.fillStyle = '#6ed36a';
    rr(c, z.x - 190, z.y - 160, 380, 310, 20); c.fill();
    // pond
    c.beginPath(); c.ellipse(z.x + 40, z.y + 10, 80, 48, 0, 0, TAU);
    fs(c, '#5ec9ff', INK, 2.4);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(z.x + 20, z.y - 6, 24, 10, -0.3, 0, TAU); c.fill();
    // swings
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(z.x - 130, z.y - 90); c.lineTo(z.x - 50, z.y - 90);
    c.lineTo(z.x - 50, z.y - 20); c.moveTo(z.x - 130, z.y - 90); c.lineTo(z.x - 130, z.y - 20);
    c.moveTo(z.x - 110, z.y - 90); c.lineTo(z.x - 110, z.y - 30);
    c.moveTo(z.x - 70, z.y - 90); c.lineTo(z.x - 70, z.y - 30);
    c.stroke();
    rr(c, z.x - 120, z.y - 34, 20, 8, 3); fs(c, '#e4252a', INK, 1.6);
    rr(c, z.x - 80, z.y - 34, 20, 8, 3); fs(c, '#3a7dff', INK, 1.6);
    // picnic
    rr(c, z.x - 40, z.y + 70, 56, 22, 4); fs(c, '#c46a30', INK, 2);
    // flowers cluster
    [[-80, 80, '#ff6aa6'], [-60, 100, '#ffd000'], [-40, 80, '#c86aff']].forEach(([x, y, col]) => {
      c.beginPath(); c.arc(z.x + x, z.y + y, 7, 0, TAU); fs(c, col, INK, 1.2);
    });
  }
  function drawSchool(c, z) {
    building(c, z.x - 120, z.y - 60, 200, 110, '#ffd000', '#e4252a', 55);
    windowPair(c, z.x - 100, z.y - 30, 6);
    // door
    rr(c, z.x - 20, z.y + 10, 36, 40, 4); fs(c, '#3a6bcc', INK, 2);
    // bell
    c.beginPath(); c.arc(z.x, z.y - 90, 10, 0, TAU); fs(c, '#f0c43c', INK, 2);
    // flag
    c.beginPath(); c.moveTo(z.x + 90, z.y - 110); c.lineTo(z.x + 90, z.y - 20);
    c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(z.x + 90, z.y - 110); c.lineTo(z.x + 130, z.y - 98); c.lineTo(z.x + 90, z.y - 86);
    fs(c, '#3a7dff', INK, 1.6);
    // playground circle
    c.beginPath(); c.arc(z.x + 140, z.y + 80, 28, 0, TAU);
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
  }
  function drawHouses(c, z) {
    const homes = [
      { x: z.x - 150, y: z.y - 40, wall: '#ffd0c0', roof: '#e4252a' },
      { x: z.x - 20,  y: z.y - 70, wall: '#ffe9a0', roof: '#3a7dff' },
      { x: z.x + 110, y: z.y - 30, wall: '#d0f0c0', roof: '#c46a30' }
    ];
    homes.forEach((h) => {
      building(c, h.x, h.y, 90, 80, h.wall, h.roof, 40);
      windowPair(c, h.x + 10, h.y + 16, 2);
      rr(c, h.x + 50, h.y + 40, 22, 40, 3); fs(c, '#8a4a20', INK, 2);
      // door knob
      c.beginPath(); c.arc(h.x + 66, h.y + 60, 2.4, 0, TAU); c.fillStyle = '#f0c43c'; c.fill();
    });
  }
  function drawSquare(c, z) {
    // fountain
    c.beginPath(); c.arc(z.x, z.y, 50, 0, TAU); fs(c, '#d0d5de', INK, 2.6);
    c.beginPath(); c.arc(z.x, z.y, 36, 0, TAU); fs(c, '#5ec9ff', INK, 2);
    // jets
    c.strokeStyle = 'rgba(180,230,255,0.9)'; c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + time;
      c.beginPath();
      c.moveTo(z.x, z.y);
      c.quadraticCurveTo(z.x + Math.cos(a) * 10, z.y - 30 - Math.sin(time * 4) * 6, z.x + Math.cos(a) * 22, z.y - 8);
      c.stroke();
    }
    c.beginPath(); c.arc(z.x, z.y - 28 - Math.sin(time * 5) * 4, 6, 0, TAU);
    c.fillStyle = 'rgba(200,240,255,0.8)'; c.fill();
    // traffic light at nearby intersection (1400, 1100) drawn from here? draw at 1400, 1100 separately
    drawTrafficLight(c, 1400, 1040);
  }
  function drawTrafficLight(c, x, y) {
    const phase = trafficPhase % 7;
    const lit = phase < 3 ? 'green' : phase < 4 ? 'yellow' : 'red';
    rr(c, x - 16, y - 70, 32, 78, 8); fs(c, '#2a2a33', INK, 2.4);
    // pole
    rr(c, x - 5, y + 6, 10, 50, 3); fs(c, '#2a2a33', INK, 2);
    const cols = [
      { id: 'red', y: y - 54, on: '#ff3b3a', off: '#5a1818' },
      { id: 'yellow', y: y - 32, on: '#ffd000', off: '#5a4a10' },
      { id: 'green', y: y - 10, on: '#2dcc55', off: '#145a22' }
    ];
    for (const k of cols) {
      c.beginPath(); c.arc(x, k.y, 8, 0, TAU);
      fs(c, lit === k.id ? k.on : k.off, INK, 1.5);
      if (lit === k.id) {
        c.globalAlpha = 0.35;
        c.beginPath(); c.arc(x, k.y, 16, 0, TAU);
        c.fillStyle = k.on; c.fill();
        c.globalAlpha = 1;
      }
    }
  }
  function drawGas(c, z) {
    // canopy
    rr(c, z.x - 110, z.y - 90, 220, 30, 6); fs(c, '#2dcc55', INK, 2.6);
    rr(c, z.x - 120, z.y - 100, 240, 18, 6); fs(c, '#1a8a32', INK, 2.4);
    // poles
    rr(c, z.x - 90, z.y - 70, 10, 80, 2); fs(c, '#d0d5de', INK, 2);
    rr(c, z.x + 80, z.y - 70, 10, 80, 2); fs(c, '#d0d5de', INK, 2);
    // shop
    building(c, z.x + 40, z.y - 10, 80, 70, '#fff6c8', '#e4252a', 28);
    windowPair(c, z.x + 50, z.y + 10, 2);
    // pumps
    for (let i = 0; i < 2; i++) {
      const px = z.x - 80 + i * 60;
      rr(c, px, z.y - 10, 28, 50, 4); fs(c, '#e4252a', INK, 2.2);
      rr(c, px + 6, z.y - 2, 16, 16, 3); fs(c, '#ffd000', INK, 1.6);
      c.beginPath(); c.arc(px + 36, z.y + 20, 6, 0, TAU); fs(c, '#2a2a33', INK, 1.6);
    }
  }
  function drawStore(c, z) {
    building(c, z.x - 130, z.y - 50, 220, 110, '#f6f6f6', '#e4252a', 40);
    // awning
    for (let i = 0; i < 8; i++) {
      rr(c, z.x - 140 + i * 30, z.y - 58, 30, 22, 2);
      fs(c, i % 2 ? '#e4252a' : '#f6f6f6', INK, 1.6);
    }
    // big windows with produce
    rr(c, z.x - 110, z.y - 10, 80, 40, 4); fs(c, '#8ee0ff', INK, 2);
    rr(c, z.x - 10, z.y - 10, 80, 40, 4); fs(c, '#8ee0ff', INK, 2);
    // fruit display
    [[-90, 30, '#e4252a'], [-70, 32, '#ffd000'], [-50, 30, '#ff7a20'], [10, 30, '#2dcc55'], [30, 32, '#e4252a']].forEach(([x, y, col]) => {
      c.beginPath(); c.arc(z.x + x, z.y + y, 8, 0, TAU); fs(c, col, INK, 1.3);
    });
    // door
    rr(c, z.x + 80, z.y + 10, 32, 50, 4); fs(c, '#5ec9ff', INK, 2);
    // cart
    rr(c, z.x + 130, z.y + 50, 30, 18, 3); fs(c, '#a0a8b8', INK, 1.8);
    c.beginPath(); c.arc(z.x + 138, z.y + 72, 6, 0, TAU); c.arc(z.x + 154, z.y + 72, 6, 0, TAU);
    fs(c, '#2a2a33', INK, 1.5);
  }
  function drawWash(c, z) {
    // bay
    rr(c, z.x - 70, z.y - 50, 140, 140, 8); fs(c, '#d0e8ff', INK, 2.6);
    // arches
    c.strokeStyle = '#3a7dff'; c.lineWidth = 10; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(z.x, z.y + 20, 40 + i * 10, Math.PI, 0);
      c.stroke();
    }
    // brushes
    c.strokeStyle = '#8ab6ff'; c.lineWidth = 4;
    const br = time * 4;
    for (let i = 0; i < 8; i++) {
      const a = br + i * TAU / 8;
      c.beginPath();
      c.moveTo(z.x - 30, z.y);
      c.lineTo(z.x - 30 + Math.cos(a) * 16, z.y + Math.sin(a) * 16);
      c.stroke();
      c.beginPath();
      c.moveTo(z.x + 30, z.y);
      c.lineTo(z.x + 30 + Math.cos(a + 1) * 16, z.y + Math.sin(a + 1) * 16);
      c.stroke();
    }
    // soap puddle
    c.fillStyle = 'rgba(200,240,255,0.5)';
    c.beginPath(); c.ellipse(z.x, z.y + 50, 50, 16, 0, 0, TAU); c.fill();
  }
  function drawParking(c, z) {
    rr(c, z.x - 130, z.y - 90, 250, 200, 8);
    fs(c, '#9aa3b0', INK, 2.4);
    const bays = parkingBays();
    c.strokeStyle = '#f4f6fa'; c.lineWidth = 4;
    for (const b of bays) {
      rr(c, b.x - 36, b.y - 24, 72, 48, 4);
      c.stroke();
    }
    if (parkCheer > 0) {
      c.save();
      c.globalAlpha = clamp(parkCheer, 0, 1);
      c.translate(z.x, z.y - 80);
      c.beginPath();
      drawStar(c, 0, 0, 22, time * 2);
      c.fillStyle = '#ffd000'; c.fill();
      c.restore();
    }
  }

  function drawTree(c, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    // trunk
    rr(c, -7, -20, 14, 28, 3); fs(c, '#8a5a28', INK, 2);
    c.beginPath(); c.arc(0, -40, 26, 0, TAU); fs(c, '#2dcc55', INK, 2.4);
    c.beginPath(); c.arc(-14, -30, 16, 0, TAU); fs(c, '#3dcc55', INK, 2);
    c.beginPath(); c.arc(14, -32, 16, 0, TAU); fs(c, '#249a40', INK, 2);
    c.beginPath(); c.arc(0, -52, 16, 0, TAU); fs(c, '#4ae060', INK, 2);
    // fruit sometimes
    c.beginPath(); c.arc(-8, -36, 4, 0, TAU); c.fillStyle = '#e4252a'; c.fill();
    c.restore();
  }
  function drawAnimal(c, a) {
    c.save();
    c.translate(a.x, a.y);
    c.scale(a.kind === 'chick' ? 0.7 : 1, a.kind === 'chick' ? 0.7 : 1);
    const bounce = Math.sin(a.w * 4) * 2;
    c.translate(0, bounce);
    if (a.kind === 'cow') {
      ellipse(c, 0, 0, 24, 14); fs(c, '#f6f6f6', INK, 2);
      // spots
      c.beginPath(); c.ellipse(-6, 0, 7, 5, 0.3, 0, TAU); c.ellipse(10, 4, 6, 4, -0.2, 0, TAU);
      c.fillStyle = '#2a2a33'; c.fill();
      c.beginPath(); c.arc(22, -6, 10, 0, TAU); fs(c, '#f6f6f6', INK, 2);
      c.beginPath(); c.arc(18, -14, 4, 0, TAU); c.arc(26, -14, 4, 0, TAU); fs(c, '#f6f6f6', INK, 1.5);
      c.beginPath(); c.arc(20, -8, 1.5, 0, TAU); c.arc(26, -8, 1.5, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.ellipse(30, -4, 4, 3, 0.2, 0, TAU); fs(c, '#ffb0b8', INK, 1.2);
    } else if (a.kind === 'pig') {
      ellipse(c, 0, 0, 18, 12); fs(c, '#ffb0b8', INK, 2);
      c.beginPath(); c.arc(16, -4, 9, 0, TAU); fs(c, '#ffb0b8', INK, 2);
      c.beginPath(); c.ellipse(24, -2, 5, 4, 0, 0, TAU); fs(c, '#ff8a96', INK, 1.4);
      c.beginPath(); c.arc(22, -2, 1, 0, TAU); c.arc(26, -2, 1, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(13, -8, 1.5, 0, TAU); c.arc(19, -8, 1.5, 0, TAU); c.fillStyle = INK; c.fill();
    } else if (a.kind === 'chick') {
      c.beginPath(); c.arc(0, 0, 10, 0, TAU); fs(c, '#ffd000', INK, 2);
      c.beginPath(); c.arc(8, -6, 7, 0, TAU); fs(c, '#ffd000', INK, 1.8);
      c.beginPath(); c.moveTo(14, -6); c.lineTo(20, -4); c.lineTo(14, -2);
      fs(c, '#ff7a20', INK, 1.2);
      c.beginPath(); c.arc(7, -8, 1.2, 0, TAU); c.fillStyle = INK; c.fill();
    } else if (a.kind === 'duck') {
      ellipse(c, 0, 0, 12, 8); fs(c, '#f6f6f6', INK, 2);
      c.beginPath(); c.arc(10, -4, 7, 0, TAU); fs(c, '#f6f6f6', INK, 1.8);
      c.beginPath(); c.moveTo(16, -4); c.lineTo(24, -2); c.lineTo(16, 0);
      fs(c, '#ffaa20', INK, 1.2);
      c.beginPath(); c.arc(10, -6, 1.2, 0, TAU); c.fillStyle = INK; c.fill();
    }
    c.restore();
  }

  function drawTownHUD(c) {
    // fuel gauge — pictorial pump + bar
    const s = 56;
    const x = 16, y = H - s - 16;
    rr(c, x, y, 150, s, 14);
    fs(c, 'rgba(255,255,255,0.9)', INK, 3);
    // mini pump
    rr(c, x + 10, y + 10, 18, 36, 4); fs(c, '#e4252a', INK, 1.8);
    rr(c, x + 13, y + 14, 12, 12, 2); fs(c, '#ffd000', INK, 1.3);
    // bar
    const bx = x + 38, by = y + 18, bw = 100, bh = 20;
    rr(c, bx, by, bw, bh, 8); fs(c, '#e8ece0', INK, 2);
    const fw = Math.max(4, bw * state.fuel);
    c.save();
    rr(c, bx, by, bw, bh, 8); c.clip();
    c.fillStyle = state.fuel > 0.3 ? '#2dcc55' : '#ffd000';
    c.fillRect(bx, by, fw, bh);
    c.restore();
    rr(c, bx, by, bw, bh, 8); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();

    // cargo + passenger faces along the bottom-center
    const folks = passengers();
    const n = folks.length + cargo.length;
    if (n > 0) {
      const slot = 58;
      const total = n * slot;
      let sx = (W - total) / 2;
      const sy = 16;
      folks.forEach((id) => {
        rr(c, sx, sy, slot - 6, slot - 6, 14);
        fs(c, '#fff6d8', INK, 3);
        c.save();
        c.translate(sx + (slot - 6) / 2, sy + 22);
        c.scale(0.55, 0.55);
        drawPerson(c, id, { bust: true, happy: true, wave: time * 6 });
        c.restore();
        sx += slot;
      });
      cargo.forEach((it) => {
        rr(c, sx, sy, slot - 6, slot - 6, 14);
        fs(c, '#fff6d8', INK, 3);
        drawItemIcon(c, it.kind, sx + (slot - 6) / 2, sy + (slot - 6) / 2, 0.95);
        sx += slot;
      });
    }
  }
  function drawTownButtons(c) {
    const b = townButtons();
    function roundBtn(btn, fill, drawIcon) {
      if (!btn) return;
      rr(c, btn.x, btn.y, btn.s, btn.s, 20);
      fs(c, fill, INK, 4);
      c.save();
      c.translate(btn.x + btn.s / 2, btn.y + btn.s / 2);
      drawIcon(c, btn.s);
      c.restore();
    }
    roundBtn(b.honk, '#fff6d8', (c, s) => {
      // horn
      c.beginPath();
      c.ellipse(-6, 0, 12, 10, 0, 0, TAU);
      fs(c, '#ffd000', INK, 2.4);
      c.beginPath();
      c.moveTo(2, -8); c.lineTo(16, -14); c.lineTo(16, 14); c.lineTo(2, 8);
      fs(c, '#ffd000', INK, 2.2);
      // sound arcs
      c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(18, 0, 8, -0.7, 0.7); c.stroke();
      c.beginPath(); c.arc(18, 0, 14, -0.7, 0.7); c.stroke();
    });
    if (b.siren) {
      const flash = state.siren && Math.sin(time * 14) > 0;
      roundBtn(b.siren, flash ? '#ffd0d8' : '#d8e4ff', (c, s) => {
        rr(c, -22, -10, 44, 20, 6); fs(c, '#1a1a22', INK, 2);
        rr(c, -18, -6, 16, 12, 3); fs(c, flash ? '#ff2040' : '#c01828', INK, 1.4);
        rr(c, 2, -6, 16, 12, 3); fs(c, flash ? '#2080ff' : '#1848c0', INK, 1.4);
      });
    }
  }


  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const ptr = { down: false, x: 0, y: 0, id: null, grabbing: false };

  function eventXY(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top, id: e.pointerId };
  }
  function onDown(e) {
    e.preventDefault();
    unlockAudio();
    const p = eventXY(e);
    ptr.down = true; ptr.x = p.x; ptr.y = p.y; ptr.id = p.id; ptr.grabbing = false;
    if (canvas.setPointerCapture && e.pointerId != null) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (hitHome(p.x, p.y)) { goHome(); return; }
    if (state.scene === 'pick') { tapPick(p.x, p.y); return; }
    if (state.scene === 'puzzle') {
      const pc = pieceAt(p.x, p.y);
      if (pc) {
        puzzle.held = pc.i;
        puzzle.hint = 0;
        pc.z = 99;
        ptr.grabbing = true;
        ptr.ox = p.x - pc.x;
        ptr.oy = p.y - pc.y;
      }
      return;
    }
    if (state.scene === 'color') { tapColor(p.x, p.y); return; }
    if (state.scene === 'town') {
      const btn = hitTownBtn(p.x, p.y);
      if (btn === 'home') { goHome(); return; }
      if (btn === 'honk') { honk(); waveAtHonk(); return; }
      if (btn === 'siren') { toggleSiren(); return; }
      const w = screenToWorld(p.x, p.y);
      car.tx = clamp(w.x, 80, MAP_W - 80);
      car.ty = clamp(w.y, 80, MAP_H - 80);
      car.dragging = true;
      destMarker = { x: car.tx, y: car.ty };
    }
  }
  function onMove(e) {
    e.preventDefault();
    if (!ptr.down) return;
    const p = eventXY(e);
    ptr.x = p.x; ptr.y = p.y;
    if (state.scene === 'puzzle' && puzzle.held >= 0) {
      const pc = puzzle.pieces[puzzle.held];
      pc.x = p.x - (ptr.ox || 0);
      pc.y = p.y - (ptr.oy || 0);
      // magnetic hint
      const d = dist(pc.x, pc.y, pc.tx, pc.ty);
      if (d < pc.w * 0.6) {
        pc.rot = lerp(pc.rot, 0, 0.2);
      }
    }
    if (state.scene === 'town' && car.dragging) {
      const w = screenToWorld(p.x, p.y);
      car.tx = clamp(w.x, 80, MAP_W - 80);
      car.ty = clamp(w.y, 80, MAP_H - 80);
      destMarker = { x: car.tx, y: car.ty };
    }
  }
  function onUp(e) {
    e.preventDefault();
    const p = eventXY(e);
    if (state.scene === 'puzzle' && puzzle.held >= 0) {
      const pc = puzzle.pieces[puzzle.held];
      trySnap(pc);
      puzzle.held = -1;
    }
    car.dragging = false;
    ptr.down = false;
    ptr.grabbing = false;
  }
  function waveAtHonk() {
    for (const f of family) {
      if (!f.inCar && dist(car.x, car.y, f.x, f.y) < 280) {
        f.happyT = Math.max(f.happyT, 1.2);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Main loop / resize / boot
  // ---------------------------------------------------------------------------
  function preventZoom(e) { e.preventDefault(); }
  function hookInput() {
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onUp, { passive: false });
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });
    document.addEventListener('gestureend', preventZoom, { passive: false });
    document.addEventListener('dblclick', preventZoom, { passive: false });
    document.addEventListener('contextmenu', preventZoom, { passive: false });
    document.addEventListener('touchmove', preventZoom, { passive: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', onResize);
      visualViewport.addEventListener('scroll', onResize);
    }
  }
  function onResize() {
    resize();
    if (state.scene === 'puzzle' && puzzle.target) layoutPuzzle(false);
  }

  function frame(ts) {
    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    dt = clamp(dt, 0, 0.05);
    time += dt;
    if (W < 2 || H < 2) resize();

    stepParticles(dt);

    if (state.scene === 'pick') drawPick(ctx, dt);
    else if (state.scene === 'puzzle') drawPuzzle(ctx, dt);
    else if (state.scene === 'color') drawColor(ctx, dt);
    else if (state.scene === 'town') drawTown(ctx, dt);
    else drawPick(ctx, dt);

    // particles are in screen space
    drawParticles(ctx);

    // fade
    if (state.fade > 0) {
      state.fade = Math.max(0, state.fade - dt * 2.4);
      ctx.fillStyle = 'rgba(174, 230, 255,' + (state.fade * 0.85) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Query params + test hooks
  // ---------------------------------------------------------------------------
  function applyQuery() {
    const q = new URLSearchParams(location.search);
    const carQ = q.get('car');
    if (carQ && CAR_IDS.indexOf(carQ) >= 0) {
      state.car = carQ;
      state.paint = defaultPaintId(carQ);
    }
    const colQ = q.get('color');
    if (colQ && (PAINTS.some((p) => p.id === colQ) || colQ === 'white')) state.paint = colQ;
    const sc = q.get('scene');
    if (sc === 'puzzle' || sc === 'color' || sc === 'town' || sc === 'pick') {
      goScene(sc, true);
    } else {
      goScene('pick', true);
    }
    if (q.get('snap') === '1' && state.scene === 'puzzle') snapAll();
  }

  function expose() {
    window.__SOREN = {
      ready: true,
      scene: () => state.scene,
      state,
      carObj: car,
      getPickRects: () => pickCards(),
      pickCar: (id) => {
        if (CAR_IDS.indexOf(id) < 0) return;
        state.car = id;
        state.paint = defaultPaintId(id);
        goScene('puzzle', true);
      },
      getPieces: () => puzzle.pieces.map((p) => ({ x: p.x, y: p.y, tx: p.tx, ty: p.ty, w: p.w, h: p.h, snapped: p.snapped, i: p.i })),
      snapAll,
      getColorRects: () => colorSwatches(),
      pickColor: (id) => {
        state.paint = id;
        colorPreview = id;
        colorPicked = true;
        colorPickT = 0;
        goScene('town', true);
      },
      getTown: () => ({
        car: { x: car.x, y: car.y, a: car.a, v: car.v },
        cam: { x: cam.x, y: cam.y, s: cam.s },
        family: family.map((f) => ({ id: f.id, x: f.x, y: f.y, inCar: f.inCar, place: f.place })),
        items: townItems.map((it) => ({ kind: it.kind, x: it.x, y: it.y, held: it.held, home: it.home })),
        cargo: cargo.map((it) => it.kind),
        buttons: townButtons(),
        places: PLACES
      }),
      worldToScreen,
      screenToWorld,
      driveTo: (x, y) => {
        car.tx = x; car.ty = y;
        destMarker = { x, y };
      },
      setScene: (name, opts) => {
        if (opts && opts.car) { state.car = opts.car; }
        if (opts && opts.paint) { state.paint = opts.paint; }
        goScene(name, true);
        if (opts && opts.familyShot) {
          placeFamilyShot();
        }
        if (opts && opts.board) {
          family.forEach((f) => { f.inCar = true; f.cooldown = 2; });
        }
      },
      honk,
      toggleSiren,
      goHome,
      family,
      paintCarSide,
      drawPerson,
      PAINTS,
      CAR_IDS
    };
  }

  // Boot
  resize();
  hookInput();
  applyQuery();
  expose();
  requestAnimationFrame(frame);
})();
