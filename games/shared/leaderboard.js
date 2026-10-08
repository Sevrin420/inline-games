/* membersonly.cc shared leaderboard panel (games/shared/leaderboard.js)
 *
 * Optional, like auth.js: needs window.MembersAuth and a game with a server
 * leaderboard. If either is missing or the server can't be reached, check()
 * resolves false and the game simply doesn't offer a board.
 *
 * window.MembersLeaderboard:
 *   check(gameId)   -> Promise<boolean>   is there a reachable board for this game?
 *   open(opts)      show the panel. opts:
 *     gameId        'coop-sweep'
 *     playId        a finished play to offer for posting (omit = just view the top 10)
 *     format(value) how to show a value (default: as is)
 *     onPlayAgain() called by "Play again" / "Skip"
 *     onClose()     called whenever the panel closes
 *   isOpen()        true while the panel is showing
 * Works inside the X player-card iframe: every request goes through
 * MembersAuth.api, which sends the guest id / session token as headers there.
 */
(function () {
  'use strict';
  if (window.MembersLeaderboard) return;

  var NAME_KEY = 'mo_lb_name';
  var FONT = '"Arial Rounded MT Bold","Varela Round","Nunito","Trebuchet MS",Verdana,Arial,sans-serif';
  var INK = '#3b2a26';
  var TILE = ['#e02810', '#f8a020', '#58c848', '#3870c0', '#f088c0', '#f8d030'];
  var CSS = '' +
    '.lb-veil{position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483002;background:rgba(40,25,15,.45);display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;touch-action:pan-y}' +
    '.lb-wrap{position:relative;width:100%;max-width:340px;max-height:100%;display:flex;flex-direction:column;transform:rotate(-.5deg)}' +
    '.lb-tape{position:absolute;z-index:2;top:-7px;left:50%;width:70px;height:16px;margin-left:-35px;background:rgba(248,208,48,.8);border:1px solid rgba(59,42,38,.35);transform:rotate(2.5deg);pointer-events:none}' +
    '.lb-paper{position:relative;overflow:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;background:#fffdf4;color:' + INK + ';border:2px solid ' + INK + ';border-radius:12px;padding:12px 12px 10px;box-shadow:3px 4px 0 rgba(70,35,20,.32);font:700 14px/1.25 ' + FONT + ';-webkit-user-select:none;user-select:none;touch-action:pan-y}' +
    '.lb-x{position:absolute;top:4px;right:6px;border:0;background:none;font:900 22px/1 ' + FONT + ';color:' + INK + ';cursor:pointer;padding:2px 6px}' +
    '.lb-title{display:flex;justify-content:center;gap:2px;margin:2px 22px 8px}' +
    '.lb-title span{display:inline-block;min-width:19px;height:21px;line-height:21px;text-align:center;color:#fff;font:900 15px/21px ' + FONT + ';border:1.5px solid ' + INK + ';border-radius:4px;box-shadow:1px 1.5px 0 rgba(60,30,20,.3);text-shadow:-1px -1px 0 ' + INK + ',1px -1px 0 ' + INK + ',-1px 1px 0 ' + INK + ',1px 1px 0 ' + INK + '}' +
    '.lb-title span:nth-child(odd){transform:rotate(-4deg)}.lb-title span:nth-child(even){transform:rotate(4deg)}.lb-title .sp{visibility:hidden;min-width:6px;border:0;box-shadow:none}' +
    '.lb-time{text-align:center;margin:0 0 6px}.lb-time b{font-size:26px;color:#3870c0;letter-spacing:.5px}.lb-time small{display:block;font-size:12.5px;color:#8a6a4a;margin-top:1px}' +
    '.lb-form{display:flex;gap:6px;margin:4px 0 2px}' +
    '.lb-form input{flex:1;min-width:0;box-sizing:border-box;padding:7px 9px;border:2px solid ' + INK + ';border-radius:8px;background:#fff;color:' + INK + ';font:700 16px ' + FONT + ';-webkit-user-select:text;user-select:text}' +
    '.lb-btn{font:900 14px ' + FONT + ';color:' + INK + ';background:#f8d030;border:2px solid ' + INK + ';border-radius:8px;padding:7px 12px;box-shadow:1px 2px 0 rgba(60,30,20,.35);cursor:pointer;touch-action:manipulation}' +
    '.lb-btn:active{transform:translateY(1px);box-shadow:0 1px 0 rgba(60,30,20,.35)}.lb-btn[disabled]{opacity:.55}.lb-btn.alt{background:#fff}' +
    '.lb-err{color:#c01808;font-size:12.5px;min-height:15px;margin:2px 0 4px;text-align:center}' +
    '.lb-list{list-style:none;margin:2px 0 0;padding:0}' +
    '.lb-list li{display:flex;align-items:center;gap:7px;padding:2px 4px;margin:1px 0;border-radius:7px;border:1.5px solid transparent;font-size:14px}' +
    '.lb-list li .r{flex:none;width:24px;height:19px;line-height:19px;text-align:center;font-size:12px;border:1.5px solid ' + INK + ';border-radius:5px;background:#fff6dc}' +
    '.lb-list li .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lb-list li .t{flex:none;color:#3870c0;font-variant-numeric:tabular-nums}' +
    '.lb-list li.g1 .r{background:#f8d030}.lb-list li.g2 .r{background:#dfe5ea}.lb-list li.g3 .r{background:#e9a86a}' +
    '.lb-list li.me{background:#fff1a8;border-color:' + INK + ';border-style:dashed}.lb-list li.me .n:after{content:" \\2190 you";color:#e02810;font-size:11px}' +
    '.lb-list li.gap{justify-content:center;color:#a08a70;padding:0;font-size:12px}' +
    '.lb-empty{text-align:center;color:#8a6a4a;margin:10px 0}' +
    '.lb-row{display:flex;justify-content:center;gap:8px;margin-top:8px}' +
    // Short frames (the 480x480 card, or a phone with the keyboard up): tighter rows so ten fit.
    '@media (max-height:540px){.lb-paper{padding:9px 11px 8px}.lb-title{margin:0 22px 5px}.lb-title span{height:19px;line-height:19px;font-size:13px;min-width:17px}' +
    '.lb-time{margin:0 0 3px}.lb-time b{font-size:22px}.lb-list li{padding:0 4px;margin:0;font-size:13px;line-height:1.15}.lb-list li .r{height:16px;line-height:16px;font-size:11px}' +
    '.lb-err{min-height:13px;margin:1px 0 2px;font-size:12px}.lb-row{margin-top:5px}.lb-btn{padding:5px 12px}.lb-form input{padding:5px 8px}}';

  var styled = false, veil = null, checks = {};
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* blocked */ } },
  };
  function auth() { return window.MembersAuth && window.MembersAuth.ready ? window.MembersAuth : null; }

  var L = {
    check: function (gameId) {
      var A = auth();
      if (!A || !A.leaderboard) return Promise.resolve(false);
      if (!checks[gameId]) {
        checks[gameId] = A.ready.then(function () {
          if (!A.available) return false;
          return A.leaderboard(gameId).then(function (r) { return r.status === 200 && !!r.json && Array.isArray(r.json.top); });
        }).catch(function () { return false; });
      }
      return checks[gameId];
    },
    isOpen: function () { return !!(veil && veil.parentNode); },
    open: function (opts) {
      var A = auth();
      if (!A || L.isOpen()) return;
      opts = opts || {};
      var fmt = opts.format || function (v) { return String(v); };
      if (!styled) { document.head.appendChild(el('style', { text: CSS })); styled = true; }

      veil = el('div', { 'class': 'lb-veil' });
      var wrap = el('div', { 'class': 'lb-wrap' });
      var paper = el('div', { 'class': 'lb-paper', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leaderboard' });
      wrap.appendChild(el('div', { 'class': 'lb-tape' }));
      wrap.appendChild(paper); veil.appendChild(wrap);
      // Keep game input (canvas taps, keys) out while the panel is up.
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown', 'contextmenu'].forEach(function (t) {
        veil.addEventListener(t, function (e) { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') close(); });
      });
      var openedAt = Date.now();
      // Tap outside closes a view-only board (not the post form, and not the
      // trailing click of the very tap that opened it).
      veil.addEventListener('click', function (e) { if (e.target === veil && !opts.playId && Date.now() - openedAt > 500) close(); });
      document.body.appendChild(veil);

      // Mobile keyboards shrink the visual viewport: keep the panel inside it.
      var vv = window.visualViewport;
      function fit() { if (!vv || !veil) return; veil.style.height = vv.height + 'px'; veil.style.top = vv.offsetTop + 'px'; }
      if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit(); }

      var closed = false;
      function close() {
        if (closed) return; closed = true;
        if (vv) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
        if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
        veil = null;
        try { if (opts.onClose) opts.onClose(); } catch (e) { /* ignore */ }
      }
      function again() { close(); try { if (opts.onPlayAgain) opts.onPlayAgain(); } catch (e) { /* ignore */ } }
      L.close = close;

      function title(text) {
        var t = el('div', { 'class': 'lb-title', 'aria-label': text });
        for (var i = 0, c = 0; i < text.length; i++) {
          if (text[i] === ' ') { t.appendChild(el('span', { 'class': 'sp', text: '.' })); continue; }
          var s = el('span', { text: text[i] }); s.style.background = TILE[c++ % TILE.length]; t.appendChild(s);
        }
        return t;
      }
      function list(b, highlightId) {
        var frag = document.createDocumentFragment();
        if (!b.top.length) { frag.appendChild(el('p', { 'class': 'lb-empty', text: 'No names yet. Be the first!' })); return frag; }
        var ol = el('ol', { 'class': 'lb-list' }), shown = {};
        function row(e) {
          var cls = (e.rank <= 3 ? 'g' + e.rank : '') + ((highlightId ? e.id === highlightId : e.mine) ? ' me' : '');
          return el('li', { 'class': cls.trim() }, [el('span', { 'class': 'r', text: String(e.rank) }), el('span', { 'class': 'n', text: e.name }), el('span', { 'class': 't', text: fmt(e.value) })]);
        }
        b.top.forEach(function (e) { shown[e.id] = 1; ol.appendChild(row(e)); });
        var mine = highlightId && b.entry && !shown[b.entry.id] ? b.entry : (!highlightId && b.me && !shown[b.me.id] ? b.me : null);
        if (mine) { ol.appendChild(el('li', { 'class': 'gap', text: '\u2022 \u2022 \u2022' })); ol.appendChild(row({ id: mine.id, rank: mine.rank, name: mine.name, value: mine.value, mine: true })); }
        frag.appendChild(ol);
        return frag;
      }
      function xBtn() { return el('button', { 'class': 'lb-x', type: 'button', 'aria-label': 'Close', text: '\u00D7', onclick: close }); }
      function offline(msg) {
        paper.innerHTML = '';
        paper.appendChild(xBtn()); paper.appendChild(title('TOP 10'));
        paper.appendChild(el('p', { 'class': 'lb-empty', text: msg || 'The leaderboard can\u2019t be reached right now.' }));
        paper.appendChild(el('div', { 'class': 'lb-row' }, [opts.onPlayAgain ? el('button', { 'class': 'lb-btn', type: 'button', text: 'Play again', onclick: again }) : null, el('button', { 'class': 'lb-btn alt', type: 'button', text: 'Close', onclick: close })]));
      }
      function viewBoard(b, note, highlightId) {
        paper.innerHTML = '';
        paper.appendChild(xBtn());
        paper.appendChild(title('TOP 10'));
        if (note) paper.appendChild(note);
        paper.appendChild(list(b, highlightId));
        paper.appendChild(el('div', { 'class': 'lb-row' }, [
          opts.playId && opts.onPlayAgain ? el('button', { 'class': 'lb-btn', type: 'button', text: 'Play again', onclick: again }) : null,
          el('button', { 'class': 'lb-btn alt', type: 'button', text: 'Close', onclick: close }),
        ]));
      }
      function postForm(b) {
        var c = b.candidate;
        paper.innerHTML = '';
        paper.appendChild(xBtn());
        paper.appendChild(title('NEW TIME'));
        paper.appendChild(el('div', { 'class': 'lb-time' }, [el('b', { text: fmt(c.value) }), el('small', { text: c.rank <= 10 ? 'That\u2019s #' + c.rank + ' on the board!' : 'That would be #' + c.rank + '. Post it?' })]));
        var max = b.nameMax || 16;
        var input = el('input', { type: 'text', maxlength: String(max), placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'nickname', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'send' });
        input.value = (b.prefill || store.get(NAME_KEY) || '').slice(0, max);
        input.addEventListener('input', function () { var v = input.value.replace(/[^A-Za-z0-9 _.\-]/g, ''); if (v !== input.value) input.value = v; });
        input.addEventListener('focus', function () { setTimeout(function () { try { input.scrollIntoView({ block: 'center' }); } catch (e) { /* old */ } }, 300); });
        var go = el('button', { 'class': 'lb-btn', type: 'submit', text: 'Post' });
        var err = el('p', { 'class': 'lb-err', role: 'status' });
        var form = el('form', { 'class': 'lb-form', autocomplete: 'off' }, [input, go]);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var name = input.value.trim().replace(/\s+/g, ' ');
          if (!name) { err.textContent = 'Type a name first.'; input.focus(); return; }
          go.disabled = true; err.textContent = '';
          A.postLeaderboard(opts.gameId, opts.playId, name).then(function (r) {
            go.disabled = false;
            if (r.status === 201 && r.json && r.json.entry) {
              store.set(NAME_KEY, r.json.entry.name);
              try { input.blur(); } catch (e2) { /* ignore */ }
              var e3 = r.json.entry;
              viewBoard(r.json, el('div', { 'class': 'lb-time' }, [el('small', { text: 'Posted! ' + e3.name + ' is #' + e3.rank + ' with ' + fmt(e3.value) + '.' })]), e3.id);
              return;
            }
            if (r.json && r.json.error === 'already_posted') { L.refresh(); return; }
            err.textContent = (r.json && r.json.message) || (r.status ? 'Something went wrong.' : 'Can\u2019t reach the leaderboard. Try again?');
          });
        });
        paper.appendChild(form);
        paper.appendChild(err);
        paper.appendChild(list(b));
        paper.appendChild(el('div', { 'class': 'lb-row' }, [el('button', { 'class': 'lb-btn alt', type: 'button', text: 'Skip', onclick: again })]));
        // A mouse user can type straight away; on touch, wait for a tap (no surprise keyboard).
        if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      }

      L.refresh = function () {
        return A.leaderboard(opts.gameId, opts.playId).then(function (r) {
          if (closed) return;
          if (r.status !== 200 || !r.json || !Array.isArray(r.json.top)) { offline(); return; }
          var b = r.json;
          if (opts.playId && b.candidate && b.candidate.eligible) postForm(b);
          else viewBoard(b, opts.playId && b.candidate && b.candidate.error !== 'already_posted' ? el('p', { 'class': 'lb-empty', text: b.candidate.message }) : null);
        });
      };
      paper.appendChild(el('p', { 'class': 'lb-empty', text: 'Loading\u2026' }));
      L.refresh();
    },
  };
  window.MembersLeaderboard = L;
})();
