# SMART SEND STILO chip v1.2.0

Drop-in pre-send workbench: STT stages here, never straight to chat. Pick the
stilo (instrument) — the tone follows — dress the draft, then SMART SEND.

## What it is

- ✏️ Pencil → plain · 🖊️ Pen → formal · 🗿 Chisel → terse
  ✒️ Fountain → devotional · 🪶 Quill → veiled tongue
  🤬 Filthy → profane (filthy utterances, allowed-words list only)
- Full polish bench stays manual: paraphrase, warm, sanitized musiki,
  sapphic, homeric, EN>AG, AG>EN, plus TRANSLATE (EN/AG/Modern Greek/TR/FR/DE).
- Markdown preview (aesthetic default), word count, voice fast-lane +
  hold-mic/30s-timeout toggles, [END] strip + force-stage.
- Filthy utterances: an editable allowed-words list (default: fuck, fucking,
  cock, cunt, arse, arsehole, ass, asshole). The profane tone may use ONLY
  those words — every other vulgarity is refused by instruction.
- Polish is a proposal, never an edit. Nothing sends while one stands.

## Contents

- `stilo-scribe.js` — IIFE, no imports. Sets `window.SmartSendStilo`.
- This README.

## Wiring

```html
<script src="stilo-scribe.js"></script>
<script>
const scribe = window.SmartSendStilo.createClient({
  prefix: "stilo", ns: "stilo",
  builtInChat: async ({ instruction }) => ({ text: await myLLM(instruction) }),
  translate: async (text, pair) => myMT(text, pair),
  onSend: (text) => submitToChat(text),
  notice: (text) => toast(text),
  onVoicePark: (auto) => maybeResumeMic(auto),
});
scribe.routeVoice(transcript, (short) => submitToChat(short));
</script>
```

`prefix` scopes DOM ids, `ns` scopes localStorage keys — two scribes coexist.
`builtInChat`/`translate` optional; unwired backends refuse loudly via notice.

## Use

- `open()` / `isOpen()` / `standing()` / `held()`
- `stageVoice(text)` — stages (appends) + opens; `[END]` tail stripped.
- `routeVoice(raw, pipeFn)` — `empty` | `piped` (fast lane ≤N words) | `staged`.
- `voiceOpts()` / `micHeld()` / `parkVoice(auto)` / `destroy()`.

## Laws & refusals

- Blank draft: POLISH/TRANSLATE/SEND refuse with a notice. Nothing sends.
- Standing proposal blocks SEND and re-polish until ACCEPT or DISCARD.
- Work buttons (POLISH/TRANSLATE/ACCEPT) lock + grey out while AI runs;
  the working button pulses, label static.
- `destroy()` removes the modal and its stored keys.

## Proofs (this build)

- parse: loads with zero console errors; `version === "1.2.0"`.
- live: staged long capture opens scribe, sets draft + voice tag, `micHeld()`
  true; SMART SEND delivers source text and clears hold.
- refusal: blank POLISH/SEND refused with notice; unwired backends refuse.
- idempotence: double load, double mount, double destroy — all clean.
- residue: after `destroy()`, no modal node, no `ns_*` keys remain.
