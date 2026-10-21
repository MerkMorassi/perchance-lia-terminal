/* ------------------------------------------------------------------
   THE BACKUP — the generator's own source, out of the running page.

   Patrikios, 2026-09-21: "Double check the save functionality... I am
   having trouble saving the work we have done. If the main UI fails,
   create a backup button in the UI we are creating so that I can
   download the code."

   WHY THIS EXISTS. The editor you build in and the generator on the
   public page are not the same thing. This terminal loads twenty-odd
   scripts out of src/, and a src/ file only exists on the server once
   the generator has been SAVED. While you are editing, the page serves
   every unsaved file locally - so the terminal looks whole on the
   machine you are building on and is empty or half-dead everywhere
   else (a phone, a tablet, the public URL), because the files that
   never reached the server answer 404 and the modules they define
   never appear. There is no error worth reading, just a terminal that
   does not start.

   This module is the way out of that: one button, one zip, built from
   the page itself, no upload and no server. And because a partial save
   is otherwise invisible, `status()` says plainly which files are on
   the server and which are not - that answer is the same one the
   tablet needs.

       /backup              build the zip and download it, with a report
       /backup status       what is on the server and what is not
       /backup diag         what this device can and cannot do
       /backup help         this text
       /backup autosave on  keep a snapshot of every CLEAN build on this device while the source is
       /backup kept            not all on the server yet (never uploaded); kept shows the newest
       /backup pull         download the newest kept snapshot

   WHAT GOES IN THE ZIP
       main.pjs         from src/pack/main.pjs.txt   (a generated copy)
       index.html       from src/pack/index.html.txt (a generated copy)
       src/<file>       every file, fetched live - the CURRENT tree
       _server-saved/   the last SAVED root files, only if they differ
       PACK-INFO.txt    this explanation, the saved state, the diagnostics

   THE GENERATED COPIES. The page cannot read the workspace's own root
   files (a fetched /index.html is not routed to the generator, and the
   served page carries the last SAVED copy, not the current one), so
   src/pack/*.txt hold byte-for-byte copies of them, refreshed whenever
   those two files change. `staleCheck()` compares the list of scripts
   the packed copy asks for against the scripts this page actually
   loaded, and says so out loud if they disagree - so a copy that was
   forgotten cannot pass silently.

   NOTHING HERE PUTS ANYTHING ON THE SERVER, AND NOTHING HERE SAVES THE
   GENERATOR: it reads the vault of source files, builds a zip in memory
   and hands it to the browser's own download. With the AUTOSAVE armed it
   also KEEPS the newest snapshot in this device's own kv (IndexedDB), so a
   clean build whose files are not on the server yet survives the tab -
   that copy never leaves the device either, and a SAVE is still the only
   thing that puts the work where other people can load it.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var PACK_DIR = "src/pack/";
  var LIST_FILE = PACK_DIR + "files.json";
  var ROOT_COPIES = { "main.pjs": PACK_DIR + "main.pjs.txt", "index.html": PACK_DIR + "index.html.txt" };
  var MAX_BYTES = 80 * 1024 * 1024;   // the whole tree is ~1.5 MB; this only guards a runaway

  function el(id) { return document.getElementById(id); }
  function enc(s) { return new TextEncoder().encode(String(s)); }

  // ---------------------------------------------------------------- the page's own idea of itself

  // The served page carries what the SERVER holds (the generator as last SAVED): the src
  // manifest, the model text (main.pjs) and the output template (index.html). That is the
  // only trustworthy statement about the server available from inside the page, and it is
  // exactly what "is my work saved?" needs to be answered against.
  function serverCopy() {
    var node = el("preloaded-generator-data");
    if (!node) return null;
    try { return JSON.parse(node.textContent || node.innerHTML || "{}"); } catch (e) { return null; }
  }

  function savedManifest() {
    var s = serverCopy();
    return (s && s.srcManifest && typeof s.srcManifest === "object") ? s.srcManifest : null;
  }

  // The paths the page's OWN markup asks for - the one list that cannot go stale, because it
  // is read out of the live DOM. It catches a file added to index.html but not yet listed.
  function domPaths() {
    var out = [], seen = {};
    var nodes = document.querySelectorAll("script[src], link[href], img[src], a[href]");
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].getAttribute("src") || nodes[i].getAttribute("href") || "";
      var at = v.indexOf("/src/");
      if (at === -1 && v.indexOf("src/") !== 0) continue;
      var path = (at !== -1) ? v.slice(at + 5) : v.slice(4);
      path = path.split("?")[0].split("#")[0].replace(/^\/+/, "");
      if (!path || seen[path]) continue;
      seen[path] = 1;
      out.push(path);
    }
    return out;
  }

  // The generated list (every source file the workspace holds) plus anything the markup asks
  // for that the list has not caught up with.
  async function expectedFiles() {
    var listed = [];
    try {
      var res = await fetch(LIST_FILE, { cache: "no-store" });
      if (res.ok) {
        var json = JSON.parse(await res.text());
        if (json && json.files && json.files.length) listed = json.files.slice();
      }
    } catch (e) { /* the DOM list below still works without it */ }
    var out = listed.slice(), seen = {};
    for (var i = 0; i < out.length; i++) seen[out[i]] = 1;
    domPaths().forEach(function (p) { if (!seen[p]) { seen[p] = 1; out.push(p); } });
    return out;
  }

  // ---------------------------------------------------------------- the zip (stored, no deps)

  var CRC_TABLE = (function () {
    var t = new Int32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  }

  function dosStamp(d) {
    return {
      time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF,
      date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF
    };
  }

  // A stored (uncompressed) zip: local headers, then the central directory, then the end
  // record. Source files are already small and already on disk as text, so compression would
  // buy little and would mean carrying a deflate implementation in here.
  function zip(files, when) {
    var t = dosStamp(when || new Date());
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc(f.path);
      var data = f.bytes;
      var crc = crc32(data);

      var lh = new Uint8Array(30 + name.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);          // version needed
      lv.setUint16(6, 0x0800, true);      // names are UTF-8
      lv.setUint16(8, 0, true);           // stored
      lv.setUint16(10, t.time, true);
      lv.setUint16(12, t.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      lh.set(name, 30);
      parts.push(lh, data);

      var ch = new Uint8Array(46 + name.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);          // version made by
      cv.setUint16(6, 20, true);          // version needed
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, t.time, true);
      cv.setUint16(14, t.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);     // where this entry's local header starts
      ch.set(name, 46);
      central.push(ch);

      offset += lh.length + data.length;
    });
    var cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    var all = parts.concat(central, [eocd]);
    var total = 0;
    all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  // ---------------------------------------------------------------- gathering

  async function fetchBytes(path) {
    var res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + (res.statusText ? " " + res.statusText : ""));
    return new Uint8Array(await res.arrayBuffer());
  }

  // Every part of the zip, in memory, current. `onStep(path, i, total)` is optional.
  async function collect(onStep) {
    var list = await expectedFiles();
    var out = { files: [], errors: [], list: list, rootFailures: [] };

    for (var name in ROOT_COPIES) {
      if (!Object.prototype.hasOwnProperty.call(ROOT_COPIES, name)) continue;
      try { out.files.push({ path: name, bytes: await fetchBytes(ROOT_COPIES[name]) }); }
      catch (e) { out.rootFailures.push(name + " (" + e.message + ")"); }
    }

    for (var i = 0; i < list.length; i++) {
      if (onStep) onStep(list[i], i + 1, list.length);
      // The manifest carries workspace paths ("src/x"); the fetch and the zip ride below src/, so
      // the prefix comes off once here - fetching it twice ("src/src/x") 404s every listed file
      // while the DOM-discovered scripts (bare paths) sail through, which is exactly the partial
      // zip that failure makes. Bare root names ("index.html") still 404 here by design: they are
      // covered by ROOT_COPIES above, and their error line says which copy failed instead.
      var lp = String(list[i]).replace(/^src\//, "");
      try { out.files.push({ path: "src/" + lp, bytes: await fetchBytes("src/" + lp) }); }
      catch (e) { out.errors.push(list[i] + " :: " + e.message); }
    }

    // The last SAVED root files, kept alongside when they differ from the copies above:
    // if a copy ever went stale, the server's own text is still in the zip.
    var s = serverCopy();
    if (s) {
      try {
        var want = { "main.pjs": s.modelText, "index.html": s.outputTemplate };
        var have = {};
        out.files.forEach(function (f) { if (f.path === "main.pjs" || f.path === "index.html") have[f.path] = f.bytes; });
        for (var r in want) {
          if (!Object.prototype.hasOwnProperty.call(want, r)) continue;
          if (typeof want[r] !== "string" || !want[r].length) continue;
          var hb = have[r], same = false;
          if (hb) {
            var hText = new TextDecoder("utf-8").decode(hb);
            same = (hText === want[r]);
          }
          if (!same) out.files.push({ path: "_server-saved/" + r, bytes: enc(want[r]) });
        }
      } catch (e) { /* a missing server copy is not a failure */ }
    }
    return out;
  }

  function totalBytes(files) {
    var n = 0;
    files.forEach(function (f) { n += f.bytes.length; });
    return n;
  }

  // ---------------------------------------------------------------- what the server holds

  async function status() {
    var list = await expectedFiles();
    var man = savedManifest();
    if (!man) {
      return { known: false, list: list, onServer: 0, missing: list.slice(),
        text: "THE SERVER COPY OF THIS GENERATOR COULD NOT BE READ FROM THIS PAGE, SO THE SAVE STATE IS UNKNOWN." };
    }
    // Both sides in one shape: the manifest carries workspace paths ("src/x") and the server's
    // manifest carries them bare ("x") - comparing the two raw says every listed file is missing
    // while every loaded script matches, which is the same double-prefix failure as the zip's.
    var rel = [];
    var relSeen = {};
    list.forEach(function (p) {
      var q = String(p).replace(/^src\//, "");
      if (relSeen[q]) return;   // the manifest and the DOM name one file two ways ("src/js/x", "js/x")
      relSeen[q] = true;
      rel.push({ q: q, orig: p });
    });
    var manKeys = {};
    Object.keys(man).forEach(function (k) { manKeys[String(k).replace(/^src\//, "")] = 1; });
    // Bare root names ("index.html") never live in the src manifest - the served page carries them
    // (see serverCopy, and the _server-saved diff in the zip) - so only pathed files count here.
    var missing = [];
    rel.forEach(function (e) { if (e.q.indexOf("/") !== -1 && !manKeys[e.q]) missing.push(e.orig); });
    var stuck = Object.keys(man).filter(function (k) { return !relSeen[String(k).replace(/^src\//, "")]; });
    var counted = rel.filter(function (e) { return e.q.indexOf("/") !== -1; });
    var text = "SAVE STATE :: " + (counted.length - missing.length) + " OF " + counted.length + " SOURCE FILES ARE ON THE SERVER";
    if (!missing.length) text += " - EVERYTHING HERE IS SAVED.";
    else {
      text += "\nNOT ON THE SERVER YET (" + missing.length + ") :: " + missing.join(", ");
      text += "\nANY DEVICE THAT IS NOT THIS EDITOR - A PHONE, A TABLET, THE PUBLIC PAGE - CANNOT RUN THIS GENERATOR UNTIL THEY LAND: THE SERVER ANSWERS 404 FOR THEM AND THE TERMINAL DOES NOT START."
        + "\nTHAT IS A SAVE, NOT A BACKUP. THE EDITOR'S SAVE BUTTON UPLOADS THEM; TYPE /backup TO TAKE A COMPLETE COPY FIRST, THEN SAVE AND RELOAD AND CHECK THIS AGAIN.";
    }
    if (stuck.length) text += "\nON THE SERVER BUT NOT HERE (" + stuck.length + ") :: " + stuck.join(", ");
    return { known: true, list: list, onServer: counted.length - missing.length, missing: missing, extra: stuck, text: text };
  }

  // ---------------------------------------------------------------- what this device can do

  // WHICH MODULES THE PAGE SHOULD HAVE. The list lives in ONE place: the startup watch at the top
  // of index.html, which pairs every src/js file with the global it exports and runs before all of
  // them. It publishes that list as window.__bootModules, and this reads it. A second copy used to
  // live here and had quietly lost its last ten entries - so /backup diag could not see tools,
  // minibox, audition, keepsake, archivax, story, decks, chat, sync or draft go missing, which are
  // exactly the files a bad load loses. The copy below is only for a page where the watch itself
  // did not run, and it is the same list.
  var WANT_FALLBACK = [
    ["logTime", "src/js/logtime.js"], ["studio", "src/js/studio.js"], ["lore", "src/js/lore.js"],
    ["embed", "src/js/embed.js"], ["hers", "src/js/hers.js"], ["media", "src/js/vault.js"],
    ["packs", "src/js/packs.js"], ["mythos", "src/js/mythos.js"], ["roles", "src/js/roles.js"],
    ["instr", "src/js/instr.js"], ["keyring", "src/js/keys.js"], ["pics", "src/js/images.js"],
    ["upscale", "src/js/upscale.js"], ["batch", "src/js/batch.js"], ["upscaleLocal", "src/js/upscale-local.js"],
    ["attach", "src/js/attach.js"], ["gallery", "src/js/gallery.js"],
    ["renderBook", "src/js/renderbook.js"], ["reader", "src/js/reader.js"], ["likes", "src/js/likes.js"], ["voice", "src/js/voice.js"],
    ["idea", "src/js/idea.js"], ["forgeBook", "src/js/forge.js"], ["cmd", "src/js/commands.js"], ["logEdit", "src/js/editlog.js"],
    ["checkIn", "src/js/initiative.js"], ["loreSay", "src/js/main.js"], ["backup", "src/js/backup.js"],
    ["tools", "src/js/tools.js"], ["miniBox", "src/js/minibox.js"], ["audition", "src/js/audition.js"],
    ["keepsake", "src/js/keepsake.js"], ["archivax", "src/js/archivax.js"], ["story", "src/js/story.js"],
    ["decks", "src/js/decks.js"], ["send", "src/js/chat.js"], ["sync", "src/js/sync.js"], ["draft", "src/js/draft.js"],
    ["rtfm", "src/js/rtfm.js"], ["rtfmEditor", "src/js/rtfm-edit.js"], ["chronicle", "src/js/chronicle.js"], ["cloudSync", "src/js/sync-cloud.js"],
    ["petition", "src/js/petition.js"], ["shift", "src/js/shift.js"], ["chatlog", "src/js/chatlog.js"]
  ];

  function moduleCheck() {
    var want = (window.__bootModules && window.__bootModules.length) ? window.__bootModules : WANT_FALLBACK;
    var missing = [];
    want.forEach(function (w) {
      var v = null;
      try { v = window[w[0]]; } catch (e) { v = null; }
      if (!v) missing.push(w[1]);
    });
    return missing;
  }

  function diag() {
    var out = [];
    var ua = navigator.userAgent || "";
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
    out.push("DEVICE :: " + (ios ? ("iPhone/iPad, iOS " + (m ? m[1] + "." + m[2] : "version unknown")) : "not iOS")
      + "  \u00b7  " + window.innerWidth + "x" + window.innerHeight + " @dpr " + (window.devicePixelRatio || 1));
    out.push("BROWSER :: " + ua);

    var sw = "serviceWorker" in navigator;
    out.push("SERVICE WORKER :: " + (!sw ? "NOT SUPPORTED (a src/ file cannot be served - the terminal cannot start)"
      : (navigator.serviceWorker.controller ? "supported, controlling this page" : "supported, NOT controlling this page yet (a src/ file will 404 on this load - RELOAD once)")));
    out.push("ADDRESS :: " + location.host + "  \u00b7  in an iframe: " + (window.top !== window.self ? "yes" : "no")
      + "  \u00b7  secure context: " + (window.isSecureContext ? "yes" : "no"));

    var missing = moduleCheck();
    out.push("MODULES :: " + (missing.length ? (missing.length + " DID NOT LOAD :: " + missing.join(", ")) : "all present"));

    var kv = false;
    try { kv = !!(window.root && window.root.kv); } catch (e) { kv = false; }
    out.push("STORAGE (the vault, the archive, kv) :: " + (kv ? "available" : "MISSING - nothing can be kept on this device"));
    out.push("DOWNLOAD A FILE :: " + ("download" in document.createElement("a") ? "supported" : "NOT SUPPORTED (the zip cannot be offered here - use a desktop browser)"));
    out.push("MICROPHONE :: " + ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? "available" : "NOT AVAILABLE"));
    var policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && policy.allowsFeature) {
      try { out.push("MICROPHONE IN THIS FRAME (permissions policy) :: " + (policy.allowsFeature("microphone") ? "allowed" : "BLOCKED BY THE EMBEDDING PAGE")); } catch (e) {}
    }
    out.push("SPEECH RECOGNITION (TALK / LISTEN) :: " + (window.SpeechRecognition || window.webkitSpeechRecognition ? "available" : "NOT AVAILABLE - typing still works"));
    out.push("VOICE OUTPUT :: " + (window.speechSynthesis ? "available" : "NOT AVAILABLE"));
    out.push("GZIP READER (MYTHOS PACKS) :: " + (typeof DecompressionStream === "undefined" ? "NOT AVAILABLE (a .jsonl pack still imports; a .gz one does not)" : "available"));

    var issues = window.__bootIssues;
    if (issues && issues.length) {
      out.push("FAULTS SEEN AT STARTUP (" + issues.length + ") ::");
      issues.slice(0, 12).forEach(function (s) { out.push("    " + s); });
    }
    var healed = window.__bootHealed;
    if (healed && healed.length) {
      out.push("SOURCE FILES THAT DID NOT ARRIVE ON THIS LOAD AND WERE ASKED FOR AGAIN (" + healed.length + ") ::");
      healed.slice(0, 12).forEach(function (s) { out.push("    " + s); });
    }
    return out;
  }

  // ---------------------------------------------------------------- the generated copies, checked

  // The packed index.html is a copy of the workspace's own; the scripts it asks for are a
  // fingerprint of it. If the page loaded a script the copy does not name (or the other way
  // round) the copy is out of date, and the backup should say so rather than pretend.
  async function staleCheck() {
    try {
      var text = new TextDecoder("utf-8").decode(await fetchBytes(ROOT_COPIES["index.html"]));      var packed = [], re = /<script[^>]+src=["']([^"']+)["']/gi, mm;
      while ((mm = re.exec(text)) !== null) {
        var at = mm[1].indexOf("/src/");
        if (at !== -1) packed.push(mm[1].slice(at + 5));
        else if (mm[1].indexOf("src/") === 0) packed.push(mm[1].slice(4));
      }
      packed = packed.filter(function (p, i, a) { return a.indexOf(p) === i; });
      var live = [].slice.call(document.querySelectorAll("script[src]")).map(function (s) {
        var v = s.getAttribute("src") || "", at2 = v.indexOf("/src/");
        return at2 !== -1 ? v.slice(at2 + 5) : (v.indexOf("src/") === 0 ? v.slice(4) : "");
      }).filter(Boolean).filter(function (p, i, a) { return a.indexOf(p) === i; });
      var onlyLive = live.filter(function (p) { return packed.indexOf(p) === -1; });
      var onlyPacked = packed.filter(function (p) { return live.indexOf(p) === -1; });
      // A script the page loaded but the copy does not name is only a staleness if the FILE is
      // not in the zip either: lanes inject their own chips at runtime (duet.js loads the
      // intercom chip that way), and those files ride along via files.json, not the copy.
      var listed = [];
      try {
        var lr = await fetch(LIST_FILE, { cache: "no-store" });
        if (lr.ok) { var lj = JSON.parse(await lr.text()); if (lj && lj.files) listed = lj.files; }
      } catch (e) { listed = []; }
      var listedRel = listed.map(function (p) { return String(p).replace(/^src\//, ""); });
      onlyLive = onlyLive.filter(function (p) { return listedRel.indexOf(p) === -1; });
      if (!onlyLive.length && !onlyPacked.length) return null;
      return "THE PACKED COPY OF index.html IS OUT OF DATE - THIS PAGE LOADS " + live.length
        + " SCRIPTS AND THE COPY NAMES " + packed.length
        + (onlyLive.length ? " (missing from the copy: " + onlyLive.join(", ") + ")" : "")
        + (onlyPacked.length ? " (in the copy but not on the page: " + onlyPacked.join(", ") + ")" : "")
        + ". TELL YOUR AGENT TO REFRESH src/pack/ BEFORE TRUSTING THE ZIP'S index.html.";
    } catch (e) { return null; }
  }

  function when() {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(Date.now()); } catch (e) {}
    return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }

  function fileName() {
    var d = new Date(), n2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return "lia-terminal-source-" + d.getFullYear() + n2(d.getMonth() + 1) + n2(d.getDate())
      + "-" + n2(d.getHours()) + n2(d.getMinutes()) + n2(d.getSeconds()) + ".zip";
  }

  function notes(state, extra, files) {
    var L = [];
    L.push("LIA TERMINAL - SOURCE BACKUP");
    L.push("Generated from inside the running terminal on " + when() + ".");
    L.push("");
    L.push("WHAT THIS IS");
    L.push("  A complete, current copy of the generator's source: main.pjs, index.html and every file");
    L.push("  under src/. Nothing here was uploaded anywhere - it was read out of the page and zipped");
    L.push("  on the device, and it is only as private as the device itself.");
    L.push("");
    L.push("WHERE EACH PART CAME FROM");
    L.push("  main.pjs, index.html  ... src/pack/*.txt, generated copies of the workspace's root files");
    L.push("  src/**                ... fetched live from the page, so it is the CURRENT tree,");
    L.push("                            including files the server has not been given yet");
    if (files.some(function (f) { return f.path.indexOf("_server-saved/") === 0; })) {
      L.push("  _server-saved/**      ... the last SAVED root files, kept because they differ from the");
      L.push("                            copies above (one of the two is newer; the dates inside tell you");
      L.push("                            which, and the copies above are the ones the terminal is running)");
    }
    L.push("");
    L.push("RESTORING IT");
    L.push("  In a perchance generator editor: paste main.pjs and index.html into the code and HTML");
    L.push("  panels, recreate every file under src/ path for path (the paths are the storage contract -");
    L.push("  do not rename them), then SAVE. Or hand this zip to an AI agent working in that editor's");
    L.push("  workspace and ask it to write every file back from the zip.");
    L.push("");
    if (state) { L.push("THE SAVE STATE AT THE MOMENT OF THIS BACKUP"); L.push("  " + state.text.split("\n").join("\n  ")); L.push(""); }
    L.push("THIS DEVICE, AT THE MOMENT OF THIS BACKUP");
    diag().forEach(function (l) { L.push("  " + l); });
    if (extra && extra.length) {
      L.push("");
      L.push("FILES THAT COULD NOT BE READ (they are missing from this zip)");
      extra.forEach(function (l) { L.push("  " + l); });
    }
    L.push("");
    L.push("FILES IN THIS ZIP (" + files.length + ")");
    files.forEach(function (f) { L.push("  " + f.path + "  (" + f.bytes.length + ")"); });
    L.push("");
    return L.join("\n");
  }

  // ---------------------------------------------------------------- the two things you can do

  // Everything the zip needs, in memory, with no download: the same work `download()` does.
  async function build(onStep) {
    var started = Date.now();
    var got = await collect(onStep);
    var state = await status();
    var stale = await staleCheck();
    var extra = got.errors.slice();
    if (got.rootFailures.length) extra = got.rootFailures.concat(extra);

    var text = notes(state, extra, got.files);
    if (stale) text = "!! " + stale + "\n\n" + text;
    got.files.push({ path: "PACK-INFO.txt", bytes: enc(text) });

    var bytes = zip(got.files, new Date());
    if (bytes.length > MAX_BYTES) throw new Error("the zip is larger than this module will hand over (" + bytes.length + " bytes)");
    return { name: fileName(), bytes: bytes, size: bytes.length, files: got.files.length,
      errors: got.errors, rootFailures: got.rootFailures, state: state, stale: stale,
      ms: Date.now() - started };
  }

  // Build it and hand it to the browser's own download. This is what the button and /backup do.
  // THE BAR (src/js/progress.js) is opened HERE rather than in build(), so the AUTOSAVE's own silent
  // build at boot stays silent: a bar that appears by itself before he has asked for anything would
  // be the one place this terminal answered a question nobody asked. A backup he pressed counts
  // itself off `collect`'s own onStep - one file at a time, the number of files actually in hand.
  async function download(onStep) {
    var P = null;
    try {
      if (window.progress) P = window.progress.begin("PACKING THE BACKUP", { id: "backup", priority: 1, detail: "every file under src/ and both root files, read from this page now - nothing is uploaded" });
    } catch (e) {}
    var step = function (path, i, total) {
      if (P) P.set(i, total);
      if (onStep) onStep(path, i, total);
    };
    try {
      var out = await build(step);
      var blob = new Blob([out.bytes], { type: "application/zip" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = out.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      try { a.click(); } catch (e) {}
      window.setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 6000);
      if (P) { try { P.finish(); } catch (e) {} }
      return { name: out.name, bytes: out.size, files: out.files, errors: out.errors,
        rootFailures: out.rootFailures, state: out.state, stale: out.stale, ms: out.ms };
    } catch (e) {
      if (P) { try { P.fail((e && e.message) ? e.message : "THE BACKUP FAILED"); } catch (e2) {} }
      throw e;
    }
  }

  function statusText(state, stale) {
    var L = [state ? state.text : "SAVE STATE UNKNOWN."];
    if (stale) L.push("!! " + stale);
    L.push("A BACKUP IS NOT A SAVE: /backup WRITES A ZIP TO THIS DEVICE, IT DOES NOT PUT ANYTHING ON THE SERVER.");
    return L.join("\n");
  }

  async function report() { return statusText(await status(), await staleCheck()); }
  async function reportDiag() { return diag().join("\n"); }

  // Called once at boot: if the server does not hold every file the terminal loads, say so -
  // quietly, once, in the place he already reads - because that is the difference between a
  // generator that runs everywhere and one that only runs on the machine that built it.
  async function announce() {
    var s = await status();
    if (!s.known || !s.missing.length) return null;
    return "SOURCE NOT ON THE SERVER :: " + s.missing.length + " OF " + s.list.length + " FILES HAVE NEVER BEEN SAVED"
      + " - ANY OTHER DEVICE (A PHONE, A TABLET, THE PUBLIC PAGE) WILL FAIL TO START UNTIL THEY ARE."
      + "\nTYPE /backup TO DOWNLOAD A COMPLETE COPY OF THE SOURCE, THEN USE THE EDITOR'S SAVE BUTTON.";
  }

  // ---------------------------------------------------------------- AUTOSAVE (this device, not the server)

  /* AUTOSAVE.
     Patrikios, 2026-09-21: "Autosave after every clean build please. I'm afraid to leave this page to
     get the main save to fire on F5 refresh."

     He is right to be wary, and the honest half of this is: a SAVE is the ONLY thing that puts the work
     on the server, and nothing running in the preview frame can press it (the editor is on another
     origin and exposes no save hook - checked: no saveGenerator/save/editorSave on the preview window).
     What CAN be done from in here is INSURANCE, and it is done automatically: when the terminal comes up
     with a COHERENT build - the packed copy of index.html naming exactly the scripts the page actually
     loaded, and every file readable - and the source is NOT all on the server yet, the whole tree is
     zipped and kept ON THIS DEVICE. So the newest good build is always one command away (/backup pull, or
     /backup kept to see it), and can be attached to an agent to be written back file for file. What the
     module audit and the startup faults said at that moment is written INTO the snapshot, not used to
     veto it: a page that loaded one file badly is still a clean tree, and insurance that refuses to run
     when the page hiccups is not insurance.

     It is OFF by default - a snapshot is fifty-odd file reads and a megabyte of IndexedDB, which is free
     on his machine and rude on a stranger's - armed with /backup autosave on, and it NEVER uploads
     anything and never touches the server. It replaces its own previous snapshot: what matters is the
     current tree, not a pile of near-copies. */
  var AS_KEY = "backup";          // lia_settings / backup     : { auto, at, name, files, bytes, missing }
  var AS_ZIP = "backup_zip";      // lia_settings / backup_zip : the newest snapshot, as a Blob
  var AS_GAP_MS = 20000;          // two reloads in a row do not need two snapshots
  var asBusy = null;

  function asKv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }

  async function asState() {
    var k = asKv();
    if (!k) return { auto: false };
    try { var s = await k.get(AS_KEY); return (s && typeof s === "object") ? s : { auto: false }; }
    catch (e) { return { auto: false }; }
  }
  async function asSave(state) {
    var k = asKv(); if (!k) return false;
    try { await k.set(AS_KEY, state); return true; }
    catch (e) { console.warn("autosave settings not saved", e); return false; }
  }

  // WHAT "CLEAN" MEANS HERE, and it is checkable rather than felt:
  //   - the PACKED copy of index.html names exactly the scripts this page actually loaded, so the copy
  //     at the heart of the zip is coherent with the tree beside it; and
  //   - every file the zip needs can be read.
  // The module audit and the startup faults are RECORDED WITH the snapshot rather than used to veto it.
  // Reason: measured 2026-09-21 - on one of a rapid run of reloads the platform failed to deliver
  // src/js/vault.js, so `window.media` was absent for that load and the audit named it, while the FILE
  // was perfectly readable and the tree was untouched. Insurance that refuses to run when the page
  // hiccups is not insurance; a snapshot of a clean TREE with "one module flaked at load" written on it
  // is honest and useful.
  async function buildState() {
    var missing = moduleCheck();
    var issues = (window.__bootIssues || []).length;
    var stale = null;
    try { stale = await staleCheck(); } catch (e) { stale = null; }
    return { clean: !stale, stale: stale, missing: missing, issues: issues };
  }

  async function snapshot(why) {
    if (asBusy) return asBusy;
    var run = (async function () {
      var st = await asState();
      var bs = await buildState();
      var out = await build();
      var k = asKv();
      if (k) {
        try { await k.set(AS_ZIP, new Blob([out.bytes], { type: "application/zip" })); }
        catch (e) { console.warn("the snapshot could not be kept on this device", e); }
      }
      var server = out.state || {};
      var rec = {
        auto: st.auto !== false, at: Date.now(), name: out.name, files: out.files, bytes: out.size,
        ms: out.ms, missing: (server.missing || []).length, of: (server.list || []).length,
        stale: !!bs.stale, modulesMissing: (bs.missing || []).length, issues: bs.issues || 0,
        why: String(why || "")
      };
      await asSave(rec);
      return rec;
    })();
    asBusy = run;
    try { return await run; } finally { asBusy = null; }
  }

  function asAge(at) {
    var s = Math.max(0, Math.round((Date.now() - (at || 0)) / 1000));
    if (s < 90) return s + "s AGO";
    if (s < 5400) return Math.round(s / 60) + " MIN AGO";
    return Math.round(s / 3600) + " H AGO";
  }

  // Called once at boot, right after the save-state note. Silent unless it actually kept something.
  async function autosaveBoot() {
    var st = await asState();
    if (!st.auto) return null;
    var bs = await buildState();
    if (!bs.clean) return null;      // the packed copy is out of date: the zip's index.html would not match the tree
    try {
      var server = await status();
      // Nothing at risk: when the server holds every file the page loads, the snapshot would be a copy of
      // something already safe. This is also what keeps the autosave from costing a visitor anything.
      if (server.known && !server.missing.length) return null;
    } catch (e) { }
    if (Date.now() - (st.at || 0) < AS_GAP_MS) return null;
    var rec = await snapshot("boot");
    return "AUTOSAVE :: THIS BUILD IS CLEAN, AND THE SOURCE IS NOT ALL ON THE SERVER YET - SO THE WHOLE TREE WAS KEPT ON THIS DEVICE :: " + rec.files + " FILES / " + Math.round(rec.bytes / 1024) + " KB AT " + when() + "."
      + (rec.modulesMissing || rec.issues ? "\n  (AND AT THAT MOMENT " + rec.modulesMissing + " MODULE" + (rec.modulesMissing === 1 ? "" : "S") + " AND " + rec.issues + " STARTUP FAULT" + (rec.issues === 1 ? "" : "S") + " WERE RECORDED - THE FILE HOLDS THE TREE, WHICH IS UNTOUCHED BY A PAGE THAT LOADED BADLY.)" : "")
      + "\n  /backup pull DOWNLOADS IT \u00b7 /backup kept SHOWS IT \u00b7 /backup autosave off TURNS THIS OFF. THE EDITOR'S SAVE BUTTON IS STILL THE ONLY THING THAT PUTS THE WORK ON THE SERVER.";
  }

  async function keptInfo() {
    var st = await asState();
    if (!st.at) return null;
    var has = false;
    try { has = !!(await asKv().get(AS_ZIP)); } catch (e) { }
    return { at: st.at, name: st.name || "", files: st.files || 0, bytes: st.bytes || 0, missing: st.missing || 0, of: st.of || 0, stale: !!st.stale, auto: !!st.auto, blobKept: has, modulesMissing: st.modulesMissing || 0, issues: st.issues || 0, why: st.why || "" };
  }

  async function pullSnapshot() {
    var st = await asState();
    if (!st.at) throw new Error("NO SNAPSHOT HAS BEEN KEPT YET - /backup autosave on, OR /backup autosave now, TAKES ONE.");
    var blob = null;
    try { blob = await asKv().get(AS_ZIP); } catch (e) { blob = null; }
    if (!blob || typeof blob.size !== "number") throw new Error("THE SNAPSHOT'S OWN RECORD IS HERE BUT ITS BYTES ARE GONE (the browser may have cleared this site's storage) - /backup autosave now TAKES A FRESH ONE.");
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = st.name || fileName(); a.rel = "noopener";
    document.body.appendChild(a);
    try { a.click(); } catch (e) { }
    window.setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) { } }, 6000);
    return { name: a.download, bytes: blob.size, at: st.at };
  }

  // `/backup autosave [on|off|now|status]` - one function, because the whole thing is one idea.
  async function autosaveCmd(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    var st = await asState();
    if (a === "on" || a === "off") {
      var want = (a === "on");
      st.auto = want;
      await asSave(st);
      if (!want) return "AUTOSAVE IS OFF :: NO SNAPSHOT WILL BE TAKEN ON A CLEAN BUILD. /backup autosave on PUTS IT BACK (nothing already kept is thrown away).";
      var bs = await buildState();
      var rec = null, err = "";
      if (bs.clean) { try { rec = await snapshot("armed"); } catch (e) { err = String((e && e.message) || e); } }
      return "AUTOSAVE IS ON :: EVERY CLEAN BUILD OF THIS TERMINAL IS NOW ZIPPED AND KEPT ON THIS DEVICE WHEN THE SOURCE IS NOT ALL ON THE SERVER YET. IT IS NEVER UPLOADED, AND NOTHING ABOUT THE SERVER CHANGES."
        + (rec ? "\n  A SNAPSHOT WAS TAKEN NOW :: " + rec.files + " FILES / " + Math.round(rec.bytes / 1024) + " KB :: /backup pull DOWNLOADS IT."
          : (err ? "\n  A SNAPSHOT COULD NOT BE TAKEN NOW :: " + err.toUpperCase()
            : "\n  NOTHING WAS KEPT NOW (" + (bs.stale ? "the packed copy of index.html is out of date" : "the server already holds every file this page loads") + ") - the next clean one will be."));
    }
    if (a === "now" || a === "take" || a === "snapshot" || a === "save") {
      // ASKED FOR IS ASKED FOR: the pack being out of date is said, not used to refuse a copy of his work.
      var bsNow = await buildState();
      var r = await snapshot("asked");
      return "SNAPSHOT KEPT ON THIS DEVICE :: " + r.files + " FILES / " + Math.round(r.bytes / 1024) + " KB (" + r.ms + " MS) AT " + when()
        + (!bsNow.clean ? "\n  !! THE PACKED COPY OF index.html IS OUT OF DATE, SO THE COPY INSIDE THIS ZIP IS NOT THE ONE THIS PAGE IS RUNNING - TELL YOUR AGENT TO REFRESH src/pack/." : "")
        + (r.modulesMissing || r.issues ? "\n  (" + r.modulesMissing + " MODULE(S) AND " + r.issues + " STARTUP FAULT(S) WERE RECORDED AT THIS MOMENT - THE TREE IN THE FILE IS UNAFFECTED.)" : "")
        + "\n  IT REPLACES THE PREVIOUS ONE - WHAT MATTERS IS THE CURRENT TREE. /backup pull DOWNLOADS IT; /backup kept SHOWS IT. NOTHING WAS UPLOADED AND NOTHING ABOUT THE SERVER CHANGED.";
    }
    var info = await keptInfo();
    var lines = ["AUTOSAVE :: " + (st.auto ? "ON" : "OFF") + " :: " + (info ? ("THE NEWEST SNAPSHOT WAS TAKEN " + asAge(info.at) + " (" + info.files + " FILES / " + Math.round(info.bytes / 1024) + " KB)" + (info.blobKept ? "" : " - BUT ITS BYTES ARE GONE FROM THIS DEVICE")) : "NOTHING HAS BEEN KEPT YET")];
    if (info && info.of) lines.push("  AT THAT MOMENT " + info.missing + " OF " + info.of + " SOURCE FILES WERE NOT ON THE SERVER" + (info.stale ? ", AND THE PACKED index.html WAS OUT OF DATE" : "") + (info.modulesMissing || info.issues ? " (" + info.modulesMissing + " MODULE(S), " + info.issues + " FAULT(S) AT LOAD - THE TREE IS UNAFFECTED)" : "") + ".");
    lines.push("  A SNAPSHOT IS TAKEN AUTOMATICALLY WHEN THE BUILD IS CLEAN (THE PACKED index.html MATCHES WHAT THIS PAGE LOADS) AND THE SOURCE IS NOT ALL ON THE SERVER YET - OTHERWISE NOTHING HAPPENS. IT IS NEVER UPLOADED.");
    lines.push("  /backup autosave on|off \u00b7 /backup autosave now \u00b7 /backup pull (download the newest) \u00b7 /backup kept (where it is)");
    lines.push("  A BACKUP IS NOT A SAVE :: THE EDITOR'S SAVE BUTTON IS THE ONLY THING THAT PUTS THE WORK ON THE SERVER, AND THIS PAGE CANNOT PRESS IT.");
    return lines.join("\n");
  }

  window.backup = {
    collect: collect,
    build: build,
    download: download,
    status: status,
    report: report,
    diag: diag,
    reportDiag: reportDiag,
    announce: announce,
    zip: zip,
    expectedFiles: expectedFiles,
    staleCheck: staleCheck,
    serverCopy: serverCopy,
    PACK_DIR: PACK_DIR,
    // AUTOSAVE (device-side insurance for unsaved work; see the block above)
    autosaveBoot: autosaveBoot,
    autosaveCmd: autosaveCmd,
    snapshot: snapshot,
    pull: pullSnapshot,
    kept: keptInfo,
    buildState: buildState
  };
})();
