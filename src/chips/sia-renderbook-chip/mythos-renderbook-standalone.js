window.MythosRenderBook = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var PREFIX = opts.prefix || "R";
  var MADE = { gen: 1, upscale: 1 };
  function VAULT() { return opts.vault || null; }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return ts ? String(ts) : "";
  }
  function clip(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? (t.slice(0, n) + "\u2026") : t;
  }
  function fileOf(rec) {
    var V = VAULT();
    if (V && typeof V.artifactName === "function") { try { return V.artifactName(rec); } catch (e) {} }
    if (V && typeof V.fileName === "function") { try { return V.fileName(rec); } catch (e) {} }
    return rec.name || "image";
  }
  function folderOf(rec) {
    var V = VAULT();
    if (V && typeof V.folderOf === "function") { try { return V.folderOf(rec); } catch (e) {} }
    return "";
  }
  function list() {
    var rows = [];
    var V = VAULT();
    if (!V) return rows;
    V.list().forEach(function (id) {
      var rec = V.get(id);
      if (!rec || !MADE[rec.kind]) return;
      rows.push({ id: id, rec: rec, ts: rec.ts || 0 });
    });
    rows.sort(function (a, b) { return (a.ts - b.ts) || (String(a.id) < String(b.id) ? -1 : 1); });
    rows.forEach(function (r, i) { r.n = i + 1; r.label = PREFIX + r.n; });
    return rows;
  }
  function readLog() {
    if (typeof opts.readLog === "function") {
      try { return Promise.resolve(opts.readLog()).then(function (v) { return v || []; }, function () { return []; }); }
      catch (e) { return Promise.resolve([]); }
    }
    return Promise.resolve(Array.isArray(opts.archive) ? opts.archive : []);
  }
  function turnMap() {
    return readLog().then(function (logs) {
      var map = {};
      logs.forEach(function (e, i) {
        var silent = !!e.silent || e.kind === "create";
        var note = { turn: i + 1, when: e.ts || 0, silent: silent, h: e.h == null ? "" : String(e.h), s: e.s == null ? "" : String(e.s) };
        (e.gen || []).forEach(function (g) {
          if (g && g.id && !map[g.id]) map[g.id] = note;
        });
      });
      return map;
    });
  }
  function enrich(rows, map) {
    rows.forEach(function (r) {
      var m = map[r.id];
      r.turn = m ? m.turn : 0;
      r.what = m ? m.h : "";
      r.said = m ? m.s : "";
      r.stamp = STAMP(r.rec.ts);
      if (r.rec.kind === "upscale") r.how = "upscaled";
      else if (m && m.silent) r.how = "creation";
      else if (m) r.how = "turn";
      else r.how = "vault";
      r.label = PREFIX + r.n;
    });
    return rows;
  }
  function sheet() {
    var V = VAULT();
    if (!V) return Promise.resolve([]);
    var ready = V.ensure ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () { return turnMap().then(function (map) { return enrich(list(), map); }); });
  }
  function parseQuery(q) {
    var out = { tags: [], folder: "", seed: 0, turn: 0, text: "" };
    var s = String(q == null ? "" : q);
    var V = VAULT();
    function normF(p) {
      if (V && typeof V.normFolder === "function") { try { return V.normFolder(p); } catch (e) {} }
      return String(p).toLowerCase();
    }
    s = s.replace(/(^|\s)#([a-z0-9][a-z0-9-]{0,31})/gi, function (m, sp, t) { out.tags.push(t.toLowerCase()); return " "; });
    s = s.replace(/\btags?[:=]\s*([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.tags.push(t.toLowerCase()); return " "; });
    s = s.replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[a-z0-9/_-]*|[a-z0-9][a-z0-9/_-]*)/gi, function (m, p) {
      if (!out.folder) out.folder = normF(p);
      return " ";
    });
    if (!out.folder) {
      s = s.replace(/(^|\s)(\/[a-z0-9][a-z0-9/_-]*)/gi, function (m, sp, p) {
        if (!out.folder) out.folder = normF(p);
        return " ";
      });
    }
    s = s.replace(/\bseeds?[:=]?\s*(\d{1,10})\b/gi, function (m, n) { out.seed = Number(n) || 0; return " "; });
    s = s.replace(/\bturns?[:=]?\s*#?(\d{1,5})\b/gi, function (m, n) { out.turn = Number(n) || 0; return " "; });
    out.text = s.replace(/[\s,]+/g, " ").trim().toLowerCase();
    return out;
  }
  function haystack(r) {
    var rec = r.rec;
    return [
      rec.prompt, rec.sent, rec.negative, rec.name, rec.pose, rec.note, rec.sight,
      (rec.tags || []).join(" "), rec.folder || "", folderOf(rec),
      rec.seed ? ("seed " + rec.seed) : "", rec.resolution, r.what, r.said, fileOf(rec)
    ].filter(Boolean).join(" \n ").toLowerCase();
  }
  function scoreOf(r, terms) {
    if (!terms.length) return 0;
    var prompt = String(r.rec.prompt || "").toLowerCase();
    var tags = (r.rec.tags || []).join(" ").toLowerCase();
    var s = 0;
    terms.forEach(function (t) {
      if (prompt.indexOf(t) !== -1) s += 3;
      if (tags.indexOf(t) !== -1) s += 2;
    });
    return s;
  }
  function matchRows(rows, q, newestFirst) {
    var p = parseQuery(q);
    var terms = p.text ? p.text.split(/\s+/).filter(Boolean) : [];
    var out = rows.filter(function (r) {
      var rec = r.rec, i, t;
      if (p.tags.length) {
        var mine = rec.tags || [];
        for (i = 0; i < p.tags.length; i++) if (mine.indexOf(p.tags[i]) === -1) return false;
      }
      if (p.seed && Number(rec.seed) !== p.seed) return false;
      if (p.turn && Number(r.turn) !== p.turn) return false;
      if (p.folder) {
        var here = folderOf(rec);
        if (here !== p.folder && here.indexOf(p.folder + "/") !== 0) return false;
      }
      if (!terms.length) return true;
      var hay = haystack(r);
      for (t = 0; t < terms.length; t++) if (hay.indexOf(terms[t]) === -1) return false;
      return true;
    });
    if (terms.length) out = out.slice().sort(function (a, b) { return (scoreOf(b, terms) - scoreOf(a, terms)) || (b.ts - a.ts); });
    else out = newestFirst === false ? out : out.slice().reverse();
    return out;
  }
  function find(q, fopts) {
    fopts = fopts || {};
    return sheet().then(function (rows) {
      var out = matchRows(fopts.rows || rows, q, true);
      return fopts.limit ? out.slice(0, fopts.limit) : out;
    });
  }
  function search(q, sopts) { return find(q, sopts); }
  function forHer(q, limit) { return find(q, { limit: limit || 3 }); }
  function byNumber(n, rows) {
    var want = String(n == null ? "" : n).trim().toUpperCase().replace(/^#/, "");
    if (/^\d+$/.test(want)) want = PREFIX + want;
    rows = rows || list();
    for (var i = 0; i < rows.length; i++) if (rows[i].label === want) return rows[i];
    return null;
  }
  function row(n) {
    return sheet().then(function (rows) { return byNumber(n, rows); });
  }
  function rowText(r, full) {
    var rec = r.rec;
    var bits = [r.label];
    var when = r.stamp || STAMP(rec.ts);
    if (when) bits.push(when);
    var fold = folderOf(rec);
    if (fold) bits.push(fold);
    if (rec.kind === "upscale") bits.push(rec.replaced ? "UPSCALE - IT REPLACED THE RENDER IT CAME FROM (that render is out of the vault)" : "UPSCALE OF A PICTURE ALREADY HERE");
    if (rec.seed) bits.push("seed " + rec.seed);
    if (rec.guidanceScale) bits.push("guidance " + rec.guidanceScale);
    if (rec.resolution) bits.push(rec.resolution);
    var out = bits.join("  \u00b7  ");
    out += "\n  prompt: " + (rec.prompt || "(made without a prompt)");
    if (rec.sent && rec.sent !== rec.prompt) out += "\n  sent: " + rec.sent;
    if (rec.negative) out += "\n  negative: " + rec.negative;
    if (rec.pose) out += "\n  pose: " + rec.pose;
    if (rec.tags && rec.tags.length) out += "\n  tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" ");
    if (r.turn) {
      out += "\n  " + (r.how === "creation" ? "creation #" : "made in turn #") + r.turn;
      if (r.what) out += " \u00b7 he was saying: \"" + clip(r.what, 90) + "\"";
    } else if (rec.kind !== "upscale") {
      out += "\n  not in a turn \u00b7 held in the vault";
    }
    out += "\n  file: " + fileOf(rec);
    if (full && rec.sight) out += "\n  her reading: " + rec.sight;
    return out;
  }
  function report(rows, ropts) {
    ropts = ropts || {};
    if (!rows || !rows.length) return (ropts.head ? ropts.head + "\n\n" : "") + "NOTHING IN THE BOOK MATCHES.";
    var limit = ropts.limit || rows.length;
    var head = ropts.head || ("THE RENDER BOOK :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S") + (rows.length > limit ? " \u00b7 THE NEWEST " + limit : "") + " \u00b7 EACH ONE CARRIES THE EXACT RECIPE IT WAS MADE FROM");
    return head + "\n\n" + rows.slice(0, limit).map(function (r) { return rowText(r, ropts.full); }).join("\n\n");
  }
  function describe() {
    var rows = list();
    var renders = 0, upscales = 0, seeds = 0;
    rows.forEach(function (r) {
      if (r.rec.kind === "upscale") upscales++; else renders++;
      if (r.rec.seed) seeds++;
    });
    var V = VAULT();
    var tags = (V && typeof V.allTags === "function") ? V.allTags() : [];
    var out = ["THE RENDER BOOK :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S") + " (" + renders + " RENDERS \u00b7 " + upscales + " UPSCALES) \u00b7 " + seeds + " WITH A SEED ON THE RECORD"];
    out.push("  EVERY ROW CARRIES THE EXACT PROMPT, THE WORDS SENT, THE NEGATIVE LIST, THE SEED, THE GUIDANCE, THE SIZE AND THE STAMP IT WAS STORED UNDER - THE WHOLE RECIPE, SO A PICTURE CAN BE MADE AGAIN.");
    out.push("  ROWS ARE NUMBERED " + PREFIX + "1.." + PREFIX + rows.length + " IN THE ORDER THEY WERE MADE. ROW NUMBERS DO NOT MOVE WHILE THEIR PICTURE IS IN THE VAULT.");
    out.push("  TAGS: " + (tags.length ? tags.length + " IN USE :: " + tags.slice(0, 18).map(function (t) { return "#" + t.tag + "(" + t.count + ")"; }).join(" ") : "none yet"));
    return out.join("\n");
  }
  function redo(n) {
    var row = byNumber(n);
    if (!row) return Promise.resolve({ ok: false, error: "NO ROW " + String(n || "").toUpperCase() + " IN THE BOOK." });
    var rec = row.rec;
    if (!rec.prompt) return Promise.resolve({ ok: false, error: row.label + " WAS NOT MADE FROM A PROMPT, SO THERE IS NOTHING TO RUN AGAIN." });
    var F = opts.forge;
    if (!F) return Promise.resolve({ ok: false, error: "THE FORGE FORM IS NOT LOADED HERE." });
    try {
      F.prompt = rec.prompt;
      F.negative = rec.negative || "";
      F.seed = rec.seed ? String(rec.seed) : "";
      F.guidance = rec.guidanceScale || opts.defaultGuidance || 7;
      var res = rec.resolution || ((rec.w && rec.h) ? (rec.w + "x" + rec.h) : "");
      F.resolution = /^(512x512|512x768|768x512|768x768)$/.test(res) ? res : (opts.defaultResolution || "768x512");
      if (typeof opts.onRedo === "function") opts.onRedo(F, row);
    } catch (e) { return Promise.resolve({ ok: false, error: "THE FORGE FORM WOULD NOT TAKE IT :: " + String((e && e.message) || e) }); }
    return Promise.resolve({ ok: true, row: row, seed: rec.seed || 0 });
  }
  function exportBook() {
    return sheet().then(function (rows) {
      var stamp = STAMP(Date.now()) || new Date().toISOString();
      var json = {
        exportedAt: stamp,
        rows: rows.length,
        renders: rows.map(function (r) {
          var rec = r.rec;
          return {
            row: r.label, stamp: r.stamp, ts: rec.ts, kind: rec.kind, file: fileOf(rec), folder: folderOf(rec),
            prompt: rec.prompt || "", sent: rec.sent || "", negative: rec.negative || "",
            seed: rec.seed || 0, guidanceScale: rec.guidanceScale || 0, resolution: rec.resolution || "",
            pose: rec.pose || "", recipe: rec.recipe || "", tags: (rec.tags || []).slice(),
            turn: r.turn, source: r.how, turnSaid: r.what, turnAnswered: r.said,
            herReading: rec.sight || "", note: rec.note || "", bytes: rec.bytes || 0
          };
        })
      };
      var text = "RENDER BOOK\nEXPORTED: " + stamp + "\nROWS: " + rows.length + " \u00b7 EVERY ROW CARRIES THE EXACT RECIPE THE PICTURE WAS MADE FROM\n\n";
      rows.forEach(function (r) { text += rowText(r, true) + "\n\n"; });
      if (typeof opts.download === "function") {
        try {
          opts.download("render_book.json", JSON.stringify(json, null, 2), "application/json");
          opts.download("render_book.txt", text, "text/plain");
        } catch (e) {}
      }
      return { json: json, text: text };
    });
  }
  function labelOf(id) {
    var rows = list();
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i].label;
    return "";
  }
  return {
    list: list, sheet: sheet, find: find, search: search, forHer: forHer,
    byNumber: byNumber, row: row, report: report, describe: describe, redo: redo,
    exportBook: exportBook, parseQuery: parseQuery, rowText: rowText,
    count: function () { return list().length; },
    labelOf: labelOf
  };
}
return { client: client };
})();
