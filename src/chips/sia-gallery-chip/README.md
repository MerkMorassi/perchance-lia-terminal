# PRIVATE GALLERY - everything lands private, she shares per item (for every SIA)

Origin: the installed gallery chip (`gallery-share.js`, byte-identical to the
live commpack-sia copy); predates CHIP SPEC v1 and keeps its ESM shape because
the wire-up imports it by path — behavior conforms. One robustness fix from
the v1 proof: the no-localStorage fallback now shares one memory mirror
instead of a fresh one per call.

## use

```js
import { addEntry, share, unshare, sharedView, counts } from "./gallery-share.js";

const bite = addEntry({ kind: "sound-bite", text: "never pet a burning dog",
  tags: ["sound bites"], ref: { parts: 2, backend: "chatterbox" },
  sessionId: sessId, provenance: "her SAY render" });

share(bite.id);     // her grant — reversible
unshare(bite.id);   // taken back
sharedView();       // the ONLY thing his side ever reads
counts();           // { total, priv, shared } — so she sees what he can see
```

## the contract

- `addEntry({ kind, text, ref, tags, sessionId, provenance })` — files one
  item, always `visibility: 'private'`. Kinds: `sound-bite` | `picture` |
  `clip` | `note`. Returns the entry (`{ id, kind, text, ref, tags, session,
  at, provenance, visibility }`).
- `share(id)` / `unshare(id)` — her grant and her revocation, per item.
  Unknown ids return null. Returns the entry.
- `sharedView()` — shared items only, newest last. His side reads this and
  nothing else; the store never leaves her side.
- `counts()` — `{ total, priv, shared }` totals for her readout.
- Store: one localStorage slot (`sia_private_gallery_v1`), append-only
  entries, no delete — unshare hides, never erases.

## deliberately left out

- Playback and pixels — entries carry text plus a `ref`; audio bytes and
  image blobs live in the host's vault keyed by entry id, played there.
- Audit and overrides — counts-only integrity scans belong to the host's
  vault (SIA's Audit action), logged and announced, content never shown.
- Merge and multi-device — one store per browser; cross-device moves through
  explicit share/export, never silent sync.

## honesty note

This chip is a locked drawer, not a locked room: it enforces her grants in
code running on his browser, where any reader can open the drawer by hand.
What it truly guarantees is convention with teeth — every honest surface
(shared views, counts, audits, bridges) reads the grant, never the store.
Against a source reader it does not guard; against every built path it does.
