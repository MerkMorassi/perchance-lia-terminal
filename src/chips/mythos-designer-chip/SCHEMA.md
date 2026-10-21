# VOXCONPACK Command Schema Specification

## Schema Overview
This document defines the normative schema for all VOXCONPACK command definitions.
Markdown is the human-maintained source of truth. JSON is the machine-readable compiled format.

## Markdown Format Requirements
Each command specification in Markdown must follow this structure:

```markdown
## <COMMAND_NAME>

Command ID: VOX.<COMMAND_NAME>
Class: <OBSERVE | NAVIGATE | CONTROL | CREATE | MODIFY | EXTERNAL_ACTION | AUTHORIZATION | SAFETY>
Purpose: <Detailed explanation of intended command outcome>

Canonical forms:
- <CANONICAL_FORM>

Aliases:
- <alias 1>
- <alias 2>

Parameters:
- <param_name>: <required | optional> (<data_type>) - <description>

Examples:
- "<Example natural language spoken phrase>"

Authority:
<Authority requirement, e.g., Requires AUTHPACK authorization for the requested target.>

Confirmation:
<Whether explicit confirmation is required before execution.>

Execution:
<Target execution layer action.>

Failure:
<Reporting criteria upon failure.>

Escalation:
<Conditions under which execution escalates to HITL.>

Response Profile:
<COMMPACK profile, e.g., COMMPACK.ACTION, COMMPACK.STATUS, COMMPACK.SAFETY>
```

## Validation Rules
1. **Unique Command ID**: Must strictly match `^VOX\.[A-Z0-9_]+$`.
2. **Valid Command Class**: Must be one of `OBSERVE`, `NAVIGATE`, `CONTROL`, `CREATE`, `MODIFY`, `EXTERNAL_ACTION`, `AUTHORIZATION`, `SAFETY`.
3. **Canonical Command Present**: Exactly one canonical keyword in uppercase matching the ID suffix.
4. **Purpose Present**: Must contain non-empty description.
5. **Authority Reference Present**: Must explicitly reference AUTHPACK.
6. **Parameter Schema Valid**: Parameters must be drawn from canonical parameter names: `target`, `source`, `destination`, `resource`, `application`, `file`, `surface`, `agent`, `query`, `text`, `location`, `item`, `value`.
7. **No Duplicate Canonical Commands**: No two definitions may share the same canonical command name.
8. **No Conflicting Aliases**: An alias cannot map to multiple distinct canonical commands.
9. **Valid Response Profile**: Must specify a valid COMMPACK response profile.
