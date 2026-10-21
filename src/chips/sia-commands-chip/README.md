# MYTHOS COMMANDS - the slash catalogue as a list (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/commands.js (clean/gloss/load/match/liaOf/block/listText). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-commands-standalone.js"></script>
<script>
  var cmds = MythosCommands.client({ list: commandList }); // inline array, no fetch
  print(await cmds.load()); // { ok, count }
  print(cmds.match("/show a red door").id); // show
  print(cmds.liaOf("/focus the loom")); // her kind, or null
  print(cmds.block()); // the catalogue she carries
</script>
```

Fetched instead (`fetchFn`, `manifest`), the same shape answers. Nothing is silent.

## the contract

- `load()` reads the list from the inline `list` seed or the `manifest` through `fetchFn`. Neither road is refused LOUD; a failed fetch reports its reason and keeps the old roster.
- `get(id)` takes `/id` or `id`, lowercased and cleaned. `match(text)` reads the leading token only. Absent is null — the honest answer for a lookup, not an error.
- `liaOf(text)` picks out the commands she answers herself. `block()` is the catalogue in prompt shape, `[YOURS]` marking his way of asking her.
- `gloss(c)` is one line per command: the list's own `short`, else the first sentence, never the wall of essays. `listText()` is the roster split MACHINE vs HERS.
- `status()` names loaded/count or the failure. `all()` returns a copy — the roster cannot be rewritten from outside.
