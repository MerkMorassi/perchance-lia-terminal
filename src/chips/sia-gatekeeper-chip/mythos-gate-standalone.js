var MythosGate = (function () {
  "use strict";
  var ABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  var SESSION_MS = 8 * 60 * 60 * 1000;
  var MEM_KEY = "mythos_gatekeeper";

  function makeStore(opts) {
    opts = opts || {};
    var kvFolder = opts.kvFolder || null;
    var slot = opts.slot || "gatekeeper";
    var mem = {
      get: function () {
        try { return JSON.parse(localStorage.getItem(MEM_KEY) || "null"); }
        catch (e) { return null; }
      },
      set: function (v) {
        try { localStorage.setItem(MEM_KEY, JSON.stringify(v)); } catch (e) {}
      },
      clear: function () {
        try { localStorage.removeItem(MEM_KEY); } catch (e) {}
      }
    };
    if (!kvFolder) return mem;
    return {
      get: function () { return kvFolder.get(slot).catch(function () { return mem.get(); }); },
      set: function (v) { try { localStorage.setItem(MEM_KEY, JSON.stringify(v)); } catch (e) {} return kvFolder.set(slot, v).catch(function () {}); },
      clear: function () { try { localStorage.removeItem(MEM_KEY); } catch (e) {} return kvFolder.delete(slot).catch(function () {}); }
    };
  }

  function norm(s) { return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64); }

  function subtle() {
    try { return (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null; }
    catch (e) { return null; }
  }

  function sha(text) {
    var s = subtle();
    if (!s) return Promise.resolve(null);
    try {
      var bytes = new Uint8Array(text.split("").map(function (c) { return c.charCodeAt(0) & 0xff; }));
      return s.digest("SHA-256", bytes).then(function (buf) {
        var v = new Uint8Array(buf), out = "";
        for (var i = 0; i < v.length; i++) out += (v[i] < 16 ? "0" : "") + v[i].toString(16);
        return out;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function mintToken() {
    var rnd = new Uint8Array(16), i;
    try {
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(rnd);
      else throw 0;
    } catch (e) { for (i = 0; i < 16; i++) rnd[i] = Math.floor(Math.random() * 256); }
    var chars = "";
    for (i = 0; i < 16; i++) chars += ABET.charAt(rnd[i] % ABET.length);
    return chars.slice(0, 4) + "-" + chars.slice(4, 8) + "-" + chars.slice(8, 12) + "-" + chars.slice(12, 16);
  }

  function client(opts) {
    opts = opts || {};
    var store = makeStore(opts);
    var leaveUrl = opts.leaveUrl || "https://perchance.org/";
    var onPass = opts.onPass || null;
    var onDeny = opts.onDeny || null;

    function el(id) { return document.getElementById(id); }
    function gate() { return el("gateKeeper"); }
    function msg(t) { var m = el("gateMsg"); if (m) m.textContent = String(t || ""); }
    function paint() {
      var t = el("gateToken"), p = el("gatePassBtn");
      if (t && p) p.disabled = !String(t.value).trim();
    }

    function validSession(rec) {
      return !!(rec && rec.ok === true && rec.hash && rec.until && rec.until > Date.now());
    }

    function open(sessionRec) {
      var g = gate();
      if (g) g.hidden = true;
      if (onPass) { try { onPass(sessionRec); } catch (e) {} }
    }

    function pass() {
      var t = el("gateToken");
      var typed = norm(t ? t.value : "");
      if (!typed) { paint(); return Promise.resolve(false); }
      return sha(typed).then(function (h) {
        if (!h) { msg("THIS BROWSER CANNOT HASH - THE GATE STAYS SHUT."); return false; }
        return Promise.resolve(store.get()).then(function (rec) {
          var now = Date.now();
          var has = !!(rec && rec.kind === "house" && rec.ok === true && rec.hash);
          if (!has) {
            return Promise.resolve(store.set({ kind: "house", hash: h, ok: true, at: now, until: now + SESSION_MS })).then(function () {
              open({ kind: "house", hash: h });
              msg("");
              return true;
            });
          }
          if (rec.hash === h) {
            return Promise.resolve(store.set({ kind: "house", hash: h, ok: true, at: now, until: now + SESSION_MS })).then(function () {
              open({ kind: "house", hash: h });
              msg("");
              return true;
            });
          }
          msg("DENIED - THAT SIGIL IS NOT THIS DEVICE'S.");
          if (onDeny) { try { onDeny(); } catch (e) {} }
          return false;
        });
      });
    }

    function mint() {
      var token = mintToken();
      return sha(norm(token)).then(function (h) {
        if (!h) { msg("THIS BROWSER CANNOT HASH - NOTHING WAS ENROLED."); return null; }
        var now = Date.now();
        return Promise.resolve(store.set({ kind: "house", hash: h, ok: true, at: now, until: now + SESSION_MS })).then(function () {
          var s = el("gateSigil");
          if (s) { s.textContent = token; s.hidden = false; }
          var t = el("gateToken");
          if (t) { t.value = token; paint(); }
          msg("THIS DEVICE IS ENROLED ON THE FRESH SIGIL ABOVE. CARRY IT TO THE NEXT DEVICE NOW - IT IS SHOWN ONCE.");
          return token;
        });
      });
    }

    function copy() {
      var s = el("gateSigil");
      if (!s || !s.textContent) { msg("NOTHING TO CARRY - MINT FIRST."); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(s.textContent).then(function () {
            msg("CARRIED - THE SIGIL IS ON THE CLIPBOARD.");
          }, function () { msg("THE CLIPBOARD REFUSED - SELECT THE SIGIL ABOVE AND COPY IT BY HAND."); });
          return;
        }
      } catch (e) {}
      msg("SELECT THE SIGIL ABOVE AND COPY IT BY HAND.");
    }

    function leave() { location.href = leaveUrl; }

    function show() {
      var g = gate();
      if (!g) return false;
      var t = el("gateToken");
      if (t) t.value = "";
      var s = el("gateSigil");
      if (s) { s.hidden = true; s.textContent = ""; }
      msg("");
      g.hidden = false;
      paint();
      try { if (t) t.focus(); } catch (e) {}
      return true;
    }

    function forget() {
      return Promise.resolve(store.clear()).then(function () { show(); return "FORGOTTEN - THE GATE WILL ASK ON THE NEXT LOAD."; });
    }

    function status() {
      return Promise.resolve(store.get()).then(function (rec) {
        if (!rec || !rec.hash) return "GATE :: NO MARK ON THIS DEVICE - IT WILL ENROL ON THE FIRST SIGIL PRESENTED.";
        if (!validSession(rec)) return "GATE :: MARK HELD, SESSION EXPIRED - PRESENT THE SIGIL AGAIN.";
        return "GATE :: MARK HELD, SESSION OPEN UNTIL " + new Date(rec.until).toISOString() + ".";
      });
    }

    function wire() {
      var t = el("gateToken"), p = el("gatePassBtn");
      if (!t || !p) return false;
      t.addEventListener("input", paint);
      t.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); pass(); } });
      p.addEventListener("click", pass);
      var mintB = el("gateMintBtn");
      if (mintB) mintB.addEventListener("click", mint);
      var copyB = el("gateCopyBtn");
      if (copyB) copyB.addEventListener("click", copy);
      var leaveB = el("gateLeaveBtn");
      if (leaveB) leaveB.addEventListener("click", leave);
      paint();
      return true;
    }

    function boot() {
      if (!wire()) return Promise.resolve(false);
      return Promise.resolve(store.get()).then(function (rec) {
        if (validSession(rec)) {
          var g = gate();
          if (g) g.hidden = true;
          return true;
        }
        show();
        return false;
      });
    }

    function words(arg) {
      var parts = String(arg || "").trim().split(/\s+/).filter(Boolean);
      var verb = (parts[0] || "").toLowerCase();
      if (!verb || verb === "help" || verb === "show") { show(); return Promise.resolve("GATE :: show | mint | forget | status | logout"); }
      if (verb === "mint") return mint().then(function (t) { return t ? "GATE :: FRESH SIGIL SHOWN ONCE ON THE SCREEN - NEVER IN THE LOG." : "GATE :: MINT FAILED."; });
      if (verb === "forget" || verb === "logout") return forget();
      if (verb === "status") return status();
      return Promise.resolve("GATE :: NO SUCH VERB (" + verb + "). show | mint | forget | status | logout.");
    }

    return { boot: boot, show: show, pass: pass, mint: mint, forget: forget, status: status, words: words };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosGate;
