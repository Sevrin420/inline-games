// Death Race authoritative game server: one always-running world, race -> shop loop.
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { accept } = require('./ws');
const S = require(fs.existsSync(path.join(__dirname, 'shared.js')) ? './shared.js' : '../games/death-race/shared.js');

const PORT = +process.env.PORT || 3110;
const TICK = 30, DT = 1 / TICK, SNAP_EVERY = 2;
const MIN_CARS = 3, MAX_CARS = 20;
const COLORS = ['#ff3b30', '#22d3ee', '#facc15', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#e5e7eb', '#3b82f6', '#84cc16',
  '#f43f5e', '#14b8a6', '#eab308', '#8b5cf6', '#10b981', '#fb923c', '#d946ef', '#94a3b8', '#0ea5e9', '#65a30d'];
const CAR_NAMES = ['RUST BUCKET', 'NEON WIDOW', 'GRAVEDIGGER', 'HELLCAT', 'IRON MAIDEN', 'SCRAPYARD', 'NIGHTRIDER', 'BONESHAKER',
  'WARHOG', 'CHROME COBRA', 'DUST DEVIL', 'MAD MAXINE', 'TOXIC AVENGER', 'RED VENOM', 'GHOST RIDER', 'BLACK SABBATH', 'ROAD KILL',
  'THUNDERBOLT', 'SKULL CRUSHER', 'VOLTAGE'];
const BOT_NAMES = ['Ace', 'Blade', 'Cobra', 'Dutch', 'Echo', 'Flint', 'Gator', 'Hawk', 'Jinx', 'Kane', 'Lynx', 'Moxie', 'Nova', 'Ozzy',
  'Pike', 'Rex', 'Sid', 'Tank', 'Viper', 'Wolf', 'Zed', 'Ripley', 'Snake', 'Duke', 'Rocco', 'Trixie', 'Bolt', 'Fury'];

let nextId = 1;
const world = { phase: 'count', t: 0, race: 0, fireY: -300, cars: [], zombies: [], bullets: [], pickups: [], mines: [], fx: [], results: null };
const clients = new Map();
const rnd = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const botName = () => BOT_NAMES[(rnd() * BOT_NAMES.length) | 0];
function freeColorIdx() { const used = new Set(world.cars.map((c) => c.ci)); for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i; return (rnd() * 20) | 0; }

function makeCar() {
  const ci = freeColorIdx();
  const c = { id: nextId++, ci, name: CAR_NAMES[ci], x: 0, y: 0, h: 0, spd: 0, hp: 100, dead: 0, inv: 0, shield: 0, boost: 0,
    drift: 0, driftCharge: 0, driftDir: 0, cool: 0, aim: 0, item: '', cash: 150, kills: 0, zk: 0, score: 0,
    up: { engine: 0, armor: 0, guns: 0, tires: 0 },
    seats: { drive: { cid: 0, name: botName() }, shoot: { cid: 0, name: botName() } },
    bot: { lane: (rnd() * 2 - 1) * 0.6, laneT: 0, skill: 0.82 + rnd() * 0.14, target: 0, aggro: rnd() },
    inp: { steer: 0, thr: 1, brk: 0, drift: 0, item: 0 }, gin: { aim: 0, fire: 0, item: 0 }, firing: 0 };
  c.st = S.stats(c.up); c.hp = c.st.maxhp;
  world.cars.push(c);
  return c;
}
function placeOnRoad(c, y, lane) {
  c.y = y; c.x = S.center(y) + lane * (S.halfWidth(y) - 14);
  c.h = Math.atan2(S.center(y + 20) - S.center(y), 20); c.spd = 0;
}
function gridStart() {
  world.cars.forEach((c, i) => {
    const row = (i / 4) | 0, col = i % 4;
    placeOnRoad(c, -row * 34 - (col % 2) * 10, (col - 1.5) / 2.2);
    c.hp = c.st.maxhp; c.dead = 0; c.inv = 0; c.shield = 0; c.boost = 0; c.drift = 0; c.driftCharge = 0; c.item = '';
    c.kills = 0; c.zk = 0; c.score = 0;
  });
  const rows = Math.ceil(world.cars.length / 4);
  world.fireY = -rows * 34 - 230;
  world.zombies = []; world.bullets = []; world.pickups = []; world.mines = [];
}
function humans(c) { return (c.seats.drive.cid ? 1 : 0) + (c.seats.shoot.cid ? 1 : 0); }
function packMid() {
  const live = world.cars.filter((c) => !c.dead).map((c) => c.y).sort((a, b) => a - b);
  return live.length ? live[(live.length / 2) | 0] : 0;
}
function spawnMidRace(c) {
  const y = world.phase === 'race' ? Math.max(world.fireY + 320, packMid() - 60) : -40 - world.cars.length * 9;
  placeOnRoad(c, y, (rnd() * 2 - 1) * 0.7); c.inv = 2;
}

