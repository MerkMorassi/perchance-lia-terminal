  /* ==========================================================================
     THE TOOLS (src/js/tools.js)

     THE MAINTENANCE DECK. Every other module here does one thing when it is
     asked; this one does the jobs nobody asks for one record at a time. It is
     a registry of JOBS, a panel behind the TOOLS button in the deck, and one
     word in the line (/tools) - all three go to the same place.

       DUPLICATE PICTURES      the same bytes held under two ids; keeps one.
       PROPER FOLDERS          files records into the folder their kind
                               belongs in.
       UPSCALE WHAT ISN'T 2x   the backfill sweep for the local pipeline.
       CLASSIFY                the bulk vision pass: every picture read once,
                               its reading, its elements and its bucket written
                               onto the record, so finding a picture is search
                               over what the model already wrote.
       REPAIR THE RECORD       anything in the archive, or in the queue for
                               her eyes, that names a blob no longer here.

     TWO RULES, and every job obeys both:

       1. SCAN FIRST, AND SHOW THE WORK. A scan changes NOTHING: it reads the
          vault, hashes what needs hashing, and prints exactly what a run would
          do - every record by name and id, every destination, every byte. The
          RUN follows a scan the panel has actually been shown; the one way
          past that is to type the word `run`, which is the confirmation.
       2. NOTHING IS EVER DESTROYED THAT IS THE ONLY COPY. The one job that
          deletes (DUPLICATE PICTURES) deletes a record ONLY while its bytes
          are still identical to the record being kept - checked at the moment
          of deletion, not trusted from the scan - and it moves every reference
          across FIRST (the archive's creation row, what she was shown, what
          she asked to see again, its place in the queue for her eyes, a KEEP
          with its recipe and link, its tags, its folder, another record's
          `from`), which is exactly the discipline the local upscale's retire()
          step uses (src/js/upscale-local.js). Everything else here only ever
          MOVES a record or ADDS a picture.

     Nothing in this file goes onto the stage: every word it says is a SYSTEM
     line, so it lands behind the veil with the rest of the machinery.

     See the MAINTENANCE section of src/README.md for the whole picture.
     ========================================================================== */
