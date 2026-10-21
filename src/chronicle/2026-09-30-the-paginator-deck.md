# THE PAGINATOR DECK (AT THE FOOT OF THE PAGE, ABOVE THE CHAT BLOCK)

2026-09-30 - the session that took the pager out of the scrolling body and made it a control deck of its own, with the page numbers drawn as the graphic and four plain arrows around them.

## WHAT HE SAID

> make the paginator graphic with simple buttons in a control deck at the bottom of the page above the chat block

Twenty words about furniture and shape, hours after the pager itself was built: the paginator is to be a **control deck** - the terminal's own word for a control strip, the word the UPPER and LOWER decks are named with - it is to sit at the **bottom of the page**, **above the chat block**, and its graphic is to be made of **simple buttons**.

## WHAT WAS BUILT

### 1. THE PAGINATOR MOVED TO A DECK (index.html, src/js/dms.js, src/css/terminal.css)

The pager built earlier the same day was a bar STUCK to the top of the panel's scrolling body (`.dmsFoot.dmsPager`, `position: sticky`). It is now `#dmsPager` - a flex child of the viewer, between the scrolling `#dmsBody` and the talk strip - and it is the last thing before the input:

    <div id="dmsView" class="lorePanel dmsPanel">     (a column)
      .dmsBar      the search, the scope, SEARCH, FILL THE STAGE, the way out
      #dmsOps      what is on the screen + the ops row of the view
      #dmsBody     THE ROWS - the only part that scrolls
      #dmsPager    THE PAGINATOR DECK                <- new
      #dmsTalk     THE CHAT BLOCK - the talk strip

**Why a deck, and why there.** A deck is strictly better than the sticky bar for the very reason the bar existed: the bar had to imitate "never scrolled away" with `position: sticky`, and a deck is outside the scrolling area, so it is never scrolled at all. **Why it is inside the viewer and not in the lower deck**: while a viewer is open the lower deck stands down - his own rule from 2026-09-26 - and the paginator exists for the viewer's two long lists and nothing else, so the only deck that can hold it and still be on screen while a list is drawn is a deck inside the viewer. And the chat block at the bottom of the page, when the viewer has the page (FILL THE STAGE, the default), is the TANDEM'S TALK STRIP - so "at the bottom of the page above the chat block" is one flex slot, exactly.

### 2. THE GRAPHIC IS THE PAGE NUMBERS

    «  ‹  1  …  24  [25]  26  …  49  ›  »     PAGE 25 OF 49 :: SHOWING 481–500 OF 968 DOCUMENTS

