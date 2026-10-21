# MYTHOS AUTOTAG - every picture and clip read once, tagged and sighted (for every SIA and LIA)

Origin: ported 2026-10-05 from src/lib/autotag.js (the vision engine: vision-blob, frame sampling, montage, tag parse) + src/js/autotag.js (the vault pump: watch, queue, skip-tagged, on/off). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-autotag-standalone.js"></script>
<script>
  var tagger = MythosAutotag.client({
    media: vaultAdapter,
    describe: (parts) => root.generateText({ instruction: parts, startWith: "Tags:" }),
    store: kvStore
  });
  tagger.watch();
  media.onAdd((rec) => tagger.onRecord(rec));
</script>
```

No media passed, the host's `window.media` stands in; no describe passed, the host's `root.generateText` stands in; neither present, tagging refuses loud and nothing queues. No store passed, the on/off switch lives in memory for the page. `say(fn)` hears the one-line receipts.

## the contract

- `watch()` — subscribes to the vault's `onAdd` once (second call is a no-op `false`); `unwatch()` detaches. `onRecord(rec)` — the same door called by hand.
- Queue pump: pictures and clips queue on arrival and tag one at a time; audio never queues; records already carrying sight + tags are skipped, never re-read.
- `tagMedia(src, { kind, describe, fetchFn, onStatus })` — the engine itself: images shrink to a 768px PNG for one vision call; clips give up to 4 frames montaged side by side with a contact-sheet tail. Returns `{ tags[], caption }`.
- `tagImage / tagVideo / fileToVisionBlob / parseTagResponse` — exposed separately for hosts that paint their own flow.
- `set(on)` persists the switch; `isOn / pending / status` report; `tagNow(id)` reads one record by hand with loud refusals (no vault, no record, not a picture-or-clip).
- Receipts are house lines: `AUTOTAG :: <NAME> :: tag, tag :: "ONE-LINE SIGHT"`. Nothing throws.

## deliberately left out

- The vault itself (records, blobs, tag storage) — the `media` adapter owns `{ get, tag, setField, onAdd }`.
- The vision account — `describe` is one injected call; spend is the host's choice.
- Panel and progress paint — `onStatus` carries the two progress notes (`looking…`, `sampling…`).

## honesty note

A reader and filer, not a judge: tags name what is visible (subjects, setting, colors, mood, medium) and the caption says it plain in one sentence — taste stays with the household.
