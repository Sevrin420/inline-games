/* membersonly.cc shared accounts client (games/shared/auth.js)
 *
 * Optional by design: if this file or the API is missing, games keep working
 * as guests. Every call resolves (never throws) and returns null on failure.
 *
 * Two modes, picked automatically:
 *  - Top-level page: the HttpOnly session cookie does the work.
 *  - Embedded (e.g. the 480x480 X player card iframe): the page is a
 *    third-party frame, so browsers don't send SameSite=Lax cookies. The
 *    session token and anonymous id are kept in this frame's (partitioned)
 *    localStorage and sent as headers instead.
 *
 * API (window.MembersAuth):
 *   ready                       Promise<void>, settles once config + /auth/me are known
 *   available                   true if the API answered
 *   user                        null or { accountId, username, wallet, nftStatus, hasPassword }
 *   onChange(fn)                fn(user) whenever sign-in state changes
 *   signup(u, p) / login(u, p)  -> { ok, error, message, warning }
 *   logout()
 *   openAccountWindow()         popup to /account/ (wallet sign-in, linking, reset)
 *   startPlay(gameId)           -> Promise<play_id | null>
 *   endPlay(playId, { outcome, score, meta })
 *   mine(gameId)                -> { stats, plays } | null
 *   mountBadge({ gameId, formatScore, corner })  small sign-in chip + panel
 */
