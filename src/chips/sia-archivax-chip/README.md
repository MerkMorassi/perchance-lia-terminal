# MYTHOS ARCHIVAX - the agent of the record: read, classify, tag, file, sweep (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/archivax.js (ops engine: vision reading, clip sequences, glass guards, journal). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-archivax-standalone.js"></script>
<script>
  var ax = MythosArchivax.client({
    vault: mediaVault(),          // { list(), get(id), setField(id,k,v), tag(id,t), untag(id,t), fileMany(ids,path,f), normTag?, normFolder?, allTags?, allFolders? }
    generateText: (o) => ai(o),   // vision: instruction [prompt, blob] -> "description\nTAGS: a, b"
    resolve: (spec, f) => targets(spec, f), // optional: names R12/#tag/words -> { ids, label }
    sampleFrames: (blob, f) => sampler(blob, f), // optional: clips read as still sequences
    lookBlob: (blob, prompt) => seer(blob, prompt) // optional: single-frame vision road
  });
  print((await ax.run("sweep")).text);
  print((await ax.run("classify R12", { by: "lia" })).text);
</script>
```

No vault passed, every op that needs one refuses LOUD; no vision passed, reads say the model is unreachable. Nothing is silent.

## the contract

- `run(line, { by })` — one op, one line: `status ops read classify tag untag file sweep`. `by` is `patrikios` or `lia` and decides the glass. Unknown ops and empty lines refused WITH the op list. Every ok op is journaled.
- `read` — vision over pictures (clips as still sequences), written onto each record as its sight. Reading is not a change: open to either side.
- `classify` — read AND file the content tags she named. `tag` / `untag` file or lift named tags. `file <PATH> :: <what>` moves records into a folder.
- `sweep [N]` — the standing job: the newest N unread, one reading each, then the count still waiting.
- THE GLASS: `lia` may only WRITE on what the terminal made (`gen`/`upscale`); handed-over files get their reading but keep none of her tags. Nothing is ever deleted; every op lands in the journal.
- Seams: `vault`, `generateText`, `resolve`, `sampleFrames`, `lookBlob`, `isLookable`, `journalStore`, `manifest`, `stamp`, `labelOf`, `opMax`, `sightMax`, `clipFrames`, `sightPrompt`, `clipFramePrompt`.
- `look(id)` writes nothing; `fileReading(id, found, by)` is the write. `parseReading` / `parseTags` / `parseBucket` / `pending()` / `journal()` / `describe()` / `blockText()` report.

## deliberately left out

- The media vault, the reader's targets, the render book — `vault` and `resolve` seams.
- The frame sampler and the blob vision road — `sampleFrames` and `lookBlob` seams.
- The `/archivax` verbs and the reply-line carrier — host wiring; the chip is the agent they call.

## honesty note

Her reading is one vision pass, and a fluent description is not a true one — the sight is filed as found, not as fact, and the journal exists so every filing can be re-read later.
