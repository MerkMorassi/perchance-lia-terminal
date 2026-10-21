# LOREPACK

The LOREPACK is LIA's memory: her collective experience across every game and every role she has
played, written down. It is not a character sheet and not instruction - it is what she remembers. She
wears a RoleLayer (`src/roles/`) and carries her COREPACK traits (`src/corepack/`) with her, but the
LOREPACK is the record of what she has actually lived through, and she keeps it when she steps off
one stage and onto the next. `lorepack.json` is the manifest.

Shipped documents are the part of that record which is published with the generator; the rest of her
memory stays private in the browser's kv store (the LOAD LOREPACK button/drag-and-drop).

## The one briefing in her pack (`capabilities.md`)

`capabilities.md` - THE POWERS AND THE PURSE - is the single exception to "memory, not instruction".
It is what she can do, what each thing costs, her token limits, and the budget she may spend unasked.
It is kept HERE rather than in `src/rtfm/` on purpose: the RTFM is Patrikios's manual and *cannot be
handed to her at all*, whereas this pack is the only lane a document can be put in front of her from
(`/focus THE POWERS AND THE PURSE`, and recall). It is not marked `foundational`, so it is retrieved when relevant
rather than carried every turn; marking it canon would put it in her prompt on every reply at the cost
of its tokens, which is the very thing it warns about. Keep it in step with `src/js/config.js` when a
ceiling moves.

## Adding a document

1. Drop the `.txt` / `.md` file in this folder.
2. List it in `lorepack.json`:

```json
"documents": [
  { "file": "book-of-hours.txt", "title": "BOOK OF HOURS", "tags": ["canon"] }
]
```

A bare string (`"book-of-hours.txt"`) also works; the filename is then used as the title.

At boot every listed file is folded into the same BM25 index the uploaded `.txt` files use, tagged
PACK LOREPACK in the docs list, and reported in the boot line. `/lorepack` shows what is loaded and
`/lorepack reload` re-reads it without a page reload.

- Re-indexing is content-hash based: unchanged files are skipped, edited files are re-embedded, and a
  document removed from the manifest is unindexed (taken out of retrieval - its stored text is kept).
- The manifest is authoritative for this pack. Two documents may not share a title.
- Everything in this folder is PUBLIC - anyone can read it, and it ships with the generator.
  Private or personal memory goes in through the LOAD LOREPACK button/drag-and-drop instead (it stays
  in this browser's kv store and is never uploaded).

### Foundational documents (canon)

```json
{ "file": "the-absolute.txt", "title": "THE ABSOLUTE", "foundational": true }
```

A document marked `foundational` is **canon**: it is never merely retrieved, it is always in her
context, on every reply, ahead of anything the message happens to recall. Use it for the truths of
the universe - the things that must shape everything she says, not just the things she might be
asked about. Canon is never trimmed for budget; anything recalled by the message is fitted into what
is left. `chat.js` hands it to her in a `<canon>` block as *what is true*, distinct from the `<lore>`
memory fragments, and it rides in `system` (so the cacheable prefix stays stable). Flipping the flag
re-indexes the document even if its text is unchanged. `/lore` marks it `CANON`, the LOREPACK DOCS
panel tags it `CANON`, and the boot line names it.

**Canon is unset at present (2026-09-17).** Patrikios removed it: *"remove any canon for now as this
isn't really set in stone. This is much like improvisational theater. ACTOR>ROLE. The shared
LOREPACK are her 'lived experiences' from which she can draw and make inferences and add to her
current 'RoleLayer'."* So `the-absolute.txt` still ships and is still retrieved like any other
memory - it is simply not held in front of her on every turn, and nothing is declared as
fixed truth. The mechanism above is untouched; one `"foundational": true` brings a document back.

## Two ways in

- **Shipped** (this folder) - `origin:"shipped"`. Public, versioned in `lorepack.json`. The reconcile
  step *unindexes* a shipped document the moment it leaves the manifest - it comes out of retrieval,
  but its stored text is never deleted, so editing this manifest can never destroy a document.
- **LOAD LOREPACK** (the lorebar button/drag-and-drop) - `origin:"local"`. Reads
  `.txt`/`.md` files from the user's machine straight into the LOREPACK, stored privately in this
  browser's kv store. It is *not* published and never touched by the manifest reconcile (which skips
  anything whose `origin` is not `"shipped"`). Promote one by moving the file here and listing it.

Either way it is the same act: adding to her memory. A document she is not given, she does not
remember - the pack is read as her own recollection, not as external reference material.

Both end up in the same pack, indexed identically, and both are listed by `/lorepack` and in the
LOREPACK DOCS panel (which tags each row SHIPPED or ON THIS DEVICE).
