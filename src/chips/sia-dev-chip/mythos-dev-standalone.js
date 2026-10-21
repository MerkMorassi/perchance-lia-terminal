window.MythosDev = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var FLAG = opts.flag || "lia_dev";
  function SES() {
    if (opts.session) return opts.session;
    try { if (typeof sessionStorage !== "undefined") return sessionStorage; } catch (e) {}
    return null;
  }
  function SAY(t) {
    if (typeof opts.print === "function") { try { opts.print(t); } catch (e) {} return; }
    try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {}
  }
  function on() {
    try {
      var s = SES();
      if (!s) return false;
      var v = (typeof s.get === "function") ? s.get(FLAG) : s.getItem(FLAG);
      return v === "1";
    } catch (e) { return false; }
  }
  function set(v) {
    try {
      var s = SES();
      if (!s) return false;
      if (v) { if (typeof s.set === "function") s.set(FLAG, "1"); else s.setItem(FLAG, "1"); }
      else { if (typeof s.remove === "function") s.remove(FLAG); else s.removeItem(FLAG); }
      return true;
    } catch (e) { return false; }
  }
  function closeDoors() {
    var D = opts.doors || null;
    try { if (D && D.gatekeeper && typeof D.gatekeeper.close === "function") D.gatekeeper.close(); else if (window.gatekeeper && window.gatekeeper.close) window.gatekeeper.close(); } catch (e) {}
    try { if (D && D.agegate && typeof D.agegate.close === "function") D.agegate.close(); else if (window.agegate && window.agegate.close) window.agegate.close(); } catch (e) {}
    function hide(id) {
      if (D && D.els && D.els[id]) { try { D.els[id].hidden = true; } catch (e) {} return; }
      try { var g = document.getElementById(id); if (g) g.hidden = true; } catch (e) {}
    }
    hide("gateKeeper");
    hide("ageGate");
  }
  function status() {
    return "DEVELOPER BYPASS :: " + (on() ? "ON FOR THIS TAB - NEITHER DOOR ASKS, NOTHING IS WRITTEN TO kv, AND CLOSING THE TAB ENDS IT." : "OFF - BOTH DOORS ASK AS NORMAL.")
      + "\n  /dev on OPENS THIS TAB STRAIGHT THROUGH :: /dev off TAKES IT OFF (THE NEXT LOAD ASKS).";
  }
  function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    if (a === "on" || a === "enable" || a === "start" || a === "yes") {
      if (!set(true)) { SAY("DEVELOPER BYPASS :: THIS BROWSER REFUSED THE SESSION FLAG - THE DOORS STAND."); return "REFUSED"; }
      closeDoors();
      SAY("DEVELOPER BYPASS :: ON FOR THIS TAB. BOTH DOORS ARE STOOD DOWN - NEITHER ANSWER IS WRITTEN ANYWHERE, AND THE NEXT LOAD IN THIS TAB WALKS STRAIGHT THROUGH UNTIL THE TAB CLOSES. /dev off ENDS IT.");
      return "ON";
    }
    if (a === "off" || a === "disable" || a === "stop" || a === "end" || a === "no") {
      set(false);
      SAY("DEVELOPER BYPASS :: OFF. THIS PAGE STAYS AS IT IS - THE NEXT LOAD ASKS AT BOTH DOORS.");
      return "OFF";
    }
    SAY(status());
    return on() ? "ON" : "OFF";
  }
  return {
    on: on,
    set: set,
    enable: function () { set(true); closeDoors(); },
    disable: function () { set(false); },
    closeDoors: closeDoors,
    status: status,
    command: command
  };
}
return { client: client };
})();
