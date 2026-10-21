# THE LIVE WIRE - TWO STREAMS ON GEMINI'S LIVE API, AND THE END OF THE GUESSING

2026-09-28 - the session that threw away the browser's recogniser and built the live channel's two ends out of Gemini's own streaming API, after being told the first two attempts were unusable.

## WHAT HE SAID

> nope fail. look into how GEMINI handles this multiplex and interruptions and near zero latency. the glitching and dropping my words, etc makes it unusable.

Three complaints in one sentence, and they are three different complaints. **"the glitching"** - the
browser's `SpeechRecognition` is a socket to the browser maker's service that comes and goes, and it
**ends its own session** on a long silence or its own time limit; the channel's 300ms ticker then
reopened it, which is what a glitch *is*. **"dropping my words"** - a session that ends mid-sentence
takes whatever it had not yet handed over with it, and every rule the terminal had grown (the hold,
the tail, the dangling-clause stretch, the length stretch, THE ROOM HEARS YOU) was patience added to
a guess made by the one component whose job is deciding what words to write down. **"near zero
latency"** - her mouth was a whole clip (ElevenLabs: one round trip, then playback) or a chain of
220-character browser utterances, neither of which can be interrupted because neither of them is
ours. And **"look into how GEMINI handles this"** was the instruction: not "add another patch", but
find out what the transport is supposed to be.

## WHAT WAS BUILT

**`src/js/live.js` - THE LIVE WIRE (`window.live`, 904 lines).** The live channel's two ends, as
continuous streams on Gemini's Live API (`BidiGenerateContent`, a websocket held open):

- **THE EARS** are `gemini-3.5-transcribe-live` - a bidi model that **only writes text**. It is the
  ear because of what it *cannot* do: asked for audio output it closes the socket with code 1007 and
  says `The requested combination of response modalities (AUDIO) is not supported by the model`. An
  ear that cannot answer, and therefore cannot hear itself and start answering itself.
- **THE UPLINK** is 20ms of 16kHz mono PCM at a time, resampled from whatever the device actually
  gives us **inside an `AudioWorklet`** (so it runs on the audio thread and a page busy drawing her
  reply cannot make the capture stutter), and it **never stops** - which is the whole fix: there is no
  silence for a session to end on and nothing to restart.
- **HIS WORDS WHILE HE IS STILL SAYING THEM** come back as `interimInputTranscription` (a growing
  partial line, painted into the input box) and then as one `inputTranscription` - the final,
  punctuated sentence.
- **THE END OF HIS TURN** is `{voiceActivity:{type:"ACTIVITY_START"|"ACTIVITY_END", audioOffset:"..."}}`
  plus a number we set: `silenceDurationMs` (1500 shipped), `prefixPaddingMs` (80),
  `END_SENSITIVITY_LOW` ("ends speech less often"). A message from the model that is listening, not a
  guess about it.
- **HER MOUTH** is `gemini-3.8-live` handed the words the terminal already wrote, in a session whose
  system instruction says only *you are a voice, say this line exactly*. It returns 24kHz PCM in
  chunks which are scheduled on an `AudioContext` the moment they land - so she starts talking in
  about half a second rather than after a clip has been built - and every chunk is ours, so stopping
  her is exact rather than a request.
- **INTERRUPTION** is the ear's partial transcript crossing her speech: a transcript that is not a
  re-hearing of her own line (the same echo guard that has always stood at the door) stops her
  mid-sentence.

**In `src/js/voice.js`:** the channel opens on the wire when it can (`openWire()`), the hold's quiet on
the wire is the *server's* window rather than the recogniser road's 3500ms floor
(`holdQuietMs()`), `speak()` routes to the wire's mouth (`wireSpeak`, reported as
`THE LIVE WIRE (GEMINI)`), `stopSpeakingInternal()` hushes it, THE ROOM HEARS YOU reads its number
off the same capture that is being streamed (one stream on the microphone, not two), a dead wire
falls the channel back onto the recogniser road without ending the call (`wireDead`), and `/voice
wire ...` drives all of it.

