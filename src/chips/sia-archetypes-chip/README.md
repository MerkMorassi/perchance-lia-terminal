# MYTHOS ARCHETYPES - 304 faces for casting personas and ROLES (for every SIA and LIA)

Origin: seeded from the scribe harvest's archetypes-v3.json (src/scribe/,
56 faces — Jungian core, Moore masculine, modern professional, A–Z) plus 248
new faces written for the pack across 15 domains, 2026-10-05. Built to CHIP
SPEC v1.

## use

```html
<script src="mythos-archetypes-standalone.js"></script>
<script>
  var arch = MythosArchetypes.client({});
  arch.count();                 // { archetypes: 304, domains: 15 }
  arch.domains();               // crown blade craft hearth wild spirit shadow trick love lore voyage veil coin stage psyche
  arch.byDomain("trick");       // every trickster on the shelf
  arch.search("sea");           // name/essence/shadow/domain match, cap 50
  arch.persona("crone");        // role-ready def for the roles chip
  arch.blend("sage", "jester"); // two faces fused into one def
</script>
```

No store, no network — pure casting data. `archetypes: [...]` merges extra
faces (same `{ id, name, domain, essence, shadow }` shape). `say(fn)` voices
house-dialect lines.

## the contract

- `list/get/domains/byDomain/search` — the shelf. `get` and `byDomain`
  refuse loud on unknown ids/domains; `search` refuses under two letters.
- `pick({ domain, exclude })` — a random draw, optionally from one domain,
  optionally dealing round exclusions. Empty pool refuses loud.
- `persona(id)` — one face as a ROLES-chip `createRole` def: id
  `arch-<face>`, title the name, subtitle `ARCHETYPE · <DOMAIN>`,
  description the essence with its shadow attached. Unknown faces refuse.
- `blend(a, b)` — two faces fused: hyphenated id, slashed name, combined
  domains, essences woven, shadows stacked. Tagged `BLEND` in the subtitle.
- `count/voice` — shelf census, house-dialect speaker.

## deliberately left out

- RoleLayer paint, mood boards, worn state — the roles chip owns the stage;
  this pack owns the casting shelf. `persona()`/`blend()` defs drop straight
  into its `createRole`.
- Persona persistence and per-device overrides — host-side; the pack is
  read-only plus the `archetypes` merge seam.
- The scribe's beat-sheet machinery (theme × structure) — different chip,
  different job.

## honesty note

A casting shelf, not a psychology: essences are one-line stage directions,
shadows one-line warnings, both written to be worn, not diagnosed. Face
provenance: 56 lifted (renamed only where ids collided — master-builder,
arbiter; one byte-identical detective dropped), 248 written fresh.
