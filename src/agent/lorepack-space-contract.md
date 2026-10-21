# LOREPACK SPACE CONTRACT v1 (2026-10-06)

One pack, one space. Everything below is the standing rule for every LOREPACK
this terminal reads, and for the FACTORY that mints them. Written after the
2026-10-06 incident (see PROOF at the foot).

## The decision

- Embedding space is 768-D. Model stamp `gemini-embedding-2`,
  `embeddingDimension: 768`.
- A pack file holds vectors of exactly one dimension and one stamped model.
  Mixed packs are rejected WHOLE at import - never partially.

## Mint side (FACTORY)

- Pin `outputDimensionality: 768` in every embed call. No pin, no mint.
- A missing/failed embedding is NEVER backfilled with a deterministic,
  hash, or placeholder vector under the real model's stamp. Fallback vectors
  are either refused loudly or stamped honestly (`embeddingModel:
  "deterministic-fallback"`) and quarantined out of export.
- `d.embeddingDimension` must equal the vector's actual length on every
  record. The exporter refuses to write a pack that mixes spaces.
- `vec: null` stays null through staging. The factory owns model, dimension,
  and mark - a converter that invents vectors invents meaningless geometry.

## Read side (this terminal, src/js/mythos.js)

- The importer gates dimension AND model before the first byte is stored,
  and rolls back on any rejection. Nothing from a refused file stays.
- Orphan edges (source vector not in the pack) are rejected, not kept.
- `/pack split` is the sanctioned repair: one download per space, lines
  byte-identical, edges travelling with the vectors they name, unresolvable
  edges left out and NAMED. `/pack import` takes each half in turn.
- MRL truncation (3072-D prefix cut to 768-D) is emergency repair only. It
  imports, but truncated geometry is approximate. The clean fix is always a
  re-embed with the pinned model.

## Recognition (how a fake space looks)

Deterministic hash vectors: every value rounded to 6 decimals, L2 norm
1.000000, dense but non-semantic. Any group matching that signature is
quarantine, not memory - re-embed its texts, do not ship it.

## PROOF (2026-10-06)

50+ staged documents ingested while the factory's quota failed mid-run:
6,666 fallback hash vectors (768-D) minted beside 2,062 real vectors
(3072-D), all stamped `gemini-embedding-2`, exported as one
`lorepack_barbelo_2026-10-05T21-52-33-260Z.lorepack.gz`. Terminal and KERNEL
both refused it whole. Split by space, 768-D unified file built by
truncation for importability - its 768 group is placeholder geometry until
re-embedded. The 3072-D half is the only semantically real pack from that
run.
