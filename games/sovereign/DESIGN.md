# Sovereign — design (v4)

Survival / foraging + tower defense on a huge seeded world. Same handheld shell
and pixel/cardboard-cutout DNA as Zombie Farm, pushed darker and edgier
(theme: `smoke`). Live: `membersonly.cc/sovereign/?v=8`.

## Pillars

- **One bite = death.** No XP from kills. Permadeath; best-runs board by score.
- **Stealth first.** Walk is quiet; sneak is nearly silent; sprint / vehicles /
  gunshots still scream. Walk past zombies at a modest distance without agro.
- **Every building opens.** No locked shells — door tiles are walkable; A
  searches containers inside.
- **Large interiors.** Houses have rooms (kitchen, bedrooms, bath, basement /
  attic where footprints fit). Stores, factories, warehouses, and city blocks
  are multi-room with hallways and loot. Interiors chunk-load with the world.
- **Scarce economy.** Scavenge → sell to traders → buy tools / a bedroll.
- **Found a camp anywhere** (not in the city). Wall it, trap it, sleep in it.
- **Night wave at 22:00.** Watch live or skip to morning; damage persists.
- **Grow toward utopia.** Recruits take jobs: farmer / guard / scavenger / builder.

## Fixes (v4)

- **Power off→on restarts.** Shell `handheld:power` on wipes the mid-run save and cold-boots to the title with a fresh world (same idea as Last Tower `bootOn`), instead of resuming the frozen mid-run.
- **Walkable spawn only.** `findWalkableSpawn` rejects roofs/building footprints, walls, water, and other non-walkable tiles; spiral-searches from the town-edge hint onto road/ground. Used by every `newRun` (new game, title demo, power restart).

## Look (v3)

- Same dark/edgy v2 direction, with denser procedural detail that still runs on phones:
  grass clumps, dirt patches, cracked asphalt, puddles, debris; brick courses,
  window muntins/sills, detailed doors; denser standees (clothing, belt, limb
  shade, grimmer zombie faces); richer props/vehicles; roof shingles, chimneys,
  facade windows; dusk gradient + vignette + warmer interior lamp pools.
- Atlas/standee/prop draws stay cached — no big sprite sheets.

## Look (v2 legacy notes)

- Muted, desaturated palette; deeper ink outlines; dusk grade on by default.
- Gloomier sky (earlier dusk / night). Interiors stay dark — flashlight-style
  ambient pool around the player; campfires cut the dark.
- Grimy walls / floors, blood accents on zombies, starker silhouettes.
- Title: **SOVEREIGN** / *ONE BITE. BUILD ANYWAY.* HUD noise meter still shows
  sneak / sprint / noise.

## World

- Tile size 16 px, world 3072×3072 tiles, chunks 32×32, streamed.
- Sets: home town (spawn), more towns, a larger city (r≈280), factories,
  mines, farms, gas stations, cabins. Each town has a trader.
- Town / city grids enlarged (P 34 / 42). Houses ~11–14×10–12 with `planInterior`
  walls + door gaps; warehouses get aisle walls; big footprints get basement /
  attic stubs where they fit.
- Minimap on the HUD; SELECT opens a fogged zoomable map.

## Stealth (v2)

| Mode   | Footstep radius (× shoe quiet × surface) | Vision vs zombie |
|--------|------------------------------------------|------------------|
| Walk   | ~0.9 (sneakers quieter, boots louder)    | ~0.52× sight     |
| Sneak  | ~0.35                                    | ~0.38× sight     |
| Sprint | ~11                                      | slightly *more*  |
| Vehicle / gun / crash | loud as before                  | obvious          |

Chase gate tightened (`d < 7`). Bushes / tall grass + sneak almost vanish.
Hearing still uses the noise circle — quiet footsteps rarely alert.

## Loop

1. Wake in the home town with $15, water, chips. Scavenge furniture.
2. Sell junk to the trader; buy a bedroll ($26) (also rare in dressers).
3. Walk out of town, PACK → bedroll → **MAKE CAMP HERE**.
4. BUILD walls, gate, spikes, chest, bunks, campfire, barrel, …
5. Farm (hoe / seeds / watering can), cook at the campfire.
6. Recruit survivors (talk, pay food, free bunk). Assign jobs in CAMP.
7. At 18:00+ sleep: **WATCH** the wave or **SKIP** to dawn report.
8. Vehicles: bike (no fuel), moto / car (scarce gas, noise, trunk).
9. Die → name for BEST RUNS. Score = `day * 100 + min(99, campSize)`.

## Stats & inventory

Health / stamina / hunger / thirst. Weight capacity grows slowly with strength.
Start barefoot with pockets + 2 hands; backpacks and shoes are loot / shop.
VERSION=3 invalidates v1/v2 saves (sprite sizes / atlas changed).

## Phone-first

Built for phones (iPhone 14 → Pixel 7 → desktop). Touch D-pad + A/B; same
canvas shell as the other handheld games.


