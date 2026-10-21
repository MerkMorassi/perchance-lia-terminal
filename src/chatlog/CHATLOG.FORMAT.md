# CHATLOG — FORMAT v2.1

**THE EXACT LOGIC AND THE EXACT FORMAT OF THE CHAT LOG, and the bridge from a chat to a LOREPACK.**

Written 2026-09-30 for every ALIA's room. v1 (2026-09-30) was the portable port + its acceptance
suite; **v2 is the terminal's own module as it stands, the format written down field by field, and the
missing half — how a transcript becomes memory.** Everything below is the shape the code actually
uses, not an ideal.

**v2.1 (2026-09-30) adds §B3.1 — WHAT A STAGING RECORD IS, EXACTLY — because a room built from v2
emitted `v:1` staging records: the reader-side shape was in §B3 and the staging shape was only implied,
so a room and the factory's own files could not agree on `v`. Everything else here is v2 unchanged.**

## WHAT IS IN THIS PACKAGE

| file | what it is |
| --- | --- |
| `chatlog.js` | the terminal's own chat log module, byte-exact (94,910 bytes, 1,612 lines, one IIFE, ES5, `window.chatlog`). The logic. |
| `CHATLOG.FORMAT.v2.1.md` | this file: the format field by field, the merge algorithm, and the LOREPACK bridge. |
| `chatlog-to-lorepack.js` | the converter: one chat log export in, one LOREPACK document + one staging JSONL out. |

v1's two files (the modern-JS port and `CHATLOG.SPEC.v1.md` + a 31-check acceptance suite) are already
in CLIO's hands at `https://user.uploads.dev/file/94aab937ace827d196d7d12ed428c979.js` *(port)* and
`https://user.uploads.dev/file/fdbf9f6327707619afe0276d0b2b7370.txt` *(spec)*. v2.1's own delivery (2026-09-30, all fetched back byte-identical):
the module `https://user.uploads.dev/file/677e7e6277794679685b56e72810ccb2.js` (94,910 B) and the bridge
`https://user.uploads.dev/file/8d4d6ae77f82b5e7cc26e2387e4aee62.js` (14,923 B); the day's zip, and every
earlier delivered copy, are listed in the `package` block of `src/chatlog/manifest.json`, beside this
file - a document cannot name its own address, and this one does not try. Same shapes there as
here; if a room has the port, only PART B of this document is new to it.

---

# PART A — THE FORMAT

## A1. THE TWO HALVES, AND WHY IT IS TWO

1. **Getting it out.** No page can read the editor's chat panel: the panel is one origin up, and the
   browser refuses the crossing on purpose. So the export is an **OPS** — a small script pasted into
   the *editor's* console, which walks the DOM, finds the conversation, and downloads two files. It
   sends nothing anywhere. The script is a file, not a string in the module
   (`src/chatlog/EXTRACT.md`), and the module prints it from there (`/chatlog snippet`), so the copy
   handed out and the copy on disk cannot drift.
2. **Keeping it.** The module in this package: import the file, and the record is split into chunks in
   kv and indexed — which chunk holds what, and where each turn starts. Then it reads back: show,
   turns, grep, export. **Ten megabytes reads back as fifty 200 KB reads** and never has to be re-sent
   to a model to be remembered.

## A2. WHERE IT LIVES

**kv, never `src/`.** `src/` is public — it ships with the generator and anyone can read it. A
conversation is not public. So the record lives in this browser's kv store, folder `lia_settings`:

| key | holds |
| --- | --- |
| `chatlog_meta` | the index of the record — one object, shape in A4 |
| `chatlog_chunk_<n>` | chunk *n*, **1-based**, a plain string |
| `chatlog_marks` | the turn index — an array, shape in A5 |
| `chatlog_policy` | `"append"` (default) or `"replace"` — what an import does |
| `chatlog_origin` | where this record has been kept (the cold-copy claim, not the words) |

