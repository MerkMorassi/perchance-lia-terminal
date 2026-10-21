# GATEKEEPER-QR - show-a-code, scan-to-enter rendezvous (for any gate)

Origin: cut for the LIA terminal's PRIAPOS gate (`src/js/gatekeeper.js`,
which already scans QRs but could not show one), 2026-10-06, spec v1.
Proven live in the terminal preview before ship.

## use

Screen (untrusted device wanting in):

```html
<script src="gatekeeper-qr-standalone.js"></script>
<script>
  var qr = MythosGateQR.client({});
  var rz = qr.rendezvous();                       // {channel, nonce, expiresAt}
  HOST.drawQR(qr.qrPayload("https://perchance.org/APPROVE", rz));
  var ok = qr.verify(rz, await HOST.readChannel(rz.channel)); // throws CLOSED on anything wrong
</script>
```

Phone (already-enrolled device): open the scanned URL, confirm the
enrollment lives in its own store, write `qr.approval(nonce)` to the
channel. To refuse, write `qr.denial(nonce)`.

## the contract

- `client({ttlMs:120000, now, random})`.
- `rendezvous()` mints channel + nonce (128-bit-class randomness), 2-minute
  TTL default.
- `qrPayload(baseUrl, rz)` builds the approve URL (`#gate=<channel>&nonce=...`).
  Host draws it with its own encoder - this chip never touches pixels.
- `parseHash(location.hash)` reads a scanned code back.
- `approval(nonce)` / `denial(nonce)` build the phone-side records.
- `verify(rz, record)` passes only on live challenge + matching nonce +
  explicit ok. Every other outcome throws `GATE CLOSED :: ... NOTHING WAS
  OPENED.` The host burns the channel after (single-use is the host's job).
- Transport is the host's job (editable-file channel, socket, relay). The
  channel name is the secret: unguessable, short-lived, single-use.

## deliberately left out

- QR drawing/scanning, polling, session minting, Authority passes - the
  host gate owns all of those. No network, no storage, no DOM here.

## honesty note

Proximity-grade, WhatsApp-Web-grade: whoever scans the code can approve.
It proves a trusted device saw the screen, not which human holds it. It is
a convenience door beside the sigil, not above it.
