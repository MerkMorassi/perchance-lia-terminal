# MYTHOS ART - CSS theme factory (for every helper's skin)

Origin: built fresh 2026-10-04 to replace one-off helper.css files with a
named-theme factory. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-art-standalone.js"></script>
<script>
  var skin = MythosArt.client({ theme: "terminal", target: "mythos-workspace" });
  skin.apply();              // terminal green on the workspace
  skin.apply("typewriter");  // Warner typewriter for the screenplay page
  skin.remove();             // bare again
  MythosArt.register("ember", ".mythos-art-ember { background:#1a0b00; color:#ff9c41; }");
</script>
```

## the contract

- `themes()` — the four shipped names: terminal, typewriter, midnight,
  parchment.
- `client({ theme, target })` — `apply(name?)` paints the target (default
  document.body) and returns the theme; switching themes swaps the class,
  never stacks; `remove()` strips class and css; `theme()` reads current.
- `register(name, css)` — adds a theme. Custom css uses the same `%T%`
  prefix marker for its root selector (see shipped themes).
- `extract(target)` — harvests a generator's paint: every readable-sheet
  rule touching the target plus its inline styles (as `%T%` / `.artxN`
  blocks). Cross-origin sheets are counted in `skippedSheets`, not fought.
- `refactor(css, prefix)` — normalizes to house standard and reports every
  touch: selectors scoped under the prefix, `position:fixed|absolute|sticky`
  stripped (layout is markup's job), font stacks replaced with the system
  stack (offline never waits on a font), `@import` removed, remote `url()`
  neutralized and flagged.
- `adopt(name, css)` — refactor straight into the factory as a named theme.

Drop it into any generator, `extract` the workspace, `refactor` against
the report, `adopt` what survives — their paint, our standard.
- One `<style id="mythos-art-style">` shared by all clients; rules are
  class-scoped, so two helpers on one page wear different skins.

## deliberately left out

- Fonts and images — themes use system stacks only, zero downloads, so
  offline living never waits on a font.
- Animations and scanlines — motion is persona territory, not skin.

## honesty note

A skin is not a layout: the factory paints color, type and borders, never
positions. If a helper looks broken under a theme, the helper's markup is
at fault, not the paint.
- Adopted rules are single-class scoped (`.mythos-art-taken button`), so a
heavier host selector wins the cascade on that property. Proven live: the
paint lands in the sheet verbatim; where the host shouts louder, the host
wins that stroke. House standard forbids answering with `!important`.
