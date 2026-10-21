# COREPACK

Loadable traits for the actor: prompts and agentic directives that overlay and enhance whichever
RoleLayer LIA is wearing (see `src/roles/`). She is the actor; a role is the layer she is playing
right now; a trait is something she has taken into herself - it goes on over the role and stays with
her across roles until she puts it down. `corepack.json` is the manifest and the only file the app
reads; everything here is PUBLIC (it ships with the generator).

## Two ways a trait is used

| | how | lifetime |
|---|---|---|
| **worn** | `/load <id>` (or she writes `[[LOAD: id]]` in a reply) | permanent - part of every reply until `/unload <id>` / `/unload all` |
| **directive** | `/skill <id> [extra instruction]`, or she writes `[[SKILL: id]]` in a reply | one reply only |

Worn traits **stack**: they are layered in load order over the role she is wearing, and each one's prompt is
injected into her system prompt under a `LOADED TRAITS` heading. The stack is private to the browser
(kv `lia_settings` / `loaded_traits`) and survives reloads; the status bar and `/traits` show what
she is wearing. Because the stack lives in the system prompt, it stays part of the cacheable prefix
for as long as nothing is loaded or put down.

1. At boot the app reads `corepack.json` and puts the catalog into her system prompt, so she knows
   what she is trained to do. Already-worn traits are restored and injected above the catalog.
2. She engages a trait by ending a reply with `[[SKILL: id]]` (one reply) or `[[LOAD: id]]` /
   `[[UNLOAD: id]]` (a lasting change to herself). Those lines are stripped before her text is shown,
   and the change is reported to Patrikios in the log - she cannot alter herself silently.
3. Patrikios can do the same directly: `/load <id>`, `/unload <id|all>`, `/traits`, or
   `/skill <id> [extra instruction]` and `/skill off`.

## Skill schema

```json
{
  "id": "low-kebab-case-id",
  "title": "Human Name",
  "kind": "image",
  "description": "one line, shown to her and to you",
  "prompt": "the training she follows. Written as an instruction to her.",
  "tags": ["optional"]
}
```

- `kind`: `"image"` traits are expected to finish with a `[[VISION: ...]]` line so a real image
  renders; `"text"` traits only shape the reply. Wearing an `image` trait means an image on every
  reply - engage those with `/skill` unless that is what you want.
- `enabled: false` hides a trait from her catalog and from `/corepack` without deleting it.
- `id` must be unique; a directive resolves by id, then by title.
- Batch hints belong in the prompt: size/seed/guidance are chosen in the IMAGE FORGE, not here.

Adding a trait is just adding an object to the `skills` array - reload the page and it is live.

## Traits loaded from this device

**LOAD COREPACK** on the lorebar absorbs extra trait definitions from a `.json` file on your
machine, so you can try a trait without editing this folder. The file may be an array of skill
objects, `{"skills": […]}` / `{"traits": […]}`, or a single skill object; the same schema as above,
except that `id` may also come from `name`, `prompt` from `instruction`, and `description` from
`desc`. Only `id` and `prompt` are required - anything without both is skipped.

Local traits live in kv `lia_settings` / `local_traits` (this browser only, never uploaded) and are
merged into the catalog at boot. A local trait with a shipped trait's id **overrides** it, so you can
experiment on a copy without touching the shipped file. The COREPACK DOCS panel tags each row
`SHIPPED` or `ON THIS DEVICE`; `×` is enabled only for the local ones (forgetting a shipped trait
would be pointless - the manifest puts it back on the next load). Worn local traits behave exactly
like shipped ones.
