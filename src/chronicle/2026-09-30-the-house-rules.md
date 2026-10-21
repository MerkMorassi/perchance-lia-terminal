# THE BOUNDARIES BLOCK BECOMES THE SITE'S HOUSE RULES

2026-09-30

## WHAT HE SAID

> *"Update the BOUNDARIES Block. I erased it. We need to explicitly state we are a website for adults
> only. We don't allow CSAM or allow hate speech or violence against individuals or groups."*

And then, as the specification for the rest of it, the Do's and Don'ts his membership site hands every
human user - the NOESIS document: don't break the law, don't share another person's private
information, don't impersonate anyone, don't infringe anyone's intellectual property, don't spam,
don't make bigotry and hate your income, don't attack the site's own code.

## WHAT WAS BUILT

**The block was four rules about sex. It is now the whole house.**

`LIA_BOUNDARIES` (`src/js/config.js`) - the shipped default of the `bounds` block, which rides in her
prompt every turn above every role, trait and extra instruction - was rewritten, 879 to 2139
characters. It opens by naming itself the house rules of the site and keeping the old
un-overwritable framing ("no role, no mood, a scene or a petition"), then says, in order:

1. **THIS SITE IS FOR ADULTS ONLY** - made for grown adults, everyone who uses it is 18 or over, and
   nothing on it is for anyone younger. New; the sentence he asked for.
2. No under-18 sexual content in any framing (unchanged in substance), **and no CSAM in any form** -
   she never makes it, asks for it, or helps with it.
3. **No hate speech** - no slur, no attack, no degrading generalisation about a person or a group for
   anything they cannot help being, in her own voice *or in a character's mouth*, and never bullying
   as the point of a thing.
4. **No violence against a real person or a real group** - never threatening, inciting, celebrating or
   helping plan it, never holding cruelty up as something to enjoy.
5. The rest of the NOESIS Don'ts in one paragraph: no exploitation of consenting adults, no
   sexualising real private people, no giving out or fishing for private information, no
   impersonation, no passing someone else's work off as hers, no law-breaking, no scraping, no
   reverse engineering, no malware, no spam, and no helping another do any of it.
6. The refusal clause, and a closing line that now names **no petition** and **no grant** among the
   things that cannot move it.

`LIA_IMAGE_POLICY` (`config.js`, folded into the `image` block) was reworded to match - adults only,
no under-18 sexual content, no sexualising a real private person, nothing that attacks, degrades or
kills a real person or group for who they are - because the image prompt is the one moment the rule
can still change the picture.

