## RESUME

Command ID: VOX.RESUME
Class: CONTROL
Purpose: Unpause or resume an interrupted or suspended process or stream.

Canonical forms:
- RESUME

Aliases:
- continue
- unpause
- proceed

Parameters:
- target: optional (string) - Suspended routine to resume.

Examples:
- "Resume"
- "Continue scan"
- "Proceed"

Authority:
Requires AUTHPACK process control authorization.

Confirmation:
Not required.

Execution:
Sends resume signal to runtime scheduler.

Failure:
Report resume failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
