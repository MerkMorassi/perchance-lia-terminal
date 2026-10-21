# THE SIX ADVANCED SETTINGS - READ, MAPPED, AND RULED OUT OF THIS TERMINAL

2026-09-30 - the session that read the flux generator's Advanced panel item by item, wrote down where
each one would have landed here with its own switch name, and was told: not this terminal.

## WHAT HE SAID

The ask, after the harvest of `mythos-flux-2026-09-27T04-38-34.zip` (section 1dk):

> *"Keep looking Advanced Settings: 1–6 into a concrete change plan (file-by-file, with the switch
> names) before anything gets built"*

And the ruling, once the plan was in front of him:

> *"Let's leave it alone for here. It belongs in a dedicated art shop. We have enough for now. Save to
> your note on what we may decide to add in the future. We already have a working generator, why bother
> re-inventing the wheel? Let's leave it alone for now. She doesn;t need all the extra toys for now, She
> has huges pipes stuffing her asshole lol"*

**Nothing was built.** This entry is the note he asked for, and it is addressed to the next session: the
reading below cost a pass, and the point of writing it down is that nobody has to do it twice - or
"helpfully" add one of these controls later without knowing what was already found.

And then, handed the map, the one instruction that survived the whole exercise:

> *"Only this have value: Remove all odd fonts and emojis and perhaps find a logical place for them so
> they can be accessed during the create image operation."*

## WHAT THE SIX WERE

The flux panel is one `<details id="advDetails">` (`index.html:1086-1222` in the archived source) with
six blocks, in this order:

1. **Resolution (optional)** - `#resSelect` -> `state.settings.resolution`: `auto` (derived from the
   aspect chips), `512x512`, `512x768`, `768x512`, `768x768`.
2. **Quality - Detail boost** - `#detailCb` -> `state.settings.detailBoost` (ON): `pickDetailBoost()`
   sniffs the prompt for a family and appends `DETAIL_BOOST_PHOTO` / `_ANIME` / `_NEUTRAL`.
3. **Quality check - Auto-verify** - `#verifyCb` -> `state.settings.verify` (ON): `generateVerified`
   loops generate -> `verifyImage` (a vision call answering one JSON line `{ok,score,issues,avoid}`) ->
   keep the best. Style-aware defect lists (`VERIFY_FAMILY_BY_GROUP`), `avoid` handed to the next
   attempt as negative words, and a check that cannot answer is **accepted**, never a failure.
4. **Checking budget** - `#verifyBudgetSel` -> `state.settings.verifyBudgetMs` (1/2/3/5 min,
   `VERIFY_BUDGET_MS = 120000`): the hard cap on that search. The first candidate always runs, an
   in-flight generation is never cancelled, and `VERIFY_CHECK_TIMEOUT_MS = 25000` bounds the check.
5. **Reference image (optional)** - `#refFile` + `#refStrength` (0-90%, 20%) -> `state.refImage =
   {url, blur}` -> `opts.referenceImage` on the plugin request.
6. **Ultra resolution** - `#ultraBlock`, `#ultraCb`, `#ultraTargetChips` (1K/2K/4K/8K on the longest
   side), `#ultraSharpen` (0-100, 35) -> `state.settings.ultra` / `ultraTarget` / `ultraSharpen`: real
   ESRGAN 2x passes, then an exact-target resample and a strip-wise unsharp, in a worker, budgeted, the
   result a Blob and never a data URL.

## THE MAP (where each would have gone, and with which switch names)

| # | here today | would have been | verdict |
| --- | --- | --- | --- |
| 1 | Resolution already exists: `LIA_IMAGE_RESOLUTION` (`src/js/config.js:19`), the four `IMAGE_SIZES` chips and `forge.resolution` (`src/js/forge.js:3`, kept in kv `lia_settings/image_form`) | - | **already here**; only `auto` was absent, and here the chips *are* the aspects, so it has nothing to derive from |
| 2 | `LIA_IMAGE_STYLE` only, and it is applied in **one** place - `renderVision` (`src/js/images.js:1882`); the forge's own prompts bypass it | `LIA_IMAGE_BOOST` + a new `src/studio/boosts.json` (families, phrases, sniff rules) + a QUALITY row in `#createPanel` + `/boost on\|off\|status`; the append moved to the single choke point `renderImageNow`, reported as a `reportLines` line | **cheap, not taken** |
| 3+4 | nothing of the sort (`verify` appears only as a keyword in `dms.js` / `rtfm.js`), but every primitive exists: `lookBlob(blob, prompt)` (`src/js/images.js:1944`) is exactly a transient vision call on a Blob, the house negative default is the negative road, and `src/js/progress.js` draws counted jobs | a new `src/js/verify.js` (`window.verify`) + `src/studio/defects.json`, hung on `renderImageNow`; `LIA_VERIFY`, `LIA_VERIFY_BUDGET_MS`, `LIA_VERIFY_MAX_TRIES`, `LIA_VERIFY_PROMPT`; device override in kv `lia_settings/verify`; `/verify on\|off\|budget 1\|2\|3\|5\|status` | **the one real build, not taken** - and the only item that spends his key per attempt (~570 tokens a check) |
| 5 | - | - | **do not build it, ever, on this plugin.** See below. |
| 6 | the pipeline already exists: bigger.pics 4x by window (`src/js/upscale.js`) under `src/js/pipeline.js`, and this machine (`src/js/upscale-local.js`) with `LIA_UPSCALE_LOCAL_FACTOR/_SHARPEN/_FORMAT/_MAX_MP/_AUTO/_REPLACE` | (a) `LIA_UPSCALE_LOCAL_TARGET` (`""`/`1k`/`2k`/`4k`/`8k` longest side) + `/upscale target ...`; (b) `LIA_UPSCALE_AI`, `LIA_UPSCALE_AI_PASSES`, `LIA_UPSCALE_AI_BUDGET_MS` + a new `src/workers/ultra-worker.js` + `/upscale ai on\|off\|status` | **not taken**; (a) is UI over what is there, (b) is the only genuinely new capability - the local road resamples, it invents no detail |

