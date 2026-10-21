# MYTHOS HEART - what he marks, kept as a record of taste (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/likes.js (mark/cycle, counts, block, report). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-heart-standalone.js"></script>
<script>
  var heart = MythosHeart.client({
    vault: mediaVault(),   // { ensure?, list(), get(id), setField(id, k, v), folderOf(rec)? }
    print: (t) => say(t),  // optional: receipts ride out here
    onMark: (id, v) => repaint(id, v) // optional: the host repaints its own button
  });
  await heart.cycle("m1"); // good -> pass -> cleared -> good ...
  print(heart.block());    // what she is told every turn
</script>
```

No vault passed, marks refuse LOUD and the block is honestly empty. Nothing is silent.

## the contract

- `cycle(id)` — one control, three states: untouched, GOOD, passed-on, cleared. The only way a tap can say "not good".
- `mark(id, "good"|"pass"|"")` — one field on the record (`{ v, at, by }`), beside the tags and the folder. Same id + same value is held, not rewritten. Unknown ids refused.
- `state(id)` / `counts()` / `ids("good"|"pass", limit)` — the mark, the tally, the newest-first lists.
- `block()` — what she is told: only marks actually made, bounded per turn, never recited back to him. Empty when nothing is marked.
- `report()` / `describe()` / `nameOf()` / `glyphOf(id)` / `hintOf(id)` — the printable record, the one line, the display name, the button's face and its tooltip in pure form.
- Seams: `vault`, `print`, `onMark`, `field`, `listMax`.

## deliberately left out

- The DOM button and its paint — host painting; the chip gives `glyphOf`/`hintOf` and the `onMark` door.
- The `/heart` verbs — host wiring; the chip is the mark they call.

## honesty note

That is the whole of the training: no model is fitted, nothing is uploaded, and only marks actually made are ever shown to her.
