(function () {
  /* ---- THE KEEPER ------------------------------------------------------------
     THE USER DATA, KEPT ON A SCHEDULE. /backup keeps the SOURCE (main.pjs, index.html,
     every file under src/) and /export + /sync + /cloud carry the CONVERSATION out by hand -
     but nothing runs by itself, so a PURGE pressed by accident, a cleared profile, or a new
     machine takes the logs, the moods and the settings with no copy anywhere. This lane is the
     part that runs by itself:

       every 30 minutes (while the page lives) and whenever the tab is put away, it snapshots
       what this browser holds into kv, keeping the newest five: the archive log whole, every
       setting that is not a secret, and the vault's manifest (what pictures are held, not their
       bytes - the bytes ride /ldrive push and SAVE, never this).

       /keeper          this, and where the newest snapshot stands
       /keeper now      take one right now
       /keeper on|off   the schedule (on unless turned off; nothing is ever uploaded)
       /keeper export [n]  download a snapshot as JSON - the off-device copy
       /keeper restore <n> yes  write a snapshot back (a pre-restore snapshot is taken first,
                        settings merge in - nothing live is ever deleted - and the vault's
                        pictures are never touched: the manifest is inventory, not bytes)

     WHAT IT NEVER KEEPS: the key ring (kv lia_settings / api_keys - tokens stay where they
     are, never printed, never in a snapshot), the source zip (backup's own lane), and its own
     snapshots (a snapshot of snapshots is how a rotation eats itself).
     --------------------------------------------------------------------------- */

  "use strict";

  var FOLDER = "lia_settings";
  var IDX = "keeper";
  var KEEP_N = 5;
  var EVERY_MS = 30 * 60 * 1000;
  var MAX_BYTES = 50 * 1024 * 1024;
  var EXACT_SKIP = { "api_keys": 1, "backup_zip": 1, "keeper": 1 };
  var BLOB_PROPS = { blob: 1, data: 1, bytes: 1, objectUrl: 1, objectURL: 1, url: 1, src: 1, href: 1, buf: 1, buffer: 1 };

  var timer = null;
  var busy = null;
  var idxCache = null;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { if (typeof print === "function") print("SYSTEM", String(t)); } catch (e) {} }
  function age(at) {
    var s = Math.max(0, Math.round((Date.now() - (at || 0)) / 1000));
    if (s < 90) return s + "s AGO";
    if (s < 5400) return Math.round(s / 60) + " MIN AGO";
    return Math.round(s / 3600) + " H AGO";
  }
  function kb(n) { return Math.round((n || 0) / 1024) + " KB"; }

  function snapKey(at) { return "keeper_" + at; }
  function isSnapKey(k) { return /^keeper_\d+$/.test(String(k)); }

  async function loadIdx() {
    if (idxCache) return idxCache;
    var d = { auto: true, everyMs: EVERY_MS, keep: KEEP_N, runs: [], last: 0 };
    try {
      var k = kv();
      if (k) { var s = await k.get(IDX); if (s && typeof s === "object") d = Object.assign(d, s); }
    } catch (e) {}
    if (!Array.isArray(d.runs)) d.runs = [];
    // Repair the first build's index entries, which stored the settings/media objects themselves
    // instead of their counts (duplicate keys in one literal - the later key won, so the stored
    // snapshots are whole; only the index was bloated). Numbers pass through untouched.
    d.runs.forEach(function (r) {
      if (r && typeof r.settings === "object") r.settings = Object.keys(r.settings || {}).length;
      if (r && typeof r.media === "object") r.media = (r.media || []).length;
    });
    idxCache = d;
    return d;
  }
  async function saveIdx(d) {
    idxCache = d;
    try { var k = kv(); if (k) await k.set(IDX, d); } catch (e) {}
  }

  function isBinary(v) {
    try {
      if (v instanceof Blob) return "blob " + v.size;
      if (v instanceof ArrayBuffer) return "buffer " + v.byteLength;
      if (typeof Uint8Array !== "undefined" && v instanceof Uint8Array) return "bytes " + v.length;
    } catch (e) {}
    return null;
  }

  // A vault record with the picture taken out: every field that names, files, tags and dates
  // the picture stays, anything that IS the picture does not.
  function manifestOf(id, rec) {
    var m = { id: String(id) };
    if (!rec || typeof rec !== "object") return m;
    for (var k in rec) {
      if (!Object.prototype.hasOwnProperty.call(rec, k)) continue;
      if (BLOB_PROPS[k]) continue;
      var v = null;
      try { v = rec[k]; } catch (e) { continue; }
      var bin = (v && typeof v === "object") ? isBinary(v) : null;
      if (bin) { m[k] = "[" + bin + " - kept by /ldrive push and SAVE, not here]"; continue; }
      try { JSON.stringify(v); m[k] = v; }
      catch (e) { m[k] = "[unserialisable - not kept]"; }
    }
    return m;
  }

  async function collect() {
    var k = kv();
    if (!k) throw new Error("NO STORE ON THIS PAGE (kv IS MISSING) - NOTHING CAN BE KEPT.");
    var log = [];
    // The archive log lives in its own folder, not lia_settings: read it through root.
    try {
      var rk = window.root && window.root.kv;
      if (rk && rk.sacred_archive) log = (await rk.sacred_archive.get("master_log")) || [];
    } catch (e) { log = []; }
    var settings = {}, settingsKeys = [];
    try {
      var keys = await k.keys();
      for (var i = 0; i < keys.length; i++) {
        var name = String(keys[i]);
        if (EXACT_SKIP[name] || isSnapKey(name)) continue;
        var v = await k.get(keys[i]);
        if (v instanceof Blob) continue;   // a blob in settings is never kept here
        try { JSON.stringify(v); } catch (e) { continue; }
        settings[name] = v;
        settingsKeys.push(name);
      }
    } catch (e) {}
    var media = [], mediaNotes = [];
    try {
      var mk = (window.root && window.root.kv && window.root.kv.media) || null;
      if (mk) {
        var ids = await mk.keys();
        for (var j = 0; j < ids.length; j++) {
          var rec = null;
          try { rec = await mk.get(ids[j]); } catch (e) { rec = null; }
          media.push(manifestOf(ids[j], rec));
        }
      } else mediaNotes.push("no vault store on this page");
    } catch (e) { mediaNotes.push(String((e && e.message) || e).slice(0, 120)); }
    return { log: log || [], settings: settings, settingsKeys: settingsKeys, media: media, mediaNotes: mediaNotes };
  }

  async function snapshot(why) {
    if (busy) return busy;
    var run = (async function () {
      var d = await loadIdx();
      var c = await collect();
      var snap = { app: "LIA TERMINAL", kind: "keeper", version: 1, at: Date.now(), why: String(why || ""),
        turns: c.log.length, settingsN: c.settingsKeys.length, mediaN: c.media.length,
        log: c.log, settings: c.settings, media: c.media, mediaNotes: c.mediaNotes };
      var bytes = 0;
      try { bytes = JSON.stringify(snap).length; } catch (e) { bytes = 0; }
      if (bytes > MAX_BYTES) throw new Error("THE TREE TO KEEP IS " + kb(bytes) + " - PAST WHAT ONE SNAPSHOT HOLDS. /keeper export AND /ldrive push CARRY THE BIG PARTS OFF INSTEAD.");
      var k = kv();
      if (!k) throw new Error("NO STORE ON THIS PAGE - NOTHING KEPT.");
      await k.set(snapKey(snap.at), snap);
      d.runs.push({ at: snap.at, why: snap.why, turns: snap.turns, settings: snap.settingsN, media: snap.mediaN, bytes: bytes });
      d.runs.sort(function (a, b) { return a.at - b.at; });
      while (d.runs.length > (d.keep || KEEP_N)) {
        var drop = d.runs.shift();
        try { await k.delete(snapKey(drop.at)); } catch (e) {}
      }
      d.last = snap.at;
      await saveIdx(d);
      return { at: snap.at, turns: snap.turns, settings: snap.settingsN, media: snap.mediaN, bytes: bytes, kept: d.runs.length };
    })();
    busy = run;
    try { return await run; } finally { busy = null; }
  }

  async function getSnap(n) {
    var d = await loadIdx();
    if (!d.runs.length) throw new Error("NOTHING HAS BEEN KEPT YET - /keeper now TAKES ONE.");
    var i = (n == null || n === "") ? d.runs.length - 1 : Number(n);
    if (!isFinite(i) || Math.floor(i) !== i || i < 0 || i >= d.runs.length) {
      throw new Error("NO SNAPSHOT " + n + " - THERE " + (d.runs.length === 1 ? "IS 1" : "ARE " + d.runs.length) + " (0-" + (d.runs.length - 1) + "). /keeper SAYS THEM.");
    }
    var k = kv();
    var snap = k ? await k.get(snapKey(d.runs[i].at)) : null;
    if (!snap) throw new Error("SNAPSHOT " + i + " IS LISTED BUT ITS BYTES ARE GONE (THE BROWSER MAY HAVE CLEARED THIS SITE'S STORAGE) - /keeper now TAKES A FRESH ONE.");
    return { i: i, rec: d.runs[i], snap: snap };
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a);
    try { a.click(); } catch (e) {}
    window.setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (x) {} }, 6000);
  }

  function describe() {
    return ["THE KEEPER :: THE USER DATA, KEPT ON A SCHEDULE (src/js/keeper.js).",
      "  WHAT IT KEEPS, every " + Math.round(EVERY_MS / 60000) + " minutes and whenever the tab is put away, newest " + KEEP_N + " (device-local kv, never uploaded): the archive log whole (sacred_archive / master_log), every setting that is not a secret (lia_settings - moods, intercom, drafts, sync records), and the vault's manifest (what pictures are held, NEVER their bytes).",
      "  WHAT IT NEVER KEEPS: the key ring (api_keys - tokens stay put), the source zip (backup's own lane), its own snapshots. Picture bytes ride /ldrive push and SAVE.",
      "  /keeper · /keeper now · /keeper on|off · /keeper export [n] · /keeper restore <n> yes",
      "  A KEEPER EXPORT IS NOT A SAVE AND NOT A SOURCE BACKUP: /backup CARRIES THE CODE, /export json AND /sync CARRY THE CONVERSATION OUT BY HAND, AND ONLY THE EDITOR'S SAVE BUTTON PUTS THE CODE ON THE SERVER."].join("\n");
  }

  async function statusText() {
    var d = await loadIdx();
    var L = ["KEEPER :: " + (d.auto ? "ON" : "OFF") + " - every " + Math.round((d.everyMs || EVERY_MS) / 60000) + " min + when the tab is put away, newest " + (d.keep || KEEP_N) + ", device-local, never uploaded."];
    if (!d.runs.length) L.push("  NOTHING HAS BEEN KEPT YET - /keeper now TAKES ONE.");
    else d.runs.forEach(function (r, i) {
      L.push("  [" + i + "] " + age(r.at) + " (" + r.why + ") :: " + r.turns + " turns · " + r.settings + " settings · " + r.media + " pictures listed · " + kb(r.bytes));
    });
    L.push("  /keeper now · /keeper export [n] (the off-device copy) · /keeper restore <n> yes (writes back; a pre-restore snapshot is taken first; settings merge in, nothing live is deleted, pictures are never touched)");
    return L.join("\n");
  }

  async function words(arg) {
    var t = String(arg || "").trim();
    if (!t || /^(status|state|list|kept)$/i.test(t)) { var s = await statusText(); say(s); return s; }
    var low = t.toLowerCase();
    if (/^(help|\?|usage)$/.test(low)) { say(describe()); return describe(); }
    if (/^(now|take|snapshot|save)$/.test(low)) {
      try {
        var r = await snapshot("asked");
        var m = "KEEPER :: KEPT NOW :: " + r.turns + " turns · " + r.settings + " settings · " + r.media + " pictures listed (" + kb(r.bytes) + ") - newest of " + (await loadIdx()).runs.length + " on this device. /keeper export CARRIES IT OFF.";
        say(m); return m;
      } catch (e) { var em = "KEEPER :: NOT KEPT :: " + String((e && e.message) || e); say(em); return em; }
    }
    var m2 = low.match(/^(on|off|yes|no|true|false|1|0)$/);
    if (m2) {
      var d = await loadIdx();
      d.auto = /^(on|yes|true|1)$/.test(m2[1]);
      await saveIdx(d);
      armTimer();
      var om = "KEEPER :: THE SCHEDULE IS " + (d.auto ? "ON" : "OFF") + (d.auto ? " - every " + Math.round((d.everyMs || EVERY_MS) / 60000) + " min + when the tab is put away. NOTHING ALREADY KEPT IS THROWN AWAY." : " - NOTHING NEW WILL BE KEPT (nothing already kept is thrown away).");
      say(om); return om;
    }
    var ex = t.match(/^export(?:\s+(\d+))?$/i);
    if (ex) {
      try {
        var g = await getSnap(ex[1]);
        var name = "lia-terminal-keeper-" + g.rec.at + ".json";
        download(name, JSON.stringify({ app: "LIA TERMINAL", kind: "keeper-export", version: 1, exportedAt: Date.now(), snapshot: g.snap }));
        var xm = "KEEPER :: SNAPSHOT [" + g.i + "] IS ON ITS WAY DOWN (" + name + ") - THE OFF-DEVICE COPY. /keeper restore READS A KEPT ONE BACK, NOT THIS FILE.";
        say(xm); return xm;
      } catch (e) { var xe = "KEEPER :: NO EXPORT :: " + String((e && e.message) || e); say(xe); return xe; }
    }
    var rs = t.match(/^restore\s+(\d+)(\s+yes)?$/i);
    if (rs) {
      try {
        var g2 = await getSnap(rs[1]);
        if (!rs[2]) {
          var pv = "KEEPER :: SNAPSHOT [" + g2.i + "] (" + age(g2.rec.at) + ", " + g2.rec.turns + " turns · " + g2.rec.settings + " settings) WOULD BE WRITTEN BACK NOW - settings merge in (nothing live is deleted), the log is replaced whole, pictures are never touched."
            + "\n  SAY /keeper restore " + g2.i + " yes TO DO IT - A PRE-RESTORE SNAPSHOT IS TAKEN FIRST, SO THIS IS UNDOABLE.";
          say(pv); return pv;
        }
        var pre = null;
        try { pre = await snapshot("pre-restore"); } catch (e) { pre = null; }
        var k = kv();
        if (!k) throw new Error("NO STORE ON THIS PAGE.");
        var rk = (window.root && window.root.kv) || {};
        if (rk.sacred_archive) await rk.sacred_archive.set("master_log", g2.snap.log || []);
        var names = Object.keys(g2.snap.settings || {});
        var wrote = 0;
        for (var i = 0; i < names.length; i++) {
          var nm = String(names[i]);
          if (EXACT_SKIP[nm] || isSnapKey(nm)) continue;
          await k.set(nm, g2.snap.settings[names[i]]);
          wrote++;
        }
        var done = "KEEPER :: SNAPSHOT [" + g2.i + "] IS BACK :: the log (" + (g2.snap.log || []).length + " turns) + " + wrote + " settings written."
          + (pre ? " A PRE-RESTORE SNAPSHOT WAS TAKEN FIRST - /keeper restore " + ((await loadIdx()).runs.length - 1) + " yes UNDOES THIS." : " (NO PRE-RESTORE SNAPSHOT - THE STORE REFUSED IT.)")
          + " PICTURES UNTOUCHED (manifest only). RELOAD TO SEE EVERYTHING.";
        say(done); return done;
      } catch (e) { var re = "KEEPER :: NOT RESTORED :: " + String((e && e.message) || e); say(re); return re; }
    }
    var u = "USAGE: /keeper · /keeper now · /keeper on|off · /keeper export [n] · /keeper restore <n> yes\n" + describe();
    say(u); return u;
  }

  function armTimer() {
    try { if (timer) clearInterval(timer); } catch (e) {}
    timer = null;
    loadIdx().then(function (d) {
      if (!d.auto) return;
      var every = d.everyMs || EVERY_MS;
      timer = setInterval(function () {
        snapshot("tick").then(function () {}, function () {});
      }, every);
    }, function () {});
  }

  async function boot() {
    armTimer();
    try {
      var d = await loadIdx();
      if (d.auto && Date.now() - (d.last || 0) > (d.everyMs || EVERY_MS)) {
        snapshot("boot").then(function () {}, function () {});
      }
    } catch (e) {}
    try {
      var hide = function () { try { snapshot("hide"); } catch (e) {} };
      document.addEventListener("visibilitychange", function () { if (document.hidden) hide(); });
      window.addEventListener("pagehide", hide);
    } catch (e) {}
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);

  window.keeper = {
    words: words, describe: describe, status: statusText,
    snapshot: snapshot, restore: function (n) { return words("restore " + n); },
    load: loadIdx
  };
})();
