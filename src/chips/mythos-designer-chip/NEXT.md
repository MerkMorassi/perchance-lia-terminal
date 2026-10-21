## NEXT

Command ID: VOX.NEXT
Class: NAVIGATE
Purpose: Advance to the next item, page, tab, or record in a sequential workflow.

Canonical forms:
- NEXT

Aliases:
- forward
- advance
- step forward

Parameters:
- surface: optional (string) - Scope of the sequential navigation.

Examples:
- "Next"
- "Next tab"
- "Advance page"

Authority:
Requires AUTHPACK navigation authorization.

Confirmation:
Not required.

Execution:
Dispatches sequential increment action.

Failure:
Report end of sequence.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
