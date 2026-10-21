## SEARCH

Command ID: VOX.SEARCH
Class: OBSERVE
Purpose: Search knowledge bases, logs, or file systems for matches corresponding to a query.

Canonical forms:
- SEARCH

Aliases:
- look for
- query
- locate

Parameters:
- query: required (string) - Search text or pattern.
- location: optional (string) - Scope or repository to search.

Examples:
- "Search logs for anomaly"
- "Query reactor specifications"

Authority:
Requires AUTHPACK search authorization.

Confirmation:
Not required.

Execution:
Executes retrieval search against indexing layer.

Failure:
Report query execution failure.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---
