window.MythosReader = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var PENDING_MAX = opts.pendingMax || 4;
  var SNIPPET = opts.snippet || 200;
  var TURN_FULL = opts.turnFull || 900;
  var pending = [];
  var loaded = false;
  function VAULT() { return opts.vault || null; }
  function LORE() { return opts.lore || null; }
  function BOOK() { return opts.renderBook || null; }
  function QSTORE() { return opts.queueStore || null; }
  function clip(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? (t.slice(0, n) + "\u2026") : t;
  }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return ts ? String(ts) : "";
  }
  function lim(her) {
    return her
      ? { turns: 4, turnChars: 200, renders: 5, vault: 8, memory: 3, snippets: 3 }
      : { turns: 8, turnChars: 420, renders: 24, vault: 30, memory: 8, snippets: 8 };
  }
  function normQuery(raw) {
    return String(raw == null ? "" : raw).replace(/\[\[|\]\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  }
  function readLog() {
    if (typeof opts.readLog === "function") {
      try { return Promise.resolve(opts.readLog()).then(function (v) { return v || []; }, function () { return []; }); }
      catch (e) { return Promise.resolve([]); }
    }
    var a = opts.archive;
    return Promise.resolve(Array.isArray(a) ? a : []);
  }
  function isCreation(e) { return !!(e && (e.silent || e.kind === "create")); }
  function side(e, which) {
    if (isCreation(e)) return which === "h" ? (e.h || "[an image was made]") : "[a thing made, not a turn]";
    return String((which === "h" ? e.h : e.s) == null ? "" : (which === "h" ? e.h : e.s));
  }
  function turnHits(logs, words, take) {
    var terms = String(words || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var out = [];
    logs.forEach(function (e, i) {
      var hay = (side(e, "h") + " " + side(e, "s")).toLowerCase();
      var score = 0;
      terms.forEach(function (t) { if (hay.indexOf(t) !== -1) score++; });
      if (!score) return;
      out.push({ n: i + 1, e: e, score: score });
    });
    out.sort(function (a, b) { return (b.score - a.score) || (b.n - a.n); });
    return out.slice(0, take);
  }
  function turnLines(hit, chars) {
    var e = hit.e;
    var out = "  #" + hit.n + (STAMP(e.ts) ? "  " + STAMP(e.ts) : "") + (e.role ? "  (" + String(e.role).toUpperCase() + ")" : "  (OFF STAGE)");
    out += "\n      Patrikios: " + clip(side(e, "h"), chars);
    out += "\n      LIA: " + clip(side(e, "s"), chars);
    return out;
  }
  function archiveReport(q, L) {
    return readLog().then(function (logs) {
      var words = String(q || "").trim();
      if (!words) {
        return {
          ok: true, title: "THE ARCHIVE",
          text: logs.length
            ? logs.length + " TURN" + (logs.length === 1 ? "" : "S") + " KEPT.\n  Newest:\n" + logs.slice(-4).map(function (e, i, a) { return turnLines({ n: logs.length - (a.length - i), e: e }, L.turnChars); }).join("\n") + "\n  Read one with turn <NUMBER>, or search them with archive <WORDS>."
            : "THE ARCHIVE IS EMPTY - nothing has been said here yet."
        };
      }
      var one = words.match(/^(?:turn|#)\s*#?(\d{1,5})$/i);
      if (one) {
        var n = parseInt(one[1], 10);
        if (!logs[n - 1]) return { ok: false, error: "THERE IS NO TURN #" + n + " - THE RECORD HOLDS " + logs.length + "." };
        return { ok: true, title: "TURN #" + n, text: turnLines({ n: n, e: logs[n - 1] }, TURN_FULL) };
      }
      var hits = turnHits(logs, words, L.turns);
      if (!hits.length) return { ok: false, error: "NOTHING IN THE ARCHIVE SAYS THAT. IT HOLDS " + logs.length + " TURNS." };
      return { ok: true, title: "THE ARCHIVE :: \"" + words.toUpperCase() + "\" :: " + hits.length + " TURN" + (hits.length === 1 ? "" : "S"), text: hits.map(function (h) { return turnLines(h, L.turnChars); }).join("\n") };
    });
  }
  function kindWord(rec) {
    if (!rec) return "item";
    if (rec.kind === "video") return "clip";
    if (rec.kind === "upscale") return "upscaled picture";
    if (rec.kind === "gen") return "picture she made";
    if (/^audio\//.test(String(rec.mime || ""))) return "music";
    return "picture";
  }
  function vaultLine(id, rec) {
    var V = VAULT();
    var name = rec.prompt ? clip(rec.prompt, SNIPPET) : String(rec.name || "image");
    return "  [" + STAMP(rec.ts) + "] " + (V ? V.folderOf(rec) : "") + "  \u00b7  " + kindWord(rec) + "  \u00b7  " + name + (rec.tags && rec.tags.length ? "  \u00b7  " + rec.tags.map(function (t) { return "#" + t; }).join(" ") : "");
  }
  function foldersReport(L) {
    var V = VAULT();
    if (!V) return Promise.resolve({ ok: false, error: "THE VAULT IS OFFLINE." });
    return Promise.resolve(V.ensure ? V.ensure() : true).then(function () {
      var list = V.allFolders();
      var st = V.stats();
      var out = "THE FOLDERS OF THE VAULT :: " + list.length + " FOLDER" + (list.length === 1 ? "" : "S") + " HOLDING " + st.count + " ITEM" + (st.count === 1 ? "" : "S") + ".";
      list.forEach(function (f) {
        out += "\n  " + f.path + "  (" + f.count + (f.count === 1 ? " item" : " items") + ")" + (f.made ? "" : "  - a default");
      });
      out += "\n  Read one with folder /music.";
      return { ok: true, title: "THE FOLDERS", text: out };
    });
  }
  function folderReport(path, L) {
    var V = VAULT();
    if (!V) return Promise.resolve({ ok: false, error: "THE VAULT IS OFFLINE." });
    var p = V.normFolder(path);
    if (!p) return Promise.resolve({ ok: false, error: "WHICH FOLDER? NAME A PATH, LIKE /music." });
    return Promise.resolve(V.ensure ? V.ensure() : true).then(function () {
      var ids = V.list().filter(function (id) {
        var f = V.folderOf(V.get(id));
        return f === p || f.indexOf(p + "/") === 0;
      });
      var out = "FOLDER " + p + " :: " + ids.length + " ITEM" + (ids.length === 1 ? "" : "S") + ".";
      if (!ids.length) {
        out += "\n  Nothing is filed here yet. " + (V.folderExists(p) ? "The folder itself exists." : "The folder does not exist.");
        return { ok: true, title: "FOLDER " + p, text: out };
      }
      ids.slice(-L.vault).reverse().forEach(function (id) { out += "\n" + vaultLine(id, V.get(id)); });
      if (ids.length > L.vault) out += "\n  \u2026 and " + (ids.length - L.vault) + " more.";
      return { ok: true, title: "FOLDER " + p + " :: " + ids.length, text: out };
    });
  }
  function vaultReport(q, L) {
    var V = VAULT();
    if (!V) return Promise.resolve({ ok: false, error: "THE VAULT IS OFFLINE." });
    return Promise.resolve(V.ensure ? V.ensure() : true).then(function () {
      var ids = V.list();
      var words = String(q || "").trim().toLowerCase();
      if (words) {
        var terms = words.split(/\s+/).filter(Boolean);
        ids = ids.filter(function (id) {
          var r = V.get(id);
          var hay = [r.prompt, r.sent, r.name, r.note, r.sight, V.folderOf(r), (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
          return terms.every(function (t) { return hay.indexOf(t) !== -1; });
        });
      }
      var out = "THE VAULT :: " + ids.length + " ITEM" + (ids.length === 1 ? "" : "S") + (words ? " MATCHING \"" + words.toUpperCase() + "\"" : "") + ".";
      if (!ids.length) return { ok: true, title: "THE VAULT", text: out + "\n  Nothing matches." };
      ids.slice(-L.vault).reverse().forEach(function (id) { out += "\n" + vaultLine(id, V.get(id)); });
      if (ids.length > L.vault) out += "\n  \u2026 and " + (ids.length - L.vault) + " more.";
      return { ok: true, title: "THE VAULT :: " + ids.length, text: out };
    });
  }
  function tagsReport(L) {
    var V = VAULT();
    var tags = V ? V.allTags() : [];
    if (!tags.length) return { ok: true, title: "TAGS", text: "NO PICTURE IN THE VAULT CARRIES A TAG YET." };
    return { ok: true, title: "TAGS", text: "TAGS IN THE VAULT :: " + tags.length + " IN USE\n  " + tags.map(function (t) { return "#" + t.tag + " (" + t.count + ")"; }).join("  \u00b7  ") };
  }
  function memoryReport(q, L) {
    var L0 = LORE();
    if (!L0) return { ok: false, error: "HER MEMORY IS OFFLINE." };
    var words = String(q || "").trim();
    if (!words) {
      var files = L0.files();
      return {
        ok: true, title: "HER MEMORY",
        text: "THE LOREPACK :: " + files.length + " DOCUMENT" + (files.length === 1 ? "" : "S") + " / " + L0.count() + " FRAGMENT" + (L0.count() === 1 ? "" : "S") + ".\n  "
          + files.slice(0, 24).map(function (f) { return f.name + " (" + f.chunks + ")"; }).join("  \u00b7  ")
          + "\n  Read a passage with memory <WORDS>."
      };
    }
    var hits = [];
    try { hits = L0.search(words, L.memory) || []; } catch (e) { hits = []; }
    if (!hits.length) return { ok: false, error: "NOTHING IN HER MEMORY MATCHES \"" + words.toUpperCase() + "\"." };
    return {
      ok: true, title: "HER MEMORY :: \"" + words.toUpperCase() + "\"",
      text: hits.map(function (h) { return "  " + h.file + (h.heading ? " :: " + h.heading : "") + "\n      " + clip(h.text, 300); }).join("\n")
    };
  }
  function rendersReport(q, L) {
    var RB = BOOK();
    if (!RB) return Promise.resolve({ ok: false, error: "THE RENDER BOOK IS OFFLINE." });
    var words = String(q || "").trim();
    if (/^r?\d{1,4}$/i.test(words.replace(/^#/, ""))) {
      return Promise.resolve(RB.row(words)).then(function (row) {
        return row ? { ok: true, title: "RENDER BOOK :: " + row.label, text: RB.rowText(row, true) } : { ok: false, error: "NO ROW " + words.toUpperCase() + " IN THE BOOK." };
      }, function () { return { ok: false, error: "NO ROW " + words.toUpperCase() + " IN THE BOOK." }; });
    }
    var rowsP = words ? RB.find(words, { limit: L.renders }) : RB.sheet().then(function (s) { return s.slice().reverse().slice(0, L.renders); });
    return Promise.resolve(rowsP).then(function (rows) {
      rows = rows || [];
      if (!rows.length) return { ok: false, error: "NOTHING IN THE RENDER BOOK MATCHES \"" + words.toUpperCase() + "\"." };
      return { ok: true, title: "THE RENDER BOOK" + (words ? " :: \"" + words.toUpperCase() + "\"" : "") + " :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S"), text: "Every picture made here, with the exact recipe that made it.\n" + rows.map(function (r) { return RB.rowText(r, false); }).join("\n") };
    }, function (e) { return { ok: false, error: "THE RENDER BOOK IS OFFLINE." }; });
  }
  function wantsReport() {
    if (typeof opts.reportWants === "function") {
      try { return { ok: true, title: "WHAT SHE WANTS CARRIED", text: clip(String(opts.reportWants() || ""), 1800) }; }
      catch (e) { return { ok: false, error: "HER OWN KEEPING IS OFFLINE." }; }
    }
    return { ok: false, error: "HER OWN KEEPING IS OFFLINE." };
  }
  function likesReport() {
    if (typeof opts.reportLikes === "function") {
      try { return { ok: true, title: "WHAT HE HAS MARKED", text: clip(String(opts.reportLikes() || ""), 2200) }; }
      catch (e) { return { ok: false, error: "THE HEART IS OFFLINE." }; }
    }
    return { ok: false, error: "THE HEART IS OFFLINE." };
  }
  function hersReport() {
    if (typeof opts.reportKept === "function") {
      try {
        return Promise.resolve(opts.reportKept()).then(function (t) {
          return { ok: true, title: "HER OWN MEMORY", text: clip(String(t || ""), 1800) };
        }, function () { return { ok: false, error: "HER OWN KEEPING IS OFFLINE." }; });
      } catch (e) { return Promise.resolve({ ok: false, error: "HER OWN KEEPING IS OFFLINE." }); }
    }
    return Promise.resolve({ ok: false, error: "HER OWN KEEPING IS OFFLINE." });
  }
  function statsReport() {
    var V = VAULT(), L0 = LORE(), RB = BOOK();
    return readLog().then(function (logs) {
      var files = L0 ? L0.files() : [];
      var out = "WHAT IS SAVED HERE";
      out += "\n  VAULT :: " + (V ? V.stats().count : 0) + " ITEMS in " + (V ? V.allFolders().length : 0) + " FOLDERS";
      out += "\n  ARCHIVE :: " + logs.length + " TURNS KEPT";
      out += "\n  HER MEMORY :: " + files.length + " DOCUMENTS / " + (L0 ? L0.count() : 0) + " FRAGMENTS";
      out += "\n  THE RENDER BOOK :: " + (RB && RB.count ? RB.count() : 0) + " ROWS";
      out += "\n  ALL OF IT LIVES ON THIS MACHINE AND NONE OF IT IS UPLOADED.";
      return { ok: true, title: "WHAT IS SAVED HERE", text: out };
    });
  }
  function everywhereReport(q, L) {
    var sections = [];
    return archiveReport(q, L).then(function (a) {
      if (a.ok && a.text) sections.push("IN THE ARCHIVE OF TURNS:\n" + a.text);
      var m = memoryReport(q, L);
      if (m.ok && m.text) sections.push("IN HER MEMORY:\n" + m.text);
      return rendersReport(q, L).then(function (r) {
        if (r.ok && r.text) sections.push("IN THE RENDER BOOK:\n" + r.text);
        return vaultReport(q, L).then(function (v) {
          if (v.ok && v.text) sections.push("IN THE VAULT:\n" + v.text);
          if (!sections.length) {
            return readLog().then(function (logs) {
              var L0 = LORE(), V = VAULT();
              return { ok: false, error: "NOTHING ANYWHERE HERE MATCHES \"" + q.toUpperCase() + "\". THE RECORD HOLDS " + logs.length + " TURNS, " + (L0 ? L0.count() : 0) + " MEMORY FRAGMENTS AND " + (V ? V.stats().count : 0) + " VAULT ITEMS." };
            });
          }
          return { ok: true, title: "\"" + q.toUpperCase() + "\" :: EVERYWHERE IT MATCHES", text: sections.join("\n\n") };
        }, function () { return { ok: true, title: "\"" + q.toUpperCase() + "\" :: EVERYWHERE IT MATCHES", text: sections.join("\n\n") }; });
      }, function () { return { ok: true, title: "\"" + q.toUpperCase() + "\"", text: sections.join("\n\n") }; });
    });
  }
  function answer(raw, aopts) {
    aopts = aopts || {};
    var L = lim(!!aopts.her);
    var q = normQuery(raw);
    var V = VAULT();
    var ready = (V && V.ensure) ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () {
      var head = "", rest = q;
      var m = q.match(/^([a-z]+)\s*[:]?\s*([\s\S]*)$/i);
      if (m) { head = m[1].toLowerCase(); rest = m[2].trim(); }
      if (/^(folders?|dirs?)$/.test(head) && (!rest || /^s?$/.test(rest))) {
        return rest ? folderReport(rest, L) : foldersReport(L);
      }
      if (/^(folder|dir|in)$/.test(head) && rest) return folderReport(rest, L);
      if (head === "vault" || head === "media") return vaultReport(rest, L);
      if (head === "archive" || head === "turns" || head === "history" || head === "search") return archiveReport(rest, L);
      if (head === "turn") return archiveReport("turn " + rest, L);
      if (head === "memory" || head === "lore" || head === "remember") return memoryReport(rest, L);
      if (head === "renders" || head === "render" || head === "book") return rendersReport(rest, L);
      if (head === "tags" || head === "tag") return Promise.resolve(tagsReport(L));
      if (head === "wants" || head === "carry") return Promise.resolve(wantsReport());
      if (head === "hers" || head === "kept") return hersReport();
      if (head === "likes" || head === "like" || head === "hearts" || head === "heart" || head === "taste" || head === "marked") return Promise.resolve(likesReport());
      if (head === "stats" || head === "status" || head === "everything") return statsReport();
      if (!q) return statsReport();
      return everywhereReport(q, L);
    }).then(function (r) { return r; }, function (e) {
      return { ok: false, error: "THE READ FAILED :: " + String((e && e.message) ? e.message : e) };
    });
  }
  function forHer(raw) { return answer(raw, { her: true }); }
  function filterMade(ids, topts) {
    if (!topts || !topts.onlyMade) return ids;
    var V = VAULT();
    return ids.filter(function (id) {
      var r = V && V.get(id);
      return r && (r.kind === "gen" || r.kind === "upscale");
    });
  }
  function targets(what, topts) {
    topts = topts || {};
    var V = VAULT(), RB = BOOK();
    var spec = String(what || "").trim();
    var out = [];
    if (!spec) return Promise.resolve({ ids: [], label: "" });
    if (V && V.get(spec)) return Promise.resolve({ ids: [spec], label: spec });
    if (RB && typeof RB.row === "function" && /^#?r?\d{1,4}$/i.test(spec)) {
      return Promise.resolve(RB.row(spec)).then(function (row) {
        if (row) return { ids: [row.id], label: row.label };
        return wordTargets();
      }, function () { return wordTargets(); });
    }
    var tag = spec.match(/^#([a-z0-9][a-z0-9-]{0,31})$/i);
    if (tag && V) {
      var want = V.normTag(tag[1]);
      var ids = V.list().filter(function (id) {
        var r = V.get(id);
        return r && (r.tags || []).indexOf(want) !== -1;
      });
      if (topts.max) ids = ids.slice(-topts.max);
      return Promise.resolve({ ids: filterMade(ids, topts), label: "#" + want });
    }
    return wordTargets();
    function wordTargets() {
      var chain = Promise.resolve(true);
      if (RB && typeof RB.find === "function") {
        chain = chain.then(function () {
          return Promise.resolve(RB.find(spec, { limit: topts.max || 8 })).then(function (rows) {
            (rows || []).forEach(function (r) { if (out.indexOf(r.id) === -1) out.push(r.id); });
          }, function () {});
        });
      }
      return chain.then(function () {
        if (!out.length && V) {
          var terms = spec.toLowerCase().split(/\s+/).filter(Boolean);
          V.list().forEach(function (id) {
            var r = V.get(id);
            if (!r) return;
            var hay = [r.prompt, r.name, r.note, r.sight, V.folderOf(r), (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
            if (terms.every(function (t) { return hay.indexOf(t) !== -1; })) out.push(id);
          });
          if (topts.max) out = out.slice(-topts.max);
        }
        return { ids: filterMade(out, topts), label: spec };
      });
    }
  }
  function load() {
    var s = QSTORE();
    if (!s || typeof s.get !== "function") { loaded = true; return Promise.resolve(pending.slice()); }
    return Promise.resolve(s.get("unseen_reads")).then(function (v) {
      if (Array.isArray(v)) pending = v.filter(function (p) { return p && typeof p.text === "string" && typeof p.q === "string"; }).slice(-PENDING_MAX);
      loaded = true;
      return pending.slice();
    }, function () { loaded = true; return pending.slice(); });
  }
  function save() {
    var s = QSTORE();
    if (!s || typeof s.set !== "function") return Promise.resolve(false);
    return Promise.resolve(s.set("unseen_reads", pending.slice(-PENDING_MAX))).then(function () { return true; }, function () { return false; });
  }
  function queue(items) {
    return (loaded ? Promise.resolve(true) : load().then(function () { return true; })).then(function () {
      (items || []).forEach(function (p) {
        if (!p || !p.text) return;
        pending.push({ q: String(p.q || ""), title: String(p.title || ""), text: String(p.text), ts: p.ts || Date.now() });
      });
      pending = pending.slice(-PENDING_MAX);
      return save().then(function () { return pending.slice(); });
    });
  }
  function clear() { pending = []; return save().then(function () { return true; }); }
  function block() {
    if (!pending.length) return "";
    var body = pending.map(function (p) { return "\"" + p.q + "\"\n" + p.text; }).join("\n\n");
    return "You asked to read the record, and this is what it says. Nothing was changed by your reading it:\n<read>\n" + body + "\n</read>";
  }
  function take() {
    var p = pending.slice();
    return clear().then(function () { return p; });
  }
  function describe() {
    var V = VAULT();
    var st = V ? V.stats() : { count: 0 };
    var folders = V ? V.allFolders() : [];
    var out = ["THE READER :: READ-ONLY ACCESS TO EVERYTHING SAVED HERE",
      "  READ WITH: <WHAT> - folders, folder /music, vault, archive <WORDS>, turn <N>, memory <WORDS>, renders <WORDS>, tags, stats, or <WORDS> (everywhere at once).",
      "  THE VAULT :: " + st.count + " ITEMS in " + folders.length + " FOLDERS :: " + folders.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  "),
      "  READING WRITES NOTHING."];
    return out.join("\n");
  }
  function report(raw) {
    return answer(raw, {}).then(function (r) {
      if (!r.ok) return String(r.error || "THE READ FAILED.");
      return (r.title ? r.title + "\n" : "") + r.text;
    });
  }
  load();
  return {
    answer: answer, forHer: forHer, report: report, describe: describe, targets: targets,
    load: load, queue: queue, clear: clear, take: take,
    pending: function () { return pending.slice(); }, block: block,
    PENDING_MAX: PENDING_MAX
  };
}
return { client: client };
})();
