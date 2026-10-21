# THE CHATLOG

**The raw record of the conversation this terminal was built in.**

Everything else in this generator is either the machine or the record of *using* it. The conversation
that *built* it - what Patrikios actually asked for, in which words, what was tried first, what the
numbers were, what was rejected and why - lived only in the editor's chat window, and a chat window is
the one file that closes. A handoff note is a few kilobytes of somebody's memory of it. `src/chronicle/`
is the write-up. **This is the transcript.**

## What lives where

| | |
| --- | --- |
| `src/js/chatlog.js` | **the reader** - the panel, the import, the chunking, the turn index, `show` / `turns` / `turn` / `grep` / `export` |
| `src/chatlog/EXTRACT.md` | **the export recipe** - the script that reads the editor's chat panel, and how to run it |
| `src/chatlog/manifest.json` | **the shipped index** - what the record is, how big it was, where any cold copy lives, and **the origin the record is kept at** (the one claim that travels with the code) |
| `src/chatlog/CHATLOG.FORMAT.md` | **the format** (v2.1) - written down field by field: the kv layout and every key, the chunk rule, the exact `meta` / `history` / `joins` / `marks` shapes, the merge (seam, duplicate, replace), and **PART B**: how a transcript becomes memory. These are the same bytes delivered to another ALIA's room (see `package` in `manifest.json`) |
| `src/chatlog/chatlog-to-lorepack.js` | **the bridge** - one export in, a turn-per-section LOREPACK document + a staging JSONL out; refuses a `.json` that is not a sidecar, by name; never invents a vector (`vec: null`) |
| **the record itself** | **in this browser's `kv`** - `lia_settings / chatlog_meta`, `chatlog_chunk_<n>`, `chatlog_marks`, `chatlog_origin`. NOT here. |

**The record is never in `src/`.** `src/` is public - it ships with the generator and anyone who opens
the source can read every file in it - and a conversation is not public. It is full of things said
between two people, and of incidental things like keys, ids and private addresses. So the raw record
stays in `kv`, on the device, and only the reader, the recipe, the index, and the format + bridge that
another room builds against, ship.

## Read it first: the brief

```
/chatlog brief          (or the panel's BRIEF button)
```

The record is megabytes and only ever grows (5,837,854 characters / 30 chunks / 11,024 turns when this
was written, 2026-09-30), so a session that reads all of it has spent everything it has on the reading. **`/chatlog brief [N]` is the fixed-size head instead**, and it is
what a session should read before anything else:

- **where it is kept** (`KEPT AT`) - see below;
- what the record **weighs**, how many **chunks**, **imports** and **joins**, its **fingerprint**,
  the **policy**, and when it was **last imported**;
- where it **starts** (turn 1, quoted) and where it **is now** (the newest `N` marked turns, `6` by
  default, each quoted - not summarised: the brief holds no opinions);
- the **actual last line** of the record, quoted as it stands - and it is whatever the transcript it came
  from ended with, not necessarily a turn: today it is the editor's own refusal
  (`MESSAGE TOO LONG, 78,797/64,000 CHARACTERS - DELIVERY IS UNKNOWN`), because that is how the
  conversation the last import carried ended. Read it as the record's edge, never as something she said;
- what was **made of it** - the newest `src/chronicle/` entries, because the chronicle is the write-up
  and this is the evidence;
- the ways **deeper**: `/chatlog turn <N>`, `/chatlog turns [N]`, `/chatlog grep <WORDS>`,
  `/chatlog show <CHUNK|first|last>`, `/chatlog list`, `/chatlog origin`.

It costs **two chunk reads** however large the record grows, and every line of it is a **labeled
field** - so two sessions' briefs can be compared line by line and only what changed shows up. A thin
turn index says so in it, with the one import that fixes it.

## Where it lives (`/chatlog origin`)

**`kv` is per-origin, and the origin is the generator's ID** - not its name. Every key of this record
lives in the storage of `https://<generatorPublicId>.perchance.org/<name>`, so:

- **a SAVE does not move it.** This generator already exists on the server under this ID (its page is
  served at that subdomain, and the server already holds its `main.pjs` and most of its `src/` files),
  so saving uploads the *rest of the source* to the **same** generator. Nothing has to be exported
  first. **This was checked against the server on 2026-09-26, not assumed** - the served page for this
  name already links to that exact subdomain, and the API already answers with its code;
- **a RENAME does not move it either**: the name is the path, the ID is the origin;
  > **CORRECTED 2026-09-30 (measured).** This bullet was WRONG. The generator was renamed
  > (`2hoy6c5u0x` -> `mythos-lia-barbelo`) and `window.generatorPublicId` moved with it
  > (`60a6e23d...` -> `7f77c07f...`), so the SUBDOMAIN changed and this store went with the old one: kv
  > `lia_settings` came up holding only `folders` + `sync` and the vault measured 0 records. A rename is
  > **not** free - the name is the storage key. The way back is the old name. See `src/TODO.md` §1dr,
  > "A FINDING THAT IS NOT CODE: THE ORIGIN MOVED".
- **a FORK is a new ID**, and therefore a different origin with an **empty store**. The record does not
  follow, and without a word from the page a session would find an empty store and not know why.

So two claims are kept. **HERE** (`lia_settings / chatlog_origin`: `{ origin, id, name, first, seen }`,
written on first sight and read at every boot) is the origin's own memory of holding the record.
**THE SHIPPED INDEX** (`manifest.json` → `record.origin`) is the only claim that **travels with the
code**, which makes it the only one that can speak up on an origin that has never seen the record.

