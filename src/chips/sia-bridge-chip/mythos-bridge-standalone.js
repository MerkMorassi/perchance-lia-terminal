var MythosBridge = (function () {
  "use strict";
  function client(opts) {
    opts = opts || {};
    var base = String(opts.baseUrl || "").replace(/\/+$/, "");
    var agent = String(opts.agent || "SIA");
    var key = opts.apiKey || null;
    var doFetch = opts.fetchImpl || fetch;
    if (!base) throw new Error("MythosBridge needs baseUrl");
    function headers() {
      var h = { "Content-Type": "application/json" };
      if (key) h.Authorization = "Bearer " + key;
      return h;
    }
    function call(path, method, body) {
      return doFetch(base + path, {
        method: method || "GET",
        headers: headers(),
        body: (body === undefined ? undefined : JSON.stringify(body)),
      }).then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error("store refused (" + res.status + ") :: " + text.slice(0, 200));
          try { return JSON.parse(text); }
          catch (e) { throw new Error("store answered non-JSON"); }
        });
      });
    }
    function stampOf(e) { return Number((e && (e.st || e.ts)) || 0) || 0; }
    return {
      count: function () { return call("/chatlog/count?agent=" + encodeURIComponent(agent)); },
      append: function (turns) { return call("/chatlog/append", "POST", { agent: agent, turns: turns }); },
      since: function (ts) { return call("/chatlog/since?agent=" + encodeURIComponent(agent) + "&ts=" + Number(ts || 0)); },
      push: function (localTurns) {
        var logs = localTurns || [];
        return this.count().then(function (info) {
          var fresh = logs.filter(function (e) { return e && e.ts && stampOf(e) > (info.newest || 0); });
          if (!fresh.length) return { added: 0, total: info.total, note: "nothing new" };
          return this.append(fresh);
        }.bind(this));
      },
      pull: function (newestTs) {
        return this.since(newestTs).then(function (res) { return res.turns || []; });
      },
    };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosBridge;
