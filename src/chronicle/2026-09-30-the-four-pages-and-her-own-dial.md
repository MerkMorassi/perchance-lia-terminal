# THE FOUR PAGES ON ONE DOCUMENT, AND THE DIAL THAT GOES BACKSTAGE

2026-09-30 - the session that took her own pace receipt out of the conversation and put it behind the veil in the shape he asked for; that made filling the stage the default and kept it the default; and that gave the DOX VIEWER's reader an AI summary it keeps, an outline with no prose in it, and a picture of the LOREPACK's own graph.

## WHAT HE SAID

> - PACE notice doesn't need to be seen and displayed in the chat window. It belongs in BACKSTAGE like SYSTEM messages. like SYSTEM: [[PACE: 5]]
> - In DOX VIEWER make FILL THE STAGE default
> - In DOX VIEWER and a button to trigger an AI summary if one doesn't yet exist. The new button order should be THE STORE, TEXT, SUMMARY, OUTLINE, FIND, RELATED, EXPORT
> - TEXT: Displays the text of the document only
> - SUMMARY: If there is already a SUMMARY of the document saved and present, display it. If there is now summary present, ask the user if they want to create an AI summary. When the user exits the summary page, ask if the user wants to save the new summary. If yes. TIMESTAMP and save summary. The next time to user visits that document, the saved summary is displayed.
> - OUTLINE: Display the tags/keyword blocks only, (no doc text)
> - GRAPH: New button. If exists, display simple GRAPH data in the LOREPACK for relationship, connections, etc.

Seven lines, four builds, and one of them was a bug report he did not know he was filing. Notice the shape of the whole message: he is not asking for a feature, he is drawing the reader's row and saying what each key means. "TEXT: Displays the text of the document only" is a *correction* - the old TEXT page had grown to hold the outline as well, and he is naming the four pages as four different looks at one document.

## WHAT WAS BUILT

### 1. HER DIAL IS MACHINERY, AND MACHINERY RIDES BEHIND THE VEIL (src/js/chat.js, src/js/proactive.js, src/js/shift.js)

The `[[PACE: <1-5>]]` receipt is now a `BACKSTAGE` line - the same class the recall, the citations, the sightings and the timings ride behind - written in the shape he typed out himself:

    SYSTEM: [[PACE: 4]]  SHE MOVED HER OWN PACE :: 2 -> 4/5.

When the act only *ran* at her pace (nobody moved it), it says `HER PACE AT THIS ACT - IT IS HERS TO MOVE WITH [[PACE: <1-5>]] IN ANY REPLY, HOUR OR ACT.` The act's own visible notice lost its `PACE n/5` tail: the number is on the infinity button, which is where a machine setting belongs, and the act's line goes back to being only about what happened in the room.

### 2. FILL THE STAGE IS THE DEFAULT (src/js/dms.js)

Selecting the viewer has given it the whole stage since 2026-09-26, but **giving it back by hand** wrote `doxAutoFull = 0` and stopped it filling for good. A hand saying "not this time" had become an unfindable preference. Now the default is simply the default: `loadAutoFull()` always answers true and clears the old key on the way, and a hand that gives the stage back is quiet only for the rest of that session - the next load fills again.

### 3. THE READER'S ROW, AND THE FOUR PAGES (src/js/dms.js, src/css/terminal.css, index.html)

The row is now exactly what he listed, with GRAPH placed after OUTLINE (see WHAT WAS THOUGHT):

    ← THE STORE | TEXT | SUMMARY | OUTLINE | GRAPH | FIND ▼ | RELATED | EXPORT

- **TEXT** - the reader as it was: the find bar, the window, the foot. The text of the document, and nothing else. A document always opens here.
- **OUTLINE** - *no document text at all*: the document's own `TAGS:`/`KEYWORDS:` lines, then `WHAT IT IS ABOUT` (the store's own top terms for the document plus its title's words, with a stopword table), then every heading as a row that opens TEXT at that line.
- **SUMMARY** - the AI summary lane (below).
- **GRAPH** - the LOREPACK's triplet graph (below).

The active page is a lit button (`button.on`, plus `aria-pressed`), one page at a time, and the pages are reached from the buttons, from `/docs outline`/`summary`/`graph`, and from the tests' own exported door (`setMode`).

