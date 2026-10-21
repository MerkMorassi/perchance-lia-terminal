var MythosRoam = (function () {
  "use strict";

  function Roots(db) {
    return {
      ledger: function (tx, mode) { return tx([ "roam_ledger" ], mode).objectStore("roam_ledger"); },
      chron: function (tx, mode) { return tx([ "roam_chronicle" ], mode).objectStore("roam_chronicle"); },
      outbox: function (tx, mode) { return tx([ "roam_outbox" ], mode).objectStore("roam_outbox"); }
    };
  }

  function mergeLedger(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (r) {
      if (!r || !r.documentId) return;
      var cur = byId[r.documentId];
      if (!cur || (r.ts || 0) > (cur.ts || 0)) byId[r.documentId] = r;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function mergeChronicle(local, remote) {
    var seen = {};
    var out = [];
    (local || []).concat(remote || []).forEach(function (e) {
      if (!e || e.ts == null) return;
      var k = e.ts + "|" + (e.kind || "") + "|" + (e.msg || "").slice(0, 60);
      if (!seen[k]) { seen[k] = true; out.push(e); }
    });
    out.sort(function (a, b) { return a.ts - b.ts; });
    return out;
  }

  function client(opts) {
    opts = opts || {};
    var DB = String(opts.db || "mythos-roam");
    var VER = opts.version || 1;
    var slot = String(opts.slot || "default");
    var syncBase = String(opts.syncBase || "").replace(/\/$/, "");
    var onStatus = typeof opts.onStatus === "function" ? opts.onStatus : function () {};
    var db = null;
    var R = Roots(null);

    function status(m) { try { onStatus(m); } catch (e) {} }

    function open() {
      return new Promise(function (resolve) {
        var req;
        try { req = indexedDB.open(DB, VER); }
        catch (e) { status("STORE REFUSED (500) :: ROAM CORE OFFLINE :: NOTHING ELSE WAS TOUCHED."); resolve(null); return; }
        req.onupgradeneeded = function (e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains("roam_ledger")) d.createObjectStore("roam_ledger", { keyPath: "documentId" });
          if (!d.objectStoreNames.contains("roam_chronicle")) d.createObjectStore("roam_chronicle", { keyPath: "ts" });
          if (!d.objectStoreNames.contains("roam_outbox")) d.createObjectStore("roam_outbox", { keyPath: "id", autoIncrement: true });
        };
        req.onsuccess = function (e) { db = e.target.result; resolve(db); };
        req.onerror = function () { status("STORE REFUSED (500) :: ROAM CORE OFFLINE :: NOTHING ELSE WAS TOUCHED."); resolve(null); };
      });
    }

    function put(store, rec) {
      return new Promise(function (resolve) {
        if (!db) { resolve(false); return; }
        try {
          var q = db.transaction([ store ], "readwrite").objectStore(store).put(rec);
          q.onsuccess = function () { resolve(true); };
          q.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }

    function all(store) {
      return new Promise(function (resolve) {
        if (!db) { resolve([]); return; }
        try {
          var q = db.transaction([ store ], "readonly").objectStore(store).getAll();
          q.onsuccess = function () { resolve(q.result || []); };
          q.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    }

    function del(store, key) {
      return new Promise(function (resolve) {
        if (!db) { resolve(false); return; }
        try {
          var q = db.transaction([ store ], "readwrite").objectStore(store).delete(key);
          q.onsuccess = function () { resolve(true); };
          q.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }

    function enqueue(kind, payload) {
      return put("roam_outbox", { ts: Date.now(), slot: slot, kind: kind, payload: payload });
    }

    async function save(documentId, data) {
      await open();
      var rec = { documentId: String(documentId || slot), data: data == null ? null : data, ts: Date.now() };
      var ok = await put("roam_ledger", rec);
      if (ok) await enqueue("ledger", rec);
      status(ok ? "SAVED LOCALLY" + (syncBase ? " :: QUEUED FOR CHECK-IN" : "") : "STORE REFUSED (500) :: SAVE REFUSED :: NOTHING ELSE WAS TOUCHED.");
      return ok;
    }

    async function log(kind, msg) {
      await open();
      var entry = { ts: Date.now(), iso: new Date().toISOString(), slot: slot, kind: String(kind), msg: String(msg) };
      var ok = await put("roam_chronicle", entry);
      if (ok) await enqueue("chronicle", entry);
      return ok;
    }

    async function postOne(item) {
      var path = item.kind === "ledger" ? "api/v1/webhook/sync-fountain" : "api/v1/webhook/append-chronicle";
      var body = item.kind === "ledger"
        ? { documentId: item.payload.documentId, fountainStream: item.payload.data, ts: item.payload.ts }
        : { documentId: slot, entry: item.payload };
      var r = await fetch(syncBase + "/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error("host refused " + r.status);
      return true;
    }

    async function checkin() {
      await open();
      if (!syncBase) { status("LOCAL ONLY :: n OUTBOX ITEMS HELD FOR THE NEXT HOST."); return { sent: 0, kept: (await all("roam_outbox")).length }; }
      if (syncBase.indexOf("https://") !== 0) { status("DENIED - SYNC HOST MUST BE https:// :: MIXED CONTENT WOULD EAT http:// :: NOTHING WAS SENT."); return { sent: 0, kept: (await all("roam_outbox")).length }; }
      var box = await all("roam_outbox");
      box.sort(function (a, b) { return a.ts - b.ts; });
      var sent = 0;
      for (var i = 0; i < box.length; i++) {
        try { await postOne(box[i]); await del("roam_outbox", box[i].id); sent++; }
        catch (e) { break; }
      }
      var kept = (await all("roam_outbox")).length;
      status(sent ? "CHECKED IN " + sent + (kept ? ", " + kept + " HELD" : "") : "HOST UNREACHABLE :: " + kept + " HELD, NOTHING LOST.");
      return { sent: sent, kept: kept };
    }

    function setHost(base) {
      syncBase = String(base || "").replace(/\/$/, "");
      status(syncBase ? "SYNC HOST SET" : "LOCAL ONLY");
      return syncBase;
    }

    try {
      window.addEventListener("online", function () { checkin(); });
      status("ROAM ARMED :: OFFLINE IS HOME, CHECK-IN IS AUTOMATIC.");
    } catch (e) {}

    return { save: save, log: log, checkin: checkin, setHost: setHost, mergeLedger: mergeLedger, mergeChronicle: mergeChronicle, open: open };
  }

  return { client: client, mergeLedger: mergeLedger, mergeChronicle: mergeChronicle };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosRoam;
