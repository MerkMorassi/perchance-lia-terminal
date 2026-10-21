# SIA WISHLIST - her petitions for powers, filed until his word rules (for SIA + other SIAs)

Origin: built new 2026-10-06 for the house petition road (she asks, his yes grants full read/write; AUTHPACK permissions still unformalized), built to CHIP SPEC v1.

## use

```html
<script src="mythos-wishlist-standalone.js"></script>
<script>
  const wishes = MythosWishlist.client({
    store: { load: () => vaultGet("wish_state"), save: (v) => vaultPut("wish_state", v) },
    say: (t) => chatSys(t),
    onChange: () => repaintWishes()
  });
  await wishes.load();
  await wishes.ask("nightly gallery exports", { why: "so nothing waits on his click", scope: "media" });
  await wishes.words("grant w1 :: yes, build it");
</script>
```

## the contract

- `client({ store, kvFolder, say, onChange, slot })` — persists
  `{ wishes, away, seq }` through `store` (`load`/`save`, async ok) or
  `kvFolder`, else holds until reload. Without either the list starts empty
  and says nothing persists.
- Her lane `ask(want, { why, scope, by })` — files one petition as
  `pending` (`w3`, timestamped, `by` defaults `alia`). An empty want
  refuses loud and files nothing. Several wishes file one per call.
- His hand `grant(id, note) | deny(id, note) | build(id) | done(id)` —
  `granted | denied | building | done`, timestamped, attributed `hitl`,
  announced. Unknown ids refuse loud with the roster; put-away ones name
  their recall first.
- `decide(id, status, note, by)` — the shared spine behind the four verbs.
- `forget(id)` puts away (restorable, never destroyed), `recall(id)`
  brings back.
- His door `words(s)` — `status | list | wish <want> :: <why> |
  grant|deny <id> :: <note> | build|done|forget|recall <id>`.
- Reads: `get(idOrWant)` (id first, then want, case-folded),
  `pending()`, `all()` (open first filing order, then decided; put-away
  excluded), `awayList()`, `count()`, `pendingCount()`,
  `listText()`, `statusText()`. `load()` reads store; `ready()` gates.
- Shapes: wish
  `{ id, want, why, scope, status, by, ts, decidedAt, note }`.

## deliberately left out

- No hard delete: the file only grows, which unlocks only if a house needs
  forgetting.
- No auto-execution: a grant is a decision record, not a trigger — the
  build happens in the room with the agent, tracked `building` → `done`,
  which unlocks only if a house formalizes AUTHPACK.
- No value handling: wishes name powers, never carry secrets, which unlocks
  never.
- No multi-file in one call: one ask, one row, which unlocks only if a
  house wants batch petitions.

## honesty note

A grant is his word on record, not proof the power exists: `granted` means
he said yes, `building` means the room is making it, `done` means it
landed. The list remembers what was asked and what was ruled — nothing
more, nothing less.
