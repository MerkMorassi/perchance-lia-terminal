# THE PROGRESS BAR - ONE GREEN LINE, AND WHAT THE MACHINERY IS DOING

2026-09-26 - a short session after the chatlog work, in which the terminal was given the smallest
possible answer to the question a long job should never leave open.

## WHAT HE SAID

One line, in the middle of other business:

> *"We need a simple green progress bar element when actions require time to process"*

That word - **simple** - is the whole specification, and it is the part that decided every design
question below. The temptation in a codebase like this one is to build a job system: a queue, a
registry, per-panel widgets, a history of what ran. What he asked for is an ELEMENT.

## WHAT WAS TRUE

The work that takes real time here was already spread across a dozen modules, and each one announced
itself somewhere different: `#cpProgress` in the forge's panel head, `#tlState` in the tools panel
head, a SYSTEM line in the log at the END. So the sign of life existed, in three places, in three
shapes, and none of them was where his eye was - which is the conversation, or the input box he just
typed into. A classifier pass over 2,297 records could run for twenty minutes with the only visible
evidence being a thumbnail chip that says WHICH picture is in hand and a tile spinner in the log.

There was also a specific asymmetry worth naming: the machinery was very good at saying what it HAD
done (receipts, at the end, in detail) and very bad at saying what it was doing NOW.

## WHAT WAS BUILT

`src/js/progress.js` (`window.progress`) and one element: `#progressRail`, the thin green line at the
top of the LOWER DECK, above the attach strip, the bus, the input and the controls. Hidden until a job
opens one, gone when the last job ends.

The API is three calls, and everything else is derived from them:

```js
var P = window.progress.begin("UPSCALING", { total: list.length });   // opens (or CONTINUES) a job
P.set(i + 1);        // or P.step() ; P.setLabel("...")
P.finish();          // ...or P.fail("the reason"), shown in the house red
```

- **No `total` = INDETERMINATE** - a 34%-wide segment sliding across the track. A one-render job has no
  fraction to report, and a bar that invents one is worse than a bar that admits it cannot.
- **Nesting by PRIORITY** (default 1, newest of equals). Jobs really do nest here: the forge's batch
  has a count and the image-service call inside each picture has none. The rail shows the highest
  priority, and a job that ends never blanks a job still running.
- **A finished job lingers** 1.6 s (a failure 5 s, red) so the bar's disappearance does not read as a
  glitch - and a failure's reason is readable.
- **Repaints are throttled** to 120 ms, but begin/finish/fail paint at once: a loop that ticks
  nineteen times in eighty milliseconds must not reflow the deck nineteen times, and the last state
  drawn must not be a lie.
- **An id already running is CONTINUED, not duplicated.** This is the load-bearing detail: a run
  opens the rail with the job's title and no count, and the `apply` that knows the total re-opens the
  same id - so one job is one bar however many places know about it.
- A long label is ellipsised, never wrapped: the rail must not grow a second line and shove the input
  box down as the count changes.

