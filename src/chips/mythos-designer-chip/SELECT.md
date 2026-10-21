## SELECT

Command ID: VOX.SELECT
Class: NAVIGATE
Purpose: Choose or highlight a specific node, item, or entry in a collection.

Canonical forms:
- SELECT

Aliases:
- choose
- pick
- highlight

Parameters:
- item: required (string) - The item or node key to select.

Examples:
- "Select primary coil"
- "Choose profile two"

Authority:
Requires AUTHPACK interaction authorization.

Confirmation:
Not required.

Execution:
Sets active selection state in the component model.

Failure:
Report target item not found.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---
