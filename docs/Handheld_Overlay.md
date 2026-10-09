# Handheld overlay (MEMBERSONLY pocket)

`games/shared/handheld/` is a shared "brick handheld" shell any game can opt into: a molded-plastic
body around the game screen, with a D-pad, A/B, START/SELECT, a speaker grille and a power LED. On phones
the buttons are real touch controls. The design and branding (MEMBERSONLY *pocket*,
"MEMBERSONLY.CC · INLINE PLAY SYSTEM") are our own. It uses no third-party logos, names or artwork.

- `handheld.js`: plain script, no build step, no dependencies. It loads `handheld.css` next to itself.
- `handheld.css`: all of the styling. Pure CSS (gradients and shadows), no images.
- `demo.html`: a playground that shows a dot you move with the keys, plus a log of every event the buttons send.

Used by **Lunch Rush**. Coop Sweep does not use it (by choice).

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
  aspect: 136 / 188,        // screen width / height (match your stage, incl. its margin)
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

These are set with the small **THEME / FX / HIDE** buttons on the body and remembered in `localStorage`
(`handheld.theme`, `handheld.fx`, `handheld.on`). The settings are shared by every game on the site.

- **Themes:**
  - `classic`: warm grey with berry buttons.
  - `grape`: translucent purple, with the circuit board showing through.
  - `clear`: clear shell.
  - `yolk`: hen yellow.
  - `midnight`: black with neon.
- **Screen effect:**
  - `glass`: a subtle reflection and inner shadow. This is the default.
  - `lcd`: the glass plus a faint scanline/pixel grid.
  - `off`: no effect.
  - All of these are static CSS layers, so they add no per-frame cost.
- **Hide:** the game goes back to full-window play. A small handheld button in the top-left corner brings
  the shell back.
- **Layout:**
  - **Portrait** puts the screen on top and the controls below. Phones use this layout.
  - **Landscape** puts the D-pad on the left, the screen in the middle and A/B on the right. Desktops and
    landscape phones use this layout.
  - `auto` picks whichever shows the game bigger.
- **Power-on flash:** a short MEMBERSONLY *pocket* flash plays once per browser session. It is skipped
  with reduced motion.

URL switches:
- `?handheld=0` starts with the shell hidden.
- `?handheld=1` forces it on.
- `?handheld=none` and `?shot` never mount the shell. `?shot` is the X-card image capture, so card images
  stay clean.

If `handheld.css` fails to load or is served with the wrong type, the shell removes itself and the game runs
as before.

## API (after mounting)

`Handheld.current` gives you:
- `press(name)` and `release(name)`
- `tap()`
- `setTheme(id)`, `setFx('glass'|'lcd'|'off')`, `setVisible(bool)`
- `setCursor(x, y)` (fractions of the screen) and `cursor`
- `theme`, `fx`, `visible`, `layout`
- `relayout()`, `destroy()`
- `root`, `screen`, `element`

## Per-game mappings

| Game | D-pad | A | B | START | SELECT |
|---|---|---|---|---|---|
| Lunch Rush (`pointer: true`) | moves the cursor | taps at the cursor | Escape (deselect) | Enter (start / try again) | nothing |

Lunch Rush gained a small key handler for this: Enter or Space starts a run from the title or game-over
screen, and Escape deselects.

## Testing

```
cd server && CHROME_PATH=/usr/bin/google-chrome npm run browser:handheld [screenshot-dir]
```

This runs the demo page and Lunch Rush at 390x844 (touch, @3x) and 1280x800. It checks:
- key events, hold-repeat, sliding across the D-pad and two-finger presses;
- cursor + A taps, and direct screen taps;
- theme, FX and hide (and that they're remembered);
- `?shot` and `?handheld=0`;
- no console errors.
