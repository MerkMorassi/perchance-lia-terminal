(function () {
  "use strict";
  var FOLDER = "lia_settings", KEY = "autotag";
  var enabled = true, loaded = false, busy = false, queue = [];
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {} }
  async function load() {
    if (loaded) return;
    loaded = true;
    var k = kv();
    if (!k) return;
    try { var v = await k.get(KEY); if (v && typeof v.enabled === "boolean") enabled = v.enabled; } catch (e) {}
  }
  async function save() { var k = kv(); if (!k) return; try { await k.set(KEY, { enabled: enabled }); } catch (e) {} }
  function vision() {
    var r = window.root;
    if (!r || typeof r.generateText !== "function") return null;
    return function (parts) { return r.generateText({ instruction: parts, startWith: "Tags:" }); };
  }
  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (queue.length) {
        var job = queue.shift();
        try { await tagOne(job.id, job.blob, job.kind); } catch (e) { console.warn("autotag: skipped " + job.id, e); }
      }
    } finally { busy = false; }
  }
  async function tagOne(id, blob, kind) {
    var M = window.media;
    if (!M) return;
    var rec = null;
    try { rec = M.get(id); } catch (e) {}
    if (!rec) return;
    if (String(rec.sight || "").trim() && (rec.tags || []).length) return;
    var mod = null;
    try { mod = await import("../lib/autotag.js"); } catch (e) { console.warn("autotag: lib did not load", e); return; }
    var d = vision();
    if (!d) return;
    var out = await mod.tagMedia(blob, { kind: kind, describe: d });
    if (!out || !((out.tags || []).length || out.caption)) return;
    var fresh = null;
    try { fresh = M.get(id); } catch (e) {}
    if (!fresh) return;
    for (var i = 0; i < (out.tags || []).length; i++) { try { await M.tag(id, out.tags[i]); } catch (e) {} }
    if (out.caption && !String(fresh.sight || "").trim()) { try { await M.setField(id, "sight", out.caption); } catch (e) {} }
    try { say("AUTOTAG :: " + String(fresh.name || id).toUpperCase().slice(0, 48) + " :: " + (out.tags || []).join(", ").toUpperCase() + (out.caption ? " :: \"" + out.caption.toUpperCase().slice(0, 80) + "\"" : "")); } catch (e) {}
  }
  function usable(rec) {
    if (!rec || !rec.blob) return null;
    var mime = String(rec.mime || ""), kind = String(rec.kind || "");
    if (/^audio\//.test(mime)) return null;
    if (/^video\//.test(mime) || kind === "video" || kind === "clip") return "video";
    return "image";
  }
  function onVaultAdd(rec) {
    if (!enabled) return;
    var kind = null;
    try { kind = usable(rec); } catch (e) { return; }
    if (!kind || !rec.blob) return;
    queue.push({ id: rec.id, blob: rec.blob, kind: kind });
    pump();
  }
  function watch() {
    if (!window.media || typeof window.media.onAdd !== "function" || window.media.__autotagWatched) return false;
    try { window.media.onAdd(onVaultAdd); } catch (e) { return false; }
    window.media.__autotagWatched = true;
    return true;
  }
  async function status() {
    await load();
    return "AUTOTAG :: " + (enabled ? "ON" : "OFF") + " - EVERY PICTURE AND CLIP ENTERING THE VAULT (IMPORTED, ATTACHED, OR MADE HERE) IS READ ONCE BY THE VISION LANE AND FILED WITH ITS TAGS AND ITS ONE-LINE SIGHT. /autotag on|off.";
  }
  window.autotag = {
    load: load,
    watch: watch,
    status: status,
    isOn: function () { return enabled; },
    set: async function (on) { await load(); enabled = !!on; await save(); say("AUTOTAG :: " + (enabled ? "ON." : "OFF - NOTHING NEW WILL BE READ.")); return enabled; },
    tagNow: async function (id) {
      var M = window.media;
      if (!M) return "THE VAULT IS NOT LOADED HERE.";
      var rec = null;
      try { rec = M.get(id); } catch (e) {}
      if (!rec) return "NO RECORD " + String(id || "").toUpperCase() + ".";
      var kind = usable(rec);
      if (!kind) return "NOT A PICTURE OR A CLIP.";
      await load();
      await tagOne(id, rec.blob, kind);
      return "AUTOTAG :: " + String(rec.name || id).toUpperCase() + " READ ONCE.";
    }
  };
  load().then(function () { watch(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { watch(); });
  else watch();
})();
