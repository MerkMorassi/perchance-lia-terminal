# MYTHOS VAULT - the media vault: one door in, tags, folders, names (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/vault.js (records, mime truth, tags, folders, fileMany glass, replacement chain). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-vault-standalone.js"></script>
<script>
  var vault = MythosVault.client({
    store: kvFolder(),        // optional async { entries(), get(k), set(k, v), delete(k) } - the records
    folderStore: kvSettings() // optional async { get(k), set(k, v) } - the folder list (else the store)
  });
  await vault.ensure(); // restores records + folders where stores are given; memory-only without
  const id = await vault.add(pngBlob, { kind: "gen", prompt: "A red barn at dusk" });
  await vault.tag(id, "night");
  await vault.fileMany([id], "/images/portraits", { by: "archivax" });
</script>
```

No stores passed, everything lives in memory; anything missing refuses LOUD, never silent.

## the contract

- `add(blob, meta)` — the ONE door in: resolves the true mime (blob type, then meta, then extension — never a blind image fallback), names renders from their prompt, de-dupes names, notifies listeners. Returns the id.
- `get(id)` — follows the replacement chain, so a retired id hands over the record that exists. `setField(id, k, v)` moves the record around the blob. `del(id)` drops one.
- `tag` / `untag` / `allTags` / `normTag` / `tagsOf` — one-word lowercase tags, capped per record, counted vault-wide.
- `normFolder` / `createFolder` / `renameFolder` / `removeFolder` / `setFolder` / `fileMany` / `allFolders` / `folderExists` / `defaultFolder` / `folderOf` / `under` — typed paths; records resolve home by kind when unfiled. `fileMany` with `onlyMade` files only what the terminal made (the archivax glass). Folders with contents cannot be dropped.
- `isVox` / `voxFolder` / `bucketPath` — the voice tree and the classifier bucket answer where things belong.
- `mimeFor` / `mimeByName` / `extFor` — the mime table both ways (mp3 is audio/mpeg, and audio never falls through to video). `fileName` / `recordLabel` / `stats` / `list` / `url` report.
- `onAdd(fn)` / `noteReplace(old, new)` / `replacementFor(id)` — the listener door and the millisecond race map.
- Seams: `store`, `folderStore`, `folders` (default map), `download`, `maxAttach`, `tagMax`.

## deliberately left out

- The canvas normalizer and the anchor download — host roads; the chip takes `download` as a seam.
- The kv folders themselves — `store` and `folderStore` seams.
- The gallery, the book, the `/folder` verbs — host wiring; the chip is the vault they call.

## honesty note

The mime is only as true as the evidence handed in — an untyped blob with a lying extension is filed under the lie, and the vault will defend it.
