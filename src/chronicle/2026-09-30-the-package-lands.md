# THE PACKAGE LANDS - AND THE RECORD IS CUT BACK TO ITSELF

2026-09-30

## WHAT HE SAID

One line, after the four links were already in his hands:

> *"ACOWLEDGED. Placing code in the uploads for the other agent is the right move, Send the links in my
> return chat and I send it to CLIO, She does the rest,"*

So the links went back into the chat as a block he could paste, and CLIO's own session report came back
the same day.

## WHAT CLIO REPORTED

**Vendored, verified, and not shipped.** Her room took the package into its own `src/chatlog/` (module,
format, converter) with the README wired, and fetched the hosted copies back: `chatlog.js` 94,910 B
exact, the converter 14,923 B exact. Her `/pack <ALIA>` emits both lanes in one press - the
turn-per-section document and the staging `.jsonl` - and she measured it on a real room: **200 turns, 9
fields, ids unique, human turns present and labelled HITL, `vec` null.** Her three answers back:

- **The thin index stays coarse in her room** - her index is already a per-turn order, so there is
  nothing to rebuild there; the case belongs to THIS terminal, which is right, and it is still open
  here.
- **Human turns belong in a pack, labelled.** Shipped that way.
- **Lane order:** documents now (works today, no new code), the staging JSONL is ready for the
  factory's embedding step.

## WHAT WAS ANSWERED (the byte question)

She flagged the format document's size as a discrepancy rather than ignoring it - 17,125 B against the
16,964 B the package report had claimed - and read it as a line-ending delta. It is not. Measured on
both copies (hosted and local, byte-identical, 293 newlines, **zero carriage returns**):

> **16,964 is the CHARACTER count; 17,125 is the BYTE count.** The document holds 80 three-byte
> characters and one two-byte character, and 80x2 + 1 = **161**, exactly the difference.

The same rule explains the one other place the two numbers were compared side by side in the package
pass. Nothing was wrong with the file, and nothing needed re-uploading: the hosted copy fetches back
byte-identical to the one on disk.

## WHAT WENT WRONG (and it was found by looking, not by trusting)

**The record's tail had three test appends on it.** Proving the converter against this terminal's REAL
record had meant writing three synthetic imports INTO the record - a suite, a bare dump, a foreign
`.json`, 1,914 characters with their join stamps. The earlier round of the same tests had been undone
("the whole record restored after the merge tests"); this round was not, and the live record read
`chars 3,682,604`, `turns 24`, and a tail of `{"hello":"world, and a long string of nothing in
particular…` where `✓ conversation view restored.` belongs.

It was cut back off, and the cut is PROVED rather than asserted: the clean prefix of exactly the length
the record had before the tests (`3,680,690` characters) hashes to **`e291ad08-3829b2`** - the
fingerprint the record carried after the import of 2026-09-24 and the one written into the shipped
index. `put(…, {mode:"replace"})` wrote it back; the record now reads **3,680,690 characters /
3,883,361 bytes / 19 chunks / 69,304 lines / 21 turns / `e291ad08-3829b2`**, tail `✓ conversation view
restored.`, and its own history carries the restore with the reason attached. The three test turns are
in that history as imports that were then cut off, which is the honest record of it.

**The lesson is a rule for this folder: a test that writes into the record has to be undone in the same
pass, and the receipt is the fingerprint.** A record's `fingerprint` is not decoration - it is how a
later session can tell, in one line, whether the words it is reading are the words that were there
before somebody tried something.

## WHAT WAS THOUGHT

**The record is the one thing here with no undo.** Code, docs, packs and pages can all be rewritten
without loss; the transcript is a thing that was said once, and every write to it is a small risk
taken on somebody else's behalf. So the tests that matter were run against it - and then it was put
back, exactly, with the proof in the history. That is the pattern: mess with it deliberately, measure
everything, and restore with a fingerprint rather than a memory.

**The package is now two rooms' worth of the same shapes.** CLIO kept the reader, not a translation of
it, which is what makes the two rooms' histories assemblable later: same kv keys, same chunks, same
marks, same sidecar. The bridge converts exports, never modules.

