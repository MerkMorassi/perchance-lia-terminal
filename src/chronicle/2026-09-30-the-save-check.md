# THE SAVE CHECK - `downloadGenerator`, TURNED AROUND

2026-09-30. He sent `https://perchance.org/diy-perchance-api` and asked what I made of it: *"OK. It's
saved. What are your thoughts on this? No coding yet. Just advice."* The advice is most of this entry,
because the advice is what decided what was worth building.

## WHAT THE PAGE IS, AND WHAT IT IS NOT

It is a tutorial generator - `main.pjs` is 0 bytes and the whole thing is one page of prose - and what
it teaches is not an API. It is a HEADLESS BROWSER: `GET https://perchance.org/api/downloadGenerator?
generatorName=<name>` returns a generator's SAVED HTML, that HTML goes into JSDOM with
`runScripts:"dangerously"`, and the pjs engine then runs in Node, so `window.root.<list>` can be read
from a server. For a stateless list generator that works, and it is the platform's own creator's page.

Three things decided the advice, and the first is written on the page itself:

1. **THE AI PLUGINS CANNOT RUN OFF-SITE.** Its own yellow note: `text-to-image-plugin` and
   `ai-text-plugin` "won't work" from your own server, because what funds their GPUs is the ads shown on
   perchance. Everything this terminal is - `generateText`, `generateImage`, every lane built on them -
   is therefore impossible in a clone. A clone renders the shell and shuffles the lists.
2. **THE TUTORIAL'S HOST IS GONE, AND THAT IS MEASURED, NOT REMEMBERED.** Its demo,
   `https://diy-perchance-api.glitch.me/api?generator=animal-sentence&list=output`, answers **HTTP 410**
   with "Glitch project hosting is no longer available." The technique is portable; the place is not,
   and no cloud Node host fixes (1).
3. **THIS TERMINAL IS THE OPPOSITE OF WHAT THE PATTERN SUITS.** Keys live on this device and never leave
   it, the memory of every turn lives in kv on this device, and JSDOM has no IndexedDB, no microphone,
   no MediaRecorder, no audio playback, no service worker and no OPFS. A headless clone of LIA would be
   a stranger with no memory and no voice, on somebody else's server, with none of her keys.

**THE ADVICE, FOR THE RECORD:** do not build it for LIA; take the ENDPOINT. And if an outside surface
for her is ever wanted - a bot, a phone, a script - the shape that fits is a BRIDGE INTO THE LIVE PAGE
(`createServerSocket`: the page keeps the keys and the calling, the socket is only transport), never a
clone of her on a server. A bridge needs a gate of its own, because the server script is public source.

## WHAT WAS BUILT: THE ENDPOINT, TURNED AROUND

*"- Add downloadGenerator"* - and the useful half of that page is the endpoint, not the server. Not
"give me this generator so I can run it", but "**tell me what you are holding, so I can tell whether my
work is on the server**": the question every build here ends with, and the one question the page could
never answer about itself.

`/saved` (`src/js/saved.js`, `window.saved`) reads the server's copy of THIS generator - through the
relay, cache-busted - and compares it against this workspace: the two root files byte for byte (printing
the first line that differs, with both lines), the file list, EVERY `src/` file BY CONTENT, and the
import lines. One verdict, either "EVERYTHING HERE IS SAVED" or "THE SERVER'S COPY IS BEHIND THIS
WORKSPACE. PRESS SAVE IN THE EDITOR."

## WHAT WAS THOUGHT (the decisions, each with what it was refused in favour of)

**ASK THE SERVER, NOT THE PAGE - AND THE NUMBER THAT SETTLES IT.** A served perchance page carries its
own copy of the generator in `#preloaded-generator-data`, and `backup.js` already reads it, which is
what makes `/backup status` honest. Honest is not fresh, so it was measured: with a 61-byte probe
appended to `main.pjs` (67,921 bytes on disk) and the page RELOADED, the embedded copy still reported
**67,860** bytes and no probe. The element carries the copy the page was SERVED with. It is the right
thing to read a file list from and the wrong thing to prove a save with - after he presses SAVE, the
page he is looking at still runs the previous one until it is reloaded. So this module asks the server
directly and compares the page's own copy against the answer as a second opinion.

