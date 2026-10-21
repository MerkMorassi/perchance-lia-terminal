(function () {
  /* ---- PROMPT RECIPES, THE FOLDER (CREATE IMAGE) --------------------------------
     The RECIPE BOOK (src/studio/recipes.json + kv lia_settings / recipe_book) already
     holds whole prompt templates with named {{slots}} - for the native SDXL pipeline:
     FILL writes one into the forge boxes, /recipe drives it in words, and her own
     [[RECIPE: id :: slot=words]] line composes from it. What it never had is a place
     to SEE them and WORK them: this folder is that place, standing in IMAGE FORGE
     under the RECIPE row.

       OPEN THE FOLDER   every recipe as one row: title, id, BOOK / YOURS / HERS badge,
                         tags, its slots - FILL writes it to the boxes, SHOW prints it,
                         EDIT opens it below, EXPORT downloads it as JSON, DROP takes it
                         out (a shipped one is put away and can be RESTOREd).
       + NEW             a blank editor: id, title, note, tags, the template with
                         {{slots}}, the negative list, and one default + note row per
                         slot the template names. SAVE keeps it on this device, over
                         the shipped seed - which is never rewritten.
       UPLOAD JSON       a .json file in: one recipe, an array, {recipes:[...]}, or a
                         whole book export ({mine:[...]}). Each entry is validated the
                         same way a /recipe save is; the receipt names what landed.
       IMPORT .TXT       raw prompt files in, all at once ("Positive Prompt ..." /
                         "Negative Prompt ..." headers optional) - staged with shared
                         tags, then SAVE ALL keeps every row. The whole-mythos door.
       KEEP BOXES        the forge's current positive + negative boxes into the editor
                         as a new template - a tuned prompt becomes a recipe in one press.

     Hers and his both reach the same book: she composes from it by name (nothing here
     changes her [[RECIPE: ...]] lane), and a recipe of hers she petitions in lands here
     with a HERS badge once accepted. /recipe save|drop|export|reset drive the same
     book in words - see /help recipes.
     --------------------------------------------------------------------------- */

  "use strict";

  function el(id) { return document.getElementById(id); }
  function st() { return window.studio || null; }
  function say(t) { try { if (typeof print === "function") print("SYSTEM", String(t)); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cut(s, n) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026" : t;
  }

  var open = false;
  var editing = null;      // the recipe id under edit, or "@new"
  var slotCache = {};      // slot defaults/notes typed in the editor, kept across repaints
  var staging = [];        // .txt files waiting to be kept: {key,name,id,title,note,tags,template,negative}
  var stageKey = 0;
  var sharedTags = "";     // typed once, kept on every staged row at SAVE ALL
  var STAGE_KEY = "recipe_staging";
  var BOOK_PAGE = 12;      // the reading room pages both shelves: the book...
  var STAGE_PAGE = 10;     // ...and the staging shelf (SAVE ALL always keeps ALL staged)
  var bookPage = 0, stagePage = 0, bookQuery = "";

  // Staging lives in kv, not just memory: a reload must never eat fifty files
  // picked for import. Every stage/edit/drop/save writes it through.
  function stageStore() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }

  function persistStaging() {
    var s = stageStore();
    if (!s) return;
    try {
      if (!staging.length && !sharedTags) {
        var d = s.delete(STAGE_KEY);
        if (d && typeof d.catch === "function") d.catch(function () {});
        return;
      }
      var p = s.set(STAGE_KEY, {
        sharedTags: sharedTags,
        rows: staging.map(function (e) {
          return { key: e.key, name: e.name, id: e.id, title: e.title, note: e.note, tags: e.tags, template: e.template, negative: e.negative, headless: !!e.headless };
        }),
      });
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  async function restoreStaging() {
    var s = stageStore();
    if (!s) return;
    try {
      var raw = await s.get(STAGE_KEY);
      if (!raw || !Array.isArray(raw.rows) || !raw.rows.length) return;
      sharedTags = String(raw.sharedTags || "");
      staging = [];
      raw.rows.forEach(function (r) {
        if (!r || (!r.template && !r.negative)) return;
        staging.push({
          key: (++stageKey),
          name: String(r.name || "untitled"),
          id: String(r.id || "untitled"),
          title: String(r.title || "UNTITLED"),
          note: String(r.note || ""),
          tags: String(r.tags || ""),
          template: String(r.template || ""),
          negative: String(r.negative || ""),
          headless: !!r.headless,
        });
      });
      if (!staging.length) return;
      var filled = 0;
      staging.forEach(function (e) {
        if (!String(e.tags || "").trim()) {
          var kw = tagsFor(keywordSource(e)).join(", ");
          if (kw) { e.tags = kw; filled++; }
        }
        if (!String(e.note || "").trim()) {
          var sg = sightOf(e.template);
          if (sg) { e.note = sg; filled++; }
        }
      });
      if (filled) persistStaging();
      paintStaging();
      say("PROMPT RECIPES :: " + staging.length + " STAGED FILES RESTORED FROM LAST TIME"
        + (filled ? " (" + filled + " EMPTY FIELDS READ AND FILED - KEYWORDS + SIGHT, LIKE THE GALLERY)" : "")
        + " - CHECK THEM IN THE FOLDER, THEN SAVE ALL.");
    } catch (e) {}
  }

  // The toggle always tells the truth: staged files are visible without opening.
  function syncToggle() {
    var b = el("rcToggle");
    if (!b) return;
    if (open) { b.textContent = "CLOSE THE BOOK"; b.setAttribute("aria-expanded", "true"); }
    else {
      b.textContent = "OPEN THE BOOK" + (staging.length ? " (" + staging.length + " STAGED)" : "");
      b.setAttribute("aria-expanded", "false");
    }
  }

  function book() {
    var s = st();
    return (s && typeof s.recipes === "function") ? s.recipes() : [];
  }

  function badge(r) {
    if (r.source === "her") return "HERS";
    if (r.source === "his") return "YOURS";
    return "BOOK";
  }

  function slotNames(template) {
    var out = [], seen = {};
    String(template || "").replace(/\{\{\s*([a-z0-9][a-z0-9_ -]*?)\s*(?:\|\s*[^}]*?)?\}\}/gi, function (all, name) {
      var n = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
      return all;
    });
    return out;
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a);
    try { a.click(); } catch (e) {}
    window.setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (x) {} }, 6000);
  }

  // ---- the list ----------------------------------------------------------------

  function pager(total, page, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    page = Math.max(0, Math.min(page, pages - 1));
    return { pages: pages, page: page, lo: total ? page * size + 1 : 0, hi: Math.min(total, (page + 1) * size) };
  }

  function pagerHtml(pg, total, kind) {
    return '<div class="rcPager"><button type="button" data-' + kind + '="prev"' + (pg.page === 0 ? " disabled" : "") + ">\u00ab PREV</button>"
      + '<span class="rcPageInfo">' + pg.lo + "\u2013" + pg.hi + " OF " + total + " \u00b7 PAGE " + (pg.page + 1) + "/" + pg.pages + "</span>"
      + '<button type="button" data-' + kind + '="next"' + (pg.page >= pg.pages - 1 ? " disabled" : "") + ">NEXT \u00bb</button></div>";
  }

  function filteredBook() {
    var all = book();
    var q = String(bookQuery || "").trim().toLowerCase();
    if (!q) return all.slice();
    return all.filter(function (r) {
      return (String(r.id || "") + " " + String(r.title || "") + " " + String(r.note || "") + " " + ((r.tags || []).join(" "))).toLowerCase().indexOf(q) !== -1;
    });
  }

  function paintList() {
    var list = el("rcList");
    if (!list) return;
    var s = st();
    if (!s) { list.innerHTML = '<div class="rcNote">THE RECIPE BOOK IS NOT LOADED HERE.</div>'; return; }
    var recs = filteredBook();
    if (!recs.length) {
      list.innerHTML = '<div class="rcNote">' + (String(bookQuery || "").trim()
        ? "NOTHING IN THE BOOK MATCHES THAT SEARCH."
        : "THE BOOK IS EMPTY HERE - AN UNSAVED PREVIEW IN A BROWSER WITH NO SERVICE WORKER CANNOT READ src/. UPLOAD A JSON BELOW AND IT STILL WORKS.") + '</div>';
      paintHidden(list);
      return;
    }
    var pg = pager(recs.length, bookPage, BOOK_PAGE);
    bookPage = pg.page;
    var h = recs.slice(pg.page * BOOK_PAGE, (pg.page + 1) * BOOK_PAGE).map(function (r) {
      var slots = [];
      try { slots = s.recipeSlots(r).map(function (x) { return x.name; }); } catch (e) {}
      return '<div class="rcRow" data-id="' + esc(r.id) + '">'
        + '<div class="rcHead"><span class="rcTitle">' + esc(r.title || r.id) + '</span>'
        + ' <span class="rcId">[' + esc(r.id) + ']</span>'
        + ' <span class="rcBadge rc' + esc(badge(r).toLowerCase()) + '">' + esc(badge(r)) + '</span></div>'
        + (r.note ? '<div class="rcNote">' + esc(cut(r.note, 140)) + '</div>' : '')
        + '<div class="rcMeta">' + (r.tags && r.tags.length ? esc(r.tags.join(" \u00b7 ")) + " \u00b7 " : "")
        + esc(slots.length ? slots.join(" \u00b7 ") : "no slots - runs as it stands") + '</div>'
        + '<div class="rcBtns"><button type="button" data-act="fill" title="write the whole filled prompt into the forge boxes">FILL</button>'
        + '<button type="button" data-act="copypos" title="copy the filled positive prompt to the clipboard - paste it into any prompt field">COPY +</button>'
        + '<button type="button" data-act="copyneg" title="copy the negative list to the clipboard - paste it into any negative field">COPY \u2212</button>'
        + '<button type="button" data-act="show" title="print the recipe, every slot and what each holds">SHOW</button>'
        + '<button type="button" data-act="edit" title="open it in the editor below">EDIT</button>'
        + '<button type="button" data-act="export" title="download this recipe as JSON">EXPORT</button>'
        + (r.source === "book"
          ? '<button type="button" data-act="drop" title="put this shipped recipe away (yours are never touched)">HIDE</button>'
          : '<button type="button" data-act="drop" title="take this recipe out of the book">DROP</button>')
        + '</div></div>';
    }).join("");
    if (pg.pages > 1) h += pagerHtml(pg, recs.length, "pg");
    list.innerHTML = h;
    paintHidden(list);
  }

  // Shipped recipes put away with HIDE/DROP are not in the book - list them so one can come back.
  function paintHidden(list) {
    var s = st();
    if (!s || typeof s.hiddenRecipes !== "function") return;
    var hid = [];
    try { hid = s.hiddenRecipes() || []; } catch (e) {}
    if (!hid.length) return;
    var d = document.createElement("div");
    d.className = "rcAway";
    d.innerHTML = '<div class="rcAwayHead">PUT AWAY (' + hid.length + ") :: shipped recipes you hid - nothing deleted</div>"
      + hid.map(function (r) {
        return '<div class="rcRow" data-id="' + esc(r.id) + '"><div class="rcHead"><span class="rcTitle">'
          + esc(r.title || r.id) + '</span> <span class="rcId">[' + esc(r.id) + ']</span></div>'
          + '<div class="rcBtns"><button type="button" data-act="restore" title="bring this shipped recipe back">RESTORE</button></div></div>';
      }).join("");
    list.appendChild(d);
  }

  // ---- the editor ---------------------------------------------------------------

  function paintEditor() {
    var box = el("rcEditor");
    if (!box) return;
    if (!editing) { box.hidden = true; box.innerHTML = ""; return; }
    var s = st();
    var r = (editing !== "@new" && s) ? s.findRecipe(editing) : null;
    var isNew = !r;
    var tpl = isNew ? (slotCache.__template || "") : String(r.template || "");
    box.hidden = false;
    box.innerHTML =
      '<div class="rcEdHead">' + (isNew ? "NEW RECIPE" : "EDITING :: " + esc((r.title || r.id).toUpperCase()))
      + (r && r.source === "book" ? ' <span class="rcNote">a shipped recipe - SAVE keeps yours OVER it; the file is never rewritten</span>' : "")
      + '</div>'
      + '<label class="cpLabel" for="rcId">ID</label>'
      + '<input id="rcId" type="text" spellcheck="false" placeholder="my-shot" value="' + esc(isNew ? (slotCache.__id || "") : r.id) + '"' + (isNew ? "" : " disabled") + '>'
      + '<label class="cpLabel" for="rcTitle">TITLE</label>'
      + '<input id="rcTitle" type="text" spellcheck="false" placeholder="THE MIDNIGHT ALTAR" value="' + esc(isNew ? (slotCache.__title || "") : (r.title || "")) + '">'
      + '<label class="cpLabel" for="rcNote">NOTE</label>'
      + '<input id="rcNote" type="text" spellcheck="false" placeholder="what this frame is for" value="' + esc(isNew ? (slotCache.__note || "") : (r.note || "")) + '">'
      + '<label class="cpLabel" for="rcTags">TAGS</label>'
      + '<input id="rcTags" type="text" spellcheck="false" placeholder="portrait, altar, sdxl" value="' + esc(isNew ? (slotCache.__tags || "") : ((r.tags || []).join(", "))) + '">'
      + '<label class="cpLabel" for="rcTemplate">TEMPLATE ({{slot}} MARKS A SLOT)</label>'
      + '<textarea id="rcTemplate" rows="4" spellcheck="false" placeholder="{{subject}}. Setting: {{setting}}. {{quality}}"></textarea>'
      + '<label class="cpLabel" for="rcNegative">NEGATIVE (BLANK = THE HOUSE LIST)</label>'
      + '<textarea id="rcNegative" rows="2" spellcheck="false" placeholder="leave blank to use the house list"></textarea>'
      + '<div id="rcSlotBox"></div>'
      + '<div class="rcBtns"><button type="button" id="rcSave">SAVE RECIPE</button>'
      + '<button type="button" id="rcCancel">CANCEL</button>'
      + '<span class="cpNote" id="rcEdNote"></span></div>';
    el("rcTemplate").value = tpl;
    el("rcNegative").value = isNew ? (slotCache.__negative || "") : ((r.negative === "house") ? "" : String(r.negative || ""));
    if (isNew && !slotCache.__seeded && !tpl) {
      // A working shape to start from, not an empty box.
      el("rcTemplate").value = "{{subject}}. Setting: {{setting}}. Lighting: {{lighting}}. {{quality}}";
    }
    paintSlots();
    el("rcTemplate").addEventListener("input", function () { paintSlots(); });
    ["rcId", "rcTitle", "rcNote", "rcTags", "rcNegative"].forEach(function (id) {
      var n = el(id);
      if (n) n.addEventListener("input", stashEditor);
    });
    el("rcSave").addEventListener("click", saveEditor);
    el("rcCancel").addEventListener("click", function () { editing = null; slotCache = {}; paintEditor(); });
  }

  function stashEditor() {
    slotCache.__id = el("rcId") ? el("rcId").value : "";
    slotCache.__title = el("rcTitle") ? el("rcTitle").value : "";
    slotCache.__note = el("rcNote") ? el("rcNote").value : "";
    slotCache.__tags = el("rcTags") ? el("rcTags").value : "";
    slotCache.__template = el("rcTemplate") ? el("rcTemplate").value : "";
    slotCache.__negative = el("rcNegative") ? el("rcNegative").value : "";
    stashSlots();
  }

  function stashSlots() {
    var box = el("rcSlotBox");
    if (!box) return;
    var ds = box.querySelectorAll("[data-slot-def]");
    for (var i = 0; i < ds.length; i++) {
      var n = ds[i].getAttribute("data-slot-def");
      slotCache["def:" + n] = ds[i].value;
    }
    var ns = box.querySelectorAll("[data-slot-note]");
    for (var j = 0; j < ns.length; j++) {
      var m = ns[j].getAttribute("data-slot-note");
      slotCache["note:" + m] = ns[j].value;
    }
  }

  function paintSlots() {
    var box = el("rcSlotBox");
    if (!box) return;
    stashSlots();
    var tpl = el("rcTemplate") ? el("rcTemplate").value : "";
    slotCache.__template = tpl;
    var names = slotNames(tpl);
    var s = st();
    var r = (editing && editing !== "@new" && s) ? s.findRecipe(editing) : null;
    if (!names.length) { box.innerHTML = '<div class="rcNote">NO {{SLOTS}} IN THE TEMPLATE - IT RUNS AS IT STANDS.</div>'; return; }
    box.innerHTML = '<div class="rcSlotHead">SLOTS (' + names.length + ") :: one default each - blank keeps the inline {{slot|fallback}} or nothing</div>"
      + names.map(function (n) {
        var cur = (r && r.slots && r.slots[n]) || {};
        var def = (slotCache["def:" + n] != null) ? slotCache["def:" + n] : String(cur.def || cur.default || "");
        var note = (slotCache["note:" + n] != null) ? slotCache["note:" + n] : String(cur.note || "");
        return '<div class="rcSlot"><div class="rcSlotName">{{' + esc(n) + '}}</div>'
          + '<input type="text" data-slot-def="' + esc(n) + '" spellcheck="false" placeholder="the house wording for ' + esc(n) + '" value="' + esc(def) + '">'
          + '<input type="text" data-slot-note="' + esc(n) + '" spellcheck="false" placeholder="what this slot is for (optional)" value="' + esc(note) + '"></div>';
      }).join("");
  }

  async function saveEditor() {
    var s = st();
    if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
    stashEditor();
    var id = (editing === "@new") ? String(slotCache.__id || "").trim() : String(editing);
    var template = String(slotCache.__template || "").trim();
    var note = el("rcEdNote");
    if (!id) { if (note) note.textContent = "NAME AN ID FIRST."; return; }
    if (!template) { if (note) note.textContent = "THE TEMPLATE IS EMPTY."; return; }
    var names = slotNames(template);
    var slots = {};
    names.forEach(function (n) {
      slots[n] = { default: String(slotCache["def:" + n] || ""), note: String(slotCache["note:" + n] || "").trim() };
    });
    var rec = {
      id: id,
      title: String(slotCache.__title || "").trim() || id,
      note: String(slotCache.__note || "").trim(),
      tags: String(slotCache.__tags || "").split(",").map(function (t) { return String(t).trim(); }).filter(Boolean),
      template: template,
      negative: String(slotCache.__negative || "").trim(),
      slots: slots,
    };
    var out = await s.addRecipe(rec);
    if (!out || !out.ok) {
      var err = (out && out.error) ? out.error : "IT COULD NOT BE SAVED.";
      if (note) note.textContent = err.toUpperCase();
      say("PROMPT RECIPES :: NOT SAVED :: " + err);
      return;
    }
    say("PROMPT RECIPES :: KEPT :: " + String(out.recipe.title || out.recipe.id).toUpperCase() + " [" + out.recipe.id + "]"
      + (out.replacedShipped ? " - KEPT OVER THE SHIPPED ONE, WHICH IS HIDDEN, NOT REWRITTEN." : " - ON THIS DEVICE.")
      + " SHE REACHES IT BY NAME: [[RECIPE: " + out.recipe.id + "]]");
    editing = null; slotCache = {};
    paintEditor();
    refresh();
  }

  // ---- upload -------------------------------------------------------------------

  // One recipe, an array, {recipes:[...]}, or a whole book export ({mine:[...]}).
  function entriesOf(d) {
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object") {
      if (Array.isArray(d.recipes)) return d.recipes;
      if (Array.isArray(d.mine)) return d.mine;
      if (typeof d.template === "string") return [d];
    }
    return null;
  }

  async function importFile(file) {
    var s = st();
    if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
    if (!file) return;
    var text = "";
    try {
      text = (typeof file.text === "function") ? await file.text() : await new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result || "")); };
        fr.onerror = function () { rej(new Error("unreadable")); };
        fr.readAsText(file);
      });
    } catch (e) { say("PROMPT RECIPES :: THE FILE COULD NOT BE READ."); return; }
    var d = null;
    try { d = JSON.parse(text); }
    catch (e) { say("PROMPT RECIPES :: NOT JSON - THE FOLDER TAKES RECIPE JSON (ONE RECIPE, AN ARRAY, OR A BOOK EXPORT)."); return; }
    var entries = entriesOf(d);
    if (!entries) { say("PROMPT RECIPES :: NOTHING THAT READS AS A RECIPE WAS FOUND - HAND IT ONE RECIPE, AN ARRAY, OR {recipes:[...]} / A BOOK EXPORT."); return; }
    var kept = [], failed = [];
    for (var i = 0; i < entries.length; i++) {
      try {
        var out = await s.addRecipe(entries[i]);
        if (out && out.ok) kept.push(out.recipe.id);
        else failed.push((entries[i] && entries[i].id) || ("#" + (i + 1)));
      } catch (e) { failed.push((entries[i] && entries[i].id) || ("#" + (i + 1))); }
    }
    say("PROMPT RECIPES :: UPLOAD :: " + kept.length + " KEPT" + (kept.length ? " (" + kept.join(", ") + ")" : "")
      + (failed.length ? " \u00b7 " + failed.length + " REFUSED (" + failed.join(", ") + " - A RECIPE NEEDS AN ID AND A TEMPLATE)" : "")
      + " - ON THIS DEVICE, OVER THE SHIPPED SEED.");
    refresh();
  }

  // ---- .txt bulk import -----------------------------------------------------------
  // Raw prompt files in, all at once: each file reads as "Positive Prompt <text>
  // Negative Prompt <text>" (the headers are optional - a file without them is
  // one whole template, no negative). Nothing is kept on pick: every file is
  // STAGED first - id, title, tags and note checked per row, shared tags across
  // the batch - then SAVE ALL keeps each row through the same addRecipe a /recipe
  // save goes through. Built for a whole mythos at once: tag all fifty with the
  // cult and she works the shelf by tag.

  function cleanId(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // ---- auto-tag (the gallery's reading, for words) ---------------------------------
  // The gallery reads every incoming picture once (vision lane: tags + a one-line
  // sight, filed on the record). A staged row IS its own words, so no model is
  // needed: the keywords are counted out of the text - stopwords and prompt
  // boilerplate thrown away, what is left ranked by count - and the sight is the
  // opening line. Both land on the row at import (tags + note, still editable),
  // travel through kv, and SAVE ALL files them on the recipe. Nothing handwritten
  // is ever overwritten: the restore pass only fills a field left empty.
  var STOPWORDS = ("a,an,the,and,or,but,if,then,else,when,while,with,without,within,into,onto,upon,from,for,of,to,in,on,at,by,as,is,are,was,were,be,been,being,have,has,had,do,does,did,will,would,shall,should,can,could,may,might,must,not,no,yes,very,more,most,less,least,much,many,each,every,all,some,any,such,own,same,other,another,one,two,three,her,hers,his,him,her,its,it,they,them,their,she,he,you,your,we,our,this,that,these,those,there,here,where,which,who,whom,what,how,why,like,unlike,because,until,against,between,through,during,before,after,above,below,under,over,again,further,once,also,just,only,even,still,yet,both,either,neither,nor,so,than,too,out,off,up,down,around,along,across,behind,beyond,plus,per,via,using,used,use,wearing,wears,worn,showing,shows,shown,looking,looks,seen,standing,sitting,lying,laying,front,side,back,top,bottom,full,half,close,wide,medium,shot,view,angle,looking,looking at,camera,photo,photograph,photography,photographic,photorealistic,image,picture,portrait,painting,drawing,illustration,render,digital,artwork,art,style,detailed,highly,intricate,sharp,focus,quality,masterpiece,best,ultra,hyper,super,extremely,very,realistic,lifelike,natural,professional,studio,lighting,light,lights,soft,bright,dark,shadow,shadows,background,backdrop,setting,scene,composition,framing,centered,symmetrical,asymmetrical,color,colors,colour,colours,tone,tones,vibrant,vivid,rich,deep,black,white").split(",");
  // Negative-lexicon: words that only ever describe what is KEPT OUT. Some files
  // carry their quality list inline in the template itself, so template-only
  // sourcing is not enough - these are never useful as tags and are thrown away.
  var STOPSET = {};
  STOPWORDS.forEach(function (w) { STOPSET[w] = 1; });
  var NEGWORDS = ("bad,poorly,drawn,deformed,extra,ugly,blurry,blur,watermark,logo,logos,text,texts,signature,mutated,disfigured,mangled,missing,broken,worst,artifact,artifacts,grainy,noisy,amateur,duplicate,duplicates,morbid,mutilated,cropped,oversaturated,underexposed,overexposed,jpeg,gross,distorted,distortion,warped,decentered,tilted").split(",");
  NEGWORDS.forEach(function (w) { STOPSET[w] = 1; });

  function keywordsOf(text, max) {
    max = max || 10;
    var counts = {}, first = {}, order = 0;
    String(text || "").toLowerCase().replace(/'/g, "").split(/[^a-z]+/).forEach(function (tok) {
      if (!tok || tok.length < 3 || STOPSET[tok] || /^\d+$/.test(tok)) return;
      if (!counts[tok]) { counts[tok] = 0; first[tok] = order++; }
      counts[tok]++;
    });
    return Object.keys(counts).sort(function (a, b) {
      return (counts[b] - counts[a]) || (first[a] - first[b]);
    }).slice(0, max);
  }

  // THE CHARACTERISTICS PASS. A position named once in a file is still THE
  // characteristic of that file, so acts and positions are matched as whole
  // phrases first (frequency would bury them), and single-word characteristics
  // ride the keyword count. Nothing sexual is ever stopworded: cock, ass, anal,
  // pussy, cum and the rest are kept by the count below - this list only adds
  // the multiword positions frequency would shred ("doggy style" must never
  // become no tag at all just because "style" is boilerplate).
  var ACTS = ("doggy style,doggystyle,prone bone,missionary,cowgirl,reverse cowgirl,girl on top,standing,kneeling,bent over,bending over,on all fours,all fours,spooning,lotus,piledriver,scissoring,sixty nine,69,blowjob,blow job,deepthroat,deep throat,face sitting,facesitting,titjob,handjob,footjob,anal,vaginal,oral,cunnilingus,fellatio,pearl necklace,creampie,facial,squirting,ejaculating,penetration,double penetration,threesome,foursome,orgy,masturbation,fingering,fisting,rimming").split(",");
  var ACTSET = {};
  ACTS.forEach(function (a) { ACTSET[a] = 1; });

  // Keywords come from the TEMPLATE only - the negative list is what is KEPT OUT
  // of the picture, so its words ("bad", "poorly", "drawn") would tag every row
  // with what it is not. Routing tags (key:::value) are stripped first: "seed"
  // is plumbing, not a keyword.
  function keywordSource(e) {
    return String((e && e.template) || "").replace(/\([^()]*?:::[^()]*?\)/g, " ");
  }

  // Phrases first (capped), then the keyword count fills to the cap - skipping
  // any keyword a phrase already covers, so "anal" never lands twice.
  function tagsFor(template) {
    var norm = (" " + String(template || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ").replace(/\s+/g, " ");
    var out = [], covered = {};
    for (var i = 0; i < ACTS.length && out.length < 6; i++) {
      if (norm.indexOf(" " + ACTS[i] + " ") !== -1) {
        out.push(ACTS[i]);
        var ws = ACTS[i].split(" ");
        for (var j = 0; j < ws.length; j++) covered[ws[j]] = 1;
        covered[ACTS[i].replace(/ /g, "")] = 1;
      }
    }
    var kw = keywordsOf(template, 12);
    for (var k = 0; k < kw.length && out.length < 12; k++) {
      if (!covered[kw[k]]) out.push(kw[k]);
    }
    return out;
  }

  function sightOf(template) {
    return cut(String(template || ""), 140);
  }

  function parseTxt(name, text) {
    var t = String(text || "").replace(/\r\n?/g, "\n");
    var lines = t.split("\n"), tpl = [], neg = [], mode = "pos", headed = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (/^\s*positive\s*prompt\s*:?\s*$/i.test(l)) { mode = "pos"; headed = true; continue; }
      if (/^\s*negative\s*prompt\s*:?\s*$/i.test(l)) { mode = "neg"; headed = true; continue; }
      (mode === "neg" ? neg : tpl).push(l);
    }
    var base = String(name || "untitled").replace(/\.[^.\\/]*$/, "").trim() || "untitled";
    return {
      id: cleanId(base) || "untitled",
      title: base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase() || "UNTITLED",
      template: tpl.join("\n").trim(),
      negative: neg.join("\n").trim(),
      headless: !headed,
    };
  }

  function importTexts(files) {
    var s = st();
    if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
    var arr = Array.isArray(files) ? files : [];
    var added = 0, empty = 0, dups = 0;
    arr.forEach(function (f) {
      var p = parseTxt(f && f.name, f && f.text);
      if (!p.template && !p.negative) { empty++; return; }
      var size = p.template.length + p.negative.length;
      // Same filename + same size already staged = the same pick twice, not two files.
      var isDup = staging.some(function (e) {
        return e.name === String((f && f.name) || "untitled")
          && (String(e.template || "").length + String(e.negative || "").length) === size;
      });
      if (isDup) { dups++; return; }
      var id = p.id, k = 2;
      var taken = function (x) {
        if (staging.some(function (e) { return cleanId(e.id) === x; })) return true;
        try { return !!(s && s.findRecipe(x)); } catch (e) { return false; }
      };
      while (taken(id)) id = p.id + "-" + (k++);
      staging.push({
        key: (++stageKey),
        name: String((f && f.name) || "untitled"),
        id: id,
        title: p.title,
        note: sightOf(p.template),
        tags: tagsFor(keywordSource({ template: p.template })).join(", "),
        template: p.template,
        negative: p.negative,
        headless: p.headless,
      });
      added++;
    });
    if (!added) { say("PROMPT RECIPES :: NOTHING TO STAGE - THE FILES HELD NO TEXT."); return; }
    say("PROMPT RECIPES :: STAGED " + added + (empty ? " (" + empty + " EMPTY, SKIPPED)" : "") + (dups ? " (" + dups + " ALREADY STAGED, SKIPPED)" : "")
      + " - EACH ROW READ ONCE (KEYWORD TAGS + A SIGHT LINE, LIKE THE GALLERY - STILL EDITABLE)"
      + " - IN THE BOOK, DIRECTLY UNDER THE SHARED TAGS: CHECK IDS, TITLES AND TAGS, THEN SAVE ALL.");
    stagePage = 0;
    paintStaging();
    persistStaging();
    openModal();
  }

  function paintStaging() {
    var box = el("rcStage");
    if (!box) return;
    if (!staging.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    var h = '<div class="rcStageHead">STAGED FROM .TXT (' + staging.length + ") :: CHECK, THEN SAVE ALL</div>"
      + '<label class="cpLabel" for="rcSharedTags">SHARED TAGS (ON EVERY ROW - THE MYTHOS)</label>'
      + '<input id="rcSharedTags" type="text" spellcheck="false" placeholder="mythos, kali-malindra, cult-of-fire, sdxl" value="' + esc(sharedTags) + '">'
      + '<div class="rcBtns"><button type="button" id="rcSaveAllTop">SAVE ALL (' + staging.length + ')</button>'
      + '<button type="button" id="rcCopyAllTop" title="every staged row into the forge boxes - all positives into POSITIVE PROMPT, all negatives (duplicates folded) into NEGATIVE PROMPT - and the whole bundle onto the clipboard">COPY ALL (' + staging.length + ')</button>'
      + '<span class="cpNote">PAGE THROUGH ALL ' + staging.length + ' BELOW - EACH ROW SHOWS ITS OWN WORDS</span></div>';
    var spg = pager(staging.length, stagePage, STAGE_PAGE);
    stagePage = spg.page;
    if (spg.pages > 1) h += pagerHtml(spg, staging.length, "spg");
    h += staging.slice(spg.page * STAGE_PAGE, (spg.page + 1) * STAGE_PAGE).map(function (e) {
      var size = String(e.template || "").length + String(e.negative || "").length;
      return '<div class="rcStageRow" data-key="' + e.key + '">'
        + '<div class="rcHead"><span class="rcTitle">' + esc(e.name) + '</span>'
        + ' <span class="rcMeta">' + size + " chars"
        + (e.headless ? " \u00b7 no headers - whole file as template" : "")
        + (e.negative ? "" : " \u00b7 no negative") + "</span></div>"
        + '<div class="rcTxtPrev">' + esc(cut(e.template, 220)) + '</div>'
        + (e.negative ? '<div class="rcTxtPrev rcNeg">NEG :: ' + esc(cut(e.negative, 140)) + '</div>' : '')
        + '<pre class="rcTxtFull" hidden>' + esc(e.template)
        + (e.negative ? "\n\n--- NEGATIVE ---\n" + esc(e.negative) : "") + '</pre>'
        + '<div class="rcGrid">'
        + '<div class="rcField"><label class="cpLabel">ID</label><input type="text" data-f="id" spellcheck="false" value="' + esc(e.id) + '"></div>'
        + '<div class="rcField"><label class="cpLabel">TITLE</label><input type="text" data-f="title" spellcheck="false" value="' + esc(e.title) + '"></div>'
        + '<div class="rcField"><label class="cpLabel">TAGS (THIS ROW)</label><input type="text" data-f="tags" spellcheck="false" placeholder="throne, portrait" value="' + esc(e.tags) + '"></div>'
        + '<div class="rcField"><label class="cpLabel">NOTE</label><input type="text" data-f="note" spellcheck="false" placeholder="what this frame is for" value="' + esc(e.note) + '"></div>'
        + '</div>'
        + '<div class="rcBtns"><button type="button" data-stage="read">READ IT</button><button type="button" data-stage="drop">REMOVE</button></div></div>';
    }).join("");
    h += '<div class="rcBtns"><button type="button" id="rcSaveAll">SAVE ALL (' + staging.length + ')</button>'
      + '<button type="button" id="rcCopyAll">COPY ALL (' + staging.length + ')</button>'
      + '<button type="button" id="rcStageClear">DISCARD</button>'
      + '<span class="cpNote" id="rcStageNote"></span></div>';
    box.innerHTML = h;
    var shared = el("rcSharedTags");
    if (shared) shared.addEventListener("input", function () { sharedTags = shared.value; persistStaging(); });
    var save = el("rcSaveAll");
    if (save) save.addEventListener("click", saveStaging);
    var saveTop = el("rcSaveAllTop");
    if (saveTop) saveTop.addEventListener("click", saveStaging);
    var copy = el("rcCopyAll");
    if (copy) copy.addEventListener("click", copyAllStaging);
    var copyTop = el("rcCopyAllTop");
    if (copyTop) copyTop.addEventListener("click", copyAllStaging);
    var clear = el("rcStageClear");
    if (clear) clear.addEventListener("click", function () { staging = []; stagePage = 0; paintStaging(); persistStaging(); });
    Array.prototype.forEach.call(box.querySelectorAll(".rcStageRow"), function (row) {
      var key = Number(row.getAttribute("data-key"));
      Array.prototype.forEach.call(row.querySelectorAll("input[data-f]"), function (inp) {
        inp.addEventListener("input", function () {
          for (var i = 0; i < staging.length; i++) {
            if (staging[i].key === key) { staging[i][inp.getAttribute("data-f")] = inp.value; break; }
          }
          persistStaging();
        });
      });
      var drop = row.querySelector('button[data-stage="drop"]');
      if (drop) drop.addEventListener("click", function () {
        staging = staging.filter(function (x) { return x.key !== key; });
        paintStaging();
        persistStaging();
      });
      var read = row.querySelector('button[data-stage="read"]');
      if (read) read.addEventListener("click", function () {
        var full = row.querySelector(".rcTxtFull");
        if (!full) return;
        full.hidden = !full.hidden;
        read.textContent = full.hidden ? "READ IT" : "CLOSE IT";
      });
    });
    syncToggle();
  }

  async function saveStaging() {
    var s = st();
    if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
    var shared = String(sharedTags || "").split(",").map(function (t) { return String(t).trim(); }).filter(Boolean);
    var rows = staging.slice();
    // Ids first, all of them: cleaned, and no two rows share one (the book
    // check covers what is already kept - earlier rows land as we save).
    var seen = {};
    rows.forEach(function (e) {
      var id = cleanId(e.id) || "untitled";
      var k = 2;
      var clash = function (x) {
        if (seen[x]) return true;
        try { return !!(s && s.findRecipe(x)); } catch (err) { return false; }
      };
      while (clash(id)) id = cleanId(e.id) + "-" + (k++);
      seen[id] = 1;
      e._id = id;
    });
    var kept = [], failed = [], skipped = [];
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      var template = String(e.template || "").trim();
      if (!template) { skipped.push(e.name + " (empty)"); continue; }
      var tags = String(e.tags || "").split(",").map(function (t) { return String(t).trim(); }).filter(Boolean);
      shared.forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
      try {
        var out = await s.addRecipe({
          id: e._id,
          title: String(e.title || "").trim() || e._id,
          note: String(e.note || "").trim(),
          tags: tags,
          template: template,
          negative: String(e.negative || "").trim(),
          slots: {},
        });
        if (out && out.ok) kept.push(out.recipe.id);
        else failed.push(e.name);
      } catch (err) { failed.push(e.name); }
    }
    staging = [];
    paintStaging();
    persistStaging();
    say("PROMPT RECIPES :: BULK .TXT :: " + kept.length + " KEPT" + (kept.length ? " (" + kept.join(", ") + ")" : "")
      + (failed.length ? " \u00b7 " + failed.length + " REFUSED (" + failed.join(", ") + ")" : "")
      + (skipped.length ? " \u00b7 " + skipped.length + " SKIPPED (" + skipped.join(", ") + ")" : "")
      + " - ON THIS DEVICE, OVER THE SHIPPED SEED.");
    refresh();
  }

  // ---- COPY ALL -------------------------------------------------------------------
  // Every staged row into the forge boxes: all positives into POSITIVE PROMPT,
  // all negatives into NEGATIVE PROMPT (exact duplicates folded - eighty files
  // often share one house list), and the whole bundle, titled per row, onto the
  // clipboard. Built in chunks with progress in the stage note, so a whole
  // mythos never freezes the page - that is the asynchronous part. The boxes
  // are then where CREATE looks, so the forge is revealed and the room closes,
  // exactly like FILL. Nothing is kept and nothing is staged away: SAVE ALL is
  // the one that keeps, DISCARD the one that drops.
  function tick() { return new Promise(function (res) { window.setTimeout(res, 0); }); }

  async function copyAllStaging() {
    if (!staging.length) { say("PROMPT RECIPES :: NOTHING STAGED - PICK .TXT FILES FIRST."); return; }
    var note = el("rcStageNote");
    var rows = staging.slice();
    var positives = [], negatives = [], seenNeg = {}, bundle = [];
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      var t = String(e.template || "").trim();
      var n = String(e.negative || "").trim();
      if (t) positives.push(t);
      if (n && !seenNeg[n]) { seenNeg[n] = 1; negatives.push(n); }
      bundle.push("===== " + String(e.title || e.id || "UNTITLED") + " [" + String(e.id || "?") + "]\n" + t
        + (n ? "\n\n--- NEGATIVE ---\n" + n : ""));
      if (i % 8 === 7) {
        if (note) note.textContent = "COPYING " + (i + 1) + " / " + rows.length + " ...";
        await tick();
      }
    }
    var posText = positives.join("\n\n");
    var negText = negatives.join("\n\n");
    var pEl = el("cpPrompt"), nEl = el("cpNegative");
    if (pEl && posText) pEl.value = posText;
    if (nEl && negText) nEl.value = negText;
    var clipText = bundle.join("\n\n");
    var copied = await copyText(clipText, "THE WHOLE STAGED SHELF (" + rows.length + ")");
    try { document.getElementById("createPanel").hidden = false; } catch (e2) {}
    closeModal();
    say("PROMPT RECIPES :: COPY ALL :: " + rows.length + " STAGED ROWS ARE IN THE FORGE BOXES"
      + " (POSITIVE " + posText.length + " CHARS" + (negText ? ", NEGATIVE " + negText.length + " CHARS FROM " + negatives.length + " LISTS" : ", NO NEGATIVES STAGED")
      + ") - CREATE RENDERS THEM, KEEP BOXES AS RECIPE FILES THEM"
      + (copied ? ", AND THE TITLED BUNDLE IS ON THE CLIPBOARD." : "."));
    if (note) note.textContent = "";
  }

  // ---- row actions ----------------------------------------------------------------

  // COPY: the filled words onto the clipboard, through the side-effect-free render -
  // nothing is held, nothing is written, the boxes are untouched. FILL is the one
  // that populates the forge boxes (and closes the reading room over them).
  async function copyText(t, label) {
    var s = String(t == null ? "" : t);
    if (!s.trim()) { say("PROMPT RECIPES :: NOTHING TO COPY - THAT SIDE IS EMPTY."); return false; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(s);
      else throw new Error("no clipboard");
      say("PROMPT RECIPES :: " + label + " ON THE CLIPBOARD (" + s.length + " CHARS) - PASTE IT WHERE IT GOES.");
      return true;
    } catch (e) {
      try {
        var ta = document.createElement("textarea");
        ta.value = s;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        say(ok ? ("PROMPT RECIPES :: " + label + " ON THE CLIPBOARD (" + s.length + " CHARS) - PASTE IT WHERE IT GOES.")
          : "PROMPT RECIPES :: COPY FAILED HERE - READ IT AND COPY BY HAND.");
        return !!ok;
      } catch (e2) { say("PROMPT RECIPES :: COPY FAILED HERE - READ IT AND COPY BY HAND."); return false; }
    }
  }

  async function rowAction(id, act) {
    var s = st();
    if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
    if (act === "fill") {
      try {
        if (window.forgeRecipes && window.forgeRecipes.fill) {
          var fr = window.forgeRecipes.fill(id, { write: true, who: "BOOK" });
          if (fr) {
            try { document.getElementById("createPanel").hidden = false; } catch (e2) {}
            closeModal();
          }
        }
        else say("PROMPT RECIPES :: THE FORGE IS NOT LOADED HERE.");
      } catch (e) { say("PROMPT RECIPES :: FILL FAILED :: " + String((e && e.message) || e)); }
      return;
    }
    if (act === "copypos" || act === "copyneg") {
      try {
        if (!s.renderRecipe) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
        var out = s.renderRecipe(id);
        if (!out || !out.ok) { say("PROMPT RECIPES :: THAT COULD NOT BE READ - TRY SHOW IT."); return; }
        await copyText(act === "copypos" ? out.text : (out.negative || ""),
          (act === "copypos" ? "POSITIVE OF " : "NEGATIVE OF ") + String(id).toUpperCase());
      } catch (e) { say("PROMPT RECIPES :: COPY FAILED :: " + String((e && e.message) || e)); }
      return;
    }
    if (act === "show") {
      try {
        if (window.forgeRecipes && window.forgeRecipes.print) window.forgeRecipes.print(id);
        else say("PROMPT RECIPES :: THE FORGE IS NOT LOADED HERE.");
      } catch (e) {}
      return;
    }
    if (act === "edit") { editing = id; slotCache = {}; openModal(); paintEditor(); return; }
    if (act === "export") {
      var r = s.findRecipe(id);
      if (!r) { say("PROMPT RECIPES :: NO RECIPE CALLED " + String(id).toUpperCase() + " IN THE BOOK."); return; }
      download("recipe-" + r.id + ".json", JSON.stringify(r, null, 2));
      say("PROMPT RECIPES :: " + String(r.title || r.id).toUpperCase() + " IS ON ITS WAY DOWN - ONE RECIPE AS JSON, SLOTS AND ALL.");
      return;
    }
    if (act === "drop") {
      var out = await s.removeRecipe(id);
      if (!out || !out.ok) { say("PROMPT RECIPES :: NOT DROPPED :: " + ((out && out.error) || "UNKNOWN")); return; }
      say("PROMPT RECIPES :: " + (out.hidden ? "PUT AWAY (A SHIPPED RECIPE - RESTORE BRINGS IT BACK)." : "DROPPED.") + " " + String((out.recipe && (out.recipe.title || out.recipe.id)) || id).toUpperCase());
      refresh();
      return;
    }
    if (act === "restore") {
      if (typeof s.restoreRecipe !== "function") { say("PROMPT RECIPES :: THIS BUILD CANNOT RESTORE ONE RECIPE - /recipe reset BRINGS THEM ALL BACK."); return; }
      var ok = await s.restoreRecipe(id);
      say(ok ? "PROMPT RECIPES :: RESTORED :: " + String(id).toUpperCase() + " IS BACK IN THE BOOK."
        : "PROMPT RECIPES :: NOTHING CALLED " + String(id).toUpperCase() + " WAS PUT AWAY.");
      refresh();
      return;
    }
  }

  // ---- open / refresh / wire -------------------------------------------------------

  // ---- the reading room (the modal) -------------------------------------------------
  // #rcFolder moves into the sheet while the book is open, so the list, the
  // staging shelf and the editor keep every wire they have; it moves home on
  // close. Nothing is ever lost by closing - staged files persist in kv.
  // The button bar (#rcBar: OPEN/CLOSE, + NEW, UPLOAD, IMPORT .TXT, KEEP,
  // EXPORT) rides along the same way - otherwise it sits behind the overlay
  // and the reading room opens with no controls at all.
  // The modal NODE itself moves onto document.body while open: it lives inside
  // #command-deck (a fixed layer at 100), and the forge panel goes fullscreen
  // at 300 whenever it is open - so a modal left in the deck lands BEHIND the
  // forge. On the body, with the stylesheet's 1400, it is above every
  // in-terminal layer and still below the boot screen and the two gates.
  var homePlace = null, barPlace = null, modalPlace = null;

  function modalOpen() { var m = el("rcModal"); return !!(m && !m.hidden); }

  function openModal() {
    var m = el("rcModal"), f = el("rcFolder"), dest = el("rcSheetBody");
    if (m && m.parentNode !== document.body) {
      if (!modalPlace) {
        modalPlace = document.createComment("rcModal home");
        try { m.parentNode.insertBefore(modalPlace, m); } catch (e) {}
      }
      try { document.body.appendChild(m); } catch (e) {}
    }
    if (m && f && dest && f.parentNode !== dest) {
      if (!homePlace) {
        homePlace = document.createComment("rcFolder home");
        try { f.parentNode.insertBefore(homePlace, f); } catch (e) {}
      }
      try { dest.appendChild(f); } catch (e) {}
    }
    var bar = el("rcBar");
    if (m && bar && dest && bar.parentNode !== dest) {
      if (!barPlace) {
        barPlace = document.createComment("rcBar home");
        try { bar.parentNode.insertBefore(barPlace, bar); } catch (e) {}
      }
      try {
        if (f && f.parentNode === dest) dest.insertBefore(bar, f);
        else dest.appendChild(bar);
      } catch (e) {}
    }
    if (m) m.hidden = false;
    setOpen(true);
    try { var b = el("rcSheetBody"); if (b) b.scrollTop = 0; } catch (e) {}
  }

  function closeModal() {
    var m = el("rcModal"), f = el("rcFolder"), bar = el("rcBar");
    try { if (f && homePlace && homePlace.parentNode) homePlace.parentNode.insertBefore(f, homePlace); } catch (e) {}
    try { if (bar && barPlace && barPlace.parentNode) barPlace.parentNode.insertBefore(bar, barPlace); } catch (e) {}
    try { if (m && modalPlace && modalPlace.parentNode) modalPlace.parentNode.insertBefore(m, modalPlace); } catch (e) {}
    if (m) m.hidden = true;
    setOpen(false);
  }

  function setOpen(v) {
    open = !!v;
    var f = el("rcFolder");
    if (f) f.hidden = !open;
    syncToggle();
    if (open) refresh();
  }

  function refresh() {
    paintList();
    if (editing) paintEditor();
    try { if (window.forgeRecipes && window.forgeRecipes.refresh) window.forgeRecipes.refresh(); } catch (e) {}
  }

  function wire() {
    var t = el("rcToggle");
    if (t) t.addEventListener("click", function () { if (modalOpen()) closeModal(); else openModal(); });
    var mc = el("rcModalClose");
    if (mc) mc.addEventListener("click", closeModal);
    var mm = el("rcModal");
    if (mm) mm.addEventListener("click", function (e) { if (e.target === mm) closeModal(); });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.keyCode === 27) && modalOpen()) closeModal();
    });
    var sq = el("rcSearch");
    if (sq) sq.addEventListener("input", function () { bookQuery = sq.value; bookPage = 0; paintList(); });
    var n = el("rcNew");
    if (n) n.addEventListener("click", function () { editing = "@new"; slotCache = {}; openModal(); paintEditor(); });
    var up = el("rcUpload");
    var fi = el("rcFile");
    if (up && fi) {
      up.addEventListener("click", function () { try { fi.click(); } catch (e) {} });
      fi.addEventListener("change", function () {
        var f = fi.files && fi.files[0];
        fi.value = "";
        if (f) importFile(f);
      });
    }
    var tx = el("rcTxt");
    var tf = el("rcTxtFile");
    if (tx && tf) {
      tx.addEventListener("click", function () { try { tf.click(); } catch (e) {} });
      tf.addEventListener("change", function () {
        var files = tf.files ? Array.prototype.slice.call(tf.files) : [];
        tf.value = "";
        if (!files.length) { say("PROMPT RECIPES :: NO FILES CAME IN - PICK ONE OR MORE .TXT FILES AND TRY AGAIN."); return; }
        var jobs = files.map(function (f) {
          var read = (typeof f.text === "function") ? f.text() : new Promise(function (res, rej) {
            var fr = new FileReader();
            fr.onload = function () { res(String(fr.result || "")); };
            fr.onerror = function () { rej(new Error("unreadable")); };
            fr.readAsText(f);
          });
          return read.then(function (t) { return { name: f.name, text: t }; });
        });
        Promise.all(jobs).then(function (arr) { importTexts(arr); })
          .catch(function () { say("PROMPT RECIPES :: A .TXT FILE COULD NOT BE READ."); });
      });
    }
    var kp = el("rcKeep");    if (kp) kp.addEventListener("click", function () {
      var p = el("cpPrompt"), ng = el("cpNegative");
      var pv = p ? String(p.value || "").trim() : "";
      if (!pv) { say("PROMPT RECIPES :: THE POSITIVE BOX IS EMPTY - WRITE OR FILL A PROMPT FIRST."); return; }
      editing = "@new";
      slotCache = { __template: pv, __negative: ng ? String(ng.value || "").trim() : "", __title: "", __seeded: true };
      paintEditor();
      openModal();
      say("PROMPT RECIPES :: THE BOXES ARE IN THE EDITOR - NAME AN ID AND SAVE IT.");
    });
    var ex = el("rcExportBook");
    if (ex) ex.addEventListener("click", function () {
      var s = st();
      if (!s) { say("PROMPT RECIPES :: THE RECIPE BOOK IS NOT LOADED HERE."); return; }
      var mine = [];
      try { mine = (s.recipeBookData && s.recipeBookData().mine) || []; } catch (e) {}
      download("recipe-book-" + Date.now() + ".json", JSON.stringify({ app: "LIA TERMINAL", kind: "recipe-book", version: 1, exportedAt: Date.now(), mine: mine }, null, 2));
      say("PROMPT RECIPES :: YOUR " + mine.length + " RECIPE" + (mine.length === 1 ? "" : "S") + " (THE DEVICE OVERLAY, NOT THE SHIPPED SEED) ARE ON THEIR WAY DOWN - UPLOAD BRINGS THEM BACK.");
    });
    var list = el("rcList");
    if (list) list.addEventListener("click", function (e) {
      var pg = e.target && e.target.closest ? e.target.closest("button[data-pg]") : null;
      if (pg) {
        if (pg.disabled) return;
        bookPage += pg.getAttribute("data-pg") === "next" ? 1 : -1;
        paintList();
        return;
      }
      var b = e.target && e.target.closest ? e.target.closest("button[data-act]") : null;
      if (!b) return;
      var row = b.closest ? b.closest(".rcRow") : null;
      var id = row ? row.getAttribute("data-id") : null;
      if (!id) return;
      rowAction(id, b.getAttribute("data-act"));
    });
    var stg = el("rcStage");
    if (stg) stg.addEventListener("click", function (e) {
      var sp = e.target && e.target.closest ? e.target.closest("button[data-spg]") : null;
      if (!sp || sp.disabled) return;
      stagePage += sp.getAttribute("data-spg") === "next" ? 1 : -1;
      paintStaging();
    });
    try { if (st() && st().onRecipeChange) st().onRecipeChange(function () { if (open) paintList(); }); } catch (e) {}
    syncToggle();
    restoreStaging();   // a reload never eats picked files: staged rows come back
  }

  function describe() {
    var n = 0;
    try { n = book().length; } catch (e) {}
    return ["PROMPT RECIPES, THE BOOK :: " + n + " IN THE BOOK (CREATE IMAGE, OPEN THE BOOK - a modal: search, pages, the staging shelf, the editor).",
      "  OPEN THE BOOK - every recipe as one row (BOOK / YOURS / HERS, tags, slots): FILL writes it to the forge boxes, COPY + / COPY \u2212 take the filled words to the clipboard, SHOW prints it, EDIT opens it, EXPORT downloads it, DROP takes it out (shipped ones are put away, RESTORE brings them back).",
      "  + NEW - a blank editor (id, title, note, tags, {{slots}} template, negative, one default per slot). UPLOAD JSON - a recipe file in (one recipe, an array, or a book export). IMPORT .TXT - raw prompt files in all at once, staged with shared tags, each row read once (keyword tags + a sight line, like the gallery - still editable), then SAVE ALL (no limit - picks APPEND to the shelf). COPY ALL - every staged row into the forge boxes at once (positives to POSITIVE PROMPT, negatives folded to NEGATIVE PROMPT, the titled bundle to the clipboard too), built in chunks so the page never freezes. KEEP BOXES - the forge's current boxes into the editor as a new recipe.",
      "  Kept on this device over the shipped seed (src/studio/recipes.json, never rewritten); she composes from the same book by name: [[RECIPE: id :: slot=words]]. /recipe drives it in words."].join("\n");
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  // RE-TAG THE WHOLE SHELF: every staged row's tags recomputed from its template
  // (template-only, routing stripped), empty notes filled with the sight. Used
  // after the tagger itself improves - handwritten tags are NOT kept by this,
  // so it is a deliberate press, not something that runs by itself.
  function retagStaging() {
    if (!staging.length) { say("PROMPT RECIPES :: NOTHING STAGED - NOTHING TO RE-TAG."); return 0; }
    var n = 0;
    staging.forEach(function (e) {
      var kw = tagsFor(keywordSource(e)).join(", ");
      if (kw && kw !== String(e.tags || "")) { e.tags = kw; n++; }
      if (!String(e.note || "").trim()) {
        var sg = sightOf(e.template);
        if (sg) { e.note = sg; n++; }
      }
    });
    stagePage = 0;
    paintStaging();
    persistStaging();
    say("PROMPT RECIPES :: RE-TAGGED " + staging.length + " STAGED ROWS FROM THEIR TEMPLATES (" + n + " FIELDS REWRITTEN) - CHECK THEM, THEN SAVE ALL.");
    return n;
  }

  window.recipes = {
    open: function (v) { if (v === undefined || !!v) openModal(); else closeModal(); return open; },
    close: closeModal,
    modalOpen: modalOpen,
    refresh: refresh,
    describe: describe,
    words: function () { say(describe()); return describe(); },
    importTexts: importTexts,   // [{name, text}] - the bulk .txt door, staged for review
    parseTxt: parseTxt,         // (name, text) -> {id, title, template, negative}
    stagedCount: function () { return staging.length; },
    retagStaging: retagStaging,   // recompute every staged row's tags from its template
    restoreStaging: restoreStaging,
  };
})();
