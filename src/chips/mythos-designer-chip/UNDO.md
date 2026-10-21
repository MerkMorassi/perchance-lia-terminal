## UNDO

Command ID: VOX.UNDO
Class: CONTROL
Purpose: Revert the previous state modification or parameter update.

Canonical forms:
- UNDO

Aliases:
- revert
- step back edit

Parameters:
- None.

Examples:
- "Undo"
- "Revert last change"

Authority:
Requires AUTHPACK modification authorization.

Confirmation:
Not required for reversible history steps.

Execution:
Pops previous transaction from state history stack.

Failure:
Report undo stack empty.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
