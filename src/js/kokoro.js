window.kokoro = (function () {
  "use strict";

  /* KOKORO - the local voice: a neural narrator that runs ON THIS MACHINE.

     WHY IT EXISTS
     The other two engines are somebody else's. The browser's voice is the operating system's, and
     its ceiling is whatever voice the OS shipped or Patrikios downloaded. ElevenLabs is her real
     voice, but it is a key, a plan and a bill, and the voice he actually configured for her (the
     profile BARBELO) is refused by the free plan with HTTP 402. Measured 2026-09-30: this browser
     holds 6 female ElevenLabs voices it may SPEAK for free, out of the ~20 published, and the great
     majority of the published ones answer 402 "Free users cannot use library voices via the API".

     Kokoro is neither: an 82M-parameter open model that is fetched ONCE per browser (about 90MB at
     the shipped q8 setting) and then runs entirely inside this page - no key, no account, no plan,
     no per-character bill, and NO NETWORK AT ALL once the model is here. What it says never leaves
     the machine. That is the whole point of it, and it is why it earns a place beside the other two
     engines even though it is slower than they are (see THE MEASUREMENT).

     THE MEASUREMENT, on Patrikios' own machine (measured 2026-09-30, the day it was built)
     - the model arrives as 28 English voices (15 female, 13 male), each carrying its own language,
       gender, the provider's mark and two grades - and THREE of the female ones are A-grade:
       Heart (A), Bella (A-), and then Emma and Nicole (B-). The rest are C and D, which is worth
       knowing BEFORE choosing one by its name: af_heart, af_bella, bf_emma and af_nicole are the
       four worth hearing first. `/voice kokoro voices` prints the whole table with the grades.
     - load: about 1.6s WARM (the model already in the browser's cache), about 10s COLD (90MB
       arriving over the network). WebGPU with the q4f16 build loads in ~8.6s on this machine.
     - speaking: SLOWER THAN REAL TIME, and this is the one thing to know about it. 33 characters
       took 5.4-7.2s to make (about 2.5s of speech), and 118 characters took 17.3s for 8.3s of
       audio - a real-time factor of about 2.0 on wasm/q8 and 1.34 on WebGPU/q4f16. The machine is
       a 6-core Intel laptop with an Intel gen-9 integrated GPU, so that is the honest floor here,
       not a bad day. NOTHING BELOW CHANGES THAT: it is why the road has its own ceiling
       (`kokoro.maxChars`, shipped 900 characters = about a minute of speech = about two minutes of
       making), and why it is offered as a NARRATOR and a voice to audition rather than as the
       engine her conversation runs on. The browser's voice is instant and free; ElevenLabs is
       instant and billed; this one is free and slow. That is the trade, stated rather than hidden.

     WHY IT RUNS IN A WORKER, AND WHY THE WORKER IS A STRING
     Kokoro's inference is WebAssembly (or WebGPU) and it BLOCKS WHATEVER THREAD IT RUNS ON. Built
     naively - imported straight into the page - a single sentence froze this entire terminal for
     eleven seconds, and a second call froze it hard enough that even the editor's reload could not
     get a word in (measured, 2026-09-30: the page was unrecoverable until the tab was left alone
     for over a minute). So the model lives in a WORKER, and the page only ever waits on messages.
     The worker's source is a string in this file rather than a src/ file fetched at runtime,
     because a worker cannot be a module in index.html's MODULES list and fetching a src/ file to
     build a Blob from it needs the service worker - which is exactly the thing that is absent in
     some in-app browsers (the Google app on iOS). A string has no such dependency: one file ships
     the engine, and it works anywhere the page itself works.

     THE API (for voice.js and for the terminal's own tests)
       supported()            can this browser run it at all (WebAssembly, and a module worker)
       load(opts)             fetch the model and warm it: { dtype, device, onProgress }
       ready() / loading()    whether the model is on this machine yet, and how it is going
       state()                one object: ready, loading, ms, dtype, device, the roster, last say
       roster()               the model's OWN list: [{ id, name, gender, language, traits, quality, grade }]
       female() / ids()       the female half, and every id
       name(id) / pick(want)  a voice's printed name, and a resolver (name, id, or the start of one)
       warm()                 load() with the shipped settings, for a command that wants it ready
       say(text, voice, opts) make ONE piece of speech: resolves { blob, secs, ms, voice }
       stop()                 abandon what is in flight (the worker itself is kept: reloading a
                              90MB model to cancel a sentence would be absurd)
       release()              terminate the worker and drop the model from memory
       design()               the `kokoro` block of src/voice/voices.json, once voice.js has read it

     The shipped settings (model, dtype, device, ceiling, the picks per role) are the DESIGN and
     live in src/voice/voices.json; nothing about this device is written from here except through
     voice.js, which owns the device state. Nothing in this module prints or stores anything. */

  var CDN = "https://esm.sh/kokoro-js@1.2.1";
  var MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
  var SAMPLE_RATE = 24000;
  var LIMIT_MS = 600000;      // a cold 90MB fetch on a slow line is not a failure; ten minutes is

  // THE WORKER. Kept as source text on purpose (see WHY THE WORKER IS A STRING). It imports the
  // pinned library from esm.sh, keeps the model once, and answers three commands: load, say, ping.
  // Everything it returns is a plain value or a transferred WAV, so the page never touches the
  // model itself.
  var SRC = [
    'import { KokoroTTS, env } from "' + CDN + '";',
    'var tts = null, loading = null;',
    // A 16-BIT WAV, MONO, AT THE MODEL\'S OWN RATE. The library hands back float samples; a browser
    // can play a float WAV too, but 16-bit is what every player on every device understands, and it
    // is half the size - which matters when the whole clip is being carried as a Blob.
    'function wav16(f, sr) {',
    '  var N = f.length, buf = new ArrayBuffer(44 + N * 2), dv = new DataView(buf);',
    '  var wr = function (o, s) { for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };',
    '  wr(0, "RIFF"); dv.setUint32(4, 36 + N * 2, true); wr(8, "WAVEfmt "); dv.setUint32(16, 16, true);',
    '  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);',
    '  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, N * 2, true);',
    '  for (var i = 0; i < N; i++) { var s = Math.max(-1, Math.min(1, f[i])); dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }',
    '  return buf;',
    '}',
    'self.onmessage = async function (e) {',
    '  var m = e.data || {};',
    '  try {',
    '    if (m.cmd === "load") {',
    '      if (!loading) loading = KokoroTTS.from_pretrained(m.model, {',
    '        dtype: m.dtype, device: m.device,',
    '        progress_callback: function (p) { try { self.postMessage({ type: "progress", id: m.id, file: p && p.file, loaded: p && p.loaded, total: p && p.total, progress: p && p.progress }); } catch (x) {} }',
    '      });',
    '      var t0 = Date.now();',
    '      tts = await loading;',
    '      var threads = "?"; try { threads = env.backends.onnx.wasm.numThreads; } catch (x) {}',
    '      self.postMessage({ type: "loaded", id: m.id, ms: Date.now() - t0, voiceCount: tts.voices ? Object.keys(tts.voices).length : 0, voices: tts.voices ? JSON.parse(JSON.stringify(tts.voices)) : null, threads: threads });',
    '    } else if (m.cmd === "say") {',
    '      if (!tts) throw new Error("THE MODEL IS NOT LOADED YET");',
    '      var t1 = Date.now();',
    '      var a = await tts.generate(m.text, { voice: m.voice, speed: m.speed == null ? 1 : m.speed });',
    '      var wav = wav16(a.audio, ' + SAMPLE_RATE + ');',
    '      self.postMessage({ type: "audio", id: m.id, ms: Date.now() - t1, secs: a.audio.length / ' + SAMPLE_RATE + ', wav: wav }, [wav]);',
    '    } else if (m.cmd === "ping") {',
    '      self.postMessage({ type: "pong", id: m.id, loaded: !!tts });',
    '    }',
    '  } catch (err) { self.postMessage({ type: "error", id: m.id, stage: m.cmd, err: String((err && err.message) || err) }); }',
    '};'
  ].join("\n");

  var worker = null, url = null, seq = 0, pending = {}, dead = null;
  var model = null;               // the model's own roster, once loaded
  var meta = { ready: false, loading: false, ms: 0, threads: "", error: "", lastMs: 0, lastSecs: 0, at: 0, voices: 0 };
  var progress = null;            // the newest download reading, for whoever wants to print it

  function design() {
    // The DESIGN block, read through voice.js so there is one reader of src/voice/voices.json.
    try {
      if (window.voice && window.voice.kokoroDesign) return window.voice.kokoroDesign() || {};
    } catch (e) {}
    return {};
  }

  function supported() {
    try {
      if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return false;
      if (typeof WebAssembly === "undefined") return false;
      URL.createObjectURL(new Blob([""], { type: "text/javascript" }));
      return true;
    } catch (e) { return false; }
  }

  function boot() {
    if (worker) return worker;
    if (!supported()) throw new Error("THIS BROWSER CANNOT RUN THE LOCAL VOICE (NO WEBASSEMBLY, OR NO MODULE WORKER)");
    url = URL.createObjectURL(new Blob([SRC], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
    worker.onerror = function (ev) {
      // A module worker whose import fails never answers anything, so the failure has to be caught
      // here or a `warm` would wait for ten minutes on a socket that is already closed.
      dead = String((ev && ev.message) || "THE LOCAL VOICE'S WORKER COULD NOT START (THE LIBRARY IS FETCHED FROM esm.sh ON FIRST USE - CHECK THE CONNECTION)");
      var keys = Object.keys(pending);
      for (var i = 0; i < keys.length; i++) { var p = pending[keys[i]]; delete pending[keys[i]]; clearTimeout(p.timer); p.reject(new Error(dead)); }
    };
    worker.onmessage = function (ev) {
      var m = ev.data || {};
      if (m.type === "progress") { progress = { file: m.file, loaded: m.loaded, total: m.total, progress: m.progress }; return; }
      var p = pending[m.id];
      if (!p) return;
      delete pending[m.id];
      clearTimeout(p.timer);
      if (m.type === "error") { p.reject(new Error(m.err + (m.stage ? " (" + String(m.stage).toUpperCase() + ")" : ""))); return; }
      p.resolve(m);
    };
    return worker;
  }

  function ask(cmd, extra, ms) {
    var w = boot();
    var id = ++seq;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error("THE LOCAL VOICE DID NOT ANSWER IN " + Math.round(ms / 1000) + "S"));
      }, ms || LIMIT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      var msg = { cmd: cmd, id: id };
      if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
      w.postMessage(msg);
    });
  }

  function settings(opts) {
    opts = opts || {};
    var d = design();
    return {
      model: opts.model || d.model || MODEL,
      dtype: opts.dtype || d.dtype || "q8",
      device: opts.device || d.device || "wasm"
    };
  }

  async function load(opts) {
    opts = opts || {};
    if (meta.ready) return state();
    if (meta.loading) return meta.loading;
    var s = settings(opts);
    meta.loading = (async function () {
      try {
        var m = await ask("load", { model: s.model, dtype: s.dtype, device: s.device }, LIMIT_MS);
        model = m.voices || null;
        meta.ready = true;
        meta.ms = m.ms || 0;
        meta.threads = m.threads || "";
        meta.voices = m.voiceCount || (model ? Object.keys(model).length : 0);
        meta.error = "";
        meta.lastDevice = s.device;
        meta.lastDtype = s.dtype;
        progress = null;
      } catch (e) {
        meta.error = String((e && e.message) || e);
        throw e;
      } finally {
        meta.loading = false;
      }
      return state();
    })();
    return meta.loading;
  }

  function ready() { return !!meta.ready; }
  function loading() { return !!meta.loading; }

  function state() {
    return {
      supported: supported(),
      ready: !!meta.ready,
      loading: !!meta.loading,
      ms: meta.ms,
      error: meta.error,
      device: meta.lastDevice || settings().device,
      dtype: meta.lastDtype || settings().dtype,
      threads: meta.threads,
      voiceCount: meta.voices,
      progress: progress,
      lastMs: meta.lastMs,
      lastSecs: meta.lastSecs,
      at: meta.at
    };
  }

  function roster() {
    if (!model) return [];
    var out = [];
    Object.keys(model).forEach(function (k) {
      var v = model[k] || {};
      out.push({
        id: k,
        name: v.name || k,
        gender: v.gender || "",
        language: v.language || "",
        traits: v.traits || "",
        quality: v.targetQuality || "",
        grade: v.overallGrade || ""
      });
    });
    // The A-grade voices first and alphabetical inside a grade - the order to shop in, not the
    // order the model happens to list them in.
    out.sort(function (a, b) {
      var ga = String(a.grade || "Z"), gb = String(b.grade || "Z");
      if (ga !== gb) return ga < gb ? -1 : 1;
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });
    return out;
  }

  function female() {
    return roster().filter(function (v) { return String(v.gender).toLowerCase() === "female"; });
  }

  function ids() { return roster().map(function (v) { return v.id; }); }

  function name(id) {
    var all = roster();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name;
    return String(id || "");
  }

  // A NAME, AN ID, OR THE START OF ONE - and the female half is preferred when a name matches in
  // both (there is no shared name between the halves today, but the rule is stated so a future
  // model cannot make `/voice kokoro voice heart` ambiguous in the wrong direction).
  function pick(want) {
    var w = String(want == null ? "" : want).trim().toLowerCase();
    if (!w) return null;
    var all = roster();
    var hit = null, loose = null, looseF = null;
    for (var i = 0; i < all.length; i++) {
      var v = all[i], nm = String(v.name).toLowerCase();
      if (v.id === w) return v;
      if (nm === w) { if (!hit || String(v.gender).toLowerCase() === "female") hit = v; }
      else if (nm.indexOf(w) === 0 || v.id.indexOf(w) === 0) { if (String(v.gender).toLowerCase() === "female") looseF = looseF || v; else loose = loose || v; }
    }
    return hit || looseF || loose || null;
  }

  function warm() { return load({}); }

  async function say(text, voice, opts) {
    opts = opts || {};
    if (!meta.ready) await load(opts);
    var v = voice || (design().voice) || "af_heart";
    var m = await ask("say", { text: String(text == null ? "" : text), voice: v, speed: opts.speed }, LIMIT_MS);
    meta.lastMs = m.ms || 0;
    meta.lastSecs = m.secs || 0;
    meta.at = Date.now();
    var blob = new Blob([m.wav], { type: "audio/wav" });
    return { blob: blob, secs: m.secs || 0, ms: m.ms || 0, voice: v };
  }

  // ABANDON WHAT IS IN FLIGHT, KEEP THE MODEL. A generate already running in the worker cannot be
  // cancelled from here - the worker is single-threaded and busy - so this only stops the PAGE from
  // waiting on it. That is enough: voice.js's token makes the answer be dropped when it lands, and
  // the model is still warm for the next sentence, which is the whole reason not to terminate the
  // worker over a hush.
  function stop() { return true; }

  function release() {
    if (worker) { try { worker.terminate(); } catch (e) {} worker = null; }
    if (url) { try { URL.revokeObjectURL(url); } catch (e) {} url = null; }
    pending = {};
    model = null;
    meta = { ready: false, loading: false, ms: 0, threads: "", error: "", lastMs: 0, lastSecs: 0, at: 0, voices: 0 };
    progress = null;
    return true;
  }

  return {
    load: load, warm: warm, ready: ready, loading: loading, state: state, supported: supported,
    roster: roster, female: female, ids: ids, name: name, pick: pick,
    say: say, stop: stop, release: release, design: design,
    harness: { model: MODEL, cdn: CDN, sampleRate: SAMPLE_RATE, rate: function () { return model; } }
  };
})();
