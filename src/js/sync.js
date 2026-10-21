/* ------------------------------------------------------------------
   THE SYNC — the conversation out of this browser, and back.

   Patrikios, 2026-09-24: "Synch Versions to latest chat backups
   stored in G: Drive."

   WHY THIS EXISTS. The Sacred Archive (kv: sacred_archive / master_log,
   the newest 1000 turns) is the one thing in this terminal that is kept
   NOWHERE ELSE that matters: /backup zips the SOURCE out of the page,
   and the vault keeps the pictures, but the conversation itself lives in
   this browser's own storage and dies with it - a cleared profile, a new
   machine, a PURGE. The backups he keeps on his drive are the other half
   of that pair, and until now nothing here could read one back.

   WHAT THIS CAN AND CANNOT REACH (measured in the frame this terminal is
   served in, 2026-09-24, not assumed):
     - showDirectoryPicker() - the folder picker that hands back a HANDLE,
       so the terminal could read AND write a folder it remembers - is
       REFUSED here: "SecurityError: Cross origin sub frames aren't
       allowed to show a file picker." The terminal is served inside
       perchance.org's editor frame, and a cross-origin frame may not ask
       for a folder. So no handle, and no writing in place, from the
       editor's preview.
     - a <input type=file webkitdirectory> IS allowed, and a folder
       DROPPED on the page is readable, so the backups can always be
       TAKEN IN. What leaves goes out through the browser's own download.
     - opened at the top level (the tab the platform serves directly, with
       no frame above it) showDirectoryPicker IS allowed, and then
       CONNECT A FOLDER works: the handle is kept, and the sync writes
       into G: itself with no download step.

   THE BACKUPS IT KNOWS, by what is in them rather than by their names:
     lia-terminal-archive.json  this terminal's own backup - schema,
                                device, zone, and every turn verbatim, so
                                it round-trips exactly. Written by /sync up.
     archive_<digits>.txt       the readable export the EXPORT button (and
                                window.exportArchive) writes: "LIA SACRED
                                ARCHIVE EXPORT", one block per turn. Read
                                back as well as it can be - see THE TEXT
                                ROUND-TRIP below.
     anything else              listed, and left alone.

   THE MERGE, AND WHY IT IS SAFE. Turns are identified by `ts`, the moment
   he sent them, and that is the key:
     - a turn this device does not have AT ALL is taken in;
     - a turn it already has is KEPT AS IT IS - his archive is the record,
       and a backup is never allowed to overwrite it. The backup may only
       FILL what is missing on it: her half (`s`) if it is empty here, her
       stamp (`st`), his words (`h`), and any refs it does not carry
       (pictures attached, what she looked at, what she filed, her own
       lanes) - never replace one that is already there.
   So the worst a wrong or stale file can do is add turns. Nothing is
   ever deleted, and the archive's own 1000-turn cap is applied last, the
   same way every other write applies it, with a warning if it bites.

   THE TEXT ROUND-TRIP (honest limits). The readable export carries his
   words, her words, the layer, the stamps, and the media refs as vault
   ids, so all of that comes back. It does NOT carry the render recipe of
   an image in machine form (the creation line is prose), so `[IMAGE
   CREATED]` lines cannot be rebuilt into `gen` rows and are COUNTED, not
   faked - the receipt says how many were left behind. The JSON backup is
   the one that round-trips exactly.

   WHAT IT RECORDS. kv: lia_settings / sync - the same record that was
   already there when this was built (clientId, fileId, runs), kept and
   filled rather than replaced: `clientId` is this device's own name,
   stamped into every backup it writes so a folder holding several
   machines can say which wrote what; `fileId` names the newest file the
   sync has actually touched; `dir` is the folder it is pointed at; `runs`
   is the last twenty syncs - up or down, file, bytes, and what happened.

       /sync                     where the sync stands, and what it holds
       /sync status              the same, in full (the record, the runs)
       /sync versions            every backup in the folder, newest first
       /sync pick                choose the backup folder (or drop it on the panel)
       /sync connect             keep a folder and write into it (top-level tab only)
       /sync up                  write the archive OUT as lia-terminal-archive.json
       /sync down [NAME|newest]  take a backup in and merge it
       /sync forget              forget the folder (nothing on disk is touched)
       /sync help                this text

   NOTHING HERE UPLOADS ANYTHING. The only files it touches are the ones
   in the folder HE chooses, and the pictures and the vault are not part
   of it at all: this is the conversation, and it is his.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var SCHEMA = "lia-terminal-archive";
  var VERSION = 1;
  var ROLLING = "lia-terminal-archive.json";      // the live backup, always the newest
  var DATED = function (d) { return "lia-terminal-archive-" + d + ".json"; };  // one a day
  var REC_KEY = "sync";
  var HANDLE_DB = "lia_sync";
  var CAP = 1000;                                  // the archive's own cap (see chat.js saveEntry)
  var MAX_READ = 48 * 1024 * 1024;                 // a file bigger than this is not a chat backup (a 1000-turn backup is 1.4 MB)
  var MAX_FILES = 400;
  var MAX_DEPTH = 3;
  var RUNS_KEPT = 20;
  var VERSIONS_KEPT = 40;

  function el(id) { return document.getElementById(id); }
  function say(text, dim) { if (window.print && text) window.print("SYSTEM", text, !!dim); }
  function enc(s) { return new TextEncoder().encode(String(s)); }

  function stamp(ts) {
    if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts);
    return new Date(ts == null ? Date.now() : Number(ts)).toISOString().slice(0, 19).replace("T", " ") + " UTC";
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (Math.round((n / (1024 * 1024)) * 10) / 10) + " MB";
  }
  function age(at) {
    var mins = Math.floor(Math.max(0, Date.now() - (Number(at) || 0)) / 60000);
    if (mins < 1) return "less than a minute ago";
    if (mins < 60) return mins + " minute" + (mins === 1 ? "" : "s") + " ago";
    var h = Math.floor(mins / 60);
    if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
    var d = Math.floor(h / 24);
    return d + " day" + (d === 1 ? "" : "s") + " ago";
  }

  // THE BAR (src/js/progress.js). The sync is the one lane here whose slow part is a FOLDER FULL OF
  // FILES: picking a backup folder reads and sniffs every file in it (a count the rail can show), and
  // taking one in or writing the archive out is a 1000-turn JSON document read or written in one
  // piece (no count, so an indeterminate bar). Either way it is seconds of nothing on a slow disk,
  // and the rail is the only thing that says the tab is still working. ONE id ("sync") for the file:
  // a look is followed by a write in the same errand, and the second begin() continues the first.
  function pbar(label, total) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "sync", total: total,
        detail: "THE SYNC - the conversation out of this browser and back; nothing is uploaded",
      });
    } catch (e) {}
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("sync"); } catch (e) {}
  }

  // ---------------------------------------------------------------- the record (kv lia_settings / sync)

  var rec = null;

  function newDeviceId() {
    var a = new Uint8Array(5);
    try { crypto.getRandomValues(a); }
    catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    var out = "";
    for (var j = 0; j < a.length; j++) out += ("0" + a[j].toString(16)).slice(-2);
    return "LIA-" + out.toUpperCase();
  }

  async function loadRec() {
    if (rec) return rec;
    var r = null;
    try { r = await window.root.kv.lia_settings.get(REC_KEY); } catch (e) { r = null; }
    if (!r || typeof r !== "object") r = {};
    if (!Array.isArray(r.runs)) r.runs = [];
    if (typeof r.clientId !== "string" || !r.clientId) r.clientId = newDeviceId();
    if (typeof r.fileId !== "string") r.fileId = "";
    rec = r;
    try { await window.root.kv.lia_settings.set(REC_KEY, rec); } catch (e) {}
    return rec;
  }

  function addRun(dir, name, bytes, ok, note) {
    var r = rec || { runs: [] };
    if (!Array.isArray(r.runs)) r.runs = [];
    r.runs.push({ at: Date.now(), dir: dir, name: name || "", bytes: Number(bytes) || 0, ok: !!ok, note: String(note || "") });
    if (r.runs.length > RUNS_KEPT) r.runs = r.runs.slice(-RUNS_KEPT);
    try { window.root.kv.lia_settings.set(REC_KEY, r); } catch (e) {}
  }

  // ---------------------------------------------------------------- the folder handle (IndexedDB)

  function openHandleDb() {
    return new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open(HANDLE_DB, 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () { try { req.result.createObjectStore("handles"); } catch (e) {} };
      req.onerror = function () { resolve(null); };
      req.onsuccess = function () { resolve(req.result); };
    });
  }

  function handleOp(mode, fn) {
    return openHandleDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        var tx, out = null;
        try { tx = db.transaction("handles", mode); } catch (e) { try { db.close(); } catch (e2) {} resolve(null); return; }
        var req = fn(tx.objectStore("handles"));
        if (req) req.onsuccess = function () { out = req.result; };
        tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(out); };
        tx.onabort = tx.onerror = function () { try { db.close(); } catch (e) {} reject(tx.error); };
      });
    }).catch(function () { return null; });
  }

  function getHandle() {
    if (handleOverride) return Promise.resolve(handleOverride);
    return handleOp("readonly", function (s) { return s.get("dir"); });
  }

  // A HANDLE HANDED OVER RATHER THAN PICKED. Two honest uses: a page that already holds a folder
  // handle of its own (a script, a bookmarklet - anything that called showDirectoryPicker itself,
  // which only a TOP-LEVEL page may do) can point the sync at it; and a test can hand over a folder
  // of its own making, which is the only way the WRITE path - the one that puts a file into a real
  // folder - gets exercised without a human at a dialog. It is kept for the session only, and the
  // record says so: a handle nobody can promise on the next load is not written down as connected.
  var handleOverride = null;
  function attach(handle, opts) {
    if (!handle || typeof handle.entries !== "function" || typeof handle.getFileHandle !== "function") {
      return "THAT IS NOT A FOLDER HANDLE :: IT NEEDS entries() AND getFileHandle() (A File System Access DirectoryHandle).";
    }
    handleOverride = handle;
    var label = handle.name || "a folder";
    if (!opts || !opts.quiet) say("THE FOLDER \"" + String(label).toUpperCase() + "\" IS ATTACHED FOR THIS SESSION :: /sync up WRITES INTO IT, /sync versions READS IT. IT IS NOT REMEMBERED FOR THE NEXT LOAD (ONLY /sync connect KEEPS ONE), AND NOTHING ABOUT IT IS WRITTEN DOWN HERE.");
    if (isOpen()) paint();
    return "ATTACHED :: " + String(label).toUpperCase();
  }
  function putHandle(h) { return handleOp("readwrite", function (s) { return s.put(h, "dir"); }); }
  function dropHandle() { return handleOp("readwrite", function (s) { return s.delete("dir"); }); }

  function pickerAllowed() {
    return (typeof window.showDirectoryPicker === "function") && (window.top === window.self);
  }

  async function allow(handle, write) {
    var opts = { mode: write ? "readwrite" : "read" };
    try {
      if ((await handle.queryPermission(opts)) === "granted") return true;
      return (await handle.requestPermission(opts)) === "granted";
    } catch (e) { return false; }
  }

  // Walk a kept folder for candidate files. The handle API can do this without
  // reading a byte of anything that is not a backup.
  async function walkHandle(dir, out, depth) {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
    var it = dir.entries(), step;
    while (!(step = await it.next()).done) {
      if (out.length >= MAX_FILES) return;
      var name = step.value[0], h = step.value[1];
      if (h.kind === "file") {
        if (!isCandidate(name)) continue;
        try {
          var f = await h.getFile();
          if (f.size > 0 && f.size <= MAX_READ) out.push(f);
        } catch (e) {}
      } else if (h.kind === "directory") {
        if (/^\./.test(name)) continue;
        await walkHandle(h, out, depth + 1);
      }
    }
  }

  // A dropped folder arrives as a tree, not as files (Chrome's entries API).
  // readEntries() answers at most 100 at a time, so it is drained in a loop.
  function entryFile(entry) {
    return new Promise(function (resolve) { try { entry.file(function (f) { resolve(f); }, function () { resolve(null); }); } catch (e) { resolve(null); } });
  }
  function entryChildren(dir) {
    return new Promise(function (resolve) {
      var reader = dir.createReader(), all = [];
      var pump = function () {
        reader.readEntries(function (batch) {
          if (!batch || !batch.length) { resolve(all); return; }
          all = all.concat(batch);
          if (all.length > MAX_FILES) { resolve(all); return; }
          pump();
        }, function () { resolve(all); });
      };
      pump();
    });
  }
  async function walkEntry(entry, out, depth) {
    if (!entry || out.length >= MAX_FILES || depth > MAX_DEPTH) return;
    if (entry.isFile) {
      if (!isCandidate(entry.name)) return;
      var f = await entryFile(entry);
      if (f && f.size > 0 && f.size <= MAX_READ) out.push(f);
      return;
    }
    if (entry.isDirectory && !/^\./.test(entry.name)) {
      var kids = await entryChildren(entry);
      for (var i = 0; i < kids.length && out.length < MAX_FILES; i++) await walkEntry(kids[i], out, depth + 1);
    }
  }

  function isCandidate(name) {
    return /\.(json|txt)$/i.test(String(name)) && !/^\./.test(String(name));
  }

  // ---------------------------------------------------------------- reading a backup

  // A TURN IS COPIED WHOLE. This used to whitelist the fields the archive was believed to hold,
  // and that quietly ate two of them: `checkin` and `importedFresh` were dropped from every entry a
  // sync wrote back, and `kind` was rewritten on his own imported lane. Measured 2026-09-24 against
  // a pre-sync snapshot: `checkin x8` and `importedFresh x817` present before, gone after. So every
  // own enumerable key is carried over as-is now, and only the two numbers are normalised. The only
  // thing that makes an object a turn is its `ts` plus at least one of a half, a creation or a mark.
  function cleanEntry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var out = {};
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      out[k] = raw[k];
    }
    if (out.ts == null) return null;
    out.ts = Number(out.ts);
    if (isNaN(out.ts)) return null;
    if (!("h" in out) && !("s" in out) && !("kind" in out) && !("silent" in out)) return null;
    if (out.st != null) out.st = Number(out.st);
    return out;
  }

  function arrayish(v) { return Array.isArray(v) && v.length ? v : null; }

  function logFrom(raw) {
    var arr = null;
    if (Array.isArray(raw)) arr = raw;
    else if (raw && typeof raw === "object") {
      if (raw.schema === SCHEMA || raw.genSchema === SCHEMA) arr = arrayish(raw.log) || arrayish(raw.entries) || arrayish(raw.turns);
      if (!arr) arr = arrayish(raw.master_log) || arrayish(raw.log) || arrayish(raw.entries);
    }
    if (!arr) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) { var e = cleanEntry(arr[i]); if (e) out.push(e); }
    return out.length ? out : null;
  }

  // Is this JSON one of ours? Cheap shape check, because the inventory may be
  // looking at twenty files and only the pull needs the whole parse.
  function jsonSniff(text) {
    var head = text.slice(0, 400);
    if (!/^\s*[\[{]/.test(head)) return null;
    if (!/"ts"\s*:/.test(text)) return null;
    var turns = (text.match(/"ts"\s*:/g) || []).length;
    var dev = text.match(/"device"\s*:\s*"([^"]{1,64})"/);
    var gen = text.match(/"generator"\s*:\s*"([^"]{1,120})"/);
    var when = text.match(/"writtenAt"\s*:\s*(\d{10,16})/);
    return { kind: "json", turns: turns, device: dev ? dev[1] : "", generator: gen ? gen[1] : "", writtenAt: when ? Number(when[1]) : 0 };
  }

  function textSniff(text) {
    if (text.indexOf("LIA SACRED ARCHIVE EXPORT") === -1) return null;
    var turns = (text.match(/^\s*(\[[^\]]*\]\s*)?ROLE:/gm) || []).length;
    return { kind: "text", turns: turns, device: "", generator: "", writtenAt: 0 };
  }

  function sniff(text, name) {
    var got = null;
    if (/\.json$/i.test(name) || /^\s*[\[{]/.test(text.slice(0, 400))) got = jsonSniff(text);
    if (!got) got = textSniff(text);
    return got;
  }

  function parseLog(text, name) {
    var got = sniff(text, name);
    if (!got) return null;
    if (got.kind === "json") {
      var raw;
      try { raw = JSON.parse(text); } catch (e) { return { error: "THE FILE IS NOT VALID JSON" }; }
      var log = logFrom(raw);
      if (!log) return { error: "THE JSON HAS NO ARCHIVE IN IT" };
      var meta = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
      return { kind: "json", log: log, device: meta.device || "", generator: meta.generator || "", writtenAt: Number(meta.writtenAt) || 0, zone: meta.zone || "" };
    }
    var parsed = parseExportText(text);
    return { kind: "text", log: parsed.log, device: "", generator: "", writtenAt: 0, recipes: parsed.recipes, creations: parsed.creations, skipped: parsed.skipped };
  }

  // ---------------------------------------------------------------- the readable export, read back

  // The export (window.exportArchive / the EXPORT button) writes one line at a time: the header,
  // then a block per turn whose lines carry a stamp and a field name, a bare `---` between turns,
  // and an `[TAG]` line for everything that happened inside one (a picture attached, what she
  // looked at, what she filed, her own lanes).
  //
  // IT IS READ BACK LINE BY LINE RATHER THAN BLOCK BY BLOCK, and that is deliberate: `---` is BOTH
  // the writer's separator AND something the two of them type - a rule on its own line is a scene
  // break in a long turn - so splitting on it first cut turns in half. Measured on the archive of
  // 2026-09-24: seven turns lost their tail and eleven vanished entirely that way. A `---` is
  // therefore a separator only when the next line begins a new record; otherwise it is a line of
  // the text being written, put back where it was.
  //
  // What it cannot rebuild (the render recipe of `[IMAGE CREATED]`, which is prose) it COUNTS
  // instead of faking: a creation line comes back as a creation line, without its render rows.
  var STAMP_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?: [^\]]*)?\]\s?/;
  var FIELD_RE = /^\[?(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?: [^\]]*)?\]?\s*(ROLE|HITL|LIA ID)\s*:\s*(.*)$/;
  var CRE_RE = /^\s*(?:\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?: [^\]]*)?\]\s*)?CREATION \(NOT A TURN\):\s*([\s\S]*)$/;

  function stampToTs(s) {
    var t = Date.parse(String(s).replace(" ", "T"));
    return isNaN(t) ? null : t;
  }

  function refId(line) {
    var m = line.match(/LOCAL VAULT\s+([A-Za-z0-9_-]{2,64})\s*$/);
    return m ? m[1] : "";
  }

  function parseExportText(text) {
    var lines = String(text).split(/\r?\n/);
    var out = [], recipes = 0, creations = 0, skipped = 0, seq = 0;
    var cur = null, field = null;
    var lastTs = null;

    function flush() {
      if (!cur) return;
      if (cur.ts == null && cur.st != null) cur.ts = cur.st;
      if (cur.ts == null) { if (lastTs == null) lastTs = Date.now() - lines.length * 1000; cur.ts = lastTs + (seq++); }
      lastTs = cur.ts;
      if (cur.h === undefined && cur.s === undefined) { skipped++; cur = null; return; }
      if (cur.h === undefined) cur.h = "";
      if (cur.s === undefined) cur.s = "";
      if (!/[\w]/.test(String(cur.h) + String(cur.s))) { skipped++; cur = null; return; }
      // A trailing blank line belongs to the separator, not to the words: the writer puts `---` on
      // its own line after the text, so the newlines before it are neither his nor hers.
      cur.h = String(cur.h).replace(/\n+$/, "");
      cur.s = String(cur.s).replace(/\n+$/, "");
      if (!cur.imported) cur.imported = { from: "text" };
      out.push(cur);
      cur = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // THE SEPARATOR, OR A RULE INSIDE THE WORDS (see the note above). Blank lines are stepped over
      // when peeking: the file ends with a newline after the last separator, and reading that as
      // "something follows" used to glue a stray `---` onto the end of the newest turn's words.
      if (/^---\s*$/.test(line)) {
        var k2 = i + 1;
        while (k2 < lines.length && lines[k2].trim() === "") k2++;
        var nxt = k2 < lines.length ? lines[k2] : undefined;
        if (nxt === undefined || FIELD_RE.test(nxt) || CRE_RE.test(nxt)) { flush(); field = null; }
        else if (cur && field) cur[field] += "\n---";
        continue;
      }

      var f = line.match(FIELD_RE);
      if (f) {
        var ts = stampToTs(f[1]);
        var what = f[2], rest = f[3];
        if (what === "ROLE") {
          flush();
          cur = { role: (/^OFF\s*STAGE$/i.test(rest.trim()) ? "" : rest.trim().toLowerCase()) };
          field = null;
          if (ts != null) cur.ts = ts;
          continue;
        }
        if (!cur) cur = { role: "" };
        rest = rest.replace(/^\([^)]*\)\s?/, "");   // the layer name in brackets, already known from ROLE
        if (what === "HITL") {
          // THE PENCIL'S MARK RIDES ON THIS LINE. An entry he fixed after the fact (src/js/editlog.js)
          // is written with `   [EDITED ON THIS DEVICE AFTER THE FACT: <stamp>]` appended to his
          // words, on the same line - so it is taken back off here, and the entry keeps the fact that
          // it was edited and when. Without this the marker would end up inside `h`, and the turn
          // would come back with a sentence neither of them wrote glued to the end of it.
          var ed = rest.match(/\s*\[EDITED ON THIS DEVICE AFTER THE FACT(?::\s*([0-9-]{10}[ T][0-9:]{5,8})(?: [^\]]*)?)?\]\s*$/);
          if (ed) {
            cur.edited = true;
            if (ed[1]) { var edTs = stampToTs(ed[1].trim().replace("T", " ")); if (edTs != null) cur.editedAt = edTs; }
            rest = rest.slice(0, rest.length - ed[0].length);
          }
          if (/^\[nothing - she spoke first\]$/i.test(rest.trim())) rest = "";
          cur.h = rest;
          if (ts != null && cur.ts == null) cur.ts = ts;
          field = "h";
        } else {
          cur.s = rest;
          if (ts != null) cur.st = ts;
          field = "s";
        }
        continue;
      }

      var cre = line.match(CRE_RE);
      if (cre) {
        // A thing the terminal MADE (a render, an upscale, a batch): the line comes back, because it
        // is a record of the terminal's own work, but its `[IMAGE CREATED]` rows are prose in this
        // format and cannot be rebuilt into the render book - those are counted (`recipes`).
        flush();
        cur = { kind: "create", silent: true, role: "", h: cre[2], s: "" };
        if (cre[1]) cur.ts = stampToTs(cre[1]);
        creations++;
        field = "h";
        continue;
      }

      if (/^\s*\[IMAGE CREATED\]/.test(line)) { recipes++; field = null; continue; }

      // THE THINGS THAT HAPPENED INSIDE THE TURN, by their own tag.
      var mref = line.match(/^\s*\[(IMAGE ATTACHED|CLIP ATTACHED|SHE LOOKED AT|SHE ASKED TO SEE THIS AGAIN|SHE READ THE RECORD|SHE FILED INTO [^\]]*|SHE MADE THE FOLDER|ARCHIVAX :: [A-Z]+|SHE KEPT IN HER OWN MEMORY|SHE LET ONE OF HERS GO|SHE WROTE DOWN AS HERS|SHE LET A WANT GO)\]\s*(.*)$/);
      if (mref) {
        if (!cur) cur = { role: "" };
        var tag = mref[1], body = mref[2];
        if (tag === "IMAGE ATTACHED") { (cur.img = cur.img || []).push(refId(line)); }
        else if (tag === "CLIP ATTACHED") { (cur.vid = cur.vid || []).push(refId(line)); }
        else if (tag === "SHE LOOKED AT") { (cur.sight = cur.sight || []).push(refId(line)); }
        else if (tag === "SHE ASKED TO SEE THIS AGAIN") { (cur.show = cur.show || []).push(refId(line)); }
        else if (tag === "SHE READ THE RECORD") { (cur.read = cur.read || []).push({ read: body.split(" :: ")[0], title: body.split(" :: ")[1] || "" }); }
        else if (/^SHE FILED INTO /.test(tag)) { (cur.filed = cur.filed || []).push({ folder: tag.replace(/^SHE FILED INTO /, ""), filed: body.split("  \u00b7  ") }); }
        else if (tag === "SHE MADE THE FOLDER") { (cur.filed = cur.filed || []).push({ folder: body.split("  \u00b7  ") }); }
        else if (/^ARCHIVAX :: /.test(tag)) { (cur.ops = cur.ops || []).push({ op: tag.replace(/^ARCHIVAX :: /, "").toLowerCase(), text: body }); }
        else if (tag === "SHE KEPT IN HER OWN MEMORY") { (cur.hers = cur.hers || []).push({ keep: body }); }
        else if (tag === "SHE LET ONE OF HERS GO") { (cur.hers = cur.hers || []).push({ letGo: body }); }
        else if (tag === "SHE WROTE DOWN AS HERS") { (cur.hers = cur.hers || []).push({ want: body }); }
        else if (tag === "SHE LET A WANT GO") { (cur.hers = cur.hers || []).push({ released: [body] }); }
        field = null;
        continue;
      }

      // Any other line that opens with a stamp is a record this reader does not know: it ends the
      // text it was inside rather than being swallowed into it.
      if (STAMP_RE.test(line)) { field = null; continue; }

      // A continuation of whatever was being written (his or her half, which may hold blank lines,
      // stage directions, and rules).
      if (field && cur) cur[field] += "\n" + line;
    }
    flush();
    return { log: out, recipes: recipes, creations: creations, skipped: skipped };
  }

  // ---------------------------------------------------------------- the merge

  var REF_FIELDS = ["img", "vid", "gen", "sight", "show", "read", "filed", "ops", "hers", "atts", "focus"];

  // The identity of a turn is `ts` - the moment he sent it - and that is the key of the merge. A
  // JSON backup carries it to the millisecond, so there it is an exact match. THE READABLE EXPORT
  // CANNOT: it stamps `2026-09-21 14:03:11 MST` and whole seconds are all it holds, so a turn read
  // back from text lands up to 999 ms away from the same turn here. Matching on the exact number
  // alone therefore treated every turn in a text backup as a NEW one - measured 2026-09-24 on a real
  // backup: 995 "new" turns pushed 995 of his own out through the archive's cap. So a twin is looked
  // for exactly first, then inside one second, and the tolerance is deliberately narrow: two turns
  // of his inside the same second are rare, and this is the only case where a turn of his could be
  // read as one he already has.
  function mergeLogs(local, incoming) {
    var by = Object.create(null), exact = Object.create(null), i, e;
    for (i = 0; i < local.length; i++) {
      e = cleanEntry(local[i]);
      if (e && e.ts != null) { by[String(e.ts)] = e; exact[String(e.ts)] = e; }
    }
    var list = [], keys = Object.keys(by);
    for (i = 0; i < keys.length; i++) list.push(by[keys[i]]);
    list.sort(function (a, b) { return (Number(a.ts) || 0) - (Number(b.ts) || 0); });
    var used = Object.create(null);
    var TOLERANCE = 1000;

    function twin(ts) {
      var hit = exact[String(ts)];
      if (hit && !used[String(ts)]) { used[String(ts)] = 1; return hit; }
      var best = null, bestD = TOLERANCE + 1;
      for (var k = 0; k < list.length; k++) {
        var lt = Number(list[k].ts), key = String(lt);
        if (used[key]) continue;
        var d = Math.abs(lt - ts);
        if (d < bestD) { best = list[k]; bestD = d; }
      }
      if (best && bestD <= TOLERANCE) { used[String(best.ts)] = 1; return best; }
      return null;
    }

    var added = 0, filled = 0, held = 0;
    for (i = 0; i < incoming.length; i++) {
      e = cleanEntry(incoming[i]);
      if (!e || e.ts == null) continue;
      var cur = twin(e.ts);
      if (!cur) { by[String(e.ts)] = e; used[String(e.ts)] = 1; added++; continue; }
      // The turn he already holds is the record. The backup only fills in what is MISSING.
      held++;
      var touched = false;
      if (!cur.s && e.s) { cur.s = e.s; touched = true; }
      if ((cur.h === undefined || cur.h === null || cur.h === "") && e.h) { cur.h = e.h; touched = true; }
      if (cur.st == null && e.st != null) { cur.st = e.st; touched = true; }
      for (var j = 0; j < REF_FIELDS.length; j++) {
        var f = REF_FIELDS[j];
        if ((cur[f] === undefined || cur[f] === null || (Array.isArray(cur[f]) && !cur[f].length)) && e[f] && (!Array.isArray(e[f]) || e[f].length)) {
          cur[f] = e[f];
          touched = true;
        }
      }
      if (touched) filled++;
    }
    var out = [], all = Object.keys(by);
    for (i = 0; i < all.length; i++) out.push(by[all[i]]);
    out.sort(function (a, b) { return (Number(a.ts) || 0) - (Number(b.ts) || 0); });
    var dropped = Math.max(0, out.length - CAP);
    if (dropped) out = out.slice(-CAP);
    return { log: out, added: added, filled: filled, held: held, dropped: dropped };
  }

  // ---------------------------------------------------------------- the look (what the folder holds)

  var inventory = [];    // [{name, bytes, at, kind, turns, device, why, file}]
  var lookedAt = 0;
  var lookWhere = "";

  function byNewest(a, b) {
    var am = Math.max(Number(a.at) || 0, Number(a.writtenAt) || 0);
    var bm = Math.max(Number(b.at) || 0, Number(b.writtenAt) || 0);
    return bm - am || String(a.name).localeCompare(String(b.name));
  }

  // Take the files in hand (the folder he picked, what he dropped, or a kept
  // handle's contents) and work out which of them are chat backups. Reading a
  // file only as far as its SHAPE keeps a folder of twenty backups cheap: the
  // whole parse happens when one is actually taken in.
  async function look(files, where) {
    inventory = [];
    lookedAt = Date.now();
    lookWhere = where || "the folder in hand";
    var list = Array.prototype.slice.call(files || []);
    // Picking a folder reads and sniffs EVERY file in it before the list is drawn, and a folder of
    // twenty backups is twenty file reads on a real disk - so this is one of the few places in the
    // sync with an honest count to give.
    var P = pbar("READING THE BACKUP FOLDER", list.length);
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (P) P.set(i + 1);
      var name = f.name || "file";
      var at = Number(f.lastModified) || 0;
      var row = { name: name, bytes: Number(f.size) || 0, at: at, kind: "other", turns: 0, device: "", why: "NOT A CHAT BACKUP", file: f };
      if (row.bytes > MAX_READ) { row.why = "LARGER THAN " + fmtSize(MAX_READ) + " - NOT READ"; inventory.push(row); continue; }
      var text = null;
      try { text = await f.text(); } catch (e) { row.why = "COULD NOT BE READ"; inventory.push(row); continue; }
      var got = sniff(text, name);
      if (!got) { inventory.push(row); continue; }
      // EXACT, NOT ESTIMATED. The shape sniff is only good enough to say "this is one of ours"; the
      // count of turns a file holds is a FACT he will read off this list and compare against the
      // archive, so the file is read all the way through with the same reader a pull uses. Measured:
      // a 1.4 MB backup parses in a few milliseconds, and twenty of them in a folder cost well under
      // a second - cheap enough that a number on this list never needs to be an approximation.
      var full = parseLog(text, name);
      if (!full || full.error) { row.why = String((full && full.error) || "NOT A CHAT BACKUP"); inventory.push(row); continue; }
      if (got.kind === "json") { row.kind = "json"; row.why = "THIS TERMINAL'S OWN BACKUP"; }
      else { row.kind = "text"; row.why = "THE READABLE EXPORT (HIS WORDS, HER WORDS, THE STAMPS)"; }
      row.turns = full.log.length;
      row.creations = full.creations || 0;
      row.recipes = full.recipes || 0;
      row.device = full.device || "";
      row.writtenAt = full.writtenAt || 0;
      if (!at && got.writtenAt) row.at = got.writtenAt;
      inventory.push(row);
    }
    inventory.sort(byNewest);
    await rememberLook();
    pbarDone();
    return inventory;
  }

  async function rememberLook() {
    var r = await loadRec();
    r.lookedAt = lookedAt;
    r.dirName = lookWhere;
    r.versions = inventory.slice(0, VERSIONS_KEPT).map(function (v) {
      return { name: v.name, bytes: v.bytes, at: v.at || v.writtenAt || 0, kind: v.kind, turns: v.turns };
    });
    try { await window.root.kv.lia_settings.set(REC_KEY, r); } catch (e) {}
  }

  function archivable() { return inventory.filter(function (v) { return v.kind === "json" || v.kind === "text"; }); }
  function newestArchivable() { var a = archivable(); return a.length ? a[0] : null; }
  function findVersion(name) {
    var want = String(name || "").trim().toLowerCase();
    if (!want || want === "newest" || want === "latest") return newestArchivable();
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].name.toLowerCase() === want) return inventory[i];
    }
    for (var j = 0; j < inventory.length; j++) {
      if (inventory[j].name.toLowerCase().indexOf(want) !== -1) return inventory[j];
    }
    return null;
  }

  // ---------------------------------------------------------------- the two directions

  function localLog() {
    return window.root.kv.sacred_archive.get("master_log").then(function (log) { return Array.isArray(log) ? log : []; });
  }

  async function pull(name, opts) {
    opts = opts || {};
    var row = findVersion(name);
    if (!row) {
      if (!inventory.length) return "NO BACKUP IS IN HAND :: /sync pick (OR DROP THE FOLDER ON THE SYNC PANEL) FIRST, THEN /sync down.";
      return "NO BACKUP CALLED \"" + String(name || "").toUpperCase() + "\" IN " + lookWhere.toUpperCase() + " :: /sync versions LISTS WHAT IS THERE.";
    }
    if (row.kind !== "json" && row.kind !== "text") return "\"" + row.name.toUpperCase() + "\" IS NOT A CHAT BACKUP (" + row.why + ").";
    // THE BAR. Reading the backup and merging it has no count to give - it is one file and one pass
    // over up to a thousand turns - so this is an indeterminate burst rather than a fraction.
    pbar("TAKING A BACKUP IN", 0);
    var text;
    try { text = await row.file.text(); } catch (e) { pbarDone(); return "THAT FILE COULD NOT BE READ NOW :: " + String((e && e.message) || e).toUpperCase(); }
    var got = parseLog(text, row.name);
    if (!got || got.error) { pbarDone(); return "\"" + row.name.toUpperCase() + "\" COULD NOT BE READ :: " + ((got && got.error) || "NOT A CHAT BACKUP") + "."; }
    var local = await localLog();
    var before = local.length;
    var res = mergeLogs(local, got.log);
    var lines = [];
    if (res.added || res.filled) {
      try { await window.root.kv.sacred_archive.set("master_log", res.log); }
      catch (e) { pbarDone(); return "THE MERGE COULD NOT BE WRITTEN :: " + String((e && e.message) || e).toUpperCase(); }
      lines.push("SYNC :: " + res.added + " TURN" + (res.added === 1 ? "" : "S") + " CAME BACK FROM " + row.name.toUpperCase()
        + (res.filled ? " AND " + res.filled + " ALREADY HELD HERE W" + (res.filled === 1 ? "AS" : "ERE") + " FILLED IN (HER HALF, THE STAMP, WHAT WAS MISSING)" : "") + ".");
      if (res.held && !res.filled) lines.push("  EVERY TURN IN THE FILE WAS ALREADY HERE, AND NOTHING ABOUT THEM WAS CHANGED.");
      if (res.dropped) lines.push("  !! THE ARCHIVE KEEPS THE NEWEST " + CAP + " TURNS, SO " + res.dropped + " OLDER TURN" + (res.dropped === 1 ? "" : "S") + " STAYED IN THE FILE AND NOT IN THE LIVE ARCHIVE.");
      if (got.creations) lines.push("  " + got.creations + " CREATION LINE" + (got.creations === 1 ? "" : "S") + " (WHAT THE TERMINAL MADE) CAME BACK AS LINES" + (got.recipes ? ", BUT THE " + got.recipes + " RENDER RECIPE" + (got.recipes === 1 ? "" : "S") + " UNDER THEM COULD NOT BE REBUILT - THE READABLE EXPORT CARRIES A PICTURE'S RECIPE AS PROSE, NOT AS A RECORD, SO THE RENDER BOOK KEEPS ONLY WHAT THE JSON BACKUP CARRIES" : "") + ". THE TURNS THEMSELVES CAME BACK WHOLE.");
      if (got.skipped) lines.push("  " + got.skipped + " BLOCK" + (got.skipped === 1 ? "" : "S") + " WITH NOTHING IN EITHER HALF WERE SKIPPED (EMPTY RECORDS).");
      lines.push("  ARCHIVE NOW :: " + before + " TURNS -> " + res.log.length + " TURNS" + (res.log.length ? ", NEWEST " + stamp(res.log[res.log.length - 1].ts) : "") + ".");
    } else {
      lines.push("SYNC :: NOTHING NEW IN " + row.name.toUpperCase() + " :: ALL " + res.held + " TURNS IN IT ARE ALREADY HELD HERE, EXACTLY AS THIS DEVICE HAS THEM. NOTHING WAS CHANGED.");
    }
    var r = await loadRec();
    r.fileId = row.name + "@" + Math.max(Number(row.at) || 0, Number(row.writtenAt) || 0);
    r.lastPull = { at: Date.now(), name: row.name, added: res.added, filled: res.filled };
    addRun("down", row.name, row.bytes, true, res.added + " new, " + res.filled + " filled");
    if (!opts.quiet) say(lines.join("\n"));
    if (isOpen()) { note(lines.join("\n")); paint(); }
    pbarDone();
    return lines.join("\n");
  }

  async function build() {
    var log = await localLog();
    var r = await loadRec();
    var doc = {
      schema: SCHEMA,
      version: VERSION,
      generator: window.generatorName || "",
      device: r.clientId,
      zone: (window.logTime && window.logTime.zoneLabel) ? window.logTime.zoneLabel() : "",
      writtenAt: Date.now(),
      turns: log.length,
      first: log.length ? log[0].ts : null,
      last: log.length ? log[log.length - 1].ts : null,
      log: log
    };
    return { doc: doc, text: JSON.stringify(doc, null, 1), turns: log.length, first: doc.first, last: doc.last };
  }

  function download(text, name) {
    var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); } catch (e) {} URL.revokeObjectURL(url); }, 4000);
  }

  async function writeInto(handle, name, text) {
    var fh = await handle.getFileHandle(name, { create: true });
    var w = await fh.createWritable();
    await w.write(enc(text));
    await w.close();
  }

  // The other direction: the archive as one JSON file, written into the kept
  // folder when there is one (the rolling file always, plus one dated file a day
  // so the folder accumulates VERSIONS rather than only the newest state), and
  // handed to the browser's own download when there is not.
  async function up(opts) {
    opts = opts || {};
    // THE BAR. build() is one JSON.stringify of up to a thousand turns and the write is one or two
    // files - no count to give, but not instant either, and this is an errand he pressed a button for.
    pbar("WRITING THE ARCHIVE", 0);
    var built = await build();
    if (!built.turns) {
      addRun("up", ROLLING, 0, false, "the archive is empty");
      pbarDone();
      return "THE ARCHIVE IS EMPTY :: THERE IS NOTHING TO WRITE OUT.";
    }
    var r = await loadRec();
    var wrote = [], dirName = "";
    var handle = await getHandle();
    if (handle) {
      dirName = "the connected folder (" + handle.name + ")";
      if (!(await allow(handle, true))) {
        handle = null;
        addRun("up", ROLLING, 0, false, "the folder was not re-granted");
      } else {
        var day = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        var dated = DATED(day);
        var names = [ROLLING];
        var have = await listNames(handle);
        if (have.indexOf(dated) === -1) names.push(dated);
        try {
          for (var i = 0; i < names.length; i++) { await writeInto(handle, names[i], built.text); wrote.push(names[i]); }
        } catch (e) {
          wrote = [];
          handle = null;
          addRun("up", names[0], 0, false, String((e && e.message) || e));
        }
      }
    }
    if (!wrote.length) {
      download(built.text, ROLLING);
      wrote = [ROLLING + " (this machine's Downloads folder)"];
      dirName = "this machine's Downloads folder (no folder is connected)";
    }
    r.fileId = ROLLING;
    r.lastUp = { at: Date.now(), name: ROLLING, turns: built.turns, bytes: built.text.length };
    r.dirName = dirName;
    addRun("up", ROLLING, built.text.length, true, built.turns + " turns into " + dirName);
    var out = "THE BACKUP IS WRITTEN :: " + wrote.join(" + ") + " :: " + built.turns + " TURNS / " + fmtSize(built.text.length)
      + " - INTO " + dirName.toUpperCase() + "."
      + "\n  IT CARRIES EVERY TURN VERBATIM (HIS WORDS, HER WORDS, THE STAMPS, THE LAYER, THE MEDIA REFS AND HER OWN LANES), SO IT READS BACK EXACTLY - UNLIKE THE READABLE EXPORT, WHICH CAME FROM THIS SAME ARCHIVE AS PROSE."
      + "\n  A BACKUP IS NOT A SAVE: THIS IS THE CONVERSATION, NOT THE GENERATOR'S SOURCE. /backup IS THE OTHER ONE.";
    pbarDone();
    if (opts.quiet) return out;
    say(out);
    if (isOpen()) { note(out); paint(); }
    return out;
  }

  async function listNames(handle) {
    var names = [];
    try {
      var it = handle.entries(), step;
      while (!(step = await it.next()).done) { if (step.value[1].kind === "file") names.push(step.value[0]); }
    } catch (e) {}
    return names;
  }

  // ---------------------------------------------------------------- connect / pick

  async function connect(opts) {
    opts = opts || {};
    if (typeof window.showDirectoryPicker !== "function") {
      return "THIS BROWSER HAS NO FOLDER PICKER AT ALL (THE FILE SYSTEM ACCESS API IS MISSING). USE PICK OR DROP INSTEAD - THE BACKUPS STILL COME IN, AND WHAT LEAVES GOES TO THE DOWNLOADS FOLDER.";
    }
    if (window.top !== window.self) {
      return "THE FOLDER PICKER IS REFUSED IN THIS FRAME :: \"CROSS ORIGIN SUB FRAMES AREN'T ALLOWED TO SHOW A FILE PICKER.\" THIS TERMINAL IS SERVED INSIDE ANOTHER PAGE HERE, AND ONLY A FOLDER HANDLE COULD BE REMEMBERED AND WRITTEN INTO - SO FROM THIS FRAME IT IS PICK AND DROP ONLY:\n"
        + "  /sync pick            CHOOSE THE BACKUP FOLDER AND READ IT (NOTHING IS WRITTEN TO IT)\n"
        + "  /sync up              WRITE THE BACKUP OUT - IT LANDS IN THIS MACHINE'S DOWNLOADS FOLDER\n"
        + "  TO WRITE STRAIGHT INTO G: INSTEAD, OPEN THE TERMINAL IN ITS OWN TAB (null.perchance.org/" + (window.generatorName || "") + ") AND PRESS SYNC THERE: A TOP-LEVEL PAGE MAY ASK FOR A FOLDER, AND THE HANDLE IS KEPT.";
    }
    try {
      var h = await window.showDirectoryPicker({ id: "lia-terminal-archive", mode: "readwrite" });
      var ok = await allow(h, true);
      await putHandle(h);
      handleOverride = null;   // a remembered handle replaces one that was only attached
      var r = await loadRec();
      r.dir = { name: h.name, at: Date.now(), handle: true };
      r.dirName = "the connected folder (" + h.name + ")";
      try { await window.root.kv.lia_settings.set(REC_KEY, r); } catch (e) {}
      if (!opts.quiet) say("THE FOLDER IS CONNECTED :: " + h.name.toUpperCase() + (ok ? "" : " (READ ONLY - THE WRITE PERMISSION WAS NOT GRANTED)") + "\n  /sync up WRITES " + ROLLING + " INTO IT; /sync versions READS IT BACK. THE HANDLE IS KEPT ON THIS DEVICE, AND THE BROWSER WILL ASK AGAIN AFTER A RESTART.");
      if (isOpen()) { note("CONNECTED :: " + h.name.toUpperCase()); paint(); }
      return "CONNECTED :: " + h.name.toUpperCase() + (ok ? "" : " (READ ONLY)");
    } catch (e) {
      if (e && e.name === "AbortError") return "NOTHING WAS CONNECTED :: THE FOLDER DIALOG WAS DISMISSED.";
      return "THE FOLDER COULD NOT BE CONNECTED :: " + String((e && (e.message || e.name)) || e).toUpperCase();
    }
  }

  async function forget(opts) {
    handleOverride = null;
    await dropHandle();
    var r = await loadRec();
    delete r.dir;
    r.dirName = "";
    try { await window.root.kv.lia_settings.set(REC_KEY, r); } catch (e) {}
    if (!opts || !opts.quiet) say("THE FOLDER IS FORGOTTEN ON THIS DEVICE (NOTHING ON DISK WAS TOUCHED). A NEW ONE CAN BE CONNECTED OR PICKED AT ANY TIME.");
    if (isOpen()) paint();
    return "FORGOTTEN";
  }

  // ---------------------------------------------------------------- the panel

  function isOpen() { var p = el("syncPanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("syncPanel");
    if (!p) return;
    if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close();
    if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close();
    if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close();
    if (window.vox && window.vox.isOpen && window.vox.isOpen()) window.vox.close();
    if (window.pair && window.pair.isOpen && window.pair.isOpen()) window.pair.panelClose();
    if (typeof closeForge === "function" && el("createPanel") && !el("createPanel").hidden) closeForge();
    p.hidden = false;
    paint();
    // THE CLOUD ROAD IS PAINTED HERE TOO (src/js/sync-cloud.js). It is a separate module with its
    // own section in this same panel, and it only ever repaints when the panel is open - so the
    // moment this panel opens, is the moment the cloud section is asked to draw itself.
    if (window.cloudSync && window.cloudSync.panel) { try { window.cloudSync.panel(); } catch (e) {} }
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function close() {
    var p = el("syncPanel");
    if (p) p.hidden = true;
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function toggle() { if (isOpen()) close(); else open(); }

  function note(msg, bad) {
    var n = el("syNote");
    if (!n) return;
    n.textContent = msg || "";
    n.className = "syNote" + (bad ? " bad" : "");
  }

  function stateText(r) {
    var bits = [];
    bits.push(inventory.length ? inventory.length + " FILE" + (inventory.length === 1 ? "" : "S") + " IN HAND" : "NO FOLDER IN HAND YET");
    bits.push(r && r.clientId ? r.clientId : "");
    return bits.filter(Boolean).join(" \u00b7 ");
  }

  function row(node) {
    var wrap = document.createElement("div");
    wrap.className = "syRow" + (node.kind === "json" || node.kind === "text" ? "" : " syOther");
    var main = document.createElement("div");
    main.className = "syMain";
    var nm = document.createElement("div");
    nm.className = "syName";
    nm.textContent = node.name;
    var meta = document.createElement("div");
    meta.className = "syMeta";
    var when = node.at || node.writtenAt;
    meta.textContent = [
      node.kind === "json" ? "THIS TERMINAL'S BACKUP" : (node.kind === "text" ? "READABLE EXPORT" : node.why),
      when ? stamp(when) : "",
      node.turns ? node.turns + " TURNS" : "",
      node.creations ? "+ " + node.creations + " MADE" : "",
      node.bytes ? fmtSize(node.bytes) : "",
      node.device ? "WRITTEN BY " + node.device : ""
    ].filter(Boolean).join("  \u00b7  ");
    main.appendChild(nm);
    main.appendChild(meta);
    wrap.appendChild(main);
    if (node.kind === "json" || node.kind === "text") {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "syPull";
      b.textContent = "PULL";
      b.title = node.turns + " turns in this file - the ones this device does not already hold are taken in, and the ones it holds are kept exactly as they are";
      b.addEventListener("click", function () { note("READING " + node.name + " ..."); b.disabled = true; pull(node.name).then(function () { b.disabled = false; paint(); }); });
      wrap.appendChild(b);
    }
    return wrap;
  }

  async function paint() {
    var list = el("syList");
    var where = el("syWhere");
    var st = el("syState");
    if (!list && !where && !st) return;
    var r = await loadRec();
    var handle = await getHandle();
    if (where) {
      where.textContent = handle
        ? ("FOLDER :: " + handle.name + (lookWhere ? " \u00b7 LAST LOOK AT " + lookWhere : ""))
        : (lookWhere ? "IN HAND :: " + lookWhere + " (NOT KEPT - A PICK OR A DROP IS GOOD FOR THIS SESSION)" : "NO FOLDER IS CONNECTED AND NOTHING IS IN HAND :: PRESS PICK AND CHOOSE THE BACKUP FOLDER ON YOUR DRIVE, OR DROP IT ON THIS PANEL.");
    }
    if (st) st.textContent = stateText(r);
    var conn = el("syConnect");
    if (conn) conn.hidden = !!handle;
    if (list) {
      list.innerHTML = "";
      if (!inventory.length) {
        var empty = document.createElement("div");
        empty.className = "syEmpty";
        empty.textContent = "NO FOLDER HAS BEEN LOOKED AT YET \u00b7 PRESS PICK, OR DROP THE BACKUP FOLDER (OR THE FILES) ON THIS PANEL. NOTHING IS UPLOADED AND NOTHING IS CHANGED BY LOOKING.";
        list.appendChild(empty);
      } else {
        inventory.forEach(function (v) { list.appendChild(row(v)); });
      }
    }
  }

  function wire() {
    var btn = el("syPick");
    if (btn && !btn.dataset.built) {
      btn.dataset.built = "1";
      btn.addEventListener("click", function () { pick(); });
    }
    var conn = el("syConnect");
    if (conn && !conn.dataset.built) {
      conn.dataset.built = "1";
      conn.addEventListener("click", function () { note("ASKING THE BROWSER FOR A FOLDER..."); connect().then(function (m) { note(m, /REFUSED|COULD NOT|NO FOLDER PICKER/.test(String(m))); paint(); }); });
    }
    var upBtn = el("syUp");
    if (upBtn && !upBtn.dataset.built) {
      upBtn.dataset.built = "1";
      upBtn.addEventListener("click", function () { note("WRITING THE ARCHIVE OUT..."); up().then(function (m) { note(String(m).split("\n")[0]); paint(); }, function (e) { note("COULD NOT BE WRITTEN :: " + String((e && e.message) || e), true); }); });
    }
    var downBtn = el("syDown");
    if (downBtn && !downBtn.dataset.built) {
      downBtn.dataset.built = "1";
      downBtn.addEventListener("click", function () { note("TAKING THE NEWEST BACKUP IN..."); pull("newest").then(function () { paint(); }); });
    }
    var forgetBtn = el("syForget");
    if (forgetBtn && !forgetBtn.dataset.built) {
      forgetBtn.dataset.built = "1";
      forgetBtn.addEventListener("click", function () { forget(); });
    }
    var closeBtn = el("syClose");
    if (closeBtn && !closeBtn.dataset.built) {
      closeBtn.dataset.built = "1";
      closeBtn.addEventListener("click", close);
    }
    var input = el("syncDirInput");
    if (input && !input.dataset.built) {
      input.dataset.built = "1";
      input.addEventListener("change", function () {
        var files = input.files ? Array.prototype.slice.call(input.files) : [];
        input.value = "";
        if (!files.length) return;
        var top = "";
        for (var i = 0; i < files.length; i++) {
          var rel = files[i].webkitRelativePath || "";
          top = rel.split("/")[0] || top;
          if (top) break;
        }
        note("READING " + files.length + " FILE" + (files.length === 1 ? "" : "S") + " ...");
        look(files, top ? "the folder \"" + top + "\"" : "the files you picked").then(function () {
          note(describeLook());
          return autoPull();
        }).then(function () { paint(); });
      });
    }
    var panel = el("syncPanel");
    if (panel && !panel.dataset.dropped) {
      panel.dataset.dropped = "1";
      panel.addEventListener("dragover", function (e) { e.preventDefault(); panel.classList.add("syOver"); });
      panel.addEventListener("dragleave", function () { panel.classList.remove("syOver"); });
      panel.addEventListener("drop", function (e) {
        e.preventDefault();
        panel.classList.remove("syOver");
        takeDrop(e.dataTransfer);
      });
    }
    // The SYNC button in the upper deck carries its own onclick (the house style for deck
    // buttons, see #toolsBtn), so nothing here binds it - one press must be one press.
    paint();
  }

  // A dropped folder arrives as entries; a dropped set of files as files. Both
  // are taken, and a drop NEVER writes anything back to disk.
  function takeDrop(dt) {
    if (!dt) return;
    note("READING WHAT YOU DROPPED ...");
    var files = [], entries = [];
    if (dt.items && dt.items.length) {
      for (var i = 0; i < dt.items.length; i++) {
        var it = dt.items[i];
        if (it.kind !== "file") continue;
        var en = (typeof it.webkitGetAsEntry === "function") ? it.webkitGetAsEntry() : null;
        if (en) entries.push(en);
        else { var f = it.getAsFile(); if (f) files.push(f); }
      }
    }
    if (!entries.length) {
      var plain = dt.files ? Array.prototype.slice.call(dt.files) : [];
      done(plain, "what you dropped");
      return;
    }
    (async function () {
      for (var i = 0; i < entries.length; i++) await walkEntry(entries[i], files, 0);
      if (!files.length) {
        var plain = dt.files ? Array.prototype.slice.call(dt.files) : [];
        for (var j = 0; j < plain.length; j++) if (isCandidate(plain[j].name)) files.push(plain[j]);
      }
      done(files, entries.length > 1 || (entries[0] && entries[0].isDirectory) ? "what you dropped (a folder)" : "what you dropped");
    })();

    function done(list, where) {
      if (!list.length) { note("NOTHING READABLE WAS DROPPED :: A FOLDER OR .json / .txt FILES, REMEMBERED FROM THE DRIVE.", true); return; }
      look(list, where).then(function () {
        note(describeLook());
        return autoPull();
      }).then(function () { paint(); });
    }
  }

  // After a look, the newest backup is taken in ON ITS OWN - that is what "sync
  // to the latest" means: one pick (or one drop) and the newest chat backup this
  // device is missing is in the archive. It only ever ADDS; a look that finds
  // nothing new says so and changes nothing.
  function autoPull() {
    var row = newestArchivable();
    if (!row) return Promise.resolve("NOTHING IN THERE IS A CHAT BACKUP :: NOTHING WAS CHANGED.");
    return pull(row.name, { quiet: true }).then(function (m) {
      note(m, false);
      return m;
    }, function (e) {
      note("THE BACKUP COULD NOT BE TAKEN IN :: " + String((e && e.message) || e), true);
    });
  }

  function describeLook() {
    var a = archivable();
    var newest = a.length ? a[0] : null;
    if (!a.length) {
      return "LOOKED AT " + inventory.length + " FILE" + (inventory.length === 1 ? "" : "S") + " IN " + lookWhere.toUpperCase() + " - NONE OF THEM A CHAT BACKUP. CHECKED AS FILES: .json OF THIS TERMINAL'S OWN SHAPE, OR .txt HOLDING \"LIA SACRED ARCHIVE EXPORT\".";
    }
    return "LOOKING AT " + lookWhere.toUpperCase() + " :: " + a.length + " CHAT BACKUP" + (a.length === 1 ? "" : "S")
      + ", NEWEST " + newest.name + " (" + (newest.turns || "?") + " TURNS, " + (newest.at ? age(newest.at) : "no date") + "). TAKING THE NEWEST IN.";
  }

  function pick() {
    var input = el("syncDirInput");
    if (!input) { note("THE FOLDER INPUT IS MISSING FROM THIS BUILD - TELL YOUR AGENT.", true); return; }
    note("WAITING FOR YOU TO CHOOSE THE FOLDER (THE SIGN-IN TO YOUR DRIVE, IF THE PICKER SHOWS ONE, IS YOUR OWN BROWSER'S)...");
    try { input.click(); }
    catch (e) { note("THE FOLDER DIALOG WOULD NOT OPEN :: " + String((e && e.message) || e), true); }
  }

  async function lookConnected() {
    var h = await getHandle();
    if (!h) return "NO FOLDER IS CONNECTED :: /sync connect (TOP-LEVEL TAB) OR /sync pick.";
    if (!(await allow(h, false))) return "THE FOLDER \"" + h.name.toUpperCase() + "\" WAS NOT RE-GRANTED, SO IT COULD NOT BE READ :: PRESS CONNECT AND CHOOSE IT AGAIN.";
    var files = [];
    await walkHandle(h, files, 0);
    if (!files.length) return "THE CONNECTED FOLDER \"" + h.name.toUpperCase() + "\" HOLDS NO .json OR .txt FILE TO READ.";
    await look(files, "the connected folder (" + h.name + ")");
    return describeLook() + "\n" + (await autoPull());
  }

  // ---------------------------------------------------------------- text

  function versionsText() {
    if (!inventory.length) {
      return "NO FOLDER IS IN HAND :: /sync pick TO CHOOSE THE BACKUP FOLDER, /sync connect ON A TOP-LEVEL TAB TO KEEP ONE, OR DROP THE FOLDER ON THE SYNC PANEL.";
    }
    var head = "THE VERSIONS IN " + lookWhere.toUpperCase() + " :: " + inventory.length + " FILE" + (inventory.length === 1 ? "" : "S")
      + " LOOKED AT " + age(lookedAt).toUpperCase() + ", NEWEST FIRST";
    var lines = [head];
    var width = 0;
    inventory.forEach(function (v) { width = Math.max(width, String(v.name).length); });
    width = Math.min(width, 52);
    inventory.forEach(function (v) {
      var nm = String(v.name);
      var name = nm.length > width ? nm.slice(0, width - 1) + "\u2026" : nm.padEnd(width, " ");
      lines.push("  " + name + "  " + (v.kind === "json" ? "TERMINAL BACKUP" : (v.kind === "text" ? "READABLE EXPORT" : "NOT A BACKUP"))
        + "  " + (v.turns ? v.turns + " TURNS  " : "") + (v.creations ? "+ " + v.creations + " MADE  " : "") + fmtSize(v.bytes)
        + "  " + (v.at ? stamp(v.at) : "no date")
        + (v.device ? "  " + v.device : ""));
    });
    var a = archivable();
    lines.push(a.length
      ? "  /sync down TAKES THE NEWEST OF THESE IN; /sync down <NAME> TAKES ONE OF THEM. NOTHING BUT THE TURNS THIS DEVICE IS MISSING EVER CHANGES."
      : "  NONE OF THESE IS A CHAT BACKUP, SO THERE IS NOTHING TO TAKE IN.");
    return lines.join("\n");
  }

  async function statusText() {
    var r = await loadRec();
    var log = await localLog();
    var h = await getHandle();
    var lines = ["SYNC :: THE CONVERSATION, OUT OF THIS BROWSER AND BACK (src/js/sync.js)"];
    lines.push("  THIS DEVICE :: " + r.clientId + "  (STAMPED INTO EVERY BACKUP THIS TERMINAL WRITES)");
    lines.push("  THE ARCHIVE HERE :: " + log.length + " TURN" + (log.length === 1 ? "" : "S")
      + (log.length ? ", NEWEST " + stamp(log[log.length - 1].ts) : "") + "  (KEPT IN THIS BROWSER ONLY)");
    lines.push("  THE FOLDER :: " + (h ? "CONNECTED :: " + h.name.toUpperCase() + (await allow(h, false) ? " (READABLE NOW)" : " (PERMISSION LAPSED - PRESS CONNECT AGAIN)") : "NONE CONNECTED")
      + (lookWhere ? "\n  IN HAND :: " + lookWhere + " - " + inventory.length + " FILE" + (inventory.length === 1 ? "" : "S") + ", LOOKED AT " + age(lookedAt) : ""));
    if (r.fileId) lines.push("  LAST TOUCHED :: " + r.fileId);
    if (r.lastUp) lines.push("  LAST WRITTEN OUT :: " + r.lastUp.name + " ( " + r.lastUp.turns + " TURNS / " + fmtSize(r.lastUp.bytes) + " ) " + age(r.lastUp.at).toUpperCase());
    if (r.lastPull) lines.push("  LAST TAKEN IN :: " + r.lastPull.name + " ( " + r.lastPull.added + " NEW, " + r.lastPull.filled + " FILLED ) " + age(r.lastPull.at).toUpperCase());
    var runs = Array.isArray(r.runs) ? r.runs.slice(-6) : [];
    if (runs.length) {
      lines.push("  THE LAST " + runs.length + " RUN" + (runs.length === 1 ? "" : "S") + " ::");
      runs.forEach(function (x) {
        lines.push("    " + stamp(x.at) + "  " + String(x.dir || "").toUpperCase().padEnd(4, " ") + " " + (x.ok ? "OK  " : "FAIL") + "  " + (x.name || "-") + (x.bytes ? "  " + fmtSize(x.bytes) : "") + (x.note ? "  :: " + x.note : ""));
      });
    }
    lines.push("  A BACKUP HOLDS THE CONVERSATION, NOT THE SOURCE. /backup IS THE SOURCE.");
    return lines.join("\n");
  }

  function describe() {
    return "THE SYNC :: THE CONVERSATION OUT OF THIS BROWSER, AND BACK (src/js/sync.js)\n"
      + "  YOUR ARCHIVE LIVES IN THIS BROWSER ONLY - 1000 TURNS OF IT. /backup CARRIES THE GENERATOR'S SOURCE AND NOT ONE WORD OF THE CONVERSATION, AND PURGE OR A NEW MACHINE TAKES IT ALL. THE SYNC IS THE OTHER HALF: THE BACKUPS YOU KEEP ON YOUR OWN DRIVE, READ AND WRITTEN HERE.\n"
      + "  /sync                      WHERE THE SYNC STANDS (THE FOLDER, THIS DEVICE, THE RUNS)\n"
      + "  /sync versions             EVERY BACKUP IN THE FOLDER, NEWEST FIRST, WITH ITS TURNS AND ITS DATE\n"
      + "  /sync pick                 CHOOSE THE BACKUP FOLDER (G:) AND READ IT - THE NEWEST BACKUP IS TAKEN IN ON ITS OWN\n"
      + "  /sync connect              KEEP A FOLDER AND WRITE INTO IT (THE PICKER IS REFUSED IN THE EDITOR'S FRAME; A TOP-LEVEL TAB MAY ASK)\n"
      + "  /sync up                   WRITE THE ARCHIVE OUT AS " + ROLLING + " (ONE DATED VERSION A DAY BESIDE IT IN A CONNECTED FOLDER; A DOWNLOAD OTHERWISE)\n"
      + "  /sync down [NAME|newest]   TAKE A BACKUP IN AND MERGE IT\n"
      + "  /sync forget               FORGET THE CONNECTED FOLDER (NOTHING ON DISK IS TOUCHED)\n"
      + "  THE MERGE IS ADDITIVE: TURNS THIS DEVICE IS MISSING COME IN, TURNS IT HOLDS ARE KEPT EXACTLY AS THEY ARE (THE BACKUP MAY ONLY FILL IN HER HALF OR A STAMP THAT IS MISSING HERE). NOTHING IS EVER DELETED, AND NOTHING IS UPLOADED.\n"
      + "  TWO SHAPES ARE READ: " + ROLLING + " (WRITTEN HERE - EXACT) AND archive_<digits>.txt, THE READABLE EXPORT THE EXPORT BUTTON WRITES (HIS WORDS, HER WORDS, THE STAMPS AND THE MEDIA REFS COME BACK; A RENDER'S RECIPE IS PROSE THERE, SO IT CANNOT BE REBUILT).\n"
      + "  THE PANEL: SYNC \u21c5 IN THE UPPER DECK. PRESS IT, PRESS PICK, CHOOSE THE FOLDER - OR DROP THE FOLDER ON THE PANEL.";
  }

  // ---------------------------------------------------------------- the verb (chat.js prints what this returns)

  async function run(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    if (!a || low === "status" || low === "state" || low === "?") return await statusText();
    if (low === "help") return describe();
    if (low === "versions" || low === "list" || low === "ls") {
      if (!inventory.length) { var w = await lookConnected(); if (inventory.length) return versionsText(); return w; }
      return versionsText();
    }
    if (low === "pick" || low === "folder" || low === "choose") {
      if (isOpen()) pick();
      else { open(); pick(); }
      return "CHOOSING THE BACKUP FOLDER :: PICK IT IN THE DIALOG. THIS TERMINAL THEN READS IT, LISTS THE VERSIONS IN IT, AND TAKES THE NEWEST ONE IN ON ITS OWN - NOTHING IS WRITTEN TO IT AND NOTHING IS UPLOADED.";
    }
    if (low === "connect" || low === "keep") { var c = await connect(); if (isOpen()) paint(); return c; }
    if (low === "forget" || low === "disconnect") { await forget(); return "THE CONNECTED FOLDER HAS BEEN FORGOTTEN ON THIS DEVICE."; }
    if (low === "up" || low === "write" || low === "backup" || low === "push") return await up();
    if (low === "down" || low === "pull" || low === "merge" || low === "sync" || low === "latest") {
      var rest = a.replace(/^\S+\s*/, "");
      if (!inventory.length) {
        var w = await lookConnected();
        if (!inventory.length) return w;
      }
      return await pull(rest || "newest");
    }
    return "SYNC :: NOT A VERB CALLED \"" + a.toUpperCase() + "\".\n" + describe();
  }

  // ---------------------------------------------------------------- boot

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) close();
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  window.sync = {
    toggle: toggle,
    open: open,
    close: close,
    isOpen: isOpen,
    run: run,
    status: statusText,
    describe: describe,
    versions: function () { return inventory.slice(); },
    versionsText: versionsText,
    look: look,
    takeDrop: takeDrop,
    pick: pick,
    connect: connect,
    attach: attach,
    forget: forget,
    up: up,
    pull: pull,
    build: build,
    merge: mergeLogs,
    parse: parseLog,
    record: loadRec,
    SCHEMA: SCHEMA,
    ROLLING: ROLLING
  };
})();