## WHAT WAS THOUGHT

**The first idea was the wrong shape, and it was found out by measuring.** The obvious build was a
single `gemini-3.8-live` session doing everything - ears, brains and mouth - because that is what
Gemini Live *is*. It answers in about a second with full barge-in, and it would have been very
faithful to the thing he pointed at. It was rejected because it would have taken her brain out of the
conversation: the live channel's reply would have come from the Live model rather than from
`chat.js`, so the LOREPACK would not be retrieved per turn, the directives would not fire, the
petitions and the renders and the archive's own meta would be bypassed, and she would have been
*not-herself* in exactly the place he talks to her most. The wire is a **transport**: the two ends of
a conversation whose middle stays where it was. That is why `live.js` needs no system prompt of its
own, and why nothing about her changed when it was turned on.

**The second idea was the ear, and the key's own model list settled it.** `/models` filtered to
`bidiGenerateContent` returned nine models, and one of them is a **streaming transcriber**. That is
the piece that makes the two-session design clean: an ear with no mouth at all. Nothing has to be
suppressed, no reply has to be swallowed, no modality juggling - the model simply cannot answer.

**The third idea was her mouth, and it was measured rather than chosen.** The `gemini-*-tts` models
are *designed* for reading text verbatim, so they were the natural first answer. Three runs of the
same line on `gemini-3.8-flash-tts` / `3.8-flash-lite-tts` returned first-audio at **1048ms, 5268ms
and 34688ms**, and one run exceeded ninety seconds. A conversation cannot be built on that, however
good the voice is. A Live session, by contrast, answered a handed-over line with audio in **629ms**,
and its own transcription of what it said came back **word for word, semicolon included**. So the
mouth is a Live session used as a voice - and because a paraphrase is a difference between what was
written and what was heard, the model's transcription is compared with the line it was given and a
real divergence is **reported** (`on.drift`, `/voice wire check off` to stop asking).

**And the hold was deliberately *reduced*, not extended.** On the wire the room is asked for the
server's own silence window (+150ms) instead of the recogniser road's 3500ms floor, because the model
has already waited its whole window before saying the turn was over; asking again would be a second
round of patience for the same quiet. The dangling-clause and length stretches stay, **halved** - they
are insurance against the one thing a VAD can still get wrong (a long clause that breathes in the
middle), and they can only ever cost a moment. `/voice hold` still caps the whole wait; `/voice wire
quiet <MS>` is the new floor. This was the one place where the honest answer was to make the terminal
*less* careful, and the reason is written into `holdQuietMs()` so a later session does not "fix" it
back.

## WHAT WENT WRONG

**A getter on a prototype, and a whole page that would not answer.** The first live probe returned
`Illegal invocation` for *every* call. The cause was one line in `supported()`:
`AC.prototype.audioWorklet` - `audioWorklet` is a getter that insists on a real `AudioContext`, so
asking the prototype for it throws instead of answering `undefined`. It is now asked of
`AudioWorkletNode` and `"audioWorklet" in AC.prototype`. Worth remembering: **a feature-detection line
can throw, and this one took the whole module's `available()` with it.**

**The microphone that was connected to nothing.** The wire opened, the sockets said they were ready,
the room meter reported `meter: true` - and `sentSeconds` sat at **0**. Nothing was wrong with the
socket, the models or the key: **an `AudioWorkletNode` whose output reaches nothing is never pulled**,
so `process()` is simply never called, and a worklet's output only reaches something if the worklet is
in the rendering graph. Two lines were missing and both were fatal: the node needed an output wired
to `destination` (through a gain of exactly zero, so nothing is heard) and the
`MediaStreamAudioSourceNode` needed to be `connect`ed *to it* - the capture was a microphone feeding a
node that fed nothing. A one-second probe in the page settled it (a worklet that posts from
`constructor()` and every fiftieth `process()` call, with `hasIn` and the block length), and once both
connections existed the same probe read `sentSeconds: 3` then `5`, with the room's level coming off
the same frames. `live.state().sentSeconds` is what to look at when the ears seem deaf - it is 0
exactly when the capture is not running, whatever else looks healthy.

