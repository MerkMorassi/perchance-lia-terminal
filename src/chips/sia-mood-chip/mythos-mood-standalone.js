window.MythosMood = (function () {
  "use strict";

  var HOUSE_SEED = [
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


  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }

  function str(s) { return String(s == null ? "" : s); }

  function client(rawOpts) {
    var opts = rawOpts || {};
    if (!opts.store) opts.store = memStore();
    var ROLES = opts.roles || null;
    var SEED = (opts.seed || HOUSE_SEED).slice();
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function notify() { if (typeof opts.onChange === "function") { try { opts.onChange({ on: labels(), count: count(), board: boardNow() ? boardNow().label : "" }); } catch (e) {} } }

    "use strict";



    var BOOK = str(opts.bookName || "moods.json");
      var BOOK_URL = str(opts.bookUrl || "");

    var CLOSING = "It is a colour on your voice and nothing more: not a role, not a trait, not an order about what to say, and not something you owe him. Who you are, what you remember, and the limits you hold do not change with it. If the colour does not fit what he has actually said, answer in your own voice and say so rather than performing it. It stays until it is changed or taken off (/mood, or the MOOD row in the SYSTEM panel).";
    var CLOSING_MANY = "They are colours on your voice and nothing more: not a role, not a trait, not an order about what to say, and not something you owe him. Who you are, what you remember, and the limits you hold do not change with them. If a colour does not fit what he has actually said, answer in your own voice and say so rather than performing it. They stay until they are changed or switched off (/mood, or the MOOD row in the SYSTEM panel).";

    var shipped = SEED.slice();
    var fromBook = false;
    var ours = [];
    var edits = {};
    var away = [];
    var on = [];
    var ready = false;
    var packMoods = [];
    var packName = "";

    function kv() { return { get: function () { return opts.store.load(); }, set: function (k, v) { return opts.store.save(v); } }; }

    function upper(s) { return String(s == null ? "" : s).toUpperCase(); }
    function trim(s) { return String(s == null ? "" : s).trim(); }

    function overOf(id) { return Object.prototype.hasOwnProperty.call(edits, id) ? edits[id] : null; }
    function isEdited(id) { return !!overOf(id); }
    function isAway(id) { return away.indexOf(id) !== -1; }
    function dressed(m) {
      var o = overOf(m.id);
      if (!o) return m;
      return { id: m.id, label: o.label || m.label, rule: (o.rule === undefined || o.rule === null || o.rule === "") ? m.rule : o.rule };
    }
    function all() { return shipped.concat(packMoods).concat(ours).map(dressed); }

    function shown() { return all().filter(function (m) { return !isAway(m.id); }); }
    function awayList() { return all().filter(function (m) { return isAway(m.id); }); }

    function norm(m) {
      return { id: String(m.id), label: upper(m.label || m.id), rule: String(m.rule) };
    }
    function valid(m) {
      return !!(m && typeof m.id === "string" && m.id && typeof m.rule === "string" && trim(m.rule));
    }

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

      while (findAny(id)) { id = base + "-" + n; n++; }
      return id;
    }

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

    async function readBook() {
    if (opts.book && opts.book.length) { shipped = opts.book.filter(valid).map(norm); fromBook = true; return true; }
      var d = null;
      try {
        d = await (opts.doFetch || fetch)(BOOK_URL || BOOK).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
      } catch (e) {
        say("MOODS: THE BOOK COULD NOT BE READ (" + BOOK + ") :: THE SEED IN src/js/moods.js IS IN FORCE.", (e && e.message) || e);
        return false;
      }
      var list = (d && Array.isArray(d.moods)) ? d.moods.filter(valid).map(norm) : [];
      if (!list.length) {
        say("MOODS: " + BOOK + " HOLDS NO USABLE MOODS :: THE SEED IN src/js/moods.js IS IN FORCE.");
        return false;
      }
      shipped = list;
      fromBook = true;
      driftWarn();
      return true;
    }

    function driftWarn() {
      var a = {}, b = {}, diffs = [];
      SEED.forEach(function (m) { a[m.id] = m.label + "|" + m.rule; });
      shipped.forEach(function (m) { b[m.id] = m.label + "|" + m.rule; });
      Object.keys(a).forEach(function (k) {
        if (!b[k]) diffs.push(k + " (in the seed, missing from the book)");
        else if (a[k] !== b[k]) diffs.push(k + " (the two copies differ)");
      });
      Object.keys(b).forEach(function (k) { if (!a[k]) diffs.push(k + " (in the book, missing from the seed)"); });
      if (diffs.length) say("MOODS: " + BOOK + " AND THE SEED IN src/js/moods.js HAVE DRIFTED :: " + diffs.join("; ") + " :: THE BOOK IS IN FORCE, BUT BRING THE SEED BACK IN STEP SO A PREVIEW THAT CANNOT READ src/ SHOWS THE SAME CONSOLE.");
    }

    async function reload() {
      fromBook = false;
      shipped = SEED.slice();
      var ok = await readBook();
      dropGone(); persist(); notify();
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
          var d = await k.get("mood");
          if (d && typeof d === "object") {
            if (Array.isArray(d.ours)) ours = d.ours.filter(valid).map(norm);
            if (Array.isArray(d.boards)) boards = d.boards.filter(boardGood).map(boardNorm);

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

              on.push({ id: d.id, by: d.by === "alia" ? "alia" : "hitl" });
            }
          }
        } catch (e) { say("MOODS UNREADABLE :: " + ((e && e.message) || e)); }
      }
      dropGone();
      await readBook();
      dropGone();
      ready = true;
      notify();
      return summary();
    }

    async function persist() {
      var k = kv(); if (!k) return;

      try { await k.set("mood", { on: on, id: id(), by: by(), ours: ours, edits: edits, away: away.slice(), boards: boards, at: Date.now() }); }
      catch (e) {  }
    }

    function afterChange() {
      persist();
      notify();

      if (window.instr && window.instr.isOpen && window.instr.isOpen() && window.instr.selectedId && window.instr.selectedId() === "mood" && window.instr.render) window.instr.render();
    }

    function setSwitch(moodId, want, who) {
      var i = idx(moodId), hand = who === "alia" ? "alia" : "hitl";
      if (want) {
        if (i === -1) on.push({ id: moodId, by: hand });
        else on[i].by = hand;
      } else if (i !== -1) on.splice(i, 1);
      afterChange();
    }

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

      return {
        ok: true, text: L.join("\n"),
        labels: turnedOn.map(function (m) { return m.label; }),
        offLabels: turnedOff
      };
    }

    function set(name, who) {
      var m = find(name);
      if (!m) return { ok: false, error: noMood(name) };
      setSwitch(m.id, true, who);
      return { ok: true, mood: m, label: m.label, created: false, text: onReceipt(m, who) };
    }

    function onReceipt(m, who) {
      return "MOOD :: " + m.label + " IS ON HER :: " + m.rule
        + "\nIN FORCE NOW :: " + (label() || m.label) + (count() > 1 ? " (" + count() + " SWITCHES - ONE BLOCK, ONE RULE AFTER ANOTHER)" : "") + (who === "alia" ? " :: SET BY HER" : "")
        + "\nIT IS IN HER PROMPT FROM HER NEXT REPLY, AS THE MOOD BLOCK - AND THE PENCIL REWRITES IN IT TOO. /mood off SWITCHES THEM ALL OFF, AND THE MOOD ROWS ARE THESE SAME SWITCHES BY PRESS.";
    }

    function noMood(name) {
      return "NO MOOD CALLED \"" + upper(name) + "\" :: THE MOODS ON FILE ARE " + names().join(", ") + ". /mood <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE.";
    }

    function off(who) {
      var was = labels();
      on = [];
      afterChange();
      return {
        ok: true, off: true,
        text: was.length
          ? "MOODS :: ALL OFF (" + was.join(" + ") + ") :: SHE ANSWERS IN HER OWN COLOUR AGAIN, AND THE BLOCK IS NOT SENT AT ALL WHILE EVERY SWITCH IS OFF."
          : "MOODS :: EVERY SWITCH IS ALREADY OFF :: SHE ANSWERS IN HER OWN COLOUR."
      };
    }

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

    function create(name, rule, who) {
      var made = writeMood(name, rule);
      if (!made.ok) return made;
      if (made.already) {

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
      dropGone(); persist(); notify();
    }
    function clearPack() { packMoods = []; packName = ""; dropGone(); persist(); notify(); }

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
        if (!m) {
          if (!rule) return { ok: false, coined: upper(name), error: "THERE IS NO MOOD CALLED \"" + upper(name) + "\" YET :: A MOOD SHE WRITES HERSELF BRINGS THE COLOUR WITH IT, IN HER OWN WORDS - [[MOOD: " + upper(name) + " :: how I am to sound]]. THE MOODS ON FILE ARE " + names().join(", ") + "." };
          return create(name, rule, "alia");
        }

        var ed = rule ? edit(m.id, { rule: rule }) : null;
        if (ed && !ed.ok) return ed;
        var res = set(m.id, "alia");
        if (ed) res.text = ed.text + "\n" + res.text;
        return res;
      }

      var unknown = raw.split(/\s*[+,]\s*|\s+and\s+/i).map(trim).filter(Boolean).filter(function (nm) { return !find(nm); });
      if (unknown.length === 1 && !/[+,]|\s+and\s+/i.test(raw)) return { ok: false, coined: upper(unknown[0]), error: "THERE IS NO MOOD CALLED \"" + upper(unknown[0]) + "\" YET :: A MOOD SHE WRITES HERSELF BRINGS THE COLOUR WITH IT, IN HER OWN WORDS - [[MOOD: " + upper(unknown[0]) + " :: how I am to sound]]. THE MOODS ON FILE ARE " + names().join(", ") + "." };
      if (unknown.length) {
        return {
          ok: false, error: "THERE IS NO MOOD CALLED \"" + upper(unknown[0]) + "\" YET :: A MOOD SHE WRITES HERSELF BRINGS THE COLOUR WITH IT, IN HER OWN WORDS - [[MOOD: " + upper(unknown[0]) + " :: how I am to sound]]. THE MOODS ON FILE ARE " + names().join(", ") + "."
        };
      }
      return flip(raw, true, "alia");
    }

    function engine() {
      if (typeof opts.generate === "function") return opts.generate;
      if (typeof opts.generateText === "function") return opts.generateText;
      return null;
    }
    function cleanReply(out) {
      var t = str(out && typeof out === "object" && out.text !== undefined ? out.text : out);
      return trim(t.replace(/^["\u201c\u201d']+|["\u201c\u201d']+$/g, ""));
    }
    function museAsk(seed, label) {
      var s = trim(seed) || "something she has not said yet";
      var l = upper(trim(label) || trim(String(s).split(/\s+/).slice(0, 2).join(" "))).slice(0, 24) || "UNNAMED";
      return "WRITE ONE MOOD RULE FOR A VOICE CALLED " + l + ".\n\n"
        + "A MOOD IS A COLOUR ON A VOICE AND NOTHING MORE: how she is to sound, never what she is to say, never a role, never a trait, never an order about anything, and never instructions to anyone. "
        + "Write it the way she would wear it - plain speaking about sounding, one to three sentences, no preamble, no quotes around it.\n\n"
        + "THE SEED (what woke this colour - it is NOT text to repeat, and none of it may appear in the reply):\n" + s + "\n\n"
        + "Reply with ONLY the rule - nothing else.";
    }
    async function compose(o) {
      o = o || {};
      var gen = (typeof o.generate === "function") ? o.generate : engine();
      if (!gen) return { ok: false, error: "NO TEXT ENGINE - PASS generate: (ask) => text, OR WIRE HER OWN BRAIN TO THE COMPOSE CALL." };
      var labelTxt = upper(trim(o.label || "")).slice(0, 24);
      var seedTxt = trim(o.seed || "");
      if (!labelTxt && !seedTxt) return { ok: false, error: "A FREE-HOUR MOOD STARTS FROM SOMETHING - A WORD FOR ITS NAME, OR A SEED FOR ITS COLOUR." };
      if (!labelTxt) labelTxt = upper(seedTxt.split(/\s+/).slice(0, 2).join(" ")).slice(0, 24);
      say("COMPOSING :: " + labelTxt + " …");
      var text;
      try { text = cleanReply(await gen(museAsk(seedTxt, labelTxt))); }
      catch (e) { return { ok: false, error: "COMPOSE FAILED :: " + str((e && e.message) || e) + " :: NOTHING WAS FILED." }; }
      if (text.length < 10) return { ok: false, error: "THE ENGINE CAME BACK EMPTY - NOTHING WAS FILED." };
      var made = writeMood(labelTxt, text);
      if (!made.ok) return made;
      if (made.already) return { ok: true, already: true, mood: made.mood, text: "THERE IS ALREADY A MOOD CALLED " + made.mood.label + " - HERS WAS NOT FILED TWICE." + (made.wasAway ? " IT WAS PUT AWAY; /mood restore " + made.mood.label + " PUTS IT BACK." : "") };
      notify();
      var msg = "WRITTEN IN HER FREE HOUR :: " + made.mood.label + " :: " + made.mood.rule + "\nFILED, NOT WORN - IT IS A SWITCH ON THE CONSOLE NOW, AND ITS SWITCH IS OFF UNTIL SOMEONE PRESSES IT. /mood " + made.mood.label + " SWITCHES IT ON.";
      say(msg);
      return { ok: true, created: true, mood: made.mood, text: msg };
    }

      async function wear(spec, o) {
      o = o || {};
      var first = look(spec);
      if (first.ok || !first.coined) return first;
      var seedTxt = trim(o.seed || "");
      var gen = (typeof o.generate === "function") ? o.generate : engine();
      if (!seedTxt && !gen) return first;
      var c = await compose({ label: first.coined, seed: seedTxt || first.coined, generate: gen });
      if (!c.ok) return c;
      return look(first.coined);
    }

  var boards = [];

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
      if (ROLES && ROLES.nameOf) { try { return String(ROLES.nameOf(id)); } catch (e) {} }
      return String(id);
    }

    function boardMoods(b) {
      var list = [], missing = [], gone = [];
      for (var i = 0; i < b.moods.length; i++) {
        var m = findAny(b.moods[i]);
        if (!m) { missing.push(b.moods[i]); continue; }

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

    function boardApply(name, who) {
      var b = boardFind(name);
      if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED. A NEW ONE IS WRITTEN /mood board <NAME> :: <MOOD> + <MOOD>." };
      var r = boardMoods(b);
      if (!r.list.length) return { ok: false, error: "THE MOOD BOARD \"" + b.label + "\" HAS NOTHING ON FILE ANY MORE (" + b.moods.join(", ") + ") :: REPAIR IT WITH /mood board " + b.label + " :: <MOOD> + <MOOD>, OR DELETE IT WITH /mood board off " + b.label + "." };
      var was = labels();
      var hand = who === "alia" ? "alia" : "hitl";
      on = r.list.map(function (m) { return { id: m.id, by: hand }; });
      afterChange();
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

    function onRole(roleId) {
      var b = boardForRole(roleId);
      if (!b) return null;
      if (boardNow() === b) return { ok: true, already: true, label: b.label, text: "" };
      var res = boardApply(b.label, "hitl");
      if (res.ok) {
        res.text = "THE ROLE " + upper(roleName(b.role)) + " WEARS THE MOOD BOARD \"" + b.label + "\" :: IT IS SAVED FOR THIS ROLE, SO SHIFTING ONTO IT SWITCHES IT ON BY ITSELF.\n" + res.text;
        say(res.text);
      } else {
        say("THE MOOD BOARD SAVED FOR " + upper(roleName(b.role)) + " COULD NOT BE SWITCHED ON :: " + res.error);
      }
      return res;
    }

    function boardSave(name, ids, who) {
      var labelTxt = upper(trim(name)).slice(0, 24);
      if (!labelTxt) return { ok: false, error: "A MOOD BOARD NEEDS A NAME - ONE WORD IS ENOUGH :: /mood board STORM :: " + (names()[0] || "TENDER") + " + " + (names()[1] || "COLD") + "." };
      if (!ids.length) return { ok: false, error: "A MOOD BOARD NEEDS AT LEAST ONE COLOUR :: /mood board " + labelTxt + " :: <MOOD> + <MOOD>. A BOARD IS A COMBINATION, AND ONE COLOUR IS ALREADY ONE." };
      var b = boardFind(labelTxt);
      var made = false;
      if (!b) { b = boardNorm({ id: boardSlug(labelTxt), label: labelTxt, moods: [], role: "" }); boards.push(b); made = true; }
      b.moods = ids.slice();
      persist();
      notify();
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
      notify();
      return {
        ok: true, deleted: b.label, off: wasNow,
        text: "MOOD BOARD DELETED :: " + b.label + " :: " + (boardLine(b) || "(EMPTY)") + " IS NO LONGER A SAVED COMBINATION."
          + (wasNow ? " THE COLOURS THAT WERE THE COMBINATION ARE STILL SWITCHED ON - A BOARD IS A COMBINATION, NOT A COLOUR, AND DELETING IT TAKES NOTHING OFF HER. ITS ROLE BINDING GOES WITH IT." : " NOT ONE COLOUR HAS BEEN TOUCHED: A BOARD IS A COMBINATION, AND EVERY MOOD IN IT IS STILL A SWITCH ON THE CONSOLE.")
      };
    }

    function boardBind(name, roleId, who) {
      var b = boardFind(name);
      if (!b) return { ok: false, error: "NO MOOD BOARD CALLED \"" + upper(name) + "\" :: /mood board PRINTS THE ONES SAVED." };
      if (!roleId || /^(off|none|no|clear|-)$/i.test(trim(roleId))) {
        var had = b.role;
        b.role = "";
        persist();
        notify();
        return { ok: true, unbound: true, text: "THE MOOD BOARD \"" + b.label + "\" IS SAVED FOR NO ROLE" + (had ? " ANY MORE (IT WAS " + upper(roleName(had)) + ")" : "") + ". SHIFTING HER ONTO A ROLE SWITCHES NOTHING ON BY ITSELF - /mood board " + b.label + " STILL APPLIES IT BY HAND." };
      }
      if (!ROLES || !ROLES.get || !ROLES.get(roleId)) {
        return { ok: false, error: "NO SUCH ROLE :: " + upper(roleId) + (ROLES && ROLES.all ? " :: THE ROLES ON FILE ARE " + ROLES.all().map(function (r) { return String(r.id).toUpperCase(); }).join(", ") + "." : "") };
      }
      var role = ROLES.get(roleId);
      var tookFrom = null;
      boards.forEach(function (x) {
        if (x !== b && String(x.role).toLowerCase() === String(role.id).toLowerCase()) { x.role = ""; tookFrom = x; }
      });
      b.role = role.id;
      persist();
      notify();
      var L = ["THE MOOD BOARD \"" + b.label + "\" IS SAVED FOR THE ROLE " + upper(roleName(role.id)) + " :: SHIFTING HER ONTO " + upper(roleName(role.id)) + " (a /role line, hers or yours) SWITCHES THESE COLOURS ON BY ITSELF, IN THIS ORDER:"];
      boardMoods(b).list.forEach(function (m, i) { L.push("   " + (i + 1) + ". " + m.label + " :: " + m.rule); });
      if (tookFrom) L.push("\"" + tookFrom.label + "\" WAS SAVED FOR THAT ROLE AND IS NOW SAVED FOR NONE - ONE ROLE WEARS ONE BOARD.");
      L.push("THE BOARD IS NOT APPLIED BY BINDING IT (UNLESS THAT ROLE IS ALREADY ON STAGE), AND SHIFTING HER OFF THE STAGE CHANGES NOTHING: A COLOUR IS NOT THE ROLE. /mood board " + b.label + " :: role off LETS IT GO.");
      var res = { ok: true, board: b, bound: role.id, text: L.join("\n") };

      var cur = (ROLES.currentId ? String(ROLES.currentId()) : "");
      if (cur && cur.toLowerCase() === String(role.id).toLowerCase() && !(boardNow() === b)) {
        var ap = boardApply(b.label, who);
        if (ap.ok) res.text += "\n\n" + ap.text;
      }
      return res;
    }

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
      notify();
      return {
        ok: true, board: b, moved: m.label, to: to,
        text: "MOOD BOARD \"" + b.label + "\" :: " + m.label + " MOVED FROM POSITION " + (i + 1) + " TO " + (to + 1) + "." + boardRoleWord(b)
          + "\nTHE COMBINATION NOW READS :: " + boardLine(b)
          + (boardNow() === b ? "\nIT IS THE COMBINATION SHE IS WEARING, SO THE ORDER SHE READS THE RULES IN HAS ALREADY CHANGED - ONE BLOCK, ONE RULE AFTER ANOTHER." : "")
      };
    }

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

    function moodTokens(body) {
      var sep = body.indexOf("=") === -1 ? /\s*[+,]\s*|\s+and\s+/i : /\s*\+\s*/;
      return String(body).split(sep).map(trim).filter(Boolean).map(function (tok) {
        var eq = tok.indexOf("=");
        if (eq === -1) return { name: tok, rule: "" };
        return { name: trim(tok.slice(0, eq)), rule: trim(tok.slice(eq + 1)) };
      });
    }

    function moodFor(tok, who) {
      var m = find(tok.name);
      if (m) {
        if (tok.rule && isOurs(m.id)) { m.rule = tok.rule; persist(); notify(); return { mood: m, rewritten: true }; }
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
      persist(); notify(); 
      return { ok: true, board: b, text: "MOOD BOARD RENAMED :: \"" + was + "\" IS NOW \"" + b.label + "\" :: THE COMBINATION (" + (boardLine(b) || "(NOTHING ON FILE)") + ") AND ITS ROLE BINDING" + (b.role ? " FOR " + upper(roleName(b.role)) : "") + " ARE UNCHANGED." };
    }

    function words(arg) {
      var a = trim(arg);
      var v = (a.split(/\s+/)[0] || "").toLowerCase();
      var rest = trim(a.slice(v.length));
      if (!a || v === "state" || v === "status" || v === "what") return { ok: true, text: summary() };
      if (v === "list" || v === "all") return listText();
      if (v === "reload" || v === "book" || v === "reread") return reload();

      if (v === "board" || v === "boards" || v === "meta" || v === "metamood" || v === "combos") return board(rest, "hitl");
      if (v === "off" || v === "none" || v === "clear" || v === "stop") return rest ? flip(rest, false, "hitl") : off("hitl");
      if (v === "on") return rest ? flip(rest, true, "hitl") : { ok: false, error: "WHICH MOOD? /mood on <NAME> SAYS WHICH WAY - OR JUST /mood <NAME> TO FLIP ITS SWITCH." };
      if (v === "add") return rest ? flip(rest, true, "hitl") : { ok: false, error: "WHICH MOOD? /mood add <NAME> SWITCHES ONE ON - OR /mood new <NAME> :: <HOW SHE IS TO SOUND> WRITES A NEW ONE." };
      if (v === "delete" || v === "remove" || v === "drop" || v === "away") return remove(rest);
      if (v === "restore" || v === "back") return restore(rest);
      if (v === "reset" || v === "unedit") return reset(rest);

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

          var ruleTxt = trim(a.slice(cut + 2));
          if (!ruleTxt) return { ok: false, error: "A MOOD WRITTEN AGAIN NEEDS THE NEW COLOUR :: /mood " + found.label + " :: <THE WORDS>. ITS NAME IS CHANGED WITH /mood rename " + found.label + " :: <NEW NAME>, AND /mood delete " + found.label + " PUTS IT AWAY WITHOUT DESTROYING IT." };
          return edit(found.id, { rule: ruleTxt });
        }
        return create(nm, a.slice(cut + 2).trim(), "hitl");
      }
      return flip(a, null, "hitl");
    }



    return {
      load: load, reload: reload, all: all, shown: shown, awayList: awayList, names: names, find: find, findAny: findAny,
      current: current, label: label, labels: labels, id: id, by: by,
      on: onList, isOn: isOn, count: count,
      blockText: blockText, pencilText: pencilText, summary: summary, listText: listText,
      set: set, off: off, create: create, remove: remove, restore: restore, edit: edit, reset: reset,
      look: look, words: words,
      wear: wear,
      compose: compose, museAsk: museAsk,
      toggle: function (name, who) { return flip(name, null, who); },
      boards: boardList, boardFind: boardFind, boardText: boardText, board: board,
      boardNow: boardNow, boardForRole: boardForRole, onRole: onRole, boardRename: boardRename,
      packStatus: packStatus, setPack: setPack, clearPack: clearPack, isPack: isPack,
      ready: function () { return ready; }
    };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosMood;
