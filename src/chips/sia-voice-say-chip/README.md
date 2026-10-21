# MYTHOS VOICE-SAY - the mouth over the two roads (for every SIA and LIA)

Origin: built 2026-10-05 over sia-voice-stream-chip + sia-voice-jitter-chip, splitting logic ported from the terminal's own voice.js chunk() (sentence pack) and truncate() (sentence-end cut). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-stream-standalone.js"></script>
<script src="mythos-voice-jitter-standalone.js"></script>
<script src="mythos-voice-say-standalone.js"></script>
<script>
  var vs = MythosVoiceStream.client({ sampleRate: 24000 });
  await vs.connect();
  var jb = MythosVoiceJitter.client({ sampleRate: 24000, sink: vs.feed });
  var mouth = MythosVoiceSay.client({
    voice: "af_heart",
    synth: async function (sentence, voice) { return kokoroPCM(sentence, voice); },
    sink: jb.push
  });
  jb.open("line-1");
  print(await mouth.say("The stream is live. Every chunk arrived before the sentence was finished.", "line-1"));
  mouth.stop("line-1"); // hushes her at the sentence, not the paragraph
</script>
```

No synth or no sink, nothing speaks and `say` says so. Nothing is silent.

## the contract

- `say(text, track, voice)` splits at sentence ends, packs short sentences into `chunkChars` pieces (default 220), synthesizes piece by piece through `synth(sentence, voice)`, and feeds each through `sink(chunk, track)` the moment it lands — so the first audio arrives after the first piece, not the whole reply.
- `synth` may answer Int16Array, ArrayBuffer, `{ pcm }`, `{ wav }`, or a wav `{ blob }` (44-byte RIFF header stripped, the terminal's own kokoro shape). Anything else, or an empty answer, aborts LOUD with the part number and everything fed so far.
- `maxChars` (default 0 = none) cuts long replies at a sentence end before speaking; word-cut replies carry the ellipsis and the receipt names the cut.
- `stop(track)` raises the hand: the in-flight piece finishes into the sink and nothing further is made. A stop on a quiet track is refused LOUD; a second stop is held, not an error. Saying on a track already speaking is refused LOUD.
- `split(text)` is the pure splitter for hosts and tests. `state()` names every track: active, parts, at, fed, cut, error.
- Honesty: a synth already running cannot be cancelled from outside — stop lands at the piece boundary, which is the whole reason pieces are short.
