# THE SIGN ON THE DOOR - THE 18+ LISTING AND THE CHECKBOX AT THE ENTRANCE

2026-09-30

## WHAT HE SAID

After the BOUNDARIES rewrite (see THE BOUNDARIES BLOCK BECOMES THE SITE'S HOUSE RULES), asked whether
the generator's own listing should carry the 18+ line:

> *"Yes, even though it is me and her for the moment. ... If the context creative, allegorical,
> symbolic, fictional, etc. get a simple 18+ checkbox on initial page load."*

And then, flatly:

> *"This site is 18+ NSFW by default."*

## WHAT WAS BUILT

**THE SIGN - `$meta` in `main.pjs`, which the generator did not have at all.**

Three consequences of having none, all of them wrong here: the listing card and every share image were
an AUTOMATIC SCREENSHOT of whatever the terminal happened to be showing; the browser tab took its
title from the file; and nothing told a visitor what kind of place this is before they opened it. It
now carries:

- `title = LIA TERMINAL (18+)`
- a `description` that opens `18+ NSFW BY DEFAULT`, says the work is creative, allegorical, symbolic
  and fictional, between grown adults, and ends by naming the confirmation at the door
- `tags = ai chat, roleplay, creative writing, terminal, adults only, 18+, nsfw`
- an `image` - a generated CRT (black screen, phosphor-green glow, a faint concentric sigil, no
  readable text anywhere), which is a picture of the DOOR rather than a live screenshot of the log

**THE DOOR - a simple 18+ checkbox, on screen before anything else loads.**

- **Markup in `index.html`, at the very top of `<body>`**: an opaque black overlay, `position: fixed`,
  `z-index: 2000` (over the gallery at 900, the mini box at 950, the manual editor at 960 and the
  full stage at 1000), holding a bordered panel - the title, `18+ · NSFW BY DEFAULT`, two short
  paragraphs, a checkbox that must be ticked, `ENTER` (dead until it is), and `NOT 18 · LEAVE`.
- **Behaviour in `src/js/agegate.js`** (`window.agegate`), added to the `MODULES` boot list and
  loaded last: it reads the answer, closes the door when the answer is there, wires the box and both
  buttons, and prints one receipt on the stage per opening.
- **The answer is one record on this device**: kv `lia_settings` / `agegate`,
  `{ ok: true, at: <ms>, zone: <the clock's zone> }` - the moment it was given and the zone it was
  given in, taken from `logtime.js` so the two clocks can never disagree. Nothing is uploaded,
  nothing is sent to the model, nothing is written into `src/`. Anything that is not `ok: true` reads
  as NO ANSWER.
- **`/agegate [show | forget | status]`** - show the door again for whoever is at the screen, take
  the answer off the device so the NEXT LOAD asks, or print what is kept. In `chat.js` beside
  `/stamp`, in `commands.json` (75 -> 76, so `src/rtfm/commands.md` was regenerated) and in
  `HELP_TOPICS` + the master help list as `/help agegate`.

## WHAT WAS THOUGHT

**The door has to be markup, and that decides everything else.** The obvious build is a script that
draws an overlay when it finds no answer. It is less code and it races the first paint - and the
whole point of the door is to be up BEFORE anything underneath it is readable. So the markup ships in
`index.html`, which the engine renders before any script runs, and the module is only the behaviour.
The immediate consequence is the rule the rest of it follows: the door shows by default and the module
CLOSES it, never the other way round.

**IT FAILS CLOSED.** A `src/` file is only on the server once the generator is SAVED, so
`agegate.js` 404ing on a phone or the public URL is a real case, not a theoretical one - and in that
case a script-wired door is a gate with no handle: unreachable for everyone, including him. So the two
buttons are wired a second time by a plain-ES5 fallback at the very foot of `index.html`, the same
argument as THE STARTUP WATCH at the top of the file. It tests `window.agegate`, does the same kv
read and write, and does exactly one thing less (no receipts, no `/agegate`). If that never runs
either, the markup is still up and the door stays shut. That is the correct direction to fail in, and
it is the reason the fallback is not optional polish.

**The screenshot is the part that is easy to miss.** With no `$meta.image`, the platform
auto-screenshots the generator for the listing card. On this generator that means a public image taken
of whatever the log was showing - unbidden, unchosen, and possibly explicit. The generated CRT exists
to make that impossible, and it is generated rather than screenshotted for exactly that reason.

**The `nsfw` tag is load-bearing, and it was checked rather than assumed.**
`/api/getGeneratorStats` showed this generator's platform label was ALREADY `tags: ["nsfw"]` - the
code had no `$meta` at all, so that came from the platform's side. The `$meta` tag list keeps `nsfw`
in it so the classification survives whichever way the two are merged. Guessing here would have
risked a generator that is 18+ in the door and SFW in the list.

**Rejected: a date of birth, or any "verification".** He said "simple 18+ checkbox". A fake
verification step is theatre, and theatre is not a door.

**Rejected: gating anything on the answer.** No lane, no command and no reply consults it. The door
is a sign and an honest click; a terminal that withheld function until a box was ticked would be a
different product, and nothing in his message asked for one.

**Chosen: the door states the rating, her prompt states the rules.** The BOUNDARIES block carries the
site's house rules into every turn, and `LIA_IMAGE_POLICY` carries the picture half into the prompt.
The door says what kind of place this is; it does not repeat her rules, and her rules do not describe
the door.

## WHAT WENT WRONG

- **`snapshot.js` - the full-page capture helper - hangs on any element in this session.** Tried on
  the door to look at it: the page froze mid-eval and had to be hard-reloaded. So the door could not
  be judged by eye; it was verified by geometry (it covers the viewport, it is opaque, the panel fits
  at four sizes, the checkbox and both buttons are inside it) and by driving it. Noted because the
  first thing anyone sees deserves a look, and a future session with a working capture should LOOK at
  `#ageGate` at 390x844 before trusting any of this.
- **The door harness reported two FALSE failures on its first run** - the `/agegate show` and
  `/agegate forget` receipts "missing". It asserted against THE LAST LINE ON THE LOG, and a freshly
  loaded page keeps printing its own boot report asynchronously: a boot line landed after the receipt
  and the assertion read that one instead. The door was never at fault; the harness now marks the log,
  acts, and searches everything added SINCE the mark.
- **The fallback could not be tested the obvious way.** Blocking the module by overriding `window`
  in a preamble was rejected: it cannot distinguish "the fallback wired this" from "the module wired
  this", because both use `addEventListener`. So the harness EXTRACTS the fallback and the markup
  verbatim from `index.html` at run time and runs them in a throwaway iframe with no module and no
  kv - which is the 404 case, actually exercised, with no retyped code.

## STILL OPEN

- **The listing only changes when he SAVES.** `$meta` is read from the saved code, so until then the
  public card still reads `2hoy6c5u0x` with an empty description. One `getGeneratorStats` call after
  the save is the confirmation.
- **No per-session middle ground.** The answer is permanent per browser until `/agegate forget`. A
  per-session variant is one comparison away (the record already carries `at`), but it was not asked
  for and permanent is the honest default for a rating.
- **A rename still moves the origin** - and with it this device's kv, the door's answer included.

## FILES TOUCHED

`main.pjs` (`$meta` + its banner comment), `index.html` (the `#ageGate` markup and comment, the
fallback script at the foot, the `MODULES` entry, the script tag), `src/js/agegate.js` (NEW),
`src/css/terminal.css` (the door's styles), `src/js/chat.js` (`/agegate`, `HELP_TOPICS`, the master
help list, `/help agegate`), `src/commands/commands.json` (76), `src/rtfm/commands.md` (regenerated
from the live list - adding a command changes it, so it is not optional), `src/README.md` (the 18+
notice at the top, two file lines, the new THE DOOR section), `src/TODO.md` (§1ck),
`src/chronicle/chronicle.json` and this file, and `scratch/door1.js` / `door2.js` / `door3.js` (the
harnesses - ephemeral, not shipped). `src/pack/files.json` regenerated (121 -> 123) and
`src/pack/index.html.txt` + `src/pack/main.pjs.txt` refreshed, since both root files changed.
