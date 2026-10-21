# THE TRANSMISSION (the chatlog lane, ported and sent to the record)

2026-09-30 - the session in which the terminal's own record-keeping lane was ported, proved, and handed
to CLIO, so the other room can keep its making the way this one does.

## BLUF

**A self-contained CHATLOG was written for CLIO's room, verified with 31 checks against the real
plug-in, hosted at a permanent URL, and specified in a document that carries the law, the shapes, the
API and the acceptance suite - because she is order 2, the record, and her room already keeps a room log
but no record of its own making.**

## WHAT HE SAID

> *"Copy that. Transmit complete chat log code and specs for CLIO."*

## WHAT WAS MADE

**`chatlog.js` (38,555 characters / 38,560 bytes, modern JS, one file, no dependencies beyond `root.kv`)**
at `https://user.uploads.dev/file/94aab937ace827d196d7d12ed428c979.js` - the whole lane, in her room's
dialect rather than this terminal's ES5. It carries: `put` (the import, with the seam), `capture` (read
the room's OWN panel - the half a room gets for free and the terminal cannot have), `brief`, `status`,
`listText`, `showText`, `turnText`, `turnsText`, `grepText`, `exportIt`/`downloadAll`, the policy pair,
`origin`, `wipe`, `about`, `setSpeakers`, and the six laws the header states and every function obeys.
Same kv key names (`chatlog_meta`, `chatlog_chunk_<n>`, `chatlog_marks`, `chatlog_policy`,
`chatlog_origin`), same 200,000-character chunk, same turn marks, same join stamp, same sidecar shape as
this terminal's own 94,910-byte ES5 chatlog - so the two rooms' records are one shape and the lobby's
history can be assembled later without a translator.

**`CHATLOG.SPEC.v1.md` (13,517 characters)**, hosted at
`https://user.uploads.dev/file/fdbf9f6327707619afe0276d0b2b7370.txt` - the specification: BLUF, the six
laws, the shapes (with the tables), the API, how it grows (with the measured numbers), capture and how a
role line is recognised, **the five lanes that must not merge**, why the shapes match the terminal's,
the 31-check acceptance suite she must reproduce, install + the verbs to wire, and what is deliberately
not built.

**How it was proved.** The port was loaded into the live page over the top of the terminal's own
`window.chatlog` (the original kept and restored at the end), pointed at its own kv folder (`chatlog`,
not `lia_settings`, so the terminal's real 3.68M-character record was never touched), and run against a
31-check suite that walks all six laws: a transcript filed and indexed by role lines; the same file
again changing nothing; an append taking only what is new (+203 characters for a 74-character addition,
the ~150-character join stamp included); a sidecar for words already held rebuilding ONLY the index; a
bare dump appended to a turn-indexed record CARRYING the index forward; a foreign `.json` refused; a
too-short paste refused; `capture()` reading a fabricated panel with its turns; grep naming chunk and
line; brief/show/turn/status/about; the export's text byte-identical to the record and carrying its
turns; its own export re-importing as a no-op; a 307,956-character record splitting into 2 chunks;
REPLACE visible; policy round-tripping; the per-origin rule; wipe refusing without the word; and **no
trace left in the store at the end.** The suite was then re-run on the exact bytes that were uploaded,
and the hosted copy was fetched back and compared: **byte-identical, 38,560 bytes.**

## WHAT WAS THOUGHT

**Why the port and not the file.** This terminal's chatlog is 94,910 bytes of ES5 written for a page that
has to reach a foreign origin by handing a human a console script. Her room is modern JS and IS the page.
Handing over the terminal's file would have given her the harder half and none of the easier one; the
port gives her `capture()` instead of an OPS, and the same shapes underneath.

**Why one shape matters more than one file.** This is the ALIA ROSTER LOG argument applied to a
conversation. The value is not that her record looks like ours - it is that a later session can read
either one without being told which room made it.

**Why the role-line rule had to be generic.** The first draft inherited the terminal's whitelist of
speaker words, and the suite caught it immediately: a line reading `HISTORIAN:` was not a turn, because
no one had added the word. For her room that is the difference between a record and a partial one - the
agents are a roster, and a roster changes. A single word followed by a colon is a turn; a whitelist is
only needed for the no-colon form.

**Why the export rebuilds its turns FROM THE MARKS.** A second suite failure: an export whose `messages`
were re-scanned from role lines disagreed with the record's own turn count, which would have meant a
record's own export changing its index on re-import. Now the sidecar carries the index the record
actually has, so "the record only ever gets better" survives its own round trip.

## WHAT WENT WRONG

**Three real defects, all found by the suite before anything was sent** - the whitelist above; a `.json`
that was neither sidecar nor index being FILED AS A TRANSCRIPT instead of refused (the terminal refuses
any JSON that is not a sidecar; the port had narrowed that to index files only); and `capture()`
inheriting the 200-character minimum, which refused a room's own short panel. Two more were the
harness's own wrong expectations (a join stamp is ~150 characters, and a 132KB record is one chunk, not
two), and one was cosmetic (a stray `chatlog_policy` key after the wipe - a setting, not the record, so
the port was right to keep it and the harness now removes it).

**A self-referential stamp, tried and removed.** The port briefly carried a `HOSTED COPY :: <its own
URL>` line in its header - which then went stale the moment the file was re-uploaded. It was removed
rather than corrected: a file that names its own hosted copy is a file that will one day name the wrong
one, and the SPEC is the right place for the URL.

## FILES TOUCHED

Nothing in the terminal's own code: this pass is a **transmission**, not a build. `src/chronicle/2026-09-30-the-transmission.md`
(this entry) with `chronicle.json` (46 -> 47), `src/TODO.md` (§1dd - the record of the package, its URLs
and the acceptance result), and `src/pack/files.json` (137 -> 138). The package itself lives in
`scratch/transmit/` (`chatlog.js`, `CHATLOG.SPEC.v1.md`, `port-suite.js`, `echo2.js`) - ephemeral, which
is why the URLs and the spec's essentials are recorded in TODO §1dd. A temporary `src/t-chatlog-probe.js`
existed during the run so the page could fetch the port, and was deleted afterwards. **NOT SAVED by the
agent.**
