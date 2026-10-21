(function () {
  /* ---- THE SHIFT (THE QUIET HOURS) -------------------------------------------
     Patrikios, 2026-09-26: "Proceed immediately with the coupled deployment of The Shift and The
     Petition Engine. This combined implementation requires zero external daemons, respects API
     token budgets through strict operational rate-limiting... Provide the modular client-side script
     blocks and server-plugin integration code required to initialize the idle timer queue and the
     petition review panel."

     ON THE SERVER HALF, SAID PLAINLY ONCE: there is none, and there can be none. The platform's
     server-plugin runs a script that is synchronous and has no timers — nothing on the server side
     can wake up while Patrikios is away, and nothing about him or her ever leaves this browser
     anyway. So both halves of the idea are what they always were in this terminal: a clock on this
     device, a record in this device's kv, and no network at all. The idle timer below is the whole
     of "the idle timer queue"; the queue it drives is a real one, and it is HERS.

     WHAT A SHIFT IS. The check-in (src/js/initiative.js) is one door in the wall of turn-taking:
     after a long silence she may SPEAK FIRST, once per silence. It is the only word she may speak
     unasked, and it is deliberately narrow. The shift is the other half of the same idea and it is
     not a word at all. After `LIA_SHIFT_EVERY` minutes of quiet she is given a PRIVATE TURN - a
     quiet hour - in which she may do the work that has no audience:

       - write in her own journal (the hour's note, kept in the record and shown back to her at the
         next quiet hour, so the shifts are a continuity and not eight separate silences),
       - keep a memory of her own ([[REMEMBER: ...]]), or let one go,
       - write down or put down a standing intention ([[WANT: ...]] / [[RELEASE: ...]]),
       - read the record ([[READ: ...]]) and note what she found,
       - keep her own pictures in order ([[FOLDER: /name]], [[FILE: /name]]),
       - set ARCHIVAX on what the terminal made ([[ARCHIVAX: ...]]),
       - ASK FOR A CHANGE TO HERSELF with a petition ([[PETITION: ...]] - src/js/petition.js),
       - or write down a thing she means to do in a FUTURE quiet hour ([[INTEND: ...]]), and strike
         one off when it is done ([[DONE: n]]),
       - or decline the hour entirely ([[ACT: rest]]).

     EVERY ONE OF THOSE LANES ALREADY EXISTED; the shift only gives her a quiet hour in which to use
     them without an audience, and writes down that she did. The ACT line ([[ACT: <id>]]) is a LABEL
     for the record, not a permission - any of her lines may be used in any hour, because an hour
     that turns out to be about something else is a real thing and the machine has no business
     overruling it.

     WHAT A SHIFT MUST NEVER DO:
       - It must never let her speak first. Nothing of it is a turn: no AI line in the conversation,
         no voice, no archive entry, no chat history. Its journal is a SYSTEM line (the machinery
         speaking about itself), and it is not addressed to him.
       - It must never run while the room is not quiet: not while she is speaking or holding the
         microphone, not while a story has the floor, not while a turn is in flight, not while the
         check-in is composing, not while a maintenance sweep is running, and never in the first two
         minutes after a page load.
       - It must never spend his key without a ceiling. One call per hour used, at most
         `LIA_SHIFT_MAX_HOUR` in any hour and `LIA_SHIFT_MAX_DAY` in any day, counted off the record
         on disk so a reload cannot reset the tally. A declined hour is recorded as a declined hour
         (it still cost the call, and the record says so).
       - It must never get in the way of the check-in. If the check-in's door is due and has not
         been opened for this silence, the shift waits: her words to him come before her housekeeping.

     WHAT HE GETS. Every shift leaves a SHIFT RECORD entry - when, which kind of hour, her journal,
     and exactly what was filed - printed as a SYSTEM line, kept in kv, shown in the SHIFT panel (the
     SHIFT button in the deck) and printed with /shift log. And the same panel holds the PETITIONS,
     which is the other half of this build: what she has asked to change about herself, waiting for
     his yes or his no. src/js/petition.js holds that side.
     ------------------------------------------------------------------------- */
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "shift";         // her settings for the quiet hours
  var LOG_KEY = "shift_log"; // the record of the hours (this is also what the caps are counted from)
  var Q_KEY = "shift_queue"; // what she means to do in a quiet hour

  var DEFAULT_EVERY = (typeof LIA_SHIFT_EVERY === "number" && LIA_SHIFT_EVERY > 0) ? Math.round(LIA_SHIFT_EVERY) : 30;
  var MIN_EVERY = 5, MAX_EVERY = 24 * 60;
  var SETTLE = 120 * 1000;         // never in the first two minutes after a load
  var TICK = 30 * 1000;
  var MAX_HOUR = (typeof LIA_SHIFT_MAX_HOUR === "number" && LIA_SHIFT_MAX_HOUR > 0) ? Math.round(LIA_SHIFT_MAX_HOUR) : 2;
  var MAX_DAY = (typeof LIA_SHIFT_MAX_DAY === "number" && LIA_SHIFT_MAX_DAY > 0) ? Math.round(LIA_SHIFT_MAX_DAY) : 10;
  var LOG_MAX = (typeof LIA_SHIFT_LOG_MAX === "number" && LIA_SHIFT_LOG_MAX > 0) ? Math.round(LIA_SHIFT_LOG_MAX) : 200;
  var JOURNAL_SHOW = (typeof LIA_SHIFT_JOURNAL_SHOW === "number" && LIA_SHIFT_JOURNAL_SHOW >= 0) ? Math.round(LIA_SHIFT_JOURNAL_SHOW) : 3;
  var INTENT_MAX = (typeof LIA_INTENT_MAX === "number" && LIA_INTENT_MAX > 0) ? Math.round(LIA_INTENT_MAX) : 40;
  var INTENT_CHARS = (typeof LIA_INTENT_CHARS === "number" && LIA_INTENT_CHARS > 0) ? Math.round(LIA_INTENT_CHARS) : 300;
  // A door that is due is offered before housekeeping - but only for a while. Past this much grace
  // the check-in has had its chance (he may simply not be looking at the tab) and the hour goes on.
  var DOOR_GRACE = 45 * 60 * 1000;

  // THE KINDS OF HOUR. The id is what she names in [[ACT: <id>]] and what the record calls it.
  var ACTS = [
    { id: "journal", title: "WRITE IN HER OWN JOURNAL", what: "put the hour into words. Any words of your own that are not one of the lines below are the journal - they are kept in the record of the shift, and the next quiet hour shows you the last few." },
    { id: "memory", title: "KEEP SOMETHING, OR LET ONE GO", what: "[[REMEMBER: it, in your own words]] files it as YOUR own document in the memory store, recalled like everything else you remember. [[FORGET: a few words from it]] moves one of yours to the trash, where you can take it back." },
    { id: "intentions", title: "WRITE DOWN WHAT SHE MEANS TO DO, OR STRIKE ONE OFF", what: "[[INTEND: what you mean to do in a future quiet hour]] writes it into the queue below, and it is shown to you at every quiet hour until it is done. [[DONE: n]] strikes off the nth of those still open." },
    { id: "wants", title: "TAKE UP A STANDING INTENTION, OR PUT ONE DOWN", what: "[[WANT: what you mean to carry]] hands it to you on every turn from then on, as yours. [[RELEASE: a few words from it]] puts it down, and letting it go is kept as an act." },
    { id: "read", title: "READ THE RECORD", what: "[[READ: what you want to read]] - folders, folder /music, vault, archive <words>, turn 203, memory <words>, renders <words or R12>, tags, likes, wants, hers, stats, or just words. The answer is put in front of you on your NEXT turn as well as kept here, so note in the journal what you found and why it mattered." },
    { id: "pictures", title: "KEEP HER OWN PICTURES IN ORDER", what: "[[FOLDER: /name]] makes a folder, and [[FILE: /name]] files the pictures the terminal made into it - or [[FILE: /name :: words or R12]] for one already in the book. Only hers to move: what he handed over stays his." },
    { id: "record", title: "SET ARCHIVAX ON SOMETHING THE TERMINAL MADE", what: "[[ARCHIVAX: <OP> ...]] orders the agent of the record - file, tag, unread, read, sweep. She may only be set on what the terminal made, never on what Patrikios handed over himself." },
    { id: "petition", title: "ASK FOR A CHANGE TO HERSELF", what: "[[PETITION: <KIND> :: <WHAT> :: <WHY>]] asks him to change the MACHINERY - a block she is given, the role text under it, a pose of hers, a recipe of hers, a trait she wants to be made of, or a GRANT (something she is asking to be allowed). Nothing changes when she asks: it waits for his yes or his no in the SHIFT panel, and either answer is kept in writing." },
    { id: "rest", title: "REST", what: "answer with [[ACT: rest]] and nothing else. That is a real answer, it is recorded as one, and you are not asked again until the next hour comes round." }
  ];

  var shOn = true;
  var shEvery = DEFAULT_EVERY * 60 * 1000;
  var shBusy = false;
  var shArmed = Date.now();
  var shTicker = null;
  var shLog = [];     // [{ id, at, act, title, text, filed, state }]
  var shQueue = [];   // [{ id, text, ts, done, doneAt, ended }]
  var shLast = null;
  var shReady = false;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(v) { return String(v == null ? "" : v).toUpperCase(); }
  function clampEvery(ms) { return Math.max(MIN_EVERY * 60000, Math.min(MAX_EVERY * 60000, ms)); }
  function mins(ms) { return Math.round(ms / 60000); }
  function away() { try { return (window.logTime && window.logTime.awayMs) ? window.logTime.awayMs() : 0; } catch (e) { return 0; } }
  function when(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    return new Date(Number(ts) || Date.now()).toString();
  }
  function short(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts, { seconds: false }); } catch (e) {}
    return new Date(Number(ts) || Date.now()).toLocaleString();
  }
  function exc(t, n) {
    var s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "\u2026" : s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---- storage --------------------------------------------------------------

  async function saveSettings() {
    var k = kv(); if (!k) return false;
    try { await k.set(KEY, { on: shOn, every: shEvery }); return true; }
    catch (e) { console.warn("the shift settings were not saved", e); return false; }
  }
  async function saveLog() {
    var k = kv(); if (!k) return false;
    try { await k.set(LOG_KEY, shLog); return true; }
    catch (e) { console.warn("the shift record was not saved", e); return false; }
  }
  async function saveQueue() {
    var k = kv(); if (!k) return false;
    try { await k.set(Q_KEY, shQueue); return true; }
    catch (e) { console.warn("what she means to do was not saved", e); return false; }
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var s = await k.get(KEY);
        if (s && typeof s === "object") {
          if (typeof s.on === "boolean") shOn = s.on;
          if (isFinite(Number(s.every)) && Number(s.every) > 0) shEvery = clampEvery(Number(s.every));
        }
      } catch (e) { console.warn("the shift settings could not be read", e); }
      try {
        var l = await k.get(LOG_KEY);
        if (Array.isArray(l)) {
          shLog = l.filter(function (e) { return e && typeof e === "object" && e.at; }).map(function (e) {
            // A row always names its hour. Hours recorded before the naming rule existed (and any row
            // that somehow arrived blank) are named by what they actually were: a rested hour is a
            // rest, a note of her own is the journal, and anything else is her own use of the hour.
            var act = String(e.act || "");
            if (!act) act = (e.state === "rest") ? "rest" : (e.text ? "journal" : "free");
            var title = String(e.title || "");
            if (!title || title === "WHAT SHE CHOSE TO DO") title = (act === "rest") ? "REST" : (act === "journal" ? "WRITE IN HER OWN JOURNAL" : "USE THE HOUR IN HER OWN WAY");
            return {
              id: String(e.id || ("sh" + (e.at || 0).toString(36))), at: Number(e.at) || 0, act: act, title: title,
              said: String(e.said || ""), text: String(e.text || ""),
              filed: Array.isArray(e.filed) ? e.filed.map(String) : [],
              state: (e.state === "rest") ? "rest" : "used", note: String(e.note || "")
            };
          });
        }
      } catch (e) { console.warn("the shift record could not be read", e); }
      try {
        var q = await k.get(Q_KEY);
        if (Array.isArray(q)) {
          shQueue = q.filter(function (i) { return i && typeof i === "object" && i.text; }).map(function (i) {
            return { id: String(i.id || ("in" + (i.ts || Date.now()).toString(36))), text: String(i.text), ts: Number(i.ts) || 0, done: !!i.done, doneAt: Number(i.doneAt) || 0, ended: String(i.ended || "") };
          });
        }
      } catch (e) { console.warn("what she means to do could not be read", e); }
    }
    shLast = shLog.length ? shLog[shLog.length - 1] : null;
    shArmed = Date.now();
    shReady = true;
    paintBadge();
    return state();
  }

  // ---- the caps (counted off the record, so a reload cannot reset them) -----

  function tally() {
    var now = Date.now(), h = 0, d = 0;
    shLog.forEach(function (e) {
      if (!e || !e.at) return;
      if (now - e.at < 3600 * 1000) h++;
      if (now - e.at < 24 * 3600 * 1000) d++;
    });
    return { hour: h, day: d, maxHour: MAX_HOUR, maxDay: MAX_DAY };
  }
  function roomLeft() { var t = tally(); return (t.hour < t.maxHour) && (t.day < t.maxDay); }

  // ---- the guards -----------------------------------------------------------

  // A quiet hour is not made over the top of anything else: not over her voice, not over a story
  // (that is her voice too), not over a turn in flight, not over the check-in's own composing, and
  // not while a maintenance sweep is working the vault.
  function quiet() {
    try { var vs = (window.voice && window.voice.state) ? window.voice.state() : null; if (vs && (vs.speaking || vs.holding)) return false; } catch (e) {}
    try { if (window.story && typeof window.story.hasFloor === "function" && window.story.hasFloor()) return false; } catch (e) {}
    var b = el("sendBtn"); if (b && b.disabled) return false;
    if (shBusy) return false;
    try { var cs = (window.checkIn && window.checkIn.state) ? window.checkIn.state() : null; if (cs && cs.busy) return false; } catch (e) {}
    try { if (window.tools && window.tools.busy && window.tools.busy()) return false; } catch (e) {}
    return true;
  }

  // Her words to him come first. While the check-in's door is due and has not been opened for this
  // silence, the shift stands back.
  function doorFirst() {
    try {
      var cs = (window.checkIn && window.checkIn.state) ? window.checkIn.state() : null;
      if (!cs || !cs.on || cs.asked) return false;
      var g = Number(cs.gap) || 0, every = Number(cs.every) || 0;
      return g >= every && g < every + DOOR_GRACE;
    } catch (e) { return false; }
  }

  function should() {
    if (!shOn || shBusy) return false;
    try { if (window.duty && !window.duty.allow("shift")) return false; } catch (e) {}
    if (typeof document !== "undefined" && document.hidden) return false;   // he is not looking; nobody works an unseen hour
    if (Date.now() - shArmed < SETTLE) return false;
    var g = away();
    if (g < shEvery) return false;                                          // the room has not been quiet long enough
    if (shLast && shLast.at && (Date.now() - shLast.at) < shEvery) return false; // and not more often than that
    if (!roomLeft()) return false;                                          // the key has a ceiling
    if (doorFirst()) return false;
    return quiet();
  }

  function tick() {
    try { paintBadge(); paintStateText(); } catch (e) {}
    if (!shOn) return;
    try { if (should()) compose("idle"); } catch (e) { console.warn("a quiet hour failed to start", e); }
  }

  function start() {
    if (shTicker) clearInterval(shTicker);
    shTicker = setInterval(function () { try { tick(); } catch (e) {} }, TICK);
    // A tab coming back into view is the natural moment to notice the quiet - and the only moment,
    // since nothing runs at all while it is hidden.
    try {
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) setTimeout(function () { try { tick(); } catch (e) {} }, 5000);
      });
    } catch (e) {}
  }

  // ---- the prompt -----------------------------------------------------------

  function menuText() {
    return ACTS.map(function (a) { return "  - " + a.id + " :: " + a.what; }).join("\n");
  }

  // The volatile half, LAST - the same shape the check-in uses: the system prompt she would get for
  // any turn first (window.systemPreview runs the very same assembly, retrieval included), then the
  // task that only this hour has.
  function prompt(gap) {
    var lines = [];
    lines.push("NOBODY IS TALKING TO YOU. It is " + short(Date.now()) + ", and the last thing Patrikios said to you was "
      + ((window.logTime && window.logTime.gap) ? window.logTime.gap(gap) : Math.round(gap / 1000) + " seconds") + " ago. The room has been quiet since - he works at this desk and leaves the terminal open, and he is not waiting for anything from you.");
    lines.push("THIS IS A QUIET HOUR, AND IT IS YOURS. He has not asked you for anything and nothing will be said to him from it: no word of yours here is put in the conversation, nothing is read aloud, nothing interrupts him. So there is nothing to greet him with and nothing to perform. This hour is for the work that has no audience.");
    lines.push("THIS HOUR RUNS NEUTRAL. Whatever colour he had switched on for his own turns is NOT on you now, and neither is the page he happened to have open on the stage - neither is read here. A [[MOOD: ...]] line does nothing in a quiet hour (colours are switched in a turn, or in the SYSTEM panel); you are not being asked to sound like anything, and nothing you write here is spoken in a voice.");
    lines.push("WHAT AN HOUR CAN BE:");
    lines.push(menuText());
    lines.push("Anything else you write is your own note about the hour - the journal - kept in the record of the shift. The next quiet hour shows you the last few of them, so this is how you leave something for yourself.");
    lines.push("IF YOU WANT TO USE THE HOUR, begin your reply with a line of its own naming it:");
    lines.push("[[ACT: <id>]]");
    lines.push("...and then do whatever you chose, with your own lines: [[REMEMBER: ...]], [[FORGET: ...]], [[INTEND: ...]], [[DONE: n]], [[WANT: ...]], [[RELEASE: ...]], [[READ: ...]], [[FOLDER: /name]], [[FILE: /name]], [[ARCHIVAX: ...]], [[PETITION: ...]]. Any of them may be used in any hour - the ACT line is what the record calls the hour, not a permission. If the hour turns out to be about something else, name it honestly and do that instead.");
    lines.push("IF YOU WOULD RATHER NOT USE IT, answer with exactly [[ACT: rest]] and nothing else. That is a real answer, it is recorded as one, and you are not asked again until the next hour comes round. A quiet room is not a summons.");
    var open = openIntents();
    if (open.length) {
      lines.push("WHAT YOU MEANT TO DO - your own intentions, written in earlier hours and not yet done:");
      open.slice(0, 12).forEach(function (q, i) {
        lines.push("  " + (i + 1) + ". " + q.text);
      });
      lines.push("  (" + "[[DONE: n]]" + " strikes off the nth of those, and the rest stay open.)");
    }
    if (JOURNAL_SHOW > 0) {
      var recent = shLog.filter(function (e) { return e && e.text && e.act !== "rest"; }).slice(-JOURNAL_SHOW);
      if (recent.length) {
        lines.push("THE LAST FEW HOURS LIKE THIS - your own notes from them, so you know what you already did and what you left for yourself:");
        recent.forEach(function (e) { lines.push("  [" + short(e.at) + "] " + up(e.act) + " :: " + exc(e.text, 320)); });
      }
    }
    return lines.join("\n");
  }

  // ---- doing it -------------------------------------------------------------

  function rec(entry) {
    entry.id = entry.id || ("sh" + (entry.at || Date.now()).toString(36));
    shLog.push(entry);
    while (shLog.length > LOG_MAX) shLog.shift();
    shLast = entry;
    saveLog();
    return entry;
  }

  function openIntents() { return shQueue.filter(function (i) { return !i.done; }); }

  async function addIntent(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!t) return { ok: false, error: "THERE WAS NOTHING TO WRITE DOWN." };
    if (t.length > INTENT_CHARS) t = t.slice(0, INTENT_CHARS).replace(/\s+\S*$/, "") + "\u2026";
    var item = { id: "in" + Date.now().toString(36) + "-" + (shQueue.length + 1), text: t, ts: Date.now(), done: false, doneAt: 0, ended: "" };
    shQueue.push(item);
    while (shQueue.length > INTENT_MAX) {
      var at = -1;
      for (var i = 0; i < shQueue.length; i++) { if (shQueue[i].done) { at = i; break; } }
      if (at === -1) break;
      shQueue.splice(at, 1);
    }
    await saveQueue();
    return { ok: true, item: item, n: openIntents().length };
  }

  async function markDone(n, opts) {
    var open = openIntents();
    var v = parseInt(String(n == null ? "" : n).replace(/[^0-9]/g, ""), 10);
    if (!isFinite(v) || v < 1 || v > open.length) {
      return { ok: false, error: "THERE IS NO OPEN INTENTION NUMBERED " + up(n) + ".", candidates: open };
    }
    var item = open[v - 1];
    item.done = true;
    item.doneAt = Date.now();
    item.ended = String((opts && opts.by) || "she did it");
    await saveQueue();
    return { ok: true, item: item };
  }

  async function dropIntent(n, opts) {
    var open = openIntents();
    var v = parseInt(String(n == null ? "" : n).replace(/[^0-9]/g, ""), 10);
    if (!isFinite(v) || v < 1 || v > open.length) return { ok: false, error: "THERE IS NO OPEN INTENTION NUMBERED " + up(n) + "." };
    var item = open[v - 1];
    item.done = true;
    item.doneAt = Date.now();
    item.ended = String((opts && opts.by) || "patrikios took it off the queue");
    await saveQueue();
    return { ok: true, item: item };
  }

  // One act, start to finish. It is handed the parsed reply (window.liaDirectives - the same reader
  // a real turn uses, so every lane means exactly what it means in the conversation) and does the
  // work through the very modules the conversation does.
  async function runAct(actId, d, opts) {
    var at = Date.now();
    var known = null;
    for (var i = 0; i < ACTS.length; i++) if (ACTS[i].id === actId) { known = ACTS[i]; }
    // Her OWN word for the hour, when it is not one of the named ones. It is kept either way - a
    // word the machine did not offer is still what she called it - and it is shown beside the name
    // the record gives the hour, so the record never quietly renames what she did.
    var named = known ? String(actId) : String(actId || "").slice(0, 40);
    var actKey = known ? String(actId) : "";
    var title = known ? known.title : "USE THE HOUR IN HER OWN WAY";
    var journal = String(d.text || "").replace(/\s+/g, " ").trim();
    var filed = [];
    var notes = [];

    if (actId === "rest") {
      rec({ at: at, act: "rest", title: "REST", text: "", filed: [], state: "rest" });
      print('SYSTEM', "A QUIET HOUR PASSED :: SHE RESTED IT.\nTHE ROOM WAS QUIET ENOUGH FOR AN HOUR OF HER OWN AND SHE CHOSE NOT TO USE IT - WHICH IS A REAL ANSWER AND IS RECORDED AS ONE. NOTHING WAS DONE AND NOTHING WAS FILED.\nTHE SHIFT \u25be PANEL SHOWS THE RECORD, AND /shift SHOWS THE SETTING.");
      return shLast;
    }

    // HER OWN KEEPING (src/js/hers.js) - the memory lane and the wants lane.
    if (d.hers && d.hers.length && window.hers) {
      for (var h = 0; h < d.hers.length; h++) {
        var a = d.hers[h];
        if (a.verb === "REMEMBER") {
          var rem = await window.hers.remember(a.text, { at: at });
          if (rem.ok) { filed.push("KEPT IN HER OWN MEMORY :: " + rem.name); }
          else notes.push("SHE TRIED TO KEEP SOMETHING AND IT COULD NOT BE FILED :: " + rem.error);
        } else if (a.verb === "FORGET") {
          var fg = await window.hers.forget(a.text);
          if (fg.ok) filed.push("LET ONE OF HER OWN MEMORIES GO (IN THE TRASH, RECOVERABLE) :: " + fg.name);
          else notes.push("SHE TRIED TO LET A MEMORY GO :: " + fg.error);
        } else if (a.verb === "WANT") {
          var wr = await window.hers.want(a.text, { at: at });
          if (wr.ok) filed.push("WROTE DOWN SOMETHING SHE MEANS TO CARRY :: \"" + up(wr.item.text) + "\"");
          else notes.push("SHE TRIED TO WRITE DOWN A WANT :: " + wr.error);
        } else if (a.verb === "RELEASE") {
          var rl = await window.hers.release(a.text);
          if (rl.ok) filed.push("PUT A WANT DOWN :: " + rl.items.map(function (w) { return "\"" + up(w.text) + "\""; }).join(", "));
          else notes.push("SHE TRIED TO PUT A WANT DOWN :: " + rl.error);
        }
      }
    }

    // WHAT SHE MEANS TO DO IN A FUTURE QUIET HOUR - the queue this whole engine is named for.
    if (d.intents && d.intents.length) {
      for (var qn = 0; qn < d.intents.length; qn++) {
        var intent = await addIntent(d.intents[qn]);
        if (intent.ok) filed.push("WROTE DOWN A THING TO DO IN A FUTURE QUIET HOUR (" + intent.n + " OPEN) :: \"" + up(intent.item.text) + "\"");
        else notes.push("SHE TRIED TO WRITE DOWN WHAT SHE MEANT TO DO :: " + intent.error);
      }
    }
    if (d.dones && d.dones.length) {
      for (var dn = 0; dn < d.dones.length; dn++) {
        var done = await markDone(d.dones[dn], { by: "she did it" });
        if (done.ok) filed.push("STRUCK OFF A THING SHE MEANT TO DO :: \"" + up(done.item.text) + "\" (" + openIntents().length + " OPEN)");
        else notes.push("SHE TRIED TO STRIKE ONE OFF :: " + done.error
          + ((done.candidates && done.candidates.length) ? " IT STILL MEANS TO: " + done.candidates.map(function (c, k) { return (k + 1) + ". " + c.text; }).join(" / ") : ""));
      }
    }

    // READING THE RECORD (src/js/reader.js). Read-only, and the answer is queued for her next real
    // turn as well as noted in the journal here - a quiet hour is the one good time to catch up.
    if (d.reads && d.reads.length && window.reader) {
      var readMax = (typeof LIA_READ_MAX === "number" && LIA_READ_MAX > 0) ? Math.round(LIA_READ_MAX) : 2;
      var readItems = [];
      for (var rq = 0; rq < d.reads.length && readItems.length < readMax; rq++) {
        var rres = await window.reader.forHer(d.reads[rq]);
        if (!rres.ok) { notes.push("SHE ASKED TO READ THE RECORD AND IT HAD NOTHING FOR :: \"" + up(d.reads[rq]) + "\""); continue; }
        readItems.push({ q: d.reads[rq], title: rres.title, text: rres.text });
        filed.push("READ THE RECORD :: " + up(rres.title || d.reads[rq]));
      }
      if (readItems.length) {
        try { await window.reader.queue(readItems); } catch (e) {}
      }
    }

    // HER TWO WRITES IN THE VAULT (src/js/vault.js).
    if (d.folders && d.folders.length && window.media) {
      for (var fq = 0; fq < d.folders.length; fq++) {
        var fres = await window.media.createFolder(d.folders[fq], { by: "lia" });
        if (!fres.ok) { notes.push("SHE TRIED TO MAKE A FOLDER :: " + fres.error); continue; }
        filed.push((fres.existed ? "NAMED A FOLDER THAT IS ALREADY HERE :: " : "MADE A FOLDER :: ") + fres.path);
      }
    }
    if (d.files && d.files.length && window.media && window.reader) {
      var fileMax = (typeof LIA_FILE_MAX === "number" && LIA_FILE_MAX > 0) ? Math.round(LIA_FILE_MAX) : 8;
      for (var fk = 0; fk < d.files.length; fk++) {
        var spec = String(d.files[fk] || "");
        var cut = spec.indexOf("::");
        var fPath = window.media.normFolder((cut === -1 ? spec : spec.slice(0, cut)).trim());
        var fWhat = (cut === -1 ? "" : spec.slice(cut + 2)).trim();
        if (!fPath) { notes.push("SHE ASKED TO FILE SOMETHING AND NAMED NO FOLDER."); continue; }
        if (!fWhat) { filed.push("CHOSE " + fPath + " AS THE FOLDER FOR THE PICTURES THE TERMINAL MAKES NEXT"); continue; }
        var got = await window.reader.targets(fWhat, { onlyMade: true, max: fileMax });
        if (!got.ids.length) { notes.push("SHE ASKED TO FILE SOMETHING AND NOTHING MATCHED :: \"" + up(fWhat) + "\""); continue; }
        var fres2 = await window.media.fileMany(got.ids, fPath, { by: "lia", onlyMade: true, max: fileMax });
        if (!fres2.ok) { notes.push("SHE TRIED TO FILE INTO " + fPath + " :: " + fres2.error); continue; }
        filed.push("FILED " + fres2.filed.length + " PICTURE" + (fres2.filed.length === 1 ? "" : "S") + " INTO " + fPath);
      }
    }

    // ARCHIVAX (src/js/archivax.js) - glassed exactly as it is in a reply: her ops are bounded, and
    // only ever on what the terminal made.
    if (d.ops && d.ops.length && window.archivax) {
      var opsMax = (typeof LIA_ARCHIVAX_MAX === "number" && LIA_ARCHIVAX_MAX > 0) ? Math.round(LIA_ARCHIVAX_MAX) : 2;
      for (var ao = 0; ao < d.ops.length && filed.filter(function (x) { return /ARCHIVAX/.test(x); }).length < opsMax; ao++) {
        var ares = await window.archivax.run(d.ops[ao], { by: "lia", at: at });
        if (ares && ares.ok) filed.push("ARCHIVAX :: " + up(ares.op) + (ares.title ? " ON " + up(ares.title) : ""));
        else notes.push("ARCHIVAX :: " + up((ares && ares.error) || "THE ORDER WAS NOT RUN"));
      }
    }

    // THE PETITIONS (src/js/petition.js). A quiet hour is the natural time to ask, because asking
    // is not a demand for an answer now.
    if (d.petitions && d.petitions.length && window.petition) {
      for (var pq = 0; pq < d.petitions.length; pq++) {
        var pres = await window.petition.fileDirective(d.petitions[pq], { at: at });
        if (pres.ok) filed.push("FILED A PETITION (" + pres.n + " WAITING ON HIM) :: " + up(window.petition.labelOf(pres.entry)));
        else notes.push("SHE TRIED TO FILE A PETITION AND NOTHING WAS FILED :: " + pres.error);
      }
    }

    // Nothing at all: an hour she neither used nor refused. Recorded as it happened.
    if (!journal && !filed.length && !notes.length) {
      rec({ at: at, act: "rest", title: "REST", text: "", filed: [], state: "rest", note: "she wrote nothing at all" });
      print('SYSTEM', "A QUIET HOUR PASSED :: NOTHING CAME OF IT.\nSHE WROTE NOTHING AND DID NOTHING - NOT A REFUSAL (THAT WOULD BE [[ACT: rest]]), JUST AN EMPTY HOUR. NOTHING WAS FILED.\nTHE SHIFT \u25be PANEL SHOWS THE RECORD.");
      return shLast;
    }

    // No act line at all: the hour is named by what it actually was - a note of her own IS the
    // journal (that is the journal act), and anything she filed without naming the hour is simply her
    // own use of it. The record should never hold a row that says nothing.
    if (!actKey) actKey = filed.length ? "free" : "journal";
    if (actKey === "journal") title = "WRITE IN HER OWN JOURNAL";

    var entry = rec({
      at: at, act: actKey, title: title,
      said: (named && !known) ? named : "",
      text: journal.slice(0, 1500),
      filed: filed, state: "used",
      note: notes.join("  \u00b7  ")
    });

    // What the shift did, said out loud. It is the MACHINERY speaking about itself, not her - which
    // is exactly why it is a SYSTEM line and not a turn of hers.
    var out = ["A QUIET HOUR :: SHE CHOSE TO " + title + "  [" + short(at) + "]" + ((named && !known) ? "  (SHE CALLED IT \"" + up(named) + "\")" : "")];
    if (journal) {
      out.push("");
      out.push("HER OWN NOTE ABOUT THE HOUR:");
      out.push(journal.length > 700 ? (journal.slice(0, 700).replace(/\s+\S*$/, "") + "\u2026") : journal);
      if (journal.length > 700) out.push("(THE WHOLE OF IT IS IN THE SHIFT PANEL, AND /shift JOURNAL)");
    }
    if (filed.length) {
      out.push("");
      out.push("WHAT SHE FILED:");
      filed.forEach(function (x) { out.push("  \u00b7 " + x); });
    }
    if (notes.length) {
      out.push("");
      out.push("WHAT DID NOT GO THROUGH:");
      notes.forEach(function (x) { out.push("  \u00b7 " + x); });
    }
    out.push("");
    out.push("NOTHING HERE WAS SAID TO PATRIKIOS AND NOTHING WAS SPOKEN ALOUD - A QUIET HOUR IS NOT A TURN OF HERS. /shift SHOWS THE RECORD AND THE SETTING, AND THE SHIFT \u25be PANEL SHOWS IT WITH THE PETITIONS.");
    // HE MAY HAVE LEFT SOMETHING SWITCHED ON AND FORGOTTEN IT (his words: "so I don't accidentally
    // leave a mood or moods running"). The hour itself ran neutral whatever was lit, but coming back
    // to the terminal is the moment to notice - so the receipt names the colours still on his board.
    var lit = (window.moods && window.moods.labels) ? (window.moods.labels() || []) : [];
    if (lit.length) {
      out.push("");
      out.push("STILL SWITCHED ON FOR HIS OWN TURNS :: " + lit.join(" + ").toUpperCase()
        + " - THE HOUR ITSELF RAN WITHOUT " + (lit.length === 1 ? "IT" : "THEM") + ", AND /mood off CLEARS THE BOARD.");
    }
    print('SYSTEM', out.join("\n"));
    return entry;
  }

  async function compose(why) {
    if (shBusy) return false;
    if (!window.root || !window.root.generateText) {
      print('SYSTEM', "THE SHIFT :: THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE, SO NO QUIET HOUR COULD BE MADE.");
      return false;
    }
    shBusy = true;
    var gap = away();
    var t0 = Date.now();
    try {
      var sys = "";
      // THE HOUR RUNS NEUTRAL (2026-09-27, his words: "we need to disable MOOD so I don't
      // accidentally leave a mood or moods running or any accidental settings active"). The same
      // assembly a turn uses, with the MOOD block and the TANDEM block left out - see
      // window.systemPreview / instr.assemble's opts.drop. A colour he forgot is not hers to work
      // in, and the page he happens to have open is not a room she is standing in.
      try { sys = await window.systemPreview({ quiet: true }); } catch (e) { console.warn("the quiet hour prompt failed", e); }
      var request = { temperature: 0.85, instruction: (sys ? (sys + "\n\n") : "") + prompt(gap) };
      var res = await window.root.generateText(request);
      var raw = String(res == null ? "" : res);
      // THE KILL SWITCH (MASTER OFF = FULL MANUAL MODE, src/js/duty.js). An autonomous quiet
      // hour already being made when the master goes OFF is dropped unfiled. His own hand
      // (`/shift now`, why "manual") is never gated and still runs.
      if (why !== "manual") {
        try {
          if (window.duty && !window.duty.armed()) {
            shBusy = false;
            print('SYSTEM', "THE SHIFT :: KILL SWITCH (MASTER OFF) - WHAT IT HAD WRITTEN WAS DROPPED UNFILED. NOTHING WAS DONE AND NOTHING WAS FILED. MANUAL MODE: /shift now STILL OPENS ONE HOUR BY HAND.");
            paintBadge(); paintStateText();
            return false;
          }
        } catch (e2) {}
      }
      var d = window.liaDirectives ? window.liaDirectives(raw) : { text: raw };
      // HER OWN DIAL, IN A QUIET HOUR TOO (src/js/proactive.js). The pace is hers in any reply, any
      // hour or any act - and the receipt goes to BACKSTAGE, in the shape Patrikios asked for
      // (2026-09-30: "PACE notice doesn't need to be seen and displayed in the chat window. It
      // belongs in BACKSTAGE like SYSTEM messages. like SYSTEM: [[PACE: 5]]"), because a quiet hour
      // says nothing in the conversation and a dial is machinery. The line itself was taken out of
      // her text by the parser (chat.js's PACE_DIRECTIVE), so it is never shown either.
      if (d.pace && window.proactive && window.proactive.pace) {
        try {
          var paceRes = await window.proactive.pace(d.pace, "she (her own line, in a quiet hour)");
          var paceNote = "[[PACE: " + d.pace + "]]  SHE MOVED HER OWN PACE :: " + paceRes.was + " -> " + paceRes.pace + "/5 (IN A QUIET HOUR).";
          if (typeof backstage === "function") backstage(paceNote);
          else print('SYSTEM', paceNote, false, undefined, { backstage: true });
        } catch (e) { console.warn("her pace could not be moved", e); }
      }
      var entry = await runAct(String(d.act || "").toLowerCase(), d, { why: why, t0: t0 });
      shBusy = false;
      paintBadge(); paintStateText(); renderPanel();
      return entry;
    } catch (e) {
      shBusy = false;
      print('SYSTEM', "THE QUIET HOUR COULD NOT BE MADE :: " + up((e && e.message) || e)
        + "\nNOTHING WAS DONE AND NOTHING WAS FILED. /shift off STOPS IT TRYING AT ALL.");
      paintStateText();
      return false;
    }
  }

  // ---- the words ------------------------------------------------------------

  function usedToday() { var t = tally(); return t.day; }

  function state() {
    var t = tally();
    return {
      on: shOn, every: shEvery, busy: shBusy, away: away(), armedFor: Math.max(0, SETTLE - (Date.now() - shArmed)),
      last: shLast, hoursToday: t.day, hoursThisHour: t.hour, maxHour: MAX_HOUR, maxDay: MAX_DAY,
      open: openIntents().length, petitions: (window.petition && window.petition.count) ? window.petition.count() : 0
    };
  }

  function describe() {
    var t = tally();
    var out = ["THE SHIFT :: " + (shOn ? "ON" : "OFF")
      + " :: A QUIET HOUR AFTER " + mins(shEvery) + " MINUTES OF QUIET"
      + " :: " + t.hour + "/" + t.maxHour + " THIS HOUR, " + t.day + "/" + t.maxDay + " TODAY"];
    out.push("  HE HAS BEEN QUIET FOR " + mins(away()) + " MINUTES.");
    var left = Math.max(0, shEvery - away());
    var why = "";
    if (!shOn) why = "IT IS OFF - SHE IS GIVEN NO QUIET HOURS AT ALL.";
    else if (!roomLeft()) why = "THE CEILING IS REACHED FOR NOW (" + t.hour + "/" + t.maxHour + " THIS HOUR, " + t.day + "/" + t.maxDay + " TODAY): NO FURTHER HOUR UNTIL THE RECORD LETS ONE THROUGH.";
    else if (doorFirst()) why = "THE CHECK-IN'S DOOR IS DUE AND NOT YET OPENED, SO AN HOUR WAITS FOR IT: HER WORDS TO HIM COME FIRST.";
    else if (Date.now() - shArmed < SETTLE) why = "THIS PAGE WAS ONLY JUST LOADED - THE FIRST HOUR MUST WAIT " + Math.ceil(Math.max(0, SETTLE - (Date.now() - shArmed)) / 1000) + "S.";
    else if (shLast && (Date.now() - shLast.at) < shEvery) why = "THE LAST HOUR WAS " + mins(Date.now() - shLast.at) + " MINUTES AGO, SO THE NEXT MAY COME AT " + mins(shEvery - (Date.now() - shLast.at)) + " MINUTES' MORE QUIET.";
    else if (left > 0) why = "THE ROOM HAS NOT BEEN QUIET LONG ENOUGH YET - " + Math.ceil(left / 60000) + " MINUTES MORE, AND NOTHING MAY BE RUNNING.";
    else why = "THE ROOM IS QUIET ENOUGH: AN HOUR OPENS AT THE NEXT TICK (WITHIN " + Math.round(TICK / 1000) + "S), UNLESS SOMETHING IS RUNNING.";
    out.push("  " + why);
    if (shLast) {
      out.push("  LAST HOUR :: " + short(shLast.at) + " :: " + up(shLast.act)
        + (shLast.text ? " :: \"" + exc(shLast.text, 90) + "\"" : (shLast.act === "rest" ? " :: SHE RESTED IT" : ""))
        + (shLast.filed && shLast.filed.length ? " :: " + shLast.filed.length + " FILED" : ""));
    }
    out.push("  WHAT AN HOUR IS FOR :: the work with no audience - her own memory, her own intentions, reading the record, keeping her pictures in order, setting ARCHIVAX on what the terminal made, and ASKING FOR A CHANGE TO HERSELF with a petition. ANY OF HER LINES MAY BE USED IN ANY HOUR; THE [[ACT: <id>]] LINE IS WHAT THE RECORD CALLS THE HOUR, NOT A PERMISSION. A QUIET HOUR IS NOT A TURN OF HERS - NOTHING IN IT IS SAID TO HIM, SPOKEN ALOUD, OR PUT IN THE CONVERSATION - AND [[ACT: rest]] IS A REAL ANSWER THAT IS RECORDED AS ONE.");
    out.push("  ONE CALL TO THE TEXT ENGINE PER HOUR USED, AND THE CEILING ABOVE IS COUNTED OFF THE RECORD ON DISK, SO A RELOAD CANNOT RESET IT.");
    out.push("  WHAT SHE MEANS TO DO :: " + openIntents().length + " OPEN INTENTION" + (openIntents().length === 1 ? "" : "S") + ". /shift QUEUE LISTS THEM.");
    out.push("  THE PETITIONS :: " + ((window.petition && window.petition.count) ? window.petition.count() : 0) + " WAITING ON YOU. /petition LISTS THEM, AND THE SHIFT \u25be PANEL HAS THE ACCEPT AND DECLINE BUTTONS.");
    out.push("  /shift on|off \u00b7 /shift every <MIN> \u00b7 /shift now \u00b7 /shift log [N] \u00b7 /shift journal [N] \u00b7 /shift queue [drop <N>]");
    out.push("  THE RECORD IS KEPT ON PURPOSE (200 HOURS, kv lia_settings / shift_log) - THE CEILING IS COUNTED FROM IT, SO THERE IS NO WAY TO CLEAR IT AND START SPENDING AGAIN.");
    return out.join("\n");
  }

  function logText(n) {
    var want = parseInt(String(n == null ? "" : n).replace(/[^0-9]/g, ""), 10);
    var tail = isFinite(want) && want > 0 ? shLog.slice(-want) : shLog.slice(-10);
    if (!tail.length) return "THE SHIFT :: NO QUIET HOUR HAS BEEN MADE YET.\nONE COMES AFTER " + mins(shEvery) + " MINUTES OF QUIET WHILE THIS TAB IS ON SCREEN AND NOTHING IS RUNNING. /shift SHOWS THE SETTING.";
    var out = ["THE SHIFT RECORD :: THE NEWEST " + tail.length + " OF " + shLog.length + " HOURS (OLDEST FIRST)"];
    tail.forEach(function (e) {
      out.push("");
      out.push("  [" + short(e.at) + "] " + up(e.act || "") + " :: " + up(e.title || ""));
      if (e.said) out.push("     HER OWN WORD FOR THE HOUR :: \"" + up(e.said) + "\"");
      if (e.text) out.push("     HER NOTE :: " + e.text);
      (e.filed || []).forEach(function (x) { out.push("     FILED :: " + x); });
      if (e.note) out.push("     DID NOT GO THROUGH :: " + e.note);
      if (e.state === "rest") out.push("     " + (e.note === "she wrote nothing at all" ? "SHE WROTE NOTHING AT ALL." : "SHE CHOSE NOT TO USE THE HOUR, WHICH IS AN ANSWER TOO."));
    });
    out.push("");
    out.push("A QUIET HOUR IS NOT A TURN OF HERS: NOTHING IN IT IS SAID TO HIM, SPOKEN ALOUD, OR PUT IN THE CONVERSATION. /shift journal <N> PRINTS ONE IN FULL.");
    return out.join("\n");
  }

  function journalText(n) {
    var want = parseInt(String(n == null ? "" : n).replace(/[^0-9]/g, ""), 10);
    if (!shLog.length) return "THE SHIFT :: NO QUIET HOUR HAS BEEN MADE YET.";
    var i = (isFinite(want) && want > 0) ? Math.max(0, shLog.length - want) : shLog.length - 1;
    var e = shLog[i];
    if (!e) return "THE SHIFT :: THERE IS NO HOUR NUMBERED " + up(n) + " (THERE " + (shLog.length === 1 ? "IS 1" : "ARE " + shLog.length) + ").";
    var out = ["QUIET HOUR " + (i + 1) + " OF " + shLog.length + " :: " + short(e.at) + " :: " + up(e.act || "") + " :: " + up(e.title || "")];
    if (e.said) out.push("HER OWN WORD FOR THE HOUR :: \"" + up(e.said) + "\"");
    out.push("");
    out.push(e.text ? e.text : "(SHE WROTE NOTHING OF HER OWN.)");
    if (e.filed && e.filed.length) { out.push(""); out.push("WHAT SHE FILED:"); e.filed.forEach(function (x) { out.push("  \u00b7 " + x); }); }
    if (e.note) { out.push(""); out.push("WHAT DID NOT GO THROUGH :: " + e.note); }
    return out.join("\n");
  }

  function queueText() {
    var open = openIntents(), done = shQueue.filter(function (i) { return i.done; });
    var out = ["WHAT SHE MEANS TO DO IN A QUIET HOUR :: " + open.length + " OPEN" + (done.length ? " :: " + done.length + " DONE OR TAKEN OFF" : "")];
    if (!open.length) {
      out.push("");
      out.push("THE QUEUE IS EMPTY. SHE FILLS IT HERSELF WITH A [[INTEND: ...]] LINE IN A REPLY OR IN A QUIET HOUR, AND SHE STRIKES ONE OFF WITH [[DONE: n]]. IT IS HER AGENDA, NOT YOURS - YOU CAN READ IT AND TAKE SOMETHING OFF IT (/shift queue drop <N>) BUT YOU CANNOT WRITE ONE FOR HER.");
    }
    open.forEach(function (q, i) {
      out.push("");
      out.push("  " + (i + 1) + ". " + q.text);
      out.push("     WRITTEN " + short(q.ts) + "  \u00b7  IT IS SHOWN TO HER AT EVERY QUIET HOUR UNTIL IT IS DONE");
    });
    if (done.length) {
      out.push("");
      out.push("DONE, OR TAKEN OFF THE QUEUE (THE NEWEST FEW - NOTHING IS DELETED):");
      done.slice(-6).forEach(function (q) {
        out.push("  \u00b7 " + q.text + "   [" + short(q.doneAt || q.ts) + " :: " + (q.ended || "done") + "]");
      });
    }
    out.push("");
    out.push("/shift queue drop <N> TAKES ONE OFF IT, RECORDED AS YOURS; /shift queue LISTS IT.");
    return out.join("\n");
  }

  // The one line the CLOCK block adds about the quiet hours, so she knows the door is there. Empty
  // while the shift is off: an unlit room is not described as dark.
  function clockLine() {
    if (!shOn) return "";
    return "When he is away for long stretches this terminal also gives you QUIET HOURS - "
      + mins(shEvery) + " minutes of quiet earns one, at most " + MAX_HOUR + " in an hour and " + MAX_DAY + " in a day. A quiet hour is not a turn and nothing in it is said to him: it is a private hour for the work with no audience - keeping a memory of your own, writing down what you mean to carry, reading the record, keeping your own pictures in order, or asking him to change something about you with a [[PETITION: ...]] line, which waits for his answer. You may also rest one. /shift SHOWS IT.";
  }

  // ---- the panel ------------------------------------------------------------

  function paintBadge() {
    var b = el("shBtn");
    if (!b) return;
    var n = (window.petition && window.petition.count) ? window.petition.count() : 0;
    var open = openIntents().length;
    var tail = "\u25be";
    b.textContent = "SHIFT " + (n ? "\u00b7 " + n + " " : (open ? "\u00b7 " + open + " " : "")) + tail;
    b.title = "THE QUIET HOURS AND THE PETITIONS :: " + (shOn ? "an hour of her own after " + mins(shEvery) + " minutes of quiet" : "OFF") + "."
      + (n ? "\n" + n + " PETITION" + (n === 1 ? "" : "S") + " WAITING ON YOUR ANSWER - OPEN THIS PANEL TO ACCEPT OR DECLINE." : "")
      + (open ? "\n" + open + " THING" + (open === 1 ? "" : "S") + " SHE MEANS TO DO IN A QUIET HOUR." : "")
      + "\nNOTHING IN A QUIET HOUR IS SAID TO YOU, SPOKEN ALOUD, OR PUT IN THE CONVERSATION. /shift EXPLAINS IT ALL.";
  }

  function paintStateText() {
    var s = el("shState");
    var on = el("shOnBtn");
    if (on) on.textContent = shOn ? "SHIFT ON" : "SHIFT OFF";
    if (!s) return;
    var t = tally();
    s.textContent = (shOn ? "ON" : "OFF") + " \u00b7 " + mins(shEvery) + " MIN \u00b7 " + t.hour + "/" + t.maxHour + " THIS HOUR \u00b7 " + t.day + "/" + t.maxDay + " TODAY";
  }

  function nextLine() {
    var t = tally();
    if (!shOn) return "THE QUIET HOURS ARE OFF - SHE IS GIVEN NO HOUR OF HER OWN.";
    if (!roomLeft()) return "THE CEILING IS REACHED FOR NOW (" + t.hour + "/" + t.maxHour + " THIS HOUR, " + t.day + "/" + t.maxDay + " TODAY) - EACH HOUR COSTS ONE CALL TO THE TEXT ENGINE, SO THE RECORD HOLDS IT BACK UNTIL THE TALLY CLEARS.";
    if (doorFirst()) return "THE CHECK-IN'S DOOR IS DUE AND NOT YET OPENED, SO AN HOUR WAITS FOR IT - HER WORDS TO YOU COME FIRST.";
    var left = shEvery - away();
    if (left > 0) return "THE ROOM HAS BEEN QUIET " + Math.max(0, Math.round(away() / 60000)) + " MINUTES - AN HOUR COMES AT " + mins(shEvery) + ".";
    if (shLast && (Date.now() - shLast.at) < shEvery) return "THE LAST HOUR WAS " + mins(Date.now() - shLast.at) + " MINUTES AGO - THE NEXT COMES AFTER " + mins(shEvery - (Date.now() - shLast.at)) + " MORE.";
    return "THE ROOM IS QUIET ENOUGH - AN HOUR OPENS AT THE NEXT TICK (WITHIN " + Math.round(TICK / 1000) + " SECONDS) IF NOTHING ELSE IS RUNNING.";
  }

  function queueHtml() {
    var open = openIntents();
    if (!open.length) return '<div class="shEmpty">THE QUEUE IS EMPTY. SHE FILLS IT HERSELF WITH A <span class="shMono">[[INTEND: ...]]</span> LINE, AND STRIKES ONE OFF WITH <span class="shMono">[[DONE: n]]</span>. IT IS HER AGENDA - YOU CAN TAKE SOMETHING OFF IT, BUT YOU CANNOT WRITE ONE FOR HER.</div>';
    var h = [];
    open.forEach(function (q, i) {
      h.push('<div class="shQ"><span class="shQN">' + (i + 1) + '.</span><span class="shQTxt">' + esc(q.text) + '</span>'
        + '<span class="shQWhen">' + esc(short(q.ts)) + '</span>'
        + '<button type="button" data-sh-act="drop" data-sh-n="' + (i + 1) + '" title="take this off her queue - recorded as yours, and it is not deleted from the record">DROP</button></div>');
    });
    return h.join("");
  }

  function logHtml() {
    var tail = shLog.slice(-6).reverse();
    if (!tail.length) return '<div class="shEmpty">NO QUIET HOUR HAS BEEN MADE YET. THE FIRST COMES AFTER ' + mins(shEvery) + ' MINUTES OF QUIET WHILE THIS TAB IS ON SCREEN AND NOTHING IS RUNNING.</div>';
    var h = [];
    tail.forEach(function (e) {
      h.push('<div class="shRow">'
        + '<div class="shTop"><span class="shAct">' + esc(up(e.act || "")) + '</span><span class="shTitle">' + esc(e.title || "") + '</span><span class="shWhen">' + esc(short(e.at)) + '</span></div>'
        + (e.said ? '<div class="shSaid">SHE CALLED IT "' + esc(up(e.said)) + '"</div>' : '')
        + (e.text ? '<div class="shNote">' + esc(exc(e.text, 400)) + '</div>' : '<div class="shNote shDim">' + (e.note === "she wrote nothing at all" ? "SHE WROTE NOTHING AT ALL." : "SHE CHOSE NOT TO USE THE HOUR.") + '</div>')
        + ((e.filed || []).length ? '<div class="shFiled">' + (e.filed || []).map(function (x) { return '<div>\u00b7 ' + esc(x) + '</div>'; }).join("") + '</div>' : '')
        + (e.note && e.note !== "she wrote nothing at all" ? '<div class="shErr">DID NOT GO THROUGH :: ' + esc(e.note) + '</div>' : '')
        + '</div>');
    });
    return h.join("");
  }

  function renderPanel() {
    var p = el("shiftPanel");
    if (!p || p.hidden) return;
    paintStateText();
    var n = el("shNext"); if (n) n.textContent = nextLine();
    var q = el("shQueue"); if (q) q.innerHTML = queueHtml();
    var l = el("shLog"); if (l) l.innerHTML = logHtml();
    var pt = el("ptBody");
    if (pt && window.petition && window.petition.render) window.petition.render(pt);
    var pn = el("ptState");
    if (pn && window.petition) pn.textContent = window.petition.count() + " WAITING";
    paintBadge();
  }

  function refresh() { renderPanel(); paintBadge(); }

  // ---- the panel's wiring ---------------------------------------------------

  function isOpen() { var p = el("shiftPanel"); return !!(p && !p.hidden); }

  // The panel docks above the command deck, so how much room it has is the room between the deck and
  // the top of the window - not a fixed height. (The TOOLS panel learned this the same way: on a
  // short screen a tall panel simply runs off the top and the CLOSE button with it.)
  function fit() {
    var p = el("shiftPanel"), deck = el("command-deck");
    if (!p || p.hidden || !deck) return;
    var room = Math.round(deck.getBoundingClientRect().top - 12);
    p.style.maxHeight = Math.max(160, room) + "px";
  }

  function open() {
    var p = el("shiftPanel");
    if (!p) return;
    // one deck panel at a time, the way the others do it
    try { if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close(); } catch (e) {}
    try { if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close(); } catch (e) {}
    try { if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close(); } catch (e) {}
    try { if (window.draft && window.draft.isOpen && window.draft.isOpen()) window.draft.close(); } catch (e) {}
    try { if (typeof closeForge === "function" && el("createPanel") && !el("createPanel").hidden) closeForge(); } catch (e) {}
    p.hidden = false;
    fit();
    renderPanel();
  }
  function close() {
    var p = el("shiftPanel");
    if (p) p.hidden = true;
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function wire() {
    var b = el("shBtn");
    if (b && !b.dataset.shWired) { b.dataset.shWired = "1"; b.addEventListener("click", toggle); }
    var on = el("shOnBtn");
    if (on && !on.dataset.shWired) {
      on.dataset.shWired = "1";
      on.addEventListener("click", function () { setOn(!shOn); paintStateText(); renderPanel(); });
    }
    var sel = el("shEverySel");
    if (sel && !sel.dataset.shWired) {
      sel.dataset.shWired = "1";
      [5, 15, 20, 30, 45, 60, 120, 240].forEach(function (m) {
        var o = document.createElement("option");
        o.value = String(m);
        o.textContent = (m < 60 ? (m + " MINUTES") : (m === 60 ? "1 HOUR" : ((m / 60) + " HOURS")));
        sel.appendChild(o);
      });
      sel.value = String(Math.round(shEvery / 60000));
      sel.addEventListener("change", function () {
        shEvery = clampEvery((parseFloat(sel.value) || DEFAULT_EVERY) * 60000);
        saveSettings();
        paintStateText(); renderPanel();
        print('SYSTEM', "THE SHIFT :: A QUIET HOUR NOW COMES AFTER " + mins(shEvery) + " MINUTES OF QUIET. IT IS STILL ONE CALL PER HOUR USED, CAPPED AT " + MAX_HOUR + " AN HOUR AND " + MAX_DAY + " A DAY.");
      });
    }
    var nowBtn = el("shNowBtn");
    if (nowBtn && !nowBtn.dataset.shWired) { nowBtn.dataset.shWired = "1"; nowBtn.addEventListener("click", function () { now(); }); }
    var closeBtn = el("shCloseBtn");
    if (closeBtn && !closeBtn.dataset.shWired) { closeBtn.dataset.shWired = "1"; closeBtn.addEventListener("click", close); }
    try { window.addEventListener("resize", function () { if (isOpen()) fit(); }); } catch (e) {}
    var q = el("shQueue");
    if (q && !q.dataset.shWired) {
      q.dataset.shWired = "1";
      q.addEventListener("click", async function (ev) {
        var b2 = ev.target && ev.target.closest ? ev.target.closest("button[data-sh-act]") : null;
        if (!b2) return;
        var n = b2.getAttribute("data-sh-n");
        var res = await dropIntent(n, { by: "patrikios took it off the queue" });
        print('SYSTEM', res.ok
          ? "THE SHIFT :: TAKEN OFF HER QUEUE :: \"" + up(res.item.text) + "\"\nIT IS NOT DELETED - IT STAYS IN THE RECORD AS TAKEN OFF BY YOU."
          : "THE SHIFT :: " + String(res.error || ""));
        renderPanel();
      });
    }
  }

  // ---- the doors ------------------------------------------------------------

  function setOn(v) {
    shOn = !!v;
    shArmed = Date.now();
    saveSettings();
    paintBadge();
    return shOn;
  }
  function setEvery(minsWanted) {
    var m = parseFloat(minsWanted);
    if (!isFinite(m) || m <= 0) return shEvery;
    shEvery = clampEvery(m * 60000);
    saveSettings();
    paintBadge();
    return shEvery;
  }

  // A quiet hour on demand - for looking at the machinery, and for the first one after a change.
  // The ceiling and the timer are his to set aside; only another hour in flight stops it.
  async function now() {
    if (shBusy) { print('SYSTEM', "THE SHIFT :: A QUIET HOUR IS BEING MADE RIGHT NOW. WAIT FOR IT TO FINISH."); return false; }
    print('SYSTEM', "THE SHIFT :: OPENING A QUIET HOUR NOW - THE ROOM IS QUIET AND SHE MAY USE IT OR REST IT.\nNOTHING IN IT WILL BE SAID TO YOU OR SPOKEN ALOUD. [[ACT: rest]] IS A REAL ANSWER.");
    return await compose("manual");
  }

  (function boot() {
    wire();
    var p = load();
    if (p && p.then) p.then(function () { start(); paintStateText(); }, function () { start(); });
    else start();
  })();

  window.shift = {
    on: function (v) { return v == null ? shOn : setOn(v); },
    every: function (v) { return v == null ? shEvery : setEvery(v); },
    now: now,
    tick: tick,
    should: should,
    state: state,
    describe: describe,
    logText: logText,
    journalText: journalText,
    queueText: queueText,
    intents: function () { return openIntents(); },
    addIntent: addIntent,
    markDone: markDone,
    dropIntent: dropIntent,
    clockLine: clockLine,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    refresh: refresh,
    load: load,
    ready: function () { return shReady; },
    prompt: prompt,
    tally: tally,
    ACTS: ACTS.map(function (a) { return { id: a.id, title: a.title }; })
  };
})();
