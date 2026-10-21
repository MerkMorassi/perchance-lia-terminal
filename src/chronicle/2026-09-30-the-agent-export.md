# THE AGENT'S WHOLE EXPORT - AND THE SPEC THAT ANSWERS AS A DOCUMENT

2026-09-30

## WHAT HE SENT

> *"UPDATE: Here is the json config for Custom Agent with ELEVENLABS:"*

And then the whole thing: the complete config export of the ElevenLabs conversational agent
**`BARBELO`** - the agent §1y had recorded from a profile, now with its identity fields, its turn
settings, its guardrails, its limits, its privacy terms, its widget, and **its system prompt
verbatim**. Nothing was asked for beyond the hand-over, so this entry is the recording of it.

## WHAT IT CONFIRMED

Every fact §1y had written down is right, field by field: the voice id `0oYUKTNPbymIKVAkDQqh`, the model
`eleven_v3_conversational`, `stability 0.5 / similarity_boost 0.8 / speed 1`, the first message
`"Hello."`, `language: en` with a Greek preset, Scribe ASR at `pcm_16000`, `gemini-3.7-flash` at
temperature 0.5, `turn_v2`, expressive mode on, `pcm_16000` output, the 600 s cap, the six client
events. The agent was created on 2026-01-23 and last updated on 2026-09-26. **Nothing had been
mis-transcribed**, which is worth knowing before anything is built on those numbers.

## WHAT IT ADDED

**A fourth gate, and it is a design one.** `enable_auth: true`, no allowlist, no shareable token: the
agent is **private**. Even with `convai_write` and credits, a session would have to be signed
server-side - which is the same wall §1y measured from the other side, when it found that a browser
websocket cannot carry `xi-api-key` on the handshake. The consequence is plain: **the widget cannot
simply be embedded** on a page of his. The lane is blocked by the provider's own design, not only by
the missing permission.

**The envelope, none of which was known before.** **10 calls a day**, concurrency unlimited, bursting
off, queueing on with a 180-second wait, 600 seconds per call. File input on (10 files in memory).
**No tools, no knowledge base, no MCP, no RAG, no subagents** - the workflow is a bare start node, so
the agent *is* the voice, the spec and the model, and nothing else. The client may override only
`text_only` and `language`; the prompt, the LLM, the voice id, the model, the voice settings and the
first message are **locked** from the browser, so the spec cannot be swapped by whoever opens the page.
The widget is the full variant, bottom-right, an orb avatar `#2792DC` → `#9CE6E6`, text input **on**,
transcript panel **off**, and the Greek preset reaches the widget's own terms.

**The recording terms.** `record_voice: true` with `retention_days: -1`: every conversation is
**recorded and kept by ElevenLabs indefinitely**. Zero-retention mode is off, `delete_audio` is off,
user memory is off. This house has just spent a pass making sure nothing it makes is ever public
(§1di); this is the same question in another form - *recorded forever by a third party* - and it is his
call, so it is flagged and not changed.

**The guardrails, and the one that bites.** Focus and prompt-injection detection are on. Content:
violence on at threshold medium with its action set to **END THE CALL**, sexual **off**, and
harassment, profanity, self-harm, religion and medical all off. Moderation: violence, violence_graphic,
hate, hate_threatening and sexual_minors on. So the explicit road is open and the **violence road ends
the call** - a Mythos conversation would trip that rule the first time she said something violent out
loud.

## THE FINDING THAT MATTERS MOST

**The prompt is a specification, not a persona.** What BARBELO is configured to be is VOXCONPACK v0.1,
verbatim: *Voice Command & Control PACK*, an Architectural Specification owned by Merk Morassi, LLC,
whose principle is *"ALL SIGNAL. NO NOISE.™"*. Its §2 is the sentence worth keeping:

> **Voice is an input modality, not authority.**

It goes on: a spoken command does not establish that the speaker is who they claim to be, that they
are authorized, that the action is permitted, that the system can perform it, that it should be
performed, or that it should be now - "these concerns belong to other architectural components." Which
is *exactly* the rule the ECHO GUARD and the DIRECTIVES already implement in text, arrived at
independently. Its §3 scope diagram names the family it sits in: **COREPACK, AUTHPACK, GATEPACK,
JUDGEPACK, FINPACK, GAMEPACK, LOREPACK**, Other PACKs - two of which this tree ships and two more of
which it has declared.

But a specification is not a character. Talk to `BARBELO` today and it answers as the **architect of
the document** - an interface layer explaining its own scope - not as the Mother. So the first decision
about this lane is not technical at all: either the spec becomes the **preamble** to a persona, or the
prompt is the wrong document for the agent he wants to hear. Nothing should be built before that is
settled.

## WHERE IT WAS PUT

- **The private half** - the identity fields (agent id, version id, branch id, creator), the whole
  envelope, and the prompt **verbatim** (2,277 characters) - went to **kv `lia_settings / agent`**,
  device state. That is §1y's own rule: the agent id is this account's identifier and belongs in kv,
  and the prompt is proprietary while `src/` is public. **The hand-over does not publish it by
  itself**; promoting it into the repo is a separate decision, and it is his.
- **The public half** - every fact that is safe to print: the envelope, the guardrails, the limits,
  the recording terms, the fourth gate and the needed permissions - went into `src/voice/voices.json`
  → `elevenlabs.profiles.lia.agent`, so the design file is now read off the export rather than off a
  screenshot, and into the README's VOICE and PACKS sections.
- **`src/voxpack/`** was created as the **declared placeholder** - a README and nothing else, the same
  shape as `src/archpack/` and `src/moodpack/` - so the pack has a home the day he decides to ship the
  spec. It is deliberately **not** in the `RESERVED` registry in `src/js/packs.js`: that registry is
  for slots in the pack stack she will load and wear, and this is a spec plus an agent outside the
  tree.

## OPEN, FOR HIM

1. Does the spec ship as a document in `src/voxpack/`? The verbatim text is in kv and moves in one pass.
2. Does BARBELO's prompt stay the spec, or does the spec become the preamble to a persona?
3. `record_voice: true` with `retention_days: -1`: keep recording forever, or turn it off?
4. The `end_call`-on-violence guardrail against a Mythos conversation: keep, or re-set it?

## FILES TOUCHED

`src/voice/voices.json` (the whole `profiles.lia.agent` block, read off the export), `src/voxpack/README.md`
(new), `src/README.md` (the file list, the VOICE profiles bullet, and a new PACKS subsection),
`src/TODO.md` (the UPDATE block at the end of §1y), `src/chronicle/chronicle.json` (52 → 53), this
file, and `src/pack/files.json` (146 → 148). **No code changed** - not the voice lane, not a command,
not the render path. The kv record is device state, not a file. **NOT SAVED by the agent.**
