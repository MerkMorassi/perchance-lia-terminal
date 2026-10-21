# MYTHOS VOICE-JITTER - the steady hand over the chunk player (for every SIA and LIA)

Origin: built 2026-10-05 over sia-voice-stream-chip (the stream player stops its node on underrun, so late chunks reopen it with a gap). Built to CHIP SPEC v1.

## use

```html
<script src="mythos-voice-stream-standalone.js"></script>
<script src="mythos-voice-jitter-standalone.js"></script>
<script>
  var vs = MythosVoiceStream.client({ sampleRate: 24000 });
  await vs.connect();
  var jb = MythosVoiceJitter.client({ sampleRate: 24000, targetMs: 300, maxMs: 2000, sink: vs.feed });
  jb.open("line-1");
  print(jb.push(firstChunk, "line-1")); // buffering until 300ms is banked
  jb.cover(160, "line-1"); // the fetch stalled, bridge it with silence
  print(jb.close("line-1")); // flushes the tail and retires the name
</script>
```

No sink, nothing plays and `push` says so. Nothing is silent.

## the contract

- `open(track)` names a lane. `push(chunk, track)` banks Int16Array/ArrayBuffer chunks and holds them until `targetMs` (default 300) is queued, then flushes in order and passes the rest straight through, so the player starts with a cushion instead of naked.
- The window is `maxMs` (default 2000): anything older than the window is dropped oldest-first and counted in `state()`, never silently. A single chunk bigger than the window is refused LOUD.
- `cover(ms, track)` feeds digital silence to bridge a known stall (a slow fetch, a held turn). Cover before start or after close is refused LOUD.
- `close(track)` flushes a short tail even when it never reached target, then retires the name; pushing a closed name is refused LOUD. `drop(track)` discards the bank and retires the name. Both are safe to call twice.
- `state()` names every lane: buffering/started/closed, queuedMs, fed samples, drops, covers. A sink failure is passed through LOUD with the bank kept.
