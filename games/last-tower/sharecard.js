/* ZOMBIE FARM v22 TIME CARD renderer. One file, byte-identical in games/last-tower/sharecard.js (browser: the card
 * after a run) and server/src/sharecard.js (Node: the og:image PNG of a share link); test/sharecard.test.js checks they match.
 * No DOM, no imports: draws a 240x135 pixel-art card into an RGBA buffer and scales it x5 to 1200x675.
 *   ZFCard.render({ name, ms, rank, total, offline, pending, kills, ach, achMax }) -> { w: 1200, h: 675, data: Uint8ClampedArray }
 *   ZFCard.fmtTime(ms) -> "03:42.5"   ZFCard.W / ZFCard.H / ZFCard.S */
(function () {
  'use strict';
  var BW = 240, BH = 135, S = 5;
  // 5x7 pixel font (variable width); rows top to bottom, '#' = ink
  var F = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], 'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], 'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], 'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], 'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], 'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], 'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], 'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], 'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], 'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], 'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], 'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], 'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], 'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    ':': ['.', '#', '#', '.', '#', '#', '.'], '.': ['.', '.', '.', '.', '.', '#', '#'], '!': ['#', '#', '#', '#', '#', '.', '#'],
    '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'], '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
    '-': ['...', '...', '...', '###', '...', '...', '...'], '_': ['....', '....', '....', '....', '....', '....', '####'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], ' ': ['..', '..', '..', '..', '..', '..', '..'],
  };
  var HEN = [".........................b.bfb..b.................", "........................bfbbffbbfb................", "........................bfffffbffb................", "........................bffffffffb................", ".......................bfffffffffb................", ".......................bfffffffffb................", ".......................baaaabbaaab................", "......................baaaaaaabbaab...............", "......................baaaaaaabaaibbbb............", "......................baaaaaaaaaaiiiiib...........", "............bbbbbbbb..baaaaaaaaaaiiibb............", "..........bbaaaaacccb.baaaaaaaaaaiabb.............", ".........baaaaaccaabbbbbaaaaaaaccaaaabb...........", "........baaaaaaaaaaaaaaaaaaaaaaffcccaaab..........", "........baaaaaaaaaaaaaaaaaaaaaaffaaaaaab..........", ".......baaaaaaaaaaaaaaaaaaaaaaaaabbbbbaab.........", ".......baaaaaaaaaaaaaaaaaaaaaaaabaaaaacab.........", ".......baaaaaggaaaaaaacaaaaaaaabaaaaaaacb.........", "......bccaaaaaagaaaaaacaaaaaaabaaaaaaaaacb........", "......bccaaaaaagaaaaaacaaaaaaabaaaaaaaaaab........", ".....bccccaaaaaagaaaaacaaaaaaabaaaaaaaaaab........", ".....bcccccaacaagaaaaaccaaaaaabaaaaaaaaaab........", ".....bcccccaaagagaaaaaggaaaaaabgaaaagaaaab........", "....bbcccccaaaaggaaaagcagaaaaagbaaggaaaaab........", "...baacccccaaaaagggggccccgggggaabagaaaaaab........", "...baaacccccaaagaaaaaaccaaaaaaaaagbbaaaaaab.......", "..baaaacccccaaagaaaaaaccaaaaaaaaagaaaaaaaab.......", "..baaaaaccccdggaaaacccccccaaaaaaagdaaaaaaab.......", "..baaaaaacccccchhhddddccaaaaaaaaaaaaaaadddbbbbbbb.", ".baaaaaaaccccccdddhhhhhhhhddddddaaaaaaahhhhhdddddb", ".babbbaaaccccccdddddddddddhhhhhdaaaaaaadddddhhhhdb", "..b.baaaaacccccaaaaaddddddddddddaaaaaabddddddddddb", "....baaaaaacccaaaaaadddaaaaaaaadaaabbbbdddbbbbbbdb", "...baaabbaaaaaaaaaaadddbaaaaaaaaaaab..bdddb.....b.", "...babb..baaaaaaaaaadddbbaaaaaaaaab...bdddb.......", "....b....baabbaaaaaadddb.baaaaaaab....bdddb.......", ".........bab..baaaaabbb...baaaaab......bbb........", "..........b...beeebb.......bbeeeb.................", "..............beeeb..........beeeb................", ".............beeeb...........beeeb................", ".............beeeb............beeeb...............", ".............beeeb............beeeb...............", "............beeeb..............beeeb..............", "..........bbbeeebbb..........bbbeeebbb............", ".........beeeeeeeeeb........beeeeeeeeeb...........", ".........beeeeeeeeeb........beeeeeeeeeb...........", "..........bbbbbbbbb..........bbbbbbbbb............", ".................................................."];
  var HEN_PAL = { a: '#faf8f0', b: '#090b0a', c: '#ced0d6', d: '#1e2022', e: '#f09628', f: '#ff3347', g: '#a0a4b0', h: '#545a60', i: '#ffc42f' };
  // a shambling zombie hen, 11x10 (g = rotten green, k = ink, r = red eye, o = beak)
  var ZOM = ['...kkk.....', '..kgggk....', '.kgrgggk...', 'kooggggk...', '.kkgggggkk.', '..kggggggk.', '..kgggggggk', '...kgggggk.', '....k...k..', '...kk..kk..'];
  var ZPAL = { g: '#6f9a4c', k: '#0d140c', r: '#ff3347', o: '#c27a2a' };
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function fmtTime(ms) {
    ms = Math.max(0, Math.floor(ms || 0)); var m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, t = Math.floor(ms / 100) % 10;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + t;
  }
  function render(o) {
    o = o || {};
    var px = new Uint8ClampedArray(BW * BH * 4);
    function put(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= BW || y >= BH) return; var i = (y * BW + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    function rect(x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) put(x + i, y + j, c); }
    function tw(s, k) { var w = 0; for (var i = 0; i < s.length; i++) { var g = F[s[i]] || F['?']; w += (g[0].length + 1) * k; } return Math.max(0, w - k); }
    function text(s, x, y, k, c, sh) { // sh = outline colour (1px all around, plus a drop shadow)
      if (sh) { text(s, x + k, y + k, k, sh); for (var d = 0; d < 4; d++) text(s, x + [1, -1, 0, 0][d], y + [0, 0, 1, -1][d], k, sh); }
      for (var i = 0; i < s.length; i++) { var g = F[s[i]] || F['?'];
        for (var r = 0; r < 7; r++) for (var q = 0; q < g[r].length; q++) if (g[r][q] === '#') rect(x + q * k, y + r * k, k, k, c);
        x += (g[0].length + 1) * k; }
    }
    function ctext(s, cx, y, k, c, sh) { text(s, Math.round(cx - tw(s, k) / 2), y, k, c, sh); }
    function sprite(rows, pal0, x, y, k, flip) { var pal = {}; for (var pk in pal0) pal[pk] = rgb(pal0[pk]); for (var r = 0; r < rows.length; r++) for (var q = 0; q < rows[r].length; q++) { var ch = rows[r][q]; if (ch === '.') continue; var qq = flip ? rows[r].length - 1 - q : q; rect(x + qq * k, y + r * k, k, k, pal[ch]); } }
    var ink = rgb('#090b0a');
    // ---- dusk sky: dithered bands, stars, a big low sun
    var SKY = ['#160d2e', '#24123f', '#3a1a55', '#5a2263', '#82306a', '#ad3f68', '#d4545f', '#f2734f', '#ff9a4a'].map(rgb), HZ = 96;
    for (var y = 0; y < HZ; y++) { var f = y / HZ * (SKY.length - 1), b = Math.floor(f), fr = f - b;
      for (var x = 0; x < BW; x++) { var bay = [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)]; put(x, y, SKY[Math.min(SKY.length - 1, b + (fr > bay ? 1 : 0))]); } }
    var seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var st = 0; st < 34; st++) { var sx = Math.floor(rnd() * BW), sy = Math.floor(rnd() * 40); put(sx, sy, rgb(rnd() < 0.3 ? '#ffe9a8' : '#c9b8ff')); }
    var sun = rgb('#ffd27a'), sun2 = rgb('#ffb85c');
    for (var yy = -24; yy <= 0; yy++) for (var xx = -24; xx <= 24; xx++) if (xx * xx + yy * yy <= 24 * 24) { var gy = HZ + yy; if ((-yy) % 5 === 3 && yy > -14) continue; put(80 + xx, gy, (xx * xx + yy * yy > 21 * 21) ? sun2 : sun); }
    // ---- far farm silhouette: barn, silo, fence, dead trees
    var sil = rgb('#2a1430'), sil2 = rgb('#1c0f22');
    for (var x2 = 0; x2 < BW; x2++) { var hh = 3 + Math.round(2 * Math.sin(x2 * 0.09) + Math.sin(x2 * 0.23)); rect(x2, HZ - hh, 1, hh, sil); }
    rect(150, 70, 30, 26, sil); for (var r2 = 0; r2 < 12; r2++) rect(150 - 3 + r2, 70 - r2 + 0, 36 - 2 * r2, 1, sil);
    rect(186, 52, 14, 44, sil); for (var r3 = 0; r3 < 7; r3++) rect(186 + r3 - 0, 52 - 7 + r3, 14 - 0, 1, sil2);
    for (var fx = 0; fx < BW; fx += 7) rect(fx, HZ - 7, 1, 7, sil2); rect(0, HZ - 6, BW, 1, sil2); rect(0, HZ - 3, BW, 1, sil2);
    function tree(tx, th) { rect(tx, HZ - th, 2, th, sil2); rect(tx - 4, HZ - th + 3, 4, 1, sil2); rect(tx - 5, HZ - th + 1, 1, 2, sil2); rect(tx + 2, HZ - th + 6, 5, 1, sil2); rect(tx + 6, HZ - th + 3, 1, 3, sil2); }
    tree(12, 30); tree(118, 22); tree(224, 34);
    // ---- ground
    var G1 = rgb('#2f2a1c'), G2 = rgb('#3b3321'), GR = rgb('#3f6a2c'), GR2 = rgb('#5a8a38');
    for (var y3 = HZ; y3 < BH; y3++) for (var x3 = 0; x3 < BW; x3++) put(x3, y3, ((x3 * 3 + y3 * 7) % 11 === 0) ? G2 : G1);
    rect(0, HZ, BW, 2, GR); seed = 99; for (var t2 = 0; t2 < 70; t2++) { var gx = Math.floor(rnd() * BW), gy2 = HZ + 2 + Math.floor(rnd() * 36); put(gx, gy2, GR); put(gx + 1, gy2 - 1, GR2); put(gx + 2, gy2, GR); }
    // ---- the zombie flock shambling in
    [[4, 104, 1, 1], [26, 116, 1, 1], [98, 100, 1, 0], [108, 118, 1, 0], [50, 124, 1, 1]].forEach(function (z) { sprite(ZOM, ZPAL, z[0], z[1], z[2], !z[3]); });
    // ---- the hero: the buff hen (50x48 art at x2), feet on the dirt with a contact shadow
    var hx0 = 14, hy0 = 128 - 46 * 2, shd = rgb('#17130c');
    for (var e = -30; e <= 30; e++) { var ew = Math.round(Math.sqrt(1 - (e * e) / 900) * 4); rect(hx0 + 50 + e - 6, 128 - ew + 1, 1, ew * 2 - 1, shd); }
    sprite(HEN, HEN_PAL, hx0, hy0, 2, false);
    // ---- logo
    ctext('ZOMBIE', 62, 6, 2, rgb('#8fdc4f'), ink); ctext('FARM', 62, 24, 2, rgb('#ff3347'), ink);
    // ---- stats panel
    var PX = 124, PY = 7, PW = 110, PH = 113, CX = PX + PW / 2, cream = rgb('#fff6e0'), mut = rgb('#7a6a55'), red = rgb('#e8263c'), gold = rgb('#ffc42f');
    rect(PX + 3, PY + 3, PW, PH, rgb('#0b0710'));
    rect(PX - 2, PY - 2, PW + 4, PH + 4, ink); rect(PX, PY, PW, PH, cream); rect(PX, PY, PW, 1, rgb('#ffffff'));
    var name = String(o.name || 'ANON HEN').toUpperCase().replace(/[^A-Z0-9_.\- ]/g, '').slice(0, 12) || 'ANON HEN';
    rect(PX, PY, PW, 13, ink); ctext(name, CX, PY + 3, 1, rgb('#ffffff'));
    ctext('TIME ALIVE', CX, PY + 18, 1, mut);
    var tt = fmtTime(o.ms), tk = 3; while (tk > 1 && tw(tt, tk) > PW - 8) tk--;
    ctext(tt, CX, PY + 28, tk, red, null);
    rect(PX + 6, PY + 53, PW - 12, 1, rgb('#e2d5b8'));
    ctext('RANK', CX, PY + 57, 1, mut);
    if (o.offline) { ctext('OFFLINE', CX, PY + 68, 2, rgb('#9a8b73')); ctext('NO SIGNAL', CX, PY + 87, 1, mut); }
    else if (o.pending || !o.rank) { ctext('...', CX, PY + 68, 2, mut); }
    else {
      var rs = '#' + o.rank, of = o.total ? 'OF ' + o.total : '', rk = 3; while (rk > 1 && tw(rs, rk) + (of ? tw(of, 1) + 4 : 0) > PW - 8) rk--;
      var rw = tw(rs, rk) + (of ? tw(of, 1) + 4 : 0), rx = Math.round(CX - rw / 2); text(rs, rx, PY + 66, rk, ink); if (of) text(of, rx + tw(rs, rk) + 4, PY + 66 + 7 * rk - 7, 1, mut);
      if (o.rank <= 20) {
        var bw = tw('TOP 20!', 1) + 10, bx = Math.round(CX - bw / 2), by = PY + 90; rect(bx - 1, by - 1, bw + 2, 11, ink); rect(bx, by, bw, 9, gold); rect(bx, by, bw, 1, rgb('#fff0a8'));
        rect(bx - 4, by + 2, 3, 7, rgb('#c48a12')); rect(bx + bw + 1, by + 2, 3, 7, rgb('#c48a12')); text('TOP 20!', bx + 5, by + 1, 1, ink);
      }
    }
    // ---- kills / achievements line at the bottom of the panel
    rect(PX, PY + PH - 12, PW, 12, rgb('#f1e4c4'));
    var kl = 'KILLS ' + Math.max(0, o.kills | 0), al = 'ACH ' + Math.max(0, o.ach | 0) + '/' + (o.achMax || 100);
    if (tw(kl, 1) + tw(al, 1) + 14 > PW) al = Math.max(0, o.ach | 0) + '/' + (o.achMax || 100);
    text(kl, PX + 5, PY + PH - 9, 1, ink); text(al, PX + PW - 5 - tw(al, 1), PY + PH - 9, 1, rgb('#b07a00'));
    // ---- footer url
    rect(0, BH - 11, BW, 11, ink); rect(0, BH - 11, BW, 1, rgb('#3a2c40'));
    ctext('MEMBERSONLY.CC/ZOMBIE-FARM', BW / 2, BH - 9, 1, rgb('#ffc42f'));
    // ---- scale x5
    var W = BW * S, H = BH * S, out = new Uint8ClampedArray(W * H * 4);
    for (var y4 = 0; y4 < H; y4++) { var sr = ((y4 / S) | 0) * BW; for (var x4 = 0; x4 < W; x4++) { var si = (sr + ((x4 / S) | 0)) * 4, di = (y4 * W + x4) * 4; out[di] = px[si]; out[di + 1] = px[si + 1]; out[di + 2] = px[si + 2]; out[di + 3] = 255; } }
    return { w: W, h: H, data: out };
  }
  var api = { render: render, fmtTime: fmtTime, W: BW * S, H: BH * S, S: S };
  if (typeof globalThis !== 'undefined') globalThis.ZFCard = api;
})();
