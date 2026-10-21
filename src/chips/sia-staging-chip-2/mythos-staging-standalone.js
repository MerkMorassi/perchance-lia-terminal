window.MythosStaging = (function () {
  "use strict";

  function str(s) { return String(s == null ? "" : s); }
  function num(v, d) { var n = Number(v); return (isFinite(n) ? n : d); }

  function loadBitmap(blob) {
    return new Promise(function (resolve, reject) {
      var obj = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        createImageBitmap(img).then(function (bmp) {
          URL.revokeObjectURL(obj);
          resolve(bmp);
        }, function (e) { URL.revokeObjectURL(obj); reject(e); });
      };
      img.onerror = function () { URL.revokeObjectURL(obj); reject(new Error("UNDECODABLE")); };
      img.src = obj;
    });
  }

  function canvasPng(canvas) {
    return new Promise(function (resolve) {
      try { canvas.toBlob(function (b) { resolve(b); }, "image/png"); }
      catch (e) { resolve(null); }
    });
  }

  var POSES = {
    left: { x: 0.22, y: 0.62, s: 0.62 },
    center: { x: 0.5, y: 0.62, s: 0.66 },
    right: { x: 0.78, y: 0.62, s: 0.62 },
    "seat-left": { x: 0.3, y: 0.97, s: 0.6 },
    "seat-center": { x: 0.5, y: 0.97, s: 0.64 },
    "seat-right": { x: 0.7, y: 0.97, s: 0.6 }
  };

  function client(rawOpts) {
    var opts = rawOpts || {};
    var root = opts.el || null;
    var n = 0;
    var bg = null;
    var subjects = [];
    var selected = "";
    var say = (typeof opts.say === "function") ? opts.say : function () {};

    var stage = null, bar = null, note = null;
    var drag = null;

    function find(id) {
      for (var i = 0; i < subjects.length; i++) if (subjects[i].id === id) return subjects[i];
      return null;
    }

    function boxOf(sb, W, H) {
      var dw = sb.bmp.width * sb.scale, dh = sb.bmp.height * sb.scale;
      return { x: sb.x * W - dw / 2, y: sb.y * H - dh, w: dw, h: dh };
    }

    function paint() {
      if (!stage) return;
      var W = stage.width, H = stage.height;
      var cx = stage.getContext("2d");
      cx.clearRect(0, 0, W, H);
      if (!bg) {
        cx.fillStyle = "#0a0f0a";
        cx.fillRect(0, 0, W, H);
        cx.fillStyle = "#3f7a3f";
        cx.font = "16px monospace";
        cx.fillText("DROP A SCENE, THEN YOUR SUBJECTS", 12, 28);
        return;
      }
      cx.drawImage(bg.bmp, 0, 0, W, H);
      for (var i = 0; i < subjects.length; i++) {
        var sb = subjects[i], b = boxOf(sb, W, H);
        cx.drawImage(sb.bmp, b.x, b.y, b.w, b.h);
        if (sb.id === selected) {
          cx.strokeStyle = "#7aff7a";
          cx.lineWidth = Math.max(1, W / 400);
          cx.strokeRect(b.x, b.y, b.w, b.h);
        }
      }
    }

    function flash(t) {
      say(t);
      if (note) note.textContent = t;
    }

    function toStage(ev) {
      var r = stage.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * (stage.width / Math.max(1, r.width)),
        y: (ev.clientY - r.top) * (stage.height / Math.max(1, r.height))
      };
    }

    function hit(p) {
      if (!bg) return null;
      for (var i = subjects.length - 1; i >= 0; i--) {
        var sb = subjects[i], b = boxOf(sb, stage.width, stage.height);
        if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
        var sx = Math.floor((p.x - b.x) / sb.scale), sy = Math.floor((p.y - b.y) / sb.scale);
        if (sx < 0 || sy < 0 || sx >= sb.alpha.width || sy >= sb.alpha.height) continue;
        try {
          var a = sb.alpha.data[(sy * sb.alpha.width + sx) * 4 + 3];
          if (a > 12) return sb;
        } catch (e) { return sb; }
      }
      return null;
    }

    function alphaOf(bmp) {
      var c = document.createElement("canvas");
      c.width = bmp.width; c.height = bmp.height;
      var cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0);
      try { return { width: c.width, height: c.height, data: cx.getImageData(0, 0, c.width, c.height).data }; }
      catch (e) { return { width: c.width, height: c.height, data: new Uint8ClampedArray(0) }; }
    }

    async function addBitmap(bmp, place) {
      var p = place || {};
      n++;
      var sb = {
        id: "sub-" + n, name: str(p.name || ("subject " + n)), bmp: bmp,
        x: (p.x !== undefined) ? num(p.x, 0.5) : 0.5,
        y: (p.y !== undefined) ? num(p.y, 0.62) : 0.62,
        scale: num(p.scale, 0.6) || 0.6, alpha: null
      };
      sb.alpha = alphaOf(bmp);
      subjects.push(sb);
      selected = sb.id;
      paint();
      return { ok: true, id: sb.id, name: sb.name, x: sb.x, y: sb.y, scale: sb.scale };
    }

    async function setBackground(blob) {
      try {
        if (!blob || !(blob instanceof Blob) || !blob.size) {
          return { ok: false, why: "NOTHING TO STAGE ON - HAND OVER A SCENE PICTURE FIRST." };
        }
        var bmp = await loadBitmap(blob);
        if (bg && bg.bmp) { try { bg.bmp.close(); } catch (e) {} }
        bg = { bmp: bmp, width: bmp.width, height: bmp.height };
        if (stage) { stage.width = bmp.width; stage.height = bmp.height; }
        paint();
        flash("STAGE :: SCENE SET " + bmp.width + "x" + bmp.height + ".");
        return { ok: true, width: bmp.width, height: bmp.height };
      } catch (e) {
        return { ok: false, why: "THE SCENE WOULD NOT LOAD - " + str(e && e.message || e).slice(0, 120).toUpperCase() + "." };
      }
    }

    async function addSubject(blob, place) {
      try {
        if (!bg) return { ok: false, why: "NO SCENE YET - SET THE SCENE BEFORE PLACING SUBJECTS." };
        if (!blob || !(blob instanceof Blob) || !blob.size) {
          return { ok: false, why: "NOTHING TO PLACE - HAND OVER A SUBJECT PICTURE FIRST." };
        }
        var bmp = await loadBitmap(blob);
        var r = await addBitmap(bmp, place);
        flash("STAGE :: " + r.name.toUpperCase() + " PLACED. DRAG TO BLOCK, WHEEL TO SIZE.");
        return r;
      } catch (e) {
        return { ok: false, why: "THE SUBJECT WOULD NOT LOAD - " + str(e && e.message || e).slice(0, 120).toUpperCase() + "." };
      }
    }

    async function cutAddSubject(blob, place) {
      if (!window.MythosCutout || typeof window.MythosCutout.client !== "function") {
        return { ok: false, why: "NO CUTTING ENGINE - WEAR THE CUTOUT CHIP OR HAND OVER AN ALREADY-CUT SUBJECT." };
      }
      flash("STAGE :: CUTTING THE SUBJECT OUT FIRST.");
      try {
        var cutter = window.MythosCutout.client();
        var r = await cutter.cut(blob);
        if (!r.ok) return r;
        return await addSubject(r.blob, place);
      } catch (e) {
        return { ok: false, why: "THE CUT FAILED - " + str(e && e.message || e).slice(0, 120).toUpperCase() + "." };
      }
    }

    function place(id, p) {
      var sb = find(id);
      if (!sb) return { ok: false, why: "NO SUBJECT NAMED " + str(id).toUpperCase() + " IS ON STAGE." };
      p = p || {};
      if (p.x !== undefined) sb.x = num(p.x, sb.x);
      if (p.y !== undefined) sb.y = num(p.y, sb.y);
      if (p.scale !== undefined) sb.scale = num(p.scale, sb.scale) || sb.scale;
      paint();
      return { ok: true, id: sb.id, x: sb.x, y: sb.y, scale: sb.scale };
    }

    function block(id, pose) {
      var p = POSES[str(pose || "").toLowerCase()];
      if (!p) {
        return { ok: false, why: "NO SUCH MARK - " + Object.keys(POSES).join(" | ").toUpperCase() + "." };
      }
      return place(id, { x: p.x, y: p.y, scale: p.s });
    }

    function marks() { return Object.keys(POSES); }

    function nudge(id, dx, dy) {
      var sb = find(id);
      if (!sb || !bg) return { ok: false, why: "NOTHING TO NUDGE." };
      sb.x += num(dx, 0) / bg.width;
      sb.y += num(dy, 0) / bg.height;
      paint();
      return { ok: true, id: sb.id, x: sb.x, y: sb.y };
    }

    function order(id, front) {
      var ix = -1;
      for (var i = 0; i < subjects.length; i++) if (subjects[i].id === id) ix = i;
      if (ix < 0) return { ok: false, why: "NO SUBJECT NAMED " + str(id).toUpperCase() + " IS ON STAGE." };
      var sb = subjects.splice(ix, 1)[0];
      if (front) subjects.push(sb); else subjects.unshift(sb);
      paint();
      return { ok: true, id: id, front: !!front };
    }

    function removeSubject(id) {
      for (var i = 0; i < subjects.length; i++) {
        if (subjects[i].id === id) {
          try { subjects[i].bmp.close(); } catch (e) {}
          subjects.splice(i, 1);
          if (selected === id) selected = "";
          paint();
          return { ok: true, id: id };
        }
      }
      return { ok: false, why: "NO SUBJECT NAMED " + str(id).toUpperCase() + " IS ON STAGE." };
    }

    function list() {
      return subjects.map(function (sb) {
        return { id: sb.id, name: sb.name, x: sb.x, y: sb.y, scale: sb.scale };
      });
    }

    function scene() {
      return {
        bg: bg ? { width: bg.width, height: bg.height } : null,
        subjects: list()
      };
    }

    async function render() {
      if (!bg) return { ok: false, why: "NOTHING TO RENDER - SET THE SCENE FIRST." };
      try {
        var c = document.createElement("canvas");
        c.width = bg.width; c.height = bg.height;
        var cx = c.getContext("2d");
        cx.drawImage(bg.bmp, 0, 0);
        for (var i = 0; i < subjects.length; i++) {
          var b = boxOf(subjects[i], c.width, c.height);
          cx.drawImage(subjects[i].bmp, b.x, b.y, b.w, b.h);
        }
        var blob = await canvasPng(c);
        if (!blob) return { ok: false, why: "THE STILL WOULD NOT ENCODE." };
        return { ok: true, blob: blob, width: c.width, height: c.height, subjects: subjects.length };
      } catch (e) {
        return { ok: false, why: "THE RENDER FAILED - " + str(e && e.message || e).slice(0, 120).toUpperCase() + "." };
      }
    }

    function pickFile(accept, done) {
      var inp = document.createElement("input");
      inp.type = "file";
      inp.accept = accept || "image/*";
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (f) done(f);
      };
      inp.click();
    }

    function build() {
      root.innerHTML = "";
      var doc = root.ownerDocument || document;
      bar = doc.createElement("div");
      bar.className = "stagingBar";
      function btn(label, fn) {
        var b = doc.createElement("button");
        b.textContent = label;
        b.onclick = fn;
        bar.appendChild(b);
        return b;
      }
      btn("SET SCENE", function () { pickFile("image/*", function (f) { setBackground(f); }); });
      btn("ADD SUBJECT", function () { pickFile("image/*", function (f) { addSubject(f); }); });
      btn("CUT+ADD", function () { pickFile("image/*", function (f) { cutAddSubject(f); }); });
      btn("FRONT", function () { if (selected) order(selected, true); });
      btn("BACK", function () { if (selected) order(selected, false); });
      btn("DROP", function () { if (selected) { removeSubject(selected); flash("STAGE :: SUBJECT DROPPED."); } });
      btn("STILL", async function () {
        var r = await render();
        if (!r.ok) { flash(r.why); return; }
        var a = doc.createElement("a");
        a.href = URL.createObjectURL(r.blob);
        a.download = "still.png";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        flash("STAGE :: STILL SAVED " + r.width + "x" + r.height + ".");
      });
      note = doc.createElement("div");
      note.className = "stagingNote";
      stage = doc.createElement("canvas");
      stage.className = "stagingCanvas";
      stage.width = 768; stage.height = 512;
      stage.addEventListener("pointerdown", function (ev) {
        if (!bg) return;
        try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
        var p = toStage(ev);
        var sb = hit(p);
        selected = sb ? sb.id : "";
        if (sb) {
          var b = boxOf(sb, stage.width, stage.height);
          drag = { id: sb.id, dx: p.x - (sb.x * stage.width), dy: p.y - (sb.y * stage.height), moved: false };
        } else drag = null;
        paint();
      });
      stage.addEventListener("pointermove", function (ev) {
        if (!drag || !bg) return;
        var p = toStage(ev);
        var sb = find(drag.id);
        if (!sb) { drag = null; return; }
        sb.x = (p.x - drag.dx) / stage.width;
        sb.y = (p.y - drag.dy) / stage.height;
        drag.moved = true;
        paint();
      });
      stage.addEventListener("pointerup", function () {
        if (drag && drag.moved) flash("STAGE :: BLOCKED " + drag.id.toUpperCase() + ".");
        drag = null;
      });
      stage.addEventListener("wheel", function (ev) {
        if (!selected || !bg) return;
        ev.preventDefault();
        var sb = find(selected);
        if (!sb) return;
        sb.scale = Math.min(3, Math.max(0.05, sb.scale * (ev.deltaY > 0 ? 0.93 : 1.075)));
        paint();
      }, { passive: false });
      stage.addEventListener("dragover", function (ev) { ev.preventDefault(); });
      stage.addEventListener("drop", function (ev) {
        ev.preventDefault();
        var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (!f) return;
        if (!bg) setBackground(f); else addSubject(f);
      });
      root.appendChild(bar);
      root.appendChild(stage);
      root.appendChild(note);
      paint();
    }

    function clear() {
      if (bg && bg.bmp) { try { bg.bmp.close(); } catch (e) {} }
      bg = null;
      subjects.forEach(function (sb) { try { sb.bmp.close(); } catch (e) {} });
      subjects = [];
      selected = "";
      paint();
    }

    function destroy() {
      clear();
      if (root) root.innerHTML = "";
      stage = null; bar = null; note = null;
    }

    if (root) build();

    return {
      setBackground: setBackground, addSubject: addSubject, cutAddSubject: cutAddSubject,
      place: place, block: block, marks: marks, nudge: nudge,
      front: function (id) { return order(id, true); },
      back: function (id) { return order(id, false); },
      removeSubject: removeSubject, subjects: list, list: list,
      scene: scene, render: render, clear: clear, destroy: destroy,
      selectedId: function () { return selected; }
    };
  }

  return { client: client, MARKS: Object.keys(POSES) };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosStaging;
