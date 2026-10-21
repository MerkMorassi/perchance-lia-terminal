## CREATE

Command ID: VOX.CREATE
Class: CREATE
Purpose: Generate, instantiate, or initialize a new file, manifest, command, or resource.

Canonical forms:
- CREATE

Aliases:
- make
- generate
- build
- initialize

Parameters:
- resource: required (string) - The resource category to create.
- item: optional (string) - Name or identifier of the new resource.

Examples:
- "Create theme preset"
- "Generate new manifest"
- "Build command definition"

Authority:
Requires AUTHPACK resource creation authorization.

Confirmation:
Requires explicit operator confirmation if creating file or persistent resource.

Execution:
Dispatches instantiation routine to the resource builder.

Failure:
Report creation validation or allocation failure.

Escalation:
Escalate if disk or resource quotas exceeded.

Response Profile:
COMMPACK.ACTION

---
