# THE RTFM

The manual, kept as documents. `rtfm.json` is the manifest; the `.md` files in this folder are
the documents; `src/js/rtfm.js` is the reader and `/rtfm` is the way in.

These are **for Patrikios, not for LIA**. The LOREPACK (`src/lorepack/`) is what she *remembers*;
this is the manual for the machine she runs on. Nothing here is indexed, retrieved, recalled, or
handed to her on a turn, and nothing here writes to her memory. Keep that true - a manual is not a
memory.

## Adding a document

1. Drop the `.md` file in this folder.
2. List it in `rtfm.json`:

```json
{
  "id": "turn",
  "file": "turn.md",
  "title": "YOUR TURN AND HERS",
  "tags": ["voice", "how-it-works"],
  "desc": "one line saying what it is for - printed in the index and under the title"
}
```

A bare string (`"turn.md"`) also works; the filename is then the title.

3. Nothing else. `/rtfm` lists it from the manifest the next time it is asked, `/rtfm <ID>` prints
   it, and `/rtfm about` prints this recipe from inside the terminal.

Everything in this folder is **PUBLIC** and ships with the generator. Nothing private goes in it.

## Writing a page from the terminal

The pack is not read-only. `/rtfm new [NAME]` and `/rtfm edit <DOC>` open an editor over the terminal
(`src/js/rtfm-edit.js`) - a monospace markdown box with fields for the name, title, tags and one-line
gloss, and a **live preview** built from the same renderer that prints a page, so the pane is not an
impression of the page: it *is* the page. `Ctrl+S` saves, `Esc` closes (twice if there is unsaved
work), `Tab` indents, and DELETE/REVERT arm on the first press and say what they will do before they
do it.

```
/rtfm new [NAME] [:: TITLE]   open the editor on a page of your own
/rtfm edit <DOC>              open a page that exists - shipped or yours - to rewrite it
/rtfm add <DOC> <TEXT>        append a line without opening the editor
/rtfm mine                    what you have written on this device
/rtfm rm <DOC>                drop a page of yours (or a shipped one you rewrote)
/rtfm rm <DOC> confirm        ...and this is what goes through with it
/rtfm revert <DOC> confirm    put a shipped file back in force (the same act, written the other way)
```

**What is written here is kept in THIS BROWSER** - kv, `lia_settings` / `rtfm_local` - and **never in
this folder**: nothing on the page can write a file into the generator. So a page written here is
yours, on that device, until you hand it over: `/rtfm export <NAME>` downloads it as markdown, and
dropping that file in `src/rtfm/` (plus the manifest line above, if it is a page of your own) is what
makes it travel. `/rtfm mine` lists everything you have written, with sizes and dates.

**Rewriting a shipped page SHADOWS it; it does not alter it.** Saving `/rtfm edit turn` keeps your
copy under that name and prints *that*; `src/rtfm/turn.md` is untouched, and `/rtfm rm turn confirm`
(or REVERT in the editor) puts the file back in force. It is the same arrangement as an edited role
layer (`src/js/roles.js`): the shipped thing is the truth, and what you make of it sits on top.

A **generated** page may not be written at all - `/rtfm edit commands` and `/rtfm add commands ...`
are refused, because the command list is the truth and the cheatsheet is a copy of it.

**Nothing unsaved is lost to a reload.** While you type, what you have typed is kept as a DRAFT in
this browser - one kv key per page, `rtfm_draft_<NAME>` - not the page, and never in this folder. Open
the page again in the editor and the draft is put back in the fields, with the time it was written and
the fact that it is the only copy; SAVE turns it into the page, and closing with CANCEL twice (or
REVERT, or DELETE) throws it away. `/rtfm mine` lists the drafts beside the pages, with the command
that puts each one back. This is here because the page can be reloaded at any moment (the terminal's
own machinery does it) and because a phone throws a backgrounded tab away.

## Generated documents

`"generated": true` plus `"from": "<file>"` marks a document the **terminal writes**, not you.
There is one:

- **`commands.md`** - THE SLASH COMMANDS, rendered from `src/commands/commands.json` by
  `/rtfm cheatsheet`. The command list is the one place a command is declared, so a cheatsheet
  written by hand would drift away from the commands that actually exist; this one cannot.

The staleness story is the same shape as `src/pack/`'s generated copies:

- `/rtfm cheatsheet` renders it **right now**, from the live list. The terminal never shows a stale
  cheatsheet.
- `/rtfm check` fetches the copy on disk and compares it, byte for byte, against that render, and
  names the first line that differs.
- `/rtfm export` downloads a fresh copy (or any document) as a file. Drop a fresh `commands.md`
  back here to refresh the copy - or ask your agent to do it.

Printing a generated document that has fallen behind **says so in its own header** rather than being
shown as if it were current.

## How the documents are read

Markdown, rendered for a monospace window (`toTerminal()` in `src/js/rtfm.js`):

- headings become ruled banners, `#` with `=`, `##` with `-`, `###` with a bullet
- tables become aligned columns (the last column takes the slack, capped at 60 characters)
- lists keep their indentation, `>` quotes are indented, `---` becomes a rule
- code fences pass through untouched
- `**bold**`, `*italic*`, `` `code` `` and `[text](url)` are unwrapped - the emphasis is not worth
  the punctuation in a terminal

It understands that subset on purpose. Anything it does not understand is printed as it stands
rather than swallowed, so a document can never lose words to the renderer.

## Reading one from the terminal

```
/rtfm                  the index: the documents, and the verbs
/rtfm <DOC>            print a document  (e.g. /rtfm turn)
/rtfm <COMMAND>        one command's page: usage, kind, whole description  (e.g. /rtfm voice)
/rtfm cheatsheet       the whole command cheatsheet, rendered from the live list
/rtfm check            whether the shipped commands.md still matches the live list
/rtfm export <DOC>     download it as markdown (commands = a fresh cheatsheet)
/rtfm about            this document, printed from inside the terminal
/rtfm doc <NAME>       force a document when a document shares a command's name
/rtfm cmd <NAME>       force a command page
/rtfm mine             the pages written on this device
/rtfm new [NAME]       write a new page here (the editor opens)
/rtfm edit <DOC>       rewrite a page that exists - shipped or yours
/rtfm add <DOC> <TEXT> append a line without the editor
/rtfm rm <DOC> [confirm]  drop a page written here (or a rewrite of a shipped one)
```
