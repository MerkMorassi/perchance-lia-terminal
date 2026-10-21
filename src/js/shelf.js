window.shelf = (function () {
  "use strict";

  var FALLBACK = [
    "src/chips/sia-staging-chip/mythos-staging-standalone.js",
    "src/chips/sia-cutout-chip/mythos-cutout-standalone.js",
    "src/chips/sia-keyring-mirror-chip/mythos-keyring-standalone.js",
    "src/chips/sia-wishlist-chip/mythos-wishlist-standalone.js",
    "src/chips/sia-minutes-chip/mythos-minutes-standalone.js",
    "src/chips/sia-chattail-chip/mythos-chattail-standalone.js",
    "src/chips/sia-breakdown-chip/breakdown-standalone.js",
    "src/chips/sia-chipshelf-chip/mythos-chipshelf-standalone.js"
  ];

  var urls = null;
  var entries = null;
  var buyer = null;
  var built = false;

  function el(id) { return document.getElementById(id); }

  // THE REGISTRY, NOT JUST URLS. chips.json names every file a chip ships, so the shelf
  // knows the README beside the source: an exact README.md first (CHIP SPEC v1's name
  // for it), else the chip's own doc file (.md/.txt) as a flagged stand-in, else nothing.
  function splitFiles(chip) {
    var files = (chip && chip.files) || [];
    var js = [], readme = null, doc = null;
    for (var i = 0; i < files.length; i++) {
      var f = String(files[i] || "");
      if (/\.js$/i.test(f)) js.push("src/chips/" + chip.name + "/" + f);
      else if (/^readme\.md$/i.test(f.split("/").pop())) { if (!readme) readme = "src/chips/" + chip.name + "/" + f; }
    }
    if (!readme) {
      for (var j = 0; j < files.length; j++) {
        var g = String(files[j] || "");
        if (/\.(md|txt)$/i.test(g)) { doc = "src/chips/" + chip.name + "/" + g; break; }
      }
    }
    return { name: chip.name, js: js, readme: readme, doc: readme || doc };
  }

  function fallbackEntries() {
    return FALLBACK.map(function (u) {
      var b = String(u).split("/").pop() || u;
      return { name: b.replace(/\.js$/, ""), js: [u], readme: null, doc: null };
    });
  }

  async function loadUrls() {
    if (urls) return urls;
    try {
      var reg = await fetch("src/chips/chips.json", { cache: "no-store" }).then(function (r) { return r.json(); });
      var out = [], ents = [];
      var chips = (reg && reg.chips) || [];
      for (var i = 0; i < chips.length; i++) {
        var e = splitFiles(chips[i]);
        if (!e.js.length) continue;
        ents.push(e);
        for (var j = 0; j < e.js.length; j++) out.push(e.js[j]);
      }
      urls = out.length ? out : FALLBACK.slice();
      entries = ents.length ? ents : fallbackEntries();
    } catch (e) { urls = FALLBACK.slice(); entries = fallbackEntries(); }
    return urls;
  }

  function entryFor(u) {
    if (!entries) return null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].js.indexOf(u) !== -1) return entries[i];
    }
    return null;
  }

  async function ready() {
    await loadUrls();
    if (buyer) return buyer;
    if (!window.MythosChipshelf || typeof window.MythosChipshelf.client !== "function") return null;
    try { buyer = window.MythosChipshelf.client({ chips: urls }); }
    catch (e) { return null; }
    return buyer;
  }

  function short(u) {
    var b = String(u).split("/").pop() || String(u);
    return b.replace(/\.js$/, "").replace(/^mythos-/, "").replace(/-standalone$/, "").toUpperCase() || "CHIP";
  }

  function esc(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // LIGHT MARKDOWN. READMEs follow CHIP SPEC v1 (title, origin, use, contract, left-out,
  // honesty) - headings, bullets and fences carry the shape, so they get it; the rest is
  // plain lines. No dependency, no script execution - text only.
  function readmeDoc(text) {
    var lines = String(text || "").slice(0, 12000).split("\n");
    var h = "", inCode = false, code = "";
    function flushCode() {
      if (code) { h += "<div class='shCode'>" + esc(code.replace(/\n$/, "")) + "</div>"; code = ""; }
    }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^```/.test(ln)) { if (inCode) { flushCode(); inCode = false; } else inCode = true; continue; }
      if (inCode) { code += ln + "\n"; continue; }
      if (/^#\s+/.test(ln)) h += "<div class='shH1'>" + esc(ln.replace(/^#\s+/, "")) + "</div>";
      else if (/^##+\s+/.test(ln)) h += "<div class='shH2'>" + esc(ln.replace(/^##+\s+/, "")) + "</div>";
      else if (/^\s*[-*]\s+/.test(ln)) h += "<div class='shLi'>" + esc(ln.replace(/^\s*[-*]\s+/, "")) + "</div>";
      else if (!ln.trim()) h += "<div>&nbsp;</div>";
      else h += "<div>" + esc(ln) + "</div>";
    }
    flushCode();
    return h || "<div>&nbsp;</div>";
  }

  async function readReadme(entry) {
    var box = el("shReadme");
    if (!box) return;
    if (!entry || !entry.doc) {
      box.innerHTML = "<div class='shWarn'>NO README - CHIP SPEC v1 REQUIRES A README.md, AND THIS CHIP SHIPS NONE. SOURCE BELOW IS ALL THERE IS.</div>";
      box.hidden = false;
      return;
    }
    try {
      var r = await fetch(entry.doc, { cache: "no-store" });
      if (!r || !r.ok) throw new Error("HTTP " + ((r && r.status) || "?"));
      var t = await r.text();
      var warn = entry.readme ? "" : "<div class='shWarn'>NO README.md - CHIP SPEC v1 REQUIRES ONE. SHOWING " + esc(String(entry.doc).split("/").pop().toUpperCase()) + " INSTEAD.</div>";
      box.innerHTML = warn + readmeDoc(t);
      box.hidden = false;
    } catch (e) {
      box.innerHTML = "<div class='shWarn'>THE README WOULD NOT READ :: " + esc(String((e && e.message) || e).slice(0, 80).toUpperCase()) + "</div>";
      box.hidden = false;
    }
  }

  async function build() {
    if (built) return;
    built = true;
    var box = el("shChips");
    var note = el("shNote");
    var c = await ready();
    if (!c) {
      if (note) note.textContent = "THE SHELF IS OFFLINE IN THIS BUILD (THE CHIPSHELF CHIP IS NOT LOADED).";
      return;
    }
    var withReadme = (entries || []).filter(function (e) { return !!e.readme; }).length;
    var total = (entries || []).length;
    if (note) note.textContent = c.count() + " VENDORED CHIP" + (c.count() === 1 ? "" : "S") + " ON THE SHELF - "
      + withReadme + " OF " + total + " SHIP README.md (! MARKS THE ONES THAT DO NOT) - PRESS ONE: README FIRST, SOURCE BELOW.";
    if (!box) return;
    var list = c.urls();
    for (var i = 0; i < list.length; i++) {
      (function (u) {
        var e = entryFor(u);
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = short(u) + ((e && !e.readme) ? " !" : "");
        b.title = u + (e ? (e.readme ? " :: README.md" : (e.doc ? " :: NO README.md (" + e.doc.split("/").pop() + " INSTEAD)" : " :: NO README")) : "");
        b.addEventListener("click", function () { read(u); });
        box.appendChild(b);
      })(list[i]);
    }
  }

  async function read(u) {
    var frame = el("shFrame");
    var note = el("shNote");
    var c = await ready();
    if (!c) {
      if (note) note.textContent = "THE SHELF IS OFFLINE IN THIS BUILD.";
      return;
    }
    if (note) note.textContent = "READING " + short(u) + " ...";
    await readReadme(entryFor(u));
    try {
      var r = await c.source(u);
      if (frame) frame.srcdoc = r.ok ? c.doc(r.text) : c.errDoc(r.error);
      if (note) note.textContent = r.ok ? short(u) + " :: " + r.text.length + " CHARS, READ-ONLY." : r.error;
    } catch (e) {
      if (frame && c) frame.srcdoc = c.errDoc("THE SHELF WOULD NOT READ IT.");
      if (note) note.textContent = "THE SHELF WOULD NOT READ IT.";
    }
  }

  function isOpen() { var p = el("shelfPanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("shelfPanel");
    if (!p) return;
    try { if (typeof closeForge === "function") { var cf = document.getElementById("createPanel"); if (cf && !cf.hidden) closeForge(); } } catch (e) {}
    try { if (window.instr && window.instr.close && (document.body.classList.contains("systemFull") || (window.instr.isOpen && window.instr.isOpen()))) window.instr.close(); } catch (e) {}
    try { if (window.moods && window.moods.panelClose && (document.body.classList.contains("moodFull") || (window.moods.panelIsOpen && window.moods.panelIsOpen()))) window.moods.panelClose(); } catch (e) {}
    try { if (window.moodpack && window.moodpack.close && (document.body.classList.contains("moodpackFull") || (window.moodpack.isOpen && window.moodpack.isOpen()))) window.moodpack.close(); } catch (e) {}
    setFull(true);
    p.hidden = false;
    build();
  }

  function close() { setFull(false); var p = el("shelfPanel"); if (p) p.hidden = true; }

  function toggle() { if (isOpen()) close(); else open(); }

  var shelfHomeParent = null, shelfHomeNext = null, shelfFullKey = null;

  function setFull(on) {
    on = !!on;
    var p = el("shelfPanel");
    if (on) {
      if (p && p.parentNode !== document.body) {
        if (!shelfHomeParent) { shelfHomeParent = p.parentNode; shelfHomeNext = p.nextSibling; }
        try { document.body.appendChild(p); } catch (e) {}
      }
      if (!shelfFullKey) {
        shelfFullKey = function (e) {
          if (e.key !== "Escape" && e.keyCode !== 27) return;
          try { close(); } catch (x) {}
        };
        document.addEventListener("keydown", shelfFullKey, true);
      }
    } else {
      if (p && shelfHomeParent) {
        try { shelfHomeParent.insertBefore(p, shelfHomeNext); } catch (e) {}
        shelfHomeParent = null;
        shelfHomeNext = null;
      }
      if (shelfFullKey) {
        try { document.removeEventListener("keydown", shelfFullKey, true); } catch (e) {}
        shelfFullKey = null;
      }
    }
    try { document.body.classList.toggle("shelfFull", on); } catch (e) {}
    return on;
  }

  function wire() {
    var b = el("shelfBtn");
    if (b) b.addEventListener("click", function () { toggle(); });
    var x = el("shClose");
    if (x) x.addEventListener("click", function () { close(); });
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, read: read };
})();
