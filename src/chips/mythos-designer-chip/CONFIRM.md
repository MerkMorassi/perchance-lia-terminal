## CONFIRM

Command ID: VOX.CONFIRM
Class: AUTHORIZATION
Purpose: Affirm and authorize an active pending action awaiting human-in-the-loop authorization.

Canonical forms:
- CONFIRM

Aliases:
- affirmative
- proceed with action
- execute pending

Parameters:
- None.

Examples:
- "Confirm"
- "Affirmative"
- "Proceed with action"

Authority:
Operator authorization grant. Appends approval token to the active pending transaction.

Confirmation:
Self-fulfilling for pending action.

Execution:
Transitions pending action in AUTHPACK from `PENDING_CONFIRMATION` to `AUTHORIZED` and executes.

Failure:
Report no pending transaction exists to confirm.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
