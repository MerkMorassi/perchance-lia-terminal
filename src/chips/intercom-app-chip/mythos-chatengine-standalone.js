window.MythosChatengine = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function memBackend() {
    var d = null;
    return {
      read: function () { return d ? JSON.parse(JSON.stringify(d)) : null; },
      write: function (o) { d = JSON.parse(JSON.stringify(o)); }
    };
  }
  function lsBackend(slot) {
    return {
      read: function () {
        try {
          var o = JSON.parse(localStorage.getItem(slot) || "null");
          if (o && typeof o === "object" && Array.isArray(o.turns)) return o;
        } catch (e) {}
        return null;
      },
      write: function (o) {
        try { localStorage.setItem(slot, JSON.stringify(o)); } catch (e) {}
      }
    };
  }
  function normRole(r) {
    var s = str(r).toLowerCase();
    if (s === "user" || s === "human") return "user";
    if (s === "assistant" || s === "agent" || s === "sia" || s === "model") return "assistant";
    if (s === "system" || s === "tool") return s;
    return "";
  }
  function normalizeAttachments(list, fallback) {
    var att = [];
    var src = Array.isArray(list) ? list : [];
    for (var i = 0; i < src.length && i < 8; i++) {
      var a = src[i] || {};
      var me = { name: str(a.name || a.key || a.gal || a.clip || fallback || "file"), kind: str(a.kind || "text") };
      if (a.bytes != null) me.bytes = Math.max(0, num(a.bytes, 0));
      if (a.chars != null) me.chars = Math.max(0, num(a.chars, 0));
      if (a.capped) me.capped = true;
      if (a.key) me.key = str(a.key);
      if (a.gal) me.gal = str(a.gal);
      if (a.clip) me.clip = str(a.clip);
      if (a.gid) me.gid = str(a.gid);
      if (a.backend) me.backend = str(a.backend);
      if (a.seed != null) me.seed = str(a.seed);
      if (a.parts != null) me.parts = num(a.parts, a.parts);
      att.push(me);
    }
    return att;
  }
  function stamp() {
    var d = new Date();
    function p(n) { n = String(n); while (n.length < 2) n = "0" + n; return n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var slot = str(opts.slot || "chatengine") || "chatengine";
    var agent = str(opts.agentID || "AGENT-001").toUpperCase() || "AGENT-001";
    var agentName = str(opts.agentName || agent);
    var cap = Math.min(10000, Math.max(10, num(opts.cap, 4000) || 4000));
    var store = null;
    try {
      if (typeof localStorage !== "undefined" && localStorage) store = lsBackend(slot);
    } catch (e) { store = null; }
    if (!store) store = memBackend();
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function load() {
      var o = null;
      try { o = store.read(); } catch (e) { o = null; }
      if (!o || typeof o !== "object") o = { v: 1, seq: 0, session: "", turns: [] };
      if (!Array.isArray(o.turns)) o.turns = [];
      if (!o.session) o.session = str(opts.session || ("sess-" + Date.now().toString(36)));
      if (!num(o.seq, 0)) o.seq = 0;
      return o;
    }
    function save(o) {
      try {
        o.turns = o.turns.slice(-cap);
        store.write(o);
      } catch (e) {}
    }
    function cleanText(role, text) {
      var t = str(text == null ? "" : text);
      if (!t.trim()) return { ok: false, why: "NOTHING TO KEEP - AN EMPTY TURN LEAVES NO LOG." };
      if (t.indexOf("thinking…") !== -1) return { ok: false, why: "NOTHING TO KEEP - A THINKING LINE IS NOT A TURN." };
      if (role === "system" || role === "tool") return { ok: true, t: t.slice(0, 4000) };
      return { ok: true, t: t.replace(/\s+/g, " ").trim().slice(0, 2000) };
    }
    function remember(role, handle, text, extra) {
      try {
        var r = normRole(role);
        if (!r) return { ok: false, why: "NO SUCH LANE - ROLE MUST BE USER, ASSISTANT, SYSTEM OR TOOL." };
        var c = cleanText(r, text);
        if (!c.ok) return c;
        if (!c.t) return { ok: false, why: "NOTHING TO KEEP - AN EMPTY TURN LEAVES NO LOG." };
        var ex = extra || {};
        var o = load();
        var seq = num(o.seq, 0) + 1;
        var id = agent + ":" + o.session + ":t" + seq;
        var turn = {
          v: 2, type: "turn", id: id, a: agent,
          h: str(handle || (r === "assistant" ? agentName : "user")).slice(0, 40),
          t: c.t, ts: num(ex.ts, Date.now()) || Date.now(),
          src: "chatengine :: " + o.session + " :: t" + seq,
          d: { role: r, seq: seq }, vec: null
        };
        var att = normalizeAttachments(ex.attachments, c.t.slice(0, 80));
        if (att.length) turn.d.attachments = att;
        o.seq = seq;
        o.turns.push(turn);
        save(o);
        return { ok: true, id: id, seq: seq };
      } catch (e) {
        return { ok: false, why: "THE ENGINE WOULD NOT HOLD IT - " + str((e && e.message) || e).slice(0, 120).toUpperCase() + "." };
      }
    }
    function ordered() {
      var o = load();
      return o.turns.slice().sort(function (a, b) { return (a.ts - b.ts) || (a.d.seq - b.d.seq); });
    }
    function tail(n) {
      var arr = ordered();
      var k = Math.min(arr.length, Math.max(1, num(n, arr.length) || arr.length));
      return arr.slice(-k);
    }
    function stm(n) {
      var arr = tail(n == null ? 10 : n);
      var out = [];
      for (var i = 0; i < arr.length; i++) out.push(arr[i].h + ": " + arr[i].t);
      return out;
    }
    function ltmBlock(o) {
      var arr = ordered();
      if (arr.length <= 10) return "";
      var maxTurns = (o && o.maxTurns) || 40;
      var maxChars = (o && o.maxChars) || 3500;
      var older = arr.slice(0, -10).slice(-maxTurns);
      if (!older.length) return "";
      var out = [];
      var chars = 0;
      for (var i = 0; i < older.length; i++) {
        var t = older[i];
        var tx = str(t.t).replace(/\s+/g, " ").trim();
        if (tx.length > 220) tx = tx.slice(0, 220) + "…";
        var prov = "";
        try {
          var aa = (t.d && t.d.attachments) || [];
          if (aa.length) prov = " [files: " + aa.map(function (a) {
            var bits = [a.name || "file", a.kind || ""];
            if (a.backend) bits.push(a.backend);
            if (a.seed) bits.push("seed " + a.seed);
            if (a.gal) bits.push("gal:" + a.gal);
            if (a.clip) bits.push("clip:" + a.clip);
            if (a.gid) bits.push("gid:" + a.gid);
            if (a.key) bits.push("key:" + str(a.key).slice(-6));
            return bits.filter(Boolean).join(" ");
          }).join("; ") + "]";
        } catch (e) {}
        var line = t.h + ": " + tx + prov;
        if (chars + line.length > maxChars) break;
        out.push(line);
        chars += line.length;
      }
      if (!out.length) return "";
      return "<CHATLOG-LTM (older long-term — newest " + out.length + " of " + older.length + ", STM below is the last 10)>\n" + out.join("\n") + "\n</CHATLOG-LTM>";
    }
    function framePrompt(head, stmLines, ltm) {
      var lines = Array.isArray(stmLines) ? stmLines : [];
      var ltmS = str(ltm || "");
      return str(head || "") + "\n\n" + (ltmS ? ltmS + "\n\n" : "") + "<MESSAGES-STM (last " + lines.length + " turns — short-term; CHATLOG-LTM above is older long-term with file provenance)>\n" + lines.join("\n") + "\n</MESSAGES-STM>";
    }
    function missing(shown) {
      var have = {}, pre = {};
      try {
        var list = Array.isArray(shown) ? shown : [];
        for (var i = 0; i < list.length; i++) {
          var s = str(list[i]).trim().slice(0, 2000);
          if (!s) continue;
          have[s] = true;
          pre[s.slice(0, 512)] = true;
        }
      } catch (e) {}
      var out = [];
      var arr = ordered();
      for (var j = 0; j < arr.length; j++) {
        var t = str(arr[j].t);
        var full = str(arr[j].h) + ": " + t;
        if (!have[t] && !have[full] && !pre[t.slice(0, 512)] && !pre[full.slice(0, 512)]) { out.push(arr[j]); have[t] = true; have[full] = true; }
      }
      return out;
    }
    function header() {
      var o = load();
      return { v: 1, type: "chatengine-header", format: "chatengine/1", agentID: agent, agentName: agentName, created: Date.now(), session: o.session, seq: o.seq };
    }
    function exportLog() {
      var o = load();
      var lines = [JSON.stringify(header())];
      var arr = ordered();
      for (var i = 0; i < arr.length; i++) lines.push(JSON.stringify(arr[i]));
      return { jsonl: lines.join("\n") + "\n", filename: agent + "-" + agentName.replace(/[^A-Za-z0-9]+/g, "-") + "-" + stamp(), turns: arr.length };
    }
    function importLog(text) {
      if (typeof text !== "string" || !text) throw new Error("CHATENGINE :: IMPORT REFUSED - THE FILE IS EMPTY.");
      var hasNL = text.charAt(text.length - 1) === "\n";
      var parts = text.split("\n");
      var body = hasNL ? parts.slice(0, -1) : parts;
      var objs = [];
      for (var i = 0; i < body.length; i++) {
        if (!body[i]) continue;
        try { objs.push(JSON.parse(body[i])); }
        catch (e) {
          if (i === body.length - 1 && !hasNL) throw new Error("CHATENGINE :: IMPORT REFUSED - THE TAIL IS TRUNCATED.");
          throw new Error("CHATENGINE :: IMPORT REFUSED - LINE " + (i + 1) + " IS NOT JSON.");
        }
      }
      if (!objs.length || objs[0].type !== "chatengine-header") throw new Error("CHATENGINE :: IMPORT REFUSED - NO ENGINE HEADER ON LINE ONE.");
      if (str(objs[0].agentID).toUpperCase() !== agent) throw new Error("CHATENGINE :: IMPORT REFUSED - THIS PACK BELONGS TO " + str(objs[0].agentID).toUpperCase() + ".");
      var o = load();
      var have = {};
      for (var k = 0; k < o.turns.length; k++) have[o.turns[k].id] = true;
      var added = 0, skipped = 0;
      for (var j = 1; j < objs.length; j++) {
        var t = objs[j];
        if (!t || t.type !== "turn" || !t.id || typeof t.ts !== "number" || !t.t) { skipped++; continue; }
        var r = normRole(t.d && t.d.role);
        if (!r) { skipped++; continue; }
        t.d.role = r;
        if (have[t.id]) { skipped++; continue; }
        o.turns.push(t);
        if (num(t.d.seq, 0) > num(o.seq, 0)) o.seq = num(t.d.seq, 0);
        have[t.id] = true;
        added++;
      }
      save(o);
      return { added: added, skipped: skipped };
    }
    function status() {
      var o = load();
      var chars = 0;
      for (var i = 0; i < o.turns.length; i++) chars += str(o.turns[i].t).length;
      return { agentID: agent, agentName: agentName, session: o.session, turns: o.turns.length, chars: chars, seq: o.seq, slot: slot };
    }
    function count() { return load().turns.length; }
    function clear() {
      try { store.write({ v: 1, seq: 0, session: load().session, turns: [] }); } catch (e) {}
      say("CHATENGINE :: LOG STRUCK - THE SCREEN IS THE ONLY COPY NOW.");
      return { ok: true };
    }
    return { remember: remember, tail: tail, stm: stm, ltmBlock: ltmBlock, framePrompt: framePrompt, missing: missing, export: exportLog, import: importLog, ordered: ordered, status: status, count: count, clear: clear, slot: function () { return slot; } };
  }
  return { client: client, normalizeAttachments: normalizeAttachments };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosChatengine;
