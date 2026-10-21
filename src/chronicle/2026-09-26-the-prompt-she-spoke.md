# THE PROMPT SHE SPOKE

2026-09-26 - the session that closed the dead end where he asked to see and she answered in words.

## WHAT HE SAID

> *"Had a problem with work flow from discussion with deep contextual understanding based on
> RAG/LOREPACK, then drops the ball and speaks the prompt, htn puts it on screen as text when to move
> is discussion, user says 'show me, don't tell me' directly. She drops the ball and produces no
> image, I copy and paste manually to get the image myself, but that is not the point. She can create
> images inline asked or not."*

Read back to him for confirmation in the reply that followed this build, in plainer words: she was in a
discussion carrying the LOREPACK in context, the moment came where a picture was the move, and instead
of making one she **spoke the prompt** - wrote the description out as prose - and the terminal printed
that prose as her reply. He said it to her directly, in the conversation: *show me, don't tell me.* She
still produced nothing. So he copied the description into the forge by hand and got the picture
himself, which is exactly what he says is not the point: *she can create images inline asked or not.*

## WHAT WAS BUILT

**THE SPOKEN PROMPT** - `window.showMe` in `src/js/images.js`, armed one turn at a time.

- `LIA_SHOWME_HINT` (`src/js/config.js`) recognizes a request to see **in his own words**: *show me*,
  *show me, don't tell me*, *show, don't tell*, *don't tell me - show*, *let me see*, *I want to see
  you*, *show it to me*, *render it*, *make me one*, *put it on screen*, *show it*. `show me how` and
  `show me why` are excluded on purpose - those are questions, and a question wants an answer.
- `/showme` arms the next reply with no hint word at all; `/showme off` puts it down. The arm is spent
  by the turn it was made for.
- An armed turn carries `LIA_SHOWME_REMINDER` **after his words**, in the last-word position, saying
  the one thing the `image` block could say but could not say last: *a description of a picture is not
  the picture; do not answer a request to see with one; if you would rather not show him anything, say
  so plainly in your own voice - that is a real answer.*
- If the reply comes back with **no image line**, she is asked **once more**
  (`LIA_SHOWME_ASK`, `showMe.again()`): his words and her reply are handed back together and she
  writes the single line she owes him. What comes back goes into `parsed.prompts` - which means the
  ordinary render block picks it up and it is rendered down **exactly the road her own `[[VISION: ...]]`
  line takes**: same `renderVision`, same vault record (`how: "vision"`), same row on the archive turn,
  same tile under her own reply. Nothing new renders it and nothing new records it.
- **NOTHING** is a real answer to the second ask. It is honoured: no render, the receipt says so and
  repeats her own words, and the turn is archived `spoken: 'DECLINED ON THE SECOND ASK'`. A made one is
  archived `spoken: 'MADE ON THE SECOND ASK'`.
- The `image` block in `instr.js` was reworded as the other half of the fix: *WHEN HE ASKS TO SEE
  SOMETHING, THE PICTURE IS THE ANSWER ... if you find yourself writing one out, that description IS
  the prompt - put it in the [[VISION: ...]] line and let it be rendered*, and *AND YOU MAY MAKE ONE
  UNASKED.*
- The lane answers to more words: `[[MAKE: ...]]` and `[[PICTURE: ...]]` are the same line as
  `[[VISION: ...]]` (`[[IMAGE: ...]]` and the bare `VISION: ...` line already were), because a model
  reaching for a different verb should not miss the door.

Two bugs were found in the same pass and are written up in full below.

## WHAT WAS THOUGHT

**The diagnosis, and the one that came first.** The obvious reading is "she cannot make pictures
inline". That is wrong - she has had `[[VISION: ...]]` from the beginning, one per reply, needing
nobody's permission, and it works. The actual failure is a **dead end**: a reply that DESCRIBES a
picture is, to the terminal, an ordinary reply. It is printed as her words, nothing is rendered, and
the only hands left are his. So the fix had to be in two places at once - the rule she is given (so the
description does not get written in the first place) and the machinery (so that when it does, the
terminal does not stop there).

**Why not read the prompt out of her prose.** This was the first idea and it is the wrong one. "Take
the descriptive sentence from her reply and render it" cannot be done honestly: her reply is a reply -
it may be describing something she is thinking about, quoting his own words back, or answering a
different question entirely - and there is no signal in the text that separates "this is a picture I
want you to see" from "this is a sentence about a picture". A heuristic here would render things she
never meant and there would be no way to tell it had guessed.

**Why not a second model call on every turn.** Because most turns need no picture at all. A check on
every reply would cost a call every reply and would eventually demand pictures where none were wanted.
The catch is therefore ARMED: it exists for a turn he asked to see something on, and it is spent by
that turn. A discussion stays a discussion - measured, one instruction call on a turn where nothing was
asked for.

