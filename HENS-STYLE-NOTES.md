# Last Tower: Chikn Edition (hens.farm style notes)

These notes cover the v4 reskin of `games/last-tower`. It is built for the hens.farm / chikn community.
The owner (Sev7) has full permission to use the hens.farm artwork.

## The hens.farm vibe (from https://hens.farm, its CSS, /media and X @hensdotfarm)

- **Characters:** flat cartoon hens.
  - White body, chunky red comb and wattle, yellow-orange beak and legs, and dot eyes.
  - Simple and slightly deadpan: neutral, annoyed, surprised.
  - There are many "job" hens: detective, boxer, professor, math hen, wallet hen.
- **Line weight:** thick, uniform black ink outlines (`--line: 3px`; borders 2–4px solid ink).
- **Shading:** no gradients. Flat fills with at most one shade.
- **Shadows:** hard offset ink drop shadows on cards and buttons (`box-shadow: 6px 7px 0 ink`).
- **Palette:**

  | Name | Hex |
  | --- | --- |
  | hens green | `#08d14a` |
  | dark green | `#036b2b` |
  | ink | `#090b0a` |
  | cream | `#f8f5e9` |
  | gold / egg | `#ffc42f` |
  | red / comb | `#ff3347` |
  | sky | `#8ed8ff` |
  | pinks | `#ffb1b9` / `#ff8d8d` |

- **Typography:** "Arial Black" / Impact at weight 950, a lowercase `hens.farm` wordmark and tight letter-spacing.
- **Texture:** a soft-light noise overlay.
- **Mood:** cheerful, sunny and a bit absurd. Short deadpan lines: "Billions must bok.", "We said bok.", "Boktober".

## chikn lore and terms used in the game

Sources are docs.chikn.farm and @hensdotfarm.

- **chikn** lay **$EGG**; $EGG earns **$FEED**; $FEED grows **KG** (Killergainz).
- **roostr** eat $EGG. **HEGG** / golden egg. The **flock**, the **coop**, **bok**, **GM**.

How these terms appear in the game:

- Player: a hen hero with a blue bandana.
- Enemies: the undead flock (zombie chikn) and zombie roostrs (the brutes).
- Items:
  - Food: CORN cob and a SACK OF $FEED.
  - Healing: GOLDEN HEGG.
  - Ammo: EGGS and CORN KERNELS.
  - Stamina: JUICY WORM.
- Weapons: PECK, RAKE, PITCHFORK, EGG BLASTER, CORN SHOTGUN.
- Eating gives "NOM. FEED n% +KG"; dying is "PLUCKED". "DAY N. GM. YOU MADE IT."

## How each rule maps to the pixel game

- **Outlines:** every sprite and tile has a 1px ink (`#090b0a`) outline. Pixel art keeps integer scaling and crisp pixels.
- **Palette:** the a.js ramps were remapped to the hens palette.
  - Sunny farm days: straw, dirt track, bright grass, barn red, whitewash, slate.
  - Night stays a blue multiply light map.
  - Zombie blood is green goo.
- **Hard offset shadows:** HUD and menus use cream cards with a 1px ink border and a 2px ink offset shadow, plus ink text and gold selection bars. The touch buttons use 3/4px ink offset shadows.
- **World:**
  - The tower is THE COOP: a barn-red plank coop with nest-box holes, eggs and white trim.
  - The ladder is a chikn ramp with slats and gold UP arrows; the step is a wooden perch plank.
  - The roof has a white picket rail.
  - The city is a farmyard: barns and farmhouses, hay bales, fences, tilled fields, tractors and hay wagons, lantern poles, apple trees and a rooster weathervane.
- **Characters:**
  - Hand-pixeled 16x22 hens based on the hens.farm base-hen reference sheet (front, back, profile).
  - Zombies are the same hen, recoloured to grey, mauve or sick green, with a torn comb, plucked gaps and glowing eyes.
  - Brutes are widened dark roostrs with red eyes.

## Asset sources (all used with permission)

| In-game file | Source | Use |
| --- | --- | --- |
| `games/last-tower/hen-title.png` (46x62) | https://hens.farm/assets/base-hen-600.png | title screen hen |
| `games/last-tower/hen-plucked.png` (47x50) | https://hens.farm/assets/confused-hen-600.png | death screen |
| `games/last-tower/hegg.png` (12x14) | https://hens.farm/assets/golden-egg-320.png | HUD supplies |
| `games/last-tower/previ.png` | base-hen-600, golden-egg-320 and gameplay screenshots | share card |

- **References only (not shipped):** `/assets/base-hen-reference/base-hen-*.png` (10 poses), the hen-detective, hen-boxer, professor-hen and other `/assets/*-600.png` hens, `/assets/og/home-card-v2.jpg`, and the @hensdotfarm posts.
- **Pixelizer:** the hens.farm art was converted with a box downscale, then luminance below threshold became ink and other pixels snapped to the nearest palette colour, then a 1px outer ink outline was added. The script is `/workspace/hens/pix.py` on the build box.

