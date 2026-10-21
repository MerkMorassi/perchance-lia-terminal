window.MythosAutonomyGate = (function () {
  "use strict";

  function str(s) { return String(s == null ? "" : s); }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var regime = opts.regime || null;
    var checker = opts.checker || null;

    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }

    function ready() {
      if (!regime || typeof regime.propose !== "function") return "NO REGIME - PASS THE AUTONOMY-MODE CLIENT.";
      if (!checker || typeof checker.check !== "function") return "NO CHECKER - PASS THE AUTONOMY REPLY-CHECKER.";
      return null;
    }

    function vet(draft) {
      if (!str(draft).trim()) return null;
      var bad = checker.check(draft);
      if (bad && bad.length) {
        return { ok: false, held: true, reasons: bad, text: "DRAFT HELD :: " + bad.map(function (b) { return b.why; }).join(" ") + " :: FIX IT OR DROP IT - NO GRANT WAS SPENT AND NOTHING WAITS." };
      }
      return null;
    }

    function act(verb, draft, detail, cost) {
      try {
        var r = ready(); if (r) return { ok: false, error: r };
        var stop = vet(draft);
        if (stop) return stop;
        return regime.propose(verb, detail !== undefined ? detail : draft);
      } catch (e) {
        return { ok: false, error: "GATE REFUSED :: " + str((e && e.message) || e) };
      }
    }

    function grant(id, draft) {
      try {
        var r = ready(); if (r) return { ok: false, error: r };
        if (str(draft).trim()) {
          var stop = vet(draft);
          if (stop) { stop.text += " THE PROPOSAL STAYS WAITING - FIX THE DRAFT AND GRANT AGAIN."; return stop; }
        }
        return regime.grantProposal(id);
      } catch (e) {
        return { ok: false, error: "GATE REFUSED :: " + str((e && e.message) || e) };
      }
    }

    function status() {
      var r = ready(); if (r) return { ok: false, error: r };
      return { ok: true, mode: regime.mode(), pending: regime.pending().length, liveGrants: regime.liveGrants() };
    }

    return { act: act, grant: grant, deny: function (id) { return regime ? regime.deny(id) : { ok: false, error: "NO REGIME." }; }, status: status };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosAutonomyGate;
