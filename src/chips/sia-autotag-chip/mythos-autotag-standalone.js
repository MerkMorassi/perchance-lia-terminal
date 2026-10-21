window.MythosAutotag = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
var LINES = [];
function say(t) { var s = String(t == null ? "" : t); LINES.push(s); try { if (opts.say) opts.say(s); } catch (e) {} }
var MEDIA = opts.media || HOST.media || null;
var DESCRIBE = opts.describe || null;
if (!DESCRIBE && HOST.root && typeof HOST.root.generateText === "function") { (function (g) { DESCRIBE = function (parts) { return g({ instruction: parts, startWith: "Tags:" }); }; })(HOST.root.generateText.bind(HOST.root)); }
var STORE = (opts.store && typeof opts.store.get === "function") ? opts.store : null;
var MEM = { enabled: true };
var enabled = true, loaded = false, busy = false, queue = [];
async function load() { if (loaded) return; loaded = true; try { var v = STORE ? await STORE.get() : MEM; if (v && typeof v.enabled === "boolean") enabled = v.enabled; } catch (e) {} }
async function save() { try { if (STORE) await STORE.set({ enabled: enabled }); else MEM.enabled = enabled; } catch (e) {} }
const AUTOTAG_SPEC =
  "You tag media for a personal library. Look at the attached picture and reply with exactly two lines. " +
  "Tags: a comma-separated list of 4 to 10 short lowercase tags naming what is visible (subjects, setting, colors, mood, medium). No sentences, no extra words. " +
  "Caption: one plain sentence under 20 words saying what the picture shows.";
const AUTOTAG_VIDEO_TAIL = "The picture is a contact sheet of frames from one video, left to right in time.";

const defaultDescribe = async parts => { if (DESCRIBE) return DESCRIBE(parts); throw new Error("AUTOTAG REFUSED :: NO VISION ENGINE - PASS describe: IN client()."); };

function parseTagResponse(text) {
  const lines = String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let tags = [], caption = "";
  for (const ln of lines) {
    const m = ln.match(/^tags?\s*:\s*(.+)$/i);
    if (m && !tags.length) {
      tags = m[1].split(",").map(w => w.trim().toLowerCase().replace(/^#/, "")).filter(w => w && w.length <= 30).slice(0, 10);
      continue;
    }
    const c = ln.match(/^caption\s*:\s*(.+)$/i);
    if (c && !caption) { caption = c[1].trim().slice(0, 160); continue; }
  }
  if (!tags.length && lines.length) {
    const first = lines[0].replace(/^tags?\s*:\s*/i, "");
    if (first.split(",").length >= 3) tags = first.split(",").map(w => w.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    else caption = caption || lines.join(" ").slice(0, 160);
  }
  return { tags: tags, caption: caption };
}

const loadImg = src => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => rej(new Error("autotag: cannot decode image"));
  im.src = src;
});

const canvasBlob = cv => new Promise((res, rej) => {
  if (cv.toBlob) cv.toBlob(b => (b ? res(b) : rej(new Error("autotag: encode failed"))), "image/png");
  else rej(new Error("autotag: canvas unsupported"));
});

// Any image source (File/Blob/url/data:) -> a modest PNG Blob the vision call accepts.
async function fileToVisionBlob(src, fetchFn) {
  let blob = null;
  if (src instanceof Blob) blob = src;
  else if (typeof src === "string") {
    if (/^data:/i.test(src)) blob = await (await fetch(src)).blob();
    else blob = await ((fetchFn || fetch)(src)).then(r => r.blob());
  } else throw new Error("autotag: need a Blob or URL");
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImg(url);
    const scale = Math.min(1, 768 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round((im.naturalWidth || 1) * scale));
    cv.height = Math.max(1, Math.round((im.naturalHeight || 1) * scale));
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return await canvasBlob(cv);
  } finally {
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  }
}

// Grab `count` stills across a clip. Returns PNG Blobs (possibly fewer than asked).
async function sampleVideoFrames(src, opts) {
  opts = opts || {};
  const count = Math.max(1, Math.min(4, opts.count || 4));
  const url = (src instanceof Blob) ? URL.createObjectURL(src) : src;
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  if (src instanceof Blob) v.src = url;
  else v.src = url;
  const frames = [];
  const done = () => { try { v.removeAttribute("src"); v.load(); } catch (e) {} if (src instanceof Blob) setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000); };
  try {
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error("autotag: video metadata timeout")), 20000);
      v.onloadedmetadata = () => { clearTimeout(to); res(); };
      v.onerror = () => { clearTimeout(to); rej(new Error("autotag: cannot load video")); };
    });
    const dur = v.duration && isFinite(v.duration) ? v.duration : 0;
    const W = opts.width || 384;
    for (let i = 0; i < count; i++) {
      const t = dur ? (dur * (0.1 + (0.8 * i) / Math.max(1, count - 1))) : 0;
      try {
        await new Promise((res, rej) => {
          const to = setTimeout(() => rej(new Error("seek timeout")), 12000);
          const on = () => { clearTimeout(to); v.removeEventListener("seeked", on); res(); };
          v.addEventListener("seeked", on);
          try { v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.05)); } catch (e) { clearTimeout(to); rej(e); }
        });
        const scale = W / (v.videoWidth || W);
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = Math.max(1, Math.round((v.videoHeight || W) * scale));
        cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
        frames.push(await canvasBlob(cv));
      } catch (e) { /* a missed seek just means fewer frames */ }
      if (!dur) break;
    }
  } catch (e) {
    if (!frames.length) { done(); throw e; }
  }
  done();
  return frames;
}

