# MYTHOS-MINUTES - ARCHIVAX session minutes on a 4-hour beat (for SIA/MERKOS)

Origin: built fresh for the SIA room to CHIP SPEC v1, proven live 2026-10-07 (15/15 minutes.test.js, auditor 26/26 whole).

## use

```js
const minutes = MythosMinutes.client({
  store: { load: () => libGet("minutes_log"), save: (v) => libPut("minutes_log", v) },
  hitl: "PATRIKIOS", agent: "SIA-002", session: () => sessId,
  say: (t) => announceUpdate(t)
});
await minutes.load();
await minutes.tick(collectMinutesFacts);
```

House: `tickMinutes()` runs on the 15s house timer (files only when due) plus once
12s after boot. `minutes` door: status | last | now.

## the contract

- `load()` -> `{ok, count}`. Reads `{v, minutes}` from store/kv, keeps records
  with numeric `ts` and text.
- `due(nowMs)` -> `{due, nextIn}`. True when `now - last.ts >= intervalMs`
  (default 4h). Empty book is due now.
- `file(facts)` -> `{ok, minutes} | {ok:false, error}`. Facts need numeric
  `ts` + `windowSince`; same `windowSince` twice is refused, never filed twice.
  Says one headline line.
- `tick(collect)` -> due-gated `collect({since, now})` then `file`. No collector,
  collector throw, or not-due all refuse loud with nothing filed.
- `force(collect)` -> same without the due gate (the `minutes now` door).
- `last()`, `list(n)`, `status(nowMs)` (`MINUTES :: n FILED :: LAST <utc> ::
  DUE NOW|NEXT IN <dur>.`), `clear()`, `slot()`, `gap()`, `ready()`.

Facts shape (house collects, chip only formats):
`{ts, windowSince, turns, users, assistants, sys, images, audio, gallery, stage,
wishesPending, wishesTotal, events:[{ts, name, note}]}`.

Minutes text: `ARCHIVAX MINUTES :: <utc> :: SESSION <id> :: HITL <id> ::
AGENT <id>`, WINDOW, TURNS (USER/SIA/SYSTEM) + MEDIA + GALLERY + STAGE,
WISHES, last 12 events verbatim with stamps, TAGS (`#bridge #lore #mood #wish
#image #audio #gate #backup #update #audit #minutes #chat`, plus `#quiet`).
Counts and quoted lines only. No assessment words anywhere.

## deliberately left out

- No LLM summarising: key points are the journal's own recent lines, verbatim.
  An LLM pass would add quota, latency, and judgement. If richer minutes are
  ever wanted, pass pre-written `events` — the format holds them unchanged.
- No chat door for history beyond `last`: full back issues live in the
  `minutes_log` vault slot; add a pager only if he asks.
- No cross-device merge: minutes are per-browser like the rest of the vault;
  the bridge moves turns, not minutes.

## honesty note

The chip is a scribe, not a judge: it counts and quotes, never rates. Tags
are keyword matches, not understanding. Anyone reading the vault can read the
minutes — they hold counts and journal lines, never keys.
