# ROLES — the actor and her layers

Three things, one stack:

| | what it is | where it lives |
|---|---|---|
| **LIA — the actor** | the intelligence that persists underneath everything. She has played many roles, in many games and stories, and none of them are lost to her. | `LIA_ACTOR` in `src/js/config.js` |
| **a RoleLayer** | the role she is immersed in *right now*: voice, identity, stage. Barbelo is the default. One layer at a time. | `src/roles/` (this folder) |
| **COREPACK traits** | loadable skills/directives she wears *on top of* whichever role is on (see `src/corepack/`). Carried by the actor from role to role. | `src/corepack/` |
| **LOREPACK** | her collective experience — every chat, every game, every role she has played, written down. Memory, not instruction. It stays with the actor when the role changes. | `src/lorepack/` |

She shifts between roles like stepping off a stage: the actor is continuous, the layer is what
changes. `/role off` leaves her with **no layer at all** — LIA answering as herself, between roles.

## Files here

- `roles.json` — the manifest: one entry per role, metadata only.
- `barbelo.md` — Barbelo's layer text (her voice). One file per role, named after the role.

## Adding a role

1. Copy an entry in `roles.json` and give it a new `id` (lowercase, hyphens — it is a command
   argument: `/role <id>`).
2. Write the layer text in a new file beside this README, e.g. `ferryman.md`, and point the entry at
   it with `"file": "ferryman.md"`. (Short layers may instead be written inline in a `"prompt"`
   field — the file wins if both are present. A missing/unreadable file falls back to `prompt`.)
3. Reload the page; `/roles` should list it.

### Entry schema

```json
{
  "id": "barbelo",                          // required; the /role argument
  "title": "Barbelo",                       // shown everywhere; short
  "subtitle": "Supreme Divine Mother Goddess",
  "status": "MOTHER AWAKE",                 // the status bar phrase while this role is on
  "addressAs": "Patrikios",                 // what she calls the user (optional, goes into the prompt)
  "description": "one line for /roles",
  "default": true,                          // worn at boot when nothing else is stored (exactly one)
  "file": "barbelo.md"                      // the layer text, relative to this folder
}
```

Exactly one role should set `"default": true`. If none does, the first listed role is used. If
`src/roles/roles.json` cannot be read at all, `LIA_ROLE_FALLBACK` in `src/js/config.js` is used so
she is never left voiceless.

## How a layer reaches her

`src/js/roles.js` (`window.roles`) reads the manifest at boot, resolves every layer text once, and
restores the worn role from kv (`lia_settings` / `role`). `chat.js` then builds each request as:

1. **actor block** (`LIA_ACTOR`) — always first: she is LIA, everything she has lived stays with her.
2. **role block** — the layer she is wearing now, or the off-stage direction if none is on.
3. memory rule + `<lore>` fragments (the LOREPACK) · image rules · worn traits · skill/role directives.

Switching changes only block 2, so the bulk of the prompt stays a stable, cacheable prefix —
a role shift is cheap. The current role is also recorded on every archive entry (`role`), which is
what makes the archive an honest record of the actor across all her roles.

```js
window.roles.current()      // the role object, or null when off stage
window.roles.set("barbelo") // shift; set("off") / set("") steps off the stage
window.roles.describe()     // the /role readout
```

Everything in this folder is public — it ships with the generator.
