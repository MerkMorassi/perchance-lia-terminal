# MYTHOS READER - read-only access to everything saved here (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/reader.js (report router, archive/vault/memory/renders/tags reads, targets(), pending queue). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-reader-standalone.js"></script>
<script>
  var reader = MythosReader.client({
    vault: mediaVault(),        // { ensure?, list(), get(id), stats(), allTags(), allFolders(), normTag(t), normFolder(p), folderOf(rec), folderExists(p) }
    lore: loreEngine(),         // { files(), count(), search(words, k) }
    renderBook: book(),         // { count?, row(spec), find(words, { limit }), sheet(), rowText(row, full) }
    archive: turnArray,         // or readLog() -> [{ h, s, ts, role?, silent?, kind? }]
    reportWants: () => wants,   // optional: what she wants carried
    reportLikes: () => hearts,  // optional: what he has marked
    reportKept: () => kept      // optional async: her own kept memories
  });
  print(await reader.report("vault barn"));
  print((await reader.targets("R12", { onlyMade: true })).ids);
  await reader.queue([{ q: "vault barn", title: "T", text: reportText }]);
</script>
```

Any source missing, its surface reports OFFLINE out loud; nothing is silent.

## the contract

- `answer(raw, { her })` — one read: `folders`, `folder /p`, `vault [words]`, `archive [words]`, `turn <N>`, `memory [words]`, `renders [words|R12]`, `tags`, `wants`, `hers`, `likes`, `stats`, or bare words (every surface at once, silent surfaces left out). `her` tightens the limits for prompt use.
- `targets(what, { onlyMade, max })` — what "something" means, in order: a vault id, a book row (R12), a #tag, then words (book first, then vault). `onlyMade` is her side of the glass.
- `queue(items)` / `pending()` / `block()` / `take()` / `clear()` — reads waiting for her turn, the prompt block they ride in, taken (cleared) when woven. Capped; oldest falls off.
- `forHer(raw)` / `report(raw)` / `describe()` — the tight read, the printable read, the self-description.
- Seams: `vault`, `lore`, `renderBook`, `archive` / `readLog`, `reportWants`, `reportLikes`, `reportKept`, `queueStore`, `stamp`, `pendingMax`, `snippet`, `turnFull`.

## deliberately left out

- The vault, the lorepack, the book, the archive themselves — seams, all of them.
- The `/read` verbs and the reply-line carrier — host wiring; the chip answers what they ask.
- The DOM status nook — host chrome.

## honesty note

A read changes nothing, but it also proves nothing — the report is only as true as the surfaces it read, and an empty surface is reported, not hidden.
