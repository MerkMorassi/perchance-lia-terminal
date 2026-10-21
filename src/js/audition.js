/* ------------------------------------------------------------------
   THE AUDITION BUS - the one transport, and her ears.

   Patrikios, 2026-09-21: "I'd love to be able to hear her live comments while
   'auditioning' together. That would be a great feature for all media. We need
   an audio audition BUS. It is simply audio playback for now where we both
   listen together."

   So there is ONE player in this terminal. A piece of music is put ON THE BUS
   - from the gallery (its music tiles), from the full stage, from a file
   dropped on the strip, or with /hear <words> - and it plays while the
   conversation carries on around it. The strip above the input is the
   transport: name, playhead, scrub, play/pause, the line, volume, and the two
   buttons that involve her. Anything else that used to make its own <audio>
   element now puts its piece on the bus instead, because two players is two
   things playing at once, which is the opposite of listening together.

   WHAT SHE HAS OF A PIECE. This module is also her EARS. The text model this
   terminal speaks through takes pictures and nothing else, so the sound is
   reduced HERE, on this device, to a mono 16 kHz WAV and sent to the Google
   (Gemini) key from the key ring; the answer is written onto the record as
   `heard` - her own reading of the sound, in exactly the shape `sight` has for
   a picture. What the terminal will NEVER do is let her talk about a sound she
   has not heard: with no key, or before she has listened, her block says so in
   as many words, and she is asked to keep to what she actually has.

   HER LIVE COMMENTS. While a piece is on the bus, every turn she answers is a
   turn answered WHILE LISTENING: the block rides in her instruction with the
   piece, the playhead, what she has of it and what she has already said about
   it (with the moment inside the piece each remark was made at). On top of that
   the ASK HER button, `/hear`, and - unless it is turned off - a quiet cadence
   of unasked comments while it plays, give her the floor with no words from
   him, exactly the way /checkin does. Every comment is anchored to the
   playhead it was made at, filed in the archive with that position, and kept in
   the audition log on this device, so a session of listening is a thing that
   can be read back afterwards.

   Commands: /bus · /bus stop|play|pause|next|clear|auto off|every <MIN>|log
             /hear · /hear ears · /hear <WORDS|#TAG|/FOLDER|id>
             /hear words|reading|ask|sample|powers|clear [...]   (src/js/hear.js - the Gemini lane:
             what a voice SAYS word for word, and what it MEANS - mood, sentiment, a summary)
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var LOG_KEY = "auditions";
  var SET_KEY = "audition";
  var PROVIDER = "google";
  var API = "https://generativelanguage.googleapis.com/v1beta";

  function num(v, dft) { var n = Number(v); return isFinite(n) ? n : dft; }
  var EARS_SECONDS = num(typeof LIA_EARS_SECONDS !== "undefined" ? LIA_EARS_SECONDS : 180, 180);
  var EARS_RATE = num(typeof LIA_EARS_RATE !== "undefined" ? LIA_EARS_RATE : 16000, 16000);
  var EARS_DECODE_MAX = num(typeof LIA_EARS_DECODE_MAX !== "undefined" ? LIA_EARS_DECODE_MAX : 160 * 1024 * 1024, 160 * 1024 * 1024);
  var LOG_MAX = Math.round(num(typeof LIA_BUS_LOG_MAX !== "undefined" ? LIA_BUS_LOG_MAX : 200, 200));
  var AUTO_EVERY_MIN = num(typeof LIA_BUS_AUTO_EVERY !== "undefined" ? LIA_BUS_AUTO_EVERY : 4, 4);
  var AUTO_MAX = Math.round(num(typeof LIA_BUS_AUTO_MAX !== "undefined" ? LIA_BUS_AUTO_MAX : 3, 3));
  var DUCK = 0.3;                  // how far the bus drops while her voice is speaking
  var TICK = 15000;                // the cadence ticker
  var TICK_DUCK = 500;             // how often the duck is checked
  var EARS_TRIES = 4;              // how many listening models one press of HER EARS may try
  var EARS_COOLDOWN = 10 * 60000;  // how long a model that just failed is set aside

  /* ---- state --------------------------------------------------------------- */

  var el = null;                   // THE audio element - the whole terminal's player
  var currentId = "";              // the vault id on the bus
  var line = [];                   // vault ids lined up after it
  var history = [];                // the audition log (kv): what was listened to, and what she said
  var open = null;                 // the open history entry for the piece playing now
  var settings = { volume: 1, auto: true, autoEvery: AUTO_EVERY_MIN, earsModel: "", earsTried: {} };
  var lastCommentAt = 0;           // when her unasked cadence last spoke
  var commentCount = 0;            // unasked comments on THIS piece
  var asking = false;              // a comment is being composed right now
  var learning = false;
  var dragging = false;
  var ducked = false;
  var stripOpen = false;            // the strip above the input is shown while a piece is on the bus,
                                    // and can be opened empty (the AUDITION button) so a file can be
                                    // dropped on it before there is anything to play.
  var loaded = false, loading = null;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function media() { return window.media || null; }
  function keyring() { return window.keyring || null; }
  function say(msg) { if (typeof print === "function") print("SYSTEM", msg); }
  // PRIVATE MODE (2026-10-21): the audition bus is a speaker in the room -
  // dark while the guest line is up. HITL<>MAYA only: her signal in his
  // headphones, his mic on her ears, nothing else sounding anywhere.
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }
  function trace(msg) { if (typeof backstage === "function") backstage(msg); else say(msg); }
  function elOf(id) { return document.getElementById(id); }
  function rec(id) { var M = media(); return (M && M.get) ? M.get(id) : null; }
  function isAudio(rec) { return !!(rec && /^audio\//.test(String(rec.mime || ""))); }
  function nameOf(rec) { return rec ? String(rec.name || rec.prompt || "a piece of audio") : "nothing"; }

  function mmss(sec) {
    sec = Math.max(0, Math.round(num(sec, 0)));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") + m : String(m)) + ":" + (s < 10 ? "0" : "") + s;
  }

  // THE BAR (src/js/progress.js). HER EARS are the one lane here that is really slow: the sound is
  // decoded and reduced to mono 16 kHz ON THIS DEVICE (seconds on a long piece) and then handed to
  // the model, which answers in its own time. There is no count to give for either half - it is one
  // decode and one call - so the bar is indeterminate, and its label changes from the reduction to
  // the listening so the rail says which half she is in.
  function pbar(label) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "ears",
        detail: "HER EARS - the sound is reduced here, on this device, and only those seconds are sent",
      });
    } catch (e) {}
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("ears"); } catch (e) {}
  }

  /* ---- what is kept on this device ----------------------------------------- */

  async function load() {
    if (loading) return loading;
    loading = (async function () {
      var k = kv();
      if (!k) return;
      try {
        var v = await k.get(LOG_KEY);
        history = Array.isArray(v) ? v.slice(-LOG_MAX) : [];
      } catch (e) { console.warn("audition log unreadable", e); }
      try {
        var s = await k.get(SET_KEY);
        if (s && typeof s === "object") {
          if (s.volume != null && isFinite(Number(s.volume))) settings.volume = Math.max(0, Math.min(1, Number(s.volume)));
          if (typeof s.auto === "boolean") settings.auto = s.auto;
          if (s.autoEvery != null && isFinite(Number(s.autoEvery))) settings.autoEvery = Math.max(0.5, Math.min(60, Number(s.autoEvery)));
          if (typeof s.earsModel === "string") settings.earsModel = s.earsModel;
          if (s.earsTried && typeof s.earsTried === "object") settings.earsTried = s.earsTried;
        }
      } catch (e) { console.warn("audition settings unreadable", e); }
      loaded = true;
    })();
    return loading;
  }

  async function saveLog() {
    var k = kv();
    if (!k) return;
    try { await k.set(LOG_KEY, history.slice(-LOG_MAX)); } catch (e) { console.warn("audition log not saved", e); }
  }
  async function saveSettings() {
    var k = kv();
    if (!k) return;
    try { await k.set(SET_KEY, { volume: settings.volume, auto: settings.auto, autoEvery: settings.autoEvery, earsModel: settings.earsModel }); }
    catch (e) { console.warn("audition settings not saved", e); }
  }

  // One line in the audition log per listen. It opens when a piece lands on the bus and closes a few
  // seconds after it stops being the piece on the bus, so an evening of listening is a list of what
  // was heard and what she said while it played.
  function openEntry(rec) {
    closeEntry();
    var entry = {
      id: rec.id, name: nameOf(rec), mime: String(rec.mime || ""), dur: num(rec.duration, 0),
      startedAt: Date.now(), endedAt: 0, played: 0, comments: [],
    };
    open = entry;
    history.push(entry);
    if (history.length > LOG_MAX) history = history.slice(-LOG_MAX);
    return entry;
  }
  function closeEntry() {
    if (!open) return;
    open.endedAt = Date.now();
    open.played = Math.max(open.played, playPos());
    open = null;
    saveLog();
  }
  function noteComment(text, at) {
    if (!open) return;
    open.comments.push({ at: Math.round(num(at, playPos())), ts: Date.now(), text: String(text || "") });
    open.played = Math.max(open.played, playPos());
    saveLog();
  }

  /* ---- the element --------------------------------------------------------- */

  function ensureEl() {
    if (el) return el;
    el = document.createElement("audio");
    el.id = "busAudio";
    el.preload = "metadata";
    el.volume = settings.volume;
    el.addEventListener("play", function () { duckCheck(); render(); });
    el.addEventListener("pause", function () { render(); });
    el.addEventListener("ended", function () { onEnded(); });
    el.addEventListener("loadedmetadata", function () { open && (open.dur = durOf()); render(); });
    el.addEventListener("timeupdate", function () { if (!dragging) paintProgress(); tick(); });
    el.addEventListener("error", function () {
      var r = rec(currentId);
      say("THE BUS COULD NOT PLAY " + String(nameOf(r)).toUpperCase() + " :: THIS BROWSER REFUSED THE FILE ITSELF (ITS OWN CODEC SET, NOTHING TO DO WITH THE VAULT). THE FILE IS UNTOUCHED.");
      render();
    });
    var host = elOf("busAudioHost");
    if (host) host.appendChild(el);
    return el;
  }

  function durOf() {
    if (!el) return num(rec(currentId) && rec(currentId).duration, 0);
    var d = Number(el.duration);
    if (isFinite(d) && d > 0) return d;
    var r = rec(currentId);
    return r ? num(r.duration, 0) : 0;
  }
  function playPos() { return el ? num(el.currentTime, 0) : 0; }

  /* ---- putting something on the bus ---------------------------------------- */

  async function load2(id, opts) {
    opts = opts || {};
    await load();
    var r = rec(id);
    if (!r) { say("THE BUS HAS NOTHING BY THAT ID (" + id + ")."); return false; }
    if (!r.blob) { say("THAT RECORD HAS NO FILE IN IT."); return false; }
    if (!isAudio(r)) {
      say("THE BUS TAKES SOUND. " + String(nameOf(r)).toUpperCase() + " IS " + String(r.mime || "an unknown kind").toUpperCase()
        + " - PICTURES GO TO HER EYES (/sight) AND CLIPS HAVE THEIR OWN PLAYERS IN THE LOG AND THE GALLERY.");
      return false;
    }
    var audio = ensureEl();
    if (currentId === id && audio.getAttribute("src")) { if (opts.play) play(); return true; }
    closeEntry();
    currentId = id;
    commentCount = 0;
    lastCommentAt = Date.now();
    openEntry(r);
    var url = media().url(id);
    if (!url) { say("THE VAULT COULD NOT HAND BACK A FILE FOR THAT RECORD."); return false; }
    audio.src = url;
    audio.volume = settings.volume;
    audio.playbackRate = 1;
    say("ON THE BUS :: " + String(nameOf(r)).toUpperCase() + (r.duration ? " (" + mmss(r.duration) + ")" : "")
      + " :: " + String(media().folderOf(r) || "").toUpperCase()
      + (hasEars(r) ? " :: SHE HAS HEARD THIS ONE" : (keyring() && keyring().has && keyring().has(PROVIDER) ? " :: HER EARS ARE OFFERED (HER EARS)" : " :: NO EAR YET (A GOOGLE KEY GIVES HER ONE)")));
    render();
    if (opts.play) play();
    return true;
  }

  function play() {
    if (guestUp()) { say("GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. THE BUS STAYS DARK WHILE IT IS UP - HANG UP FIRST."); return; }
    if (!currentId) { say("NOTHING IS ON THE BUS. PUT A PIECE ON IT FROM THE GALLERY, OR DROP AN AUDIO FILE ON THE STRIP."); return; }
    var audio = ensureEl();
    audio.volume = ducked ? settings.volume * DUCK : settings.volume;
    var p = audio.play();
    if (p && p.catch) p.catch(function (e) { say("PLAYBACK WAS BLOCKED :: " + String((e && e.message) || "PRESS PLAY AGAIN").toUpperCase()); });
    render();
  }
  function pause() { if (el && !el.paused) el.pause(); render(); }
  function toggle() { if (!el || el.paused) play(); else pause(); }
  function seek(sec) {
    if (!el || !currentId) return;
    var d = durOf();
    var t = Math.max(0, Math.min(d || sec, num(sec, 0)));
    try { el.currentTime = t; } catch (e) { }
    render();
  }
  function setVolume(v) {
    settings.volume = Math.max(0, Math.min(1, num(v, settings.volume)));
    if (el) el.volume = ducked ? settings.volume * DUCK : settings.volume;
    saveSettings();
    render();
  }
  function stop() {
    if (!currentId) return false;
    if (el) { try { el.pause(); } catch (e) { } el.removeAttribute("src"); try { el.load(); } catch (e) { } }
    closeEntry();
    currentId = "";
    line = [];
    render();
    return true;
  }

  // The strip itself: opened empty so there is somewhere to drop a file and something to read, and
  // closed again when he is done with it. While a piece is loaded it shows itself.
  function openStrip() { stripOpen = true; render(); return true; }
  function closeStrip() { stripOpen = false; render(); return true; }

  // The line after this one: listening to a set, the way a session actually goes.
  function queue(ids) {
    var added = [];
    (Array.isArray(ids) ? ids : [ids]).forEach(function (id) {
      var r = rec(id);
      if (r && isAudio(r) && id !== currentId && line.indexOf(id) === -1) { line.push(id); added.push(id); }
    });
    render();
    return added;
  }
  function next(playIt) {
    var id = line.shift();
    if (!id) { say("THAT WAS THE LAST ONE ON THE LINE."); render(); return false; }
    load2(id, { play: playIt !== false });
    return true;
  }
  function prev() {
    if (el && playPos() > 4) { seek(0); return true; }
    say("THE BUS DOES NOT KEEP WHAT HAS ALREADY PLAYED. THE LINE ONLY RUNS FORWARD - /bus log HAS THE LAST FEW.");
    return false;
  }
  function onEnded() {
    if (open) { open.played = durOf(); }
    if (line.length) { next(true); return; }
    if (open) { open.endedAt = Date.now(); saveLog(); }
    say("THE BUS HAS REACHED THE END :: " + String(nameOf(rec(currentId))).toUpperCase() + ".");
    render();
  }

  /* ---- her ears: what she has of a piece ----------------------------------- */

  function hasEars(r) { return !!(r && r.heard && String(r.heard.text || "").trim()); }

  function earsWord() {
    if (keyring() && keyring().bypassed && keyring().bypassed(PROVIDER)) return "GEMINI CALLS BYPASSED (KEYS PANEL)";
    if (!keyring() || !keyring().has || !keyring().has(PROVIDER)) return "NO EAR YET (A GOOGLE AI KEY GIVES HER ONE - KEYS PANEL)";
    return "HER EARS ARE READY (GOOGLE KEY HELD)";
  }

  // The report of a listening already done: what it was, over what stretch, and at what rate - so
  // she is never told she heard the whole of something that was a 16 kHz excerpt of it.
  function heardText(r) {
    if (!hasEars(r)) return "";
    var h = r.heard;
    var bits = [];
    if (h.from || h.seconds) bits.push("she listened " + (h.from ? "from " + mmss(h.from) : "from the start")
      + (h.seconds ? " for " + mmss(h.seconds) : "") + " (mono " + Math.round(num(h.rate, EARS_RATE) / 1000) + " kHz)");
    return String(h.text || "").trim() + (bits.length ? "\n(" + bits.join("; ") + " - via " + (h.model || h.engine || "the listening service") + ")" : "");
  }

  // Reduce the file to something a listening service will take: mono, 16 kHz, 16-bit WAV. This is
  // done HERE, on this device, and nothing else about the piece goes anywhere. A master WAV is
  // 60 MB and minutes long; what is handed over is at most LIA_EARS_SECONDS of it at a sampling
  // rate the ear of a model is perfectly happy with.
  async function toListenableWav(blob, from, seconds) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("THIS BROWSER HAS NO AUDIO DECODER, SO IT CANNOT LISTEN TO THE FILE HERE.");
    if (num(blob.size, 0) > EARS_DECODE_MAX) {
      throw new Error("THE FILE IS LARGER THAN THE DECODE LIMIT (" + Math.round(EARS_DECODE_MAX / (1024 * 1024)) + " MB) - REDUCE IT AS A COPY FIRST, OR RAISE LIA_EARS_DECODE_MAX IN src/js/config.js.");
    }
    var ctx = new AC();
    var buf;
    try {
      buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    } finally {
      try { ctx.close(); } catch (e) { }
    }
    var total = num(buf.duration, 0);
    var start = Math.max(0, Math.min(from || 0, Math.max(0, total - 1)));
    var secs = Math.max(1, Math.min(seconds || EARS_SECONDS, total - start));
    var frames = Math.ceil(secs * EARS_RATE);
    var oc = new OfflineAudioContext(1, frames, EARS_RATE);
    var src = oc.createBufferSource();
    src.buffer = buf;
    src.connect(oc.destination);
    src.start(0, start, secs);
    var rendered = await oc.startRendering();
    var pcm = rendered.getChannelData(0);
    // 16-bit PCM WAV, the one container every listening service takes.
    var bytes = 44 + pcm.length * 2;
    var view = new DataView(new ArrayBuffer(bytes));
    function str(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    str(0, "RIFF"); view.setUint32(4, bytes - 8, true); str(8, "WAVE"); str(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, EARS_RATE, true); view.setUint32(28, EARS_RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (var i2 = 0; i2 < pcm.length; i2++) {
      var v = Math.max(-1, Math.min(1, pcm[i2]));
      view.setInt16(44 + i2 * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return { blob: new Blob([view.buffer], { type: "audio/wav" }), from: start, seconds: secs, total: total };
  }

  function b64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || "");
        var i = s.indexOf(",");
        resolve(i === -1 ? "" : s.slice(i + 1));
      };
      fr.onerror = function () { reject(fr.error || new Error("the file could not be read here")); };
      fr.readAsDataURL(blob);
    });
  }

  async function gcall(path, body) {
    var kr = keyring();
    if (!kr || !kr.request) throw new Error("THE KEY RING IS OFFLINE.");
    var res = await kr.request(PROVIDER, API + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    var text = "";
    try { text = await res.text(); } catch (e) { text = ""; }
    var data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!res.ok) {
      var why = (data && data.error && data.error.message) ? data.error.message : (text || ("HTTP " + res.status));
      throw new Error(String(why).replace(/\s+/g, " ").slice(0, 220));
    }
    return data || {};
  }

  // Which listening model this key can actually reach, and WHICH ONE ACTUALLY LISTENED. The list is
  // a fact about the key (asked once, then kept), but the CHOICE is a fact about the service: a model
  // that answers /models can still refuse the request (busy, overloaded, retired for new users), so
  // nothing is remembered as "her ears" until a piece it listened to came back. `settings.earsModel`
  // is therefore the last model that WORKED, and a model that just failed is set aside for a while
  // (EARS_COOLDOWN) so the next attempt steps down the list instead of hitting the same wall.
  var ranked = null, rankedAt = 0, pickPromise = null;

  async function rankedModels(force) {
    var want = (typeof LIA_EARS_MODEL === "string" && LIA_EARS_MODEL) ? String(LIA_EARS_MODEL).replace(/^models\//, "") : "";
    if (want) return [want];                                  // pinned by hand in config.js
    if (ranked && !force && Date.now() - rankedAt < 30 * 60 * 1000) return ranked;
    if (pickPromise && !force) return pickPromise;
    pickPromise = (async function () {
      var data = await gcall("/models", null);
      var names = ((data && data.models) || []).filter(function (m) {
        var methods = m.supportedGenerationMethods || [];
        return methods.indexOf("generateContent") !== -1;
      }).map(function (m) { return String(m.name || "").replace(/^models\//, ""); });
      // Only the general multimodal line: embeddings, image-makers and speech models cannot listen.
      var usable = names.filter(function (n) { return !/embed|imagen|veo|tts|audio|image|learnlm|aqa|gemma/i.test(n); });
      function scoreFn(n) {
        var s = 0;
        if (/flash/.test(n)) s += 40;                       // fast and cheap: the right ear for this
        if (/pro/.test(n)) s += 20;
        if (/latest/.test(n)) s += 8;
        var ver = n.match(/(\d+(?:\.\d+)?)/);
        if (ver) s += Math.min(12, parseFloat(ver[1]));
        if (/preview|exp/.test(n)) s -= 4;
        return s;
      }
      usable.sort(function (a, b) { return scoreFn(b) - scoreFn(a); });
      if (!usable.length) throw new Error("THIS KEY CANNOT REACH A MODEL THAT CAN LISTEN (THE MODELS LIST CAME BACK WITHOUT ONE).");
      ranked = usable; rankedAt = Date.now();
      return ranked;
    })().catch(function (e) { pickPromise = null; throw e; });
    return pickPromise;
  }

  function triedRecently(m) {
    var t = settings.earsTried && settings.earsTried[m];
    return !!t && (Date.now() - t < EARS_COOLDOWN);
  }

  // The next model to try: the one that worked last first (it is the known quantity), then the
  // ranked list, skipping anything already used in this attempt and anything still cooling down.
  function pickModel(list, used) {
    used = used || [];
    var order = [];
    if (settings.earsModel) order.push(settings.earsModel);
    for (var i = 0; i < list.length; i++) if (order.indexOf(list[i]) === -1) order.push(list[i]);
    for (var j = 0; j < order.length; j++) {
      var m = order[j];
      if (!m || used.indexOf(m) !== -1 || triedRecently(m)) continue;
      return m;
    }
    return "";
  }

  function modelFailed(m) {
    settings.earsTried = settings.earsTried || {};
    settings.earsTried[m] = Date.now();
    Object.keys(settings.earsTried).forEach(function (k) {
      if (Date.now() - settings.earsTried[k] > EARS_COOLDOWN) delete settings.earsTried[k];
    });
    try { saveSettings(); } catch (e) { }   // a set-aside outlives the page, so a reload does not re-hammer it
  }

  // HER EARS. Listen to a piece (or to a stretch of it), write down what is in it, keep it on the
  // record as her own reading of the sound.
  async function learn(id, opts) {
    opts = opts || {};
    await load();
    id = id || currentId;
    var r = rec(id);
    if (!r) { say("THERE IS NOTHING BY THAT ID TO LISTEN TO."); return { ok: false }; }
    if (!isAudio(r)) { say("SHE LISTENS TO SOUND. THAT RECORD IS " + String(r.mime || "of an unknown kind").toUpperCase() + " - A PICTURE GOES TO HER EYES INSTEAD (/sight)."); return { ok: false }; }
    if (learning) { say("SHE IS ALREADY LISTENING TO SOMETHING."); return { ok: false }; }
    var kr = keyring();
    // The ring reads its keys from this device asynchronously at boot, so a press in the first moment
    // of a fresh page must not be answered with "she has no ear for this file". Ask it to be ready.
    if (kr && kr.ready && !kr.ready() && kr.load) { try { await kr.load(); } catch (e) { } }
    if (!kr || !kr.has || !kr.has(PROVIDER)) {
      say("SHE HAS NO EAR FOR THIS FILE YET, AND NONE CAN BE MADE WITHOUT A KEY :: HER HEARING RUNS ON THE GOOGLE AI (GEMINI) KEY, BECAUSE THE MODEL THIS TERMINAL SPEAKS THROUGH HEARS NOTHING AT ALL."
        + "\nSTORE ONE IN THE KEYS PANEL (KEYS \u25be), THEN PRESS HER EARS AGAIN. UNTIL THEN SHE IS TOLD PLAINLY THAT SHE CANNOT HEAR IT - AND WILL NOT PRETEND TO.");
      return { ok: false, error: "no key" };
    }
    learning = true;
    var from = (opts.from != null) ? opts.from : (id === currentId ? playPos() : 0);
    pbar("HER EARS \u00b7 REDUCING THE SOUND");
    try {
      say("HER EARS :: REDUCING " + String(nameOf(r)).toUpperCase() + " TO MONO " + Math.round(EARS_RATE / 1000) + " kHz HERE, ON THIS DEVICE ..."
        + "\nNOTHING BUT THOSE SECONDS OF SOUND GO ANYWHERE, AND THE FILE ITSELF IS UNTOUCHED.");
      var made = await toListenableWav(r.blob, from, opts.seconds || EARS_SECONDS);
      pbar("HER EARS \u00b7 LISTENING");   // the reduction is done; the model has it now
      var data = await b64(made.blob);
      var list = await rankedModels();
      var body = {
        contents: [{
          parts: [
            { text: String(typeof LIA_EARS_PROMPT === "string" ? LIA_EARS_PROMPT : "Describe what is in this audio.") },
            { inlineData: { mimeType: "audio/wav", data: data } },
          ],
        }],
        generationConfig: { temperature: 0.5 },
      };
      // A model that answers /models can still refuse the request - busy, overloaded, or retired for
      // new keys ("no longer available to new users"). So the sound is offered down the list rather
      // than to one name: what is remembered afterwards is the model that actually listened.
      var out = null, model = "", lastErr = null, used = [];
      for (var attempt = 0; attempt < EARS_TRIES && !out; attempt++) {
        model = pickModel(list, used);
        if (!model) break;
        used.push(model);
        if (attempt) say("HER EARS :: TRYING " + model.toUpperCase() + " ...");
        try {
          out = await gcall("/models/" + model + ":generateContent", body);
        } catch (e) {
          lastErr = e;
          modelFailed(model);
          var why = String((e && e.message) || "");
          if (attempt < EARS_TRIES - 1) {
            say("HER EARS :: " + model.toUpperCase() + " WOULD NOT LISTEN :: " + why.toUpperCase()
              + "\nTHE FILE IS UNTOUCHED AND NOTHING WAS WRITTEN. TRYING ANOTHER MODEL ...");
          }
        }
      }
      if (!out) throw (lastErr || new Error("NO MODEL THIS KEY CAN REACH WOULD LISTEN TO IT."));
      var parts = (((out.candidates || [])[0] || {}).content || {}).parts || [];
      var text = parts.map(function (p) { return String(p.text || ""); }).join(" ").replace(/\s+/g, " ").trim();
      if (!text) throw new Error("the service returned no words about it");
      // THIS is the moment the choice becomes a fact: a piece it listened to came back. Until now,
      // nothing about WHICH model her ears are had been written down.
      settings.earsModel = model;
      settings.earsTried = {};
      await saveSettings();
      var heard = {
        text: text, engine: "GEMINI", model: model, ts: Date.now(),
        from: Math.round(made.from * 10) / 10, seconds: Math.round(made.seconds * 10) / 10,
        total: Math.round(made.total * 10) / 10, rate: EARS_RATE,
        note: "a mono " + Math.round(EARS_RATE / 1000) + " kHz reduction made on this device" + (made.seconds < made.total - 1 ? ", from " + mmss(made.from) + " of " + mmss(made.total) : ""),
      };
      if (media().setField) await media().setField(id, "heard", heard);
      var said = text.length > 300 ? text.slice(0, 300) + "\u2026" : text;
      say("SHE HAS HEARD IT :: " + String(nameOf(r)).toUpperCase() + " :: " + mmss(heard.seconds) + " LISTENED TO"
        + (heard.from ? " (FROM " + mmss(heard.from) + ")" : "") + " :: " + String(model).toUpperCase()
        + "\n" + said
        + "\nIT IS WRITTEN ON THE RECORD AS WHAT SHE HEARD (/bus log, and the full stage), SO SHE SPEAKS FROM IT FROM NOW ON.");
      render();
      return { ok: true, heard: heard };
    } catch (e) {
      var m = String((e && e.message) || e);
      try { if (kr.scrub) m = kr.scrub(m, PROVIDER); } catch (e2) { }
      say("SHE COULD NOT LISTEN TO IT :: " + m.toUpperCase() + "\nNOTHING WAS WRITTEN AND THE FILE IS UNTOUCHED. SHE IS STILL TOLD SHE HAS NOT HEARD IT.");
      return { ok: false, error: m };
    } finally {
      learning = false;
      pbarDone();
    }
  }

  /* ---- what she is told about the bus -------------------------------------- */

  function lineNames() {
    return line.map(function (id) { var r = rec(id); return r ? nameOf(r) + (r.duration ? " (" + mmss(r.duration) + ")" : "") : id; });
  }

  // The block that rides in her instruction on every turn answered while something is on the bus.
  // Volatile, so it sits with the other volatile blocks (near the end, after the memory and canon
  // half of the prompt) - the cacheable prefix stays exactly what it was.
  function block() {
    if (!currentId) return "";
    var r = rec(currentId);
    if (!r) return "";
    var d = durOf(), at = playPos();
    var playing = el ? !el.paused : false;
    var out = [];
    out.push("Patrikios has a piece of audio on the audition bus and you are listening to it with him - the same piece, at the same moment inside it. This is not an instruction to speak about it; it is what is in the room while you answer.");
    out.push("ON THE BUS: \"" + nameOf(r) + "\""
      + (d ? ", " + mmss(d) + " long" : "") + ", kept in " + String(media().folderOf(r) || "the vault")
      + (r.bytes ? ", " + Math.round(r.bytes / (1024 * 1024) * 10) / 10 + " MB" : "")
      + ". The playhead is at " + mmss(at) + (d ? " of " + mmss(d) : "") + " and it is " + (playing ? "playing" : "paused") + ".");
    if (open && open.comments.length) {
      out.push("WHAT YOU HAVE ALREADY SAID ABOUT THIS ONE, and where in it you said it:");
      open.comments.slice(-6).forEach(function (c) { out.push("  at " + mmss(c.at) + " - \"" + String(c.text).replace(/\s+/g, " ").slice(0, 200) + "\""); });
    }
    // WHAT IT SAYS, WHEN THE WORDS ARE ON THE RECORD (src/js/hear.js). A transcript is a DIFFERENT
    // FACT from her own reading of the sound - one is what is said, the other is what is there - so
    // it is handed over whichever way her ears went, and it is why she can answer about a voice
    // instead of only describing it. The words and the reading are one call's work, written on the
    // record by the hearing lane, so nothing is sent anywhere to put them here.
    var tr = r.transcript;
    if (tr && (tr.text || tr.speech === false)) {
      out.push(tr.speech === false
        ? "WHAT IT SAYS (read out of the audio itself, on this device, by the hearing lane): there are no spoken words in it at all."
        : "WHAT IT SAYS, WORD FOR WORD - read out of the audio itself, not a description of the sound:\n\u201c" + String(tr.text).replace(/\s+/g, " ").slice(0, 4000) + "\u201d");
    }
    var rd = r.reading;
    if (rd && (rd.summary || rd.emotion || rd.sentiment || rd.tone)) {
      var feel = [];
      if (rd.emotion) feel.push("emotion: " + rd.emotion);
      if (rd.tone) feel.push("delivery: " + rd.tone);
      if (rd.sentiment) feel.push("sentiment: " + rd.sentiment + (rd.intensity != null ? " (" + Math.round(num(rd.intensity, 0) * 100) + "%)" : ""));
      if (rd.speakers) feel.push("voices: " + rd.speakers);
      if (rd.language) feel.push("language: " + rd.language);
      if (rd.music) feel.push("it carries music");
      if (rd.title) feel.push("a label for it: " + rd.title);
      out.push("WHAT A READING OF IT FOUND (the same reading is on the record):\n" + feel.join("; ")
        + (rd.summary ? "\n" + rd.summary : ""));
    }
    if (hasEars(r)) {
      out.push("WHAT YOU HEARD WHEN YOU LISTENED TO IT (your own reading of the sound, from earlier):");
      out.push(heardText(r));
    } else {
      var doc = null;
      try { doc = (window.attach && window.attach.items) ? window.attach.items().filter(function (x) { return x.kind === "audio" && x.name === r.name; })[0] : null; } catch (e) { doc = null; }
      out.push("YOU HAVE NOT HEARD THIS ONE. You have no ear for a file as it plays: what you have is its name, its length, and that he is listening to it right now."
        + (doc && doc.text ? " Its words were transcribed when it was handed over, and this is the transcript:\n" + String(doc.text).slice(0, 1200) : "")
        + " Do not describe the sound, and do not pretend to hear it - if you speak about it, speak from what you actually have, and you may say plainly that you cannot hear it yet.");
    }
    var rest = lineNames();
    if (rest.length) out.push("ALSO ON THE LINE AFTER THIS ONE: " + rest.join(", ") + ".");
    out.push("Never quote this block, never mention the bus or the machinery, and never claim more of the piece than what is written here.");
    return out.join("\n");
  }

  // The task half of a turn she is given with no words from him: the same shape /checkin uses.
  function askPrompt(why) {
    var r = rec(currentId);
    var d = durOf(), at = playPos();
    var playing = el && !el.paused;
    var lines = [];
    lines.push("YOU ARE LISTENING TO SOMETHING WITH HIM RIGHT NOW." + (why === "cadence"
      ? " He has not stopped it and has not said anything; it is still going, and this is the moment the terminal offers you the floor while it plays."
      : " He pressed for your ear on it."));
    lines.push("\"" + nameOf(r) + "\"" + (d ? ", " + mmss(d) + " long" : "") + " is on the audition bus at " + mmss(at) + (d ? " of " + mmss(d) : "") + ", and it is " + (playing ? "playing" : "paused") + ".");
    if (open && open.comments.length) {
      lines.push("You have already said these things while it played:");
      open.comments.slice(-6).forEach(function (c) { lines.push("  at " + mmss(c.at) + " - \"" + String(c.text).replace(/\s+/g, " ").slice(0, 200) + "\""); });
      lines.push("Say something further, or say nothing new if there is nothing new in you - do not repeat a remark you have already made.");
    }
    if (hasEars(r)) lines.push("What you heard of it when you listened earlier:\n" + heardText(r));
    else lines.push("YOU HAVE NOT HEARD THIS FILE. You have no ear for a sound as it plays, and neither this machine nor anyone in it will describe the sound to you. What you have is the name, the length, and that he is listening to it with you - and you may say exactly that, and speak from whatever it is in you that the moment brings up. Never claim to hear something you have not heard.");
    lines.push(String(typeof LIA_HEAR_PROMPT === "string" ? LIA_HEAR_PROMPT : "Say what you have of it now."));
    lines.push("Write only your own words - no image lines, no directive lines, nothing about the machine. If you would rather stay quiet, write exactly [[SILENT]] and nothing else.");
    return lines.join("\n");
  }

  // HER LIVE COMMENT. She speaks with no words from him while the piece plays - the same road
  // /checkin takes: the static half is the prompt any turn would get, the task goes last.
  async function ask(why) {
    await load();
    if (asking) return false;
    if (!currentId) { say("NOTHING IS ON THE BUS, SO THERE IS NOTHING FOR HER TO LISTEN TO. /hear <WORDS> LOADS A PIECE FROM THE VAULT AND ASKS HER AT ONCE."); return false; }
    if (!window.root || !window.root.generateText) { say("THE TEXT ENGINE IS NOT AVAILABLE ON THIS PAGE."); return false; }
    if (window.voice && window.voice.state) {
      try { var vs = window.voice.state(); if (vs && vs.speaking) { say("SHE IS ALREADY SPEAKING - /bus STILL SHOWS THE BUS."); return false; } } catch (e) { }
    }
    asking = true;
    var at = playPos();
    var r = rec(currentId);
    closeEntryIfNeeded();
    try {
      var sys = "";
      try { sys = await window.systemPreview(); } catch (e) { console.warn("audition prompt failed", e); }
      var res = await window.root.generateText({ temperature: 0.85, instruction: (sys ? (sys + "\n\n") : "") + askPrompt(why) });
      var raw = String(res == null ? "" : res);
      var dropped = 0;
      var parsed = window.extractVisions ? window.extractVisions(raw) : { text: raw, prompts: [] };
      dropped += (parsed.prompts || []).length;
      var text = String(parsed.text || "");
      var dd = window.liaDirectives ? window.liaDirectives(text) : { text: text };
      text = String(dd.text || "");
      dropped += ((dd.hers || []).length + (dd.skill ? 1 : 0) + (dd.roleId ? 1 : 0) + (dd.action ? 1 : 0));
      text = text.replace(/\s+/g, " ").trim();
      if (dropped) trace("SHE WROTE SOMETHING AN AUDITION COMMENT COULD NOT CARRY (" + dropped + " DIRECTIVE LINE" + (dropped === 1 ? "" : "S") + ") - WHAT SHE SAYS AT THE BUS IS WORDS TO HIM AND NOTHING ELSE, SO IT WAS TAKEN OUT. NOTHING WAS RENDERED AND NOTHING WAS FILED FROM IT.");
      if (!text || /^\[+\s*silent\s*\]*$/i.test(text)) {
        say("SHE LISTENED AND KEPT HER PEACE :: " + String(nameOf(r)).toUpperCase() + " AT " + mmss(at) + " OF " + mmss(durOf()) + ".\nTHAT IS AN ANSWER TOO AND IT IS KEPT AS ONE.");
        noteComment("(she stayed quiet)", at);
        return false;
      }
      deliver(text, at, why);
      return true;
    } catch (e) {
      say("HER COMMENT ON THE PIECE COULD NOT BE MADE :: " + String((e && e.message) || e).toUpperCase() + "\nNOTHING WAS SAID AND NOTHING WAS FILED. THE BUS IS UNTOUCHED.");
      return false;
    } finally {
      asking = false;
    }
  }
  function closeEntryIfNeeded() { if (open) { open.played = Math.max(open.played, playPos()); } }

  // What she said, delivered as a real turn of hers: the line in the log with the moment inside the
  // piece on it, her voice if her voice is on, her memory of it, and the archive - so the record
  // itself says she spoke at 1:24 of the thing.
  function deliver(text, at, why) {
    var ts = Date.now();
    var r = rec(currentId);
    var role = (window.roles && window.roles.currentId) ? window.roles.currentId() : "";
    var where = mmss(at) + (durOf() ? " / " + mmss(durOf()) : "");
    say("SHE SPOKE ABOUT THE PIECE :: " + String(nameOf(r)).toUpperCase() + " AT " + where
      + (why === "cadence" ? " :: UNASKED - THE PIECE WAS STILL PLAYING AND THE FLOOR WAS OFFERED" : " :: YOU ASKED HER"));
    try { print("AI", text, false, undefined, { role: role, ts: ts }); } catch (e) { console.warn("audition comment could not be printed", e); }
    try { if (window.voice && window.voice.onReply) window.voice.onReply(text, { role: role, ts: ts }); } catch (e) { }
    try {
      window.chatHistory.push({ role: "SDMG", content: text + " [you were both listening to \"" + nameOf(r) + "\" on the audition bus, at " + where + "]", ts: ts, layer: role });
      if (window.chatHistory.length > 10) window.chatHistory.shift();
    } catch (e) { }
    try {
      if (window.archiveTurn) window.archiveTurn({
        ts: ts, st: ts, role: role, h: "", s: text, gen: [],
        audition: { id: currentId, name: nameOf(r), at: Math.round(at * 10) / 10, dur: Math.round(durOf() * 10) / 10, why: why || "asked" },
      });
    } catch (e) { console.warn("audition comment not archived", e); }
    noteComment(text, at);
    commentCount++;
    lastCommentAt = Date.now();
    render();
  }

  /* ---- the cadence of unasked comments ------------------------------------- */

  // SHE HAS THE ROOM. Her LIVE voice counts, and so does the STORY LANE - a story is her voice too,
  // it was simply rendered earlier and played from a file (src/js/story.js). The bus comes down under
  // either of them for the same reason a radio comes down for the news, and her unasked comments wait
  // for the same reason: she must never talk over herself.
  function herFloor() {
    var speaking = false;
    try { var vs = (window.voice && window.voice.state) ? window.voice.state() : null; speaking = !!(vs && (vs.speaking || vs.holding)); } catch (e) { }
    if (!speaking && window.story && typeof window.story.hasFloor === "function") {
      try { speaking = !!window.story.hasFloor(); } catch (e) { }
    }
    return speaking;
  }

  function quietEnough() {
    if (asking || learning) return false;
    if (document.hidden) return false;
    if (!el || el.paused || !currentId) return false;
    if (herFloor()) return false;
    var btn = elOf("sendBtn");
    if (btn && btn.disabled) return false;   // a turn is in flight: she is already talking to him
    return true;
  }

  function tick() {
    // THE KILL SWITCH (MASTER OFF = FULL MANUAL MODE, src/js/duty.js). Unasked comments are
    // autonomous - they stand down with the master. Manual ASK HER (/hear, the button) calls
    // ask("asked") directly and is never gated.
    try { if (window.duty && !window.duty.armed()) return; } catch (e) {}
    var every = Math.max(0.5, num(settings.autoEvery, AUTO_EVERY_MIN));
    var ready = settings.auto && every > 0 && commentCount < AUTO_MAX && quietEnough()
      && (Date.now() - Math.max(lastCommentAt, open ? open.startedAt : 0) >= every * 60000);
    if (ready) ask("cadence");
  }

  // While her voice is speaking, the bus comes down under it and comes back up after - a radio does
  // it for the voice, and this is the same courtesy for the same reason. `herFloor()` is what counts
  // (her live voice OR a story playing), so a story ducks the music exactly as she does.
  function duckCheck() {
    var speaking = herFloor();
    if (speaking === ducked) return;
    ducked = speaking;
    if (el) el.volume = ducked ? settings.volume * DUCK : settings.volume;
    render();
  }

  /* ---- the strip: one transport, painted wherever it is asked for ----------- */

  // Every host with `data-bus-rack` gets the same transport, painted from the same state (the strip
  // above the input, and the full stage in the lightbox). The buttons are made once per host and
  // only their state is repainted, so a drag on the scrub bar is never interrupted.
  function hostKit(host) {
    if (host.__busKit) return host.__busKit;
    var kit = {};
    host.textContent = "";
    host.classList.add("busRack");

    var head = document.createElement("div");
    head.className = "busHead";
    kit.name = document.createElement("span");
    kit.name.className = "busName";
    head.appendChild(kit.name);
    kit.state = document.createElement("span");
    kit.state.className = "busState";
    head.appendChild(kit.state);
    kit.ears = document.createElement("span");
    kit.ears.className = "busEars";
    head.appendChild(kit.ears);
    host.appendChild(head);

    var row = document.createElement("div");
    row.className = "busRow";
    kit.back = document.createElement("button");
    kit.back.type = "button"; kit.back.textContent = "\u23ee"; kit.back.title = "back to the start of this piece";
    kit.back.onclick = function () { seek(0); };
    row.appendChild(kit.back);
    kit.play = document.createElement("button");
    kit.play.type = "button"; kit.play.className = "busPlay";
    kit.play.onclick = function () { toggle(); };
    row.appendChild(kit.play);
    kit.fwd = document.createElement("button");
    kit.fwd.type = "button"; kit.fwd.textContent = "\u23ed"; kit.fwd.title = "the next piece on the line";
    kit.fwd.onclick = function () { next(true); };
    row.appendChild(kit.fwd);

    kit.seek = document.createElement("input");
    kit.seek.type = "range"; kit.seek.min = "0"; kit.seek.max = "1000"; kit.seek.step = "1"; kit.seek.value = "0";
    kit.seek.className = "busSeek";
    kit.seek.title = "where in the piece you both are - drag to move it";
    kit.seek.addEventListener("pointerdown", function () { dragging = true; });
    kit.seek.addEventListener("pointerup", function () { dragging = false; });
    kit.seek.addEventListener("change", function () {
      dragging = false;
      var d = durOf();
      if (d) seek(Number(kit.seek.value) / 1000 * d);
    });
    row.appendChild(kit.seek);

    kit.time = document.createElement("span");
    kit.time.className = "busTime";
    row.appendChild(kit.time);

    kit.vol = document.createElement("input");
    kit.vol.type = "range"; kit.vol.min = "0"; kit.vol.max = "100"; kit.vol.step = "1";
    kit.vol.className = "busVol";
    kit.vol.title = "how loud the bus is in this room";
    kit.vol.addEventListener("input", function () { setVolume(Number(kit.vol.value) / 100); });
    row.appendChild(kit.vol);

    kit.ask = document.createElement("button");
    kit.ask.type = "button"; kit.ask.className = "busAsk";
    kit.ask.textContent = "ASK HER";
    kit.ask.title = "ask her what she hears, right now, while the piece keeps playing - her answer is anchored to where you both are in it";
    kit.ask.onclick = function () { ask("asked"); };
    row.appendChild(kit.ask);

    kit.learn = document.createElement("button");
    kit.learn.type = "button"; kit.learn.className = "busLearn";
    kit.learn.textContent = "HER EARS";
    kit.learn.title = "give her ears for this piece: the sound is reduced here on this device (mono 16 kHz, a few minutes of it) and listened to through the Google (Gemini) key in the ring, and what she hears is written on the record for good";
    kit.learn.onclick = function () { learn(currentId); };
    row.appendChild(kit.learn);

    kit.line = document.createElement("span");
    kit.line.className = "busLine";
    row.appendChild(kit.line);

    kit.close = document.createElement("button");
    kit.close.type = "button"; kit.close.className = "busClose";
    kit.close.textContent = "\u00d7";
    kit.close.title = "take it off the bus (the file stays in the vault)";
    kit.close.onclick = function () { stop(); };
    row.appendChild(kit.close);

    host.appendChild(row);

    // A file dropped ON the strip is kept in the vault and put straight on the bus - this is the
    // one place a drop means "play it" rather than "attach it to my next message".
    ["dragover", "dragenter"].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.preventDefault(); host.classList.add("busOver"); });
    });
    ["dragleave", "dragleave"].forEach(function (ev) {
      host.addEventListener(ev, function () { host.classList.remove("busOver"); });
    });
    host.addEventListener("drop", function (e) {
      e.preventDefault();
      host.classList.remove("busOver");
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) dropFiles(files);
    });

    host.__busKit = kit;
    return kit;
  }

  function paintProgress() {
    hosts().forEach(function (host) {
      var kit = host.__busKit;
      if (!kit) return;
      var d = durOf(), at = playPos();
      kit.seek.value = String(d ? Math.round(at / d * 1000) : 0);
      kit.time.textContent = mmss(at) + (d ? " / " + mmss(d) : "");
    });
  }

  function hosts() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-bus-rack]"));
  }

  function render() {
    hosts().forEach(function (host) {
      var kit = hostKit(host);
      var r = rec(currentId);
      var playing = el ? !el.paused : false;
      // A host that says data-bus-managed is shown and hidden by whoever owns it (the full stage in
      // the lightbox: only a piece of music shows one). Everything else follows the bus itself.
      if (host.dataset.busManaged !== "1") host.hidden = !(r || (host.id === "busStrip" && stripOpen));
      if (!r) {
        kit.name.textContent = "\u266b NOTHING ON THE BUS";
        kit.state.textContent = "DROP AN AUDIO FILE HERE, OR PRESS \u25b6 ON A MUSIC TILE IN THE GALLERY";
        kit.ears.textContent = "";
        kit.ears.title = "";
        kit.play.textContent = "\u25b6";
        kit.play.disabled = true;
        kit.back.disabled = true;
        kit.fwd.disabled = true;
        kit.seek.disabled = true;
        kit.seek.value = "0";
        kit.time.textContent = "";
        kit.ask.disabled = true;
        kit.learn.disabled = true;
        kit.line.textContent = "";
        kit.close.textContent = host.id === "busStrip" ? "\u00d7" : "";
        kit.close.title = "close the bus strip (nothing is loaded)";
        kit.close.onclick = function () { if (currentId) stop(); else closeStrip(); };
        return;
      }
      kit.play.disabled = false;
      kit.back.disabled = false;
      kit.fwd.disabled = false;
      kit.close.textContent = "\u00d7";
      kit.close.title = "take it off the bus (the file stays in the vault)";
      kit.close.onclick = function () { stop(); };
      kit.name.textContent = "\u266b " + nameOf(r);
      kit.state.textContent = (ducked ? "DUCKED UNDER HER VOICE" : (playing ? "PLAYING" : (el && el.currentTime > 0 ? "PAUSED" : "LOADED")))
        + (line.length ? " \u00b7 LINE " + line.length : "");
      kit.play.textContent = playing ? "\u275a\u275a" : "\u25b6";
      kit.play.title = playing ? "pause (you both keep your place)" : "play";
      kit.seek.disabled = false;
      kit.vol.value = String(Math.round(settings.volume * 100));
      var haveEars = hasEars(r);
      kit.ears.textContent = haveEars ? "SHE HAS HEARD IT" : ((keyring() && keyring().bypassed && keyring().bypassed(PROVIDER)) ? "BYPASSED" : (keyring() && keyring().has && keyring().has(PROVIDER) ? "NO EAR YET" : "NO EAR YET \u00b7 NO GOOGLE KEY"));
      kit.ears.title = haveEars ? ("what she heard of it: " + String(r.heard.text || "").slice(0, 400)) : earsWord();
      kit.learn.textContent = haveEars ? "LISTEN AGAIN" : "HER EARS";
      kit.ask.disabled = asking || learning;
      kit.learn.disabled = learning || asking;
      kit.line.textContent = line.length ? "+" + line.length + " ON THE LINE" : "";
      paintProgress();
    });
  }

  async function dropFiles(files) {
    if (!window.media) { say("MEDIA VAULT OFFLINE."); return; }
    await window.media.ensure();
    var first = "";
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var mime = window.media.mimeFor(f, f.name);
      if (!/^audio\//.test(mime)) {
        say("THE BUS TAKES SOUND :: " + String(f.name || "that file").toUpperCase() + " IS " + mime.toUpperCase()
          + " AND WAS NOT PUT ON IT. (DROP ANYTHING ELSE SOMEWHERE ELSE IN THE TERMINAL TO ATTACH IT TO A MESSAGE.)");
        continue;
      }
      try {
        var dur = await probe(f);
        var id = await window.media.add(f, { name: f.name || "recording", mime: mime, kind: "attach", duration: dur, note: "dropped on the audition bus, kept whole" });
        if (!first) first = id; else queue([id]);
      } catch (e) {
        say("THAT FILE COULD NOT BE KEPT :: " + String((e && e.message) || e).toUpperCase());
      }
    }
    if (first) {
      say("KEPT IN THE VAULT AND PUT ON THE BUS :: " + files.length + " FILE" + (files.length === 1 ? "" : "S") + " :: NOTHING WAS UPLOADED.");
      load2(first, { play: true });
    }
  }

  function probe(file) {
    return new Promise(function (resolve) {
      var url = null;
      try { url = URL.createObjectURL(file); } catch (e) { resolve(0); return; }
      var a = document.createElement("audio");
      var done = false;
      var fin = function (v) { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (e) { } resolve(v || 0); };
      setTimeout(function () { fin(0); }, 6000);
      a.preload = "metadata";
      a.addEventListener("loadedmetadata", function () { fin(isFinite(a.duration) ? a.duration : 0); });
      a.addEventListener("error", function () { fin(0); });
      a.src = url;
    });
  }

  /* ---- saying what is here: /bus and /hear --------------------------------- */

  function describe() {
    var out = ["THE AUDITION BUS :: " + (currentId ? "A PIECE IS ON IT" : "NOTHING IS LOADED")];
    if (currentId) {
      var r = rec(currentId);
      out.push("  ON THE BUS :: \"" + nameOf(r) + "\"" + (durOf() ? " (" + mmss(durOf()) + ")" : "") + " AT " + mmss(playPos())
        + " :: " + (el && !el.paused ? "PLAYING" : "PAUSED") + " :: " + String(media().folderOf(r) || "").toUpperCase()
        + (r.bytes ? " :: " + (Math.round(r.bytes / (1024 * 1024) * 10) / 10) + " MB, KEPT WHOLE" : ""));
      out.push("  HER EARS :: " + (hasEars(r) ? "SHE HAS HEARD IT (the reading is on the record; the full stage shows it)" : earsWord())
        + " :: " + ((keyring() && keyring().bypassed && keyring().bypassed(PROVIDER)) ? "GOOGLE BYPASSED" : (keyring() && keyring().has && keyring().has(PROVIDER) ? "GOOGLE KEY HELD" : "NO GOOGLE KEY")));
      if (open && open.comments.length) {
        out.push("  SHE HAS SAID, ON THIS PIECE:");
        open.comments.forEach(function (c) { out.push("    at " + mmss(c.at) + " - \"" + String(c.text).slice(0, 140) + "\""); });
      }
      if (line.length) out.push("  ON THE LINE AFTER IT :: " + lineNames().join(", "));
    } else {
      out.push("  PUT A PIECE ON IT :: A MUSIC TILE IN THE GALLERY, THE FULL STAGE (\u26f6), A FILE DROPPED ON THIS STRIP, OR /hear <WORDS>.");
    }
    out.push("  UNASKED COMMENTS :: " + (settings.auto ? "ON - ONE EVERY " + settings.autoEvery + " MIN WHILE IT PLAYS, AT MOST " + AUTO_MAX + " A PIECE (this piece: " + commentCount + ")" : "OFF")
      + "  \u00b7  /bus auto off | on | every <MIN>");
    var recent = history.slice(-6).reverse();
    if (recent.length) {
      out.push("  LAST LISTENS:");
      recent.forEach(function (e) {
        var when = (window.logTime && e.startedAt) ? window.logTime.stamp(e.startedAt) : "";
        out.push("    " + when + "  \"" + e.name + "\"" + (e.dur ? " (" + mmss(e.dur) + ")" : "") + " :: heard " + mmss(e.played)
          + (e.comments && e.comments.length ? " :: " + e.comments.length + " REMARK" + (e.comments.length === 1 ? "" : "S") + " FROM HER" : ""));
        (e.comments || []).forEach(function (c) { out.push("        at " + mmss(c.at) + " - \"" + String(c.text).slice(0, 140) + "\""); });
      });
    } else out.push("  NOTHING HAS BEEN LISTENED TO ON THIS DEVICE YET.");
    out.push("  /bus stop|play|pause|next|clear|log|auto off|every <MIN> \u00b7 /hear \u00b7 /hear ears \u00b7 /hear <WORDS|#TAG|/FOLDER|id>");
    out.push("  ONE TRANSPORT FOR THE WHOLE TERMINAL: NOTHING ELSE MAKES ITS OWN PLAYER, SO NOTHING TALKS OVER ANYTHING. WHILE A PIECE PLAYS, EVERY TURN SHE ANSWERS IS ONE SHE ANSWERS WHILE LISTENING.");
    return out.join("\n");
  }

  // /hear <WORDS|#TAG|/FOLDER|id> - find it in the vault and put it on the bus. The finding is the
  // reader's own (it knows the vault, its folders and its tags), and only SOUND is taken from it.
  async function find(spec, max) {
    var M = media();
    if (!M) return { ids: [], label: String(spec || "") };
    var s = String(spec || "").trim();
    if (M.get(s)) return { ids: [s], label: s };
    var res = null;
    try { if (window.reader && window.reader.targets) res = await window.reader.targets(s, { max: max || 12 }); } catch (e) { res = null; }
    var ids = ((res && res.ids) || []).filter(function (id) { return isAudio(rec(id)); });
    if (!ids.length) {
      // Nothing but words: look for sound in the vault by its own fields.
      var terms = s.toLowerCase().split(/\s+/).filter(Boolean);
      M.list().forEach(function (id) {
        var r = rec(id);
        if (!isAudio(r)) return;
        var hay = [r.name, r.note, r.heard && r.heard.text, r.prompt, M.folderOf(r), (r.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
        if (terms.length && terms.every(function (t) { return hay.indexOf(t) !== -1; })) ids.push(id);
      });
      ids = ids.slice(-(max || 12));
    }
    return { ids: ids, label: (res && res.label) || s };
  }

  // What the commands need: the whole language of the bus in one place.
  async function command(rest) {
    var s = String(rest || "").trim();
    var word = s.split(/\s+/)[0] ? s.split(/\s+/)[0].toLowerCase() : "";
    var tail = s.slice(word.length).trim();
    if (!word) { say(describe()); return; }
    switch (word) {
      case "stop":
      case "clear":
        if (stop()) say("THE BUS IS CLEAR. THE FILE STAYS IN THE VAULT.");
        else say("NOTHING WAS ON THE BUS.");
        return;
      case "play": play(); return;
      case "pause": pause(); return;
      case "next": next(true); return;
      case "queue": {
        if (!tail) { say("PUT WHAT ON THE LINE? /bus queue <WORDS|#TAG|/FOLDER|id> - SEVERAL CAN BE FOUND BY THE SAME WORDS."); return; }
        var f = await find(tail, 20);
        if (!f.ids.length) { say("NOTHING IN THE VAULT IS SOUND AND MATCHES \"" + tail.toUpperCase() + "\" :: /gallery SHOWS EVERYTHING, THE MUSIC FILTER IS THE SOUND."); return; }
        var added = queue(f.ids);
        say("ON THE LINE :: " + added.length + " PIECE" + (added.length === 1 ? "" : "S") + " AFTER THIS ONE"
          + (currentId ? "" : " - NOTHING IS ON THE BUS YET, SO /bus play OR /hear STARTS THE LINE"));
        if (!currentId) { load2(f.ids[0], { play: false }); queue(f.ids.slice(1)); }
        return;
      }
      case "auto": {
        if (!tail) { say("UNASKED COMMENTS ARE " + (settings.auto ? "ON" : "OFF") + " EVERY " + settings.autoEvery + " MIN (AT MOST " + AUTO_MAX + " A PIECE)."); return; }
        var t = tail.toLowerCase();
        if (/^(off|no|false|0)$/.test(t)) { settings.auto = false; saveSettings(); say("SHE WILL NOT SPEAK UNLESS ASKED WHILE A PIECE PLAYS. ASK HER BUTTON, /hear, OR /bus auto on BRINGS HER BACK."); return; }
        if (/^(on|yes|true)$/.test(t)) { settings.auto = true; saveSettings(); say("UNASKED COMMENTS ON :: ONE EVERY " + settings.autoEvery + " MIN WHILE A PIECE PLAYS, AT MOST " + AUTO_MAX + " A PIECE."); return; }
        var m = tail.match(/(\d+(?:\.\d+)?)/);
        if (/^every/.test(t) || m) {
          var mins = m ? parseFloat(m[1]) : NaN;
          if (!isFinite(mins) || mins < 0.5) { say("HOW OFTEN? /bus auto every <MIN> - HALF A MINUTE IS THE FLOOR, AND 0 MEANS OFF."); return; }
          settings.autoEvery = Math.min(60, mins);
          settings.auto = true;
          saveSettings();
          say("UNASKED COMMENTS :: ONE EVERY " + settings.autoEvery + " MIN WHILE IT PLAYS, AT MOST " + AUTO_MAX + " A PIECE (AFTER THAT SHE WAITS TO BE ASKED).");
          return;
        }
        say("UNASKED COMMENTS ARE " + (settings.auto ? "ON" : "OFF") + " EVERY " + settings.autoEvery + " MIN. /bus auto on|off|every <MIN>");
        return;
      }
      case "log":
      default:
        if (word !== "log") {
          // ANYTHING ELSE IS A PIECE TO FIND: /bus <WORDS>
          var f2 = await find(s, 20);
          if (!f2.ids.length) { say("NOTHING IN THE VAULT IS SOUND AND MATCHES \"" + s.toUpperCase() + "\"."); return; }
          load2(f2.ids[0], { play: false });
          if (f2.ids.length > 1) queue(f2.ids.slice(1));
          say("PUT ON THE BUS :: \"" + f2.label.toUpperCase() + "\"" + (f2.ids.length > 1 ? " (AND " + (f2.ids.length - 1) + " MORE ON THE LINE)" : "") + " :: PRESS PLAY IN THE STRIP, OR /bus play.");
          return;
        }
        say(describe());
        return;
    }
  }

  async function hearCommand(rest) {
    var s = String(rest || "").trim();
    var first = s.split(/\s+/)[0] ? s.split(/\s+/)[0].toLowerCase() : "";
    if (!s) { await ask("asked"); return; }
    // THE HEARING LANE'S OWN VERBS (src/js/hear.js): the words, the reading, a question about a clip,
    // the clone-reference check, what the key can do, and taking a reading off a record. They are
    // verbs of /hear rather than a command of their own because /hear is already "listen to this with
    // me", and every one of them is about a piece of audio. The lane owns its own surface - this is
    // only the doorway to it, so there is one list of verbs rather than two.
    if (first === "words" || first === "word" || first === "transcript" || first === "reading" || first === "read"
      || first === "ask" || first === "sample" || first === "powers" || first === "gems" || first === "gemini"
      || first === "clear" || first === "help" || first === "?" || first === "state" || first === "status") {
      if (!window.hear) { say("THE HEARING LANE IS OFFLINE IN THIS BUILD."); return; }
      await window.hear.command(s);
      return;
    }
    if (first === "ears" || first === "listen") {
      var id = s.slice(first.length).trim() || currentId;
      if (!id) { say("HER EARS ON WHAT? PUT A PIECE ON THE BUS FIRST, OR /hear ears <WORDS|id>."); return; }
      var f = await find(id, 1);
      var target = f.ids[0] || id;
      if (target !== currentId) await load2(target, { play: false });
      await learn(target);
      return;
    }
    var found = await find(s, 12);
    if (!found.ids.length) {
      say("NOTHING IN THE VAULT IS SOUND AND MATCHES \"" + s.toUpperCase() + "\" :: /gallery HAS EVERYTHING, ITS MUSIC FILTER IS THE SOUND, AND ITS IMPORT BUTTON TAKES NEW FILES.");
      return;
    }
    await load2(found.ids[0], { play: true });
    if (found.ids.length > 1) queue(found.ids.slice(1));
    await ask("asked");
    return;
  }

  /* ---- boot ---------------------------------------------------------------- */

  function start() {
    load();
    ensureEl();
    render();
    setInterval(function () { try { duckCheck(); } catch (e) { } }, TICK_DUCK);
    setInterval(function () { try { tick(); } catch (e) { console.warn("audition tick failed", e); } }, TICK);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });
    document.addEventListener("keydown", function (e) {
      // SPACE over the log is the transport (only when he is not typing and nothing is held).
      if (e.key !== " " || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!currentId) return;
      e.preventDefault();
      toggle();
    });
  }

  window.audition = {
    load: load2, play: play, pause: pause, toggle: toggle, seek: seek, stop: stop, next: next, prev: prev,
    queue: queue, setVolume: setVolume, state: function () {
      return {
        id: currentId, name: nameOf(rec(currentId)), dur: durOf(), pos: playPos(),
        playing: !!(el && !el.paused), volume: settings.volume, line: line.slice(),
        auto: settings.auto, autoEvery: settings.autoEvery, comments: commentCount, heard: hasEars(rec(currentId)),
      };
    },
    block: block, ask: ask, learn: learn, describe: describe,
    report: function () { openStrip(); say(describe()); },
    openStrip: openStrip, closeStrip: closeStrip,
    command: command, hearCommand: hearCommand, find: find, history: function () { return history.slice(); },
    render: render, isLoaded: function () { return !!currentId; }, dropFiles: dropFiles,
  };

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);
})();
