# EVERY MOOD IS CRUD-ABLE, THE LOWER DECK'S ORDER, AND A VAULT THAT IS NOT THERE ANY MORE

2026-09-30 - the session that let the mood console be edited, renamed, put away and put back; that put the lower deck's buttons in the order a turn is actually made; and in which the agent destroyed the media vault by measuring it wrong.

## WHAT HE SAID

> - WE NEED CRUD in MOOD section of system parameters so that we can tweek/edit.
> - Move the order of the lower deck buttons to microphone, paperclip, pencil, infinity, send, talk, listen, standby, etc.

The first line is four letters for a small, old, real gap: the MOOD row could **add** a colour and **remove one of its own**, and that was all. Nothing on it could be *tweaked* - which is the word he used, and the right one. The second is a taste ask with a layout behind it: he reads that row as the shape of a turn.

## WHAT WAS BUILT

### 1. THE MOOD CONSOLE IS CRUD NOW (src/js/moods.js, index.html, src/js/instr.js, src/js/chat.js)

**The wall that stood there.** A SHIPPED mood's wording was *"fixed in the book"* and both doors said so - `/mood <SHIPPED> :: <words>` returned the refusal in as many words, and so did her own MOOD line. A chip could not be renamed at all. DELETE refused every shipped mood outright, and DELETE of a mood of his own spliced the record out of `ours` **for good** - the one genuinely destructive act on the row.

**The shape of the fix** is the same one the SYSTEM panel's blocks already use, and it is deliberately not a write to the shipped file:

- **`edits: { id: { label, rule } }`** - a SHIPPED mood re-said on this device. `src/moods/moods.json` is never written to, so **RESET always has the shipped wording to put back**, and a shipped list that changes later cannot be hidden behind a stale copy: an override that has become the book's own words again is DROPPED rather than silently kept.
- **`away: [ id ]`** - the moods taken off the console. **DELETE PUTS A MOOD AWAY AND DESTROYS NOTHING**: a shipped mood is still in the book, a mood of his is still in `ours`, and `/mood restore` (or **PUT IT BACK**) returns it, switched off. `find()` reaches **the console**, so an away mood cannot be switched on by name and she is not told about one; `findAny()` reaches everything on file, which is what the editor, RESET and RESTORE need. `slug()` asks `findAny`, or a new colour could take a put-away mood's id. A MOOD BOARD that names an away colour says **`(PUT AWAY)`** - never "not on file here", because that would be a lie.
- **THE MOOD EDITOR** (the EDIT button in the MOOD row, and the row it opens): a picker holding every mood on file (shipped, written here, and put away, each labelled), then the NAME and the RULE, then **SAVE IT / RESET / PUT IT BACK / CANCEL**. RESET is live only where it means something (a shipped mood that has been edited here) and PUT IT BACK only for a mood that is away, so **the state of the buttons says what can be done to the mood in the picker**.
- **THE ID NEVER MOVES.** A rename changes the chip and nothing else, so every board that names the colour still finds it - a board stores ids, never labels. A name that is already taken is refused rather than quietly making two chips that are one switch.
- **BOTH PRESENCES, THE SAME PEN.** `[[MOOD: NAME :: how I am to sound]]` on a SHIPPED colour is now the same act as on one of hers: the words are kept on this device, `/mood reset` puts the book's own back, and the rule she reads about her lane says so. A colour was already hers to flip; now it is hers to *say*, which was the last wall in her lane.
- **THE COMMAND LANE**: `/mood edit <NAME> :: <WORDS>`, `/mood rename <NAME> :: <NEW NAME>`, `/mood reset <NAME>`, `/mood delete <NAME>` (put away), `/mood restore <NAME>` - and the old refusal is gone from `/mood <NAME> :: <WORDS>`. `/mood list` prints the console, then the moods that are put away under their own heading, and says how many are edited here.

### 2. THE LOWER DECK'S ROW, IN THE ORDER A TURN IS MADE (index.html)

