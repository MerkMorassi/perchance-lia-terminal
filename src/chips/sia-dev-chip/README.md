# MYTHOS DEV - the tab-only bypass (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/dev.js (session flag, door-standing, /dev words). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-dev-standalone.js"></script>
<script>
  var dev = MythosDev.client({
    session: sessionBag(), // optional { get/set/remove } - defaults to sessionStorage
    doors: { gatekeeper: gate, agegate: door }, // each with .close()
    print: function (t) { stage.print("SYSTEM", t); }
  });
  dev.command("/dev on"); // this tab walks straight through
</script>
```

No session, no bypass — the doors stand and it says so. Nothing is silent.

## the contract

- The flag lives in the SESSION only (`lia_dev = 1`): closing the tab ends it, nothing is written to kv, and a second tab starts clean.
- `on()` / `set(v)` / `enable()` / `disable()` flip and read the flag. `closeDoors()` stands down both doors through the seams, then the markup directly.
- `command(arg)` — on/enable walks through and closes the doors, off ends it for the next load, anything else reports status. A browser that refuses the flag holds LOUD.
- `status()` reports. The bypass never touches lanes, records, or replies — it only stills the doors.
