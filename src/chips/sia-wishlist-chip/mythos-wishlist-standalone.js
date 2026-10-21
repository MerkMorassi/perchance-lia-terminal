window.MythosWishlist = (function () {
  "use strict";
  function str(s) { return String(s == null ? "" : s); }
  function trim(s) { return str(s).trim(); }
  function memStore() {
    var d = null;
    return { load: function () { return Promise.resolve(d); }, save: function (v) { d = v; return Promise.resolve(); } };
  }
  var OPEN = { pending: 1, building: 1 };
  var SHUT = { granted: 1, denied: 1, done: 1 };
  function client(rawOpts) {
    var opts = rawOpts || {};
    var store = opts.store || memStore();
    var kv = opts.kvFolder || null;
    var SLOT = str(opts.slot || "wish_state");
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }
    function notify() {
      if (typeof opts.onChange === "function") {
        try { opts.onChange({ pending: pendingCount(), total: wishes.length }); } catch (e) {}
      }
    }
    var wishes = [];
    var away = [];
    var seq = 0;
    var ready = false;
    function validSnap(s) { return !!(s && typeof s === "object" && Array.isArray(s.wishes)); }
    function validWish(w) { return !!(w && typeof w.id === "string" && w.id && typeof w.want === "string" && trim(w.want)); }
    async function persist() {
      var snap = { wishes: wishes, away: away, seq: seq };
      try { if (kv) await kv.set(SLOT, snap); else await store.save(snap); } catch (e) {}
    }
    async function load() {
      var snap = null;
      try { snap = kv ? await kv.get(SLOT) : await store.load(); } catch (e) { snap = null; }
      if (validSnap(snap)) {
        wishes = snap.wishes.filter(validWish);
        away = Array.isArray(snap.away) ? snap.away.filter(validWish) : [];
        seq = Number(snap.seq) || wishes.length;
      }
      ready = true;
      return { ok: true, text: statusText() };
    }
    function find(idOrWant) {
      var want = trim(idOrWant).toLowerCase();
      if (!want) return null;
      var i;
      for (i = 0; i < wishes.length; i++) if (wishes[i].id === want) return wishes[i];
      for (i = 0; i < wishes.length; i++) if (trim(wishes[i].want).toLowerCase() === want) return wishes[i];
      return null;
    }
    function findAny(idOrWant) {
      var hit = find(idOrWant);
      if (hit) return hit;
      var want = trim(idOrWant).toLowerCase();
      if (!want) return null;
      for (var i = 0; i < away.length; i++) if (away[i].id === want) return away[i];
      return null;
    }
    function pending() { return wishes.filter(function (w) { return w.status === "pending"; }); }
    function all() { return wishes.slice(); }
    function awayList() { return away.slice(); }
    function count() { return wishes.length; }
    function pendingCount() { return pending().length; }
    function line(w) {
      var when = "";
      try { when = new Date(w.ts).toISOString().slice(0, 16).replace("T", " "); } catch (e) {}
      return w.id.toUpperCase() + " [" + w.status.toUpperCase() + "] " + w.want
        + (w.why ? " :: " + w.why : "") + (when ? " (" + when + ")" : "")
        + (w.note ? " — " + w.note : "");
    }
    function listText() {
      var open = wishes.filter(function (w) { return OPEN[w.status]; });
      var shut = wishes.filter(function (w) { return SHUT[w.status]; });
      var rows = open.concat(shut).map(line);
      return rows.length ? "WISH LIST ::\n" + rows.join("\n") : "WISH LIST :: EMPTY - SHE HAS ASKED FOR NOTHING YET.";
    }
    function statusText() {
      var n = pendingCount();
      var g = wishes.filter(function (w) { return w.status === "granted" || w.status === "building"; }).length;
      var d = wishes.filter(function (w) { return w.status === "done"; }).length;
      return "WISH LIST :: " + (n ? n + " WAITING" : "NOTHING WAITING") + " :: " + wishes.length + " FILED"
        + (g ? " :: " + g + " GRANTED" : "") + (d ? " :: " + d + " DONE" : "") + ".";
    }
    async function ask(want, o) {
      o = o || {};
      var w = trim(want).slice(0, 200);
      if (!w) return { ok: false, error: "A WISH NAMES WHAT SHE WANTS :: [[WISH: the capability :: why it serves the work]]." };
      seq += 1;
      var wish = {
        id: "w" + seq, want: w, why: trim(o.why || "").slice(0, 300), scope: trim(o.scope || "").slice(0, 60),
        status: "pending", by: trim(o.by || "alia"), ts: Date.now(), decidedAt: 0, note: ""
      };
      wishes.push(wish);
      await persist();
      notify();
      say("WISH FILED :: " + wish.id.toUpperCase() + " :: " + wish.want);
      return { ok: true, wish: wish, text: "WISH FILED :: " + wish.id.toUpperCase() + " :: " + wish.want + " — HIS WORD GRANTS OR DENIES IT." };
    }
    async function decide(id, status, note, by) {
      var w = find(id);
      if (!w) {
        var gone = findAny(id);
        if (gone) return { ok: false, error: "WISH " + trim(id).toUpperCase() + " IS PUT AWAY - /wish recall " + trim(id).toUpperCase() + " PUTS IT BACK FIRST." };
        return { ok: false, error: "NO WISH CALLED " + trim(id).toUpperCase() + " :: /wish list PRINTS THEM ALL." };
      }
      var st = trim(status).toLowerCase();
      if (!SHUT[st] && !OPEN[st]) return { ok: false, error: "WISHES REST AT granted | denied | building | done." };
      w.status = st;
      w.decidedAt = Date.now();
      w.note = trim(note || "").slice(0, 200);
      if (by) w.by = trim(by).slice(0, 20);
      await persist();
      notify();
      var msg = "WISH " + st.toUpperCase() + " :: " + w.id.toUpperCase() + " :: " + w.want + (w.note ? " — " + w.note : "");
      say(msg);
      return { ok: true, wish: w, text: msg };
    }
    async function grant(id, note) { return decide(id, "granted", note, "hitl"); }
    async function deny(id, note) { return decide(id, "denied", note, "hitl"); }
    async function build(id) { return decide(id, "building", "", "hitl"); }
    async function done(id) { return decide(id, "done", "", "hitl"); }
    async function forget(id) {
      var w = find(id);
      if (!w) return { ok: false, error: "NO WISH CALLED " + trim(id).toUpperCase() + " :: /wish list PRINTS THEM ALL." };
      wishes = wishes.filter(function (x) { return x.id !== w.id; });
      away.push(w);
      await persist();
      notify();
      return { ok: true, text: "WISH PUT AWAY :: " + w.id.toUpperCase() + " - NOTHING IS DESTROYED, /wish recall " + w.id.toUpperCase() + " PUTS IT BACK." };
    }
    async function recall(id) {
      var want = trim(id).toLowerCase();
      var hit = null;
      for (var i = 0; i < away.length; i++) if (away[i].id === want) hit = away[i];
      if (!hit) return { ok: false, error: "NOTHING PUT AWAY CALLED " + trim(id).toUpperCase() + "." };
      away = away.filter(function (x) { return x.id !== hit.id; });
      wishes.push(hit);
      await persist();
      notify();
      return { ok: true, wish: hit, text: "WISH BACK :: " + hit.id.toUpperCase() + " :: " + hit.want };
    }
    async function words(s) {
      var a = trim(s);
      if (!a || /^(status|count)$/i.test(a)) return { ok: true, text: statusText() };
      if (/^(list|all)$/i.test(a)) return { ok: true, text: listText() };
      var m = /^(wish|ask|grant|deny|build|done|forget|recall)\b\s*([\s\S]*)$/i.exec(a);
      if (!m) return { ok: false, error: "WISH LIST :: status | list | wish <want> :: <why> | grant|deny|build|done|forget|recall <id>." };
      var verb = m[1].toLowerCase(), rest = trim(m[2]);
      if (verb === "wish" || verb === "ask") {
        var cut = rest.indexOf("::");
        if (cut === -1) return ask(rest, { by: "hitl" });
        return ask(trim(rest.slice(0, cut)), { why: trim(rest.slice(cut + 2)), by: "hitl" });
      }
      var cut2 = rest.indexOf("::");
      var id = cut2 === -1 ? rest : trim(rest.slice(0, cut2));
      var note = cut2 === -1 ? "" : trim(rest.slice(cut2 + 2));
      if (verb === "grant") return grant(id, note);
      if (verb === "deny") return deny(id, note);
      if (verb === "build") return build(id);
      if (verb === "done") return done(id);
      if (verb === "forget") return forget(id);
      return recall(id);
    }
    return {
      load: load, ready: function () { return ready; },
      ask: ask, get: find, find: find,
      pending: pending, all: all, awayList: awayList,
      count: count, pendingCount: pendingCount,
      decide: decide, grant: grant, deny: deny, build: build, done: done,
      forget: forget, recall: recall, words: words,
      listText: listText, statusText: statusText
    };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosWishlist;