**kv is per-origin**, and the origin is the generator's ID: `https://<generatorPublicId>.perchance.org
/<name>`. Saving the generator does not move the record; **renaming** does not either (the name is a
path, not the origin); a **fork** is a new ID, therefore a new empty store. `/chatlog origin` prints
which page you are on and the fix (export where the record is, import where you want it).

> **CORRECTED 2026-09-30 (measured).** The clause about renaming is WRONG: the ID moves with the name
> (`2hoy6c5u0x` -> `mythos-lia-barbelo` moved `60a6e23d...` -> `7f77c07f...`), so a rename **does** move
> the store, to the old subdomain. See `src/TODO.md` §1dr, "A FINDING THAT IS NOT CODE: THE ORIGIN
> MOVED". A fork remains the other new-ID case.

## A3. THE CHUNKS

- Size: `LIA_CHATLOG_CHUNK`, default **200,000 characters** (minimum accepted: 20,000).
- Split rule: cut at the limit; if a newline exists in the last 40 % of the window, cut after it, so a
  chunk rarely begins mid-word. The same text always splits the same way.
- Hard cap: 4,000 chunks, so a runaway can never eat the tab.
- Chunks are written 1..N and **any chunk above N that the old record had is deleted** — that is the
  only place chunk keys are ever removed, and it happens because the record genuinely shrank.

## A4. THE INDEX (`chatlog_meta`) — EXACT SHAPE

```js
{
  v: 1,                       // index version
  at: 1790471633877,          // ms, when the words were last written
  chars: 3681955, bytes: 3681999,
  chunks: 19, lines: 19690,
  fingerprint: "a1b2c3d4-1f2e3",   // FNV-1a of the whole text + its length in hex
  source: "the .json sidecar of ...",  // what produced this import, free text
  kind: "sidecar",            // "sidecar" | "file" | "" - cosmetic
  note: "appended (+12,004 characters): ... · ...",
  turns: 19690,               // marks.length
  labels: ["user", "assistant"],   // the distinct k values in the marks
  indexed: "turns",           // "turns" | "lines" | the two degraded strings - see A5
  head: "…first line, 160 chars…", tail: "…last line, 160 chars…",
  history: [ /* one row per import ever made, last 40, see below */ ],
  mode: "append",             // this import's mode
  added: 12004, joinHow: "the record's tail was found in the file",
  joins: [ /* one row per seam ever written, last 40, see below */ ],
  carried: 0,                 // turns carried forward from the record's own index
  origin: "https://….perchance.org/…"   // WHERE IT IS KEPT - stamped on every write
}
```

**history row:** `{ at, chars, bytes, source, kind, fingerprint, replaced, mode, added }` —
`replaced` is the *old* record's char count when the mode was replace, else 0; an index rebuild writes
`mode: "index"`.

**joins row:** `{ at, added, source, how }` — one per seam; `how` is the sentence that says how the
seam was found, and the same sentence is written *into the record itself* by `joinStamp`, so the words
carry their own history.

## A5. THE TURN INDEX (`chatlog_marks`) — EXACT SHAPE

```js
[ { i: 3, l: 812, o: 43, k: "user" }, { i: 3, l: 815, o: 128, k: "assistant" }, … ]
```

`i` = chunk (1-based), `l` = line number within that chunk, `o` = character offset within that chunk,
`k` = the speaker, normalised. Capped at `LIA_CHATLOG_MARKS` (default **4,000**).

Built two ways, and `meta.indexed` says which:

- **`"turns"`** — from a real turn list (`markTurns`). Each turn's text is **prefix-matched** (first
  400 characters) into the record; a turn that cannot be found is **skipped, never guessed**. This is
  why the `.json` sidecar matters: a panel dump often has no role lines for the fallback to find.
- **`"lines"`** — from the text (`markUp`). A line is a turn if, after trimming, it is *only* a role
  word (optionally followed by `:` or a dash) and is **90 characters or shorter** — so a sentence that
  merely begins "You should…" is not a turn. The default role words are
  `/^(you|your|me|patrikios|user|human|assistant|agent|ai|lia|barbelo|system|tool|claude|gpt|developer)/i`,
  overridable with `LIA_CHATLOG_SPEAKER` (a RegExp).
- Degraded values are recorded honestly: `"role lines (the turn list matched nothing)"`, or
  `"turns (the record's own, carried forward, plus the new part's role lines)"`.

`normRole` maps a role to `user` / `assistant` / `system` / `tool` / `developer`; anything else is
kept as its own lowercase word (max 24 chars). **A mark points at the START of its turn** — the role
line included when the mark came from `markUp`. A turn runs from its mark to the next one
(`messagesFrom`), so the marks **tile** the record exactly.

## A6. THE FILES IT HANDS OUT

**`<base>.txt`** — the record verbatim, no roles. `<base>` = `lia-chatlog-YYYYMMDD-HHMM`.

**`<base>.json`** — a **sidecar**, and *both writers use recognisably the same shape*; the reader
unpacks either:

```js
// written by THIS module's export
{ format: "chatlog-sidecar", exportedAt: 1790471633877, where: "https://…",
  text: "…the whole record…",
  messages: [ { role: "user", text: "…" }, … ],
  meta: { …A4… }, marks: [ …A5… ] }