## THE TWO FACTS WORTH KEEPING

- **Item 5 is a dead control.** `imports/text-to-image-plugin/main.pjs:547`, the plugin's own words:
  *"referenceImage is deliberately DISABLED server-side and currently has NO EFFECT on the generated
  output - the parameter is parsed and sent but ignored for general traffic (2026-08-25, per the
  platform owner). Don't build img2img flows on it."* So the reference row in the art shop changes
  nothing today; anything reference-guided here would need a different engine entirely, not a row.
  **A future session must not add it back "because it is missing".**
- **The archive is permanent:** `https://user.uploads.dev/file/65bb988e40176443bb6fb85a96c8badc.zip`
  (the panel is at `index.html:1086-1222` inside it). The workspace copy was `scratch/`, which dies with
  its session; section 1dk is the harvest, this entry is the map, and those two URLs are how the art
  shop's own build gets read again without a re-fetch.

## WHAT WAS THOUGHT

**A plan is what makes the ruling cheap.** He could see, item by item, exactly which file here would
have changed and what it would have been called - and the answer was still no. That is a different kind
of no from "nobody looked": it is a decision, and it is the reason the reasoning is written down.

**Why the terminal does not need them.** These six controls are for a page whose visitor types a prompt
cold. Here the prompt is already the house's own craft - the recipe book, the pose book, the shot list,
the veiled tongue, the house negative list - and the size question is already answered end to end by
the pipeline: 4x bigger.pics for the first picture of a press, this machine for everything else, the
smaller original retired once the bigger one is safe. Items 2-4 are quality tuning for a stranger's
one-off prompt; she has a whole studio instead. His words: *"We already have a working generator, why
bother re-inventing the wheel?"*

**Why the art shop is the right home.** MYTHOS FLUX *is* the art shop - it ships the eight roads, the
style library and the checker, and six advanced controls belong beside those, not inside a private
terminal. It also keeps this tree's rule intact: **no new toys, no new weight, no second place where a
render request is built.**

**The one thing that stays true either way.** `hideGalleryButtons: true` lives at the choke point
(`renderImageNow`, the only `root.generateImage` call site in the tree), so every future road into the
image service - a verify loop included, if it is ever wanted - inherits "never public" without anyone
having to remember it.

## THE ONLY THING WITH VALUE (his follow-up, the same day)

> *"Remove all odd fonts and emojis and perhaps find a logical place for them so they can be accessed
> during the create image operation."*

Read as the one instruction that survives the exercise, and it is addressed to the **art shop** - the
thing that would be built - not to this terminal.

**Measured, in the archived flux `index.html` (338,875 B): 250 emoji glyphs across 48 distinct symbols**
sit in the chrome and on the controls - `🎨 Style`, `⚙️ Advanced settings`, `🔍 Ultra resolution`,
`🧠 Auto-verify`, `🤗 Free cloud models`, `🔒 My gallery`, `🖼 History`, `👤 Login`, `🚫 Negative prompt`,
`🔑 More quota`, the engine names (`♾️ qinegen`, `⚡ Z-Image`, `🛡️`), and the whole share row
(`💬 ✈️ 📘 👽 📲 📋`). An emoji inside a monochrome label is drawn by the system's own emoji font, and that
is the "odd font": a coloured glyph wearing a different typeface from the words beside it. Under it is the
second oddity - labels at 9.5 / 11 / 12 / 13 px, uppercase and letter-spaced in three weights, so the
chrome has no single voice.

**And the second half of the ruling is the placement**: the controls those emoji are stuck to should not be
scattered across headers, modals and collapsed drawers - they belong **in the create-image flow itself**,
one plain label each, reachable while a picture is being made.

**Here, measured: there is nothing to strip.** `index.html` 0 emoji, `src/js/images.js` 0, `main.pjs` 6
(`🎲` x3, one `🎬`, two arrows), `src/css/terminal.css` 3 (`↓ ↻ ✕`), `src/js/forge.js` 2 (`↻ ✕`). The
terminal speaks in uppercase monospace with no pictures in its labels, so this is a rule for anything
adopted from flux rather than a change to this tree: **no emoji, no display fonts, no micro-type; one plain
label per control, and the control lives where the creating happens.**

## FILES TOUCHED

`src/chronicle/2026-09-30-the-six-advanced-settings.md` (this file), `src/chronicle/chronicle.json`
(55 -> 56), `src/TODO.md` (section 1dl), `src/pack/files.json` (151 -> 152). No code changed - not the
image lane, not a command, not a single knob. **NOT SAVED by the agent.**
