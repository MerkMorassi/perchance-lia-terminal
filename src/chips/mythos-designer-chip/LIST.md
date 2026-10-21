## LIST

Command ID: VOX.LIST
Class: OBSERVE
Purpose: Enumerate available resources, files, surfaces, or inventory items in the specified scope.

Canonical forms:
- LIST

Aliases:
- enumerate
- show all
- list files
- list resources

Parameters:
- resource: optional (string) - Category or scope of resources to list.

Examples:
- "List resources"
- "Enumerate files"
- "Show all surfaces"

Authority:
Requires AUTHPACK read authorization for the designated resource scope.

Confirmation:
Not required.

Execution:
Queries directory or resource index.

Failure:
Report index retrieval failure.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---
