# MYTHOS BROWSER-VOICE - the free fallback mouth and ear (for the UI designer)

Zero dependencies, zero keys, zero billing. The browser's own
speechSynthesis talks, the browser's own SpeechRecognition listens.
Same honesty as every SIA chip: no engine, nothing speaks, and `speak`
says so. Nothing is silent.

## use

```html
<script src="mythos-browser-voice-standalone.js"></script>
<script>
  var bv = MythosBrowserVoice.client();
  print(JSON.stringify(bv.status())); // {tts, stt, voices}
  print(JSON.stringify(bv.voices())); // [{name, lang, local, def}]
  var r = await bv.speak("The designer has a voice now.", { voice: "Google US English" });
  print(r.receipt); // BROWSER-VOICE :: SPOKEN (28 CHARS)
  bv.hush(); // cancel the line at once
  var l = bv.listen({ onText: function (m) { if (m.final) print(m.text); } });
  print(l.receipt); // BROWSER-VOICE :: LISTENING (or NO LISTENER, loud)
  bv.unlisten();
</script>
```

## the contract

- `status()` names `{tts, stt, voices}` — call it first and route paid
  roads only when the free one answers false.
- `speak(text, {voice, lang, rate, pitch, volume})` cancels the old line
  and speaks the new one; resolves `{ok, receipt}` on end. Unknown voice
  names are refused LOUD with the name quoted; empty text is refused.
- `hush()` cancels at once. `speaking()` reads the engine flag.
- `listen({onText, onEnd, lang, continuous, interim})` streams
  `{ok, text, final}` partials; unsupported browsers get the loud
  NO LISTENER receipt through onText AND the return — typing still works.
- Fallback order for the designer: browser-voice first (free, instant,
  offline), Kokoro local second (free, neural, ~90MB fetch, slower than
  realtime), ElevenLabs / Gemini last (billed, keyed).
