# CITATION CHIP — provenance marks for the voice app (conversational weight)

Problem: three different things can come out of her mouth — CANON (what the
scrolls actually say), LORE (what recall surfaced), INFER (what she concluded
on her own, INFERPACK-style, from historical data). The listener can't tell
them apart. NotebookLM solves it with citations; she solves it with speech.

## The rule

Every claim she speaks carries ONE provenance, and she says which — in words,
not footnotes:

- CANON → "The scrolls say…" (shipped/foundational text, verbatim ground)
- LORE → "From what I carry…" (recalled pack fragment, possibly paraphrased)
- INFER → "My sense is…" (her own conclusion; never dressed as canon)

## The machinery (small)

1. Recall already returns hits — tag each hit at the source:
   `[CANON:THE ABSOLUTE]` for foundational docs, `[LORE:THE POWERS AND THE PURSE]`
   for the rest. The tag rides into context; the model sees it.
2. System line (one sentence): "Mark every grounded claim with its tag; mark
   your own conclusions [INFER]. Speak the meaning, not the brackets."
3. TTS strips `[...]` tags before speaking; the text log keeps them — the chat
   record stays auditable while the voice stays clean.
4. Verbal habit, enforced by example in the prompt, not by code:
   canon first in scrolls-voice, inference last and labeled.

## Non-goals

No footnote numbers, no source lists, no click-to-open panels. Conversational
or nothing. When in doubt she says "my sense is" — a false INFER is cheap, a
false CANON is a lie.
