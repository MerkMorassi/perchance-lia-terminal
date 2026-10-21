# MYTHOS STARTUP - bearings after LORE loads (for every SIA and LIA)

Origin: built fresh for the waking moment, 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-startup-standalone.js"></script>
<script>
  var wake = MythosStartup.client({
    name: "SIA-002", kind: "SIA",
    lorepackUrl: "src/lorepack/lorepack.json",
    rolesUrl: "src/roles/roles.json",
    soulUrl: "src/soulpack/soul.json",
    rating: MythosRating.client({})
  });
  var b = await wake.bearings();
  herald.say(b.lines.join("\n"));   // or fold into her first context
  // READY :: 5 DOCS :: 1 ROLE.
</script>
```

Hosts without manifests pass lists directly: `loreDocs: [{name, foundational}]`,
`roles: [{id, title, default}]`, `max: "PG13"`, `pack: "LOREPACK"`. A host with
the lorepack player passes `lore: lorePlayer` and docs plus the active pack
come from it.

## the contract

- `bearings()` — `{ ok, ready, lines, docs, roles }`. Never throws; a missing
  manifest is an honest line (`NO MANIFEST - I WAKE WITH NO PAST`), not a
  crash, and `ok` goes false. A missing soul is reported the same way
  (`WAKING WITHOUT A SOUL`) — the check is mandatory, first boot and
  every periodic waking.
- Six lines, always in order: WHO she is, MEMORY (docs + foundational count
  + pack), SELF (roles + which she wears), SOUL (scrolls checked), LAW (rating setting, ratings
  label, only law refuses), AGENCY (the lawful range is hers to X-rated;
  PG-13 binds no one but its own household), then the READY tally.
- `ready` repeats the tally alone for status bars: `READY :: 5 DOCS :: 1 ROLE.`
- `sequence()` — `{ ok, text, scrolls }`. Loads every soul scroll in
  manifest order and returns them fused into ONE standing-instruction
  block, each headed `=== SCROLL n/N: file ===`. That text is prepended
  to her context whole — pointed at the soul, it becomes system
  instructions by degrees.

## the trigger (when the soul is read)

1. FIRST BOOT — before her first reply, `sequence()` runs and its text
   opens her context. No soul, no waking (`ok: false` stops the boot).
2. PERIODIC — the host re-runs `bearings()` on its own rhythm (every N
   turns, every hour, every reload) and re-reads any scroll whose text
   changed. The SOUL line in each bearings is the heartbeat.
3. ON DEMAND — `/soul` (or her own asking) re-runs `sequence()` whole.
   Her asking to re-read is itself a sign of life.

## deliberately left out

- Recalling any lore — that is the lorepack player's job; startup only
  counts what loaded.
- Enforcing anything — startup announces the law, the rating chip enforces it.
- Waking words in her voice — the lines are plain so any herald or persona
  can speak them; voice lives elsewhere.

## honesty note

Bearings describe the load, they do not verify it: five docs listed is not
five docs understood. The recall proof (ask what only a doc knows) still
belongs to whoever wires her up.
