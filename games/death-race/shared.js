// Death Race shared world definition (used by the browser client and the Node server).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DRShared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // The course runs forever toward +y. heading 0 = +y, positive heading turns toward +x.
  function center(y) {
    return 150 * Math.sin(y / 760) + 70 * Math.sin(y / 290 + 1.3) + 26 * Math.sin(y / 121 + 0.5);
  }
  function halfWidth(y) { return 74 + 22 * Math.sin(y / 940 + 2.0); }
  var SIDEWALK = 20;     // sidewalk band outside the asphalt
  var WALL = 34;         // building line distance past the asphalt edge
  var BLOCK = 520;       // cross street spacing
  var CROSS_W = 70;      // cross street width
  function isCross(y) { var m = ((y % BLOCK) + BLOCK) % BLOCK; return m < CROSS_W; }
  function hash(n) { n = (n | 0) * 374761393 + 668265263; n = (n ^ (n >>> 13)) * 1274126177; n = n ^ (n >>> 16); return ((n >>> 0) % 100000) / 100000; }
  // Wrecks (obstacles) every 90 units, some slots empty.
  var OB_STEP = 90;
  function obstacle(i) {
    if (i < 4) return null;
    var r = hash(i * 7 + 3);
    if (r > 0.55) return null;
    var y = i * OB_STEP + hash(i * 11) * 40;
    var hw = halfWidth(y);
    var x = center(y) + (hash(i * 13 + 1) * 2 - 1) * (hw - 16);
    return { x: x, y: y, kind: hash(i * 17) < 0.6 ? 0 : 1, r: 11 };
  }
  var UPG = ['engine', 'armor', 'guns', 'tires'];
  var UPG_COST = [120, 220, 360, 540, 780];
  var MAX_LVL = 5;
  function stats(u) {
    return {
      top: 92 + u.engine * 11, accel: 46 + u.engine * 7,
      maxhp: 100 + u.armor * 35,
      dmg: 7 + u.guns * 3, rate: 6 + u.guns * 1.6,
      grip: 1 + u.tires * 0.12, offroad: 0.55 + u.tires * 0.07
    };
  }
  var RACE_T = 120, SHOP_T = 15, COUNT_T = 3;
  var ITEMS = ['boost', 'shield', 'rockets', 'repair', 'cash', 'mine'];
  return { center: center, halfWidth: halfWidth, SIDEWALK: SIDEWALK, WALL: WALL, BLOCK: BLOCK, CROSS_W: CROSS_W,
    isCross: isCross, hash: hash, OB_STEP: OB_STEP, obstacle: obstacle, UPG: UPG, UPG_COST: UPG_COST, MAX_LVL: MAX_LVL,
    stats: stats, RACE_T: RACE_T, SHOP_T: SHOP_T, COUNT_T: COUNT_T, ITEMS: ITEMS };
});
