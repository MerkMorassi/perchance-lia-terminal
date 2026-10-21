# A PAGE AT A TIME (THE DOX VIEWER'S LONG LISTS)

2026-09-30 - the session that stopped the DOX VIEWER drawing a thousand documents and sixty search hits into the MAIN STAGE as one scroll, and gave both of them a pager.

## WHAT HE SAID

> Paginate DOX VIEWER MAIN STAGE text results

Nine words, and the whole of the ask is in the last two of them: **text results** - the two things the viewer answers with that are lists OF TEXT rather than a document, i.e. the store list and the hits of a search. "MAIN STAGE" is where they appear: the DOX VIEWER is filled to the whole page by default since this same day, and what it draws there IS the main stage.

## WHAT WAS BUILT

### 1. THE PAGER (src/js/dms.js, src/js/config.js, src/css/terminal.css)

Both long lists - `renderList` (the store) and `renderResults` (the search) - are drawn a page at a time, with one shared piece of arithmetic (`pageOf(total, want)`, which clamps) and one shared bar (`pagerBar`), so the two can never disagree about what a page is:

    PAGE 1 OF 49 :: SHOWING 1–20 OF 967 DOCUMENTS     ⇤ FIRST  ↑ EARLIER  ↓ LATER  LAST ⇥

- **Not a filter.** The count in the bar is the whole answer and *every* row of it is still drawn, twenty at a time.
- **The end-stops are dimmed and clamped**: FIRST/EARLIER are disabled on page one, LATER/LAST on the last page, and `pageOf` clamps besides, so a page can never be off the end of its own list.
- **The bar sticks to the top of the panel's body** (`position: sticky`), because twenty rows on a phone are taller than the window and the way on must not be scrolled out from under him. It is the reader's own foot reused (`.dmsFoot.dmsPager`), with a bottom border instead of a top one so it does not read as a seam under the ops row.
- **PageUp/PageDown** move the page while the focus is in the panel, and are handed to any field that wants them.
- The page size is `LIA_DMS_PAGE` in `src/js/config.js` (20).

### 2. THE SAME PAGE IN THE LOG

`listText`, `searchText` and `findText` take a page now, and each ends with what page it printed and how to ask for the next one:

    PAGE 2 OF 49 :: 20 OF 967 DOCUMENTS SHOWN
    /docs list PAGE 3 READS THE NEXT 20 (THE PANEL HAS THE SAME PAGER ON ITS FOOT).

`PAGE <N>` is taken off the **end** of the request, so `/docs search backup CODE PAGE 2` still reads CODE as the scope; a bare number after `list` is a page (`/docs list 3`), because list has nothing else a number could mean; and `/docs state` prints the page while a list or a set of results is on the screen.

## WHAT WAS THOUGHT

**WHY NOT JUST A SMOOTHER SCROLL.** The obvious answer to "a wall of text" is a better scroll - a scrollbar he can see, jump keys, a sticky header. That was rejected because the problem is not that scrolling is hard; it is that a list of 967 rows carries **no information about itself**. Nothing on the screen says there are 49 screenfuls, or that he is on the fourth of them, or that the thing he wants is eleven pages down. A pager is not a nicer scroll: it is the *count* made visible, and the count is the thing that was missing.

**WHY THE PAGE IS NOT A FILTER.** It would have been easy to make a "page" mean "read the next batch and forget the last" - cheaper, and it would have looked the same. That is a different feature wearing the same name: the answer would change as he moved through it, the count in the bar would become a lie, and a row he saw on page 2 would be gone when he came back. The list is computed once and sliced. Everything the viewer says about the store stays a statement about the store.

**WHY THE READER'S OWN WINDOW IS NOT THIS PAGER.** The reader has paged its text since the day it was built (260 lines, EARLIER / LATER / TOP / END). It would have been tidy to fold the two into one control and call the page size the same everywhere. They are deliberately not the same: **a page of a document is a screenful of lines** - how much reading fits in the window - and **a page of a list is a screenful of rows** - how much of an answer he can take in at once. One is 260, the other is 20, and neither number means anything in the other's place. They share a vocabulary (EARLIER, LATER) and nothing else, which is exactly the right amount.

**WHY THE LOG IS PAGINATED TOO.** The terminal's `/docs search` printed every hit it had, and `/docs list` printed sixty and said "AND 907 MORE". A wall in the conversation is the same problem as a wall in the panel, and the fix is the same, so the text side got the same page and the same footer. The one difference is that the log cannot grow buttons: the way on is a command, printed in the answer.

## WHAT WAS VERIFIED

- **The store list, driven for real** (`scratch/doxpager.js`): page 1 of 49 with twenty rows and `chatlog/manifest.json` first; LATER gave page 2 with a different first row; FIRST came back; `setPage(99999)` landed on page 49 of 49 (`SHOWING 961–967 OF 967`) and `setPage(0)` on page 1.
- **The search**: sixty hits (the search's own ceiling) drawn as `PAGE 1 OF 3 :: SHOWING 1–20 OF 60 RESULTS`, LATER giving page 2 with `TODO.md › 1o. THE BACKUP ...` first.
- **The log**: `/docs list page 2`, `/docs search backup page 2` (`PAGE 2 OF 3`), `/docs search backup CODE page 2` (the scope still read as CODE), `/docs find dms_summaries` (`PAGE 1 OF 1 :: 4 OF 4 DOCUMENTS SHOWN`), `/docs state`'s PAGE line, and `/docs list 3` reading the bare number as a page.
- **The bar, looked at**: a rendered capture of `#dmsView` read back by `vision` - the caption unclipped, all four keys with their arrow glyphs drawn, FIRST/EARLIER dimmed while LATER/LAST are bright, nothing overlapping.
- **The phone (390x844)**, measured rather than assumed: the bar was 87px of a 504px body because the caption and FIRST shared a row and the other three wrapped to a second; with the caption on a line of its own it is **65px** and all four keys sit under it. No horizontal overflow in the panel.
- **Nothing else moved**: the modes harness still passes end to end (the ops row, TEXT, OUTLINE with no text, the SUMMARY ask, the GRAPH page), and the reader still has its own foot.

## STILL OPEN

- **STATS, RELATED and the graph's numbered list are drawn whole.** Each is short by construction (a dozen loci, eight related documents, fourteen edges), so pagination there would be furniture rather than a fix.
- **No jump-to-page box and no page in the link.** The bar has four moves and the number; a field he could type a page into, or a share link that opens on page 7, has not been asked for.
- **The two pagers stay two.** If they are ever unified, the reason above is the thing to argue with first.

## FILES TOUCHED

`src/js/dms.js` (the pager and everything it touches: `PAGE_SIZE`, `pages`, `pageOf`, `pagerBar`, `pageMove`, `scopesNow`/`mineNow`, `view.page`, `renderList`, `renderResults`, the PageUp/PageDown binding, `runSearch`, the scope listener, `listText`/`searchText`/`findText`, `pagerText`, `takePage`, the three verbs, `state()`, `stateText()`, `usageText()`, and the `page`/`pageSize`/`setPage` exports), `src/js/config.js` (`LIA_DMS_PAGE`), `index.html` (the `#dmsView` comment), `src/css/terminal.css` (`.dmsFoot.dmsPager`, its disabled keys, and the phone rules), `src/commands/commands.json` (the `/docs` usage and description), `src/README.md`, `src/TODO.md` (§1cc), this entry and `chronicle.json`, and - regenerated - `src/rtfm/commands.md` and the three `src/pack/` files.
