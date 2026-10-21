# MYTHOS VOICE-STREAM - the chunk player and the wav packer (for every SIA and LIA)

Origin: ported 2026-10-05 from scratch/wavtools (WavStreamPlayer + WavPacker + stream_processor worklet, proven in the terminal voice lane). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-stream-standalone.js"></script>
<script>
  var vs = MythosVoiceStream.client({ sampleRate: 24000 });
  await vs.connect();
  var buf = vs.floatTo16(new Float32Array([0, 0.5, -0.5]));
  print(vs.feed(buf, "line-1"));
  print(await vs.offset());
  var wav = vs.pack(24000, { bitsPerSample: 16, channels: [new Float32Array([0, 0.5])], data: new Int16Array([0, 16384]) });
  print(wav.duration);
  vs.release();
</script>
```

Stubbed (tests, no speakers):

```html
<script>
  var vs = MythosVoiceStream.client({ sampleRate: 24000, makeContext: fakeCtx, makeNode: fakeNode });
</script>
```

No context, nothing plays and `feed` says so. Nothing is silent.

## the contract

- `connect()` opens the AudioContext + worklet + analyser. Missing AudioContext or worklet load is refused LOUD.
- `feed(pcm16, trackId)` queues one Int16Array/ArrayBuffer chunk past the play point. Empty chunks, wrong types, and feeding before `connect()` are refused LOUD. Feeding an interrupted track is refused LOUD.
- `offset()` reports the sample-accurate play head `{ trackId, offset, currentTime }`. `interrupt()` reports it and retires the track, so the next chunk keeps its place instead of talking over the old line.
- `floatTo16` / `merge` / `pack` are the pure road: Float32 to PCM16, buffer join, and RIFF wav Blob (`audio/wav`). Bad shapes throw LOUD.
- `state()` names connected/sampleRate/live/interrupted. `release()` closes everything and is safe to call twice.
- Seams: `sampleRate`, `makeContext(sr)`, `makeNode(ctx, name)`, `workletSrc`. The worklet source ships inside via `worklet()`.
