window.MythosVault = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var MAX_ATTACH = opts.maxAttach || 4;
  var TAG_MAX = opts.tagMax || 24;
  var FOLDER_SEGS = 4;
  var FOLDER_SEG_MAX = 24;
  var FALLBACK_FOLDERS = { image: "/images", music: "/music", vox: "/audio/vox", clip: "/clips", upscale: "/images/upscaled" };
  var MIME_BY_EXT = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg",
    gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif",
    heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg",
    m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/opus",
    weba: "audio/webm",
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    ogv: "video/ogg", mkv: "video/x-matroska", avi: "video/x-msvideo"
  };
  var PLACEHOLDER_NAME = /^(vision|image|render|forge-\d+|upscale-\d+|img-\d+)\.(jpe?g|png|webp)$/i;
  var cache = {};
  var objectUrls = {};
  var folders = [];
  var loadedFolders = false;
  var successors = {};
  var addListeners = [];
  function STORE() { return opts.store || null; }
  function FSTORE() { return opts.folderStore || opts.store || null; }
  function newId() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function loadAll() {
    var s = STORE();
    if (!s || typeof s.entries !== "function") return loadFolders().then(function () { return false; });
    return Promise.resolve(s.entries()).then(function (entries) {
      for (var i = 0; i < (entries || []).length; i++) {
        var id = entries[i][0], rec = entries[i][1];
        if (rec && rec.blob) { rec.id = id; cache[id] = rec; }
      }
    }, function () {}).then(function () {
      return loadFolders();
    }).then(function () { return true; });
  }
  var loading = null;
  function ensure() {
    if (!loading) loading = loadAll();
    return loading;
  }
  function get(id) {
    var cur = id;
    if (cur && successors[cur]) cur = replacementFor(cur) || cur;
    return cache[cur] || null;
  }
  function rawGet(id) { return cache[id] || null; }
  function url(id) {
    var rec = cache[id];
    if (!rec || !rec.blob) return null;
    if (typeof URL === "undefined" || !URL.createObjectURL) return null;
    try {
      if (!objectUrls[id]) {
        if (rec.blob instanceof Blob) objectUrls[id] = URL.createObjectURL(rec.blob);
        else return null;
      }
      return objectUrls[id];
    } catch (e) { return null; }
  }
  function writeRec(id, rec) {
    var s = STORE();
    if (!s || typeof s.set !== "function") return Promise.resolve(false);
    return Promise.resolve(s.set(id, rec)).then(function () { return true; }, function () { return false; });
  }
  function extName(name) {
    var m = String(name || "").match(/\.([A-Za-z0-9]{1,6})$/);
    return m ? m[1].toLowerCase() : "";
  }
  function mimeByName(name) {
    return MIME_BY_EXT[extName(name)] || "";
  }
  function mimeFor(blob, name, told) {
    var own = String((blob && blob.type) || "").toLowerCase().trim();
    if (own) return own;
    var said = String(told || "").toLowerCase().trim();
    if (said) return said;
    return mimeByName(name || (blob && blob.name) || "") || "image/jpeg";
  }
  function extFor(mime, name) {
    var m = String(mime || "").toLowerCase();
    if (/^audio\//.test(m)) {
      if (/wav|wave/.test(m)) return "wav";
      if (/mp3|mpeg3?$|x-mpeg/.test(m)) return "mp3";
      if (/m4a|mp4/.test(m)) return "m4a";
      if (/flac/.test(m)) return "flac";
      if (/aac/.test(m)) return "aac";
      if (/opus/.test(m)) return "opus";
      if (/ogg|oga/.test(m)) return "ogg";
      if (/webm/.test(m)) return "weba";
      var ownExt = extName(name);
      return ownExt || "mp3";
    }
    if (/png/.test(m)) return "png";
    if (/jpe?g/.test(m)) return "jpg";
    if (/webp/.test(m)) return "webp";
    if (/gif/.test(m)) return "gif";
    if (/avif/.test(m)) return "avif";
    if (/quicktime/.test(m)) return "mov";
    if (/webm/.test(m)) return "webm";
    if (/matroska/.test(m)) return "mkv";
    if (/x-msvideo|avi/.test(m)) return "avi";
    if (/mpeg/.test(m)) return "mpg";
    if (/mp4|m4v/.test(m)) return "mp4";
    var fromName = extName(name);
    if (fromName) return fromName;
    return "jpg";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fileName(rec) {
    if (rec.kind === "video" || /^audio\//.test(String(rec.mime || ""))) {
      var own = String(rec.name || "clip").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 100);
      if (!own) own = "clip";
      if (!/\.[A-Za-z0-9]{2,5}$/.test(own)) own += "." + extFor(rec.mime, rec.name);
      return own;
    }
    var base = (rec.kind === "gen" && rec.prompt) ? rec.prompt : (rec.name || "image");
    base = String(base).replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60);
    if (!base) base = "image";
    var d = new Date(rec.ts || Date.now());
    var stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    return "barbelo_" + base + "_" + stamp + "." + extFor(rec.mime, rec.name);
  }
  function recordLabel(rec) {
    if (!rec) return "";
    if (rec.kind === "gen" && rec.prompt) return String(rec.prompt).slice(0, 60);
    if (rec.kind === "upscale" && rec.prompt) return "upscale of " + String(rec.prompt).slice(0, 48);
    return String(rec.name || "image");
  }
  function uniqueName(name, id) {
    var base = String(name || "image");
    var m = base.match(/^(.*?)(\.[A-Za-z0-9]{2,5})?$/);
    var stem = m[1], ext = m[2] || "";
    if (!nameTaken(base, id)) return base;
    for (var k = 2; k < 500; k++) {
      if (!nameTaken(stem + "-" + k + ext, id)) return stem + "-" + k + ext;
    }
    return stem + "-" + id + ext;
  }
  function nameTaken(name, id) {
    for (var k in cache) {
      if (k !== id && cache[k] && cache[k].name === name) return true;
    }
    return false;
  }
  function onAdd(fn) {
    if (typeof fn === "function" && addListeners.indexOf(fn) === -1) addListeners.push(fn);
    return addListeners.length;
  }
  function notifyAdd(rec) {
    addListeners.slice().forEach(function (fn) {
      try { fn(rec); } catch (e) {}
    });
  }
  function noteReplace(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return false;
    successors[oldId] = newId;
    return true;
  }
  function replacementFor(id) {
    var seen = {}, cur = id;
    while (cur && successors[cur] && !seen[cur]) {
      seen[cur] = 1;
      cur = successors[cur];
    }
    return (cur && cur !== id) ? cur : "";
  }
  function add(blob, meta) {
    return ensure().then(function () {
      meta = meta || {};
      var id = newId();
      var rec = {
        id: id,
        blob: blob,
        name: meta.name || "",
        mime: mimeFor(blob, meta.name, meta.mime),
        bytes: (blob && blob.size) || 0,
        w: meta.w || 0,
        h: meta.h || 0,
        kind: meta.kind || "attach",
        prompt: meta.prompt || "",
        sent: meta.sent || "",
        negative: meta.negative || "",
        seed: meta.seed || 0,
        guidanceScale: meta.guidanceScale || 0,
        resolution: meta.resolution || ((meta.w && meta.h) ? (meta.w + "x" + meta.h) : ""),
        pose: meta.pose || "",
        recipe: meta.recipe || "",
        from: meta.from || "",
        how: meta.how || "",
        folder: normFolder(meta.folder || ""),
        tags: tagsOf(meta.tags),
        duration: meta.duration || 0,
        note: meta.note || "",
        poster: meta.poster || "",
        agent: meta.agent || "",
        bucket: meta.bucket || "",
        ts: Date.now()
      };
      if (rec.kind === "gen" && rec.prompt && (!rec.name || PLACEHOLDER_NAME.test(rec.name))) rec.name = fileName(rec);
      if (!rec.name) rec.name = (rec.kind === "video") ? "clip.mp4" : (/^audio\//.test(rec.mime) ? "recording." + extFor(rec.mime, "") : "image.jpg");
      rec.name = uniqueName(rec.name, id);
      cache[id] = rec;
      var s = STORE();
      var done = (s && typeof s.set === "function") ? Promise.resolve(s.set(id, rec)).then(function () { return true; }, function () { return false; }) : Promise.resolve(false);
      return done.then(function () {
        notifyAdd(rec);
        return id;
      });
    });
  }
  function del(id) {
    try {
      if (objectUrls[id] && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(objectUrls[id]);
    } catch (e) {}
    delete objectUrls[id];
    delete cache[id];
    var s = STORE();
    if (s && typeof s.delete === "function") {
      return Promise.resolve(s.delete(id)).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(true);
  }
  function setField(id, name, value) {
    var rec = cache[id];
    if (!rec) return Promise.resolve(false);
    rec[name] = value;
    return writeRec(id, rec).then(function () { return true; });
  }
  function list() {
    return Object.keys(cache).sort(function (a, b) { return (cache[a].ts || 0) - (cache[b].ts || 0); });
  }
  function stats() {
    var ids = list(), bytes = 0, i;
    for (i = 0; i < ids.length; i++) bytes += (cache[ids[i]].bytes || 0);
    return { count: ids.length, bytes: bytes };
  }
  function normTag(t) {
    return String(t == null ? "" : t).replace(/^#+/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  }
  function tagsOf(v) {
    var list = Array.isArray(v) ? v : (v ? String(v).split(/[,\s]+/) : []);
    var out = [];
    list.forEach(function (t) {
      var n = normTag(t);
      if (n && out.indexOf(n) === -1 && out.length < TAG_MAX) out.push(n);
    });
    return out;
  }
  function tag(id, t) {
    var rec = cache[id];
    if (!rec) return Promise.resolve(false);
    var n = normTag(t);
    if (!n) return Promise.resolve(false);
    var next = tagsOf((rec.tags || []).concat([n]));
    if (next.length === (rec.tags || []).length) return Promise.resolve(false);
    rec.tags = next;
    return writeRec(id, rec).then(function () { return true; });
  }
  function untag(id, t) {
    var rec = cache[id];
    if (!rec) return Promise.resolve(false);
    var n = normTag(t);
    var before = (rec.tags || []).length;
    rec.tags = (rec.tags || []).filter(function (x) { return x !== n; });
    if (rec.tags.length === before) return Promise.resolve(false);
    return writeRec(id, rec).then(function () { return true; });
  }
  function allTags() {
    var counts = {};
    Object.keys(cache).forEach(function (id) {
      ((cache[id] || {}).tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts).map(function (t) { return { tag: t, count: counts[t] }; }).sort(function (a, b) { return (b.count - a.count) || (a.tag < b.tag ? -1 : 1); });
  }
  function normFolder(p) {
    var s = String(p == null ? "" : p).trim().toLowerCase().replace(/\\/g, "/");
    var segs = s.split("/").filter(Boolean).map(function (seg) {
      return seg.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, FOLDER_SEG_MAX);
    }).filter(Boolean);
    if (segs.length > FOLDER_SEGS) segs = segs.slice(0, FOLDER_SEGS);
    return segs.length ? "/" + segs.join("/") : "";
  }
  function folderDefaults() {
    var d = (opts.folders && typeof opts.folders === "object") ? opts.folders : {};
    var out = {};
    Object.keys(FALLBACK_FOLDERS).forEach(function (k) {
      out[k] = normFolder(d[k] || FALLBACK_FOLDERS[k]) || FALLBACK_FOLDERS[k];
    });
    return out;
  }
  function defaultFolder(rec) {
    var d = folderDefaults();
    rec = rec || {};
    if (String(rec.kind || "") === "vox" && d.vox) return d.vox;
    if (/^audio\//.test(String(rec.mime || ""))) return d.music;
    if (rec.kind === "video") return d.clip;
    if (rec.kind === "upscale") return d.upscale;
    return d.image;
  }
  function folderOf(rec) {
    if (!rec) return "";
    return rec.folder ? normFolder(rec.folder) : defaultFolder(rec);
  }
  function isVox(rec) {
    if (!rec) return false;
    if (String(rec.kind || "") === "vox") return true;
    var f = folderOf(rec);
    var root = folderDefaults().vox;
    return !!f && !!root && (f === root || f.indexOf(root + "/") === 0);
  }
  function voxFolder(rec) {
    var root = folderDefaults().vox;
    var a = rec ? normTag(rec.agent || "") : "";
    return a ? (normFolder(root + "/" + a) || root) : root;
  }
  function bucketPath(rec, bucket) {
    var b = normTag(bucket == null ? (rec && rec.bucket) : bucket);
    if (!b) return "";
    var d = folderDefaults();
    if (rec && (rec.kind === "video" || /^video\//.test(String(rec.mime || "")))) return normFolder(d.clip + "/" + b);
    return normFolder(((rec && rec.kind === "upscale") ? d.upscale : d.image) + "/" + b);
  }
  function under(path, under_) {
    if (!path || !under_) return false;
    return path === under_ || path.indexOf(under_ + "/") === 0;
  }
  function loadFolders() {
    var s = FSTORE();
    var list = [];
    var done = (s && typeof s.get === "function")
      ? Promise.resolve(s.get("folders")).then(function (v) { if (Array.isArray(v)) list = v; }, function () {})
      : Promise.resolve(true);
    return done.then(function () {
      folders = list.filter(function (f) { return f && typeof f.path === "string" && normFolder(f.path); }).map(function (f) {
        return { path: normFolder(f.path), ts: f.ts || 0, by: String(f.by || "") };
      });
      var d = folderDefaults(), seeded = false;
      [d.image, d.music, d.vox, d.clip].forEach(function (p) {
        if (!p || knownFolder(p)) return;
        folders.push({ path: p, ts: Date.now(), by: "default" });
        seeded = true;
      });
      loadedFolders = true;
      if (seeded) return saveFolders();
    });
  }
  function saveFolders() {
    var s = FSTORE();
    if (!s || typeof s.set !== "function") return Promise.resolve(false);
    return Promise.resolve(s.set("folders", folders.slice())).then(function () { return true; }, function () { return false; });
  }
  function knownFolder(p) {
    for (var i = 0; i < folders.length; i++) if (folders[i].path === p) return true;
    return false;
  }
  function folderExists(p) {
    var n = normFolder(p);
    if (!n) return false;
    if (knownFolder(n)) return true;
    var ids = Object.keys(cache);
    for (var i = 0; i < ids.length; i++) if (folderOf(cache[ids[i]]) === n) return true;
    return false;
  }
  function createFolder(path, copts) {
    copts = copts || {};
    return ensure().then(function () {
      var p = normFolder(path);
      if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
      if (knownFolder(p)) return { ok: true, path: p, existed: true };
      folders.push({ path: p, ts: Date.now(), by: String(copts.by || "") });
      return saveFolders().then(function () { return { ok: true, path: p, existed: false }; });
    });
  }
  function allFolders() {
    var counts = {};
    folders.forEach(function (f) { counts[f.path] = counts[f.path] || 0; });
    Object.keys(cache).forEach(function (id) {
      var p = folderOf(cache[id]);
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.keys(counts).map(function (p) {
      return { path: p, count: counts[p] || 0, made: knownFolder(p) };
    }).sort(function (a, b) { return a.path < b.path ? -1 : 1; });
  }
  function setFolder(id, path) {
    return ensure().then(function () {
      var rec = cache[id];
      if (!rec) return { ok: false, error: "THAT IS NOT IN THE VAULT." };
      var p = normFolder(path);
      if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
      var was = folderOf(rec);
      return createFolder(p).then(function () {
        rec.folder = (p === defaultFolder(rec)) ? "" : p;
        return writeRec(id, rec).then(function () {
          return { ok: true, id: id, from: was, to: p, name: rec.name || recordLabel(rec) };
        });
      });
    });
  }
  function fileMany(ids, path, fopts) {
    return ensure().then(function () {
      fopts = fopts || {};
      var p = normFolder(path);
      if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
      var filed = [], skipped = [];
      (ids || []).forEach(function (id) {
        var rec = cache[id];
        if (!rec) { skipped.push({ id: id, name: id, why: "not in the vault" }); return; }
        if (fopts.onlyMade && rec.kind !== "gen" && rec.kind !== "upscale") {
          skipped.push({ id: id, name: rec.name || recordLabel(rec), why: "not made here" });
          return;
        }
        if (filed.length >= (fopts.max || 60)) return;
        filed.push(id);
      });
      if (!filed.length) return {
        ok: false, skipped: skipped,
        error: fopts.onlyMade ? "NOTHING OF HERS TO FILE - SHE MAY FILE PICTURES THE TERMINAL MADE, NOT ONES YOU HANDED OVER." : "NOTHING MATCHED, SO NOTHING WAS FILED."
      };
      return createFolder(p, { by: fopts.by }).then(function () {
        var moved = 0, chain = Promise.resolve(true);
        filed.forEach(function (fid) {
          chain = chain.then(function () {
            var rec2 = cache[fid];
            var was = folderOf(rec2);
            rec2.folder = (p === defaultFolder(rec2)) ? "" : p;
            return writeRec(fid, rec2).then(function () {
              if (was !== p) moved++;
            });
          });
        });
        return chain.then(function () {
          return { ok: true, path: p, filed: filed, skipped: skipped, moved: moved };
        });
      });
    });
  }
  function renameFolder(from, to) {
    return ensure().then(function () {
      var a = normFolder(from), b = normFolder(to);
      if (!a || !b) return { ok: false, error: "USAGE: rename <OLD> <NEW>" };
      if (a === b) return { ok: true, path: b, moved: 0, changed: false };
      var ids = Object.keys(cache), moved = 0, chain = Promise.resolve(true);
      ids.forEach(function (id) {
        chain = chain.then(function () {
          var rec = cache[id];
          var f = rec.folder || "";
          if (!f || !under(f, a)) return;
          var next = b + f.slice(a.length);
          rec.folder = (next === defaultFolder(rec)) ? "" : next;
          return writeRec(id, rec).then(function () { moved++; });
        });
      });
      return chain.then(function () {
        folders = folders.map(function (f) {
          return under(f.path, a) ? { path: b + f.path.slice(a.length), ts: f.ts, by: f.by } : f;
        }).filter(function (f, k, arr) { return arr.map(function (x) { return x.path; }).indexOf(f.path) === k; });
        if (!knownFolder(b)) folders.push({ path: b, ts: Date.now(), by: "rename" });
        return saveFolders().then(function () {
          return { ok: true, path: b, from: a, moved: moved, changed: true };
        });
      });
    });
  }
  function removeFolder(path) {
    return ensure().then(function () {
      var p = normFolder(path);
      if (!p) return { ok: false, error: "USAGE: drop <PATH>" };
      var used = Object.keys(cache).filter(function (id) { return under(folderOf(cache[id]), p); });
      if (used.length) return { ok: false, count: used.length, error: "THAT FOLDER HAS " + used.length + " ITEM" + (used.length === 1 ? "" : "S") + " IN IT - FILE THEM ELSEWHERE FIRST." };
      var before = folders.length;
      folders = folders.filter(function (f) { return !under(f.path, p); });
      return saveFolders().then(function () {
        return { ok: true, path: p, removed: before - folders.length };
      });
    });
  }
  function save(id) {
    var rec = cache[id];
    if (!rec || !(rec.blob instanceof Blob)) {
      if (typeof opts.download === "function") {
        try { return Promise.resolve(opts.download(rec ? fileName(rec) : "file", rec ? rec.blob : null)); }
        catch (e) { return Promise.reject(e); }
      }
      return Promise.reject(new Error("nothing downloadable in the vault for " + id));
    }
    var objUrl = url(id);
    if (!objUrl) return Promise.reject(new Error("nothing downloadable in the vault for " + id));
    if (typeof document !== "undefined" && document.createElement) {
      var a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName(rec);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return Promise.resolve(a.download);
    }
    if (typeof opts.download === "function") return Promise.resolve(opts.download(fileName(rec), rec.blob));
    return Promise.reject(new Error("no download road on this host"));
  }
  return {
    ensure: ensure,
    add: add, get: get, url: url, del: del, save: save, fileName: fileName,
    mimeFor: mimeFor, mimeByName: mimeByName, extFor: extFor,
    stats: stats, list: list, setField: setField,
    tag: tag, untag: untag, allTags: allTags, normTag: normTag, tagsOf: tagsOf,
    onAdd: onAdd, noteReplace: noteReplace, replacementFor: replacementFor,
    folder: folderOf, folderOf: folderOf, setFolder: setFolder, fileMany: fileMany,
    allFolders: allFolders, createFolder: createFolder,
    renameFolder: renameFolder, removeFolder: removeFolder, folderExists: folderExists,
    defaultFolder: defaultFolder, normFolder: normFolder,
    bucketPath: bucketPath,
    isVox: isVox, voxFolder: voxFolder,
    recordLabel: recordLabel,
    MAX_ATTACH: MAX_ATTACH
  };
}
return { client: client };
})();
