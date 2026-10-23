# Sovereign — design (v2)

Survival / foraging + tower defense on a huge seeded world. Same handheld shell
and pixel/cardboard-cutout DNA as Zombie Farm, pushed darker and edgier
(theme: `smoke`). Live: `membersonly.cc/sovereign/?v=2`.

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

## Look (v2)

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
VERSION=2 invalidates v1 saves.

## Phone-first

Built for phones (iPhone 14 → Pixel 7 → desktop). Touch D-pad + A/B; same
canvas shell as the other handheld games.
