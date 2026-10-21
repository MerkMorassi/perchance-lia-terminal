window.livecomm = (function () {
  "use strict";

  /* ---- LIVECOMM --------------------------------------------------------------
     THE iPHONE ROAD: the iPhone becomes a wireless mic over a QR code, and its
     audio lands on the TRICOMM YOU seat as IPHONE WIRELESS - metered, muted and
     monitored like any input, under the same rotating gate.
     Ported from Mythos-Live-Comm (the mic capture, the PTT/continuous gating,
     the WebRTC offer/answer/ICE flow, the STUN list) and re-homed: their bun
     server cannot be reached from an https generator page (a ws:// to a LAN IP
     is mixed-content-blocked, and only loopback is exempt), so signaling rides
     the PAIR room (kind "r" frames, beside "v") and the audio rides WebRTC
     peer-to-peer over the same wifi - no server, nothing leaves the LAN.
     Deliberately NOT ported: their server, its GEMINI key endpoint (a secret
     that stays server-side and never ships in generator source), transcripts,
     TTS triggers, turn personas and battery - the terminal already has her.
     Host: QR (drawn on this device, holds the generator URL + the pair code -
     the same secrecy as the pair code itself) -> iPhone camera opens it ->
     the phone joins the pair room and offers -> this page answers by itself.
     Phone (?mic=1&code=... boot): a headless key - PTT + LOCK + MUTE, nothing
     else. Capture starts on the first press (iOS demands the gesture).
     --------------------------------------------------------------------------- */

  function el(id) { return document.getElementById(id); }
  function print(t) { if (typeof window.print === "function" && t) window.print("SYSTEM", t); }
  function pair() { return window.pair || null; }
  function hs() { var p = pair(); return (p && p.harness) || null; }

  var RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  var micMode = null;         // null until boot decides; true = this device is the phone
  var wireTries = 0, wired = false;
  var hostPc = null, hostPeer = "", hostIceQ = [], hostRemoteDesc = false;
  var hostStream = null;

  // NORMAL AUDIO IS SACRED: the desk-to-phone mix, her tap and the mic source
  // exist ONLY while an iPhone call is armed (an offer being answered or audio
  // on the line). With no call every tap is a no-op and no AudioContext is
  // ever created - her voice plays exactly as before, his mic is untouched.
  // PRIVATE MODE (2026-10-21): while the GUESTCOMM line is up the only road
  // is HITL<>MAYA over the iRig - her signal in his ears, his mic on hers.
  // Every road here would hand the call to Barbelo (her tap tees her voice
  // to the phone, the downlink carries the desk mix, the uplink files takes
  // down her lanes), so all of it refuses while the line is up - and the
  // line refuses while a call here holds her.
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }
  function guestLine() { return "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. HANG IT UP FIRST - HITL<>MAYA ONLY WHILE IT IS UP."; }

  function callArmed() { return !!(hostPc || hostStream); }
  var phonePc = null, phoneIceQ = [], phoneRemoteDesc = false;
  var phoneStream = null, phoneReady = false, phonePeerSeen = false;
  var phonePtt = false, phoneLock = false, phoneMute = false;
  var phonePoll = 0, phoneJoined = false;
  var qrOpen = false;

  function myId() {
    try { var h = hs(); if (h && h.deviceId) return String(h.deviceId() || ""); } catch (e) {}
    return "";
  }

  function sendR(target, type, obj) {
    var h = hs();
    if (!h || !h.publishRaw || !h.frame) return false;
    try {
      var json = JSON.stringify(obj || {});
      return h.publishRaw(h.frame("r", [myId(), target || "", type, json])) === true
        || !!h.publishRaw(h.frame("r", [myId(), target || "", type, json]));
    } catch (e) { return false; }
  }

  function newPc() {
    var pc = new RTCPeerConnection(RTC_CONFIG);
    return pc;
  }

  function flushIce(pc, q) {
    if (!pc || !q || !q.length) return;
    var list = q.slice(0);
    q.length = 0;
    list.forEach(function (c) {
      try { pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
    });
  }

  // ---- HOST -----------------------------------------------------------------

  async function ensureRoom() {
    var p = pair();
    if (!p) { print("LIVECOMM :: THE PAIR ROAD IS OFFLINE (src/js/pair.js)."); return false; }
    var st = null;
    try { st = p.state(); } catch (e) {}
    if (st && st.open) return true;
    try {
      if (st && st.code) await p.run("open");
      else await p.run("new");
    } catch (e) {}
    try { st = p.state(); } catch (e) {}
    return !!(st && st.open);
  }

  function micUrl() {
    var h = hs(), p = pair();
    if (!h || !p) return "";
    var raw = "";
    try { raw = h.codeNorm(p.code()); } catch (e) {}
    if (!raw) return "";
    var name = "";
    try { name = String(window.generatorName || ""); } catch (e) {}
    if (!name) return "";
    return "https://perchance.org/" + name + "?mic=1&code=" + raw;
  }

  function needQrLib() {
    return new Promise(function (resolve) {
      var ok = false;
      try { ok = !!window.qrcode; } catch (e) {}
      if (ok) { resolve(true); return; }
      var s = document.createElement("script");
      s.src = "src/js/qrcode.js"; s.async = true;
      s.onload = function () { var good = false; try { good = !!window.qrcode; } catch (e) {} resolve(good); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function showQr() {
    var cv = el("tcQr");
    if (!cv) return false;
    if (guestUp()) { print(guestLine() + " NO SECOND CALL WHILE IT IS UP."); return false; }
    if (qrOpen) {
      try { cv.hidden = true; } catch (e) {}
      var b0 = el("tcQRShow");
      if (b0 && b0.textContent !== "QR") b0.textContent = "QR";
      qrOpen = false;
      paintPhone();
      return true;
    }
    var okRoom = await ensureRoom();
    if (!okRoom) { print("LIVECOMM :: NO ROOM - THE PAIR SOCKET REFUSED. /pair open SAYS MORE."); return false; }
    // A press is the gesture the mix needs - built now, before any offer.
    try { ensureDownlink(); } catch (e) {}
    var url = micUrl();
    if (!url) { print("LIVECOMM :: NO CODE ON THIS DEVICE - /pair new MINTS ONE."); return false; }
    var okLib = await needQrLib();
    if (!okLib) { print("LIVECOMM :: THE QR DRAWER WOULD NOT LOAD - TYPE THIS ON THE iPHONE: " + url); return false; }
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      var n = qr.getModuleCount(), quiet = 4;
      var scale = Math.max(4, Math.floor(224 / (n + quiet * 2)));
      cv.width = cv.height = (n + quiet * 2) * scale;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#000";
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
      cv.hidden = false;
      qrOpen = true;
      var b = el("tcQRShow");
      if (b) b.textContent = "HIDE";
      var p = pair(), pretty = "";
      try { pretty = p.code(); } catch (e) {}
      print("LIVECOMM :: MAYA POINTS HER iPHONE CAMERA AT THE SQUARE - IT OPENS HER WIRELESS KEY BY ITSELF (SAME WIFI AS THIS DESK). THE CODE IS " + pretty + " - IT CARRIES THE SAME SECRECY AS A PAIR CODE.");
      paintPhone();
      return true;
    } catch (e) {
      print("LIVECOMM :: THE SQUARE WOULD NOT DRAW - TYPE THIS ON THE iPHONE: " + url);
      return false;
    }
  }

  function hostOnFields(fields, from) {
    var sender = String(fields[0] || from || "");
    var target = String(fields[1] || "");
    var type = String(fields[2] || "");
    if (target && target !== myId()) return;
    if (type === "offer") hostOnOffer(sender, fields[3] || "{}");
    else if (type === "answer") hostOnAnswer(sender, fields[3] || "{}");
    else if (type === "ice") hostOnIce(fields[3] || "{}");
    else if (type === "bye" && sender && sender === hostPeer) hostDrop("THE iPHONE HUNG UP.");
  }

  async function hostOnOffer(sender, json) {
    var data = null;
    try { data = JSON.parse(json); } catch (e) { return; }
    if (!data || !data.sdp) return;
    if (guestUp()) { print(guestLine() + " THE iPHONE CALL WAS NOT ANSWERED."); return; }
    hostDrop(true);
    try {
      var pc = newPc();
      hostPc = pc;
      hostPeer = sender;
      hostIceQ = [];
      hostRemoteDesc = false;
      // The desk-to-phone mix rides from the answer onward - built on the QR
      // press gesture, so no renegotiation mid-call.
      try {
        ensureDownlink();
        refreshMicSource();
        if (downTrack) pc.addTrack(downTrack, downMix.stream);
        ensureFeeder();
      } catch (e) {}
      pc.onicecandidate = function (ev) {
        if (ev && ev.candidate) sendR(sender, "ice", { candidate: ev.candidate });
      };
      pc.ontrack = function (ev) {
        if (ev && ev.streams && ev.streams[0]) {
          hostStream = ev.streams[0];
          // MAYA CALLS IN: her call lands straight on her TRICOMM seat - no
          // second press from him. takeIphoneCall picks her armed seat.
          var seat = null;
          try { if (window.tricom && typeof window.tricom.takeIphoneCall === "function") seat = window.tricom.takeIphoneCall(hostStream); } catch (e) {}
          print(seat === "maya"
            ? "LIVECOMM :: MAYA IS ON THE LINE - HER SEAT HAS THE CALL."
            : seat === "you"
            ? "LIVECOMM :: THE SPARE MIC IS ON THE LINE - YOUR SEAT HAS IT."
            : "LIVECOMM :: THE iPHONE IS ON THE LINE - PICK IPHONE ON MAYA'S SEAT.");
          paintPhone();
        }
      };
      pc.onconnectionstatechange = function () {
        try {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") hostDrop(true);
        } catch (e) {}
        paintPhone();
      };
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      hostRemoteDesc = true;
      flushIce(pc, hostIceQ);
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendR(sender, "answer", { sdp: pc.localDescription });
      paintPhone();
    } catch (e) {
      hostDrop(true);
    }
  }

  async function hostOnAnswer(sender, json) {
    if (!hostPc || (hostPeer && sender !== hostPeer)) return;
    var data = null;
    try { data = JSON.parse(json); } catch (e) { return; }
    if (!data || !data.sdp) return;
    try {
      await hostPc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      hostRemoteDesc = true;
      flushIce(hostPc, hostIceQ);
    } catch (e) {}
  }

  function hostOnIce(json) {
    if (!hostPc) return;
    var data = null;
    try { data = JSON.parse(json); } catch (e) { return; }
    if (!data || !data.candidate) return;
    if (!hostRemoteDesc) { hostIceQ.push(data.candidate); return; }
    try { hostPc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
  }

  function hostDrop(silent) {
    if (hostPc) { try { hostPc.close(); } catch (e) {} hostPc = null; }
    hostPeer = "";
    hostIceQ = [];
    hostRemoteDesc = false;
    try { upFinalize(true); } catch (e) {}
    up.lane = "";
    try { if (downFeeder) downFeeder.port.postMessage({ op: "clear" }); } catch (e) {}
    try {
      if (downCtx) {
        downMicGain.gain.value = 0;
        downBarbGain.gain.value = 0;
      }
    } catch (e) {}
    // Her seat lets go of the dead stream first; the tracks stop after.
    try { if (window.tricom && typeof window.tricom.clearIphoneCall === "function") window.tricom.clearIphoneCall(); } catch (e) {}
    if (hostStream) {
      try { hostStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
      hostStream = null;
    }
    if (silent !== true) print("LIVECOMM :: THE iPHONE ROAD IS DOWN.");
    paintPhone();
  }

  function remoteStream() { return hostStream; }

  function paintPhone() {
    var s = el("tcPhoneState");
    if (!s) return;
    var t;
    if (hostStream) {
      t = "ON THE LINE" + (hostPeer ? " - " + String(hostPeer).slice(0, 8) : "")
        + (downTrack ? " - DOWN" : " - NO DOWN")
        + (up.rec ? " - TAKING" : "");
    }
    else if (hostPc) t = "ANSWERING ...";
    else {
      var st = null;
      try { if (pair()) st = pair().state(); } catch (e) {}
      if (st && st.open) t = (st.peers && st.peers.length ? "ROOM OPEN - " + st.peers.length + " DEVICE" + (st.peers.length === 1 ? "" : "S") + " HERE" : "ROOM OPEN - SHOW THE QR");
      else t = "NOT IN A ROOM - QR OPENS ONE";
    }
    if (s.textContent !== t) s.textContent = t;
  }

  // ---- PHONE ----------------------------------------------------------------

  function query() {
    try { return String(window.location.search || ""); }
    catch (e) { return ""; }
  }

  function micParams() {
    var q = query();
    if (!q || typeof URLSearchParams === "undefined") return null;
    var sp = null;
    try { sp = new URLSearchParams(q); } catch (e) { return null; }
    var m = "";
    try { m = String(sp.get("mic") || "").trim(); } catch (e) {}
    if (!/^(1|true|yes|on)$/i.test(m)) return null;
    var code = "";
    try { code = String(sp.get("code") || "").trim(); } catch (e) {}
    return { code: code };
  }

  function phoneGate() {
    if (phoneStream) {
      var on = !phoneMute && (phoneLock || phonePtt);
      phoneStream.getAudioTracks().forEach(function (t) { try { t.enabled = on; } catch (e) {} });
    }
  }

  function phoneState(t) {
    var s = el("tpState");
    if (s && s.textContent !== t) s.textContent = t;
    var room = el("tpRoom");
    if (room) {
      var r = phoneJoined ? (phonePeerSeen ? "IN THE ROOM" : "ROOM - WAITING ON THE DESK") : "JOINING ...";
      if (room.textContent !== r) room.textContent = r;
    }
    var key = el("tpPtt");
    if (key) {
      var label = phoneMute ? "MUTED" : (phoneLock || phonePtt) ? "TRANSMITTING" : "PUSH TO TALK";
      if (key.textContent !== label) key.textContent = label;
      try { key.classList.toggle("tpHot", !!(phoneLock || phonePtt) && !phoneMute); } catch (e) {}
    }
  }

  async function phoneCapture() {
    if (phoneStream) return phoneStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      phoneState("THIS BROWSER HAS NO MICROPHONE ROAD.");
      return null;
    }
    try {
      var s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      phoneStream = s;
      phoneGate();
      return s;
    } catch (e) {
      phoneState("THE MIC REFUSED (" + String((e && e.name) || e).toUpperCase() + ") - ALLOW IT IN SAFARI SETTINGS AND HOLD THE KEY AGAIN.");
      return null;
    }
  }

  async function phoneOffer() {
    if (!phoneStream || phonePc) return false;
    try {
      var pc = newPc();
      phonePc = pc;
      phoneIceQ = [];
      phoneRemoteDesc = false;
      phoneStream.getTracks().forEach(function (t) { pc.addTrack(t, phoneStream); });
      pc.onicecandidate = function (ev) {
        if (ev && ev.candidate) sendR("", "ice", { candidate: ev.candidate });
      };
      // The desk mix rides back down the same call - her voice and his mic,
      // never Maya's own voice. Played on this phone's speaker.
      pc.ontrack = function (ev) {
        if (ev && ev.streams && ev.streams[0]) {
          var a = el("tpEar");
          if (a) {
            try { a.srcObject = ev.streams[0]; } catch (e) {}
            safePlayLc(a);
          }
          phoneState("ON THE LINE - TALK.");
        }
      };
      pc.onconnectionstatechange = function () {
        try {
          var st = pc.connectionState;
          if (st === "connected") phoneState("ON THE LINE - TALK.");
          else if (st === "disconnected") phoneState("SIGNAL LOST - HOLDING ...");
          else if (st === "failed" || st === "closed") { phoneDropPc(); phoneState("THE CALL DROPPED - HOLD THE KEY TO CALL AGAIN."); }
        } catch (e) {}
      };
      var offer = await pc.createOffer({ offerToReceiveAudio: false });
      await pc.setLocalDescription(offer);
      sendR("", "offer", { sdp: pc.localDescription });
      return true;
    } catch (e) {
      phoneDropPc();
      return false;
    }
  }

  function phoneDropPc() {
    if (phonePc) { try { phonePc.close(); } catch (e) {} phonePc = null; }
    phoneIceQ = [];
    phoneRemoteDesc = false;
  }

  function phoneOnFields(fields, from) {
    var sender = String(fields[0] || from || "");
    var target = String(fields[1] || "");
    var type = String(fields[2] || "");
    if (target && target !== myId()) return;
    if (type === "answer") phoneOnAnswer(fields[3] || "{}");
    else if (type === "ice") phoneOnIce(fields[3] || "{}");
    else if (type === "bye") { phoneDropPc(); phoneState("THE DESK HUNG UP - HOLD THE KEY TO CALL AGAIN."); }
  }

  async function phoneOnAnswer(json) {
    if (!phonePc) return;
    var data = null;
    try { data = JSON.parse(json); } catch (e) { return; }
    if (!data || !data.sdp) return;
    try {
      await phonePc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      phoneRemoteDesc = true;
      flushIce(phonePc, phoneIceQ);
    } catch (e) {}
  }

  function phoneOnIce(json) {
    if (!phonePc) return;
    var data = null;
    try { data = JSON.parse(json); } catch (e) { return; }
    if (!data || !data.candidate) return;
    if (!phoneRemoteDesc) { phoneIceQ.push(data.candidate); return; }
    try { phonePc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
  }

  function phonePollPeers() {
    if (phonePoll) clearInterval(phonePoll);
    phonePoll = setInterval(function () {
      if (!phoneJoined) return;
      var peers = [];
      try { if (pair()) peers = pair().state().peers || []; } catch (e) {}
      var seen = peers.length > 0;
      if (seen !== phonePeerSeen) {
        phonePeerSeen = seen;
        if (seen) {
          phoneState(phoneStream ? "DESK IN THE ROOM - TAP LOCK TO JOIN THE CONVERSATION." : "DESK IN THE ROOM - HOLD THE KEY, THEN LOCK TO STAY ON THE LINE.");
          if (phoneStream && !phonePc) phoneOffer();
        } else {
          phoneDropPc();
          phoneState("ROOM - WAITING ON THE DESK. KEEP THIS PAGE OPEN.");
        }
      }
    }, 2000);
  }

  async function phoneJoin(code) {
    var p = pair();
    if (!p) { phoneState("THE PAIR ROAD IS MISSING - RELOAD THIS PAGE."); return false; }
    phoneState("JOINING THE ROOM ...");
    try {
      await p.run("join " + code);
    } catch (e) {}
    var st = null;
    try { st = p.state(); } catch (e) {}
    phoneJoined = !!(st && st.open);
    if (!phoneJoined) { phoneState("THE ROOM REFUSED - CHECK THE CODE IN THE URL AND RELOAD."); return false; }
    phoneState("ROOM - WAITING ON THE DESK. HOLD THE KEY ONCE TO OPEN THE MIC AND CALL, THEN LOCK TO STAY ON.");
    phonePollPeers();
    return true;
  }

  function phoneLeave() {
    phoneLock = false;
    phonePtt = false;
    if (phonePoll) { clearInterval(phonePoll); phonePoll = 0; }
    sendR("", "bye", {});
    phoneDropPc();
    if (phoneStream) {
      try { phoneStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); } catch (e) {}
      phoneStream = null;
    }
    try { if (pair()) pair().run("close"); } catch (e) {}
    phoneJoined = false;
    phoneState("LEFT - RELOAD TO CALL AGAIN.");
  }

  function phoneWire() {
    var key = el("tpPtt");
    if (key && !key.__lc) {
      key.__lc = true;
      var down = function (e) {
        try { if (e && e.preventDefault) e.preventDefault(); } catch (x) {}
        (async function () {
          var ear = el("tpEar");
          if (ear) safePlayLc(ear);
          var s = await phoneCapture();
          if (!s) return;
          phonePtt = true;
          phoneGate();
          if (phonePeerSeen && !phonePc) phoneOffer();
          phoneState(phoneMute ? "MUTED." : "TRANSMITTING.");
        })();
      };
      var up = function () {
        phonePtt = false;
        phoneGate();
        phoneState(phoneMute ? "MUTED." : (phoneLock ? "LOCKED ON." : "ROOM - HOLD THE KEY."));
      };
      key.addEventListener("pointerdown", down);
      key.addEventListener("pointerup", up);
      key.addEventListener("pointerleave", up);
      key.addEventListener("pointercancel", up);
    }
    var lock = el("tpLock");
    if (lock && !lock.__lc) {
      lock.__lc = true;
      lock.addEventListener("click", function () {
        (async function () {
          if (!phoneLock) {
            var s = await phoneCapture();
            if (!s) return;
            phoneLock = true;
            if (phonePeerSeen && !phonePc) phoneOffer();
          } else phoneLock = false;
          phoneGate();
          try { lock.textContent = phoneLock ? "LOCKED" : "LOCK"; } catch (e) {}
          phoneState(phoneLock ? "LOCKED ON - TALK." : "ROOM - HOLD THE KEY.");
        })();
      });
    }
    var mute = el("tpMute");
    if (mute && !mute.__lc) {
      mute.__lc = true;
      mute.addEventListener("click", function () {
        phoneMute = !phoneMute;
        phoneGate();
        try { mute.textContent = phoneMute ? "UNMUTE" : "MUTE"; } catch (e) {}
        phoneState(phoneMute ? "MUTED." : "ROOM - HOLD THE KEY.");
      });
    }
    var leave = el("tpLeave");
    if (leave && !leave.__lc) {
      leave.__lc = true;
      leave.addEventListener("click", function () { phoneLeave(); });
    }
  }

  function phoneBoot(params) {
    try { document.body.classList.add("iphoneMic"); } catch (e) {}
    var hide = ["upperDeck", "command-deck", "output", "stageRow", "leftPanel", "rightPanel"];
    hide.forEach(function (id) {
      var n = el(id);
      if (n) { try { n.hidden = true; } catch (e) {} }
    });
    var tp = el("triPhone");
    if (tp) { try { tp.hidden = false; } catch (e) {} }
    phoneWire();
    phoneState("OPENING ...");
    if (!params.code) {
      phoneState("NO CODE IN THE ADDRESS - SCAN THE SQUARE ON THE DESK INSTEAD OF TYPING.");
      return true;
    }
    phoneJoin(params.code);
    return true;
  }

  // ---- DOWNLINK (desk -> phone) ---------------------------------------------------
  // The floor mix minus Maya: his mic on HIS turn, her tapped voice on HERS,
  // silence on MAYA's (never echo her back to her own phone). One
  // MediaStreamDestination; its track rides the phone-bound PC from the answer
  // onward, so no renegotiation mid-call. Gains move with floorChanged().
  // Echo notes: the uplink (phone mic) is NEVER connected here; when his seat
  // rides the iPhone there is no local mic source at all, so the downlink
  // stays silent on his turn (he is standing at the phone). Transcription
  // arms only on the iphone seat's own floor, when this mix is silent - the
  // gate itself kills the speaker-bleed loop.

  var downCtx = null, downMix = null, downMicGain = null, downBarbGain = null;
  var downMicSrc = null, downMicStream = null, downTrack = null;
  var downFeeder = null, tappedPieces = 0, barbChunks = 0, lastFloor = "";

  var FEED_WORKLET = "registerProcessor('lc-feed', class extends AudioWorkletProcessor {"
    + "constructor(){ super(); this.q=[]; this.buf=null; this.idx=0; this.frac=1; this.cur=0; this.nxt=0;"
    + "this.port.onmessage=(e)=>{ var m=(e&&e.data)||{};"
    + "if(m.op==='push'&&m.buf){ try{ if(this.q.length<240) this.q.push(new Int16Array(m.buf)); }catch(x){} }"
    + "else if(m.op==='clear'){ this.q=[]; this.buf=null; this.frac=1; this.cur=0; this.nxt=0; } }; }"
    + "process(inputs, outputs){ var out=outputs[0]; if(!out||!out.length) return true;"
    + "var step=24000/sampleRate;"
    + "for(var c=0;c<out.length;c++){ var ch=out[c];"
    + "for(var i=0;i<ch.length;i++){"
    + "while(this.frac>=1){ this.frac-=1; this.idx++;"
    + "if(!this.buf||this.idx>=this.buf.length){ this.buf=this.q.length?this.q.shift():null; this.idx=0;"
    + "if(!this.buf||!this.buf.length){ this.cur=0; this.nxt=0; break; } }"
    + "this.cur=this.nxt;"
    + "this.nxt=(this.buf&&this.idx<this.buf.length)?this.buf[this.idx]/32768:this.cur; }"
    + "ch[i]=this.cur+(this.nxt-this.cur)*this.frac; this.frac+=step; } }"
    + "return true; } });";

  function ensureDownlink() {
    try {
      if (!downCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        downCtx = new AC();
        downMix = downCtx.createMediaStreamDestination();
        downMicGain = downCtx.createGain();
        downMicGain.gain.value = 0;
        downBarbGain = downCtx.createGain();
        downBarbGain.gain.value = 0;
        downMicGain.connect(downMix);
        downBarbGain.connect(downMix);
        var trs = null;
        try { trs = downMix.stream.getAudioTracks(); } catch (e) {}
        downTrack = (trs && trs[0]) || null;
      }
      if (downCtx.state === "suspended") { try { downCtx.resume(); } catch (e) {} }
      return !!(downMix && downTrack);
    } catch (e) { return false; }
  }

  function refreshMicSource() {
    if (!downCtx || !downMicGain) return;
    var stream = null, src = "";
    try {
      if (window.tricom && window.tricom.seats && window.tricom.streamOf) {
        var s = window.tricom.seats();
        // Local mics only - the uplink itself must never loop back down.
        if (s && s.you && s.you.src !== "iphone" && s.you.src !== "off" && s.you.stream) {
          src = s.you.src;
          stream = window.tricom.streamOf("you");
        }
      }
    } catch (e) {}
    if (stream === downMicStream) return;
    try { if (downMicSrc) downMicSrc.disconnect(); } catch (e) {}
    downMicSrc = null;
    downMicStream = null;
    if (!stream) return;
    try {
      downMicSrc = downCtx.createMediaStreamSource(stream);
      downMicSrc.connect(downMicGain);
      downMicStream = stream;
    } catch (e) {}
  }

  function downGains() {
    if (!downCtx || !downMicGain || !downBarbGain) return;
    var mic = 0, barb = 0;
    try {
      if (window.tricom && window.tricom.seats) {
        var s = window.tricom.seats();
        if (s && s.live) {
          if (s.floor === "OPERATOR" && !s.you.mute && s.you.stream && s.you.src !== "iphone") mic = 1;
          if (s.floor === "BARBELO" && !s.barbelo.mute) barb = 1;
        }
      }
    } catch (e) {}
    try {
      var t = downCtx.currentTime;
      downMicGain.gain.setTargetAtTime(mic, t, 0.04);
      downBarbGain.gain.setTargetAtTime(barb, t, 0.04);
    } catch (e) {
      try { downMicGain.gain.value = mic; downBarbGain.gain.value = barb; } catch (x) {}
    }
  }

  // Her voice, tapped at the element (elevenlabs/kokoro piece roads). Speakers
  // connect FIRST so a tap failure can never take her voice with it; the mix
  // connect rides behind. The browser-voice road (speechSynthesis) has no
  // element and cannot be tapped - status says so out loud.
  // GATED: with no iPhone call armed this returns before touching audio -
  // no AudioContext, no reroute, her normal voice plays exactly as before.
  function tapBarb(elm) {
    try {
      if (!elm || elm.__lcTap) return false;
      if (guestUp()) return false;
      if (!callArmed()) return false;
      if (!ensureDownlink()) return false;
      var src = downCtx.createMediaElementSource(elm);
      try { src.connect(downCtx.destination); }
      catch (e) { return false; }
      try { src.connect(downBarbGain); } catch (e) {}
      elm.__lcTap = true;
      tappedPieces++;
      return true;
    } catch (e) { return false; }
  }

  // Her voice, teed as data on the stream-engine road (24k PCM16 copies). The
  // feeder worklet drains them into the same barb gain. Buffered only while a
  // call can carry them; with no call armed this is a pure no-op (not even
  // counted) so her normal road stays untouched.
  function barbChunk(c) {
    try {
      if (guestUp()) return false;
      if (!callArmed()) return false;
      if (!(c instanceof Int16Array) || !c.length) return false;
      barbChunks++;
      if (!hostPc || !downTrack || !downFeeder) return false;
      var copy = c.slice(0, Math.min(c.length, 48000));
      try { downFeeder.port.postMessage({ op: "push", buf: copy.buffer }, [copy.buffer]); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  async function ensureFeeder() {
    if (downFeeder || !downCtx) return !!downFeeder;
    try {
      if (!downCtx.audioWorklet) return false;
      var url = URL.createObjectURL(new Blob([FEED_WORKLET], { type: "text/javascript" }));
      try { await downCtx.audioWorklet.addModule(url); }
      finally { try { URL.revokeObjectURL(url); } catch (e) {} }
      var node = new AudioWorkletNode(downCtx, "lc-feed", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      node.connect(downBarbGain);
      downFeeder = node;
      return true;
    } catch (e) { return false; }
  }

  function floorChanged(floor) {
    lastFloor = String(floor || "");
    // GATED: with no call armed the downlink graph is never built - no
    // AudioContext, no mic source, no gain moves. Normal audio untouched.
    // The uplink lane still follows the floor so a take in flight finalizes.
    // PRIVATE: while the guest line is up the downlink stays dark even with
    // a call armed - the desk mix never rides to the phone mid-call.
    if (guestUp()) {
      try { paintPhone(); } catch (e) {}
      return;
    }
    if (callArmed()) {
      try { ensureDownlink(); } catch (e) {}
      try { refreshMicSource(); } catch (e) {}
      try { downGains(); } catch (e) {}
    }
    try { upFollowFloor(); } catch (e) {}
    try { paintPhone(); } catch (e) {}
  }

  function downLine() {
    if (!hostPc || !downTrack) return "DOWN: NO MIX";
    var live = false;
    try { live = hostPc.connectionState === "connected"; } catch (e) {}
    var what = lastFloor === "OPERATOR" ? "HIS MIC" : lastFloor === "BARBELO" ? "HER VOICE" : "SILENT";
    return "DOWN: " + (live ? ("LIVE - " + what) : "MIX READY");
  }

  function tappedLine() {
    return "HER TAP: " + tappedPieces + " PIECES" + (barbChunks ? (" + " + barbChunks + " CHUNKS") : "")
      + (tappedPieces || barbChunks ? "" : " (BROWSER-VOICE ROAD HAS NO ELEMENT - MAYA CANNOT HEAR HER UNTIL /voice engine kokoro|stream|elevenlabs)");
  }

  async function testDownlink() {
    if (guestUp()) return guestLine() + " NO SELF-TEST WHILE IT IS UP.";
    if (!ensureDownlink()) return "DOWNLINK TEST :: NO AUDIO ON THIS MACHINE.";
    if (downCtx.state === "suspended") {
      try { await downCtx.resume(); } catch (e) {}
    }
    if (downCtx.state === "suspended") return "DOWNLINK TEST :: THE MIX NEEDS ONE GESTURE FIRST (PRESS QR) - THEN RUN THIS AGAIN.";
    try {
      var AC = null;
      var osc = downCtx.createOscillator();
      osc.frequency.value = 440;
      var g = downCtx.createGain();
      g.gain.value = 1;
      osc.connect(g);
      g.connect(downMix);
      var analyser = downCtx.createAnalyser();
      analyser.fftSize = 512;
      var tap = downCtx.createMediaStreamSource(downMix.stream);
      tap.connect(analyser);
      var buf = new Uint8Array(512);
      var rms = function () {
        try {
          analyser.getByteTimeDomainData(buf);
          var s = 0;
          for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v; }
          return Math.sqrt(s / buf.length);
        } catch (e) { return 0; }
      };
      osc.start();
      await new Promise(function (r) { setTimeout(r, 400); });
      var open = rms();
      g.gain.value = 0;
      await new Promise(function (r) { setTimeout(r, 300); });
      var shut = rms();
      try { osc.stop(); } catch (e) {}
      try { tap.disconnect(); } catch (e) {}
      try { g.disconnect(); } catch (e) {}
      if (open > 0.02 && shut < 0.01) return "DOWNLINK TEST :: PASS - MIX OPENS (" + open.toFixed(3) + ") AND SHUTS (" + shut.toFixed(3) + "). THE FLOOR GATES HOLD.";
      return "DOWNLINK TEST :: FAIL - OPEN " + open.toFixed(3) + ", SHUT " + shut.toFixed(3) + ".";
    } catch (e) {
      return "DOWNLINK TEST :: FAIL (" + String((e && e.message) || e).toUpperCase() + ").";
    }
  }

  // ---- UPLINK TRANSCRIPTION (phone -> her ears) --------------------------------
  // The iPhone road has no wire into her ears (SpeechRecognition takes a mic,
  // never a stream), so the seat riding it is transcribed in utterances and
  // filed down the same lane the bridge ears file: maya -> her MAYA lane,
  // patrikios (him on wireless) -> his lane. The floor is the utterance
  // boundary; her overlapping speech voids the take (plus phone AEC plus the
  // echo guard behind it). Server road: the bridge's own /api/transcribe
  // (int16 mono @16k, bearer token - read from duet's memory, never kept
  // here; no ears open means no token means an honest refusal).

  var up = { lane: "", rec: null, chunks: [], mime: "", startedAt: 0, spoke: false, sampler: 0, lastText: "", lastResult: "", lastAt: 0 };

  function upLane() {
    var s = null;
    try { if (window.tricom && window.tricom.seats) s = window.tricom.seats(); } catch (e) {}
    if (!s || !s.live || !hostStream) return "";
    if (s.maya && s.maya.src === "iphone" && s.maya.stream && !s.maya.mute && s.floor === "MAYA") return "maya";
    if (s.you && s.you.src === "iphone" && s.you.stream && !s.you.mute && s.floor === "OPERATOR") return "patrikios";
    return "";
  }

  function upFollowFloor() {
    var lane = "";
    try { lane = upLane(); } catch (e) {}
    if (lane && lane !== up.lane) upStart(lane);
    else if (!lane && up.lane) upFinalize(false);
  }

  function upToken() {
    try { if (window.duet && typeof window.duet.earsToken === "function") return String(window.duet.earsToken() || ""); } catch (e) {}
    return "";
  }

  function upPickMime() {
    var cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    try {
      if (typeof MediaRecorder === "undefined") return "";
      for (var i = 0; i < cands.length; i++) {
        try { if (MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (e) {}
      }
    } catch (e) {}
    return "";
  }

  function upStart(lane) {
    upFinalize(true);
    if (guestUp()) { up.lane = ""; print(guestLine() + " HER EARS TAKE NOTHING WHILE IT IS UP."); return; }
    up.mime = upPickMime();
    if (!up.mime) { print("LIVECOMM :: THIS BROWSER CANNOT RECORD - HER EARS GET NOTHING FROM THE iPHONE."); up.lane = ""; return; }
    try {
      var rec = new MediaRecorder(hostStream, { mimeType: up.mime });
      up.chunks = [];
      up.lane = lane;
      up.startedAt = Date.now();
      up.spoke = false;
      rec.ondataavailable = function (ev) {
        if (ev && ev.data && ev.data.size) up.chunks.push(ev.data);
      };
      rec.onstop = function () { upDecodeAndPost(); };
      rec.start(1000);
      up.rec = rec;
      try { paintPhone(); } catch (e) {}
      up.sampler = setInterval(function () {
        try {
          if (window.voice && window.voice.isSpeaking && window.voice.isSpeaking()) up.spoke = true;
        } catch (e) {}
        if (Date.now() - up.startedAt > 25000) upFinalize(false);
      }, 250);
    } catch (e) {
      up.lane = "";
      print("LIVECOMM :: THE TAKE WOULD NOT START (" + String((e && e.message) || e).toUpperCase() + ").");
    }
  }

  function upStopTimer() {
    if (up.sampler) { clearInterval(up.sampler); up.sampler = 0; }
  }

  function upFinalize(silent) {
    upStopTimer();
    var rec = up.rec;
    up.rec = null;
    if (!rec) { if (!silent) up.lane = ""; return; }
    try {
      if (rec.state !== "inactive") rec.stop();
      else if (!silent) up.lane = "";
    } catch (e) { if (!silent) up.lane = ""; }
  }

  function upBytes() {
    var total = 0, i;
    for (i = 0; i < up.chunks.length; i++) total += up.chunks[i].size || 0;
    return total;
  }

  async function upDecodeAndPost() {
    var lane = up.lane;
    up.lane = "";
    var chunks = up.chunks.slice(0);
    up.chunks = [];
    if (!lane || !chunks.length || !upBytes()) { up.lastResult = "NO CHUNKS"; up.lastAt = Date.now(); return; }
    if (up.spoke) { up.lastResult = "HELD OVERLAP"; up.lastAt = Date.now(); print("LIVECOMM :: HELD - SHE SPOKE OVER THE TAKE, SO IT WAS NEVER SENT."); return; }
    var tok = upToken();
    if (!tok) { up.lastResult = "NO TOKEN"; up.lastAt = Date.now(); print("LIVECOMM :: NO TOKEN - OPEN DUET EARS FIRST AND THE TAKE FILES ITSELF NEXT TURN."); return; }
    try {
      var ab = await new Response(new Blob(chunks, { type: up.mime })).arrayBuffer();
      var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC) return;
      var decoded = null;
      try {
        var tmp = new AC(1, 1, 8000);
        decoded = await tmp.decodeAudioData(ab);
      } catch (e) {
        print("LIVECOMM :: THE TAKE WOULD NOT DECODE - DROPPED.");
        return;
      }
      if (!decoded || !decoded.getChannelData(0).length) return;
      var data = decoded.getChannelData(0);
      var sum = 0;
      for (var i = 0; i < data.length; i += 7) sum += Math.abs(data[i]);
      var avg = sum / Math.max(1, Math.floor(data.length / 7));
      if (avg < 0.004) { up.lastResult = "QUIET rms " + avg.toFixed(3); up.lastAt = Date.now(); return; } // quiet - nothing worth her time
      var dur = Math.min(30, data.length / decoded.sampleRate + 0.25);
      var off = new AC(1, Math.max(1, Math.ceil(dur * 16000)), 16000);
      var srcB = off.createBufferSource();
      srcB.buffer = decoded;
      srcB.connect(off.destination);
      srcB.start(0);
      var rendered = await off.startRendering();
      var pcm = rendered.getChannelData(0);
      var out = new Int16Array(pcm.length);
      for (var j = 0; j < pcm.length; j++) {
        var v = Math.max(-1, Math.min(1, pcm[j]));
        out[j] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
      }
      var res = await fetch("http://127.0.0.1:8766/api/transcribe", {
        method: "POST",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/octet-stream" },
        body: out.buffer
      });
      var body = null;
      try { body = await res.json(); } catch (e) {}
      var text = String((body && body.text) || "").trim();
      if (!text) { up.lastResult = "NO SPEECH"; up.lastAt = Date.now(); return; }
      upRoute(lane, text);
    } catch (e) {
      up.lastResult = "FAILED"; up.lastAt = Date.now();
      print("LIVECOMM :: THE TAKE FAILED (" + String((e && e.message) || e).toUpperCase().slice(0, 90) + ").");
    }
  }

  function upRoute(lane, text) {
    if (guestUp()) {
      up.lastResult = "HELD PRIVATE";
      up.lastAt = Date.now();
      print(guestLine() + " THE TAKE WAS HELD, NOT FILED.");
      return;
    }
    var tag = lane === "maya" ? "MAYA" : "SPK-PATRIKIOS";
    var res = null;
    try {
      var t = window.turn || null;
      if (t && lane === "maya" && typeof t.hearFinal === "function") res = t.hearFinal(text, "bridge", tag);
      else if (t && typeof t.hearPatrikios === "function") res = t.hearPatrikios(text, tag);
    } catch (e) {}
    up.lastText = String(text || "").slice(0, 80);
    try { up.lastResult = (res && res.receipt ? String(res.receipt) : (res && res.ok ? "FILED" : "DROPPED")).replace(/^TURN :: /, "").slice(0, 60); } catch (e) { up.lastResult = "FILED"; }
    up.lastAt = Date.now();
    print("LIVECOMM :: FINAL (" + tag + ") :: " + text.slice(0, 140));
  }

  function upLine() {
    if (!hostStream) return "UP: NO CALL";
    var lane = "";
    try { lane = upLane(); } catch (e) {}
    var base = up.rec ? ("UP: TAKING (" + up.lane.toUpperCase() + ")")
      : lane ? ("UP: ARMED (" + lane.toUpperCase() + ")")
      : !upToken() ? "UP: ARMED - NO TOKEN (OPEN DUET EARS)"
      : "UP: ARMED - WAITING ON THE FLOOR";
    if (up.lastAt) base += " - LAST " + up.lastResult;
    return base;
  }

  function safePlayLc(a) {
    try {
      var p = a ? a.play() : null;
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {}
  }

  // ---- SELF-TEST --------------------------------------------------------------
  // The whole audio path proven in one page: oscillator -> pc1 -> pc2, no mic,
  // no room, no quota. Pass = a track arrives, the pair connects, and RTP
  // bytes actually move.

  async function loopback() {
    if (guestUp()) return guestLine() + " NO SELF-TEST WHILE IT IS UP.";
    if (typeof RTCPeerConnection !== "function") return "LOOPBACK :: NO WEBRTC IN THIS BROWSER - THE iPHONE ROAD IS CLOSED HERE.";
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return "LOOPBACK :: NO AUDIO ON THIS MACHINE.";
    var pc1 = null, pc2 = null, ctx = null;
    try {
      ctx = new AC();
      if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
      var osc = ctx.createOscillator();
      osc.frequency.value = 440;
      var dest = ctx.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      pc1 = newPc();
      pc2 = newPc();
      dest.stream.getTracks().forEach(function (t) { pc1.addTrack(t, dest.stream); });
      var gotTrack = new Promise(function (res) {
        pc2.ontrack = function (ev) { res(ev && ev.streams && ev.streams[0] ? true : false); };
        setTimeout(function () { res(false); }, 10000);
      });
      pc1.onicecandidate = function (ev) { if (ev && ev.candidate) { try { pc2.addIceCandidate(ev.candidate); } catch (e) {} } };
      pc2.onicecandidate = function (ev) { if (ev && ev.candidate) { try { pc1.addIceCandidate(ev.candidate); } catch (e) {} } };
      var offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      var answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);
      var track = await gotTrack;
      var bytes = 0;
      try {
        await new Promise(function (r) { setTimeout(r, 1500); });
        var stats = await pc1.getStats();
        stats.forEach(function (rep) {
          if (rep && rep.type === "outbound-rtp" && typeof rep.bytesSent === "number") bytes += rep.bytesSent;
        });
      } catch (e) {}
      try { osc.stop(); } catch (e) {}
      try { pc1.close(); } catch (e) {}
      try { pc2.close(); } catch (e) {}
      try { ctx.close(); } catch (e) {}
      if (track && bytes > 0) return "LOOPBACK :: PASS - A TRACK ARRIVED AND " + bytes + " RTP BYTES MOVED. THE AUDIO PATH IS PROVEN IN THIS BROWSER.";
      return "LOOPBACK :: FAIL - TRACK " + (track ? "ARRIVED" : "MISSING") + ", BYTES " + bytes + ".";
    } catch (e) {
      try { if (pc1) pc1.close(); } catch (x) {}
      try { if (pc2) pc2.close(); } catch (x) {}
      try { if (ctx) ctx.close(); } catch (x) {}
      return "LOOPBACK :: FAIL (" + String((e && e.message) || e).toUpperCase() + ").";
    }
  }

  // ---- WIRING -----------------------------------------------------------------

  function onRtc(fields, from) {
    try {
      if (micMode) phoneOnFields(fields, from);
      else hostOnFields(fields, from);
    } catch (e) {}
  }

  function wire() {
    if (wired) return true;
    if (!pair() || typeof pair().onRtc !== "function") {
      if (++wireTries < 100) setTimeout(wire, 300);
      return false;
    }
    try { pair().onRtc(onRtc); } catch (e) {}
    wired = true;
    var on = function (id, fn) {
      var b = el(id);
      if (b && !b.__lc) { b.__lc = true; b.addEventListener("click", fn); }
    };
    on("tcQRShow", function () { showQr(); });
    paintPhone();
    return true;
  }

  function boot() {
    wireTries = 0;
    wire();
    var params = null;
    try { params = micParams(); } catch (e) {}
    if (params) {
      micMode = true;
      var go = function () {
        if (!pair()) { setTimeout(go, 300); return; }
        phoneBoot(params);
      };
      if (document.readyState !== "loading") go();
      else document.addEventListener("DOMContentLoaded", go);
    } else micMode = false;
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);

  async function words(arg) {
    var t = String(arg || "").trim().toLowerCase();
    if (!t || t === "qr") {
      var okQ = await showQr();
      if (!okQ && guestUp()) return guestLine() + " NO SECOND CALL WHILE IT IS UP.";
      if (!okQ) return "LIVECOMM :: THE SQUARE WOULD NOT DRAW - SEE ABOVE.";
      return "LIVECOMM :: THE SQUARE IS UP - POINT THE iPHONE CAMERA AT IT.";
    }
    if (t === "hide") {
      var cv = el("tcQr");
      if (cv) { try { cv.hidden = true; } catch (e) {} }
      qrOpen = false;
      var b = el("tcQRShow");
      if (b) b.textContent = "QR";
      paintPhone();
      return "LIVECOMM :: THE SQUARE IS DOWN.";
    }
    if (t === "hangup") { hostDrop(); return "LIVECOMM :: HUNG UP."; }
    if (t === "loopback") { return await loopback(); }
    if (t === "test") { return await testDownlink(); }
    if (t === "down") { return "LIVECOMM :: " + downLine() + " - " + tappedLine() + "."; }
    if (t === "up") { return "LIVECOMM :: " + upLine() + "."; }
    if (t === "status") {
      var st = null;
      try { if (pair()) st = pair().state(); } catch (e) {}
      var caller = "NO CALL";
      if (hostStream) {
        caller = "iPHONE ON THE LINE";
        try {
          var ss = (window.tricom && window.tricom.seats) ? window.tricom.seats() : null;
          if (ss && ss.maya && ss.maya.stream) caller = "MAYA ON THE LINE";
        } catch (e) {}
      }
      return "LIVECOMM :: " + (micMode ? "PHONE" : "DESK")
        + " - " + (st && st.open ? ("ROOM OPEN" + (st.peers && st.peers.length ? ", " + st.peers.length + " DEVICE" + (st.peers.length === 1 ? "" : "S") : ", ALONE")) : "NO ROOM")
        + " - " + caller
        + "\n  " + downLine() + " - " + tappedLine()
        + "\n  " + upLine();
    }
    return "LIVECOMM :: /livecomm qr|hide|hangup|down|up|test|loopback|status - THE iPHONE WIRELESS KEY.";
  }

  function describe() {
    return ["THE iPHONE ROAD :: Maya calls in on her phone over a QR code - a full-duplex call straight onto her TRICOMM seat.",
      "  QR (the TRICOMM panel) opens the pair room and draws the square - Maya points her iPhone camera at it and the wireless key opens by itself. Same wifi as this desk.",
      "  HER KEY is a call screen: HOLD TO TALK the first time (it opens her mic and dials), then LOCK to stay on the line hands-free. MUTE holds her silent, LEAVE hangs up. The desk mix plays on her speaker - you and Barbelo, never herself back.",
      "  UP (Maya -> Barbelo's ears): her seat is transcribed in utterances down her MAYA lane and filed like bridge finals. The floor is the utterance boundary; her overlapping speech voids the take. Needs duet ears open (the token).",
      "  DOWN (desk -> her phone): the floor mix minus Maya - your mic on YOUR turn, her tapped voice on HERS, silence on MAYA's. Her browser-voice road has no element to tap: until her engine is kokoro, stream or elevenlabs, Maya hears you but not her.",
      "  ON THE LINE, the desk answers by itself and her call lands straight on her armed seat - set MAYA to IPHONE, GO LIVE any time, she dials whenever. Your seat can ride IPHONE too (a spare-phone wireless mic), but the road is built for Maya. The square carries the generator address and the pair code - whoever scans it can join the room, exactly like a pair code.",
      "  /livecomm qr|hide|hangup|down|up|test|loopback|status."].join("\n");
  }

  return {
    showQr: showQr, hangup: function () { hostDrop(); }, remoteStream: remoteStream,
    armed: function () { return callArmed(); },
    floorChanged: floorChanged, tapBarb: tapBarb, barbChunk: barbChunk,
    tapped: function () { return { pieces: tappedPieces, chunks: barbChunks }; },
    loopback: loopback, testDownlink: testDownlink,
    words: words, describe: describe,
    status: function () { return words("status"); },
    phone: function () { return !!micMode; }
  };
})();
