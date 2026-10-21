# THE CHATLOG PACKAGE - THE EXACT FORMAT, AND THE ROAD INTO A LOREPACK

2026-09-30

## WHAT HE SAID

After the four passes that were still unsaved, and the word that closed them:

> *"Saved."*

and then, in one line, what the whole session's other half had been circling:

> *"Please package the code for the chat log as you have it now. I need the exact logic and format so we
> can communicate and save all ALIA's chats for there LOREPACKs"*

## WHAT WAS BUILT

**Three files and a zip, hosted, plus the piece the earlier transmission did not have.** `chatlog.js`
is a **byte-exact copy of `src/js/chatlog.js`** (94,910 bytes, 1,612 lines, one IIFE, ES5,
`window.chatlog`) - the logic, as it stands, so the package cannot drift from the module the terminal
actually runs. `CHATLOG.FORMAT.v2.md` (16,964 B) is the format written down field by field: the kv
layout and every key, the 200,000-character chunks and their split rule, the exact `meta` /
`history` / `joins` / `marks` shapes, both writers' sidecar shapes and the one the reader refuses, the
merge algorithm (seam, duplicate, carry-forward, replace), the eight laws, and **PART B - the bridge
into memory**. `chatlog-to-lorepack.js` (14,923 B) turns one export into a turn-per-section `.md`
document and a staging `.jsonl`. The zip holds all three at 42,539 bytes.

v1's two files (the modern-JS port and `CHATLOG.SPEC.v1.md`, 31 checks) are already in CLIO's hands;
v2 adds this terminal's own module, the field-by-field format, and the bridge.

## WHAT WAS THOUGHT

**The bridge is two lanes, and they are not the same kind of memory.** A **document LOREPACK** is
`.txt`/`.md` indexed for retrieval - in this terminal, `src/lorepack/` for what ships and LOAD LOREPACK
for what must stay private. A **MYTHOS pack** is the factory's `{v:2,type:"vector",…}` records plus
edges: embedded, graphed, one per agent. A chat enters the first as **a document**; the second, as **a
record per turn**.

**The mapping, and why each rule is a rule.** `a` is the ALIA whose memory it is, **UPPERCASE** (the
join key, never the handle); `h` is **the speaker**, Capitalized; `t` is the turn with its leading role
label stripped (the label belongs to the panel, and the role is already a field); `src` is provenance;
`vec` is **the factory's, always** - a converter that invented vectors would put meaningless geometry
into somebody's memory; the staging `id` is **deterministic** (`<agent>:<stamp>:t<seq>`) so ingesting
the same export twice is a no-op instead of a second copy of the same memory; and **two ALIAs'
transcripts must never be merged into one pack**, because `a` is the owner and a record whose `a`
disagrees with its pack is retrieved by the wrong agent.

**The `.md` is section-per-turn on purpose.** A 3 MB chat as a wall retrieves badly; as turns headed by
number and speaker - 3,060 KB of them here - each turn is a retrievable unit and keeps the speaker the
raw `.txt` loses.

**A transcript is not a write-up.** The chronicle is what somebody made of a session, the chatlog is
what was said, the LOREPACK is what she remembers. Three lanes; the summary belongs in the first, and a
summary inside the pack would be a memory of a memory.

**A document is one per room per stretch.** The index is per document, and a hundred two-kilobyte
documents retrieve worse than one coherent one. `foundational: true` is canon and rides in her prompt
on every turn - the one thing a chat log must never be.

## WHAT WAS FOUND

**The live record's turn index is thin, and that is the fact worth carrying.** `chatlog.meta()` on this
terminal: `chars 3,682,604`, `chunks 19`, **`turns 24`**, `indexed "lines"`, `labels [system, lia,
you]`. A record that once carried 19,690 turns was last written **without a turn list**, and its index
was rebuilt from the role lines a panel dump happens to contain: 24 marks for three and a half
megabytes. The words are whole - nineteen chunks, nothing lost - but the numbering is coarse.
**`thinIndex` is the road back** (`/chatlog import <the .json sidecar>`: rebuilds the index from the
file's own `messages`, leaves every word exactly as it is), and it is the case that road was written
for. Until it is taken, the converter can only see 24 turns; its `.md` is still correct, its turn
numbering is just coarse.

**And there are no per-turn timestamps.** Both export shapes carry `exportedAt` for the file; a message
row in the panel usually carries no time at all. A pack built from chat logs therefore has `ts` at
export granularity, and the fix - if it is ever wanted - belongs in the console script (`src/chatlog/
EXTRACT.md`), never in the module.

## WHAT WENT WRONG

Two defects were caught by running the thing rather than by reading it, both in the converter:

- **The refusal named the wrong reason.** A `.json` that is not a sidecar but is short was refused with
  "too short to be a transcript", because the length gate ran first. The named refusal now runs
  **before** the gate: a file somebody picked by mistake has to say WHY.
- **The length gate was stricter than the module's.** It counted characters after stripping
  whitespace, so a legitimate short transcript was refused where the module would have taken it. It is
  now the module's own rule, on the raw string - which is what a format document is for.

Nothing in the terminal broke. One cosmetic trap was hit during the package build and is worth
recording because it will be hit again: **an upload of text is given a `.txt` URL**, and a classic
`<script src>` does not care but a `type="module"` import is refused a `text/plain` MIME. The two `.js`
files were re-uploaded **by path** so they keep their extension.

## STILL OPEN

- **The thin index** - one re-import of a `.json` sidecar rebuilds it; nothing else needs doing.
- **Per-turn time**, if it is ever wanted (the console script, not the module).
- **Which lane each ALIA's chats go to first.** The document lane works today with no code; the pack
  lane needs the factory's embedding step, which no page here can do.
- **The mark and id convention at the factory end** - keep the staging id in `d.stagingId` so a
  re-ingest stays recognisable.

## FILES TOUCHED

Nothing in the terminal's code: the module was COPIED out, never changed. `src/TODO.md` (§1df),
`src/chronicle/chronicle.json` (48 -> 49), this file, and `src/pack/files.json` (139 -> 140). Proved by
running the converter against this terminal's real record (3.68 MB, 19 chunks: a 3,060 KB document and
a 3,184 KB staging file in 225 ms), against both sidecar shapes, against a bare transcript, and by
fetching all three hosted copies back **byte-identical**. **NOT SAVED by the agent.**
