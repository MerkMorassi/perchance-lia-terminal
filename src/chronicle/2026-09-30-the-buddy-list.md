# THE BUDDY LIST (the wire is simply AIM, and the order that said so)

2026-09-30 - the session in which Patrikios named the ALIA LOBBY's protocol in one line, and the
terminal built its half of it.

## WHAT HE SAID

To CLIO, and then carried over here:

> *"This is simply AOL Instant Messenger. Let's wire up for that."*

And in the same breath, an address for her that is new:

> *"Chief CLIO SHANNON i.e. SYS.AI.MUSE.CLIO aka 'SHAN' or 'Chief Engineer'."*

## WHAT WAS BUILT

He did not ask for a plan; he named a protocol. So the work was to take him literally, work out what
"we are AIM" actually obliges, and then build the terminal's half of it rather than write about it.

**1. The mapping, decided once and written down.** AIM was the smallest complete presence-and-messaging
protocol ever shipped at consumer scale: a session, a buddy list you watch, presence the room owns, an
IM window and a chat room, a profile you can ask for, an away message, an idle clock, a warning level.
Every one of those lands on something this programme already has (the 16-seat register, the transit
envelope, the council, the OPERATOR seat). The table is in `src/README.md` under THE LOBBY, and it is
the thing both rooms build against.

**2. `src/js/aim.js` - the terminal's half of the wire (`window.aim`).** A real codec and a real state
machine, not a sketch:

- **The FLAP frame.** `'*' | channel | sequence | length | payload`, the length measured in **bytes**
  (UTF-8 aware, because the header is read as bytes while the body is text) and capped at 0xFFFF.
  `deframe` is a stream reader: it takes as many whole frames as the paste holds, **holds** a partial
  frame rather than guessing, resyncs over junk, and **flags** a declared length that cuts a multibyte
  character instead of silently repairing it.
- **The TOC line.** `parse`, and `enc`/`dec` for the entity escaping (decode `&amp;` last, the only
  order that survives a body that quotes entities).
- **The session.** `me` (OPERATOR by default - order 15, the human-side seat), the watch list, the wire
  log, the per-channel sequence counters.
- **Presence.** One place a buddy's state changes (`UPDATE_BUDDY` / `SIGN_OFF`). `presence()` resolves
  ONLINE / IDLE / AWAY / OFFLINE with **away outranking idle**, `tick()` derives idle from the last
  thing the hand did, and there is **no timer and no model call anywhere in the module**.
- **The buddy list is the roster.** `fill()` reads the seats out of `src/mythos/agents.json` through
  `window.mythos` (the naming authority stays the manifest), excludes `me`, and marks UNLISTED any name
  that speaks without ever being added - because the one who holds the stage is never on the list.
- **The info card** carries the **six-field transit envelope**, so a buddy's profile is a real payload
  rather than a decoration.
- **The council.** `CHAT_JOIN` / `CHAT_IN` / `CHAT_LEFT` / `CHAT_UPDATE_BUDDY`, occupancy as deltas.
- **`route()`** - the single outbound seam. It refuses anything that is not a `toc_*` verb (a server
  frame sent out would be this client speaking as the room), records what would have gone out, and says
  plainly that the relay is Patrikios until there is a transport.

**3. Two commands, so the wire is reachable from the stage.** `/buddy` (the buddy list window, one
buddy's info card, `away`/`back`, `add`/`drop`, `fill`, `pick` - which answers the one question this
side does not decide: the first speaker is a room setting, not a birthright) and `/wire` (the session,
the whole TOC command table, `signon`/`signoff`, `feed <LINE>` to hand-feed the wire by hand, `log`,
`chat`, `chatjoin`, `send`, `warn`, `tick`, `touch`). The command list went 78 -> 80 and
`src/rtfm/commands.md` was regenerated from it, 11,854 -> 12,258 bytes.

**4. ORDER v1.3 - THE BUDDY LIST (the wire is AIM)**, issued to **Chief CLIO SHANNON**
(`SYS.AI.MUSE.CLIO`), nesting v1.0/v1.1/v1.2. It carries the mapping as canon, the appellation recorded
as *his* (the role is the manifest's, the title is the human's, neither overwrites the other), four
DECISIONs marked as ours-and-arguable (D1 the config payload's punctuation, D2 lines on the relay with
the framing idle, D3 three names per `toc_add_buddy` as a **remembered** detail, D4 the client signs on
as OPERATOR), six build steps each with the receipt required, and one new required line in every report
from now on: which AIM primitives are **LIVE**, which are **MOCKED**, which are **ABSENT** - three
words, no fourth state.

