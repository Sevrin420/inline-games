# Last Tower v2: style notes (target look: *A Link to the Past*, SNES 1991)

These notes are research for v2's art direction. **All Last Tower art is original and generated in code.** No Nintendo sprites, tiles, characters, logos or palettes are copied. We copy the *rules* of the style, not the assets.

## 1. Hardware frame (why it looks the way it does)
- **Resolution:** 256x224 NTSC, with a 239-line mode available. Everything is drawn at 1:1 and scaled by an integer. *(SNESdev Wiki: SNES PPU for NES developers; Mega Cat Studios SNES Graphics Guide.)*
- **Colour:** 15-bit colour (5 bits per channel, `0BBBBBGG GGGRRRRR`), 256 CGRAM entries. Index 0 of every sub-palette is transparent. *(SNESdev Wiki: Palettes.)*
- **Sprites:** always 4bpp, so 15 colours plus transparency per sprite palette, with 8 sprite palettes. Sizes are 8x8, 16x16, 32x32 or 64x64. *(SNESdev Wiki: Sprites.)*
- **Backgrounds:** ALttP runs in BG Mode 1. BG1 and BG2 are 16-colour layers (ground versus overhangs and upper floors); BG3 is a 4-colour layer used for the HUD. Colour math (add/subtract) handles translucency, fog and the Dark World overlay. *(SNESdev Wiki: Backgrounds; spannerisms/jpdasm "Graphics and Rendering Pipeline".)*
- **Tiles:** 8x8 hardware tiles composed into 16x16 metatiles. Diagonal walls look rounded because of the 8x8 budget. *(Ken Vermette, "A Link to the Tileset & Sprite Trivia".)*
- **Link sprite:** 16x24, made of a head plus body layer. The shadow is a separate dark ellipse about 12x6 drawn under the feet. *(alttpr-collection `sprite_previews.py`.)*

## 2. Projection: 3/4 top-down ("oblique")
- **What you see:** the top surface and the south-facing front face of objects. The camera reads as about 45 degrees but is drawn orthographically, so there is no vanishing point. *(SLYNYRD Pixelblog 3, Graphical Projection; r/gamedev and r/PixelArt threads on the Zelda perspective.)*
- **Faux perspective:** a cliff's front face is about 2 tiles tall, while its back and side edges are about 1 tile. This is a deliberate fake that keeps the player readable and makes "jump down a ledge" work. *(GameDev.net thread on ALttP art style.)*
- **Hidden-player rule:** tall foreground objects are rarely placed over walkable south areas. Interior south walls are often omitted entirely so the player is never hidden. *(Ken Vermette.)*
- **One projection rule per scene.** Never mix viewpoints. *(SLYNYRD.)*

## 3. Light, ramps and shading
- **Single light source, top-left.** Lit faces are the tops and the upper-left edges; shadow falls on the lower-right and on recessed areas. *(SLYNYRD; Pixeli "Shading and light".)*
- **3–4 tone ramps per material:** highlight, base, shadow and deep. Shadows hue-shift toward blue/purple and desaturate; highlights shift toward yellow and saturate. *(Pixeli "Shade a sprite".)*
- **Dithering:** minimal. Use ordered patterns only on large flat areas or transitions, never on 16x16 characters. *(Pixeli.)*
- **No semi-transparent pixels in the art itself.** Translucency comes from layer colour math (our night light map), not from soft brushes. *(Pixeli.)*

## 4. Outlines and silhouettes
- **Sprites** get a dark, near-black outline for readability over busy ground. ALttP mostly uses a dark outline on characters, with interior lines in a darker ramp shade (selective outlining). *(Pixor "What is selout?")*
- **Silhouettes** are chunky and readable at 16 px: big head, clear 4-direction poses, and 2–3 walk frames per direction. *(videocue "Link to the Past Overhead Look".)*
- **Drop shadow:** a dark ellipse under every actor, drawn on the ground layer.

## 5. Palette identity
- **Light World:** saturated greens and blues. **Dark World:** the same layouts re-coloured with desaturated purples, dull greens and murky earth tones. Colour communicates danger. *(videocue; CelestinaDragoni ALttP palette repo.)*
- **Last Tower uses a "Dark World" ramp set:** purple-grey asphalt, rust, olive dead grass, sickly skin greens, and amber window light as the warm accent.

## 6. How v2 applies this
| Rule | Implementation |
|---|---|
| Low res, integer scale | Square internal canvas of about 243–296 px, an integer device-pixel scale, `image-rendering: pixelated`, no smoothing. |
| 16x16 metatiles, 3/4 view | Tile map of 80x80 x 16 px. Buildings show a roof (top) plus a south wall face. The tower shows a roof plus a tall south face with ledge platforms. |
| Layers (BG1/BG2) | Static ground and structure layer pre-rendered once. A y-sorted sprite layer draws actors and tall props. A "BG3" HUD layer draws last. |
| 4bpp-style sprites | Each sprite is 16x22 using at most 15 colours: outline, 3-tone ramps for skin, hood, coat, pants and boots, plus an accent. |
| Top-left light | Automatic ramp shading: top and left edges use the highlight tone, bottom and right edges the shadow tone. Buildings cast a purple-tinted shadow to the east. |
| Outlines | Automatic 1 px near-black outline (#140c18) around every sprite silhouette. |
| Drop shadows | Dark ellipse under the player, zombies and items. Its size shrinks with jump height. |
| Ledges / cliffs | Level-based tiles. A jumps up exactly one level across a face. Walking off an edge auto-hops down, like ALttP ledges. |
| Never hide the player | Static art stays inside its solid footprint. Tall props (lamps, dead trees) fade when the player is behind them. If a zombie or prop still overlaps, the player is redrawn as a bright silhouette outline on top. |
| Dark World mood | Muted ramp set, plus a night light map multiplied over the scene with banded (posterised, dithered-edge) light pools. |

## Sources
- SNESdev Wiki: Backgrounds, Sprites, Palettes, and SNES PPU for NES developers (snes.nesdev.org/wiki)
- Mega Cat Studios: Super Nintendo Graphics Guide (megacatstudios.com/blogs/retro-development/super-nintendo-graphic-guide)
- spannerisms/jpdasm, Graphics and Rendering Pipeline (deepwiki.com/spannerisms/jpdasm)
- Ken Vermette: A Link to the Tileset & Sprite Trivia (kver.ca/2016/10/a-link-to-the-tileset-sprite-trivia/)
- SLYNYRD: Pixelblog 3, Graphical Projection (slynyrd.com/blog/2018/3/14/pixelblog-3-graphical-projections-1)
- GameDev.net: "The Legend of Zelda: A Link to the Past art style?" (gamedev.net/forums/topic/637392)
- r/gamedev (1un387) and r/PixelArt (14navcf) threads on the Zelda 3/4 perspective
- Pixeli: Shade a sprite, and Shading and light (pixeli.pebbly.space)
- Pixor: What is selout? (pixor.art/learn/selout/)
- alttpr-collection: sprite_previews.py (github.com/miketrethewey/alttpr-collection)
- videocue: Link to the Past Overhead Look (videocue.io/looks/link-to-the-past-overhead)
- CelestinaDragoni: zelda-link-to-the-past-color-palette (github.com)
