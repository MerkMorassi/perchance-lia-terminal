# MYTHOS-JOURNAL - a private log: raw lines, tags, minutes on a 6-hour beat (for every SIA)

Origin: cut here from the house's own `/journal` lane (`src/js/journal.js` calls
through this file — it is the single source, not a copy), proven live 2026-10-07.

## use

```html
<script src="mythos-journal-standalone.js"></script>
<script>
  const journal = MythosJournal.client({ agent: "SIA-002", kvFolder: kv.lia_journal });
  await journal.load();
  await journal.words("the frame finally plays clips #frame #win");
  await journal.tick(); // files minutes when the beat is due, else refuses quiet
  const brief = (await journal.load(), journal.briefing(5)); // the session-start pull
  console.log(brief.text);
</script>
```

House: `tick()` runs on the 60s house timer (files only when due and the tab is
visible) plus once 12s after boot. `/journal` door: bare text files, verbs below.

## the contract

- `client({ slot, cap, minutesCap, intervalMs, store, kvFolder, say, clock, stamp })`
  — one log per agent. `store` is `{ load(), save(snap) }` (may be async); else
  `kvFolder` `{ get, set }` under `slot` (default `"journal"`); else an in-memory
  mirror that lives until reload. `clock` defaults to `Date.now` (inject a fake in
  tests to prove the beat). `stamp` formats line stamps (default UTC). `say` hears
  receipts and minutes. Nothing is required: with no store the log lives until
  reload and says nothing about it.
- `file(text)` — files one raw line, `#tags` riding inside (lowercased, deduped,
  capped 8). Refuses loud on empty. Returns `{ ok, entry }`.
- `show(n=10)`, `tag(t, n=20)`, `tags()` — read-back; each returns `{ ok, text }`
  (plus `total` / `tags`), lines as `[STAMP] #tags text`.
- `fileMinutes(reason)` — counts, tags, and the window's lines quoted verbatim,
  like meeting minutes. Empty window advances the beat in silence (`{ ok, empty }`).
- `tick()` — due-gated `fileMinutes`. Not-due refuses quiet (`{ ok: false }`,
  nothing said). `force()` files without the gate (the `minutes now` door).
- `status()` — `{ ok, text }`, e.g. `JOURNAL :: 12 LINES :: 3 TAGS ::
  MINUTES 2 FILED :: LAST <utc> :: NEXT IN 5H 41M.`
- `last()`, `list(n)`, `exportLog()` (`{ ok, json, filename }`),
  `importLog(text)` (`{ ok, added, skipped }`, dedupes by line id),
  `clear()`, `slot()`, `gap()`, `ready()`.
- `briefing(n=5, maxChars=3000)` — the agent's handoff: status, tags, the last
  `n` lines verbatim, and the last minutes, cut to `maxChars` with a pointer to
  the rest. The editor's agent cannot read the store directly, so it pulls this
  through the live page at session start; the house also prints it to the console
  once per boot when the journal is non-empty (silent in chat).
- `words(rest)` — the `/journal` door as a CODE helper: bare text files; verbs
  `status | show [N] | tag <T> [N] | tags | minutes [now | last | N] | brief [N] |
  export | wipe yes | help`. Returns `{ ok, text }` for printable verbs, `{ ok, said }`
  where the method already spoke, `{ ok, action: "download", filename, json }`
  for export (the host performs the download). Unknown verbs are lines, not
  errors — everything files.
- Pure statics (no client needed): `tagsOf(text)`, `tagCounts(list)`,
  `composeMinutes(now, since, win, stampFn)`.
- Snapshot shape: `{ v: 1, entries, minutes, last }`. Holds 2000 lines, 200
  minutes; oldest falls off.

## deliberately left out

- No LLM summarising: minutes quote lines verbatim. An LLM pass would add quota,
  latency, and judgement. If richer minutes are ever wanted, quote first, then
  append a separately-marked passage — the format holds it unchanged.
- No collector/facts pipeline (the minutes chip's shape stays over there): the
  journal's facts ARE its lines, so the beat reads nothing but its own store.
- No cross-device merge: the journal is per-browser like the rest of the vault;
  the bridge moves turns, not journals.

## honesty note

The journal is a scribe, not a vault: anyone who can read the page (or the store)
can read every line. It never sends anything anywhere itself — but `say` and the
host's export door decide where words go, so a host that voices receipts aloud is
reading the journal aloud. Minutes hold counts and quoted lines, never keys.
