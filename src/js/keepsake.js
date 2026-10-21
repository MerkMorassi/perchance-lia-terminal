/* ------------------------------------------------------------------
   KEEPSAKE (keepsake) - KEEP, the button on a picture the terminal made.

   Patrikios asked for one press on a picture that keeps EVERYTHING about
   it: "saves the image, the positive and negative prompt, settings and
   seed. Put the image in the gallery, and the prompt in the image prompt
   recipe book and the link to the gallery page. Leave the existing
   download image to local machine intact."

   So KEEP is NOT the existing SAVE, and it does not touch it.
   `window.media.save` (the SAVE button under a picture in the log, and
   SAVE TO DEVICE on the full stage) writes the file out to this machine's
   Downloads folder; that is left exactly as it was. KEEP does the other
   half - it puts the picture into the RECORD:

     the image      the blob is already in the vault, and every picture
                    the vault holds is already in the GALLERY (src/js/
                    gallery.js reads the vault - there is no second copy
                    anywhere, so there is nothing to "move in"). What KEEP
                    adds is the #kept tag, so `#kept` in the gallery's
                    search box - or /gallery find #kept - is that set.
     the prompts    the positive prompt and the negative list are written
                    into THE RECIPE BOOK (src/studio/recipes.json under
                    the device overlay kv lia_settings/recipe_book) as a
                    recipe of their own, named after the picture itself.
     the settings   the seed, the guidance and the size ride INTO that
                    recipe as (seed:::N) (guidanceScale:::N)
     and the seed   (resolution:::WxH) tags - the same syntax his own
                    documents are full of, which src/js/studio.js strips
                    out and routes back to the fields they mean, so the
                    image service never sees them. That means
                    `/recipe <id>` fills the forge form with the picture's
                    own prompt AND its exact seed: the render can be run
                    again, or tuned with one thing changed, which is the
                    whole point of keeping it.
     the link       https://perchance.org/<name>#gallery=<vault id>, kept
                    on the record as keep.link and printed. COPY LINK on
                    the full stage puts it on the clipboard, and opening
                    it opens the gallery on that picture (see
                    openFromHash below). The vault is this browser's own,
                    so the link finds the picture in the browser that
                    holds it - which is the honest scope of any link to it.

   What is written back onto the picture's own record is ONE field,
   `keep` = { recipe, at, by, link }, so nothing that was already on the
   record (the recipe the render came from, its tags, its folder, her
   reading of it) is overwritten by keeping it. The render book
   (src/js/renderbook.js) prints a kept row's recipe name, and the full
   stage says it too.

   Nothing is uploaded anywhere: the picture, the recipe and the link all
   stay in this browser, exactly like the rest of the vault.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var TAG = "kept";                 // the tag every kept picture carries
  var HASH_KEY = "gallery";         // the link shape: #gallery=<vault id>
  var MAX_ID = 60;                  // a recipe name is a filename, kept short

  function low(s) { return String(s == null ? "" : s).toLowerCase(); }

  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  function slug(s) {
    return String(s == null ? "" : s).trim().toLowerCase()
      .replace(/\.[a-z0-9]{2,5}$/, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function stemOf(rec) {
    return String((rec && rec.name) || "").replace(/\.[A-Za-z0-9]{2,5}$/, "");
  }

  /* ---- the link ------------------------------------------------------------
     A link to the TOP-LEVEL page (the subdomain URL cannot be navigated to
     directly - see the platform notes), with a hash that says which picture
     it is. The id is the vault id, which is what everything else here
     addresses a record by; openFromHash() turns it back into a picture.
     ------------------------------------------------------------------------- */
  function pageUrl() {
    var n = (typeof window.generatorName === "string") ? window.generatorName.trim() : "";
    if (!n) return String(location.origin || "") + String(location.pathname || "");
    return "https://perchance.org/" + n;
  }
  function galleryUrl() { return pageUrl() + "#" + HASH_KEY; }
  function linkFor(id) { return pageUrl() + "#" + HASH_KEY + "=" + encodeURIComponent(String(id == null ? "" : id)); }

  /* ---- what may be kept ----------------------------------------------------
     A picture the terminal MADE - a render of hers or of the forge, or an
     upscale of one - and one that was made from a prompt, because the recipe
     is the prompt. A photograph he handed over has no prompt of its own, so
     there is nothing to keep about it that is not already on its record.
     ------------------------------------------------------------------------- */
  function isMade(rec) { return !!(rec && (rec.kind === "gen" || rec.kind === "upscale")); }
  function canKeep(rec) { return !!(isMade(rec) && String((rec && rec.prompt) || "").trim()); }
  function isKept(rec) { return !!(rec && rec.keep && rec.keep.recipe); }

  /* ---- the recipe a picture earns ------------------------------------------
     Its name is the picture's own name (the artifact name every kept thing
     already goes by - the book, the gallery and the file on his disk all
     agree about that), so keeping the same picture twice lands on the same
     recipe instead of making a second one.
     ------------------------------------------------------------------------- */
  function recipeIdFor(rec) {
    var id = slug(stemOf(rec));
    if (!id) id = slug(rec.prompt);
    if (!id) id = "render-" + String(rec.id || "").slice(0, 8);
    if (id.length <= MAX_ID) return id.replace(/-+$/, "");
    // Too long to type: what is cut is the MIDDLE, never the tail - the tail of a made picture's
    // name is its timestamp, and that is the part that makes two pictures of one prompt different.
    // (Cutting the tail instead would let two renders of the same prompt in the same month land on
    // the same recipe name, and the second would quietly replace the first.)
    var tail = id.slice(-18).replace(/^-+/, "");
    var head = id.slice(0, MAX_ID - tail.length - 1).replace(/-+$/, "");
    return head + "-" + tail;
  }

  // The settings, written as the tags the prompt book already routes. Only
  // what is actually on the record is carried: a picture with no seed gets
  // no seed tag, and one of hers (which has no guidance of its own) gets no
  // guidance tag - a default invented here would be a lie about the render.
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
    // The tags ride after the prompt with a SPACE, not a comma: the prompt book takes them back out
    // on the way to the renderer, and a comma in front of one would be left behind as a stray comma
    // at the end of the prompt.
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
    try {
      if (window.renderBook && window.renderBook.labelOf) return String(window.renderBook.labelOf(id) || "");
    } catch (e) { }
    return "";
  }

  function noteFor(rec, link) {
    var row = rowLabelOf(rec.id);
    var bits = ["KEPT IN THE RECORD BY PATRIKIOS"];
    if (row) bits.push(row);
    bits.push(settingsLine(rec));
    if (window.logTime && rec.ts) bits.push(window.logTime.stamp(rec.ts));
    bits.push(link);
    return bits.join("  \u00b7  ");
  }

  function recipeFor(rec, link) {
    return {
      id: recipeIdFor(rec),
      title: stemOf(rec) || String(rec.name || "picture"),
      note: noteFor(rec, link),
      tags: [TAG],
      template: templateFor(rec),
      negative: String(rec.negative || ""),
      slots: {},
      source: "his",
    };
  }

  /* ---- KEEP: the act ------------------------------------------------------- */
  async function keep(id, opts) {
    opts = opts || {};
    if (!window.media) return fail("THE VAULT IS NOT LOADED HERE.");
    await window.media.ensure();
    var rec = window.media.get(id);
    if (!rec) return fail("THERE IS NO RECORD WITH THAT ID IN THE VAULT.");
    if (!canKeep(rec)) {
      return fail(isMade(rec)
        ? "THAT ONE HAS NO PROMPT ON ITS RECORD, SO THERE IS NO RECIPE TO KEEP."
        : "THAT IS NOT A PICTURE THE TERMINAL MADE - KEEP SAVES THE PROMPT, THE NEGATIVE LIST, THE SETTINGS AND THE SEED OF A RENDER OR AN UPSCALE. WHAT YOU HANDED OVER IS ALREADY IN THE VAULT AND THE GALLERY.");
    }
    if (!window.studio || !window.studio.addRecipe) return fail("THE RECIPE BOOK IS NOT LOADED HERE (src/js/studio.js).");

    await window.studio.loadRecipeBook();
    var rid = recipeIdFor(rec);
    var link = linkFor(id);
    var replaced = false;
    try { replaced = !!window.studio.findRecipe(rid); } catch (e) { replaced = false; }

    var added = await window.studio.addRecipe(recipeFor(rec, link));
    if (!added || !added.ok) return fail("THE RECIPE BOOK REFUSED IT :: " + ((added && added.error) || "unknown"));

    // The picture's own record says it has been kept - one field, so nothing
    // that was already on it (the recipe it came from, its tags, its folder,
    // her reading of it) is overwritten by keeping it.
    await window.media.setField(id, "keep", { recipe: rid, at: Date.now(), by: "patrikios", link: link });
    await window.media.tag(id, TAG);

    if (window.gallery && window.gallery.isOpen && window.gallery.isOpen()) {
      try { await window.gallery.refresh(false); } catch (e) { }
    }
    return report({
      ok: true, id: id, rec: window.media.get(id) || rec,
      recipeId: rid, link: link, replaced: replaced, tag: TAG,
      row: rowLabelOf(id), folder: window.media.folderOf ? window.media.folderOf(rec) : "",
    });
  }

  /* ---- KEEP follows a picture that is replaced ------------------------------
     The LOCAL UPSCALE (src/js/upscale-local.js) retires the smaller render it came from, and a KEEP
     is about the RECIPE, not about the file: the same prompt, the same negative list, the same seed
     and the same guidance, describing the same picture - bigger. So the mark and the recipe follow
     it: the new record carries the same `keep`, its gallery link is rewritten to the new id, the
     new record is tagged #kept like the one it replaced, and the recipe's own note (which holds the
     link as plain text) has that link rewritten with it. Nothing is uploaded and no second recipe is
     made - the recipe book keeps ONE entry for ONE recipe, which is what it is for.
     ------------------------------------------------------------------------- */
  async function transfer(oldId, newId) {
    if (!window.media || !oldId || !newId || oldId === newId) return false;
    var oldRec = window.media.get(oldId), newRec = window.media.get(newId);
    if (!oldRec || !newRec || !isKept(oldRec)) return false;
    var oldLink = String((oldRec.keep && oldRec.keep.link) || "") || linkFor(oldId);
    var newLink = linkFor(newId);
    await window.media.setField(newId, "keep", {
      recipe: oldRec.keep.recipe,
      at: oldRec.keep.at || Date.now(),
      by: oldRec.keep.by || "patrikios",
      link: newLink,
    });
    await window.media.tag(newId, TAG);
    // The recipe's note carries the link as plain text (noteFor) - only the link is rewritten, and
    // only if it is really there. (The book row label in that note is written at keep time and may
    // have moved since; that is true of every stored note, so it is left as it was written.)
    try {
      if (window.studio && window.studio.findRecipe && window.studio.addRecipe) {
        await window.studio.loadRecipeBook();
        var r = window.studio.findRecipe(oldRec.keep.recipe);
        if (r && r.source === "his" && String(r.note || "").indexOf(oldLink) !== -1) {
          await window.studio.addRecipe({
            id: r.id, title: r.title, note: String(r.note).split(oldLink).join(newLink),
            tags: r.tags, template: r.template, negative: r.negative, slots: r.slots, source: "his",
          });
        }
      }
    } catch (e) { console.warn("the recipe's gallery link could not be rewritten", e); }
    return true;
  }

  function fail(error) { return report({ ok: false, error: error }); }

  function report(res) {
    res = res || {};
    if (!res.ok) {
      print("SYSTEM", "KEEP :: " + String(res.error || "THAT DID NOT WORK."));
      return res;
    }
    var rec = res.rec || {};
    var lines = [];
    lines.push("KEPT IN THE RECORD :: " + String(stemOf(rec) || rec.id || "").toUpperCase());
    lines.push("  THE IMAGE    :: " + (res.folder || "") + (res.row ? "  \u00b7  " + res.row : "")
      + (window.logTime && rec.ts ? "  \u00b7  " + window.logTime.stamp(rec.ts) : "")
      + (rec.bytes ? "  \u00b7  " + rec.bytes + " BYTES" : ""));
    lines.push("  RECIPE BOOK  :: \"" + res.recipeId + "\" WRITTEN"
      + (res.replaced ? " OVER AN EARLIER RECIPE OF THE SAME NAME" : "")
      + "  \u00b7  /recipe " + res.recipeId + " FILLS THE FORGE WITH IT - SEED INCLUDED");
    lines.push("  THE PROMPT   :: " + clip(rec.prompt, 220));
    lines.push("  NEGATIVE     :: " + (rec.negative ? clip(rec.negative, 160) : "NONE ON THE RECORD"));
    lines.push("  SETTINGS     :: " + settingsLine(rec));
    lines.push("  GALLERY      :: " + res.link);
    lines.push("  THE IMAGE IS IN THE GALLERY AND TAGGED #" + TAG + " - EVERY PICTURE THE VAULT HOLDS IS IN THE GALLERY"
      + " (GALLERY IN THE DECK, OR /gallery), AND #" + TAG + " IN ITS SEARCH BOX IS EVERY KEPT ONE.");
    lines.push("SAVE UNDER THE PICTURE STILL WRITES THE FILE TO THIS MACHINE; KEEP PUTS THE PICTURE IN THE RECORD.");
    lines.push("NOTHING WAS UPLOADED - THE PICTURE, THE RECIPE AND THE LINK ALL LIVE IN THIS BROWSER.");
    print("SYSTEM", lines.join("\n"));
    return res;
  }

  /* ---- the button ----------------------------------------------------------
     One factory, so the log tile, the full stage and the gallery cannot
     drift apart about what KEEP does or when it is lit.
     ------------------------------------------------------------------------- */
  function paint(btn, id, opts) {
    opts = opts || btn.__keepOpts || {};
    var rec = window.media ? window.media.get(id) : null;
    var on = isKept(rec);
    var star = !!opts.star;
    btn.classList.toggle("kept", on);
    btn.textContent = star ? (on ? "\u2605" : "\u2606") : (on ? "KEPT" : "KEEP");
    btn.title = on
      ? ("it is in the record: the recipe book has \"" + rec.keep.recipe + "\" and the gallery link is stored on the picture. /recipe " + rec.keep.recipe + " fills the forge with its prompt and its exact seed. Press again to write those fields again.")
      : "KEEP THIS PICTURE IN THE RECORD :: its prompt, its negative list, its seed, its guidance and its size are written into the RECIPE BOOK as a recipe of their own, the picture is tagged #kept in the gallery, and a link to it in the gallery is stored and printed. The picture itself is already in the gallery (the vault is the gallery) and is NOT moved or uploaded - SAVE still writes the file to this machine.";
    return btn;
  }

  function button(id, opts) {
    opts = opts || {};
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = opts.className || "keep";
    btn.__keepOpts = opts;
    paint(btn, id, opts);
    btn.addEventListener("click", async function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (btn.disabled) return;
      var label = btn.textContent;
      btn.disabled = true;
      if (label !== "\u2605" && label !== "KEPT") btn.textContent = opts.star ? "\u2606" : "KEEPING\u2026";
      try {
        var res = await keep(id);
        var rec = window.media.get(id);
        btn.disabled = false;
        paint(btn, id, opts);
        if (res && res.ok) {
          btn.textContent = opts.star ? "\u2605" : "KEPT";
          window.setTimeout(function () { paint(btn, id, opts); }, 1600);
        } else if (rec) paint(btn, id, opts);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = label;
        print("SYSTEM", "KEEP FAILED :: " + ((err && err.message) ? err.message : err));
      }
    });
    btn.paint = function () { paint(btn, id, opts); };
    return btn;
  }

  /* ---- the full stage ------------------------------------------------------
     The stage's own KEEP button and its COPY LINK button are wired in
     src/js/main.js; openLightbox() calls paintStage() so the button says the
     truth about whatever is on the stage right now.
     ------------------------------------------------------------------------- */
  function paintStage(id) {
    var rec = window.media ? window.media.get(id) : null;
    var keepBtn = document.getElementById("lightboxKeepBtn");
    if (keepBtn) {
      var made = canKeep(rec);
      keepBtn.hidden = !made;
      if (made) paint(keepBtn, id);
    }
    var linkBtn = document.getElementById("lightboxLinkBtn");
    if (linkBtn) linkBtn.hidden = !rec;
  }

  async function copyLink(id) {
    var link = linkFor(id);
    var copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (e) { copied = false; }
    if (!copied) {
      try {
        var ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy") === true;
        ta.remove();
      } catch (e) { copied = false; }
    }
    var rec = window.media ? window.media.get(id) : null;
    if (!copied) {
      print("SYSTEM", "THIS PAGE COULD NOT COPY BY ITSELF, SO HERE IS THE LINK (SELECT IT BY HAND) :: " + link
        + (rec ? "  \u00b7  " + String(stemOf(rec)).toUpperCase() : "")
        + "\nIT OPENS THE GALLERY ON THAT PICTURE. THE VAULT LIVES IN THIS BROWSER, SO IT FINDS IT HERE - NOT ON ANOTHER DEVICE.");
      return { ok: false, link: link, error: "the browser refused the clipboard" };
    }
    print("SYSTEM", "GALLERY LINK COPIED :: " + link
      + (rec ? "  \u00b7  " + String(stemOf(rec)).toUpperCase() : "")
      + "\nIT OPENS THE GALLERY ON THAT PICTURE. THE VAULT LIVES IN THIS BROWSER, SO IT FINDS IT HERE - NOT ON ANOTHER DEVICE.");
    return { ok: true, link: link };
  }

  function showLink(id) {
    var rec = window.media ? window.media.get(id) : null;
    var link = linkFor(id);
    print("SYSTEM", "GALLERY LINK :: " + link
      + (rec ? "\n  " + String(stemOf(rec) || rec.id).toUpperCase()
        + (rec.keep ? "  \u00b7  KEPT AS RECIPE \"" + rec.keep.recipe + "\"" : "  \u00b7  NOT KEPT YET - KEEP WRITES ITS PROMPT, SETTINGS AND SEED INTO THE RECIPE BOOK")
        : "\n  NO RECORD IN THIS VAULT HAS THAT ID."));
    return link;
  }

  /* ---- the link, opened ----------------------------------------------------
     #gallery            open the gallery
     #gallery=<id>       open it on that picture (and put it on the full stage)
     #img=<id>           the same
     The hash is read at boot (main.js) and on hashchange. In the editor the
     hash is the editor's own (#edit), which matches nothing here, so this
     only ever fires on a link that was actually made by keepsake.
     ------------------------------------------------------------------------- */
  async function openFromHash(raw) {
    var h = String(raw == null ? (location.hash || "") : raw || "").replace(/^#/, "");
    if (!h) return false;
    var m = h.match(/^(?:gallery|img|keep|keepsake)(?:[=/](.+))?$/i);
    if (!m) return false;
    if (!window.gallery || !window.media) return false;
    var id = m[1] ? decodeURIComponent(String(m[1]).trim()) : "";
    await window.media.ensure();
    var rec = id ? window.media.get(id) : null;
    if (!id) {
      await window.gallery.open();
      return true;
    }
    if (!rec) {
      await window.gallery.open();
      print("SYSTEM", "THE LINK NAMES A PICTURE THIS BROWSER DOES NOT HOLD (" + id + ")."
        + "\nTHE VAULT IS KEPT IN THE BROWSER THAT MADE THE PICTURE, SO A LINK TO ONE ONLY FINDS IT THERE. THE GALLERY IS OPEN ON EVERYTHING.");
      return true;
    }
    await window.gallery.open({ query: rec.name });
    // THE PAGE THE PICTURE IS ON (src/js/gallery.js, "ONE PAGE AT A TIME"). The grid draws one page
    // of the view at a time, so the grid behind the stage is put on the page that holds this
    // picture rather than left on page 1 of a view that happens to contain it. Nothing moves if the
    // view does not hold it at all.
    try { window.gallery.reveal(id); } catch (e) { }
    try { if (typeof openLightbox === "function") openLightbox(id); } catch (e) { }
    return true;
  }

  /* ---- what /keep reads ----------------------------------------------------
     Bare words are resolved the way the rest of the terminal resolves a
     named thing: a book row (R12), a vault id, a #tag, or words - see
     reader.targets(). With nothing named, /keep takes the newest picture the
     terminal made that is not already kept.
     ------------------------------------------------------------------------- */
  async function resolve(what, opts) {
    opts = opts || {};
    await (window.media ? window.media.ensure() : Promise.resolve());
    var spec = String(what == null ? "" : what).trim();
    if (!spec) {
      var rows = (window.renderBook && window.renderBook.sheet) ? await window.renderBook.sheet() : [];
      for (var i = rows.length - 1; i >= 0; i--) {
        if (!isKept(rows[i].rec)) return { ids: [rows[i].id], label: rows[i].label };
      }
      return { ids: [], label: "" };
    }
    if (window.reader && window.reader.targets) {
      var t = await window.reader.targets(spec, opts);
      if (t && t.ids && t.ids.length) return t;
    }
    return { ids: [], label: spec };
  }

  async function keepWhat(what, opts) {
    var t = await resolve(what, opts);
    if (!t.ids.length) {
      print("SYSTEM", "KEEP :: NOTHING HERE MATCHES \"" + String(what || "").toUpperCase() + "\"."
        + "\n/keep TAKES THE NEWEST RENDER, /keep R12 OR /keep <WORDS|#TAG> NAMES ONE, AND /renders LISTS THEM ALL.");
      return { ok: false, matched: 0 };
    }
    if (t.ids.length > 1) {
      print("SYSTEM", "KEEP :: \"" + String(what || "").toUpperCase() + "\" MEANS " + t.ids.length + " PICTURES - KEEPING "
        + (t.ids.length === 1 ? "IT" : "THE NEWEST ONE") + " (" + t.label + "). /renders <WORDS> NARROWS IT.");
    }
    var id = t.ids[t.ids.length - 1];
    return await keep(id, opts);
  }

  function list() {
    if (!window.media) return [];
    return window.media.list().filter(function (id) { return isKept(window.media.get(id)); });
  }

  function describe() {
    var ids = list();
    var out = ["KEEP :: ONE PRESS THAT PUTS A PICTURE THE TERMINAL MADE INTO THE RECORD (" + ids.length + " KEPT SO FAR)"];
    out.push("  THE IMAGE      :: it is already in the vault, and the vault IS the gallery - every picture in it is in the gallery. KEEP hangs #" + TAG + " on it, so #" + TAG + " in the gallery's search box, or /gallery find #" + TAG + ", is every kept one.");
    out.push("  THE PROMPT     :: the positive prompt and the negative list are written into the RECIPE BOOK as a recipe named after the picture - /recipe <ID> fills the forge form with it.");
    out.push("  THE SETTINGS   :: the seed, the guidance and the size ride in with the recipe as (seed:::N) (guidanceScale:::N) (resolution:::WxH) tags, which the prompt book routes back to the fields - so the render can be run again exactly, or tuned with one thing changed.");
    out.push("  THE LINK       :: " + pageUrl() + "#" + HASH_KEY + "=<ID> - kept on the record and printed. COPY LINK on a picture's full stage puts it on the clipboard, and opening it opens the gallery on that picture (in the browser that holds the vault).");
    out.push("  WHERE IT IS    :: the KEEP button is under every MADE picture in the log (beside SAVE), on the full stage, and on the gallery's own tiles. It is lit and says KEPT once the picture is in the record.");
    out.push("  SAVE IS NOT THIS :: SAVE (under a picture) and SAVE TO DEVICE (full stage) write the file to this machine's Downloads folder and are untouched by any of this. KEEP is about the record, not the file.");
    out.push("  /keep \u00b7 /keep R12 \u00b7 /keep <WORDS|#TAG|VAULT ID> \u00b7 /keep link [R12] \u00b7 /keep list \u00b7 /keep report");
    if (ids.length) {
      out.push("  KEPT :: " + ids.slice(-12).reverse().map(function (id) {
        var r = window.media.get(id);
        return (rowLabelOf(id) || "") + (r.keep ? " \u00b7 " + r.keep.recipe : "");
      }).join("   \u00b7   "));
    }
    out.push("  NOTHING IS UPLOADED. THE PICTURE, THE RECIPE AND THE LINK ALL LIVE IN THIS BROWSER.");
    return out.join("\n");
  }

  async function reportKept() {
    var ids = list();
    if (!ids.length) {
      print("SYSTEM", "KEEP :: NOTHING IS KEPT YET." + "\nA KEPT PICTURE HAS ITS PROMPT, ITS NEGATIVE LIST, ITS SETTINGS AND ITS SEED IN THE RECIPE BOOK, A #"
        + TAG + " TAG IN THE GALLERY, AND A LINK BACK TO IT. THE BUTTON IS UNDER EVERY PICTURE THE TERMINAL MADE - OR /keep.");
      return [];
    }
    var lines = ["KEPT IN THE RECORD :: " + ids.length + " PICTURE" + (ids.length === 1 ? "" : "S")];
    ids.slice().reverse().forEach(function (id) {
      var r = window.media.get(id);
      lines.push("  " + (rowLabelOf(id) || "(no book row)") + "  \u00b7  \"" + (r.keep ? r.keep.recipe : "") + "\"  \u00b7  "
        + (r.keep && r.keep.link ? r.keep.link : ""));
    });
    lines.push("  /recipe <ID> FILLS THE FORGE WITH ONE; /gallery find #" + TAG + " SHOWS THEM; COPY LINK IS ON A PICTURE'S FULL STAGE.");
    print("SYSTEM", lines.join("\n"));
    return ids;
  }

  window.keepsake = {
    keep: keep,
    keepWhat: keepWhat,
    keepMany: async function (ids) {
      var out = [];
      for (var i = 0; i < (ids || []).length; i++) out.push(await keep(ids[i]));
      return out;
    },
    isKept: isKept,
    transfer: transfer,
    isMade: isMade,
    canKeep: function (rec) { return canKeep(rec); },
    button: button,
    paint: paint,
    paintStage: paintStage,
    copyLink: copyLink,
    showLink: showLink,
    linkFor: linkFor,
    galleryUrl: galleryUrl,
    pageUrl: pageUrl,
    resolve: resolve,
    openFromHash: openFromHash,
    list: list,
    report: reportKept,
    describe: describe,
    recipeIdFor: recipeIdFor,
    templateFor: templateFor,
    TAG: TAG,
  };

  window.addEventListener("hashchange", function () {
    try { openFromHash(); } catch (e) { }
  });
})();