(function () {
  'use strict';
  if (window.MembersAuth) return;

  var BASE = '';            // same origin as the game
  var TOKEN_KEY = 'mo_token', ANON_KEY = 'mo_anon';
  var embedded = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();

  // localStorage can throw in locked-down third-party frames; fall back to memory.
  var mem = {};
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  var listeners = [];
  var A = {
    embedded: embedded,
    available: false,
    config: null,
    user: null,
    ready: null,
    onChange: function (fn) { listeners.push(fn); },
  };
  function emit() { listeners.forEach(function (fn) { try { fn(A.user); } catch (e) { /* ignore */ } }); }

  function api(method, path, body) {
    var h = { 'Accept': 'application/json' };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (embedded) {
      h['X-Auth-Mode'] = 'token';
      var t = store.get(TOKEN_KEY); if (t) h['Authorization'] = 'Bearer ' + t;
      var an = store.get(ANON_KEY); if (an) h['X-Anon-Id'] = an;
    }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    return fetch(BASE + path, {
      method: method, headers: h, credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctl ? ctl.signal : undefined,
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') < 0) return { status: res.status, json: null };
      return res.json().then(function (j) { return { status: res.status, json: j }; }, function () { return { status: res.status, json: null }; });
    }).catch(function () { if (timer) clearTimeout(timer); return { status: 0, json: null }; });
  }
  A.api = api;

  function afterSignIn(r) {
    var j = r.json || {};
    if (r.status >= 200 && r.status < 300 && j.account) {
      if (embedded && j.token) store.set(TOKEN_KEY, j.token);
      if (j.anonClaimed || embedded) store.del(ANON_KEY);
      A.user = j.account; emit();
      return { ok: true, warning: j.warning || null };
    }
    return { ok: false, error: j.error || (r.status ? 'error' : 'offline'), message: j.message || (r.status ? 'Something went wrong.' : 'Can\u2019t reach the server.') };
  }

  A.refresh = function () {
    return api('GET', '/auth/me').then(function (r) {
      if (r.status === 200 && r.json) { A.user = r.json; }
      else { A.user = null; if (r.status === 401 && embedded) store.del(TOKEN_KEY); }
      emit(); return A.user;
    });
  };
  A.signup = function (u, p) { return api('POST', '/auth/signup', { username: u, password: p }).then(afterSignIn); };
  A.login = function (u, p) { return api('POST', '/auth/login', { username: u, password: p }).then(afterSignIn); };
  A.siwe = function (purpose, address, signFn, extra) {
    // signFn(message) -> Promise<signature>. Server builds the EIP-4361 message.
    return api('POST', '/auth/siwe/nonce', { purpose: purpose, address: address }).then(function (n) {
      if (n.status !== 200 || !n.json || !n.json.message) return { status: n.status, json: n.json };
      return Promise.resolve(signFn(n.json.message)).then(function (signature) {
        var body = { message: n.json.message, signature: signature };
        for (var k in (extra || {})) body[k] = extra[k];
        return api('POST', '/auth/siwe/' + purpose, body);
      });
    }).then(afterSignIn, function (e) { return { ok: false, error: 'wallet', message: (e && e.message) || 'Wallet request was cancelled.' }; });
  };
  A.logout = function () {
    return api('POST', '/auth/logout', {}).then(function () { store.del(TOKEN_KEY); A.user = null; emit(); return true; });
  };

  A.startPlay = function (gameId) {
    if (!A.available) return A.ready.then(function () { return A.available ? A.startPlay(gameId) : null; });
    return api('POST', '/plays/start', { game_id: gameId }).then(function (r) {
      if (r.status !== 201 || !r.json) return null;
      if (embedded && r.json.anonId) store.set(ANON_KEY, r.json.anonId);
      return r.json.play_id;
    });
  };
  A.endPlay = function (playId, res) {
    if (!playId) return Promise.resolve(null);
    res = res || {};
    return api('POST', '/plays/' + encodeURIComponent(playId) + '/end', {
      outcome: res.outcome || 'completed',
      score: typeof res.score === 'number' ? Math.round(res.score) : null,
      meta: res.meta || null,
    }).then(function (r) { return r.status === 200 && r.json ? r.json.play : null; });
  };
  A.mine = function (gameId) {
    return api('GET', '/plays/mine' + (gameId ? '?game_id=' + encodeURIComponent(gameId) : '')).then(function (r) { return r.status === 200 ? r.json : null; });
  };

  // Account popup. In an embedded frame the popup signs in first-party, then
  // hands this frame a bearer token over postMessage (same origin only).
  A.openAccountWindow = function () {
    var url = BASE + '/account/' + (embedded ? '?embed=1' : '');
    var w = null;
    try { w = window.open(url, 'mo_account', 'width=420,height=640'); } catch (e) { w = null; }
    if (!w) { try { window.open(url, '_blank'); } catch (e) { /* blocked */ } }
    return w;
  };
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || !e.data || e.data.type !== 'mo-auth') return;
    if (embedded && e.data.token) store.set(TOKEN_KEY, e.data.token);
    A.refresh().then(function (u) {
      // The popup never saw this frame's anonymous id, so claim it now.
      if (u && embedded && store.get(ANON_KEY)) api('POST', '/auth/claim', {}).then(function () { store.del(ANON_KEY); });
    });
  });

  A.ready = api('GET', '/auth/config').then(function (r) {
    if (r.status !== 200 || !r.json || !r.json.siweDomain) return; // API not deployed: stay a guest, quietly
    A.available = true; A.config = r.json;
    return A.refresh();
  }).then(function () { return undefined; });

  // ------------------------------------------------------------ badge UI
  var CSS = '' +
    '.mo-chip{position:fixed;z-index:2147483000;font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:rgba(255,253,244,.92);color:#2a1a10;border:1.5px solid #2a1a10;border-radius:999px;padding:6px 10px;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.25);max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-tap-highlight-color:transparent}' +
    '.mo-chip.tl{top:6px;left:6px}.mo-chip.tr{top:6px;right:6px}.mo-chip.bl{bottom:6px;left:6px}.mo-chip.br{bottom:6px;right:6px}' +
    '.mo-veil{position:fixed;inset:0;z-index:2147483001;background:rgba(20,10,5,.55);display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box}' +
    '.mo-panel{width:100%;max-width:300px;max-height:100%;overflow:auto;box-sizing:border-box;background:#fffdf4;color:#2a1a10;border:2px solid #2a1a10;border-radius:12px;padding:14px;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.3)}' +
    '.mo-panel h2{margin:0 0 8px;font-size:17px}.mo-panel p{margin:6px 0}.mo-panel small{color:#6b5a4a}' +
    '.mo-panel input{width:100%;box-sizing:border-box;margin:4px 0;padding:8px;border:1.5px solid #2a1a10;border-radius:8px;font:inherit;background:#fff}' +
    '.mo-panel button{font:600 14px system-ui,sans-serif;border:1.5px solid #2a1a10;border-radius:8px;padding:8px 10px;margin:4px 4px 0 0;cursor:pointer;background:#f8d030;color:#2a1a10}' +
    '.mo-panel button.mo-2{background:#fff}.mo-panel .mo-err{color:#c01808;min-height:1em;font-size:13px}.mo-panel .mo-warn{background:#fff1c9;border:1px solid #e0b030;border-radius:8px;padding:6px 8px;font-size:12.5px}' +
    '.mo-panel,.mo-panel *{-webkit-user-select:text;user-select:text;touch-action:manipulation}' +
    '.mo-row{display:flex;flex-wrap:wrap;align-items:center}.mo-x{float:right;background:none!important;border:none!important;font-size:20px!important;padding:0 4px!important;margin:-6px -6px 0 0!important}';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function stop(e) { e.stopPropagation(); }

  A.mountBadge = function (opts) {
    opts = opts || {};
    var gameId = opts.gameId, fmt = opts.formatScore || function (s) { return String(s); };
    A.ready.then(function () {
      if (!A.available || document.querySelector('.mo-chip')) return;
      document.head.appendChild(el('style', { text: CSS }));
      var chip = el('button', { 'class': 'mo-chip ' + (opts.corner || 'br'), type: 'button', 'aria-label': 'Account' });
      ['pointerdown', 'touchstart', 'mousedown'].forEach(function (t) { chip.addEventListener(t, stop); });
      chip.addEventListener('click', function (e) { e.stopPropagation(); openPanel(); });
      document.body.appendChild(chip);
      function paint() { chip.textContent = A.user ? '\u{1F464} ' + A.user.username : 'Guest \u00B7 Sign in'; }
      paint(); A.onChange(paint);

      function openPanel(mode) {
        var veil = el('div', { 'class': 'mo-veil' });
        ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function (t) { veil.addEventListener(t, stop); });
        veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
        var panel = el('div', { 'class': 'mo-panel', role: 'dialog' });
        veil.appendChild(panel);
        document.body.appendChild(veil);
        function close() { if (veil.parentNode) veil.parentNode.removeChild(veil); }
        function xBtn() { return el('button', { 'class': 'mo-x', type: 'button', 'aria-label': 'Close', text: '\u00D7', onclick: close }); }

        function renderSignedIn() {
          panel.innerHTML = '';
          var u = A.user;
          var stats = el('p', { text: 'Loading your plays\u2026' });
          panel.appendChild(xBtn());
          panel.appendChild(el('h2', { text: u.username }));
          panel.appendChild(el('p', {}, [el('small', { text: u.wallet ? 'Wallet ' + u.wallet.slice(0, 6) + '\u2026' + u.wallet.slice(-4) : 'No wallet linked' })]));
          if (!u.wallet && u.hasPassword) panel.appendChild(el('p', { 'class': 'mo-warn', text: A.config.signupWarning }));
          panel.appendChild(stats);
          panel.appendChild(el('div', { 'class': 'mo-row' }, [
            el('button', { type: 'button', text: 'Back to game', onclick: close }),
            el('button', { type: 'button', 'class': 'mo-2', text: u.wallet ? 'Account' : 'Link wallet', onclick: function () { A.openAccountWindow(); } }),
            el('button', { type: 'button', 'class': 'mo-2', text: 'Sign out', onclick: function () { A.logout().then(close); } }),
          ]));
          A.mine(gameId).then(function (m) {
            if (!m) { stats.textContent = ''; return; }
            stats.textContent = m.stats.plays + ' play' + (m.stats.plays === 1 ? '' : 's') + (m.stats.best !== null ? ' \u00B7 best ' + fmt(m.stats.best) : '');
          });
        }

        function renderForm(signup) {
          panel.innerHTML = '';
          var err = el('p', { 'class': 'mo-err' });
          var user = el('input', { type: 'text', placeholder: 'Username', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', maxlength: '20' });
          var pass = el('input', { type: 'password', placeholder: 'Password', autocomplete: signup ? 'new-password' : 'current-password', maxlength: '200' });
          var go = el('button', { type: 'submit', text: signup ? 'Create account' : 'Sign in' });
          var form = el('form', {}, [user, pass, signup ? el('p', { 'class': 'mo-warn', text: A.config.signupWarning }) : null, err, el('div', { 'class': 'mo-row' }, [go,
            el('button', { type: 'button', 'class': 'mo-2', text: signup ? 'I have an account' : 'New? Create account', onclick: function () { renderForm(!signup); } })])]);
          form.addEventListener('submit', function (e) {
            e.preventDefault(); err.textContent = ''; go.disabled = true;
            (signup ? A.signup : A.login)(user.value.trim(), pass.value).then(function (r) {
              go.disabled = false;
              if (r.ok) renderSignedIn(); else err.textContent = r.message;
            });
          });
          panel.appendChild(xBtn());
          panel.appendChild(el('h2', { text: signup ? 'Create an account' : 'Sign in' }));
          panel.appendChild(el('p', {}, [el('small', { text: 'Playing as a guest works too. Your guest plays move to your account when you sign in.' })]));
          panel.appendChild(form);
          panel.appendChild(el('div', { 'class': 'mo-row' }, [
            el('button', { type: 'button', 'class': 'mo-2', text: 'Use a wallet \u2197', onclick: function () { A.openAccountWindow(); } }),
            el('button', { type: 'button', 'class': 'mo-2', text: 'Keep playing as guest', onclick: close }),
          ]));
          setTimeout(function () { try { user.focus(); } catch (e) { /* ignore */ } }, 50);
        }

        var unsub = function (u) { if (!veil.parentNode) return; if (u) renderSignedIn(); };
        A.onChange(unsub);
        if (A.user) renderSignedIn(); else renderForm(mode === 'signup');
      }
      A.openPanel = openPanel;
    });
  };

  window.MembersAuth = A;

  // Declarative mount: <script src="/shared/auth.js" data-game="lunch-rush" data-corner="br" data-score="mmss">
  var me = document.currentScript;
  if (me && me.getAttribute('data-game')) {
    var formats = { mmss: function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); } };
    var mount = function () {
      if (/[?&]shot\b/.test(location.search)) return; // card-image capture: keep the frame clean
      A.mountBadge({ gameId: me.getAttribute('data-game'), corner: me.getAttribute('data-corner') || 'br', formatScore: formats[me.getAttribute('data-score')] });
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }
})();
