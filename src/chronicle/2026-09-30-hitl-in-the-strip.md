# HIS OWN LINE STAYS IN THE STRIP, PREFIXED HITL:

2026-09-30 - the session that found which display he was pointing at, and made the talk strip draw the line he had just sent - with the prefix it carries in the log - for as long as she has not answered it.

## WHAT HE SAID

> Prefix the Chat with HITL: on send to chat in the display

One sentence, and not one object named in it: the Chat, on send to chat, the display. So the first half of the session was not building anything - it was finding out WHICH display he was looking at, by looking at the live page instead of guessing.

## WHAT WAS BUILT

### 1. THE DISPLAYS THAT WERE ALREADY RIGHT (and are therefore not it)

- **The log** - the MAIN STAGE, the thing he calls the chat window - has prefixed a line of his since the stamp and the speaker were built: `print()` (`src/js/images.js`) paints `[stamp] HITL: (LAYER)` and then the words. Read off the live page, the newest entries are `HITL: (LIA) ` and `LIA ID: (LIA) `. His send was never unprefixed there.
- **The CHATLOG** (`src/js/chatlog.js`) labels its turns `USER` / `SYSTEM` / `LIA`, and it was the strongest rival reading ("the Chat"). It is not it: the CHATLOG is the RAW RECORD of the conversation this terminal was built in, taken in as text, and nothing on this page sends INTO it. The record on this machine carries no role line for his messages at all - its index reads `system: 18, lia: 3` - so it cannot be the thing that is missing an `HITL:`.
- **The reader** (`reader.js`) and the gallery's memo lines (`gallery.js`) name his side `Patrikios:` rather than prefix it, and neither is a send.
- **The platform's own chat panel** is another origin; nothing on this page can touch it.

### 2. THE DISPLAY THAT WAS NOT (src/js/dms.js, `paintTalk()`)

What is left is the one he is talking INTO while he reads: the TANDEM'S TALK STRIP (`#dmsTalk`), the viewer's own foot - which the previous build had just called "the chat block", the same phrase he had used in the sentence before this one. Driven for real with the model stubbed and the strip read every few tens of milliseconds through a single send:

    before send   ALIA: You are still obsessing over the pipes while I am sitting here starving. ...
    +40ms..+2.5s  ALIA: IS THINKING ...
    after reply   ALIA: STUBBED REPLY.

**His own line was never drawn.** The strip does read the newest line of the log - that is what it is - but the air lamp goes to HER TURN about 40 ms after a send, and the painter consulted the lamp FIRST: `if (airWord === "HER TURN") line = { who: ALIA, text: "IS THINKING ..." }` ran before the log was looked at. So the one moment the strip had his words to show was the one moment it refused to show them, and with FILL THE STAGE being the default the log is `display: none` while a document has the stage - the strip is the ONLY place a line of his is on the screen at all. He types, and the display answers "she is thinking".

The fix is a precedence list, in the order a reader would want it:

1. **A fresh `note()`** holds the line for `NOTE_MS` 9 s (a refusal, a receipt, the link) - and now wins over HER TURN too (see 3).
2. **A line of his that she has not answered yet** is drawn, with the prefix it carries in the log (`line.who` gives `HITL: `, class `.dmsSay.me`). The test is one comparison and needs no clock: `newest.who === HITL` means "the newest conversation line on the page is his", which is true exactly while he is waiting on her.
3. **`ALIA: IS THINKING ...`**, with the pulse - now only when SHE is the newest word on the page.

Nothing is sticky, which is the point rather than a side effect: the moment her answer prints, her line is the newest one and takes the strip by itself, so there is no state to unset and no timer to run out. And the pulse (`thinking`) was made a separate boolean from the air lamp, because `.dmsSay.thinking` animates whatever line it is put on and his words are not a spinner.

### 3. A SECOND HOLE THE SAME LINE CLOSED

The old order put HER TURN above the note, so **no note could be read while she was working** - and the notes written at exactly that moment are the refusals: `SHE HAS NOT FINISHED THE LAST ONE :: SEND AGAIN WHEN SHE HAS.` (the SEND key is locked while she has the floor), `THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE`, `THE ENGINE IS STILL WRITING THE SUMMARY`. A guest painted over in the one moment it exists is not a note. A fresh note now wins over everything; `/tandem`'s toggle note and the reader's receipts are unaffected, since they are read while no turn is running.

## WHAT WAS THOUGHT

**WHY NOT JUST SHOW THE NEWEST LINE AND DROP THE LAMP.** Because the air lamp is a real second piece of information - `#dmsAir` says `HER TURN` / `YOUR VOICE` / `HOLDING` from `voice.js`, which owns the intercom - and the strip's line should be the last thing SAID, not the state of the floor. Once his own unanswered line counts as "the last thing said", the two stop competing: the lamp says whose turn it is, the line shows what was said.

