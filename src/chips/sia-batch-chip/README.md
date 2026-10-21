# MYTHOS BATCH - tick, send, watch them come back bigger (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/batch.js (queue, hand-over, bar, tray, report). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-batch-standalone.js"></script>
<script>
  var batch = MythosBatch.client({
    max: 6,                // one send carries this many; the rest stay ticked
    media: vault(),        // { get(id), url(id)? }
    upscale: upscaler(),   // { open(id, {batch, of, onResult, onClose}), state()? }
    print: function (t) { stage.print("SYSTEM", t); },
    openLightbox: function (id) { stage.open(id); }
  });
  gridEl.appendChild(batch.decorate(gridEl)); // one bar per grid
</script>
```

No media, missing pictures are skipped LOUD. No upscale road, sends hold. Nothing is silent.

## the contract

- `start(items)` — at most `max` go; the rest stay ticked for the bar to send after. A live hand-over refuses a second — let it finish or stop it.
- `step()` — the head of the queue goes across; a picture gone from the vault is skipped with its reason. An empty window leaves its picture at the head, so SEND becomes RETRY; `stop()` abandons the rest and touches nothing filed.
- `onResult` files to the tray as pictures land; `onClose(count)` advances the queue and says BATCH COMPLETE with the count.
- `makeBar(grid)` / `decorate(grid)` — one bar per grid, reading ticks off the DOM at click time, never inventing a picture (videos and id-less tiles don't count).
- `state()` / `report()` / `help()` / `ticked(grid)` / `max()` / `on()` report.
