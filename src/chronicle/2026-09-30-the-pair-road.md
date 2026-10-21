# THE PAIR ROAD - A THIRD ROAD BETWEEN DEVICES

2026-09-30 - the session "Device Synch" became a code he reads off one device and types into the other.

## WHAT HE SAID

Under a link to `perchance.org/mythos-auto-gallery`, two ideas:

> *"2 interesting ideas here:"*
>
> *"2. Device Synch"*

This entry is the second of the two; the female-voice half is `2026-09-30-the-audionook-ideas.md`.

## WHAT WAS THOUGHT - WHY A THIRD ROAD

The terminal already had two ways to move the CONVERSATION between machines, and both need something:

- **the folder road** (`src/js/sync.js`) needs a drive he keeps backups on (G:), and only the machine that
  can SEE that folder can use it;
- **the cloud road** (`src/js/sync-cloud.js`) needs a Google account, an OAuth popup, and a file in his
  Drive - which is the one thing a phone can do that a folder cannot.

What neither road has is the thing he named: **a straight line between two devices, with nothing in the
middle that belongs to anybody.** So the third road is a **code**: twelve characters produced on one
device and typed into the other, and nothing else carried at all. No account, no Drive, no folder, no
file. The code is the whole hand-off.

**Why the code is safe to say out loud, and why the server is safe to publish.** Both devices derive
everything from the code locally - the room name (a hash) and the key (a PBKDF2 stretch of it). The server
is told the room name and never the code, so it cannot open anything it carries; and the relay holds no
state, so there is nothing there to leak, back up, or subpoena. Reading the server's source (which anyone
can, it ships in `index.html`) tells an attacker exactly what it does not have.

## WHAT WAS BUILT - THE ROAD, IN ONE PASS

1. **A code.** Twelve characters from a 31-letter alphabet chosen so it cannot be misread -
   `ABCDEFGHJKMNPQRSTVWXYZ23456789`, no I, L, O, 0 or 1 - printed as `XXXX-XXXX-XXXX`. `/pair new` mints
   one; `/pair join <CODE>` types the other device's.
2. **A room name.** `roomId = SHA-256("lia-pair-v1|" + code)`. Hex, and **the only thing the server ever
   learns**. One-way: the room name tells nobody the code.
3. **A key.** `PBKDF2(code, "lia-pair-v1|" + roomId, 200,000 rounds)` → AES-GCM 256. Computed on both
   devices, transmitted by neither.
4. **A payload.** The archive is gzipped, then sealed in ~9 KB pieces, each carried as
   `roomId + US + frame`. The far end reassembles, checks the SHA-256 digest of the whole, then decrypts
   and unzips.
5. **A merge.** The result goes through `window.sync.parse` and `window.sync.merge` into
   `kv: sacred_archive` - **the same code path `/sync down` already uses**, so the pair road cannot grow a
   second merging rule that drifts from the first. Turns are only ADDED or FILLED; nothing is overwritten,
   nothing is deleted.

## THE SERVER - A BLIND RELAY THAT HOLDS NOTHING

The relay is the first `<script type="text/x-server-plugin">` in `index.html`, immediately after
`<body id="terminal-root" class="wallOff">`, and `main.pjs` gained `createServerSocket =
{import:server-plugin}`. It does four things:

- **fan-out** - `conn.subscribe(roomId)` with `pubsub.publish`, so a frame reaches the other peers in the
  room and nobody else;
- **the rpcs** - `pair_join`, `pair_leave`, `pair_count` (presence, so the UI can say who is here),
  `pair_alive` (a 20 s keepalive that stops the subscription being dropped), and `pair_ping` (a liveness
  probe used while testing);
- **two guards** - a token bucket of 60 frames/s with a burst of 120, and a hard 24,000-character frame
  cap, so a room cannot become free storage or a flood;
- **nothing else.** `state` is never touched. A frame carries its own `roomId`, so the relay can be
  restarted or replaced and behave identically. There is no durable state at all - which is the point.

**The whole element is public source**, which is exactly why nothing secret may live in it - and nothing
does: no code, no key, no archive, no password. A blind relay is the design, not an accident.

## WHAT WENT WRONG - THE TWO BUGS TESTING CAUGHT

1. **The latin1 round-trip.** The first codec moved frames through a latin1 STRING on the way in and out.
   Compressed data is not text, so any byte above 0x7F would have been mangled the moment a real payload
   went through - a bug that would have shown up as "the far end has nothing" and been blamed on the
   crypto. Caught before shipping: `sealBytes`/`unsealBytes` take and return `Uint8Array`, and no string
   ever carries ciphertext. The 1000-turn test below is what proves it - 351 KB of gzip survived the round
   trip byte-exact, with the digest matching.
2. **The phantom peer.** An RPC reply - literally `ok␟2` - was being read as if it were a peer's presence
   frame, so a room with one real device reported a second peer named "2". Fixed: the handler ignores
   anything that is not a frame from a different `deviceId`.

## VERIFIED LIVE (2026-09-30, in the unsaved preview - the platform's own emulator, nothing left the document)

- `pair_ping` → `pong`.
- `/pair new` → code `VA7P-SZHN-GR8N`, a 64-hex `roomId`, lamp open.
- A second socket joined → `ok␟2`, and **presence listed exactly one peer, "TEST-PHONE"** - the phantom was
  gone.
- The peer's 40 sealed frames arrived, decrypted, the digest matched, and the merge answered **"NOTHING NEW
  FROM TEST-PHONE :: ALL 1000 TURNS ... ALREADY HELD HERE"** with **zero kv writes** - a duplicate send
  costs nothing because the merge only adds.
- `/pair send` → **"1000 TURNS, 351KB (COMPRESSED FROM 1303KB), IN 40 SEALED FRAMES ... 2S"**. The fake
  peer decoded all 40, **the digest matched**, and it parsed back 1000 turns. Gzip cut the archive to 27%
  of its size and the sealing survived it intact.
- `close` cleared the lamp; `forget yes` removed the code, so **no pair record is left on his device.**

## STILL OPEN - WHAT IT COSTS, HONESTLY

- **Both devices must be open at the same time.** It is a live relay, not a mailbox; there is no offline
  delivery, because there is deliberately no storage on the far side.
- **The bulk goes through the relay.** Audionook's own design is leaner for large payloads - a WebRTC
  side-channel between the peers, with the server only introducing them. This road trades that for a
  stateless server and a merge that reuses the sync's own rule. Measured cost of the trade: 40 frames,
  about 2 seconds, for a 1000-turn archive.
- **It is a third plugin import** (`server-plugin`) and a public server script in `index.html`. Both are
  cheap, but neither is free, so it stays until he says otherwise.

## FILES TOUCHED

`index.html` (the server script, `#pairBadge`, one MODULES entry), `main.pjs` (the server-plugin import),
`src/js/pair.js` (new - the codec, the socket, and `window.pair.run` for
`/pair [status|new|join <CODE>|open|close|send|name <NAME>|log|forget [yes]|help]`), `src/css/terminal.css`
(`#pairBadge`), `src/commands/commands.json` (the `pair` entry), `src/README.md`, `src/TODO.md` (§1dp),
`src/chronicle/chronicle.json` (59 -> 60), `src/pack/files.json` (157 -> 159, the two new chronicle
entries) and this file.
**NOT SAVED by the agent.**
