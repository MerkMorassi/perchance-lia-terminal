# THE RECORD AT 5.87 MB - AND THE TWO THIRDS THAT LOST THEIR TURN NUMBERS

2026-09-30 - the session he pasted the CHATLOG's own index into, with no words over it, and the record
answered two things it had not been asked.

## WHAT HE SAID

The whole of it: the CHATLOG panel's index, copied out - the size, the thirty chunk rows, the import
history, the join. No question, no instruction. So it was treated as a **capture**: read it, check it
against the record itself, and only then say what it means.

## WHAT THE PASTE SHOWED, VERIFIED AGAINST THE RECORD

Nothing was taken on trust from the paste. `/chatlog listText()` was run in the live page and compared
line for line - **byte-identical** - and the record's own keys were read directly:

| what | the record's answer |
| --- | --- |
| weight | `chars 5837854` / `bytes 6155234` / `lines 109534` / `chunks 30` |
| turns | `turns 11024`, `indexed: "turns"` |
| marks | 11,024 rows, **first at chunk 19 line 1867, last at chunk 29** |
| imports | 17 in `chatlog_meta.history`; the newest `ADDED +2,156,996` from `LIA-CHATLOG-20260926-2306.JSON` |
| joins | 1 - `NOTHING OF THE RECORD WAS FOUND IN THE NEW FILE`, so the whole file was appended after a marked join |
| origin | `60a6e23d828a54dc4c8b315f33c97ba3.perchance.org` / `2hoy6c5u0x` |

The interesting column in his paste was the one that reads `0`: **chunks 1-18 and 30 have no turns at
all**, and chunks 19-29 carry 644, 1,213, 1,126, 947, 1,350, 1,255, 1,307, 1,226, 764, 729, 463.

## FINDING 1 - THE INDEX STOPS AT THE SEAM

The marks and the imported region are the same region, and the code says why. In `put()`
(`src/js/chatlog.js`) the record's own marks are carried forward **only when the arriving file carries no
turn list**:

```js
if (!(turns && turns.length) && old.indexed === "turns" && marks.length) { /* carry */ }
```

The last import was a `.json` sidecar - a real message list - so `turns` was non-empty, the carry never
ran, and the index was rebuilt from that list alone: **11,024 turns, all of them in the newest 2.15 MB.**
The older 3.68 MB is still completely there and still searchable (`/chatlog grep`, `/chatlog show`), but it
is no longer addressable by number - `/chatlog turn <N>` and `/chatlog turns` cannot reach any turn before
the seam. So the import that made the record longer is also the import that took the turn numbers off the
first two thirds of it. It is not a cap: `LIA_CHATLOG_MARKS` is 25,000 and only 11,024 are held.

## FINDING 2 - THE TAIL IS NOT A TURN

`ENDS :: ERROR: MESSAGE TOO LONG, 78,797/64,000 CHARACTERS - DELIVERY IS UNKNOWN`. That is the editor's
own refusal, stored verbatim as the last line of the record and quoted by the BRIEF, because that is how
the conversation the last import carried ended. Worth writing down so that nobody - agent or person
reading the brief - mistakes the record's edge for something she said.

## WHAT WAS THOUGHT

**A paste is evidence, and evidence gets checked before it gets believed.** The whole value of the panel
is that its numbers are the record's own; the check that makes that true took one eval, and it is the
difference between "the index says" and "the record says".

**The asymmetry is the bug-shaped part, and it is a design question, not a typo.** Carrying marks forward
when a bare transcript arrives is deliberate and right. The reverse case - a sidecar arriving and the old
marks being dropped - was never weighed, because the record had never been in it before this import. The
cost is silent: the index still says `INDEXED FROM TURNS` and the panel still looks healthy; only the
per-chunk column gives it away.

**Nothing was run against the record.** The road to fix it exists in the module already
(`LIA_CHATLOG_SPEAKER`, `markUp`, `turnsFromLines`), but rebuilding `chatlog_marks` means writing to the
record's own index in kv, which is his data - so the one open item below waits for his word.

## STILL OPEN

- **Extend the turn index over the whole record** (TODO §1dm): rebuild `chatlog_marks` so chunks 1-18
  carry numbered turns from their role lines again, alongside the sidecar's 11,024 - a code change plus
  one rebuild of the index, not of the words.
- **The tail stays an error line** until the next import of a transcript that ends cleanly; nothing in the
  module should try to detect and trim it (the record is verbatim by design), but the BRIEF now says what
  it is.

## FILES TOUCHED

`src/chatlog/README.md` (the stale "three megabytes" is now the measured figure with its date, and the
BRIEF's field list gained the tail bullet), `src/README.md` (THE CHATLOG - the carry-forward paragraph now
states the asymmetry with the measurement), `src/TODO.md` (§1dm), `src/chronicle/chronicle.json`
(56 -> 57), `src/pack/files.json` (152 -> 153) and this file. **No code changed, and the record in kv was
read only - not one key of it was written. NOT SAVED by the agent.**
