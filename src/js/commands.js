(function () {
  "use strict";

  /* THE SLASH COMMANDS, AS A LIST - now read through the shipped chip.
     src/commands/commands.json is still the list; MythosCommands (src/chips/sia-commands-chip)
     is the reader. Everything below this line is the terminal's own contract: window.cmd's keys,
     and the exact strings her prompt, the stage and the cheatsheet already carry. */

  var MANIFEST = "src/commands/commands.json";
  var delegate = null;
  var report = null;

  function chip() {
    if (!delegate) {
      if (!window.MythosCommands) throw new Error("THE COMMAND CHIP IS NOT LOADED (src/chips/sia-commands-chip/mythos-commands-standalone.js)");
      delegate = window.MythosCommands.client({ manifest: MANIFEST });
    }
    return delegate;
  }

  async function load() {
    report = { loaded: false, count: 0, failed: "" };
    try {
      var r = await chip().load();
      if (r && r.ok) {
        report.loaded = true;
        report.count = r.count;
      } else {
        report.failed = String((r && r.error) || "UNKNOWN FAILURE");
        console.warn("the slash command list could not be read", report.failed);
      }
    } catch (e) {
      report.failed = String((e && e.message) ? e.message : e);
      console.warn("the slash command list could not be read", e);
    }
    return report;
  }

  function all() { return chip().all(); }
  function count() { return chip().count(); }
  function get(id) { return chip().get(id); }
  function match(text) { return chip().match(text); }
  function liaOf(text) { return chip().liaOf(text); }

  function block() {
    var commands = chip().all();
    if (!commands.length) return "";
    var lines = commands.map(function (c) {
      return "- " + c.usage + (c.kind === "lia" ? "  [YOURS - he is asking YOU]" : "") + " :: " + (c.desc || "");
    });
    return "PATRIKIOS'S COMMANDS. He can type these to the terminal; the ones marked [YOURS] are his way of asking YOU for something, and they arrive as a message with the command line still in front of it - do what that command's meaning says. The others are carried out by the machine and you never see them as a message.\n"
      + lines.join("\n");
  }

  function listText() {
    var commands = chip().all();
    if (!commands.length) {
      return "SLASH COMMANDS :: THE LIST COULD NOT BE READ (" + ((report && report.failed) || "NOT LOADED YET") + ").\nIT LIVES IN " + MANIFEST + ".";
    }
    var term = commands.filter(function (c) { return c.kind === "terminal"; });
    var lia = commands.filter(function (c) { return c.kind === "lia"; });
    var lines = ["SLASH COMMANDS (" + commands.length + ") :: THE LIST LIVES IN " + MANIFEST + " - ADD ONE THERE AND IT APPEARS HERE, IN THE SYSTEM PANEL, AND IN WHAT SHE IS TOLD."];
    function row(c) {
      var g = chip().gloss(c);
      var u = "  " + c.usage;
      if (u.length <= 34) return [u + new Array(Math.max(1, 35 - u.length)).join(" ") + g];
      return [u].concat(["        " + g]);
    }
    lines.push("");
    lines.push("CARRIED OUT BY THE TERMINAL");
    term.forEach(function (c) { row(c).forEach(function (l) { lines.push(l); }); });
    if (lia.length) {
      lines.push("");
      lines.push("SHE ANSWERS THESE HERSELF");
      lia.forEach(function (c) { row(c).forEach(function (l) { lines.push(l); }); });
    }
    lines.push("");
    lines.push("THE WHOLE TEXT OF ANY ONE :: /rtfm <COMMAND>  \u00b7  THE CHEATSHEET AS A DOCUMENT :: /rtfm cheatsheet");
    return lines.join("\n");
  }

  function status() {
    if (!report) return "SLASH COMMANDS :: NOT READ YET";
    if (!report.loaded) return "SLASH COMMANDS :: UNREADABLE (" + report.failed + ")";
    return "SLASH COMMANDS :: " + report.count + " FROM " + MANIFEST;
  }

  window.cmd = {
    load: load,
    all: all,
    get: get,
    match: match,
    liaOf: liaOf,
    block: block,
    listText: listText,
    status: status,
    count: count,
  };
})();
