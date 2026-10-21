# MYTHOS AGEGATE - the 18+ door (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/agegate.js (state, show/close, pass, forget, command, describe, boot). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-agegate-standalone.js"></script>
<script>
  var door = MythosAgegate.client({
    store: kvStore(),  // { get()/set(rec)/delete() } - the answer lives on this device only
    els: {             // the door markup (plain HTML, first paint, above everything)
      ageGate: gateEl, ageGateBox: boxEl,
      ageGateEnterBtn: enterBtn, ageGateLeaveBtn: leaveBtn
    },
    print: function (t) { stage.print("SYSTEM", t); },
    stamp: function (ts) { return clock.stamp(ts); },
    zone: function () { return clock.zone(); }
  });
  await door.boot(); // returning visitors walk straight in
</script>
```

No store, no memory — the next load asks again. No markup, the calls still hold. Nothing is silent.

## the contract

- The door FAILS CLOSED: absent, unreadable, or corrupt records read as NO ANSWER. Only `{ok:true}` opens.
- `pass()` — the ticked box writes `{ok, at, zone}` and opens; an unticked box holds with `false`. `forget()` takes the answer off the device so the NEXT LOAD asks.
- `command(arg)` — bare/show opens again, forget clears, status reports, help teaches, gibberish opens again (asking is the safe side).
- `boot()` — closes for returning visitors, asks strangers, bypasses neither; the dev bypass (`dev()` seam) closes without asking until the tab closes.
- `describe()` / `help()` report. `paint()` wires the enter button to the checkbox.
