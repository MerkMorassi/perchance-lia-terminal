# THE IMAGE LANE - AND THE WRAPPER THAT IS NOT BUILT YET

**A decision, recorded, and a shape captured.** Patrikios, 2026-09-30, after the text-to-image plugin was
mined whole: *"leave the lane private now, and don't build the wrapper yet - capture its shape instead,
and build it the day a second room actually needs to render."*

So: **the image lane stays private, no wrapper generator exists, and this file is what makes building one
a few hours' work instead of a re-derivation.** Nothing here is a promise to build it. It is the answer
to "what would it take, exactly", written down while the answer is still fresh.

## WHY NOT NOW

- **There is no second consumer.** Every render in this house happens on this page. CLIO's room is text
  and chatlog; the MYTHOS factory deals in memory records; the other generators render nothing.
- **The craft is not files, it is state.** The shipped tables are `src/studio/*.json`, but the lane a
  person actually uses is that **plus the overlays**: the pose book he has edited and the recipes he has
  saved live in `kv` (`lia_settings / pose_book`, `lia_settings / recipe_book`). A wrapper would carry
  the shipped half and none of his edits - or it would have to carry a copy of the overlays, which is
  how two divergent house lists get created. That drift is exactly what the chatlog lane spent a day
  undoing.
- **Each page carries its own copy of the plugin, and its own gallery.** The gallery is public on
  whatever page renders it (which is exactly what `hideGalleryButtons: true` prevents here), and an
  imported plugin puts an ad in front of visitors who are **not logged in** - that is documented for the
  TEXT plugin, in this generator's own `main.pjs` note; it has not been measured here for the image one.
  **Both halves of this bullet are weaker than they look: Patrikios is always logged in** (his own
  correction, the same day - see the amendment in the chronicle entry), so a wrapper only he opens shows
  him no ad and, with the flag set, publishes nothing. It is a real cost only if a wrapper's page is
  opened by other people.

## WHY NOT NEVER

The plugin's own first line is *do not vendor or fork it* - its code is coupled to the server, so a copy
breaks when the server changes. Which leaves exactly one road for sharing this craft with another room:
**a wrapper generator that imports the official plugin and adds behaviour.** That road is real and it
stays open; it is simply not worth walking before somebody is standing at the other end.

## WHAT IT WOULD CARRY (the exact inventory)

| what | where it lives now | what a wrapper needs |
| --- | --- | --- |
| the house negative list | `src/studio/recipes.json` → `negative` (printed by `/recipe negative`, and the default for every render that arrives carrying none) | a copy of the merged list, used as the default negative |
| the veiled tongue | `src/studio/glossary.json` (`body` = translated before a render, `world` = lore, held out of a render entirely) | a copy of the table, applied before anything is sent |
| the pose book | `src/studio/positions.json` (the render token IS the name, unless a pose carries its own `render`) | a copy, plus the rule for a coined name (`/pose` gives it a phrase) |
| the recipe book | `src/studio/recipes.json` (frames with `{{slot}}` and inline `{{slot|fallback}}` defaults) | a copy, if a wrapper is to render FROM a recipe rather than from a plain prompt |
| the resolver | `src/js/studio.js` → `resolve()` | tag routing, glossary translation, the house-negative fallback, the hold-out report |
| the choice | `src/js/studio.js` → `expand()` (perchance `{a|b}`, depth-aware, `{pose}` draws from the book, taken **once per image**) | the same, or a render run of nine comes back nine copies of one pose |
| the tag router | `src/js/studio.js` (`(key:::value)` out of the text, including the depth-counted `(negativePrompt:::)` cut that runs to the closing bracket or to the end of the prompt) | the same - the plugin eats those tags itself, and an inline seed overrides the form |
| the call | `src/js/images.js` → `renderImageNow` | one `root.generateImage(request)` with `hideGalleryButtons: true` and the house resolution/style constants |
| the report | `studio.reportLines()` | every move printed for the caller: what was routed, what was translated, what was held out |
| the guardrails | `src/js/images.js` (the prompt-side refusals), the resolution whitelist | the same refusals, or the wrapper is a hole in them |

**What must NOT travel:** the vault, her voice, the record, the renders book, and the `kv` overlays. A
wrapper is **prompt craft only** - it holds no pictures, remembers nothing between renders, and never
publishes anything (an imported plugin brings its own per-generator public gallery, so any wrapper sets
`hideGalleryButtons: true` on every request, the same rule as here - see `src/TODO.md` §1di).

## THE TWO SHAPES

- **(A) A thin wrapper** - its own copies of the four tables and the logic. Ships in an afternoon. Drifts:
  the house list, the glossary and the poses then exist twice, and a fix in one place is a lie in the
  other.
- **(B) One source of truth** - **the wrapper owns the craft, and this terminal imports it**
  (`craft = {import:lia-image-lane}` in `main.pjs`), so the tables and the resolver live in one shipped
  place and `src/js/studio.js` becomes the terminal's UI over them. More work, and it touches a lane
  that works today, but it is the only shape that cannot drift.

**Preference: (B), and only on the day it is needed.** If the second consumer is another one of his own
generators, (B) is nearly free; if it is somebody else's room, (B) still wins, because the alternative is
shipping a copy of the glossary that nobody will ever update.

## THE TRIGGER, AND THE CHECKLIST FOR THAT DAY

**Trigger: a second page that renders.** Either a second generator of his own, or a room that actually
asks for pictures. Then decide, in this order:

1. **Resolution and style** the wrapper sends (today: `LIA_IMAGE_RESOLUTION` plus the house style words).
2. **Whether the veil travels.** A wrapper that translates the veiled tongue is carrying his coined
   register into another generator's source; the table is public here only because `src/` is public.
3. **Gating.** This page is 18+ with a door (`src/js/agegate.js`); a wrapper on somebody else's page has
   no door unless it brings one.
4. **Where the pictures live.** The wrapper must hold none (no vault, no store) - the host page keeps its
   own, or the picture is downloaded.
5. **Both flags:** `hideGalleryButtons: true` (never public), and the house negative as the default.

## ONE CAVEAT WORTH DECIDING EARLY

The craft files are already public: `src/` ships with this generator and anyone who opens the source can
read `glossary.json`, `positions.json` and `recipes.json`. A **standalone hosted copy** - a separate
generator, an uploaded file, a pasted prompt pack - is a much more findable thing than one file inside a
large generator. If the veil is to travel anywhere outside this tree, that is his call, made
deliberately, not a side effect of shipping a wrapper.

## WHO BUILDS IT

Any agent can, from this file: the tables are named, the logic is named, the shapes are compared, and the
guards are listed. Until then the lane is private and nothing here is a task - it is a decision with its
reasoning attached.