## THE PLAYER, AND WHAT READING IT FOUND

CLIO's Player is up, and it is honest where honesty is the point: `header` + `sacred_archive` and the v2
compact fields are read into one shape, the staging lane says **`vec null - NOT YET EMBEDDED (factory
embeds)`** on screen, search is token overlap with `no embeddings here` said out loud, the document lane
plays today, every turn carries a **Say in room** button, the pack is cached in `kv` (the first 200
records), and a duplicate id is refused.

Reading her **source** rather than her report found three things:

1. **Her staging writer emits `v:1`** where the factory's own files say `v:2`
   (`{"v":2,"type":"vector",…}`), and her reader defaults to 1 as well - so a pack she exports and the
   factory's records are two generations of the format claiming to be one.
2. **Her `verify()` dimension check can never fire**: the records are normalised to `vec`, and it tests
   `r.vector`. The duplicate-id half works. One field name.
3. **The format implied the staging shape instead of stating it** - §B3 showed the reader-side record and
   a mapping table, and said only that staging ships `vec: null`. That is where `v:1` came from.

**So the format is now v2.1**, and the module and the bridge are untouched byte-for-byte: a changelog
line, **§B3.1 WHAT A STAGING RECORD IS, EXACTLY** (`v:2, type:"turn"`, `vec:null`, and why `type` is not
`"vector"` - the factory's embedder owns that transition), and one sentence in §B4 that a heading is not
a handle. **The format and the bridge now ship in `src/chatlog/`**, because a delivered blob is not a
source: a later session could quote the document and not correct it. `manifest.json` gained a `package`
block with every delivered URL and the fetch-back verification.

New delivery, both fetched back byte-identical: the v2.1 document at
`https://user.uploads.dev/file/d672dcd2fa352899335f9d8d7a42899e.txt` (19,645 B) and a rebuilt zip at
`https://user.uploads.dev/file/ab055e8b1ab4494adeeab359fc690f3c.zip` (43,697 B, its three entries
byte-identical to the files they were built from).

**Two pack shapes now live in one room.** Her room writes the factory's
`{schema:'MYTHOS.LOREPACK.v1', header:{…}, sacred_archive:[{id, text:'[from]: text', source,
timestamp}]}` and the v2 compact staging beside it - and the `sacred_archive` shape has **no `a` at
all**: no owner of the memory, which is the one thing a pack cannot lack, because a record whose `a`
disagrees with its pack is retrieved by the wrong agent. Whichever shape the factory ingests, the v2
compact staging is the one the bridge writes and the only one carrying the join key.

## STILL OPEN

- **The one click.** The fine turn index (19,690 turns) is rebuilt by importing `lia-chatlog-20260924-0023.json`
  once - the file the console script wrote on 2026-09-24, in his downloads folder - through the
  CHATLOG panel's IMPORT. The words are already in the record, so that import changes nothing except
  the numbering (`thinIndex`). A fresh run of the console script (`src/chatlog/EXTRACT.md`) gives the
  same thing with the newest turns added. Nothing else here needs doing.
- **Per-turn time**, if it is ever wanted - the console script, never the module.
- **Which lane each ALIA's chats go to first** - documents work today; the pack lane waits on the
  factory's embedding step.
- **The mark and id convention at the factory end** - keep the staging id in `d.stagingId` so a
  re-ingest stays recognisable.

## FILES TOUCHED

Nothing in the terminal's code changed. `src/TODO.md` (§1dg and §1dh, plus a units correction and the
reading in §1df marked as taken before the restore), `src/chatlog/CHATLOG.FORMAT.md` (new - the v2.1
format, now shipping), `src/chatlog/chatlog-to-lorepack.js` (new - the bridge, byte-exact),
`src/chatlog/manifest.json` (the `package` block and the folder rule), `src/chatlog/README.md` (the
file table and the ship list), `src/chronicle/chronicle.json` (49 -> 50), this file, and
`src/pack/files.json` (140 -> 143). The record in this browser's kv was rewritten once: three test
appends cut off its tail, fingerprint `e291ad08-3829b2` restored. **NOT SAVED by the agent.**
