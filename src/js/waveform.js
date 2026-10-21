window.waveform = (function () {
  "use strict";

  /* ---- THE WAVEFORM ----------------------------------------------------------
     THE SPEAKING WAVEFORM IN THE CHAT INTERFACE. One canvas strip in the LOWER
     DECK, above the input box, that moves while a voice is on the line:

       HER VOICE   she is speaking (TTS, the live wire's mouth, a clip on the
                   bus, a story part) - bright green, driven by her audio.
       YOUR VOICE  the microphone is open and the room is loud - spring green,
                   driven by the room meter.
       THINKING / HOLDING  her turn is being made, or his words are held -
                   a slow pulse, so the strip is never dead while the line
                   is busy.
       STANDBY     nobody on the line - a faint breathing line.

     SOURCES, in priority order (every read is guarded - a missing module is
     a missing source, never an error):

       AI   voice.isSpeaking() / voice.state().speaking (browser TTS +
            ElevenLabs <audio>), live speaking (the wire's mouth), any
            <audio> element currently playing (hooked through one shared
            AudioContext + AnalyserNode each - the browser TTS exposes no
            audio at all, so while it speaks the strip is driven by a
            pseudo envelope instead, which is honest: the SHAPE is
            synthesized, the TIMING is real).
       USER voice.level() (THE ROOM HEARS YOU - the analyser on the mic),
            live.level() (the wire's own capture), avb.read() (mic / cable
            / room), turn's VAD level. The max of whatever is live wins.
       BUS  audition.state() while a piece is on the bus, story.js while a
            part plays - both counted as HER VOICE, since it is sound of
            hers in the room.

     NOTHING OPENS WITHOUT A PRESS. The shared AudioContext is created on
     the first gesture and resumed on every press; the microphone is never
     opened here - the room numbers are read off the meters the voice lane
     already runs. Muted (amute off) dims the strip but never hides it.

     Commands: /wave - /wave on|off|toggle|status - the strip in words.
     --------------------------------------------------------------------------- */

  var FOLDER = "lia_settings";
  var KEY = "waveform";

  var show = true;
  var loaded = false;

  // External pushes (avb.feed, tests, callers with a real number).
  var fedLevel = 0, fedAt = 0;

  // Smoothed display level (attack fast, release slow).
  var smooth = 0;

  // The shared context for <audio> playback analysis (AI clips). Created
  // on the first gesture; hooking an element never changes what it plays
  // (source -> analyser -> destination).
  var actx = null;
  var hooked = new WeakMap();
  var taps = [];
  var ctxWanted = false;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function clamp01(v) { v = Number(v); if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }
  function say(t) { try { if (typeof print === "function") print("SYSTEM", String(t)); } catch (e) {} }

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  // ---- settings -----------------------------------------------------------

  async function load() {
    if (loaded) return { show: show };
    loaded = true;
    var k = kv();
    if (k) {
      try {
        var rec = await k.get(KEY);
        if (rec && typeof rec === "object" && typeof rec.show === "boolean") show = rec.show;
      } catch (e) {}
    }
    try { paintVisibility(); } catch (e) {}
    return { show: show };
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, { show: !!show }); return true; }
    catch (e) { return false; }
  }

  // ---- sensing ------------------------------------------------------------

  function voiceAir() {
    try { if (window.voice && window.voice.air) return String(window.voice.air()); }
    catch (e) {}
    return "STANDBY";
  }

  function voiceSpeaking() {
    try { if (window.voice && window.voice.isSpeaking) return !!window.voice.isSpeaking(); }
    catch (e) {}
    try { if (window.voice && window.voice.state) return !!window.voice.state().speaking; }
    catch (e) {}
    return false;
  }

  function voiceListening() {
    try { if (window.voice && window.voice.isListening) return !!window.voice.isListening(); }
    catch (e) {}
    try { if (window.voice && window.voice.state) return !!window.voice.state().listening; }
    catch (e) {}
    return false;
  }

  function voiceRms() {
    try { if (window.voice && window.voice.level) { var L = window.voice.level() || {}; if (isFinite(Number(L.rms))) return clamp01(Number(L.rms)); } }
    catch (e) {}
    try { if (window.voice && window.voice.state) { var s = window.voice.state() || {}; if (isFinite(Number(s.level))) return clamp01(Number(s.level)); } }
    catch (e) {}
    return 0;
  }

  function voiceLoud() {
    try { if (window.voice && window.voice.state) return !!window.voice.state().levelLoud; }
    catch (e) { return false; }
  }

  function wireSpeaking() {
    try { if (window.live && window.live.speaking) return !!window.live.speaking(); }
    catch (e) {}
    return false;
  }

  function wireRms() {
    try { if (window.live && window.live.level) { var L = window.live.level() || {}; if (isFinite(Number(L.rms))) return clamp01(Number(L.rms)); } }
    catch (e) {}
    return 0;
  }

  function avbLevel() {
    try { if (window.avb && window.avb.read) { var r = window.avb.read() || {}; if (r.live && isFinite(Number(r.level))) return clamp01(Number(r.level)); } }
    catch (e) {}
    return 0;
  }

  function turnVad() {
    // turn keeps the LAST fed level forever (vadLevel is only overwritten by
    // the next feed), so a stale feed would pin the strip on YOUR VOICE.
    // floor() reports the feed's age - anything older than the push window
    // is silence, whatever the stored number says.
    try { if (window.turn && window.turn.floor) {
      var f = window.turn.floor() || {};
      if (f.vad && isFinite(Number(f.vad.level))) {
        var age = Number(f.vad.feedAgeMs);
        if (isFinite(age) && age >= 0 && age > 2000) return 0;
        return clamp01(Number(f.vad.level));
      }
    } }
    catch (e) {}
    return 0;
  }

  function busPlaying() {
    try { if (window.audition && window.audition.state) { var st = window.audition.state() || {}; if (st.playing || st.id) return true; } }
    catch (e) {}
    try { if (window.story && window.story.playing) return !!window.story.playing(); }
    catch (e) {}
    return false;
  }

  function audioOut() {
    // Any <audio>/<video> with sound on this page (her ElevenLabs clip, a
    // story part, a clip preview). Counted as sound in the room.
    var n = 0;
    try {
      var nodes = document.querySelectorAll("audio, video");
      for (var i = 0; i < nodes.length; i++) {
        var m = nodes[i];
        try { if (!m.paused && !m.ended && !m.muted && m.volume > 0) n++; } catch (e) {}
      }
    } catch (e) {}
    return n;
  }

  function tapRms() {
    // The loudest hooked <audio> analyser currently playing.
    var best = 0;
    for (var i = 0; i < taps.length; i++) {
      var t = taps[i];
      try {
        if (!t.el || t.el.paused || t.el.ended || t.el.muted) continue;
        t.an.getByteTimeDomainData(t.buf);
        var sum = 0;
        for (var j = 0; j < t.buf.length; j++) { var v = (t.buf[j] - 128) / 128; sum += v * v; }
        var rms = Math.sqrt(sum / t.buf.length);
        if (rms > best) best = rms;
      } catch (e) {}
    }
    return clamp01(best);
  }

  function userLevel() {
    var best = 0;
    best = Math.max(best, voiceRms());
    best = Math.max(best, wireRms());
    best = Math.max(best, avbLevel());
    best = Math.max(best, turnVad());
    if (Date.now() - fedAt < 2000) best = Math.max(best, fedLevel);
    return clamp01(best);
  }

  function muted() {
    try { if (window.amute && window.amute.on) return !window.amute.on(); }
    catch (e) {}
    return false;
  }

  // GUESTCOMM's own roads (src/js/guest.js). While the private line is up the
  // lower-deck strip reads her iRig road and his mic straight off the call's
  // analysers - realtime, not the fixed 0.45 an <audio> element alone gives.
  function guestLive() {
    try {
      if (window.guest && window.guest.isUp && window.guest.isUp()
        && window.guest.levels) return window.guest.levels() || null;
    } catch (e) {}
    return null;
  }

  // The one answer the strip paints: whose voice, and how loud (0-1).
  function sense() {
    // THE PRIVATE LINE wins while it is up: her road as HER VOICE, his mic
    // as YOUR VOICE, both at the call's own realtime levels.
    var g = guestLive();
    if (g) {
      var gh = clamp01(Number(g.her) || 0), gm = clamp01(Number(g.mic) || 0);
      if (gh > 0.03) return { mode: "ai", air: "GUEST", level: clamp01(gh * 4), live: true, label: "GUEST" };
      if (gm > 0.03) return { mode: "user", air: "GUEST", level: clamp01(gm * 4), live: true, label: "YOU" };
      return { mode: "busy", air: "GUEST", level: 0, live: true, label: "ON THE LINE" };
    }
    var air = voiceAir();
    var aiSpeak = voiceSpeaking() || wireSpeaking();
    var tap = tapRms();
    var out = audioOut();
    var bus = busPlaying();
    var usr = userLevel();
    var loud = voiceLoud();

    // HER VOICE: she is speaking, her clip is playing, or the bus/story
    // has sound. The wire's mouth counts here too.
    if (air === "HER VOICE" || aiSpeak || tap > 0.03 || out > 0 || bus) {
      var aiLevel = Math.max(tap, out > 0 ? 0.45 : 0, aiSpeak ? 0.5 : 0, bus ? 0.35 : 0);
      return { mode: "ai", air: air, level: clamp01(aiLevel), live: true, label: "HER VOICE" };
    }
    // YOUR VOICE: the mic is open and the room is loud.
    if (air === "YOUR VOICE" || ((voiceListening() || air === "HOLDING") && (loud || usr > 0.02)) || usr > 0.06) {
      return { mode: "user", air: air, level: clamp01(Math.max(usr, loud ? 0.35 : 0)), live: true, label: "YOUR VOICE" };
    }
    // Busy but quiet: her turn being made, words held, audition lamp.
    if (air === "HER TURN" || air === "HOLDING" || air === "AUDITION") {
      return { mode: "busy", air: air, level: 0, live: true, label: air };
    }
    return { mode: "idle", air: air, level: 0, live: false, label: "STANDBY" };
  }

  // ---- playback taps ------------------------------------------------------

  function ensureCtx() {
    if (actx || !ctxWanted) return actx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      if (actx.state === "suspended" && actx.resume) actx.resume().catch(function () {});
    } catch (e) { actx = null; }
    return actx;
  }

  function hookAudioNode(media) {
    if (!media || hooked.has(media)) return;
    var ctx = ensureCtx();
    if (!ctx) return;
    try {
      if (!ctx.createMediaElementSource) return;
      var src = ctx.createMediaElementSource(media);
      var an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.4;
      src.connect(an);
      try { an.connect(ctx.destination); } catch (e) {}
      var tap = { el: media, an: an, buf: new Uint8Array(an.fftSize) };
      taps.push(tap);
      hooked.set(media, tap);
      if (taps.length > 12) taps.splice(0, taps.length - 12);
    } catch (e) {
      // createMediaElementSource throws if something else hooked it first -
      // mark it so it is never tried again.
      try { hooked.set(media, null); } catch (e2) {}
    }
  }

  function hookAll() {
    if (!ctxWanted) return;
    var nodes = null;
    try { nodes = document.querySelectorAll("audio, video"); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) hookAudioNode(nodes[i]);
  }

  function armAudio() {
    ctxWanted = true;
    ensureCtx();
    hookAll();
  }

  // ---- the strip ----------------------------------------------------------

  var wrap = null, canvas = null, labelEl = null, stateEl = null;
  var ctx2d = null;
  // THE PUMP is a plain interval, not requestAnimationFrame: the strip must
  // keep sampling the line even while this tab is in the background (rAF
  // stops there), and 20fps is plenty for bars. Hidden pages are throttled
  // by the browser itself; frame() additionally skips all drawing while
  // document.hidden, so a background tab costs one sense() per tick.
  var pumpTimer = null;
  var lastLabel = "";
  var lastMode = "";
  var t0 = Date.now();

  function mount() {
    if (wrap && wrap.isConnected) return wrap;
    var deck = el("command-deck");
    // First in the COMMs flow: the waveform sits above the lower-deck TALK key (#pttBtn),
    // which sits above the input box. Anchor to the key when it is there.
    var box = el("pttBtn") || el("userInput");
    if (!deck || !box) return null;
    wrap = document.createElement("div");
    wrap.id = "waveWrap";
    wrap.className = "waveWrap";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "off");
    wrap.title = "the speaking waveform - HER VOICE while she speaks, YOUR VOICE while the microphone hears you. /wave says it in words.";

    labelEl = document.createElement("span");
    labelEl.id = "waveLabel";
    labelEl.className = "waveLabel";
    labelEl.textContent = "STANDBY";

    canvas = document.createElement("canvas");
    canvas.id = "waveCanvas";
    canvas.className = "waveCanvas";
    canvas.setAttribute("aria-hidden", "true");

    stateEl = document.createElement("span");
    stateEl.id = "waveState";
    stateEl.className = "waveState";
    stateEl.textContent = "";

    wrap.appendChild(labelEl);
    wrap.appendChild(canvas);
    wrap.appendChild(stateEl);
    try { deck.insertBefore(wrap, box); } catch (e) { return null; }

    try {
      ctx2d = canvas.getContext("2d");
    } catch (e) { ctx2d = null; }

    // Clicking the strip never sends anything: it toggles nothing, it only
    // reports. Double-click hides it (/wave on brings it back).
    wrap.addEventListener("dblclick", function () { hide(true); });

    size();
    paintVisibility();
    return wrap;
  }

  function paintVisibility() {
    if (!wrap) return;
    try { wrap.hidden = !show; } catch (e) {}
  }

  function size() {
    if (!canvas) return;
    try {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(80, Math.floor(r.width));
      var h = 44;
      var dpr = Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1)));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      canvas.style.height = h + "px";
    } catch (e) {}
  }

  function paintLabel(mode, label, isMuted) {
    var txt = isMuted ? (label + " · MUTED") : label;
    if (txt !== lastLabel && labelEl) {
      lastLabel = txt;
      labelEl.textContent = txt;
    }
    var cls = "waveLabel" + (mode === "ai" ? " ai" : mode === "user" ? " user" : mode === "busy" ? " busy" : "");
    if (labelEl && labelEl.className !== cls) labelEl.className = cls;
    if (wrap) {
      var wc = "waveWrap" + (mode === "ai" ? " speaking-ai" : mode === "user" ? " speaking-user" : mode === "busy" ? " busy" : "") + (isMuted ? " muted" : "");
      if (wrap.className !== wc) wrap.className = wc;
    }
  }

  function draw(mode, display, t) {
    if (!ctx2d || !canvas) return;
    var dpr = Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1)));
    var w = canvas.width, h = canvas.height;
    var mid = h / 2;
    ctx2d.clearRect(0, 0, w, h);

    // The resting line.
    ctx2d.fillStyle = mode === "idle" ? "#003300" : "#004400";
    ctx2d.fillRect(0, Math.floor(mid) - 1, w, 2 * dpr > 2 ? 2 : 1);

    var color = mode === "ai" ? "#00ff00" : mode === "user" ? "#33ff77" : mode === "busy" ? "#00aa00" : "#005500";
    if (muted()) color = mode === "idle" ? "#003300" : "#006600";
    ctx2d.fillStyle = color;

    var n = Math.max(24, Math.floor(w / (5 * dpr)));
    var gap = (w / n);
    var bw = Math.max(dpr, gap * 0.55);
    var maxAmp = mid - 2 * dpr;

    for (var i = 0; i < n; i++) {
      var ph = 0;
      if (!reducedMotion()) {
        ph = Math.abs(Math.sin(t * 3.1 + i * 0.45) * Math.sin(t * 1.7 + i * 0.13));
      } else {
        ph = Math.abs(Math.sin(i * 0.45) * Math.sin(i * 0.13));
      }
      // Pseudo jitter so a speaking strip never looks frozen, even when the
      // only evidence is a flag (browser TTS exposes no audio at all).
      var jit = 0;
      if (mode === "ai" || mode === "user") {
        if (!reducedMotion()) jit = 0.18 * Math.abs(Math.sin(t * 9.3 + i * 1.7));
        else jit = 0.1;
      }
      var env = 0.05 + display * (0.3 + 0.7 * ph) + display * jit;
      if (mode === "busy") env = 0.1 + 0.07 * Math.abs(Math.sin(t * 2 + i * 0.2));
      if (mode === "idle") env = 0.045 + 0.02 * Math.abs(Math.sin(t * 0.8 + i * 0.05));
      var bh = Math.max(dpr, Math.min(maxAmp, env * maxAmp));
      var x = Math.floor(i * gap + (gap - bw) / 2);
      ctx2d.fillRect(x, Math.floor(mid - bh), Math.ceil(bw), Math.ceil(bh * 2));
    }
  }

  function frame() {
    if (!show || !wrap || wrap.hidden || !wrap.isConnected) return;
    // NOTE: no document.hidden early-return on purpose - the editor preview
    // can report hidden while it is on screen, and a background tab costs
    // one cheap frame per throttled tick either way.
    var s = null;
    try { s = sense(); } catch (e) { s = { mode: "idle", level: 0, label: "STANDBY" }; }

    // Attack fast, release slow - speech flickers, silence fades.
    var target = clamp01(s.level);
    if (s.mode === "ai" && target < 0.4) target = 0.4 + 0.25 * Math.abs(Math.sin(Date.now() / 300));
    if (s.mode === "user" && target < 0.12 && s.live) target = Math.max(target, 0.12);
    if (target > smooth) smooth += (target - smooth) * 0.35;
    else smooth += (target - smooth) * 0.08;
    if (smooth < 0.004) smooth = 0;

    var t = (Date.now() - t0) / 1000;
    try {
      paintLabel(s.mode, s.label, muted());
      draw(s.mode, smooth, t);
      if (stateEl) {
        var st = "";
        if (s.mode === "ai" || s.mode === "user") st = Math.round(smooth * 100) + "";
        if (stateEl.textContent !== st) stateEl.textContent = st;
      }
      if (s.mode !== lastMode) {
        lastMode = s.mode;
        try { if (wrap) wrap.setAttribute("data-mode", s.mode); } catch (e) {}
      }
    } catch (e) {}
  }

  function kick() {
    size();
    try { frame(); } catch (e) {}
    if (!pumpTimer) {
      try { pumpTimer = setInterval(function () { try { frame(); } catch (e) {} }, 50); }
      catch (e) { pumpTimer = null; }
    }
  }

  // ---- public -------------------------------------------------------------

  function feed(level, from) {
    fedLevel = clamp01(level);
    fedAt = Date.now();
    try { if (window.turn && window.turn.vadFeed) window.turn.vadFeed(fedLevel, String(from || "wave")); } catch (e) {}
    return { ok: true, level: fedLevel };
  }

  function state() {
    var s = null;
    try { s = sense(); } catch (e) { s = { mode: "idle", air: "STANDBY", level: 0, live: false, label: "STANDBY" }; }
    return {
      show: show, mode: s.mode, air: s.air, label: s.label, live: !!s.live,
      level: clamp01(s.level), display: clamp01(smooth),
      muted: muted(), taps: taps.length, reducedMotion: reducedMotion()
    };
  }

  function showStrip(keep) {
    show = true;
    try { paintVisibility(); } catch (e) {}
    if (keep) save();
    kick();
    return show;
  }

  function hide(keep) {
    show = false;
    try { paintVisibility(); } catch (e) {}
    if (keep) save();
    return show;
  }

  function toggle() {
    return show ? hide(true) : showStrip(true);
  }

  function describe() {
    var s = state();
    return [
      "THE WAVEFORM :: " + (s.show ? "ON" : "OFF") + " - " + s.label + " (AIR " + s.air + ").",
      "  THE STRIP ABOVE THE INPUT BOX MOVES WHILE A VOICE IS ON THE LINE: HER VOICE WHILE SHE SPEAKS (BRIGHT GREEN), YOUR VOICE WHILE THE MICROPHONE HEARS YOU (SPRING GREEN), A SLOW PULSE WHILE HER TURN IS BEING MADE OR YOUR WORDS ARE HELD, A FAINT LINE AT REST.",
      "  IT READS THE LINE ITSELF - voice.air(), HER MOUTH, THE ROOM METER, THE WIRE'S CAPTURE, avb - AND NEVER OPENS THE MICROPHONE OR ANY SOCKET OF ITS OWN. BROWSER SPEECH EXPOSES NO AUDIO, SO WHILE IT SPEAKS THE SHAPE IS SYNTHESIZED AND THE TIMING IS REAL.",
      "  DOUBLE-CLICK THE STRIP TO PUT IT AWAY (/wave on BRINGS IT BACK). /wave on|off|toggle|status."
    ].join("\n");
  }

  async function words(arg) {
    var t = String(arg || "").trim().toLowerCase();
    if (!t || t === "status" || t === "state") { var d = describe(); say(d); return d; }
    if (t === "on" || t === "show" || t === "1" || t === "yes") { showStrip(true); var on = describe(); say(on); return on; }
    if (t === "off" || t === "hide" || t === "0" || t === "no") { hide(true); var off = describe(); say(off); return off; }
    if (t === "toggle") { toggle(); var tg = describe(); say(tg); return tg; }
    var u = "USAGE: /wave · /wave on|off|toggle|status\n" + describe();
    say(u);
    return u;
  }

  // ---- wiring -------------------------------------------------------------

  function wire() {
    mount();
    load().then(function () { kick(); }, function () { kick(); });

    // The playback taps need a gesture before they may start.
    ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) {
      try { document.addEventListener(ev, armAudio, { once: true, passive: true }); }
      catch (e) { try { document.addEventListener(ev, armAudio, false); } catch (e2) {} }
    });

    // Hook clips as they arrive (gallery, audition bus, story parts).
    try {
      if (window.MutationObserver) {
        new MutationObserver(function (muts) {
          if (!ctxWanted) return;
          for (var i = 0; i < muts.length; i++) {
            var added = muts[i].addedNodes || [];
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              if (!n || n.nodeType !== 1) continue;
              try {
                if (n.tagName === "AUDIO" || n.tagName === "VIDEO") hookAudioNode(n);
                var kids = n.querySelectorAll ? n.querySelectorAll("audio, video") : [];
                for (var k = 0; k < kids.length; k++) hookAudioNode(kids[k]);
              } catch (e) {}
            }
          }
        }).observe(document.documentElement || document, { childList: true, subtree: true });
      }
    } catch (e) {}

    try { window.addEventListener("resize", function () { size(); }); } catch (e) {}
    try {
      if (window.ResizeObserver) {
        new ResizeObserver(function () { size(); }).observe(el("command-deck") || document.body);
      }
    } catch (e) {}

    // The deck measures itself for the stage reserve (forge.js
    // syncDeckSpace): the strip changes that height, so re-measure after
    // it mounts and after every visibility change.
    setTimeout(function () {
      try { if (typeof syncDeckSpace === "function") syncDeckSpace(); } catch (e) {}
    }, 600);
    setTimeout(function () {
      try { if (typeof syncDeckSpace === "function") syncDeckSpace(); } catch (e) {}
    }, 2500);

    kick();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  return {
    load: load,
    state: state,
    sense: sense,
    level: function () { var s = state(); return { rms: s.level, loud: s.live, mode: s.mode }; },
    feed: feed,
    show: showStrip,
    hide: hide,
    toggle: toggle,
    describe: describe,
    words: words,
    paint: kick
  };
})();
