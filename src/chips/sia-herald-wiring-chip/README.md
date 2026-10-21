# MYTHOS HERALD WIRING — the unified-SYSTEM chip (for SIA and kin)

The layer that marries `mythos-herald-standalone.js` to a host page so every
background job speaks with one SYSTEM voice: STARTED, DONE IN n MS, or FAILED
— painted native, scrolled into view, journaled durably. Ported out of SIA's
live wiring; zero dependencies besides the herald itself.

## files

- `mythos-herald-standalone.js` — the announcer (you already have it; unchanged)
- `mythos-herald-wiring-standalone.js` — this chip (boot + backstage + skin)

## use

```html
<script src="mythos-herald-standalone.js"></script>
<script src="mythos-herald-wiring-standalone.js"></script>
<style id="heraldSkin"></style>
<script>
  document.getElementById("heraldSkin").textContent =
    MythosHeraldWiring.cssText("chatCtn"); // your chat container id

  var wiring = MythosHeraldWiring.boot({
    containerId: "chatCtn",
    tag: "MERKOS",                 // her name on every task line
    kvGet: (k) => libGet(k),       // durable journal; omit both for localStorage
    kvSet: (k, v) => libPut(k, v),
    slot: "herald_log",
    scroll: () => ui.scrollDown(), // host's scroll-into-view
    onLine: (text) => noteSys(text) // host hears every painted line too
  });

  // wrap any background op — his ops full voice, per-turn work terse:
  await wiring.backstage("recall lore", async () => {
    lore = await contextFor(q);
    return lore ? "fragments found" : "nothing needed";
  }, true);

  // the journal verb answers from the log:
  if (/^journal$/i.test(text)) { await wiring.journalSay(); return; }
</script>
```

## the contract

- `boot(opts)` — creates the herald (forceLocal, so it never touches
  `window.print`), observes the chat for painted lines (scroll + onLine),
  returns `{ herald, backstage, journalSay, cssText }`.
- `backstage(name, fn, terse)` — `herald.task` bound and ready: announces
  STARTED unless terse, always DONE IN n MS with fn's short return, or FAILED
  with the reason and "nothing else was touched". Journaled, newest last, cap 200.
- `journalSay()` — paints the last runs as one SYSTEM block.
- `cssText(containerId)` — the skin that makes herald lines look native.

## SIA's house rules (baked into the port)

- Task DONE lines carry a SHORT return (parts, counts, backend) — never a full
  reply; full replies are turns, not tasks.
- Her sound-bite keeps run through `backstage("keep sound-bite", …)`: one DONE
  line, library entry + staged phrase-and-audio-ref inside, never a repeat.
- The journal slot lives beside her other packs (`herald_log` in her vault).
