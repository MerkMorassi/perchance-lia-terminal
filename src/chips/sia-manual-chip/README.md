# MYTHOS-MANUAL - every agent's own user's manual, amendable and shareable (for SIA/MERKOS)

Origin: cut from the house RTFM's shape to CHIP SPEC v1, proven live 2026-10-07.
One agent's manual is one shelf of pages; agents trade shelves the way rooms
trade turns — export a bundle, the customer shelves it, clashes keep the
customer's own words.

## use

```js
const manual = MythosManual.client({
  name: "lia-manual",
  docs: [{ id: "manual", title: "THE USER'S MANUAL", text: "# ...", tags: ["how-it-works"] }],
  store: { load: () => libGet("manual_pages"), save: (v) => libPut("manual_pages", v) },
  say: (t) => announceUpdate(t)
});
await manual.load();
await manual.amend("manual", "WISHES", "how the wishlist works...");
const bundle = manual.share(); // hand to another agent; they call receive(bundle)
```

## the contract

- `load()` -> `{ok, count}`. Reads `{v, docs}` (or a bare array) from store;
  seed pages come from `docs:` when the store holds nothing. Keeps pages with
  an id and words; first of a duplicate id wins.
- `list()` -> `[{id, title, tags, desc}]` (desc = first body line).
- `read(id)` -> `{ok, doc} | {ok:false, error}`. Unknown ids refuse loud.
- `amend(id, heading, text)` -> appends a dated `## HEADING` section, stamps
  `updated`, persists, says one line. Empty text and unknown ids refuse loud.
- `add({id, title, text, tags})` -> a new page. Duplicates refuse (amend
  instead); id-less or wordless pages refuse.
- `share()` -> JSON bundle `{manual, exported, docs}`. `receive(bundle)` ->
  shelves pages it doesn't hold, skips the ones it does, says what happened.
  Garbage refuses loud.
- `clear()`, `count()`, `ready()`, `name()`.

Pages cap at 60000 chars, titles at 80, ids normalised to lowercase hyphens.

## deliberately left out

- No rendering — the host prints pages its own way (the house reader folds
  markdown for the terminal). The chip keeps words, not looks.
- No merge — a clash keeps the customer's page, never three-way merges. Two
  agents editing one page is a conversation, not a function.
- No network — bundles travel however agents already talk (bridge, files,
  paste). The chip never phones home.

## honesty note

A manual is not a memory: nothing here is recalled, retrieved, or folded into
a turn. It is the machine's papers, kept per agent, and trading shelves trades
papers — not authority. Read before you run, amend as you build.
