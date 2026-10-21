# MythosDecks - foldable upper/lower decks with mirrored nav (for any realm page).
Origin: ported from Merkos' Garden `index.html` decks block (deckApply, deckMeasure, deckNavBuild, deckWire, deckBoot, deckReadRender), proven 2026-10-06 to CHIP SPEC v1.

## use

```html
<script src="decks-standalone.js"></script>
<script>
var decks = MythosDecks.client({ top: "deckTop", bottom: "deckBottom", nav: "deckNav", read: "deckRead", room: "deckRoom", slot: "mythosDecks" });
decks.restore().then(function () {
  decks.buildNav([{ id: "studio", label: "Lab" }, { id: "gallery", label: "Gallery" }]);
  decks.readout("2 pieces · 1 seed", "Lab");
});
</script>
```

## the contract

`MythosDecks.client(opts)` -> api. opts: `top`, `bottom`, `nav`, `read`, `room` (element or id; decks default to `deckTop`/`deckBottom`); `topGrip`, `bottomGrip` (element or id, else the `[data-grip]` inside that deck); `store` (kv-like `{get, set}` — promises or plain values); `slot` (default `mythosDecks`), `key` (default `decks`), `agent` (slot suffix where shared); `onTab(id)`.
Store order: `opts.store` -> localStorage `slot:key` -> memory. Records are `{ts, top, bottom}` with numeric ms stamps, last write wins.
api: `state()` -> `{top, bottom}`; `fold(w)` / `unfold(w)` / `toggle(w)` -> Promise(record); `apply({top, bottom})` -> state (idempotent); `restore()` -> Promise(state); `buildNav([{id, label, on}])` -> count; `readout(line, roomName)` -> text; `measure()` -> `{h, b}` (also sets `--deck-h` / `--deck-b`); `destroy()` -> true.
Errors, one line each: `DECKS DENIED - no deck elements found :: NOTHING WAS TOUCHED.` / `DECKS DENIED - no nav element :: NOTHING WAS TOUCHED.` / `DECKS DENIED - unknown deck <w> :: NOTHING WAS TOUCHED.` / `DECKS STORE REFUSED [(name)] :: <key> :: NOTHING ELSE WAS TOUCHED.`

## deliberately left out

Shared CSS (the host styles `.folded`; the chip only toggles the class and `aria-expanded`) — unlocks when the realms share a deck stylesheet. ResizeObserver auto-remeasure (the host calls `measure()` on resize) — unlocks with an `auto: true` opt. Counts-composed readout (the host passes the line; this realm's composer is `deckReadRender`).

## honesty note

Not a lock: `folded` is a class and the prefs are local. Anyone reading source can unfold; this is memory, not authority.
