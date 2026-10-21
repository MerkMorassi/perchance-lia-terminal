# THE HOUSE NEGATIVE LIST IS THE DEFAULT FOR EVERY RENDER

2026-09-30 - the session that took a list of a hundred and sixteen things Patrikios never wants to see, added it to the terminal's one shared negative list, and made that list the negative of every render that arrives with none of its own - which meant finding the three places where "no negative" would have become a trap, and closing them.

## WHAT HE SAID

> Add for default negative image prompts: modern city, skyscraper, car, streetlight, concrete, smartphone, computer, screen, monitor, military uniform, firearms, gun, rifle, ancient Greece, Rome, Hellenistic, medieval, castle, knight, armor, chainmail, sword, shield, marble temple, Doric columns, Ionic columns, Corinthian columns, Parthenon, Colosseum, toga, chiton, peplos, marble statue, bronze age, Minoan, Mycenaean, Egyptian, hieroglyphs, pyramid, ziggurat, pagan temple of stone, torchlit hall, thatch, timber frame, wattle and daub, peasant, village, farmland, wheat field, horse and cart, sailboat, oil lamp, parchment, scroll, pastoral daylight, sunny meadow, forest glade, clear blue sky, plastic doll skin, airbrushed, smooth featureless face, extra arms, extra legs, mutated hands, fused fingers, multiple perspectives, split-screen effect, simultaneous viewpoints, duplicated subject from different angles, cubist composition, multi-angle portrait, reflections showing alternate angles, time-lapse sequence, collage of perspectives, compound viewpoints, cartoon, 3d render, cartoonish, anime, childish, immature, flat shading, plastic toy, low-detail face, text overlays, ui elements, hud, subtitles, banner, watermark, signature, artist name, date stamp, frame, border, cropped subject, hands missing fingers, distorted faces, extra limbs, unnatural eye spacing, blurry backgrounds, harsh shadows across face, overexposed sky, cgi, snapshot, flat lighting, blurry, low quality, text, censored, mosaic, url, username, logo, stamp, deformed face

## WHAT WAS BUILT

### 1. WHERE A DEFAULT NEGATIVE LIVES IN THIS TERMINAL

The terminal already had one: **THE HOUSE NEGATIVE LIST**, the `negative` string at the top of `src/studio/recipes.json` - printed by `/recipe negative`, and used by every recipe that says `"house"` (`baseline`, `scene`, `muse`). What it was NOT was a default for a render that arrived carrying no negative of its own: a plain CREATE with an empty box, `/image`, a picture SHE described herself all went to the image service with **no negative at all**, which is precisely how the artifacts his list names kept arriving.

So his list was **added to that list** - merged, de-duplicated, **his terms first** - and that list became the fallback in `studio.resolve()`. Measured: **1951 characters, 152 terms** (48 house + 104 new; twelve exact duplicates dropped, because his list already shared `blurry`, `low quality`, `text`, `watermark`, `logo`, `banner`, `signature`, `username`, `cartoon`, `extra limbs`, `mutated hands`, `fused fingers` with the shipped one).

### 2. THE ORDER IS PART OF THE ANSWER

A long negative may be cut by the service's own tokenizer, and a cut takes the TAIL. So his list is at the HEAD, and the older quality/anatomy terms (`worst quality`, `normal quality`, `low res`, `jpeg artifacts`, `bad anatomy`, `bad hands`, `extra digits`, `cropped`, `out of frame`, `cg`, `3d`, `unreal`…) follow it. Putting the shipped list first would have been the tidier-looking merge and the wrong one: the words he had just asked for would have been the words a tokenizer threw away.

### 3. WHAT THE LIST IS FOR, IN HIS OWN TERMS

Reading it back, it is four prohibitions wearing one coat, and they are the four attractors this terminal's own imagery has:

