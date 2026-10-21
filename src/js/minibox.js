  /* ==========================================================================
     THE MINI LIGHTBOX (src/js/minibox.js)

     WHAT IT IS FOR. The long work in this terminal happens BEHIND THE CURTAIN -
     a sweep making 1,144 pictures 2x, a duplicate hunt hashing the vault, a
     folders pass, the upscaler retiring a render - and the conversation carries
     on while it runs, which is the whole point. The receipts go into the log as
     SYSTEM lines, and a receipt NAMES what it touched ("UPSCALE DONE ::
     forge-1-x2-1536x1024.png :: ..."), but a name is not the thing: to see
     WHICH picture is in hand right now he had to open the gallery and find it.
     Patrikios, 2026-09-23: "I might know the citation of what we is examining
     or working on at present. Perhaps we need a way for me to see what it is
     with a little clickable thumbnail that triggers a modal. Like a mini
     'Light Box'. We can also use that lightbox elsewhere so I can browse the
     Gallery."

     So there are two halves, and they are one feature:

       window.inHand   THE STRIP. A chip in the deck's control row that says
                       what the machinery has in its hand RIGHT NOW - a
                       thumbnail, the citation (name and vault id) and what is
                       being done to it ("UPSCALING 372 / 1144"). It appears
                       when the work starts and takes itself down a few seconds
                       after the work stops renewing it, so no caller has to
                       keep book on it: `inHand.show(id, note)` and go on
                       working. It is deliberately the DECK's, not the log's -
                       the log is the conversation, and this is the machinery.

       window.miniBox  THE MODAL the strip opens. The picture, its citation,
                       and the ones before and after it, with a way UP to the
                       FULL STAGE (openLightbox) when he wants the whole record -
                       SAVE, UPSCALE, folders, tags, the prompt file. It is
                       reusable anywhere, and the gallery's cards carry a `\u25a3`
                       that opens it on the gallery's own visible list, so the
                       arrows walk exactly what he is looking at.

     WHAT IT IS NOT. Not a second stage and not a decision: nothing here writes
     to the vault, nothing is deleted, and nothing is queued for her eyes. It is
     a LOOK - the same way `fillTile` is a look. A picture that was retired into
     a bigger one while the box was open is followed to the record that exists
     (the same successor rule `fillTile` and `openLightbox` use), and the one
     caller that retires anything tells both halves (`follow`).
     ========================================================================== */
