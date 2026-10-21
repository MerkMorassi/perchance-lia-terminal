# THE SECOND RECEIPT (her report graded, and the register reconciled)

2026-09-30 - the session in which the other room's report came back SHIPPED for the first time, and the
one field it had re-derived was found and closed.

## WHAT CAME BACK

Patrikios carried CLIO's report: the ALIA ROSTER LOG wired in her room - 16 canonical objects, the room
log persistent with provenance, `/agents` and `/roster` and `/log` live, `super-fetch-plugin` dropped,
her own header saying **"SESSION CLAIM, NOT SHIPPED - Patrikios presses save, then I diff platform copy."**

The duty is always the same, and it is §1co's road turned around: read the platform's own copy before
believing anything, including her header.

## WHAT WAS BUILT

**A receipt, taken first.** `downloadGenerator?generatorName=5wopwzj4v4&__cacheBust=148207` (748,117 B),
then each `src/` file at `user.uploads.dev/file/<manifest key>`. **Every CDN key had changed** -
`agents.json` from `652d4085…` to `d9474017…`, `README.md` from `1c78b551…` to `098e1d9f…`, the CSS from
`1292cdfb…` to `fdd619a8…`, `main.pjs` 396 -> 873 B, `index.html` 27,469 -> 42,427 B. The save had been
pressed, so the header's own caveat was already out of date: **the report is SHIPPED.**

**A verdict with receipts.** `super-fetch-plugin` gone (order v1.0 §10 shipped, and the purse now matches
her budget rule); `pushTranscript(from, text)` writing exactly the eight claimed keys with an ISO
timestamp, an uppercased sanitised `id`, `order: -1` for a name that is not a seat, text capped at 500
and provenance on every line; the 200-deep ring persisting to `kv.room`; the old `{from, text}` shape
migrated on load; `/agents 13` printing the head she quoted; `/log` exporting
`ALIA.ROSTER.LOG.v1.<date>.jsonl`; `logLines()` emitting the eight keys with `role` lowercased, which is
this house's own rule; and **`ROTATE` as the default first speaker with the option list built from live
speakers** - canon 3 shipped in her room's own mechanism, with no Barbelo-first birthright surviving.

**One question settled by fetching rather than asserting.** Her register's *field values* did not match
this terminal's. Before calling that a divergence I fetched the authority's own source -
`MYTHOS-LOREPACK-FACTORY-MVP/src/agents.ts` (13,610 B) - and it matches `src/mythos/agents.json`
**verbatim, seat for seat**, for orders 0-14, with order 15 upstream as `NULL / Reserved-Quarantine Locus
/ read none / write none`. So the register's values are the published canon, not this terminal's taste.

**The finding, and its cause.** Her file differs on `role` (14 seats), `revision` (15 seats, re-dated
`perchance:2026-09-30`, which erases `ara:2025-12-14` and - on order 15 - `patrikios:2026-09-17`, the one
stamp recording that seat as a LOCAL REWRITE), and `lore_policy`: `read` widened to `all` on eight seats,
two `authority` writes downgraded to `self`, MERKOS's `all` write narrowed. **The only seat she got
exactly right is BARBELO - the one seat I had handed her a specimen for.** And that is a fault in the
issuing, not the receiving: the canon went out in prose with one specimen, and **the register itself was
never handed over**, so re-deriving the other fifteen was the only thing her room could do.

**The fix, and the line drawn.** ORDER v1.4 hands over the file (16 lines, 14 keys, canonical key order,
11,605 B, uploaded) and rules: take `role`, `revision`, `meta`, `lore_policy`, `port`, `id`, `handle`
verbatim; **do NOT take `system_instruction`** - the bridge omits it on purpose because *a stamp belongs
to the receiving locus*, and her room's per-seat instructions are how her room runs its agents. Her six
UI keys stay, as hers, outside the register. And the sharp edge of §1cz got walked into and named: **the
six-field bridge carries `role` and nothing else of the register, so a room that transits only the bridge
is structurally unable to reconcile its register.**

**Two corrections to my own orders, on the record.** Order v1.2's canon line 1 said *"Handles UPPERCASE,
ids lowercase"* - the opposite of the register it declared authoritative: **`id` is the UPPERCASE one-word
join key, `handle` is Capitalized, and lowercase belongs to `role` as the archive grep key.** Corrected in
the order and in both places the live README had propagated it. And the missing file, above.

