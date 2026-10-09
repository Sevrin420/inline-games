# Handheld overlay (MEMBERSONLY pocket)

`games/shared/handheld/` is a shared "brick handheld" shell any game can opt into: a molded-plastic
body around a big **square** game screen, with a sliding power switch on the top rim, a D-pad, A/B, START/SELECT,
a mute button, a dot-grille speaker, screws, power/battery LEDs and a cartridge-slot hint. On phones
the buttons are real touch controls. The design and branding (MEMBERSONLY *pocket*,
"MEMBERSONLY.CC · INLINE PLAY SYSTEM") are our own. It uses no third-party logos, names or artwork.

- `handheld.js`: plain script, no build step, no dependencies. It loads `handheld.css` next to itself.
- `handheld.css`: all of the styling. Pure CSS (gradients and shadows), no images.
- `demo.html`: a playground that shows a dot you move with the keys, plus a log of every event the buttons send.

Used by **Lunch Rush** and **Thimblewood**. Coop Sweep does not use it (by choice).

## Opting a game in (one line)

Add this after the game's canvas or element, usually at the end of `<body>`:

```html
<script src="../shared/handheld/handheld.js" data-screen="#c" data-aspect="136/188" data-name="LUNCH RUSH"
        data-keys='{"a":" ","b":"x","start":"Enter","select":"Escape"}'></script>
```

Or call it from JS:

```js
Handheld.mount({
  element: canvas,          // or a selector; this element becomes the "screen"
  aspect: 136 / 188,        // the GAME's width / height (default 1). The shell's screen window is always
                            // square; the game is fitted inside it at this aspect, with a themed fill around it.
  name: 'LUNCH RUSH',       // small label on the body
  keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
          a: ' ', b: 'x', start: 'Enter', select: 'Escape' },   // these are the defaults
  pointer: false,           // true = D-pad moves an on-screen cursor (for tap-only games)
  layout: 'auto',           // 'portrait' | 'landscape' | 'auto' (whichever shows the bigger screen)
  diagonals: true, repeat: true,
  onButton: (name, down) => {},   // optional hook, called on every press/release
});
```

| `data-*` attribute | option |
|---|---|
| `data-screen` | `element` |
| `data-aspect` (`"w/h"` or a number) | `aspect` |
| `data-name` | `name` |
| `data-keys` (JSON) | `keys` |
| `data-pointer="true"` | `pointer` |
| `data-layout` | `layout` |

### The one rule for the game

**Size your canvas from its own box, not from the window.** The shell puts the element inside the screen and
fires a window `resize` whenever the screen changes size:

```js
function resize() {
  const box = cv.getBoundingClientRect();
  const w = Math.max(1, box.width || innerWidth), h = Math.max(1, box.height || innerHeight);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  ...
}
addEventListener('resize', resize);
```

Map pointer coordinates with `getBoundingClientRect()` too (Lunch Rush already did). The body is CSS-scaled
to fit the viewport. Because the backing store comes from the on-screen box × `devicePixelRatio`, the game
stays crisp. Without the shell, the box is the whole window, so the game behaves exactly as it did before.

## What the buttons send

- **Key values** (`' '`, `'Enter'`, `'x'`, `'ArrowUp'`, ...): real `KeyboardEvent`s (`keydown` on press,
  `keyup` on release) with `key`, `code` and `keyCode`/`which`. They are dispatched on the game element and
  bubble to `window`, so existing key handlers work unchanged. Holding a D-pad direction auto-repeats
  (`repeat: true`) after 320 ms, every 85 ms. Events carry `e.handheld === true` if you need to tell them apart.
- **`'tap'`**: a pointer/mouse press at the D-pad cursor (`pointerdown`/`mousedown` on press,
  `pointerup`/`mouseup`/`click` on release). Holding A works as a long press.
- **A function**: called as `fn(isDown)`.
- **`null`**: does nothing. The button still animates.

