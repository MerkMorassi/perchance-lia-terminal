# THE GATEKEEPER (2026-09-30) - ACCESS OR DENY BEFORE THE AGE SCREEN

## WHAT HE SAID

> *"First pass on opening the website, the USER is presented with the LIA TERMINAL AGE checker.
> Another way to make it even more 'secure' is to have GATEKEEPER grant ACCESS or DENY first. The
> first screen looks for a valid token and checks against it or the USER presents his/her SIGIL
> (QR CODE) or token. Then they go to the age check screen and agree to the age and website
> policies."*

> *"Either way I'm OK with it. Perhaps it is wise to rename the URL back first and then duplicate
> it under a new name."*

Two messages, one pass: the rename sequence is answered first (it is short), the gate is the work.

## THE RENAME SEQUENCE - ANSWERED

His sequence is right with one condition. A duplicate is a NEW subdomain with an EMPTY store, so
the recovered record does NOT follow the copy: after renaming back he must MOVE THE RECORD FIRST
(/backup for the source, /sync and /chatlog export for the conversation, /gallery export for the
catalogue), and the picture/clip BLOBS have no bulk export (per-item SAVE, /embed media, or a
browser-profile copy). The rename-back half is the platform's own claim, measured nowhere here -
the subdomain is not a plain hash of the name (MD5, SHA-1, SHA-256 and twenty salted variants all
missed), so it could not be verified from this side. This is recorded in TODO §1ds alongside the
build; the rename/duplicate itself is HIS hand on the settings, not the agent's.

## WHAT WAS BUILT

The terminal has two doors now, in his order - GATE, THEN AGE.

- NEW `src/js/gatekeeper.js` (`window.gatekeeper`): the sigil check. Sixteen unambiguous characters
  in four groups of four (no I, L, O, 0 or 1); what is typed is upper-cased with dashes ignored,
  hashed with SHA-256, and compared against the one record on the device (kv `lia_settings` /
  `gatekeeper` - the hash, the moment, the zone; never the token). Enrol-on-first-use: a device
  with no mark enrols on the first sigil it is ever given. Mint fills the field and arms PASS, so
  the order on the screen is CARRY IT, then PASS. The full sigil is shown once, on the screen, never
  on the stage.
- `index.html`: the `#gateKeeper` overlay before `#ageGate`, the MODULES entry and script tag before
  agegate's, and the foot shadow extended with the gate's own PASS/MINT/COPY against the same record.
- `src/js/chat.js`: `/gatekeeper [show | mint | forget | status]`, `/help gatekeeper|gate|sigil|token`,
  HELP_TOPICS.
- `src/css/terminal.css`: `#gateKeeper` at z 2100 reusing the age panel's furniture, the shown-once
  sigil line, the message line.
- `src/commands/commands.json`: the gatekeeper entry (82 -> 83). `src/rtfm/commands.md` regenerated
  (12,827 bytes, `/rtfm check` clean).
- `src/README.md`: the file list, THE GATEKEEPER section, the age section's tail corrected.

## WHAT WAS THOUGHT

The threat model was stated honestly in the module's own header and in help(): a household door, not
a vault. Everything about the gate is public source, so anyone with the editor open can lift it off -
what it does is keep the casual visitor out and the honest visitor honest, which is what was asked
for. Three refusals fell out of that: no network QR encoder (it would receive the household secret),
no recovery question (a back door is a second front door), and the full token never touches the stage
(the stage is the transcript and the transcript is the archive). Physical access to a device IS the
enrolment ceremony - and that sentence is the whole cross-device design.

## WHAT WENT WRONG

One self-inflicted edit error: an edit meant to ADD a line (`s.textContent = token`) instead removed
it, caught on the next read and repaired with its companion (mint filling the field). Nothing reached
the page broken - the verify ran after the repair.

## MEASURED (this machine, fresh origin, 2026-09-30)

Fresh load: gate UP at z 2100, age UP beneath at 2000. Mint: well-formed token, field filled, PASS
armed, sigil line visible and matching. Wrong sigil: shut, DENIED. Right sigil: open. Forget: record
gone. Re-mint + kv read: 64 hex, no token bytes. `cmd.all()` 83. `/rtfm check` "". `__bootIssues` [].
390x844: panel 350 wide at x20, no row overflow. No page picture - the snapshot helper still hangs in
this preview, so geometry was read off the DOM instead.

## STILL OPEN

- The QR presentation (vendored local encoder, drawn on the screen, never uploaded).
- The factory GATEKEEPER seam (§1cl): offer/price/payment/entitlement against a presented sigil.
- His sequence when ready: rename back, MOVE THE RECORD FIRST, then duplicate.

## FILES TOUCHED

`src/js/gatekeeper.js` (new), `index.html`, `src/js/chat.js`, `src/css/terminal.css`,
`src/commands/commands.json`, `src/rtfm/commands.md` (regenerated), `src/README.md`, `src/TODO.md`
(§1ds), this file with `chronicle.json` (62 -> 63), `src/pack/files.json` (162 -> 165) and
`src/pack/index.html.txt` (byte-identical to the root). NOT SAVED by the agent.
