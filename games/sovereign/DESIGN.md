# Sovereign — design (v1)

Survival / foraging + tower defense on a huge seeded world. Same handheld shell
and pixel/Paper-Mario standee look as Zombie Farm (theme: `smoke`).

## Pillars

- **One bite = death.** No XP from kills. Permadeath; best-runs board by score.
- **Scarce economy.** Scavenge → sell to traders → buy tools / a bedroll.
- **Found a camp anywhere** (not in the city). Wall it, trap it, sleep in it.
- **Night wave at 22:00.** Watch live or skip to morning; damage persists.
- **Grow toward utopia.** Recruits (need a free bunk + food) take jobs:
  farmer / guard / scavenger / builder.

## World

- Tile size 16 px, world 3072×3072 tiles (~17 min walk barefoot), chunks 32×32,
  streamed. Seeded biomes: grass, forest, sand, water / rivers / lakes, roads.
- Sets: home town (spawn), more towns, a city, factories, mines, farms, gas
  stations, cabins. Each town has a trader.
- Minimap on the HUD; SELECT opens a fogged zoomable map. Discovered place
  names stick.

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

## Audio

Synthesized SFX + simple music (tense during a live wave). Mute via the
handheld shell power switch.

## Tech

- `index.html` + concatenated `game.js` (sources in `/workspace/sov/p1..p11.js`
  during development). Shared `auth.js` + `handheld.js`.
- `localStorage` save / CONTINUE. Server leaderboard when accounts API is up;
  otherwise a this-device board.
- Registry: `server/games.json` id `sovereign`, metric `score`, outcome `died`.

## Controls

| Input | Action |
|---|---|
| D-pad / WASD / arrows | Move (steer in a vehicle) |
| A / Space | Use, search, attack, confirm |
| B / X | Hold = sprint; tap = sneak; cancel |
| START / Enter | Pack / Build / Camp menu |
| SELECT / M | Map |

## v1 gaps (known)

- Map pan / discovered names could be clearer.
- Farming / cooking are thin (few crops & recipes).
- Turret / sprinkler / metal walls exist but are late-game gated.
- No multiplayer; recruits are simple AI.
- Vehicles beyond bike are rare and gas-starved by design.
- Watch-mode wakes you when zombies breach ~5.5 tiles of the bed — intended.
