var MythosDms = (function () {
  "use strict";
  var MEM_KEY = "mythos_dms_staged";
  var OK_EXT = /\.txt$/i;
  var OK_EXT2 = /\.md$/i;

  function extOk(name) {
    var n = String(name || "");
    return OK_EXT.test(n) || OK_EXT2.test(n);
  }

  function makeStore(kvFolder, slot) {
    slot = slot || "dms_docs";
    if (!kvFolder) {
      return {
        load: function () {
          try { return Promise.resolve(JSON.parse(localStorage.getItem(MEM_KEY) || "[]")); }
          catch (e) { return Promise.resolve([]); }
        },
        save: function (docs) {
          try { localStorage.setItem(MEM_KEY, JSON.stringify(docs)); } catch (e) {}
          return Promise.resolve(true);
        }
      };
    }
    return {
      load: function () { return kvFolder.get(slot).catch(function () { return []; }); },
      save: function (docs) { return kvFolder.set(slot, docs).catch(function () {}); }
    };
  }

  function client(opts) {
    opts = opts || {};
    var store = makeStore(opts.kvFolder || null, opts.slot);
    var maxDocs = opts.maxDocs || 20;
    var maxChars = opts.maxChars || 200000;

    function stage(name, text) {
      var n = String(name || "").trim();
      if (!n) return Promise.reject(new Error("DMS REFUSED :: name the document."));
      if (!extOk(n)) return Promise.reject(new Error("DMS REFUSED :: raw .txt / .md only - no other kind is staged."));
      var t = String(text == null ? "" : text);
      if (!t.trim()) return Promise.reject(new Error("DMS REFUSED :: the document is empty."));
      if (t.length > maxChars) return Promise.reject(new Error("DMS REFUSED :: " + n + " is " + t.length + " chars, over the " + maxChars + " cap - split it first."));
      return store.load().then(function (docs) {
        docs = Array.isArray(docs) ? docs : [];
        var at = Date.now();
        var found = false;
        docs = docs.map(function (d) {
          if (d && d.name === n) { found = true; return { name: n, text: t, at: at }; }
          return d;
        });
        if (!found) docs.push({ name: n, text: t, at: at });
        while (docs.length > maxDocs) docs.shift();
        return store.save(docs).then(function () { return { name: n, chars: t.length, restaged: found }; });
      });
    }

    function unstage(name) {
      var n = String(name || "").trim();
      return store.load().then(function (docs) {
        docs = Array.isArray(docs) ? docs : [];
        var kept = docs.filter(function (d) { return !(d && d.name === n); });
        if (kept.length === docs.length) throw new Error("DMS EMPTY :: no staged document called " + n + ".");
        return store.save(kept).then(function () { return { name: n }; });
      });
    }

    function clear() {
      return store.save([]).then(function () { return { cleared: true }; });
    }

    function list() {
      return store.load().then(function (docs) {
        docs = Array.isArray(docs) ? docs : [];
        return docs.map(function (d) { return { name: d.name, chars: String(d.text || "").length, at: d.at || 0 }; });
      });
    }

    function read(name) {
      var n = String(name || "").trim();
      return store.load().then(function (docs) {
        docs = Array.isArray(docs) ? docs : [];
        var d = null;
        for (var i = 0; i < docs.length; i++) { if (docs[i] && docs[i].name === n) { d = docs[i]; break; } }
        if (!d) throw new Error("DMS EMPTY :: no staged document called " + n + ".");
        return { name: d.name, text: d.text || "" };
      });
    }

    function context(budget) {
      var cap = budget || maxChars;
      return store.load().then(function (docs) {
        docs = Array.isArray(docs) ? docs : [];
        var parts = [], used = 0, names = [], trimmed = [];
        for (var i = 0; i < docs.length; i++) {
          var d = docs[i];
          if (!d || !d.text) continue;
          var room = cap - used;
          if (room <= 0) { trimmed.push(d.name); continue; }
          var t = d.text;
          if (t.length > room) { t = t.slice(0, room); trimmed.push(d.name + " (cut)"); }
          parts.push("<doc name=\"" + String(d.name).replace(/"/g, "") + "\">\n" + t + "\n</doc>");
          used += t.length;
          names.push(d.name);
        }
        var head = "<staged-docs count=\"" + names.length + "\" chars=\"" + used + "\">\n";
        var tail = "\n</staged-docs>";
        return { text: parts.length ? head + parts.join("\n") + tail : "", names: names, chars: used, trimmed: trimmed };
      });
    }

    function status() {
      return list().then(function (l) {
        if (!l.length) return "DMS :: STAGE EMPTY - stage .txt / .md and talk about them. LORE, NOT LOREPACK: staged words ride the turn, never the index.";
        var chars = l.reduce(function (s, d) { return s + d.chars; }, 0);
        return "DMS :: " + l.length + " STAGED (" + chars + " CHARS): " + l.map(function (d) { return d.name; }).join(", ");
      });
    }

    return { stage: stage, unstage: unstage, clear: clear, list: list, read: read, context: context, status: status };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosDms;
