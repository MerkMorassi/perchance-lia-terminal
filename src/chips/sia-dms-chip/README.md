# MYTHOS DMS - staged reading library (for SIA)

Upload or stage raw `.txt` / `.md` documents and talk to her about them.
LORE but not LOREPACK: staged words ride the turn whole — never chunked,
never embedded, never indexed. When the turn ends, the stage is struck;
unstage or clear and they are gone. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-dms-standalone.js"></script>
<script>
  var dms = MythosDms.client({ kvFolder: null, slot: "dms_docs", maxDocs: 20, maxChars: 200000 });

  // file input or drop:
  await dms.stage(file.name, await file.text());   // .txt / .md only, else refused
  console.log(await dms.status());

  // before her turn - staged words go whole into the prompt:
  var ctx = await dms.context(60000);
  var prompt = systemPrompt + "\n" + ctx.text + "\n" + userTurn;
</script>
```

## the contract

- `stage(name, text)` — files one raw document (re-stage replaces). Refuses:
  nameless, wrong kind (not `.txt`/`.md`), empty, over cap, over doc count
  (oldest falls off). Returns `{ name, chars, restaged }`.
- `unstage(name)` / `clear()` / `list()` / `read(name)` — the shelf verbs.
- `context(budget)` — `{ text, names, chars, trimmed }`: whole documents
  wrapped as `<doc name="...">`, oldest first, cut only at the budget edge
  (named in `trimmed`, never silent). Empty stage gives empty text.
- `status()` — one line: count, chars, names.

## deliberately left out

- Chunking, embeddings, BM25, graphs, summaries — that is LIA's battleship
  (`src/js/dms.js`); this is the rowboat. Whole text or nothing.
- Persistence across devices — the stage lives in this browser (kv or
  localStorage); cross-device moves through explicit export, never sync.
- Editing — stage a new copy; the shelf keeps documents, not drafts.

## honesty note

Staged words are prompt, not memory: she can read them this turn and forget
them the next. Anything worth keeping must be filed elsewhere (gallery,
lorepack, bridge) before the stage is struck.
