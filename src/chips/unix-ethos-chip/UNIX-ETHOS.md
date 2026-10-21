# UNIX ETHOS - file names, tree shape, and helper philosophy (for every new AI helper)

Ported from `src/agent/unix-ethos-setup.md` (voice-app setup notes) and the
lived shape of the terminal realm. Proven by every realm that still loads.

## use

Hand this file to a new Perchance AI helper before it writes its first file.
If the helper's tree matches the shape below, it is one of ours; if it does
not, it renames before it ships.

## the philosophy (read first, build second)

1. SMALL AND LEGIBLE. One concern per directory. `js/` runs, `css/` styles,
   packs hold memory. Nothing generic lands at the root of `src/`.
2. SELF-DESCRIBING. Every pack directory carries its own README: what it is,
   what shape its files take, how it loads. A stranger opens the folder and
   understands it with no guide.
3. MANIFESTS, NOT HARDCODED LISTS. Every pack has a small `.json` index
   (file list, tags, version). Code reads the manifest. Adding a document =
   drop the file in + one manifest entry + reload. Zero code edits.
4. STRUCTURE BEFORE CODE. Directories + READMEs first, behavior second.
   A new contributor can draw the app from the tree alone.
5. SHELL AND CONFIG STAY THIN. `index.html` is markup + script tags in load
   order, almost no logic. `main.pjs` is lists and tunables, almost no logic.
6. NOTHING BIG OR SECRET IN THE TREE. Small assets or uploaded-and-linked.
   No keys, no private user data — those live in kv/IndexedDB.
7. HISTORY IS APPEND-ONLY. Events go in `chronicle/` (one dated file each);
   the agent keeps its own running log in `agent/CHATLOG.md`. Nothing is
   rewritten, only added.

## the tree (every helper starts here, then grows)

```
index.html               SHELL ONLY: markup + <script> tags in load order
main.pjs                 CONFIG ONLY: lists, tunables, plugin imports
src/
  js/
    main.js              boot order, nothing else
    bus.js               tiny event bus everything talks through
    store.js             kv wrappers (settings, memory, keys)
    brain.js             prompt assembly + provider calls
    <thing>.js           one module per file, filename = what it does
  css/
    <helper>.css         all style, one file until it hurts
  <memory>pack/          lorepack / corepack / moodpack / voicepack ...
    README.md            what the pack is, file shape, how it loads
    <pack>.json          manifest: files[], tags, version
    <docs...>            the memories themselves
  roles/
    README.md
    roles.json           RoleLayers over the one Actor
  chronicle/
    README.md
    YYYY-MM-DD-<slug>.md append-only, one file per event
  agent/
    CHATLOG.md           the agent's running memory, one line per ship
```

## naming rules (no exceptions)

- Dashes, never spaces: `mythos-rating-standalone.js`, never `Mythos Rating.js`.
- Filename = what it does: `brain.js`, `mic.js`, `lorepack.js`.
- One module per file. A file over ~400 lines wants splitting.
- Chronicle files start with the date: `2026-10-04-first-contact.md`.
- Relative references, always: `src/js/brain.js`, `./packs.js`,
  `../lorepack/lorepack.json`. Never absolute URLs to your own files.

## format rules (so every helper reads like one author wrote it)

- No code comments. The why lives in the README, not in the file.
- Errors are sentences: `STORE REFUSED (401) :: ...`, `DENIED - ...`,
  `NOTHING ELSE WAS TOUCHED.` Never a bare stack, never silence.
- Secrets are masks only (`first7...last4`). Keys live in the host's
  keyring/panel, never in code, never in logs.
- Storage records carry `{ ts, ... }`, numeric ms stamps, append-only,
  dedupe by stamp.
- Every ship ends with one dated line in `agent/CHATLOG.md`: date, what
  shipped, what was left out. Future sessions inherit through that file.
- Replies stay short (a few lines); the work ships in files, not in chat.

## engine gotchas (perchance, learned live)

- `[name]` blocks do NOT evaluate in attributes. Config crosses from
  `main.pjs` into JS via a hidden text span (`<span id="cfgEl" hidden>[ mythosConfig ]</span>`),
  read with `textContent` — never through an attribute.
- Curly JSON breaks pjs square blocks: the span carries PIPE-delimited
  pairs (`key|value|key|value`), and JS splits on `|` — never raw `{}`.
- Thin shell/config still holds: the span is a bridge, not logic. JS parses
  it; `main.pjs` owns the values.

## deliberately left out

- App-specific modules (voice, ferry, gallery) — each helper grows its own
  `js/` leaves; the trunk above does not change for them.
- The chip contract itself (factories, proof order, versioning) — that is
  CHIP SPEC v1, a separate chip. Ethos is the tree; spec is the tool.
