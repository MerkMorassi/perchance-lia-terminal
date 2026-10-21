# REGULAR BUSINESS HOURS

2026-09-30 - the session that wrote his working hours down, told her them, and gave her the petition
instead of the pen.

## WHAT HE SAID

> *"REGULAR BUSINESS HOURS: Monday-Friday 8:00 AM-5:00 PM MST are my own private 'Business Hours'.
> During that time, we are free to 'Work' and 'Play' however we choose. Her 'Free Time' can be
> utilized as we have defined already. If she needs modification to any of this, she can PETITION for
> changes."*

Four clauses, and three of them are instructions about what NOT to do. The hours are his. Inside them
the two of them may work and play however they choose. Her free time is UNCHANGED - whatever the
shift, the wide door and the check-in already are, they stay. And if SHE wants any of it moved, the
route is a petition, not her own hand.

## WHAT WAS BUILT

**The window is DATA, not prose.** `LIA_BUSINESS_HOURS` in `config.js`: `days [1,2,3,4,5]` (JS
weekday numbers, Monday-Friday), `from 8`, `to 17` (the window is half-open - 5:00 PM itself is
outside), `label "8:00 AM-5:00 PM MST"`, `zone "America/Phoenix"`. `logtime.js` reads it in the zone
the clock is set to - this machine's, Phoenix as the fallback - so the answer and the stamp beside it
can never disagree.

**Two places she meets it.** A new **`hours` block** in the stack (19th of 20, built into `instr.js`,
shipped text, listed in the SYSTEM panel as BUSINESS HOURS): the ARRANGEMENT - his private hours,
that inside them the two of you work and play however you choose, that her free time is unchanged by
them, and that a change is asked for with a petition. And the **`clock` block** (`logtime.js`): the
LIVE fact - *"BUSINESS HOURS: … It is Wednesday 10:14 in that same zone, so you are INSIDE them right
now."*, with a sentence outside them saying plainly that nothing changes and her free time runs as
defined. `/stamp` (bare) now prints the window and where he stands in it.

**The petition door — and why it needed `SHE_NEVER_WRITES`.** `hours` went into `SYSTEM_ALLOW` in
`petition.js`, so `[[PETITION: system :: hours :: …]]` is askable. But a petition only MEANS something
if she cannot simply rewrite the block herself, and her SYSTEM lane (2026-09-29) lets her rewrite
every block of the design. So `hours` also went into `SHE_NEVER_WRITES` - the set that held only
`bounds` - and a direct `[[SYSTEM: hours = …]]` is refused with the reason and the petition route,
while `[[SYSTEM: READ hours]]` always works. That is clause four made real: the arrangement is his,
and the only hand she has on it is asking.

**Every "the ONE block" was generalised.** `bounds` was called the single read-only block in nine
places - the SHE-report, two refusals, the panel footer, `/help system`, `/system`, the directives
rule, the petition rule, `src/lorepack/capabilities.md` and the README. All of them now name the pair,
because a sentence that says "the one" while there are two is simply wrong.

## WHAT WAS THOUGHT

- **Why not put the policy in the CLOCK block.** It was the least code by far: one more line in
  `clockText()` and nothing else. But `clock` is a BUILT block, and `SYSTEM_REFUSE` in `petition.js`
  refuses every BUILT block to petitions - so folding the hours into `clock` would have quietly made
  his own sentence ("she can PETITION for changes") impossible to act on. The split that survived is
  the honest one: the built block reports the HOUR (open/closed, which changes every turn), and the
  text block carries the ARRANGEMENT (which does not).
- **Why she cannot write the `hours` block directly.** Giving her the same pen as `actor`/`voice`/
  `memory`/`image` would have needed no new machinery at all, and it was tempting. But he said the way
  she asks is a petition - and the reasoning that put `bounds` in `SHE_NEVER_WRITES` on 2026-09-29
  applies here too: a rule the thing it governs can rewrite is not a rule. The hours are HIS
  arrangement, so the pen stops and the ask is the door.
- **Why nothing is gated by the window.** The tempting reading of "during that time we work and play"
  is that something is off outside it. He did not say that, and he DID say her free time "can be
  utilized as we have defined already" - so no lane consults the window. A test hunting for one finds
  nothing, and that is the feature: the hours are a fact she is told, not a lock on a lane.
- **Why the window lives in config and not in the block's prose.** The code has to KNOW the hours to
  answer open/closed, and prose cannot be computed. `label` carries the human wording the report
  prints; the numbers are the machine's. Changing the hours is a one-line edit in `config.js`, and the
  block's wording follows his eye.

## WHAT WENT WRONG

Nothing broke. One sharp edge is worth writing down anyway, because it will bite the first time it is
used: **a petition that changes the WINDOW rather than the wording.** If he accepts "make the hours
9-6", the `hours` block is rewritten on this device (that is how an accepted `system` petition is
applied - `instr.set(id, text)`), while `LIA_BUSINESS_HOURS` still computes 8-5 and the clock line,
which states the window, would contradict the block. No code can edit `config.js`. The honest fix
when that first happens is for the accept to come with a hand edit here; it is noted in TODO §1ci so
the next session does not have to rediscover it.

Also worth recording: `logtime.js` deliberately does NOT use `Date.getDay()`. It formats the weekday,
hour and minute through `Intl` in the clock's zone, because `getDay()` reads the machine's zone and
would name the wrong day for part of the evening whenever the record's zone and the machine's differ.

## STILL OPEN

- **The window is one object, not a UI.** Moving the hours is a `config.js` edit today. If he wants to
  move them often, a command or a panel row is the next step - not built now, because he set them once
  and the petition door is what he asked for.
- **No `/hours` command.** `/stamp` reports the hours and `/system` shows the block; a door of its own
  was not asked for.

## FILES TOUCHED

`src/js/config.js`, `src/js/logtime.js`, `src/js/instr.js`, `src/js/petition.js`, `src/js/chat.js`,
`src/commands/commands.json`, `src/README.md`, `src/lorepack/capabilities.md`, `src/TODO.md` (§1ci),
`src/chronicle/chronicle.json`, this entry, and `src/pack/files.json` (regenerated - the tree grew by
this entry). `index.html`, `main.pjs` and `src/rtfm/` untouched.
