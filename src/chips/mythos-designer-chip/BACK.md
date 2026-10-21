## BACK

Command ID: VOX.BACK
Class: NAVIGATE
Purpose: Return to the previous item, page, tab, or view in history.

Canonical forms:
- BACK

Aliases:
- previous
- go back
- step back

Parameters:
- surface: optional (string) - Scope of the sequential navigation.

Examples:
- "Back"
- "Go back"
- "Previous page"

Authority:
Requires AUTHPACK navigation authorization.

Confirmation:
Not required.

Execution:
Dispatches sequential decrement or history pop.

Failure:
Report beginning of sequence.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
