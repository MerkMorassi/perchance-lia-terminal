## REPEAT

Command ID: VOX.REPEAT
Class: CONTROL
Purpose: Re-execute or re-read the most recently executed command or speech transmission.

Canonical forms:
- REPEAT

Aliases:
- say again
- do that again
- repeat that

Parameters:
- None.

Examples:
- "Repeat"
- "Say again"
- "Repeat last advisory"

Authority:
Requires AUTHPACK authorization for the repeated action.

Confirmation:
Inherits confirmation requirement of the repeated action.

Execution:
Re-dispatches previous transaction from provenance log.

Failure:
Report no previous actionable command.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
