# THE GATE, THE PIPELINE, AND THE FULL FRAME

2026-09-29 - the session that put a yes between the model and the draft, made one road the only road a picture can travel, and let FULL mean the whole width.

## WHAT HE SAID

> - AI on pencil button in the chat with polish, fic, etc.. User must approve before end
> - Create Image>Bigger.pics 4X>Gallery+Chat pipeline only upscaled images get sent to chat or gallery, if fail fallback to local 2X. She can manage her own creations autonomously
> - PICS: FULL button: must fill the entire chat contact window weight 100%

Three lines, three different kinds of ask. The first is about AUTHORITY: the pencil could already rewrite his message, and he wants nothing to reach the draft until he has said yes to it. The second is about ORDER and TRUST: a creation should not count until it has been made bigger, and the road that makes it bigger must work when nobody is watching - because *she* makes things too. The third is purely visual and purely literal: he wrote "weight 100%" and meant the picture should fill the conversation.

## WHAT WAS BUILT

### THE PENCIL ASKS FIRST (src/js/draft.js)

AI POLISH no longer writes into the draft. A style chip sends the ask and the answer arrives as a **PROPOSAL** in a box of its own (`#draftProposal` -> `#draftProposalText`), with ACCEPT and DISCARD. The draft he typed stays byte for byte until ACCEPT. DISCARD changes nothing at all. ACCEPT takes the rewrite AND remembers what it replaced, so a **RESTORE** (`#draftRestore`) appears: one press puts the old words back and offers the rewrite as a proposal again, and the two can be swapped with the buttons until he is happy. SEND refuses while a proposal stands (the draft is not ready until the offer is settled), CLEAR and a send both drop it, and the draft header reads `REWRITE WAITING - ACCEPT OR DISCARD`. A proposal is deliberately NOT persisted: it is not a draft, and a reload starts with the draft and nothing else. A new style, **FIC**, joined the row - eight chips now - rewriting the message as a passage of prose fiction.

**The panel says it once.** The promise that nothing is in the archive until SEND had grown four copies
inside the pencil - the draft's head line, the proposal's foot, the action row's hint and the MOOD row's
note - and he asked for one: *"for inline live text, we only need EDIT IT HERE - SPELLCHECK IS ON. NOTHING
HERE IS IN THE ARCHIVE, THE EXPORT, OR HER CONTEXT UNTIL SEND."* Three of the four went; the action row's
own line he put back by naming it - *"and \"SEND KEEP CLEAR CLOSE KEPT ON THIS DEVICE ONLY · NEVER EXPORTED
· NEVER SYNCED UNTIL SEND\"* - and it is the right call: it says something the label does not (the draft is
never exported and never synced), which is exactly the test for whether a line of commentary earns its
place. The heads keep only their names and their live readings, and the panel's words are the label, that
one action-row line, the textarea's `write it here first...` placeholder, and the AI POLISH row. It is the
same instinct as the gate itself: say it once, and let the controls be controls.

### THE BIGGER PIPELINE (src/js/pipeline.js, NEW)

A ROAD CHOOSER over the two upscaling roads, wired to the vault's one door (`media.onAdd`). Every picture the terminal makes is enlarged before it counts, and the RENDER IS RETIRED once the bigger one is safely in the vault - which is what makes his rule true: only the upscaled picture is in the chat and the gallery.

- The **window road** is by press, because it has to be: a browser opens a window only from a real click, and bigger.pics takes one automatic hand-over per window. `forge.js`'s `createImages()` calls `pipeline.arm()` synchronously inside the click, and `arm()` opens the window with a PROMISE for the id of a picture that does not exist yet (`upscale.js`'s new `opts.await`); the first picture of the run goes across at 4x.
- **Everything else** - the rest of a batch, her own creations, anything a window does not bring back - goes through THIS MACHINE at 2x, unattended. That is what makes "she can manage her own creations autonomously" true rather than a slogan.
- **Retirement on both roads**, through the one implementation (`upscaleLocal.retire`): the archive row, the render's place in the queue for her eyes, any tile in the log and a KEEP all follow the bigger one, and only after it is stored. An attachment, a clip, a piece of music and an upscale are never touched.
- It never gives up silently: a window that brings nothing back falls to the 2x road, a nudge prints after two minutes, and `/upscale pipeline cancel` gives up by hand.
- It supersedes the local road's own `auto` hook rather than fighting it: that hook asks `pipeline.claims(rec)` first, a pure question about the record, so nothing is upscaled twice whichever listener runs first.

