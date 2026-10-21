## SAVE

Command ID: VOX.SAVE
Class: MODIFY
Purpose: Persist current workspace state, parameters, theme, or manifest to persistent storage.

Canonical forms:
- SAVE

Aliases:
- persist
- store
- write changes
- commit

Parameters:
- target: optional (string) - Specific resource to save. Defaults to current active workspace.

Examples:
- "Save"
- "Save manifest"
- "Persist parameters"

Authority:
Requires AUTHPACK storage authorization.

Confirmation:
Not required for standard save; required if overwriting existing file.

Execution:
Invokes saveParams or backend write-through.

Failure:
Report storage write failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
