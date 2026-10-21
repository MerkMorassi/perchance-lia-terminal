# UNIX-ETHOS FILE TREE — setup instructions for the voice app (commpack-sia)

Goal: a `src/` tree with the same shape and habits as the terminal's, scaled to a
voice app. Small, legible, every directory self-describing.

## The rules (the ethos itself)

1. ONE CONCERN PER DIRECTORY. `js/` runs, `css/` styles, packs hold memory.
   Nothing generic lands at the root of `src/`.
2. EVERY PACK DIRECTORY carries its own README.md: what the pack is, what shape
   its files take, how it loads. A stranger opens the folder and understands it.
3. EVERY PACK has a manifest (small `.json` index): file list, tags, version.
   Code reads the manifest, never a hardcoded file list. Adding a document =
   drop the file in + one manifest entry + reload. No code edits.
4. REFERENCES ARE RELATIVE, ALWAYS. Page: `src/js/brain.js`. Inside js:
   `./packs.js`, `../lorepack/lorepack.json`. Never absolute URLs to own files.
5. ONE MODULE PER FILE, filename = what it does (`brain.js`, `mic.js`,
   `lorepack.js`). A file over ~400 lines wants splitting.
6. `index.html` is a SHELL: markup + `<script>` tags in load order, almost no
   logic. `main.pjs` is CONFIG: lists and tunables, almost no logic.
7. NOTHING BIG OR SECRET IN THE TREE. Audio refs, images: small or uploaded and
   linked. No keys, no private user data — that lives in kv/IndexedDB.
8. history goes in `chronicle/` (one dated file per event, append-only) and the
   agent keeps its own running log in `agent/CHATLOG.md`.

## The tree (minimal viable, then grow)

```
src/
  index-frag/            (only if needed; index.html itself stays at root)
  js/
    main.js              boot order, nothing else
    bus.js               tiny event bus everything talks through
    store.js             kv wrappers (settings, memory, keys)
    brain.js             prompt assembly + provider calls
    voice.js             TTS/STT wiring
    mic.js               push-to-talk + levels
    lorepack.js          THE LOREPACK PLAYER (manifest → fetch → index → recall)
    corepack.js          traits/directives loader (optional at first)
    commpack.js          vendored recorder, byte-exact, never hand-edit
  css/
    sia.css              all style, one file until it hurts
  lorepack/
    README.md
    lorepack.json        manifest: documents[], tags, version
    the-absolute.txt     (already shipped)
    capabilities.md      (already shipped)
  corepack/
    README.md
    corepack.json        (starts near-empty; traits land here, not in code)
  moodpack/
    README.md
    moodpack.json        (registers; switched, never baked in)
  roles/
    README.md
    roles.json           (RoleLayers over the one Actor)
  voice/
    voices.json          (voice refs versioned like everything else)
  commpack/
    COMMPACK.SPEC.md     (copy, read-only reference)
    commpack.js          (vendored recorder — same file as js/commpack.js? pick
                          ONE home and reference it; do not keep two copies)
  chronicle/
    README.md
    YYYY-MM-DD-<slug>.md (append-only history)
  agent/
    CHATLOG.md           (the agent's own running memory)
```

## Setup order

1. Create the directories + READMEs first (structure before code).
2. Move existing code into `js/` + `css/` WITHOUT changing behavior; fix the
   `<script>` tags in index.html to the new paths; reload, console must be clean.
3. Drop `lorepack.js` into `js/`, add the manifest + the two shipped docs under
   `lorepack/`, wire ONE recall call into the brain. Prove it: ask a question
   whose answer lives only in `the-absolute.txt`; the reply must use it.
4. Add `corepack/`, `moodpack/`, `roles/` as near-empty manifests with READMEs —
   placeholders with shape, filled later.
5. Start `chronicle/` + `agent/CHATLOG.md` from day one; future sessions inherit.

## Done when

- A new contributor can draw the app from the tree alone.
- Adding a lore document touches zero code.
- The recall proof passes; the console is clean; nothing 404s.
