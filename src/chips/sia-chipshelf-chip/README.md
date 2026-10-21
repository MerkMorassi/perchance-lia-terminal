# MYTHOS-CHIPSHELF - read any vendored standalone in a sandboxed frame (for SIA/MERKOS)

Origin: extracted from the vault chips shelf to CHIP SPEC v1, proven live 2026-10-07 (10/10 chipshelf.test.js, auditor 28/28 whole).

## use

```js
const shelf = MythosChipshelf.client({ chips: ["src/mythos-mood-standalone.js"] });
const r = await shelf.source("src/mythos-mood-standalone.js");
frame.srcdoc = r.ok ? shelf.doc(r.text) : shelf.errDoc(r.error);
```

House: the vault builds the client from its loaded script tags and renders one
button per chip plus a sandboxed iframe; taps read through the chip.

## the contract

- `client({chips | list(), fetchFn})` — chips is an array of urls or `{url}`;
  `list()` same shape; `fetchFn` defaults to global fetch (pass a stub in tests).
- `count()`, `names()` (short `mood-standalone` style), `urls()`, `known(url)`.
- `source(url)` -> `{ok, url, text} | {ok:false, error}`. Off-shelf urls and
  readerless hosts refuse loud; text capped at 60000 chars.
- `doc(text)` -> escaped srcdoc `<pre>` string; `errDoc(why)` -> amber error doc.

## deliberately left out

- No DOM: buttons and the iframe stay host-side (vault.js). The chip never
  touches the page, so it reads anywhere fetch reaches.
- No downloading or editing: the shelf reads. Writing stays with the editor.
- No persistence: the shelf lists what is loaded right now; nothing is stored.

## honesty note

Reading is not auditing: the shelf shows source, it does not verify it. The
auditor counts files; the shelf reads them. Anyone with the vault open can
read every chip — by design, they are all on-device plain text.
