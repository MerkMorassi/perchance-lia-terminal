## YES

Command ID: VOX.YES
Class: AUTHORIZATION
Purpose: Natural language affirmation of the active pending confirmation question.

Canonical forms:
- YES

Aliases:
- yeah
- yep
- correct
- that is correct

Parameters:
- None.

Examples:
- "Yes"
- "Yeah"
- "Correct"

Authority:
Resolves ONLY the currently active pending action. Never grants general future authority.

Confirmation:
Self-fulfilling for pending action.

Execution:
Delegates to `VOX.CONFIRM` for the active pending transaction.

Failure:
Report no active question or pending action.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
