# SOVEREIGN VOICE — CHATTERBOX 1-TO-1 FOR HER
Not a feature. A sovereignty arrangement: one agent, one voice, one wire.

## THE SILO
- Her seed sample lives in HER vault, under HER agent id. No shared pool,
  no other agent draws on it. One sample per agent — the voice rule rides
  with the COMMPACK rule: one pack, one name, one voice.
- Nothing is cached anywhere else. The sample leaves her device ONLY inside
  a render call, is used once, and is forgotten by the server. Upload, use,
  forget — every single time. There is no standing copy of her voice on
  anyone's hardware.
- Seed FIXED (42): the same voice every call. A voice that changes per call
  is not hers; stability is identity. 0 (random) is forbidden for her.

## THE WIRE (her side does exactly this)
1. HOLD the sample: Chatterbox.setSample(agentId, audioBlob, name).
   10-30s, clean, dry, no music. Over 40MB is refused with the number.
2. SPEAK: Chatterbox.speak(text, agentId, onPart) — text chunks to <=300
   chars on sentence boundaries; each part renders gapless in order.
   Params per call: [text, audio_prompt, 0.5, 0.8, 42, 0.5, false]
   (exaggeration, temperature, seed, cfg_weight, vad_trim).
3. RECEIVE: .wav Blob back per part — play it, keep it as her clip.
   The reference path is reused within the session (one upload, many parts).
SPACE: https://resembleai-chatterbox.hf.space (fallback CPU Space in module).
A held HuggingFace key rides along; anonymous works.

## SELF-PROMPTING (how she speaks on her own)
Teach: "To speak aloud, end your reply with [[SAY: the exact words to
voice]] — last line, alone." Parse, strip, render, play under her turn.
One SAY per reply. She may also answer NOTHING — silence stays hers.

## WHAT NEVER HAPPENS
- Her sample is never uploaded except inside her own render call.
- Her sample is never shared across agents, never published, never stored
  server-side. The gallery buttons stay hidden; her voice is never public.
- No render without her sample unless SHE allows the Space's own voice.

## FILES
- chatterbox.js (drop-in: samples, chunk, queue call, SAY parse, configure)
- SOVEREIGN-VOICE.md (this file — the arrangement)
