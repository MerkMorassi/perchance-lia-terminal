window.framelane = (function () {
  "use strict";

  var FOLDER = "lia_frame";
  var KEY = "frame_board";

  var lane = null;
  var built = false;
  var homeParent = null;
  var homeNext = null;
  var fullKeyHandler = null;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function say(t) { try { print("SYSTEM", t); } catch (e) {} }

  function store() {
    var k = kv();
    if (!k) return null;
    return {
      load: function () { return k.get(KEY); },
      save: function (v) { return k.set(KEY, v); }
    };
  }

  async function ready() {
    if (lane) return lane;
    if (!window.MythosFrame || typeof window.MythosFrame.client !== "function") return null;
    try {
      lane = window.MythosFrame.client({
        store: store(),
        say: function (t) { var n = el("frNote"); if (n) n.textContent = t; }
      });
      await lane.load();
    } catch (e) { return null; }
    return lane;
  }

  function show(src) {
    mediaShowing = false;
    hushAudio();
    hushVideo();
    var f = el("frFrame");
    if (!f) return;
    if (src) f.src = src;
    else f.removeAttribute("src");
    f.hidden = false;
    track(src ? { kind: "link", label: src, src: src } : null);
  }

  var VIDEO_EXT = /\.(mp4|webm|ogv|m4v)(\?|#|$)/i;
  var AUDIO_EXT = /\.(mp3|ogg|oga|wav|flac|m4a)(\?|#|$)/i;
  var mediaUrl = "";
  var mediaOwn = false;
  var mediaShowing = false;
  var auUrl = "";
  var auOwn = false;
  var auDrag = false;
  var auWired = false;

  // MEDIA. Video and audio play in a plain <video> tag, not the iframe - the frame chip's
  // gate refuses blob: URLs on purpose, so device files never go through the chip at all:
  // picked files live as object URLs for this page only, never uploaded, never kept.
  // Only URLs the frame itself minted (own=true) are ever revoked - the vault keeps its
  // own cached URLs, and closing the frame must never kill a gallery tile.
  // THE FAVORITES. The playlist: whatever is playing - a pinned link, a media link, a
  // vault clip, a streamed piece - is kept by vault id or by url, on this device, for
  // next time. A device file is never keepable: its url dies with the page, so FAV says
  // so instead of keeping a dead button. Press a favorite to play it; FAV while it plays
  // drops it again.
  var FAV_KEY = "frame_favs";
  var favs = [];
  var current = null;

  function shortLabel(s) { return String(s == null ? "" : s).toUpperCase().slice(0, 28) || "UNTITLED"; }
  function favKey(it) { return it.vaultId ? ("v:" + it.vaultId) : ("s:" + (it.src || "")); }

  async function loadFavs() {
    var k = kv();
    try { var v = k ? await k.get(FAV_KEY) : null; favs = Array.isArray(v) ? v.filter(function (f) { return f && (f.vaultId || f.src); }) : []; }
    catch (e) { favs = []; }
  }
  async function saveFavs() {
    var k = kv();
    if (!k) return;
    try { await k.set(FAV_KEY, favs); } catch (e) {}
  }
  function isFav() {
    if (!current) return false;
    var k = favKey(current);
    for (var i = 0; i < favs.length; i++) { if (favKey(favs[i]) === k) return true; }
    return false;
  }
  function paintFavBtn() {
    var b = el("frFavBtn");
    if (b) { b.textContent = isFav() ? "UNFAV" : "FAV"; }
  }
  function track(it) {
    current = it && (it.vaultId || it.src) ? { kind: it.kind || "link", label: it.label || it.src || "", src: it.src || "", vaultId: it.vaultId || "" } : null;
    paintFavBtn();
  }
  function toggleFav() {
    if (!current) { say("NOTHING PLAYING - PLAY SOMETHING FIRST, THEN KEEP IT."); return; }
    if (!current.vaultId && /^blob:/.test(current.src || "")) { say("THIS FILE LIVES FOR THIS PAGE ONLY - IT CANNOT BE KEPT. PICK IT AGAIN NEXT TIME."); return; }
    var k = favKey(current), at = -1;
    for (var i = 0; i < favs.length; i++) { if (favKey(favs[i]) === k) { at = i; break; } }
    if (at !== -1) {
      favs.splice(at, 1);
      say("DROPPED FROM THE FAVORITES :: " + shortLabel(current.label) + ".");
    } else {
      favs.push({ label: current.label, src: current.src || "", vaultId: current.vaultId || "", ts: Date.now() });
      say("KEPT IN THE FAVORITES :: " + shortLabel(current.label) + " - PRESS IT NEXT TIME.");
    }
    saveFavs().then(function () { paintFavs(); });
  }
  async function paintFavs() {
    await loadFavs();
    var box = el("frFav");
    if (box) {
      box.innerHTML = "";
      for (var i = 0; i < favs.length; i++) {
        (function (fv) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = shortLabel(fv.label);
          b.title = String(fv.label || "") + " - press to play (FAV while it plays drops it)";
          b.addEventListener("click", function () {
            if (fv.vaultId) playVault(fv.vaultId);
            else play(fv.src);
          });
          box.appendChild(b);
        })(favs[i]);
      }
    }
    paintFavBtn();
  }

  function showMedia(src, own) {
    quietBus();
    hushAudio();
    var f = el("frFrame");
    var v = el("frMedia");
    if (f) { f.removeAttribute("src"); f.hidden = true; }
    if (!v) return;
    if (mediaUrl && mediaOwn) { try { URL.revokeObjectURL(mediaUrl); } catch (e) {} }
    mediaUrl = ""; mediaOwn = false;
    v.src = src;
    if (own && /^blob:/.test(src)) { mediaUrl = src; mediaOwn = true; }
    mediaShowing = true;
    v.hidden = false;
    try { v.load(); } catch (e) {}
    track({ kind: "video", label: src, src: src });
  }

  function isVideoLink(s) { return VIDEO_EXT.test(String(s || "")); }
  function isAudioLink(s) { return AUDIO_EXT.test(String(s || "")); }

  // FAV-SHAPED LINKS. A favorite might be a Vimeo watch link or a YouTube watch link -
  // neither frames as-is. Before anything plays, Vimeo-shaped specs go through the Vimeo
  // chip to a player url, and YouTube watch links to their embed form; everything else
  // passes untouched. Favorites keep whatever played, so they keep the playable form.
  function frameableLink(s) {
    var u = String(s || "");
    try {
      if (window.MythosVimeo && /vimeo\.com/i.test(u) && u.indexOf("player.vimeo.com") === -1) {
        var p = window.MythosVimeo.parse(u);
        if (p && p.ok) {
          var v = window.MythosVimeo.playerUrl(p, {});
          if (v && v.ok && v.url) return v.url;
        }
        return u;
      }
      var yt = u.match(/(?:youtube\.com\/watch\?.*?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
      if (yt) return "https://www.youtube.com/embed/" + yt[1];
    } catch (e) {}
    return u;
  }

  // THE AUDIO RACK. Sound in the frame gets its own small player cut from the audition
  // bus's cloth (src/js/audition.js): the same rack, row, seek, time and volume, but none
  // of the bus's machinery - no queue, no ASK HER, no ears. One courtesy to the one
  // transport: when the rack starts, the bus is paused, so nothing ever talks over
  // anything. Device files and bare links play here; the vault's own music stays on
  // the bus, where she can hear it too.
  function auEl() { return el("frAuEl"); }
  function mmss(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function quietBus() {
    try {
      var b = window.audition;
      if (b && b.state && b.state().playing && b.pause) b.pause();
    } catch (e) {}
  }
  function paintAu() {
    var a = auEl();
    if (!a) return;
    var playing = !a.paused && !a.ended;
    var pl = el("frAuPlay"), sk = el("frAuSeek"), tm = el("frAuTime"), st = el("frAuState");
    if (pl) { pl.textContent = playing ? "❚❚" : "▶"; pl.title = playing ? "pause (your place is kept)" : "play"; }
    if (st) st.textContent = playing ? "PLAYING" : (a.currentTime > 0 && !a.ended ? "PAUSED" : (a.getAttribute("src") ? "LOADED" : ""));
    var d = Number(a.duration) || 0, at = Number(a.currentTime) || 0;
    if (sk && !auDrag && d > 0) sk.value = String(Math.round(at / d * 1000));
    if (tm) tm.textContent = d > 0 ? (mmss(at) + " / " + mmss(d)) : (at > 0 ? mmss(at) : "");
  }
  function hushAudio() {
    var a = auEl();
    if (a) { try { a.pause(); } catch (e) {} }
    var rack = el("frAudio");
    if (rack) rack.hidden = true;
  }
  function showAudio(src, label, own) {
    quietBus();
    hushVideo();
    var f = el("frFrame");
    if (f) { f.removeAttribute("src"); f.hidden = true; }
    var a = auEl();
    var rack = el("frAudio");
    if (!a || !rack) return;
    if (auUrl && auOwn) { try { URL.revokeObjectURL(auUrl); } catch (e) {} }
    auUrl = ""; auOwn = false;
    try { a.pause(); } catch (e) {}
    a.src = src;
    if (own && /^blob:/.test(src)) { auUrl = src; auOwn = true; }
    var nm = el("frAuName");
    if (nm) nm.textContent = "♪ " + String(label || "AUDIO").toUpperCase().slice(0, 60);
    rack.hidden = false;
    mediaShowing = true;
    try { a.load(); } catch (e) {}
    try { var p = a.play(); if (p && p.catch) p.catch(function () { paintAu(); }); } catch (e) {}
    var note = el("frNote");
    if (note) note.textContent = "PLAYING :: " + String(label || "AUDIO").toUpperCase().slice(0, 60) + (own ? " - THIS DEVICE ONLY, NOTHING KEPT." : " - STREAMED, NOTHING KEPT.");
    track({ kind: "audio", label: label || src, src: src });
    paintAu();
  }
  function stopAudio() {
    var a = auEl();
    if (a) { try { a.pause(); } catch (e) {} a.removeAttribute("src"); try { a.load(); } catch (e) {} }
    if (auUrl && auOwn) { try { URL.revokeObjectURL(auUrl); } catch (e) {} }
    auUrl = ""; auOwn = false;
    var rack = el("frAudio");
    if (rack) rack.hidden = true;
    var nm = el("frAuName");
    if (nm) nm.textContent = "♪ NOTHING LOADED";
    paintAu();
  }
  function hushVideo() {
    var v = el("frMedia");
    if (v) { try { v.pause(); } catch (e) {} v.hidden = true; v.removeAttribute("src"); try { v.load(); } catch (e) {} }
  }
  function playFile(file) {
    if (!file) return;
    if (!/^(video|audio)\//.test(file.type || "")) { say("NOT MEDIA - VIDEO AND AUDIO FILES PLAY HERE."); return; }
    var url = "";
    try { url = URL.createObjectURL(file); }
    catch (e) { say("THE FILE WOULD NOT PLAY."); return; }
    if (/^audio\//.test(file.type || "")) showAudio(url, String(file.name || "FILE"), true);
    else { showMedia(url, true); track({ kind: "video", label: String(file.name || "FILE"), src: url }); }
    var note = el("frNote");
    if (note) note.textContent = "PLAYING :: " + String(file.name || "FILE").toUpperCase().slice(0, 60) + " - THIS DEVICE ONLY, NOTHING KEPT.";
  }

  // THE VAULT'S CLIPS. A clip tile in the gallery (the library's CLIPS tab) sends
  // its vault id here: the record's own blob is opened as a FRESH object URL that
  // belongs to the frame, so closing revokes only that - the vault's cached URL is
  // never touched and the gallery keeps playing. Same rule as device files: this
  // browser only, never uploaded, never kept. Sound stays out - music and voices
  // ride the audition bus, the terminal's one transport.
  function playVault(id) {
    var rec = null;
    try { rec = window.media ? window.media.get(id) : null; } catch (e) { rec = null; }
    if (!rec || !rec.blob) { say("THAT CLIP IS NOT IN THE VAULT ANY MORE."); return; }
    if (rec.kind !== "video" && !/^video\//.test(String(rec.mime || ""))) { say("NOT A CLIP - ONLY THE VAULT'S VIDEO PLAYS IN THE FRAME. SOUND RIDES THE AUDITION BUS."); return; }
    var url = "";
    try { url = URL.createObjectURL(rec.blob); }
    catch (e) { say("THE CLIP WOULD NOT PLAY."); return; }
    open();
    showMedia(url, true);
    track({ kind: "video", label: String(rec.name || "CLIP"), vaultId: id });
    var note = el("frNote");
    if (note) note.textContent = "PLAYING :: " + String(rec.name || "CLIP").toUpperCase().slice(0, 60) + " - FROM THE VAULT, THIS BROWSER ONLY.";
  }

  async function play(spec) {
    var s = frameableLink(String(spec == null ? "" : spec).trim());
    if (isAudioLink(s)) {
      if (!/^https?:\/\//i.test(s)) { say("THE FRAME STAYS DARK - ONLY HTTP AND HTTPS LINKS PLAY HERE."); return; }
      var host = s.replace(/^https?:\/\//i, "").split("/")[0];
      var tail = s.split("/").pop().split("?")[0].split("#")[0];
      showAudio(s, host + " / " + tail, false);
      return;
    }
    if (isVideoLink(s)) {
      if (!/^https?:\/\//i.test(s)) { say("THE FRAME STAYS DARK - ONLY HTTP AND HTTPS LINKS PLAY HERE."); return; }
      showMedia(s, false);
      var note = el("frNote");
      if (note) note.textContent = "PLAYING MEDIA :: " + s.toUpperCase().slice(0, 80);
      return;
    }
    var c = await ready();
    if (!c) { say("THE FRAME IS OFFLINE IN THIS BUILD (THE FRAME CHIP IS NOT LOADED)."); return; }
    var r = await c.open(s);
    if (r.ok) { show(r.src); paint(true); }
  }

  async function paint(keep) {
    var box = el("frChips");
    var note = el("frNote");
    var c = await ready();
    if (!c) {
      if (note) note.textContent = "THE FRAME IS OFFLINE IN THIS BUILD.";
      return;
    }
    if (!keep && !mediaShowing) show(c.current());
    if (note && !keep && !mediaShowing) note.textContent = c.current() ? "NOW SHOWING :: " + c.current().toUpperCase().slice(0, 80) : c.count() + " APP" + (c.count() === 1 ? "" : "S") + " PINNED - PRESS ONE OR PASTE A LINK.";
    if (!box || built) return;
    built = true;
    var list = c.list();
    for (var i = 0; i < list.length; i++) {
      (function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = a.title;
        b.title = a.url;
        b.addEventListener("click", function () { play(a.id); });
        box.appendChild(b);
      })(list[i]);
  }
  }

  async function pin() {
    var inp = el("frUrl");
    var url = inp ? inp.value : "";
    if (!url.trim()) { say("NOTHING PINNED - PASTE A LINK FIRST."); return; }
    var c = await ready();
    if (!c) return;
    var title = url.trim().replace(/^https?:\/\//i, "").split("/")[0].toUpperCase().slice(0, 40) || "APP";
    var r = await c.pin({ id: title, title: title, url: url });
    if (r.ok) {
      built = false;
      var box = el("frChips");
      if (box) box.innerHTML = "";
      paint(true);
      if (inp) inp.value = "";
    }
  }

  // FULLSCREEN. The panel lives inside the lower deck, so a closed lower deck takes it
  // down with it. Open lifts the panel out of the deck onto the body and stands all four
  // decks down; close puts the panel back - and the decks STICK where they are, down or
  // up, whatever his hand does next decides (/deck brings them back).
  function fullOn() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("frameFull")); }
    catch (e) { return false; }
  }

  function bindFullKey(on) {
    if (on && !fullKeyHandler) {
      fullKeyHandler = function (e) {
        if (e.key !== "Escape" && e.keyCode !== 27) return;
        close();
        say("FRAME :: CLOSED - THE DECKS STICK WHERE THEY ARE.");
      };
      document.addEventListener("keydown", fullKeyHandler, true);
    } else if (!on && fullKeyHandler) {
      document.removeEventListener("keydown", fullKeyHandler, true);
      fullKeyHandler = null;
    }
  }

  function setFull(on) {
    on = !!on;
    var p = el("framePanel");
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!homeParent) { homeParent = p.parentNode; homeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (window.decks) {
        var names = ["upper", "lower", "left", "right"];
        for (var i = 0; i < names.length; i++) {
          try { window.decks.hide(names[i]); } catch (e) {}
        }
      }
    } else {
      if (p && homeParent) {
        try { homeParent.insertBefore(p, homeNext); } catch (e) {}
        homeParent = null;
        homeNext = null;
      }
    }
    try { document.body.classList.toggle("frameFull", on); } catch (e) {}
    bindFullKey(on);
    return on;
  }

  // THE BOARD EDITOR. One row per pinned tab: name, link, SAVE, and a ✕ that unpins.
  // SAVE writes the name through rename and the link through retarget, then repaints
  // the tab buttons so the board and the panel say the same thing.
  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function openEdit() {
    var m = el("frEditModal");
    var box = el("frEditList");
    var c = await ready();
    if (!m || !box || !c) return;
    var list = c.list();
    var h = "";
    for (var i = 0; i < list.length; i++) {
      h += "<div class='frAppRow' data-id='" + esc(list[i].id) + "'>"
        + "<button type='button' data-act='up' title='move this tab up'>&#9650;</button>"
        + "<button type='button' data-act='down' title='move this tab down'>&#9660;</button>"
        + "<input type='text' data-f='title' value='" + esc(list[i].title) + "' maxlength='60' title='tab name'>"
        + "<input type='text' data-f='url' value='" + esc(list[i].url) + "' maxlength='2000' title='tab link'>"
        + "<button type='button' data-act='save'>SAVE</button>"
        + "<button type='button' data-act='drop' title='unpin this tab'>&#10005;</button>"
        + "</div>";
    }
    h += "<div class='frAppRow' data-id=''>"
      + "<input type='text' data-f='title' value='' maxlength='60' placeholder='NEW TAB NAME' title='new tab name'>"
      + "<input type='text' data-f='url' value='' maxlength='2000' placeholder='https://...' title='new tab link'>"
      + "<button type='button' data-act='add'>ADD</button>"
      + "</div>";
    box.innerHTML = h;
    m.hidden = false;
    var rows = box.querySelectorAll(".frAppRow");
    for (var r = 0; r < rows.length; r++) {
      (function (row) {
        var id = row.getAttribute("data-id");
        var saveB = row.querySelector("button[data-act='save']");
        var dropB = row.querySelector("button[data-act='drop']");
        var addB = row.querySelector("button[data-act='add']");
        var upB = row.querySelector("button[data-act='up']");
        var downB = row.querySelector("button[data-act='down']");
        if (saveB) saveB.addEventListener("click", function () { saveRow(id, row); });
        if (dropB) dropB.addEventListener("click", function () { dropRow(id); });
        if (addB) addB.addEventListener("click", function () { addRow(row); });
        if (upB) upB.addEventListener("click", function () { moveRow(id, -1); });
        if (downB) downB.addEventListener("click", function () { moveRow(id, 1); });
        row.querySelectorAll("input").forEach(function (inp) {
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); if (addB) addRow(row); else saveRow(id, row); }
          });
        });
      })(rows[r]);
    }
  }

  function closeEdit() { var m = el("frEditModal"); if (m) m.hidden = true; }

  async function saveRow(id, row) {
    var c = await ready();
    if (!c) return;
    var note = el("frEditNote");
    var title = row.querySelector("input[data-f='title']").value;
    var url = row.querySelector("input[data-f='url']").value;
    var r1 = await c.rename(id, title);
    if (!r1.ok) { if (note) note.textContent = r1.error; return; }
    var r2 = await c.retarget(id, url);
    if (!r2.ok) { if (note) note.textContent = r2.error; }
    else if (note) note.textContent = "SAVED :: " + r2.app.title.toUpperCase() + ".";
    built = false;
    var box = el("frChips");
    if (box) box.innerHTML = "";
    paint(true);
  }

  async function dropRow(id) {
    var c = await ready();
    if (!c) return;
    var r = await c.unpin(id);
    if (r.ok) {
      built = false;
      var box = el("frChips");
      if (box) box.innerHTML = "";
      paint(true);
      openEdit();
    }
  }
  async function addRow(row) {
    var c = await ready();
    if (!c) return;
    var note = el("frEditNote");
    var title = row.querySelector("input[data-f='title']").value;
    var url = row.querySelector("input[data-f='url']").value;
    if (!String(title).trim() || !String(url).trim()) { if (note) note.textContent = "NAME IT AND LINK IT FIRST."; return; }
    var r = await c.pin({ id: title, title: title, url: url });
    if (!r.ok) { if (note) note.textContent = r.error; return; }
    if (note) note.textContent = "PINNED :: " + r.app.title.toUpperCase() + ".";
    built = false;
    var box = el("frChips");
    if (box) box.innerHTML = "";
    paint(true);
    openEdit();
  }
  async function moveRow(id, dir) {
    var c = await ready();
    if (!c || typeof c.move !== "function") return;
    var r = await c.move(id, dir);
    if (!r.ok) return;
    built = false;
    var box = el("frChips");
    if (box) box.innerHTML = "";
    paint(true);
    openEdit();
  }
  function isOpen() { var p = el("framePanel"); return !!(p && !p.hidden); }
  // THE GALLERY DOORS. The dropdown lists the vault's video clips, so a video is picked
  // without leaving the player; TANDEM opens the gallery itself on the CLIPS tab, so the
  // two of you pick together and it plays here. Both end in playVault - vault id in,
  // fresh frame-owned url out, the gallery's own urls never touched.
  function clipRecords() {
    var out = [];
    try {
      if (!window.media || !window.media.list) return out;
      var ids = window.media.list() || [];
      for (var i = 0; i < ids.length; i++) {
        var r = null;
        try { r = window.media.get(ids[i]); } catch (e) { r = null; }
        if (!r || !r.blob) continue;
        if (r.kind === "video" || /^video\//.test(String(r.mime || ""))) out.push(r);
      }
    } catch (e) {}
    return out;
  }
  function refreshGal() {
    var sel = el("frGalSel");
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "SELECT VIDEO FROM GALLERY";
    sel.appendChild(ph);
    var clips = clipRecords();
    for (var i = 0; i < clips.length; i++) {
      (function (r) {
        var o = document.createElement("option");
        o.value = r.id;
        o.textContent = String(r.name || "CLIP").toUpperCase().slice(0, 40);
        sel.appendChild(o);
      })(clips[i]);
    }
    try { sel.value = keep; } catch (e) { sel.value = ""; }
  }
  function tandem() {
    try {
      if (window.gallery) {
        if (window.gallery.setFilter) window.gallery.setFilter("clip");
        if (window.gallery.isOpen && !window.gallery.isOpen()) window.gallery.open();
        else if (window.gallery.toggle && !(window.gallery.isOpen && window.gallery.isOpen())) window.gallery.toggle();
      } else say("THE GALLERY IS OFFLINE IN THIS BUILD.");
    } catch (e) { say("THE GALLERY WOULD NOT OPEN."); }
  }

  // THE CENTER. The CENTER button puts the player right in the CENTER - it takes
  // the MAIN STAGE slot between the side panels while the upper and lower decks
  // stay exactly as they were. Same board, same EDIT CRUD, just parked center.
  // CLOSE (or the FRAME button) gives the panel home and the stage back.
  var centerParent = null;
  var centerNext = null;

  function isCenter() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("frameCenter")); }
    catch (e) { return false; }
  }
  function setCenter(on) {
    on = !!on;
    var p = el("framePanel");
    var row = el("stageRow");
    var out = el("output");
    if (on) {
      setFull(false);
      if (p && row) {
        if (!centerParent) { centerParent = p.parentNode; centerNext = p.nextSibling; }
        try { row.insertBefore(p, el("rightPanel") || null); } catch (e) {}
      }
      if (out) out.hidden = true;
    } else {
      if (p && centerParent) {
        try { centerParent.insertBefore(p, centerNext); } catch (e) {}
        centerParent = null;
        centerNext = null;
      }
      if (out) out.hidden = false;
    }
    try { document.body.classList.toggle("frameCenter", on); } catch (e) {}
    return on;
  }
  function openCenter() {
    var p = el("framePanel");
    if (!p) return;
    setCenter(true);
    p.hidden = false;
    paint();
    paintFavs();
    refreshGal();
  }
  function toggleCenter() { if (isCenter()) close(); else openCenter(); }

  function open() { setCenter(false); var p = el("framePanel"); if (!p) return; p.hidden = false; setFull(true); paint(); paintFavs(); refreshGal(); }
  function close() {
    track(null);
    if (mediaUrl && mediaOwn) { try { URL.revokeObjectURL(mediaUrl); } catch (e) {} mediaUrl = ""; mediaOwn = false; }
    mediaShowing = false;
    stopAudio();
    hushVideo();
    setFull(false);
    setCenter(false);
    var p = el("framePanel");
    if (p) p.hidden = true;
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function wire() {
    var b = el("frameBtn");
    if (b) b.addEventListener("click", function () { toggle(); });
    var cb = el("centerBtn");
    if (cb) cb.addEventListener("click", function () { toggleCenter(); });
    var p = el("frPlay");
    if (p) p.addEventListener("click", function () { var inp = el("frUrl"); play(inp ? inp.value : ""); });
    var n = el("frPin");
    if (n) n.addEventListener("click", function () { pin(); });
    var g = el("frEdit");
    if (g) g.addEventListener("click", function () { openEdit(); });
    var gd = el("frEditClose");
    if (gd) gd.addEventListener("click", function () { closeEdit(); });
    var mb = el("frMediaBtn");
    if (mb) mb.addEventListener("click", function () { var mi = el("frMediaInput"); if (mi) mi.click(); });
    var fb = el("frFavBtn");
    if (fb) fb.addEventListener("click", function () { toggleFav(); });
    var gs = el("frGalSel");
    if (gs) {
      gs.addEventListener("focus", function () { refreshGal(); });
      gs.addEventListener("change", function () {
        if (gs.value) { playVault(gs.value); gs.value = ""; }
      });
    }
    var td = el("frTandem");
    if (td) td.addEventListener("click", function () { tandem(); });
    var mi2 = el("frMediaInput");
    if (mi2) mi2.addEventListener("change", function () {
      if (mi2.files && mi2.files[0]) playFile(mi2.files[0]);
      mi2.value = "";
    });
    if (!auWired) {
      auWired = true;
      var ap = el("frAuPlay");
      if (ap) ap.addEventListener("click", function () {
        var a = auEl(); if (!a || !a.getAttribute("src")) return;
        if (a.paused || a.ended) { quietBus(); try { var pr = a.play(); if (pr && pr.catch) pr.catch(function () { paintAu(); }); } catch (e) {} }
        else { try { a.pause(); } catch (e) {} }
      });
      var ab = el("frAuBack");
      if (ab) ab.addEventListener("click", function () { var a = auEl(); if (a) { try { a.currentTime = 0; } catch (e) {} } });
      var sk = el("frAuSeek");
      if (sk) {
        sk.addEventListener("pointerdown", function () { auDrag = true; });
        sk.addEventListener("pointerup", function () { auDrag = false; });
        sk.addEventListener("change", function () {
          auDrag = false;
          var a = auEl(); if (!a) return;
          var d = Number(a.duration) || 0;
          if (d > 0) { try { a.currentTime = Number(sk.value) / 1000 * d; } catch (e) {} }
          paintAu();
        });
      }
      var vl = el("frAuVol");
      if (vl) vl.addEventListener("input", function () { var a = auEl(); if (a) { try { a.volume = Number(vl.value) / 100; } catch (e) {} } });
      var ax = el("frAuClose");
      if (ax) ax.addEventListener("click", function () { stopAudio(); });
      var ae = auEl();
      if (ae) {
        ["timeupdate", "play", "pause", "ended", "loadedmetadata"].forEach(function (ev) {
          ae.addEventListener(ev, function () { paintAu(); });
        });
      }
    }
    var x = el("frClose");
    if (x) x.addEventListener("click", function () { close(); });
    var inp2 = el("frUrl");
    if (inp2) inp2.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); play(inp2.value); }
    });
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, play: play, playVault: playVault, openCenter: openCenter, toggleCenter: toggleCenter, isCenter: isCenter };
})();
