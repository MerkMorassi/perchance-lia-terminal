# MYTHOS VOICE-EAR - the ear that hears him over her (for every SIA and LIA)

Origin: built 2026-10-05, barge-in rule ported from the terminal's own voice.js room meter (RMS threshold, quiet tail, unbroken-loudness ceiling). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-ear-standalone.js"></script>
<script>
  var ear = MythosVoiceEar.client({
    threshold: 0.02, hotMs: 400, quietMs: 350, maxMs: 45000,
    now: function () { return Date.now(); },
    onSpeech: function (info) { mouth.stop(info.track); player.interrupt(); }
  });
  ear.watch("line-1"); // her turn starts, the ear opens
  setInterval(function () { ear.sample(roomRms(), "line-1"); }, 60); // ~16Hz, the terminal's own cadence
  ear.ignore("line-1"); // her turn ends, the ear shuts
</script>
```

No watch, sampling is refused. Nothing is silent.

## the contract

- `watch(track)` opens the ear for her turn. `sample(rms, track)` feeds one 0-1 room reading. Sustained loud past `hotMs` (default 400) fires `onSpeech` once with `{ track, loudMs, rms, fires }` — a blip never fires.
- After firing, the ear holds until the room goes quiet past `quietMs` (default 350) before it can fire again, so one utterance raises one hand.
- Unbroken loud past `maxMs` (default 45000) stands the ear down — a fan is not a turn — and re-watching is the only way back.
- `ignore(track)` shuts the ear; twice is held, not an error. Sampling a shut or never-watched track, or a non-number level, is refused LOUD. A throwing `onSpeech` is reported LOUD.
- `state()` names threshold/hotMs/quietMs/maxMs and every lane: open, fired, stoodDown, fires, lastRms.
- Honesty: this chip measures the room, nothing else. Her own voice through the speakers reads as loud — the host holds half-duplex (hers, then his) or echo-cancels the capture, exactly as the terminal does. Feed it her own line and it will dutifully report him.
