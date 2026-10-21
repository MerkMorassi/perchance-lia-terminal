# VOXCONTPACK EXTRACTION INVENTORY (fulfills ORDER order-voxcontpack-extract.md — inventory only, no refactor)

Source: mythos-designer repo (117 files), examined whole. IN SCOPE = GUI voice
control as it exists NOW.

## 1. FILE LIST (in-scope, path + role)

COMMAND REGISTRY (markdown is source of truth):
- VOXCONPACK.md — spec v0.1: purpose, principle (voice is input, not authority),
  pipeline diagram, PACK routing table.
- VOXCONPACK/COMMANDS.md — canonical registry v1.0: ~28 commands, classes
  OBSERVE / NAVIGATE / CONTROL / SAFETY / CREATE / MODIFY / EXTERNAL_ACTION /
  AUTHORIZATION, each with aliases, params, authority, confirmation, failure,
  escalation, COMMPACK response profile.
- VOXCONPACK/commands/*.md (30 files: BACK…YES + VOX.md, SWITCH.md) — per-command sheets.
- VOXCONPACK/aliases/ALIASES.md — alias table.
- VOXCONPACK/schemas/SCHEMA.md + command.schema.json — normative checklist.
- VOXCONPACK/compiled/commands.json + registry.json + aliases.json — built
  artifacts (rebuilt by scripts/compile_voxconpack.cjs, NOT hand-edited).

TYPESCRIPT CORE (the liftable package):
- src/services/voxconpack/types.ts — all shared types (NormalizedCommand,
  VoxRegistry, AuthpackDecision, CommpackProfile, audit records).
- src/services/voxconpack/parser.ts — markdown→registry parser + 11-rule
  validator (VOX.STOP immutable-anchor protection included) + compiler.
- src/services/voxconpack/voxconEngine.ts — normalizer: wake-word strip,
  ambiguity detection (REQUIRES_CLARIFICATION), alias match, param extraction,
  surface map. Imports compiled registry.json DIRECTLY (see §4).
- src/services/voxconpack/pipeline.ts — orchestrator: normalize → AUTHPACK →
  execute (custom ActionExecutor injectable) → COMMPACK synthesize → audit.
  VOX.STOP short-circuits to HALTED.
- src/services/voxconpack/authpackService.ts — gatekeeper: bypass-pattern
  rejection, UNKNOWN/AMBIGUOUS denial, YES/NO/CONFIRM pending tokens (2-min
  TTL), STOP always-authorized, VOX.SWITCH RBAC (MIL profile needs
  SUPERVISOR), prohibited targets (ROOT/KERNEL/SECRETS/…).
- src/services/voxconpack/commpackService.ts — response synthesis per
  COMMPACK profile (OPERATIONAL default; CONVERSATIONAL switchable).
- src/services/voxconpack/auditLogger.ts — mandatory provenance record per turn.
- src/services/voxconpack/testSuite.ts — self-tests.
- src/utils/voiceDomController.ts — DOM executor: voice target → element
  (id / predefined map / fuzzy), click/focus/toggle + tactical highlight
  pulse. THIS is the GUI-hands layer; depends only on ./audio (soundEngine).
- src/utils/voxconpackValidator.ts — validator helper for uploads.
- src/hooks/useLiveVoiceControl.ts — React live-voice hook (50KB): Gemini
  live audio, month-named voice roster (Zephyr/Kore/Aoede/…), intents via
  matchVoiceIntentFast from voiceDomController. React-bound — port needs
  decoupling (see §5).
- src/components/voice/VOXCONPACKSurface.tsx + VoiceControlModule.tsx +
  VoiceCommandModal.tsx + VoxconTranscriptionDisplay.tsx +
  VoxconMdUploadZone.tsx — UI surfaces (React).
- src/types/voice.ts + voxcon.ts — voice/persona/preset types, INCLUDING
  VoiceParameterPreset (the per-voice Chatterbox-style preset shape — the
  VOXCOMMPACK preset idea already exists here).
- src/data/defaultCommands.ts — fallback command set.

## 2. DEPENDENCY NOTES (outside imports per file)

- voxconEngine ← VOXCONPACK/compiled/registry.json (build artifact, not src).
- pipeline ← voxconEngine, authpackService, commpackService, auditLogger.
- voiceDomController ← utils/audio (soundEngine) only. Cleanest lift in the set.
- useLiveVoiceControl ← liveAudioEngine, audio, windowsVoiceEngine,
  storedAudio, voiceDomController, types/voice. React + Windows + Gemini
  entangled — heaviest lift.
- UI surfaces ← React + app store. Not liftable as-is; patterns only.

## 3. ENTRY POINTS

- programmatic: `voxconPipeline.processInput(text, source, context, profile)`.
- custom GUI binding: `pipeline.setExecutor(async (name, args) => …)`.
- React: `useLiveVoiceControl({ onExecuteCommand })`.
- registry rebuild: `scripts/compile_voxconpack.cjs` (md → compiled/*.json).

## 4. SEAM LIST (AUTHPACK touchpoints)

Called: pipeline step 2 (authpackService.evaluate on every turn); STOP +
SAFETY bypass; SWITCH RBAC; prohibited-target list; pending-confirmation
tokens with TTL; bypass-pattern denials. Missing: engine leaves required-but-
absent params empty "so AUTHPACK notices" — downstream validation assumed,
not verified here. Voice identity (who speaks) is EXPLICITLY out of scope —
spec says voice confers no identity; a speaker-verification seam does not
exist and would be new work.

## 5. FUTURE LIST (set aside, do not pull)

- Full computer control beyond the DOM/surface map (no implementation found —
  genuinely future).
- COMMPACK-MIL.md (military profile doc) — read, not lifted; MIL switch path
  exists in authpackService, policy content stays his.
- mythos_daemon.py + server.ts + MSD/schematic/telemetry components — ship
  ops, not voice control.
- Dashboard/layout/theme/builder components — port targets later, not source.

## 6. UNCERTAIN (questions, not guesses)

- voiceDomController past line ~60 (predefined map continues) and the rest of
  useLiveVoiceControl (50KB: Windows engine? Gemini live protocol?) — skimmed,
  not fully read.
- Whether compiled/*.json is newer than COMMANDS.md (rebuild before trusting).
- VoiceParameterPreset shape vs our VOXCOMMPACK preset idea — looks like the
  same thought, uncompared field-by-field.
