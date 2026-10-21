# THE AUDIONOOK IDEAS, HALF ONE - A LOCAL ENGINE FOR MORE FEMALE VOICES

2026-09-30 - the session a linked page turned into a measurement, and the measurement turned into a third
engine she can speak with.

## WHAT HE SAID

A link, and two ideas under it:

> *"https://perchance.org/mythos-auto-gallery"*
>
> *"2 interesting ideas here:"*
>
> *"1. More female voice echoices (maybe)"*
>
> *"2. Device Synch"*

Two ideas, one message. This entry is the first; the pair road is `2026-09-30-the-pair-road.md`.

## THE PAGE, AND THE ONE THING THAT COULD NOT BE READ

`mythos-auto-gallery` is an audiobook reader - "Audionook" - free and unlimited, running text-to-speech
entirely in the browser (server-plugin + upload-plugin + ai-text + text-to-image + super-fetch + kv). Its
`main.pjs` and `index.html` were fetched and are kept at `scratch/generators/mythos-auto-gallery/`.

**Its `src/` files cannot be read from here, and the reason is measured rather than assumed.** Perchance
serves `https://perchance.org/src/...` **keyed by the request's `Origin` header**, so fetching
`https://perchance.org/src/js/config.js` from this page returned **this terminal's own `config.js`**
(67,722 characters) - not Audionook's. Another generator's source tree is therefore not reachable from
inside this one, and that is a property of the platform, not a bug to work around. What Audionook's voice
actually *is* had to come from its **server script** (public by design) and from the model itself.

## THE MODEL - WHAT IT IS, AND WHY IT ANSWERS HIM

The voice behind that page is **KOKORO**: an 82-million-parameter ONNX text-to-speech model that runs
locally, on this machine, through ONNX Runtime Web (WebGPU or wasm). No key, no account, no quota. Its
English pack carries **28 voices - 15 female and 13 male** - and every one of them ships with the
provider's OWN `targetQuality` and `overallGrade`. That is what turned his "(maybe)" into a table instead
of an opinion:

| # | voice | grade | | # | voice | grade |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Heart** (`af_heart`) | **A** | | 9 | Nova (`af_nova`) | C |
| 2 | **Bella** (`af_bella`) | **A-** | | 10 | Isabella (`af_isabella`) | C |
| 3 | **Emma** (`bf_emma`) | B- | | 11 | Sky (`af_sky`) | C |
| 4 | **Nicole** (`af_nicole`) | B- | | 12 | Jessica (`af_jessica`) | D |
| 5 | Aoede (`af_aoede`) | C+ | | 13 | River (`af_river`) | D |
| 6 | Kore (`af_kore`) | C+ | | 14 | Alice (`bf_alice`) | D |
| 7 | Sarah (`af_sarah`) | C+ | | 15 | Lily (`bf_lily`) | D |
| 8 | Alloy (`af_alloy`) | C | | | | |

**That is the answer to "more female voices":** the wire's prebuilt table (`src/js/live.js`) offers fewer,
and the browser's list is whatever the machine happens to have - Kokoro offers fifteen by name, each with
a published grade, for free. The trade is speed, and it is not hidden.

## WHAT WENT WRONG - MEASURED ON THIS MACHINE, NOT ASSUMED

A 6-core Intel laptop with a gen-9 iGPU:

- **Load:** ~1.6 s warm, ~10 s cold, ~90 MB pulled once per browser (then cached).
- **q8 / wasm:** real-time factor **≈ 2.0-2.8**. Slower than real time - two to three seconds of work per
  second of speech.
- **q4f16 / WebGPU:** real-time factor **≈ 1.34**. Faster, lower fidelity. That is the reason the engine
  has a `device` knob at all.
- **THE FREEZE, and why the Worker is not a nicety:** imported into the PAGE ITSELF, kokoro froze the
  whole terminal - **11 seconds for a single short sentence**, and a second call left the tab
  unrecoverable for **more than a minute**. It was the first instinct (a plain dynamic import) and it was
  wrong. In a **blob-shimmed module Worker** the same call is fine and the terminal stays live. The Worker
  is the load-bearing part of this build.
- **The roll-call:** so the choice could be made by ear instead of by a grade,
  `scratch/kokoro/kokoro-females-rollcall.wav` was rendered - **72.8 s, 24 kHz mono 16-bit PCM, peak
  32050** - each of the fifteen female voices saying her own name and then a line. Handed over in chat.

## WHAT WAS BUILT