(function () {
  "use strict";

  var RUNNING = false;     // one job at a time, whoever asked
  var scanning = false;    // one scan at a time - a hashing pass is not instant
  var stopped = false;     // /tools stop, or the STOP button
  var lastScan = {};       // job id -> the scan a RUN is based on
  var lastScope = {};      // job id -> the scope that scan was taken under
  var pending = {};        // job id -> when a destructive RUN was first pressed
  var readAvgMs = 0;       // the classifier's own measured pace on this device
  var readAvgN = 0;        // ...so this boot's scan can estimate the next pass

  var IMAGE = /^image\//;
  var VIDEO = /^video\//;

  function el(id) { return document.getElementById(id); }

  function say(text) {
    try { if (typeof print === "function") { print("SYSTEM", text); return; } } catch (e) {}
    try { console.log("[TOOLS] " + text); } catch (e) {}
  }

  function progress(text) {
    var st = el("tlState");
    if (st) st.textContent = text || "";
  }

  // THE BAR IN THE DECK (src/js/progress.js). The panel's own #tlState line (above) says what the
  // job is doing in the panel; this is the TERMINAL-WIDE bar at the top of the lower deck, so a
  // sweep that runs for twenty minutes can be watched - and stopped - from the conversation rather
  // than only from the deck. ONE job id ("tools") is used on purpose: a run is serial here (RUNNING
  // is the lock), so two of these jobs can never be on the bar at once, and every apply() that knows
  // its own count re-opens the same id with its own label and total - which CONTINUES the job rather
  // than stacking a second one. runJob's `finally` finishes it whatever happens, so a job that dies
  // in the middle still takes its own bar down.
  function bar(label, total, id) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: id || "tools", total: total,
        detail: "the maintenance deck - /tools stop ends it after the record in hand",
      });
    } catch (e) {}
    return null;
  }

  function barDone(id) {
    try { if (window.progress) window.progress.finish(id || "tools"); } catch (e) {}
  }

  // WHAT THE MACHINERY HAS IN ITS HAND (src/js/minibox.js). Every long loop in
  // this file says so, one record at a time, so the deck's in-hand chip shows
  // the THUMBNAIL and the CITATION of the record being worked on right now -
  // press it and look at the thing while the job carries on, which is the whole
  // reason the chip exists ("I might know the citation of what we is examining
  // or working on at present" - Patrikios, 2026-09-23). It is a LEASE, not an
  // ownership: this file never has to end anything, and a job that dies cannot
  // leave a stale thumbnail on the deck.
  function hand(id, text, label, list, at) {
    try {
      if (window.inHand && window.inHand.show) window.inHand.show(id, text, { label: label || "THE TOOLS", list: list, at: at });
    } catch (e) {}
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  function short(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  function plural(n, one, many) { return n + " " + (Number(n) === 1 ? one : many); }

  // A record named the way a report has to name it: what it is, then the id, so
  // every line of a receipt can be typed back into /show or /renders.
  function label(id) {
    var M = window.media, r = M && M.get(id);
    if (!r) return String(id);
    var name = (M.recordLabel ? M.recordLabel(r) : (r.name || r.prompt)) || id;
    return short(name, 44) + "  [" + id + "]";
  }

  /* ---- the vault, read as one table --------------------------------------- */

  function recs() {
    var M = window.media, out = [];
    if (!M || !M.list) return out;
    // A COPY, carrying its id. A scan must never write to the vault, and adding
    // `id` to the cached record would put a field on it the next time anything
    // touched it - so the table this file reads is its own.
    M.list().forEach(function (id) { var r = M.get(id); if (r) out.push(Object.assign({}, r, { id: id })); });
    return out;
  }

  function isPicture(r) { return !!(r && IMAGE.test(String(r.mime || ""))); }

  // A CLIP (2026-09-24). PATRIKIOS: "Yes. Bulk classifier on video frames, Then she can tag the
  // video and classify it correctly." A clip is not a picture, but the classifier can read one: it
  // is put in front of the vision model as a handful of STILLS spread across it (the road in
  // src/js/archivax.js, the same one the conversation uses for a clip on his message), and what
  // comes back is written on the clip as its reading, its tags and its bucket like any picture.
  function isClip(r) { return !!(r && (r.kind === "video" || VIDEO.test(String(r.mime || "")))); }

  // WHAT THE VISION ROAD CAN ACTUALLY READ: a picture, and a clip that still has its file.
  function isReadable(r) { return isPicture(r) || (isClip(r) && !!r.blob); }

  // What HE handed over himself: an attachment, and a clip he imported - the two kinds a LIA may
  // read but may not write on (see archivax.js mayWriteOn).
  function isYours(r) { return !!(r && (r.kind === "attach" || isClip(r))); }

  // HOW MANY STILLS A CLIP IS READ AS. Asked of the module that owns the road (archivax.js
  // clipFrames), so the plan, the token estimate and the reading cannot disagree about a clip.
  // 0 means the sequence is switched off (LIA_CLIP_FRAMES = 0) and a clip cannot be read at all.
  function clipStills() {
    try {
      if (window.archivax && window.archivax.clipFrames) return window.archivax.clipFrames();
    } catch (e) {}
    var n = (typeof LIA_CLIP_FRAMES === "number") ? Math.round(LIA_CLIP_FRAMES) : 6;
    return (isFinite(n) && n > 0) ? Math.min(24, n) : 0;
  }

  // What a job is allowed to look at, given its scope word. A job that does not
  // know a scope falls back to everything it may touch.
  function scopePool(jobId, scope) {
    var all = recs();
    if (jobId === "upscale") {
      if (scope === "renders") return all.filter(function (r) { return r.kind === "gen"; });
      if (scope === "yours") return all.filter(function (r) { return r.kind === "attach" && isPicture(r); });
      return all.filter(function (r) { return (r.kind === "gen" || r.kind === "attach") && isPicture(r); });
    }
    if (jobId === "folders") {
      if (scope === "made") return all.filter(function (r) { return r.kind === "gen" || r.kind === "upscale"; });
      if (scope === "pictures") return all.filter(isPicture);
      return all;
    }
    if (jobId === "read") {
      if (scope === "renders") return all.filter(function (r) { return (r.kind === "gen" || r.kind === "upscale") && isPicture(r); });
      if (scope === "yours") return all.filter(function (r) { return isYours(r) && isReadable(r); });
      return all.filter(isReadable);
    }
    return all;
  }

  /* ---- the record she is read from ---------------------------------------- */

  function archiveStore() {
    return (window.root && window.root.kv && window.root.kv.sacred_archive) || null;
  }

  async function masterLog() {
    var s = archiveStore();
    if (!s) return [];
    try { return (await s.get("master_log")) || []; }
    catch (e) { console.warn("tools: the archive could not be read", e); return []; }
  }

  async function writeLog(logs) {
    var s = archiveStore();
    if (!s) return false;
    try { await s.set("master_log", logs); return true; }
    catch (e) { console.warn("tools: the archive could not be written", e); return false; }
  }

  function refCount(logs, id) {
    var n = 0;
    (logs || []).forEach(function (e) {
      if (!e) return;
      (Array.isArray(e.gen) ? e.gen : []).forEach(function (g) { if (g && g.id === id) n++; });
      (Array.isArray(e.sight) ? e.sight : []).forEach(function (s) { if (s === id) n++; });
      (Array.isArray(e.show) ? e.show : []).forEach(function (s) { if (s === id) n++; });
    });
    return n;
  }

  // Which record was made FROM which: the local upscale writes `from` on the
  // bigger picture, and the retire step leaves `replaced` on it too, so one of
  // these two fields is the whole of "this picture has already been upscaled".
  function descendantMap() {
    var map = {};
    recs().forEach(function (r) {
      if (r.from) map[r.from] = r.id;
      if (r.replaced) map[r.replaced] = r.id;
    });
    return map;
  }

  function sightQueueIds() {
    return Array.isArray(window.unseen) ? window.unseen.slice() : [];
  }

  /* ---- the same bytes ------------------------------------------------------ */

  async function digest(blob) {
    if (!blob || !blob.arrayBuffer) return "";
    if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest)) return "";
    try {
      var d = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      var b = new Uint8Array(d), hex = "";
      for (var i = 0; i < b.length; i++) hex += (b[i] < 16 ? "0" : "") + b[i].toString(16);
      return hex;
    } catch (e) { console.warn("tools: a blob could not be hashed", e); return ""; }
  }

  // The fallback for a device without crypto.subtle: the same question answered
  // the slow way. It is only ever asked of pictures that already agree on size
  // and shape, so the compare is short.
  async function sameBytes(a, b) {
    if (!a || !b || a.size !== b.size) return false;
    try {
      var x = new Uint8Array(await a.arrayBuffer()), y = new Uint8Array(await b.arrayBuffer());
      if (x.length !== y.length) return false;
      for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
      return true;
    } catch (e) { return false; }
  }

  /* ---- a merged record ----------------------------------------------------- */

  // Everything the dropped copy knows is poured onto the one being kept before
  // it goes: tags, and any field the survivor is missing, and its folder if the
  // survivor never had one of its own. A KEEP is not here - keepsake.transfer
  // owns that, because a keep is a mark with a recipe and a link in it.
  async function mergeInto(fromId, toId) {
    var M = window.media, a = M.get(fromId), b = M.get(toId);
    if (!a || !b) return 0;
    var n = 0, i;
    var tags = (M.tagsOf ? M.tagsOf(a.tags) : (a.tags || []));
    for (i = 0; i < tags.length; i++) { try { if (await M.tag(toId, tags[i])) n++; } catch (e) {} }
    var FIELDS = ["sight", "name", "prompt", "sent", "negative", "seed", "guidanceScale", "resolution", "recipe", "pose", "note", "how"];
    for (i = 0; i < FIELDS.length; i++) {
      var k = FIELDS[i], mine = b[k], theirs = a[k];
      var empty = (mine === undefined || mine === null || mine === "" || mine === 0 || (Array.isArray(mine) && !mine.length));
      if (!empty) continue;
      if (theirs === undefined || theirs === null || theirs === "" || theirs === 0) continue;
      try { await M.setField(toId, k, theirs); n++; } catch (e) {}
    }
    if (!b.folder && a.folder) { try { await M.setFolder(toId, a.folder); n++; } catch (e) {} }
    return n;
  }

  // Anything else in the vault that was made from the dropped copy now names the
  // one that was kept, so no record is left pointing at a picture that is gone.
  async function repointFrom(fromId, toId) {
    var M = window.media, list = recs(), n = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.id === toId) continue;
      if (r.from === fromId) { try { await M.setField(r.id, "from", toId); n++; } catch (e) {} }
      if (r.replaced === fromId) { try { await M.setField(r.id, "replaced", toId); n++; } catch (e) {} }
    }
    return n;
  }

  /* ==========================================================================
     JOB :: DUPLICATE PICTURES
     ========================================================================== */

  // Which of two identical records to keep. References come first, because a
  // record the archive names is a record something would break without; then a
  // render over an upscale over an attachment; then whichever carries more of
  // what makes a picture findable (its prompt, her reading of it, tags, a keep).
  function scoreOf(r, logs) {
    var M = window.media;
    return refCount(logs, r.id) * 1000
      + (r.kind === "gen" ? 300 : r.kind === "upscale" ? 200 : 100)
      + (String(r.prompt || "").trim() ? 40 : 0)
      + (String(r.sight || "").trim() ? 20 : 0)
      + (M && M.tagsOf ? M.tagsOf(r.tags) : (r.tags || [])).length
      + ((r.keep && r.keep.recipe) ? 5 : 0);
  }

  async function scanDupes() {
    var M = window.media;
    var logs = await masterLog();
    var pics = recs().filter(isPicture);
    var byShape = {}, i, j;
    pics.forEach(function (r) {
      var k = [r.mime || "", r.bytes || 0, r.w || 0, r.h || 0].join("|");
      (byShape[k] = byShape[k] || []).push(r);
    });
    var candidates = Object.keys(byShape).map(function (k) { return byShape[k]; }).filter(function (g) { return g.length > 1; });
    var groups = [], hashed = 0;
    var hashTotal = candidates.reduce(function (n, g) { return n + g.length; }, 0);
    var hashIds = candidates.reduce(function (a, g) { return a.concat(g.map(function (r) { return r.id; })); }, []);
    for (i = 0; i < candidates.length; i++) {
      var buckets = [];
      for (j = 0; j < candidates[i].length; j++) {
        var r = candidates[i][j], h = "";
        hand(r.id, "HASHING " + (hashed + 1) + " / " + hashTotal, "DUPLICATE HUNT", hashIds);
        try { h = await digest(r.blob); } catch (e) { h = ""; }
        if (h) hashed++;
        var placed = false;
        for (var b = 0; b < buckets.length && !placed; b++) {
          var bucket = buckets[b];
          if (h && bucket.hash) { if (bucket.hash === h) { bucket.ids.push(r); placed = true; } }
          else if (!h && !bucket.hash) { if (await sameBytes(bucket.ids[0].blob, r.blob)) { bucket.ids.push(r); placed = true; } }
        }
        if (!placed) buckets.push({ hash: h, ids: [r] });
      }
      buckets.forEach(function (bucket) {
        if (bucket.ids.length < 2) return;
        var keep = bucket.ids[0], best = scoreOf(bucket.ids[0], logs);
        bucket.ids.forEach(function (r) { var s = scoreOf(r, logs); if (s > best) { best = s; keep = r; } });
        var drops = bucket.ids.filter(function (r) { return r.id !== keep.id; });
        groups.push({
          hash: bucket.hash, keep: keep.id, copies: bucket.ids.length,
          ids: bucket.ids.map(function (r) { return r.id; }),
          drops: drops.map(function (r) { return r.id; }),
          bytes: keep.bytes || 0,
          size: (keep.w && keep.h) ? (keep.w + "\u00d7" + keep.h) : "",
          reclaim: drops.reduce(function (n, r) { return n + (r.bytes || 0); }, 0),
          tags: (M && M.tagsOf ? M.tagsOf(keep.tags) : []).length,
          refs: refCount(logs, keep.id),
          prompt: short(keep.prompt || "", 40),
          why: [
            refCount(logs, keep.id) ? plural(refCount(logs, keep.id), "REF", "REFS") : "",
            (keep.kind || "").toUpperCase(),
            String(keep.prompt || "").trim() ? "HAS ITS PROMPT" : "",
            ((M && M.tagsOf ? M.tagsOf(keep.tags) : []).length) ? "TAGGED" : ""
          ].filter(Boolean).join(" \u00b7 ")
        });
      });
    }
    groups.sort(function (a, b) { return b.reclaim - a.reclaim || b.copies - a.copies; });

    // SAME RECIPE, DIFFERENT BYTES. A re-render of one prompt and seed is a
    // different picture, not a copy of one, so this list is REPORTED and never
    // acted on by any button in this terminal.
    var byRecipe = {};
    pics.forEach(function (r) {
      var p = String(r.prompt || "").trim();
      if (!p) return;
      var k = [p.slice(0, 200), r.seed || 0, r.w || 0, r.h || 0].join("|");
      (byRecipe[k] = byRecipe[k] || []).push(r);
    });
    var near = Object.keys(byRecipe).map(function (k) { return byRecipe[k]; }).filter(function (g) { return g.length > 1; });

    return {
      job: "dupes", scope: "", at: Date.now(), scanned: pics.length, hashed: hashed,
      groups: groups,
      copies: groups.reduce(function (n, g) { return n + g.drops.length; }, 0),
      reclaim: groups.reduce(function (n, g) { return n + g.reclaim; }, 0),
      near: near.slice(0, 20).map(function (g) {
        return { count: g.length, prompt: short(g[0].prompt, 70), seed: g[0].seed || 0, ids: g.map(function (r) { return r.id; }) };
      })
    };
  }

  function dupesText(sc) {
    var L = [];
    L.push("DUPLICATE PICTURES :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    L.push("  PICTURES READ            " + sc.scanned + " (" + sc.hashed + " HASHED AND COMPARED BY CONTENT)");
    L.push("  IDENTICAL GROUPS         " + sc.groups.length);
    L.push("  COPIES BEYOND THE FIRST  " + sc.copies + "  ::  " + fmtBytes(sc.reclaim) + " HELD TWICE");
    if (!sc.groups.length) {
      L.push("  NOTHING TO DO :: every picture in the vault is held once.");
    } else {
      var shown = 0;
      for (var i = 0; i < sc.groups.length; i++) {
        var g = sc.groups[i];
        if (shown >= 14) { L.push(""); L.push("  ... AND " + plural(sc.groups.length - shown, "MORE GROUP", "MORE GROUPS") + " - THE RUN TAKES THEM ALL."); break; }
        shown++;
        L.push("");
        L.push("  GROUP " + (i + 1) + " :: " + plural(g.copies, "COPY", "COPIES") + " OF " + (g.size || "?") + ", " + fmtBytes(g.bytes) + " EACH");
        L.push("    KEEP  " + label(g.keep) + (g.why ? "   (" + g.why + ")" : ""));
        for (var j = 0; j < g.drops.length; j++) L.push("    DROP  " + label(g.drops[j]));
      }
    }
    if (sc.near.length) {
      L.push("");
      L.push("  SAME RECIPE, DIFFERENT BYTES :: " + plural(sc.near.length, "GROUP", "GROUPS") + " - LISTED ONLY, NEVER DELETED (a re-render of one prompt and seed is a different picture)");
      sc.near.slice(0, 6).forEach(function (n) {
        L.push("    \"" + n.prompt + "\" SEED " + n.seed + " :: " + n.count + " PICTURES :: " + n.ids.join(", "));
      });
    }
    L.push("");
    L.push("  NOTHING HAS CHANGED. /tools dupes run KEEPS ONE OF EACH AND DROPS THE REST - EVERY REFERENCE MOVED ACROSS FIRST, AND THE BYTES RE-CHECKED AT THE MOMENT OF DELETION.");
    return L.join("\n");
  }

  async function applyDupes(sc) {
    var M = window.media;
    var out = { groups: 0, dropped: 0, bytes: 0, refs: 0, merged: 0, refused: 0, moved: 0 };
    var allIds = sc.groups.reduce(function (a, g) { return a.concat(g.ids); }, []);
    var seen = 0;
    // The bar counts every copy EXAMINED (the drops), which is the number of hash checks this run
    // will actually make - not the groups, which are settled in one step each.
    var B = bar("DUPLICATES \u00b7 CHECKING COPIES", allIds.length);
    for (var i = 0; i < sc.groups.length; i++) {
      var g = sc.groups[i];
      var keep = M.get(g.keep);
      if (!keep) { out.refused += g.drops.length; continue; }
      var changed = false;
      for (var j = 0; j < g.drops.length; j++) {
        if (stopped) break;
        var dropId = g.drops[j], drop = M.get(dropId);
        if (!drop) continue;
        // The in-hand chip names the copy being examined and walks the whole set,
        // so the receipt can be read as it is written.
        hand(dropId, "THE COPY IN HAND \u00b7 " + (++seen) + " / " + allIds.length, "DUPLICATES \u00b7 THIS ONE DELETES COPIES", allIds);
        if (B) B.set(seen);
        // THE SAFETY RAIL. The scan's word is not enough: the bytes must STILL be
        // the bytes of the record being kept, checked now, or this copy is left
        // exactly where it is.
        var still = g.hash ? ((await digest(drop.blob)) === g.hash) : (await sameBytes(drop.blob, keep.blob));
        if (!still) {
          out.refused++;
          say("DUPLICATES :: LEFT ALONE :: " + label(dropId) + " IS NO LONGER BYTE-IDENTICAL TO " + label(g.keep) + " - NOTHING WAS DELETED FOR IT.");
          continue;
        }
        out.merged += await mergeInto(dropId, g.keep);
        M.noteReplace(dropId, g.keep);
        if (typeof window.repointTiles === "function") { try { window.repointTiles(dropId, g.keep); } catch (e) {} }
        try {
          var moved = await window.replaceMediaRef(dropId, g.keep, { sight: true });
          if (moved > 0) out.refs += moved;
        } catch (e) { console.warn("tools: an archive reference could not be moved", e); }
        if (window.keepsake && window.keepsake.transfer) { try { await window.keepsake.transfer(dropId, g.keep); } catch (e) {} }
        out.moved += await repointFrom(dropId, g.keep);
        await M.del(dropId);
        out.dropped++; out.bytes += (drop.bytes || 0); changed = true;
      }
      if (changed) out.groups++;
      if (stopped) break;
    }
    return out;
  }

  function dupesDone(sc, r) {
    if (r && r.error) return "DUPLICATES :: THE RUN FAILED :: " + r.error;
    var L = [];
    L.push("DUPLICATES :: DONE" + (stopped ? " (STOPPED EARLY)" : ""));
    L.push("  GROUPS SETTLED   " + r.groups + " OF " + sc.groups.length);
    L.push("  COPIES DROPPED   " + r.dropped);
    L.push("  RECLAIMED        " + fmtBytes(r.bytes));
    L.push("  REFERENCES MOVED " + r.refs + (r.moved ? " IN THE ARCHIVE, " + r.moved + " BETWEEN RECORDS" : " IN THE ARCHIVE"));
    L.push("  TAGS AND FIELDS CARRIED ONTO THE COPY THAT WAS KEPT  " + r.merged);
    if (r.refused) L.push("  LEFT ALONE        " + r.refused + " (the bytes had changed since the scan - nothing was deleted for them)");
    L.push("  ONE COPY OF EVERY GROUP IS STILL HERE. THE VAULT NOW HOLDS " + plural(window.media.list().length, "RECORD", "RECORDS") + ".");
    return L.join("\n");
  }

  /* ==========================================================================
     JOB :: PROPER FOLDERS
     ========================================================================== */

  async function scanFolders(scope) {
    var M = window.media;
    var pool = scopePool("folders", scope);
    var moves = [], tidy = [];
    pool.forEach(function (r) {
      // A PICTURE THE CLASSIFIER HAS READ BELONGS IN ITS BUCKET. The bucket is a place as well as a
      // word (see vault.js's bucketPath), so the folder a record "belongs in" is the bucket when it
      // has one - otherwise this job would flatten every bucket straight back into /images the
      // moment it was run. This is the one line that keeps the taxonomy standing.
      // AND A VOICE BELONGS IN THE VOX TREE, NOT IN /music: /audio/vox/<agent> when the record names
      // an agent, the shelf itself when it does not (see vault.js's isVox/voxFolder). Without this
      // the job would empty the VOX tree into /music the first time it ran, which is the opposite of
      // what filing a voice there means.
      var proper = M.bucketPath(r) || ((M.isVox && M.isVox(r)) ? M.voxFolder(r) : M.defaultFolder(r));
      var was = M.folderOf(r);
      if (was !== proper) moves.push({ id: r.id, from: was, to: proper, kind: r.kind || "", label: label(r.id) });
      else if (r.folder) tidy.push({ id: r.id, path: was, label: label(r.id) });
    });
    var empty = (M.allFolders ? M.allFolders() : []).filter(function (f) { return !f.count; });
    return {
      job: "folders", scope: scope, at: Date.now(), scanned: pool.length,
      moves: moves, tidy: tidy, empty: empty,
      byTo: moves.reduce(function (o, m) { o[m.to] = (o[m.to] || 0) + 1; return o; }, {})
    };
  }

  function scopeWords(jobId, scope) {
    if (jobId === "folders") {
      if (scope === "made") return "WHAT THE TERMINAL MADE (renders and upscales)";
      if (scope === "pictures") return "EVERY PICTURE";
      return "EVERYTHING IN THE VAULT";
    }
    if (jobId === "upscale") {
      if (scope === "renders") return "RENDERS (what the terminal made)";
      if (scope === "yours") return "PICTURES YOU HANDED OVER";
      return "EVERY PICTURE (renders and yours)";
    }
    if (jobId === "read") {
      if (scope === "renders") return "RENDERS (what the terminal made)";
      if (scope === "yours") return "PICTURES AND CLIPS YOU HANDED OVER";
      if (scope === "again") return "EVERYTHING READABLE, READ AGAIN (a reading that is already there is overwritten - except a clip's own, which is kept while its tags and its bucket are read from its stills)";
      return "EVERY PICTURE AND CLIP (renders and yours)";
    }
    return "EVERYTHING";
  }

  function foldersText(sc) {
    var L = [];
    L.push("PROPER FOLDERS :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    L.push("  SCOPE                 " + scopeWords("folders", sc.scope));
    L.push("  RECORDS CONSIDERED    " + sc.scanned);
    L.push("  MISFILED              " + sc.moves.length);
    if (sc.moves.length) {
      L.push("");
      Object.keys(sc.byTo).sort().forEach(function (to) {
        L.push("  " + to + "  (" + sc.byTo[to] + ")");
      });
      L.push("");
      var shown = 0;
      for (var i = 0; i < sc.moves.length; i++) {
        var m = sc.moves[i];
        if (shown >= 20) { L.push("  ... AND " + plural(sc.moves.length - shown, "MORE", "MORE")); break; }
        shown++;
        L.push("  MOVE  " + m.from + " \u2192 " + m.to + "   " + m.label);
      }
    } else {
      L.push("  NOTHING TO DO :: every record considered is already in the folder its kind belongs in.");
    }
    if (sc.tidy.length) {
      L.push("");
      L.push("  SPELLED OUT BUT ALREADY CORRECT   " + sc.tidy.length + "  ::  these already live where they should; the run only clears the redundant folder field");
    }
    if (sc.empty.length) {
      L.push("");
      L.push("  FOLDERS HOLDING NOTHING   " + sc.empty.map(function (f) { return f.path; }).join(", "));
      L.push("  (a folder is a place whether or not anything is in it - nothing is ever dropped here)");
    }
    L.push("");
    L.push("  NOTHING HAS CHANGED. THIS JOB ONLY FILES RECORDS: IT NEVER DELETES ONE AND IT NEVER MOVES A FILE (there is no file - the blob has no path, only the record does).");
    L.push("  THE SCENES: /folder list | new | rename | drop, and the gallery's FOLDERS row, do the same thing by hand.");
    return L.join("\n");
  }

  async function applyFolders(sc) {
    var M = window.media;
    var out = { moved: 0, tidied: 0, failed: 0, byTo: {} };
    var jobs = sc.moves.map(function (m) { return { id: m.id, to: m.to, kind: "move" }; })
      .concat(sc.tidy.map(function (t) { return { id: t.id, to: t.path, kind: "tidy" }; }));
    var jobIds = jobs.map(function (x) { return x.id; });
    var B = bar("FILING RECORDS", jobs.length);
    for (var i = 0; i < jobs.length; i++) {
      if (stopped) break;
      var r = null;
      hand(jobs[i].id, "FILING \u00b7 " + (i + 1) + " / " + jobs.length, "PROPER FOLDERS", jobIds);
      if (B) B.set(i + 1);
      try { r = await M.setFolder(jobs[i].id, jobs[i].to); } catch (e) { r = null; }
      if (r && r.ok) {
        if (jobs[i].kind === "move") { out.moved++; out.byTo[jobs[i].to] = (out.byTo[jobs[i].to] || 0) + 1; }
        else out.tidied++;
      } else {
        out.failed++;
      }
    }
    return out;
  }

  function foldersDone(sc, r) {
    if (r && r.error) return "PROPER FOLDERS :: THE RUN FAILED :: " + r.error;
    var L = ["PROPER FOLDERS :: DONE" + (stopped ? " (STOPPED EARLY)" : "")];
    L.push("  FILED            " + r.moved + " OF " + sc.moves.length);
    Object.keys(r.byTo).sort().forEach(function (p) { L.push("    " + p + "  (" + r.byTo[p] + ")"); });
    L.push("  FIELD CLEARED    " + r.tidied + " (already in the right folder - nothing moved)");
    if (r.failed) L.push("  FAILED           " + r.failed + " (the record had gone by the time it was filed)");
    L.push("  NOTHING WAS DELETED. THE VAULT HOLDS " + plural(window.media.list().length, "RECORD", "RECORDS") + ".");
    return L.join("\n");
  }

  /* ==========================================================================
     JOB :: UPSCALE WHAT ISN'T 2x YET
     ========================================================================== */

  function mpCeil() {
    var U = window.upscaleLocal;
    return (U && U.maxMp) ? (Number(U.maxMp()) || 16) : 16;
  }

  function upscalePlan(scope, limit) {
    var U = window.upscaleLocal, maxMp = mpCeil();
    var desc = descendantMap();
    var pool = scopePool("upscale", scope);
    var todo = [], skip = [];
    pool.forEach(function (r) {
      if (!isPicture(r)) return;
      var why = "";
      var w = Number(r.w) || 0, h = Number(r.h) || 0;
      if (r.kind === "upscale") why = "it is already an upscale";
      else if (desc[r.id]) why = "it already has an upscale (" + desc[r.id] + ")";
      else if (r.upscaled) why = "it is marked as upscaled";
      else if (r.how === "upscale" || r.how === "upscale-local") why = "it was made by upscaling";
      else if (w && h && (w * h * 4) / 1e6 > maxMp) why = w + "\u00d7" + h + " is " + (Math.round(w * h / 1e6 * 10) / 10) + " MP already - a 2x would pass this device's " + maxMp + " MP ceiling";
      if (why) skip.push({ id: r.id, label: label(r.id), why: why });
      else todo.push({ id: r.id, label: label(r.id), kind: r.kind || "", w: w, h: h, bytes: r.bytes || 0 });
    });
    // WHAT THE SWEEP WILL ADD, ESTIMATED FROM THIS VAULT'S OWN WORK. Where there
    // are upscales here already, the average bytes a pixel of one costs on this
    // device is measured and used - the figure then comes out of the machine's own
    // experience rather than a generic guess. 1.5 bytes a pixel is the fallback,
    // and where the vault never learned a picture's size, four times the smaller
    // file is the honest stand-in.
    var upCount = 0, upBytes = 0, upPx = 0;
    recs().forEach(function (r) {
      if (r.kind !== "upscale" || !r.w || !r.h || !r.bytes) return;
      upCount++; upBytes += r.bytes; upPx += r.w * r.h;
    });
    var bpp = (upCount >= 5 && upPx) ? (upBytes / upPx) : 1.5;
    var est = todo.reduce(function (n, x) {
      return n + (x.w && x.h ? x.w * x.h * 4 * bpp : x.bytes * 4);
    }, 0);
    return {
      job: "upscale", scope: scope, at: Date.now(), do: todo, skip: skip, limit: limit || 0,
      renders: todo.filter(function (x) { return x.kind === "gen"; }).length,
      yours: todo.filter(function (x) { return x.kind === "attach"; }).length,
      estBytes: est,
      estFrom: upCount >= 5 ? upCount : 0,
      replace: !!(U && U.replace && U.replace()),
      factor: (U && U.factor) ? U.factor() : 2,
      engine: U && U.engine ? U.engine() : "?"
    };
  }

  function upscaleText(sc) {
    var U = window.upscaleLocal;
    var L = [];
    L.push("UPSCALE WHAT ISN'T 2x YET :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    L.push("  SCOPE                 " + scopeWords("upscale", sc.scope));
    L.push("  WILL BE MADE 2x       " + sc.do.length + (sc.do.length ? "  (" + plural(sc.renders, "RENDER", "RENDERS") + ", " + plural(sc.yours, "YOUR PICTURE", "YOUR PICTURES") + ")" : ""));
    L.push("  SKIPPED               " + sc.skip.length + " (already upscaled, already an upscale, or past the ceiling)");
    if (sc.do.length) L.push("  ADDED TO THE VAULT    ~" + fmtBytes(sc.estBytes) + (sc.estFrom
      ? " (estimated from the " + plural(sc.estFrom, "UPSCALE", "UPSCALES") + " this vault already holds)"
      : " (an estimate - a 2x png)"));
    L.push("  EACH ONE              x2, png, " + (U ? U.engine().toUpperCase() : "?") + ", on this machine, one at a time");
    L.push("  THE SMALLER ORIGINAL  " + (sc.replace
      ? "IS RETIRED INTO IT - a render leaves the vault once the bigger one is stored (/upscale replace off leaves both)"
      : "IS KEPT beside the bigger one (/upscale replace on retires it)"));
    if (sc.limit) L.push("  THIS RUN TAKES        THE FIRST " + sc.limit + " (the MAX PER RUN box)");
    if (!sc.do.length) {
      L.push("  NOTHING TO DO :: everything under this scope has either been upscaled already or is past what this device should be asked to hold.");
    }
    if (sc.skip.length) {
      L.push("");
      L.push("  WHY THE OTHERS ARE LEFT ALONE:");
      var reasons = {};
      sc.skip.forEach(function (s) { reasons[s.why.replace(/\([^)]*\)/, "(...)")] = (reasons[s.why.replace(/\([^)]*\)/, "(...)")] || 0) + 1; });
      Object.keys(reasons).forEach(function (w) { L.push("    " + reasons[w] + " \u00b7 " + w.toUpperCase()); });
      sc.skip.slice(0, 5).forEach(function (s) { L.push("    e.g. " + s.label + " :: " + s.why); });
    }
    L.push("");
    L.push("  NOTHING HAS CHANGED. /tools upscale " + sc.scope + " run QUEUES THEM THROUGH THE SAME ROAD /upscale here USES - nothing is opened, nothing is uploaded, and STOP ends the sweep after the picture in hand.");
    return L.join("\n");
  }

  async function applyUpscale(sc) {
    var U = window.upscaleLocal, M = window.media;
    if (!U || !U.queue) return { error: "THE LOCAL UPSCALER IS OFFLINE (src/js/upscale-local.js)." };
    var list = sc.do.slice();
    if (sc.limit) list = list.slice(0, sc.limit);
    var out = { total: list.length, all: sc.do.length, made: 0, failed: 0, tried: 0 };
    var sweepIds = list.map(function (x) { return x.id; });
    progress("UPSCALING 0 / " + list.length);
    var B = bar("UPSCALING", list.length);
    for (var i = 0; i < list.length; i++) {
      if (stopped) break;
      if (!M.get(list[i].id)) { out.failed++; out.tried++; if (B) B.set(out.tried); continue; }
      // THE PICTURE IN HAND. The sweep can run for twenty minutes; this is how he
      // watches WHICH one it is on - the chip in the deck carries its thumbnail and
      // its citation, and pressing it opens the mini lightbox on the sweep's own
      // plan, so the ones before and after it can be walked without leaving the
      // conversation. Renewed every picture, so the chip is up for exactly as long
      // as the sweep is working.
      hand(list[i].id, "UPSCALING " + (out.tried + 1) + " / " + list.length, "UPSCALE SWEEP", sweepIds, i);
      var id = null;
      try { id = await U.queue(list[i].id, { quiet: true, factor: 2 }); } catch (e) { id = null; }
      out.tried++;
      if (id) out.made++; else out.failed++;
      progress("UPSCALING " + out.tried + " / " + list.length);
      if (B) B.set(out.tried);
      if ((out.tried % 10 === 0) || out.tried === list.length || stopped) {
        say("UPSCALE SWEEP :: " + out.tried + " OF " + list.length + " :: " + out.made + " MADE, " + out.failed + " FAILED" + (stopped ? " :: STOPPING" : ""));
      }
    }
    progress("");
    return out;
  }

  function upscaleDone(sc, r) {
    if (r && r.error) return "UPSCALE SWEEP :: THE RUN FAILED :: " + r.error;
    var U = window.upscaleLocal;
    var L = ["UPSCALE SWEEP :: DONE" + (stopped ? " (STOPPED EARLY)" : "")];
    L.push("  UPSCALED   " + r.made + " OF " + r.total + " ATTEMPTED" + (r.all > r.total ? " (" + r.all + " WERE IN THE PLAN)" : ""));
    if (r.failed) L.push("  FAILED     " + r.failed + " (the picture had gone, or the device refused it - each one said why in the log above)");
    L.push("  MADE THIS BOOT  " + (U && U.made ? U.made() : 0) + " BY THIS ROAD SO FAR");
    L.push("  THE SMALLER ORIGINALS  " + ((U && U.replace && U.replace())
      ? "WERE RETIRED INTO THE PICTURES THAT REPLACED THEM - every reference moved across first, exactly as a render made now is settled"
      : "ARE STILL IN THE VAULT BESIDE THEIR BIGGER SELVES (/upscale replace on retires them instead)"));
    if (stopped && r.total > r.tried) L.push("  NOT TOUCHED  " + (r.total - r.tried) + " MORE FROM THIS PLAN - /tools upscale " + sc.scope + " run TAKES THEM NEXT TIME.");
    L.push("  THE VAULT NOW HOLDS " + plural(window.media.list().length, "RECORD", "RECORDS") + ".");
    return L.join("\n");
  }

  /* ==========================================================================
     JOB :: REPAIR THE RECORD
     ========================================================================== */

  async function scanRecord() {
    var M = window.media;
    var logs = await masterLog();
    var seen = {}, dangling = [];
    function note(id, where, at, what) {
      if (!id) return;
      if (M.get(id)) return;
      if (!seen[id]) {
        seen[id] = { id: id, where: [], places: {}, what: what || "", heir: M.replacementFor ? M.replacementFor(id) : "" };
        dangling.push(seen[id]);
      }
      if (!seen[id].what && what) seen[id].what = what;
      seen[id].where.push(where + (at >= 0 ? " " + (at + 1) : ""));
      seen[id].places[where] = (seen[id].places[where] || 0) + 1;
    }
    logs.forEach(function (e, i) {
      if (!e) return;
      (Array.isArray(e.gen) ? e.gen : []).forEach(function (g) {
        if (g) note(g.id, "a creation row", i, g.name || short(g.prompt, 48));
      });
      (Array.isArray(e.sight) ? e.sight : []).forEach(function (s) { note(s, "she was shown it", i); });
      (Array.isArray(e.show) ? e.show : []).forEach(function (s) { note(s, "she asked to see it again", i); });
    });
    sightQueueIds().forEach(function (id) { note(id, "waiting for her eyes", -1); });
    var tally = {};
    dangling.forEach(function (d) {
      Object.keys(d.places).forEach(function (p) {
        tally[p] = tally[p] || { names: 0, places: 0 };
        tally[p].names++;
        tally[p].places += d.places[p];
      });
    });
    return { job: "record", scope: "", at: Date.now(), entries: logs.length, queue: sightQueueIds().length, dangling: dangling, tally: tally };
  }

  function recordText(sc) {
    var L = [];
    L.push("THE RECORD, AUDITED :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    L.push("  ARCHIVE ENTRIES         " + sc.entries);
    L.push("  WAITING FOR HER EYES    " + sc.queue);
    L.push("  NAMES WITH NO PICTURE   " + sc.dangling.length + (sc.dangling.length ? "   (unique ids)" : ""));
    Object.keys(sc.tally).sort().forEach(function (p) {
      L.push("    " + String(sc.tally[p].names).padEnd(4) + p + "   (" + plural(sc.tally[p].places, "place", "places") + ")");
    });
    if (!sc.dangling.length) {
      L.push("  NOTHING TO DO :: every id the record names is a picture the vault still holds.");
    } else {
      L.push("");
      L.push("  THE NAMES, AND WHAT THEY WERE:");
      sc.dangling.slice(0, 20).forEach(function (d) {
        L.push("    " + d.id + "  " + (d.what ? "\"" + d.what + "\"" : "") + (d.heir ? "  \u2192  " + d.heir + " IS HERE" : ""));
        L.push("        " + d.where.slice(0, 4).join(" \u00b7 ") + (d.where.length > 4 ? " \u00b7 ..." : ""));
      });
      if (sc.dangling.length > 20) L.push("    ... AND " + (sc.dangling.length - 20) + " MORE");
      L.push("");
      L.push("  A NAME WITH NO PICTURE IS NOT A FAULT. The archive is the account of what was done here, so a picture taken");
      L.push("  out of the vault - deleted in the gallery, or retired without its row being rewritten - does not un-happen.");
      L.push("  The tile it draws in the replayed log says IMAGE UNAVAILABLE IN THIS VAULT, which is exactly what it is.");
      L.push("  RUNNING THE JOB SETTLES ONLY WHAT CAN BE SETTLED SAFELY: a name with a KNOWN replacement is pointed at it, and a");
      L.push("  dead slot in the queue for her eyes is cleared. NOTHING IS EVER TAKEN OUT OF THE ARCHIVE.");
    }
    return L.join("\n");
  }

  async function applyRecord(sc) {
    var M = window.media;
    var repoint = {}, gone = {}, i;
    var B = bar("AUDITING THE RECORD", sc.dangling.length);
    for (i = 0; i < sc.dangling.length; i++) {
      var id = sc.dangling[i].id;
      var heir = M.replacementFor ? M.replacementFor(id) : "";
      if (heir && M.get(heir)) repoint[id] = heir; else gone[id] = true;
      if (B) B.set(i + 1);
    }
    var out = { fixed: 0, queueFixed: 0, queueRemoved: 0, wrote: false, left: Object.keys(gone).length };

    // ONLY A NAME THAT HAS A PICTURE TO MOVE TO IS TOUCHED. A name with nothing
    // behind it is left exactly where it is: the archive is the record of what
    // happened, and a picture being deleted does not un-happen.
    if (Object.keys(repoint).length) {
      var logs = await masterLog();
      logs.forEach(function (e) {
        if (!e) return;
        if (Array.isArray(e.gen)) e.gen.forEach(function (g) { if (g && repoint[g.id]) { g.id = repoint[g.id]; out.fixed++; } });
        ["sight", "show"].forEach(function (k) {
          if (!Array.isArray(e[k])) return;
          for (var n = 0; n < e[k].length; n++) if (repoint[e[k][n]]) { e[k][n] = repoint[e[k][n]]; out.fixed++; }
        });
      });
      out.wrote = await writeLog(logs);
    }

    // The queue for her eyes lives in its own slot, and its owner (images.js)
    // holds the live array - so it is edited in place and then re-saved through
    // the module's own door, which is the only writer of it. A slot naming a
    // picture that is gone can never be looked at, so clearing it is the one
    // removal here that takes nothing away - the queue is a work list, not a record.
    if (Array.isArray(window.unseen)) {
      var u = window.unseen;
      for (i = u.length - 1; i >= 0; i--) {
        var v = u[i];
        if (repoint[v]) { u[i] = repoint[v]; out.queueFixed++; }
        else if (gone[v]) { u.splice(i, 1); out.queueRemoved++; }
      }
      if ((out.queueFixed || out.queueRemoved) && typeof window.queueSight === "function") {
        try { await window.queueSight([]); } catch (e) {}
      }
    }
    return out;
  }

  function recordDone(sc, r) {
    if (r && r.error) return "THE RECORD, AUDITED :: THE RUN FAILED :: " + r.error;
    var L = ["THE RECORD, AUDITED :: DONE"];
    L.push("  NAMES POINTED AT THE PICTURE THAT REPLACED THEM  " + r.fixed);
    L.push("  THE QUEUE FOR HER EYES  " + r.queueFixed + " POINTED ON, " + r.queueRemoved + " DEAD SLOT" + (r.queueRemoved === 1 ? "" : "S") + " CLEARED");
    L.push("  NAMES WITH NO PICTURE, LEFT IN THE RECORD ON PURPOSE  " + r.left);
    if (r.fixed || r.queueFixed || r.queueRemoved) L.push("  THE ARCHIVE " + (r.wrote ? "WAS WRITTEN" : "DID NOT NEED WRITING") + ".");
    L.push("  NOTHING WAS TAKEN OUT OF THE ARCHIVE AND NO PICTURE WAS TOUCHED. A PICTURE DELETED FROM THE VAULT DOES NOT UN-HAPPEN -");
    L.push("  THE ROW THAT SAYS IT WAS MADE STAYS, AND ITS TILE IN THE REPLAYED LOG SAYS IMAGE UNAVAILABLE IN THIS VAULT.");
    return L.join("\n");
  }

  /* ==========================================================================
     JOB :: THE CLASSIFIER - THE BULK VISION PASS
     ========================================================================== */

  // WHAT HE ASKED FOR, in his own words: *"We can programmatically identify them later with some
  // yet unknown classifying with a trained AI vision model that knows what it is looking at. It
  // infers 'outdoor anal sex between a man and a woman' and puts it in that bucket. It may also
  // detect and tag the major elements in an image and create a record on that image analysis and
  // associated with that exact image. At that point, not AI, that's semantic search, etc. after the
  // AI did its work."*
  //
  // The per-record half already existed (ARCHIVAX reads one picture and writes the reading onto it
  // as its `sight`). This is the BULK half: one pass over the vault, one vision call a picture,
  // each answer WRITTEN ON THAT RECORD as three things -
  //
  //   sight   the reading: what is actually shown, in one factual sentence
  //   tags    the MAJOR ELEMENTS the model names - who, the act, the setting, the light, the style
  //   bucket  the KIND of scene, one slug, also hung on the record as a #tag
  //
  // - and, because a bucket is a place as well as a word, FILED into /images/<bucket> when
  // LIA_CLASSIFY_FILE is on (vault.js's bucketPath; the folders job is told to respect it, above).
  // After this, finding a record is not a model's job at all: it is /gallery #<bucket>, or /renders
  // find <WORDS> over the elements, or her own [[SHOW: #<bucket>]].
  //
  // AND CLIPS ARE READ (2026-09-24).*"Yes. Bulk classifier on video frames, Then she can tag the
  // video and classify it correctly."* A clip cannot go to the vision model as a file, so it goes as
  // a handful of STILLS spread from its opening to its end (LIA_CLIP_FRAMES of them; the road lives
  // in archivax.js, so the ops and this pass read a clip identically). The stills are read once and
  // thrown away; what is written on the clip is one reading of the whole movement, labelled
  // opens on / then / ends on, plus the elements its stills named and the kind MOST of them agreed
  // on. A clip that already carries a reading - written when it was sent to her - KEEPS it: the
  // stills are read for its tags and its bucket, and the reading is not written over. A clip costs
  // `frames` vision calls, and every bill here is printed in CALLS as well as tokens.
  //
  // THE VOCABULARY IS THE POINT. A model asked fresh for a label invents a near-synonym every time,
  // so the prompt carries the buckets already in use and asks for one of those whenever it fits -
  // which is why the pass converges on a real taxonomy instead of spraying 2,500 unique tags. The
  // records are read NEWEST FIRST, so a MAX PER RUN the size of an evening reads what he is
  // actually looking at, and STOP ends it after the record in hand.
  //
  // THE COST IS REAL AND IS SAID OUT LOUD BEFORE IT IS SPENT: one vision call a still against the
  // key in the ring, ~LIA_CLASSIFY_TOKENS each. The scan prints the estimate and the run prints it
  // again before it starts. Nothing else here is a spend: no render, no upload beyond the picture
  // itself going to the vision model, and no write anywhere but the record of the thing being read.

  // A record is DONE for this job when it carries BOTH a reading and a bucket. A record the
  // ordinary sight road already described has a `sight` and no bucket, so the pass still picks it
  // up - and a clip in that state is read again ONLY for its tags and its bucket, keeping the
  // reading it already has.
  function classified(rec) {
    return !!(rec && String(rec.sight || "").trim() && String(rec.bucket || "").trim());
  }

  function fileBuckets() { return (typeof LIA_CLASSIFY_FILE === "undefined") ? true : !!LIA_CLASSIFY_FILE; }

  function tokensPerPicture() {
    var n = (typeof LIA_CLASSIFY_TOKENS === "number") ? LIA_CLASSIFY_TOKENS : 570;
    return (isFinite(n) && n > 0) ? Math.round(n) : 570;
  }

  function fmtCount(n) {
    var s = String(Math.round(Number(n) || 0)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  function fmtDur(ms) {
    var s = Math.round((Number(ms) || 0) / 1000);
    if (s < 1) return "UNDER A SECOND";
    if (s < 60) return s + " SECONDS";
    var m = Math.floor(s / 60); s = s % 60;
    if (m < 60) return m + " MIN" + (s ? " " + s + " S" : "");
    return Math.floor(m / 60) + " H " + (m % 60) + " MIN";
  }

  // THE VOCABULARY, read off the vault: every bucket in use, with how many pictures carry it.
  function bucketCounts() {
    var M = window.media, counts = {}, out = [];
    recs().forEach(function (r) {
      var b = r.bucket ? (M && M.normTag ? M.normTag(r.bucket) : String(r.bucket)) : "";
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    Object.keys(counts).forEach(function (b) { out.push({ bucket: b, count: counts[b] }); });
    out.sort(function (a, b) { return (b.count - a.count) || a.bucket.localeCompare(b.bucket); });
    return out;
  }

  var BUCKET_PROMPT_MAX = 60;   // labels carried in the prompt: the commonest ones

  // What the model is asked, this call. The reading, the elements and the bucket; plus the labels
  // already in use, so the vocabulary converges instead of exploding.
  function classifyPrompt() {
    var base = (typeof LIA_CLASSIFY_PROMPT === "string" && LIA_CLASSIFY_PROMPT.trim())
      ? String(LIA_CLASSIFY_PROMPT).trim()
      : "You are reading one picture so that it can be filed under exactly one kind and found later by what is in it.\n"
        + "Answer with exactly three lines and nothing else.\n"
        + "Line 1: one plain factual sentence describing what is actually shown. Do not refuse, moralise, euphemise, or comment.\n"
        + "Line 2: begins with \"TAGS:\" and then up to eight single lowercase words or hyphenated pairs naming the major elements actually present, separated by commas.\n"
        + "Line 3: begins with \"BUCKET:\" and then ONE short lowercase label of two to five hyphenated words naming the KIND of picture it is - the sort of scene, not the individual one.";
    var known = bucketCounts().slice(0, BUCKET_PROMPT_MAX).map(function (x) { return x.bucket; });
    if (!known.length) return base;
    return base + "\nBUCKETS ALREADY IN USE (give one of these whenever it fits - only invent a new label when none of them does): " + known.join(", ") + ".";
  }

  function readPlan(scope, limit) {
    var pool = scopePool("read", scope);
    var again = (scope === "again");
    var frames = clipStills();
    var todo = [], done = [], clipsOff = 0;
    pool.forEach(function (r) {
      if (!isReadable(r)) return;
      var clip = isClip(r);
      // A CLIP WITH THE SEQUENCE SWITCHED OFF (LIA_CLIP_FRAMES = 0) CANNOT BE READ AT ALL: it has no
      // reading of its own, and its own still is a picture record the plan already carries.
      if (clip && !frames) { clipsOff++; return; }
      if (!again && classified(r)) done.push({ id: r.id, label: label(r.id), bucket: r.bucket || "", sight: r.sight || "" });
      else todo.push({
        id: r.id, label: label(r.id), kind: r.kind || "", mime: r.mime || "", bytes: r.bytes || 0,
        was: r.bucket || "", hadSight: !!String(r.sight || "").trim(),
        clip: clip, frames: clip ? frames : 0, calls: clip ? frames : 1
      });
    });
    // NEWEST FIRST, so a run with a MAX PER RUN reads the things he is looking at now.
    todo.reverse();
    var per = tokensPerPicture();
    var calls = todo.reduce(function (n, x) { return n + (x.calls || 1); }, 0);
    return {
      job: "read", scope: scope, at: Date.now(), limit: limit || 0,
      pictures: pool.filter(isPicture).length,
      clips: pool.filter(isClip).length,
      clipsOff: clipsOff,
      framesPerClip: frames,
      do: todo, skipped: done, again: again,
      calls: calls,
      renders: todo.filter(function (x) { return x.kind === "gen" || x.kind === "upscale"; }).length,
      yours: todo.filter(function (x) { return isYours(x); }).length,
      picDo: todo.filter(function (x) { return !x.clip; }).length,
      clipDo: todo.filter(function (x) { return x.clip; }).length,
      clipKept: todo.filter(function (x) { return x.clip && x.hadSight; }).length,
      known: bucketCounts(),
      file: fileBuckets(),
      reachable: !!(window.archivax && window.archivax.look && window.root && window.root.generateText),
      estTokens: calls * per,
      estMs: (readAvgN ? (readAvgMs / readAvgN) : 0) * calls,
      avgN: readAvgN
    };
  }

  function readText(sc) {
    var per = tokensPerPicture();
    var L = [];
    L.push("THE CLASSIFIER :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    L.push("  SCOPE                 " + scopeWords("read", sc.scope));
    L.push("  PICTURES IN SCOPE     " + sc.pictures);
    if (sc.clips) {
      L.push("  CLIPS IN SCOPE        " + sc.clips + (sc.framesPerClip
        ? "  (read as " + sc.framesPerClip + " stills spread across each one - opening to end)"
        : "  (the sequence is switched off - their own stills stand for them)"));
    }
    L.push("  ALREADY CLASSIFIED    " + sc.skipped.length + (sc.skipped.length ? "  (a reading and a bucket - skipped; the scope `again` re-reads them)" : ""));
    L.push("  WILL BE READ          " + sc.do.length + (sc.do.length
      ? "  (" + plural(sc.renders, "RENDER", "RENDERS") + ", " + plural(sc.yours, "YOUR PICTURE", "YOUR PICTURES")
        + (sc.clipDo ? ", " + plural(sc.clipDo, "CLIP", "CLIPS") + " AT " + sc.framesPerClip + " STILLS EACH" : "") + ")"
      : ""));
    if (sc.clipDo) L.push("  OF WHICH ARE CLIPS     " + sc.clipDo + "  ::  " + sc.picDo + " PICTURES AND " + sc.clipDo + " CLIPS = " + sc.do.length + " RECORDS");
    L.push("  THE VISION CALLS      " + fmtCount(sc.calls) + " CALL" + (sc.calls === 1 ? "" : "S") + "  (~" + fmtCount(per) + " tokens a still"
      + (sc.framesPerClip ? ", " + sc.framesPerClip + " stills a clip" : "") + ")  ::  ~" + fmtCount(sc.estTokens) + " tokens against the key in the ring");
    if (sc.estMs) L.push("  AT ITS OWN PACE       ~" + fmtDur(sc.estMs) + " (measured here on " + plural(sc.avgN, "VISION CALL", "VISION CALLS") + " so far this boot)");
    L.push("  EACH ONE GETS         its reading written as the record's SIGHT, the major elements as TAGS, and the kind of scene as its BUCKET");
    if (sc.clipDo) L.push("  A CLIP IS READ AS ONE MOVEMENT  ::  its stills are labelled opens on / then / ends on and the stills themselves are NOT KEPT - the clip keeps only its own thumbnail");
    if (sc.clipKept) L.push("  A CLIP ALREADY READ   " + sc.clipKept + " already carry a reading (written when it was sent) - that reading is KEPT, and its stills are read for its tags and its bucket");
    if (sc.clipsOff) L.push("  CLIPS LEFT ALONE      " + sc.clipsOff + " (LIA_CLIP_FRAMES = 0 - a clip cannot be read; its own still is a picture and is read as one)");
    L.push("  THE BUCKETS           " + (sc.file
      ? "hung on the record as a #tag AND filed into /images/<bucket> (an upscale into /images/upscaled/<bucket>, a clip into /clips/<bucket>) - the folders job is told to respect them"
      : "hung on the record as a #tag and kept on its record - NOTHING IS FILED (LIA_CLASSIFY_FILE is off)"));
    L.push("  THE MODEL IS TOLD     nothing about you and nothing about this terminal: it is handed the picture (and, for a clip, one still out of it at a time) and asked what is in it");
    L.push("  WHAT LEAVES THE DEVICE  THE PICTURE ITSELF - and each still of a clip - to the vision model, once. The one place any of it is ever sent. Nothing is stored anywhere else.");
    if (sc.known.length) {
      L.push("");
      L.push("  THE VOCABULARY SO FAR   " + plural(sc.known.length, "BUCKET", "BUCKETS") + " (the commonest " + Math.min(BUCKET_PROMPT_MAX, sc.known.length) + " ride in the prompt, so the model reuses them):");
      sc.known.slice(0, 12).forEach(function (b) { L.push("    " + b.bucket + "  (" + b.count + ")"); });
      if (sc.known.length > 12) L.push("    ... AND " + (sc.known.length - 12) + " MORE");
    }
    if (!sc.do.length) {
      L.push("");
      L.push("  NOTHING TO DO :: everything readable under this scope already carries a reading and a bucket. The scope `again` re-reads them; a bucket that came out wrong can also be re-read one thing at a time with the model's own reading.");
    } else {
      L.push("");
      L.push("  THE FIRST FEW, NEWEST FIRST:");
      sc.do.slice(0, 8).forEach(function (x) {
        L.push("    " + x.label
          + (x.clip ? "   (clip, read as " + x.frames + " stills across it" + (x.hadSight ? ", keeping the reading it has" : "") + ")" : "")
          + (!x.clip && x.was ? "   (bucket now: " + x.was + ")" : (!x.clip && x.hadSight ? "   (has a reading, no bucket yet)" : "")));
      });
      if (sc.do.length > 8) L.push("    ... AND " + (sc.do.length - 8) + " MORE - THE RUN TAKES THEM ALL, NEWEST FIRST");
    }
    L.push("");
    L.push("  NOTHING HAS CHANGED. /tools read " + sc.scope + " run READS THEM ONE AT A TIME THROUGH THE SAME VISION ROAD HER OWN READINGS USE - STOP ENDS IT AFTER THE RECORD IN HAND, AND WHAT HAS ALREADY BEEN READ IS KEPT, SO A LONG PASS CAN BE FINISHED IN SITTINGS.");
    return L.join("\n");
  }

  async function applyRead(sc) {
    var M = window.media, A = window.archivax;
    if (!A || !A.look || !A.fileReading) return { error: "THE VISION ROAD IS OFFLINE (src/js/archivax.js)." };
    if (!window.root || !window.root.generateText) return { error: "THE VISION MODEL IS NOT REACHABLE - THE TEXT/IMAGE PLUGIN DID NOT LOAD, OR NO KEY THAT SERVES IT IS IN THE RING." };
    var list = sc.do.slice();
    if (sc.limit) list = list.slice(0, sc.limit);
    var out = { total: list.length, all: sc.do.length, read: 0, failed: 0, tried: 0, tags: 0, buckets: {}, filed: 0, ms: 0, streak: 0, aborted: "", calls: 0, clips: 0, kept: 0, partial: 0 };
    var sweepIds = list.map(function (x) { return x.id; });
    var per = tokensPerPicture();
    var frames = sc.framesPerClip || clipStills();
    var clipCount = list.filter(function (x) { return x.clip; }).length;
    // THE BILL, IN CALLS AND IN TOKENS. A clip is not one call: it is `frames` of them, one per
    // still, so the estimate the scan printed and the running count here are the same arithmetic.
    var calls = list.reduce(function (n, x) { return n + (x.calls || 1); }, 0);
    say("THE CLASSIFIER :: READING " + list.length + " RECORD" + (list.length === 1 ? "" : "S")
      + (clipCount ? " (" + clipCount + " OF THEM CLIP" + (clipCount === 1 ? "" : "S") + ", READ AS " + frames + " STILLS ACROSS EACH ONE)" : "")
      + " - " + calls + " VISION CALL" + (calls === 1 ? "" : "S") + ", ABOUT " + fmtCount(per * calls) + " TOKENS ON THE TEXT ENGINE. /tools stop ENDS IT AFTER THE RECORD IN HAND.");
    progress("READING 0 / " + list.length);
    // THE BAR: one tick per record examined (a clip is still ONE record on the rail - its stills are
    // the vision calls inside it, and the run's own estimate of those is printed before it starts).
    var B = bar("READING PICTURES", list.length);
    for (var i = 0; i < list.length; i++) {
      if (stopped) break;
      var item = list[i];
      var id = item.id;
      if (!M.get(id)) { out.failed++; out.tried++; if (B) B.set(out.tried); continue; }
      // THE RECORD IN HAND: the deck's chip carries its thumbnail and its citation while it is
      // being read, so a pass of hundreds can be watched - and interrupted - from the conversation.
      hand(id, "READING " + (out.tried + 1) + " / " + list.length, "THE CLASSIFIER", sweepIds, i);
      if (item.clip) {
        say("CLASSIFIER :: CLIP :: " + label(id) + " :: READING " + frames + " STILLS SPREAD ACROSS IT - THE STILLS ARE NOT KEPT; ONLY THE CLIP AND ITS OWN THUMBNAIL STAY IN THE VAULT.");
      }
      var c0 = Date.now();
      var found = null;
      try { found = await A.look(id, { prompt: classifyPrompt(), tagMax: 8, overwrite: !!sc.again }); }
      catch (e) { found = { ok: false, why: (e && e.message) ? e.message : String(e) }; }
      out.tried++;
      out.calls += (found && found.calls) ? found.calls : 1;
      if (!found || !found.ok) {
        out.failed++; out.streak++;
        say("CLASSIFIER :: NOT READ :: " + label(id) + " :: " + ((found && found.why) || "no answer"));
        if (out.streak >= 5 && !out.read) { out.aborted = "the vision model is not answering"; break; }
        progress("READING " + out.tried + " / " + list.length);
        if (B) B.set(out.tried);
        continue;
      }
      // A MODEL THAT WILL NOT DESCRIBE IT: a refusal comes back as prose, with no tag line and no
      // bucket line. Nothing is written on the record for that - an answer of the right SHAPE is
      // the least this can insist on, and a refusal written as a reading would poison the record.
      if (!found.bucket && !(found.tags || []).length) {
        out.failed++; out.streak++;
        say("CLASSIFIER :: NO ANALYSIS :: " + label(id) + " :: the model answered without a tag line or a bucket - nothing was written on it.");
        if (out.streak >= 5 && !out.read) { out.aborted = "the model will not describe this vault"; break; }
        progress("READING " + out.tried + " / " + list.length);
        if (B) B.set(out.tried);
        continue;
      }
      out.streak = 0;
      var res = null;
      try { res = await A.fileReading(id, found, "patrikios", { tags: true, bucket: true, mark: "CLASSIFIER" }); }
      catch (e) { res = null; }
      if (!res || !res.wrote) {
        out.failed++;
        say("CLASSIFIER :: NOT FILED :: " + label(id) + " :: the record had gone by the time it was written.");
        progress("READING " + out.tried + " / " + list.length);
        if (B) B.set(out.tried);
        continue;
      }
      out.read++;
      if (item.clip) {
        out.clips++;
        if (found.keptReading) out.kept++;
        if (found.partial) out.partial++;
      }
      out.tags += (res.tags || []).length;
      if (res.bucket) out.buckets[res.bucket] = (out.buckets[res.bucket] || 0) + 1;
      if (res.bucket && fileBuckets()) {
        try {
          var rec = M.get(id);
          var path = M.bucketPath ? M.bucketPath(rec) : "";
          if (path && M.folderOf(rec) !== path) {
            var mv = await M.setFolder(id, path);
            if (mv && mv.ok) out.filed++;
          }
        } catch (e) { console.warn("tools: a classified record could not be filed", e); }
      }
      out.ms += (Date.now() - c0);
      progress("READING " + out.tried + " / " + list.length);
      if (B) B.set(out.tried);
      if ((out.tried % 10 === 0) || out.tried === list.length || stopped) {
        say("THE CLASSIFIER :: " + out.tried + " OF " + list.length + " :: " + out.read + " READ, " + out.failed + " NOT" + (stopped ? " :: STOPPING" : ""));
      }
    }
    // The pace is kept PER CALL, not per record, so a pass of clips still estimates the next one
    // honestly (a clip is `frames` calls).
    if (out.read) { readAvgMs += out.ms; readAvgN += out.calls; }
    progress("");
    // A pass run from the deck is still on HER revision history: one entry, not one per record.
    try {
      if (out.read && A.journalAdd) {
        await A.journalAdd({
          ts: Date.now(), op: "classify", by: "patrikios", n: out.read,
          note: "the bulk pass from the deck (/tools read " + sc.scope + ")" + (out.clips ? " · " + out.clips + " clip" + (out.clips === 1 ? "" : "s") : "") + " · " + Object.keys(out.buckets).length + " buckets"
        });
      }
    } catch (e) { console.warn("tools: the classifier could not write the journal", e); }
    return out;
  }

  function readDone(sc, r) {
    if (r && r.error) return "THE CLASSIFIER :: THE RUN FAILED :: " + r.error;
    var per = tokensPerPicture();
    var L = ["THE CLASSIFIER :: DONE" + (stopped ? " (STOPPED EARLY)" : "")];
    L.push("  RECORDS READ         " + r.read + " OF " + r.total + " ATTEMPTED" + (r.all > r.total ? "  (" + r.all + " WERE IN THE PLAN)" : "")
      + (r.clips ? "  ::  " + r.clips + " OF THEM CLIP" + (r.clips === 1 ? "" : "S") : ""));
    if (r.failed) L.push("  NOT READ             " + r.failed + " (each said why in the log above - a record the model would not describe is left exactly as it was found)");
    L.push("  ELEMENTS FILED       " + plural(r.tags, "TAG", "TAGS") + ", hung on the records themselves");
    var bs = Object.keys(r.buckets).sort(function (a, b) { return (r.buckets[b] - r.buckets[a]) || a.localeCompare(b); });
    L.push("  BUCKETS              " + bs.length + (bs.length ? "  ::  " + bs.slice(0, 8).map(function (b) { return b + " (" + r.buckets[b] + ")"; }).join("  \u00b7  ") + (bs.length > 8 ? "  \u00b7  ..." : "") : ""));
    if (fileBuckets()) L.push("  FILED                " + r.filed + " INTO THEIR BUCKET FOLDER (/images/<bucket>, a clip into /clips/<bucket>) - AND THE FOLDERS JOB NOW LEAVES THOSE ALONE");
    else L.push("  NOTHING FILED        (LIA_CLASSIFY_FILE is off - the bucket is on the record and in the tags, and /gallery #<bucket> finds it)");
    if (r.calls) L.push("  VISION CALLS         " + fmtCount(r.calls) + "  (~" + fmtCount(per * r.calls) + " TOKENS)");
    if (r.kept) L.push("  CLIP READINGS KEPT   " + r.kept + " clip" + (r.kept === 1 ? "" : "s") + " already carried a reading (written when it was sent to her) - it was NOT written over; its stills were read for its tags and its bucket");
    if (r.partial) L.push("  CLIPS PART-READ      " + r.partial + " (a still or two of it could not be read - the reading covers the stills that answered, and the count is on the record)");
    if (r.ms && r.read) L.push("  TOOK                 " + fmtDur(r.ms) + "  (" + Math.round(r.ms / Math.max(1, r.calls)) + " ms a vision call)");
    if (r.aborted) L.push("  ABORTED              " + String(r.aborted).toUpperCase() + " - NOTHING FURTHER WAS ASKED OF IT.");
    if (stopped && r.total > r.tried) L.push("  NOT TOUCHED          " + (r.total - r.tried) + " MORE FROM THIS PLAN - /tools read " + sc.scope + " run TAKES THEM NEXT TIME.");
    L.push("  THE VAULT NOW HOLDS  " + plural(window.media.list().length, "RECORD", "RECORDS") + ".");
    L.push("  FINDING A RECORD IS NOT A MODEL'S JOB ANY MORE: THE ANALYSIS IS ON THE RECORD. /gallery #<bucket>, /renders find <WORDS>, OR HER OWN [[SHOW: #<bucket>]].");
    return L.join("\n");
  }

  /* ==========================================================================
     THE REGISTRY
     ========================================================================== */

  /* ==========================================================================
     JOB :: DUPLICATE SCROLLS (loaded lore text files, twice-held text)
     ========================================================================== */

  async function loreHash(s) {
    var str = String(s == null ? "" : s), n = str.length;
    var h1 = 5381, h2 = 52711, i, c, base, end;
    var STEP = 262144;
    for (base = 0; base < n; base += STEP) {
      end = Math.min(n, base + STEP);
      for (i = base; i < end; i++) { c = str.charCodeAt(i); h1 = (((h1 * 33) ^ c) >>> 0); h2 = (((h2 * 31) + c) >>> 0); }
      if (end < n) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
    }
    return h1.toString(36) + "." + h2.toString(36) + "." + n;
  }

  async function scanLoreDupes() {
    var sc = { job: "loredupes", scope: "", at: Date.now(), scanned: 0, hashed: 0, groups: [], copies: 0, reclaim: 0 };
    if (!window.lore) { sc.offline = true; return sc; }
    var files = [];
    try { files = window.lore.files() || []; } catch (e) { sc.offline = true; return sc; }
    var store = null;
    try { store = window.root && window.root.kv && window.root.kv.lore_files; } catch (e) {}
    if (!store) { sc.offline = true; return sc; }
    var B = bar("DUPLICATE SCROLLS \u00b7 READING", files.length);
    var byHash = {}, i, done = 0;
    for (i = 0; i < files.length; i++) {
      if (stopped) break;
      if (i % 10 === 0) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
      var f = files[i], raw = null;
      try { var rec = await store.get(f.name); if (rec && typeof rec.raw === "string") raw = rec.raw; } catch (e) {}
      done++;
      if (B) { try { B.set(done); } catch (e) {} }
      if (raw == null) continue;
      sc.hashed++;
      var h = await loreHash(raw);
      (byHash[h] = byHash[h] || []).push({ name: f.name, bytes: raw.length, at: f.addedAt || 0, foundational: !!f.foundational });
    }
    barDone();
    Object.keys(byHash).forEach(function (h) {
      var g = byHash[h];
      if (g.length < 2) return;
      g.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      // THE KEEP RULE. Canon is never a drop: if any copy is foundational, the earliest canon
      // copy stays, always. Otherwise his current naming scheme stays: a .MUSE. name beats an
      // older-scheme one (SYS.AI.ERATO.* / SYS.AI.SHAN.* are the retired names of the same bytes).
      // Else the first-loaded stays.
      var canon = g.filter(function (x) { return x.foundational; });
      var keep = null, ki = 0;
      if (canon.length) { keep = canon[0]; ki = g.indexOf(keep); }
      else {
        keep = g[0];
        for (var m = 0; m < g.length; m++) {
          if (g[m].name.indexOf(".MUSE.") !== -1) { keep = g[m]; ki = m; break; }
        }
      }
      var drops = g.filter(function (x, xi) { return xi !== ki && !x.foundational; });
      var held = g.filter(function (x, xi) { return xi !== ki && x.foundational; });
      if (!drops.length) return;
      sc.groups.push({
        hash: h, keep: keep.name, copies: g.length,
        names: g.map(function (x) { return x.name; }),
        drops: drops.map(function (x) { return x.name; }),
        held: held.map(function (x) { return x.name; }),
        bytes: keep.bytes,
        reclaim: drops.reduce(function (n, x) { return n + x.bytes; }, 0)
      });
    });
    sc.groups.sort(function (a, b) { return b.reclaim - a.reclaim || b.copies - a.copies; });
    sc.scanned = files.length;
    sc.copies = sc.groups.reduce(function (n, g) { return n + g.drops.length; }, 0);
    sc.reclaim = sc.groups.reduce(function (n, g) { return n + g.reclaim; }, 0);
    return sc;
  }

  function loreText(sc) {
    var L = [];
    L.push("DUPLICATE SCROLLS :: SCAN ONLY - NOTHING HAS BEEN TOUCHED");
    if (sc.offline) { L.push("  THE LORE IS UNREADABLE HERE - NOTHING SCANNED."); return L.join("\n"); }
    L.push("  SCROLLS READ             " + sc.scanned + " (" + sc.hashed + " HASHED AND COMPARED BY CONTENT)");
    L.push("  IDENTICAL GROUPS         " + sc.groups.length);
    L.push("  COPIES BEYOND THE FIRST  " + sc.copies + "  ::  " + fmtBytes(sc.reclaim) + " HELD TWICE");
    if (!sc.groups.length) {
      L.push("  NOTHING TO DO :: every loaded scroll is held once.");
    } else {
      var shown = 0;
      for (var i = 0; i < sc.groups.length; i++) {
        var g = sc.groups[i];
        if (shown >= 14) { L.push(""); L.push("  ... AND " + plural(sc.groups.length - shown, "MORE GROUP", "MORE GROUPS") + " - THE RUN TAKES THEM ALL."); break; }
        shown++;
        L.push("");
        L.push("  GROUP " + (i + 1) + " :: " + plural(g.copies, "COPY", "COPIES") + ", " + fmtBytes(g.bytes) + " EACH");
        L.push("    KEEP  " + g.keep + "   (CANON STAYS; ELSE THE .MUSE.-SCHEME NAME; ELSE FIRST LOADED)");
        for (var j = 0; j < g.drops.length; j++) L.push("    DROP  " + g.drops[j]);
        for (var k2 = 0; k2 < (g.held || []).length; k2++) L.push("    HELD  " + g.held[k2] + "   (CANON - NEVER A DROP)");
      }
    }
    L.push("");
    L.push("  NOTHING HAS CHANGED. /tools loredupes run KEEPS ONE OF EACH AND TRASHES THE REST - EACH COPY RE-CHECKED BYTE-FOR-BYTE AT THE MOMENT OF DELETION, AND EVERYTHING TAKEN IS HELD IN /trash (RESTORE WITH /trash restore <NAME>).");
    return L.join("\n");
  }

  async function applyLoreDupes(sc) {
    var out = { groups: 0, dropped: 0, bytes: 0, refused: 0 };
    var store = null;
    try { store = window.root && window.root.kv && window.root.kv.lore_files; } catch (e) {}
    var allDrops = sc.groups.reduce(function (a, g) { return a.concat(g.drops); }, []);
    var B = bar("DUPLICATE SCROLLS \u00b7 CHECKING COPIES", allDrops.length), seen = 0;
    // THE SAFETY RAIL runs first over EVERYTHING: each copy is re-hashed NOW and only the ones
    // still byte-identical are taken - and then all of them go in ONE bulk forget, because one
    // reindex over hundreds of scrolls costs seconds and the per-file road would pay it per copy.
    var verified = [];
    for (var i = 0; i < sc.groups.length; i++) {
      var g = sc.groups[i];
      for (var j = 0; j < g.drops.length; j++) {
        if (stopped) break;
        if (j % 20 === 0) { try { await new Promise(function (r) { setTimeout(r, 0); }); } catch (e) {} }
        var name = g.drops[j];
        if (B) { try { B.set(++seen); } catch (e) {} }
        var still = false;
        try {
          if (store) { var rec = await store.get(name); if (rec && rec.raw != null) still = ((await loreHash(rec.raw)) === g.hash); }
        } catch (e) {}
        if (!still) {
          out.refused++;
          say("DUPLICATE SCROLLS :: LEFT ALONE :: " + name + " IS NO LONGER BYTE-IDENTICAL TO " + g.keep + " - NOTHING WAS TAKEN FOR IT.");
          continue;
        }
        verified.push({ group: i, name: name, bytes: g.bytes });
      }
      if (stopped) break;
    }
    barDone();
    if (verified.length && !stopped) {
      var names = verified.map(function (v) { return v.name; });
      var res = { dropped: [] };
      try { if (window.lore && window.lore.forgetFiles) res = await window.lore.forgetFiles(names); } catch (e) { res = { dropped: [] }; }
      var gone = {};
      (res.dropped || []).forEach(function (n) { gone[n] = 1; });
      var perGroup = {};
      verified.forEach(function (v) {
        if (gone[v.name]) {
          out.dropped++; out.bytes += v.bytes;
          perGroup[v.group] = 1;
        } else out.refused++;
      });
      out.groups = Object.keys(perGroup).length;
    }
    return out;
  }

  function loreDone(sc, r) {
    if (r && r.error) return "DUPLICATE SCROLLS :: THE RUN FAILED :: " + r.error;
    var L = [];
    L.push("DUPLICATE SCROLLS :: DONE" + (stopped ? " (STOPPED EARLY)" : ""));
    L.push("  GROUPS SETTLED   " + r.groups + " OF " + sc.groups.length);
    L.push("  COPIES TRASHED   " + r.dropped + " (HELD IN /trash - /trash restore <NAME> BRINGS ONE BACK)");
    L.push("  RECLAIMED        " + fmtBytes(r.bytes));
    if (r.refused) L.push("  LEFT ALONE        " + r.refused + " (the bytes had changed since the scan - nothing was taken for them)");
    L.push("  ONE COPY OF EVERY GROUP IS STILL HERE.");
    return L.join("\n");
  }

  var JOBS = [
    {
      id: "dupes",
      title: "DUPLICATE PICTURES",
      what: "Hunt down pictures the vault is holding more than once - the same BYTES under two ids, confirmed by hashing, not guessed from a file name. A run keeps one of each group and drops the rest, carrying every reference across FIRST: the archive's creation row, what she was shown, what she asked to see again, its place in the queue for her eyes, a KEEP with its recipe and its link, its tags, its folder, and what was made from it. Two pictures that merely came out of the same prompt and seed are LISTED and never deleted - a re-render is a different picture.",
      scopes: [],
      limit: false,
      danger: true,
      scan: scanDupes,
      text: dupesText,
      apply: applyDupes,
      done: dupesDone
    },
    {
      id: "folders",
      title: "PROPER FOLDERS",
      what: "Put every record in the folder its kind belongs in - pictures in /images, an upscale in /images/upscaled, a clip in /clips, a piece of music in /music, and a VOICE in the VOX tree (/audio/vox, or /audio/vox/<agent> when the record names one - a voice is never filed into /music, because a voice is not music). A record that was filed somewhere itself (by hand, by her, or by an upscale inheriting its source's folder) is moved out of it, and the move is named. This job never deletes a record and never touches a blob: a folder is a field on a record, and the blob has no path.",
      scopes: [
        { id: "made", label: "WHAT THE TERMINAL MADE" },
        { id: "pictures", label: "EVERY PICTURE" },
        { id: "all", label: "EVERYTHING" }
      ],
      limit: false,
      danger: false,
      scan: scanFolders,
      text: foldersText,
      apply: applyFolders,
      done: foldersDone
    },
    {
      id: "upscale",
      title: "UPSCALE WHAT ISN'T 2x YET",
      what: "The backfill sweep for the local pipeline: every picture that has never been made 2x is queued through the same road /upscale here uses - on this machine's GPU, nothing opened, nothing uploaded, written as png. Anything already upscaled (or already an upscale, or too big for this device's ceiling) is skipped and told why. It goes ONE AT A TIME through the upscaler's own queue, so it can run while the conversation carries on, and STOP ends it after the picture in hand.",
      scopes: [
        { id: "renders", label: "RENDERS (what the terminal made)" },
        { id: "yours", label: "PICTURES YOU HANDED OVER" },
        { id: "all", label: "EVERY PICTURE" }
      ],
      limit: true,
      danger: false,
      scan: upscalePlan,
      text: upscaleText,
      apply: applyUpscale,
      done: upscaleDone
    },
    {
      id: "read",
      title: "CLASSIFY (THE BULK VISION PASS)",
      what: "Read every picture in the vault once with the vision model, and write what it finds ON THE RECORD: the reading as its sight, the MAJOR ELEMENTS as tags, and the KIND of scene as its bucket. CLIPS ARE READ TOO - not as one freeze-frame but as a HANDFUL OF STILLS spread from the clip's opening to its end, so what is written on a clip is what happens ACROSS it (the stills are read once and thrown away; the clip keeps only its own thumbnail). This is the pass that turns looking things up from a model's job into ordinary search - after it, a record is found by /gallery #<bucket>, by /renders find <WORDS>, or by her own [[SHOW: #<bucket>]], with no model involved at all. A bucket is also a PLACE: a classified picture is filed into /images/<bucket> (an upscale into /images/upscaled/<bucket>, a clip into /clips/<bucket>), and the folders job is told to respect that rather than flatten it back out; LIA_CLASSIFY_FILE off keeps the classification and files nothing. The buckets already in use are carried in the prompt, so the model reuses them and the vocabulary converges instead of exploding. ONE VISION CALL A STILL (so a clip costs LIA_CLIP_FRAMES of them) against the key in the ring - the scan prints the estimated spend in calls and tokens before anything is pressed, a record the model will not describe is left exactly as it was found, and STOP ends the pass after the record in hand.",
      scopes: [
        { id: "all", label: "EVERYTHING READABLE (pictures and clips)" },
        { id: "renders", label: "RENDERS (what the terminal made)" },
        { id: "yours", label: "WHAT YOU HANDED OVER (pictures and clips)" },
        { id: "again", label: "READ THEM AGAIN (overwrite a reading)" }
      ],
      limit: true,
      danger: false,
      scan: readPlan,
      text: readText,
      apply: applyRead,
      done: readDone
    },
    {
      id: "record",
      title: "THE RECORD, AUDITED",
      what: "Read the archive and the queue for her eyes and find every id they name that the vault no longer holds - the row or the slot that would draw nothing. A NAME WITH NO PICTURE IS NOT A FAULT: the archive is the account of what was done here, so a picture deleted from the vault does not un-happen, and this job NEVER takes a name out of the archive. What a run settles is the two things that can be settled safely: a name with a KNOWN replacement (the bigger picture that retired it) is pointed at it, and a dead slot in the queue for her eyes - a picture that is gone and can therefore never be looked at - is cleared. The scan is the deliverable: it says exactly what the record names that is not here, and what each one was.",
      scopes: [],
      limit: false,
      danger: false,
      scan: scanRecord,
      text: recordText,
      apply: applyRecord,
      done: recordDone
    },
    {
      id: "loredupes",
      title: "DUPLICATE SCROLLS",
      vault: false,
      what: "Hunt down loaded lore text the device is holding more than once - the same BYTES under two scroll names, confirmed by hashing the full text, not guessed from a file name. THE KEEP RULE: canon is never a drop; else the .MUSE.-scheme name stays (the older SYS.AI.ERATO.* / SYS.AI.SHAN.* names are retired); else first-loaded. A run trashes the rest - trashed, not destroyed, so /trash restore brings one back - every copy re-checked byte-for-byte first, and all of them taken in one bulk forget so the big reindex is paid once.",
      scopes: [],
      limit: false,
      danger: true,
      scan: scanLoreDupes,
      text: loreText,
      apply: applyLoreDupes,
      done: loreDone
    }
  ];

  function jobById(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase().replace(/^\//, "");
    var ALIAS = {
      duplicate: "dupes", duplicates: "dupes", dup: "dupes", dupe: "dupes", dups: "dupes", dedupe: "dupes", "de-dupe": "dupes",
      folder: "folders", file: "folders", filing: "folders", organise: "folders", organize: "folders",
      upscaling: "upscale", sweep: "upscale", "2x": "upscale", backfill: "upscale",
      classify: "read", classifier: "read", classifying: "read", classification: "read", classifyall: "read",
      bucket: "read", buckets: "read", vision: "read", sight: "read", reading: "read",
      analyse: "read", analyze: "read", analysis: "read", understand: "read", catalog: "read", catalogue: "read",
      repair: "record", refs: "record", archive: "record", fix: "record",
      loredupe: "loredupes", loredupes: "loredupes", scrolldupe: "loredupes", scrolldupes: "loredupes",
      textdupe: "loredupes", textdupes: "loredupes", dedupelore: "loredupes", scrolls: "loredupes"
    };
    if (ALIAS[want]) want = ALIAS[want];
    for (var i = 0; i < JOBS.length; i++) if (JOBS[i].id === want) return JOBS[i];
    return null;
  }

  function normScope(job, scope) {
    var want = String(scope == null ? "" : scope).trim().toLowerCase();
    var ALIAS = {
      made: "made", terminal: "made", renders: "renders", render: "renders", gen: "renders",
      pictures: "pictures", picture: "pictures", pics: "pictures", images: "pictures",
      yours: "yours", mine: "yours", attach: "yours", attachments: "yours",
      all: "all", everything: "all", every: "all", unread: "all", new: "all", todo: "all", unseen: "all",
      again: "again", redo: "again", overwrite: "again", reread: "again", "re-read": "again"
    };
    want = ALIAS[want] || want;
    for (var i = 0; i < job.scopes.length; i++) if (job.scopes[i].id === want) return want;
    return job.scopes.length ? job.scopes[0].id : "";
  }

  /* ==========================================================================
     THE WORDS
     ========================================================================== */

  function jobsText() {
    return JOBS.map(function (j) {
      var usage = "/tools " + j.id + (j.scopes.length ? " [" + j.scopes.map(function (s) { return s.id; }).join("|") + "]" : "") + (j.danger ? " run" : "");
      return "  " + usage.padEnd(34) + j.what.slice(0, 150) + (j.what.length > 150 ? "\u2026" : "");
    }).join("\n");
  }

  function helpText() {
    var M = window.media, U = window.upscaleLocal;
    var L = [];
    L.push("THE TOOLS :: " + JOBS.length + " JOBS, ONE AT A TIME, EVERY ONE OF THEM SCANNED BEFORE IT RUNS");
    L.push("");
    L.push(jobsText());
    L.push("");
    L.push("  /tools                  THIS LIST, AND THE STATE OF THE VAULT");
    L.push("  /tools report           THE VAULT, COUNTED (records, kinds, folders, the queue for her eyes, the upscale settings)");
    L.push("  /tools scan <JOB> [SCOPE]   THE PREVIEW ON ITS OWN - nothing is changed");
    L.push("  /tools <JOB> [SCOPE]    THE SAME PREVIEW");
    L.push("  /tools <JOB> [SCOPE] run    DO IT. The word `run` is the confirmation - the jobs that delete (DUPLICATE PICTURES destroys, DUPLICATE SCROLLS trashes restorable) will not go ahead without it");
    L.push("  /tools stop             END A RUNNING SWEEP after the picture in hand");
    L.push("  /tools help <JOB>       WHAT ONE JOB IS FOR");
    L.push("");
    L.push("  THE PANEL :: TOOLS \u25be IN THE DECK. Pick the job, pick how wide it reaches, press SCAN, read it, press RUN.");
    L.push("  EVERY CHANGE IS PRINTED AS A SYSTEM LINE, SO IT IS IN THE LOG BEHIND THE VEIL EITHER WAY.");
    L.push("  REPORTED ONLY, NEVER ACTED ON :: two pictures that came out of the same prompt and seed.");
    L.push("  NOTHING HERE UPLOADS ANYTHING, AND NOTHING HERE TOUCHES THE CONVERSATION - it is the machinery.");
    if (M) L.push("  NOW :: " + plural(M.list().length, "RECORD", "RECORDS") + " IN THE VAULT, " + plural(sightQueueIds().length, "PICTURE", "PICTURES") + " WAITING FOR HER EYES" + (U ? ", UPSCALE HERE " + (U.auto() ? "AUTOMATIC" : "BY HAND") + " AT " + U.factor() + "x (" + (U.replace() ? "THE ORIGINAL IS RETIRED" : "THE ORIGINAL IS KEPT") + ")" : "") + ".");
    if (RUNNING) L.push("  A JOB IS RUNNING RIGHT NOW :: /tools stop ENDS IT.");
    return L.join("\n");
  }

  async function vaultReport() {
    var M = window.media;
    if (!M) return "THE VAULT IS NOT LOADED HERE.";
    await M.ensure();
    var all = recs(), by = {}, folders = {}, bytes = 0;
    all.forEach(function (r) {
      var k = r.kind || "(none)";
      by[k] = (by[k] || 0) + 1;
      var f = M.folderOf(r);
      folders[f] = (folders[f] || 0) + 1;
      bytes += r.bytes || 0;
    });
    var U = window.upscaleLocal;
    var L = [];
    L.push("THE VAULT, COUNTED :: " + plural(all.length, "RECORD", "RECORDS") + " / " + fmtBytes(bytes));
    Object.keys(by).sort().forEach(function (k) { L.push("  " + String(k).toUpperCase().padEnd(10) + by[k]); });
    L.push("  FOLDERS");
    Object.keys(folders).sort().forEach(function (p) { L.push("    " + String(p).padEnd(24) + folders[p]); });
    L.push("  WAITING FOR HER EYES  " + sightQueueIds().length);
    if (U) L.push("  UPSCALE, HERE  " + (U.auto() ? "AUTOMATIC ON" : "AUTOMATIC OFF") + " / " + (U.replace() ? "THE SMALLER ORIGINAL IS RETIRED" : "THE SMALLER ORIGINAL IS KEPT") + " / " + U.factor() + "x " + U.engine());
    L.push("");
    L.push(helpText());
    return L.join("\n");
  }

  function usageText() { return "USAGE: /tools [report | stop | scan <JOB> | <JOB> [SCOPE] [run]]\n" + jobsText(); }

  /* ==========================================================================
     THE RUNS
     ========================================================================== */

  function paintReport(text) {
    var box = el("tlReport");
    if (!box) return;
    box.textContent = text || "";
  }

  function setRunning(on) {
    var scanBtn = el("tlScan"), runBtn = el("tlRun"), stopBtn = el("tlStop");
    if (scanBtn) scanBtn.disabled = !!on;
    if (runBtn) runBtn.disabled = !!on;
    if (stopBtn) stopBtn.hidden = !on;
  }

  function refreshGallery() {
    try {
      var g = el("gallery");
      if (g && !g.hidden && window.gallery && window.gallery.refresh) window.gallery.refresh(false);
    } catch (e) {}
  }

  async function scanJob(jobId, scope) {
    var job = jobById(jobId);
    if (!job) return { ok: false, text: usageText() };
    if (job.vault !== false && !window.media) return { ok: false, text: "THE VAULT IS NOT LOADED HERE." };
    if (scanning) return { ok: false, text: "A SCAN IS ALREADY RUNNING - GIVE IT A MOMENT." };
    scanning = true;
    var scanBtn = el("tlScan");
    if (scanBtn) scanBtn.disabled = true;
    progress("SCANNING " + job.title);
    // A scan has no count to give: it reads the vault and the number it would report is the number it
    // is still finding. So the bar is INDETERMINATE, under its own id, so a scan cannot take down a
    // run's bar if the two ever overlap.
    bar("SCANNING \u00b7 " + job.title, 0, "tools-scan");
    try {
      if (job.vault !== false) await window.media.ensure();
      scope = normScope(job, scope);
      var sc;
      try { sc = await job.scan(scope, 0); }
      catch (e) { return { ok: false, text: "THE SCAN FAILED :: " + ((e && e.message) ? e.message : e) }; }
      lastScan[job.id] = sc;
      lastScope[job.id] = scope;
      var text = job.text(sc);
      // A scan takes a moment (a duplicate hunt hashes the pictures), so by the
      // time it lands the panel may have been pointed at another job. Its report
      // belongs to the job it is about, not to whatever is selected now.
      var now = selectedJob();
      if (!now || now.id === job.id) paintReport(text);
      return { ok: true, scan: sc, text: text };
    } finally {
      scanning = false;
      if (scanBtn) scanBtn.disabled = false;
      progress("");
      barDone("tools-scan");
    }
  }

  // A RUN. It is based on the scan the panel (or the last `/tools <job>`) was
  // actually shown; if there is none for this job and scope, one is taken and
  // printed FIRST - a receipt is never handed over without the bill.
  async function runJob(jobId, scope, opts) {
    opts = opts || {};
    var job = jobById(jobId);
    if (!job) return { ok: false, text: usageText() };
    if (job.vault !== false && !window.media) return { ok: false, text: "THE VAULT IS NOT LOADED HERE." };
    if (RUNNING) { say("TOOLS :: A JOB IS ALREADY RUNNING - /tools stop ENDS IT FIRST."); return { ok: false, text: "ALREADY RUNNING" }; }
    if (job.vault !== false) await window.media.ensure();
    scope = normScope(job, scope);

    var sc = lastScan[job.id];
    if (!sc || lastScope[job.id] !== scope) {
      var s = await scanJob(job.id, scope);
      if (!s.ok) { say(s.text); return { ok: false, text: s.text }; }
      sc = s.scan;
      say(s.text);
      say("TOOLS :: THAT IS THE SCAN. IT IS DECIDED FROM THIS - PRESS RUN AGAIN TO DO IT.");
      return { ok: false, scanOnly: true, text: s.text, scan: sc };
    }
    if (opts.limit) sc.limit = opts.limit;

    RUNNING = true; stopped = false;
    setRunning(true);
    // The job's own title opens the bar; every apply() that knows a count re-opens the same id with
    // its own label and total just below, so this is the honest fallback for a job that never gets
    // that far (or has no count at all).
    bar(job.title, 0);
    say("TOOLS :: " + job.title + " :: RUNNING" + (job.danger ? " - THIS ONE DELETES, AND ONLY EVER A COPY WHOSE BYTES ARE STILL IDENTICAL TO THE ONE IT KEEPS." : " - NOTHING IS DELETED."));
    var res = null;
    try { res = await job.apply(sc); }
    catch (e) { res = { error: (e && e.message) ? e.message : String(e) }; }
    finally { barDone(); }
    RUNNING = false;
    setRunning(false);
    var text = job.done(sc, res || {});
    paintReport(text);
    say(text);
    refreshGallery();
    return { ok: true, result: res, text: text };
  }

  function stop() {
    if (!RUNNING) { say("TOOLS :: NOTHING IS RUNNING."); return false; }
    stopped = true;
    say("TOOLS :: STOPPING AFTER THE PICTURE IN HAND. WHAT HAS ALREADY BEEN DONE IS DONE, AND NOTHING ELSE IS TOUCHED.");
    return true;
  }

  /* ==========================================================================
     THE PANEL
     ========================================================================== */

  function selectedJob() {
    var sel = el("tlJob");
    return jobById(sel ? sel.value : "");
  }

  function currentScope() {
    var sel = el("tlScope");
    return sel ? sel.value : "";
  }

  function currentLimit() {
    var box = el("tlLimit");
    var n = box ? Math.floor(Number(box.value)) : 0;
    return (n > 0) ? n : 0;
  }

  function clearScan(jobId) {
    if (jobId) { delete lastScan[jobId]; delete lastScope[jobId]; return; }
    lastScan = {}; lastScope = {};
  }

  function syncPanel() {
    var job = selectedJob();
    var sel = el("tlScope"), limitRow = el("tlLimit");
    if (!job) return;
    if (sel) {
      sel.innerHTML = "";
      job.scopes.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id; o.textContent = s.label;
        sel.appendChild(o);
      });
      sel.hidden = !job.scopes.length;
    }
    if (limitRow) {
      limitRow.hidden = !job.limit;
      var hint = el("tlLimitHint");
      if (hint) hint.hidden = !job.limit;
      if (job.limit && !Number(limitRow.value)) limitRow.value = "0";
    }
    var what = el("tlWhat");
    if (what) what.textContent = job.what;
    var btn = el("tlRun");
    if (btn) {
      btn.textContent = job.danger ? "RUN (DELETES COPIES)" : "RUN";
      btn.title = job.danger
        ? "settle every group: keep one of each, drop the rest, moving every reference across first. Pressed twice within six seconds, and only ever a copy whose bytes are still identical to the one being kept."
        : "do the job the scan just described. Every change is printed as a SYSTEM line behind the veil.";
    }
    progress(RUNNING ? "WORKING" : (scanning ? "SCANNING" : ""));
    paintReport(lastScan[job.id] && lastScope[job.id] === currentScope() ? job.text(lastScan[job.id]) : "");
    if (!lastScan[job.id]) {
      var box = el("tlReport");
      if (box && !box.textContent.trim()) box.textContent = "PRESS SCAN :: NOTHING IS CHANGED BY A SCAN - IT READS THE VAULT AND PRINTS EXACTLY WHAT A RUN WOULD DO.";
    }
  }

  async function onScan() {
    var job = selectedJob();
    if (!job) return;
    delete lastScan[job.id]; delete lastScope[job.id];
    var s = await scanJob(job.id, currentScope());
    if (!s.ok) say(s.text);
    else say(s.text);
  }

  async function onRun() {
    var job = selectedJob();
    if (!job) return;
    if (job.danger) {
      var now = Date.now();
      var sc = lastScan[job.id];
      var fresh = sc && (now - (sc.at || 0)) < 120000;
      if (pending[job.id] && (now - pending[job.id]) < 6000 && fresh) {
        pending[job.id] = 0;
      } else {
        pending[job.id] = now;
        say("TOOLS :: " + job.title + " DELETES COPIES" + (fresh ? "" : " - AND THE SCAN IN FRONT OF YOU IS STALE OR MISSING, SO A FRESH ONE WILL BE TAKEN FIRST") + ". PRESS RUN AGAIN WITHIN SIX SECONDS AND IT GOES AHEAD: ONE COPY OF EACH GROUP IS KEPT, EVERY REFERENCE IS MOVED ACROSS FIRST, AND THE BYTES ARE RE-CHECKED AT THE MOMENT OF DELETION." + (fresh ? "" : " AN ARM OLDER THAN TWO MINUTES NEVER FIRES - IT RE-ARMS INSTEAD."));
        if (!fresh) await scanJob(job.id, currentScope());
        return;
      }
    }
    // The button asks twice rather than guessing: with no scan for this job and
    // scope, the first press takes one and prints it, and the next press goes.
    var res = await runJob(job.id, currentScope(), { limit: currentLimit() });
    if (res && res.scanOnly) await runJob(job.id, currentScope(), { limit: currentLimit() });
  }

  function isOpen() { var p = el("toolsPanel"); return !!(p && !p.hidden); }

  function fit() {
    var p = el("toolsPanel"), deck = el("command-deck");
    if (!p || p.hidden || !deck) return;
    var room = Math.round(deck.getBoundingClientRect().top - 12);
    p.style.maxHeight = Math.max(200, room) + "px";
    // The panel itself does not scroll: it is a column whose middle (the report)
    // takes the room that is left, so the buttons at its foot are always on screen.
  }

  function open() {
    var p = el("toolsPanel");
    if (!p) return;
    // one deck panel at a time
    if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close();
    if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close();
    if (typeof closeForge === "function" && el("createPanel") && !el("createPanel").hidden) closeForge();
    p.hidden = false;
    syncPanel();
    fit();
    if (typeof syncDeckSpace === "function") syncDeckSpace();
    say(helpText());
  }

  function close() {
    var p = el("toolsPanel");
    if (p) p.hidden = true;
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function toggle() { if (isOpen()) close(); else open(); }

  function wire() {
    var jobSel = el("tlJob");
    if (jobSel && !jobSel.dataset.built) {
      jobSel.dataset.built = "1";
      JOBS.forEach(function (j) {
        var o = document.createElement("option");
        o.value = j.id; o.textContent = j.title;
        jobSel.appendChild(o);
      });
      jobSel.addEventListener("change", syncPanel);
    }
    var scopeSel = el("tlScope");
    if (scopeSel && !scopeSel.dataset.built) { scopeSel.dataset.built = "1"; scopeSel.addEventListener("change", syncPanel); }
    var scanBtn = el("tlScan");
    if (scanBtn && !scanBtn.dataset.built) { scanBtn.dataset.built = "1"; scanBtn.addEventListener("click", onScan); }
    var runBtn = el("tlRun");
    if (runBtn && !runBtn.dataset.built) { runBtn.dataset.built = "1"; runBtn.addEventListener("click", onRun); }
    var stopBtn = el("tlStop");
    if (stopBtn && !stopBtn.dataset.built) { stopBtn.dataset.built = "1"; stopBtn.addEventListener("click", function () { stop(); }); }
    var closeBtn = el("tlClose");
    if (closeBtn && !closeBtn.dataset.built) { closeBtn.dataset.built = "1"; closeBtn.addEventListener("click", close); }
    if (el("toolsPanel")) setRunning(false);
    syncPanel();
  }

  window.tools = {
    toggle: toggle,
    open: open,
    close: close,
    isOpen: isOpen,
    jobs: function () {
      return JOBS.map(function (j) {
        return { id: j.id, title: j.title, what: j.what, danger: !!j.danger, limit: !!j.limit,
          scopes: j.scopes.map(function (s) { return { id: s.id, label: s.label }; }) };
      });
    },
    job: jobById,
    help: helpText,
    usage: usageText,
    report: vaultReport,
    scan: function (jobId, scope) { return scanJob(jobId, scope); },
    run: function (jobId, scope, opts) { return runJob(jobId, scope, opts); },
    stop: stop,
    busy: function () { return RUNNING; },
    clearScan: clearScan,
    // What the classifier knows: the vocabulary in use right now, and the prompt the next picture
    // would be read with. Read-only, and here so the pass can be inspected without running it.
    buckets: bucketCounts,
    classifyPrompt: classifyPrompt
  };

  // The panel's own wiring runs as soon as this file does - the deck is already
  // in the document by then, and the buttons are cheap to attach.
  wire();
})();
