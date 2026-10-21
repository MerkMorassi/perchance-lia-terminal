window.MythosAuditor = (function () {
  "use strict";
  var SECRET_RE = /(key|token|secret|pass|sigil|hash|auth|bearer|session|keeper)/i;
  var EXPECT_SETTINGS = ["agegate","gatekeeper","wall","decks","duty","mood","role","role_text","roles_local","system","system_custom","idea","idea_extras","decks","checkin","audition","auditions","autotag","backup","capture_state","chatlog_meta","chatlog_policy","chatlog_origin","chatlog_marks","draft","live","hear","hers_wants","image_form","pose_book","recipe_book","gallery_view","pic_size","ui","log_time","log_font","sync","sync_cloud","pair","bridge","xlate","voice","story","spincode","shift","shift_log","shift_queue","petitions","pipeline","initiative","local","groq","wall","dms_summaries","rtfm_local","rtfm_draft","loaded_traits","local_traits","moodpack_local","archivax_log","unseen_sight","unseen_reads","upscale_local","vault","folders","api_keys"];
  function str(s) { return String(s == null ? "" : s); }
  function upper(s) { return str(s).toUpperCase(); }
  function uniq(a) { var o = [], i; for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) === -1) o.push(a[i]); return o; }
  function sayOf(opts) { return (opts && typeof opts.say === "function") ? opts.say : null; }
  function tell(opts, t) { var s = sayOf(opts); if (s) { try { s(t); } catch (e) {} } }
  function isSecret(k) { return SECRET_RE.test(str(k)); }
  function kindOf(v) {
    if (v === null || v === undefined) return "EMPTY";
    if (Array.isArray(v)) return "ARRAY[" + v.length + "]";
    var t = typeof v;
    if (t === "string") return "TEXT:" + v.length;
    if (t === "number" || t === "boolean") return t.toUpperCase();
    if (t === "object") {
      var n = 0;
      try { n = Object.keys(v).length; } catch (e) {}
      return "OBJECT{" + n + "}";
    }
    return t.toUpperCase();
  }
  async function readSettings(src) {
    if (src === undefined || src === null) return { keys: [], vals: {}, note: "NO SETTINGS SOURCE PASSED" };
    if (typeof src === "function") {
      var r;
      try { r = await src(); } catch (e) { return { keys: [], vals: {}, note: "SETTINGS FN REFUSED :: " + str((e && e.message) || e) }; }
      return readSettings(r);
    }
    if (typeof src === "object" && typeof src.entries === "function") {
      var pairs;
      try { pairs = await src.entries(); } catch (e) { return { keys: [], vals: {}, note: "SETTINGS entries() REFUSED :: " + str((e && e.message) || e) }; }
      var vals = {}, keys = [], i;
      if (!Array.isArray(pairs)) pairs = [];
      for (i = 0; i < pairs.length && i < 500; i++) {
        var k = str(pairs[i] && pairs[i][0] !== undefined ? pairs[i][0] : pairs[i] && pairs[i].key);
        if (!k) continue;
        keys.push(k);
        try { vals[k] = pairs[i][1] !== undefined ? pairs[i][1] : pairs[i].value; } catch (e) { vals[k] = null; }
      }
      return { keys: uniq(keys), vals: vals, note: "" };
    }
    if (typeof src === "object" && typeof src.keys === "function" && typeof src.get === "function") {
      var ks;
      try { ks = await src.keys(); } catch (e) { return { keys: [], vals: {}, note: "SETTINGS keys() REFUSED :: " + str((e && e.message) || e) }; }
      if (!Array.isArray(ks)) ks = [];
      var v2 = {}, out = [], j;
      for (j = 0; j < ks.length && j < 500; j++) {
        var kk = str(ks[j]);
        out.push(kk);
        try { v2[kk] = await src.get(ks[j]); } catch (e) { v2[kk] = null; }
      }
      return { keys: uniq(out), vals: v2, note: "" };
    }
    if (typeof src === "object" && typeof src.load === "function") {
      var snap;
      try { snap = await src.load(); } catch (e) { return { keys: [], vals: {}, note: "SETTINGS load() REFUSED :: " + str((e && e.message) || e) }; }
      return readSettings(snap);
    }
    if (typeof src === "object") {
      var ks2 = [], vv = {};
      try { ks2 = Object.keys(src); } catch (e) { ks2 = []; }
      var m;
      for (m = 0; m < ks2.length; m++) vv[ks2[m]] = src[ks2[m]];
      return { keys: uniq(ks2.map(str)), vals: vv, note: "" };
    }
    return { keys: [], vals: {}, note: "SETTINGS SOURCE IS NOT READABLE - PASS A PLAIN OBJECT, A kv FOLDER, OR A FN." };
  }
  function normManifest(m) {
    if (!m) return [];
    if (Array.isArray(m)) return m;
    if (Array.isArray(m.chips)) return m.chips;
    return [];
  }
  function normPresent(p) {
    if (!p) return { paths: [], map: null };
    if (Array.isArray(p)) return { paths: p.map(str), map: null };
    if (typeof p === "object" && !p.files && !p.paths) {
      var isMap = false, k;
      try { for (k in p) { if (p[k] && typeof p[k] === "object") { isMap = true; break; } } } catch (e) {}
      if (isMap) return { paths: [], map: p };
    }
    if (typeof p === "object" && Array.isArray(p.files)) return { paths: p.files.map(str), map: null };
    if (typeof p === "object" && Array.isArray(p.paths)) return { paths: p.paths.map(str), map: null };
    return { paths: [], map: null };
  }
  function filePresent(name, file, paths) {
    var i, n = str(file);
    for (i = 0; i < paths.length; i++) {
      var p = str(paths[i]);
      if (p === n) return true;
      if (p.slice(-(n.length + 1)) === "/" + n) return true;
      if (p.indexOf(str(name) + "/" + n) !== -1) return true;
    }
    return false;
  }
  function zipPresent(name, paths) {
    var i, z = str(name) + ".zip";
    for (i = 0; i < paths.length; i++) {
      var p = str(paths[i]);
      if (p === z) return true;
      if (p.slice(-(z.length + 1)) === "/" + z) return true;
      if (p.indexOf(z) !== -1) return true;
    }
    return false;
  }
  function client(rawOpts) {
    var opts = rawOpts || {};
    var expectSettings = Array.isArray(opts.expectSettings) ? opts.expectSettings.map(str) : EXPECT_SETTINGS.slice();
    function settingsText(snap, exp) {
      var L = [];
      var secs = snap.keys.filter(isSecret);
      L.push("SETTINGS :: " + snap.keys.length + " KEYS KEPT ON THIS DEVICE" + (snap.note ? " :: " + snap.note : "") + ".");
      if (secs.length) L.push("SECRETS :: " + secs.length + " SECRET-SHAPED KEYS (" + secs.map(upper).join(", ") + ") - MASKS ONLY, NOTHING PRINTED.");
      var missing = exp.filter(function (k) { return snap.keys.indexOf(k) === -1; });
      var extra = snap.keys.filter(function (k) { return exp.indexOf(k) === -1; });
      if (!snap.keys.length) {
        L.push("NO SETTINGS COULD BE READ - NOTHING TO COMPARE.");
        return { missing: missing, extra: extra, text: L.join("\n") };
      }
      var show = snap.keys.slice().sort();
      var capped = show.slice(0, 80);
      capped.forEach(function (k) {
        var v;
        try { v = snap.vals[k]; } catch (e) { v = null; }
        L.push("  " + (isSecret(k) ? "[SEALED] " : "") + k + " :: " + kindOf(v));
      });
      if (show.length > capped.length) L.push("  ... AND " + (show.length - capped.length) + " MORE.");
      L.push(missing.length ? "MISSING AGAINST THE HOUSE LIST (" + missing.length + ") :: " + missing.map(upper).join(", ") + "." : "NOTHING MISSING AGAINST THE HOUSE LIST (" + exp.length + " EXPECTED).");
      if (extra.length) L.push("BEYOND THE HOUSE LIST (" + extra.length + ") :: " + extra.slice(0, 20).map(upper).join(", ") + (extra.length > 20 ? " ... AND " + (extra.length - 20) + " MORE" : "") + ".");
      return { missing: missing, extra: extra, text: L.join("\n") };
    }
    function chipsText(chips, pres) {
      var L = [];
      if (!chips.length) return { ok: false, error: "NO MANIFEST - PASS manifest: chips.json OR ITS chips ARRAY.", text: "" };
      var missingFiles = [], missingZips = [], held = [], noZip = [], okCount = 0, i, j;
      var presentNames = [];
      for (i = 0; i < chips.length; i++) {
        var c = chips[i] || {};
        var name = str(c.name || c.id || "");
        if (!name) continue;
        if (str(c.status).toLowerCase() === "held") held.push(name);
        var files = Array.isArray(c.files) ? c.files : [];
        var zipBytes = Number(c.zipBytes || 0) || 0;
        var foundAny = false;
        if (pres.map) {
          foundAny = !!(pres.map[name]);
        } else if (pres.paths.length) {
          var k;
          for (k = 0; k < pres.paths.length; k++) if (str(pres.paths[k]).indexOf(name) !== -1) { foundAny = true; break; }
          if (!foundAny && !files.length && !zipBytes) foundAny = false;
        } else {
          foundAny = true;
        }
        if (foundAny) presentNames.push(name);
        var miss = [];
        if (pres.map && pres.map[name]) {
          var rec = pres.map[name];
          var have = Array.isArray(rec.files) ? rec.files.map(str) : (Array.isArray(rec.present) ? rec.present.map(str) : []);
          for (j = 0; j < files.length; j++) if (have.indexOf(str(files[j])) === -1) miss.push(str(files[j]));
          if (rec.zip === false && zipBytes > 0) miss.push(name + ".zip");
        } else if (pres.paths.length) {
          for (j = 0; j < files.length; j++) if (!filePresent(name, files[j], pres.paths)) miss.push(str(files[j]));
        }
        if (miss.length) missingFiles.push({ chip: name, files: miss });
        var hasZip;
        if (pres.map && pres.map[name]) hasZip = pres.map[name].zip !== false;
        else if (pres.paths.length) hasZip = zipPresent(name, pres.paths);
        else hasZip = zipBytes > 0;
        if (!hasZip) {
          missingZips.push(name);
          if (!(zipBytes > 0)) noZip.push(name);
        }
        if (!miss.length && hasZip) okCount++;
      }
      L.push("CHIPS :: " + chips.length + " IN THE MANIFEST" + (pres.paths.length ? ", " + presentNames.length + " SEEN IN THE TREE" : pres.map ? ", CHECKED AGAINST THE PASSED INVENTORY" : ", MANIFEST ONLY - NO TREE PASSED") + " :: " + okCount + " WHOLE.");
      if (held.length) L.push("HELD (" + held.length + ") :: " + held.map(upper).join(", ") + " - SHELVED IN THE VAULT, NOT LIVE.");
      if (missingFiles.length) {
        L.push("MISSING FILES (" + missingFiles.length + " CHIPS) ::");
        missingFiles.slice(0, 20).forEach(function (m) { L.push("  " + m.chip + " :: " + m.files.join(", ")); });
        if (missingFiles.length > 20) L.push("  ... AND " + (missingFiles.length - 20) + " MORE.");
      } else {
        L.push(pres.paths.length || pres.map ? "EVERY LISTED FILE IS PRESENT." : "FILES NOT CHECKED - PASS present: PATHS OR AN INVENTORY MAP TO VERIFY BYTES ON THE TREE.");
      }
      if (missingZips.length) L.push("NO ZIP (" + missingZips.length + ") :: " + missingZips.slice(0, 20).join(", ") + (missingZips.length > 20 ? " ... AND " + (missingZips.length - 20) + " MORE" : "") + " - RE-SHIP ON NEXT TOUCH.");
      else L.push("EVERY CHIP HAS ITS ZIP.");
      var specs = {};
      chips.forEach(function (c) { var s = str((c && c.spec) || "UNMARKED"); specs[s] = (specs[s] || 0) + 1; });
      L.push("SPEC :: " + Object.keys(specs).sort().map(function (s) { return s + " x" + specs[s]; }).join(", ") + ".");
      return { ok: true, total: chips.length, whole: okCount, held: held, missingFiles: missingFiles, missingZips: missingZips, text: L.join("\n") };
    }
    async function auditSettings() {
      var snap;
      try { snap = await readSettings(opts.settings); }
      catch (e) { return { ok: false, error: "SETTINGS REFUSED :: " + str((e && e.message) || e) }; }
      if (!snap.keys.length && snap.note) tell(opts, "AUDITOR :: " + snap.note + ".");
      var r = settingsText(snap, expectSettings);
      return { ok: snap.keys.length > 0, at: Date.now(), count: snap.keys.length, keys: snap.keys.slice().sort(), missing: r.missing, extra: r.extra, note: snap.note, text: r.text };
    }
    async function auditChips() {
      var chips = normManifest(opts.manifest);
      if (!chips.length && opts.manifestUrl && opts.doFetch) {
        try {
          var res = await (opts.doFetch)(opts.manifestUrl);
          var j = res && typeof res.json === "function" ? await res.json() : res;
          chips = normManifest(j);
        } catch (e) { return { ok: false, error: "MANIFEST COULD NOT BE READ :: " + str((e && e.message) || e) }; }
      }
      if (!chips.length) return { ok: false, error: "NO MANIFEST - PASS manifest: chips.json OR ITS chips ARRAY." };
      var pres = normPresent(opts.present);
      if (typeof opts.present === "function") {
        try {
          var pv = await opts.present();
          pres = normPresent(pv);
        } catch (e) { return { ok: false, error: "PRESENT FN REFUSED :: " + str((e && e.message) || e) }; }
      }
      var r = chipsText(chips, pres);
      if (!r.ok) return r;
      r.at = Date.now();
      return r;
    }
    async function audit() {
      var s = await auditSettings();
      var c = await auditChips();
      var ok = !!(s.ok && c.ok && !c.missingFiles.length);
      var L = [];
      L.push("THE AUDIT :: " + (ok ? "WHOLE - SETTINGS READ, EVERY CHIP ACCOUNTED FOR." : "SOMETHING WANTS ATTENTION - READ ON."));
      L.push("");
      L.push(s.text);
      L.push("");
      L.push(c.text || c.error || "");
      L.push("");
      L.push("ASKED AT " + new Date().toISOString() + " :: NOTHING WAS WRITTEN, UPLOADED OR CHANGED.");
      var text = L.join("\n");
      tell(opts, text);
      return { ok: ok, at: Date.now(), settings: s, chips: c, text: text };
    }
    return { audit: audit, auditSettings: auditSettings, auditChips: auditChips, EXPECT_SETTINGS: expectSettings.slice() };
  }
  return { client: client, EXPECT_SETTINGS: EXPECT_SETTINGS.slice() };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosAuditor;
