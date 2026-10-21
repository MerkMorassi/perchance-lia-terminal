/* ------------------------------------------------------------------
   THE WORDS ON A SOUND - her Gemini powers (src/js/hear.js)

   Patrikios, 2026-09-27: "let's give her some GEMINI superpowers: transcription and
   knowledge of what the 'VOX' sample actually said from an audio sample. I might send
   her a clip in the chat and ask. She might also have 'sentiment analysis' (GEMINI),
   etc. ... GEMINI may reject some text for SAFETY or POLICY guidelines."

   THREE QUESTIONS ABOUT ONE PIECE OF AUDIO, and they are three questions:
     WHAT IS IN IT    her ears (src/js/audition.js) - a description of the sound.
     WHAT IT SAYS     this module: a VERBATIM transcript, word for word.
     WHAT IT MEANS    this module: mood, emotion, sentiment, tone, what is being done.
   A voice with no words is a piece of sound she can only describe; a voice WITH its
   words is a thing that can be quoted, searched and answered. The sample the Story
   lane clones from is the reason this exists at all: the vault can now hold what the
   voice in BARBELO-SYSTEM-VOICE-2.wav ACTUALLY SAID, and she is handed it on every
   turn that piece is on the audition bus.

   ONE DOOR. Everything that wants words out of an audio file comes through
   window.hear: the vault (a record's full stage - the WORDS and READING rows), the
   chat (a clip handed over on the strip - src/js/attach.js asks here FIRST), the
   commands (/hear words | reading | ask | sample | clear | powers), and, through the
   record, her own instruction. There is no second call site to keep in step.

   THE KEY IS THE GOOGLE (GEMINI) ONE - the same ring every other lane uses, and the
   same key HER EYES and HER EARS already run on. The sound is REDUCED HERE FIRST:
   mono, LIA_HEAR_RATE, at most LIA_HEAR_SECONDS of it, exactly the reduction her ears
   get, so a 13 MB master leaves as a couple of megabytes of speech and NOTHING ELSE
   about the file goes anywhere. The file itself is never uploaded, never changed and
   never moved.

   WHICH MODEL. MEASURED on his key, 2026-09-27: gemini-3.5-transcribe answers - and
   came back EMPTY (finishReason STOP, no text) on a 74.7 s clip, so it is offered the
   sound FIRST (it is the dedicated transcriber, and it costs two seconds) and stepped
   over when it has nothing to say; a gemini-3.x-flash model is the road that actually
   returns words here (42 s for the same clip). The list is asked of the key itself
   (/models), so a model retired or added tomorrow is handled without a code change,
   and the memory of WHICH MODEL ANSWERED is only written once a pass has actually
   come back with something.

   A REFUSAL IS AN ANSWER, NOT AN OBSTACLE. Gemini stops for SAFETY,
   PROHIBITED_CONTENT, RECITATION and the rest, and this lane keeps the house rule: a
   refusal is reported IN ITS OWN WORDS, the clip is left exactly as it arrived,
   NOTHING IS WRITTEN ON THE RECORD, and the pass STOPS THERE. Nothing is rewritten,
   shortened or softened to get past a filter, and no second model or second provider
   is quietly asked to try the same words again - a service's filter is not a way
   around a sentence, it is a sentence this terminal will not help him launder. (It is
   also not a verdict on the content: filters are wrong often, and the terminal says
   the service refused - not that the clip is anything. /hear sample and /hear reading
   on a refused piece simply report it and leave the record clean.)

   Commands: /hear words|reading|ask|sample|clear|powers [<SOURCE>]
             - <SOURCE> is a vault id, a name, a #tag or a /folder (the same finder
               the bus uses); bare, it is the piece ON THE BUS.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var FOLDER = "lia_settings";
  var SET_KEY = "hear";
  var PROVIDER = "google";
  var API = "https://generativelanguage.googleapis.com/v1beta";

  function num(v, dft) { var n = Number(v); return isFinite(n) ? n : dft; }
  function r1(v) { return Math.round(num(v, 0) * 10) / 10; }
  function s1(v) { return String(v == null ? "" : v).trim(); }

  function mmss(sec) {
    sec = Math.max(0, Math.round(num(sec, 0)));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") + m : String(m)) + ":" + (s < 10 ? "0" : "") + s;
  }

  var RATE = num(typeof LIA_HEAR_RATE !== "undefined" ? LIA_HEAR_RATE : 16000, 16000);
  var SECONDS = num(typeof LIA_HEAR_SECONDS !== "undefined" ? LIA_HEAR_SECONDS : 180, 180);
  var DECODE_MAX = num(typeof LIA_HEAR_DECODE_MAX !== "undefined" ? LIA_HEAR_DECODE_MAX : 160 * 1024 * 1024, 160 * 1024 * 1024);
  var TRIES = Math.max(1, Math.round(num(typeof LIA_HEAR_TRIES !== "undefined" ? LIA_HEAR_TRIES : 4, 4)));
  var COOLDOWN = num(typeof LIA_HEAR_COOLDOWN !== "undefined" ? LIA_HEAR_COOLDOWN : 10 * 60000, 10 * 60000);
  var SAMPLE_SECONDS = num(typeof LIA_HEAR_SAMPLE_SECONDS !== "undefined" ? LIA_HEAR_SAMPLE_SECONDS : 30, 30);

  var WORDS_PROMPT = (typeof LIA_HEAR_PROMPT_WORDS === "string" && LIA_HEAR_PROMPT_WORDS)
    ? LIA_HEAR_PROMPT_WORDS : "Transcribe the speech in this audio, word for word. No commentary. If there is no speech, answer with exactly: NO SPEECH";
  var READ_PROMPT = (typeof LIA_HEAR_PROMPT_READ === "string" && LIA_HEAR_PROMPT_READ)
    ? LIA_HEAR_PROMPT_READ : "Answer with one JSON object describing this audio: {\"speech\":true,\"transcript\":\"\",\"emotion\":\"\",\"sentiment\":\"neutral\",\"summary\":\"\"}";
  var ASK_PROMPT = (typeof LIA_HEAR_PROMPT_ASK === "string" && LIA_HEAR_PROMPT_ASK)
    ? LIA_HEAR_PROMPT_ASK : "Answer the question about this audio from what is actually in it.";
  var SAMPLE_PROMPT = (typeof LIA_HEAR_PROMPT_SAMPLE === "string" && LIA_HEAR_PROMPT_SAMPLE)
    ? LIA_HEAR_PROMPT_SAMPLE : "Judge this recording as a clone reference for a text-to-speech model and answer with one JSON object: {\"usable\":true,\"voices\":1,\"clean\":true,\"seconds\":0,\"problems\":[],\"advice\":\"\",\"voicePrompt\":\"\"}";

  /* ---- state --------------------------------------------------------------- */

  var settings = { wordsModel: "", readModel: "", tried: {} };
  var loaded = false, loading = null;
  var busy = false, busyWhat = "";
  var listCache = null, listAt = 0, listPromise = null;
  var LIST_TTL = 30 * 60 * 1000;

  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function media() { return window.media || null; }
  function keyring() { return window.keyring || null; }
  function say(msg) { if (typeof print === "function") print("SYSTEM", msg); }
  function recOf(id) { var M = media(); return (M && M.get) ? M.get(id) : null; }
  function busId() {
    try {
      var st = (window.audition && window.audition.state) ? window.audition.state() : null;
      return (st && st.id) || "";
    } catch (e) { return ""; }
  }

  function pbar(label) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "hear",
        detail: "THE WORDS ON A SOUND - the audio is reduced here, on this device, and only those seconds are sent",
      });
    } catch (e) { }
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("hear"); } catch (e) { }
  }

  async function load() {
    if (loading) return loading;
    loading = (async function () {
      var k = kv();
      if (k) {
        try {
          var s = await k.get(SET_KEY);
          if (s && typeof s === "object") {
            if (typeof s.wordsModel === "string") settings.wordsModel = s.wordsModel;
            if (typeof s.readModel === "string") settings.readModel = s.readModel;
            if (s.tried && typeof s.tried === "object") settings.tried = s.tried;
          }
        } catch (e) { console.warn("hear settings unreadable", e); }
      }
      loaded = true;
    })();
    return loading;
  }

  async function saveSettings() {
    var k = kv();
    if (!k) return;
    try { await k.set(SET_KEY, { wordsModel: settings.wordsModel, readModel: settings.readModel, tried: settings.tried }); }
    catch (e) { console.warn("hear settings not saved", e); }
  }

  /* ---- the key ------------------------------------------------------------- */

  function held() {
    var kr = keyring();
    if (!kr || !kr.has) return false;
    try { return !!kr.has(PROVIDER); } catch (e) { return false; }
  }

  function bypassedHere() {
    try { var kr = keyring(); return !!(kr && kr.bypassed && kr.bypassed(PROVIDER)); } catch (e) { return false; }
  }

  // The ring reads its keys off this device asynchronously at boot, so a press in the first moment of
  // a fresh page must not be answered with "she has no ear for this". Ask it to be ready first.
  async function ensureKey() {
    var kr = keyring();
    if (kr && kr.ready && !kr.ready() && kr.load) { try { await kr.load(); } catch (e) { } }
    return held();
  }

  var NO_KEY = "SHE HAS NO EAR FOR THE WORDS YET, AND NONE CAN BE MADE WITHOUT A KEY :: THIS LANE RUNS ON THE GOOGLE AI (GEMINI) KEY - THE SAME ONE HER EYES AND HER EARS USE.\n"
    + "STORE ONE IN THE KEYS PANEL (KEYS \u25be) AND PRESS AGAIN. UNTIL THEN SHE IS TOLD PLAINLY THAT SHE HAS NOT READ IT - AND WILL NOT PRETEND TO.";

  function noKeyMsg() {
    try { if (keyring() && keyring().bypassed && keyring().bypassed(PROVIDER)) return "GEMINI CALLS ARE BYPASSED IN THE KEYS PANEL :: UNCHECK THE BYPASS TO LET THEM THROUGH - NOTHING WAS SENT, AND SHE IS TOLD PLAINLY THAT SHE HAS NOT READ IT."; } catch (e) {}
    return NO_KEY;
  }

  function earNote() {
    try { if (keyring() && keyring().bypassed && keyring().bypassed(PROVIDER)) return "BYPASSED - GOOGLE AI (GEMINI) CALLS ARE SUPPRESSED IN THE KEYS PANEL"; } catch (e) {}
    return "NO EAR YET - A GOOGLE AI (GEMINI) KEY IN THE KEYS PANEL GIVES HER ONE";
  }

  function whyText(e) {
    var m = String((e && e.message) || e);
    try { var kr = keyring(); if (kr && kr.scrub) m = kr.scrub(m, PROVIDER); } catch (e2) { }
    return m;
  }

  /* ---- the reduction (the twin of HER EARS') --------------------------------
     Mono, LIA_HEAR_RATE, 16-bit PCM WAV - the one container every listening service
     takes, and small enough to hand over whole. This is the same primitive
     src/js/audition.js builds for her ears (toListenableWav): one reduction, made
     here on this device, so a master WAV never leaves as a master WAV. It is written
     out a second time rather than reached for across the two modules because the
     reduction is the only thing they share - if it ever changes, it changes in both,
     and the ears' version is the one that was measured.
     ------------------------------------------------------------------------- */
  async function reduce(blob, from, seconds) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("THIS BROWSER HAS NO AUDIO DECODER, SO IT CANNOT READ THE FILE HERE.");
    if (num(blob && blob.size, 0) > DECODE_MAX) {
      throw new Error("THE FILE IS LARGER THAN THE DECODE LIMIT (" + Math.round(DECODE_MAX / (1024 * 1024)) + " MB) - REDUCE IT AS A COPY FIRST, OR RAISE LIA_HEAR_DECODE_MAX IN src/js/config.js.");
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
    var secs = Math.max(1, Math.min(seconds || SECONDS, total - start));
    var oc = new OfflineAudioContext(1, Math.ceil(secs * RATE), RATE);
    var src = oc.createBufferSource();
    src.buffer = buf;
    src.connect(oc.destination);
    src.start(0, start, secs);
    var rendered = await oc.startRendering();
    var pcm = rendered.getChannelData(0);
    var bytes = 44 + pcm.length * 2;
    var view = new DataView(new ArrayBuffer(bytes));
    function str(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    str(0, "RIFF"); view.setUint32(4, bytes - 8, true); str(8, "WAVE"); str(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    str(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (var i2 = 0; i2 < pcm.length; i2++) {
      var v = Math.max(-1, Math.min(1, pcm[i2]));
      view.setInt16(44 + i2 * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return { blob: new Blob([view.buffer], { type: "audio/wav" }), from: start, seconds: secs, total: total, rate: RATE };
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
      var err = new Error(String(why).replace(/\s+/g, " ").slice(0, 240));
      err.status = res.status;
      throw err;
    }
    return data || {};
  }

  /* ---- which models this key can actually reach ---------------------------- */

  // The families that cannot read a sound: embeddings, picture makers, video, speech-aloud, music,
  // the research and specialty lines, and anything with "image" in it. What is left is the general
  // multimodal line - the models that can hear - plus the dedicated transcriber, which is kept
  // apart because it is only good for one of the two jobs.
  var NOT_A_READER = /embed|imagen|veo|tts|learnlm|aqa|gemma|lyria|robotics|computer-use|deep-research|antigravity|omni|image/i;

  function scoreModel(n) {
    var s = 0;
    if (/flash/.test(n)) s += 40;
    if (/flash-lite|lite/.test(n)) s -= 14;   // the small one: fast and cheap, and the last resort
    if (/pro/.test(n)) s += 20;
    var v = n.match(/(\d+(?:\.\d+)?)/);
    if (v) s += Math.min(12, parseFloat(v[1]));
    if (/latest/.test(n)) s -= 2;             // an ALIAS with no version is the weakest of its family
    if (/preview|exp/.test(n)) s -= 4;
    return s;
  }

  async function models(force) {
    if (listCache && !force && Date.now() - listAt < LIST_TTL) return listCache;
    if (listPromise && !force) return listPromise;
    listPromise = (async function () {
      var data = await gcall("/models", null);
      var all = ((data && data.models) || []).filter(function (m) {
        return (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1;
      }).map(function (m) { return String(m.name || "").replace(/^models\//, ""); });
      var trans = all.filter(function (n) { return /transcribe/i.test(n); });
      var general = all.filter(function (n) { return !NOT_A_READER.test(n) && !/transcribe/i.test(n); });
      general.sort(function (a, b) { return scoreModel(b) - scoreModel(a); });
      if (!trans.length && !general.length) throw new Error("THIS KEY CANNOT REACH A MODEL THAT CAN READ A SOUND (THE MODELS LIST CAME BACK WITHOUT ONE).");
      listCache = { all: all, trans: trans, general: general, words: trans.concat(general), read: general };
      listAt = Date.now();
      return listCache;
    })().catch(function (e) { listPromise = null; throw e; });
    return listPromise;
  }

  function triedRecently(m) {
    var t = settings.tried && settings.tried[m];
    return !!t && (Date.now() - t < COOLDOWN);
  }
  function modelFailed(m) {
    settings.tried = settings.tried || {};
    settings.tried[m] = Date.now();
    Object.keys(settings.tried).forEach(function (k) {
      if (Date.now() - settings.tried[k] > COOLDOWN) delete settings.tried[k];
    });
    try { saveSettings(); } catch (e) { }   // a set-aside outlives the page
  }

  // The order one pass offers the sound to: a model pinned by hand, then the one that answered last
  // time (it is the known quantity), then the ranked list - with the ALIASES (the `-latest` names)
  // pulled up to just behind the strongest of the family. That last move is MEASURED, not taste: on
  // 2026-09-27 the versioned flash family (3.5 through 3.8) came back 503 "high demand" one after
  // another while gemini-flash-latest / gemini-flash-lite-latest answered the same audio happily -
  // an alias serves whatever is current and evidently sits on different capacity, so it is the first
  // fallback rather than the last. The strongest versioned model is still asked first: quality is
  // what the order is for, and a load event costs one wasted call, not four.
  function orderFor(task, list) {
    var pinW = s1(typeof LIA_HEAR_WORDS_MODEL === "string" ? LIA_HEAR_WORDS_MODEL : "").replace(/^models\//, "");
    var pinR = s1(typeof LIA_HEAR_READ_MODEL === "string" ? LIA_HEAR_READ_MODEL : "").replace(/^models\//, "");
    var base = (task === "words" ? list.words : list.read).slice();
    var aliases = base.filter(function (n) { return /-latest$/i.test(n); });
    var versioned = base.filter(function (n) { return !/-latest$/i.test(n); });
    var ranked = [];
    if (versioned.length) ranked.push(versioned.shift());
    aliases.forEach(function (n) { ranked.push(n); });
    versioned.forEach(function (n) { ranked.push(n); });
    var out = [];
    function add(n) { if (n && out.indexOf(n) === -1) out.push(n); }
    if (task === "words") add(pinW); else add(pinR);
    add(task === "words" ? settings.wordsModel : settings.readModel);
    ranked.forEach(add);
    return out;
  }

  function overloaded(e) {
    if (!e) return false;
    if (e.status === 503 || e.status === 429) return true;
    return /high demand|overloaded|rate limit|quota|temporarily unavailable|unavailable/i.test(String(e.message || ""));
  }

  /* ---- a refusal ----------------------------------------------------------- */

  var BLOCKED = {
    SAFETY: "SAFETY",
    PROHIBITED_CONTENT: "PROHIBITED CONTENT",
    RECITATION: "RECITATION",
    BLOCKLIST: "THE BLOCKLIST",
    IMAGE_SAFETY: "IMAGE SAFETY",
    SPII: "PERSONAL INFORMATION",
    LANGUAGE: "LANGUAGE",
    OTHER: "AN UNSPECIFIED STOP",
  };

  // A refusal the service put in its own FIELDS (the reliable place to look), or - when the fields
  // say STOP and the answer is a sentence declining instead of the shape that was asked for - the
  // answer itself. The second test is deliberately narrow and only fires on a SHORT answer that
  // opens like a refusal, so a real transcript cannot be mistaken for one.
  var REFUSING = /^\s*(i'?m sorry|sorry[,!.]|i (can'?t|cannot|can not|won'?t|will not|am (not able|unable|not going)|must (decline|refuse|not))|as an ai\b|i'?m not able|i am not able|my apologies)/i;

  function refusalWords(text) {
    var t = String(text || "").trim();
    if (!t || t.length > 400) return false;
    return REFUSING.test(t);
  }

  function refusalOf(data, cand, text) {
    var pf = (data && data.promptFeedback) || {};
    var reason = String(pf.blockReason || "").toUpperCase();
    if (!reason) reason = String((cand && cand.finishReason) || "").toUpperCase();
    var msg = s1(pf.blockReasonMessage || (cand && cand.finishMessage) || "").replace(/\s+/g, " ");
    if (reason === "MAX_TOKENS") return { blocked: false, truncated: true, reason: reason };
    if (reason && BLOCKED[reason]) {
      return { blocked: true, raw: reason, reason: BLOCKED[reason], message: msg };
    }
    if (refusalWords(text)) {
      return { blocked: true, raw: "ANSWER", reason: "THE SERVICE DECLINED", message: String(text).trim().slice(0, 240) };
    }
    return { blocked: false };
  }

  function refusalLine(name, policy, model) {
    return "GEMINI WOULD NOT READ IT :: " + String(name || "THE PIECE").toUpperCase() + " :: " + policy.reason
      + (model ? " :: " + String(model).toUpperCase() : "")
      + (policy.message ? "\nIT SAID: \u201c" + policy.message + "\u201d" : "")
      + "\nTHE AUDIO IS UNTOUCHED AND NOTHING WAS WRITTEN ON THE RECORD. WHAT IT SAYS WAS NOT REWRITTEN, SHORTENED OR SOFTENED TO GET PAST THE FILTER, AND NO OTHER MODEL OR SERVICE WAS ASKED TO TAKE A SECOND LOOK."
      + "\nA REFUSAL IS THE SERVICE'S ANSWER, NOT A VERDICT ON THE CLIP - AND NOT SOMETHING THIS TERMINAL WILL QUIETLY WORK AROUND.";
  }

  /* ---- the pass ------------------------------------------------------------ */

  // Offer the sound to the list. A model that answers with nothing is a DEAD END and the next one is
  // tried (measured: gemini-3.5-transcribe answers exactly that way today). A REFUSAL stops the
  // pass - offering the same words to the next model would be shopping for permission.
  async function offer(parts, opts) {
    opts = opts || {};
    var list = await models();
    var order = orderFor(opts.task, list);
    var lastErr = null, tried = 0, empty = "", over = 0, warned = false;
    for (var i = 0; i < order.length && tried < TRIES; i++) {
      var m = order[i];
      if (!m || triedRecently(m)) continue;
      tried++;
      var body = { contents: [{ parts: parts }] };
      var cfg = {};
      if (opts.json) cfg.responseMimeType = "application/json";
      if (opts.temperature != null) cfg.temperature = opts.temperature;
      if (Object.keys(cfg).length) body.generationConfig = cfg;
      var data;
      try {
        data = await gcall("/models/" + m + ":generateContent", body);
      } catch (e) {
        lastErr = e;
        modelFailed(m);
        // A 503 "high demand" is the SERVICE's weather, not a verdict on the model or the file, and
        // each one costs the better part of a minute. Two in a row is worth saying out loud, so the
        // wait does not look like a hang - the pass carries on down the list either way.
        if (overloaded(e)) over++; else over = 0;
        if (!opts.quiet) {
          if (!warned && over >= 2) {
            warned = true;
            say("THE SERVICE IS UNDER HIGH DEMAND (503) - GOOGLE'S OWN SIDE, NOT THE FILE AND NOT THE KEY."
              + "\nTHE MODELS THAT REFUSED ARE SET ASIDE FOR " + Math.round(COOLDOWN / 60000) + " MINUTES. OFFERING IT TO THE NEXT ONE ...");
          } else if (tried < TRIES) {
            say("THE HEARING :: " + m.toUpperCase() + " WOULD NOT TAKE IT :: " + whyText(e).toUpperCase()
              + "\nTHE FILE IS UNTOUCHED AND NOTHING WAS WRITTEN. OFFERING IT TO ANOTHER MODEL ...");
          }
        }
        continue;
      }
      var cand = ((data.candidates || [])[0]) || {};
      var text = (((cand.content || {}).parts) || []).map(function (p) { return String(p.text || ""); }).join("").trim();
      var policy = refusalOf(data, cand, text);
      if (policy.blocked) return { ok: false, policy: policy, model: m, data: data };
      if (!text) { modelFailed(m); empty = m; continue; }
      if (opts.task === "words") settings.wordsModel = m; else settings.readModel = m;
      settings.tried = {};
      try { await saveSettings(); } catch (e) { }
      return { ok: true, text: text, model: m, data: data, truncated: !!policy.truncated };
    }
    if (empty && !lastErr) {
      return { ok: false, model: empty, error: "THE MODELS THIS KEY CAN REACH ANSWERED WITH NOTHING AT ALL (no words came back" + (empty ? " - " + empty : "") + "). NOTHING WAS WRITTEN AND THE FILE IS UNTOUCHED." };
    }
    return {
      ok: false,
      error: lastErr ? whyText(lastErr) : "NO MODEL THIS KEY CAN REACH WOULD READ IT.",
      overload: !!lastErr && overloaded(lastErr),
    };
  }

  function errOf(out) {
    var e = new Error(out.error || "NO MODEL THIS KEY CAN REACH WOULD READ IT.");
    e.overload = !!out.overload;
    return e;
  }

  // What a failed pass says. The service's own words come first (they are specific - "high demand",
  // "API key not valid", "quota"), then, when it was a load event, the two facts that actually help:
  // it is not the file, and the models that refused are already set aside.
  function failure(e, verb) {
    return "SHE COULD NOT " + verb + " :: " + whyText(e).toUpperCase()
      + (e && e.overload ? "\nTHAT IS THE SERVICE'S OWN SIDE (HIGH DEMAND OR A LIMIT ON THE KEY), NOT THE FILE AND NOT THE FORMAT. THE MODELS THAT JUST REFUSED ARE SET ASIDE FOR " + Math.round(COOLDOWN / 60000) + " MINUTES, SO PRESSING AGAIN IN A FEW MINUTES GOES STRAIGHT TO THE NEXT ONES." : "")
      + "\nNOTHING WAS WRITTEN AND THE FILE IS UNTOUCHED.";
  }

  /* ---- what is being read -------------------------------------------------- */

  // A source is a vault id, a name / #tag / folder (the bus's own finder), a Blob/File, or
  // { blob, name, mime, id }. A record gives the run somewhere to WRITE; a bare file does not.
  async function resolve(source) {
    if (!source) return null;
    if (typeof source === "string") {
      var M = media();
      var r = (M && M.get) ? M.get(source) : null;
      if (r) return pack(r);
      if (window.audition && window.audition.find) {
        try {
          var f = await window.audition.find(source, 4);
          if (f && f.ids && f.ids.length) {
            var r2 = (M && M.get) ? M.get(f.ids[0]) : null;
            if (r2) return pack(r2);
          }
        } catch (e) { }
      }
      return null;
    }
    var blob = source.blob || ((window.Blob && source instanceof window.Blob) ? source : null);
    if (!blob) return null;
    return {
      id: s1(source.id), name: s1(source.name) || s1(blob.name) || "a recording",
      blob: blob, mime: s1(source.mime) || s1(blob.type), duration: num(source.duration, 0),
      rec: source.id ? recOf(source.id) : null,
    };
  }

  function pack(rec) {
    return {
      id: rec.id, name: s1(rec.name) || s1(rec.prompt) || "a piece of audio",
      blob: rec.blob, mime: s1(rec.mime), duration: num(rec.duration, 0), rec: rec,
    };
  }

  function soundOnly(s) {
    var mime = s1(s.mime).toLowerCase();
    if (mime && !/^audio\//.test(mime)) return false;
    return true;
  }

  function descOf(s, made) {
    return "a mono " + Math.round(RATE / 1000) + " kHz reduction, made here on this device"
      + (made.seconds < made.total - 1
        ? ", " + mmss(made.seconds) + " of its " + mmss(made.total) + " (from " + mmss(made.from) + ")"
        : ", the whole of it");
  }

  /* ---- THE WORDS ----------------------------------------------------------- */

  async function words(source, opts) {
    opts = opts || {};
    if (!(await ensureKey())) { if (!opts.quiet) say(noKeyMsg()); return { ok: false, error: "no key" }; }
    if (busy) { say("SHE IS ALREADY READING SOMETHING :: " + busyWhat.toUpperCase() + " - ONE PASS AT A TIME."); return { ok: false, error: "busy" }; }
    var s = await resolve(source || busId());
    if (!s) { if (!opts.quiet) say(NO_SOURCE); return { ok: false, error: "not found" }; }
    if (!soundOnly(s)) { if (!opts.quiet) say(NOT_SOUND); return { ok: false, error: "not sound" }; }
    busy = true; busyWhat = "the words of " + s.name;
    if (!opts.quiet) pbar("THE WORDS \u00b7 REDUCING " + s.name.toUpperCase());
    try {
      if (!opts.quiet) {
        say("THE WORDS :: REDUCING " + s.name.toUpperCase() + " TO MONO " + Math.round(RATE / 1000) + " kHz HERE, ON THIS DEVICE ..."
          + "\nNOTHING BUT THOSE SECONDS OF SOUND GO ANYWHERE, AND NOTHING ABOUT THE FILE CHANGES.");
      }
      var made = await reduce(s.blob, opts.from || 0, opts.seconds || SECONDS);
      if (!opts.quiet) pbar("THE WORDS \u00b7 READING IT");
      var data = await b64(made.blob);
      var out = await offer([{ text: WORDS_PROMPT }, { inlineData: { mimeType: "audio/wav", data: data } }],
        { task: "words", quiet: opts.quiet });
      if (!out.ok) {
        if (out.policy) { if (!opts.quiet) say(refusalLine(s.name, out.policy, out.model)); return { ok: false, policy: out.policy, error: out.policy.reason }; }
        throw errOf(out);
      }
      var text = String(out.text || "").replace(/[ \t]+/g, " ").trim();
      var none = /^no speech[.!]?$/i.test(text.replace(/\s+/g, " ").trim());
      var stamp = {
        text: none ? "" : text,
        speech: !none,
        engine: "GEMINI", model: out.model,
        from: r1(made.from), seconds: r1(made.seconds), total: r1(made.total), rate: RATE,
        ts: Date.now(),
        note: descOf(s, made),
      };
      if (s.id && media().setField) { try { await media().setField(s.id, "transcript", stamp); } catch (e) { console.warn("the transcript could not be written on the record", e); } }
      if (!opts.quiet) {
        var shown = stamp.text.length > 600 ? stamp.text.slice(0, 600) + "\u2026" : stamp.text;
        say("THE WORDS :: " + s.name.toUpperCase() + " :: " + mmss(stamp.seconds) + " READ :: " + String(out.model).toUpperCase()
          + (none ? "\nTHERE ARE NO SPOKEN WORDS IN IT (IT WAS READ AS SOUND, AND NOTHING WAS INVENTED TO FILL THE SPACE)."
                 : " :: " + String(stamp.text).length + " CHARACTERS\n" + shown)
          + "\n" + (s.id ? "IT IS WRITTEN ON THE RECORD AS WHAT IT SAYS (the full stage, the gallery's voice rows), AND SHE IS HANDED IT ON EVERY TURN THE PIECE IS ON THE BUS." : "NOTHING WAS WRITTEN ANYWHERE - THIS WAS A FILE HANDED OVER, NOT A PIECE IN THE VAULT."));
      }
      return { ok: true, id: s.id, name: s.name, model: out.model, from: stamp.from, seconds: stamp.seconds, total: stamp.total, speech: stamp.speech, text: stamp.text };
    } catch (e) {
      if (!opts.quiet) say(failure(e, "READ THE WORDS OF IT"));
      return { ok: false, error: whyText(e), overload: !!e.overload };
    } finally {
      busy = false; busyWhat = "";
      if (!opts.quiet) pbarDone();
    }
  }

  /* ---- THE READING --------------------------------------------------------- */

  function parseJSON(text) {
    var t = s1(text);
    if (!t) return null;
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }

  function sentimentOf(v) {
    var t = s1(v).toLowerCase();
    if (t === "positive" || t === "negative" || t === "mixed" || t === "neutral") return t;
    if (/pos/.test(t)) return "positive";
    if (/neg/.test(t)) return "negative";
    if (/mix/.test(t)) return "mixed";
    return t ? "neutral" : "";
  }
  function clamp01(v) { var n = Number(v); return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
  function strList(v, cap) {
    if (!Array.isArray(v)) return [];
    return v.map(function (x) { return s1(x); }).filter(Boolean).slice(0, cap || 4);
  }

  async function reading(source, opts) {
    opts = opts || {};
    if (!(await ensureKey())) { if (!opts.quiet) say(noKeyMsg()); return { ok: false, error: "no key" }; }
    if (busy) { say("SHE IS ALREADY READING SOMETHING :: " + busyWhat.toUpperCase() + " - ONE PASS AT A TIME."); return { ok: false, error: "busy" }; }
    var s = await resolve(source || busId());
    if (!s) { if (!opts.quiet) say(NO_SOURCE); return { ok: false, error: "not found" }; }
    if (!soundOnly(s)) { if (!opts.quiet) say(NOT_SOUND); return { ok: false, error: "not sound" }; }
    busy = true; busyWhat = "a reading of " + s.name;
    if (!opts.quiet) pbar("THE READING \u00b7 REDUCING " + s.name.toUpperCase());
    try {
      if (!opts.quiet) {
        say("A READING OF IT :: REDUCING " + s.name.toUpperCase() + " HERE, ON THIS DEVICE, THEN ASKING WHAT IS SAID AND HOW IT IS SAID ...");
      }
      var made = await reduce(s.blob, opts.from || 0, opts.seconds || SECONDS);
      if (!opts.quiet) pbar("THE READING \u00b7 READING IT");
      var data = await b64(made.blob);
      var out = await offer([{ text: READ_PROMPT }, { inlineData: { mimeType: "audio/wav", data: data } }],
        { task: "reading", json: true, temperature: 0.2, quiet: opts.quiet });
      if (!out.ok) {
        if (out.policy) { if (!opts.quiet) say(refusalLine(s.name, out.policy, out.model)); return { ok: false, policy: out.policy, error: out.policy.reason }; }
        throw errOf(out);
      }
      var j = parseJSON(out.text);
      var rd = {
        speech: !!(j && j.speech),
        transcript: j ? s1(j.transcript) : "",
        language: j ? s1(j.language) : "",
        speakers: j ? s1(j.speakers) : "",
        music: !!(j && j.music),
        emotion: j ? s1(j.emotion) : "",
        tone: j ? s1(j.tone) : "",
        sentiment: j ? sentimentOf(j.sentiment) : "",
        intensity: j ? clamp01(j.intensity) : 0,
        summary: j ? s1(j.summary) : "",
        phrases: j ? strList(j.phrases, 4) : [],
        title: j ? s1(j.title) : "",
        engine: "GEMINI", model: out.model,
        from: r1(made.from), seconds: r1(made.seconds), total: r1(made.total),
        ts: Date.now(),
        note: descOf(s, made),
      };
      // It did not answer in the shape it was asked for. That is said, not hidden - and what it did
      // say is kept rather than thrown away, so a reading is never an empty field with no reason.
      if (!j) rd.summary = s1(out.text).slice(0, 900);
      if (s.id && media().setField) {
        try {
          await media().setField(s.id, "reading", rd);
          if (rd.transcript && !(s.rec && s.rec.transcript)) {
            await media().setField(s.id, "transcript", {
              text: rd.transcript, speech: true, engine: "GEMINI", model: out.model,
              from: rd.from, seconds: rd.seconds, total: rd.total, rate: RATE, ts: Date.now(), note: rd.note,
            });
          }
        } catch (e) { console.warn("the reading could not be written on the record", e); }
      }
      if (!opts.quiet) {
        var bits = [];
        if (rd.emotion) bits.push("IT FEELS :: " + rd.emotion.toUpperCase() + (rd.tone ? " (" + rd.tone + ")" : ""));
        if (rd.sentiment) bits.push("SENTIMENT :: " + rd.sentiment.toUpperCase() + " " + Math.round(rd.intensity * 100) + "%");
        if (rd.speakers) bits.push("VOICES :: " + rd.speakers.toUpperCase());
        if (rd.language) bits.push("LANGUAGE :: " + rd.language.toUpperCase());
        bits.push("MUSIC: " + (rd.music ? "YES" : "NO") + "  \u00b7  SPEECH: " + (rd.speech ? "YES" : "NO"));
        var body = "A READING OF IT :: " + s.name.toUpperCase() + " :: " + mmss(rd.seconds) + " READ :: " + String(out.model).toUpperCase()
          + "\n" + bits.join("  \u00b7  ");
        if (rd.transcript) body += "\nWHAT IT SAYS :: \u201c" + (rd.transcript.length > 500 ? rd.transcript.slice(0, 500) + "\u2026" : rd.transcript) + "\u201d";
        if (rd.summary) body += "\nWHAT IT IS :: " + rd.summary;
        if (rd.phrases.length) body += "\nIT CARRIES :: " + rd.phrases.map(function (p) { return "\u201c" + p + "\u201d"; }).join("  ");
        if (rd.title) body += "\nA LABEL FOR IT :: " + rd.title;
        if (!j) body += "\n(THE SERVICE DID NOT ANSWER IN THE SHAPE IT WAS ASKED FOR - WHAT IT DID SAY IS KEPT AS THE SUMMARY, AND NOTHING WAS INVENTED AROUND IT.)";
        body += "\n" + (s.id ? "WRITTEN ON THE RECORD AS ITS READING, AND HANDED TO HER WHENEVER THE PIECE IS ON THE BUS." : "NOTHING WAS WRITTEN ANYWHERE - THIS WAS A FILE HANDED OVER, NOT A PIECE IN THE VAULT.");
        say(body);
      }
      return { ok: true, id: s.id, name: s.name, model: out.model, reading: rd, shaped: !!j };
    } catch (e) {
      if (!opts.quiet) say(failure(e, "READ IT"));
      return { ok: false, error: whyText(e), overload: !!e.overload };
    } finally {
      busy = false; busyWhat = "";
      if (!opts.quiet) pbarDone();
    }
  }

  /* ---- A QUESTION ABOUT IT ------------------------------------------------- */

  async function ask(source, question, opts) {
    opts = opts || {};
    question = s1(question);
    if (!question) { say("ASK WHAT? /hear ask <SOURCE> :: <QUESTION> - OR /hear ask :: <QUESTION> ABOUT THE PIECE ON THE BUS."); return { ok: false, error: "no question" }; }
    if (!(await ensureKey())) { say(noKeyMsg()); return { ok: false, error: "no key" }; }
    if (busy) { say("SHE IS ALREADY READING SOMETHING :: " + busyWhat.toUpperCase() + " - ONE PASS AT A TIME."); return { ok: false, error: "busy" }; }
    var s = await resolve(source || busId());
    if (!s) { say(NO_SOURCE); return { ok: false, error: "not found" }; }
    if (!soundOnly(s)) { say(NOT_SOUND); return { ok: false, error: "not sound" }; }
    busy = true; busyWhat = "a question about " + s.name;
    pbar("A QUESTION ABOUT " + s.name.toUpperCase());
    try {
      say("ASKING GEMINI ABOUT " + s.name.toUpperCase() + " :: \u201c" + question + "\u201d");
      var made = await reduce(s.blob, 0, SECONDS);
      pbar("A QUESTION ABOUT " + s.name.toUpperCase() + " \u00b7 WAITING");
      var data = await b64(made.blob);
      var out = await offer([
        { inlineData: { mimeType: "audio/wav", data: data } },
        { text: ASK_PROMPT + "\n\nHis question: " + question },
      ], { task: "reading", temperature: 0.3 });
      if (!out.ok) {
        if (out.policy) { say(refusalLine(s.name, out.policy, out.model)); return { ok: false, policy: out.policy, error: out.policy.reason }; }
        throw errOf(out);
      }
      say("GEMINI, ON " + s.name.toUpperCase() + " (a mono " + Math.round(RATE / 1000) + " kHz reduction, " + mmss(made.seconds) + ") :: " + String(out.model).toUpperCase()
        + "\n" + s1(out.text)
        + "\nNOTHING WAS WRITTEN ON THE RECORD: A QUESTION IS A CONVERSATION, NOT A FACT ABOUT THE FILE. /hear reading WRITES THE MOOD AND THE MEANING DOWN.");
      return { ok: true, id: s.id, name: s.name, model: out.model, text: s1(out.text) };
    } catch (e) {
      say(failure(e, "ANSWER ABOUT IT"));
      return { ok: false, error: whyText(e), overload: !!e.overload };
    } finally {
      busy = false; busyWhat = "";
      pbarDone();
    }
  }

  /* ---- IS IT A USABLE CLONE REFERENCE? ------------------------------------- */

  async function checkSample(source, opts) {
    opts = opts || {};
    if (!(await ensureKey())) { say(noKeyMsg()); return { ok: false, error: "no key" }; }
    if (busy) { say("SHE IS ALREADY READING SOMETHING :: " + busyWhat.toUpperCase() + " - ONE PASS AT A TIME."); return { ok: false, error: "busy" }; }
    var s = await resolve(source || busId());
    if (!s) { say(NO_SOURCE); return { ok: false, error: "not found" }; }
    if (!soundOnly(s)) { say(NOT_SOUND); return { ok: false, error: "not sound" }; }
    busy = true; busyWhat = "the sample check on " + s.name;
    pbar("THE SAMPLE CHECK \u00b7 " + s.name.toUpperCase());
    try {
      var made = await reduce(s.blob, 0, Math.max(SAMPLE_SECONDS * 2, 60));
      pbar("THE SAMPLE CHECK \u00b7 LISTENING");
      var data = await b64(made.blob);
      var out = await offer([{ text: SAMPLE_PROMPT }, { inlineData: { mimeType: "audio/wav", data: data } }],
        { task: "reading", json: true, temperature: 0.2 });
      if (!out.ok) {
        if (out.policy) { say(refusalLine(s.name, out.policy, out.model)); return { ok: false, policy: out.policy, error: out.policy.reason }; }
        throw errOf(out);
      }
      var j = parseJSON(out.text) || {};
      var chk = {
        usable: !!j.usable, voices: Math.round(num(j.voices, 0)), clean: !!j.clean,
        seconds: r1(num(j.seconds, 0)), problems: strList(j.problems, 6),
        advice: s1(j.advice), voicePrompt: s1(j.voicePrompt),
        engine: "GEMINI", model: out.model, ts: Date.now(),
        clip: mmss(num(s.duration, made.total)),
      };
      if (s.id && media().setField) { try { await media().setField(s.id, "sampleCheck", chk); } catch (e) { } }
      var head = chk.usable ? "USABLE AS A CLONE REFERENCE" : "NOT USABLE AS A CLONE REFERENCE AS IT STANDS";
      say("THE SAMPLE CHECK :: " + s.name.toUpperCase() + " :: " + head
        + "\nTHE CLIP :: " + chk.clip + " LONG  \u00b7  VOICES HEARD: " + chk.voices + "  \u00b7  SPEECH IN IT: " + mmss(chk.seconds) + "  \u00b7  CLEAN: " + (chk.clean ? "YES" : "NO")
        + (chk.problems.length ? "\nAS A REFERENCE :: " + chk.problems.join(" / ") : "\nAS A REFERENCE :: NOTHING WRONG FOUND")
        + (chk.advice ? "\nTO IMPROVE IT :: " + chk.advice : "")
        + (chk.voicePrompt ? "\nFOR THE VOICE PROMPT ON THE RECORD :: " + chk.voicePrompt : "")
        + "\nTHE CLONE WANTS ONE VOICE, CLEAN, ABOUT 10 TO " + Math.round(SAMPLE_SECONDS) + " SECONDS (LIA_HEAR_SAMPLE_SECONDS, AND THE STORY LANE'S OWN SAMPLE CEILING IS LIA_STORY_SAMPLE_MAX)."
        + "\n" + (s.id ? "KEPT ON THE RECORD AS ITS SAMPLE CHECK. NOTHING WAS CHANGED - THE VOICE PROMPT IS YOURS TO WRITE (the full stage)." : ""));
      return { ok: true, id: s.id, name: s.name, model: out.model, check: chk };
    } catch (e) {
      say(failure(e, "CHECK THE SAMPLE"));
      return { ok: false, error: whyText(e), overload: !!e.overload };
    } finally {
      busy = false; busyWhat = "";
      pbarDone();
    }
  }

  /* ---- THE POWERS THIS KEY ACTUALLY HAS ------------------------------------ */

  // Asked of the key itself, never claimed from memory: /hear powers reads /models and sorts what
  // comes back into what each family of models is FOR, then says which of them are wired here.
  async function powers() {
    if (!(await ensureKey())) { say(noKeyMsg()); return { ok: false, error: "no key" }; }
    pbar("READING THE KEY'S OWN MODEL LIST");
    try {
      var list = await models(true);
      var all = list.all.slice().sort();
      function pick(re) { return all.filter(function (n) { return re.test(n); }); }
      function show(arr, cap) {
        cap = cap || 6;
        var more = arr.length > cap;
        arr = arr.slice(0, cap);
        return arr.length ? arr.join(", ") + (more ? " +" : "") : "-";
      }
      var trans = pick(/transcribe/i), speech = pick(/tts/i), music = pick(/lyria/i),
        picture = pick(/image|imagen|nano-banana/i), meaning = pick(/embedding/i),
        video = pick(/veo|video/i);
      var research = pick(/deep-research|antigravity|computer-use|robotics/i);
      var heard = list.general;
      say("THE GOOGLE (GEMINI) KEY'S POWERS :: " + all.length + " MODELS REACHABLE, READ FROM THE KEY ITSELF"
        + "\n  HEARING A CLIP     :: " + show(heard, 8) + "\n       WIRED - HER EARS (/hear ears, the HER EARS button) AND THIS LANE (/hear reading, /hear ask)."
        + "\n  SPEECH TO WORDS    :: " + show(trans, 4) + "\n       WIRED - /hear words, and a clip handed over in the chat (src/js/attach.js asks here FIRST)."
        + "\n  SPEECH ALOUD       :: " + show(speech, 4) + "\n       NOT WIRED - the Story lane clones through a free HuggingFace Space instead (src/js/story.js)."
        + "\n  MUSIC              :: " + show(music, 4) + "\n       NOT WIRED - this key can COMPOSE, not only listen. A music lane is a real road here."
        + "\n  PICTURES           :: " + show(picture, 5) + "\n       NOT WIRED - making and editing pictures; the forge renders through the text-to-image plugin instead."
        + "\n  MEANING            :: " + show(meaning, 3) + "\n       WIRED - the embedding lane behind recall and /docs index (src/js/embed.js)."
        + (video.length ? "\n  VIDEO              :: " + show(video, 3) + " (not wired, and slow)" : "")
        + (research.length ? "\n  RESEARCH / OTHER   :: " + show(research, 4) + " (not wired)" : "")
        + "\nA REFUSAL IS POSSIBLE ON ANY OF THEM, AND IT IS REPORTED, NEVER WORKED AROUND."
        + "\nKEYRING: the google key rides in the URL of every call (see src/keys/providers.json). Treat any request log as a secret.");
      return { ok: true, count: all.length, hearing: heard, transcribe: trans, speech: speech, music: music, picture: picture, meaning: meaning };
    } catch (e) {
      say("THE KEY'S MODEL LIST COULD NOT BE READ :: " + whyText(e).toUpperCase());
      return { ok: false, error: whyText(e) };
    } finally {
      pbarDone();
    }
  }

  /* ---- taking a reading off a record --------------------------------------- */

  async function clear(source, what) {
    var s = await resolve(source || busId());
    if (!s || !s.id) { say("WHICH ONE? /hear clear <SOURCE> - BARE, IT IS THE PIECE ON THE BUS."); return { ok: false, error: "not found" }; }
    what = s1(what).toLowerCase();
    var fields = (what === "words" || what === "transcript") ? ["transcript"]
      : (what === "reading") ? ["reading"]
        : (what === "sample") ? ["sampleCheck"]
          : ["transcript", "reading", "sampleCheck"];
    for (var i = 0; i < fields.length; i++) {
      try { await media().setField(s.id, fields[i], ""); } catch (e) { }
    }
    say("TAKEN OFF THE RECORD :: " + s.name.toUpperCase() + " :: " + fields.join(", ").toUpperCase()
      + "\nTHE AUDIO IS UNTOUCHED, AND NOTHING ELSE ABOUT THE RECORD MOVED. NOTHING WAS UPLOADED OR SENT ANYWHERE TO DO THIS.");
    return { ok: true, id: s.id, cleared: fields };
  }

  /* ---- the stage: the two rows on a voice's full stage --------------------- */

  function btn(label, title, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lbHearBtn";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function copy(text) {
    text = String(text || "");
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy") === true;
        ta.remove();
        say(ok ? "COPIED." : "THIS PAGE COULD NOT COPY BY ITSELF - SELECT THE WORDS ON THE STAGE BY HAND.");
      } catch (e) { say("THIS PAGE COULD NOT COPY BY ITSELF - SELECT THE WORDS ON THE STAGE BY HAND."); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say("COPIED."); }, fallback);
        return;
      }
    } catch (e) { }
    fallback();
  }

  function label(text, title) {
    var el = document.createElement("span");
    el.className = "lbTagsLabel";
    el.textContent = text;
    el.title = title;
    return el;
  }

  // One chip in a reading. The chips live in their own BOUNDED row - the same 56 px ceiling a tag row
  // uses (see .galTagRow in src/css/terminal.css) - so a talkative model cannot stretch the stage with
  // a dozen of them, and the sentence under them stays in view on a short screen.
  function chipsAppend(box, text) {
    var s = document.createElement("span");
    s.className = "lbHearChip";
    s.textContent = text;
    box.appendChild(s);
    return s;
  }

  // The rows are drawn by the lane that owns the facts, so the stage never grows a second copy of
  // what a transcript is. `repaint` is the stage's own re-draw, handed in by src/js/images.js.
  function paintStage(id, box, hooks) {
    if (!box || !id) return;
    var rec = recOf(id);
    if (!rec) return;
    if (!(rec.mime && /^audio\//.test(String(rec.mime)))) return;
    var repaint = (hooks && hooks.repaint) || function () { if (window.openLightbox) window.openLightbox(id); };
    box.appendChild(wordsRow(id, rec, repaint));
    box.appendChild(readingRow(id, rec, repaint));
  }

  function wordsRow(id, rec, repaint) {
    var row = document.createElement("div");
    row.className = "lbHearRow";
    row.appendChild(label("WORDS", "what this voice SAYS, word for word - read out of the audio itself by the Google (Gemini) key on this device's reduction, not a description of the sound. Different from VOX tags (what it is filed as) and from her ears (/hear ears - what is IN it)."));
    if (!held()) {
      var n = document.createElement("span");
      n.className = "lbHearNote";
      n.textContent = earNote();
      n.title = "the words are read by Gemini, through the key ring; with no key the terminal says so plainly rather than inventing a transcript";
      row.appendChild(n);
      return row;
    }
    var tr = rec.transcript;
    if (tr && (tr.text || tr.speech === false)) {
      var t = document.createElement("div");
      t.className = "lbHearText";
      t.textContent = tr.speech === false ? "(no spoken words in it - it was read as sound, and nothing was invented)" : tr.text;
      t.title = "what it says, transcribed from the audio itself";
      row.appendChild(t);
      var meta = document.createElement("div");
      meta.className = "lbHearMeta";
      meta.textContent = [tr.engine || "GEMINI", tr.model, tr.seconds ? mmss(tr.seconds) + " read" : "",
        tr.ts ? new Date(tr.ts).toLocaleString() : ""].filter(Boolean).join("  \u00b7  ");
      if (tr.text) meta.textContent += "  \u00b7  " + tr.text.length + " characters";
      row.appendChild(meta);
      row.appendChild(btn("HEAR IT AGAIN", "read the words out of this audio again and replace what is on the record", async function () {
        await words(id); repaint();
      }));
      if (tr.text) row.appendChild(btn("COPY", "copy the words to the clipboard", function () { copy(tr.text); }));
      row.appendChild(btn("CLEAR", "take the transcript off this record (the audio is untouched)", async function () {
        await clear(id, "words"); repaint();
      }));
      return row;
    }
    row.appendChild(btn("HEAR THE WORDS", "reduce this audio here on this device and have Gemini write down, word for word, what is said - kept on the record as what it says", async function () {
      await words(id); repaint();
    }));
    return row;
  }

  function readingRow(id, rec, repaint) {
    var row = document.createElement("div");
    row.className = "lbHearRow";
    row.appendChild(label("READING", "what this voice IS - the mood, the emotion, the sentiment, the tone, who is speaking and what is actually being said. Read by the Google (Gemini) key; kept on the record as its reading."));
    if (!held()) {
      var n = document.createElement("span");
      n.className = "lbHearNote";
      n.textContent = earNote();
      row.appendChild(n);
      return row;
    }
    var rd = rec.reading;
    if (rd && (rd.summary || rd.emotion || rd.transcript || rd.sentiment)) {
      var chips = document.createElement("span");
      chips.className = "lbHearChips";
      chips.title = "what this voice is, as the reading found it";
      if (rd.sentiment) chipsAppend(chips, "SENTIMENT " + String(rd.sentiment).toUpperCase() + (rd.intensity ? " " + Math.round(rd.intensity * 100) + "%" : ""));
      if (rd.emotion) chipsAppend(chips, "EMOTION " + String(rd.emotion).toUpperCase());
      if (rd.tone) chipsAppend(chips, "DELIVERY " + String(rd.tone).toUpperCase());
      if (rd.speakers) chipsAppend(chips, String(rd.speakers).toUpperCase());
      if (rd.language) chipsAppend(chips, "LANGUAGE " + String(rd.language).toUpperCase());
      chipsAppend(chips, "MUSIC: " + (rd.music ? "YES" : "NO"));
      row.appendChild(chips);
      if (rd.title) {
        var ti = document.createElement("div");
        ti.className = "lbHearMeta";
        ti.textContent = "A LABEL FOR IT :: " + rd.title;
        row.appendChild(ti);
      }
      if (rd.summary) {
        var su = document.createElement("div");
        su.className = "lbHearText";
        su.textContent = rd.summary;
        su.title = "what is actually being said or done";
        row.appendChild(su);
      }
      if (rd.phrases && rd.phrases.length) {
        var ph = document.createElement("div");
        ph.className = "lbHearMeta";
        ph.textContent = "IT CARRIES :: " + rd.phrases.map(function (p) { return "\u201c" + p + "\u201d"; }).join("  ");
        row.appendChild(ph);
      }
      var m2 = document.createElement("div");
      m2.className = "lbHearMeta";
      m2.textContent = [rd.engine || "GEMINI", rd.model, rd.seconds ? mmss(rd.seconds) + " read" : "",
        rd.ts ? new Date(rd.ts).toLocaleString() : ""].filter(Boolean).join("  \u00b7  ");
      row.appendChild(m2);
      row.appendChild(sampleLine(id, rec, repaint));
      row.appendChild(btn("READ IT AGAIN", "read the audio again and replace the reading on the record", async function () {
        await reading(id); repaint();
      }));
      row.appendChild(btn("CLEAR", "take the reading off this record (the audio is untouched)", async function () {
        await clear(id, "reading"); repaint();
      }));
      return row;
    }
    row.appendChild(btn("READ IT (MOOD \u00b7 MEANING)", "read what it says and how it is said - mood, emotion, sentiment, voices, language, and a short summary - and keep it on the record", async function () {
      await reading(id); repaint();
    }));
    row.appendChild(sampleLine(id, rec, repaint));
    return row;
  }

  // THE SAMPLE CHECK, judged separately from a reading because it answers a different question: not
  // "what is this" but "would this make a good CLONE REFERENCE" - one voice, clean, about 10 to 30
  // seconds. /hear sample writes it on the record as `sampleCheck`, and its suggested voice prompt is
  // what the VOICE PROMPT above is written from, which is why its verdict stands on the stage.
  function sampleLine(id, rec, repaint) {
    var wrap = document.createElement("span");
    wrap.className = "lbHearMeta";
    var sc = rec && rec.sampleCheck;
    if (sc) {
      wrap.textContent = "AS A CLONE REFERENCE :: " + (sc.usable ? "USABLE" : "NOT USABLE AS IT STANDS")
        + (sc.voices ? "  \u00b7  " + sc.voices + " VOICE" + (sc.voices === 1 ? "" : "S") : "")
        + "  \u00b7  CLEAN: " + (sc.clean ? "YES" : "NO")
        + (sc.seconds ? "  \u00b7  " + mmss(sc.seconds) + " OF SPEECH" : "")
        + (sc.problems && sc.problems.length ? "  \u00b7  " + sc.problems.join(", ") : "");
      wrap.title = "judged as a clone reference for the Story lane - one voice, clean, about 10 to 30 seconds. CLEAR only takes it off the record; the audio is never touched.";
    } else {
      wrap.hidden = true;
    }
    var holder = document.createElement("span");
    holder.appendChild(btn(sc ? "CHECK THE SAMPLE AGAIN" : "IS IT A GOOD SAMPLE?",
      "judge this recording as a CLONE REFERENCE for the Story lane: one voice, clean, about 10-30 seconds - and suggest the sentence for its voice prompt",
      async function () { await checkSample(id); repaint(); }));
    wrap.appendChild(holder);
    return wrap;
  }

  /* ---- the command surface ------------------------------------------------- */

  function help() {
    return "USAGE: /hear words|reading|ask|sample|clear|powers [<SOURCE>]\n"
      + "  /hear words [<SOURCE>]          the words it says, VERBATIM - written on the record as what it says\n"
      + "  /hear reading [<SOURCE>]        what it says AND what it is: mood, emotion, sentiment, voices, language, a summary\n"
      + "  /hear ask [<SOURCE> ::] <Q>     ask Gemini a question about the clip (\"what language is that\", \"translate it\")\n"
      + "  /hear sample [<SOURCE>]         is this clip a usable CLONE REFERENCE for the Story lane (one voice, clean, 10-30 s)?\n"
      + "  /hear clear [<SOURCE>] [words|reading|sample]   take a reading off a record (the audio is untouched)\n"
      + "  /hear powers                    what THIS key can actually do, read from its own model list\n"
      + "<SOURCE> is a vault id, a name, a #tag or a /folder (the bus's own finder); bare, it is the piece ON THE BUS.\n"
      + "THE KEY IS THE GOOGLE (GEMINI) ONE. The audio is reduced here on this device (mono " + Math.round(RATE / 1000) + " kHz, at most " + mmss(SECONDS) + ") and only those seconds are sent. THE FILE IS NEVER UPLOADED OR CHANGED.\n"
      + "A REFUSAL IS REPORTED AND NEVER WORKED AROUND: nothing is rewritten to get past a filter, nothing is written on the record, and no other service is asked to take a second look.";
  }

  var NO_SOURCE = "WHICH PIECE? NAME ONE (a vault id, a name, a #tag, a /folder), OR PUT ONE ON THE BUS FIRST - /hear words WITH NOTHING AFTER IT READS WHATEVER IS PLAYING.";
  var NOT_SOUND = "SHE READS SOUND. THAT RECORD IS NOT AUDIO - A PICTURE GOES TO HER EYES INSTEAD (/sight, /see), AND A CLIP GOES TO THEM FRAME BY FRAME.";

  async function command(rest) {
    var s = s1(rest);
    var first = s ? s.split(/\s+/)[0].toLowerCase() : "";
    var tail = s ? s.slice(s.split(/\s+/)[0].length).trim() : "";
    await load();
    if (!first || first === "state" || first === "status") { say(describe()); return; }
    if (first === "help" || first === "?") { say(help()); return; }
    if (first === "powers" || first === "gems" || first === "gemini") { await powers(); return; }
    if (first === "words" || first === "word" || first === "transcript") { await words(tail); return; }
    if (first === "reading" || first === "read" || first === "sense" || first === "sentiment") { await reading(tail); return; }
    if (first === "sample" || first === "check") { await checkSample(tail); return; }
    if (first === "clear" || first === "forget") {
      var w = "";
      var parts = tail.split(/\s+/);
      if (parts.length && /^(words|transcript|reading|sample)$/i.test(parts[parts.length - 1])) { w = parts.pop(); tail = parts.join(" "); }
      await clear(tail, w);
      return;
    }
    if (first === "ask") {
      var src = "", q = tail;
      var i = tail.indexOf("::");
      if (i !== -1) { src = tail.slice(0, i).trim(); q = tail.slice(i + 2).trim(); }
      await ask(src || busId(), q);
      return;
    }
    say(help());
  }

  function describe() {
    var M = media();
    var withWords = 0, withReading = 0;
    try {
      var ids = (M && M.list) ? M.list() : [];
      ids.forEach(function (id) {
        var r = M.get(id);
        if (!r || !/^audio\//.test(String(r.mime || ""))) return;
        if (r.transcript) withWords++;
        if (r.reading) withReading++;
      });
    } catch (e) { }
    return "THE WORDS ON A SOUND (src/js/hear.js) :: THE GOOGLE (GEMINI) KEY\n"
      + "  KEY          :: " + (bypassedHere() ? "BYPASSED IN THE KEYS PANEL - NOTHING IS SENT" : (held() ? "HELD - the same key as her eyes and her ears" : "NOT HELD - store one in the KEYS panel")) + "\n"
      + "  ASKED FOR    :: " + help().split("\n")[0].replace("USAGE: ", "") + "\n"
      + "  THE ROAD     :: the audio is reduced HERE, on this device (mono " + Math.round(RATE / 1000) + " kHz, at most " + mmss(SECONDS) + "), and those seconds are sent to a model this key can reach; the file is never uploaded or changed\n"
      + "  LAST ANSWERED:: words: " + (settings.wordsModel || "nothing yet") + " \u00b7 reading: " + (settings.readModel || "nothing yet") + "\n"
      + "  ON THE RECORD:: " + withWords + " voice" + (withWords === 1 ? " CARRIES ITS" : "S CARRY THEIR") + " WORDS, "
      + withReading + " " + (withReading === 1 ? "CARRIES" : "CARRY") + " A READING (/gallery vox)\n"
      + "  A REFUSAL    :: reported in its own words, nothing written, nothing rewritten to get past it"
      + (busy ? "\n  RIGHT NOW    :: reading " + busyWhat : "");
  }

  /* ---- boot ---------------------------------------------------------------- */

  function start() {
    load();
  }

  window.hear = {
    // the door
    words: words, reading: reading, ask: ask, checkSample: checkSample, clear: clear,
    // for src/js/attach.js: the words of a file that is not a record, in one call, silently
    text: async function (blob, mime, name, opts) {
      var r = await words({ blob: blob, mime: mime, name: name }, { quiet: true });
      if (!r.ok) {
        return { error: r.policy ? ("GEMINI WOULD NOT READ IT (" + r.policy.reason + ")") : (r.error || "no model would read it"), policy: r.policy ? r.policy.reason : "", policyText: r.policy ? (r.policy.message || "") : "" };
      }
      // IT WAS READ AND THERE ARE NO WORDS IN IT. That is a real answer, not a failure of the road -
      // so it is handed back as one, in words plainly enough for the attachment receipt to print,
      // rather than as an empty string the caller has to guess about.
      if (!r.speech) {
        return { error: "NO SPEECH WAS FOUND IN IT (READ AS SOUND BY GEMINI - " + r.model + " - AND NO WORDS WERE HEARD, SO NONE WERE INVENTED)", speech: false, engine: "GEMINI (" + r.model + ")" };
      }
      return { text: r.text, engine: "GEMINI (" + r.model + ")", model: r.model, speech: true };
    },
    // the primitive, exposed so nothing else has to grow a second copy of it
    reduce: reduce,
    // the stage rows for a voice's full stage (src/js/images.js)
    paintStage: paintStage,
    // the command surface
    command: command, help: help, describe: describe, report: function () { say(describe()); },
    powers: powers,
    state: function () {
      return {
        key: held(), wordsModel: settings.wordsModel, readModel: settings.readModel,
        busy: busy, busyWhat: busyWhat, rate: RATE, seconds: SECONDS,
      };
    },
    isLoaded: function () { return loaded; },
  };

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);
})();
