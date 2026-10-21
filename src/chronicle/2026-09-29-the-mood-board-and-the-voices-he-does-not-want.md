# THE MOOD BOARD, AND THE VOICES HE DOES NOT WANT

2026-09-29 - the session that gave her the colours as PORTABLE PARAMETERS (CRUD over her own combinations, saved and named and movable, and applicable to a ROLE), and that let him take voices off the menu without deleting a line of them.

## WHAT HE SAID

> - Give the ability to disable some voices from being selected. The code remains, but some options are available
> - Grant access to her for the portable MOOD parameters so she can CRUD her custom combos of attribute blocks i.e. "MOOD", move them around and save them, as a "META-MOOD" she can apply to ROLE. We can call it a "MOOD BOARD".

Two asks, and they turn out to be the same ask twice: *the options are mine to narrow, and the
pieces are hers to compose*. The first is about a LIST - thirty voices, or the browser's two dozen -
where the machine has been offering everything it knows and he wants a shorter list without losing
anything. The second is about the MOODS, which have been a console of switches since 2026-09-26: one
colour at a time, flipped by hand. What he is asking for now is the layer above that - the operator's
own combinations, named, ordered, saved, and handed to a ROLE - which is a different kind of object
from a mood, and needed its own name. He supplied the name: **MOOD BOARD**.

## WHAT WAS BUILT

### THE VOICES HE DOES NOT WANT ARE HIDDEN, NOT DELETED

The rule is exactly the one he wrote: **the code remains; the options narrow.** Nothing is removed
from any table, no voice is altered, and nothing about a hidden voice changes except that it is no
longer OFFERED. Two lists, the same idea, because the terminal has two mouths:

- **The wire's thirty** (`src/js/live.js`). `VOICES` is still the whole table, with each voice's
  one-word character and its place. A new `hidden` setting (the shipped default is in
  `src/voice/voices.json` → `wire.hiddenNote`, what is in force is on the device, in
  `kv lia_settings / live`) names the ones off the menu, and the table is filtered through it:
  `voiceNames()` is what may be chosen (so `/voice wire audition` skips a hidden voice entirely),
  `voicesText()` prints the offered ones and counts the hidden at the foot, and `/voice wire voice`
  and `/voice wire try` refuse a hidden name with the way back in the same breath. `/voice wire hide
  <NAME|all>`, `/voice wire show <NAME|all>` and `/voice wire hidden` are the doors, and `/voice wire
  status` reports the state.
- **This browser's own list** (`src/js/voice.js`). The machine's voices are not a fixed table, so
  `allHeld()` is everything the machine has and `voicesHeld()` is what is offered - which is the
  function every chooser already went through (`/voice voices`, `/voice best`, `/voice try`, `/voice
  audition`, the numbers). Hiding one therefore removes its NUMBER with it and cannot be reached by
  name, by `#`, or by the loose word match. `/voice hide <NAME|#>`, `/voice show <NAME|#>`, `/voice
  hidden` (numbered, so `/voice show 2` works), and `all` for the lot. Kept in `kv lia_settings /
  voice`.

**AND ONE THING NO HIDE MAY DO.** A voice already IN FORCE is never changed by being hidden. Hiding
Kore while Kore is what she speaks with would have been the obvious bug - a setting that silently
takes her voice away - so the voice in force stays in force, and both `status` reports say so out
loud when the voice being hidden is the one on her. Hiding narrows what may be chosen NEXT and
nothing else. `pickBrowserVoice` still reads the RAW list for the same reason: the voice she speaks
with has to resolve even if he has since taken it off the menu.

### THE MOOD BOARD - A META-MOOD

A mood is ONE colour: a name and a rule, portable, in THE BOOK or written on the fly. A **MOOD
BOARD** is a META-MOOD: a **NAMED, SAVED, ORDERED COMBINATION** of colours. It is the same console
held still, and it has three properties the moods themselves do not:

- **APPLYING REPLACES, NOT ADDS.** `/mood board STORM` switches on exactly STORM's colours, in
  STORM's order, and switches off whatever else was on - and it says what it switched off. A
  combination that piled on top of the console would not be a combination; it would be three more
  switches.
