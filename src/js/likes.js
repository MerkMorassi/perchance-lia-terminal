/* THE HEART - src/js/likes.js

   Patrikios, 2026-09-22: "We need a heart icon on the images that turns red when I tap in or
   click it so that she knows what is good and not good over time, training her. We track and
   mark the card like you do with the star favorite."

   So this is the STAR's twin (src/js/keepsake.js), with one difference that is the whole point:
   KEEP is about the prompt (a recipe that can be re-run), the HEART is about his TASTE - a mark
   on a picture, kept on the record, that she is told about every turn.

   THREE STATES, ONE CONTROL. Untouched is untasted: the heart is hollow. One press turns it RED
   (good); the next press turns it dull with a stroke through it (passed on); the next clears it.
   A tap that only ever meant "good" could not say "not good" at all, and a second control beside
   it would be two things to learn - so the one button cycles, and its tooltip says where it is.

   Nothing is uploaded, nothing is moved, no file is copied: the mark is one field on the record
   (`heart` = { v, at, by }) written with media.setField - the same door keepsake.js uses - so it
   rides with the picture the way its tags, its folder and her reading of it do.
*/
(function () {
  "use strict";

  var FIELD = "heart";
  var GOOD = "good";
  var PASS = "pass";
  var LIST_MAX = 6;        // how many of each she is told about in one turn (the block is bounded)

  function state(id) {
    var r = (window.media && window.media.get) ? window.media.get(id) : null;
    var h = r && r[FIELD];
    return (h && (h.v === GOOD || h.v === PASS)) ? h.v : "";
  }

  function counts() {
    var out = { good: 0, pass: 0, marked: 0, vault: 0 };
    if (!window.media) return out;
    window.media.list().forEach(function (id) {
      out.vault++;
      var s = state(id);
      if (s === GOOD) out.good++;
      else if (s === PASS) out.pass++;
    });
    out.marked = out.good + out.pass;
    return out;
  }

  // Newest first, which is the order he cares about: what he thought of the last thing he saw.
  function ids(v, limit) {
    var out = [];
    if (!window.media) return out;
    var all = window.media.list();
    for (var i = all.length - 1; i >= 0 && out.length < (limit || 1e9); i--) {
      if (state(all[i]) === v) out.push(all[i]);
    }
    return out;
  }

  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  function nameOf(rec, id) {
    if (!rec) return String(id || "");
    var s = rec.prompt || rec.name || "";
    if (!s) s = (rec.kind === "gen") ? "(an untitled render)" : "(no name)";
    return clip(s, 90);
  }

  function whereOf(rec) {
    var bits = [];
    if (rec) {
      var f = (window.media && window.media.folderOf) ? window.media.folderOf(rec) : "";
      if (f) bits.push(f);
      if (rec.tags && rec.tags.length) bits.push(rec.tags.slice(0, 4).map(function (t) { return "#" + t; }).join(" "));
    }
    return bits.join("  ");
  }

  /* ---- the act ------------------------------------------------------------ */
  async function mark(id, v, opts) {
    opts = opts || {};
    if (!window.media || !window.media.setField) return done({ ok: false, error: "THE VAULT IS NOT LOADED HERE." });
    await window.media.ensure();
    var rec = window.media.get(id);
    if (!rec) return done({ ok: false, error: "THERE IS NO RECORD WITH THAT ID IN THE VAULT." });
    var next = (v === GOOD || v === PASS) ? v : "";
    var before = state(id);
    if (before === next && !opts.force) return done({ ok: true, id: id, rec: rec, value: next, unchanged: true, quiet: opts.quiet });
    await window.media.setField(id, FIELD, next ? { v: next, at: Date.now(), by: "patrikios" } : null);
    if (window.gallery && window.gallery.isOpen && window.gallery.isOpen()) {
      try { await window.gallery.refresh(false); } catch (e) {}
    }
    if (opts.quiet) return { ok: true, id: id, rec: window.media.get(id) || rec, value: next };
    return done({ ok: true, id: id, rec: window.media.get(id) || rec, value: next, was: before });
  }

  function cycle(id, opts) {
    var s = state(id);
    return mark(id, s === "" ? GOOD : (s === GOOD ? PASS : ""), opts);
  }

  function setGood(id, opts) { return mark(id, state(id) === GOOD ? "" : GOOD, opts); }

  function done(res) {
    res = res || {};
    if (!res.ok) {
      print("SYSTEM", "HEART :: " + String(res.error || "THAT DID NOT WORK."));
      return res;
    }
    if (res.unchanged && !res.quiet) {
      print("SYSTEM", "HEART :: NOTHING CHANGED - " + (res.value ? res.value.toUpperCase() : "UNMARKED") + " ALREADY.");
      return res;
    }
    report(res);
    return res;
  }

  function report(res) {
    var rec = res.rec || {};
    var c = counts();
    var word = res.value === GOOD ? "MARKED GOOD" : (res.value === PASS ? "PASSED ON" : "MARK CLEARED");
    var glyph = res.value === GOOD ? "\u2665" : (res.value === PASS ? "\u2298" : "\u2661");
    print("SYSTEM", glyph + " HEART :: " + word + " :: " + nameOf(rec, res.id).toUpperCase()
      + (whereOf(rec) ? "  \u00b7  " + whereOf(rec) : "")
      + "\nTHE RECORD NOW HOLDS " + c.good + " MARKED GOOD AND " + c.pass + " PASSED ON OF " + c.vault + " IN THE VAULT."
      + "\nSHE IS TOLD WHAT YOU MARK EVERY TURN - THAT IS HOW THE TASTE TRAVELS - AND /heart PRINTS THE WHOLE RECORD.");
    return res;
  }

  /* ---- the button ---------------------------------------------------------
     One factory for the log tile, the full stage and the gallery, so the three cannot drift
     apart about what the heart means or when it is lit - the same rule keepsake.js follows.
     ------------------------------------------------------------------------- */
  function paint(btn, id, opts) {
    opts = opts || btn.__heartOpts || {};
    var s = state(id);
    btn.classList.toggle("on", s === GOOD);
    btn.classList.toggle("passed", s === PASS);
    var star = !!opts.plain;
    btn.textContent = opts.blank ? (s === GOOD ? "\u2665" : "\u2661") : (star ? "\u2665" : "HEART");
    btn.title = s === GOOD
      ? "you marked this GOOD - it is one of the ones she is told to make more of. Press again to pass on it, once more to clear the mark."
      : (s === PASS
        ? "you passed on this one - she is told, so it shapes what she leaves out. Press again to clear the mark."
        : "MARK IT GOOD :: the heart turns red, the mark is kept on the record, and she is told what you mark (that is the taste that trains her). Press again to pass on it instead.");
    return btn;
  }

  function button(id, opts) {
    opts = opts || {};
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = opts.className || "heart";
    btn.__heartOpts = opts;
    paint(btn, id, opts);
    btn.addEventListener("click", async function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        await cycle(id);
        paint(btn, id, opts);
      } catch (err) {
        print("SYSTEM", "HEART FAILED :: " + ((err && err.message) ? err.message : err));
      }
      btn.disabled = false;
    });
    btn.paint = function () { paint(btn, id, opts); };
    return btn;
  }

  // The stage's own button (index.html, so the bar is not built in JS).
  function paintStage(id) {
    var btn = document.getElementById("lightboxHeartBtn");
    if (!btn) return;
    btn.hidden = !(window.media && window.media.get(id));
    paint(btn, id, { blank: true });
  }

  /* ---- what she is told ---------------------------------------------------
     The whole point: the mark has to reach her, and it has to be true. Only marks he has
     actually made appear here, and the block says so - she is never invited to believe there
     is more of a record than there is.
     ------------------------------------------------------------------------- */
  function block() {
    var c = counts();
    if (!c.marked) return "";
    var lines = [];
    var goodIds = ids(GOOD, LIST_MAX), passIds = ids(PASS, LIST_MAX);
    if (goodIds.length) {
      lines.push("Marked GOOD (newest first):");
      goodIds.forEach(function (id) {
        var r = window.media.get(id) || {};
        lines.push("  \u2665 " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
    }
    if (passIds.length) {
      lines.push("Passed on (newest first):");
      passIds.forEach(function (id) {
        var r = window.media.get(id) || {};
        lines.push("  \u2298 " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
    }
    return "WHAT HE HAS MARKED WITH THE HEART. He puts a heart on a picture when it is what he\n"
      + "wanted, and passes on the ones that are not - a running record of his taste, kept on the\n"
      + "pictures themselves (" + c.good + " good, " + c.pass + " passed so far).\n"
      + lines.join("\n") + "\n"
      + "These are the only marks he has made; never claim he marked something he did not, and do not\n"
      + "recite this list back to him. Let it shape what you reach for: more of what he marks good,\n"
      + "less of what he passes on - including in the vision prompts you write.\n"
      + "You may ask to look at any of them again - [[SHOW: words from it]] or [[SHOW: #a-tag]] - and\n"
      + "a picture he marked good is the one worth studying: it is what he wanted, in his own words.";
  }

  function reportText() {
    var c = counts();
    var out = ["THE HEART :: " + c.good + " MARKED GOOD  \u00b7  " + c.pass + " PASSED ON  \u00b7  " + (c.vault - c.marked) + " UNMARKED  (of " + c.vault + " in the vault)"];
    out.push("SHE IS TOLD WHAT YOU MARK ON EVERY TURN (up to " + LIST_MAX + " of each) - that is the training, and it is the only way the mark leaves this device.");
    function rows(v, glyph) {
      var list = ids(v, 12);
      if (!list.length) return;
      out.push("");
      out.push((v === GOOD ? "MARKED GOOD" : "PASSED ON") + " ::");
      list.forEach(function (id) {
        var r = window.media.get(id) || {};
        out.push("  " + glyph + " " + nameOf(r, id) + (whereOf(r) ? "   [" + whereOf(r) + "]" : ""));
      });
      if (ids(v, 1e9).length > list.length) out.push("  \u2026 " + (ids(v, 1e9).length - list.length) + " more (the heart is on every card in the gallery; those two are the newest)");
    }
    rows(GOOD, "\u2665");
    rows(PASS, "\u2298");
    out.push("");
    out.push("IN THE GALLERY :: press the heart on any card (or on the picture itself - click the picture, and the stage's heart is in the bar). /heart good | pass | clear <WHAT> marks something from here; /heart finds pictures by the mark too.");
    return out.join("\n");
  }

  function help() {
    return "THE HEART :: WHAT HE MARKS, KEPT AS A RECORD OF TASTE (src/js/likes.js).\n"
      + "  One press marks a picture GOOD (the heart turns red), the next passes on it, the next clears\n"
      + "  the mark. It is on every card in the gallery, in every picture's caption bar in the log, and in\n"
      + "  the bar of the full stage. The mark is one field on the record and it never leaves this device.\n\n"
      + "  WHAT IT IS FOR :: she is told what you have marked at the top of every turn (up to six of each,\n"
      + "  newest first) - so what she reaches for, and the vision prompts she writes, bend toward what you\n"
      + "  mark good and away from what you pass on. That is the whole of the training: no model is fitted,\n"
      + "  nothing is uploaded, and only marks you actually made are ever shown to her.\n\n"
      + "  /heart prints the record (what, where, how many). /heart good | pass | clear <R12|#tag|WORDS>\n"
      + "  marks from the keyboard. /read likes is her side of it - the same record, read-only.";
  }

  function describe() {
    var c = counts();
    return c.good + " good, " + c.pass + " passed, " + (c.vault - c.marked) + " unmarked";
  }

  window.likes = {
    state: state,
    counts: counts,
    ids: ids,
    mark: mark,
    setGood: setGood,
    cycle: cycle,
    button: button,
    paint: paint,
    paintStage: paintStage,
    block: block,
    report: reportText,
    help: help,
    describe: describe,
    nameOf: nameOf
  };
})();
