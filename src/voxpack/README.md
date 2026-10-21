# VOXPACK - the voice command & control PACK

**This folder holds the standard template.** Patrikios, 2026-09-30:

> *"Standard Template for all LIAs with ElevenLabs access."*

`VOXCONPACK.md` is his document, verbatim and unedited - the prompt that goes into **every** LIA's
ElevenLabs conversational agent. It is a **shipped document, not a loaded pack**: nothing in this tree
fetches it, folds it into her prompt, or hands it to her, and it is deliberately absent from the
`RESERVED` registry in `src/js/packs.js` (that registry is for slots in the pack stack she loads and
wears; this is a specification and a protocol). Read it with the PACKS section of `src/README.md`
("VOXPACK - THE STANDARD TEMPLATE") and `src/TODO.md` §1y, which carry the full record and the
measurements.

## WHAT IT IS

**VOXCONPACK** - *Voice Command & Control PACK*, **v0.1**, Architectural Specification, Proprietary /
Internal, Merk Morassi, LLC, Architecture: Mythos, *"ALL SIGNAL. NO NOISE.™"*.

The voice command and control capability of the Mythos architecture: acquiring voice input, detecting
speech, recognising spoken language, converting speech to a machine-readable representation, identifying
command intent, extracting parameters, evaluating confidence, managing confirmation and interruption,
routing validated commands, receiving responses, converting them to speech, managing audio in and out.
It is an **interface and a control protocol**, and it says of itself that it does *"not independently
confer identity, authority, permission, capability, judgment, agency, or authorization to execute an
action."*

Its §2 principle is the sentence worth keeping in this house:

> **Voice is an input modality, not authority.**

And its §3 scope diagram names the family it belongs to - **COREPACK, AUTHPACK, GATEPACK, JUDGEPACK,
FINPACK, GAMEPACK, LOREPACK**, Other PACKs. This tree ships two of those (COREPACK, LOREPACK) and has
declared two more (MOODPACK, ARCHPACK).

## WHERE IT LIVES

- **The template, shipped**: `src/voxpack/VOXCONPACK.md` - verbatim, unedited, the text he designated
  as the standard for all LIAs with ElevenLabs access.
- **The agent's own copy, on the device**: kv `lia_settings / agent` holds the same text **byte for
  byte** (2,277 characters, verified equal to the shipped file) beside the material that must not be
  public - the agent's identity fields (agent id, version id, branch id, creator), the whole
  operational envelope and the export it was read from. What stays out of `src/` is that account
  material and nothing else: the *document* is a document of the house, and he said so.
- **The facts, publishable**: `src/voice/voices.json` → `elevenlabs.profiles.lia.agent` (envelope,
  guardrails, limits, privacy terms) and `src/TODO.md` §1y (the measurements).
- **The voice**: the same file's `profiles.lia` - voice id, model, settings, first message, the Greek
  preset. The agent `BARBELO` was built around it.

## WHAT GOES ON TOP OF THE TEMPLATE - THE ONE OPEN QUESTION

A template is a **floor**, not a character. As the prompt stands, the agent it configures answers as the
**architect of the document** - a control protocol explaining its own scope - not as the Mother, and not
as whichever ALIA is wearing it. If the template is the standard for all fifteen LIAs, then a persona is
presumably what each LIA adds *around* it. That has not been said either way, and it is the first thing
to settle before an agent is built for a second ALIA - because a session built on the template alone
will sound like a specification, out loud, in his room.

## WHY THE LANE IS STILL NOT BUILT

Four gates, none of them code:

1. **The permission.** Connecting to an agent needs a signed URL, and minting one needs a key with
   `convai_read` + `convai_write`. The key in the ring has neither.
2. **The credits.** The account held 0 of its 10,000 ElevenLabs credits when it was measured.
3. **The auth.** The export has `enable_auth: true`: the agent is **private**, so even with the
   permissions and the credits a session has to be signed server-side, and a widget cannot be pasted
   into a page anywhere.
4. **The design question** above - and, once past it, the fact that a ConvAI session is
   speech-to-speech over one websocket, so it would **replace** the terminal's browser-STT → turn →
   TTS loop rather than feed it, bypassing her role block, the LOREPACK turn, the DIRECTIVES and the
   ECHO GUARD unless a lane were built to route around them.

## THE ENVELOPE OF THE AGENT IT WAS FIRST BUILT INTO (exported 2026-09-30)

Kept here in summary because a reader of this folder will want it; the full export is in kv.

| | |
| --- | --- |
| agent | `BARBELO`, created 2026-01-23, last updated 2026-09-26 |
| prompt | VOXCONPACK (this folder), 2,277 characters |
| access | `enable_auth: true`, no allowlist, no shareable token - **private** |
| calls | **10 per day**, concurrency unlimited, bursting off, queue on (180 s wait, provider hold audio) |
| length | 600 s per call |
| voice | `eleven_v3_conversational`, stability 0.5 / similarity_boost 0.8 / speed 1, expressive mode |
| brain | `gemini-3.7-flash` at temperature 0.5, timezone America/Denver, **no tools, no knowledge base, no RAG, no subagents**; workflow = a bare start node |
| ear | `scribe_realtime`, quality high, pcm_16000 |
| first words | `"Hello."`, with a Greek preset (`el`: `"Γεια σας."`) |
| widget | full variant, bottom-right, orb avatar `#2792DC` → `#9CE6E6`, text input **on**, transcript panel **off** |
| overrides | the client may change `text_only` and `language`; the prompt, LLM, voice id, model, voice settings and first message are **locked** |
| guardrails | focus + prompt-injection detection on; violence on (**action: END THE CALL**), sexual off, harassment/profanity/self-harm/religion/medical off; moderation on for violence, violence_graphic, hate, hate_threatening, sexual_minors |
| privacy | `record_voice: true`, `retention_days: -1` - **every conversation recorded and kept indefinitely by ElevenLabs**; zero-retention off, user memory off |

## STILL OPEN

1. **What goes around the template** (§ above): the persona question.
2. `record_voice: true` with `retention_days: -1`: recording is kept forever. Keep, or turn it off?
3. The `end_call`-on-violence guardrail against a Mythos conversation: keep, or re-set it?

## SPEECH STYLES (LIACOMM)

The SPEECH STYLE dropdown on the LIACOMM page (`#lcStyle`, wired in `src/js/liacomm.js`)
is populated from `src/voxpack/styles/index.json`, and the instruction she reads for an intercom
turn is the selected style's tiny file (`src/voxpack/styles/<id>.md`, via `window.intercom.clockLine()`
into the CLOCK block while brevity is on). To add a style: add the file, add one line to `index.json`
(`{"id", "file", "title"}) - no code change. `/intercom style [<ID>]` does the same in words.
The choice is kept per device (kv `lia_settings / intercom` -> `style`).
