window.MythosUpscale = (function () {
  "use strict";

  var ORIGIN = "https://app.bigger.pics";
  var ENTRY = "https://bigger.pics/";

  function str(s) { return String(s == null ? "" : s); }

  function memVault() {
    var items = {};
    var n = 0;
    return {
      add: function (rec) { n++; var id = "up-" + n; items[id] = rec; rec.id = id; return id; },
      get: function (id) { return items[id] || null; },
      remove: function (id) { var r = items[id]; if (r) delete items[id]; return !!r; },
      tag: function (id, tags) {
        var r = items[id];
        if (!r) return false;
        r.tags = r.tags || [];
        tags.forEach(function (t) { if (r.tags.indexOf(t) < 0) r.tags.push(t); });
        return true;
      },
      count: function () { return Object.keys(items).length; }
    };
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      try {
        var fr = new FileReader();
        fr.onload = function () { resolve(str(fr.result || "")); };
        fr.onerror = function () { reject(new Error("THE PICTURE COULD NOT BE READ")); };
        fr.readAsDataURL(blob);
      } catch (e) { reject(e); }
    });
  }

  function baseName(name) {
    var b = str(name || "picture").replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 48);
    return b || "picture";
  }

  function extFor(blob) {
    var m = str(blob && blob.type).toLowerCase();
    if (/png/.test(m)) return "png";
    if (/jpe?g/.test(m)) return "jpg";
    if (/webp/.test(m)) return "webp";
    return "png";
  }

  var FIT_BYTES = 15 * 1024 * 1024;

  function fitBlob(blob) {
    if (!blob || !(blob.size > FIT_BYTES)) return Promise.resolve(blob);
    var obj = URL.createObjectURL(blob);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(obj);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(null);
        var scales = [1, 1, 1, 0.75, 0.6, 0.5, 0.4, 0.3];
        var quals = [0.92, 0.85, 0.75, 0.9, 0.9, 0.88, 0.85, 0.85];
        var i = 0;
        (function attempt() {
          if (i >= scales.length) return resolve(null);
          var sc = scales[i], q = quals[i]; i++;
          var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
          var c = document.createElement("canvas");
          c.width = cw; c.height = ch;
          var cx = c.getContext("2d");
          try {
            cx.fillStyle = "white"; cx.fillRect(0, 0, cw, ch);
            cx.drawImage(img, 0, 0, cw, ch);
          } catch (e) { return resolve(null); }
          try {
            c.toBlob(function (out) {
              if (out && out.size <= FIT_BYTES) return resolve(out);
              attempt();
            }, "image/jpeg", q);
          } catch (e2) { return resolve(null); }
        })();
      };
      img.onerror = function () { URL.revokeObjectURL(obj); resolve(null); };
      img.src = obj;
    });
  }

  function client(raw) {
    var opts = raw || {};
    var format = str(opts.format || "png").toLowerCase();
    if (format !== "png" && format !== "jpeg") format = "png";
    var site = str(opts.site || "perchance.org");
    var autoClose = opts.autoClose !== false;
    var closeMs = Number(opts.closeMs) || 1500;
    var knockMs = Number(opts.knockMs) || 10000;
    var slowMs = Number(opts.slowMs) || 90000;
    var pollMs = Number(opts.pollMs) || 800;
    var vault = opts.vault || memVault();
    var say = (typeof opts.say === "function") ? opts.say : function () {};
    var opener = (typeof opts.openWin === "function") ? opts.openWin : function (u, t) { return window.open(u, t); };
    var checker = (typeof opts.sourceCheck === "function") ? opts.sourceCheck : fromOurPopup;
    var session = null;
    var closer = null;

    function endSession() {
      if (session && session.poll) window.clearInterval(session.poll);
      if (closer) { window.clearTimeout(closer.timer); closer = null; }
      session = null;
    }

    function closeSoon() {
      if (closer) { window.clearTimeout(closer.timer); closer = null; }
      if (!autoClose || !session || !session.popup) return;
      var popup = session.popup;
      var c = { timer: 0 };
      c.timer = window.setTimeout(function () {
        if (closer === c) closer = null;
        try { if (!popup.closed) popup.close(); } catch (e) {}
      }, closeMs);
      closer = c;
    }

    function fromOurPopup(source) {
      var popup = session && session.popup;
      if (!popup || !source) return false;
      if (source === popup) return true;
      try { if (source.parent === popup) return true; } catch (e) {}
      try {
        var frames = popup.frames;
        for (var i = 0; frames && i < frames.length; i++) if (frames[i] === source) return true;
      } catch (e) {}
      return false;
    }

    function handOver(s, targets, force) {
      if (!s || !s.url || !targets || !targets.length) return false;
      if (s.sent && !force) return false;
      var name = s.name || "picture";
      if (!/\.(png|jpe?g|webp)$/i.test(name)) name = name.replace(/\.[a-z0-9]{2,5}$/i, "") + "." + (s.ext || (format === "png" ? "png" : "jpg"));
      var payload = { type: "bigger-pics-image", url: s.url, name: name, site: site, format: format, context: s.context };
      var posted = false;
      for (var i = 0; i < targets.length; i++) {
        try { targets[i].postMessage(payload, ORIGIN); posted = true; } catch (e) {}
      }
      if (!posted) { say("UPSCALE :: THE HANDOVER FAILED :: THE WINDOW WOULD NOT TAKE IT. CLOSE IT AND PRESS UPSCALE AGAIN."); return false; }
      s.sent = true;
      if (!s.told) {
        s.told = true;
        say("UPSCALE :: PICTURE HANDED OVER AS " + format.toUpperCase() + ". BIGGER.PICS IS UPSCALING IT NOW - IT COMES BACK HERE BY ITSELF, AND THE SMALLER ORIGINAL IS RETIRED THE MOMENT IT LANDS.");
      }
      return true;
    }

    function knock(s) {
      if (!s || s.sent || !s.url) return false;
      var targets = [];
      try {
        var frames = s.popup.frames;
        for (var i = 0; frames && i < frames.length; i++) targets.push(frames[i]);
      } catch (e) {}
      targets.push(s.popup);
      return handOver(s, targets, false);
    }

    function fail(why) {
      say("UPSCALE :: " + why);
      endSession();
      return { ok: false, why: why };
    }

    function fileResult(d) {
      var blob = d && d.blob;
      if (!blob || typeof blob.size !== "number" || !/^image\//.test(blob.type || "")) {
        say("UPSCALE :: WHAT CAME BACK WAS NOT A PICTURE - IGNORED.");
        return null;
      }
      var s = session;
      var cx = (d && d.context && d.context.context) || (d && d.context) || {};
      var fromId = cx.fromId || null;
      if (s) s.results = (s.results || 0) + 1;
      if (closer) { window.clearTimeout(closer.timer); closer = null; }
      var w = Number(d.width) || 0, h = Number(d.height) || 0;
      var from = fromId ? vault.get(fromId) : null;
      var name = baseName((from && from.name) || d.name) + "-" + (w && h ? w + "x" + h : "upscaled") + "." + extFor(blob);
      var tags = ((cx && cx.tags) || (s && s.tags) || []).concat((from && from.tags) || []);
      var id = vault.add({
        blob: blob, url: URL.createObjectURL(blob), name: name, w: w, h: h,
        tags: tags.filter(function (t, i, a) { return a.indexOf(t) === i; }),
        from: fromId, how: "upscale",
        note: "upscaled by bigger.pics" + (from && from.name ? " from " + from.name : "")
      });
      var replaced = false;
      if (fromId) {
        replaced = vault.remove(fromId);
      }
      say("UPSCALE COMPLETE :: " + name + " :: " + (w && h ? w + "x" + h + " :: " : "") + "FILED"
        + (replaced ? ", AND THE SMALLER ORIGINAL WAS RETIRED - ITS TAGS MOVED TO THE BIGGER ONE." : "."));
      var rec = { ok: true, id: id, name: name, width: w, height: h, url: vault.get(id).url, replaced: replaced, context: (d && d.context) || null };
      if (s && typeof s.onResult === "function") { try { s.onResult(rec); } catch (e) {} }
      if (s && !s.batch) closeSoon();
      return rec;
    }

    function handshake(e) {
      if (!session) return;
      if (e.origin !== ORIGIN) return;
      var d = e.data || {};
      if (d.type === "bigger-pics-ready") {
        if (session.sent) return;
        session.ready = true;
        session.frame = e.source;
        if (session.url) handOver(session, [e.source], false);
        return;
      }
      if (d.type === "bigger-pics-result") {
        var rec = fileResult(d);
        if (rec && session && typeof session.done === "function") {
          var done = session.done;
          session.done = null;
          try { done(rec); } catch (ex) {}
        }
      }
    }

    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("message", handshake);

    function upscale(source, run) {
      run = run || {};
      if (session) {
        try { if (session.popup && !session.popup.closed) session.popup.focus(); } catch (e) {}
        return Promise.resolve(fail("A BIGGER.PICS WINDOW IS ALREADY OPEN. LET IT FINISH, OR CLOSE IT, THEN TRY AGAIN."));
      }
      var rec = (typeof source === "string") ? vault.get(source) : source;
      if (!rec || !rec.blob) return Promise.resolve(fail("THAT PICTURE IS NOT IN THE VAULT. GIVE IT A MOMENT, THEN TRY AGAIN."));
      var popup = null;
      try { popup = opener(ENTRY, "_blank"); } catch (e) { popup = null; }
      if (!popup || popup.closed) return Promise.resolve(fail("THE BROWSER BLOCKED THE WINDOW. ALLOW POPUPS FOR THIS PAGE, THEN PRESS UPSCALE AGAIN."));
      say("UPSCALE :: BIGGER.PICS IS OPEN IN A WINDOW. FREE, AD-FUNDED, NO KEY. THE PICTURE LEAVES THIS DEVICE ONLY WHEN BIGGER.PICS ASKS FOR IT.");
      var s = session = {
        fromId: (typeof source === "string") ? source : null,
        name: rec.name || "picture", context: run.context || { fromId: (typeof source === "string") ? source : null, tags: run.tags || [] },
        tags: run.tags || [],
        popup: popup, frame: null, url: "", ready: false, sent: false, told: false,
        knocks: 0, slow: false, untaken: false, results: 0, started: Date.now(),
        batch: !!run.batch, done: null,
        onResult: (typeof run.onResult === "function") ? run.onResult : null,
        onClose: (typeof run.onClose === "function") ? run.onClose : null, poll: null
      };
      if (run.context && typeof run.context === "object") {
        if (!s.context.fromId && s.fromId) s.context.fromId = s.fromId;
        if (!s.context.tags) s.context.tags = s.tags;
      }
      s.poll = window.setInterval(function () {
        if (!session || session !== s) { window.clearInterval(s.poll); return; }
        var gone = false;
        try { gone = !!s.popup.closed; } catch (e) { gone = false; }
        if (gone) {
          var n = s.results || 0;
          var tell = s.onClose, done = s.done;
          endSession();
          if (!n) say("UPSCALE :: THE WINDOW WAS CLOSED WITHOUT SENDING ANYTHING BACK. NOTHING WAS ADDED AND NOTHING WAS CHANGED.");
          else if (n > 1) say("UPSCALE :: THE WINDOW IS CLOSED. " + n + " PICTURES CAME BACK, EVERY ONE FILED.");
          if (tell) { try { tell(n); } catch (e2) {} }
          if (done) { try { done({ ok: false, why: "THE WINDOW WAS CLOSED WITHOUT SENDING ANYTHING BACK." }); } catch (e3) {} }
          return;
        }
        var age = Date.now() - s.started;
        if (!s.ready && !s.sent && (s.knocks === 0 ? age > knockMs : s.knocks === 1 ? age > knockMs * 3 : s.knocks === 2 && age > knockMs * 6)) {
          s.knocks++;
          knock(s);
        }
        if (!s.sent && !s.untaken && age > slowMs) {
          s.untaken = true;
          say("UPSCALE :: BIGGER.PICS HAS NOT TAKEN THE PICTURE YET. IF THAT WINDOW IS STILL ASKING FOR A FILE, CLOSE IT AND PRESS UPSCALE AGAIN.");
        }
        if (s.sent && !s.slow && age > slowMs) {
          s.slow = true;
          say("UPSCALE :: BIGGER.PICS IS STILL WORKING ON IT. NOTHING NEEDS PRESSING - THE PICTURE COMES BACK BY ITSELF.");
        }
      }, pollMs);
      var out = new Promise(function (resolve) { s.done = resolve; });
      var tooBig = "THAT PICTURE IS BIGGER THAN 16 MB EVEN COMPRESSED, SO BIGGER.PICS CANNOT TAKE IT.";
      fitBlob(rec.blob).then(function (fit) {
        if (!session || session !== s) return;
        if (!fit) {
          fail(tooBig);
          if (s.done) { try { s.done({ ok: false, why: tooBig }); } catch (ex) {} }
          return;
        }
        s.ext = /jpe?g/i.test(fit.type || "") ? "jpg" : "png";
        return blobToDataUrl(fit).then(function (url) {
          if (!session || session !== s) return;
          s.url = url;
          if (s.ready) handOver(s, [s.frame], false);
        }, function (e) {
          if (session === s) fail("THE PICTURE COULD NOT BE PREPARED :: " + str((e && e.message) || e));
          if (s.done) { try { s.done({ ok: false, why: "THE PICTURE COULD NOT BE PREPARED." }); } catch (ex2) {} }
        });
      });
      return out;
    }

    function destroy() {
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("message", handshake);
      endSession();
    }

    return { upscale: upscale, vault: vault, destroy: destroy };
  }

  return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosUpscale;
