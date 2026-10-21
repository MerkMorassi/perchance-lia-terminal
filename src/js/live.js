// THE LIVE WIRE (src/js/live.js, window.live) -- 2026-09-28
//
// Patrikios, after the first two attempts at the live channel: *"nope fail. look into how GEMINI
// handles this multiplex and interruptions and near zero latency. the glitching and dropping my
// words, etc makes it unusable."*
//
// WHAT WAS WRONG. Both earlier attempts read the end of his turn off `SpeechRecognition`: the
// browser's own recogniser, which (a) sends the audio to the browser maker's service over a socket
// that comes and goes, (b) ENDS ITS OWN SESSION on a long silence or its own time limit - which is
// the glitch - and (c) finalises a result at EVERY BREATH, so a pause inside a sentence arrives
// looking exactly like the end of one. Every rule built on top of it (the hold, the tail, the room
// meter) was patience added to a guess. Her mouth had the same shape of problem from the other
// side: ElevenLabs is one round trip that returns a WHOLE CLIP before a single word is heard, and
// the browser voice is chopped into 220-character utterances. Neither can be interrupted.
//
// HOW GEMINI DOES IT, and this file is that, measured on this key (2026-09-28):
//
//   1. THE EARS ARE A CONTINUOUS STREAM, NOT A SESSION PER SENTENCE. Audio is pushed up the open
//      socket the moment it is captured, 20ms at a time, and NEVER STOPPED - so there is no
//      silence for a recogniser to end on, and nothing to restart. `gemini-3.5-transcribe-live`
//      answers while he is still speaking: 17 partial transcripts arrived during one 8-second
//      sentence, then a FINAL, punctuated one ("Marcus, you little fucker, clean my garden with
//      dedication and devotion...") 1.2s after he stopped - which is the server's own silence
//      window, not a guess.
//   2. THE END OF THE TURN IS THE MODEL'S OWN VOICE-ACTIVITY, and it is a MESSAGE:
//      `{voiceActivity:{type:"ACTIVITY_START"|"ACTIVITY_END", audioOffset:"9.320s"}}`. How long a
//      pause still counts as the middle of a sentence is a NUMBER we set
//      (`silenceDurationMs`), not a property of someone else's recogniser.
//   3. HER MOUTH IS A STREAM TOO. `gemini-3.8-live` says a line back in 629ms - measured - as 24kHz
//      PCM arriving in chunks that are played the moment they land, so she starts speaking almost
//      at once instead of after a whole clip has been built. It is her exact words: the model's own
//      transcription of what it said came back word for word, semicolon included.
//   4. INTERRUPTION IS BOTH ENDS AT ONCE. On the way up, the transcribe model cannot speak at all
//      (it rejects AUDIO modality outright), so her voice can never come back as his words. On the
//      way down, her audio is OURS - every chunk is scheduled by this file - so a hush is exact and
//      instant, and the echo guard is still the last gate before anything becomes a turn.
//
// WHAT THIS FILE IS NOT. It is not her brain. The terminal is her brain: `chat.js` composes every
// reply, the LOREPACK grounds it, the directives are hers, the archive keeps it. The wire is a
// TRANSPORT - the two ends of a conversation whose middle stays exactly where it was. That is why
// it needs no system prompt of its own and why nothing about her changes when it is on.
//
// THE TRADE, said plainly. The wire needs a Google (Gemini) key in the key ring, and it sends audio
// to Google continuously while the microphone is open (the browser's own recogniser did that too,
// to Chromium's service - a fact the terminal has always said out loud). Nothing is recorded or
// kept here; the audio is streamed and dropped. With no key, or a key that cannot reach the model,
// or a browser without Web Audio, everything falls back to the recogniser road untouched.

