## NO

Command ID: VOX.NO
Class: AUTHORIZATION
Purpose: Natural language rejection or termination of the active pending confirmation question.

Canonical forms:
- NO

Aliases:
- nope
- negative
- do not do that
- reject

Parameters:
- None.

Examples:
- "No"
- "Negative"
- "Nope"

Authority:
Rejects pending authorization.

Confirmation:
Not required.

Execution:
Transitions pending action in AUTHPACK to `DENIED` and clears pending state.

Failure:
Report no pending question.

Escalation:
None.

Response Profile:
COMMPACK.ACTION
