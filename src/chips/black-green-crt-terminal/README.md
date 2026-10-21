# BLACK-GREEN-CRT-TERMINAL - the standard look and feel

Origin: consolidated 2026-10-06 from the two proven chips that carried it
separately (`mythos-style-chip` skin + font protocol, `sia-factory-layout-chip`
row layout). The terminal's own `src/css/terminal.css` is the source of
record; the copy here is byte-identical. Spec v1.

## the palette

| role | value |
|---|---|
| ground | `#000` |
| primary text / borders | `#00ff00` |
| prose | `#00cc00` |
| mid green | `#00aa00` |
| dim labels | `#008800` |
| faint / disabled | `#005500` / `#004400` |
| hairlines | `#003300` |
| panel fills | `#001100` / `#002200` |
| warning | `#ffb020` amber |
| error | `#ff2020` / `#ff6b6b` on `#140000` |

Type: Inconsolata for body, inputs, logs and code; VT323 at 175% for
headers, mastheads and alerts; 12px base; uppercase labels with letterspaced
tracking. Black background, green phosphor text, scanline-quiet.

## use

Paste `snippet.html` links in load order (skin, then fonts, then layout).
Offline hosts drop the Google Fonts lines and fall back to system monospace
with no breakage. One file swap re-skins every space that wears it.

## the contract

- `terminal.css` is the byte-exact terminal skin; `vt323-inconsolata.css`
  lays the font protocol over it; `factory-layout.css` carries row layout
  only (no colors, no fonts) for factory-ID pages.
- `hidden` always wins over inline styles; `body.hush` is the third veil
  state beside the gates.
- A host that lacks the named ids simply shows no matching rules.

## deliberately left out

- Everything behavioral: no js. A second skin is a fork and recolor, never
  a parameterization of this file.

## honesty note

A skin, not a theme system: no variables, no light mode. Proven by
byte-identity with the live sheet plus parse and layout proof, not by
eyeball.
