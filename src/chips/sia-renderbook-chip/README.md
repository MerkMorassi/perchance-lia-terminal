# MYTHOS RENDER BOOK - every picture made, with the exact recipe (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/renderbook.js (rows, turn cross-reference, one query language, redo, export). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-renderbook-standalone.js"></script>
<script>
  var book = MythosRenderBook.client({
    vault: mediaVault(),   // { ensure?, list(), get(id), folderOf(rec), normFolder(p)?, allTags?, artifactName?/fileName? }
    archive: turnArray,    // or readLog() -> [{ h, s, ts, silent?, kind?, gen: [{ id }] }]
    forge: forgeForm,      // optional: redo() loads { prompt, negative, seed, guidance, resolution } into it
    download: (name, body, mime) => save(name, body) // optional: export writes through it
  });
  print(book.report(await book.find("#night")));
  print(book.rowText(await book.row("R12"), true));
  await book.redo("R12"); // the exact recipe back in the forge
</script>
```

No vault passed, the book is empty and says so; no forge, redo refuses LOUD. Nothing is silent.

## the contract

- `sheet()` — the book ready to read: every made-thing oldest-first numbered R1..Rn, each crossed to the first turn that named it. Numbers never move while their picture stands.
- `find(q, { limit, rows })` — one query language: `#tag`, `tag:x`, `seed N`, `turn N`, `folder:/p`, bare `/p`, else ANDed words over prompt/sent/negative/tags/file/pose/turn-talk, prompt and tag hits ranked first.
- `row("R12")` / `byNumber(n)` / `labelOf(id)` — one row, with its turn on it; the one-line answer to what a picture is in the book's terms.
- `rowText(row, full)` / `report(rows)` / `describe()` — the printable row, the printable set, the self-description.
- `redo("R12")` — the exact recipe back into the forge form (seed included); nothing renders until he runs it. `forHer(q, limit)` — deliberately the same search she gets.
- `exportBook()` — `{ json, text }` of the whole book, downloaded where a road is given.
- Seams: `vault`, `archive` / `readLog`, `forge`, `onRedo`, `download`, `stamp`, `prefix`, `defaultGuidance`, `defaultResolution`.

## deliberately left out

- The vault and the archive themselves — seams.
- The forge form and the `/renders` verbs — host wiring; the chip is the book they call.
- The DOM download anchors — the `download` seam.

## honesty note

A row is everything needed to make that picture again — except the luck. Same seed, same words, a different roll of the model's dice.
