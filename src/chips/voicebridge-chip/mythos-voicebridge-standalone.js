(function () {
  "use strict";

  var PREFIX = "BRIDGE-EARS";
  var DEF_URL = "http://127.0.0.1:8766";

  function say(msg) { return PREFIX + " :: " + msg; }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var base = String(opts.base || DEF_URL).replace(/\/+$/, "");
    var token = String(opts.token || "");
    var onFinal = (typeof opts.onFinal === "function") ? opts.onFinal : null;
    var holdFn = (typeof opts.hold === "function") ? opts.hold : function () { return false; };
    var openEv = (typeof opts.events === "function") ? opts.events : function (url, onMsg, onErr) {
      try {
        var es = new EventSource(url);
        es.onmessage = function (e) { onMsg(e.data); };
        es.onerror = function () { onErr(); };
        return { close: function () { try { es.close(); } catch (x) {} } };
      } catch (e) { onErr(); return null; }
    };
    var fetchFn = (typeof opts.fetch === "function") ? opts.fetch : null;

    var ev = null;
    var open = false;
    var filed = 0;
    var held = 0;
    var partials = 0;

    function setToken(t) { token = String(t || ""); }
    function state() { return { open: open, filed: filed, held: held, partials: partials }; }

    function handle(data) {
      var msg = null;
      try { msg = JSON.parse(data); } catch (e) { return; }
      if (!msg || msg.final !== true || !msg.text) { partials++; return; }
      var text = String(msg.text).trim();
      if (!text) { partials++; return; }
      var heldNow = false;
      try { heldNow = !!holdFn(); } catch (e) { heldNow = false; }
      if (heldNow) {
        held++;
        return;
      }
      filed++;
      if (onFinal) {
        try { onFinal(text, { speaker: String((msg && (msg.speaker || msg.src)) || ""), lane: String((msg && msg.lane) || "") }); } catch (e) {}
      }
    }

    function listen() {
      if (open) return { ok: false, receipt: say("ALREADY LISTENING - CLOSE FIRST.") };
      var url = base + "/events?token=" + encodeURIComponent(token);
      var ok = false;
      try {
        ev = openEv(url, handle, function () {
          open = false;
          ev = null;
        });
        ok = !!ev;
      } catch (e) { ok = false; }
      if (!ok) return { ok: false, receipt: say("THE BRIDGE WOULD NOT OPEN AT " + base + " - START fasterwhisper_server.py ON YOUR MACHINE.") };
      open = true;
      return { ok: true, receipt: say("EARS OPEN :: " + base + " - FINALS ONLY, HELD DEAF WHILE SHE SPEAKS.") };
    }

    function close() {
      try { if (ev && ev.close) ev.close(); } catch (e) {}
      ev = null;
      open = false;
      return { ok: true, receipt: say("EARS SHUT :: " + filed + " FILED, " + held + " HELD, " + partials + " PARTIALS DROPPED.") };
    }

    async function status() {
      var f = fetchFn;
      if (!f) {
        try { if (typeof fetch === "function") f = fetch.bind(null); } catch (e) {}
      }
      if (!f) return { ok: false, receipt: say("NO FETCH ON THIS HOST.") };
      var res = null;
      try {
        res = await f(base + "/api/status?token=" + encodeURIComponent(token), { headers: { "Authorization": "Bearer " + token } });
      } catch (e) {
        return { ok: false, receipt: say("BRIDGE DOWN AT " + base + " - START fasterwhisper_server.py.") };
      }
      if (!res) return { ok: false, receipt: say("EMPTY ANSWER.") };
      if (res.status === 401) return { ok: false, receipt: say("TOKEN REFUSED - CHECK THE TOKEN FILE.") };
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!data || data.ok === false) return { ok: false, receipt: say("THE BRIDGE REFUSED.") };
      return { ok: true, base: String(data.base || base), live: !!data.live,
        lanes: data.lanes || {}, version: String(data.version || "?"),
        receipt: say(String(data.receipt || "AWAKE.") + " :: " + (open ? "LISTENING" : "SHUT")) };
    }

    return { listen: listen, close: close, status: status, state: state, setToken: setToken };
  }

  var api = { client: client, DEF_URL: DEF_URL };
  if (typeof window !== "undefined") window.MythosVoiceBridge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
