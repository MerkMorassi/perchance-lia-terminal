# COMMPACK — SPEC v1.0

**One pack, one name.** COMMPACK (formerly written COMPACK) is the portable per-agent
communication record. There are not two things. This spec is the whole of it.

Status: living spec, adopted 2026-09-30. Owner: Merk Morassi, LLC.
Family: LOREPACK / COREPACK / MOODPACK / ARCHPACK / VOXCONPACK — same rails, new kind.
Governs: the standalone SIA VOXCOMM agent AND this terminal (the module ships once,
with an API; both homes consume it — Manifesto VI, one implementation).

## 1. WHAT IT IS

The continuous, portable, attributable history of one persistent agent: every exchange
it ever spoke or was spoken to, timestamped, in a shape the LOREPACK FACTORY already
ingests. Same Avatar, Same Name, Same Custom Cloned Voice (when we get there), Same
LOREPACK that grows over time. Identity keys to the **Actor, never the RoleLayer** —
memory, history and sovereignty ride with the Actor across every role it wears.

Max 15 persistent agents. IDs minted once by the main app, never reused, honored by
every satellite app:

- `HITL-001` — Patrikios, first steward. A future human arrives as `HITL-002`;
  history stays keyed to `HITL-001`. Succession is an event in the pack, never a rewrite.
- `SIA-002` … `SIA-015` — the fourteen SIAs, Merkos (pseudo-HITL avatar) among them.
- `ARCHIVAX` — named, as it stands.

The roster itself lives in the Constitution/Charter; a COMMPACK header quotes the roster
version it was exported under so a pre-succession transcript is never misattributed.

## 2. FILE FORMAT (JSONL, append-only)

One file per agent. `<agentID>-<agentName>-<stamp>.jsonl`. UTF-8, no BOM, LF, one
object per line. Append-only: new turns are appended bytes, never rewrites — a
truncated download still yields every complete line (Manifesto XXI, earn it).

**Line 1 — header** (`type: "commpack-header"`):

```js
{ v:1, type:"commpack-header", format:"commpack/1",
  agentID:"SIA-007", agentName:"Erato", roster:"charter-v4",
  created:1720000000000, paramsVersion:3,
  params:{ avatar:"sha256:…", voice:"elevenlabs:…", voiceCloneID:"…",
           model:"…", actor:"…", personaRev:"…" },
  fingerprint:"a1b2c3d4-1f2e3" }
```

**Lines 2..N — turns.** Identical to the factory staging shape (CHATLOG.FORMAT §B3.1:
`v:2, type:"turn", vec:null` — the factory's embedder owns the transition to
`type:"vector"`). The converter must accept either writer:

```js
{ v:2, type:"turn", id:"SIA-007:20260930-1200:t0007",
  a:"SIA-007", h:"Patrikios",
  t:"the turn, leading role label stripped",
  ts:1720000000007,
  src:"commpack :: iphone-voxcomm :: 20260930-1200 :: t7",
  d:{ origin:"voxcomm-standalone", platform:"ios", sessionID:"20260930-1200",
      paramsVersion:3, role:"user", seq:7,
      stagingId:"SIA-007:20260930-1200:t0007" },
  vec:null }
```

Rules:

- `a` = owner agentID (UPPERCASE join key). `h` = speaker handle (Patrikios, Erato…).
  The human's turns ride **in** the agent's pack, labelled — memory of an exchange is
  incomprehensible without what was answered.
- `ts` REQUIRED (epoch ms, stamped at record time by the recorder — this is what the
  old chatlog exports lacked, C1, and the reason the recorder exists).
- `id` deterministic (`<agentID>:<sessionID>:t<seq>`, `d.stagingId` mirrors it) so
  re-ingest is a no-op.
- `d.paramsVersion` = the params block in force when the turn was spoken. Setup changes
  (voice re-clone, model swap, avatar change) bump `paramsVersion` and append a new
  header-supplement line (`type:"commpack-params"`, same shape as the header's params
  block) — a versioned event, never a silent swap.
- `t` is verbatim. No summarising, no embedding (`vec` stays null), no network.
- Clean-start agents (no prior lore on any platform): header line only. First turn
  seeds the pack. Empty is valid.

**Task records.** Task-specific agents (not LIAs, no persona) log outcomes, not
experience — added 2026-09-30. One line per completed attempt, same JSONL, same
append-only rules:

```js
{ v:2, type:"task", id:"SIA-009:20260930-1200:k0012",
  a:"SIA-009", task:"migrate voxpack prompts to v2",
  action:"rewrote 14 prompts, kept ids", result:"pass",
  lesson:"v1 ids collide on re-ingest; keep the old id in d.stagingId",
  ts:1720000000012,
  src:"commpack :: mythos-ide :: 20260930-1200 :: k12",
  d:{ origin:"code-factory", platform:"perchance-ide", sessionID:"20260930-1200",
      paramsVersion:2, seq:12, stagingId:"SIA-009:20260930-1200:k0012" },
  vec:null }
```