**WIRED INTO** the forge's batch; `renderImage` (priority 0, and opened INSIDE the `oneAtATime` job,
not at the queue - a claim opened at queue time would be ended by the render ahead of it and never
reopen); `upscaleLocal.run` (priority 0, `retire` inside a `try/finally`); every `/tools` job (a count
in each `apply`, a SCAN on its own id so it cannot take down a run's rail, and `runJob`'s `finally` as
the backstop); `backup.download` (counted off `collect`'s existing `onStep`); the chatlog's read-back,
write and export (counted in chunks); the sync's folder look (counted per file) and its up/pull; the
cloud road's send and receive (closed by `fail()` too); the gallery's import; `attach.sampleFrames`
(counted per still) and `attach.add` (only for a message carrying more than one file); and
`audition.learn` (whose label changes from the local reduction to the listening, because those are two
different waits). `/progress` reports, `/progress demo` runs a fake job through the same door, and
`/progress clear` unsticks one.

## WHAT WAS THOUGHT

**A readout, not a control, and not a record.** Nothing on the rail is pressable, nothing is written
to kv, no history of what it showed is kept. That is deliberate: the moment a progress bar becomes a
log of what ran, it is a second source of truth about the machinery, and this terminal already has
exactly one (the archive) and a receipt lane (`/syslog`, the SYSTEM lines). A bar that forgets is a
bar that can never disagree with the record.

**It is not the in-hand chip, and the two are read together.** `window.inHand` (src/js/minibox.js) is
WHICH picture the machinery is working on - a thumbnail, a citation, a 20-second lease, pressable for
a look. The rail is HOW FAR ALONG. A sweep reads both at once: the rail says `UPSCALING 372 / 1144`
and the chip shows the 372nd picture. Two questions, two elements, no overlap.

**Where a count already existed, it was used.** `collect` already had `onStep(path, i, total)`; the
classifier already had `out.tried / list.length`; the chatlog already looped chunks. The rail was
attached to the existing number rather than a second counter being invented next to it - the two
would drift, and the panel line would then be the honest one and the bar the liar.

**The autosave was left silent on purpose.** `backup.js`'s autosave builds an 84-file zip at boot when
the source is not all on the server. It is slow, it is real work, and it was deliberately NOT given a
bar: it happens before he asked for anything, and a bar that appears by itself is the one place this
terminal would be answering a question nobody asked. Wiring fewer things was a decision, not an
oversight.

**The `+N` on the label.** A hidden job is how a progress bar lies by omission: two things running and
one shown reads as "only one thing is running". The label carries `+1` when another claim is live, so
the rail always admits the count.

## WHAT WENT WRONG

**One real bug, caught by a real test rather than by reading.** `window.chatlog.all()` is exported and
is a whole job on its own (it reads every chunk back), and the first wiring left the rail up forever
after it: `readAll` opened a claim and only `put`/`exportIt` closed one. It was found by running the
read-only pass and finding `active() === 0` had become 1 with the rail still visible. The fix is that
`readAll` closes its own claim, and `exportIt` opens its indeterminate half AFTER the read (so the
label is true for the half it describes). The lesson generalises and was applied everywhere else: **a
function that can be called as a whole job must close what it opens** - the caller may not be a lane
that knows about `progress` at all.

A second, smaller one: a `600px`-wide determinate fill measured 100% in one early reading. It was the
`transition: width 0.13s` interpolating between two states of the same element inside a single
measurement, not a layout bug - confirmed by measuring a throwaway element with the same classes
(34% exactly) and by re-measuring over time (settles immediately). Worth writing down because it cost
ten minutes and looked exactly like a cascade bug.

## MEASURED

Module at rest: rail `hidden`, `active() === 0`, four empty nodes in the DOM. At work: `UPSCALING
3 / 10` → `30%` fill and `30%`; a priority-0 job opening under a priority-1 one → the 1 stays and the
label gains `+1`; finishing the 1 → the 0 drawn at once (`width: 34%`, `pgSlide` 1.15 s); `fail` →
`rgb(255, 85, 85)`, `FAILED`, `.pgDone`; `clear` → hidden.

A REAL read-only pass (`/tools folders` scan - changes nothing) → `SCANNING · PROPER FOLDERS`,
indeterminate, gone after, the vault unchanged at 2,297 records. A REAL counted pass that writes
nothing (the whole chatlog read back) → `READING THE RECORD 0 / 19` → `19 / 19`, claim count back to
0, and the record's fingerprint still `e291ad08-3829b2`. A REAL backup with the anchor's `click`
stubbed so no file was written → `PACKING THE BACKUP 29 / 84` → `84 / 84`, 88 files in the zip,
0 errors.

Geometry: at 793 wide the rail is 753 px inside the deck's 20 px padding and above the input,
`scrollWidth === innerWidth === 793`. At 390×844 it is 366 px inside the deck's 12 px padding, 33.7 px
tall, the label unclipped, `scrollWidth === innerWidth === 390`, the deck 172 px (it grows upward and
the docked panels move with it).

No screenshot helper was used: this page has no canvas, and the standing note from earlier sessions is
that the snapshot helper wedges this preview. The rail was therefore verified by computed style,
geometry and live state transitions. It is a plain DOM element in the house palette, not a rendered
surface, so there is nothing a picture would have shown that these did not.

## STILL OPEN

- **The rail is in the LOWER DECK, so a hidden lower deck hides it.** That is consistent (the bus, the
  story strip and the in-hand chip all live there), but a `/tools` sweep started from the panel while
  he then puts the deck away has no visible bar. If it ever matters, the rail can be lifted to a fixed
  position under the status line without changing a single caller - the element and the module are
  independent of where the markup is.
- **The `retire` step of a local upscale and the `zip()` half of a backup have no inner count.** Both
  are covered by an indeterminate or outer count; neither is a silent wait.
- **A job that never calls `finish()` still holds the rail.** `progress.clear()` and `/progress clear`
  are the manual way out, and no current caller is known to do it - but a lease (the in-hand chip's
  mechanism) was considered and rejected: a classifier pass legitimately runs for twenty minutes, and
  a lease would take a bar down in the middle of the work it was describing.

## WHAT THE NEXT SESSION SHOULD KNOW

The house rule this feature settled: **a job says what it is doing while it does it, and it says it in
ONE place.** If you add a long operation, open a claim with `window.progress.begin(...)` and close it -
in a `finally` if there is any path out of the function that is not the normal one, and with your own
id so two of the same job cannot stack. If it has a count, give the count (the panel line and the rail
should be the same arithmetic, not two counters). If it does not, do not invent one; an indeterminate
segment is the honest shape. And a function that can be called as a whole job of its own must close
what it opens.

## FILES TOUCHED

`src/js/progress.js` (**NEW**), `index.html` (the rail markup and its comment, the `MODULES` entry,
the `<script>` tag), `src/css/terminal.css` (the rail block), `src/js/forge.js`, `src/js/images.js`,
`src/js/upscale-local.js`, `src/js/tools.js`, `src/js/backup.js`, `src/js/chatlog.js`, `src/js/sync.js`,
`src/js/sync-cloud.js`, `src/js/gallery.js`, `src/js/attach.js`, `src/js/audition.js`, `src/js/chat.js`
(the `/progress` dispatch and the `/help progress` topic), `src/commands/commands.json` (70 commands),
`src/rtfm/commands.md` (**regenerated**), `src/pack/*` (**regenerated**), `src/README.md` (the
`progress.js` bullet and THE PROGRESS BAR section), `src/TODO.md` (1bg), and this entry.

## THE SAVE (THE SAME DAY, AFTER THE WORK)

He saved it himself, and it is a clean save - checked against the server rather than trusted. The
server's own `lastEditTime` is `2026-09-24T18:47:42Z`; the saved `modelText` is 61,895 bytes and the
saved `outputTemplate` 77,627, and BOTH ARE BYTE-IDENTICAL to `src/pack/main.pjs.txt` and
`src/pack/index.html.txt` - i.e. what went up is the copy the rail was built and measured in (the rail
markup, its comment and the `src/js/progress.js` script tag are all in the saved `outputTemplate`).
`srcManifest` lists 85 paths, and all 85 serve from the public origin with a hash identical to the
local file: none missing, none extra. `window.generatorIsUnsaved` now reads `false`, and the generator
is private. `/backup status` therefore says `85 OF 85 SOURCE FILES ARE ON THE SERVER - EVERYTHING HERE
IS SAVED`, where it said 60 of 85 all through the work. Nothing was published beyond the platform's own
save, nothing was renamed, and I did not save it - he did.

**One consequence, and it is the ordinary one:** this entry and `src/TODO.md` were edited AFTER that
save (to record it), so those two files are now newer than their server copies. That is a *stale* file,
not a *never-saved* one - `/backup status` lists the two categories separately, and it is the
never-saved list that matters on a fresh device.
