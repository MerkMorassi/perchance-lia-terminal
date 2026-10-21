# MYTHOS VOICEBRIDGE - her playback isolated, his words transcribed, one speaker at a time (for ANY host)

The Agentic Voice Bridge in three pieces: a cable map (his setup, once),
FasterWhisper ears (a small server on his machine), and a Turn Controller
lane in this terminal. Together: she never hears herself, only final
segments are ever logged, and the next agent speaks exactly when the floor
frees.

## 1. THE CABLE MAP (his machine, once, by hand)

Install VB-CABLE (free Windows driver), then:

```
her playback / system sound  ->  CABLE Input      (what she says goes here)
this server --device "CABLE Output"               (hears ONLY her playback)
your microphone stays the default input           (hears ONLY you)
```

No recursive loop is possible: her line and his line are different wires
before any software runs. Verify: play music, watch the server log stay
silent; speak, watch FINALS print.

## 1b. THE BROWSER TAP (Windows, for the on-page meter)
The same cable feeds this page's own meter - no second driver, one routing:

```
system / stream audio  ->  CABLE Input       (Windows sound settings,
                              per-app output or the default playback device)
this page METER MIC    ->  CABLE Output      (the browser sees it as a
                              standard microphone through getUserMedia)
```

Press METER MIC in the DUET panel: the page asks for the microphone once
and prefers an input named CABLE Output when one exists, otherwise the
default input. Nothing opens unasked; denial is shown on the indicator.
Metering is native Web Audio throughout: an AudioWorklet
(src/js/avb-worklet.js) runs on its own audio thread, inspects every
sample, computes peak / peak-hold / RMS / clip plus a K-approx weighted
energy and a 4x-interpolated true-peak estimate inside the worklet, and
posts ~30 times per second. The indicator shows the RMS body, instant
peak line, worklet peak hold, a clip LED (latches 1.5s), and the amber
VAD trigger line read live from the turn controller - over the amber
line is VOICE, under it past /turn silence ends the turn. LUFS* readout
(M momentary 400ms / S short-term 3s / I integrated with -70 absolute
and -10 relative gates) is marked with a star: the weighting is a 60Hz
high-pass plus +4dB shelf approximation of BS.1770, not a certified
meter. Targets follow EBU R128: -23 LUFS integrated, -1 dBTP max. The
mic/cable line also feeds turn.vadFeed directly, so gating follows the
metered signal; the demo feed never does (its silence is scripted).

## 2. THE EARS (one command, on his machine)

```sh
pip install faster-whisper sounddevice numpy onnxruntime
python3 fasterwhisper_server.py --device "CABLE Output" --model base
# MYTHOS VOICE BRIDGE v2 - http://127.0.0.1:8766/ - token: <printed once>
```

Windows: double-click `start-bridge.bat` (same thing: installs deps, runs
the server on CABLE Output, base model). Drop a shortcut to it in
`shell:startup` and it is simply on whenever the machine is.

- One utterance, one transcribe, one final: the energy gate opens on
  sound, blocks accumulate, and nothing is transcribed until the quiet
  after them lasts `--min-silence-ms` (default 900). Then the whole
  utterance goes to FasterWhisper once and a single final is emitted -
  never a re-emit per block, so the browser files one send per utterance.
- Silero VAD confirms real speech first (`faster_whisper.vad`, needs the
  onnxruntime package): a noise-only utterance is DROPPED with a VAD line,
  never transcribed, never hallucinated. Without onnxruntime the server
  still runs on the energy gate alone and says so (`--no-vad` forces it).
- Hallucination guards ride every transcribe: `vad_filter` (retried off
  if the VAD backend is missing), `condition_on_previous_text=False` (no
  looping), `no_speech` / `log_prob` / `compression_ratio` thresholds, and
  `--hotwords` (default `Patrikios Barbelo`) plus `--initial-prompt`.
- Knobs: `--gate`, `--min-silence-ms`, `--min-speech-ms` (shorter audio
  is never transcribed), `--max-utter-s` (forced transcribe), `--vad` /
  `--no-vad`, `--vad-threshold`. `/api/status` reports the VAD mode and
  the counts (utters, finals, dups, vad_drops, qdrops, faults).
- GPU: `--compute-device cuda --compute-type float16` (needs the CUDA
  build + cuDNN). CPU stays `cpu` + `int8`.
- Two sides, two servers: run one per cable with `--speaker NORA` and
  `--speaker LIA` (plus `--session nora-001`) - every final carries the
  speaker tag, which is the diarization until real diarization lands.

## 2b. THE INBOX (sessions become JSONL by themselves)

```sh
python3 fasterwhisper_server.py --model small --inbox ~/sessions --speaker NORA
```

- New audio in `--inbox` (wav natively; mp3/m4a/ogg/flac/opus via ffmpeg)
  transcribes to `<stem>.jsonl` in `--outbox` (default `<inbox>/done`),
  one line per segment:
  `{"session_id","segment_id","start_ms","end_ms","text","final","speaker"}`.
- The finished audio moves to the outbox beside its JSONL (raw kept by
  session ID, re-transcribable under better models later). Faults stay
  put with a `<stem>.err` note instead of looping forever.
