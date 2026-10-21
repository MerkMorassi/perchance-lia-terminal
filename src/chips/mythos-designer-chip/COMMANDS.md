# VOXCONPACK Master Command Registry
**Protocol:** VOXCONPACK
**Version:** 1.0
**Source of Truth:** Markdown
**Compiled Artifact:** /VOXCONPACK/compiled/commands.json

This document serves as the human-authored canonical source of truth for all voice-command definitions in the VOXCONPACK layer.

---

## STATUS

Command ID: VOX.STATUS
Class: OBSERVE
Purpose: Query and report the current operational status, subsystem metrics, or health of a designated target.

Canonical forms:
- STATUS

Aliases:
- give me status
- what's the system status
- system status
- report status
- check health
- operational status

Parameters:
- target: optional (string) - Subsystem or target resource to query. Defaults to system.

Examples:
- "Status"
- "Give me status"
- "What's the system status"
- "Report propulsion status"

Authority:
Requires AUTHPACK authorization for reading system or subsystem status.

Confirmation:
Not required. Read-only observation.

Execution:
Queries telemetry and system metrics through the workstation execution layer.

Failure:
Report telemetry acquisition failure through COMMPACK.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---

## HELP

Command ID: VOX.HELP
Class: OBSERVE
Purpose: Provide operator guidance, available commands, or operational assistance for the active interface.

Canonical forms:
- HELP

Aliases:
- assist
- assistance
- what can i say
- list commands
- command guide

Parameters:
- query: optional (string) - Specific topic or command to get help on.

Examples:
- "Help"
- "What can I say"
- "Command guide"

Authority:
Requires AUTHPACK authorization for public knowledge retrieval.

Confirmation:
Not required.

Execution:
Presents operator documentation and voice command guidance.

Failure:
Report guidance unavailable.

Escalation:
None.

Response Profile:
COMMPACK.INFO

---

## LIST

Command ID: VOX.LIST
Class: OBSERVE
Purpose: Enumerate available resources, files, surfaces, or inventory items in the specified scope.

Canonical forms:
- LIST

Aliases:
- enumerate
- show all
- list files
- list resources

Parameters:
- resource: optional (string) - Category or scope of resources to list.

Examples:
- "List resources"
- "Enumerate files"
- "Show all surfaces"

Authority:
Requires AUTHPACK read authorization for the designated resource scope.

Confirmation:
Not required.

Execution:
Queries directory or resource index.

Failure:
Report index retrieval failure.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---

## SHOW

Command ID: VOX.SHOW
Class: OBSERVE
Purpose: Display or visually present a designated metric, chart, node, or surface component.

Canonical forms:
- SHOW

Aliases:
- display
- view
- reveal

Parameters:
- target: required (string) - The element, node, or metric to display.

Examples:
- "Show telemetry"
- "Display warp core"
- "View impulse manifold"

Authority:
Requires AUTHPACK read authorization for the visual target.

Confirmation:
Not required.

Execution:
Activates visualization or focuses the visual container.

Failure:
Report target not found.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

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

## SEARCH

Command ID: VOX.SEARCH
Class: OBSERVE
Purpose: Search knowledge bases, logs, or file systems for matches corresponding to a query.

Canonical forms:
- SEARCH

Aliases:
- look for
- query
- locate

Parameters:
- query: required (string) - Search text or pattern.
- location: optional (string) - Scope or repository to search.

Examples:
- "Search logs for anomaly"
- "Query reactor specifications"

Authority:
Requires AUTHPACK search authorization.

Confirmation:
Not required.

Execution:
Executes retrieval search against indexing layer.

Failure:
Report query execution failure.

Escalation:
None.

Response Profile:
COMMPACK.STATUS

---

## FIND

Command ID: VOX.FIND
Class: OBSERVE
Purpose: Locate a specific unique resource, node, or file.

Canonical forms:
- FIND

Aliases:
- pinpoint
- track down

Parameters:
- item: required (string) - The specific item to locate.

Examples:
- "Find primary reactor"
- "Find navigation manifest"

Authority:
Requires AUTHPACK read authorization.

Confirmation:
Not required.

Execution:
Locates item and selects coordinate or node reference.

Failure:
Report item not found.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## OPEN

Command ID: VOX.OPEN
Class: NAVIGATE
Purpose: Open an authorized application, file, surface, resource, or workspace.