### 4. THE SUMMARY PAGE, AND WHERE A SUMMARY LIVES (src/js/dms.js, src/js/config.js)

One record per document in kv `dms_summaries`, keyed by the document's own key, holding the text, **the time it was made**, what it was made from, and the document's size in lines, fragments and bytes. The document itself is never written to, and nothing is uploaded - his own words, the other way round: the summary lives beside the document on the device.

Three faces, and they are exactly the three he described:

- **KEPT** - a summary is here: the text, `MADE <when, on this device>`, `FROM THE WHOLE DOCUMENT (N CHARACTERS)`, and MAKE A NEW ONE / FORGET THIS SUMMARY.
- **ASK** - none is kept: *"NO SUMMARY IS KEPT FOR THIS DOCUMENT."*, what it would be made from, and MAKE A SUMMARY / BACK TO THE TEXT. **Nothing is spent until he presses it** - a page he only opened should not cost a key call.
- **MAKING** - one call to the text engine, streamed into the page with an animated working note: `LIA_DMS_SUMMARY_CHARS` 9000 characters of the head and, for a document longer than that, its `LIA_DMS_SUMMARY_TAIL` 3000 character tail (a long document ends as well as begins).

**Leaving asks, in place.** A new, unsaved summary raises the same bar on every way out - the other three page buttons, `← THE STORE`, RELATED, opening another document, the `×`, `/docs close`: *"SAVE THIS SUMMARY BEFORE LEAVING?"* SAVE IT / DISCARD IT / STAY HERE. SAVE IT stamps it and then does what he was on his way to do. The store is shared by one page, so a page with nothing new on it never asks.

**The command lane**: `/docs summary [<DOC>]` shows what is kept, `... make` writes one, `... forget` takes it off, `/docs summaries` lists them with their stamps. And `outline <DOC>` now lands on the OUTLINE page rather than opening the reader and leaving it in TEXT, which was the old row's only mode.

### 5. THE GRAPH PAGE (src/js/dms.js, src/js/mythos.js)

An imported MYTHOS pack is minted with a triplet graph - source, relation, object - and `mythos.js` held it, but only behind its trace API and **nothing could read the whole of it**. This session added `allEdges()` and `allVectors()` to `mythos.js` (read-only), and the viewer got a page that reads the graph **against the document that is open**: `graphTerms()` (the same top-terms-plus-title machinery the outline uses) and `edgesFor()`, which matches a term at a **word start** rather than anywhere in the line, and scores each edge by how many of the document's own words it names.

