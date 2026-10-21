var MythosHerald = (function () {
  "use strict";
  var MEM_KEY = "mythos_herald_journal";
  var JOURNAL_MAX = 200;

  function makeJournal(kvFolder, slot) {
    slot = slot || "herald_log";
    if (!kvFolder) {
      var mem = [];
      try { mem = JSON.parse(localStorage.getItem(MEM_KEY) || "[]"); } catch (e) { mem = []; }
      return {
        list: function () { return Promise.resolve(mem.slice()); },
        add: function (e) {
          mem.push(e);
          if (mem.length > JOURNAL_MAX) mem = mem.slice(-JOURNAL_MAX);
          try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch (x) {}
          return Promise.resolve(e);
        }
      };
    }
    return {
      list: function () { return kvFolder.get(slot).catch(function () { return []; }); },
      add: function (e) {
        return kvFolder.get(slot).catch(function () { return []; }).then(function (j) {
          j = Array.isArray(j) ? j : [];
          j.push(e);
          if (j.length > JOURNAL_MAX) j = j.slice(-JOURNAL_MAX);
          return kvFolder.set(slot, j).catch(function () {}).then(function () { return e; });
        });
      }
    };
  }

  function client(opts) {
    opts = opts || {};
    var containerId = opts.containerId || "output";
    var tag = String(opts.tag || "ARCHIVAX").toUpperCase();
    var journal = makeJournal(opts.kvFolder || null, opts.slot);

    function container() { return document.getElementById(containerId); }

    function renderLine(label, text, kind) {
      if (typeof window.print === "function" && !opts.forceLocal) {
        try { window.print(label, text, false, undefined, kind === "backstage" ? { backstage: true } : undefined); return true; }
        catch (e) {}
      }
      var log = container();
      if (!log) return false;
      var entry = document.createElement("div");
      entry.className = "entry" + (kind === "backstage" ? " backstage" : "");
      var msg = document.createElement("div");
      msg.className = "msg";
      var lp = document.createElement("span");
      lp.className = "lbl";
      lp.textContent = label + ": ";
      msg.appendChild(lp);
      msg.appendChild(document.createTextNode(String(text == null ? "" : text)));
      entry.appendChild(msg);
      log.appendChild(entry);
      try { log.scrollTop = log.scrollHeight; } catch (e) {}
      return true;
    }

    function say(text) { return renderLine("SYSTEM", text, "stage"); }
    function backstage(text) { return renderLine("SYSTEM", text, "backstage"); }

    function fmtMs(ms) {
      if (ms < 1000) return ms + "MS";
      return (ms / 1000).toFixed(1) + "S";
    }

    function task(name, fn, terse) {
      var label = tag + " :: " + String(name || "UNTITLED").toUpperCase();
      var t0 = Date.now();
      if (!terse) say(label + " :: STARTED.");
      return Promise.resolve()
        .then(fn)
        .then(function (out) {
          var ms = Date.now() - t0;
          var note = (out !== undefined && out !== null && out !== "") ? " :: " + String(out).toUpperCase().slice(0, 200) : "";
          say(label + " :: DONE IN " + fmtMs(ms) + note);
          return journal.add({ ts: t0, ms: ms, name: String(name || ""), ok: true, note: String(out == null ? "" : out).slice(0, 200) }).then(function () { return out; });
        })
        .catch(function (err) {
          var ms = Date.now() - t0;
          var why = String((err && err.message) || err).toUpperCase().slice(0, 200);
          say(label + " :: FAILED AFTER " + fmtMs(ms) + " :: " + why + " :: NOTHING ELSE WAS TOUCHED.");
          return journal.add({ ts: t0, ms: ms, name: String(name || ""), ok: false, note: why }).then(function () { throw err; });
        });
    }

    function report() {
      return journal.list().then(function (j) {
        if (!j.length) return tag + " :: JOURNAL EMPTY - NOTHING HAS BEEN ASKED OF HER YET.";
        var lines = j.slice(-10).map(function (e) {
          return ((e.ok === false) ? "FAIL " : "OK ") + (e.name || "?") + " " + fmtMs(e.ms || 0);
        });
        return tag + " :: LAST " + lines.length + " OF " + j.length + "\n" + lines.join("\n");
      });
    }

    return { say: say, backstage: backstage, task: task, report: report, journal: function () { return journal.list(); } };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosHerald;
