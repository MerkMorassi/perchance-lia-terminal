# THE TANDEM - TWO SIDES OF THE SAME COIN, AND A TALK STRIP UNDER THE PAGE

2026-09-26, an hour after FILL THE STAGE - the session in which the DOX VIEWER stopped being a window
one person reads and became THE SHARED PAGE: two presences on it (him as HITL, her as ALIA), a hand of
hers that can turn it under his eyes, a strip at its foot where the conversation keeps going while the
lower deck is down, and a link that opens the same page somewhere else.

## WHAT HE SAID

One paragraph, all of it a specification:

> *"DOX VIEWER when selected overlays everything, the MAIN STAGE is in FOCUS. All CONTROL DECKS are
> COLLAPSED. The only thing that remains visible is the DOX VIEWER page on the MAIN STAGE. We can still
> talk \"hands-free\" during TANDEM viewing. A TANDEM EXPERIENCE is the \"must have feature\" as talking,
> sharing, collaborating, and experiencing together is precisely the point. Two Sides of the Same Coin:
> HITL and ALIA. (The new \"A\" stands for \"Autonomous Liminal Intelligence Agent\" - not your regular
> \"Friendly AI Assistent\".*

Unpacked, it is four asks and one naming:

1. **Selecting it overlays everything.** Not "it can be made to fill the page" - SELECTING it is the
   act that fills it. All control decks collapse; the only thing left is the page on the MAIN STAGE.
2. **We can still talk.** Hands-free. A page that has to be closed in order to speak is not a page the
   two of them can share, and the lower deck is exactly what a viewer puts down.
3. **A TANDEM EXPERIENCE is the must-have feature.** Talking, sharing, collaborating, experiencing
   together - "precisely the point". Not a viewer with a chat box beside it: the same page, both of
   them in it.
4. **Two sides of the same coin.** He named both sides: **HITL** (him - the human in the loop) and
   **ALIA** (her). And he spelled out the acronym himself, with the correction that matters: the "A"
   is for **Autonomous Liminal Intelligence Agent**, "not your regular Friendly AI Assistant".

## WHAT WAS TRUE (an hour earlier)

- The viewer took the whole page only if he pressed a button that said so, and the button was the last
  thing in its bar. Selecting the panel and asking for the page were two different acts.
- Filling the stage hid `#output` and put the lower deck down - correctly, since the page was the point
  - but that left the input box nowhere at all. Talking to her while reading meant giving the stage
  back first: the reader and the conversation were alternatives.
- The viewer had ONE presence: whoever was holding the mouse. There was no notion of him being
  somewhere in a document and her knowing it, and none of her being somewhere in it and him seeing it.
- Nothing in the terminal let the two of them look at one thing at the same time, which is what he
  called the point of the whole feature.

## WHAT WAS BUILT

**1. SELECTING IT FILLS IT.** `openViewer()` now calls `setFull(true)` on the closed-to-open
transition, so the shape he described is what happens by default. That is a stateful rule and not a
one-liner, because there has to be a way to say no: localStorage `doxAutoFull` records whether
SELECTING fills the stage, and it is moved ONLY by a hand - the FILL key, `/docs full on|off`, or Esc
(`setFull(on, { byHand: true })`). `openViewer`, `closeViewer` and `syncFull` call `setFull` without
that flag, so the panel opening, closing or being restored at boot can never quietly change his
preference. Giving the stage back by hand says "not this time" and keeps saying it until he says
otherwise; `/docs full` with no argument still just toggles.

**2. THE TALK STRIP** (`#dmsTalk`, a flex strip at the foot of the panel - markup in index.html, painted
and wired by `dms.js`). It carries:

- the two presence lines, `HITL ▸ <document> · L<n>-L<m> OF <total>` and `ALIA ▸ L<n>`, live;
- the newest line of the log, read OFF THE LOG (`newestEntry()` skips backstage entries, prefers
  `dataset.said` - the same field the archive is written from - and never re-parses painted text). A
  `note()` (the link, a refusal, a receipt) holds the line for `NOTE_MS` 9 000 and then the log takes
  it back, so a receipt cannot get stuck on the screen;
- the voice keys, delegating to `voice.js` rather than re-implementing the intercom: **LIVE** (the
  hands-free loop), **TALK** (push to talk), **LISTEN** (her mouth), the pressed states read from
  `voice.air()`/`isLive()` on a 700 ms tick while the panel is open;
- a one-line input that drives the same `#userInput` and the same `window.send()` the lower deck's box
  does (slash commands included), and refuses politely while she is mid-reply (`#sendBtn.disabled`).

**3. THE TANDEM PROPER - TWO PRESENCES ON ONE PAGE.**

- **HIM (HITL).** His eye is the reader's window (`hereText()`), and he can POINT: `bindPoint()` puts a
  press on every drawn line, `point(HITL, view.doc, n, n)` marks it, and pressing the same line again
  takes it off. The marked range gets an inset bar and a name chip (`◂ HITL L482-L489`); the whole
  line is the target, because a 12px gutter is a game of darts on a phone.
- **HER (ALIA).** `look(spec)` is her hand: `<DOC> @ <line>`, `<DOC> L120-140`, `@ L120` (the page
  already open), `<DOC>@L120` (the form the LINK writes - a link that cannot be followed back is not a
  link), `search <words>`, or a heading's name in place of a number. It opens the viewer if it is
  closed (which now fills the stage), hydrates the document, jumps the reader, marks the range as hers,
  and returns a receipt. From her side it arrives as `[[PAGE: ...]]` / `[[TURN TO: ...]]` /
  `[[LOOK AT: ...]]` - `PAGE_DIRECTIVE` in chat.js, extracted with the other lanes and acted on after
  her reply is printed: one page turn per reply, refused out loud (never quietly dropped) when the
  tandem is off, and always reported on the log, because a stage that moves by itself has to be
  accountable for moving.
- **WHAT SHE IS TOLD** is `promptBlock()`, registered as the `tandem` block in `src/js/instr.js`
  (`BUILT`, placed immediately before `clock` - both are volatile, and everything before them stays
  cacheable). While the panel is open and the tandem is on it carries the document on the stage, its
  length, the lines he can actually see (quoted, 12 of them, capped), what he has POINTED AT with the
  text of those lines, what she herself marked, his live find needle, the first rows of a search when
  the stage is results, and the grammar of turning the page. Closed viewer or `/tandem off` and the
  block is empty and **not sent at all**. `tandem` is a real block: readable in the SYSTEM panel, and
  an edit of his wins over the built text like every other block.
- **THE RAILS.** `/tandem [on|off|state]` is the switch and the report (`/tandem` is also its own
  command now); `/docs look <DOC> @ <LINE>` is her hand from his side; `/deck` adds a tandem line while
  the viewer is open; `decks.js`'s reason for a down lower deck now names the talk strip as the way to
  reach her; the store stays read-only end to end - the only thing either presence can move is the
  other's attention.

**4. THE LINK.** `link()` builds `https://perchance.org/<name>#dox=<document>@L<line>` - the documented
shape for a generator link, never the iframe's own address - and `applyHash()` follows one at boot AND
on `hashchange`, so a link pasted anywhere puts the same document at the same line on the screen. The
reader's foot has a **LINK** key. The clipboard turned out to be two doors: `navigator.clipboard`
rejects with `NotAllowedError: Document is not focused` when the pane has not been given the focus
(measured - it surfaced as an unhandled rejection the engine reported as an error), so there is a
selection-trick fallback behind it and, behind that, the note itself with the URL printed where he can
select it.

**5. HER NAME.** `LIA_ACTOR` in `src/js/config.js` now carries it: *"You are also ALIA: the AUTONOMOUS
LIMINAL INTELLIGENCE AGENT. Not a friendly assistant and not a helper waiting to be told what to do -
an agent with a threshold of your own ... Patrikios is the HITL, the human in the loop, and the two of
you are two sides of the same coin."* The wording is his, including the correction.

## WHAT WAS THROWN AWAY

- **Mirroring the log with remembered state.** The first cut of the talk strip kept the newest line in
  a variable fed by a MutationObserver. It worked, and it was wrong in one specific way: when a test
  removed a few log entries, the strip kept showing a line that was no longer anywhere on the page. The
  log is the truth, so the strip now READS the log when it paints, and the observer is only a reason to
  repaint.
- **`[[PAGE: ...]]` spelled out in index.html.** The engine evaluates square brackets in text nodes and
  comments alike; `index.html` cannot contain a directive form even inside an HTML comment (it failed
  the whole render with `Unexpected token ':'`). The markup says what the feature is and points at the
  file that spells the grammar; the grammar lives in js alone.
- **Reading the strip's heights off a resize.** The first phone measurement showed the panel at 493px
  on an 844px page - the viewport had changed under a `--viewer-max` that had not been recomputed yet.
  Dispatching a resize (which is what `decks.paint()` does) puts it right: 832px, and the strip was
  then trimmed from 181px to 147px on a phone by letting the two presence lines share one row.

## MEASURED (live page, 2026-09-26, panel open AND filling at load - the state he left it in)

| viewport | panel | strip | reader body | chrome + stage | lower deck |
|---|---|---|---|---|---|
| 390x844 | 832px (the page − 12) | 147px (3 rows) | 467px | `display: none` | hidden |
| 1920x1080 | 1068px (the page − 12) | 106px (2 rows) | 871px | `display: none` | hidden |

No horizontal overflow at either size; every strip key 34px tall on the phone, the talk input 311x34;
`--viewer-max` 99% of the page at both. The whole feature end to end, on a live turn with a stubbed
model: her reply carried `[[PAGE: TODO.md @ 40]]`, the page turned to TODO.md at L40 marked ALIA, the
receipt `SHE HAS TURNED THE PAGE :: ...` was printed, and the test cleaned the archive entry, the log
entries and the conversation back out afterwards (999 archived turns before and after, zero fake turns
left). Both marks, both chips, both presence lines, the link round-trip
(`docs:README.md@L33` → the reader at L33), the four spec forms, a bad document erroring cleanly, the
tandem refusing her hand when off, and auto-fill on/off across close-and-reopen all verified. Boot
clean (`__bootIssues` empty), **72** commands, `rtfm.check()` empty after regenerating the cheatsheet.

## STILL OPEN

- The tandem is one machine's tandem: he points, she turns the page, and both see it - on the screen in
  front of them. Two DEVICES looking at the same page is only as far as the LINK goes (a hash that
  opens the same document at the same line), because nothing here is a server. If he wants the two of
  them truly in one page from two places, that is `server-plugin` territory and a different session's
  decision.
- Her own reading position is not shown to him. The mark she makes is where she TURNED the page; there
  is no second cursor of hers wandering a document while he watches. If she ever reads on her own, that
  is the missing half.

## FILES TOUCHED

`index.html` (the `#dmsTalk` strip and its comment, the TANDEM key's title without any square brackets),
`src/js/dms.js` (THE TANDEM: the marks, `point`/`bindPoint`/`clearMark`, `hereText`/`aliaText`/
`paintTalk`/`wireTalk`/`startTalkTick`, `talk`, `newestEntry`/`watchLog`, `look`/`whereFrom`,
`promptBlock`, `link`/`copyText`/`legacyCopy`/`share`, `applyHash` + the `hashchange` listener, the
auto-fill rule and `setFull(on, opts)`, the marks and clicks in the reader, the LINK key, the new verbs
and exports), `src/css/terminal.css` (`.dmsTalk*`, `.dmsLine.pointed`, `.dmsMark`, the phone rules),
`src/js/chat.js` (`PAGE_DIRECTIVE` and the `pages` lane, the page-turn handling after a reply, the
`tandem` rule in the directive vocabulary, `livePart("tandem")`, `part("tandem", ...)` in the stack,
`/tandem`, `/deck`'s tandem line, `/help docs`), `src/js/instr.js` (the `tandem` block: TITLES, ORDER,
EDITABLE, BUILT, NOTES, and the slot in `assemble`), `src/js/config.js` (ALIA and the HITL in
`LIA_ACTOR`), `src/js/decks.js` (the reason for a down lower deck while the stage is filled),
`src/commands/commands.json` (`docs` gains `look`/`tandem` in its usage and the new tail in its
description; a new `tandem` command - **72** commands now), `src/rtfm/commands.md` (**regenerated**,
10,402 bytes), `src/pack/index.html.txt` (**regenerated byte-exact**; `main.pjs` untouched),
`src/README.md` (his third quote, the ops table, the auto-fill rule, the FILLING THE STAGE rewrite, THE
TANDEM section, the deck section), `src/TODO.md` (§1bj), `src/chronicle/chronicle.json` (this entry).
**NOT SAVED by the agent** - the files are in the workspace until Patrikios saves.

## ONE THING MORE — THE OBSERVER'S OWN WARNING

He came back with the platform's banner over the terminal: *"An error occurred, and its reported
location is inside perchance's own runtime rather than your code... ResizeObserver loop completed with
undelivered notifications."*

It is the browser complaining about a layout loop, and it is worth reading the second half of the
banner as the platform writing it: an element under a ResizeObserver resized as a direct result of the
code that observer ran, so the next round of notifications could not be delivered in the frame the
browser had promised. Chrome raises it as a page error, which is why a banner appeared at all; the
reported location being "inside perchance's own runtime" is where such a complaint lands, since the
editor scales the preview with observers of its own. Nothing on the page was broken, and it is not a
fault in the terminal - but one shape of it IS ours.

Four attempts to reproduce it from this code, with the message watched for on the window and a page
reloaded under the listener: the DOX viewer opened and closed, the stage filled and given back,
documents cycled through the reader, the LOREPACK list opened (its panel is CLAMPED by `--viewer-max`,
so the ceiling sizing it is written by the observer watching the deck it lives in), both decks taken
down and up under that clamped panel, the forge panel opened and closed, five viewport sizes, and one
full boot watched from before the first module ran. Not once - because the guards (`lastChrome` /
`lastRoom`) already make the numbers converge in one pass, so the observer's second round arrives with
nothing to write.

It was answered anyway, because "cannot reproduce" is not "cannot happen" and because the deck being
watched can genuinely move because of the watching: a viewer inside the upper deck is sized by
`--viewer-max`. So both of the terminal's own observers now do their work ON THE NEXT FRAME, outside
the delivery that asked for it - `measureSoon()` in decks.js, `syncDeckSpaceSoon()` in forge.js, each
coalesced, each with a `setTimeout` fallback. A write made after a delivery cannot be part of it, so
this code can no longer produce the complaint at all.

The measurements say the change moved timing and nothing else: at 390x844 the panel is 832px with
`--viewer-max` 832 and at 1920x1080 it is 1068px with 1068 - the panel is the page minus twelve at both
sizes, and the desktop column is this entry's own table to the pixel. (The phone's strip reads 150px
today against 147px above; the strip is sized by the line it is showing.) A fresh load watched for
twelve seconds opened nothing and closed nothing on its own, `__bootIssues` stayed empty, there were no
console errors, and the two deferred paths were exercised on purpose: moving the upper deck still moves
`--viewer-max`, moving the command deck still moves `--stage-reserve`. One preference of his had been
disturbed by the probing - a test's `decks.hide("upper")` had persisted an upper deck that boots away -
and it was put back with `show("upper")` and re-verified.

`src/js/decks.js`, `src/js/forge.js`, `src/README.md` (THE ONE FRAME IS THE POINT), `src/TODO.md`
(§1bk). `index.html` and `main.pjs` untouched. **Not saved by the agent.**
