# MYTHOS-FRAME - the HITL or SIA populates the frame with a link, and it plays (for every SIA)

Origin: cut for the coming CODESHOP road to CHIP SPEC v1, proven live 2026-10-07.
One framed app at a time: a pinned board of named links plus any pasted URL,
gated to http(s) and read back as a plain `src` the host sets on its own
iframe. Cutoutly ships pinned.

## use

```html
<script src="mythos-frame-standalone.js"></script>
<script>
  const frame = MythosFrame.client({
    store: { load: () => libGet("frame_board"), save: (v) => libPut("frame_board", v) },
    say: (t) => chatSys(t)
  });
  await frame.load();
  const r = await frame.open("cutoutly"); // or any https:// link
  if (r.ok) appFrame.src = r.src;
</script>
```

The host owns the `<iframe>` (sandbox it: `sandbox="allow-scripts
allow-same-origin"` only if the app needs it, never `allow-top-navigation`).
The chip never touches the page, so it frames anywhere.

## the contract

- `load()` -> `{ok, count}`. Restores the pinned board + current from store,
  else seeds the board with CUTOUTLY.
- `list()` -> `[{id, title, url}]` pinned apps.
- `open(idOrUrl)` -> `{ok, src} | {ok:false, error}`. Named app or raw link;
  persists current, says one line. Refuses loud: empty, non-http(s),
  javascript:/data:/file:/blob:, overlong.
- `close()` -> dark frame, says so. `current()` reads what's playing.
- `pin({id, title, url})` / `unpin(id)` — the board, persisted.
- `rename(id, title)` — retitle a tab; the id (and its URL) stands.
- `retarget(id, url)` — repoint a tab; gated like any link.
- `move(id, dir)` — reorder the board; dir -1 up, +1 down.

## deliberately left out

- No DOM — the iframe stays host-side (it did for the shelf, it does here).
- No frame-busting — some sites send X-Frame-Options and stay dark; the chip
  says so up front and the host offers the tab instead.
- No watching — the chip knows what was asked to play, never what played.
  Proof of watching would be surveillance with better manners.

## honesty note

A frame is a window, not a promise: the chip guarantees the link was gated
and remembered, never that the far site agreed to play. Anyone with the board
can pin anything playable — pin like the household reads it.
