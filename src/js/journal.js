(function () {
  "use strict";

  var TICK = 60000;

  var lane = null;

  function kv() { return (window.root && window.root.kv && window.root.kv.lia_journal) || null; }
  function say(t) { try { print("SYSTEM", t); } catch (e) {} }
  function stamp(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    return null;
  }

  function ready() {
    if (lane) return lane;
    if (!window.MythosJournal || typeof window.MythosJournal.client !== "function") return null;
    lane = window.MythosJournal.client({
      kvFolder: kv(), slot: "journal",
      say: function (t) { say(t); },
      stamp: function (ts) { return stamp(ts); }
    });
    return lane;
  }

  async function command(rest) {
    var c = ready();
    if (!c) { say("THE JOURNAL MODULE IS OFFLINE (THE JOURNAL CHIP IS NOT LOADED)."); return { ok: false }; }
    await c.load();
    var r = null;
    try { r = await c.words(rest); }
    catch (e) { say("THE JOURNAL COULD NOT BE WRITTEN :: " + ((e && e.message) || e)); return { ok: false }; }
    if (r && r.action === "download") {
      try {
        var blob = new Blob([r.json], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} try { a.remove(); } catch (e2) {} }, 4000);
        say("THE JOURNAL IS ON ITS WAY DOWN :: " + r.filename + " - LINES AND MINUTES, RAW.");
      } catch (e) { say("THE EXPORT WOULD NOT LEAVE :: " + String((e && e.message) || e).toUpperCase()); }
      return { ok: true };
    }
    if (r && r.text) say(r.text);
    return { ok: !!(r && r.ok) };
  }

  function describe() {
    var base = null;
    try { base = ready() ? ready().describe() : ""; } catch (e) { base = ""; }
    return (base || "THE JOURNAL :: A PRIVATE LOG - RAW LINES, TAGS, AND MINUTES ON A BEAT.")
      + "\n/journal <anything, #tags ride inside> FILES THE LINE - e.g. /journal the frame finally plays clips #frame #win :: /journal brief [N] READS THE AGENT'S HANDOFF"
      + "\nKEPT IN THIS BROWSER (kv: lia_journal) - NEVER IN src/, NEVER SENT ANYWHERE, NEVER READ BY HER. /journal wipe yes EMPTIES IT.";
  }

  async function tick() {
    try {
      var c = ready();
      if (!c) return;
      if (typeof document !== "undefined" && document.hidden) return;
      await c.load();
      await c.tick();
    } catch (e) { console.warn("journal tick failed", e); }
  }

  function start() {
    try {
      window.setInterval(function () { try { tick(); } catch (e) {} }, TICK);
      window.setTimeout(function () { try { tick(); } catch (e) {} }, 12000);
      // THE AGENT'S HYDRATION. The editor's agent arrives with no memory of this browser,
      // but its first page read carries the console - so a non-empty journal announces its
      // handoff there, once per boot, where the agent cannot miss it. Chat stays silent.
      var c = ready();
      if (c) c.load().then(function () {
        try {
          var b = c.briefing(5, 2500);
          if (b && b.lines > 0) console.log(b.text);
        } catch (e) {}
      });
    } catch (e) {}
  }

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  window.journal = { command: command, describe: describe, tick: tick };
})();
