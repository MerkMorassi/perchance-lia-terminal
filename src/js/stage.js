window.stage = (function () {
  "use strict";

  var DEMO = "src/chips/sia-staging-chip/demo/sia-in-INT-2065.jpg";
  var stager = null;

  function el(id) { return document.getElementById(id); }
  function mount() { return el("stagingMount"); }

  function client() {
    if (stager) return stager;
    if (!window.MythosStaging || typeof window.MythosStaging.client !== "function") return null;
    try {
      stager = window.MythosStaging.client({
        el: mount(),
        say: function (t) { var n = el("stNote"); if (n) n.textContent = t; }
      });
    } catch (e) { return null; }
    return stager;
  }

  function isOpen() { var p = el("stagePanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("stagePanel");
    if (!p) return;
    p.hidden = false;
    var sys = el("systemPanel"), forge = el("createPanel"), keys = el("keysPanel");
    if (sys && !sys.hidden && window.instr && typeof window.instr.close === "function") window.instr.close();
    if (forge && !forge.hidden && typeof closeForge === "function") closeForge();
    if (keys && !keys.hidden && window.keyring && typeof window.keyring.close === "function") window.keyring.close();
    if (!client()) {
      print("SYSTEM", "THE STAGE IS OFFLINE IN THIS BUILD (THE STAGING CHIP IS NOT LOADED).");
      return;
    }
    setFull(true);
    print("SYSTEM", describe());
  }

  function close() {
    var p = el("stagePanel");
    if (p) p.hidden = true;
    setFull(false);
  }

  function toggle() { if (isOpen()) close(); else open(); }

  function fullOn() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("stageFull")); }
    catch (e) { return false; }
  }

  var fullKeyHandler = null;
  function bindFullKey(on) {
    if (on && !fullKeyHandler) {
      fullKeyHandler = function (e) {
        if (e.key !== "Escape" && e.keyCode !== 27) return;
        close();
        print("SYSTEM", "STAGE :: GIVEN BACK - THE DECKS ARE WHERE YOUR HAND LEFT THEM.");
      };
      document.addEventListener("keydown", fullKeyHandler, true);
    } else if (!on && fullKeyHandler) {
      document.removeEventListener("keydown", fullKeyHandler, true);
      fullKeyHandler = null;
    }
  }

  function setFull(on) {
    on = !!on;
    try { document.body.classList.toggle("stageFull", on); } catch (e) {}
    bindFullKey(on);
    try { if (window.decks && window.decks.measure) window.decks.measure(); } catch (e) {}
    try { if (window.decks && window.decks.paint) window.decks.paint(); } catch (e) {}
    return on;
  }

  function minimize() {
    var p = el("stagePanel");
    if (!p) return;
    var min = !p.classList.contains("stMin");
    try { p.classList.toggle("stMin", min); } catch (e) {}
    var s = el("stState");
    if (s) s.textContent = min ? "MINIMIZED - PRESS ANYWHERE TO RESTORE" : "";
  }

  function describe() {
    if (!window.MythosStaging) return "THE STAGE IS OFFLINE IN THIS BUILD.";
    var c = client();
    var n = c ? c.subjects().length : 0;
    return "THE STAGE :: DROP A SCENE, THEN YOUR SUBJECTS - DRAG TO BLOCK, WHEEL TO SIZE."
      + "\nCUT+ADD CUTS THROUGH THE CUTOUT CHIP (" + (window.MythosCutout ? "WORN" : "NOT WORN") + ")."
      + "\n" + (n ? n + " SUBJECT" + (n === 1 ? "" : "S") + " ON STAGE." : "THE STAGE IS EMPTY - PRESS LOAD DEMO SCENE FOR ONE OF HER SEVEN ROOMS.")
      + "\nNOTHING IS UPLOADED; THE STILL SAVES TO THIS MACHINE.";
  }

  async function demo() {
    var c = client();
    if (!c) { print("SYSTEM", "THE STAGE IS OFFLINE IN THIS BUILD."); return; }
    print("SYSTEM", "STAGE :: LOADING THE DEMO SCENE ...");
    try {
      var res = await fetch(DEMO, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var r = await c.setBackground(await res.blob());
      print("SYSTEM", r.ok ? "STAGE :: DEMO SCENE SET - DROP YOUR SUBJECTS ON IT." : r.why);
    } catch (e) {
      print("SYSTEM", "THE DEMO SCENE WOULD NOT LOAD.");
    }
  }

  async function still() {
    var c = client();
    if (!c) { print("SYSTEM", "THE STAGE IS OFFLINE IN THIS BUILD."); return; }
    var r = await c.render();
    if (!r.ok) { print("SYSTEM", r.why); return; }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(r.blob);
    a.download = "still.png";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    print("SYSTEM", "STAGE :: STILL SAVED " + r.width + "x" + r.height + " WITH " + r.subjects + " SUBJECT" + (r.subjects === 1 ? "" : "S") + ".");
  }

  function wire() {
    var b = el("stageBtn");
    if (b) b.addEventListener("click", function () { toggle(); });
    var d = el("stDemo");
    if (d) d.addEventListener("click", function () { demo(); });
    var s = el("stStill");
    if (s) s.addEventListener("click", function () { still(); });
    var t = el("stClear");
    if (t) t.addEventListener("click", function () { var c = client(); if (c) c.clear(); print("SYSTEM", "STAGE :: SET STRUCK."); });
    var n = el("stMin");
    if (n) n.addEventListener("click", function (ev) { ev.stopPropagation(); minimize(); });
    var x = el("stClose");
    if (x) x.addEventListener("click", function () { close(); });
    var p = el("stagePanel");
    if (p) p.addEventListener("click", function () {
      if (p.classList.contains("stMin")) minimize();
    });
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return {
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    describe: describe, demo: demo, still: still,
    subjects: function () { var c = client(); return c ? c.subjects() : []; },
    scene: function () { var c = client(); return c ? c.scene() : null; }
  };
})();
