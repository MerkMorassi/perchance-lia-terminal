(function () {
  /* ---- DUET ------------------------------------------------------------------
     THE AI EXCHANGE, ON ITS OWN PAGE IN THIS DASH. The floor (src/js/turn.js)
     arbitrates, the key (src/js/intercom.js) speaks, the bridge ears hear -
     this panel is the glass over all three: the lamp names who holds the
     line, the meter shows the VAD level against its threshold live, the feed
     prints every grant, filing, drop, trigger and auto-end as it happens.
     DEMO TURN runs one agent turn with no audio at all, so the whole cycle
     - grant, trigger, silence, release - can be watched. The TURNS row reads
     the air gap gate (/gap); the MARK row reads the clip watermark
     (src/js/watermark.js), which marks every clip she plays so the
     microphone stream carrying the mark reads as hers.
     --------------------------------------------------------------------------- */

  var SCALE = 0.25;
  var CHIP = "src/chips/voicebridge-chip/mythos-voicebridge-standalone.js";
  var ICHIP = "src/chips/intercom-chip/mythos-intercom-standalone.js";
  var BASE = "http://127.0.0.1:8766";

  var ears = null;
  var earsOpen = false;
  var earToken = "";
  var coomBase = "";
  var coomServerLive = false;

  function phase() {
    try { if (window.gap && window.gap.on()) {
      var h = "";
      try { if (tu() && tu().floor) h = tu().floor().holder || ""; } catch (e) {}
      return h ? "LIVE" : "OPEN";
    } } catch (e) {}
    return "OFF";
  }

  function el(id) { return document.getElementById(id); }
  function tu() { return window.turn || null; }
  // PRIVATE MODE (2026-10-21): the bridge ears hear the room, so open ears
  // would hand the private call to Barbelo. They refuse to open while the
  // guest line is up, and finals drop while it is up - HITL<>MAYA only.
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }
  function secs(ms) { return (Math.round(ms / 100) / 10) + "S"; }

  function isOpen() { var p = el("duetPanel"); return !!(p && !p.hidden); }

  function closeOthers() {
    try { if (window.vox && window.vox.isOpen && window.vox.isOpen()) window.vox.close(); } catch (e) {}
    try { if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close(); } catch (e) {}
    try { if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close(); } catch (e) {}
    try { if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close(); } catch (e) {}
    try { if (window.sync && window.sync.isOpen && window.sync.isOpen()) window.sync.close(); } catch (e) {}
    try { if (window.pair && window.pair.isOpen && window.pair.isOpen()) window.pair.panelClose(); } catch (e) {}
    try { if (window.liacomm) window.liacomm.close(); } catch (e) {}
    try { if (window.tricom && window.tricom.isOpen && window.tricom.isOpen()) window.tricom.close(); } catch (e) {}
  }

  function show() {
    var p = el("duetPanel");
    if (!p) return false;
    closeOthers();
    setCenter(true);
    p.hidden = false;
    paint();
    return true;
  }

  function close() {
    setCenter(false);
    var p = el("duetPanel");
    if (p) p.hidden = true;
  }

  function toggle() {
    if (isOpen()) { close(); return false; }
    return show();
  }

  function isCenter() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("duetCenter")); }
    catch (e) { return false; }
  }

  var homeParent = null, homeNext = null;

  function setCenter(on) {
    on = !!on;
    var p = el("duetPanel");
    var row = el("stageRow");
    var out = el("output");
    if (on) {
      if (p && row) {
        if (!homeParent) { homeParent = p.parentNode; homeNext = p.nextSibling; }
        try { row.insertBefore(p, el("rightPanel") || null); } catch (e) {}
      }
      if (out) out.hidden = true;
    } else {
      if (p && homeParent) {
        try { homeParent.insertBefore(p, homeNext); } catch (e) {}
        homeParent = null;
        homeNext = null;
      }
      if (out) out.hidden = false;
    }
    try { document.body.classList.toggle("duetCenter", on); } catch (e) {}
    return on;
  }

  function earLine(s) {
    var l = el("duEarLine");
    if (l) l.textContent = s;
  }

  function chipReady(cb) {
    try {
      if (window.MythosVoiceBridge) { cb(true); return; }
      var s = document.createElement("script");
      s.src = CHIP;
      s.onload = function () { cb(!!window.MythosVoiceBridge); };
      s.onerror = function () { cb(false); };
      document.head.appendChild(s);
    } catch (e) { cb(false); }
  }

  async function openEars() {
    var t = tu();
    if (guestUp()) { earLine("SHUT - " + (guestWho() || "THE GUEST") + " IS ON THE PRIVATE LINE. HANG UP FIRST."); return; }
    if (!t) { earLine("SHUT - THE TURN CONTROLLER IS OFFLINE (src/js/turn.js)."); return; }
    var box = el("duToken");
    var token = box ? String(box.value || "").trim() : "";
    if (!token) { earLine("SHUT - PASTE THE BRIDGE TOKEN FIRST (PRINTED ONCE BY fasterwhisper_server.py - MEMORY ONLY, NEVER KEPT)."); return; }
    earLine("OPENING ...");
    var ok = await new Promise(function (res) { chipReady(res); });
    if (!ok) { earLine("SHUT - THE BRIDGE CLIENT WOULD NOT LOAD (src/chips/voicebridge-chip/)."); return; }
    try { if (ears) { try { ears.close(); } catch (e) {} ears = null; } } catch (e) {}
    try {
      ears = window.MythosVoiceBridge.client({
        base: BASE,
        token: token,
        hold: function () { try { return t.sttHeld(); } catch (e) { return false; } },
        onFinal: function (text, meta) { try { routeFinal(text, meta); } catch (e) {} }
      });
    } catch (e) { earLine("SHUT - THE CLIENT WOULD NOT START."); return; }
    var st = null;
    try { st = await ears.status(); } catch (e) { st = null; }
    if (!st || !st.ok) {
      earLine("SHUT - " + (st && st.receipt ? st.receipt : "NO ANSWER AT " + BASE + " - START fasterwhisper_server.py ON YOUR MACHINE."));
      try { ears.close(); } catch (e) {}
      ears = null;
      coomBase = "";
      paint();
      return;
    }
    try { coomBase = String(st.base || BASE); } catch (e) { coomBase = BASE; }
    try { if (window.voice && window.voice.barbCallsign && st && st.barb) window.voice.barbCallsign(st.barb.callsign ? "on" : "off"); } catch (e) {}
    var li = null;
    try { li = ears.listen(); } catch (e) { li = null; }
    if (!li) { earLine("SHUT - THE EVENT STREAM WOULD NOT OPEN."); ears = null; paint(); return; }
    earsOpen = true;
    earToken = token;
    try { if (window.avb) window.avb.remoteStart(BASE, token); } catch (e) {}
    try { if (box) box.value = ""; } catch (e) {}
    try { if (window.turn && window.turn.coom) window.turn.coom(false); } catch (e) {}
    earLine("ARMED :: " + coomBase + " - METERS LIVE, GATES CLOSED. NOTHING POSTS UNTIL GO LIVE.");
    paint();
  }

  function routeFinal(text, meta) {
    var t = tu();
    if (!t) return;
    if (guestUp()) { try { if (t.gateDrop) t.gateDrop("private:guest-line-up"); } catch (e) {} return; }
    var lane = String((meta && meta.lane) || "").toLowerCase();
    var tag = String((meta && meta.speaker) || "");
    var host = null;
    if (/patrikios/i.test(tag) || /merk/i.test(tag) || lane === "patrikios" || lane === "merk") host = "PATRIKIOS";
    else if (lane === "maya" || lane === "") host = "MAYA";
    else { try { if (t.gateDrop) t.gateDrop("lane:" + lane); } catch (e) {} return; }
    try {
      var c = chip();
      if (c) {
        var now = Date.now(), ticket = null;
        if (c.holder() === host) ticket = laneTicket[host] || null;
        else if (lastRelease.host === host && now - lastRelease.at < 1500) ticket = lastRelease.ticket || null;
        var line = c.routeFinal(host, text, ticket);
        if (!line) { try { if (t.gateDrop) t.gateDrop(host.toLowerCase() + ":noticket"); } catch (e) {} return; }
        text = line.text;
      }
    } catch (e) {}
    if (host === "PATRIKIOS") { try { t.hearPatrikios(text, tag || "SPK-PATRIKIOS"); } catch (e) {} return; }
    try { t.hearFinal(text, "bridge", tag || "MAYA"); } catch (e) {}
  }

  async function serverGate(on) {
    coomServerLive = false;
    if (!coomBase || !earToken) return { ok: false, why: "no server" };
    try {
      var res = await fetch(coomBase + "/api/live?on=" + (on ? "1" : "0") + "&token=" + encodeURIComponent(earToken));
      var data = await res.json();
      if (data && data.ok) {
        coomServerLive = !!data.live;
        return { ok: true, live: !!data.live };
      }
      return { ok: false, why: "refused" };
    } catch (e) { return { ok: false, why: "unreachable - serve HTTPS or run local" }; }
  }

  var barbRelayed = null;
  var mayaQuietAt = 0;
  var icc = null;
  var laneTicket = { BARBELO: 0, MAYA: 0 };
  var lastRelease = { host: null, at: 0, ticket: 0 };

  function chip() {
    if (icc) return icc;
    try {
      if (!window.MythosIntercom) return null;
      icc = new window.MythosIntercom.IntercomChip({ tailMs: 350, maxHoldMs: 60000 });
      try {
        icc.on(function (e) {
          try {
            if (e.type === "GRANT") laneTicket[e.host] = e.ticket;
            else if (e.type === "RELEASE") lastRelease = { host: e.host, at: Date.now(), ticket: laneTicket[e.host] || 0 };
          } catch (x) {}
        });
      } catch (x) {}
    } catch (x) { icc = null; }
    return icc;
  }

  function chipLoad() {
    try {
      if (window.MythosIntercom) return;
      var s = document.createElement("script");
      s.src = ICHIP;
      s.onload = function () { try { chip(); } catch (e) {} };
      document.head.appendChild(s);
    } catch (e) {}
  }

  function bus() {
    try {
      var c = chip();
      if (c) { var h = c.holder(); return h || "FREE"; }
    } catch (e) {}
    return "FREE";
  }

  function floorEdge(host, on) {
    try {
      var c = chip();
      if (!c) return false;
      if (on) c.requestFloor(host);
      else c.releaseFloor(host);
      return true;
    } catch (e) { return false; }
  }
  function mayaWatch() {
    var t = tu();
    if (!t || !t.maya) return;
    try { if (window.gap && window.gap.on()) return; } catch (e) {}
    if (!earsOpen) { mayaQuietAt = 0; try { t.maya(false); } catch (e) {} return; }
    var loud = false;
    try {
      var rl = (window.avb && window.avb.remoteLevel) ? window.avb.remoteLevel() : null;
      loud = !!(rl && rl.live && Number(rl.level) > 0.05);
    } catch (e) {}
    try {
      if (loud) {
        mayaQuietAt = 0;
        var was = false;
        try { was = t.maya(); } catch (e) {}
        t.maya(true);
        if (!was) { try { var c2 = chip(); if (c2) c2.requestFloor("MAYA"); } catch (e) {} }
      }
      else {
        if (!mayaQuietAt) mayaQuietAt = Date.now();
        if (Date.now() - mayaQuietAt > 1200) {
          var was2 = false;
          try { was2 = t.maya(); } catch (e) {}
          t.maya(false);
          if (was2) { try { var c3 = chip(); if (c3) c3.releaseFloor("MAYA"); } catch (e) {} }
        }
      }
    } catch (e) {}
  }

  async function monitorOn() {
    if (!window.avb) { earLine("THE AVB METER IS OFFLINE (src/js/avb.js)."); return; }
    try {
      if (!window.avb.micOn()) {
        earLine("OPENING THE CABLE ...");
        var mr = await window.avb.micStart();
        if (!mr || !mr.ok) { earLine("THE CABLE WOULD NOT OPEN (MIC REFUSED OR MISSING)."); paint(); return; }
      }
      var r = window.avb.monitorStart();
      earLine((r && r.ok ? "MONITOR ON :: " : "MONITOR REFUSED :: ") + String((r && r.receipt) || "").replace(/^AVB :: /, ""));
    } catch (e) { earLine("THE MONITOR WOULD NOT OPEN."); }
    paint();
  }

  function monitorOff() {
    try { if (window.avb) window.avb.monitorStop(); } catch (e) {}
    earLine("MONITOR OFF - MAYA'S LINE NO LONGER REACHES YOUR EARS THROUGH HERE.");
    paint();
  }

  function toggleMonitor() {
    try {
      if (window.avb && window.avb.monitorOn && window.avb.monitorOn()) monitorOff();
      else monitorOn();
    } catch (e) {}
  }
  function barbRelay(on) {
    on = !!on;
    if (on !== barbRelayed) {
      barbRelayed = on;
      try {
        var c = chip();
        if (c) { if (on) c.requestFloor("BARBELO"); else c.releaseFloor("BARBELO"); }
      } catch (e) {}
    }
    if (!coomBase || !earToken) return;
    try {
      fetch(coomBase + "/api/barb?on=" + (on ? "1" : "0") + "&token=" + encodeURIComponent(earToken)).catch(function () {});
    } catch (e) {}
  }

  function primer() {
    try {
      if (!window.chatHistory) return;
      var line = "PARTICIPANTS :: SPK-PATRIKIOS Patrikios (PRODUCER - non-talking, hears both on the master mix, never files) / SPK-MAYA Maya (the Sesame call - history only, never his field) / SPK-BARB Barbelo (PRIMARY - this voice, answers into history and out the cable). ONE VOICE AT A TIME: the bus holds exactly one owner - BARBELO or MAYA, never both, never Patrikios. Answer whoever spoke last by name; Maya is not Patrikios.";
      window.chatHistory.push({ role: "PRIMER", content: line, ts: Date.now(), layer: "" });
      if (window.chatHistory.length > 12) window.chatHistory.splice(0, window.chatHistory.length - 12);
    } catch (e) {}
  }

  function shutEars() {
    try { if (ears) ears.close(); } catch (e) {}
    ears = null;
    earsOpen = false;
    earToken = "";
    coomBase = "";
    coomServerLive = false;
    barbRelayed = null;
    try { if (window.avb) window.avb.monitorStop(); } catch (e) {}
    try { if (window.turn && window.turn.coom) window.turn.coom(false); } catch (e) {}
    try { if (window.avb) { window.avb.remoteStop(); window.avb.micStop(); window.avb.auditionStop(); } } catch (e) {}
    earLine("SHUT - EARS CLOSED, METERS OFF. THE CABLE STAYS ROUTED ON YOUR MACHINE; NOTHING HERE LISTENS.");
    paint();
  }

  async function toggleMic() {
    if (!window.avb) return;
    try {
      if (window.avb.micOn()) await window.avb.micStop();
      else await window.avb.micStart();
    } catch (e) {}
    paint();
  }

  function toggleEars() {
    if (earsOpen) { shutEars(); return; }
    openEars();
  }

  async function goLive() {
    var t = tu();
    if (!t) { earLine("THE TURN CONTROLLER IS OFFLINE (src/js/turn.js)."); return; }
    try { if (window.duty && window.duty.setLevel) await window.duty.setLevel("full"); } catch (e) {}
    try {
      t.vad("on");
      t.silence(1500);
      t.timeout(40);
    } catch (e) {}
    try { if (window.intercom && window.intercom.brevity) window.intercom.brevity(true); } catch (e) {}
    try {
      var vs = (window.voice && window.voice.state) ? window.voice.state() : null;
      if (!vs || !vs.autoRead) window.voice.report("auto on");
    } catch (e) {}
    var micRes = null;
    try { micRes = window.avb ? await window.avb.micStart() : null; } catch (e) { micRes = null; }
    try { if (window.gap) window.gap.set(true); } catch (e) {}
    primer();
    var f = null;
    try { f = t.floor(); } catch (e) {}
    earLine("LIVE :: THE AIR GAP GATE IS OPEN" + (micRes && micRes.ok ? " - METER ON " + String(micRes.device || "MIC").toUpperCase() + " (" + String(micRes.engine || "?").toUpperCase() + ")" : " - METER DARK (MIC REFUSED OR MISSING)")
      + " - FLOOR " + (f && f.holder ? up(f.holder) + " HOLDS IT" : "FREE")
      + " - HELM " + (f && f.helm ? f.helm : "PILOT") + ". SHE WAITS FOR QUIET; MAYA'S VOICE HOLDS THE FLOOR.");
    paint();
  }

  async function standDown() {
    try { if (window.gap) window.gap.set(false); } catch (e) {}
    try { if (window.avb) window.avb.monitorStop(); } catch (e) {}
    try { if (window.turn && window.turn.coom) window.turn.coom(false); } catch (e) {}
    coomServerLive = false;
    earLine("QUIET - THE GAP GATE STANDS DOWN AND HER LAMP IS OUT. METERS STAY LIVE, NOTHING POSTS. GO LIVE TO REOPEN.");
    paint();
  }

  function newestAudio() {
    try {
      var M = window.media;
      if (!M || !M.list) return null;
      var ids = M.list() || [];
      var best = null;
      for (var i = 0; i < ids.length; i++) {
        var r = null;
        try { r = M.get(ids[i]); } catch (e) {}
        if (!r || !r.blob) continue;
        var mime = String(r.mime || (r.blob && r.blob.type) || "");
        var kind = String(r.kind || "");
        var folder = String(r.folder || "");
        if (/^audio\//i.test(mime) || /music|vox|clip|audio/i.test(kind + " " + folder)) {
          if (!best || (r.ts || 0) >= (best.ts || 0)) best = { id: ids[i], ts: r.ts || 0, name: r.name || ids[i] };
        }
      }
      return best;
    } catch (e) { return null; }
  }

  async function togglePipe() {
    if (!window.avb) { earLine("THE AVB METER IS OFFLINE (src/js/avb.js)."); return; }
    try {
      if (window.avb.auditionOn && window.avb.auditionOn()) {
        window.avb.auditionStop();
        earLine("PIPE SHUT - THE LINE IS QUIET.");
        paint();
        return;
      }
    } catch (e) {}
    var pick = newestAudio();
    if (!pick) { earLine("NO AUDIO IN THE VAULT - KEEP A CLIP FIRST (GALLERY MUSIC/VOX, OR A STORY KEEP)."); return; }
    earLine("PIPING " + String(pick.name).toUpperCase().slice(0, 40) + " ONTO THE LINE - AS IF LIVE.");
    var res = null;
    try { res = await window.avb.audition(pick.id); } catch (e) { res = null; }
    if (!res || !res.ok) {
      earLine("THE PIPE WOULD NOT OPEN (" + String((res && res.why) || "unplayable") + ").");
      paint();
      return;
    }
    earLine("ON THE LINE :: " + String(res.name || pick.name).toUpperCase() + " (" + res.seconds + "S) - METER, LUFS* AND VAD ALL READ IT AS LIVE.");
    paint();
  }

  function demo() {
    var t = tu();
    if (!t) { earLine("THE TURN CONTROLLER IS OFFLINE (src/js/turn.js)."); return; }
    var f = null;
    try { f = t.floor(); } catch (e) {}
    if (f && f.holder) { earLine("THE FLOOR IS BUSY (" + up(f.holder) + " HOLDS IT) - DEMO WHEN IT FREES."); return; }
    try { t.triggerFor("demo-ai", function () {}); } catch (e) {}
    var r = null;
    try { r = t.request("demo-ai", null, { ai: true }); } catch (e) {}
    if (!r) {
      try { t.triggerFor("demo-ai", null); } catch (e) {}
      earLine("THE FLOOR REFUSED THE DEMO - TRY AGAIN WHEN IT FREES.");
      return;
    }
    try { t.vadFeed(0, "demo"); } catch (e) {}
    setTimeout(function () { try { t.vadFeed(0, "demo"); } catch (e) {} }, 800);
    var vib = null;
    try {
      if (window.avb) {
        var t0 = Date.now();
        vib = setInterval(function () {
          try {
            var el = Date.now() - t0;
            if (el > 1100) { window.avb.feed(0, "demo"); clearInterval(vib); return; }
            window.avb.feed(0.35 + 0.3 * Math.abs(Math.sin(el / 130)), "demo");
          } catch (e) {}
        }, 120);
      }
    } catch (e) {}
    setTimeout(function () { try { t.triggerFor("demo-ai", null); } catch (e) {} }, 5000);
    earLine("DEMO TURN ON THE FLOOR - WATCH THE TRIGGER FIRE, THEN THE SILENCE END IT.");
    paint();
  }

  function hhmmss(at) {
    try {
      var d = new Date(at);
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    } catch (e) { return ""; }
  }

  function paint() {
    var lamp = el("duLamp"), floor = el("duFloor"), fill = el("duMeterFill"),
      mark = el("duMeterMark"), vad = el("duVad"), to = el("duTimeout"),
      queue = el("duQueue"), feed = el("duFeed"), btn = el("duEars"), micB = el("duMic");
    try { if (window.avb && el("duSig") && !el("duSig").__avb) window.avb.indicator("duSig"); } catch (e) {}
    try {
      var lm = el("duLanePatrikios") || el("duLaneMerk"), ly = el("duLaneMaya"), lb = el("duLaneBarb"), ph = el("duPhase");
      var patriOn = false, mayaOn = false, barbOn = false, gated = false;
      try { patriOn = !!(window.avb && window.avb.micOn && window.avb.micOn()); } catch (e) {}
      try { mayaOn = !!(window.avb && window.avb.remoteOn && window.avb.remoteOn()); } catch (e) {}
      try { barbOn = !!(window.voice && window.voice.isSpeaking && window.voice.isSpeaking()); } catch (e) {}
      try { if (window.turn && window.turn.floor) gated = !!window.turn.floor().barb.gated; } catch (e) {}
      if (lm) { lm.className = "laneDot" + (patriOn ? " on" : "") + (gated ? " gated" : ""); var lt = gated ? "PATRIKIOS GATED (BARB)" : "PATRIKIOS"; if (lm.textContent !== lt) lm.textContent = lt; }
      if (ly) { ly.className = "laneDot" + (mayaOn ? " on" : "") + (gated ? " gated" : ""); var yt = gated ? "MAYA GATED (BARB)" : "MAYA"; if (ly.textContent !== yt) ly.textContent = yt; }
      if (lb) lb.className = "laneDot barb" + (barbOn ? " on" : "");
      if (ph) { var p = "OFF"; try { p = phase(); } catch (e) {} if (ph.textContent !== p) ph.textContent = p; }
      try { barbRelay(barbOn); } catch (e) {}
    } catch (e) {}
    if (micB && window.avb) {
      try {
        var ml = window.avb.micOn() ? "MIC ON" : "METER MIC";
        if (micB.textContent !== ml) micB.textContent = ml;
      } catch (e) {}
    }
    var t = tu();
    if (!t) {
      if (lamp) { lamp.textContent = "OFFLINE"; lamp.className = "lcLamp standby"; }
      return;
    }
    var f = null;
    try { f = t.floor(); } catch (e) {}
    if (!f) return;
    var holder = f.holder || "";
    if (lamp) {
      var text = "STANDBY", cls = "lcLamp standby";
      if (holder) { text = "ON AIR: " + up(holder); cls = "lcLamp " + (f.air === "HER VOICE" ? "her" : "you"); }
      else if (f.air === "HER VOICE") { text = "SHE SPEAKS"; cls = "lcLamp her"; }
      else if (f.air === "HER TURN") { text = "THINKING"; cls = "lcLamp busy"; }
      if (lamp.textContent !== text) { lamp.textContent = text; lamp.className = cls; }
    }
    if (floor) floor.textContent = "HOLDER " + (holder ? up(holder) + (f.ai ? " (AGENT)" : "") : "NONE") + " - AIR " + f.air + " - BUS " + (f.bus || "FREE") + " - STT " + (f.sttHeld ? "HELD" : "OPEN") + " - " + f.grants + " GRANTS, " + f.dropped + " DROPPED, " + f.autoEnds + " AUTO-ENDED.";
    var v = f.vad || {};
    if (fill) fill.style.width = Math.max(0, Math.min(100, (Number(v.level) || 0) / SCALE * 100)) + "%";
    if (mark) mark.style.left = Math.max(0, Math.min(100, (Number(v.threshold) || 0) / SCALE * 100)) + "%";
    if (vad) vad.textContent = "LEVEL " + (Number(v.level) || 0).toFixed(3) + " (" + (v.from || "none") + ") - QUIET " + secs(Number(v.quietMs) || 0) + " / " + (v.on ? secs(Number(v.silenceMs) || 0) : "VAD OFF");
    if (to) to.textContent = f.timeoutMs > 0 ? "HELD " + secs(Number(f.heldMs) || 0) + " / " + secs(f.timeoutMs) : "OFF";
    if (queue) queue.textContent = (f.queue && f.queue.length ? f.queue.map(up).join(" > ") : "EMPTY") + " - TRIGGERS [" + ((f.triggers && f.triggers.length ? f.triggers.map(up).join(", ") : "NONE")) + "]";
    try {
      var tn = el("duTurns");
      if (tn) {
        var gt = "GAP SHUT - /gap on OR GO LIVE OPENS IT";
        try { if (window.gap) gt = String(window.gap.words("status")).split("\n")[0].replace(/^GAP :: /, "GAP "); } catch (e) {}
        if (tn.textContent !== gt) tn.textContent = gt;
      }
    } catch (e) {}
    try {
      var mk = el("duMark");
      if (mk) {
        var mt = "NO MARK - SHE HAS NOT SPOKEN YET";
        try {
          if (window.wm) {
            var st = window.wm.state();
            if (st.open) mt = "HER CLIP" + (st.label ? " (" + String(st.label).toUpperCase().slice(0, 24) + ")" : "") + " - " + (Math.ceil(st.until / 100) / 10) + "S OF MARK LEFT" + (st.tone ? " - TONE HEARD" : "");
            else if (st.marked) mt = "ARMED - " + st.marked + " CLIP" + (st.marked === 1 ? "" : "S") + " MARKED" + (st.tone ? " - TONE HEARD" : "");
          }
        } catch (e) {}
        if (mk.textContent !== mt) mk.textContent = mt;
      }
    } catch (e) {}
    if (btn) btn.textContent = earsOpen ? "EARS SHUT" : "EARS OPEN";
    try { if (window.gap && window.gap.paint) window.gap.paint(); } catch (e) {}
    try {
      var mn = el("duMon");
      if (mn && window.avb && window.avb.monitorOn) {
        var mnt = window.avb.monitorOn() ? "MONITOR OFF" : "MONITOR MAYA";
        if (mn.textContent !== mnt) mn.textContent = mnt;
      }
    } catch (e) {}
    if (feed) {
      var evts = [];
      try { evts = t.events(12) || []; } catch (e) {}
      var html = evts.map(function (e) {
        return "<div>[" + hhmmss(e.at) + "] " + up(e.kind) + " " + String(e.text || "").slice(0, 90) + "</div>";
      }).join("");
      if (feed.__last !== html) {
        feed.__last = html;
        feed.innerHTML = html || "<div>(NOTHING YET - RUN A DEMO TURN.)</div>";
        try { feed.scrollTop = feed.scrollHeight; } catch (e) {}
      }
    }
  }

  function wire() {
    try { if (window.avb && !el("duSig").__avb) window.avb.indicator("duSig"); } catch (e) {}
    var c = el("duClose");
    if (c && !c.__du) { c.__du = true; c.addEventListener("click", function () { close(); }); }
    var m = el("duMic");
    if (m && !m.__du) { m.__du = true; m.addEventListener("click", function () { toggleMic(); }); }
    var d = el("duDemo");
    if (d && !d.__du) { d.__du = true; d.addEventListener("click", function () { demo(); }); }
    var g = el("duGo");
    if (g && !g.__du) { g.__du = true; g.addEventListener("click", function () { goLive(); }); }
    var gp = el("duGap");
    if (gp && !gp.__du) { gp.__du = true; gp.addEventListener("click", function () { try { if (window.gap) window.gap.toggle(); } catch (e) {} paint(); }); }
    var sd = el("duStand");
    if (sd && !sd.__du) { sd.__du = true; sd.addEventListener("click", function () { standDown(); }); }
    setInterval(function () { try { if (isOpen()) paint(); } catch (e) {} }, 400);
    setInterval(function () { try { mayaWatch(); } catch (e) {} }, 500);
    try { chipLoad(); } catch (e) {}
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  window.duet = { show: show, close: close, toggle: toggle, isOpen: isOpen, isCenter: isCenter, paint: paint, demo: demo, toggleEars: toggleEars, shutEars: shutEars, earsOpen: function () { return earsOpen; }, earsToken: function () { return earToken; }, goLive: goLive, standDown: standDown, pipe: togglePipe, monitor: toggleMonitor, bus: bus, floorEdge: floorEdge };
})();
