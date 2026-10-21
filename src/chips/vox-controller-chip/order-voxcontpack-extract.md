# ORDER — VOXCONTPACK TypeScript extraction (for the resident AI STUDIO AGENT)

## Objective

Prepare for extraction every TypeScript source file that implements
VOXCONTPACK ("Voice Control Package"): basic UI voice control of the GUI —
mic input, command parsing, GUI bindings. Nothing more, nothing less.

## Scope IN

- Voice capture and transcription wiring (mic, VAD, STT hooks).
- Command grammar/intent map for GUI control (the commands that exist NOW).
- UI bindings: what each voice command calls in the interface.
- Any shared types, enums, and constants these depend on.

## Scope OUT (flag, do not pull)

- Full computer control (future add-on) — list its files separately as
  FUTURE, do not include.
- AUTHPACK permission checks: do not extract, but MARK every seam where
  VOXCONTPACK calls (or should call) the permissions stack.

## Deliverable

1. FILE LIST: every in-scope file, path + one line on its role.
2. DEPENDENCY NOTES: what each file imports from outside VOXCONTPACK.
3. ENTRY POINTS: where the package boots and where commands enter.
4. SEAM LIST: every AUTHPACK touchpoint, called or missing.
5. FUTURE LIST: full-computer-control files, named and set aside.
6. No rewrites, no refactors — inventory only. Code moves later, by order.

## Acceptance

- Another agent can read the inventory and lift the package without asking
  a question.
- Anything uncertain is marked UNCERTAIN with the question written out —
  never guessed into the list.