With **`pointer: true`**, the D-pad moves a pulsing cursor over the screen instead of sending arrow keys.
It speeds up while held. A real tap on the screen hides the cursor. This lets tap-only games be played
from the buttons.

**Modals.** While a `.lb-veil` (leaderboard) or `.mo-veil` (sign-in panel) is open, the game buttons are
paused. **B** or **START** closes the panel: the shell sends Escape and clicks its `[aria-label="Close"]`
button. Change this with `modal: '<selector>'`, or turn it off with `modal: null`.

**Sign-in chip.** The shell moves the `auth.js` chip (`.mo-chip`) onto the top edge of the body, so it covers
neither the screen nor the controls. The chip returns to its normal corner when the shell is hidden.
Change this with `adopt: '<selector>'`, or turn it off with `adopt: null`.

## Touch behaviour

- Every control is hit-tested on each pointer move, so:
  - fingers can slide around the D-pad (right → down → left) or from B onto A;
  - several fingers work at once (for example, holding a direction while pressing A);
  - nothing gets stuck: everything is released on lift, cancel, window blur or tab hide.
- Each new press gives a short `navigator.vibrate(8)` where the browser allows it.
- `touch-action: none`, no text selection, no callout and no double-tap zoom on the body.
- The game screen itself is untouched: taps and clicks on it go straight to the game. The glass,
  scanline and cursor layers are `pointer-events: none`.
- Physical keyboard presses light up the matching on-screen button. This is display only.

## Look and settings

- **Mute:** the embossed speaker button on the bottom-left of the body (where THEME / FX / HIDE used to sit).
  Tap it to silence **all** game audio: Web Audio contexts are suspended, and `<audio>`/`<video>` elements are
  muted and paused. Tap again to restore. The slash appears on the icon while muted. Remembered in
  `localStorage` as `handheld.muted` (`1` / `0`), shared by every game on the site. Games can listen for
  `window` `handheld:mute` (`e.detail.muted`), read `Handheld.current.muted`, call `setMuted(bool)`, or pass
  `onMute(muted)` to `mount`. Power-off uses the same audio gate, so turning the console back on while mute
  is on stays silent.
- **Themes** (no on-shell UI; Sunset is the fixed default). Optional `?theme=<id>`, `mount({ theme })`, or
  `setTheme(id)`. Older saved theme ids fall back to Sunset. Available ids:
  - `sunset` (default): orange → coral → magenta → plum gradient, yellow A, violet B.
  - `nova`: deep midnight-navy two-tone body, neon coral A, teal B.
  - `matcha`: soft green, cream A, peach B, forest bezel.
  - `smoke`: clear smoke plastic with the circuit board, screws and a cyan glow showing.
  - `gold`: champagne-gold metallic with a black bezel and black buttons.
  - `vapor`: pink → lilac → cyan with a faint grid, hot-pink A, cyan B.
  - Each theme also sets the D-pad, START/SELECT, LED, wordmark and page-glow colours.
  - If set via API/URL, the choice is stored in `handheld.theme`.
- **Materials:** specular highlight, molded micro-texture, chamfered edges, embossed wordmark and labels,
  an inset screen with glossy cover glass over the whole bezel. All CSS gradients/shadows, no images.
- **Screen effect** (no on-shell UI; default `glass`). Optional `mount({ fx })` or `setFx(...)`. Stored in
  `handheld.fx` when changed via API:
  - `glass`: a subtle reflection and inner shadow. This is the default.
  - `lcd`: the glass plus a faint scanline/pixel grid.
  - `off`: no effect.
  - All of these are static CSS layers, so they add no per-frame cost.
- **Layout:**
  - **Portrait** puts the screen on top and the controls below. Phones use this layout.
  - **Landscape** puts the D-pad on the left, the screen in the middle and A/B on the right. Desktops and
    landscape phones use this layout.
  - `auto` picks whichever shows the game bigger.
