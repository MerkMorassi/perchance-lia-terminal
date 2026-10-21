window.tricom = (function () {
  "use strict";

  /* ---- TRICOMM ---------------------------------------------------------------
     THE THREE-WAY CALL'S OWN PAGE: you, Barbelo and Maya, audio only, under a
     ROTATING GATE - BARBELO, MAYA, YOU, repeat. One seat holds the room, the
     other two listen. Turns pass on their own or by NEXT TURN.
     Each seat owns an INPUT DROPDOWN (every connected audio input), a live
     METER (pre-mute, so it proves the signal is hitting the system even while
     the seat is muted), a MUTE (hard silence for isolation), and a MONITOR
     (whether the seat's input plays into your headphones on its turn).
     YOU: your mic (or OFF). Live only on your turn; MON defaults OFF so your
       own mic never feeds back into your ears - switch it on to check the road.
     BARBELO: SYNTHETIC (her usual voice, meter follows her voice level) or any
       input (meter + monitor follow that road). MUTE hushes her at once and
      holds her replies silent while live.
      MAYA: the guest road - any external input (the iRIG line her signal rides
        in on), never your own mic. MONITOR defaults ON so the producer hears
        her. Her seat is STICKY: when hardware is replugged and its device id
        dies, her seat follows the iRIG label back on its own.
      THE PRODUCER WAITS: CHECK IN opens her road before the show - meter live
        and monitor open in your headphones - and watches for her signal. Her
        first real voice flips the room to GUEST ON THE LINE; GO LIVE then
        takes her already-open road gaplessly, no re-press, no gap.
      Meters stay live while the panel is open, so a muted seat still shows its
     signal landing. Nothing is sent or recorded - Maya is a local input only.
     --------------------------------------------------------------------------- */

  function el(id) { return document.getElementById(id); }
  function print(t) { if (typeof window.print === "function" && t) window.print("SYSTEM", t); }
  function vox() { return window.voice || null; }

  var pc = {
    ctx: null,
    youStream: null, barbStream: null, mayaStream: null,
    youAn: null, barbAn: null, mayaAn: null,
    youBuf: null, barbBuf: null, mayaBuf: null,
    youGain: null, barbGain: null, mayaGain: null,
    youSrc: "default", barbSrc: "synth", mayaSrc: "off",
    youMute: false, barbMute: false, mayaMute: false,
    youMon: false, barbMon: true, mayaMon: true,
    live: false, floor: "STANDBY",
    floorSince: 0, heard: false, lastVoice: 0,
    paintTimer: 0, tickTimer: 0, devs: [],
    youDev: null, barbDev: null, mayaDev: null,
    checkin: false, guestSeen: false, checkTimer: 0,
    outDevs: [], tbOut: "", tbOn: false,
    tbSrc: null, tbGain: null, tbAn: null, tbBuf: null, tbStream: null,
    gcOn: false
  };

  var ORDER = ["BARBELO", "MAYA", "OPERATOR"];

  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }

  async function savedGet() {
    var k = kv();
    if (!k) return;
    try {
      var s = await k.get("tricom");
      if (s && typeof s === "object") {
        if (typeof s.youSrc === "string" && s.youSrc) pc.youSrc = s.youSrc;
        if (typeof s.barbSrc === "string" && s.barbSrc) pc.barbSrc = s.barbSrc;
        if (typeof s.mayaSrc === "string" && s.mayaSrc) pc.mayaSrc = s.mayaSrc;
        if (typeof s.tbOut === "string") pc.tbOut = s.tbOut;
        else pc.tbOut = null;
        if (typeof s.youMon === "boolean") pc.youMon = s.youMon;
        if (typeof s.barbMon === "boolean") pc.barbMon = s.barbMon;
        if (typeof s.mayaMon === "boolean") pc.mayaMon = s.mayaMon;
      }
    } catch (e) {}
  }

  async function savedSet() {
    var k = kv();
    if (!k) return;
    try {
      await k.set("tricom", {
        youSrc: pc.youSrc, barbSrc: pc.barbSrc, mayaSrc: pc.mayaSrc,
        tbOut: pc.tbOut,
        youMon: pc.youMon, barbMon: pc.barbMon, mayaMon: pc.mayaMon
      });
    } catch (e) {}
  }

  function actx() {
    if (pc.ctx) return pc.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { pc.ctx = new AC(); } catch (e) { return null; }
    if (pc.ctx.state === "suspended") { try { pc.ctx.resume(); } catch (e) {} }
    return pc.ctx;
  }

  function watch(stream) {
    var c = actx();
    if (!c) return null;
    try {
      var src = c.createMediaStreamSource(stream);
      var an = c.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      return an;
    } catch (e) { return null; }
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

  function gainRoute(stream) {
    var c = actx();
    if (!c) return null;
    try {
      var src = c.createMediaStreamSource(stream);
      var g = c.createGain();
      g.gain.value = 0;
      var dest = c.createMediaStreamDestination();
      src.connect(g);
      g.connect(dest);
      return { gain: g, out: dest.stream };
    } catch (e) { return null; }
  }

  function setGain(g, v) {
    if (!g) return;
    try {
      var t = pc.ctx ? pc.ctx.currentTime : null;
      if (t !== null && g.gain.setTargetAtTime) g.gain.setTargetAtTime(v, t, 0.04);
      else g.gain.value = v;
    } catch (e) { try { g.gain.value = v; } catch (x) {} }
  }

  async function devices() {
    var out = [], outs = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return out;
      var all = await navigator.mediaDevices.enumerateDevices();
      all.forEach(function (d) {
        if (d.kind === "audioinput") out.push({ id: d.deviceId || "", label: d.label || "MICROPHONE" });
        else if (d.kind === "audiooutput") outs.push({ id: d.deviceId || "", label: d.label || "OUTPUT" });
      });
    } catch (e) {}
    return { ins: out, outs: outs };
  }

  async function unlockLabels() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
      var s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      return true;
    } catch (e) { return false; }
  }

  function selectedVal(id) {
    var s = el(id);
    return s ? String(s.value || "") : "";
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

  function devNote() {
    var n = el("tcDevNote");
    if (!n) return;
    var t = pc.devs.length
      ? (pc.devs.length + " INPUT" + (pc.devs.length === 1 ? "" : "S") + " ON THE MACHINE - ONE ROAD PER SEAT")
      : "NO INPUTS LISTED - PRESS REFRESH (THE BROWSER NAMES THEM AFTER THE MIC IS ALLOWED)";
    if (n.textContent !== t) n.textContent = t;
  }

  function syncButtons() {
    var b;
    b = el("tcYouMute"); if (b) { var yt = pc.youMute ? "UNMUTE" : "MUTE"; if (b.textContent !== yt) b.textContent = yt; }
    b = el("tcBarbMute"); if (b) { var bt = pc.barbMute ? "UNMUTE" : "MUTE"; if (b.textContent !== bt) b.textContent = bt; }
    b = el("tcMayaMute"); if (b) { var mt = pc.mayaMute ? "UNMUTE" : "MUTE"; if (b.textContent !== mt) b.textContent = mt; }
    b = el("tcYouMon"); if (b) { var ym = "MON: " + (pc.youMon ? "ON" : "OFF"); if (b.textContent !== ym) b.textContent = ym; }
    b = el("tcBarbMon"); if (b) { var bm = "MON: " + (pc.barbMon ? "ON" : "OFF"); if (b.textContent !== bm) b.textContent = bm; }
    b = el("tcMayaMon"); if (b) { var mm = "MONITOR: " + (pc.mayaMon ? "ON" : "OFF"); if (b.textContent !== mm) b.textContent = mm; }
    b = el("tcTalkback"); if (b) { var tb = "TALKBACK: " + (pc.tbOn ? "ON" : "OFF"); if (b.textContent !== tb) b.textContent = tb; }
    b = el("tcGuestcomm"); if (b) { var gc = "GUESTCOMM: " + (pc.gcOn ? "ON" : "OFF"); if (b.textContent !== gc) b.textContent = gc; }
  }

  async function refreshDevices() {
    await unlockLabels();
    var dev = await devices();
    var d = dev && dev.ins ? dev.ins : dev;
    var o = (dev && dev.outs) || [];
    pc.devs = d;
    pc.outDevs = o;
    var ins = d.map(function (m, i) {
      return { id: m.id || "default", label: (m.label || ("INPUT " + (i + 1))).toUpperCase().slice(0, 48) };
    });
    fillSel("tcYouSrc", [{ id: "off", label: "OFF - SEAT DARK" }, { id: "default", label: "DEFAULT MIC" }, { id: "iphone", label: "IPHONE - SPARE MIC (QR)" }].concat(ins));
    fillSel("tcBarbSrc", [{ id: "synth", label: "SYNTHETIC - HER USUAL VOICE" }, { id: "off", label: "OFF - SEAT DARK" }].concat(ins));
    fillSel("tcMayaSrc", [{ id: "off", label: "OFF" }, { id: "default", label: "DEFAULT MIC" }, { id: "iphone", label: "IPHONE - MAYA'S CALL (QR)" }].concat(ins));
    var outs = o.map(function (m, i) {
      return { id: m.id || "", label: (m.label || ("OUTPUT " + (i + 1))).toUpperCase().slice(0, 48) };
    });
    fillSel("tcTbOut", [{ id: "", label: "DEFAULT OUTPUT" }].concat(outs));
    pc.youSrc = keepVal("tcYouSrc", pc.youSrc, "default");
    pc.barbSrc = keepVal("tcBarbSrc", pc.barbSrc, "synth");
    // THE GUEST ROAD IS STICKY: device ids die when hardware is replugged,
    // labels don't. keepVal below drops a dead id to OFF - but if she rode a
    // real road that is simply gone, and the iRIG line is here, her seat
    // follows the iRIG label on its own instead. An explicit OFF, a working
    // road, and the QR call are never touched.
    var mayaWant = pc.mayaSrc;
    pc.mayaSrc = keepVal("tcMayaSrc", pc.mayaSrc, "off");
    if (mayaWant && mayaWant !== "off" && mayaWant !== "iphone" && mayaWant !== "default" && pc.mayaSrc === "off") {
      var mIrig2 = "";
      for (var gi2 = 0; gi2 < d.length; gi2++) {
        if (/irig/i.test(d[gi2].label || "")) { mIrig2 = d[gi2].id || ""; break; }
      }
      if (mIrig2) {
        pc.mayaSrc = keepVal("tcMayaSrc", mIrig2, "off");
        savedSet();
      }
    }
    // THE TALKBACK OUTPUT IS STICKY TOO: her ears ride the iRIG output back
    // down the wire. First sight of it (or a dead saved id) selects it.
    // An explicit DEFAULT OUTPUT is never overridden - only a first sighting
    // (nothing saved yet) or a dead saved id follows the iRIG.
    var tbWant = pc.tbOut;
    pc.tbOut = keepVal("tcTbOut", pc.tbOut || "", "");
    if (tbWant === null || (tbWant && pc.tbOut !== tbWant)) {
      // Prefer a real iRIG line over the DEFAULT/COMMUNICATIONS aliases, so
      // talkback stays on her ears even when his system default moves.
      var tIrig = "", tIrigAlias = "";
      for (var ti = 0; ti < o.length; ti++) {
        if (/irig/i.test(o[ti].label || "")) {
          if (o[ti].id === "default" || o[ti].id === "communications") { if (!tIrigAlias) tIrigAlias = o[ti].id || ""; }
          else { tIrig = o[ti].id || ""; break; }
        }
      }
      if (!tIrig) tIrig = tIrigAlias;
      if (tIrig && pc.tbOut !== tIrig) {
        pc.tbOut = keepVal("tcTbOut", tIrig, "");
        savedSet();
      }
    }
    devNote();
    syncButtons();
    paint();
  }

  function audioElFor(which) {
    return which === "you" ? "tcYouAudio" : which === "barb" ? "tcBarbAudio" : "tcMayaAudio";
  }

  function srcOf(which) {
    return which === "you" ? pc.youSrc : which === "barb" ? pc.barbSrc : pc.mayaSrc;
  }

  function seatName(which) {
    return which === "you" ? "YOUR MIC" : which === "barb" ? "BARBELO'S INPUT" : "MAYA'S INPUT";
  }

  // Attach a borrowed iPhone call stream to a seat: metered, muted and gated
  // like any input. The tracks stay owned by the call - never stopped here.
  function attachIphone(which, rs) {
    if (!rs) return null;
    if (which === "you") {
      if (pc.youStream === rs && pc.youAn) return rs;
      dropStream("you");
      stopEl(audioElFor("you"));
      pc.youStream = rs;
      pc.youAn = watch(rs);
      pc.youBuf = new Uint8Array(512);
      var routedI = gainRoute(rs);
      pc.youGain = routedI ? routedI.gain : null;
      var ai = el("tcYouAudio");
      if (ai) {
        try { ai.srcObject = routedI ? routedI.out : rs; } catch (e) {}
        safePlay(ai);
      }
    } else {
      if (pc.mayaStream === rs && pc.mayaAn) return rs;
      dropStream("maya");
      stopEl(audioElFor("maya"));
      pc.mayaStream = rs;
      pc.mayaAn = watch(rs);
      pc.mayaBuf = new Uint8Array(512);
      var routedM = gainRoute(rs);
      pc.mayaGain = routedM ? routedM.gain : null;
      var am = el("tcMayaAudio");
      if (am) {
        try { am.srcObject = routedM ? routedM.out : rs; } catch (e) {}
        safePlay(am);
      }
    }
    applyFloorAudio();
    paint();
    return rs;
  }

  // MAYA CALLS IN: the desk answers by itself and this lands her call straight
  // on her seat - no second press from him. Her seat wins when armed; his seat
  // takes it only when it rides IPHONE and hers is not armed for the call.
  function takeIphoneCall(stream) {
    if (!stream) return null;
    if (guestLineUp()) { print("GUESTCOMM :: PRIVATE - THE GUEST LINE HOLDS HER. HANG IT UP FIRST - NO SECOND CALL WHILE IT IS UP."); return null; }
    if (pc.mayaSrc === "iphone") {
      attachIphone("maya", stream);
      return "maya";
    }
    if (pc.youSrc === "iphone") {
      attachIphone("you", stream);
      return "you";
    }
    return null;
  }

  // The call is gone: detach the borrowed refs (tracks already stopped by the
  // call itself) so her seat falls silent instead of holding a dead stream.
  function clearIphoneCall() {
    var cleared = false;
    if (pc.mayaSrc === "iphone" && pc.mayaStream) { dropStream("maya"); stopEl("tcMayaAudio"); cleared = true; }
    if (pc.youSrc === "iphone" && pc.youStream) { dropStream("you"); stopEl("tcYouAudio"); cleared = true; }
    if (cleared) {
      try { applyFloorAudio(); } catch (e) {}
      try { paint(); } catch (e) {}
    }
    return cleared;
  }

  async function openSeat(which) {
    var src = srcOf(which);
    // GAPLESS RE-TAKE: the guest checked in early and her road is already
    // open - keep it and just re-seat the monitor. Same for any seat whose
    // road hasn't changed under it: GO LIVE never re-opens a live road.
    var devF = which === "you" ? "youDev" : which === "barb" ? "barbDev" : "mayaDev";
    var curS = which === "you" ? pc.youStream : which === "barb" ? pc.barbStream : pc.mayaStream;
    var curA = which === "you" ? pc.youAn : which === "barb" ? pc.barbAn : pc.mayaAn;
    if (src !== "iphone" && src !== "off" && !(which === "barb" && src === "synth") && curS && curA && pc[devF] === src) {
      var re = el(audioElFor(which));
      if (re && !re.srcObject) {
        var rr = gainRoute(curS);
        if (which === "you") pc.youGain = rr ? rr.gain : pc.youGain;
        else if (which === "barb") pc.barbGain = rr ? rr.gain : pc.barbGain;
        else pc.mayaGain = rr ? rr.gain : pc.mayaGain;
        try { re.srcObject = rr ? rr.out : curS; } catch (e) {}
      }
      if (re) safePlay(re);
      applyFloorAudio();
      return curS;
    }
    dropStream(which);
    stopEl(audioElFor(which));
    if (!src || src === "off") return null;
    if (which === "barb" && src === "synth") return null;
    // THE iPHONE ROAD (src/js/livecomm.js): no getUserMedia here - Maya's
    // phone captured it and WebRTC carried it over. The stream is borrowed,
    // never owned: dropStream clears the refs without stopping its tracks.
    // With no call yet the seat ARMS and GO LIVE carries on - her call lands
    // on its own seat the moment she dials (takeIphoneCall, above).
    if ((which === "you" || which === "maya") && src === "iphone") {
      var rs = (window.livecomm && typeof window.livecomm.remoteStream === "function")
        ? window.livecomm.remoteStream() : null;
      if (!rs) {
        print(which === "maya"
          ? "TRICOMM :: MAYA'S SEAT IS ARMED FOR HER CALL - SHOW HER THE QR SQUARE; HER CALL LANDS ON ITS OWN SEAT."
          : "TRICOMM :: YOUR WIRELESS MIC IS ARMED - SCAN THE QR WITH THE SPARE PHONE; THE CALL LANDS ON YOUR SEAT.");
        return null;
      }
      return attachIphone(which, rs);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      print("TRICOMM :: " + seatName(which) + " WOULD NOT OPEN (NO CAPTURE ON THIS MACHINE).");
      return null;
    }
    try {
      var cons;
      if (which === "you") {
        cons = src === "default"
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { deviceId: { exact: src }, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      } else {
        cons = src === "default"
          ? true
          : { deviceId: { exact: src }, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      }
      var s = await navigator.mediaDevices.getUserMedia({ audio: cons });
      if (which === "you") { pc.youStream = s; pc.youAn = watch(s); pc.youBuf = new Uint8Array(512); }
      else if (which === "barb") { pc.barbStream = s; pc.barbAn = watch(s); pc.barbBuf = new Uint8Array(512); }
      else { pc.mayaStream = s; pc.mayaAn = watch(s); pc.mayaBuf = new Uint8Array(512); }
      if (which === "you") pc.youDev = src;
      else if (which === "barb") pc.barbDev = src;
      else pc.mayaDev = src;
      var routed = gainRoute(s);
      var g = routed ? routed.gain : null;
      if (which === "you") pc.youGain = g;
      else if (which === "barb") pc.barbGain = g;
      else pc.mayaGain = g;
      var a = el(audioElFor(which));
      if (a) {
        try { a.srcObject = routed ? routed.out : s; } catch (e) {}
        safePlay(a);
      }
      applyFloorAudio();
      return s;
    } catch (e) {
      print("TRICOMM :: " + seatName(which) + " WOULD NOT OPEN (" + String((e && e.name) || e).toUpperCase() + ").");
      return null;
    }
  }

  function dropStream(which) {
    var borrowed = (which === "you" && pc.youSrc === "iphone") || (which === "maya" && pc.mayaSrc === "iphone");
    var s = which === "you" ? pc.youStream : which === "barb" ? pc.barbStream : pc.mayaStream;
    if (s && !borrowed) { try { s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {} }
    if (which === "you") { pc.youStream = null; pc.youAn = null; pc.youGain = null; }
    else if (which === "barb") { pc.barbStream = null; pc.barbAn = null; pc.barbGain = null; }
    else { pc.mayaStream = null; pc.mayaAn = null; pc.mayaGain = null; }
    if (which === "you") pc.youDev = null;
    else if (which === "barb") pc.barbDev = null;
    else pc.mayaDev = null;
  }

  function safePlay(a) {
    // A play() still starting when pause() lands rejects its promise - catch it
    // at every call site so the engine never sees an unhandled rejection.
    try {
      var p = a ? a.play() : null;
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  function stopEl(id) {
    var a = el(id);
    if (!a) return;
    try { a.pause(); } catch (e) {}
    try { a.srcObject = null; } catch (e) {}
  }

  function hushBarb() {
    try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) {}
    try { var v = vox(); if (v && typeof v.stop === "function") v.stop(); } catch (e) {}
    try { var v2 = vox(); if (v2 && typeof v2.hush === "function") v2.hush(); } catch (e) {}
  }

  // Her mute is real: while live and muted, her replies never reach the
  // speaker - the wrapper holds them at the voice door itself. GUESTCOMM
  // holds them the same way: her master arm is off while the private line
  // is up, GO LIVE or TEST never wakes her mid-call.
  function ensureSpeakWrap() {
    var v = vox();
    if (!v || typeof v.speak !== "function" || v.speak.__tcWrapped) return;
    var orig = v.speak;
    var w = function (text, opts) {
      if ((pc.live && pc.barbMute) || pc.gcOn) {
        hushBarb();
        return Promise.resolve({ ok: false, error: "MUTED" });
      }
      return orig.call(v, text, opts);
    };
    w.__tcWrapped = true;
    w.__tcOrig = orig;
    v.speak = w;
  }

  function youGate() {
    // The iPhone road gates at the gain only (like Maya) - its tracks are
    // never touched here; livecomm owns them.
    if (pc.youSrc === "iphone") return;
    // Talkback holds his track open on any floor: the monitor and gate gains
    // still decide what his headphones hear, the talkback gain decides what
    // her ears hear - the enabled track alone is never audible anywhere.
    var on = (pc.live && pc.floor === "OPERATOR" && !pc.youMute && !!pc.youStream && pc.youSrc !== "off")
      || (pc.tbOn && !!pc.youStream && !pc.youMute && pc.youSrc !== "off");
    if (pc.youStream) pc.youStream.getAudioTracks().forEach(function (t) { try { t.enabled = on; } catch (e) {} });
  }

  function applyFloorAudio() {
    youGate();
    setGain(pc.youGain, (pc.live && pc.floor === "OPERATOR" && pc.youMon && !pc.youMute && pc.youStream) ? 1 : 0);
    setGain(pc.barbGain, (pc.live && pc.floor === "BARBELO" && pc.barbMon && !pc.barbMute && pc.barbStream) ? 1 : 0);
    // Pre-show the producer hears her while CHECK IN holds her road (below) -
    // on the air she only sounds on her own turn, as always. GUESTCOMM holds
    // the same private monitor.
    var mayaOpen = pc.live
      ? (pc.floor === "MAYA" && pc.mayaMon && !pc.mayaMute && pc.mayaStream)
      : ((pc.checkin || pc.gcOn) && pc.mayaMon && !pc.mayaMute && pc.mayaStream);
    setGain(pc.mayaGain, mayaOpen ? 1 : 0);
    // TALKBACK: his mic to her ears, live or not, on any floor. She never
    // hears herself - her road is nowhere in this bus.
    setGain(pc.tbGain, (pc.tbOn && pc.youStream && !pc.youMute && pc.youSrc !== "off") ? 1 : 0);
    if (pc.barbMute) hushBarb();
    // THE iPHONE ROAD's floor tap (src/js/livecomm.js): the desk-to-phone mix
    // and the uplink transcription follow the same floor. Guarded - her call
    // runs fine with the road missing.
    try { if (window.livecomm && window.livecomm.floorChanged) window.livecomm.floorChanged(pc.live ? pc.floor : ""); } catch (e) {}
  }

  function air() {
    try { if (vox() && typeof vox().air === "function") return String(vox().air()); } catch (e) {}
    return "STANDBY";
  }

  function setFloor(who) {
    pc.floor = who;
    pc.floorSince = Date.now();
    pc.heard = false;
    pc.lastVoice = 0;
    ensureSpeakWrap();
    applyFloorAudio();
    if (who === "OPERATOR") print("TRICOMM :: YOUR TURN - THE MIC IS LIVE. SPEAK AS USUAL - YOUR KEY, YOUR SEND.");
    else if (who === "MAYA") print("TRICOMM :: MAYA'S TURN - LISTEN.");
    else if (who === "BARBELO") print("TRICOMM :: BARBELO'S TURN - LISTEN.");
    paint();
  }

  function next() {
    if (!pc.live) return pc.floor;
    var i = ORDER.indexOf(pc.floor);
    setFloor(ORDER[(i + 1) % ORDER.length]);
    return pc.floor;
  }

  function tick() {
    if (!pc.live || !isOpen()) return;
    var now = Date.now();
    var a = air();
    if (pc.floor === "BARBELO") {
      if (pc.barbSrc !== "synth" && pc.barbSrc !== "off" && pc.barbAn) {
        var lb = rmsOf(pc.barbAn, pc.barbBuf);
        if (lb > 0.03) { pc.heard = true; pc.lastVoice = now; }
        else if (pc.heard && now - pc.lastVoice > 2500) next();
        else if (now - pc.floorSince > 45000) next();
      } else {
        if (a === "HER VOICE") pc.heard = true;
        else if (pc.heard) next();
        else if (now - pc.floorSince > 4000) next();
      }
    } else if (pc.floor === "MAYA") {
      var lv = pc.mayaAn ? rmsOf(pc.mayaAn, pc.mayaBuf) : 0;
      if (lv > 0.03) { pc.heard = true; pc.lastVoice = now; }
      else if (pc.heard && now - pc.lastVoice > 2500) next();
      else if (now - pc.floorSince > 45000) next();
    } else if (pc.floor === "OPERATOR") {
      if (a === "HER VOICE" || a === "HER TURN") next();
      else if (now - pc.floorSince > 120000) next();
    }
  }

  function paint() {
    var lamp = el("tcLamp");
    if (lamp && lamp.textContent !== pc.floor) {
      lamp.textContent = pc.floor;
      lamp.className = "lcLamp " + (pc.floor === "OPERATOR" ? "you" : pc.floor === "BARBELO" ? "her" : pc.floor === "MAYA" ? "busy" : "standby");
    }
    var bar = function (id, v) {
      var e = el(id);
      if (e) e.style.width = Math.max(0, Math.min(100, Math.round(v * 400))) + "%";
    };
    // Meters are pre-mute taps: they prove the signal is hitting the system
    // even while the seat's MUTE holds its headphones silent.
    bar("tcYouFill", pc.youAn ? rmsOf(pc.youAn, pc.youBuf) : 0);
    var bb = 0;
    if (pc.barbSrc !== "synth" && pc.barbSrc !== "off" && pc.barbAn) bb = rmsOf(pc.barbAn, pc.barbBuf);
    else { try { if (vox() && typeof vox().level === "function") bb = Number((vox().level() || {}).rms) || 0; } catch (e) {} }
    bar("tcBarbFill", bb);
    bar("tcMayaFill", pc.mayaAn ? rmsOf(pc.mayaAn, pc.mayaBuf) : 0);
    syncButtons();
    var fs = el("tcFloorState");
    if (fs) {
      var t = pc.live
        ? ("FLOOR: " + pc.floor + " - ONE HOLDS IT, TWO LISTEN"
          + (pc.youMute ? " - YOU MUTED" : "")
          + (pc.barbMute ? " - BARBELO MUTED" : "")
          + (pc.mayaMute ? " - MAYA MUTED" : ""))
        : pc.gcOn
        ? "GUESTCOMM: PRIVATE - YOU AND MAYA, BARBELO DARK"
        : pc.checkin
        ? ("GUEST: " + (pc.guestSeen ? "ON THE LINE - GO LIVE WHEN READY" : "WAITING - HER METER MOVES WHEN SHE TALKS"))
        : "STOOD DOWN";
      if (fs.textContent !== t) fs.textContent = t;
    }
  }

  function paintLoop() {
    if (!isOpen()) { pc.paintTimer = 0; return; }
    try { paint(); } catch (e) {}
    pc.paintTimer = setTimeout(paintLoop, 250);
  }

  function tickLoop() {
    if (!pc.live) { pc.tickTimer = 0; return; }
    try { tick(); } catch (e) {}
    pc.tickTimer = setTimeout(tickLoop, 250);
  }

  function isOpen() { var p = el("tricomPanel"); return !!(p && !p.hidden); }

  function closeOthers() {
    try { if (window.liacomm && window.liacomm.isOpen && window.liacomm.isOpen()) window.liacomm.close(); } catch (e) {}
    try { if (window.duet && window.duet.isOpen && window.duet.isOpen()) window.duet.close(); } catch (e) {}
    try { if (window.guest && window.guest.isOpen && window.guest.isOpen()) window.guest.close(); } catch (e) {}
  }

  var homeParent = null, homeNext = null;
  function setCenter(on) {
    on = !!on;
    var p = el("tricomPanel"), row = el("stageRow"), out = el("output");
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
    try { document.body.classList.toggle("tricomCenter", on); } catch (e) {}
    return on;
  }

  function show() {
    var p = el("tricomPanel");
    if (!p) return false;
    closeOthers();
    setCenter(true);
    p.hidden = false;
    wire();
    ensureSpeakWrap();
    savedGet().then(function () { refreshDevices(); });
    if (!pc.paintTimer) paintLoop();
    paint();
    return true;
  }

  function close() {
    setCenter(false);
    var p = el("tricomPanel");
    if (p) p.hidden = true;
  }

  function toggle() {
    if (isOpen()) { close(); return false; }
    return show();
  }

  // THE PRODUCER WAITS: CHECK IN opens her road before the show - meter live,
  // monitor open in your headphones - and watches for her signal. Her first
  // real voice flips the room to GUEST ON THE LINE. GO LIVE then re-takes her
  // already-open road gaplessly (openSeat keeps a live road, above). CHECK IN
  // is for the wired guest road (iRIG) - the QR call lands on its own seat.
  async function checkGuest(on) {
    if (on === false || (on !== true && pc.checkin)) {
      pc.checkin = false;
      if (pc.checkTimer) { clearTimeout(pc.checkTimer); pc.checkTimer = 0; }
      dropStream("maya");
      stopEl("tcMayaAudio");
      pc.guestSeen = false;
      applyFloorAudio();
      paint();
      print("TRICOMM :: GUEST WATCH OFF - HER ROAD IS DARK.");
      return false;
    }
    if (!pc.mayaSrc || pc.mayaSrc === "off") { print("TRICOMM :: PICK HER ROAD FIRST - THE iRIG LINE IN HER DROPDOWN, THEN CHECK IN."); return false; }
    if (pc.mayaSrc === "iphone") { print("TRICOMM :: HER SEAT RIDES THE QR CALL - CHECK IN IS FOR THE WIRED GUEST ROAD (iRIG)."); return false; }
    if (pc.live) { print("TRICOMM :: ALREADY LIVE - HER METER IS UP AND THE GATE HAS HER."); return true; }
    if (guestLineUp()) { print("TRICOMM :: THE GUEST LINE HOLDS HER ROAD - HANG IT UP FIRST."); return false; }
    pc.checkin = true;
    pc.guestSeen = false;
    var s = await openSeat("maya");
    if (!s) { pc.checkin = false; paint(); return false; }
    print("TRICOMM :: WAITING ON THE GUEST - HER METER IS LIVE AND SHE IS IN YOUR HEADPHONES. TALK INTO THE iRIG LINE.");
    if (!pc.checkTimer) checkLoop();
    paint();
    return true;
  }

  function checkLoop() {
    if (!pc.checkin || pc.live) { pc.checkTimer = 0; return; }
    try {
      var lv = pc.mayaAn ? rmsOf(pc.mayaAn, pc.mayaBuf) : 0;
      if (!pc.guestSeen && lv > 0.03) {
        pc.guestSeen = true;
        print("TRICOMM :: GUEST ON THE LINE - GO LIVE WHEN READY.");
      }
    } catch (e) {}
    try { paint(); } catch (e) {}
    pc.checkTimer = setTimeout(checkLoop, 250);
  }

  // TALKBACK: the producer answers. His mic rides a bus of its own to the
  // guest output (the iRIG line back down the wire) - live or not, on any
  // floor. The bus carries his mic and nothing else, so she never hears
  // herself back. The feed element's sink is the chosen output; without one
  // it plays the default output like any monitor.
  function outLabel(id) {
    if (!id) return "";
    for (var i = 0; i < pc.outDevs.length; i++) {
      if ((pc.outDevs[i].id || "") === id) return String(pc.outDevs[i].label || "OUTPUT").toUpperCase().slice(0, 40);
    }
    return "";
  }

  function applySink() {
    var f = el("tcGuestFeed");
    if (!f || typeof f.setSinkId !== "function") return;
    try {
      var p = f.setSinkId(pc.tbOut || "");
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  function ensureTalkback() {
    if (!pc.youStream) return false;
    var c = actx();
    if (!c) return false;
    if (!pc.tbGain || pc.tbStream !== pc.youStream) {
      try { if (pc.tbSrc) pc.tbSrc.disconnect(); } catch (e) {}
      try { if (pc.tbGain) pc.tbGain.disconnect(); } catch (e) {}
      try { if (pc.tbAn) pc.tbAn.disconnect(); } catch (e) {}
      pc.tbGain = null; pc.tbAn = null; pc.tbBuf = null;
      try {
        pc.tbSrc = c.createMediaStreamSource(pc.youStream);
        pc.tbGain = c.createGain();
        pc.tbGain.gain.value = 0;
        pc.tbAn = c.createAnalyser();
        pc.tbAn.fftSize = 512;
        pc.tbBuf = new Uint8Array(512);
        var dest = c.createMediaStreamDestination();
        pc.tbSrc.connect(pc.tbGain);
        pc.tbGain.connect(dest);
        pc.tbGain.connect(pc.tbAn);
        pc.tbStream = pc.youStream;
        var f = el("tcGuestFeed");
        if (f) {
          try { f.srcObject = dest.stream; } catch (e) {}
          safePlay(f);
          applySink();
        }
      } catch (e) { return false; }
    }
    return !!pc.tbGain;
  }

  function tbLevel() {
    return (pc.tbAn && pc.tbBuf) ? rmsOf(pc.tbAn, pc.tbBuf) : 0;
  }

  async function setTalkback(on) {
    if (on === false || (on !== true && pc.tbOn)) {
      pc.tbOn = false;
      applyFloorAudio();
      paint();
      print("TRICOMM :: TALKBACK OFF - SHE NO LONGER HEARS YOUR MIC.");
      return false;
    }
    if (!pc.youSrc || pc.youSrc === "off") { print("TRICOMM :: YOUR SEAT IS OFF - PICK YOUR MIC FIRST, THEN TALKBACK."); return false; }
    if (guestLineUp()) { print("TRICOMM :: THE GUEST LINE HOLDS HER EARS - TALKBACK WOULD DOUBLE-FEED HER."); return false; }
    if (!pc.youStream) {
      var s = await openSeat("you");
      if (!s) return false;
    }
    if (!ensureTalkback()) { print("TRICOMM :: TALKBACK WOULD NOT OPEN ON THIS MACHINE."); return false; }
    applySink();
    pc.tbOn = true;
    applyFloorAudio();
    paint();
    var where = outLabel(pc.tbOut);
    print("TRICOMM :: TALKBACK ON - YOUR MIC FEEDS HER EARS" + (where ? " ON " + where : " (DEFAULT OUTPUT)") + ".");
    return true;
  }

  // GUESTCOMM: the private line. Producer and guest, two-way over the iRIG,
  // off the air - her signal in his headphones, his mic on her ears, and
  // Barbelo dark the whole time (her master arm stays off: replies hold at
  // the voice door, monitor stays shut). Both roads stay open underneath, so
  // GO LIVE afterwards re-takes them gaplessly. Never live together: the
  // floor refuses while the private line is up, and vice versa.
  // One holder of her ears at a time: the standalone guest line and these
  // roads refuse while each other holds her.
  function guestLineUp() {
    try { if (window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()) return true; } catch (e) {}
    return false;
  }

  async function setGuestcomm(on) {
    if (on === false || (on !== true && pc.gcOn)) {
      pc.gcOn = false;
      pc.tbOn = false;
      applyFloorAudio();
      paint();
      print("TRICOMM :: GUESTCOMM OFF - THE PRIVATE LINE IS DARK. HER ROAD STAYS OPEN FOR THE SHOW.");
      return false;
    }
    if (pc.live) { print("TRICOMM :: STAND DOWN FIRST - GUESTCOMM IS PRIVATE, OFF THE AIR."); return false; }
    if (guestLineUp()) { print("TRICOMM :: THE GUEST LINE HOLDS HER - HANG IT UP FIRST."); return false; }
    if (!pc.mayaSrc || pc.mayaSrc === "off") { print("TRICOMM :: PICK HER ROAD FIRST - THE iRIG LINE IN HER DROPDOWN."); return false; }
    if (pc.mayaSrc === "iphone") { print("TRICOMM :: HER SEAT RIDES THE QR CALL - GUESTCOMM IS THE WIRED GUEST ROAD (iRIG)."); return false; }
    if (!pc.youSrc || pc.youSrc === "off") { print("TRICOMM :: YOUR SEAT IS OFF - PICK YOUR MIC FIRST."); return false; }
    var m = pc.mayaStream || await openSeat("maya");
    if (!m) return false;
    var y = pc.youStream || await openSeat("you");
    if (!y) return false;
    if (!ensureTalkback()) { print("TRICOMM :: TALKBACK WOULD NOT OPEN ON THIS MACHINE."); return false; }
    applySink();
    pc.checkin = false;
    if (pc.checkTimer) { clearTimeout(pc.checkTimer); pc.checkTimer = 0; }
    ensureSpeakWrap();
    hushBarb();
    pc.tbOn = true;
    pc.gcOn = true;
    applyFloorAudio();
    paint();
    print("TRICOMM :: GUESTCOMM ON - PRIVATE, YOU AND MAYA OVER THE iRIG. BARBELO IS DARK.");
    return true;
  }

  async function goLive() {
    if (pc.gcOn) { print("TRICOMM :: GUESTCOMM IS PRIVATE - TAKE IT OFF FIRST, THEN GO LIVE."); return false; }
    if (guestLineUp()) { print("TRICOMM :: THE GUEST LINE HOLDS HER - HANG IT UP FIRST, THEN GO LIVE."); return false; }
    actx();
    ensureSpeakWrap();
    pc.youSrc = selectedVal("tcYouSrc") || pc.youSrc;
    pc.barbSrc = selectedVal("tcBarbSrc") || pc.barbSrc;
    pc.mayaSrc = selectedVal("tcMayaSrc") || pc.mayaSrc;
    await savedSet();
    await openSeat("you");
    if (pc.barbSrc !== "synth" && pc.barbSrc !== "off") await openSeat("barb");
    else { dropStream("barb"); stopEl("tcBarbAudio"); }
    if (pc.mayaSrc !== "off") await openSeat("maya");
    else {
      dropStream("maya"); stopEl("tcMayaAudio");
      print("TRICOMM :: MAYA IS OFF - PICK THE ROAD HER VOICE ARRIVES ON (THE PHONE-FED INPUT, NEVER YOUR OWN MIC).");
    }
    pc.live = true;
    if (!pc.tickTimer) tickLoop();
    // Her road stays open under the show: the watch ends, the stream carries on.
    pc.checkin = false;
    if (pc.checkTimer) { clearTimeout(pc.checkTimer); pc.checkTimer = 0; }
    setFloor("BARBELO");
    print("TRICOMM :: LIVE - THE GATE TURNS BARBELO, MAYA, YOU. YOUR MIC GOES TO THE BROWSER ONLY ON YOUR TURN - NOWHERE NEAR YOUR EARS UNLESS YOUR MON IS ON.");
    return true;
  }

  function standDown() {
    pc.live = false;
    if (pc.tickTimer) { clearTimeout(pc.tickTimer); pc.tickTimer = 0; }
    pc.checkin = false;
    if (pc.checkTimer) { clearTimeout(pc.checkTimer); pc.checkTimer = 0; }
    pc.guestSeen = false;
    // The mics are dead: talkback with them. She keeps the room as it was.
    pc.tbOn = false;
    // So is the private line: its roads drop with the rest.
    pc.gcOn = false;
    dropStream("you");
    dropStream("barb");
    dropStream("maya");
    stopEl("tcYouAudio");
    stopEl("tcBarbAudio");
    stopEl("tcMayaAudio");
    pc.floor = "STANDBY";
    print("TRICOMM :: STOOD DOWN - THE MICS ARE DEAD, THE ROOM STAYS AS IT WAS.");
    try { if (window.livecomm && window.livecomm.floorChanged) window.livecomm.floorChanged(""); } catch (e) {}
    paint();
  }

  function streamOf(which) {
    if (which === "barb") return pc.barbStream;
    if (which === "maya") return pc.mayaStream;
    return pc.youStream;
  }

  function seats() {
    return {
      live: pc.live, floor: pc.floor, open: isOpen(),
      you: { src: pc.youSrc, mute: pc.youMute, mon: pc.youMon, stream: !!pc.youStream },
      barbelo: { src: pc.barbSrc, mute: pc.barbMute, mon: pc.barbMon, stream: !!pc.barbStream },
      maya: { src: pc.mayaSrc, mute: pc.mayaMute, mon: pc.mayaMon, stream: !!pc.mayaStream },
      checkin: pc.checkin, guestSeen: pc.guestSeen,
      tbOn: pc.tbOn, tbOut: outLabel(pc.tbOut), tbLevel: tbLevel(),
      gcOn: pc.gcOn,
      inputs: pc.devs.length
    };
  }

  var wired = false;
  var devTimer = 0;
  function wire() {
    if (!wired) {
      wired = true;
      try {
        if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
          navigator.mediaDevices.addEventListener("devicechange", function () {
            if (devTimer) clearTimeout(devTimer);
            devTimer = setTimeout(function () { try { if (isOpen()) refreshDevices(); } catch (e) {} }, 800);
          });
        } else if (navigator.mediaDevices) {
          try { navigator.mediaDevices.ondevicechange = function () { try { if (isOpen()) refreshDevices(); } catch (e) {} }; } catch (e) {}
        }
      } catch (e) {}
    }
    var on = function (id, fn) {
      var b = el(id);
      if (b && !b.__tc) { b.__tc = true; b.addEventListener("click", fn); }
    };
    var ch = function (id, fn) {
      var s = el(id);
      if (s && !s.__tc) { s.__tc = true; s.addEventListener("change", fn); }
    };
    on("tcGo", function () { goLive(); });
    on("tcStand", function () { standDown(); });
    on("tcCheckin", function () { checkGuest(); });
    on("tcTalkback", function () { setTalkback(); });
    on("tcGuestcomm", function () { setGuestcomm(); });
    on("tcClose", function () { close(); });
    on("tcRefresh", function () { refreshDevices(); });
    on("tcNext", function () {
      if (!pc.live) { print("TRICOMM :: NOT LIVE - GO LIVE FIRST."); return; }
      print("TRICOMM :: TURN TAKEN - " + next() + " HAS IT.");
    });
    on("tcYouMute", function () {
      pc.youMute = !pc.youMute;
      applyFloorAudio();
      paint();
    });
    on("tcBarbMute", function () {
      pc.barbMute = !pc.barbMute;
      ensureSpeakWrap();
      applyFloorAudio();
      paint();
      print(pc.barbMute
        ? "TRICOMM :: BARBELO MUTED - HER SEAT IS SILENT IN YOUR HEADPHONES AND HER REPLIES HOLD SILENT WHILE LIVE."
        : "TRICOMM :: BARBELO UNMUTED - HER SEAT SPEAKS ON HER TURN.");
    });
    on("tcMayaMute", function () {
      pc.mayaMute = !pc.mayaMute;
      applyFloorAudio();
      paint();
    });
    on("tcYouMon", function () {
      pc.youMon = !pc.youMon;
      savedSet();
      try { var a = el("tcYouAudio"); if (a && pc.youMon) safePlay(a); } catch (e) {}
      applyFloorAudio();
      paint();
      if (pc.youMon) print("TRICOMM :: YOUR MIC FEEDS YOUR HEADPHONES ON YOUR TURN - WEAR THEM, OR IT SINGS.");
    });
    on("tcBarbMon", function () {
      pc.barbMon = !pc.barbMon;
      savedSet();
      try { var a2 = el("tcBarbAudio"); if (a2 && pc.barbMon) safePlay(a2); } catch (e) {}
      applyFloorAudio();
      paint();
    });
    on("tcMayaMon", function () {
      pc.mayaMon = !pc.mayaMon;
      savedSet();
      try { var a3 = el("tcMayaAudio"); if (a3) safePlay(a3); } catch (e) {}
      applyFloorAudio();
      paint();
    });
    on("tcBarbHush", function () {
      hushBarb();
      paint();
    });
    on("tcBarbTest", function () {
      if (pc.live && pc.barbMute) { print("TRICOMM :: BARBELO IS MUTED - UNMUTE HER SEAT FIRST."); return; }
      try {
        if (vox() && typeof vox().speak === "function") vox().speak("The floor is live. One speaks, two are silent.");
        else if (typeof speechSynthesis !== "undefined") {
          var u = new SpeechSynthesisUtterance("The floor is live. One speaks, two are silent.");
          speechSynthesis.speak(u);
        }
      } catch (e) {}
    });
    ch("tcYouSrc", function () {
      pc.youSrc = selectedVal("tcYouSrc") || "default";
      savedSet();
      if (pc.live) goLive();
    });
    ch("tcBarbSrc", function () {
      pc.barbSrc = selectedVal("tcBarbSrc") || "synth";
      savedSet();
      if (pc.live) goLive();
    });
    ch("tcMayaSrc", function () {
      pc.mayaSrc = selectedVal("tcMayaSrc") || "off";
      savedSet();
      if (pc.live) goLive();
    });
    ch("tcTbOut", function () {
      pc.tbOut = selectedVal("tcTbOut") || "";
      savedSet();
      applySink();
      paint();
    });
  }

  function shortSrc(which) {
    var s = srcOf(which);
    if (s === "off") return "OFF";
    if (s === "synth") return "SYNTH";
    if (s === "default") return "DEFAULT";
    if (s === "iphone") return "IPHONE";
    for (var i = 0; i < pc.devs.length; i++) {
      if ((pc.devs[i].id || "") === s) return String(pc.devs[i].label || "INPUT").toUpperCase().slice(0, 28);
    }
    return String(s).slice(0, 12) + "...";
  }

  async function words(arg) {
    var t = String(arg || "").trim().toLowerCase();
    if (!t || t === "open") { show(); return "TRICOMM :: THE FLOOR PAGE IS OPEN."; }
    if (t === "close") { close(); return "TRICOMM :: CLOSED."; }
    if (t === "go") { show(); var ok = await goLive(); return ok ? "TRICOMM :: LIVE." : "TRICOMM :: WOULD NOT GO LIVE - SEE ABOVE."; }
    if (t === "stand") { standDown(); return "TRICOMM :: STOOD DOWN."; }
    if (t === "checkin" || t === "check-in" || t === "wait" || t === "guest") {
      show();
      var cg = await checkGuest();
      return cg ? "TRICOMM :: WAITING ON THE GUEST." : "TRICOMM :: GUEST WATCH OFF.";
    }
    if (t === "checkin off" || t === "wait off" || t === "guest off") { show(); await checkGuest(false); return "TRICOMM :: GUEST WATCH OFF."; }
    if (t === "talkback" || t === "tb") {
      show();
      var tb = await setTalkback();
      return tb ? "TRICOMM :: TALKBACK ON." : "TRICOMM :: TALKBACK OFF.";
    }
    if (t === "talkback off" || t === "tb off") { show(); await setTalkback(false); return "TRICOMM :: TALKBACK OFF."; }
    if (t === "guestcomm" || t === "gc") {
      show();
      var gc = await setGuestcomm();
      return gc ? "TRICOMM :: GUESTCOMM ON - PRIVATE." : "TRICOMM :: GUESTCOMM OFF.";
    }
    if (t === "guestcomm off" || t === "gc off") { show(); await setGuestcomm(false); return "TRICOMM :: GUESTCOMM OFF."; }
    if (t === "next") {
      if (!pc.live) return "TRICOMM :: NOT LIVE.";
      return "TRICOMM :: " + next() + " HAS IT.";
    }
    if (t === "status") {
      var s = seats();
      return "TRICOMM :: " + (s.open ? "OPEN" : "CLOSED")
        + " - " + (s.live ? ("LIVE, FLOOR " + s.floor) : "STOOD DOWN")
        + (!s.live && s.maya.stream ? (s.guestSeen ? " - GUEST ON THE LINE" : " - GUEST ARMED") : "")
        + (!s.live && s.gcOn ? " - GUESTCOMM PRIVATE" : "")
        + " - TALKBACK " + (s.tbOn ? "ON" + (s.tbOut ? " (" + s.tbOut + ")" : "") : "OFF")
        + " - YOU " + shortSrc("you") + (s.you.mute ? " MUTED" : " OPEN") + (s.you.mon ? " MON-ON" : "")
        + " - BARBELO " + shortSrc("barb") + (s.barbelo.mute ? " MUTED" : "") + (s.barbelo.mon ? "" : " MON-OFF")
        + " - MAYA " + shortSrc("maya") + (s.maya.mute ? " MUTED" : " OPEN") + (s.maya.mon ? "" : " MON-OFF")
        + " - " + s.inputs + " INPUTS.";
    }
    return "TRICOMM :: /tricom open|go|checkin|talkback|guestcomm|next|stand|close|status - THE GATE TURNS BARBELO, MAYA, YOU.";
  }

  function describe() {
    return ["THE FLOOR :: you, Barbelo, and Maya, one at a time - the gate turns BARBELO, MAYA, YOU.",
      "  EACH SEAT OWNS ITS ROAD: the dropdown picks which connected input feeds it (hers defaults to her synthetic voice, yours to your default mic or IPHONE WIRELESS once the QR call is on the line, Maya's to OFF until you pick the phone-fed input - never your own mic).",
      "  EACH SEAT OWNS A METER: it reads the signal hitting the system, mute or no mute - so a muted seat still proves its road is live.",
      "  EACH SEAT OWNS A MUTE: hard silence for that seat, so the three roads isolate one by one. Hers hushes her at once and holds her replies silent while live.",
      "  EACH SEAT OWNS A MONITOR: whether its road plays into your headphones on its turn. Yours ships OFF (your mic in your own ears sings) - switch it on to check the road, wearing headphones.",
      "  BARBELO HAS IT :: she speaks, you and Maya listen. MAYA HAS IT :: her road plays in your headset. YOU HAVE IT :: your mic goes to the browser and nowhere else unless your MON is on. Her answer takes her turn.",
      "  Turns pass on their own (her voice ending, Maya's quiet, her answer starting) or by NEXT TURN.",
      "  CHECK IN is the producer's wait: it opens her road before the show with meter and monitor live, watches for her signal, and calls GUEST ON THE LINE when she talks - GO LIVE then takes her already-open road gaplessly. /tricom checkin.",
      "  TALKBACK is the producer's answer: his mic to her ears on the guest output (the iRIG line back down the wire), live or not, on any floor - the bus carries his mic and nothing else, so she never hears herself. /tricom talkback.",
      "  GUESTCOMM is the private line: producer and guest two-way over the iRIG, off the air - her in his headphones, his mic on her ears, Barbelo dark throughout (her master arm stays off). GO LIVE refuses while it is up, and it refuses while live. /tricom guestcomm.",
      "  Maya is a local input only: never sent, never recorded.",
      "  /tricom open|go|checkin|talkback|guestcomm|next|stand|close|status."].join("\n");
  }

  function floor() { return pc.live ? pc.floor : ""; }

  return {
    show: show, close: close, toggle: toggle,
    isOpen: function () { return isOpen(); },
    words: words, describe: describe, status: function () { return words("status"); },
    goLive: goLive, standDown: standDown, next: next, floor: floor,
    checkin: checkGuest,
    talkback: setTalkback,
    guestcomm: setGuestcomm,
    refresh: refreshDevices, seats: seats, streamOf: streamOf,
    takeIphoneCall: takeIphoneCall, clearIphoneCall: clearIphoneCall
  };
})();
