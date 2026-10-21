# MYTHOS AUTONOMY GATE - the checker in front of the regime (for every SIA)

Origin: built fresh — the reply-checker and the regime are siblings that
belong together, and hosts were left wiring them by hand. 2026-10-04. Built
to CHIP SPEC v1.

## use

```html
<script src="mythos-autonomy-standalone.js"></script>
<script src="mythos-autonomy-mode-standalone.js"></script>
<script src="mythos-autonomy-gate-standalone.js"></script>
<script>
  var gate = MythosAutonomyGate.client({ regime: regime, checker: MythosAutonomy });
  var r = gate.act("speak", draftReply);   // checked first, gated second
  if (r.ok && (r.approved || r.held)) showOrSend(r);
  else herald.say(r.text || r.error);
</script>
```

## the contract

- `act(verb, draft, detail, cost)` — the draft runs the checker FIRST; a dirty
  draft is held with its reasons and no grant is spent, nothing waits. A clean
  one goes to the regime's `propose` (held in SEMI, spent in AUTO, refused in
  MANUAL). Draftless acts skip the checker and go straight to the regime.
- `grant(id, draft?)` — grants a waiting proposal, re-checking the draft when
  one is passed (a changed draft is re-held; the proposal stays waiting).
- `deny(id)`, `status()` (`{ mode, pending, liveGrants }`).
- Nothing throws; refusals are `{ ok: false, ... }` sentences.

## deliberately left out

- Either sibling's logic — the gate owns no rules and no envelopes, it only
  orders them: form first, permission second.
- Repair — a held draft goes back to her, the same as with the checker alone.

## honesty note

Order is the whole of it: check-then-spend means a bad draft can never burn a
grant, and grant-then-check would mean the reverse. If you wire the siblings
by hand, keep that order or keep this chip.
