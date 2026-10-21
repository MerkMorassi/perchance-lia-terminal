/* THE SPINCODE LAYER, HIS SCROLLS - src/js/spincode-scrolls.js
 *
 * Patrikios, 2026-09-30: the five scrolls he handed over - Keyword/KeywordCount, SearchArchive,
 * the Agency lane, the comprehensive legacy list, the SPINCODE v0.1 spec. This file implements
 * HIS scroll commands verbatim and registers them into window.spincode's verb table (which
 * src/js/spincode.js owns). Legacy-list verbs that already exist aboard (/backup /clarify /mood
 * /pause-nouns...) are NOT duplicated - the spec's own UNIX test (§25) forbids it - and the ones
 * needing rooms or a broker are left to her. Loads AFTER spincode.js; sets window.spinscrolls so
 * /backup diag sees it.
 *
 * /Keyword <PHRASE> - lore search, printed as his Markdown card (phrase / description /
 *   objective / reference). Description is the best matching passage; objective is to surface it.
 * /KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME] - word-frequency
 *   extraction over the loaded lore (or one named scroll with "in"), unigrams or bigrams, Markdown
 *   table or screen lines. The "in" suffix is the one documented extension.
 * /SearchArchive <DOC> <PHRASE> <DISPLAY> - a named scroll is read whole, the phrase found (up to
 *   3 hits with context), Greek in the hits translated down the xlate road. DISPLAY: DisplayOn
 *   (sanitized Greek + English + literal meaning, the default), DisplayOff (sanitized Greek only),
 *   UnsanitizedEnglishOn/Off (raw Greek, with/without English), RegularMeaning (the literal one),
 *   SpiritualMeaning / IntimateMeaning / RitualContext / PhysicalQualities (machine prints Greek +
 *   English and HANDS THE MEANING LEVEL TO HER - only she reads those layers). SANITIZED means
 *   diacritics stripped (so Βλάστησις reads BLASTESIS); unsanitized keeps every breath.
 * The AGENCY lane: /EnableAgency <PERSONA> <LEVEL> and /DisableAgency <PERSONA> are the scroll's
 *   own names for /agency set/off. /SetRoutineReports /SetCheckInTime /SetFeedbackLoop keep the
 *   three schedule lines (his stated rhythm; the check-in hour is handed to her, /checkin keeps
 *   its own minutes). /BeginNewSessionSetup asks the four questions, or takes the answers as
 *   key-value pairs (timezone goes straight to /stamp zone's own road).
 * The DATA lane, all local and free: /RealTimeDataCleaning [on|off] (the toggle the capture and
 *   archive roads obey), /EnableKeywordTagging [on|off] (the toggle they tag by),
 *   /ProcessBlockText <TEXT|doc NAME> (chunked 450, cleaned, tagged, counted),
 *   /EnableSearchFunction [on|off] (lore search + /search already exist - the toggle says the
 *   road is open and prints both), /EnableDropDownFilters [on|off] (honest: this terminal has no
 *   menus, the line is the filter - /search, /lore find, /gallery find), /EnableChatLogging
 *   [on|off] (the archive already logs every turn - prints the count as proof),
 *   /ImplementDataSummarization (composes /summarize), /ImplementSecurityProtocols (composes
 *   /audit), /EnableTaskTracking [on|off] (the task ledger IS the tracker).
 */
