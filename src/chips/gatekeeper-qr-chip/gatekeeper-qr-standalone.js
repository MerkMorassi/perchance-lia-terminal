window.MythosGateQR = (function () {
  "use strict";
  var TTL = 120000;

  function fail(m) { throw new Error(m); }

  function bytes(n, rnd) {
    if (rnd) return rnd(n);
    var a = new Uint8Array(n);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }

  function b64(u8) {
    var s = "";
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    var b = typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function client(opts) {
    opts = opts || {};
    var ttl = opts.ttlMs || TTL;
    var now = opts.now || (function () { return Date.now(); });
    var rnd = opts.random || null;

    function rendezvous() {
      var t = now();
      return {
        channel: "gk-" + b64(bytes(12, rnd)),
        nonce: b64(bytes(16, rnd)),
        issuedAt: t,
        expiresAt: t + ttl
      };
    }

    function qrPayload(baseUrl, rz) {
      if (!baseUrl) fail("GATE QR REFUSED :: no approve page URL. NOTHING WAS DRAWN.");
      if (!rz || !rz.channel || !rz.nonce) fail("GATE QR REFUSED :: no rendezvous. Call rendezvous() first. NOTHING WAS DRAWN.");
      var b = String(baseUrl).replace(/#.*$/, "");
      return b + "#gate=" + encodeURIComponent(rz.channel) + "&nonce=" + encodeURIComponent(rz.nonce);
    }

    function parseHash(hash) {
      var h = String(hash || "").replace(/^#/, "");
      var out = {};
      h.split("&").forEach(function (p) {
        var i = p.indexOf("=");
        if (i > 0) out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
      });
      if (!out.gate || !out.nonce) fail("GATE QR REFUSED :: this code is not a gate approval (gate + nonce required). NOTHING WAS WRITTEN.");
      return { channel: out.gate, nonce: out.nonce };
    }

    function approval(nonce) {
      if (!nonce) fail("GATE QR REFUSED :: no nonce to approve. NOTHING WAS WRITTEN.");
      return { ok: true, nonce: String(nonce), at: now() };
    }

    function denial(nonce) {
      return { ok: false, nonce: String(nonce || ""), at: now() };
    }

    function verify(rz, record) {
      if (!rz || !rz.nonce || !rz.expiresAt) fail("GATE CLOSED :: no live challenge on this screen. NOTHING WAS OPENED.");
      if (now() > rz.expiresAt) fail("GATE CLOSED :: challenge expired - draw a fresh code. NOTHING WAS OPENED.");
      if (!record || typeof record !== "object") fail("GATE CLOSED :: no answer on the channel yet. NOTHING WAS OPENED.");
      if (record.nonce !== rz.nonce) fail("GATE CLOSED :: answer does not match this challenge. NOTHING WAS OPENED.");
      if (record.ok !== true) fail("GATE CLOSED :: the other device denied it. NOTHING WAS OPENED.");
      return { ok: true, channel: rz.channel, approvedAt: record.at };
    }

    return {
      rendezvous: rendezvous,
      qrPayload: qrPayload,
      parseHash: parseHash,
      approval: approval,
      denial: denial,
      verify: verify,
      ttlMs: ttl
    };
  }

  return { client: client, TTL: TTL };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosGateQR;
