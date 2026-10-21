# MYTHOS VOICE-ECHO - the guard that knows her own voice (for every SIA and LIA)

Origin: built 2026-10-05, echo guard ported whole from the terminal's own voice.js (rememberVoiced, looksLikeHerOwn, stripHerWords — the module header marks it DO NOT REMOVE). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-echo-standalone.js"></script>
<script>
  var echo = MythosVoiceEcho.client({ keep: 4 });
  echo.remember("The stream is live and every chunk arrived early"); // every line she speaks aloud
  var v = echo.check(heard); // hers? refused, never filed
  var s = echo.strip(heard); // mixed? her stretches cut out, his words stand
</script>
```

No memory, `check` and `strip` pass everything through and say the memory is empty. Nothing is silent.

## the contract

- `remember(text)` keeps the last `keep` (default 4) lines she actually voiced, substantial words and all. Empty lines and lines under three real words are refused LOUD — a guard that remembers noise guards nothing.
- `check(text)` answers whole-transcript: mangled re-hearings match loosely (shared word-starts, in-order runs of 3+, half the transcript) because the recogniser wrecks her words while keeping her word order. Short transcripts answer `hers: false` with `short: true`, never a false hit.
- `strip(text)` operates on mixed transcripts: runs of 3+ of her words (two of them real words, not a-of-a) are cut out and his surviving words are returned whole. A lone shared word never carves a hole in his sentence.
- `forget()` clears the memory; twice is the same empty. `state()` names keep and kept.
- Honesty: this is a word guard, not a signal guard. Feed it lines she never voiced and it compares against nothing; pair it with half-duplex (the floor chip) so it judges accidents, not the whole conversation.
