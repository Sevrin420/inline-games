# sfx/halo (empty on purpose)

Last Tower can use licensed Halo multiplayer announcer clips here. Drop short mp3/ogg clips in this folder and add a
`manifest.json` like `{"lines": {"slayer": "slayer.mp3", "double": "double_kill.mp3", ...}}` (keys: slayer, double, triple,
overkill, killtacular, spree, frenzy, riot, rampage, untouchable, gameover). Lines that are missing fall back to the original
voice in `../original/`. When any clip from here is used, the death credits end with the line
"Halo announcer audio (c) Microsoft / Bungie, used under the site owner's parody license".

Status (v19): no clips are included. The public archives we tried (The Sounds Resource, halo.bungie.org) could not be reached
from the build box (Cloudflare challenge / connection timeout), so the game ships with the original announcer only.
Candidate sources: https://sounds.spriters-resource.com/xbox_360/haloreach/asset/438870/ (Reach "Flavor" announcer),
https://sounds.spriters-resource.com/xbox/halocombatevolved/asset/413568/ (Halo CE multiplayer announcer).

Halo announcer audio (c) Microsoft / Bungie, used under the site owner's parody license.