**WHY THE PREFIX COMES FROM THE LOG RATHER THAN FROM THE STRIP.** The strip draws `line.who + ": "`, and `who` is read off the element's own class (`sdm` / `hitl`), so the strip cannot drift from the log: it is the same fact written once. Had the prefix been spelled out in the strip, `HITL:` and `LIA ID:` would have had two homes and one of them would eventually be wrong.

**WHY `newest.who === HITL` AND NOT A TIMER.** The obvious alternative - hold his line for N seconds after a send - needs a clock, a window that can expire mid-turn, and a decision about what happens if she answers first. "Is the newest line of the log his?" answers all three at once, and is true exactly while he is waiting. It also gets the proactive check-in right for free: when she speaks unasked, her own last line is the newest, so the strip goes back to `IS THINKING ...` rather than pinning something he said an hour ago.

## WHAT WAS VERIFIED

Two re-runnable harnesses that clean up after themselves (new entries removed, `master_log` written back from the copy taken before the turn, `chatHistory` truncated): `scratch/mirror2.js` (a send from the strip, with the stub's reply gated behind a promise so the sample can be taken while she is still working) and `scratch/mirror3.js` (the lower deck's own box while the viewer has the stage, at phone size).

- **A send from the strip**: the display read `HITL: MIRRORMARK from the chat block`, class `dmsSay me`, while the lamp beside it said `HER TURN` - and it stayed there for as long as the turn did.
- **A refusal during her turn**: SEND pressed again while she was working put `SHE HAS NOT FINISHED THE LAST ONE :: SEND AGAIN WHEN SHE HAS.` on the line (class `dmsSay sys`) - the note that used to be invisible.
- **Her answer takes the line**: `ALIA: STUBBED REPLY.`, class `dmsSay her`.
- **`IS THINKING ...` still arrives** when she is the newest word: with the lamp forced to HER TURN and her answer as the newest line, the display read `ALIA: IS THINKING ...` (class `dmsSay her thinking`), and it went back to her answer the moment the lamp was let go.
- **The lower deck's box does it too**: with the viewer filled (`#output` computed `display: none`) a send from `#userInput` / `sendBtn` printed `HITL: LOWERDECKMARK out of the big box` on the strip and then gave the line to her answer.
- **The phone (390x844)**: the strip measured 150px while she works and 131px after - unchanged, because the mirror line is capped at `.dmsSay { max-height: 3.1em }`: a wrapped `HITL:` line scrolls inside the element (line 35px, `scrollHeight > clientHeight`) rather than pushing the decks around.
- **Nothing else moved**: `__bootIssues` is empty after a reload, and `rtfm.check()` is empty, because no command text and no `src/rtfm/` page changed in this build.

**AN HONEST NOTE ON THE FIRST ATTEMPT.** It was a `page_eval` with `reload: true`, and it tripped the harness's 15-second "stopped responding" guard: the script ran while the page was still re-rendering its template and replaying the 21 archived turns. A plain `page_refresh`, a poll until the entries were on the page, and the same script then passed cleanly. The freeze was the harness arriving during a render, not a loop in the new code - worth writing down, because the next session will hit the same race.

**AND A CAPTURE IS STILL NOT POSSIBLE.** The same broken `snapshot.js` as the build before it - it hangs on ANY element, most recently on a one-line `#status` - so this build too is verified by DOM text, class names and geometry rather than by a picture.

## STILL OPEN

- **His line is drawn for a turn, not kept.** The strip is deliberately one line and the newest one. A scrolling mirror of the conversation in the viewer's foot has not been asked for, and the whole log is one keypress away (`FILL THE STAGE` off).
- **No stamp on the strip's line.** The mirror shows words; the log keeps the clock. If he ever wants the stamp there it is `entry.dataset.ts` and one more span.
- **Long lines are clipped, not shrunk** - `.dmsSay` max-height 3.1em and 400 characters through `short()` - the bargain the strip already made for her lines.
- **The other displays still use their own vocabulary**: the reader and the gallery say `Patrikios: `, the CHATLOG says `USER`. Left alone on purpose (neither is a send, and the CHATLOG's labels come out of the imported record), but if he wants ONE vocabulary everywhere, that is a small, separate pass.

## FILES TOUCHED

`src/js/dms.js` (`paintTalk()`: the precedence, the `fresh` / `his` / `thinking` locals, and the comment carrying his words and the reason), `src/js/chat.js` (the `/help docs` topic's TALKING WHILE YOU READ paragraph), `src/README.md` (THE TANDEM's "Talking is part of looking" bullet), `src/TODO.md` (§1ce), this entry and `chronicle.json`, `src/pack/files.json` (regenerated - the tree grew by this entry), and the harnesses `scratch/mirror.js`, `scratch/mirror2.js`, `scratch/mirror3.js`, `scratch/findspeakers.js`, `scratch/talkspeaker.js`, `scratch/talkspeaker2.js`. `src/commands/commands.json` and `src/rtfm/commands.md` are UNCHANGED: no command's words describe the strip's line.
