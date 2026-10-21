# MYTHOS LOGTIME - the one clock for the whole terminal (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/logtime.js (stamp, gap, zone, business hours, clock block, seen/away). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-logtime-standalone.js"></script>
<script>
  var clock = MythosLogtime.client({
    store: kvStore(),  // optional { get()/set({on,zone}) } - on/zone survive reloads
    hours: { days: [1,2,3,4,5], from: 8, to: 17, label: "08:00-17:00" },
    lanes: { checkin: checkIn, shift: shift, proactive: proactive } // each with .clockLine()
  });
  print(clock.stamp()); // 2026-10-05 14:03:11 MST
</script>
```

No store, the clock still runs — settings just don't survive reload. Nothing is silent.

## the contract

- `stamp(ts?, {seconds}?)` — fixed `YYYY-MM-DD HH:MM:SS ABBR` shape, never locale-dependent; garbage timestamps fall back to now, never throw. The zone is this machine's own, `America/Phoenix` fallback, `/stamp zone <IANA|auto>` override.
- `gap(ms)` — whole minutes said like a person ("3 hours 12 minutes"); negatives read as less than a minute.
- Business hours are DATA, not a lock: `businessHours(ts)` / `inBusinessHours(ts)` / `businessHoursLine(ts)` report in the clock's own zone, and nothing is gated by them.
- `clockText()` — the facts she is told: the hour, how long since he spoke, the hours line, lit lane lines. `markSeen(ts)` / `awayMs()` track the gap.
- `set(v)` / `toggle()` / `zone(v)` / `load()` / `describe()` / `hasZone(z)` report and persist.