The page: the notice (`450 EDGES IN 2 LOCI (3 ON THE ROSTER) :: 14 RELATIONS IN USE`, and `THIS PAGE IS ABOUT ONE DOCUMENT :: ...` or `THIS IS THE WHOLE GRAPH ...`), the relation inventory, a row per locus with its edges, fragments and the packs it came from, then the SVG - sources down the left, objects down the right, barycentre-ordered so the curves cross as little as they can, degree-capped at 12 names a side, drawn as gentle alternating Bezier curves with a small **numbered disc** on each one - and below it the numbered edge list the discs refer to. With no document open (the GRAPH key in THE STORE's own ops row) it draws a spread of the whole graph and says so.

## WHAT WAS THOUGHT

**WHERE GRAPH GOES, WHEN HIS OWN ORDER OMITS IT.** He listed the row as THE STORE, TEXT, SUMMARY, OUTLINE, FIND, RELATED, EXPORT and then said "GRAPH: New button". Read literally, GRAPH could go last. It went **after OUTLINE**, because his four definitions are the tell: TEXT, SUMMARY, OUTLINE and GRAPH are all the same kind of thing - four ways of *looking at the one document that is open* - while FIND, RELATED and EXPORT are things done *with* it. Putting the fourth look at the document at the end of the row, past FIND and EXPORT, would have made it read as an operation. This is a judgement on his behalf and it is flagged as one.

**WHY A SUMMARY IS NOT WRITTEN INTO THE DOCUMENT.** The ask says "saved and present", and the store is handcuffed: **there is no write path in `dms.js` - not a guarded one, not a commented-out one** - and that is the property that makes the tandem safe and the viewer honest. So a summary is a *record about* a document, in its own kv folder, stamped, and the document keeps its bytes. That also made FORGET THIS SUMMARY possible as a real, honest undo: the store can lose the summary without touching anything it reads.

**WHY THE OUTLINE HAS NO PROSE.** "Display the tags/keyword blocks only, (no doc text)" is unambiguous, but a heading list alone is a table of contents, which the old OUTLINE ▼ already was. The reading taken: the two things a document *says about itself* at the top (TAGS / KEYWORDS) and then what the store's own index says the document is *about* - its top terms with the document's own title words - and then the headings as navigation. No sentence from the body, so the page reads as a card, not a reader.

**WHY THE GRAPH IS TWO COLUMNS OF NAMES.** 450 edges with 14 relations, drawn as a force layout, is a hairball nobody can read on a phone. The graph page is for *relationship and connection* - "how does this document touch what she knows" - so it draws a bipartite picture of sources and objects with the relation on each curve, number-caps the names at 12 a side, and puts the rest in the numbered list. The numbered discs on the curves are what makes a curve legible without labels: the number is a key to the row below it, and the row below it names the relation.

**WHY THE RECEIPT IS WRITTEN, NOT HIDDEN.** A pace is hers to move, and a lane that moves a dial silently is a lane nobody can audit. Backstage is exactly the right place for it: the veil is down by default, so the conversation stays clean - which is what he asked - and `/backstage` (or the BACKSTAGE key) shows the whole loom, receipts included, for as long as he wants to watch it.

## WHAT WENT WRONG

**THE PACE BUG.** The directive regexes in `chat.js` cover every line she can put in a reply except PACE, so a `[[PACE: 4]]` in an ordinary reply was never stripped - it stayed in her visible text and the pace never moved. The act path and the quiet-hour path each did their own `match()`, which is precisely why nobody noticed. The proof is in his own archive: two of her replies on this device still carry *"...leaving Me staring [[PACE: ...]]"* in their visible text. Those are history now, and the fix is `PACE_DIRECTIVE` plus a `pace` field in `extractDirectives()`. Measured: `liaDirectives("Hello there. [[PACE: 4]] And more text.")` returns `{text: "Hello there.  And more text.", pace: 4}`.

**THE GRAPH THREW ON ITS FIRST CALL.** `mythos.allEdges()` called `everyRow` on the edge store without opening the connection first: *"Cannot read properties of null (reading 'transaction')"*. The fix is the guard those functions now start with (`idb().then(...)`), and it is the reason the comment above them says so.

**THE STALE "READING THE GRAPH …" NOTE.** `setMode("graph", doc)` called without `showReader()` first could leave the page showing the working note for a graph that had already been read, because the page drew whatever `view.doc` happened to be. `showGraphMode()` now sets `view.kind` and `view.doc` itself, so *"the graph on screen is the graph of the document on screen"* is true on every road in (a button, `/docs graph`, a link, a test).

**THE ONE THING THAT WAS TESTED AND CLEANED UP AFTER ITSELF.** The summary test makes a real engine call and writes a real record, so it puts the kv back: it forgets the summary it made, and the run above ends `records=0` - his storage is exactly as it was before the test.

## STILL OPEN

- **A summary is stamped but never checked against its document.** Change the document and the kept summary goes on saying what it said. The record already holds the bytes, the lines and the time it was made, so a "the document has changed since" line is a comparison away - it has just not been asked for.
- **The graph page is drawn, not steered.** No zoom, no pan, no press-a-node; 12 names a side is the readability ceiling and the numbered list is the way to everything else. A node that opened the documents mentioning its term is the obvious next thing.
- **Neither page uses the meaning lane.** SUMMARY and GRAPH are lexical and structural on purpose (they cost no key), and a summary of a document the store has embedded would be a better summary, at a cost.

## FILES TOUCHED

`src/js/dms.js`, `src/js/mythos.js`, `src/js/chat.js`, `src/js/proactive.js`, `src/js/shift.js`, `src/js/config.js`, `index.html`, `src/css/terminal.css`, `src/commands/commands.json`, `src/README.md`, `src/TODO.md` (section 1cb), this entry and `chronicle.json` - and, regenerated because `commands.json` and the file list changed, `src/rtfm/commands.md` and the three files in `src/pack/`.
