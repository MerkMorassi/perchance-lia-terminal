# MYTHOS UPSCALE - bigger.pics in a window, the bigger one replaces the smaller (for any gallery)

Origin: ported from the terminal's bigger.pics road (src/js/upscale.js), 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-upscale-standalone.js"></script>
<script>
  var up = MythosUpscale.client({ site: "perchance.org/my-gallery" });
  galleryBtn.onclick = function () {
    up.upscale(pictureId, { tags: ["kept"] }).then(function (r) {
      if (r.ok) MythosUpscaleBox(r);   // upscale-snippet.html: stage + download
    });
  };
</script>
```

`upscale()` MUST run straight from the click — a popup opened anywhere else
is blocked. Bring your own vault (`vault: { add, get, remove, tag }`) or use
the in-memory one the client carries; bring your own pictures the same way.

## the contract

- `upscale(id | rec, { tags, context, batch, onResult, onClose })` — a promise.
  Opens `https://bigger.pics/` with no `noopener`, hands the picture over as a
  data URL on `bigger-pics-ready` (blind knock if the introduction never comes),
  resolves `{ ok, id, name, width, height, url, replaced, context }` when the
  result lands. `url` is an object URL — show it at once, no waiting.
- REPLACE, NOT KEEP: a result whose context names the picture it came from
  retires that smaller original the moment it lands, and its tags move to the
  bigger one alongside any `tags` passed for the run. A result with no context
  (added by hand in the window) is filed and retires nothing.
- FIT TO THE WINDOW'S LIMIT: bigger.pics takes pictures up to 16 MB, so one
  over ~15 MB is re-encoded (JPEG, then smaller) until it fits before it is
  handed over, and the handover name follows the fitted bytes. One that still
  will not fit refuses as `{ ok: false, why }` and the window is closed.
- `format: "png" | "jpeg"` — png unless told otherwise. `site` names the
  window's send-back button; its host must be the page's domain or a parent.
- Messages from any other origin are ignored; the ready and the result are
  accepted on origin alone, because the ready comes from the upscaler frame
  inside the window, which a caller on another origin can never reach. A result
  that is not a picture is ignored. The window closes itself shortly after the picture it was opened
  for comes back; a second press while one is open focuses it instead.
- Nothing throws; refusals resolve `{ ok: false, why }` sentences (blocked
  popup, missing picture, bigger-than-16-MB-even-compressed,
  closed-with-nothing-back).
- `destroy()` removes the message listener and ends the session.

## deliberately left out

- The terminal's pipeline mode (a window opened before the picture exists),
  batch bar, and her-eyes queue — host wiring, not the road itself.
- Filing anywhere but the vault adapter — IndexedDB, server shelves, and
  galleries plug in through `vault`.
- `sourceCheck` is a test seam only, not the handshake: production trusts the
  origin, which is the part a stranger cannot fake. `openWin` is the host
  override for opening the window.

## honesty note

This road deletes by design — the smaller original is retired on every
context-carrying result, which is the opposite of the terminal's own bigger.pics
road (it never retires; only its local road does). Point it at a vault whose
`remove` you trust. The live proof ran the full handshake against a stubbed
window; the first real popup press is the remaining proof, and it needs a human
click by browser law.
