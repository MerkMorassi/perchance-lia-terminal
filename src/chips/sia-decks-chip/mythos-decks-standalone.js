var MythosDecks = (function () {
"use strict";
function el(r) {
  if (!r) return null;
  if (typeof r === "string") {
    try { if (typeof document === "undefined") return null; return document.getElementById(r); }
    catch (e) { return null; }
  }
  if (typeof r === "object" && r.nodeType === 1) return r;
  return null;
}
function mem() {
  var m = {};
  return {
    get: function (k) { return Promise.resolve(k in m ? m[k] : null); },
    set: function (k, v) { m[k] = v; return Promise.resolve(true); },
    del: function (k) { delete m[k]; return Promise.resolve(true); }
  };
}
function lss(slot) {
  function k(n) { return slot + ":" + n; }
  return {
    get: function (n) {
      try { var r = localStorage.getItem(k(n)); return Promise.resolve(r ? JSON.parse(r) : null); }
      catch (e) { return Promise.resolve(null); }
    },
    set: function (n, v) {
      try { localStorage.setItem(k(n), JSON.stringify(v)); return Promise.resolve(true); }
      catch (e) { return Promise.reject(new Error("DECKS STORE REFUSED (" + e.name + ") :: " + n + " :: NOTHING ELSE WAS TOUCHED.")); }
    },
    del: function (n) { try { localStorage.removeItem(k(n)); } catch (e) {} return Promise.resolve(true); }
  };
}
function wrap(s) {
  return {
    get: function (k) {
      try { return Promise.resolve().then(function () { return s.get(k); }).catch(function () { return null; }); }
      catch (e) { return Promise.resolve(null); }
    },
    set: function (k, v) {
      try {
        return Promise.resolve().then(function () { return s.set(k, v); }).catch(function () {
          throw new Error("DECKS STORE REFUSED :: " + k + " :: NOTHING ELSE WAS TOUCHED.");
        });
      } catch (e) { return Promise.reject(new Error("DECKS STORE REFUSED :: " + k + " :: NOTHING ELSE WAS TOUCHED.")); }
    },
    del: function (k) {
      try {
        if (s.del) return Promise.resolve(s.del(k));
        if (s.delete) return Promise.resolve(s.delete(k));
      } catch (e) {}
      return Promise.resolve(true);
    }
  };
}
function client(opts) {
  opts = opts || {};
  if (typeof document === "undefined") throw new Error("DECKS DENIED - no document :: NOTHING WAS TOUCHED.");
  var doc = document;
  var top = el(opts.top || "deckTop");
  var bottom = el(opts.bottom || "deckBottom");
  var nav = el(opts.nav || "deckNav");
  var read = el(opts.read || "deckRead");
  var room = el(opts.room || "deckRoom");
  var root = el(opts.root) || doc.documentElement;
  if (!top && !bottom) throw new Error("DECKS DENIED - no deck elements found :: NOTHING WAS TOUCHED.");
  var slot = String(opts.slot || "mythosDecks");
  if (opts.agent) slot = slot + ":" + String(opts.agent);
  var key = String(opts.key || "decks");
  var store = opts.store ? wrap(opts.store) : (function () {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.getItem("__decks_ok__");
        return lss(slot);
      }
    } catch (e) {}
    return mem();
  })();
  var fold = { top: false, bottom: false };
  var wired = [];
  function gripFor(e, g) {
    var x = el(g);
    if (x) return x;
    if (!e) return null;
    return e.querySelector("[data-grip]");
  }
  function paint() {
    [[top, "top"], [bottom, "bottom"]].forEach(function (p) {
      if (!p[0]) return;
      p[0].classList.toggle("folded", !!fold[p[1]]);
      var g = p[0].querySelector("[data-grip]");
      if (g) g.setAttribute("aria-expanded", fold[p[1]] ? "false" : "true");
    });
  }
  function persist() {
    var rec = { ts: Date.now(), top: !!fold.top, bottom: !!fold.bottom };
    return store.set(key, rec).then(function () { return rec; });
  }
  function measure() {
    var h = 0, b = 0;
    try { if (top) h = Math.round(top.getBoundingClientRect().height); } catch (e) {}
    try { if (bottom) b = Math.round(bottom.getBoundingClientRect().height); } catch (e) {}
    try {
      if (root && root.style) {
        root.style.setProperty("--deck-h", h + "px");
        root.style.setProperty("--deck-b", b + "px");
      }
    } catch (e) {}
    return { h: h, b: b };
  }
  function setW(w, v) {
    if (w !== "top" && w !== "bottom") return Promise.reject(new Error("DECKS DENIED - unknown deck " + String(w) + " :: NOTHING WAS TOUCHED."));
    fold[w] = !!v;
    paint();
    measure();
    return persist();
  }
  function unwire() {
    wired.forEach(function (p) { try { p[0].removeEventListener("click", p[1]); } catch (e) {} });
    wired = [];
  }
  function wire() {
    unwire();
    [["top", top, opts.topGrip], ["bottom", bottom, opts.bottomGrip]].forEach(function (p) {
      var g = gripFor(p[1], p[2]);
      if (!g) return;
      var h = function () { setW(p[0], !fold[p[0]]).catch(function () {}); };
      g.addEventListener("click", h);
      wired.push([g, h]);
    });
  }
  var api = {
    state: function () { return { top: !!fold.top, bottom: !!fold.bottom }; },
    fold: function (w) { return setW(w, true); },
    unfold: function (w) { return setW(w, false); },
    toggle: function (w) { return setW(w, !fold[w]); },
    apply: function (s) {
      if (s && typeof s === "object") { fold.top = !!s.top; fold.bottom = !!s.bottom; }
      paint();
      measure();
      return api.state();
    },
    restore: function () {
      return store.get(key).then(function (r) {
        if (r && typeof r === "object" && (typeof r.top === "boolean" || typeof r.bottom === "boolean")) {
          fold.top = !!r.top;
          fold.bottom = !!r.bottom;
          paint();
          measure();
        }
        return api.state();
      });
    },
    buildNav: function (tabs) {
      if (!nav) throw new Error("DECKS DENIED - no nav element :: NOTHING WAS TOUCHED.");
      nav.innerHTML = "";
      (tabs || []).forEach(function (t) {
        var btn = doc.createElement("button");
        btn.className = "tab" + (t && t.on ? " on" : "");
        btn.setAttribute("data-tab", (t && t.id) || "");
        btn.textContent = (t && (t.label || t.id)) || "";
        btn.addEventListener("click", function () {
          if (typeof opts.onTab === "function") { try { opts.onTab(t.id); } catch (e) {} }
        });
        nav.append(btn);
      });
      return nav.childElementCount;
    },
    readout: function (line, name) {
      if (read) read.textContent = line == null ? "" : String(line);
      if (room && name != null) room.textContent = String(name);
      return read ? read.textContent : "";
    },
    measure: measure,
    destroy: function () { unwire(); return true; }
  };
  wire();
  paint();
  measure();
  return api;
}
return { client: client };
})();
if (typeof window !== "undefined") window.MythosDecks = MythosDecks;
if (typeof module !== "undefined" && module.exports) module.exports = MythosDecks;
