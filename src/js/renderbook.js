/* ------------------------------------------------------------------
   THE RENDER BOOK — every picture this terminal has ever made, with the exact
   recipe that made it.

   Patrikios, 2026-09-21: "What would be cool is if the prompt used to create it
   in this UI was saved to the book too with the artifact image name associated
   to it as well. That way we can retest similar with the seed and the exact
   prompt used. Also include time stamp." ... "I could ask or she could say
   'Remember that image with X?' and she would recall." ... "what about tags or
   keywords related? We could search for all images tagged with X."

   THE VAULT IS THE STORE. A render's record in `window.media` (IndexedDB,
   this browser only) already carries the blob and, since this module's turn,
   the whole recipe: the prompt, the words actually sent to the service, the
   negative list, the seed, the guidance, the size, the pose, the tags and the
   stamp it was stored under. This module is the BOOK over it - those records
   in the order they were made, numbered R1..Rn, cross-referenced against the
   archive (`master_log`, via src/js/gallery.js's principle: the first entry
   that mentions an id is the one that made it) so a row can also say WHICH
   TURN it came from and what was being said when it appeared.

   A number is stable for as long as its picture is in the vault: delete the
   picture and its row goes with it; recycle it and the row keeps its place with
   the new seed. A row is everything needed to make that picture again:

       R12  ·  2026-09-21 14:03:11 MST  ·  MADE IN TURN #37
         prompt: a towering goddess of black glass, cinematic light
         seed 884512 · guidance 7 · 768x512
         tags: #goddess #glass
         file: barbelo_a-towering-goddess_2026-09-21_140311.jpg

   `/renders redo R12` puts that exact recipe back into the forge form, so the
   same picture can be run again - or the seed changed and everything else held
   still, which is how a nearly-right render is tuned.

   SHE READS THE SAME BOOK. A [[SHOW: words or #tag]] line in her reply is a
   real request: the closest rows are found here and put in front of her eyes on
   her next turn (chat.js does the queueing; this module does the finding). So
   "remember that image with the glass cathedral?" has somewhere to land.

   Nothing is stored twice, nothing is uploaded: the book is a VIEW, exactly as
   the gallery is.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var PREFIX = "R";
  // What counts as a render: something the terminal MADE from a prompt or from
  // another picture. A picture he attached or imported is his, not a render of
  // ours, and lives in the gallery's own lanes.
  var MADE = { gen: 1, upscale: 1 };

  function el(id) { return document.getElementById(id); }
  function say(line) { try { if (typeof print === "function") print("SYSTEM", line); } catch (e) {} }
  function kv() { return (window.root && window.root.kv) || null; }

  function stampOf(ts) {
    if (window.logTime && ts) return window.logTime.stamp(ts, { seconds: false });
    return ts ? new Date(ts).toLocaleString() : "";
  }
  function clip(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? (t.slice(0, n) + "\u2026") : t;
  }
  function fileOf(rec) {
    if (window.media && window.media.artifactName) return window.media.artifactName(rec);
    return rec.name || "image";
  }

  /* ---- the rows -------------------------------------------------------- */

  // Every made-thing in the vault, oldest first, numbered. `media.list()` is
  // already stored-order; the tie-break on id keeps the numbering identical
  // between two calls inside the same second.
  function list() {
    var rows = [];
    if (!window.media) return rows;
    window.media.list().forEach(function (id) {
      var rec = window.media.get(id);
      if (!rec || !MADE[rec.kind]) return;
      rows.push({ id: id, rec: rec, ts: rec.ts || 0 });
    });
    rows.sort(function (a, b) { return (a.ts - b.ts) || (String(a.id) < String(b.id) ? -1 : 1); });
    rows.forEach(function (r, i) { r.n = i + 1; r.label = PREFIX + r.n; });
    return rows;
  }

  // Which turn each render came from. The FIRST archive entry that names an id
  // wins - the earliest is the meaningful one (the turn she made it in).
  async function turnMap() {
    var logs = [];
    try {
      var k = kv();
      if (!k) return {};
      logs = await k.sacred_archive.get("master_log") || [];
    } catch (e) { logs = []; }
    var map = {};
    logs.forEach(function (e, i) {
      var silent = !!e.silent || e.kind === "create";
      var note = {
        turn: i + 1, when: e.ts || 0, silent: silent,
        h: e.h == null ? "" : String(e.h), s: e.s == null ? "" : String(e.s)
      };
      (e.gen || []).forEach(function (g) {
        if (g && g.id && !map[g.id]) map[g.id] = note;
      });
    });
    return map;
  }

  function enrich(rows, map) {
    rows.forEach(function (r) {
      var m = map[r.id];
      r.turn = m ? m.turn : 0;
      r.what = m ? m.h : "";
      r.said = m ? m.s : "";
      r.stamp = stampOf(r.rec.ts);
      if (r.rec.kind === "upscale") r.how = "upscaled";
      else if (m && m.silent) r.how = "creation";
      else if (m) r.how = "turn";
      else r.how = "vault";
      r.label = PREFIX + r.n;
    });
    return rows;
  }

  // The book ready to read: rows + turn cross-reference. Everything that
  // prints or searches goes through here.
  async function sheet() {
    if (!window.media) return [];
    try { await window.media.ensure(); } catch (e) { /* an empty vault is not an error */ }
    return enrich(list(), await turnMap());
  }

  /* ---- searching ------------------------------------------------------- */

  // One query language, used by `/renders find`, by the gallery's search box
  // (same rule, see gallery.js) and by her [[SHOW: ...]] line:
  //   #night  ·  tag:night        a tag
  //   seed 884512  ·  seed:884512  that exact seed
  //   turn 37  ·  turn:37          everything made in one turn
  //   anything else                words, ANDed, looked for in the prompt, the
  //                                words sent, the negative list, the tags, the
  //                                file name, the pose - AND in what the two of
  //                                them were saying when it appeared
  function parseQuery(q) {
    var out = { tags: [], folder: "", seed: 0, turn: 0, text: "" };
    var s = String(q == null ? "" : q);
    s = s.replace(/(^|\s)#([a-z0-9][a-z0-9-]{0,31})/gi, function (m, sp, t) { out.tags.push(t.toLowerCase()); return " "; });
    s = s.replace(/\btags?[:=]\s*([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.tags.push(t.toLowerCase()); return " "; });
    // A FOLDER IS A PATH: `folder:/music`, `in:/music`, or a bare `/music`.
    s = s.replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[a-z0-9/_-]*|[a-z0-9][a-z0-9/_-]*)/gi, function (m, p) {
      if (!out.folder && window.media && window.media.normFolder) out.folder = window.media.normFolder(p);
      return " ";
    });
    if (!out.folder) {
      s = s.replace(/(^|\s)(\/[a-z0-9][a-z0-9/_-]*)/gi, function (m, sp, p) {
        if (!out.folder && window.media && window.media.normFolder) out.folder = window.media.normFolder(p);
        return " ";
      });
    }
    s = s.replace(/\bseeds?[:=]?\s*(\d{1,10})\b/gi, function (m, n) { out.seed = Number(n) || 0; return " "; });
    s = s.replace(/\bturns?[:=]?\s*#?(\d{1,5})\b/gi, function (m, n) { out.turn = Number(n) || 0; return " "; });
    out.text = s.replace(/[\s,]+/g, " ").trim().toLowerCase();
    return out;
  }

  function folderOf(rec) {
    return (window.media && window.media.folderOf) ? window.media.folderOf(rec) : "";
  }

  function haystack(r) {
    var rec = r.rec;
    return [
      rec.prompt, rec.sent, rec.negative, rec.name, rec.pose, rec.note, rec.sight,
      (rec.tags || []).join(" "),
      rec.folder || "", folderOf(rec),
      rec.seed ? ("seed " + rec.seed) : "",
      rec.resolution, r.what, r.said, fileOf(rec)
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
      var rec = r.rec;
      if (p.tags.length) {
        var mine = rec.tags || [];
        for (var i = 0; i < p.tags.length; i++) if (mine.indexOf(p.tags[i]) === -1) return false;
      }
      if (p.seed && Number(rec.seed) !== p.seed) return false;
      if (p.turn && Number(r.turn) !== p.turn) return false;
      if (p.folder) {
        var here = folderOf(rec);
        if (here !== p.folder && here.indexOf(p.folder + "/") !== 0) return false;
      }
      if (!terms.length) return true;
      var hay = haystack(r);
      for (var t = 0; t < terms.length; t++) if (hay.indexOf(terms[t]) === -1) return false;
      return true;
    });
    if (terms.length) out = out.slice().sort(function (a, b) { return (scoreOf(b, terms) - scoreOf(a, terms)) || (b.ts - a.ts); });
    else out = newestFirst === false ? out : out.slice().reverse();
    return out;
  }

  // Every search goes through the same sheet, so `turn N` means the same thing
  // here as it does in `/renders turn N` and in her [[SHOW: ...]] line.
  async function find(q, opts) {
    opts = opts || {};
    var rows = matchRows(opts.rows || await sheet(), q, true);
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  async function search(q, opts) { return await find(q, opts); }

  // What she gets. Deliberately the same search he gets - there is one book.
  async function forHer(q, limit) { return await find(q, { limit: limit || 3 }); }

  function byNumber(n, rows) {
    var want = String(n == null ? "" : n).trim().toUpperCase().replace(/^#/, "");
    if (/^\d+$/.test(want)) want = PREFIX + want;
    rows = rows || list();
    for (var i = 0; i < rows.length; i++) if (rows[i].label === want) return rows[i];
    return null;
  }

  // One row, with its turn on it - what `/renders R12` prints.
  async function rowOf(n) { return byNumber(n, await sheet()); }

  /* ---- printing -------------------------------------------------------- */

  function rowText(r, full) {
    var rec = r.rec;
    var bits = [r.label];
    var when = r.stamp || stampOf(rec.ts);
    if (when) bits.push(when);
    var fold = folderOf(rec);
    if (fold) bits.push(fold);
    // An upscale made HERE that retired the render it came from is the row that render used to have:
    // the recipe on it is the same recipe, and the artifact it names is the file that exists now.
    if (rec.kind === "upscale") bits.push(rec.replaced
      ? "UPSCALE - IT REPLACED THE RENDER IT CAME FROM (that render is out of the vault)"
      : "UPSCALE OF A PICTURE ALREADY HERE");
    if (rec.seed) bits.push("seed " + rec.seed);
    if (rec.guidanceScale) bits.push("guidance " + rec.guidanceScale);
    if (rec.resolution) bits.push(rec.resolution);
    var out = bits.join("  \u00b7  ");
    out += "\n  prompt: " + (rec.prompt || "(made without a prompt)");
    if (rec.sent && rec.sent !== rec.prompt) out += "\n  sent: " + rec.sent;
    if (rec.negative) out += "\n  negative: " + rec.negative;
    if (rec.pose) out += "\n  pose: " + rec.pose;
    if (rec.tags && rec.tags.length) out += "\n  tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" ");
    // KEPT IN THE RECORD (src/js/keepsake.js): this row's prompt, negative list, settings and seed
    // are in the RECIPE BOOK under the picture's own name, so the row can be filled from there as
    // well as run from here - `/recipe <ID>` puts it back in the forge with the seed included.
    if (rec.keep && rec.keep.recipe) out += "\n  kept: the recipe book has \"" + rec.keep.recipe + "\"  (/recipe " + rec.keep.recipe + ")"
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

  function report(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) {
      return (opts.head ? opts.head + "\n\n" : "") + "NOTHING IN THE BOOK MATCHES.";
    }
    var limit = opts.limit || rows.length;
    var head = opts.head || ("THE RENDER BOOK :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S")
      + (rows.length > limit ? " \u00b7 THE NEWEST " + limit : "") + " \u00b7 EACH ONE CARRIES THE EXACT RECIPE IT WAS MADE FROM");
    return head + "\n\n" + rows.slice(0, limit).map(function (r) { return rowText(r, opts.full); }).join("\n\n");
  }

  function describe() {
    var rows = list();
    var renders = 0, upscales = 0, seeds = 0, first = 0, newest = 0;
    rows.forEach(function (r) {
      if (r.rec.kind === "upscale") upscales++; else renders++;
      if (r.rec.seed) seeds++;
      if (!first || r.ts < first) first = r.ts;
      if (r.ts > newest) newest = r.ts;
    });
    var tags = window.media ? window.media.allTags() : [];
    var out = ["THE RENDER BOOK :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S")
      + " (" + renders + " RENDER" + (renders === 1 ? "" : "S") + " \u00b7 " + upscales + " UPSCALE" + (upscales === 1 ? "" : "S") + ")"
      + " \u00b7 " + seeds + " WITH A SEED ON THE RECORD \u00b7 KEPT IN THIS BROWSER"];
    if (first) out.push("  FIRST: " + stampOf(first) + "   \u00b7   NEWEST: " + stampOf(newest));
    out.push("  EVERY ROW CARRIES THE EXACT PROMPT, THE WORDS SENT, THE NEGATIVE LIST, THE SEED, THE GUIDANCE, THE SIZE AND THE STAMP IT WAS STORED UNDER - THE WHOLE RECIPE, SO A PICTURE CAN BE MADE AGAIN. THE ROW ALSO SAYS WHICH TURN IT CAME FROM AND WHAT WAS BEING SAID.");
    out.push("  ROWS ARE NUMBERED R1..R" + rows.length + " IN THE ORDER THEY WERE MADE. ROW NUMBERS DO NOT MOVE WHILE THEIR PICTURE IS IN THE VAULT.");
    out.push("  /renders \u00b7 /renders all \u00b7 /renders find <WORDS> \u00b7 /renders tag <TAG> \u00b7 /renders seed <N> \u00b7 /renders turn <N> \u00b7 /renders R12 (one row in full) \u00b7 /renders redo R12 (that exact recipe back in the forge) \u00b7 /renders export");
    out.push("  TAGS: " + (tags.length
      ? tags.length + " IN USE :: " + tags.slice(0, 18).map(function (t) { return "#" + t.tag + "(" + t.count + ")"; }).join(" ")
        + (tags.length > 18 ? " \u00b7 /gallery find #<TAG>" : "")
      : "none yet - a tag is hung on a picture in the gallery's full stage (click a picture), and then #it finds every picture that carries it"));
    var folders = (window.media && window.media.allFolders) ? window.media.allFolders() : [];
    if (folders.length) {
      out.push("  FOLDERS: " + folders.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  ")
        + "  \u00b7  /renders folder /music FINDS ONE, /folder LISTS THEM ALL");
    }
    out.push("  SHE READS THIS BOOK TOO: a [[SHOW: words or #tag]] line in her reply brings the closest rows to her eyes on her next turn.");
    return out.join("\n");
  }

  /* ---- redo ------------------------------------------------------------ */

  // Put a row's exact recipe back into the forge form - the whole point of the
  // book. Nothing is rendered: he gets the form loaded, with the pose slot and
  // the guidance and the size, and then decides whether to run it as it was or
  // change the seed and run it again.
  async function redo(n) {
    var row = byNumber(n);
    if (!row) return { ok: false, error: "NO ROW " + String(n || "").toUpperCase() + " IN THE BOOK - /renders LISTS THE NUMBERS." };
    var rec = row.rec;
    if (!rec.prompt) return { ok: false, error: row.label + " WAS NOT MADE FROM A PROMPT, SO THERE IS NOTHING TO RUN AGAIN." };
    if (typeof forge === "undefined" || !forge) return { ok: false, error: "THE FORGE FORM IS NOT LOADED HERE." };
    var defaultGuidance = (typeof DEFAULT_GUIDANCE === "number") ? DEFAULT_GUIDANCE : 7;
    var defaultRes = (typeof LIA_IMAGE_RESOLUTION === "string") ? LIA_IMAGE_RESOLUTION : "768x512";
    forge.prompt = rec.prompt;
    forge.negative = rec.negative || "";
    forge.seed = rec.seed ? String(rec.seed) : "";
    forge.guidance = rec.guidanceScale || defaultGuidance;
    var res = rec.resolution || ((rec.w && rec.h) ? (rec.w + "x" + rec.h) : "");
    if (/^(512x512|512x768|768x512|768x768)$/.test(res)) forge.resolution = res;
    else forge.resolution = defaultRes;
    if (rec.pose && window.forgeBook && window.forgeBook.setPose) window.forgeBook.setPose(rec.pose, { write: false });
    if (typeof openForge === "function") openForge();
    return { ok: true, row: row, seed: rec.seed || 0 };
  }

  /* ---- export ---------------------------------------------------------- */

  function download(name, body, mime) {
    var blob = new Blob([body], { type: mime || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  async function exportBook() {
    var rows = await sheet();
    var stamp = window.logTime ? window.logTime.stamp() : new Date().toISOString();
    var json = {
      generator: (typeof window.generatorName === "string" ? window.generatorName : ""),
      exportedAt: stamp,
      zone: (window.logTime ? window.logTime.zoneNow() : ""),
      rows: rows.length,
      renders: rows.map(function (r) {
        var rec = r.rec;
        return {
          row: r.label, stamp: r.stamp, ts: rec.ts, kind: rec.kind, file: fileOf(rec),
          folder: folderOf(rec),
          prompt: rec.prompt || "", sent: rec.sent || "", negative: rec.negative || "",
          seed: rec.seed || 0, guidanceScale: rec.guidanceScale || 0, resolution: rec.resolution || "",
          pose: rec.pose || "", recipe: rec.recipe || "", tags: (rec.tags || []).slice(),
          turn: r.turn, source: r.how, turnSaid: r.what, turnAnswered: r.said,
          herReading: rec.sight || "", note: rec.note || "", bytes: rec.bytes || 0
        };
      })
    };
    var text = "LIA RENDER BOOK\n"
      + "EXPORTED: " + stamp + "\n"
      + "ROWS: " + rows.length + " \u00b7 EVERY ROW CARRIES THE EXACT RECIPE THE PICTURE WAS MADE FROM\n\n";
    rows.forEach(function (r) { text += rowText(r, true) + "\n\n"; });
    download("render_book_" + Date.now() + ".json", JSON.stringify(json, null, 2), "application/json");
    download("render_book_" + Date.now() + ".txt", text, "text/plain");
    say("RENDER BOOK EXPORTED :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S") + ", JSON AND TEXT, IN THIS MACHINE'S DOWNLOADS FOLDER. NOTHING WAS UPLOADED.");
    return json;
  }

  /* ---- the book, as an object ------------------------------------------ */

  window.renderBook = {
    list: list, sheet: sheet, find: find, search: search, forHer: forHer,
    byNumber: byNumber, row: rowOf, report: report, describe: describe, redo: redo,
    exportBook: exportBook, parseQuery: parseQuery, rowText: rowText,
    count: function () { return list().length; },
    // The one-line answer to "what is this picture, in the book's terms".
    labelOf: function (id) {
      var rows = list();
      for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i].label;
      return "";
    }
  };
})();
