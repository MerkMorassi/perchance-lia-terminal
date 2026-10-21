# MYTHOS KOKORO - the local voice: neural speech with no key, no bill, no network after the model (for every SIA and LIA)

Origin: ported 2026-10-05 from src/js/kokoro.js (worker engine, roster, pick, say, release). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-kokoro-standalone.js"></script>
<script>
  var voice = MythosKokoro.client({});
  print(voice.supported() ? "can run here" : "not on this browser");
  await voice.warm();                                  // one 90MB fetch, then local forever
  const clip = await voice.say("Hello, love.", "af_heart");
  player.src = URL.createObjectURL(clip.blob);         // 16-bit WAV, 24kHz
</script>
```

No options passed, the shipped model/dtype/device stand in. `design` overrides shipped settings; `cdn`/`model` override where the engine and weights come from; `voices` injects a roster map for testing the pick logic without the download.

## the contract

- `supported()` — WebAssembly + module worker + blob URL, honestly answered before anything is fetched.
- `warm()` / `load({ dtype, device })` — fetch once (~90MB q8), then everything runs on this machine; concurrent callers share one flight. `ready/loading/state` report (device, dtype, ms, threads, voiceCount, progress, last say).
- `roster/female/ids/name/pick` — the model's own list with grades, A-grade first; `pick` takes a name, an id, or the start of one (female wins ties).
- `say(text, voice, { speed })` — one `{ blob, secs, ms, voice }`; auto-loads if needed; ceiling documented in the host (`maxChars` stays host-side).
- `stop()` abandons the wait, keeps the warm model; `release()` terminates the worker and drops the 90MB.
- The model runs in a worker built from a string — inference never blocks the page, and there is no file for an in-app browser to fail fetching.

## deliberately left out

- Voice assignment per role and device state — `voice.js` owns that here; the chip takes a voice per call.
- Playback, queuing, ducking — the host plays the blob.
- The 90MB weights and the esm.sh library — fetched once at `warm()`, cached by the browser.

## honesty note

Free and slow, stated not hidden: about half real-time on wasm, so this is the narrator and the audition room, not the conversation engine — the trade for speech that never leaves the machine.
