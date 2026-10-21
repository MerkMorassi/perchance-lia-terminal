var MythosHeraldWiring = (function () {
  "use strict";

  function cssText(containerId) {
    var id = String(containerId || "output");
    return "#" + id + " .entry{display:contents}\n" +
      "#" + id + " .entry>.msg{align-self:center;background:transparent;border:1px dashed #30363d;font-size:12px;opacity:.7;border-radius:16px;padding:10px 14px;line-height:1.45;max-width:75%;white-space:pre-wrap;overflow-wrap:anywhere}\n" +
      "#" + id + " .entry.backstage>.msg{opacity:.45}\n" +
      "#" + id + " .entry .lbl{font-weight:700}";
  }

  // opts: containerId, tag, kvGet(k)->Promise, kvSet(k,v)->Promise,
  //       slot, scroll(), onLine(text). Needs window.MythosHerald loaded.
  function boot(opts) {
    opts = opts || {};
    if (!window.MythosHerald) throw new Error("MythosHerald not loaded");
    var containerId = opts.containerId || "output";
    var herald = window.MythosHerald.client({
      containerId: containerId,
      tag: opts.tag || "HERALD",
      kvFolder: (opts.kvGet && opts.kvSet) ? { get: opts.kvGet, set: opts.kvSet } : null,
      slot: opts.slot || "herald_log",
      forceLocal: true
    });
    var log = function () { try { return document.getElementById(containerId); } catch (e) { return null; } };
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
      }).observe(log(), { childList: true });
    } catch (e) {}
    function backstage(name, fn, terse) {
      return herald.task(name, fn, terse);
    }
    function journalSay() {
      return herald.report().then(function (rep) { herald.say(rep); });
    }
    return { herald: herald, backstage: backstage, journalSay: journalSay, cssText: cssText };
  }

  return { boot: boot, cssText: cssText };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosHeraldWiring;
