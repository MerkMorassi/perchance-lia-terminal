window.MythosChattail = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function memBackend() {
    var d = [];
    return {
      read: function () { return d.slice(); },
      write: function (arr) { d = arr.slice(); }
    };
  }
  function lsBackend(slot) {
    return {
      read: function () {
        try {
          var o = JSON.parse(localStorage.getItem(slot) || "null");
          if (o && Array.isArray(o.turns)) return o.turns;
        } catch (e) {}
        return [];
      },
      write: function (arr) {
        try { localStorage.setItem(slot, JSON.stringify({ v: 1, turns: arr })); } catch (e) {}
      }
    };
  }
  function cleanTurn(t) {
    if (!t || typeof t !== "object") return null;
    var text = str(t.t).slice(0, 2000);
    if (!text.trim()) return null;
    if (text.indexOf("thinking…") !== -1) return null;
    return { ts: num(t.ts, Date.now()), sq: num(t.sq, 0), r: str(t.r || "sys").slice(0, 8), h: str(t.h || "").slice(0, 40), t: text };
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var slot = str(opts.slot || "chattail") || "chattail";
    var cap = Math.min(200, Math.max(10, num(opts.cap, 60) || 60));
    var store = null;
    try {
      if (typeof localStorage !== "undefined" && localStorage) store = lsBackend(slot);
    } catch (e) { store = null; }
    if (!store) store = memBackend();
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function all() {
      var out = [];
      try {
        var raw = store.read();
        for (var i = 0; i < raw.length; i++) {
          var c = cleanTurn(raw[i]);
          if (c) out.push(c);
        }
      } catch (e) {}
      out.sort(function (a, b) { return (a.ts - b.ts) || (a.sq - b.sq); });
      return out.slice(-cap);
    }
    function remember(role, handle, text, ts) {
      try {
        var t = str(text == null ? "" : text).slice(0, 2000);
        if (!t.trim()) return { ok: false, why: "NOTHING TO KEEP - AN EMPTY TURN LEAVES NO TAIL." };
        if (t.indexOf("thinking…") !== -1) return { ok: false, why: "NOTHING TO KEEP - A THINKING LINE IS NOT A TURN." };
        var arr = all();
        var sq = 0;
        for (var i = 0; i < arr.length; i++) if (arr[i].sq >= sq) sq = arr[i].sq + 1;
        arr.push({ ts: num(ts, Date.now()) || Date.now(), sq: sq, r: str(role || "sys").slice(0, 8), h: str(handle || "").slice(0, 40), t: t });
        arr.sort(function (a, b) { return (a.ts - b.ts) || (a.sq - b.sq); });
        store.write(arr.slice(-cap));
        return { ok: true, count: Math.min(arr.length, cap) };
      } catch (e) {
        return { ok: false, why: "THE TAIL WOULD NOT HOLD - " + str((e && e.message) || e).slice(0, 120).toUpperCase() + "." };
      }
    }
    function tail(n) {
      var arr = all();
      var k = Math.min(arr.length, Math.max(1, num(n, arr.length) || arr.length));
      return arr.slice(-k);
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
      var arr = all();
      for (var j = 0; j < arr.length; j++) {
        var t = str(arr[j].t);
        if (!have[t] && !pre[t.slice(0, 512)]) { out.push(arr[j]); have[t] = true; }
      }
      return out;
    }
    function clear() {
      try { store.write([]); } catch (e) {}
      say("CHATTAIL :: TAIL STRUCK - THE SCREEN IS THE ONLY COPY NOW.");
      return { ok: true };
    }
    function count() { return all().length; }
    return { remember: remember, tail: tail, missing: missing, clear: clear, count: count, slot: function () { return slot; } };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosChattail;
