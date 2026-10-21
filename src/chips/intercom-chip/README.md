# MYTHOS INTERCOM CHIP - one floor, one open mic, one monitor (for ANY host)

The interlocked PTT floor in one dependency-free file
(`mythos-intercom-standalone.js`, `window.MythosIntercom.IntercomChip`):
BARBELO and MAYA are hosts, PATRIKIOS is a monitor that hears the bus and
never transmits.

```html
<script src="mythos-intercom-standalone.js"></script>
<script>
  var chip = new MythosIntercom.IntercomChip({ tailMs: 350, maxHoldMs: 60000 });
  chip.on(function (e) { console.log(e.type, e.host || e.station, e.reason || ("ticket " + e.ticket)); });
  var t = chip.requestFloor("BARBELO"); // ticket, or null (DENY emitted)
  if (chip.isMicOpen("BARBELO")) { /* feed audio to STT */ }
  var line = chip.routeFinal("BARBELO", text, t); // ChatLine or null
  if (line) history.push(line);
  chip.releaseFloor("BARBELO");
</script>
```

Rules: floor is BARBELO | MAYA | null; granted only when free (no
preemption); only the holder releases; after a release the OTHER host is
locked out for tailMs (350 - speaker echo dies, the releaser may re-grab);
a hold past maxHoldMs (60000) releases itself with reason WATCHDOG; every
grant issues a ticket and only finals carrying a valid ticket reach history
(late finals from a legit turn still land, stray audio never does);
PATRIKIOS is rejected by type and at runtime (`MONITOR_NO_TRANSMIT`,
`isMicOpen` always false, `hearsBus` always true).

Wiring (this terminal, src/js/duet.js): Barbelo lamp ON/OFF ->
request/releaseFloor('BARBELO'); MAYA lane loud/quiet edge ->
request/releaseFloor('MAYA') (null = discard that audio); every server
final passes chip.routeFinal before it touches the floor or history.

Proven headless (page_eval, real file): 200 randomized ops hold a single
floor with no preemption and no foreign release; tail locks out only the
other host; watchdog frees a stuck hold; late finals with valid tickets
land; no-ticket, foreign-ticket, empty and monitor finals all drop.
