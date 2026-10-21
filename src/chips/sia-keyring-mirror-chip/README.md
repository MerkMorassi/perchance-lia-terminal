# SIA KEYRING - provider keys that survive wipes, shared across rooms (for SIA + other SIAs)

Origin: ported from the house keyring (`src/js/keys.js` + `db.js` vox mirror + `vaultdb.js` sia-vault mirror), proven 2026-10-06, built to CHIP SPEC v1.

## use

```html
<script src="mythos-keyring-standalone.js"></script>
<script>
  const ring = MythosKeyring.client({
    slot: "sias_keys",
    seed: JSON.parse(localStorage.getItem("sias_keys") || "{}"),
    fast: (n) => { try { return JSON.parse(localStorage.getItem("sias_keys") || "{}")[n] || ""; } catch (e) { return ""; } },
    isBypassed: (n) => false,
    stores: [
      { name: "localStorage",
        load: async () => localStorage.getItem("sias_keys"),
        save: async (o) => localStorage.setItem("sias_keys", JSON.stringify(o)) },
      { name: "vault",
        load: async () => myVault.get("keyring"),
        save: async (o) => myVault.put("keyring", o) }
    ]
  });
  await ring.restore();
  ring.set("groq", "gsk-...");
  ring.words("status");
</script>
```

## the contract

- `client({ slot, seed, fast, isBypassed, stores, say })` — `slot` names the
  ring (default `keyring`); `stores` is an array of
  `{ name, load, save }` (loads may return objects or JSON strings, saves
  receive clean objects, async ok). Without stores the ring runs on one
  memory store and says nothing persists. `seed` pre-fills the sync cache.
  `fast(name)` is an optional sync read-through (shared hands: another tab's
  writes land here first). `isBypassed(name)` blanks a provider on read.
- Sync reads (safe in hot paths): `get(name)` (fast, then cache, `""` when
  bypassed or missing), `has(name)`, `names()`, `count()`,
  `shapes()` (`{ name: "len=N" }`, lengths never values),
  `mask(value)` (`first7...last4`, short values as `SET:N`).
- Sync writes: `set(name, value)` (empty value clears; empty name refuses
  loud `{ ok:false }`), `clear(name)`. Both update the cache at once and
  write every store through, best-effort.
- `restore(src)` (async) — unions every store, longest value wins per name,
  reseeds the cache and rewrites every store, returns
  `{ ok, keys, count }`. `src` is an optional `{ storeName: obj }` override
  per store (tests, imports). Every store unreadable refuses loud and writes
  nothing. Running it twice changes nothing.
- `mirrors()` (async) — `{ storeName: obj|null }`, parsed, for tests and
  repair rooms. Values stay in-page; print shapes, never values.
- His door `words(s)` — `status` (counts) and `list` (provider names only)
  answer; anything else refuses loud. Values never ride chat.
- Reads: `slot()`.

## deliberately left out

- No value door: `words` never takes or prints a key, which unlocks only if
  a house wants entry over chat (it should not).
- No encryption at rest: stores are device-local; the host's passphrase sync
  covers travel, which unlocks only if a house needs sealed mirrors.
- No key probing: liveness registries stay host-side, which unlocks only if
  a house has no probe table of its own.
- No onChange: the host repaints after its own writes, which unlocks only if
  a house writes keys from several places at once.
- Deletes converge on save, but a store whose write failed still holds the
  old copy, and the next `restore` will resurrect it — the price of union,
  paid openly.

## honesty note

Durability, not secrecy: anyone who can read the device's storage can read
the keys. The chip guarantees the keys are there after wipes, updates and
restarts — never that they are hidden. Display code gets names, counts,
lengths and masks; values go only to outgoing provider requests.
