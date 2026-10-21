window.MythosAgegate = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  function STORE() { return opts.store || null; }
  function el(id) {
    if (opts.els && opts.els[id]) return opts.els[id];
    if (typeof opts.el === "function") { try { return opts.el(id) || null; } catch (e) { return null; } }
    try { return document.getElementById(id); } catch (e) { return null; }
  }
  function gateEl() { return el("ageGate"); }
  function boxEl() { return el("ageGateBox"); }
  function enterEl() { return el("ageGateEnterBtn"); }
  function leaveEl() { return el("ageGateLeaveBtn"); }
  function dev() {
    if (typeof opts.dev === "function") { try { return !!opts.dev(); } catch (e) { return false; } }
    try { return !!(window.dev && window.dev.on && window.dev.on()); }
    catch (e) { return false; }
  }
  function zone() {
    if (typeof opts.zone === "function") { try { return opts.zone() || ""; } catch (e) { return ""; } }
    try { return (window.logTime && window.logTime.zone) ? window.logTime.zone() : ""; }
    catch (e) { return ""; }
  }
  function stamp(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    try { return new Date(ts == null ? Date.now() : ts).toLocaleString(); } catch (e) { return ""; }
  }
  function say(text) {
    if (typeof opts.print === "function") { try { opts.print(text); } catch (e) {} return; }
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }
  function leave() {
    var url = opts.leaveUrl || "https://perchance.org/";
    if (typeof opts.leave === "function") { try { opts.leave(url); } catch (e) {} return; }
    try { location.href = url; } catch (e) {}
  }
  function state() {
    var S = STORE();
    if (!S) { try { var w = window.root; var k = (w && w.kv && w.kv.lia_settings) || null; if (k) { return k.get("agegate").then(function (v) { return (v && v.ok === true) ? v : null; }, function () { return null; }); } } catch (e) {} return Promise.resolve(null); }
    try {
      var got = (typeof S.get === "function") ? S.get() : S.load();
      if (got && typeof got.then === "function") return got.then(function (v) { return (v && v.ok === true) ? v : null; }, function () { return null; });
      return Promise.resolve((got && got.ok === true) ? got : null);
    } catch (e) { return Promise.resolve(null); }
  }
  function paint() {
    var b = boxEl(), e = enterEl();
    if (b && e) { try { e.disabled = !b.checked; } catch (x) {} }
  }
  function show(quiet) {
    var g = gateEl(); if (!g) return false;
    var b = boxEl();
    if (b) { try { b.checked = false; } catch (e) {} }
    try { g.hidden = false; } catch (e) {}
    paint();
    try { if (b && b.focus) b.focus(); } catch (e) {}
    if (!quiet) say("THE DOOR :: THE 18+ QUESTION, ASKED AGAIN. THIS SITE IS 18+ AND NSFW BY DEFAULT, AND NOTHING INVOLVING ANYONE UNDER 18 IS MADE HERE.");
    return true;
  }
  function close() {
    var g = gateEl();
    if (g) { try { g.hidden = true; } catch (e) {} }
  }
  function pass() {
    var b = boxEl();
    if (!b || !b.checked) { paint(); return Promise.resolve(false); }
    var rec = { ok: true, at: Date.now(), zone: zone() };
    var S = STORE();
    function done() {
      close();
      say("THE DOOR :: 18+ CONFIRMED ON THIS DEVICE (" + stamp() + "). THE ANSWER IS KEPT IN THIS BROWSER ONLY AND IS NEVER SENT ANYWHERE. /agegate SHOWS THE DOOR AGAIN; /agegate forget ASKS ON THE NEXT LOAD.");
      try { var u = el("userInput"); if (u && u.focus) u.focus(); } catch (e) {}
      return true;
    }
    if (S && typeof S.set === "function") {
      try { var r = S.set(rec); if (r && typeof r.then === "function") return r.then(done, done); } catch (e) {}
      return Promise.resolve(done());
    }
    try { var w = window.root; var k = (w && w.kv && w.kv.lia_settings) || null; if (k) return k.set("agegate", rec).then(done, done); } catch (e) {}
    return Promise.resolve(done());
  }
  function forget() {
    var S = STORE();
    function done() { return state().then(function (v) { return !v; }); }
    if (S && typeof S.delete === "function") {
      try { var r = S.delete(); if (r && typeof r.then === "function") return r.then(done, function () { return done(); }); } catch (e) {}
      return done();
    }
    try { var w = window.root; var k = (w && w.kv && w.kv.lia_settings) || null; if (k) return k.delete("agegate").then(done, function () { return done(); }); } catch (e) {}
    return done();
  }
  function describe() {
    var g = gateEl();
    var open = !!(g && !g.hidden);
    return state().then(function (v) {
      return "THE DOOR :: " + (v
        ? "18+ CONFIRMED ON THIS DEVICE" + (v.at ? " AT " + stamp(v.at) : "") + (v.zone ? " (" + v.zone + ")" : "") + " - THE NEXT LOAD WILL NOT ASK."
        : "NO ANSWER IS KEPT HERE - THE NEXT LOAD WILL ASK.")
        + (open ? "\nIT IS OPEN ON THE SCREEN RIGHT NOW." : "")
        + "\nIT IS KEPT IN THIS BROWSER ONLY AND IS NEVER SENT ANYWHERE. /agegate SHOWS IT; /agegate forget ASKS ON THE NEXT LOAD."
        + (dev() ? "\nDEVELOPER BYPASS IS ON FOR THIS TAB - NEITHER DOOR ASKS UNTIL IT CLOSES." : "");
    });
  }
  function help() {
    return "THE DOOR :: the 18+ checkbox, on the screen before anything else loads.\n"
      + "THIS SITE IS 18+ AND NSFW BY DEFAULT. Every person who opens it is asked once to confirm they are 18 or over, and the answer is kept in THIS BROWSER only - never uploaded, never sent to the model, never written anywhere else. The door FAILS CLOSED: no record, no entry.\n"
      + "\n  /agegate            show the door again (hand the screen to someone else)\n"
      + "  /agegate forget     take the answer off this device; the NEXT LOAD asks again\n"
      + "  /agegate status     what is kept, and when it was given\n"
      + "\nNOTHING ELSE WAITS ON IT: no lane, no command and no reply is gated by this.";
  }
  function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (!a || a === "show" || a === "open" || a === "ask" || a === "again") { show(); return Promise.resolve("SHOWN"); }
    if (a === "forget" || a === "clear" || a === "reset" || a === "off" || a === "remove") {
      return forget().then(function () { say("THE DOOR :: THE ANSWER IS OFF THIS DEVICE. THE NEXT LOAD WILL ASK AGAIN. (THIS PAGE IS ALREADY OPEN, SO IT STAYS OPEN.)"); return "FORGOTTEN"; });
    }
    if (a === "status" || a === "state" || a === "info") { return describe().then(function (t) { say(t); return t; }); }
    if (a === "help" || a === "-h" || a === "--help") { say(help()); return Promise.resolve(help()); }
    show();
    return Promise.resolve("SHOWN");
  }
  function boot() {
    paint();
    if (dev()) { close(); return Promise.resolve("BYPASSED"); }
    return state().then(function (v) { if (v) close(); return v ? "CLOSED" : "ASKING"; });
  }
  function wire() {
    var b = boxEl(), e = enterEl(), l = leaveEl();
    if (b && b.addEventListener) {
      b.addEventListener("change", paint);
      b.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); pass(); } });
    }
    if (e && e.addEventListener) e.addEventListener("click", function () { pass(); });
    if (l && l.addEventListener) l.addEventListener("click", function () { leave(); });
  }
  if (opts.wire !== false) { try { wire(); } catch (e) {} }
  return {
    state: state,
    show: show,
    close: close,
    pass: pass,
    forget: forget,
    command: command,
    describe: describe,
    help: help,
    boot: boot,
    wire: wire,
    paint: paint
  };
}
return { client: client };
})();