// ---------- matchmaking ----------
function seatPlayer(cl, role) {
  const other = role === 'drive' ? 'shoot' : 'drive';
  let car = world.cars.find((c) => !c.seats[role].cid && c.seats[other].cid);    // pair with a waiting human
  if (!car) { const open = world.cars.filter((c) => !c.seats[role].cid && !c.seats[other].cid); if (open.length) car = open[(rnd() * open.length) | 0]; }
  if (!car && world.cars.length < MAX_CARS) { car = makeCar(); spawnMidRace(car); }
  if (!car) { car = world.cars.find((c) => !c.seats[other].cid); if (car) role = other; }
  if (!car) return null;
  car.seats[role] = { cid: cl.id, name: cl.name };
  cl.carId = car.id; cl.role = role;
  return car;
}
function unseat(cl) {
  const car = world.cars.find((c) => c.id === cl.carId);
  if (car && car.seats[cl.role].cid === cl.id) car.seats[cl.role] = { cid: 0, name: botName() };
  cl.carId = 0;
}
function trimCars() {
  // Between races: drop all-bot cars beyond the minimum (empty human seats).
  for (let i = world.cars.length - 1; i >= 0 && world.cars.length > MIN_CARS; i--) if (!humans(world.cars[i])) world.cars.splice(i, 1);
  while (world.cars.length < MIN_CARS) makeCar();
}

// ---------- gameplay ----------
function fx(type, x, y, a) { world.fx.push([type, Math.round(x), Math.round(y), a || 0]); }
function damage(c, d, by) {
  if (c.dead || c.inv > 0 || c.shield > 0) return;
  c.hp -= d;
  if (c.hp <= 0) {
    c.hp = 0; c.dead = 3; c.spd = 0; fx('boom', c.x, c.y, 1);
    if (by && by !== c) { by.kills++; by.cash += 80; }
    // scatter a couple of pickups from the wreck
    for (let i = 0; i < 2; i++) dropPickup(c.x + (rnd() - 0.5) * 30, c.y + (rnd() - 0.5) * 30, rnd() < 0.5 ? 'cash' : null);
  }
}
function dropPickup(x, y, type) {
  const items = ['boost', 'boost', 'shield', 'rockets', 'rockets', 'repair', 'cash', 'cash', 'mine'];
  world.pickups.push({ id: nextId++, x, y, type: type || items[(rnd() * items.length) | 0], life: 25 });
}
function wallLimit(y) { return S.halfWidth(y) + S.WALL + (S.isCross(y) ? 170 : 0); }

