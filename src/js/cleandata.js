(function () {
  "use strict";

  var running = false;

  function resolveName(q) {
    q = String(q == null ? "" : q).trim();
    if (!q) return null;
    try {
      if (window.lore && window.lore.findDoc) {
        var hit = window.lore.findDoc(q);
        if (hit) return hit;
      }
    } catch (e) {}
    return null;
  }

  async function rawOf(name) {
    try {
      var st = window.root && window.root.kv && window.root.kv.lore_files;
      if (!st) return null;
      var rec = await st.get(name);
      if (rec && typeof rec.raw === "string" && rec.raw.trim()) return rec.raw;
    } catch (e) {}
    return null;
  }

  function normTag(w) {
    w = String(w == null ? "" : w).toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
    return w.slice(0, 40);
  }

  function hashTags(keywords) {
    var seen = {}, out = [];
    (keywords || []).forEach(function (k) {
      var t = normTag(k);
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push("#" + t);
    });
    return out.slice(0, 20);
  }

  function splitKeywords(s) {
    return String(s == null ? "" : s).split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20);
  }

  function instruction(raw) {
    var rules = [
      "You clean raw session data for storage and retrieval. Carry out every step below on the text, in order:",
      "1. Convert the statements to standard English.",
      "2. Correct every spelling error to standard American English spelling.",
      "3. Extract a list of keywords - the most relevant terms, comma-separated, no more than twenty.",
      "4. Estimate the ONE topic of conversation, in five words or fewer.",
      "5. Reconstruct the cleaned data as flowing text.",
      "Output EXACTLY these three labeled sections and nothing else:",
      "CLEANED TEXT:",
      "<the reconstructed cleaned text>",
      "KEYWORDS:",
      "<comma-separated keywords>",
      "TOPIC:",
      "<the estimated topic>"
    ];
    return rules.join("\n")
      + "\n\n<raw>\n" + String(raw) + "\n</raw>\n"
      + "\nTASK: Clean the raw text above. Output ONLY the three labeled sections.";
  }

  function parseSections(text) {
    var out = { cleaned: "", keywords: "", topic: "" };
    var m = String(text == null ? "" : text);
    function grab(label, next) {
      var a = m.search(new RegExp("^" + label + "\\s*:?\\s*$", "im"));
      if (a === -1) return "";
      var body = m.slice(a).replace(new RegExp("^" + label + "\\s*:?\\s*", "i"), "");
      if (next) {
        var b = body.search(new RegExp("^" + next + "\\s*:?\\s*$", "im"));
        if (b !== -1) body = body.slice(0, b);
      }
      return body.trim();
    }
    out.cleaned = grab("CLEANED TEXT", "KEYWORDS");
    out.keywords = grab("KEYWORDS", "TOPIC");
    out.topic = grab("TOPIC", null).split("\n")[0].trim();
    if (!out.cleaned) out.cleaned = m.trim();
    return out;
  }

  async function clean(raw, label) {
    if (!window.root || !window.root.generateText) return { ok: false, error: "CLEANDATA :: THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE." };
    if (running) return { ok: false, error: "CLEANDATA :: A CLEANING PASS IS ALREADY RUNNING." };
    raw = String(raw == null ? "" : raw);
    if (!raw.trim()) return { ok: false, error: "CLEANDATA :: NOTHING TO CLEAN." };
    running = true;
    var B = null;
    try {
      if (window.progress) B = window.progress.begin("CLEANING DATA", { id: "cleandata", detail: "the cleaning pass - " + String(label || "raw text").slice(0, 40) });
    } catch (e) {}
    var text = "";
    try {
      var ans = await window.root.generateText({ temperature: 0.2, instruction: instruction(raw.slice(0, 15000)) });
      text = String(ans == null ? "" : ans).trim();
    } catch (e) {
      running = false;
      try { if (window.progress) window.progress.fail("cleandata", "THE ENGINE DID NOT ANSWER"); } catch (e2) {}
      return { ok: false, error: "CLEANDATA :: THE PASS FAILED :: " + String((e && e.message) || e).toUpperCase() };
    }
    running = false;
    try { if (window.progress) window.progress.finish("cleandata"); } catch (e) {}
    if (!text) return { ok: false, error: "CLEANDATA :: THE ENGINE ANSWERED EMPTY." };
    var sec = parseSections(text);
    var keys = splitKeywords(sec.keywords);
    var tags = hashTags(keys.length ? keys : sec.topic.split(/[\s,]+/));
    var formatted = "CLEANED TEXT:\n" + sec.cleaned
      + "\n\nKEYWORDS:\n" + (keys.join(", ") || "-")
      + "\n\nHASHTAGS:\n" + (tags.join(" ") || "-")
      + "\n\nTOPIC:\n" + (sec.topic || "-");
    return { ok: true, cleaned: sec.cleaned, keywords: keys, hashtags: tags, topic: sec.topic, formatted: formatted };
  }

  async function keepAs(name, formatted) {
    if (!window.lore || !window.lore.ingest) return { ok: false, error: "CLEANDATA :: THE LORE IS OFFLINE - NOTHING WAS FILED." };
    var doc = "CLEAN " + name;
    var body = formatted;
    try {
      if (window.docstd && window.docstd.wrap) {
        body = window.docstd.wrap({ title: doc, body: formatted, changes: "Raw session data cleaned, tagged and indexed." });
      }
    } catch (e) {}
    try {
      await window.lore.ingest(doc, body, { pack: "LOREPACK", origin: "local" });
      return { ok: true, name: doc };
    } catch (e) { return { ok: false, error: "CLEANDATA :: THE CLEANED DATA COULD NOT BE FILED." }; }
  }

  function help() {
    return [
      "CLEANDATA :: RAW SESSION DATA IN, CLEAN TAGGED DATA OUT",
      "",
      "  ONE PASS: grammar to standard English, spelling to American English, keywords out,",
      "  hashtags built from them (deterministic, searchable), the topic estimated, the text",
      "  reconstructed - ONE text-engine call, then filed docstd-wrapped when kept.",
      "",
      "  /cleandata <DOC>         CLEAN A MEMORY DOCUMENT AND PRINT IT (NOTHING FILED)",
      "  /cleandata <DOC> keep    CLEAN IT AND FILE 'CLEAN <DOC>' IN THE LOREPACK",
      "  /cleandata :: <TEXT>     CLEAN PASTED RAW TEXT AND PRINT IT",
      "",
      "  THE BASH/spaCy WORKFLOW IN THE SPEC HAS NO BROWSER EQUIVALENT: the engine does the",
      "  language work, this device does the tagging. /adapt and /adopt do not exist here -",
      "  this command IS the combined /CleanDataWithTagsAndTopics."
    ].join("\n");
  }

  window.cleandata = {
    clean: clean,
    keepAs: keepAs,
    rawOf: rawOf,
    resolveName: resolveName,
    help: help,
    busy: function () { return running; }
  };
})();
