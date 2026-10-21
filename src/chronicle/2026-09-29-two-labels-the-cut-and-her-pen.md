# TWO LABELS, THE CUT THAT WAS OURS, AND HER PEN ON THE STACK

2026-09-29 - the session that took the file suffixes off two buttons, found that the read-aloud was being cut off by the terminal's own cost guard rather than by any engine, and gave her the same pen he has over the system stack.

## WHAT HE SAID

> - Button where is says : "LOAD LOREPACK (.TXT, .MD)" change to "LOAD LOREPACK".
> - Button where it says: "LOAD COREPACK (JSON)" change to "LOAD LOREPACK"
> - Check max allowable characters for text-to-speech; some of the read aloud text is cut off mid-sentence.
> - Allow her to CRUD SYSTEM instructions.

Four lines, and the interesting ones are the last two. The third is not a request for a feature at all - it is a report from the far end of the wire ("some of it is cut off mid-sentence") with an instruction attached ("check the ceilings"), and it turned out to name a real bug that was ours. The fourth is four words for a large change of authority: everything in the stack was already editable *by him*; he wants it editable *by her*.

## WHAT WAS BUILT

### THE TWO LABELS

The format suffixes came off: `LOAD LOREPACK (.TXT, .MD)` -> **`LOAD LOREPACK`**, `LOAD COREPACK (.JSON)` -> **`LOAD COREPACK`**, everywhere they are printed - `index.html`, `chat.js` (`/help`'s deck list and `/lorepack`'s own line), `lore.js`, `packs.js`, `petition.js`, and the two pack READMEs. The **tooltips were kept** (`… (.json) into the COREPACK`, `… .txt/.md memory into the LOREPACK`): the label is what he reads a hundred times, and the tooltip is where the format still belongs.

**His second line says the COREPACK button should read "LOAD LOREPACK" too.** That is read as a slip - two buttons with one label in the same row would be a bug, and the button loads `.json` traits into the COREPACK - so it reads `LOAD COREPACK`. If the duplicate was meant, it is one word to change.

### THE CUT WAS OURS, AND IT WAS 800 CHARACTERS

He asked us to check the ceiling. The honest answer is that no engine was cutting him off: **the terminal was.**

He holds an ElevenLabs key, so `engineNow()` resolves `auto` to the ElevenLabs road on his machine, and the shipped cost guard was trimming every reply at **800 characters**, appending an ellipsis mid-thought. The ceiling was measured against his own archive rather than guessed at: **990 replies in `sacred_archive` / `master_log` - median 498 characters, 90th percentile 1025, 95th 1195, longest 3398, and 210 of them over 800.** A fifth of everything she says was arriving clipped, and it had been that way since the guard was chosen.

What changed:

- **`elevenMaxChars` 800 -> 4000** (`src/voice/voices.json` and both fallbacks in `voice.js`): his longest recorded reply, whole, with room to spare. The provider's own per-request ceiling (`elevenRequestMax`, 10,000) is unchanged and remains the hard stop.
- **The browser roads were already whole, and now say so.** `maxChars` (24000) is a safety net, not a limit: a browser reply is broken at sentence ends (`chunk()` at `chunkChars` = 220, at most 140 on iOS) and the pieces are queued, so Chromium's long-utterance cutoff can never swallow the end of a sentence.
- **The ceiling follows the ROAD, not the setting.** `speak()` computed its cap from the configured engine, so in the live channel - with a Google key, over the wire's own speaker, never billed to ElevenLabs - it was still applying the ElevenLabs budget. It now asks `viaWire()` first and takes the free ceiling there, which is what `limitsText()` had been promising all along.
- **The receipt is honest either way**: `N CHAR - SAID IN FULL`, or `N OF M - CUT AT A SENTENCE END` with which door raises it.
- `/voice max` (built earlier the same day) now reads "4000 IS A COST GUARD RATHER THAN A TECHNICAL LIMIT - set to cover the longest reply in Patrikios' own record (3398 characters, out of 990 replies, median 498)".

### HER OWN HAND ON THE STACK

