# MYTHOS CAPTURE - every session a structured, actionable transcript (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/capture.js (capture mode: start/stop/keep/drop/export/status). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-capture-standalone.js"></script>
<script>
  var cap = MythosCapture.client({
    store: memStore(),            // async { get(k), set(k, v) } - the lane's memory
    logStore: archiveStore(),     // async { get("master_log") } - the turn archive
    generateText: (opts) => ai(opts.instruction),
    ingest: (name, text, meta) => loreFile(name, text, meta)
  });
  print((await cap.start("VOICE FACTORY")).topic);
  print(await cap.status());
  const done = await cap.stop();  // formats the draft
  if (done.draft) await cap.keep();
</script>
```

No options passed, the host's own kv, archive, text engine and lore stand in where present; anything missing fails LOUD, never silent.

## the contract

- `start(topic)` — opens a capture; a second start is refused WITH the running topic. Returns `{ ok, topic, at }`.
- `block()` — the instruction line for the speaker while capture is on ("" when off).
- `stop()` — ends it, formats the turns into the house record via the text engine. No turns: ends cleanly, nothing made. No engine: the raw turns are HELD and said so.
- `keep()` — files the reviewed draft via `ingest(name, text, { pack: "LOREPACK", origin: "local" })`, wrapped when a `wrap` is offered. Nothing waiting: refused.
- `drop()` — lets the waiting draft go; the turns stay in the archive.
- `exportFile()` — downloads the draft as markdown (host download or `opts.download`).
- `status()` / `help()` / `turns()` / `isActive()` / `busy()` — state in sentences.
- Command lines (leading `/`) and silent entries are never captured; nothing is filed until kept.

## deliberately left out

- The `/capturemode` verbs and the progress bar — host wiring; the chip is the engine they call.
- The archive and the lorepack themselves — `logStore` and `ingest` seams.
- Review UI — the draft waits in the store until kept or dropped.

## honesty note

The formatted draft is only as honest as the engine that wrote it: the instruction forbids invention, but a fluent lie still reads fluently — the KEEP step is a review, not a rubber stamp.
