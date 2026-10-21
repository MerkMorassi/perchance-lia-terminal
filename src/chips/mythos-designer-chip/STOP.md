## STOP

Command ID: VOX.STOP
Class: SAFETY
Purpose: Immediately halt an active operation, audio playback, routine, or in emergency context, trigger emergency safety stop.

Canonical forms:
- STOP

Aliases:
- halt
- terminate
- abort
- emergency stop
- kill process

Parameters:
- target: optional (string) - Specific process to stop. If omitted, applies to current active audio / operation or emergency halt.

Examples:
- "Stop"
- "Halt simulation"
- "Abort scan"
- "Emergency stop"

Authority:
Requires AUTHPACK safety authorization. Emergency safety stop is granted high priority.

Confirmation:
Immediate safety halt does NOT require confirmation. Controlled shutdown of critical systems requires confirmation.

Execution:
Invokes emergency halt handler or terminates active process.

Failure:
Report emergency halt condition.

Escalation:
Immediate HITL alert if emergency halt fails.

Response Profile:
COMMPACK.SAFETY

---
