# MYTHOS KEEPSAKE - one press that puts a picture into the record (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/keepsake.js (keep, transfer, resolve, links, recipes). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-keepsake-standalone.js"></script>
<script>
  var keep = MythosKeepsake.client({
    vault: mediaVault(),   // { ensure?, list(), get(id), setField(id,k,v), tag(id,t), folderOf(rec)? }
    studio: recipeBook(),  // { loadRecipeBook?(), findRecipe(id)?, addRecipe(recipe) }
    reader: reader(),      // optional { targets(spec) } - names R12/#tag/words
    renderBook: book(),    // optional { labelOf(id), sheet?() }
    pageUrl: "https://perchance.org/mine"
  });
  await keep.keep("m1"); // prompt + negative + settings + seed into the book, #kept on the picture
  print(keep.showLink("m1"));
</script>
```

No vault or no book, keeping refuses LOUD. Nothing is silent.

## the contract

- `keep(id)` — only what the terminal made from a prompt; handed-over pictures and promptless renders are held with the reason. Same picture twice lands on the same recipe (the tail of its name tells renders apart).
- The recipe carries the prompt, the negative list, and the seed/guidance/size as routable tags — the whole of a re-run, nothing invented.
- `transfer(oldId, newId)` — the keep follows an upscale that retired its render: same recipe, rewritten link, no second entry.
- `resolve(what)` / `keepWhat(what)` — rows, ids, tags, words, or the newest unkept render. `copyLink(id)` / `showLink(id)` / `linkFor(id)` — the gallery link, copied where a road is given.
- `list()` / `report()` / `describe()` / `isKept(rec)` / `canKeep(rec)` / `recipeIdFor(rec)` / `templateFor(rec)` report.
- Seams: `vault`, `studio`, `reader`, `renderBook`, `pageUrl`, `print`, `stamp`, `copy`, `onKeep`, `tag`, `hashKey`, `maxId`.

## deliberately left out

- The DOM button and its paint — host painting; the chip is the act they call.
- The hash router that opens links — host wiring; the chip mints what it reads.
- The clipboard itself — the `copy` seam, with the link printed either way.

## honesty note

SAVE writes the file to the machine; KEEP puts the picture in the record. A default invented for a missing seed would be a lie about the render, so none is.
