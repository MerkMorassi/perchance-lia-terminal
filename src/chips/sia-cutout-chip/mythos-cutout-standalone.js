window.MythosCutout = (function () {
  "use strict";

  var CDN = "https://esm.sh/@imgly/background-removal@1.5.5";

  function str(s) { return String(s == null ? "" : s); }

  function memLoader() {
    var mod = null;
    return async function () {
      if (!mod) mod = await import(CDN);
      return mod;
    };
  }

  function blobInfo(blob) {
    return { bytes: blob ? blob.size : 0, type: str(blob && blob.type) };
  }

  function loadImage(blob) {
    return new Promise(function (resolve, reject) {
      var obj = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var out = { img: img, revoke: function () { URL.revokeObjectURL(obj); } };
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(obj); reject(new Error("THE PICTURE COULD NOT BE DECODED.")); };
      img.src = obj;
    });
  }

  function drawCover(cx, img, w, h) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    var s = Math.max(w / iw, h / ih);
    var dw = iw * s, dh = ih * s;
    cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return true;
  }

  function canvasPng(canvas) {
    return new Promise(function (resolve) {
      try { canvas.toBlob(function (b) { resolve(b); }, "image/png"); }
      catch (e) { resolve(null); }
    });
  }

  function client(rawOpts) {
    var opts = rawOpts || {};
    var load = (typeof opts.loader === "function") ? opts.loader : memLoader();
    function say(t) { if (typeof opts.say === "function") { try { opts.say(t); } catch (e) {} } }

    async function cut(picture) {
      try {
        if (!picture || !(picture instanceof Blob) || !picture.size) {
          return { ok: false, why: "NOTHING TO CUT - HAND OVER A PICTURE (BLOB) FIRST." };
        }
        var started = Date.now();
        var mod = await load();
        if (!mod || typeof mod.removeBackground !== "function") {
          return { ok: false, why: "THE CUTTING ENGINE DID NOT LOAD - CHECK THE CONNECTION AND TRY AGAIN." };
        }
        say("CUTOUT :: CUTTING THE SUBJECT OUT OF " + blobInfo(picture).bytes + " BYTES.");
        var out = await mod.removeBackground(picture);
        if (!out || !out.size) return { ok: false, why: "THE CUT CAME BACK EMPTY - THE PICTURE MAY HAVE NO SUBJECT IN IT." };
        var held = await loadImage(out);
        var w = held.img.naturalWidth, h = held.img.naturalHeight;
        held.revoke();
        say("CUTOUT :: SUBJECT FREED IN " + (Date.now() - started) + " MS.");
        return { ok: true, blob: out, width: w, height: h, ms: Date.now() - started };
      } catch (e) {
        return { ok: false, why: "THE CUT FAILED - " + str((e && e.message) || e).slice(0, 160).toUpperCase() + "." };
      }
    }

    async function composite(fgBlob, bg, runOpts) {
      var o = runOpts || {};
      try {
        if (!fgBlob || !(fgBlob instanceof Blob) || !fgBlob.size) {
          return { ok: false, why: "NOTHING TO PLACE - CUT A SUBJECT FIRST." };
        }
        var fg = await loadImage(fgBlob);
        var W = o.width || fg.img.naturalWidth, H = o.height || fg.img.naturalHeight;
        if (!W || !H) { fg.revoke(); return { ok: false, why: "THE SUBJECT HAS NO SIZE - CUT IT AGAIN." }; }
        var c = document.createElement("canvas");
        c.width = W; c.height = H;
        var cx = c.getContext("2d");
        if (bg instanceof Blob && bg.size) {
          var back = await loadImage(bg);
          drawCover(cx, back.img, W, H);
          back.revoke();
        } else {
          cx.fillStyle = str(bg || "#000000");
          cx.fillRect(0, 0, W, H);
        }
        var sc = Number(o.scale) || 1;
        var dw = fg.img.naturalWidth * sc, dh = fg.img.naturalHeight * sc;
        var dx = (o.x !== undefined && o.x !== null) ? Number(o.x) : (W - dw) / 2;
        var dy = (o.y !== undefined && o.y !== null) ? Number(o.y) : (H - dh) / 2;
        cx.drawImage(fg.img, dx, dy, dw, dh);
        fg.revoke();
        var png = await canvasPng(c);
        if (!png) return { ok: false, why: "THE NEW SCENE COULD NOT BE ENCODED." };
        return { ok: true, blob: png, width: W, height: H };
      } catch (e) {
        return { ok: false, why: "THE SCENE FAILED - " + str((e && e.message) || e).slice(0, 160).toUpperCase() + "." };
      }
    }

    async function info(picture) {
      try {
        if (!picture || !(picture instanceof Blob) || !picture.size) {
          return { ok: false, why: "NOTHING TO READ - HAND OVER A PICTURE (BLOB) FIRST." };
        }
        var held = await loadImage(picture);
        var out = { ok: true, width: held.img.naturalWidth, height: held.img.naturalHeight, bytes: picture.size, type: str(picture.type) };
        held.revoke();
        return out;
      } catch (e) {
        return { ok: false, why: "THE PICTURE COULD NOT BE READ." };
      }
    }

    return { cut: cut, composite: composite, info: info };
  }

  return { client: client, CDN: CDN };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosCutout;
