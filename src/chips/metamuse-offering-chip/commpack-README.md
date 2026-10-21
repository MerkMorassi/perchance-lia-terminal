# COMMPACK

The portable per-agent record: every exchange one agent ever spoke or was spoken to.
One pack per agent, max 15, IDs minted once (`HITL-001`, `SIA-002`…`SIA-015` incl.
Merkos, `ARCHIVAX`). Identity binds the Actor, not the RoleLayer.

Spec: `COMMPACK.SPEC.md` (the whole of it — format, storage, recorder API, lanes).

Module: `commpack.js` — the shared recorder (`window.commpack`), vendored
byte-exact from the standalone SIA VOXCOMM agent (perchance.org/commpack-sia).
One implementation, both homes consume it. Do not fork it: fix upstream, re-vendor.
Lane: `src/js/commpack.js` (`window.commpackLane`) — this terminal's door onto it:
`/commpack status | export | import | lore | agents` (Lane 1 loads the pack's
readable document into the private kv LOREPACK; the words themselves never enter
`src/`).