(function () {
  "use strict";

  function say(t) { try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {} }
  function spin() { return window.spincode || null; }

  function loreFiles() {
    try { return window.lore.files(); } catch (e) { return null; }
  }
  async function loreFull(name, cap) {
    var src = null;
    try { src = await window.lore.source(name, cap || 200000); } catch (e) {}
    return src;
  }
  async function loreCorpus(only) {
    var files = loreFiles() || [], texts = [], i, total = 0;
    for (i = 0; i < files.length; i++) {
      if (only && files[i].name.toLowerCase().indexOf(only.toLowerCase()) === -1) continue;
      var src = await loreFull(files[i].name, 200000);
      if (src && src.text) {
        if (total + src.text.length > 400000) { texts.push(src.text.slice(0, 400000 - total)); break; }
        texts.push(src.text);
        total += src.text.length;
      }
    }
    return { texts: texts, docs: files.length };
  }

  function tons(a, verb) {
    var s = spin(); if (!s) return;
    s.def([verb], async function (st, arg) {
      var on = !/^off$/i.test(String(arg).trim());
      if (verb === "RealTimeDataCleaning") st.dataCleaning = on;
      if (verb === "EnableKeywordTagging") st.keywordTagging = on;
      if (verb === "EnableTaskTracking") st.taskTracking = on;
      if (verb === "EnableChatLogging") st.chatLogging = on;
      if (verb === "EnableSearchFunction") st.searchFunction = on;
      say(verb.toUpperCase() + " :: " + (on ? "ON" : "OFF") + ".");
    });
  }

  function register() {
    var s = spin();
    if (!s || !s.def) return false;

    s.def(["Keyword"], async function () {
      var args = Array.prototype.slice.call(arguments), a = args[1] || "";
      if (!a) { say("USAGE: /Keyword <PHRASE> - SEARCHES THE LOADED LORE, PRINTS HIS CARD."); return; }
      if (!window.lore || !window.lore.search) { say("THE LORE MODULE IS NOT LOADED HERE."); return; }
      var hits = [];
      try { hits = window.lore.search(a, 5) || []; } catch (e) {}
      if (!hits.length) { say("\"" + a + "\"\n\nDescription: NOTHING IN THE LOADED LORE ANSWERS TO THIS.\nObjective: LOAD THE SCROLL FIRST (LOAD LORE), THEN ASK AGAIN.\nReference: \"(none)\""); return; }
      var best = hits[0], excerpt = String(best.text || "").replace(/\s+/g, " ").trim().slice(0, 300);
      say("\"" + a + "\"\n\nDescription: " + excerpt + "\nObjective: SURFACE THE PASSAGE FOR THIS TURN.\nReference: \"" + best.file + "\""
        + (hits.length > 1 ? "\n(AND " + (hits.length - 1) + " MORE IN " + hits.slice(1).map(function (h) { return h.file; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(", ") + ")" : ""));
    });

    s.def(["KeywordCount"], async function () {
      var args = Array.prototype.slice.call(arguments), a = String(args[1] || "");
      var only = "", m = a.match(/^(.*)\bin\s+([\s\S]+)$/i);
      if (m) { a = m[1].trim(); only = m[2].trim(); }
      var p = a.match(/^(\d+)\s+(Keywords|KeywordPhrases)\s+(ASC|DESC)\s+(MD|SCREEN)$/i);
      if (!p) { say("USAGE: /KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME]."); return; }
      var qty = Math.max(1, Math.min(50, +p[1])), phrases = /^KeywordPhrases$/i.test(p[2]),
        asc = /^ASC$/i.test(p[3]), md = /^MD$/i.test(p[4]);
      var corpus = await loreCorpus(only);
      if (!corpus.texts.length) { say("NOTHING TO COUNT - " + (only ? "NO LOADED SCROLL CALLED ANYTHING LIKE \"" + only.toUpperCase() + "\"." : "NO LORE LOADED ON THIS DEVICE.") + " /lore LISTS WHAT IS HERE."); return; }
      var list = s.keywordsOf(corpus.texts.join("\n"), qty, phrases);
      if (asc) list.reverse();
      say((only ? "COUNTED IN " + only.toUpperCase() + " :: " : "COUNTED ACROSS " + corpus.docs + " LOADED DOCUMENTS :: ")
        + qty + " " + (phrases ? "PHRASES" : "KEYWORDS") + " " + (asc ? "ASC" : "DESC") + "\n" + s.keywordTable(list, md));
    });

    s.def(["SearchArchive"], async function () {
      var args = Array.prototype.slice.call(arguments), a = String(args[1] || "");
      var DISPLAYS = ["DisplayOn", "DisplayOff", "UnsanitizedEnglishOn", "UnsanitizedEnglishOff",
        "RegularMeaning", "SpiritualMeaning", "IntimateMeaning", "RitualContext", "PhysicalQualities"];
      var m = a.match(/^("([^"]+)"|(\S+))\s+([\s\S]+)$/);
      if (!m) { say("USAGE: /SearchArchive <DOC> <PHRASE> <DISPLAY> - DISPLAY DEFAULTS TO DisplayOn."); return; }
      var doc = (m[2] || m[3] || "").trim(), rest = m[4].trim(), display = "DisplayOn", phrase = rest;
      var tail = rest.match(/^(.*?)\s+(\S+)$/);
      if (tail && DISPLAYS.indexOf(tail[2]) !== -1) { phrase = tail[1].replace(/^"|"$/g, "").trim(); display = tail[2]; }
      else phrase = phrase.replace(/^"|"$/g, "").trim();
      if (!doc || !phrase) { say("USAGE: /SearchArchive <DOC> <PHRASE> <DISPLAY>."); return; }
      var src = await loreFull(doc, 200000);
      if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\" - LOAD IT FIRST (LOAD LORE), THEN ASK AGAIN."); return; }
      var q = phrase.toLowerCase(), text = src.text, hits = [], idx = -1, from = 0;
      while (hits.length < 3 && (idx = text.toLowerCase().indexOf(q, from)) !== -1) {
        hits.push(text.slice(Math.max(0, idx - 90), idx + q.length + 90).replace(/\s+/g, " ").trim());
        from = idx + q.length;
      }
      if (!hits.length) { say("SEARCHARCHIVE :: \"" + phrase + "\" APPEARS NOWHERE IN " + src.name + "."); return; }
      var L = ["SEARCHARCHIVE :: \"" + phrase + "\" IN " + src.name + " (" + hits.length + " SHOWN) [" + display + "]"];
      for (var i = 0; i < hits.length; i++) {
        var greek = [];
        try { greek = (window.xlate && window.xlate.greekPassages) ? window.xlate.greekPassages(hits[i]) : []; } catch (e) {}
        var raw = greek.length ? greek[0] : "";
        var san = raw ? s.sanitizeGreek(raw) : "";
        var eng = "";
        if (raw && display !== "DisplayOff" && window.xlate) {
          try { var r = await window.xlate.go(raw, "grc|en"); eng = r.text; } catch (e) {}
        }
        if (display === "DisplayOff") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "(no Greek in this hit)"));
        else if (display === "UnsanitizedEnglishOff") L.push("[" + (i + 1) + "] ANCIENT GREEK :: " + (raw || "(no Greek in this hit)"));
        else if (display === "UnsanitizedEnglishOn") L.push("[" + (i + 1) + "] ANCIENT GREEK :: " + (raw || "-") + "\nENGLISH :: " + (eng || "-"));
        else if (display === "RegularMeaning") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nMEANING (LITERAL) :: " + (eng || "-"));
        else if (display === "DisplayOn") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nENGLISH :: " + (eng || "-") + "\nMEANING :: " + (eng || "-"));
        else L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nENGLISH :: " + (eng || "-") + "\n" + display.toUpperCase() + " :: HANDED TO HER - THE " + display.replace(/([A-Z])/g, " $1").trim().toUpperCase() + " RIDES ON HER REPLY.");
      }
      say(L.join("\n"));
    });

    s.def(["EnableAgency"], async function (st, a) {
      var p = String(a).match(/^(\S+)\s+(\d{1,2})$/);
      if (!p) { say("USAGE: /EnableAgency <PERSONA> <LEVEL> - E.G. /EnableAgency Skye 10."); return; }
      var lv = Math.max(0, Math.min(10, +p[2]));
      st.agency[p[1]] = lv;
      say("AGENCY :: " + p[1].toUpperCase() + " AT LEVEL " + lv + ". (NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.)");
    });
    s.def(["DisableAgency"], async function (st, a) {
      var p = String(a).match(/^(\S+)$/);
      if (!p) { say("USAGE: /DisableAgency <PERSONA>."); return; }
      delete st.agency[p[1]];
      say("AGENCY :: " + p[1].toUpperCase() + " STANDS DOWN (NO AUTONOMOUS HANDLING).");
    });
    s.def(["SetRoutineReports"], async function (st, a) {
      if (!a) { say("ROUTINE REPORTS :: " + (st.reports || "(unset)") + ". /SetRoutineReports <FREQUENCY>."); return; }
      st.reports = a.slice(0, 60);
      say("ROUTINE REPORTS :: " + st.reports.toUpperCase() + " (KEPT, AND HANDED TO HER).");
    });
    s.def(["SetCheckInTime"], async function (st, a) {
      if (!a) { say("CHECK-IN TIME :: " + (st.checkinAt || "(unset)") + ". /SetCheckInTime <TIME>."); return; }
      st.checkinAt = a.slice(0, 60);
      say("CHECK-IN TIME :: " + st.checkinAt.toUpperCase() + " (KEPT, AND HANDED TO HER - /checkin KEEPS ITS OWN MINUTES).");
    });
    s.def(["SetFeedbackLoop"], async function (st, a) {
      if (!a) { say("FEEDBACK LOOP :: " + (st.feedbackEvery || "(unset)") + ". /SetFeedbackLoop <FREQUENCY>."); return; }
      st.feedbackEvery = a.slice(0, 60);
      say("FEEDBACK LOOP :: " + st.feedbackEvery.toUpperCase() + " (KEPT, AND HANDED TO HER).");
    });
    s.def(["BeginNewSessionSetup"], async function (st, a) {
      if (!a) {
        say("NEW SESSION SETUP :: ANSWER WITH KEY-VALUE PAIRS - TIMEZONE <IANA>, REPORTS <FREQUENCY>, CHECKIN <TIME>, FEEDBACK <FREQUENCY>.\nE.G. /BeginNewSessionSetup TIMEZONE America/Phoenix, REPORTS daily, CHECKIN 10:00 AM, FEEDBACK monthly");
        return;
      }
      var L = ["SESSION SETUP ::"], parts = String(a).split(/[,;\n]+/), i, applied = 0;
      for (i = 0; i < parts.length; i++) {
        var kvp = parts[i].trim().match(/^(timezone|time\s*zone|reports|checkin|check-in|feedback)\s+([\s\S]+)$/i);
        if (!kvp) continue;
        var k = kvp[1].toLowerCase().replace(/\s|-/g, ""), v = kvp[2].trim().slice(0, 80);
        if (k === "timezone") {
          try {
            if (window.logTime && window.logTime.hasZone(v)) { window.logTime.zone(v); L.push("- TIMEZONE :: " + v.toUpperCase() + " (SET ON THE CLOCK)."); }
            else L.push("- TIMEZONE :: \"" + v.toUpperCase() + "\" IS NOT A ZONE THIS MACHINE KNOWS - KEPT AS A WORD ONLY.");
          } catch (e) { L.push("- TIMEZONE :: NOT SET (" + e + ")."); }
        }
        if (k === "reports") { st.reports = v; L.push("- REPORTS :: " + v.toUpperCase() + "."); }
        if (k === "checkin") { st.checkinAt = v; L.push("- CHECKIN :: " + v.toUpperCase() + "."); }
        if (k === "feedback") { st.feedbackEvery = v; L.push("- FEEDBACK :: " + v.toUpperCase() + "."); }
        applied++;
      }
      if (!applied) L.push("(NOTHING PARSED - SEE THE USAGE ABOVE.)");
      say(L.join("\n"));
    });

    tons(null, "RealTimeDataCleaning");
    tons(null, "EnableKeywordTagging");

    s.def(["EnableSearchFunction"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.searchFunction = /^on$/i.test(arg);
      say("SEARCH :: THE ROAD IS OPEN - /search READS THE ARCHIVE OF PAST TURNS, /lore find READS THE LOADED SCROLLS."
        + (st.searchFunction ? "" : " (TOGGLE IS OFF - THE ROADS STILL STAND.)"));
    });
    s.def(["EnableDropDownFilters"], async function () {
      say("FILTERS :: THIS TERMINAL HAS NO MENUS - THE LINE IS THE FILTER: /search <WORDS> (TURNS), /lore find <NAME> (SCROLLS), /gallery find <WORDS> (PICTURES).");
    });
    s.def(["EnableChatLogging"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.chatLogging = /^on$/i.test(arg);
      var n = -1;
      try {
        var k = window.root && window.root.kv && window.root.kv.sacred_archive;
        if (k) { var log = await k.get("master_log"); if (Array.isArray(log)) n = log.length; }
      } catch (e) {}
      say("CHAT LOGGING :: " + (st.chatLogging ? "ON" : "OFF") + " - AND THE ARCHIVE LOGS EVERY TURN REGARDLESS"
        + (n >= 0 ? " (" + n + " TURNS ON THE RECORD RIGHT NOW)" : "") + ". /export CARRIES IT OUT.");
    });
    s.def(["ProcessBlockText"], async function (st, a) {
      var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
      if (m) {
        var src = await loreFull(m[1].trim(), 200000);
        if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
        text = src.text;
      }
      if (!text) { say("USAGE: /ProcessBlockText <TEXT> OR /ProcessBlockText doc <NAME>."); return; }
      if (st.dataCleaning) text = s.cleanText(text);
      var parts = text.split(/(?<=[.!?;\u037e\n])\s+/), pack = [], cur = "";
      parts.forEach(function (p) {
        while (p.length > 450) { pack.push(p.slice(0, 450)); p = p.slice(450); }
        if ((cur + " " + p).trim().length > 450 && cur) { pack.push(cur.trim()); cur = p; }
        else cur = (cur ? cur + " " : "") + p;
      });
      if (cur.trim()) pack.push(cur.trim());
      var L = ["BLOCK :: " + pack.length + " PIECES, CLEANED, TAGGED, COUNTED -"], i;
      for (i = 0; i < Math.min(pack.length, 20); i++) {
        var words = pack[i].split(/\s+/).length;
        var tags = s.hashtagsOf(pack[i], 3).join(" ");
        L.push("[" + (i + 1) + "] " + words + " WORDS" + (tags ? " " + tags : ""));
      }
      if (pack.length > 20) L.push("(AND " + (pack.length - 20) + " MORE - FIRST 20 SHOWN.)");
      say(L.join("\n"));
    });
    s.def(["ImplementDataSummarization"], async function (st, a) {
      var em = String(a).match(/^engine\s+([\s\S]+)$/i);
      if (em) {
        if (!window.spincode || !window.spincode.engineSummary) { say("THE SUMMARIZER IS NOT LOADED HERE."); return; }
        var erest = em[1].trim(), elabel = "PASTED TEXT";
        var emap = erest.match(/^map\s+doc\s+([\s\S]+)$/i);
        if (emap && window.spincode.engineSummaryDoc) {
          var mapOut = null;
          try { mapOut = await window.spincode.engineSummaryDoc(emap[1].trim(), "map"); } catch (e) { mapOut = "THE ENGINE ROAD WOULD NOT OPEN :: " + String((e && e.message) || e).toUpperCase(); }
          say(mapOut);
          return;
        }
        var edm = erest.match(/^doc\s+([\s\S]+)$/i);
        if (edm) {
          // The numbered road when it is available: whole original, dealt into parts.
          if (window.spincode.engineSummaryDoc) {
            var inner = edm[1].trim(), espec = "", edname = inner;
            var epm = inner.match(/^(.*?)\bparts\s+\d+\s*-\s*\d+\s*$/i) || inner.match(/^(.*?)\bpart\s+\d+\s*$/i) || inner.match(/^(.*?)\bmap\s*$/i);
            if (epm) {
              edname = epm[1].trim();
              var etail = inner.slice(epm[1].length).trim();
              espec = /^\bmap\b/i.test(etail) ? "map" : etail;
            }
            var edout = null;
            try { edout = await window.spincode.engineSummaryDoc(edname, espec); } catch (e) { edout = "THE ENGINE WOULD NOT SUMMARIZE IT :: " + String((e && e.message) || e).toUpperCase(); }
            say((/^map$/i.test(espec) ? "" : "SUMMARY OF " + edname.toUpperCase() + (espec ? " " + espec.toUpperCase() : "") + " (ENGINE, ABSTRACTIVE - SPENDS TEXT QUOTA) ::\n") + edout);
            return;
          }
          var esrc = await loreFull(edm[1].trim(), 240000);
          if (!esrc) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + edm[1].trim().toUpperCase() + "\"."); return; }
          erest = esrc.text; elabel = esrc.name;
        }
        var eout = null;
        try { eout = await window.spincode.engineSummary(erest, elabel); } catch (e) { eout = "THE ENGINE WOULD NOT SUMMARIZE IT :: " + String((e && e.message) || e).toUpperCase(); }
        say("SUMMARY OF " + elabel + " (ENGINE, ABSTRACTIVE - SPENDS TEXT QUOTA) ::\n" + eout);
        return;
      }
      var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
      if (m) {
        var src = await loreFull(m[1].trim(), 200000);
        if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
        text = src.text;
        say("SUMMARY OF " + src.name + " (LOCAL, EXTRACTIVE) :: " + s.summarizeExtractive(text, 3));
        return;
      }
      if (!text) { say("USAGE: /ImplementDataSummarization <TEXT> OR ... doc <NAME> (LOCAL, FREE) · /ImplementDataSummarization engine <TEXT|doc NAME> (ABSTRACTIVE, SPENDS TEXT QUOTA)."); return; }
      say(s.summarizeExtractive(st.dataCleaning ? s.cleanText(text) : text, 3) || "NOTHING TO SUMMARIZE.");
    });
    s.def(["ImplementSecurityProtocols"], async function (st) {
      say("SECURITY PROTOCOLS :: READ OUT, THEN KEPT AS STATED POSTURE -");
      try {
        var ring = await window.keyring.list();
        say("- RING :: " + (Array.isArray(ring) ? ring.length : 0) + " KEYS (IDS ONLY).");
      } catch (e) { say("- RING :: UNREADABLE HERE."); }
      say("- RECORD :: THIS DEVICE ONLY (kv), NOTHING UPLOADED EXCEPT WHAT /sync AND /cloud SEND BY HAND.");
      say("- CONSENT :: " + st.consent.filter(function (c) { return c.st === "pending"; }).length + " PENDING - NOTHING GRANTED WITHOUT /approve.");
      say("- AGENCY :: NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.");
    });
    s.def(["EnableTaskTracking"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.taskTracking = /^on$/i.test(arg);
      var open = st.tasks ? st.tasks.filter(function (t) { return t.st === "open" || t.st === "waiting" || t.st === "active"; }) : [];
      say("TASK TRACKING :: " + (st.taskTracking ? "ON" : "OFF") + " - " + open.length + " OPEN."
        + (open.length ? "\n" + open.map(function (t) { return "#" + t.id + " [" + t.st.toUpperCase() + "] " + t.text; }).join("\n") : ""));
    });

    return true;
  }

  if (register()) {
    window.spinscrolls = { ok: true, file: "src/js/spincode-scrolls.js" };
  } else {
    window.spinscrolls = { ok: false, error: "spincode core did not load first" };
  }
})();
