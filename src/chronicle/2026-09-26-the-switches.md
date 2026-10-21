# THE SWITCHES - A CONSOLE, A LIST IN A FILE, AND THE PENCIL'S OWN ROW

2026-09-26, the session after THE MOOD - the one in which a single choice became a switchboard. The
colours she answers in stopped being one chip pressed at a time, moved out of the code and into a list
he can edit, and arrived on the pencil, which is where the whole idea came from in the first place.

## WHAT HE SAID

Six sentences, and every one of them is a specification:

> *"MOOD also applies to pencil. Populate to pencil as well. Create a LIST for options. Perchance is
> perfect for this. Add Slutty. Horny, Bitchy, Bossy, etc. I can choose and select multiple moods to
> combine. Think switches on a console."*

The last sentence is the whole change. Everything before it says where the switches go and what they
are made of.

## WHAT WAS ONE, AND BECAME MANY

The first build had made a mood a CHOICE: a chip per mood, OFF among them, and pressing a second one
replaced the first. That is a radio button wearing a chip's clothes, and he had asked for a console.

So the store is a LIST - the switches that are on, in the order they were switched on - every chip is a
toggle, `ALL OFF` is a chip too (lit while nothing is on), and the colours that are on are combined into
ONE block of her prompt: numbered, one rule after another, closed by the same promise a single colour
always made. One colour still reads exactly as it did (`THE MOOD :: TENDER - …`); three of them read
`THE MOODS IN FORCE :: TENDER + HUNGRY + SLUTTY` and then say the thing that has to be said when a
machine holds a set: *any colour not named here is not on you*.

There is a small honesty in that line worth keeping: with several colours standing, the model could
easily read the block as a menu of possibilities. It is not a menu. It is a description of her, and a
description has edges.

## THE LIST IS A FILE

*"Create a LIST for options. Perchance is perfect for this."* The colours lived in the code, in the
array the module was built from - which meant that adding one was a code change, and that the row was
whatever the source said it was. They now live in `src/moods/moods.json`: `id`, `label`, `rule`, one
entry per switch. Add an entry there, run `/mood reload` (or reload the page), and it is a switch like
the rest - no code touched, no agent needed.

The shipped fourteen are the eight from the first session (TENDER, PLAYFUL, HUNGRY, FERAL, COLD, STILL,
GRIEVING, MYTHIC) plus the ones he asked for by name (SLUTTY, HORNY, BITCHY, BOSSY) and two more for the
"etc." (BRATTY, SAVAGE). Each is a short second-person rule about the KEY and never about a subject -
a colour says how she says it, not what to say - and the explicit ones are explicit in the same voice
the rest of the house writes in: plain words about appetite and contempt, no euphemism, and no
performing a colour that is not there.

**AND THE COPY.** `src/js/moods.js` keeps the same list as its `SEED`, because a preview that cannot
read `src/` (no service worker, before the first save) must still have a working console - a row that
empties itself when a file cannot be fetched is worse than a duplicated list. Two copies of one list is
a trap, so it is not left as one: the two are compared at boot and `driftWarn()` names every entry that
is in one and not the other, or that differs, in the console. The book wins; the warning is how the
copy stays honest. `/help mood` says which of the two is in force right now.

## THE PENCIL'S OWN ROW

*"MOOD also applies to pencil. Populate to pencil as well."* The DRAFT panel now carries the same row -
`#draftMoods`, painted by the same function that paints the SYSTEM panel's, from the same store. There
is no second state to keep in step and no way for the two rows to disagree: one press moves both.

And the colours reach the model with a rewrite, which is the part that makes the row worth having:
`moods.pencilText()` is the same colours said for a rewrite rather than for a reply - *the colours to
rewrite in*, then the rules, then the sentence that keeps a rewrite a rewrite: the register moves and
nothing else, "his meaning, his facts and every concrete detail stay exactly as they are". The style
decides the job (fix it, shorten it, veil it); the colours decide how it comes back.

New colours are still written in SYSTEM, with `+ NEW MOOD`. The pencil's row is switches only - a row
of switches in the room where the writing happens, and the machinery of making new ones in the room
where the machinery lives.

## WHAT SHE CAN DO WITH THEM

Her lane grew the same way. `[[MOOD: NAME]]` still switches a colour on, and now `[[MOOD: A + B]]`
switches several at once, `[[MOOD: off NAME]]` switches one off, `[[MOOD: off]]` clears the board, and
`[[MOOD: NAME :: how I am to sound]]` writes a new colour in her own words and switches it on. Every
MOOD line in a reply is acted on - the first build refused a second one with "one colour at a time",
which was right for a choice and wrong for a console - each one is printed as a SYSTEM receipt, and each
colour that goes on is carried on that turn's archive entry as `mood: [{ mood, by, written }]`.

