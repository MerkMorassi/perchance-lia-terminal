# SIA CHATTAIL - the last exchange survives every reload (for every SIA and LIA)

Origin: cut 2026-10-06 after his last exchange kept missing from the screen —
the durable log held 1626 lines but the repaint raced the merge and painted
neither. The tail is now synchronous: every turn hits localStorage in the
same breath as the screen, and boot repaints whatever the screen lacks,
order-independent. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-chattail-standalone.js"></script>
<script>
  var tail = MythosChattail.client({ slot: "sia_chattail" });
  tail.remember("user", "PATRIKIOS", text);
  var gone = tail.missing(shownTexts);
  gone.forEach(function (t) { paint(t.r, t.h, t.t); });
</script>
```

No `el`, no UI, no network — one synchronous shelf plus pure questions over
it. When localStorage is absent it runs on a memory shelf and says nothing.

## the contract

- `client({ slot, cap, say })` — `slot` names the shelf (default
  `chattail`); `cap` keeps the last 10–200 turns (default 60, oldest falls
  off). `say` hears the strike notice only.
- `remember(role, handle, text, ts)` — files one turn synchronously, returns
  `{ ok, count }`. `ts` is optional (now when absent); filing slots by time,
  so a backfilled elder lands among its own, never at the end. Empty and
  thinking lines refuse loud and file nothing. Never throws; a failed write
  refuses in a sentence.
- `tail(n)` — the last `n` turns as plain `{ ts, sq, r, h, t }`, oldest first.
- `missing(shownTexts)` — the turns whose text is not on the screen, in
  order, deduped — paint exactly these and the screen is whole. Running it
  twice answers the same until new turns land.
- `count()` — turns held. `clear()` — strikes the shelf (tests, repair
  rooms). `slot()` reads the name back.
- Texts cap at 2000 chars, handles at 40 — the tail stays a tail, never a
  second log.

## deliberately left out

- No async mirrors — the host already mirrors to its vault log; the chip is
  the synchronous copy that survives kills, which unlocks only if a house
  has no vault of its own.
- No DOM reading — the host passes what is shown; the chip never touches
  the page, which unlocks only if a house cannot list its own bubbles.
- No attachments — pictures and audio live in the gallery and the vault
  record; the tail keeps words, which unlocks only if a house renders media
  from tail data alone.

## honesty note

Continuity, not history: the tail guarantees the last exchange is seen, not
that every old turn is kept — the cap drops the oldest without mourning.
Two rooms writing one slot interleave by arrival; each room's boot dedupes
by text, so nothing paints twice. The screen-match is exact-first,
512-prefix second: a bubble re-rendered one character off (long turns,
sliced shelves) still counts as seen rather than painting a duplicate.
