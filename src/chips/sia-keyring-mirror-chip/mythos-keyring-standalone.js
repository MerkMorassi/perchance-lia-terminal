window.MythosKeyring = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function trim(s) { return str(s).trim(); }
  function parse(raw) {
    try {
      var o = typeof raw === "string" ? JSON.parse(raw) : raw;
      return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function cleanObj(o) {
    var out = {};
    if (!o || typeof o !== "object") return out;
    for (var k of Object.keys(o)) {
      if (o[k] === undefined || o[k] === null) continue;
      var v = str(o[k]);
      if (!v) continue;
      out[String(k)] = v;
    }
    return out;
  }
  function memStore() {
    var d = null;
    return {
      name: "memory",
      load: function () { return Promise.resolve(d); },
      save: function (v) { d = cleanObj(typeof v === "string" ? parse(v) : v); return Promise.resolve(); }
    };
  }
  function mask(v) {
    var t = str(v || "");
    if (!t) return "";
    if (t.length <= 11) return "SET:" + t.length;
    return t.slice(0, 7) + "..." + t.slice(-4);
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var slot = trim(opts.slot) || "keyring";
    var list = (opts.stores && opts.stores.length) ? opts.stores.slice() : [memStore()];
    var fast = (typeof opts.fast === "function") ? opts.fast : null;
    var bypassed = (typeof opts.isBypassed === "function") ? opts.isBypassed : null;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    var cache = cleanObj(parse(opts.seed));
    function isOff(name) {
      try { return !!(bypassed && bypassed(name)); } catch (e) { return false; }
    }
    function names() { return Object.keys(cache); }
    function count() { return names().length; }
    function get(name) {
      var n = trim(name);
      if (!n || isOff(n)) return "";
      try {
        if (fast) {
          var f = str(fast(n));
          if (f) return f;
        }
      } catch (e) {}
      var v = cache[n];
      return v == null ? "" : str(v);
    }
    function has(name) { return !!get(name); }
    function persist() {
      var snap = cleanObj(cache);
      for (var i = 0; i < list.length; i++) {
        try { Promise.resolve(list[i].save(snap)).catch(function () {}); } catch (e) {}
      }
    }
    function set(name, value) {
      var n = trim(name);
      if (!n) return { ok: false, error: "NO NAME - A KEY NEEDS A PROVIDER NAME." };
      var v = (value === undefined || value === null) ? "" : str(value);
      if (v) cache[n] = v; else delete cache[n];
      persist();
      return { ok: true, name: n, kept: !!cache[n] };
    }
    function clear(name) { return set(name, ""); }
    function merge(objs) {
      var seen = {};
      for (var i = 0; i < objs.length; i++) {
        var o = parse(objs[i]);
        for (var k of Object.keys(o)) {
          var v = str(o[k]);
          if (!v) continue;
          if (!seen[k] || v.length > seen[k].length) seen[k] = v;
        }
      }
      return seen;
    }
    async function restore(src) {
      var reads = [];
      var okReads = 0;
      for (var i = 0; i < list.length; i++) {
        var st = list[i];
        try {
          if (src && src[st.name] !== undefined) { reads.push(src[st.name]); okReads++; continue; }
          reads.push(await st.load());
          okReads++;
        } catch (e) { reads.push(null); }
      }
      if (!okReads) return { ok: false, error: "NO STORE ANSWERED - NOTHING WAS READ AND NOTHING WAS WRITTEN." };
      var seen = merge(reads);
      var found = Object.keys(seen);
      if (found.length) {
        cache = cleanObj(seen);
        persist();
        say("KEYRING :: " + found.length + " KEYS HELD ACROSS " + list.length + " STORES.");
      }
      return { ok: true, keys: found, count: found.length };
    }
    async function mirrors() {
      var out = {};
      for (var i = 0; i < list.length; i++) {
        try { out[list[i].name] = cleanObj(parse(await list[i].load())); }
        catch (e) { out[list[i].name] = null; }
      }
      return out;
    }
    function shapes() {
      var out = {};
      for (var k of names()) out[k] = "len=" + str(cache[k]).length;
      return out;
    }
    function words(s) {
      var a = trim(s).toLowerCase();
      if (a === "status") return { ok: true, text: "KEYRING :: " + count() + " KEYS ON " + list.length + " STORES." };
      if (a === "list") {
        var n = names();
        return { ok: true, text: n.length ? "KEYRING :: " + n.join(", ") : "KEYRING :: EMPTY - NO KEYS HELD." };
      }
      return { ok: false, error: "KEYRING :: status | list - VALUES NEVER RIDE CHAT." };
    }
    return {
      slot: function () { return slot; },
      get: get, set: set, has: has, clear: clear,
      restore: restore, mirrors: mirrors,
      names: names, count: count, mask: mask, shapes: shapes, words: words
    };
  }
  return { client: client, mask: mask };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosKeyring;
