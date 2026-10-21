# MYTHOS-CHATENGINE - a complete portable chat engine (for ANY host)

Origin: cut fresh from the SIA house engine — `src/js/commpack.js` (record),
`src/js/store.js` (STM), `src/js/main.js` (`chatlogLTM` + `framePrompt`
fallback), `src/js/stage-turns.js` (turn shape),
`src/mythos-chattail-standalone.js` (`missing` screen-match) — proven live in
this preview 2026-10-08 (CHIP SPEC v1).

## use

```html
<script src="mythos-chatengine-standalone.js"></script>
<script>
  var engine = MythosChatengine.client({ slot: "chatengine", agentID: "SIA-002", agentName: "MERKOS" });
  engine.remember("user", "PATRIKIOS", "paint the rose");
  engine.remember("assistant", "MERKOS", "the rose is painted.");
  var prompt = engine.framePrompt("You are MERKOS.", engine.stm(10), engine.ltmBlock());
  // send prompt to any brain; on reply: engine.remember("assistant", "MERKOS", reply);
  var gap = engine.missing(shownTexts); // turns the screen lacks — paint these
  var file = engine.export(); // { jsonl, filename, turns } — download it
  engine.import(text); // { added, skipped } — appends, dedupes by id
</script>
```

## the contract

`MythosChatengine.client(opts)` — `opts`: `slot` (storage key, default
`"chatengine"`), `agentID` (default `"AGENT-001"`), `agentName`, `session`,
`cap` (log cap, 10–10000, default 4000), `say` (announce fn). No DOM at import;
localStorage with a memory fallback. One slot per agent where shared.

- `remember(role, handle, text, extra)` — files one turn. `role`: user/human,
  assistant/agent/sia/model, system, tool — anything else refuses loud. `extra`:
  `{ ts, attachments }`. Empty text and `thinking…` lines file nothing (loud
  `why`). Returns `{ ok, id, seq }`. Id format `<AGENT>:<session>:t<seq>`.
- `tail(n)` — last n turns, oldest-first.
- `stm(n=10)` — last n as `"HANDLE: text"` lines. Feed straight to the brain.
- `ltmBlock({ maxTurns: 40, maxChars: 3500 })` — everything except the last 10,
  newest-first-capped, each turn compacted to 220 chars with `[files: …]`
  provenance. Empty until turn 11. Reads older-first.
- `framePrompt(head, stmLines, ltm)` — system head, then the LTM block, then
  the `<MESSAGES-STM>` tail. LTM always reads first.
- `missing(shownTexts)` — the gap between the log and the screen (exact match
  first, 512-char prefix second; accepts raw or `HANDLE: text` screen form).
  Paint exactly this after a reload.
- `export()` — `{ jsonl, filename, turns }`: header line + one object per line,
  LF, UTF-8, append-only.
- `import(text)` — seam-appends in arrival order, dedupes by turn id, returns
  `{ added, skipped }`. Refuses loud: empty file, truncated tail, bad line,
  missing header, agent mismatch.
- `ordered()` — ts-sorted view (the log itself stays arrival-ordered).
- `status()` — `{ agentID, agentName, session, turns, chars, seq, slot }`.
- `count()`, `slot()`, `clear()` (announces through `say`, returns `{ ok }`).
- `MythosChatengine.normalizeAttachments(list, fallback)` — one attachment
  shape (`name, kind, bytes/chars, key, gal, clip, gid, backend, seed, parts`,
  max 8 per turn).

Turn shape: `{ v: 2, type: "turn", id, a, h, t, ts, src, d: { role, seq,
attachments? }, vec: null }`. Roles user/assistant collapse to one line (2000
chars); system/tool store verbatim (4000 chars).

## deliberately left out

- No network, no bridge, no server mirror — the host moves `export()` bytes
  itself. That unlocks multi-device sync.
- No DOM paint, no scrollback virtualization, no voice — the host paints what
  `missing()` answers and speaks what it likes. That unlocks every frontend.
- No per-turn embeddings (`vec` stays null) and no summarizer — the log is a
  faithful scribe, never an interpreter. That unlocks factory ingest later.
- No encryption at rest — anyone reading the browser profile reads every turn.
  That unlocks only by the host adding it.

## honesty note

The log is append-only memory, not authority: it remembers what was said, not
what is true. `clear()` destroys the only copy if no export was taken. It does
not judge, rate-limit, or authenticate — the host owns all of that.
