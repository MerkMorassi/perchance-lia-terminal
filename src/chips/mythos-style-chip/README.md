# SIA-STYLE - the terminal's black/green skin (for any space)

Origin: byte-exact copy of the LIA terminal's `src/css/terminal.css`,
2026-10-06, spec v1. Proven live by inspection in the terminal preview
before ship (926 rules, body veil/hush states intact).

## use

```html
<link rel="stylesheet" href="terminal.css">
```

Hot-swap later: replace this one file, nothing else references style by
name. The `hidden` attribute always wins over inline styles here, and
`body.hush` is the third veil state beside the 18+ gate.

## the contract

- Base `terminal.css` is the byte-exact terminal skin (926 rules).
- `vt323-inconsolata.css` lays the font protocol over it: Inconsolata for
  body, code, logs, and inputs; VT323 at 175%+ for headers, mastheads, and
  alerts. The base file inherits everywhere, so the layer wins by load
  order (see `snippet.html`).
- Paste `snippet.html` links in load order; offline hosts drop the Google
  Fonts lines and fall back to system monospace with no breakage.
- Black background, green phosphor text, scanline-quiet.
- Panel, lorebar, docs, veil, and canon-tag classes travel with it - a host
  that lacks those ids simply shows no matching rules.

## deliberately left out

- Everything behavioral (that is the reader/pack chips' job). No js, no
  layout opinions beyond the terminal column.

## honesty note

A skin, not a theme system: no variables, no light mode. Fork and recolor
for a second skin rather than parameterizing this one.
