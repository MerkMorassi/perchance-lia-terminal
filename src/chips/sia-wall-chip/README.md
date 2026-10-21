# MYTHOS WALL - the backdrop and its switch (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/wall.js (class switch, device-kept choice, /wall words, fail-safe-off record). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-wall-standalone.js"></script>
<script>
  var wall = MythosWall.client({
    body: document.body,
    offClass: "wallOff",
    store: kvStore(), // { get()/set({on,at,zone})/del() } - his hand, remembered
    print: function (t) { print("SYSTEM", t); },
    asset: function () { return "THE PICTURE ON IT IS " + currentUrl(); }
  });
  print(await wall.boot()); // the device's choice, or the shipped page untouched
  print(await wall.words("on"));
</script>
```

No store, the switch moves but nothing is remembered. No body, the choice is kept but the page is named unreachable. Nothing is silent.

## the contract

- `boot()` applies the kept choice and nothing else — no choice leaves the shipped page exactly as it is, so OFF is the first paint, never a flash.
- `on/off/toggle/set(quiet)` move the class and keep `{ on, at, zone }`. The receipt names `moved` and `kept` separately, so a switch that moved but wasn't remembered says so.
- `forget()` drops the choice and puts the class back; twice is the same shipped page.
- `words(arg)` is `/wall` (`on/off/toggle/forget/status/help`, unknown answers status). `describe()` names off/on, the picture, and the kept choice. `state()` reads the raw record.
- Seams: `body`, `offClass`, `store`, `print`, `zone`, `stamp`, `asset` (the host reads its own picture).
- Honesty: it fails safe and knows it — no fallback script ships because a wall that cannot switch on costs nothing, and the receipt says when the page could not be reached.