The system prompt is a stack of nineteen named blocks, every one of them already CRUD-able by him from the SYSTEM panel. She now writes them from inside a reply, in the same directive idiom she already uses for `[[SKILL]]`, `[[LOAD]]`, `[[ROLE]]`, `[[READ]]` and `[[HERS]]`:

```
[[SYSTEM: LIST]]                     the stack in order, with each block's state
[[SYSTEM: READ <ID>]]                one block, exactly as she is receiving it
[[SYSTEM: NEW <TITLE> :: <TEXT>]]    a block of her own, spliced in before `extra`
[[SYSTEM: <ID> = <TEXT>]]            rewrite a block (an override, so RESET has something to restore)
[[SYSTEM: DELETE <ID>]]              take one of HER OWN blocks out for good
[[SYSTEM: RESET <ID>]]               take her override off a shipped/built block
```

`src/js/instr.js` owns it: `sheAct()` is the grammar, `resolveBlockId()` takes an id, a title or the `own-` slug, `sheMayWrite()` is the one gate, and `SHE_NEVER_WRITES` is the exception. `chat.js` scans `[[SYSTEM: …]]` out of her text beside the other directives, prints a receipt per act, and stores the outcome in the log entry's `system` field.

## WHAT WAS THOUGHT

**Why her pen stops at `bounds`.** He said "allow her to CRUD SYSTEM instructions", and the literal reading is *all of them*. But the boundaries block is the one line whose whole job is to say what she does not do, and a rule that the thing it bounds can rewrite is not a rule. So `bounds` is **read-only for her, always** - the one block she may read and never write - and the constant lives in `instr.js` where she cannot argue with it. Crucially, **she is still told the exception** in the same breath as the grammar: a boundary she does not know about is a trap, and a rule she does know about is a fact about her world. Only he changes it, in the panel, which is where the decision belongs. Everything else in the stack is hers, and `chat.js` prints what she did on the stage where he can see it.

**An override is not a new block.** `<ID> = <TEXT>` had two possible meanings: create a block with that name, or rewrite the existing one. The second shape reuses the exact record his SAVE writes (kv `lia_settings` / `system`), which means RESET has something to put back and the panel shows the right thing. `NEW` is the create, it goes to `system_custom` (his `+ NEW BLOCK` record), its RESET reads DELETE, and it is spliced before `extra` so his own final word stays final.

**The cap follows the road, not the setting.** This is the same idea as the 800 itself: what a number means depends on what it is protecting. The ElevenLabs number is a *bill*; the browser number is a *safety net*. In the live channel with a Google key the words are neither the browser's voice nor ElevenLabs' - they are the wire's - so charging them against the ElevenLabs budget was simply the wrong meter. The rule is one ternary, and the reason is worth more than the ternary: a cost guard that is applied to the wrong road stops being a guard and becomes a bug.

**Why 4000 and not 10,000.** Ten thousand is what the API accepts, and it is also what one reply would cost. The number that had to be chosen is *what he should pay*, and there is exactly one honest way to choose it: measure what he actually writes. His longest reply in 990 turns is 3398 characters, so 4000 is "nothing he has written is cut" - a claim with evidence behind it - and `/voice max eleven <N>` is the door for the day he wants more. The number is a judgement about money, so it is written down as one, in the file and in the receipt.

## WHAT WENT WRONG

**The harness proved nothing the first time, and said so.** The TTS test stubbed the speech engine with `window.speechSynthesis = stub` and died on `Cannot set property speechSynthesis of #<Window> which has only a getter`. The fix is `Object.defineProperty`, which shadows the accessor. The failure was worth having: a green-looking run that had silently tested nothing is the worst possible outcome of a test, and this one refused to be that.

**And the fix for the fix, which is the better trap of the two.** `window.speechSynthesis` is an **own accessor** on this page, not a prototype property - so the stub did not shadow it, it **replaced** it, and the `delete window.speechSynthesis` in the cleanup then removed the accessor entirely: the page was left with `speechSynthesis === undefined` and **her voice was dead until the next reload**. The descriptor is saved and put back now (`Object.defineProperty(window, "speechSynthesis", savedDesc)`), and the reason is written beside it so no later session "simplifies" it back to a delete. A test that leaves the feature it tested broken is worse than no test.

