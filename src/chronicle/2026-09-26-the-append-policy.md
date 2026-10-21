# THE APPEND POLICY - THE LOG THAT ONLY GROWS

2026-09-26 - the session after THE CHATLOG, in which the record stopped being a snapshot and became
a log: an import now ADDS, a file that is already in the record changes nothing, and the only way
anything is ever thrown away is on a button that says so.

## WHAT HE SAID

A question first, about whether the thing worked:

> *"So, where do we stand with your chatlog? I see 3.70mb at last time we exported/imported. Did it
> work as anticipated?"*

The honest answer was: yes, with two things that did not go as anticipated, one of them open - that
`put()` **replaced** the record, so the next session's export must not be imported over this one. He
answered the open thing with the design in two lines:

> *"Wire for next export without overwriting please. APPEND needs to be a default policy when in makes
> sense. Chat and learning is cumulative so append makes sense."*

That is the whole specification, and the second sentence is the reason rather than the instruction: a
conversation is the one kind of document that only ever gets longer, so a snapshot policy is wrong on
its face. **Cumulative** is the word to keep - it applies to the index as much as to the words.

## WHAT WAS BUILT

**The policy is APPEND** (`lia_settings / chatlog_policy`), and it is the default for the lanes that
have no button: the file picker and `/chatlog import <URL>`. The panel has both words out loud -
**APPEND THE BOX** and **REPLACE** - plus a **POLICY** button for the lanes that have none.

**`put()` merges.** Two conversations can only meet in one of three ways, and the code names all
three (`joinOf`): the new file **starts with the whole record** (the ordinary case - the chat panel
grew a little); the record's **own last 2,000 characters** are somewhere inside the new file (the head
was rebuilt or trimmed, so the exact test cannot see it); or neither, and then it is a different
conversation, which is added whole after a **marked join**. Only what is past the seam is kept, and
the seam is **written into the record**:

```
=== CHATLOG JOIN · 2026-09-24 09:38 · +29 CHARACTERS · FROM AN ANCHORED CONTINUATION ===
=== THE RECORD'S LAST 2,000 CHARACTERS WERE FOUND IN THE NEW FILE ===
```

A side table of seams would have been invisible to `grep`, `show` and any future reader; three lines
of `===` in the text are not, and they are not a role line, so the turn index ignores them.

**A file already in the record changes NOTHING** - unless it carries turns. That case (`thinIndex`) is
the important one: it is what makes re-importing the `.json` sidecar safe, and it is the road the
record's outstanding 19,690 turn numbers take. The words are left byte-identical and only the index
is rebuilt from the sidecar's `messages`.

**And the index is cumulative too** (the part the test taught me). The first version of the merge
rebuilt the index from the new text like any other import - which meant that one export imported
without its sidecar would collapse a 19,690-turn index back to the handful of role lines a panel dump
happens to contain, undoing the whole point of the sidecar. So the turns a record already has are
**carried forward**: re-anchored at their own (still valid, because an append is a suffix) absolute
offsets, with the new part's role lines added after them. `carried` records how many. Learning is
cumulative, as he said.

**REPLACE** is the deliberate opposite - the panel's own button, or `/chatlog import --replace` - and
it is the only thing in this lane that ever throws anything away. `chatlog_meta.history` now records
`mode` and `added` for every import, so the index can print an IMPORTS SO FAR table that distinguishes
`ADDED +238` from `REPLACED 3,681,808 CHARS`.

**An unrecognised `.json` is refused, not filed.** The first real import in the last session filed a
7 MB sidecar as if it were the conversation; the words were recoverable that time. This time the shape
is checked first (`jsonShape`), and a `.json` that is not a sidecar - including the module's own old
index-only export - is named and refused with the record untouched.

**What `export` writes, `import` takes in.** The `.json` this page exports is now a proper sidecar in
the console script's shape (`text` = the record, `messages` = the turns, cut back out of the record at
the turn marks), so an export can be imported - or pulled into a fresh browser as a cold copy - and
land with every turn numbered. Until this build, that file was the one file the module could not read.

## WHAT WAS THOUGHT

- **No diffing, and no threshold.** A conversation is a prefix of its own future: the next export
  contains the last export, plus more, at the end. So the merge is "find where the record ends inside
  the new file, keep the rest" - O(n) string work, no model, no similarity score, and it cannot invent
  a seam. Where the tests fail, the honest answer ("nothing of the record was found in this file") is
  written down rather than guessed at.
- **Default-safety beats default-power.** Appending costs nothing when the file is the same one and
  saves the record when it is the newest export; replacing loses history on a misclick and gains
  nothing. The destructive verb is kept, but a person has to say it.
- **A button that changes meaning with a setting is worse than a redundant one.** Hence the split:
  APPEND THE BOX and REPLACE mean what they say whatever the policy is, and the POLICY button is for
  the file picker, the URL import and the script.
- **The cost, honestly**: a merge reads the record back and re-splits and re-indexes the result (19
  reads and 19 writes for 3.7 MB), so it is a second or two in kv rather than instant. That is the
  price of an index computed at write time instead of parsed at every read - which is what makes a
  ten-megabyte record readable in slices without re-sending it anywhere.

## WHAT WAS MEASURED

Against the real 3.68 MB record, backed up into kv first and restored afterwards, fingerprint-checked
(`e291ad08-3829b2`):

- **A**, an exact extension: +94 characters of new text grew the record by 249 (the text plus its
  155-character join), the first 3,680,690 characters byte-identical, old tail intact, `joins` = 1.
- **B / B2**, the same file again, and an older capture already inside the record: `nothingNew`, with
  the right reason, record byte-identical.
- **C**, a synthetic 40-message sidecar: 40 numbered turns, `indexed: "turns"`, words unchanged; and
  `/chatlog turns 6` printed turns 1-6 with their speakers through the real input line.
- **D**, an anchored continuation (the record's tail inside the new file): matched by the anchor test,
  +29, prefix intact.
- **E1 / E2**, an unrecognised `.json` and an index-only `.json`: both refused, record untouched.
- **The carry**: 40 turns + an appended part with a role line -> `carried: 40`, `turns: 41`, and
  `/chatlog turn 41` read the new turn.
- **The panel, by clicking**: APPEND THE BOX grew the record by 390 from a 238-character paste and
  cleared the box; POLICY flipped APPEND -> REPLACE -> APPEND and the setting stuck in kv; and
  `/chatlog append <URL>` appended a 354-character hosted file while the `/chatlog import <URL>` after
  it added NOTHING and said so.

Then the record was put back exactly: fingerprint `e291ad08-3829b2`, 3,680,690 characters, 19 chunks,
69,304 lines, 21 turns, `all() === backup`, the temporary backup key deleted. **Nothing was saved and
nothing was published** - the save is still his.

## WHAT IS STILL OPEN

- **The save.** Unchanged, and still the one thing only Patrikios can do.
- **The `.json` import that numbers the 19,690 turns.** Now safe to press: it reindexes and does
  nothing else.
- **`LIA_CHATLOG_JOIN` = 2,000** is a judgement, not a measurement - long enough that a coincidence
  inside a 3.7 MB transcript is implausible, cheap to raise if a real export ever fails to match.
- **A cold copy** still has not been hosted; when one is, its URL and expiry belong in
  `src/chatlog/manifest.json`.