- **The modern world** - city, skyscraper, car, streetlight, concrete, smartphone, computer, screen, monitor, military uniform, firearms, gun, rifle.
- **Classical antiquity and the pastoral cliché** - Greece, Rome, Hellenistic, the medieval castle and knight, armor and swords, the marble temple and the three orders of columns and the Parthenon and the Colosseum, the toga and the chiton and the peplos, the marble statue, the bronze age, Minoan and Mycenaean and Egyptian, hieroglyphs and pyramid and ziggurat, the pagan temple of stone and the torchlit hall, thatch and timber frame and wattle and daub, the peasant village and the wheat field, the horse and cart, the sailboat, the oil lamp, the parchment and the scroll, and the light itself: pastoral daylight, sunny meadow, forest glade, clear blue sky.
- **The failures of a prompt written as a SHEET or a multi-view study** - multiple perspectives, split-screen, simultaneous viewpoints, a duplicated subject from different angles, cubist composition, multi-angle portrait, reflections showing alternate angles, time-lapse, a collage of perspectives, compound viewpoints - plus the styling failures (cartoon, 3d render, cartoonish, anime, childish, immature, flat shading, plastic toy, low-detail face, plastic doll skin, airbrushed, a smooth featureless face) and the junk markings (text overlays, ui elements, hud, subtitles, banner, watermark, signature, artist name, date stamp, frame, border, cropped subject).
- **The deformed class** - extra arms, extra legs, mutated hands, fused fingers, hands missing fingers, distorted faces, extra limbs, unnatural eye spacing.

### 4. THREE HOLES THE FALLBACK WOULD HAVE LEFT OPEN

1. **NO WAY TO SAY "NO NEGATIVE AT ALL".** Once a render with nothing gets the house list, an empty box no longer means "no negative" - and a fallback with no escape is a trap: a picture he WANTS of a marble temple has to be possible. The word **`none`** (also `no` / `off` / `nothing`) is now read in the three places he can write a negative: the forge's box, the document's own `NEGATIVE PROMPT` section, and a `(negativePrompt:::…)` cut. In each of them it means no negative - the same word the recipe lane has always accepted as `negative=none`.
2. **THE FORGE WOULD HAVE COPIED THE LIST INTO HIS BOX.** `createImagesRun()` fills the negative box from the resolver when the box is empty ("saves him the copy-paste") - which, with a fallback, means a page and a half of terms appearing in his form on the first CREATE and being SAVED as his own text in kv. Guarded: the box is filled from a document's own negative only, never from the fallback, and the report line is what tells him the house list is in use.
3. **THE RECORD WOULD HAVE LIED.** The vision lane stored `negative: parsed.recipe.negative` - an empty string for a render that was really sent with 1951 characters of house list. `renderImageNow()` now returns the negative it actually sent (taken after the resolver and after the `{a|b}` choice), `renderVision()` prefers that over its caller's, and the vision lane stores it - so the vault record, the render book and `/renders` name the list that went out.

## WHAT WAS THOUGHT

**WHY NOT A NEW CONSTANT IN config.js.** Because the terminal already had a shared negative list with a name, a printer (`/recipe negative`), four consumers and a shipped file that documents it. A second list would have been a second answer to "what is the default negative?" - and the first thing anyone would ask is which one is in force.

**WHY THE FALLBACK IS IN `resolve()` AND NOT IN `images.js`.** The resolver is already the one place that decides where every parameter comes from (seed, guidance, size, negative), in the order form > document > tag, and reports it. A default applied a layer lower, at the moment of sending, would be invisible in the report and could not be overridden by a document.

**WHY `none` HAS TO EXIST.** A default that cannot be turned off is not a default, it is a policy. He is an artist with a specific aesthetic; the day he wants a marble temple in a sunny meadow, the words `none` in the box are the whole difference between a picture and an argument with the machine.

