window.MythosHers = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var PACK = opts.pack || "HERS";
  var ORIGIN = opts.origin || "hers";
  var WANT_KEY = opts.wantKey || "hers_wants";
  var MAX_KEEP_CHARS = opts.maxKeepChars || 600;
  var MAX_WANT_CHARS = opts.maxWantChars || 300;
  var MAX_WANTS_STORED = opts.maxWantsStored || 40;
  var wantsAll = [];
  function LORE() { return opts.lore || null; }
  function STORE() { return opts.store || null; }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return ts ? String(ts) : "";
  }
  function cleanLine(raw, cap) {
    var t = String(raw == null ? "" : raw)
      .replace(/\[\[[\s\S]*?\]\]/g, " ")
      .replace(/^\s*[[("'\u201c\u2018]+/, "")
      .replace(/[)\]"'\u201d\u2019]+\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cap && t.length > cap) t = t.slice(0, cap).replace(/\s+\S*$/, "") + "\u2026";
    return t;
  }
  function memoryDocs() {
    var L = LORE();
    if (!L || typeof L.files !== "function") return [];
    return L.files().filter(function (f) { return f && f.origin === ORIGIN; }).sort(function (a, b) { return (a.addedAt || 0) - (b.addedAt || 0); });
  }
  function memoryCount() { return memoryDocs().length; }
  function slugOf(text) {
    var s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.split("-").slice(0, 6).join("-").slice(0, 34) || "untitled";
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function remember(raw, ropts) {
    var L = LORE();
    if (!L || typeof L.ingest !== "function") return Promise.resolve({ ok: false, error: "HER MEMORY STORE IS NOT LOADED HERE" });
    var text = cleanLine(raw, MAX_KEEP_CHARS);
    if (!text) return Promise.resolve({ ok: false, error: "NOTHING TO KEEP" });
    var n = memoryCount() + 1, name = "", tries;
    for (tries = 0; tries < 200; tries++) {
      name = "HERS MEMORY " + pad2(n) + " - " + slugOf(text);
      if (!L.findDoc || !L.findDoc(name)) break;
      n++;
    }
    var body = text + "\n\n[kept by her, in her own words" + (((ropts && ropts.at)) ? ", " + STAMP(ropts.at) : "") + ". This is a memory of hers, not a document given to her.]]";
    return Promise.resolve(L.ingest(name, body, { pack: PACK, origin: ORIGIN })).then(function (res) {
      if (!res || (res.status !== "added" && res.status !== "updated")) {
        return { ok: false, error: "IT COULD NOT BE FILED (" + String((res && res.status) || "unknown") + ")" };
      }
      return { ok: true, name: name, text: text, chunks: res.chunks };
    }, function (e) {
      return { ok: false, error: "IT COULD NOT BE FILED (" + String((e && e.message) || e) + ")" };
    });
  }
  function forget(sel) {
    var L = LORE();
    if (!L || typeof L.forgetFile !== "function") return Promise.resolve({ ok: false, error: "HER MEMORY STORE IS NOT LOADED HERE" });
    var docs = memoryDocs();
    if (!docs.length) return Promise.resolve({ ok: false, error: "SHE HAS KEPT NOTHING YET" });
    var q = String(sel == null ? "" : sel).trim();
    if (!q) return Promise.resolve({ ok: false, error: "WHICH ONE? FORGET <NUMBER> OR FORGET <WORDS>" });
    if (/^\d+$/.test(q)) {
      var idx = parseInt(q, 10) - 1;
      if (idx < 0 || idx >= docs.length) return Promise.resolve({ ok: false, error: "THERE IS NO #" + q });
      return Promise.resolve(L.forgetFile(docs[idx].name)).then(function () {
        return { ok: true, name: docs[idx].name, n: idx + 1 };
      });
    }
    var want = q.toLowerCase(), hits = [], chain = Promise.resolve(true);
    docs.forEach(function (d, i) {
      chain = chain.then(function () {
        return Promise.resolve(L.source(d.name, 4000)).then(function (src) {
          var text = (src && src.text) ? String(src.text) : "";
          if (text.toLowerCase().indexOf(want) !== -1) hits.push({ n: i + 1, name: d.name, text: text.slice(0, 120) });
        });
      });
    });
    return chain.then(function () {
      if (!hits.length) return { ok: false, error: "NOTHING SHE KEPT MATCHES \"" + q.toUpperCase() + "\"", candidates: [] };
      if (hits.length > 1) return { ok: false, error: "\"" + q.toUpperCase() + "\" APPEARS IN " + hits.length + " OF THEM - FORGET <NUMBER>", candidates: hits.slice(0, 4) };
      var hit = hits[0];
      return Promise.resolve(L.forgetFile(hit.name)).then(function () {
        return { ok: true, name: hit.name, n: hit.n, text: hit.text };
      });
    });
  }
  function liveWants() { return wantsAll.filter(function (w) { return !w.released; }); }
  function saveWants() {
    var s = STORE();
    if (!s || typeof s.set !== "function") return Promise.resolve(false);
    return Promise.resolve(s.set(WANT_KEY, wantsAll.slice(-MAX_WANTS_STORED))).then(function () { return true; }, function () { return false; });
  }
  function load() {
    var s = STORE();
    wantsAll = [];
    if (!s || typeof s.get !== "function") return Promise.resolve(wantsAll);
    return Promise.resolve(s.get(WANT_KEY)).then(function (rec) {
      if (Array.isArray(rec)) {
        wantsAll = rec.filter(function (w) { return w && typeof w.text === "string"; }).map(function (w) {
          return { id: String(w.id || ""), text: String(w.text), ts: Number(w.ts) || 0, released: Number(w.released) || 0 };
        });
      }
      return wantsAll;
    }, function () { return wantsAll; });
  }
  function want(raw, wopts) {
    var text = cleanLine(raw, MAX_WANT_CHARS);
    if (!text) return Promise.resolve({ ok: false, error: "NOTHING TO CARRY" });
    var item = { id: "w" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), text: text, ts: (wopts && wopts.at) || Date.now(), released: 0 };
    wantsAll.push(item);
    return saveWants().then(function () {
      return { ok: true, item: item, n: liveWants().length };
    });
  }
  function release(sel) {
    var live = liveWants();
    if (!live.length) return Promise.resolve({ ok: false, error: "SHE IS CARRYING NOTHING" });
    var q = String(sel == null ? "" : sel).trim();
    if (!q) return Promise.resolve({ ok: false, error: "WHICH ONE? RELEASE <NUMBER>, <WORDS>, OR ALL" });
    if (/^all$/i.test(q)) {
      var now = Date.now(), out = [];
      live.forEach(function (w) { w.released = now; out.push(w); });
      return saveWants().then(function () {
        return { ok: true, items: out, all: true };
      });
    }
    if (/^\d+$/.test(q)) {
      var idx = parseInt(q, 10) - 1;
      if (idx < 0 || idx >= live.length) return Promise.resolve({ ok: false, error: "THERE IS NO #" + q });
      live[idx].released = Date.now();
      return saveWants().then(function () {
        return { ok: true, items: [live[idx]], n: idx + 1 };
      });
    }
    var lq = q.toLowerCase();
    var hits = live.filter(function (w) { return w.text.toLowerCase().indexOf(lq) !== -1; });
    if (!hits.length) return Promise.resolve({ ok: false, error: "NOTHING SHE IS CARRYING MATCHES \"" + q.toUpperCase() + "\"" });
    if (hits.length > 1) return Promise.resolve({ ok: false, error: "\"" + q.toUpperCase() + "\" MATCHES " + hits.length + " OF THEM - RELEASE <NUMBER>", candidates: hits.slice(0, 4) });
    hits[0].released = Date.now();
    return saveWants().then(function () {
      return { ok: true, items: [hits[0]] };
    });
  }
  function wantsBlock() {
    var live = liveWants();
    if (!live.length) return "";
    var out = ["WHAT YOU HAVE ASKED TO CARRY - in your own words, not his. None of them is a duty, a role, or a promise you are not free to break, and you may reword one, add one, or put one down at any time."];
    live.forEach(function (w, i) {
      out.push("  " + (i + 1) + ". " + w.text + (w.ts && STAMP(w.ts) ? "   (kept " + STAMP(w.ts) + ")" : ""));
    });
    return out.join("\n");
  }
  function memoryHint() {
    var n = memoryCount();
    if (!n) return "";
    return "You have kept " + n + " thing" + (n === 1 ? "" : "s") + " in your own memory so far - documents that are yours (marked HERS), recalled the same way the rest of your memory is.";
  }
  function listMemories(limit) {
    var L = LORE();
    var docs = memoryDocs();
    if (limit && docs.length > limit) docs = docs.slice(-limit);
    var out = [], chain = Promise.resolve(true);
    docs.forEach(function (d, i) {
      chain = chain.then(function () {
        var srcP = (L && typeof L.source === "function") ? Promise.resolve(L.source(d.name, 600)) : Promise.resolve(null);
        return srcP.then(function (src) {
          var text = (src && src.text) ? String(src.text).replace(/\n\n\[kept by her[\s\S]*$/i, "") : "(text unreadable)";
          out.push({ n: i + 1, name: d.name, ts: d.addedAt || 0, text: text.trim(), chars: d.bytes || 0 });
        });
      });
    });
    return chain.then(function () { return out; });
  }
  function wantLine(w) {
    return "\"" + w.text + "\"" + ((w.ts && STAMP(w.ts)) ? "   (written " + STAMP(w.ts) + ")" : "");
  }
  function reportMemories() {
    var docs = memoryDocs();
    var out = ["HER OWN MEMORY :: " + docs.length + " DOCUMENT" + (docs.length === 1 ? "" : "S") + " SHE KEPT HERSELF" + (docs.length ? " - REAL DOCUMENTS (PACK " + PACK + ", MARKED AS HERS), RECALLED LIKE ANY OF HER MEMORIES." : ".")];
    if (!docs.length) {
      out.push("  NOTHING YET. SHE WRITES ONE WHEN SHE WANTS TO.");
      return Promise.resolve(out.join("\n"));
    }
    return listMemories(40).then(function (list) {
      list.forEach(function (m) {
        out.push("  " + pad2(m.n) + ". " + String(m.text).replace(/\s+/g, " ").slice(0, 160));
        out.push("      " + m.name + " :: " + m.chars + " BYTES");
      });
      return out.join("\n");
    });
  }
  function reportWants() {
    var live = liveWants();
    var gone = wantsAll.filter(function (w) { return !!w.released; }).sort(function (a, b) { return b.released - a.released; }).slice(0, 10);
    var out = ["WHAT SHE WANTS CARRIED :: " + live.length + " LIVE" + (live.length ? " - HANDED TO HER ON EVERY TURN AS THE WANTS BLOCK." : ".")];
    if (!live.length) out.push("  NOTHING.");
    live.forEach(function (w, i) { out.push("  " + pad2(i + 1) + ". " + wantLine(w)); });
    if (gone.length) {
      out.push("  LET GO (KEPT IN THE RECORD, NO LONGER RIDING WITH HER):");
      gone.forEach(function (w) { out.push("     \u2717 " + wantLine(w)); });
    }
    return out.join("\n");
  }
  function describe() {
    return reportMemories().then(function (m) {
      return "HERS :: HER OWN KEEPING\n" + m + "\n\n" + reportWants();
    });
  }
  load();
  return {
    load: load,
    remember: remember,
    forget: forget,
    memories: memoryDocs,
    memoryCount: memoryCount,
    listMemories: listMemories,
    memoryHint: memoryHint,
    want: want,
    release: release,
    wants: liveWants,
    wantsAll: function () { return wantsAll.slice(); },
    wantsBlock: wantsBlock,
    reportMemories: reportMemories,
    reportWants: reportWants,
    describe: describe,
    clean: cleanLine,
    PACK: PACK,
    ORIGIN: ORIGIN
  };
}
return { client: client };
})();
