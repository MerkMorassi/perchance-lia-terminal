# MYTHOS-VIMEO - vimeo ids, links and embed html in, player urls and responsive embeds out (for every SIA)

Origin: extracted from a Vimeo embed (Leon Lowman - Stroke of Luck, 561929365) —
its responsive 16:9 placement, player params and referrer policy — proven live 2026-10-07.

## use

```html
<script src="mythos-vimeo-standalone.js"></script>
<script>
  const vimeo = MythosVimeo.client({});
  const got = vimeo.parse("https://vimeo.com/561929365"); // { ok, id: "561929365", hash }
  const play = vimeo.playerUrl(got.id, { autoplay: 1, muted: 1 }); // { ok, id, url }
  const emb = vimeo.embed("561929365", { title: "Leon Lowman - Stroke of Luck" }); // { ok, id, url, html }
  frame.src = play.url; // or pin the url on the frame's board
</script>
```

House: the frame plays and pins player urls as ordinary https links; the chip is
the seam that turns anything Vimeo-shaped (bare id, watch link, channel link,
player link, full `<iframe>` embed) into one. Vaulted, not wired.

## the contract

- `client({ say })` — `say` hears refusal lines. Stateless: no store, no network,
  nothing kept. Pure statics need no client: `MythosVimeo.parse/playerUrl/embed/doc`.
- `parse(input)` — `{ ok, id, hash }`. Bare numeric id (6-15 digits), any
  `vimeo.com/…/<id>` link, `player.vimeo.com/video/<id>` link, or a full
  `<iframe …>` embed (its `src` is read and parsed again). Private-link `h` hashes
  are kept on the record. Anything else refuses loud, nothing guessed.
- `playerUrl(id | parsed, opts)` — `{ ok, id, url } | { ok:false, error }`.
  `https://player.vimeo.com/video/<id>?badge=0&autopause=0…`. `autoplay, muted,
  loop, title, byline, portrait` as 0/1 when given; `color` as hex (a leading `#`
  is stripped, garbage ignored); `app_id, player_id` passed through; `h` kept
  from the parsed input unless `opts.hash` overrides; `dnt` when given.
- `embed(id, opts)` — `{ ok, id, url, html }`. The extracted placement: a
  `position:relative` wrapper with `padding:<ratio> 0 0 0` (16:9 default, `4:3`,
  `1:1`, or a percent) holding an absolutely-positioned full-bleed iframe with
  `allow="autoplay; fullscreen; picture-in-picture; clipboard-write;
  encrypted-media; web-share"`, `referrerpolicy="strict-origin-when-cross-origin"`,
  and an escaped title. `opts.params` feeds `playerUrl`; top-level player keys
  work too.
- `doc(inner, title)` — shells embed html in a minimal black document for a
  sandboxed frame preview.
- `describe()` — one-paragraph summary for shelf readers and agents.

## deliberately left out

- No player.js API: play/pause/seek-by-script needs Vimeo's player script and a
  live player; the chip mints placements, not remote controls. A host that loads
  `https://player.vimeo.com/api/player.js` beside the embed gets the API unchanged.
- No oEmbed/metadata lookup: no network, no tokens, nothing to leak. Titles come
  from the caller (`opts.title`), never fetched.
- No watch-page framing: `vimeo.com/<id>` pages refuse frames, so the chip never
  emits them — only `player.vimeo.com` urls, which are built to be framed.

## honesty note

The chip parses strings, it does not verify videos: a well-formed id may point
at a deleted, private (without its `h` hash), or domain-restricted video, and the
player will say so, not the chip. Anyone reading the page can read every url —
they carry no keys, but private-hash links are bearer links: share them and the
video is shared.
