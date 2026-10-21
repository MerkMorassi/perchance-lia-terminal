# THE VOX PANEL AND THE BOARD - EVERY VOICE IN ONE PLACE, AND THE COMMAND THAT WAS NEVER WIRED

2026-09-30 - the session three asks arrived together: a button that hears every voice, a clip made from
one, and the other generator's device-sync screen - with one ruling that shaped all of it.

## WHAT HE SAID

Three items, in one message, after the last session had built a local voice engine and a device road:

> *"1. Are we able add a sample for a cloned voice from any of the voices?"*
> *"2. Create 'VOX' button so I can preview all the voices and select which one I want for the default
> voice."*
> *"3. There is some code to sync devices: ..."*

and, under a paste of that other generator's screen (a group fingerprint *"it must read the same on every
device"*, SYNC NOW, COPY INVITE LINK, STOP SYNCING THIS DEVICE), the sentence that decided the shape of
the third:

> *"To be clear, no invite links. We remain private."*

## WHAT HE WAS ACTUALLY ASKING FOR

**"A sample for a cloned voice from any of the voices"** is not a small request and it is worth saying
plainly what it means: the story lane clones an agent's voice from a CLIP in the vault
(`src/js/story.js`, `setSample`), and every clip had to be found, recorded or dropped in by hand. He was
asking whether the terminal could MAKE the reference clip out of a voice it already owns.

**"Preview all the voices and select the default"** is the other half: four sets of voices existed in four
modules, each reachable only through its own verbs, and no single place to walk them.

**The device sync screen** is his eye on a road that already existed here. The other generator's board
carries an invite link; he wanted the board and not the link.

## WHAT WAS BUILT

- **`src/js/vox.js`** - the VOX button (lower deck, beside TALK and LISTEN), the panel, the target chips
  (THE DEFAULT / ON STAGE), and the road-by-road list: HEAR, KEEP, and - where the road hands back real
  audio - **◆ SAMPLE**.
- **The door in `src/js/voice.js`** - `voxRoster`, `voxPreview`, `voxSet` and `mint`. The panel is a
  FRONT-END: every list is read from the module that owns the road, and every write goes through the same
  stored shape the `/voice` verbs write. `mint()` is the one road between the voice lane and the story
  lane, and it REFUSES two of the four roads in words.
- **The DEVICE SYNC BOARD in `src/js/pair.js`** - the code (read off one screen, typed into the other),
  THE GROUP FINGERPRINT, who is here, SYNC NOW, and STOP SYNCING THIS DEVICE behind an arm-then-press.
  The lamp beside SYNC became a button and carries the first group of the fingerprint.
- **`src/js/chat.js`** - dispatch for `/vox` and for `/pair`.
- **`index.html`, `src/css/terminal.css`, `src/commands/commands.json`** - the button, the two panels,
  their styles, and the command entries; `src/rtfm/commands.md` regenerated (82 commands).

## WHAT WAS THOUGHT

**THE FOUR ROADS ARE NOT EQUAL, AND THE PANEL MUST NOT PRETEND THEY ARE.** Two of them hand back bytes -
the local model a WAV, ElevenLabs an mp3 - and two cannot, for reasons that are properties of the
platform and not choices of ours: the Web Speech API plays into the speakers and exposes NO audio surface
at all (no stream, no buffer), and the wire's voices are synthesized INSIDE a live socket, so what arrives
is speech being streamed rather than a file. So the SAMPLE button exists on two roads and is ABSENT on the
other two, with the reason written at the foot of the panel. A disabled button would have been the honest
middle; a working-looking button that fails would have been the dishonest one, and it was never on the
table.

**THE PANEL IS A FRONT-END, ON PURPOSE.** The alternative was for `vox.js` to know how each road works -
how a browser voice is named, how a wire voice is hidden, how the model's roster is shaped, how an
ElevenLabs id is chosen. That knowledge lives in four places already and a fifth copy is a fifth thing to
drift. So `voice.voxSet()` makes the same write the matching verb makes, and the panel's KEEP and the
terminal's `/voice kokoro voice emma` are the same act.

**A FINGERPRINT IS DERIVED, NOT STORED.** The other generator's screens say "it must read the same on
every device". The straightforward way to get that is to store one on a server and hand it out. This road
would not have it: the fingerprint here is the first sixteen characters of the ROOM'S NAME - the SHA-256
of the code - which each device computes for itself, so "the same on every device" is not a promise but a
consequence. It also reveals nothing: it is a slice of a one-way hash, and the key is stretched from the
code separately.

**AND THE LINK IS REFUSED ON PURPOSE.** A link is a code in a URL - in browser history, in clipboards, in
every screenshot of the page, and it works for anyone who ever sees it. He said the road stays private, so
the panel says what the alternative costs out loud ("slower and quieter") rather than dressing the code up
as something it is not. COPY THE CODE copies the CODE, not a link, and even that is annotated: a clipboard
is shared by everything on the machine.

## WHAT WENT WRONG

**1. `/pair` had never been reachable by typing.** It was declared in `commands.json` - so the cheatsheet
printed it, the SYSTEM panel showed it, and she was told about it every turn - but `chat.js` had no
dispatch block for it, so a typed `/pair` fell through to the branch that answers UNKNOWN COMMANDS and was
told *"THE COMMAND IS /PAIR :: ... WRITE IT IN LOWER CASE"*. Every earlier test of that road had called
`pair.run()` directly, which is precisely why nobody saw it. The lesson is small and worth keeping: a road
that is only ever tested through its module is a road whose DOORS were never tested. `/vox` and `/pair`
both have dispatch now, and both were verified through the input box.

**2. The vault holds no audio at all.** Measuring his vault while cleaning up the sample test returned
**189 records - 180 pictures, 9 clips, and ZERO audio**. The VOX tree exists (`/audio/vox`,
`/audio/vox/barbelo`, `/audio/vox/lia`) and is empty, so the fifty-one clips filed there by hand - the
thing README's THE VOX TREE section describes - are not in this browser any more. The story lane's sample
for BARBELO, kept in kv `lia_settings / story`, still names a clip the vault cannot produce. Nothing about
this session caused it (the same reference was there before, and the state was restored exactly as found,
including deleting the test clip and putting the fallback back), and it changes the value of the ◆ SAMPLE
road: it is now the way to make a reference clip again.

**3. The page-snapshot helper hangs in this preview.** Every attempt - the whole page, the panel, even a
single button - never returned. So the new panels were checked GEOMETRICALLY (their size, their position
above the deck, the list scrolling inside its own box, a row's children laid out in a line, no horizontal
overflow) rather than by looking at a picture of them. That is a weaker check than the house rule asks
for, and it is written down here rather than quietly counted as done.

## STILL OPEN

- **The missing audio in the vault**, and whether the samples should be re-made with the new road or the
  old clips looked for.
- **A real look at the two panels** on his screen - the picture was never taken.
- **ElevenLabs previews bill a credit per character** (and making a clip from one bills the characters
  twice). The panel warns first; a shorter preview line is one line away if it ever matters.

## FILES TOUCHED

`src/js/vox.js` (new), `src/js/voice.js`, `src/js/pair.js`, `src/js/live.js`, `src/js/config.js`,
`src/js/chat.js`, `src/js/sync.js`, `index.html`, `src/css/terminal.css`, `src/commands/commands.json`,
`src/rtfm/commands.md` (regenerated), `src/pack/index.html.txt` (regenerated), `src/pack/files.json`
(159 -> 161), `src/README.md`, `src/TODO.md` (§1dq), `src/chronicle/chronicle.json` (60 -> 61) and this
file. **NOT SAVED by the agent.**
