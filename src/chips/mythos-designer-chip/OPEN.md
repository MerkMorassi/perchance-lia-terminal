## OPEN

Command ID: VOX.OPEN
Class: NAVIGATE
Purpose: Open an authorized application, file, surface, resource, or workspace.

Canonical forms:
- OPEN

Aliases:
- launch
- bring up
- pull up
- navigate to
- switch to

Parameters:
- target: required (string) - Name or identifier of target surface, application, or file.
- location: optional (string) - Target workspace or screen area.

Examples:
- "Open the RAG browser"
- "Launch VS Code"
- "Bring up the MythOS dashboard"
- "Pull up the dashboard"
- "Switch to voice control"

Authority:
Requires AUTHPACK authorization for the requested target.

Confirmation:
Not required unless AUTHPACK or the target resource designates the surface as restricted.

Execution:
Submit the normalized navigation request to the workstation execution layer.

Failure:
Report actual failure condition or missing target.

Escalation:
Escalate when requested operation exceeds available authority.

Response Profile:
COMMPACK.ACTION

---
