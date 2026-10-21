/* ------------------------------------------------------------------
   THE GALLERY — every picture and clip in the vault, in one place.

   Patrikios, 2026-09-21: "I am going to install a gallery [so] we can look
   at all the images we have ever generated... she's creating images so that
   [they] ought to be archived and timestamped, etc."

   Refactored from his own `Dekatria Photo Viewer` (a drag-and-drop grid with
   a thumbnail modal), with three deliberate changes:

   1. THE VAULT IS THE STORE. The viewer kept pictures in a page-local array
      of data URLs - gone on reload, and a second copy of everything. Here the
      grid is a VIEW over `window.media` (kv `media`, per browser): the same
      store the terminal already renders into and shows her, so a picture can
      never exist in the gallery but not for her, or the other way round.
   2. THE ARCHIVE IS THE CATALOGUE. Every picture is cross-referenced against
      `master_log` and says where it came from: MADE IN TURN #N (she wrote it
      into her reply), CREATION #N (a forge batch - a thing made, not a turn),
      YOU SENT IT (TURN #N), YOUR CLIP, UPSCALED. The turn's own words ride
      with it in the tooltip and in the export, so a picture can be found by
      what was being said when it appeared.
   3. TIMESTAMPS ARE THE RECORD. Every tile carries its stamp from
      `src/js/logtime.js` - the same shape the chat log, the archive and the
      export write - and the catalogue export is stamped per item.

   Nothing is uploaded, ever: SAVE writes a local file to Downloads, the
   import path stores blobs in this browser's IndexedDB, and the catalogue
   export is a local download. `window.gallery` is the whole interface.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FILTERS = [
    { id: "all", label: "ALL" },
    { id: "render", label: "RENDERS" },
    { id: "sent", label: "YOUR PICTURES" },
    { id: "music", label: "MUSIC" },
    { id: "vox", label: "VOX" },
    { id: "clip", label: "CLIPS" },
    { id: "upscaled", label: "UPSCALED" },
    { id: "unseen", label: "NOT YET SEEN" }
  ];
  var SORTS = [
    { id: "newest", label: "NEWEST FIRST" },
    { id: "oldest", label: "OLDEST FIRST" },
    { id: "biggest", label: "BIGGEST FIRST" },
    { id: "az", label: "A - Z" },
    { id: "turn", label: "BY TURN" }
  ];

  // HOW MANY PICTURES TO A PAGE. The grid draws ONE PAGE of the view at a time (see "ONE PAGE AT A
  // TIME" below); this is the size of it, and 0 means "all of them, in one scroll", which is what
  // the gallery did before there was a pager.
  var PERS = [
    { n: 24, label: "24" },
    { n: 60, label: "60" },
    { n: 120, label: "120" },
    { n: 240, label: "240" },
    { n: 0, label: "ALL" }
  ];
  var PER_DEFAULT = 60;
  var VIEW_KEY = "gallery_view";   // kv lia_settings :: { per: 60 } - the page size, remembered

  var state = { open: false, filter: "all", query: "", sort: "newest", sel: {}, page: 1, per: PER_DEFAULT };
  var cat = null;          // id -> { turn, how, when, h, s, prompt, silent }
  var catAt = 0;           // when the catalogue was built (so it can be rebuilt on demand)
  var rows = [];           // the WHOLE filtered+sorted view (a page is a window onto it)
  var paintedPage = 0;     // the page the grid was last drawn at, so a turn starts at the top
  var armed = null;        // the delete button waiting for its second press
  var armedAt = 0;

  function el(id) { return document.getElementById(id); }

  /* ---- the two sources ------------------------------------------------- */

  // The catalogue: which turn each stored picture belongs to, and how. The
  // FIRST entry that mentions an id wins, which is the earliest and the
  // meaningful one (the turn it was made in, or the turn he sent it in; a
  // later "she looked at it" never overwrites that).
  async function buildCatalogue() {
    var logs = [];
    try { logs = await window.root.kv.sacred_archive.get("master_log") || []; } catch (e) { logs = []; }
    var map = {};
    logs.forEach(function (e, i) {
      var n = i + 1;   // the same numbering /strike and /search use
      var silent = !!e.silent || e.kind === "create";
      var note = { turn: n, when: e.ts, h: e.h == null ? "" : e.h, s: e.s == null ? "" : e.s, role: e.role || "", silent: silent };
      (e.img || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "sent" }); });
      (e.gen || []).forEach(function (g) {
        if (!g || !g.id) return;
        if (!map[g.id]) map[g.id] = merge(note, { how: "made", prompt: g.prompt || "" });
      });
      (e.sight || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "seen" }); });
      // A picture she ASKED for again (the [[SHOW: ...]] lane, src/js/renderbook.js). It is not a
      // new render and nothing was rendered again - she reached into the book and pulled this one.
      (e.show || []).forEach(function (id) { if (id && !map[id]) map[id] = merge(note, { how: "recalled" }); });
    });
    cat = map;
    catAt = Date.now();
    return map;
  }
  function merge(a, b) {
    var out = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (var j in b) if (Object.prototype.hasOwnProperty.call(b, j)) out[j] = b[j];
    return out;
  }

  function kindOf(rec) {
    if (!rec) return "sent";
    if (rec.kind === "video") return "clip";
    if (rec.kind === "upscale") return "upscaled";
    if (rec.kind === "gen") return "render";
    if (/^audio\//.test(String(rec.mime || ""))) return isVox(rec) ? "vox" : "music";
    return "sent";
  }

  // VOX :: VOCAL AUDIO, WHICH IS NOT MUSIC. The shelf is /audio/vox and everything under it
  // (/audio/vox/lia, /audio/vox/barbelo, ...), so FILING a clip into that tree is the one thing
  // that makes it a voice - there is no second place to say the same thing, and no flag to keep in
  // step with the folder. A record the story lane itself writes is born with kind "vox" and is
  // VOX wherever it is; anything else that is sound and is not in the tree is music.
  function isVox(rec) {
    if (!rec) return false;
    // One rule, one place: the vault answers (window.media.isVox), so the gallery, the folders job
    // and anything else that asks cannot end up disagreeing about what a voice is.
    if (window.media && window.media.isVox) return !!window.media.isVox(rec);
    if (String(rec.kind || "") === "vox") return true;
    var f = folderOf(rec);
    return f === "/audio/vox" || f.indexOf("/audio/vox/") === 0;
  }

  // A folder is a path on the record (src/js/vault.js): /images, /music, /clips,
  // /images/portraits - the default for what a thing IS when nobody has filed it.
  function folderOf(rec) {
    return (window.media && window.media.folderOf) ? window.media.folderOf(rec) : "";
  }

  function unseenIds() {
    try { return (typeof sightPending === "function") ? sightPending() : []; } catch (e) { return []; }
  }

  // One line for display next to a kind: where this picture came from. Kept as
  // a function of its own because the lightbox and the export both want it.
  // `short` is for the tile itself, where the badge shares a 120px-wide corner with the UNSEEN
  // chip and has to stay out of its way; the long form is what the tooltip, the full stage and
  // the catalogue carry.
  function badgeFor(rec, short) {
    var memo = cat && cat[rec.id];
    var kind = kindOf(rec);
    if (kind === "music") return short ? "MUSIC" : "YOUR MUSIC";
    if (kind === "vox") return short ? "VOX" : "A VOICE IN THE VAULT";
    if (kind === "clip") return short ? "CLIP" : "YOUR CLIP";
    if (kind === "upscaled") return (short || !rec.note) ? "UPSCALED" : "UPSCALED " + String(rec.note).toUpperCase();
    if (kind === "render") {
      if (memo && memo.how === "made") {
        if (memo.silent) return short ? "CREATION #" + memo.turn : "CREATION " + memo.turn;
        return short ? "MADE #" + memo.turn : "MADE IN TURN " + memo.turn;
      }
      if (memo && memo.how === "recalled") {
        return short ? "ASKED #" + memo.turn : "SHE ASKED TO SEE IT AGAIN (TURN " + memo.turn + ")";
      }
      return short ? "RENDER" : (memo && memo.turn ? "IN TURN " + memo.turn : "RENDER");
    }
    if (memo && memo.how === "sent") return short ? "SENT #" + memo.turn : "YOU SENT IT (TURN " + memo.turn + ")";
    return short ? "VAULT" : "IN THE VAULT";
  }

  // What the gallery can say about one picture, for the lightbox (and for
  // anything else that wants the turn behind a picture).
  function noteFor(id) {
    var rec = window.media.get(id);
    if (!rec) return "";
    var memo = cat && cat[id];
    var bits = [badgeFor(rec)];
    if (memo) {
      var said = String(memo.h || "").replace(/\s+/g, " ").trim();
      var heard = String(memo.s || "").replace(/\s+/g, " ").trim();
      if (said) bits.push("he was saying: \"" + said.slice(0, 90) + (said.length > 90 ? "\u2026" : "") + "\"");
      else if (memo.turn && memo.how !== "seen") bits.push("nothing was said - turn " + memo.turn + " is the picture's own");
      if (heard && memo.how !== "made") bits.push("she answered: \"" + heard.slice(0, 90) + (heard.length > 90 ? "\u2026" : "") + "\"");
    }
    if (rec.pose) bits.push("pose: " + rec.pose);
    var f = folderOf(rec);
    if (f) bits.push("folder: " + f);
    return bits.join("   \u00b7   ");
  }

  function titleFor(rec) {
    var memo = cat && cat[rec.id];
    var out = [rec.name || "image"];
    var f = folderOf(rec);
    if (f) out.push("folder: " + f);
    if (rec.prompt) out.push("prompt: " + rec.prompt);
    if (rec.seed) out.push("seed " + rec.seed + (rec.guidanceScale ? " \u00b7 guidance " + rec.guidanceScale : "") + (rec.resolution ? " \u00b7 " + rec.resolution : ""));
    if (rec.tags && rec.tags.length) out.push("tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" "));
    if (rec.sight) out.push("her reading: " + rec.sight);
    var rb = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(rec.id) : "";
    if (rb) out.push("render book: " + rb + " (type /renders " + rb + " for the whole recipe)");
    if (memo) {
      out.push("from turn " + memo.turn + (memo.how === "made" ? " - she made it in her reply" : memo.how === "sent" ? " - you sent it to her" : ""));
      if (memo.h) out.push("Patrikios: " + String(memo.h).slice(0, 160));
      if (memo.s) out.push("LIA ID: " + String(memo.s).slice(0, 160));
    }
    return out.join("\n");
  }

  /* ---- the view -------------------------------------------------------- */

  function allRows() {
    var ids = window.media.list();
    return ids.map(function (id) {
      var rec = window.media.get(id);
      if (!rec) return null;
      var memo = cat && cat[id];
      return {
        id: id, rec: rec, kind: kindOf(rec), memo: memo || null,
        folder: folderOf(rec),
        label: String(rec.prompt || rec.name || ""), ts: rec.ts || 0,
        turn: (memo && memo.turn) || 0, seen: !!(rec.sight)
      };
    }).filter(Boolean);
  }

  function matches(r, unseen) {
    if (state.filter === "unseen") { if (unseen.indexOf(r.id) === -1) return false; }
    else if (state.filter !== "all" && r.kind !== state.filter) return false;
    // FOLDERS FIRST, then tags, then words - the same ladder the FOLDERS row and the TAGS row use,
    // so a chip pressed and a path typed mean exactly the same thing.
    var wantedFolders = queryFolders();
    if (wantedFolders.length) {
      var here = folderOf(r.rec);
      for (var fi = 0; fi < wantedFolders.length; fi++) {
        var want = wantedFolders[fi];
        if (here !== want && here.indexOf(want + "/") !== 0) return false;
      }
    }
    // TAGS. `#night` or `tag:night` anywhere in the query is a tag requirement, not a word to
    // look for in a prompt - so "show me every picture tagged #night" is one gesture, and it can be
    // combined with words ("#night glass cathedral"). The same rule the render book uses, so the
    // gallery and `/renders tag` and her own [[SHOW: #night]] line all agree.
    var wantedTags = queryTags();
    if (wantedTags.length) {
      var mine = r.rec.tags || [];
      for (var t = 0; t < wantedTags.length; t++) if (mine.indexOf(wantedTags[t]) === -1) return false;
    }
    var q = queryText();
    if (!q) return true;
    // Every word has to appear somewhere, so two words narrow rather than widen.
    var hay = [r.rec.prompt, r.rec.sent, r.rec.name, r.rec.sight, r.rec.note, r.rec.negative,
               r.rec.pose, (r.rec.tags || []).join(" "), fileLabel(r.rec), folderOf(r.rec),
               (r.memo ? r.memo.h : ""), (r.memo ? r.memo.s : ""), badgeFor(r.rec)]
      .filter(Boolean).join(" \n ").toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    return true;
  }

  // The folders named in the search box: `folder:/music`, `in:/music`, `dir:/music`, and a bare
  // `/music` - a path is how he says it, and a folder is a path.
  function queryFolders() {
    var M = window.media;
    var out = [];
    if (!M || !M.normFolder) return out;
    var push = function (p) { var n = M.normFolder(p); if (n && out.indexOf(n) === -1) out.push(n); };
    String(state.query || "").replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[^\s]+|[a-z0-9][a-z0-9/_-]*)/gi, function (m, p) { push(p); return " "; });
    String(state.query || "").replace(/(^|\s)(\/[a-z0-9][a-z0-9/_-]*)/gi, function (m, sp, p) { push(p); return " "; });
    return out;
  }

  // The tags named in the search box: `#night`, `tag:night`, `tag night`.
  function queryTags() {
    var out = [];
    String(state.query || "").replace(/#([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.push(t.toLowerCase()); return " "; })
      .replace(/\btags?[: ]\s*([a-z0-9][a-z0-9-]{0,31})/gi, function (m, t) { out.push(t.toLowerCase()); return " "; });
    return out;
  }
  // The words, with the tag and folder terms taken out (they were answered above).
  function queryText() {
    return String(state.query || "")
      .replace(/\b(?:folder|folders|in|dir|under)\s*[:=]\s*(\/[^\s]+|[a-z0-9][a-z0-9/_-]*)/gi, " ")
      .replace(/(^|\s)\/[a-z0-9][a-z0-9/_-]*/gi, " ")
      .replace(/#[a-z0-9][a-z0-9-]{0,31}/gi, " ")
      .replace(/\btags?[: ]\s*[a-z0-9][a-z0-9-]{0,31}/gi, " ")
      .replace(/\s+/g, " ").trim();
  }
  function fileLabel(rec) {
    if (!rec) return "";
    return (window.media && window.media.artifactName) ? window.media.artifactName(rec) : (rec.name || "");
  }

  function sortRows(a, b) {
    if (state.sort === "oldest") return a.ts - b.ts;
    if (state.sort === "biggest") return (b.rec.bytes || 0) - (a.rec.bytes || 0);
    if (state.sort === "az") return a.label.toLowerCase().localeCompare(b.label.toLowerCase()) || (b.ts - a.ts);
    if (state.sort === "turn") return (a.turn || 1e9) - (b.turn || 1e9) || (a.ts - b.ts);
    return b.ts - a.ts;   // newest first
  }

  function compute() {    var unseen = unseenIds();
    rows = allRows().filter(function (r) { return matches(r, unseen); }).sort(sortRows);
    return rows;
  }

  /* ---- ONE PAGE AT A TIME ---------------------------------------------------
     Patrikios, 2026-09-24: "PAGINATE the GALLERY".

     This vault holds thousands of records (2,600 on this device the day he asked), and the grid
     drew EVERY tile of the filtered view in one pass: a <figure> per record with a dozen nodes in
     it, an object URL made for each one, `unseenIds()` scanned per row and again per tile, the whole
     thing built in a single task. That is the cost a page removes. A page is the grid's own window
     onto the view, and nothing more:

       - `compute()` still builds the WHOLE filtered, sorted row set (`rows`). The counts, the
         catalogue export, SELECT ALL, `describe()` and the full stage's walk all read that, so a
         page is a way of DRAWING the view and never a second filter hidden inside it.
       - `pageRows()` is what gets drawn: one screenful, built fresh on a page turn and nothing else.
       - the stage still walks the WHOLE view (see `visibleIds()` below), so the arrows cross pages
         freely - a page is a window, not a filter, and an arrow must not stop at a wall that is only
         a drawing decision.
       - anything that CHANGES the view (a filter, the search box, the sort, the page size) starts
         again at page 1; anything that only changes what is IN the vault (a render landing, an
         import, a delete) keeps the page he is standing on, clamped to the last page there is.

     The size of a page is his (24 / 60 / 120 / 240 / ALL - 60 by default), remembered across
     reloads in kv `lia_settings/gallery_view` the way the picture size is remembered in `pic_size`.
     ALL is kept because it is exactly what the gallery was before this, and a vault big enough for
     it to hurt says so in the status line rather than refusing.
     ------------------------------------------------------------------------- */
  var PER_WARN = 300;   // past this many rows, ALL draws a slow screenful and is said to be slow

  function perKnown(n) { for (var i = 0; i < PERS.length; i++) if (PERS[i].n === n) return true; return false; }
  function perOf() { return state.per > 0 ? state.per : Math.max(1, rows.length); }
  function perLabel(n) { for (var i = 0; i < PERS.length; i++) if (PERS[i].n === n) return PERS[i].label; return String(n); }
  function pageCount() { return state.per > 0 ? Math.max(1, Math.ceil(rows.length / state.per)) : 1; }
  function clampPage() {
    var p = Math.floor(Number(state.page) || 1);
    var pc = pageCount();
    if (p < 1) p = 1;
    if (p > pc) p = pc;
    state.page = p;
    return p;
  }
  // The tiles that are actually drawn: the page's slice of the view.
  function pageRows() {
    var per = perOf();
    var p = clampPage();
    var from = (p - 1) * per;
    return rows.slice(from, from + per);
  }
  // Which page holds one record, 0 if the view does not hold it at all. (What a link, a receipt or a
  // command needs to put the grid where the picture is instead of leaving him on page 1.)
  function pageOfId(id) {
    var per = perOf();
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return Math.floor(i / per) + 1;
    return 0;
  }

  // THE ROWS AS THEY STAND, in the order they are shown - the list the full stage walks with its
  // arrows (images.js, THE SCROLL-THROUGH). Whoever opens a picture from here hands it this, so the
  // walk is the filtered, sorted view he is actually looking at, not the whole vault in ts order.
  // WITH PAGINATION this is still the whole view and not the page: the bar counts the whole view and
  // the arrows cross page boundaries. The alternative - handing over the drawn page - would ring the
  // walk back to the top of the page at its 60th picture, a wall where there is no filter.
  function visibleIds() {
    return rows.map(function (r) { return r.id; });
  }

  function stampOf(ts) {
    if (window.logTime && ts) return window.logTime.stamp(ts, { seconds: false });
    return ts ? new Date(ts).toLocaleString() : "";
  }
  function fmtBytes(n) {
    if (typeof fmtSize === "function") return fmtSize(n);
    n = Number(n) || 0;
    return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB";
  }
  function total() { return window.media.list().length; }
  function selectedIds() {
    return Object.keys(state.sel).filter(function (id) { return state.sel[id] && window.media.get(id); });
  }
  function status(msg) {
    var s = el("galStatus");
    if (s) s.textContent = msg || "";
  }

  /* ---- painting -------------------------------------------------------- */

  function tileFor(r) {
    var rec = r.rec;
    var fig = document.createElement("figure");
    fig.className = "galTile" + (state.sel[r.id] ? " sel" : "");
    fig.dataset.id = r.id;
    fig.title = titleFor(rec);

    var thumb = document.createElement("div");
    thumb.className = "galThumb";

    var img = document.createElement("img");
    img.alt = rec.name || "image";
    img.decoding = "async";
    if (rec.kind === "video") {
      var poster = rec.poster && window.media.get(rec.poster) ? window.media.url(rec.poster) : null;
      var src = poster || window.media.url(r.id);
      fig.__galSrc = src || "";
      var play = document.createElement("span");
      play.className = "galPlay";
      play.textContent = "\u25b6";
      thumb.appendChild(play);
    } else if (r.kind === "music" || r.kind === "vox") {
      // SOUND HAS NO PICTURE TO SHOW: the tile stands for the file, and the player is on the full
      // stage (a grid of 166 pictures should not start 40 players at once). Music and a voice are the
      // same shape of thing to look at, and one glyph apart - a voice is the one that gets spoken.
      fig.__galSrc = "";
      var note = document.createElement("div");
      note.className = "galAudio " + r.kind;
      note.textContent = r.kind === "vox" ? "\u266a" : "\u266b";
      thumb.appendChild(note);
      img.hidden = true;
    } else {
      fig.__galSrc = window.media.url(r.id) || "";
    }
    thumb.appendChild(img);

    var badge = document.createElement("span");
    badge.className = "galBadge " + r.kind;
    badge.textContent = badgeFor(rec, true);
    thumb.appendChild(badge);

    var stamp = document.createElement("span");
    stamp.className = "galStamp";
    stamp.textContent = stampOf(rec.ts);
    stamp.title = (window.logTime ? window.logTime.stamp(rec.ts) : "") + (rec.bytes ? "  \u00b7  " + fmtBytes(rec.bytes) : "");
    thumb.appendChild(stamp);

    if (unseenIds().indexOf(r.id) !== -1) {
      var eye = document.createElement("span");
      eye.className = "galEye";
      eye.textContent = "UNSEEN";
      eye.title = "she has not been given this one to look at yet";
      thumb.appendChild(eye);
    }

    // THE MARK, ON THE CARD ITSELF (src/js/likes.js). The heart in the action row is the control;
    // this is the state of it, where he can see it from across the grid without reading tooltips.
    if (window.likes) {
      var lv = window.likes.state(r.id);
      if (lv) {
        var mark = document.createElement("span");
        mark.className = "galHeartMark " + lv;
        mark.textContent = lv === "good" ? "\u2665" : "\u2298";
        mark.title = lv === "good"
          ? "you marked this GOOD - she is told, and it shapes what she reaches for"
          : "you passed on this one - she is told, so it shapes what she leaves out";
        thumb.appendChild(mark);
      }
    }

    var acts = document.createElement("div");
    acts.className = "galActs";
    // SELECT. Without it the bulk buttons at the bottom have nothing to act on: the whole tile
    // belongs to opening the picture (that is what a picture is for), so the checkbox is its own
    // small control. Ctrl/Cmd-click on the picture does the same, for a desk.
    acts.appendChild(act("gPick", state.sel[r.id] ? "\u2611" : "\u2610", "select it - the buttons at the bottom of the gallery act on everything selected", function (e) {
      e.stopPropagation();
      toggleSel(r.id, e.currentTarget);
    }));
    // SOUND GETS THE BUS (src/js/audition.js) - music and a voice alike, because they are both sound
    // and the terminal has exactly one transport. One press puts it on that transport and starts it,
    // and it plays on while the conversation carries on around it - the moment where he and she are
    // listening to the same thing. Nothing else in the terminal makes its own player, so nothing ever
    // talks over anything.
    if (r.kind === "music" || r.kind === "vox") {
      acts.appendChild(act("gBus", "\u25b6", "put it on the audition bus and play it - the whole terminal then listens with you, and her comments land anchored to where in the piece she made them", function (e) {
        e.stopPropagation();
        if (window.audition) window.audition.load(r.id, { play: true });
      }));
    }
    // A CLIP GOES TO THE FRAME (src/js/frame.js) - the big media player, straight from
    // the vault, nothing uploaded and nothing kept outside this browser. Only VIDEO gets
    // it: sound already has its one transport (the audition bus above), and the terminal
    // never runs two players at once.
    if (rec.kind === "video") {
      acts.appendChild(act("gFrame", "FRAME", "play it in the frame - the big media player, straight from the vault, this browser only", function (e) {
        e.stopPropagation();
        if (window.framelane && window.framelane.playVault) window.framelane.playVault(r.id);
      }));
    }
    // A VOICE IS RECALLED FROM HERE. This is what the VOX tab is FOR: one press makes this clip the
    // voice the story lane clones from - the sample of the agent on stage - and it goes through the
    // lane's own door (`window.story.setSample`, /story sample <ID>), so what it prints is the lane's
    // receipt and there is no second way of setting a voice that could drift from the first. Only a
    // VOX record carries it: a song is not a voice, and the Space would clone from a song just the
    // same, which is exactly the mistake the tree exists to prevent.
    if (r.kind === "vox" && window.story && window.story.setSample) {
      acts.appendChild(act("gVoice", "\u25c6", "make this the voice the story lane clones from - the sample of the agent on stage, exactly as /story sample <ID> sets it. Everything filed in /audio/vox is what the Chatterbox road can wear", function (e) {
        e.stopPropagation();
        try { window.story.setSample(rec.id); }
        catch (err) { if (typeof print === "function") print("SYSTEM", "THAT VOICE COULD NOT BE SET :: " + ((err && err.message) || err)); }
      }));
    }
    // THE HEART (src/js/likes.js) - his mark on the card, which is what trains her: she is told
    // what he has marked at the top of every turn. One press marks it GOOD (red), the next passes on
    // it, the next clears it. It is first in the row because it is the one he presses most.
    if (window.likes) {
      // `heart` ON TOP OF `gHeart`: the class is what the stylesheet hangs the three states on
      // (button.heart / .on / .passed), and without it the gallery's own button was the one place
      // the mark never turned red - caught on 2026-09-22 by reading the computed style of the real
      // card rather than of a harness that had been written with the right class by hand.
      try { acts.appendChild(window.likes.button(r.id, { className: "galAct gHeart heart", blank: true })); }
      catch (e) { console.warn("the HEART button could not be drawn", e); }
    }
    // A QUICK LOOK (src/js/minibox.js). The FULL STAGE beside it is the whole record - SAVE, UPSCALE,
    // the folder row, the tags, the prompt file - which is a lot of machinery to open when what he
    // wants is to see the picture bigger for a second and move on. This opens the mini lightbox on
    // the list the gallery is SHOWING (visibleIds: his own search, sort and filters), so the arrows
    // walk exactly the grid he is looking at, and FULL STAGE is one press up from there.
    if (window.miniBox) acts.appendChild(act("gPeek", "\u25a3", "a quick look - the mini lightbox, with the ones before and after in the order you are browsing this grid, and a way up to the full stage", function (e) {
      e.stopPropagation();
      window.miniBox.open(r.id, { list: visibleIds(), title: "THE GALLERY" });
    }));
    acts.appendChild(act("gFull", "\u26f6", "the full stage - the picture at its own size, with SAVE and UPSCALE. The stage walks the grid with the arrow keys.", function (e) {
      e.stopPropagation();
      if (typeof openLightbox === "function") openLightbox(r.id, { list: visibleIds() });
    }));
    acts.appendChild(act("gQueue", "\u25c9", "hand it to her eyes - she looks at it on your next message (nothing is said to her in words)", onQueue));
    // SEE IT IN THE CONVERSATION (/see) - the richer neighbour of POST TO CHAT below. This one puts
    // the picture in front of her AND has the vision model read it on the way (writing its reading,
    // its tags and the kind of scene it is ON the picture), and hands her the record's own filing with
    // the image. It SEEDS the line rather than sending it, because /see takes his words after the
    // citation - so this leaves "/see <id> " in the input box and gets out of the way.
    acts.appendChild(act("gSee", "\u2609", "send it into the conversation AND have her read it on the way (/see) - the line is left in the input box for you, so you can add what you want to say first. The vision model reads the picture once, what it finds is written on it (its reading, its tags, the kind of scene it is), and its own filing goes to her with the image.", function (e) {
      e.stopPropagation();
      seedSee(r.id);
    }));
    // POST TO CHAT (images.js) - out of the gallery and into the conversation, where the two of them
    // can talk about it: a line of his carrying the picture in the log, and the same queue her eyes
    // are fed from. It is marked as one he posted, so she is told the truth about where it came from.
    acts.appendChild(act("gPost", "\u2b06", "post it into the conversation - it lands in the chat window as a line of yours with the picture under it, and she is given it to look at on your next message", function (e) {
      e.stopPropagation();
      if (window.postToChat) window.postToChat(r.id);
    }));
    acts.appendChild(act("gSave", "\u2193", "save a copy to this machine's Downloads folder", onSave));
    // KEEP (src/js/keepsake.js) - only a picture the terminal MADE has a prompt to keep. It writes
    // the prompt, the negative list, the settings and the seed into the recipe book, hangs #kept on
    // the picture and stores a link to it. The ↓ beside it is the download and is untouched.
    if (window.keepsake && window.keepsake.canKeep(rec)) {
      try { acts.appendChild(window.keepsake.button(r.id, { className: "gKeep", star: true })); }
      catch (e) { console.warn("the KEEP button could not be drawn", e); }
    }
    acts.appendChild(act("gDel", "\u00d7", "delete it from the vault - press twice", onDelete));
    thumb.appendChild(acts);

    var thumbClick = function (e) {
      if (e.ctrlKey || e.metaKey) { toggleSel(r.id, fig.querySelector('.gPick')); return; }
      if (typeof openLightbox === "function") openLightbox(r.id, { list: visibleIds() });
    };
    thumb.addEventListener("click", thumbClick);

    var cap = document.createElement("figcaption");
    cap.className = "galCap";
    // The prompt is clamped to two lines (its own element now, so the tag chips below are never
    // swallowed by the clamp); the tags ride under it.
    var capTxt = document.createElement("span");
    capTxt.className = "galCapTxt";
    capTxt.textContent = r.label || ((r.kind === "music" || r.kind === "vox") ? (rec.name || (r.kind === "vox" ? "(a voice)" : "(a piece of music)")) : "(no prompt)");
    cap.appendChild(capTxt);
    // WHERE IT LIVES, AND WHAT IT IS FILED AS. The folder chip is the same gesture as typing its
    // path in the search box; the tag chips the same for #tags. Three tags fit; the rest are in the
    // tooltip.
    var chipRow = document.createElement("span");
    chipRow.className = "galChipRow";
    var fChip = folderChipFor(rec);
    if (fChip) chipRow.appendChild(fChip);
    var tagList = tagListFor(rec);
    if (tagList) chipRow.appendChild(tagList);
    if (chipRow.childNodes.length) cap.appendChild(chipRow);
    var sub = document.createElement("span");
    sub.className = "galSub";
    // Her own reading of it rides under the caption - what she saw in a picture, or WHAT SHE HEARD
    // IN A PIECE (the bus writes `heard` onto the record the same way a vision pass writes `sight`).
    var subText = rec.sight ? "\u201c" + String(rec.sight).slice(0, 60) + "\u201d" : "";
    if (!subText && rec.heard && rec.heard.text) subText = "\u266b \u201c" + String(rec.heard.text).slice(0, 60) + "\u201d";
    if (!subText && r.memo && r.memo.turn) subText = "turn #" + r.memo.turn;
    sub.textContent = subText;
    if (sub.textContent) cap.appendChild(sub);

    fig.appendChild(thumb);
    fig.appendChild(cap);

    // The whole tile belongs to the picture except the act buttons; a click on
    // the caption opens it too, because a caption is part of the picture.
    cap.addEventListener("click", function () {
      if (typeof openLightbox === "function") openLightbox(r.id);
    });
    return fig;
  }

  function act(cls, text, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.title = title;
    b.addEventListener("click", fn);
    return b;
  }

  // THE EYE BUTTON LEAVES THE LINE, IT DOES NOT SEND IT. /see takes his own words AFTER the citation
  // ("/see mmud... look at her hands"), so the whole point is that he gets to say something with the
  // picture - which a button that sent it immediately would take away. So this seeds the input box,
  // brings the gallery out of the way, and the turn is his to send.
  function seedSee(id) {
    var input = document.getElementById("userInput");
    var line = "/see " + id + " ";
    var typed = input ? String(input.value || "").trim() : "";
    if (input) {
      input.value = (typed && typed.indexOf("/see ") !== 0) ? line + typed : line;
      try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (err) {}
    }
    close();
    print("SYSTEM", "SEE :: \"/see " + id + "\" IS IN THE INPUT BOX."
      + "\nIT PUTS THAT PICTURE INTO THE CONVERSATION AND HAS THE VISION MODEL READ IT ON THE WAY: WHAT IT FINDS IS WRITTEN ON THE PICTURE (ITS READING, ITS TAGS, AND THE KIND OF SCENE IT IS), "
      + "AND THE PICTURE'S OWN FILING - NAME, FOLDER, BUCKET, TAGS - GOES TO HER WITH THE IMAGE."
      + "\nADD WHATEVER YOU WANT TO SAY AFTER THE CITATION, THEN PRESS SEND. (POST TO CHAT \u2b16 SENDS IT NOW WITH NOTHING READ; /see AGAIN <WHAT> RE-READS ONE.)");
  }

  // The tags on one picture, as chips small enough to live in a caption.
  function tagListFor(rec) {
    var tags = (rec && rec.tags) || [];
    if (!tags.length) return null;
    var row = document.createElement("span");
    row.className = "galTagList";
    tags.slice(0, 3).forEach(function (t) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "galTagMini";
      chip.textContent = "#" + t;
      chip.title = "show everything filed as #" + t;
      chip.addEventListener("click", function (e) { e.stopPropagation(); toggleTag(t); });
      row.appendChild(chip);
    });
    if (tags.length > 3) {
      var more = document.createElement("span");
      more.className = "galTagMore";
      more.textContent = "+" + (tags.length - 3);
      more.title = tags.slice(3).map(function (t) { return "#" + t; }).join(" ");
      row.appendChild(more);
    }
    return row;
  }

  // The folder one picture is in, as a chip small enough to live in a caption.
  function folderChipFor(rec) {
    var f = folderOf(rec);
    if (!f) return null;
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "galFolderMini";
    chip.textContent = f;
    chip.title = "show only what is filed in " + f + " (a folder is a path - /images, /music, /images/portraits)";
    chip.addEventListener("click", function (e) { e.stopPropagation(); toggleFolder(f); });
    return chip;
  }

  // A tag chip pressed: it becomes part of the query, so the search box and the chips always agree
  // about what is being shown (and either can be cleared by the other).
  function toggleTag(tag) {
    if (!window.media || !window.media.normTag) return;
    var t = window.media.normTag(tag);
    if (!t) return;
    var text = queryText();
    var tags = queryTags().filter(function (x) { return x !== t; });
    if (queryTags().indexOf(t) === -1) tags.push(t);
    setQuery((text + " " + tags.map(function (x) { return "#" + x; }).join(" ") + " " + foldersQueryText()).replace(/\s+/g, " ").trim());
  }

  // A folder chip pressed: the path becomes a `folder:` term in the query, so the FOLDERS row, the
  // caption chip and the search box can never disagree about what is being shown.
  function toggleFolder(path) {
    if (!window.media || !window.media.normFolder) return;
    var p = window.media.normFolder(path);
    if (!p) return;
    var text = queryText();
    var tags = queryTags();
    var folders = queryFolders().filter(function (x) { return x !== p; });
    if (queryFolders().indexOf(p) === -1) folders.push(p);
    setQuery((text
      + " " + tags.map(function (x) { return "#" + x; }).join(" ")
      + " " + folders.map(function (x) { return "folder:" + x; }).join(" ")).replace(/\s+/g, " ").trim());
  }
  function foldersQueryText() {
    return queryFolders().map(function (x) { return "folder:" + x; }).join(" ");
  }

  // Thumbnails are loaded by hand, by geometry, NOT with `loading="lazy"`: the browser's lazy
  // loading rides on IntersectionObserver, and this page is the one place where that machinery has
  // been seen to stop firing (the platform note in AGENTS.md). A scroll listener and a plain index
  // sum cannot get stuck: a tile gets its object URL when it is within a screen of the scroll port,
  // and keeps it. 166 pictures is a light pass; on a phone it is the difference between loading a
  // screenful and loading the whole vault.
  function loadThumbs() {
    var grid = el("galGrid");
    if (!grid) return;
    var tiles = grid.querySelectorAll(".galTile");
    if (!tiles.length) return;
    var cols = 1;
    try { cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length); } catch (e) { cols = 1; }
    // The ROW PITCH, not the tile's height: the tiles are separated by a row gap, and using the
    // height alone made the window drift - at the bottom of a 166-tile vault it collapsed to the
    // single last tile (measured: 145 of 166 left unloaded at scrollTop 6829). The pitch is the
    // distance between the first tile of two consecutive rows, which is exact and needs no
    // knowledge of the CSS.
    var rowH = 0;
    try {
      if (tiles.length > cols) rowH = tiles[cols].getBoundingClientRect().top - tiles[0].getBoundingClientRect().top;
      if (!(rowH > 0)) {
        var gap = 0;
        try { gap = parseFloat(getComputedStyle(grid).rowGap) || 0; } catch (e) { gap = 0; }
        rowH = tiles[0].getBoundingClientRect().height + gap;
      }
    } catch (e) { rowH = 0; }
    // Nothing measurable (the panel is closed, or mid-render): take them all rather than none, so
    // the next thing that looks at the grid sees pictures.
    var first = 0, last = tiles.length;
    if (rowH > 0 && grid.clientHeight > 0) {
      first = Math.max(0, Math.floor(grid.scrollTop / rowH) - 1) * cols;
      last = Math.min(tiles.length, (Math.ceil((grid.scrollTop + grid.clientHeight) / rowH) + 2) * cols);
    }
    if (first > tiles.length) first = tiles.length;
    if (last > tiles.length) last = tiles.length;
    for (var i = first; i < last; i++) {
      var t = tiles[i];
      if (!t || !t.__galSrc) continue;
      var img = t.querySelector("img");
      if (img) img.src = t.__galSrc;
      t.__galSrc = "";
    }
    // WHAT THE VIEW PASSED. A fling can jump several screens, and a tile the scrollbar flew past
    // would otherwise stay an empty box behind us. Each tick also takes up to two rows of the
    // nearest unloaded tiles ABOVE the window, so a skipped stretch fills in from where he is
    // standing outward, a couple of rows at a time, and the next tick takes the next two.
    if (first > 0) {
      var back = 0, scanned = 0;
      for (var j = first - 1; j >= 0 && back < cols * 2 && scanned < cols * 10; j--) {
        scanned++;
        var b = tiles[j];
        if (!b || !b.__galSrc) continue;
        var bi = b.querySelector("img");
        if (bi) bi.src = b.__galSrc;
        b.__galSrc = "";
        back++;
      }
    }
  }

  var thumbTimer = null;
  function thumbSoon() {
    if (thumbTimer) return;
    thumbTimer = setTimeout(function () { thumbTimer = null; loadThumbs(); }, 80);
  }

  // THE SAFETY NET. A scroll listener is the tidy way to load a screenful at a time, and it is
  // kept - but this page has shown that it cannot be relied on for correctness: scroll events from
  // a programmatic scroll never arrived here at all (measured: 0 events for two `scrollTop`
  // assignments), and the same environment is the one where IntersectionObserver has been seen to
  // stop firing. So while the gallery is open a slow ticker also asks the same cheap geometric
  // question (three numbers - scrollTop, clientHeight, one row's height). Nothing can wedge: if a
  // tick is missed, the next one loads the pictures.
  var thumbWatch = null;
  function startThumbWatch() {
    if (thumbWatch) return;
    thumbWatch = setInterval(loadThumbs, 350);
  }
  function stopThumbWatch() {
    if (thumbWatch) { clearInterval(thumbWatch); thumbWatch = null; }
  }

  function render() {
    var grid = el("galGrid");
    if (!grid) return;
    compute();
    var mine = pageRows();
    grid.textContent = "";
    armed = null;
    if (!rows.length) {
      var empty = document.createElement("div");
      empty.className = "galEmpty";
      empty.textContent = total()
        ? "NOTHING MATCHES. " + total() + " PICTURES ARE IN THE VAULT - CLEAR THE SEARCH OR PICK ANOTHER FILTER."
        : "THE VAULT IS EMPTY. DROP PICTURES, CLIPS OR MUSIC ANYWHERE IN HERE, OR PRESS IMPORT, AND THEY ARE KEPT IN THIS BROWSER - THE SAME STORE SHE IS SHOWN IMAGES FROM. A CLIP KEEPS ITS FIRST FRAME AS ITS THUMBNAIL AND THE FILE ITSELF WHOLE.";
      grid.appendChild(empty);
    } else {
      var frag = document.createDocumentFragment();
      mine.forEach(function (r) { frag.appendChild(tileFor(r)); });
      grid.appendChild(frag);
    }
    // A TURNED PAGE STARTS AT THE TOP. A repaint that is not a turn - a picture landing, an import,
    // a delete, a refresh - leaves the scroll exactly where it was, so nothing he was looking at
    // moves under him for no reason.
    if (paintedPage !== state.page) {
      paintedPage = state.page;
      try { grid.scrollTop = 0; } catch (e) {}
    }
    paintChrome();
    paintPager();
    loadThumbs();
  }

  function paintChrome() {
    var n = rows.length, t = total();
    var head = el("galCount");
    if (head) head.textContent = (n === t ? t + " PICTURES" : n + " OF " + t) + (state.query ? "  \u00b7  \u201c" + state.query + "\u201d" : "");
    var stat = el("galStats");
    if (stat) {
      var bytes = 0, unseen = unseenIds().length;
      window.media.list().forEach(function (id) { var r = window.media.get(id); if (r) bytes += r.bytes || 0; });
      stat.textContent = fmtBytes(bytes) + (unseen ? "  \u00b7  " + unseen + " WAITING FOR HER EYES" : "");
    }
    var selCount = selectedIds().length;
    var sel = el("galSel");
    if (sel) {
      // A selection outlives the page it was made on (the tiles are only a window - the ids are
      // what is selected), so when some of it is elsewhere that is said rather than left to be
      // discovered on the next page turn.
      var here = pageRows().filter(function (r) { return state.sel[r.id]; }).length;
      sel.textContent = selCount ? selCount + " SELECTED" + (here !== selCount ? " \u00b7 " + here + " ON THIS PAGE" : "") : "";
    }
    ["galQueueSel", "galSaveSel", "galDelSel", "galFileSel"].forEach(function (id) {
      var b = el(id);
      if (b) b.disabled = !selCount;
    });
    var all = el("galSelectAll");
    if (all) {
      // SELECT ALL means the whole filtered view, across every page - the same thing it has always
      // meant - and it carries the number when that is more than the page he is looking at.
      all.hidden = !rows.length || selCount === rows.length;
      all.textContent = rows.length > perOf() ? "SELECT ALL " + rows.length : "SELECT ALL";
    }
    var chips = el("galFilters");
    if (chips) {
      Array.prototype.forEach.call(chips.children, function (c) {
        c.classList.toggle("on", c.dataset.filter === state.filter);
      });
    }
    paintTagRow();
    paintFolderRow();
    paintFolderMove();
  }

  // THE PAGER. It only ever states what the grid is doing: which page of the view is drawn, the
  // slice of the view that is on screen, and how big a page is. Everything it needs comes from
  // `rows` (the whole view) and `state.page`, so it is painted wherever chrome is painted and can
  // never disagree with the tiles. With one page of results there is nothing to move, so the
  // controls go away and the line is left saying what is shown - and with nothing at all the bar
  // goes away entirely.
  function paintPager() {
    var bar = el("galPager");
    if (!bar) return;
    bar.hidden = !rows.length;
    if (!rows.length) return;
    var per = perOf(), pages = pageCount(), p = clampPage();
    var range = el("galPageRange");
    if (range) {
      var from = (p - 1) * per + 1;
      var to = Math.min(rows.length, p * per);
      range.textContent = state.per > 0
        ? "SHOWING " + from + "\u2013" + to + " OF " + rows.length
        : "ALL " + rows.length + " ON ONE PAGE";
    }
    var single = pages < 2;
    var now = el("galPageNow");
    if (now) now.hidden = single;
    ["galPageFirst", "galPagePrev", "galPageNext", "galPageLast"].forEach(function (id) {
      var b = el(id);
      if (b) b.hidden = single;
    });
    var tot = el("galPageTotal");
    if (tot) tot.textContent = String(pages);
    var box = el("galPageInput");
    if (box) {
      box.max = String(Math.max(1, pages));
      if (document.activeElement !== box) box.value = String(p);
    }
    var first = el("galPageFirst"), prev = el("galPagePrev"), next = el("galPageNext"), last = el("galPageLast");
    if (first) first.disabled = p <= 1;
    if (prev) prev.disabled = p <= 1;
    if (next) next.disabled = p >= pages;
    if (last) last.disabled = p >= pages;
    var size = el("galPerPage");
    if (size) size.value = String(state.per);
  }

  // THE FOLDERS ROW: every folder on this device, with how much is in it. A folder is a PATH, and
  // this is where the vault's shape is visible at a glance - /images and /music and /clips exist
  // from the first boot, and anything he or she makes appears here. A chip shows only that folder;
  // the box at the end makes a new one (an empty folder is a real thing: /music is one).
  function paintFolderRow() {
    var row = el("galFolderRow");
    if (!row) return;
    var M = window.media;
    var list = (M && M.allFolders) ? M.allFolders() : [];
    row.textContent = "";
    var label = document.createElement("span");
    label.className = "galFolderLabel";
    label.textContent = "FOLDERS";
    label.title = "the vault is kept in folders, and a folder is a path: /images, /music, /clips, /images/portraits. Press one to show only what is filed there, or type folder:/music in the search box. She can make folders and file her own pictures too ([[FOLDER: /name]], [[FILE: /name]]).";
    row.appendChild(label);
    var active = queryFolders();
    var lit = 0;
    list.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "galFolderChip" + (active.indexOf(f.path) !== -1 ? " on" : "") + (f.made ? "" : " made");
      b.textContent = f.path + " " + f.count;
      b.title = f.count + " item" + (f.count === 1 ? "" : "s") + " filed in " + f.path + (f.made ? "" : " (a default folder)") + " - press to show only those";
      b.addEventListener("click", function (e) { e.stopPropagation(); toggleFolder(f.path); });
      row.appendChild(b);
      lit += f.count;
    });
    var input = document.createElement("input");
    input.type = "text";
    input.id = "galFolderNew";
    input.placeholder = "new folder\u2026";
    input.spellcheck = false;
    input.title = "make a folder - a path, like /music or /images/portraits. It exists as soon as it is made, empty or not.";
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); makeFolder(input.value); }
    });
    input.addEventListener("click", function (e) { e.stopPropagation(); });
    row.appendChild(input);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "galFolderChip";
    btn.textContent = "MAKE";
    btn.title = "make the folder named in the box beside this";
    btn.addEventListener("click", function (e) { e.stopPropagation(); makeFolder(input.value); });
    row.appendChild(btn);
  }

  async function makeFolder(path) {
    var M = window.media;
    if (!M || !M.createFolder) return null;
    var res = await M.createFolder(path, { by: "you" });
    if (!res.ok) { status("A FOLDER NEEDS A NAME - TYPE A PATH LIKE /music OR /images/portraits IN THE BOX."); return null; }
    var box = el("galFolderNew");
    if (box) box.value = "";
    paintFolderRow();
    status(res.existed
      ? "THE FOLDER " + res.path + " IS ALREADY HERE :: THE CHIPS SHOW HOW MUCH IS IN EACH ONE."
      : "FOLDER MADE :: " + res.path + " :: IT IS IN THE ROW ABOVE, WAITING. DROP OR IMPORT FILES, OR FILE WHAT YOU HAVE SELECTED INTO IT.");
    log((res.existed ? "FOLDER ALREADY HERE :: " : "FOLDER MADE :: ") + res.path + " :: NOTHING WAS UPLOADED.");
    return res.path;
  }

  // The select in the footer that FILE SELECTED files into: every folder, so filing from the
  // gallery never needs a path typed.
  function paintFolderMove() {
    var sel = el("galFolderMove");
    if (!sel) return;
    var M = window.media;
    var list = (M && M.allFolders) ? M.allFolders() : [];
    var want = sel.value;
    sel.textContent = "";
    list.forEach(function (f) {
      var o = document.createElement("option");
      o.value = f.path;
      o.textContent = f.path + " (" + f.count + ")";
      sel.appendChild(o);
    });
    if (want && list.some(function (f) { return f.path === want; })) sel.value = want;
  }

  async function fileSelected() {
    var ids = selectedIds();
    if (!ids.length) return;
    var sel = el("galFolderMove");
    var path = sel ? sel.value : "";
    if (!path) return;
    var res = await window.media.fileMany(ids, path, { by: "you" });
    if (!res.ok) { status(String(res.error || "NOTHING WAS FILED.")); return; }
    status("FILED " + res.filed.length + " ITEM" + (res.filed.length === 1 ? "" : "S") + " INTO " + res.path + " :: THE VAULT HAS NOTHING ELSE TO SAY ABOUT IT.");
    log("FILED INTO " + res.path + " :: " + res.filed.length + " ITEM" + (res.filed.length === 1 ? "" : "S")
      + " :: " + res.filed.map(function (id) { var r = window.media.get(id); return r ? (r.name || id) : id; }).join(" / "));
    state.sel = {};
    render();
  }

  // THE TAG ROW: every tag in the vault, commonest first, with how many pictures carry it. This is
  // the other way into the vault - "all images tagged X" is one press - and it is also where he can
  // see, at a glance, what vocabulary has built up in the vault.
  function paintTagRow() {
    var row = el("galTagRow");
    if (!row) return;
    var tags = (window.media && window.media.allTags) ? window.media.allTags() : [];
    row.hidden = !tags.length;
    if (!tags.length) { row.textContent = ""; return; }
    row.textContent = "";
    var label = document.createElement("span");
    label.className = "galTagLabel";
    label.textContent = "TAGS";
    label.title = "a tag is one word filed on a record, on its full stage (click a picture, a clip or a voice). Press one here, or type #it in the search box, to see everything carrying it - and she can reach for one too, with a [[SHOW: #tag]] line. A VOICE offers its words from a list (its agents, its moods, its kinds and engines) because nothing reads a sound for you: /audio/vox holds them, and #lia or #barbelo is how a voice is found again.";
    row.appendChild(label);
    var active = queryTags();
    tags.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "galTagChip" + (active.indexOf(t.tag) !== -1 ? " on" : "");
      b.textContent = "#" + t.tag + " " + t.count;
      b.title = t.count + " picture" + (t.count === 1 ? "" : "s") + " filed as #" + t.tag + " - press to show only those";
      b.addEventListener("click", function (e) { e.stopPropagation(); toggleTag(t.tag); });
      row.appendChild(b);
    });
  }

  /* ---- actions --------------------------------------------------------- */
  function toggleSel(id, btn) {
    state.sel[id] = !state.sel[id];
    if (!state.sel[id]) delete state.sel[id];
    var fig = (btn && btn.closest) ? btn.closest(".galTile") : document.querySelector('.galTile[data-id="' + id + '"]');
    if (fig) {
      fig.classList.toggle("sel", !!state.sel[id]);
      var pick = fig.querySelector(".gPick");
      if (pick) pick.textContent = state.sel[id] ? "\u2611" : "\u2610";
    }
    paintChrome();
    return !!state.sel[id];
  }

  function onQueue(e) {
    e.stopPropagation();
    var id = e.currentTarget.closest(".galTile").dataset.id;
    queueMany([id]);
  }
  function onSave(e) {
    e.stopPropagation();
    var id = e.currentTarget.closest(".galTile").dataset.id;
    saveMany([id]);
  }
  function onDelete(e) {
    e.stopPropagation();
    var btn = e.currentTarget;
    var id = btn.closest(".galTile").dataset.id;
    if (armed !== id) {
      armed = id; armedAt = Date.now();
      btn.classList.add("armed");
      btn.textContent = "!";
      status("PRESS AGAIN TO DELETE IT FROM THE VAULT (THIS CANNOT BE UNDONE - SAVE A COPY FIRST).");
      setTimeout(function () {
        if (armed === id) { armed = null; btn.classList.remove("armed"); btn.textContent = "\u00d7"; }
      }, 6000);
      return;
    }
    armed = null;
    deleteMany([id]);
  }

  async function queueMany(ids) {
    if (!ids.length) return;
    var names = ids.map(function (id) { var r = window.media.get(id); return r ? (r.prompt || r.name) : id; });
    var res = null;
    try { if (typeof queueSight === "function") res = await queueSight(ids); } catch (err) { status("COULD NOT QUEUE :: " + (err && err.message)); return; }
    var taken = (res && typeof res.queued === "number") ? res.queued : ids.length;
    var refused = (res && res.refused) || [];
    if (!taken) {
      status(refused.length
        ? "NOTHING TO LOOK AT :: " + refused.length + " OF THESE IS NOT A PICTURE - ONLY IMAGES GO IN FRONT OF HER, AND A CLIP REACHES HER AS THE STILL IT CARRIES."
        : "NOTHING WAS QUEUED.");
      return;
    }
    status(taken + " QUEUED FOR HER EYES :: SHE LOOKS AT " + (taken === 1 ? "IT" : "THEM") +
      " ON YOUR NEXT MESSAGE - NOTHING IS SAID TO HER IN WORDS ABOUT " + (taken === 1 ? "IT" : "THEM") + "."
      + (refused.length ? " " + refused.length + " OF THE SELECTION " + (refused.length === 1 ? "IS" : "ARE") + " NOT A PICTURE AND WAS NOT QUEUED." : ""));
    log("QUEUED FOR HER EYES :: " + taken + " \u00b7 " + names.map(function (x) { return String(x).slice(0, 60); }).join(" / "));
  }

  function saveMany(ids) {
    if (!ids.length) return;
    var failed = 0;
    ids.forEach(function (id) { try { window.media.save(id); } catch (e) { failed++; } });
    status("SAVED " + (ids.length - failed) + (ids.length === 1 ? " PICTURE" : " PICTURES") + " TO THIS MACHINE'S DOWNLOADS FOLDER" + (failed ? " :: " + failed + " COULD NOT BE WRITTEN" : "") + ".");
  }

  async function deleteMany(ids) {
    if (!ids.length) return;
    for (var i = 0; i < ids.length; i++) {
      try { await window.media.del(ids[i]); } catch (e) {}
      delete state.sel[ids[i]];
    }
    status(ids.length + " DELETED FROM THE VAULT" + (ids.length === 1 ? "" : "S") + ". THE NAMES GO WITH THEM - NOTHING ELSE IN THE TERMINAL WAS TOUCHED.");
    log("DELETED FROM THE VAULT :: " + ids.length + " PICTURE" + (ids.length === 1 ? "" : "S"));
    render();
  }

  function log(text) {
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }

  async function exportCatalogue() {
    compute();
    var stamp = window.logTime ? window.logTime.stamp() : new Date().toISOString();
    var json = {
      generator: (typeof window.generatorName === "string" ? window.generatorName : ""),
      exportedAt: stamp,
      zone: (window.logTime ? window.logTime.zoneNow() : ""),
      filter: state.filter, query: state.query, sort: state.sort,
      shown: rows.length, inVault: total(),
      pictures: rows.map(function (r) {
        var rec = r.rec;
        return {
          id: r.id, stamp: stampOf(rec.ts), ts: rec.ts, kind: r.kind, badge: badgeFor(rec),
          name: rec.name || "", file: (window.media.fileName ? window.media.fileName(rec) : ""),
          folder: folderOf(rec), bytes: rec.bytes || 0, w: rec.w || 0, h: rec.h || 0, mime: rec.mime || "",
          prompt: rec.prompt || "", sent: rec.sent || "", negative: rec.negative || "",
          seed: rec.seed || 0, guidanceScale: rec.guidanceScale || 0, resolution: rec.resolution || "",
          pose: rec.pose || "", note: rec.note || "", duration: rec.duration || 0,
          tags: (rec.tags || []).slice(),
          renderBook: (window.renderBook && window.renderBook.labelOf) ? (window.renderBook.labelOf(r.id) || "") : "",
          herReading: rec.sight || "",
          turn: r.memo ? r.memo.turn : 0, source: r.memo ? r.memo.how : "",
          turnSaid: r.memo ? String(r.memo.h || "") : "", turnAnswered: r.memo ? String(r.memo.s || "") : ""
        };
      })
    };
    var text = "LIA GALLERY CATALOGUE\n"
      + "EXPORTED: " + stamp + "\n"
      + "PICTURES: " + rows.length + " OF " + total() + " IN THE VAULT"
      + (state.filter !== "all" || state.query ? " (FILTERED: " + state.filter.toUpperCase() + (state.query ? " :: \u201c" + state.query + "\u201d" : "") + ")" : "") + "\n"
      + "EVERY LINE BELOW IS ONE PICTURE, WITH THE STAMP IT WAS STORED UNDER.\n\n";
    rows.forEach(function (r) {
      var rec = r.rec;
      text += "[" + stampOf(rec.ts) + "] " + badgeFor(rec) + "  \u00b7  " + (rec.name || "image")
        + "  \u00b7  " + folderOf(rec)
        + (rec.w && rec.h ? "  \u00b7  " + rec.w + "\u00d7" + rec.h : "")
        + (rec.bytes ? "  \u00b7  " + fmtBytes(rec.bytes) : "")
        + (rec.duration ? "  \u00b7  " + rec.duration.toFixed(1) + "s" : "") + "\n";
      if (rec.prompt) text += "    prompt: " + rec.prompt + "\n";
      if (rec.sent && rec.sent !== rec.prompt) text += "    sent: " + rec.sent + "\n";
      if (rec.negative) text += "    negative: " + rec.negative + "\n";
      if (rec.seed) text += "    seed: " + rec.seed + (rec.guidanceScale ? "  \u00b7  guidance: " + rec.guidanceScale : "") + "\n";
      if (rec.resolution) text += "    size: " + rec.resolution + "\n";
      if (rec.pose) text += "    pose: " + rec.pose + "\n";
      if (rec.tags && rec.tags.length) text += "    tags: " + rec.tags.map(function (t) { return "#" + t; }).join(" ") + "\n";
      if (rec.note) text += "    note: " + rec.note + "\n";
      if (rec.sight) text += "    her reading: " + rec.sight + "\n";
      var rbLabel = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(r.id) : "";
      if (rbLabel) text += "    render book: " + rbLabel + "  (/renders " + rbLabel + " for the whole recipe)\n";
      if (r.memo && r.memo.turn) {
        text += "    turn #" + r.memo.turn + " (" + (r.memo.how === "made" ? "she made it in her reply" : r.memo.how === "sent" ? "he sent it" : "she looked at it") + ")\n";
        if (r.memo.h) text += "      Patrikios: " + String(r.memo.h).replace(/\s+/g, " ").slice(0, 200) + "\n";
        if (r.memo.s) text += "      LIA ID: " + String(r.memo.s).replace(/\s+/g, " ").slice(0, 200) + "\n";
      }
      text += "\n";
    });

    downloadText("gallery_" + Date.now() + ".json", JSON.stringify(json, null, 2), "application/json");
    downloadText("gallery_" + Date.now() + ".txt", text, "text/plain");
    status("CATALOGUE EXPORTED :: " + rows.length + " PICTURES, JSON AND TEXT, IN THIS MACHINE'S DOWNLOADS FOLDER.");
    log("GALLERY CATALOGUE EXPORTED :: " + rows.length + " PICTURE" + (rows.length === 1 ? "" : "S") + " \u00b7 EVERY LINE CARRIES ITS STAMP, ITS PROMPT AND THE TURN IT CAME FROM. NOTHING WAS UPLOADED.");
    return json;
  }

  function downloadText(name, body, mime) {
    var blob = new Blob([body], { type: mime || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // Import: his viewer's drag-and-drop and file picker, but landing in the
  // VAULT instead of a page-local array. Pictures are normalised exactly the
  // way an attachment is (jpeg, longest side <= 1024px) so the vision model
  // can look at any of them later without a second copy anywhere. A piece of
  // MUSIC is the file itself, kept whole (nothing re-encodes an mp3), and it
  // goes to /music unless a folder is being shown.
  async function importFiles(files) {
    var list = Array.prototype.slice.call(files || []).filter(Boolean);
    var pics = list.filter(function (f) {
      return /^image\//.test(f.type || "") || /\.(png|jpe?g|webp|gif|avif|bmp|heic|heif|tiff?)$/i.test(f.name || "");
    });
    var tunes = list.filter(function (f) {
      return /^audio\//.test(f.type || "") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(f.name || "");
    });
    // CLIPS (2026-09-23). A video file is taken the way an attached one is: its FIRST FRAME is drawn
    // and kept as a picture (the thumbnail the player wears, and the only picture of the clip that
    // goes to her eyes), and the file itself is kept WHOLE - byte for byte, nothing re-encoded - in
    // /clips (or in the folder being shown). It is the same road a paperclipped clip takes
    // (window.attach.keepClip), so a clip is one thing wherever it comes from. A file too big for the
    // vault keeps only its first frame, and one this browser cannot decode still keeps the file.
    var clips = list.filter(function (f) {
      return /^video\//.test(f.type || "") || /\.(mp4|m4v|mov|webm|ogv|mkv|avi)$/i.test(f.name || "");
    });
    if (!pics.length && !tunes.length && !clips.length) { status("NOTHING TO IMPORT :: DROP PICTURES (PNG, JPG, WEBP, GIF, AVIF), CLIPS (MP4, MOV, WEBM, MKV) OR MUSIC (MP3, WAV, M4A, OGG, FLAC) OR USE THE PICKER."); return 0; }
    var target = queryFolders()[0] || "";
    var totalIn = pics.length + tunes.length + clips.length;
    status("IMPORTING " + totalIn + " FILE" + (totalIn === 1 ? "" : "S") + (target ? " INTO " + target : "") + "\u2026");
    var added = 0, failed = 0, bigClips = 0, silentClips = 0;
    // THE BAR (src/js/progress.js): an import of a folder of pictures is one file after another, and
    // each one is normalised and written - a real count, and the gallery's own status line is inside
    // the overlay. An indeterminate claim would be wrong here: the number of files is known.
    var P = null;
    try {
      if (window.progress) P = window.progress.begin("IMPORTING INTO THE VAULT", { id: "gallery-import", total: totalIn, detail: "kept in this browser - nothing is uploaded" });
    } catch (e) {}
    var done = 0;
    var tick = function () { done++; if (P) P.set(done); };
    for (var i = 0; i < pics.length; i++) {
      try {
        var norm = await window.media.normalize(pics[i]);
        await window.media.add(norm.blob, {
          name: pics[i].name || "imported.jpg", w: norm.w, h: norm.h, kind: "attach",
          folder: target,
          note: "imported into the gallery on this device"
        });
        added++;
      } catch (e) { failed++; }
      tick();
    }
    for (var k = 0; k < tunes.length; k++) {
      try {
        var dur = await probeDuration(tunes[k]);
        await window.media.add(tunes[k], {
          name: tunes[k].name || "music.mp3", mime: window.media.mimeFor(tunes[k], tunes[k].name),
          kind: "attach", duration: dur, folder: target,
          note: "kept whole as it arrived" + (dur ? " \u00b7 " + dur.toFixed(1) + "s" : "")
        });
        added++;
      } catch (e) { failed++; }
      tick();
    }
    for (var c = 0; c < clips.length; c++) {
      try {
        var co = (window.attach && window.attach.keepClip)
          ? await window.attach.keepClip(clips[c], { folder: target, room: false, quiet: true })
          : null;
        if (!co || (!co.kept && !co.poster)) { failed++; tick(); continue; }
        if (co.tooBig) bigClips++;
        if (!co.poster) silentClips++;
        added++;
      } catch (e) { failed++; }
      tick();
    }
    try { if (window.progress) window.progress.finish("gallery-import"); } catch (e) {}
    status(added + " KEPT IN THE VAULT" + (failed ? " :: " + failed + " COULD NOT BE READ" : "")
      + (bigClips ? " :: " + bigClips + " CLIP" + (bigClips === 1 ? "" : "S") + " TOO BIG FOR THE VAULT, " + (bigClips === 1 ? "ITS" : "THEIR") + " FIRST FRAME KEPT INSTEAD" : "")
      + (silentClips ? " :: " + silentClips + " CLIP" + (silentClips === 1 ? "" : "S") + " KEPT WHOLE BUT WITH NO FRAME DRAWN HERE" : "")
      + " :: THEY STAY IN THIS BROWSER AND SHE CAN BE SHOWN ANY OF THEM.");
    log("GALLERY IMPORT :: " + added + " FILE" + (added === 1 ? "" : "S") + " KEPT IN THE VAULT" + (failed ? " \u00b7 " + failed + " REJECTED" : "") + " \u00b7 NOTHING WAS UPLOADED.");
    compute();
    render();
    return added;
  }

  // How long a piece of music is, read off the file itself before it is stored.
  function probeDuration(file) {
    return new Promise(function (resolve) {
      var url = null;
      try { url = URL.createObjectURL(file); } catch (e) { resolve(0); return; }
      var a = document.createElement("audio");
      var done = function (v) { try { URL.revokeObjectURL(url); } catch (e) { } resolve(v || 0); };
      var t = setTimeout(function () { done(0); }, 5000);
      a.preload = "metadata";
      a.addEventListener("loadedmetadata", function () { clearTimeout(t); done(isFinite(a.duration) ? a.duration : 0); });
      a.addEventListener("error", function () { clearTimeout(t); done(0); });
      a.src = url;
    });
  }

  /* ---- the overlay ----------------------------------------------------- */

  function buildChrome() {
    var chips = el("galFilters");
    chips.textContent = "";
    FILTERS.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.filter = f.id;
      b.textContent = f.label;
      b.title = f.id === "unseen" ? "pictures she has not been given to look at yet" : "show only: " + f.label.toLowerCase();
      b.addEventListener("click", function () { setFilter(f.id); });
      chips.appendChild(b);
    });
    var sorts = el("galSort");
    sorts.textContent = "";
    SORTS.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      sorts.appendChild(o);
    });
    sorts.value = state.sort;
    sorts.addEventListener("change", function () { setSort(sorts.value); });

    var search = el("galSearch");
    search.addEventListener("input", function () {
      // Not `setQuery` here: that trims, and a box that eats the space he just typed is worse than
      // the trim is worth. The trim still lands in the query - the same as setQuery - and the page
      // starts again, because a search is a new view.
      state.query = search.value.trim();
      state.page = 1;
      render();
    });
    search.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); search.value = ""; state.query = ""; state.page = 1; render(); }
    });

    el("galClose").addEventListener("click", close);
    el("galRefresh").addEventListener("click", function () { refresh(true); });
    el("galSelectAll").addEventListener("click", function () {
      rows.forEach(function (r) { state.sel[r.id] = true; });
      render();
    });
    el("galClearSel").addEventListener("click", function () {
      state.sel = {};
      render();
    });
    el("galQueueSel").addEventListener("click", function () { queueMany(selectedIds()); });
    el("galFileSel").addEventListener("click", function () { fileSelected(); });
    el("galSaveSel").addEventListener("click", function () { saveMany(selectedIds()); });
    el("galDelSel").addEventListener("click", function (e) { onBulkDelete(e.currentTarget); });
    el("galExport").addEventListener("click", function () { exportCatalogue(); });
    el("galImport").addEventListener("click", function () { el("galFileInput").click(); });
    el("galFileInput").addEventListener("change", function (e) {
      importFiles(e.target.files);
      e.target.value = "";
    });

    // THE PAGER. Four jumps, a page box, and the size of a page. Nothing here computes anything -
    // the pager paints itself from `rows` and `state.page`, so a turn is a render and nothing else.
    var size = el("galPerPage");
    if (size) {
      size.textContent = "";
      PERS.forEach(function (p) {
        var o = document.createElement("option");
        o.value = String(p.n);
        o.textContent = p.label;
        size.appendChild(o);
      });
      size.value = String(state.per);
      size.addEventListener("change", function () { setPer(Number(size.value)); });
    }
    if (el("galPageFirst")) el("galPageFirst").addEventListener("click", function () { setPage(1); });
    if (el("galPagePrev")) el("galPagePrev").addEventListener("click", function () { stepPage(-1); });
    if (el("galPageNext")) el("galPageNext").addEventListener("click", function () { stepPage(1); });
    if (el("galPageLast")) el("galPageLast").addEventListener("click", function () { setPage(pageCount()); });
    var pbox = el("galPageInput");
    if (pbox) {
      // A number typed here and Enter is a jump; a number typed and then left alone is the same
      // jump. Garbage is not a jump - the box is put back to the page he is actually on.
      var jump = function () {
        var v = Math.floor(Number(pbox.value));
        if (v >= 1) setPage(v); else paintPager();
      };
      pbox.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); jump(); }
      });
      pbox.addEventListener("change", jump);
      pbox.addEventListener("click", function (e) { e.stopPropagation(); });
    }

    var panel = el("gallery");
    var gridEl = el("galGrid");
    if (gridEl) gridEl.addEventListener("scroll", thumbSoon, { passive: true });
    window.addEventListener("resize", thumbSoon);
    ["dragenter", "dragover"].forEach(function (ev) {
      panel.addEventListener(ev, function (e) { e.preventDefault(); panel.classList.add("dragover"); });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      panel.addEventListener(ev, function (e) {
        if (e.target === panel) panel.classList.remove("dragover");
      });
    });
    panel.addEventListener("drop", function (e) {
      e.preventDefault();
      panel.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    });
  }

  function onBulkDelete(btn) {
    var ids = selectedIds();
    if (!ids.length) return;
    if (btn.dataset.armed !== "1") {
      btn.dataset.armed = "1";
      btn.textContent = "SURE? " + ids.length;
      status("PRESS AGAIN TO DELETE " + ids.length + " PICTURE" + (ids.length === 1 ? "" : "S") + " FROM THE VAULT - THIS CANNOT BE UNDONE. SAVE THEM FIRST IF THEY MATTER.");
      return;
    }
    btn.dataset.armed = "";
    btn.textContent = "DELETE";
    deleteMany(ids);
  }

  // A VIEW THAT CHANGES STARTS AGAIN AT THE FIRST PAGE - the filter, the search, the sort and the
  // page size are all "show me something else", and page 37 of something else is not a place he has
  // ever been. Everything that only fills the vault further down keeps the page he is on.
  function setFilter(id) {
    state.filter = FILTERS.some(function (f) { return f.id === id; }) ? id : "all";
    state.page = 1;
    render();
  }
  function setQuery(q) {
    state.query = String(q || "");
    var s = el("galSearch");
    if (s) s.value = state.query;
    state.page = 1;
    render();
  }
  function setSort(id) {
    state.sort = SORTS.some(function (s) { return s.id === id; }) ? id : "newest";
    var sel = el("galSort");
    if (sel) sel.value = state.sort;
    state.page = 1;
    render();
  }

  // THE PAGE TURNS. `setPage` is the one door: it clamps to a page that exists, repaints only when
  // the number actually changed, and returns where he ended up. The grid itself is only redrawn by
  // `render` (one screenful), so a turn costs exactly what one screenful costs.
  function setPage(n) {
    var p = Math.floor(Number(n) || 1);
    if (p < 1) p = 1;
    var pc = pageCount();
    if (p > pc) p = pc;
    if (p === state.page) { paintPager(); return state.page; }
    state.page = p;
    render();
    return state.page;
  }
  function stepPage(d) { return setPage(state.page + d); }

  function setPer(n) {
    var want = Math.floor(Number(n));
    if (!perKnown(want)) return state.per;
    state.per = want;
    state.page = 1;
    saveView();
    render();
    var pages = pageCount();
    if (want === 0) {
      status(rows.length > PER_WARN
        ? "ALL " + rows.length + " ON ONE PAGE :: THEY ARE ALL HERE, BUT A VAULT THIS SIZE DRAWS EVERY TILE AT ONCE AND THAT IS THE SLOW WAY - PER PAGE 240 IS THE USUAL ROOM."
        : "ALL " + rows.length + " ON ONE PAGE :: THE WHOLE VIEW IN ONE SCROLL.");
    } else {
      status("PER PAGE :: " + perLabel(want) + " \u00b7 " + pages + " PAGE" + (pages === 1 ? "" : "S") + " OF " + rows.length + " \u00b7 THE ARROWS AND THE PAGER MOVE IT.");
    }
    return state.per;
  }

  // The page size is remembered across reloads the way the picture size is (lia_settings/pic_size):
  // one small record, written when he changes it, read once at boot.
  function saveView() {
    try {
      if (window.root && window.root.kv && window.root.kv.lia_settings) {
        window.root.kv.lia_settings.set(VIEW_KEY, { per: state.per });
      }
    } catch (e) {}
  }
  function loadView() {
    try {
      return window.root.kv.lia_settings.get(VIEW_KEY).then(function (v) {
        if (v && typeof v.per === "number" && perKnown(v.per)) {
          state.per = v.per;
          if (state.open) render(); else paintPager();
        }
      }).catch(function () {});
    } catch (e) { return null; }
  }

  async function refresh(announce) {
    await window.media.ensure();
    await buildCatalogue();
    if (state.open) render();
    if (announce) status("RE-READ THE VAULT AND THE ARCHIVE :: " + total() + " PICTURES" + (window.logTime ? "  \u00b7  " + window.logTime.stamp() : ""));
    return rows.length;
  }

  async function open(opts) {
    opts = opts || {};
    var newView = false;
    if (opts.filter) { state.filter = opts.filter; newView = true; }
    if (opts.query != null) { state.query = String(opts.query); newView = true; }
    if (opts.folder != null && window.media && window.media.normFolder) {
      var fp = window.media.normFolder(opts.folder);
      state.query = (queryText() + (fp ? " folder:" + fp : "")).replace(/\s+/g, " ").trim();
      newView = true;
    }
    if (opts.sort) { state.sort = opts.sort; newView = true; }
    // OPENED ON SOMETHING PARTICULAR, IT OPENS ON THE FIRST PAGE OF IT - the same rule the filter
    // and the search box follow when he changes them by hand. Opened plainly it keeps the page he
    // was standing on (closing the gallery and coming back is not a new view).
    if (newView) state.page = 1;
    var panel = el("gallery");
    if (!panel) return false;
    var search = el("galSearch");
    if (search && search.value !== state.query) search.value = state.query;
    var sorts = el("galSort");
    if (sorts) sorts.value = state.sort;
    panel.hidden = false;
    state.open = true;
    document.body.classList.add("galleryOpen");
    status("READING THE VAULT AND THE ARCHIVE\u2026");
    await refresh(false);
    startThumbWatch();
    status(total() + " PICTURES IN THE VAULT \u00b7 EVERY ONE KEPT IN THIS BROWSER \u00b7 NOTHING IS UPLOADED. DROP PICTURES ANYWHERE TO KEEP MORE.");
    return true;
  }

  function close() {
    var panel = el("gallery");
    if (panel) panel.hidden = true;
    state.open = false;
    stopThumbWatch();
    document.body.classList.remove("galleryOpen");
    state.sel = {};
    return true;
  }

  function toggle(opts) {
    if (state.open) { close(); return false; }
    open(opts);
    return true;
  }

  // The text report `/gallery` and `/help gallery` print.
  function describe() {
    var list = allRows();
    var by = { render: 0, sent: 0, clip: 0, upscaled: 0 };
    var bytes = 0, oldest = 0, newest = 0;
    list.forEach(function (r) {
      by[r.kind] = (by[r.kind] || 0) + 1;
      bytes += r.rec.bytes || 0;
      if (!oldest || r.ts < oldest) oldest = r.ts;
      if (r.ts > newest) newest = r.ts;
    });
    var out = ["THE GALLERY :: " + list.length + " PICTURE" + (list.length === 1 ? "" : "S") + " IN THE VAULT (" + fmtBytes(bytes) + "), ALL OF IT IN THIS BROWSER"];
    out.push("  " + by.render + " MADE BY THE TERMINAL (SHE OR THE FORGE) \u00b7 " + by.sent + " SENT OR IMPORTED BY YOU \u00b7 "
      + by.clip + " CLIP" + (by.clip === 1 ? "" : "S") + " \u00b7 " + by.upscaled + " UPSCALED \u00b7 "
      + (by.music || 0) + " MUSIC \u00b7 " + (by.vox || 0) + " VOX (VOICE SAMPLES - FILED IN /audio/vox, THE TAB NAMED VOX)");
    if (oldest) out.push("  FIRST: " + stampOf(oldest) + "   \u00b7   NEWEST: " + stampOf(newest));
    var unseen = unseenIds().length;
    out.push("  " + unseen + " WAITING FOR HER EYES" + (unseen ? " (/sight)" : ""));
    var tags = (window.media && window.media.allTags) ? window.media.allTags() : [];
    out.push("  TAGS: " + (tags.length
      ? tags.length + " IN USE \u00b7 " + tags.slice(0, 14).map(function (t) { return "#" + t.tag + "(" + t.count + ")"; }).join(" ")
        + (tags.length > 14 ? " \u00b7 /gallery find #<TAG>" : "")
      : "NONE YET - CLICK A PICTURE AND FILE IT WITH A TAG, THEN #IT FINDS EVERYTHING THAT CARRIES IT"));
    var folders = (window.media && window.media.allFolders) ? window.media.allFolders() : [];
    out.push("  FOLDERS: " + folders.map(function (f) { return f.path + "(" + f.count + ")"; }).join("  \u00b7  ")
      + "  \u00b7  /folder LISTS THEM, /folder new <PATH> MAKES ONE, /folder open <PATH> SHOWS ONLY THAT ONE");
    // HOW IT IS SHOWN. The grid draws one page at a time (2026-09-24): the view, the counts and the
    // export stay the WHOLE filtered set, and the full stage walks all of it - a page is what is
    // drawn, never what is searched.
    var galPages = state.per > 0 ? Math.max(1, Math.ceil(list.length / state.per)) : 1;
    out.push("  SHOWN " + (state.per > 0
      ? state.per + " TO A PAGE (" + galPages + " PAGE" + (galPages === 1 ? "" : "S") + ")"
      : "ALL ON ONE PAGE")
      + " \u00b7 THE ARROW KEYS AND THE PAGER MOVE IT \u00b7 /gallery page <N> \u00b7 /gallery per <24|60|120|240|all>");
    out.push("  /gallery OPEN IT \u00b7 /gallery hers|yours|music|vox|clips|upscaled|unseen \u00b7 /gallery find <WORDS|#TAG|/FOLDER> \u00b7 /gallery page <N> \u00b7 /gallery export \u00b7 /gallery stats"
      + "\n  VOX IS VOCAL AUDIO AND MUSIC IS MUSIC. A voice is a record filed anywhere in the /audio/vox tree (/audio/vox, /audio/vox/lia, /audio/vox/barbelo) - filing one there is the only thing that makes it a VOX sample, and the story lane clones a Chatterbox story from exactly those.");
    out.push("  EVERY PICTURE CARRIES ITS STAMP, ITS PROMPT, ITS SEED, ITS TAGS, AND THE TURN IT CAME FROM. SAVE AND UPSCALE ARE ON THE FULL STAGE (CLICK A PICTURE); THE WHOLE THING IS ON THIS DEVICE.");
    out.push("  /renders IS THE BOOK OF WHAT WAS MADE: THE EXACT PROMPT, SEED, GUIDANCE AND SIZE OF EVERY RENDER, NUMBERED R1..Rn, WITH /renders redo R12 PUTTING ONE BACK IN THE FORGE.");
    return out.join("\n");
  }

  // Put the grid where a record is: the page that holds it, if the current view holds it at all.
  // What a link that names a picture wants, so the grid behind the stage is standing on the same
  // picture's page rather than on page 1 of a view that happens to include it. Returns the page, or
  // 0 if the id is not in the view.
  function reveal(id) {
    var p = pageOfId(String(id == null ? "" : id));
    if (!p) return 0;
    setPage(p);
    return p;
  }

  window.gallery = {
    open: open, close: close, toggle: toggle, isOpen: function () { return state.open; },
    render: render, refresh: refresh, describe: describe,
    exportCatalogue: exportCatalogue, importFiles: importFiles,
    setFilter: setFilter, setQuery: setQuery, setSort: setSort, toggleTag: toggleTag,
    toggleFolder: toggleFolder, makeFolder: makeFolder, fileSelected: fileSelected,
    setPage: setPage, stepPage: stepPage, setPer: setPer, reveal: reveal,
    pageSizes: function () { return PERS.slice(); },
    allTags: function () { return (window.media && window.media.allTags) ? window.media.allTags() : []; },
    queryTags: queryTags, queryFolders: queryFolders,
    folders: function () { return (window.media && window.media.allFolders) ? window.media.allFolders() : []; },
    noteFor: noteFor, badgeFor: badgeFor, kindOf: kindOf, catalogue: function () { return cat; },
    rows: function () { return rows.slice(); },
    state: function () {
      var page = clampPage(), pages = pageCount(), per = perOf();
      return { open: state.open, filter: state.filter, query: state.query, sort: state.sort,
               sel: selectedIds().length, shown: rows.length, vault: total(),
               page: page, pages: pages, per: state.per,
               onPage: rows.length ? Math.min(per, rows.length - (page - 1) * per) : 0,
               catalogueTurns: cat ? Object.keys(cat).length : 0, catAt: catAt };
    }
  };

  // A picture that lands while the gallery is open should appear on its own. Every picture - a
  // render of hers, an upscale, an import, an attachment - comes through the vault's one door,
  // `window.media.add`, so that is the one place to hear about it. The wrapper is put on once and
  // passes the call straight through: the gallery is a VIEW and must never stand between the
  // terminal and its vault.
  function watchVault() {
    if (!window.media || typeof window.media.add !== "function" || window.media.__galleryWatched) return;
    var realAdd = window.media.add;
    window.media.add = async function (blob, meta) {
      var id = await realAdd.call(window.media, blob, meta);
      try {
        if (state.open) {
          await buildCatalogue();
          render();
          status("A NEW PICTURE LANDED IN THE VAULT :: " + total() + " IN ALL, NEWEST AT THE TOP.");
        }
      } catch (e) { /* a repaint must never break the render that caused it */ }
      return id;
    };
    window.media.__galleryWatched = true;
  }

  /* ---- the keyboard: the page turns ----------------------------------------
     ARROWS AND PAGES MOVE THE GRID, one page at a time - the same arrows the full stage walks
     pictures with, so "left/right" means "the one before / the one after" wherever he is standing,
     and PageUp/PageDown and Home/End mean what they say. It is deliberately NOT wired for typing
     (the search box, the folder box and the page box are the field's) and it stands aside for
     anything stacked ON TOP of the gallery: the full stage owns the arrows while it is up, and so
     does the mini lightbox.

     WHY THIS LISTENER IS REGISTERED HERE, at the top level of the module, and not inside
     buildChrome(): the ANY-KEY-DISMISSES handler at the end of main.js closes the gallery on any
     key at all when nothing is being typed, and index.html loads this file BEFORE main.js - so this
     listener is registered first, and `stopImmediatePropagation` is what keeps an arrow meaning
     "the next page" instead of "throw the gallery away". A listener put on DOMContentLoaded would
     run AFTER main.js's and would never see the key at all.
     ------------------------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    if (!state.open) return;
    var lb = document.getElementById("lightbox");
    if (lb && !lb.hidden) return;
    if (window.miniBox && window.miniBox.isOpen && window.miniBox.isOpen()) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    var aim = 0;
    if (e.key === "ArrowRight" || e.key === "PageDown") aim = 1;
    else if (e.key === "ArrowLeft" || e.key === "PageUp") aim = -1;
    else if (e.key === "Home") aim = "first";
    else if (e.key === "End") aim = "last";
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (aim === "first") setPage(1);
    else if (aim === "last") setPage(pageCount());
    else stepPage(aim);
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (el("gallery")) { buildChrome(); watchVault(); loadView(); }
  });
})();
