(function () {
  "use strict";

  var FOLDER = "auditor_reviews";
  var HEAD_CHARS = 12000;
  var TAIL_CHARS = 3000;

  var running = false;
  var stopped = false;
  var stopHandle = null;

  function store() {
    try { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
    catch (e) { return null; }
  }

  function loreStore() {
    try { return (window.root && window.root.kv && window.root.kv.lore_files) || null; }
    catch (e) { return null; }
  }

  function hash(s) {
    s = String(s == null ? "" : s);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16) + ":" + s.length;
  }

  function dateRef(d) {
    d = d || new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getMonth() + 1) + p(d.getDate()) + d.getFullYear();
  }

  function stamp(at) {
    try { return new Date(at).toISOString().slice(0, 16).replace("T", " "); }
    catch (e) { return String(at); }
  }

  function docs() {
    try { return (window.lore && window.lore.files()) || []; }
    catch (e) { return []; }
  }

  function resolveName(q) {
    q = String(q == null ? "" : q).trim();
    if (!q) return null;
    try {
      if (window.lore && window.lore.findDoc) {
        var hit = window.lore.findDoc(q);
        if (hit) return hit;
      }
    } catch (e) {}
    var list = docs(), low = q.toLowerCase(), i;
    for (i = 0; i < list.length; i++) if (list[i].name === q) return list[i].name;
    for (i = 0; i < list.length; i++) if (list[i].name.toLowerCase().indexOf(low) !== -1) return list[i].name;
    return null;
  }

  async function rawOf(name) {
    var st = loreStore();
    if (!st) return null;
    try {
      var rec = await st.get(name);
      if (rec && typeof rec.raw === "string" && rec.raw.trim()) return rec.raw;
    } catch (e) {}
    return null;
  }

  function sliceSrc(text) {
    text = String(text);
    var whole = text.length <= HEAD_CHARS;
    var head = whole ? text : text.slice(0, HEAD_CHARS);
    var tail = whole ? "" : text.slice(-TAIL_CHARS);
    return {
      head: head, tail: tail, whole: whole, chars: text.length,
      from: whole
        ? ("THE WHOLE DOCUMENT (" + text.length + " CHARACTERS)")
        : ("THE FIRST " + head.length + " AND THE LAST " + tail.length + " OF " + text.length + " CHARACTERS")
    };
  }

  function instruction(name, src, when) {
    var rules = [
      "You are the AUDITOR, a business-intelligence reviewer mining documents for ACTIONABLE intelligence. You work inside LIA TERMINAL for Patrikios, the man who keeps the archive.",
      "Carry out the review process EXACTLY, in this order:",
      "1. READ the document below fully - its purpose, its structure, its specific content areas.",
      "2. SUMMARY OF FINDINGS IN THE FORM OF AN OUTLINE, under the heading 'Summary of Findings (Outline)' - main headings, subheadings, and the critical points under each section.",
      "3. A DETAILED REPORT expanding every outline point - descriptions and objectives stated in the document.",
      "4. Format the report with exactly these headers: 'Detailed Report on Findings', 'Date Reference (" + when + ")', 'Document Reference (Ref. \"" + name + "\")'.",
      "5. A GENERAL SUMMARY AND ASSESSMENT OF PROS AND CONS - advantages, disadvantages, implications, a balanced view.",
      "6. Throughout, keep a critical eye on implementation feasibility, potential impact, and alignment with organizational goals. Anything needing clarification or further information goes under FOLLOW-UP points.",
      "Output ONLY the review report, in the terminal's plain uppercase voice. No preamble about the process, no offer to help, no closing line. Invent nothing that is not in the text."
    ];
    return rules.join("\n")
      + "\n\nDOCUMENT :: " + name + " :: " + src.chars + " CHARACTERS\n"
      + "<document>\n" + src.head
      + (src.whole ? "" : "\n\n[... " + (src.chars - src.head.length - src.tail.length) + " CHARACTERS LEFT OUT HERE - THE DOCUMENT CONTINUES ...]\n\n" + src.tail)
      + "\n</document>\n"
      + "\nTASK: Audit the document above, following the six steps. Output ONLY the report.";
  }

  function bar(name) {
    try {
      if (window.progress) return window.progress.begin("AUDITING", {
        id: "auditor", detail: "the auditor - " + name
      });
    } catch (e) {}
    return null;
  }

  function barDone(ok, why) {
    try {
      if (!window.progress) return;
      if (ok) window.progress.finish("auditor");
      else window.progress.fail("auditor", why || "FAILED");
    } catch (e) {}
  }

  async function kept(name) {
    var st = store();
    if (!st) return null;
    try { return await st.get(name); } catch (e) { return null; }
  }

  async function review(name) {
    var target = resolveName(name);
    if (!target) return { ok: false, error: "AUDITOR :: NO DOCUMENT CALLED \"" + String(name || "").toUpperCase() + "\" - /lore LISTS THEM." };
    if (!window.root || !window.root.generateText) return { ok: false, error: "AUDITOR :: THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE, SO NOTHING CAN BE REVIEWED." };
    if (running) return { ok: false, error: "AUDITOR :: A REVIEW IS ALREADY RUNNING - /auditor stop ENDS IT." };
    var raw = await rawOf(target);
    if (raw == null) return { ok: false, error: "AUDITOR :: THE STORED TEXT OF " + target + " COULD NOT BE READ." };
    var src = sliceSrc(raw);
    var when = dateRef(new Date());
    running = true;
    stopped = false;
    stopHandle = null;
    var B = bar(target);
    var text = "";
    try {
      var call = window.root.generateText({ temperature: 0.3, instruction: instruction(target, src, when) });
      try { stopHandle = call; } catch (e) {}
      var ans = await call;
      text = String(ans == null ? "" : ans).trim();
    } catch (e) {
      running = false;
      stopHandle = null;
      barDone(false, stopped ? "STOPPED" : "THE ENGINE DID NOT ANSWER");
      if (stopped) return { ok: false, stopped: true, error: "AUDITOR :: STOPPED - " + target + " WAS NOT REVIEWED." };
      return { ok: false, error: "AUDITOR :: THE REVIEW OF " + target + " COULD NOT BE MADE :: " + String((e && e.message) || e).toUpperCase() };
    }
    running = false;
    stopHandle = null;
    if (!text) {
      barDone(false, "EMPTY ANSWER");
      return { ok: false, error: "AUDITOR :: THE ENGINE ANSWERED EMPTY FOR " + target + " - NOTHING WAS KEPT." };
    }
    var rec = { at: Date.now(), when: when, chars: src.chars, hash: hash(raw), from: src.from, report: text };
    var st = store();
    if (st) { try { await st.set(target, rec); } catch (e) {} }
    barDone(true);
    return { ok: true, name: target, report: text, from: src.from, kept: !!st };
  }

  async function nextName() {
    var list = docs();
    var st = store();
    for (var i = 0; i < list.length; i++) {
      var raw = await rawOf(list[i].name);
      if (raw == null) continue;
      var k = null;
      if (st) { try { k = await st.get(list[i].name); } catch (e) {} }
      if (!k || k.hash !== hash(raw)) return list[i].name;
    }
    return null;
  }

  async function list() {
    var all = docs();
    var st = store();
    var L = ["AUDITOR :: THE REVIEWS KEPT ON THIS DEVICE"];
    if (!all.length) {
      L.push("  NO DOCUMENTS IN HER MEMORY - LOAD LOREPACK FIRST.");
      return L.join("\n");
    }
    var fresh = 0, stale = 0, missing = 0, shown = 0;
    for (var i = 0; i < all.length; i++) {
      var raw = await rawOf(all[i].name);
      var k = null;
      if (st && raw != null) { try { k = await st.get(all[i].name); } catch (e) {} }
      var state = (!k) ? "UNREVIEWED" : ((raw != null && k.hash === hash(raw)) ? "REVIEWED" : "STALE");
      if (state === "REVIEWED") fresh++;
      else if (state === "STALE") stale++;
      else missing++;
      if (shown < 40 && state !== "REVIEWED") {
        shown++;
        L.push("  " + state.padEnd(10) + all[i].name + (k ? "  (LAST " + k.when + " - THE DOCUMENT CHANGED SINCE)" : ""));
      }
    }
    if (missing + stale - shown > 0) L.push("  ... AND " + (missing + stale - shown) + " MORE UNREVIEWED OR STALE.");
    L.push("  " + fresh + " REVIEWED AND FRESH / " + stale + " STALE (DOCUMENT CHANGED) / " + missing + " UNREVIEWED, OF " + all.length + ".");
    L.push("  /auditor <DOC> REVIEWS ONE :: /auditor next TAKES THE NEXT UNREVIEWED OR STALE ONE :: /auditor all <N> TAKES N IN TURN (ONE TEXT-ENGINE CALL EACH).");
    return L.join("\n");
  }

  async function show(name) {
    var target = resolveName(name) || String(name || "").trim();
    if (!target) return "AUDITOR :: NAME A DOCUMENT - /auditor list SAYS WHAT IS REVIEWED.";
    var k = await kept(target);
    if (!k || !k.report) return "AUDITOR :: NO REVIEW IS KEPT FOR " + String(target).toUpperCase() + ".";
    var raw = await rawOf(target);
    var fresh = (raw != null && k.hash === hash(raw));
    return "AUDIT OF " + target + " :: KEPT " + stamp(k.at) + " :: FROM " + (k.from || "THE DOCUMENT")
      + (fresh ? "" : " :: STALE - THE DOCUMENT HAS CHANGED SINCE THIS WAS WRITTEN") + "\n\n" + k.report;
  }

  async function forget(name) {
    var target = resolveName(name) || String(name || "").trim();
    if (!target) return { ok: false, error: "AUDITOR :: NAME A DOCUMENT." };
    var st = store();
    if (!st) return { ok: false, error: "AUDITOR :: STORAGE IS NOT AVAILABLE." };
    var k = null;
    try { k = await st.get(target); } catch (e) {}
    if (!k) return { ok: false, error: "AUDITOR :: NO REVIEW IS KEPT FOR " + String(target).toUpperCase() + "." };
    try { await st.delete(target); } catch (e) { return { ok: false, error: "AUDITOR :: THE REVIEW COULD NOT BE DROPPED." }; }
    return { ok: true, text: "AUDITOR :: THE REVIEW OF " + target + " IS DROPPED - THE DOCUMENT ITSELF IS UNTOUCHED." };
  }

  function stop() {
    if (!running) return false;
    stopped = true;
    try { if (stopHandle && stopHandle.stop) stopHandle.stop(); } catch (e) {}
    return true;
  }

  function help() {
    var L = [];
    L.push("THE AUDITOR :: MINING HER MEMORY FOR ACTIONABLE BUSINESS INTELLIGENCE");
    L.push("");
    L.push("  ONE DOCUMENT GOES IN, ONE REVIEW COMES OUT: THE OUTLINE OF ITS FINDINGS, THE DETAILED");
    L.push("  REPORT (WITH ITS DATE AND DOCUMENT REFERENCES), THE GENERAL SUMMARY WITH PROS AND CONS,");
    L.push("  AND THE FEASIBILITY / IMPACT / ALIGNMENT JUDGEMENT WITH FOLLOW-UP POINTS. EACH REVIEW IS");
    L.push("  KEPT ON THIS DEVICE, STAMPED WITH WHEN IT WAS MADE AND WHAT IT WAS MADE FROM - A DOCUMENT");
    L.push("  THAT CHANGES AFTERWARDS IS MARKED STALE, NEVER SILENTLY TRUSTED.");
    L.push("");
    L.push("  /auditor <DOC>      REVIEW ONE DOCUMENT (ONE TEXT-ENGINE CALL)");
    L.push("  /auditor next       REVIEW THE NEXT UNREVIEWED OR STALE DOCUMENT IN HER ORDER");
    L.push("  /auditor all <N>    REVIEW THE NEXT N IN TURN - N IS REQUIRED, BECAUSE EACH ONE IS A CALL");
    L.push("  /auditor list       WHAT IS REVIEWED, WHAT IS STALE, WHAT IS WAITING");
    L.push("  /auditor show <DOC> PRINT THE KEPT REVIEW OF ONE DOCUMENT");
    L.push("  /auditor forget <DOC> DROP ONE KEPT REVIEW (THE DOCUMENT IS UNTOUCHED)");
    L.push("  /auditor stop       END A RUNNING REVIEW AFTER THE CALL IN HAND");
    L.push("");
    L.push("  NOTHING IS UPLOADED AND NO DOCUMENT IS EVER WRITTEN - A REVIEW IS KEPT BESIDE ITS");
    L.push("  DOCUMENT, THE WAY THE DOX VIEWER KEEPS A SUMMARY BESIDE ITS OWN.");
    return L.join("\n");
  }

  window.auditor = {
    review: review,
    nextName: nextName,
    list: list,
    show: show,
    forget: forget,
    stop: stop,
    help: help,
    busy: function () { return running; },
    wasStopped: function () { return stopped; }
  };
})();