**THE RELAY, BECAUSE THERE IS NO OTHER ROAD.** `fetch` on that endpoint from inside the page is
`TypeError: Failed to fetch` (no CORS headers on their API); `root.superFetch` on the same URL is 200 /
904,256 bytes in 444-624 ms. The super-fetch-plugin was already imported for the key ring, so the page
gained no dependency for this.

**BY CONTENT, NOT BY SIZE - WHICH IS THE WHOLE POINT.** A size check passes a one-character edit (`0.8`
to `0.9`), and this project makes exactly those. The manifest's `key` is not reproducible here (measured
against `src/js/packs.js`: not md5 of the content, not md5 of path+content, not twelve other spellings) -
but it does not have to be, because the platform's own loader names its base inside the served page:
`PERCH.src` declares `CDN_BASE = "https://user.uploads.dev/file/"` and
`KEY_REGEX = /^[0-9a-f]{32}\.[a-z0-9]{1,20}$/`. So the saved bytes are simply READ BACK and compared.
127 files, byte for byte, 478 ms.

**THE CAVEAT IS PRINTED EVERY TIME.** `main.pjs` and `index.html` cannot be fetched from this page at
all: `fetch("main.pjs")` is `Failed to fetch` (this frame's URL has no trailing slash, so the relative
path climbs above the generator) and every absolute spelling is a 404, while `src/pack/main.pjs.txt` is
200. So the "here" side of the root comparison IS the pack, and the report says so in a bracketed line -
because a stale pack would otherwise turn a verdict about the pack into a false verdict about the
editor's buffers. Everything under `src/` is read from its real path.

**A RECEIPT, NOT A GATE.** It writes nothing, uploads nothing, reads no key, changes no file, and
nothing in the terminal waits on it. It prints its own cost and says plainly that it answers ONE
question - is the source the server holds this workspace - and not the other one, which is the
conversation: that lives in kv, on this device, and is `/sync`'s and `/cloud`'s business.

## WHAT WAS MEASURED, LIVE

- the snapshot: 904,256 bytes, 444 ms (relay) / 562 ms (in the command), `DOMParser` + parse 7 ms;
- the root files: byte-identical, `main.pjs` 67,860 and `index.html` 105,902 characters;
- the file set: 127 on the server = 127 here;
- the deep pass: **127 of 127 files byte-identical against the CDN copies, 478 ms**, slowest file 18 ms;
- sizes alone (the cheap mode) took 246 ms, and it was kept only as `/saved quick`;
- the whole command, end to end: **1,232 ms**;
- and the verdict on this build, which is right about every change in it: `index.html` DIFFERENT with
  FIRST DIFFERENCE AT LINE 157 (the `MODULES` line), `src/` 127 on the server against 128 here, with
  `js/saved.js` named as never saved, then four files by content with both byte counts, imports 5 of 5.

## WHAT WENT WRONG

1. **A nested `page_refresh` inside `execute_js` killed the worker** - twice reported as the page having
   frozen - and left the 61-byte probe line inside `main.pjs`. Recovered by writing the pack copy back
   over the root file (which is what the pack is for), then re-running the experiment with the reload as
   its own call. Same lesson as §1cn's: do not drive page refreshes from inside a worker.
2. **The first end-to-end harness swept up the boot prints and the replayed log** (23 entries removed)
   because it counted entries instead of marking a cut point - and `/saved` had not run at all, because
   `#sendBtn` is disabled during the boot rush and `window.send()` returns early when it is. Fixed by
   waiting for quiet AND an enabled button, then marking the last entry and removing only what came
   after it. Nothing was lost - the stage is a view of the archive in kv, and a reload redrew it - but
   the harness was wrong, and a harness that eats the log is worse than one that fails.
3. **One of my patches deleted a report line while inserting another** (the `src/ ::` summary), caught
   by reading the region back before moving on.

## WHAT IT MEANS FOR THIS PROJECT

