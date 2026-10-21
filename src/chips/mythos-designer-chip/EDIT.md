## EDIT

Command ID: VOX.EDIT
Class: MODIFY
Purpose: Modify an existing parameter, field, command definition, or manifest attribute.

Canonical forms:
- EDIT

Aliases:
- modify
- alter
- change
- update
- set

Parameters:
- target: required (string) - Field or parameter to edit.
- value: required (string) - New value to assign.

Examples:
- "Edit core temperature to 3500"
- "Set theme to noir-dark"
- "Change sensitivity to high"

Authority:
Requires AUTHPACK modification authorization for the specified target.

Confirmation:
Required if editing critical system parameters or safety limits.

Execution:
Applies state patch through the designated surface store.

Failure:
Report invalid parameter or out-of-range value.

Escalation:
Escalate to HITL if parameter touches safety boundaries.

Response Profile:
COMMPACK.ACTION

---