function driverBot(c) {
  const b = c.bot, inp = c.inp;
  b.laneT -= DT;
  if (b.laneT <= 0) { b.lane = (rnd() * 2 - 1) * 0.7; b.laneT = 2 + rnd() * 4; }
  const look = 50 + c.spd * 0.7;
  let ty = c.y + look, tx = S.center(ty) + b.lane * S.halfWidth(ty);
  // chase a nearby rival sometimes
  if (b.aggro > 0.55) {
    let best = null, bd = 1e9;
    for (const o of world.cars) { if (o === c || o.dead) continue; const dy = o.y - c.y, dx = o.x - c.x; if (dy > 0 && dy < 140 && Math.abs(dx) < 70) { const d = dy + Math.abs(dx); if (d < bd) { bd = d; best = o; } } }
    if (best) { tx = best.x; ty = best.y + 20; }
  }
  // dodge wrecks
  const i0 = Math.floor(c.y / S.OB_STEP);
  for (let i = i0; i <= i0 + 2; i++) { const o = S.obstacle(i); if (!o) continue; const dy = o.y - c.y; if (dy > 0 && dy < 110 && Math.abs(o.x - tx) < 24) tx = o.x + (tx > o.x ? 30 : -30); }
  // pickups are tempting
  for (const p of world.pickups) { const dy = p.y - c.y; if (dy > 20 && dy < 120 && Math.abs(p.x - c.x) < 40) { tx = p.x; break; } }
  const want = Math.atan2(tx - c.x, ty - c.y);
  const err = wrapA(want - c.h);
  inp.steer = clamp(err * 2.6, -1, 1);
  const curv = Math.abs(S.center(c.y + 120) - 2 * S.center(c.y + 60) + S.center(c.y));
  inp.drift = c.spd > 60 && (Math.abs(err) > 0.28 || curv > 7) ? 1 : 0;
  inp.thr = 1; inp.brk = 0;
  inp.item = 0;
  if (c.item === 'boost' && Math.abs(err) < 0.15) inp.item = 1;
  if (c.item === 'shield' && (c.hp < c.st.maxhp * 0.4 || c.y - world.fireY < 120)) inp.item = 1;
  if (c.item === 'mine' && world.cars.some((o) => o !== c && !o.dead && c.y - o.y > 10 && c.y - o.y < 80 && Math.abs(o.x - c.x) < 30)) inp.item = 1;
}
function gunnerBot(c) {
  const g = c.gin;
  let best = null, bd = 1e9, isCar = false;
  for (const o of world.cars) {
    if (o === c || o.dead) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (world.t > 6 && d < 160 && d * 1.4 < bd) { bd = d * 1.4; best = o; isCar = true; }
  }
  for (const z of world.zombies) {
    const d = Math.hypot(z.x - c.x, z.y - c.y);
    if (d < 150 && d < bd) { bd = d; best = z; isCar = false; }
  }
  if (best) {
    const d = Math.hypot(best.x - c.x, best.y - c.y), tlead = d / 420;
    let bx = best.x, by = best.y;
    if (isCar) { bx += Math.sin(best.h) * best.spd * tlead; by += Math.cos(best.h) * best.spd * tlead; }
    const want = Math.atan2(bx - c.x, by - c.y);
    const jitter = (1 - c.bot.skill) * 0.5 * Math.sin(world.t * 3 + c.id);
    g.aim = wrapA(want - c.h + jitter); g.fire = 1;
    g.item = c.item === 'rockets' && isCar ? 1 : 0;
  } else { g.fire = 0; g.item = 0; g.aim *= 0.9; }
}
function useItem(c) {
  const it = c.item; if (!it) return; c.item = '';
  if (it === 'boost') { c.boost = 2.2; fx('boost', c.x, c.y); }
  else if (it === 'shield') { c.shield = 5; fx('shield', c.x, c.y); }
  else if (it === 'mine') { world.mines.push({ x: c.x - Math.sin(c.h) * 16, y: c.y - Math.cos(c.h) * 16, owner: c.id, arm: 0.6, life: 30 }); }
  else if (it === 'rockets') {
    const a = c.h + c.gin.aim;
    for (let k = -1; k <= 1; k++) {
      const aa = a + k * 0.12;
      world.bullets.push({ x: c.x, y: c.y, vx: Math.sin(aa) * 300 + Math.sin(c.h) * c.spd, vy: Math.cos(aa) * 300 + Math.cos(c.h) * c.spd, life: 1.4, owner: c.id, dmg: 34, rk: 1 });
    }
    fx('rocket', c.x, c.y);
  }
}
function stepCar(c) {
  if (c.dead > 0) {
    c.dead -= DT;
    if (c.dead <= 0) { c.dead = 0; c.hp = c.st.maxhp; placeOnRoad(c, Math.max(world.fireY + 260, c.y - 80), (rnd() * 2 - 1) * 0.5); c.inv = 2.5; }
    return;
  }
  c.inv = Math.max(0, c.inv - DT); c.shield = Math.max(0, c.shield - DT); c.boost = Math.max(0, c.boost - DT); c.cool -= DT;
  const racing = world.phase === 'race';
  if (!c.seats.drive.cid) driverBot(c);
  if (!c.seats.shoot.cid) gunnerBot(c);
  const inp = c.inp, st = c.st;
  if ((inp.item || c.gin.item) && c.item) { useItem(c); inp.item = 0; c.gin.item = 0; }
  const off = Math.abs(c.x - S.center(c.y)) > S.halfWidth(c.y) + 4;
  const skill = c.seats.drive.cid ? 1 : c.bot.skill;
  let top = st.top * skill * (off ? st.offroad : 1) * (c.boost > 0 ? 1.55 : 1);
  if (!racing) top = 0;
  if (racing && inp.thr) c.spd += st.accel * (1 - c.spd / Math.max(top, 1)) * DT * (c.boost > 0 ? 2 : 1);
  else c.spd -= 30 * DT;
  if (inp.brk) c.spd -= 120 * DT;
  if (c.spd > top) c.spd -= (c.spd - top) * 2.5 * DT;
  c.spd = clamp(c.spd, inp.brk && racing ? -30 : 0, 200);
  const steer = clamp(inp.steer, -1, 1);
  const turnScale = clamp(Math.abs(c.spd) / 35, 0, 1) * (c.spd < 0 ? -1 : 1);
  // drift: hop in, keep the slide while held, charge a mini-turbo
  if (inp.drift && c.spd > 45 && Math.abs(steer) > 0.25 && !c.drift) { c.drift = 1; c.driftDir = Math.sign(steer); c.driftCharge = 0; }
  if (c.drift && (!inp.drift || c.spd < 30)) {
    if (c.driftCharge > 1.6) { c.boost = Math.max(c.boost, 1.3); fx('turbo', c.x, c.y, 2); }
    else if (c.driftCharge > 0.8) { c.boost = Math.max(c.boost, 0.7); fx('turbo', c.x, c.y, 1); }
    c.drift = 0; c.driftCharge = 0;
  }
  let turn;
  if (c.drift) {
    turn = (c.driftDir * 1.25 + steer * 0.75) * 1.5 * st.grip;
    c.driftCharge += DT * (0.6 + Math.abs(steer + c.driftDir) * 0.4);
    c.spd -= 6 * DT;
  } else turn = steer * 1.9 * st.grip;
  c.h = wrapA(c.h + turn * turnScale * DT);
  const slip = c.drift ? -c.driftDir * 0.32 : 0;
  c.x += Math.sin(c.h + slip) * c.spd * DT;
  c.y += Math.cos(c.h + slip) * c.spd * DT;
  // buildings
  const cx = S.center(c.y), lim = wallLimit(c.y);
  if (Math.abs(c.x - cx) > lim) { c.x = cx + Math.sign(c.x - cx) * lim; if (c.spd > 50) { damage(c, (c.spd - 50) * 0.08); fx('spark', c.x, c.y); } c.spd *= 0.86; }
  // wrecks
  const i0 = Math.floor(c.y / S.OB_STEP);
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    const o = S.obstacle(i); if (!o) continue;
    const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy), m = o.r + 8;
    if (d < m && d > 0.01) { c.x = o.x + dx / d * m; c.y = o.y + dy / d * m; if (c.spd > 40) { damage(c, c.spd * 0.1); fx('spark', c.x, c.y); } c.spd *= 0.45; }
  }
  // the wall of fire
  if (racing && c.y < world.fireY + 12) { damage(c, 55 * DT); if (rnd() < 0.3) fx('burn', c.x, c.y); if (c.y < world.fireY - 40) damage(c, 999); }
  // guns
  if (c.seats.shoot.cid) { /* human aim already in gin */ }
  c.aim = c.gin.aim;
  c.firing = 0;
  if (racing && c.gin.fire && c.cool <= 0) {
    c.cool = 1 / st.rate; c.firing = 1;
    const a = c.h + c.gin.aim + (rnd() - 0.5) * 0.05;
    world.bullets.push({ x: c.x + Math.sin(a) * 8, y: c.y + Math.cos(a) * 8, vx: Math.sin(a) * 430 + Math.sin(c.h) * c.spd, vy: Math.cos(a) * 430 + Math.cos(c.h) * c.spd, life: 0.5, owner: c.id, dmg: st.dmg, rk: 0 });
  }
  c.score = c.y;
}
function collideCars() {
  const cs = world.cars;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j]; if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 17 && d > 0.01) {
      const p = (17 - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
      const rel = Math.abs(a.spd - b.spd);
      if (rel > 25) { damage(a, rel * 0.08, b); damage(b, rel * 0.08, a); fx('spark', (a.x + b.x) / 2, (a.y + b.y) / 2); }
      const avg = (a.spd + b.spd) / 2; a.spd = a.spd * 0.7 + avg * 0.3; b.spd = b.spd * 0.7 + avg * 0.3;
    }
  }
}
function stepZombies() {
  const zs = world.zombies, racing = world.phase === 'race';
  // keep a crowd ahead of every car
  if (racing || world.phase === 'count') for (const c of world.cars) {
    if (zs.length > 240) break;
    let n = 0; for (const z of zs) if (z.y > c.y && z.y < c.y + 650) n++;
    if (n < 14) {
      const y = c.y + 180 + rnd() * 470;
      const side = rnd();
      const hw = S.halfWidth(y), cx = S.center(y);
      const x = side < 0.7 ? cx + (rnd() * 2 - 1) * hw : cx + Math.sign(rnd() - 0.5) * (hw + 6 + rnd() * 20);
      zs.push({ id: nextId++, x, y, hp: 14, d: rnd() * 6.28, sp: 9 + rnd() * 12, t: rnd() * 3, k: rnd() < 0.12 ? 1 : 0 });
      if (zs[zs.length - 1].k) zs[zs.length - 1].hp = 40; // big brute
    }
  }
  let minY = Infinity; for (const c of world.cars) minY = Math.min(minY, c.y);
  for (let i = zs.length - 1; i >= 0; i--) {
    const z = zs[i];
    if (z.y < world.fireY - 20 || z.y < minY - 300) { if (z.y < world.fireY) fx('burn', z.x, z.y); zs.splice(i, 1); continue; }
    z.t += DT;
    // shamble toward the nearest car within 120, else wander
    let tgt = null, bd = 80;
    for (const c of world.cars) { if (c.dead) continue; const d = Math.hypot(c.x - z.x, c.y - z.y); if (d < bd) { bd = d; tgt = c; } }
    if (tgt) z.d = Math.atan2(tgt.x - z.x, tgt.y - z.y);
    else if (rnd() < 0.01) z.d += (rnd() - 0.5) * 2;
    z.x += Math.sin(z.d) * z.sp * DT; z.y += Math.cos(z.d) * z.sp * DT;
    const cx = S.center(z.y), lim = wallLimit(z.y) - 4;
    if (Math.abs(z.x - cx) > lim) { z.x = cx + Math.sign(z.x - cx) * lim; z.d += Math.PI; }
    // run over
    for (const c of world.cars) {
      if (c.dead) continue;
      if (Math.hypot(c.x - z.x, c.y - z.y) < 10) {
        if (c.spd > 22) { killZombie(z, c, i); if (!z.k) damage(c, 1.5); else { damage(c, 8); c.spd *= 0.6; } break; }
        else { damage(c, 5 * DT); }
      }
    }
  }
}
function killZombie(z, by, i) {
  const idx = i != null ? i : world.zombies.indexOf(z);
  if (idx < 0 || world.zombies[idx] !== z) return;
  world.zombies.splice(idx, 1);
  fx('splat', z.x, z.y, z.k);
  if (by) { by.cash += z.k ? 25 : 6; by.zk++; }
  if (rnd() < (z.k ? 0.9 : 0.38)) dropPickup(z.x, z.y);
}
function stepBullets() {
  const bs = world.bullets;
  for (let i = bs.length - 1; i >= 0; i--) {
    const b = bs[i];
    if (b.rk) { // light homing
      let best = null, bd = 160;
      for (const c of world.cars) { if (c.id === b.owner || c.dead) continue; const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < bd) { bd = d; best = c; } }
      if (best) { const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vx, b.vy), w = Math.atan2(best.x - b.x, best.y - b.y); const na = a + clamp(wrapA(w - a), -3 * DT, 3 * DT); b.vx = Math.sin(na) * sp; b.vy = Math.cos(na) * sp; }
    }
    b.x += b.vx * DT; b.y += b.vy * DT; b.life -= DT;
    let hit = false;
    const owner = world.cars.find((c) => c.id === b.owner);
    for (const c of world.cars) {
      if (c.id === b.owner || c.dead) continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) < (b.rk ? 13 : 10)) { damage(c, b.rk ? b.dmg : b.dmg * 0.45, owner); fx(b.rk ? 'boom' : 'hit', b.x, b.y, 0); hit = true; break; }
    }
    if (!hit) for (let j = world.zombies.length - 1; j >= 0; j--) {
      const z = world.zombies[j];
      if (Math.hypot(z.x - b.x, z.y - b.y) < (z.k ? 9 : 7)) { z.hp -= b.dmg; hit = true; if (z.hp <= 0) killZombie(z, owner, j); else fx('blood', z.x, z.y); if (b.rk) fx('boom', b.x, b.y); break; }
    }
    const cx = S.center(b.y);
    if (!hit && Math.abs(b.x - cx) > wallLimit(b.y) + 4) { hit = true; fx('spark', b.x, b.y); }
    if (hit || b.life <= 0) bs.splice(i, 1);
  }
  for (let i = world.mines.length - 1; i >= 0; i--) {
    const m = world.mines[i]; m.arm -= DT; m.life -= DT;
    let gone = m.life <= 0;
    if (m.arm <= 0) for (const c of world.cars) {
      if (c.dead || Math.hypot(c.x - m.x, c.y - m.y) > 13) continue;
      damage(c, 45, world.cars.find((o) => o.id === m.owner)); c.spd *= 0.3; fx('boom', m.x, m.y, 1); gone = true; break;
    }
    if (gone) world.mines.splice(i, 1);
  }
}
function stepPickups() {
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const p = world.pickups[i]; p.life -= DT;
    let gone = p.life <= 0 || p.y < world.fireY;
    if (!gone) for (const c of world.cars) {
      if (c.dead || Math.hypot(c.x - p.x, c.y - p.y) > 13) continue;
      if (p.type === 'cash') c.cash += 40;
      else if (p.type === 'repair') c.hp = Math.min(c.st.maxhp, c.hp + c.st.maxhp * 0.45);
      else if (!c.item) c.item = p.type;
      else continue;
      fx('pick', p.x, p.y, S.ITEMS.indexOf(p.type)); gone = true; break;
    }
    if (gone) world.pickups.splice(i, 1);
  }
}
function fireSpeed(t) { return 30 + 44 * (t / S.RACE_T); }
function endRace() {
  const ranked = world.cars.slice().sort((a, b) => b.y - a.y);
  world.results = ranked.map((c, i) => {
    const prize = Math.max(60, 420 - i * 30) + c.kills * 0; c.cash += prize;
    return { id: c.id, name: c.name, pos: i + 1, prize, kills: c.kills, zk: c.zk, dist: Math.max(0, Math.round(c.y / 10)), d: c.seats.drive.name, g: c.seats.shoot.name };
  });
  world.phase = 'shop'; world.t = 0;
  // bots go shopping
  for (const c of world.cars) if (!humans(c)) { let g = 0; while (g++ < 6) { const k = S.UPG[(rnd() * 4) | 0]; buy(c, k); } }
}
function buy(c, k) {
  if (!S.UPG.includes(k)) return false;
  const lvl = c.up[k]; if (lvl >= S.MAX_LVL) return false;
  const cost = S.UPG_COST[lvl]; if (c.cash < cost) return false;
  c.cash -= cost; c.up[k]++; c.st = S.stats(c.up); if (k === 'armor') c.hp = c.st.maxhp; return true;
}
function step() {
  world.t += DT; world.fx = world.fx.length > 200 ? [] : world.fx;
  if (world.phase === 'count') { if (world.t >= S.COUNT_T) { world.phase = 'race'; world.t = 0; world.race++; for (const c of world.cars) c.inv = 4; } }
  else if (world.phase === 'race') { world.fireY += fireSpeed(world.t) * DT; if (world.t >= S.RACE_T) endRace(); }
  else if (world.phase === 'shop') { if (world.t >= S.SHOP_T) { trimCars(); gridStart(); world.phase = 'count'; world.t = 0; world.results = null; } }
  if (world.phase !== 'shop') {
    for (const c of world.cars) stepCar(c);
    collideCars(); stepZombies(); stepBullets(); stepPickups();
  }
}

