## FOCUS

Command ID: VOX.FOCUS
Class: NAVIGATE
Purpose: Shift operational focus and input context to a designated pane, surface, or input control.

Canonical forms:
- FOCUS

Aliases:
- focus on
- switch focus to

Parameters:
- target: required (string) - Pane or component to focus.

Examples:
- "Focus on telemetry console"
- "Focus command line"

Authority:
Requires AUTHPACK input authorization.

Confirmation:
Not required.

Execution:
Dispatches focus event to the target element.

Failure:
Report focus failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
