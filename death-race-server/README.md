# Death Race server

Authoritative real-time server for `games/death-race` (Node 22, zero dependencies, hand-rolled WebSocket).
One persistent world loops forever: 3 s countdown → 120 s race → 15 s pit-stop shop.

* Listens on `127.0.0.1:3110`; Caddy proxies `/death-race/ws` and `/death-race/status` to it.
* systemd unit `death-race` (see `death-race.service`), code in `/opt/death-race-server`.
* Deploy: `./death-race-server/deploy.sh root@HOST` (needs SSH key access).
* Local dev: `STATIC=$PWD/games PORT=3111 node death-race-server/server.js` then open http://127.0.0.1:3111/death-race/

Caddy snippet (inside the `membersonly.cc` block, before the catch-all `handle`):

```
@deathrace path /death-race/ws /death-race/status
handle @deathrace {
	reverse_proxy 127.0.0.1:3110
}
```
