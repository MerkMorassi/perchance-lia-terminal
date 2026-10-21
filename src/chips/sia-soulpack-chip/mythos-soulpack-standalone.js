var MythosSoulpack = (function () {
  "use strict";

  function str(s) { return String(s == null ? "" : s); }

  function fnv(s) {
    var h = 0x811c9dc5;
    s = str(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function normList(m) {
    var docs = (m && (m.documents || m.docs || m.files)) || [];
    return docs.map(function (d) {
      if (typeof d === "string") return { file: d };
      return { file: d.file || d.name || "unnamed" };
    });
  }

  function fuse(scrolls) {
    var parts = ["SOULPACK - READ WHOLE, IN ORDER. WHAT FOLLOWS IS STANDING INSTRUCTION, NOT REFERENCE."];
    for (var k = 0; k < scrolls.length; k++) {
      parts.push("=== SCROLL " + (k + 1) + "/" + scrolls.length + ": " + scrolls[k].file + " ===\n" + scrolls[k].text);
    }
    return parts.join("\n\n");
  }

  function client(opts) {
    opts = opts || {};
    var base = str(opts.soulBase || "").replace(/\/?$/, "/");
    var manifestUrl = str(opts.soulUrl || (base + "soul.json"));
    if (!opts.soulBase && manifestUrl.indexOf("/") > -1) base = manifestUrl.replace(/[^/]*$/, "");
    var grab = (typeof opts.doFetch === "function") ? opts.doFetch : (typeof fetch === "function" ? fetch : null);
    var cache = {};
    var order = [];
    var baselined = false;

    function readUrl(url) {
      if (!grab) return Promise.resolve("");
      try {
        return grab(url).then(function (r) {
          if (!r || !r.ok) return "";
          return r.text();
        }).catch(function () { return ""; });
      } catch (e) { return Promise.resolve(""); }
    }

    function manifest() {
      if (opts.scrolls) return Promise.resolve(normList({ documents: opts.scrolls }));
      return readUrl(manifestUrl).then(function (t) {
        if (!t) return null;
        try { return normList(JSON.parse(t)); }
        catch (e) { return null; }
      });
    }

    function loadOne(file) {
      if (opts.scrolls) {
        for (var i = 0; i < opts.scrolls.length; i++) {
          var s = opts.scrolls[i];
          var f = (typeof s === "string") ? s : (s.file || s.name);
          if (f === file) return Promise.resolve(str(typeof s === "string" ? "" : (s.text || "")));
        }
        return Promise.resolve("");
      }
      return readUrl(base + file);
    }

    async function sequence() {
      try {
        var list = await manifest();
        if (!list || !list.length) return { ok: false, why: "NO SOULPACK - NOTHING TO BECOME.", text: "", scrolls: [] };
        var out = [];
        for (var i = 0; i < list.length; i++) {
          var t = await loadOne(list[i].file);
          out.push({ file: list[i].file, chars: t.length, text: t });
          cache[list[i].file] = { text: t, hash: fnv(t) };
        }
        order = out.map(function (s) { return s.file; });
        baselined = true;
        return {
          ok: true,
          text: fuse(out),
          scrolls: out.map(function (s) { return { file: s.file, chars: s.chars }; })
        };
      } catch (e) {
        return { ok: false, why: "SOULPACK REFUSED :: " + str((e && e.message) || e) + " :: NOTHING WAS CACHED.", text: "", scrolls: [] };
      }
    }

    async function changed() {
      try {
        if (!baselined) return { ok: false, why: "NO BASELINE - RUN sequence() FIRST.", changed: [], count: 0, text: "" };
        var list = await manifest();
        if (!list) return { ok: false, why: "SOULPACK UNREACHABLE - BASELINE HELD.", changed: [], count: 0, text: "" };
        var fresh = [];
        for (var i = 0; i < list.length; i++) {
          var t = await loadOne(list[i].file);
          var h = fnv(t);
          if (!cache[list[i].file] || cache[list[i].file].hash !== h) {
            fresh.push({ file: list[i].file, chars: t.length, text: t });
          }
          cache[list[i].file] = { text: t, hash: h };
        }
        order = list.map(function (d) { return d.file; });
        return {
          ok: true,
          changed: fresh.map(function (s) { return { file: s.file, chars: s.chars }; }),
          count: fresh.length,
          text: fresh.length ? fuse(fresh) : ""
        };
      } catch (e) {
        return { ok: false, why: "RECHECK REFUSED :: " + str((e && e.message) || e) + " :: BASELINE HELD.", changed: [], count: 0, text: "" };
      }
    }

    function get(file) {
      var c = cache[str(file)];
      if (!c) return { ok: false, why: "NO SUCH SCROLL :: " + str(file) + " :: RUN sequence() FIRST." };
      return { ok: true, file: str(file), text: c.text, chars: c.text.length };
    }

    function count() { return order.length; }

    return { sequence: sequence, changed: changed, get: get, count: count };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosSoulpack;
