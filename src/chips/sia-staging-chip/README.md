# SIA STAGING - drag-and-drop scene builder for cinematic stills (for every SIA and LIA)

Origin: cut 2026-10-06 at his word — "STAGING and BLOCKING OPS" for the media
creation and animation pipeline. Drop clean subjects and environments into a
stage, drag her where she stands, wheel her bigger or smaller, save the still.
Built to CHIP SPEC v1.

## use

```html
<script src="mythos-staging-standalone.js"></script>
<!-- staging-snippet.html: mount + skin -->
<script>
  var st = MythosStaging.client({ el: document.getElementById("stagingMount") });
  await st.setBackground(envBlob);
  await st.cutAddSubject(siaBlob);   // needs the cutout chip; else addSubject(cutBlob)
  st.block(id, "seat-center");
  var still = await st.render();
</script>
```

No `el`, no UI — the same doors work headless for pipeline code. Drop files
straight on the stage: first drop sets the scene, the rest arrive as subjects.

## the contract

- `setBackground(blob)` — the environment; the frame takes its native size.
- `addSubject(blob, { x, y, scale, name })` — x/y normalized (y=1 is boots on
  the floor), scale relative to native pixels. `cutAddSubject` cuts through
  the cutout chip first, and refuses loud when it is not worn.
- `place(id, { x, y, scale })` — exact blocking. `block(id, mark)` — named
  marks: left | center | right | seat-left | seat-center | seat-right.
  `marks()` lists them. `nudge(id, dxPx, dyPx)` steps by pixels.
- `front(id)` / `back(id)` restack; `removeSubject(id)` drops;
  `subjects()` / `scene()` read the blocking back as plain data — the scene
  object IS the pipeline record, reblockable numbers, no pixels needed.
- `render()` — `{ ok, blob, width, height, subjects }`, PNG at scene size.
- Drag moves the topmost subject under the finger (alpha-tested, so empty
  corners never grab); wheel over the selected one sizes 0.05–3x.
- UNDO — `undo()` walks blocking back one step, forty deep (blocking only:
  scenery changes are deliberate and stay). Removed subjects come back too —
  nothing is closed while the past can still reach it. The UNDO bar button
  does the same for the hand.
- KINDS — every subject is a CHARACTER (boots on y, the standing and sitting
  marks) or a PROP (centered on x/y, for tables, weapons, lamps). Pass
  `kind` on add, or flip it on the bar before ADD/CUT+ADD.
- BUCKETS — three shelves: SCENE | CHARACTER | PROP.
  `bucketSave(kind, name, blob)` files (same name replaces),
  `bucketList(kind?)` reads shapes, `bucketGet` hands the blob back,
  `bucketRename` / `bucketRemove` keep house,
  `bucketPlace(kind, name, {…})` stages again (scenes become the backdrop),
  `bucketExport` / `bucketImport` carry entries as data URLs for whoever
  files them. The shelf row in the bar files the selected piece (or the
  rendered still for SCENE), places, and drops.
- Nothing throws; refusals resolve `{ ok:false, why }` sentences (no scene,
  undecodable picture, unknown subject, unknown mark, unknown bucket,
  missing entry, no cutout chip, nothing to take back).
- `clear()` strikes the set; `destroy()` strikes it and takes the UI down.

## deliberately left out

- Rotation and opacity — the marks cover standing and sitting; unlocks when
  a still demands a lean.
- Scene save/load — `scene()` already emits the record; filing it is host
  work, one JSON line per still.
- Shelf persistence — buckets live in memory and go with the page; carry
  them out with `bucketExport` and back with `bucketImport`, which unlocks
  only if a house files blobs in kv.
- Multi-select and marquee — one subject moves at a time, like one actor
  taking direction.

## honesty note

Blocking numbers are stage-relative, so a re-render at a new scene size
reblocks from the same record — but a subject cut for one scene carries its
own lighting with it, and no placement fixes a noon subject in a dusk room.
Look at the still before it enters the pipeline.
DIVERGENCE 2026-10-06: this copy is v2 (undo, kinds, buckets). Her
sia-staging-chip-2 is the v1 this was cut from — byte-identical to v1, held
as provenance, not the wire.
