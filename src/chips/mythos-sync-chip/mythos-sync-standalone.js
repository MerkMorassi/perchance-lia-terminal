window.MythosSync = (function () {
  "use strict";
  var te = new TextEncoder(), td = new TextDecoder();
  function b64e(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64d(s) {
    var b = atob(s), o = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
    return o;
  }
  function shaHex(s) {
    return crypto.subtle.digest("SHA-256", te.encode(s)).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (x) {
        return x.toString(16).padStart(2, "0");
      }).join("");
    });
  }
  function aesKey(pass, salt) {
    return crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
      );
    });
  }
  function slot(agent, kind, pass) {
    return shaHex("siasync-v1::" + agent + "::" + kind + "::" + pass).then(function (h) {
      return "siasync-" + agent + "-" + kind + "-" + h.slice(0, 32);
    });
  }
  function client(opts) {
    opts = opts || {};
    var plugin = opts.plugin || null;
    var agent = String(opts.agent || "SIA").toUpperCase();
    function need() {
      if (!plugin || !plugin.editable) throw new Error("SYNC REFUSED :: no upload plugin - pass one in client({ plugin }).");
    }
    function pushRaw(kind, raw, pass) {
      need();
      if (!pass || pass.length < 12) return Promise.reject(new Error("SYNC REFUSED :: passphrase too short - use 12+ characters, words are best."));
      var salt = crypto.getRandomValues(new Uint8Array(16));
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return aesKey(pass, salt).then(function (key) {
        return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, te.encode(String(raw == null ? "" : raw)));
      }).then(function (ct) {
        var body = JSON.stringify({ v: 1, salt: b64e(salt), iv: b64e(iv), data: b64e(new Uint8Array(ct)) });
        return slot(agent, kind, pass).then(function (name) {
          return plugin.editable.set(name, body).then(function (r) {
            if (r && r.error) throw new Error("SYNC PUSH FAILED: " + r.error);
            return { name: name, chars: body.length };
          });
        });
      });
    }
    function pullRaw(kind, pass) {
      need();
      if (!pass) return Promise.reject(new Error("SYNC REFUSED :: enter the same passphrase."));
      return slot(agent, kind, pass).then(function (name) {
        return plugin.editable.get(name).catch(function () { return null; }).then(function (body) {
          if (!body) throw new Error("SYNC EMPTY :: no file for that passphrase (nothing pushed yet, or different words).");
          var obj = null;
          try { obj = JSON.parse(body); } catch (e) { throw new Error("SYNC UNREADABLE :: stored file is not JSON."); }
          return aesKey(pass, b64d(obj.salt)).then(function (key) {
            return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(obj.iv) }, key, b64d(obj.data));
          }).then(function (pt) {
            return { name: name, raw: td.decode(pt) };
          }).catch(function (e) {
            if (/^SYNC /.test(e.message)) throw e;
            throw new Error("SYNC REFUSED :: wrong passphrase (decrypt failed).");
          });
        });
      });
    }
    function pushBundle(kind, obj, pass) {
      return pushRaw(kind, JSON.stringify(obj == null ? {} : obj), pass);
    }
    function pullBundle(kind, pass, apply) {
      return pullRaw(kind, pass).then(function (r) {
        var incoming = null;
        try { incoming = JSON.parse(r.raw) || {}; } catch (e) { throw new Error("SYNC UNREADABLE :: decrypted payload is not JSON."); }
        var names = Object.keys(incoming).filter(function (k) { return incoming[k] !== undefined && incoming[k] !== null; });
        if (apply) {
          for (var i = 0; i < names.length; i++) {
            try { apply(names[i], incoming[names[i]]); } catch (e) {}
          }
        }
        return { name: r.name, keys: names };
      });
    }
    function collectSettings(prefix, deny) {
      var o = {}, skip = deny || [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k || k.indexOf(prefix) !== 0 || skip.indexOf(k) >= 0) continue;
          try { o[k] = localStorage.getItem(k); } catch (e) {}
        }
      } catch (e) {}
      return o;
    }
    function applySettings(obj, prefix, deny, write) {
      var n = 0, skip = deny || [];
      var keys = Object.keys(obj || {});
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf(prefix) !== 0 || skip.indexOf(k) >= 0) continue;
        try { write(k, String(obj[k])); n++; } catch (e) {}
      }
      return n;
    }
    return {
      pushBundle: pushBundle,
      pullBundle: pullBundle,
      collectSettings: collectSettings,
      applySettings: applySettings,
      slot: function (kind, pass) { return slot(agent, kind, pass); }
    };
  }
  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosSync;
