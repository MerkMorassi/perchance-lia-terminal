## READ

Command ID: VOX.READ
Class: OBSERVE
Purpose: Read aloud or synthesize textual content, telemetry log entries, or diagnostic briefs.

Canonical forms:
- READ

Aliases:
- read out
- speak
- vocalize

Parameters:
- target: required (string) - The text, file, or log stream to read.

Examples:
- "Read log entries"
- "Read telemetry"
- "Speak latest advisory"

Authority:
Requires AUTHPACK authorization to access the text stream.

Confirmation:
Not required.

Execution:
Submits textual stream to speech synthesis engine.

Failure:
Report audio synthesis failure.

Escalation:
None.

Response Profile:
COMMPACK.INFO

---
