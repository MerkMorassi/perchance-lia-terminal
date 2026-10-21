(function () {
  "use strict";

  var FLAG = "lia_dev";

  function on() {
    try { return sessionStorage.getItem(FLAG) === "1"; }
    catch (e) { return false; }
  }

  function set(v) {
    try {
      if (v) sessionStorage.setItem(FLAG, "1");
      else sessionStorage.removeItem(FLAG);
      return true;
    } catch (e) { return false; }
  }

  function closeDoors() {
    try { if (window.gatekeeper && window.gatekeeper.close) window.gatekeeper.close(); } catch (e) {}
    try { if (window.agegate && window.agegate.close) window.agegate.close(); } catch (e) {}
    try {
      var g = document.getElementById("gateKeeper");
      if (g) g.hidden = true;
      var a = document.getElementById("ageGate");
      if (a) a.hidden = true;
    } catch (e) {}
  }

  function status() {
    return "DEVELOPER BYPASS :: " + (on() ? "ON FOR THIS TAB - NEITHER DOOR ASKS, NOTHING IS WRITTEN TO kv, AND CLOSING THE TAB ENDS IT." : "OFF - BOTH DOORS ASK AS NORMAL.")
      + "\n  /dev on OPENS THIS TAB STRAIGHT THROUGH :: /dev off TAKES IT OFF (THE NEXT LOAD ASKS).";
  }

  function command(arg) {
    var a = String(arg == null ? "" : arg).trim().toLowerCase();
    function say(t) { try { if (typeof print === "function") print("SYSTEM", t); } catch (e) {} }
    if (a === "on" || a === "enable" || a === "start" || a === "yes") {
      if (!set(true)) { say("DEVELOPER BYPASS :: THIS BROWSER REFUSED THE SESSION FLAG - THE DOORS STAND."); return; }
      closeDoors();
      say("DEVELOPER BYPASS :: ON FOR THIS TAB. PRIAPOS AND THE 18+ DOOR ARE STOOD DOWN - NEITHER ANSWER IS WRITTEN ANYWHERE, AND THE NEXT LOAD IN THIS TAB WALKS STRAIGHT THROUGH UNTIL THE TAB CLOSES. /dev off ENDS IT.");
      return;
    }
    if (a === "off" || a === "disable" || a === "stop" || a === "end" || a === "no") {
      set(false);
      say("DEVELOPER BYPASS :: OFF. THIS PAGE STAYS AS IT IS - THE NEXT LOAD ASKS AT BOTH DOORS.");
      return;
    }
    say(status());
  }

  window.dev = { on: on, enable: function () { set(true); closeDoors(); }, disable: function () { set(false); }, closeDoors: closeDoors, status: status, command: command };
})();
