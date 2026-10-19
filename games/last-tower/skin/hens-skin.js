/* Last Tower v11: hens.farm skin for the handheld shell (Last Tower only). Adds the real hens.farm images to the shell DOM.
   ?skin=classic keeps the plain matcha shell. */
(function () {
  if (/[?&]skin=classic/.test(location.search)) return;
  var root = document.documentElement; root.classList.add('lt-skin-hens');
  function img(cls, src) { var i = document.createElement('img'); i.className = cls; i.src = src; i.alt = ''; i.draggable = false; return i; }
  function dress() {
    var dev = document.querySelector('.hh-device'); if (!dev) return false;
    if (dev.querySelector('.lt-sk-peek')) return true;
    dev.appendChild(img('lt-sk-peek', 'skin/peek.png'));
    var sp = dev.querySelector('.hh-speaker'); if (sp) sp.appendChild(img('lt-sk-egg', 'skin/egg.png'));
    var br = dev.querySelector('.hh-brand'); if (br) { var w = document.createElement('span'); w.className = 'lt-sk-word'; w.appendChild(img('', 'skin/icon.png')); w.appendChild(document.createTextNode('hens.farm')); br.insertBefore(w, br.firstChild); }
    var md = dev.querySelector('.hh-model'); if (md) md.textContent = 'BILLIONS MUST BOK \u00B7 MEMBERSONLY POCKET';
    return true;
  }
  if (!dress()) { var n = 0, t = setInterval(function () { if (dress() || ++n > 100) clearInterval(t); }, 50); }
})();
