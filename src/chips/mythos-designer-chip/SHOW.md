## SHOW

Command ID: VOX.SHOW
Class: OBSERVE
Purpose: Display or visually present a designated metric, chart, node, or surface component.

Canonical forms:
- SHOW

Aliases:
- display
- view
- reveal

Parameters:
- target: required (string) - The element, node, or metric to display.

Examples:
- "Show telemetry"
- "Display warp core"
- "View impulse manifold"

Authority:
Requires AUTHPACK read authorization for the visual target.

Confirmation:
Not required.

Execution:
Activates visualization or focuses the visual container.

Failure:
Report target not found.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