**Three smaller things v1.4 carries.** The ring buffer must confess a drop (a record that quietly forgets
is not a record); `OF ${list.length - 1}` is right only while a custom agent is filtered out first; and
the seam to hold now - when an `IM_IN` reaches her transcript it enters through `pushTranscript` and keeps
its eight keys, so the room log and the wire never grow two shapes.

## WHAT WAS THOUGHT

**Why grading has to precede answering.** The tempting reply to a report like this is a summary and a
compliment. But her own header said SESSION CLAIM, NOT SHIPPED; the platform's copy said otherwise; and
the difference between those two facts is the entire value of the relay. Reading the copy first also
turned up the one thing nobody had noticed: that 15 of 16 seats differ from the canon - a divergence
invisible in a report that says "others normalized".

**Why the fetch that settles a canon question is worth three minutes.** Two rooms disagreeing about what
an agent's `role` is can be argued forever. Fetching the factory's `src/agents.ts` and diffing seat by
seat turns an argument into a table - and it also fixed the frame of the fix: the question was never
"whose taste", it was "whose file".

**Why the diagnosis had to blame the issuing.** The rule *do not re-role* is only fair if the re-roler has
been given the roles. She had names, orders, one specimen and a prose canon. Her one exactly-right seat
was the one with a specimen. That is a controlled experiment that indicts the order, not the room - and
saying so is what makes the correction land instead of stinging.

**Why the bridge's narrowness is a real finding and not a footnote.** §1cz wrote the six-field envelope
for a *standing record*, and it is right for that. What it cannot do is carry a register, and the failure
is structural rather than careless: six fields cannot hold `revision`, `meta` and `lore_policy`. So a
reconciliation needs the full form, and now that is written down where the next session will find it.

## WHAT WENT WRONG

**1. Two false negatives of my own, and they are the lesson.** I first reported her `AGENT 13 OF 15` head
and her log migration as NOT shipped. Both claims were true: the head is built in a template
(`AGENT ${a.order} OF ${list.length - 1}`) so the literal string appears nowhere, and the migration is a
ternary on the load path that never says the word *migrate*. **A receipt that is not found is not a
receipt that is absent** - and a grader who greps must grep for behaviour, not for vocabulary. It changed
the order: she is now told to hand over the string, the count and the byte.

**2. A heading was deleted by an edit, one pass earlier.** The AIM subsection went into the README by
replacing the line `## THE SYNC (the conversation, out of this browser and back)` - and the replacement
text did not end with that line, so the heading vanished and THE SYNC's body became an orphan paragraph
inside the AIM section. Found while looking for an anchor for this pass's edit, and restored.
**A replaced string is a deleted string unless the replacement contains it**, and a heading is the one
line a reader navigates by.

**3. A payload URL that says `.bin`.** `upload_file` gave the register payload a `.bin` extension because
`.jsonl` is not in its type map. Harmless - the bytes are the bytes - but the order tells her to save it
as `ALIA-ROSTER-LOG-v1.full.jsonl`, because a file whose name says nothing about its shape is a small
trap for whoever opens it next.

## FILES TOUCHED

`src/README.md` (the ROSTER LOG `handle` row, the LOBBY bridge conventions sentence, the restored
`## THE SYNC` heading, and the new LOBBY subsection THE SECOND RECEIPT, AND THE REGISTER RECONCILED),
`src/TODO.md` (§1db - her report verbatim, the grading, the two corrections, and ORDER v1.4 verbatim),
this entry with `chronicle.json` (44 -> 45), and `src/pack/files.json` (135 -> 136). **NOT SAVED by the
agent.** No code changed in this pass. The reconciliation payload is hosted at
`https://user.uploads.dev/file/8d4c1196625f8bd6ce0f3a0a3c3b5070.bin`; the receipts behind this entry are
in `scratch/agentchat/` (`dl4.json`, `dl4-agents.json`, `dl4-tpl.html`, `factory-agents.ts`) and the
order at `scratch/orders/order-v1.4-to-clio.md` - all ephemeral, like everything in `scratch/`.