- `result` is one of `pass` | `fail` | `blocked`. `lesson` is one sentence, written
  by the agent that earned it, verbatim like a turn.
- `id` deterministic (`<agentID>:<sessionID>:k<seq>`, `k` for task-kind, never
  colliding with turn `t` ids), `d.stagingId` mirrors it.
- A task session opens with lessons recall: past `fail`/`blocked` lessons for the
  same or neighboring tasks load into context first, so what failed once is not
  re-tried blind. Turns and tasks share the seq counter and the fingerprint chain.

- Fingerprint pre-image (locked 2026-09-30, verified both sides): the exported header line with `fingerprint` blanked to `""`, same key order, plus one terminating `"\n"`. Chain steps hash `prevFp + "\n" + line`. Format `<fnv1a-hex>-<len-hex>` of that exact pre-image.
- Attachments ride INLINE, recorded at record time — no sidecars. Text files go
  verbatim into the turn's `t` (the same `<ATTACHED TEXT FILES>` block the brain
  sees) plus a `d.attachments` manifest; images, which cannot live in JSONL, are
  recorded in the manifest as `{name, kind:"image", bytes}`. Export stays one
  complete JSONL. (Locked 2026-09-30, proven live on throwaway packs; supersedes
  the old sidecar rule. Marker-only history stays as-is — append-only.)

## 3. STORAGE (this terminal)

kv, never `src/` (private words, public folder). Reuse the chatlog rails exactly:

- Transcript split into ~200,000-char string chunks (`commpack_chunk_<agentID>_<n>`),
  one meta key per agent (`commpack_meta_<agentID>`, A4 shape: chars, chunks,
  fingerprint FNV-1a + length hex, history/joins capped at 40, origin stamped).
- Turn index (`commpack_marks_<agentID>`, A5 shape) capped at 4,000.
- Import = append with seam detection (record tail found inside the file, else last
  2,000 chars sought; duplicate changes nothing; joins stamped INTO the record).
  REPLACE only on its own word. One import at a time. All kv calls guarded, boot from
  shipped defaults, degrade to memory on quota failure. Every import applies the
  §7 tolerance — no exceptions.

## 4. RECORDER API (the seam both homes share)

Standalone ES5 IIFE, no DOM at import time, `window.commpack`:

```js
window.commpack.record({agentID, role, text, platform, sessionID}) // stamps ts, appends turn
window.commpack.export(agentID)   // -> {jsonl, md} strings (caller downloads)
window.commpack.import(agentID, text) // seam-append, returns {added, how}
window.commpack.tail(agentID, n)      // -> last n turn objects, oldest-first (n clamped 1-100; sync read for session restore)
window.commpack.warm()                // -> pull every held pack into the MEM mirror (call once after IDB restore at boot)
window.commpack.state(agentID)        // -> {..., warn} — warn is set past ~3M chars: the pack is near the localStorage cap
window.commpack.state(agentID)    // -> {turns, chars, fingerprint, paramsVersion}
window.commpack.describe(agentID) // -> one status block for /comppack
```

Every integrated app (iPhone standalone, VOXCOMM, anything with the recorder inside)
calls `record()` per turn. Non-integrated apps: manual export at conversation end,
imported in the main app — same OPS shape as the chatlog extract flow.

## 5. CHARTER INVARIANTS (non-negotiable)

Missing/truncated source bytes → `BLOCKED_SOURCE_ARTIFACT_MISMATCH`, halt, never infer.
Verification before assertion. No assimilation, no flattening, no forced inference.
A halted state is a successful integrity control.

## 6. LANES OUT

- **Lane 1 (document):** converter renders `<agent>-<stamp>.md` (front block + one
  `## T<n> · <speaker>` section per turn) → LOAD LOREPACK (private kv) or
  `src/lorepack/` (public, only with consent).
- **Lane 2 (factory):** the `.jsonl` stages straight into the factory; embedder fills
  `vec`, adds marks, records become reader-side vectors/edges. One pack per agent —
  never merge two agents' transcripts under one `a`.

## 7. IMPORTER TOLERANCE (binding on every reader)

A strict reader rejects nothing the recorders once wrote:

- Both fingerprint shapes accepted. A legacy header (fingerprint `"deadbeef"`,
  empty actor) imports clean — header bytes preserved verbatim, never rewritten.
- `human`/`agent` turn roles normalize to `user`/`assistant` on the way in.
- Proven live 2026-09-30 on throwaway packs (added 2, skipped 0). The real
  SIA-002 pack's legacy header stays history, untouched.
- Field-proven the same day: short-shape headers exist in the wild (pre-fix
  SIA-002 header `0add8320`, hash correct, suffix absent; live chain head
  already full-shape at 638 turns). Import never gates on fingerprint format —
  both shapes import, so the tolerance above is load-bearing, not theoretical.