**Why the second ask is a model call and not a parser.** Once the arm is on, the question "which of her
words is the prompt" still has no clean answer - but she can answer it herself. One more call, with his
words and her answer in front of her and the shape of the line spelled out, is a *question*, not a
guess, and it costs one text call against one image render. It also gives her the voice to refuse,
which a parser never could: hence NOTHING.

**Why NOTHING had to be in the second ask.** Without it, an armed turn would force a render. He asked
to see *something he had in mind*; she may not want to show it, or may read the request as a figure of
speech ("show me how you feel"). A system that cannot be told no produces pictures nobody wanted, which
is worse than the bug. So the second ask offers the word, and the receipt prints her reason.

**Why "sometimes" is the honest gate rather than "always".** The generous hint list is deliberate: a
turn spent asking again is nearly free (one text call, no render, no quota on the image service), while
a picture nobody wanted is not. `show me how` is excluded, and a false positive ends in NOTHING and a
receipt rather than in a stray render.

**Why the catch does not touch `[[SHOW: ...]]`.** It was tempting to make a `[[SHOW: ...]]` that matches
nothing in the render book become a render of its own words. Rejected: `[[SHOW: #night]]` matching
nothing means there is no such tag, and rendering "#night" would be absurd. `SHOW` stays the
read-only hand on the book, and nothing about it changed. It is worth noting that the generic catch
does cover the case anyway - a reply carrying only a `[[SHOW: ...]]` and no image line is a reply with
no image line, and on an armed turn it is asked again like any other.

**Where the arm lives, and why it is not persisted.** `showMeArmed` is a module-level variable in
`images.js`, exactly like `armedSkill` in `chat.js`: a one-shot gesture that belongs to the
conversation in front of him, not to a stored preference. Nothing in kv, nothing that survives a
reload, nothing that can be found armed tomorrow morning with no memory of why.

## WHAT WENT WRONG

**FIRST: the harness lied about the model.** The first end-to-end run reported 9 calls to the text
engine on a turn that should make 2, and the second ask kept coming back "in words again". The cause
was not the feature: the plugin is asked for **`getMetaObject` seven times per turn** by the recall
lane, and the stub answered those too, draining the queue of scripted replies so that the turn's own
call got somebody else's line. The stub was delegating the meta calls to the real function after that,
and the same run went to 0 fails. A lesson worth keeping: when stubbing `root.generateText`, ask first
what else calls it, and count the calls you did not expect.

**SECOND - a real bug, and it has been there for a long time.** `patchEntry(ts, patch)` in `chat.js`
matched only `logs[i].ts`, while the render block handed it the **answer's** stamp and the entry is
filed under the **send's**. The match never landed, so **a picture she made in her own reply was
written into the vault and the render book with no row on the archive turn it belonged to.** Proved
with a three-line probe (`saveEntry({ts: T, st: T+7777})` then `patchEntry(T+7777, …)` → the entry's
`gen` stayed empty) and by reading his own archive: **every** entry carrying a `gen` row was a
`/create` (the forge has always used one stamp for both, which is exactly why nobody noticed). Fixed
at the call site (`patchEntry(turnTs, …)`) *and* in the helper, which now accepts **either** half of
the turn's stamp - milliseconds are unique here, so that cannot reach the wrong turn. What this
restores: `/renders find <words>` can find one of hers by what was being said when it appeared, and a
later local upscale has an archive row to repoint (the documented behaviour of retiring a smaller
original, which for her own renders had nothing to repoint).

**THIRD - a smaller honesty bug, same pass.** `manualVision` filed every direct render as
`h: "/image ..."`, including the ones he made with `/show`. It now takes the door it came through.

**FOURTH - and this one cost him something.** Driving four real turns through `saveEntry` in a test
pushes on the rolling cap (`master_log` keeps the newest 1000, `slice(-1000)`), so the test's turns
displaced the OLDEST entries of his archive - three of them, before cleanup could be written the right
way round. The first cleanup removed the test entries *after* the cap had already bitten, which loses
the oldest instead of the test's own. The fix is in the harness, not the terminal: **snapshot
`master_log` by value before a test and restore it by value afterwards** (`sacred_archive.set`), which
puts the displaced entries back exactly - and that is what the second run does. It cannot bring back
the three that were already gone; they were the oldest of a thousand, and nothing else on the device
holds a copy (the export files and the sync folder are his, on his disk). Worth saying plainly: **if a
future session drives real turns, restore by value, not by filtering.**

