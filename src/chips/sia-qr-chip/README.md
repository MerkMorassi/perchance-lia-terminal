# MYTHOS QR - draw codes and scan them back, pure and offline (for every SIA and LIA)

Origin: single-file chip written 2026-10-05 — one script tag carries the whole payload: the Arase QR generator core + the jsQR decoder core (both vendored verbatim from src/js/, doing the math) with a MythosQR factory wired over them. Built to CHIP SPEC v1.

Attribution: QR generator © Kazuhiko Arase (MIT, http://www.d-project.com/); jsQR © its authors (MIT). Their engine code rides inside this one file, untouched except the load surgery (comment header off the generator, UMD shell off the reader so nothing leaks a second global).

## use

```html
<script src="mythos-qr-standalone.js"></script>
<script>
  var qr = MythosQR.client({ ecLevel: "M" });
  var drawn = qr.make("HELLO SKYE");
  document.body.insertAdjacentHTML("beforeend", drawn.svg(8));
  var scanned = qr.read(ctx.getImageData(0, 0, w, h));
  print(scanned.ok ? scanned.text : scanned.error);
</script>
```

One file, one global (`MythosQR`), nothing else leaks. No store, no network, no host features — `make` is pure string math, `read` takes raw RGBA bytes (canvas ImageData, an uploaded photo decoded by the host, a video frame). `read` accepts ImageData directly or `{ data, width, height }`.

## the contract

- `make(text, { ecLevel, scale, margin })` — smallest QR version (1–40) that fits, EC `L|M|Q|H` (default `M`, unknown falls back to `M`). Returns `{ ok, size, ec, chars, at(r,c), ascii(), svg(scale, margin) }`. `at` reads one module; `ascii` draws `██`/spaces; `svg` returns a standalone black-on-white string (default scale 4, margin 4, clamped 1–20 / 0–40).
- `read(pixels, width, height, { inversionAttempts })` — decodes RGBA bytes, returns `{ ok, text, version, location }` (corner points when found).
- Nothing throws; refusals are sentences: engines missing, empty text, text beyond version 40, bad/short pixels, no code in view.
- No storage, no secrets, no residue — the chip keeps nothing between calls.

## deliberately left out

- Image decoding (PNG/JPEG → pixels) and camera capture — the host owns pixels (its attach lane, its `<input>`, its video frame); the chip starts where bytes begin.
- Styling (rounded modules, logos, colors) — the matrix from `at()` plus the svg path are everything a painter needs.
- Writing to canvas/DOM — `svg()` returns a string, the host places it.

## honesty note

A draftsman and a reader, not a vault: drawn codes carry whatever words they are handed, so secrets stay out of the pixels unless the host means them to travel.
