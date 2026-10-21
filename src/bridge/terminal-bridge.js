var SiaTerminal = (function () {
  "use strict";
  var peer = null;
  var peerOrigin = null;
  var seq = 0;
  var waiting = {};
  var onReceipt = null;
  var surface = null;

  function sendRaw(msg, origin) {
    if (!peer) return false;
    try { peer.postMessage(msg, origin || peerOrigin || "*"); return true; }
    catch (e) { return false; }
  }

  function onMessage(e) {
    var d = e.data;
    if (!d || typeof d !== "object" || d.k !== "sia") return;
    if (peer && e.source !== peer) return;
    if (d.ready === 1) {
      if (d.receipts !== false) onReceipt && onReceipt("READY :: " + (d.surface || "?"));
      for (var k in waiting) {
        try { waiting[k].resolve(d); } catch (x) {}
      }
      waiting = {};
      return;
    }
    if (d.token != null && waiting[d.token]) {
      var w = waiting[d.token];
      delete waiting[d.token];
      try { w.resolve(d); } catch (x) {}
      return;
    }
    if (d.receipt != null && onReceipt) {
      try { onReceipt(String(d.receipt)); } catch (x) {}
    }
  }

  if (typeof window !== "undefined") window.addEventListener("message", onMessage);

  return {
    connect: function (url, name) {
      var w = null;
      try { w = window.open(url, name || "sia_terminal"); } catch (e) { w = null; }
      if (!w) return false;
      peer = w;
      try { peerOrigin = new URL(url).origin; } catch (e) { peerOrigin = "*"; }
      sendRaw({ k: "sia", hello: 1 });
      return true;
    },
    attach: function (win, origin) {
      peer = win;
      peerOrigin = origin || "*";
      sendRaw({ k: "sia", hello: 1 });
      return true;
    },
    linked: function () { return !!peer && !peer.closed; },
    run: function (cmd) {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.linked()) { resolve({ k: "sia", ok: false, receipt: "NOT LINKED" }); return; }
        var token = "t" + (++seq) + "-" + Date.now().toString(36);
        waiting[token] = { resolve: resolve };
        if (!sendRaw({ k: "sia", terminal: String(cmd), token: token })) {
          delete waiting[token];
          resolve({ k: "sia", ok: false, receipt: "SEND FAILED" });
        }
        setTimeout(function () {
          if (waiting[token]) {
            delete waiting[token];
            resolve({ k: "sia", ok: false, receipt: "NO ANSWER" });
          }
        }, 8000);
      });
    },
    receipts: function (fn) { onReceipt = (typeof fn === "function") ? fn : null; },
    loadSurface: function (url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      }).then(function (j) {
        surface = j;
        return j;
      });
    },
    commands: function () {
      if (!surface || !surface.commands) return [];
      return surface.commands.map(function (c) { return c.say; });
    }
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SiaTerminal;
