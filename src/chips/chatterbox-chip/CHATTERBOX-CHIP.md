# CHATTERBOX CHIP — HER OWN AUDIO CLIP IN HER SEED VOICE
Source: LIA TERMINAL story lane (src/js/story.js). Filed for ferry.

## 1. IDEA
She speaks a line in HER OWN voice: a seed voice-clone sample (her original
recording, kept in the vault) conditions a Chatterbox TTS Space, which renders
the text to a .wav that plays in the log and is kept as a clip. The sample IS
the voice — no sample, no her; the Space's own voice otherwise.

## 2. THE SPACE (HuggingFace, public — the sample leaves the device)
  BASE: https://resembleai-chatterbox.hf.space
  RENDER FN: generate_tts_audio  ->  POST /gradio_api/call/generate_tts_audio
  UPLOAD:    POST /gradio_api/upload  (FormData {files: blob}) -> [serverPath]
  QUEUE: join-then-listen (Gradio queue flow — /call shortcut 404s here).
  FALLBACK (CPU): https://olavaud-chatterbox-unlimited.hf.space (same shape).
  A held HuggingFace key rides along when present; anonymous works (measured).

## 3. THE CALL (params order matters — read off the Space's own app.py)
  [text, audio_prompt, exaggeration, temperature, seed, cfg_weight, vad_trim]
  defaults: 0.5, 0.8, 42, 0.5, false
  - text: ONE chunk, max 300 chars (the Space hard-truncates; chunk client-side).
  - audio_prompt: {path: serverPath} fileData of the uploaded seed sample, or
    null (Space's own voice).
  - seed FIXED (42 shipped) so multi-part renders sound like one performance.
    0 = new voice every call (do not use for her).
  - exaggeration 0.5 = expressiveness (extremes unstable); cfg 0.5 = how hard
    it follows the reference (lower = slower, more deliberate).

## 4. THE SEED SAMPLE (per agent — one sample per role)
  - A short clean recording of HER (10-30s, dry, no music): /story sample <ID>
    sets it for the role on stage; fallback '*' answers for roles with none.
  - Kept in the vault as a normal audio record; bytes re-read at render time,
    uploaded, used, forgotten — never cached on the server.
  - Refuse >40MB with the number, not silence.
  - chatterbox.js keeps: samples = {roleId: {blob, name}} + default.

## 5. RENDER FLOW (one text -> one clip)
  1. chunk text to <=300 chars on sentence boundaries (chatterbox.js does it).
  2. ensureRef(role): upload seed sample once per session, reuse path.
  3. join queue with params, listen on the session stream, parse SSE.
  4. collect result audio URL -> fetch -> Blob (.wav) -> play + keep as clip.
  5. Long text: render parts (max 2 ahead), play gapless in order.

## 6. SELF-PROMPTING (how SHE makes her own clip)
  Teach: "To speak aloud, end your reply with [[SAY: the exact words to voice]]
  (last line, alone). The lane renders the SAY text in your seed voice and
  plays it under your turn." Parse like [[VISION:]] (same regex family),
  strip from visible text, render via speak(). One SAY per reply.

## 7. FILES IN THIS CHIP
- chatterbox.js — drop-in vanilla module (samples, chunk, queue call, SAY parse)
- CHATTERBOX-CHIP.md — this file