- Live SSE finals carry the same fields (`sid`, `seg`, `start_ms`,
  `end_ms`, `src`) - the browser client ignores the extras, so nothing
  on the turn floor changes. Only final segments are ever emitted.
- Emits ONLY finals over `GET /events` (SSE) - partials are never sent,
  never logged, never stored. Each final is printed to stdout as it lands.
- `POST /api/transcribe` takes one-shot int16 mono bodies (capped 10MB).
- `GET /api/level` (token, `?lane=maya|patrikios`) reports the live tap per
  lane: capturing bool, rms + peak of the newest block, at ms.
- `GET /api/live?on=1|0` (token) opens/closes the server gate: held finals
  never transcribe while ARMED (counted as gated). The gate boots CLOSED.
- `GET /api/barb?on=1|0` (token) is the speaking lamp: the browser posts ON
  when her TTS starts and OFF when it stops. While lit (plus the tail),
  PATRIKIOS and MAYA utterances are DISCARDED, not queued - an audio window
  overlapping lamp-ON never transcribes. Every open/close lands in the
  session JSONL as `{"event":"gate","state":...,"reason":...,"t":...}`. A lamp
  ON past `--barb-max-ms` is forced OFF ("BARB lamp timeout") and the lanes
  reopen. No arg reads the lamp state back.
- `GET /api/status` (token) reports base URL (scheme included), gate state,
  per-lane open/capturing/tag, gated + unlabeled + barb_drops + barb_timeouts
  counts, the barb lamp (speaking/gated/mode/tail/max/callsign), session log path.
- Token order: --token, .env TOKEN=, the shared file, else minted once.
- HTTPS: `make cert` (trust cert.pem once in Windows), then
  `./start.sh --cert cert.pem --key key.pem` (or `make tls`) - the same
  console and SSE over https, so https pages reach it with no mixed-content
  fight. Plain HTTP stays the default for local runs.
- Lanes: `--device` is the MAYA lane (the call output); `--lane-patrikios`
  opens the PATRIKIOS lane (his mic, default closed; `--lane-merk` still
  works but prints a deprecation warning); `--tag-patrikios/--tag-maya`
  stamp SPK-PATRIKIOS/SPK-MAYA; `--session-log` appends every final as JSONL
  (t, session_id, lane, speaker, span, text) plus every gate open/close;
  `--require-speaker` drops untagged finals instead of stamping UNLABELED.
- Bleed guard: `--barb-tail-ms` (default 350 - lanes stay shut after lamp
  OFF, catching room echo), `--barb-max-ms` (default 60000 - stuck-lamp
  failsafe), `--gate-mode mute|duck` (default mute - duck drops mic gain
  30dB instead of gating STT, for later barge-in), `--barb-callsign on|off`
  (default on - she speaks "Barbelo:" first; the browser reads it from
  status on EARS OPEN).
- Same locks as the daemon: 127.0.0.1 only, bearer token (shares
  `~/.mythos_daemon_token` by default - one secret for both), `--no-mic`
  serves one-shots without opening capture.
- Open `http://127.0.0.1:8766/` for the little console (paste token, listen).
- Models: tiny < base < small (slower, sharper). Base is the honest middle.

## 3. THE CLIENT (any host page)

```html
<script src="mythos-voicebridge-standalone.js"></script>
<script>
  var ears = MythosVoiceBridge.client({
    base: "http://127.0.0.1:8766",
    token: PASTE_ONCE,
    hold: () => turn.sttHeld(),   // deaf while she speaks
    onFinal: (text) => turn.hearFinal(text, "bridge")
  });
  print((await ears.status()).receipt);
  print(ears.listen().receipt); // BRIDGE-EARS :: EARS OPEN ...
</script>
```

- `hold()` is the in-app half of the cable map: while it reads true,
  finals are DROPPED and counted, never filed. Point it at the floor.
- Anything arriving unmarked (`final !== true`) is dropped as a partial.
- `close()` reports filed / held / partials-dropped in one receipt.

## 4. THE TURN CONTROLLER (this terminal, src/js/turn.js)

`window.turn` owns when the next agent speaks: `request(who, fn)` takes the
floor (manual hands jump autonomous lanes), `release(who)` frees it and
triggers whoever is next, `sttHeld()` reads deaf-while-she-speaks,
`hearFinal(text)` files finals through the normal send or drops them loud,
`clear()` is the kill switch's radio silence. `/turn` says it all in words.

The autonomous lanes keep their own clocks in this pass - `request()` is
the plug point a lane fires through instead of on its own. Until a lane
adopts it, the controller arbitrates the voice path and reports the floor.

## deliberately left out

- No driver install from here - VB-CABLE is his hands, once, on Windows.
  Linux/macOS equivalents (PulseAudio null-sink, BlackHole) follow the same
  map: playback and mic must be different wires before software.
- One statement per line: the server emits text, never acts on it. Acting
  is the host's job (here: `turn.hearFinal` -> normal send -> her reply).
- FasterWhisper runs CPU int8 here - fast enough for finals, honest about
  it. GPU needs the CUDA build, his call, same script.
