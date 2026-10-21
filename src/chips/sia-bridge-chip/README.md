# MYTHOS BRIDGE - standalone client chip (for SIA / any other agent)

Talk to the Mythos chatlog store from ANY page. No dependencies, no LIA terminal code.
Proven live 2026-10-03 (pushed 181 LIA turns through this same protocol).

## server

`node mythos-chatlog-server.mjs [port]` (default 8098), publicly exposed, e.g.
`https://desktop-87ashvo.tail27f4f2.ts.net` via `tailscale funnel 8098`.
`MYTHOS_BRIDGE_KEY=<secret>` locks it (client sends `Authorization: Bearer <secret>`).

## use

```html
<script src="mythos-bridge-standalone.js"></script>
<script>
  var bridge = MythosBridge.client({
    baseUrl: "https://desktop-87ashvo.tail27f4f2.ts.net",
    agent: "SIA",
    apiKey: null,              // set if the server was started with MYTHOS_BRIDGE_KEY
    fetchImpl: fetch,          // optional: pass a proxy fetch if direct fails,
                               // e.g. root.superFetch.bind(root) on Perchance
  });
  var info = await bridge.count();          // { ok, agent, total, newest }
  await bridge.push(localTurnsArray);       // sends turns the store is missing (dedupes by stamp)
  var fresh = await bridge.pull(newestTs);  // turns newer than ts (array, merge them yourself)
</script>
```

## protocol

- `GET /chatlog/count?agent=X` -> `{ ok, agent, total, newest }`
- `POST /chatlog/append` `{ agent, turns }` -> `{ ok, added, total, newest }`
- `GET /chatlog/since?agent=X&ts=N` -> `{ ok, turns, total }`

## turn shape

`{ ts, st, role, text }` - `ts` (ms) is the identity. Store dedupes by stamp, append-only.
One file per agent on the server (`<agent>.jsonl`), like compack.
