/* GALLERY TAGGING ON IMPORT — drop-in.
   suggestTags(name, folder): zero-cost tags from filename + folder leaf.
   importWithTags(files, opts): pics/tunes/clips import with tags attached.
   Requires: window.media (add/tag, normTag), optionally window.attach.keepClip
   patched to thread opts.tags into vidMeta (see PATCH note below). */
window.GalleryTagging = (function () {
  "use strict";
  var STOP = { img:1, photo:1, pic:1, pics:1, image:1, images:1, final:1, edit:1, edited:1, copy:1, download:1, downloads:1, asset:1, assets:1, file:1, new:1, Untitled:0, untitled:1, the:1, and:1, for:1 };
  var DEFAULT_FOLDERS = { images:1, clips:1, music:1, upscaled:1 };
  function norm(t) {
    if (window.media && window.media.normTag) return window.media.normTag(t);
    return String(t || "").replace(/^#+/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  }
  function suggestTags(name, folder, prompt) {
    var out = [], seen = {};
    function push(t) { t = norm(t); if (!t || seen[t] || out.length >= 10) return; seen[t] = 1; out.push(t); }
    var base = String(name || "").replace(/\.[A-Za-z0-9]+$/, "");
    base.split(/[^A-Za-z0-9]+/).forEach(function (tok) {
      var t = tok.toLowerCase();
      if (t.length < 3 || /^\d+$/.test(t) || /^\d{8}$/.test(t) || STOP[t]) return;
      push(t);
      if (out.length >= 8) return;
    });
    var leaf = String(folder || "").split("/").filter(Boolean).pop() || "";
    if (leaf && !DEFAULT_FOLDERS[leaf.toLowerCase()]) push(leaf);
    if (prompt) String(prompt).split(/[^A-Za-z0-9]+/).slice(0, 12).forEach(function (tok) {
      var t = tok.toLowerCase();
      if (t.length < 4 || STOP[t] || /^\d+$/.test(t)) return;
      if (out.length < 10) push(t);
    });
    return out;
  }
  function isPic(f) { return /^image\//.test(f.type || "") || /\.(png|jpe?g|webp|gif|avif|bmp|heic|heif|tiff?)$/i.test(f.name || ""); }
  function isTune(f) { return /^audio\//.test(f.type || "") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(f.name || ""); }
  function isClip(f) { return /^video\//.test(f.type || "") || /\.(mp4|m4v|mov|webm|ogv|mkv|avi)$/i.test(f.name || ""); }
  async function importWithTags(files, opts) {
    opts = opts || {};
    var list = Array.prototype.slice.call(files || []).filter(Boolean);
    var target = opts.folder || "", added = 0, failed = 0, tagged = 0;
    for (var i = 0; i < list.length; i++) {
      var f = list[i], tags = suggestTags(f.name, target);
      try {
        if (isPic(f)) {
          var normed = (window.media && window.media.normalize) ? await window.media.normalize(f) : { blob: f, w: 0, h: 0 };
          await window.media.add(normed.blob, { name: f.name || "imported.jpg", w: normed.w, h: normed.h, kind: "attach", folder: target, tags: tags, note: "imported with filename tags" });
          added++; tagged += tags.length ? 1 : 0;
        } else if (isTune(f)) {
          await window.media.add(f, { name: f.name || "music.mp3", mime: window.media.mimeFor(f, f.name), kind: "attach", folder: target, tags: tags, note: "kept whole as it arrived" });
          added++; tagged += tags.length ? 1 : 0;
        } else if (isClip(f) && window.attach && window.attach.keepClip) {
          var co = await window.attach.keepClip(f, { folder: target, room: false, quiet: true, tags: tags });
          if (co && (co.kept || co.poster)) { added++; tagged += tags.length ? 1 : 0; }
          else failed++;
          if (co && co.poster && tags.length && window.media && window.media.tag) { try { for (var t = 0; t < tags.length; t++) await window.media.tag(co.poster, tags[t]); } catch (e) {} }
          if (co && co.id && tags.length && window.media && window.media.tag) { try { for (var u = 0; u < tags.length; u++) await window.media.tag(co.id, tags[u]); } catch (e) {} }
        } else failed++;
      } catch (e) { failed++; }
      if (opts.onStep) { try { opts.onStep(i + 1, list.length); } catch (e) {} }
    }
    return { added: added, failed: failed, tagged: tagged };
  }
  /* PATCH for keepClip (attach.js): thread opts.tags into the stored records.
     vidMeta.tags = opts.tags || [];  +  poster meta tags: opts.tags || []   */
  return { suggestTags: suggestTags, importWithTags: importWithTags };
})();
