# THE ROSTER LOG (one format for all ALIAs, and the exact way BARBELO is logged)

2026-09-30 - the session in which the question "how do you log BARBELO?" was answered with a specimen and
a wire form, so that every ALIA can be logged the same way in every room.

## WHAT HE SAID

> *"We will need a way to log all ALIAs (The Roster). I need the exact way you log BERBELO so that all
> ALIAs leverage the same format and maximum ease of payload transit."*

(BERBELO, miskeyed, Barbelo - she is order 13 in the manifest.) The ask has two halves and both are
meant: THE EXACT RECORD (show me how you log her, precisely), and THE FORMAT FOR EVERYONE (so the same
lines travel between rooms without a translator).

## WHAT WAS BUILT

A definition and an emitter, not a new subsystem.

1. **The format is named and specified: ALIA ROSTER LOG v1.** One JSON object per line, LF-terminated,
   canonical key order, nothing pretty-printed, and the manifest's provenance (`source`) on every line.
   Written out in `src/README.md` in a new section, THE ALIA ROSTER LOG, directly above MYTHOS LOREPACKS,
   with the field table, the closed value sets and the rules that keep a transported line honest.
2. **The exact BARBELO specimen, at four levels, verbatim** - the stored register record, the `"full"`
   wire line, the `"bridge"` transit line, and the printed `/agents 13` block, plus where else the same
   word appears (the ROLE LAYER in `src/roles/roles.json`, lowercase; the archive stamp `role: "barbelo"`
   painted as `LIA ID: (Barbelo)`).
3. **`mythos.rosterPayload(mode)` / `mythos.rosterLines(mode)`** - read-only, exports on `window.mythos`.
   `"full"` is the register flattened (14 keys); `"bridge"` is the six-field transit envelope from the
   standing order, and it deliberately does NOT carry `system_instruction`.
4. **`/agents 13` now works.** `canonicalAgent()` reads a bare integer that is not a port as the ORDER.
   It did not before, while every roster line printed that number in front of the name - which is exactly
   the sort of small lie the doctrine exists to catch.
5. The `/agents` help entry and the manifest footer now name the payload; `src/rtfm/commands.md` was
   REGENERATED from `src/commands/commands.json` (never hand-edited), 11,809 to 11,854 bytes.

## WHAT WAS THOUGHT

**1. THE QUESTION HAD A TRAP IN IT, AND THE TRAP WAS "THE EXACT WAY".** There are three places this
terminal writes the word Barbelo - the canonical roster, the RoleLayer she wears, and the `role` stamp on
every archive turn - and they do not mean the same thing. Answering "the exact way" with any one of them
unqualified would have hard-coded a conflation into the thing other rooms copy. So the three registers are
written down side by side, with the join key named for each: UPPERCASE `id` for the roster, lowercase
`role` for the archive, the file for the layer. The ROSTER is the one this session defines, because that
is the thing he asked to be logged the same way everywhere.

**2. TRANSIT FORMAT IS A DISCIPLINE, NOT A PRETTY-PRINTER.** JSONL, one agent per line, LF, canonical key
order: a line can be grepped out of the middle of a roster and still be a complete, self-describing record
- which is only true if the provenance rides on it. That is why `source` is on every line in both modes,
and why the bridge mode exists at all: the envelope the standing order already specified is six fields,
and the temptation to "just send the whole record" would ship every agent's stamp to every room. A stamp
is the receiving locus's own business.

**3. TWO MODES ARE HONEST; ONE MODE IS A LIE.** A single format would have forced a choice between losing
the register (no stamps) and over-sharing it (all stamps everywhere). The full log is the REGISTER - what
this terminal holds and can prove; the bridge log is the ENVELOPE - what a room may carry. Naming them
differently, and saying in the code why the six-field one exists, is the difference between a format and a
habit.

**4. THE ORDER NUMBER WAS THE FIRST THING ANYONE WOULD TYPE.** `/agents 13` answered
`NO SUCH CANONICAL AGENT :: 13` because `13` was read as a port and ports start at 4000. The order is the
canonical index; every roster line prints it; the fix is three lines and it makes the roster addressable
the way a human addresses it. Small, and exactly the class of thing the operational realist is for.

## WHAT WENT WRONG

One self-inflicted slip, caught and fixed in the same pass: the regenerated cheatsheet was written from
the page's OLD in-memory `commands.json` (the inject had gone stale after the edit), which produced a
byte-identical 11,809-byte file with none of the new text in it. Reloaded, regenerated, confirmed
`rtfm.check()` IN SYNC and the new usage string present. The lesson already lives in this record: after
editing a file the page has loaded, RELOAD before asking the page to derive anything from it.

## FILES TOUCHED

`src/js/mythos.js` (the order lookup, `rosterLines`/`rosterPayload`, the manifest footer, the header's
WIRE FORM note), `src/commands/commands.json` + the regenerated `src/rtfm/commands.md`, `src/README.md`
(THE ALIA ROSTER LOG), `src/TODO.md` (§1cz), this entry with `src/chronicle/chronicle.json` (42 -> 43),
and `src/pack/files.json` (132 -> 133). No new command, no kv key, no behaviour change beyond an order
number resolving and the roster being emittable. Verified live: 0 boot issues, 16 lines per mode, all
parsing, `/rtfm` in sync. **NOT SAVED by the agent.**