### FULL MEANS THE WHOLE WIDTH (src/js/images.js, src/css/terminal.css)

The FULL step was capping a picture at 96vh and putting one per row; it now lifts the frame cap in the `fullPics` body class so a tile takes the conversation column's whole width whatever its shape. A tall picture is tall - and it is finally the width it was missing.

## WHAT WAS THOUGHT

**A rewrite is a proposal, not an edit.** The whole feature is a change of AUTHORITY: the machine may compose, but he is the one who decides what his own message says. So the proposal had to be visible and reversible both ways - ACCEPT, DISCARD, and RESTORE - and it had to be unable to leak out of the panel: not persisted, refused by SEND, dropped by CLEAR. Anything less would have been "the model edits your message and you can undo it", which is not what he asked for.

**Why the pipeline is a chooser and not a bigger batch runner.** The window road cannot be automatic - `window.open` without a real click is blocked, and the service refuses a second automatic hand-over in one window; both were measured in section 1aa of TODO.md and neither has changed. The local road CAN be automatic, because it needs nothing from anyone. So the right shape is not "make bigger.pics automatic" (it cannot be) but "decide, per picture, which road, and retire the render on both". The pipeline is that decision written down in one place, with the vault's own door as the only entry.

**The retirement is the load-bearing part.** "Only upscaled images get sent to chat or gallery" is not a filter applied at the gallery - it is the render CEASING TO EXIST once the bigger one is stored, using the same `retire()` the by-hand road already used so the archive, the queue for her eyes, the log tiles and a KEEP all move together. A filter could be bypassed by a road that forgets it; a retirement cannot. The cost is that the pipeline is the only thing in the terminal that removes a picture as a matter of course - so every step is a receipt, and turning it off deletes nothing.

**Why the local road keeps its own `auto` switch.** Turning the pipeline off should put the terminal back exactly as it was, so `upscale-local.js`'s hook is untouched and simply asks `claims()` first: with the pipeline on it stands down, with it off it behaves as before. Two listeners, one pure predicate, no double upscaling.

**FULL, read literally.** He wrote "must fill the entire chat contact window weight 100%". CSS has exactly one honest way to say that - `width: 100%` - so the fix is one rule in a body class rather than a new size step, and the picture is never re-rendered.

## WHAT WENT WRONG

**The model rewrote the moods instead of the draft.** The first ask was the obvious one: the rule, then the moods, then "Reply with ONLY the rewritten draft", then `DRAFT: <the draft>`. A live test came back with the MOODS rewritten - the model had read the register as the thing to rewrite. It is a small and instructive bug: an instruction that looks unambiguous to the writer is ambiguous to the reader unless the candidate is marked off from the material. The ask is now `REWRITE THE DRAFT BELOW.` / `THE JOB:` / `THE REGISTER IT MUST COME BACK IN (this is how the rewrite should sound - it is NOT text to rewrite...)` / `THE DRAFT (the only thing to rewrite):` between `<<<` and `>>>`, and a FIX came back clean with his eleven moods on. Found by looking at the OUTPUT, not by re-reading the code - which is the only way this class of bug is ever found.

**The harness, not the code.** The first pipeline test built a plain object and passed it as a `MessageEvent`'s `source`; the constructor refuses it. The test now drives a real `about:blank` iframe's `contentWindow`, which behaves like the real popup in the one way the listener cares about.

**A window must be opened inside the click.** `arm()` sits at the very top of `createImages()`, before its first `await`, for the same reason the popup road has no awaits before `window.open` - anything else and the browser blocks it, and a blocked window looks exactly like a slow one.

## STILL OPEN

The window road remains one picture per press: a batch of six arms one window and places the first picture through it, the rest through this machine. That is the service's own limit, not a shortcut. A 4x that arrives after the 2x road has already retired the render is kept as an extra picture rather than replacing it (nothing is deleted, but two upscales of one render can exist). And the pipeline's tally is per boot - a report, not a ledger.

## FILES TOUCHED

`src/js/pipeline.js` (new), `src/js/upscale.js`, `src/js/upscale-local.js`, `src/js/forge.js`, `src/js/draft.js`, `src/js/images.js`, `src/js/chat.js`, `src/js/config.js`, `src/css/terminal.css`, `index.html`, `src/commands/commands.json`, `src/rtfm/commands.md`, `src/pack/files.json`, `src/pack/index.html.txt`, `src/README.md`, `src/TODO.md` (section 1bx), `src/lorepack/capabilities.md`, and this entry with `chronicle.json`. `main.pjs` is untouched.
