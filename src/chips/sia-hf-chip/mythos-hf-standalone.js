window.MythosHf = (function () {
  "use strict";

  function str(s) { return String(s == null ? "" : s); }
  function mask(k) { k = str(k); return k.length < 12 ? "***" : k.slice(0, 7) + "..." + k.slice(-4); }

  function enc(s) {
    return encodeURIComponent(str(s)).replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    });
  }

  function encKey(key) { return str(key).split("/").map(enc).join("/"); }

  function amzNow() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var day = d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
    return { full: day + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z", day: day };
  }

  async function sha256hex(bytes) {
    var h = await crypto.subtle.digest("SHA-256", bytes);
    return Array.prototype.map.call(new Uint8Array(h), function (b) {
      return (b < 16 ? "0" : "") + b.toString(16);
    }).join("");
  }

  async function hmac(keyBytes, dataBytes) {
    var k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, dataBytes));
  }

  function te(s) { return new TextEncoder().encode(str(s)); }

  async function signKey(secret, day, region) {
    var kDate = await hmac(te("AWS4" + secret), te(day));
    var kRegion = await hmac(kDate, te(region));
    var kService = await hmac(kRegion, te("s3"));
    return hmac(kService, te("aws4_request"));
  }

  async function auth(opts, method, key, query, bodyHash, contentType) {
    var t = amzNow();
    var host = opts.host;
    var path = "/" + opts.ns + "/" + opts.bucket + (key ? "/" + encKey(key) : "");
    var heads = [["host", host]];
    if (contentType) heads.push(["content-type", contentType]);
    heads.push(["x-amz-content-sha256", bodyHash]);
    heads.push(["x-amz-date", t.full]);
    var signed = heads.map(function (h) { return h[0]; }).join(";");
    var ch = heads.map(function (h) { return h[0] + ":" + str(h[1]).trim() + "\n"; }).join("");
    var canon = method + "\n" + path + "\n" + query + "\n" + ch + "\n" + signed + "\n" + bodyHash;
    var scope = t.day + "/" + opts.region + "/s3/aws4_request";
    var sts = "AWS4-HMAC-SHA256\n" + t.full + "\n" + scope + "\n" + (await sha256hex(te(canon)));
    var sk = await signKey(opts.secret, t.day, opts.region);
    var sig = Array.prototype.map.call(await hmac(sk, te(sts)), function (b) {
      return (b < 16 ? "0" : "") + b.toString(16);
    }).join("");
    var out = { "x-amz-date": t.full, "x-amz-content-sha256": bodyHash };
    out["Authorization"] = "AWS4-HMAC-SHA256 Credential=" + opts.key + "/" + scope + ", SignedHeaders=" + signed + ", Signature=" + sig;
    if (contentType) out["Content-Type"] = contentType;
    return { url: "https://" + host + path + (query ? "?" + query : ""), headers: out };
  }

  function normOpts(opts) {
    opts = opts || {};
    var base = str(opts.endpoint || "https://s3.hf.co/merkmorassi").replace(/\/+$/, "");
    var m = base.replace(/^https?:\/\//, "").split("/");
    var o = {
      host: m[0], ns: m.slice(1).join("/") || "merkmorassi",
      bucket: str(opts.bucket || ""), key: str(opts.key || opts.accessKey || ""),
      secret: str(opts.secret || opts.secretKey || ""), region: str(opts.region || "us-east-1"),
      grab: (typeof opts.doFetch === "function") ? opts.doFetch : (typeof fetch === "function" ? fetch : null)
    };
    o.missing = !o.bucket ? "BUCKET" : (!o.key || !o.secret ? "KEY" : null);
    return o;
  }

  function fail(why) { return { ok: false, why: why }; }

  function errText(st, body) {
    var line = str(body).split("\n").map(function (x) { return x.trim(); }).filter(Boolean)[0] || "no detail";
    return "STORE REFUSED (" + st + ") :: " + line.slice(0, 200);
  }

  async function toBytes(body) {
    if (body instanceof Uint8Array) return body;
    if (typeof body === "string") return te(body);
    if (body && typeof body.arrayBuffer === "function") return new Uint8Array(await body.arrayBuffer());
    if (body && typeof body.length === "number") return new Uint8Array(body);
    throw new Error("BODY MUST BE TEXT, BYTES, OR A BLOB");
  }

  function client(rawOpts) {
    var opts = normOpts(rawOpts);

    function ready() {
      if (opts.missing === "BUCKET") return fail("NO BUCKET - PASS bucket.");
      if (opts.missing === "KEY") return fail("NO CREDENTIALS - PASS key + secret FROM THE HOST KEYRING, NEVER IN THE CHIP.");
      if (!opts.grab) return fail("NO FETCH - PASS doFetch.");
      if (!crypto.subtle) return fail("NO SUBTLECRYPTO - NEEDS A SECURE CONTEXT.");
      return null;
    }

    async function put(key, body, ctype) {
      try {
        var r = ready(); if (r) return r;
        var bytes = await toBytes(body);
        var ct = str(ctype || "application/octet-stream");
        var a = await auth(opts, "PUT", key, "", await sha256hex(bytes), ct);
        var res = await opts.grab(a.url, { method: "PUT", headers: a.headers, body: bytes });
        var txt = await res.text();
        if (res.ok) return { ok: true, key: str(key), bytes: bytes.length, etag: str(res.headers.get("etag") || "") };
        return fail(errText(res.status, txt) + " :: NOTHING WAS WRITTEN.");
      } catch (e) {
        return fail("HF UNREACHABLE :: " + str((e && e.message) || e).slice(0, 160) + " :: NOTHING WAS WRITTEN.");
      }
    }

    async function list(prefix) {
      try {
        var r = ready(); if (r) return r;
        var q = "list-type=2&max-keys=1000" + (prefix ? "&prefix=" + enc(prefix) : "");
        var a = await auth(opts, "GET", "", q, await sha256hex(te("")), null);
        var res = await opts.grab(a.url, { method: "GET", headers: a.headers });
        var txt = await res.text();
        if (!res.ok) return fail(errText(res.status, txt));
        if (typeof DOMParser === "undefined") return fail("NO XML PARSER - RUN IN A BROWSER.");
        var xml = new DOMParser().parseFromString(txt, "text/xml");
        var nodes = xml.getElementsByTagName("Key");
        var keys = [];
        for (var i = 0; i < nodes.length; i++) keys.push(nodes[i].textContent);
        return { ok: true, keys: keys, count: keys.length };
      } catch (e) {
        return fail("HF UNREACHABLE :: " + str((e && e.message) || e).slice(0, 160));
      }
    }

    async function remove(key) {
      try {
        var r = ready(); if (r) return r;
        var a = await auth(opts, "DELETE", key, "", await sha256hex(te("")), null);
        var res = await opts.grab(a.url, { method: "DELETE", headers: a.headers });
        if (res.ok) return { ok: true, key: str(key) };
        return fail(errText(res.status, await res.text()));
      } catch (e) {
        return fail("HF UNREACHABLE :: " + str((e && e.message) || e).slice(0, 160));
      }
    }

    async function who() {
      var r = ready(); if (r) return r;
      var probe = await list("");
      if (!probe.ok) return probe;
      return { ok: true, key: mask(opts.key), bucket: opts.bucket, endpoint: opts.host + "/" + opts.ns };
    }

    return { put: put, list: list, remove: remove, who: who, mask: mask };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosHf;
