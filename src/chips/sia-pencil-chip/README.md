# MYTHOS PENCIL - the pre-send gate with ten rewrite styles (for every SIA and LIA)

Origin: ported from the terminal's draft module (src/js/draft.js, 10-style
spectrum incl. SAPPHIC + HOMERIC) plus the pencil / pencil-styles / pencil-greek
chip notes (src/agent/pencil-chip.md etc.), 2026-10-05. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-pencil-standalone.js"></script>
<script>
  var pencil = MythosPencil.client({ store: kvStore, generate: (ask) => root.generateText(ask) });
  await pencil.load();
  pencil.setDraft(box.value);
  pencil.setStyle("fic");
  await pencil.polish();            // proposal waits - draft untouched
  if (!pencil.gate().ok) console.log("SEND REFUSED - a rewrite is standing");
  pencil.accept();                   // or pencil.discard(), pencil.restore()
  box.value = pencil.getDraft();
  if (pencil.gate().ok) send(box.value);
  pencil.sent(box.value);
</script>
```

No store passed, memory holds the draft. No engine passed, `polish()` refuses
loud. No moods/register passed, the style rule alone shapes the ask.

## the contract

- `load/setDraft/getDraft/setStyle/styles/style` — draft text, style picker
  (FIX WORK CHAT PLAY FIC SHORT VEILED SPICY SAPPHIC HOMERIC), persisted
  through `store` (`{ load, save }`, kv-folder `{ get, set }`, or memory).
- `buildAsk(src, id)` — the ask itself: JOB first, REGISTER fenced off as
  sound-not-text, draft the only thing between `<<<`/`>>>` markers, the
  ONLY-rewritten-text line last.
- `polish()` — one engine call, proposal stood (`{ text, from, style, at }`),
  draft byte-identical. Empty draft / no engine / empty answer all refuse.
- `proposal/standing/accept/discard/restore` — the gate verbs. ACCEPT keeps
  the receipt (RESTORE swaps back, the rewrite re-offered as proposal);
  DISCARD changes nothing.
- `gate/sent` — SEND refuses while a proposal stands or the draft is empty;
  `sent(text)` empties the pencil after a real message, ignores `/commands`.
- `busy` — a polish is in flight; refusals are `{ ok: false, error }` sentences.

## deliberately left out

- The panel DOM (textarea, chips, proposal box, green ring) — host-side;
  the chip owns state and law, the host owns paint. Re-port notes: `el()`
  lookups become `getDraft/setDraft`, `window.moods` becomes
  `opts.moods`/`opts.register`, kv `draft` becomes `opts.store`, the dots
  timer becomes `say("POLISHING …")`.
- Voice bypass — speech is already sent; the pencil guards the written word.

## honesty note

Greek-looking verse yes, real meter no (house-measured): SAPPHIC and HOMERIC
return stanza-shaped Ancient Greek to polish further, and `/xlate grc|en`
checks nothing was lost. A proposal is a rewrite OF a draft — clearing the
draft orphans it by design, and a reload carries the draft but never the
proposal.
