# THE DOX VIEWER - READ-ONLY DMS, A STAGE THAT STRETCHES, AND FILL THE STAGE

2026-09-26 - the session in which the terminal was given a way to READ ITSELF: one panel, one verb
list, four collections, and no write path at all. The same ask named the middle of the screen, and the
middle of the screen has been the MAIN STAGE ever since.

## WHAT HE SAID

Two paragraphs, after a restart that had lost nothing:

> *"Next AsK: DOCS VIEWER. In the docs TAB we need basic semantic search for simple DMS OPS (Document
> Management Operations) for read-only operations. The window or "MAIN STAGE" (as opposed to the
> CONTROL DECKS" can stretch to fill the page where it doesn't collide with the CONTROL DECK above or
> below the MAIN STAGE (formerly known as the "MAIN WINDOW""*

Read as a list of constraints, it is short and it is exact:

1. **in the docs TAB** - the DOCS panel he already had a button for (her memory's list). Not a new
   window.
2. **basic semantic search** - and `basic` is doing work: it must work without a key, and be right
   about the obvious question before it is clever about a subtle one.
3. **simple DMS OPS** - list, open, read, search, find. Document management, not a programming model.
4. **read-only** - he said it twice, in two different ways.
5. **the MAIN STAGE can stretch** - the conversation fills what is left between the decks.
6. **where it doesn't collide with the CONTROL DECK above or below** - and this is the half that
   turned into real geometry, because the decks move.

The parenthetical "(formerly known as the MAIN WINDOW)" is his own note that he had already renamed
the middle deck earlier that day. Both names are now in the code: `MAIN STAGE` is what everything
prints and what `data-deck` says, and `decks.js` still accepts `window` as an argument for it.

## WHAT WAS TRUE

- The terminal could READ ITS RECORD already (`/read`, THE READER, `reader.js`) - but only in her
  vocabulary and only through her door. There was no way for HIM to look something up in the shipped
  source, and no way to ask a question rather than name a target.
- The DOCS panel he had (the LOREPACK list) was a browser: files, sizes, a pager. Good at "show me
  what is here". Useless at "where does it say that".
- Search over the corpus existed TWICE (the LOREPACK's lane and the vault's), each with its own
  loader, and neither could be pointed at the shipped source.
- The page had no idea how much room the middle of it had. The log's bottom reserve was measured
  (`forge.js syncDeckSpace`), the panel's ceiling was a constant (`50vh`, raised to `68vh` while the
  lower deck was down), and the two could disagree.

## WHAT WAS BUILT

**ONE STORE, FOUR COLLECTIONS.** `src/js/dms.js` (2,401 lines, `window.dms`) is the store and the
panel. A document is a path, a title, a collection, a kind, a size, a line count, its fragments, and
a flag for whether its text is in hand:

    MEMORY   the LOREPACK, read through lore.js - 12 KB deep per document for the index, WHOLE when
             one is opened
    MANUAL   the RTFM pages, fetched from src/rtfm/<file>
    DOCS     the shipped prose - README, TODO, the chronicle, the packs
    DATA     the shipped json
    CODE     the source itself (2 MB, and NOT part of ALL - it is found by name)

    ALL = MEMORY+MANUAL+DOCS+DATA · SHIPPED = DOCS+DATA+CODE · each collection alone, plus aliases

**OPS, ALL READ-ONLY.** `list`, `search`, `open`, `read`, `head`, `outline`, `find`, `info`,
`related`, `stat`, `scope`, `index`, `reload`, `close`, `help`. The file has no write path - not a
guarded one, not a commented-out one. `/docs <OP>` in the terminal prints the same answers on stage as
SYSTEM receipts (the panel and the command share one `words(verb, rest)` function), `/docs help`
prints the list, `/help docs` explains it in the manual's voice.

**THE INDEX IS LAZY, THE LIST IS NOT.** `seedNames()` builds the whole document list from manifests
and metadata alone - 596 documents in 9 ms - so the panel opens instantly and the shipped sizes fill
in behind it. A document's TEXT arrives when something needs it: 12 KB for the index, the whole file
for `open`/`read`/`head`/`outline`/`find`. Fragments are cached per document WITH a signature of the
text they were cut from, so adding a document re-chunks one document and re-indexing is free for
everything unchanged. The ceilings are named constants rather than a freeze waiting to happen:
`MEM_SLICE` 12,000, `SHIPPED_SLICE` 500,000, `MEM_TOTAL` 5,200,000, `INDEX_CHAR_CAP` 600,000.

**SEARCH IS TWO LANES FUSED.** The words lane is BM25 over stemmed terms with forty `CONCEPT_GROUPS`
(weight 0.42) and bonuses for an exact phrase, a heading, and words that sit near each other. The
meaning lane is `embed.js`'s new generic `searchNs("docs", ...)` - the same model, the same
fragments, the same store the LOREPACK and the vault use. The two lists are fused with reciprocal
rank fusion. **The words lane is never allowed to need a key**: when the key is spent (it was, all
session - his Gemini quota was exhausted) search still answers, ranked, with `WORDS + MEANING`
degrading to `WORDS`. That is why `embed.js` grew `indexNs`/`searchNs` as GENERIC calls rather than
dms.js growing a third loader of its own.

**ONE PANEL, IN THE TOOL BAR.** `#dmsView` is a `.lorePanel` in the upper deck, `data-viewer="DOCS"`,
with the query box, the scope selector, the ops row and the body. The `DOX VIEWER` button on the
lorebar toggles it, opening it puts the LOREPACK list away (they share the room), and the same button
(after the first press) closes it. Views: the list, the results, the reader, the stats, the related
list.

**THE STRETCH.** `decks.js` grew `measure()`, which publishes two numbers on `:root`:

    --upper-chrome   what the upper deck takes when no viewer is open - the deck's height MINUS the
                     open viewers inside it, so a viewer's height never counts against itself
    --viewer-max     the page, minus the chrome, minus the room the lower deck stands on
                     (--stage-reserve, measured by forge.js), minus a floor for the stage
                     (a quarter of the page, kept between 110 and 240 px)

The viewer's ceiling is `--viewer-max`; the stage's bottom reserve is `--stage-reserve`; the stage is
`flex: 1` between the two decks, so the conversation takes whatever is left. Two viewers open at once
SHARE the room (divided by the count) rather than each claiming it - otherwise two panels at their own
ceiling add up to more page than there is and the stage is squeezed out, which is precisely the
collision the two variables exist to prevent. Writes are guarded (`lastChrome`/`lastRoom`) because a
ResizeObserver on a deck that a CSS variable resizes is a ping-pong waiting to happen.

## WHAT WAS THOUGHT

- **Why not one lane?** Because the meaning lane needs a key that can be spent, and a document tool
  that stops working when a quota runs out is not a document tool. Words or nothing is not a
  choice: both, fused, with the weaker one never load-bearing.
- **Why a slice for MEMORY and a slice for SHIPPED?** They are different documents. A memory document
  is recalled prose where the head carries the meaning; a shipped file is the source, where the head
  is a license header and the body is the point. 12 KB of memory, whole files of source, and a
  document opened is read whole - so `info`/`read`/`outline` never lie about a document they have
  only half of.
- **Why RRF rather than a weighted sum?** The lanes' scores are not the same kind of number (BM25 has
  no ceiling, a cosine is bounded), and any weights would be a lie dressed as a dial. Ranks are
  comparable; RRF is the smallest thing that uses them.
- **Why the ops are in `dms.js` and not in chat.js?** The panel and the command must say the same
  thing. One function, two front doors: `dms.words(verb, rest)` returns `{ok, text}`, the terminal
  prints it, the panel renders it.
- **Why is `CODE` not in `ALL`?** `ALL` is meant to answer "what does this terminal SAY" - prose and
  data. Two megabytes of javascript is not what anybody means by that question, and including it
  would put the source at the top of every result list for words like `function`. It is one scope
  word away, and a path-shaped reference (`code.js`, `js/chat.js`) finds it by NAME without the scope
  ever being named - the `docAsync` fallback widens to DOCS+DATA+CODE when the reference looks like a
  path.
- **Why does opening a document rebuild the index?** Because the fragments it was indexed under were
  its first 12 KB, and the document is now whole. The rebuild is a progress-bar job, so it is visible
  rather than mysterious, and it is the only time a read ever does work of that size.

## WHAT WENT WRONG

**The button that did nothing.** The panel is wired by `init()`, and `init()` is called again by a
retry timer until the markup is on the page. Without a guard, every listener was attached TWICE, and a
press toggled the panel open and shut again - which reads, from the outside, as a dead button.
Fixed with the `wired` flag (and `booted` for the remembered state), both documented where they are
declared, because the next person to add a retry timer needs to know why they exist.

**The freeze that was not one.** The first cut fragmented every document into the index ON OPEN. That
is fine for a README and not fine for the 9 MB archive, where the work is seconds of blocking. The fix
is the shape the file has now: the list is metadata, the text arrives per document, fragmentation is
cached against a signature of the text, and anything that indexes a lot yields to the event loop and
reports through the progress bar. Measured after: the archive opens in 1.9 s, 38,646 lines, 1,284
fragments, no freeze.

**A stale measurement.** `measure()` publishes numbers derived from the deck heights it measures, so
an early run can publish numbers from a layout that no longer exists - and it did (a viewer's ceiling
of 160 px on a 900 px page). It re-runs on `paint()`, on resize, and from ResizeObservers on both
decks, and the guards keep it a leaf rather than a loop. Worth knowing: a browser that resizes the
page without firing `resize` (some embedded/preview viewports do) leaves the last numbers in place
until something else moves - the numbers are correct at every real load, which is what a person
actually experiences.

**A page with no room for both.** The first cut of the stretch had a hole, and the numbers found it:
a viewer left open at load does not put the lower deck down (deliberately - see THE THREE DECKS), and
on a 505px-tall window that meant the upper deck's own bottom edge (313) crossed the fixed lower
deck's top edge (263), with the stage squeezed to 40px. Two limits closed it. (1) A viewer may never
reach past the deck's top edge (`deckTop - 24 - chrome`). (2) When the raw room is under the viewer's
minimum (160), the load exemption is dropped and the viewer becomes a reason like any other: the lower
deck stands down, which is Patrikios's own rule. Measured after, at 793x505: the deck stands down with
the reason naming the viewer, the panel takes 202px, the stage keeps its 126px floor, and the upper
deck's bottom edge (355) clears the deck's top edge (230). At 1440x900 and 390x844 the exemption
holds, as it should - the deck stays up and the panel still gets its room.

**A count of nothing.** `/docs stat` on a freshly loaded page answered `0 DOCUMENTS`, because it
counts what the store holds and nothing had been named yet. Seeding the names is 9 ms, so the op does
it before counting.

**The quota that ground.** `indexNs` used to try every remaining batch after a failure, and
`embedTexts` fell back from the batch endpoint to one-at-a-time - so a spent quota meant a minute of
silence and then the same error. Now a refusal (quota / rate limit / 429 / 401 / 403 / permission /
api key) is passed straight up: `index DOCS` answers with the service's own sentence immediately.

## MEASURED

Live page, 2026-09-26 (fresh load; text-only commands driven through the real input box, 0 model
calls):

| viewport | viewer closed | viewer open (lower deck stands down) |
|---|---|---|
| 1440x900 | chrome 117, reserve 218, ceiling 340, **stage 565** | reserve 24, ceiling 534, stage 225 (the floor) |
| 390x844 | chrome 87, reserve 162, ceiling 384, **stage 595** | reserve 24, ceiling 522, stage 211 (the floor) |
| 793x505 | chrome 153, reserve 300, ceiling 53, stage 52 (the window is 40px short of the floor) | deck stands down, ceiling 202, stage 126 (the floor) |

`scrollWidth === innerWidth` and `scrollHeight === innerHeight` in all states; the gap between the
stage and the lower deck is exactly the 24 px breath the reserve includes; and with the panel OPEN AT
LOAD on the two real sizes the exemption holds (the deck stays up, the panel 307 at 1440x900 and 350 at
390x844, the stage at its floor both times).

The store: 596 documents, 18,417 fragments, 16,481 distinct terms, 77.7 MB of text known to the index.
The list opens in 9 ms. Search from the panel: 20 rows, README's own section first, 375-411 ms for the
words lane over the whole corpus (16 ms on a repeat). A row press opens the reader at 260 lines
(`LINES 1-260 OF 6018` - the document grows with every session, and the reader is a window onto it).
OUTLINE on README: every heading as a chip (106 of them, and the count grows with the file), and a
chip jumps deep into the document (`LINES 1782-2041`). FIND on
`backup`: `60 LINES`, 20 marks in the window, `‹`/`›` to walk them. RELATED on README: TODO.md first.
`/docs stat`, `/docs list 5`, `/docs search backup`, `/docs open README.md`, `/docs help` all answer on
stage; `/docs bogusverb` is named as unknown. `rtfm.check()` is `""` (the shipped cheatsheet is
current, 10,220 bytes, 71 commands), an `index DOCS` against the spent key returns the refusal in
153 ms, and `embed.statusText()` carries the new `DOCS :: <n> VECTORS / <m> DOC FRAGMENTS` line.

VISUAL: no screenshot helper was used on this page - it wedges the preview (see the standing note) -
so the panel was verified the way this terminal verifies layout: `getBoundingClientRect` and computed
styles at both viewport sizes, plus the live state transitions above.

## STILL OPEN

- **The meaning lane for DOCS needs one press with a working key.** `INDEX THE MEANING LANE` in the
  ops row (or `/docs index DOCS`) embeds every document's fragments. His quota was spent for the whole
  session, so the lane is built but its contribution to a result list has only been observed on the
  parts that were already embedded.
- **The panel's remembered state** is on this device (localStorage `dmsOpen`), and the LOREPACK list's
  is deliberately cleared when the docs viewer opens, so the two never fight over the room at load.
- **Nothing is saved by the agent.** The 87 files, the two regenerated packs and the regenerated
  cheatsheet are in the workspace; `/backup status` will say so until he presses SAVE.

## WHAT THE NEXT SESSION SHOULD KNOW

- **The stage's geometry lives in `decks.js measure()`.** If you add a viewer, mark it `data-viewer`
  and it gets the machinery for free: the ceiling, the sharing, and the lower deck standing down are
  all consequences of the marking, not calls you have to make.
- **The words lane must keep working with no key.** Whatever you add to search, check it with the key
  removed (the panel's `WORDS` mode) - that is the mode the terminal will be in whenever a quota is
  spent, which is a real state and not an edge case.
- **`dms.js` writes nothing, and that is the contract.** The one thing it ever writes to storage is
  `lorepackDocsOpen` (so the LOREPACK list does not come back behind the docs viewer) and its own
  remembered panel state.
- **A document opened whole re-fragments and re-indexes.** That is by design; if you make the index
  smarter, keep the per-document signature or every open becomes a full re-index.

## THE SECOND ASK, AN HOUR LATER: THE NAME, AND THE WHOLE STAGE

He came back with four lines:

> *"'DOX VIEWER' (note the name change) can stretch and fill the MAIN STAGE, even closing the UPPER
> and LOWER CONTROL DECK as needed."*

**The name.** DOX VIEWER everywhere it is written - the tool-bar button, the panel's own tag, its
titles, the `/docs` usage and every reply it prints, `/help docs`, the `docs` entry in
commands.json, and this thread. The module, the file and the command keep their names (`dms.js`,
`/docs`): DMS is what the thing IS - Document Management Operations - and the ask renamed the VIEWER,
not the machinery.

**The mode.** `FILL THE STAGE` (the button in the panel's bar, or `/docs full`) gives the viewer the
whole page: the upper deck's status line and tool bar and the lower deck stand down, the conversation
goes with them, and the panel is pinned to the top at the page's height minus a 12px breath with its
own body carrying the scroll. `ESC`, the button again, `/docs full off` or the `×` gives the stage
back, and the decks return to wherever his hand left them. The choice is remembered
(`localStorage: doxFull`), exactly as the open panel is, so a stage he gave the viewer is given back
to it on the next load.

**One class, three readers** - and the shape of the solution is the part worth keeping. `doxFull` goes
on the body and that is the entire interface:

    dms.js        puts the class on and takes it off; binds Esc on the DOCUMENT while it is on (the
                  chrome it is drawn on top of is hidden, so the way back cannot depend on having
                  clicked in the right place); draws the button's two labels; exports dms.fill/full
    decks.js      reads it for the geometry: --upper-chrome 0, a ceiling of the page minus 12, a
                  filled viewer counting as a reason even at load, /deck naming the mode, state() carrying full
    terminal.css  does the moving: #status/#lorebar and #output display:none, and the panel given the
                  measured HEIGHT rather than growing with its content

That is the same bargain THE THREE DECKS made with `data-viewer`: a new behaviour that is one mark in
the markup or one class on the body, rather than a new call every module has to remember to make.

**Nothing traps him, and his press still wins.** Pulling the lower deck back up while the stage is
filled holds it up over the panel (the one-episode rule the ordinary viewer case already used - a key
that does nothing is worse than a deck over a panel). Putting the UPPER deck away takes the filled
viewer with it, so the mode stands down with its deck instead of leaving a page with no chrome, no
conversation and nothing to look at. The deck tabs are NOT hidden in this mode, so the lower deck's
own tab is always the way back to the input box.

**Measured** (fresh loads with the panel open AND filling at load, both real sizes): 1440x900 → the
panel 888px; 390x844 → 832px - 99% of the page at both, pinned to the top, the chrome and the stage
`display: none`, the lower deck hidden, and no overflow in either direction. On the phone the panel's
own body carries the scroll (614px of it against 51,811px of rows, with all 597 rows drawn) and a
search run while filling answers with its 20 rows and stays filled. `/docs full`, `/docs full off`,
`/deck` and the two buttons all print or report what they did, and giving the stage back restores the
chrome, the stage's floor and the deck rule exactly.

## FILES TOUCHED

`src/js/dms.js` (**NEW**, 117,792 bytes), `src/js/embed.js` (`indexNs` + `searchNs` as generic calls,
the refusal bail-out in `indexNs` and the batch fallback's exception, the namespace line in
`statusText()`), `src/js/decks.js` (`MAIN STAGE`, `measure()`, `--upper-chrome`/`--viewer-max`, the
floor constants, `measure` exported), `src/js/forge.js` (`--stage-reserve` as the log's only bottom
reserve), `src/js/chat.js` (the `/docs` dispatch, `/help docs`, the topic list, the rename),
`index.html` (the `#dmsView` markup and its comment block, `docsViewBtn`, the script tag, the `MODULES`
entry, `MAIN STAGE`), `src/css/terminal.css` (the whole `.dms*` block and its phone rules, the stage's
reserve, the viewer's ceiling, the rename), `src/commands/commands.json` (**70 -> 71 commands**),
`src/rtfm/commands.md` (**regenerated**, 10,220 bytes), `src/pack/files.json` (87 paths),
`src/pack/index.html.txt` and `src/pack/main.pjs.txt` (**regenerated byte-exact**), `src/README.md`
(the `dms.js` bullet, the `decks.js` bullet, THE DOX VIEWER section, the corrected deck table and
measurements), `src/TODO.md` (1bh), and this entry.

**THE SAME DAY, AFTERWARDS** (the second ask - the name and FILL THE STAGE): `index.html` (the DOX
VIEWER button, `data-viewer="DOX"`, the `#dmsFillBtn` markup and its comment), `src/js/dms.js`
(`FULL_KEY`, `setFull`, `fullStage`, `syncFull`, `bindFullKey`, the `full` verb, the boot restore, the
rename), `src/js/decks.js` (`fullStage`, the `measure()` short-circuit, `viewerOpen`/`shownNow`/
`reason`, `state().full`, the upper-deck hand-off), `src/css/terminal.css` (`.dmsFill` + the
`body.doxFull` rules), `src/js/chat.js` (the `/help docs` section and the `/deck` line),
`src/commands/commands.json` (the `docs` usage gains `full [on|off]`; still **71** commands),
`src/rtfm/commands.md` (**regenerated**, 10,235 bytes), `src/pack/index.html.txt` (**regenerated
byte-exact**), `src/README.md` (the renamed bullet, THE DOX VIEWER, FILLING THE STAGE, the deck table
and section), `src/TODO.md` (1bi), and this section.
