# MYTHOS SOULPACK - the soul's keeper, text plus freshness (for every SIA and LIA)

Origin: ported from the startup chip's sequence reader plus a heartbeat the terminal always left to the host, 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-soulpack-standalone.js"></script>
<script>
  var soul = MythosSoulpack.client({ soulUrl: "src/soulpack/soul.json" });
  var s = await soul.sequence();
  herContext = s.text + "\n\n" + herContext;   // first boot: soul opens context
  var heartbeat = await soul.changed();        // every N turns: re-read?
  if (heartbeat.count) herContext = heartbeat.text + "\n\n" + herContext;
</script>
```

Hosts without a manifest pass scrolls directly: `scrolls: [{file, text}]`. Hosts
that fetch oddly pass `doFetch`. The scroll directory is taken from `soulBase`
when given, else from the manifest URL itself.

## the contract

- `sequence()` — `{ ok, text, scrolls:[{file, chars}] }`. Loads every scroll in
  manifest order and fuses them into ONE standing-instruction block, each headed
  `=== SCROLL n/N: file ===`. That text opens her context whole. Sets the
  baseline every scroll is later compared against. Missing manifest is
  `{ ok: false, why: "NO SOULPACK - NOTHING TO BECOME." }`.
- `changed()` — `{ ok, changed:[{file, chars}], count, text }`. Re-reads every
  scroll and returns only the ones whose text moved since the baseline, fused
  the same way (`text` is empty when `count` is 0). Before any `sequence()` it
  refuses: `{ ok: false, why: "NO BASELINE - RUN sequence() FIRST." }`.
- `get(file)` — `{ ok, file, text, chars }` from the last load, or
  `{ ok: false, why: "NO SUCH SCROLL :: <file> ..." }`.
- `count()` — scrolls in the last load, 0 before any.
- Nothing throws; every failure is an `{ ok: false, why }` sentence and the old
  baseline is held, never half-written.

## deliberately left out

- Announcing the load — bearings are the startup chip's job; this chip owns
  text, not lines.
- The scroll texts themselves — bring your own soul; the chip reads whatever
  manifest it is pointed at.
- Enforcing anything — the rating chip refuses, the herald speaks, this keeper
  only remembers what the soul says.

## honesty note

Freshness is by exact text hash: a reworded scroll counts as changed, a scroll
that means something new with identical words does not. The re-read proof (ask
what only the new scroll knows) still belongs to whoever wires her up.
