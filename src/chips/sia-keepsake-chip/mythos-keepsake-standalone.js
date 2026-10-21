window.MythosKeepsake = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var TAG = opts.tag || "kept";
  var HASH_KEY = opts.hashKey || "gallery";
  var MAX_ID = opts.maxId || 60;
  function VAULT() { return opts.vault || null; }
  function STUDIO() { return opts.studio || null; }
  function BOOK() { return opts.renderBook || null; }
  function READER() { return opts.reader || null; }
  function PRINT(t) {
    if (typeof opts.print === "function") { try { opts.print(t); } catch (e) {} }
  }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return ts ? String(ts) : "";
  }
  function low(s) { return String(s == null ? "" : s).toLowerCase(); }
  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
  function slug(s) {
    return String(s == null ? "" : s).trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function stemOf(rec) {
    return String((rec && rec.name) || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  }
  function pageUrl() {
    if (typeof opts.pageUrl === "string" && opts.pageUrl) return opts.pageUrl;
    if (typeof opts.pageUrl === "function") { try { return opts.pageUrl(); } catch (e) {} }
    return "https://perchance.org/";
  }
  function galleryUrl() { return pageUrl() + "#" + HASH_KEY; }
  function linkFor(id) { return pageUrl() + "#" + HASH_KEY + "=" + encodeURIComponent(String(id == null ? "" : id)); }
  function isMade(rec) { return !!(rec && (rec.kind === "gen" || rec.kind === "upscale")); }
  function canKeep(rec) { return !!(isMade(rec) && String((rec && rec.prompt) || "").trim()); }
  function isKept(rec) { return !!(rec && rec.keep && rec.keep.recipe); }
  function recipeIdFor(rec) {
    var id = slug(stemOf(rec));
    if (!id) id = slug(rec.prompt);
    if (!id) id = "render-" + String(rec.id || "").slice(0, 8);
    if (id.length <= MAX_ID) return id.replace(/-+$/, "");
    var tail = id.slice(-18).replace(/^-+/, "");
    var head = id.slice(0, MAX_ID - tail.length - 1).replace(/-+$/, "");
    return head + "-" + tail;
  }
  function paramTags(rec) {
    var tags = [];
    var seed = Math.floor(Number(rec && rec.seed) || 0);
    if (seed > 0) tags.push("(seed:::" + seed + ")");
    var g = Math.floor(Number(rec && rec.guidanceScale) || 0);
    if (g >= 1 && g <= 30) tags.push("(guidanceScale:::" + g + ")");
    var res = String((rec && rec.resolution) || "");
    if (!/^\d{3,4}x\d{3,4}$/.test(res) && rec && rec.w && rec.h) res = rec.w + "x" + rec.h;
    if (/^(512x512|512x768|768x512|768x768)$/.test(res)) tags.push("(resolution:::" + res + ")");
    return tags;
  }
  function templateFor(rec) {
    var base = String((rec && rec.prompt) || "").replace(/[\s,]+$/, "").trim();
    var tags = paramTags(rec);
    if (!tags.length) return base;
    return (base ? base + " " : "") + tags.join(" ");
  }
  function settingsLine(rec) {
    var bits = [];
    if (rec.seed) bits.push("seed " + rec.seed);
    if (rec.guidanceScale) bits.push("guidance " + rec.guidanceScale);
    if (rec.resolution) bits.push(rec.resolution);
    else if (rec.w && rec.h) bits.push(rec.w + "\u00d7" + rec.h);
    if (rec.pose) bits.push("pose " + rec.pose);
    if (rec.how) bits.push("made by " + rec.how);
    return bits.length ? bits.join("  \u00b7  ") : "NONE ON THE RECORD";
  }
  function rowLabelOf(id) {
    var B = BOOK();
    try { if (B && typeof B.labelOf === "function") return String(B.labelOf(id) || ""); } catch (e) {}
    return "";
  }
  function folderOf(rec) {
    var V = VAULT();
    try { if (V && typeof V.folderOf === "function") return V.folderOf(rec) || ""; } catch (e) {}
    return "";
  }
  function noteFor(rec, link) {
    var row = rowLabelOf(rec.id);
    var bits = ["KEPT IN THE RECORD BY PATRIKIOS"];
    if (row) bits.push(row);
    bits.push(settingsLine(rec));
    if (STAMP(rec.ts)) bits.push(STAMP(rec.ts));
    bits.push(link);
    return bits.join("  \u00b7  ");
  }
  function recipeFor(rec, link) {
    return { id: recipeIdFor(rec), title: stemOf(rec) || String(rec.name || "picture"), note: noteFor(rec, link), tags: [TAG], template: templateFor(rec), negative: String(rec.negative || ""), slots: {}, source: "his" };
  }
  function fail(error) {
    PRINT("KEEP :: " + String(error || "THAT DID NOT WORK."));
    return { ok: false, error: error };
  }
  function report(res) {
    res = res || {};
    if (!res.ok) return fail(res.error);
    var rec = res.rec || {};
    var lines = [];
    lines.push("KEPT IN THE RECORD :: " + String(stemOf(rec) || rec.id || "").toUpperCase());
    lines.push("  RECIPE BOOK  :: \"" + res.recipeId + "\" WRITTEN" + (res.replaced ? " OVER AN EARLIER RECIPE OF THE SAME NAME" : ""));
    lines.push("  THE PROMPT   :: " + clip(rec.prompt, 220));
    lines.push("  NEGATIVE     :: " + (rec.negative ? clip(rec.negative, 160) : "NONE ON THE RECORD"));
    lines.push("  SETTINGS     :: " + settingsLine(rec));
    lines.push("  GALLERY      :: " + res.link);
    lines.push("NOTHING WAS UPLOADED - THE PICTURE, THE RECIPE AND THE LINK ALL LIVE HERE.");
    PRINT(lines.join("\n"));
    return res;
  }
  function keep(id, kopts) {
    kopts = kopts || {};
    var V = VAULT();
    if (!V) return Promise.resolve(fail("THE VAULT IS NOT LOADED HERE."));
    var ready = V.ensure ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () {
      var rec = V.get(id);
      if (!rec) return fail("THERE IS NO RECORD WITH THAT ID IN THE VAULT.");
      if (!canKeep(rec)) {
        return fail(isMade(rec)
          ? "THAT ONE HAS NO PROMPT ON ITS RECORD, SO THERE IS NO RECIPE TO KEEP."
          : "THAT IS NOT A PICTURE THE TERMINAL MADE - KEEP SAVES THE PROMPT, THE NEGATIVE LIST, THE SETTINGS AND THE SEED OF A RENDER OR AN UPSCALE.");
      }
      var S = STUDIO();
      if (!S || typeof S.addRecipe !== "function") return fail("THE RECIPE BOOK IS NOT LOADED HERE.");
      var loadP = (typeof S.loadRecipeBook === "function") ? Promise.resolve(S.loadRecipeBook()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
      return loadP.then(function () {
        var rid = recipeIdFor(rec);
        var link = linkFor(id);
        var replaced = false;
        try { replaced = !!(typeof S.findRecipe === "function" && S.findRecipe(rid)); } catch (e) { replaced = false; }
        return Promise.resolve(S.addRecipe(recipeFor(rec, link))).then(function (added) {
          if (!added || !added.ok) return fail("THE RECIPE BOOK REFUSED IT :: " + ((added && added.error) || "unknown"));
          return Promise.resolve(V.setField(id, "keep", { recipe: rid, at: Date.now(), by: "patrikios", link: link })).then(function () {
            return Promise.resolve(V.tag(id, TAG)).then(function () {
              if (typeof opts.onKeep === "function") { try { opts.onKeep(id, rid); } catch (e) {} }
              return report({ ok: true, id: id, rec: V.get(id) || rec, recipeId: rid, link: link, replaced: replaced, tag: TAG, row: rowLabelOf(id), folder: folderOf(rec) });
            });
          });
        });
      });
    });
  }
  function transfer(oldId, newId) {
    var V = VAULT();
    if (!V || !oldId || !newId || oldId === newId) return Promise.resolve(false);
    var oldRec = V.get(oldId), newRec = V.get(newId);
    if (!oldRec || !newRec || !isKept(oldRec)) return Promise.resolve(false);
    var oldLink = String((oldRec.keep && oldRec.keep.link) || "") || linkFor(oldId);
    var newLink = linkFor(newId);
    return Promise.resolve(V.setField(newId, "keep", { recipe: oldRec.keep.recipe, at: oldRec.keep.at || Date.now(), by: oldRec.keep.by || "patrikios", link: newLink })).then(function () {
      return Promise.resolve(V.tag(newId, TAG)).then(function () {
        var S = STUDIO();
        try {
          if (S && typeof S.findRecipe === "function" && typeof S.addRecipe === "function") {
            var loadP = (typeof S.loadRecipeBook === "function") ? Promise.resolve(S.loadRecipeBook()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
            return loadP.then(function () {
              var r = S.findRecipe(oldRec.keep.recipe);
              if (r && r.source === "his" && String(r.note || "").indexOf(oldLink) !== -1) {
                return Promise.resolve(S.addRecipe({ id: r.id, title: r.title, note: String(r.note).split(oldLink).join(newLink), tags: r.tags, template: r.template, negative: r.negative, slots: r.slots, source: "his" })).then(function () { return true; });
              }
              return true;
            });
          }
        } catch (e) {}
        return true;
      });
    });
  }
  function copyLink(id) {
    var link = linkFor(id);
    if (typeof opts.copy === "function") {
      return Promise.resolve(opts.copy(link)).then(function (ok) {
        if (ok) { PRINT("GALLERY LINK COPIED :: " + link); return { ok: true, link: link }; }
        PRINT("HERE IS THE LINK (SELECT IT BY HAND) :: " + link);
        return { ok: false, link: link, error: "the copy road refused it" };
      }, function () {
        PRINT("HERE IS THE LINK (SELECT IT BY HAND) :: " + link);
        return { ok: false, link: link, error: "the copy road refused it" };
      });
    }
    PRINT("GALLERY LINK :: " + link);
    return Promise.resolve({ ok: true, link: link, manual: true });
  }
  function showLink(id) {
    var V = VAULT();
    var rec = V ? V.get(id) : null;
    var link = linkFor(id);
    PRINT("GALLERY LINK :: " + link + (rec ? "\n  " + String(stemOf(rec) || rec.id).toUpperCase() + (rec.keep ? "  \u00b7  KEPT AS RECIPE \"" + rec.keep.recipe + "\"" : "  \u00b7  NOT KEPT YET") : "\n  NO RECORD IN THIS VAULT HAS THAT ID."));
    return link;
  }
  function resolve(what, ropts) {
    ropts = ropts || {};
    var V = VAULT();
    var ready = (V && V.ensure) ? Promise.resolve(V.ensure()).then(function () { return true; }, function () { return true; }) : Promise.resolve(true);
    return ready.then(function () {
      var spec = String(what == null ? "" : what).trim();
      var B = BOOK();
      if (!spec) {
        if (B && typeof B.sheet === "function") {
          return Promise.resolve(B.sheet()).then(function (rows) {
            for (var i = (rows || []).length - 1; i >= 0; i--) {
              if (!isKept(rows[i].rec)) return { ids: [rows[i].id], label: rows[i].label };
            }
            return { ids: [], label: "" };
          }, function () { return { ids: [], label: "" }; });
        }
        return { ids: [], label: "" };
      }
      var R = READER();
      if (R && typeof R.targets === "function") {
        return Promise.resolve(R.targets(spec, ropts)).then(function (t) {
          if (t && t.ids && t.ids.length) return t;
          return { ids: [], label: spec };
        });
      }
      if (V && V.get(spec)) return { ids: [spec], label: spec };
      return { ids: [], label: spec };
    });
  }
  function keepWhat(what, wopts) {
    return resolve(what, wopts).then(function (t) {
      if (!t.ids.length) {
        PRINT("KEEP :: NOTHING HERE MATCHES \"" + String(what || "").toUpperCase() + "\".");
        return { ok: false, matched: 0 };
      }
      if (t.ids.length > 1) PRINT("KEEP :: \"" + String(what || "").toUpperCase() + "\" MEANS " + t.ids.length + " PICTURES - KEEPING THE NEWEST ONE (" + t.label + ").");
      return keep(t.ids[t.ids.length - 1], wopts);
    });
  }
  function list() {
    var V = VAULT();
    if (!V) return [];
    return V.list().filter(function (id) { return isKept(V.get(id)); });
  }
  function describe() {
    var ids = list();
    var V = VAULT();
    var out = ["KEEP :: ONE PRESS THAT PUTS A PICTURE THE TERMINAL MADE INTO THE RECORD (" + ids.length + " KEPT SO FAR)"];
    out.push("  THE IMAGE      :: it is already in the vault - KEEP hangs #" + TAG + " on it, so #" + TAG + " is every kept one.");
    out.push("  THE PROMPT     :: the positive prompt and the negative list are written into the RECIPE BOOK as a recipe named after the picture.");
    out.push("  THE SETTINGS   :: the seed, the guidance and the size ride in as (seed:::N) (guidanceScale:::N) (resolution:::WxH) tags.");
    out.push("  THE LINK       :: #" + HASH_KEY + "=<ID> - kept on the record and printed.");
    if (ids.length && V) {
      out.push("  KEPT :: " + ids.slice(-12).reverse().map(function (id) {
        var r = V.get(id);
        return (rowLabelOf(id) || "") + (r && r.keep ? " \u00b7 " + r.keep.recipe : "");
      }).join("   \u00b7   "));
    }
    out.push("  NOTHING IS UPLOADED. THE PICTURE, THE RECIPE AND THE LINK ALL LIVE HERE.");
    return out.join("\n");
  }
  function reportKept() {
    var ids = list();
    if (!ids.length) {
      PRINT("KEEP :: NOTHING IS KEPT YET.");
      return Promise.resolve([]);
    }
    var lines = ["KEPT IN THE RECORD :: " + ids.length + " PICTURE" + (ids.length === 1 ? "" : "S")];
    ids.slice().reverse().forEach(function (id) {
      var V = VAULT();
      var r = V ? V.get(id) : null;
      lines.push("  " + (rowLabelOf(id) || "(no book row)") + "  \u00b7  \"" + (r && r.keep ? r.keep.recipe : "") + "\"  \u00b7  " + (r && r.keep && r.keep.link ? r.keep.link : ""));
    });
    PRINT(lines.join("\n"));
    return Promise.resolve(ids);
  }
  return {
    keep: keep,
    keepWhat: keepWhat,
    keepMany: function (ids) {
      var out = [], chain = Promise.resolve(true);
      (ids || []).forEach(function (id) {
        chain = chain.then(function () { return keep(id).then(function (r) { out.push(r); }); });
      });
      return chain.then(function () { return out; });
    },
    isKept: isKept,
    transfer: transfer,
    isMade: isMade,
    canKeep: canKeep,
    copyLink: copyLink,
    showLink: showLink,
    linkFor: linkFor,
    galleryUrl: galleryUrl,
    pageUrl: pageUrl,
    resolve: resolve,
    list: list,
    report: reportKept,
    describe: describe,
    recipeIdFor: recipeIdFor,
    templateFor: templateFor,
    TAG: TAG
  };
}
return { client: client };
})();
