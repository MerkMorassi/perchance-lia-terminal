window.MythosHeraldWiring = (function () {
  "use strict";
  function fmtMs(ms) {
    if (ms < 1000) return ms + "MS";
    return (ms / 1000).toFixed(1) + "S";
  }
  function reader(opts, slot) {
    if (opts.kvGet) {
      return function () {
        return opts.kvGet(slot).catch(function () { return []; }).then(function (j) {
          return Array.isArray(j) ? j : [];
        });
      };
    }
    var KEY = "mythos_herald_journal";
    return function () {
      var j = [];
      try { j = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (x) { j = []; }
      return Promise.resolve(Array.isArray(j) ? j : []);
    };
  }
  function writer(opts, slot) {
    if (opts.kvGet && opts.kvSet) {
      return function (e) {
        return opts.kvGet(slot).catch(function () { return []; }).then(function (j) {
          j = Array.isArray(j) ? j : [];
          j.push(e);
          if (j.length > 200) j = j.slice(-200);
          return opts.kvSet(slot, j).catch(function () {});
        });
      };
    }
    var KEY = "mythos_herald_journal";
    return function (e) {
      var j = [];
      try { j = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (x) { j = []; }
      if (!Array.isArray(j)) j = [];
      j.push(e);
      if (j.length > 200) j = j.slice(-200);
      try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (x) {}
      return Promise.resolve(e);
    };
  }
  function cssText(containerId) {
    var id = String(containerId || "output");
    return "#" + id + " .entry{display:contents}\n" +
      "#" + id + " .entry>.msg{align-self:center;background:transparent;border:1px dashed #30363d;font-size:12px;opacity:.7;border-radius:16px;padding:10px 14px;line-height:1.45;max-width:75%;white-space:pre-wrap;overflow-wrap:anywhere}\n" +
      "#" + id + " .entry.backstage>.msg{opacity:.45}\n" +
      "#" + id + " .entry .lbl{font-weight:700}";
  }
  function client(opts) {
    opts = opts || {};
    if (!window.MythosHerald) throw new Error("HERALD WIRING REFUSED :: MythosHerald is not loaded - add its script tag first.");
    var containerId = opts.containerId || "output";
    var el = null;
    try { el = document.getElementById(containerId); } catch (e) { el = null; }
    if (!el) throw new Error("HERALD WIRING REFUSED :: no container #" + containerId + " - lines would have nowhere to land.");
    var tag = String(opts.tag || "HERALD").toUpperCase();
    var slot = opts.slot || "herald_log";
    var hush = !!opts.hush;
    var write = writer(opts, slot);
    var read = reader(opts, slot);
    function report() {
      return read().then(function (j) {
        if (!j.length) return tag + " :: JOURNAL EMPTY - NOTHING HAS BEEN ASKED OF HER YET.";
        var lines = j.slice(-10).map(function (e) {
          return ((e.ok === false) ? "FAIL " : "OK ") + (e.name || "?") + " " + fmtMs(e.ms || 0);
        });
        return tag + " :: LAST " + lines.length + " OF " + j.length + "\n" + lines.join("\n");
      });
    }
    var herald = window.MythosHerald.client({
      containerId: containerId,
      tag: opts.tag || "HERALD",
      kvFolder: (opts.kvGet && opts.kvSet) ? { get: opts.kvGet, set: opts.kvSet } : null,
      slot: slot,
      forceLocal: true
    });
    try {
      new MutationObserver(function (muts) {
        var seen = false;
        for (var i = 0; i < muts.length; i++) {
          var nodes = muts[i].addedNodes || [];
          for (var j = 0; j < nodes.length; j++) {
            var n = nodes[j];
            if (n && n.nodeType === 1 && n.classList && n.classList.contains("entry")) {
              seen = true;
              if (opts.onLine) { try { opts.onLine(n.textContent); } catch (e) {} }
            }
          }
        }
        if (seen && opts.scroll) { try { opts.scroll(); } catch (e) {} }
      }).observe(el, { childList: true });
    } catch (e) {}
    function backstage(name, fn, terse) {
      if (!hush) return herald.task(name, fn, terse);
      var t0 = Date.now(), nm = String(name || "UNTITLED");
      return Promise.resolve().then(fn).then(function (out) {
        return write({ ts: t0, ms: Date.now() - t0, name: nm, ok: true, note: String(out == null ? "" : out).slice(0, 200) }).then(function () { return out; });
      }).catch(function (err) {
        var ms = Date.now() - t0, why = String((err && err.message) || err).slice(0, 200);
        return write({ ts: t0, ms: ms, name: nm, ok: false, note: why }).then(function () {
          herald.say(tag + " :: " + nm.toUpperCase() + " :: FAILED AFTER " + fmtMs(ms) + " :: " + why.toUpperCase().slice(0, 200) + " :: NOTHING ELSE WAS TOUCHED.");
          throw err;
        });
      });
    }
    function journalSay() {
      return report().then(function (rep) { herald.say(rep); });
    }
    return { herald: herald, backstage: backstage, journal: read, report: report, journalSay: journalSay, cssText: cssText };
  }
  return { client: client, cssText: cssText };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosHeraldWiring;
