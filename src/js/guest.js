window.guest = (function () {
  "use strict";

  /* ---- GUESTCOMM -------------------------------------------------------------
     THE PRIVATE LINE: producer and guest, a phone call, audio only. Her signal
     (the iRIG line) in his headphones, his mic (this system's default) on her
     ears - no floor, no gate, no GO LIVE, no Barbelo. She is dark the whole
     time the line is up: hushed at call time, her replies held at the voice
     door (a permanent one-check door, installed once - never stacked, never
     unwound).
     The line refuses while the floor is live or the other private roads hold
     her, and they refuse while it is up - one holder of her ears at a time.
     --------------------------------------------------------------------------- */

  function el(id) { return document.getElementById(id); }
  function print(t) { if (typeof window.print === "function" && t) window.print("SYSTEM", t); }
  function vox() { return window.voice || null; }

  var st = {
    ctx: null,
    herSrc: "", outId: null, outPin: false, herMute: false, micMute: false,
    micSrc: null, earId: null,
    guestName: "", trScript: true, trCtx: true, chanBefore: "",
    up: false,
    herStream: null, herDev: null, micStream: null, micDev: null,
    herSrcN: null, herGain: null, herAn: null, herBuf: null,
    micSrcN: null, micGain: null, micAn: null, micBuf: null,
    trDest: null, trRec: null, trMime: "", trQ: null, trBusy: false, trDead: false,
    trFails: 0, trTimer: 0, myTimer: 0,
    trLoading: false, trErr: "", trHer: 0, trHis: 0,
    myTrDest: null, myRec: null, myQ: null,
    trPipe: null, trPipeLoading: null,
    ctxArmed: false,
    callAt: 0, callTimer: 0, CALL_LEN: 30 * 60 * 1000,
    devs: [], outs: [],
    paintTimer: 0,
    trDiag: null
  };

  var trPipeModel = "";

  var guDoorInstalled = false;

  // A load started by show() must never clobber a hand that moved while it
  // was in flight (every words() verb re-shows first), and a save must never
  // persist half-loaded defaults over the kept record. Dirty-field tracking:
  // every mutation marks its fields; a resolving read assigns only clean
  // fields; verbs await the load before mutating, so the rest arrive first.
  var rev = 0, loadP = null, dirty = {};
  function touch(f) { try { dirty[f] = true; } catch (e) {} }
  async function ready() { try { if (loadP) await loadP; } catch (e) {} }

  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }

  async function savedGet() {
    var k = kv();
    if (!k) return;
    try {
      var s = await k.get("guest");
      if (s && typeof s === "object") {
        if (!dirty.herSrc && typeof s.herSrc === "string") st.herSrc = s.herSrc;
        if (!dirty.outId) { if (typeof s.outId === "string") st.outId = s.outId; else st.outId = null; }
        if (!dirty.outPin) st.outPin = (s.outPin === true);
        if (!dirty.guestName && typeof s.guestName === "string") st.guestName = s.guestName.slice(0, 24);
        if (!dirty.trScript) st.trScript = (s.trScript !== false);
        // CONTEXT is startup configuration (2026-10-21): ON means both filed
        // transcripts ride chatHistory (the window Barbelo reads); OFF means
        // they paint in the chat and file to the archive, but she stays dark
        // to them. Default ON; the choice in force at CALL holds the call.
        if (!dirty.trCtx) st.trCtx = (s.trCtx !== false);
        if (!dirty.micSrc) { if (typeof s.micSrc === "string") st.micSrc = s.micSrc; else st.micSrc = null; }
        if (!dirty.earId) { if (typeof s.earId === "string") st.earId = s.earId; else st.earId = null; }
      } else {
        if (!dirty.outId) st.outId = null;
        if (!dirty.micSrc) st.micSrc = null;
        if (!dirty.earId) st.earId = null;
      }
    } catch (e) {}
  }

  async function savedSet() {
    rev++;
    try { if (loadP) await loadP; } catch (e) {}
    var k = kv();
    if (!k) return;
    try { await k.set("guest", { herSrc: st.herSrc, outId: st.outId || "", outPin: !!st.outPin, micSrc: st.micSrc || "", earId: st.earId || "", guestName: st.guestName || "", trScript: !!st.trScript, trCtx: !!st.trCtx }); }
    catch (e) {}
  }

  function actx() {
    if (st.ctx) return st.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { st.ctx = new AC(); } catch (e) { return null; }
    if (st.ctx.state === "suspended") { try { st.ctx.resume(); } catch (e) {} }
    return st.ctx;
  }

  function hush() {
    try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) {}
    try { var v = vox(); if (v && typeof v.stop === "function") v.stop(); } catch (e) {}
    try { var v2 = vox(); if (v2 && typeof v2.hush === "function") v2.hush(); } catch (e) {}
  }

  // Her master arm stays off while the line is up. One door, installed once:
  // it checks the flag, never stacks, never unwinds - down means passthrough.
  function ensureHold() {
    if (guDoorInstalled) return;
    var v = vox();
    if (!v || typeof v.speak !== "function") return;
    var orig = v.speak;
    var door = function (text, opts) {
      if (st.up) {
        hush();
        return Promise.resolve({ ok: false, error: "MUTED" });
      }
      return orig.call(v, text, opts);
    };
    try { v.speak = door; guDoorInstalled = true; } catch (e) {}
  }

  function rmsOf(an, buf) {
    if (!an || !buf) return 0;
    try {
      an.getByteTimeDomainData(buf);
      var sum = 0;
      for (var i = 0; i < buf.length; i++) {
        var v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buf.length);
    } catch (e) { return 0; }
  }

  function setGain(g, v) {
    if (!g) return;
    try {
      var t = st.ctx ? st.ctx.currentTime : null;
      if (t !== null && g.gain.setTargetAtTime) g.gain.setTargetAtTime(v, t, 0.04);
      else g.gain.value = v;
    } catch (e) { try { g.gain.value = v; } catch (x) {} }
  }

  function safePlay(a) {
    try {
      var p = a ? a.play() : null;
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  async function enumDevs() {
    var ins = [], outs = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return { ins: ins, outs: outs };
      var all = await navigator.mediaDevices.enumerateDevices();
      all.forEach(function (d) {
        if (d.kind === "audioinput") ins.push({ id: d.deviceId || "", label: d.label || "MICROPHONE" });
        else if (d.kind === "audiooutput") outs.push({ id: d.deviceId || "", label: d.label || "OUTPUT" });
      });
    } catch (e) {}
    return { ins: ins, outs: outs };
  }

  async function unlockLabels() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
      var s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      return true;
    } catch (e) { return false; }
  }

  function fillSel(id, items) {
    var s = el(id);
    if (!s) return;
    s.innerHTML = "";
    items.forEach(function (it) {
      var o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.label;
      s.appendChild(o);
    });
  }

  function keepVal(id, want, fallback) {
    try {
      var s = el(id);
      if (!s) return fallback;
      s.value = want;
      if (s.value !== want) s.value = fallback;
      return String(s.value || fallback);
    } catch (e) { return fallback; }
  }

  function irigIn(devs) {
    for (var i = 0; i < devs.length; i++) {
      if (/irig/i.test(devs[i].label || "")) return devs[i].id || "";
    }
    return "";
  }

  function irigOut(outs) {
    var alias = "";
    for (var i = 0; i < outs.length; i++) {
      if (/irig/i.test(outs[i].label || "")) {
        if (outs[i].id === "default" || outs[i].id === "communications") { if (!alias) alias = outs[i].id || ""; }
        else return outs[i].id || "";
      }
    }
    return alias;
  }

  // HIS DEFAULTS, BY LABEL - no dropdowns, nothing to fiddle with. His mic is
  // the USB line on his Logi headphones (a bare USB line is the fallback);
  // his ears are the Logi headphones (a bare USB line is the fallback).
  function logiMic(devs) {
    var usb = "";
    for (var i = 0; i < devs.length; i++) {
      var lb = devs[i].label || "";
      if (/logi/i.test(lb)) return devs[i].id || "";
      if (!usb && /usb/i.test(lb)) usb = devs[i].id || "";
    }
    return usb;
  }

  function logiEar(outs) {
    var alias = "", usb = "", usbAlias = "";
    for (var i = 0; i < outs.length; i++) {
      var lb = outs[i].label || "";
      var real = outs[i].id !== "default" && outs[i].id !== "communications";
      if (/logi/i.test(lb)) {
        if (real) return outs[i].id || "";
        if (!alias) alias = outs[i].id || "";
      } else if (!usb && /usb/i.test(lb)) {
        if (real) usb = outs[i].id || "";
        else if (!usbAlias) usbAlias = outs[i].id || "";
      }
    }
    return alias || usb || usbAlias;
  }

  function alive(list, id) {
    if (!id) return false;
    for (var i = 0; i < list.length; i++) { if ((list[i].id || "") === id) return true; }
    return false;
  }

  // Effective roads for this call: the saved id while it is plugged in, else
  // the system default for this call only (the saved id is kept, so a
  // replugged headset is followed home on the next refresh).
  function effMic() { return (st.micSrc && alive(st.devs, st.micSrc)) ? st.micSrc : ""; }
  function effEar() { return (st.earId && alive(st.outs, st.earId)) ? st.earId : ""; }

  async function refresh() {
    await unlockLabels();
    var dev = await enumDevs();
    st.devs = dev.ins;
    st.outs = dev.outs;
    var ins = dev.ins.map(function (m, i) {
      return { id: m.id || "default", label: (m.label || ("INPUT " + (i + 1))).toUpperCase().slice(0, 48) };
    });
    fillSel("gcHerSrc", [{ id: "", label: "OFF - LINE DARK" }].concat(ins));
    var outs = dev.outs.map(function (m, i) {
      return { id: m.id || "", label: (m.label || ("OUTPUT " + (i + 1))).toUpperCase().slice(0, 48) };
    });
    fillSel("gcOut", [{ id: "", label: "DEFAULT OUTPUT" }].concat(outs));
    // STICKY iRIG both ways: a dead saved id follows the label home; an
    // explicit OFF (her) or DEFAULT (out) is never overridden - only a first
    // sighting (nothing saved yet) auto-picks her ears' line.
    var herWant = st.herSrc;
    st.herSrc = keepVal("gcHerSrc", st.herSrc || "", "");
    if (herWant && st.herSrc !== herWant) {
      var ri = irigIn(dev.ins);
      if (ri && st.herSrc !== ri) { st.herSrc = keepVal("gcHerSrc", ri, ""); savedSet(); }
    }
    var outWant = st.outId;
    st.outId = keepVal("gcOut", st.outId || "", "");
    // GUEST OUT defaults to the iRIG line too - the whole guest side is iRig.
    // A blank that was never explicitly chosen follows it home (said out loud
    // once); picking DEFAULT in the dropdown pins the blank and is respected.
    if (outWant === null || (outWant && st.outId !== outWant) || (!st.outId && !st.outPin)) {
      var ro = irigOut(dev.outs);
      if (ro && st.outId !== ro) {
        st.outId = keepVal("gcOut", ro, "");
        savedSet();
        if (!outWant) print("GUESTCOMM :: GUEST OUT WAS BLANK - TOOK THE iRIG LINE. PICK DEFAULT IN THE DROPDOWN IF THAT IS WRONG.");
      }
    }
    // HIS DEFAULTS, SAME STICKY RULE: first sighting auto-picks the USB Logi
    // lines; a dead saved id follows the label home; an unplugged headset
    // falls back to the system default for the call (nothing saved).
    var lm = logiMic(dev.ins);
    if (st.micSrc === null) { st.micSrc = lm || ""; savedSet(); }
    else if (st.micSrc && !alive(dev.ins, st.micSrc) && lm) { st.micSrc = lm; savedSet(); }
    var le = logiEar(dev.outs);
    if (st.earId === null) { st.earId = le || ""; savedSet(); }
    else if (st.earId && !alive(dev.outs, st.earId) && le) { st.earId = le; savedSet(); }
    applyEarSink();
    paint();
  }

  function herLabel() {
    if (!st.herSrc) return "OFF";
    for (var i = 0; i < st.devs.length; i++) {
      if ((st.devs[i].id || "") === st.herSrc) return String(st.devs[i].label || "INPUT").toUpperCase().slice(0, 28);
    }
    return "INPUT";
  }

  function outLabel() {
    if (!st.outId) return "DEFAULT";
    for (var i = 0; i < st.outs.length; i++) {
      if ((st.outs[i].id || "") === st.outId) return String(st.outs[i].label || "OUTPUT").toUpperCase().slice(0, 28);
    }
    return "OUTPUT";
  }

  function devLabel(list, id, fb) {
    if (!id) return fb;
    for (var i = 0; i < list.length; i++) {
      if ((list[i].id || "") === id) return String(list[i].label || fb).toUpperCase().slice(0, 34);
    }
    return fb;
  }

  // What the panel names: the live track's own label while up (honest even
  // through a default-fallback call), else the resolved default.
  function micLabel() {
    if (st.up && st.micLive) return String(st.micLive).toUpperCase().slice(0, 34);
    return devLabel(st.devs, effMic(), "SYSTEM DEFAULT MIC");
  }

  function earLabel() {
    return devLabel(st.outs, effEar(), "SYSTEM DEFAULT OUTPUT");
  }

  // The route can land a beat after setSinkId returns, so every apply
  // verifies now AND once more after the promise (or a beat) settles - the
  // OUT lamp heals itself instead of crying NO ROUTE over a slow landing.
  function applySink() {
    var f = el("gcFeed");
    var want = st.outId || "";
    if (!f || typeof f.setSinkId !== "function") { st.sinkOk = !want; paint(); return Promise.resolve(st.sinkOk); }
    var done = function () {
      var got = "";
      try { got = String(f.sinkId || ""); } catch (e) {}
      st.sinkOk = (got === want) || (!want && !got);
      paint();
      return st.sinkOk;
    };
    try {
      var p = f.setSinkId(want);
      if (p && typeof p.then === "function") return p.then(done, function () { st.sinkOk = false; paint(); return false; });
    } catch (e) { st.sinkOk = false; paint(); return Promise.resolve(false); }
    done();
    setTimeout(done, 600);
    return Promise.resolve(st.sinkOk);
  }

  // HIS EARS, PINNED: her voice plays his USB headphones, not wherever the
  // system default happens to point today. Set on the element, so it holds
  // for the call; re-applied on refresh, so a replugged headset is followed.
  function applyEarSink() {
    var a = el("gcEar");
    var want = effEar();
    if (!a || typeof a.setSinkId !== "function") { st.earOk = !want; paint(); return Promise.resolve(st.earOk); }
    var done = function () {
      var got = "";
      try { got = String(a.sinkId || ""); } catch (e) {}
      st.earOk = (got === want) || (!want && !got);
      paint();
      return st.earOk;
    };
    try {
      var p = a.setSinkId(want || "");
      if (p && typeof p.then === "function") return p.then(done, function () { st.earOk = false; paint(); return false; });
    } catch (e) { st.earOk = false; paint(); return Promise.resolve(false); }
    done();
    setTimeout(done, 600);
    return Promise.resolve(st.earOk);
  }

  function guestName() {
    return String(st.guestName || "").replace(/\s+/g, " ").trim().slice(0, 24);
  }

  function guestLabel() {
    return (guestName() || "GUEST").toUpperCase();
  }

  // THE TRANSCRIPT. Both voices off their own roads, filed under their own
  // names: painted in the chat, written to the archive, STT only, no TTS, no
  // extra audio - audio feed to chat window. Whether Barbelo SEES them is the
  // startup choice: CONTEXT ON at CALL arms both filings into chatHistory
  // (the window she reads); OFF leaves them visible + archived, but dark to
  // her. She never speaks aloud while the line is up; the radio gate holds
  // her mouth, never the words.
  function ctxAllow() {
    // Mid-call the armed choice holds the call; by hand (line down) the live
    // toggle answers.
    return st.up ? !!st.ctxArmed : !!st.trCtx;
  }

  async function fileLine(text) {
    text = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!text) return false;
    var nm = guestLabel();
    var ts = Date.now();
    // Live lines paint LIVE (full-bright). The dim history shade is for the
    // archive replay road only - a fresh transcript must never look old.
    try { if (typeof window.print === "function") window.print("Guest", text, false, null, { name: nm, ts: ts }); } catch (e) {}
    try { if (typeof window.archiveTurn === "function") await window.archiveTurn({ h: "", s: "", kind: "guest", guest: nm, text: text, ts: ts }); } catch (e) {}
    if (ctxAllow()) {
      try {
        if (window.chatHistory) {
          window.chatHistory.push({ role: nm, content: text, ts: ts, layer: "" });
          while (window.chatHistory.length > 10) window.chatHistory.shift();
        }
      } catch (e) {}
    }
    st.trHer++;
    try { paint(); } catch (e) {}
    return true;
  }

  // HIS side of the transcript: his mic, filed under HITL - painted HITL:,
  // archived, and armed into chatHistory beside hers when context is armed.
  async function fileLineHis(text) {
    text = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!text) return false;
    var ts = Date.now();
    // Live lines paint LIVE (full-bright) - see fileLine above.
    try { if (typeof window.print === "function") window.print("Guest", text, false, null, { name: "HITL", ts: ts }); } catch (e) {}
    try { if (typeof window.archiveTurn === "function") await window.archiveTurn({ h: "", s: "", kind: "guest", guest: "HITL", text: text, ts: ts }); } catch (e) {}
    if (ctxAllow()) {
      try {
        if (window.chatHistory) {
          window.chatHistory.push({ role: "HITL", content: text, ts: ts, layer: "" });
          while (window.chatHistory.length > 10) window.chatHistory.shift();
        }
      } catch (e) {}
    }
    st.trHis++;
    try { paint(); } catch (e) {}
    return true;
  }

  // TRANSCRIPT DIAGNOSTICS - every silent drop leaves its reason here, so the
  // LINE row and /guest status can say where takes die instead of going quiet.
  // Nothing here prints to the chat: the chat stays for real speech, status for
  // the machinery. st.trDiag = { herChunks, hisChunks, lastSide, lastBytes,
  // lastRms, lastRaw, lastFiled, lastDrop, lastAt }.
  function diag() {
    if (!st.trDiag) st.trDiag = { herChunks: 0, hisChunks: 0, lastSide: "", lastBytes: 0, lastRms: 0, lastRaw: "", lastFiled: "", lastDrop: "", lastAt: 0 };
    return st.trDiag;
  }
  function diagDrop(side, reason) {
    try { var d = diag(); d.lastSide = String(side || ""); d.lastDrop = String(reason || "DROPPED").slice(0, 80); d.lastFiled = ""; d.lastAt = Date.now(); } catch (e) {}
  }
  function diagFiled(side, text) {
    try { var d = diag(); d.lastSide = String(side || ""); d.lastFiled = String(text || "").slice(0, 80); d.lastDrop = ""; d.lastAt = Date.now(); } catch (e) {}
  }
  function diagShort() {
    try {
      var d = st.trDiag;
      if (!d || !d.lastAt) return "NO CHUNKS YET";
      var kb = d.lastBytes >= 1024 ? (d.lastBytes / 1024).toFixed(1) + "KB" : d.lastBytes + "B";
      var tail = d.lastFiled ? ("FILED \"" + d.lastFiled.slice(0, 40) + "\"") : (d.lastDrop || "HELD");
      return "LAST " + (d.lastSide || "?") + " " + kb + " rms " + Number(d.lastRms || 0).toFixed(3) + " " + tail;
    } catch (e) { return ""; }
  }
  function withTimeout(p, ms, label) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { try { rej(new Error(label + " TIMEOUT")); } catch (e) {} }, ms); })]);
  }

  // LOCAL STT, NO KEY (2026-10-21): Groq is legacy and unused here. Her chunks
  // are transcribed in this browser by a Whisper-tiny model (first CALL fetches
  // ~40MB once, then everything stays on this machine). No TTS, no cloud key,
  // no quota beyond the download. Native Perchance AI stays the main line;
  // Gemini-paid / localhost-Gemma remain future options, not requirements.
  async function ensurePipe() {
    if (st.trPipe) return st.trPipe;
    if (st.trPipeLoading) return st.trPipeLoading;
    // The model fetch is the long silence in this road: the panel shows
    // LOADING while it runs, so a quiet transcript reads as working, not dead.
    st.trLoading = true; st.trErr = "";
    try { paint(); } catch (e) {}
    st.trPipeLoading = (async function () {
      var mod = await import("https://esm.sh/@huggingface/transformers@3");
      try { if (mod.env) { mod.env.allowLocalModels = false; } } catch (e) {}
      var lastErr = null;
      var ids = ["onnx-community/whisper-tiny.en", "Xenova/whisper-tiny.en"];
      for (var mi = 0; mi < ids.length; mi++) {
        try {
          st.trPipe = await mod.pipeline("automatic-speech-recognition", ids[mi]);
          trPipeModel = ids[mi];
          break;
        } catch (e) { lastErr = e; st.trPipe = null; }
      }
      if (!st.trPipe) throw lastErr || new Error("NO MODEL");
      st.trLoading = false;
      try { paint(); } catch (e2) {}
      return st.trPipe;
    })();
    try { return await st.trPipeLoading; }
    catch (e) {
      st.trLoading = false;
      st.trErr = String((e && e.message) || e).toUpperCase().slice(0, 120);
      try { paint(); } catch (e2) {}
      throw e;
    }
    finally { st.trPipeLoading = null; }
  }

  async function blobToPcm16k(blob) {
    var ab = await blob.arrayBuffer();
    var c = actx();
    if (!c) throw new Error("NO AUDIO ON THIS MACHINE");
    var copy = ab.slice(0);
    var buf = await c.decodeAudioData(copy);
    // An empty chunk decodes to nothing: file silence, never throw (a throw
    // here reads as a dead transcript, and it is only a quiet 5 seconds).
    if (!buf || !buf.length) return new Float32Array(0);
    var mono = null;
    if (buf.numberOfChannels > 1) {
      mono = new Float32Array(buf.length);
      for (var ch = 0; ch < buf.numberOfChannels; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels;
      }
    } else {
      mono = buf.getChannelData(0).slice(0);
    }
    if (!mono.length) return mono;
    if (buf.sampleRate === 16000) return mono;
    var off = new OfflineAudioContext(1, Math.max(1, Math.ceil(mono.length * 16000 / buf.sampleRate)), 16000);
    var tmp = off.createBuffer(1, mono.length, buf.sampleRate);
    tmp.getChannelData(0).set(mono);
    var src = off.createBufferSource();
    src.buffer = tmp;
    src.connect(off.destination);
    src.start(0);
    var rendered = await off.startRendering();
    return rendered.getChannelData(0).slice(0);
  }

  function cleanLocalText(t) {
    t = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
    if (!t || t.length < 2) return "";
    if (/^\[.*\]$/.test(t)) return "";
    var low = t.toLowerCase();
    if (low === "you" || low === "thank you." || low === "thank you") return "";
    return t;
  }

  async function transcribeBlob(blob, side) {
    side = String(side || "");
    if (!blob || !blob.size) { diagDrop(side, "EMPTY CHUNK"); return ""; }
    try { var d0 = diag(); d0.lastSide = side; d0.lastBytes = blob.size || 0; } catch (e) {}
    var pipe = await withTimeout(ensurePipe(), 300000, "MODEL LOAD");
    var pcm = await blobToPcm16k(blob);
    if (!pcm || !pcm.length) { diagDrop(side, "DECODE EMPTY"); return ""; }
    var sum = 0;
    for (var i = 0; i < pcm.length; i += 4) { var v = pcm[i]; sum += v * v; }
    var rms = Math.sqrt(sum / Math.max(1, Math.ceil(pcm.length / 4)));
    try { diag().lastRms = rms; } catch (e) {}
    if (rms < 0.01) { diagDrop(side, "QUIET rms " + rms.toFixed(3)); return ""; }
    var out = await withTimeout(pipe(pcm, { chunk_length_s: 30, stride_length_s: 5 }), 120000, "TRANSCRIPT");
    var raw = String((out && out.text) == null ? "" : out.text);
    try { diag().lastRaw = raw.slice(0, 80); } catch (e) {}
    var clean = cleanLocalText(raw);
    if (!clean) { diagDrop(side, raw ? ("FILTERED \"" + raw.slice(0, 40) + "\"") : "NO SPEECH"); return ""; }
    return clean;
  }

  function trTapStop() {
    try { if (st.trTimer) clearInterval(st.trTimer); } catch (e) {}
    try { if (st.myTimer) clearInterval(st.myTimer); } catch (e) {}
    st.trTimer = 0; st.myTimer = 0;
    try { if (st.trRec && st.trRec.state !== "inactive") st.trRec.stop(); } catch (e) {}
    st.trRec = null;
    try { if (st.myRec && st.myRec.state !== "inactive") st.myRec.stop(); } catch (e) {}
    st.myRec = null;
    try { if (st.herSrcN && st.trDest) st.herSrcN.disconnect(st.trDest); } catch (e) {}
    try { if (st.trDest) st.trDest.disconnect(); } catch (e) {}
    st.trDest = null;
    try { if (st.micSrcN && st.myTrDest) st.micSrcN.disconnect(st.myTrDest); } catch (e) {}
    try { if (st.myTrDest) st.myTrDest.disconnect(); } catch (e) {}
    st.myTrDest = null;
  }

  function trPickMime() {
    if (st.trMime) return st.trMime;
    if (typeof MediaRecorder === "undefined") return "";
    var cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (var i = 0; i < cands.length; i++) {
      try { if (MediaRecorder.isTypeSupported(cands[i])) { st.trMime = cands[i]; return st.trMime; } } catch (e) {}
    }
    return "";
  }

  // ONE 5s TAKE PER RECORDER (2026-10-21): MediaRecorder timeslice blobs
  // after the first are bare webm clusters with no header - decodeAudioData
  // chokes on them, and one bad chunk used to murder the whole call's
  // transcript (the pump stood the transcript down and emptied both queues).
  // Every take is now its own recorder: start clean, stop at 5s, the stopped
  // blob is a whole file and decodes. The interval rotates; the stop handler
  // files the take and re-arms while the line is up. Hangup stops the
  // recorders without re-arming (up is already false), and the stops flush
  // both sides' last words through the pump.
  function armRoad(side) {
    var c = st.ctx;
    if (!c || !st.up) return false;
    var recKey = (side === "him") ? "myRec" : "trRec";
    // Never double-arm: a slow stop handler re-arming beside the interval
    // would record the road twice and file every take twice.
    try { if (st[recKey] && st[recKey].state !== "inactive") return true; } catch (e) {}
    var srcN = (side === "him") ? st.micSrcN : st.herSrcN;
    if (!srcN) return false;
    var mime = trPickMime();
    if (!mime) return false;
    var destKey = (side === "him") ? "myTrDest" : "trDest";
    var qKey = (side === "him") ? "myQ" : "trQ";
    try {
      var dest = c.createMediaStreamDestination();
      srcN.connect(dest);
      st[destKey] = dest;
      var rec = new MediaRecorder(dest.stream, { mimeType: mime });
      if (!st[qKey]) st[qKey] = [];
      rec.ondataavailable = function (e) {
        if (e && e.data && e.data.size > 0) { st[qKey].push(e.data); trPump(); }
      };
      rec.onstop = function () {
        if (st.up) armRoad(side);
        trPump();
      };
      rec.start();
      st[recKey] = rec;
      return true;
    } catch (e) { return false; }
  }

  function rotateRoad(side) {
    if (!st.up) return;
    var recKey = (side === "him") ? "myRec" : "trRec";
    var destKey = (side === "him") ? "myTrDest" : "trDest";
    var srcN = (side === "him") ? st.micSrcN : st.herSrcN;
    var rec = st[recKey];
    var dest = st[destKey];
    st[recKey] = null;
    try { if (srcN && dest) srcN.disconnect(dest); } catch (e) {}
    try { if (dest) dest.disconnect(); } catch (e) {}
    if (rec) { try { if (rec.state !== "inactive") rec.stop(); } catch (e) {} }
    else if (st.up) armRoad(side);
  }

  function trStart(c) {
    trTapStop();
    st.trQ = [];
    st.myQ = [];
    st.trFails = 0;
    var her = armRoad("her");
    var him = armRoad("him");
    if (!her && !him) { trTapStop(); return false; }
    try {
      if (st.trTimer) clearInterval(st.trTimer);
      if (st.myTimer) clearInterval(st.myTimer);
      st.trTimer = setInterval(function () { rotateRoad("her"); }, 5000);
      st.myTimer = setInterval(function () { rotateRoad("him"); }, 5000);
    } catch (e) {}
    return true;
  }

  async function trPump() {
    if (st.trBusy) return;
    st.trBusy = true;
    try {
      while ((st.trQ && st.trQ.length) || (st.myQ && st.myQ.length)) {
        var blob = null, mine = false;
        if (st.trQ && st.trQ.length) { blob = st.trQ.shift(); mine = false; }
        else if (st.myQ && st.myQ.length) { blob = st.myQ.shift(); mine = true; }
        else break;
        try { var dd = diag(); if (mine) dd.hisChunks++; else dd.herChunks++; } catch (e) {}
        var text = "";
        try { text = await transcribeBlob(blob, mine ? "HIM" : "HER"); }
        catch (e) {
          // ONE BAD TAKE IS ONE BAD TAKE (2026-10-21): a single undecodable
          // chunk used to stand the whole call's transcript down and empty
          // both queues with it. Now it leaves its reason on the panel and
          // the pump carries on; three in a row still stands the transcript
          // down for the call, and the next filed take heals it.
          st.trFails = (st.trFails || 0) + 1;
          var why = String((e && e.message) || e).toUpperCase().slice(0, 80);
          try { diagDrop(mine ? "HIM" : "HER", why || "ENGINE DOWN"); } catch (e2) {}
          if (st.trFails >= 3 && !st.trDead) {
            st.trDead = true;
            st.trErr = why.slice(0, 140);
            try { paint(); } catch (e2) {}
            print("GUESTCOMM :: TRANSCRIPT OFF FOR THIS CALL (" + why.slice(0, 140) + "). THE LINE IS UNAFFECTED - /guest say <WORDS> STILL FILES HER WORDS BY HAND.");
          } else { try { paint(); } catch (e2) {} }
          continue;
        }
        if (text) {
          st.trFails = 0;
          if (st.trDead) { st.trDead = false; st.trErr = ""; }
          try { if (mine) await fileLineHis(text); else await fileLine(text); } catch (e) {}
          diagFiled(mine ? "HIM" : "HER", text);
        }
      }
    } finally { st.trBusy = false; }
  }

  // TRANSCRIPT SELF-TEST (no mic, no call, no quota): runs the real chain on
  // 3s of synthetic voiced tones - recorder support, WAV decode through
  // blobToPcm16k, the rms gate, the local model load (fetches ~40MB once) and
  // one inference - and says where it breaks. Tones are not speech, so an
  // EMPTY/FILTERED inference still proves the engine runs; real speech is the
  // true test. Nothing files (no chatHistory, no archive) - the report prints.
  function wavBlob16k(pcm) {
    var n = pcm.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var dv = new DataView(buf);
    function wstr(o, s) { for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
    wstr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wstr(8, "WAVE"); wstr(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    wstr(36, "data"); dv.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var v = Math.max(-1, Math.min(1, pcm[i])); dv.setInt16(44 + i * 2, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true); }
    return new Blob([buf], { type: "audio/wav" });
  }
  function synthVoiced(sec) {
    var sr = 16000, n = Math.floor(sr * (sec || 3)), out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var t = i / sr;
      var f0 = 130 + 40 * Math.sin(2 * Math.PI * 0.9 * t);
      var syl = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 2.2 * t)), 2);
      var vv = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.25 * Math.sin(2 * Math.PI * 3 * f0 * t);
      out[i] = 0.35 * syl * vv;
    }
    return out;
  }
  async function transcriptTest() {
    var lines = [];
    var mime = "";
    try {
      if (typeof MediaRecorder !== "undefined") {
        var cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
        for (var i = 0; i < cands.length; i++) { try { if (MediaRecorder.isTypeSupported(cands[i])) { mime = cands[i]; break; } } catch (e) {} }
      }
    } catch (e) {}
    lines.push("RECORDER: " + (mime ? ("OK (" + mime + ")") : "NO SUPPORTED MIME - THIS BROWSER CANNOT RECORD"));
    var pcm = synthVoiced(3);
    var blob = wavBlob16k(pcm);
    lines.push("TONE: 3S VOICED 16K WAV " + (blob.size || 0) + " BYTES");
    var dec = null;
    try { dec = await blobToPcm16k(blob); lines.push("DECODE: OK " + (dec ? dec.length : 0) + " SAMPLES"); }
    catch (e) { lines.push("DECODE: FAIL (" + String((e && e.message) || e).toUpperCase().slice(0, 100) + ")"); }
    if (dec && dec.length) {
      var sum = 0;
      for (var k = 0; k < dec.length; k += 4) { var v2 = dec[k]; sum += v2 * v2; }
      var rms = Math.sqrt(sum / Math.max(1, Math.ceil(dec.length / 4)));
      lines.push("RMS: " + rms.toFixed(3) + (rms < 0.01 ? " (BELOW THE 0.01 GATE - REAL SPEECH MUST READ HIGHER)" : " (PASSES THE 0.01 GATE)"));
    }
    try { print("GUESTCOMM :: TRANSCRIPT TEST - LOADING THE LOCAL MODEL ONCE (~40MB) IF NEEDED ..."); } catch (e) {}
    try {
      var pipe = await withTimeout(ensurePipe(), 300000, "MODEL LOAD");
      lines.push("MODEL: LOADED (" + (trPipeModel || "?") + ")");
      if (!dec || !dec.length) { lines.push("INFERENCE: SKIPPED (NO AUDIO DECODED)"); }
      else {
        var t0 = Date.now();
        try {
          var out = await withTimeout(pipe(dec, { chunk_length_s: 30, stride_length_s: 5 }), 120000, "TRANSCRIPT");
          var raw = String((out && out.text) == null ? "" : out.text);
          var cl = cleanLocalText(raw);
          lines.push("INFERENCE: " + (Math.round((Date.now() - t0) / 100) / 10) + "S RAW \"" + raw.slice(0, 60) + "\"" + (cl ? (" FILES-AS \"" + cl.slice(0, 60) + "\"") : " (TONES ARE NOT SPEECH - EMPTY/FILTERED STILL PROVES THE ENGINE RUNS)"));
        } catch (e2) { lines.push("INFERENCE: FAIL (" + String((e2 && e2.message) || e2).toUpperCase().slice(0, 100) + ")"); }
      }
    } catch (e) { lines.push("MODEL: FAIL (" + String((e && e.message) || e).toUpperCase().slice(0, 100) + ") - /guest transcript retry RETRIES"); }
    lines.push("LIVE: " + diagShort() + " - TR " + st.trHer + "HER/" + st.trHis + "HIM" + (st.trDead ? (" DEAD " + (st.trErr || "")) : ""));
    var report = "GUESTCOMM :: TRANSCRIPT TEST (SYNTHETIC TONES, NOTHING FILED)\n  " + lines.join("\n  ");
    try { print(report); } catch (e) {}
    return report;
  }

  function tricomBusy() {
    try {
      if (window.tricom && window.tricom.seats) {
        var s = window.tricom.seats();
        if (s && (s.live || s.checkin)) return "STAND DOWN THE FLOOR FIRST - THE PRIVATE LINE IS OFF THE AIR.";
        if (s && s.tbOn) return "TALKBACK HOLDS HER EARS - TAKE IT OFF FIRST, THEN CALL THE PRIVATE LINE.";
        if (s && s.gcOn) return "GUESTCOMM HOLDS THE LINE - TAKE IT OFF FIRST.";
      }
    } catch (e) {}
    // ONE HOLDER OF HER EARS: the iPhone road and the bridge ears hear the
    // room, so either open while the line is up would hand the call to
    // Barbelo. They refuse while the line is up - and the line refuses while
    // they hold her.
    try {
      if (window.livecomm && typeof window.livecomm.armed === "function" && window.livecomm.armed()) return "THE iPHONE CALL HOLDS HER - HANG IT UP FIRST, THEN CALL THE PRIVATE LINE.";
    } catch (e) {}
    try {
      if (window.duet && typeof window.duet.earsOpen === "function" && window.duet.earsOpen()) return "THE BRIDGE EARS ARE OPEN AND WOULD HEAR THE CALL - SHUT THEM FIRST, THEN CALL THE PRIVATE LINE.";
    } catch (e) {}
    return "";
  }

  async function call() {
    if (st.up) return true;
    var busy = tricomBusy();
    if (busy) { print("GUESTCOMM :: " + busy); return false; }
    if (!st.herSrc) { print("GUESTCOMM :: PICK HER ROAD FIRST - THE iRIG LINE IN HER DROPDOWN, THEN CALL."); return false; }
    var nm0 = guestName();
    if (!nm0) { show(); print("GUESTCOMM :: ENTER HER NAME FIRST - THE GUEST ROW, THEN CALL. HER WORDS ARE FILED UNDER IT."); return false; }
    var c = actx();
    if (!c) { print("GUESTCOMM :: NO AUDIO ON THIS MACHINE."); return false; }
    var her = null, mic = null;
    try {
      her = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: st.herSrc }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (e) {
      print("GUESTCOMM :: HER ROAD WOULD NOT OPEN (" + String((e && e.name) || e).toUpperCase() + ").");
      return false;
    }
    // HIS MIC: the USB line by default, the system default when the
    // headset is unplugged (said out loud, so the fallback never hides).
    var micWant = effMic();
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: micWant
          ? { deviceId: { exact: micWant }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (e) {
      if (!micWant) {
        try { her.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} }); } catch (x) {}
        print("GUESTCOMM :: YOUR MIC WOULD NOT OPEN (" + String((e && e.name) || e).toUpperCase() + ").");
        return false;
      }
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        micWant = "";
      } catch (e2) {
        try { her.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} }); } catch (x) {}
        print("GUESTCOMM :: YOUR MIC WOULD NOT OPEN (" + String((e2 && e2.name) || e2).toUpperCase() + ").");
        return false;
      }
    }
    try {
      st.herStream = her;
      st.herDev = st.herSrc;
      st.micStream = mic;
      st.micDev = micWant || "default";
      try {
        var mt = mic.getAudioTracks()[0];
        st.micLive = (mt && mt.label) ? String(mt.label) : "";
      } catch (e) { st.micLive = ""; }
      st.herSrcN = c.createMediaStreamSource(her);
      st.herGain = c.createGain();
      st.herGain.gain.value = st.herMute ? 0 : 1;
      st.herAn = c.createAnalyser();
      st.herAn.fftSize = 512;
      st.herBuf = new Uint8Array(512);
      var mon = c.createMediaStreamDestination();
      st.herSrcN.connect(st.herGain);
      st.herGain.connect(mon);
      // PRE-MUTE tap: her meter proves her signal lands even while muted.
      st.herSrcN.connect(st.herAn);
      st.micSrcN = c.createMediaStreamSource(mic);
      st.micGain = c.createGain();
      st.micGain.gain.value = st.micMute ? 0 : 1;
      st.micAn = c.createAnalyser();
      st.micAn.fftSize = 512;
      st.micBuf = new Uint8Array(512);
      var feed = c.createMediaStreamDestination();
      st.micSrcN.connect(st.micGain);
      st.micGain.connect(feed);
      // PRE-MUTE tap: your mic meter proves your signal lands even while muted.
      st.micSrcN.connect(st.micAn);
      var ear = el("gcEar");
      if (ear) { try { ear.srcObject = mon.stream; } catch (e) {} safePlay(ear); applyEarSink(); }
      var fe = el("gcFeed");
      if (fe) { try { fe.srcObject = feed.stream; } catch (e) {} safePlay(fe); applySink(); }
    } catch (e) {
      dropStreams();
      print("GUESTCOMM :: THE LINE WOULD NOT OPEN ON THIS MACHINE.");
      return false;
    }
    ensureHold();
    hush();
    // PRIVATE MEANS SILENT: anything already sounding (the audition bus, a
    // clip mid-play) stops now - the only voices from here are hers live in
    // his headphones and his live on her ears. The bus keeps its loaded
    // piece, paused, for after hangup.
    try { if (window.audition && typeof window.audition.pause === "function") window.audition.pause(); } catch (e) {}
    // GUESTMODE: radio silence, text only. The voice lane already refuses the
    // mic, the key, the live channel and the wire in radio mode - forcing it
    // here is what makes TALK go nowhere while she is on the line, ARMED OR
    // NOT. Her words are untouched: she may comment in the chat, she just
    // cannot speak aloud until hangup gives the mode back.
    st.chanBefore = "";
    try {
      var vx = (window.voice && typeof window.voice.mode === "function" && typeof window.voice.setMode === "function") ? window.voice : null;
      if (vx) {
        st.chanBefore = String(vx.mode() || "");
        if (st.chanBefore !== "radio") vx.setMode("radio");
      }
    } catch (e) {}
    st.up = true;
    // No hearing yourself: his mic rides the feed element only, and that
    // element plays the guest output only. If the route refused, say so loud
    // instead of letting his own voice sing back at him.
    st.sinkWarned = false;
    await applySink();
    await applyEarSink();
    // One beat for slow routes to land before judging them - the lamp above
    // re-checks on its own either way.
    if (!st.sinkOk) { try { await new Promise(function (r) { setTimeout(r, 600); }); } catch (e) {} }
    if (!st.outId) {
      st.sinkWarned = true;
      print("GUESTCOMM :: GUEST OUT IS THE DEFAULT OUTPUT - IF THAT IS YOUR HEADPHONES YOU WILL HEAR YOURSELF. PICK THE iRIG LINE.");
    } else if (!st.sinkOk) {
      st.sinkWarned = true;
      print("GUESTCOMM :: THE GUEST OUTPUT WOULD NOT TAKE - YOUR MIC MAY BE IN YOUR OWN EARS. PICK ANOTHER LINE, THEN CALL AGAIN.");
    }
    if (!micWant) print("GUESTCOMM :: USB HEADSET UNPLUGGED - YOUR MIC THIS CALL IS THE SYSTEM DEFAULT (" + micLabel() + ").");
    if (effEar() && !st.earOk) print("GUESTCOMM :: YOUR EARS WOULD NOT TAKE THE USB HEADPHONES - SHE MAY COME FROM ANOTHER SPEAKER.");
    // Both transcripts ride their own roads, not the floor: his mic never
    // becomes a turn while the line is up, both voices file under their own
    // names - STT only, in this browser, no key, no TTS. The CONTEXT choice in
    // force at CALL holds the whole call: ON arms both filings into the
    // context window Barbelo reads; OFF leaves them visible + archived, dark
    // to her.
    st.trDead = false;
    st.trErr = "";
    st.trFails = 0;
    st.trHer = 0;
    st.trHis = 0;
    st.ctxArmed = !!st.trCtx;
    var nm = guestLabel();
    if (st.trScript) {
      print("GUESTCOMM :: TRANSCRIPT STARTING - LOCAL STT, NO KEY (FIRST RUN FETCHES THE MODEL ONCE) - BOTH VOICES, 5S CHUNKS.");
      // The model fetch rides BESIDE the open line, not under it: chunks queue
      // while it loads, and the panel shows LOADING instead of looking dead.
      if (!st.trPipe) print("GUESTCOMM :: FETCHING THE LOCAL TRANSCRIPT MODEL ONCE (~40MB) - THE LINE IS UP WHILE IT LOADS, NOTHING IS SENT ANYWHERE.");
      try { ensurePipe().then(function () { try { paint(); } catch (e) {} }, function () { try { paint(); } catch (e) {} }); } catch (e) {}
      if (trStart(c)) print("GUESTCOMM :: TRANSCRIPT ON - " + nm + " FILES UNDER " + nm + ", YOU UNDER HITL" + (st.ctxArmed ? ", BOTH RIDE THE CONTEXT WINDOW." : ", VISIBLE ONLY - BARBELO DARK TO THIS CALL."));
      else print("GUESTCOMM :: TRANSCRIPT ARMED BUT THIS BROWSER WOULD NOT RECORD - /guest say <WORDS> STILL FILES HER WORDS BY HAND.");
    } else {
      print("GUESTCOMM :: TRANSCRIPT OFF - /guest say <WORDS> STILL FILES HER WORDS BY HAND.");
    }
    // THE CLOCK: 30 minutes from CALL, on the panel, counting down.
    st.callAt = Date.now();
    startClock();
    paint();
    print("GUESTCOMM :: LINE UP - PRIVATE, YOU AND " + nm + " - 30:00 ON THE CLOCK. BARBELO ANSWERS IN TEXT ONLY WHILE IT IS UP.");
    return true;
  }

  function dropStreams() {
    var ss = [st.herStream, st.micStream];
    st.herStream = null;
    st.micStream = null;
    st.herDev = null;
    st.micDev = null;
    st.micLive = "";
    ss.forEach(function (s) {
      if (s) { try { s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {} }
    });
    try { if (st.herSrcN) st.herSrcN.disconnect(); } catch (e) {}
    try { if (st.micSrcN) st.micSrcN.disconnect(); } catch (e) {}
    st.herSrcN = null;
    st.micSrcN = null;
    st.herGain = null;
    st.micGain = null;
    st.herAn = null;
    st.micAn = null;
    var e1 = el("gcEar");
    if (e1) { try { e1.pause(); } catch (e) {} try { e1.srcObject = null; } catch (e) {} }
    var e2 = el("gcFeed");
    if (e2) { try { e2.pause(); } catch (e) {} try { e2.srcObject = null; } catch (e) {} }
  }

  // THE CLOCK: 30 minutes from CALL, counting down on the panel. At zero the
  // line drops itself; at 1:00 remaining the clock flashes red, subtle.
  function clockRemain() {
    if (!st.up || !st.callAt) return null;
    return Math.max(0, st.CALL_LEN - (Date.now() - st.callAt));
  }

  function clockText(ms) {
    ms = Math.max(0, Math.round(ms / 1000) * 1000);
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function tickClock() {
    if (!st.up) { stopClock(); paint(); return; }
    var left = clockRemain();
    if (left === null) return;
    if (left <= 0) {
      print("GUESTCOMM :: 30 MINUTES - THE LINE DROPS ITSELF. CALL AGAIN TO REOPEN.");
      hangup();
      return;
    }
    paint();
  }

  function startClock() {
    stopClock();
    try { st.callTimer = setInterval(tickClock, 1000); } catch (e) { st.callTimer = 0; }
  }

  function stopClock() {
    try { if (st.callTimer) clearInterval(st.callTimer); } catch (e) {}
    st.callTimer = 0;
  }

  function hangup() {
    if (!st.up) return false;
    st.up = false;
    st.ctxArmed = false;
    // The recorders' last chunks flush through the pump after the stop -
    // both sides' last words still file. The mode goes back only if it is
    // still the one this call forced: a hand that moved it mid-call owns it.
    trTapStop();
    dropStreams();
    stopClock();
    st.callAt = 0;
    var back = st.chanBefore || "";
    st.chanBefore = "";
    try {
      var vx = (window.voice && typeof window.voice.mode === "function" && typeof window.voice.setMode === "function") ? window.voice : null;
      if (vx && back && back !== "radio" && vx.mode() === "radio") {
        vx.setMode(back);
        print("GUESTCOMM :: VOICE MODE BACK TO " + back.toUpperCase() + ".");
      }
    } catch (e) {}
    paint();
    print("GUESTCOMM :: LINE DOWN - DARK.");
    return false;
  }

  function toggleMute() {
    st.herMute = !st.herMute;
    setGain(st.herGain, (st.up && !st.herMute) ? 1 : 0);
    paint();
    print(st.herMute ? "GUESTCOMM :: SHE IS MUTED IN YOUR EARS - HER METER STILL SHOWS HER SIGNAL." : "GUESTCOMM :: SHE IS BACK IN YOUR EARS.");
  }

  function toggleMicMute() {
    st.micMute = !st.micMute;
    setGain(st.micGain, (st.up && !st.micMute) ? 1 : 0);
    paint();
    print(st.micMute ? "GUESTCOMM :: YOUR MIC IS MUTED - SHE CANNOT HEAR YOU, YOUR METER STILL SHOWS YOUR SIGNAL." : "GUESTCOMM :: YOUR MIC IS LIVE TO HER AGAIN.");
  }

  // THE OUT ROAD, HONESTLY: the feed element plays to another device, so its
  // level cannot be metered - but whether the road is open can. ON means the
  // line is up, your mic is unmuted, the element is playing, and the guest
  // output took the route. Anything else names the reason.
  function outRoad() {
    if (!st.up) return { mode: "", note: "IDLE" };
    var fe = el("gcFeed");
    var playing = false;
    try { playing = !!(fe && fe.srcObject && !fe.paused); } catch (e) { playing = false; }
    if (!playing) return { mode: "bad", note: "NOT PLAYING" };
    if (!st.sinkOk) return { mode: "bad", note: "NO ROUTE" };
    if (st.micMute) return { mode: "warn", note: "HELD - YOU MUTED" };
    return { mode: "on", note: "TO HER" };
  }

  function levels() {
    return {
      her: rmsOf(st.herAn, st.herBuf),
      mic: rmsOf(st.micAn, st.micBuf)
    };
  }

  // THE ON AIR LIGHT, LAZILY BUILT. A fixed banner on document.body - outside
  // every panel, deck and modal - so it reads wherever he is looking. Hidden
  // wins over everything while the line is down.
  var onAirBox = null, onAirWho = null;
  function ensureOnAir() {
    if (onAirBox && onAirBox.isConnected) return { box: onAirBox, who: onAirWho };
    try {
      onAirBox = document.getElementById("onAirLight");
      onAirWho = onAirBox ? onAirBox.querySelector("#onAirWho") : null;
      if (!onAirBox) {
        onAirBox = document.createElement("div");
        onAirBox.id = "onAirLight";
        onAirBox.hidden = true;
        var dot = document.createElement("span");
        dot.className = "auDot";
        onAirBox.appendChild(dot);
        onAirWho = document.createElement("span");
        onAirWho.id = "onAirWho";
        onAirWho.textContent = "ON AIR";
        onAirBox.appendChild(onAirWho);
        document.body.appendChild(onAirBox);
      }
      if (!onAirWho) { try { onAirWho = onAirBox.querySelector("#onAirWho"); } catch (e) {} }
    } catch (e) { return null; }
    return { box: onAirBox, who: onAirWho };
  }

  function paint() {
    var lamp = el("gcLamp");
    if (lamp) {
      var t = st.up ? "ON THE LINE" : "DARK";
      if (lamp.textContent !== t) lamp.textContent = t;
      lamp.className = "lcLamp " + (st.up ? "her" : "standby");
    }
    // THE ON AIR LIGHT: a fixed banner outside every panel, lit the whole time
    // the private line is up - visible with the panel closed, the stage
    // centered, or a modal open. Created lazily so this module never depends
    // on markup. The 1s clock tick repaints while up, so it tracks the call.
    try {
      var oa = ensureOnAir();
      if (oa && oa.box) {
        oa.box.hidden = !st.up;
        if (st.up && oa.who) {
          var ot = "ON AIR - " + guestLabel() + " - " + clockText(clockRemain() || 0);
          if (oa.who.textContent !== ot) oa.who.textContent = ot;
        }
        try { document.body.classList.toggle("gconair", st.up); } catch (e2) {}
      }
    } catch (e) {}
    var bar = function (id, v) {
      var e = el(id);
      if (e) e.style.width = Math.max(0, Math.min(100, Math.round(v * 400))) + "%";
    };
    var lv = levels();
    bar("gcHerFill", lv.her);
    bar("gcMicFill", lv.mic);
    var b = el("gcHerMute");
    if (b) { var mt = st.herMute ? "UNMUTE" : "MUTE"; if (b.textContent !== mt) b.textContent = mt; }
    var mm = el("gcMicMute");
    if (mm) {
      var on = !st.micMute;
      var glyph = on ? "\uD83C\uDFA4" : "\uD83D\uDD07";
      if (mm.textContent !== glyph) mm.textContent = glyph;
      try { mm.classList.toggle("muted", st.micMute); } catch (e) {}
      var mt2 = st.micMute ? "your mic is MUTED - she cannot hear you. Press to go live to her again" : "mute your mic - she will not hear you, but your meter still shows your signal";
      try { if (mm.title !== mt2) mm.title = mt2; } catch (e) {}
    }
    // MIC lit means voice is landing on your mic; OUT lit means it is playing
    // out to her ears. Two separate answers on purpose.
    var ml = el("gcMicLamp");
    if (ml) {
      var micHot = st.up && lv.mic > 0.03;
      var mc = "gcDot" + (micHot ? " on" : "");
      if (ml.className !== mc) ml.className = mc;
      var mtl = !st.up ? "the line is down - your mic is going nowhere"
        : (micHot ? "your mic hears you - she hears this while the OUT lamp is lit"
        : (st.micMute ? "your mic is muted - your meter still moves, but nothing goes to her" : "your mic is open but hears nothing yet - speak and this lights"));
      try { if (ml.title !== mtl) ml.title = mtl; } catch (e) {}
    }
    var or = outRoad();
    var ol = el("gcOutLamp");
    if (ol) {
      var oc = "gcDot" + (or.mode ? " " + or.mode : "");
      if (ol.className !== oc) ol.className = oc;
      var otl = !st.up ? "the line is down - nothing is playing out"
        : (or.mode === "on" ? "your mic is playing out to her ears right now - OUT " + outLabel()
        : (or.mode === "warn" ? "held - your mic is muted, so nothing goes to her" : "the guest output would not take - your mic may not be reaching her"));
      try { if (ol.title !== otl) ol.title = otl; } catch (e) {}
    }
    var on2 = el("gcOutNote");
    if (on2 && on2.textContent !== or.note) on2.textContent = or.note;
    var mn = el("gcMicName");
    if (mn) { var mnt = micLabel(); if (mn.textContent !== mnt) mn.textContent = mnt; }
    var en = el("gcEarName");
    if (en) { var ent = earLabel(); if (en.textContent !== ent) en.textContent = ent; }
    var gi = el("gcName");
    if (gi && document.activeElement !== gi) { var gnt = guestName(); if (gi.value !== gnt) gi.value = gnt; }
    var st1 = el("gcScriptTgl");
    if (st1) {
      var s1t = "TRANSCRIPT: " + (st.trScript ? "ON" : "OFF");
      if (st1.textContent !== s1t) st1.textContent = s1t;
      try { st1.classList.toggle("muted", !st.trScript); } catch (e) {}
    }
    var st2 = el("gcCtxTgl");
    if (st2) {
      var s2t = "CONTEXT: " + (st.trCtx ? "ON" : "OFF");
      if (st2.textContent !== s2t) st2.textContent = s2t;
      try { st2.classList.toggle("muted", !st.trCtx); } catch (e) {}
      try { st2.title = st.trCtx ? "both transcripts ride the context window Barbelo reads - the choice in force at CALL holds the call" : "both transcripts stay visible + archived, dark to Barbelo - the choice in force at CALL holds the call"; } catch (e) {}
    }
    // THE CLOCK on the panel: 30:00 down, 1:00 REMAINING flashing red.
    var tm = el("gcTimer");
    if (tm) {
      var left = clockRemain();
      if (left === null) {
        if (tm.textContent !== "--:--") tm.textContent = "--:--";
        try { tm.classList.remove("gcTimerLow"); } catch (e) {}
      } else {
        var low = left <= 65000;
        var txt = low ? (clockText(left) + " REMAINING") : clockText(left);
        if (tm.textContent !== txt) tm.textContent = txt;
        try { tm.classList.toggle("gcTimerLow", low); } catch (e) {}
      }
    }
    var fs = el("gcState");
    if (fs) {
      // THE TRANSCRIPT COUNT rides the LINE row: HER/HIM lines filed this
      // call, LOADING while the model fetches, OFF + the reason if it died.
      var trBit = st.trScript
        ? ("TR " + st.trHer + "HER/" + st.trHis + "HIM" + (st.trLoading ? " LOADING" : (st.trDead ? (" OFF" + (st.trErr ? " " + st.trErr.slice(0, 40) : "")) : "")))
        : "TR OFF";
      try { trBit += " " + diagShort(); } catch (e) {}
      var s = st.up
        ? ("ON THE LINE - " + guestLabel() + " - HER " + lv.her.toFixed(2) + " / MIC " + lv.mic.toFixed(2) + " - OUT " + outLabel() + " - " + trBit + (st.herMute ? " - SHE MUTED" : "") + (st.micMute ? " - YOU MUTED" : ""))
        : "DARK";
      if (fs.textContent !== s) fs.textContent = s;
    }
  }

  function paintLoop() {
    if (!isOpen()) { st.paintTimer = 0; return; }
    try { paint(); } catch (e) {}
    st.paintTimer = setTimeout(paintLoop, 250);
  }

  function isOpen() { var p = el("guestPanel"); return !!(p && !p.hidden); }

  function closeOthers() {
    try { if (window.liacomm && window.liacomm.isOpen && window.liacomm.isOpen()) window.liacomm.close(); } catch (e) {}
    try { if (window.duet && window.duet.isOpen && window.duet.isOpen()) window.duet.close(); } catch (e) {}
    try { if (window.tricom && window.tricom.isOpen && window.tricom.isOpen()) window.tricom.close(); } catch (e) {}
  }

  var homeParent = null, homeNext = null;
  function setCenter(on) {
    on = !!on;
    var p = el("guestPanel"), row = el("stageRow"), out = el("output");
    if (on) {
      if (p && row) {
        if (!homeParent) { homeParent = p.parentNode; homeNext = p.nextSibling; }
        try { row.insertBefore(p, el("rightPanel") || null); } catch (e) {}
      }
      if (out) out.hidden = true;
    } else {
      if (p && homeParent) {
        try { homeParent.insertBefore(p, homeNext); } catch (e) {}
        homeParent = null; homeNext = null;
      }
      if (out) out.hidden = false;
    }
    try { document.body.classList.toggle("guestCenter", on); } catch (e) {}
    return on;
  }

  function show() {
    var p = el("guestPanel");
    if (!p) return false;
    closeOthers();
    setCenter(true);
    p.hidden = false;
    wire();
    var my = rev;
    loadP = savedGet();
    loadP.then(function () { if (my === rev) refresh(); else paint(); });
    if (!st.paintTimer) paintLoop();
    paint();
    return true;
  }

  function close() {
    setCenter(false);
    var p = el("guestPanel");
    if (p) p.hidden = true;
  }

  function toggle() {
    if (isOpen()) { close(); return false; }
    return show();
  }

  var wired = false;
  function wire() {
    if (wired) return true;
    wired = true;
    var on = function (id, fn) {
      var b = el(id);
      if (b && !b.__gc) { b.__gc = true; b.addEventListener("click", fn); }
    };
    var ch = function (id, fn) {
      var s = el(id);
      if (s && !s.__gc) { s.__gc = true; s.addEventListener("change", fn); }
    };
    on("gcCall", function () { ready().then(function () { call(); }); });
    on("gcHang", function () { hangup(); });
    on("gcClose", function () { close(); });
    on("gcRefresh", function () { ready().then(function () { refresh(); }); });
    on("gcHerMute", function () { toggleMute(); });
    on("gcMicMute", function () { toggleMicMute(); });
    on("gcScriptTgl", function () {
      ready().then(function () {
        touch("trScript");
        st.trScript = !st.trScript;
        savedSet();
        paint();
        print(st.trScript ? "GUESTCOMM :: TRANSCRIPT ON - HER WORDS FILE UNDER " + guestLabel() + " FROM HERE." : "GUESTCOMM :: TRANSCRIPT OFF - /guest say <WORDS> STILL FILES HER WORDS BY HAND.");
      });
    });
    on("gcCtxTgl", function () {
      // Startup configuration: the choice in force at CALL holds the call.
      ready().then(function () {
        touch("trCtx");
        st.trCtx = !st.trCtx;
        savedSet();
        paint();
        print(st.trCtx ? "GUESTCOMM :: CONTEXT ON - NEXT CALL BOTH TRANSCRIPTS RIDE THE WINDOW BARBELO READS." : "GUESTCOMM :: CONTEXT OFF - NEXT CALL BOTH TRANSCRIPTS STAY VISIBLE + ARCHIVED, DARK TO BARBELO.");
      });
    });
    var nm = el("gcName");
    if (nm && !nm.__gc) {
      nm.__gc = true;
      nm.addEventListener("change", function () {
        ready().then(function () {
          touch("guestName");
          st.guestName = String(nm.value || "").replace(/\s+/g, " ").trim().slice(0, 24);
          try { nm.value = st.guestName; } catch (e) {}
          savedSet();
          paint();
        });
      });
    }
    ch("gcHerSrc", function () {
      var s = el("gcHerSrc");
      ready().then(function () {
        touch("herSrc");
        st.herSrc = s ? String(s.value || "") : "";
        savedSet();
        if (st.up) { hangup(); print("GUESTCOMM :: HER ROAD CHANGED - CALL AGAIN."); }
      });
    });
    ch("gcOut", function () {
      var s = el("gcOut");
      ready().then(function () {
        touch("outId"); touch("outPin");
        st.outId = s ? String(s.value || "") : "";
        // Picking DEFAULT by hand pins it - the iRig follow above leaves it alone.
        st.outPin = !st.outId;
        savedSet();
        applySink();
        if (st.up) print("GUESTCOMM :: YOUR MIC NOW FEEDS " + (outLabel() || "DEFAULT") + " - IF THAT IS YOUR HEADPHONES YOU WILL HEAR YOURSELF.");
        paint();
      });
    });
    return true;
  }

  async function words(arg) {
    var raw = String(arg || "").trim();
    var t = raw.toLowerCase();
    if (!t || t === "open") { show(); return "GUESTCOMM :: THE PRIVATE PAGE IS OPEN."; }
    if (t === "close") { close(); return "GUESTCOMM :: CLOSED."; }
    if (t === "call") { show(); await ready(); var ok = await call(); return ok ? "GUESTCOMM :: LINE UP - PRIVATE." : "GUESTCOMM :: WOULD NOT CALL - SEE ABOVE."; }
    if (t === "hangup" || t === "hang" || t === "down") { hangup(); return "GUESTCOMM :: LINE DOWN."; }
    if (t === "mute" || t === "unmute") { show(); toggleMute(); return "GUESTCOMM :: " + (st.herMute ? "SHE MUTED." : "SHE BACK."); }
    if (t === "micmute" || t === "mymute" || t === "mic mute") { show(); toggleMicMute(); return "GUESTCOMM :: " + (st.micMute ? "YOUR MIC MUTED - SHE CANNOT HEAR YOU." : "YOUR MIC LIVE TO HER."); }
    if (t.indexOf("name ") === 0 || t.indexOf("guest ") === 0) {
      show();
      await ready();
      var nn = raw.replace(/^(name|guest)\s+/i, "").replace(/\s+/g, " ").trim().slice(0, 24);
      if (!nn) return "GUESTCOMM :: NAME HER FIRST - /guest name MAYA.";
      touch("guestName");
      st.guestName = nn;
      savedSet();
      paint();
      return "GUESTCOMM :: GUEST IS " + guestLabel() + " - HER WORDS FILE UNDER IT.";
    }
    if (t.indexOf("sayme ") === 0 || t.indexOf("saymy ") === 0 || t.indexOf("say my ") === 0) {
      var sm = raw.replace(/^say\s*(my\s+|me\s+)/i, "").trim();
      if (!sm) return "GUESTCOMM :: SAY WHAT - /guest sayme <YOUR WORDS>.";
      var done2 = await fileLineHis(sm);
      return done2 ? "GUESTCOMM :: FILED UNDER HITL." : "GUESTCOMM :: NOTHING TO FILE.";
    }
    if (t.indexOf("say ") === 0) {
      var sw = raw.replace(/^say\s+/i, "").trim();
      if (!sw) return "GUESTCOMM :: SAY WHAT - /guest say <HER WORDS>.";
      var done = await fileLine(sw);
      return done ? "GUESTCOMM :: FILED UNDER " + guestLabel() + "." : "GUESTCOMM :: NOTHING TO FILE.";
    }
    if (t === "transcript on" || t === "script on") { show(); await ready(); if (!st.trScript) { touch("trScript"); st.trScript = true; savedSet(); paint(); } return "GUESTCOMM :: TRANSCRIPT ON."; }
    if (t === "transcript off" || t === "script off") { show(); await ready(); if (st.trScript) { touch("trScript"); st.trScript = false; savedSet(); paint(); } return "GUESTCOMM :: TRANSCRIPT OFF - HAND-FILING STILL WORKS."; }
    if (t === "transcript test" || t === "script test" || t === "tr test") { show(); await ready(); return await transcriptTest(); }
    // A dead transcript re-arms without dropping the line: the next 5s chunk
    // re-tries the local model, and whatever queues still holds flushes.
    if (t === "transcript retry" || t === "script retry" || t === "tr retry") {
      show(); await ready();
      st.trDead = false; st.trErr = "";
      savedSet(); paint();
      print("GUESTCOMM :: TRANSCRIPT RETRY - THE NEXT 5S CHUNK RE-TRIES THE LOCAL MODEL. HAND-FILING STILL WORKS EITHER WAY.");
      try { ensurePipe().then(function () { try { paint(); } catch (e) {} }, function () { try { paint(); } catch (e) {} }); } catch (e) {}
      try { trPump(); } catch (e) {}
      return "GUESTCOMM :: RETRYING THE TRANSCRIPT.";
    }
    if (t === "context on" || t === "ctx on") { show(); await ready(); if (!st.trCtx) { touch("trCtx"); st.trCtx = true; savedSet(); paint(); } return "GUESTCOMM :: CONTEXT ON - NEXT CALL BOTH TRANSCRIPTS RIDE THE WINDOW BARBELO READS."; }
    if (t === "context off" || t === "ctx off") { show(); await ready(); if (st.trCtx) { touch("trCtx"); st.trCtx = false; savedSet(); paint(); } return "GUESTCOMM :: CONTEXT OFF - NEXT CALL STAYS VISIBLE + ARCHIVED, DARK TO BARBELO."; }
    if (t === "status") {
      var lv = levels();
      var or = outRoad();
      var left = clockRemain();
      var trSt = "TR " + st.trHer + "HER/" + st.trHis + "HIM" + (st.trLoading ? " LOADING" : "") + (st.trDead ? " DEAD" + (st.trErr ? " (" + st.trErr + ")" : "") : "") + " - " + diagShort();
      return "GUESTCOMM :: " + (isOpen() ? "OPEN" : "CLOSED")
        + " - " + (st.up ? ("ON THE LINE WITH " + guestLabel() + " - HER " + lv.her.toFixed(2) + " / MIC " + lv.mic.toFixed(2) + " - CLOCK " + clockText(left)) : "DARK")
        + " - HER " + herLabel() + (st.herMute ? " MUTED" : "")
        + " - MIC " + micLabel() + (st.micMute ? " MUTED" : " LIVE")
        + " - EARS " + earLabel()
        + " - OUT " + outLabel() + " " + or.note
        + " - " + trSt
        + " - TRANSCRIPT " + (st.trScript ? "ON (LOCAL, NO KEY, BOTH VOICES)" : "OFF") + " - CONTEXT " + (st.trCtx ? "ON" : "OFF") + (st.up ? (st.ctxArmed ? " (ARMED THIS CALL)" : " (DARK THIS CALL)") : " (APPLIES AT CALL)") + ".";
    }
    return "GUESTCOMM :: /guest open|call|hangup|mute|micmute|name <HER NAME>|say <HER WORDS>|sayme <YOUR WORDS>|transcript on|off|retry|test|context on|off|close|status - THE PRIVATE LINE + 30:00 CLOCK.";
  }

  function describe() {
    return ["GUESTCOMM :: the private line - you and her, a phone call, audio only. GUESTMODE while it is up: radio silence, text only.",
      "  GUEST names her (required before CALL, kept) - her words file under it: MAYA:, not HITL:. HER ROAD picks the input her signal rides in on (the iRIG line - sticky: it follows the label home when hardware is replugged). Her meter proves her signal lands, mute or no mute.",
      "  GUEST OUT picks where your mic goes (her ears' line - sticky the same way).",
      "  CALL opens both roads and forces RADIO SILENCE: her signal in your headphones, your mic on her ears, TALK and the key and the live channel all refuse while she is on the line, ARMED OR NOT - your mic never becomes a turn. HANG UP drops both and gives the voice mode back. Changing her road mid-call hangs up first.",
      "  YOUR DEFAULTS, NO FIDDLING: she rides the iRIG line in; your ears are your USB Logi headphones (her voice is pinned there, not wherever the system default points); your mic is the USB mic on those headphones, falling back to the system default only while the headset is unplugged (said out loud when it happens). All three follow their labels home when hardware is replugged.",
      "  TRANSCRIPT files both voices under their own names - MAYA: for her road, HITL: for your mic - painted in the chat, written to the archive, STT only in this browser (local Whisper, no key, no TTS, no extra audio), 5s chunks. Whether Barbelo SEES them is the startup choice: CONTEXT ON at CALL arms both filings into the context window she reads; OFF leaves them visible + archived, dark to her - in text only, like TEXTONLY, while the line is up. /guest say <WORDS> files her line by hand either way. /guest transcript test runs the whole chain on synthetic tones (no mic, nothing filed) and reports where it breaks.",
      "  Live transcript lines paint full-bright in the chat (the archive replay paints them dim, like any history); the LINE row counts them - TR nHER/mHIM, LOADING while the model fetches, OFF with the reason if it dies. A dead transcript re-arms mid-call without dropping the line: /guest transcript retry. The ON AIR light burns the whole time the line is up - her name and the clock - even with the panel closed.",
      "  THE CLOCK: 30 minutes from CALL, counting down on the panel - the line drops itself at zero. At 1:00 REMAINING the clock flashes red, subtle.",
      "  YOUR MIC row names the mic in use: the dot beside the meter lights while your mic hears you; the mic icon mutes you to her (she cannot hear you, your meter still shows your signal - same promise as her mute). GUEST OUT row: the dot lights while your mic is playing out to her ears (TO HER); HELD means you muted yourself, NO ROUTE / NOT PLAYING means the guest output would not take.",
      "  PRIVATE MEANS HITL<>MAYA ONLY: while the line is up her signal rides your headphones and your mic rides her ears and nothing else sounds anywhere - Barbelo never speaks (replies hold at the voice door, text only), the audition bus stays dark, the TRICOMM floor/talkback/guest roads refuse, the iPHONE call will not answer and its tap/downlink/uplink stay dark, the bridge ears will not open and bridge/uplink finals drop at the turn gate. The line refuses while any of those hold her (stand the floor down, take talkback off, hang the iPHONE call up, shut the bridge ears first).",
      "  BARBELO COMMENTS, NEVER SPEAKS while the line is up: type to her any time, she answers in text. The line refuses while the floor is live or the other private roads hold her - and they refuse while it is up.",
      "  /guest open|call|hangup|mute|micmute|name <HER NAME>|say <HER WORDS>|sayme <YOUR WORDS>|transcript on|off|retry|test|context on|off|close|status."].join("\n");
  }

  function isUp() { return st.up; }

  return {
    show: show, close: close, toggle: toggle,
    isOpen: function () { return isOpen(); },
    words: words, describe: describe, status: function () { return words("status"); },
    call: call, hangup: hangup, isUp: isUp, levels: levels,
    guestName: guestName, guestLabel: guestLabel, transcriptLine: fileLine, transcriptLineHis: fileLineHis
  };
})();
