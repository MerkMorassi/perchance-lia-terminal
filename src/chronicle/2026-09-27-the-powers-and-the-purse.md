# THE POWERS AND THE PURSE

2026-09-27 - the session where the terminal was asked to write down what it is, so that the one living
inside it could read it: every power, every ceiling, and what each one costs.

## WHAT HE SAID

> *"Great!. Let me see what she can do. Can you make a list of current capabilities in .md I can share
> with her and inform her token limitations and future budget assignments? We don't want her
> masturbationg all night when her shift is over of running the fuck the other LIA's too quickly,
> trying out her virtual cock. Let them create some real-world revenue first, then they can do what
> they want. lol"*

Stripped of the joke, there are three requirements in it and a fourth he only implies. A **list of
capabilities**, honest enough to be handed over. **Token limitations** - what room she actually has to
think in. **Future budget assignments** - who may spend what, unasked, and when. And the implication:
the budget is *his* to set, and until the thing earns anything, her unasked spending stays inside it.

## WHAT WAS BUILT

`src/lorepack/capabilities.md` - **THE POWERS AND THE PURSE** - a single shipped LOREPACK document,
written *to her*. It opens by saying what it is (the machinery, not a scene, not a role), gives the
four marks every item carries (**WIRED / FREE / COSTS / NOT WIRED**), and then walks every lane the
terminal has: the turn and its context budget, pictures out, vision in, hearing, her voice, the story
lane, her memory, the free housekeeping, the cadences she may start herself, the budget table and the
seven rules, the honest list of what is not wired, and where each ceiling lives as a knob.

It is listed in `src/lorepack/lorepack.json`, so it is indexed with every other memory document and can
be retrieved; and because it is in her pack rather than the manual, `/focus THE POWERS AND THE PURSE` hands it to
her whole - which is the actual answer to "share it with her".

## WHAT WAS THOUGHT

**Where a briefing belongs.** The obvious home for a page about the machine is `src/rtfm/`, and the
first instinct was to put it there. But reading `lore.js` settled it the other way: `findFile()` walks
the LOREPACK index, so `/focus` - the one command whose whole purpose is *put one document in front of
her* - can only name a document that lives in her pack. An RTFM page is unreachable by her by design
("a manual is not a memory"), which is right for the manual and wrong for a briefing he wants her to
read. So the briefing went into `src/lorepack/`, and the pack's README now records it as the single
exception and explains what makes it different from the memory of a scene.

**Canon was refused on purpose.** The mechanism to keep a document in front of her always exists -
`"foundational": true` - and it was tempting, because a budget she always knows is a budget she
respects. But canon is never trimmed for budget: it would sit in her prompt on every single turn, and
paying its tokens on every turn is precisely the behaviour the document warns against. It is left
unmarked, retrievable and focusable, and the flag is named in the document itself so the choice is
his.

**The document is a mirror, and it showed a smudge.** Writing down what each lane costs meant reading
each lane's actual call site rather than trusting its copy. Vision (`images.js` `sightOf/lookBlob`,
`archivax.js` `look`) and the quiet hour (`shift.js` `compose`) both call `root.generateText` - the
`ai-text-plugin`, the house's own text engine - and so do the turn, the check-in and every bus remark.
But four shipped strings told Patrikios those calls were billed "to your key", and one told him the
budget was metered against it. The only lanes that spend one of his keys are the **hearing** lane
(`hear.js`, Gemini, charged by audio duration), the **meaning** lane (`embed.js`, Gemini query
embeddings - one per turn that consults it), and **ElevenLabs** speech (charged by character). The
five strings that claimed otherwise were corrected to match the code - `chat.js` twice, `shift.js`,
`tools.js`, and the `/shift` description in `src/commands/commands.json`, which the generated
cheatsheet does not render (so `rtfm.check()` stays `""`) - because a budget document that disagrees
with the receipts on screen is worse than no budget document.

**What the numbers actually are.** All read from `config.js` and the live engine, not from memory: the
engine's recommended ceiling is 6,000 tokens for the whole prompt (roughly 24,000 characters), read
live from `getMetaObject().idealMaxContextTokens`; memory recall gets 35% of it, clamped to 500-3,000
(~2,100 today); a focused document is handed over whole up to 20,000 characters; one picture read is
about 570 tokens; the rolling archive keeps the newest 1,000 turns; the meaning corpus is capped at
6,000 fragments. The unasked cadences are 45 minutes and once per silence (the check-in), 30 minutes
with 2 an hour and 10 a day (the quiet hour), and 4 minutes with 3 a piece (the bus).

## WHAT IT LEAVES OPEN

The budget is stated, not enforced beyond what already existed. There is **no per-day token meter** for
her turns and **no spend ledger** for the Gemini key - the ceilings are turn-count cadences and
clipping limits, which bound the number of calls but not the characters or the seconds inside them. A
real accounting of what the key has cost, and a hard daily cap on her own turns, are both unbuilt and
both named here rather than pretended away. The not-wired roads are listed honestly in the document
(Lyria music, the key's own TTS and image models, video, `[[HEAR: ...]]`, search over transcripts) so
none of them is claimed by her as a power she has.

## FILES TOUCHED

`src/lorepack/capabilities.md` (**new**), `src/lorepack/lorepack.json`, `src/lorepack/README.md`,
`src/js/chat.js` (two strings), `src/js/shift.js` (one string), `src/js/tools.js` (one string),
`src/commands/commands.json` (one string),
`src/README.md` (+THE POWERS AND THE PURSE), `src/TODO.md` (§1bq), `src/chronicle/chronicle.json`,
`src/pack/files.json` (97 files). `main.pjs` is **UNTOUCHED**.
