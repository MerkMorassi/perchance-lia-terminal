## FIND

Command ID: VOX.FIND
Class: OBSERVE
Purpose: Locate a specific unique resource, node, or file.

Canonical forms:
- FIND

Aliases:
- pinpoint
- track down

Parameters:
- item: required (string) - The specific item to locate.

Examples:
- "Find primary reactor"
- "Find navigation manifest"

Authority:
Requires AUTHPACK read authorization.

Confirmation:
Not required.

Execution:
Locates item and selects coordinate or node reference.

Failure:
Report item not found.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