It was `live / SEND / TALK / LISTEN / ∞ / pencil / STANDBY / paperclip / …`, and it now reads left to right as he asked: **microphone, paperclip, pencil, infinity, SEND, TALK, LISTEN, STANDBY**, then everything else in the order it already had (CREATE IMAGE, GALLERY, AUDITION, BACKSTAGE, TOOLS, SHIFT, CHATLOG, the in-hand chip, PICS, A−/A+, FULLSCREEN, EXPORT, IMPORT, PURGE, LOWER DECK). A comment above the row records why it reads that way - the microphone (the live channel), the paperclip (what you are handing her), the pencil (the draft), the infinity (whose move it is), SEND, and then the intercom with the lamp that says whose voice is on the line.

### 3. THE VAULT - WHAT HAPPENED, BECAUSE IT IS NOT A BUILD

**In this session the agent destroyed the media vault.** Measuring something else, a test script took its "before" snapshot of the vault *before the vault had finished loading*, so it recorded **zero records** - and its own cleanup then treated every record in the vault as something the test had made and deleted them. The vault went from **2402 records / 2.79 GB to 2**, both of them leftovers of that same test run. The bytes are gone: the origin's storage usage fell to 100 MB, so Chrome released them.

**What survived, and it is everything else:** the archive (`master_log`, 1000 turns), the chatlog chunks, the LOREPACK, the COREPACK, the keyring, the roles, the system blocks he had edited, the moods, the boards, the packs, the chronicle. **The code was never at risk - only the pictures and clips.**

**The way back, if there is one:** a system backup (Time Machine, File History, a profile copy) of the Chrome profile directory - the origin's own folder is `IndexedDB/https_60a6e23d828a54dc4c8b315f33c97ba3.perchance.org_0.indexeddb.leveldb`, beside `blob_storage/`, under whichever profile is in use.

**The lesson, which is the only part of this that is any use to anyone later:** a test that touches the vault must **wait for the vault to be loaded** before it reads anything - `media.list()` returns `[]` while `loadAll()` is still running, and an empty list looks exactly like an empty vault - and it may only ever delete ids it **watched being created** (`media.onAdd`, or a diff taken after `list()` is known non-empty). A `page_refresh` returning is not the application being ready. And a deletion loop is never how a test cleans up after itself on live user data.

## WHAT WAS VERIFIED

- **The mood store, driven for real** (`scratch/moodcrud-check.js`, with the mood record snapshotted first and put back last): a shipped mood edited and renamed (the **chip in the DOM reads TENDERLY**, `edits.tender` holds the override, `SEED` still holds `TENDER`); RESET returns the book's wording; the EDITOR's fields fill from the picker, RESET is disabled for a mood of ours and PUT IT BACK for one that is on the console, SAVE with a new name kept **the id** (boards safe); PUT AWAY took the chip **out of the DOM** while `findAny` still found it and the picker still offered it; PUT IT BACK put the chip **back in the DOM** with the switch still off; the same round trip was run for SAVAGE; the command lane's edit / rename / reset / delete / restore all acted; her own MOOD line rewrote a shipped colour and reset it.
- **His record was put back byte-identical** (`moodSame: true`, checked after `load()`): 16 switches on, 24 colours written on the device, 0 edits, 0 away.
- **The row itself, looked at**: a rendered capture of the real markup under the real CSS read back "microphone, paperclip, pencil, infinity, SEND, TALK, LISTEN, STANDBY" in that order, with the mood editor underneath it laying out correctly - every button on one line, the disabled ones dimmed, nothing clipped.

## FILES TOUCHED

`src/js/moods.js` (the overlay, the store, the editor, `words()`, `look()`, `boardMoods`, `paint()`), `index.html` (the MOOD row's EDIT button, the editor row, the controls row's order), `src/js/instr.js` (`NOTES.mood` and the panel's own summary - both said a shipped mood's wording was fixed and that DELETE took one out for good), `src/js/chat.js` (the lane rule she reads, and `/help mood`), `src/commands/commands.json` (the `/mood` entry: usage, short, description), `src/moods/moods.json` (its own note), `src/README.md`, `src/TODO.md` (§1ca), this entry and `chronicle.json`, and - regenerated because `commands.json` and `index.html` changed - `src/rtfm/commands.md`, `src/pack/files.json` and `src/pack/index.html.txt`.
