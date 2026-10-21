## CLOSE

Command ID: VOX.CLOSE
Class: NAVIGATE
Purpose: Close or dismiss the specified active window, modal, surface, or panel.

Canonical forms:
- CLOSE

Aliases:
- dismiss
- shut down
- exit
- hide

Parameters:
- target: required (string) - The surface, modal, or window to close.

Examples:
- "Close modal"
- "Dismiss diagnostics"
- "Hide telemetry"

Authority:
Requires AUTHPACK window management authorization.

Confirmation:
Not required unless uncommitted changes exist in the target surface.

Execution:
Sends close event to the window or panel controller.

Failure:
Report inability to dismiss window.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