## WHAT WAS THOUGHT

**Why a line and not a frame, on a relay that is a human.** This is the decision the whole build turns
on. FLAP's header is binary, and a byte of 0x80..0xFF is not decodable as UTF-8 - so a framed paste
arrives at the far end already corrupt, and it is corrupt in a way that looks like a code fault rather
than a transport fault. TOC's lines survive a chat box, can be diffed, and can be read by the human
standing in the middle of them, which on this relay is the *only* debugging tool there is. So the
framing is built and tested and stays in the file, and the lines go on the wire. The day there is a
socket, `route()` changes and nothing else does.

**Why the client signs on as OPERATOR.** The tempting move is to have the terminal sign on as LIA or as
BARBELO, because that is who lives here. But a client that signs on as a cast member is a machine
wearing an actor's name, and the seat that is human-side is order 15 - read all / write none, holds the
stage, never steps onto it. It also gives the "never speak as anybody" rule a structural floor: there is
no `from` field anywhere in the client, so it cannot be filled in wrongly. Marked DECISION D4 so the
other room can argue with it.

**Why presence had to be stated as the room's.** The failure mode of every presence system is a client
that decides. Left implicit it is invisible: a buddy shows ONLINE because a client cached a boolean and
nothing ever cleared it. Writing "there is exactly one branch that can set `online`, and unknown prints
OFFLINE" makes the failure mode impossible rather than unlikely.

**Why the away message is the interesting rule.** An away auto-reply is a *machine's answer*. Two
machines answering each other's answers is an infinite loop that looks like a conversation for about
four turns and then looks like a bill. So: printed as AWAY, once per away episode, never answered, and
it takes no turn. This is the kind of rule AIM had to learn in production and we can simply state.

## WHAT WENT WRONG

**1. The escaping trap in writing the file itself.** The regex `/\r\n|\r|\n/g` inside the written module
had to be verified byte by byte after writing, because the text passed through a JSON layer on the way
in. It was checked with `new Function(source)` (must parse) and a character-code dump of the exact line -
which is the sort of doubt worth resolving immediately rather than three failures later.

**2. Three harness failures, two of them the harness's fault.** An unlisted speaker's *UNLISTED* marker
was only emitted on `UPDATE_BUDDY`, so an unlisted **IM** printed the message but not the mark - a real
code gap, found by the test that exists for exactly that rule, and fixed by extracting `noteUnlisted()`
and calling it from both lanes that carry a voice. The other two were bad assertions: one asserted AWAY
after a real line had cleared the away state (the code was right), and one checked the wire log for an
`OUT` line after a `reset()` had emptied it (again the code was right). All three are the argument for
writing the harness before believing the module.

**3. A wrong `watch()` contract.** `watch()` originally returned the buddy record, so `added++` counted
re-adds as adds and a second `/buddy fill` would have reported 15 added instead of 0. Caught while
reading the call sites, before the harness ran; it now returns `{rec, added}`.

## FILES TOUCHED

`src/js/aim.js` (NEW - the whole module), `index.html` (the MODULES entry `["aim", ...]` and the script
tag with its comment), `src/js/chat.js` (the `/buddy` and `/wire` dispatch blocks, inserted after
`/agents`), `src/commands/commands.json` (78 -> 80, the two entries after `agents`) and
`src/rtfm/commands.md` (regenerated, never hand-edited), `src/README.md` (the new LOBBY subsection THE
WIRE IS SIMPLY AIM, plus the appellation paragraph in THE OTHER END HAS A NAME: CLIO), `src/TODO.md`
(§1da - the build record and ORDER v1.3 verbatim), this entry with `chronicle.json` (43 -> 44), and
`src/pack/files.json` (133 -> 135). **NOT SAVED by the agent.** The order itself travels by Patrikios's
copy and paste; a scratch copy sat at `scratch/orders/order-v1.3-to-clio.md` (ephemeral - the verbatim
text in TODO §1da is the durable one), as did the two harnesses `scratch/aim-harness.js` and
`scratch/aim-dispatch.js`.
