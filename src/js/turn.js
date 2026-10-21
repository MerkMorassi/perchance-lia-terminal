(function () {
  /* ---- THE TURN CONTROLLER ---------------------------------------------------
     WHEN THE NEXT AGENT SPEAKS. One voice owns the line at a time - his (mic,
     bridge STT), hers (replies, speak-back), or an autonomous lane's (acts).
     Every speaker takes the floor through here; the controller grants it,
     holds STT deaf while she speaks (no recursive loop - her own voice never
     comes back off the wire as his words), and triggers whoever is next when
     the floor frees. A grant with no explicit function fires the speaker's
     registered TRIGGER (turn.triggerFor) - that is the wire to the intercom:
     the next voice actually speaks instead of merely owning the floor.
     Manual hands jump the queue; the kill switch clears it.

     An agent turn ends three ways: its end event (speech done, reply filed),
     VAD SILENCE (fed audio levels stay under the threshold past /turn
     silence), or the TIMEOUT (/turn timeout, the fallback when silence never
     comes - a grant still needs real STANDBY, so it can never talk anyone
     over anyone). Manual hands are never auto-ended: his finger is the end
     signal. Two (or more) AI audio streams alternate on this floor - a second
     stream queues instead of overlapping, and her voice is sacred: nothing
     files over it, not even the stream whose turn it is.

     The autonomous lanes keep their own clocks in this pass - the plug point
     is request("infinity"|"checkin"|"shift", fn): when a lane fires through
     the floor instead of on its own, doubles end. Until then the controller
     arbitrates the voice path (bridge finals -> her reply -> TTS end) and
     reports the whole floor honestly.

     Commands: /turn (status) - /turn floor|queue|clear|log|vad|silence|timeout|triggers|helm
     --------------------------------------------------------------------------- */

  var svc = null;
  function live() {
    return {
      air: function () {
        try { if (window.intercom && window.intercom.air) return String(window.intercom.air()); } catch (e) {}
        try { if (window.voice && window.voice.air) return String(window.voice.air()); } catch (e) {}
        return "STANDBY";
      },
      armed: function () {
        try { if (window.duty && window.duty.armed) return !!window.duty.armed(); } catch (e) {}
        return true;
      }
    };
  }
  function s() { return svc || live(); }

  var holder = null;
  var holderAi = false;
  var holderAt = 0;
  var queue = [];
  var finals = [];
  var dropped = 0;
  var grants = 0;
  var autoEnds = 0;
  var trigFires = 0;
  var triggers = {};
  var events = [];
  var helm = "PILOT";
  var coomLive = false;
  var barbOn = false;
  var barbSince = 0;
  var barbUntil = 0;
  var barbTailMs = 350;
  var barbMaxMs = 60000;
  var barbDrops = 0;
  var patriMuted = true;
  var mayaOn = false;

  function coom(v) {
    if (v == null) return coomLive;
    coomLive = !!v;
    note("GATE", coomLive ? "LIVE - FINALS FLOW" : "ARMED - FINALS HELD");
    paint();
    return coomLive;
  }

  function gatedDrop(from) {
    dropped++;
    note("GATED", String(from || "bridge") + " HELD AT ARMED (" + dropped + ")");
    paint();
    return { ok: false, gated: true, receipt: "TURN :: ARMED, NOT LIVE - FINAL HELD AT THE GATE (" + dropped + " HELD). GO LIVE OPENS IT." };
  }

  function barbLamp(on) {
    var now = Date.now();
    if (on) {
      if (!barbOn) {
        barbOn = true;
        barbSince = now;
        barbUntil = 0;
        note("GATE", "CLOSED - BARB SPEAKS, PATRIKIOS+MAYA GATED");
        try { if (window.duet && window.duet.floorEdge) window.duet.floorEdge("BARBELO", true); } catch (e) {}
      }
      paint();
      return true;
    }
    if (barbOn) {
      barbOn = false;
      barbUntil = now + barbTailMs;
      note("GATE", "TAIL - LAMP OFF, LANES REOPEN IN " + barbTailMs + "MS");
      try { if (window.duet && window.duet.floorEdge) window.duet.floorEdge("BARBELO", false); } catch (e) {}
    }
    paint();
    return barbGated();
  }

  function barbGated() {
    var now = Date.now();
    if (barbOn) return true;
    return now < barbUntil;
  }

  function barbDrop(label) {
    dropped++;
    barbDrops++;
    note("GATED", label + " OVER BARB LAMP (" + barbDrops + ")");
    paint();
    return { ok: false, dropped: true, gated: true, receipt: "TURN :: GATED (BARB) - FINAL DISCARDED, NOT QUEUED (" + barbDrops + " GATED)." };
  }

  function mutePatrikios(v) {
    if (v == null) return patriMuted;
    if (!v) {
      note("MUTE", "UNMUTE REFUSED - PRODUCER IS NON-TALKING");
      paint();
      return true;
    }
    patriMuted = true;
    return true;
  }

  function maya(v) {
    if (v == null) return mayaOn;
    v = !!v;
    if (v !== mayaOn) {
      mayaOn = v;
      note("MAYA", mayaOn ? "ON THE LINE - HER MOUTH WAITS" : "LINE QUIET - HER MOUTH MAY GO");
      paint();
    }
    return mayaOn;
  }

  function bus() {
    try { if (window.duet && window.duet.bus) return window.duet.bus(); } catch (e) {}
    try { if (barbGated()) return "BARBELO"; } catch (e) {}
    try { if (maya()) return "MAYA"; } catch (e) {}
    return "FREE";
  }

  function barbTail(v) {
    if (v == null) return barbTailMs;
    var ms = Math.round(Number(v));
    if (!isFinite(ms)) return barbTailMs;
    barbTailMs = Math.max(0, Math.min(10000, ms));
    return barbTailMs;
  }

  function barbMax(v) {
    if (v == null) return barbMaxMs;
    var ms = Math.round(Number(v));
    if (!isFinite(ms)) return barbMaxMs;
    barbMaxMs = Math.max(1000, Math.min(3600000, ms));
    return barbMaxMs;
  }

  function barbWatch(now) {
    if (barbOn && now - barbSince > barbMaxMs) {
      barbOn = false;
      barbUntil = now;
      note("GATE", "BARB lamp timeout - LAMP FORCED OFF, LANES REOPENED");
      try { print("SYSTEM", "TURN :: BARB lamp timeout - NO ONEND IN " + Math.round(barbMaxMs / 1000) + "S, LAMP FORCED OFF, LANES REOPENED."); } catch (e) {}
      paint();
      return true;
    }
    return false;
  }

  function helmSeat(who) {
    if (who == null) return helm;
    who = String(who).trim().toUpperCase().slice(0, 24) || "PILOT";
    var prev = helm;
    helm = who;
    note("HELM", prev + " RELIEVED - " + helm + " HAS THE HELM");
    return helm;
  }

  function note(kind, text) {
    events.push({ at: Date.now(), kind: String(kind || ""), text: String(text || "") });
    if (events.length > 40) events.splice(0, events.length - 40);
  }
  var vadOn = true;
  var vadThreshold = 0.02;
  var vadSilenceMs = 1500;
  var vadLevel = 0, vadFrom = "none", vadFeedAt = 0, vadLoudAt = 0;
  var FEED_STALE_MS = 5000;
  var floorTimeoutMs = 40000;

  function el(id) { return document.getElementById(id); }

  function free() {
    if (holder) return false;
    try { return s().air() === "STANDBY"; } catch (e) { return false; }
  }

  function runFn(fn) {
    if (typeof fn !== "function") return;
    try {
      var r = fn();
      if (r && typeof r.then === "function") r.then(function () {}, function () {});
    } catch (e) {}
  }

  function request(who, fn, opts) {
    who = String(who || "someone");
    var ai = !!(opts && opts.ai);
    if (ai) {
      try { if (window.duty && window.duty.armed && !window.duty.armed()) return { ok: false, receipt: "TURN :: MASTER OFF - NO AGENT TURNS WHILE THE SHIP IS COLD." }; } catch (e) {}
    }
    var prio = (opts && opts.prio != null) ? Number(opts.prio) : (/liacomm|bridge|mic|manual/i.test(who) ? 0 : 1);
    if (typeof fn !== "function") fn = null;
    if (holder === who) {
      holderAt = Date.now();
      runFn(fn);
      paint();
      return { granted: true, holder: who, refreshed: true };
    }
    if (free()) {
      holder = who;
      holderAi = ai;
      holderAt = Date.now();
      vadLoudAt = holderAt;
      grants++;
      note("GRANT", who + (ai ? " (AGENT)" : ""));
      if (fn) runFn(fn); else fireTrigger(who);
      paint();
      return { granted: true, holder: who };
    }
    var item = { who: who, fn: fn, ai: ai, prio: prio, at: Date.now() };
    var i = queue.length;
    while (i > 0 && queue[i - 1].prio > prio) i--;
    queue.splice(i, 0, item);
    note("QUEUE", who + " #" + (i + 1));
    paint();
    return { granted: false, queued: true, pos: i + 1 };
  }

  function release(who) {
    if (who && holder && holder !== String(who)) return false;
    if (holder) note("RELEASE", holder);
    holder = null;
    holderAi = false;
    holderAt = 0;
    paint();
    tick();
    return true;
  }

  function clear(why) {
    var n = queue.length + (holder ? 1 : 0);
    queue = [];
    holder = null;
    holderAi = false;
    holderAt = 0;
    note("CLEAR", n + " DROPPED (" + String(why || "clear") + ")");
    paint();
    return { cleared: n, why: String(why || "clear") };
  }

  function tick() {
    if (!free() || !queue.length) { paint(); return null; }
    var next = queue.shift();
    holder = next.who;
    holderAi = !!next.ai;
    holderAt = Date.now();
    vadLoudAt = holderAt;
    grants++;
    note("GRANT", holder + (holderAi ? " (AGENT)" : ""));
    if (next.fn) runFn(next.fn); else fireTrigger(next.who);
    paint();
    return holder;
  }

  // NO RECURSIVE LOOP. While she speaks, the ears are shut: bridge STT
  // consults this before filing anything, and hearFinal drops with count.
  function sttHeld() {
    if (barbGated()) return true;
    if (holder && !/liacomm|bridge|mic|manual/i.test(holder)) return true;
    try { return s().air() === "HER VOICE"; } catch (e) { return false; }
  }

  // LOG ONLY FINAL SEGMENTS. Partials never reach here (the server sends
  // finals alone, the client drops anything unmarked) - and a final that
  // lands while she holds the floor is dropped, counted, and said out loud.
  // HER VOICE IS SACRED: nothing files over it, not even the stream whose
  // turn it is. A second stream files only once the floor is actually its own.
  // PRIVATE MODE (2026-10-21): while the GUESTCOMM line is up the only road
  // is HITL<>MAYA over the iRig - bridge/uplink finals would hand the call
  // to Barbelo, so they drop here (the backstop behind every caller).
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }
  function hearFinal(text, from, speaker) {
    text = String(text == null ? "" : text).trim();
    if (!text) return { ok: false, receipt: "TURN :: EMPTY FINAL - NOTHING FILED." };
    if (guestUp()) { dropped++; note("DROP", String(from || "bridge") + " PRIVATE (" + dropped + ")"); paint(); return { ok: false, dropped: true, receipt: "TURN :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY) - FINAL DROPPED, NOT FILED (" + dropped + " DROPPED)." }; }
    try { if (window.duty && window.duty.armed && !window.duty.armed()) { dropped++; note("DROP", String(from || "bridge") + " AT MASTER OFF (" + dropped + ")"); paint(); return { ok: false, dropped: true, receipt: "TURN :: MASTER OFF - FINAL DROPPED, NOT FILED (" + dropped + " DROPPED)." }; } } catch (e) {}
    try { if (!coom()) return gatedDrop(from); } catch (e) {}
    try { if (barbGated()) return barbDrop(String(from || "bridge")); } catch (e) {}
    var rec = { text: text.slice(0, 500), from: String(from || "bridge"), at: Date.now() };
    var label = String(speaker || rec.from || "bridge").trim().toUpperCase().slice(0, 12) || "BRIDGE";
    if (rec.text.toUpperCase().indexOf(label + ":") !== 0) rec.text = label + ": " + rec.text;
    var a = "STANDBY";
    try { a = s().air(); } catch (e) {}
    if (a === "HER VOICE" || (holder && holder !== rec.from && holderAi)) {
      dropped++;
      var whose = (a === "HER VOICE") ? "SHE HOLDS THE FLOOR" : holder + " HOLDS THE FLOOR";
      note("DROP", rec.from + " OVER " + whose + " (" + dropped + ")");
      paint();
      return { ok: false, dropped: true, receipt: "TURN :: " + whose + " - FINAL DROPPED, NOT FILED (" + dropped + " DROPPED). " };
    }
    finals.push(rec);
    if (finals.length > 40) finals.splice(0, finals.length - 40);
    takeFloor(rec.from);
    note("FILE", rec.from + " " + rec.text.length + " CHARS");
    try {
      var box = el("userInput");
      if (box) box.value = (box.value ? box.value + " " : "") + rec.text;
    } catch (e) {}
    try {
      if (window.send) {
        var tries = 30;
        (function trySend() {
          try {
            var b = el("sendBtn");
            if (b && b.disabled && tries-- > 0) { setTimeout(trySend, 1000); return; }
            window.send({ silent: true, speaker: label });
          } catch (e) {}
        })();
      }
    } catch (e) {}
    paint();
    return { ok: true, receipt: "TURN :: FINAL FILED (" + rec.text.length + " CHARS) - HER REPLY COMES NEXT." };
  }

  // PATRIKIOS'S OWN LANE. His words land in his input field, labeled, never sent -
  // his finger sends. A copy files to shared history beside it. MAYA lanes never touch the box at all.
  // PRIVATE MODE: his wireless-mic lane drops too while the line is up.
  function hearPatrikios(text, speaker) {
    text = String(text == null ? "" : text).trim();
    if (!text) return { ok: false, receipt: "TURN :: EMPTY FINAL - NOTHING FILED." };
    if (guestUp()) { dropped++; note("DROP", "patrikios PRIVATE (" + dropped + ")"); paint(); return { ok: false, dropped: true, receipt: "TURN :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY) - FINAL DROPPED, NOT FILED (" + dropped + " DROPPED)." }; }
    var label = String(speaker || "SPK-PATRIKIOS").trim().toUpperCase().slice(0, 16) || "SPK-PATRIKIOS";
    if (label === "SPK-MERK" || label === "MERK") label = "SPK-PATRIKIOS";
    if (label.indexOf("PATRIKIOS") < 0 && label.indexOf("SPK-") !== 0) label = "SPK-PATRIKIOS";
    try { if (window.duty && window.duty.armed && !window.duty.armed()) { dropped++; note("DROP", label + " AT MASTER OFF (" + dropped + ")"); paint(); return { ok: false, dropped: true, receipt: "TURN :: MASTER OFF - FINAL DROPPED, NOT FILED (" + dropped + " DROPPED)." }; } } catch (e) {}
    try { if (!coom()) return gatedDrop(label); } catch (e) {}
    try { if (mutePatrikios()) { dropped++; note("MUTED", label + " MUTED (" + dropped + ")"); paint(); return { ok: false, dropped: true, muted: true, receipt: "TURN :: PATRIKIOS MUTED - HE HEARS BOTH, FILES NOTHING." }; } } catch (e) {}
    try { if (barbGated()) return barbDrop(label); } catch (e) {}
    var line = "[" + label + "] " + text.slice(0, 500);
    try {
      var box = el("userInput");
      if (box) box.value = (box.value ? box.value + " " : "") + line;
    } catch (e) {}
    try {
      if (window.chatHistory) {
        window.chatHistory.push({ role: "PATRIKIOS", content: text.slice(0, 500), ts: Date.now(), layer: "" });
        if (window.chatHistory.length > 200) window.chatHistory.splice(0, window.chatHistory.length - 200);
      }
    } catch (e) {}
    note("FIELD", label + " " + text.length + " CHARS TO HIS BOX");
    paint();
    return { ok: true, receipt: "TURN :: " + label + " IN HIS FIELD (" + text.length + " CHARS) - HIS FINGER SENDS." };
  }

  // A FILED FINAL IS VOICE ACTIVITY. The filing stream takes the floor as an
  // agent turn (a repeat filing across one utterance refreshes the hold), so
  // the VAD and the timeout both see it and a second stream queues behind it.
  function takeFloor(who) {
    who = String(who || "someone");
    if (holder === who) { holderAt = Date.now(); return { held: true, refreshed: true }; }
    if (holder) return { held: false, kept: holder };
    holder = who;
    holderAi = true;
    holderAt = Date.now();
    vadLoudAt = holderAt;
    paint();
    return { held: true };
  }

  function fireTrigger(who) {
    var t = triggers[String(who || "")];
    if (typeof t !== "function") return false;
    trigFires++;
    note("TRIGGER", who + " FIRED");
    var done = false;
    try {
      t(function () {
        if (done) return false;
        done = true;
        release(who);
        return true;
      });
    } catch (e) {}
    paint();
    return true;
  }

  function triggerFor(who, fn) {
    who = String(who || "").trim();
    if (!who) return { ok: false, receipt: "TURN :: NAME THE SPEAKER FIRST." };
    if (fn == null) {
      var had = Object.prototype.hasOwnProperty.call(triggers, who);
      delete triggers[who];
      return { ok: had, receipt: had ? "TURN :: " + who + " UNWIRED - NO TRIGGER FIRES FOR THEM." : "TURN :: " + who + " HAD NO TRIGGER." };
    }
    if (typeof fn !== "function") return { ok: false, receipt: "TURN :: THE TRIGGER IS A FUNCTION (done) - NOTHING WIRED." };
    triggers[who] = fn;
    return { ok: true, receipt: "TURN :: " + who + " WIRED - THE NEXT GRANT MAKES THEM SPEAK." };
  }

  // VAD. turn.vadFeed(level01, from) reports the sound on the line from any
  // source - a playback analyser, a bridge audio tap, a test. The room meter
  // feeds it unasked when it runs (see implicitFeed), so a duet over speakers
  // is watched with zero wiring. No feed, no judgment: the timeout covers it.
  function vadFeed(level, from) {
    var v = Number(level);
    if (!isFinite(v)) return { ok: false };
    v = Math.max(0, Math.min(1, v));
    vadLevel = v;
    vadFrom = String(from || "feed");
    vadFeedAt = Date.now();
    if (v >= vadThreshold) vadLoudAt = vadFeedAt;
    return { ok: true, level: v };
  }

  function implicitFeed() {
    try {
      var v = window.voice;
      if (!v || typeof v.level !== "function") return false;
      var L = v.level() || {};
      if (!L.meter || !isFinite(Number(L.rms))) return false;
      vadFeed(Number(L.rms), "room");
      return true;
    } catch (e) { return false; }
  }

  function vadTick(now) {
    if (!vadOn || !holder || !holderAi) return;
    if (now - vadFeedAt > FEED_STALE_MS) implicitFeed();
    if (now - vadFeedAt > FEED_STALE_MS) return;
    if (vadLevel >= vadThreshold) return;
    var quietFor = now - Math.max(holderAt, vadLoudAt);
    if (quietFor >= vadSilenceMs) endTurn("SILENCE", "QUIET " + (Math.round(quietFor / 100) / 10) + "S");
  }

  // THE TIMEOUT, the fallback under the VAD. Manual hands are never timed.
  function timeoutTick(now) {
    if (!holder || !holderAi || !(floorTimeoutMs > 0)) return;
    if (now - holderAt >= floorTimeoutMs) endTurn("TIMEOUT", "HELD PAST " + Math.round(floorTimeoutMs / 1000) + "S");
  }

  function endTurn(why, detail) {
    if (!holder) return null;
    var who = holder;
    var heldMs = Date.now() - holderAt;
    holder = null;
    holderAi = false;
    holderAt = 0;
    autoEnds++;
    note(why, who + " AFTER " + (Math.round(heldMs / 100) / 10) + "S");
    try { print("SYSTEM", "TURN :: " + who + " - " + why + " AFTER " + (Math.round(heldMs / 100) / 10) + "S" + (detail ? " (" + detail + ")" : "") + " - FLOOR FREE, NEXT TRIGGERED."); } catch (e) {}
    paint();
    tick();
    return who;
  }

  function silenceMs(v) {
    if (v == null) return vadSilenceMs;
    var t = String(v).toLowerCase().trim();
    if (t === "off" || t === "0" || t === "no" || t === "false") { vadOn = false; return 0; }
    var ms = Math.round(Number(t));
    if (!isFinite(ms)) return vadSilenceMs;
    vadSilenceMs = Math.max(200, Math.min(30000, ms));
    vadOn = true;
    return vadSilenceMs;
  }

  function vadLevelSet(v) {
    if (v == null) return vadThreshold;
    var t = Number(v);
    if (!isFinite(t)) return vadThreshold;
    vadThreshold = Math.max(0.001, Math.min(0.5, t));
    return vadThreshold;
  }

  function vadOnOff(v) {
    if (v == null) return vadOn;
    var t = String(v).toLowerCase().trim();
    if (/^(on|yes|true|1)$/.test(t)) vadOn = true;
    else if (/^(off|no|false|0)$/.test(t)) vadOn = false;
    return vadOn;
  }

  function timeoutSet(v) {
    if (v == null) return floorTimeoutMs;
    var t = String(v).toLowerCase().trim();
    if (t === "off" || t === "0" || t === "no" || t === "false") { floorTimeoutMs = 0; return 0; }
    var s = Number(t);
    if (!isFinite(s)) return floorTimeoutMs;
    floorTimeoutMs = Math.max(500, Math.min(3600000, Math.round(s * 1000)));
    return floorTimeoutMs;
  }

  function floor() {
    var a = "STANDBY";
    try { a = s().air(); } catch (e) {}
    var now = Date.now();
    return { holder: holder, ai: holderAi, heldMs: holder ? now - holderAt : 0,
      queue: queue.map(function (q) { return q.who; }), air: a, sttHeld: sttHeld(),
      grants: grants, dropped: dropped, autoEnds: autoEnds, trigFires: trigFires,
      triggers: Object.keys(triggers), helm: helm, gate: coomLive ? "LIVE" : "ARMED",
      patriMuted: patriMuted, maya: mayaOn, bus: bus(),
      barb: { on: barbOn, gated: barbGated(), tailMs: barbTailMs, maxMs: barbMaxMs, drops: barbDrops },
      vad: { on: vadOn, threshold: vadThreshold, silenceMs: vadSilenceMs, level: vadLevel,
        from: vadFrom, feedAgeMs: vadFeedAt ? now - vadFeedAt : -1,
        quietMs: holder ? now - Math.max(holderAt, vadLoudAt) : 0 },
      timeoutMs: floorTimeoutMs };
  }

  function status() {
    var f = floor();
    return "TURN :: HOLDER " + (f.holder || "NONE") + (f.holder && f.ai ? " (AGENT)" : "") + " - AIR " + f.air + " - QUEUE ["
      + (f.queue.join(", ") || "EMPTY") + "] - STT " + (f.sttHeld ? "HELD (SHE SPEAKS)" : "OPEN")
      + " - " + f.grants + " GRANTS, " + finals.length + " FINALS FILED, " + f.dropped + " DROPPED, "
      + f.autoEnds + " AUTO-ENDED - VAD " + (f.vad.on ? "ON (QUIET " + f.vad.silenceMs + "MS ENDS AN AGENT TURN)" : "OFF")
      + " - TIMEOUT " + (f.timeoutMs > 0 ? Math.round(f.timeoutMs / 1000) + "S" : "OFF")
      + " - TRIGGERS [" + (f.triggers.join(", ") || "NONE") + "]"
      + " - HELM " + f.helm + " - GATE " + f.gate + ".";
  }

  function describe() {
    return ["THE TURN CONTROLLER :: one voice owns the line at a time.",
      "  " + status(),
      "  TAKE IT: turn.request(who, fn) - manual hands (liacomm, bridge, mic) jump autonomous lanes.",
      "  LEAVE IT: turn.release(who) - the next in line is triggered when the floor frees.",
      "  TRIGGER: turn.triggerFor(who, fn) wires a speaker's mouth - a grant with no fn fires it with done(), and done() releases the floor and triggers whoever is next. THE INTERCOM IS THE MOUTH: intercom.aiTurn(who, text) speaks one agent turn over the key through this floor.",
      "  VAD: while an agent holds the floor, fed levels (0-1, turn.vadFeed) track the sound on the line; quiet past the silence ends the turn. The room meter feeds it unasked when it runs. No feed, no judgment - the timeout covers it.",
      "  TIMEOUT: /turn timeout caps every agent hold - expiry frees the floor and triggers next. A grant still needs real STANDBY, so the timeout can never talk anyone over anyone. Manual hands are never auto-ended.",
      "  A DUET: bridge ears open + auto-read on + her replies spoken aloud = two AI audio streams alternating on this floor; a third stream queues instead of overlapping. The other AI hears her stop and speaks; its finals file, she answers, her end releases the floor, and the next trigger fires.",
      "  KILL SWITCH: turn.clear() drops the queue and the holder - radio silence.",
      "  NO LOOP: STT is held deaf while she speaks; only final segments are ever filed.",
      "  BARB LAMP: turn.barb(true/false) is the speaking lamp - while lit (plus the tail) PATRIKIOS and MAYA finals are DISCARDED, not queued. turn.barbTail()/barbMax() read the 350ms tail and 60s failsafe.",
      "  /turn floor|queue|clear|log|vad|silence|timeout|triggers|helm - the floor in words."].join("\n");
  }

  function logText(n) {
    var list = finals.slice(-(n || 10));
    if (!list.length) return "TURN :: NO FINALS FILED YET.";
    return "TURN :: LAST " + list.length + " FINALS:\n" + list.map(function (f, i) {
      return "  " + (i + 1) + ". [" + f.from + "] " + f.text.slice(0, 120);
    }).join("\n");
  }

  async function words(arg) {
    var t = String(arg || "").toLowerCase().trim();
    if (!t) return status();
    if (/^floor/.test(t)) { var f = floor(); return "TURN :: HOLDER " + (f.holder || "NONE") + " - AIR " + f.air + " - STT " + (f.sttHeld ? "HELD" : "OPEN") + "."; }
    if (/^queue/.test(t)) { var q = floor().queue; return "TURN :: QUEUE " + (q.length ? q.join(" > ") : "EMPTY") + "."; }
    if (/^clear/.test(t)) { var c = clear("words"); return "TURN :: DROPPED " + c.cleared + " FROM THE FLOOR. RADIO SILENCE."; }
    if (/^log/.test(t)) { var m = t.match(/log\s+(\d+)/); return logText(m ? Number(m[1]) : 10); }
    if (/^triggers/.test(t)) { var tr = floor().triggers; return "TURN :: TRIGGERS " + (tr.length ? tr.join(", ") : "NONE WIRED - turn.triggerFor(who, fn) WIRES A SPEAKER'S MOUTH.") + "."; }
    if (/^helm/.test(t)) {
      var hn = t.replace(/^helm/, "").trim();
      if (hn) {
        var prev = helmSeat();
        helmSeat(hn);
        return "TURN :: " + prev + " RELIEVED - " + helmSeat() + " HAS THE HELM. THE SEAT IS RECORDED, NOTHING ELSE CHANGES YET.";
      }
      return "TURN :: " + helmSeat() + " HAS THE HELM.";
    }
    if (/^vad/.test(t)) {
      var v = floor().vad;
      var tail = t.replace(/^vad/, "").trim();
      if (/^(on|yes|true|1|off|no|false|0)$/.test(tail)) vadOnOff(tail);
      v = floor().vad;
      return "TURN :: VAD " + (v.on ? "ON - QUIET " + v.silenceMs + "MS UNDER " + v.threshold + " ENDS AN AGENT TURN" : "OFF - THE TIMEOUT STANDS ALONE")
        + " - LAST LEVEL " + v.level + " (" + v.from + ", " + (v.feedAgeMs < 0 ? "NEVER FED" : Math.round(v.feedAgeMs / 100) / 10 + "S AGO") + ").";
    }
    if (/^silence/.test(t)) {
      var st = t.replace(/^silence/, "").trim();
      if (st) silenceMs(st);
      var sv = silenceMs();
      return vadOn ? "TURN :: SILENCE " + sv + "MS - QUIET THAT LONG ENDS AN AGENT TURN. /turn silence off STOPS THE VAD." : "TURN :: VAD SILENCE OFF - AGENT TURNS END ON THEIR END EVENT OR THE TIMEOUT.";
    }
    if (/^vlevel/.test(t)) {
      var lt = t.replace(/^vlevel/, "").trim();
      if (lt) vadLevelSet(lt);
      return "TURN :: VAD THRESHOLD " + vadLevelSet() + " - LEVELS UNDER IT COUNT AS QUIET.";
    }
    if (/^timeout/.test(t)) {
      var tt = t.replace(/^timeout/, "").trim();
      if (tt) timeoutSet(tt);
      var tv = timeoutSet();
      return tv > 0 ? "TURN :: TIMEOUT " + Math.round(tv / 1000) + "S - AN AGENT HOLD PAST IT IS FREED AND THE NEXT IS TRIGGERED." : "TURN :: TIMEOUT OFF - A TURN WITH NO END EVENT AND NO SILENCE HOLDS FOREVER.";
    }
    return "USAGE: /turn - /turn floor|queue|clear|log|vad|silence|timeout|triggers|helm\n" + describe();
  }

  function paint() {}

  setInterval(function () {
    try { tick(); } catch (e) {}
    try { var n = Date.now(); vadTick(n); timeoutTick(n); barbWatch(n); } catch (e) {}
  }, 800);

  window.turn = {
    request: request, release: release, clear: clear, tick: tick,
    sttHeld: sttHeld, hearFinal: hearFinal, floor: floor,
    triggerFor: triggerFor, takeFloor: takeFloor, end: endTurn,
    vadFeed: vadFeed, silence: silenceMs, vlevel: vadLevelSet, vad: vadOnOff, timeout: timeoutSet,
    helm: helmSeat, coom: coom, hearMerk: hearPatrikios, hearPatrikios: hearPatrikios, gateDrop: gatedDrop,
    barb: barbLamp, barbGated: barbGated, barbTail: barbTail, barbMax: barbMax,
    mutePatrikios: mutePatrikios, maya: maya, bus: bus,
    events: function (n) { return events.slice(-(n || 12)); },
    status: status, describe: describe, words: words, paint: paint,
    use: function (v) { svc = v || null; }
  };
})();
