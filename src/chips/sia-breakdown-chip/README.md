# BREAKDOWN CHIP — script to production (spec breakdown-chip/v1)

One dependency-free file. No DOM, no network, no build step. Load it in a
browser, in node, or inside a proprietary pipeline — the pure core runs
everywhere. Proven live in the Mythos Screenplay Console 2026-10-06.

## use

```html
<script src="breakdown-standalone.js"></script>
<script>
  var paras = MythosBreakdown.parasFromFountain(fountainText);
  var bd = MythosBreakdown.breakdown(paras);
  var csv = MythosBreakdown.toCSV(bd);            // stripboard ingest
  var shots = MythosBreakdown.toShotlistCSV(bd);  // pre-shot list
</script>
```

```js
// node (or any CommonJS host)
var MythosBreakdown = require("./breakdown-standalone.js");
```

Feeders: `parasFromFountain(text)` for standard fountain (handles forced
markers `.scene`, `@Char`, `!action`), `parasFromHtml(html)` for the six
`data-type` editor paragraphs, `readCanvas(id)` for the live console page
(browser only — returns [] anywhere else).

## the contract

- `breakdown(paras)` — `{spec, scenes[], sets[], cast[], totals}`. Per
  scene: n, header, intExt, set (= location — the page cannot tell a
  built set from a real place), time, cast[] (speakers), onSet[]
  (speakers + CAPS names from prose, folded: "CORPORAL DUBE" counts as
  "DUBE"), dialogueLines, actionLines, words, estPages (words/150,
  1 page ~= 1 min), tag arrays, transitions[].
- `extractTags(text)` — inline `[kind: value]` convention. Bare `[x]`
  counts as a prop. Kinds: props, wardrobe (w:/wardrobe:/ward=), makeup,
  vfx (fx:/cgi: fold here), sfx, sound, music, vehicles, animals,
  stunts, extras, locations. Full list in breakdown-chip.json.
- `stripboard(bd)` — `{groups, sceneOrder}`. Groups by set+time for the
  shoot schedule; story order kept inside each group.
- `toCSV(bd)` — one row per scene, 23 columns (see breakdown-chip.json).
  Multi-values pipe-joined (`ILSE | JAX | DUBE`).
- `toShots(bd)` / `toShotlistCSV(bd)` — default coverage: one WS master
  per scene, one MS per speaker, one INSERT per prop/vfx; a scene with
  neither gets an environmental WS. Every row ships `status: TODO` — the
  pipeline owns status after ingest.

## honesty notes

- extras come ONLY from `[extra:]` tags. A head count cannot be
  inferred from prose, and guessing would lie on a call sheet.
- estPages is arithmetic (words/150), not a read. It schedules; it does
  not direct.
- Nothing here writes, uploads, or phones home. It parses and returns.
