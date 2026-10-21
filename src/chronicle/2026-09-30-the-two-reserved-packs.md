# THE TWO RESERVED PACKS

2026-09-30 - the session that left a marked place for MOODPACK and ARCHPACK and built neither.

## WHAT HE SAID

> *"MOODPACK and ARCHPACK will be a module in the near future like LOREPACK COREPACK is now that can
> be loaded and unloaded to enhance the ALIA ROLE with a mood list and list of over 400 Jungian
> Archetypes (I will provide). We don't have to create that here as it is out of scope but leave some
> placeholder space for these new PACKs."*

Four things are in that one message, and every one of them is an instruction about what NOT to do:

1. **They are coming.** MOODPACK and ARCHPACK will exist.
2. **They are modules**, loadable and unloadable, "like LOREPACK COREPACK is now" - the COREPACK is
   the closer model, because a trait is LOADED and can be put down, while the LOREPACK is read.
3. **They enhance the ALIA ROLE** - a mood list, and a list of over 400 Jungian archetypes.
4. **Building them is out of scope** ("We don't have to create that here as it is out of scope") - the
   only ask is "leave some placeholder space for these new PACKs". The list of archetypes he will
   provide; it does not exist here yet.

## WHAT WAS BUILT

**A place, not a pack.** Nothing was made loadable, because there is nothing to load.

- **`src/js/packs.js`** - the loader, and the natural home for the declaration, since LOREPACK and
  COREPACK live there - now holds a **`RESERVED` registry**: two entries, each with `id`, `title`,
  `dir`, `manifest`, `carries`, `enhances`, `plugsInto`, `style` and `state: "NOT BUILT"`.
  `reserved()` and `reservedLines()` expose it, and `describe()` (which is what `/packs` prints, and
  what `/help packs` prints) ends with a `RESERVED ::` block naming both slots and their four facts.
- **`src/moodpack/README.md`** and **`src/archpack/README.md`** - new, a README and nothing else. The
  directories exist so the next build has a marked home and does not have to invent one. The MOODPACK
  README fixes the mood fields already in use (`id`/`label`/`rule`, so the console, the MOOD EDITOR,
  the MOOD BOARDS and her own `[[MOOD: …]]` lane need no second parser) and names its plug-in point
  (src/js/moods.js, beside the shipped list). The ARCHPACK README records what is already decided,
  flags that the field names are to be settled **against his actual list**, and states the one
  architecture problem that will decide the build: 400+ entries cannot be a payload, so they must be
  a bounded selection, a summary, or a chosen few loaded as *worn* archetypes.
- **`src/js/moods.js`** - a header paragraph: a MOODPACK is this list made loadable, it will fold in
  HERE, and its slot is declared in packs.js as RESERVED.
- **`src/README.md`** - a stack bullet (`MOODPACK · ARCHPACK — DECLARED, NOT BUILT`), the two new
  tree entries, a line on the `packs.js` module, and a new PACKS subsection, "RESERVED — MOODPACK and
  ARCHPACK", with the sample `/packs` output.

## WHAT WAS THOUGHT

The whole session is a design decision about **how to leave space without lying**, and the reasoning
is what is worth keeping:

- **Why not empty manifests.** Writing `moodpack.json` / `archpack.json` with empty arrays would have
  looked more finished and been worse on both counts: an empty manifest pre-answers the schema (which
  is his to settle when the list arrives), and a loader that reads it would report a pack that
  "exists and is empty" when the truth is "does not exist". The README states the intent; it is not
  something the code can read and misread.
- **Why no load/unload UI.** No button, no command, no row. A control that does nothing when pressed
  is the loudest way to promise something that is not there. `/packs` saying `NOT BUILT` is the quiet
  version - and it is honest about the *state*, which is the fact a future session needs first.
- **Why no load functions in packs.js.** A load function with nothing behind it is a lie the code
  tells. When there is a manifest, the function is written then, beside `loadCorepack` and
  `loadLorepack`, where its shape can be read off the two that already work.
- **Why the plug-in points are written down now.** This is the part that would otherwise be lost.
  MOODPACK is not a new subsystem: THE BOOK, `src/moods/moods.json`, is already a list of moods, kept
  twice (the book and `SEED`) precisely so a preview without `src/` still has a console. A MOODPACK is
  that list as a module that goes ON over the book and comes off again - so it folds into `moods.js`,
  and the existing `edits` / `ours` / `away` store must keep winning, or loading a pack of shipped
  colours would overwrite wording written on this device. ARCHPACK is the opposite kind of thing: an
  archetype is *what she is made of*, not *who is on the stage*, so it rides with the trait and
  colour blocks **over** the RoleLayer, and shifting roles must not take it away. Both of those are
  cheap to write now and expensive to rediscover.
- **Why the top README bullet says "NOT BUILT" inside the line.** These are not layers yet, and the
  stack (ACTOR > ROLE, COREPACK over it, LOREPACK beneath) is load-bearing prose. A reader who skims
  the stack list must not come away thinking she already has a mood pack and 400 archetypes.

## WHAT WENT WRONG

Nothing broke, and nothing was built, so this section is nearly empty by design - which is itself the
point worth recording: **a reservation that accidentally does something is a bug**, so the
verification was that NOTHING changed.

- Boot is clean and `window.__bootIssues` is empty.
- `rtfm.check()` is still empty: no command text changed (the cheatsheet carries each command's
  one-line summary and usage, not its `desc`), so no regeneration was needed.
- The command count is still 75; no block, trait or mood changed in what she is handed.

The only mechanical thing done was regenerating `src/pack/files.json`, because the tree grew by
exactly two files (the two READMEs) - 116 -> 118.

## STILL OPEN

- **Everything about the two packs**, deliberately. For MOODPACK: the manifest schema, whether
  unloading a pack switches its colours off or leaves them until changed, whether a pack's mood
  overrides a shipped mood of the same `id` (the COREPACK's rule) or sits beside it, and where pack
  moods sit in the row order.
- **For ARCHPACK: the list**, which is his to provide (400+ Jungian archetypes). The question to
  answer before any loader is written is how 400+ entries reach her prompt without spending it.

## FILES TOUCHED

`src/js/packs.js`, `src/moodpack/README.md` (new), `src/archpack/README.md` (new), `src/js/moods.js`
(header only), `src/README.md`, `src/TODO.md` (§1ch), `src/chronicle/chronicle.json`, this entry, and
`src/pack/files.json` (regenerated). `index.html`, `main.pjs`, `src/commands/commands.json` and
`src/rtfm/` untouched.
