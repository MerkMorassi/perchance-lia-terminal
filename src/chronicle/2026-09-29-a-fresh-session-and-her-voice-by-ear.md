# A FRESH SESSION, AND HER VOICE BY EAR

2026-09-29 - the session that stopped two of the terminal's conveniences from writing text back into boxes by themselves, and that put the model's thirty prebuilt voices in front of him where he can hear them and choose.

## WHAT HE SAID

> Small thing. After I save, the chat context window keeps text from a previous session. It also prepopulates of areas like create image tab.

> Gemini Free Voice selection preset list somewhere so I can decide. When I do, I will make a new voice clone recording for chatterbox.

Two asks, both small on their face and both about the same thing: a SAVE is a LOAD, and a load was
not a fresh start. The first is a complaint with no prescribed cure, so the cure had to be reasoned
out from what he actually wants - and what he wants is said plainly in the second one: to *decide*.
He wants the terminal to hold its tongue until he asks.

## WHAT WAS BUILT

**A LOAD IS A FRESH SESSION. WHAT IS REMEMBERED IS OFFERED, NOT APPLIED.** This is the whole rule, and
it replaces two conveniences that were quietly wrong:

- **The chat box starts empty.** `src/js/draft.js` restored the unsent draft from kv
  (`lia_settings / draft`) into `#userInput` *and* into the pencil. A reload - which is exactly what
  pressing SAVE is - put 598 characters of a previous session's paragraph into the box before he had
  typed anything, so the box could not be trusted to be empty. It is not put there any more: the draft
  waits in the pencil (still the only copy anywhere, still on this device only), the boot says so in
  one line with its age and size, and the pencil wears the microphone's own green ring
  (`#draftBtn.has`). A message sent from the box finishes the held copy off; a slash command does not,
  so `/voice wire quiet 1500` cannot eat the paragraph he is holding.
- **The forge remembers the settings and offers the prose.** `src/js/forge.js` restored
  `lia_settings / image_form` into the CREATE IMAGE panel, and `openForge()` wrote the last prompt
  and negative straight into `#cpPrompt`/`#cpNegative`. Size, count, guidance, seed, the pose in the
  slot and the recipe in hand still come back by themselves - they are choices. The prompt and the
  negative are text he typed, so they are held and **offered** by a new row, LAST TIME / RECALL LAST
  PROMPT, which fills only an empty box and says so when it does not. `/renders redo`, the recipe rows
  and the shot-list roll still write the boxes on purpose: that is what they are for.

**THE THIRTY, WITH THEIR CHARACTERS, AND AN AUDITION.** `live.js` now carries the model's prebuilt
voices as `[name, character]` pairs - the API's own one word for each, which is the only description
there is, since the API has no voice list to ask - with the duplicate `Achernar` removed and `Alnilam`
back in. `/voice wire voices` prints all thirty with their characters; the same list, with the
reasoning, is in `src/voice/voices.json` → `wire.voices` and in the README, so it can be read without
a terminal. And a word is a poor way to choose a voice, so **`/voice wire audition` says one short line
in every one of them, in turn**, printing the name and the character as each one starts:
`/voice wire audition stop` ends it at any time, `<N>` does the first N, and a name - with or without
`from` - starts there. The voice is handed to the mouth for that session only (`live.js`'s new `voice`
option), so **nothing is saved, and an audition cut off in the middle cannot leave his channel in a
voice he never chose**. The ears are optional now (`open({ears:false})`): an audition is a question
about *her voice*, not about his room, so it does not open the microphone at all, and
`close({mouthOnly:true})` puts the mouth back without taking the ears, the microphone or the output
context down with it.

## WHAT WAS THOUGHT

**The convenient thing and the trustworthy thing were the same thing, and it was the opposite of what
was there.** Every auto-restore in this terminal was written to be kind - "it remembers where you
were" - and each one spends the same currency: the certainty that a box is empty. A box that fills
itself cannot be read as an invitation, and the one place it matters most is the one he types into.
Hence the rule, and hence the shape of the fix: not *stop remembering* (he would lose the draft, and
he has used the forge form heavily), but **stop applying** - hold it, mark it, offer it, and never
overwrite a box that has words in it.

**A URL and a list are not how you choose a voice.** The second ask could have been answered by
pasting the list into the docs and saying "there you go". That answers the question and does not help
him decide, because the API's characters are one word long and two of the thirty are *firm* and two
are *smooth*. The only honest interface for choosing a voice is **hearing it**, so the audition is the
answer and the printed list is the index to it. Tying it to the story lane in the same breath matters
too: the point of choosing is that he will record a clone for chatterbox afterwards, so the command
says so - pick one with `/voice wire voice <NAME>`, record a sample, and `/story sample <ID>` puts it
on the stage.

## WHAT WENT WRONG

- **Closing the forge wiped the thing the row exists to hand back.** `saveForge()` writes what
  `closeForge()` left in the boxes; with the boxes deliberately empty on open, opening and closing
  the panel - nothing typed, nothing touched - stored an empty prompt over the remembered one. The
  check that caught it is the check worth keeping: open, close, reopen, and read kv. The remembered
  pair is now only replaced by another **non-empty** pair.
- **A function name that was already taken.** The audition runner was first declared
  `async function audition(...)` - the same name as the BROWSER audition near the bottom of
  `voice.js`. Two declarations in one scope do not merge; the last silently wins. So
  `/voice wire audition 2` ran the browser's four candidates and printed them as if they were the
  model's thirty. It is `auditionWire()` now, with the reason written at the declaration, and
  `stopWireAudition()` beside it.
- **An unrecognised word ran all thirty.** `/voice wire audition nonsense` matched no branch and fell
  through to the whole set - a typo turned into a two-minute recital with the microphone question
  already answered. A name that is not one of the thirty is refused with the list hinted now, and a
  name that *is* one starts there.
- **A test wrote over his form.** Probing the forge stored a test prompt in
  `lia_settings / image_form`. His real pair was read back into a workspace file before anything was
  overwritten and restored byte for byte afterwards; the 3298-character negative matching the render
  record's own negative exactly is how the restore was checked. Nothing of his was lost, but the
  lesson is the one this session is about: **a test that drives a form is working in the one place a
  draft lives.**

## STILL OPEN

- **The boot reprints the last three turns** (`RESUMING RECENT AEONS...`, `src/js/main.js`). That is
  the RECORD, not a form - it is the conversation greeting him back - and it is left exactly as it
  was. If *that* is the "text from a previous session" he meant, it is a one-line change to stop it,
  and it should be his call.
- **The whisper of the thing he asked for first is still missing**: nothing yet lets an audition be
  reached from the browser-voice side, so `/voice audition` (the machine's voices) and
  `/voice wire audition` (the model's) are two doors with no sign between them. `/voice wire voices`
  and `/voice voices` are separate lists for separate mouths, and a single `/voice shop` that names
  both is the obvious next thing if he wants it.
- **The clone itself is still his to record**, and the wire's voice and the story lane's clone are
  still two different voices: `Kore` cannot be ElevenLabs, and a clone cannot be streamed this way.
  That is the honest boundary of this session, and the next one starts where he records the sample.

**NOT SAVED by the agent** - `main.pjs` is untouched; everything above is in the workspace until he
saves.
