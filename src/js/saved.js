/* THE SAVE CHECK - src/js/saved.js

   "IS THE WORK SAVED?" - asked of the PLATFORM, and answered file by file. `/saved` reads the copy
   the server is holding right now, compares it against this workspace, and says either that the two
   are the same thing or exactly which files are not on the server yet.

   WHY IT EXISTS. The editor's SAVE button is the only thing that publishes this generator: until it
   is pressed, the work lives in the editor and in this page, and every other device - a phone, a
   tablet, the public URL - is served the last save (or 404s, for a file it has never had). So
   "is it saved?" is a question about the whole tree, not about one file, and it is asked often
   enough (every build ends with it) that guessing is not good enough. /backup status answers half
   of it from inside the page; this answers ALL of it, by CONTENT, for main.pjs, for index.html and
   for all 127 src/ files, and it works even when the page's own embedded copy is missing.

   WHY IT ASKS THE SERVER INSTEAD OF TRUSTING THE PAGE. The served page carries its own copy of the
   generator ("#preloaded-generator-data": the model text, the output template and the src manifest,
   with a size and a CDN key per file) - and that is what /backup status reads. Measured, 2026-09-30,
   because the difference matters: with a 61-byte probe appended to main.pjs and the page reloaded,
   the embedded copy still reported 67,860 BYTES while the workspace file was 67,921 - so the element
   carries the copy the page was SERVED WITH, not what the workspace looks like now. That makes it
   honest for /backup status and STALE for this: after a save, the page you are looking at is still
   running the previous one until it is reloaded, and only a fresh read of the server can notice. So
   the server is asked directly, cache-busted per call, and the page's own copy is compared against
   the answer as a second opinion (it is reported when the page is behind).

   THE ROAD TO THE SERVER IS THE RELAY, AND IT HAS TO BE. Measured: `fetch("https://perchance.org/
   api/downloadGenerator?generatorName=...")` from this page is `TypeError: Failed to fetch` (their
   API sends no CORS headers), while `root.superFetch(...)` on the very same URL returns 200 and
   904,256 bytes - the super-fetch-plugin, already imported for the key ring's proxy road. No key,
   no account, no cost; one read, ~450 ms.

   WHY BY CONTENT AND NOT BY SIZE. The manifest gives each saved file a `key` and a `size`, and the
   key is opaque: measured against src/js/packs.js, it is NOT md5 of the content, nor md5 of the
   path+content, nor of a dozen other spellings - so it cannot be recomputed here. But the key IS the
   file's name on the platform's own CDN: the served page's own `PERCH.src` names the base,
   `https://user.uploads.dev/file/<key>`, with `KEY_REGEX = /^[0-9a-f]{32}\.[a-z0-9]{1,20}$/`. So every
   saved file can be READ BACK and compared byte for byte - 127 files in 478 ms, because the page has
   already loaded most of them. That matters: a size check would miss a one-digit edit (0.8 to 0.9),
   which is exactly the kind of edit this project makes.

   WHAT IT PROVES, AND WHAT IT DOES NOT. It proves the server's copy and this workspace are the same
   bytes: the two root files exactly, and every listed src/ file exactly. It does NOT prove what other
   browsers have cached, and it says nothing about the conversation - the archive is in kv, on this
   device, and is never on the server at all (that is /sync's and /cloud's question, not this one).

   THE WORKSPACE SIDE OF THE ROOT COMPARISON IS THE PACK COPIES, AND THAT IS A REAL DEPENDENCY.
   main.pjs and index.html cannot be fetched from this page at all - measured: `fetch("main.pjs")` is
   `TypeError: Failed to fetch` (this frame's URL has no trailing slash, so the relative path climbs a
   directory above the generator) and every absolute spelling of it on this origin is a 404, while
   `src/pack/main.pjs.txt` comes back 200. So the root half of this check compares the server against
   THE PACK - src/pack/main.pjs.txt and src/pack/index.html.txt, which the build keeps byte-identical
   to the two root files, and src/pack/files.json for the file list - and the report says so out loud.
   If the pack is behind the editor's buffers, the root verdict is about the pack. Everything under
   src/ needs no such caveat: those files are read from their real paths.

   IT WRITES NOTHING, GATES NOTHING, AND FAILS SOFT. No file is changed, no key is read, nothing is
   uploaded; the read is a GET of the generator's own public page. If the relay is missing or the
   endpoint refuses, it falls back to the page's embedded copy and SAYS which source answered, so a
   degraded answer is never mistaken for a fresh one. If a check ever says BEHIND just after a save,
   ask again: the snapshot is cache-busted per call, but their save itself is asynchronous.
*/(function () {
  "use strict";

  var ENDPOINT = "https://perchance.org/api/downloadGenerator?generatorName=";
  var CDN = "https://user.uploads.dev/file/";       // PERCH.src's own base, read out of the served page
  var EL_ID = "preloaded-generator-data";           // the copy the page was served with
  var PACK_LIST = "src/pack/files.json";            // this workspace's file list (byte-exact set)
  var ROOT = [                                       // [the file, the workspace copy, the field in the snapshot]
    ["main.pjs", "src/pack/main.pjs.txt", "modelText"],
    ["index.html", "src/pack/index.html.txt", "outputTemplate"]
  ];

  var last = null;                                   // the last report, for /saved with no argument

  function stamp() {
    try {
      if (window.logTime && window.logTime.stamp) return window.logTime.stamp(Date.now());
    } catch (e) {}
    return new Date().toLocaleString();
  }

  function n(x) { return Number(x || 0).toLocaleString(); }

  function parseData(text) {
    if (!text) return null;
    var t = String(text);
    try { return JSON.parse(t.charAt(0) === "{" || t.charAt(0) === "[" ? t : decodeURI(t)); }
    catch (e) { return null; }
  }

  // The page's own embedded copy (what it was SERVED with - see the header).
  function embedded() {
    var el = document.getElementById(EL_ID);
    return el ? parseData(el.textContent || el.innerHTML || "") : null;
  }

  function manifestOf(d) {
    if (!d || !d.srcManifest) return null;
    var m = d.srcManifest;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch (e) { return null; } }
    return (m && typeof m === "object") ? m : null;
  }

  async function textOf(url) {
    var r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  }

  async function bytesOf(url) {
    var r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }

  function eqBytes(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // WHERE THE TWO ROOT FILES FIRST PART WAY - a line number and both lines, which is what is actually
  // wanted when a check says main.pjs is behind (an agent can act on a line; a byte count is useless).
  function firstDiff(a, b) {
    if (a === b) return null;
    var la = String(a).split("\n"), lb = String(b).split("\n"), n = Math.min(la.length, lb.length), i;
    for (i = 0; i < n; i++) if (la[i] !== lb[i]) return { line: i + 1, live: la[i], here: lb[i] };
    return { line: n + 1, live: "(THE SAVED COPY ENDS HERE - " + la.length + " LINES)", here: "(THIS WORKSPACE HAS " + lb.length + " LINES)" };
  }

  // The import lines main.pjs actually carries (a top-level assignment, so a mention in a comment or
  // in prose does not count).
  function importsHere(mainText) {
    var out = [], re = /^\s*[A-Za-z_$][\w$]*\s*=\s*\{import:([a-z0-9-]+)\}/gim, m;
    while ((m = re.exec(String(mainText))) !== null) if (out.indexOf(m[1]) === -1) out.push(m[1]);
    return out;
  }

  // ---------------------------------------------------------------- the check

  async function check(opts) {
    opts = opts || {};
    var started = Date.now();
    var rep = {
      at: Date.now(), ok: true, source: "", saved: null, name: "",
      wantName: window.generatorName, snapshot: null, pageBehind: null,
      root: {}, set: null, files: null, imports: null, notes: [], ms: 0
    };
    var page = embedded();
    var data = null;

    if (window.root && window.root.superFetch) {
      try {
        var t1 = Date.now();
        var res = await window.root.superFetch(ENDPOINT + encodeURIComponent(window.generatorName) + "&__cacheBust=" + Math.random());
        var text = await res.text();
        rep.snapshot = { bytes: text.length, ms: Date.now() - t1, status: res.status };
        var el = new DOMParser().parseFromString(text, "text/html").querySelector("#" + EL_ID);
        data = el ? parseData(el.textContent) : null;
        if (data) rep.source = "server";
        else rep.notes.push("THE SERVER ANSWERED (" + res.status + ", " + n(text.length) + " BYTES) BUT ITS PAGE CARRIED NO GENERATOR DATA - /saved CANNOT SAY." + (text.indexOf("not been saved") !== -1 || text.indexOf("Cannot GET") !== -1 ? " IT LOOKS AS IF NOTHING IS SAVED UNDER THIS NAME YET." : ""));
      } catch (e) {
        rep.notes.push("THE RELAY COULD NOT READ THE SERVER'S COPY (" + ((e && e.message) || e) + ").");
      }
    } else {
      rep.notes.push("THE RELAY IS NOT LOADED HERE (super-fetch-plugin), SO THE SERVER COULD NOT BE ASKED.");
    }

    if (!data && page) { data = page; rep.source = "page"; }
    if (!data) {
      rep.ok = false; rep.source = "none";
      rep.notes.push("NOTHING COULD BE READ: NEITHER THE SERVER (RELAY) NOR THIS PAGE'S OWN SERVED COPY.");
      rep.ms = Date.now() - started; last = rep; return rep;
    }

    rep.name = String(data.name || "");
    if (rep.name && rep.name !== String(window.generatorName)) {
      rep.notes.push("THE SAVED COPY IS FILED UNDER \"" + rep.name.toUpperCase() + "\" AND THIS PAGE RUNS AS \"" + String(window.generatorName).toUpperCase() + "\" - THE GENERATOR WAS RENAMED, AND RENAMING CHANGES THE ADDRESS (AND WITH IT kv, AND PLUGIN DATA KEYED BY THE NAME).");
    }
    if (data.isPrivate === true) rep.notes.push("THE SAVED COPY IS MARKED PRIVATE, SO IT IS NOT ON THE PUBLIC LISTING UNTIL THAT IS CHANGED.");

    // ---- the two root files, byte for byte, with the first line that parts them
    var rootTexts = {};
    for (var i = 0; i < ROOT.length; i++) {
      var f = ROOT[i], liveText = (typeof data[f[2]] === "string") ? data[f[2]] : null;
      var hereText = null;
      try { hereText = await textOf(f[1]); } catch (e) { rep.notes.push("THIS WORKSPACE'S COPY OF " + f[0] + " COULD NOT BE READ (" + e.message + ")."); }
      rootTexts[f[0]] = hereText;
      rep.root[f[0]] = (liveText === null || hereText === null)
        ? { same: false, unknown: true, live: liveText ? liveText.length : null, here: hereText ? hereText.length : null, diff: null }
        : { same: liveText === hereText, live: liveText.length, here: hereText.length, diff: firstDiff(liveText, hereText) };
    }

    // ---- the file list, and then every file on it, by content
    var man = manifestOf(data);
    var list = [];
    try { list = (JSON.parse(await textOf(PACK_LIST)).files || []).slice(); } catch (e) { rep.notes.push("THIS WORKSPACE'S FILE LIST (" + PACK_LIST + ") COULD NOT BE READ (" + e.message + ")."); }
    if (!man) {
      rep.notes.push("THE SAVED COPY CARRIES NO src/ MANIFEST, SO THE FILES COULD NOT BE COMPARED.");
    } else {
      var manKeys = Object.keys(man);
      rep.set = {
        live: manKeys.length, here: list.length,
        same: manKeys.slice().sort().join("\n") === list.slice().sort().join("\n"),
        notInLive: list.filter(function (p) { return !man[p]; }),
        notHere: manKeys.filter(function (p) { return list.indexOf(p) === -1; })
      };
      if (!opts.quick) {
        var differ = [], unread = [], same = 0;
        var t2 = Date.now();
        for (var j = 0; j < list.length; j++) {
          var p = list[j], m = man[p];
          if (!m || !m.key) continue;
          try {
            var live = await bytesOf(CDN + m.key);
            var here = await bytesOf("src/" + p);
            if (eqBytes(live, here)) same++;
            else differ.push({ path: p, live: live.length, here: here.length });
          } catch (e) { unread.push({ path: p, why: e.message }); }
        }
        rep.files = { checked: list.length, same: same, differ: differ, unread: unread, ms: Date.now() - t2 };
      }
    }

    // ---- the imports, because an import that is not live is a terminal that half-works
    if (man && rootTexts["main.pjs"] !== null && Array.isArray(data.imports)) {
      var here = importsHere(rootTexts["main.pjs"]);
      var live = data.imports.map(function (x) { return String(x); });
      var missing = here.filter(function (x) { return live.indexOf(x) === -1; });
      var extra = live.filter(function (x) { return here.indexOf(x) === -1; });
      rep.imports = { same: !missing.length && !extra.length, live: live, here: here, missing: missing, extra: extra };
    }

    // ---- and whether the page in front of him is running this same save
    if (page && rep.source === "server") {
      var agrees = (typeof data.modelText === "string" && typeof page.modelText === "string") ? page.modelText === data.modelText : null;
      rep.pageBehind = (agrees === null) ? null : !agrees;
    }

    // ---- the verdict
    var bad = [];
    for (var k = 0; k < ROOT.length; k++) if (rep.root[ROOT[k][0]] && !rep.root[ROOT[k][0]].same) bad.push(ROOT[k][0]);
    rep.saved = !!rep.ok && !bad.length && !!rep.set && rep.set.same
      && (!rep.files || (!rep.files.differ.length && !rep.files.unread.length))
      && (!rep.imports || rep.imports.same);
    rep.badRoot = bad;
    rep.ms = Date.now() - started;
    last = rep;
    return rep;
  }

  // ---------------------------------------------------------------- the report, in the terminal's voice

  function text(rep) {
    rep = rep || last;
    if (!rep) return "THE SAVE CHECK :: NOTHING HAS BEEN CHECKED IN THIS PAGE YET - /saved ASKS THE SERVER.";
    var L = [];
    var fromServer = rep.source === "server";
    if (!rep.ok && rep.source === "none") {
      L.push("THE SAVE CHECK :: COULD NOT BE ANSWERED.");
      rep.notes.forEach(function (x) { L.push("  " + x); });
      return L.join("\n");
    }
    L.push(rep.saved
      ? "THE SAVE CHECK :: EVERYTHING HERE IS SAVED. THE SERVER'S COPY IS THIS WORKSPACE, FILE FOR FILE."
      : "THE SAVE CHECK :: THE SERVER'S COPY IS BEHIND THIS WORKSPACE. PRESS SAVE IN THE EDITOR.");
    L.push("");

    if (rep.source === "page") {
      L.push("  READ FROM THIS PAGE'S OWN SERVED COPY, NOT FROM THE SERVER - " + rep.notes.join(" ") + " SO THIS ANSWER IS AS FRESH AS THE LAST LOAD, NOT AS FRESH AS THE LAST SAVE.");
      L.push("");
    }

    // the root files
    for (var i = 0; i < ROOT.length; i++) {
      var f = ROOT[i][0], r = rep.root[f];
      if (!r) continue;
      if (r.unknown) L.push("  " + f + " :: COULD NOT BE COMPARED.");
      else if (r.same) L.push("  " + f + " :: THE SAME, BYTE FOR BYTE (" + n(r.here) + " CHARACTERS).");
      else {
        L.push("  " + f + " :: DIFFERENT - THE SAVED COPY IS " + n(r.live) + " CHARACTERS, THIS WORKSPACE HAS " + n(r.here) + ".");
        if (r.diff) {
          L.push("      FIRST DIFFERENCE AT LINE " + r.diff.line + " ::");
          L.push("        SAVED :: " + String(r.diff.live).slice(0, 110));
          L.push("        HERE  :: " + String(r.diff.here).slice(0, 110));
        }
      }
    }
    L.push("  (THE 'HERE' SIDE OF THOSE TWO IS src/pack/main.pjs.txt AND src/pack/index.html.txt - THE BYTE-EXACT COPIES THE BUILD KEEPS OF THE ROOT FILES, BECAUSE THIS PAGE CANNOT READ main.pjs OR index.html THEMSELVES - AND src/pack/files.json FOR THE LIST BELOW. IF THE PACK IS BEHIND THE EDITOR'S BUFFERS, THESE BITS ARE ABOUT THE PACK, NOT THE BUFFER.)");

    // the files
    if (rep.set) {
      L.push("  src/ :: " + rep.set.live + " FILES ON THE SERVER, " + rep.set.here + " HERE" + (rep.set.same ? " - THE SAME LIST." : " - THE LISTS DIFFER."));
      if (rep.set.notInLive.length) L.push("      NOT ON THE SERVER AT ALL (" + rep.set.notInLive.length + ") :: " + rep.set.notInLive.join(", "));
      if (rep.set.notHere.length) L.push("      ON THE SERVER BUT NOT IN THIS WORKSPACE (" + rep.set.notHere.length + ") :: " + rep.set.notHere.join(", ") + "  (THE LAST SAVE HAD THEM)");
    }
    if (rep.files) {
      var fl = rep.files;
      if (!fl.differ.length && !fl.unread.length) L.push("  EVERY ONE OF THOSE FILES :: THE SAME, BY CONTENT - EACH SAVED FILE WAS READ BACK OFF THE PLATFORM'S OWN CDN (user.uploads.dev) AND COMPARED BYTE FOR BYTE, NOT BY SIZE, IN " + n(fl.ms) + " MS.");
      else {
        L.push("  NOT SAVED (" + (fl.differ.length + fl.unread.length) + " OF " + fl.checked + ") ::");
        fl.differ.slice(0, 12).forEach(function (d) { L.push("      " + d.path + "  ::  DIFFERENT (SAVED " + n(d.live) + " / HERE " + n(d.here) + ") - A ONE-CHARACTER EDIT SHOWS HERE, WHICH IS THE POINT"); });
        fl.unread.slice(0, 6).forEach(function (d) { L.push("      " + d.path + "  ::  COULD NOT BE READ BACK (" + d.why + ")"); });
        if (fl.differ.length > 12) L.push("      ... AND " + (fl.differ.length - 12) + " MORE");
      }
    }
    if (rep.imports) {
      if (rep.imports.same) L.push("  IMPORTS :: " + rep.imports.here.length + ", AND THEY ARE THE ONES main.pjs ASKS FOR (" + rep.imports.here.join(", ") + ").");
      else {
        if (rep.imports.missing.length) L.push("  IMPORTS NOT LIVE YET :: " + rep.imports.missing.join(", ") + " - main.pjs ASKS FOR THEM AND THE SAVED COPY DOES NOT HAVE THEM.");
        if (rep.imports.extra.length) L.push("  IMPORTS LIVE BUT NOT ASKED FOR HERE :: " + rep.imports.extra.join(", "));
      }
    }

    if (rep.pageBehind === true) L.push("  NOTE :: THIS PAGE WAS SERVED AN OLDER COPY THAN THE SERVER NOW HOLDS - YOU SAVED AFTER THIS PAGE LOADED, SO RELOAD TO BE RUNNING THE NEWEST SAVE (THE PAGE STILL RUNS THE OLD ONE).");
    rep.notes.forEach(function (x) { L.push("  " + x); });

    L.push("");
    L.push("  ASKED " + (fromServer ? "THE SERVER" : "THIS PAGE") + " AT " + stamp()
      + (rep.snapshot ? " :: " + n(rep.snapshot.bytes) + " BYTES IN " + n(rep.snapshot.ms) + " MS (perchance.org/api/downloadGenerator, THROUGH THE RELAY)" : "")
      + ". THE WHOLE CHECK TOOK " + n(rep.ms) + " MS. NOTHING WAS WRITTEN, UPLOADED OR CHANGED BY IT.");
    L.push("  IT ANSWERS ONE QUESTION ONLY: IS THE SOURCE THE SERVER HOLDS THE SAME AS THIS WORKSPACE. THE CONVERSATION IS NOT ON THE SERVER AT ALL - IT LIVES IN THIS BROWSER (kv) AND IS /sync's AND /cloud's BUSINESS, NOT THIS.");
    return L.join("\n");
  }

  async function describe() {
    if (!last) return "THE SAVE CHECK :: NOTHING HAS BEEN CHECKED IN THIS PAGE YET. /saved ASKS THE SERVER FOR ITS COPY AND COMPARES EVERY FILE - main.pjs, index.html AND ALL 127 FILES UNDER src/ - BY CONTENT.";
    return text(last);
  }

  function help() {
    return "THE SAVE CHECK (src/js/saved.js) :: \"IS THE WORK SAVED?\" ASKED OF THE PLATFORM.\n"
      + "WHAT IT DOES :: READS THE COPY THE SERVER IS HOLDING RIGHT NOW (perchance.org/api/downloadGenerator, THROUGH THE RELAY - THE API ITSELF SENDS NO CORS HEADERS, SO THE PAGE CANNOT FETCH IT DIRECTLY) AND COMPARES IT AGAINST THIS WORKSPACE: main.pjs AND index.html EXACTLY (WITH THE FIRST LINE THAT DIFFERS, WHEN ONE DOES), THE FILE LIST, EVERY src/ FILE BY CONTENT, AND THE IMPORT LINES.\n"
      + "WHY BY CONTENT :: A SAVED FILE'S MANIFEST KEY IS ALSO ITS NAME ON THE PLATFORM'S OWN CDN (user.uploads.dev/file/<key>), SO EACH SAVED FILE IS READ BACK AND COMPARED BYTE FOR BYTE - WHICH CATCHES A ONE-CHARACTER EDIT, WHERE A SIZE CHECK WOULD NOT. 127 FILES TAKE ~0.5 S.\n"
      + "WHY IT ASKS THE SERVER AND NOT THE PAGE :: THE PAGE IS SERVED ITS OWN COPY OF THE GENERATOR, AND THAT COPY IS THE LAST SAVE, NOT THE WORKSPACE (MEASURED: AN UNSAVED 61-BYTE PROBE IN main.pjs DID NOT MOVE IT). SO /backup status IS HONEST ABOUT THE FILE LIST, AND THIS IS THE THING THAT CAN ALSO SEE WHAT CHANGED.\n"
      + "THE 'HERE' SIDE OF THE TWO ROOT FILES :: src/pack/main.pjs.txt AND src/pack/index.html.txt (AND src/pack/files.json FOR THE FILE LIST) - THE BYTE-EXACT COPIES THE BUILD KEEPS OF main.pjs AND index.html, BECAUSE THOSE TWO CANNOT BE FETCHED FROM THIS PAGE AT ALL (Failed to fetch RELATIVELY, 404 AT EVERY ABSOLUTE SPELLING). EVERYTHING UNDER src/ IS READ FROM ITS REAL PATH, SO NO SUCH CAVEAT APPLIES TO IT.\n"
      + "WHAT IT NEVER DOES :: WRITES NOTHING, UPLOADS NOTHING, READS NO KEY, GATES NOTHING. IT IS A GET OF THE GENERATOR'S OWN PAGE.\n"
      + "\n  /saved              the whole check, and the verdict"
      + "\n  /saved quick        the root files and the file list only (no per-file read-back)"
      + "\n  /saved help         this"
      + "\n\nONLY THE EDITOR'S SAVE BUTTON PUBLISHES. A BACKUP IS NOT A SAVE, AND THIS COMMAND CANNOT PRESS IT EITHER - /backup TAKES A COPY FIRST ("+ "/backup autosave KEEPS ONE ON THIS DEVICE WHILE THE SOURCE IS NOT ALL ON THE SERVER), THEN SAVE, THEN /saved AGAIN TO SEE IT LAND.";
  }

  function say(t) {
    try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {}
  }

  async function run(opts, quiet) {
    if (!quiet) say("THE SAVE CHECK :: READING THE SERVER'S COPY...");
    var rep = await check(opts);
    say(text(rep));
    return rep;
  }

  async function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (a === "help" || a === "-h" || a === "--help") { say(help()); return; }
    if (a === "quick" || a === "fast") { await run({ quick: true }); return; }
    if (a === "deep" || a === "full" || a === "check" || a === "") { await run({}); return; }
    say(await describe());
  }

  window.saved = {
    check: check,
    text: text,
    run: run,
    describe: describe,
    help: help,
    command: command,
    last: function () { return last; },
    embedded: embedded
  };
})();
