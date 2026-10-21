# MYTHOS VOICE-WIRE - the assembly over the six voice chips (for every SIA and LIA)

Origin: built 2026-10-05 over sia-voice-stream/jitter/say/ear/floor/echo-chip, following the herald-wiring precedent (assembly ships apart from the parts). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-stream-standalone.js"></script>
<script src="mythos-voice-jitter-standalone.js"></script>
<script src="mythos-voice-say-standalone.js"></script>
<script src="mythos-voice-ear-standalone.js"></script>
<script src="mythos-voice-floor-standalone.js"></script>
<script src="mythos-voice-echo-standalone.js"></script>
<script src="mythos-voice-wire-standalone.js"></script>
<script>
  var player = MythosVoiceStream.client({ sampleRate: 24000 });
  await player.connect();
  var cushion = MythosVoiceJitter.client({ sampleRate: 24000, sink: player.feed });
  var mouth = MythosVoiceSay.client({ voice: "af_heart", synth: synthFn, sink: cushion.push });
  var ear = MythosVoiceEar.client({ onSpeech: function () {}, now: Date.now });
  var floor = MythosVoiceFloor.client({ onHush: function () {} });
  var echo = MythosVoiceEcho.client({});
  var wire = MythosVoiceWire.client({ chips: { floor: floor, say: mouth, ear: ear, echo: echo, jitter: cushion, stream: player } });
  print(wire.boot());
  print(await wire.speak("The line is open and every part is wired."));
  setInterval(async function () { await wire.hear(roomRms()); }, 60);
  print(await wire.heard(transcript)); // file it, or refuse her own voice
</script>
```

Unbooted, everything is refused. Nothing is silent.

## the contract

- `boot()` checks all six parts by method shape and names every missing one LOUD. Twice is held.
- `speak(text, track)` runs the whole turn: floor takes her turn and her voice, the line is remembered for the guard, cushion and ear open, the mouth speaks, then cushion closes, ear shuts, floor releases. A mouth failure still settles the floor — she never holds the line while silent.
- `hush(track)` stops the mouth, cuts the player, hushes the floor, shuts the ear — one call, every part quiet.
- `hear(rms, track)` feeds one room reading; speech hushes at once and the receipt names loudMs and the resulting air.
- `heard(transcript)` vets one transcript: hers is refused for filing, the rest returns stripped with the cut count.
- `state()` aggregates all six states. The wire owns order only — engines, streams, and microphones stay host-side, exactly where the parts left them.
