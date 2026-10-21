  /* ==========================================================================
     THE PROGRESS BAR (src/js/progress.js)  --  window.progress

     WHAT IT IS FOR. A lot of what this terminal does takes real time and says
     nothing while it does it: a render is handed to the image service and the
     page waits, an upscale is a resample on this device's GPU, the CLASSIFIER
     reads a whole vault one picture at a time, a backup fetches and zips every
     file under src/, an import writes a 3.8 MB conversation into kv in nineteen
     chunks, the sync writes the archive out and reads one back. Each of those
     already PRINTS what it is doing - a tile spinner, a panel line, a receipt at
     the end - but a line of text is easy to miss, and "is it still working or did
     it die?" is the one question a terminal should answer at a glance.

     So there is ONE bar, and it belongs to the whole terminal rather than to any
     one panel: `#progressRail`, the thin element at the top of the LOWER DECK
     (index.html), just above the input box. It is hidden until something starts,
     it names the job and counts what it has done (`UPSCALING 372 / 1144`), and
     it takes itself down when the last job ends. Nothing else in the terminal
     needs to know it exists - a caller opens a job, ticks it, and closes it.

     HOW A JOB USES IT (this is the whole API):

       var P = window.progress.begin("UPSCALING", { total: list.length });
       for (var i = 0; i < list.length; i++) {
         ...do the work...
         P.set(i + 1);              // or P.step() to just add one
       }
       P.finish();                  // ...or P.fail("the reason"), which says so

     `total` may be left off: a job with no count is drawn as an INDETERMINATE
     bar (a segment sliding across the track) rather than a lie about a fraction.
     That is the honest shape for the things that really have no count - one
     render, one vision call, one resample - and it is what `progress.show()`
     gives, for a one-liner with no handle to keep.

     STACKING, AND WHY THE NEWEST JOB IS NOT ALWAYS THE ONE SHOWN. Jobs nest:
     the forge's batch has a count of its own, and inside each picture the image
     service is called and has none. The rail shows ONE job at a time - the one
     with the highest `priority` (default 1), and the newest of equals - so the
     batch's count wins over the call it makes, while a standalone render still
     shows its own bar. A job never blanks another job's bar by finishing: when
     the shown one ends, the next active one is drawn at once.

     WHAT IT IS NOT. It is not a control (nothing here is pressable), not the
     in-hand chip (src/js/minibox.js - that is WHICH picture, with a thumbnail),
     and not a record: it holds nothing across a reload, writes nothing to kv,
     and touches no other module. It is a look at what the machinery is doing,
     and the moment it stops being true it is gone.

     `/progress` reports what is running (and `/progress demo` runs a fake job so
     the bar can be looked at without waiting for a real one).
     ========================================================================== */
