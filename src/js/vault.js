/* ------------------------------------------------------------------
   MEDIA VAULT — private image storage + inline visions.

   Every image (pasted, dropped, or rendered by Barbelo) is kept as a
   Blob in IndexedDB via kv-plugin (folder: media) and never leaves this
   device: there is no upload path at all. SAVE writes a copy of a vault
   image to this machine's Downloads folder (a local blob-URL download,
   nothing sent over the network) with a readable, timestamped filename.

   Attachments are normalised to jpeg (the vision model accepts only
   png/jpeg/webp) and capped at 1024px on the long side, which keeps the
   vault small and the upload fast while staying sharper than the model
   actually needs.

   A RECORD IS THE WHOLE RECIPE. A render's record carries everything that made
   it - prompt, the words actually sent, negative list, seed, guidance, size,
   pose - and the artifact NAME it goes out under, so `src/js/renderbook.js` can
   print a picture's exact recipe and make it again. Records also carry TAGS
   (see below), which is the other way into the vault: "#night" in the gallery's
   search box, or a chip pressed on a picture, or a tag she names in a
   [[SHOW: ...]] line.

   A RECORD ALSO LIVES IN A FOLDER (added 2026-09-21, Patrikios: "We need the
   ability to create media folders including /music. Images need folders by
   LIA."). A folder is a PATH - `/images`, `/music`, `/clips`,
   `/images/portraits` - because that is what he means by a media folder. A
   record without one is not "unfiled": it resolves to the default folder for
   what it is (pictures to /images, audio to /music, a clip to /clips, an
   upscale to /images/upscaled), so every existing record already has a home and
   nothing had to be migrated. Folders he or she makes are kept on this device
   (kv lia_settings / folders), so an empty /music exists and stays. See
   src/js/reader.js for the read side of all of this.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "media";
  var MAX_ATTACH = 4;
  var MAX_SIDE = 1024;
  var MAX_JS_SIDE = 1024;

  var cache = {};
  var objectUrls = {};
  var loading = null;

  function store() {
    return window.root && window.root.kv && window.root.kv[FOLDER];
  }

  function newId() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function ensure() {
    if (!loading) loading = loadAll();
    return loading;
  }

  async function loadAll() {
    var s = store();
    if (!s) return;
    var entries = await s.entries();
    for (var i = 0; i < entries.length; i++) {
      var id = entries[i][0], rec = entries[i][1];
      if (rec && rec.blob) { rec.id = id; cache[id] = rec; }
    }
    await loadFolders();
  }

  function get(id) { return cache[id] || null; }

  function url(id) {
    var rec = cache[id];
    if (!rec || !rec.blob) return null;
    if (!objectUrls[id]) objectUrls[id] = URL.createObjectURL(rec.blob);
    return objectUrls[id];
  }

  async function put(id, rec) {
    cache[id] = rec;
    var s = store();
    if (s) { try { await s.set(id, rec); } catch (e) { console.warn("media vault write failed", e); } }
  }

  /* ---- WHAT A BLOB ACTUALLY IS ---------------------------------------------
     A record's mime is the one field the whole media lane reads. It decides which FOLDER the
     thing lives in (folderOf -> /images, /music, /clips), whether the gallery paints it as a
     picture or as a piece of music (gallery.js kindOf), whether it may be put in front of her
     eyes at all (images.js lookable - the vision model takes image blobs only), and what
     extension it is written back out under (extFor below). So it has to be RIGHT, and the
     browser does not always know what it is holding: a file dragged out of a file manager the
     OS has no mapping for, an .mp3 or .wav unpacked from an archive, anything from a picker
     with no type table, all arrive as `file.type === ""`. Falling back to image/jpeg - which is
     what this used to do - turns a RECORDING INTO A PICTURE: it files itself in /images, the
     gallery shows a tile with nothing in it, and it becomes "lookable", so it is handed to the
     vision model, which throws on any non-image and takes the whole turn down with it.
     (Measured: an untyped .mp3 and an untyped .wav both came back mime "image/jpeg", folder
     /images, lookable true.)

     So the type is resolved in order of authority:
       1. the blob's own type     - it is what every consumer of the Blob sees, and what the
                                    vision plugin itself validates
       2. the caller's meta.mime  - for a blob that cannot carry a type
       3. the EXTENSION of the name - the fallback the browser does not do for us
       4. image/jpeg              - the old default, kept for a nameless image blob
     The two sound formats this terminal deals in are both here, and an mp3 is audio/mpeg (not
     audio/mp3): extFor() reads this mime back to an extension, so what is written here is what
     a SAVE is called. */
  var MIME_BY_EXT = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg",
    gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif",
    heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg",
    m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/opus",
    weba: "audio/webm",
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    ogv: "video/ogg", mkv: "video/x-matroska", avi: "video/x-msvideo",
  };

  function extName(name) {
    var m = String(name || "").match(/\.([A-Za-z0-9]{1,6})$/);
    return m ? m[1].toLowerCase() : "";
  }

  // What the NAME says the thing is - "" when the name says nothing at all. Separate from mimeFor
  // because "image/jpeg" is also the blind fallback, and something has to be able to tell a name
  // that SAYS jpeg from a name that says nothing (images.js lookable asks this way).
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

  // A render's record has to be COMPLETE, because it is the whole of what the render book
  // (src/js/renderbook.js) knows about how a picture was made: the prompt, the words that were
  // actually sent, the negative list, the seed, the guidance, the size, the pose - and, since
  // 2026-09-21, the TAGS he hangs on it, which are the other way to find a picture again.
  async function add(blob, meta) {
    await ensure();
    meta = meta || {};
    var id = newId();
    var rec = {
      id: id,
      blob: blob,
      name: meta.name || "",
      mime: mimeFor(blob, meta.name, meta.mime),
      bytes: blob.size || 0,
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
      // WHICH RECORD THIS ONE WAS MADE FROM. An upscale names the picture it came from here (see
      // src/js/upscale.js and src/js/upscale-local.js), so the lineage is a field on the record
      // rather than a sentence in its `note`: the local upscaler's replacement step reads it, and
      // `replaced` (written when that step retires the original) is the stronger claim - this record
      // TOOK THE PLACE of that one, and everything that named it names this.
      from: meta.from || "",
      how: meta.how || "",
      folder: normFolder(meta.folder || ""),
      tags: tagsOf(meta.tags),
      duration: meta.duration || 0,
      note: meta.note || "",
      poster: meta.poster || "",
      ts: Date.now(),
    };
    // A RENDER CARRIES ITS OWN NAME. A picture that was MADE (not handed over) goes out under the
    // name its prompt earns - the same name SAVE writes - so the book, the gallery and the file
    // that lands in his Downloads folder can never disagree about what the artifact is called.
    // A caller's working name ('vision.jpg', 'forge-3.jpg') is overridden on purpose: those were
    // never names, they were placeholders.
    if (rec.kind === "gen" && rec.prompt && (!rec.name || PLACEHOLDER_NAME.test(rec.name))) rec.name = fileName(rec);
    if (!rec.name) rec.name = (rec.kind === "video") ? "clip.mp4"
      : (/^audio\//.test(rec.mime) ? "recording." + extFor(rec.mime, "") : "image.jpg");
    rec.name = uniqueName(rec.name, id);
    await put(id, rec);
    notifyAdd(rec);
    return id;
  }

  // THE ONE DOOR TELLS WHOEVER ASKED. Every picture, clip, piece of music and imported file enters
  // the vault through add(), so a thing that needs to ACT on what this terminal makes (the local
  // upscaler, src/js/upscale-local.js, which enlarges every new render) has exactly one place to
  // stand - instead of hooking each of the many callers. Listeners are told AFTER the record is
  // stored, so a listener that reads it back (media.get(id)) sees it; and a listener that adds
  // another record (an upscale beside the render) is how the auto road works at all. A listener
  // that throws is logged and skipped: the door never closes on account of a bystander.
  var addListeners = [];
  function onAdd(fn) { if (typeof fn === "function" && addListeners.indexOf(fn) === -1) addListeners.push(fn); return addListeners.length; }

  /* ---- a record that has been REPLACED ------------------------------------
     One thing in this terminal retires a record by itself: the LOCAL UPSCALE
     (src/js/upscale-local.js), which takes the smaller render out of the vault
     once the bigger picture is safely in it. Between the moment that happens and
     the moment every caller has caught up, someone can still ask for the id that
     has just gone - a tile being drawn, a creation row being written into the
     archive a few milliseconds later. So the replacement is remembered here, in
     memory, the moment it happens: `noteReplace(old, new)` is called FIRST in
     that step, and `replacementFor(id)` follows the chain (an upscale may itself
     be replaced) so a reader is handed the record that exists instead of a hole.
     It is not persisted and does not need to be: after a reload nothing is
     holding an old id - the archive has already been rewritten, and this map's
     only job is the few milliseconds of a race.
     ------------------------------------------------------------------------- */
  var successors = {};
  function noteReplace(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return false;
    successors[oldId] = newId;
    return true;
  }
  function replacementFor(id) {
    var seen = {};
    var cur = id;
    while (cur && successors[cur] && !seen[cur]) {
      seen[cur] = 1;
      cur = successors[cur];
    }
    return (cur && cur !== id) ? cur : "";
  }
  function notifyAdd(rec) {
    if (!addListeners.length) return;
    addListeners.slice().forEach(function (fn) {
      try { fn(rec); } catch (e) { console.warn("a vault listener failed", e); }
    });
  }

  // Only the names a caller passes as a placeholder are replaced - a clip keeps its own name, and
  // a picture he imported keeps the name it arrived with.
  var PLACEHOLDER_NAME = /^(vision|image|render|forge-\d+|upscale-\d+|img-\d+)\.(jpe?g|png|webp)$/i;

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

  /* ---- TAGS ----------------------------------------------------------------
     The other door into the vault. A tag is one word (lowercase, hyphens for spaces) hung on a
     picture here, so that "show me everything tagged #night" is a real question - in the gallery
     (`#night` typed in the search box, or a chip pressed) and from HER side too: the render book
     reads the same tags, so a [[SHOW: #night]] line in her reply finds the pictures he filed that
     way. Tags live on the record in the vault, beside the blob, and nothing about them is
     uploaded.
     ------------------------------------------------------------------------- */
  var TAG_MAX = 24;

  function normTag(t) {
    return String(t == null ? "" : t).replace(/^#+/, "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
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

  async function writeRec(id, rec) {
    var s = store();
    if (!s) return false;
    try { await s.set(id, rec); } catch (e) { console.warn("vault write failed", e); return false; }
    return true;
  }

  async function tag(id, t) {
    var rec = cache[id];
    if (!rec) return false;
    var n = normTag(t);
    if (!n) return false;
    var next = tagsOf((rec.tags || []).concat([n]));
    if (next.length === (rec.tags || []).length) return false;
    rec.tags = next;
    await writeRec(id, rec);
    return true;
  }

  async function untag(id, t) {
    var rec = cache[id];
    if (!rec) return false;
    var n = normTag(t);
    var before = (rec.tags || []).length;
    rec.tags = (rec.tags || []).filter(function (x) { return x !== n; });
    if (rec.tags.length === before) return false;
    await writeRec(id, rec);
    return true;
  }

  // Every tag in the vault with how many pictures carry it, commonest first.
  function allTags() {
    var counts = {};
    Object.keys(cache).forEach(function (id) {
      ((cache[id] || {}).tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts).map(function (t) { return { tag: t, count: counts[t] }; })
      .sort(function (a, b) { return (b.count - a.count) || a.tag.localeCompare(b.tag); });
  }

  /* ---- FOLDERS -------------------------------------------------------------
     The vault is a set of folders, and a folder is a path: `/images`, `/music`,
     `/clips`, `/images/portraits`. Patrikios asked for the ability to create
     media folders, "including /music", and for the pictures to be filed by LIA -
     so a folder is a real, typed path, made on either side of the glass (the
     FOLDERS row in the gallery, `/folder` in the terminal, and her own
     [[FOLDER: /name]] / [[FILE: /name]] lines), and it is kept even while it is
     empty (kv lia_settings / folders).

     A record with no folder field is NOT unfiled: `folderOf` resolves it to the
     default for what it is, so the whole existing vault already has a home and
     nothing had to be moved to make folders exist. The defaults are a config
     knob (LIA_MEDIA_FOLDERS, src/js/config.js).
     ------------------------------------------------------------------------- */
  var FOLDERS_KEY = "folders";
  var FOLDER_SEGS = 4;      // /a/b/c/d is as deep as a path goes
  var FOLDER_SEG_MAX = 24;  // per segment
  var FALLBACK_FOLDERS = { image: "/images", music: "/music", vox: "/audio/vox", clip: "/clips", upscale: "/images/upscaled" };

  var folders = [];             // the folders that exist in their own right: [{ path, ts, by }]
  var loadedFolders = false;

  function folderStore() {
    return (window.root && window.root.kv && window.root.kv.lia_settings) || null;
  }

  // `music`, `/Music`, `/music/` and `//music` are all the same folder, and only lowercase
  // letters, digits and single hyphens survive in a segment - so a folder name is always
  // typeable, linkable and safe as a query term.
  function normFolder(p) {
    var s = String(p == null ? "" : p).trim().toLowerCase().replace(/\\/g, "/");
    var segs = s.split("/").filter(Boolean).map(function (seg) {
      return seg.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, FOLDER_SEG_MAX);
    }).filter(Boolean);
    if (segs.length > FOLDER_SEGS) segs = segs.slice(0, FOLDER_SEGS);
    return segs.length ? "/" + segs.join("/") : "";
  }

  function folderDefaults() {
    var d = (typeof LIA_MEDIA_FOLDERS === "object" && LIA_MEDIA_FOLDERS) ? LIA_MEDIA_FOLDERS : {};
    var out = {};
    Object.keys(FALLBACK_FOLDERS).forEach(function (k) {
      out[k] = normFolder(d[k] || FALLBACK_FOLDERS[k]) || FALLBACK_FOLDERS[k];
    });
    return out;
  }

  // Where a record lives when nobody has said otherwise. An audio file goes to /music, a clip to
  // /clips, an upscaled picture to /images/upscaled, anything else to /images.
  function defaultFolder(rec) {
    var d = folderDefaults();
    rec = rec || {};
    // A VOICE IS BORN IN THE VOX TREE. A record the story lane writes carries kind "vox", and its
    // home is the shelf itself unless something files it under an agent - so a take that is kept
    // lands in /audio/vox and not in /music, which is what it is not.
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

  // VOX :: VOCAL AUDIO, WHICH IS NOT MUSIC. The gallery paints a VOX tab and the folders job gives
  // every record one home, and both ask HERE so they cannot disagree: a record is a voice when it says
  // so (kind "vox" - what the story lane writes) or when it is FILED anywhere in the vox tree
  // (/audio/vox, /audio/vox/lia, /audio/vox/barbelo). Filing is therefore the one gesture that turns a
  // clip into a voice, which is exactly how he does it by hand: put it in the tree and it is a VOX.
  function isVox(rec) {
    if (!rec) return false;
    if (String(rec.kind || "") === "vox") return true;
    var f = folderOf(rec);
    var root = folderDefaults().vox;
    return !!f && !!root && (f === root || f.indexOf(root + "/") === 0);
  }

  // Where a voice belongs when something files it: its agent's own folder in the vox tree when the
  // record names one (/audio/vox/lia, /audio/vox/barbelo), and the shelf itself when it does not -
  // nothing is attributed to an agent until he says so. `rec.agent` is a slug, like a role id.
  function voxFolder(rec) {
    var root = folderDefaults().vox;
    var a = rec ? normTag(rec.agent || "") : "";
    return a ? (normFolder(root + "/" + a) || root) : root;
  }

  // THE BUCKET (src/js/tools.js - the classifier). A picture the bulk vision pass has read carries
  // one short slug naming the KIND of scene it is ("outdoor-couple-encounter", "portrait-closeup"),
  // and a bucket is also a place: /images/<bucket>, /images/upscaled/<bucket> for an upscale
  // (because an upscale's home is /images/upscaled), and /clips/<bucket> for a CLIP - a clip is
  // read by the same pass now (as a handful of stills across it), so its bucket is filed under the
  // folder its kind already lives in. This function only ANSWERS where a bucketed record belongs -
  // it files nothing and changes nothing - and the answer is normalized like any path, so the tool,
  // the vault and the folders job cannot disagree about it. A record with no bucket has no bucket
  // path, and falls back to its kind's own folder exactly as before. See the CLASSIFIER section of
  // src/README.md.
  function bucketPath(rec, bucket) {
    var b = normTag(bucket == null ? (rec && rec.bucket) : bucket);
    if (!b) return "";
    var d = folderDefaults();
    if (rec && (rec.kind === "video" || /^video\//.test(String(rec.mime || "")))) return normFolder(d.clip + "/" + b);
    return normFolder(((rec && rec.kind === "upscale") ? d.upscale : d.image) + "/" + b);
  }

  // Is `path` the same folder as `under`, or one of its children? "/images" holds
  // "/images/portraits" - a folder question should find what is inside it.
  function under(path, under_) {
    if (!path || !under_) return false;
    return path === under_ || path.indexOf(under_ + "/") === 0;
  }

  async function loadFolders() {
    var s = folderStore();
    var list = [];
    if (s) {
      try {
        var v = await s.get(FOLDERS_KEY);
        if (Array.isArray(v)) list = v;
      } catch (e) { console.warn("folders unreadable", e); }
    }
    folders = list.filter(function (f) { return f && typeof f.path === "string" && normFolder(f.path); })
      .map(function (f) { return { path: normFolder(f.path), ts: f.ts || 0, by: String(f.by || "") }; });
    // The default folders exist from the first boot, so /music and the VOX shelf are real places to
    // put sound before anything has been put there.
    var d = folderDefaults();
    var seeded = false;
    [d.image, d.music, d.vox, d.clip].forEach(function (p) {
      if (!p || knownFolder(p)) return;
      folders.push({ path: p, ts: Date.now(), by: "default" });
      seeded = true;
    });
    loadedFolders = true;
    if (seeded) await saveFolders();
  }

  async function saveFolders() {
    var s = folderStore(); if (!s) return;
    try { await s.set(FOLDERS_KEY, folders.slice()); } catch (e) { console.warn("folders not saved", e); }
  }

  function knownFolder(p) {
    for (var i = 0; i < folders.length; i++) if (folders[i].path === p) return true;
    return false;
  }

  // A folder exists if it was made, or if anything lives in it.
  function folderExists(p) {
    var n = normFolder(p);
    if (!n) return false;
    if (knownFolder(n)) return true;
    var ids = Object.keys(cache);
    for (var i = 0; i < ids.length; i++) if (folderOf(cache[ids[i]]) === n) return true;
    return false;
  }

  async function createFolder(path, opts) {
    opts = opts || {};
    if (!loadedFolders) await loadFolders();
    var p = normFolder(path);
    if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
    if (knownFolder(p)) return { ok: true, path: p, existed: true };
    folders.push({ path: p, ts: Date.now(), by: String(opts.by || "") });
    await saveFolders();
    return { ok: true, path: p, existed: false };
  }

  // Every folder on this device with how much is in it, the defaults always present even while
  // they are empty.
  function allFolders() {
    var counts = {};
    folders.forEach(function (f) { counts[f.path] = counts[f.path] || 0; });
    Object.keys(cache).forEach(function (id) {
      var p = folderOf(cache[id]);
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.keys(counts).map(function (p) {
      return { path: p, count: counts[p] || 0, made: knownFolder(p) };
    }).sort(function (a, b) { return a.path.localeCompare(b.path); });
  }

  function folderList() { return allFolders().map(function (f) { return f.path; }); }

  // FILE ONE RECORD. `folderOf` keeps resolving a record that has been filed back into its
  // default (the field is cleared then, so a record carries an override or nothing at all).
  async function setFolder(id, path) {
    await ensure();
    var rec = cache[id];
    if (!rec) return { ok: false, error: "THAT IS NOT IN THE VAULT." };
    var p = normFolder(path);
    if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
    var was = folderOf(rec);
    if (!folderExists(p)) await createFolder(p);
    rec.folder = (p === defaultFolder(rec)) ? "" : p;
    await writeRec(id, rec);
    rec.id = id;
    return { ok: true, id: id, from: was, to: p, name: rec.name || recordLabel(rec) };
  }

  // FILE MANY. `onlyMade` is the guard on HER side of the glass: she may file what the terminal
  // made (a render, an upscale) and nothing that Patrikios handed over himself, because moving
  // his own files is not hers to do.
  async function fileMany(ids, path, opts) {
    await ensure();
    opts = opts || {};
    var p = normFolder(path);
    if (!p) return { ok: false, error: "A FOLDER NEEDS A NAME - /music, /images/portraits." };
    var filed = [], skipped = [];
    (ids || []).forEach(function (id) {
      var rec = cache[id];
      if (!rec) { skipped.push({ id: id, name: id, why: "not in the vault" }); return; }
      if (opts.onlyMade && rec.kind !== "gen" && rec.kind !== "upscale") {
        skipped.push({ id: id, name: rec.name || recordLabel(rec), why: "not made here" });
        return;
      }
      if (filed.length >= (opts.max || 60)) return;
      filed.push(id);
    });
    if (!filed.length) return { ok: false, skipped: skipped, error: opts.onlyMade
      ? "NOTHING OF HERS TO FILE - SHE MAY FILE PICTURES THE TERMINAL MADE, NOT ONES YOU HANDED OVER."
      : "NOTHING MATCHED, SO NOTHING WAS FILED." };
    if (!knownFolder(p)) await createFolder(p, { by: opts.by });
    var moved = 0;
    for (var i = 0; i < filed.length; i++) {
      var rec2 = cache[filed[i]];
      var was = folderOf(rec2);
      rec2.folder = (p === defaultFolder(rec2)) ? "" : p;
      await writeRec(filed[i], rec2);
      rec2.id = filed[i];
      if (was !== p) moved++;
    }
    return { ok: true, path: p, filed: filed, skipped: skipped, moved: moved };
  }

  // A short human handle for a record, for reports.
  function recordLabel(rec) {
    if (!rec) return "";
    if (rec.kind === "gen" && rec.prompt) return String(rec.prompt).slice(0, 60);
    if (rec.kind === "upscale" && rec.prompt) return "upscale of " + String(rec.prompt).slice(0, 48);
    return String(rec.name || "image");
  }

  // RENAME keeps everything in it: an explicit folder and every folder under it move together,
  // and every record filed there is refiled.
  async function renameFolder(from, to) {
    await ensure();
    var a = normFolder(from), b = normFolder(to);
    if (!a || !b) return { ok: false, error: "USAGE: /folder rename <OLD> <NEW>" };
    if (a === b) return { ok: true, path: b, moved: 0, changed: false };
    var ids = Object.keys(cache), moved = 0;
    for (var i = 0; i < ids.length; i++) {
      var rec = cache[ids[i]];
      var f = rec.folder || "";
      if (!f || !under(f, a)) continue;
      var next = b + f.slice(a.length);
      rec.folder = (next === defaultFolder(rec)) ? "" : next;
      await writeRec(ids[i], rec);
      rec.id = ids[i];
      moved++;
    }
    folders = folders.map(function (f) {
      return under(f.path, a) ? { path: b + f.path.slice(a.length), ts: f.ts, by: f.by } : f;
    }).filter(function (f, k, arr) { return arr.map(function (x) { return x.path; }).indexOf(f.path) === k; });
    if (!knownFolder(b)) folders.push({ path: b, ts: Date.now(), by: "rename" });
    await saveFolders();
    return { ok: true, path: b, from: a, moved: moved, changed: true };
  }

  // DROP takes an empty folder out. It will not touch what is in one - emptying a folder means
  // filing the records somewhere else first, which is his call (the gallery) or hers (FILE).
  async function removeFolder(path) {
    await ensure();
    var p = normFolder(path);
    if (!p) return { ok: false, error: "USAGE: /folder drop <PATH>" };
    var used = Object.keys(cache).filter(function (id) { return under(folderOf(cache[id]), p); });
    if (used.length) return { ok: false, count: used.length, error: "THAT FOLDER HAS " + used.length + " ITEM" + (used.length === 1 ? "" : "S") + " IN IT - FILE THEM ELSEWHERE FIRST." };
    var before = folders.length;
    folders = folders.filter(function (f) { return !under(f.path, p); });
    await saveFolders();
    return { ok: true, path: p, removed: before - folders.length };
  }

  // One field of a stored record, changed and kept - her own reading of a picture, say. The
  // blob is untouched; only the record around it moves.
  async function setField(id, name, value) {
    var rec = cache[id];
    if (!rec) return false;
    rec[name] = value;
    var s = store();
    if (s) { try { await s.set(id, rec); } catch (e) { console.warn("vault field write failed", e); } }
    return true;
  }

  async function del(id) {    if (objectUrls[id]) { URL.revokeObjectURL(objectUrls[id]); delete objectUrls[id]; }
    delete cache[id];
    var s = store();
    if (s) { try { await s.delete(id); } catch (e) {} }
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // The extension a stored blob is written back out with. Pictures and clips both live in the
  // vault now, so this covers the video and audio containers the browser can hold.
  function extFor(mime, name) {
    var m = String(mime || "").toLowerCase();
    // SOUND FIRST. The audio tests used to sit BELOW the video ones and to read bare substrings,
    // so `audio/mpeg` - which is what an mp3 IS - matched the `/mpeg/` test and came back "mpg":
    // a piece of music saved out of the vault was written as a .mpg video file (measured). An
    // audio mime must never fall through to a container test, so every audio type is answered
    // here, before anything else. This is also where `.wav` and `.mp3` - the two formats this
    // terminal deals in - are pinned to their own names.
    if (/^audio\//.test(m)) {
      if (/wav|wave/.test(m)) return "wav";
      if (/mp3|mpeg3?$|x-mpeg/.test(m)) return "mp3";
      if (/m4a|mp4/.test(m)) return "m4a";
      if (/flac/.test(m)) return "flac";
      if (/aac/.test(m)) return "aac";
      if (/opus/.test(m)) return "opus";
      if (/ogg|oga/.test(m)) return "ogg";
      if (/webm/.test(m)) return "weba";
      var ownExt = extName(name);          // an audio type we have never seen: trust the name,
      return ownExt || "mp3";              // then the container this terminal actually deals in
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
    // Last resort: trust the name the file arrived with, so a clip is never re-christened .jpg.
    var fromName = extName(name);
    if (fromName) return fromName;
    return "jpg";
  }

  // A tidy, human-readable filename for the downloaded file: the prompt (for
  // visions she made) or the original name, slugged, plus a date/time stamp.
  function fileName(rec) {
    // A clip is HIS master file, so it goes back out under its own name in its own container,
    // exactly as it arrived - not renamed as though she had made it, and not re-encoded. A piece
    // of MUSIC is his master in exactly the same way (the lightbox says so: "the file itself,
    // kept whole"), so it too keeps its own name: `Beyond the Veil-MASTERED.wav` saves as
    // `Beyond the Veil-MASTERED.wav`, and an mp3 goes back out as an mp3 (extFor above).
    if (rec.kind === "video" || /^audio\//.test(String(rec.mime || ""))) {
      var own = String(rec.name || "clip").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 100);
      if (!own) own = "clip";
      if (!/\.[A-Za-z0-9]{2,5}$/.test(own)) own += "." + extFor(rec.mime, rec.name);
      return own;
    }
    var base = (rec.kind === "gen" && rec.prompt) ? rec.prompt : (rec.name || "image");
    base = String(base).replace(/\.[a-z0-9]{2,4}$/i, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60);
    if (!base) base = "image";
    var d = new Date(rec.ts || Date.now());
    var stamp = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
      + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    return "barbelo_" + base + "_" + stamp + "." + extFor(rec.mime, rec.name);
  }

  // Saves a vault image straight to this machine. Nothing is uploaded - the
  // browser writes the local blob to the Downloads folder.
  function save(id) {
    var rec = cache[id];
    var objUrl = url(id);
    if (!rec || !objUrl) throw new Error("image not found in vault");
    var a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName(rec);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return a.download;
  }

  function list() {
    return Object.keys(cache).sort(function (a, b) { return (cache[a].ts || 0) - (cache[b].ts || 0); });
  }

  function stats() {
    var ids = list(), bytes = 0;
    for (var i = 0; i < ids.length; i++) bytes += (cache[ids[i]].bytes || 0);
    return { count: ids.length, bytes: bytes };
  }

  function blobToJpegCanvas(blob) {
    return new Promise(function (resolve, reject) {
      var objUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(objUrl);
          resolve({ canvas: c, w: c.width, h: c.height });
        } catch (e) { URL.revokeObjectURL(objUrl); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(objUrl); reject(new Error("cannot decode this image format")); };
      img.src = objUrl;
    });
  }

  async function normalize(file) {
    if (!/^image\//.test(file.type || "")) throw new Error("not an image file");
    var out = await blobToJpegCanvas(file);
    var blob = await new Promise(function (r) { out.canvas.toBlob(r, "image/jpeg", 0.92); });
    if (!blob) throw new Error("failed to encode image");
    return { blob: blob, w: out.w, h: out.h };
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (r) { canvas.toBlob(r, "image/jpeg", quality == null ? 0.92 : quality); });
  }

  window.media = {
    ensure: ensure, add: add, get: get, url: url, del: del, save: save, fileName: fileName,
    mimeFor: mimeFor, mimeByName: mimeByName, extFor: extFor,
    stats: stats, list: list, normalize: normalize, canvasToBlob: canvasToBlob, setField: setField,
    artifactName: function (rec) { return rec ? fileName(rec) : ""; },
    tag: tag, untag: untag, allTags: allTags, normTag: normTag, tagsOf: tagsOf,
    onAdd: onAdd, noteReplace: noteReplace, replacementFor: replacementFor,
    folder: folderOf, folderOf: folderOf, setFolder: setFolder, fileMany: fileMany,
    allFolders: allFolders, folders: folderList, createFolder: createFolder,
    renameFolder: renameFolder, removeFolder: removeFolder, folderExists: folderExists,
    defaultFolder: defaultFolder, normFolder: normFolder, folderLabel: function (rec) { return folderOf(rec); },
    bucketPath: bucketPath,
    isVox: isVox, voxFolder: voxFolder,
    recordLabel: recordLabel,
    MAX_ATTACH: MAX_ATTACH, MAX_SIDE: MAX_SIDE, MAX_JS_SIDE: MAX_JS_SIDE,
  };
})();