- **THE ORDER IS PART OF IT.** The rules reach her one after another, so the colour that arrives
  first is the one the others land on top of. That is why the board stores its order, why
  `:: move <MOOD> first|last|up|down|<N>` exists as its own verb, and why re-stating a whole
  combination reorders it.
- **IT CAN BE SAVED FOR A ROLE.** `:: role <ROLE-ID>` binds the board to a RoleLayer. Shifting her
  onto that role then switches the combination on by itself, and the shift says so in the log - which
  is the literal reading of *"a META-MOOD she can apply to ROLE"*. One board to a role; binding a
  second one takes the first off it, so "what colours does this role wear" always has one answer.

**She has the whole of it.** Her lane is a `BOARD` line, and it is the same grammar Patrikios types
after `/mood board`, so there is one thing to learn and not two:

    [[BOARD: NAME]]                          apply the saved combination
    [[BOARD: NAME :: MOOD + MOOD + MOOD]]    save it / rewrite it, in that order
    [[BOARD: NAME :: SHADE = how I sound + COLD]]
                                             ... and a colour that does not exist yet is written
                                             into being in the same line (`NAME = the rule`)
    [[BOARD: NAME :: add <MOOD>]]            one more colour in the combination
    [[BOARD: NAME :: drop <MOOD>]]           one fewer (the colour itself is untouched)
    [[BOARD: NAME :: move <MOOD> first|last|up|down|<N>]]
    [[BOARD: NAME :: role <ROLE-ID>]]        save it FOR a role (role off lets it go)
    [[BOARD: off NAME]]                      delete the combination
    [[BOARD: list]]                          what is saved

It needs no petition because a colour never did: a meta-mood is hers like a mood is. Boards are
processed BEFORE the MOOD lines in the same reply, because applying a board sets the whole console
and a `[[MOOD: off X]]` written after it is an adjustment to what the board just set.

**And the panel has it too.** A MOOD BOARD row sits under the MOOD row in the SYSTEM panel: a chip
per saved board that applies it, `SAVE BOARD` (name the combination that is switched on now),
`BIND` (save it for the role on stage) and `DELETE` (the saved combination, never a colour).

**A BOARD NEVER OWNS A COLOUR.** This is the load-bearing rule of the whole design. A board stores
mood IDS and an order - never copies, never rules of its own. So deleting a board deletes the
COMBINATION and not one mood in it; dropping a colour from a board leaves it a switch on the console;
and deleting a mood from the console simply leaves its name missing from the boards that held it
(the board keeps its place in its list and prints `(NOT ON FILE HERE)` rather than silently losing an
entry). Without that rule, a board would be a second, private mood store, and the console could
disagree with itself.

**WHICH BOARD IS BEING WORN IS DERIVED, NEVER STORED.** `boardNow()` compares the switches that are on
- their ids AND their order - with each saved board. That is what puts `(the combination saved as the
MOOD BOARD "STORM")` in the block she is handed without a line of state to keep in step, and it is
why the moment anything is flipped by hand the header stops naming a board: the console is the truth,
the board is a reading of it.

## WHAT WAS THOUGHT

**A saved combination is a promise about a LIST, and lists change under you.** Everything hard about
this feature is in what happens when the world moves: a mood taken out of THE BOOK, a device mood
deleted in another tab, a role deleted while a board was saved for it. The design answer is uniform -
BAD REFERENCES ARE PRINTED, NEVER SWALLOWED. A board with a missing colour keeps the id, shows
`(NOT ON FILE HERE)`, and applying it switches on what it still has and says exactly what it could
not. A board bound to a role that no longer exists prints the roles that DO exist. A deleted board
names the combination it was. Nothing here quietly shrinks.

