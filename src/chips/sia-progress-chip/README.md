# MYTHOS PROGRESS - the one rail for the whole terminal (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/progress.js (claims, priority rail, linger, announce, demo). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-progress-standalone.js"></script>
<script>
  var bar = MythosProgress.client({
    els: { progressRail: railEl, progressFill: fillEl, progressLabel: labelEl, progressPct: pctEl },
    print: function (who, text) { stage.print(who, text); }
  });
  var P = bar.begin("UPSCALING", { total: list.length });
  for (var i = 0; i < list.length; i++) { work(list[i]); P.set(i + 1); }
  P.finish(); // or P.fail("the reason"), which says so in red
</script>
```

No markup, jobs still track — the rail just has nowhere to draw. Nothing is silent.

## the contract

- `begin(label, {total, done, priority, detail, id})` — opens a job; a live id is CONTINUED, never duplicated. `show(label[, done[, total]])` is the one-liner.
- The rail shows ONE job: highest priority, newest of equals. A finished job never blanks another — the next active one draws at once.
- No total is an INDETERMINATE bar ("working, no count"), never an invented fraction. `set` / `step` / `setLabel` drive by handle or by id; `finish` / `fail(why)` close.
- Ended jobs linger their word (1.6s done, 5s failed — `lingerMs` / `failMs` seams), then the rail takes itself down. Priority-0 jobs announce start/done on the stage; the demo never announces.
- `active()` / `current()` / `report()` / `clear()` / `demo()` / `paint()` report and manage.
