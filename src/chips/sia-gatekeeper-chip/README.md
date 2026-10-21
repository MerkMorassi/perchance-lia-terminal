# MYTHOS GATE - standalone household door chip (for SIA)

A fail-closed login gate: one screen, one shared secret, no server, no accounts.
Ported from LIA's PRIAPOS door (`src/js/gatekeeper.js`), proven since 2026-09-30,
stripped of everything SIA doesn't need. Zero dependencies.

## install

1. Paste `gate-snippet.html` near the TOP of `<body>`, before your app markup.
   The overlay is visible by default on purpose: if the script never loads,
   visitors see the wall, never the app. That is the fail-closed guarantee.
2. Put `mythos-gate-standalone.js` where the snippet's `<script src>` points.
3. Rename `SIA` in the snippet head to her realm's name. Done.

## how it works

- First device: open the page, press MINT A SIGIL, carry the shown-once
  token to every other device (type it there). That first token becomes the
  household secret by enrolment - no Authority, no accounts.
- Later devices: type the sigil, PASS. Wrong sigil: DENIED, gate stays shut.
- A pass opens an 8-hour session; inside it the device walks straight
  through, past it the gate asks again.
- Only the SHA-256 of the sigil is ever stored (kv `sia_settings/gatekeeper`,
  localStorage mirror as fallback). The token itself is kept nowhere and
  never printed in any log.

## commands (wire into chat if you like)

`gate.words("show | mint | forget | status | logout")` - same verbs as LIA's
`/gatekeeper`. `forget`/`logout` clears this device so the gate asks on next load.

## deliberately left out

- The Authority road (`gk_...` entitlement inspect against his server) - needs
  his KEYS panel and server URL; say the word and it comes as a second chip.
- QR scan/draw (camera + upload) - needs the vendored jsQR/qrcode libs; typed
  entry covers the same secret.
- The age door underneath - separate concern, separate chip.

## honesty note (same as ours)

Not a lock against anyone who can read this file - the overlay, the hash and
every word here are public source. It keeps the casual visitor out and the
honest visitor honest. A household door with a god's name on it.
