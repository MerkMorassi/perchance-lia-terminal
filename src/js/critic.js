(function () {
  "use strict";

  /* ---- HER TAKE (src/js/critic.js, over the sia-vision-critic-chip) -----------------
     The house slot for the vision-critic chip: the chip judges and remembers, this
     module owns the doors. HER TAKE on the full stage + /critic study a picture, and
     she answers in her own critical voice - a verdict, one sentence, and a clone
     paint-prompt filed on the record. Studies spend ONE vision call each and are
     BY HAND ONLY (no watcher - a watcher would spend quota behind his back).
     Glances are free (tag affinity, never the model) and say so on the receipt.
     --------------------------------------------------------------------------- */

  var FOLDER = "lia_settings", KEY = "critic";
  var busy = false;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { if (typeof window.print === "function") window.print("SYSTEM", t); } catch (e) {} }

  function agent() {
    try {
      var r = (window.roles && typeof window.roles.current === "function") ? window.roles.current() : null;
      if (r && (r.title || r.id)) return String(r.title || r.id);
    } catch (e) {}
    return "LIA";
  }

  function handle() { return String(agent() || "LIA").slice(0, 24); }

  // The vision lane, chip-shaped: [prompt, blob] in, her words out. No startWith -
  // the chip parses an exact three-line shape and a forced opening would corrupt it.
  function look(parts) {
    var g = (window.root && typeof window.root.generateText === "function") ? window.root.generateText : null;
    if (!g) return Promise.reject(new Error("NO TEXT LANE ON THIS PAGE"));
    return Promise.resolve(g({ instruction: parts })).then(function (out) {
      return String((out && out.text) || out || "");
    });
  }

  function usableImage(rec) {
    if (!rec || !rec.blob) return false;
    var m = String(rec.mime || "");
    if (/^audio\//.test(m)) return false;
    if (/^video\//.test(m)) return false;
    return true;
  }

  // Picture bytes for the lane, modest-sized: the same downsampling road autotag
  // walks (lib, not a second copy of it). Clips and recordings refuse - the chip
  // says so loud, and the stage button never offers them in the first place.
  async function sightFor(item) {
    try {
      var M = window.media;
      if (!M || typeof M.get !== "function") return null;
      var rec = M.get(item && item.id);
      if (!usableImage(rec)) return null;
      var mod = await import("../lib/autotag.js");
      if (!mod || typeof mod.fileToVisionBlob !== "function") return null;
      return await mod.fileToVisionBlob(rec.blob);
    } catch (e) { return null; }
  }

  function readGallery() {
    var out = [];
    try {
      var M = window.media;
      if (!M || typeof M.list !== "function") return out;
      var ids = M.list() || [];
      for (var i = 0; i < ids.length; i++) {
        var rec = null;
        try { rec = M.get(ids[i]); } catch (e) { rec = null; }
        if (!rec) continue;
        var mime = String(rec.mime || "");
        out.push({
          id: ids[i],
          kind: String(rec.kind || (/^video\//.test(mime) ? "clip" : (/^audio\//.test(mime) ? "voice" : "picture"))),
          tags: Array.isArray(rec.tags) ? rec.tags.slice() : [],
          caption: String(rec.sight || rec.caption || ""),
          prompt: String(rec.prompt || rec.name || ""),
          by: String(rec.by || (rec.kind === "gen" ? "LIA" : "HITL"))
        });
      }
    } catch (e) {}
    return out;
  }

  async function loadProfile(h) {
    var k = kv(), all = {};
    try { if (k) all = (await k.get(KEY)) || {}; } catch (e) { all = {}; }
    var p = all[String(h)] || null;
    return (p && typeof p === "object") ? p : null;
  }

  async function saveProfile(h, v) {
    var k = kv();
    if (!k) return;
    try {
      var all = (await k.get(KEY)) || {};
      all[String(h)] = v;
      await k.set(KEY, all);
    } catch (e) {}
  }

  var clientP = null;
  function client() {
    if (clientP) return clientP;
    clientP = (async function () {
      if (!window.MythosVisionCritic || typeof window.MythosVisionCritic.client !== "function") {
        throw new Error("THE CRITIC CHIP IS OFFLINE (src/chips/sia-vision-critic-chip/ DID NOT LOAD).");
      }
      return window.MythosVisionCritic.client({
        look: look, deepLook: null, sightFor: sightFor, readGallery: readGallery,
        loadProfile: loadProfile, saveProfile: saveProfile, say: say
      });
    })();
    clientP.catch(function () { clientP = null; });
    return clientP;
  }

  // Words to a record: newest vault picture filed under #tag, the exact id, or
  // whose prompt/name/sight carries the words. Clips and recordings never match
  // (she takes pictures, not clips - a clip's still is read by /see).
  function resolve(query) {
    var q = String(query == null ? "" : query).replace(/\s+/g, " ").trim();
    if (!q) return null;
    var M = window.media;
    if (!M || typeof M.list !== "function") return null;
    var ids = (M.list() || []).slice();
    var i, rec;
    for (i = 0; i < ids.length; i++) {
      try { if (String(ids[i]) === q) { rec = M.get(ids[i]); if (rec && usableImage(rec)) return ids[i]; } } catch (e) {}
    }
    if (q.charAt(0) === "#") {
      var tag = q.slice(1).toLowerCase();
      for (i = ids.length - 1; i >= 0; i--) {
        try {
          rec = M.get(ids[i]);
          if (rec && usableImage(rec) && (rec.tags || []).some(function (t) { return String(t).toLowerCase() === tag; })) return ids[i];
        } catch (e) {}
      }
      return null;
    }
    var low = q.toLowerCase();
    for (i = ids.length - 1; i >= 0; i--) {
      try {
        rec = M.get(ids[i]);
        if (!rec || !usableImage(rec)) continue;
        var hay = String(rec.prompt || "") + " " + String(rec.name || "") + " " + String(rec.sight || "");
        if (hay.toLowerCase().indexOf(low) !== -1) return ids[i];
      } catch (e) {}
    }
    return null;
  }

  function fileTake(id, h, r) {
    try {
      var M = window.media;
      if (M && typeof M.setField === "function") {
        M.setField(id, "critic", { v: r.verdict, n: r.note, clone: r.clone || "", by: h, ts: Date.now() });
      }
    } catch (e) {}
    // THE STAGE READS IT BACK (THE SCREENING TANDEM): the meta line names her take, so a study
    // on the open record repaints the stage in place - the walk and her mark kept.
    try { if (window.screening && typeof window.screening.refresh === "function") window.screening.refresh(id); } catch (e) {}
  }

  async function study(query, opts) {
    opts = opts || {};
    if (busy) return "HER TAKE :: SHE IS ALREADY LOOKING - LET THAT READ LAND FIRST.";
    var id = resolve(query);
    if (!id) return "HER TAKE :: NO PICTURE FOUND FOR " + String(query || "(NOTHING NAMED)").toUpperCase().slice(0, 48) + " - NAME AN ID, A #TAG, OR WORDS FROM ITS PROMPT.";
    var h = handle(), c = null;
    try { c = await client(); }
    catch (e) { return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160); }
    busy = true;
    say("HER TAKE :: " + h.toUpperCase() + " IS LOOKING AT " + String(id).toUpperCase().slice(0, 24) + " - ONE VISION CALL, READ ONCE ...");
    try {
      var r = await c.study(h, id, { again: !!opts.again, deep: !!opts.deep });
      if (!r || !r.ok) return String((r && r.receipt) || "HER TAKE :: THE READ FAILED.");
      fileTake(id, h, r);
      if (r.clone) say("HER TAKE :: THE CLONE PROMPT IS FILED ON THE RECORD - " + r.clone.toUpperCase().slice(0, 120));
      return r.receipt;
    } catch (e) {
      return "HER TAKE :: THE READ FAILED - " + String((e && e.message) || e).toUpperCase().slice(0, 140);
    } finally { busy = false; }
  }

  async function glance(query) {
    var M = window.media;
    if (!M) return "HER TAKE :: THE VAULT IS NOT LOADED HERE.";
    var id = resolve(query);
    if (!id) return "HER TAKE :: NO PICTURE FOUND FOR " + String(query || "(NOTHING NAMED)").toUpperCase().slice(0, 48) + ".";
    var h = handle(), c = null;
    try { c = await client(); }
    catch (e) { return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160); }
    var rec = null;
    try { rec = M.get(id); } catch (e) { rec = null; }
    if (!rec) return "HER TAKE :: NO SUCH RECORD.";
    var rows = readGallery();
    var item = null;
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) { item = rows[i]; break; }
    if (!item) return "HER TAKE :: NO SUCH RECORD.";
    try {
      var g = await c.glance(h, item);
      return String((g && g.receipt) || "HER TAKE :: NO READ.");
    } catch (e) {
      return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160);
    }
  }

  async function taste(who) {
    var h = String(who || handle() || "LIA").replace(/\s+/g, " ").trim().slice(0, 24) || "LIA";
    var c = null;
    try { c = await client(); }
    catch (e) { return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160); }
    try { return await c.taste(h); }
    catch (e) { return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160); }
  }

  async function pick(n) {
    var h = handle(), c = null;
    try { c = await client(); }
    catch (e) { return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160); }
    try {
      var ids = await c.pick(h, n, true);
      if (!ids || !ids.length) return "HER TAKE :: THE VAULT IS EMPTY - NOTHING TO CHOOSE FROM.";
      return "HER TAKE :: " + h.toUpperCase() + " WOULD LOOK AT " + ids.join(" + ").toUpperCase() + " - /critic study <ID> READS ONE.";
    } catch (e) {
      return "HER TAKE :: " + String((e && e.message) || e).toUpperCase().slice(0, 160);
    }
  }

  function status() {
    var n = 0;
    try { n = (window.media && typeof window.media.list === "function") ? window.media.list().length : 0; } catch (e) {}
    return "HER TAKE :: THE CRITIC LANE IS UP - " + handle().toUpperCase() + " LOOKS BY HAND, ONE VISION CALL A STUDY, GLANCES FREE. " + n + " RECORDS IN THE VAULT. /critic study <ID|#TAG|WORDS> READS ONE PICTURE; HER TAKE ON THE FULL STAGE READS THE ONE OPEN.";
  }

  // THE STAGE SLOT: HER TAKE beside KEEP on the full stage. Pictures only - a
  // clip or a recording hides it (she takes pictures; a clip's still is /see's).
  function paintStage(id) {
    var b = document.getElementById("lightboxCriticBtn");
    if (!b) return;
    var show = false;
    try {
      var M = window.media;
      var rec = (M && typeof M.get === "function") ? M.get(id) : null;
      show = !!(rec && usableImage(rec));
    } catch (e) { show = false; }
    b.hidden = !show;
    if (show) b.__criticId = id;
    if (show && !b.__criticWired) {
      b.__criticWired = true;
      b.addEventListener("click", function () {
        var open = b.__criticId || id;
        say("HER TAKE :: READING THE ONE ON THE STAGE ...");
        study(open, {}).then(function (t) { say(t); }, function (e) { say("HER TAKE FAILED :: " + String((e && e.message) || e)); });
      });
    }
  }

  async function words(arg) {
    var raw = String(arg || "").trim();
    var t = raw.toLowerCase();
    if (!t || t === "status") return status();
    if (t.indexOf("study ") === 0) {
      var rest = raw.replace(/^study\s+/i, "").trim();
      var again = /\bagain\b/i.test(rest);
      rest = rest.replace(/\bagain\b/i, "").trim();
      var deep = /\bdeep\b/i.test(rest);
      rest = rest.replace(/\bdeep\b/i, "").trim();
      if (!rest) return "HER TAKE :: NAME A PICTURE - /critic study <ID, #TAG OR WORDS FROM ITS PROMPT> - ONE VISION CALL.";
      return await study(rest, { again: again, deep: deep });
    }
    if (t.indexOf("glance ") === 0) {
      var gq = raw.replace(/^glance\s+/i, "").trim();
      if (!gq) return "HER TAKE :: NAME A PICTURE - /critic glance <ID, #TAG OR WORDS> - FREE, NO MODEL SPENT.";
      return await glance(gq);
    }
    if (t.indexOf("taste") === 0) {
      var who = raw.replace(/^taste/i, "").trim();
      return await taste(who || null);
    }
    if (t.indexOf("pick") === 0) {
      var n = parseInt(raw.replace(/^pick/i, "").trim(), 10);
      return await pick(isFinite(n) ? n : 2);
    }
    return "HER TAKE :: /critic study <ID|#TAG|WORDS> [again] - ONE VISION CALL, HER VERDICT + NOTE + CLONE FILED ON THE RECORD | /critic glance <...> - FREE | /critic taste - WHAT SHE LOVES AND WHAT LEAVES HER COLD | /critic pick [N] - WHAT SHE WOULD LOOK AT NEXT | /critic status.";
  }

  function describe() {
    return ["HER TAKE :: the critic lane - her critical voice, grown from what she sees (the sia-vision-critic-chip, by hand, never a watcher).",
      "  HER TAKE on the full stage reads the picture open: one vision call, her verdict (appreciate / critique / indifferent), one sentence in her own voice, and a clone paint-prompt answering it in her vein. All three file on the record (her take: ...) and print as SYSTEM - never a faked turn of hers.",
      "  /critic study <ID, #TAG OR WORDS> reads one picture by name the same way; again re-reads a verdict that stands; glance is the free affinity read (no model spent); taste says what she loves and what leaves her cold; pick names what she would look at next.",
      "  The open stage reads back what she files: a study on the record in front of you repaints the full stage in place, and the screening tandem (/screen) tells her what is on it so the two of you can review it together - her hand on it is a STAGE line.",
      "  Taste is per-agent and kept on this device (kv lia_settings/critic) - tag likes and dislikes, 20 notes, seen verdicts. A repeat study returns the standing verdict unless again. Deep studies refuse loud (no second-model road in this house)."].join("\n");
  }

  window.critic = {
    study: study, glance: glance, taste: taste, pick: pick, status: status,
    paintStage: paintStage, resolve: resolve, words: words, describe: describe
  };
})();