// ---------- networking ----------
const r1 = (v) => Math.round(v * 10) / 10;
function snapshot() {
  const ph = world.phase, tl = ph === 'race' ? S.RACE_T - world.t : ph === 'shop' ? S.SHOP_T - world.t : S.COUNT_T - world.t;
  const cars = world.cars.map((c) => [c.id, r1(c.x), r1(c.y), Math.round(c.h * 1000) / 1000, Math.round(c.spd), Math.ceil(c.hp), c.st.maxhp,
    (c.dead ? 1 : 0) | (c.shield > 0 ? 2 : 0) | (c.boost > 0 ? 4 : 0) | (c.drift ? 8 : 0) | (c.inv > 0 ? 16 : 0) | (c.firing ? 64 : 0) | (c.driftCharge > 1.6 ? 128 : c.driftCharge > 0.8 ? 256 : 0),
    Math.round(c.aim * 100) / 100, c.cash, c.ci, c.kills, c.item ? S.ITEMS.indexOf(c.item) : -1]);
  return JSON.stringify({ t: 's', ph, tl: r1(tl), race: world.race, fy: r1(world.fireY), cars,
    z: world.zombies.map((z) => [z.id, r1(z.x), r1(z.y), Math.round(z.d * 100) / 100, z.k]),
    b: world.bullets.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.rk]),
    p: world.pickups.map((p) => [p.id, Math.round(p.x), Math.round(p.y), S.ITEMS.indexOf(p.type)]),
    m: world.mines.map((m) => [Math.round(m.x), Math.round(m.y)]),
    fx: world.fx });
}
function meta() {
  return JSON.stringify({ t: 'm', cars: world.cars.map((c) => ({ id: c.id, name: c.name, ci: c.ci, up: c.up, d: c.seats.drive.name, g: c.seats.shoot.name, dh: !!c.seats.drive.cid, gh: !!c.seats.shoot.cid })),
    results: world.results, players: clients.size });
}
const clean = (s) => String(s || '').replace(/[^\w .\-!]/g, '').trim().slice(0, 14);
function onConn(ws) {
  const cl = { id: nextId++, ws, carId: 0, role: '', name: 'Player' };
  clients.set(cl.id, cl);
  ws.onmessage = (txt) => {
    let m; try { m = JSON.parse(txt); } catch (e) { return; }
    if (m.t === 'join') {
      if (cl.carId) unseat(cl);
      cl.name = clean(m.name) || 'Player' + (cl.id % 1000);
      const car = seatPlayer(cl, m.role === 'shoot' ? 'shoot' : 'drive');
      if (!car) { ws.send(JSON.stringify({ t: 'full' })); return; }
      ws.send(JSON.stringify({ t: 'you', car: car.id, role: cl.role, colors: COLORS }));
      ws.send(meta());
    } else if (m.t === 'in') {
      const car = world.cars.find((c) => c.id === cl.carId); if (!car) return;
      if (cl.role === 'drive' && car.seats.drive.cid === cl.id) {
        car.inp.steer = clamp(+m.s || 0, -1, 1); car.inp.thr = m.g ? 1 : 0; car.inp.brk = m.b ? 1 : 0; car.inp.drift = m.d ? 1 : 0; if (m.i) car.inp.item = 1;
      } else if (cl.role === 'shoot' && car.seats.shoot.cid === cl.id) {
        car.gin.aim = clamp(+m.a || 0, -Math.PI, Math.PI); car.gin.fire = m.f ? 1 : 0; if (m.i) car.gin.item = 1;
      }
    } else if (m.t === 'buy') {
      const car = world.cars.find((c) => c.id === cl.carId);
      if (car && world.phase === 'shop') { buy(car, m.k); ws.send(meta()); }
    } else if (m.t === 'ping') ws.send(JSON.stringify({ t: 'pong', c: m.c }));
  };
  ws.onclose = () => { unseat(cl); clients.delete(cl.id); };
}
let tickN = 0;
function loop() {
  step(); tickN++;
  if (tickN % SNAP_EVERY === 0) { const s = snapshot(); world.fx = []; for (const cl of clients.values()) cl.ws.send(s); }
  if (tickN % TICK === 0) { const m = meta(); for (const cl of clients.values()) cl.ws.send(m); }
}
trimCars(); gridStart();
let last = Date.now(), acc = 0;
setInterval(() => { const now = Date.now(); acc += Math.min(250, now - last); last = now; while (acc >= 1000 / TICK) { loop(); acc -= 1000 / TICK; } }, 8);

const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/death-race/status')) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ ok: true, phase: world.phase, race: world.race, cars: world.cars.length, players: clients.size })); return; }
  if (process.env.STATIC) { // local dev only: serve the client too
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(process.env.STATIC, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[ext] || 'application/octet-stream' }); res.end(d); });
    return;
  }
  res.writeHead(404); res.end();
});
srv.on('upgrade', (req, socket) => { if (req.url.startsWith('/death-race/ws')) accept(req, socket, onConn); else socket.destroy(); });
srv.listen(PORT, '127.0.0.1', () => console.log('death-race server on 127.0.0.1:' + PORT));
module.exports = { world };