Canonical forms:
- OPEN

Aliases:
- launch
- bring up
- pull up
- navigate to
- switch to

Parameters:
- target: required (string) - Name or identifier of target surface, application, or file.
- location: optional (string) - Target workspace or screen area.

Examples:
- "Open the RAG browser"
- "Launch VS Code"
- "Bring up the MythOS dashboard"
- "Pull up the dashboard"
- "Switch to voice control"

Authority:
Requires AUTHPACK authorization for the requested target.

Confirmation:
Not required unless AUTHPACK or the target resource designates the surface as restricted.

Execution:
Submit the normalized navigation request to the workstation execution layer.

Failure:
Report actual failure condition or missing target.

Escalation:
Escalate when requested operation exceeds available authority.

Response Profile:
COMMPACK.ACTION

---

## CLOSE

Command ID: VOX.CLOSE
Class: NAVIGATE
Purpose: Close or dismiss the specified active window, modal, surface, or panel.

Canonical forms:
- CLOSE

Aliases:
- dismiss
- shut down
- exit
- hide

Parameters:
- target: required (string) - The surface, modal, or window to close.

Examples:
- "Close modal"
- "Dismiss diagnostics"
- "Hide telemetry"

Authority:
Requires AUTHPACK window management authorization.

Confirmation:
Not required unless uncommitted changes exist in the target surface.

Execution:
Sends close event to the window or panel controller.

Failure:
Report inability to dismiss window.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

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

## FOCUS

Command ID: VOX.FOCUS
Class: NAVIGATE
Purpose: Shift operational focus and input context to a designated pane, surface, or input control.

Canonical forms:
- FOCUS

Aliases:
- focus on
- switch focus to

Parameters:
- target: required (string) - Pane or component to focus.

Examples:
- "Focus on telemetry console"
- "Focus command line"

Authority:
Requires AUTHPACK input authorization.

Confirmation:
Not required.

Execution:
Dispatches focus event to the target element.

Failure:
Report focus failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## NEXT

Command ID: VOX.NEXT
Class: NAVIGATE
Purpose: Advance to the next item, page, tab, or record in a sequential workflow.

Canonical forms:
- NEXT

Aliases:
- forward
- advance
- step forward

Parameters:
- surface: optional (string) - Scope of the sequential navigation.

Examples:
- "Next"
- "Next tab"
- "Advance page"

Authority:
Requires AUTHPACK navigation authorization.

Confirmation:
Not required.

Execution:
Dispatches sequential increment action.

Failure:
Report end of sequence.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## BACK

Command ID: VOX.BACK
Class: NAVIGATE
Purpose: Return to the previous item, page, tab, or view in history.

Canonical forms:
- BACK

Aliases:
- previous
- go back
- step back

Parameters:
- surface: optional (string) - Scope of the sequential navigation.

Examples:
- "Back"
- "Go back"
- "Previous page"

Authority:
Requires AUTHPACK navigation authorization.

Confirmation:
Not required.

Execution:
Dispatches sequential decrement or history pop.

Failure:
Report beginning of sequence.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

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

## STOP

Command ID: VOX.STOP
Class: SAFETY
Purpose: Immediately halt an active operation, audio playback, routine, or in emergency context, trigger emergency safety stop.

Canonical forms:
- STOP

Aliases:
- halt
- terminate
- abort
- emergency stop
- kill process

Parameters:
- target: optional (string) - Specific process to stop. If omitted, applies to current active audio / operation or emergency halt.

Examples:
- "Stop"
- "Halt simulation"
- "Abort scan"
- "Emergency stop"

Authority:
Requires AUTHPACK safety authorization. Emergency safety stop is granted high priority.

Confirmation:
Immediate safety halt does NOT require confirmation. Controlled shutdown of critical systems requires confirmation.

Execution:
Invokes emergency halt handler or terminates active process.

Failure:
Report emergency halt condition.

Escalation:
Immediate HITL alert if emergency halt fails.

Response Profile:
COMMPACK.SAFETY

---

## PAUSE

Command ID: VOX.PAUSE
Class: CONTROL
Purpose: Temporarily suspend an active playback, scan, simulation, or voice capture stream without clearing state.

Canonical forms:
- PAUSE

Aliases:
- hold
- suspend
- standby

