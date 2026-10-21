# MYTHOS DUTY - the master arm switch for her autonomous lanes (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/duty.js (armed/level, allow gates, describe/block, /duty words, kv save/load, paint). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-duty-standalone.js"></script>
<script>
  var duty = MythosDuty.client({
    store: kvStore(),  // optional { get()/load(), set(s)/save(s) } - persists {armed, level}
    lanes: {           // optional live lamp readings for the LANES line
      infinity: function () { return true; },
      checkin: function () { return false; },
      shift: function () { return false; }
    },
    paint: function (s) { lampEl.textContent = s.mode; },
    status: function () { liaStatus(); }
  });
  print(await duty.words("/duty semi"));
</script>
```

No store, she still runs — state just doesn't persist. Nothing is silent.

## the contract

- `mode()` — OFF, SEMI, or FULL. `armed()` / `level()` / `state()` report.
- `allow(lane)` — OFF holds everything; SEMI holds only the wide door (infinity); FULL clears all. Manual `now` hands are never gated — gate the autonomous move, not the hand.
- `words(arg)` — `/duty on|off`, `/duty semi|full`, `/duty arm semi|full`, bare `/duty` reports. Unknown words are held with USAGE plus the report.
- `setLevel(l)` — semi|full only, anything else held with USAGE; setting a level arms the master.
- `describe()` — the station report with the LANES line and the usage line. `block()` — the standing-orders text for the brain in each mode. `laneLine()` — the one LANES line alone.
- `save()` / `load()` — store round-trip where a road is given; storeless runs report `kept:false` and still paint. `arm(v)` flips the master.
