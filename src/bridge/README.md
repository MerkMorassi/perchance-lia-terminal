# THE BRIDGE — designer GUIs that work this console

Two files, two directions. The contract between MYTHOS-DESIGNER
(https://github.com/MerkMorassi/MYTHOS-DESIGNER) and SIA TERMINAL.

## OUT: terminal-surface.json (v1) — the binding catalog

Load this in the designer (import JSON, or fetch it off a hosted copy) and every
control drawn can bind to something real here. A binding is:

  {"terminal": "<command-text>"}

carried on an MSDNode `targetSection`, a widget `data.terminal` (object with a
`terminal` string, or the bare string), or a navigation `target`.
`<command-text>` is the VOXCONT repertoire: `open gallery`, `close shelf`,
`close it`, `pull the drive`, `mirror the vault` (asks YES first), `pics`,
`font bigger`, `upper deck off`, `listen`, `send it`, `stop`, `status`.
Renders, upscales, strikes, deletes and wipes have NO command-text and can never
fire; unbound nodes are refused loud and nothing moves.

## IN: terminal-bridge.js — the designer-side drop-in

Vanilla, no dependencies, works beside React. One tab drives the other over
postMessage; receipts come back.

```js
SiaTerminal.receipts(function (line) { /* paint the receipt */ });
SiaTerminal.connect("https://perchance.org/<terminal>", "sia_terminal");
await SiaTerminal.run("open gallery"); // {ok, receipt} - 8s NO ANSWER timeout
```

React (preview panel, effect):

```jsx
useEffect(function () {
  SiaTerminal.receipts(function (line) { setFeed(function (f) { return f.concat([line]).slice(-5); }); });
  SiaTerminal.attach(document.getElementById("termFrame").contentWindow, "https://perchance.org");
}, []);
function fire(cmd) { SiaTerminal.run(cmd).then(function (r) { setFeed(function (f) { return f.concat([r.receipt]); }); }); }
<button onClick={function () { fire("open stage"); }}>STAGE</button>
```

Wire format: `{k:"sia", terminal:"<command-text>", token}` out,
`{k:"sia", ok, receipt, token}` back, `{k:"sia", hello:1}` / `{k:"sia", ready:1}`.
The terminal answers `ready` and executes ONLY for listed origins (Vite
localhost presets shipped; `/msd origin add <ORIGIN>` for a deployed designer).

## BACK: the board (src/js/msd.js, /msd)

A designer manifest pasted after `/msd import` is BUILT HERE as a control board:
header, nav, nodes at x/y with status colors, KPI cards, widgets (event-log
reads the last receipts, status-grid reads vault/panels/voice/skin, bound
widgets get RUN). Same gates as voice control. Boards persist and survive
reloads. `/msd run <command-text>` tries one binding from text.
