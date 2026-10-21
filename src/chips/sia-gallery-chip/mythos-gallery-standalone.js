window.MythosGallery = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var FILTERS = ["all", "render", "sent", "music", "vox", "clip", "upscaled", "unseen"];
  var SORTS = ["newest", "oldest", "biggest", "az", "turn"];
  var PERS = [24, 60, 120, 240, 0];
  var PER_DEFAULT = opts.perDefault || 60;
  var state = { filter: "all", query: "", sort: "newest", sel: {}, page: 1, per: PER_DEFAULT };
  var cat = null;
  var catAt = 0;
  var rows = [];
  function VAULT() { return opts.vault || null; }
  function BOOK() { return opts.renderBook || null; }
  function VSTORE() { return opts.viewStore || null; }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return ts ? String(ts) : "";
  }
  function fmtBytes(n) {
    n = n || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function readLog() {
    if (typeof opts.readLog === "function") {
      try { return Promise.resolve(opts.readLog()).then(function (v) { return v || []; }, function () { return []; }); }
      catch (e) { return Promise.resolve([]); }
    }
    return Promise.resolve(Array.isArray(opts.archive) ? opts.archive : []);
  }
  function merge(a, b) {
    var out = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }
  function buildCatalogue() {
    return readLog().then(function (logs) {
      var map = {};
      logs.forEach(function (e, i) {
        var n = i + 1;
        var silent = !!e.silent || e.kind === "create";
        var note = { turn: n, when: e.ts, h: e.h == null ? "" : e.h, s: e.s == null ? "" : e.s, role: e.role || "", silent: silent };
        (e.img || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "sent" }); });
        (e.gen || []).forEach(function (g) {
          if (!g || !g.id) return;
          if (!map[g.id]) map[g.id] = merge(note, { how: "made", prompt: g.prompt || "" });
        });
        (e.sight || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "seen" }); });
        (e.show || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "recalled" }); });
      });
      cat = map;
      catAt = Date.now();
      return map;
    });
  }
  function folderOf(rec) {
    var V = VAULT();
    if (V && typeof V.folderOf === "function") { try { return V.folderOf(rec); } catch (e) {} }
    return "";
  }
  function normFolder(p) {
    var V = VAULT();
    if (V && typeof V.normFolder === "function") { try { return V.normFolder(p); } catch (e) {} }
    return String(p || "").toLowerCase();
  }
  function isVox(rec) {
    var V = VAULT();
    if (V && typeof V.isVox === "function") { try { return !!V.isVox(rec); } catch (e) {} }
    if (!rec) return false;
    if (String(rec.kind || "") === "vox") return true;
    var f = folderOf(rec);
    return f === "/audio/vox" || f.indexOf("/audio/vox/") === 0;
  }
  function kindOf(rec) {
    if (!rec) return "sent";
    if (rec.kind === "video") return "clip";
    if (rec.kind === "upscale") return "upscaled";
    if (rec.kind === "gen") return "render";
    if (/^audio\//.test(String(rec.mime || ""))) return isVox(rec) ? "vox" : "music";
    return "sent";
  }
  function unseenIds() {
    if (typeof opts.sightPending === "function") { try { return opts.sightPending() || []; } catch (e) { return []; } }
    return [];
  }
  function badgeFor(rec, short) {
    var memo = cat && cat[rec.id];
    var kind = kindOf(rec);
    if (kind === "music") return short ? "MUSIC" : "YOUR MUSIC";
    if (kind === "vox") return short ? "VOX" : "A VOICE IN THE VAULT";
    if (kind === "clip") return short ? "CLIP" : "YOUR CLIP";
    if (kind === "upscaled") return (short || !rec.note) ? "UPSCALED" : "UPSCALED " + String(rec.note).toUpperCase();
    if (kind === "render") {
      if (memo && memo.how === "made") {
        if (memo.silent) return short ? "CREATION #" + memo.turn : "CREATION " + memo.turn;
        return short ? "MADE #" + memo.turn : "MADE IN TURN " + memo.turn;
      }
      if (memo && memo.how === "recalled") return short ? "ASKED #" + memo.turn : "SHE ASKED TO SEE IT AGAIN (TURN " + memo.turn + ")";
      return short ? "RENDER" : (memo && memo.turn ? "IN TURN " + memo.turn : "RENDER");
    }
    if (memo && memo.how === "sent") return short ? "SENT #" + memo.turn : "YOU SENT IT (TURN " + memo.turn + ")";
    return short ? "VAULT" : "IN THE VAULT";
  }
  function noteFor(id) {
    var V = VAULT();
    var rec = V ? V.get(id) : null;
    if (!rec) return "";
    var memo = cat && cat[id];
    var bits = [badgeFor(rec)];
    if (memo) {
      var said = String(memo.h || "").replace(/\s+/g, " ").trim();
      var heard = String(memo.s || "").replace(/\s+/g, " ").trim();
      if (said) bits.push("he was saying: \"" + said.slice(0, 90) + (said.length > 90 ? "\u2026" : "") + "\"");
      else if (memo.turn && memo.how !== "seen") bits.push("nothing was said - turn " + memo.turn + " is the picture's own");
      if (heard && memo.how !== "made") bits.push("she answered: \"" + heard.slice(0, 90) + (heard.length > 90 ? "\u2026" : "") + "\"");
    }
    if (rec.pose) bits.push("pose: " + rec.pose);
    var f = folderOf(rec);
    if (f) bits.push("folder: " + f);
    return bits.join("   \u00b7   ");
  }
  function titleFor(rec) {
    var memo = cat && cat[rec.id];
    var out = [rec.name || "image"];
    var f = folderOf(rec);
    if (f) out.push("folder: " + f);
    if (rec.prompt) out.push("prompt: " + rec.prompt);
    if (rec.seed) out.push("seed " + rec.seed + (rec.guidanceScale ? " \u00b7 guidance " + rec.guidanceScale : "") + (rec.resolution ? " \u00b7 " + rec.resolution : ""));
    if (rec.tags && rec.tags.length) out.push("tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" "));
    if (rec.sight) out.push("her reading: " + rec.sight);
    var RB = BOOK();
    var rb = (RB && typeof RB.labelOf === "function") ? RB.labelOf(rec.id) : "";
    if (rb) out.push("render book: " + rb);
    if (memo) {
      out.push("from turn " + memo.turn + (memo.how === "made" ? " - she made it in her reply" : memo.how === "sent" ? " - you sent it to her" : ""));
      if (memo.h) out.push("Patrikios: " + String(memo.h).slice(0, 160));
      if (memo.s) out.push("LIA: " + String(memo.s).slice(0, 160));
    }
    return out.join("\n");
  }
  function allRows() {
    var V = VAULT();
    if (!V) return [];
    return V.list().map(function (id) {
      var rec = V.get(id);
      if (!rec) return null;
      var memo = cat && cat[id];
      return { id: id, rec: rec, kind: kindOf(rec), memo: memo || null, folder: folderOf(rec), label: String(rec.prompt || rec.name || ""), ts: rec.ts || 0, turn: (memo && memo.turn) || 0, seen: !!(rec.sight) };
    }).filter(Boolean);
  }
  function fileLabel(rec) {
    if (!rec) return "";
    var V = VAULT();
    if (V && typeof V.artifactName === "function") { try { return V.artifactName(rec); } catch (e) {} }
    if (V && typeof V.fileName === "function") { try { return V.fileName(rec); } catch (e) {} }
    return rec.name || "";
  }
  function queryFolders() {
    var out = [];
    var push = function (p) { var n = normFolder(p); if (n && out.indexOf(n) === -1) out.push(n); };
    String(state.query || "").replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[^\s]+|[a-z0-9][a-z0-9/_-]*)/gi, function (m, p) { push(p); return " "; });
    String(state.query || "").replace(/(^|\s)(\/[a-z0-9][a-z0-9/_-]*)/gi, function (m, sp, p) { push(p); return " "; });
    return out;
  }
  function queryTags() {
    var out = [];
    String(state.query || "").replace(/#([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.push(t.toLowerCase()); return " "; }).replace(/\btags?[: ]\s*([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.push(t.toLowerCase()); return " "; });
    return out;
  }
  function queryText() {
    return String(state.query || "")
      .replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[^\s]+|[a-z0-9][a-z0-9/_-]*)/gi, " ")
      .replace(/(^|\s)\/[a-z0-9][a-z0-9/_-]*/gi, " ")
      .replace(/#[a-z0-9][a-z0-9-]{0,31}/gi, " ")
      .replace(/\btags?[: ]\s*[a-z0-9][a-z0-9-]{0,31}/gi, " ")
      .replace(/\s+/g, " ").trim();
  }
  function matches(r, unseen) {
    if (state.filter === "unseen") { if (unseen.indexOf(r.id) === -1) return false; }
    else if (state.filter !== "all" && r.kind !== state.filter) return false;
    var wantedFolders = queryFolders(), fi, want, here;
    if (wantedFolders.length) {
      here = folderOf(r.rec);
      for (fi = 0; fi < wantedFolders.length; fi++) {
        want = wantedFolders[fi];
        if (here !== want && here.indexOf(want + "/") !== 0) return false;
      }
    }
    var wantedTags = queryTags(), t;
    if (wantedTags.length) {
      var mine = r.rec.tags || [];
      for (t = 0; t < wantedTags.length; t++) if (mine.indexOf(wantedTags[t]) === -1) return false;
    }
    var q = queryText();
    if (!q) return true;
    var hay = [r.rec.prompt, r.rec.sent, r.rec.name, r.rec.sight, r.rec.note, r.rec.negative, r.rec.pose, (r.rec.tags || []).join(" "), fileLabel(r.rec), folderOf(r.rec), (r.memo ? r.memo.h : ""), (r.memo ? r.memo.s : ""), badgeFor(r.rec)].filter(Boolean).join(" \n ").toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), i;
    for (i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    return true;
  }
  function sortRows(a, b) {
    if (state.sort === "oldest") return a.ts - b.ts;
    if (state.sort === "biggest") return (b.rec.bytes || 0) - (a.rec.bytes || 0);
    if (state.sort === "az") return a.label.toLowerCase().localeCompare(b.label.toLowerCase()) || (b.ts - a.ts);
    if (state.sort === "turn") return (a.turn || 1e9) - (b.turn || 1e9) || (a.ts - b.ts);
    return b.ts - a.ts;
  }
  function compute() {
    var unseen = unseenIds();
    rows = allRows().filter(function (r) { return matches(r, unseen); }).sort(sortRows);
    return rows;
  }
  function perOf() { return state.per > 0 ? state.per : Math.max(1, rows.length); }
  function pageCount() { return state.per > 0 ? Math.max(1, Math.ceil(rows.length / state.per)) : 1; }
  function clampPage() {
    var p = Math.floor(Number(state.page) || 1);
    var pc = pageCount();
    if (p < 1) p = 1;
    if (p > pc) p = pc;
    state.page = p;
    return p;
  }
  function pageRows() {
    var per = perOf(), p = clampPage(), from = (p - 1) * per;
    return rows.slice(from, from + per);
  }
  function pageOfId(id) {
    var per = perOf();
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return Math.floor(i / per) + 1;
    return 0;
  }
  function total() {
    var V = VAULT();
    return V ? V.list().length : 0;
  }
  function selectedIds() {
    return Object.keys(state.sel).filter(function (id) { return state.sel[id]; });
  }
  function refresh() {
    var V = VAULT();
    var ready = (V && V.ensure) ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () { return buildCatalogue(); }).then(function () {
      compute();
      clampPage();
      return stateOf();
    });
  }
  function saveView() {
    var s = VSTORE();
    if (!s || typeof s.set !== "function") return Promise.resolve(false);
    return Promise.resolve(s.set("gallery_view", { per: state.per })).then(function () { return true; }, function () { return false; });
  }
  function loadView() {
    var s = VSTORE();
    if (!s || typeof s.get !== "function") return Promise.resolve(false);
    return Promise.resolve(s.get("gallery_view")).then(function (v) {
      if (v && PERS.indexOf(v.per) !== -1) state.per = v.per;
      return true;
    }, function () { return false; });
  }
  function setFilter(id) {
    if (FILTERS.indexOf(id) === -1) return false;
    state.filter = id;
    state.page = 1;
    compute();
    return true;
  }
  function setQuery(q) {
    state.query = String(q == null ? "" : q);
    state.page = 1;
    compute();
    return state.query;
  }
  function setSort(id) {
    if (SORTS.indexOf(id) === -1) return false;
    state.sort = id;
    compute();
    return true;
  }
  function setPage(n) {
    state.page = n;
    return clampPage();
  }
  function setPer(n) {
    n = Number(n) || 0;
    if (PERS.indexOf(n) === -1) return false;
    state.per = n;
    state.page = 1;
    compute();
    saveView();
    return true;
  }
  function toggleTag(tag) {
    var t = String(tag || "").replace(/^#+/, "").toLowerCase();
    if (!t) return state.query;
    var has = new RegExp("#" + t + "\\b", "i").test(state.query);
    state.query = has ? state.query.replace(new RegExp("\\s*#?" + t + "\\b", "gi"), " ").replace(/\s+/g, " ").trim() : (state.query + " #" + t).trim();
    state.page = 1;
    compute();
    return state.query;
  }
  function toggleFolder(path) {
    var p = normFolder(path);
    if (!p) return state.query;
    var has = state.query.indexOf(p) !== -1;
    state.query = has ? state.query.split(p).join(" ").replace(/\s+/g, " ").trim() : (state.query + " folder:" + p).trim();
    state.page = 1;
    compute();
    return state.query;
  }
  function toggleSel(id) {
    if (state.sel[id]) delete state.sel[id];
    else state.sel[id] = true;
    return selectedIds();
  }
  function clearSel() { state.sel = {}; return []; }
  function selectAll() {
    rows.forEach(function (r) { state.sel[r.id] = true; });
    return selectedIds();
  }
  function queueSelected() {
    var ids = selectedIds();
    if (typeof opts.queueIds !== "function") return Promise.resolve({ ok: false, error: "NO QUEUE ROAD ON THIS HOST." });
    return Promise.resolve(opts.queueIds(ids)).then(function () { return { ok: true, n: ids.length }; });
  }
  function saveSelected() {
    var ids = selectedIds();
    if (typeof opts.saveId !== "function") return Promise.resolve({ ok: false, error: "NO SAVE ROAD ON THIS HOST." });
    var chain = Promise.resolve(true);
    ids.forEach(function (id) {
      chain = chain.then(function () { return opts.saveId(id); });
    });
    return chain.then(function () { return { ok: true, n: ids.length }; });
  }
  function deleteSelected() {
    var ids = selectedIds();
    if (typeof opts.removeId !== "function") return Promise.resolve({ ok: false, error: "NO DELETE ROAD ON THIS HOST." });
    var chain = Promise.resolve(true);
    ids.forEach(function (id) {
      chain = chain.then(function () { return opts.removeId(id); });
    });
    return chain.then(function () {
      state.sel = {};
      return refresh().then(function () { return { ok: true, n: ids.length }; });
    });
  }
  function reveal(id) {
    var p = pageOfId(String(id == null ? "" : id));
    if (!p) return 0;
    setPage(p);
    return p;
  }
  function exportCatalogue() {
    compute();
    var stamp = STAMP(Date.now()) || new Date().toISOString();
    var RB = BOOK();
    var json = {
      exportedAt: stamp,
      filter: state.filter, query: state.query, sort: state.sort,
      shown: rows.length, inVault: total(),
      pictures: rows.map(function (r) {
        var rec = r.rec;
        var V = VAULT();
        return {
          id: r.id, stamp: STAMP(rec.ts), ts: rec.ts, kind: r.kind, badge: badgeFor(rec),
          name: rec.name || "", file: (V && typeof V.fileName === "function") ? V.fileName(rec) : "",
          folder: folderOf(rec), bytes: rec.bytes || 0, w: rec.w || 0, h: rec.h || 0, mime: rec.mime || "",
          prompt: rec.prompt || "", sent: rec.sent || "", negative: rec.negative || "",
          seed: rec.seed || 0, guidanceScale: rec.guidanceScale || 0, resolution: rec.resolution || "",
          pose: rec.pose || "", note: rec.note || "", duration: rec.duration || 0,
          tags: (rec.tags || []).slice(),
          renderBook: (RB && typeof RB.labelOf === "function") ? (RB.labelOf(r.id) || "") : "",
          herReading: rec.sight || "",
          turn: r.memo ? r.memo.turn : 0, source: r.memo ? r.memo.how : "",
          turnSaid: r.memo ? String(r.memo.h || "") : "", turnAnswered: r.memo ? String(r.memo.s || "") : ""
        };
      })
    };
    var text = "GALLERY CATALOGUE\nEXPORTED: " + stamp + "\nPICTURES: " + rows.length + " OF " + total() + " IN THE VAULT\nEVERY LINE BELOW IS ONE PICTURE, WITH THE STAMP IT WAS STORED UNDER.\n\n";
    rows.forEach(function (r) {
      var rec = r.rec;
      text += "[" + STAMP(rec.ts) + "] " + badgeFor(rec) + "  \u00b7  " + (rec.name || "image") + "  \u00b7  " + folderOf(rec)
        + (rec.bytes ? "  \u00b7  " + fmtBytes(rec.bytes) : "") + "\n";
      if (rec.prompt) text += "    prompt: " + rec.prompt + "\n";
      if (rec.tags && rec.tags.length) text += "    tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" ") + "\n";
      if (r.memo && r.memo.turn) text += "    turn #" + r.memo.turn + "\n";
      text += "\n";
    });
    if (typeof opts.download === "function") {
      try {
        opts.download("gallery.json", JSON.stringify(json, null, 2), "application/json");
        opts.download("gallery.txt", text, "text/plain");
      } catch (e) {}
    }
    return { json: json, text: text };
  }
  function describe() {
    var list = allRows();
    var by = { render: 0, sent: 0, clip: 0, upscaled: 0, music: 0, vox: 0 }, bytes = 0;
    list.forEach(function (r) {
      by[r.kind] = (by[r.kind] || 0) + 1;
      bytes += r.rec.bytes || 0;
    });
    var V = VAULT();
    var tags = (V && typeof V.allTags === "function") ? V.allTags() : [];
    var out = ["THE GALLERY :: " + list.length + " PICTURES IN THE VAULT (" + fmtBytes(bytes) + ")"];
    out.push("  " + by.render + " MADE BY THE TERMINAL \u00b7 " + by.sent + " SENT OR IMPORTED \u00b7 " + by.clip + " CLIPS \u00b7 " + by.upscaled + " UPSCALED \u00b7 " + (by.music || 0) + " MUSIC \u00b7 " + (by.vox || 0) + " VOX");
    out.push("  " + unseenIds().length + " WAITING FOR HER EYES");
    out.push("  TAGS: " + (tags.length ? tags.length + " IN USE" : "NONE YET"));
    out.push("  SHOWN " + (state.per > 0 ? state.per + " TO A PAGE" : "ALL ON ONE PAGE") + " \u00b7 A PAGE IS WHAT IS DRAWN, NEVER WHAT IS SEARCHED.");
    return out.join("\n");
  }
  function find(q) {
    setQuery(q);
    return rows.slice();
  }
  function stateOf() {
    var page = clampPage(), pages = pageCount(), per = perOf();
    return {
      filter: state.filter, query: state.query, sort: state.sort,
      sel: selectedIds().length, shown: rows.length, vault: total(),
      page: page, pages: pages, per: state.per,
      onPage: rows.length ? Math.min(per, rows.length - (page - 1) * per) : 0,
      catalogueTurns: cat ? Object.keys(cat).length : 0, catAt: catAt
    };
  }
  loadView();
  return {
    refresh: refresh, compute: compute,
    setFilter: setFilter, setQuery: setQuery, setSort: setSort, setPage: setPage, setPer: setPer,
    toggleTag: toggleTag, toggleFolder: toggleFolder,
    rows: function () { return rows.slice(); }, pageRows: pageRows, pageOfId: pageOfId, reveal: reveal,
    toggleSel: toggleSel, selectAll: selectAll, clearSel: clearSel, selected: selectedIds,
    queueSelected: queueSelected, saveSelected: saveSelected, deleteSelected: deleteSelected,
    exportCatalogue: exportCatalogue, describe: describe, find: find,
    kindOf: kindOf, badgeFor: badgeFor, noteFor: noteFor, titleFor: titleFor,
    queryTags: queryTags, queryFolders: queryFolders,
    state: stateOf, filters: function () { return FILTERS.slice(); }, sorts: function () { return SORTS.slice(); }
  };
}
return { client: client };
})();
