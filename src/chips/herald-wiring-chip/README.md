# MYTHOS HERALD WIRING - one SYSTEM voice for background jobs (for SIA and kin)

Origin: ported from SIA's live herald wiring (`src/js/main.js` backstage/herald
blocks); proven in the SIA preview 2026-10-03; built to CHIP SPEC v1. Needs
`mythos-herald-standalone.js` loaded first (it is the voice; this chip is the
hands that hold it to a host page).

## use

```html
<script src="mythos-herald-standalone.js"></script>
<script src="mythos-herald-wiring-standalone.js"></script>
<style id="heraldSkin"></style>
<script>
  document.getElementById("heraldSkin").textContent =
    MythosHeraldWiring.cssText("chatCtn");

  var wiring = MythosHeraldWiring.client({
    containerId: "chatCtn",
    tag: "ARCHIVAX",
    hush: true,                    // journal-only; failures still shout. Omit for full voice.
    kvGet: (k) => libGet(k),
    kvSet: (k, v) => libPut(k, v),
    slot: "herald_log",
    scroll: () => ui.scrollDown(),
    onLine: (text) => noteSys(text)
  });

  await wiring.backstage("recall lore", async () => {
    lore = await contextFor(q);
    return lore ? "fragments found" : "nothing needed";
  }, true);

  if (/^journal$/i.test(text)) { await wiring.journalSay(); return; }
</script>
```

## the contract

- `MythosHeraldWiring.client(opts)` — binds the herald to one chat container.
  Refuses loud if the herald is missing or the container does not exist.
  `hush: true` journals runs silently and paints only failures; omit for full
  STARTED/DONE voice. `journal()` / `report()` read the shared slot fresh, so
  silent runs are visible immediately. Returns `{ herald, backstage, journal,
  report, journalSay, cssText }`.
- `backstage(name, fn, terse)` — runs fn as a herald task: STARTED unless
  terse, DONE IN n MS with fn's short return, FAILED with the reason and
  "nothing else was touched". Every run journaled `{ ts, ms, name, ok, note }`,
  cap 200, slot per agent.
- `journalSay()` — paints the last runs as one SYSTEM block.
- `cssText(containerId)` — the skin; herald-painted lines read as native
  SYSTEM lines. Painted lines also fire `onLine(text)` and `scroll()`.
- Shapes: journal entries `{ ts, ms, name, ok, note }`, numeric ms stamps,
  append-only. DONE returns are short strings (counts, parts, backends) —
  never a full reply.

## deliberately left out

- The host's op call-sites (recall, paint, voice, bridge, backup) — wrapping
  is one line each at the call site; a chip cannot know your call graph.
- Agent-ordered ops from inside a reply (`[[HERALD: ...]]` line-triggers) —
  needs the agent's command lane; say the word and it follows.
- Multi-host fan-out — one container per client; run two clients for two rooms.

## honesty note

This chip is paint and journal, not authority: lines are DOM any reader can
edit, the journal is host storage any host can rewrite. It announces work, it
does not guard it. The gate chip guards; this one heralds.