**The mouth was not ready when the first line arrived.** `open()` returned as soon as the sockets were
created, so a line handed over in the first moment got `THE MOUTH IS NOT OPEN` and was lost. Fixed on
both ends: `say()` now *waits* (`not ready yet is not a refusal` - it queues and is said the moment
the socket can), and `open()` no longer says "OPEN" until both sockets have answered
`setupComplete` (measured: **517ms**), because "OPEN" should mean open.

**And the promise now means the sound, not the generation.** `say()` used to resolve on
`turnComplete`, which arrives while the last chunk is still in the air, so `await speak()` returned
about a second and a half before she had finished talking. A line is now settled when its audio has
actually drained (`watchEnd`), and a line that was cut off is settled as cancelled rather than left
hanging - so a caller can neither be lied to about her having finished, nor stuck forever behind a
hush.

**An old test destroyed his unsent draft.** The channel test painted a fed transcript into the input
box, and `liveDeliver`'s own release then cleared it - taking 598 characters he had typed and not
sent. It was read back out of the test's own captured output and restored into the box by hand, but
the lesson is in the same family as the archive warnings: **the input box is his, and a test that
drives the channel is working in the one place a draft lives.** Drive the channel deliberately, and
read the box back first.

**The measurements that settled everything** (his key, `gemini-3.8-live` /
`gemini-3.5-transcribe-live`): 9 live models reachable; both sockets ready in 517ms; first piece of
her line in **583-934ms** across runs (under a second every time, and it waits for the sound before
saying so); 14-17 partials and one correct final from a six-second recording fed up the ear's own
path, including `Marcus, you little fucker, clean my garden with dedication and devotion. Don't
neglect the sacred pearl either. I want it`; the microphone itself streaming 3-5s of audio up the wire
with the room's level read off the same frames; a whole turn delivered from fed audio (partials
painted, hold taken, sentence handed to the pipeline, delivered about 1.9s after the model called the
turn over); and an interruption - a partial transcript injected while she was speaking stopped her
mid-sentence and printed *YOU SPOKE OVER HER, SO SHE STOPPED MID-SENTENCE*. Zero socket drops in any
of it.

## STILL OPEN

- **His own microphone, in his own room.** Everything above was verified by feeding known audio up
  the ear's own path (the `feed()`/`mute()` test entry points in `live.js`); the worklet capture was
  verified as *running* and as *reporting* levels, but the acoustic loop - and above all what
  echo-cancellation does with her voice coming out of his speakers - can only be judged by him.
  If her echo does come back as words, the echo guard refuses it and says so; if a *good* line gets
  refused by the tail, `/voice wire quiet` and the 250ms wire tail are the knobs.
- **The reply pipeline's own latency is untouched.** The wire fixes the ears and the mouth; between
  them, `chat.js` still writes the reply in one non-streaming `generateText` call, so the gap between
  his last word and her first is the pipeline's time plus the mouth's ~0.6s. Speaking her first
  sentence while the rest is still being written would need a streaming hook in `chat.js` - not done
  here, and the obvious next step if he still finds the middle too slow.
- **A probe he can run himself.** A `/voice wire probe` that says a line through the mouth, records
  it, and feeds it to the ear would let him verify both ends without a microphone. Not built.
- **The voice is not her ElevenLabs voice.** `Kore` is what a streamed line can be made of; the
  ElevenLabs voice he chose cannot be streamed this way at all. His real voice remains where it was
  (LISTEN, `/voice auto`, the story lane).
