# SIA-FACTORY-LAYOUT - thin layout companion for the factory's sia-style skin

Origin: cut 2026-10-06 after the factory's hot-swap to `sia-style-terminal.css`
left every factory row cramped/overlapping (the terminal sheet styles no
factory IDs, and the retired `factory.css` took the row layout with it).
Spec v1. Proven live in the terminal preview against a byte-copy of the
factory markup before ship.

## use

In the factory `index.html`, directly after the sia-style link:

```html
<link rel="stylesheet" href="src/chips/sia-style-terminal.css">
<link rel="stylesheet" href="src/chips/sia-factory-layout-chip/factory-layout.css">
```

Order matters: the companion must load second so its row rules win. Nothing
in the factory markup changes, and `factory.css` stays retired.

## the contract

- Layout only: display, flex, wrap, gap, padding, widths, heights,
  overflow. No colors, no fonts, no borders, no backgrounds. The black/green
  skin stays exactly as shipped.
- `#factoryApp` is a centered 880px column; `#keyRow`, `#mintRow`,
  `#talkRow` wrap with an 8px gap so buttons never sit on inputs.
- Inputs flex (`1 1 200px`, full-width under 520px); buttons keep their
  width with a 34px touch floor; `#mintLog` scrolls at 38vh; empty
  `#mintLog`/`#talkOut` draw no box.
- Body is unclipped (`overflow-y:auto`, natural height): the terminal sheet
  pins body to a fixed 100vh with hidden overflow, which cut the factory
  page off below the fold.

## deliberately left out

- Any theming: color, type, borders, buttons' hover, log styling. That is
  the sia-style sheet's job; this file must never restyle it.
- Factory behavior (staging, minting, talk): untouched, no script here.

## honesty note

Proven against a markup copy, not inside the factory space itself: same
IDs, same order, terminal sheet plus companion. If the factory adds a new
row ID, it needs one matching selector line here.