**The paid road must be tested with the request stubbed.** Driving the ElevenLabs road for real would have spent his credits on a 4000-character synthesis. The test replaces `keyring.request` with a 402 and reads the request body - which is not a compromise at all, it is better evidence: the body IS what would be sent, character for character.

**The agent's first reading of his setup was wrong, and measuring fixed it.** The working theory was "no ElevenLabs key, so he hears the browser voice, and Chromium truncates a long utterance". `keyring.list()` shows `elevenlabs` stored with a `lastUsedAt` of that day. One measurement replaced a plausible theory with the actual cause, and the actual cause was code we had written.

**The message's two renames are the same word.** Read as a slip rather than copied literally, on the grounds that a duplicate label in one row is a bug, not a preference.

## STILL OPEN

Her lane reaches the **blocks**; it does not reach the design files in `src/` (a role's own file, the mood book) - a block is what she may write, and the reset doors out of a pack are still his. `bounds` is deliberately not hers to write and cannot be argued out of. The ElevenLabs budget is a number he may raise with `/voice max eleven <N>`; at 4000 a full-length reply is a few thousand credits, and that trade is the reason the default is not 10,000.

## FILES TOUCHED

`src/voice/voices.json`, `src/js/voice.js`, `src/js/chat.js`, `src/js/instr.js`, `src/js/lore.js`, `src/js/packs.js`, `src/js/petition.js`, `index.html`, `src/commands/commands.json`, `src/lorepack/capabilities.md`, `src/corepack/README.md`, `src/lorepack/README.md`, `src/README.md`, `src/TODO.md` (section 1by), `src/rtfm/commands.md`, `src/pack/files.json`, `src/pack/index.html.txt`, and this entry with `chronicle.json`. `main.pjs` is untouched.

## AND THEN HE ASKED US TO PROVE THE BIGGER PIPELINE

The last thing in this session: *"Check CREATE IMAGE roundtrip workflow example: PERCHANCE SDXL 768X412>PERCHANCE LOCAL SDXL 2X>GALLERY; or SDXL 768X412>Bigger.pic 4X > return to PERCHANCE>GALLERY"* - the two chains of the previous session's pipeline, asked to be shown working rather than described. So both were driven for real, with a real 768x512 render from the house engine on each road (**TODO.md §1bz** has the receipts line by line). Chain A: the press is refused a popup and falls to this machine by itself, the render is resampled 2x in 1053 ms on the GPU, the render leaves the vault, the archive's create row is rewritten to name the upscale, and the gallery holds the upscale as `upscaled` and nothing else. Chain B: the press opens the window, the render is handed over to `https://app.bigger.pics` as a data URL (so nothing leaves the device until the site asks), a 3072x2048 comes back, `result()` files it, the pipeline retires the render with the receipt that says so, and the gallery again holds only the bigger one - `viaWindow: 1, fell: 0`.

**Nothing was broken, and that is the point of saying so.** Four things are now measurements instead of expectations: the gallery leg lands under the **UPSCALED** filter and never under RENDER; the retirement moves the *references* (the archive row), which is why the chat tile and the gallery agree; the fallback fires from the press itself, with no second press and no lost picture; and nothing is uploaded until bigger.pics asks. **What went wrong was the harness again**, in the way harnesses do: the first chain-B run armed nothing and quietly took the local road, because chain A's stub of `window.upscale.open` was still in place and chain B had only stubbed `window.open` - a chain that "passes" by falling back looks exactly like a chain that works, which is why the second run restored what the first had broken. And `gallery.rows()` is only built by `render()`, so reading it after `refresh()` gives an empty list and makes a working gallery look broken. Everything was put back: two test pictures deleted, the archive restored, the sight queue, the form, the pipeline and the local road's counters all identical, the added log lines trimmed, the stubs removed - **2395 records, as found.**

