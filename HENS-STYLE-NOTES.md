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
