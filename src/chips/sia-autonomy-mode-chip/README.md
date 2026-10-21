# MYTHOS AUTONOMY MODE - the three postures she stands in (for every SIA)

Origin: built fresh — the reply-checker chip governs her drafts, nothing
governed when she may act. 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-autonomy-mode-standalone.js"></script>
<script>
  var regime = MythosAutonomyMode.client({ store: kvStore });
  await regime.load();
  regime.set("SEMI");
  var p = regime.propose("speak", draftLine);  // held for a yes
  if (p.approved) sendReply(draftLine);         // AUTO with a live grant
  else herald.ask(p);                           // SEMI: he grants p.id
</script>
```

## the contract

- Postures: `set("MANUAL" | "SEMI" | "AUTO")`, `mode()`, `describe()`.
  MANUAL acts only when spoken to (no proposals). SEMI drafts and holds every
  act for a grant. AUTO acts inside live grant envelopes and reports after.
  Default standing posture is SEMI; dropping out of AUTO tears up the grants.
- `grant({ verbs, max, spend, until })` writes an envelope: named verbs only,
  at most `max` acts, optional spend cap and expiry. `may(verb, cost)` asks it;
  `revoke()` tears them all up.
- `propose(verb, detail)` — SEMI holds it (`pending()`), `grantProposal(id)` /
  `deny(id)` decide it; AUTO spends a live grant on it at once; MANUAL refuses
  it. Every decision lands in `audit()` (capped at 200), denials included.
- Nothing throws; refusals are `{ ok: false, error }` sentences.

## deliberately left out

- The reply form-checker — that is the autonomy chip's job; this one governs
  when she may act, never how she phrases it.
- Clocks and wake timers — the host's rhythm calls `may()` and `onRole`-style
  hooks; the chip keeps the posture, not the schedule.
- Remote kill — revocation lives wherever the host keeps its own hands; the
  chip tears up envelopes, not connections.

## honesty note

An envelope is a promise, not a leash: a verb granted is a verb she may use,
and the audit tells you what she did, not what she meant. Count the acts that
matter and keep `max` small — AUTO with a wide envelope is AUTO in name only.