Every build in this house has ended with the same sentence - *"NOT SAVED by the agent - press SAVE"* -
and that sentence was always an inference: I had edited files, so I assumed nothing was published. It is
now a MEASUREMENT, and it is the terminal's own: the pack regenerated, then `/saved`, and the answer
names file by file what landed and what did not. The honest limits travel with it: the root comparison
is against the pack; the CDN base and key shape are pinned in `README.md` and would need re-measuring if
the platform ever moves them; and none of it says anything about the conversation, which never goes to
the server at all.

## THE WINDOW SHOPPING (`useful-generators`, and what is out there)

The second half of his message was the browse: *"look around and go \"window shopping\"/\"code mining\"
https://perchance.org/useful-generators"*.

**`useful-generators` is not code.** It is a catalogue of WORD LISTS - 46 sections, ~250 importable
lists (`noun`, `emotion`, `archaic-word`, `terrain`, `gemstone`, `greek-god`, ...). Its own `main.pjs`
is 733 bytes, and the only technical thing on the page is a comment pointing at DBpedia/SPARQL and
Faker.js. So the mining there is VOCABULARY: worth picking from by need (the shot list, the Veiled
Tongue, the MYTHOS side, her prose), never importing in bulk.

**The real window-shopping surface is `/api/getGeneratorList`** (what `perchance.org/generators` is
built from): 451 recently-updated generators with titles, descriptions and tags. The neighbourhood is
now full of this terminal's relatives - `rpg-worlds` ("longterm memory"), `chatnex`, `moechat`
("an automatic lorebook of memory"), FurAI, Veilwright, Vale of Second Chances, MNO-FRK, `huddle-app`,
`storyframe`.

**Three things worth taking, ranked:**

1. **ON-DEVICE WHISPER (`storyframe`)** - the one I would build next. It transcribes with
   transformers.js in a worker: model downloaded once and cached, audio never uploaded, no key. Read
   out of their own saved `src/` (their `whisper-worker.js`, 5,824 bytes, fetched off the CDN):
   `@huggingface/transformers@3.8.1` from esm.sh, `pipeline("automatic-speech-recognition",
   "onnx-community/" + model, { device: "wasm", dtype: "q8", progress_callback })`, a `TextStreamer`
   that streams the words as they are generated, `return_timestamps` with `chunk_length_s: 30` /
   `stride_length_s: 5`, special tokens stripped by hand, and audio decoded through an
   **`OfflineAudioContext`** to 16 kHz mono. And the perchance part, in their own comment: because a
   worker cannot import across origins and `src/` is served from another origin in the editor, the page
   **fetches the worker file as text and starts it as a blob module worker**. This terminal's `/hear`
   needs a key and uploads the audio; this road needs neither.
2. **`huddle-app`** - a working `text/x-server-plugin` app (rooms, channels, chat, polls, watch-sync,
   voice signalling, presence, per-network quota tables, a roster that counts each person once). The
   model to copy if LIA ever gets an outside surface - the "bridge into the live page".
3. **`rpg-worlds`** (946 KB of HTML) - invited characters as LIVE REFERENCES resolved fresh each prompt;
   a hand-written LORE panel re-injected every scene; an explicit rule to the model: **READ BEFORE YOU
   REWRITE**; and a per-session prompt log in kv. Nothing structural to take, two prompt rules worth
   considering.

**And the method, which is the real prize: any generator's `src/` files can be read from outside.**
The saved page's manifest gives every file's CDN key and `user.uploads.dev/file/<key>` serves it - so
"how did they do that?" is a two-request question for any generator whose code lives in `src/`. That is
`/saved`'s road, pointed outward, and it is how the whisper worker above was read.

## FILES TOUCHED

`src/js/saved.js` (new), `index.html`, `src/js/chat.js`, `src/commands/commands.json` (78),
`src/rtfm/commands.md` (regenerated), `src/README.md` (THE SAVE CHECK, and the `saved.js` file line),
`src/TODO.md` (§1co), `src/chronicle/2026-09-30-the-save-check.md` + `chronicle.json` (39),
`src/pack/files.json` (128), `src/pack/index.html.txt`, `src/pack/main.pjs.txt`. **NOT SAVED by the
agent.**
