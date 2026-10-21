window.MythosJournal = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function pad(n) { n = num(n, 0); return (n < 10 ? "0" : "") + n; }
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  function fmtT(ts) {
    var d = null;
    try { d = new Date(num(ts, 0)); } catch (e) { return "?"; }
    try {
      return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate())
        + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC";
    } catch (e) { return "?"; }
  }
  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(num(ms, 0) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + "H" + (m ? m + "M" : "");
    if (m > 0) return m + "M";
    return s + "S";
  }
  function tagsOf(text, max) {
    var out = [], seen = {};
    var cap = Math.min(16, Math.max(1, num(max, 8) || 8));
    str(text).replace(/#([A-Za-z0-9_-]+)/g, function (m, w) {
      w = str(w).toLowerCase();
      if (!seen[w] && out.length < cap) { seen[w] = 1; out.push(w); }
      return m;
    });
    return out;
  }
  function fmtLine(e, stampFn) {
    var st = stampFn ? stampFn(e.ts) : fmtT(e.ts);
    return "[" + st + "]" + ((e.tags || []).length ? " #" + e.tags.join(" #") : "") + " " + str(e.text);
  }
  function tagCounts(list) {
    var c = {};
    list.forEach(function (e) { (e.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || (a < b ? -1 : 1); }).map(function (t) { return { tag: t, n: c[t] }; });
  }
  function composeMinutes(now, since, win, stampFn) {
    var L = [];
    L.push("JOURNAL MINUTES :: " + fmtT(now) + " :: WINDOW " + (since ? fmtT(since) : "THE BEGINNING") + " -> " + fmtT(now));
    var tc = tagCounts(win);
    L.push(win.length + " LINE" + (win.length === 1 ? "" : "S")
      + (tc.length ? " :: TAGS " + tc.map(function (c) { return "#" + c.tag + "(" + c.n + ")"; }).join(" ") : " :: NO TAGS"));
    var lines = win.slice(-60);
    for (var i = 0; i < lines.length; i++) L.push(fmtLine(lines[i], stampFn));
    if (win.length > lines.length) L.push("... AND " + (win.length - lines.length) + " MORE - show READS THEM.");
    return L.join("\n");
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var kv = opts.kvFolder || null;
    var SLOT = str(opts.slot || "journal") || "journal";
    var CAP = Math.min(2000, Math.max(10, num(opts.cap, 2000) || 2000));
    var MCAP = Math.min(200, Math.max(10, num(opts.minutesCap, 200) || 200));
    var GAP = Math.max(60000, num(opts.intervalMs, 6 * 3600 * 1000) || 6 * 3600 * 1000);
    var MAX_TEXT = Math.min(8000, Math.max(200, num(opts.maxText, 2000) || 2000));
    var clock = (typeof opts.clock === "function") ? opts.clock : function () { return Date.now(); };
    var stampFn = (typeof opts.stamp === "function") ? opts.stamp : null;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    var entries = [];
    var filed = [];
    var lastBeat = 0;
    var ready = false;
    function validSnap(s) {
      return !!(s && typeof s === "object" && Array.isArray(s.entries) && Array.isArray(s.minutes));
    }
    async function persist() {
      var snap = { v: 1, entries: entries.slice(-CAP), minutes: filed.slice(-MCAP), last: lastBeat };
      try { if (kv) await kv.set(SLOT, snap); else await store.save(snap); } catch (e) {}
    }
    async function load() {
      var snap = null;
      try { snap = kv ? await kv.get(SLOT) : await store.load(); } catch (e) { snap = null; }
      if (validSnap(snap)) {
        entries = snap.entries.filter(function (e) { return e && num(e.ts, 0) > 0 && str(e.text); });
        filed = snap.minutes.filter(function (m) { return m && num(m.ts, 0) > 0 && str(m.text); });
        lastBeat = num(snap.last, 0) || 0;
      }
      ready = true;
      return { ok: true, lines: entries.length, minutes: filed.length };
    }
    async function file(text) {
      text = str(text).trim();
      if (!text) {
        var e0 = "NOTHING LOGGED - GIVE THE LINE WITH THE COMMAND.";
        say(e0);
        return { ok: false, error: e0 };
      }
      if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
      var e = { id: "j" + clock().toString(36) + Math.floor(Math.random() * 1296).toString(36),
        ts: clock(), text: text, tags: tagsOf(text) };
      entries.push(e);
      entries = entries.slice(-CAP);
      await persist();
      say("LOGGED :: " + (stampFn ? stampFn(e.ts) : fmtT(e.ts)) + (e.tags.length ? " :: #" + e.tags.join(" #") : "")
        + "\n" + e.text.slice(0, 160));
      return { ok: true, entry: e };
    }
    function show(n) {
      n = Math.max(1, Math.min(200, Math.floor(num(n, 10)) || 10));
      var win = entries.slice(-n);
      return { ok: true, total: entries.length,
        text: win.length ? ("THE JOURNAL :: LAST " + win.length + " OF " + entries.length + "\n"
          + win.map(function (e) { return fmtLine(e, stampFn); }).join("\n")) : "THE JOURNAL IS EMPTY - FILE THE FIRST LINE." };
    }
    function tag(t, n) {
      t = str(t).replace(/^#/, "").toLowerCase();
      if (!t) return { ok: false, error: "NAME THE TAG." };
      n = Math.max(1, Math.min(200, Math.floor(num(n, 20)) || 20));
      var win = entries.filter(function (e) { return (e.tags || []).indexOf(t) !== -1; }).slice(-n);
      return { ok: true, total: win.length,
        text: win.length ? ("JOURNAL #" + t.toUpperCase() + " :: " + win.length + "\n"
          + win.map(function (e) { return fmtLine(e, stampFn); }).join("\n")) : "NOTHING FILED UNDER #" + t.toUpperCase() + "." };
    }
    function tags() {
      var tc = tagCounts(entries);
      return { ok: true, tags: tc,
        text: tc.length ? ("JOURNAL TAGS :: " + tc.map(function (c) { return "#" + c.tag + " " + c.n; }).join("  -  "))
          : "NO TAGS YET - FILE A LINE WITH A #WORD IN IT." };
    }
    async function fileMinutes(reason) {
      var now = clock();
      var since = lastBeat || 0;
      var win = entries.filter(function (e) { return e.ts > since; });
      lastBeat = now;
      if (!win.length) { await persist(); return { ok: true, empty: true }; }
      var m = { ts: now, since: since, lines: win.length,
        text: composeMinutes(now, since, win, stampFn), auto: reason !== "hand" };
      filed.push(m);
      filed = filed.slice(-MCAP);
      await persist();
      say(m.text);
      return { ok: true, minutes: m };
    }
    async function tick() {
      if (clock() - lastBeat < GAP) return { ok: false, error: "NOT DUE." };
      return fileMinutes("beat");
    }
    async function force() { return fileMinutes("hand"); }
    function status() {
      var tc = tagCounts(entries);
      var next = lastBeat + GAP - clock();
      return { ok: true,
        text: "JOURNAL :: " + entries.length + " LINE" + (entries.length === 1 ? "" : "S")
          + " :: " + tc.length + " TAG" + (tc.length === 1 ? "" : "S")
          + " :: MINUTES " + filed.length + " FILED"
          + (filed.length ? " :: LAST " + fmtT(filed[filed.length - 1].ts) : "")
          + " :: NEXT IN " + (next > 0 ? fmtDur(next) : "DUE NOW.") };
    }
    function last() { return filed.length ? filed[filed.length - 1] : null; }
    function list(n) { return filed.slice(-Math.max(1, num(n, filed.length) || filed.length)); }
    // THE AGENT'S HANDOFF. The editor's agent cannot read the store directly - it pulls
    // through the live page - so this is the one call it makes at session start: status,
    // tags, the last lines verbatim, and the last minutes, cut to fit a context window.
    function briefing(n, maxChars) {
      n = Math.max(1, Math.min(20, Math.floor(num(n, 5)) || 5));
      var asked = num(maxChars, 3000) || 3000;
      var cap = Math.max(160, Math.min(8000, asked));
      var tc = tagCounts(entries);
      var L = [];
      L.push("AGENT-BRIEF :: JOURNAL " + entries.length + " LINE" + (entries.length === 1 ? "" : "S")
        + (tc.length ? " :: " + tc.map(function (c) { return "#" + c.tag + "(" + c.n + ")"; }).join(" ") : " :: NO TAGS")
        + " :: MINUTES " + filed.length + " FILED");
      var lines = entries.slice(-n);
      for (var i = 0; i < lines.length; i++) L.push(fmtLine(lines[i], stampFn));
      var l = last();
      if (l) L.push("LAST MINUTES :: " + l.text);
      var text = L.join("\n");
      if (text.length > cap) text = text.slice(0, cap) + "\n... CUT TO FIT - show AND minutes READ THE REST.";
      return { ok: true, text: text, lines: entries.length };
    }
    function exportLog() {
      var d = new Date(clock());
      function p(n) { return (n < 10 ? "0" : "") + n; }
      return { ok: true,
        filename: "journal-" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".json",
        json: JSON.stringify({ app: "mythos-journal", exportedAt: fmtT(clock()), entries: entries, minutes: filed }, null, 2) };
    }
    function importLog(text) {
      var d = null;
      try { d = JSON.parse(str(text)); } catch (e) { return { ok: false, error: "THAT IS NOT A JOURNAL FILE." }; }
      var got = Array.isArray(d) ? d : d.entries;
      if (!Array.isArray(got)) return { ok: false, error: "THAT FILE HOLDS NO LINES." };
      var seen = {};
      entries.forEach(function (e) { if (e && e.id) seen[e.id] = 1; });
      var added = 0, skipped = 0;
      got.forEach(function (e) {
        if (!e || !(num(e.ts, 0) > 0) || !str(e.text).trim()) { skipped++; return; }
        if (e.id && seen[e.id]) { skipped++; return; }
        entries.push({ id: str(e.id) || ("j" + num(e.ts, 0).toString(36)), ts: num(e.ts, 0),
          text: str(e.text).slice(0, MAX_TEXT), tags: Array.isArray(e.tags) ? e.tags : tagsOf(e.text) });
        if (e.id) seen[e.id] = 1;
        added++;
      });
      entries = entries.slice(-CAP);
      try { persist(); } catch (e) {}
      say("JOURNAL IMPORT :: " + added + " ADDED, " + skipped + " SKIPPED.");
      return { ok: true, added: added, skipped: skipped };
    }
    function clear() {
      entries = []; filed = []; lastBeat = 0;
      try { persist(); } catch (e) {}
      say("THE JOURNAL IS EMPTY - LINES, MINUTES AND THE BEAT, ALL GONE.");
      return { ok: true };
    }
    async function words(rest) {
      rest = str(rest).trim();
      var parts = rest.split(/\s+/).filter(Boolean);
      var verb = (parts[0] || "").toLowerCase();
      if (!rest || verb === "help" || verb === "about") return { ok: true, text: describe() };
      if (verb === "status") return status();
      if (verb === "show") return show(parts[1]);
      if (verb === "tags") return tags();
      if (verb === "tag" && parts[1]) return tag(parts[1], parts[2]);
      if (verb === "minutes") {
        var sub = (parts[1] || "").toLowerCase();
        if (sub === "now" || sub === "file") { var f = await fileMinutes("hand"); return { ok: true, said: true, minutes: f.minutes || null }; }
        if (sub === "last") {
          var l = last();
          return { ok: true, text: l ? l.text : "NO MINUTES FILED YET." };
        }
        if (/^\d+$/.test(sub)) {
          var i = Math.floor(num(sub, 0));
          if (i < 1 || i > filed.length) return { ok: true, text: "THERE ARE " + filed.length + " FILED." };
          return { ok: true, text: filed[i - 1].text };
        }
        return { ok: true, text: "MINUTES :: " + filed.length + " FILED"
          + (filed.length ? " :: LAST " + fmtT(filed[filed.length - 1].ts) : "") + "." };
      }
      if (verb === "export") { var ex = exportLog(); return { ok: true, action: "download", filename: ex.filename, json: ex.json }; }
      if (verb === "brief") return briefing(parts[1]);
      if (verb === "import") return { ok: false, error: "HAND THE FILE'S TEXT TO importLog - THE DOOR TAKES NO URLS." };
      if (verb === "wipe" && parts[1] === "yes") { clear(); return { ok: true, said: true }; }
      if (verb === "wipe") return { ok: true, text: "WIPE SAYS NOTHING WITHOUT THE WORD - /journal wipe yes EMPTIES IT." };
      var r = await file(rest);
      return { ok: r.ok, said: true };
    }
    function describe() {
      return "THE JOURNAL :: A PRIVATE LOG - RAW LINES, TAGS, AND MINUTES ON A BEAT."
        + "\n<anything, #tags ride inside> FILES THE LINE"
        + "\nshow [N] READS THE LAST N :: tag <TAG> [N] READS ONE TAG :: tags COUNTS THEM"
        + "\nminutes [now | last | N] FILES BY HAND, OR READS THE BACK ISSUES :: status :: export TAKES IT AS A FILE"
        + "\nbrief [N] READS THE AGENT'S HANDOFF - the last lines plus the last minutes, cut to fit"
        + "\nTHE BEAT FILES MINUTES BY ITSELF - COUNTS, TAGS, AND LINES QUOTED VERBATIM, LIKE MEETING MINUTES. NOTHING IS JUDGED, RATED OR CONCLUDED.";
    }
    return { load: load, file: file, show: show, tag: tag, tags: tags,
      fileMinutes: fileMinutes, tick: tick, force: force, status: status,
      last: last, list: list, briefing: briefing, exportLog: exportLog, importLog: importLog,
      clear: clear, words: words, describe: describe,
      slot: function () { return SLOT; }, gap: function () { return GAP; },
      ready: function () { return ready; } };
  }
  return { client: client, tagsOf: tagsOf, tagCounts: tagCounts, composeMinutes: composeMinutes };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosJournal;