window.live = (function () {
  var WS_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
  var API = "https://generativelanguage.googleapis.com/v1beta";
  var FOLDER = "lia_settings";
  var KEY = "live";
  var PROVIDER = "google";

  // The shipped defaults. The design file (src/voice/voices.json -> wire) can override any of
  // them, and so can this device (kv lia_settings / live); what is in force is always reported.
  var DEF = {
    earModel: "gemini-3.5-transcribe-live",   // a bidi model that only writes text: it CANNOT speak
    mouthModel: "gemini-3.8-live",            // the low-latency conversational model, used as a voice
    voice: "Kore",                            // its prebuilt voice (see VOICES below)
    silenceMs: 2800,                          // how much quiet ends his turn (the server's own VAD)
    prefixMs: 80,                             // how much speech must be heard before a start is committed
    startSensitivity: "START_SENSITIVITY_HIGH",
    endSensitivity: "END_SENSITIVITY_LOW",    // "ends speech less often" is the direction that costs
                                              // him nothing: a pause inside a sentence stays inside it
    hidden: [],                               // voice names taken OFF the list of what may be chosen
                                              // (the code still carries every one of them - see below)
    startWatch: true,                         // flush her mouth the moment his words appear under hers
    check: true,                              // keep the mouth honest: transcribe what it actually said
    on: true                                  // the wire is the preferred road for the live channel
  };

  // The prebuilt voices the Live models will say her words in, with the API's OWN one-word character
  // for each - the only description there is, since the API has no voice list to ask. Not a lookup:
  // this is the set known to be accepted, and an unknown name is sent as given and its refusal
  // reported. /voice wire voice <NAME> chooses one; /voice wire voices PRINTS THIS; /voice wire
  // audition SAYS THEM IN TURN, so a voice can be chosen by ear rather than by adjective. BARBELO's
  // own is female and low.
  //
  // THE VOICES HE DOES NOT WANT ARE HIDDEN, NOT DELETED (Patrikios, 2026-09-29): *"Give the ability
  // to disable some voices from being selected. The code remains, but some options are available."*
  // So this table is the whole set, always, and `hidden` (this device's kv, or the design file)
  // names the ones taken OFF the list of what may be chosen. A hidden voice is not offered by
  // `voiceNames()` (so /voice wire audition skips it), is not printed by `voicesText()`, and
  // `/voice wire voice <NAME>` will not keep it - but its row, its character and its place in the
  // table are untouched, and `/voice wire show <NAME>` puts it back with nothing else changed. A
  // voice already IN FORCE is never changed by being hidden: no setting here may silently take her
  // voice away, so hiding the voice she is speaking in only narrows what can be chosen NEXT.
  var VOICES = [
    ["Zephyr", "bright"], ["Puck", "upbeat"], ["Charon", "informative"], ["Kore", "firm"],
    ["Fenrir", "excitable"], ["Leda", "youthful"], ["Orus", "firm"], ["Aoede", "breezy"],
    ["Callirrhoe", "easy-going"], ["Autonoe", "bright"], ["Enceladus", "breathy"], ["Iapetus", "clear"],
    ["Umbriel", "easy-going"], ["Algieba", "smooth"], ["Despina", "smooth"], ["Erinome", "clear"],
    ["Algenib", "gravelly"], ["Rasalgethi", "informative"], ["Laomedeia", "upbeat"], ["Achernar", "soft"],
    ["Alnilam", "firm"], ["Schedar", "even"], ["Gacrux", "mature"], ["Pulcherrima", "forward"],
    ["Achird", "friendly"], ["Zubenelgenubi", "casual"], ["Vindemiatrix", "gentle"],
    ["Sadachbia", "lively"], ["Sadaltager", "knowledgeable"], ["Sulafat", "warm"]
  ];

  // ---- which of them may be chosen ---------------------------------------
  //
  // The list he can choose from, and the list he has taken out of it. Both are always derived from
  // the table above and the `hidden` setting, so they cannot drift from it.
  function knownVoice(name) {
    var n = String(name || "").trim().toLowerCase();
    if (!n) return "";
    var i;
    for (i = 0; i < VOICES.length; i++) if (VOICES[i][0].toLowerCase() === n) return VOICES[i][0];
    for (i = 0; i < VOICES.length; i++) if (VOICES[i][0].toLowerCase().indexOf(n) !== -1) return VOICES[i][0];
    return "";
  }
  function hiddenList() {
    var raw = (set.hidden != null) ? set.hidden : ((cfg && cfg.wire) ? cfg.wire.hidden : null);
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (x) {
      var c = knownVoice(x);
      if (c && out.indexOf(c) === -1) out.push(c);
    });
    return out;
  }
  function isHidden(name) {
    var c = knownVoice(name);
    return !!c && hiddenList().indexOf(c) !== -1;
  }
  function voiceNamesAll() { return VOICES.map(function (v) { return v[0]; }); }
  function hiddenVoices() { return hiddenList(); }
  function voiceNames() {
    return VOICES.filter(function (v) { return !isHidden(v[0]); }).map(function (v) { return v[0]; });
  }
  // The one write. Handed the WHOLE list of what is to be hidden (canonical names or any spelling of
  // them), it saves once and reports what the table now offers - so /voice wire hide all is one
  // store write rather than thirty.
  function setHidden(names) {
    var keep = {}, out = [];
    (Array.isArray(names) ? names : []).forEach(function (x) {
      var c = knownVoice(x);
      if (c && !keep[c]) { keep[c] = 1; out.push(c); }
    });
    set.hidden = out;
    save();
    return { hidden: out, visible: voiceNames(), total: VOICES.length, voice: String(settings().voice) };
  }

  function voiceNote(name) {
    var n = String(name || "").toLowerCase();
    for (var i = 0; i < VOICES.length; i++) if (VOICES[i][0].toLowerCase() === n) return VOICES[i][1];
    return "not one of the prebuilt voices";
  }
  function voicesText() {
    var vis = VOICES.filter(function (v) { return !isHidden(v[0]); });
    var lines = vis.map(function (v) { return "   " + v[0].toUpperCase() + " \u00b7 " + String(v[1]).toUpperCase(); });
    var n = VOICES.length - vis.length;
    if (n) lines.push("   (" + n + " VOICE" + (n === 1 ? "" : "S") + " HIDDEN - /voice wire hidden SHOWS THEM, /voice wire show <NAME> BRINGS ONE BACK)");
    return lines.join("\n");
  }

  // How much the mouth's own transcription may differ from the words it was handed before it counts
  // as a paraphrase rather than a transcription. Generous on purpose: the point is to catch a
  // sentence the model rewrote, not to police a comma.
  var DRIFT = 0.88;

  var RATE_IN = 16000;      // what the ear is fed (mono, 16-bit PCM)
  var RATE_OUT = 24000;     // what the mouth returns (mono, 16-bit PCM)
  var FRAME = 320;          // 20ms of the ear's own rate
  var TICK = 100;           // how often the mouth checks whether it has finished

  var cfg = null;           // the design file, once read
  var cfgP = null;
  var set = {};             // this device's overrides (kv)
  var voiceOnce = null;     // a voice for THIS mouth only, not saved (the audition and /voice wire try)
  var on = {                // what voice.js hangs here
    interim: null,          // (text)            - his words so far, while he is still saying them
    final: null,            // (text, meta)      - the server's own punctuated end of his turn
    activity: null,         // ("start"|"end")   - the model's voice-activity signal
    level: null,            // (rms, loud)       - the room's level off the same capture
    speakStart: null,       // ()                - her first chunk is about to be heard
    speakEnd: null,         // ()                - her mouth is empty and quiet again
    drift: null,            // (said, wanted)    - the mouth did not say exactly what it was given
    status: null,           // (text)            - something worth a line in the log
    dead: null              // (why)             - the wire cannot go on; fall back
  };

  var ear = null;           // {ws, ready, text, seq, tries, drops, secs}
  var mouth = null;         // {ws, ready, queue, suppress, said, want, spoken}
  var mic = null;           // {stream, ctx, node, src}
  var outCtx = null, outGain = null;   // her audio, scheduled here
  var sources = [], endAt = 0, muted = false;
  var lvl = { rms: 0, loudAt: 0, quietAt: Date.now(), threshold: 0, tail: 350 };
  var modelsCache = null, modelsP = null;
  var why = "";             // why the wire cannot be opened, in words, once measured
  var errors = [];          // the last few failures, for /voice wire

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function keyring() { return window.keyring || null; }
  function now() { return Date.now(); }
  function num(v, dft, lo, hi) { var n = Number(v); if (!isFinite(n)) n = dft; return Math.max(lo, Math.min(hi, n)); }
  function say(msg) { try { if (typeof print === "function") print("SYSTEM", msg); } catch (e) {} }
  function note(msg) { if (on.status) { try { on.status(msg); } catch (e) {} } }
  function qname(n) { return '"' + String(n == null ? "" : n).toUpperCase() + '"'; }
  function remember(msg) {
    errors.push({ at: now(), what: String(msg || "").slice(0, 400) });
    if (errors.length > 6) errors.splice(0, errors.length - 6);
  }

  // ---- settings -----------------------------------------------------------

  function settings() {
    var d = (cfg && cfg.wire) || {};
    var out = {};
    Object.keys(DEF).forEach(function (k) { out[k] = DEF[k]; });
    Object.keys(d).forEach(function (k) { if (k in out) out[k] = d[k]; });
    Object.keys(set).forEach(function (k) { if (k in out && set[k] != null) out[k] = set[k]; });
    out.silenceMs = num(out.silenceMs, DEF.silenceMs, 500, 8000);
    out.prefixMs = num(out.prefixMs, DEF.prefixMs, 0, 1000);
    out.voice = String(out.voice || DEF.voice);
    return out;
  }

  async function load() {
    if (cfgP) return cfgP;
    cfgP = (async function () {
      try {
        var res = await fetch("src/voice/voices.json", { cache: "no-store" });
        if (res.ok) cfg = await res.json();
      } catch (e) { /* the design file is optional here; the shipped defaults stand */ }
      var k = kv();
      if (k) {
        try {
          var saved = await k.get(KEY);
          if (saved && typeof saved === "object") {
            Object.keys(saved).forEach(function (n) { if (n in DEF && n !== "models") set[n] = saved[n]; });
            // MIGRATION 2026-10-14 ("cut off when I speak"): the shipped quiet was 1500ms, which
            // ends the turn on a mid-sentence breath. A device still holding exactly 1500 never
            // touched the knob, so lift it to the new 2800ms floor. A hand-moved number stays.
            if (Number(set.silenceMs) === 1500) { set.silenceMs = 2800; try { save(); } catch (e2) {} }
            if (Array.isArray(saved.models)) modelsCache = saved.models;
          }
        } catch (e) {}
      }
      return settings();
    })();
    return cfgP;
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try {
      await k.set(KEY, {
        earModel: set.earModel, mouthModel: set.mouthModel, voice: set.voice,
        silenceMs: set.silenceMs, prefixMs: set.prefixMs,
        startSensitivity: set.startSensitivity, endSensitivity: set.endSensitivity,
        startWatch: set.startWatch, check: set.check, on: set.on,
        hidden: hiddenList(),
        models: modelsCache || undefined
      });
      return true;
    } catch (e) { return false; }
  }

  async function setSetting(name, value) {
    if (!(name in DEF)) return false;
    set[name] = value;
    await save();
    return true;
  }

  // ---- what the browser and the key can actually do ------------------------

  function supported() {
    var missing = [];
    if (typeof WebSocket === "undefined") missing.push("WebSocket");
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) missing.push("Web Audio");
    if (!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) missing.push("getUserMedia");
    // `audioWorklet` is a GETTER that insists on a real AudioContext, so asking the prototype for it
    // throws "Illegal invocation" - the worklet's own constructor is the honest question to ask.
    if (typeof AudioWorkletNode === "undefined" || typeof AudioWorkletNode.prototype.process !== "function") {
      if (!(AC && "audioWorklet" in AC.prototype)) missing.push("AudioWorklet");
    }
    return missing;
  }

  function available() {
    var kr = keyring();
    if (!kr || !kr.has || !kr.has(PROVIDER)) return false;
    return supported().length === 0;
  }

  function reason() {
    var kr = keyring();
    if (supported().length) return "THIS BROWSER IS MISSING " + supported().join(", ").toUpperCase() + ".";
    if (kr && kr.bypassed && kr.bypassed(PROVIDER)) return "GOOGLE AI (GEMINI) CALLS ARE BYPASSED IN THE KEYS PANEL - UNCHECK THE BYPASS TO LET THEM THROUGH.";
    if (!kr || !kr.has || !kr.has(PROVIDER)) return "NO GOOGLE AI (GEMINI) KEY IS HELD - THE KEYS PANEL (KEYS \u25be) TAKES ONE.";
    return why;
  }

  // ---- the models the key can actually reach ------------------------------

  // WHICH MODELS, ASKED OF THE KEY. The Live models are the ones offering `bidiGenerateContent`;
  // the ear wants one that writes text and cannot speak, the mouth wants one that can. A name in
  // the settings is used when the key has it; otherwise the best of what it does have is chosen,
  // and which one and why is reported rather than assumed.
  function scoreModel(n, want) {
    var s = 0;
    if (want === "ear") {
      if (/transcribe/i.test(n)) s += 60;
      if (/live/i.test(n)) s += 20;
    } else {
      if (/native-audio/i.test(n)) s += 30;
      if (/live/i.test(n)) s += 25;
      if (/flash/i.test(n)) s += 12;
      if (/-pro\b/i.test(n)) s -= 4;
    }
    if (/robotics|translate|tts/i.test(n)) s -= 80;
    if (/-preview/i.test(n)) s -= 3;
    if (/extended-thinking/i.test(n)) s -= 15;
    var v = /gemini-(\d+)\.(\d+)/.exec(n);
    if (v) s += Number(v[1]) * 4 + Number(v[2]);
    if (/-latest$/.test(n)) s += 6;
    return s;
  }

  async function models(force) {
    if (modelsCache && !force) return modelsCache;
    if (modelsP && !force) return modelsP;
    modelsP = (async function () {
      var kr = keyring();
      var url = API + "/models?pageSize=200";
      var seen = [], tok = "";
      for (var p = 0; p < 10; p++) {
        var res = await kr.request(PROVIDER, url + (tok ? "&pageToken=" + encodeURIComponent(tok) : ""));
        if (!res.ok) throw new Error("THE KEY LIST COULD NOT BE READ (HTTP " + res.status + ")");
        var j = await res.json();
        (j.models || []).forEach(function (m) {
          var name = String(m.name || "").replace(/^models\//, "");
          if ((m.supportedGenerationMethods || []).indexOf("bidiGenerateContent") !== -1) seen.push(name);
        });
        tok = j.nextPageToken || "";
        if (!tok) break;
      }
      modelsCache = seen;
      save();
      return seen;
    })().catch(function (e) { modelsP = null; throw e; });
    return modelsP;
  }

  function pick(list, want, chosen) {
    if (chosen && list.indexOf(chosen) !== -1) return { model: chosen, why: "CHOSEN IN THE SETTINGS" };
    var ranked = list.slice().sort(function (a, b) { return scoreModel(b, want) - scoreModel(a, want); });
    if (!ranked.length) return null;
    return { model: ranked[0], why: "THE BEST OF WHAT THIS KEY HAS FOR " + (want === "ear" ? "AN EAR" : "A MOUTH") };
  }

  // ---- the socket itself --------------------------------------------------

  // One message on the way out, and every message on the way in as PLAIN JSON. The API answers in
  // binary frames (a Blob), not text - which is why a naive client reads nothing at all and times
  // out. Everything before `setupComplete` is queued rather than dropped.
  function wire(model, setup, handlers) {
    var kr = keyring();
    var a = kr.attach(PROVIDER, WS_BASE);
    var w = { ws: null, ready: false, queue: [], closed: false, tries: 0, handle: null, failed: false, setupTimer: null };
    function send(obj) {
      if (!w.ws || w.ws.readyState !== 1) { w.queue.push(obj); return false; }
      try { w.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
    }
    // ONE FAILURE PER ATTEMPT. The socket's own onclose fires after an explicit close too, and the
    // line must retry once per drop, not once per callback.
    function fail(reason, ev) {
      if (w.failed) return;
      w.failed = true;
      if (w.setupTimer) { clearTimeout(w.setupTimer); w.setupTimer = null; }
      handlers.close(reason, ev);
    }
    // A SOCKET THAT NEVER FINISHES SETUP IS A DEAD LINE THAT LOOKS OPEN. The server can take the
    // socket and say nothing - no setupComplete, no error, no close - and both directions sit dead
    // with the channel reading open. Past the ceiling the attempt fails loud and the line retries.
    function armSetup() {
      if (w.setupTimer) clearTimeout(w.setupTimer);
      w.setupTimer = setTimeout(function () {
        w.setupTimer = null;
        if (!w.ready && !w.closed) {
          try { w.ws && w.ws.close(); } catch (e) {}
          fail("SETUP NEVER COMPLETED - THE SERVER TOOK THE SOCKET AND SAID NOTHING");
        }
      }, 20000);
    }
    function open() {
      var sock;
      w.failed = false;
      try { sock = new WebSocket(a.url); } catch (e) { fail(String((e && e.message) || e)); return; }
      sock.binaryType = "blob";
      w.ws = sock;
      armSetup();
      sock.onopen = function () {
        var s = {};
        Object.keys(setup).forEach(function (k) { s[k] = setup[k]; });
        if (w.handle && s.sessionResumption) s.sessionResumption = { handle: w.handle };
        try { sock.send(JSON.stringify({ setup: s })); } catch (e) { fail(String((e && e.message) || e)); }
      };
      sock.onmessage = async function (ev) {
        var txt = (typeof ev.data === "string") ? ev.data : await ev.data.text().catch(function () { return ""; });
        if (!txt) return;
        var m = null;
        try { m = JSON.parse(txt); } catch (e) { fail("UNREADABLE ANSWER"); return; }
        if (m.setupComplete) {
          w.ready = true;
          w.tries = 0;
          if (w.setupTimer) { clearTimeout(w.setupTimer); w.setupTimer = null; }
          handlers.ready();
          while (w.queue.length) { var q = w.queue.shift(); try { sock.send(JSON.stringify(q)); } catch (e) { break; } }
          return;
        }
        if (m.error) { remember(m.error.message || JSON.stringify(m.error)); handlers.error(m.error); return; }
        if (m.goAway) { handlers.goAway(m.goAway); return; }
        if (m.sessionResumptionUpdate && m.sessionResumptionUpdate.newHandle) { w.handle = m.sessionResumptionUpdate.newHandle; return; }
        handlers.msg(m);
      };
      sock.onclose = function (e) {
        w.ready = false;
        if (w.closed) return;
        fail("", e);
      };
      sock.onerror = function () { /* onclose always follows */ };
    }
    open();
    return {
      send: send,
      ready: function () { return w.ready; },
      close: function () { w.closed = true; if (w.setupTimer) { clearTimeout(w.setupTimer); w.setupTimer = null; } try { w.ws && w.ws.close(); } catch (e) {} },
      reopen: function () { if (w.closed) return; w.ready = false; open(); },
      queue: function () { return w.queue.length; }
    };
  }

  // ---- the ears -----------------------------------------------------------

  // WHAT SHE IS HEARD THROUGH. A second stream on the microphone, turned into 16kHz 16-bit PCM by
  // an AudioWorklet - which runs on the AUDIO thread, not this one, so a page that is busy drawing
  // her reply cannot make the capture stutter (the old machinery could, and that is part of what
  // "glitching" was). The same frames carry the room's level back, so THE ROOM HEARS YOU keeps its
  // number and its meaning: it is a reading off the audio that is actually being sent.
  var WORKLET = [
    "class LiaEar extends AudioWorkletProcessor {",
    "  constructor(){ super();",
    "    this.ratio = sampleRate / 16000;",
    "    this.pos = 0; this.prev = 0;",
    "    this.n = 0; this.out = new Int16Array(320);",
    "    this.acc = 0; this.count = 0;",
    "  }",
    "  process(inputs){",
    "    const ch = inputs[0] && inputs[0][0];",
    "    if (!ch || !ch.length) return true;",
    "    for (let i = 0; i < ch.length; i++) {",
    "      const cur = ch[i];",
    "      while (this.pos <= 1) {",
    "        const v = this.prev + (cur - this.prev) * this.pos;",
    "        const c = Math.max(-1, Math.min(1, v));",
    "        this.out[this.n++] = c < 0 ? c * 0x8000 : c * 0x7fff;",
    "        this.acc += v * v; this.count++;",
    "        if (this.n === 320) {",
    "          this.port.postMessage({ pcm: this.out.buffer, rms: Math.sqrt(this.acc / Math.max(1, this.count)) }, [this.out.buffer]);",
    "          this.n = 0; this.out = new Int16Array(320); this.acc = 0; this.count = 0;",
    "        }",
    "        this.pos += this.ratio;",
    "      }",
    "      this.pos -= 1; this.prev = cur;",
    "    }",
    "    return true;",
    "  }",
    "}",
    "registerProcessor('lia-ear', LiaEar);"
  ].join("\n");

  async function micStart() {
    if (mic) return true;
    var md = navigator.mediaDevices;
    var AC = window.AudioContext || window.webkitAudioContext;
    // ECHO CANCELLATION IS NOT OPTIONAL HERE. Her voice comes out of the speakers while the
    // microphone is open (that is what full duplex means), and without this the transcriber would
    // hear her - so it is asked for plainly, and a device that ignores the hint leans on the echo
    // guard instead.
    var stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    var ctx = new AC({ sampleRate: RATE_IN });
    try { if (ctx.state === "suspended" && ctx.resume) await ctx.resume(); } catch (e) {}
    try {
      if (!ctx.audioWorklet) throw new Error("THIS BROWSER HAS NO AUDIOWORKLET");
      var url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    } catch (e) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
      try { ctx.close(); } catch (e2) {}
      throw e;
    }
    var src = ctx.createMediaStreamSource(stream);
    // A WORKLET WITH NO WAY OUT IS NEVER PULLED. An AudioWorkletNode whose output reaches nothing is
    // not part of the rendering graph, so `process()` is simply never called - the microphone opens,
    // the node exists, and not one frame arrives (this cost an afternoon: the wire looked connected
    // and reported a level of zero). So the node has an output and that output goes to the
    // destination through a gain of exactly zero: silence out, and the capture runs.
    var node = new AudioWorkletNode(ctx, "lia-ear", { channelCount: 1, numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    var sink = ctx.createGain();
    sink.gain.value = 0;
    src.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);
    mic = { stream: stream, ctx: ctx, src: src, node: node, sink: sink, rate: ctx.sampleRate };
    return true;
  }

  function micStop() {
    if (!mic) return;
    try { mic.node.port.onmessage = null; } catch (e) {}
    try { mic.node.disconnect(); } catch (e) {}
    try { mic.src.disconnect(); } catch (e) {}
    try { if (mic.sink) mic.sink.disconnect(); } catch (e) {}
    try { mic.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (mic.ctx.close) mic.ctx.close(); } catch (e) {}
    mic = null;
  }

  function b64(bytes) {
    var s = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }

  function join(a, b) {
    a = String(a || "").replace(/\s+/g, " ").trim();
    b = String(b || "").replace(/\s+/g, " ").trim();
    if (!a) return b;
    if (!b) return a;
    return a + " " + b;
  }

  var settleTimer = null;

  function earSetup(s) {
    var aad = {
      startOfSpeechSensitivity: s.startSensitivity,
      endOfSpeechSensitivity: s.endSensitivity,
      prefixPaddingMs: Math.round(s.prefixMs),
      silenceDurationMs: Math.round(s.silenceMs)
    };
    return {
      model: "models/" + s.earModel,
      // THE EAR IS TEXT ONLY, ON PURPOSE. `gemini-3.5-transcribe-live` refuses AUDIO outright
      // ("The requested combination of response modalities (AUDIO) is not supported by the model")
      // - which is exactly what an ear should do: it has no mouth, so it can never answer, and her
      // voice coming back off the speakers can never become a reply of her own.
      generationConfig: { responseModalities: ["TEXT"] },
      inputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: aad }
    };
  }

  async function earOpen() {
    if (ear && ear.ws) return true;
    var s = settings();
    await micStart();
    var e = ear = ear || {};
    e.text = e.text || "";      // what the server has said so far this turn
    e.carry = e.carry || "";    // words kept across a socket that dropped
    e.seq = (e.seq || 0) + 1;
    e.secs = e.secs || 0;
    e.tries = e.tries || 0;
    e.drops = e.drops || 0;
    var mine = e.seq;
    var w = wire(s.earModel, earSetup(s), {
      ready: function () {
        e.ready = true;
        e.tries = 0;
        if (e.carry) note("THE WIRE :: THE EARS ARE BACK. THE WORDS FROM BEFORE THE GAP ARE KEPT; ONLY THE AUDIO SPOKEN WHILE IT WAS DOWN IS GONE.");
      },
      msg: function (m) {
        var sc = m.serverContent;
        if (!sc) return;
        if (sc.interimInputTranscription && sc.interimInputTranscription.text) {
          clearTimeout(e.timer); e.timer = null;
          e.text = String(sc.interimInputTranscription.text);
          var live = join(e.carry, e.text);
          if (!e.text) return;
          if (on.interim) on.interim(live);
        }
        if (sc.inputTranscription && sc.inputTranscription.text) {
          clearTimeout(e.timer); e.timer = null;
          var fin = String(sc.inputTranscription.text);
          e.text = "";
          var whole = join(e.carry, fin);
          e.carry = "";
          if (on.final) on.final(whole, { repaired: false });
        }
        if (m.voiceActivity && m.voiceActivity.type) {
          if (on.activity) on.activity(m.voiceActivity.type === "ACTIVITY_END" ? "end" : "start");
        }
      },
      error: function (err) { remember("EARS :: " + (err.message || err.status || JSON.stringify(err))); },
      goAway: function () { note("THE WIRE :: THE EARS WERE TOLD TO MOVE ON - REOPENING."); w.reopen(); },
      close: function (why2, ev) {
        if (e.seq !== mine) return;
        e.ready = false;
        if (e.closing) return;
        var code = ev ? ev.code : 0;
        var reasonTxt = ev ? String(ev.reason || "").slice(0, 200) : String(why2 || "");
        remember("EARS CLOSED" + (code ? " " + code : "") + (reasonTxt ? " :: " + reasonTxt : ""));
        if (code === 1007 || code === 1008 || code === 1011 ||
            /not supported|permission|api key|not found|invalid/i.test(reasonTxt)) {
          // A refusal is an answer: retrying it forever would be shopping for a different one.
          earDown("THE EARS WERE REFUSED :: " + (reasonTxt || ("CLOSE " + code)).toUpperCase());
          return;
        }
        // NOTHING SAID IS DROPPED WHEN THE SOCKET IS. What the server had already heard is kept
        // WHOLE and the next socket's words are appended to it, so a drop in the middle of a
        // sentence costs only the audio actually spoken while the wire was down.
        if (e.text) e.carry = join(e.carry, e.text);
        e.text = "";
        e.tries++;
        e.drops++;
        if (e.tries > 4) { earDown("THE EARS KEPT DROPPING - " + (reasonTxt || ("CLOSE " + code))); return; }
        // If he has already stopped speaking, the next socket will never hear anything and no final
        // would ever come - so the kept words are delivered on their own after the silence window.
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(function () {
          settleTimer = null;
          if (!ear || ear !== e || !e.carry) return;
          var whole = e.carry; e.carry = "";
          if (on.final) on.final(whole, { repaired: true });
        }, num(settings().silenceMs, 2800, 500, 8000) * 2 + 1200);
        setTimeout(function () {
          if (!ear || ear !== e || !e.want) return;
          try { w.reopen(); } catch (err) {}
        }, Math.min(4000, 300 * Math.pow(2, e.tries - 1)));
      }
    });
    e.ws = w;
    e.want = true;
    // The capture is wired once; every frame goes up whichever socket is current.
    mic.node.port.onmessage = function (ev) {
      var d = ev.data;
      var rms = Number(d.rms) || 0;
      var t = lvl.threshold || 0;
      if (t && rms >= t) lvl.loudAt = now(); else lvl.quietAt = now();
      lvl.rms = rms;
      if (on.level) on.level(rms, !!(t && now() - lvl.loudAt < lvl.tail));
      if (mic && mic.silent) return;
      var bytes = new Uint8Array(d.pcm);
      e.secs += FRAME / RATE_IN;
      if (ear !== e || !e.ws || !e.ws.ready()) return;
      e.ws.send({ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: b64(bytes) }] } });
    };
    if (e.carry) e.text = e.carry;
    return true;
  }

  function earDown(why2) {
    if (!ear) return;
    ear.want = false;
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (why2) { why = why2; remember(why2); if (on.status) on.status("THE WIRE :: " + why2); }
    try { if (ear.ws) ear.ws.close(); } catch (e) {}
    ear.ws = null;
    ear.ready = false;
    if (on.dead) { try { on.dead(why2); } catch (e) {} }
  }

  function earClose() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (ear) { ear.want = false; ear.closing = true; }
    try { if (ear && ear.ws) ear.ws.close(); } catch (e) {}
    ear = null;
    if (!mouth) micStop();
  }

  // ---- her mouth ----------------------------------------------------------

  function outStart() {
    if (outCtx) return outCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    outCtx = new AC({ sampleRate: RATE_OUT });
    outGain = outCtx.createGain();
    outGain.gain.value = 1;
    outGain.connect(outCtx.destination);
    try { if (outCtx.state === "suspended" && outCtx.resume) outCtx.resume(); } catch (e) {}
    return outCtx;
  }

  function mouthSetup(s) {
    return {
      model: "models/" + s.mouthModel,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: (voiceOnce || s.voice) } } }
      },
      outputAudioTranscription: s.check ? {} : undefined,
      // THE MOUTH HAS ONE JOB. It is not a second brain in the room: it is handed the words the
      // terminal already wrote her, and it says them. A paraphrase is not a failure of the
      // conversation (her reply is the reply either way) but it IS a difference between what was
      // written and what was heard, so it is measured and reported rather than assumed away.
      systemInstruction: { parts: [{ text: "You are the spoken voice of BARBELO. You do not converse, answer, describe or comment. Each message you are given is a LINE TO SAY ALOUD, exactly as written, word for word, adding nothing before it or after it. If a message is not a line to say, say nothing at all." }] },
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: {}
    };
  }

  async function mouthOpen() {
    if (mouth && mouth.ws) return true;
    var s = settings();
    outStart();
    var m = mouth = mouth || {};
    m.seq = (m.seq || 0) + 1;
    m.queue = m.queue || [];
    m.defer = m.defer || [];
    m.tries = m.tries || 0;
    m.lines = m.lines || 0;
    m.secs = m.secs || 0;
    var mine = m.seq;
    var w = wire(s.mouthModel, mouthSetup(s), {
      ready: function () { m.ready = true; m.tries = 0; flushQueue(); },
      msg: function (msg) {
        var sc = msg.serverContent;
        if (!sc) return;
        if (sc.outputTranscription && sc.outputTranscription.text) m.said = (m.said || "") + sc.outputTranscription.text;
        if (sc.modelTurn && sc.modelTurn.parts) {
          for (var i = 0; i < sc.modelTurn.parts.length; i++) {
            var d = sc.modelTurn.parts[i].inlineData;
            if (d && d.data && !m.suppress) play(d.data, d.mimeType);
          }
        }
        if (sc.interrupted) stopSpeaking(true);
        if (sc.turnComplete || sc.generationComplete) {
          m.speaking = false;
          checkDrift();
          m.said = "";
          m.waiting = false;
          // THE PROMISE MEANS THE WORDS WERE SAID, not that they were generated: the last chunk is
          // usually still in the air when the server finishes the turn, so the line is only settled
          // when its audio has actually drained (see watchEnd). Callers can therefore queue the next
          // line, or report that she has finished, without lying about either.
          if (sources.length && m.current) { m.defer.push(m.current); m.current = null; }
          else { settle(m.current, { ok: true }); m.current = null; }
          flushQueue();
        }
      },
      error: function (err) {
        remember("MOUTH :: " + (err.message || err.status || JSON.stringify(err)));
        m.waiting = false;
        m.speaking = false;
        var lines = m.defer.splice(0, m.defer.length);
        lines.forEach(function (line) { settle(line, { ok: false, error: "REFUSED" }); });
        settle(m.current, { ok: false, error: String(err.message || err.status || "REFUSED") });
        m.current = null;
        if (on.speakEnd) on.speakEnd();
        mouthFail("THE MOUTH WAS REFUSED :: " + String(err.message || err.status || "").toUpperCase());
      },
      goAway: function () { note("THE WIRE :: THE MOUTH WAS TOLD TO MOVE ON - REOPENING."); w.reopen(); },
      close: function (why2, ev) {
        if (m.seq !== mine) return;
        m.ready = false;
        if (m.closing) return;
        var code = ev ? ev.code : 0;
        var reasonTxt = ev ? String(ev.reason || "").slice(0, 200) : String(why2 || "");
        remember("MOUTH CLOSED" + (code ? " " + code : "") + (reasonTxt ? " :: " + reasonTxt : ""));
        m.waiting = false;
        if (m.speaking) stopSpeaking(true);
        if (m.tries >= 3) {
          settle(m.current, { ok: false, error: "THE MOUTH DROPPED" });
          m.current = null;
          mouthFail("THE MOUTH KEPT DROPPING :: " + reasonTxt);
          return;
        }
        m.tries++;
        setTimeout(function () { if (!mouth || mouth !== m || !m.want) return; try { w.reopen(); } catch (e) {} }, 300 * m.tries);
      }
    });
    m.ws = w;
    m.want = true;
    return true;
  }

  function settle(line, res) {
    if (line && line.done) { try { line.done(res); } catch (e) {} line.done = null; }
  }

  function mouthFail(why2) {
    if (!mouth) return;
    mouth.want = false;
    if (!why) why = why2;
    remember(why2);
    if (on.status) on.status("THE WIRE :: " + why2);
    try { if (mouth.ws) mouth.ws.close(); } catch (e) {}
    mouth.ws = null;
    mouth.ready = false;
    if (on.dead) { try { on.dead(why2); } catch (e) {} }
  }

  function mouthClose() {
    if (mouth) { mouth.want = false; mouth.closing = true; }
    try { if (mouth && mouth.ws) mouth.ws.close(); } catch (e) {}
    mouth = null;
    stopSpeaking(true);
  }

  function play(b64data, mime) {
    if (!outCtx) outStart();
    try { if (outCtx.state === "suspended" && outCtx.resume) outCtx.resume(); } catch (e) {}
    var bin = atob(String(b64data || ""));
    var n = bin.length >> 1;
    if (!n) return;
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var dv = new DataView(bytes.buffer);
    var want = outCtx.sampleRate;
    var src = null;
    try {
      src = outCtx.createBuffer(1, Math.ceil(n * want / RATE_OUT), want);
    } catch (e) { return; }
    var ch = src.getChannelData(0);
    var step = RATE_OUT / want;
    for (var k = 0; k < ch.length; k++) {
      var p = k * step;
      var i0 = Math.floor(p), i1 = Math.min(i0 + 1, n - 1), f = p - i0;
      var a = dv.getInt16(i0 * 2, true), b = dv.getInt16(i1 * 2, true);
      ch[k] = ((a * (1 - f) + b * f) / 32768);
    }
    var node = outCtx.createBufferSource();
    node.buffer = src;
    node.connect(outGain);
    var at = Math.max(outCtx.currentTime + 0.05, endAt);
    try { node.start(at); } catch (e) { return; }
    if (mouth && mouth.firstMs == null && mouth.t0) mouth.firstMs = now() - mouth.t0;
    endAt = at + src.duration;
    sources.push(node);
    node.onended = function () {
      var i = sources.indexOf(node);
      if (i !== -1) sources.splice(i, 1);
      if (mouth) mouth.secs += src.duration;
      watchEnd();
    };
    if (!muted && mouth && !mouth.speaking) {
      mouth.speaking = true;
      if (on.speakStart) on.speakStart();
    }
    watchEnd();
  }

  var endTimer = null;
  function watchEnd() {
    if (endTimer) return;
    endTimer = setInterval(function () {
      if (sources.length || (mouth && mouth.waiting)) return;
      clearInterval(endTimer); endTimer = null;
      endAt = 0;
      if (mouth) {
        mouth.speaking = false;
        var waitingLines = mouth.defer.splice(0, mouth.defer.length);
        waitingLines.forEach(function (line) { settle(line, { ok: true }); });
      }
      if (on.speakEnd) on.speakEnd();
    }, TICK);
  }

  function stopSpeaking(quiet) {
    var had = sources.length > 0 || (mouth && mouth.speaking);
    sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
    sources = [];
    endAt = 0;
    if (mouth) {
      mouth.speaking = false;
      mouth.suppress = true;
      mouth.said = "";
      // A LINE THAT WAS CUT OFF IS A LINE THAT WAS CANCELLED - settled here rather than left hanging,
      // and never spoken a second time.
      var cut = mouth.defer.splice(0, mouth.defer.length);
      cut.forEach(function (line) { settle(line, { ok: false, cancelled: true }); });
    }
    if (endTimer) { clearInterval(endTimer); endTimer = null; }
    if (had && !quiet && on.speakEnd) on.speakEnd();
  }

  function flushQueue() {
    if (!mouth || !mouth.ready || mouth.waiting || !mouth.queue.length) return;
    var line = mouth.queue.shift();
    mouth.waiting = true;
    mouth.suppress = false;
    mouth.said = "";
    mouth.current = line;
    mouth.lines++;
    mouth.t0 = now();
    mouth.firstMs = null;
    mouth.ws.send({ clientContent: { turns: [{ role: "user", parts: [{ text: "Say this line aloud, exactly:\n" + line.text }] }], turnComplete: true } });
  }

  function checkDrift() {
    if (!mouth || !settings().check) return;
    var want = mouth.want2 && mouth.want2.text;
    var said = mouth.said || "";
    if (!want || !said) return;
    var a = words(want), b = words(said);
    if (!a.length || !b.length) return;
    var hit = 0, j = 0;
    for (var i = 0; i < a.length; i++) {
      var k = b.indexOf(a[i], j);
      if (k !== -1) { hit++; j = k + 1; }
    }
    var score = hit / a.length;
    if (score < DRIFT && Math.abs(a.length - b.length) > 2 && on.drift) {
      try { on.drift(said, want); } catch (e) {}
    }
  }

  function words(t) {
    return String(t || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(function (w) { return w.length > 1; });
  }

  // ---- the two ends together ----------------------------------------------

  var earWhy = "", mouthWhy = "";

  async function open(opts) {
    opts = opts || {};
    if (!available()) { why = reason(); return { ok: false, error: why }; }
    await load();
    var s = settings();
    // A VOICE FOR THIS SESSION ONLY. /voice wire try and the audition say a line in a voice he has not
    // chosen yet; nothing about it is written to the device. It is passed here rather than saved and
    // put back, so an audition cannot leave his channel in someone else's voice if it is interrupted.
    voiceOnce = opts.voice ? String(opts.voice) : null;
    // A MOUTH ON ITS OWN. The audition has no business opening the microphone - it is a question about
    // her voice, not about his room - so the ears are optional (opts.ears === false skips them and
    // everything that waits on them, including getUserMedia).
    var wantEars = opts.ears !== false;
    if (opts.voice && mouth && mouth.ws) mouthClose();
    lvl.threshold = num(opts.level, 0.02, 0, 1);
    lvl.tail = num(opts.tail, 350, 0, 5000);
    var list = null;
    try { list = await models(false); } catch (e) { remember(String((e && e.message) || e)); }
    if (list && list.length) {
      var pickEar = pick(list, "ear", s.earModel);
      var pickMouth = pick(list, "mouth", s.mouthModel);
      if (pickEar && pickEar.model !== s.earModel) { set.earModel = pickEar.model; save(); }
      if (pickMouth && pickMouth.model !== s.mouthModel) { set.mouthModel = pickMouth.model; save(); }
      earWhy = pickEar ? pickEar.why : "";
      mouthWhy = pickMouth ? pickMouth.why : "";
    } else if (list) {
      why = "THIS KEY CAN REACH NO MODEL THAT CAN HOLD A LIVE SESSION (bidiGenerateContent). " + reason();
      return { ok: false, error: why };
    }
    if (wantEars) {
      try {
        await earOpen();
      } catch (e) {
        why = "THE EARS COULD NOT BE OPENED :: " + String((e && e.message) || e).toUpperCase();
        return { ok: false, error: why };
      }
    }
    if (opts.mouth !== false) {
      try { await mouthOpen(); } catch (e) { remember("MOUTH :: " + String((e && e.message) || e)); }
    }
    // THE CHANNEL IS OPEN WHEN THE SOCKETS ARE. Both setups answer with `setupComplete` a moment
    // after the connection is made, and until then anything sent is QUEUED rather than dropped (see
    // wire()) - so nothing is lost either way, but "OPEN" should mean open. A socket that never says
    // it is ready is reported here rather than discovered by a sentence going nowhere.
    var waited = 0;
    while (waited < 6000 && !((!wantEars || earsOpen()) && (opts.mouth === false || mouthReady()))) {
      await new Promise(function (r) { setTimeout(r, 200); });
      waited += 200;
    }
    if (wantEars && !earsOpen()) {
      why = "THE EARS NEVER SAID THEY WERE READY (NO `setupComplete`).";
      return { ok: false, error: why };
    }
    return { ok: true, ear: wantEars ? settings().earModel : null, mouth: settings().mouthModel, voice: voiceOnce || settings().voice, readyMs: waited };
  }

  function close(opts) {
    // A MOUTH-ONLY CLOSE: the audition changes her voice by closing her mouth and opening it again,
    // and must not take the ears, the microphone or the output context down with it.
    if (opts && opts.mouthOnly) { mouthClose(); return; }
    earClose();
    mouthClose();
    micStop();
    try { if (outCtx && outCtx.close) outCtx.close(); } catch (e) {}
    outCtx = null; outGain = null; endAt = 0; sources = [];
  }

  // HER LINE. Resolves when the words have been said (so the caller can queue the next one the way
  // it always did). A line handed over while she is speaking waits its turn - they are said in
  // order, and a hushed line is dropped, not saved up.
  function say(text) {
    var clean = String(text || "").trim();
    if (!clean) return Promise.resolve({ ok: false, error: "NOTHING TO SAY" });
    // NOT READY YET IS NOT A REFUSAL. A mouth that is opening (or reopening after a drop) holds the
    // line and says it the moment it can; only a mouth that is not wanted at all refuses outright.
    if (!mouth || !mouth.want) return Promise.resolve({ ok: false, error: "THE MOUTH IS NOT OPEN" });
    return new Promise(function (resolve) {
      mouth.queue.push({ text: clean, done: resolve });
      if (mouth.queue.length > 3) {
        var dropped = mouth.queue.splice(0, mouth.queue.length - 3);
        dropped.forEach(function (d) { settle(d, { ok: false, cancelled: true }); });
      }
      flushQueue();
    });
  }

  function hush() {
    if (!mouth) return false;
    var was = mouth.speaking || sources.length > 0 || mouth.waiting;
    var q = mouth.queue.splice(0, mouth.queue.length);
    q.forEach(function (line) { settle(line, { ok: false, cancelled: true }); });
    // The line that was actually being said is settled at once - the caller waiting on it must not
    // be left hanging - but the SERVER is still finishing its generation, so the next line waits for
    // that (see flushQueue). Nothing is said twice and nothing queued is lost.
    if (mouth.current) { settle(mouth.current, { ok: false, cancelled: true }); mouth.current = null; }
    stopSpeaking(false);
    return !!was;
  }

  function level() {
    var t = lvl.threshold || 0;
    return { rms: lvl.rms, loud: !!(t && now() - lvl.loudAt < lvl.tail), threshold: t, on: !!t, meter: !!mic };
  }

  // THE TWO TEST ENTRY POINTS. The capture that feeds the wire is an AudioWorklet, and a worklet
  // needs a microphone and a room to be exercised - which is exactly what a test cannot rely on. So
  // the frame the worklet would post can also be pushed here by hand, and the capture's own uplink
  // can be held while it is: `feed` sends a known 16-bit 16kHz frame up the same path the capture
  // uses (same b64, same message), and `mute` stops the microphone being sent while it does. Nothing
  // in the terminal calls them; they exist so the ears can be verified against known audio - see the
  // measurement recorded in /voice wire and in src/chronicle. A muted capture still reports its
  // level, so THE ROOM HEARS YOU does not go blind while it is held.
  function feed(pcm16, opts) {
    if (!ear || !ear.ws || !ear.ws.ready()) return false;
    var a;
    if (pcm16 instanceof Int16Array) a = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    else a = new Uint8Array(pcm16);
    ear.secs += a.length / 2 / RATE_IN;
    ear.ws.send({ realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: b64(a) }] } });
    return true;
  }
  function mute(on) {
    if (mic) mic.silent = !!on;
    return !!(mic && mic.silent);
  }

  function isOpen() { return !!(ear && ear.want) || !!(mouth && mouth.want); }
  function earsOpen() { return !!(ear && ear.want && ear.ready); }
  function mouthReady() { return !!(mouth && mouth.want && mouth.ready); }
  function speaking() { return !!(sources.length || (mouth && mouth.speaking)); }

  function state() {
    var s = settings();
    var hid = hiddenVoices();
    return {
      open: isOpen(), ears: earsOpen(), mouth: mouthReady(),
      speaking: speaking(),
      earModel: s.earModel, mouthModel: s.mouthModel, voice: voiceOnce || s.voice,
      hidden: hid, hiddenCount: hid.length, voicesOffered: voiceNames().length, voicesTotal: VOICES.length,
      silenceMs: s.silenceMs, prefixMs: s.prefixMs,
      sentSeconds: Math.round((ear && ear.secs) || 0),
      dropped: (ear && ear.drops) || 0,
      lines: (mouth && mouth.lines) || 0,
      saidSeconds: Math.round(((mouth && mouth.secs) || 0) * 10) / 10,
      firstWordMs: (mouth && mouth.firstMs != null) ? mouth.firstMs : null,
      queue: (mouth && mouth.queue.length) || 0,
      level: level(),
      audio: outCtx ? String(outCtx.state || "") : "",
      micAudio: mic && mic.ctx ? String(mic.ctx.state || "") : "",
      errors: errors.slice(-3),
      why: why
    };
  }

  function describe() {
    var s = state();
    var st = settings();
    var lines = [];
    lines.push("THE LIVE WIRE :: " + (s.open ? "OPEN" : "CLOSED")
      + " :: THE EARS AND HER MOUTH ON GEMINI'S LIVE API (BIDIRECTIONAL STREAMING), WHILE HER BRAIN STAYS HERE.");
    lines.push("  EARS :: " + String(st.earModel).toUpperCase() + (s.ears ? " :: STREAMING" : " :: NOT OPEN")
      + " :: ANYTHING AT OR ABOVE " + Math.round(st.silenceMs) + "MS OF QUIET ENDS YOUR TURN - THE MODEL'S OWN VOICE-ACTIVITY, NOT A RECOGNISER'S GUESS. START " + st.startSensitivity.replace("START_SENSITIVITY_", "") + ", END " + st.endSensitivity.replace("END_SENSITIVITY_", "") + ". /voice wire quiet <MS> MOVES IT.");
    lines.push("  MOUTH :: " + String(st.mouthModel).toUpperCase() + " :: VOICE \"" + String(s.voice).toUpperCase() + "\""
      + (s.mouth ? " :: SPEAKING IN STREAMED 24kHz AUDIO" : " :: NOT OPEN")
      + " :: HER REPLY IS HANDED OVER AS THE WORDS THE TERMINAL ALREADY WROTE AND SAID BACK UNCHANGED - 583-934MS TO HER FIRST WORD ACROSS RUNS (UNDER A SECOND EVERY TIME), MEASURED ON THIS KEY. /voice wire voice <NAME> CHOOSES THE VOICE.");
    if (s.sentSeconds) lines.push("  THIS SESSION :: " + s.sentSeconds + "S OF YOUR VOICE SENT" + (s.saidSeconds ? ", " + s.saidSeconds + "S OF HERS SPOKEN" : "")
      + (s.dropped ? " :: " + s.dropped + " SOCKET DROP" + (s.dropped === 1 ? "" : "S") + " CAUGHT AND REPAIRED" : " :: NO SOCKET HAS DROPPED"));
    if (s.firstWordMs != null) lines.push("  HER LAST LINE :: THE FIRST PIECE OF IT ARRIVED " + s.firstWordMs + "MS AFTER IT WAS HANDED OVER, AND PLAYED AT ONCE - NOT AFTER A WHOLE CLIP HAD BEEN BUILT. (THE FLOOR IS WHATEVER THE MODEL TAKES TO START TALKING; 583-934MS ACROSS RUNS WAS MEASURED ON THIS KEY.)");
    if (s.queue) lines.push("  " + s.queue + " LINE" + (s.queue === 1 ? "" : "S") + " WAITING TO BE SAID.");
    if (st.check) lines.push("  HER MOUTH IS CHECKED :: WHAT IT ACTUALLY SAYS IS TRANSCRIBED BACK AND COMPARED WITH WHAT IT WAS GIVEN, AND A PARAPHRASE IS REPORTED RATHER THAN PASSED OFF. /voice wire check off STOPS THE CHECK.");
    if (s.hiddenCount) {
      lines.push("  VOICES OFF THE LIST :: " + s.hiddenCount + " OF " + s.voicesTotal + " CANNOT BE CHOSEN OR AUDITIONED (" + s.hidden.map(function (n) { return String(n).toUpperCase(); }).join(", ") + ")."
        + "\n    THE CODE STILL CARRIES EVERY ONE OF THEM AND NOTHING ELSE ABOUT THEM CHANGED. /voice wire hidden PRINTS THEM, /voice wire show <NAME> PUTS ONE BACK, /voice wire hide <NAME> TAKES ONE OUT.");
      if (isHidden(st.voice)) lines.push("  THE VOICE IN FORCE, " + qname(st.voice) + ", IS ONE OF THEM :: IT STAYS IN FORCE UNTIL ANOTHER IS CHOSEN - HIDING NOTHING TAKES HER VOICE AWAY - BUT IT IS NOT OFFERED AGAIN. /voice wire show " + String(st.voice).toUpperCase() + " PUTS IT BACK IN THE LIST.");
    }
    if (!available()) lines.push("  " + reason());
    (s.errors || []).forEach(function (e) { lines.push("  LAST FAILURE (" + new Date(e.at).toTimeString().slice(0, 8) + ") :: " + e.what); });
    return lines.join("\n");
  }

  return {
    load: load,
    available: available, supported: supported, reason: reason,
    open: open, close: close, isOpen: isOpen,
    earsOpen: earsOpen, mouthReady: mouthReady, speaking: speaking,
    say: say, hush: hush,
    level: level, state: state, describe: describe,
    feed: feed, mute: mute,
    models: models, settings: settings, setSetting: setSetting,
    voices: function () { return voiceNames(); },
    // NAME AND CHARACTER, TOGETHER, for the VOX panel (src/js/vox.js) - the table is read here rather
    // than made again there, so the one-word description of a wire voice has one home.
    voicesTable: function () { return VOICES.map(function (v) { return { name: v[0], character: v[1] }; }); },
    voicesAll: voiceNamesAll,
    hiddenVoices: hiddenVoices,
    isHidden: isHidden,
    setHidden: setHidden,
    voiceNote: voiceNote,
    voicesText: voicesText,
    on: on
  };
})();
