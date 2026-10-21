var MythosManual = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  function normId(id) {
    return str(id).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function cleanDoc(d) {
    if (!d || typeof d !== "object") return null;
    var id = normId(d.id);
    var text = str(d.text);
    if (!id || !text.trim()) return null;
    return { id: id, title: str(d.title || id).slice(0, 80), text: text.slice(0, 60000),
      tags: Array.isArray(d.tags) ? d.tags.map(function (t) { return str(t).slice(0, 24); }).slice(0, 8) : [],
      updated: num(d.updated, 0) || 0 };
  }
  function stampLine() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var docs = [];
    var ready = false;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function byId(id) {
      var want = normId(id);
      for (var i = 0; i < docs.length; i++) if (docs[i].id === want) return docs[i];
      return null;
    }
    async function persist() {
      try { await store.save({ v: 1, docs: docs }); } catch (e) {}
    }
    async function load() {
      var snap = null;
      try { snap = await store.load(); } catch (e) { snap = null; }
      docs = [];
      if (snap && Object.prototype.toString.call(snap.docs || snap) === "[object Array]") {
        var raw = snap.docs || snap;
        for (var i = 0; i < raw.length; i++) {
          var c = cleanDoc(raw[i]);
          if (c && !byId(c.id)) docs.push(c);
        }
      } else if (Array.isArray(opts.docs)) {
        for (var j = 0; j < opts.docs.length; j++) {
          var c2 = cleanDoc(opts.docs[j]);
          if (c2 && !byId(c2.id)) docs.push(c2);
        }
      }
      ready = true;
      return { ok: true, count: docs.length };
    }
    function list() {
      return docs.map(function (d) {
        return { id: d.id, title: d.title, tags: d.tags.slice(),
          desc: d.text.split("\n").filter(function (l) { return l.trim(); })[1] || "" };
      });
    }
    function read(id) {
      var d = byId(id) || null;
      if (!d) {
        var e = "NO SUCH PAGE - THE MANUAL HOLDS " + docs.length + " PAGES, NONE NAMED " + normId(id).toUpperCase() + ".";
        say(e);
        return { ok: false, error: e };
      }
      return { ok: true, doc: { id: d.id, title: d.title, text: d.text, tags: d.tags.slice(), updated: d.updated } };
    }
    async function amend(id, heading, text) {
      var d = byId(id);
      if (!d) {
        var e = "NOTHING AMENDED - NO PAGE NAMED " + normId(id).toUpperCase() + ".";
        say(e);
        return { ok: false, error: e };
      }
      var body = str(text).trim();
      if (!body) {
        var e2 = "NOTHING AMENDED - AN AMENDMENT WITH NO WORDS IS NOT AN AMENDMENT.";
        say(e2);
        return { ok: false, error: e2 };
      }
      var h = str(heading).trim().slice(0, 80) || "AMENDMENT";
      d.text = (d.text.replace(/\s+$/g, "") + "\n\n## " + h.toUpperCase() + " (" + stampLine() + ")\n\n" + body).slice(0, 60000);
      d.updated = Date.now();
      await persist();
      say("AMENDED :: " + d.id.toUpperCase() + " :: " + h.toUpperCase() + ".");
      return { ok: true, id: d.id };
    }
    async function add(page) {
      var c = cleanDoc(page);
      if (!c) {
        var e = "NOTHING ADDED - A PAGE NEEDS AN ID AND WORDS.";
        say(e);
        return { ok: false, error: e };
      }
      if (byId(c.id)) {
        var e2 = "NOTHING ADDED - " + c.id.toUpperCase() + " IS ALREADY A PAGE; AMEND IT INSTEAD.";
        say(e2);
        return { ok: false, error: e2 };
      }
      c.updated = Date.now();
      docs.push(c);
      await persist();
      say("ADDED :: " + c.id.toUpperCase() + " :: " + c.title.toUpperCase() + ".");
      return { ok: true, id: c.id };
    }
    function share() {
      return JSON.stringify({ manual: str(opts.name || "manual"), exported: Date.now(), docs: docs });
    }
    async function receive(bundle) {
      var got = null;
      try { got = typeof bundle === "string" ? JSON.parse(bundle) : bundle; }
      catch (e) { got = null; }
      var incoming = (got && Array.isArray(got.docs)) ? got.docs : (Array.isArray(got) ? got : null);
      if (!incoming) {
        var e = "NOTHING SHELVED - THE BUNDLE HOLDS NO PAGES.";
        say(e);
        return { ok: false, error: e };
      }
      var added = 0, skipped = 0;
      for (var i = 0; i < incoming.length; i++) {
        var c = cleanDoc(incoming[i]);
        if (!c || byId(c.id)) { skipped++; continue; }
        docs.push(c);
        added++;
      }
      await persist();
      say("SHELVED :: " + added + " PAGE" + (added === 1 ? "" : "S") + " FROM " + str((got && got.manual) || "ANOTHER SHELF").toUpperCase()
        + (skipped ? " :: " + skipped + " SKIPPED (ALREADY HELD)." : "."));
      return { ok: true, added: added, skipped: skipped };
    }
    function clear() {
      docs = [];
      try { persist(); } catch (e) {}
      say("MANUAL STRUCK - EVERY AGENT KEEPS THEIR OWN COPY; NOTHING ELSE WAS TOUCHED.");
      return { ok: true };
    }
    return { load: load, list: list, read: read, amend: amend, add: add,
      share: share, receive: receive, clear: clear,
      count: function () { return docs.length; }, ready: function () { return ready; },
      name: function () { return str(opts.name || "manual"); } };
  }
  return { client: client };
})();
if (typeof window !== "undefined") window.MythosManual = MythosManual;
if (typeof module !== "undefined" && module.exports) module.exports = MythosManual;
