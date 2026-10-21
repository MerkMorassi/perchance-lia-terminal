# SIA CUTOUT - background noise out, subject kept, new scenes in (for every SIA and LIA)

Origin: cut 2026-10-06 around the @imgly/background-removal engine (pinned,
browser-local ONNX, no key, no upload), proven live on a 421x421 portrait:
18s first cut (model download, cached after), hair edges intact, zero
subject spill. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-cutout-standalone.js"></script>
<script>
  var cutter = MythosCutout.client();
  var r = await cutter.cut(photoBlob);
  if (r.ok) {
    var scene = await cutter.composite(r.blob, "#0a0f0a");   // color, or a bg Blob (cover-fit)
    showImg(scene.blob);
  }
</script>
```

The page pays nothing until the first `cut()` — the engine is imported
lazily, and the model (~40MB) downloads once, then the browser caches it.
`loader` overrides the import (tests, vendored engines, offline mirrors).

## the contract

- `cut(blob)` — a promise of
  `{ ok, blob, width, height, ms }`. The blob is PNG with real alpha: subject
  opaque, background noise gone. The engine reports no progress (pinned
  1.5.5 stays silent), so `say` calls out CUTTING and FREED instead — the
  host paints an indeterminate bar between them.
- `composite(fgBlob, bg, { x, y, scale, width, height })` — the subject onto a
  new scene: `bg` is a color string or a background Blob (cover-fit to the
  frame). Subject centers at full size unless placed. Answers
  `{ ok, blob, width, height }`, PNG.
- `info(blob)` — `{ ok, width, height, bytes, type }`, no inference, for
  doors that size a frame before cutting.
- Nothing throws; refusals resolve `{ ok:false, why }` sentences (no picture,
  undecodable picture, engine did not load, empty cut).

## deliberately left out

- Any panel or stage — the host paints progress, before/after, and download
  from the answers above.
- Feather/edge refine and model choice — the engine's defaults proved clean
  on hair; unlocks when a portrait demands it.
- Batch queues — one cut at a time per client; make more clients for more lanes.

## honesty note

First cut needs the connection (the model download); after that it cuts
offline. Segmentation judges, it does not know: a busy background that looks
like the subject can survive the cut, and tiny subjects in wide scenes cut
rough. Look at the alpha before you trust it with anything that matters.
