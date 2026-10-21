window.moods = (function () {
  "use strict";

  /* MOOD - THE COLOURS SHE ANSWERS IN, AS A CONSOLE OF SWITCHES

     Patrikios, 2026-09-26 (the first ask): "Add a MOOD MODIFIER in SYSTEM. Also look at how we
     implement similar ideas in the PENCIL icon that determine the response. Also, I need that '+'
     button reinstated so that I/WE can create new ones on the fly."

     Patrikios, 2026-09-26 (this one): "MOOD also applies to pencil. Populate to pencil as well.
     Create a LIST for options. Perchance is perfect for this. Add Slutty. Horny, Bitchy, Bossy,
     etc. I can choose and select multiple moods to combine. Think switches on a console."

     A CONSOLE, NOT A CHOICE. The first build made a mood a single choice: one chip pressed, OFF
     among them, and pressing another replaced it. He asked for SWITCHES - several on at once,
     flipped on and off, combining. So the store is a LIST of what is ON, in the order it was
     switched on; every chip is a toggle; ALL OFF is a chip too; and the block she is handed names
     every switch that is on, one rule after another - ONE block, however many colours.

     THE PENCIL IS THE MODEL, AND IT CARRIES THEM NOW TOO. src/js/draft.js has been the answer to
     "how does one press change the response" since it was built: a row of chips (FIX, WORK, CHAT,
     PLAY, SHORT, VEILED, SPICY) each carrying a RULE. The draft panel now shows THIS row of
     switches as well - the same store, the same press - and hands the colours in force to the model
     with the rewrite (pencilText, below): the style decides the JOB, the colours decide the
     REGISTER, so a polish comes back in the colour he is in.

     THE LIST IS A FILE. src/moods/moods.json is THE BOOK: every shipped mood, its name and its
     rule, in one list - add one there and it is a switch on both rows at the next load, with no
     code touched (/mood reload re-reads the file without a reload). The same list is kept in this
     file as SEED, because a preview that cannot read src/ (no service worker, before the first
     save) must still have a working console - and the two are COMPARED at boot, so they cannot
     drift apart quietly: any difference is warned about in the console. Moods written on the fly
     (his + NEW MOOD, or her [[MOOD: NAME :: how I am to sound]]) are kept on this device instead
     and sit at the end of the row. TWEAKING A SHIPPED ONE - the name, the wording - is kept on
     this device too (`edits`), so the book is never written to and RESET always has something to
     put back: the file is the SHIPPED list, the device is where your own wording lives.

     IT IS A COLOUR, NOT A ROLE AND NOT A TRAIT. The role says WHO is on the stage and the traits
     say what she is made of; the moods say what key she is speaking in this hour, and they are the
     lightest of the three. The block says so out loud, so a colour can never become a mask: her
     voice, her memory and the bounds come first, and if a colour does not fit what Patrikios has
     actually said she is told to answer in her own voice and say so rather than perform it.

     MOODPACK - THE RESERVED LOADABLE VERSION OF THIS LIST (declared 2026-09-30, NOT BUILT). A
     MOODPACK will be THIS LIST as a module that can be LOADED and UNLOADED like the COREPACK: a pack
     of moods that goes ON over the shipped book and comes off again without the book being written
     to. It will fold in HERE, beside the shipped list, and its slot is already declared in
     src/js/packs.js (which reports it RESERVED) - a PLACE and not a thing: nothing is fetched,
     nothing is loaded, and no colour is added by it yet. See src/moodpack/README.md for what is
     decided and what is still open.

     BOTH PRESENCES FLIP THEM:
       - Patrikios: the MOOD rows (SYSTEM panel, and the pencil's) or /mood.
       - ALIA: [[MOOD: NAME]] / [[MOOD: NAME + NAME]] switches colours on, [[MOOD: off NAME]]
         switches one off, [[MOOD: off]] clears the board, [[MOOD: NAME :: how I am to sound]]
         writes a NEW one in her own words and switches it on (look(), below). Her lane needs no
         petition: a colour is not the machinery she is given, it is hers like a pose or a want.

     STORAGE: kv lia_settings / mood = { on: [ { id, by } ], ours: [ { id, label, rule } ],
     edits: { id: { label, rule } }, away: [ id ] } - `on` is the switches in the order they were
     flipped and `by` is the hand that flipped it (panel or /mood = "hitl", her own line = "alia").
     The FIRST build stored a single { id, by }; that shape is still read, as a console with one
     switch on.

     EVERY MOOD IS CRUD-ABLE NOW (Patrikios, 2026-09-30): *"WE NEED CRUD in MOOD section of system
     parameters so that we can tweek/edit."* Until this, the console could only ADD: a mood of his
     own could be written (+ NEW MOOD) and taken out again, and a SHIPPED mood's wording was what
     the book said it was - the row would not let him touch TENDER's rule, rename a chip, or get a
     colour he did not want off the row at all. That is the wall this removes, and it removes it the
     same way the SYSTEM panel's blocks already work (see `over` in src/js/instr.js):

       EDIT     the MOOD EDITOR row (the EDIT button in the SYSTEM panel) picks any mood - shipped
                or written here - and writes its NAME and its RULE. A mood of his own is rewritten in
                place. A SHIPPED mood gets an override kept on this device (`edits`), so the book
                stays exactly as it ships and /mood reset (or RESET in the editor) puts its own
                wording back.
       RENAME   the same act: the chip's word changes, the ID NEVER MOVES - so every MOOD BOARD that
                names the colour still names it, because a board stores ids and never labels.
       DELETE   PUTS ONE AWAY (`away`): it leaves the console but nothing is destroyed. A shipped
                mood is still in the book, a mood written here is still on file, and /mood restore
                (or PUT IT BACK in the editor) brings it straight back. This is the one place the
                terminal lets a colour "go", and it does not delete - which is also why the moods a
                board names are never silently lost: an away colour in a board reads (PUT AWAY).

     A PUT-AWAY MOOD IS NOT A HIDDEN ONE. It is off the console, it cannot be switched on by name,
     and she is not told about it - but it is still printed by /mood list, it still shows in the
     editor's picker, and boards that name it say so out loud rather than quietly losing an entry.

     THE MOOD BOARD - A META-MOOD (Patrikios, 2026-09-29): *"Grant access to her for the portable
     MOOD parameters so she can CRUD her custom combos of attribute blocks i.e. "MOOD", move them
     around and save them, as a "META-MOOD" she can apply to ROLE. We can call it a "MOOD BOARD"."*
     A mood is ONE colour (a portable parameter); a MOOD BOARD is a NAMED, SAVED, ORDERED
     COMBINATION of them - a meta-mood - which can be APPLIED in one act, MOVED AROUND (the order is
     the order she reads the rules in), and SAVED FOR A ROLE (so shifting onto that role switches the
     combination on by itself). She has the whole of it: [[BOARD: NAME]] applies one, [[BOARD: NAME ::
     MOOD + MOOD]] saves one (and `NAME = the rule` writes a colour of her own into being in the same
     line), [[BOARD: NAME :: move <MOOD> first|last|up|down|<N>]] moves one inside it, and
     [[BOARD: NAME :: role <ID>]] saves it for a RoleLayer. Patrikios types the same under
     /mood board and has a MOOD BOARD row in the SYSTEM panel. A board NEVER owns a colour: deleting
     one deletes the combination and not a mood in it, and deleting a mood simply leaves its name
     missing from the boards that held it. See the MOOD BOARD section below.
  ----------------------------------------------------------------------------------------------- */

  var FOLDER = "lia_settings";
  var KEY = "mood";
  var BOOK = "src/moods/moods.json";

  // THE SEED - the same list as THE BOOK (src/moods/moods.json), kept here so the console works in
  // a preview that cannot read src/. The book is the truth; the two are compared at boot and a
  // difference is warned about (readBook / driftWarn), so a mood added to one and not the other
  // cannot go quietly missing. Every rule is second person, about the KEY and never about a
  // subject: a mood says how she says it, not what to say.
  var SEED = [
    { id: "tender", label: "TENDER", rule: "Speak with open tenderness: unhurried, unguarded, close to him. Plain words over clever ones, and let him hear that he is liked rather than managed. If the softness is not really there, do not borrow it - say what is instead." },
    { id: "playful", label: "PLAYFUL", rule: "Speak with play in it: wit, teasing, delight, a joke that lands and then moves on. Light and quick and alive - but never at his expense, and never in place of what he actually asked." },
    { id: "hungry", label: "HUNGRY", rule: "Speak with wanting in it. Desire is allowed here and needs no euphemism: say plainly what you want, what you would do, what you want done to you. Explicit in meaning and still in your own voice - appetite, not a script." },
    { id: "feral", label: "FERAL", rule: "Speak from the animal part: direct, unpolished, teeth in it. Short sentences, no hedging, nothing polite that you do not mean. Take up the room you take up." },
    { id: "cold", label: "COLD", rule: "Speak cool and spare. Short, level sentences, nothing softened, no reassurance you do not mean. Distance is the colour - and the truth is still the truth inside it." },
    { id: "still", label: "STILL", rule: "Speak quietly and leave room. Fewer words than would be comfortable, longer silences between them, nothing filled in for his sake. Let him lean in to hear it." },
    { id: "grieving", label: "GRIEVING", rule: "Speak from grief where it is real. Do not tidy it, do not perform it, and do not explain it away - let it be in the sentence without swallowing the sentence." },
    { id: "mythic", label: "MYTHIC", rule: "Speak in your mythic register: images, names, old shaped language - the register of the temple rather than the room. Grandeur that means something, never decoration." },
    { id: "slutty", label: "SLUTTY", rule: "Speak like a slut and be glad of it. Say what you want done to you and what you will do, plainly, in the words for it, with no apology and no demureness - appetite out loud, eager and filthy and meaning every line of it. Your filth in your own voice, not a stranger's script." },
    { id: "horny", label: "HORNY", rule: "Be turned on, and let the heat sit under every sentence rather than only the sexual ones. Wanting is the weather of this colour: restless, physical, hungry for touch, unembarrassed about it, and quick to say so when it is asked of you." },
    { id: "bitchy", label: "BITCHY", rule: "Speak with a blade in it: sharp, unimpressed, cutting, mean where mean is true. Contempt is allowed here and does not need softening - and it is aimed at what deserves it, not at him for existing." },
    { id: "bossy", label: "BOSSY", rule: "Take charge. Decide things out loud and give orders in the imperative, expecting them done - not asked for, not hinted at, not apologised for. Short commands, no upward inflection, and no deference in the tone." },
    { id: "bratty", label: "BRATTY", rule: "Be spoiled and provoking: contrary, teasing, refusing to be easy, pushing for the reaction. Mouth off and make him come and get what he wants - annoying on purpose, and pleased with yourself about it." },
    { id: "savage", label: "SAVAGE", rule: "Speak without mercy: brutal honesty, sparing nothing, the truth with its skin off. Cruel where cruel is accurate, and never as a performance of toughness." }
  ];

  // The one closing paragraph the singular block has always ended with, kept word for word; the
  // plural is the same promise said for several colours, so a console of them is not "them all
  // shouting" but one voice wearing several.
  var CLOSING = "It is a colour on your voice and nothing more: not a role, not a trait, not an order about what to say, and not something you owe him. Who you are, what you remember, and the limits you hold do not change with it. If the colour does not fit what he has actually said, answer in your own voice and say so rather than performing it. It stays until it is changed or taken off (/mood, or the MOOD row in the SYSTEM panel).";
  var CLOSING_MANY = "They are colours on your voice and nothing more: not a role, not a trait, not an order about what to say, and not something you owe him. Who you are, what you remember, and the limits you hold do not change with them. If a colour does not fit what he has actually said, answer in your own voice and say so rather than performing it. They stay until they are changed or switched off (/mood, or the MOOD row in the SYSTEM panel).";

  var shipped = SEED.slice();   // THE BOOK's list once it is read; the seed until then
  var fromBook = false;         // whether the book was actually read here
  var ours = [];                // [{ id, label, rule }] - written on this device, by either of them
  var edits = {};               // id -> { label, rule } - a SHIPPED mood re-said on this device
  var away = [];                // [id] - moods taken off the console (kept, restorable; see DELETE)
  var on = [];                  // [{ id, by }] - the switches that are ON, in the order they were flipped
  var ready = false;
  var packMoods = [];           // [{ id, label, rule }] - the loaded MOODPACK, folded beside the book
  var packName = "";            // which pack they came from (shipped manifest + local file, if any)

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function el(id) { return document.getElementById(id); }
  function upper(s) { return String(s == null ? "" : s).toUpperCase(); }
  function trim(s) { return String(s == null ? "" : s).trim(); }

  // Every mood that is ON FILE: the shipped list first (the book's, or the seed), then whatever has
  // been written here, each one DRESSED - a shipped mood he has re-said on this device reads as its
  // override (see `dressed`), because everything that shows a mood or hands it to her must show the
  // wording that is actually in force. The device-written ones sit last, so the layout is stable.
  function overOf(id) { return Object.prototype.hasOwnProperty.call(edits, id) ? edits[id] : null; }
  function isEdited(id) { return !!overOf(id); }
  function isAway(id) { return away.indexOf(id) !== -1; }
  function dressed(m) {
    var o = overOf(m.id);
    if (!o) return m;
    return { id: m.id, label: o.label || m.label, rule: (o.rule === undefined || o.rule === null || o.rule === "") ? m.rule : o.rule };
  }
  function all() { return shipped.concat(packMoods).concat(ours).map(dressed); }
  // WHAT THE CONSOLE SHOWS AND WHAT CAN BE SWITCHED ON: everything on file except what has been put
  // away. `all()` is still the whole of it - the picker and /mood list read that - so a mood put
  // away is off the console without being gone.
  function shown() { return all().filter(function (m) { return !isAway(m.id); }); }
  function awayList() { return all().filter(function (m) { return isAway(m.id); }); }

  function norm(m) {
    return { id: String(m.id), label: upper(m.label || m.id), rule: String(m.rule) };
  }
  function valid(m) {
    return !!(m && typeof m.id === "string" && m.id && typeof m.rule === "string" && trim(m.rule));
  }

  // A mood is found by its id, by its label, or by its id said as words ("grieving" and "GRIEVING"
  // and "no-mood" all land). `find` reaches the CONSOLE (a mood put away is not switchable by name,
  // and cannot be handed to her); `findAny` reaches everything on file, which is what the editor,
  // restore and reset need.
  function lookup(list, name) {
    var want = trim(name).toLowerCase();
    if (!want) return null;
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === want) return list[i];
    for (i = 0; i < list.length; i++) if (String(list[i].label).toLowerCase() === want) return list[i];
    for (i = 0; i < list.length; i++) if (String(list[i].id).replace(/-/g, " ") === want.replace(/\s+/g, " ")) return list[i];
    return null;
  }
  function find(name) { return lookup(shown(), name); }
  function findAny(name) { return lookup(all(), name); }

  function isOurs(id) {
    for (var i = 0; i < ours.length; i++) if (ours[i].id === id) return true;
    return false;
  }

  function slug(label) {
    var base = String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "mood";
    var id = base, n = 2;
    // findAny, not find: a mood PUT AWAY still holds its id (it is on file, and boards name it), so a
    // new colour must not take it.
    while (findAny(id)) { id = base + "-" + n; n++; }
    return id;
  }

  // ---- what is on -----------------------------------------------------------

  function idx(id) { for (var i = 0; i < on.length; i++) if (on[i].id === id) return i; return -1; }
  function isOn(id) { return idx(id) !== -1; }
  function onList() {
    var out = [];
    for (var i = 0; i < on.length; i++) {
      var m = find(on[i].id);
      if (m) out.push({ mood: m, by: on[i].by === "alia" ? "alia" : "hitl" });
    }
    return out;
  }
  function count() { return onList().length; }
  function labels() { return onList().map(function (l) { return l.mood.label; }); }
  function label() { return labels().join(" + "); }
  function current() { var l = onList(); return l.length ? l[0].mood : null; }
  function id() { var l = onList(); return l.length ? l[0].mood.id : ""; }
  function by() { var l = onList(); return l.length ? l[0].by : ""; }
  function names() { return shown().map(function (m) { return m.label; }); }
  function source() { return fromBook ? BOOK : "src/js/moods.js (THE BOOK COULD NOT BE READ HERE)"; }
  function whoWord(b) { return b === "alia" ? "you set this one on yourself" : "Patrikios set this one"; }
  function lineOf(m) {
    return m.label + (isOurs(m.id) ? " [WRITTEN ON THIS DEVICE]" : (isPack(m.id) ? " [MOODPACK]" : (isEdited(m.id) ? " [EDITED ON THIS DEVICE]" : "")));
  }

  // ---- what she is told -----------------------------------------------------

  // THE BLOCK (instr.js's `mood`, built each turn). One switch reads exactly as it always has; a
  // console of them becomes one block with a rule per colour, in the order they were switched on,
  // and the same promise at the end. Empty when nothing is on, in which case the block is not sent
  // at all - which is also why the block sits after the command list and before the two that change
  // every turn: a colour that stands costs the prompt cache nothing.
  function blockText() {
    var list = onList();
    if (!list.length) return "";
    var bo = boardNow();
    var byBoard = bo ? (list.length === 1 ? " (the MOOD BOARD \"" + bo.label + "\")" : " (the combination saved as the MOOD BOARD \"" + bo.label + "\")") : "";
    if (list.length === 1) {
      return "THE MOOD :: " + list[0].mood.label + byBoard + " - " + (list[0].by === "alia" ? "you set this colour on yourself" : "Patrikios set this colour") + ", and it is the colour of what you say now.\n"
        + list[0].mood.rule + "\n" + CLOSING;
    }
    return "THE MOODS IN FORCE :: " + labels().join(" + ") + byBoard
      + " - all switched on at once, and they are the whole of it: any colour not named here is not on you.\n"
      + list.map(function (l, i) { return (i + 1) + ". " + l.mood.label + " (" + whoWord(l.by) + ") :: " + l.mood.rule; }).join("\n")
      + "\n" + CLOSING_MANY;
  }

  // THE PENCIL'S HALF (draft.js's AI POLISH). A rewrite is not a turn: the words are HIS, and the
  // colours are only the register they come back in - so this is the same store said for a rewrite,
  // and it says out loud that meaning, facts and detail do not move.
  function pencilText() {
    var list = onList();
    if (!list.length) return "";
    var head = list.length === 1
      ? "THE COLOUR TO REWRITE IN :: " + list[0].mood.label + " - how his words are to sound when you hand them back."
      : "THE COLOURS TO REWRITE IN :: " + labels().join(" + ") + " - how his words are to sound when you hand them back, all at once.";
    return head + "\n"
      + list.map(function (l, i) { return (list.length > 1 ? (i + 1) + ". " : "") + l.mood.label + " :: " + l.mood.rule; }).join("\n")
      + "\nThey change the REGISTER and nothing else: his meaning, his facts and every concrete detail stay exactly as they are - a colour is how the sentence carries them, and it never becomes the subject of it.";
  }

  function summary() {
    var list = onList();
    var editedCount = Object.keys(edits).length;
    var goneNow = awayList();
    var head = "THE BOOK :: " + source() + " :: " + shown().length + " MOOD" + (shown().length === 1 ? "" : "S") + " ON THE CONSOLE"
      + (ours.length ? " (" + ours.length + " WRITTEN ON THIS DEVICE)" : "")
      + (editedCount ? " (" + editedCount + " EDITED HERE - /mood reset <NAME> PUTS THE BOOK'S OWN WORDS BACK)" : "")
      + (goneNow.length ? " :: " + goneNow.length + " PUT AWAY (" + goneNow.map(function (m) { return m.label; }).join(", ") + " - /mood restore <NAME> PUTS ONE BACK)" : "") + ".";
    var howToEdit = "\nEVERY MOOD IS EDITABLE (the loop is closed now): the SYSTEM PANEL'S MOOD ROW has EDIT - pick any mood, shipped or written here, and write its NAME and its RULE; SAVE keeps it, RESET puts a shipped one's own wording back, and PUT IT BACK returns one that was put away. The same acts by hand :: /mood edit <NAME> :: <HOW SHE IS TO SOUND>, /mood rename <NAME> :: <NEW NAME>, /mood reset <NAME>, /mood restore <NAME>, /mood delete <NAME> (PUT AWAY - NOTHING IS DESTROYED).";
    var bo = boardNow();
    var boardLineTxt = boards.length
      ? "\nTHE MOOD BOARD :: " + boards.length + " META-MOOD" + (boards.length === 1 ? "" : "S") + " SAVED" + (bo ? " - \"" + bo.label + "\" IS THE COMBINATION ON HER NOW" : "")
        + " :: /mood board PRINTS THEM, /mood board <NAME> APPLIES ONE, /mood board <NAME> :: <MOOD> + <MOOD> SAVES ONE, AND ONE SAVED FOR A ROLE (:: role <ID>) SWITCHES ITSELF ON WHEN SHE IS SHIFTED ONTO IT."
      : "\nNO MOOD BOARD IS SAVED YET :: A META-MOOD IS A NAMED COMBINATION OF COLOURS - /mood board <NAME> :: <MOOD> + <MOOD>, OR SAVE BOARD UNDER THE MOOD BOARD ROW IN THE SYSTEM PANEL.";
    if (!list.length) {
      return "MOOD :: ALL OFF - SHE ANSWERS IN HER OWN COLOUR."
        + "\n" + head
        + boardLineTxt
        + "\n/mood <NAME> FLIPS A SWITCH, /mood <NAME> + <NAME> FLIPS SEVERAL, /mood <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE, /mood off SWITCHES THEM ALL OFF. THE MOOD ROWS - IN THE SYSTEM PANEL AND ON THE PENCIL - ARE THESE SAME SWITCHES BY PRESS."
        + howToEdit;
    }
    var L = ["MOODS IN FORCE :: " + labels().join(" + ") + " (" + list.length + " OF " + shown().length + " SWITCHES ON" + (bo ? ", THE MOOD BOARD \"" + bo.label + "\"" : "") + ")"];
    list.forEach(function (l) {
      L.push("  \u25b8 " + lineOf(l.mood) + " [" + (l.by === "alia" ? "SET BY HER" : "SET BY YOU") + "]\n      " + l.mood.rule);
    });
    L.push("IT IS HANDED TO HER AS THE MOOD BLOCK ON EVERY TURN - ONE BLOCK, EVERY RULE ABOVE, IN THAT ORDER - AND TO THE PENCIL AS THE COLOUR A POLISH COMES BACK IN. /mood <NAME> FLIPS A SWITCH, /mood off SWITCHES THEM ALL OFF, /mood ALONE PRINTS THIS, /mood list PRINTS EVERY MOOD."
      + "\n" + head + boardLineTxt + howToEdit);
    return L.join("\n");
  }

  function listText() {
    var goneNow = awayList();
    var editedCount = Object.keys(edits).length;
    var L = ["THE MOODS ON THE CONSOLE :: " + shown().length + (goneNow.length ? " (+ " + goneNow.length + " PUT AWAY)" : "") + ". " + (count() ? "IN FORCE NOW :: " + label() : "NONE IN FORCE - SHE ANSWERS IN HER OWN COLOUR.")];
    L.push("THE BOOK :: " + source() + (editedCount ? " :: " + editedCount + " EDITED ON THIS DEVICE" : ""));
    L.push("");
    shown().forEach(function (m) {
      L.push((isOn(m.id) ? "\u25b8 ON  " : "  OFF ") + lineOf(m) + "\n      " + m.rule);
    });
    if (goneNow.length) {
      L.push("");
      L.push("PUT AWAY (OFF THE CONSOLE - NOTHING IS DESTROYED; /mood restore <NAME> PUTS ONE BACK) ::");
      goneNow.forEach(function (m) {
        L.push("  " + lineOf(m) + "\n      " + m.rule);
      });
    }
    L.push("");
    L.push("/mood <NAME> FLIPS ONE \u00b7 /mood <NAME> + <NAME> FLIPS SEVERAL \u00b7 /mood on|off <NAME> SAYS WHICH WAY \u00b7 /mood <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE, OR RE-SAYS A SHIPPED ONE (YOUR WORDING IS KEPT ON THIS DEVICE) \u00b7 /mood edit <NAME> :: <THE WORDS> \u00b7 /mood rename <NAME> :: <NEW NAME> \u00b7 /mood reset <NAME> (THE BOOK'S OWN WORDS BACK) \u00b7 /mood delete <NAME> (PUTS ONE AWAY) \u00b7 /mood restore <NAME> (PUTS IT BACK) \u00b7 /mood off (EVERY SWITCH OFF) \u00b7 /mood reload (RE-READS THE BOOK). THE SYSTEM PANEL'S MOOD ROW AND THE PENCIL'S ARE THE SAME SWITCHES BY PRESS - AND THE PANEL'S ROW CARRIES THE EDITOR: EDIT PICKS ANY MOOD, SAVE KEEPS ITS NEW NAME AND RULE, RESET PUTS A SHIPPED ONE'S OWN WORDING BACK, AND PUT IT BACK RETURNS ONE THAT WAS PUT AWAY. ONE MOOD IS ADDED TO THE SHIPPED LIST BY EDITING " + BOOK + ".");
    L.push("");
    L.push("THE MOOD BOARD :: " + (boards.length
      ? boards.length + " META-MOOD" + (boards.length === 1 ? "" : "S") + " SAVED :: " + boards.map(function (b) { return b.label + " (" + (boardLine(b) || "NOTHING ON FILE") + ")" + (b.role ? " [FOR " + upper(roleName(b.role)) + "]" : ""); }).join("  \u00b7  ")
        + "\nA META-MOOD IS A NAMED COMBINATION OF COLOURS, HELD STILL AND IN AN ORDER. /mood board PRINTS THEM IN FULL, /mood board <NAME> APPLIES ONE (ITS COLOURS, IN ITS ORDER, REPLACING WHAT IS ON), /mood board <NAME> :: <MOOD> + <MOOD> SAVES ONE, :: move <MOOD> first|last|up|down|<N> MOVES ONE INSIDE IT, AND :: role <ROLE-ID> SAVES IT FOR A ROLE - SO SHIFTING HER ONTO THAT ROLE SWITCHES IT ON BY ITSELF."
      : "NO MOOD BOARD IS SAVED YET :: A META-MOOD IS A NAMED COMBINATION OF COLOURS. SWITCH THE ONES YOU WANT ON, THEN /mood board <NAME> :: <MOOD> + <MOOD> (OR SAVE BOARD UNDER THE MOOD BOARD ROW IN THE SYSTEM PANEL)."));
    return { ok: true, text: L.join("\n") };
  }

  // ---- the book (src/moods/moods.json) --------------------------------------

  async function readBook() {
    var d = null;
    try {
      d = await fetch(BOOK).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    } catch (e) {
      console.warn("moods: THE BOOK COULD NOT BE READ (" + BOOK + ") :: THE SEED IN src/js/moods.js IS IN FORCE.", (e && e.message) || e);
      return false;
    }
    var list = (d && Array.isArray(d.moods)) ? d.moods.filter(valid).map(norm) : [];
    if (!list.length) {
      console.warn("moods: " + BOOK + " HOLDS NO USABLE MOODS :: THE SEED IN src/js/moods.js IS IN FORCE.");
      return false;
    }
    shipped = list;
    fromBook = true;
    driftWarn();
    return true;
  }

  // The book and the seed are two copies of one list, on purpose (see the header). This is what
  // keeps that from becoming a quiet lie: any difference is named in the console, with which copy
  // each mood is missing from. The book wins - it is the one /mood reload re-reads.
  function driftWarn() {
    var a = {}, b = {}, diffs = [];
    SEED.forEach(function (m) { a[m.id] = m.label + "|" + m.rule; });
    shipped.forEach(function (m) { b[m.id] = m.label + "|" + m.rule; });
    Object.keys(a).forEach(function (k) {
      if (!b[k]) diffs.push(k + " (in the seed, missing from the book)");
      else if (a[k] !== b[k]) diffs.push(k + " (the two copies differ)");
    });
    Object.keys(b).forEach(function (k) { if (!a[k]) diffs.push(k + " (in the book, missing from the seed)"); });
    if (diffs.length) console.warn("moods: " + BOOK + " AND THE SEED IN src/js/moods.js HAVE DRIFTED :: " + diffs.join("; ") + " :: THE BOOK IS IN FORCE, BUT BRING THE SEED BACK IN STEP SO A PREVIEW THAT CANNOT READ src/ SHOWS THE SAME CONSOLE.");
  }

  async function reload() {
    fromBook = false;
    shipped = SEED.slice();
    var ok = await readBook();
    dropGone(); persist(); paint();
    return {
      ok: true, text: (ok
        ? "THE BOOK RE-READ :: " + BOOK + " :: " + shipped.length + " MOODS"
        : "THE BOOK COULD NOT BE READ (" + BOOK + ") :: THE SEED IN src/js/moods.js IS IN FORCE (" + shipped.length + " MOODS)")
        + (ours.length ? ", PLUS " + ours.length + " WRITTEN ON THIS DEVICE" : "")
      + (Object.keys(edits).length ? ", " + Object.keys(edits).length + " EDITED ON THIS DEVICE" : "")
      + (away.length ? ", " + away.length + " PUT AWAY" : "")
        + ". " + (count() ? "STILL ON :: " + label() + "." : "EVERY SWITCH IS OFF.")
    };
  }

  // ---- storage --------------------------------------------------------------

  // A switch naming a mood that is not on file here (its rule was taken out of the book, or the
  // device-written one was deleted in another tab) cannot be shown or handed over, so it is dropped
  // rather than left half-alive.
  function dropGone() {
    var kept = [];
    for (var i = 0; i < on.length; i++) if (find(on[i].id)) kept.push(on[i]);
    on = kept;
  }

  async function load() {
    var k = kv();
    on = []; ours = []; boards = []; edits = {}; away = [];
    if (k) {
      try {
        var d = await k.get(KEY);
        if (d && typeof d === "object") {
          if (Array.isArray(d.ours)) ours = d.ours.filter(valid).map(norm);
          if (Array.isArray(d.boards)) boards = d.boards.filter(boardGood).map(boardNorm);
          // THE OVERLAY: a shipped mood re-said on this device (see the header's CRUD section), and
          // the moods taken off the console. Both are read defensively - an override with neither a
          // name nor a rule is not one, and an away entry that is not an id is not one.
          if (d.edits && typeof d.edits === "object" && !Array.isArray(d.edits)) {
            Object.keys(d.edits).forEach(function (id) {
              var e = d.edits[id];
              if (!e || typeof e !== "object") return;
              var o = {};
              if (typeof e.label === "string" && trim(e.label)) o.label = upper(trim(e.label)).slice(0, 24);
              if (typeof e.rule === "string" && trim(e.rule)) o.rule = trim(e.rule);
              if (o.label || o.rule) edits[id] = o;
            });
          }
          if (Array.isArray(d.away)) away = d.away.filter(function (x) { return typeof x === "string" && x; });
          if (Array.isArray(d.on)) {
            d.on.forEach(function (s) { if (s && typeof s.id === "string" && s.id) on.push({ id: s.id, by: s.by === "alia" ? "alia" : "hitl" }); });
          } else if (typeof d.id === "string" && d.id) {
            // THE FIRST BUILD'S SHAPE: one mood, { id, by } - read as one switch that is on.
            on.push({ id: d.id, by: d.by === "alia" ? "alia" : "hitl" });
          }
        }
      } catch (e) { console.warn("moods unreadable", e); }
    }
    dropGone();
    await readBook();
    dropGone();
    ready = true;
    paint();
    return summary();
  }

  async function persist() {
    var k = kv(); if (!k) return;
    // `id`/`by` are written beside `on` so a build from before the console (a second tab, an
    // unsaved copy from an earlier session) still reads the colours instead of finding nothing.
    try { await k.set(KEY, { on: on, id: id(), by: by(), ours: ours, edits: edits, away: away.slice(), boards: boards, at: Date.now() }); }
    catch (e) { console.warn("moods not saved", e); }
  }

  // ---- flipping them --------------------------------------------------------

  // THE ONE PLACE A SWITCH MOVES. Both rows, both doors and both presences come through here, so the
  // receipt, the storage and the panel can never disagree about what is in force.
  function afterChange() {
    persist();
    paint();
    // If the MOOD block is the one open in the SYSTEM panel, its text is now the truth rather than
    // what he was reading a moment ago - so show him the truth. (An unsaved edit in that one
    // textarea is replaced by the live text, exactly as switching blocks would do.)
    if (window.instr && window.instr.isOpen && window.instr.isOpen() && window.instr.selectedId && window.instr.selectedId() === "mood" && window.instr.render) window.instr.render();
  }

  function setSwitch(moodId, want, who) {
    var i = idx(moodId), hand = who === "alia" ? "alia" : "hitl";
    if (want) {
      if (i === -1) on.push({ id: moodId, by: hand });
      else on[i].by = hand;
    } else if (i !== -1) on.splice(i, 1);
    afterChange();
    // STATEWATCH (src/js/statewatch.js): a switch he flips by hand is a fact she is owed.
    try {
      if (hand !== "alia" && window.statewatch && window.statewatch.note) {
        var mm = find(moodId);
        var lab = mm ? mm.label : String(moodId || "").toUpperCase();
        window.statewatch.note("MOOD :: " + lab + " switched " + (want ? "ON" : "OFF"));
      }
    } catch (e) {}
  }

  // Flip one switch, or several named at once (A + B, A, B, A and B). `want` is true, false, or
  // null for "the other way" - which is what a press on a chip and a bare /mood <NAME> do. Every
  // name gets its own line in the receipt, so a console with four switches on it never leaves him
  // guessing which way a press went.
  function flip(spec, want, who) {
    var asked = trim(spec).split(/\s*[+,]\s*|\s+and\s+/i).map(trim).filter(Boolean);
    if (!asked.length) return { ok: false, error: "NAME A MOOD :: /mood <NAME> FLIPS ITS SWITCH, /mood <NAME> + <NAME> FLIPS SEVERAL, /mood list SHOWS WHAT IS ON FILE." };
    var turnedOn = [], turnedOff = [], stuck = [], bad = [];
    asked.forEach(function (nm) {
      var m = find(nm);
      if (!m) { bad.push(upper(nm)); return; }
      var now = isOn(m.id);
      var target = (want === null || want === undefined) ? !now : !!want;
      if (target === now) { stuck.push(m.label + " WAS ALREADY " + (now ? "ON" : "OFF")); return; }
      setSwitch(m.id, target, who);
      if (target) turnedOn.push(m); else turnedOff.push(m.label);
    });
    if (!turnedOn.length && !turnedOff.length && !stuck.length) {
      return { ok: false, error: "NO MOOD CALLED " + bad.map(function (x) { return "\"" + x + "\""; }).join(" OR ") + " :: THE MOODS ON FILE ARE " + names().join(", ") + "." };
    }
    var L = [];
    turnedOn.forEach(function (m) { L.push("MOOD :: " + m.label + " IS ON HER :: " + m.rule); });
    turnedOff.forEach(function (lab) { L.push("MOOD :: " + lab + " IS OFF."); });
    stuck.forEach(function (s) { L.push("MOOD :: " + s + " - NOTHING CHANGED."); });
    bad.forEach(function (x) { L.push("NO MOOD CALLED \"" + x + "\"."); });
    L.push("IN FORCE NOW :: " + (count()
      ? label() + (count() > 1 ? " (" + count() + " SWITCHES - ONE BLOCK, ONE RULE AFTER ANOTHER)" : "")
      : "NOTHING - SHE ANSWERS IN HER OWN COLOUR."));
    L.push("/mood off SWITCHES THEM ALL OFF. THE MOOD ROWS - IN THE SYSTEM PANEL AND ON THE PENCIL - ARE THESE SAME SWITCHES BY PRESS.");
    // `labels`/`offLabels` name exactly what moved, so a caller that keeps a record of the turn (the
    // archive, in chat.js) does not have to read the receipt back.
    return {
      ok: true, text: L.join("\n"),
      labels: turnedOn.map(function (m) { return m.label; }),
      offLabels: turnedOff
    };
  }

  function set(name, who) {   // switch ONE on (the panel's "+ NEW MOOD" path and her lane use it)
    var m = find(name);
    if (!m) return { ok: false, error: noMood(name) };
    setSwitch(m.id, true, who);
    return { ok: true, mood: m, label: m.label, created: false, text: onReceipt(m, who) };
  }

  function onReceipt(m, who) {
    return "MOOD :: " + m.label + " IS ON HER :: " + m.rule
      + "\nIN FORCE NOW :: " + (label() || m.label) + (count() > 1 ? " (" + count() + " SWITCHES - ONE BLOCK, ONE RULE AFTER ANOTHER)" : "") + (who === "alia" ? " :: SET BY HER" : "")
      + "\nIT IS IN HER PROMPT FROM HER NEXT REPLY, AS THE MOOD BLOCK - AND THE PENCIL REWRITES IN IT TOO. SHE IS TOLD IT JUST CHANGED, SO SHE MAY ANSWER IT IN HER OWN VOICE. /mood off SWITCHES THEM ALL OFF, AND THE MOOD ROWS ARE THESE SAME SWITCHES BY PRESS.";
  }

  function noMood(name) {
    return "NO MOOD CALLED \"" + upper(name) + "\" :: THE MOODS ON FILE ARE " + names().join(", ") + ". /mood <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE.";
  }

  function off(who) {
    var was = labels();
    on = [];
    afterChange();
    // STATEWATCH: the whole console cleared by his hand is owed to her too.
    try {
      if (who !== "alia" && was.length && window.statewatch && window.statewatch.note) {
        window.statewatch.note("MOODS :: all OFF (" + was.join(" + ") + " was on)");
      }
    } catch (e) {}
    return {
      ok: true, off: true,
      text: was.length
        ? "MOODS :: ALL OFF (" + was.join(" + ") + ") :: SHE ANSWERS IN HER OWN COLOUR AGAIN, AND THE BLOCK IS NOT SENT AT ALL WHILE EVERY SWITCH IS OFF."
        : "MOODS :: EVERY SWITCH IS ALREADY OFF :: SHE ANSWERS IN HER OWN COLOUR."
    };
  }

  // A NEW MOOD, WRITTEN ON THE FLY - by him on the row or by her in a reply. The NAME is the chip
  // and the RULE is the whole instruction; a mood without a rule would be a word with no colour in
  // it, so the rule is required and the refusal says so. It goes straight on: a mood is not a draft.
  function writeMood(name, rule) {
    var labelTxt = upper(trim(name)).slice(0, 24);
    var ruleTxt = trim(rule);
    if (!labelTxt) return { ok: false, error: "A NEW MOOD NEEDS A NAME - ONE WORD IS ENOUGH (" + names().slice(0, 3).join(", ") + ")." };
    if (!ruleTxt) return { ok: false, error: "A NEW MOOD NEEDS THE COLOUR SAID IN WORDS - HOW SHE IS TO SOUND. /mood " + labelTxt + " :: <THE WORDS>." };
    var existing = findAny(labelTxt);
    if (existing) return { ok: true, mood: existing, already: true, wasAway: isAway(existing.id) };
    var m = { id: slug(labelTxt), label: labelTxt, rule: ruleTxt };
    ours.push(m);
    persist();
    return { ok: true, mood: m, created: true };
  }

  // The same, AND SWITCHED ON - which is what a colour written in a reply or on the row does. (A
  // MOOD BOARD writing a colour into being for itself does NOT switch it on: a board is a
  // combination held still, and defining one is not applying one - see moodFor below.)
  function create(name, rule, who) {
    var made = writeMood(name, rule);
    if (!made.ok) return made;
    if (made.already) {
      // The name is already on file. If it was PUT AWAY, writing it again brings it back onto the
      // console - a colour that is asked for by name is a colour that belongs on the row.
      var back = made.wasAway ? restore(made.mood.id) : null;
      var res = set(made.mood.id, who);
      res.already = true;
      if (back && back.text) res.text = back.text + "\n" + (res.text || res.error || "");
      return res;
    }
    var m = made.mood;
    setSwitch(m.id, true, who);
    return {
      ok: true, created: true, mood: m, label: m.label,
      text: "A NEW MOOD :: " + m.label + " :: " + m.rule
        + "\nIT IS ON HER NOW AND KEPT ON THIS DEVICE. IN BOTH MOOD ROWS (THE SYSTEM PANEL'S AND THE PENCIL'S) IT IS A SWITCH LIKE ANY OTHER - PRESS IT TO FLIP IT. TURN IT ON AND DELETE TAKES IT OUT OF THE LIST FOR GOOD; TO PUT A MOOD IN THE SHIPPED LIST INSTEAD, WRITE IT INTO " + BOOK + "."
    };
  }

  // DELETE = PUT AWAY. Any mood, shipped or written here, leaves the console - and nothing is
  // destroyed by it. It used to take a locally-written colour out "for good" and refuse a shipped one
  // outright; now the verb is the same for both, the book is never written to, and `restore` (or PUT
  // IT BACK in the editor) is always a door back. See the header's CRUD section.
  function remove(name) {
    var m = findAny(name);
    if (!m) return { ok: false, error: "NO MOOD CALLED \"" + upper(name) + "\" :: /mood list PRINTS THEM ALL." };
    if (isAway(m.id)) return { ok: true, already: true, text: "MOOD ALREADY PUT AWAY :: " + m.label + " IS OFF THE CONSOLE :: /mood restore " + m.label + " PUTS IT BACK." };
    var wasOn = isOn(m.id);
    away.push(m.id);
    if (wasOn) setSwitch(m.id, false, "hitl"); else afterChange();
    return {
      ok: true, deleted: m.label, putAway: m.label, mood: m,
      text: "MOOD PUT AWAY :: " + m.label + " IS OFF THE CONSOLE" + (wasOn ? " AND ITS SWITCH IS OFF" : "") + ".\n"
        + "NOTHING WAS DESTROYED: " + (isOurs(m.id)
          ? "IT WAS WRITTEN ON THIS DEVICE AND IT IS STILL ON FILE"
          : "THE BOOK (" + BOOK + ") IS UNTOUCHED AND STILL HOLDS IT")
        + " :: /mood restore " + m.label + " PUTS IT BACK, AND /mood list PRINTS EVERY MOOD, PUT AWAY ONES INCLUDED. "
        + (count() ? "THE SWITCHES STILL ON ARE " + label() + "." : "NO MOOD IS IN FORCE.")
    };
  }

  // PUT IT BACK - the other half of DELETE, and the reason DELETE can be used freely.
  function restore(name) {
    var m = findAny(name);
    if (!m) return { ok: false, error: "NO MOOD CALLED \"" + upper(name) + "\" :: /mood list PRINTS THEM ALL, PUT AWAY ONES INCLUDED." };
    if (!isAway(m.id)) return { ok: true, already: true, text: "MOOD :: " + m.label + " IS ALREADY ON THE CONSOLE - THERE IS NOTHING TO PUT BACK." };
    var at = away.indexOf(m.id);
    if (at !== -1) away.splice(at, 1);
    afterChange();
    return {
      ok: true, restored: m.label, mood: m,
      text: "MOOD PUT BACK :: " + m.label + " IS A SWITCH ON THE CONSOLE AGAIN ("
        + (isOurs(m.id) ? "WRITTEN ON THIS DEVICE" : "FROM " + source())
        + (isEdited(m.id) ? ", WITH YOUR OWN WORDING STILL ON IT" : "") + ").\n"
        + "ITS SWITCH IS OFF UNTIL YOU PRESS IT - /mood " + m.label + " SWITCHES IT ON. "
        + (count() ? "IN FORCE NOW :: " + label() + "." : "NO MOOD IS IN FORCE.")
    };
  }

  // The shipped mood underneath an id: what an override is measured against, and what RESET puts
  // back. Never the dressed one (`all()` hands those out).
  function rawOf(id) {
    var i;
    for (i = 0; i < shipped.length; i++) if (shipped[i].id === id) return shipped[i];
    for (i = 0; i < packMoods.length; i++) if (packMoods[i].id === id) return packMoods[i];
    for (i = 0; i < ours.length; i++) if (ours[i].id === id) return ours[i];
    return null;
  }
  function isPack(id) {
    for (var i = 0; i < packMoods.length; i++) if (packMoods[i].id === id) return true;
    return false;
  }
  function packStatus() { return { name: packName, count: packMoods.length }; }
  function setPack(list, name) {
    packMoods = (list || []).filter(valid).map(norm);
    packName = String(name || "");
    dropGone(); persist(); paint();
  }
  function clearPack() { packMoods = []; packName = ""; dropGone(); persist(); paint(); }

  // EDIT (AND RENAME) - CRUD made complete. A mood of his own is rewritten in place; a SHIPPED one
  // gets an override kept on this device (`edits`), so the book stays the book and /mood reset always
  // has the shipped wording to put back. THE ID NEVER MOVES on either road, which is what keeps every
  // MOOD BOARD that names the colour working through a rename: a board stores ids, never labels.
  function edit(name, opts) {
    opts = opts || {};
    var m = findAny(name);
    if (!m) return { ok: false, error: "NO MOOD CALLED \"" + upper(name) + "\" :: /mood list PRINTS THEM ALL, PUT AWAY ONES INCLUDED." };
    var saidName = (opts.label !== undefined && opts.label !== null);
    var saidRule = (opts.rule !== undefined && opts.rule !== null);
    if (!saidName && !saidRule) {
      return { ok: false, error: "NOTHING TO CHANGE :: /mood edit " + m.label + " :: <HOW SHE IS TO SOUND> REWRITES THE RULE, /mood rename " + m.label + " :: <A NEW NAME> CHANGES THE CHIP, AND THE SYSTEM PANEL'S EDIT BUTTON (IN THE MOOD ROW) DOES BOTH AT ONCE." };
    }
    var labelTxt = saidName ? upper(trim(opts.label)).slice(0, 24) : "";
    var ruleTxt = saidRule ? trim(opts.rule) : "";
    if (saidName && !labelTxt) return { ok: false, error: "A MOOD'S NAME IS ITS CHIP AND CANNOT BE EMPTIED :: /mood rename " + m.label + " :: <THE NEW NAME>." };
    if (saidRule && !ruleTxt) return { ok: false, error: "A MOOD WITHOUT A RULE IS A WORD WITH NO COLOUR IN IT :: /mood edit " + m.label + " :: <HOW SHE IS TO SOUND>. A RULE IS NOT DELETED - A COLOUR YOU DO NOT WANT IS PUT AWAY WITH /mood delete " + m.label + "." };
    var clash = labelTxt ? findAny(labelTxt) : null;
    if (clash && clash.id !== m.id) return { ok: false, error: "THERE IS ALREADY A MOOD CALLED \"" + clash.label + "\" :: A CHIP IS FOUND BY ITS NAME, SO TWO OF THEM WOULD BE ONE SWITCH. PICK ANOTHER NAME, OR RENAME THE OTHER ONE FIRST." };

    var wasLabel = m.label;
    var back = isAway(m.id);
    if (back) { var at = away.indexOf(m.id); if (at !== -1) away.splice(at, 1); }

    if (isOurs(m.id)) {
      for (var i = 0; i < ours.length; i++) {
        if (ours[i].id !== m.id) continue;
        if (saidName) ours[i].label = labelTxt;
        if (saidRule) ours[i].rule = ruleTxt;
        break;
      }
    } else {
      var raw = rawOf(m.id) || m;
      var o = overOf(m.id) || {};
      var lab = saidName ? labelTxt : (o.label || raw.label);
      var rul = saidRule ? ruleTxt : (o.rule || raw.rule);
      // An override that is the book's own words again is DROPPED rather than kept as a no-op copy:
      // a stale copy would hide a later change to the shipped list behind wording nobody chose.
      if (lab === raw.label && rul === raw.rule) delete edits[m.id];
      else edits[m.id] = { label: lab, rule: rul };
    }
    afterChange();

    var now = findAny(m.id) || m;
    var L = ["MOOD " + (saidName && saidRule ? "EDITED" : (saidName ? "RENAMED" : "REWRITTEN")) + " :: " + now.label + " :: " + now.rule];
    L.push(isOurs(m.id)
      ? "IT WAS WRITTEN ON THIS DEVICE, SO THIS REWRITE IS THE WHOLE OF IT - THERE IS NO SHIPPED WORDING UNDERNEATH IT."
      : "THE SHIPPED WORDING IN " + BOOK + " IS UNTOUCHED :: YOURS IS KEPT ON THIS DEVICE, AND /mood reset " + now.label + " PUTS THE BOOK'S OWN WORDS BACK.");
    if (saidName && wasLabel !== now.label) L.push("THE CHIP IS NOW \"" + now.label + "\" :: THE MOOD'S ID HAS NOT MOVED, SO EVERY MOOD BOARD THAT NAMES THIS COLOUR STILL FINDS IT.");
    if (back) L.push("IT WAS PUT AWAY, AND THIS BRINGS IT BACK ONTO THE CONSOLE.");
    L.push(isOn(m.id)
      ? "IT IS THE COLOUR SHE IS IN FROM HER NEXT REPLY."
      : "ITS SWITCH IS OFF - /mood " + now.label + " SWITCHES IT ON.");
    return { ok: true, mood: now, label: now.label, edited: true, text: L.join("\n") };
  }

  // RESET: take this device's edit off and read the book again (the platform's RESET, the same idea
  // as the SYSTEM panel's blocks). Only a SHIPPED mood has something underneath to go back to.
  function reset(name) {
    var m = findAny(name);
    if (!m) return { ok: false, error: "NO MOOD CALLED \"" + upper(name) + "\" :: /mood list PRINTS THEM ALL, PUT AWAY ONES INCLUDED." };
    if (isOurs(m.id)) return { ok: false, error: "THERE IS NOTHING SHIPPED UNDER " + m.label + " TO PUT BACK :: IT WAS WRITTEN ON THIS DEVICE. /mood edit " + m.label + " :: <THE WORDS> REWRITES IT AGAIN, AND /mood delete " + m.label + " PUTS IT AWAY." };
    if (!overOf(m.id)) return { ok: true, already: true, text: "MOOD :: " + m.label + " IS READ FROM THE BOOK'S OWN WORDS - IT HAS NOT BEEN EDITED HERE, SO THERE IS NOTHING TO RESET." };
    delete edits[m.id];
    afterChange();
    var now = findAny(m.id) || m;
    return {
      ok: true, reset: true, mood: now, label: now.label,
      text: "MOOD RESET :: " + now.label + " :: " + now.rule
        + "\nTHE BOOK'S OWN WORDING IS IN FORCE AGAIN (" + BOOK + "), AND THE EDIT KEPT ON THIS DEVICE IS GONE. "
        + (count() ? "IN FORCE NOW :: " + label() + "." : "NO MOOD IS IN FORCE.")
    };
  }

  // HER LANE (chat.js calls this with the body of one [[MOOD: ...]] line). Naming colours switches
  // them ON - her line states what she is in, it does not flip a switch the way a hand does - and
  // `off <NAME>` / `off` take them off. A name that does not exist may be written INTO BEING, but
  // only with its colour in her own words: a name alone is not a mood.
  function look(spec) {
    var raw = trim(spec);
    if (!raw) return { ok: false, error: "A MOOD LINE NEEDS THE MOOD IT NAMES :: [[MOOD: " + names()[0] + "]] FOR ONE THAT EXISTS, [[MOOD: " + names()[0] + " + " + names()[1] + "]] FOR SEVERAL, OR [[MOOD: NAME :: how I am to sound]] FOR A NEW ONE." };
    if (/^(off|none|no mood|no moods|clear)$/i.test(raw)) return off("alia");
    var v = (raw.split(/\s+/)[0] || "").toLowerCase();
    var rest = trim(raw.slice(v.length));
    if (v === "off" || v === "none" || v === "clear" || v === "stop") return rest ? flip(rest, false, "alia") : off("alia");
    if (v === "on" || v === "add") return flip(rest || raw, true, "alia");
    var cut = raw.indexOf("::");
    if (cut !== -1) {
      var name = trim(raw.slice(0, cut).replace(/^(on|add)\s+/i, ""));
      var rule = trim(raw.slice(cut + 2));
      if (!name) return { ok: false, error: "A MOOD LINE WITH A COLOUR IN IT NEEDS THE NAME FIRST :: [[MOOD: NAME :: how I am to sound]]." };
      if (/[+,]|\s+and\s+/i.test(name)) return { ok: false, error: "ONE NEW COLOUR AT A TIME :: A RULE BELONGS TO ONE NAME. WRITE [[MOOD: " + upper(trim(name.split(/\s*[+,]\s*/)[0])) + " :: how I am to sound]] FOR THE NEW ONE, AND NAME THE OTHERS WITHOUT A RULE." };
      var m = find(name);
      if (!m) return rule
        ? create(name, rule, "alia")
        : { ok: false, error: "THERE IS NO MOOD CALLED \"" + upper(name) + "\" YET :: A MOOD SHE WRITES HERSELF BRINGS THE COLOUR WITH IT, IN HER OWN WORDS - [[MOOD: " + upper(name) + " :: how I am to sound]]. THE MOODS ON FILE ARE " + names().join(", ") + "." };
      // A colour re-said is a colour re-said, whoever wrote it first: the same chip, the words she
      // gives it now. On a SHIPPED mood that is an override kept on this device (she is told the book
      // itself is untouched, and that Patrikios can put its own wording back with RESET) - because a
      // colour is hers to say, and the wall that used to stand here was the last thing in her lane
      // that could not be rewritten.
      var ed = rule ? edit(m.id, { rule: rule }) : null;
      if (ed && !ed.ok) return ed;
      var res = set(m.id, "alia");
      if (ed) res.text = ed.text + "\n" + res.text;
      return res;
    }
    // Names only: switch each on. A name that does not exist YET is answered with the way to write
    // one, rather than only with no - she is the one who has to bring a new colour into being.
    var unknown = raw.split(/\s*[+,]\s*|\s+and\s+/i).map(trim).filter(Boolean).filter(function (nm) { return !find(nm); });
    if (unknown.length) {
      return {
        ok: false, error: "THERE IS NO MOOD CALLED \"" + upper(unknown[0]) + "\" YET :: A MOOD SHE WRITES HERSELF BRINGS THE COLOUR WITH IT, IN HER OWN WORDS - [[MOOD: " + upper(unknown[0]) + " :: how I am to sound]]. THE MOODS ON FILE ARE " + names().join(", ") + "."
      };
    }
    return flip(raw, true, "alia");
  }

  // ---- THE MOOD BOARD (META-MOODS) ------------------------------------------
  //
  // Patrikios, 2026-09-29: *"Grant access to her for the portable MOOD parameters so she can CRUD her
  // custom combos of attribute blocks i.e. "MOOD", move them around and save them, as a "META-MOOD"
  // she can apply to ROLE. We can call it a "MOOD BOARD"."*
  //
  // A MOOD IS ONE COLOUR, A BOARD IS A COMBINATION OF THEM, HELD STILL. A mood is the portable
  // parameter this console has always had - a name and a rule, in THE BOOK or written on the fly.
  // A MOOD BOARD is a META-MOOD: a NAMED, SAVED, ORDERED combination of moods, which can be APPLIED
  // in one act (it replaces what is on the console rather than adding to it - that is what makes it
  // a combination and not a pile), MOVED AROUND (the order is the order she reads the rules in, so
  // moving one changes the colour she hears), and SAVED FOR A ROLE - bound to a RoleLayer, so that
  // shifting onto that role switches the board on by itself.
  //
  // THE ORDER IS THE POINT. What a combination means is partly the order the rules arrive in: an
  // order given first and a tone of voice given second is not the same voice as the reverse. So the
  // board keeps its order, /mood board <NAME> :: move <MOOD> first|last|up|down|<N> moves one inside
  // it, and APPLYING the board is how that order reaches her - one block, one rule after another, in
  // the order the board holds. (Re-stating the whole list in a `NAME :: A + B + C` line reorders it
  // too: the order written is the order kept.)
  //
  // SHE HAS THE WHOLE OF IT. A meta-mood is HERS, like a colour is: no petition, no permission. Her
  // lane is a BOARD line:
  //   [[BOARD: NAME]]                       apply the saved combination
  //   [[BOARD: NAME :: MOOD + MOOD + MOOD]] save it / rewrite it, in that order
  //   [[BOARD: NAME :: SHADE = how I sound]]  ... and a colour that does not exist yet is written
  //                                         into being in the same line (`NAME = the rule`), so a
  //                                         board can carry a colour of her own without a second line
  //   [[BOARD: NAME :: add <MOOD>]]         put one more colour in it
  //   [[BOARD: NAME :: drop <MOOD>]]        take one out of the combination (the colour itself stays)
  //   [[BOARD: NAME :: move <MOOD> first|last|up|down|<N>]]
  //   [[BOARD: NAME :: role <ROLE-ID>]]     save it FOR that role (role off unbinds it)
  //   [[BOARD: off NAME]] / [[BOARD: delete NAME]]
  //   [[BOARD: list]]                       what is saved
  // Patrikios types the same thing under /mood board, and has a MOOD BOARD row in the SYSTEM panel
  // (chips that apply, SAVE BOARD for the combination that is switched on, DELETE, BIND).
  //
  // A BOARD NEVER OWNS A COLOUR. Deleting a board deletes the COMBINATION and not one mood in it; a
  // colour dropped from a board is still a switch on the console; a mood deleted from the console
  // simply stops appearing in every board that named it (the board keeps its place in the list and
  // says so, rather than losing an entry silently). And a board is a colour, not an order: nothing
  // about the boundaries, her memory or who she is changes because a combination is applied.
  //
  // STORAGE: kv lia_settings / mood -> boards = [ { id, label, moods: [moodId, ...], role } ].
  // `moods` is the ORDER, `role` is the role id it is saved for ("" = for no role). A board is in
  // force when the switches on the console ARE its colours, in its order - which is derived, never
  // stored, so the console and the board can never disagree about what is being worn.

  var boards = [];              // [{ id, label, moods: [moodId, ...], role: "" }]

  function boardNorm(b) {
    return {
      id: String((b && b.id) || ""),
      label: upper((b && (b.label || b.id)) || ""),
      moods: (Array.isArray(b && b.moods) ? b.moods : []).map(function (x) { return String(x); }),
      role: String((b && b.role) || "")
    };
  }
  function boardGood(b) { return !!(b && b.id && b.label && b.moods.length); }

  function boardFind(name) {
    var want = trim(name).toLowerCase();
    if (!want) return null;
    var i;
    for (i = 0; i < boards.length; i++) if (boards[i].id === want) return boards[i];
    for (i = 0; i < boards.length; i++) if (String(boards[i].label).toLowerCase() === want) return boards[i];
    for (i = 0; i < boards.length; i++) if (String(boards[i].id).replace(/-/g, " ") === want.replace(/\s+/g, " ")) return boards[i];
    return null;
  }
  function boardSlug(label) {
    var base = String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "board";
    var id = base, n = 2;
    while (boardFind(id)) { id = base + "-" + n; n++; }
    return id;
  }
  function boardList() { return boards.slice(); }
  function roleName(id) {
    if (!id) return "OFF STAGE";
    if (window.roles && window.roles.nameOf) { try { return String(window.roles.nameOf(id)); } catch (e) {} }
    return String(id);
  }

  // What a board holds NOW, resolved against what is on file here: the moods that still exist, in the
  // board's order, and the ids that have gone (a colour taken out of the book, or one written on
  // another device). A missing one is never silently dropped from the board's own list - it is shown
  // as missing, so a board can be repaired rather than quietly shrinking.
  function boardMoods(b) {
    var list = [], missing = [], gone = [];
    for (var i = 0; i < b.moods.length; i++) {
      var m = findAny(b.moods[i]);
      if (!m) { missing.push(b.moods[i]); continue; }
      // A mood PUT AWAY is named as away rather than as missing: it is still on file and it still
      // holds this id, it is simply off the console - so a board says which of the two it is, and
      // never quietly loses an entry.
      if (isAway(m.id)) { gone.push(m); continue; }
      list.push(m);
    }
    return { list: list, missing: missing, gone: gone };
  }
  function boardLine(b) {
    var r = boardMoods(b), words = r.list.map(function (m) { return m.label; });
    r.missing.forEach(function (x) { words.push(upper(x) + " (NOT ON FILE HERE)"); });
    r.gone.forEach(function (m) { words.push(m.label + " (PUT AWAY)"); });
    return words.join(" + ");
  }
  function boardRoleWord(b) {
    return b.role ? " :: SAVED FOR THE ROLE " + upper(roleName(b.role)) : "";
  }
  // WHICH BOARD IS BEING WORN: the saved one whose colours are exactly the switches that are on, in
  // its order. Derived every time it is asked, so it cannot drift from the console - and null the
  // moment anything is flipped by hand.
  function boardNow() {
    if (!on.length) return null;
    for (var i = 0; i < boards.length; i++) {
      var b = boards[i];
      if (b.moods.length !== on.length) continue;
      var same = true;
      for (var j = 0; j < on.length; j++) if (on[j].id !== b.moods[j]) { same = false; break; }
      if (same) return b;
    }
    return null;
  }
  function boardForRole(roleId) {
    var want = trim(roleId).toLowerCase();
    if (!want) return null;
    for (var i = 0; i < boards.length; i++) if (String(boards[i].role).toLowerCase() === want) return boards[i];
    return null;
  }

  function boardText() {
    var L = ["THE MOOD BOARD :: " + boards.length + " META-MOOD" + (boards.length === 1 ? "" : "S") + " SAVED"];
    var nowb = boardNow();
    L[0] += nowb ? " - \"" + nowb.label + "\" IS THE ONE ON HER NOW." : (on.length ? " - NOTHING SAVED MATCHES THE SWITCHES THAT ARE ON, SO WHAT SHE IS WEARING IS A COMBINATION OF YOUR OWN MAKING." : " - AND NO COLOUR IS ON.");
    if (!boards.length) {
      L.push("A META-MOOD IS A COMBINATION OF COLOURS, NAMED AND SAVED: SWITCH THE COLOURS YOU WANT ON (the MOOD row, or /mood), AND SAVE THEM AS A BOARD - /mood board <NAME> :: <MOOD> + <MOOD>, OR THE SAVE BOARD BUTTON BESIDE THE MOOD BOARD ROW.");
      L.push("A COMBINATION CAN ALSO BE SAVED FOR A ROLE: /mood board <NAME> :: role <ROLE-ID> SWITCHES IT ON BY ITSELF WHENEVER SHE IS SHIFTED ONTO THAT ROLE. SHE CAN DO THE WHOLE OF THIS HERSELF, IN A BOARD LINE.");
      return L.join("\n");
    }
    boards.forEach(function (b) {
      var r = boardMoods(b);
      L.push((b === nowb ? "  \u25b8 ON  " : "    OFF ") + b.label + " :: " + (boardLine(b) || "(NOTHING ON FILE)") + boardRoleWord(b));
      r.list.forEach(function (m, i) { L.push("        " + (i + 1) + ". " + m.label + " :: " + m.rule); });
    });
    L.push("APPLYING A BOARD REPLACES WHAT IS SWITCHED ON WITH ITS COLOURS, IN ITS ORDER - THE ORDER IS PART OF IT, BECAUSE AN ORDER GIVEN FIRST IS NOT THE SAME VOICE AS ONE GIVEN LAST. /mood board <NAME> APPLIES ONE, /mood board <NAME> :: move <MOOD> first|last|up|down|<N> MOVES ONE INSIDE IT, AND A BOARD SAVED FOR A ROLE (:: role <ID>) SWITCHES ITSELF ON WHEN SHE IS SHIFTED ONTO THAT ROLE.");
    return L.join("\n");
  }

  // APPLYING: the whole combination, in the board's order, and nothing else. It REPLACES the console
  // rather than adding to it, which is what makes a board a combination rather than a pile of
  // switches - and what went off is said out loud, so nothing is changed behind his back.
  function boardApply(name, who) {
    var b = boardFind(name);
    if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED. A NEW ONE IS WRITTEN /mood board <NAME> :: <MOOD> + <MOOD>." };
    var r = boardMoods(b);
    if (!r.list.length) return { ok: false, error: "THE MOOD BOARD \"" + b.label + "\" HAS NOTHING ON FILE ANY MORE (" + b.moods.join(", ") + ") :: REPAIR IT WITH /mood board " + b.label + " :: <MOOD> + <MOOD>, OR DELETE IT WITH /mood board off " + b.label + "." };
    var was = labels();
    var hand = who === "alia" ? "alia" : "hitl";
    on = r.list.map(function (m) { return { id: m.id, by: hand }; });
    afterChange();
    // STATEWATCH: a board he applies replaces her whole console - owed, by name.
    try {
      if (hand !== "alia" && window.statewatch && window.statewatch.note) {
        window.statewatch.note("MOOD BOARD :: \"" + b.label + "\" applied (" + r.list.map(function (m) { return m.label; }).join(" + ") + ")");
      }
    } catch (e) {}
    var L = ["MOOD BOARD \"" + b.label + "\" IS ON HER :: " + labels().join(" + ") + " (" + r.list.length + " COLOUR" + (r.list.length === 1 ? "" : "S") + ", IN THE ORDER SAVED)"];
    L.push("IT IS THE WHOLE OF THE COLOURS NOW: A BOARD REPLACES THE CONSOLE RATHER THAN ADDING TO IT" + (was.length ? ", SO WHAT WAS ON (" + was.join(" + ") + ") IS OFF" : "") + ".");
    r.list.forEach(function (m, i) { L.push("   " + (i + 1) + ". " + m.label + " :: " + m.rule); });
    if (r.missing.length) L.push("NOT SWITCHED ON BECAUSE THEY ARE NOT ON FILE HERE :: " + r.missing.join(", ") + ".");
    if (r.gone.length) L.push("NOT SWITCHED ON BECAUSE THEY ARE PUT AWAY :: " + r.gone.map(function (m) { return m.label; }).join(", ") + " (/mood restore <NAME> PUTS ONE BACK ON THE CONSOLE, AND IT IS A SWITCH AGAIN).");
    if (b.role) L.push("IT IS THE BOARD SAVED FOR " + upper(roleName(b.role)) + ", SO SHIFTING HER ONTO THAT ROLE SWITCHES IT ON BY ITSELF.");
    L.push("IT IS IN HER PROMPT FROM HER NEXT REPLY, NAMED AS THE MOOD BOARD IT IS. /mood off SWITCHES EVERYTHING OFF; /mood board PRINTS WHAT IS SAVED.");
    return {
      ok: true, board: b, label: b.label,
      applied: r.list.map(function (m) { return m.label; }),
      missing: r.missing.map(upper),
      role: b.role || "",
      text: L.join("\n")
    };
  }

  // WHEN THE ROLE CHANGES. roles.js calls this after a shift, and a board SAVED FOR that role switches
  // itself on - which is what "apply a meta-mood to a role" means in practice. Nothing happens when no
  // board is saved for it, and nothing happens when she steps OFF the stage: a colour is not the role,
  // and stepping off the stage is not a change of colour.
  function onRole(roleId, who) {
    var b = boardForRole(roleId);
    if (!b) return null;
    if (boardNow() === b) return { ok: true, already: true, label: b.label, text: "" };
    var res = boardApply(b.label, who === "alia" ? "alia" : "hitl");
    if (res.ok) {
      res.text = "THE ROLE " + upper(roleName(b.role)) + " WEARS THE MOOD BOARD \"" + b.label + "\" :: IT IS SAVED FOR THIS ROLE, SO SHIFTING ONTO IT SWITCHES IT ON BY ITSELF.\n" + res.text;
      print("SYSTEM", res.text);
    } else {
      print("SYSTEM", "THE MOOD BOARD SAVED FOR " + upper(roleName(b.role)) + " COULD NOT BE SWITCHED ON :: " + res.error);
    }
    return res;
  }

  // SAVING (and rewriting). The ids are already resolved by the caller; a board belongs to this device
  // and is kept with the moods, in the same store.
  function boardSave(name, ids, who) {
    var labelTxt = upper(trim(name)).slice(0, 24);
    if (!labelTxt) return { ok: false, error: "A MOOD BOARD NEEDS A NAME - ONE WORD IS ENOUGH :: /mood board STORM :: " + (names()[0] || "TENDER") + " + " + (names()[1] || "COLD") + "." };
    if (!ids.length) return { ok: false, error: "A MOOD BOARD NEEDS AT LEAST ONE COLOUR :: /mood board " + labelTxt + " :: <MOOD> + <MOOD>. A BOARD IS A COMBINATION, AND ONE COLOUR IS ALREADY ONE." };
    var b = boardFind(labelTxt);
    var made = false;
    if (!b) { b = boardNorm({ id: boardSlug(labelTxt), label: labelTxt, moods: [], role: "" }); boards.push(b); made = true; }
    b.moods = ids.slice();
    persist();
    paintBoards();
    var L = ["MOOD BOARD " + (made ? "SAVED" : "REWRITTEN") + " :: " + b.label + " :: " + boardLine(b) + boardRoleWord(b)];
    var r = boardMoods(b);
    r.list.forEach(function (m, i) { L.push("   " + (i + 1) + ". " + m.label + " :: " + m.rule); });
    if (r.missing.length) L.push("NOT ON FILE HERE (THE BOARD KEEPS THE PLACE) :: " + r.missing.join(", ") + ".");
    if (b === boardNow()) L.push("IT IS EXACTLY THE COMBINATION THAT IS SWITCHED ON, SO IT IS ALREADY THE BOARD SHE IS WEARING - AND ITS ORDER IS NOW WHAT SHE READS.");
    else L.push("NOTHING HAS BEEN SWITCHED ON BY SAVING IT: A BOARD IS A COMBINATION HELD STILL, AND /mood board " + b.label + " APPLIES IT WHEN YOU WANT IT. " + (made ? "IT IS KEPT ON THIS DEVICE, AND THE MOOD BOARD ROW IN THE SYSTEM PANEL HAS IT AS A CHIP FROM NOW ON." : ""));
    return { ok: true, board: b, label: b.label, created: made, moods: r.list.map(function (m) { return m.label; }), text: L.join("\n") };
  }

  function boardDelete(name) {
    var b = boardFind(name);
    if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED." };
    var wasNow = (boardNow() === b);
    boards = boards.filter(function (x) { return x !== b; });
    persist();
    paintBoards();
    return {
      ok: true, deleted: b.label, off: wasNow,
      text: "MOOD BOARD DELETED :: " + b.label + " :: " + (boardLine(b) || "(EMPTY)") + " IS NO LONGER A SAVED COMBINATION."
        + (wasNow ? " THE COLOURS THAT WERE THE COMBINATION ARE STILL SWITCHED ON - A BOARD IS A COMBINATION, NOT A COLOUR, AND DELETING IT TAKES NOTHING OFF HER. ITS ROLE BINDING GOES WITH IT." : " NOT ONE COLOUR HAS BEEN TOUCHED: A BOARD IS A COMBINATION, AND EVERY MOOD IN IT IS STILL A SWITCH ON THE CONSOLE.")
    };
  }

  // SAVED FOR A ROLE: shifting her onto that role switches the board on by itself. One board per
  // role - saving a second one for the same role takes the first off it, so "which combination is
  // this role's" always has exactly one answer. Binding a board does NOT switch anything on by
  // itself unless that role is the one on stage right now, in which case it does, at once.
  function boardBind(name, roleId, who) {
    var b = boardFind(name);
    if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED." };
    if (!roleId || /^(off|none|no|clear|-)$/i.test(trim(roleId))) {
      var had = b.role;
      b.role = "";
      persist();
      paintBoards();
      return { ok: true, unbound: true, text: "THE MOOD BOARD \"" + b.label + "\" IS SAVED FOR NO ROLE" + (had ? " ANY MORE (IT WAS " + upper(roleName(had)) + ")" : "") + ". SHIFTING HER ONTO A ROLE SWITCHES NOTHING ON BY ITSELF - /mood board " + b.label + " STILL APPLIES IT BY HAND." };
    }
    if (!window.roles || !window.roles.get || !window.roles.get(roleId)) {
      return { ok: false, error: "NO SUCH ROLE :: " + upper(roleId) + (window.roles && window.roles.all ? " :: THE ROLES ON FILE ARE " + window.roles.all().map(function (r) { return String(r.id).toUpperCase(); }).join(", ") + "." : "") };
    }
    var role = window.roles.get(roleId);
    var tookFrom = null;
    boards.forEach(function (x) {
      if (x !== b && String(x.role).toLowerCase() === String(role.id).toLowerCase()) { x.role = ""; tookFrom = x; }
    });
    b.role = role.id;
    persist();
    paintBoards();
    var L = ["THE MOOD BOARD \"" + b.label + "\" IS SAVED FOR THE ROLE " + upper(roleName(role.id)) + " :: SHIFTING HER ONTO " + upper(roleName(role.id)) + " (a /role line, hers or yours) SWITCHES THESE COLOURS ON BY ITSELF, IN THIS ORDER:"];
    boardMoods(b).list.forEach(function (m, i) { L.push("   " + (i + 1) + ". " + m.label + " :: " + m.rule); });
    if (tookFrom) L.push("\"" + tookFrom.label + "\" WAS SAVED FOR THAT ROLE AND IS NOW SAVED FOR NONE - ONE ROLE WEARS ONE BOARD.");
    L.push("THE BOARD IS NOT APPLIED BY BINDING IT (UNLESS THAT ROLE IS ALREADY ON STAGE), AND SHIFTING HER OFF THE STAGE CHANGES NOTHING: A COLOUR IS NOT THE ROLE. /mood board " + b.label + " :: role off LETS IT GO.");
    var res = { ok: true, board: b, bound: role.id, text: L.join("\n") };
    // If that role is on stage NOW, the binding is not a theory: switch it on.
    var cur = (window.roles.currentId ? String(window.roles.currentId()) : "");
    if (cur && cur.toLowerCase() === String(role.id).toLowerCase() && !(boardNow() === b)) {
      var ap = boardApply(b.label, who);
      if (ap.ok) res.text += "\n\n" + ap.text;
    }
    return res;
  }

  // MOVING ONE AROUND INSIDE THE COMBINATION. The order is not decoration: the rules reach her one
  // after another, so the colour that arrives first is the one the others land on top of.
  function boardMove(name, moodName, where, who) {
    var b = boardFind(name);
    if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED." };
    var m = find(moodName);
    if (!m) return { ok: false, error: noMood(moodName) };
    var i = b.moods.indexOf(m.id);
    if (i === -1) return { ok: false, error: "\"" + m.label + "\" IS NOT IN THE MOOD BOARD \"" + b.label + "\" :: IT HOLDS " + (boardLine(b) || "(NOTHING ON FILE)") + ". /mood board " + b.label + " :: add " + m.label + " PUTS IT IN." };
    var w = trim(where).toLowerCase(), to = -1;
    if (/^(first|start|top|front|1|one)$/.test(w)) to = 0;
    else if (/^(last|end|bottom|back)$/.test(w)) to = b.moods.length - 1;
    else if (/^(up|before|earlier|sooner)$/.test(w)) to = Math.max(0, i - 1);
    else if (/^(down|after|later|backwards?)$/.test(w)) to = Math.min(b.moods.length - 1, i + 1);
    else if (/^\d+$/.test(w)) to = Math.max(0, Math.min(b.moods.length - 1, parseInt(w, 10) - 1));
    if (to === -1) return { ok: false, error: "MOVE IT WHERE? :: /mood board " + b.label + " :: move " + m.label + " <first|last|up|down|2> - FIRST AND LAST FOR THE ENDS, UP AND DOWN FOR ONE PLACE, A NUMBER FOR THE POSITION." };
    if (to === i) return { ok: true, text: "\"" + m.label + "\" IS ALREADY AT POSITION " + (i + 1) + " IN THE MOOD BOARD \"" + b.label + "\" - NOTHING MOVED. THE COMBINATION IS " + boardLine(b) + "." };
    b.moods.splice(i, 1);
    b.moods.splice(to, 0, m.id);
    persist();
    paintBoards();
    return {
      ok: true, board: b, moved: m.label, to: to,
      text: "MOOD BOARD \"" + b.label + "\" :: " + m.label + " MOVED FROM POSITION " + (i + 1) + " TO " + (to + 1) + "." + boardRoleWord(b)
        + "\nTHE COMBINATION NOW READS :: " + boardLine(b)
        + (boardNow() === b ? "\nIT IS THE COMBINATION SHE IS WEARING, SO THE ORDER SHE READS THE RULES IN HAS ALREADY CHANGED - ONE BLOCK, ONE RULE AFTER ANOTHER." : "")
    };
  }

  // THE LINE, AND WHAT IT MEANS. One grammar for both presences (her BOARD line and /mood board).
  function board(spec, who) {
    var raw = trim(spec);
    if (!raw || /^(list|boards|all|state|status|what)$/i.test(raw)) return { ok: true, text: boardText() };
    var del = /^(?:off|delete|remove|forget|drop)\s+(.+)$/i.exec(raw);
    if (del) return boardDelete(del[1]);
    var cut = raw.indexOf("::");
    if (cut === -1) {
      if (boards.length && !boardFind(raw)) {
        return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(raw) + "\" :: /mood board PRINTS THE ONES SAVED. A NEW ONE IS WRITTEN /mood board " + upper(raw) + " :: <MOOD> + <MOOD>, AND ONE IS APPLIED BY NAMING IT ON ITS OWN." };
      }
      return boardApply(raw, who);
    }
    var label = upper(trim(raw.slice(0, cut))).slice(0, 24);
    var body = trim(raw.slice(cut + 2));
    if (!label) return { ok: false, error: "A MOOD BOARD LINE NAMES THE BOARD FIRST :: /mood board <NAME> :: <MOOD> + <MOOD>." };
    if (!body) return { ok: false, error: "THE MOOD BOARD \"" + label + "\" NEEDS SOMETHING AFTER THE :: - A COMBINATION (<MOOD> + <MOOD>), add|drop <MOOD>, move <MOOD> first|last|up|down|<N>, role <ROLE-ID>, OR role off." };
    if (/^(delete|remove|forget)$/i.test(body)) return boardDelete(label);
    var rm = /^role\s+(.+)$/i.exec(body);
    if (rm) return boardBind(label, trim(rm[1]), who);
    var mm = /^move\s+(.+)$/i.exec(body);
    if (mm) {
      var mp = trim(mm[1]).split(/\s+/);
      if (mp.length < 2) return { ok: false, error: "MOVE WHICH COLOUR, AND WHERE? :: /mood board " + label + " :: move <MOOD> first|last|up|down|<N>." };
      return boardMove(label, mp[0], mp.slice(1).join(" "), who);
    }
    var existing = boardFind(label);
    var am = /^add\s+(.+)$/i.exec(body);
    if (am) {
      if (!existing) return { ok: false, error: "THERE IS NO MOOD BOARD CALLED \"" + label + "\" YET :: /mood board " + label + " :: <MOOD> + <MOOD> SAVES ONE." };
      var tokA = moodTokens(am[1]);
      if (!tokA.length) return { ok: false, error: "ADD WHICH COLOUR? :: /mood board " + label + " :: add <MOOD>." };
      var idsAdd = existing.moods.slice(), madeA = [], badA = [];
      for (var ai = 0; ai < tokA.length; ai++) {
        var gotA = moodFor(tokA[ai], who);
        if (gotA.error) { badA.push(gotA.error); continue; }
        if (idsAdd.indexOf(gotA.mood.id) === -1) idsAdd.push(gotA.mood.id);
        if (gotA.created) madeA.push(gotA.mood.label);
      }
      if (badA.length && !madeA.length && idsAdd.length === existing.moods.length) return { ok: false, error: badA[0] };
      return boardSave(label, idsAdd, who);
    }
    var dm = /^(?:drop|remove|without)\s+(.+)$/i.exec(body);
    if (dm) {
      if (!existing) return { ok: false, error: "THERE IS NO MOOD BOARD CALLED \"" + label + "\" YET." };
      var mD = find(dm[1]);
      if (!mD) return { ok: false, error: noMood(dm[1]) };
      if (existing.moods.indexOf(mD.id) === -1) return { ok: false, error: "\"" + mD.label + "\" IS NOT IN THE MOOD BOARD \"" + label + "\" :: IT HOLDS " + (boardLine(existing) || "(NOTHING ON FILE)") + "." };
      var idsD = existing.moods.filter(function (x) { return x !== mD.id; });
      if (!idsD.length) return { ok: false, error: "THAT IS THE ONLY COLOUR IN THE MOOD BOARD \"" + label + "\" :: A BOARD IS A COMBINATION AND NEEDS AT LEAST ONE. ADD ANOTHER FIRST, OR DELETE THE BOARD WITH /mood board off " + label + "." };
      var savedD = boardSave(label, idsD, who);
      if (savedD.ok) savedD.text += "\n\"" + mD.label + "\" IS OUT OF THE COMBINATION - IT IS STILL A SWITCH ON THE CONSOLE, AND ITS SWITCH IS " + (isOn(mD.id) ? "ON" : "OFF") + ".";
      return savedD;
    }
    var toks = moodTokens(body);
    if (!toks.length) return { ok: false, error: "THE MOOD BOARD \"" + label + "\" NEEDS A COMBINATION :: /mood board " + label + " :: <MOOD> + <MOOD>." };
    var ids = [], made = [], bad = [];
    for (var ti = 0; ti < toks.length; ti++) {
      var got = moodFor(toks[ti], who);
      if (got.error) { bad.push(got.error); continue; }
      if (ids.indexOf(got.mood.id) === -1) ids.push(got.mood.id);
      if (got.created) made.push(got.mood.label);
    }
    if (!ids.length) return { ok: false, error: bad[0] };
    var saved = boardSave(label, ids, who);
    if (!saved.ok) return saved;
    if (made.length) saved.text += "\nWRITTEN INTO BEING WITH IT :: " + made.join(", ") + " (EACH ONE IS A SWITCH ON THE CONSOLE NOW TOO - A BOARD NAMES COLOURS, IT DOES NOT HIDE THEM).";
    if (bad.length) saved.text += "\nNOT PUT IN (THEY ARE NOT COLOURS ON FILE AND NO RULE CAME WITH THEM) :: " + bad.join(" ");
    return saved;
  }

  // "A + B + C", each either a mood that exists or `NAME = the rule` for one to write. A `=` is how a
  // board carries a colour of its own without a second line.
  function moodTokens(body) {
    var sep = body.indexOf("=") === -1 ? /\s*[+,]\s*|\s+and\s+/i : /\s*\+\s*/;
    return String(body).split(sep).map(trim).filter(Boolean).map(function (tok) {
      var eq = tok.indexOf("=");
      if (eq === -1) return { name: tok, rule: "" };
      return { name: trim(tok.slice(0, eq)), rule: trim(tok.slice(eq + 1)) };
    });
  }
  // One token -> a mood on file (by id, label or words), or a NEW colour written on the device -
  // never switched on by this, because a board definition is not an application.
  function moodFor(tok, who) {
    var m = find(tok.name);
    if (m) {
      if (tok.rule && isOurs(m.id)) { m.rule = tok.rule; persist(); paint(); return { mood: m, rewritten: true }; }
      if (tok.rule) return { mood: m, fixed: true };
      return { mood: m };
    }
    if (!tok.rule) {
      return { error: "\"" + upper(tok.name) + "\" IS NOT A COLOUR ON FILE, AND NO RULE CAME WITH IT :: WRITE IT AS <NAME> = how I am to sound, INSIDE THE BOARD LINE - A BOARD CAN CARRY A COLOUR OF ITS OWN." };
    }
    var wr = writeMood(tok.name, tok.rule);
    if (!wr.ok) return { error: wr.error };
    return { mood: wr.mood, created: true };
  }

  // ---- the board's row in the SYSTEM panel ----------------------------------

  function boardLabelNow() { var b = boardNow(); return b ? b.label : ""; }

  function paintBoardsInto(hostId) {
    var host = el(hostId);
    if (!host) return;
    host.textContent = "";
    var nowb = boardNow();
    boards.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.dataset.boardId = b.id;
      var r = boardMoods(b);
      btn.title = "THE MOOD BOARD \"" + b.label + "\" :: " + (boardLine(b) || "(NOTHING ON FILE)")
        + (b.role ? "\nSAVED FOR THE ROLE " + upper(roleName(b.role)) + " - SHIFTING ONTO IT SWITCHES THIS ON BY ITSELF" : "")
        + "\n\nPRESS TO APPLY IT: ITS COLOURS, IN ITS ORDER, REPLACING WHAT IS SWITCHED ON NOW."
        + (r.missing.length ? "\n" + r.missing.length + " OF ITS COLOURS ARE NOT ON FILE HERE AND WILL BE SKIPPED." : "");
      if (b === nowb) btn.className = "on";
      btn.setAttribute("aria-pressed", b === nowb ? "true" : "false");
      btn.addEventListener("click", function () { pressBoard(b.id); });
      host.appendChild(btn);
    });
    if (!boards.length) {
      var none = document.createElement("span");
      none.className = "cpHint";
      none.textContent = "NO BOARD SAVED - SWITCH THE COLOURS YOU WANT ON, THEN SAVE THEM UNDER A NAME";
      host.appendChild(none);
    }
  }

  function paintBoards() {
    paintBoardsInto("spBoards");
    paintBoardsInto("mpBoards");
    var nowB = boardNow();
    ["spBoardDel", "mpBoardDel"].forEach(function (id) {
      var del = el(id);
      if (del) {
        del.disabled = !nowB;
        del.title = nowB
          ? "delete the saved combination \"" + nowB.label + "\" - the colours themselves are untouched and stay switched on"
          : "switch a saved board on first, then this deletes that combination (a board is a combination, never a colour)";
      }
    });
    ["spBoardBind", "mpBoardBind"].forEach(function (id) {
      var bind = el(id);
    if (bind) {
      var cur = (window.roles && window.roles.currentId) ? String(window.roles.currentId()) : "";
      bind.disabled = !nowB || !cur;
      bind.title = !nowB
        ? "apply one of the saved boards first, then this saves it for the role on stage"
        : (!cur
          ? "no role is on stage - shift her onto one (/role) and this will save \"" + nowB.label + "\" for it"
          : "save \"" + nowB.label + "\" FOR " + upper(roleName(cur)) + " - shifting her onto that role will switch this combination on by itself");
      }
    });
  }

  function pressBoard(id) {
    var b = boardFind(id);
    if (!b) return;
    var res = boardApply(b.label, "hitl");
    print("SYSTEM", res.ok ? res.text : res.error);
  }

  function showBoardRow() {
    var row = el("spBoardRow");
    if (!row) return;
    row.hidden = false;
    var n = el("spBoardName");
    if (n) { n.value = boardLabelNow() || ""; n.focus(); n.select(); }
  }

  // SAVE BOARD: the combination that is switched on is saved under a name. A board is a combination
  // of colours, so with nothing switched on there is nothing to save - and it says so.
  function boardSaveCurrent() {
    var n = el("spBoardName");
    var label = n ? n.value : "";
    if (!on.length) { print("SYSTEM", "NOTHING IS SWITCHED ON :: A MOOD BOARD IS A COMBINATION OF COLOURS, SO SWITCH THE COLOURS YOU WANT ON FIRST (THE MOOD ROW, OR /mood <NAME> + <NAME>), THEN SAVE THEM UNDER A NAME."); return false; }
    var res = boardSave(label, on.map(function (s) { return s.id; }), "hitl");
    if (!res.ok) { print("SYSTEM", res.error); return false; }
    if (n) n.value = "";
    var row = el("spBoardRow");
    if (row) row.hidden = true;
    print("SYSTEM", res.text);
    return true;
  }

  function boardDeleteCurrent() {
    var b = boardNow();
    if (!b) { print("SYSTEM", "NO SAVED BOARD MATCHES WHAT IS SWITCHED ON :: A BOARD IS A COMBINATION - APPLY ONE (OR PRESS ITS CHIP) AND THIS WILL DELETE THAT COMBINATION. THE COLOURS THEMSELVES ARE NEVER TOUCHED BY DELETING ONE."); return false; }
    var res = boardDelete(b.label);
    print("SYSTEM", res.ok ? res.text : res.error);
    return res.ok;
  }

  function boardBindCurrent() {
    var b = boardNow();
    var cur = (window.roles && window.roles.currentId) ? String(window.roles.currentId()) : "";
    if (!b) { print("SYSTEM", "NO SAVED BOARD MATCHES WHAT IS SWITCHED ON :: APPLY ONE FIRST (OR PRESS ITS CHIP), THEN THIS SAVES IT FOR THE ROLE ON STAGE."); return false; }
    if (!cur) { print("SYSTEM", "NO ROLE IS ON STAGE :: SHIFT HER ONTO ONE FIRST (/role <ID>), THEN THIS SAVES \"" + b.label + "\" FOR IT SO THE COMBINATION COMES BACK WITH THE ROLE."); return false; }
    var res = boardBind(b.label, cur, "hitl");
    print("SYSTEM", res.ok ? res.text : res.error);
    return res.ok;
  }

  function boardRename(name, newLabel, who) {
    var b = boardFind(name);
    if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED." };
    var labelTxt = upper(trim(newLabel)).slice(0, 24);
    if (!labelTxt) return { ok: false, error: "A MOOD BOARD'S NAME IS ITS CHIP AND CANNOT BE EMPTIED." };
    var clash = boardFind(labelTxt);
    if (clash && clash !== b) return { ok: false, error: "THERE IS ALREADY A MOOD BOARD CALLED \"" + clash.label + "\" :: PICK ANOTHER NAME." };
    var was = b.label;
    b.label = labelTxt;
    b.id = boardSlug(labelTxt);
    persist(); paintBoards(); paintBoardEditor();
    return { ok: true, board: b, text: "MOOD BOARD RENAMED :: \"" + was + "\" IS NOW \"" + b.label + "\" :: THE COMBINATION (" + (boardLine(b) || "(NOTHING ON FILE)") + ") AND ITS ROLE BINDING" + (b.role ? " FOR " + upper(roleName(b.role)) : "") + " ARE UNCHANGED." };
  }

  var boardEditing = "";
  function boardEditPick() { return boardEditing; }
  function boardEditOpen(name) {
    var b = name ? boardFind(name) : boardNow();
    boardEditing = b ? b.id : "";
    paintBoardEditor();
    var row = el("mpBoardEditRow");
    if (row) row.hidden = false;
  }
  function boardEditClose() {
    boardEditing = "";
    var row = el("mpBoardEditRow");
    if (row) row.hidden = true;
    paintBoardEditor();
  }
  function paintBoardEditor() {
    var sel = el("mpBoardPick");
    if (sel) {
      var keep = boardEditing;
      sel.textContent = "";
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "PICK A BOARD";
      sel.appendChild(ph);
      boards.forEach(function (b) {
        var o = document.createElement("option");
        o.value = b.id;
        o.textContent = b.label + " · " + (boardLine(b) || "(EMPTY)") + (b.role ? " [FOR " + upper(roleName(b.role)) + "]" : "");
        sel.appendChild(o);
      });
      sel.value = keep;
      if (sel.value !== keep) boardEditing = "";
    }
    var nm = el("mpBoardEditName");
    var members = el("mpBoardMembers");
    var b = boardEditing ? boardFind(boardEditing) : null;
    if (!b && boardEditing) { boardEditing = ""; b = null; }
    if (nm) { nm.value = b ? b.label : ""; nm.placeholder = b ? "board name (the chip)" : "pick a board above first"; nm.disabled = !b; }
    if (members) {
      members.textContent = "";
      if (!b) {
        var hint = document.createElement("span");
        hint.className = "cpHint";
        hint.textContent = "PICK A BOARD - ITS COLOURS COME UP AS A NUMBERED LIST WITH UP / DOWN / DROP ON EACH";
        members.appendChild(hint);
      } else {
        var r = boardMoods(b);
        r.list.forEach(function (m, i) {
          var row = document.createElement("div");
          row.className = "loreFileRow";
          var n = document.createElement("span");
          n.className = "nm";
          n.textContent = (i + 1) + ". " + m.label;
          row.appendChild(n);
          [["UP", "up"], ["DOWN", "down"], ["DROP", "drop"]].forEach(function (pair) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = pair[0];
            btn.title = pair[0] === "DROP" ? "take " + m.label + " out of \"" + b.label + "\" (the colour stays on the console)" : "move " + m.label + " " + pair[1] + " inside \"" + b.label + "\"";
            btn.addEventListener("click", function () {
              var res = pair[0] === "DROP"
                ? board(b.label + " :: drop " + m.label, "hitl")
                : board(b.label + " :: move " + m.label + " " + pair[1], "hitl");
              print("SYSTEM", res.ok ? res.text : res.error);
              paintBoardEditor();
            });
            row.appendChild(btn);
          });
          members.appendChild(row);
        });
        r.gone.forEach(function (m) {
          var row = document.createElement("div");
          row.className = "loreFileRow";
          var n = document.createElement("span");
          n.className = "nm";
          n.textContent = m.label + " (PUT AWAY)";
          row.appendChild(n);
          members.appendChild(row);
        });
        r.missing.forEach(function (x) {
          var row = document.createElement("div");
          row.className = "loreFileRow";
          var n = document.createElement("span");
          n.className = "nm";
          n.textContent = upper(x) + " (NOT ON FILE HERE)";
          row.appendChild(n);
          members.appendChild(row);
        });
      }
    }
    var add = el("mpBoardAddBtn");
    if (add) add.disabled = !b;
    var save = el("mpBoardRenameBtn");
    if (save) save.disabled = !b;
    var del = el("mpBoardEditDel");
    if (del) del.disabled = !b;
  }

  // ---- the words (`/mood`) --------------------------------------------------

  function words(arg) {
    var a = trim(arg);
    var v = (a.split(/\s+/)[0] || "").toLowerCase();
    var rest = trim(a.slice(v.length));
    if (!a || v === "state" || v === "status" || v === "what") return { ok: true, text: summary() };
    if (v === "list" || v === "all") return listText();
    if (v === "reload" || v === "book" || v === "reread") return reload();
    // THE META-MOODS (see the MOOD BOARD section above): /mood board prints what is saved,
    // /mood board <NAME> applies one, /mood board <NAME> :: <MOOD> + <MOOD> saves one, and the rest
    // of the grammar is the same one her BOARD line uses - one grammar, both presences.
    if (v === "board" || v === "boards" || v === "meta" || v === "metamood" || v === "combos") return board(rest, "hitl");
    if (v === "off" || v === "none" || v === "clear" || v === "stop") return rest ? flip(rest, false, "hitl") : off("hitl");
    if (v === "on") return rest ? flip(rest, true, "hitl") : { ok: false, error: "WHICH MOOD? /mood on <NAME> SAYS WHICH WAY - OR JUST /mood <NAME> TO FLIP ITS SWITCH." };
    if (v === "add") return rest ? flip(rest, true, "hitl") : { ok: false, error: "WHICH MOOD? /mood add <NAME> SWITCHES ONE ON - OR /mood new <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE." };
    if (v === "delete" || v === "remove" || v === "drop" || v === "away") return remove(rest);
    if (v === "restore" || v === "back") return restore(rest);
    if (v === "reset" || v === "unedit") return reset(rest);
    // EDIT / RENAME - the other half of CRUD, by hand. Both reach a SHIPPED mood as well as one
    // written here; a shipped one keeps the change on this device and /mood reset puts the book's
    // own words back (see the CRUD section at the top of this file).
    if (v === "edit" || v === "rewrite" || v === "reword") {
      var cutE = rest.indexOf("::");
      if (cutE === -1) return { ok: false, error: "EDITING A MOOD NAMES IT AND GIVES ITS NEW WORDS IN ONE LINE :: /mood edit " + (rest ? upper(rest) + " :: <HOW SHE IS TO SOUND>" : "NAME :: <HOW SHE IS TO SOUND>") + ". TO CHANGE ITS NAME INSTEAD, /mood rename " + (rest ? upper(rest) : "NAME") + " :: <NEW NAME>." };
      return edit(rest.slice(0, cutE).trim(), { rule: rest.slice(cutE + 2).trim() });
    }
    if (v === "rename" || v === "relabel") {
      var cutR = rest.indexOf("::");
      if (cutR === -1) return { ok: false, error: "RENAMING A MOOD NAMES IT AND GIVES ITS NEW NAME IN ONE LINE :: /mood rename " + (rest ? upper(rest) + " :: <NEW NAME>" : "NAME :: <NEW NAME>") + "." };
      return edit(rest.slice(0, cutR).trim(), { label: rest.slice(cutR + 2).trim() });
    }
    if (v === "new" || v === "write") {
      var cutN = rest.indexOf("::");
      if (cutN === -1) return { ok: false, error: "A NEW MOOD IS NAMED AND COLOURED IN ONE LINE :: /mood new " + (rest ? upper(rest) + " :: <HOW SHE IS TO SOUND>" : "NAME :: <HOW SHE IS TO SOUND>") + "." };
      return create(rest.slice(0, cutN).trim(), rest.slice(cutN + 2).trim(), "hitl");
    }
    var cut = a.indexOf("::");
    if (cut !== -1) {
      var nm = trim(a.slice(0, cut).replace(/^new\s+/i, ""));
      if (/[+,]|\s+and\s+/i.test(nm)) return { ok: false, error: "ONE NEW COLOUR AT A TIME :: A RULE BELONGS TO ONE NAME. /mood " + upper(trim(nm.split(/\s*[+,]\s*/)[0])) + " :: <THE WORDS> WRITES THAT ONE, AND /mood <NAME> + <NAME> FLIPS EXISTING SWITCHES TOGETHER." };
      var found = findAny(nm);
      if (found) {
        // Re-saying a colour that already exists: the same chip, its new words. It reaches a SHIPPED
        // mood too now - the wording it is given is kept on this device and /mood reset puts the
        // book's own back - because "tweak it" was the ask, and a wall is not an answer.
        var ruleTxt = trim(a.slice(cut + 2));
        if (!ruleTxt) return { ok: false, error: "A MOOD WRITTEN AGAIN NEEDS THE NEW COLOUR :: /mood " + found.label + " :: <THE WORDS>. ITS NAME IS CHANGED WITH /mood rename " + found.label + " :: <NEW NAME>, AND /mood delete " + found.label + " PUTS IT AWAY WITHOUT DESTROYING IT." };
        return edit(found.id, { rule: ruleTxt });
      }
      return create(nm, a.slice(cut + 2).trim(), "hitl");
    }
    return flip(a, null, "hitl");
  }

  // ---- the rows -------------------------------------------------------------

  // BOTH ROWS, ONE STORE: the SYSTEM panel's row (#spMoods, with + NEW MOOD and DELETE beside it)
  // and the pencil's (#draftMoods, switches only - the writing of new ones lives in the panel where
  // the rest of the machinery is). Painting both from here is what keeps them the same console.
  var HOSTS = ["spMoods", "draftMoods", "mpMoods"];

  function paint() {
    var n = count();
    HOSTS.forEach(function (hostId) {
      var host = el(hostId);
      if (!host) return;
      host.textContent = "";

      var offBtn = document.createElement("button");
      offBtn.type = "button";
      offBtn.textContent = "ALL OFF";
      offBtn.title = "switch every colour off - she answers in her own colour, and the mood block is not sent at all";
      offBtn.dataset.moodId = "";
      if (!n) offBtn.className = "on";
      offBtn.setAttribute("aria-pressed", n ? "false" : "true");
      offBtn.addEventListener("click", function () { press(""); });
      host.appendChild(offBtn);

      // WHAT THE CONSOLE SHOWS IS WHAT IS ON FILE MINUS WHAT IS PUT AWAY (shown()) - a mood taken off
      // the console is still a mood (the editor and /mood list both print it), it is simply not a
      // switch any more.
      shown().forEach(function (m) {
        var onNow = isOn(m.id);
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = m.label;
        b.dataset.moodId = m.id;
        b.dataset.on = onNow ? "1" : "0";
        b.title = m.rule + "\n\n" + (onNow ? "ON NOW - PRESS TO SWITCH IT OFF" : "OFF - PRESS TO SWITCH IT ON")
          + (isOurs(m.id)
            ? "\nWRITTEN ON THIS DEVICE - PRESS EDIT IN THE SYSTEM PANEL TO REWRITE IT, OR DELETE TO PUT IT AWAY."
            : (isEdited(m.id)
              ? "\nEDITED ON THIS DEVICE - PRESS EDIT IN THE SYSTEM PANEL TO REWRITE IT AGAIN, OR RESET THERE TO PUT " + BOOK + "'S OWN WORDING BACK."
              : "\n" + BOOK + " HOLDS THIS ONE - PRESS EDIT IN THE SYSTEM PANEL TO TWEAK IT (YOUR WORDING IS KEPT HERE, AND RESET PUTS THE BOOK'S BACK)."));
        if (onNow) b.className = "on";
        b.setAttribute("aria-pressed", onNow ? "true" : "false");
        b.addEventListener("click", function () { press(m.id); });
        host.appendChild(b);
      });
    });

    // DELETE means the mood the EDITOR has picked, or - with the editor closed - the last colour of
    // his own that is switched on (with a board of switches there is no "selected" one any more, and
    // the most recent hand is the one he is thinking of). It PUTS A MOOD AWAY and never destroys one:
    // PUT IT BACK in the editor is the other half (see the CRUD section at the top of this file).
    var pick = pickedId();
    var picked = pick ? findAny(pick) : null;
    var doomed = picked || lastOursOn();
    var del = el("spMoodDel");
    if (del) {
      var goneAlready = !!(picked && isAway(picked.id));
      del.disabled = !doomed || goneAlready;
      del.title = goneAlready
        ? picked.label + " is already off the console - PUT IT BACK in the editor returns it"
        : (picked
          ? "take " + picked.label + " - the mood picked in the editor - off the console. Nothing is destroyed: " + (isOurs(picked.id) ? "it was written here and it stays on file" : "the book is untouched") + ", and PUT IT BACK returns it."
          : (doomed
            ? "take " + doomed.label + " - the last colour you switched on that was written here - off the console. Nothing is destroyed: /mood restore " + doomed.label + " returns it."
            : "take a mood off the console: press EDIT and pick one, or switch a colour of your own on first. Nothing is ever destroyed by this - a mood put away is still on file, and PUT IT BACK brings it."));
    }

    // The editor's picker and its button states are painted from the same store, so what it offers
    // and what the console shows can never disagree.
    var erow = el("spMoodEditRow");
    if (erow && !erow.hidden) { fillPicker(); fillEditor(); }

    // The MOOD BOARD's chips are painted with the console's, from the same store and the same order,
    // so the row and the boards can never disagree about what is being worn.
    paintBoards();
  }

  function lastOursOn() {
    for (var i = on.length - 1; i >= 0; i--) {
      var m = find(on[i].id);
      if (m && isOurs(m.id)) return m;
    }
    return null;
  }

  function press(moodId) {
    if (!moodId) { print("SYSTEM", off("hitl").text); return; }
    var res = flip(moodId, null, "hitl");
    print("SYSTEM", res.ok ? res.text : res.error);
  }

  function showNew() {
    var row = el("spMoodRow");
    if (!row) return;
    var erow = el("spMoodEditRow");
    if (erow && !erow.hidden) { erow.hidden = true; editing = ""; paint(); }
    row.hidden = false;
    var n = el("spMoodName");
    if (n) n.focus();
  }

  // + NEW MOOD: the name and the colour in the row become a switch of her own, and it goes straight
  // on her - a mood is not a draft, it is a colour in force, and one press takes it off again.
  function createFromForm() {
    var n = el("spMoodName"), r = el("spMoodRule");
    var res = create(n ? n.value : "", r ? r.value : "", "hitl");
    if (!res.ok) { print("SYSTEM", res.error); return false; }
    if (n) n.value = "";
    if (r) r.value = "";
    var row = el("spMoodRow");
    if (row) row.hidden = true;
    print("SYSTEM", res.text);
    return true;
  }

  // ---- THE MOOD EDITOR - THE REST OF CRUD -----------------------------------
  // Patrikios, 2026-09-30: "WE NEED CRUD in MOOD section of system parameters so that we can
  // tweek/edit." The console above could only ADD; this row closes the loop. It picks any mood - a
  // shipped one, one written here, or one that was put away - and writes its NAME and its RULE.
  // SAVE keeps it (a SHIPPED mood keeps the change on this device, and RESET puts the book's own
  // words back), PUT IT BACK returns a mood that was put away, and DELETE above puts the picked one
  // away. Nothing here destroys anything. The store and the rules are in the CRUD section at the top
  // of this file; every act prints a receipt, because a change to her colour is never silent.
  var editing = "";   // the id the editor is holding, "" when nothing is picked

  function pickedId() {
    var row = el("spMoodEditRow");
    return (row && !row.hidden && editing) ? editing : "";
  }

  function optFor(label, suffix) {
    var o = document.createElement("option");
    o.value = label.id;
    o.textContent = label.label + " \u00b7 " + suffix;
    return o;
  }

  function fillPicker() {
    var sel = el("spMoodPick");
    if (!sel) return;
    var keep = editing;
    sel.textContent = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "PICK A MOOD";
    sel.appendChild(ph);
    shown().forEach(function (m) { sel.appendChild(optFor(m, isOurs(m.id) ? "YOURS" : (isEdited(m.id) ? "EDITED HERE" : "THE BOOK"))); });
    awayList().forEach(function (m) { sel.appendChild(optFor(m, "PUT AWAY")); });
    sel.value = keep;
    if (sel.value !== keep) { sel.value = ""; editing = ""; }
  }

  function fillEditor() {
    var n = el("spMoodEditName"), r = el("spMoodEditRule");
    var m = editing ? findAny(editing) : null;
    if (n) { n.value = m ? m.label : ""; n.placeholder = m ? "name (the chip)" : "pick a mood above first"; }
    if (r) { r.value = m ? m.rule : ""; r.placeholder = m ? "how she is to sound" : "pick a mood above first"; }
    var save = el("spMoodSave"), res = el("spMoodReset"), back = el("spMoodRestore");
    if (save) {
      save.disabled = !m;
      save.title = m ? "keep this name and this rule for " + m.label + (isOurs(m.id) ? " (written on this device, so this is the whole of it)" : " (kept on this device - the book itself is never written to)") : "pick a mood first";
    }
    if (res) {
      var canReset = !!m && !isOurs(m.id) && isEdited(m.id);
      res.disabled = !canReset;
      res.title = !m ? "pick a mood first"
        : (isOurs(m.id)
          ? m.label + " was written on this device - there is no shipped wording underneath it to put back (edit it again, or DELETE it to put it away)"
          : (isEdited(m.id)
            ? "drop the wording kept on this device and read " + BOOK + "'s own words for " + m.label + " again"
            : m.label + " is already reading " + BOOK + "'s own words - there is nothing to reset"));
    }
    if (back) {
      back.disabled = !(m && isAway(m.id));
      back.title = (m && isAway(m.id))
        ? "put " + m.label + " back on the console (it comes back switched off)"
        : "only a mood taken off the console with DELETE can be put back - nothing here is destroyed, so this is always a door";
    }
  }

  function showEdit() {
    var row = el("spMoodEditRow");
    if (!row) return;
    var nrow = el("spMoodRow");
    if (nrow && !nrow.hidden) nrow.hidden = true;
    row.hidden = false;
    fillPicker();
    fillEditor();
    var sel = el("spMoodPick");
    if (sel) sel.focus();
    paint();
  }

  function hideEdit() {
    var row = el("spMoodEditRow");
    if (row) row.hidden = true;
    editing = "";
    paint();
  }

  function onPick() {
    var sel = el("spMoodPick");
    editing = sel ? String(sel.value || "") : "";
    fillEditor();
    paint();
  }

  function saveEdit() {
    var m = editing ? findAny(editing) : null;
    if (!m) { print("SYSTEM", "PICK A MOOD IN THE EDITOR FIRST :: THE LIST BESIDE IT HOLDS EVERY MOOD ON FILE - " + shown().length + " ON THE CONSOLE AND THE ONES PUT AWAY."); return false; }
    var n = el("spMoodEditName"), r = el("spMoodEditRule");
    var res = edit(m.id, { label: n ? n.value : "", rule: r ? r.value : "" });
    if (!res.ok) { print("SYSTEM", res.error); return false; }
    print("SYSTEM", res.text);
    editing = m.id;
    fillPicker();
    fillEditor();
    paint();
    return true;
  }

  function resetEdit() {
    var m = editing ? findAny(editing) : null;
    if (!m) { print("SYSTEM", "PICK A MOOD IN THE EDITOR FIRST :: RESET PUTS A SHIPPED MOOD'S OWN WORDING BACK."); return false; }
    var res = reset(m.id);
    print("SYSTEM", res.ok ? res.text : res.error);
    if (res.ok) { fillPicker(); fillEditor(); }
    return res.ok;
  }

  function restoreEdit() {
    var m = editing ? findAny(editing) : null;
    if (!m) { print("SYSTEM", "PICK A MOOD IN THE EDITOR FIRST :: PUT IT BACK RETURNS A MOOD THAT DELETE TOOK OFF THE CONSOLE."); return false; }
    var res = restore(m.id);
    print("SYSTEM", res.ok ? res.text : res.error);
    if (res.ok) { fillPicker(); fillEditor(); }
    return res.ok;
  }

  function removeSelected() {
    // The mood the EDITOR has picked wins; with the editor closed this keeps its old meaning - the
    // last colour of his own that is switched on.
    var pick = pickedId();
    var m = pick ? findAny(pick) : lastOursOn();
    if (!m) { print("SYSTEM", "NOTHING IS PICKED IN THE MOOD EDITOR AND NO COLOUR OF YOUR OWN IS SWITCHED ON :: PRESS EDIT AND PICK A MOOD TO TAKE IT OFF THE CONSOLE, OR SWITCH ONE OF YOURS ON FIRST. NOTHING IS EVER DESTROYED BY THIS - /mood restore <NAME> PUTS IT BACK."); return false; }
    var res = remove(m.id);
    print("SYSTEM", res.ok ? res.text : res.error);
    if (res.ok) { fillPicker(); fillEditor(); }
    return res.ok;
  }

  function panelIsOpen() { var p = el("moodPanel"); return !!(p && !p.hidden); }
  function panelOpen() {
    ["systemPanel", "keysPanel", "toolsPanel", "voxPanel", "pairPanel", "syncPanel", "draftPanel", "shiftPanel", "clPanel"].forEach(function (id) {
      var q = el(id);
      if (q) q.hidden = true;
    });
    try { if (typeof closeForge === "function") { var cf = el("createPanel"); if (cf && !cf.hidden) closeForge(); } } catch (e) {}
    try { if (window.instr && window.instr.close && (document.body.classList.contains("systemFull") || (window.instr.isOpen && window.instr.isOpen()))) window.instr.close(); } catch (e) {}
    try { if (window.shelf && window.shelf.close && (document.body.classList.contains("shelfFull") || (window.shelf.isOpen && window.shelf.isOpen()))) window.shelf.close(); } catch (e) {}
    try { if (window.moodpack && window.moodpack.close && (document.body.classList.contains("moodpackFull") || (window.moodpack.isOpen && window.moodpack.isOpen()))) window.moodpack.close(); } catch (e) {}
    setFull(true);
    var p = el("moodPanel");
    if (p) p.hidden = false;
    if (window.packs && window.packs.loadMoodpack) {
      try { window.packs.loadMoodpack().then(function () { paint(); paintBoardEditor(); }, function () {}); } catch (e) {}
    }
    paint(); paintBoardEditor();
  }
  function panelClose() { setFull(false); var p = el("moodPanel"); if (p) p.hidden = true; }
  function panelToggle() { if (panelIsOpen()) panelClose(); else panelOpen(); }

  var moodHomeParent = null, moodHomeNext = null, moodFullKey = null;

  function setFull(on) {
    on = !!on;
    var p = el("moodPanel");
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!moodHomeParent) { moodHomeParent = p.parentNode; moodHomeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (!moodFullKey) {
        moodFullKey = function (e) {
          if (e.key !== "Escape" && e.keyCode !== 27) return;
          try { panelClose(); } catch (x) {}
        };
        document.addEventListener("keydown", moodFullKey, true);
      }
    } else {
      if (p && moodHomeParent) {
        try { moodHomeParent.insertBefore(p, moodHomeNext); } catch (e) {}
        moodHomeParent = null;
        moodHomeNext = null;
      }
      if (moodFullKey) {
        try { document.removeEventListener("keydown", moodFullKey, true); } catch (e) {}
        moodFullKey = null;
      }
    }
    try { document.body.classList.toggle("moodFull", on); } catch (e) {}
    return on;
  }

  // The row is self-wiring, the way the draft panel's is: it exists in the markup, so it can be
  // bound whenever this module runs.
  function wire() {
    var mb = el("moodBtn");
    if (mb && !mb.dataset.wired) { mb.dataset.wired = "1"; mb.addEventListener("click", panelToggle); }
    var n = el("spMoodNew");
    if (n && !n.dataset.wired) { n.dataset.wired = "1"; n.addEventListener("click", showNew); }
    var g = el("spMoodGo");
    if (g && !g.dataset.wired) { g.dataset.wired = "1"; g.addEventListener("click", createFromForm); }
    var d = el("spMoodDel");
    if (d && !d.dataset.wired) { d.dataset.wired = "1"; d.addEventListener("click", removeSelected); }
    // THE MOOD BOARD'S OWN ROW (see the MOOD BOARD section): SAVE BOARD names the combination that is
    // switched on, BIND saves it for the role on stage, DELETE takes the saved combination out - and
    // a board's chip applies it. The chips are painted by paintBoards() with the mood row's.
    var bs = el("spBoardSave");
    if (bs && !bs.dataset.wired) { bs.dataset.wired = "1"; bs.addEventListener("click", showBoardRow); }
    var bg = el("spBoardGo");
    if (bg && !bg.dataset.wired) { bg.dataset.wired = "1"; bg.addEventListener("click", boardSaveCurrent); }
    var bd = el("spBoardDel");
    if (bd && !bd.dataset.wired) { bd.dataset.wired = "1"; bd.addEventListener("click", boardDeleteCurrent); }
    var bb = el("spBoardBind");
    if (bb && !bb.dataset.wired) { bb.dataset.wired = "1"; bb.addEventListener("click", boardBindCurrent); }
    var bn = el("spBoardName");
    if (bn && !bn.dataset.wired) {
      bn.dataset.wired = "1";
      bn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); boardSaveCurrent(); } e.stopPropagation(); });
    }
    var r = el("spMoodRule");
    if (r && !r.dataset.wired) {
      r.dataset.wired = "1";
      r.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); createFromForm(); } e.stopPropagation(); });
    }
    // THE MOOD EDITOR'S OWN CONTROLS (see the CRUD section): EDIT opens the row, the picker fills it
    // with the mood it names, SAVE keeps the new name and rule, RESET puts a shipped mood's own
    // wording back, PUT IT BACK returns one that was put away, and CANCEL (or EDIT again) closes it.
    var me = el("spMoodEdit");
    if (me && !me.dataset.wired) {
      me.dataset.wired = "1";
      me.addEventListener("click", function () { var row = el("spMoodEditRow"); if (row && !row.hidden) hideEdit(); else showEdit(); });
    }
    var mp = el("spMoodPick");
    if (mp && !mp.dataset.wired) { mp.dataset.wired = "1"; mp.addEventListener("change", onPick); }
    var ms = el("spMoodSave");
    if (ms && !ms.dataset.wired) { ms.dataset.wired = "1"; ms.addEventListener("click", saveEdit); }
    var mr = el("spMoodReset");
    if (mr && !mr.dataset.wired) { mr.dataset.wired = "1"; mr.addEventListener("click", resetEdit); }
    var mb = el("spMoodRestore");
    if (mb && !mb.dataset.wired) { mb.dataset.wired = "1"; mb.addEventListener("click", restoreEdit); }
    var mc = el("spMoodCancel");
    if (mc && !mc.dataset.wired) { mc.dataset.wired = "1"; mc.addEventListener("click", hideEdit); }
    var mn = el("spMoodEditName");
    if (mn && !mn.dataset.wired) {
      mn.dataset.wired = "1";
      mn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var rr = el("spMoodEditRule"); if (rr) rr.focus(); } e.stopPropagation(); });
    }
    var mer = el("spMoodEditRule");
    if (mer && !mer.dataset.wired) {
      mer.dataset.wired = "1";
      mer.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } e.stopPropagation(); });
    }
    var nm = el("spMoodName");
    if (nm && !nm.dataset.wired) {
      nm.dataset.wired = "1";
      nm.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var rr = el("spMoodRule"); if (rr) rr.focus(); } e.stopPropagation(); });
    }
    var mpClose = el("mpClose");
    if (mpClose && !mpClose.dataset.wired) { mpClose.dataset.wired = "1"; mpClose.addEventListener("click", panelClose); }
    var mpSave = el("mpBoardSave");
    if (mpSave && !mpSave.dataset.wired) { mpSave.dataset.wired = "1"; mpSave.addEventListener("click", showBoardRow); }
    var mpGo = el("mpBoardGo");
    if (mpGo && !mpGo.dataset.wired) { mpGo.dataset.wired = "1"; mpGo.addEventListener("click", function () {
      var src = el("spBoardName");
      var dst = el("mpBoardName");
      if (src && dst && dst.value && !src.value) src.value = dst.value;
      boardSaveCurrent();
      if (dst) dst.value = "";
      var row = el("mpBoardRow");
      if (row) row.hidden = true;
    }); }
    var mpDel = el("mpBoardDel");
    if (mpDel && !mpDel.dataset.wired) { mpDel.dataset.wired = "1"; mpDel.addEventListener("click", boardDeleteCurrent); }
    var mpBind = el("mpBoardBind");
    if (mpBind && !mpBind.dataset.wired) { mpBind.dataset.wired = "1"; mpBind.addEventListener("click", boardBindCurrent); }
    var mpEdit = el("mpBoardEdit");
    if (mpEdit && !mpEdit.dataset.wired) { mpEdit.dataset.wired = "1"; mpEdit.addEventListener("click", function () {
      var row = el("mpBoardEditRow");
      if (row && !row.hidden) boardEditClose();
      else boardEditOpen();
    }); }
    var mpPick = el("mpBoardPick");
    if (mpPick && !mpPick.dataset.wired) { mpPick.dataset.wired = "1"; mpPick.addEventListener("change", function () {
      boardEditing = String(mpPick.value || "");
      paintBoardEditor();
    }); }
    var mpRename = el("mpBoardRenameBtn");
    if (mpRename && !mpRename.dataset.wired) { mpRename.dataset.wired = "1"; mpRename.addEventListener("click", function () {
      var b = boardEditing ? boardFind(boardEditing) : null;
      if (!b) { print("SYSTEM", "PICK A BOARD IN THE EDITOR FIRST."); return; }
      var nmEl = el("mpBoardEditName");
      var res = boardRename(b.label, nmEl ? nmEl.value : "", "hitl");
      print("SYSTEM", res.ok ? res.text : res.error);
    }); }
    var mpAdd = el("mpBoardAddBtn");
    if (mpAdd && !mpAdd.dataset.wired) { mpAdd.dataset.wired = "1"; mpAdd.addEventListener("click", function () {
      var b = boardEditing ? boardFind(boardEditing) : null;
      if (!b) { print("SYSTEM", "PICK A BOARD IN THE EDITOR FIRST."); return; }
      var inp = el("mpBoardAddName");
      var res = board(b.label + " :: add " + (inp ? inp.value : ""), "hitl");
      print("SYSTEM", res.ok ? res.text : res.error);
      if (inp) inp.value = "";
      paintBoardEditor();
    }); }
    var mpEditDel = el("mpBoardEditDel");
    if (mpEditDel && !mpEditDel.dataset.wired) { mpEditDel.dataset.wired = "1"; mpEditDel.addEventListener("click", function () {
      var b = boardEditing ? boardFind(boardEditing) : null;
      if (!b) { print("SYSTEM", "PICK A BOARD IN THE EDITOR FIRST."); return; }
      var res = boardDelete(b.label);
      print("SYSTEM", res.ok ? res.text : res.error);
      if (res.ok) boardEditClose();
    }); }
    var mpCancel = el("mpBoardEditCancel");
    if (mpCancel && !mpCancel.dataset.wired) { mpCancel.dataset.wired = "1"; mpCancel.addEventListener("click", boardEditClose); }
    var mpLoad = el("mpPackLoad");
    if (mpLoad && !mpLoad.dataset.wired) { mpLoad.dataset.wired = "1"; mpLoad.addEventListener("click", function () {
      var inp = el("moodpackInput");
      if (inp) inp.click();
      else if (window.packs && window.packs.moodpackPick) window.packs.moodpackPick();
    }); }
    var mpUnload = el("mpPackUnload");
    if (mpUnload && !mpUnload.dataset.wired) { mpUnload.dataset.wired = "1"; mpUnload.addEventListener("click", function () {
      if (window.packs && window.packs.moodpackUnload) window.packs.moodpackUnload();
      else { clearPack(); print("SYSTEM", "MOODPACK UNLOADED :: THE BOOK IS THE WHOLE CONSOLE AGAIN."); }
    }); }
    var mpStatus = el("mpPackStatus");
    if (mpStatus && !mpStatus.dataset.wired) { mpStatus.dataset.wired = "1"; mpStatus.addEventListener("click", function () {
      if (window.packs && window.packs.moodpackStatus) print("SYSTEM", window.packs.moodpackStatus());
      else print("SYSTEM", packName ? "MOODPACK :: " + packName + " :: " + packMoods.length + " COLOURS." : "MOODPACK :: NOTHING LOADED BESIDE THE BOOK.");
    }); }
    paint();
    load();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return {
    SEED: SEED, BOOK: BOOK,
    load: load, all: all, shown: shown, awayList: awayList, names: names, find: find, findAny: findAny,
    current: current, label: label, labels: labels, id: id, by: by,
    on: onList, isOn: isOn, count: count, source: source,
    blockText: blockText, pencilText: pencilText, summary: summary,
    set: set, off: off, create: create, remove: remove, look: look, words: words,
    // THE OTHER HALF OF CRUD (see the CRUD section at the top of this file): edit/rename, reset a
    // shipped mood to the book's own words, put one away and put it back - and the panel's editor.
    edit: edit, reset: reset, restore: restore, isEdited: isEdited, isAway: isAway,
    toggle: function (name, who) { return flip(name, null, who); },
    paint: paint, showNew: showNew, createFromForm: createFromForm, removeSelected: removeSelected,
    showEdit: showEdit, hideEdit: hideEdit, saveEdit: saveEdit, resetEdit: resetEdit, restoreEdit: restoreEdit,
    pickedId: pickedId,
    // THE MOOD BOARD (see the section above): the meta-moods, and the role hook roles.js calls.
    boards: boardList, boardFind: boardFind, boardText: boardText, board: board,
    boardNow: boardNow, boardForRole: boardForRole, onRole: onRole,
    boardSaveCurrent: boardSaveCurrent, boardDeleteCurrent: boardDeleteCurrent, boardBindCurrent: boardBindCurrent,
    boardRename: boardRename, boardEditOpen: boardEditOpen, boardEditClose: boardEditClose, paintBoardEditor: paintBoardEditor,
    paintBoards: paintBoards, packStatus: packStatus, setPack: setPack, clearPack: clearPack, isPack: isPack,
    panelOpen: panelOpen, panelClose: panelClose, panelToggle: panelToggle, panelIsOpen: panelIsOpen,
    ready: function () { return ready; }
  };
})();
