/* THE DOOR - src/js/agegate.js

   Patrikios, 2026-09-30: "This site is 18+ NSFW by default." and, in the same breath, "If the
   context creative, allegorical, symbolic, fictional, etc. get a simple 18+ checkbox on initial
   page load."

   This module is the BEHAVIOUR of that checkbox. The box itself is plain markup at the top of
   index.html, not something drawn from here, and that is deliberate: the door has to be on the
   screen at the FIRST PAINT - before a single src/ file has loaded, before the terminal has booted,
   before anything can be read - and markup is the only thing that is. The overlay is opaque and
   sits at z-index 2000, above the gallery (900) and the full stage (1000), so nothing underneath it
   is visible until the door opens. So the rule is: THE DOOR FAILS CLOSED. If this file never
   arrives, the small plain-ES5 fallback at the foot of index.html still wires the two buttons to
   the same kv key; if that never runs either, the door simply stays shut. A gate that can fail open
   is decoration.

   ONE QUESTION, ONE TIME. The answer is kept on THIS DEVICE ONLY (kv lia_settings / agegate,
   { ok, at, zone }) - it is never uploaded, never sent to the model, never written into src/, and
   it is the same kv this terminal keeps every other preference in. On a load where the answer is
   already there the door closes itself as soon as this module reads it (one IndexedDB round trip,
   so a returning visitor sees the door for a few milliseconds and then the terminal - which is the
   right way round: asking someone who has already answered is the lesser sin).

   WHAT IT IS NOT. It is not a legal instrument and it is not pretending to be: it is a sign on the
   door and an honest click, which is what he asked for. Nothing about it is secret - the overlay,
   the key and this file are all public - and it does not gate anything else in the terminal: no
   lane, no command and no reply waits on it, and clearing it changes one boolean on one browser.

   /agegate shows the door again (for handing the screen to someone else); /agegate forget takes
   the answer off this device so the NEXT LOAD asks again; /agegate status prints what is kept.
*/
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var KEY = "agegate";      // { ok: true, at: <ms>, zone: <the clock's zone at the time> }

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function gateEl() { return document.getElementById("ageGate"); }
  function dev() {
    try { return window.dev && window.dev.on(); }
    catch (e) { return false; }
  }
  function boxEl() { return document.getElementById("ageGateBox"); }
  function enterEl() { return document.getElementById("ageGateEnterBtn"); }

  // The one place the answer lives. Absent, unreadable or anything but `ok: true` reads as NO
  // ANSWER - a corrupt record must not be a key to the door.
  async function state() {
    var k = kv(); if (!k) return null;
    try {
      var v = await k.get(KEY);
      return (v && v.ok === true) ? v : null;
    } catch (e) { return null; }
  }

  function paint() {
    var b = boxEl(), e = enterEl();
    if (b && e) e.disabled = !b.checked;
  }

  // Open the door again. The box is CLEARED every time it is shown: a pre-ticked box is not a
  // question, and this one is only ever asked when the answer is genuinely wanted again.
  function show(quiet) {
    var g = gateEl(); if (!g) return false;
    var b = boxEl();
    if (b) b.checked = false;
    g.hidden = false;
    paint();
    try { if (b) b.focus(); } catch (e) {}
    if (!quiet) say("THE DOOR :: THE 18+ QUESTION, ASKED AGAIN. THIS SITE IS 18+ AND NSFW BY DEFAULT, AND NOTHING INVOLVING ANYONE UNDER 18 IS MADE HERE.");
    return true;
  }

  function close() {
    var g = gateEl();
    if (g) g.hidden = true;
  }

  // The tick, the click, and the one write. `at` and `zone` are kept because a record of a gate
  // that says nothing about when is not a record - and the zone comes from the terminal's own
  // clock (logtime.js), so the two never disagree about what time it was.
  async function pass() {
    var b = boxEl();
    if (!b || !b.checked) { paint(); return false; }
    var rec = { ok: true, at: Date.now(), zone: (window.logTime && window.logTime.zone) ? window.logTime.zone() : "" };
    var k = kv();
    if (k) { try { await k.set(KEY, rec); } catch (e) { /* the door still opens; the answer just will not be remembered */ } }
    close();
    say("THE DOOR :: 18+ CONFIRMED ON THIS DEVICE (" + ((window.logTime && window.logTime.stamp) ? window.logTime.stamp() : new Date().toLocaleString()) + "). THE ANSWER IS KEPT IN THIS BROWSER ONLY AND IS NEVER SENT ANYWHERE. /agegate SHOWS THE DOOR AGAIN; /agegate forget ASKS ON THE NEXT LOAD.");
    try { if (window.userInput) window.userInput.focus(); } catch (e) {}
    return true;
  }

  // Take the answer off the device. The door does NOT open now - it is already open; what this
  // does is make the NEXT LOAD ask, which is the honest way to treat "forget this".
  async function forget() {
    var k = kv();
    if (k) { try { await k.delete(KEY); } catch (e) {} }
    var had = await state();
    return !had;
  }

  function describe() {
    var g = gateEl();
    var open = !!(g && !g.hidden);
    return state().then(function (v) {
      return "THE DOOR :: " + (v
        ? "18+ CONFIRMED ON THIS DEVICE" + (v.at ? " AT " + ((window.logTime && window.logTime.stamp) ? window.logTime.stamp(v.at) : new Date(v.at).toLocaleString()) : "")
          + (v.zone ? " (" + v.zone + ")" : "") + " - THE NEXT LOAD WILL NOT ASK."
        : "NO ANSWER IS KEPT HERE - THE NEXT LOAD WILL ASK.")
        + (open ? "\nIT IS OPEN ON THE SCREEN RIGHT NOW." : "")
        + "\nIT IS KEPT IN THIS BROWSER ONLY (kv " + FOLDER + " / " + KEY + ") AND IS NEVER SENT ANYWHERE. /agegate SHOWS IT; /agegate forget ASKS ON THE NEXT LOAD."
        + (dev() ? "\nDEVELOPER BYPASS IS ON FOR THIS TAB - NEITHER DOOR ASKS UNTIL IT CLOSES." : "");
    });
  }

  function help() {
    return "THE DOOR (src/js/agegate.js) :: the 18+ checkbox, on the screen before anything else loads.\n"
      + "THIS SITE IS 18+ AND NSFW BY DEFAULT. Every person who opens it is asked once to confirm they are 18 or over, and the answer is kept in THIS BROWSER only - never uploaded, never sent to the model, never written into src/. The door is opaque and sits over everything (z 2000), so nothing underneath is readable until it is open, and it FAILS CLOSED: if the script that runs it never arrives, the buttons still work (the fallback at the foot of index.html), and if neither arrives the door stays shut.\n"
      + "\n  /agegate            show the door again (hand the screen to someone else)\n"
      + "  /agegate forget     take the answer off this device; the NEXT LOAD asks again\n"
      + "  /agegate status     what is kept, and when it was given\n"
      + "\nNOTHING ELSE WAITS ON IT: no lane, no command and no reply is gated by this. It does not replace what she is told - the site's 18+ rule, no under-18 content, and the rest of the house rules ride in her BOUNDARIES block every turn, and the image rule restates the same line where a prompt is written.";
  }

  // A receipt on the stage. `print` is chat.js's own (it shadows the browser's), so this is
  // guarded twice: the door must never fall over because the log was not ready.
  function say(text) {
    try { if (typeof print === "function") print("SYSTEM", text); } catch (e) {}
  }

  async function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (!a || a === "show" || a === "open" || a === "ask" || a === "again") { show(); return; }
    if (a === "forget" || a === "clear" || a === "reset" || a === "off" || a === "remove") {
      await forget();
      say("THE DOOR :: THE ANSWER IS OFF THIS DEVICE. THE NEXT LOAD WILL ASK AGAIN. (THIS PAGE IS ALREADY OPEN, SO IT STAYS OPEN.)");
      return;
    }
    if (a === "status" || a === "state" || a === "info") { say(await describe()); return; }
    if (a === "help" || a === "-h" || a === "--help") { say(help()); return; }
    show();
  }

  // BOOT. The markup is up by default; the only thing this does is CLOSE it when the answer is
  // already on the device. It runs at script time (the DOM above is already parsed) and again on
  // DOMContentLoaded, because the engine replays that event and one of the two always lands.
  async function boot() {
    paint();
    if (dev()) { close(); return; }
    var v = await state();
    if (v) close();
  }

  function wire() {
    var b = boxEl(), e = enterEl(), l = document.getElementById("ageGateLeaveBtn");
    if (b) {
      b.addEventListener("change", paint);
      b.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); pass(); } });
    }
    if (e) e.addEventListener("click", function () { pass(); });
    if (l) l.addEventListener("click", function () { location.href = "https://perchance.org/"; });
  }

  wire();
  boot();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { wire(); boot(); });

  window.agegate = {
    state: state,
    show: show,
    close: close,
    pass: pass,
    forget: forget,
    command: command,
    describe: describe,
    help: help,
    boot: boot
  };
})();
