window.MythosProgress = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var LINGER_MS = (opts.lingerMs != null && isFinite(Number(opts.lingerMs))) ? Number(opts.lingerMs) : 1600;
  var FAIL_MS = (opts.failMs != null && isFinite(Number(opts.failMs))) ? Number(opts.failMs) : 5000;
  var PAINT_MS = (opts.paintMs != null && isFinite(Number(opts.paintMs))) ? Number(opts.paintMs) : 120;
  var claims = [];
  var seq = 0;
  var paintTimer = null, lingerTimer = null, lingering = null;
  function T() { return opts.timers || window; }
  function later(ms, fn) { try { return T().setTimeout(fn, ms); } catch (e) { return null; } }
  function unlater(h) { try { T().clearTimeout(h); } catch (e) {} }
  function PRINT(who, text) {
    if (typeof opts.print === "function") { try { opts.print(who, text); } catch (e) {} return; }
    try { if (typeof window.print === "function" && document.getElementById("output")) window.print(who, text); } catch (e) {}
  }
  function el(id) {
    if (opts.els && opts.els[id]) return opts.els[id];
    if (typeof opts.el === "function") { try { return opts.el(id) || null; } catch (e) { return null; } }
    try { return document.getElementById(id); } catch (e) { return null; }
  }
  function announce(c, kind, why) {
    try {
      if (!c || c.id === "progress-demo") return;
      if (kind === "start" && (c.announced || c.priority !== 0)) return;
      if (kind === "done" && !c.announced) return;
      var label = String(c.label || "WORKING").replace(/\s+/g, " ").trim().toUpperCase();
      if (kind === "start") { c.announced = true; PRINT("SYSTEM", label + " :: STARTED IN THE BACKGROUND" + (c.total ? " (" + Math.round(c.total) + ")" : "") + "."); }
      else if (kind === "done") PRINT("SYSTEM", label + " :: DONE.");
      else PRINT("SYSTEM", label + " :: FAILED" + (why ? " :: " + String(why).toUpperCase().slice(0, 160) : "") + ".");
    } catch (e) {}
  }
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
  function railParts() {
    return { rail: el("progressRail"), fill: el("progressFill"), label: el("progressLabel"), pct: el("progressPct") };
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
      try { p.label.textContent = barText(c); } catch (e) {}
      if (c.detail) { try { p.label.title = String(c.detail); } catch (e) {} }
    }
    if (p.pct) { try { p.pct.textContent = failed ? "FAILED" : (pct == null ? "" : pct + "%"); } catch (e) {} }
    if (p.fill) {
      try {
        if (p.fill.classList) { p.fill.classList.toggle("pgIndet", pct == null && !failed); p.fill.classList.toggle("pgFail", !!failed); }
        p.fill.style.width = failed ? "100%" : (pct == null ? "" : pct + "%");
      } catch (e) {}
    }
    try { p.rail.hidden = false; } catch (e) {}
    try { if (p.rail.classList) p.rail.classList.toggle("pgDone", !!failed); } catch (e) {}
    try {
      p.rail.setAttribute("aria-valuenow", pct == null ? 0 : pct);
      p.rail.setAttribute("aria-valuetext", barText(c));
      p.rail.setAttribute("aria-busy", failed ? "false" : "true");
    } catch (e) {}
  }
  function paintNow() {
    if (paintTimer) { unlater(paintTimer); paintTimer = null; }
    var p = railParts();
    if (!p.rail) return;
    var c = shown();
    if (c) { lingering = null; paintClaim(c, false); return; }
    if (lingering) { paintClaim(lingering, !!lingering.failed); return; }
    try { p.rail.hidden = true; } catch (e) {}
    try { if (p.rail.classList) p.rail.classList.remove("pgDone"); } catch (e) {}
    if (p.fill) { try { p.fill.style.width = ""; if (p.fill.classList) p.fill.classList.remove("pgIndet", "pgFail"); } catch (e) {} }
    if (p.label) { try { p.label.textContent = ""; p.label.removeAttribute("title"); } catch (e) {} }
    if (p.pct) { try { p.pct.textContent = ""; } catch (e) {} }
  }
  function paintSoon() {
    if (paintTimer || lingerTimer) return;
    paintTimer = later(PAINT_MS, function () { paintTimer = null; paintNow(); });
  }
  function lingerWith(c, failed) {
    if (lingerTimer) { unlater(lingerTimer); lingerTimer = null; }
    lingering = { label: c.label, done: failed ? c.done : (c.total || 0), total: c.total, failed: failed, detail: c.detail };
    paintNow();
    lingerTimer = later(failed ? FAIL_MS : LINGER_MS, function () { lingerTimer = null; lingering = null; paintNow(); });
  }
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
    if (total != null) { var t = Number(total); c.total = (isFinite(t) && t > 0) ? t : 0; }
    if (done != null) { var d = Number(done); c.done = isFinite(d) ? (d < 0 ? 0 : d) : c.done; }
    c.at = Date.now();
    paintSoon();
    return c;
  }
  function makeClaim(id, label, o) {
    o = o || {};
    var c = {
      id: id,
      label: String(label == null ? "" : label) || "WORKING",
      total: (o.total != null && Number(o.total) > 0) ? Number(o.total) : 0,
      done: (o.done != null && Number(o.done) > 0) ? Number(o.done) : 0,
      priority: (o.priority != null && isFinite(Number(o.priority))) ? Number(o.priority) : 1,
      order: ++seq,
      startedAt: Date.now(),
      at: Date.now(),
      ended: false,
      failed: "",
      detail: o.detail ? String(o.detail) : ""
    };
    c.set = function (done, total) { return setClaim(c, done, total); };
    c.step = function (n) { return setClaim(c, c.done + (n == null ? 1 : (Number(n) || 1)), c.total); };
    c.setLabel = function (t) { if (!c.ended && t != null) { c.label = String(t) || c.label; paintSoon(); } return c; };
    c.finish = function () { return finishClaim(c, false); };
    c.fail = function (why) { return finishClaim(c, true, why); };
    return c;
  }
  function begin(label, o) {
    o = o || {};
    var id = o.id != null ? String(o.id) : ("job-" + (++seq));
    var c = byId(id);
    if (c && !c.ended) {
      if (label != null && String(label).length) c.label = String(label);
      if (o.detail != null) c.detail = String(o.detail);
      if (o.priority != null && isFinite(Number(o.priority))) c.priority = Number(o.priority);
      if (o.total != null) setClaim(c, null, o.total);
      if (o.done != null) setClaim(c, o.done, null);
      c.order = ++seq;
      paintNow();
      return c;
    }
    c = makeClaim(id, label, o);
    claims.push(c);
    if (lingerTimer) { unlater(lingerTimer); lingerTimer = null; }
    lingering = null;
    paintNow();
    announce(c, "start");
    return c;
  }
  function show(label, done, total) {
    if (arguments.length <= 1) return begin(label, {});
    if (arguments.length === 2) return begin(label, { total: done });
    return begin(label, { done: done, total: total });
  }
  function clear() {
    claims = [];
    if (lingerTimer) { unlater(lingerTimer); lingerTimer = null; }
    lingering = null;
    paintNow();
  }
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
  function rule(ch, n) { var s = ""; while (s.length < n) s += ch; return s; }
  function report() {
    var L = ["THE PROGRESS BAR - ONE RAIL FOR THE WHOLE TERMINAL"];
    L.push(rule("=", 60));
    var n = active();
    if (!n) { L.push("  NOTHING IS RUNNING. THE RAIL IS HIDDEN; IT APPEARS THE MOMENT A JOB OPENS ONE."); }
    else {
      L.push("  RUNNING NOW :: " + n + " JOB" + (n === 1 ? "" : "S"));
      var order = claims.slice().sort(function (a, b) { return b.order - a.order; });
      for (var i = 0; i < order.length; i++) {
        var c = order[i], pct = pctOf(c);
        L.push("    " + (c === shown() ? "\u25b8 " : "  ") + String(c.id) + " " + String(c.label).toUpperCase()
          + (c.total ? "  " + Math.round(c.done) + " / " + Math.round(c.total) + (pct == null ? "" : "  (" + pct + "%)") : "  (no count - indeterminate)")
          + (c.detail ? "  :: " + c.detail : ""));
      }
    }
    return L.join("\n");
  }
  function demo(steps, ms) {
    steps = Math.max(2, Math.min(40, Math.round(Number(steps) || 8)));
    var span = Math.max(600, Math.min(30000, Number(ms) || (steps * 320)));
    var P = begin("PROGRESS DEMO", { id: "progress-demo", total: steps, detail: "a fake job, run on purpose" });
    var chain = Promise.resolve();
    for (var i = 1; i <= steps; i++) {
      (function (k) { chain = chain.then(function () { P.set(k); return new Promise(function (r) { later(Math.round(span / steps), r); }); }); })(i);
    }
    return chain.then(function () { P.finish(); return "PROGRESS DEMO :: " + steps + " STEPS."; });
  }
  try { paintNow(); } catch (e) {}
  return {
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
    report: report,
    demo: demo,
    paint: paintNow
  };
}
return { client: client };
})();