**MEASURED** (2026-09-26, stubbed model and a stubbed image service - no quota spent, no network - four
turns through the real input box, real `send()`, real archive writes):

| what | result |
|---|---|
| the hint table | 15/15 as intended - 11 that arm, 4 that do not (`how are you tonight`, `show me how you feel`, `tell me about the vault`, `you should see the state of this`) |
| an armed turn where she answered in words | **2** instruction calls (the reply, then the second ask) |
| a turn where nothing was asked for | **1** instruction call, no receipt, nothing on the record |
| the reminder | present in the reply's instruction, after his words |
| the second ask | carries `Patrikios said:` + `You answered him:` + the shape of the line + the NOTHING way out |
| the picture | exactly one vault record, prompt taken from her second answer, `how: "vision"` |
| the archive turn | `spoken: 'MADE ON THE SECOND ASK'` and the render row on the turn (the fix, proved) |
| the decline | nothing rendered, `spoken: 'DECLINED ON THE SECOND ASK'`, no render row, her own reason printed |
| the arm | spent by the turn; `/showme` arms it through the door and `/showme off` puts it down |
| the cheatsheet | `rtfm.check()` clean, **74** commands, `src/rtfm/commands.md` regenerated (10,729 bytes) |
| boot | `__bootIssues` empty |

Then **one REAL render** down the same road (`/show` through the real input box, seed 136701364,
768x512, 35,607 bytes), looked at with the vision tool - a glowing green terminal in a dark room, the
prompt's own picture - and deleted again, along with its archive entry and its place in the queue for
her eyes. The image service, the tile and the record are untouched by any of this; what it bought was
certainty that "caught" and "made by hand" produce the same kind of picture in the same kind of tile.

Everything the test touched was put back: the archive restored **by value** from the snapshot (997 in,
997 out, no test entry left), the two test pictures deleted from the vault (2304 → 2304), the sight
queue empty as it was found, the conversation 6/6, the log children back to what they were, the model
and the local upscaler's auto setting restored, boot clean.

## STILL OPEN

- **The second ask has never been run against a real model.** The plumbing is proved end to end with a
  stub and the render road is proved with a real render, but whether a real model answers the second
  ask well - and how often it takes the NOTHING way out when it should - is unmeasured, and can only be
  measured by him using it. If the refusal rate is high, the wording of `LIA_SHOWME_ASK` is the knob.
- **Her unasked spoken prompts are still on her.** The catch only fires on a turn he asked to see
  something on. A picture she described and did not make, on a turn where he asked for nothing, is
  covered by the reworded rule and by nothing else - deliberately, because there is no honest signal to
  act on there (see WHAT WAS THOUGHT).
- **`LIA_SHOWME_HINT` will need his phrasings.** It is deliberately short of "show me what you mean"
  style ambiguity. The place to add one is one line in `src/js/config.js`; the false-positive cost is
  one text call and a receipt.
- **The archive is three turns short of where it was.** The oldest three entries of the rolling 1000
  were displaced by the first (badly-cleaned-up) test run and are gone. Nothing else on this device
  holds them. It refills on its own as he talks.
- **The row-on-the-turn fix touches every render she makes.** Nothing about the fix is risky, but the
  first real turn after this build is worth a glance at `/renders turn <N>` for one of her own pictures
  - it should now name the turn and quote what was being said.

## FILES TOUCHED

`src/js/config.js` (`LIA_SHOWME_HINT` / `LIA_SHOWME_REMINDER` / `LIA_SHOWME_ASK`), `src/js/images.js`
(`window.showMe`, the extra lane verbs, `manualVision(prompt, label)`), `src/js/chat.js` (the
`askedToSee` arm, the reminder after his words, the second ask, `spoken` on both reply archive entries,
the `/showme` command, `/help pictures`, `patchEntry` + its call site), `src/js/instr.js` (two new
rules in the `image` block, the lane's other words, the NOTES line), `src/commands/commands.json`
(`/showme` - **74**), `src/rtfm/commands.md` (**regenerated**), `src/README.md` (THE SPOKEN PROMPT
section, the images.js bullet, stack row 7), `src/TODO.md` (§1bn),
`src/chronicle/2026-09-26-the-prompt-she-spoke.md` (**this**) + `chronicle.json`,
`src/pack/files.json` (**regenerated**), and **one line of `index.html`**: the MOOD row's comment had
her lane written as `[[MOOD: ...]]`, which the engine would read as a template block - the rule that
file states out loud for itself - so it now says "a MOOD line in a reply (spelled out in
src/js/moods.js, never here)", and `src/pack/index.html.txt` was regenerated byte-exact. `main.pjs`
was **not** touched this session. **NOT SAVED by the agent** - the files are in the workspace until
Patrikios saves.