Parameters:
- target: optional (string) - Routine or stream to suspend. Defaults to active stream.

Examples:
- "Pause"
- "Hold playback"
- "Standby"

Authority:
Requires AUTHPACK process control authorization.

Confirmation:
Not required.

Execution:
Sends pause signal to execution engine.

Failure:
Report pause failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## RESUME

Command ID: VOX.RESUME
Class: CONTROL
Purpose: Unpause or resume an interrupted or suspended process or stream.

Canonical forms:
- RESUME

Aliases:
- continue
- unpause
- proceed

Parameters:
- target: optional (string) - Suspended routine to resume.

Examples:
- "Resume"
- "Continue scan"
- "Proceed"

Authority:
Requires AUTHPACK process control authorization.

Confirmation:
Not required.

Execution:
Sends resume signal to runtime scheduler.

Failure:
Report resume failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## REPEAT

Command ID: VOX.REPEAT
Class: CONTROL
Purpose: Re-execute or re-read the most recently executed command or speech transmission.

Canonical forms:
- REPEAT

Aliases:
- say again
- do that again
- repeat that

Parameters:
- None.

Examples:
- "Repeat"
- "Say again"
- "Repeat last advisory"

Authority:
Requires AUTHPACK authorization for the repeated action.

Confirmation:
Inherits confirmation requirement of the repeated action.

Execution:
Re-dispatches previous transaction from provenance log.

Failure:
Report no previous actionable command.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

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

## CANCEL

Command ID: VOX.CANCEL
Class: CONTROL
Purpose: Cancel the currently active pending operation, dialog, or staged action.

Canonical forms:
- CANCEL

Aliases:
- drop
- abort pending
- never mind

Parameters:
- None.

Examples:
- "Cancel"
- "Drop that"
- "Never mind"

Authority:
Authorized for all human operators.

Confirmation:
Not required.

Execution:
Clears active pending-confirmation state in AUTHPACK.

Failure:
Report no pending operation.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## CREATE

Command ID: VOX.CREATE
Class: CREATE
Purpose: Generate, instantiate, or initialize a new file, manifest, command, or resource.

Canonical forms:
- CREATE

Aliases:
- make
- generate
- build
- initialize

Parameters:
- resource: required (string) - The resource category to create.
- item: optional (string) - Name or identifier of the new resource.

Examples:
- "Create theme preset"
- "Generate new manifest"
- "Build command definition"

Authority:
Requires AUTHPACK resource creation authorization.

Confirmation:
Requires explicit operator confirmation if creating file or persistent resource.

Execution:
Dispatches instantiation routine to the resource builder.

Failure:
Report creation validation or allocation failure.

Escalation:
Escalate if disk or resource quotas exceeded.

Response Profile:
COMMPACK.ACTION

---

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

## SAVE

Command ID: VOX.SAVE
Class: MODIFY
Purpose: Persist current workspace state, parameters, theme, or manifest to persistent storage.

Canonical forms:
- SAVE

Aliases:
- persist
- store
- write changes
- commit

Parameters:
- target: optional (string) - Specific resource to save. Defaults to current active workspace.

Examples:
- "Save"
- "Save manifest"
- "Persist parameters"

Authority:
Requires AUTHPACK storage authorization.

Confirmation:
Not required for standard save; required if overwriting existing file.

Execution:
Invokes saveParams or backend write-through.

Failure:
Report storage write failure.

Escalation:
None.

Response Profile:
COMMPACK.ACTION

---

## SEND

Command ID: VOX.SEND
Class: EXTERNAL_ACTION
Purpose: Transmit a message, telemetry packet, report, or external payload outside the immediate container.

Canonical forms:
- SEND

Aliases:
- transmit
- dispatch
- broadcast

Parameters:
- destination: required (string) - Recipient or endpoint.
- text: optional (string) - Message or payload content.

Examples:
- "Send telemetry to ops"
- "Transmit report"

Authority:
Requires explicit AUTHPACK egress authorization.

Confirmation:
Always requires explicit confirmation (`PENDING_CONFIRMATION`) before transmission.

Execution:
Submits payload to communication gateway.

Failure:
Report delivery failure or network error.

Escalation:
Escalate if authorization is missing or destination is untrusted.

Response Profile:
COMMPACK.ACTION

---

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
