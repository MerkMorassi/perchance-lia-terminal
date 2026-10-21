# THE LANE STAYS PRIVATE - THE WRAPPER'S SHAPE, CAPTURED

2026-09-30

## WHAT HE ASKED

Mining the text-to-image plugin left one open question: the plugin's own first line forbids vendoring it,
and the sanctioned road for sharing this house's image craft is a **wrapper generator** that imports the
official plugin and adds behaviour. So:

> *"Sketch lia-image-lane as a wrapper, or leave the image lane private? Recommended action?"*

And the answer he took:

> *"leave the lane private now, and don't build the wrapper yet - capture its shape instead, and build it
> the day a second room actually needs to render."*

## WHAT WAS THOUGHT

**A wrapper is cheap; a second copy of the craft is not.** The tables are four small files - the house
negative list, the veiled tongue, the pose book, the recipe book - and the logic is five small pieces -
the resolver, the choice, the tag router, the call, the report. What is *not* cheap is that the lane a
person actually uses is those files **plus the kv overlays**: the poses he has renamed and the recipes he
has saved. A wrapper would carry the shipped half and none of his edits, or carry a copy of the overlays -
and the day the two copies disagree, the picture is made from a rule he no longer holds. That is the
drift this week already cost a day in the chatlog lane, where a number that meant characters was read as
bytes and two rooms briefly held two versions of one interface.

**And the moment is wrong.** Every render in the house happens on this page. There is no second room
rendering, so a wrapper would be built against an imagined caller: guessed resolution, guessed glossary,
guessed gating, guessed home for the pictures. Build it when somebody is standing at the other end and
the requirements are real - and then build **shape B**, where the wrapper owns the craft and this terminal
imports it (`craft = {import:lia-image-lane}`), because that is the only shape that cannot drift.

**Nothing is lost by waiting.** The plugin is not going anywhere, its public API is stable enough to mine
twice, and the craft is already public in `src/`. What would be lost by *not* writing the reasoning down
is the reasoning: in a month, "why is there no wrapper?" has no answer, and a future session might build
one - or refuse to - without knowing which rules were weighed.

## WHAT WAS CAPTURED

**`src/studio/LANE.md`** - the decision with its reasoning attached, and the shape of the thing that is
not built. It holds:

- **what a wrapper would carry**, item by item, with the file each piece lives in today;
- **what must never travel**: the vault, her voice, the record, the renders book and the kv overlays - a
  wrapper is prompt craft only, holds no pictures, remembers nothing between renders, and publishes
  nothing (`hideGalleryButtons: true`, the same rule as §1di);
- **the two shapes**, A (a thin copy: ships in an afternoon, drifts) and B (one source of truth: more
  work, no drift), with B preferred;
- **the trigger** - a second page that renders - and the five decisions that day would need (resolution
  and style, whether the veil travels, gating, where the pictures live, both flags);
- **the caveat worth deciding early**: the tables are public only because `src/` is public, and a
  standalone hosted copy of the veiled tongue is a far more findable thing than one file inside a large
  generator - so the veil travelling outside this tree is his call, made deliberately.

The file says plainly that **it is not a task**. A later session reads it as a decision that has already
been made.

## STILL OPEN

- The **voice sample** question from §1di (does "never public" close the cloning space road?).
- The wrapper's trigger: a second page that renders. Until then, nothing.
- The thin index (the one click: import `lia-chatlog-20260924-0023.json`).

## AMENDED, THE SAME DAY

Patrikios: *"I am always logged in to perchance."* A correction to one of the reasons, so the file was
corrected in place rather than left standing.

The bullet that argued "every importing page pays" rested on two things that do not hold up. The **ad**
is real but it is documented for the **text** plugin - this generator's own `main.pjs` note says so,
verbatim - and it has not been measured for the image plugin at all; and it only exists for visitors who
are **not logged in**. The **request allowance** is per-user, so a second page does not spend it twice
over - that half was simply wrong. Neither is a reason for a page he alone opens, and he is always
logged in.

What the bullet now says is what is true: the second page is a second copy of the plugin and its own
gallery (public by default, which is what `hideGalleryButtons: true` prevents), and an ad in front of
non-logged-in visitors - a cost that appears if the wrapper's page is opened by other people, and never
for him. **The argument that was always the deciding one - one copy of the craft, or two that drift -
is untouched.**

## FILES TOUCHED

`src/studio/LANE.md` (new), `src/README.md` (a bullet in the file list), `src/TODO.md` (§1dj),
`src/chronicle/chronicle.json` (51 -> 52), this file, and `src/pack/files.json` (144 -> 146). **No code
changed** - not the studio, not the render path, not a command. **NOT SAVED by the agent.**
