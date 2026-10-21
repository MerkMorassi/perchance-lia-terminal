# MYTHOS HERALD - background-task announcer chip (for SIA)

The way `SYSTEM:` keeps the chat informed while hands work behind the scenes:
a task runs, the room hears STARTED, DONE (with timing), or FAILED - and a
journal remembers every one. Ported from LIA's ARCHIVAX allow (op runner +
`SYSTEM` print road + revision journal), zero dependencies.

## use

```html
<script src="mythos-herald-standalone.js"></script>
<script>
  var herald = MythosHerald.client({
    containerId: "output",   // where SYSTEM lines land (made if missing? no - must exist)
    tag: "ARCHIVAX",         // her name on every line
    kvFolder: null,          // pass a kv folder for durable journal, else localStorage
    slot: "herald_log",
    forceLocal: false,       // true = always paint own lines, never window.print
  });
  window.mythosHerald = herald;

  herald.say("VAULT INDEXED :: 40 PICTURES.");
  herald.backstage("recall: 3 lore fragments, 41ms.");

  await herald.task("file portraits", async () => {
    await fileMany(ids, "/images/portraits");
    return "12 filed";       // spoken after DONE IN
  });
  console.log(await herald.report());
</script>
```

## the contract

- `say(text)` - a SYSTEM line on the stage: agent and user both see it.
- `backstage(text)` - a SYSTEM line behind the veil (or dim, if no veil).
- `task(name, fn)` - announces STARTED, runs fn, announces DONE IN n MS with
  fn's return, or FAILED with the reason and "nothing else was touched".
  Every run is journaled `{ ts, ms, name, ok, note }`, newest last, cap 200.
- `report()` / `journal()` - the last runs, for `/archivax journal`-style answers.

## rendering

If the host page already has `window.print(role, text, ...)` (LIA's line
painter), the herald uses it so lines look native. Otherwise it paints its
own `.entry > .msg > .lbl` lines into `#output` and scrolls. Pass
`forceLocal: true` to always self-paint.

## deliberately left out

- The op registry (`file/tag/untag/classify...`) - SIA's hands are her own;
  this chip is the voice, not the hands. Wrap any of her ops in `task()`.
- The `[[ARCHIVAX: ...]]` line-trigger that lets the agent order ops from
  inside a reply - needs her command lane; say the word and it follows.