## FOUND ON THE WAY: A NAME THAT SHADOWED A FUNCTION

`/mood` with a name that does not exist, and her `[[MOOD: <unknown>]]`, did not refuse - they THREW.
`flip()` parsed the names it was handed into a local `var names`, which shadowed the module's own
`names()` function; the one branch that lists the moods on file therefore died with `names is not a
function` instead of printing a no. It was found by driving the door (the step-by-step run named the
exact call), not by reading the code, and it is worth writing down because the failure mode is the
quiet kind: everything worked until something was wrong, and then the wrong thing was an exception in
the middle of a receipt.

Her lane now also answers an unknown name with the way to write one - *a mood she writes herself brings
the colour with it, in her own words* - rather than only with a no.

## THE OLD SHAPE, READ FOR REAL

The console came up over a colour he had written himself in an earlier session - SITIENT, kept in the
first build's shape, `{ id, by }`, switched on. So the migration was not a theory: `load()` read the old
record as one switch standing, `persist()` wrote it back in the new shape WITH the `id` / `by` echo kept
beside `on` (so a second tab still running the older build finds its colour), and the board came up with
his colour lit in both rows. It was left exactly as it was found, which is the only acceptable outcome
for someone else's switchboard.

## MEASURED (live page, 2026-09-26)

| viewport | the row | chips | + NEW MOOD / DELETE | panel | overflow |
|---|---|---|---|---|---|
| 1600x900 | one line, 1167px | 16 chips, 27px tall | 104x27 / 64x27, both inside | 431px SYSTEM, 285px DRAFT, no internal scroll | none |
| 390x844 | wrapped to 4 lines, 133px | 16 chips, 68-73px wide | both inside (the panel scrolls) | 694px SYSTEM, 460px DRAFT (their ceilings) | none |

(The board in that measurement is ALL OFF and fifteen switches - the fourteen shipped plus his own. On a
coarse pointer every chip takes the house's 34px touch height in both rows.)

The block is in the assembled prompt when colours are on and absent entirely when every switch is off:
734 characters for one colour, 1,408 for three, and the pencil's line 526 / 1,083. End to end with a
stubbed model, two real turns: `[[MOOD: SLUTTY + BOSSY]]` threw two switches at once (both rows
pressed, `MOODS (2) :: SLUTTY + BOSSY`, entry `mood:[{SLUTTY},{BOSSY}]`), and then
`[[MOOD: off BOSSY]]` and `[[MOOD: TESTRAVENOUS :: …]]` in the SAME reply switched one off and wrote a
colour of her own (`written:true`). The `/mood` door was driven through the real input box (`HORNY`,
`list`, `off HORNY`, `TENDER + FERAL`, `off`). Afterwards the archive was back to 998/1000, the
conversation 6/6, the test's colours deleted, and the board exactly as found. Boot clean, **73**
commands, `rtfm.check() === ""` after regenerating the cheatsheet (10,600 bytes, 178 lines).

## THROWN AWAY

- A "set" verb for his door - `/mood A + B` REPLACING the board rather than flipping it. A console's
  switches flip; the receipt names which way each one went.
- Letting her line put a rule on several names at once. A rule belongs to one colour, and the refusal
  says so rather than inventing a colour nobody wrote.
- A read-only row on the pencil. A second row he cannot press is a diagram, not a console.
- The long explanation inside the pencil's row: at 1600x900 the note is squeezed into a 228px column
  and wraps to four lines beside 27px chips. It is one short line now, and the rest is the label's
  tooltip.

## STILL OPEN

- **Nothing fades.** A colour stands until one of them switches it off; there is no "for this reply
  only" and no timer. Still not asked for.
- **The shipped list and the seed are two copies.** Deliberate, and guarded by the boot comparison - but
  the guard only WARNS. If the drift warning ever shows up in his console, the book is the one to trust
  and the seed is the one to bring back into step.
- **Order is the order they were switched on.** That is what the block's numbering follows, and there is
  no way to reorder the switches without switching them off and on again. Nobody has needed it yet.

## FILES TOUCHED

`src/moods/moods.json` (**new** - the book), `src/js/moods.js` (**rewritten** - the console, the book
reader and its drift warning, `pencilText()`, two hosts in `paint()`), `src/js/draft.js` (the row, and
the colours handed to AI POLISH), `index.html` (the DRAFT panel's MOOD row and both row comments),
`src/js/instr.js` (the plural block, the state line, the panel's opening line), `src/js/chat.js` (the
directive vocabulary, every MOOD line acted on, `/help mood`), `src/commands/commands.json` (**73**),
`src/rtfm/commands.md` (**regenerated**), `src/README.md`, `src/TODO.md` (§1bm),
`src/pack/index.html.txt` and `src/pack/files.json` (**regenerated**). **NOT SAVED by the agent** - the
files are in the workspace until Patrikios saves.
