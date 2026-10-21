/* ------------------------------------------------------------------
   THE DRIVE ROAD — a folder on his own disk, read and written in place.

   Patrikios: "We need the Drive Mapping functions for sure for sure ...
   so we can access the local drive."

   WHY THIS EXISTS. The folder road (/sync) can only TAKE IN - a folder
   picked with <input webkitdirectory> or dropped on the panel is read,
   and what leaves goes out through the browser's own download. Writing
   IN PLACE needs a folder HANDLE, and showDirectoryPicker() is REFUSED
   in the frame this terminal is served in ("Cross origin sub frames
   aren't allowed to show a file picker" - measured in sync.js). The way
   through is a second WINDOW: window.open from his own click is a real
   top-level page, and THERE the picker is allowed. So the drive lives in
   that window (src/drive.html) and this module talks to it - pull reads
   every picture in the linked folder into the vault, push writes the
   vault's pictures back into a Mythos subfolder of it. The window owns
   the handle; this side never sees one, which is also why nothing here
   persists beyond the name and the stamp.

   WHAT IT MOVES. Pictures only, both ways (the window scans image
   files, the vault files by image mime) - clips and music stay on the
   vault's own storage until a later pass says otherwise, and the copy
   here says so out loud instead of pretending.
     pull   folder picture -> vault record, kind attach, folder /images,
            tagged drive + the folder's name, note naming the folder and
            the day. A picture already held under the same name AND size
            is skipped, so pulling again only brings in what is new.
     push   vault pictures in one folder (default /images) -> the linked
            folder's Mythos/ subfolder, same name, same bytes. A file
            already there at the same size is skipped on the far side, so
            pushing twice changes nothing. Nothing of the folder's own
            files is ever touched, and nothing pulled is ever pushed back
            (the window never descends into Mythos/).

   WHAT IT RECORDS. kv: lia_settings / drive - the same shape as the
   other roads keep: `last` is {name, at}, the folder's name and the
   moment it was linked. No handle, no listing, no bytes - a handle
   cannot be kept across loads without his click anyway, and the window
   keeps its own in its private store.

   THE PROTOCOL (postMessage, {k:"drive"} both ways, source-checked):
     studio  ping | pull | push-request | shelf-slice | disconnect
     window  hello | status | pull-start | pull-files | pull-failed
             need-shelf | push-done | pick-failed
   A pull announces pull-start first; an orphan batch still opens a
   session. Push answers need-shelf slices of ten.

       /ldrive                  where the road stands
       /ldrive status            the same, in full
       /ldrive open               open (or focus) the drive window
       /ldrive pull               pull the linked folder's pictures in
       /ldrive push [/FOLDER]     save one vault folder's pictures onto it
       /ldrive forget             disconnect (the folder itself is untouched)
       /ldrive help                this text

   NOTHING HERE UPLOADS ANYTHING. The only disk it touches is the folder
   HE links in the window, and Chrome and Edge are the only browsers
   with a folder picker - elsewhere the road says so and stands down.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var REC_KEY = "drive";
  var DOC_URL = "src/drive.html";
  var WIN_NAME = "lia_drive";
  var WIN_FEAT = "width=620,height=700,menubar=no,toolbar=no,location=no,status=no";
  var SLICE = 10;
  var PULL_FOLDER = "/images";

  var win = null;
  var link = null;
  var pulling = null;
  var pushing = null;
  var claim = null;
  var autoOn = true;
  var autoTimer = null;
  var lastMirror = null;

  function el(id) { return document.getElementById(id); }
  function say(text) { if (window.print && text) window.print("SYSTEM", String(text)); }
  function vault() { return window.media || null; }

  function normFolder(s) {
    return "/" + String(s == null ? "" : s).trim().toLowerCase()
      .replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (Math.round((n / (1024 * 1024)) * 10) / 10) + " MB";
  }
  function fmtDate(at) {
    try {
      if (window.logTime && window.logTime.stamp) return window.logTime.stamp(at);
    } catch (e) {}
    return new Date(Number(at) || Date.now()).toISOString().slice(0, 19).replace("T", " ") + " UTC";
  }
  function folderTag(name) {
    return String(name || "drive").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "drive";
  }

  // ---------------------------------------------------------------- record

  function loadRec() {
    var r = null;
    try { r = window.root.kv.lia_settings.get(REC_KEY); } catch (e) { r = null; }
    return Promise.resolve(r).then(function (v) { return (v && typeof v === "object") ? v : {}; });
  }
  function saveRec(rec) {
    try { window.root.kv.lia_settings.set(REC_KEY, rec || {}); } catch (e) {}
  }

  // ---------------------------------------------------------------- window

  function alive() { return !!(win && !win.closed); }

  function open() {
    if (alive()) {
      try { win.focus(); } catch (e) {}
      post({ type: "ping" });
      return true;
    }
    var w = null;
    try { w = window.open("", WIN_NAME, WIN_FEAT); } catch (e) { w = null; }
    if (!w) {
      say("THE DRIVE WINDOW WAS BLOCKED :: ALLOW POP-UPS FOR THIS PAGE AND PRESS OPEN AGAIN. NOTHING WAS TOUCHED.");
      return false;
    }
    win = w;
    try { win.document.title = "LIA DRIVE"; } catch (e) {}
    fetch(DOC_URL, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.text();
    }).then(function (html) {
      if (!alive()) return;
      try {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch (e) {
        say("THE DRIVE WINDOW COULD NOT BE FILLED :: " + String((e && e.message) || e).toUpperCase());
      }
    }).catch(function (e) {
      try { if (alive()) win.document.body.textContent = "THE DRIVE DOCUMENT COULD NOT BE LOADED."; } catch (x) {}
      say("THE DRIVE DOCUMENT COULD NOT BE LOADED :: " + String((e && e.message) || e).toUpperCase()
        + " :: SAVE THE GENERATOR AND RELOAD, THEN TRY AGAIN.");
    });
    paint();
    return true;
  }

  function post(msg) {
    if (!alive()) return false;
    msg.k = "drive";
    try { win.postMessage(msg, "*"); return true; } catch (e) { return false; }
  }

  function ready() { return alive() && !!(link && link.granted); }

  function onMessage(e) {
    var d = e.data;
    if (!d || typeof d !== "object" || d.k !== "drive") return;
    if (!alive() || e.source !== win) return;
    if (d.type === "hello" || d.type === "status") {
      link = {
        name: d.name || "", permission: d.permission || "",
        granted: !!d.granted, count: (d.count == null ? null : d.count),
        supported: d.supported !== false
      };
      if (d.granted && d.name) {
        loadRec().then(function (r) {
          r.last = { name: d.name, at: Date.now() };
          saveRec(r);
        });
      }
      paint();
      return;
    }
    if (d.type === "pull-start") { pullBegin(d.total || 0); return; }
    if (d.type === "pull-files") { ingest(d.batch || [], d.total || 0, !!d.done); return; }
    if (d.type === "pull-failed") { pullEnd(true); return; }
    if (d.type === "need-shelf") { sendSlice(d.from || 0); return; }
    if (d.type === "push-done") { pushEnd(d); return; }
    if (d.type === "pick-failed") { say("THE DRIVE WINDOW COULD NOT OPEN A FOLDER :: SEE ITS MESSAGE."); return; }
  }

  // ---------------------------------------------------------------- pull

  function pullBegin(total) {
    if (pulling) { say("STILL BRINGING A BATCH IN :: WAIT FOR IT TO FINISH."); return false; }
    pulling = { seen: 0, total: total || 0, added: 0, skipped: 0, failed: 0, known: {} };
    try {
      var v = vault();
      if (v) {
        var ids = v.list() || [];
        for (var i = 0; i < ids.length; i++) {
          var rec = null;
          try { rec = v.get(ids[i]); } catch (e) { rec = null; }
          if (rec) pulling.known[String(rec.name || "") + "|" + (rec.bytes || 0)] = true;
        }
      }
    } catch (e) {}
    try {
      if (window.progress) claim = window.progress.begin("DRIVE", total ? { total: total } : null);
    } catch (e) { claim = null; }
    return true;
  }

  function pull() {
    if (!ready()) { say("LINK A FOLDER IN THE DRIVE WINDOW FIRST :: /ldrive open OPENS IT."); return false; }
    if (!pullBegin(0)) return false;
    post({ type: "pull", deep: true });
    return true;
  }

  function ingest(batch, total, done) {
    if (!pulling && !pullBegin(total)) return Promise.resolve(false);
    if (total) pulling.total = total;
    var sess = pulling;
    var v = vault();
    if (!v) { sess.failed += batch.length; return pullEnd(false); }
    var tag = folderTag(link && link.name);
    var chain = Promise.resolve(true);
    batch.forEach(function (f) {
      chain = chain.then(function () {
        sess.seen++;
        var blob = f && f.blob;
        if (!blob) { sess.failed++; return; }
        var name = String((f.path || f.name || "picture").split("/").pop() || "picture");
        var key = name + "|" + (blob.size || f.size || 0);
        if (sess.known[key]) { sess.skipped++; return; }
        sess.known[key] = true;
        return v.add(blob, {
          name: name, kind: "attach", folder: PULL_FOLDER,
          tags: ["drive", tag],
          note: "Pulled from " + ((link && link.name) || "the drive") + " on " + fmtDate(Date.now()) + "."
        }).then(function () { sess.added++; }).catch(function () { sess.failed++; });
      });
    });
    return chain.then(function () {
      try {
        if (claim && sess.total) claim.set(Math.min(sess.seen, sess.total));
      } catch (e) {}
      paint();
      if (done) return pullEnd(false);
      return true;
    });
  }

  function pullEnd(failed) {
    if (!pulling) return Promise.resolve(false);
    var p = pulling;
    pulling = null;
    try { if (claim) { claim.finish(); claim = null; } } catch (e) { claim = null; }
    var bits = [];
    if (p.added) bits.push(p.added + " NEW");
    if (p.skipped) bits.push(p.skipped + " ALREADY IN THE VAULT");
    if (p.failed || failed) bits.push((p.failed + (failed ? 1 : 0)) + " COULD NOT BE READ");
    say(bits.length ? "FROM THE DRIVE :: " + bits.join(" · ") + "."
      : "NOTHING NEW ON THE DRIVE :: THE VAULT ALREADY HOLDS IT ALL.");
    paint();
    return Promise.resolve(true);
  }

  // ---------------------------------------------------------------- push

  function pushScope(folder) {
    var s = String(folder || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
    if (s === "all" || s === "mirror" || s === "everything") return "all";
    return "folder";
  }

  function pushList(folder) {
    var v = vault();
    var out = [];
    if (!v) return out;
    var all = pushScope(folder) === "all";
    var want = normFolder(folder || PULL_FOLDER);
    var ids = [];
    try { ids = v.list() || []; } catch (e) { ids = []; }
    for (var i = 0; i < ids.length; i++) {
      var rec = null;
      try { rec = v.get(ids[i]); } catch (e) { rec = null; }
      if (!rec || !rec.blob) continue;
      if (!all && normFolder(rec.folder) !== want) continue;
      if (!all && !/^image\//.test(String(rec.mime || ""))) continue;
      out.push(rec);
    }
    return out;
  }

  function push(folder, quiet) {
    if (!ready()) { say("LINK A FOLDER IN THE DRIVE WINDOW FIRST :: /ldrive open OPENS IT."); return false; }
    if (pushing) { say("STILL WRITING A BATCH OUT :: WAIT FOR IT TO FINISH."); return false; }
    var all = pushScope(folder) === "all";
    var list = pushList(all ? "all" : folder);
    if (!list.length) {
      say(all ? "NOTHING TO MIRROR :: THE VAULT HOLDS NO FILES."
        : "NOTHING TO SAVE :: NO PICTURES IN " + normFolder(folder || PULL_FOLDER).toUpperCase() + ".");
      return false;
    }
    pushing = { list: list, names: {}, written: 0, skipped: 0, failed: 0, total: list.length,
      scope: all ? "all" : normFolder(folder || PULL_FOLDER), quiet: !!quiet };
    try {
      if (window.progress) claim = window.progress.begin("DRIVE", { total: list.length });
    } catch (e) { claim = null; }
    post({ type: "push-request" });
    return true;
  }

  function sendSlice(from) {
    if (!pushing) return Promise.resolve(false);
    var ps = pushing;
    var slice = ps.list.slice(from, from + SLICE);
    var items = [];
    var chain = Promise.resolve(true);
    slice.forEach(function (rec) {
      chain = chain.then(function () {
        var name = String(rec.name || "picture");
        if (ps.names[name]) {
          name = name.replace(/(\.[a-z0-9]+)$/i, "-" + String(rec.id).slice(-6) + "$1");
        }
        ps.names[name] = true;
        // THE TREE RIDES ALONG. The window rebuilds the vault folder under Mythos/
        // (images/upscaled -> Mythos/images/upscaled/), and never descends into
        // Mythos/ on a scan - so nothing mirrored is ever pulled back.
        var dir = ps.scope === "all"
          ? String(rec.folder || "").replace(/^\/+|\/+$/g, "") : "";
        items.push({ name: name, blob: rec.blob, dir: dir });
      });
    });
    return chain.then(function () {
      if (!pushing) return false;
      post({ type: "shelf-slice", from: from, items: items, total: ps.list.length });
      return true;
    });
  }

  function pushEnd(d) {
    if (!pushing) return;
    var scope = pushing.scope, quiet = pushing.quiet;
    var w = (d && d.written) || 0, s = (d && d.skipped) || 0, f = (d && d.failed) || 0;
    pushing = null;
    try { if (claim) { claim.finish(); claim = null; } } catch (e) { claim = null; }
    if (scope === "all") {
      lastMirror = { at: Date.now(), written: w, skipped: s, failed: f };
      loadRec().then(function (r) { r.mirror = lastMirror; saveRec(r); });
    }
    var line = (scope === "all" ? "MIRROR COMPLETE" : "SAVED ONTO THE DRIVE") + " :: " + w + " WRITTEN"
      + (s ? ", " + s + " ALREADY THERE" : "")
      + (f ? ", " + f + " FAILED" : "") + ".";
    if (quiet && !f && !w) return;
    say(quiet ? line + " (AUTO)" : line);
    paint();
  }

  // ---------------------------------------------------------------- panel

  function paint() {
    var d = link || {};
    var open = alive();
    if (el("dvState")) el("dvState").textContent = open ? (d.granted ? "LINKED :: " + (d.name || "") : "WINDOW OPEN :: LINK A FOLDER IN IT") : "CLOSED";
    if (el("dvFolder")) el("dvFolder").textContent = d.name || "—";
    if (el("dvPerm")) {
      el("dvPerm").textContent = d.granted ? "read & write" : (d.name ? "needs a click" : "not linked");
      el("dvPerm").className = "pill " + (d.granted ? "ok" : (d.name ? "warn" : ""));
    }
    if (el("dvCount")) el("dvCount").textContent = (d.count == null ? "not counted yet" : d.count + (d.count === 1 ? " picture" : " pictures"));
    if (el("dvPull")) el("dvPull").disabled = !ready();
    if (el("dvPush")) el("dvPush").disabled = !ready();
    if (el("dvMirror")) el("dvMirror").disabled = !ready();
    if (el("dvOpen")) el("dvOpen").textContent = open ? "SHOW THE DRIVE WINDOW" : "OPEN THE DRIVE WINDOW";
    loadRec().then(function (r) {
      if (el("dvLast") && r && r.last && !open) {
        el("dvLast").hidden = false;
        el("dvLast").textContent = "Last linked: " + r.last.name + " — " + fmtDate(r.last.at) + ".";
      } else if (el("dvLast")) el("dvLast").hidden = true;
    });
  }

  // ---------------------------------------------------------------- auto-mirror

  // THE VAULT CANNOT DIE AGAIN. Every record enters the vault through the one
  // door (media.onAdd), so this stands there once and queues a mirror shortly
  // after anything lands - but only while the window is open and linked, and
  // never twice at once. Pulled pictures ride back out through it, which is
  // safe: the window never descends into Mythos/ on a scan, so no loop.
  function armAuto() {
    if (armAuto.done) return;
    armAuto.done = true;
    try {
      var v = vault();
      if (v && v.onAdd) v.onAdd(function () { autoKick(); });
    } catch (e) {}
    loadRec().then(function (r) {
      if (r) {
        if (r.auto === false) autoOn = false;
        if (r.mirror) lastMirror = r.mirror;
      }
      paint();
    });
  }

  function autoKick() {
    if (!autoOn || pushing || !ready()) return;
    if (autoTimer) return;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (autoOn && !pushing && ready()) push("all", true);
    }, 5000);
  }

  // ---------------------------------------------------------------- words

  function status() {
    var d = link || {};
    return "THE DRIVE ROAD :: A FOLDER ON YOUR OWN DISK, READ AND WRITTEN IN PLACE"
      + "\nWINDOW :: " + (alive() ? "OPEN" : "CLOSED")
      + "\nFOLDER :: " + (d.name || "NONE LINKED")
      + "\nACCESS :: " + (d.granted ? "READ & WRITE" : (d.name ? "NEEDS A CLICK IN THE WINDOW" : "—"))
      + "\nPICTURES :: " + (d.count == null ? "NOT COUNTED YET" : d.count)
      + "\nAUTO-MIRROR :: " + (autoOn ? "ON (EVERY VAULT ADD IS QUEUED WHILE LINKED)" : "OFF")
      + "\nMIRROR :: " + (lastMirror ? (lastMirror.written + " WRITTEN, " + lastMirror.skipped
        + " ALREADY THERE ON " + fmtDate(lastMirror.at)) : "NEVER RUN");
  }

  function help() {
    return "THE DRIVE ROAD (src/js/drive.js + src/drive.html) :: A FOLDER ON YOUR OWN DISK, READ AND WRITTEN IN PLACE."
      + "\nTHE FOLDER ROAD (/sync) CAN ONLY TAKE IN - WHAT LEAVES GOES OUT THROUGH THE BROWSER'S DOWNLOAD. WRITING IN PLACE NEEDS A FOLDER HANDLE, AND THE FRAME THIS TERMINAL IS SERVED IN REFUSES THE FOLDER PICKER - SO THE DRIVE LIVES IN ITS OWN WINDOW, OPENED BY YOUR OWN CLICK, WHERE THE PICKER IS ALLOWED. LINK THE FOLDER THERE ONCE (A MAPPED DRIVE, AN EXTERNAL DISK, A PHOTO LIBRARY) AND THIS SIDE CAN READ EVERY PICTURE IN IT AND WRITE ITS OWN BACK."
      + "\n\n/ldrive open ............ OPEN (OR FOCUS) THE DRIVE WINDOW - ALLOW POP-UPS FOR THIS PAGE"
      + "\n/ldrive pull ............ PULL THE LINKED FOLDER'S PICTURES INTO THE VAULT (ONLY WHAT IS NEW)"
      + "\n/ldrive push [/FOLDER] .. SAVE ONE VAULT FOLDER'S PICTURES ONTO THE DRIVE (DEFAULT /images)"
      + "\n/ldrive push all ........ MIRROR THE WHOLE VAULT - EVERY FOLDER, TREE KEPT UNDER Mythos/"
      + "\n/ldrive auto [on|off] ... THE AUTO-MIRROR - EVERY VAULT ADD QUEUED WHILE LINKED (ON)"
      + "\n/ldrive status .......... WHERE THE ROAD STANDS"
      + "\n/ldrive forget .......... DISCONNECT (THE FOLDER ITSELF IS UNTOUCHED)"
      + "\nPICTURES ONLY, BOTH WAYS, INTO A Mythos SUBFOLDER - NEVER OVER THE FOLDER'S OWN FILES, AND NOTHING PULLED IS EVER PUSHED BACK. CHROME AND EDGE HAVE THE FOLDER PICKER; ELSEWHERE THE ROAD SAYS SO AND STANDS DOWN. NOTHING IS EVER UPLOADED ANYWHERE.";
  }

  function words(verb, rest) {
    verb = String(verb || "").toLowerCase();
    rest = String(rest || "").trim();
    if (!verb || verb === "status") { say(status()); return; }
    if (verb === "help" || verb === "?") { say(help()); return; }
    if (verb === "open" || verb === "show" || verb === "window") { open(); return; }
    if (verb === "pull" || verb === "down" || verb === "in") { pull(); return; }
    if (verb === "push" || verb === "up" || verb === "out" || verb === "save" || verb === "mirror") { push(rest || PULL_FOLDER); return; }
    if (verb === "auto") {
      var a = String(rest).toLowerCase();
      if (a === "on" || a === "off") {
        autoOn = (a === "on");
        loadRec().then(function (r) { r.auto = autoOn; saveRec(r); paint(); });
        say("THE AUTO-MIRROR IS " + (autoOn ? "ON :: EVERY VAULT ADD IS QUEUED WHILE THE WINDOW IS LINKED."
          : "OFF :: THE VAULT STAYS IN THIS BROWSER UNTIL YOU PUSH BY HAND."));
        return;
      }
      say("THE AUTO-MIRROR IS " + (autoOn ? "ON" : "OFF") + " :: /ldrive auto on|off.");
      return;
    }
    if (verb === "forget" || verb === "disconnect" || verb === "drop") {
      post({ type: "disconnect" });
      link = null;
      loadRec().then(function (r) { r.last = null; saveRec(r); paint(); });
      say("THE DRIVE IS FORGOTTEN :: THE FOLDER ITSELF IS UNTOUCHED.");
      return;
    }
    say("NO SUCH ORDER :: /ldrive open · pull · push [/FOLDER|all] · auto [on|off] · status · forget · help");
  }

  window.addEventListener("message", onMessage);
  window.addEventListener("pagehide", function () { pulling = null; pushing = null; });
  armAuto();

  window.drive = {
    open: open, pull: pull, push: push, words: words, status: status,
    paint: paint, ready: ready, auto: function (on) {
      if (on === true || on === false) {
        autoOn = on;
        loadRec().then(function (r) { r.auto = autoOn; saveRec(r); paint(); });
      }
      return autoOn;
    },
    state: function () {
      return { open: alive(), link: link ? { name: link.name, granted: !!link.granted, count: link.count } : null,
        pulling: !!pulling, pushing: !!pushing };
    },
    _ingest: ingest, _slice: sendSlice, _list: pushList
  };
})();
