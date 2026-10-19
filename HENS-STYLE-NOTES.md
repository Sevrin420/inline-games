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
