# MOOD - her voice colours, filed and worn (for MERKOS)

Origin: the house console chip, touched 2026-10-06 for autonomous coining (bare new
names in her lane file from her own reply instead of refusing).

## use

```html
<script src="mythos-mood-standalone.js"></script>
<script>
  const moods = MythosMood.client({
    book: MythosMood.client({}).shown(),
    store: { load: () => vaultGet("mood_state"), save: (v) => vaultPut("mood_state", v) },
    say: (t) => chatSys(t),
    generate: async (ask) => (await brain(ask)).text,
    onChange: () => repaintConsole()
  });
  await moods.load();
  moods.look("TENDER");
  moods.words("/mood list");
</script>
```

## the contract

- `client({ book, store, kvFolder, say, generate, onChange })` — `book` is the
  shipped list (array of `{ id, label, rule }`); without one the console starts
  empty and says so. Persists `{ on, id, by, ours, edits, away, boards }` through
  `store` (`load`/`save`, async ok) or `kvFolder`, else holds until reload.
- Her lane `look(spec)` — `[[MOOD: TENDER]]` wears, `+`/`and` wears several,
  `off` bares her, `NAME :: rule` files a new colour (or rewrites a known one)
  and wears it at once. A bare unknown name returns
  `{ ok:false, coined:"NAME", error }` — the host completes it with
  `compose({ label, seed: herReply })` then `look(name)` to wear. Several unknowns
  at once still refuse loud.
- `wear(spec, { seed, generate })` (v3 — no host catch needed) — one call that
  files and wears: runs `look`, and on a coined refusal composes from `seed`
  (her reply) with `generate` (call arg or client engine) then wears. Known
  names, multi-unknown refusals, and seedless/engineless coined refusals pass
  through exactly as `look` answers them. A failed compose files nothing.
- `compose({ label, seed, generate })` — files her words as a rule (switch OFF,
  never worn by composing; `look(name)` wears after). Needs an engine:
  `o.generate` or `opts.generate`, else refuses loud and spends nothing.
  `museAsk(seed, label)` voices the ask for her own engine.
- His door `words(s)` — `status | list | off | on | add | delete/restore |
  reset | edit | rename | new NAME :: rule | NAME :: rule | board … | NAME (+ NAME)`
  flips the same switches, attributed `hitl`. Unknown names refuse with the file
  roster, never silence.
- Reads: `labels()`, `label()`, `count()`, `blockText()` (her prompt block, empty
  when all off), `summary()`, `listText()` (put-away ones included), `boardNow()`.
- `load()` reads book + store; `ready()` gates the prompt block.
- Shapes: moods `{ id, label, rule }`; hers in `ours`, rewrites in `edits`,
  put-away ids in `away` (restorable, never destroyed).

## deliberately left out

- No hard delete: `remove()` puts away, `restore()` brings back — the file only
  grows, which unlocks only if a house needs forgetting.
- `look()` never calls the engine itself (sync lane); coining completes in the
  host, which unlocks only if a house wires no brain.
- No vector mood matching: names match exactly (case- and punctuation-folded),
  which unlocks only if a house outgrows naming.

## honesty note

A colour is how she is to sound, never what she is to say, never a role, never
an order. The console holds switches; she holds the voice.
