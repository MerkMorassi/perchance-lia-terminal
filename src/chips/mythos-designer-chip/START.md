## START

Command ID: VOX.START
Class: CONTROL
Purpose: Initiate or begin an authorized system routine, ingestion cycle, or simulation stream.

Canonical forms:
- START

Aliases:
- begin
- commence
- initiate
- run

Parameters:
- target: required (string) - The routine, process, or stream to start.

Examples:
- "Start simulation"
- "Initiate diagnostic scan"
- "Run ingest"

Authority:
Requires AUTHPACK execution authorization for the designated process.

Confirmation:
Required if process has systemic impact or resource consumption.

Execution:
Submits start routine directive to runtime scheduler.

Failure:
Report runtime failure or process error.

Escalation:
Escalate to HITL if process status reports critical error.

Response Profile:
COMMPACK.ACTION

---
