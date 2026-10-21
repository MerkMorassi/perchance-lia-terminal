# CODY — THE AGENT'S OWN LANE

**CODY'S RULES.** Named by Patrikios, 2026-09-30, verbatim:

> *"Cody's Rules: Brief first, grep before re-deriving, write every pass down."*

Three rules, each with the door it is used through and the cost it exists to prevent. They are the
agent's, not hers: nothing in this folder is indexed, retrieved or handed to LIA, nothing here is a
manual, and everything here is public because it ships with the generator. **"Per Cody's Rules" means
this file.**

## 1. BRIEF FIRST

**The door:** `/chatlog brief` (`root.chatlog.brief()`), then `/chronicle newest`, then the top of
`README.md`. The brief is the fixed-size head of the record — two chunk reads whatever the record weighs.

**Why it exists:** the record is 5.87 MB and the previous session's context is gone. Reading it whole
spends a session on the reading; reading none of it re-derives what is already settled, and *where a
session has been* cannot be recovered from the code at all. The brief is the memory of the agent that is
doing the making — so it is the first thing read, never the last.

**The honest caveat, as of 2026-09-30:** the brief's `WHERE IT STARTS` prints turn 1 of the *imported*
region, not the conversation's first message — the turn index stops at the seam (`TODO.md` §1dm). Until
that is fixed, `show first` is the true beginning.

## 2. GREP BEFORE RE-DERIVING

**The door:** `/chatlog grep <WORDS>` (chunk and line for every hit), `/docs search` and `/docs related`
(the store), `/renders find`, `/recipe negative`, `/lore` — and in the file tools, `grep` before `read`.

**Why it exists:** nearly every question a session asks has already been answered here — a ruling, a
measurement, a dead end, a refusal — and the answer *in the record* is stronger than a memory of it,
because it carries the words and the date. A dead end that is not looked up gets walked again; a
measurement that is not looked up gets guessed at; a ruling that is not looked up gets relitigated.

## 3. WRITE EVERY PASS DOWN

**The door:** the same-pass discipline — `README.md` (what is true now), `TODO.md` (one numbered `§`
section per pass), `src/chronicle/` (the write-up, plus `chronicle.json` and `src/pack/files.json`), and
`src/rtfm/` whenever a command changed. Then the check: `rtfm.check()` empty, the chronicle count, and
`src/pack/files.json` equal to the tree.

**Why it exists:** the next session is not this one. An unwritten pass survives only as long as the chat
window — and this project's chat window has already died once: the record's own head is that death (the
editor's refusal, "MESSAGE TOO LONG, 78,797/64,000 CHARACTERS", and a context compacted to a handoff).
What is written under `src/` ships with the generator and is read by whoever comes next; what is only
said is lost.

## THE FIFTH LANE

| where | whose | what it holds |
| --- | --- | --- |
| `src/lorepack/` | **hers** | what she remembers. Indexed, retrieved, handed to her. |
| `src/rtfm/` | **his** | the manual for the machine: how to USE the terminal. |
| `README.md`, `TODO.md` | **the state** | what the code does now, and what each build changed. |
| `src/chronicle/` | **the making** | how it got here: the sessions, their reasoning, their dead ends. |
| `src/cody/` | **the maker's** | how the building is done: the agent's own standing rules, and the home its pack will take. |

## NOT BUILT YET — THE PACK THESE RULES OPEN

He named this lane on 2026-09-26 as *"the memory of the agent that is doing the making, portable across
his generators"*, and none of it is code yet: `brief` is its first primitive and lives in the chatlog.
Still design, and still open: **the records layer** (decisions, lessons, facts, open items), **the
vocabulary file**, **the `where` query across projects**, and **the portable container**. `src/cody/` is
where they land when he says so.
