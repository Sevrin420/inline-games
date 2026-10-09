/*
 * MEMBERSONLY POCKET: a shared handheld-console shell for the inline games.
 * Original design (molded brick handheld look); no third-party logos or art.
 *
 * Opt in with ONE line after the game's canvas/element exists:
 *   <script src="../shared/handheld/handheld.js" defer data-screen="#c" data-aspect="136/160"
 *           data-name="COOP SWEEP" data-keys='{"a":" ","b":"f"}'></script>
 * or from JS:
 *   Handheld.mount({ element: canvas, aspect: 136 / 160, name: 'COOP SWEEP',
 *                    keys: { a: ' ', b: 'f', start: 'l', select: 'm' } });
 *
 * The on-screen buttons dispatch real KeyboardEvents (keydown/keyup, with
 * key/code/keyCode) on the game element, so games keep their own key handlers.
 * A key value of 'tap' instead taps (pointer + mouse events) the screen at the
 * D-pad cursor; with { pointer: true } the D-pad moves that cursor, which lets
 * tap-only games be played from the buttons.
 *
 * v2: the screen window is always square; the game element is fitted inside it
 * at its own aspect (data-aspect, default 1) with a themed fill around it.
 * A sliding power switch on the top rim turns the screen off (CRT shut-off,
 * game frozen: requestAnimationFrame callbacks are held, Web Audio suspended,
 * input blocked) and back on (boot wordmark). Always ON on load.
 * A mute button on the body (bottom-left) silences all game audio and is
 * remembered in localStorage; power-off mute and user mute share one gate.
 *
 * The game element keeps receiving direct taps/clicks. Games must size their
 * canvas from the element's box (getBoundingClientRect), not window.inner*;
 * the shell fires a window 'resize' whenever the screen changes size.
 * Docs: docs/Handheld_Overlay.md
 */