(function () {
  "use strict";

  var LEASE_MS = 20000;      // how long the strip stays up after its last show()

  var shown = null;          // the id the box is showing
  var list = [];             // the ids it was opened with (0 or 1 = no arrows)
  var note = "";             // what is being done to it, in the box's header
  var title = "PEEK";        // the box's own name for the errand ("UPSCALE SWEEP")
  var built = false;         // the DOM listeners are attached once

  var leased = null;         // what the machinery has in hand: { id, note, label, list, at, until }
  var leaseTimer = null;

  function el(id) { return document.getElementById(id); }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  function rec(id) {
    var M = window.media;
    return (M && M.get && id) ? M.get(id) : null;
  }

  // THE SUCCESSOR RULE, the same one fillTile and openLightbox use: the local
  // upscale retires the smaller render it came from, and a caller can be a few
  // milliseconds behind that - so a picture that is gone but has a replacement
  // is followed to the record that exists rather than shown as a hole. It is
  // also what makes the strip safe to leave up while a sweep retires the very
  // picture it is showing.
  function live(id) {
    if (!id) return id;
    var M = window.media;
    if (!M || !M.get) return id;
    if (M.get(id)) return id;
    if (M.replacementFor) {
      var heir = M.replacementFor(id);
      if (heir && M.get(heir)) return heir;
    }
    return id;
  }

  function labelOf(id) {
    var M = window.media, r = rec(id);
    if (!r) return String(id);
    var name = (M.recordLabel ? M.recordLabel(r) : (r.name || r.prompt)) || id;
    return String(name).replace(/\s+/g, " ").trim() || String(id);
  }

  function short(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  // The citation, as a receipt writes it: what it is called, then the id he can
  // type back into /show, /renders or /gallery find.
  function citeLine(id) {
    return short(labelOf(id), 40) + "  [" + String(id) + "]";
  }

  // ---- what the record IS, in one line -------------------------------------
  function metaLine(id) {
    var r = rec(id), M = window.media;
    if (!r) return "NOT IN THIS VAULT ANY MORE";
    var bits = [];
    if (r.kind) bits.push(String(r.kind).toUpperCase());
    if (r.w && r.h) bits.push(r.w + "\u00d7" + r.h);
    if (r.bytes) bits.push(fmtBytes(r.bytes));
    try { if (M && M.folderOf) bits.push(M.folderOf(r)); } catch (e) {}
    if (r.how === "upscale-local") bits.push("UPSCALED HERE");
    else if (r.how === "upscale") bits.push("UPSCALED");
    if (r.replaced) bits.push("REPLACED " + String(r.replaced));
    return bits.join("   \u00b7   ");
  }

  /* ==========================================================================
     THE BOX
     ========================================================================== */

  function isOpen() {
    var box = el("miniBox");
    return !!box && !box.hidden;
  }

  function paint() {
    if (!isOpen()) return;
    var id = live(shown);
    var r = rec(id);

    var t = el("mbTitle"), nEl = el("mbNote"), c = el("mbCount");
    if (t) t.textContent = title || "PEEK";
    if (nEl) nEl.textContent = note || "";
    var ix = list.indexOf(id);
    if (c) c.textContent = (list.length > 1 && ix >= 0) ? ((ix + 1) + " / " + list.length) : "";

    var box = el("mbBox");
    if (box) {
      box.textContent = "";
      var url = "";
      try { url = (window.media && window.media.url) ? (window.media.url(id) || "") : ""; } catch (e) { url = ""; }
      var mime = String((r && r.mime) || "");
      var isVid = !!(r && (/^video\//.test(mime) || r.kind === "video"));
      var isAud = !!(r && /^audio\//.test(mime));
      if (!r || !url) {
        var f = document.createElement("div");
        f.className = "mbFail";
        f.textContent = "THAT PICTURE IS NOT IN THIS VAULT ANY MORE (the record is gone; nothing here can show it).";
        box.appendChild(f);
      } else if (isVid) {
        var v = document.createElement("video");
        v.controls = true; v.playsInline = true; v.preload = "metadata";
        v.setAttribute("playsinline", "");
        try {
          if (r.poster && rec(r.poster)) v.poster = window.media.url(r.poster) || "";
        } catch (e) {}
        v.src = url;
        box.appendChild(v);
      } else if (isAud) {
        var a = document.createElement("audio");
        a.controls = true;
        a.src = url;
        box.appendChild(a);
      } else {
        var img = document.createElement("img");
        img.alt = (r.prompt || r.name || "picture");
        if (r.w) img.width = r.w;
        if (r.h) img.height = r.h;
        img.src = url;
        box.appendChild(img);
      }
    }

    var cite = el("mbCite");
    if (cite) {
      cite.textContent = "";
      var nm = document.createElement("span");
      nm.className = "mbName";
      nm.textContent = labelOf(id);
      var mt = document.createElement("span");
      mt.className = "mbMeta";
      // The name is already above this line, so the citation here is the ID and the facts - which is
      // the other half of what a receipt names ("... [mmud9esy4nuved]"), and the half he can type
      // back into /show, /renders or /gallery find.
      mt.textContent = "[" + String(id) + "]\n" + metaLine(id);
      cite.appendChild(nm);
      cite.appendChild(mt);
      var pr = r && (r.prompt || r.sent);
      if (pr) {
        var pl = document.createElement("span");
        pl.className = "mbPrompt";
        pl.textContent = String(pr);
        pl.title = String(pr);
        cite.appendChild(pl);
      }
    }

    var prev = el("mbPrev"), next = el("mbNext");
    var arrows = list.length > 1;
    if (prev) prev.hidden = !arrows;
    if (next) next.hidden = !arrows;
  }

  function open(id, opts) {
    opts = opts || {};
    var want = live(id);
    var box = el("miniBox");
    if (!box || !want) return false;
    shown = want;
    list = (opts.list && opts.list.length) ? opts.list.slice() : [];
    // A list that does not hold the thing being shown is not this thing's list:
    // arrows that would step away from what he pressed are worse than no arrows.
    if (list.length && list.indexOf(shown) === -1) list = [];
    note = String(opts.note == null ? "" : opts.note);
    title = String(opts.title || "PEEK");
    wire();
    box.hidden = false;
    paint();
    return true;
  }

  function close() {
    var box = el("miniBox");
    var b = el("mbBox");
    if (b) b.textContent = "";                 // let go of the blob URL's element
    if (box) box.hidden = true;
    shown = null; list = []; note = "";
  }

  function step(d) {
    if (!isOpen() || list.length < 2) return false;
    var ix = list.indexOf(live(shown));
    if (ix < 0) ix = 0;
    var nx = ix + d;
    if (nx < 0) nx = list.length - 1;
    if (nx >= list.length) nx = 0;
    shown = live(list[nx]);
    // The note belongs to the errand that opened the box, not to the picture he
    // has walked to - so walking keeps it; only a close clears it.
    paint();
    return true;
  }

  // The picture the box is showing was retired into a bigger one (the local
  // upscale). Follow it, exactly as the tiles in the log do.
  function follow(oldId, newId) {
    if (!oldId || !newId) return false;
    var hit = false;
    for (var i = 0; i < list.length; i++) if (list[i] === oldId) { list[i] = newId; hit = true; }
    if (shown === oldId) {
      shown = newId;
      hit = true;
      if (isOpen()) paint();
    }
    return hit;
  }

  /* ==========================================================================
     THE IN-HAND STRIP
     ========================================================================== */

  function current() {
    if (!leased) return null;
    return { id: leased.id, note: leased.note, label: leased.label, list: leased.list.slice(), at: leased.at };
  }

  function isActive() { return !!leased; }

  // SHOW WHAT IS IN HAND. Called by whoever is working, as often as it likes -
  // once per picture is the natural rhythm. The strip is leased, not owned: the
  // last call sets the item and pushes the expiry out, and when the work stops
  // calling, the strip takes itself down. So a caller never has to remember to
  // end anything, and a job that dies on an exception cannot leave a stale
  // thumbnail on the deck.
  function show(id, text, opts) {
    opts = opts || {};
    var want = live(id);
    if (!want) return false;
    leased = {
      id: want,
      note: String(text == null ? "" : text),
      label: String(opts.label || (leased && leased.label) || "IN HAND"),
      list: (opts.list && opts.list.length) ? opts.list.slice() : ((leased && leased.list) || []),
      at: Date.now(),
      until: Date.now() + LEASE_MS
    };
    if (leaseTimer) { window.clearTimeout(leaseTimer); leaseTimer = null; }
    leaseTimer = window.setTimeout(function () {
      leaseTimer = null;
      if (leased && Date.now() >= leased.until) { leased = null; paintStrip(); }
    }, LEASE_MS + 60);
    wire();
    paintStrip();
    return true;
  }

  function hide() {
    if (leaseTimer) { window.clearTimeout(leaseTimer); leaseTimer = null; }
    leased = null;
    paintStrip();
  }

  function followHand(oldId, newId) {
    if (!leased || !oldId || !newId) return false;
    if (leased.id !== oldId) return false;
    leased.id = newId;
    paintStrip();
    return true;
  }

  function paintStrip() {
    var chip = el("inHand");
    if (!chip) return;
    if (!leased) { chip.hidden = true; return; }
    var id = live(leased.id);
    var r = rec(id);
    var thumb = el("inHandThumb"), glyph = el("inHandGlyph");
    var src = "", mark = "\u25a3";
    try {
      var mime = String((r && r.mime) || "");
      if (r && /^image\//.test(mime)) src = window.media.url(id) || "";
      else if (r && (/^video\//.test(mime) || r.kind === "video") && r.poster && rec(r.poster)) src = window.media.url(r.poster) || "";
      else if (r && /^audio\//.test(mime)) mark = "\u266a";
      else if (!r) mark = "\u2715";
    } catch (e) { src = ""; }
    if (thumb) {
      if (src) { if (thumb.getAttribute("src") !== src) thumb.src = src; thumb.hidden = false; }
      else { thumb.removeAttribute("src"); thumb.hidden = true; }
    }
    if (glyph) {
      if (src) glyph.hidden = true;
      else { glyph.textContent = mark; glyph.hidden = false; }
    }
    var nEl = el("inHandNote"), cEl = el("inHandCite");
    if (nEl) nEl.textContent = short(leased.note || leased.label || "WORKING", 60);
    if (cEl) cEl.textContent = citeLine(id);
    chip.hidden = false;
    chip.title = (leased.label ? leased.label + " :: " : "")
      + (leased.note ? leased.note + "\n" : "")
      + labelOf(id) + "  [" + String(id) + "]\n"
      + "PRESS IT FOR A QUICK LOOK - a mini lightbox with the ones before and after, and a way up to the full stage. The conversation carries on while this works.";
  }

  /* ==========================================================================
     THE WIRING (once, cheap, and never in the way of the input box)
     ========================================================================== */

  function openInHand() {
    if (!leased) return false;
    return open(leased.id, { list: leased.list, note: leased.note || leased.label, title: leased.label || "IN HAND" });
  }

  function onKey(e) {
    if (!isOpen()) return;
    var t = e.target || {};
    var tag = String(t.tagName || "").toLowerCase();
    // The box never steals a key from the input box or a text box: while he is
    // typing, Esc and the arrows are his.
    if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
  }

  function wire() {
    if (built) return;
    built = true;

    var chip = el("inHand");
    if (chip) chip.addEventListener("click", function (e) { e.preventDefault(); openInHand(); });

    var box = el("miniBox");
    if (box) {
      box.addEventListener("click", function (e) { if (e.target === box) close(); });
      var c1 = el("mbClose"), c2 = el("mbCloseBtn");
      if (c1) c1.addEventListener("click", close);
      if (c2) c2.addEventListener("click", close);
      var p = el("mbPrev"), n = el("mbNext");
      if (p) p.addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
      if (n) n.addEventListener("click", function (e) { e.stopPropagation(); step(1); });
      var full = el("mbFull");
      if (full) full.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = live(shown), l = list.slice();
        close();
        try { if (typeof openLightbox === "function") openLightbox(id, l.length > 1 ? { list: l } : undefined); } catch (err) {}
      });
    }

    var thumb = el("inHandThumb");
    if (thumb) thumb.addEventListener("error", function () {
      if (!leased) return;
      var heir = live(leased.id);
      if (heir !== leased.id) { leased.id = heir; paintStrip(); }
    });

    document.addEventListener("keydown", onKey);
  }

  window.miniBox = {
    open: open,
    close: close,
    isOpen: isOpen,
    id: function () { return shown; },
    list: function () { return list.slice(); },
    note: function () { return note; },
    step: step,
    follow: follow,
    paint: paint
  };

  window.inHand = {
    show: show,
    hide: hide,
    isActive: isActive,
    current: current,
    follow: followHand,
    paint: paintStrip
  };

  wire();
})();
