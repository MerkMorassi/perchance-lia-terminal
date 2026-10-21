/* CHATTERBOX — her own audio clip in her seed voice. Drop-in vanilla module.
   Seed sample per role + Gradio-queue TTS + [[SAY:]] self-prompt parsing.
   No framework. Configure BASE for a self-hosted Space. */
window.Chatterbox = (function () {
  "use strict";
  var BASE = "https://resembleai-chatterbox.hf.space";
  var CALL = "/gradio_api/call/generate_tts_audio";
  var UPLOAD = "/gradio_api/upload";
  var MAX_CHARS = 300, SEED = 42, EXAG = 0.5, TEMP = 0.8, CFGW = 0.5, VAD = false;
  var samples = {}, FALLBACK = "*", refCache = { id: "", path: "" };
  function configure(o) { o = o || {}; if (o.base) BASE = String(o.base).replace(/\/+$/, ""); if (o.seed != null) SEED = o.seed >>> 0; if (o.exaggeration != null) EXAG = o.exaggeration; if (o.temperature != null) TEMP = o.temperature; if (o.cfgWeight != null) CFGW = o.cfgWeight; if (o.vadTrim != null) VAD = !!o.vadTrim; return snapshot(); }
  function snapshot() { return { base: BASE, seed: SEED, exaggeration: EXAG, temperature: TEMP, cfgWeight: CFGW, roles: Object.keys(samples) }; }
  function setSample(role, blob, name) { samples[String(role || FALLBACK)] = { blob: blob, name: name || "seed.wav" }; refCache = { id: "", path: "" }; }
  function sampleFor(role) { return samples[String(role || "")] || samples[FALLBACK] || null; }
  function chunk(text) {
    var words = String(text || "").split(/\s+/).filter(Boolean), parts = [], cur = "";
    words.forEach(function (w) { if ((cur + " " + w).trim().length > MAX_CHARS && cur) { parts.push(cur.trim()); cur = w; } else cur = (cur + " " + w); });
    if (cur.trim()) parts.push(cur.trim());
    return parts.length ? parts : [""];
  }
  async function uploadRef(blob, name) {
    var fd = new FormData(); fd.append("files", blob, name || "reference.wav");
    var res = await fetch(BASE + UPLOAD, { method: "POST", body: fd });
    if (!res.ok) throw new Error("SEED SAMPLE UPLOAD REFUSED (HTTP " + res.status + ")");
    var paths = await res.json();
    if (!paths || !paths.length) throw new Error("SEED SAMPLE UPLOAD ANSWERED WITH NOTHING");
    return String(paths[0]);
  }
  async function ensureRef(role) {
    var s = sampleFor(role);
    if (!s) return null;
    var key = (s.name || "") + ":" + (s.blob.size || 0);
    if (refCache.id === key && refCache.path) return { path: refCache.path };
    var path = await uploadRef(s.blob, s.name);
    refCache = { id: key, path: path };
    return { path: path };
  }
  function params(text, ref) { return [text, ref || null, EXAG, TEMP, SEED, CFGW, VAD]; }
  function sessionHash() { var o = ""; try { var a = new Uint8Array(8); crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) o += (a[i] % 36).toString(36); } catch (e) { o = "lia" + Date.now().toString(36); } return o; }
  async function queueRender(text, ref) {
    var session = sessionHash();
    var join = await fetch(BASE + "/gradio_api/queue/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: params(text, ref), event_data: null, fn_index: 0, session_hash: session }) });
    if (!join.ok) throw new Error("TTS QUEUE REFUSED (HTTP " + join.status + ")");
    var stream = await fetch(BASE + "/gradio_api/queue/data?session_hash=" + encodeURIComponent(session), { headers: { Accept: "text/event-stream" } });
    var body = await stream.text(), url = "";
    body.split("\n\n").forEach(function (blk) {
      var ev = "", dat = "";
      blk.split("\n").forEach(function (ln) { if (ln.indexOf("event:") === 0) ev = ln.slice(6).trim(); if (ln.indexOf("data:") === 0) dat += ln.slice(5).trim(); });
      if (ev === "complete" && dat) { try { var p = JSON.parse(dat); var f = p && p[0]; url = (f && (f.url || (f.path ? BASE + "/gradio_api/file=" + f.path : ""))) || url; } catch (e) {} }
    });
    if (!url) {
      var call = await fetch(BASE + CALL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: params(text, ref) }) });
      if (!call.ok) throw new Error("TTS RENDER REFUSED (HTTP " + call.status + ")");
      var head = await call.json(), id = head && head.event_id;
      if (!id) throw new Error("TTS SPACE STARTED NO JOB");
      var ev2 = await fetch(BASE + CALL + "/" + id, { headers: { Accept: "text/event-stream" } });
      var b2 = await ev2.text();
      b2.split("\n\n").forEach(function (blk) {
        var ev = "", dat = "";
        blk.split("\n").forEach(function (ln) { if (ln.indexOf("event:") === 0) ev = ln.slice(6).trim(); if (ln.indexOf("data:") === 0) dat += ln.slice(5).trim(); });
        if ((ev === "complete" || dat) && dat && !url) { try { var q = JSON.parse(dat); var g = q && q[0]; url = (g && (g.url || (g.path ? BASE + "/gradio_api/file=" + g.path : ""))) || url; } catch (e) {} }
      });
    }
    if (!url) throw new Error("TTS SPACE FINISHED WITHOUT AUDIO");
    var audio = await fetch(url);
    if (!audio.ok) throw new Error("TTS AUDIO UNCOLLECTABLE (HTTP " + audio.status + ")");
    var blob = await audio.blob();
    if (!blob.size) throw new Error("TTS AUDIO CAME BACK EMPTY");
    return blob;
  }
  async function speak(text, role, onPart) {
    var parts = chunk(text), blobs = [], ref = await ensureRef(role);
    for (var i = 0; i < parts.length; i++) {
      var b = await queueRender(parts[i], ref);
      blobs.push(b);
      if (onPart) { try { await onPart(b, i + 1, parts.length); } catch (e) {} }
    }
    return { blobs: blobs, parts: parts.length, backend: "chatterbox" };
  }
  var SAY_RE = /\[\[?\s*SAY\s*:\s*([^\]]{2,}?)\s*\]\]?/gi;
  var SAY_BARE = /(^|\n)[ \t]*SAY\s*[:\-]\s*([^\n]{2,})[ \t]*$/i;
  function extractSay(reply) {
    var text = String(reply == null ? "" : reply), out = [];
    text = text.replace(SAY_RE, function (m, p) { if (p && p.trim()) out.push(p.trim().replace(/\s+/g, " ")); return ""; });
    if (!out.length) { var b = SAY_BARE.exec(text); if (b) { out.push(b[2].trim().replace(/\s+/g, " ")); text = text.slice(0, b.index + b[1].length); } }
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return { text: text, say: out.slice(0, 1) };
  }
  var SYSTEM_HINT = "To speak aloud in your own voice, end your reply with the [[SAY: the exact words to voice]] line - the very last line, alone, nothing after it. One SAY per reply. What you write there is rendered in your seed voice and played under your turn.";
  return { configure: configure, snapshot: snapshot, setSample: setSample, sampleFor: sampleFor, chunk: chunk, speak: speak, extractSay: extractSay, SYSTEM_HINT: SYSTEM_HINT };
})();
