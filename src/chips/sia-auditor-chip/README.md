# MYTHOS AUDITOR - the settings-and-CHIPS check that reports (for every SIA and LIA)

Origin: built fresh for the house audit road (terminal kv `lia_settings` + `src/chips/chips.json`), 2026-10-05. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-auditor-standalone.js"></script>
<script>
  var auditor = MythosAuditor.client({
    settings: window.root.kv.lia_settings,
    manifest: { chips: [...] },
    present: ["sia-mood-chip/mythos-mood-standalone.js", "sia-mood-chip.zip"]
  });
  var rep = await auditor.audit();
  console.log(rep.text);
</script>
```

No store passed, the settings half reports it cannot read. No manifest passed, the chips half refuses loud. No `present` passed, the chips half reports manifest-only (counts, held, missing zips by `zipBytes`) without claiming tree presence.

## the contract

- `audit()` — both halves plus the verdict line. `{ ok, at, settings, chips, text }`. Says the report through `say` when one is passed. Writes nothing.
- `auditSettings()` — reads `opts.settings` (plain snapshot object, kv folder with `entries()` or `keys()+get()`, `{ load() }` store, or a fn returning any of those). `{ ok, at, count, keys, missing, extra, note, text }`. Values are never printed — only `kindOf` shapes (`TEXT:n`, `ARRAY[n]`, `OBJECT{n}`); secret-shaped keys (`key|token|secret|pass|sigil|hash|auth|bearer|session`) print as `[SEALED] name :: kind` and nothing more.
- `auditChips()` — reads `opts.manifest` (chips.json or its `chips` array; `manifestUrl + doFetch` also works) and `opts.present` (path list, `{ files }`/`{ paths }`, inventory map `{ chip: { files:[], zip } }`, or a fn returning any of those). `{ ok, at, total, whole, held, missingFiles, missingZips, text }`.
- `EXPECT_SETTINGS` — the house list (61 keys) used when `expectSettings` is not passed. Override per realm with `opts.expectSettings`.

## deliberately left out

- The document auditor (`src/js/auditor.js`, business-intelligence reviews of lorepack docs) — same word, other job. This chip audits the house, not the library.
- Reading the tree itself — the chip never lists files; the host passes what is present (backup file list, fetch, or inventory map). No host filesystem assumptions.
- Keyring values and gatekeeper tokens — presence and shape only, masks only, never values. Keys live in the host keyring, never in the chip.

## honesty note

The report is only as fresh as what it was handed: a stale snapshot gives a stale audit, and manifest-only mode cannot promise bytes on the tree. It proves presence and shape, never content correctness — a settings key can exist and still hold the wrong value, and a chip file can exist and still be the old build.
