window.FloorMachine = (function () {
  "use strict";
  var ORDER = ["BARBELO", "MAYA", "OPERATOR"];
  function mk(opts) {
    opts = opts || {};
    var T = {
      barbQuiet: opts.barbQuiet != null ? opts.barbQuiet : 4000,
      mayaEnd: opts.mayaEnd != null ? opts.mayaEnd : 2500,
      mayaCap: opts.mayaCap != null ? opts.mayaCap : 45000,
      opCap: opts.opCap != null ? opts.opCap : 120000,
      mayaHot: opts.mayaHot != null ? opts.mayaHot : 0.03
    };
    var s = {
      live: false, floor: "STANDBY", floorSince: 0,
      heard: false, lastVoice: 0,
      youMute: false, mayaMute: false, mayaMon: true
    };
    function setFloor(who, now) {
      s.floor = who;
      s.floorSince = now || Date.now();
      s.heard = false;
      s.lastVoice = 0;
      return s.floor;
    }
    function next(now) {
      if (!s.live) return s.floor;
      var i = ORDER.indexOf(s.floor);
      return setFloor(ORDER[(i + 1) % ORDER.length], now);
    }
    function tick(now, sig) {
      if (!s.live) return s.floor;
      sig = sig || {};
      if (s.floor === "BARBELO") {
        if (sig.barb === "HER VOICE") { s.heard = true; }
        else if (s.heard) { next(now); }
        else if (now - s.floorSince > T.barbQuiet) { next(now); }
      } else if (s.floor === "MAYA") {
        var lv = Number(sig.maya) || 0;
        if (lv > T.mayaHot) { s.heard = true; s.lastVoice = now; }
        else if (s.heard && now - s.lastVoice > T.mayaEnd) { next(now); }
        else if (now - s.floorSince > T.mayaCap) { next(now); }
      } else if (s.floor === "OPERATOR") {
        if (sig.answered) { next(now); }
        else if (now - s.floorSince > T.opCap) { next(now); }
      }
      return s.floor;
    }
    function micLive() {
      return !!(s.live && s.floor === "OPERATOR" && !s.youMute);
    }
    function mayaAudible() {
      return !!(s.live && s.floor === "MAYA" && s.mayaMon && !s.mayaMute);
    }
    function go(now) {
      s.live = true;
      setFloor("BARBELO", now);
      return s.floor;
    }
    function stand() {
      s.live = false;
      s.floor = "STANDBY";
      s.heard = false;
      return s.floor;
    }
    return {
      state: s, timeouts: T, order: ORDER.slice(),
      setFloor: setFloor, next: next, tick: tick,
      micLive: micLive, mayaAudible: mayaAudible,
      go: go, stand: stand
    };
  }
  return { create: mk, ORDER: ORDER.slice() };
})();