- **Square screen:** 340 px (portrait) / 420 px (landscape) before scaling; the body is scaled to fit, so a
  390x844 phone gets a ~350 px screen and a 1280x800 desktop ~590 px. Games that aren't square are letterboxed
  inside it (Lunch Rush gets side bars); Thimblewood renders a square stage.
- **Power switch:** the slider on the top-left of the rim. Tap it, or drag the knob. **OFF**: the picture
  collapses to a line and a dot (CRT style), the screen goes black, both LEDs go dark, and the game is
  paused: the shell holds the page's `requestAnimationFrame` callbacks, suspends Web Audio contexts and pauses
  `<audio>`/`<video>`, releases held buttons (and sends a `blur`), and blocks keys, buttons and taps. **ON**: a
  short wordmark boot, then the picture opens back up and everything resumes where it was (unless mute is on).
  Power is never remembered: the shell always starts ON.
  Games can listen for `window` `handheld:power` (`e.detail.on`) or pass `onPower(on)` to `mount`.
- **Sign-in chip:** adopted into the top-right of the rim, clear of the power switch.
- **Power-on flash:** a short MEMBERSONLY *pocket* flash plays once per browser session. It is skipped
  with reduced motion.

URL switches:
- `?handheld=0` starts with the shell disabled (full-window game; no restore chip).
- `?handheld=1` forces the shell on (same as the default).
- `?theme=<id>` picks a colour theme for this load (see list above).
- `?handheld=none` and `?shot` never mount the shell. `?shot` is the X-card image capture, so card images
  stay clean.

If `handheld.css` fails to load or is served with the wrong type, the shell removes itself and the game runs
as before.

## API (after mounting)

`Handheld.current` gives you:
- `press(name)` and `release(name)`
- `tap()`
- `setTheme(id)`, `setFx('glass'|'lcd'|'off')`, `setVisible(bool)`
- `setMuted(bool)` and `muted`
- `setCursor(x, y)` (fractions of the game view, `.hh-view`) and `cursor`
- `setPower(bool, quick)` and `power`
- `theme`, `fx`, `visible`, `layout`
- `relayout()`, `destroy()`
- `root`, `screen`, `element`

## Per-game mappings

| Game | D-pad | A | B | START | SELECT |
|---|---|---|---|---|---|
| Lunch Rush (`pointer: true`) | moves the cursor | taps at the cursor | Escape (deselect) | Enter (start / try again) | nothing |
| Thimblewood (`#stage`, square) | arrows (walk) | Space (talk / read / advance) | x (close) | Enter (start / talk) | m (sound on/off) |

Thimblewood mounts its `#stage` (the 3D canvas and the UI canvas together) with `data-aspect="1"`, so it
fills the square screen; tilt-shift, bloom and the
pixel UI all render inside the screen. While the shell shows, the game sets `html.tw-shell`, hides its own
stick and A button, and renders the 3D view at a chunkier internal resolution. Disabling the shell with
`?handheld=0` brings the touch controls back.

Lunch Rush gained a small key handler for this: Enter or Space starts a run from the title or game-over
screen, and Escape deselects.

## Testing

```
cd server && CHROME_PATH=/usr/bin/google-chrome npm run browser:handheld [screenshot-dir]
```

This runs the demo page, Lunch Rush and Thimblewood (WebGL via SwiftShader) at 390x844 (touch, @3x) and
1280x800. It checks:
- key events, hold-repeat, sliding across the D-pad and two-finger presses;
- cursor + A taps, and direct screen taps;
- the square screen and the game fitted inside it at its own aspect;
- the power switch: tap OFF freezes the game, blocks keys and buttons, LED dark; drag to ON resumes;
- the mute button: toggles `Handheld.current.muted`, fires `handheld:mute`, suspends Web Audio, persists in
  `localStorage` (`handheld.muted`);
- `?shot` and `?handheld=0`;
- no console errors.