(function () {
  "use strict";

  var LINGER_MS = 1600;      // how long a FINISHED job's word stays up before the rail goes
  var FAIL_MS = 5000;        // ...and a failed one, which is worth reading
  var PAINT_MS = 120;        // at most this often while a loop ticks (a tight loop must not
                             // reflow the deck hundreds of times a second)

  var claims = [];           // the jobs that are running, in the order they began
  var seq = 0;               // ...and the stamps that order them when priorities tie
  var paintTimer = null;     // a repaint is due
  var lingerTimer = null;    // the rail is showing a job that has ENDED
  var lingering = null;      // ...which one: { label, done, total, failed }

  function announce(c, kind, why) {
    try {
      if (!c || c.id === "progress-demo") return;
      if (kind === "start" && (c.announced || c.priority !== 0)) return;
      if (kind === "done" && !c.announced) return;
      if (typeof window.print !== "function") return;
      if (!document.getElementById("output")) return;
      var label = String(c.label || "WORKING").replace(/\s+/g, " ").trim().toUpperCase();
      if (kind === "start") {
        c.announced = true;
        window.print("SYSTEM", label + " :: STARTED IN THE BACKGROUND" + (c.total ? " (" + Math.round(c.total) + ")" : "") + ".");
      } else if (kind === "done") {
        window.print("SYSTEM", label + " :: DONE.");
      } else {
        window.print("SYSTEM", label + " :: FAILED" + (why ? " :: " + String(why).toUpperCase().slice(0, 160) : "") + ".");
      }
    } catch (e) {}
  }

  function el(id) { return document.getElementById(id); }

  function clamp01(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    return n < 0 ? 0 : (n > 1 ? 1 : n);
  }

  function text(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  function pctOf(c) {
    if (!c || !c.total) return null;
    return Math.round(clamp01(c.done / c.total) * 100);
  }

  // The claim that owns the rail RIGHT NOW: the highest priority, and the newest
  // of those. A caller that cannot hold the object it was handed (a nested
  // callback, a helper) can still drive its job by id - see the module forwards.
  function shown() {
    var best = null;
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (c.ended) continue;
      if (!best || c.priority > best.priority || (c.priority === best.priority && c.order > best.order)) best = c;
    }
    return best;
  }

  function byId(id) {
    id = String(id == null ? "" : id);
    for (var i = 0; i < claims.length; i++) if (claims[i].id === id) return claims[i];
    return null;
  }

  // ---- painting ------------------------------------------------------------

  function railParts() {
    return {
      rail: el("progressRail"),
      fill: el("progressFill"),
      label: el("progressLabel"),
      pct: el("progressPct")
    };
  }

  function barText(c) {
    var s = text(c.label || "WORKING", 64);
    if (c.total) s += "  " + Math.round(c.done) + " / " + Math.round(c.total);
    var others = 0;
    for (var i = 0; i < claims.length; i++) if (!claims[i].ended && claims[i] !== c) others++;
    if (others) s += "   +" + others;
    return s;
  }

  function paintClaim(c, failed) {
    var p = railParts();
    if (!p.rail) return;
    var pct = pctOf(c);
    if (p.label) {
      p.label.textContent = barText(c);
      if (c.detail) p.label.title = String(c.detail);
    }
    if (p.pct) p.pct.textContent = failed ? "FAILED" : (pct == null ? "" : pct + "%");
    if (p.fill) {
      p.fill.classList.toggle("pgIndet", pct == null && !failed);
      p.fill.classList.toggle("pgFail", !!failed);
      p.fill.style.width = failed ? "100%" : (pct == null ? "" : pct + "%");
    }
    p.rail.hidden = false;
    p.rail.classList.toggle("pgDone", !!failed);
    try {
      p.rail.setAttribute("aria-valuenow", pct == null ? 0 : pct);
      p.rail.setAttribute("aria-valuetext", barText(c));
      p.rail.setAttribute("aria-busy", failed ? "false" : "true");
    } catch (e) {}
  }

  function paintNow() {
    if (paintTimer) { window.clearTimeout(paintTimer); paintTimer = null; }
    var p = railParts();
    if (!p.rail) return;
    var c = shown();
    if (c) { lingering = null; paintClaim(c, false); return; }
    if (lingering) { paintClaim(lingering, !!lingering.failed); return; }
    p.rail.hidden = true;
    p.rail.classList.remove("pgDone");
    if (p.fill) { p.fill.style.width = ""; p.fill.classList.remove("pgIndet", "pgFail"); }
    if (p.label) { p.label.textContent = ""; p.label.removeAttribute("title"); }
    if (p.pct) p.pct.textContent = "";
  }

  function paintSoon() {
    if (paintTimer || lingerTimer) return;
    paintTimer = window.setTimeout(function () { paintTimer = null; paintNow(); }, PAINT_MS);
  }

  // A job that has ENDED keeps its word up for a breath - a bar that vanishes the
  // instant it fills reads as a glitch, and a failure that vanishes with it is
  // worse: the reason has to be readable. Only when NOTHING else is running.
  function lingerWith(c, failed) {
    if (lingerTimer) { window.clearTimeout(lingerTimer); lingerTimer = null; }
    lingering = { label: c.label, done: failed ? c.done : (c.total || 0), total: c.total, failed: failed, detail: c.detail };
    paintNow();
    lingerTimer = window.setTimeout(function () {
      lingerTimer = null;
      lingering = null;
      paintNow();
    }, failed ? FAIL_MS : LINGER_MS);
  }

  // ---- the claim -----------------------------------------------------------

  function finishClaim(c, failed, why) {
    if (!c || c.ended) return c;
    c.ended = true;
    c.endedAt = Date.now();
    if (failed) { c.failed = String(why || "FAILED"); c.detail = c.failed; }
    for (var i = 0; i < claims.length; i++) if (claims[i] === c) { claims.splice(i, 1); break; }
    announce(c, failed ? "fail" : "done", why);
    if (!claims.length) lingerWith(c, failed);
    else paintNow();
    return c;
  }

  function setClaim(c, done, total) {
    if (!c || c.ended) return c;
    if (total != null) {
      var t = Number(total);
      c.total = (isFinite(t) && t > 0) ? t : 0;
    }
    if (done != null) {
      var d = Number(done);
      c.done = isFinite(d) ? (d < 0 ? 0 : d) : c.done;
    }
    c.at = Date.now();
    // A count that is complete is the caller's word to give - but a job that has
    // ticked its last tick and never said finish() must not sit at 100% for ever.
    paintSoon();
    return c;
  }

  function makeClaim(id, label, opts) {
    opts = opts || {};
    var c = {
      id: id,
      label: String(label == null ? "" : label) || "WORKING",
      total: (opts.total != null && Number(opts.total) > 0) ? Number(opts.total) : 0,
      done: (opts.done != null && Number(opts.done) > 0) ? Number(opts.done) : 0,
      priority: (opts.priority != null && isFinite(Number(opts.priority))) ? Number(opts.priority) : 1,
      order: ++seq,
      startedAt: Date.now(),
      at: Date.now(),
      ended: false,
      failed: "",
      detail: opts.detail ? String(opts.detail) : ""
    };
    c.set = function (done, total) { return setClaim(c, done, total); };
    c.step = function (n) { return setClaim(c, c.done + (n == null ? 1 : (Number(n) || 1)), c.total); };
    c.setLabel = function (t) { if (!c.ended && t != null) { c.label = String(t) || c.label; paintSoon(); } return c; };
    c.finish = function () { return finishClaim(c, false); };
    c.fail = function (why) { return finishClaim(c, true, why); };
    return c;
  }

  // ---- what the rest of the terminal calls ---------------------------------

  // Open a job. `label` is what the bar says ("UPSCALING"); `opts` may carry
  // `total`, `done`, `priority`, `detail` and `id`. An id that is already running
  // is CONTINUED rather than duplicated, which is what makes a job safe to open
  // from two places (the panel and a command) without two bars for one thing.
  function begin(label, opts) {
    opts = opts || {};
    var id = opts.id != null ? String(opts.id) : ("job-" + (++seq));
    var c = byId(id);
    if (c && !c.ended) {
      if (label != null && String(label).length) c.label = String(label);
      if (opts.detail != null) c.detail = String(opts.detail);
      if (opts.priority != null && isFinite(Number(opts.priority))) c.priority = Number(opts.priority);
      if (opts.total != null) setClaim(c, null, opts.total);
      if (opts.done != null) setClaim(c, opts.done, null);
      c.order = ++seq;
      paintNow();
      return c;
    }
    c = makeClaim(id, label, opts);
    claims.push(c);
    if (lingerTimer) { window.clearTimeout(lingerTimer); lingerTimer = null; }
    lingering = null;
    paintNow();
    announce(c, "start");
    return c;
  }

  // A one-liner with no handle: an indeterminate bar for as long as it takes, or
  // a whole job in one call. `show(label)` opens and returns the claim;
  // `show(label, total)` opens a counted job; `show(label, done, total)` ticks it.
  function show(label, done, total) {
    if (arguments.length <= 1) return begin(label, {});
    if (arguments.length === 2) return begin(label, { total: done });
    return begin(label, { done: done, total: total });
  }

  function clear() {
    claims = [];
    if (lingerTimer) { window.clearTimeout(lingerTimer); lingerTimer = null; }
    lingering = null;
    paintNow();
  }

  /* ---- what is running, in words ----------------------------------------- */

  function current() {
    var c = shown();
    if (!c) return null;
    return { id: c.id, label: c.label, done: c.done, total: c.total, pct: pctOf(c), detail: c.detail, at: c.startedAt };
  }

  function active() {
    var n = 0;
    for (var i = 0; i < claims.length; i++) if (!claims[i].ended) n++;
    return n;
  }

  function reportText() {
    var L = ["THE PROGRESS BAR - THE THIN GREEN LINE AT THE TOP OF THE LOWER DECK (src/js/progress.js)"];
    L.push(rule("=", 78));
    var n = active();
    if (!n) {
      L.push("  NOTHING IS RUNNING. THE RAIL IS HIDDEN; IT APPEARS THE MOMENT A JOB OPENS ONE AND");
      L.push("  TAKES ITSELF DOWN WHEN THE LAST ONE ENDS.");
    } else {
      L.push("  RUNNING NOW :: " + n + " JOB" + (n === 1 ? "" : "S"));
      var order = claims.slice().sort(function (a, b) { return b.order - a.order; });
      for (var i = 0; i < order.length; i++) {
        var c = order[i];
        var pct = pctOf(c);
        L.push("    " + (c === shown() ? "\u25b8 " : "  ") + String(c.id).padEnd(16)
          + " " + String(c.label).toUpperCase()
          + (c.total ? "  " + Math.round(c.done) + " / " + Math.round(c.total) + (pct == null ? "" : "  (" + pct + "%)") : "  (no count - drawn as an indeterminate sliding bar)")
          + (c.detail ? "  :: " + c.detail : ""));
      }
    }
    L.push("");
    L.push("  WHO USES IT :: a render and a vision call (no count), an upscale (no count), the CLASSIFIER");
    L.push("  and the other /tools jobs, the UPSCALE sweep, a forge batch, an image forge run, a BACKUP, a");
    L.push("  chatlog import/read-back/export, the SYNC and the cloud road, and her ears (the audio decode).");
    L.push("  HOW A JOB OPENS ONE :: var P = window.progress.begin(\"UPSCALING\", { total: n }); then");
    L.push("  P.set(done) (or P.step()), and P.finish() - or P.fail(\"the reason\"), which is shown in red.");
    L.push("  A job with no total is an INDETERMINATE bar: a segment sliding across the track, which says");
    L.push("  \"working, no count\" rather than inventing a fraction. /progress demo SHOWS IT AT WORK.");
    return L.join("\n");
  }

  function rule(ch, n) {
    var s = "";
    while (s.length < n) s += ch;
    return s;
  }

  // ---- the demo: the bar at work, without waiting for real work -------------

  // A fake job through the same door every real one uses, so the bar can be looked
  // at on a phone or a desk in three seconds instead of twenty minutes. It is
  // labelled plainly as a demo - it is never mistaken for the machinery.
  async function demo(steps, ms) {
    steps = Math.max(2, Math.min(40, Math.round(Number(steps) || 8)));
    var span = Math.max(600, Math.min(30000, Number(ms) || (steps * 320)));
    var P = begin("PROGRESS DEMO", { id: "progress-demo", total: steps, detail: "a fake job, run on purpose - nothing is being made" });
    for (var i = 1; i <= steps; i++) {
      P.set(i);
      await new Promise(function (r) { window.setTimeout(r, Math.round(span / steps)); });
    }
    P.finish();
    return "PROGRESS DEMO :: " + steps + " STEPS IN " + Math.round(span / 1000) + "S. THE RAIL IS AT THE TOP OF THE LOWER DECK - IT SAID \"PROGRESS DEMO 4 / 8\" AND HAS ALREADY TAKEN ITSELF DOWN.";
  }

  /* ==========================================================================
     THE WIRING AND THE BOOT
     ========================================================================== */

  function wire() {
    // Nothing to press and nothing to listen to: the rail is read, not used. It
    // is painted once at boot so a job that opens before the first paint still
    // has a box to draw into.
    paintNow();
  }

  window.progress = {
    begin: begin,
    show: show,
    set: function (id, done, total) { return setClaim(byId(id), done, total); },
    step: function (id, n) { var c = byId(id); return c ? setClaim(c, c.done + (n == null ? 1 : (Number(n) || 1)), c.total) : null; },
    setLabel: function (id, t) { var c = byId(id); return c ? c.setLabel(t) : null; },
    finish: function (id) { return finishClaim(byId(id), false); },
    fail: function (id, why) { return finishClaim(byId(id), true, why); },
    clear: clear,
    active: active,
    current: current,
    report: reportText,
    demo: demo,
    paint: paintNow
  };

  wire();
})();
