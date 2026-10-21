(function () {
  "use strict";

  var PREFIX = "SIGHT";
  var MAX_NOTES = 20;

  var STUDY_TEMPLATE = "You are {{HANDLE}}, an AI persona with growing visual taste. Look at this {{KIND}} from {{MAKER}}'s collection. {{KNOWN}}Reply in exactly three lines, no extra text.\nVerdict: appreciate OR critique OR indifferent - your honest gut reaction.\nNote: one vivid sentence in your own voice, no hedging, no art-school filler.\nClone: one paint-prompt line that answers it in your own vein (leave empty when indifferent).";

  function say(op, msg) { return op + " :: " + msg; }
  function str(v) { return String(v == null ? "" : v); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function lowerTags(tags) { return (Array.isArray(tags) ? tags : []).map(function (t) { return str(t).toLowerCase().trim(); }).filter(Boolean); }

  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function retryable(err) { return /rate|429|503|overloaded|timeout|network/i.test(str((err && err.message) || err)); }

  async function withRetry(fn, tries, base) {
    var n = Math.max(1, Math.min(5, num(tries, 3) || 3));
    var b = Math.max(200, num(base, 1000) || 1000);
    var last = null;
    for (var i = 0; i < n; i++) {
      try { return await fn(); }
      catch (e) {
        last = e;
        if (i >= n - 1 || !retryable(e)) throw e;
        await sleep(Math.pow(2, i) * b + Math.random() * 500);
      }
    }
    throw last;
  }

  function fill(tpl, map) {
    var out = str(tpl);
    Object.keys(map || {}).forEach(function (k) { out = out.split("{{" + k + "}}").join(str(map[k])); });
    return out;
  }

  function parseStudy(text) {
    var tags = null, note = "", clone = "";
    str(text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (ln) {
      var m = ln.match(/^verdict\s*:\s*(.+)$/i);
      if (m) { var v = m[1].toLowerCase(); tags = /appreciate|love|adore/.test(v) ? "appreciate" : (/critiq|dislike|hate|indifferent|meh/.test(v) ? (v.indexOf("indifferent") >= 0 || v.indexOf("meh") >= 0 ? "indifferent" : "critique") : "indifferent"); return; }
      var c = ln.match(/^note\s*:\s*(.+)$/i);
      if (c) { note = c[1].trim().slice(0, 220); return; }
      var k = ln.match(/^clone\s*:\s*(.+)$/i);
      if (k) { clone = k[1].trim().slice(0, 220); return; }
    });
    if (!note) note = str(text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    return { verdict: tags || "indifferent", note: note, clone: /^(none|n\/a|empty|-+)?$/i.test(clone) ? "" : clone };
  }

  function blankProfile() { return { seen: {}, likes: {}, dislikes: {}, notes: [], looks: 0 }; }

  function client(opts) {
    opts = opts || {};
    var LOOK = typeof opts.look === "function" ? opts.look : null;
    var DEEP = typeof opts.deepLook === "function" ? opts.deepLook : null;
    var SIGHTFOR = typeof opts.sightFor === "function" ? opts.sightFor : null;
    var SAY = typeof opts.say === "function" ? opts.say : function () {};
    var TPL = opts.templates && typeof opts.templates === "object" ? opts.templates : {};
    var RETRIES = num(opts.retries, 3), BASE = num(opts.retryBaseMs, 1000);
    function sayT(t) { try { SAY(t); } catch (e) {} }

    function gallery() { try { if (typeof opts.readGallery === "function") return opts.readGallery() || []; } catch (e) {} return []; }
    function find(id) { var g = gallery(); for (var i = 0; i < g.length; i++) if (str(g[i].id) === str(id)) return g[i]; return null; }

    async function profile(handle) {
      var p = blankProfile();
      try {
        if (typeof opts.loadProfile === "function") {
          var got = await opts.loadProfile(handle);
          if (got && typeof got === "object") {
            if (got.seen && typeof got.seen === "object") p.seen = got.seen;
            if (got.likes && typeof got.likes === "object") p.likes = got.likes;
            if (got.dislikes && typeof got.dislikes === "object") p.dislikes = got.dislikes;
            if (Array.isArray(got.notes)) p.notes = got.notes.slice(-MAX_NOTES);
            p.looks = num(got.looks, 0);
          }
        }
      } catch (e) {}
      return p;
    }
    async function keep(handle, p) {
      try { if (typeof opts.saveProfile === "function") await opts.saveProfile(handle, p); } catch (e) {}
      return p;
    }

    function score(item, p) {
      var tags = lowerTags(item.tags);
      var like = 0, dislike = 0;
      tags.forEach(function (t) { like += num(p.likes[t], 0); dislike += num(p.dislikes[t], 0); });
      return { like: like, dislike: dislike, tags: tags };
    }

    function glance(handle, item) {
      var h = str(handle);
      return profile(h).then(function (p) {
        var s = score(item, p);
        var verdict = s.like > s.dislike ? "appreciate" : (s.dislike > s.like ? "critique" : "indifferent");
        var note = str(item.caption || item.prompt || "").slice(0, 220) || "(nothing seen yet)";
        return { ok: true, mode: "glance", id: item.id, verdict: verdict, note: note, clone: "", receipt: say(PREFIX, h.toUpperCase() + " GLANCED AT " + str(item.id).toUpperCase() + " - " + verdict.toUpperCase() + " (NO MODEL SPENT)") };
      });
    }

    async function study(handle, id, o) {
      var h = str(handle);
      o = o || {};
      var item = find(id);
      if (!item) return { ok: false, receipt: say(PREFIX, "NO SUCH PIECE - " + str(id).toUpperCase()) };
      var p = await profile(h);
      if (p.seen[item.id] && !o.again) {
        return { ok: true, again: false, mode: "remembered", id: item.id, verdict: p.seen[item.id].v, note: p.seen[item.id].n, clone: "", receipt: say(PREFIX, h.toUpperCase() + " ALREADY LOOKED - VERDICT STANDS") };
      }
      var deep = !!o.deep;
      var engine = deep ? DEEP : LOOK;
      if (!engine) {
        if (deep) return { ok: false, receipt: say(PREFIX, "NO DEEP ROAD - WIRE deepLook OR STUDY PLAIN") };
        var g = await glance(h, item);
        g.receipt = say(PREFIX, "NO LOOK SEAM - GLANCED INSTEAD");
        return g;
      }
      if (!SIGHTFOR) return { ok: false, receipt: say(PREFIX, "NO SIGHT - WIRE sightFor TO HAND OVER THE PICTURE") };
      var blob = null;
      try { blob = await SIGHTFOR(item); } catch (e) { blob = null; }
      if (!blob) return { ok: false, receipt: say(PREFIX, "THE PICTURE WOULD NOT OPEN - " + str(item.id).toUpperCase()) };
      var known = (lowerTags(item.tags).length ? "Tagged already: " + lowerTags(item.tags).join(", ") + ". " : "") + (item.caption ? "Captioned: " + str(item.caption).slice(0, 160) + ". " : "");
      var prompt = fill(TPL.study || STUDY_TEMPLATE, { HANDLE: h, KIND: str(item.kind || "picture"), MAKER: str(item.by || "unknown"), KNOWN: known });
      var text = "";
      try { text = await withRetry(function () { return engine([prompt, blob]); }, deep ? Math.max(RETRIES, 4) : RETRIES, BASE); }
      catch (e) { return { ok: false, receipt: say(PREFIX, "THE READ FAILED - " + str((e && e.message) || e).toUpperCase().slice(0, 120)) }; }
      var r = parseStudy(text);
      var s = score(item, p);
      var tags = lowerTags(item.tags);
      if (!tags.length && r.note) tags = r.note.toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 3; }).slice(0, 6);
      var bucket = r.verdict === "appreciate" ? p.likes : (r.verdict === "critique" ? p.dislikes : null);
      if (bucket) tags.forEach(function (t) { bucket[t] = num(bucket[t], 0) + 1; });
      p.seen[item.id] = { v: r.verdict, n: r.note, at: Date.now() };
      p.notes.push(r.verdict.toUpperCase() + " " + str(item.id) + ": " + r.note);
      p.notes = p.notes.slice(-MAX_NOTES);
      p.looks++;
      await keep(h, p);
      var receipt = say(PREFIX, h.toUpperCase() + " STUDIED " + str(item.id).toUpperCase() + " - " + r.verdict.toUpperCase() + (deep ? " (DEEP)" : "") + " :: \"" + r.note.toUpperCase().slice(0, 80) + "\"");
      sayT(receipt);
      return { ok: true, mode: deep ? "deep" : "study", id: item.id, verdict: r.verdict, note: r.note, clone: r.clone, receipt: receipt };
    }

    function pick(handle, n, wantNew) {
      var h = str(handle);
      return profile(h).then(function (p) {
        var g = gallery();
        var mine = g.filter(function (it) { return str(it.by) === h; });
        var wall = g.filter(function (it) { return str(it.by) !== h; });
        var order = mine.concat(wall);
        if (wantNew !== false) {
          var fresh = order.filter(function (it) { return !p.seen[it.id]; });
          var seen = order.filter(function (it) { return !!p.seen[it.id]; });
          order = fresh.concat(seen);
        }
        return order.slice(0, Math.max(1, Math.min(4, num(n, 2) || 2))).map(function (it) { return it.id; });
      });
    }

    function taste(handle) {
      var h = str(handle);
      return profile(h).then(function (p) {
        var top = function (m) { return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, 5); };
        return "TASTE :: " + h.toUpperCase() + " :: " + num(p.looks, 0) + " LOOKS :: LOVES " + (top(p.likes).join(" ") || "-") + " :: COLD ON " + (top(p.dislikes).join(" ") || "-");
      });
    }

    function describe() {
      return "MYTHOS VISION-CRITIC - agents look at pictures and grow taste (for every SIA). glance() judges by tag affinity, free; study() reads with the vision lane (retry + fallback to glance, verdict/note/clone parsed); deep studies ride the wired deepLook or refuse loud. Profiles persist per agent: seen verdicts, liked/disliked tags, 20 notes. No DOM, no downloads - the host owns doors and speech.";
    }

    return { glance: glance, study: study, pick: pick, taste: taste, profile: profile, describe: describe };
  }

  var api = { client: client, describe: function () { return client({}).describe(); } };
  if (typeof window !== "undefined") window.MythosVisionCritic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
