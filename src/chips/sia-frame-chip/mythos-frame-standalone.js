var MythosFrame = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  function normId(id) {
    return str(id).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function cleanApp(a) {
    if (!a || typeof a !== "object") return null;
    var url = checkUrl(a.url);
    if (!url.ok) return null;
    var id = normId(a.id || a.title);
    if (!id) return null;
    return { id: id, title: str(a.title || id).slice(0, 60), url: url.src };
  }
  function checkUrl(u) {
    var s = str(u).trim();
    if (!s) return { ok: false, error: "NOTHING TO PLAY - NAME A LINK FIRST." };
    if (/^(javascript|data|file|blob):/i.test(s)) return { ok: false, error: "REFUSED - THAT SCHEME NEVER PLAYS IN A FRAME." };
    if (!/^https?:\/\//i.test(s)) return { ok: false, error: "REFUSED - ONLY HTTP AND HTTPS LINKS PLAY HERE." };
    if (s.length > 2000) return { ok: false, error: "REFUSED - THAT LINK IS TOO LONG TO TRUST." };
    return { ok: true, src: s };
  }
  var SEEDS = [
    { id: "cutoutly", title: "CUTOUTLY", url: "https://cutoutly.com/app" }
  ];
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var apps = [];
    var current = "";
    var ready = false;
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function byId(id) {
      var want = normId(id);
      for (var i = 0; i < apps.length; i++) if (apps[i].id === want) return apps[i];
      return null;
    }
    async function persist() {
      try { await store.save({ v: 1, apps: apps, current: current }); } catch (e) {}
    }
    async function load() {
      var seeds = Array.isArray(opts.apps) ? opts.apps : SEEDS;
      var snap = null;
      try { snap = await store.load(); } catch (e) { snap = null; }
      apps = [];
      var i, c;
      if (snap && Array.isArray(snap.apps) && snap.apps.length) {
        for (i = 0; i < snap.apps.length; i++) { c = cleanApp(snap.apps[i]); if (c) apps.push(c); }
        current = str((snap && snap.current) || "");
      } else {
        for (i = 0; i < seeds.length; i++) { c = cleanApp(seeds[i]); if (c) apps.push(c); }
        current = "";
      }
      if (current && !byId(current)) {
        var chk = checkUrl(current);
        current = chk.ok ? chk.src : "";
      }
      ready = true;
      return { ok: true, count: apps.length };
    }
    function list() {
      return apps.map(function (a) { return { id: a.id, title: a.title, url: a.url }; });
    }
    function resolveAppOrUrl(spec) {
      var named = byId(spec);
      if (named) return { ok: true, src: named.url, title: named.title };
      return checkUrl(spec);
    }
    async function open(spec) {
      var r = resolveAppOrUrl(spec);
      if (!r.ok) { say("THE FRAME STAYS DARK - " + r.error); return { ok: false, error: r.error }; }
      current = r.src;
      await persist();
      say("PLAYING :: " + (r.title || r.src).toUpperCase().slice(0, 80) + " - SOME SITES REFUSE FRAMES; IF IT STAYS DARK, OPEN IT IN A TAB.");
      return { ok: true, src: r.src };
    }
    async function close() {
      current = "";
      await persist();
      say("FRAME STRUCK - THE STAGE IS DARK.");
      return { ok: true };
    }
    async function pin(app) {
      var c = cleanApp(app);
      if (!c) { say("NOTHING PINNED - AN APP NEEDS A NAME AND A PLAYABLE LINK."); return { ok: false, error: "NOTHING PINNED - AN APP NEEDS A NAME AND A PLAYABLE LINK." }; }
      if (byId(c.id)) { say(c.id.toUpperCase() + " IS ALREADY ON THE BOARD."); return { ok: false, error: "ALREADY ON THE BOARD." }; }
      apps.push(c);
      await persist();
      say("PINNED :: " + c.title.toUpperCase() + ".");
      return { ok: true, app: c };
    }
    async function unpin(id) {
      var a = byId(id);
      if (!a) { say("NOTHING UNPINNED - NO SUCH APP."); return { ok: false, error: "NO SUCH APP." }; }
      apps = apps.filter(function (x) { return x !== a; });
      await persist();
      say("UNPINNED :: " + a.title.toUpperCase() + ".");
      return { ok: true };
    }
    async function rename(id, title) {
      var a = byId(id);
      var t = str(title).trim().slice(0, 60);
      if (!a) { say("NOTHING RENAMED - NO SUCH APP."); return { ok: false, error: "NO SUCH APP." }; }
      if (!t) { say("NOTHING RENAMED - A TAB NEEDS A NAME."); return { ok: false, error: "A TAB NEEDS A NAME." }; }
      a.title = t;
      await persist();
      say("NAMED :: " + t.toUpperCase() + ".");
      return { ok: true, app: { id: a.id, title: a.title, url: a.url } };
    }
    async function retarget(id, url) {
      var a = byId(id);
      if (!a) { say("NOTHING RETARGETED - NO SUCH APP."); return { ok: false, error: "NO SUCH APP." }; }
      var chk = checkUrl(url);
      if (!chk.ok) { say("NOTHING RETARGETED - " + chk.error); return { ok: false, error: chk.error }; }
      a.url = chk.src;
      await persist();
      say("RETARGETED :: " + a.title.toUpperCase() + ".");
      return { ok: true, app: { id: a.id, title: a.title, url: a.url } };
    }
    async function move(id, dir) {
      var a = byId(id);
      if (!a) { say("NOTHING MOVED - NO SUCH APP."); return { ok: false, error: "NO SUCH APP." }; }
      var i = apps.indexOf(a);
      var j = i + (Number(dir) < 0 ? -1 : 1);
      if (j < 0 || j >= apps.length) return { ok: false, error: "NOWHERE TO MOVE." };
      apps.splice(i, 1);
      apps.splice(j, 0, a);
      await persist();
      return { ok: true };
    }
    return { load: load, list: list, open: open, close: close, pin: pin, unpin: unpin, rename: rename, retarget: retarget, move: move,
      current: function () { return current; }, count: function () { return apps.length; },
      ready: function () { return ready; } };
  }
  return { client: client };
})();
if (typeof window !== "undefined") window.MythosFrame = MythosFrame;
if (typeof module !== "undefined" && module.exports) module.exports = MythosFrame;
