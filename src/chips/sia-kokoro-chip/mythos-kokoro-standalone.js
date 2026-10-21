window.MythosKokoro = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var HOST = (typeof window !== "undefined") ? window : {};
var SEAM = { voice: HOST.voice || null };
var VOICEMAP = opts.voices || null;
var CDN = opts.cdn || "https://esm.sh/kokoro-js@1.2.1";
  var MODEL = opts.model || "onnx-community/Kokoro-82M-v1.0-ONNX";
  var SAMPLE_RATE = 24000;
  var LIMIT_MS = 600000;      // a cold 90MB fetch on a slow line is not a failure; ten minutes is

  var SRC = [
    'import { KokoroTTS, env } from "' + CDN + '";',
    'var tts = null, loading = null;',
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
  var model = null;
  var meta = { ready: false, loading: false, ms: 0, threads: "", error: "", lastMs: 0, lastSecs: 0, at: 0, voices: 0 };
  var progress = null;

  function design() {
    try {
      if (SEAM.voice && SEAM.voice.kokoroDesign) return SEAM.voice.kokoroDesign() || {};
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
        meta.voices = m.voiceCount || (model ? Object.keys(model || VOICEMAP).length : 0);
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
    if (!model && !VOICEMAP) return [];
    var out = [];
    Object.keys(model || VOICEMAP).forEach(function (k) {
      var v = (model || VOICEMAP)[k] || {};
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


return { load: load, warm: warm, ready: ready, loading: loading, state: state, supported: supported, roster: roster, female: female, ids: ids, name: name, pick: pick, say: say, stop: stop, release: release, design: design };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosKokoro;
