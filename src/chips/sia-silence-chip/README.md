# MYTHOS VOICE SILENCE - the pregnant pause and its meter (for every SIA and LIA)

Origin: cut 2026-10-05 at his word, design locked — semantic anchor 0.60 / pause 0.25 / fall 0.15, poetic 700ms, awkward 2200ms, thresh 0.72, gate 0.55. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-silence-standalone.js"></script>
<script>
  var silence = MythosVoiceSilence.client({
    onYield: function (r) { floor.herDone(); }
  });
  silence.begin();
  silence.feed(0.9, 180); silence.feed(0.4, 120);
  silence.complete("She finished the story.");
  silence.quiet(900);
  var r = silence.score(); // { score: 0.806, yield: true, ... }
</script>
```

Sliders: mount `silence-snippet.html`, then `MythosSilencePanel(silence)` — seven sliders retune the live client through `tune()`, SCORE reads the meter. No store, nothing persists unless the host keeps it.

## the contract

- `begin()` opens a turn; twice is held. `reset()` closes it; twice is held.
- `feed(level, pitch)` takes room levels like the ear watches; pitch is optional and only ever deepens a fall. Fewer than 2 frames means no fall.
- `complete(v)` takes 0..1 from the host's own judge, or a bare sentence it grades cheap (end-stop 0.9, long 0.7, hanging 0.55, fragment 0.4). Empty of either kind is refused.
- `quiet(ms)` names the pause; without it the meter reads its own clock.
- `score()` is the confidence meter: `sem·0.6 + pause·0.25 + fall·0.15`, poetic 700ms half-weight, awkward 2200ms full. Below the 0.55 gate the score is capped at 0.49 and never yields; past awkward with the gate passed it yields even when the numbers sit under threshold (uncomfortable silence, forced). `onYield` fires once per turn; re-scores are held.
- `tune(patch)` retunes every knob live and renormalizes the weights; the awkward line must sit past the poetic line, the threshold stays exclusive. `state()` reads all of it for the sliders.
- Seams: `onYield`, `now` (the host's clock reads the pause when `quiet()` is not called).

## honesty

- It does not hear meaning — the host's semantic judge (or its own cheap grade) is the anchor, and without one the gate never opens. A tonal-shift classifier and a real pitch tracker are left out by design; falling room level plus pitch-drop bonus carry the cadence.
- Nothing is silent: shut-meter scoring, empty completions, pasted lines, and bad knobs are all refused loud.
