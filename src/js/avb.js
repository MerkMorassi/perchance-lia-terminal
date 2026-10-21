(function () {
  /* ---- AVB ---------------------------------------------------------------------
     THE AGENTIC VOICE BRIDGE'S AUDIO SDK (the chip comes later - this is its
     eyes). One question, answered live: is there a signal, and how loud.
     Sources, in priority order: REMOTE (the bridge server's /api/level - the
     cable itself), MIC (this browser's microphone, opened only on his press),
     ROOM (the voice lane's own meter, when it runs), FEED (anything pushed
     through avb.feed - demos, tests, playback analysers). read() takes the
     first live one. indicator(boxId) paints a signal block into any panel:
     a LIVE/DARK dot, an RMS body bar with instant-peak line, worklet peak
     hold, clip LED, the VAD trigger threshold line (read live from the turn
     controller, so gating can be debugged by eye), and a LUFS* readout
     against the EBU R128 targets (-23 LUFS integrated, -1 dBTP max).
     METERING: the mic path runs a native AudioWorklet (src/js/avb-worklet.js)
     on its own audio thread - every sample is inspected, peak / peak-hold /
     RMS / clip are computed in the worklet and posted ~30 times per second.
     No external SDK. If the worklet will not load, the old AnalyserNode poll
     stands in (RMS only, LUFS shown as --). WINDOWS ROUTING: METER MIC prefers
     an input named CABLE Output (VB-Audio Virtual Cable: system/stream audio
     goes to CABLE Input, this page captures CABLE Output as a microphone
     through getUserMedia) and falls back to the default input. Nothing opens
     without a press; denial is shown, not logged.
     --------------------------------------------------------------------------- */

  var TICK = 120;
  var DB_FLOOR = -60;
  var LUFS_OFF = -0.691;
  var R128_I = -23, R128_TP = -1;
  var CLIP_LATCH_MS = 1500;

  var fedLevel = 0, fedFrom = "none", fedAt = 0;
  var remote = null;
  var mic = null;
  var mon = null;
  var aud = null;
  var rendered = [];
  var lufsBlocks = [];
  var tpMax = 0, tpOver = false;

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function db(v) {
    v = Number(v);
    if (!(v > 0)) return DB_FLOOR;
    return Math.max(DB_FLOOR, Math.round(20 * Math.log(v) / Math.LN10));
  }

  function lufsOf(meanSq) {
    meanSq = Number(meanSq);
    if (!(meanSq > 0)) return -Infinity;
    return LUFS_OFF + 10 * Math.log(meanSq) / Math.LN10;
  }

  function feed(level, from) {
    fedLevel = clamp01(level);
    fedFrom = String(from || "feed");
    fedAt = Date.now();
    return { ok: true, level: fedLevel };
  }

  function voiceRead() {
    try {
      var v = window.voice;
      if (!v || typeof v.level !== "function") return { live: false };
      var L = v.level() || {};
      if (!L.meter) return { live: false };
      return { live: true, level: clamp01(L.rms), rms: clamp01(L.rms), source: "room" };
    } catch (e) { return { live: false }; }
  }

  function vadFeed(level, from) {
    try {
      if (window.turn && typeof window.turn.vadFeed === "function") window.turn.vadFeed(level, from);
    } catch (e) {}
  }

  function vadThreshold() {
    try {
      var f = window.turn.floor();
      if (f && f.vad && isFinite(Number(f.vad.threshold))) return clamp01(Number(f.vad.threshold));
    } catch (e) {}
    return 0.02;
  }

  async function listMics() {
    var out = [];
    try {
      var md = (typeof navigator !== "undefined") ? navigator.mediaDevices : null;
      if (!md || !md.enumerateDevices) return out;
      var devs = await md.enumerateDevices();
      for (var i = 0; i < devs.length; i++) {
        if (devs[i] && devs[i].kind === "audioinput") out.push({ id: devs[i].deviceId, label: devs[i].label || ("INPUT " + (i + 1)) });
      }
    } catch (e) {}
    return out;
  }

  function pickCable(list) {
    for (var i = 0; i < list.length; i++) {
      if (/cable/i.test(list[i].label || "")) return list[i];
    }
    return null;
  }

  async function micStart(opts) {
    if (mic && (mic.node || mic.an)) return { ok: true, state: "on", engine: mic.engine, device: mic.device };
    var o = opts || {};
    var md = null;
    try { md = (typeof navigator !== "undefined") ? navigator.mediaDevices : null; } catch (e) {}
    if (!md || !md.getUserMedia) return { ok: false, state: "unavailable" };
    var wantCable = o.cable !== false && !o.deviceId;
    var stream = null, deviceLabel = "default";
    try {
      if (wantCable) {
        var list = await listMics();
        var cable = pickCable(list);
        if (cable && cable.id) {
          try {
            stream = await md.getUserMedia({ audio: { deviceId: { exact: cable.id } } });
            deviceLabel = cable.label;
          } catch (e) { stream = null; }
        }
      }
      if (!stream && o.deviceId) {
        stream = await md.getUserMedia({ audio: { deviceId: { exact: o.deviceId } } });
        deviceLabel = String(o.label || o.deviceId);
      }
      if (!stream) stream = await md.getUserMedia({ audio: true });
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
      var src = ctx.createMediaStreamSource(stream);
      mic = { ctx: ctx, stream: stream, device: deviceLabel, engine: "none",
        peak: 0, hold: 0, rms: 0, k: 0, tp: 0, clip: false, clipAt: 0, clips: 0, at: 0 };
      try {
        await ctx.audioWorklet.addModule("src/js/avb-worklet.js");
        var node = new AudioWorkletNode(ctx, "avb-meter");
        node.port.onmessage = function (ev) { onWorkletMsg(ev && ev.data); };
        src.connect(node);
        mic.node = node;
        mic.engine = "worklet";
      } catch (e) {
        var an = ctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        mic.an = an;
        mic.buf = new Uint8Array(an.fftSize);
        mic.engine = "analyser";
      }
      return { ok: true, state: "on", engine: mic.engine, device: deviceLabel };
    } catch (e) { mic = { denied: true }; return { ok: false, state: "denied" }; }
  }

  function onWorkletMsg(m) {
    if (!mic || !m) return;
    mic.peak = clamp01(m.peak);
    mic.hold = clamp01(m.hold);
    mic.rms = clamp01(m.rms);
    mic.k = clamp01(m.k);
    mic.tp = clamp01(m.tp);
    mic.clips = Number(m.clips) || 0;
    mic.at = Date.now();
    if (m.clip) mic.clipAt = mic.at;
    mic.clip = (mic.at - mic.clipAt) < CLIP_LATCH_MS;
    var msq = mic.k * mic.k;
    if (msq > 0) {
      lufsBlocks.push({ at: mic.at, e: msq });
      if (lufsBlocks.length > 36000) lufsBlocks.splice(0, lufsBlocks.length - 36000);
    }
    if (mic.tp > tpMax) tpMax = mic.tp;
    if (db(mic.tp) > R128_TP) tpOver = true;
    vadFeed(mic.rms, /cable/i.test(mic.device || "") ? "cable" : "mic");
  }

  function micStop() {
    try { monitorStop(); } catch (e) {}
    try {
      if (mic) {
        try { if (mic.node) mic.node.disconnect(); } catch (e) {}
        if (mic.stream) mic.stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
        if (mic.ctx) mic.ctx.close();
      }
    } catch (e) {}
    mic = null;
    return { ok: true, state: "off" };
  }

  function monitorStart() {
    if (mon && mon.gain) return { ok: true, receipt: "AVB :: MAYA MONITOR ALREADY ON - HER LINE TO YOUR EARS, CUT WHILE BARBELO SPEAKS." };
    if (!mic || (!mic.node && !mic.an)) return { ok: false, receipt: "AVB :: OPEN THE MIC FIRST (METER MIC) - THE MONITOR RIDES THE CABLE IT OPENS." };
    if (!/cable/i.test(mic.device || "")) return { ok: false, receipt: "AVB :: MONITOR REFUSED - THE OPEN INPUT IS " + String(mic.device || "UNKNOWN").toUpperCase() + ", NOT THE CABLE. MONITORING A REAL MIC WOULD FEED BACK." };
    try {
      var msrc = mic.ctx.createMediaStreamSource(mic.stream);
      var g = mic.ctx.createGain();
      g.gain.value = 0;
      msrc.connect(g);
      try { g.connect(mic.ctx.destination); } catch (e) {}
      mon = { gain: g, src: msrc, ctx: mic.ctx, test: false, shut: true };
      return { ok: true, receipt: "AVB :: MAYA MONITOR ON - HER LINE REACHES YOUR EARS ONLY THROUGH HERE, CUT WHILE BARBELO SPEAKS." };
    } catch (e) { return { ok: false, receipt: "AVB :: THE MONITOR WOULD NOT OPEN." }; }
  }

  function monitorStop() {
    try {
      if (mon) {
        try { if (mon.src) mon.src.disconnect(); } catch (e) {}
        try { if (mon.gain) mon.gain.disconnect(); } catch (e) {}
        try { if (mon.test && mon.ctx) mon.ctx.close(); } catch (e) {}
      }
    } catch (e) {}
    mon = null;
    return { ok: true };
  }

  function monitorOn() { return !!(mon && mon.gain); }

  function monitorFollow() {
    if (!mon || !mon.gain) return;
    var shut = true;
    try { shut = !!(window.turn && window.turn.barbGated && window.turn.barbGated()); } catch (e) { shut = true; }
    mon.shut = shut;
    try {
      var t = shut ? 0 : 1;
      if (mon.gain.gain && mon.gain.gain.setTargetAtTime) mon.gain.gain.setTargetAtTime(t, mon.ctx.currentTime, 0.03);
      else mon.gain.gain.value = t;
    } catch (e) {}
  }

  function monitorTest() {
    try { monitorStop(); } catch (e) {}
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
      var g = ctx.createGain();
      g.gain.value = 0;
      mon = { gain: g, src: null, ctx: ctx, test: true, shut: true };
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }

  async function auditionStart(id) {
    auditionStop();
    var M = null;
    try { M = window.media || null; } catch (e) {}
    if (!M) return { ok: false, why: "no vault" };
    var rec = null, objUrl = null;
    try {
      rec = M.get(id);
      objUrl = M.url(id);
    } catch (e) { rec = null; }
    if (!rec || !objUrl) return { ok: false, why: "not in vault" };
    try {
      var res = await fetch(objUrl);
      var buf = await res.arrayBuffer();
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
      var decoded = await ctx.decodeAudioData(buf);
      await ctx.audioWorklet.addModule("src/js/avb-worklet.js");
      var node = new AudioWorkletNode(ctx, "avb-meter");
      node.port.onmessage = function (ev) { onAudMsg(ev && ev.data); };
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(node);
      try { src.connect(ctx.destination); } catch (e) {}
      aud = { ctx: ctx, node: node, src: src, id: id,
        name: String((rec && rec.name) || id).slice(0, 40),
        peak: 0, hold: 0, rms: 0, k: 0, tp: 0, clip: false, clipAt: 0, clips: 0, at: 0 };
      src.onended = function () { try { auditionStop(); } catch (e) {} };
      src.start();
      return { ok: true, name: aud.name, seconds: Math.round(decoded.duration * 10) / 10 };
    } catch (e) { try { auditionStop(); } catch (x) {} return { ok: false, why: "cannot play it" }; }
  }

  function onAudMsg(m) {
    if (!aud || !m) return;
    aud.peak = clamp01(m.peak);
    aud.hold = clamp01(m.hold);
    aud.rms = clamp01(m.rms);
    aud.k = clamp01(m.k);
    aud.tp = clamp01(m.tp);
    aud.clips = Number(m.clips) || 0;
    aud.at = Date.now();
    if (m.clip) aud.clipAt = aud.at;
    aud.clip = (aud.at - aud.clipAt) < CLIP_LATCH_MS;
    var msq = aud.k * aud.k;
    if (msq > 0) {
      lufsBlocks.push({ at: aud.at, e: msq });
      if (lufsBlocks.length > 36000) lufsBlocks.splice(0, lufsBlocks.length - 36000);
    }
    if (aud.tp > tpMax) tpMax = aud.tp;
    if (db(aud.tp) > R128_TP) tpOver = true;
    vadFeed(aud.rms, "gallery");
  }

  function auditionStop() {
    try {
      if (aud) {
        try { aud.src.stop(); } catch (e) {}
        try { aud.node.disconnect(); } catch (e) {}
        try { aud.ctx.close(); } catch (e) {}
      }
    } catch (e) {}
    aud = null;
    return { ok: true };
  }

  function audRead() {
    if (!aud || !aud.node) return { live: false };
    if (!aud.at || Date.now() - aud.at > 2000) { try { auditionStop(); } catch (e) {} return { live: false }; }
    return { live: true, level: aud.rms, rms: aud.rms, peak: aud.peak, hold: aud.hold,
      tp: aud.tp, clip: aud.clip, lufs: true, source: "gallery" };
  }

  function micRead() {
    if (!mic || (!mic.node && !mic.an)) return { live: false, denied: !!(mic && mic.denied) };
    try {
      if (mic.node) {
        if (!mic.at || Date.now() - mic.at > 2000) return { live: false };
        var src = /cable/i.test(mic.device || "") ? "cable-in" : "mic";
        return { live: true, level: mic.rms, rms: mic.rms, peak: mic.peak, hold: mic.hold,
          tp: mic.tp, clip: mic.clip, lufs: true, source: src };
      }
      mic.an.getByteTimeDomainData(mic.buf);
      var sum = 0;
      for (var i = 0; i < mic.buf.length; i++) { var v = (mic.buf[i] - 128) / 128; sum += v * v; }
      return { live: true, level: clamp01(Math.sqrt(sum / mic.buf.length)), source: "mic" };
    } catch (e) { return { live: false }; }
  }

  function remoteStart(base, token) {
    remote = { base: String(base || "").replace(/\/+$/, ""), token: String(token || ""), level: 0, at: 0, down: false };
    pollRemote();
    return { ok: true };
  }

  function remoteStop() { remote = null; return { ok: true }; }

  async function pollRemote() {
    var r = remote;
    if (!r) return;
    try {
      var res = await fetch(r.base + "/api/level?token=" + encodeURIComponent(r.token));
      var data = await res.json();
      if (remote !== r) return;
      if (data && data.ok) {
        r.level = clamp01(data.rms);
        r.peak = clamp01(data.peak);
        r.capturing = !!data.capturing;
        r.at = Date.now();
        r.down = false;
        vadFeed(r.level, "cable");
      } else { r.down = true; }
    } catch (e) { if (remote === r) r.down = true; }
    setTimeout(function () { if (remote === r) pollRemote(); }, 500);
  }

  function remoteRead() {
    if (!remote) return { live: false };
    if (remote.down || Date.now() - remote.at > 2500) return { live: false, down: true };
    return { live: true, level: remote.level, rms: remote.level, peak: remote.peak, source: "cable" };
  }

  function remoteLevel() {
    if (!remote) return { live: false, level: 0 };
    if (remote.down || Date.now() - remote.at > 2500) return { live: false, down: true, level: 0 };
    return { live: true, level: remote.level, rms: remote.level, peak: remote.peak || 0 };
  }

  function feedRead() {
    if (Date.now() - fedAt > 2000) return { live: false };
    return { live: true, level: fedLevel, rms: fedLevel, source: fedFrom };
  }

  function read() {
    var r = remoteRead();
    if (r.live) return r;
    r = micRead();
    if (r.live) return r;
    r = audRead();
    if (r.live) return r;
    r = voiceRead();
    if (r.live) return r;
    r = feedRead();
    if (r.live) return r;
    return { live: false, level: 0, source: remote ? "cable-dark" : (mic && mic.denied ? "mic-denied" : "none") };
  }

  function lufsWindow(ms) {
    var now = Date.now(), sum = 0, n = 0;
    for (var i = lufsBlocks.length - 1; i >= 0; i--) {
      if (now - lufsBlocks[i].at > ms) break;
      sum += lufsBlocks[i].e;
      n++;
    }
    if (!n) return -Infinity;
    return lufsOf(sum / n);
  }

  function lufsIntegrated() {
    var abs = [], i;
    for (i = 0; i < lufsBlocks.length; i++) {
      if (lufsOf(lufsBlocks[i].e) >= -70) abs.push(lufsBlocks[i].e);
    }
    if (!abs.length) return -Infinity;
    var sum = 0;
    for (i = 0; i < abs.length; i++) sum += abs[i];
    var rel = lufsOf(sum / abs.length) - 10;
    sum = 0;
    var n = 0;
    for (i = 0; i < abs.length; i++) {
      if (lufsOf(abs[i]) >= rel) { sum += abs[i]; n++; }
    }
    if (!n) return -Infinity;
    return lufsOf(sum / n);
  }

  function fmtL(v) {
    if (!isFinite(v)) return "--";
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  function lufsLine() {
    if (!lufsBlocks.length) return null;
    var now = Date.now();
    while (lufsBlocks.length && now - lufsBlocks[0].at > 600000) lufsBlocks.shift();
    return { m: lufsWindow(400), s: lufsWindow(3000), i: lufsIntegrated(),
      tp: db(tpMax), over: tpOver };
  }

  function lufsReset() {
    lufsBlocks = [];
    tpMax = 0;
    tpOver = false;
    return { ok: true };
  }

  function indicator(boxId) {
    var box = document.getElementById(boxId);
    if (!box || box.__avb) return null;
    box.__avb = true;
    var dot = document.createElement("span");
    dot.className = "avbDot";
    var bar = document.createElement("div");
    bar.className = "avbBar";
    bar.title = "RMS BODY (green) - INSTANT PEAK (bright line) - PEAK HOLD (held tick) - VAD TRIGGER (amber tick). Over the amber line is VOICE.";
    var fill = document.createElement("div");
    fill.className = "avbFill";
    var pline = document.createElement("div");
    pline.className = "avbPeakLine";
    var hold = document.createElement("div");
    hold.className = "avbPeak";
    var vad = document.createElement("div");
    vad.className = "avbVad";
    bar.appendChild(fill);
    bar.appendChild(pline);
    bar.appendChild(hold);
    bar.appendChild(vad);
    var clip = document.createElement("span");
    clip.className = "avbClip";
    clip.title = "CLIP - a sample touched 0 dBFS. Latches 1.5s.";
    clip.textContent = "CLIP";
    var text = document.createElement("span");
    text.className = "avbText cpHint";
    var lufs = document.createElement("span");
    lufs.className = "avbLufs cpHint";
    box.appendChild(dot);
    box.appendChild(bar);
    box.appendChild(clip);
    box.appendChild(text);
    box.appendChild(lufs);
    var h = { box: box, dot: dot, fill: fill, pline: pline, hold: hold, vad: vad, clip: clip, text: text, lufs: lufs, uiHold: 0 };
    rendered.push(h);
    return h;
  }

  setInterval(function () {
    try { monitorFollow(); } catch (e) {}
    if (!rendered.length) return;
    var r = null;
    try { r = read(); } catch (e) { r = { live: false, level: 0, source: "none" }; }
    var vt = vadThreshold();
    var L = null;
    try { L = lufsLine(); } catch (e) { L = null; }
    for (var i = 0; i < rendered.length; i++) {
      (function (h) {
        try {
          var rms = r.live ? clamp01(r.rms != null ? r.rms : r.level) : 0;
          var pk = r.live ? clamp01(r.peak != null ? r.peak : r.level) : 0;
          var hd = pk;
          if (r.live && r.hold != null) hd = clamp01(r.hold);
          else {
            if (pk >= h.uiHold) h.uiHold = pk;
            else h.uiHold = Math.max(pk, h.uiHold * 0.92);
            hd = h.uiHold;
          }
          h.dot.className = "avbDot " + (r.live ? "on" : "");
          h.fill.style.width = Math.max(0, Math.min(100, rms * 100)) + "%";
          h.pline.style.left = Math.max(0, Math.min(100, pk * 100)) + "%";
          h.hold.style.left = Math.max(0, Math.min(100, hd * 100)) + "%";
          h.vad.style.left = Math.max(0, Math.min(100, vt * 100)) + "%";
          var clipped = !!(r.live && r.clip);
          h.clip.className = "avbClip" + (clipped ? " hot" : "");
          h.text.textContent = r.live
            ? "PK " + db(pk) + "dB RMS " + db(rms) + "dB" + (r.hold != null ? " HOLD " + db(hd) + "dB" : "") + " " + String(r.source || "").toUpperCase()
            : "DARK " + String(r.source || "NONE").toUpperCase().replace("-", " ");
          if (L && r.lufs) {
            var ok = (L.i <= R128_I + 1) && !L.over;
            h.lufs.textContent = "M " + fmtL(L.m) + " S " + fmtL(L.s) + " I " + fmtL(L.i)
              + " LUFS* - TP-EST " + (isFinite(L.tp) ? L.tp : "--") + "dB MAX"
              + (L.over ? " OVER -1" : "") + " - R128 " + R128_I + "/" + R128_TP + (ok ? " OK" : "");
          } else if (L) {
            h.lufs.textContent = "SHOW OUT ON MIC/CABLE FOR LUFS* - R128 " + R128_I + "/" + R128_TP;
          } else {
            h.lufs.textContent = r.live ? "LUFS* -- (WORKLET OFF) - R128 " + R128_I + "/" + R128_TP : "";
          }
        } catch (e) {}
      })(rendered[i]);
    }
  }, TICK);

  window.avb = {
    read: read, feed: feed, indicator: indicator,
    micStart: micStart, micStop: micStop, listMics: listMics,
    micOn: function () { return !!(mic && (mic.node || mic.an)); },
    monitorStart: monitorStart, monitorStop: monitorStop, monitorOn: monitorOn, monitorTest: monitorTest,
    monitorShut: function () { return !!(mon && mon.shut); },
    audition: auditionStart, auditionStop: auditionStop,
    auditionOn: function () { return !!(aud && aud.node); },
    micEngine: function () { return (mic && mic.engine) || "off"; },
    remoteStart: remoteStart, remoteStop: remoteStop, remoteLevel: remoteLevel,
    remoteOn: function () { return !!remote; },
    lufs: lufsLine, lufsReset: lufsReset,
    db: db
  };
})();