## v5: closer to hens.farm (survival edition)

- **Real hens.farm characters as the sprites:** `games/last-tower/hens-sprites.png` is generated from the hens.farm base-hen reference sheet (`front`, `back`, `right-profile`).
  - Pixelated to 28 px tall, in 30x33 cells. Left is mirrored from right.
  - The front face was hand-fixed at 28 px: white face, two ink eyes, gold beak, red wattle.
  - Walk = 1 px body bob plus a lifted foot.
  - PECK frame per direction: the head thrusts forward (down 3 / up 3 / sideways 3 px with a filled neck).
- **Undead flock:** the same hens recoloured (sick green / dusty / lilac), with dull torn combs, goo flecks and glowing eyes. Zombie roostrs are the same hen at 1.3x width in brown, with a red comb and red eyes.
  - The old hand-pixeled 16x22 hens stay in code only as a fallback until the sheet loads.
- **Flat fills:** the sprite painter no longer applies SNES ramp shading (one flat colour per material plus the ink outline). Ground speckle noise is cut by about 70%.
- **Palette:** grass is exactly hens green `#08d14a` and the farmyard is cream `#f8f5e9`.
- **Hard offset ink drop shadows:** every hen and zombie gets an ink silhouette offset +2/+1 (38% ink). Crates, barns and hay use 40% ink offset blocks, like the hens.farm card shadow.
- **HUD portrait:** `hen-faces.png` holds real hens.farm heads (happy, neutral, annoyed and surprised poses, pixelated). It sits next to the LIFE bar and changes mood with LIFE and when you're hit.
- **Shell:** Last Tower opts into the green `matcha` theme (`data-theme="matcha"`; the shared handheld.js now reads `data-theme`).
- **New asset sources:** https://hens.farm/assets/base-hen-reference/base-hen-{front,back,right-profile,happy,neutral,annoyed,surprised}.png
- **Build scripts** (on the build box): `/workspace/hens/v5/gen.py` and `/workspace/hens/v5/compare.py`.

## v6: egg-slinger zombie + lost meals
- **Thrower (egg slinger)**: same 30x33 cell grid as the zombie hens (sheet rows at y=676), but hunched (head dropped and pushed forward), sickly teal body (72,150,156) / dark (40,98,108), purple comb (140,70,190), orange eyes, dull beak, brown leather bandolier of cream eggs with green rot. Reads as a different silhouette and colour from across the screen.
- **Tell**: stops, faces the hen, raises a rotten egg overhead with a flashing red "!" for 0.7 s.
- **Rotten egg**: rounded pale-lime egg with green spots and ink outline, tumbling along a visible arc; a blinking red/gold ink ring marks where it will land and its shadow tracks the ground. Splat = egg goo + shell bits.
- **Lost meal**: the food item flies off the hen, tumbles and splats; the HUD flashes FOOD LOST in red.

## v9: swarm edition look
- **Colour pop**: one saturation (x1.38) + mid/dark deepening pass over every baked canvas (map, props, items, sprite sheet); cream highlights are protected so the hens.farm cream ground stays warm. `?pop=0` shows the old look.
- **Shadows** (one light direction, sun top-left -> shadows fall right/down): soft contact ellipses under every hen, roostr, item and pickup; hard ink offset sprite shadows kept; baked ellipses/long shadows under trees, lamps, antennas, barrels; 2px drop under fences; crates/barns/tractors keep their right/bottom ink shadows.
- **Enemy attack frames** (sheet now 228x808): every enemy has 6 frames per direction = 4 walk + STRIKE (lunging peck) + WIND-UP (crouch / head reared back). Wind-up also blinks red and shakes; strikes draw a white/red slash crescent; roostr stomps draw an ink + white/gold shockwave ring.
- **Juice**: white hit flash on every damage tick, muzzle flashes (big for the shotgun), ejected casings/kernel husks, feather + goo gibs on kills, a gold ring under the hen when the swarm covers her.
- **New pickups**: machine gun, belt of rounds, green ammo crate.

## v11: hens.farm skin (shell + game) and 2-button diagonals
- **One palette for shell and game**:

  | Use | Hex |
  | --- | --- |
  | hens green: shell body, grass, trees | `#08d14a` |
  | ink: outlines, D-pad, bezel, roofs, UI text | `#090b0a` |
  | cream: farmyard ground, cards, pills, mute, whitewash | `#f8f5e9` |
  | egg gold: straw, hay, lamps, pressed buttons, hints | `#ffc42f` |
  | comb red: shoot pad caps, barns, HUD accents | `#ff3347` |
  | sky: backdrop, glass | `#8ed8ff` |

  - The v9 colour-pop pass now locks these exact colours (`HENS_LOCK` in a.js).
  - Night lighting is a deep sky-teal multiply, dusk is golden, and lamp/muzzle light is gold.
