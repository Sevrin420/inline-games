# inline-games

Small browser games that play **inline on X** as player cards: the post shows a
480×480 iframe and people play right in the timeline. The first game is
**Lunch Rush**, live today at <https://membersonly.cc/lunch-rush/>.

Split out of [Sevrin420/Aeterna](https://github.com/Sevrin420/Aeterna), which
also holds the separate Throbbin Abbey game. Nothing here depends on Abbey code.

## Layout

```
games/
  lunch-rush/
    index.html      the whole game, one self-contained file (no external requests)
    previ.png       1200×630 card image X shows before the player loads
docs/
  Games_and_Login.md    how inline X cards work, login + anonymous play plan
  Auth_and_Accounts.md  full account / wallet (SIWE) / NFT-gating design
deploy/
  Caddyfile.example     how Caddy would serve /opt/games (not applied automatically)
.github/workflows/
  deploy-games.yml      MANUAL: rsync games/ -> /opt/games on the VPS
  vps-check.yml         MANUAL: pick a fixed read-only check to run on the VPS
```

The docs were copied unchanged from Aeterna, so where they say `web/<game>/`
read `games/<game>/` in this repo.

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
- Self-contained: no external scripts, fonts or API calls.
- The server must not send `X-Frame-Options` or a narrow CSP `frame-ancestors`.
- X caches cards. To force a new image, rename the image file.
- A post with attached media doesn't show the player card, so post the link as
  a reply or post the card on its own.
- Check a card with X's card validator or by posting from a test account.

New game: copy `games/lunch-rush/` to `games/<name>/`, change the title,
description, URLs and image, and keep it to one file.

## Connecting to the VPS

Same server and same ssh setup as Aeterna. The workflows use these **repo
secrets** (names only; the values live in GitHub, never in the repo):

| Secret | What it is |
|---|---|
| `VPS_SSH_KEY` | private key the VPS accepts for `VPS_USER` |
| `VPS_HOST` | server hostname or IP |
| `VPS_USER` | ssh login user |

**These must be added to this repo** (Settings → Secrets and variables →
Actions). Secrets aren't copied between repos, and GitHub can't show existing
values, so they have to be re-entered from wherever the originals are kept.

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

What's on the server today (from Aeterna): Caddy on 80/443 for
`membersonly.cc`, proxying to the Abbey Node app (`aeterna-server` systemd unit,
code in `/opt/aeterna-server`, static files in `/opt/web`). Lunch Rush is
currently served from `/opt/web/lunch-rush/` by that app.

## Not done yet

- [ ] **Add the secrets** `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER` to this repo.
- [ ] **Run "Deploy games"** once to fill `/opt/games` (doesn't affect the live site).
- [ ] **Caddy switch**: point `membersonly.cc` at `/opt/games` using
      `deploy/Caddyfile.example`, and stop Aeterna's deploy from rewriting
      `/etc/caddy/Caddyfile` (today it does that on every push to Aeterna `main`).
- [ ] **Pause Throbbin Abbey**: stop/disable `aeterna-server` and turn off
      Aeterna's push-to-deploy, *after* the Caddy switch so `/lunch-rush/` stays up.
- [ ] Later: add a `push` trigger to `deploy-games.yml` once the above is settled.
- [ ] Accounts, wallet login and play tracking (in `docs/`) are specified, not built.
