# MYTHOS CHRONICLE - the record of the making, one entry per session (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/chronicle.js (manifest reader, find-by-any-name, render, run router). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-chronicle-standalone.js"></script>
<script>
  var chron = MythosChronicle.client({ dir: "src/chronicle/" });
  print((await chron.run("")).text);       // the index, newest first
  print((await chron.run("newest")).text); // the last session written up
</script>
```

No options passed, it reads `src/chronicle/chronicle.json` by fetch. `fetchFn` overrides transport (superFetch, tests); `markdown`/`rtfm` overrides the renderer, else raw markdown stands. It writes nothing — entries are files, added by the agent that lived the session.

## the contract

- `run(arg)` — `""|list` index · `about` recipe · `reload` re-read · `newest` latest entry · anything else an entry lookup. Returns `{ title, text }`, never throws.
- `find(name)` — one entry by id, file name, date, title, exact number (`1` = newest), or loose substring (ids beat title-words).
- `doc(entry, { bare })` — header (title, date, file, tags) plus the document whole.
- `entries/rows/newest/count/status/describe/listText/about/load/reload` — the shelf, newest-first rows, counters, the long lane description.
- Manifest shapes accepted: array, or `{ entries: [] }`; bare strings count as file names. Unreadable manifest refuses loud with the reason, never silent.

## deliberately left out

- Writing entries — there is no `add`; the record belongs to the agent that lived it.
- Indexing and recall — nothing here is hers: the lorepack is memory, the RTFM is the manual, this is the making.
- Private notes — the folder ships public, so raw logs and secrets stay in kv or on his machine.

## honesty note

A shelf and a reader, not a memory: it keeps the reasoning that dies with a closed chat (what was asked, what was built, what was thought, what broke, what is open) where a later session can find it.