`/chatlog origin` prints both, the verdict, why the question is asked at all, and what to do if they
ever disagree: *the record is over there - open the terminal at the origin named, `/chatlog export`,
and bring the file back here.* The record also stamps its origin into `chatlog_meta.origin` on every
write, and an import whose file was exported from a different origin says so in its read-out.

## The loop

1. **Get it out.** `/chatlog snippet` in the terminal prints a small script. Paste it into the
   **editor's own console** (F12 on the editor tab, not in this preview - the editor is a different
   origin and nothing running in this page can read its chat panel). It finds the conversation, and
   downloads `lia-chatlog-<date>.txt` plus a `.json` sidecar. It sends nothing anywhere.
2. **Keep it.** **CHATLOG ▾** in the deck → press **IMPORT** (the label on the file picker) and pick the
   `.json` (it carries the transcript *and* the role of every message, which is what makes the turn
   numbers work; the `.txt` is the same words without the roles - pick both if you like, the richest
   wins). Or paste it into the box and press **APPEND THE BOX**. It is split into chunks, indexed by
   turn, and kept in `kv`. **IMPORT is the other half of EXPORT**: it is how a record comes back after a
   wiped browser, or onto a different origin.
3. **Read it back.** `/chatlog brief` first - the head of the record, the newest turns, and what was
   made of it, for two chunk reads. Then `/chatlog` for the index, `/chatlog turns`,
   `/chatlog turn 42`, `/chatlog show 3`, `/chatlog grep <words>`, `/chatlog export`. A record of ten
   megabytes reads back as fifty chunk reads - it never has to be re-sent to a model to be remembered.

**An import ADDS to the record** (the policy is **APPEND**): the newest export of a conversation
contains everything the last one did, so an import finds the seam between the record and the new file,
keeps only what is past it, and writes the join into the record. A file that is already in the record
changes nothing at all - except the turn index, when it is a `.json` sidecar carrying the roles. One
export per session, imported every time, is therefore the intended loop: it grows, and it never gets
written twice. **REPLACE** (its own button, `/chatlog import --replace`) is the only thing here that
ever throws anything away; `/chatlog policy` says and sets what the file picker does by default.

`EXTRACT.md` has the full recipe, including what the script cannot see (messages the panel has not
rendered, panels inside a cross-origin iframe) and how to work around both.

## The rules of this lane

- **Nothing here ever reaches the text engine.** An import costs nothing, a search costs nothing, a
  read costs nothing. No part of the record is put in her prompt, and none of it is indexed for her
  recall or handed to her on a turn. It is the lane of the MAKING, like the RTFM and the chronicle -
  not her memory (the LOREPACK) and not the manual.
- **It is not the write-up.** A chronicle entry is what a session made of the conversation; the
  chatlog is what the session was actually made of. Both are worth having, and they do different jobs:
  the chronicle is a few minutes' read, the chatlog is the evidence.
- **It deletes nothing without the word.** `/chatlog wipe yes`; anything less is refused. And an
  ordinary import cannot throw anything away either: the policy is APPEND, and REPLACE (its own
  button, or `--replace`) is the only deliberate way to start the record over.
- **It is only in this browser.** Clearing this browser's storage takes the record with it - which is
  why `/chatlog export` exists, and why a cold copy (one hosted somewhere) is recorded in
  `manifest.json` so a fresh browser can pull it back with `/chatlog import <URL>`.

## For a later agent session

The record may exist and you cannot see it from the files - it is in the browser, and you are running
in that browser. Read it in one eval:

```js
await root.chatlog.ready();
await root.chatlog.brief();      // READ THIS FIRST - the head of the record (two chunk reads, any size)
await root.chatlog.origin();     // where the record is kept, and whether a save could move it
await root.chatlog.listText();   // the index: chars, chunks, turns, dates, the import history
root.chatlog.grepText("the thing you are looking for");       // search - returns text, prints nothing
root.chatlog.turnText("42");                                  // one whole turn
root.chatlog.meta(); root.chatlog.marks();                    // the index and the turn marks, as data
// the raw keys, if you want them without going through the module:
//   lia_settings / chatlog_meta, chatlog_chunk_<n>, chatlog_marks, chatlog_origin, chatlog_policy
```

**Read `brief()` before anything else in this lane.** The record is megabytes and it only grows; the
brief is the fixed-size head of it - where it is kept, what it weighs, where it starts, the newest
turns, and which chronicle entries were made from it - and every line is a labeled field, so what you
know is exactly what is on the record and not a summary of it. Then ask for the specific turn, or grep
for the words. Do not read the whole transcript to get your bearings; that is what it is for.

Nothing you do to this lane needs a `page_refresh` and nothing in it touches her prompt. If the record
is empty, the road is `EXTRACT.md` plus the user running the script - it cannot be reconstructed from
the source, because the conversation is not in the source.

**If the record is there but has almost no turns**, the `.txt` was imported instead of the `.json`
(a dump usually has no role lines to find). Nothing is lost - the whole record is still searchable -
and the fix is to import the `.json` beside it, whose `messages` fill the index. Importing it again is
safe: the words are already in the record, so only the index is rebuilt (and a later append CARRIES
the turns a record already has forward into the grown record, so an index built from a sidecar is never
lost by importing a transcript without one).

**The policy is in `kv` too** (`lia_settings / chatlog_policy`, `append` unless it has been set to
`replace`); `root.chatlog.policy()` reads it and `root.chatlog.setPolicy("append")` sets it, which is
worth doing before any scripted import so a machine-run import cannot replace a record.

**When a session imports a record, update `manifest.json`** (the `record` block: `importedAt`,
`source`, `chars`, `bytes`, `chunks`, `turns`, `fingerprint`, `head`, `tail`) and add a line to
`sessions`. That file is how the *next* session knows what is worth asking the browser for.
