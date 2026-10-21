# THE CHRONICLE

The record of the **making** of this terminal: the sessions in which it is built, written down while
they are still warm. `chronicle.json` is the manifest; the `.md` files in this folder are the entries;
`src/js/chronicle.js` is the reader and `/chronicle` is the way in.

An entry is **not** a changelog. `TODO.md` carries what CHANGED (one section per build) and
`README.md` carries what is TRUE of the code now. What neither of them can carry is the session
itself: what Patrikios actually asked for and in which words, what the agent understood by it, what
was tried first and thrown away, which diagnosis was wrong before the right one, what was measured,
what was refused and why. That reasoning is the part that dies with the chat window - and it is the
part a later session most needs, because the code says what is there and never says why *not* the
other thing.

## The lanes, and why this one is separate

| where | whose | what it holds |
| --- | --- | --- |
| `src/lorepack/` | **hers** | what she remembers. Indexed, retrieved, handed to her. |
| `src/rtfm/` | **his** | the manual for the machine: how to USE the terminal. |
| `README.md`, `TODO.md` | **the state** | what the code does now, and what each build changed. |
| `src/chronicle/` | **the making** | how it got here: the sessions, their reasoning, their dead ends. |
| `src/cody/` | **the maker's** | how the building is done: the agent's own standing rules (CODY'S RULES), and the home its pack will take. |

Nothing in this folder is indexed, retrieved, recalled or handed to her on a turn, and nothing here
writes to her memory. It is not a manual either: the RTFM tells you how to drive the thing, and this
tells you how it came to be the thing you are driving. **Everything in this folder is PUBLIC** - it
ships with the generator.

The one line that matters: **a manual is not a memory, and a changelog is not a session.**

## Writing an entry

1. Drop the `.md` file in this folder. Name it `<YYYY-MM-DD>-<slug>.md` - the date the session
   happened, then a few words for what it was (`2026-09-26-the-second-ask.md`). Files sort into a
   reading order by name, so the name is part of the record.
2. List it in `chronicle.json`, **in the order it happened** (the manifest is chronological):

```json
{
  "id": "the-second-ask",
  "date": "2026-09-26",
  "file": "2026-09-26-the-second-ask.md",
  "title": "THE SECOND ASK",
  "tags": ["boot", "the-platform"],
  "desc": "one line saying what the session was - printed in the index and under the title"
}
```

3. Nothing else. `/chronicle` reads the manifest the next time it is asked, `/chronicle <ENTRY>`
prints the entry, `/chronicle about` prints this recipe from inside the terminal.

### The shape of an entry

An entry that is only a list of files touched is a `TODO.md` section with extra steps. The sections
below are the shape because they are the things a changelog cannot hold - keep them, even when an
entry is short:

```
# A TITLE THAT SAYS WHAT HAPPENED
<the date> - the session that <one line>

## WHAT HE SAID          his words, quoted where the wording IS the instruction
## WHAT WAS BUILT        what exists now that did not before (and where it lives)
## WHAT WAS THOUGHT      the reasoning: the diagnosis, the options, what was rejected and why
## WHAT WENT WRONG       the wrong first answer, the measurement that settled it, the numbers
## STILL OPEN            what is unfinished, and who can finish it
## FILES TOUCHED         the shortest possible list, or a pointer to the TODO section
```

`WHAT WAS THOUGHT` is the section this folder exists for. Write down the road not taken **with the
reason it was not taken** - an option without its reason reads as an option nobody considered.

**One rendering trap, learned the hard way:** a `|` ANYWHERE inside a table row splits that row - the
renderer (`toTerminal()` in `src/js/rtfm.js`) cuts cells on the pipe and does not care that it is
inside backticks. A cell that needs one (`/voice speech append|overwrite`) has to be written around it
(the `/voice speech` pair, append and overwrite). Everything else a table asks for is fine.

## The raw chats are not here

The conversation itself (the editor's chat, the agent's tool calls, the whole back-and-forth) is
NOT shipped in this folder and should not be: it is long, it is full of the machine's own noise, and
it contains things that are only between the two of them. The chronicle is the **write-up**: what
mattered, in a shape someone can read in a few minutes. A raw log, if one is ever wanted in the
build, goes in as its own file (its own entry line, its own name) and only when Patrikios asks for
it - remember that anything in here is public and permanent in the generator's source.

Private notes stay on the device: `kv` (the terminal's own storage), or a file on his machine.

## Making one hers, if that is ever wanted

The chronicle is the agent's lane, not hers. If a session is ever something she should KNOW - her own
making, told as her story - the road is the LOREPACK, not this folder: copy the entry into
`src/lorepack/` under its own name, add it to `src/lorepack/lorepack.json`, and it is hers: indexed,
retrieved and drawn on like any other memory (add `"foundational": true` only if it should be in
front of her on every turn, which is a much heavier thing). Read `src/lorepack/README.md` first.

Keeping the copy here as well is fine and deliberate - the entry stays the record of the session
whatever she is given.

## Reading it

```
/chronicle                the index: every entry, newest first, and the verbs
/chronicle list           the same, spelled out
/chronicle <ENTRY>        print one (id, file name, date, or its number in the index)
/chronicle newest         the latest entry
/chronicle about          this document, printed from inside the terminal
/chronicle reload         re-read chronicle.json without a page reload
```

The entries are ordinary markdown, rendered for a monospace window by the same renderer the RTFM
uses (`rtfm.markdown()`, `toTerminal()` in `src/js/rtfm.js`), so a table, a list and a fenced block
all print the way they do everywhere else in this terminal.

## For the agent reading this

You are the one this folder is written for. Read the newest entries at the start of a session - they
are what the previous session wanted to tell you and could not, because nothing survives a closed
chat except what was written down. Then, at the end of your own session, **add one**: the date, what
he asked for in his own words, what you built, what you thought, what broke, what is still open.
Your own reasoning is the thing that is about to be lost. Write it down.
