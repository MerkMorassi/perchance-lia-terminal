# MYTHOS LANES - the two AI roads: hosted Groq and any local OpenAI-compatible server (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/groq.js (hosted chat + model roster) + src/js/local.js (LM Studio / Atomic Chat / any /v1 server, text + vision). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-lanes-standalone.js"></script>
<script>
  var lanes = MythosLanes.client({ store: kvStore, keyring: ring });
  print(await lanes.groq.words("models"));   // hosted roster, key from the ring
  print(await lanes.local.words("status"));  // is the LAN server answering?
  const r = await lanes.local.chat("Say hello", { images: [photoBlob] });
</script>
```

No store passed, base/model/key live in memory for the page. No keyring passed, the host's `window.keyring` stands in — Groq refuses loud without one, and the key itself always lives in the ring, never here. `fetchFn` overrides transport; `sampleFrames` overrides clip sampling for `see`.

## the contract

- `groq: { chat(text, opts), models(), model(), words(arg), help() }` — OpenAI-compatible hosted chat through the keyring's `groq` entry (`/chat/completions`, temperature + max_tokens). `words`: `status` (key alive?) · `test` · `models` (starred = in force) · `model [id]` · `chat <text>`.
- `local: { chat(text, opts), models(base?), model(), baseUrl(), words(arg), help() }` — any OpenAI-compatible `/v1` server. Base strips trailing `/v1` (set it bare); key optional, never printed; vision rides two roads (standard `image_url` parts, Atomic `multimodal_data` + `<__media__>` markers on 1337/atomic bases).
- `local.words`: `status` · `test` (10-token hello end to end) · `models` · `model [id]` · `base [url]` · `key [k]` · `chat <text>` · `see [question]` (picks a file; clips go as 4 stills — needs a picker and a sampler, refuses loud without them).
- Nothing throws across the lane boundary; refusals are sentences (no model set, server not reachable, keyring offline, no key held). HTTPS-page limit is honest: a plain-http LAN box is unreachable from a served page — tunnel it or serve local.

## deliberately left out

- Keys (the ring owns them), pixels-to-blobs (the host decodes uploads), the chat UI (lanes answer, they never speak first).
- localStorage mirror — persistence is the `store` adapter (`{ groq, local }` whole-record), memory when absent.

## honesty note

Two roads, not a brain: server paths (`models`, `chat`, `test`, `see`) need a live server and fail loud without one — everything provable offline (help, settings, refusals) is proven offline.