**WHY THE FORGE BOX STAYS EMPTY.** The house list is not his text, and the form is his (that is why it is kept in kv as `image_form` and why a document's negative fills it only when the box is empty). Copying 1951 characters of fallback into a field he will save, reuse and edit is the kind of help that becomes clutter; the report already says it out loud, which is the terminal's usual way.

## WHAT WAS VERIFIED

- **The merge**: the shipped JSON parses; 152 terms; his first term is the first term of the list and the house tail still closes it; every sampled term present (`modern city`, `marble temple`, `Corinthian columns`, `pastoral daylight`, `cubist composition`, `text overlays`, `plastic doll skin`, `worst quality`, `bad anatomy`, `extra digits`, `out of frame`).
- **Where a negative comes from, seven ways** (`studio.resolve()`, `scratch/house1.js`): a plain render - `house` / 1951 chars; the box with his own text - `form`; the box saying `none` - nothing; a document `NEGATIVE PROMPT` section - `file`; that section saying `none` - nothing; a `(negativePrompt:::cartoon, text)` cut - `prompt`; a cut saying `none` - nothing.
- **The render path itself**, with `root.generateImage` stubbed and the request read off it: `renderVision("a marble temple at noon", "")` handed the service the 1951-character house list and came back reporting it, and `renderVision("a queen", "my own list")` handed over and reported his list - which is what the vault record and the render book will print.
- **The report line** rides in `resolve().report.notes`, which both the forge and the vision lane print.
- **The words followed**: `/recipe negative`'s own output, the `/help recipes` topic (a new paragraph - THE NEGATIVE LIST IS THE HOUSE LIST BY DEFAULT), the `/recipe` description in `commands.json`, and a new README section (THE HOUSE NEGATIVE LIST).
- **AN HONEST NOTE ON THE ONE THING THAT ALMOST SHIPPED BROKEN.** The new `/recipe negative` string was written by a script and carried an unescaped apostrophe in `TERMINAL'S`, which terminated the single-quoted JavaScript string: the page reported `Uncaught SyntaxError: Unexpected identifier 'S' (chat.js:3705)` in its own error banner, the check caught it before anything was called done, and it was fixed in the next pass. The lesson is the one this terminal keeps re-learning: reload the page and read what it says before believing an edit.

## STILL OPEN

- **A long negative may be cut by the service's tokenizer.** 1951 characters is roughly 390 tokens; a cut takes the tail, which is why his list is at the head. Trimming the whole thing to what a tokenizer certainly keeps (about 75 tokens) is a deliberate edit to make with his eye on it, not a quiet one to make for him.
- **No per-lane switch.** The fallback applies to every render - his forge, `/image`, her own visions. A lane-by-lane setting has not been asked for; the escapes are per-render, and `none` is the blunt one.
- **No capture again**: the page's `snapshot.js` still hangs on any element, so this build is verified by the resolver's own answers, a stubbed service call and the app's printed report rather than by a picture.

## FILES TOUCHED

`src/studio/recipes.json` (the merged `negative` and the `note` that says what uses it), `src/js/studio.js` (`resolve`: the word `none` in all three places, and the house fallback with its report note), `src/js/images.js` (`renderImageNow` returns the negative it sent; `renderVision` prefers it), `src/js/forge.js` (the box is never filled from the fallback), `src/js/chat.js` (the vision record stores the sent negative; `/recipe negative` and the `/help recipes` topic), `src/commands/commands.json` (the `/recipe` description), `src/README.md` (THE HOUSE NEGATIVE LIST, plus the recipe-book, vision and file-list passages it touches), `src/TODO.md` (§1cg), this entry and `chronicle.json`, `scratch/house1.js` (new harness) - and `src/pack/files.json` was regenerated because the tree grew by this entry. `index.html` and `main.pjs` are untouched, so `src/pack/index.html.txt` and `src/pack/main.pjs.txt` are unchanged, and `src/rtfm/commands.md` needed no regeneration (verified byte-identical: the cheatsheet carries each command's summary and usage, not its description).
