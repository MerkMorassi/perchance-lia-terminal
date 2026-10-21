window.wm = (function () {
  "use strict";
  var F1 = 17600, F2 = 18300;
  var GAIN = 0.022;
  var TAIL = 1500;
  var MIN_SR = 36000;
  var wins = [];
  var analyser = null, sr = 48000, freq = null;
  var tone = false, toneAt = 0, loud = false, loudAt = 0;
  var marked = 0, tones = 0;
  function now() { return Date.now(); }
  function prune(n) {
    var k = [];
    for (var i = 0; i < wins.length; i++) if (n - wins[i].to < 60000) k.push(wins[i]);
    wins = k;
    while (wins.length > 12) wins.shift();
  }
  function own(label, ms) {
    var n = now();
    prune(n);
    wins.push({ from: n, to: n + Math.max(600, Math.round(Number(ms) || 0)) + TAIL, label: String(label || "clip") });
    return true;
  }
  function close() {
    var n = now();
    for (var i = 0; i < wins.length; i++) if (wins[i].to > n + TAIL) wins[i].to = n + TAIL;
  }
  function inWin(n) {
    for (var i = wins.length - 1; i >= 0; i--) if (n >= wins[i].from && n <= wins[i].to) return wins[i];
    return null;
  }
  function watch(an, sampleRate) {
    analyser = an || null;
    if (sampleRate > 0) sr = sampleRate;
    freq = null;
  }
  function peak(b) {
    if (!freq || b < 14 || b + 14 >= freq.length) return false;
    var v = freq[b] + freq[b + 1];
    var floor = 0;
    for (var o = 5; o <= 13; o++) floor += freq[b - o] + freq[b + o];
    floor /= 18;
    return (v - floor) >= 150;
  }
  function sample(rms) {
    var n = now();
    loud = (Number(rms) || 0) > 0.02;
    if (loud) loudAt = n;
    if (!analyser) return tone;
    try {
      if (!freq || freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      var step = analyser.fftSize / sr;
      tone = peak(Math.round(F1 * step)) && peak(Math.round(F2 * step));
      if (tone) { toneAt = n; tones++; }
    } catch (e) {}
    return tone;
  }
  function heard() {
    var n = now();
    var w = inWin(n);
    if (!w) return false;
    if (loud || (n - loudAt) < 1200) return true;
    if (tone && (n - toneAt) < 3000) return true;
    return false;
  }
  function state() {
    var n = now();
    var w = inWin(n);
    return {
      open: !!w, label: w ? w.label : "",
      until: w ? Math.max(0, w.to - n) : 0,
      tone: tone, loud: loud,
      marked: marked, tones: tones,
      windows: wins.length
    };
  }
  var AC = null;
  function ctx() {
    try {
      if (AC) return AC;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      return AC;
    } catch (e) { return null; }
  }
  function encodeWav(buf) {
    var nCh = Math.min(2, buf.numberOfChannels);
    var len = buf.length;
    var bytes = 44 + len * nCh * 2;
    var ab = new ArrayBuffer(bytes);
    var v = new DataView(ab);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF");
    v.setUint32(4, bytes - 8, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, nCh, true);
    v.setUint32(24, buf.sampleRate, true);
    v.setUint32(28, buf.sampleRate * nCh * 2, true);
    v.setUint16(32, nCh * 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, len * nCh * 2, true);
    var off = 44;
    var chs = [];
    for (var c = 0; c < nCh; c++) chs.push(buf.getChannelData(c));
    for (var i = 0; i < len; i++) {
      for (var c2 = 0; c2 < nCh; c2++) {
        var s2 = Math.max(-1, Math.min(1, chs[c2][i]));
        v.setInt16(off, s2 < 0 ? s2 * 32768 : s2 * 32767, true);
        off += 2;
      }
    }
    return ab;
  }
  async function mark(blob, label) {
    var out = { blob: blob, pilot: false, ms: 0 };
    try {
      var c = ctx();
      if (!c) return out;
      var raw = await blob.arrayBuffer();
      var audio = await c.decodeAudioData(raw.slice(0));
      out.ms = Math.round(audio.duration * 1000) || 0;
      if (out.ms > 0) { try { own(label || "clip", out.ms); } catch (e) {} }
      if (audio.sampleRate < MIN_SR) return out;
      var nCh = Math.min(2, audio.numberOfChannels);
      var peak0 = 0;
      var chs = [];
      for (var ch = 0; ch < nCh; ch++) {
        var d = audio.getChannelData(ch);
        chs.push(d);
        for (var q = 0; q < d.length; q += 7) {
          var a = Math.abs(d[q]);
          if (a > peak0) peak0 = a;
        }
      }
      var scale = (peak0 > 0.96) ? (0.96 / peak0) : 1;
      var st1 = 2 * Math.PI * F1 / audio.sampleRate;
      var st2 = 2 * Math.PI * F2 / audio.sampleRate;
      var ph1 = 0, ph2 = 0;
      var g1 = GAIN * 0.5 * scale, g0 = scale;
      for (var i = 0; i < audio.length; i++) {
        var m = g1 * (Math.sin(ph1) + Math.sin(ph2));
        ph1 += st1; ph2 += st2;
        for (var c2 = 0; c2 < nCh; c2++) chs[c2][i] = chs[c2][i] * g0 + m;
      }
      out.blob = new Blob([encodeWav(audio)], { type: "audio/wav" });
      out.pilot = true;
      marked++;
    } catch (e) {}
    return out;
  }
  return {
    own: own,
    close: close,
    watch: watch,
    sample: sample,
    heard: heard,
    state: state,
    mark: mark
  };
})();
