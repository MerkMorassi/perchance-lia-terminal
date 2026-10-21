window.MythosAutonomyMode = (function () {
  "use strict";

  var MODES = ["MANUAL", "SEMI", "AUTO"];

  function str(s) { return String(s == null ? "" : s); }
  function upper(s) { return str(s).toUpperCase(); }

  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }

  function describe(mode) {
    if (mode === "AUTO") return "AUTO :: SHE ACTS ON HER OWN INSIDE THE GRANT ENVELOPE (VERBS, COUNT, SPEND, EXPIRY) AND REPORTS AFTER. OUTSIDE IT SHE ASKS.";
    if (mode === "MANUAL") return "MANUAL :: SHE ACTS ONLY WHEN SPOKEN TO OR PRESSED. NO PROPOSALS, NO UNSUPERVISED ACTS - THE QUIETEST POSTURE.";
    return "SEMI :: SHE DRAFTS AND PROPOSES, HE GRANTS. NOTHING GOES OUT ON ITS OWN - EVERY ACT WAITS FOR A YES.";
  }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var mode = "SEMI";
    var grants = [];
    var pending = [];
    var audit = [];
    var seq = 0;

    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }

    function persist() {
      try { store.save({ mode: mode, grants: grants, pending: pending, audit: audit.slice(-200), seq: seq }); }
      catch (e) {}
    }

    async function load() {
      try {
        var d = await store.load();
        if (d && typeof d === "object") {
          if (MODES.indexOf(d.mode) !== -1) mode = d.mode;
          if (Array.isArray(d.grants)) grants = d.grants;
          if (Array.isArray(d.pending)) pending = d.pending;
          if (Array.isArray(d.audit)) audit = d.audit;
          if (typeof d.seq === "number") seq = d.seq;
        }
      } catch (e) { say("REGIME UNREADABLE :: STARTING SEMI WITH A CLEAN SLATE."); }
      return { ok: true, mode: mode, text: describe(mode) };
    }

    function log(verb, how, detail) {
      audit.push({ ts: Date.now(), verb: verb, how: how, detail: str(detail || "").slice(0, 200) });
      if (audit.length > 200) audit = audit.slice(-200);
      persist();
    }

    function set(name) {
      var want = upper(name);
      if (MODES.indexOf(want) === -1) return { ok: false, error: "NO SUCH POSTURE :: MANUAL, SEMI, OR AUTO. SHE STANDS AT " + mode + "." };
      if (want === mode) return { ok: true, already: true, mode: mode, text: "SHE ALREADY STANDS AT " + mode + " :: " + describe(mode) };
      var was = mode;
      mode = want;
      if (want !== "AUTO") grants = [];
      if (want === "MANUAL") pending = [];
      persist();
      say("REGIME :: " + was + " -> " + want + "." + (want === "MANUAL" ? " PROPOSALS DROPPED - NOTHING WAITS." : ""));
      return { ok: true, mode: mode, was: was, text: describe(mode) };
    }

    function grantEnvelope(e) {
      e = e || {};
      var verbs = (Array.isArray(e.verbs) ? e.verbs : []).map(function (v) { return str(v).toLowerCase(); }).filter(Boolean);
      if (!verbs.length) return { ok: false, error: "A GRANT NAMES ITS VERBS :: grant({ verbs: [\"speak\", \"tag\"], max: 10 })." };
      var g = {
        verbs: verbs,
        max: Math.max(1, Number(e.max) || 1),
        used: 0,
        spend: Math.max(0, Number(e.spend) || 0),
        spent: 0,
        until: Number(e.until) || 0
      };
      grants.push(g);
      persist();
      return { ok: true, grant: g, text: "GRANTED :: " + verbs.join(", ") + " :: " + g.max + " ACTS" + (g.spend ? ", SPEND " + g.spend : "") + (g.until ? ", UNTIL " + new Date(g.until).toISOString() : ", NO EXPIRY") + ". SHE REPORTS EVERY ONE AFTER." };
    }

    function live(g) {
      if (g.used >= g.max) return false;
      if (g.until && Date.now() > g.until) return false;
      return true;
    }

    function may(verb, cost) {
      verb = str(verb).toLowerCase();
      if (mode === "MANUAL") return { ok: false, error: "MANUAL :: ASK HER STRAIGHT - SHE TAKES NOTHING ON HER OWN." };
      if (mode === "SEMI") return { ok: false, error: "SEMI :: SHE PROPOSES, YOU GRANT - propose() HOLDS IT FOR A YES." };
      for (var i = 0; i < grants.length; i++) {
        var g = grants[i];
        if (g.verbs.indexOf(verb) === -1) continue;
        if (!live(g)) continue;
        if (cost && g.spend && g.spent + Number(cost) > g.spend) continue;
        return { ok: true, grant: i };
      }
      return { ok: false, error: "NO LIVE GRANT FOR \"" + verb + "\" :: grant() WRITES ONE, OR DROP HER TO SEMI AND LET HER ASK." };
    }

    function spend(gi, cost) {
      var g = grants[gi];
      if (!g) return;
      g.used++;
      if (cost) g.spent += Number(cost) || 0;
      persist();
    }

    function propose(verb, detail) {
      verb = str(verb).toLowerCase();
      if (!verb) return { ok: false, error: "PROPOSE WHAT? :: propose(\"speak\", \"the draft\")." };
      if (mode === "MANUAL") return { ok: false, error: "MANUAL :: NO PROPOSALS - ASK HER STRAIGHT." };
      if (mode === "AUTO") {
        var chk = may(verb, 0);
        if (!chk.ok) return chk;
        spend(chk.grant, 0);
        seq++;
        log(verb, "auto", detail);
        return { ok: true, approved: true, id: "a" + seq, text: "AUTO :: \"" + verb + "\" WENT ON A LIVE GRANT. IT IS IN THE AUDIT." };
      }
      seq++;
      var p = { id: "p" + seq, verb: verb, detail: str(detail || "").slice(0, 500), ts: Date.now() };
      pending.push(p);
      persist();
      say("PROPOSED :: \"" + verb + "\" WAITS FOR A YES (grant(\"" + p.id + "\") / deny(\"" + p.id + "\")).");
      return { ok: true, approved: false, id: p.id, text: "HELD FOR A YES :: \"" + verb + "\"." };
    }

    function decide(id, yes) {
      for (var i = 0; i < pending.length; i++) {
        if (pending[i].id !== id) continue;
        var p = pending.splice(i, 1)[0];
        log(p.verb, yes ? "granted" : "denied", p.detail);
        persist();
        return yes
          ? { ok: true, approved: true, proposal: p, text: "GRANTED :: \"" + p.verb + "\" MAY GO." }
          : { ok: true, approved: false, proposal: p, text: "DENIED :: \"" + p.verb + "\" GOES NOWHERE. IT STAYS IN THE AUDIT." };
      }
      return { ok: false, error: "NOTHING WAITS UNDER \"" + str(id) + "\" :: pending() LISTS WHAT DOES." };
    }

    function revoke() {
      var n = grants.length;
      grants = [];
      persist();
      return { ok: true, text: n ? "GRANTS TORN UP :: " + n + " ENVELOPE" + (n === 1 ? "" : "S") + " DEAD. SHE ASKS FROM HERE." : "THERE WERE NO GRANTS TO TEAR UP." };
    }

    return {
      load: load, set: set,
      mode: function () { return mode; },
      describe: function () { return describe(mode); },
      grant: grantEnvelope, may: may, revoke: revoke,
      liveGrants: function () { return grants.filter(live).length; },
      propose: propose,
      grantProposal: function (id) { return decide(str(id), true); },
      deny: function (id) { return decide(str(id), false); },
      pending: function () { return pending.slice(); },
      audit: function () { return audit.slice(); }
    };
  }

  return { client: client, MODES: MODES.slice() };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosAutonomyMode;
