## SEND

Command ID: VOX.SEND
Class: EXTERNAL_ACTION
Purpose: Transmit a message, telemetry packet, report, or external payload outside the immediate container.

Canonical forms:
- SEND

Aliases:
- transmit
- dispatch
- broadcast

Parameters:
- destination: required (string) - Recipient or endpoint.
- text: optional (string) - Message or payload content.

Examples:
- "Send telemetry to ops"
- "Transmit report"

Authority:
Requires explicit AUTHPACK egress authorization.

Confirmation:
Always requires explicit confirmation (`PENDING_CONFIRMATION`) before transmission.

Execution:
Submits payload to communication gateway.

Failure:
Report delivery failure or network error.

Escalation:
Escalate if authorization is missing or destination is untrusted.

Response Profile:
COMMPACK.ACTION

---
