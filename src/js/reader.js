/* ------------------------------------------------------------------
   THE READER — read-only access to everything saved here.

   Patrikios, 2026-09-21: "She must have at least read-only access for now
   across all data saved here."

   She already had two windows onto the record: what she recalls (the LOREPACK,
   retrieved every turn) and what she is shown (the vault, through her eyes).
   This module is the third one, and it is the one he asked for: a way for HER
   to look something up in everything this terminal keeps, on purpose, in her
   own words - and the same door for him, so what she reads can always be read
   back.

       [[READ: folders]]                 the folder tree, with what is in each
       [[READ: folder /music]]           what is filed in one folder
       [[READ: vault]]                   the newest things in the vault
       [[READ: archive <WORDS>]]         past turns, by their words
       [[READ: turn 203]]                one turn, in full
       [[READ: memory <WORDS>]]          the LOREPACK, by words
       [[READ: renders <WORDS|R12>]]     the render book and its exact recipes
       [[READ: tags]]                    every tag in the vault
       [[READ: wants]] / [[READ: hers]]  her own keeping
       [[READ: likes]]                  what you have marked good, and what you passed on
       [[READ: stats]]                   how much is here at all
       [[READ: <WORDS>]]                 everywhere at once

   NOTHING HERE WRITES. Reading a folder, a turn, a picture's recipe or her own
   memory changes no record, moves no file and deletes nothing - the only writes
   on her side of the glass are the ones she already had ([[REMEMBER: ...]],
   [[WANT: ...]]) plus [[FOLDER: ...]] and [[FILE: ...]], which make a folder and
   file what the terminal MADE into it (src/js/vault.js). Anything Patrikios
   handed over himself is his to file.

   An answer is put in front of her on her NEXT turn (the READ block in the
   prompt, built by chat.js from `block()`), so the read costs nothing until
   she actually asks - and the turn is archived with what she asked to read.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var KEY = "unseen_reads";
  var PENDING_MAX = 4;      // reads waiting to reach her prompt
  var SNIPPET = 200;        // chars of a memory fragment / vault prompt shown
  var TURN_FULL = 900;      // chars of one side of a turn, for [[READ: turn N]]

  var pending = [];         // [{ q, title, text, ts }] - answered, waiting for her turn
  var loaded = false;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  function lore() { return window.lore || null; }
  function media() { return window.media || null; }

  function clip(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? (t.slice(0, n) + "\u2026") : t;
  }
  function stampOf(ts) {
    if (window.logTime && ts) return window.logTime.stamp(ts, { seconds: false });
    return ts ? new Date(ts).toLocaleString() : "";
  }
  function n2(n) { return (n < 10 ? "0" : "") + n; }

  // How much of the record one read may bring back. Hers is the tighter one: a read is something
  // she asked for, not a dump, and the prompt it lands in is the one she answers from.
  function lim(her) {
    return her
      ? { turns: 4, turnChars: 200, renders: 5, vault: 8, memory: 3, snippets: 3 }
      : { turns: 8, turnChars: 420, renders: 24, vault: 30, memory: 8, snippets: 8 };
  }

  function normQuery(raw) {
    return String(raw == null ? "" : raw).replace(/\[\[|\]\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  }

  /* ---- the archive ------------------------------------------------------- */

  async function readLog() {
    try {
      if (!window.root.kv) return [];
      return await window.root.kv.sacred_archive.get("master_log") || [];
    } catch (e) { return []; }
  }
  function isCreation(e) { return !!(e && (e.silent || e.kind === "create")); }
  function side(e, which) {
    if (isCreation(e)) return which === "h" ? (e.h || "[an image was made]") : "[a thing made, not a turn]";
    return String((which === "h" ? e.h : e.s) == null ? "" : (which === "h" ? e.h : e.s));
  }

  // Words find turns the way /search does, but ranked: every turn that carries any of the words is
  // a hit, the ones carrying more of them come first, and the newest breaks the tie.
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
    var out = "  #" + hit.n + (stampOf(e.ts) ? "  " + stampOf(e.ts) : "")
      + (e.role ? "  (" + String(e.role).toUpperCase() + ")" : "  (OFF STAGE)");
    out += "\n      Patrikios: " + clip(side(e, "h"), chars);
    out += "\n      LIA: " + clip(side(e, "s"), chars);
    return out;
  }

  async function archiveReport(q, L) {
    var logs = await readLog();
    var words = String(q || "").trim();
    if (!words) {
      return { ok: true, title: "THE ARCHIVE", text: logs.length
        ? logs.length + " TURN" + (logs.length === 1 ? "" : "S") + " KEPT, from " + stampOf(logs[0].ts) + " to " + stampOf(logs[logs.length - 1].ts)
          + ".\n  Newest:\n" + logs.slice(-4).map(function (e, i, a) { return turnLines({ n: logs.length - (a.length - i), e: e }, L.turnChars); }).join("\n")
          + "\n  Read one with [[READ: turn <NUMBER>]], or search them with [[READ: archive <WORDS>]]."
        : "THE ARCHIVE IS EMPTY - nothing has been said here yet." };
    }
    var one = words.match(/^(?:turn|#)\s*#?(\d{1,5})$/i);
    if (one) {
      var n = parseInt(one[1], 10);
      if (!logs[n - 1]) return { ok: false, error: "THERE IS NO TURN #" + n + " - THE RECORD HOLDS " + logs.length + "." };
      var e = logs[n - 1];
      return { ok: true, title: "TURN #" + n, text: turnLines({ n: n, e: e }, TURN_FULL) };
    }
    var hits = turnHits(logs, words, L.turns);
    if (!hits.length) return { ok: false, error: "NOTHING IN THE ARCHIVE SAYS THAT. IT HOLDS " + logs.length + " TURNS." };
    return {
      ok: true, title: "THE ARCHIVE :: \"" + words.toUpperCase() + "\" :: " + hits.length + " TURN" + (hits.length === 1 ? "" : "S"),
      text: hits.map(function (h) { return turnLines(h, L.turnChars); }).join("\n")
    };
  }

  /* ---- the vault, its folders and its tags -------------------------------- */

  function kindWord(rec) {
    if (!rec) return "item";
    if (rec.kind === "video") return "clip";
    if (rec.kind === "upscale") return "upscaled picture";
    if (rec.kind === "gen") return "picture she made";
    if (/^audio\//.test(String(rec.mime || ""))) return "music";
    return "picture";
  }
  function vaultLine(id, rec) {
    var M = media();
    var name = rec.prompt ? clip(rec.prompt, SNIPPET) : String(rec.name || "image");
    return "  [" + stampOf(rec.ts) + "] " + (M ? M.folderOf(rec) : "") + "  \u00b7  " + kindWord(rec)
      + "  \u00b7  " + name
      + (rec.tags && rec.tags.length ? "  \u00b7  " + rec.tags.map(function (t) { return "#" + t; }).join(" ") : "");
  }

  async function foldersReport(L) {
    var M = media();
    if (!M) return { ok: false, error: "THE VAULT IS OFFLINE." };
    await M.ensure();
    var list = M.allFolders();
    var st = M.stats();
    var out = "THE FOLDERS OF THE VAULT :: " + list.length + " FOLDER" + (list.length === 1 ? "" : "S")
      + " HOLDING " + st.count + " ITEM" + (st.count === 1 ? "" : "S") + ".";
    list.forEach(function (f) {
      out += "\n  " + f.path + "  (" + f.count + (f.count === 1 ? " item" : " items") + ")" + (f.made ? "" : "  - a default");
    });
    out += "\n  A folder is a path: /images, /music, /clips, /images/portraits."
      + "\n  Read one with [[READ: folder /music]]; make one with [[FOLDER: /name]]; file pictures the terminal made into one with [[FILE: /name]].";
    return { ok: true, title: "THE FOLDERS", text: out };
  }

  async function folderReport(path, L) {
    var M = media();
    if (!M) return { ok: false, error: "THE VAULT IS OFFLINE." };
    var p = M.normFolder(path);
    if (!p) return { ok: false, error: "WHICH FOLDER? NAME A PATH, LIKE /music." };
    await M.ensure();
    var ids = M.list().filter(function (id) {
      var f = M.folderOf(M.get(id));
      return f === p || f.indexOf(p + "/") === 0;
    });
    var out = "FOLDER " + p + " :: " + ids.length + " ITEM" + (ids.length === 1 ? "" : "S") + ".";
    if (!ids.length) {
      out += "\n  Nothing is filed here yet. " + (M.folderExists(p) ? "The folder itself exists." : "The folder does not exist - [[FOLDER: " + p + "]] makes it.");
      return { ok: true, title: "FOLDER " + p, text: out };
    }
    ids.slice(-L.vault).reverse().forEach(function (id) { out += "\n" + vaultLine(id, M.get(id)); });
    if (ids.length > L.vault) out += "\n  \u2026 and " + (ids.length - L.vault) + " more.";
    return { ok: true, title: "FOLDER " + p + " :: " + ids.length, text: out };
  }

  async function vaultReport(q, L) {
    var M = media();
    if (!M) return { ok: false, error: "THE VAULT IS OFFLINE." };
    await M.ensure();
    var ids = M.list();
    var words = String(q || "").trim().toLowerCase();
    if (words) {
      var terms = words.split(/\s+/).filter(Boolean);
      ids = ids.filter(function (id) {
        var r = M.get(id);
        var hay = [r.prompt, r.sent, r.name, r.note, r.sight, M.folderOf(r), (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    var out = "THE VAULT :: " + ids.length + " ITEM" + (ids.length === 1 ? "" : "S") + (words ? " MATCHING \"" + words.toUpperCase() + "\"" : "") + ".";
    if (!ids.length) return { ok: true, title: "THE VAULT", text: out + "\n  Nothing matches." };
    ids.slice(-L.vault).reverse().forEach(function (id) { out += "\n" + vaultLine(id, M.get(id)); });
    if (ids.length > L.vault) out += "\n  \u2026 and " + (ids.length - L.vault) + " more.";
    return { ok: true, title: "THE VAULT :: " + ids.length, text: out };
  }

  function tagsReport(L) {
    var M = media();
    var tags = M ? M.allTags() : [];
    if (!tags.length) return { ok: true, title: "TAGS", text: "NO PICTURE IN THE VAULT CARRIES A TAG YET." };
    return { ok: true, title: "TAGS", text: "TAGS IN THE VAULT :: " + tags.length + " IN USE\n  "
      + tags.map(function (t) { return "#" + t.tag + " (" + t.count + ")"; }).join("  \u00b7  ") };
  }

  /* ---- her memory, and her own keeping ------------------------------------ */

  function memoryReport(q, L) {
    var L0 = lore();
    if (!L0) return { ok: false, error: "HER MEMORY IS OFFLINE." };
    var words = String(q || "").trim();
    if (!words) {
      var files = L0.files();
      return { ok: true, title: "HER MEMORY", text: "THE LOREPACK :: " + files.length + " DOCUMENT" + (files.length === 1 ? "" : "S")
        + " / " + L0.count() + " FRAGMENT" + (L0.count() === 1 ? "" : "S") + ".\n  "
        + files.slice(0, 24).map(function (f) { return f.name + " (" + f.chunks + ")" + (f.origin === "hers" ? " [HERS]" : ""); }).join("  \u00b7  ")
        + (files.length > 24 ? "\n  \u2026 and " + (files.length - 24) + " more (/lore lists them all)." : "")
        + "\n  Read a passage with [[READ: memory <WORDS>]]." };
    }
    var hits = [];
    try { hits = L0.search(words, L.memory); } catch (e) { hits = []; }
    if (!hits.length) return { ok: false, error: "NOTHING IN HER MEMORY MATCHES \"" + words.toUpperCase() + "\"." };
    return { ok: true, title: "HER MEMORY :: \"" + words.toUpperCase() + "\"",
      text: hits.map(function (h) {
        return "  " + h.file + (h.heading ? " :: " + h.heading : "") + "\n      " + clip(h.text, 300);
      }).join("\n") };
  }

  function wantsReport() {
    if (!window.hers) return { ok: false, error: "HER OWN KEEPING IS OFFLINE." };
    return { ok: true, title: "WHAT SHE WANTS CARRIED", text: clip(String(window.hers.reportWants() || ""), 1800) };
  }

  // THE HEART (src/js/likes.js) - what Patrikios has marked good and what he has passed on. It is
  // his taste, kept on the pictures themselves, and it is handed to her every turn (the same list,
  // a little of it at a time); this is the door for reading the whole of it on purpose.
  function likesReport() {
    if (!window.likes) return { ok: false, error: "THE HEART IS OFFLINE (src/js/likes.js)." };
    return { ok: true, title: "WHAT HE HAS MARKED", text: clip(String(window.likes.report() || ""), 2200) };
  }

  async function hersReport() {
    if (!window.hers) return { ok: false, error: "HER OWN KEEPING IS OFFLINE." };
    var t = "";
    try { t = String(await window.hers.reportMemories() || ""); } catch (e) { t = ""; }
    return { ok: true, title: "HER OWN MEMORY", text: clip(t, 1800) };
  }

  /* ---- the render book ---------------------------------------------------- */

  async function rendersReport(q, L) {
    var RB = window.renderBook;
    if (!RB) return { ok: false, error: "THE RENDER BOOK IS OFFLINE." };
    var words = String(q || "").trim();
    if (/^r?\d{1,4}$/i.test(words.replace(/^#/, ""))) {
      var row = await RB.row(words);
      return row ? { ok: true, title: "RENDER BOOK :: " + row.label, text: RB.rowText(row, true) }
        : { ok: false, error: "NO ROW " + words.toUpperCase() + " IN THE BOOK." };
    }
    var rows = words ? await RB.find(words, { limit: L.renders }) : (await RB.sheet()).slice().reverse().slice(0, L.renders);
    if (!rows.length) return { ok: false, error: "NOTHING IN THE RENDER BOOK MATCHES \"" + words.toUpperCase() + "\"." };
    return { ok: true, title: "THE RENDER BOOK" + (words ? " :: \"" + words.toUpperCase() + "\"" : "") + " :: " + rows.length + " ROW" + (rows.length === 1 ? "" : "S"),
      text: "Every picture made here, with the exact recipe that made it.\n" + rows.map(function (r) { return RB.rowText(r, false); }).join("\n") };
  }

  /* ---- everything at once ------------------------------------------------- */

  async function statsReport() {
    var M = media();
    var files = lore() ? lore().files() : [];
    var herDocs = files.filter(function (f) { return f.origin === "hers"; });
    var logs = await readLog();
    var out = "WHAT IS SAVED HERE";
    out += "\n  VAULT :: " + (M ? M.stats().count : 0) + " ITEM" + (M && M.stats().count === 1 ? "" : "S")
      + " in " + (M ? M.allFolders().length : 0) + " FOLDER" + (M && M.allFolders().length === 1 ? "" : "S");
    out += "\n  ARCHIVE :: " + logs.length + " TURN" + (logs.length === 1 ? "" : "S") + " KEPT";
    out += "\n  HER MEMORY :: " + files.length + " DOCUMENT" + (files.length === 1 ? "" : "S")
      + (herDocs.length ? " (" + herDocs.length + " OF THEM HERS)" : "")
      + " / " + (lore() ? lore().count() : 0) + " FRAGMENT" + (lore() && lore().count() === 1 ? "" : "S");
    out += "\n  THE RENDER BOOK :: " + (window.renderBook ? window.renderBook.count() : 0) + " ROW" + (window.renderBook && window.renderBook.count() === 1 ? "" : "S")
      + " - EVERY PICTURE MADE HERE WITH ITS EXACT RECIPE";
    if (window.hers) out += "\n  HER OWN KEEPING :: " + window.hers.memoryCount() + " MEMOR" + (window.hers.memoryCount() === 1 ? "Y" : "IES")
      + " KEPT, " + window.hers.wants().length + " WANT" + (window.hers.wants().length === 1 ? "" : "S") + " CARRIED";
    out += "\n  ALL OF IT LIVES ON THIS MACHINE (IndexedDB) AND NONE OF IT IS UPLOADED.";
    out += "\n  [[READ: folders | vault | archive <words> | turn <N> | memory <words> | renders <words> | tags | likes | wants | hers]].";
    return { ok: true, title: "WHAT IS SAVED HERE", text: out };
  }

  // The default read: the words, looked for in every surface at once. Sections that find nothing
  // are left out, so an answer is as long as what actually answered it.
  async function everywhereReport(q, L) {
    var sections = [];
    try {
      var a = await archiveReport(q, L);
      if (a.ok && a.text) sections.push("IN THE ARCHIVE OF TURNS:\n" + a.text);
    } catch (e) { }
    try {
      var m = memoryReport(q, L);
      if (m.ok && m.text) sections.push("IN HER MEMORY:\n" + m.text);
    } catch (e) { }
    try {
      var r = await rendersReport(q, L);
      if (r.ok && r.text) sections.push("IN THE RENDER BOOK:\n" + r.text);
    } catch (e) { }
    try {
      var v = await vaultReport(q, L);
      if (v.ok && v.text) sections.push("IN THE VAULT:\n" + v.text);
    } catch (e) { }
    if (!sections.length) {
      return { ok: false, error: "NOTHING ANYWHERE HERE MATCHES \"" + q.toUpperCase() + "\". THE RECORD HOLDS " + (await readLog()).length + " TURNS, "
        + ((lore() ? lore().count() : 0)) + " MEMORY FRAGMENTS AND " + (media() ? media().stats().count : 0) + " VAULT ITEMS." };
    }
    return { ok: true, title: "\"" + q.toUpperCase() + "\" :: EVERYWHERE IT MATCHES", text: sections.join("\n\n") };
  }

  /* ---- the one door ------------------------------------------------------- */

  // Read one thing. `opts.her` bounds how much comes back (she asked; the answer goes into the
  // prompt she writes her next reply from).
  async function answer(raw, opts) {
    opts = opts || {};
    var L = lim(!!opts.her);
    var q = normQuery(raw);
    var M = media();
    if (M) { try { await M.ensure(); } catch (e) { } }
    var head = "", rest = q;
    var m = q.match(/^([a-z]+)\s*[:]?\s*([\s\S]*)$/i);
    if (m) { head = m[1].toLowerCase(); rest = m[2].trim(); }
    try {
      if (/^(folders?|dirs?)$/.test(head) && (!rest || /^s?$/.test(rest))) {
        return rest ? await folderReport(rest, L) : await foldersReport(L);
      }
      if (/^(folder|dir|in)$/.test(head) && rest) return await folderReport(rest, L);
      if (head === "vault" || head === "media") return await vaultReport(rest, L);
      if (head === "archive" || head === "turns" || head === "history" || head === "search") return await archiveReport(rest, L);
      if (head === "turn") return await archiveReport("turn " + rest, L);
      if (head === "memory" || head === "lore" || head === "remember") return memoryReport(rest, L);
      if (head === "renders" || head === "render" || head === "book") return await rendersReport(rest, L);
      if (head === "tags" || head === "tag") return tagsReport(L);
      if (head === "wants" || head === "carry") return wantsReport();
      if (head === "hers" || head === "kept") return await hersReport();
      if (head === "likes" || head === "like" || head === "hearts" || head === "heart" || head === "taste" || head === "marked") return likesReport();
      if (head === "stats" || head === "status" || head === "everything") return await statsReport();
      if (!q) return await statsReport();
      return await everywhereReport(q, L);
    } catch (e) {
      return { ok: false, error: "THE READ FAILED :: " + String((e && e.message) ? e.message : e) };
    }
  }

  async function forHer(raw) { return await answer(raw, { her: true }); }

  // WHAT DOES "something" MEAN, when she (or he) names a picture to file? The same three ways the
  // rest of the terminal uses, in the same order: a row of the book (R12), a vault id, a #tag, or
  // words - and words are looked for in the render book first, then in the vault. `onlyMade` is her
  // side of the glass: nothing Patrikios handed over is hers to file.
  async function targets(what, opts) {
    opts = opts || {};
    var M = media();
    var spec = String(what || "").trim();
    var out = [];
    if (!spec) return { ids: [], label: "" };
    if (M && M.get(spec)) return { ids: [spec], label: spec };
    if (window.renderBook && /^#?r?\d{1,4}$/i.test(spec)) {
      var row = null;
      try { row = await window.renderBook.row(spec); } catch (e) { row = null; }
      if (row) return { ids: [row.id], label: row.label };
    }
    var tag = spec.match(/^#([a-z0-9][a-z0-9-]{0,31})$/i);
    if (tag && M) {
      var want = M.normTag(tag[1]);
      var ids = M.list().filter(function (id) {
        var r = M.get(id);
        return r && (r.tags || []).indexOf(want) !== -1;
      });
      if (opts.max) ids = ids.slice(-opts.max);
      return { ids: filterMade(ids, opts), label: "#" + want };
    }
    if (window.renderBook) {
      try {
        var rows = await window.renderBook.find(spec, { limit: opts.max || 8 });
        rows.forEach(function (r) { if (out.indexOf(r.id) === -1) out.push(r.id); });
      } catch (e) { }
    }
    if (!out.length && M) {
      var terms = spec.toLowerCase().split(/\s+/).filter(Boolean);
      M.list().forEach(function (id) {
        var r = M.get(id);
        if (!r) return;
        var hay = [r.prompt, r.name, r.note, r.sight, M.folderOf(r), (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
        if (terms.every(function (t) { return hay.indexOf(t) !== -1; })) out.push(id);
      });
      if (opts.max) out = out.slice(-opts.max);
    }
    return { ids: filterMade(out, opts), label: spec };
  }

  function filterMade(ids, opts) {
    if (!opts || !opts.onlyMade) return ids;
    var M = media();
    return ids.filter(function (id) {
      var r = M && M.get(id);
      return r && (r.kind === "gen" || r.kind === "upscale");
    });
  }

  /* ---- what waits for her turn -------------------------------------------- */

  async function load() {
    var s = kv();
    var list = [];
    if (s) {
      try {
        var v = await s.get(KEY);
        if (Array.isArray(v)) list = v;
      } catch (e) { console.warn("reads unreadable", e); }
    }
    pending = list.filter(function (p) { return p && typeof p.text === "string" && typeof p.q === "string"; })
      .slice(-PENDING_MAX);
    loaded = true;
    return pending.slice();
  }

  async function save() {
    var s = kv(); if (!s) return;
    try { await s.set(KEY, pending.slice(-PENDING_MAX)); } catch (e) { console.warn("reads not saved", e); }
  }

  async function queue(items) {
    if (!loaded) await load();
    (items || []).forEach(function (p) {
      if (!p || !p.text) return;
      pending.push({ q: String(p.q || ""), title: String(p.title || ""), text: String(p.text), ts: p.ts || Date.now() });
    });
    pending = pending.slice(-PENDING_MAX);
    await save();
    return pending.slice();
  }

  async function clear() { pending = []; await save(); return true; }
  function listPending() { return pending.slice(); }

  // The block her next prompt carries. It says what it is plainly: this is the record, she asked
  // for it, and reading it changed nothing.
  function block() {
    if (!pending.length) return "";
    var body = pending.map(function (p) {
      return "\"" + p.q + "\"\n" + p.text;
    }).join("\n\n");
    return "You asked to read the record, and this is what it says. This is what is kept here on his machine - read it as the account it is, not as a document to quote, and never mention that anything was handed to you. Nothing was changed by your reading it:\n<read>\n"
      + body + "\n</read>";
  }

  async function take() { var p = pending.slice(); await clear(); return p; }

  /* ---- the terminal's own door (/read, /help read) ------------------------ */

  function describe() {
    var M = media();
    var st = M ? M.stats() : { count: 0 };
    var folders = M ? M.allFolders() : [];
    var out = ["THE READER :: READ-ONLY ACCESS TO EVERYTHING SAVED HERE",
      "  SHE READS WITH A LINE IN HER REPLY: [[READ: <WHAT>]] - the answer is put in front of her on her NEXT turn, and this turn is archived with what she asked to read.",
      "  YOU READ THE SAME WAY, FROM HERE: /read <WHAT>",
      "  WHAT: folders \u00b7 folder /music \u00b7 vault \u00b7 archive <WORDS> \u00b7 turn <N> \u00b7 memory <WORDS> \u00b7 renders <WORDS|R12> \u00b7 tags \u00b7 likes \u00b7 wants \u00b7 hers \u00b7 stats \u00b7 <WORDS> (everywhere at once)"];
    out.push("  THE VAULT :: " + st.count + " ITEM" + (st.count === 1 ? "" : "S") + " in " + folders.length + " FOLDER" + (folders.length === 1 ? "" : "S")
      + " :: " + folders.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  "));
    out.push("  READING WRITES NOTHING. She cannot delete, move or overwrite anything in the vault, the archive or her memory - she may MAKE FOLDERS ([[FOLDER: /name]]) and FILE PICTURES THE TERMINAL MADE into them ([[FILE: /name]]), and nothing you handed over yourself is hers to move.");
    return out.join("\n");
  }

  async function report(raw) {
    var r = await answer(raw, {});
    if (!r.ok) return String(r.error || "THE READ FAILED.");
    return (r.title ? r.title + "\n" : "") + r.text;
  }

  window.reader = {
    answer: answer, forHer: forHer, report: report, describe: describe, targets: targets,
    load: load, queue: queue, clear: clear, take: take, pending: listPending, block: block,
    folders: function () { return media() ? media().allFolders() : []; },
    PENDING_MAX: PENDING_MAX,
  };
})();