- **`src/js/kokoro.js` (new)** - `window.kokoro`: the worker string, `load`, `roster`, `female`, `name`,
  `pick`, `say`, `state`, `release`, `warm`, and `design()` (which reads the shipped manifest through
  `voice.kokoroDesign()`, so the file list and the model list cannot drift apart).
- **`src/voice/voices.json`** - `engines.kokoro`; a `kokoro` block carrying the measured numbers and the
  fifteen-voice table above (with `why900` and `note_dtype`); `limits.kokoroMaxChars: 900` and its note;
  and two role picks: `roles.barbelo.kokoro.voice = "bf_emma"`, `roles.default.kokoro.voice = "af_heart"`.
- **`src/js/voice.js`** - the third road behind the same interface. `engineNow` can now answer `"kokoro"`;
  `mergeRole`/`defaults` carry a `kokoro` block; `kokoroVoice`/`kokoroSpeed` (the role's rate becomes the
  model's `speed`); `playPiece`, which plays without flickering the intercom lamp; `kokoroSpeak`, which
  chunks the text, **synthesizes one piece ahead while the current one plays**, and falls back to the
  browser voice if the model fails; the `speak()` branch, its receipt label and its ceiling;
  `/voice engine auto|browser|elevenlabs|kokoro`; and a full
  `/voice kokoro [status|voices|voice <NAME or #> [for <ROLE>]|voice default|warm|say <TEXT>|audition [N|from <NAME>]|device <wasm|webgpu>|release]`.
  `state()`, `summary()`, `describe()`, `limitsText()` and `setUi()` all learned it.
- **`index.html`** - one MODULES entry, `["kokoro","src/js/kokoro.js"]`.

**The two rules that keep it out of the way.** First: **`auto` never picks Kokoro.** A 90 MB fetch and a
slower-than-real-time engine must never be what a plain LISTEN press surprises him with, so it is chosen
by name, or by a role's own pick, and never otherwise. Second: **the 900-character ceiling is published
and enforced** (`limits.kokoroMaxChars`), because the model degrades on long inputs - a long reply is
CHUNKED, and the ceiling is where the engine stops pretending it can say a whole essay in one breath.

## VERIFIED LIVE (2026-09-30)

`/voice kokoro warm` → loaded in 1.8 s, 28 voices named. `/voice kokoro say <56 chars>` →
`{ok:true, engine:"kokoro", voice:"bf_emma", chunks:1}`. `/voice kokoro voice 1` → Heart; `... 3` → Emma;
`voice default` restored the shipped pick. `/voice max kokoro 700`, then `reset`. `audition 1` played and
printed its receipt. The engine setting was returned to `auto` afterwards, so nothing about his terminal
changed by default.

## WHAT WAS THOUGHT

**An idea marked "(maybe)" deserves a measurement, not an argument.** He did not ask for a voice engine;
he said there might be more female voices worth having. The honest move was to find out what Audionook
actually uses, count what it offers, put a number on what it costs on his machine, and then leave the
decision with him.

**A third engine has to be invisible until it is asked for.** Everything about this terminal's voice is
already an interface with two engines behind it (`speak()`, the roles, the `/voice` verbs); adding a third
is cheap there and expensive in the UI - so the engine is opt-in, `auto` ignores it, and the two rules
above are what make its cost (a big fetch, a slow engine) something he chooses rather than something that
happens.

**The Worker is a finding, not an implementation detail.** The fact that this model WILL freeze the tab on
the main thread is worth writing down, because the next person to reach for Kokoro will do exactly what
was done first here.

## STILL OPEN

- **Whether Kokoro stays at all.** It costs one module, a ~90 MB once-per-browser fetch, and it is slower
  than real time on this machine. It is inert while `auto` is in force. His word decides.
- **The roll-call is scratch**, so it dies with the session. If he wants the audition file kept, it has to
  be uploaded and referenced - it is not shipped, because nothing in the terminal plays it.
- **The grades are the provider's**, not this terminal's: Heart A, Bella A-, and thirteen graded lower.
  Whether a lower grade sounds worse *to him* is exactly what the roll-call is for, and only he can answer.

## FILES TOUCHED

`src/js/kokoro.js` (new), `src/voice/voices.json`, `src/js/voice.js`, `index.html` (one MODULES entry),
`src/README.md`, `src/TODO.md` (§1do), `src/chronicle/chronicle.json` (58 -> 59), `src/pack/files.json`
(155 -> 157, the two new modules) and this file. **NOT SAVED by the agent.**
