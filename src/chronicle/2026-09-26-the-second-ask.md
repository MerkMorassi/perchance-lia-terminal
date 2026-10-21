# THE SECOND ASK - A LOAD THAT LOSES A SCRIPT NOW HEALS ITSELF

2026-09-26 - the session that stopped treating a missing `src/` file as a mystery and made the boot
ask for it again.

## WHAT HE SAID

> "The other one starts up fine and allows for saving."

Said about the other tab's build, the one whose tree was older, and it was the whole diagnosis in one
line. This terminal was the newer one and it needed a reload or two to come up whole; the older,
smaller one came up first time, every time. What the newer build has that the older one does not is
**files** - and the first load of the page races the platform's file storage for them.

Later in the session, an attachment: the platform's own snapshot of that other browser
(`2hoy6c5u0x-snapshot-...zip`), which turned out **byte-identical to this workspace**, with a
`backup-manifest.json` inside it listing the 67 paths the generator wants and marking **62 of them
`pending`** - held locally, never uploaded. That is the same fact from the other direction, written by
the platform rather than observed by us.

## WHAT WAS BUILT

Three wounds, closed in three places (`index.html`'s startup watch, `src/js/main.js`,
`src/js/backup.js`):

1. **THE SETTLE TRACKER.** Every `<script src>` the page inserts is counted (initial scan +
   `MutationObserver`) and the count only reaches zero when each has fired load OR error. Nothing is
   decided until everything has settled, so a file still on its way can never be mistaken for a lost
   one. Without this, "ask again" would race the very files it is meant to rescue.
2. **THE SECOND ASK (scripts).** Any module still not on `window` once everything has settled is
   fetched again in `MODULES` order (`?again=<ms>`, `async=false`, each awaited before the next),
   **twice**, and only what fails both times raises the red `#bootFail`. The watch's own re-asks are
   tagged `data-again` and are never counted as new scripts. What was recovered lands in
   `window.__bootHealed`.
3. **THE SECOND ASK (data).** A `fetch` wrapper installed before any module runs: a GET whose URL is a
   `src/` path that comes back `!ok` **or throws** is retried once, 350 ms later, cache-busted.
   Everything else - other paths, other methods, and the response itself - passes through untouched.
4. **THE WIRING SURVIVES THE LOSS.** In `main.js`, every binding that reached into `forge.js`
   (`openForge`, `closeForge`, `createImages`, `splitPasted`, `randomSeed`, `saveForge`,
   `syncDeckSpace`) moved into `wireForge()`, which polls (400 ms, 60 tries) until the module exists
   and only then binds; the three bare calls left behind are guarded with `typeof ... === "function"`,
   the guard the rest of the terminal already used in four files. **`main.js` can no longer end
   early, so `boot()` always runs** - archive replay, the save-state line, `/help`, the lot.
5. **SAID ONCE, IN BACKSTAGE.** When anything was recovered, `boot()` says so in the veil's lane, and
   `/backup diag` prints the same list under "SOURCE FILES THAT DID NOT ARRIVE ON THIS LOAD AND WERE
   ASKED FOR AGAIN". A healed load is otherwise invisible **on purpose**: by the time boot runs,
   nothing is missing.

## WHAT WAS THOUGHT

**Why this is silent without the fix, three different ways.** A lost module can be a module that never
ran (`window.draft` undefined - the panel is simply not there), a module that ran and threw
(`main.js:235` bound a forge control; if `forge.js` lost the race, the throw ended `main.js` where it
stood and every binding after it died with it, including the `setTimeout(boot, 1500)` at the end), or
a DATA file that never arrived (`commands.js` reads `commands.json` with a one-shot fetch - a lost
response left a booted terminal with an empty command list and one console warning). The third kind is
the one that was easiest to mistake for something else, because the terminal looked alive.

**Why the second ask and not something cleverer.** Considered and rejected, in order:

- **Re-run everything on a loss** - would bind every listener twice and double every queue. No.
- **Auto-reload the page on a heal** - it would come up cleanly, but it would flash the whole terminal
  on roughly 40% of editor loads, and the second ask already lands the files. The cost of the chosen
  road is one wasted request per lost file per load, which is the price of not trusting the first
  answer.
- **Trust the first answer and only re-ask the ones that reported an error** - impossible: a lost
  `src/` file does not always report anything. That is what the settle tracker is for.
- **A retry loop with no end** - refused: an endless ask would hang the boot instead of reporting it.
  Twice, then the banner.

**The honest scope.** The race itself is the platform's, not ours - filed as bug `10203516`. This
build does not fix the race; it makes the terminal indifferent to it instead of silent about it. One
class is still out of reach (a module that runs, throws, and still leaves its global set - a
"half-run" file. Nothing re-runs it, by design, because re-running would double every listener; the
`typeof` guards are the answer to the call site that was found, and the rule for new code is the same
guard).

**And the tool that was supposed to see all this was blind.** `backup.js`'s `moduleCheck()` held a
hand-copied `want` list that had lost its last ten entries, so its diagnostic could never report
`tools`, `minibox`, `audition`, `keepsake`, `archivax`, `story`, `decks`, `chat`, `sync` or `draft`
going missing - exactly the files that were getting lost. It now reads `window.__bootModules` (the one
copy of the list, published by the watch) and keeps a full fallback beside it. **A hand-kept copy of a
list is a future lie**; this is the second one found in two sessions (the first is in THE MERGE).

## WHAT WAS WRONG FIRST, AND WHAT SETTLED IT

The first reading of the symptom was "the editor's preview is flaky" - true and useless. What settled
it was counting: **6 of about 12 reloads lost files (1, 7, 10 and 17 at different times, always a
suffix of the list), and every single one of them was recovered by the second ask**, with no banner
and no visible fault. Sixteen seconds after each load: all probed globals present, `cmd.count() ===
65`, no `#bootFail`, the archive replay line present, and a full forge open/close cycle by click. A
deliberately bogus `MODULES` entry proves the failure path too: exactly two attempts
(`__bootIssues` shows `?again=` twice), then the banner naming it, with the terminal whole around it.

**The state of the SAVED build, measured from inside the page** (same session, by request): the server
holds 60 `src/` paths - 49 byte-identical to this tree, **11 stale** (`README.md`, `TODO.md`,
`css/terminal.css`, `js/chat.js`, `js/main.js`, `js/backup.js`, `js/sync.js`, `js/commands.js`,
`commands/commands.json`, `pack/files.json`, `pack/index.html.txt`) and **7 absent** (`js/rtfm.js`,
`js/rtfm-edit.js`, `js/sync-cloud.js`, `rtfm/*`). The saved `index.html` asks for 39 scripts; this one
asks for 42 (the three extra are the rtfm pair and the cloud road). Nothing was saved or published.

## STILL OPEN

- **The save.** Asked in this session whether to reload: no. A reload changes nothing on the server. It
  only costs the chat. Press **SAVE** from a browser whose editor holds this tree, then read
  `/backup status` - it should name every file with nothing left pending (it read 60 of 67 that day,
  which is the same fact: the pack has grown since - 73 paths with THE CHRONICLE in it).
- **Do not save from the stale tab** (see THE MERGE) - the save is a whole-tree overwrite.
- The platform race (bug `10203516`) is not ours and will not be fixed here; expect the backstage line
  "the file storage lost N source files on this load" occasionally. It is not a fault in the terminal.
- One wasted request per lost file per load remains, by design.

## FILES TOUCHED

`index.html` (settle tracker, the script second ask, the `fetch` wrapper, the banner's wording, the
audit's schedule), `src/js/main.js` (`wireForge()`, two guards, the backstage line in `boot()`),
`src/js/backup.js` (`moduleCheck()` reads `window.__bootModules`, `diag()` prints
`window.__bootHealed`), `src/pack/index.html.txt` (regenerated), `README.md`, `TODO.md` (section 1az).
Nothing was saved or published.
