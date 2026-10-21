## SWITCH

Command ID: VOX.SWITCH
Command Class: EXTERNAL_ACTION
Purpose: Switch the active COMMPACK communication profile or mode on demand.

Canonical Forms:
- SWITCH

Aliases:
- switch commpack
- change profile
- set commpack mode
- change commpack

Parameters:
- target: required (string) - The target subsystem, e.g. COMMPACK.
- value: required (string) - The target profile (e.g. OPERATIONAL, CONVERSATIONAL).

Examples:
- "Switch COMMPACK to OPERATIONAL"
- "Change profile to CONVERSATIONAL"

Authority:
Requires AUTHPACK authorization with HITL_OPERATOR for profile modifications.

Confirmation:
Requires confirmation.

Execution:
Updates the active CommpackProfile via CommpackService and re-renders the surface.

Failure:
Report invalid profile or missing authorization.

Escalation:
None.

Response Profile:
COMMPACK.ACTION
