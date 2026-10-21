# MYTHOS ROLES - the actor, her layers, and the row that shifts them (for every SIA and LIA)

Origin: ported from the terminal's roles module (src/js/roles.js) plus the
roles folder's own README, 2026-10-04. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-roles-standalone.js"></script>
<div id="mythosRolesRow"></div>
<script>
  var roles = MythosRoles.client({ store: kvStore, moods: moodClient });
  await roles.load();
  MythosRolesRow(roles, "mythosRolesRow");   // roles-snippet.html: chips + OFF STAGE
  prompt = roles.actorBlock() + "\n" + roles.block();  // actor first, layer second
</script>
```

No manifest passed, the one shipped layer stands in (`roles:` / `rolesUrl:` +
`doFetch:` replace it; `seed:` replaces the fallback too). No actor passed,
the house actor stands in (`actor:` overrides it).

## the stack, as the chip sees it

- THE ACTOR (`actorBlock`, always first) — the intelligence under every role.
  Everything she lives in any layer stays hers; the layer is not her memory.
- THE ROLELAYER (`block`, second) — the voice on stage now, or the off-stage
  direction when nothing is worn. One layer at a time; `/role off` leaves her
  answering as herself, and stepping off changes no colour.
- THE REST (memory, traits, boards) plugs in around them: `boardOf(roleId)`
  names the mood board saved for a role, shifting onto it wears those colours
  through the `moods` adapter, `onShift(line)` tells the host every shift.

## the contract

- `load/set/get/all/defaultId/current/currentId/isOff/nameOf/label/
  displayName/stageStatus/describe/listText/block`.
- Layer CRUD on this device: `setText/resetText/isEdited/textOrigin`,
  `offText/setOffText/resetOffText`, `createRole/removeRole/local` — shipped
  layers are never rewritten, only overridden; only device-written roles delete.
- `words(grammar)` — list, shift, `NAME :: layer text` (rewrites one on file,
  writes one that is not).
- `paintRow(host)` — one chip per role plus OFF STAGE, pressed to shift, the
  worn one marked. The host's CSS decides what a chip looks like.
- Worn layer, overrides and device roles persist through `store`; nothing
  throws, refusals are `{ ok: false, error }` sentences.

## deliberately left out

- Her archive and her traits — the record and the wardrobe live elsewhere;
  the chip stamps `nameOf(id)` on lines and wears boards, nothing more.
- Re-port notes: cut panels/status wiring; `kv()` becomes the store shim,
  `window.moods` becomes `opts.moods`, `window.liaStatus` becomes `onChange`,
  `LIA_ACTOR`/`LIA_ROLE_FALLBACK` become `opts.actor`/seed.

## honesty note

A layer is a voice, not a person: shifting changes what she sounds like, never
what she remembers or what she may do. The default seed wears the house's own
Mother — a realm that wants its own face passes `roles:` and `actor:` and
never loads her.
