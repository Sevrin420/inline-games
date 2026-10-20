/* Last Tower v19: one big shell hen + big low power switch. v16: no words on the shell. v11: hens.farm skin for the handheld shell (Last Tower only). Adds the real hens.farm images to the shell DOM.
   ?skin=classic keeps the plain matcha shell. */
(function () {
  if (/[?&]skin=classic/.test(location.search)) return;
  var root = document.documentElement; root.classList.add('lt-skin-hens');
  function img(cls, src) { var i = document.createElement('img'); i.className = cls; i.src = src; i.alt = ''; i.draggable = false; return i; }
  function dress() {
    var dev = document.querySelector('.hh-device'); if (!dev) return false;
    if (dev.querySelector('.lt-sk-hen')) return true;
    // v19: no peeking hen, no golden egg, no brand hen icon. ONE big real hens.farm hen fills the lower shell; the D-pad sits on top of her.
    dev.insertBefore(img('lt-sk-hen', 'skin/shell-hen.png'), dev.firstChild);
    // v19: the power switch is BIG and lives low on the body, centred between the D-pad and the SHOOT stick
    var pw = dev.querySelector('.hh-pwr');
    if (pw) { pw.classList.add('lt-sk-pwr'); dev.appendChild(pw);
      var knob = pw.querySelector('.hh-pwr-knob'), d = null, TRAVEL = 46;
      pw.addEventListener('pointerdown', function (e) { var sc = dev.getBoundingClientRect().width / (dev.offsetWidth || 1) || 1; d = { id: e.pointerId, x: e.clientX, sc: sc, base: pw.getAttribute('aria-checked') === 'true' ? 1 : 0 }; });
      pw.addEventListener('pointermove', function (e) { if (!d || e.pointerId !== d.id) return; var p = Math.max(0, Math.min(1, d.base + (e.clientX - d.x) / d.sc / TRAVEL)); if (knob) knob.style.setProperty('--k', p.toFixed(3)); }); // the knob follows the thumb 1:1
      var end = function (e) { if (d && e.pointerId === d.id) d = null; }; pw.addEventListener('pointerup', end); pw.addEventListener('pointercancel', end); }
    var md = dev.querySelector('.hh-model'); if (md) md.textContent = '';
    return true;
  }
  if (!dress()) { var n = 0, t = setInterval(function () { if (dress() || ++n > 100) clearInterval(t); }, 50); }
})();
