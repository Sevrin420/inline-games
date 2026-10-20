# sfx/halo: official Halo: Reach multiplayer announcer (Zombie Farm v21)

**Halo announcer audio © Microsoft / Bungie (Halo: Reach multiplayer announcer, voiced by Jeff Steitzer), used under the site owner's parody license.**

Used for: "Slayer" once at run start, the multi-kill chain (Double Kill → Killionaire), and "Game Over" on death. The no-hit streak tiers and
First Blood use the Unreal Tournament announcer instead (`../ut/`). A missing line is never replaced with a synthesized voice. The old
synthesized voice (`../original/`) only plays with `?announcer=original`, and `?announcer=0` turns the announcers off.

Processing (ffmpeg): leading and trailing silence trimmed (-45 dB), loudness normalized to -15 LUFS / -1.5 dBTP, mono 44.1 kHz, 96 kbps mp3.
Each clip was verified by speech recognition (faster-whisper small.en, no prompt) to say the expected line. Downloaded 2026-10-20 (HST).

| file | line | source |
|---|---|---|
| `slayer.mp3` | slayer | https://www.myinstants.com/media/sounds/halo-reach-slayer-voice.mp3 |
| `double.mp3` | double kill | https://www.myinstants.com/media/sounds/halo-reach-double-kill.mp3 |
| `triple.mp3` | triple kill | https://www.myinstants.com/media/sounds/halo-reach-triple-kill.mp3 |
| `overkill.mp3` | overkill | https://www.myinstants.com/media/sounds/halo-reach-overkill.mp3 |
| `killtacular.mp3` | killtacular | https://www.myinstants.com/media/sounds/halo-reach-killtacular.mp3 |
| `killtrocity.mp3` | killtrocity | https://www.myinstants.com/media/sounds/halo-reach-killtrocity-voice.mp3 |
| `killamanjaro.mp3` | 7 killamanjaro | https://www.myinstants.com/media/sounds/halo-reach-7-killamanjaro.mp3 |
| `killtastrophe.mp3` | 8 killtastrophe | https://www.myinstants.com/media/sounds/halo-reach-8-killtastrophe.mp3 |
| `killpocalypse.mp3` | killpocalypse | https://www.myinstants.com/media/sounds/halo-reach-killpocalypse-voice.mp3 |
| `killionaire.mp3` | killionaire | https://www.myinstants.com/media/sounds/halo-reach-killionaire-voice.mp3 |
| `gameover.mp3` | game over | https://www.myinstants.com/media/sounds/halo-reach-game-over-voice.mp3 |

Also found but not used (UT99 covers the streaks): killing spree, killing frenzy, running riot, rampage, untouchable, invincible
(https://www.myinstants.com/media/sounds/halo-reach-killing-spree.mp3 etc.). The chicken-pun lines (Egg-stermination, Boktacular, Fowl play,
Billions must bok) were removed. Other sources tried: halo.fandom.com (no announcer audio on the wiki), halopedia.org (images only),
sounds.spriters-resource.com (Cloudflare 403 from the build box), archive.org (only an *unused*-lines pack).
