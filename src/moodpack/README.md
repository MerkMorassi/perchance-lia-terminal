# MOODPACK — BUILT (2026-10-01 loader, 2026-10-13 page)

**The pack is real.** The loader is `src/js/packs.js` (shipped manifest + local file, layered over the book) and the console is `src/js/moods.js` (pack colors folded beside the book, badged as pack colors). The manifest below is the shipped half - empty on purpose, so the book stays the whole console until a pack is loaded. The page is `src/js/moodpack.js` over the `moodpackPanel` in `index.html`: every pack color with its rule, NEW / EDIT / FORGET rows, LOAD from a file, SAVE back to `moodpack.json`, UNLOAD, STATUS - full-page like the CREATE/SYSTEM/MOOD/SHELF pages, with `/moodpackpage` and `/moodpack save` saying it in words.

> *"MOODPACK and ARCHPACK will be a module in the near future like LOREPACK COREPACK is now that can
> be loaded and unloaded to enhance the ALIA ROLE with a mood list and list of over 400 Jungian
> Archetypes (I will provide). We don't have to create that here as it is out of scope but leave some
> placeholder space for these new PACKs."*

No manifest is fetched, nothing here is indexed, and nothing here is handed to her. `moodpack.json`
is **not written**; the shipped pack stays empty on purpose, and the local pack lives in kv
(`moodpack_local`) until SAVE writes it out to a file.

## What a MOODPACK will be

A pack that carries a **mood list** — the colors she answers in — as a **module that can be loaded
and unloaded**, exactly the way the COREPACK carries traits today. The shipped moods are already a
file (THE BOOK, `src/moods/moods.json`) and already a console of switches, so a MOODPACK is not a new
idea: it is that same list in a form that goes on **over** the shipped book and can be taken off
again, without the book ever being written to. That is the difference from today —

| | today (THE BOOK) | a MOODPACK |
| --- | --- | --- |
| where the list lives | `src/moods/moods.json`, shipped | a file you load from your machine (then, if wanted, shipped here) |
| how it is read | fetched at boot, kept as `SEED` as a fallback | fetched when the pack is LOADED, marked as coming from the pack |
| how it goes away | it cannot — take the entry out of the book | UNLOAD, or forget the local pack; the book is untouched |
| what it may carry | moods | moods, and a pack header saying what the pack is |

It will still be a *color*, not a role and not a trait: who is on the stage is the RoleLayer, what
she is made of is the COREPACK, and a mood says what **key she is speaking in**. A pack cannot change
that rule — the MOOD block in `src/js/instr.js` says it out loud on every turn — and neither can it
put a color above her voice, her memory or the limits she holds.

## Files

- `moodpack.json` — the shipped manifest, empty on purpose (see above).
- the moods themselves — either inline in the manifest or as sibling files, exactly as the LOREPACK
  and COREPACK do it. A file you SAVE from the page is this same shape, with the local pack's moods.

```json
{
  "pack": "MOODPACK",
  "version": 1,
  "note": "what this pack is, in one paragraph, in the house's voice",
  "moods": [
    { "id": "a-stable-lowercase-id", "label": "THE CHIP", "rule": "How she is to sound - second person, about the KEY and never about a subject." }
  ]
}
```

The fields are deliberately the same three THE BOOK and the device store already use
(`id`/`label`/`rule`): one shape everywhere means the console, the MOOD EDITOR, the MOOD BOARDS and
her own `[[MOOD: …]]` lane need no second parser.

## Where it plugs in

1. **`src/js/moods.js`** — the console already reads a SHIPPED list and keeps it as `SEED`; a
   MOODPACK folds in beside it, marked as coming from the pack, and unloads without touching either.
   Its own CRUD (`edits`, `ours`, `away`) stays as it is: loading a pack of shipped colors must not
   overwrite a wording written on this device.
2. **`src/js/packs.js`** — the loader: shipped manifest + local file + kv, `moodpackNew` / edit /
   forget / unload / export, and the `/moodpack` words (hers too, via `[[MOODPACK: …]]`).
3. **`src/js/moodpack.js` + the `moodpackPanel`** — the page: the pack colors with their rules
   (EDIT and × on every row), NEW PACK COLOR, ADD A CONSOLE COLOR (files any console color into the pack with the wording in force - `/moodpack file <NAME>` says the same), the EDIT row (picker, SAVE, FORGET, CANCEL),
   LOAD / SAVE / UNLOAD / STATUS, receipts on its own status line. Full-page (`moodpackFull`),
   cross-closed with CREATE/SYSTEM/MOOD/SHELF; `/moodpackpage` opens it. American COLOR spelling throughout the pack's surfaces.
4. **The rows** — the SYSTEM panel's MOOD row, the PENCIL's row, `/mood list`, and the block built
   into her prompt. Loading a pack should make its colors appear there as switches, and unloading
   should take them off the console again — without deleting a mood a MOOD BOARD names (an unloaded
   color in a board reads the same way a PUT-AWAY one does).

## Open questions (for the build, not for now)

- Does unloading a MOODPACK also switch off the colors it brought, or leave them on until changed?
  The COREPACK's answer is that unloading a worn trait ends its effect, so the same rule probably
  holds — but a mood is lighter than a trait and the console is order-sensitive, so decide it with
  his eye on it.
- Does a pack's mood override a shipped mood of the same `id` (COREPACK's rule), or sit beside it?
- Where do MOODPACK moods sit in the order — before or after the shipped ones on the row?