- **Shell skin**: `games/last-tower/skin/hens-skin.css` and `hens-skin.js`. They are linked only from Last Tower's index.html; the shared handheld files are untouched.
  - The skin restyles the matcha theme: flat green body, a 3px ink outline and an 8/9px hard ink offset shadow.
  - Red shoot caps with ink rings turn gold when pressed. The D-pad is an ink cross, the pills and mute are cream cards, and the backdrop is sky with green hills.
  - Real images:
    - a lowercase "hens.farm" wordmark with the base hen icon;
    - the base hen peeking over the top of the shell (portrait only);
    - the golden egg as the speaker;
    - a footer reading "BILLIONS MUST BOK".
  - `?skin=classic` gives the v10 look.
- **Real art in the game, crisp and not pixelated**: `#skinLayer` sits over the canvas, and game.js places each image in canvas coordinates:

  | Element | Real image |
  | --- | --- |
  | HUD portrait (mood follows LIFE / hits) | happy / neutral / annoyed / surprised heads |
  | Title hero | the boxer hen, plus the golden egg |
  | Death card | the confused hen |
  | Pause card | the detective hen peeking over the card |

  - The hens and roostrs on the map are still the v5 sprites. Those were already pixelated from the real base-hen reference sheet (front, back and profile) and recoloured for the undead flock.
- **Asset sources** (all from https://hens.farm/assets/, used with permission; converted by `/workspace/hens/v11/mk.py` with a crop, a Lanczos resize and a 256-colour quantize):

  | Skin file | Source |
  | --- | --- |
  | `skin/faces.png` (4 x 150x120) | `base-hen-reference/base-hen-{happy,neutral,annoyed,surprised}.png` |
  | `skin/boxer.png` | `hen-boxer-600.png` |
  | `skin/confused.png` | `confused-hen-600.png` |
  | `skin/detective.png` | `hen-detective-600.png` |
  | `skin/peek.png` | `base-hen-reference/base-hen-three-quarter-front.png` |
  | `skin/egg.png` | `golden-egg-320.png` |
  | `skin/icon.png` | `base-hen-96.png` |
  | `skin/shuffle.png` (spare, not used yet) | `hen-shuffle-600.png` |
  | `previ.png` | hen-boxer-600, golden-egg-320 and a v11 gameplay screenshot |

  - References only: `og/home-card-v2.jpg` (hills, wordmark) and `og/media-coop-card.jpg`.
- **Diagonals**:
  - Pressing two adjacent shoot buttons (N+E, E+S, S+W, W+N) fires on that diagonal. So do a thumb between two buttons, two arrow keys, or I+L, K+L, K+J and I+J.
  - A 110 ms chord window holds the first shot so the second finger can land; a quick single tap fires on release.
  - On a diagonal the hen uses its side profile, the gun and muzzle flash point along the diagonal, and a gold aim marker (two pips and a red tip) shows the line. Both pad buttons light up.

## v13 (Oct 19 2026)
- Pickups drawn 3x (48 px) as a ground layer under every actor (so they never hide the hen), with a pulsing gold halo ellipse (#ffc42f, ink rim), bob and sparkle. Pickup reach 22x20 (was 10x10).
- Shell (Last Tower only, CSS in last-tower/index.html): `.hh-select` hidden; the START pill spans both slots (92x24, label "START · PAUSE" inside the pill). Shared handheld.js/css untouched. Touch (`?handheld=0`): one big PAUSE button.
- Achievements (ach.js): gold #ffc42f title, 2 px ink outline, 4 px hard ink offset shadow, scale-in pop, bok fanfare, queued (backlog plays faster), top band at 29% of the screen. Saved in localStorage `lasttower.ach1`; title shows TROPHIES n/26; death screen lists the run's achievements.

## v14 (Oct 19 2026)
- No pause: the START/SELECT pills are hidden (Last Tower CSS only), the pause menu and Enter/Esc/P are gone. A screen tap, the SHOOT stick, Space or any shoot key starts and restarts.
- No instructions: hint line, title controls panel, start/restart prompts and tutorial messages removed. HUD, EQUIPPED, achievements, title and death screens stay.
- Round analog SHOOT stick (`.lt-astick`, mounted by game.js into the shell's `.hh-spad` slot and into `#tAim` in `?handheld=0`): cream base, 5 px ink ring + hard ink shadow, red knob (gold + gold ring glow past the 22% deadzone), springs back on release, ring pulses gold on title/death. Exact 360-degree aim; keyboard keeps 8-way arrows/IJKL. Shared handheld.js/css untouched.
