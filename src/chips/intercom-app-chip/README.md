# SIA INTERCOM APP - push-to-talk radio with a real memory (for ANYONE)

Origin: the SIA house intercom page + `mythos-chatengine-standalone.js` (cut
2026-10-08, proven 16/16) + `mythos-intercom-standalone.js` (floor discipline)
+ `mythos-browser-voice-standalone.js` (his browser-voice chip, vendored
byte-exact — zero dependencies, zero keys, zero billing). App proven live in
this preview 2026-10-08 (CHIP SPEC v1).

## use

Open `index.html` in any modern browser (Chrome/Edge for the mic — the Web
Speech API is a browser feature, not ours). No build, no server, no keys.
The file is self-contained: all three chips are inlined, so it also pastes
straight into a perchance generator as one file.

- Hold PUSH TO TALK and speak, release — she answers. Or type below and send.
- Her reply reads aloud (untick `voice replies` to stay silent). Every line
  wears its speaker: `HITL:` the user, `GODDESS:` (or your agent name) the AI —
  in the log and across the transcript as she streams.
- The log under the transcript is the chat engine: every turn filed, newest 100
  painted, full history kept. Reload and it repaints.
- `Answer endpoint` — POST with `{ prompt, stream: true }`, reads `{ text }`
  (20s timeout, then line trouble, floor released). Speaks SSE
  (`data: {"token":"…"}` … `data: [DONE]`), NDJSON, or plain text chunks as
  they arrive — anything else falls back to one JSON `{ text }`. Empty runs the
  labelled DEMO ECHO (no AI spent, honest about it).
- `System instructions` + `LORE` live in settings and persist on-device: the
  system text replaces the house radio operator (blank = house default); lore
  pastes or loads from .txt/.md/.json (12k chars max) and rides every prompt
  inside a private `<LOREPACK>` block — grounding she never names. All settings
  persist across reloads.
- `Export log` downloads the `.jsonl`; `Import log` merges one back (dedupe by
  id); `Strike log` two-taps the whole thing away.

## the contract

Five files, nothing else (one self-contained page, three chips, one README). The three `.js` chips are byte-exact copies of their
ships — the app is only wiring (and `index.html` also inlines them, so the one
file runs alone anywhere):

- Floor: `MythosIntercom.client({ agent })` — `press("WAITING")` takes the
  floor (`HITL`), `release("HITL", text)` hands to the AI (`AI`), second press
  while busy refuses `LINE BUSY`. Half-duplex, like a real intercom.
- Memory: `MythosChatengine.client({ slot: "intercom_app_log", agentID:
  "SIA-001" })` — `remember` files both sides of every exchange; the prompt is
  `framePrompt(HEAD + RULES, stm(10), ltmBlock())` + the radio TASK, so she
  hears the last 10 turns verbatim and the older 40 compressed.
- Voice: his browser-voice chip — mic in via `bv.listen`, voice out via
  `bv.speak` (named voice optional, failures speak loud receipts into the
  transcript). The ear reports honestly too: a dead listener, denied mic, or
  silent mic names itself on release instead of a bare "nothing heard". Silent
  browsers skip speech, nothing throws. Any unhandled rejection lands in the
  transcript and releases the floor — the line never strands.

## deliberately left out

- No built-in brain — point the endpoint at your own backend (any POST
  `{prompt}` → `{text}`), or use the echo to test the line. That unlocks every
  model without shipping anyone's key.
- No server mirror, no bridge, no gallery, no journal — the engine log +
  export is the whole record. That unlocks a single file that runs anywhere.
- No mic on iOS Safari / insecure origins — the typed line is the fallback,
  by browser law, not ours.

## honesty note

The DEMO ECHO is not intelligence — it repeats your last line back so you can
prove the floor, the memory, and the voice path before spending a cent. The
log is append-only memory, not authority: export before striking, or the
screen is the only copy.
