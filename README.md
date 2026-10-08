# inline-games

Small browser games that play **inline on X** as player cards: the post shows a
480×480 iframe and people play right in the timeline. The first game is
**Lunch Rush**, live today at <https://membersonly.cc/lunch-rush/>.

Split out of [Sevrin420/Aeterna](https://github.com/Sevrin420/Aeterna), which
also holds the separate Throbbin Abbey game. Nothing here depends on Abbey code.

## Layout

```
games/                  everything here is served statically from /opt/games
  lunch-rush/
    index.html          the whole game in one file; loads ../shared/auth.js (optional)
    previ.png           1200×630 card image X shows before the player loads
  coop-sweep/           Coop Sweep: paper-craft minesweeper with hidden hens
    index.html          the whole game in one file; loads hens/manifest.js and ../shared/auth.js
    previ.png           1200×630 card image, rendered from the game (?shot)
    hens/               THE ONLY hen art folder (swappable): PNGs, manifest.js, SOURCES.md
  shared/auth.js        shared accounts client: sign-in chip, play recording
  account/index.html    account page/popup: password, wallet (SIWE), link, reset
server/                 accounts + login + play tracking API (Node 22, Fastify, SQLite)
  src/                  app.js (routes), sessions, siwe, nft gate, db schema, config
  games.json            game registry: id, title, access level, scoreTrusted
  test/                 unit tests, local end-to-end check, browser X-card check
  .env.example          every setting, production values (nothing secret)
docs/
  Games_and_Login.md    how inline X cards work, login + anonymous play
  Auth_and_Accounts.md  account / wallet (SIWE) / NFT-gating spec + implementation notes
deploy/
  Caddyfile.example        the live Caddy config today (static /opt/games)
  Caddyfile.login.example  same plus the /auth and /plays API routes (apply by hand)
  inline-games-api.service systemd unit for the API
.github/workflows/
  deploy-games.yml      MANUAL: rsync games/ -> /opt/games on the VPS
  deploy-api.yml        MANUAL: test, then ship server/ as the inline-games-api service
  test-api.yml          on PRs: server tests + local e2e on GitHub runners (no VPS)
  vps-check.yml         MANUAL: pick a fixed read-only check to run on the VPS
```

The docs came from Aeterna, so where they say `web/<game>/`, read
`games/<game>/` in this repo.

## Games

| Game | Path | Plays | Score recorded |
|---|---|---|---|
| Lunch Rush | `/lunch-rush/` | tower-defence lunch line, 3 misses and out | seconds survived (higher is better) |
| Coop Sweep | `/coop-sweep/` | minesweeper, 8×8 with 10 hidden hens. Tap digs; long-press, right-click or the FLAG toggle flags; arrows/Space/F/R on keyboard. First dig is always safe | seconds to clear, on win and loss (lower is better, only wins count as best) |

**Coop Sweep's hen art is not cleared for public use.** It comes from the Hens
NFT collection (hens.farm, Robinhood Chain). No license or terms for the art
were found. See `games/coop-sweep/hens/SOURCES.md`. Get permission from
hens.farm before posting it, or replace the PNGs in that folder: the game also
runs with its own drawn hens if the folder is empty.

## Play / test locally

No build step. Either open `games/lunch-rush/index.html` in a browser, or serve
the folder so it behaves like the live site:

```
cd games
python3 -m http.server 8000
# open http://localhost:8000/lunch-rush/
```

To check the X card size, resize the window (or use the browser's device
toolbar) to 480×480. The game must play at that size and on phones.

## How X player cards work here

Each game's `index.html` carries the card tags in `<head>`: `twitter:card`
`player`, `twitter:player` (the URL X iframes), `twitter:player:width/height`
480, and `twitter:image` (the 1200×630 `previ.png`). Lunch Rush's tags still
point at `https://membersonly.cc/lunch-rush/`, and they should keep doing that
because X caches cards for days.

Rules (details in `docs/Games_and_Login.md`):
- Fits 480×480, works on phones.
- Self-contained: no third-party scripts, fonts or API calls. Same-origin `../shared/auth.js` and the `/auth`, `/plays` API are fine because they're optional and the game must keep working without them.
- The server must not send `X-Frame-Options` or a narrow CSP `frame-ancestors`.
- X caches cards. To force a new image, rename the image file.
- A post with attached media doesn't show the player card, so post the link as
  a reply or post the card on its own.
- Check a card with X's card validator or by posting from a test account.

New game: copy `games/lunch-rush/` to `games/<name>/`, change the title,
description, URLs and image, and keep it to one file.

## Accounts and login

Implements `docs/Auth_and_Accounts.md` (details and deviations at the end of
that doc).

- **Sign in** with a username and password (argon2id, no email), or a wallet
  through Sign-In with Ethereum (EIP-4361). A wallet with no account gets a
  wallet-only account. One wallet per account. A linked wallet can reset the
  password, and a reset logs out every other session.
- **Sessions**: a random 256-bit token, stored as its SHA-256, with a 30-day
  sliding expiry. On normal pages it lives in an `HttpOnly; Secure;
  SameSite=Lax; Domain=.membersonly.cc` cookie.
- **Inside the X card** the game is a third-party iframe, so that cookie never
  arrives. `shared/auth.js` notices it is embedded, asks the API for the token
  in the response body (`X-Auth-Mode: token`), keeps it in the iframe's own
  storage, and sends `Authorization: Bearer`. Players can sign in or sign up
  right in the 480×480 card, or tap "Use a wallet ↗". That opens `/account/` in
  a popup, which signs in first-party and passes the iframe a token through
  `postMessage`.
- **Guests always work.** Every play is recorded under an anonymous id
  (`anon:<uuid>`, in a one-year cookie, or in iframe storage when embedded).
  The first sign-up, login or wallet link moves those plays to the account,
  once. If `auth.js` or the API is missing, the game plays exactly as before and
  shows no sign-in chip.
- **Plays**: `POST /plays/start {game_id}` returns `play_id`, then
  `POST /plays/:id/end {outcome, score, meta}`. The server decides whose play it
  is. Plays left open longer than 24 hours are closed with no outcome. Lunch Rush
  reports seconds survived as `score`, which the server records as unverified
  (`scoreTrusted: false`).
- **Access levels** (`open`, `account`, `wallet`, `nft`) are set per game in
  `server/games.json` and enforced on `/plays/start`. `nft` reads `balanceOf`
  on the gate contract, with a 45 s cache.
- **Same-origin check** on every POST, plus rate limits on login, signup, SIWE
  and plays.

Endpoints: `/auth/{config,signup,login,logout,me,token,claim}`,
`/auth/siwe/{nonce,login,link,reset}`,
`/plays/{start,:id/end,mine,games,access/:gameId}`.

### Run it locally

Needs Node 22.13 or newer (it uses the built-in `node:sqlite`).

```
cd server
npm ci
DEV_STATIC_DIR=../games PUBLIC_ORIGIN=http://localhost:3100 SIWE_DOMAIN=localhost:3100 \
  COOKIE_DOMAIN= COOKIE_SECURE=false TRUST_PROXY= npm start
# open http://localhost:3100/lunch-rush/  and  http://localhost:3100/account/
```

Tests:

```
npm test             # 22 unit tests: sessions, login, SIWE (replay, domain, expiry, purpose),
                     # link/reset, access levels with a stubbed chain, plays, claims
npm run e2e          # boots the real server, signs up, records and fetches plays, SIWE
npm run browser      # real Chrome: Lunch Rush in a cross-site 480x480 iframe (needs
                     # CHROME_PATH, default /usr/bin/google-chrome)
npm run browser:coop-sweep   # real Chrome: Coop Sweep at 480x480 in an iframe, phone @3x touch,
                             # no-API and no-art fallbacks; checks runs land in the DB
npm run preview:coop-sweep   # re-render games/coop-sweep/previ.png from the game
```

### Settings and credentials

Everything is in `server/.env.example`, and none of it is secret. On the VPS it
lives at `/etc/inline-games-api.env`. Password and wallet login need **no
third-party credentials**. The only external values are for the NFT gate, which
nothing uses yet:

| Variable | Needed when | Where it comes from |
|---|---|---|
| `NFT_GATE_CHAIN_ID` | a game uses access `nft` | the chain you pick (Robinhood 4663 or Avalanche 43114, still open) |
| `NFT_GATE_RPC_URL` | same | a public RPC for that chain, or a provider URL (Alchemy, QuickNode, …). It may contain an API key |
| `NFT_GATE_CONTRACT` | same | the gate collection's address |

While these are blank, `nft` games answer `503 gate_unconfigured` and
`/auth/me` reports `nftStatus: "unconfigured"`.

### Going live (in this order)

1. Merge the `login` PR.
2. Actions → **Deploy accounts API (manual)** → Run. It runs the tests, then
   installs the `inline-games-api` service on 127.0.0.1:3100 and creates
   `/etc/inline-games-api.env` from `.env.example` if it's missing. It doesn't
   touch Caddy, so nothing public changes yet.
3. On the VPS, back up `/etc/caddy/Caddyfile`, copy in
   `deploy/Caddyfile.login.example`, then run `caddy validate` and
   `systemctl reload caddy`.
4. Actions → **Deploy games (manual)** → Run. This ships the updated Lunch Rush,
   `shared/auth.js` and `/account/`.
5. Check: `https://membersonly.cc/auth/config` returns JSON, the Lunch Rush card
   shows "Guest · Sign in", and a run shows up in `/plays/mine`.

To undo: put the Caddyfile backup back and reload. The games fall back to
guest-only on their own.

## Connecting to the VPS

Same server and same ssh setup as Aeterna. The workflows use these **repo
secrets** (names only; the values live in GitHub, never in the repo):

| Secret | What it is |
|---|---|
| `VPS_SSH_KEY` | private key the VPS accepts for `VPS_USER` |
| `VPS_HOST` | server hostname or IP |
| `VPS_USER` | ssh login user |

These are set on this repo. `VPS_SSH_KEY` is a dedicated deploy key for this
repo (not Aeterna's key), installed for `root` on the VPS on 2026-10-07.

Workflows (Actions tab → pick one → Run workflow):

- **Deploy games (manual)**: copies `games/` to `/opt/games/` (exact mirror,
  `--delete` only inside that folder). It never touches `/opt/web`,
  `/opt/aeterna-server`, the `aeterna-server` service, or the Caddyfile. No push
  trigger yet.
- **VPS check (read-only)**: dropdown of fixed checks (`list-games`,
  `caddy-status`, `caddy-logs`, `show-caddyfile`, `aeterna-server-status`,
  `disk-usage`, `memory-and-uptime`, `lunch-rush-headers`). There's no free-text
  command box, unlike Aeterna's `vps-run.yml`.

The ssh pattern (from Aeterna's deploy): open one connection, retry it if
sshd throttles it (the box gets constant ssh scanning, and `MaxStartups` can refuse
connections), then multiplex everything over it. By hand, from a machine that
has the key:

```
# ~/.ssh/config
Host vps
  HostName <VPS_HOST>
  User <VPS_USER>
  IdentityFile ~/.ssh/<your key>
  ControlMaster auto
  ControlPath ~/.ssh/cm-%C
  ControlPersist 10m

ssh vps 'ls -la /opt/games'
rsync -az --delete --chmod=D755,F644 games/ vps:/opt/games/
```

What's on the server today (since the 2026-10-07 cutover): Caddy on 80/443
serves `membersonly.cc` **statically from `/opt/games`** (no Node app involved).
`/lunch-rush` redirects (308) to `/lunch-rush/`, and `/` redirects (302) to
`/lunch-rush/`. The live `/etc/caddy/Caddyfile` matches `deploy/Caddyfile.example`.
Throbbin Abbey is **paused**: the `aeterna-server` unit is stopped and disabled,
but its code (`/opt/aeterna-server`), static files (`/opt/web`), database and
env files (`/etc/aeterna-server.env`, `/opt/aeterna-server/.env`) are untouched.

## Done (2026-10-07 cutover)

- [x] Secrets `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER` added to this repo.
- [x] Ran "Deploy games": `/opt/games/lunch-rush/` is filled (identical to the old
      `/opt/web/lunch-rush/` files).
- [x] Caddy switch: `membersonly.cc` now serves `/opt/games`. The old config is
      backed up at `/etc/caddy/Caddyfile.bak-abbey-20261008-081308` (server time, UTC).
- [x] Throbbin Abbey paused: `aeterna-server` stopped and disabled.
- [x] Aeterna's push-to-deploy (`deploy-server.yml`, "Deploy Aeterna Server")
      disabled in GitHub Actions, so a push to Aeterna `main` can no longer
      restart Abbey or overwrite the Caddyfile.

## Not done yet

- [ ] Later: add a `push` trigger to `deploy-games.yml`.
- [ ] Accounts, wallet login and play tracking: built on branch `login`, not deployed. See "Going live" above.
- [ ] Choose the NFT gate chain and collection, then set `NFT_GATE_*`.
- [ ] Not built yet: password change while signed in, leaderboards, reward payouts.
- [ ] Aeterna's *manual* workflows `launch.yml` ("LAUNCH") and `restart-game.yml`
      ("Restart the run") still restart `aeterna-server` if someone runs them by
      hand. Don't run them while Abbey is paused.

## How to restore Abbey

On the VPS, as root:

```
cp /etc/caddy/Caddyfile.bak-abbey-20261008-081308 /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
systemctl enable --now aeterna-server
```

Then turn Aeterna's auto-deploy back on:

```
gh workflow enable deploy-server.yml -R Sevrin420/Aeterna
```

The restored config proxies all of `membersonly.cc` to the Node app on :3000,
which serves `/lunch-rush/` from `/opt/web/lunch-rush/` again. Turning
`deploy-server.yml` back on means the next push to Aeterna `main` rewrites the
Caddyfile again, which would take `/opt/games` out of service.
