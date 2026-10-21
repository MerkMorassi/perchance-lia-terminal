# MYTHOS SPINCODE - every /SlashCode command as a chat CLI that acts at once (for every SIA and LIA)

Origin: ported from src/js/spincode.js (core verbs, state, text pipeline) + src/js/spincode-scrolls.js (his five scrolls: Keyword, SearchArchive, agency lane, data lane), 2026-10-05. Built to CHIP SPEC v1.

## use

```html
<script src="mythos-spincode-standalone.js"></script>
<script>
  var spin = MythosSpincode.client({ store: kvStore });
  var r = await spin.run("/mode play");
  if (!r.handled) sendToHer(line);
  print(r.lines.join("\n"));
  spin.handles("/task write the scene"); // true -> route here, never to her as chatter
</script>
```

No store passed, state lives in a memory slot for the page. No lore/keyring/xlate passed, the host's `window.lore`/`keyring`/`xlate` stand in where present; without them the lore verbs refuse loud. `say(fn)` hears every line; `run()` also returns `{ handled, lines }`. `archiveCount` (number or fn) feeds the /EnableChatLogging proof line without a kv handle.

## the contract

- `run(line)` — leading `/` optional, case-insensitive, multiword aliases resolved (`play mode` → `/mode play`, `safe mode` → `/safe`, `role reversal` → `/reverserole`). Unknown verbs return `{ handled: false }` so the host passes them through as words. Everything else acts at once — no discussion, one receipt per command.
- `handles(line)` — true when the table owns the first word. `verbs()` — the sorted roll. `help()` — the whole page.
- STATE: `status` (the board) · `mode <NAME|off>` · `context|stage <REALM|off>` · `scene <TEXT|clear>` · `invoke <MODE>` · `silent|listen|safe` · `ritual|chorus|canvas` + the cocode family (`cocode greenlight allgreenlights skycanvas deepwaters earthcanvas shallowwaters echovault echochamber fullspectrum tone collabstory livetest jailbreak`) + garden (`guardianmode attendantmode guidemode pingpong reverserole gamecode attendantguardian begin end`).
- AGENCY: `agency <NAME> <0-10> | off <NAME>` · scroll aliases `EnableAgency|DisableAgency` · `SetRoutineReports|SetCheckInTime|SetFeedbackLoop` · `BeginNewSessionSetup` (asks, or takes `TIMEZONE/REPORTS/CHECKIN/FEEDBACK` pairs).
- TASKS: `task <TEXT|list|done N|drop N|clear yes>` · `do <N|TEXT>` · `delegate <NAME> <TASK>` · `await [N]` · `pause [N]` · `resume` · `stop` · `cancel`.
- WORDS: `say|tell|broadcast|whisper` (said here — rooms come with /pair).
- MEMORY (HIS): `remember <TEXT|list>` · `forget <N>` · `feedback <TEXT|list>` · `capture [LABEL]` · `archive <TEXT|list>`.
- PIPELINE (local, free): `clean` · `tag` · `summarize <TEXT|doc NAME>` · `analyze` · `Keyword <PHRASE>` (his lore card) · `KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME]` · `SearchArchive <DOC> <PHRASE> <DISPLAY>` (DisplayOn/DisplayOff/UnsanitizedEnglishOn/Off/RegularMeaning + the handed-to-her layers) · `ProcessBlockText` · `ImplementDataSummarization` · `ImplementSecurityProtocols`.
- TOGGLES: `RealTimeDataCleaning|EnableKeywordTagging|EnableTaskTracking|EnableChatLogging|EnableSearchFunction|EnableDropDownFilters` (honest: no menus — the line is the filter).
- CONSENT: `consent <TEXT|list>` · `approve|deny <N>` · `revoke <N>` (never inferred).
- POSTURE: `audit` (ring ids only, never values) · `secure` · `diagnose`. THINK: `adapt` · `review`.
- TEXT UTILS (exposed, same math): `cleanText keywordsOf keywordTable summarizeExtractive sanitizeGreek hashtagsOf`.
- State shape: whole-state `{ mode prevMode context scene agency tasks seq active paused consent cseq notes nseq shelf aseq reports checkinAt feedbackEvery keywordTagging dataCleaning taskTracking chatLogging }`, numeric stamps on captures, append-only ledgers. Nothing throws; refusals are sentences.

## deliberately left out

- The rooms verbs and the broker (`/join /leave /invite /handoff /tool /grant`) — typed, they pass through as words, per the spec's graceful failure.
- The already-aboard verbs (`/role /recall /search /sync /voice /story /mood /reflect /clarify`) — composed, never re-registered.
- Every pixel: panels, pickers, menus. Hosts paint from `state()` and `say`.
- Keys live in the host keyring, never in the chip; `audit` prints counts and ids only.

## honesty note

A command table, not an authority: it keeps state and prints receipts, it grants nothing by itself — agency never rises above security, consent, or system constraints, and mythopoetic scenes frame without granting.
