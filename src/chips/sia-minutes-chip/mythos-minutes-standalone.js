window.MythosMinutes = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function pad(n) { n = num(n, 0); return (n < 10 ? "0" : "") + n; }
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
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  var TAGMAP = [
    ["BACKUP", "#backup"], ["BRIDGE", "#bridge"], ["LORE", "#lore"], ["MOOD", "#mood"],
    ["WISH", "#wish"], ["PETITION", "#wish"], ["VISION", "#image"], ["PICTURE", "#image"],
    ["IMAGE", "#image"], ["AUDIO", "#audio"], ["BITE", "#audio"], ["SAY", "#audio"],
    ["GATE", "#gate"], ["MINUTES", "#minutes"], ["UPDATE", "#update"], ["AUDIT", "#audit"]
  ];
  function tagsFor(events, facts) {
    var tags = [], seen = {};
    function add(t) { if (!seen[t]) { seen[t] = true; tags.push(t); } }
    var evs = Array.isArray(events) ? events : [];
    for (var i = 0; i < evs.length; i++) {
      var hay = (str(evs[i] && evs[i].name) + " " + str(evs[i] && evs[i].note)).toUpperCase();
      for (var k = 0; k < TAGMAP.length; k++) {
        if (hay.indexOf(TAGMAP[k][0]) !== -1) add(TAGMAP[k][1]);
      }
    }
    if (num(facts && facts.turns, 0) > 0) add("#chat");
    if (num(facts && facts.images, 0) > 0) add("#image");
    if (num(facts && facts.audio, 0) > 0) add("#audio");
    return tags.slice(0, 8);
  }
  function evLine(e) {
    var t = fmtT(e && e.ts);
    var nm = str(e && e.name).toUpperCase().slice(0, 40) || "NOTE";
    var note = str(e && e.note).replace(/\s+/g, " ").trim().slice(0, 140);
    return t + " " + nm + (note ? " :: " + note : "");
  }
  function render(f, meta) {
    var m = meta || {};
    var evs = Array.isArray(f.events) ? f.events.slice(-12) : [];
    var tags = tagsFor(evs, f);
    var L = [];
    L.push("ARCHIVAX MINUTES :: " + fmtT(f.ts) + " :: SESSION " + str(m.session || "?").slice(0, 40)
      + " :: HITL " + str(m.hitl || "?").slice(0, 40) + " :: AGENT " + str(m.agent || "?").slice(0, 40));
    L.push("WINDOW :: SINCE " + fmtT(f.windowSince) + " (" + fmtDur(num(f.ts, 0) - num(f.windowSince, 0)) + ")");
    L.push("TURNS :: " + num(f.turns, 0) + " (" + num(f.users, 0) + " USER / " + num(f.assistants, 0)
      + " SIA / " + num(f.sys, 0) + " SYSTEM) :: MEDIA " + num(f.images, 0) + " IMAGE " + num(f.audio, 0)
      + " AUDIO :: GALLERY " + num(f.gallery, 0) + " :: STAGE " + num(f.stage, 0));
    L.push("WISHES :: " + num(f.wishesPending, 0) + " WAITING / " + num(f.wishesTotal, 0) + " FILED");
    if (evs.length) {
      L.push("EVENTS ::");
      for (var i = 0; i < evs.length; i++) L.push(evLine(evs[i]));
    } else {
      L.push("EVENTS :: NONE FILED THIS WINDOW.");
    }
    L.push("TAGS :: " + (tags.length ? tags.join(" ") : "#quiet"));
    return { text: L.join("\n"), tags: tags };
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var kv = opts.kvFolder || null;
    var SLOT = str(opts.slot || "minutes_log") || "minutes_log";
    var CAP = Math.min(200, Math.max(10, num(opts.cap, 60) || 60));
    var GAP = Math.max(60000, num(opts.intervalMs, 4 * 3600 * 1000) || 4 * 3600 * 1000);
    var meta = { hitl: str(opts.hitl || "PATRIKIOS"), agent: str(opts.agent || "SIA-002"), session: (typeof opts.session === "function" ? "" : str(opts.session || "")) };
    function sessionId() {
      try { if (typeof opts.session === "function") return str(opts.session()); } catch (e) {}
      return meta.session;
    }
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    var minutes = [];
    var ready = false;
    function validSnap(s) { return !!(s && typeof s === "object" && Array.isArray(s.minutes)); }
    async function persist() {
      var snap = { v: 1, minutes: minutes.slice(-CAP) };
      try { if (kv) await kv.set(SLOT, snap); else await store.save(snap); } catch (e) {}
    }
    async function load() {
      var snap = null;
      try { snap = kv ? await kv.get(SLOT) : await store.load(); } catch (e) { snap = null; }
      if (validSnap(snap)) minutes = snap.minutes.filter(function (m) { return m && num(m.ts, 0) > 0 && str(m.text); });
      ready = true;
      return { ok: true, count: minutes.length };
    }
    function last() { return minutes.length ? minutes[minutes.length - 1] : null; }
    function list(n) { return minutes.slice(-Math.max(1, num(n, minutes.length) || minutes.length)); }
    function due(nowMs) {
      var now = num(nowMs, Date.now()) || Date.now();
      var l = last();
      if (!l) return { due: true, nextIn: 0 };
      var left = (num(l.ts, 0) + GAP) - now;
      return { due: left <= 0, nextIn: Math.max(0, left) };
    }
    function status(nowMs) {
      var d = due(nowMs);
      var l = last();
      return { ok: true, count: minutes.length, due: d.due,
        text: "MINUTES :: " + minutes.length + " FILED" + (l ? " :: LAST " + fmtT(l.ts) : " :: NONE YET")
          + (d.due ? " :: DUE NOW." : " :: NEXT IN " + fmtDur(d.nextIn) + ".") };
    }
    function validFacts(f) {
      if (!f || typeof f !== "object") return "MINUTES REFUSED - FACTS ARE NOT AN OBJECT, NOTHING WAS FILED.";
      if (!(num(f.ts, 0) > 0)) return "MINUTES REFUSED - FACTS CARRY NO STAMP, NOTHING WAS FILED.";
      if (!(num(f.windowSince, -1) >= 0)) return "MINUTES REFUSED - FACTS NAME NO WINDOW, NOTHING WAS FILED.";
      return "";
    }
    async function file(facts) {
      var bad = validFacts(facts);
      if (bad) { say(bad); return { ok: false, error: bad }; }
      var l = last();
      if (l && num(l.windowSince, -2) === num(facts.windowSince, -1)) {
        var e = "MINUTES ALREADY FILED FOR THIS WINDOW - NOTHING WAS FILED TWICE.";
        say(e);
        return { ok: false, error: e };
      }
      var r = render(facts, { hitl: meta.hitl, agent: meta.agent, session: sessionId() });
      var rec = { ts: num(facts.ts, 0), windowSince: num(facts.windowSince, 0), text: r.text, tags: r.tags };
      minutes.push(rec);
      minutes = minutes.slice(-CAP);
      await persist();
      say("MINUTES FILED :: " + fmtT(rec.ts) + " :: " + num(facts.turns, 0) + " TURNS :: " + (r.tags.join(" ") || "#quiet"));
      return { ok: true, minutes: rec };
    }
    async function tick(collect) {
      if (typeof collect !== "function") {
        var e = "MINUTES REFUSED - NO COLLECTOR WAS GIVEN, NOTHING WAS READ.";
        say(e);
        return { ok: false, error: e };
      }
      var now = Date.now();
      var d = due(now);
      if (!d.due) return { ok: false, error: "NOT DUE - NEXT IN " + fmtDur(d.nextIn) + "." };
      var l = last();
      var since = l ? num(l.ts, 0) : now - GAP;
      if (!l) since = since - (since % 60000);
      var facts = null;
      try { facts = await collect({ since: since, now: now }); } catch (err) {
        var w = "MINUTES WITHHELD - THE ROOM WOULD NOT BE READ (" + str((err && err.message) || err).slice(0, 120).toUpperCase() + ").";
        say(w);
        return { ok: false, error: w };
      }
      if (!facts || typeof facts !== "object") facts = {};
      facts.ts = now;
      facts.windowSince = since;
      return file(facts);
    }
    async function force(collect) {
      if (typeof collect !== "function") return { ok: false, error: "MINUTES REFUSED - NO COLLECTOR WAS GIVEN, NOTHING WAS READ." };
      var now = Date.now();
      var l = last();
      var since = l ? num(l.ts, 0) : now - GAP;
      if (!l) since = since - (since % 60000);
      var facts = await collect({ since: since, now: now });
      if (!facts || typeof facts !== "object") facts = {};
      facts.ts = now;
      facts.windowSince = since;
      return file(facts);
    }
    function clear() {
      minutes = [];
      try { persist(); } catch (e) {}
      say("MINUTES :: RECORD STRUCK - THE JOURNAL KEEPS ITS OWN COPIES.");
      return { ok: true };
    }
    return { load: load, due: due, status: status, file: file, tick: tick, force: force,
      last: last, list: list, clear: clear, slot: function () { return SLOT; },
      gap: function () { return GAP; }, ready: function () { return ready; } };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosMinutes;