// Stills side by side, one picture, one vision call.
async function montage(frames) {
  const imgs = [];
  for (const b of frames) {
    const u = URL.createObjectURL(b);
    try { imgs.push(await loadImg(u)); } finally { setTimeout(() => { try { URL.revokeObjectURL(u); } catch (e) {} }, 4000); }
  }
  if (!imgs.length) throw new Error("autotag: no frames to montage");
  const H = 256;
  const scaled = imgs.map(im => ({ im: im, w: Math.max(1, Math.round(H * (im.naturalWidth || 1) / (im.naturalHeight || 1))) }));
  const cv = document.createElement("canvas");
  cv.width = scaled.reduce((a, s) => a + s.w, 0); cv.height = H;
  const cx = cv.getContext("2d");
  let x = 0;
  for (const s of scaled) { cx.drawImage(s.im, x, 0, s.w, H); x += s.w; }
  return canvasBlob(cv);
}

const guessKind = src => {
  const s = (src && src.type) ? src.type : String(src || "");
  if (/video/i.test(s) || /\.(mp4|webm|mov)(\?|$)/i.test(s)) return "video";
  return "image";
};

async function tagImage(src, opts) {
  opts = opts || {};
  const describe = opts.describe || defaultDescribe;
  if (opts.onStatus) { try { opts.onStatus("looking at the picture…"); } catch (e) {} }
  const blob = await fileToVisionBlob(src, opts.fetchFn);
  const text = await describe([AUTOTAG_SPEC, blob]);
  return parseTagResponse(text);
}

async function tagVideo(src, opts) {
  opts = opts || {};
  const describe = opts.describe || defaultDescribe;
  if (opts.onStatus) { try { opts.onStatus("sampling frames…"); } catch (e) {} }
  const frames = await sampleVideoFrames(src, { count: opts.frames || 4 });
  if (!frames.length) return { tags: [], caption: "", error: "no frames decoded" };
  let blob = frames[0], tail = null;
  if (frames.length > 1) { blob = await montage(frames); tail = AUTOTAG_VIDEO_TAIL; }
  if (opts.onStatus) { try { opts.onStatus("looking at the frames…"); } catch (e) {} }
  const parts = tail ? [AUTOTAG_SPEC, blob, tail] : [AUTOTAG_SPEC, blob];
  const text = await describe(parts);
  return parseTagResponse(text);
}

async function tagMedia(src, opts) {
  opts = opts || {};
  const kind = opts.kind || guessKind(src);
  if (kind === "video") return tagVideo(src, opts);
  return tagImage(src, opts);
}

var FOLDER = "lia_settings", KEY = "autotag";
  var enabled = true, loaded = false, busy = false, queue = [];
  function vision() {
    var r = HOST.root;
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
    var M = MEDIA;
    if (!M) return;
    var rec = null;
    try { rec = M.get(id); } catch (e) {}
    if (!rec) return;
    if (String(rec.sight || "").trim() && (rec.tags || []).length) return;
    var d = DESCRIBE ? function (parts) { return DESCRIBE(parts); } : null;
    if (!d) return;
    var out = await tagMedia(blob, { kind: kind, describe: d });
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
    if (!MEDIA || typeof MEDIA.onAdd !== "function" || MEDIA.__autotagWatched) return false;
    try { MEDIA.onAdd(onVaultAdd); } catch (e) { return false; }
    MEDIA.__autotagWatched = true;
    return true;
  }
  async function status() {
    await load();
    return "AUTOTAG :: " + (enabled ? "ON" : "OFF") + " - EVERY PICTURE AND CLIP ENTERING THE VAULT (IMPORTED, ATTACHED, OR MADE HERE) IS READ ONCE BY THE VISION LANE AND FILED WITH ITS TAGS AND ITS ONE-LINE SIGHT. /autotag on|off.";
  }
  
async function set(on) { await load(); enabled = !!on; await save(); say("AUTOTAG :: " + (enabled ? "ON." : "OFF - NOTHING NEW WILL BE READ.")); return enabled; }
function isOn() { return enabled; }
function pending() { return queue.length; }
async function status() { await load(); return "AUTOTAG :: " + (enabled ? "ON" : "OFF") + " - EVERY PICTURE AND CLIP ENTERING THE VAULT IS READ ONCE BY THE VISION LANE AND FILED WITH ITS TAGS AND ITS ONE-LINE SIGHT."; }
async function tagNow(id) { if (!MEDIA) return "THE VAULT IS NOT LOADED HERE."; var rec = null; try { rec = MEDIA.get(id); } catch (e) {} if (!rec) return "NO RECORD " + String(id || "").toUpperCase() + "."; var kind = null; try { kind = usable(rec); } catch (e) {} if (!kind) return "NOT A PICTURE OR A CLIP."; await load(); await tagOne(id, rec.blob, kind); return "AUTOTAG :: " + String(rec.name || id).toUpperCase() + " READ ONCE."; }
function onRecord(rec) { onVaultAdd(rec); }
function unwatch() { try { if (MEDIA && MEDIA.__mythosAutotagOff) MEDIA.__mythosAutotagOff(); } catch (e) {} }
return { load: load, watch: watch, unwatch: unwatch, onRecord: onRecord, status: status, set: set, isOn: isOn, pending: pending, tagNow: tagNow, tagMedia: tagMedia, tagImage: tagImage, tagVideo: tagVideo, parseTagResponse: parseTagResponse, fileToVisionBlob: fileToVisionBlob };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosAutotag;