## v5 (save / door invuln / stockpile / crafting)
- **VERSION=5** — wipes incompatible v4 saves (`hasSave` checks `s.v === VERSION`).
- ~~Easy save (HUD SAVE / SYS SAVE GAME)~~ — removed in v6 (see below).
- **Door invuln:** Entering or exiting a building grants **3s** bite invulnerability (`PL.invuln`); cyan standee tint while active.
- **Stockpile:** After searching a world container (crate/locker/cabinet/etc.), it becomes a persistent **STOCKPILE** (deposit/withdraw, 24 stacks). Camp chests same UI. Persists via `G.looted` / build `items` in save.
- **Crafting:** Recipe book (~42 recipes) at **workbench / anvil / forge / campfire** (also PACK → CRAFTING). Needs **materials + tool** (e.g. hammer) **and** the right **station** when required; UI shows missing ingredients/tools. Build stations from BUILD menu.
- Keeps v4: walkable outdoor spawn; power cycle = fresh run.

## v6 (server remembers the run; no save UI)
- **VERSION=6.** No SAVE button, no SAVE GAME, no SAVED toast. SYS has **QUIT TO TITLE** (run stays remembered; title shows **BACK TO DAY n**; NEW RUN there asks "abandon for good?").
- **Server remembers the current run** via the accounts API: `GET/PUT/DELETE /plays/run/sovereign` (server/src/runs.js). Key = the signed-in account (follows across devices) or the guest id cookie `mo_anon` (this browser only). The body never names the player, so no one can read/overwrite another player's run. Cap 256 KiB per run (`games.json` `runs.maxBytes`), rate limited.
- Synced silently: every 15 s, on door enter/exit, sleep, dawn, pagehide/visibility hidden (keepalive). localStorage `sovereign.save1` is only a cache; on boot the server copy wins (unless this device has a newer copy of the same run, i.e. it was offline).
- Boot auto-resumes straight into the run ("WAKING UP..." while it asks the server, max 6 s).
- **Death is final:** `die()` → `endStoredRun()` deletes the local copy and the server copy and tombstones the run id (`run_tombstones`), so a late/replayed upload gets 410 and can never revive it. Pending wipes are kept in `sovereign.ended` and retried if offline.
- **Power off→on** = `endStoredRun(true)`: wipes local + whatever the server holds, fresh title.
- Each run has a random `G.rid`; fog is stored run-length encoded (`g.fogR`). v5 local saves still load (no rid → one is assigned).

## v7 (graphics overhaul — 16-bit JRPG look)
- **VERSION=7** (`game.js?v=7`). All gameplay unchanged from v6 (one bite = death, server-remembered run, wipe on death/power-cycle).
- **All art is original**, procedurally generated / hand-authored in `game.js` at boot (no ripped sprites, tiles, fonts or music from any commercial game). Font is the game's own hand-made pixel font.
- **World:** 16x16 textured tiles with ramps, Bayer dithering and 1px outlines; grass fringe onto paths, animated water with shore foam, wall shadow bands. Trees: 3 dithered-canopy broadleaf variants (28x34) + 2 pines (22x36), picked by tile hash.
- **Buildings:** `roofImg(b)` (cached, cap 90) draws shingled front/back slopes, ridge, chimney (with smoke), and a facade per material (stone / plaster+timber / metal / log) with door, lantern, shuttered windows (lit at night via `ROOFS_VIS` light holes), flower boxes, barrels/crates and a kind sign. Interiors get plank floors and a rug.
- **Sprites:** chibi standees with 4-direction, 3-frame walks (`dir4` derives facing from movement, `WALK4=[1,0,2,0]`); zombies gray-green, bloody, torn clothes. Props (barrel, chest, crate, shelf, cabinet, bed, workbench, campfire, wood wall, corpse) redrawn.
- **UI:** blue-gradient bordered windows (`winBox`), hand cursor on selected rows, restyled HUD bars and framed minimap, dusk/night gradient light.
- Target 60fps on phones; verified ~60fps at 390x844 and 412x915.
- Fix: PACK tab hint no longer throws when the selected row has no item ref.

## v8 (3 bites, real saves, power switch pauses)
- **VERSION=8** (`game.js?v=8`). v7 art and all gameplay kept (stealth, interiors, crafting, stockpiles, 3s door invuln, walkable spawn).
- **3 bites.** `PL.bites` (saved in the run). Each bite: red screen flash, camera shake, ~0.7-tile knockback away from the zombie, zombie stunned 0.8s, **1.5s invulnerability** (no chaining), message with bites left, and an immediate save (so reloading can't undo a bite). The 3rd bite = death. Being caught while sleeping on WATCH is now a bite (you're woken), not an instant kill.
- **HUD:** 3 hearts in a blue window under the stat bars (last heart pulses).
- **Healing:** bites never regenerate. **BANDAGE** and **MEDKIT** (existing loot/shop/crafting: 2 cloth → 2 bandages; 3 cloth at workbench → 4; medkit = 3 bandage + pills + cloth at workbench) tend 1 bite each, capped at 3 (item desc shows `+1 BITE`). Painkillers do not.
- **Save:** blue **SAVE** button on the HUD (under the clock) and **SAVE / SAVE & QUIT** in SYS, with a "SAVED" window. Same server store as the v6 silent autosave (timer, doors, sleep, page hide), keyed `account:<id>` / `anon:<uuid>`. Manual saves, bites and healing push to the server immediately.
- **Permadeath:** 3rd bite ends the run and deletes the save locally and on the server (410 tombstone). Death screen says SAVE ERASED.
- **Power switch (changed):** OFF saves and pauses; ON resumes the same run. It no longer wipes. Start over with **NEW GAME** (title, or SYS menu) — confirm warns it erases the save.
