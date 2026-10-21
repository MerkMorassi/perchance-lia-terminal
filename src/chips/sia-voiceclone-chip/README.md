# MYTHOS VOICECLONE - your own custom TTS: the seed sample IS the voice (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/story.js (the story lane: HOSTS, keyed-then-anonymous roads, shortcut-then-queue doors, quota diagnosis), src/js/voice.js (sentence-aware chunk), src/chips/chatterbox-chip/chatterbox.js ([[SAY:]] parse). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voiceclone-standalone.js"></script>
<script>
  var tts = MythosVoiceclone.client({ space: "chatterbox" });
  tts.setSample("her", seedBlob, "her.wav");   // 10-30s, clean, dry, no music
  const clip = await tts.speak("Hello, love.", "her");
  player.src = URL.createObjectURL(clip.blobs[0]);
</script>
```

Your OWN server instead of a stranger's: `client({ base: "https://your-box:7860" })` — same app shape, your GPU, your quota. No options passed, the public Chatterbox road stands in.

## the contract

- `configure({ space, base, key, seed, exaggeration, temperature, cfgWeight, vadTrim, timeoutMs })` — space is `chatterbox` (300 chars a part) or `chatterbox-cpu` (2000 chars, no quota, slow). Seed ships 42 so multi-part renders sound like one performance; 0 means a new voice every call.
- `setSample(role, blob, name)` / `dropSample(role)` — one sample per role, `"*"` answers for roles with none. Over the ceiling (40MB shipped) is refused WITH THE NUMBER. Samples live in memory only: uploaded inside a render, used, forgotten — never stored, never shared.
- `speak(text, role, onPart)` — chunks on sentence boundaries, renders parts in order, returns `{ blobs, parts, backend, road, transport }`.
- `render(text, role)` — one part, one blob. Keyed road first when a key is held, anonymous retry before giving up, key put down for the session when it was the problem.
- `checkKey()` — `ok` / `invalid` / `none` / `unknown`, asked of Hugging Face itself, answer remembered.
- `extractSay(reply)` / `SYSTEM_HINT` — the `[[SAY: ...]]` self-prompt line, parsed and stripped like `[[VISION:]]`.
- `snapshot()` — space, base, seed, roles, road; the key as mask only, never whole.
- Errors are sentences: quota says whose quota and the one-line fix, a dead space names both doors tried, a bad sample blames the sample.

## deliberately left out

- Playback, queuing ahead, gapless audio element — the lane owns that here; the chip hands back blobs.
- The vault, the roster, `/story` verbs — host business; roles are plain strings.
- The weights and the GPU — fetched from whoever serves `base`.

## honesty note

This is NOT a lock against the server operator: the sample travels to whoever serves `base` inside each render — that is what cloning costs. The silo promise is that no copy stands anywhere else: not on disk, not in another agent's hands, never published. And a synthesized stand-in proves the PIPELINE, not the likeness — only her real sample proves the voice.