(function () {
  'use strict';
  if (window.Handheld) return;

  var THEMES = [
    { id: 'sunset', name: 'Sunset' },          // default: orange -> magenta -> plum
    { id: 'nova', name: 'Nova' },              // midnight navy two-tone, coral + teal
    { id: 'matcha', name: 'Matcha' },
    { id: 'smoke', name: 'Clear Smoke' },
    { id: 'gold', name: 'Gold Edition' },
    { id: 'vapor', name: 'Vaporwave' },
  ];
  var DEFAULT_THEME = 'sunset';
  var SQ = { port: 340, land: 420 };           // square screen side, in unscaled body px
  var FX = ['glass', 'lcd', 'off'];
  var FX_NAME = { glass: 'Glass', lcd: 'LCD', off: 'Off' };
  var DIRS = ['up', 'down', 'left', 'right'];
  var BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
  var DEFAULT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: ' ', b: 'x', start: 'Enter', select: 'Escape' };
  var CODES = { ' ': 'Space', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', Shift: 'ShiftLeft', Control: 'ControlLeft',
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
  var KEYCODES = { ' ': 32, Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Shift: 16, Control: 17, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };

  var store = {
    get: function (k) { try { return localStorage.getItem('handheld.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('handheld.' + k, v); } catch (e) { /* storage blocked */ } },
  };
  function codeOf(k) { return CODES[k] || (/^[a-z]$/i.test(k) ? 'Key' + k.toUpperCase() : /^[0-9]$/.test(k) ? 'Digit' + k : k); }
  function keyCodeOf(k) { return KEYCODES[k] || (k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0); }
  function h(tag, cls, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function parseAspect(v) {
    if (typeof v === 'number' && v > 0) return v;
    if (typeof v === 'string') { var p = v.split('/'); var a = parseFloat(p[0]) / (p[1] ? parseFloat(p[1]) : 1); if (a > 0) return a; }
    return 0;
  }
  function cssHref() {
    var s = document.currentScript || document.querySelector('script[src*="handheld.js"]');
    return s ? s.src.replace(/handheld\.js(\?.*)?$/, 'handheld.css') : 'handheld.css';
  }
  var CSS_HREF = cssHref();
  function ensureCss() {
    if (document.querySelector('link[data-handheld-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS_HREF; l.setAttribute('data-handheld-css', '');
    l.addEventListener('load', function () { if (current) { if (styled()) current.relayout(); else current.destroy(); } });
    l.addEventListener('error', function () { if (current) current.destroy(); }); // no CSS: back to the plain game
    document.head.appendChild(l);
  }

  var current = null;

  // ---------------------------------------------------------------- power plumbing (installed at load,
  // before the game makes its first frame / audio context, so the switch can freeze and mute any game)
  var powerOff = false, held_raf = [], rawRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  if (rawRAF) {
    window.requestAnimationFrame = function (cb) { if (!powerOff) return rawRAF(cb); held_raf.push(cb); return 0; };
  }
  function thawFrames() {
    if (!rawRAF || !held_raf.length) return;
    var q = held_raf; held_raf = [];
    rawRAF(function (t) { q.forEach(function (cb) { try { cb(t); } catch (e) { setTimeout(function () { throw e; }); } }); });
  }
  // Shared audio gate: power-off OR user mute. Suspends Web Audio, mutes/pauses media.
  var userMuted = false;
  try { userMuted = localStorage.getItem('handheld.muted') === '1'; } catch (e) { /* blocked */ }
  var audioCtxs = [], heldCtx = [], heldMedia = [];
  function audioGated() { return powerOff || userMuted; }
  function gateAudio() {
    if (audioGated()) {
      audioCtxs.forEach(function (c) {
        if (c.state === 'running' && heldCtx.indexOf(c) < 0) {
          heldCtx.push(c); try { c.suspend(); } catch (e) { }
        }
      });
      Array.prototype.forEach.call(document.querySelectorAll('audio,video'), function (m) {
        if (heldMedia.some(function (x) { return x.el === m; })) return;
        var ent = { el: m, wasMuted: !!m.muted, paused: false };
        try { if (!m.muted) m.muted = true; } catch (e) { }
        if (!m.paused) { ent.paused = true; try { m.pause(); } catch (e) { } }
        heldMedia.push(ent);
      });
    } else {
      heldCtx.forEach(function (c) { try { if (c.state === 'suspended') c.resume(); } catch (e) { } });
      heldCtx = [];
      heldMedia.forEach(function (x) {
        try { if (!x.wasMuted) x.el.muted = false; } catch (e) { }
        if (x.paused) try { x.el.play(); } catch (e) { }
      });
      heldMedia = [];
    }
  }
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Orig = window[name];
    if (typeof Orig !== 'function') return;
    try {
      var Wrapped = function () {
        var c = Reflect.construct(Orig, arguments, new.target || Wrapped);
        audioCtxs.push(c);
        if (audioGated()) { try { c.suspend(); if (heldCtx.indexOf(c) < 0) heldCtx.push(c); } catch (e) { } }
        return c;
      };
      Wrapped.prototype = Orig.prototype; Object.setPrototypeOf(Wrapped, Orig);
      window[name] = Wrapped;
    } catch (e) { /* very old engine: leave audio alone */ }
  });
  // While powered off, keyboard input never reaches the game (registered at load = first in line).
  ['keydown', 'keyup', 'keypress'].forEach(function (t) {
    window.addEventListener(t, function (e) { if (powerOff && !e.handheldPower) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }, true);
  });
  // The stylesheet really applied (not blocked or served with the wrong type)?
  function styled() { return !!(current && getComputedStyle(current.root).position === 'fixed'); }

  function mount(opts) {
    opts = opts || {};
    if (current) return current;
    var el = typeof opts.element === 'string' ? document.querySelector(opts.element) : (opts.element || opts.canvas);
    if (!el) throw new Error('Handheld.mount: no element');
    var qs = new URLSearchParams(location.search);
    if (qs.has('shot') || qs.get('handheld') === 'none') return null; // card-image capture: never wrap
    ensureCss();

    var keys = {}, k;
    for (k in DEFAULT_KEYS) keys[k] = DEFAULT_KEYS[k];
    if (opts.keys) for (k in opts.keys) keys[k] = opts.keys[k];
    var pointerMode = !!opts.pointer;
    var aspect = parseAspect(opts.aspect) || 1;
    var modalSel = opts.modal === undefined ? '.lb-veil, .mo-veil' : opts.modal;
    var adoptSel = opts.adopt === undefined ? '.mo-chip' : opts.adopt;
    var diagonals = opts.diagonals !== false;
    var repeat = opts.repeat !== false;
    var labels = opts.labels || {};

    // ------------------------------------------------------------ DOM
    var root = h('div', 'hh-root');
    var device = h('div', 'hh-device');
    var screen = h('div', 'hh-screen');
    var view = h('div', 'hh-view');               // the game element lives here, fitted at its own aspect
    var cursor = h('div', 'hh-cursor');
    var black = h('div', 'hh-black');
    var pwrfx = h('div', 'hh-pwrfx', [h('div', 'hh-crtline'), h('div', 'hh-bootmark', [h('b', null, ['MEMBERSONLY']), h('i', null, ['pocket']), h('span', 'hh-bootbar', [h('i')])])]);
    screen.appendChild(black);
    screen.appendChild(view);
    view.appendChild(cursor);
    screen.appendChild(h('div', 'hh-fx'));
    screen.appendChild(h('div', 'hh-glass'));
    screen.appendChild(pwrfx);
    var led = h('i', 'hh-led hh-led-pwr'), batt = h('i', 'hh-led hh-led-batt');
    var bezel = h('div', 'hh-bezel', [
      screen,
      h('div', 'hh-bezel-foot', [
        h('span', 'hh-leds', [led, h('span', null, ['PWR']), batt, h('span', null, ['BATT'])]),
        h('span', 'hh-rule'),
        h('span', 'hh-bezel-label', ['MEMBERSONLY.CC \u00B7 INLINE PLAY SYSTEM']),
      ]),
    ]);
    var slot = h('div', 'hh-slot');
    var knob = h('span', 'hh-pwr-knob', [h('i'), h('i'), h('i')]);
    var pwr = h('div', 'hh-pwr', [h('span', 'hh-pwr-lbl', ['OFF']), h('span', 'hh-pwr-track', [h('span', 'hh-pwr-lit'), knob]), h('span', 'hh-pwr-lbl', ['ON'])]);
    pwr.setAttribute('role', 'switch'); pwr.setAttribute('aria-checked', 'true'); pwr.setAttribute('aria-label', 'Power'); pwr.title = 'Power';
    var top = h('div', 'hh-top', [pwr, h('span', 'hh-cart', [h('i')]), slot]);
    var brand = h('div', 'hh-brand', [h('b', null, ['MEMBERSONLY']), h('i', null, ['pocket']), h('span', 'hh-gamename', [opts.name || document.title || ''])]);
    var cross = h('div', 'hh-cross', [h('i', 'hh-arm hh-arm-v'), h('i', 'hh-arm hh-arm-h'), h('i', 'hh-hub'),
      h('i', 'hh-tri hh-tri-up'), h('i', 'hh-tri hh-tri-down'), h('i', 'hh-tri hh-tri-left'), h('i', 'hh-tri hh-tri-right')]);
    var dpad = h('div', 'hh-dpad', [h('div', 'hh-well'), cross]);
    function round(name, label) { var b = h('div', 'hh-btn hh-btn-' + name, [h('i', 'hh-cap')]); b.appendChild(h('span', 'hh-lbl', [label])); return b; }
    var btnB = round('b', labels.b || 'B'), btnA = round('a', labels.a || 'A');
    var ab = h('div', 'hh-ab', [h('div', 'hh-ab-well', [btnB, btnA])]);
    function pill(name, label) { return h('div', 'hh-pillwrap hh-' + name, [h('div', 'hh-pill', [h('i', 'hh-pillcap')]), h('span', 'hh-lbl', [label])]); }
    var sel = pill('select', labels.select || 'SELECT'), start = pill('start', labels.start || 'START');
    var speaker = h('div', 'hh-speaker', [h('i')]);
    var model = h('div', 'hh-model', ['MO-26 \u00B7 POCKET \u00B7 SQ']);
    var screws = ['tl', 'tr', 'bl', 'br'].map(function (p) { return h('i', 'hh-screw hh-screw-' + p); });
    // Mute button (bottom-left). Speaker icon; slash appears when muted. Replaces the old THEME/FX/HIDE pills.
    var muteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    muteSvg.setAttribute('viewBox', '0 0 24 24'); muteSvg.setAttribute('class', 'hh-mute-ico'); muteSvg.setAttribute('aria-hidden', 'true');
    muteSvg.innerHTML = '<path class="hh-spk-body" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>'
      + '<path class="hh-spk-slash" d="M3.27 2L2 3.27 21.73 23 23 21.73 3.27 2z"/>';
    var muteBtn = h('button', 'hh-mute', [muteSvg]);
    muteBtn.type = 'button';
    muteBtn.setAttribute('aria-label', 'Mute');
    muteBtn.setAttribute('aria-pressed', userMuted ? 'true' : 'false');
    muteBtn.title = userMuted ? 'Unmute' : 'Mute';
    if (userMuted) muteBtn.classList.add('hh-muted');
    var toast = h('div', 'hh-toast');
    screws.forEach(function (n) { device.appendChild(n); });
    [top, bezel, brand, dpad, ab, sel, start, muteBtn, speaker, model].forEach(function (n) { device.appendChild(n); });
    root.appendChild(device); root.appendChild(toast);

    var parent = el.parentNode, next = el.nextSibling;
    view.insertBefore(el, view.firstChild);
    el.classList.add('hh-game');
    document.body.appendChild(root);
    document.documentElement.classList.add('hh-active');


    // ------------------------------------------------------------ settings
    // Sunset is the fixed default. Theme/FX still exist via API and optional URL (?theme=), but there is no UI.
    var themeId = qs.get('theme') || opts.theme || store.get('theme') || DEFAULT_THEME;
    if (!THEMES.some(function (t) { return t.id === themeId; })) themeId = DEFAULT_THEME; // v1 ids -> new default
    var fx = opts.fx || store.get('fx') || 'glass';
    if (FX.indexOf(fx) < 0) fx = 'glass';
    // Shell is on unless ?handheld=0 (or none/shot above). No HIDE button / restore chip.
    var shown = qs.get('handheld') !== '0';
    var toastT = 0, powered = true, pwrAnim = '';
    var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    function say(t) { toast.textContent = t; toast.classList.add('hh-toast-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('hh-toast-on'); }, 1100); }
    function applyClasses() {
      root.className = 'hh-root hh-theme-' + themeId + ' hh-fx-' + fx + (shown ? '' : ' hh-off') + (layout ? ' hh-' + layout : '') + (pointerMode ? ' hh-pointer' : '') +
        (powered ? '' : ' hh-pwr-off') + (pwrAnim ? ' ' + pwrAnim : '') + (userMuted ? ' hh-audio-muted' : '');
    }
    function setTheme(id, quiet) {
      if (!THEMES.some(function (t) { return t.id === id; })) return;
      themeId = id; store.set('theme', id); applyClasses();
      if (!quiet) say(THEMES.filter(function (t) { return t.id === id; })[0].name);
    }
    function setFx(v, quiet) { if (FX.indexOf(v) < 0) return; fx = v; store.set('fx', v); applyClasses(); if (!quiet) say('Screen: ' + FX_NAME[v]); }
    function setVisible(v) {
      if (!v && !powered) setPower(true, true); // never leave a hidden, powered-off game behind
      shown = !!v;
      if (!shown) releaseAll();
      layoutNow();
    }
    function setMuted(on, quiet) {
      on = !!on;
      if (on === userMuted) { applyClasses(); muteBtn.classList.toggle('hh-muted', on); muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); return; }
      userMuted = on;
      store.set('muted', on ? '1' : '0');
      muteBtn.classList.toggle('hh-muted', on);
      muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      muteBtn.title = on ? 'Unmute' : 'Mute';
      muteBtn.setAttribute('aria-label', on ? 'Unmute' : 'Mute');
      applyClasses();
      gateAudio();
      try { window.dispatchEvent(new CustomEvent('handheld:mute', { detail: { muted: on } })); } catch (e) { /* old browser */ }
      if (opts.onMute) try { opts.onMute(on); } catch (e) { /* game's problem */ }
      if (!quiet) say(on ? 'Muted' : 'Sound on');
    }
    function nudge(e) { e.preventDefault(); e.stopPropagation(); }
    muteBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); muteBtn.classList.add('hh-down'); });
    muteBtn.addEventListener('pointerup', function () { muteBtn.classList.remove('hh-down'); });
    muteBtn.addEventListener('pointercancel', function () { muteBtn.classList.remove('hh-down'); });
    muteBtn.addEventListener('pointerleave', function () { muteBtn.classList.remove('hh-down'); });
    muteBtn.addEventListener('click', function (e) { nudge(e); setMuted(!userMuted); buzz(); });
    // Apply persisted mute to audio as soon as the shell mounts (contexts may already exist).
    if (userMuted) gateAudio();

    // ------------------------------------------------------------ layout
    var dead = false, layout = '', scale = 1, inResize = false, lastW = 0, lastH = 0;
    // The screen window is a square; the game is fitted inside it at its own aspect, centred.
    function sizeScreenFor(l) {
      var side = SQ[l];
      screen.style.width = side + 'px'; screen.style.height = side + 'px';
      var vw = aspect >= 1 ? side : Math.round(side * aspect), vh = aspect >= 1 ? Math.round(side / aspect) : side;
      view.style.width = vw + 'px'; view.style.height = vh + 'px';
      view.style.left = Math.round((side - vw) / 2) + 'px'; view.style.top = Math.round((side - vh) / 2) + 'px';
      root.classList.toggle('hh-letterbox', vw < side - 1 || vh < side - 1);
      return side;
    }
    function measure(l, vw, vh) {
      layout = l; applyClasses();
      var sw = sizeScreenFor(l);
      var dw = device.offsetWidth, dh = device.offsetHeight;
      var margin = Math.min(vw, vh) < 560 ? 0.985 : 0.95;
      var s = Math.min(vw * margin / dw, vh * margin / dh);
      return { l: l, s: s, screenPx: sw * s };
    }
    function layoutNow() {
      if (dead) return;
      var vw = window.innerWidth || document.documentElement.clientWidth, vh = window.innerHeight || document.documentElement.clientHeight;
      if (!shown) {
        layout = ''; applyClasses();
        screen.style.width = ''; screen.style.height = '';
        view.style.width = view.style.height = view.style.left = view.style.top = '';
        root.appendChild(screen); // full-window play, outside the scaled body
      } else {
        if (screen.parentNode !== bezel) bezel.insertBefore(screen, bezel.firstChild);
        var want = opts.layout === 'portrait' ? 'port' : opts.layout === 'landscape' ? 'land' : '';
        var pick;
        if (want) pick = measure(want, vw, vh);
        else {
          var p = measure('port', vw, vh), q = measure('land', vw, vh);
          pick = q.screenPx > p.screenPx * 1.04 ? q : p;
        }
        if (layout !== pick.l) measure(pick.l, vw, vh);
        scale = pick.s;
        device.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(4) + ')';
      }
      lastW = vw; lastH = vh;
      adopt();
      inResize = true;
      try { window.dispatchEvent(new Event('resize')); } catch (e) { /* very old browser */ }
      inResize = false;
    }
    window.addEventListener('resize', function () {
      if (inResize) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      if (vw === lastW && vh === lastH) return;
      layoutNow();
    });
    window.addEventListener('orientationchange', function () { setTimeout(layoutNow, 120); });

    // ------------------------------------------------------------ actions
    function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* blocked */ } }
    function modalOpen() { return modalSel ? document.querySelector(modalSel) : null; }
    function key(type, k, rep, target) {
      var ev;
      var init = { key: k, code: codeOf(k), bubbles: true, cancelable: true, composed: true, repeat: !!rep, view: window };
      try { ev = new KeyboardEvent(type, init); } catch (e) { ev = document.createEvent('Event'); ev.initEvent(type, true, true); ev.key = k; }
      var kc = keyCodeOf(k);
      try { Object.defineProperty(ev, 'keyCode', { get: function () { return kc; } }); Object.defineProperty(ev, 'which', { get: function () { return kc; } }); } catch (e) { /* read-only */ }
      ev.handheld = true;
      (target || el).dispatchEvent(ev);
    }
    var cur = { x: 0.5, y: 0.5, shown: false }, tapDown = false;
    function cursorClient() {
      var r = view.getBoundingClientRect();
      return { x: r.left + cur.x * r.width, y: r.top + cur.y * r.height };
    }
    function pointer(type, buttons) {
      var p = cursorClient(), t = document.elementFromPoint(p.x, p.y) || el;
      if (!screen.contains(t)) t = el;
      var init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, screenX: p.x, screenY: p.y, button: 0, buttons: buttons, view: window };
      try {
        var pi = Object.assign({ pointerId: 4242, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: buttons ? 0.5 : 0 }, init);
        t.dispatchEvent(new PointerEvent('pointer' + type, pi));
      } catch (e) { /* no PointerEvent */ }
      if (type !== 'move') t.dispatchEvent(new MouseEvent('mouse' + type, init));
      if (type === 'up') t.dispatchEvent(new MouseEvent('click', init));
    }
    function showCursor() { cur.shown = true; cursor.classList.add('hh-cursor-on'); placeCursor(); }
    function placeCursor() { cursor.style.left = (cur.x * 100) + '%'; cursor.style.top = (cur.y * 100) + '%'; }
    // Direct touches on the screen hide the D-pad cursor.
    screen.addEventListener('pointerdown', function (e) { if (e.isTrusted && cur.shown) { cur.shown = false; cursor.classList.remove('hh-cursor-on'); } }, true);

    var held = {}, repeatT = {}, moveRAF = 0, moveStart = 0, lastMove = 0;
    function cursorLoop(now) {
      var dx = (held.right ? 1 : 0) - (held.left ? 1 : 0), dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (!dx && !dy) { moveRAF = 0; return; }
      var dt = Math.min(0.05, (now - lastMove) / 1000); lastMove = now;
      var sp = (now - moveStart > 450 ? 0.85 : 0.38) * (dx && dy ? 0.7071 : 1);
      var ar = view.offsetWidth / Math.max(1, view.offsetHeight);
      cur.x = Math.max(0, Math.min(1, cur.x + dx * sp * dt));
      cur.y = Math.max(0, Math.min(1, cur.y + dy * sp * dt * ar));
      placeCursor();
      if (tapDown) pointer('move', 1);
      moveRAF = requestAnimationFrame(cursorLoop);
    }
    function doAction(name, down) {
      if (powerOff && down) return;
      var m = modalOpen();
      if (m) { // a panel (leaderboard / sign-in) is up: B or START closes it, the rest do nothing
        if (down && (name === 'b' || name === 'start')) {
          key('keydown', 'Escape', false, m); key('keyup', 'Escape', false, m);
          var x = m.querySelector('[aria-label="Close"]');
          if (x && document.contains(x)) x.click();
        }
        return;
      }
      if (pointerMode && DIRS.indexOf(name) >= 0) {
        if (down) { if (!cur.shown) showCursor(); if (!moveRAF) { moveStart = lastMove = performance.now(); moveRAF = requestAnimationFrame(cursorLoop); } }
        return;
      }
      var v = keys[name];
      if (v == null || v === '') return;
      if (typeof v === 'function') { v(down); return; }
      if (v === 'tap') {
        if (down) { if (pointerMode && !cur.shown) showCursor(); tapDown = true; pointer('down', 1); }
        else if (tapDown) { tapDown = false; pointer('up', 0); }
        return;
      }
      if (down) {
        key('keydown', v, false);
        if (repeat && DIRS.indexOf(name) >= 0) {
          clearInterval(repeatT[name]);
          repeatT[name] = setTimeout(function rep() { if (!held[name]) return; key('keydown', v, true); repeatT[name] = setTimeout(rep, 85); }, 320);
        }
      } else { clearTimeout(repeatT[name]); key('keyup', v, false); }
    }
    var ledT = 0;
    function visual(name, on) {
      if (DIRS.indexOf(name) >= 0) {
        dpad.classList.toggle('hh-p-' + name, on);
        var rx = (held.up ? 1 : 0) - (held.down ? 1 : 0), ry = (held.right ? 1 : 0) - (held.left ? 1 : 0);
        cross.style.transform = (rx || ry) ? 'perspective(260px) rotateX(' + (rx * 11) + 'deg) rotateY(' + (ry * 11) + 'deg)' : '';
      } else {
        var b = name === 'start' ? start : name === 'select' ? sel : name === 'a' ? btnA : btnB;
        b.classList.toggle('hh-down', on);
      }
      if (on) { led.classList.add('hh-led-blink'); clearTimeout(ledT); ledT = setTimeout(function () { led.classList.remove('hh-led-blink'); }, 90); }
    }
    function press(name) {
      if (held[name]) return;
      held[name] = true; visual(name, true); buzz(); doAction(name, true);
      if (opts.onButton) try { opts.onButton(name, true); } catch (e) { /* game's problem */ }
    }
    function release(name) {
      if (!held[name]) return;
      held[name] = false; visual(name, false); doAction(name, false);
      if (opts.onButton) try { opts.onButton(name, false); } catch (e) { /* game's problem */ }
    }
    function releaseAll() { BUTTONS.forEach(release); pointers = {}; counts = {}; }

    // ------------------------------------------------------------ touch / mouse on the controls
    // Every pointer is hit-tested against all controls on each move, so fingers can
    // slide across the D-pad (and from B to A), several at once.
    var pointers = {}, counts = {}, rects = null;
    function rectsNow() {
      return {
        dpad: dpad.getBoundingClientRect(),
        btn: [['a', btnA.querySelector('.hh-cap')], ['b', btnB.querySelector('.hh-cap')], ['start', start.querySelector('.hh-pill')], ['select', sel.querySelector('.hh-pill')]]
          .map(function (p) { return [p[0], p[1].getBoundingClientRect()]; }),
      };
    }
    function hit(x, y) {
      var out = [], R = rects || rectsNow();
      var d = R.dpad, cx = d.left + d.width / 2, cy = d.top + d.height / 2, rad = d.width / 2;
      var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= rad * 1.3 && dist >= rad * 0.14) {
        var ang = Math.atan2(dy, dx) * 180 / Math.PI; // 0 = right, 90 = down
        var a = (ang + 360) % 360, diag = diagonals ? 22 : 0;
        if (a >= 315 - diag || a < 45 + diag) out.push('right');
        if (a >= 45 - diag && a < 135 + diag) out.push('down');
        if (a >= 135 - diag && a < 225 + diag) out.push('left');
        if (a >= 225 - diag && a < 315 + diag) out.push('up');
        if (out.length > 2) out = out.slice(0, 2);
        return out;
      }
      var best = null, bestD = 1e9, pad = 10 * scale;
      R.btn.forEach(function (p) {
        var r = p[1];
        if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return;
        var ddx = x - (r.left + r.width / 2), ddy = y - (r.top + r.height / 2), dd = ddx * ddx + ddy * ddy;
        if (dd < bestD) { bestD = dd; best = p[0]; }
      });
      if (best) out.push(best);
      return out;
    }
    function setPointer(id, names) {
      var old = pointers[id] || [];
      old.forEach(function (n) { if (names.indexOf(n) < 0) { counts[n] = (counts[n] || 1) - 1; if (!counts[n]) release(n); } });
      names.forEach(function (n) { if (old.indexOf(n) < 0) { counts[n] = (counts[n] || 0) + 1; if (counts[n] === 1) press(n); } });
      if (names.length || pointers[id]) pointers[id] = names;
    }
    function controlsTarget(t) { return t && device.contains(t) && !screen.contains(t) && !muteBtn.contains(t) && !top.contains(t); }
    device.addEventListener('pointerdown', function (e) {
      if (!controlsTarget(e.target)) return;
      e.preventDefault();
      rects = rectsNow();
      try { device.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      pointers[e.pointerId] = pointers[e.pointerId] || [];
      setPointer(e.pointerId, hit(e.clientX, e.clientY));
    });
    device.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      e.preventDefault();
      setPointer(e.pointerId, hit(e.clientX, e.clientY));
    });
    function up(e) { if (!pointers[e.pointerId]) return; setPointer(e.pointerId, []); delete pointers[e.pointerId]; }
    device.addEventListener('pointerup', up);
    device.addEventListener('pointercancel', up);
    device.addEventListener('lostpointercapture', up);
    ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu', 'selectstart'].forEach(function (t) {
      device.addEventListener(t, function (e) { if (controlsTarget(e.target) && e.cancelable) e.preventDefault(); }, { passive: false });
    });
    window.addEventListener('blur', function () { releaseAll(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });

    // Physical keys light up the matching on-screen button (display only).
    var reverse = {};
    BUTTONS.forEach(function (n) { var v = keys[n]; if (typeof v === 'string' && v !== 'tap') reverse[v.length === 1 ? v.toLowerCase() : v] = n; });
    function mirror(e, on) {
      if (!e.isTrusted || e.handheld || !shown) return;
      var n = reverse[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (n && !held[n]) visual(n, on);
    }
    window.addEventListener('keydown', function (e) { mirror(e, true); }, true);
    window.addEventListener('keyup', function (e) { mirror(e, false); }, true);

    // Adopt small fixed-position widgets (the sign-in chip) into a slot on the
    // shell's top edge, so they cover neither the game nor the controls. With the
    // shell hidden they go back to the page as they were.
    function adopt() {
      if (!adoptSel || dead) return;
      Array.prototype.forEach.call(document.querySelectorAll(adoptSel), function (n) {
        if (shown && n.parentNode !== slot) { n.classList.add('hh-adopted'); slot.appendChild(n); }
        else if (!shown && n.parentNode === slot) { n.classList.remove('hh-adopted'); document.body.appendChild(n); }
      });
    }
    var mo = adoptSel && window.MutationObserver ? new MutationObserver(adopt) : null;
    if (mo) mo.observe(document.body, { childList: true });
    adopt();

    // ------------------------------------------------------------ power switch
    var pwrTimers = [];
    function clearPwr() { pwrTimers.forEach(clearTimeout); pwrTimers = []; }
    function later(ms, fn) { pwrTimers.push(setTimeout(fn, ms)); }
    function setAnim(a) { pwrAnim = a; applyClasses(); }
    function emit(on) {
      try { window.dispatchEvent(new CustomEvent('handheld:power', { detail: { on: on } })); } catch (e) { /* old browser */ }
      if (opts.onPower) try { opts.onPower(on); } catch (e) { /* game's problem */ }
    }
    // OFF: CRT shut-off, then black; the game is frozen (rAF held), muted and gets no input.
    // ON: short boot (wordmark), then the picture opens back up and the game resumes where it was.
    function setPower(on, quick) {
      on = !!on;
      if (on === powered && !pwrAnim) return;
      clearPwr();
      if (!on) {
        if (powered) { releaseAll(); try { window.dispatchEvent(new Event('blur')); } catch (e) { } }
        powered = false; powerOff = true; gateAudio();
        pwr.setAttribute('aria-checked', 'false');
        if (quick || reduced) setAnim(''); else { setAnim('hh-anim-off'); later(560, function () { setAnim(''); }); }
        emit(false);
      } else {
        powered = true; pwr.setAttribute('aria-checked', 'true');
        var wake = function () { powerOff = false; thawFrames(); gateAudio(); emit(true); };
        if (quick || reduced) { setAnim(''); wake(); return; }
        setAnim('hh-anim-boot');
        later(1250, function () { wake(); setAnim('hh-anim-on'); });
        later(1700, function () { setAnim(''); });
      }
    }
    // Tap to toggle, or drag the knob; it snaps to whichever side it ends nearer.
    var drag = null;
    pwr.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      drag = { id: e.pointerId, x: e.clientX, dx: 0, base: powered ? 1 : 0 };
      try { pwr.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      pwr.classList.add('hh-pwr-press');
    });
    pwr.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = (e.clientX - drag.x) / (scale || 1);
      if (Math.abs(drag.dx) > 3) { pwr.classList.add('hh-pwr-drag'); var p = Math.max(0, Math.min(1, drag.base + drag.dx / 18)); knob.style.setProperty('--k', p.toFixed(3)); }
    });
    function pwrUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var moved = Math.abs(drag.dx) > 6, p = Math.max(0, Math.min(1, drag.base + drag.dx / 18));
      var want = moved ? p > 0.5 : !powered;
      drag = null; pwr.classList.remove('hh-pwr-drag', 'hh-pwr-press'); knob.style.removeProperty('--k');
      if (e.type !== 'pointercancel') { buzz(); setPower(want); }
    }
    pwr.addEventListener('pointerup', pwrUp);
    pwr.addEventListener('pointercancel', pwrUp);
    pwr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });

    // ------------------------------------------------------------ boot
    applyClasses();
    layoutNow();
    var seen = false;
    try { seen = sessionStorage.getItem('handheld.boot') === '1'; sessionStorage.setItem('handheld.boot', '1'); } catch (e) { /* blocked */ }
    if (!seen && shown && opts.boot !== false && !reduced) { setAnim('hh-anim-flash'); later(1500, function () { setAnim(''); }); }
    // late fonts / CSS: lay out again once everything has loaded
    window.addEventListener('load', function () { if (dead) return; if (current && !styled() && document.querySelector('link[data-handheld-css]').sheet) current.destroy(); else layoutNow(); });
    setTimeout(layoutNow, 60);

    current = {
      root: root, screen: screen, element: el,
      press: press, release: release,
      tap: function () { doAction('a', true); doAction('a', false); },
      setTheme: setTheme, setFx: setFx, setVisible: setVisible, setPower: setPower, setMuted: setMuted,
      get power() { return powered; },
      get muted() { return userMuted; },
      get theme() { return themeId; }, get fx() { return fx; }, get visible() { return shown; }, get layout() { return layout || 'off'; },
      get cursor() { return { x: cur.x, y: cur.y, shown: cur.shown }; },
      setCursor: function (x, y) { cur.x = x; cur.y = y; showCursor(); },
      relayout: layoutNow,
      destroy: function () {
        if (dead) return;
        if (!powered || powerOff) setPower(true, true);
        clearPwr(); releaseAll(); dead = true; if (mo) mo.disconnect();
        if (screen.parentNode !== bezel) bezel.insertBefore(screen, bezel.firstChild);
        el.classList.remove('hh-game');
        if (next && next.parentNode === parent) parent.insertBefore(el, next); else parent.appendChild(el);
        Array.prototype.forEach.call(slot.querySelectorAll('.hh-adopted'), function (n) { n.classList.remove('hh-adopted'); document.body.appendChild(n); });
        root.parentNode && root.parentNode.removeChild(root);
        document.documentElement.classList.remove('hh-active');
        current = null;
        window.dispatchEvent(new Event('resize'));
      },
    };
    return current;
  }

  window.Handheld = { mount: mount, themes: THEMES.map(function (t) { return t.id; }), fx: FX.slice(), get current() { return current; } };

  // Declarative opt-in: <script src=".../handheld.js" defer data-screen="#c" ...>
  var me = document.currentScript;
  if (me && me.hasAttribute('data-screen')) {
    var go = function () {
      var keysAttr = me.getAttribute('data-keys'), parsed = null;
      if (keysAttr) try { parsed = JSON.parse(keysAttr); } catch (e) { console.warn('handheld: bad data-keys JSON'); }
      try {
        mount({
          element: me.getAttribute('data-screen'),
          aspect: me.getAttribute('data-aspect') || undefined,
          name: me.getAttribute('data-name') || undefined,
          keys: parsed || undefined,
          pointer: me.getAttribute('data-pointer') === 'true',
          layout: me.getAttribute('data-layout') || undefined,
        });
      } catch (e) { console.warn('handheld: ' + e.message); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
