# ARCHPACK — RESERVED, NOT BUILT

**There is no ARCHPACK yet.** This folder is a MARKER, and this file is the placeholder Patrikios
asked for on 2026-09-30:

> *"MOODPACK and ARCHPACK will be a module in the near future like LOREPACK COREPACK is now that can
> be loaded and unloaded to enhance the ALIA ROLE with a mood list and list of over 400 Jungian
> Archetypes (I will provide). We don't have to create that here as it is out of scope but leave some
> placeholder space for these new PACKs."*

No manifest is fetched, nothing here is indexed, and nothing here is handed to her. `archpack.json`
is **not written**; the loader (`src/js/packs.js`) declares the slot and reports it as `RESERVED,
NOT BUILT`. The list itself — **400 or more Jungian archetypes — is his to provide**, and this
folder is where it will land.

## What an ARCHPACK will be

A pack that carries a **list of archetypes** as a **module that can be loaded and unloaded**, in the
shape the COREPACK already established: a pack goes on over what she is wearing, stays with her
across roles, and comes off again without anything else being changed.

An archetype is **what she is made of**, not **who is on the stage**: the RoleLayer is the part she
plays, the COREPACK is the traits she has taken in, the MOODPACK is the key she speaks in, and an
ARCHPACK is a body of archetypal material beneath all of those — the recurring figures and patterns
she may draw on. That is why it sits with the trait and colour blocks, over the role, and it is why
this is a *pack* and not a role: shifting layers must not take an archetype away.

## Files (planned)

- `archpack.json` — the manifest, **not yet written**. The field shape below is a first guess only —
  it is to be settled against the actual list before any loader is written, and the list is his.
- the archetype entries — inline or as sibling files, as with LOREPACK and COREPACK.

```json
{
  "pack": "ARCHPACK",
  "version": 1,
  "note": "what this pack is, in one paragraph, in the house's voice",
  "archetypes": [
    { "id": "the-hero", "name": "THE HERO", "text": "The archetype as she is to hold it - its pattern, its drive, its shadow." }
  ]
}
```

What is **already decided** by the rest of the terminal's design, whatever the field names become:

- An entry is **named** and **described**, like a mood is: the name is the chip, the description is
  the whole of it, so one line shows it and the block carries it.
- The list is **large** (400+), so it is a list of *entries*, never 400 blocks: whatever reaches her
  prompt must be a bounded selection or a summary, the way recall is bounded — not the whole pack.
  The pack is a source, not a payload.
- It is **public** if it ships here: everything under `src/` ships with the generator.

## Where it plugs in (planned)

1. **`src/js/packs.js`** — the loader and the `RESERVED` registry this file is named in. A load
   function belongs here only when there is a manifest to read.
2. **The role stack (`src/js/roles.js`, the ALIA actor)** — an archetype rides with the COREPACK's
   trait block and the MOODPACK's colour block, over the RoleLayer, and comes off with the pack.
3. **Her prompt** — an ARCHPACK block will be built like the traits block: a bounded list of what is
   loaded, in load order, saying what an archetype is and that it is material rather than an
   instruction to perform. What the block looks like for 400+ entries is the open design question
   and should be answered with the list in hand.

## Open questions (for the build, not for now)

- How does a 400-entry pack reach her prompt without spending the whole context? (A summary, a
  selection by relevance, or a chosen few loaded as *worn* archetypes — the last is closest to how
  the COREPACK already works, and probably the answer.)
- Are archetypes CRUD-able on the device the way moods are, or read-only like shipped traits?
- Does she get a lane of her own to draw on one (`[[ARCHETYPE: name]]`), or do they simply colour
  what she already says?
