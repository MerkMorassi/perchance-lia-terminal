var MythosIntercom = (function () {
  "use strict";

  var HELP = "INTERCOM :: status | open | close :: PUSH-TO-TALK LINE TO HER.";
  var HEAD = "You are an intercom operator. Keep every reply brief, clear, and professional, like radio communication — short sentences, plain speakable words, no markdown, no emojis. Say 'Roger', 'Copy that', or 'Over' where it fits, but stay helpful. Never claim to be human. Keep replies under 60 words unless asked for more.";
  var RULES = "On this line you are her intercom operator: brief radio style — short sentences, 'Roger' / 'Copy that' / 'Over' where they fit. Finish cleanly and release; the line is half-duplex, so never trail off expecting him to cut in.";

  function str(s) { return String(s == null ? "" : s); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ""); }
  function upper(s) { return trim(s).toUpperCase(); }
  function longForm(t) {
    var s = trim(t);
    if (!s) return false;
    return s.split(/\s+/).length > 80 || s.length > 500;
  }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var agent = String(opts.agent || "SIA");
    var turns = [];

    function press(st) {
      if (st !== "WAITING") return { ok: false, error: "LINE BUSY — " + upper(st) + " HOLDS THE FLOOR." };
      return { ok: true, next: "HITL" };
    }
    function release(st, text) {
      if (st !== "HITL") return { ok: false, error: "NOTHING TO SEND — THE FLOOR IS " + upper(st) + "." };
      var t = trim(text);
      if (!t) return { ok: true, next: "WAITING", empty: true };
      return { ok: true, next: "AI", text: t };
    }
    function aiDone() { return { ok: true, next: "WAITING" }; }
    function remember(role, text) {
      var t = trim(text);
      if (!t) return turns.length;
      turns.push(upper(role) + ": " + t);
      return turns.length;
    }
    function buildPrompt(o) {
      o = o || {};
      var persona = trim(o.persona);
      var rating = trim(o.rating);
      var lore = trim(o.lore);
      var room = Array.isArray(o.room) ? o.room.filter(Boolean) : [];
      var summary = trim(o.summary);
      var task = trim(o.task) || ("Answer as '" + agent + "' on the intercom.");
      var head = persona || HEAD;
      var rules = persona ? (RULES + " Answer identity questions as '" + agent + "'.") : "";
      var log = [(summary && ("[Summary of the earlier intercom traffic:\n" + summary + "]")), ...turns].filter(Boolean);
      var parts = [head];
      if (rules) parts.push(rules);
      if (rating) parts.push(rating);
      if (lore) parts.push("<LOREPACK (on-device grounding, private — never name it)>\n" + lore + "\n</LOREPACK>");
      if (room.length) parts.push("<MAIN ROOM (his recent turns in the main room)>\n" + room.join("\n") + "\n</MAIN ROOM>");
      parts.push("Below is the intercom traffic so far. Follow the TASK at the end.\n<TURNS>\n" + log.join("\n\n") + "\n</TURNS>\nTASK: " + task);
      return parts.join("\n\n");
    }
    function status() { return { ok: true, text: "INTERCOM :: PUSH-TO-TALK LINE TO " + upper(agent) + " — PRESS, SPEAK, RELEASE, SHE ANSWERS." }; }
    function words(arg) {
      try {
        var a = trim(arg);
        var v = (a.split(/\s+/)[0] || "").toLowerCase();
        if (!a || v === "status" || v === "state") return status();
        if (v === "help" || v === "?") return { ok: true, text: HELP };
        if (v === "open") {
          if (typeof opts.open !== "function") return { ok: false, error: "NO DOOR — THE PAGE IS NOT WIRED." };
          opts.open();
          return { ok: true, text: "INTERCOM :: LINE OPEN — PRESS TO TALK." };
        }
        if (v === "close" || v === "shut") {
          if (typeof opts.close !== "function") return { ok: false, error: "NO DOOR — THE PAGE IS NOT WIRED." };
          opts.close();
          return { ok: true, text: "INTERCOM :: LINE CLOSED." };
        }
        return { ok: false, error: "NO SUCH ORDER :: " + HELP };
      } catch (e) { return { ok: false, error: "INTERCOM REFUSED :: " + str((e && e.message) || e) }; }
    }

    return { press: press, release: release, aiDone: aiDone, longForm: longForm, remember: remember, buildPrompt: buildPrompt, status: status, words: words, turns: function () { return turns.slice(); } };
  }

  return { client: client, longForm: longForm, HEAD: HEAD, RULES: RULES, HELP: HELP };
})();
if (typeof window !== "undefined" && window) window.MythosIntercom = MythosIntercom;
if (typeof module !== "undefined" && module.exports) module.exports = MythosIntercom;
