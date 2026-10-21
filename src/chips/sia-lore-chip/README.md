# MYTHOS LORE - local BM25 memory: ingest, recall, canon, focus (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/lore.js (retrieval core: tokenize/chunk/BM25/teleporter/fuse/canon/focus). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-lore-standalone.js"></script>
<script>
  var lore = MythosLore.client({
    store: kvFolder(),                 // optional async { get(k), set(k, v), delete(k), entries() } - raw texts persist
    semanticSearch: (q, k) => embed(q) // optional async/sync lane fused by reciprocal rank
  });
  await lore.load(); // restores the store where one is given; memory-only without
  await lore.ingest("canon.txt", "Barbelo is the divine mother.", { foundational: true });
  await lore.ingest("ships.txt", "Three clipper ships load smoked glass at dawn.");
  const ctx = await lore.buildContext("what loads at dawn");
  print(ctx.canon); // always-true ground, never trimmed
  print(ctx.text);  // ranked fragments inside budget
</script>
```

No store passed, everything lives in memory; anything missing fails LOUD, never silent.

## the contract

- `ingest(name, raw, meta)` — chunks and indexes; same name re-ingested updates, same `hash` + canon flag kept. Empty text refused with `empty`. Returns `{ status, name, chunks }`.
- `search(query, topK)` — BM25 over fragments: exact document-name jumps first, shared-word bonus, adjacent-fragment penalty. Returns `[{ id, score, file, heading, text }]`.
- `buildContext(query, topK)` — canon first and never trimmed, ranked hits fused with the meaning lane where offered, cut to budget. Returns `{ text, hits, canon, canonHits }`.
- `focus(name)` / `unfocus()` / `focused()` / `focusBlock()` — one document handed over whole (up to `focusCap`) with the next reply; unknown names refused.
- `forget(name)` — exact then case-insensitive; unknown refused. `clear()` drops all. `source(name, chars)` reads the original back. `rechunk(chars, overlap)` retunes without re-uploading. `preview(query)` / `describe()` / `count()` / `files()` / `chunks()` / `settings()` / `load()` report.
- Seams: `store`, `countTokens(text)`, `budget` / `budgetFn()`, `semanticSearch(query, k)`, `maxChars`, `overlap`, `hardCap`, `focusCap`.

## deliberately left out

- The DOCS panel, the pager, the sort bar, the DOX viewer — host chrome; the chip is the engine they draw.
- The kv folders and the embedding model — `store` and `semanticSearch` seams.
- The `/lore` verbs and the prompt weaving — host wiring; the chip answers what they ask.

## honesty note

Lexical recall finds shared WORDS, not shared meaning — without the meaning lane a paraphrased passage is invisible, and canon is only as true as what was filed as canon.
