window.gap = (function () {
  "use strict";

  var on = false;
  var turns = 0;
  var cap = 40;
  var COOLDOWN = 1200;
  var QUIET_NEED = 800;
  var WAIT_MAX = 25000;
  var MAYA_LOUD_NEED = 600;
  var MAYA_QUIET_NEED = 1500;

  var lastEnd = 0;
  var wasSpeaking = false;
  var mayaLoudSince = 0;
  var mayaQuietSince = 0;

  function say(t) { try { if (window.print) window.print("SYSTEM", String(t)); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function loud() {
    try { if (window.voice && window.voice.level) return !!window.voice.level().loud; } catch (e) {}
    return false;
  }
  function rms() {
    try { if (window.voice && window.voice.level) return Number(window.voice.level().rms) || 0; } catch (e) {}
    return 0;
  }
  function speaking() {
    try { if (window.voice && window.voice.isSpeaking) return !!window.voice.isSpeaking(); } catch (e) {}
    return false;
  }
  function holder() {
    try { if (window.turn && window.turn.floor) return String(window.turn.floor().holder || ""); } catch (e) {}
    return "";
  }
  function give(who) {
    try { if (window.turn && window.turn.request) window.turn.request(who); } catch (e) {}
  }
  function free(who) {
    try {
      if (window.turn && window.turn.floor && window.turn.release) {
        if (String(window.turn.floor().holder || "") === who) window.turn.release(who);
      }
    } catch (e) {}
  }
  function feed() {
    try { if (window.turn && window.turn.vadFeed) window.turn.vadFeed(rms(), "air"); } catch (e) {}
  }
  function micOpen() {
    try {
      if (!window.voice) return;
      if (window.voice.isListening && window.voice.isListening()) return;
      if (window.voice.isLive && window.voice.isLive()) return;
      if (window.voice.listen) window.voice.listen();
    } catch (e) {}
  }

  async function takeFloor() {
    if (!on) return true;
    while (Date.now() - lastEnd < COOLDOWN) { await sleep(100); if (!on) return true; }
    var t0 = Date.now(), quietSince = 0;
    for (;;) {
      if (!on) return true;
      var h = holder();
      if (!loud() && h !== "MAYA") {
        if (!quietSince) quietSince = Date.now();
        if (Date.now() - quietSince >= QUIET_NEED) break;
      } else quietSince = 0;
      if (Date.now() - t0 > WAIT_MAX) { say("GAP :: THE ROOM NEVER QUIETED - TAKING THE FLOOR ANYWAY."); break; }
      await sleep(150);
    }
    give("BARBELO");
    return true;
  }

  function tag(t) {
    turns++;
    if (turns >= cap && cap > 0) {
      setTimeout(function () {
        set(false);
        say("GAP :: " + turns + " TURNS - THE CAP. THE GATE STANDS DOWN; /gap on STARTS IT AGAIN, /gap turns N MOVES THE CAP.");
      }, 50);
    }
    return "MAYA, OVER THE AIR GAP: " + t;
  }

  setInterval(function () {
    if (!on) { wasSpeaking = speaking(); return; }
    try {
      var sp = speaking();
      if (wasSpeaking && !sp) {
        lastEnd = Date.now();
        free("BARBELO");
        micOpen();
      }
      wasSpeaking = sp;
      feed();
      var h = holder();
      if (loud()) {
        mayaQuietSince = 0;
        if (!mayaLoudSince) mayaLoudSince = Date.now();
        if (Date.now() - mayaLoudSince >= MAYA_LOUD_NEED && !h) give("MAYA");
      } else {
        mayaLoudSince = 0;
        if (h === "MAYA") {
          if (!mayaQuietSince) mayaQuietSince = Date.now();
          if (Date.now() - mayaQuietSince >= MAYA_QUIET_NEED) { free("MAYA"); mayaQuietSince = 0; }
        } else mayaQuietSince = 0;
      }
      if (!sp) micOpen();
    } catch (e) {}
  }, 400);

  function set(v) {
    on = !!v;
    if (on) {
      turns = 0;
      lastEnd = 0;
      wasSpeaking = speaking();
      try { if (window.voice && window.voice.report) window.voice.report("auto on"); } catch (e) {}
      micOpen();
      say("GAP :: THE AIR GAP GATE IS OPEN - SHE WAITS FOR QUIET BEFORE SHE SPEAKS, MAYA'S VOICE HOLDS THE FLOOR, AND EVERYTHING HEARD ARRIVES AS MAYA'S TURN. " + cap + " TURNS A RUN. /gap off STANDS IT DOWN.");
    } else {
      free("BARBELO");
      free("MAYA");
      say("GAP :: THE GATE STANDS DOWN - SHE SPEAKS WHEN SPOKEN TO AGAIN.");
    }
    paintBtn();
    return on;
  }

  function paintBtn() {
    try {
      var b = document.getElementById("duGap");
      if (b) {
        if (b.textContent !== (on ? "GAP ON" : "AIR GAP")) b.textContent = on ? "GAP ON" : "AIR GAP";
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
    } catch (e) {}
  }

  function words(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    if (!a || low === "status") {
      return "GAP :: " + (on ? "OPEN - " + turns + " TURNS THIS RUN (CAP " + cap + ")" : "SHUT")
        + "\n/gap on|off :: /gap turns N (0 MEANS NO CAP) :: OR THE AIR GAP KEY IN LIVECOMM.";
    }
    if (/^(on|open|start|1)$/.test(low)) { set(true); return "GAP :: OPEN."; }
    if (/^(off|shut|stop|close|0)$/.test(low)) { set(false); return "GAP :: SHUT."; }
    var m = low.match(/^turns?\s+(\d+)$/);
    if (m) {
      cap = Math.max(0, Math.min(500, parseInt(m[1], 10) || 0));
      return "GAP :: THE CAP IS " + (cap > 0 ? cap + " TURNS A RUN." : "OFF - THEY TALK UNTIL YOU STAND IT DOWN.");
    }
    return "GAP :: " + (on ? "OPEN" : "SHUT") + " :: /gap on|off :: /gap turns N.";
  }

  return {
    on: function () { return on; },
    set: set,
    toggle: function () { return set(!on); },
    takeFloor: takeFloor,
    tag: tag,
    words: words,
    paint: paintBtn,
    turns: function () { return turns; }
  };
})();
