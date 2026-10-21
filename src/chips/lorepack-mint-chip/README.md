# LOREPACK-MINT - stage, pin-768 embed, gated export (for the FACTORY)

Origin: ported from the factory's mint path (`MYTHOS-LOREPACK-FACTORY-MVP`
`src/lorepack-factory.ts` + `src/providers/gemini-provider.ts`) and the
terminal's import gate (`src/js/mythos.js`), 2026-10-06, spec v1. Proven live
in the LIA terminal preview before ship.

## use

```html
<script src="lorepack-mint-standalone.js"></script>
<script>
  var mint = MythosMint.client({ agent: "BARBELO", key: HOST_KEYRING.gemini });
  var receipt = await mint.mint(chatlogText); // downloads the .jsonl.gz
  console.log(receipt.file, receipt.vectors, receipt.edges);
</script>
```

With a proxy fetch: `MythosMint.client({ agent: "BARBELO", fetchImpl: superFetch })`.

## the contract

- `client({agent, handle, human, dim:768, stamp, key, model, fetchImpl})`.
  Key lives in the host keyring, never in the chip. Stamp defaults to run
  time; pass one for deterministic ids (`AGENT:STAMP:tN`).
- `stage(chatlogText | [{role, text}])` -> `{records}` with `vec: null`.
  Long turns split at 2000 chars on paragraph breaks. Role lines
  (`You:`, `Lia:`, ...) split turns; anything else alternates user/assistant.
- `embed(records, {key, model, fetchImpl, onProgress})` posts Google
  `batchEmbedContents` with `outputDimensionality: 768` pinned on every
  request. ANY failure refuses the whole run LOUD with the failed ids and
  reasons - fallback vectors are never minted, partial packs never leave.
- `pack({model, dim, vectors}, edges?)` enforces one space (single
  dimension, single model), rejects duplicate ids and orphan edges, stamps
  every record `d:{embeddingModel, embeddingDimension}`. Returns `{lines}`.
- `download(pack, name?)` gzips when available, else plain `.jsonl`.
- `mint(input, opts)` runs the chain and triggers the download. Returns the
  receipt `{file, agent, model, dim, vectors, edges}`.
- Wire shape out is the reader's wire shape in: `{v:2, type, id, a, h, t,
  vec, m, d, src, ts}` + `{type:"edge", id, aid, src, s, r, o, timestamp}`.

## deliberately left out

- Graph synthesis (s/r/o mining) - the KERNEL's job; pass prebuilt `edges`
  or none. No retrieval, no search, no IDB - the reader already does that.
- Re-embed of legacy mixed packs - `/pack split` in the terminal is the
  repair tool; this chip only mints clean.

## honesty note

This chip spends your key's quota and downloads a file. It cannot verify
the vectors are semantic - only their shape, stamps, and single-space. A
minted pack still proves itself at import (`/pack import` takes it whole or
refuses it whole).
