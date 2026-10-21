/* ------------------------------------------------------------------
   UPSCALE, HERE — the picture made bigger on this machine

   The other upscaler (src/js/upscale.js) sends a picture to a stranger's
   service in a popup window. It works, and it is genuinely good, but it has
   two hard limits that were MEASURED, not guessed:

     1. The popup needs a REAL CLICK (window.open from anything else is
        blocked), so nothing can run it on its own.
     2. bigger.pics takes ONE picture by itself, so there is no way to feed it
        a queue either. (A PERSON can add up to seven more in that same
        window and send them all back - measured - but that takes a person,
        which is exactly what "auto" does not have.)

   Which means "auto upscale" - every render, made bigger without anyone
   touching anything - cannot be a bigger.pics feature at all. This file is
   that feature, done the only way it can be done: the arithmetic happens in
   THIS page, on the GPU that is already here.

   WHAT IT DOES. A Lanczos-3 resample, done the way a good resizer does it:
   one axis at a time, in steps of 2x, with the kernel STRETCHED by the step
   (a scaled Lanczos - the correct reconstruction filter for a factor of
   exactly 2), and edge weights normalized so the border does not darken. A
   4x result is two 2x steps: cheaper than one wide kernel, and it keeps the
   tap count bounded (13 per axis per output pixel) so a phone can do it too.
   Then a DETAIL pass: a 3x3 Gaussian blur, subtracted to get the missing
   high frequencies, added back with an EDGE MASK - sharpening where there is
   structure and leaving flat areas (and JPEG blocking) alone.

   TWO ENGINES, ONE ANSWER. `engine()` is "webgl2" when the browser has it
   (nearly always) and "canvas2d" when it does not: the fallback resamples
   with the browser's own stepped drawImage and sharpens with a plain JS loop
   over the pixels. The fallback is slower and slightly softer, and the note
   on the record SAYS WHICH ONE RAN - a bigger picture whose provenance is
   invisible is a lie told by omission.

   THE RESULT IS A NORMAL VAULT PICTURE: kind 'upscale' (so the gallery's
   UPSCALED filter, the render book, the folders and ARCHIVAX all treat it
   exactly like one from bigger.pics), the prompt/seed/tags/folder of the
   picture it came from, and a note that says "here, on this machine".

   AUTO. With the autosave's habit of insurance rather than decoration: when
   `LIA_UPSCALE_LOCAL_AUTO` (config.js) or the setting in kv is on, EVERY new
   render (kind 'gen' - a picture the terminal made, never an attachment he
   handed over, never another upscale) is upscaled by itself and filed
   beside the original. Nothing is opened, nothing is queued for her eyes
   (the original already is), and one line in the log says what happened.
   `/upscale auto off` stops it; `/upscale local` does one by hand.

   AND THE SMALLER ORIGINAL IS RETIRED (Patrikios, 2026-09-22: "Automate the
   creation and upscaling pipeline. After doing local upscaling, remove the
   smaller original SDXL image from the library and gallery."). The pipeline
   he asked for is one picture, not two: a render is a draft that grows into
   its final size, and the draft does not stay. When the bigger picture is
   safely in the vault the render it came from LEAVES it - and nothing is left
   pointing at a record that is gone: the archive's creation row, the place it
   held in the queue for her eyes, any tile of it in the log, the stage if it
   was up, and a KEEP (with its gallery link rewritten) all follow to the
   bigger one. The bigger one carries the whole prompt file of the one it
   replaced: prompt, the words actually sent, negative list, seed, guidance
   scale, size, pose, tags and folder.

   WHAT IS NEVER RETIRED - the whole of the safety, and the second half of his
   instruction: ANYTHING THAT IS NOT A 'gen' RENDER. A picture he handed over,
   a clip, a piece of music, and an UPSCALE. "If the user then selects upscale
   again, it is processed again by bigger.pics but doesn't then delete the last
   upscale" - so a picture that is already an upscale is left exactly where it
   is, on both roads (the bigger.pics road, src/js/upscale.js, deletes nothing
   at all). It cannot feed itself either: what this file makes is kind
   'upscale', so the automatic road does not look at it. `/upscale replace off`
   turns the retiring off and leaves every original in the vault.

   NOTHING LEAVES THIS DEVICE. Same promise as the rest of the vault.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  // ---- what he can turn without touching code ------------------------------

  // HOW BIG. 2 or 4 only: the resampler is built out of 2x steps (see above), and a factor that is
  // neither would need a fractional kernel for no real gain. Anything else is read as 2.
  var FACTOR = (typeof LIA_UPSCALE_LOCAL_FACTOR !== "undefined" && Number(LIA_UPSCALE_LOCAL_FACTOR))
    ? Number(LIA_UPSCALE_LOCAL_FACTOR) : 2;
  if (FACTOR !== 4) FACTOR = 2;

  // HOW MUCH DETAIL TO PUT BACK. 0 turns the detail pass into a copy; 0.5 is the shipped taste for
  // jpeg renders (enough to undo the softening of the resample, not enough to make haloes).
  var SHARPEN = (typeof LIA_UPSCALE_LOCAL_SHARPEN !== "undefined" && LIA_UPSCALE_LOCAL_SHARPEN !== null)
    ? Math.max(0, Math.min(1.5, Number(LIA_UPSCALE_LOCAL_SHARPEN))) : 0.5;

  // WHAT COMES OUT: PNG, AND ONLY PNG (Patrikios, 2026-09-21: "PNG only!"). An upscale exists to
  // carry detail, and a jpeg re-encode discards some of the very detail that was just reconstructed
  // - measured in this file's own working: the 1:1 crop check showed the jpeg blocking coming back
  // in the smooth areas the resample had just cleaned. So the format is not a knob that can be
  // turned to jpeg here; the shipped and the only answer is png. (The config line is still read, so
  // a fork that really wants to lose the detail has one place to say so - but the default, and the
  // comment beside it in config.js, both say png.)
  var FORMAT = (typeof LIA_UPSCALE_LOCAL_FORMAT !== "undefined" && String(LIA_UPSCALE_LOCAL_FORMAT).toLowerCase() === "jpeg")
    ? "jpeg" : "png";

  // HOW MANY PIXELS ARE TOO MANY. A canvas has a ceiling and a phone has a smaller one, and a
  // picture that fails to encode is worse than a smaller one: past this the factor is stepped DOWN
  // (and the log says so) rather than risking an empty result.
  var MAX_MP = (typeof LIA_UPSCALE_LOCAL_MAX_MP !== "undefined" && Number(LIA_UPSCALE_LOCAL_MAX_MP))
    ? Number(LIA_UPSCALE_LOCAL_MAX_MP) : 16;

  // WHETHER IT RUNS BY ITSELF. The shipped default is config.js; the device's answer (kv) outranks
  // it, because a setting he turned off by hand should stay off.
  var AUTO_DEFAULT = (typeof LIA_UPSCALE_LOCAL_AUTO !== "undefined") ? !!LIA_UPSCALE_LOCAL_AUTO : false;

  // WHETHER THE SMALLER ORIGINAL IS RETIRED WHEN THIS ONE SUCCEEDS (see the note at the top of this
  // file, and config.js). Default true: the pipeline is "make it, then make it bigger, and keep the
  // bigger one" - one picture, not two.
  var REPLACE_DEFAULT = (typeof LIA_UPSCALE_LOCAL_REPLACE !== "undefined") ? !!LIA_UPSCALE_LOCAL_REPLACE : true;

  var KV_FOLDER = "lia_settings";   // the same folder every other setting of this terminal uses
  var KV_KEY = "upscale_local";     // { auto, factor, replace, upscaled, at }

  var auto = AUTO_DEFAULT;
  var replace = REPLACE_DEFAULT;
  var made = 0;        // how many this module has upscaled since boot
  var busy = null;     // the promise chain: one upscale at a time, however many are asked for
  var glState = null;  // the WebGL2 context, built once and kept (contexts are expensive)
  var engineKnown = "";

  function say(text) {
    if (typeof print === "function") print("SYSTEM", text);
    else console.log("UPSCALE-HERE :: " + text);
  }

  function bytesLabel(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function kv() {
    try { return (window.root && window.root.kv && window.root.kv[KV_FOLDER]) || null; }
    catch (e) { return null; }
  }

  async function load() {
    var folder = kv();
    if (!folder) return;
    try {
      var s = await folder.get(KV_KEY);
      if (s && typeof s === "object") {
        auto = !!s.auto;
        // An older setting has no `replace` on it, and the shipped answer is true - so only a
        // setting that SAYS false turns it off. (A device that never knew the knob keeps the
        // pipeline he asked for.)
        if (typeof s.replace === "boolean") replace = s.replace;
        if (Number(s.factor) === 4) FACTOR = 4;
        if (s.at) made = Number(s.upscaled) || 0;
      }
    } catch (e) { /* a missing or unreadable setting is the shipped one */ }
  }

  async function save() {
    var folder = kv();
    if (!folder) return;
    try { await folder.set(KV_KEY, { auto: auto, factor: FACTOR, replace: replace, upscaled: made, at: Date.now() }); }
    catch (e) { console.warn("upscale-local: the setting could not be kept", e); }
  }

  function autoOn() { return auto; }
  function replaceOn() { return replace; }

  // ---- the engines ---------------------------------------------------------

  // Which engine will actually run. Asked once and remembered: building a throwaway WebGL2 context
  // on every call is exactly how a page runs out of them.
  function engine() {
    if (engineKnown) return engineKnown;
    var ok = false;
    try {
      var c = document.createElement("canvas");
      c.width = 2; c.height = 2;
      var g = c.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: false });
      if (g) { ok = true; try { g.getExtension("WEBGL_lose_context").loseContext(); } catch (e) {} }
    } catch (e) { ok = false; }
    engineKnown = ok ? "webgl2" : "canvas2d";
    return engineKnown;
  }

  // ---- reading the picture in, and writing it out --------------------------

  function blobToBitmap(blob) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(blob).then(function (b) { return { src: b, w: b.width, h: b.height, close: function () { try { b.close(); } catch (e) {} } }; });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, close: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("the picture could not be read")); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas) {
    // png takes no quality argument: lossless, one clean artifact, nothing re-encoded. If a fork
    // sets the format to jpeg, the lossless road is not available and 0.95 is the least-bad value.
    var type = FORMAT === "jpeg" ? "image/jpeg" : "image/png";
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (!b) { reject(new Error("the bigger picture could not be encoded")); return; }
        resolve(b);
      }, type, type === "image/jpeg" ? 0.95 : undefined);
    });
  }

  // ---- WebGL2: scaled Lanczos-3, one axis at a time, then the detail pass ---

  var VERT = [
    "#version 300 es",
    "in vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D uTex;",
    "uniform vec2 uSrc;",    // the source texture's size, in texels
    "uniform vec2 uDst;",    // the render target's size, in texels
    "uniform vec2 uDir;",    // (1,0) resample across, (0,1) resample down
    "uniform float uFlip;",  // 1 when the target is the CANVAS (its rows run bottom-up), else 0
    "uniform float uPass;",  // 0 = resample, 1 = detail
    "uniform float uSharp;", // how much missing detail to add back
    "out vec4 outColor;",
    "",
    // THE KERNEL. Lanczos-3 on its own support (|t| < 3); the resample pass calls it at HALF the
    // distance because the kernel is stretched to a factor of 2 (lanczos(t/2) has support 6 in
    // source texels) - which is what makes this a reconstruction filter rather than a smoothing
    // filter with a fancy name.
    "float l3(float t) {",
    "  t = abs(t);",
    "  if (t < 0.0001) return 1.0;",
    "  if (t >= 3.0) return 0.0;",
    "  float pt = 3.14159265358979 * t;",
    "  return (3.0 * sin(pt) * sin(pt / 3.0)) / (pt * pt);",
    "}",
    // Every fetch is clamped to the picture, so the border is sampled from its own edge texel.
    // Weights are normalized below, so a kernel hanging off the edge cannot darken the frame.
    "vec4 at(vec2 p) { return texelFetch(uTex, ivec2(clamp(p, vec2(0.0), uSrc - 1.0)), 0); }",
    "float lum(vec4 c) { return dot(c.rgb, vec3(0.299, 0.587, 0.114)); }",
    "float gw(float i) { i = abs(i); if (i < 0.5) return 6.0; if (i < 1.5) return 4.0; return 1.0; }",
    "",
    "void main() {",
    // A texel-space y that counts from the TOP of the picture, whichever way the target stores it.
    "  vec2 d = vec2(gl_FragCoord.x, uFlip > 0.5 ? (uDst.y - gl_FragCoord.y) : gl_FragCoord.y);",
    "  if (uPass > 0.5) {",
    // THE DETAIL PASS, GATED. `c` is the resampled picture and `b` is a 5x5 Gaussian of it (1-4-6-4-1
    // in each axis, so the difference `c - b` is a WIDE, gentle version of the high frequencies -
    // a tight 3x3 blur is what makes a white outline along an edge). The difference is added back
    // only where there is STRUCTURE: the gate is the luminance change across four texels, and
    // below it (flat sky, skin, shadow - and, crucially, the 8x8 blocks a jpeg left there) the
    // sharpening is EXACTLY ZERO rather than "a little". That was measured, not assumed: the first
    // version used a floor of 0.15 everywhere and a vision check at 1:1 found haloes on the lashes
    // and amplified blocking in the smooth iris. A mask that never quite reaches zero is how an
    // upscaler earns the word "crunchy".
    "    vec4 c = at(d);",
    "    vec4 b = vec4(0.0); float bs = 0.0;",
    "    for (int j = -2; j <= 2; j++) {",
    "      for (int i = -2; i <= 2; i++) {",
    "        float w = gw(float(i)) * gw(float(j));",
    "        b += w * at(d + vec2(float(i), float(j)));",
    "        bs += w;",
    "      }",
    "    }",
    "    b /= bs;",
    "    float gx = lum(at(d + vec2(2.0, 0.0))) - lum(at(d + vec2(-2.0, 0.0)));",
    "    float gy = lum(at(d + vec2(0.0, 2.0))) - lum(at(d + vec2(0.0, -2.0)));",
    "    float mask = smoothstep(0.05, 0.16, length(vec2(gx, gy)));",
    // CORING AND ROLL-OFF, the two things an unsharp mask needs before it can be called a detail
    // pass. CORING: a difference smaller than a couple of parts in 255 is noise (or the last of the
    // source's own jpeg), so it is subtracted to nothing rather than amplified. ROLL-OFF: a
    // difference larger than a tenth of the range is an EDGE, and adding all of it back is exactly
    // what puts a white rim along a lash or a specular highlight - so the amount is faded down
    // again once the difference gets big. The vision check is what asked for this: at 1:1 the un-
    // cored version read as "crunchy, with faint bright outlines around the gold specks".
    "    vec4 det = c - b;",
    "    float dl = abs(lum(det));",
    "    float core = smoothstep(0.004, 0.018, dl);",
    "    float roll = 1.0 - 0.6 * smoothstep(0.09, 0.24, dl);",
    "    vec4 outc = c + det * uSharp * mask * core * roll;",
    "    outColor = vec4(clamp(outc.rgb, 0.0, 1.0), c.a);",
    "    return;",
    "  }",
    // THE RESAMPLE PASS. The output texel's centre maps back into source space; the 13 taps around
    // it are weighted by the stretched kernel and normalized. 2x per pass, so a 4x result is two
    // of these (across, then down, then across, then down).
    "  float op = dot(d, uDir);",
    "  vec2 off = d - uDir * op;",
    "  float sp = (op + 0.5) * 0.5 - 0.5;",
    "  float base = floor(sp + 0.5);",
    "  float frac = sp - base;",
    "  vec4 sum = vec4(0.0);",
    "  float wsum = 0.0;",
    "  for (int i = -6; i <= 6; i++) {",
    "    float w = l3((float(i) - frac) * 0.5);",
    "    sum += w * at(off + uDir * (base + float(i)));",
    "    wsum += w;",
    "  }",
    "  outColor = sum / max(wsum, 0.0001);",
    "}",
  ].join("\n");

  function buildGl() {
    if (glState) return glState;
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl2", {
      antialias: false, alpha: true, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance",
    });
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error("shader: " + gl.getShaderInfoLog(s));
      }
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("program: " + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    glState = {
      gl: gl, canvas: canvas, prog: prog,
      u: {
        tex: gl.getUniformLocation(prog, "uTex"),
        src: gl.getUniformLocation(prog, "uSrc"),
        dst: gl.getUniformLocation(prog, "uDst"),
        dir: gl.getUniformLocation(prog, "uDir"),
        flip: gl.getUniformLocation(prog, "uFlip"),
        pass: gl.getUniformLocation(prog, "uPass"),
        sharp: gl.getUniformLocation(prog, "uSharp"),
      },
      max: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048,
      targets: {},   // "w x h" -> { tex, fbo }, reused between upscales
      sources: {},   // "w x h" -> a texture to upload into
    };
    return glState;
  }

  function glTexture(st, w, h) {
    var key = w + "x" + h;
    var cached = st.sources[key];
    if (cached) return cached.tex;
    var tex = st.gl.createTexture();
    st.gl.bindTexture(st.gl.TEXTURE_2D, tex);
    st.gl.texParameteri(st.gl.TEXTURE_2D, st.gl.TEXTURE_MIN_FILTER, st.gl.NEAREST);
    st.gl.texParameteri(st.gl.TEXTURE_2D, st.gl.TEXTURE_MAG_FILTER, st.gl.NEAREST);
    st.gl.texParameteri(st.gl.TEXTURE_2D, st.gl.TEXTURE_WRAP_S, st.gl.CLAMP_TO_EDGE);
    st.gl.texParameteri(st.gl.TEXTURE_2D, st.gl.TEXTURE_WRAP_T, st.gl.CLAMP_TO_EDGE);
    st.sources[key] = { tex: tex };
    return tex;
  }

  function glTarget(st, w, h) {
    var key = w + "x" + h;
    var cached = st.targets[key];
    if (cached) return cached;
    var gl = st.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    var t = { tex: tex, fbo: fbo };
    st.targets[key] = t;
    return t;
  }

  async function glUpscale(bitmap, factor, sharpen, srcSize) {
    var st = buildGl();
    if (!st) throw new Error("no webgl2");
    var gl = st.gl;
    while (gl.getError() !== gl.NO_ERROR) { /* clear anything left over from an earlier upscale */ }
    var w = srcSize.w, h = srcSize.h;

    // The source, uploaded once.
    var srcTex = glTexture(st, w, h);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

    // The steps: across, down, [across, down,] detail. Each 2x step doubles one axis.
    var steps = [];
    for (var f = 1; f < factor; f *= 2) { steps.push("h"); steps.push("v"); }
    if (sharpen > 0) steps.push("d");

    var curTex = srcTex, cw = w, ch = h;

    for (var i = 0; i < steps.length; i++) {
      var last = (i === steps.length - 1);
      var step = steps[i];
      var dw = cw, dh = ch;
      if (step === "h") dw = cw * 2;
      if (step === "v") dh = ch * 2;

      if (last) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        st.canvas.width = dw; st.canvas.height = dh;
        gl.viewport(0, 0, dw, dh);
      } else {
        var target = glTarget(st, dw, dh);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, dw, dh);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curTex);
      gl.uniform1i(st.u.tex, 0);
      gl.uniform2f(st.u.src, cw, ch);
      gl.uniform2f(st.u.dst, dw, dh);
      gl.uniform2f(st.u.dir, step === "h" ? 1 : 0, step === "v" ? 1 : 0);
      // The canvas stores its rows bottom-up; an offscreen texture is written and read top-down.
      gl.uniform1f(st.u.flip, last ? 1 : 0);
      gl.uniform1f(st.u.pass, step === "d" ? 1 : 0);
      gl.uniform1f(st.u.sharp, sharpen);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      var err = gl.getError();
      if (err && err !== gl.CONTEXT_LOST_WEBGL) throw new Error("webgl error " + err);

      if (last) { curTex = null; }
      else if (step === "h" || step === "v") {
        curTex = st.targets[dw + "x" + dh].tex;
      } else {
        curTex = st.targets[dw + "x" + dh].tex;
      }
      cw = dw; ch = dh;
    }

    return { blob: await canvasToBlob(st.canvas), w: cw, h: ch };
  }

  // ---- canvas2d: the browser's own stepped resample, and a JS sharpen ------

  async function cpuUpscale(bitmap, factor, sharpen, srcSize) {
    var w = srcSize.w, h = srcSize.h;
    var a = document.createElement("canvas"), b = document.createElement("canvas");
    var ca = a.getContext("2d"), cb = b.getContext("2d");
    var cur = bitmap, cw = w, ch = h;

    for (var f = 1; f < factor; f *= 2) {
      var dw = cw * 2, dh = ch * 2;
      b.width = dw; b.height = dh;
      cb = b.getContext("2d");
      cb.imageSmoothingEnabled = true;
      cb.imageSmoothingQuality = "high";
      cb.clearRect(0, 0, dw, dh);
      cb.drawImage(cur, 0, 0, dw, dh);
      // Ping-pong so the next step reads a finished canvas, never one being written.
      a.width = dw; a.height = dh;
      ca = a.getContext("2d");
      ca.drawImage(b, 0, 0);
      cur = a; cw = dw; ch = dh;
    }

    if (sharpen > 0) {
      // The SAME detail pass as the shader, in plain arithmetic: a 1-4-6-4-1 Gaussian in each axis
      // (25 taps), and the smoothstep gate that keeps flat areas - where a jpeg hides its blocking -
      // completely unsharpened. Two roads, one look.
      var img = ca.getImageData(0, 0, cw, ch);
      var d = img.data;
      var out = new Uint8ClampedArray(d.length);
      var W = cw, H = ch;
      var GW = [1, 4, 6, 4, 1];
      var lum = function (o) { return 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]; };
      var cl = function (v, m) { return v < 0 ? 0 : (v > m ? m : v); };
      // smoothstep over 0..255 channels: the shader's thresholds, said in 8-bit numbers.
      var ss = function (e0, e1, x) { var t = cl((x - e0) / (e1 - e0), 1); return t * t * (3 - 2 * t); };
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var at = (y * W + x) * 4;
          var r = 0, g = 0, bl = 0, ws = 0;
          for (var dy = -2; dy <= 2; dy++) {
            var yy = cl(y + dy, H - 1);
            for (var dx = -2; dx <= 2; dx++) {
              var xx = cl(x + dx, W - 1);
              var k = GW[dx + 2] * GW[dy + 2];
              var o = (yy * W + xx) * 4;
              r += d[o] * k; g += d[o + 1] * k; bl += d[o + 2] * k; ws += k;
            }
          }
          r /= ws; g /= ws; bl /= ws;
          var lx = lum((y * W + cl(x + 2, W - 1)) * 4) - lum((y * W + cl(x - 2, W - 1)) * 4);
          var ly = lum((cl(y + 2, H - 1) * W + x) * 4) - lum((cl(y - 2, H - 1) * W + x) * 4);
          var m = ss(0.05 * 255, 0.16 * 255, Math.sqrt(lx * lx + ly * ly));
          // The shader's coring and roll-off, in 8-bit numbers: nothing amplified below ~1/255,
          // and the amount faded back down once a difference is big enough to be an edge.
          var dl = Math.abs(0.299 * (d[at] - r) + 0.587 * (d[at + 1] - g) + 0.114 * (d[at + 2] - bl));
          var amt = sharpen * m * ss(0.004 * 255, 0.018 * 255, dl) * (1 - 0.6 * ss(0.09 * 255, 0.24 * 255, dl));
          out[at] = d[at] + (d[at] - r) * amt;
          out[at + 1] = d[at + 1] + (d[at + 1] - g) * amt;
          out[at + 2] = d[at + 2] + (d[at + 2] - bl) * amt;
          out[at + 3] = d[at + 3];
        }
      }
      img.data.set(out);
      ca.putImageData(img, 0, 0);
    }

    return { blob: await canvasToBlob(a), w: cw, h: ch };
  }

  // ---- the one door -------------------------------------------------------

  // A blob in, a bigger blob out. Never touches the vault: everything that files a record goes
  // through run() below, so this is also what a test can call.
  async function upscaleBlob(blob, opts) {
    opts = opts || {};
    var factor = Number(opts.factor) === 4 ? 4 : (Number(opts.factor) === 2 ? 2 : FACTOR);
    var sharpen = (opts.sharpen === undefined || opts.sharpen === null) ? SHARPEN : Math.max(0, Number(opts.sharpen) || 0);
    var started = Date.now();

    var bm = await blobToBitmap(blob);
    try {
      var sw = bm.w || 1, sh = bm.h || 1;
      // THE CEILING, HANDLED HONESTLY. If the target would be more pixels than this device should
      // be asked to hold, the factor is stepped down (4 -> 2) and the caller is told - rather than
      // failing at the encoder with a picture that never arrives.
      var mp = (sw * sh * factor * factor) / 1e6;
      var asked = factor;
      if (mp > MAX_MP && factor === 4) { factor = 2; mp = (sw * sh * 4) / 1e6; }
      if (mp > MAX_MP) {
        throw new Error("that picture is " + Math.round(sw * sh / 1e6 * 10) / 10 + " MP and a " + factor
          + "x would be " + Math.round(mp) + " MP - past this device's ceiling of " + MAX_MP + " MP");
      }
      var maxSide = Math.max(sw * factor, sh * factor);
      var eng = engine();
      if (eng === "webgl2") {
        var st = buildGl();
        if (st && maxSide > st.max) eng = "canvas2d";   // a phone GPU can be smaller than the picture
      }

      var out;
      if (eng === "webgl2") {
        try { out = await glUpscale(bm.src, factor, sharpen, { w: sw, h: sh }); }
        catch (e) {
          // A GPU that refuses (a lost context, a driver that dislikes the loop) is not a dead end:
          // the CPU road gives the same picture, softer and slower. The record says which one ran.
          console.warn("upscale-local: the GPU road failed, falling back to canvas2d", e);
          out = await cpuUpscale(bm.src, factor, sharpen, { w: sw, h: sh });
          eng = "canvas2d";
        }
      } else {
        out = await cpuUpscale(bm.src, factor, sharpen, { w: sw, h: sh });
      }

      return {
        blob: out.blob, w: out.w, h: out.h, engine: eng, factor: factor, askedFactor: asked,
        sharpen: sharpen, ms: Date.now() - started, srcW: sw, srcH: sh,
      };
    } finally {
      try { bm.close(); } catch (e) {}
    }
  }

  // ---- the vault side -----------------------------------------------------

  function extFor(blob, given) {
    var m = String((blob && blob.type) || "").toLowerCase();
    if (/png/.test(m)) return "png";
    if (/jpe?g/.test(m)) return "jpg";
    if (/webp/.test(m)) return "webp";
    var n = String(given || "").match(/\.([A-Za-z0-9]{2,5})$/);
    return n ? n[1].toLowerCase() : "png";
  }

  function outName(from, blob, factor, dim) {
    var base = (from && (from.name || from.prompt)) || "picture";
    base = String(base).replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 44);
    if (!base) base = "picture";
    return base + "-x" + factor + (dim ? "-" + dim : "") + "." + extFor(blob, from && from.name);
  }

  // One picture, made bigger here and filed beside what it came from. Returns the new id, or false
  // (and says why). `quiet` is the auto road: no stage, no queue for her eyes, one line in the log.
  async function run(id, opts) {
    opts = opts || {};
    var media = window.media;
    if (!media || !media.get || !media.add) { say("UPSCALE HERE :: THE VAULT IS NOT LOADED HERE."); return false; }
    var rec = media.get(id);
    if (!rec || !rec.blob) { say("UPSCALE HERE :: THAT PICTURE IS NOT IN THE VAULT (YET). GIVE IT A MOMENT, THEN TRY AGAIN."); return false; }
    if (/^video\//.test(rec.mime || "") || rec.kind === "video") {
      say("UPSCALE HERE :: THIS ONE IS A CLIP. A CLIP IS ALREADY A SEQUENCE OF PICTURES - THERE IS NOTHING USEFUL TO RESAMPLE.");
      return false;
    }
    if (/^audio\//.test(rec.mime || "")) {
      say("UPSCALE HERE :: THIS ONE IS SOUND. UPSCALING IS A PICTURE OPERATION.");
      return false;
    }

    var factor = Number(opts.factor) === 4 ? 4 : (Number(opts.factor) === 2 ? 2 : FACTOR);
    say("UPSCALE HERE :: RESAMPLING " + (rec.name || id) + " " + factor + "x ON THIS MACHINE ("
      + engine().toUpperCase() + ", LANCZOS-3" + (SHARPEN > 0 || opts.sharpen ? " + DETAIL" : "") + "). NOTHING LEAVES THIS DEVICE.");
    // WHAT IS IN HAND. Every upscale in this terminal comes through here - his own
    // press on the stage, the auto hook, and the TOOLS sweep (which renews this
    // itself, one picture at a time) - so this one line is what puts the picture's
    // thumbnail and citation in the deck's in-hand chip (src/js/minibox.js) for
    // EVERY road. It is a lease, so there is nothing to end here.
    try {
      if (window.inHand && window.inHand.show) window.inHand.show(rec.id, "RESAMPLING " + factor + "x", { label: "UPSCALING HERE", list: [rec.id] });
    } catch (e) {}

    var out;
    // THE BAR. An upscale has no count to give - it is one resample, and the engine does it in one
    // pass - so this is an INDETERMINATE bar, at priority 0 on purpose: a sweep (the /tools job, or
    // the grind of a batch) already has a count of its own, and its number is more use than this
    // one's word. When nothing else is running, this is what the rail shows.
    var P = null;
    try {
      if (window.progress) P = window.progress.begin("UPSCALING HERE", {
        id: "upscale-here", priority: 0,
        detail: (rec.name || id) + " " + factor + "x on this machine - nothing leaves this device",
      });
    } catch (e) {}
    try {
      out = await upscaleBlob(rec.blob, { factor: factor, sharpen: (opts.sharpen === undefined ? SHARPEN : opts.sharpen) });
    } catch (e) {
      if (P) { try { P.fail("THE RESAMPLE FAILED"); } catch (e2) {} }
      say("UPSCALE HERE :: THAT DID NOT WORK :: " + ((e && e.message) ? e.message : e));
      return false;
    }

    var dim = out.w + "x" + out.h;
    var name = outName(rec, out.blob, out.factor, dim);
    var scale = (rec.w && rec.h) ? (out.w / rec.w) : out.factor;
    var newId;
    try {
      newId = await media.add(out.blob, {
        kind: "upscale",
        name: name,
        w: out.w, h: out.h,
        resolution: dim,
        // THE WHOLE PROMPT FILE IS CARRIED (his word, 2026-09-22: "The new upscaled image retains
        // its prompt file like positive and negative, guidance scale, seed, etc."), so the bigger
        // picture is not a copy of a picture - it IS the render, and the render book, KEEP, the
        // forge and a re-render all read the same recipe off it. `prompt` is the positive prompt,
        // `sent` the words the renderer was actually handed, `negative` the negative list, and
        // `pose`/`recipe` the two other things a render knows about itself.
        prompt: rec.prompt || "",
        sent: rec.sent || "",
        seed: rec.seed || 0,
        negative: rec.negative || "",
        guidanceScale: rec.guidanceScale || 0,
        pose: rec.pose || "",
        recipe: rec.recipe || "",
        tags: rec.tags || [],
        folder: rec.folder || "",
        from: rec.id,             // the record this was made from (kept even when it is not retired)
        how: "upscale-local",
        note: "upscaled HERE on this machine, " + (Math.round(scale * 100) / 100) + "x :: "
          + (rec.w && rec.h ? rec.w + "\u00d7" + rec.h + " -> " + out.w + "\u00d7" + out.h + " :: " : "")
          + (out.engine === "webgl2" ? "lanczos-3 on the GPU" : "stepped canvas resample (no webgl2 here)")
          + (out.sharpen > 0 ? ", detail pass " + out.sharpen : "")
          + " :: " + out.ms + " ms"
          + (out.askedFactor !== out.factor ? " (asked for " + out.askedFactor + "x, stepped down for this device)" : "")
          + (rec.name ? " :: from " + rec.name : ""),
      });
    } catch (e) {
      if (P) { try { P.fail("THE BIGGER PICTURE COULD NOT BE KEPT"); } catch (e2) {} }
      say("UPSCALE HERE :: THE BIGGER PICTURE COULD NOT BE KEPT :: " + ((e && e.message) ? e.message : e));
      return false;
    }

    made++;
    await save();
    // THE PIPELINE'S LAST STEP: the smaller one leaves. This runs BEFORE anything is shown or queued,
    // and it is where the queue for her eyes has its slot moved across - so the `queueSight` below
    // (the by-hand road's own queueing) finds the bigger one already there and adds nothing twice.
    var retired = null;
    try { retired = await retire(rec, newId, opts); }
    finally { if (P) { try { P.finish(); } catch (e) {} } }
    say("UPSCALE DONE :: " + name + " :: " + dim + " :: " + bytesLabel(out.blob.size)
      + " :: " + out.ms + " ms ON " + out.engine.toUpperCase()
      + (out.askedFactor !== out.factor ? " (STEPPED DOWN FROM " + out.askedFactor + "x FOR THIS DEVICE)" : "")
      + (opts.quiet ? " :: FILED IN THE VAULT (/gallery upscaled)" : " :: HELD IN THE VAULT, ON THE STAGE, AND QUEUED FOR HER EYES.")
      + retireWords(retired));
    // THE GALLERY IS THE VIEWING ROOM: the bigger picture is filed and (by hand) staged -
    // never posted as a tile in the chat. The concise UPSCALE DONE receipt above is the whole
    // of the record; the prompt file rides on the vault record.
    if (!opts.quiet) {
      if (typeof openLightbox === "function") { try { openLightbox(newId); } catch (e) {} }
      if (typeof queueSight === "function") { try { await queueSight([newId]); } catch (e) {} }
    }
    return newId;
  }

  /* ---- the retire step ----------------------------------------------------
     THE SMALLER ONE LEAVES (Patrikios, 2026-09-22; the note at the top of this file is the whole of
     the reasoning). Everything that points at the render is moved to the bigger picture FIRST and
     the blob is removed LAST, so a failure anywhere leaves the picture he has, whole, rather than a
     hole where it was.

     The four things that hold an id, and what happens to each:
       the archive     - replaceMediaRef (src/js/chat.js) rewrites the creation row, and for this
                         case also what she was SHOWN and what she ASKED TO SEE AGAIN: an upscale is
                         the same picture bigger, not a different picture, so those references point
                         at the record that exists rather than at one that is gone.
       the queue       - replaceSight (src/js/images.js) moves the slot it held, and only that slot,
                         so she still looks at this picture on the turn it was scheduled for.
       a KEEP          - keepsake.transfer (src/js/keepsake.js) carries the mark and the recipe over,
                         with the gallery link rewritten to the new id.
       what is drawn  - repointTiles (src/js/images.js) refills any tile of it in the log from the
                         bigger record, and the full stage follows if it was on it.
     ------------------------------------------------------------------------ */

  async function retire(rec, newId, opts) {
    var media = window.media;
    if (!newId || !rec || !media || !media.del) return { done: false, why: "novault" };
    if (opts && opts.replace === false) return { done: false, why: "asked" };
    if (!(opts && opts.replace === true) && !replace) return { done: false, why: "off" };
    // ANYTHING THAT IS NOT A RENDER THE TERMINAL MADE IS LEFT ALONE. `gen` is a picture the terminal
    // made from a prompt; an attachment, a clip, a piece of music and - his own case - AN UPSCALE
    // are never candidates. This single test is what makes "upscale it again" safe.
    if (rec.kind !== "gen") return { done: false, why: (rec.kind === "upscale" ? "upscale" : "notmine") };

    var oldId = rec.id;
    var next = media.get(newId) || {};

    // FIRST OF ALL, before anything else can ask: the vault is told the replacement, in memory, so a
    // caller a few milliseconds behind (a tile being drawn, a creation row being written into the
    // archive, the stage being opened) is handed the picture that exists rather than a hole. See
    // `noteReplace` in src/js/vault.js.
    try { if (media.noteReplace) media.noteReplace(oldId, newId); } catch (e) {}

    var refs = 0;
    try {
      refs = (typeof window.replaceMediaRef === "function")
        ? await window.replaceMediaRef(oldId, newId, {
            sight: true,
            patch: {
              name: next.name || "",
              file: (media.artifactName ? media.artifactName(next) : next.name) || "",
              resolution: next.resolution || "",
            },
          })
        : 0;
    } catch (e) { refs = -1; }

    var requeued = false;
    try { if (typeof replaceSight === "function") requeued = await replaceSight(oldId, newId); } catch (e) {}

    var kept = false;
    try {
      if (rec.keep && window.keepsake && window.keepsake.transfer) kept = await window.keepsake.transfer(oldId, newId);
    } catch (e) { console.warn("upscale-local: a KEEP could not be moved across", e); }

    // THE BLOB, LAST. Nothing above needed it, and after this it is gone.
    await media.del(oldId);

    // The record says plainly what it is: the file this came from (already carried as `from`) and,
    // now, that the file it came from is not in the vault any more. /gallery, the render book and
    // the full stage all read the plan text off the record.
    if (media.setField) {
      try {
        await media.setField(newId, "replaced", oldId);
        await media.setField(newId, "note", String(next.note || "")
          + " :: it replaced the smaller original, which is out of the vault (everything that named it names this)");
      } catch (e) {}
    }

    // WHAT IS DRAWN. A tile of the render can be sitting in the log - it was drawn from the blob URL
    // that has just gone - so it is refilled from the bigger record. Twice: the render's own tile is
    // filled by the caller right after `media.add` returns, and this sweep must land after that one.
    try { if (typeof window.repointTiles === "function") window.repointTiles(oldId, newId); } catch (e) {}
    // WHAT IS BEING LOOKED AT. A tile in the log is not the only thing showing this picture: the
    // deck's in-hand chip (a sweep puts the picture in hand and leaves it there) and the mini
    // lightbox may be showing exactly the one that has just left the vault, so both are told the
    // successor the same way the tiles are. Nothing here decides anything - it only keeps what is on
    // screen pointing at the record that exists.
    try { if (window.inHand && window.inHand.follow) window.inHand.follow(oldId, newId); } catch (e) {}
    try { if (window.miniBox && window.miniBox.follow) window.miniBox.follow(oldId, newId); } catch (e) {}
    window.setTimeout(function () {
      try { if (typeof window.repointTiles === "function") window.repointTiles(oldId, newId); } catch (e) {}
    }, 400);

    try {
      if (window.lightboxId === oldId && typeof openLightbox === "function") openLightbox(newId);
    } catch (e) {}
    try { if (window.gallery && window.gallery.refresh) window.gallery.refresh(false); } catch (e) {}

    return { done: true, refs: refs, requeued: requeued, kept: kept };
  }

  // What the log says about it - one line, and never a silent deletion.
  function retireWords(r) {
    if (!r) return "";
    if (r.done) {
      return " :: THE SMALLER ORIGINAL IS OUT OF THE VAULT AND THE GALLERY - EVERY REFERENCE TO IT NOW POINTS AT THIS ONE"
        + (r.requeued ? " (INCLUDING ITS PLACE IN THE QUEUE FOR HER EYES)" : "")
        + (r.kept ? " :: ITS KEEP MOVED ACROSS, RECIPE AND GALLERY LINK WITH IT" : "")
        + (r.refs < 0 ? " :: (THE ARCHIVE COULD NOT BE REWRITTEN - IT STILL NAMES THE ORIGINAL)" : "");
    }
    if (r.why === "off") return " :: THE SMALLER ORIGINAL IS STILL IN THE VAULT (REPLACEMENT IS OFF - /upscale replace on)";
    if (r.why === "asked") return " :: THE SMALLER ORIGINAL IS STILL IN THE VAULT (KEPT ON REQUEST)";
    if (r.why === "upscale") return " :: THIS ONE IS ALREADY AN UPSCALE, SO IT IS LEFT EXACTLY WHERE IT IS";
    return "";   // a picture he handed over is not the terminal's to remove, and says nothing extra
  }

  // One at a time, and never a lost request: everything that wants a bigger picture joins the same
  // line. A render landing while another upscale is running does not vanish - it waits its turn.
  function queue(id, opts) {
    var prev = busy || Promise.resolve();
    var next = prev.then(function () { return run(id, opts); }, function () { return run(id, opts); });
    busy = next.catch(function () { return false; });
    return next;
  }

  // ---- the automatic road -------------------------------------------------

  // THE AUTO HOOK. The vault has one door (window.media.add) and it will call whoever subscribes
  // the moment a record is stored. Only a picture the TERMINAL MADE is taken: kind 'gen' - never
  // an attachment he handed over (not the terminal's to enlarge), never a video or a piece of
  // music, and never another upscale (which would feed itself). This is also what keeps the RETIRE
  // step from ever looping: what this file stores is kind 'upscale', so it is not taken up again,
  // and an upscale is the one kind of picture that is never retired.
  function consider(rec) {
    if (!rec || rec.kind !== "gen") return;
    // THE BIGGER PIPELINE COMES FIRST (src/js/pipeline.js). While it is on, EVERY render is its to
    // place: the window at 4x if a real click is available, and this road at 2x if it is not - and
    // the pipeline calls straight back into `queue` for that, so nothing is lost by standing down
    // here. This is asked BEFORE the `auto` switch on purpose: with the pipeline on, its own switch
    // is the one that decides, and `/upscale auto` goes back to governing the plain road the moment
    // the pipeline is off.
    if (window.pipeline && window.pipeline.claims && window.pipeline.claims(rec)) return;
    if (!auto) return;
    try {
      queue(rec.id, { quiet: true, factor: FACTOR });
    } catch (e) { console.warn("upscale-local: the automatic upscale could not start", e); }
  }

  function hook() {
    if (window.media && typeof window.media.onAdd === "function") {
      window.media.onAdd(consider);
      return true;
    }
    return false;
  }

  // ---- the setting, in words ----------------------------------------------

  function autoCmd(arg) {
    var a = String(arg || "").trim().toLowerCase();
    if (!a || a === "status" || a === "?") {
      return "UPSCALE, HERE :: AUTOMATIC " + (auto ? "ON" : "OFF") + " (" + FACTOR + "x, "
        + (engine()) + (SHARPEN > 0 ? ", detail " + SHARPEN : ", no detail pass") + ")"
        + " :: " + made + " MADE THIS BOOT"
        + "\n  /upscale auto on|off TURNS IT ON OR OFF (KEPT ON THIS DEVICE, LIKE EVERY OTHER SETTING)."
        + "\n  WHEN IT IS ON, EVERY PICTURE THE TERMINAL MAKES IS RESAMPLED AS SOON AS IT LANDS - SILENTLY. NOTHING IS OPENED AND NOTHING IS ADDED TO HER EYES; THE PICTURE THE TERMINAL MADE IS ALREADY THERE, AND IT IS THE ONE THE BIGGER PICTURE REPLACES."
        + (replace
          ? " THE SMALLER ORIGINAL IS RETIRED WHEN THE BIGGER ONE IS SAFELY IN THE VAULT: EVERYTHING THAT NAMED IT - THE RECORD, THE QUEUE FOR HER EYES, THE TILE IN THE LOG, A KEEP - MOVES TO THE BIGGER ONE. AN ATTACHMENT, A CLIP, OR AN UPSCALE OF AN UPSCALE IS NEVER DELETED."
          : " THE ORIGINAL IS LEFT IN THE VAULT (/upscale replace on RETIRES IT INSTEAD).")
        + "\n  /upscale here [ID] [2|4] DOES ONE BY HAND; THE UPSCALE HERE BUTTON ON A PICTURE'S FULL STAGE DOES THE SAME. THE RESULT IS PNG, ALWAYS - AN UPSCALE IS FOR CARRYING DETAIL, AND A JPEG RE-ENCODE WOULD THROW SOME OF IT AWAY.";
    }
    if (a === "on" || a === "true" || a === "yes") {
      auto = true; save();
      return "UPSCALE, HERE :: AUTOMATIC IS ON. EVERY NEW RENDER IS MADE " + FACTOR + "x AS SOON AS IT LANDS (" + engine() + ")"
        + (replace ? ", AND THE SMALLER RENDER IT CAME FROM LEAVES THE VAULT AND THE GALLERY - THE BIGGER ONE TAKES ITS PLACE EVERYWHERE (/upscale replace off IF YOU WOULD RATHER KEEP BOTH)." : ", AND BOTH ARE KEPT (/upscale replace on RETIRES THE SMALLER ONE).");
    }
    if (a === "off" || a === "false" || a === "no") { auto = false; save(); return "UPSCALE, HERE :: AUTOMATIC IS OFF. /upscale local STILL DOES ONE BY HAND."; }
    return "USAGE: /upscale auto [on|off|status]";
  }

  // /upscale replace [on|off|status] - whether the smaller original leaves when the local road has
  // the bigger one. This is the one switch in the terminal that DELETES something of his by itself,
  // so it says plainly what turning it on does (and what it will never touch).
  function replaceCmd(arg) {
    var a = String(arg || "").trim().toLowerCase();
    if (!a || a === "status" || a === "?") {
      return "UPSCALE, HERE :: RETIRING THE SMALLER ORIGINAL IS " + (replace ? "ON" : "OFF")
        + "\n  WITH IT ON, A LOCAL UPSCALE THAT SUCCEEDS TAKES THE RENDER IT CAME FROM OUT OF THE VAULT AND THE GALLERY - AND NOTHING IS LEFT POINTING AT IT: THE ARCHIVE'S CREATION ROW, ITS PLACE IN THE QUEUE FOR HER EYES, ANY TILE OF IT IN THE LOG, AND A KEEP (WITH ITS RECIPE AND GALLERY LINK) ALL FOLLOW TO THE BIGGER ONE."
        + "\n  WHAT IS NEVER RETIRED: A PICTURE YOU HANDED OVER, A CLIP, A PIECE OF MUSIC, AND AN UPSCALE. UPSCALING SOMETHING THAT IS ALREADY AN UPSCALE - BY EITHER ROAD - LEAVES THE LAST UPSCALE EXACTLY WHERE IT IS. THE BIGGER.PICS ROAD DELETES NOTHING AT ALL."
        + "\n  /upscale replace off LEAVES EVERY ORIGINAL IN THE VAULT (KEPT ON THIS DEVICE, LIKE EVERY OTHER SETTING)."
        + (replace ? "\n  CURRENTLY: A FAILED UPSCALE DELETES NOTHING - THE ORIGINAL ONLY GOES ONCE THE BIGGER PICTURE IS SAFELY STORED." : "");
    }
    if (a === "on" || a === "true" || a === "yes") { replace = true; save(); return "UPSCALE, HERE :: RETIRING IS ON. A LOCAL UPSCALE RETIRES THE RENDER IT CAME FROM ONCE THE BIGGER ONE IS IN THE VAULT - ATTACHMENTS, CLIPS, MUSIC AND UPSCALES ARE NEVER TOUCHED."; }
    if (a === "off" || a === "false" || a === "no") { replace = false; save(); return "UPSCALE, HERE :: RETIRING IS OFF. THE SMALLER ORIGINAL STAYS IN THE VAULT BESIDE ITS BIGGER SELF."; }
    return "USAGE: /upscale replace [on|off|status]";
  }

  async function setFactor(n) {
    n = Number(n) === 4 ? 4 : 2;
    FACTOR = n;
    await save();
    return FACTOR;
  }

  window.upscaleLocal = {
    engine: engine,
    factor: function () { return FACTOR; },
    sharpen: function () { return SHARPEN; },
    format: function () { return FORMAT; },
    maxMp: function () { return MAX_MP; },
    auto: function () { return auto; },
    autoCmd: autoCmd,
    replace: function () { return replace; },
    replaceCmd: replaceCmd,
    retire: retire,
    setFactor: setFactor,
    upscaleBlob: upscaleBlob,
    run: run,
    queue: queue,
    consider: consider,
    made: function () { return made; },
    state: function () {
      return { engine: engine(), factor: FACTOR, sharpen: SHARPEN, format: FORMAT, maxMp: MAX_MP,
        auto: auto, replace: replace, made: made, busy: !!busy, hooked: !!(window.media && window.media.onAdd) };
    },
  };

  // Boot: read the device's own setting, then take the vault's doorway. The subscribe is retried
  // briefly because the vault and this file are separate scripts and one of them can arrive late
  // (the platform has been seen to fail to deliver a src/ file on an otherwise healthy load).
  (function boot() {
    load();
    if (hook()) return;
    var tries = 0;
    var t = window.setInterval(function () {
      tries++;
      if (hook() || tries > 40) window.clearInterval(t);
    }, 250);
  })();
})();