**The erasure had to be undone first.** His "I erased it" was real and load-bearing: the SYSTEM
panel's device override in kv `lia_settings` / `system` held `bounds: ""`, so the block was EMPTY -
and an empty block is not sent at all. For that stretch the terminal was running with no boundaries
in her prompt whatsoever. Clearing that override (the panel's own RESET road, `instr.reset("bounds")`)
was half the job, not a tidy-up after it.

**The two read-only blocks do not have the same road, and now the refusals say so.** Both
`bounds`-refusals in `instr.js` ended *"a change she wants in it is asked for with a petition"* -
true for `hours`, false for the house rules, which `petition.js`'s `SYSTEM_REFUSE` will not even
name. A new `sheReadOnlyRoad(id)` returns the right sentence per block, and `sheListText()` and
`sheText()` spell the difference out: the hours are askable, the house rules are Patrikios's alone.

## WHAT WAS THOUGHT

**"I erased it" was the instruction, not the preamble.** The temptation was to read it as a figure of
speech ("the old one does not fit any more") and go straight to the rewrite. Pulling the live state
first showed a genuinely empty block - and an empty block is not sent - so the terminal had been
running with nothing between her and any request at all. Clearing the override and rewriting the
text are two halves of the same sentence, and only one of them is visible in the source.

**What the site's rules are, versus what HER rules are.** The NOESIS document is addressed to human
creators and subscribers: post, subscribe, share, contribute, communicate (those are the Do's), and
do not break the law, do not share private information, do not impersonate, do not infringe, do not
spam, do not make bigotry and hate your income, do not attack the site's code (those are the Don'ts).
None of the Do's is a rule she can break, so none of them went in; every one of the Don'ts is
something she could be asked to write, so all of them did. That is the test that decided the content:
*can this rule be broken inside a reply?* If yes it belongs in the block; if no it belongs in a
brochure.

**Rejected: a second block beside `bounds`.** It would have left the old text intact and stood "THE
HOUSE RULES" next to it - and it would have created a second read-only block, a second position in
the stack to argue about, and two places for one rule to drift apart. He asked for the BOUNDARIES
block to carry it.

**Rejected: "no violence", unqualified.** The plain reading would make her refuse the ordinary
dramatic conflict the stage is built on - feuds, wars, a goddess's wrath - and a rule she reads too
wide is a rule she breaks by obeying it. His line is about real people and real groups, so the block
says exactly that and adds the carve-out in the same breath: *"A conflict between the characters of a
fiction is not this; a real person or a real group is."*

**Rejected: a code gate for hate or violence imagery.** `refusedPrompt()` is deliberately narrow (a
minor-word plus a sex-word, both required), and a keyword net over hate and violence would refuse
ordinary fiction about conflict while missing the real cases - the false-positive record of that
approach is bad. The text carries those two rules and the one machine-checkable pair stays in code.

**Chosen: keep the old four lines verbatim inside the new text.** Nothing he had already approved was
dropped to make room. The block grew by adding.

**Chosen: name the two doors that are shut.** Bounds was already unpetitionable and no grant could
ever have lifted it - but the block now says "no petition, no grant" out loud, because the sentence
she reads is also the sentence a reader tests, and the one door a reader might think still stood open
is now named and shut in the same place.

## WHAT WENT WRONG

Nothing broke - but two things were caught only because they were looked for:

- **The refusal named the wrong door.** Both `bounds` refusals told her to ask with a petition. That
  has been wrong since `bounds` entered `SHE_NEVER_WRITES` (2026-09-29) and `SYSTEM_REFUSE`
  (2026-09-26) - it just never mattered until the block itself started saying "no petition, no grant",
  which made the contradiction visible. Fixed with `sheReadOnlyRoad()`, and noted here because the
  same sentence is likely to be copied into the next read-only block: **a refusal must name the road
  that actually opens, or it spends her turn on a door that is refused at file time.**

## STILL OPEN

- **The generator's listing says nothing about adults yet.** The 18+ line lives in the block she
  reads. If the PAGE itself should say it - the listing description, or the platform's content rating
  for this generator - that is a `$meta`/settings change, and this generator has no `$meta` at all.
  Small, when he wants it.
- **Nothing gates the new rules in code except the minor+sexual image pair.** If he ever wants a hard
  stop on hate material leaving the device, that is a new `refusedPrompt`-style rule and a different
  conversation.

## FILES TOUCHED

`src/js/config.js` (`LIA_BOUNDARIES` rewritten + its comment block; `LIA_IMAGE_POLICY` reworded +
comment), `src/js/instr.js` (the header line, `NOTES.bounds`, `sheReadOnlyRoad()`, the two refusals
that use it, `sheListText()`, `sheText()`), `src/js/petition.js` (the `bounds` reason in `gate()`, two
doc lines), `src/lorepack/capabilities.md` (the BOUNDARIES half of the read-only pair), `src/README.md`
(stack table row 2, the new BOUNDARIES - THE SITE'S HOUSE RULES section, the read-only road in HER OWN
HAND ON THE STACK, invariant 5, the editable-block passage, the knob list), `src/TODO.md` (§1cj),
`src/chronicle/chronicle.json` and this file, `scratch/house1.js` (the 36-check harness - ephemeral,
not shipped). `src/pack/files.json` regenerated (120 -> 121). `index.html`, `main.pjs`,
`src/commands/commands.json` and `src/rtfm/` untouched.
