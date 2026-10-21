window.MythosChipshelf = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  var CAP = 60000;
  function shortName(url) {
    var b = str(url).split("/").pop() || str(url);
    return b.replace(/\.js$/, "");
  }
  function esc(t) {
    return str(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var list = [];
    try {
      if (typeof opts.list === "function") list = opts.list() || [];
      else if (Array.isArray(opts.chips)) list = opts.chips;
    } catch (e) { list = []; }
    var fetchFn = opts.fetchFn || ((typeof fetch !== "undefined") ? fetch : null);
    function urls() {
      var out = [], i;
      for (i = 0; i < list.length; i++) {
        var u = typeof list[i] === "string" ? list[i] : (list[i] && list[i].url);
        if (u) out.push(str(u));
      }
      return out;
    }
    function names() {
      var us = urls(), out = [], i;
      for (i = 0; i < us.length; i++) out.push(shortName(us[i]));
      return out;
    }
    function count() { return urls().length; }
    function known(url) { return urls().indexOf(str(url)) !== -1; }
    function doc(text) {
      return "<pre style='color:#e6edf3;font:12px/1.5 monospace;white-space:pre;overflow:auto;margin:8px'>" + esc(str(text)).slice(0, CAP) + "</pre>";
    }
    function errDoc(why) {
      return "<pre style='color:#f59e0b;font:12px monospace;margin:8px'>unreadable: " + esc(str(why).slice(0, 200)) + "</pre>";
    }
    async function source(url) {
      var u = str(url);
      if (!u || !known(u)) return { ok: false, error: "NOT ON THE SHELF - ONLY VENDORED STANDALONES READ HERE." };
      if (!fetchFn) return { ok: false, error: "NO FETCH ON THIS HOST - THE SHELF NEEDS A READER." };
      try {
        var r = await fetchFn(u);
        if (!r || !r.ok) throw new Error("HTTP " + ((r && r.status) || "?"));
        var t = await r.text();
        return { ok: true, url: u, text: str(t).slice(0, CAP) };
      } catch (e) {
        return { ok: false, error: "UNREADABLE - " + str((e && e.message) || e).slice(0, 120).toUpperCase() + "." };
      }
    }
    return { count: count, names: names, urls: urls, known: known, source: source, doc: doc, errDoc: errDoc };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosChipshelf;
