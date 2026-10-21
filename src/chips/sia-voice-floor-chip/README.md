# MYTHOS VOICE-FLOOR - who holds the line (for every SIA and LIA)

Origin: built 2026-10-05, floor ladder and gates ported from the terminal's own voice.js intercom (airState, canSpeak, canMic, the hush). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-floor-standalone.js"></script>
<script>
  var floor = MythosVoiceFloor.client({ onHush: function () { mouth.stop("line-1"); } });
  print(floor.herVoice()); // HER VOICE, the ears shut on their own
  print(floor.yourVoice()); // REFUSED - she has the floor
  print(floor.yourWords("wait, one thing")); // HELD, not lost
  print(floor.hush()); // she is silenced, his held words wait
  print(floor.takeHeld()); // taken the moment she is done
</script>
```

Nothing moving, the floor is STANDBY and everything is allowed. Nothing is silent.

## the contract

- The ladder reads HER VOICE > HER TURN > HOLDING > YOUR VOICE > STANDBY, the terminal's own order. `state()` names the air plus every holder and both gates.
- `herVoice()` takes the floor and shuts open ears by itself; `herDone()` gives it back and reopens them. `herTurn()` marks the making.
- `yourVoice()` opens the ears in STANDBY and closes nothing; while she speaks or her turn is being made it is refused LOUD with the reason. Twice is held, not an error.
- `yourWords(words)` speaks in the open air and queues while she holds the floor — talk-over is HELD, never lost and never colliding. `takeHeld()` takes the queue once she is done; taking while she speaks is refused LOUD.
- `hush()` silences her through the `onHush` seam, restores ears she shut, and leaves the queue standing. Hushing silence is refused LOUD; a throwing host is reported LOUD.
- Honesty: this chip holds the lock, not the audio. The host still stops the mouth, the player, and the recogniser — the chip only says whose turn it is.
