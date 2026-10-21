window.handsfree = (function () {
  var FOLDER = "lia_settings";
  var KEY = "handsfree";
  var client = null;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }

  function say(t, pass) {
    if (typeof print === "function") { try { print("SYSTEM", String(t), false, undefined, pass ? { hushpass: true } : undefined); } catch (e) {} }
  }

  function hushTo(on) {
    try { if (window.veil && window.veil.hush) window.veil.hush(on ? "on" : "off"); } catch (e) {}
  }
  // PRIVATE MODE (2026-10-21): wearing hands-free opens his mic and the live
  // channel - refused while the guest line is up. HITL<>MAYA only.
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }

  function vs() {
    try { return window.voice ? window.voice.state() : null; }
    catch (e) { return null; }
  }

  function onoff(v) {
    var s = String(v == null ? "" : v).trim().toLowerCase();
    if (s === "1" || s === "on" || s === "yes" || s === "true") return true;
    if (s === "0" || s === "off" || s === "no" || s === "false") return false;
    return null;
  }

  function sense() {
    var s = vs();
    if (!s) return null;
    return {
      speak: s.autoRead ? "1" : "0",
      wake: s.live ? "1" : "0",
      wakeOn: s.live ? "1" : "0",
      auto: s.live ? "1" : "0",
      stt: s.wire ? "live" : "browser",
      tts: s.engineNow || "browser",
      direct: s.micAuto ? "1" : "0",
      hear: s.liveText ? "on" : "off",
      hush: "1",
      name: "LIA",
      wakeWord: "THE MIC TAP"
    };
  }

  function tell(verb) {
    try {
      if (window.voice && window.voice.report) window.voice.report(verb);
    } catch (e) {}
  }

  function apply(map) {
    var m = map || {}, n = 0;
    var s = vs();
    var b;
    if (m.sia_speak != null && (b = onoff(m.sia_speak)) !== null) { tell(b ? "auto on" : "auto off"); n++; }
    if (m.sia_wake_on != null && (b = onoff(m.sia_wake_on)) !== null) {
      if (b && s && !s.live) tell("live on");
      if (!b && s && s.live) tell("live off");
      n++;
    }
    if (m.sia_autolisten != null && (b = onoff(m.sia_autolisten)) !== null) {
      if (b) { tell("mic on"); if (s && !s.live) tell("live on"); }
      else if (s && s.live) tell("live off");
      n++;
    }
    if (m.sia_voice_direct != null && (b = onoff(m.sia_voice_direct)) !== null) { tell(b ? "mic on" : "mic off"); n++; }
    if (m.sia_stt != null && String(m.sia_stt).toLowerCase() === "browser") n++;
    if (m.sia_tts != null) {
      var t = String(m.sia_tts).toLowerCase();
      if (t === "browser" || t === "elevenlabs" || t === "kokoro" || t === "stream") {
        if (!s || s.engineNow !== t) tell("engine " + t);
        n++;
      }
    }
    if (m.sia_rate != null && isFinite(Number(m.sia_rate))) { tell("rate " + Number(m.sia_rate)); n++; }
    if (m.sia_pitch != null && isFinite(Number(m.sia_pitch))) { tell("pitch " + Number(m.sia_pitch)); n++; }
    if (m.sia_hear != null) {
      var h = String(m.sia_hear).toLowerCase();
      if (h === "on" || h === "off") { tell("live text " + h); n++; }
    }
    return n;
  }

  function capture() {
    var s = vs();
    if (!s) return null;
    return {
      sia_speak: s.autoRead ? "1" : "0",
      sia_wake_on: s.live ? "1" : "0",
      sia_autolisten: s.live ? "1" : "0",
      sia_stt: "browser",
      sia_tts: s.engineNow || "browser",
      sia_hear: s.liveText ? "on" : "off",
      sia_voice_direct: s.micAuto ? "1" : "0"
    };
  }

  function store() {
    return {
      save: function (obj) {
        var k = kv();
        if (!k) return Promise.reject(new Error("NO STORE"));
        return k.set(KEY, obj);
      },
      load: function () {
        var k = kv();
        if (!k) return Promise.resolve(null);
        return k.get(KEY);
      }
    };
  }

  function ensure() {
    if (client) return client;
    if (!window.MythosHandsfree) return null;
    client = window.MythosHandsfree.client({
      say: say,
      sense: sense,
      apply: apply,
      capture: capture,
      store: store(),
      onChange: function () {}
    });
    return client;
  }

  async function load() {
    var c = ensure();
    if (!c) return { ok: false, error: "THE HANDS-FREE CHIP IS NOT LOADED (src/chips/sia-handsfree-chip/mythos-handsfree-standalone.js)" };
    try { return await c.load(); }
    catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }

  async function words(arg) {
    var raw = String(arg || "").trim();
    var verb = (raw.split(/\s+/)[0] || "").toLowerCase();
    if (verb === "hush") {
      var rest = raw.slice(4).trim().toLowerCase();
      if (!rest || rest === "status" || rest === "state") {
        var h = false;
        try { h = window.veil ? window.veil.isHushed() : false; } catch (e) {}
        say("HUSH :: " + (h ? "ON - ONLY HIS WORDS, HER WORDS, HER VOICE AND WHAT SHE MAKES REACH THE SCREEN." : "OFF - THE TERMINAL SPEAKS.") + "\n/handsfree hush on|off", true);
        return { ok: true };
      }
      if (rest === "on" || rest === "off") {
        hushTo(rest === "on");
        say("HUSH :: " + (rest === "on" ? "ON - THE CHATTER IS HELD." : "OFF - THE TERMINAL SPEAKS AGAIN."), true);
        return { ok: true };
      }
      say("USAGE: /handsfree hush [on|off|status]", true);
      return { ok: false };
    }
    var c = ensure();
    if (!c) { say("THE HANDS-FREE MODULE IS OFFLINE.", true); return { ok: false }; }
    // While the line is up only reading and standing down are allowed - any
    // wear would open his mic and the live channel into Barbelo's ears.
    if (guestUp() && ["status", "state", "what", "list", "all", "modes", "help", "?", "save", "keep", "delete", "remove", "drop", "off", "down", "disarm", "hush"].indexOf(verb) === -1) {
      say("GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. HANDS-FREE WOULD OPEN HIS MIC AND THE LIVE CHANNEL - HANG UP FIRST.", true);
      return { ok: false };
    }
    var r = null;
    try { r = c.words(arg || ""); }
    catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    if (r && r.ok) {
      // Wearing a mode is the handsfree promise: the mic stays open AND she keeps her own
      // hours - an open-but-quiet mic no longer holds her acts, and she never speaks a prompt
      // aloud (pictures go to the gallery, her words only point at them). Said here, once, so
      // the shape of the worn room is on the record wherever it was worn from.
      var wore = false;
      if (verb === "on" || verb === "wear" || verb === "arm") { hushTo(true); wore = true; }
      else if (verb === "off" || verb === "down" || verb === "disarm") hushTo(false);
      else if (raw && ["status", "state", "what", "list", "all", "modes", "help", "?", "save", "keep", "delete", "remove", "drop"].indexOf(verb) === -1) {
        var worn = false;
        try { worn = !!(c.get && c.get(raw) !== null); } catch (e) {}
        if (worn) { hushTo(true); wore = true; }
      }
      say(r.text + (wore ? "\nHANDS-FREE :: THE MIC STAYS OPEN AND SHE KEEPS HER OWN HOURS - AN OPEN-BUT-QUIET MIC NO LONGER HOLDS HER ACTS, AND SHE NEVER SPEAKS A PROMPT ALOUD: PICTURES GO TO THE GALLERY, HER WORDS ONLY POINT AT THEM." : ""), true);
    }
    else if (r) say(r.error || "REFUSED", true);
    if (r && r.ok && (verb === "help" || verb === "?")) say("HUSH :: A WORN MODE HOLDS THE CHATTER (HUSH ON); EARS DOWN LIFTS IT. /handsfree hush [on|off|status] OVERRIDES BY HAND.", true);
    return r || { ok: false };
  }

  function status() {
    var c = ensure();
    if (!c) return { ok: false, error: "OFFLINE" };
    try { return c.status(); }
    catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }

  return { load: load, words: words, status: status, sense: sense, capture: capture, apply: apply };
})();
