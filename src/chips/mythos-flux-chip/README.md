# MYTHOS-FLUX (mythos-flux) - mountable free AI image generator (for any host page)

Origin: exported from the mythos-flux generator 2026-10-04 (index.html shell,
src/js/* 39 modules, src/css/app.css, verbatim). Built to CHIP SPEC v1.

## use

```html
<div id="flux-host"></div>
<script src="mythos-flux-standalone.js"></script>
<script>
  var flux = MythosFlux.client({ target: "flux-host", root: root });
  flux.generate("a red fox in snow at dusk");
  console.log(flux.galleryCount());
</script>
```

Inside perchance `{root}` carries the image backends and `{target}` alone is
enough. Outside perchance pass your own `{root}` with at least
`generateImage`; anything less fails loud and mounts nothing.

## the contract

- `MythosFlux.client({target, root?, replace?})` - the only entry. Mounts the
  full generator (paint, markup, all 39 modules, boot) when no mounted copy
  is found; attaches as a controller when one is. Returns a handle:
  `version()`, `prompt()`, `galleryCount()`, `generate(text?)`.
- `mythos-flux-snippet.html` - the exact static markup the bundle boots
  against. A host that mounts manually includes this snippet, then calls
  `client()` the same way.
- Mounting twice without `{replace:true}` is refused, never stacked.
- Errors are sentences: `DENIED - ... :: NOTHING WAS MOUNTED.`,
  `FAILED - ... :: NOTHING WAS GENERATED.` Never a bare stack, never silence.

## deliberately left out

- The server script (presence pill, shared gallery) and `main.pjs` plugin
  wiring stay generator-side: a chip cannot carry them. What unlocks them is
  running this chip inside the mythos-flux generator itself.
- The AI upscaler worker (`src/ultra-worker.js`) is referenced, not bundled:
  a host serves it beside the chip or the pipeline falls back to the
  main-thread path, slower but working.
- No stylepack/roles/chronicle packs: they document the generator repo and
  do not fit a tool file. The boot drift check still runs and only ever warns.

## honesty note

A mount is not a fork: the chip boots the same code the generator runs, so
bugs and backend quotas travel with it. Outside perchance there is no key,
no quota, and no gallery until the host supplies backends; the chip says so
in one line instead of pretending otherwise.
