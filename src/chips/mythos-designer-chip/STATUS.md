## STATUS

Command ID: VOX.STATUS
Class: OBSERVE
Purpose: Query and report the current operational status, subsystem metrics, or health of a designated target.

Canonical forms:
- STATUS

Aliases:
- give me status
- what's the system status
- system status
- report status
- check health
- operational status

Parameters:
- target: optional (string) - Subsystem or target resource to query. Defaults to system.

Examples:
- "Status"
- "Give me status"
- "What's the system status"
- "Report propulsion status"

Authority:
Requires AUTHPACK authorization for reading system or subsystem status.

Confirmation:
Not required. Read-only observation.

Execution:
Queries telemetry and system metrics through the workstation execution layer.

Failure:
Report telemetry acquisition failure through COMMPACK.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---
