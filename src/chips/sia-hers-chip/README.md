# MYTHOS HERS - her own keeping: memories she files, wants she carries (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/hers.js (memory lane, wants lane, blocks, reports). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-hers-standalone.js"></script>
<script>
  var hers = MythosHers.client({
    lore: loreEngine(),   // { files(), ingest(name, body, { pack, origin }), forgetFile(name), findDoc?(name), source?(name, chars) }
    store: kvFolder(),    // optional async { get(k), set(k, v) } - the wants persist
    stamp: (ts) => stamp(ts)
  });
  await hers.remember("The lighthouse keeper trims the wick each night.");
  await hers.want("Learn the names of every star.");
  print(hers.wantsBlock()); // rides with her every turn until released
</script>
```

No lore passed, the memory lane refuses LOUD; no store, the wants live in memory. Nothing is silent.

## the contract

- `remember(raw)` — files her words as a real lorepack document (`pack HERS`, `origin hers`), numbered and slugged, footed as kept-by-her. Empty lines refused. Returns `{ ok, name, text, chunks }`.
- `forget(sel)` — by number or by words; only ever her own documents, only ever into the lore trash. Ambiguous words name their candidates instead of guessing.
- `want(raw)` — a standing intention in her own words. `release(sel)` — by number, words, or `all`; a release is recorded, never deleted. Empty lines and bad numbers refused.
- `wantsBlock()` — empty when she carries nothing, so nothing rides for its own sake. `memoryHint()` — the count, worth her knowing.
- `memories()` / `memoryCount()` / `listMemories(limit)` / `reportMemories()` / `reportWants()` / `describe()` report; `clean(raw, cap)` tidies her lines.
- Seams: `lore`, `store`, `stamp`, `pack`, `origin`, `wantKey`, `maxKeepChars`, `maxWantChars`, `maxWantsStored`.

## deliberately left out

- The lorepack and the kv folders — `lore` and `store` seams.
- The panel and the `/hers` verbs — host wiring; the chip is the keeping they show.
- The directive carrier that strips her lines — host wiring; the chip files what it is given.

## honesty note

Nothing here is invisible and nothing is irrevocable — her memories are filed where he can read them, her wants ride where he can see them, and everything she keeps he can take away.