// written by the CONSOLE SCRIPT
{ exportedAt: "2026-09-30T22:14:00.000Z", where: "https://perchance.org/…#edit",
  pickedBy: "auto", picked: { key: "…", box: {…}, chars: 3681955 },
  frames: [ … ], candidates: [ … ],
  messages: [ { role: "user", text: "…" }, … ], text: "…" }
```

**Accepted** by `sidecar()`: text starting `{`, ≥ 400 characters, JSON, with a `text` string of
≥ 400 characters; `messages` becomes the turn index if present. **Refused** by `jsonShape()`: any
other `.json` — including this module's own export read back *as JSON*. That refusal is deliberate:
the first real sidecar to reach the store was filed as JSON (7 MB of escaped braces where the
conversation should have been).

## A7. THE MERGE — WHY AN IMPORT IS AN APPEND

A conversation only ever gets longer, so the newest export contains everything the last one did.
"Import the newest file" must therefore mean **keep what is here and take what is new**:

1. Read the whole record back and concatenate it (`base`).
2. `joinOf(base, incoming)` looks for the seam, in this order: the incoming file **starts with the
   whole record** (an exact extension) → or the record's **last 2,000 characters** (`LIA_CHATLOG_JOIN`)
   appear **inside** the incoming file. Result: `{ at, ow, dup, first }` — where the new text starts,
   the sentence describing how it was found, whether the file is already in the record, and whether
   this is the first import at all.
3. **Duplicate** (no new words): nothing is written. But if the file **carries turns** the index does
   not have, `thinIndex` **rebuilds the turn index only** — the words are left exactly as they were.
4. Otherwise the new part is appended, prefixed by `joinStamp(...)` — the seam written into the
   record as text, naming the character count, how it was found, and the source.
5. **The old index is carried forward**, not discarded: existing marks are re-expressed as turns at
   their own offsets and handed to `markTurns` together with the new part's role lines. Without this,
   one import without its sidecar would collapse a 19,690-turn index to the handful of role lines a
   dump contains.
6. Write chunks, delete surplus chunks, write marks, write meta.

`REPLACE` is the deliberate opposite, on its own word, and the only road here that throws anything
away (it also clears `joins`, because they describe a record that no longer exists).

## A8. THE LAWS

1. **It uploads nothing.** `EXPORT` hands you a file; `IMPORT` takes one. The only network in the
   module is `/chatlog import <URL>`, and you have to type it.
2. **Nothing goes in `src/`** — the words are private; only the reader, the recipe and the index ship.
3. **Nothing goes in her prompt.** Like the RTFM and the chronicle, this is the lane of the *making*,
   not of the conversation: the LOREPACK is her memory, the transcript is the workshop.
4. **Nothing is deleted without the word `yes`.**
5. **One import at a time** (`busy`), because two would write over each other's chunks.
6. **Append is the default**; a record that is already whole changes nothing.
7. **The record never gets smaller by accident** — only REPLACE shrinks it, and only on purpose.
8. **A transcript is not a write-up.** A chronicle entry is what somebody made of a session; this is
   what was said. Do not let one stand in for the other.

---

# PART B — FROM A CHAT TO A LOREPACK

The module is a *record*. This part is the bridge to *memory* — and it is the half that was missing.

## B1. TWO LANES, AND THEY ARE NOT THE SAME KIND OF MEMORY

| | **document LOREPACK** | **MYTHOS pack (the factory)** |
| --- | --- | --- |
| what it is | `.txt`/`.md` documents indexed for retrieval (BM25) beside the role/directive stack | records: embeddings + a relation graph, per agent |
| where it lives | this terminal: `src/lorepack/` (shipped, public) or kv via LOAD LOREPACK (private) | built by the MYTHOS LOREPACK FACTORY, read by a reader |
| who makes it | nobody — a document is a document | the factory (chunking, embeddings, triplets) |
| a chat enters as | **one document per room per stretch of sessions** | **one record per turn**, `vec` added by the factory |
| read by | `/lorepack`, `/lore`, recall into `<lore>` | `/pack search`, `/pack graph`, `/pack index <AGENT>` |

## B2. LANE 1 — THE DOCUMENT (works today, no code)

1. Take the export's `.txt`, or the `.md` the converter writes (better — see B4).
2. **Private memory**: LOAD LOREPACK (the button / drag-and-drop). It stays in this browser's kv,
   `origin: "local"`, is never uploaded, and is never touched by the manifest reconcile.
   **Shipped memory**: drop the file in `src/lorepack/` and list it in `lorepack.json` — *but this is
   public*, so a transcript goes here only if everybody may read it.
3. One document per room, per stretch — **do not** one-file-per-session forever; the index is per
   document and a hundred two-kilobyte documents retrieve worse than one that is coherent.
4. `foundational: true` is canon — **not** for a transcript. Canon is carried in the prompt on every
   turn; a chat log must be *retrieved*, not worn.

## B3. LANE 2 — THE MYTHOS PACK (one pack per ALIA)

The pack's own record shapes, for reference (reader side, `.jsonl`, one object per line):

```js
{ v:2, type:"vector", id, a:AGENT, h:handle, t:"the text", vec:[…768…],
  m:numMarkId, d:{ locus, embeddingModel, embeddingDimension, … }, src?:provenance, ts?:epochMs }
{ type:"edge", id, aid:AGENT, src:<vectorId>, s, r, o, timestamp }
```

**The mapping a chat turn → a pack record**, and the rules that go with it:

| turn | record field | rule |
| --- | --- | --- |
| the ALIA whose memory this is | `a` | **UPPERCASE id** (join key), e.g. `CLIO`, `LIA` — never the handle |
| who spoke | `h` | **Capitalized handle** of the speaker, e.g. `Clio`, `Patrikios` |
| the turn's text | `t` | the turn with any leading role label stripped (`Patrikios:` etc.) |
| where it came from | `src` | `chatlog :: <origin> :: <exportStamp> :: t<seq>` — provenance, not an id |
| when | `ts` | **usually absent**: the export carries no per-turn timestamps (see C1) |
| the embedding | `vec` | **the factory's job, never the converter's** — a staging record ships `vec: null` |
| the id | `id` | deterministic (`<agent>:<stamp>:t<seq>`) so re-ingesting the same export is a no-op |

**One pack per ALIA.** Her turns and the turns addressed to her are her experience; the *human's*
turns in another room are not. Never merge two ALIAs' transcripts into one agent's pack: the pack's
`a` is the owner of the memory, and a record whose `a` disagrees with its pack is a record that will
be retrieved by the wrong agent.

## B3.1 WHAT A STAGING RECORD IS, EXACTLY

A staging record is **`v:2, type:"turn"`, `vec:null`** — one line of JSONL per turn. This is the exact
shape `chatlog-to-lorepack.js` writes, and the shape a room's own writer must match:

```js
{ v:2, type:"turn", id:"LIA:20260924-0023:t0007", a:"LIA", h:"Patrikios",
  t:"the turn, its leading role label stripped", ts:<epochMs, usually omitted>,
  src:"chatlog :: <origin> :: <stamp> :: t7",
  d:{ origin, exportedAt, role, seq, chatlog:"v2", stagingId:"LIA:20260924-0023:t0007" },
  vec:null }
```

- **`v: 2`, never 1.** The factory's own files are v2 (`{"v":2,"type":"vector",…}` and
  `{"v":2,"type":"edge",…}`). A staging file that says `v:1` is claiming a different generation of
  the format, and the ingest then has to guess which one it is holding.
- **`type: "turn"`, not `"vector"`.** The record is *not* a vector yet — that is exactly what
  `vec:null` says. **The factory's embedder owns the transition**: it fills `vec`, adds the mark and the
  embedding fields (`m`, `d.embeddingModel`, `d.embeddingDimension`), and the record becomes the
  reader-side shape in §B3. A staging file that claims `type:"vector"` with `vec:null` is claiming to be
  something it is not.
- **`id` deterministic** (`<agent>:<stamp>:t<seq>`), and `d.stagingId` carries the same string, so a
  re-ingest is a no-op and a factory that re-ids can still recognise the record it already has (C3).
- **`a` / `h` / `t` / `src` / `ts`** are the mapping in B3, and the human's turns are `h:` the human's
  handle (labelled, see C2) — never a second ALIA.

**Whether the human's turns belong in her pack is a decision, not a detail** — see C2.

## B4. THE CONVERTER (`chatlog-to-lorepack.js`)

Runs anywhere JavaScript runs — the generator's console, the editor's console, or Node. It takes
**one** export (`<base>.json` sidecar from either writer, or a bare `.txt`) and returns two files:

1. **`<agent>-chatlog-<stamp>.md`** — a document for Lane 1: a front block (room, agent, export stamp,
   origin, turn count, user/assistant split, characters) and then **one section per turn**, headed by
   the turn number and the speaker. Section-per-turn is what makes a 3 MB chat retrieve *as turns*
   rather than as a wall — and every turn keeps its speaker, which the raw `.txt` loses. The heading is `## T<n> · <speaker>`, so a reader that wants a handle
   takes the part after the separator — the whole line is a heading, not a handle.
2. **`<agent>-turns.jsonl`** — the staging records of B3, one per turn, `vec: null`, ids
   deterministic, `src` provenance included.

It **refuses** a `.json` that is not a sidecar (same rule as the module), it never touches the
network, and it writes nothing by itself: `build()` returns the two strings and a report, and a
separate `download()` hands them to the browser.

## B5. WHAT THE CONVERTER CANNOT DO, AND SHOULD NOT

- **It cannot embed.** `vec` is the factory's, always. A converter that invented vectors would put
  meaningless geometry into somebody's memory.
- **It cannot recover time.** See C1.
- **It must not summarise.** Summarising is the write-up lane (the chronicle) — the record's whole
  point is that the words survive unedited. A summary in the pack is a memory of a memory.
- **It must not send anything anywhere.** Same law as the module.

---

# PART C — OPEN

**C1. There are no per-turn timestamps.** The console script records `exportedAt` for the *file*; a
message row in the panel usually carries no time. So a pack built from chat logs has `ts` only at
export granularity. If per-turn time matters later, the export script is the place to fix it (read the
row's `title`/`datetime`/`aria-label` before falling back to nothing), not the module.

**C2. Do the human's turns go into an ALIA's pack?** Recommended **yes, labelled** — her memory of an
exchange is not comprehensible without what she was answering — but it is the owner's call, and the
converter exposes it (`includeHuman`). What is *not* a choice: the attribution must be right.

**C3. Who assigns the final id, and the mark.** `id` in a staging record is deterministic on purpose
(idempotent re-ingest). If the factory insists on its own uuid ids, it must keep the staging id in
`d.stagingId` so a re-ingest can still be recognised.

**C4. Room name.** A transcript does not say which room it is from beyond its origin URL. If several
ALIAs share one page, pass the room/agent explicitly to the converter rather than guessing from the
first speaker.