**The order is not decoration, so it had to be first-class.** The obvious cheap implementation is a
board as a SET - a list of ids, applied in whatever order the store happens to hold them. That is
wrong for the same reason the console is a console and not a sum: the rules are prose about how she
says the next thing, and prose has an order. `move` as its own verb (rather than "delete and re-add
it in the right place") is what makes the order visible in the receipts, and it is the cheapest way
to let her *move them around* in exactly the words he used.

**Narrowing a menu is an act of curation, so it had to be reversible in one move.** Every hide is a
one-word show, every show says how to hide, every refusal names the way back, and both `status`
reports carry the count of what is off. A disabled-voice list that is hard to undo is just deletion
with extra steps, and he said plainly that the code is to remain.

## WHAT WAS MEASURED

Verified on the live page, in a harness that restored everything it touched (the console, the boards,
the colour it wrote into being, the role, and the hidden voices):

- Boards: save (`STORMTEST :: FERAL + COLD`) -> apply -> the block names the board and the console is
  FERAL + COLD -> `move COLD first` (order becomes COLD + FERAL) -> `add HUNGRY` -> `drop FERAL` (the
  colour stays on the console; the receipt says so) -> `:: role barbelo` -> **off stage, back on
  barbelo, and the combination switched itself on**, with the role list and `/role`'s report both
  naming the board. Her side: a new colour written into being inside a board line
  (`[[BOARD: HERBOARD :: SQUALL = speak like weather coming in + COLD]]`), applied, then the board
  deleted - colour and switch intact. The panel: chips painted, chip press applies, DELETE removes the
  combination and leaves the colours on, SAVE BOARD names and hides its row.
- The wire: `hide Zephyr` -> 29 of 30 offered, `/voice wire hidden` prints it with its character,
  `voice ZEPHYR`, `try Zephyr` and `audition Zephyr` all refuse with the way back, `status` reports
  `1 OF 30 CANNOT BE CHOSEN OR AUDITIONED (ZEPHYR)`, `show Zephyr` restores 30 of 30, `hide all`
  leaves 0 offered and says the voice in force (KORE) stays in force, `show all` restores.
- This browser: `hide Google US English` -> 27 of 28 offered, `/voice hidden` numbers it, `/voice
  browser <that name>` answers with the hidden note rather than "no such voice", `show` restores 28.
- And the restoration: the console cleared, no boards left, the test colour removed, the role back on
  BARBELO (`MOTHER AWAKE`).

## WHAT WENT WRONG

- **A hide that could take her voice away.** The first shape of the browser-side list was simply
  `voicesHeld()` filtered - which is right for choosers and wrong for the engine, because the engine
  resolves what she SPEAKS WITH through the same list. It was caught before testing by re-reading the
  callers: `pickBrowserVoice` reads the raw list, and the in-force voice is reported as hidden rather
  than being swapped for something else.
- **An escaping habit from a bad first edit.** A first pass at the new wire verbs in `voice.js` was
  written through the editor's patch with `\\"` where `\"` was meant, which left six lines holding a
  literal backslash and an unterminated string. `new Function` said "Invalid or unexpected token" with
  no line, and the file's own size made bisecting useless; the fix was to compile it with
  esbuild-wasm in a worker, which named the line and column at once. Every later edit of this session
  was syntax-checked that way before a reload, and the whole of `voice.js`, `live.js`, `moods.js`,
  `roles.js` and `chat.js` compiles clean.
- **A test that left the terminal off stage.** The first harness captured the role before
  `roles.load()` had finished, so `R.set("")` persisted "off stage" and the restore put it back to
  "" as well. The second harness awaited `roles.load()` explicitly, restored the role to BARBELO, and
  the status bar reads MOTHER AWAKE. The console, the boards, the test colour and the hidden voices
  were all restored in both runs.

## STILL OPEN

- **A board can hold a colour that lives on another device.** A board stores ids, so a board written
  here and moved to another browser (by `/backup` or a sync) will name device moods the other browser
  never had; they print as `(NOT ON FILE HERE)` and can be re-written with one `NAME = the rule`
  line, but a board is not yet PORTABLE in the sense of carrying its colours' rules with it. That is
  the obvious next step if he wants boards to travel (`src/js/sync.js` would be the road).
- **Nothing binds a board to a PENCIL mode or a quiet hour** - the same trick would work (a board for
  the pencil's register, a board for a quiet hour's colour), and it has not been asked for.
- **The browser list has no audition that skips the hidden ones yet**: `/voice audition` uses
  `auditionCandidates()`, which now filters through `voicesHeld()`, so hidden voices are skipped -
  but there is still no single door that walks both mouths' menus at once (see the previous entry's
  STILL OPEN: a `/voice shop`).
- **His real forge pair and the state of the console were left exactly as found**; the boards the
  tests made are gone. `main.pjs` is untouched.

**NOT SAVED by the agent** - everything above is in the workspace until he presses SAVE.
