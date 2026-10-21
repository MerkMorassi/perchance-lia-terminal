/* AVB METER WORKLET - the ears inside the audio thread.
   Loaded by src/js/avb.js through ctx.audioWorklet.addModule("src/js/avb-worklet.js").
   Runs on the dedicated audio thread: process() sees EVERY sample of every
   128-sample quantum, so no peak can slip between polls. Per window (~1/30s)
   it posts one message: { peak, hold, rms, k, tp, clip, clips, n }.
   - peak: highest |sample| across all channels in the window (unweighted).
   - hold: peak-hold kept HERE, decaying ~0.6x per second, never in the UI.
   - rms: unweighted RMS of the mono mix, the general presence body.
   - k: K-APPROX RMS - mono mix through a 60Hz high-pass plus a +4dB
     high shelf at 1682Hz (RBJ biquads, coefficients built for the real
     sampleRate). An approximation of the BS.1770 K-weighting, not a
     certified implementation - the readouts say LUFS* for this reason.
   - tp: TRUE-PEAK ESTIMATE - the mono mix 4x oversampled by Catmull-Rom
     interpolation, max |value| in the window. Catches inter-sample overs
     a sample meter misses; still an estimate, shown as TP-EST.
   - clip: true if any sample touched |x| >= 1.0 this window; clips counts
     every clipped sample since the node was built. */

function rbjHighpass(fc, Q, fs) {
  var w0 = 2 * Math.PI * fc / fs;
  var cw = Math.cos(w0), sw = Math.sin(w0);
  var alpha = sw / (2 * Q);
  var b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
  var a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function rbjHighShelf(fc, gainDb, fs) {
  var A = Math.pow(10, gainDb / 40);
  var w0 = 2 * Math.PI * fc / fs;
  var cw = Math.cos(w0), sw = Math.sin(w0);
  var alpha = sw / 2 * Math.SQRT2;
  var sqA = Math.sqrt(A);
  var b0 = A * ((A + 1) + (A - 1) * cw + 2 * sqA * alpha);
  var b1 = -2 * A * ((A - 1) + (A + 1) * cw);
  var b2 = A * ((A + 1) + (A - 1) * cw - 2 * sqA * alpha);
  var a0 = (A + 1) - (A - 1) * cw + 2 * sqA * alpha;
  var a1 = 2 * ((A - 1) - (A + 1) * cw);
  var a2 = (A + 1) - (A - 1) * cw - 2 * sqA * alpha;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

class AvbMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    var fs = sampleRate || 48000;
    this.hp = rbjHighpass(60, 0.7071, fs);
    this.sh = rbjHighShelf(1681.974, 4, fs);
    this.hx1 = 0; this.hx2 = 0; this.hy1 = 0; this.hy2 = 0;
    this.sx1 = 0; this.sx2 = 0; this.sy1 = 0; this.sy2 = 0;
    this.pm0 = 0; this.pm1 = 0; this.pm2 = 0;
    this.span = Math.max(64, Math.floor(fs / 30));
    this.count = 0;
    this.wPeak = 0; this.wSum = 0; this.wK = 0; this.wTp = 0;
    this.wClip = false;
    this.hold = 0;
    this.clips = 0;
  }

  filt(c, x, s) {
    var y = c[0] * x + c[1] * s.x1 + c[2] * s.x2 - c[3] * s.y1 - c[4] * s.y2;
    s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
    return y;
  }

  catmull(p0, p1, p2, p3, mu) {
    var m1 = 0.5 * (p2 - p0), m2 = 0.5 * (p3 - p1);
    var mu2 = mu * mu, mu3 = mu2 * mu;
    return (2 * p1 - 2 * p2 + m1 + m2) * mu3
      + (-3 * p1 + 3 * p2 - 2 * m1 - m2) * mu2 + m1 * mu + p1;
  }

  post() {
    var n = this.count || 1;
    var msg = {
      peak: this.wPeak,
      hold: this.hold,
      rms: Math.sqrt(this.wSum / n),
      k: Math.sqrt(this.wK / n),
      tp: this.wTp,
      clip: this.wClip,
      clips: this.clips,
      n: n
    };
    this.port.postMessage(msg);
    this.count = 0;
    this.wPeak = 0; this.wSum = 0; this.wK = 0; this.wTp = 0;
    this.wClip = false;
  }

  process(inputs) {
    var chs = (inputs && inputs[0]) || [];
    if (!chs.length) return true;
    var len = chs[0].length;
    var hs = { x1: this.sx1, x2: this.sx2, y1: this.sy1, y2: this.sy2 };
    var hp = { x1: this.hx1, x2: this.hx2, y1: this.hy1, y2: this.hy2 };
    for (var i = 0; i < len; i++) {
      var mix = 0, pk = 0;
      for (var c = 0; c < chs.length; c++) {
        var s = chs[c][i] || 0;
        mix += s;
        var a = s < 0 ? -s : s;
        if (a > pk) pk = a;
        if (a >= 1) { this.wClip = true; this.clips++; }
      }
      mix /= chs.length;
      var y = this.filt(this.hp, mix, hp);
      y = this.filt(this.sh, y, hs);
      var tp = pk;
      var c1 = this.catmull(this.pm0, this.pm1, this.pm2, mix, 0.25);
      var c2 = this.catmull(this.pm0, this.pm1, this.pm2, mix, 0.5);
      var c3 = this.catmull(this.pm0, this.pm1, this.pm2, mix, 0.75);
      var a1 = c1 < 0 ? -c1 : c1, a2 = c2 < 0 ? -c2 : c2, a3 = c3 < 0 ? -c3 : c3;
      if (a1 > tp) tp = a1;
      if (a2 > tp) tp = a2;
      if (a3 > tp) tp = a3;
      this.pm0 = this.pm1; this.pm1 = this.pm2; this.pm2 = mix;
      if (pk > this.wPeak) this.wPeak = pk;
      if (tp > this.wTp) this.wTp = tp;
      this.wSum += mix * mix;
      this.wK += y * y;
      this.count++;
      if (this.count >= this.span) {
        if (this.wPeak > this.hold) this.hold = this.wPeak;
        else this.hold *= 0.985;
        this.post();
      }
    }
    this.hx1 = hp.x1; this.hx2 = hp.x2; this.hy1 = hp.y1; this.hy2 = hp.y2;
    this.sx1 = hs.x1; this.sx2 = hs.x2; this.sy1 = hs.y1; this.sy2 = hs.y2;
    return true;
  }
}

registerProcessor("avb-meter", AvbMeter);
