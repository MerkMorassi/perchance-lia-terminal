# UNIX-ETHOS CHIP - the tree, names, and philosophy (for new helpers)

Origin: generalized from `src/agent/unix-ethos-setup.md` (voice-app setup,
2026) and the terminal realm's lived tree. Built to CHIP SPEC v1.

## use

```html
<!-- a new helper proves it read the chip by matching this shape -->
index.html               <!-- shell: markup + script tags, almost no logic -->
main.pjs                 <!-- config: lists + tunables, almost no logic -->
src/js/main.js           <!-- boot order, nothing else -->
src/agent/CHATLOG.md     <!-- running log, one line per ship -->
```

```js
// adding a memory touches zero code:
 // 1. drop the file in src/lorepack/
 // 2. add one entry to src/lorepack/lorepack.json
 // 3. reload — the player reads the manifest
```

## the contract

- `UNIX-ETHOS.md` — the whole ethos: philosophy (7 rules), the starting
  tree, naming rules (dashes, filename = job, ~400-line split, dated
  chronicle files, relative refs), format rules (no code comments,
  sentence errors, masked secrets, stamped records, CHATLOG line per ship).
- A helper is compliant when: a stranger can draw it from the tree alone,
  adding a document touches zero code, and every pack dir has its README.

## deliberately left out

- The tool contract (IIFE shape, factory entry, proof order) — CHIP SPEC v1.
- App leaves (voice/ferry/gallery modules) — each helper grows its own.

## honesty note

An ethos file cannot enforce itself; it is a thing to hand a new helper
before it writes file one. Compliance is checked by eye: tree matches,
names match, READMEs present. What it buys is that every realm stays
readable to every future session.
