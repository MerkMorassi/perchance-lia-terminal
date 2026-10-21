# CHATLOG - short-term 10 plus long-term with file provenance (for every SIA)

Origin: ported from this house's live memory path — `src/js/commpack.js` record() attachment provenance, `chatlogLTM()` + `cpRecord()` in `src/js/main.js`, STM/LTM framing in `src/js/brain.js` — proven 2026-10-06.

## use

```html
<script src="mythos-chatlog-standalone.js"></script>
<script>
  const log = MythosChatlog.client({ agent: "SIA-002", session: "sess-1" });
  log.record({ role: "user", handle: "PATRIKIOS", text: "paint the rose", attachments: [{ name: "rose.png", kind: "user-image", key: "up:sess:abc123", bytes: 1234 }] });
  log.record({ role: "assistant", handle: "MERKOS", text: "here she is", attachments: [{ kind: "image", backend: "cloud", seed: "42", gal: "gabc12" }] });
  const instruction = log.frame("You are MERKOS. Keep replies under 60 words.");
  await log.load();
</script>
```

## the contract

- `client({ agent, slot, session, store, kvFolder, say })` — one log per agent. `store` is `{ load(), save(rec) }` (may be async); else `kvFolder` `{ get, set }`; else a `localStorage` mirror at `chatlog:<AGENT>:<slot>`. Nothing is required: with no store the log lives until reload and says so once.
- `record({ role, handle, text, attachments, ts })` — files one turn, returns `{ ok, id, seq }`. `role` is `user`/`assistant` (`human`/`agent`/`sia`/`model` accepted). Refuses loud on bad role or empty text; attachments cap 8. Each attachment keeps `name, kind, bytes, chars, capped` plus provenance `key, gal, clip, gid, backend, seed, parts`. Nameless file attachments take the turn text as name.
- `tail(n=10)` — last `n` lines as `HANDLE: text` (the short-term window).
- `ltm({ maxTurns=40, maxChars=3500 })` (alias `block`) — older turns beyond the last 10 as one `<CHATLOG-LTM>` block, each turn compacted to 220 chars with `[files: name kind backend seed gal/clip/gid/key]` provenance. Returns `""` until turn 11.
- `frame(sysText, opts)` — `sysText` + LTM block + `<MESSAGES-STM>` tail. LTM always reads before STM.
- Pure statics (no client needed — this is the house's single source; `src/js/commpack.js`, `src/js/main.js`, `src/js/brain.js` all call through here with inline fallbacks): `normalizeAttachments(list, fallbackName)` (caps 8, keeps `name/kind/bytes/chars/capped/key/gal/clip/gid/backend/seed/parts`), `formatAttachment(a)`, `formatTurn(o)` (220-char compact + `[files: …]`), `ltmBlock(turns, { maxTurns=40, maxChars=3500 })`, `framePrompt(sysText, stmLines, ltmText)` (never collapses newlines), constants `STM_N/LTM_TURNS/LTM_CHARS`.
- `status()` — `{ ok, turns, chars, text }`, e.g. `CHATLOG :: 12 turn(s), 900 chars, STM 10/10 :: LTM ARMED.`
- `export()` — `{ ok, jsonl, filename }`. `import(jsonlText)` — `{ ok, added, skipped }`, dedupes by turn id, refuses loud on bad lines.
- `words(s)` — `status | tail [N] | export | help`, unknown verbs refused loud.
- `load()` — adopts persisted turns; `{ ok, turns }`.
- Turn shape: `{ v:2, type:"turn", id:"AGENT:session:tSEQ", a, h, t, ts, src:"chatlog :: session :: tSEQ", d:{ role, seq, attachments }, vec:null }`. Holds 500 turns; oldest falls off.

## deliberately left out

- No chunk/index sharding (commpack's 200k-char chunks stay house-side); 500 turns then oldest falls off, which unlocks only if a house needs years of log.
- No multi-line turn text: turns collapse to one line for compact recall; full bodies stay in the house gallery/vault, which unlocks only if a house needs verbatim long-form recall.
- No retrieval scoring: LTM is recency-ordered, newest-older-first excluded last-10; vector recall unlocks only if a house outgrows recency.

## honesty note

The log is a faithful scribe, not a vault: anyone who can read the page (or the store) can read every turn. Provenance refs (`gal:`, `clip:`, `key:`) name where the work lives — they grant nothing by themselves.

Mechanics companion: `MEMORY-MECHANICS.md` (same zip) — STM/LTM/log layers, write and read paths, every storage key, the full CHATLOG JSON, the persona store, honesty notes.