- **Numbered chips** (`pageChips`, `PAGER_CHIPS` = 3 around his page): the page he is on is inverted (the ops row's lit language), every other page is a press, the FIRST and the LAST are always drawn, and the runs between them are elided as `…` - the gap is data, not a styling trick.
- **Simple buttons**: `«` first, `‹` earlier, `›` later, `»` last. An end is DIMMED rather than taken off the row (`pagerKey`), so the deck does not change shape at the edges - and since the ends are always among the chips, the arrows can stay this plain.
- **The count in two lengths**: the sentence beside the chips on the stage, and `41–60 OF 968` alone on a phone (the `.full` / `.short` pair `#loreStatus` already uses), because the numbers are drawn as chips right there.
- **Three chips, not five**: that is what keeps ONE row of keys on a phone and on the stage. A paginator that is a different shape in the two places is a paginator he has to learn twice.

### 3. ONE PAINTER, AND THE VIEWS THAT HAVE NO PAGE

`paintPager()` is the only writer of `#dmsPager`, it only ever READS `view`, and it runs at the top of every view paint - `renderList`, `renderResults`, `renderReader`, `renderGraphView`, `showStats`, `showRelated` - so a document, a summary, an outline, the stats, the graph and the neighbours all take the deck off the page, and an empty list does too. The page the rows were sliced by and the page the deck names are the same arithmetic (`pageOf`) on the same total, so they cannot disagree. `pagerGo(p)` is the single door for a move (the deck's keys, PageUp/PageDown, `setPage` from outside) and it returns the body to the top of the new page.

### 4. THE WORDS FOLLOWED THE FURNITURE

`/docs help`'s PAGINATION paragraph, `/docs state`'s PAGE line, the three log footers (`/docs list`, `/docs search`, `/docs find` now end with *"THE PAGINATOR DECK AT THE PANEL'S FOOT READS THE SAME PAGE"*), the `/docs` description in `commands.json`, and the comments in `index.html` and `dms.js` - every "THE PAGER" in the viewer became THE PAGINATOR DECK, and `pagerBar` is gone.

## WHAT WAS THOUGHT

**WHY NOT PUT IT IN THE LOWER DECK.** Read literally, "a control deck at the bottom of the page" sounds like the LOWER DECK, whose input row IS at the bottom of the page. It cannot be: opening the DOX VIEWER stands the lower deck down - his own rule - so a paginator that lives there is invisible exactly when the thing it pages is on the screen. The deck he asked for had to be inside the viewer's foot, which in FILL THE STAGE (the default) IS the bottom of the page, with the talk strip - the chat block - immediately under it.

**WHY THE NUMBERS ARE THE GRAPHIC.** A caption saying "page 4 of 49" tells him where he is; a row of numbers tells him where he is AND how far the two ends are AND lets him jump three pages in one press, without a box to type into and without a dialog. The chips are the paginator; the arrows are only the fine adjustment around them.

**WHY THE COUNT GOT A SHORT FORM.** The deck must be one row on a phone. Measured: the long sentence pushed the last arrow onto a row of its own (a 63px deck, of a panel whose body had 35px to spare before the deck ever existed). The short form is not an abbreviation invented for the phone - it is the same `.full`/`.short` pair the status line uses, and the long form is still what the stage shows.

## WHAT WAS VERIFIED

- **The deck is where he asked**, measured at 1920x1080 filled: 1920x30 at y=932, its bottom edge exactly the talk strip's top edge, inside the panel, and NOT inside `#dmsBody` - it does not scroll with the rows.
- **The graphic, page by page**: page 3 `1 2 [3] 4 … 49`; page 25 `1 … 24 [25] 26 … 49`; page 49 `1 … 47 48 [49]` with `›`/`»` dimmed; page 1 with `«`/`‹` dimmed. First and last always drawn; gaps exactly where numbers are skipped.
- **Presses**: `›` gave page 4 with a different first row and the body back at `scrollTop` 0; a chip press jumped to that page; `«` and `»` gave the ends; PageDown gave page 2; `setPage(99999)` gave 49 and `setPage(0)` gave 1, both clamped and both returning the page actually reached.
- **A search**: `PAGE 1 OF 3 :: SHOWING 1–20 OF 60 RESULTS` with `«`/`‹` dimmed, `»` giving page 3 with `›`/`»` dimmed, twenty rows on every page.
- **The views that hide it**: reader (pressed from a row), the three reader modes, STATS, and `/docs graph` - all hidden, and the deck came back on the page it was left on when the store returned. `/docs list ALL page 2` still printed the page in the log.
- **The phone (390x844)**: filled, the deck is 45px, one row of keys, every chip and arrow 34px, no horizontal overflow, `elementFromPoint` on the lit chip returning the chip itself, and 419px of body in an 832px panel.
- **Nothing else moved**: the modes harness passes end to end, the boot is clean (`__bootIssues` empty) and `rtfm.check()` is empty with the regenerated cheatsheet.
- **A rendered capture was not possible this time**: the page's snapshot helper hung on ANY element - a race against a 15s timer on `#status`, a single line of text, timed out twice while the page stayed responsive. So this build is verified by geometry, computed styles and `elementFromPoint` rather than by a picture, and that is written down here so the next session knows which check this one is missing.

## STILL OPEN

- **The phone with the decks up is starved**, and it is measured in the README: at 390x844 with the decks up, the panel is capped at 350px and its own chrome is the search bar (98) + the ops row (120) + the deck (45) + the talk strip (150), so the body gets 0 - and before the deck existed it got 35px, less than one row. The fix is to trim the strip or the ops row on a short panel, not to take the deck away: a pager that is not there cannot page. FILL THE STAGE is the default and filled the body has 419px.
- **No jump-to-page box, and no page in the LINK.** A typed page number and a share link that opens on page 7 have not been asked for; the chips cover the jump.
- **The two pagers stay two.** A page of a document is a screenful of LINES (260) and a page of a list is a screenful of ROWS (20), and the reader's own foot keeps its four moves.

## FILES TOUCHED

`index.html` (the `#dmsPager` element and its comment, the `#dmsView` comment), `src/js/dms.js` (THE PAGINATOR DECK: the comment block, `PAGER_CHIPS`, `pagerDeck`, `pageChips`, `pagerKey`, `pagerGo`, `paintPager`, `pageMove`, the deleted `pagerBar` and its call sites, `paintPager()` in the six painters, the `page`/`pageSize`/`setPage` exports and the renamed references in `state()`, `wirePanel`, `runSearch`, `listText`/`searchText`, `usageText` and `stateText`), `src/css/terminal.css` (the `.dmsPager` rules and the two phone rules; the `.dmsFoot.dmsPager` pair deleted), `src/commands/commands.json` (the `/docs` description), `src/js/chat.js` (the `/help docs` topic, whose TALKING WHILE YOU READ paragraph now names the deck above the talk strip), `src/README.md` (THE PAGINATOR DECK and the STILL MARGINAL measurement), `src/TODO.md` (§1cd), this entry and `chronicle.json`, `scratch/doxdeck.js` (new) and `scratch/doxpager.js` (rewritten for the new selectors) - and `src/rtfm/commands.md`, `src/pack/index.html.txt`, `src/pack/main.pjs.txt` and `src/pack/files.json` were regenerated in the same pass.
