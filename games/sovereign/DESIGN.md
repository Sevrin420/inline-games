# Sovereign — design (v4)

Survival / foraging + tower defense on a huge seeded world. Same handheld shell
and pixel/cardboard-cutout DNA as Zombie Farm, pushed darker and edgier
(theme: `smoke`). Live: `membersonly.cc/sovereign/?v=5`.

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
- **Easy save:** HUD **SAVE** button (phone tap) + SYS **SAVE GAME**; brief **SAVED** flash/toast. Autosave (~20s) + pagehide still run. **Power off→on still wipes save** (v4 cold-boot restart).
- **Door invuln:** Entering or exiting a building grants **3s** bite invulnerability (`PL.invuln`); cyan standee tint while active.
- **Stockpile:** After searching a world container (crate/locker/cabinet/etc.), it becomes a persistent **STOCKPILE** (deposit/withdraw, 24 stacks). Camp chests same UI. Persists via `G.looted` / build `items` in save.
- **Crafting:** Recipe book (~42 recipes) at **workbench / anvil / forge / campfire** (also PACK → CRAFTING). Needs **materials + tool** (e.g. hammer) **and** the right **station** when required; UI shows missing ingredients/tools. Build stations from BUILD menu.
- Keeps v4: walkable outdoor spawn; power cycle = fresh run.
