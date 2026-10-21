var MythosChatlog = (function () {
  "use strict";
  var STM_N = 10;
  var LTM_TURNS = 40;
  var LTM_CHARS = 3500;
  var TURN_TEXT = 220;
  var ATT_CAP = 8;
  var HOLD_CAP = 500;
  var HELP = "CHATLOG :: status | tail [N] | export :: LAST 10 SHORT-TERM, OLDER LONG-TERM WITH FILE PROVENANCE.";
  var LTM_HEAD = "<CHATLOG-LTM (older turns beyond the last 10 in short-term — long-term recall with file provenance; filenames/refs are where the work lives)>";
  var STM_HEAD = "<MESSAGES-STM (last 10 turns — short-term; CHATLOG-LTM above is older long-term with file provenance)>";
  function str(s) { return String(s == null ? "" : s); }
  function num(n, d) { var v = Number(n); return isNaN(v) ? d : v; }
  function single(s) { return str(s).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, ""); }
  function normRole(r) {
    var v = single(r).toLowerCase();
    if (v === "user" || v === "human") return "user";
    if (v === "assistant" || v === "agent" || v === "sia" || v === "model") return "assistant";
    return "";
  }
  function normAtt(a, fallback) {
    if (!a || typeof a !== "object") return null;
    var me = { name: single(a.name || a.key || a.gal || a.clip || fallback || "file").slice(0, 120) || "file", kind: single(a.kind || "text").slice(0, 32) || "text" };
    if (a.bytes != null) me.bytes = Math.max(0, num(a.bytes, 0));
    if (a.chars != null) me.chars = Math.max(0, num(a.chars, 0));
    if (a.capped) me.capped = true;
    if (a.key) me.key = str(a.key).slice(0, 120);
    if (a.gal) me.gal = str(a.gal).slice(0, 64);
    if (a.clip) me.clip = str(a.clip).slice(0, 64);
    if (a.gid) me.gid = str(a.gid).slice(0, 64);
    if (a.backend) me.backend = str(a.backend).slice(0, 32);
    if (a.seed != null) me.seed = str(a.seed).slice(0, 64);
    if (a.parts != null) me.parts = num(a.parts, a.parts);
    return me;
  }
  function normalizeAttachments(list, fallbackName) {
    var src = Array.isArray(list) ? list : [];
    var out = [], i;
    for (i = 0; i < src.length && i < ATT_CAP; i++) {
      var me = normAtt(src[i], fallbackName);
      if (me) out.push(me);
    }
    return out;
  }
  function formatAttachment(a) {
    a = a || {};
    var bits = [a.name || "file"];
    if (a.kind) bits.push(a.kind);
    if (a.backend) bits.push(a.backend);
    if (a.seed) bits.push("seed " + a.seed);
    if (a.gal) bits.push("gal:" + a.gal);
    if (a.clip) bits.push("clip:" + a.clip);
    if (a.gid) bits.push("gid:" + a.gid);
    if (a.key) bits.push("key:" + str(a.key).slice(-6));
    return bits.join(" ");
  }
  function formatTurn(o) {
    o = o || {};
    var t = single(o.t);
    if (t.length > TURN_TEXT) t = t.slice(0, TURN_TEXT) + "…";
    var line = str(o.h || "?") + ": " + t;
    var aa = (o.d && o.d.attachments) || [];
    if (aa.length) line = line + " [files: " + aa.map(formatAttachment).join("; ") + "]";
    return line;
  }
  function ltmBlock(turns, o) {
    o = o || {};
    var all = Array.isArray(turns) ? turns : [];
    if (all.length <= STM_N) return "";
    var older = all.slice(0, -STM_N).slice(-Math.max(1, Math.min(200, num(o.maxTurns, LTM_TURNS) || LTM_TURNS)));
    if (!older.length) return "";
    var cap = Math.max(500, Math.min(20000, num(o.maxChars, LTM_CHARS) || LTM_CHARS));
    var out = [], chars = 0, i;
    for (i = 0; i < older.length; i++) {
      var line = formatTurn(older[i]);
      if (chars + line.length > cap) break;
      out.push(line);
      chars = chars + line.length + 1;
    }
    if (!out.length) return "";
    return LTM_HEAD + "\n" + out.join("\n") + "\n</CHATLOG-LTM>";
  }
  function framePrompt(sysText, stmLines, ltmText) {
    var s = str(sysText);
    var b = str(ltmText);
    var stm = Array.isArray(stmLines) ? stmLines.join("\n") : str(stmLines);
    return s + (b ? "\n\n" + b : "") + "\n\n" + STM_HEAD + "\n" + stm + "\n</MESSAGES-STM>";
  }
  function stamp() {
    var d = new Date();
    function p(n) { n = String(n); return n.length < 2 ? "0" + n : n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var agent = single(opts.agent || "SIA").toUpperCase().slice(0, 24) || "SIA";
    var slot = single(opts.slot || "chatlog").slice(0, 64) || "chatlog";
    var session = single(opts.session || "sess").slice(0, 64) || "sess";
    var turns = [];
    var seq = 0;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function backend() {
      var s = opts.store || null;
      if (s && typeof s.load === "function" && typeof s.save === "function") return s;
      var f = opts.kvFolder || null;
      if (f && typeof f.get === "function" && typeof f.set === "function") return { load: function () { return f.get(slot); }, save: function (v) { return f.set(slot, v); } };
      return null;
    }
    function mirrorKey() { return "chatlog:" + agent + ":" + slot; }
    function mirrorSave() {
      try {
        if (typeof localStorage === "undefined") return false;
        localStorage.setItem(mirrorKey(), JSON.stringify({ turns: turns.slice(-HOLD_CAP), seq: seq, ts: Date.now() }));
        return true;
      } catch (e) { return false; }
    }
    function mirrorLoad() {
      try {
        if (typeof localStorage === "undefined") return null;
        var raw = localStorage.getItem(mirrorKey());
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    }
    function adopt(s) {
      if (!s || !Array.isArray(s.turns)) return { ok: false, error: "CHATLOG HAS NO TURNS TO ADOPT." };
      turns = s.turns.filter(function (o) { return o && o.type === "turn" && o.t; }).slice(-HOLD_CAP);
      seq = num(s.seq, turns.length);
      return { ok: true, turns: turns.length };
    }
    function persist() {
      var rec = { turns: turns.slice(-HOLD_CAP), seq: seq, ts: Date.now() };
      var b = backend();
      if (b) {
        try {
          var r = b.save(rec);
          if (r && typeof r.then === "function") r.catch(function () { mirrorSave(); });
        } catch (e) { mirrorSave(); }
        return;
      }
      if (!mirrorSave()) say("CHATLOG: NO STORE AND NO LOCAL MIRROR :: TURNS LIVE UNTIL RELOAD AND NOTHING ELSE WAS TOUCHED.");
    }
    function load() {
      var b = backend();
      if (b) {
        return b.load().then(function (s) {
          if (s) { var a = adopt(s); if (a.ok) return a; }
          var m = mirrorLoad();
          if (m) return adopt(m);
          return { ok: true, turns: 0, note: "NO STORE - STARTING EMPTY." };
        }).catch(function (e) {
          var m = mirrorLoad();
          if (m) return adopt(m);
          return { ok: false, error: "CHATLOG UNREADABLE :: " + str((e && e.message) || e) };
        });
      }
      var m = mirrorLoad();
      if (m) return Promise.resolve(adopt(m));
      return Promise.resolve({ ok: true, turns: 0, note: "NO STORE - STARTING EMPTY." });
    }
    function record(o) {
      o = o || {};
      var role = normRole(o.role);
      if (!role) return { ok: false, error: "CHATLOG REFUSES :: role IS user OR assistant AND NOTHING ELSE WAS FILED." };
      var text = single(o.text);
      if (!text) return { ok: false, error: "CHATLOG REFUSES :: EMPTY TEXT FILES NOTHING AND NOTHING ELSE WAS TOUCHED." };
      seq = seq + 1;
      var id = agent + ":" + session + ":t" + seq;
      var aa = normalizeAttachments(o.attachments, text.slice(0, 80));
      var who = single(o.handle || (role === "assistant" ? agent : "user")).slice(0, 48) || (role === "assistant" ? agent : "user");
      var turn = { v: 2, type: "turn", id: id, a: agent, h: who, t: text, ts: num(o.ts, Date.now()), src: "chatlog :: " + session + " :: t" + seq, d: { role: role, seq: seq }, vec: null };
      if (aa.length) turn.d.attachments = aa;
      turns.push(turn);
      if (turns.length > HOLD_CAP) turns = turns.slice(-HOLD_CAP);
      persist();
      return { ok: true, id: id, seq: seq };
    }
    function tail(n) {
      var k = Math.max(1, Math.min(100, num(n, STM_N) || STM_N));
      return turns.slice(-k).map(function (o) { return str(o.h) + ": " + single(o.t); });
    }
    function ltm(o) {
      return ltmBlock(turns, o);
    }
    function frame(sys, o) {
      return framePrompt(sys, tail(STM_N), ltm(o));
    }
    function status() {
      var chars = 0, i;
      for (i = 0; i < turns.length; i++) chars = chars + str(turns[i].t).length;
      return { ok: true, turns: turns.length, chars: chars, text: "CHATLOG :: " + turns.length + " turn(s), " + chars + " chars, STM " + Math.min(turns.length, STM_N) + "/10 :: " + (turns.length > STM_N ? "LTM ARMED." : "LTM QUIET UNTIL TURN 11.") };
    }
    function exportLog() {
      var lines = turns.map(function (o) { return JSON.stringify(o); });
      return { ok: true, jsonl: lines.join("\n") + (lines.length ? "\n" : ""), filename: agent + "-chatlog-" + stamp() };
    }
    function importLog(text) {
      if (typeof text !== "string" || !single(text)) return { ok: false, error: "CHATLOG REFUSES :: IMPORT IS JSONL TEXT AND NOTHING ELSE WAS FILED." };
      var have = {}, i;
      for (i = 0; i < turns.length; i++) have[turns[i].id] = 1;
      var added = 0, skipped = 0;
      var parts = text.split("\n");
      for (i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        var o = null;
        try { o = JSON.parse(parts[i]); } catch (e) { return { ok: false, error: "CHATLOG REFUSES :: BAD LINE " + (i + 1) + " AND NOTHING WAS FILED." }; }
        if (!o || o.type !== "turn" || !o.id || !o.t) { skipped = skipped + 1; continue; }
        if (have[o.id]) { skipped = skipped + 1; continue; }
        have[o.id] = 1;
        turns.push(o);
        added = added + 1;
      }
      if (turns.length > HOLD_CAP) turns = turns.slice(-HOLD_CAP);
      var top = 0;
      for (i = 0; i < turns.length; i++) { var q = num(str(turns[i].id).split(":t").pop(), 0); if (q > top) top = q; }
      if (top > seq) seq = top;
      if (added) persist();
      return { ok: true, added: added, skipped: skipped };
    }
    function words(s) {
      var v = single(s);
      var bits = v.split(" ");
      var head = (bits[0] || "").toLowerCase();
      if (!head || head === "status") return status();
      if (head === "tail") {
        var n = num(bits[1], STM_N) || STM_N;
        var lines = tail(n);
        return { ok: true, text: lines.length ? lines.join("\n") : "CHATLOG EMPTY." };
      }
      if (head === "export") { var e = exportLog(); return { ok: true, text: "CHATLOG EXPORT :: " + e.filename + " (" + turns.length + " turns)." }; }
      if (head === "help") return { ok: true, text: HELP };
      return { ok: false, error: "CHATLOG REFUSES :: NO VERB CALLED " + (head || "?").toUpperCase() + " :: status | tail [N] | export." };
    }
    return { record: record, tail: tail, ltm: ltm, block: ltm, frame: frame, status: status, export: exportLog, import: importLog, words: words, load: load, help: HELP };
  }
  return { client: client, normalizeAttachments: normalizeAttachments, formatAttachment: formatAttachment, formatTurn: formatTurn, ltmBlock: ltmBlock, framePrompt: framePrompt, STM_N: STM_N, LTM_TURNS: LTM_TURNS, LTM_CHARS: LTM_CHARS };
})();
if (typeof window !== "undefined" && window) window.MythosChatlog = MythosChatlog;
if (typeof module !== "undefined" && module.exports) module.exports = MythosChatlog;
