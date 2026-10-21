## PAUSE

Command ID: VOX.PAUSE
Class: CONTROL
Purpose: Temporarily suspend an active playback, scan, simulation, or voice capture stream without clearing state.

Canonical forms:
- PAUSE

Aliases:
- hold
- suspend
- standby

Parameters:
- target: optional (string) - Routine or stream to suspend. Defaults to active stream.

Examples:
- "Pause"
- "Hold playback"
- "Standby"

Authority:
Requires AUTHPACK process control authorization.

Confirmation:
Not required.

Execution:
Sends pause signal to execution engine.

Failure:
Report pause failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
