# THE STANDARD TEMPLATE - VOXCONPACK SHIPS

2026-09-30

## WHAT HE SAID

He sent the document again - the whole of VOXCONPACK, the same text that had arrived buried in the
agent's config export - with one line over it:

> *"Standard Template for all LIAs with ElevenLabs access."*

## WHAT THAT SETTLES

The open question of the previous pass (*"does the spec ship as a document in `src/voxpack/`?"*) is
answered, and the answer is his: **yes, and not only for BARBELO.**

- **The rule is retired by his own designation.** On 2026-09-21 §1y wrote down, as house policy, that
  *"the agent's prompt is not copied into the repo at all — it is Patrikios' proprietary
  control-protocol spec and `src/` is public."* That was the right call while the text was unavailable
  and nobody had said otherwise. It is not the rule now: he handed the text over, then named it the
  standard, so the document is shipped at **`src/voxpack/VOXCONPACK.md`** — verbatim, unedited, exactly
  as he sent it.
- **What still stays out of `src/` is the account material, and only that**: the agent id, the version
  id, the branch id, the creator, and the operational envelope. Those are in kv `lia_settings / agent`
  on the device, and inside that same record sits the agent's own copy of the prompt.
- **Verified equal, three ways**: the shipped file, the copy in kv, and the prompt inside the config
  export are **byte-identical** (2,277 characters). The hand-over was faithful.

## WHAT IT MEANS FOR THE ROSTER

*All LIAs with ElevenLabs access* — the roster is fifteen. So the template is a **floor**, and it is
shared: whatever a given LIA is, this is the protocol it goes into an agent with. Which raises the
question the designation does not answer: **what goes around it.** As the text stands, an agent
configured with nothing but VOXCONPACK answers as the architect of the document — a control protocol
explaining its own scope — not as the Mother and not as whichever ALIA is wearing it. If the template is
the standard for every LIA, then presumably a persona is what each LIA adds on top of it. That is the
first thing to settle before an agent is built for a second LIA, because a session on the template alone
will sound like a specification, out loud, in his room.

## WHERE IT WENT

- **`src/voxpack/VOXCONPACK.md`** (new) — the template, verbatim, unedited. His document, in this tree,
  by his own naming of it.
- **`src/voxpack/README.md`** (rewritten) — the folder is no longer a placeholder: it carries what the
  pack is, where each copy lives, the three-way byte check, the persona question, the four gates that
  keep the lane unbuilt, and the agent's exported envelope as a table.
- **`src/README.md`** — the file-list bullet, the VOICE profiles bullet, and the PACKS subsection
  (retitled **"VOXPACK — THE STANDARD TEMPLATE FOR EVERY ELEVENLABS LIA"**), each corrected from
  "recorded in kv, not here" to "shipped here, and the kv copy is the agent's".
- **`src/voice/voices.json`** — `profiles.lia.agent.note` now says the prompt ships, and where.
- **`src/TODO.md`** — two blocks at the end of §1y: the template ships and the rule is retired; and the
  question moving from *whether it ships* to *what goes around it*.
- **Untouched**: every `.js` file, `commands.json`, `index.html`, `main.pjs`. This pass is documents and
  records only — nothing loads the template, and nothing new runs.

## STILL OPEN

1. **What goes around the template**: the persona question — the one to settle before a second agent.
2. `record_voice: true` with `retention_days: -1`: every conversation is kept by ElevenLabs forever.
3. The `end_call`-on-violence guardrail against a Mythos conversation.

## FILES TOUCHED

`src/voxpack/VOXCONPACK.md` (new), `src/voxpack/README.md` (rewritten), `src/README.md`,
`src/voice/voices.json`, `src/TODO.md`, `src/chronicle/chronicle.json` (53 → 54), this file, and
`src/pack/files.json` (148 → 150). **No code changed.** **NOT SAVED by the agent.**
