# THE SERVER CORNER - things that run on Patrikios' own machine, not in the page.

- `pair-relay.mjs` — THE LOCAL RELAY for the pair road (`src/js/pair.js`). Node 18+, zero
  dependencies. Run `node pair-relay.mjs [port]` (default 8099, listens on 0.0.0.0). Each device:
  `/pair relay ws://<desktop-lan-ip>:8099`. Check `http://<ip>:8099/` from any browser (even the
  iPad's) for a status line. It relays sealed frames between two devices in a room named by the
  SHA-256 of their pair code, keeps nothing on disk, and must stay on the LAN - never exposed to
  the internet. Protocol and limits are documented in the file header; the client half is
  `attachLocalRpc` in `src/js/pair.js`, exercised in-page against a fake hub (see the session that
  built it - full transfer verified: gzip, sealed frames, digest match).
- `mythos-chatlog-server.mjs` — THE CHATLOG STORE, the far end of the BRIDGE road
  (`src/js/bridge.js`, `/bridge`). Node 18+, zero dependencies. Run
  `node mythos-chatlog-server.mjs [port]` (default 8098); `MYTHOS_BRIDGE_KEY=<secret>` locks it
  (`/bridge key <secret>` matches it). Chatlog turns land as append-only JSONL, one file per
  agent (`chatlogs/<agent>.jsonl`), deduped by stamp - push twice, nothing changes. Turns here
  are PLAINTEXT (unlike the pair road's sealed frames), so it stays on the LAN either way.
  Terminal side: `/bridge base http://<server-lan-ip>:8098`, then `/bridge push` / `/bridge pull`.
