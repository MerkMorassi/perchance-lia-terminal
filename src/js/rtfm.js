window.rtfm = (function () {
  "use strict";

  /* THE RTFM - READ THE FRIENDLY MANUAL.

     WHAT IT IS
     The terminal carries out a great many commands, and a command list is not a manual: /help
     prints the roster and /help <TOPIC> goes deeper on one area, but neither of them explains the
     whole machine in a page you can read (or hand to someone). So the manual is a PACK OF
     DOCUMENTS, the way her memory is a pack of documents:

       src/rtfm/rtfm.json    the manifest (which documents exist)
       src/rtfm/*.md         the documents themselves, markdown
       src/js/rtfm.js        this reader

     `src/rtfm/README.md` is the recipe for adding one. Everything in that folder is PUBLIC and it
     ships with the generator - so nothing private goes in it, ever.

     THEY ARE FOR HIM, NOT FOR HER. The LOREPACK is what she remembers; the RTFM is the manual for
     the machine she runs on. Nothing here is indexed, retrieved, or handed to her in a turn, and
     nothing here writes to her memory. Keep that true: a manual is not a memory.

     THE CHEATSHEET IS GENERATED, AND THE TERMINAL IS THE GENERATOR
     `src/rtfm/commands.md` is not written by hand. It is rendered from the live command list
     (`src/commands/commands.json`, read by src/js/commands.js), which is the ONE place a command
     is declared - so the cheatsheet cannot drift away from the commands that actually exist. Two
     consequences worth knowing:

       - `/rtfm cheatsheet` renders it RIGHT NOW, from the list, and prints that. The terminal never
         shows a stale cheatsheet.
       - `/rtfm check` fetches the shipped copy and compares it, byte for byte, against that same
         render - and names the first line that differs. That is the whole staleness story: the file
         is a copy, the list is the truth, and the check says when the copy has fallen behind.
       - `/rtfm export` downloads a fresh copy (or any document) as a file, so the copy can be
         refreshed from inside the terminal without a build step.

     THE MARKDOWN
     The documents are markdown, and a terminal is a monospace window rather than a browser. So this
     reader renders as much markdown as a terminal can honestly show - headings become ruled
     banners, tables become aligned columns, lists become bullets with the indentation kept, code
     fences pass through untouched, and the inline markers (**bold**, `code`, [text](url)) are
     unwrapped because the emphasis is not worth the punctuation. It is deliberately small: it
     understands the subset the documents are written in, and anything it does not understand is
     printed as it stands rather than swallowed.

     WHAT IT IS NOT
     Not a second /help. `/help` is the roster of every command; `/rtfm <COMMAND>` is one command's
     page - usage, kind, and the whole description exactly as the list holds it. The two read the
     same source and cannot disagree.

     WRITING ONE FROM THE TERMINAL
     The pack is not read-only. `/rtfm new` and `/rtfm edit <DOC>` open the editor (src/js/rtfm-edit.js)
     over the terminal, and what it saves is kept in THIS BROWSER - kv, the same store everything else
     of his is kept in - never in src/: nothing on this page can write a file into the generator, and a
     page he writes is his, on this device, until he chooses to export it and drop it in src/rtfm/.

     A document written here under a SHIPPED document's name SHADOWS it, the way an edited role layer
     shadows the shipped one (roles.js): the shipped file is untouched, `/rtfm <DOC>` prints his copy,
     and `/rtfm rm <DOC>` (or the editor's REVERT) puts the shipped file back in force. So the folder
     in src/ is the shipped truth and these are the overrides on top of it, kept where his other work
     is kept.

     Exports: run, list, doc, commandPage, cheatsheetMarkdown, check, export, describe, status,
     docs, cheatsheet, read, save, drop, mine, slug, storage.       */

  var DIR = "src/rtfm/";
  var MANIFEST = DIR + "rtfm.json";
  var LOCAL_KEY = "rtfm_local"; // kv (lia_settings): the documents written on THIS device
  var MAX_BODY = 400000;        // a page that needs more than this is not a manual page
  var MAX_DOCS = 200;

  var shipped = [];            // the manifest's documents, in order
  var local = null;            // { id: record } - written here, kept here
  var docs = [];               // shipped + local, resolved: what everything else reads
  var report = null;           // { loaded, count, failed }
  var loadP = null;

  function norm(s) { return String(s == null ? "" : s).trim(); }
  function upper(s) { return norm(s).toUpperCase(); }
  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function rule(ch, n) { var s = ""; while (s.length < n) s += ch; return s; }

  // ---- markdown, as much of it as a terminal can show ----------------------

  // The inline markers, unwrapped. Order matters: images before links, bold before italic (so the
  // second star of ** is not read as an italic opening), and the italic forms only where they start
  // at a word boundary - otherwise `2 * 3 * 4` in a line of prose loses its arithmetic.
  function inline(s) {
    return String(s == null ? "" : s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 <$2>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 <$2>")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
      .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
      .replace(/\s+$/, "");
  }

  // A greedy wrap that keeps the indent on every line after the first, so a long glossary entry
  // reads as one entry instead of drifting back to the left margin.
  function wrap(text, width, indent) {
    var ind = indent || "";
    var words = String(text).split(/\s+/).filter(Boolean);
    var out = [], line = "";
    for (var i = 0; i < words.length; i++) {
      if (!line) { line = words[i]; continue; }
      if ((line + " " + words[i]).length > width) { out.push(ind + line); line = words[i]; }
      else line += " " + words[i];
    }
    if (line) out.push(ind + line);
    return out;
  }

  // A markdown table, as aligned columns. The separator row (|---|---|) is dropped, the last column
  // takes the slack and is capped so the table still fits a terminal, and a header row gets a rule
  // under it.
  function table(rows) {
    var MAX = 60;
    var cells = rows.map(function (r) {
      return r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return inline(c).trim(); });
    }).filter(function (r) {
      return !r.every(function (c) { return c === "" || /^:?-{2,}:?$/.test(c); });
    });
    if (!cells.length) return [];
    var cols = 0;
    cells.forEach(function (r) { if (r.length > cols) cols = r.length; });
    var wid = [];
    for (var i = 0; i < cols; i++) {
      var w = 0;
      cells.forEach(function (r) { var c = r[i] || ""; if (c.length > w) w = c.length; });
      wid[i] = (i === cols - 1) ? Math.min(w, MAX) : w;
    }
    var out = [];
    cells.forEach(function (r, ri) {
      var first = "";
      for (var c = 0; c < cols - 1; c++) first += pad(r[c] || "", wid[c] + 2);
      // The last column is the one that takes the slack, and it has to WRAP - so the first line goes
      // straight after the columns already printed and only the wrapped ones after it carry the indent
      // that lines them up under it. (Asking wrap() for every line with that indent and then printing
      // its first line after the other columns is what used to shove the first line of every row to the
      // right by the width of the columns in front of it, leaving the rows out of step with the rule
      // under the header.) If the cell does not wrap there is nothing to align, and nothing to do.
      var lines = wrap(r[cols - 1] || "", MAX);
      if (!lines.length) lines = [""];
      out.push(first + lines[0]);
      for (var j = 1; j < lines.length; j++) out.push(rule(" ", first.length) + lines[j]);
      if (ri === 0) {
        var bar = "";
        for (var c2 = 0; c2 < cols - 1; c2++) bar += rule("-", wid[c2]) + "  ";
        out.push(bar + rule("-", Math.min(wid[cols - 1], 20)));
      }
    });
    return out;
  }

  function toTerminal(md, opts) {
    opts = opts || {};
    var lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
    var out = [], fence = false, tableRows = [], blanks = 0, seen = false;
    function flushTable() {
      if (!tableRows.length) return;
      table(tableRows).forEach(function (l) { out.push(l); });
      tableRows = [];
    }
    function push(l) {
      var blank = !norm(l);
      if (blank && blanks) return;                 // never more than one blank line in a row
      blanks = blank ? 1 : 0;
      out.push(blank ? "" : l);
    }
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i], s = norm(raw);
      // The document's own first heading is dropped when the page already carries the title from the
      // manifest (a document that begins with "# Your turn and hers" would otherwise print it twice).
      if (!seen && s) {
        seen = true;
        if (opts.skipFirstHeading && /^#\s+/.test(raw)) continue;
      }
      if (/^```/.test(s)) {
        flushTable();
        if (!fence) { out.push(""); blanks = 1; }
        fence = !fence;
        continue;
      }
      if (fence) { out.push(raw); blanks = 0; continue; }
      if (/^\s*\|/.test(raw)) { tableRows.push(raw); continue; }
      flushTable();
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(s) && !/^\s*- /.test(raw)) { push(rule("-", 58)); continue; }
      var h = raw.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var words = upper(inline(h[2]));
        push("");
        if (h[1].length === 1) { push(words); push(rule("=", Math.min(words.length, 78))); }
        else if (h[1].length === 2) { push(words); push(rule("-", Math.min(words.length, 78))); }
        else push("\u00b7 " + words);
        push("");
        continue;
      }
      var ul = raw.match(/^(\s*)[-*+]\s+(.*)$/);
      if (ul) {
        var depth = Math.min(3, Math.floor(ul[1].length / 2));
        var ind = rule(" ", depth * 2) + "\u00b7 ";
        wrap(inline(ul[2]), 96 - ind.length, ind).forEach(push);
        continue;
      }
      var ol = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
      if (ol) {
        var depth2 = Math.min(3, Math.floor(ol[1].length / 2));
        var ind2 = rule(" ", depth2 * 2) + ol[2] + ". ";
        wrap(inline(ol[3]), 96 - ind2.length, ind2).forEach(push);
        continue;
      }
      var bq = raw.match(/^>\s?(.*)$/);
      if (bq) { wrap(inline(bq[1]), 92, "  ").forEach(push); continue; }
      push(inline(raw));
    }
    flushTable();
    while (out.length && !norm(out[out.length - 1])) out.pop();
    return out.join("\n");
  }

  // ---- the manifest and the documents --------------------------------------

  // The SHIPPED manifest: the files that are in src/rtfm/ and travel with the generator. Read once.
  async function loadShipped() {
    if (loadP) return loadP;
    report = { loaded: false, count: 0, failed: "" };
    loadP = (async function () {
      try {
        var res = await fetch(MANIFEST);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var data = await res.json();
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.docs) ? data.docs : []);
        shipped = list.map(function (d) {
          if (typeof d === "string") d = { file: d };
          if (!d || !d.file) return null;
          var file = String(d.file);
          return {
            id: norm(d.id || file.replace(/\.md$/i, "")).toLowerCase(),
            file: file,
            title: norm(d.title || file.replace(/\.md$/i, "")),
            desc: norm(d.desc || ""),
            tags: Array.isArray(d.tags) ? d.tags : [],
            generated: !!d.generated,
            from: norm(d.from || "")
          };
        }).filter(Boolean);
        report.loaded = true;
        report.count = shipped.length;
      } catch (e) {
        report.failed = String((e && e.message) ? e.message : e);
        console.warn("the RTFM manifest could not be read", e);
      }
      return report;
    })();
    return loadP;
  }

  // ---- the documents written here, on this device ---------------------------
  //
  // Kept in kv, next to everything else of his, because nothing on this page can write a file into
  // src/ and because a page he writes is his until he chooses to export it. One key holds them all:
  // { id: { title, tags, desc, body, shadows, savedAt } }. `shadows` is the shipped FILE this copy
  // stands in front of ("" for a page of his own) - derived from the shipped list at save time, never
  // authored by hand, so a rename cannot leave a stale shadow behind.

  function store() {
    try { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
    catch (e) { return null; }
  }

  // A document's name: letters, numbers, hyphens. The same shape chat.js uses for a slash command and
  // roles.js for a layer, because a name here is typed at a terminal like any other word.
  function slug(s) {
    return norm(s).toLowerCase().replace(/^\/+/, "").replace(/\.md$/, "")
      .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }

  function cleanRecord(id, r) {
    if (!r || typeof r !== "object") return null;
    var key = slug(id);
    if (!key) return null;
    return {
      id: key,
      title: norm(r.title || ""),
      tags: (Array.isArray(r.tags) ? r.tags : []).map(function (t) { return norm(t).toLowerCase(); }).filter(Boolean),
      desc: norm(r.desc || ""),
      body: String(r.body == null ? "" : r.body),
      shadows: norm(r.shadows || ""),
      savedAt: String(r.savedAt || "")
    };
  }

  async function readLocal(force) {
    if (local && !force) return local;
    local = {};
    var k = store();
    if (!k) return local;
    try {
      var v = await k.get(LOCAL_KEY);
      if (v && typeof v === "object") {
        Object.keys(v).forEach(function (id) {
          var r = cleanRecord(id, v[id]);
          if (r) local[r.id] = r;
        });
      }
    } catch (e) { console.warn("the RTFM's own pages could not be read", e); }
    return local;
  }

  function localAll() {
    return Object.keys(local || {}).map(function (k) { return local[k]; });
  }

  function localGet(id) { return (local && local[slug(id)]) || null; }

  // How many characters a stored page holds, for the count in the header and in a receipt.
  function lines(text) { return String(text || "").split("\n").length; }

  async function writeLocal(next) {
    var k = store();
    if (!k) return { ok: false, error: "THIS BROWSER WILL NOT KEEP IT :: THE kv STORE IS NOT AVAILABLE HERE, SO A PAGE WRITTEN NOW WOULD BE GONE AT THE NEXT RELOAD." };
    var empty = !next || !Object.keys(next).length;
    try {
      // Nothing left to keep is nothing to keep: the key goes rather than an empty husk sitting in his
      // kv, so the store says "he has written nothing" as plainly as it can.
      if (empty) await k.delete(LOCAL_KEY);
      else await k.set(LOCAL_KEY, next);
    } catch (e) { return { ok: false, error: "THE STORE WOULD NOT TAKE IT :: " + ((e && e.message) || e) }; }
    local = null;
    await readLocal(true);
    merge();
    return { ok: true };
  }

  // Save (or update) a page written here. `previous` is the name it was loaded under, so renaming a
  // page of his own moves it rather than leaving a copy behind. A SHIPPED name cannot be taken this
  // way - that is what writing the file means - so a rename onto one is refused.
  async function save(rec, previous) {
    if (!rec) return { ok: false, error: "NOTHING TO SAVE." };
    await load();
    var id = slug(rec.id || rec.title);
    if (!id) return { ok: false, error: "A PAGE NEEDS A NAME :: LETTERS, NUMBERS AND HYPHENS (e.g. blood-rites)." };
    var body = String(rec.body == null ? "" : rec.body);
    if (body.length > MAX_BODY) return { ok: false, error: "THAT IS TOO LONG FOR A PAGE HERE :: " + body.length + " CHARACTERS, AND THE CEILING IS " + MAX_BODY + "." };
    var sd = findShipped(id);
    if (sd && sd.generated) return { ok: false, error: "THE CHEATSHEET IS GENERATED FROM src/commands/commands.json AND CANNOT BE REWRITTEN HERE :: /rtfm new " + upper(id) + " MAKES A PAGE OF YOUR OWN INSTEAD." };
    var prevId = slug(previous || "");
    if (prevId && prevId !== id) {
      var taken = findShipped(id) || localGet(id);
      if (taken) return { ok: false, error: "THERE IS ALREADY A PAGE CALLED \"" + upper(taken.title || id) + "\" (" + id + ") :: GIVE THIS ONE ANOTHER NAME." };
    }
    if (!local) await readLocal(true);
    var next = {};
    Object.keys(local).forEach(function (k) { if (k !== id) next[k] = local[k]; });
    if (!next[id] && Object.keys(next).length >= MAX_DOCS) return { ok: false, error: "THAT IS " + MAX_DOCS + " PAGES WRITTEN HERE ALREADY, WHICH IS THE CEILING :: /rtfm mine LISTS THEM." };
    var was = localGet(id) || null;
    next[id] = {
      id: id,
      title: norm(rec.title) || (sd ? sd.title : upper(id)),
      tags: (Array.isArray(rec.tags) ? rec.tags : []).map(function (t) { return norm(t).toLowerCase(); }).filter(Boolean),
      desc: norm(rec.desc),
      body: body,
      shadows: sd ? sd.file : "",
      savedAt: new Date().toISOString()
    };
    var w = await writeLocal(next);
    if (!w.ok) return w;
    return {
      ok: true, id: id, title: next[id].title, shadows: next[id].shadows,
      bytes: body.length, lines: lines(body), existed: !!was
    };
  }

  // Drop a page written here. For a SHIPPED document that is a revert: the file in src/rtfm/ is
  // untouched and comes back into force.
  async function drop(id) {
    await load();
    var key = slug(id);
    if (!key) return { ok: false, error: "WHICH PAGE? /rtfm LISTS THEM." };
    if (!localGet(key)) {
      var sd = findShipped(key);
      if (sd) return { ok: false, error: sd.generated
        ? "\"" + upper(sd.title) + "\" IS GENERATED :: THERE IS NOTHING OF YOURS IN IT TO DROP."
        : "\"" + upper(sd.title) + "\" IS THE SHIPPED FILE " + DIR + sd.file + " AND YOU HAVE NOT REWRITTEN IT HERE :: NOTHING OF YOURS TO DROP." };
      return { ok: false, error: "THERE IS NO PAGE CALLED \"" + upper(key) + "\" WRITTEN HERE." };
    }
    var rec = localGet(key);
    var next = {};
    Object.keys(local).forEach(function (k) { if (k !== key) next[k] = local[k]; });
    var w = await writeLocal(next);
    if (!w.ok) return w;
    var back = findShipped(key);
    return { ok: true, id: key, title: rec.title || key, bytes: rec.body.length, backTo: back ? back.file : "" };
  }

  // The two lists, one list. A page written here under a shipped name REPLACES that entry (the
  // shipped file is still the file; his copy is what is read), and a page of his own is appended, so
  // the shipped documents keep their order and his are at the end where he can find them.
  function merge() {
    var seen = {};
    var out = shipped.map(function (d) {
      seen[d.id] = true;
      var ov = localGet(d.id);
      if (!ov) return d;
      return {
        id: d.id, file: d.file, title: ov.title || d.title, desc: ov.desc || d.desc,
        tags: ov.tags.length ? ov.tags : d.tags, generated: d.generated, from: d.from,
        local: true, rewritten: true, shadows: d.file, savedAt: ov.savedAt, body: ov.body
      };
    });
    Object.keys(local || {}).forEach(function (id) {
      if (seen[id]) return;
      var ov = local[id];
      out.push({
        id: id, file: "", title: ov.title || upper(id), desc: ov.desc, tags: ov.tags,
        generated: false, from: "", local: true, rewritten: false, shadows: "", savedAt: ov.savedAt, body: ov.body
      });
    });
    docs = out;
    return docs;
  }

  async function load() {
    await loadShipped();
    if (!local) await readLocal(true);
    return merge();
  }

  function all() { return docs.slice(); }

  // The SHIPPED document by name - a local rewrite shares its id, so this is the one that answers
  // "is there a file under this name", which is what the editor and the save checks ask.
  function findShipped(name) {
    var want = slug(name);
    if (!want) return null;
    for (var i = 0; i < shipped.length; i++) if (shipped[i].id === want) return shipped[i];
    return null;
  }

  function find(name) {
    var want = norm(name).toLowerCase().replace(/^\.\//, "");
    if (!want) return null;
    var stem = want.replace(/\.md$/i, "");
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (d.id === stem || (d.file && String(d.file).toLowerCase() === want) || (d.file && String(d.file).toLowerCase() === stem + ".md")) return d;
    }
    for (i = 0; i < docs.length; i++) if (String(docs[i].title).toLowerCase() === want) return docs[i];
    return null;
  }

  // What a document SAYS: his copy when there is one, the shipped file otherwise. A page written here
  // has no file at all, so this is also the only reader that has to know the difference.
  async function docText(d) {
    if (d && d.local) return String(d.body == null ? "" : d.body);
    var res = await fetch(DIR + d.file);
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + DIR + d.file);
    return await res.text();
  }

  // The raw markdown of a document, by name, for the editor. `previous` comes back so the editor can
  // tell a page written here from a shipped one without asking twice.
  async function read(name) {
    await load();
    var d = find(name);
    if (!d) return null;
    var text;
    try { text = await docText(d); }
    catch (e) { return { doc: d, error: String((e && e.message) || e) }; }
    return { doc: d, text: text };
  }

  // The document, fetched and rendered. A GENERATED document that has fallen behind says so in its
  // own header rather than being shown as if it were current.
  async function doc(name) {
    await load();
    var d = find(name);
    if (!d) return null;
    var text;
    try { text = await docText(d); }
    catch (e) { return { title: d.title, text: "THE DOCUMENT COULD NOT BE READ :: " + ((e && e.message) || e) + "\n\nIT IS LISTED AS " + DIR + d.file + " IN " + MANIFEST + ".", ms: 0 }; }
    var head = [d.title, rule("=", Math.min(d.title.length, 78)), ""];
    if (d.desc) { head.push(upper(d.desc)); head.push(""); }
    if (d.generated) head.push("  FILE :: " + DIR + d.file + "  (GENERATED" + (d.from ? " FROM " + d.from : "") + ")");
    else if (d.shadows) head.push("  FILE :: " + DIR + d.shadows + "  (SHIPPED - THIS COPY OF IT IS YOURS)");
    else if (d.file) head.push("  FILE :: " + DIR + d.file);
    else head.push("  FILE :: NONE - WRITTEN HERE");
    if (d.local) {
      head.push("  KEPT :: THIS DEVICE ONLY (kv lia_settings/" + LOCAL_KEY + ")"
        + (d.savedAt ? "  \u00b7 SAVED " + String(d.savedAt).slice(0, 16).replace("T", " ") : ""));
      head.push("  NOT SHIPPED :: /rtfm export " + d.id + " DOWNLOADS IT, SO IT CAN GO INTO " + DIR + " AND TRAVEL WITH THE GENERATOR.");
    }
    if (d.tags.length) head.push("  TAGGED :: " + d.tags.join(", ").toUpperCase());
    if (d.generated) {
      var stale = await staleText(text);
      if (stale) { head.push(""); head.push("  \u00b7\u00b7 " + stale); }
    }
    head.push("");
    return { title: d.title, text: head.join("\n") + "\n" + toTerminal(text, { skipFirstHeading: true }) };
  }

  // ---- the cheatsheet, rendered from the live list -------------------------

  // The command list is the truth and this is the one place it is turned into a page. Deterministic
  // on purpose: `/rtfm check` compares this byte for byte against the shipped copy, so a run of it
  // has to produce the same text every time.
  function cheatsheetMarkdown() {
    var list = (window.cmd && window.cmd.all) ? window.cmd.all() : [];
    if (!list.length) return "# THE SLASH COMMANDS\n\nThe command list could not be read (src/commands/commands.json).\n";
    var term = list.filter(function (c) { return c.kind !== "lia"; });
    var lia = list.filter(function (c) { return c.kind === "lia"; });
    function gloss(c) {
      if (c.short) return c.short;
      var d = String(c.desc || "");
      var m = d.match(/^[^.!?]*[.!?]/);
      return (m ? m[0] : d).slice(0, 140) || c.usage;
    }
    function rows(group) {
      var out = ["| Command | What it does |", "|---|---|"];
      group.forEach(function (c) { out.push("| `/" + c.id + "` | " + gloss(c) + " |"); });
      return out;
    }
    var md = [];
    md.push("# THE SLASH COMMANDS");
    md.push("");
    md.push("The terminal's commands in one page: " + list.length + " in all - " + term.length
      + " carried out by the machine, " + lia.length + " she answers herself.");
    md.push("");
    md.push("GENERATED FROM `src/commands/commands.json` - do not hand-edit this file. The list is the"
      + " truth; this is a copy. `/rtfm cheatsheet` renders it fresh, `/rtfm check` says whether the"
      + " copy has fallen behind, and `/rtfm export` downloads a new one. A command is added by"
      + " editing the list, never by editing this page.");
    md.push("");
    md.push("## CARRIED OUT BY THE TERMINAL");
    md.push("");
    rows(term).forEach(function (l) { md.push(l); });
    md.push("");
    md.push("## SHE ANSWERS THESE HERSELF");
    md.push("");
    md.push("These are his way of asking HER for something. When one is typed, its own instruction"
      + " is handed to her with the turn, and the command line stays in front of it.");
    md.push("");
    rows(lia).forEach(function (l) { md.push(l); });
    md.push("");
    md.push("## THE WHOLE USAGE LINE OF EACH");
    md.push("");
    md.push("Every argument, as the list holds it:");
    md.push("");
    md.push("```");
    list.forEach(function (c) { md.push(c.usage); });
    md.push("```");
    md.push("");
    md.push("## GO DEEPER");
    md.push("");
    md.push("- `/rtfm <COMMAND>` - one command's page: its usage, its kind and its whole description.");
    md.push("- `/rtfm about` - what the manual is, where it lives, and how to add a document to it.");
    md.push("- `/help` - the same roster in the terminal window; `/help <TOPIC>` goes deeper on an area.");
    md.push("- `/rtfm check` - whether this copy still matches the live list.");
    md.push("");
    return md.join("\n");
  }

  function cheatsheet() {
    return toTerminal(cheatsheetMarkdown(), { skipFirstHeading: true });
  }

  // Is the shipped copy behind the live list? Returns a sentence, or "" when it matches. Reads the
  // file itself rather than trusting a size, and names the first line that differs - a byte count
  // alone would say "something changed" without saying where.
  async function staleText(copyText) {
    var want = cheatsheetMarkdown();
    var have = copyText;
    if (have == null) {
      await load();
      var d = docs.filter(function (x) { return x.generated; })[0];
      if (!d) return "";
      try { have = await docText(d); } catch (e) { return "THE SHIPPED COPY COULD NOT BE READ (" + ((e && e.message) || e) + ")."; }
    }
    if (have === want) return "";
    var a = have.split("\n"), b = want.split("\n");
    var at = -1;
    for (var i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || "") !== (b[i] || "")) { at = i + 1; break; } }
    return "THE SHIPPED COPY IS BEHIND THE LIVE LIST (copy " + have.length + " BYTES, NOW " + want.length
      + " BYTES" + (at > 0 ? ", first difference at line " + at : "") + "). /rtfm cheatsheet SHOWS THE"
      + " CURRENT ONE; /rtfm export DOWNLOADS A FRESH COPY TO DROP AT src/rtfm/commands.md.";
  }

  // ---- one command's page --------------------------------------------------

  function commandPage(name) {
    var c = window.cmd ? window.cmd.get(name) : null;
    if (!c) return null;
    var out = [];
    out.push(c.usage);
    out.push(rule("=", Math.min(c.usage.length, 78)));
    out.push("");
    out.push("  KIND :: " + (c.kind === "lia" ? "SHE ANSWERS IT HERSELF" : "CARRIED OUT BY THE TERMINAL"));
    if (c.short) out.push("  IN A WORD :: " + c.short);
    out.push("");
    out.push(upper(c.desc || ""));
    out.push("");
    out.push("FROM src/commands/commands.json, READ OUT OF THE RUNNING LIST - NOT A COPY OF IT.");
    out.push("/help LISTS EVERY COMMAND; /rtfm cheatsheet PRINTS THE WHOLE CHEATSHEET.");
    return { title: c.usage, text: out.join("\n") };
  }

  // ---- the front door ------------------------------------------------------

  function indexText() {
    var L = [];
    var mine = localAll();
    L.push("THE RTFM - READ THE FRIENDLY MANUAL");
    L.push(rule("=", 34));
    L.push("");
    L.push("A pack of documents that explain the machine: markdown pages, shipped in " + DIR + " and");
    L.push("written here. They are for YOU - she is never given them, and none of this is her memory.");
    L.push("");
    L.push("DOCUMENTS (" + docs.length + ")");
    if (!docs.length) L.push("  NONE - THE MANIFEST (" + MANIFEST + ") LISTED NOTHING.");
    docs.forEach(function (d, i) {
      var mark = d.generated ? "  (GENERATED)"
        : (d.rewritten ? "  (SHIPPED - REWRITTEN BY YOU HERE)"
          : (d.local ? "  (WRITTEN BY YOU HERE)" : ""));
      L.push("  " + (i + 1) + ". " + d.title + mark);
      L.push("     " + (d.desc || d.file || "no description"));
      L.push("     \u00b7 /rtfm " + d.id + "  \u00b7 "
        + (d.local ? "THIS DEVICE ONLY" : "FILE " + DIR + d.file)
        + (d.tags.length ? "  \u00b7 " + d.tags.join(", ").toUpperCase() : ""));
    });
    var n = (window.cmd && window.cmd.count) ? window.cmd.count() : 0;
    L.push("");
    L.push("THE COMMANDS (" + n + ")");
    L.push("  /rtfm cheatsheet   THE WHOLE CHEATSHEET, RENDERED FROM THE LIVE LIST RIGHT NOW");
    L.push("  /rtfm <COMMAND>    ONE COMMAND'S PAGE - USAGE, KIND, AND ITS WHOLE DESCRIPTION");
    L.push("  /rtfm check        WHETHER THE SHIPPED COPY AT " + DIR + "commands.md IS STILL CURRENT");
    L.push("");
    L.push("WRITING ONE HERE (" + mine.length + " SO FAR)");
    L.push("  /rtfm new [NAME] [:: TITLE]  OPEN THE EDITOR ON A NEW PAGE - KEPT ON THIS DEVICE");
    L.push("  /rtfm edit <DOC>             OPEN A PAGE TO REWRITE IT - SHIPPED OR YOURS");
    L.push("  /rtfm add <DOC> <TEXT>       APPEND A LINE WITHOUT OPENING THE EDITOR");
    L.push("  /rtfm mine                   WHAT YOU HAVE WRITTEN HERE");
    L.push("  /rtfm rm <DOC>               DROP A PAGE OF YOURS (OR A SHIPPED ONE YOU REWROTE)");
    L.push("  A page written here lives in THIS BROWSER, not in " + DIR + " - /rtfm export <DOC>");
    L.push("  DOWNLOADS IT AS MARKDOWN, WHICH IS HOW ONE OF YOURS GETS INTO THE SHIPPED FOLDER.");
    L.push("");
    L.push("THE PACK ITSELF");
    L.push("  /rtfm about        WHAT THIS IS, HOW TO ADD A PAGE TO IT, AND HOW TO WRITE ONE HERE");
    L.push("  /rtfm export <DOC> DOWNLOAD A DOCUMENT AS MARKDOWN (commands = A FRESH CHEATSHEET)");
    L.push("  /rtfm list         THIS PAGE");
    return { title: "THE RTFM", text: L.join("\n") };
  }

  function mineText(drafts) {
    var mine = localAll();
    var L = [];
    L.push("THE RTFM - THE PAGES WRITTEN ON THIS DEVICE");
    L.push(rule("=", 43));
    L.push("");
    if (!mine.length) {
      L.push("NOTHING HAS BEEN SAVED HERE YET.");
      L.push("");
      L.push("/rtfm new <NAME> OPENS THE EDITOR ON A NEW PAGE, AND /rtfm edit <DOC> OPENS ONE OF THE");
      L.push("SHIPPED ONES TO REWRITE. WHAT YOU WRITE IS KEPT IN THIS BROWSER - kv, NEXT TO EVERYTHING");
      L.push("ELSE OF YOURS - AND NEVER IN " + DIR + ".");
    } else {
      mine.forEach(function (r) {
        L.push("  " + upper(r.title || r.id) + "  (" + r.id + ")");
        L.push("     " + (r.desc || "(no line saying what it is for)"));
        L.push("     " + r.body.length + " CHARACTERS, " + lines(r.body) + " LINES"
          + (r.savedAt ? "  \u00b7 SAVED " + String(r.savedAt).slice(0, 16).replace("T", " ") : ""));
        L.push("     " + (r.shadows ? "SHADOWS " + DIR + r.shadows + " (THE SHIPPED FILE IS UNTOUCHED)" : "A PAGE OF YOUR OWN - NO SHIPPED FILE UNDER THIS NAME"));
        L.push("     \u00b7 /rtfm " + r.id + "  \u00b7 /rtfm edit " + r.id + "  \u00b7 /rtfm export " + r.id + "  \u00b7 /rtfm rm " + r.id);
      });
    }
    // UNSAVED WORK: what the editor kept while he was typing and SAVE has not turned into a page. It is
    // the one thing that must not go unmentioned after a reload, and the editor is the only thing that
    // knows about it - so it is listed here, beside the pages, with the way back to it.
    if (drafts && drafts.length) {
      L.push("");
      L.push("UNSAVED DRAFTS (" + drafts.length + ") - TYPED HERE, NOT SAVED AS PAGES, KEPT IN THIS BROWSER");
      drafts.forEach(function (d) {
        L.push("  " + (d.fresh ? "(A NEW PAGE) " : "") + d.id + "  \u00b7 " + d.chars + " CHARACTERS  \u00b7 " + (d.age || ""));
        L.push("     \u00b7 OPEN IT AGAIN AND THE DRAFT IS PUT BACK :: /rtfm " + (d.fresh ? "new " : "edit ") + d.id);
      });
      L.push("  A DRAFT IS NOT A PAGE: NOTHING ELSE CAN SEE IT, AND SAVE IS WHAT MAKES IT ONE.");
    }
    L.push("");
    L.push("DROP ONE :: /rtfm rm <NAME> (TYPE confirm AFTER IT TO GO THROUGH WITH IT)");
    L.push("INTO THE BUILD :: /rtfm export <NAME>, THEN DROP THE FILE IN " + DIR + " AND LIST IT IN " + DIR + "rtfm.json");
    return { title: "THE RTFM - WRITTEN HERE", text: L.join("\n") };
  }

  function aboutText() {
    var L = [];
    L.push("THE RTFM - WHAT IT IS AND HOW TO ADD TO IT");
    L.push(rule("=", 41));
    L.push("");
    L.push("THE MANUAL, KEPT AS DOCUMENTS. Markdown files in " + DIR + ", listed in " + DIR + "rtfm.json,");
    L.push("read here with /rtfm. It is FOR YOU, NOT FOR HER: the LOREPACK is what she remembers, this");
    L.push("is the manual for the machine she runs on. Nothing in here is indexed, retrieved, or handed");
    L.push("to her on a turn, and nothing here writes to her memory. Keep it that way - a manual is not");
    L.push("a memory.");
    L.push("");
    L.push("EVERYTHING IN THAT FOLDER IS PUBLIC and ships with the generator. Nothing private goes in it.");
    L.push("");
    L.push("WRITING ONE FROM HERE");
    L.push("  /rtfm new [NAME] [:: TITLE]  OPENS THE EDITOR ON A NEW PAGE");
    L.push("  /rtfm edit <DOC>             OPENS A PAGE - SHIPPED OR YOURS - TO REWRITE IT");
    L.push("  /rtfm add <DOC> <TEXT>       APPENDS A LINE WITHOUT THE EDITOR");
    L.push("  /rtfm mine                   WHAT YOU HAVE WRITTEN HERE");
    L.push("  /rtfm rm <DOC>               DROPS A PAGE OF YOURS (OR A SHIPPED ONE YOU REWROTE)");
    L.push("What you write this way is kept in THIS BROWSER (kv, the store everything else of yours is");
    L.push("in) and NEVER in " + DIR + " - nothing on this page can write a file into the generator. So a");
    L.push("page written here is on this device until you export it: /rtfm export <DOC> downloads it as");
    L.push("markdown, and dropping that file in " + DIR + " plus a line in the manifest is what makes it");
    L.push("travel. The editor has a live preview - what it shows is exactly how the terminal prints it.");
    L.push("");
    L.push("REWRITING A SHIPPED PAGE IS A SHADOW, NOT AN EDIT. /rtfm edit turn keeps your copy here and");
    L.push("prints THAT; the file at " + DIR + "turn.md is untouched, and /rtfm rm turn (or REVERT in the");
    L.push("editor) puts the shipped file back in force. It is the same arrangement as an edited role");
    L.push("layer (roles.js) - the shipped thing is the truth, and what you make of it sits on top.");
    L.push("");
    L.push("NOTHING UNSAVED IS LOST TO A RELOAD. While you are typing, what you have typed is kept as a");
    L.push("DRAFT in this browser (kv, rtfm_draft_<NAME>) - not the page, and never in " + DIR + ". Open the");
    L.push("page again in the editor and the draft is put back in the fields with the time it was written;");
    L.push("SAVE turns it into the page, and closing with CANCEL twice (or REVERT, or DELETE) throws it");
    L.push("away, which is what being asked twice is for.");
    L.push("");
    L.push("ADDING A PAGE TO THE BUILD (the shipped way, if you would rather edit files)");
    L.push("  1. Drop the .md file into " + DIR + ".");
    L.push("  2. List it in " + DIR + "rtfm.json:");
    L.push("");
    L.push("       { \"id\": \"turn\", \"file\": \"turn.md\", \"title\": \"YOUR TURN AND HERS\",");
    L.push("         \"tags\": [\"voice\"], \"desc\": \"one line saying what it is for\" }");
    L.push("");
    L.push("     A bare string (\"turn.md\") works too; the filename is then the title.");
    L.push("  3. Nothing else: /rtfm lists it from the manifest the next time it is asked.");
    L.push("");
    L.push("THAT IS THE SAME ACT AS ADDING A LOREPACK DOCUMENT, and the difference matters: a lore");
    L.push("document changes what she REMEMBERS, a manual document changes what YOU can look up.");
    L.push("");
    L.push("A GENERATED DOCUMENT is one the terminal writes rather than you: `\"generated\": true` plus");
    L.push("`\"from\": \"<the file it is rendered from>\"`. " + DIR + "commands.md is the one that exists:");
    L.push("it is rendered from src/commands/commands.json, so the cheatsheet can never disagree with");
    L.push("the commands that actually exist. It cannot be rewritten here at all - the command list is");
    L.push("the truth and the page is a copy of it. /rtfm check compares the copy against a fresh render");
    L.push("and names the first line that differs; /rtfm export downloads a new copy.");
    L.push("");
    L.push("HOW THE DOCUMENTS ARE READ. Markdown, rendered for a monospace window: headings become ruled");
    L.push("banners, tables become aligned columns, lists keep their indentation, code fences pass");
    L.push("through untouched, and **bold**, `code` and [links](url) are unwrapped - the emphasis is not");
    L.push("worth the punctuation in a terminal. Write for that subset: headings, paragraphs, tables,");
    L.push("lists and code fences all land well; anything else is printed as it stands.");
    L.push("");
    L.push("READING ONE: /rtfm <DOC> prints it. /rtfm <COMMAND> prints that command's page instead -");
    L.push("command names are matched first, so /rtfm lore is /lore, and /rtfm doc <NAME> or");
    L.push("/rtfm cmd <NAME> says which you mean when a document is named after a command.");
    return { title: "THE RTFM - ABOUT", text: L.join("\n") };
  }

  async function run(arg) {
    var raw = norm(arg);
    var lower = raw.toLowerCase();
    var parts = lower.split(/\s+/);
    var verb = parts[0] || "";
    var rest = raw.split(/\s+/).slice(1).join(" ").trim();

    if (!verb || verb === "list" || verb === "docs" || verb === "index" || verb === "?") {
      await load();
      return indexText();
    }
    if (verb === "about" || verb === "help" || verb === "how") {
      await load();
      return aboutText();
    }
    if (verb === "cheatsheet" || verb === "cheat" || verb === "sheet") {
      var n = (window.cmd && window.cmd.count) ? window.cmd.count() : 0;
      return { title: "THE CHEATSHEET", text: "THE SLASH COMMANDS (" + n + ") - RENDERED FROM THE LIVE LIST RIGHT NOW.\n"
        + rule("=", 58) + "\n\n" + cheatsheet() };
    }
    if (verb === "check" || verb === "stale" || verb === "verify") {
      await load();
      var d0 = docs.filter(function (x) { return x.generated; })[0];
      if (!d0) return { title: "RTFM CHECK", text: "NO GENERATED DOCUMENT IS LISTED IN " + MANIFEST + ", SO THERE IS NOTHING TO CHECK." };
      var stale = await staleText(null);
      var want = cheatsheetMarkdown();
      return { title: "RTFM CHECK", text: stale ? stale
        : "THE SHIPPED COPY MATCHES THE LIVE LIST :: " + DIR + d0.file
          + " IS UP TO DATE (" + want.length + " BYTES, " + (window.cmd ? window.cmd.count() : 0) + " COMMANDS, "
          + want.split("\n").length + " LINES)." };
    }
    if (verb === "export" || verb === "download") {
      var what = rest || "commands";
      var payload = "", name = "", fromHere = false;
      await load();
      var dd = /^(cheatsheet|commands?\.md|commands)$/i.test(what) ? null : find(what);
      if (!rest || /^(cheatsheet|commands?\.md|commands)$/i.test(what) || (dd && dd.generated)) {
        payload = cheatsheetMarkdown();
        name = (dd && dd.file) || "commands.md";
      } else if (dd && dd.local) {
        payload = String(dd.body == null ? "" : dd.body);
        name = dd.file || (dd.id + ".md");
        fromHere = true;
      } else if (dd) {
        try { payload = await docText(dd); } catch (e) { return { title: "RTFM", text: "THAT DOCUMENT COULD NOT BE READ :: " + ((e && e.message) || e) }; }
        name = dd.file;
      } else {
        return { title: "RTFM", text: refusal(what) };
      }
      var ok = download(payload, name);
      return { title: "RTFM EXPORT", text: ok
        ? "DOWNLOADED " + name + " (" + payload.length + " BYTES) :: IT GOES TO YOUR DOWNLOADS, NOT TO src/."
          + (/commands\.md$/.test(name)
            ? "\nDROP IT AT " + DIR + "commands.md TO REFRESH THE SHIPPED COPY - /rtfm check SAYS WHETHER IT WAS NEEDED."
            : (fromHere
              ? "\nTO PUT IT IN THE BUILD :: DROP IT AT " + DIR + name + " AND LIST IT IN " + DIR + "rtfm.json"
                + (find(what) && find(what).shadows ? " - THE ENTRY IS ALREADY THERE, SO THE FILE IS THE WHOLE JOB." : ".")
              : ""))
        : "THIS BROWSER WOULD NOT OFFER THE DOWNLOAD. USE a desktop browser, or /rtfm cheatsheet to read it here." };
    }
    if (verb === "doc" || verb === "document") {
      await load();
      var d1 = find(rest);
      if (!d1) return { title: "RTFM", text: refusal(rest) };
      var got = await doc(rest);
      return got || { title: "RTFM", text: refusal(rest) };
    }
    if (verb === "cmd" || verb === "command") {
      var pg0 = commandPage(rest);
      return pg0 || { title: "RTFM", text: "NO COMMAND CALLED \"/" + upper(rest) + "\".\n/rtfm cheatsheet LISTS THEM ALL." };
    }
    if (verb === "mine" || verb === "written" || verb === "heres" || verb === "here") {
      await load();
      var dr = (window.rtfmEditor && window.rtfmEditor.drafts) ? await window.rtfmEditor.drafts() : [];
      return mineText(dr);
    }

    // ---- writing one, from here ------------------------------------------------
    if (verb === "new" || verb === "create" || verb === "make") {
      await load();
      var spec = raw.split("::");
      var wantId = norm(spec[0].replace(/^\S+\s*/, ""));
      var wantTitle = norm(spec.slice(1).join("::"));
      var want = slug(wantId);
      if (want) {
        var clash = find(want);
        if (clash) return { title: "RTFM NEW", text: "THERE IS ALREADY A PAGE CALLED \"" + upper(clash.title) + "\" (" + clash.id + ")."
          + (clash.generated ? "\nIT IS GENERATED, SO IT CANNOT BE REWRITTEN HERE :: GIVE YOURS ANOTHER NAME." : "\nTO REWRITE IT :: /rtfm edit " + upper(clash.id) + "\nTO START ANOTHER :: /rtfm new <ANOTHER-NAME>") };
      }
      if (!window.rtfmEditor) return { title: "RTFM", text: "THE EDITOR IS OFFLINE (src/js/rtfm-edit.js DID NOT LOAD)." };
      return { title: "RTFM NEW", text: await window.rtfmEditor.openNew(want, wantTitle) };
    }
    if (verb === "edit" || verb === "open" || verb === "rewrite") {
      await load();
      if (!rest) return { title: "RTFM EDIT", text: "WHICH PAGE?"
        + "\n  /rtfm edit <DOC>   ONE OF THE SHIPPED DOCUMENTS, OR ONE YOU WROTE (e.g. /rtfm edit turn)"
        + "\n  /rtfm new [NAME]   A NEW PAGE OF YOUR OWN"
        + "\nPAGES :: " + (docs.length ? docs.map(function (d) { return d.id + (d.generated ? "(generated)" : ""); }).join(" \u00b7 ") : "NONE LISTED") };
      var de = find(rest);
      if (!de) return { title: "RTFM EDIT", text: refusal(rest) };
      if (de.generated) return { title: "RTFM EDIT", text: "\"" + upper(de.title) + "\" IS GENERATED FROM " + de.from + " AND CANNOT BE REWRITTEN HERE - THE COMMAND LIST IS THE TRUTH AND THE PAGE IS A COPY OF IT."
        + "\nTO WRITE SOMETHING OF YOUR OWN :: /rtfm new <NAME>" };
      if (!window.rtfmEditor) return { title: "RTFM", text: "THE EDITOR IS OFFLINE (src/js/rtfm-edit.js DID NOT LOAD)." };
      return { title: "RTFM EDIT", text: await window.rtfmEditor.openEdit(de.id) };
    }
    if (verb === "add" || verb === "append" || verb === "note") {
      await load();
      var aTok = rest.split(/\s+/)[0] || "";
      var aText = rest.slice(aTok.length).trim();
      if (!aTok) return { title: "RTFM ADD", text: "ADD WHAT, TO WHICH PAGE?"
        + "\n  /rtfm add <DOC> <TEXT>   APPENDS THE TEXT AS A LINE - NO EDITOR, SAVED AT ONCE"
        + "\n  /rtfm edit <DOC>         FOR MORE THAN A LINE"
        + "\nPAGES :: " + (docs.length ? docs.map(function (d) { return d.id; }).join(" \u00b7 ") : "NONE LISTED") };
      var ad = find(aTok);
      if (!ad) return { title: "RTFM ADD", text: refusal(aTok) };
      if (ad.generated) return { title: "RTFM ADD", text: "\"" + upper(ad.title) + "\" IS GENERATED FROM " + ad.from + " :: NOTHING MAY BE ADDED TO IT HERE (THE NEXT /rtfm cheatsheet WOULD RENDER IT AWAY AGAIN)."
        + "\nA PAGE OF YOUR OWN :: /rtfm new <NAME>" };
      if (!aText) return { title: "RTFM ADD", text: "ADD WHAT TO \"" + upper(ad.title) + "\"?"
        + "\n  /rtfm add " + upper(ad.id) + " <TEXT>   APPENDS THE TEXT AS A LINE AND SAVES IT ON THIS DEVICE"
        + "\n  /rtfm edit " + upper(ad.id) + "         OPENS IT IN THE EDITOR" };
      var cur = String(ad.body == null ? await docText(ad) : ad.body);
      var joined = cur + (cur && !/\n$/.test(cur) ? "\n" : "") + aText + "\n";
      var ar = await save({ id: ad.id, title: ad.title, tags: ad.tags, desc: ad.desc, body: joined }, ad.id);
      if (!ar.ok) return { title: "RTFM ADD", text: "NOT ADDED :: " + ar.error };
      return { title: "RTFM ADD", text: "ADDED TO \"" + upper(ad.title) + "\" (" + ar.id + ") :: " + aText.length + " CHARACTERS, NOW "
        + ar.bytes + " IN ALL, " + ar.lines + " LINES."
        + (ar.shadows ? "\nYOUR COPY NOW SHADOWS " + DIR + ar.shadows + " ON THIS DEVICE - THE SHIPPED FILE IS UNTOUCHED. /rtfm rm " + upper(ar.id) + " PUTS IT BACK IN FORCE." : "\nKEPT IN THIS BROWSER ONLY :: /rtfm export " + upper(ar.id) + " DOWNLOADS IT.")
        + "\n/rtfm " + upper(ar.id) + " READS IT \u00b7 /rtfm edit " + upper(ar.id) + " OPENS IT" };
    }
    if (verb === "rm" || verb === "remove" || verb === "delete" || verb === "drop") {
      await load();
      var rParts = rest.split(/\s+/);
      var rTok = rParts[0] || "";
      var rGo = /^(confirm|yes|do it|gone)$/i.test(rParts[1] || "");
      if (!rTok) return { title: "RTFM RM", text: "DROP WHICH PAGE?"
        + "\n  /rtfm mine       WHAT YOU HAVE WRITTEN HERE"
        + "\n  /rtfm rm <DOC>   DROP ONE OF THEM (OR A SHIPPED ONE YOU REWROTE - THE FILE IN " + DIR + " COMES BACK)" };
      var rd = find(rTok);
      var rKey = rd ? rd.id : slug(rTok);
      var rRec = localGet(rKey);
      if (!rRec) return { title: "RTFM RM", text: dropRefusal(rd, rKey) };
      if (!rGo) return { title: "RTFM RM", text: "DROP \"" + upper(rRec.title || rKey) + "\" (" + rKey + ") FROM THIS DEVICE?"
        + (rRec.shadows ? "\nTHE SHIPPED FILE " + DIR + rRec.shadows + " IS UNTOUCHED AND COMES BACK INTO FORCE."
          : "\nIT IS KEPT ONLY IN THIS BROWSER, SO THIS IS THE WHOLE OF IT - /rtfm export " + rKey + " FIRST IF YOU WANT IT AS A FILE.")
        + (rRec.body.length > 200 ? "\n" + rRec.body.length + " CHARACTERS, " + lines(rRec.body) + " LINES." : "")
        + "\nTO GO THROUGH WITH IT :: /rtfm rm " + rKey + " confirm" };
      var dr = await drop(rKey);
      if (!dr.ok) return { title: "RTFM RM", text: "NOT DROPPED :: " + dr.error };
      return { title: "RTFM RM", text: "DROPPED \"" + upper(dr.title) + "\" (" + dr.id + ") :: " + dr.bytes + " CHARACTERS."
        + (dr.backTo ? "\n" + DIR + dr.backTo + " IS IN FORCE AGAIN HERE." : "\nNOTHING OF IT IS LEFT ON THIS DEVICE.") };
    }
    if (verb === "revert" || verb === "restore" || verb === "unshadow") {
      await load();
      var vParts = rest.split(/\s+/);
      var vTok = vParts[0] || "";
      var vGo = /^(confirm|yes|do it)$/i.test(vParts[1] || "");
      if (!vTok) return { title: "RTFM REVERT", text: "PUT A SHIPPED FILE BACK IN FORCE: /rtfm revert <DOC>"
        + "\nIT DROPS ONLY YOUR COPY - THE FILE IN " + DIR + " WAS NEVER TOUCHED. /rtfm mine LISTS WHAT YOU HAVE REWRITTEN." };
      var vd = find(vTok);
      var vKey = vd ? vd.id : slug(vTok);
      var vRec = localGet(vKey);
      if (!vRec) return { title: "RTFM REVERT", text: dropRefusal(vd, vKey) };
      if (!vRec.shadows) return { title: "RTFM REVERT", text: "\"" + upper(vRec.title || vKey) + "\" IS A PAGE OF YOUR OWN, NOT A REWRITE OF A SHIPPED ONE - THERE IS NO SHIPPED FILE UNDER IT TO PUT BACK."
        + "\nTO DROP IT :: /rtfm rm " + vKey + " confirm" };
      if (!vGo) return { title: "RTFM REVERT", text: "DROP YOUR COPY OF \"" + upper(vRec.title || vKey) + "\" AND PUT " + DIR + vRec.shadows + " BACK IN FORCE?"
        + "\nYOUR VERSION (" + vRec.body.length + " CHARACTERS) IS KEPT ONLY IN THIS BROWSER AND THIS IS THE WHOLE OF IT - /rtfm export " + vKey + " FIRST IF YOU WANT IT."
        + "\nTO GO THROUGH WITH IT :: /rtfm revert " + vKey + " confirm" };
      var vr = await drop(vKey);
      if (!vr.ok) return { title: "RTFM REVERT", text: "NOT REVERTED :: " + vr.error };
      return { title: "RTFM REVERT", text: "REVERTED \"" + upper(vr.title) + "\" :: " + DIR + vr.backTo + " IS IN FORCE AGAIN HERE." };
    }

    // A bare name: a COMMAND page first (that is what this is for), then a document.
    var pg = commandPage(raw);
    if (pg) return pg;
    await load();
    var d2 = find(raw);
    if (d2) {
      var g2 = await doc(raw);
      if (g2) return g2;
    }
    return { title: "RTFM", text: refusal(raw) };
  }

  // Why nothing came off the shelf for a name: the three answers are a page he never wrote, a shipped
  // file he never rewrote, and a generated page that may not be touched at all.
  function dropRefusal(d, key) {
    if (d && d.generated) return "\"" + upper(d.title) + "\" IS GENERATED FROM " + d.from + " :: THERE IS NOTHING OF YOURS IN IT TO DROP.";
    if (d) return "\"" + upper(d.title) + "\" IS THE SHIPPED FILE " + DIR + d.file + " AND YOU HAVE NOT REWRITTEN IT HERE :: NOTHING OF YOURS TO DROP."
      + "\nTO REWRITE IT ON THIS DEVICE :: /rtfm edit " + upper(d.id);
    return "THERE IS NO PAGE CALLED \"" + upper(key) + "\" WRITTEN HERE :: /rtfm mine LISTS WHAT YOU HAVE.";
  }

  function refusal(what) {
    var L = [];
    L.push("THE RTFM HAS NOTHING CALLED \"" + upper(what) + "\".");
    if (window.cmd) {
      var near = nearest(what, window.cmd.all().map(function (c) { return c.id; }));
      if (near) L.push("A COMMAND, MAYBE? /rtfm " + upper(near));
    }
    var nearDoc = nearest(what, docs.map(function (d) { return d.id; }));
    if (nearDoc) L.push("A DOCUMENT, MAYBE? /rtfm " + upper(nearDoc));
    L.push("");
    L.push("DOCUMENTS :: " + (docs.length ? docs.map(function (d) { return d.id; }).join(" \u00b7 ") : "NONE LISTED"));
    L.push("VERBS :: list \u00b7 about \u00b7 cheatsheet \u00b7 check \u00b7 export <DOC> \u00b7 doc <NAME> \u00b7 cmd <NAME>");
    L.push("          new [NAME] \u00b7 edit <DOC> \u00b7 add <DOC> <TEXT> \u00b7 mine \u00b7 rm <DOC> \u00b7 revert <DOC>");
    L.push("ANY OTHER WORD IS A COMMAND - /rtfm cheatsheet LISTS EVERY ONE.");
    return L.join("\n");
  }

  // The same shape the unknown-command refusal uses in chat.js: a small edit distance, so a typo is
  // answered with the word he probably meant instead of an index.
  function nearest(word, choices) {
    var w = norm(word).toLowerCase();
    if (!w) return "";
    var best = "", bestD = 99;
    choices.forEach(function (c) {
      var d = distance(w, String(c).toLowerCase());
      if (d < bestD) { bestD = d; best = c; }
    });
    return (best && bestD <= Math.max(1, Math.round(w.length / 3))) ? best : "";
  }
  function distance(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  // Hand the file to the browser's own download (the same road /backup uses for the zip).
  function download(text, name) {
    try {
      if (!("download" in document.createElement("a"))) return false;
      var blob = new Blob([text], { type: "text/markdown" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener";
      document.body.appendChild(a);
      try { a.click(); } catch (e) {}
      window.setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 6000);
      return true;
    } catch (e) { return false; }
  }

  function status() {
    if (!report) return "THE RTFM :: NOT READ YET";
    if (!report.loaded) return "THE RTFM :: UNREADABLE (" + report.failed + ")";
    var mine = localAll().length;
    return "THE RTFM :: " + report.count + " DOCUMENT" + (report.count === 1 ? "" : "S") + " FROM " + MANIFEST
      + (mine ? " :: " + mine + " WRITTEN HERE" : "")
      + " :: " + ((window.cmd && window.cmd.count) ? window.cmd.count() : 0) + " COMMANDS IN THE CHEATSHEET";
  }

  function describe() {
    if (!loadP) load();
    var L = [];
    var mine = localAll();
    L.push("THE RTFM :: THE MANUAL, KEPT AS DOCUMENTS (" + DIR + ")");
    L.push(status());
    L.push("");
    L.push("FOR YOU, NOT FOR HER :: nothing here is indexed, retrieved, or handed to her, and none of it writes to her memory.");
    L.push("PUBLIC :: everything shipped in " + DIR + " is in the generator and readable by anyone - put nothing private in it. A page you WRITE here is not in it: it is kept in this browser.");
    L.push("GENERATED :: the cheatsheet (" + DIR + "commands.md) is rendered from src/commands/commands.json, so it cannot disagree with the commands that exist. /rtfm check says whether the copy is current.");
    L.push("READ :: /rtfm \u00b7 /rtfm <DOC> \u00b7 /rtfm <COMMAND> \u00b7 /rtfm cheatsheet \u00b7 /rtfm check \u00b7 /rtfm export <DOC> \u00b7 /rtfm about");
    L.push("WRITE :: /rtfm new [NAME] opens the editor on a page of your own \u00b7 /rtfm edit <DOC> rewrites one that exists (a shipped page is SHADOWED here, never altered - /rtfm rm <DOC> puts the file back) \u00b7 /rtfm add <DOC> <TEXT> appends a line without the editor \u00b7 /rtfm mine lists what you have written. Pages written here live in THIS BROWSER (kv) and never in " + DIR + "; /rtfm export <DOC> downloads one as markdown so it can be dropped into the folder and ship.");
    L.push("ADDING ONE AS A FILE :: drop a .md in " + DIR + " and list it in " + DIR + "rtfm.json - /rtfm about PRINTS THE RECIPE.");
    if (docs.length) docs.forEach(function (d) {
      L.push("  \u00b7 " + d.title + " (" + d.id + ")" + (d.generated ? " [GENERATED]" : "") + (d.local ? (d.rewritten ? " [SHIPPED, REWRITTEN BY YOU HERE]" : " [WRITTEN BY YOU HERE]") : "") + " :: " + (d.desc || d.file));
    });
    else L.push("  (THE MANIFEST HAS NOT BEEN READ YET - /rtfm READS IT.)");
    if (!mine.length) L.push("NOTHING WRITTEN HERE YET :: /rtfm new <NAME> OPENS THE EDITOR.");
    return L.join("\n");
  }

  return {
    load: load,
    reload: async function () { loadP = null; local = null; await load(); return status(); },
    run: run,
    docs: all,
    mine: localAll,
    find: find,
    findShipped: findShipped,
    read: read,
    save: save,
    drop: drop,
    doc: doc,
    commandPage: commandPage,
    cheatsheetMarkdown: cheatsheetMarkdown,
    cheatsheet: cheatsheet,
    check: async function () { await load(); return await staleText(null); },
    export: download,
    describe: describe,
    status: status,
    slug: slug,
    storage: store,
    markdown: toTerminal
  };
})();
