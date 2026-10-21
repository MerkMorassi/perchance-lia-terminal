# A PAGE IS NINE ROWS, AND THAT IS A LID

2026-09-30 - the session that cut the DOX viewer's page from twenty rows to nine, on his own measurement: nine is what fills the MAIN STAGE at the font size he reads at, and a page that overflows the stage is a page he has to scroll inside a page.

## WHAT HE SAID

> limit pagination to 9 max as this is what fills the MAIN STAGE at my current font size and looks good.

Eleven words - **9 max**, and the reason for it. The word that mattered most was **max**: not "nine", but "no more than nine".

## WHAT WAS BUILT

### 1. NINE, AND A CEILING OVER IT (src/js/config.js, src/js/dms.js)

- `LIA_DMS_PAGE` in `src/js/config.js`: **20 -> 9**.
- `PAGE_MAX = 9` in `src/js/dms.js`, with `PAGE_SIZE = Math.min(PAGE_MAX, LIA_DMS_PAGE)`. The config value may ask for FEWER rows than nine; it can never ask for more. That is the instruction read literally: a page that holds more rows than the stage can show is a page he has to scroll INSIDE a page, which is the thing pagination exists to prevent, so the ceiling is the point rather than the number.

Everything the terminal COMPUTES about the page followed the constant on its own - `/docs state`'s `A PAGE IS n ROWS`, the three log footers' `READS THE NEXT n`, the deck's `PAGE n OF m :: SHOWING a-b OF t`, the ops row's row count were all already derived from `PAGE_SIZE` - so what had to be reworded was only the sentences that QUOTED the size as twenty: `/docs help`'s PAGINATION paragraph, the paginator's own example line and two code comments in `dms.js`, the `#dmsView` comment in `index.html`, and the `/docs` description in `commands.json`. THE CHEATSHEET DID NOT CHANGE, and that was verified rather than assumed: `src/rtfm/commands.md` carries each command's ONE-LINE SUMMARY and its usage and not its description, so the regenerated markdown came out byte-identical to the shipped file (11422 bytes, compared inside the page) and `rtfm.check()` is empty.

### 2. WHAT WAS MEASURED, DRIVEN (scratch/page9.js, scratch/page9b.js)

- **108 pages, not 49.** 971 documents at nine rows. The last page holds only what is left - **eight** of them (964-971) - which is the arithmetic that proves the slicing is live rather than a constant.
- **What his eye caught**, at 1440x900 filled: the body is 661px and nine rows are 447px; the OLD page, twenty rows, was **1000px in that body - a 339px scroll inside the page**. At 1920x1080 filled the body is 841px and nine rows are 450px.
- **The deck**: `PAGE 1 OF 108 :: SHOWING 1-9 OF 971 DOCUMENTS`; at the end `PAGE 108 OF 108 :: SHOWING 964-971 OF 971 DOCUMENTS` (eight rows, because 971 is not a multiple of nine) with the chips reading `1 106 107 [108]` and `»`/`›` dimmed; `setPage(99999)` lands on 108 and says so, `setPage(1)` goes back.
- **The log**: one page of the store list is **16 lines** (the title and the rule, nine rows, the page line, the way on, and the two trailing pointers) - which is what "a page that fits the stage" means in the log, the one place whose text size is HIS (`--log-fs`, A- / A+). The footer reads `PAGE 2 OF 108 :: 9 OF 971 DOCUMENTS SHOWN` / `/docs list PAGE 3 READS THE NEXT 9 (THE PAGINATOR DECK AT THE PANEL'S FOOT READS THE SAME PAGE).`
- **A search still asks for `PAGE_SIZE * 3`** = 27 hits (measured 27), so the number of pages an answer can have did not shrink with the page.
- **Boot clean, `__bootIssues` empty, `rtfm.check()` empty** with the regenerated cheatsheet.

### 3. WHAT WAS DELIBERATELY LEFT ALONE

- **The reader's own window** is still `READ_WINDOW` 260 LINES. A page of a document is a screenful of reading and a page of a list is a screenful of rows; the reader's window is not this paginator, and two users of the same word were left as they were.
- **The gallery's `PER PAGE [50]`** is its own control over its own lists.
- **The old numbers in the chronicle and the TODO's earlier sections** stay where they are. They record what was true on the day they were written - "page 1 of 49, twenty rows" was true that morning - and rewriting an entry would be the one thing a record must not do.

## WHAT WAS THOUGHT

**WHY A CEILING AND NOT A VALUE.** A number in a config file is a preference; a ceiling in the code is a fact about the display. The knob is still there and still useful - a page of three rows is honest on a tiny window, and `LIA_DMS_PAGE` can go there - but nothing can ask for a page taller than the stage, because that is the bug he was describing, not a taste.

**WHY NOT AN ADAPTIVE PAGE.** The obvious next step is a page size measured off `#dmsBody` and re-computed on resize: it would fill EVERY stage exactly, and this session deliberately did not do it. A page is a thing the LOG prints too, and the log is a record: `PAGE 2 OF 108` has to mean the same rows tomorrow, in the footer he can scroll back to, as it meant when it was printed. An adaptive page would also make "page 3" a different set of rows in a different window, which is a quiet way of lying about where a row is. Nine is fixed, and it is a lid.

**WHY NINE AND NOT "WHAT FITS".** Nine is HIS measurement, in his words - "this is what fills the MAIN STAGE at my current font size" - and it was taken on his screen at his font size, which no code here can see. A page of nine at 1440x900 leaves about a third of the body black; that is not a fault, it is a page drawn exactly, and if he ever wants the last third instead of the black he moves the one constant (`PAGE_MAX`) and every number in the terminal follows it.

## STILL OPEN

- **The page does not follow the font size**, and that is what "max" bought. If he wants the page to FILL rather than FIT, that is the adaptive build above, with its cost written out.
- **A tall stage shows empty space under the page** - measured at 32% of the body at 1440x900 and 46% at 1920x1080. Correct, and worth knowing rather than hiding.
- **No capture this session either**: the page's `snapshot.js` still hangs on any element, so the work is verified by DOM text, geometry and the app's own printed numbers.

## FILES TOUCHED

`src/js/config.js` (`LIA_DMS_PAGE` 9), `src/js/dms.js` (`PAGE_MAX`, the clamped `PAGE_SIZE`, the paginator's example comment, the `/docs help` PAGINATION paragraph, two code comments that quoted twenty), `index.html` (the `#dmsView` comment), `src/commands/commands.json` (the `/docs` description: nine rows, his words, and "nine to a page"), `src/README.md` (THE PAGINATOR DECK: the examples, the new "nine rows, because nine is what fills the stage" bullet, the printed page with its measured 16 lines, the end-stop at page 108, and the store's own count refreshed from 968 to 971), `src/TODO.md` (§1cf), this entry and `chronicle.json`, `scratch/page9.js` and `scratch/page9b.js` (new harnesses) - and `src/pack/index.html.txt` and `src/pack/files.json` were regenerated in the same pass, because `index.html` and the file tree changed. `src/rtfm/commands.md` needed no regeneration: the regenerated cheatsheet is byte-identical to the shipped file (verified in the page), since it quotes summaries and usage rather than descriptions. **NOT SAVED by the agent.**
