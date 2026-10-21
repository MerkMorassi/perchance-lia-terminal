window.voice = (function () {
  "use strict";

  /* VOICE - her audible voice. TTS out, and the microphone in.

     WHAT IT IS
     The terminal talks in text. This module gives LIA a mouth and ears, under two keys beside
     SEND - and each key is named from Patrikios' own side of the glass (he relabelled them,
     2026-09-24: "Talk, I speak my message. Listen, she speaks out loud"):

       TALK    the microphone, for ONE utterance of his - the transcript drops into the input box
               (auto-sending it unless micAuto is off). Press again to stop it, and what it heard
               goes at once: pressing the key again is his own word that he has finished.
       LISTEN  she reads her newest reply out loud. Press it again while an audition is playing to
               stop the audition.

     Three engines:

       browser     the browser's own speechSynthesis voices. Instant, offline, free, no key.
       elevenlabs  her real voice, through the ElevenLabs API with the key held in the keyring.
       kokoro      THE LOCAL VOICE (src/js/kokoro.js, added 2026-09-30): a neural narrator fetched
                   ONCE per browser (about 90MB) that then runs inside this page in a worker. No key,
                   no account, no plan, no per-character bill, and no network once the model is here.
                   It brings 28 voices of its own (15 female) with the provider's own grades, and it
                   is FREE AND SLOW - about 2x real time on this machine - so it carries a ceiling of
                   its own and is offered as a narrator and a voice to AUDITION rather than as the
                   engine her conversation runs on.

     Engine is `auto` by default: if an ElevenLabs key is held she uses her real voice, otherwise
     the browser's. A failed ElevenLabs call falls back to the browser voice rather than going
     silent, and says why. KOKORO IS NEVER CHOSEN BY `auto` - it is slower than real time and a
     conversation cannot wait on it - so it is opt-in, one command away (/voice engine kokoro), and
     her voice is not changed by its existing. A failed local call falls back the same way the paid
     one does: to this browser's voice, with the reason printed.

     GROUNDING
     Nothing here writes or invents words. What she speaks is the reply she already gave, which was
     built the same way every other reply is - the LOREPACK retrieved against this turn, canon held
     always, the role block and her worn traits in the system prompt. Voice output is the last step
     of that pipeline, not a second one beside it. /voice speak <TEXT> is the only way to make her
     say something the terminal did not just generate.

     THE DESIGNS (src/voice/voices.json)
     Which voices to prefer, how slow, how low - per role. BARBELO is slow and low; off stage she is
     closer and quicker. Every one of those numbers can be overridden on this device (kv
     lia_settings / voice), and the whole file can be edited in src/ to change the default for good.

     WHAT SHE SOUNDS LIKE, AND WHETHER THIS ACCOUNT CAN SPEAK IT
     The design file also carries two tables that are about the PROVIDER rather than the role: the
     MODELS ElevenLabs speaks with (with what each one was measured to cost, and which two are
     deprecated), and the PROFILES - a profile being the whole voice at once, a voice id + model +
     settings set taken from a real agent configuration Patrikios built in the ElevenLabs Agent UI.
     /voice models and /voice profile print them; /voice model <ID> and /voice profile <NAME> apply
     them to the role on stage; /voice model default and /voice profile reset put the shipped design
     back. A profile carries its own measurement, so a voice this plan cannot speak is applied with
     the reason attached rather than failing in the middle of a sentence - and every refusal is
     translated before it is printed (paid_plan_required, quota_exceeded, missing_permissions,
     voice_not_found, unsupported_model), because those five mean five different things and only one
     of them is about the key. Also per-role: the MODEL is half of the cost, so a refusal names the
     model it was asked to spend on.

     SECRETS
     The ElevenLabs key is never handled here: requests go through window.keyring.request, which
     attaches it from the keyring and nowhere else. Nothing in this module prints a key, and the
     voice list it caches holds names and ids only.

     THE IPHONE (AND ANY OTHER TOUCH DEVICE)
     Two things on a phone are gated behind the first touch, and both are handled here. The browser's
     voice LIST is empty until the page has been touched, so it is read again on the first gesture -
     otherwise a phone would report no voices at all. And neither speechSynthesis nor an <audio>
     element may START without a gesture; her replies never are one (they arrive from the network),
     so a space at volume 0 and one muted frame of silence are spent on the first tap, after which
     auto-read and the live channel can speak for themselves. The BEST voice a machine holds is taken
     over the first name that matches, and /voice best hands it over without his having to read a
     hundred names. SIRI IS NOT REACHABLE - Apple does not expose Siri's voice to web pages, so the
     ceiling is a downloaded "Enhanced"/"Premium" system voice, and ElevenLabs is the way past it.

     Commands: /voice · /voice speak [TEXT] · /voice stop · /voice engine <auto|browser|elevenlabs|kokoro>
               /voice kokoro [status | voices | voice <NAME|#> | warm | say <TEXT> | audition [N] | device <wasm|webgpu> | release]
               /voice auto on|off · /voice voices [refresh] · /voice best · /voice voice <ID|NAME>
               /voice browser <NAME|#> · /voice try <NAME|#> [TEXT] · /voice audition
               /voice rate <n> · /voice pitch <n> · /voice pitch <n> <NAME|#>
               /voice pitch clear <NAME|#> · /voice live [on|off] · /voice live text [on|off]
               /voice mic on|off · /voice speech append|overwrite (whether a transcript ADDS TO
                                                       words already waiting, or REPLACES them -
                                                       append is the safe default)
               /voice hold <MS>   (how long the room must be quiet before what you
                                                       said is sent - the end of YOUR turn)
               /voice tail <MS>                       (the EXTRA quiet asked while the recogniser
                                                       has not committed the last thing it heard -
                                                       /voice tail auto makes it follow the hold)
               /voice level [<0-1>|off]               (how loud the room has to be for the meter to
                                                       call it SOUND - see THE ROOM HEARS YOU)
               /voice silence [status|on|off|poetic|awkward|thresh|gate]
                                                       (the pregnant pause - her lamp stays lit past
                                                       the last sound until the meter yields the turn)
               /voice mode <companion|drive|night|studio>
                                                       (one word sets hold, tail, room, print and
                                                       pause for where you are - never her voice)
               /voice models · /voice model <ID|default>  (which model earns the words, and what each
                                                       one was measured to cost)
               /voice profile [<NAME>]                (the IDEAL voice - a voice id, a model and a
                                                       settings set configured in the ElevenLabs
                                                       Agent UI and recorded in the design file)
               /voice list · /voice reset

     THE LIVE CHANNEL is the MICROPHONE button in the deck: it keeps the microphone open, sends what
     Patrikios says as a turn the moment he stops, and speaks her reply - a conversation, no typing.
     It is half duplex on purpose: the ears are shut for the whole of her turn, because
     SpeechRecognition has no echo cancellation and an open microphone during playback would let her
     hear herself and answer herself forever. Press the microphone while she speaks to hush her and
     stay in the channel.
     The ECHO GUARD is the second lock on the same door: every line she speaks aloud is remembered, and
     a transcript that is mostly a re-hearing of it is refused rather than filed - so her own voice,
     mangled by the recogniser, can never arrive as something Patrikios said. Do not remove it.

     THE ROOM HEARS YOU (2026-09-27). Everything above about the end of his turn was inferred from the
     RECOGNISER - from when it handed a result over, and whether that result was final. That is a guess
     about the room made by a thing whose whole job is deciding what words to write down, and it guesses
     wrong in the one direction that matters: it finalises at every breath, so a pause in the middle of a
     sentence is indistinguishable from the end of one ("it keeps cutting me off and sending too soon",
     his word - and the same complaint the adaptive hold of 2026-09-24 was already answering). So the
     room is now measured directly as well: while the microphone is open a SECOND stream is opened on the
     same device through a Web Audio analyser, and the actual level in the room is read about sixteen
     times a second. Sound of any kind - a word, a breath, a chair, his voice arriving at the recogniser
     late - resets the end-of-turn clock exactly as a word of his does, and nothing of his is sent while
     there is still a voice in the room. It is the difference between "the recogniser has not handed
     anything over for three seconds" and "the room has been quiet for three seconds". The meter costs
     nothing, uses no network, and never writes a word: it is a number. If it cannot be opened (a browser
     that refuses a second stream, or a room whose floor noise sits above the threshold) everything works
     exactly as it did - the holds are the floor and the meter is only ever extra patience. `/voice level
     0` turns it off outright, and the sound of it is painted on the microphone keys while it runs.

     THE INTERCOM (2026-09-23). TALK, LISTEN and the live microphone are three keys on ONE intercom,
     and one voice is on the line at a time. The lamp beside them names whose: STANDBY, HER VOICE (she
     is speaking - LISTEN is locked, so a press cannot cut her off mid-sentence, and TALK is shut so
     her own voice is never replayed into an open microphone), HER TURN (a reply is being made), YOUR
     VOICE (the microphone is open - TALK, or the live channel), HOLDING (he spoke while she had the
     floor and his words are waiting), AUDITION (where LISTEN is the stop - it was the TALK key that
     carried that job until he renamed the two keys, 2026-09-24, and the behaviour did not change with
     the names). The lock is enforced in toggleSpeak()/toggleMic() and painted by setUi(); /voice stop
     is still the deliberate way to silence her, and the live microphone still hushes her while the
     channel is open. `airState()` is the single answer all of it is read from.
     ------------------------------------------------------------------ */

  var MANIFEST = "src/voice/voices.json";
  var FOLDER = "lia_settings";
  var KEY = "voice";
  var EL = "https://api.elevenlabs.io";

  var cfg = null;              // the shipped design (voices.json)
  var ready = false;
  var loadP = null;

  // Device state. Anything here overrides the shipped design for this browser only.
  var store = {
    engine: "",                // "" = the manifest's own default
    autoRead: null,            // null = the manifest's own default
    micAuto: null,
    speechAdd: null,           // null = append: speech ADDS to waiting words, never replaces
    liveText: null,            // null = the live channel prints the conversation (text on)
    mode: "",
    chan: "",                  // the conversation's mode: "" = TEXT, "radio" = RADIO SILENCE, "talk" = TALK
    level: null,               // null = the shipped threshold; 0 = the meter is off; else 0-1
    roles: {},                 // roleId -> { browser: {name, rate, pitch}, elevenlabs: {voiceId, model, settings} }
    resolved: {},              // roleId -> { id, name, at }  (an ElevenLabs voice auto-picked for that role)
    voices: null,              // last /v1/voices list: [{ id, name, category }] - no secrets in it
    voicesAt: 0,
    hidden: [],                // browser voice names taken OFF the list of what may be chosen here
    maxChars: null,            // null = the shipped cap on the FREE roads (this browser, and the wire)
    elevenMaxChars: null,      // null = the shipped cap on ELEVENLABS, which bills by the character
    kokoroMaxChars: null,      // null = the shipped cap on THE LOCAL VOICE, which is slower than real time
    kokoroDevice: ""           // "" = the shipped build (q8 on wasm); "webgpu" is the faster, lower-fidelity one
  };

  var speaking = false;
  var barbCallsignOn = true;
  var listening = false;       // a recogniser session is open: TALK, or the live channel, is hearing him
  var micHush = false;         // one-shot: the next microphone opening says nothing (the intercom key)
  var holding = false;         // true through an audition, so the LISTEN button reads STOP the whole way
  var utt = null;              // current SpeechSynthesisUtterance
  var current = null;          // current Audio element (ElevenLabs playback)
  var recognition = null;
  var playToken = 0;           // bumped to invalidate an in-flight speak()
  var last = { text: "", role: "", ts: 0 };
  var browserVoices = [];
  var pending = "";            // the last transcription, waiting to be sent or edited
  var live = false;            // THE LIVE CHANNEL: the microphone stays open and every reply is spoken
  var liveBusy = false;        // her turn is in flight - from the moment his words are sent until she speaks
  var liveBusySince = 0;       // when that flight started, so a refusal can say how long it has waited
  var liveUntil = 0;           // safety: a turn that never speaks releases the channel anyway
  var liveTicker = null;       // the watcher that keeps the channel open and half duplex
  var liveQueue = [];          // replies of hers waiting for the room (see drainLive)
  var liveDraining = false;    // her mouth is already working through that queue
  var discard = false;         // this recognition session is being abandoned: what it heard is not delivered
  // WHAT SHE HAS SAID OUT LOUD, so her own voice coming back off the speakers is recognisable as hers.
  // SpeechRecognition has no echo cancellation: a microphone open anywhere near her playback WILL
  // transcribe her, and the words come back mangled ("Patrikios" arrives as "how to kiss"), so they
  // read as a sentence he never typed. The guards below shut the ears for the whole of her turn; this
  // is the belt to those braces - a transcript that is mostly a re-hearing of what she just said is
  // never delivered as a turn from him. It is a memory of her own voice, nothing else.
  var voiceTailUntil = 0;      // ignore the microphone just after she stops - the speaker tail is still hers
  var lastSpeakEnd = 0;        // when her voice last stopped, so the text guard knows when echo is possible
  var ECHO_MS = 3000;          // after her voice has been gone this long, resemblance is conversation, not echo
  var earSalvage = null;       // the open recogniser's buffer, so shutting the ears never eats his sentence
  // WHEN HIS TURN IS OVER. The recogniser finalises at every breath, so sending on the first final
  // result cuts him off mid-sentence (and starts her answering over him). What he said is therefore
  // held until the room has been quiet, and while she has the floor it is held longer still - so
  // talking over her is not lost, it is simply taken the moment she is done.
  //
  // A SINGLE NUMBER WAS NOT ENOUGH (2026-09-24). It used to be 2000ms of quiet, measured from the last
  // result the recogniser handed over - and a breath inside a sentence arrives as a FINAL result
  // exactly like the end of one, so two seconds of thinking read as the end of his turn and she
  // answered over him ("it cuts off, sends before I am even done", his word). The pause is now the
  // FLOOR of the wait, and two things he cannot help doing stretch it: keeping a clause long, and
  // stopping on a word that cannot end a sentence. Neither can lose a word of his - the wait only
  // ever applies to silence, and any word of his resets it - so an unlikely hit costs a moment of
  // patience and nothing else. AND SINCE 2026-09-27 THE SILENCE ITSELF IS MEASURED: the room is
  // listened to directly (THE ROOM HEARS YOU, in the header), so a pause at a breath cannot read as
  // the end of a sentence even when the recogniser has already called it final.
  var hearSession = 0;         // one id per recogniser session, so a hold can be replaced but never merged
  var talkResumes = 0;         // sessions re-opened after the recogniser ended one by itself, this press
  var TALK_RESUME_MAX = 20;    // the cap on UNHELD re-opens (a one-shot TALK left open on a noisy line);
                               // a finger held down on the intercom key is not counted against it
  var listenGen = 0;           // every real open or shut of the microphone moves this on: a re-open
                               // scheduled by a session that has since ended (he lifted, another session
                               // opened) is stale and stays shut. The intercom key's held re-open reads it.
  var heldReopenAt = 0;        // when a held re-open was last scheduled or waited (see reopenWhileHeld):
                               // the key's press-check reads it, so a session ending in the same beat as
                               // the check does not stand down a finger the voice lane is re-opening behind.
  var holdMsDefault = 5000;    // the shipped floor: long enough for a mid-sentence breath
  var holdMs = 5000;           // the floor of the quiet before what he said is sent (knob: /voice hold)
  var HOLD_MIN = 400, HOLD_MAX = 8000;      // what /voice hold accepts
  var TAIL_MAX = 3000;         // most /voice tail accepts
  var TURN_MAX = 9000;         // the most the adaptive extensions may stretch the quiet to
  var TURN_WAIT_MAX = 9000;    // the most SHE will wait, mid-reply, for the room to go quiet
  var SEND_GRACE = 900;        // how long before the wait ends that she says so out loud
  var TURN_VERSION = 3;        // the end-of-turn rule; 3 is the adaptive one with a 5s floor (see load())
  var heardAt = 0;             // when the microphone last handed over anything of his
  var holdCounted = false;     // the visible ending has been announced for this clause
  // WORDS A SENTENCE DOES NOT END ON. A clause that stops on one of these stopped mid-thought, and
  // the wait is stretched so a breath there cannot become the end of his turn. It is a heuristic and
  // is treated as one - it never shortens a wait, and it never changes a word of what he said.
  var DANGLING = ("and or but so because if when while that which who whom whose the a an of to in on at " +
    "with from for by as than then into is are was were be been being am have has had do does did will " +
    "would can could should shall may might must my your his her its our their this these those there " +
    "here not no i you he she it we they about over under after before until though although unless " +
    "whether how what why where want going trying like").split(" ");
  // THE UNCOMMITTED TAIL. `holdMs` alone assumes the recogniser has committed what it heard (a FINAL
  // result, not an INTERIM one). While the last thing it handed over is still INTERIM it is, by
  // definition, still being decided - so the quiet asked of the room is the ordinary hold PLUS this,
  // and a breath inside a sentence cannot end the turn. `/voice tail <MS>` sets it outright; left
  // alone it follows the hold (a third of it, never less than half a second, never more than 1.2s).
  // It is not a second chance to speak, only a longer wait where it costs nothing.
  var holdTail = null;         // null = derived from holdMs (see holdTailMs)
  var holdSettled = true;      // was the newest thing heard a FINAL result, or is he still mid-word?
  var holdParts = [];          // [{ id, text }] - what is waiting to be sent, one entry per mic session
  var holdAt = 0;              // when the last word of it arrived
  var holdFrom = "";           // "live" or "talk" - which channel it was heard on
  var holdTimer = null;
  var holdWarned = false;      // one notice per held clause, not one per tick
  var takeDefer = false;       // the intercom key's review latch (src/js/intercom.js): while set, held
                               // words are NOT taken - they stay in the input box, streaming, until HE
                               // sends. Only the intercom lane sets and clears it, with the hold.
  var talkWarned = false;      // one notice per microphone session that lost words, not one per result
  var liveWarned = false;      // the same, for the live channel's recogniser
  var wireFloorWarned = false; // the same, for the wire's own final while she has the floor
  var consumedSids = {};       // sessions whose words have just been taken: their next clause starts over

  // ---- THE LIVE WIRE (src/js/live.js, window.live) -------------------------
  //
  // The transport under the live channel. When a Google (Gemini) key is held the channel's ears are
  // a CONTINUOUS stream to a `...-transcribe-live` session (no recogniser session to end, no breath
  // mistaken for the end of a sentence - the model's own voice-activity says where the turn ends)
  // and her mouth is a streamed 24kHz line from a `...-live` session, which is OURS to stop. The
  // hold, the echo guard, the record, her brain and every lane that reads them are unchanged: this
  // only changes WHO the two ends of the conversation are. See src/js/live.js for the how and the
  // measurements, and /voice wire for what is in force.
  var wireOn = false;          // the wire is carrying this channel
  var wireSeq = 0;             // one id per turn of his, so a hold can never merge two of them
  var wireRms = 0;             // the room's level, off the wire's own capture
  var wireLoudAt = 0, wireQuietAt = Date.now();
  function liveWire() { return window.live || null; }
  function wireUsable() {
    var W = liveWire();
    if (!W || !W.available || !W.available()) return false;
    var s = (W.settings ? W.settings() : {}) || {};
    return s.on !== false;
  }
  function wireTurnId() { return "wire-" + wireSeq; }

  // ---- the room hears you (the microphone level meter) ---------------------
  //
  // A SECOND stream on the same microphone, through an analyser, read on a timer: the actual loudness
  // of the room, about sixteen times a second. It exists for one reason - the recogniser is not
  // evidence that he has stopped talking, and this is. A word of his resets the hold; so does ANY
  // SOUND, and nothing of his is sent while the room is loud. Nothing is recorded, nothing is
  // uploaded, and no word is ever read from it: it is a number between 0 and 1.
  //
  // THE THRESHOLD is what counts as SOUND. 0.02 of full scale is a voice at normal speaking distance
  // with a typical microphone; a quiet room sits under 0.01 and a fan may sit near 0.02. `/voice level
  // <0-1>` moves it and `/voice level off` (0) stops the meter being used at all.
  //
  // A LOUD ROOM CANNOT HOLD THE TURN FOREVER. If the room never goes quiet - a fan, a TV, music, or a
  // speaker that is somehow always on - the ordinary holds take over after LEVEL_MAX, because an
  // end-of-turn rule that a noise can suspend permanently is a door with no handle.
  //
  // IF IT CANNOT BE OPENED AT ALL (a browser that refuses a second stream on a device the recogniser
  // already holds, or no Web Audio) it is silent about it after one console line and the holds below
  // behave exactly as they did before it existed. It is only ever EXTRA patience.
  var LEVEL_DEFAULT = (typeof LIA_VOICE_LEVEL === "number" && LIA_VOICE_LEVEL >= 0 && LIA_VOICE_LEVEL < 1) ? LIA_VOICE_LEVEL : 0.02;
  var LEVEL_TAIL = (typeof LIA_VOICE_LEVEL_TAIL === "number" && LIA_VOICE_LEVEL_TAIL >= 0) ? Math.round(LIA_VOICE_LEVEL_TAIL) : 350;
  var LEVEL_MAX = (typeof LIA_VOICE_LEVEL_MAX === "number" && LIA_VOICE_LEVEL_MAX >= 5000) ? Math.round(LIA_VOICE_LEVEL_MAX) : 45000;
  var LEVEL_TICK = 60;         // how often the room is read (about sixteen times a second)
  var levelCtx = null;         // the AudioContext of the meter (null = it is not running)
  var levelStream = null;      // its own stream on the microphone
  var levelAnalyser = null;
  var levelBuf = null;
  var levelRms = 0;            // the newest reading (0-1)
  var levelLoudAt = 0;         // when the room was last above the threshold
  var levelQuietAt = Date.now(); // when it was last below it (see LEVEL_MAX)
  var levelTimer = null;
  var levelOff = "";           // why the meter is not running, if it was asked for and could not
  var levelBad = false;        // one console line per page, not one per session
  var levelStarting = false;   // a getUserMedia for the meter is in flight
  var levelPaint = "";         // the last painted state, so the buttons are not touched every 60ms

  function el(id) { return document.getElementById(id); }
  function keyring() { return window.keyring || null; }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function num(v, def, lo, hi) { v = Number(v); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, v)); }
  // iPhone / iPad. iPadOS reports itself as a Mac, so the touch-point count is the tell.
  function isIos() {
    var ua = String((navigator && navigator.userAgent) || "");
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }

  // ---- loading -------------------------------------------------------------

  function mergeRole(base, over) {
    var out = {
      note: (base && base.note) || "",
      browser: Object.assign({}, (base && base.browser) || {}),
      elevenlabs: Object.assign({}, (base && base.elevenlabs) || {}),
      kokoro: Object.assign({}, (base && base.kokoro) || {})
    };
    if (over) {
      if (over.browser) Object.keys(over.browser).forEach(function (k) {
        // A one-voice pitch is merged name-by-name, not replaced, so an override kept on this device
        // adds to the shipped design instead of hiding the rest of it - and clearing one puts the
        // design's value back rather than dropping to the role's.
        if (k === "voicePitch" && out.browser.voicePitch && over.browser.voicePitch) {
          var m = Object.assign({}, out.browser.voicePitch);
          Object.keys(over.browser.voicePitch).forEach(function (n) {
            if (over.browser.voicePitch[n] == null) delete m[n];
            else m[n] = over.browser.voicePitch[n];
          });
          out.browser.voicePitch = m;
          return;
        }
        out.browser[k] = over.browser[k];
      });
      if (over.elevenlabs) Object.keys(over.elevenlabs).forEach(function (k) { out.elevenlabs[k] = over.elevenlabs[k]; });
      // A role's LOCAL voice override is one field (`voice`), so a device that picked one for a role
      // keeps everything else about that role's local block as shipped.
      if (over.kokoro) Object.keys(over.kokoro).forEach(function (k) { out.kokoro[k] = over.kokoro[k]; });
    }
    return out;
  }

  function defaults() {
    var d = (cfg && cfg.roles && cfg.roles.default) || {};
    return {
      engine: (cfg && cfg.engine) || "auto",
      autoRead: !!(cfg && cfg.autoRead),
      micAuto: !!(cfg && cfg.micAuto),
      limits: (cfg && cfg.limits) || { maxChars: 24000, elevenMaxChars: 4000, chunkChars: 220, elevenRequestMax: 10000, cacheEntries: 12 },
      elevenlabs: (cfg && cfg.elevenlabs) || {},
      kokoro: (cfg && cfg.kokoro) || {},
      mic: (cfg && cfg.mic) || { lang: "en-US" },
      audition: (cfg && cfg.audition) || {},
      sex: (cfg && cfg.sex) || null,
      roles: (cfg && cfg.roles) || {},
      roleDefault: d
    };
  }

  async function load() {
    if (loadP) return loadP;
    loadP = (async function () {
      try {
        var res = await fetch(MANIFEST, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        cfg = await res.json();
      } catch (e) {
        console.warn("voice design unreadable, using built-in defaults", e);
        cfg = { pack: "VOICE", version: 1, engine: "browser", limits: { maxChars: 24000, elevenMaxChars: 4000, chunkChars: 220, elevenRequestMax: 10000 }, roles: { default: { browser: { voices: ["Google UK English Female", "Google US English", "Female"], lang: "en-GB", rate: 1, pitch: 1 }, elevenlabs: {} } }, elevenlabs: { model: "eleven_multilingual_v2", outputFormat: "mp3_44100_128", settings: {} }, mic: { lang: "en-US" } };
      }
      var k = kv();
      if (k) {
        try {
          var saved = await k.get(KEY);
          if (saved && typeof saved === "object") {
            if (typeof saved.engine === "string") store.engine = saved.engine;
            if (typeof saved.autoRead === "boolean") store.autoRead = saved.autoRead;
            if (typeof saved.micAuto === "boolean") store.micAuto = saved.micAuto;
            if (saved.speechAdd === "overwrite" || saved.speechAdd === "append") store.speechAdd = saved.speechAdd;
            if (typeof saved.liveText === "boolean") store.liveText = saved.liveText;
            if (typeof saved.mode === "string") store.mode = saved.mode;
            if (saved.chan === "radio" || saved.chan === "talk") store.chan = saved.chan;
            if (typeof saved.silence === "boolean") store.silence = saved.silence;
            if (saved.silencePoetic != null && isFinite(Number(saved.silencePoetic))) store.silencePoetic = Math.round(Number(saved.silencePoetic));
            if (saved.silenceAwkward != null && isFinite(Number(saved.silenceAwkward))) store.silenceAwkward = Math.round(Number(saved.silenceAwkward));
            if (saved.silenceThresh != null && isFinite(Number(saved.silenceThresh))) store.silenceThresh = Number(saved.silenceThresh);
            if (saved.silenceGate != null && isFinite(Number(saved.silenceGate))) store.silenceGate = Number(saved.silenceGate);
            if (saved.level != null && isFinite(Number(saved.level))) store.level = Math.max(0, Math.min(0.99, Number(saved.level)));
            if (saved.holdMs != null && isFinite(Number(saved.holdMs))) holdMs = Math.max(HOLD_MIN, Math.min(HOLD_MAX, Number(saved.holdMs)));
            // THE END-OF-TURN MIGRATION. Rule 1 was a flat 2000ms quiet; rule 2 stretched it (see
            // holdQuietMs) with a 3500ms floor; rule 3 keeps the same stretches on a 5000ms floor,
            // because a mid-sentence breath was still landing inside 3.5s and handing her the floor
            // too soon ("cut off when I speak"). A device still holding an old shipped number has
            // never touched the knob - so it is lifted to rule 3's own floor. A hand-moved number
            // is left alone; the `turn` stamp makes this happen once.
            if (saved.turn !== TURN_VERSION && (saved.holdMs == null || Number(saved.holdMs) === 2000 || Number(saved.holdMs) === 3500)) holdMs = holdMsDefault;
            if (saved.holdTail != null && isFinite(Number(saved.holdTail))) holdTail = Math.max(0, Math.min(TAIL_MAX, Number(saved.holdTail)));
            if (saved.roles && typeof saved.roles === "object") store.roles = saved.roles;
            if (saved.resolved && typeof saved.resolved === "object") store.resolved = saved.resolved;
            if (Array.isArray(saved.voices)) store.voices = saved.voices;
            if (saved.voicesAt) store.voicesAt = Number(saved.voicesAt) || 0;
            // WHICH VOICES ARE ON THE MENU (see hiddenNames below). Names are kept as the browser
            // gave them, lowercased: a voice the machine no longer has simply never matches again.
            if (Array.isArray(saved.hidden)) {
              store.hidden = [];
              saved.hidden.forEach(function (n) {
                var s = String(n == null ? "" : n).trim().toLowerCase();
                if (s && store.hidden.indexOf(s) === -1) store.hidden.push(s);
              });
            }
            // HOW MUCH SHE MAY SAY WITHOUT BEING CUT OFF (see limitsNow). Only a number he has
            // actually set lives here; absent means the shipped ceiling, so a device that predates
            // the knob keeps the design's own answer.
            if (saved.maxChars != null && isFinite(Number(saved.maxChars))) store.maxChars = Math.round(Number(saved.maxChars));
            if (saved.elevenMaxChars != null && isFinite(Number(saved.elevenMaxChars))) store.elevenMaxChars = Math.round(Number(saved.elevenMaxChars));
            if (saved.kokoroMaxChars != null && isFinite(Number(saved.kokoroMaxChars))) store.kokoroMaxChars = Math.round(Number(saved.kokoroMaxChars));
            if (saved.kokoroDevice === "webgpu" || saved.kokoroDevice === "wasm") store.kokoroDevice = saved.kokoroDevice;
          }
        } catch (e) { console.warn("voice settings unreadable", e); }
      }
      warmVoices();
      ready = true;
      watchAir();   // the air lamp and the intercom locks (see airState)
      setUi();
      return state();
    })();
    return loadP;
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try {
      await k.set(KEY, {
        engine: store.engine, autoRead: store.autoRead, micAuto: store.micAuto, speechAdd: store.speechAdd, liveText: store.liveText,
        mode: store.mode, chan: store.chan,
        level: store.level,
        holdMs: holdMs,
        holdTail: holdTail,
        turn: TURN_VERSION,
        hidden: store.hidden, maxChars: store.maxChars, elevenMaxChars: store.elevenMaxChars,
        kokoroMaxChars: store.kokoroMaxChars, kokoroDevice: store.kokoroDevice,
        silence: store.silence, silencePoetic: store.silencePoetic, silenceAwkward: store.silenceAwkward,
        silenceThresh: store.silenceThresh, silenceGate: store.silenceGate,
        roles: store.roles, resolved: store.resolved, voices: store.voices, voicesAt: store.voicesAt
      });
      return true;
    } catch (e) { console.warn("voice settings not saved", e); return false; }
  }

  // The browser only reveals its voice list after the first call and a voiceschanged event - and iOS
  // is worse: until Patrikios has touched the page, getVoices() answers with an EMPTY LIST, so a
  // phone would otherwise report "0 VOICES AVAILABLE" and match no voice at all. The list is
  // therefore read again on the first gesture.
  //
  // THE SAME FIRST TOUCH IS WHAT OPENS HER MOUTH. iOS refuses to start audio that was not begun
  // inside a gesture - and her replies never are: they arrive from the network, after the finger has
  // gone. So one silent utterance and one muted frame of audio are spent on the first tap, and every
  // reply after it (auto-read, the live channel, the ElevenLabs <audio> element) is allowed to
  // speak itself. Nothing is heard: the utterance is a space at volume 0, the audio is 8 samples of
  // silence.
  var unlocked = false;
  var SILENCE = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";
  function grabVoices() {
    if (typeof speechSynthesis === "undefined") return;
    browserVoices = speechSynthesis.getVoices() || [];
    setUi();
  }
  function unlockSpeech() {
    if (unlocked) return;
    unlocked = true;
    grabVoices();
    if (typeof speechSynthesis === "undefined") return;
    try {
      // A silent AUDIO element: the ElevenLabs voice is an <audio> played after a round-trip, and
      // iOS blocks that for the same reason it blocks speech.
      var a = new Audio(SILENCE);
      a.muted = true;
      a.setAttribute("playsinline", "");
      var p = a.play();
      if (p && p.then) p.then(function () { try { a.pause(); } catch (e) {} }, function () {});
    } catch (e) {}
    try {
      if (speaking) return;                       // she is already talking: nothing to unlock
      var u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.rate = 1; u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function warmVoices() {
    if (typeof speechSynthesis === "undefined") return;
    grabVoices();
    try { speechSynthesis.addEventListener("voiceschanged", grabVoices); } catch (e) { speechSynthesis.onvoiceschanged = grabVoices; }
    setTimeout(grabVoices, 400);
    setTimeout(grabVoices, 1500);
    setTimeout(grabVoices, 4000);
    ["pointerdown", "touchend", "keydown", "click"].forEach(function (ev) {
      document.addEventListener(ev, unlockSpeech, { once: true, passive: true });
    });
    // iOS pauses an utterance when the tab is put away and does not always resume it on the way
    // back - which used to leave her silent with the microphone still shut for her turn.
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      try { if (speaking || (typeof speechSynthesis !== "undefined" && speechSynthesis.paused)) speechSynthesis.resume(); } catch (e) {}
    });
  }

  // ---- who she sounds like ------------------------------------------------

  function roleIdNow(explicit) {
    if (explicit !== undefined && explicit !== null) return String(explicit);
    return (window.roles && window.roles.currentId) ? String(window.roles.currentId()) : "";
  }

  function roleLabel(roleId) {
    if (!roleId) return "LIA (OFF STAGE)";
    if (window.roles && window.roles.all) {
      var r = window.roles.get ? window.roles.get(roleId) : null;
      if (r) return String(r.title || r.id || roleId).toUpperCase();
    }
    return String(roleId).toUpperCase();
  }

  function design() { return defaults(); }

  function roleVoice(roleId) {
    var d = design();
    var base = d.roles[roleId] || d.roles.default || d.roleDefault;
    return mergeRole(base, store.roles[roleId]);
  }

  // The shipped palette of ElevenLabs voices (src/voice/voices.json). It exists because the
  // account's own voice list can only be read by a key created with the "voices read" permission:
  // without it, /voice voice <NAME> still has to work, and it does - against this list, which was
  // measured against a free account.
  function shippedVoices() {
    var d = design();
    return ((d.elevenlabs && d.elevenlabs.knownVoices) || []).slice();
  }

  function nameOfVoice(id) {
    if (!id) return "";
    var all = (store.voices || []).concat(shippedVoices());
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i].name || "";
    return "";
  }

  // WHICH MODEL, AND WHAT IT COSTS. ElevenLabs speaks with more than one model and they are not
  // priced alike, so the model is half of the voice decision and it belongs to the role (the design
  // holds a default; this device can override it per role). The table below is MEASURED rather than
  // assumed - see src/voice/voices.json, which carries the date and the probe behind every figure.
  function modelTable() {
    return (design().elevenlabs && design().elevenlabs.models) || null;
  }

  // A MODEL IS NOT A WHITELIST. The table is a record of what was measured; an id that is not in it
  // is still sent as given, because ElevenLabs adds models faster than this file is edited - it
  // simply arrives with a warning instead of a refusal, and a real refusal now names the model.
  function modelKnown(id) {
    var t = modelTable();
    if (!t) return false;
    var all = (t.accepted || []).concat(t.refused || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return true;
    return false;
  }

  function modelNow(roleId) {
    var v = roleVoice(roleId);
    var d = design();
    return v.elevenlabs.model || (d.elevenlabs && d.elevenlabs.model) || "eleven_multilingual_v2";
  }

  // THE IDEAL VOICE, as opposed to the shipped palette: what she SHOULD sound like, configured by
  // Patrikios in the ElevenLabs Agent UI rather than what a free plan happens to allow. One profile
  // is a voice id, a model and a settings set, plus the agent it came from and the measurement of
  // whether this account can actually speak it - so applying one is honest about the gap.
  function shippedProfiles() {
    return (design().elevenlabs && design().elevenlabs.profiles) || {};
  }

  function profileKeys() {
    return Object.keys(shippedProfiles()).filter(function (k) { return k !== "note"; });
  }

  function findProfile(want) {
    var w = String(want == null ? "" : want).trim().toLowerCase();
    if (!w) return null;
    var all = shippedProfiles();
    if (all[w] && w !== "note") return { key: w, profile: all[w] };
    var keys = profileKeys();
    for (var i = 0; i < keys.length; i++) {
      var p = all[keys[i]] || {};
      if (String(p.title || "").toLowerCase().indexOf(w) !== -1) return { key: keys[i], profile: p };
      if (String(p.model || "").toLowerCase() === w) return { key: keys[i], profile: p };
      if (String(p.voiceId || "").toLowerCase() === w) return { key: keys[i], profile: p };
    }
    return null;
  }

  function profileVoice(id) {
    var all = shippedProfiles();
    var keys = profileKeys();
    for (var i = 0; i < keys.length; i++) {
      var p = all[keys[i]] || {};
      if (p.voiceId && p.voiceId === id) return { id: id, name: String(p.title || keys[i]) };
    }
    return null;
  }

  function engineNow(roleId) {
    var want = store.engine || design().engine || "auto";
    var has = !!(keyring() && keyring().has("elevenlabs"));
    if (want === "browser") return "browser";
    if (want === "kokoro") return "kokoro";   // NEVER reached by `auto`: see the header
    if (want === "stream") return "stream";     // the kokoro model through the stream chips: also opt-in only
    if (want === "elevenlabs") return has ? "elevenlabs" : "browser";
    return has ? "elevenlabs" : "browser";
  }

  // HOW GOOD A VOICE IS, as far as a web page is allowed to know. Neither Apple nor Google offers a
  // quality field - the best a page gets is the name, whether the voice is served from the device,
  // and whether it is a cloud voice. The name carries the tier, though: the voices a phone ships are
  // the small ones, and the SAME voice downloaded at higher quality arrives as "<Name> (Enhanced)" or
  // "<Name> (Premium)" (iOS: Settings > Accessibility > Spoken Content > Voices). SIRI'S OWN VOICES
  // NEVER APPEAR HERE AT ALL - Apple does not give them to web pages - so these tiers are the ceiling
  // a page can reach, and ElevenLabs is the way past it.
  function voiceQuality(v) {
    var n = String((v && v.name) || "");
    if (/premium/i.test(n)) return 4;
    if (/enhanced|neural|natural|siri/i.test(n)) return 3;
    if (/(^|[^a-z])google([^a-z]|$)/i.test(n)) return 2;   // the network voices Chrome speaks through
    if (v && v.localService === false) return 2;           // a cloud voice: better than a device's small one
    return 1;
  }
  function qualityWord(v) {
    var q = voiceQuality(v);
    return q === 4 ? "PREMIUM" : q === 3 ? "ENHANCED" : q === 2 ? "HIGH" : "COMPACT";
  }
  // The best of a set: the highest tier, and within a tier a voice served from the device (it answers
  // instantly and works offline).
  function bestVoice(list) {
    var best = null;
    (list || []).forEach(function (v) {
      if (!v) return;
      if (!best) { best = v; return; }
      var q = voiceQuality(v), bq = voiceQuality(best);
      if (q > bq) { best = v; return; }
      if (q === bq && v.localService && !best.localService) best = v;
    });
    return best;
  }

  function pickBrowserVoice(v) {
    var list = browserVoices.length ? browserVoices : (typeof speechSynthesis !== "undefined" ? (speechSynthesis.getVoices() || []) : []);
    if (!list.length) return null;
    if (v && v.name) {
      var exact = null;
      for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === String(v.name).toLowerCase()) exact = list[i];
      if (exact) return exact;
    }
    var wants = (v && v.voices) || [];
    for (var w = 0; w < wants.length; w++) {
      var want = String(wants[w]).toLowerCase();
      var hits = [];
      for (var j = 0; j < list.length; j++) if (String(list[j].name).toLowerCase().indexOf(want) !== -1) hits.push(list[j]);
      // A name in the design matches more than one entry on a phone that has both the small voice and
      // its downloaded ENHANCED twin - so the BEST of the matches is taken, not the first. That is
      // what makes her sound better on an iPhone the moment he downloads a higher tier, with no
      // setting to change.
      if (hits.length) return bestVoice(hits);
    }
    var lang = String((v && v.lang) || "en").toLowerCase();
    var inLang = [], inEn = [];
    for (var m = 0; m < list.length; m++) {
      var vl = String(list[m].lang || "").toLowerCase();
      if (vl.indexOf(lang) === 0) inLang.push(list[m]);
      else if (/^en/i.test(vl)) inEn.push(list[m]);
    }
    return bestVoice(inLang) || bestVoice(inEn) || list[0] || null;
  }

  // The best voice she could ACTUALLY speak with: the highest tier among the voices in her own
  // language family, and within that tier her own locale preferred (so the British Mother does not
  // start speaking American just because both happen to be the same tier), then a voice served from
  // the device. A voice in a language she does not speak is never chosen, however good it is - a
  // desktop Chrome's raw list holds German, Polish and Hindi Google voices, all of them a high tier.
  function bestForRole(roleId) {
    var list = voicesHeld();
    if (!list.length) return null;
    var lang = String(((roleVoice(roleId || roleIdNow()).browser) || {}).lang || "en").toLowerCase();
    var family = lang.slice(0, 2) || "en";
    var en = list.filter(function (v) { return String(v.lang || "").toLowerCase().indexOf(family) === 0; });
    if (!en.length) return null;
    var top = 0;
    en.forEach(function (v) { top = Math.max(top, voiceQuality(v)); });
    var tier = en.filter(function (v) { return voiceQuality(v) === top; });
    var exact = tier.filter(function (v) { return String(v.lang || "").toLowerCase().indexOf(lang) === 0; });
    return bestVoice(exact.length ? exact : tier);
  }

  // ---- text preparation ----------------------------------------------------

  function prepare(text) {
    var s = String(text == null ? "" : text);
    s = s.replace(/\[\[[\s\S]*?\]\]/g, " ");        // any directive/vision line that survived
    // NARRATED PICTURES (the images.js extractVisions shapes). If one ever reaches her mouth -
    // a fallback missed, a second ask raced - it is said as nothing: prompts are shown in the
    // gallery, never spoken aloud, so these shapes are cut here at the last door before speech.
    s = s.replace(/\[(?:created an image|image created|generating image|image generation)[^\]]*\]/gi, " ");
    s = s.replace(/\((?:image creation triggered|image created|generating image|image generation)[^)]*\)/gi, " ");
    s = s.replace(/(^|\n)[ \t]*(?:VISION|IMAGE|RENDER|MAKE|PICTURE)\s*[:\-][^\n]*/gi, " ");
    s = s.replace(/<\/?[a-zA-Z][^>]*>/g, " ");      // stray markup
    s = s.replace(/[*_`#]+/g, " ");                 // markdown emphasis, headings, fences
    s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
    return s.trim();
  }

  // Cuts to `max`, and always at a SENTENCE END when the text has one to cut at - mid-thought only
  // when there is no full stop anywhere in what fits, and then `why` says so instead of the receipt
  // claiming a sentence end it did not find. The ellipsis is added only when the cut was mid-sentence.
  function truncate(text, max) {
    if (text.length <= max) return { text: text, cut: false, why: "" };
    var slice = text.slice(0, max);
    var m = slice.match(/[\s\S]*[.!?\u2026]["'\u201d)\]]?\s/);
    if (m && m[0].trim()) {
      var whole = m[0].replace(/\s+$/, "");
      if (whole.length > max * 0.35) return { text: whole.replace(/[,;:\s]+$/, ""), cut: true, why: "sentence" };
    }
    var sp = slice.lastIndexOf(" ");
    if (sp > 0) slice = slice.slice(0, sp);
    return { text: slice.replace(/[,;:\s]+$/, "") + "\u2026", cut: true, why: "word" };
  }

  // How much text one browser utterance carries. iOS is known to go quiet on a long one, so the
  // pieces are kept shorter there - every one of them finishes well before the point Apple's engine
  // gives up, and the pause between them lands where a sentence ends anyway.
  function chunkChars() {
    var base = (design().limits && design().limits.chunkChars) || 220;
    return isIos() ? Math.min(base, 140) : base;
  }

  // ---- how much she may say -------------------------------------------------
  //
  // CHECKED 2026-09-29, because read-aloud was stopping mid-thought. There are two ceilings on a
  // spoken reply, and they are not the same ceiling:
  //
  //   THIS BROWSER'S VOICE  has no ceiling of its own. The engine's limit is the utterance, and a
  //                         reply is said in pieces (`chunkChars` below) - so a long reply is read
  //                         WHOLE, one piece after another. The cap in this file is a safety net
  //                         against a pathological input, not a limit worth reaching.
  //   ELEVENLABS            takes up to ELEVEN_REQUEST_MAX (10,000) characters in ONE request and
  //                         refuses more before anything is billed. It also bills one credit per
  //                         character, so its cap is a COST guard rather than a technical one. It
  //                         shipped at 800, and that was the second half of the bug: Patrikios holds
  //                         an ElevenLabs key, so `auto` resolves to ElevenLabs and every reply past
  //                         800 characters was trimmed mid-sentence. Measured against his own record
  //                         before choosing the number (990 replies: median 498, 90th pct 1025, p95
  //                         1195, longest 3398; 210 of them over the old 800), so 4000 covers
  //                         anything he has actually written with room to spare. `/voice max` raises
  //                         it, up to the provider's own ceiling.
  //
  // Either way a reply over the cap is cut AT A SENTENCE END where one exists, the receipt names the
  // numbers, and nothing longer than ElevenLabs' own ceiling is ever sent to it.
  var ELEVEN_REQUEST_MAX = 10000;    // the provider's own per-request ceiling (their number, not ours)
  var BROWSER_SAFETY_MAX = 24000;    // the free roads: a safety net, not a limit - see above

  function limitsNow() {
    var d = (design().limits) || {};
    var L = {
      maxChars: num(d.maxChars, BROWSER_SAFETY_MAX, 500, 200000),
      elevenMaxChars: num(d.elevenMaxChars, 4000, 100, ELEVEN_REQUEST_MAX),
      kokoroMaxChars: num(d.kokoroMaxChars, 900, 500, 4000),
      chunkChars: num(d.chunkChars, 220, 60, 2000),
      elevenRequestMax: num(d.elevenRequestMax, ELEVEN_REQUEST_MAX, 1000, 40000)
    };
    if (store.maxChars != null) L.maxChars = Math.max(500, Math.min(200000, Math.round(Number(store.maxChars)) || L.maxChars));
    if (store.elevenMaxChars != null) L.elevenMaxChars = Math.max(100, Math.min(L.elevenRequestMax, Math.round(Number(store.elevenMaxChars)) || L.elevenMaxChars));
    if (store.kokoroMaxChars != null) L.kokoroMaxChars = Math.max(500, Math.min(4000, Math.round(Number(store.kokoroMaxChars)) || L.kokoroMaxChars));
    return L;
  }

  function limitsText() {
    var L = limitsNow();
    var eng = state().engineNow;
    return [
      "VOICE :: HOW MUCH SHE MAY SAY (the ceilings, and where each one comes from)",
      "",
      "  THIS BROWSER'S VOICE :: NO CEILING OF ITS OWN. A reply is broken at sentence ends into pieces of " + chunkChars() + " characters"
        + (isIos() ? " (140 on a phone, because iOS goes quiet on a long utterance)" : "") + " and said one after another, so a long reply is read WHOLE. The terminal's own cap is "
        + L.maxChars + " CHARACTERS - a safety net against a pathological input, not a limit worth reaching (/voice max browser <N> CHANGES IT).",
      "  ELEVENLABS :: THE API TAKES UP TO " + L.elevenRequestMax + " CHARACTERS IN ONE REQUEST and refuses more before anything is billed. It also bills one credit per character, so "
        + L.elevenMaxChars + " IS A COST GUARD RATHER THAN A TECHNICAL LIMIT - set to cover the longest reply in Patrikios' own record (3398 characters, out of 990 replies, median 498) with room to spare, so nothing he has written is cut (/voice max eleven <N> RAISES IT, up to " + L.elevenRequestMax + "; /voice max reset PUTS THE SHIPPED NUMBER BACK).",
      "  THE WIRE (GEMINI) :: the line is handed to the live session as one turn; the same " + L.maxChars + "-character cap applies.",
      "  THE LOCAL VOICE (KOKORO) :: FREE AND UNBILLED, BUT SLOWER THAN REAL TIME - about 2x on this machine - so it takes the ceiling that matches its cost: " + L.kokoroMaxChars + " CHARACTERS, about a minute of speech and about two minutes of making. A longer reply is cut at a sentence end and the receipt says so (/voice max kokoro <N> MOVES IT, 500-4000). It is also the only road that must FETCH something before it can speak at all: the model is about 90MB, once per browser.",
      "",
      "  A REPLY OVER THE CAP IS CUT AT A SENTENCE END (never mid-thought when there is a full stop to cut at), and the receipt on the stage names the numbers: how many characters were said, and out of how many.",
      "  SHE IS SPEAKING ON :: " + (eng === "elevenlabs" ? "ELEVENLABS - TRIMMED AT " + L.elevenMaxChars + " CHARACTERS PER REPLY."
        : ((eng === "kokoro" || eng === "stream") ? "THE LOCAL VOICE (KOKORO) - TRIMMED AT " + L.kokoroMaxChars + " CHARACTERS PER REPLY, BECAUSE IT IS SLOWER THAN REAL TIME."
          : "THIS BROWSER'S VOICE" + (wireOn ? " (ON THE WIRE)" : "") + " - THE WHOLE REPLY."))
    ].join("\n");
  }

  // Breaks a long reply at sentence ends, so a browser voice never runs into the engine's
  // long-utterance cutoff and the pauses land where sentences end.
  function chunk(text, max) {
    var out = [], buf = "";
    var sentences = String(text).match(/[^.!?\u2026]+[.!?\u2026]*\s*/g) || [String(text)];
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      if (s.length > max) {
        if (buf.trim()) { out.push(buf.trim()); buf = ""; }
        var words = s.split(/\s+/), line = "";
        for (var j = 0; j < words.length; j++) {
          if (line && (line + " " + words[j]).length > max) { out.push(line); line = ""; }
          line += (line ? " " : "") + words[j];
        }
        if (line) buf = line + " ";
      } else if (buf && (buf + s).trim().length > max) {
        out.push(buf.trim());
        buf = s;
      } else buf += s;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  // ---- the browser engine --------------------------------------------------

  function setSpeaking(on) {
    var now = !!on || holding;
    // The moment her voice stops, hold the microphone off for a beat: the speaker tail, the room's
    // reverb and the recogniser's own buffered audio are all still hers, not his. ON THE WIRE the
    // beat is shorter and it can afford to be: the transcriber is being fed echo-cancelled audio and
    // the echo guard is still underneath this, so a fifth of a second is enough to stop a speaker
    // tail while not swallowing the first words of a sentence he starts the moment she finishes.
    if (speaking && !now) voiceTailUntil = Date.now() + (wireOn ? 250 : 700);
    if (speaking && !now) lastSpeakEnd = Date.now();
    speaking = now;
    try { if (window.turn && window.turn.barb) window.turn.barb(now); } catch (e) {}
    setUi();
  }

  function barbCallsign(v) {
    if (v == null) return barbCallsignOn;
    var t = String(v).toLowerCase().trim();
    if (/^(on|yes|true|1)$/.test(t)) barbCallsignOn = true;
    else if (/^(off|no|false|0)$/.test(t)) barbCallsignOn = false;
    return barbCallsignOn;
  }

  // Some engines make one particular voice sound heavier than the design intends - Google UK
  // English Female at BARBELO's low pitch reads masculine on Patrikios' machine. That is a property
  // of the voice, not of the role, so a role can carry `voicePitch: {"<voice name>": <n>}` beside
  // its own pitch and only that voice moves.
  function voicePitchFor(v, voice) {
    var map = (v && v.voicePitch) || null;
    if (!map || !voice) return null;
    var name = String(voice.name || "").toLowerCase();
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() !== name) continue;
      var p = map[keys[i]];
      if (p == null) return null;
      return num(p, null, 0, 2);
    }
    return null;
  }

  function browserSpec(voice, v) {
    v = v || {};
    var per = voicePitchFor(v, voice);
    return {
      voice: voice || null,
      lang: (voice && voice.lang) || v.lang || "en-US",
      rate: num(v.rate, 1, 0.5, 2),
      pitch: per == null ? num(v.pitch, 1, 0, 2) : per,
      volume: num(v.volume, 1, 0, 1)
    };
  }

  // `spec` is a browserSpec: which voice, how fast, how low. Passing that in rather than a role id
  // is what makes an audition possible - the very same code path speaks her replies, one candidate
  // heard on its own, and a sample in a voice she is not (yet) wearing.
  function browserSpeak(text, spec, token) {
    return new Promise(function (resolve) {
      // PRIVATE MODE: no voice but the guest line's while it is up - the
      // audition sweep and try/preview ride this road too, not just replies.
      if (guestUp()) { try { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); } catch (e) {} return resolve({ ok: false, error: new Error("PRIVATE - GUEST LINE UP"), cancelled: true }); }
      if (typeof speechSynthesis === "undefined") return resolve({ ok: false, error: new Error("THIS BROWSER HAS NO SPEECH ENGINE") });
      var parts = chunk(text, chunkChars());
      var voice = spec.voice;
      var i = 0;
      var watchdog = null;
      var settle = function (res) {
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        setSpeaking(false);
        resolve(res);
      };
      setSpeaking(true);
      try { speechSynthesis.cancel(); } catch (e) {}
      var firstGap = true;
      var next = function () {
        if (token !== playToken) return settle({ ok: false, error: new Error("CANCELLED"), cancelled: true });
        if (firstGap) {
          firstGap = false;
          var t = token;
          setTimeout(function () {
            if (t === playToken) next();
            else settle({ ok: false, error: new Error("CANCELLED"), cancelled: true });
          }, 150);
          return;
        }
        if (i >= parts.length) return settle({ ok: true, engine: "browser", voice: voice ? voice.name : "", chunks: parts.length });
        var part = parts[i++];
        var done = false;
        // A WATCHDOG PER PIECE. iOS Safari can stop mid-utterance - and if the page is put away while
        // she is talking, `onend` may never arrive at all. Without this, `speaking` would stay true
        // for the rest of the session, which keeps the microphone shut for her turn and leaves the
        // live channel unable to hear anything he says. So a piece that has not finished by the time
        // it could not possibly still be talking is taken as finished.
        var finishPiece = function (err) {
          if (done) return;
          done = true;
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          if (err) {
            if (token !== playToken) return settle({ ok: false, error: new Error("CANCELLED"), cancelled: true });
            var msg = String(err);
            if (msg === "interrupted" || msg === "canceled") return settle({ ok: false, error: new Error("CANCELLED"), cancelled: true });
            return settle({ ok: false, error: new Error(msg.toUpperCase()) });
          }
          next();
        };
        var u = new SpeechSynthesisUtterance(part);
        if (voice) u.voice = voice;
        u.lang = spec.lang;
        u.rate = spec.rate;
        u.pitch = spec.pitch;
        u.volume = spec.volume;
        u.onend = function () { finishPiece(null); };
        u.onerror = function (ev) { finishPiece(String((ev && ev.error) || "SPEECH FAILED")); };
        utt = u;
        // ~12 characters a second at rate 1, plus a generous margin: long enough that a working engine
        // is never cut off mid-sentence, short enough that a dead one is noticed inside a breath.
        var budget = Math.max(4000, Math.round((part.length / (12 * Math.max(0.5, spec.rate))) * 1000) + 3000);
        watchdog = setTimeout(function () {
          try { speechSynthesis.cancel(); } catch (e) {}
          finishPiece(null);
        }, budget);
        speechSynthesis.speak(u);
      };
      next();
    });
  }

  // ---- the ElevenLabs engine ----------------------------------------------

  // WHY ELEVENLABS SAID NO, IN HIS LANGUAGE.
  //
  // Every refusal from the API is JSON that names the exact problem, and the difference between
  // those names is the whole difference between "re-issue your key", "your account is empty",
  // "this voice is not on your plan" and "you typed the model id wrong". Until 2026-09-21 all four
  // surfaced as one line of raw JSON. The shapes below were MEASURED on his own key (2026-09-21),
  // which is why the sentences can be this specific:
  //
  //   HTTP 402 payment_required  code paid_plan_required   the voice is in the LIBRARY and the plan
  //                                                       is free - refused before billing
  //   HTTP 401 invalid_request   code quota_exceeded      the key is live and the voice is allowed,
  //                                                       but the account has no credits left
  //   HTTP 401 authentication_error code missing_permissions  the KEY was created without that
  //                                                       permission (the body names which one)
  //   HTTP 404 not_found         code voice_not_found     no such voice id
  //   HTTP 400 validation_error  code unsupported_model   the id is deprecated
  //   HTTP 400 + status model_not_found                   no such model id
  //
  // Nothing here guesses: the provider's own message is always printed beside the translation, and
  // an unrecognised shape falls through to the raw body rather than to a made-up diagnosis.
  function refusalFacts(status, body) {
    var text = String(body == null ? "" : body).replace(/\s+/g, " ").trim();
    var out = { status: Number(status) || 0, code: "", providerStatus: "", message: "", requestId: "", why: "", fix: "" };
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    if (parsed) {
      if (parsed.request_id) out.requestId = String(parsed.request_id);
      var d = parsed.detail;
      if (d && typeof d === "object" && !Array.isArray(d) && d.request_id) out.requestId = String(d.request_id);
      if (Array.isArray(d)) d = d[0] || {};
      if (d && typeof d === "object") {
        out.code = String(d.code || "");
        out.providerStatus = String(d.status || "");
        out.message = String(d.message || "");
      } else if (typeof d === "string") {
        out.message = d;
      }
      if (!out.message && parsed.message) out.message = String(parsed.message);
      if (!out.providerStatus && typeof parsed.status === "string") out.providerStatus = parsed.status;
      if (!out.code) out.code = out.providerStatus;
    }
    // A TRUNCATED BODY IS STILL A DIAGNOSIS. The caller caps what it PRINTS, and a body can be cut
    // anywhere - so when the JSON does not parse (or parses into a shape other than the one above)
    // the labels are read straight out of the text. Worth having: the first version of this read a
    // cut-off 402 as an unrecognised shape and only got the sentence right by luck of its wording.
    if (!out.requestId) { var mr = text.match(/"request_id"\s*:\s*"([^"]+)"/); if (mr) out.requestId = mr[1]; }
    if (!out.code) { var mc = text.match(/"code"\s*:\s*"([^"]+)"/); if (mc) out.code = mc[1]; }
    if (!out.providerStatus) { var mst = text.match(/"status"\s*:\s*"([^"]+)"/); if (mst) out.providerStatus = mst[1]; }
    if (!out.message) { var mm = text.match(/"message"\s*:\s*"([^"]*)"/); if (mm) out.message = mm[1]; }
    if (!out.code) out.code = out.providerStatus;
    if (!out.message) out.message = text.slice(0, 200);
    // BOTH LABELS ARE MATCHED, NOT JUST `code`. Measured 2026-09-21: the permissions refusal carries
    // code "unauthorized" and status "missing_permissions", so matching only the first would read a
    // scoped key as a dead one - the exact false diagnosis the key ring already guards against.
    var C = (out.code + " " + out.providerStatus).trim(), M = out.message;
    if (/paid_plan_required/.test(C) || /library voice/i.test(M)) {
      out.why = "THE VOICE IS TAILORED HERE, BUT ELEVENLABS WILL NOT SPEAK A LIBRARY VOICE THROUGH THE API ON A FREE PLAN (HTTP 402). IT REFUSED BEFORE ANY CREDIT COULD BE SPENT.";
      out.fix = "THE SHIPPED PALETTE (/voice voices) IS THE PREMADE SET A FREE PLAN MAY SPEAK. A PAID PLAN IS WHAT UNLOCKS THIS ONE - NOTHING ON THIS DEVICE CHANGES IT.";
    } else if (/quota_exceeded/.test(C)) {
      out.why = "THE KEY IS LIVE AND THIS VOICE IS ALLOWED - THE ACCOUNT HAS NO CREDITS LEFT. THE PROVIDER'S OWN MESSAGE SAYS HOW MANY THIS ONE HAD ASKED FOR.";
      out.fix = "TOP THE ACCOUNT UP, OR SPEAK ON THIS BROWSER'S ENGINE (/voice engine browser), WHICH IS FREE AND UNLIMITED.";
    } else if (/missing_permissions/.test(C)) {
      out.why = "THE KEY ITSELF IS FINE, BUT IT WAS CREATED WITHOUT THE PERMISSION THIS CALL NEEDS - THE PROVIDER NAMES IT IN THE MESSAGE.";
      out.fix = "EDIT THE KEY IN THE ELEVENLABS DASHBOARD (OR MAKE A NEW ONE) AND ADD THE MISSING PERMISSION: text_to_speech TO SPEAK, voices_read TO READ THE VOICE LIST, convai_read/convai_write FOR AN AGENT SESSION. THEN STORE IT AGAIN IN KEYS \u25be.";
    } else if (/voice_not_found/.test(C)) {
      out.why = "THERE IS NO VOICE WITH THAT ID ON ELEVENLABS.";
      out.fix = "CHECK IT IN /voice voices. A PROFILE'S VOICE ID IS IN src/voice/voices.json IF IT CAME FROM THERE.";
    } else if (/unsupported_model|model_not_found/.test(C)) {
      out.why = "THE MODEL ID IS NOT ONE ELEVENLABS SPEAKS WITH" + (/deprecated/i.test(M) ? " - IT HAS BEEN DEPRECATED" : "") + ".";
      out.fix = "USE ONE FROM THE MEASURED TABLE: /voice models, THEN /voice model <ID>. /voice model default GOES BACK TO THE SHIPPED ONE.";
    } else if (/invalid_api_key|unauthorized/.test(C) && !/missing_permissions/.test(C)) {
      out.why = "THE KEY ITSELF WAS REFUSED (HTTP " + out.status + ").";
      out.fix = "CHECK IT WITH /keys test elevenlabs, AND STORE IT AGAIN IN KEYS \u25be IF IT HAS BEEN ROTATED.";
    }
    return out;
  }

  function refuseLines(f) {
    if (!f) return "";
    var out = [];
    if (f.code) out.push("  ELEVENLABS CALLED IT :: " + f.code.toUpperCase()
      + (f.providerStatus && f.providerStatus.toUpperCase() !== f.code.toUpperCase() ? " / " + f.providerStatus.toUpperCase() : ""));
    if (f.why) out.push("  WHY :: " + f.why);
    if (f.fix) out.push("  WHAT WOULD FIX IT :: " + f.fix);
    // The one piece of the raw body worth keeping: the handle the provider would ask for.
    if (f.requestId) out.push("  REQUEST ID :: " + f.requestId + " (WHAT ELEVENLABS WOULD ASK FOR)");
    return out.join("\n");
  }

  function explainRefusal(status, body) {
    var f = refusalFacts(status, body);
    var head = "HTTP " + f.status + (f.code ? " " + f.code : "");
    return head + (f.message ? " :: " + f.message : "") + (f.why || f.fix ? "\n" + refuseLines(f) : "");
  }

  async function fetchVoices(force) {
    var kr = keyring();
    if (!kr) throw new Error("KEYRING MODULE OFFLINE");
    if (!kr.has("elevenlabs")) throw new Error((kr.bypassed && kr.bypassed("elevenlabs")) ? "ELEVENLABS CALLS ARE BYPASSED IN THE KEYS PANEL (KEYS \u25be) - NOTHING WAS SENT" : "NO ELEVENLABS KEY IS HELD (KEYS \u25be)");
    if (store.voices && store.voices.length && !force) return store.voices;
    var res = await kr.request("elevenlabs", EL + "/v1/voices");
    if (!res.ok) {
      var detail = "";
      try { detail = String(await res.text()).replace(/\s+/g, " ").slice(0, 160); } catch (e) {}
      throw new Error("HTTP " + res.status + (detail ? " :: " + kr.scrub(detail, "elevenlabs") : ""));
    }
    var data = await res.json();
    store.voices = ((data && data.voices) || []).map(function (v) {
      var labels = (v && v.labels) || {};
      return { id: v.voice_id, name: v.name || v.voice_id, category: v.category || "", gender: labels.gender || "" };
    });
    store.voicesAt = Date.now();
    await save();
    return store.voices;
  }

  async function elevenVoice(roleId, token) {
    var v = roleVoice(roleId);
    if (v.elevenlabs.voiceId) return { id: v.elevenlabs.voiceId, name: "", source: "configured" };
    var hit = store.resolved[roleId];
    if (hit && hit.id) return { id: hit.id, name: hit.name || "", source: "chosen" };
    var list = [];
    try { list = await fetchVoices(false); }
    catch (e) { console.warn("voice list unavailable", e && e.message); }
    if (token !== playToken) return { id: null, name: "" };
    var pick = list[0];
    if (pick) {
      store.resolved[roleId] = { id: pick.id, name: pick.name, at: Date.now() };
      await save();
      print("SYSTEM", "VOICE :: HER ELEVENLABS VOICE FOR " + roleLabel(roleId) + " IS \"" + String(pick.name).toUpperCase() + "\" (" + pick.id + ")."
        + "\n/voice voices LISTS THEM, /voice voice <ID|NAME> PICKS ANOTHER.");
      return { id: pick.id, name: pick.name, source: "auto" };
    }
    var fb = (design().elevenlabs && design().elevenlabs.fallbackVoiceId) || "";
    if (fb) return { id: fb, name: "", source: "fallback" };
    throw new Error("NO VOICE ID COULD BE RESOLVED");
  }

  function playBlob(blob) {
    return new Promise(function (resolve) {
      var started = false;
      var start = function (play) {
        if (started) return;
        started = true;
        var url = URL.createObjectURL(play);
        var audio = new Audio();
        var settled = false;
        var finish = function (ok, err) {
          if (settled) return;
          settled = true;
          try { audio.pause(); } catch (e) {}
          try { URL.revokeObjectURL(url); } catch (e) {}
          current = null;
          setSpeaking(false);
          resolve({ ok: ok, error: err || null });
        };
        audio.onended = function () { finish(true); };
        audio.onerror = function () { finish(false, new Error("THE BROWSER COULD NOT DECODE THE AUDIO")); };
        audio.src = url;
        current = audio;
        // THE iPHONE ROAD'S TAP (src/js/livecomm.js): her voice into the desk-to-phone
        // mix. Gated inside tapBarb - with no call armed it is a no-op and her
        // normal voice plays exactly as before.
        try { if (window.livecomm && window.livecomm.tapBarb) window.livecomm.tapBarb(audio); } catch (e) {}
        setSpeaking(true);
        audio.play().catch(function (e) {
          finish(false, new Error("PLAYBACK WAS BLOCKED :: " + ((e && e.message) || "PRESS LISTEN AGAIN")));
        });
      };
      try {
        if (window.wm && window.wm.mark) window.wm.mark(blob, "elevenlabs").then(function (m) { start(m.blob); }, function () { start(blob); });
        else start(blob);
      } catch (e) { start(blob); }
    });
  }

  async function elevenSpeak(text, roleId, token) {
    var kr = keyring();
    var v = roleVoice(roleId);
    var vinfo = await elevenVoice(roleId, token);
    if (token !== playToken) return { ok: false, error: new Error("CANCELLED"), cancelled: true };
    var d = design();
    var fmt = (d.elevenlabs && d.elevenlabs.outputFormat) || "mp3_44100_128";
    var url = EL + "/v1/text-to-speech/" + encodeURIComponent(vinfo.id) + "?output_format=" + encodeURIComponent(fmt);
    var model = modelNow(roleId);
    // A PROFILE'S SETTINGS ARE THE WHOLE SET. The shipped design's settings are the base and a role's
    // own sit on top of them - which is right for a hand-tuned role, but wrong for a profile, where
    // the numbers came from a real agent configuration and anything leaking in from underneath would
    // make the profile mean something other than what it says. `/voice profile <NAME>` marks its
    // settings `settingsExact`, so those are used exactly as given.
    var settings = v.elevenlabs.settingsExact
      ? Object.assign({}, v.elevenlabs.settings || {})
      : Object.assign({}, (d.elevenlabs && d.elevenlabs.settings) || {}, v.elevenlabs.settings || {});
    var res = await kr.request("elevenlabs", url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({ text: text, model_id: model, voice_settings: settings })
    });
    if (!res.ok) {
      // The WHOLE body is read and the FACTS are taken from all of it - only what is printed is
      // capped. A refusal body is small, and cutting one before it is parsed loses the two labels
      // that say which kind of refusal it was (measured: the 402's own JSON is past the 220th
      // character, so the first version diagnosed it from its wording rather than its code).
      var raw = "";
      try { raw = String(await res.text()).replace(/\s+/g, " ").trim(); } catch (e) { raw = ""; }
      var safe = kr.scrub(raw, "elevenlabs");
      var facts = refusalFacts(res.status, safe.slice(0, 4000));
      // The HEADLINE is the provider's own sentence rather than the JSON it came in, so the line
      // reads like an answer instead of a body dump; the labels and the request id follow in the
      // translation below. An unrecognised shape falls back to the raw body, cut only for length.
      var headline = facts.message || safe.slice(0, 220);
      // The refusal TRAVELS WITH THE ERROR: the caller prints the translation, so the reason survives
      // even though this function only throws.
      var err = new Error("HTTP " + res.status + (headline ? " :: " + headline : ""));
      err.status = res.status;
      err.refusal = facts;
      throw err;
    }
    var blob = await res.blob();
    if (token !== playToken) return { ok: false, error: new Error("CANCELLED"), cancelled: true };
    var played = await playBlob(blob);
    played.engine = "elevenlabs";
    played.voice = vinfo.name || vinfo.id;
    played.voiceId = vinfo.id;
    played.model = model;
    return played;
  }

  // ---- the local engine (KOKORO) -------------------------------------------
  //
  // The third road (src/js/kokoro.js): a neural narrator fetched once per browser that then runs
  // inside this page. Nothing here fetches anything itself - the engine module owns the model, the
  // worker and the WAV it hands back - and nothing here changes her voice: /voice engine kokoro is
  // the only way onto this road, and /voice engine auto takes her off it again.

  // WHICH LOCAL VOICE, AND HOW FAST. A role's own pick wins, then the block's shipped `voice`. The
  // SPEED is the role's own RATE - the same number the browser road hands to the machine - so a role
  // that reads slowly on this browser reads slowly here too, and it is the GENERATOR that is slow
  // rather than a player holding the audio back. There is no pitch on this road: the model has no
  // pitch control, which is worth knowing before wondering why /voice pitch does nothing here.
  function kokoroVoice(roleId) {
    var v = roleVoice(roleId);
    var pick = (v.kokoro && v.kokoro.voice) || "";
    if (pick) return pick;
    return (design().kokoro && design().kokoro.voice) || "af_heart";
  }

  function kokoroSpeed(roleId) {
    return num((roleVoice(roleId).browser || {}).rate, 1, 0.5, 2);
  }

  function kokoroEngine() { return window.kokoro || null; }

  // ONE PIECE, PLAYED WITHOUT TOUCHING THE INTERCOM. playBlob() (above) opens and closes her mouth
  // around EVERY clip, which is right for ElevenLabs - one request, one clip, one reply. Here a
  // reply is several pieces and the synthesis of the next one runs while the current one plays, so a
  // lamp that read STANDBY in the gaps would be a lamp that lies about who has the line. `speaking`
  // is raised once, by speak(), and lowered once when the last piece is done or the road is cut.
  //
  // It still parks the element in `current`, which is what stopSpeakingInternal() reaches for - so
  // /voice stop, the LISTEN key and the live channel's hush all cut this road exactly as they cut the
  // paid one, mid-sentence.
  function playPiece(blob) {
    return new Promise(function (resolve) {
      // PRIVATE MODE: the clip roads (eleven/stream/kokoro pieces, kokoro
      // audition sweep) all play here - dark while the guest line is up.
      if (guestUp()) { try { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); } catch (e) {} return resolve({ ok: false, error: new Error("PRIVATE - GUEST LINE UP"), cancelled: true }); }
      var url = URL.createObjectURL(blob);
      var audio = new Audio();
      var settled = false;
      var finish = function (ok, err) {
        if (settled) return;
        settled = true;
        try { audio.pause(); } catch (e) {}
        try { URL.revokeObjectURL(url); } catch (e) {}
        if (current === audio) current = null;
        resolve({ ok: ok, error: err || null });
      };
      audio.onended = function () { finish(true); };
      audio.onerror = function () { finish(false, new Error("THE BROWSER COULD NOT DECODE THE LOCAL VOICE'S AUDIO")); };
      audio.src = url;
      current = audio;
      // THE iPHONE ROAD'S TAP (src/js/livecomm.js) - same road as playBlob above.
      // Gated with no call: her normal voice untouched.
      try { if (window.livecomm && window.livecomm.tapBarb) window.livecomm.tapBarb(audio); } catch (e) {}
      audio.play().catch(function (e) {
        finish(false, new Error("PLAYBACK WAS BLOCKED :: " + ((e && e.message) || "PRESS LISTEN AGAIN")));
      });
    });
  }

  // THE STREAM ROAD (the shipped voice chips, v47/v48/v49). The kokoro model renders piece by
  // piece through the mouth, which banks each piece through the cushion into the player - so the
  // first audio lands after the first piece instead of the whole reply, and a hush cuts one
  // continuous line instead of one clip per piece. Opt-in only, same model and cap as kokoro.
  var streamPlayer = null, jitterBuf = null, streamMouth = null, streamTrack = "", streamSeq = 0, earWatcher = null, earGraceUntil = 0, silenceLive = null, lastSilence = null;
  function streamChain() {
    if (!window.MythosVoiceStream || !window.MythosVoiceJitter || !window.MythosVoiceSay) {
      throw new Error("THE STREAM CHIPS ARE NOT LOADED (src/chips/sia-voice-*chip/mythos-voice-*.js)");
    }
    if (!streamPlayer) {
      streamPlayer = window.MythosVoiceStream.client({ sampleRate: 24000 });
      jitterBuf = window.MythosVoiceJitter.client({
        sampleRate: 24000, targetMs: 300, maxMs: 2000,
        sink: function (c, t) { return streamPlayer.feed(c, t); }
      });
    }
    return true;
  }
  // THE PREGNANT PAUSE (sia-silence-chip v56). On the stream road her lamp stays lit past
  // the last sound until the meter yields the turn: her own words anchor it, the rendered chunks
  // feed the falling cadence, and the pause clock starts when the audio actually stops - at the
  // cushion close, read off her own clock. /voice silence owns the knobs; the chip owns the math.
  function silenceOn() { return store.silence !== false; }
  function silenceKnobs() {
    return {
      poeticMs: num(store.silencePoetic, 700, 200, 1500),
      awkwardMs: num(store.silenceAwkward, 2200, 1000, 4000),
      thresh: num(store.silenceThresh, 0.72, 0.5, 0.95),
      minSem: num(store.silenceGate, 0.55, 0.3, 0.8)
    };
  }
  function silenceRms(c) {
    if (!c || !c.length) return 0;
    var s = 0, i = 0, v = 0;
    for (var k = 0; k < c.length; k += 4) { v = c[k]; s += v * v; i++; }
    if (!i) return 0;
    var r = Math.sqrt(s / i);
    return (isFinite(r) && r >= 0) ? r : 0;
  }
  async function silenceHold(sil, token) {
    if (!sil) return;
    var ceiling = 3700;
    try { ceiling = sil.state().awkwardMs + 1500; } catch (e) { return; }
    var t0 = Date.now();
    for (;;) {
      if (token !== playToken || !speaking) return;
      // HIS VOICE PREEMPTS HER PAUSE. The hold must never eat the start of his reply: a loud room
      // or words already waiting hand the floor back at once, before the meter has its say.
      if (levelLoud()) return;
      try { if (holdText() && String(holdText()).trim()) return; } catch (e) {}
      var ms = Date.now() - t0;
      var r = null;
      try { sil.quiet(ms); r = sil.score(); } catch (e) { return; }
      if (!r || !r.ok) return;
      lastSilence = r;
      if (r.yield || ms > ceiling) return;
      await new Promise(function (res) { setTimeout(res, 120); });
    }
  }
  async function streamSpeak(text, roleId, token) {
    var K = kokoroEngine();
    if (!K) throw new Error("THE LOCAL VOICE IS NOT LOADED (src/js/kokoro.js IS NOT ON THIS PAGE)");
    if (!K.supported()) throw new Error("THIS BROWSER CANNOT RUN THE LOCAL VOICE (NO WEBASSEMBLY, OR NO MODULE WORKER)");
    var voice = kokoroVoice(roleId);
    var speed = kokoroSpeed(roleId);
    var d = design().kokoro || {};
    var device = store.kokoroDevice || d.device || "wasm";
    if (!K.ready()) {
      print("SYSTEM", "VOICE :: THE LOCAL VOICE IS BEING FETCHED :: THE MODEL IS ABOUT 90MB AND COMES ONCE PER BROWSER (THEN IT IS OFFLINE AND FREE FOREVER). IT WILL SPEAK THE MOMENT IT ARRIVES - /voice stop ABANDONS THIS REPLY, AND THE FETCH ITSELF IS KEPT.");
      await K.load({ device: device, onProgress: null });
      if (token !== playToken) return { ok: false, cancelled: true };
    }
    streamChain();
    var conn = await streamPlayer.connect();
    if (!conn.ok) throw new Error(conn.error);
    var t = "kokoro-" + (++streamSeq);
    jitterBuf.open(t);
    silenceLive = null;
    if (silenceOn() && window.MythosVoiceSilence) {
      try {
        var sk0 = silenceKnobs();
        var sil0 = window.MythosVoiceSilence.client({ poeticMs: sk0.poeticMs, awkwardMs: sk0.awkwardMs, thresh: sk0.thresh, minSem: sk0.minSem });
        if (sil0.begin().ok && sil0.complete(text).ok) silenceLive = sil0;
      } catch (e) { silenceLive = null; }
    }
    var M = window.MythosVoiceSay.client({
      voice: voice,
      chunkChars: chunkChars(),
      synth: function (s) {
        return K.say(s, voice, { speed: speed, device: device }).then(function (m) { return m.blob; });
      },
      sink: function (c, tr) {
        // THE iPHONE ROAD'S TAP (src/js/livecomm.js): stream-engine chunks tee off
        // as data (copies) - the player below is untouched by it.
        try { if (window.livecomm && window.livecomm.barbChunk) window.livecomm.barbChunk(c); } catch (e) {}
        try { if (silenceLive) silenceLive.feed(silenceRms(c)); } catch (e) {}
        // THE CUSHION'S WINDOW IS 2000MS - a whole rendered sentence is seconds long and would be
        // refused whole, so it goes in 500ms slices (copies: the player takes each slice's buffer).
        var v = (c instanceof Int16Array) ? c : null;
        if (!v || !v.length) return jitterBuf.push(c, tr);
        var STEP = 12000, o = 0, pr = null;
        while (o < v.length) {
          pr = jitterBuf.push(v.slice(o, Math.min(o + STEP, v.length)), tr);
          if (!pr || pr.ok === false) return pr;
          o += STEP;
        }
        return { ok: true };
      }
    });
    streamMouth = M;
    streamTrack = t;
    earWatcher = null;
    earGraceUntil = 0;
    try {
      var thr = levelOn();
      if (thr && window.MythosVoiceEar) {
        earWatcher = window.MythosVoiceEar.client({
          threshold: thr, hotMs: 1200, quietMs: 350, maxMs: 45000, now: Date.now,
          onSpeech: function (info) {
            try { print("SYSTEM", "VOICE :: BARGE-IN - THE ROOM HAS BEEN LOUD " + ((info && info.loudMs) || "?") + "MS, SO SHE STOPS. IF THAT WAS HER OWN VOICE OFF YOUR SPEAKERS, /voice level off STANDS THE EAR DOWN."); } catch (e) {}
            stop();
          }
        });
        earWatcher.watch(t);
        earGraceUntil = Date.now() + 1500;
      }
    } catch (e) { earWatcher = null; }
    setSpeaking(true);
    var r = null;
    try {
      r = await M.say(text, t);
    } finally {
      streamMouth = null;
      try { jitterBuf.close(t); } catch (e) {}
      try { if (earWatcher) earWatcher.ignore(t); } catch (e) {}
      earWatcher = null;
    }
    if (token !== playToken) return { ok: false, cancelled: true };
    if (!r.ok) throw new Error(r.error);
    var sil = silenceLive;
    silenceLive = null;
    if (sil) await silenceHold(sil, token);
    setSpeaking(false);
    return { ok: true, engine: "stream", voice: voice, chunks: r.parts, fed: r.fed, device: device, ms: r.ms };
  }
  async function kokoroSpeak(text, roleId, token) {
    var K = kokoroEngine();
    if (!K) throw new Error("THE LOCAL VOICE IS NOT LOADED (src/js/kokoro.js IS NOT ON THIS PAGE)");
    if (!K.supported()) throw new Error("THIS BROWSER CANNOT RUN THE LOCAL VOICE (NO WEBASSEMBLY, OR NO MODULE WORKER)");
    var voice = kokoroVoice(roleId);
    var speed = kokoroSpeed(roleId);
    var d = design().kokoro || {};
    var device = store.kokoroDevice || d.device || "wasm";
    // THE ONLY ROAD THAT HAS TO FETCH BEFORE IT CAN SPEAK, and about 90MB is long enough to be worth
    // saying out loud rather than leaving him watching a lamp. Printed ONCE, before the wait, and
    // never again on a warm model: the second sentence of a reply costs nothing to start.
    if (!K.ready()) {
      print("SYSTEM", "VOICE :: THE LOCAL VOICE IS BEING FETCHED :: THE MODEL IS ABOUT 90MB AND COMES ONCE PER BROWSER (THEN IT IS OFFLINE AND FREE FOREVER). IT WILL SPEAK THE MOMENT IT ARRIVES - /voice stop ABANDONS THIS REPLY, AND THE FETCH ITSELF IS KEPT.");
      var t0 = Date.now();
      await K.load({ device: device, onProgress: null });
      if (token !== playToken) return { ok: false, cancelled: true };
      print("SYSTEM", "VOICE :: THE LOCAL VOICE IS HERE :: LOADED IN " + Math.round((Date.now() - t0) / 1000) + "S"
        + (K.state().threads && K.state().threads !== "?" ? ", " + K.state().threads + " THREADS" : "")
        + " :: " + K.state().voiceCount + " VOICES. /voice kokoro voices LISTS THEM WITH THEIR GRADES.");
    }
    var parts = chunk(text, chunkChars());
    if (!parts.length) return { ok: false, error: new Error("THERE IS NOTHING TO SAY") };
    setSpeaking(true);
    // ONE PIECE AHEAD: the next piece is being made WHILE the current one is being heard, which is
    // the only thing that makes a 2x-real-time engine bearable in the middle of a paragraph. On a
    // long reply the pipe still cannot outrun the ear (see the ceiling), and the lamp stays HER
    // VOICE the whole way, so a gap reads as a pause rather than as the end of a turn.
    var inflight = null;
    try {
      inflight = K.say(parts[0], voice, { speed: speed, device: device });
      for (var i = 0; i < parts.length; i++) {
        var said = await inflight;
        if (token !== playToken) { inflight = null; return { ok: false, cancelled: true }; }
        if (i + 1 < parts.length) inflight = K.say(parts[i + 1], voice, { speed: speed, device: device });
        else inflight = null;
        var played = await playPiece(said.blob);
        if (token !== playToken) return { ok: false, cancelled: true };
        if (!played.ok) throw played.error || new Error("PLAYBACK FAILED");
      }
    } catch (e) {
      // A piece already in the worker cannot be recalled (the worker is single-threaded and busy),
      // so it is simply left to land unheard rather than failing a reply that is already speaking.
      if (inflight && inflight.catch) inflight.catch(function () {});
      setSpeaking(false);
      throw e;
    }
    setSpeaking(false);
    return { ok: true, engine: "kokoro", voice: voice, chunks: parts.length, device: device };
  }

  // ---- speaking ------------------------------------------------------------

  function stopSpeakingInternal() {
    playToken++;
    holding = false;
    try { if (window.wm) window.wm.close(); } catch (e) {}
    if (typeof speechSynthesis !== "undefined") { try { speechSynthesis.cancel(); } catch (e) {} }
    if (current) { try { current.pause(); } catch (e) {} current = null; }
    try { if (streamMouth) streamMouth.stop(streamTrack); } catch (e) {}
    streamMouth = null;
    try { if (streamPlayer) { var ip = streamPlayer.interrupt(); if (ip && ip.catch) ip.catch(function () {}); } } catch (e) {}
    utt = null;
    // HER AUDIO ON THE WIRE IS OURS TO STOP. Every chunk of it was scheduled by live.js, so a hush
    // here is exact and immediate rather than a request to somebody else's player - which is what
    // makes interrupting her a real thing. The words already written on the record are untouched.
    var W = liveWire();
    if (W && W.hush) { try { W.hush(); } catch (e) {} }
    setSpeaking(false);
  }

  async function speak(text, opts) {
    opts = opts || {};
    if (!ready) await load();
    var clean = prepare(text);
    if (!clean) { if (!opts.quiet) print("SYSTEM", "VOICE :: THERE IS NOTHING TO SAY."); return { ok: false, error: "NOTHING TO SAY" }; }
    if (mode() === "radio") { if (!opts.quiet) print("SYSTEM", guestUp() ? ("GUESTCOMM :: GUESTMODE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. BARBELO ANSWERS IN TEXT ONLY WHILE IT IS UP.") : "VOICE :: RADIO SILENCE - TEXT ONLY. /mode talk TO LET HER SPEAK AGAIN."); return { ok: false, error: "RADIO SILENCE" }; }
    if (window.amute && !window.amute.allowed()) { if (!opts.quiet) print("SYSTEM", "VOICE HELD :: AUDIO IS OFF - PRESS AUDIO IN THE LEFT PANEL TO LET HER SPEAK."); return { ok: false, error: "MUTED" }; }
    if (window.gap && window.gap.on()) { try { await window.gap.takeFloor(); } catch (e) {} }
    if (listening) haltRecognition(true);   // the ears shut while she has the floor - and nothing they hold is delivered
    var roleId = roleIdNow(opts.role);
    var engine = engineNow(roleId);
    var v = roleVoice(roleId);
    var spec = browserSpec(pickBrowserVoice(v.browser), v.browser);
    // HOW MUCH SHE MAY SAY, AND WHY THE TWO ROADS DIFFER. The free roads - this browser's voice and
    // the wire - say the WHOLE reply, in pieces (see limitsNow): a reply cut off mid-thought was the
    // old cap talking, not the engine. ElevenLabs is the one road with a ceiling of our own, because
    // it bills one credit per character.
    var L = limitsNow();
    // THE CEILING FOLLOWS THE ROAD, NOT THE SETTING. `engine` says which engine she would speak with,
    // but when the live channel is open with a Google key her words go over the wire's own speaker and
    // are never billed to ElevenLabs - so that road takes the FREE ceiling even while the engine is set
    // to elevenlabs. (limitsText prints the same rule; before this, a wire turn was capped by the
    // ElevenLabs budget, which is the wrong bill to be paying attention to.)
    var wire = viaWire();
    var lim = wire ? L.maxChars
      : (engine === "elevenlabs" ? L.elevenMaxChars
        : ((engine === "kokoro" || engine === "stream") ? L.kokoroMaxChars : L.maxChars));
    var head = truncate(clean, lim);
    // NO CALLSIGN OUT LOUD (2026-10-21): her name/handle lives in the chat and the log, never
    // in her mouth - nobody speaks their own handle in real life. The old code prepended one here;
    // and a reply can also arrive already wearing one (the model wrote "Barbelō: ..." as its first
    // words). Both are cut at this last door before speech: what is spoken is the reply itself, and
    // the echo guard's memory matches exactly what was heard, prefix-free.
    try {
      var rl = "";
      try { rl = String(roleLabel(roleId) || ""); } catch (e) {}
      var nm = rl.toLowerCase().replace(/[ōŌ]/g, "o").replace(/[^a-z\u0100-\u024f]/g, "");
      var mh = head.text.match(/^\s*([A-Za-z\u0100-\u024f'_-]+)\s*:\s*/);
      if (mh) {
        var who = String(mh[1]).toLowerCase().replace(/[ōŌ]/g, "o").replace(/[^a-z\u0100-\u024f]/g, "");
        var bare = who.replace(/[^a-z]/g, "");
        if ((nm && who === nm) || bare === "barbelo" || who === "alia") head.text = head.text.slice(mh[0].length).trim();
      }
    } catch (e) {}
    stopSpeakingInternal();
    var token = ++playToken;
    try {
      if (window.turn && window.turn.maya && window.turn.maya()) {
        var wait0 = Date.now();
        while (window.turn.maya() && Date.now() - wait0 < 25000) {
          await new Promise(function (r) { setTimeout(r, 200); });
          if (token !== playToken) return { ok: false, cancelled: true };
        }
        if (window.turn.maya()) {
          try { print("SYSTEM", "VOICE :: MAYA STILL ON THE LINE AFTER 25S - SPEAKING OVER HER, ONE VOICE AT A TIME IS BROKEN."); } catch (e) {}
        } else if (!opts.quiet) {
          try { print("SYSTEM", "VOICE :: HELD " + (Math.round((Date.now() - wait0) / 100) / 10) + "S FOR MAYA - ONE VOICE AT A TIME."); } catch (e) {}
        }
      }
    } catch (e) {}
    // SHE HAS THE FLOOR FROM THE MOMENT LISTEN IS PRESSED. The engines below only raise `speaking` when
    // they actually begin to play, and reaching ElevenLabs takes a round trip - so without this the
    // intercom would read STANDBY for a second while she was already on her way to speaking, and the
    // keys would still be pressable (which used to cancel that very utterance). Every path out of this
    // function passes through setSpeaking(false): browserSpeak settles, playBlob finishes, and the
    // watchdog takes over a dead engine (see browserSpeak).
    setSpeaking(true);
    rememberVoiced(head.text);   // this is about to be said out loud; if it comes back in, it is hers
    try { if (window.wm) window.wm.own(roleLabel(roleId), head.text.length * 75 + 2500); } catch (e) {}
    if (!opts.quiet) {
      var said = head.text.length + " CHAR" + (head.text.length === 1 ? "" : "S");
      if (head.cut) {
        said += " OF " + clean.length + " - CUT AT " + (head.why === "sentence" ? "A SENTENCE END" : "A WORD (NO FULL STOP IN THE FIRST " + lim + " CHARACTERS)")
          + " :: " + (wire ? "/voice max <N> RAISES THE CAP"
            : (engine === "elevenlabs" ? "/voice max eleven <N> RAISES THE BUDGET (ELEVENLABS BILLS BY THE CHARACTER), OR /voice engine browser SAYS ALL OF IT FOR FREE"
              : ((engine === "kokoro" || engine === "stream") ? "/voice max kokoro <N> RAISES IT (UP TO 4000), OR /voice engine browser READS THE WHOLE REPLY INSTANTLY AND FOR FREE - THE LOCAL VOICE IS THE SLOW ONE, NOT THE CAPPED ONE"
                : "/voice max browser <N> RAISES THE CAP")));
      } else {
        said = head.text.length + " CHAR" + (head.text.length === 1 ? "" : "S") + " - SAID IN FULL";
      }
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " SPEAKS :: " + (wire ? "THE LIVE WIRE (GEMINI)" : (engine === "elevenlabs" ? "ELEVENLABS" : (engine === "stream" ? "THE LOCAL VOICE, STREAMED" : (engine === "kokoro" ? "THE LOCAL VOICE (KOKORO)" : "THIS BROWSER'S VOICE"))))
        + " :: " + said);
    }
    var result;
    // HER MOUTH, ON THE WIRE. In the live channel with a Google (Gemini) key held, the words go to
    // the wire's own speaker session: 24kHz audio arriving in chunks and played the moment they land
    // (629ms to her first word, measured), streamed rather than built as a whole clip, and OURS to
    // stop - which is what makes interrupting her a real thing rather than a request. The words are
    // the same words: the reply the terminal already wrote, handed over to be said, not re-generated.
    // If the wire could not be opened, or its mouth died, the engines below are exactly what runs.
    var W = wire;
    if (W) {
      result = await wireSpeak(head.text);
    } else if (engine === "elevenlabs") {
      try {
        result = await elevenSpeak(head.text, roleId, token);
      } catch (e) {
        var msg = String((e && e.message) ? e.message : e);
        msg = keyring() ? keyring().scrub(msg, "elevenlabs") : msg;
        if (token !== playToken) return { ok: false, cancelled: true };
        var why = (e && e.refusal) ? refuseLines(e.refusal) : "";
        print("SYSTEM", "VOICE :: ELEVENLABS REFUSED :: " + msg
          + (why ? "\n" + why : "")
          + "\nFALLING BACK TO THIS BROWSER'S VOICE. /keys TO CHECK THE KEY, /voice engine browser TO STOP TRYING IT.");
        result = await browserSpeak(head.text, spec, token);
      }
    } else if (engine === "stream") {
      try {
        result = await streamSpeak(head.text, roleId, token);
      } catch (e) {
        if (token !== playToken) return { ok: false, cancelled: true };
        var smsg = String((e && e.message) ? e.message : e);
        print("SYSTEM", "VOICE :: THE STREAM ROAD COULD NOT SPEAK :: " + smsg
          + "\nFALLING BACK TO THIS BROWSER'S VOICE. /voice kokoro status SAYS WHAT THE MODEL IS DOING, /voice engine auto TAKES HER OFF THIS ROAD.");
        result = await browserSpeak(head.text, spec, token);
      }
    } else if (engine === "kokoro") {
      // HER MOUTH, MADE HERE. The model runs on this machine in a worker; the words are the same
      // words the terminal already wrote. A failure - no WebAssembly, the library unreachable, the
      // model not yet fetched and the fetch refused - falls back to this browser's voice with the
      // reason printed, exactly as the paid road does, because a silent terminal is worse than a
      // wrong engine.
      try {
        result = await kokoroSpeak(head.text, roleId, token);
      } catch (e) {
        if (token !== playToken) return { ok: false, cancelled: true };
        var kmsg = String((e && e.message) ? e.message : e);
        print("SYSTEM", "VOICE :: THE LOCAL VOICE COULD NOT SPEAK :: " + kmsg
          + "\nFALLING BACK TO THIS BROWSER'S VOICE. /voice kokoro status SAYS WHAT THE MODEL IS DOING, /voice engine auto TAKES HER OFF THIS ROAD.");
        result = await browserSpeak(head.text, spec, token);
      }
    } else {
      result = await browserSpeak(head.text, spec, token);
    }
    if (token !== playToken) return { ok: false, cancelled: true };
    if (!result.ok && result.error && !result.cancelled) {
      print("SYSTEM", "VOICE :: " + String(result.error.message || result.error).toUpperCase());
    }
    try { if (window.wm) window.wm.close(); } catch (e) {}
    last = { text: head.text, role: roleId, ts: Date.now() };
    return result;
  }

  function stop() {
    if (!speaking) { print("SYSTEM", "VOICE :: NOTHING IS SPEAKING."); return false; }
    stopSpeakingInternal();
    print("SYSTEM", "VOICE :: SILENCED.");
    return true;
  }

  // Speaks the newest reply (what the LISTEN button does).
  function speakLast(quiet) {
    if (!last.text) {
      print("SYSTEM", "VOICE :: SHE HAS NOT SAID ANYTHING YET. /voice speak <TEXT> SPEAKS WHATEVER YOU TYPE.");
      return { ok: false, error: "NOTHING SPOKEN YET" };
    }
    return speak(last.text, { role: last.role, quiet: !!quiet });
  }

  function toggleSpeak() {
    // THE INTERCOM's LISTEN key (it was the TALK key until Patrikios relabelled the two on
    // 2026-09-24: TALK is the microphone now, LISTEN is her mouth). While she has the floor the press
    // is REFUSED rather than obeyed: this button used to silence her mid-sentence, and he does not
    // interrupt her. An audition is the exception - there this key has always been the stop, and it
    // still is.
    if (holding) { stop(); return; }
    if (!canSpeak()) { print("SYSTEM", "VOICE :: " + airLine()); return; }
    if (speaking) { stop(); return; }
    speakLast();
  }

  // SHE DOES NOT TALK OVER HIM. Her reply is in - but if he is still mid-clause the microphone is
  // handing over his words this second, and starting to speak would shut the ears and cut the rest of
  // his sentence off mid-air. So replies wait in a queue and her mouth takes them in order: each one
  // first waits for the room to go quiet, and a reply that arrives while she is already speaking is
  // spoken after it rather than replacing it (nothing she has said is dropped). The wait is bounded
  // (TURN_WAIT_MAX): a room that never goes quiet hands the line back rather than holding her reply
  // forever. 2026-09-24 - "she doesn't wait her turn".
  async function drainLive() {
    if (liveDraining) return;
    liveDraining = true;
    try {
      while (live && liveQueue.length) {
        var deadline = Date.now() + TURN_WAIT_MAX;
        while (live && Date.now() < deadline) {
          // THREE THINGS HOLD HER MOUTH: his words held, the room still loud (measured - her own
          // voice coming back off the speakers is loud too, and that is exactly when she must not
          // start over herself), and the quiet after the last words of his arrived. TURN-TAKING
          // (2026-10-21: "cutting me off"): that quiet is his OWN end-of-turn rule (holdQuietMs),
          // not a fixed 1.2s beat - a pause inside his sentence must not hand her the floor. This
          // costs no latency in the normal flow: his turn is taken after that same quiet, so by
          // the time her reply is queued his last word is already older than the wait. ON THE WIRE
          // the quiet is the server's own small one (see holdQuietMs), because the model has
          // already held the turn for its silence window - waiting twice for the same quiet is a
          // second of silence he did not ask for.
          var beat = holdQuietMs();
          if (!holdParts.length && !levelLoud() && Date.now() - heardAt >= beat) break;
          await new Promise(function (r) { setTimeout(r, 120); });
        }
        if (!live) return;
        var item = liveQueue.shift();
        if (!item) continue;
        var words = item.text;
        var spoken = speak(words, { role: item.role, quiet: true });
        // Voice-only mode paints nothing, so if the mouth fails (no engine, no key that works,
        // silence) her words still have to land somewhere he can read.
        if (!liveTextOn() && spoken && typeof spoken.then === "function") {
          spoken.then(function (res) {
            if (res && res.ok === false && !res.cancelled) print("SYSTEM", "VOICE :: SHE COULD NOT SPEAK IT, SO HER WORDS ARE HERE INSTEAD ::\n" + words);
          });
        }
        if (spoken && typeof spoken.then === "function") await spoken;
      }
    } finally { liveDraining = false; }
  }

  // Her reply is in: remember it, and read it aloud if Patrikios asked for that.
  function onReply(text, meta) {
    var clean = prepare(text);
    if (!clean) return;
    // THE STORY LANE HAS FIRST REFUSAL ON A LONGFORM REPLY. While it is armed (or one shot has been
    // asked for), a long reply is rendered by HuggingFace and played inline instead of being spoken
    // here - that IS the saving, because the live engine is billed by the character and a chapter is
    // thousands of them. `takeReply` answers false when the lane is off, when the reply is a sentence
    // or two (the live engine is what those are for), or when a story is already on the line - in that
    // last case the reply is the INTERRUPTION, and an interruption is spoken live, by definition.
    if (window.story && typeof window.story.takeReply === "function") {
      try { if (window.story.takeReply(clean, meta || {})) return; }
      catch (e) { console.warn("the story lane could not take the reply", e); }
    }
    last = { text: clean, role: (meta && meta.role) || roleIdNow(), ts: (meta && meta.ts) || Date.now() };
    var d = design();
    var auto = (store.autoRead === null) ? d.autoRead : store.autoRead;
    // In the live channel she always answers out loud: that is what the channel is for. She does not
    // talk over him to do it - the reply goes in her queue and her mouth takes it when the room is
    // quiet (see drainLive).
    if (live) {
      liveQueue.push({ text: clean, role: last.role });
      if (liveQueue.length > 4) liveQueue.splice(0, liveQueue.length - 4);
      drainLive();
      return;
    }
    if (auto && !listening) speak(clean, { role: last.role, quiet: true });
  }

  // ---- the microphone ------------------------------------------------------

  function micError(code) {
    switch (String(code || "")) {
      case "not-allowed": return "THE BROWSER REFUSED THE MICROPHONE :: ALLOW IT IN THE ADDRESS BAR, THEN PRESS TALK AGAIN.";
      case "service-not-allowed": return "THIS EMBED IS NOT ALLOWED TO USE SPEECH RECOGNITION :: OPEN THE GENERATOR'S OWN PAGE AND TRY THERE.";
      case "audio-capture": return "NO MICROPHONE WAS FOUND ON THIS MACHINE.";
      case "no-speech": return "NOTHING WAS HEARD :: PRESS TALK AND SPEAK.";
      case "network": return "THE RECOGNITION SERVICE COULD NOT BE REACHED (IT IS NOT LOCAL - CHROME AND EDGE SEND AUDIO TO THEIR OWN SERVICE).";
      case "aborted": return "";
      default: return "RECOGNITION FAILED :: " + String(code || "UNKNOWN").toUpperCase();
    }
  }

  function startListen(resumeSid, resumeText) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { print("SYSTEM", "VOICE :: THIS BROWSER HAS NO SPEECH RECOGNITION (FIREFOX HAS NONE). CHROME AND EDGE DO. YOU CAN STILL TYPE, AND SHE CAN STILL TALK."); return; }
    if (mode() === "radio") { print("SYSTEM", guestUp() ? ("GUESTCOMM :: GUESTMODE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. YOUR MIC STAYS DARK - TYPE TO BARBELO, OR HANG UP FIRST.") : "VOICE :: RADIO SILENCE - THE MICROPHONE STAYS DARK. /mode text OR /mode talk TO OPEN IT."); return; }
    if (live) { print("SYSTEM", "VOICE :: THE LIVE CHANNEL OWNS THE MICROPHONE. PRESS THE MICROPHONE TO CLOSE IT (OR /voice live off) - TALK IS THE ONE-SENTENCE VERSION AND WORKS WHEN THE CHANNEL IS CLOSED."); return; }
    if (listening) { stopListen(); return; }
    stopSpeakingInternal();
    var d = design();
    var r = new SR();
    r.lang = (d.mic && d.mic.lang) || "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    var finalText = String(resumeText || "");
    var interimText = "";
    var errored = false;
    var errorCode = "";
    var heldForSession = false;   // what this session heard has already gone into the hold
    discard = false;   // a fresh session: nothing from before is being abandoned
    voiceTailUntil = 0;   // he has just opened the microphone on purpose - his first words are his own
    var sid = (resumeSid != null) ? resumeSid : ++hearSession;
    if (resumeSid == null) talkResumes = 0;
    // THE SALVAGE HOOK (2026-10-21): what this session holds right now, so shutting the ears
    // (her reply starting, the channel hushing) preserves his half-sentence into the hold.
    earSalvage = function () {
      var t = (finalText + " " + interimText).replace(/\s+/g, " ").trim();
      return t ? { sid: sid, text: t, settled: interimText === "", from: "talk" } : null;
    };
    r.onstart = function () {
      listening = true;
      talkWarned = false;
      setUi();
      // A hushed opening (the intercom key): the lamp and the transcript already say the
      // microphone is open, so the frequency stays clean - no narration on a tower channel.
      if (!micHush) print("SYSTEM", "VOICE :: THE MICROPHONE IS OPEN :: SPEAK - IT LANDS IN THE INPUT BOX" + (micAutoOn() ? " AND GOES TO HER WHEN YOU STOP." : " SO YOU CAN EDIT IT FIRST."));
      micHush = false;
    };
    r.onresult = function (e) {
      interimText = "";
      // A clause of his was just taken from this session: the recogniser keeps everything it has heard
      // in one running list, so the delivered words must be dropped before the next clause is read.
      if (consumedSids[sid]) { consumedSids[sid] = false; finalText = ""; }
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0] ? e.results[i][0].transcript : "";
        if (e.results[i].isFinal) finalText = app(finalText, t); else interimText = app(interimText, t);
      }
      // She has the floor: what arrives now is mostly her voice off the speakers - but not
      // certainly hers (he may be talking over her), so it is HELD, not dropped (2026-10-21:
      // her starting mid-sentence used to eat his). holdHeard strips her runs out; what is
      // wholly hers is refused below and never held at all. Nothing paints into the box while
      // she speaks. Said once per session: his words must never die unnamed.
      if (discard || speaking || voiceTail()) {
        var rawSpk = (finalText + " " + interimText).replace(/\s+/g, " ").trim();
        if (rawSpk && looksLikeHerOwn(rawSpk)) {
          if (!talkWarned) { talkWarned = true; print("SYSTEM", "VOICE :: THAT READS AS HER OWN WORDS COMING BACK - NOT TAKEN."); }
        } else if (rawSpk) {
          holdHeard(sid, rawSpk, "talk", interimText === "");
        }
        finalText = ""; interimText = ""; return;
      }
      var box = el("userInput");
      var raw = (finalText + " " + interimText).replace(/\s+/g, " ").trim();
      // Judged BEFORE anything is cut out of it: a mangled re-hearing has to be recognised as a
      // re-hearing, and cutting her words out of the middle of it is what leaves "no month how to kiss"
      // behind - her words with the evidence removed, which then reads as something he said.
      if (looksLikeHerOwn(raw)) {
        if (!talkWarned) { talkWarned = true; print("SYSTEM", "VOICE :: THAT READS AS HER OWN WORDS COMING BACK - NOT TAKEN."); }
        finalText = ""; interimText = ""; if (box && box.value === raw) box.value = ""; return;
      }
      // She may be THINKING (a reply in flight). That is exactly when he goes on with his sentence, so
      // his words are held rather than dropped - they are taken the moment she is done (holdTick).
      var own = stripHerWords(raw);
      if (!own) { finalText = ""; interimText = ""; if (box && box.value === raw) box.value = ""; return; }
      if (box) box.value = own;
      heldForSession = true;
      holdHeard(sid, raw, "talk", interimText === "");
    };
    r.onerror = function (e) {
      errored = true;
      errorCode = String((e && e.error) || "");
      var msg = micError(e && e.error);
      // While the intercom finger is down a no-speech error is not news - the microphone simply
      // re-opens behind it (see onend) - so the frequency stays clean instead of nagging him to
      // press a key he is already holding.
      if (msg && !(takeDefer && errorCode === "no-speech")) print("SYSTEM", "VOICE :: " + msg);
    };
    r.onend = function () {
      var stopped = !!r.stopped;
      listening = false;
      recognition = null;
      earSalvage = null;
      setUi();
      var t = (finalText + " " + interimText).replace(/\s+/g, " ").trim();
      finalText = ""; interimText = "";
      // THE FINGER IS DOWN (the intercom key's review latch): the microphone is his until he lifts
      // it, so this session's ending ends nothing - the next one opens behind it (see
      // reopenWhileHeld), whether or not this one heard a word. The discard below still drops what
      // should never be delivered; the re-open only keeps the microphone open.
      if (!stopped && takeDefer) reopenWhileHeld(sid, errorCode);
      // The ears were shut for her turn: this session was abandoned mid-sentence. What it holds
      // is HELD, not dropped (2026-10-21) - the halt already salvaged it and this only replaces
      // the same clause; what is wholly hers is refused instead. The hold waits out her floor.
      if (discard || voiceTail()) {
        if (t && looksLikeHerOwn(t)) {
          if (discard) print("SYSTEM", "VOICE :: SHE STARTED SPEAKING MID-SENTENCE - NOT TAKEN: \"" + t.slice(0, 120).toUpperCase() + (t.length > 120 ? "…" : "") + "\"");
        } else if (t) {
          holdHeard(sid, t, "talk", true, true);
        }
        discard = false; return;
      }
      if (!t) {
        // Silence while the finger is down is not news either - the microphone is already re-opening.
        if (!errored && !stopped && !talkWarned && !takeDefer) print("SYSTEM", "VOICE :: NOTHING WAS HEARD.");
        return;
      }
      // A session ending is not the end of his sentence - the recogniser ends sessions by itself. The
      // words are held and sent once he has actually stopped talking (holdTick). But if this session
      // already handed them over, they are NOT handed over twice.
      if (!heldForSession) holdHeard(sid, t, "talk", true);
      // HE PRESSED THE KEY: that IS the end of his turn. "Push to talk, press again to stop" used to
      // mean the words then waited out the whole silence before going anywhere - so the key that
      // finished the sentence was also another way to wait. It goes now.
      if (stopped && !sheHasTheFloor()) takeHold();
      // The held finger re-opens through its own lane above (no cap, no error gate, her floor waited
      // out) - this one is for the unheld one-shot session only.
      if (!stopped && !takeDefer && !errored && !document.hidden && holdParts.length && !sheHasTheFloor() && talkResumes < TALK_RESUME_MAX) {
        talkResumes++;
        var carry = "";
        for (var ci = 0; ci < holdParts.length; ci++) { if (holdParts[ci].id === sid && holdParts[ci].text) carry = holdParts[ci].text; }
        setTimeout(function () {
          if (listening || live) return;
          if (!holdParts.length || sheHasTheFloor()) return;
          try { startListen(sid, carry); } catch (e) {}
        }, 300);
      }
    };
    recognition = r;
    listenGen++;
    heldReopenAt = 0;
    try { r.start(); }
    catch (e) {
      recognition = null;
      listening = false;
      setUi();
      print("SYSTEM", "VOICE :: THE MICROPHONE COULD NOT BE OPENED :: " + ((e && e.message) || e));
    }
  }

  function stopListen(silent) {
    if (!listening) { if (!silent) print("SYSTEM", "VOICE :: THE MICROPHONE IS NOT OPEN."); return; }
    listenGen++;
    heldReopenAt = 0;
    try { if (recognition) { recognition.stopped = true; recognition.stop(); } } catch (e) {}
    listening = false;
    setUi();
    if (!silent) print("SYSTEM", "VOICE :: MICROPHONE CLOSED.");
  }

  // WHOSE FLOOR IS IT FOR A HELD RE-OPEN? sheHasTheFloor() reads a dark SEND as her turn -
  // but the intercom key darkens SEND itself while the finger is down (its deck lock), and that
  // darkness is ours, not hers. Reading it as her floor would wait out the key's own lock forever:
  // the re-open would never open and the lift would inherit a stray session. So while the review
  // latch is up, a dark SEND is discounted - her actual voice, a held audition, or a busy live
  // channel still count, and anything darkening SEND past the latch is her turn as usual.
  function floorForReopen() {
    if (speaking || holding || liveBusy) return true;
    var btn = el("sendBtn");
    if (!btn || !btn.disabled) return false;
    if (takeDefer) return false;
    return true;
  }

  // THE HELD RE-OPEN (the intercom key, src/js/intercom.js). While the review latch is up the
  // microphone is his until he lifts his finger, so a session ending by itself - a pause the
  // recogniser took for the end, a no-speech error, her floor - opens the next session behind it
  // instead of dying. The old twenty-session cap never counted a held finger, and the error gate
  // does not apply either: only a refusal stays shut (no microphone on the machine, none allowed
  // here). The clause the ended session had already handed over rides along (carry), so the
  // transcript never loses a word - and nothing is taken in the meantime, because the latch owns
  // the send until release.
  function reopenWhileHeld(sid, errCode) {
    if (errCode === "not-allowed" || errCode === "service-not-allowed" || errCode === "audio-capture") return;
    talkResumes++;
    heldReopenAt = Date.now();
    var g = listenGen;
    var carry = "";
    for (var ci = 0; ci < holdParts.length; ci++) { if (holdParts[ci].id === sid && holdParts[ci].text) carry = holdParts[ci].text; }
    setTimeout(function () {
      if (g !== listenGen) return;   // he lifted, or another session opened since: stay shut
      if (!takeDefer || listening || live) return;
      // No document.hidden gate here on purpose: the finger is down - a gesture in progress -
      // so the microphone re-opens hidden or not (the editor preview can report hidden while it
      // is on screen, and a background tab costs one throttled tick either way). A refusal still
      // stays shut, and anything else simply ends the next session and schedules the one after.
      // Her floor is waited out, not died on: the poll below re-opens the moment it frees.
      // (floorForReopen, not sheHasTheFloor: our own deck lock darkens SEND while held.)
      if (floorForReopen()) { waitFloorThenReopen(sid, carry, g); return; }
      try { startListen(sid, carry); } catch (e) {}
    }, errCode ? 800 : 300);
  }

  // WAITING OUT HER FLOOR. Polls until the line is his again - then re-opens behind the same
  // clause. The finger lifting, another session opening, or two minutes of her floor ends the
  // wait (stays shut rather than polling forever); the held words are untouched either way.
  // Every waiting tick stamps heldReopenAt, so the key's press-check (which fires once, 900ms
  // after the press) never stands down a finger that is still being waited out.
  function waitFloorThenReopen(sid, carry, g) {
    var tries = 0;
    var t0wall = Date.now();
    var iv = setInterval(function () {
      tries++;
      try {
        // No document.hidden gate: a held finger waits her floor out hidden or not (see above).
        // The wait ends on the finger lifting, another session opening, two minutes of wall time
        // (a throttled background tab must not poll forever), or the floor freeing.
        if (g !== listenGen || !takeDefer || listening || live) { heldReopenAt = 0; clearInterval(iv); return; }
        if (Date.now() - t0wall > 120000 || tries > 240) { heldReopenAt = 0; clearInterval(iv); return; }
        if (!floorForReopen()) {
          heldReopenAt = 0;
          clearInterval(iv);
          try { startListen(sid, carry); } catch (e) {}
          return;
        }
        heldReopenAt = Date.now();
      } catch (e) { heldReopenAt = 0; try { clearInterval(iv); } catch (x) {} }
    }, 500);
  }

  function freeStuckSend() {
    try {
      var b = el("sendBtn");
      if (!b || !b.disabled) return false;
      if (speaking || holding || liveBusy || listening || live) return false;
      if (holdParts.length) return false;
      try {
        if (window.intercom && window.intercom.state) {
          var st = window.intercom.state();
          if (st && (st.held || st.sending || st.receiving)) return false;
        }
      } catch (e) {}
      var t = 0;
      try { t = Number(window.__sendBusyT || 0); } catch (e) {}
      if (t && Date.now() - t < 5 * 60 * 1000) return false;
      b.disabled = false;
      print("SYSTEM", "VOICE :: THE SEND WAS LEFT DARK WITH NOTHING RUNNING - FREED. TALK IS OPEN.");
      return true;
    } catch (e) { return false; }
  }

  function toggleMic() {
    // PRESS AGAIN TO STOP. The key that opened a one-shot session is the key that closes it - and in
    // the state where he has just spoken, that is the one he actually reaches for. (It used to be
    // painted STOP while being DISABLED: canMic() read the line's state alone, and an open session
    // reads YOUR VOICE or HOLDING, so the only ways out were the silence hold or typing. Caught while
    // the two keys were renamed, 2026-09-24 - "user pushes to talk then stops".)
    if (listening && !live) { stopListen(); return; }
    // A SEND BUTTON LEFT DARK WITH NOTHING RUNNING IS A BRICKED MICROPHONE - the floor reads HER
    // TURN off the button alone, so every key refuses forever. The only legitimate owner of a dark
    // SEND is a turn in flight (stamped in window.send); anything older than five minutes, or with
    // no owner at all while every lane is idle, is freed with the fact said out loud.
    if (freeStuckSend()) { try { setUi(); } catch (e) {} }
    // The live channel owns the microphone; startListen's own guard says so in its own words.
    if (live) { startListen(); return; }
    // THE INTERCOM's TALK key. While she speaks (or while her turn is being made) the press is
    // REFUSED: this used to stop her and open the microphone in one move, which cut her off AND
    // pointed the microphone at her own voice. /voice stop is the deliberate way to take the line.
    if (!canMic()) { print("SYSTEM", guestUp() ? ("GUESTCOMM :: GUESTMODE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. YOUR MIC STAYS DARK - TYPE TO BARBELO, OR HANG UP FIRST.") : ("VOICE :: " + airLine())); return; }
    startListen();
  }

  function micAutoOn() {
    var d = design();
    return (store.micAuto === null) ? !!d.micAuto : !!store.micAuto;
  }

  async function micTest(arg) {
    print("SYSTEM", "MIC TEST :: STAGE 1 - HER EARS :: " + (srCtor() ? "SPEECH RECOGNITION IS HERE (" + (window.SpeechRecognition ? "STANDARD" : "WEBKIT") + ")." : "THIS BROWSER HAS NO SPEECH RECOGNITION - THAT ALONE IS THE ANSWER (FIREFOX HAS NONE; CHROME AND EDGE DO)."));
    if (!srCtor()) return;
    var md = (typeof navigator !== "undefined") ? navigator.mediaDevices : null;
    if (!md || !md.getUserMedia) { print("SYSTEM", "MIC TEST :: STAGE 2 - PERMISSION :: NO MICROPHONE STREAM EXISTS HERE. FAILED."); return; }
    var want = String(arg == null ? "" : arg).trim().toLowerCase();
    var stream = null;
    try {
      stream = await md.getUserMedia({ audio: true });
    } catch (e) {
      print("SYSTEM", "MIC TEST :: STAGE 2 - PERMISSION :: DENIED (" + String((e && e.name) || e).toUpperCase() + ") - THE BROWSER NEVER LET THE MICROPHONE OPEN. CLICK THE MICROPHONE ICON IN THE ADDRESS BAR AND ALLOW IT, THEN RUN THIS AGAIN.");
      return;
    }
    var inputs = [];
    try {
      var devs = await md.enumerateDevices();
      inputs = devs.filter(function (d) { return d && d.kind === "audioinput"; });
    } catch (e) {}
    var names = inputs.map(function (d) { return String(d.label || "UNNAMED MICROPHONE"); });
    var track = stream.getAudioTracks()[0];
    var using = "";
    try { using = String((track && track.label) || ""); } catch (e) {}
    print("SYSTEM", "MIC TEST :: STAGE 2 - PERMISSION :: OPEN (" + (using ? "ON \"" + using.toUpperCase() + "\"" : "DEVICE UNNAMED") + ")."
      + (names.length ? "\nMICROPHONES THIS BROWSER SEES (" + names.length + ") :: " + names.join("  |  ").toUpperCase() + "\nSHE ALWAYS LISTENS ON THE SYSTEM DEFAULT - IF THAT IS NOT YOUR MICROPHONE, CHANGE IT IN THE OPERATING SYSTEM'S SOUND SETTINGS, NOT HERE." : ""));
    if (want) {
      var hit = null;
      for (var hi = 0; hi < inputs.length; hi++) {
        if (String(inputs[hi].label || "").toLowerCase().indexOf(want) !== -1) { hit = inputs[hi]; break; }
      }
      if (!hit) {
        print("SYSTEM", "MIC TEST :: NO MICROPHONE MATCHES \"" + String(arg).toUpperCase() + " - PROBING THE DEFAULT INSTEAD.");
      } else {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try {
          stream = await md.getUserMedia({ audio: { deviceId: { exact: hit.deviceId } } });
          print("SYSTEM", "MIC TEST :: PROBING \"" + String(hit.label || "").toUpperCase() + "\" DIRECTLY - THE NEXT STAGE READS THAT MICROPHONE, NOT THE DEFAULT.");
        } catch (e) {
          try {
            stream = await md.getUserMedia({ audio: { deviceId: { ideal: hit.deviceId } } });
            print("SYSTEM", "MIC TEST :: PROBING \"" + String(hit.label || "").toUpperCase() + "\" DIRECTLY - THE NEXT STAGE READS THAT MICROPHONE, NOT THE DEFAULT.");
          } catch (e2) {
            print("SYSTEM", "MIC TEST :: \"" + String(hit.label || "").toUpperCase() + "\" WOULD NOT OPEN (" + String((e2 && e2.name) || e2).toUpperCase() + ") - ANOTHER APP MAY HOLD IT EXCLUSIVELY. PROBING THE DEFAULT INSTEAD.");
            try { stream = await md.getUserMedia({ audio: true }); } catch (e3) { print("SYSTEM", "MIC TEST :: NOTHING WOULD OPEN. FAILED."); return; }
          }
        }
      }
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { print("SYSTEM", "MIC TEST :: STAGE 3 - LEVEL :: NO WEB AUDIO HERE. SKIPPED."); }
    else {
      var ctx = null, peak = 0;
      try {
        ctx = new AC();
        try { if (ctx.state === "suspended" && ctx.resume) await ctx.resume(); } catch (e) {}
        var src = ctx.createMediaStreamSource(stream);
        var an = ctx.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        var buf = new Uint8Array(an.fftSize);
        print("SYSTEM", "MIC TEST :: STAGE 3 - LEVEL :: MAKE NOISE - TALK FOR THREE SECONDS.");
        var t0 = Date.now();
        while (Date.now() - t0 < 3000) {
          await new Promise(function (r) { setTimeout(r, 120); });
          try {
            an.getByteTimeDomainData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
            peak = Math.max(peak, Math.sqrt(sum / buf.length));
          } catch (e) {}
        }
      } catch (e) {}
      try { if (ctx && ctx.close) ctx.close(); } catch (e) {}
      print("SYSTEM", "MIC TEST :: STAGE 3 - LEVEL :: PEAK " + peak.toFixed(3) + (peak > 0.02 ? " - SOUND REACHES THIS BROWSER. THE WIRE FROM YOUR MOUTH IS GOOD; WHAT FOLLOWS TESTS HER EARS." : " - SILENCE. NOTHING REACHES THIS BROWSER: WRONG INPUT DEVICE, MUTED MICROPHONE, OR ANOTHER APP HOLDING IT. FIX THE OPERATING SYSTEM'S INPUT FIRST."));
      if (peak <= 0.02) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
    }
    print("SYSTEM", "MIC TEST :: STAGE 4 - RECOGNITION :: SAY ONE SENTENCE NOW - SEVEN SECONDS.");
    try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    await new Promise(function (done) {
      var r = new (srCtor())();
      try { r.lang = (design().mic && design().mic.lang) || "en-US"; } catch (e) { r.lang = "en-US"; }
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;
      var heard = "";
      var finito = false;
      function fin() { if (!finito) { finito = true; try { r.abort(); } catch (e) {} done(); } }
      setTimeout(fin, 8000);
      r.onresult = function (e) {
        try {
          for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i][0] && e.results[i][0].transcript) heard += e.results[i][0].transcript + " ";
          }
        } catch (e2) {}
      };
      r.onerror = function (e) {
        var m = "";
        try { m = micError(e && e.error); } catch (e2) {}
        print("SYSTEM", "MIC TEST :: RECOGNITION ERROR :: " + String((e && e.error) || "UNKNOWN").toUpperCase() + (m ? " :: " + m : ""));
      };
      r.onend = function () {
        heard = heard.replace(/\s+/g, " ").trim();
        print("SYSTEM", heard
          ? "MIC TEST :: VERDICT :: SHE HEARS YOU - RECOGNISED: \"" + heard.slice(0, 140).toUpperCase() + (heard.length > 140 ? "..." : "") + "\". IF THAT NEVER REACHES HER AS A TURN, THE FAULT IS PAST HER EARS (THE FLOOR, THE HOLD, THE ECHO GUARD) - SAY SO AND THAT IS THE NEXT TEST."
          : "MIC TEST :: VERDICT :: SOUND REACHES THE BROWSER BUT THE RECOGNISER TOOK NOTHING. CHROME SENDS MICROPHONE AUDIO TO GOOGLE'S SERVERS TO TRANSCRIBE - NO NETWORK TO THEM, NO WORDS. OTHERWISE: SPEAK LOUDER AND CLOSER, AND CHECK NOTHING ELSE HOLDS THE MICROPHONE.");
        fin();
      };
      try { r.start(); } catch (e) { print("SYSTEM", "MIC TEST :: RECOGNITION WOULD NOT START :: " + String((e && e.message) || e).toUpperCase()); fin(); }
    });
  }

  // ---- the live channel ----------------------------------------------------
  // One microphone, one conversation, no typing: the channel stays open, what Patrikios says is sent
  // the moment he stops, and her reply is spoken aloud before she listens again. It is the same mouth
  // (speak) and the same ears (SpeechRecognition) as the TALK key and the live microphone - nothing here invents words, it
  // only decides when they are heard and when they are said.
  //
  // SHE DOES NOT LISTEN WHILE SHE SPEAKS. SpeechRecognition has no echo cancellation, so an open
  // microphone during playback transcribes her own voice coming back off the speakers - she would
  // hear herself, answer herself, and never stop. So the channel is half duplex: the recognizer is
  // suspended for the whole of her turn (thinking and speaking) and opened again the moment the room
  // is quiet. To cut her off, press the microphone - that hushes her and stays in the channel.

  function srCtor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

  // ---- whose turn is it, and whose words are these -------------------------
  // THE ONE GATE. While she is thinking or speaking - or while a reply is being made at all - the
  // microphone is not his, so nothing it hears may become a turn. Checked both while a session is
  // open and at the moment of delivery, because a recogniser can end a session by itself and hand
  // over whatever it buffered while she was talking.
  function sheHasTheFloor() {
    var btn = el("sendBtn");
    return !!(speaking || holding || liveBusy || (btn && btn.disabled));
  }

  function voiceTail() { return Date.now() < voiceTailUntil; }

  /* ---- THE INTERCOM -------------------------------------------------------
     TALK, LISTEN and the live microphone are three keys on ONE intercom, and one voice is on the line
     at a time. Patrikios, 2026-09-23: "Let make the TALK and LISTEN buttons just like an intercom.
     When she is talking I do not interrupt. When she is done the buttons are in standby."

     The two keys are named from HIS side of the glass (2026-09-24: TALK = the microphone, LISTEN =
     her mouth). The rule is enforced HERE, not only painted, because the two things it prevents are
     exactly the two things that ruin the moment: pressing the key that reads her reply while she
     speaks used to silence her mid-sentence, and pressing the microphone key while she speaks opened
     the ears onto her own voice coming back off the speakers (the ECHO GUARD would refuse the words,
     but the session should never have opened). So a key that is not his is REFUSED, and the refusal
     says which state the line is in.

       STANDBY     nothing is on the line: TALK and LISTEN are both live.
       HER VOICE   she is speaking. LISTEN is locked - he does not interrupt her - and TALK is shut
                   (her own voice must never be replayed into an open microphone).
       HER TURN    her turn is being made (a reply in flight): both locked.
       YOUR VOICE  the microphone is open (TALK, or the live channel). For the one-shot session the
                   TALK key stays live: it is that session's own stop. LISTEN is locked.
       HOLDING     he spoke and his words are held, taken when the room is quiet (or when she is done,
                   if she had the floor). TALK is still the session's stop; LISTEN is locked.
       AUDITION    /voice audition: LISTEN is the stop, as the TALK key was before the keys were
                   renamed, so it is NOT locked.

     THE LIVE MICROPHONE IS UNTOUCHED. It is the live channel's own key and it still hushes her while
     she speaks - that is how a live conversation is steered - and the live channel's own half-duplex
     machinery (liveBusy, the ears shut for her turn) is untouched. /voice stop still silences her too:
     the lock is on the KEYS and the ordinary commands, so a stray press cannot cut her off, while an
     explicit command still can. Both refusals say so.
     ------------------------------------------------------------------------ */
  function airState() {
    if (holding) return "AUDITION";
    if (speaking) return "HER VOICE";
    var btn = el("sendBtn");
    if (liveBusy || (btn && btn.disabled)) return "HER TURN";
    if (holdParts.length) return "HOLDING";
    if (listening || live) return "YOUR VOICE";
    return "STANDBY";
  }
  function canSpeak() { var s = airState(); return s === "STANDBY" || s === "AUDITION"; }
  // MAY THE MICROPHONE OPEN? STANDBY, or - and this is the one that makes "push to talk, press again
  // to stop" true - a LIVE ONE-SHOT SESSION, which is its own off switch. `HOLDING` counts: the hold
  // belongs to that same session, still hearing him. The live channel is excluded (its own key closes
  // it), and so is anything where she has the floor.
  function canMic() {
    if (mode() === "radio") return false;
    var s = airState();
    if (s === "STANDBY") return true;
    return !!(listening && !live && (s === "YOUR VOICE" || s === "HOLDING"));
  }
  function airLine() {
    var s = airState();
    if (s === "STANDBY") return "THE LINE IS CLEAR :: TALK OPENS THE MICROPHONE.";
    if (s === "HER VOICE") return "SHE HAS THE FLOOR :: THIS IS AN INTERCOM, SO NOTHING CUTS HER OFF MID-SENTENCE. /voice stop SILENCES HER IF YOU MEAN IT (OR PRESS THE MICROPHONE WHILE THE LIVE CHANNEL IS OPEN).";
    if (s === "HER TURN") return "HER TURN IS BEING MADE :: THE LINE IS HERS UNTIL SHE ANSWERS." + ((liveBusy && liveBusySince) ? " (BUSY " + Math.round((Date.now() - liveBusySince) / 1000) + "S - PAST 90S MEANS IT IS STUCK, TELL ME.)" : "");
    if (s === "YOUR VOICE") return "THE EARS ARE ALREADY OPEN :: FINISH WHAT YOU ARE SAYING - THE MICROPHONE CLOSES THE CHANNEL.";
    if (s === "HOLDING") return "SHE IS HOLDING YOUR WORDS :: THEY ARE TAKEN THE MOMENT SHE IS DONE.";
    return "THE LINE IS BUSY.";
  }

  // Join two pieces of a transcript: the recogniser's own results do not always carry a leading space
  // between chunks, and "fragmentand tell me" is not what he said.
  function app(acc, t) {
    t = String(t || "");
    if (!t) return acc;
    return acc ? (acc + " " + t) : t;
  }

  // THE ECHO GUARD, through the shipped chip (v52). The rule that lived here lives there now:
  // loose mangled matching, in-order runs, mixed-transcript surgery. `voiced` is the chip's memory.
  var echoGuard = null;
  function guard() {
    if (!echoGuard) {
      if (!window.MythosVoiceEcho) throw new Error("THE ECHO CHIP IS NOT LOADED (src/chips/sia-voice-echo-chip/mythos-voice-echo-standalone.js)");
      echoGuard = window.MythosVoiceEcho.client({ keep: 24 });
    }
    return echoGuard;
  }
  // ECHO IS A SOUND, NOT A RESEMBLANCE (2026-10-21: "eating my words"). Her voice can only be
  // in the microphone while she is speaking or in the tail just after - so the TEXT guard (her
  // remembered words) is consulted only then. Past that window a transcript that resembles her
  // speech is conversation - quoting her, answering her, using the same words - and refusing it
  // ate whole turns of his. The watermark above stays as it was: it is already acoustic.
  function echoPlausible() { return speaking || voiceTail() || (Date.now() - lastSpeakEnd < ECHO_MS); }
  function looksLikeHerOwn(text, force) {
    try { if (window.wm && window.wm.heard()) return true; } catch (e) {}
    if (!force && !echoPlausible()) return false;
    try {
      var r = guard().check(text);
      return !!(r.ok && r.hers);
    } catch (e) { return false; }
  }
  function rememberVoiced(text) {
    try { guard().remember(prepare(text)); } catch (e) {}
  }
  function echoNotice() {
    return "VOICE :: THAT WAS HER OWN VOICE COMING BACK OFF THE SPEAKERS, NOT YOU - IT IS NOT BEING SENT."
      + "\nSPEAK AGAIN (OR TYPE IT) AND IT WILL BE. IF THIS KEEPS HAPPENING, TURN HER AUTO-READ DOWN, USE EARPHONES, OR LEAVE THE MICROPHONE CLOSED WHILE SHE TALKS.";
  }
  function stripHerWords(text, force) {
    if (!String(text || "").trim()) return "";
    if (!force && !echoPlausible()) return String(text || "");
    try {
      var r = guard().strip(text);
      return r.ok ? r.text : String(text || "");
    } catch (e) { return String(text || ""); }
  }

  function holdPart(id, text, suspect) {
    for (var i = 0; i < holdParts.length; i++) { if (holdParts[i].id === id) return holdParts[i]; }
    var entry = { id: id, text: text, suspect: !!suspect };
    holdParts.push(entry);
    return entry;
  }

  // ---- the meter (see THE ROOM HEARS YOU, in the header) --------------------

  // The threshold in use. 0 means the room is not measured at all.
  function levelOn() {
    if (store.level === 0) return 0;
    if (store.level != null && isFinite(Number(store.level))) return Number(store.level);
    return LEVEL_DEFAULT;
  }

  // IS THERE A VOICE IN THE ROOM? True while the newest reading is above the threshold, and for
  // LEVEL_TAIL after the last loud one - a room does not go quiet the instant a word ends. False when
  // the meter is not running, which is what keeps this from changing anything on a page where it could
  // not be opened.
  function levelLoud() {
    // ON THE WIRE THE READING COMES FROM THE CAPTURE THAT IS ACTUALLY BEING SENT. There is one
    // stream on the microphone, not two: live.js reports the level of the audio going up the socket,
    // and the same threshold, the same tail and the same ceiling apply, so nothing about THE ROOM
    // HEARS YOU changes - only where the number is read off.
    if (wireOn) {
      if (!levelOn()) return false;
      if (Date.now() - wireQuietAt > LEVEL_MAX) return false;
      return (Date.now() - wireLoudAt) < LEVEL_TAIL;
    }
    if (!levelCtx || !levelOn()) return false;
    if (Date.now() - levelQuietAt > LEVEL_MAX) return false;   // a noise cannot hold his turn forever
    return (Date.now() - levelLoudAt) < LEVEL_TAIL;
  }

  function levelSample() {
    if (!levelAnalyser) return 0;
    try {
      levelAnalyser.getByteTimeDomainData(levelBuf);
      var sum = 0;
      for (var i = 0; i < levelBuf.length; i++) { var v = (levelBuf[i] - 128) / 128; sum += v * v; }
      levelRms = Math.sqrt(sum / levelBuf.length);
    } catch (e) { levelRms = 0; }
    var t = levelOn();
    if (t && levelRms >= t) levelLoudAt = Date.now(); else levelQuietAt = Date.now();
    paintLevel();
    try { if (window.wm && window.wm.sample) window.wm.sample(levelRms); } catch (e) {}
    try {
      if (streamMouth && speaking && earWatcher && Date.now() >= earGraceUntil) earWatcher.sample(levelRms);
    } catch (e) {}
    return levelRms;
  }

  async function levelStart() {
    if (levelCtx || levelStarting || !levelOn()) return false;
    levelStarting = true;
    try {
      var md = (typeof navigator !== "undefined") ? navigator.mediaDevices : null;
      if (!md || !md.getUserMedia) { levelOff = "THIS BROWSER HAS NO MICROPHONE STREAM TO MEASURE (mediaDevices.getUserMedia)."; return false; }
      if (!(window.AudioContext || window.webkitAudioContext)) { levelOff = "THIS BROWSER HAS NO WEB AUDIO, SO THE ROOM CANNOT BE MEASURED."; return false; }
      try {
        // THE PLAINEST POSSIBLE STREAM, with the two processors that would LIE ABOUT THE LEVEL turned
        // off: automatic gain control would lift a silent room's floor until the meter called it a
        // voice, and noise suppression would remove exactly the quiet sounds the meter is there to see.
        // Echo cancellation is left ON - the microphone sits beside her speaker, and her own voice
        // coming back is the one thing that should not read as him. All three are hints: a device that
        // does not know them ignores them, and one that refuses them lands in the catch below with the
        // holds unchanged.
        levelStream = await md.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true } });
        var AC = window.AudioContext || window.webkitAudioContext;
        levelCtx = new AC();
        try { if (levelCtx.state === "suspended" && levelCtx.resume) levelCtx.resume(); } catch (e) {}
        var src = levelCtx.createMediaStreamSource(levelStream);
        levelAnalyser = levelCtx.createAnalyser();
        levelAnalyser.fftSize = 1024;
        levelAnalyser.smoothingTimeConstant = 0.4;
        levelBuf = new Uint8Array(levelAnalyser.fftSize);
        src.connect(levelAnalyser);
        try { if (window.wm && window.wm.watch) window.wm.watch(levelAnalyser, levelCtx.sampleRate); } catch (e) {}
        levelOff = "";
        levelLoudAt = 0;
        levelQuietAt = Date.now();
        if (levelTimer) clearInterval(levelTimer);
        levelTimer = setInterval(function () { try { levelSample(); } catch (e) {} }, LEVEL_TICK);
        return true;
      } catch (e) {
        levelOff = "THE ROOM CANNOT BE MEASURED :: " + String((e && e.message) || e).toUpperCase() + " - THE HOLDS STILL APPLY.";
        levelStop();
        if (!levelBad) { levelBad = true; try { console.warn("the microphone level meter could not be opened - the end-of-turn holds still apply", e); } catch (e2) {} }
        return false;
      }
    } finally { levelStarting = false; }
  }

  function levelStop() {
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }
    try { if (levelStream) levelStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (levelCtx && levelCtx.close) levelCtx.close(); } catch (e) {}
    levelStream = null; levelCtx = null; levelAnalyser = null; levelBuf = null;
    levelRms = 0; levelLoudAt = 0;
    levelPaint = "";
    paintLevel();
  }

  // The meter runs ONLY while the microphone is in play: an open session of his, words of his being
  // held, or her mouth working (the room is loud then too, and that matters - the hold must not read
  // her own voice as the room going quiet). Nothing else keeps a second stream on the microphone.
  // ON THE WIRE THERE IS NO SECOND STREAM AT ALL: the capture the wire already streams reports the
  // level itself, so this opens nothing and closes anything it had opened before.
  function levelSync() {
    if (wireOn) {
      if (levelCtx) levelStop();
      wireLoudAt = 0;
      wireQuietAt = Date.now();
      paintLevel();
      return;
    }
    var want = !!levelOn() && !!(live || listening || holdParts.length || speaking);
    if (want && !levelCtx) { levelStart(); return; }
    if (!want && levelCtx) levelStop();
  }

  // The sound of it: the microphone keys go green while the room is loud, so "it is about to take what
  // I said" is something he can see while he is still saying it.
  // STEADY UNDER THE PTT KEY: the meter still runs (the hold needs it), but the glow is frozen
  // off while the finger is down - otherwise the shadow/border flap at meter rate on top of a
  // key that is already lit, which reads as flicker.
  function paintLevel() {
    var on = levelLoud();
    var st = !levelOn() ? "off" : (levelCtx ? (on ? "hot" : "quiet") : "down");
    if (st === levelPaint) return;
    levelPaint = st;
    var frozen = pttHeld();
    try {
      var ids = ["liveBtn", "talkBtn"];
      for (var i = 0; i < ids.length; i++) {
        var b = el(ids[i]);
        if (b) b.classList.toggle("hearing", !frozen && st === "hot");
      }
    } catch (e) {}
    try { if (holdParts.length) paintHold(); } catch (e) {}
  }

  // How long the room must be quiet before the hold is taken. THREE THINGS MAKE IT LONGER, and all
  // three are only ever extra patience (any word of his resets the clock):
  //   1. the recogniser has not COMMITTED the tail - an INTERIM result means the last words are still
  //      being decided, so a breath there is not the end of a sentence;
  //   2. the clause stops on a word a sentence does not end on ("... a story about") - that is a pause
  //      by construction, whatever the recogniser decided about the result;
  //   3. the clause is LONG. A long turn breathes inside itself, and the more he has said, the more a
  //      pause in the middle of it looks exactly like the end of it.
  function holdTailMs() {
    if (holdTail != null) return holdTail;
    return Math.min(1200, Math.max(500, Math.round(holdMs / 3)));
  }
  function looksUnfinished(text) {
    var w = String(text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
    if (!w.length) return false;
    return DANGLING.indexOf(w[w.length - 1]) !== -1;
  }
  function holdQuietMs() {
    // ON THE WIRE THE QUIET IS THE SERVER'S OWN. The transcribe model has already waited its
    // `silenceDurationMs` before it calls the turn finished (see /voice wire quiet), so asking the
    // room for a second round of the full hold would put her a further five seconds
    // behind a measurement that has already been made. The stretches below still apply - they are
    // only ever extra patience - and the room meter still resets the clock, so a pause inside a
    // sentence is still a pause and not the end of one.
    if (wireOn) {
      var wbase = 0;
      var q = 0;
      try { q = Number(liveWire().settings().silenceMs) || 0; } catch (e) { q = 0; }
      wbase = Math.min(holdMs, Math.max(250, (q || 0) + 150));
      // THE STRETCHES ARE HALVED HERE, ON PURPOSE. They exist because a recogniser's final result is
      // a guess about the room; the model's voice-activity is not - it has already waited its whole
      // silence window before calling the turn finished. What is left is cheap insurance against the
      // one case it can still get wrong (a long clause that breathes in the middle, or a clause that
      // stops on a word a sentence does not end on), and it costs a moment rather than a sentence.
      if (holdParts.length) {
        var wt = holdText();
        if (looksUnfinished(wt)) wbase += Math.round((holdTailMs() + 600) / 2);
        wbase += Math.min(600, Math.floor(wt.split(/\s+/).filter(Boolean).length / 6) * 100);
      }
      return Math.min(wbase, TURN_MAX);
    }
    var base = holdMs + (holdSettled ? 0 : holdTailMs());
    if (holdParts.length) {
      var t = holdText();
      if (looksUnfinished(t)) base += holdTailMs() + 600;
      base += Math.min(1200, Math.floor(t.split(/\s+/).filter(Boolean).length / 6) * 200);
    }
    return Math.min(base, TURN_MAX);
  }

  // What a session heard, put in the holding pen. Her own voice (which is all a leak-on-its-own
  // produces) strips to nothing and is never held at all. `settled` is whether the newest result the
  // recogniser handed over was FINAL (true) or only INTERIM (false). `suspect` marks words heard
  // while her voice was in the room (speaking or tail): at delivery a hold that is ALL suspect is
  // still judged against her voice, while a hold carrying anything heard in the clear is his -
  // resemblance that late is conversation, never echo (2026-10-21).
  function holdHeard(id, text, from, settled, suspect) {
    var raw = String(text || "").replace(/\s+/g, " ").trim();
    var own = raw ? stripHerWords(raw) : "";
    if (!own) {
      for (var i = holdParts.length - 1; i >= 0; i--) { if (holdParts[i].id === id) holdParts.splice(i, 1); }
      return false;
    }
    var fresh = !holdParts.length;
    if (suspect == null) suspect = speaking || voiceTail();
    holdPart(id, own).text = own;
    holdPart(id, own).suspect = !!suspect;
    holdAt = Date.now();
    heardAt = holdAt;
    holdFrom = from || holdFrom;
    if (settled != null) holdSettled = !!settled;
    if (fresh) holdWarned = false;
    holdCounted = false;
    if (!holdTimer) holdTimer = setInterval(holdTick, 150);
    paintHold();
    return true;
  }

  function clearHold() {
    if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
    holdParts = [];
    holdSettled = true;
    holdCounted = false;
    heldReopenAt = 0;
    listenGen++;   // a Finger lifting clears through here (dropHold): anything scheduled by the dead
                   // session is stale. Harmless on the ordinary send path, which schedules nothing.
    paintHold();
  }

  function holdText() {
    return holdParts.map(function (p) { return p.text; }).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  // The whole of the hold is one clause: deliver it, then forget it. The sessions it came from are
  // marked taken, so the NEXT thing he says starts a fresh clause instead of carrying the delivered
  // sentence along with it (a recogniser's session remembers everything it has heard so far).
  function takeHold() {
    if (takeDefer) return "";
    // ALL-SUSPECT holds were heard entirely while her voice was in the room: judge them against
    // her voice even past the acoustic window, or a mangled re-hearing buffered through her whole
    // reply would be delivered as his turn. Anything heard in the clear makes the hold his.
    var allSuspect = holdParts.length > 0;
    for (var si = 0; si < holdParts.length; si++) { if (!holdParts[si].suspect) { allSuspect = false; break; } }
    var t = holdText();
    var from = holdFrom;
    holdParts.forEach(function (p) { consumedSids[p.id] = true; });
    clearHold();
    holdWarned = false;
    if (t && allSuspect && looksLikeHerOwn(t, true)) {
      var eb = el("userInput");
      if (eb && eb.value === t) eb.value = "";
      print("SYSTEM", echoNotice());
      return "";
    }
    // The delivery reports back: a live turn re-held in a race with her floor is not taken yet,
    // so the caller must not announce it (the tick takes it when the room is his again).
    if (t) return deliverHeld(t, from) ? t : "";
    return t;
  }

  function holdTick() {
    if (!holdParts.length) { clearHold(); return; }
    // She has the floor: do not interrupt him with his own words, and do not lose them either. The
    // hold simply restarts, so the moment she is done his sentence goes in one piece, not cut in two.
    if (sheHasTheFloor()) {
      holdAt = Date.now();
      // Talking while she merely thinks is normal and silent: the words wait and go in one piece when
      // she is done. Talking over her actual voice is worth saying out loud, once.
      if (speaking && !holdWarned) {
        holdWarned = true;
        print("SYSTEM", "VOICE :: HEARD THAT WHILE SHE WAS SPEAKING - IT IS BEING HELD, AND TAKEN THE MOMENT SHE IS DONE. (PRESS THE MICROPHONE TO HUSH HER AND TAKE IT NOW.)");
      }
      return;
    }
    // THE REVIEW LATCH OWNS THE SEND. While the intercom finger is down nothing is taken - so the
    // hold waits in silence: no "sending in x seconds" countdown (nothing goes anywhere until he
    // lifts) and no take. The clock simply restarts.
    if (takeDefer) { holdAt = Date.now(); return; }
    // THE ROOM IS STILL LOUD. Not a word handed over by the recogniser - an actual sound, measured off
    // the microphone. A pause at a breath, a word the recogniser is still chewing on, a chair, or his
    // voice arriving late: all of it resets the clock exactly as a word of his does, so nothing of his
    // is ever sent while there is still a voice in the room. (See THE ROOM HEARS YOU in the header.)
    if (levelLoud()) {
      holdAt = Date.now();
      holdCounted = false;
      if (!holdWarned && holdParts.length) {
        holdWarned = true;
        print("SYSTEM", "VOICE :: THE ROOM IS STILL LOUD, SO YOUR TURN IS STILL OPEN - IT GOES WHEN YOU STOP."
          + " (ROOM " + String(levelRms).slice(0, 5) + " VS THRESHOLD " + levelOn() + " - IF THAT IS JUST YOUR ROOM WITH YOUR MOUTH SHUT, /voice level <HIGHER> CALMS IT.)");
      }
      paintLevel();
      return;
    }
    if (Date.now() - holdAt < holdQuietMs()) {
      // THE VISIBLE ENDING. When the wait is nearly over she says so, once, so the end of his turn is
      // something he can see coming and talk over - the answer to "it sends before I am even done"
      // being a countdown he can beat, not just a longer silence. Any word of his resets both.
      var left = holdQuietMs() - (Date.now() - holdAt);
      if (left <= SEND_GRACE && !holdCounted) {
        holdCounted = true;
        print("SYSTEM", "VOICE :: YOUR TURN :: " + (left / 1000).toFixed(1) + "S TO GO - KEEP TALKING AND IT WAITS. (THE MICROPHONE SENDS IT NOW.)");
      }
      return;
    }
    takeHold();
  }

  // What was heard, actually delivered: the live channel sends it as a turn; a one-shot TALK puts
  // it in the input box and sends it only if `micAuto` says so. Speech never overwrites silently:
  // when words are already waiting (the box, the draft, or an open pencil modal), the transcript
  // is ADDED to them unless /voice speech overwrite said otherwise - overwriting is the mode that
  // asks first, by being chosen.
  function speechMode() { return store.speechAdd === "overwrite" ? "overwrite" : "append"; }
  function layHeard(target, t, where) {
    var had = String((target && target.value) || "").trim();
    if (had && had !== t) {
      if (speechMode() === "overwrite") {
        target.value = t;
        print("SYSTEM", "VOICE :: HEARD :: \"" + t.toUpperCase() + "\" :: IT REPLACED WHAT WAS WAITING " + where + " (MODE IS OVERWRITE - /voice speech append ADDS INSTEAD).");
        return "replaced";
      }
      target.value = (had + " " + t).replace(/\s+/g, " ").trim();
      print("SYSTEM", "VOICE :: HEARD :: \"" + t.toUpperCase() + "\" :: ADDED TO WHAT WAS ALREADY " + where + " - CLEAR IT FIRST TO REPLACE, OR /voice speech overwrite TO ALWAYS REPLACE.");
      return "added";
    }
    target.value = t;
    return "put";
  }
  function deliverHeld(text, from) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    if (looksLikeHerOwn(t)) {                       // all of it was her, whatever the strips left
      var eb = el("userInput");
      if (eb && eb.value === t) eb.value = "";
      print("SYSTEM", echoNotice());
      return false;
    }
    if (from === "live") return liveDeliver(t);
    // Speaking into an open pencil modal: the words go to the line being fixed, not the box.
    var modal = (window.logEdit && window.logEdit.area) ? window.logEdit.area() : null;
    if (modal) {
      pending = modal.value;
      if (layHeard(modal, t, "IN THE OPEN PENCIL LINE") === "put") print("SYSTEM", "VOICE :: HEARD :: \"" + t.toUpperCase() + "\" :: IN THE OPEN PENCIL LINE - SAVE THE LINE WHEN IT READS RIGHT.");
      try { modal.focus(); } catch (e) {}
      return true;
    }
    var box = el("userInput");
    if (window.gap && window.gap.on()) { try { t = window.gap.tag(t); } catch (e) {} }
    pending = t;
    var placed = box ? layHeard(box, t, "IN THE INPUT BOX") : "noput";
    if (micAutoOn() || (window.gap && window.gap.on())) {
      if (window.send) window.send();
    } else if (placed === "put") {
      print("SYSTEM", "VOICE :: HEARD :: \"" + t.toUpperCase() + "\" :: EDIT IT, THEN SEND.");
    } else if (placed !== "noput") {
      var draftOpen = (window.draft && window.draft.isOpen && window.draft.isOpen());
      if (draftOpen) print("SYSTEM", "VOICE :: IN THE DRAFT - EDIT IT THERE, THEN SEND.");
    }
    return true;
  }

  // Whether the live channel PRINTS what is said. The conversation is always the record - it is in the
  // transcript, the archive and her context either way - but a voice call does not have to be a wall of
  // text on the screen. Off is painted by a class on <body> (see terminal.css), so nothing is dropped;
  // and anything carrying an image is never hidden, so nothing she made can go missing.
  function liveTextOn() { return (store.liveText === null) ? true : !!store.liveText; }

  function paintLiveText() {
    try { document.body.classList.toggle("voiceOnly", !!live && !liveTextOn()); } catch (e) {}
  }

  function haltRecognition(discardHearing) {
    // SALVAGE FIRST (2026-10-21: her starting to speak ate his sentence). The open session's
    // buffer is his words up to this moment - they go into the hold (same clause, same session
    // id, so the session's own onend below only replaces them), and only what arrives AFTER is
    // refused as hers. Without this, halt-then-abort threw his half-sentence away unnamed.
    if (discardHearing) {
      var sv = null;
      try { sv = (typeof earSalvage === "function") ? earSalvage() : null; } catch (e) { sv = null; }
      earSalvage = null;
      discard = true;
      if (sv && sv.text && String(sv.text).trim()) {
        try { holdHeard(sv.sid, sv.text, sv.from || "talk", !!sv.settled); } catch (e) {}
      }
    }
    var r = recognition;
    if (listening || r) { listenGen++; heldReopenAt = 0; }
    listening = false;
    recognition = null;
    if (r) {
      try {
        r.stopped = true;
        if (discardHearing) r.abort(); else r.stop();
      } catch (e) {}
    }
    setUi();
  }

  // ---- the wire's two ends, as voice.js sees them --------------------------

  // IS HER MOUTH ON THE WIRE? True only in the live channel with the wire's speaker session open.
  function viaWire() {
    if (!live) return false;
    var W = liveWire();
    if (!W || !W.mouthReady) return false;
    try { return !!W.mouthReady(); } catch (e) { return false; }
  }

  async function wireSpeak(text) {
    var W = liveWire();
    var token = playToken;
    var res = null;
    try { res = await W.say(text); }
    catch (e) { return { ok: false, error: "THE LIVE WIRE :: " + String((e && e.message) || e) }; }
    if (token !== playToken) return { ok: false, cancelled: true };
    if (res && res.ok === false) {
      return res.cancelled ? { ok: false, cancelled: true } : { ok: false, error: String(res.error || "THE LIVE WIRE COULD NOT SAY IT") };
    }
    return { ok: true };
  }

  // HIS WORDS ARRIVE WHILE HE IS STILL SAYING THEM. The partial transcript is painted where the
  // recogniser used to paint it and handed to the same hold, so everything downstream - the room
  // meter, the visible ending, "press the microphone to send it now" - behaves exactly as before.
  // What has changed is the evidence: this text is the model's own reading of the audio being
  // streamed to it, not a recogniser's guess, and there is no session to end and no breath to
  // misread as the end of a sentence.
  function wireInterim(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return;
    heardAt = Date.now();
    // SPEAKING OVER HER STOPS HER. This is the interruption the whole transport exists for: if he
    // starts a sentence of his own while her voice is in the room, she stops mid-word - not because a
    // timer says so, but because the model heard words that are not a re-hearing of hers. Her own
    // voice off the speakers is refused here by the same guard that refuses it everywhere else.
    if (speaking && wireSpeakOver(t)) {
      var W = liveWire();
      if (W && W.hush) { try { W.hush(); } catch (e) {} }
      stopSpeakingInternal();
      print("SYSTEM", "VOICE :: YOU SPOKE OVER HER, SO SHE STOPPED MID-SENTENCE :: SHE IS LISTENING AGAIN - GO ON.");
    }
    var box = el("userInput");
    if (box && !sheHasTheFloor()) box.value = t;
    // HELD EVEN WHILE SHE HAS THE FLOOR (2026-10-21): the interim is his sentence arriving -
    // dropping it ate his turn whenever it landed during her thinking. Nothing paints into the
    // box while she works. Suspect by the acoustic rule (speaking or tail), his otherwise.
    holdHeard(wireTurnId(), t, "live", false);
  }

  // THE SERVER'S OWN END OF HIS TURN. This final is the model's, not the recogniser's: it has waited
  // its whole silence window, it is punctuated, and - unlike every result the browser's recogniser
  // ever handed over - it is the sentence, not the breath inside it.
  function wireFinal(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return;
    heardAt = Date.now();
    var box = el("userInput");
    if (sheHasTheFloor()) {
      // HELD, NOT DROPPED (2026-10-21): his turn landing while she works waits out her floor
      // and goes in one piece when she is done - the hold's own rule. Suspect by the acoustic
      // rule inside holdHeard (speaking or tail), his otherwise.
      holdHeard(wireTurnId(), t, "live", true);
      if ((speaking || voiceTail()) && t && !wireFloorWarned) { wireFloorWarned = true; print("SYSTEM", "VOICE :: HEARD THAT WHILE SHE WAS SPEAKING - IT IS BEING HELD, AND TAKEN THE MOMENT SHE IS DONE."); }
    } else {
      wireFloorWarned = false;
      if (box) box.value = t;
      holdHeard(wireTurnId(), t, "live", true);
    }
    wireSeq++;
  }

  function wireSpeakOver(t) {
    if (looksLikeHerOwn(t)) return false;
    var w = String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(function (x) { return x.length > 2; });
    return w.length >= 2;
  }

  function wireLevel(rms, loud) {
    wireRms = Number(rms) || 0;
    levelRms = wireRms;            // /voice level reports the live reading, as it always did
    if (loud) wireLoudAt = Date.now(); else wireQuietAt = Date.now();
    try { if (window.wm && window.wm.sample) window.wm.sample(wireRms); } catch (e) {}
    paintLevel();
  }

  // ---- choosing her voice on the wire -------------------------------------
  //
  // THE MODEL'S PREBUILT VOICES ARE NOT THE BROWSER'S LIST AND NOT ELEVENLABS: they are what a
  // streamed, interruptible line can be made of, and the only description of each is the one word the
  // API gives it (src/js/live.js). A word is a poor way to choose a voice, so the list can also be
  // HEARD - one short line in each, in turn, with the name printed as it starts. Nothing about any of
  // this is saved: the voice is handed to the mouth for that session only (live.js's own `voice`
  // option), so an audition that is interrupted cannot leave the channel in a voice he never chose.

  var auditionSeq = 0;     // the only audition allowed to keep talking; ++ ends the one in progress
  var auditionWas = null;  // {wasOpen, voice} - how the wire looked before it started

  // Say one line in one voice that is not saved.
  async function speakIn(name, line) {
    if (guestUp()) { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); return false; }
    var W = liveWire();
    if (!W) return false;
    var wasOpen = false, keepVoice = "";
    try { wasOpen = !!W.isOpen(); keepVoice = String(W.settings().voice); } catch (e) {}
    var ok = false;
    try {
      var r = await W.open({ mouth: true, ears: false, voice: name });
      if (!r || r.ok === false) throw new Error(String((r && r.error) || "THE MOUTH WOULD NOT OPEN"));
      var said = await wireSpeak(line);
      if (said && said.cancelled) { try { W.close(); } catch (e1) {} return false; }
      if (said && said.ok === false) throw new Error(String(said.error || "THE WIRE COULD NOT SAY IT"));
      ok = true;
      // let the last chunk land before the mouth is taken down
      await new Promise(function (res) { setTimeout(res, 350); });
    } catch (e) {
      print("SYSTEM", "VOICE :: THE WIRE COULD NOT SAY IT :: " + String((e && e.message) || e).toUpperCase());
    }
    try {
      if (wasOpen) { W.close({ mouthOnly: true }); await W.open({ mouth: true, ears: false, voice: keepVoice }); }
      else W.close();
    } catch (e2) {}
    return ok;
  }

  function stopWireAudition(tell) {
    if (!auditionSeq) { if (tell) print("SYSTEM", "VOICE :: NO AUDITION IS RUNNING. /voice wire audition STARTS ONE."); return; }
    auditionSeq++;
    var W = liveWire();
    var r = auditionWas; auditionWas = null;
    if (tell) print("SYSTEM", "VOICE :: THE AUDITION IS STOPPED. THE VOICE IN FORCE WAS NEVER TOUCHED AND IS NOT CHANGED BY ANY OF THIS.");
    if (!W) return;
    // put the mouth back the way it was found - the channel, if it was open, is left able to speak
    (async function () {
      try { W.close({ mouthOnly: true }); } catch (e) {}
      if (r && r.wasOpen && r.voice) { try { await W.open({ mouth: true, ears: false, voice: r.voice }); } catch (e) {} }
    })();
  }

  async function auditionWire(names) {
    // NOT named `audition`. That name is the BROWSER audition further down this file, and two function
    // declarations of the same name in one scope do not merge - the LAST one wins, silently. The first
    // version of this did exactly that, so /voice wire audition ran the browser's four candidates and
    // printed them as if they were the model's thirty. The wire's own runner is auditionWire.
    if (guestUp()) { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); return; }
    var W = liveWire();
    if (!W) return;
    var mine = ++auditionSeq;
    var wasOpen = false, keepVoice = "";
    try { wasOpen = !!W.isOpen(); keepVoice = String(W.settings().voice); } catch (e) {}
    auditionWas = { wasOpen: wasOpen, voice: keepVoice };
    print("SYSTEM", "VOICE :: THE WIRE WILL SAY ONE SHORT LINE IN EACH OF " + names.length + " VOICES, IN TURN - THE NAME AND THE CHARACTER THE API GIVES IT ARE PRINTED AS EACH ONE STARTS. /voice wire audition stop ENDS IT AT ANY TIME. NOTHING IS SAVED: THE VOICE IN FORCE IS STILL \"" + keepVoice.toUpperCase() + "\".");
    var spoke = 0;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (auditionSeq !== mine) return;
      print("SYSTEM", "VOICE :: " + (i + 1) + " OF " + names.length + " :: " + String(name).toUpperCase() + " \u00b7 " + String(W.voiceNote(name)).toUpperCase());
      try {
        var r = await W.open({ mouth: true, ears: false, voice: name });
        if (!r || r.ok === false) {
          print("SYSTEM", "VOICE :: \"" + String(name).toUpperCase() + "\" WOULD NOT SPEAK :: " + String((r && r.error) || "REFUSED").toUpperCase());
          continue;
        }
        var said = await wireSpeak("Patrikios, this is " + name + ".");
        if (said && said.cancelled) return;
        if (said && said.ok === false) print("SYSTEM", "VOICE :: \"" + String(name).toUpperCase() + "\" DID NOT FINISH :: " + String(said.error || "").toUpperCase());
        else spoke++;
        await new Promise(function (res) { setTimeout(res, 600); });
      } catch (e) {
        print("SYSTEM", "VOICE :: \"" + String(name).toUpperCase() + "\" FAILED :: " + String((e && e.message) || e).toUpperCase());
        await new Promise(function (res) { setTimeout(res, 300); });
      }
    }
    if (auditionSeq !== mine) return;
    auditionWas = null;
    try {
      if (wasOpen) { W.close({ mouthOnly: true }); await W.open({ mouth: true, ears: false, voice: keepVoice }); }
      else W.close();
    } catch (e3) {}
    print("SYSTEM", "VOICE :: THE AUDITION IS OVER - " + spoke + " OF " + names.length + " SPOKEN. KEEP ONE WITH /voice wire voice <NAME>, CARRY ON WITH /voice wire audition from <NAME>, OR HEAR ONE AGAIN WITH /voice wire try <NAME>. A VOICE CAN ALSO BECOME THE ONE SHE IS CLONED INTO: RECORD A SAMPLE AND PUT IT ON THE STAGE WITH /story sample <ID>.");
  }

  // THE WIRE HAS STOPPED. Nothing of the conversation is lost - the channel stays open and the
  // ordinary recogniser takes the ears back, so the call goes on in the older, slower way rather
  // than ending. /voice wire says which road is carrying it.
  function wireDead(whyMsg) {
    if (!live || !wireOn) return;
    wireOn = false;
    print("SYSTEM", "VOICE :: THE LIVE WIRE STOPPED :: " + String(whyMsg || "").toUpperCase()
      + "\nTHE CHANNEL IS STILL OPEN AND THIS BROWSER'S SPEECH RECOGNITION HAS THE EARS AGAIN - THE HOLDS AND THE ROOM METER APPLY UNTIL YOU PRESS THE MICROPHONE TWICE (CLOSE, REOPEN) TO TRY THE WIRE AGAIN.");
    levelSync();
    liveTick();
  }

  // His words, taken as a turn: into the input box (so the transcript shows what was said, and so a
  // pending attachment goes with it), then straight into the chat pipeline she already answers.
  function liveDeliver(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    // The last gate before anything becomes a turn. A transcript that is mostly a re-hearing of what
    // she just said aloud is her own voice off the speakers, not him - it is refused here, whatever
    // path it arrived by.
    if (looksLikeHerOwn(t)) {
      var echoBox = el("userInput");
      if (echoBox && echoBox.value === t) echoBox.value = "";
      print("SYSTEM", echoNotice());
      return false;
    }
    if (voiceTail() || sheHasTheFloor()) {
      // RE-HELD, NOT DROPPED (2026-10-21): the hold was taken in a race with her floor - her
      // reply landing between the tick and the delivery. The words go back into the hold under
      // a fresh clause and wait her out; the tick takes them when the room is his again.
      try { holdHeard("rehold-" + (++hearSession), t, "live", true); } catch (e) {}
      return false;
    }
    var box = el("userInput");
    if (box) box.value = t;
    pending = t;
    liveBusy = true;
    liveBusySince = Date.now();
    liveUntil = Date.now() + 90000;
    // With the transcript printed, the HITL line this turn is about to draw IS the record of what was
    // heard, so there is nothing to say here - a second copy would be noise. In voice-only mode there
    // is no line to read, so the channel acknowledges without repeating his words.
    if (!liveTextOn()) {
      var words = t.split(/\s+/).length;
      print("SYSTEM", "VOICE :: HEARD :: " + words + " WORD" + (words === 1 ? "" : "S") + " :: THE CHANNEL IS ANSWERING - PRESS THE MICROPHONE TO HUSH HER.");
    }
    if (!window.send) {
      liveBusy = false;
      print("SYSTEM", "VOICE :: THERE IS NO CHAT PIPELINE ON THIS PAGE, SO THE CHANNEL CANNOT ANSWER.");
      return false;
    }
    var p;
    try { p = window.send(); }
    catch (e) {
      liveBusy = false;
      print("SYSTEM", "VOICE :: SHE COULD NOT TAKE THAT :: " + ((e && e.message) || e));
      return false;
    }
    // Once the turn is hers, the box empties - but only if it still holds exactly what she took, so
    // anything he typed during her reply is never thrown away.
    var release = function () {
      liveBusy = false;
      var b = el("userInput");
      if (b && b.value === t) b.value = "";
    };
    if (p && typeof p.then === "function") p.then(release, release);
    return true;
  }

  // One listening session. Chrome ends a session on its own after a long silence (and always after
  // `continuous` gives up), which is why the ticker re-opens it: the channel is meant to feel open,
  // not restarted.
  function liveListen() {
    if (!live || listening || speaking) return false;
    var SR = srCtor();
    if (!SR) return false;
    var r = new SR();
    r.lang = (design().mic && design().mic.lang) || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    var heard = "";
    var interim = "";
    var heldForSession = false;
    discard = false;
    var sid = ++hearSession;
    // THE SALVAGE HOOK (2026-10-21): see startListen - her reply starting must preserve his
    // half-sentence into the hold, on the telephone road too.
    earSalvage = function () {
      var t = (heard + " " + interim).replace(/\s+/g, " ").trim();
      return t ? { sid: sid, text: t, settled: interim === "", from: "live" } : null;
    };
    r.onstart = function () { listening = true; liveWarned = false; setUi(); };
    r.onresult = function (e) {
      interim = "";
      // A clause of his was just taken from this session: the recogniser keeps everything it has heard
      // in one running list, so the delivered words must be dropped before the next clause is read.
      if (consumedSids[sid]) { consumedSids[sid] = false; heard = ""; }
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0] ? e.results[i][0].transcript : "";
        if (e.results[i].isFinal) heard = app(heard, t); else interim = app(interim, t);
      }
      // Her turn: the ears are shut - but what they buffered is HELD, not thrown away
      // (2026-10-21: throwing it away ate his half-sentence whenever she started mid-word).
      // holdHeard strips her runs out; what is wholly hers is refused below and never held.
      // Nothing paints into the box while she speaks. Said once per session: his words must
      // never die unnamed.
      if (discard || speaking || voiceTail()) {
        var rawLive = (heard + " " + interim).replace(/\s+/g, " ").trim();
        if (rawLive && looksLikeHerOwn(rawLive)) {
          if (!liveWarned) { liveWarned = true; print("SYSTEM", "VOICE :: THAT READS AS HER OWN WORDS COMING BACK - NOT TAKEN."); }
        } else if (rawLive) {
          holdHeard(sid, rawLive, "live", interim === "");
        }
        heard = ""; interim = ""; return;
      }
      // She may be THINKING - the moment he is most likely to go on with his sentence. His words are
      // held, not dropped: the hold waits for her whole turn and then takes them in one piece.
      var box = el("userInput");
      var raw = (heard + " " + interim).replace(/\s+/g, " ").trim();
      // Judged BEFORE anything is cut out of it - see the TALK path: stripping first leaves her words
      // with the evidence removed, which then reads as his own sentence.
      if (looksLikeHerOwn(raw)) {
        if (!liveWarned) { liveWarned = true; print("SYSTEM", "VOICE :: THAT READS AS HER OWN WORDS COMING BACK - NOT TAKEN."); }
        heard = ""; interim = ""; if (box && box.value === raw) box.value = ""; return;
      }
      var own = stripHerWords(raw);
      if (!own) { heard = ""; interim = ""; if (box && box.value === raw) box.value = ""; return; }
      if (box) box.value = own;
      heldForSession = true;
      holdHeard(sid, raw, "live", interim === "");
    };
    r.onerror = function (e) {
      var code = String((e && e.error) || "");
      // A refusal is final: no channel without a microphone. Silence and an abandoned session are
      // not errors here - the ticker just opens again.
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        var fatal = micError(code);
        if (fatal) print("SYSTEM", "VOICE :: " + fatal);
        stopLive(true);
        print("SYSTEM", "VOICE :: THE LIVE CHANNEL IS CLOSED.");
        return;
      }
      if (code !== "aborted" && code !== "no-speech") {
        var msg = micError(code);
        if (msg) print("SYSTEM", "VOICE :: " + msg);
      }
    };
    r.onend = function () {
      listening = false;
      recognition = null;
      earSalvage = null;
      setUi();
      var t = (heard + " " + interim).replace(/\s+/g, " ").trim();
      heard = "";
      interim = "";
      var hush = discard || voiceTail();
      var killed = discard;
      discard = false;
      if (hush) {
        // Abandoned mid-sentence: HELD, not dropped (2026-10-21) - the halt already salvaged
        // it and this only replaces the same clause; what is wholly hers is refused instead.
        if (t && looksLikeHerOwn(t)) {
          if (killed && !liveWarned) { liveWarned = true; print("SYSTEM", "VOICE :: SHE STARTED SPEAKING MID-SENTENCE - NOT TAKEN: \"" + t.slice(0, 120).toUpperCase() + (t.length > 120 ? "…" : "") + "\""); }
        } else if (t) {
          holdHeard(sid, t, "live", true, true);
        }
        return;
      }
      // A session ending is not the end of his sentence - but words already handed to the hold are
      // never handed over twice.
      if (t && !heldForSession) holdHeard(sid, t, "live", true);
    };
    recognition = r;
    try { r.start(); return true; }
    catch (e) {
      recognition = null;
      listening = false;
      setUi();
      print("SYSTEM", "VOICE :: THE MICROPHONE COULD NOT BE OPENED :: " + ((e && e.message) || e));
      stopLive(true);
      return false;
    }
  }

  // The ticker: shut the ears only while her voice is actually in the room, keep them open while she is
  // merely thinking (that is when he goes on with his sentence), and survive a session the recognizer
  // ended by itself. ON THE WIRE THERE IS NOTHING TO TICK - the ears are one stream that never ends,
  // and if it does break, live.js reopens it and says so (wireDead). This is the recogniser road.
  function liveTick() {
    if (!live) return;
    if (document.hidden) return;   // the browser stops recognition in a hidden tab; wait rather than fight it
    if (liveBusy && Date.now() >= liveUntil) liveBusy = false;   // a turn that never finished gives the floor back
    if (wireOn) return;
    if (listening && speaking) { haltRecognition(true); return; }   // her voice is in the room: ears shut
    if (listening || speaking) return;
    liveListen();
  }

  // THE WIRE'S OWN OPEN (src/js/live.js). Everything the channel already does stays: the same hold
  // pen, the same echo guard, the same record, the same reply pipeline underneath. What the wire
  // replaces is the pair of transports at the two ends - and the guess about when his turn ended.
  async function openWire() {
    var W = liveWire();
    if (!W) return false;
    live = true;
    liveBusy = false;
    liveQueue = [];
    voiceTailUntil = 0;   // the channel is being opened on purpose - his first words are his own
    W.on.interim = wireInterim;
    W.on.final = wireFinal;
    W.on.level = wireLevel;
    W.on.activity = function (kind) { if (kind === "start") heardAt = Date.now(); };
    W.on.speakStart = function () { setSpeaking(true); };
    W.on.speakEnd = function () { setSpeaking(false); liveBusy = false; };
    W.on.drift = function (said, wanted) {
      print("SYSTEM", "VOICE :: THE WIRE'S MOUTH SAID SOMETHING SLIGHTLY DIFFERENT FROM WHAT SHE WROTE ::"
        + "\nWROTE :: \"" + String(wanted).toUpperCase() + "\""
        + "\nSAID  :: \"" + String(said).toUpperCase() + "\""
        + "\nHER REPLY AND THE RECORD ARE THE WRITTEN WORDS - WHAT WAS HEARD WAS THE MOUTH'S OWN READING OF THEM, AND IT IS REPORTED RATHER THAN PASSED OFF. /voice wire check off STOPS THE CHECK.");
    };
    W.on.status = function (m) { print("SYSTEM", m); };
    W.on.dead = wireDead;
    var r = null;
    try {
      print("SYSTEM", "VOICE :: OPENING THE LIVE WIRE :: HER EARS AND HER MOUTH, ON GEMINI'S LIVE API. THE SOCKETS TAKE A MOMENT TO SAY THEY ARE READY.");
      r = await W.open({ level: levelOn(), tail: LEVEL_TAIL });
    }
    catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    if (!r || !r.ok) {
      print("SYSTEM", "VOICE :: THE LIVE WIRE COULD NOT BE OPENED :: " + String((r && r.error) || "UNKNOWN")
        + "\nTHE CHANNEL FALLS BACK TO THIS BROWSER'S SPEECH RECOGNITION - /voice wire SAYS WHAT THE WIRE NEEDS AND WHAT WENT WRONG.");
      live = false;
      wireOn = false;
      paintLiveText();
      setUi();
      return false;
    }
    wireOn = true;
    wireSeq++;
    var st = (W.settings ? W.settings() : {}) || {};
    paintLiveText();
    setUi();
    print("SYSTEM", "VOICE :: LIVE CHANNEL OPEN ON THE LIVE WIRE :: HER EARS AND HER MOUTH ARE GEMINI'S STREAMS; HER BRAIN IS STILL THIS TERMINAL'S."
      + "\nEARS :: " + String(r.ear).toUpperCase() + " - A MODEL THAT CAN ONLY WRITE TEXT, SO IT CAN NEVER ANSWER AND NEVER HEAR ITSELF. YOUR VOICE GOES UP 20MS AT A TIME AND NEVER STOPS: THERE IS NO SILENCE FOR A SESSION TO END ON AND NOTHING TO RESTART."
      + "\nYOUR TURN ENDS WHEN THE MODEL THAT IS LISTENING SAYS IT DOES - " + Math.round(Number(st.silenceMs) || 2800) + "MS OF QUIET, MEASURED, NOT GUESSED. /voice wire quiet <MS> MOVES IT."
      + "\nMOUTH :: " + String(r.mouth).toUpperCase() + " AS \"" + String(r.voice).toUpperCase() + "\" - HER REPLY STREAMS BACK AND PLAYS AS IT ARRIVES, AND IT IS OURS TO STOP: SPEAK OVER HER AND SHE STOPS MID-SENTENCE."
      + "\nTHE CONVERSATION " + (liveTextOn() ? "IS PRINTED AS USUAL" : "IS VOICE ONLY - NOT PRINTED (IT IS STILL THE RECORD)") + " :: /voice live text on|off CHANGES THAT. /voice wire HAS THE WHOLE ACCOUNT.");
    if (liveTicker) clearInterval(liveTicker);
    liveTicker = setInterval(liveTick, 300);
    return true;
  }

  async function startLive() {
    if (live) return true;
    if (mode() === "radio") { print("SYSTEM", guestUp() ? ("GUESTCOMM :: GUESTMODE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. THE LIVE CHANNEL STAYS DARK - HANG UP FIRST.") : "VOICE :: RADIO SILENCE - THE LIVE CHANNEL STAYS DARK. /mode talk TO OPEN IT."); return false; }
    if (!ready) await load();
    if (wireUsable()) {
      var wireOk = await openWire();
      if (wireOk) return true;
    }
    if (!srCtor()) {
      print("SYSTEM", "VOICE :: THIS BROWSER HAS NO SPEECH RECOGNITION, SO THERE IS NO LIVE CHANNEL (FIREFOX HAS NONE; CHROME AND EDGE DO). YOU CAN STILL TYPE, AND SHE CAN STILL TALK.");
      return false;
    }
    live = true;
    liveBusy = false;
    liveQueue = [];
    voiceTailUntil = 0;   // the channel is being opened on purpose - his first words are his own
    paintLiveText();
    setUi();
    print("SYSTEM", "VOICE :: LIVE CHANNEL OPEN :: SHE IS LISTENING. SPEAK - WHEN YOU STOP SHE ANSWERS ALOUD, THEN LISTENS AGAIN."
      + "\nTHE MICROPHONE IS THE BUTTON; PRESS IT AGAIN TO CLOSE. SHE GOES DEAF WHILE SHE SPEAKS (SO SHE CANNOT HEAR HERSELF) - PRESS THE MICROPHONE THEN TO HUSH HER AND STAY IN THE CHANNEL."
      + "\nTHE CONVERSATION " + (liveTextOn() ? "IS PRINTED AS USUAL" : "IS VOICE ONLY - NOT PRINTED (IT IS STILL THE RECORD)") + " :: /voice live text on|off CHANGES THAT.");
    if (liveTicker) clearInterval(liveTicker);
    liveTicker = setInterval(liveTick, 300);
    liveTick();
    return true;
  }

  function stopLive(silent) {
    if (!live) return false;
    live = false;
    liveBusy = false;
    if (liveTicker) { clearInterval(liveTicker); liveTicker = null; }
    liveQueue = [];
    if (wireOn) {
      wireOn = false;
      var W = liveWire();
      if (W && W.close) { try { W.close(); } catch (e) {} }
    }
    haltRecognition(true);
    if (speaking) stopSpeakingInternal();
    // THE LAST WORDS OF A CLOSED CHANNEL ARE STILL HIS. Closing the channel is as deliberate as the
    // microphone key in a one-shot session - so anything still held goes in now, rather than waiting
    // out a silence that speech is never going to break (he just put the microphone down).
    if (!silent && holdParts.length && !sheHasTheFloor()) takeHold();
    paintLiveText();
    setUi();
    if (!silent) print("SYSTEM", "VOICE :: LIVE CHANNEL CLOSED. TYPE, OR PRESS THE MICROPHONE TO OPEN IT AGAIN.");
    return true;
  }

  // The microphone button: open, close, or hush her without leaving the channel.
  function toggleLive() {
    if (mode() === "radio" && !live) { print("SYSTEM", guestUp() ? ("GUESTCOMM :: GUESTMODE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE. THE LIVE CHANNEL STAYS DARK - HANG UP FIRST.") : "VOICE :: RADIO SILENCE - THE LIVE CHANNEL STAYS DARK. /mode talk TO OPEN IT."); return false; }
    if (!live) return startLive();
    if (speaking) {
      stopSpeakingInternal();
      print("SYSTEM", "VOICE :: HUSHED :: THE CHANNEL IS STILL OPEN - SHE LISTENS AGAIN THE MOMENT YOU SPEAK.");
      liveTick();
      return true;
    }
    // SOMETHING OF HIS IS BEING HELD: this press is HIS OWN WORD THAT HE HAS FINISHED, so the hold is
    // taken now instead of the channel closing under it. Closing is what the NEXT press does - and
    // pressing to close takes it too (see stopLive), so there is no way to lose it either way.
    if (holdParts.length) {
      var took = takeHold();
      if (took) print("SYSTEM", "VOICE :: TAKEN :: THE CHANNEL IS STILL OPEN - SHE ANSWERS, THEN LISTENS AGAIN.");
      else liveTick();
      return true;
    }
    return stopLive();
  }

  // ---- modes: TEXT / RADIO SILENCE / TALK ------------------------------------
  // GUESTMODE is radio silence with a reason: while the GUESTCOMM line is up the
  // refusals below name it, so a dark mic reads as the private line, not a fault.
  function guestUp() { try { return !!(window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()); } catch (e) { return false; } }
  function guestWho() { try { return (window.guest && typeof window.guest.guestName === "function") ? String(window.guest.guestName() || "") : ""; } catch (e) { return ""; } }
  // TEXT is the chat as it has always been: type, she texts, and every voice key works by hand.
  // TEXT is the chat as it has always been: type, she texts, and every voice key works by hand.
  // RADIO SILENCE is emissions control: the microphone and the live channel stay dark and she
  // never speaks aloud - not by auto-read, not by LISTEN, not by audition. Turns are text, like
  // a chat room. TALK is the speech conversation: the live channel opens, auto-read and micAuto
  // go on, and both sides talk. The switch lives in the left panel (/mode says it in words).
  function mode() {
    var m = String(store.chan || "text").toLowerCase();
    if (m === "radio" || m === "silence" || m === "radio-silence") return "radio";
    if (m === "talk" || m === "speech" || m === "talk-mode") return "talk";
    return "text";
  }
  function modeName() { var m = mode(); return m === "radio" ? "RADIO SILENCE" : (m === "talk" ? "TALK" : "TEXT"); }
  function setMode(want) {
    var m = String(want == null ? "" : want).toLowerCase().trim();
    if (!m) { print("SYSTEM", "MODE :: " + modeName() + " :: /mode text | radio | talk."); return mode(); }
    if (/^(radio|silence|radio-silence|quiet)$/.test(m)) m = "radio";
    else if (/^(talk|speech|talk-mode|voice)$/.test(m)) m = "talk";
    else if (/^(text|chat|type)$/.test(m)) m = "text";
    else { print("SYSTEM", "MODE :: NO SUCH MODE :: /mode text | radio | talk."); return mode(); }
    // PRIVATE MODE: radio is the lock on every mic and mouth. Leaving it
    // while the guest line is up would open the live channel into her ears.
    if (guestUp() && m !== "radio") { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). THE MODE STAYS RADIO SILENCE WHILE IT IS UP - HANG UP FIRST."); return mode(); }
    store.chan = (m === "text") ? "" : m;
    save();
    if (m === "radio") {
      stopLive(true);
      stopListen(true);
      stopSpeakingInternal();
      setUi();
      print("SYSTEM", "MODE :: RADIO SILENCE :: TEXT TURNS ONLY - THE MICROPHONE AND THE LIVE CHANNEL STAY DARK, AND SHE ANSWERS IN TEXT. /mode talk TO TALK AGAIN.");
    } else if (m === "talk") {
      store.autoRead = true;
      store.micAuto = true;
      save();
      setUi();
      print("SYSTEM", "MODE :: TALK :: THE SPEECH CONVERSATION - AUTO-READ AND AUTO-SEND ARE ON, AND THE LIVE CHANNEL IS OPENING. SPEAK WHEN IT SAYS SHE IS LISTENING.");
      try {
        var opened = startLive();
        if (opened && typeof opened.then === "function") opened.then(function () {}, function () {});
      } catch (e) {}
    } else {
      stopLive(true);
      stopListen(true);
      setUi();
      print("SYSTEM", "MODE :: TEXT :: TYPE, SHE TEXTS - THE VOICE KEYS STILL WORK BY HAND (TALK, LISTEN).");
    }
    return mode();
  }

  // ---- state, text, commands ----------------------------------------------

  function voicesHeld() {
    return allHeld().filter(function (v) { return !isHiddenVoice(v); });
  }

  // ---- which of them are ON THE MENU --------------------------------------
  //
  // A browser's voice list is a wall of names - a desktop Chrome alone offers dozens, most in
  // languages she does not speak and many of them the same voice twice. Patrikios, 2026-09-29:
  // *"Give the ability to disable some voices from being selected. The code remains, but some
  // options are available."* So a voice can be taken OFF THE LIST without anything else about it
  // changing: /voice voices stops printing it, its number goes with it, /voice try and /voice
  // browser will not reach it, and /voice best will not choose it. The voice itself is not deleted
  // and not altered - it is still in the machine's list, and /voice show <NAME> puts it straight
  // back. A voice ALREADY IN USE is never changed by being hidden: no command here may silently take
  // her voice away, so hiding narrows what can be chosen NEXT and nothing else.
  function allHeld() {
    return browserVoices.length ? browserVoices : (typeof speechSynthesis !== "undefined" ? (speechSynthesis.getVoices() || []) : []);
  }
  function hiddenNames() { return Array.isArray(store.hidden) ? store.hidden : []; }
  function isHiddenVoice(v) { return !!v && hiddenNames().indexOf(String(v.name || "").toLowerCase()) !== -1; }
  function hiddenVoices() { return allHeld().filter(isHiddenVoice); }
  // The one write: handed the whole list of what is to be hidden (voice objects or names), it saves
  // once and returns what the list offers now.
  function setHiddenVoices(names) {
    var keep = {}, out = [];
    (names || []).forEach(function (x) {
      var s = String((x && x.name) || x || "").trim().toLowerCase();
      if (s && !keep[s]) { keep[s] = 1; out.push(s); }
    });
    store.hidden = out;
    save();
    setUi();
    return { hidden: hiddenVoices(), offered: voicesHeld(), total: allHeld().length };
  }
  function hiddenMatch(want) { return resolveIn(allHeld(), want); }
  function offeredMatch(want) { return resolveIn(voicesHeld(), want); }

  // The wire's own account of itself, never allowed to break a report if it is missing.
  function safeWireState() {
    var W = liveWire();
    if (!W || !W.state) return null;
    try { return W.state(); } catch (e) { return null; }
  }
  function wireQuietMs() {
    var W = liveWire();
    try { return Number(W.settings().silenceMs) || 2800; } catch (e) { return 2800; }
  }

  function state() {
    var d = design();
    var roleId = roleIdNow();
    var v = roleVoice(roleId);
    var eng = engineNow(roleId);
    var kr = keyring();
    var hasKey = !!(kr && kr.has("elevenlabs"));
    var bvoice = pickBrowserVoice(v.browser);
    var resolved = store.resolved[roleId];
    return {
      ready: ready,
      engineSetting: store.engine || d.engine,
      engineNow: eng,
      hasKey: hasKey,
      autoRead: (store.autoRead === null) ? !!d.autoRead : !!store.autoRead,
      micAuto: micAutoOn(),
      speechAdd: speechMode(),
      speaking: speaking,
      listening: listening,
      live: live,
      wire: wireOn,
      wireInfo: wireOn ? safeWireState() : null,
      air: airState(),
      liveListening: live && listening,
      liveText: liveTextOn(),
      mode: mode(),
      holdMs: holdMs,
      holdTailMs: holdTailMs(),
      holdQuietMs: holdQuietMs(),
      holdSettled: holdSettled,
      level: levelRms,              // the newest reading off the room, 0-1
      levelOn: levelOn(),           // the threshold in use (0 = the room is not measured)
      levelLoud: levelLoud(),       // is there a voice in the room right now?
      levelDown: wireOn ? "" : levelOff,   // why the meter is not running, if it could not be opened
      levelMeter: wireOn || !!levelCtx,
      turn: TURN_VERSION,
      heardAgo: heardAt ? (Date.now() - heardAt) : null,
      queued: liveQueue.length,
      holding: holdParts.length > 0,
      heldText: holdText(),
      echoGuard: true,          // her own voice off the speakers is refused before it becomes a turn
      heardVoices: (function () { try { return guard().state().kept; } catch (e) { return 0; } })(),
      role: roleId,
      browserVoice: bvoice ? bvoice.name : "",
      browserVoices: voicesHeld().length,
      browserVoicesHidden: hiddenVoices().length,
      elevenVoice: v.elevenlabs.voiceId || (resolved && resolved.id) || "",
      elevenVoiceName: resolved ? resolved.name : "",
      elevenModel: modelNow(roleId),
      elevenModelChosen: !!(store.roles[roleId] && store.roles[roleId].elevenlabs && store.roles[roleId].elevenlabs.model),
      elevenProfile: (store.roles[roleId] && store.roles[roleId].elevenlabs && store.roles[roleId].elevenlabs.profile) || "",
      // THE LOCAL VOICE (see the KOKORO block): what the model is doing on this device, which voice
      // the role on stage wears on that road, and how far the model's own list reaches. `kokoroReady`
      // is the one that costs a download to change.
      kokoroOnPage: !!kokoroEngine(),
      kokoroReady: !!(kokoroEngine() && kokoroEngine().ready()),
      kokoroLoading: !!(kokoroEngine() && kokoroEngine().loading()),
      kokoroSupported: !!(kokoroEngine() && kokoroEngine().supported()),
      kokoroVoices: (kokoroEngine() && kokoroEngine().ready()) ? kokoroEngine().state().voiceCount : 0,
      kokoroVoice: kokoroVoice(roleId),
      kokoroSpeed: kokoroSpeed(roleId),
      kokoroDevice: store.kokoroDevice || (design().kokoro && design().kokoro.device) || "wasm",
      kokoroChosen: !!(store.roles[roleId] && store.roles[roleId].kokoro && store.roles[roleId].kokoro.voice),
      lastChars: last.text.length,
      lastAt: last.ts,
      limits: limitsNow()
    };
  }

  function summary() {
    var s = state();
    return "VOICE :: ENGINE " + String(s.engineSetting).toUpperCase()
      + (s.engineSetting === "kokoro" ? (s.kokoroReady ? " (THE LOCAL VOICE - " + s.kokoroVoices + " VOICES ON THIS MACHINE)" : " (THE LOCAL VOICE - MODEL NOT FETCHED YET)")
        : (s.hasKey ? " (ELEVENLABS KEY HELD)" : (((keyring() && keyring().bypassed && keyring().bypassed("elevenlabs")) ? " (ELEVENLABS BYPASSED - THIS BROWSER'S VOICE)" : " (NO ELEVENLABS KEY - THIS BROWSER'S VOICE)"))))
      + (s.autoRead ? " :: AUTO-READ ON" : " :: AUTO-READ OFF")
      + " :: MODE " + modeName()
      + (s.wire ? " :: THE LIVE WIRE CARRIES HER VOICE" : "")
      + " :: SHE WOULD SPEAK AS " + roleLabel(s.role);
  }

  function describe() {
    var s = state();
    var v = roleVoice(s.role);
    var bs = browserSpec(pickBrowserVoice(v.browser), v.browser);
    var lines = [summary()];
    lines.push("  AS " + roleLabel(s.role) + " :: " + (s.engineNow === "elevenlabs"
      ? "ELEVENLABS \"" + String(s.elevenVoiceName || nameOfVoice(s.elevenVoice) || s.elevenVoice || "(NOT CHOSEN YET - /voice voices THEN /voice voice <ID>)").toUpperCase() + "\""
      : ((s.engineNow === "kokoro" || s.engineNow === "stream")
        ? "THE LOCAL VOICE \"" + String(s.kokoroVoice).toUpperCase() + "\" :: SPEED " + s.kokoroSpeed + " (THE ROLE'S OWN RATE - AND THE MODEL HAS NO PITCH AT ALL, SO /voice pitch DOES NOTHING ON THIS ROAD) :: " + (s.kokoroReady ? "MODEL READY ON THIS MACHINE (" + s.kokoroVoices + " VOICES)" : "MODEL NOT FETCHED YET - /voice kokoro warm")
        : "THIS BROWSER :: \"" + String(s.browserVoice || "(NO VOICE MATCHED)").toUpperCase() + "\""
          + (s.browserVoice ? " \u00b7 " + qualityWord(pickBrowserVoice(v.browser)) : "")
          + " :: RATE " + bs.rate + " PITCH " + bs.pitch)));
    if (s.engineNow === "elevenlabs") {
      lines.push("  MODEL :: " + String(s.elevenModel).toUpperCase() + (s.elevenModelChosen ? " (CHOSEN ON THIS DEVICE)" : " (THE SHIPPED DEFAULT)")
        + " :: /voice models SHOWS WHICH MODELS WERE MEASURED TO WORK AND WHAT EACH ONE COSTS, /voice model <ID> CHANGES IT.");
      if (s.elevenProfile) {
        var pr = shippedProfiles()[s.elevenProfile] || {};
        lines.push("  PROFILE :: \"" + String(s.elevenProfile).toUpperCase() + "\"" + (pr.title ? " (" + String(pr.title).toUpperCase() + ")" : "")
          + " :: HER VOICE, MODEL AND SETTINGS COME FROM IT AS ONE SET (NOTHING IS MERGED IN FROM THE SHIPPED DESIGN). /voice reset PUTS THE SHIPPED DESIGN BACK.");
        if (pr.measured && pr.measured.status) lines.push("    MEASURED " + (pr.measured.at || "") + " :: " + pr.measured.status);
      }
      lines.push("  ALSO READY IN THIS BROWSER :: \"" + String(s.browserVoice || "?").toUpperCase() + "\" (RATE " + bs.rate + ", PITCH " + bs.pitch + ")");
    }
    lines.push("  MIC :: " + (s.listening ? "OPEN" : "CLOSED") + " :: " + (s.micAuto ? "A TRANSCRIPTED SENTENCE IS SENT TO HER AT ONCE" : "A TRANSCRIPTED SENTENCE WAITS IN THE INPUT BOX")
      + " :: SPEECH " + (s.speechAdd === "overwrite" ? "REPLACES WAITING WORDS (/voice speech append TO ADD INSTEAD)" : "ADDS TO WAITING WORDS (/voice speech overwrite TO REPLACE INSTEAD)"));
    lines.push("  THE INTERCOM :: " + s.air + " :: THE TALK KEY (THE ONE-OFF MICROPHONE), THE LISTEN KEY AND THE LIVE MICROPHONE ARE ONE CHANNEL, AND ONE VOICE IS ON IT AT A TIME. WHILE SHE SPEAKS (OR WHILE A REPLY IS BEING MADE) BOTH KEYS ARE LOCKED - A PRESS CANNOT CUT HER OFF MID-SENTENCE AND CANNOT OPEN THE MICROPHONE ONTO HER OWN VOICE. THE LAMP BESIDE THEM NAMES THE STATE (STANDBY / HER VOICE / HER TURN / YOUR VOICE / HOLDING). /voice air SAYS IT; /voice stop IS STILL THE DELIBERATE WAY TO SILENCE HER, AND THE LIVE MICROPHONE STILL HUSHES HER WHILE THE CHANNEL IS OPEN. WHILE A ONE-OFF SESSION OF YOURS IS OPEN, TALK ITSELF IS THE STOP.");
    lines.push("  ECHO GUARD :: ON :: HER OWN VOICE COMING BACK OFF THE SPEAKERS IS REFUSED BEFORE IT CAN BECOME A LINE OF YOURS. THE EARS ARE SHUT FOR THE WHOLE OF HER TURN; THIS IS THE SECOND LOCK, FOR THE SPEAKER TAIL AND ANY SESSION THE RECOGNISER ENDS BY ITSELF.");
    lines.push("  END OF YOUR TURN :: " + holdMs + "MS OF QUIET IS THE FLOOR, AND THREE THINGS STRETCH IT - AN INTERIM TAIL THE RECOGNISER HAS NOT COMMITTED (+" + holdTailMs() + "MS), A CLAUSE THAT STOPS ON A WORD A SENTENCE DOES NOT END ON, AND SHEER LENGTH. THE RECOGNISER FINALISES AT EVERY BREATH, SO A PAUSE INSIDE A SENTENCE ARRIVES EXACTLY LIKE THE END OF ONE; THIS IS WHY WHAT YOU SAY IS HELD UNTIL YOU HAVE ACTUALLY STOPPED, AND WHY THINKING ALOUD NO LONGER HANDS HER THE FLOOR. THE MICROPHONE GOES A SLOW DARK GREEN WHILE SOMETHING OF YOURS IS HELD, AND SAYS WHEN THE WAIT IS NEARLY OVER (IT COUNTS) - KEEP TALKING AND IT WAITS. SAY SOMETHING WHILE SHE HAS THE FLOOR AND IT IS HELD, THEN TAKEN THE MOMENT SHE IS DONE. PRESS THE MICROPHONE TO SEND IT NOW, OR /voice hold <MS> (THE FLOOR) AND /voice tail <MS> (THE EXTRA WAIT ON AN UNFINISHED TAIL).");
    lines.push("  THE ROOM HEARS YOU :: " + (s.levelMeter
      ? ("MEASURING :: " + String(s.level).slice(0, 5) + " RIGHT NOW, AND ANYTHING AT OR ABOVE " + s.levelOn + " COUNTS AS SOUND")
      : (s.levelOn
        ? ("NOT RUNNING YET" + (s.levelDown ? " :: " + s.levelDown : "") + " - IT OPENS WITH THE MICROPHONE")
        : "OFF :: THE ROOM IS NOT MEASURED, AND THE HOLDS ABOVE ARE THE ONLY END-OF-TURN RULE"))
      + " :: THE RECOGNISER IS NOT EVIDENCE THAT YOU HAVE STOPPED TALKING - SO THE ROOM ITSELF IS LISTENED TO AS WELL, "
      + (s.wire ? "OFF THE AUDIO THAT IS ALREADY BEING STREAMED TO THE WIRE (ONE STREAM ON THE MICROPHONE, NOT TWO)" : "ON A SECOND STREAM THROUGH AN ANALYSER")
      + ", AND ANY SOUND RESETS THE CLOCK THE SAME WAY A WORD OF YOURS DOES. THIS IS WHY A PAUSE AT A BREATH CANNOT HAND HER THE FLOOR: NOTHING OF YOURS IS SENT WHILE THERE IS STILL A VOICE IN THE ROOM. THE MICROPHONE KEYS GO GREEN WHILE IT HEARS YOU. /voice level <0-1> MOVES THE THRESHOLD, /voice level off STOPS IT BEING USED; THE READING IS IN /voice.");
    lines.push("  LIVE CHANNEL :: " + (s.live
      ? (s.speaking ? "OPEN :: SHE HAS THE FLOOR - PRESS THE MICROPHONE TO HUSH HER" : "OPEN :: LISTENING")
      : "CLOSED") + " :: THE MICROPHONE BUTTON, OR /voice live on|off. THE CHANNEL KEEPS THE MICROPHONE OPEN, SENDS WHAT YOU SAY, AND SPEAKS HER REPLY; IT GOES DEAF WHILE SHE SPEAKS SO SHE CANNOT HEAR HERSELF."
      + " THE CONVERSATION IS " + (s.liveText ? "PRINTED AS USUAL (HITL + LIA ID), THE SAME LINES TYPING WOULD MAKE" : "VOICE ONLY - NOT PRINTED, THOUGH STILL THE RECORD") + " :: /voice live text on|off.");
    lines.push("  MODE :: " + (s.mode ? String(s.mode).toUpperCase() + " - HOLD, TAIL, ROOM, PRINT AND PAUSE WERE SET AS ONE" : "NONE - EVERY KNOB STANDS ON ITS OWN")
      + " :: /voice mode companion|drive|night|studio SETS THE CHANNEL FOR THE ROOM (NEVER HER VOICE, NEVER THE CAPS).");
    lines.push("  THE LIVE WIRE :: " + (s.wire ? "CARRYING THE CHANNEL" : (wireUsable() ? "READY (IT IS THE ROAD THE LIVE CHANNEL OPENS ON)" : "NOT IN USE"))
      + " :: " + (wireUsable()
        ? "GEMINI'S LIVE API AT BOTH ENDS OF THE CONVERSATION: A TEXT-ONLY STREAMING TRANSCRIBER FOR YOUR VOICE AND A STREAMED, INTERRUPTIBLE VOICE FOR HERS, WHILE HER BRAIN - THE LOREPACK, THE DIRECTIVES, THE RECORD, THE ARCHIVE - STAYS EXACTLY WHERE IT IS. /voice wire EXPLAINS IT AND SETS IT; /voice wire off PUTS THE RECOGNISER ROAD BACK."
        : String((liveWire() && liveWire().reason && liveWire().reason()) || "NO GOOGLE AI (GEMINI) KEY IS HELD - THE KEYS PANEL (KEYS \u25be) TAKES ONE."))
      + (s.wire && s.wireInfo
        ? "\n    EARS :: " + String(s.wireInfo.earModel).toUpperCase() + (s.wireInfo.ears ? " (STREAMING)" : " (NOT OPEN)") + ", QUIET ENDS YOUR TURN AFTER " + Math.round(s.wireInfo.silenceMs) + "MS"
          + "\n    MOUTH :: " + String(s.wireInfo.mouthModel).toUpperCase() + " AS \"" + String(s.wireInfo.voice).toUpperCase() + "\"" + (s.wireInfo.mouth ? " (OPEN)" : " (NOT OPEN)")
          + (s.wireInfo.sentSeconds ? " :: " + s.wireInfo.sentSeconds + "S OF YOUR VOICE SENT" + (s.wireInfo.saidSeconds ? ", " + s.wireInfo.saidSeconds + "S OF HERS SPOKEN" : "") : "")
          + (s.wireInfo.dropped ? " :: " + s.wireInfo.dropped + " SOCKET DROP" + (s.wireInfo.dropped === 1 ? "" : "S") + " REPAIRED" : "")
        : ""));
    var vpm = v.browser.voicePitch || {};
    var vpSet = Object.keys(vpm).filter(function (k) { return vpm[k] != null; });
    if (vpSet.length) lines.push("  ONE-VOICE PITCH :: " + vpSet.map(function (k) { return String(k).toUpperCase() + " PITCH " + vpm[k]; }).join(" \u00b7 ")
      + " \u00b7 THE ROLE'S OWN IS " + v.browser.pitch + " :: /voice pitch clear <NAME|#> PUTS ONE BACK.");
    lines.push("  SHOPPING FOR A VOICE: /voice best KEEPS THE HIGHEST TIER THIS MACHINE HAS WITHOUT YOUR HAVING TO CHOOSE; /voice voices LISTS THEM BY NUMBER WITH THEIR TIER, /voice try <#> HEARS ONE, /voice audition PLAYS THE BRITISH FEMALE ONES IN TURN. NEITHER TRY NOR AUDITION SAVES ANYTHING; /voice browser <#> KEEPS IT. IF ONE SOUNDS TOO HEAVY, /voice pitch <N> <#> LIFTS THAT VOICE ALONE.");
    if (isIos()) {
      lines.push("  ON AN IPHONE :: SIRI'S VOICE IS NOT OFFERED TO WEB PAGES - IT IS NOT IN THE LIST /voice voices PRINTS AND NO SETTING PUTS IT THERE. WHAT IS REACHABLE IS THE REST OF THE SYSTEM VOICES, AND THE GOOD ONES MUST BE DOWNLOADED FIRST: SETTINGS > ACCESSIBILITY > SPOKEN CONTENT > VOICES > ENGLISH, PICK A VOICE (SERENA AND KATE ARE THE BRITISH ONES, SAMANTHA THE AMERICAN) AND TAKE THE \"ENHANCED\" OR \"PREMIUM\" ONE. IT THEN ARRIVES HERE AS \"<NAME> (ENHANCED)\", THE TERMINAL PREFERS IT OVER THE SMALL ONE BY ITSELF, AND /voice best KEEPS IT. THE FIRST TOUCH ON THE PAGE IS ALSO WHAT OPENS HER MOUTH: IOS WILL NOT SPEAK ANYTHING THAT WAS NOT STARTED BY A FINGER, SO ONE SILENT SOUND IS SPENT ON THE FIRST TAP AND EVERY REPLY AFTER THAT CAN SPEAK ITSELF."
        + (s.browserVoices ? "" : " THE VOICE LIST IS EMPTY UNTIL THEN, TOO - TOUCH THE PAGE ONCE AND /voice voices WILL FILL IN."));
    }
    lines.push("  " + s.browserVoices + " VOICES AVAILABLE TO THIS BROWSER" + (bestForRole(s.role) ? " - THE BEST SHE COULD SPEAK WITH IS \"" + String(bestForRole(s.role).name).toUpperCase() + "\" (" + qualityWord(bestForRole(s.role)) + ")" : "") + ". SHE HAS LAST SAID " + s.lastChars + " CHARACTERS.");
    lines.push("  HOW MUCH SHE MAY SAY :: " + (s.engineNow === "elevenlabs"
      ? "ELEVENLABS IS TRIMMED AT " + s.limits.elevenMaxChars + " CHARACTERS A REPLY, BECAUSE IT BILLS ONE CREDIT PER CHARACTER"
      : ((s.engineNow === "kokoro" || s.engineNow === "stream")
        ? "THE LOCAL VOICE IS TRIMMED AT " + s.limits.kokoroMaxChars + " CHARACTERS A REPLY, BECAUSE IT RUNS AT ABOUT 2x REAL TIME (ABOUT TWO MINUTES OF MAKING FOR A MINUTE OF SPEECH) - /voice max kokoro <N> MOVES IT, 500-4000, AND /voice engine browser READS THE WHOLE REPLY AT ONCE AND FOR FREE"
        : "THIS BROWSER READS THE WHOLE REPLY - BROKEN AT SENTENCE ENDS INTO PIECES OF " + chunkChars() + " CHARACTERS, SO A LONG REPLY IS NOT CUT OFF MID-SENTENCE"))
      + " :: THE TERMINAL'S OWN CEILING IS " + s.limits.maxChars + " CHARACTERS (ELEVENLABS AND THE LOCAL VOICE CARRY THEIR OWN). /voice max PRINTS EVERY CEILING AND WHERE IT COMES FROM, AND SETS THEM.");
    if (s.browserVoicesHidden) {
      lines.push("  VOICES OFF THE LIST :: " + s.browserVoicesHidden + " OF THE " + allHeld().length + " VOICES THIS MACHINE HAS CANNOT BE CHOSEN - THEY ARE NOT DELETED AND NOTHING ABOUT THEM CHANGED, THEY ARE SIMPLY NOT OFFERED: NO NUMBER IN /voice voices, NO /voice try, NO /voice browser, AND /voice best WILL NOT PICK ONE."
        + "\n    /voice hidden PRINTS THEM, /voice show <NAME|#> PUTS ONE BACK, /voice hide <NAME|#> TAKES ONE OUT (all OF THEM WITH all)."
        + (function () { var u = pickBrowserVoice(roleVoice(s.role).browser); return (u && isHiddenVoice(u)) ? "\n    THE VOICE IN USE (" + String(u.name).toUpperCase() + ") IS ONE OF THEM :: SHE STILL SPEAKS WITH IT UNTIL ANOTHER IS CHOSEN - HIDING NEVER TAKES HER VOICE AWAY." : ""; })());
    }
    lines.push("  LISTEN READS HER NEWEST REPLY OUT LOUD; TALK IS THE ONE-OFF MICROPHONE (PRESS IT, SPEAK, PRESS IT AGAIN TO STOP). /voice speak <TEXT> SPEAKS ANYTHING - WHAT SHE SAYS IS THE REPLY SHE ALREADY GAVE, THE SAME ONE THE LOREPACK GROUNDED.");
    return lines.join("\n");
  }

  async function report(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var low = a.toLowerCase();
    if (!a || low === "status") { print("SYSTEM", describe()); return; }
    var parts = a.split(/\s+/);
    var verb = parts[0].toLowerCase();
    var rest = parts.slice(1).join(" ").trim();
    var roleId = roleIdNow();

    if (verb === "speak" || verb === "say") {
      if (!rest) { speakLast(); return; }
      speak(rest, { role: roleId });
      return;
    }
    // HOW MUCH SHE MAY SAY (see limitsNow). Bare prints the ceilings and where they come from; a
    // number sets them, on whichever road she is actually speaking on unless one is named.
    if (verb === "max" || verb === "limits" || verb === "chars" || verb === "length") {
      if (!rest) { print("SYSTEM", limitsText()); return; }
      if (/^(reset|default|shipped)$/i.test(rest)) {
        store.maxChars = null; store.elevenMaxChars = null; store.kokoroMaxChars = null; save();
        print("SYSTEM", "VOICE :: THE CEILINGS ARE BACK TO THE SHIPPED ONES.\n\n" + limitsText());
        return;
      }
      var m = rest.match(/^(browser|free|wire)\s+(\d+)$/i) || rest.match(/^(eleven|elevenlabs|paid)\s+(\d+)$/i) || rest.match(/^(kokoro|local|offline)\s+(\d+)$/i) || rest.match(/^(\d+)$/);
      if (!m) {
        print("SYSTEM", "VOICE :: /voice max PRINTS THE CEILINGS. TO SET ONE: /voice max <N> (WHICHEVER ROAD SHE IS SPEAKING ON), /voice max browser <N> (THIS BROWSER AND THE WIRE - FREE), /voice max eleven <N> (ELEVENLABS, UP TO ITS OWN " + limitsNow().elevenRequestMax + " A REQUEST), /voice max kokoro <N> (THE LOCAL VOICE, 500-4000 - IT IS SLOWER THAN REAL TIME), /voice max reset (THE SHIPPED NUMBERS).");
        return;
      }
      var L = limitsNow();
      var n = parseInt(m.length === 2 ? m[1] : m[2], 10);
      var which = (m.length === 2) ? (state().engineNow === "elevenlabs" ? "eleven" : ((state().engineNow === "kokoro" || state().engineNow === "stream") ? "kokoro" : "browser"))
        : (/^(eleven|elevenlabs|paid)$/i.test(String(m[1])) ? "eleven" : (/^(kokoro|local|offline)$/i.test(String(m[1])) ? "kokoro" : "browser"));
      if (!isFinite(n)) { print("SYSTEM", "VOICE :: THAT IS NOT A NUMBER OF CHARACTERS."); return; }
      if (which === "eleven") {
        var ev = Math.max(100, Math.min(L.elevenRequestMax, n));
        store.elevenMaxChars = ev; save();
        print("SYSTEM", "VOICE :: AN ELEVENLABS REPLY IS NOW TRIMMED AT " + ev + " CHARACTERS (THE ROAD BILLS ONE CREDIT PER CHARACTER)."
          + (n > ev ? " ELEVENLABS ITSELF REFUSES MORE THAN " + L.elevenRequestMax + " IN ONE REQUEST, SO THAT IS THE CEILING." : "")
          + " /voice max reset PUTS " + L.elevenMaxChars + " BACK.");
      } else if (which === "kokoro") {
        var kv2 = Math.max(500, Math.min(4000, n));
        store.kokoroMaxChars = kv2; save();
        print("SYSTEM", "VOICE :: THE LOCAL VOICE NOW STOPS AT " + kv2 + " CHARACTERS A REPLY. THIS IS NOT A SAFETY NET LIKE THE FREE ROADS' CAP - IT IS A COST OF TIME: THE MODEL RUNS AT ABOUT 2x REAL TIME ON THIS MACHINE (ABOUT TWO MINUTES OF MAKING FOR A MINUTE OF SPEECH), SO THE CEILING IS HOW LONG YOU ARE WILLING TO WAIT FOR HER TO START AND KEEP GOING. A LONGER REPLY IS CUT AT A SENTENCE END AND THE RECEIPT SAYS SO."
          + " /voice max reset PUTS " + L.kokoroMaxChars + " BACK; /voice engine browser READS THE WHOLE REPLY AT ONCE AND FOR FREE.");
      } else {
        var bv = Math.max(500, Math.min(200000, n));
        store.maxChars = bv; save();
        print("SYSTEM", "VOICE :: THIS BROWSER (AND THE WIRE) NOW STOPS AT " + bv + " CHARACTERS A REPLY - A SAFETY NET, NOT A LIMIT WORTH REACHING: THE ROAD IS FREE AND READ IN PIECES, SO A LONG REPLY IS READ WHOLE UP TO IT."
          + " /voice max reset PUTS " + L.maxChars + " BACK.");
      }
      return;
    }
    if (verb === "stop" || verb === "shut" || verb === "quiet") {
      if (listening) stopListen();
      stop();
      return;
    }
    if (verb === "air" || verb === "intercom") {
      print("SYSTEM", "VOICE :: THE INTERCOM :: " + airState()
        + "\nTHE TALK KEY (THE ONE-OFF MICROPHONE), THE LISTEN KEY AND THE LIVE MICROPHONE ARE ONE CHANNEL, AND ONE VOICE IS ON IT AT A TIME: BOTH KEYS ARE LOCKED WHILE SHE HAS THE FLOOR OR A REPLY IS BEING MADE (TALK IS STILL ITS OWN STOP WHILE A ONE-OFF SESSION IS OPEN)."
        + "\n" + airLine()
        + "\n/voice stop IS STILL THE DELIBERATE WAY TO SILENCE HER, AND THE MICROPHONE STILL HUSHES HER WHILE THE LIVE CHANNEL IS OPEN.");
      return;
    }
    if (verb === "engine") {
      var e = rest.toLowerCase();
      if (e !== "auto" && e !== "browser" && e !== "elevenlabs" && e !== "kokoro" && e !== "stream") { print("SYSTEM", "USAGE: /voice engine <auto|browser|elevenlabs|kokoro|stream>"); return; }
      store.engine = e;
      save();
      var s = state();
      print("SYSTEM", "VOICE ENGINE :: " + e.toUpperCase() + " :: SHE WILL NOW USE " + (s.engineNow === "elevenlabs" ? "ELEVENLABS" : (s.engineNow === "stream" ? "THE LOCAL VOICE, STREAMED" : (s.engineNow === "kokoro" ? "THE LOCAL VOICE (KOKORO)" : "THIS BROWSER'S VOICE")))
        + ((e === "kokoro" || e === "stream")
          ? "\nIT RUNS ON THIS MACHINE: NO KEY, NO ACCOUNT, NO BILL, AND NOTHING IT SAYS LEAVES IT. IT IS ALSO SLOWER THAN REAL TIME (ABOUT 2x), SO REPLIES ARE CAPPED AT " + limitsNow().kokoroMaxChars + " CHARACTERS AND A LONG ONE IS CUT AT A SENTENCE END. "
            + (kokoroEngine() && kokoroEngine().ready()
              ? "THE MODEL IS ALREADY HERE (" + kokoroEngine().state().voiceCount + " VOICES) :: /voice kokoro voices LISTS THEM, /voice kokoro voice <NAME|#> KEEPS ONE."
              : "THE MODEL IS NOT FETCHED YET (ABOUT 90MB, ONCE PER BROWSER) :: IT COMES ON THE FIRST THING SHE SAYS, OR NOW WITH /voice kokoro warm.")
          : "")
        + (e !== "browser" && e !== "kokoro" && e !== "stream" && !s.hasKey ? (((keyring() && keyring().bypassed && keyring().bypassed("elevenlabs")) ? " (ELEVENLABS CALLS ARE BYPASSED IN KEYS \u25be - UNCHECK THE BYPASS TO LET THEM THROUGH)" : " (NO ELEVENLABS KEY IS HELD - STORE ONE IN KEYS \u25be)")) : ""));
      return;
    }
    if (verb === "kokoro" || verb === "local") {
      var K = kokoroEngine();
      var ks = K ? K.state() : null;
      var one = (parts[1] || "").toLowerCase();
      var two = parts.slice(2).join(" ").trim();
      if (!one || one === "status") { print("SYSTEM", kokoroReport(roleId)); return; }
      if (one === "voices" || one === "list") { print("SYSTEM", kokoroRosterText(roleId)); return; }
      if (one === "warm" || one === "fetch" || one === "load") {
        if (!K) { print("SYSTEM", "VOICE :: THE LOCAL VOICE IS NOT ON THIS PAGE (src/js/kokoro.js)."); return; }
        if (K.ready()) { print("SYSTEM", "VOICE :: THE LOCAL VOICE IS ALREADY HERE :: " + ks.voiceCount + " VOICES, LOADED IN " + (ks.ms / 1000).toFixed(1) + "S (" + String(ks.dtype).toUpperCase() + " ON " + String(ks.device).toUpperCase() + "). NOTHING TO FETCH."); return; }
        print("SYSTEM", "VOICE :: FETCHING THE LOCAL VOICE :: ABOUT 90MB, ONCE PER BROWSER, AND THEN IT IS OFFLINE AND FREE. THE PAGE IS NOT BLOCKED BY THIS - IT RUNS IN A WORKER - SO YOU CAN CARRY ON TYPING.");
        (async function () {
          var t0 = Date.now();
          try {
            await K.load({ device: store.kokoroDevice || (design().kokoro || {}).device });
            print("SYSTEM", "VOICE :: THE LOCAL VOICE IS HERE :: LOADED IN " + Math.round((Date.now() - t0) / 1000) + "S :: " + K.state().voiceCount + " VOICES"
              + (K.state().threads && K.state().threads !== "?" ? " ON " + K.state().threads + " THREADS" : "") + ".\n/voice kokoro voices LISTS THEM WITH THEIR GRADES; /voice kokoro say <TEXT> HEARS ONE WITHOUT CHANGING ANYTHING; /voice engine kokoro MAKES IT HER VOICE.");
          } catch (e) {
            print("SYSTEM", "VOICE :: THE LOCAL VOICE COULD NOT BE FETCHED :: " + String((e && e.message) || e) + "\nNOTHING ELSE CHANGED - THE OTHER TWO ROADS ARE UNTOUCHED.");
          }
        })();
        return;
      }
      if (one === "device" || one === "build") {
        var dev = two.toLowerCase();
        if (dev !== "wasm" && dev !== "webgpu" && dev !== "default" && dev !== "shipped") { print("SYSTEM", "VOICE :: /voice kokoro device <wasm|webgpu> :: wasm IS THE SHIPPED BUILD (q8, WORKS EVERYWHERE, ABOUT 2x REAL TIME ON THIS MACHINE); webgpu IS FASTER (q4f16, ABOUT 1.34x) BUT NEEDS A GPU AND IS A LOWER-FIDELITY COPY OF THE SAME MODEL. A DIFFERENT BUILD IS A SECOND DOWNLOAD AND IS KEPT BESIDE THE FIRST."); return; }
        store.kokoroDevice = (dev === "default" || dev === "shipped") ? "" : dev;
        save();
        print("SYSTEM", "VOICE :: THE LOCAL VOICE WILL BE " + (store.kokoroDevice ? String(store.kokoroDevice).toUpperCase() : "THE SHIPPED BUILD (q8 ON wasm)") + " ON THIS DEVICE."
          + (K && K.ready() ? " THE MODEL ALREADY IN MEMORY IS THE OLD BUILD - /voice kokoro release DROPS IT AND THE NEXT SPEAK FETCHES THE OTHER ONE." : ""));
        return;
      }
      if (one === "release" || one === "drop" || one === "unload") {
        if (!K) { print("SYSTEM", "VOICE :: THE LOCAL VOICE IS NOT ON THIS PAGE."); return; }
        var had = ks && ks.ready ? ks.voiceCount : 0;
        K.release();
        print("SYSTEM", "VOICE :: THE LOCAL VOICE IS OUT OF MEMORY (" + had + " VOICES DROPPED). NOTHING WAS DELETED FROM THE BROWSER'S CACHE - THE NEXT SPEAK TAKES ABOUT 1.6S TO WARM UP AGAIN RATHER THAN A FULL FETCH. /voice engine kokoro IS UNAFFECTED: THE ROAD IS STILL SET, IT JUST HAS TO RELOAD.");
        return;
      }
      if (one === "voice" || one === "pick") {
        if (!K || !K.ready()) {
          print("SYSTEM", "VOICE :: THE MODEL'S VOICE LIST COMES FROM THE MODEL, SO IT HAS TO BE FETCHED FIRST: /voice kokoro warm (ABOUT 90MB, ONCE PER BROWSER). UNTIL THEN THE SHIPPED PICKS HOLD:\n" + kokoroRosterText(roleId));
          return;
        }
        if (!two || /^(default|shipped|design|clear|reset)$/i.test(two)) {
          if (store.roles[roleId]) delete store.roles[roleId].kokoro;
          save();
          print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " WEARS \"" + String(kokoroVoice(roleId)).toUpperCase() + "\" ON THE LOCAL VOICE AGAIN (THE SHIPPED PICK).");
          return;
        }
        var forRole = roleId;
        var mFor = two.match(/^(.*?)\s+for\s+([a-z0-9_-]+)$/i);
        if (mFor) { two = mFor[1].trim(); forRole = mFor[2]; }
        var hitK = /^\d+$/.test(two) ? kokoroByIdx(parseInt(two, 10)) : K.pick(two);
        if (!hitK) {
          print("SYSTEM", "VOICE :: \"" + two.toUpperCase() + "\" IS NOT ONE OF THE MODEL'S VOICES. THE WHOLE LIST IS:\n" + kokoroRosterText(roleId));
          return;
        }
        if (!store.roles[forRole]) store.roles[forRole] = {};
        store.roles[forRole].kokoro = Object.assign({}, store.roles[forRole].kokoro || {}, { voice: hitK.id, at: Date.now() });
        save();
        print("SYSTEM", "VOICE :: " + roleLabel(forRole) + " WEARS \"" + String(hitK.name).toUpperCase() + "\" (" + hitK.id + ", " + String(hitK.language).toUpperCase() + (hitK.grade ? ", GRADE " + hitK.grade : "") + ") ON THE LOCAL VOICE."
          + (forRole !== roleId ? " (SET FOR A ROLE THAT IS NOT ON STAGE.)" : "") + " NOTHING ELSE ABOUT THE ROLE CHANGED - ITS ELEVENLABS VOICE AND ITS BROWSER VOICE ARE UNTOUCHED. /voice kokoro voice default CLEARS IT BACK.");
        return;
      }
      if (one === "say" || one === "try" || one === "hear") {
        if (!two) { print("SYSTEM", "VOICE :: /voice kokoro say <TEXT> - HEARS THE LOCAL VOICE SAY A LINE, WITHOUT CHANGING ANYTHING (IT DOES NOT TOUCH WHAT LISTEN REPLAYS)."); return; }
        if (!K) { print("SYSTEM", "VOICE :: THE LOCAL VOICE IS NOT ON THIS PAGE (src/js/kokoro.js)."); return; }
        print("SYSTEM", "VOICE :: THE LOCAL VOICE SAYS :: \"" + two.toUpperCase() + "\" AS \"" + String(kokoroVoice(roleId)).toUpperCase() + "\" (SPEED " + kokoroSpeed(roleId) + "). NOTHING IS SAVED - /voice engine kokoro MAKES IT HER ROAD, /voice kokoro voice <NAME|#> KEEPS ONE.");
        var wasEng = store.engine;
        store.engine = "kokoro";
        try { await speak(two, { role: roleId, quiet: false }); } finally { store.engine = wasEng; }
        return;
      }
      if (one === "audition" || one === "roll" || one === "rollcall") {
        if (!K || !K.ready()) { print("SYSTEM", "VOICE :: THE AUDITION WALKS THE MODEL'S OWN VOICES, SO THE MODEL HAS TO BE FETCHED FIRST: /voice kokoro warm (ABOUT 90MB, ONCE PER BROWSER)."); return; }
        var argK = (parts[2] || "").trim();
        if (/^(stop|halt|end|enough)$/i.test(argK) || /^(stop|halt|end|enough)$/i.test(one)) { stop(); return; }
        var nK = /^\d+$/.test(argK) ? Math.max(1, parseInt(argK, 10)) : 0;
        var fromK = 0;
        var startK = argK && !/^\d+$/.test(argK) ? argK.replace(/^from\s+/i, "").trim().toLowerCase() : "";
        var femK = K.roster().filter(function (v) { return String(v.gender).toLowerCase() === "female"; });
        if (startK) {
          for (var fk = 0; fk < femK.length; fk++) if (String(femK[fk].name).toLowerCase() === startK || femK[fk].id === startK) { fromK = fk; break; }
        }
        var listK = femK.slice(fromK);
        if (nK) listK = listK.slice(0, nK);
        if (!listK.length) { print("SYSTEM", "VOICE :: NOTHING TO AUDITION."); return; }
        if (guestUp()) { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); return; }
        print("SYSTEM", "VOICE :: THE LOCAL VOICE AUDITIONS " + listK.length + " OF ITS " + femK.length + " FEMALE VOICES - EACH ONE SAYS ITS OWN NAME, THEN ONE LINE. NOTHING IS SAVED AND HER VOICE DOES NOT CHANGE. /voice stop ENDS IT AT ANY TIME.");
        holding = true;
        setUi();
        var tokenK = ++playToken;
        try {
          for (var ai = 0; ai < listK.length; ai++) {
            if (tokenK !== playToken) break;
            var vv = listK[ai];
            print("SYSTEM", "VOICE :: " + (ai + 1) + " / " + listK.length + " :: \"" + String(vv.name).toUpperCase() + "\" (" + vv.id + ", GRADE " + (vv.grade || "?") + ")");
            var lineK = vv.name + ". " + ((design().audition && design().audition.sample) || "The archive is open, Patrikios.");
            try {
              var madeK = await K.say(lineK, vv.id, { speed: 1, device: store.kokoroDevice || (design().kokoro || {}).device });
              if (tokenK !== playToken) break;
              var plK = await playPiece(madeK.blob);
              if (!plK.ok) { print("SYSTEM", "VOICE :: \"" + String(vv.name).toUpperCase() + "\" COULD NOT BE PLAYED :: " + String((plK.error && plK.error.message) || plK.error)); break; }
            } catch (eK) {
              print("SYSTEM", "VOICE :: \"" + String(vv.name).toUpperCase() + "\" FAILED :: " + String((eK && eK.message) || eK));
            }
          }
        } finally {
          holding = false;
          setSpeaking(false);
          setUi();
        }
        print("SYSTEM", "VOICE :: THE AUDITION IS OVER. /voice kokoro voice <NAME|#> KEEPS ONE FOR " + roleLabel(roleId) + " (NOTHING WAS CHANGED BY THE AUDITION ITSELF).");
        return;
      }
      print("SYSTEM", "VOICE :: /voice kokoro [status | voices | voice <NAME|#> [for <ROLE>] | voice default | warm | say <TEXT> | audition [N|from <NAME>] | device <wasm|webgpu> | release]\nTHE LOCAL VOICE IS A NEURAL NARRATOR THAT RUNS ON THIS MACHINE: NO KEY, NO ACCOUNT, NO BILL, AND NOTHING IT SAYS LEAVES THE DEVICE. IT IS FREE AND SLOWER THAN REAL TIME, SO IT IS OPT-IN AND CAPPED.");
      return;
    }
    if (verb === "auto") {
      var on = rest ? /^(on|yes|true|1)$/i.test(rest) : !state().autoRead;
      store.autoRead = on; save();
      print("SYSTEM", "VOICE :: AUTO-READ " + (on ? "ON :: SHE SPEAKS EACH REPLY AS IT LANDS." : "OFF :: LISTEN READS HER NEWEST REPLY OUT LOUD WHEN YOU ASK."));
      return;
    }
    if (verb === "mictest" || verb === "mictest?" || (verb === "mic" && /^(test|check|diag)/i.test(rest))) { micTest(rest.replace(/^(test|check|diag)\s*/i, "")); return; }
    if (verb === "mic" || verb === "talk") {
      if (rest && /^(on|off|yes|no|true|false|1|0)$/i.test(rest)) {
        var mo = /^(on|yes|true|1)$/i.test(rest);
        store.micAuto = mo; save();
        print("SYSTEM", "VOICE :: A TRANSCRIPTED SENTENCE " + (mo ? "IS SENT TO HER AT ONCE." : "WAITS IN THE INPUT BOX FOR YOU TO EDIT AND SEND."));
        return;
      }
      toggleMic();
      return;
    }
    if (verb === "listen") { toggleSpeak(); return; }
    if (verb === "speech" || verb === "dictate" || verb === "add") {
      var sm = String(rest || "").toLowerCase().split(/\s+/).filter(Boolean)[0] || "";
      if (sm === "append" || sm === "add" || sm === "on") { store.speechAdd = "append"; save(); print("SYSTEM", "VOICE :: SPEECH ADDS TO WAITING WORDS :: A TRANSCRIPT LANDS AFTER WHAT IS ALREADY IN THE BOX, THE DRAFT, OR AN OPEN PENCIL LINE - NOTHING SPOKEN EVER WIPES WHAT IS WAITING."); return; }
      if (sm === "overwrite" || sm === "replace" || sm === "off") { store.speechAdd = "overwrite"; save(); print("SYSTEM", "VOICE :: SPEECH REPLACES WAITING WORDS :: A TRANSCRIPT WIPES WHAT IS ALREADY IN THE BOX, THE DRAFT, OR AN OPEN PENCIL LINE. CHOSEN EXPLICITLY - /voice speech append PUTS THE SAFE WAY BACK."); return; }
      print("SYSTEM", "VOICE :: SPEECH " + speechMode().toUpperCase() + " :: " + (speechMode() === "overwrite"
        ? "A TRANSCRIPT REPLACES WHAT IS WAITING."
        : "A TRANSCRIPT IS ADDED AFTER WHAT IS WAITING - NOTHING SPOKEN WIPES IT.")
        + "\n/voice speech append|overwrite");
      return;
    }
    if (verb === "hold" || verb === "pause" || verb === "endpoint") {
      if (!rest) {
        print("SYSTEM", "VOICE :: WHAT YOU SAY IS HELD FOR AT LEAST " + holdMs + "MS OF QUIET BEFORE IT IS SENT"
          + ", PLUS " + holdTailMs() + "MS WHILE THE RECOGNISER HAS NOT YET COMMITTED THE LAST WORD IT HEARD."
          + "\nTHE RECOGNISER FINALISES AT EVERY BREATH, SO SENDING ON THE FIRST FINAL RESULT CUTS A SENTENCE IN TWO. THE HOLD IS THE END OF YOUR TURN: SPEAK, PAUSE, AND IT GOES - IN ONE PIECE."
          + "\nTWO MORE THINGS STRETCH THE WAIT, AND BOTH ARE ONLY EVER EXTRA PATIENCE: A CLAUSE THAT STOPS ON A WORD A SENTENCE DOES NOT END ON (\"...A STORY ABOUT\") IS A PAUSE BY CONSTRUCTION, AND A LONG CLAUSE BREATHES INSIDE ITSELF - THE MORE YOU HAVE SAID, THE LONGER THE PAUSE INSIDE IT MAY BE (UP TO " + TURN_MAX + "MS IN ALL). ANY WORD OF YOURS RESETS THE CLOCK."
          + "\nYOU CAN SEE IT COMING: NEAR THE END OF THE WAIT THE TERMINAL SAYS HOW LONG IS LEFT, SO KEEPING TALKING IS ALWAYS AN ANSWER. THE MICROPHONE PULSES SLOWLY DARK GREEN WHILE SOMETHING OF YOURS IS HELD, AND PRESSING IT SENDS WHAT IS HELD AT ONCE - YOUR OWN WORD THAT YOU HAVE FINISHED."
          + "\n/voice hold <MS> CHANGES THE FLOOR (" + HOLD_MIN + "-" + HOLD_MAX + "), /voice tail <MS> THE EXTRA WAIT ON AN UNFINISHED TAIL (0-" + TAIL_MAX + "). LONGER IS MORE FORGIVING OF MID-SENTENCE PAUSES; SHORTER FEELS MORE IMMEDIATE.");
        return;
      }
      var hv = Math.max(HOLD_MIN, Math.min(HOLD_MAX, parseInt(rest, 10) || holdMs));
      holdMs = hv;
      save();
      print("SYSTEM", "VOICE :: WHAT YOU SAY IS HELD FOR AT LEAST " + hv + "MS OF QUIET BEFORE IT IS SENT - PLUS THE TAIL AND THE STRETCHES, SO YOU CAN PAUSE MID-SENTENCE WITHOUT BEING CUT OFF.");
      return;
    }
    if (verb === "tail" || verb === "unsettled" || verb === "breath") {
      if (!rest) {
        print("SYSTEM", "VOICE :: THE TAIL IS " + holdTailMs() + "MS" + (holdTail == null ? " (DERIVED FROM THE HOLD - A THIRD OF IT, WITHIN 500-1200MS)." : " (SET BY YOU).")
          + "\nIT IS THE EXTRA QUIET ASKED OF THE ROOM WHILE THE RECOGNISER HAS ONLY AN INTERIM RESULT - THE LAST WORDS IT HANDED OVER ARE STILL BEING DECIDED, SO A BREATH THERE IS NOT THE END OF YOUR SENTENCE."
          + "\nTOTAL WAIT = /voice hold + THIS WHEN THE TAIL IS UNFINISHED; JUST /voice hold WHEN IT IS COMMITTED."
          + "\n/voice tail <MS> SETS IT (0-" + TAIL_MAX + "). /voice tail auto PUTS IT BACK TO FOLLOWING THE HOLD.");
        return;
      }
      if (/^(auto|default)$/i.test(rest)) {
        holdTail = null; save();
        print("SYSTEM", "VOICE :: THE TAIL FOLLOWS THE HOLD AGAIN :: " + holdTailMs() + "MS.");
        return;
      }
      var tv = Math.max(0, Math.min(TAIL_MAX, parseInt(rest, 10) || 0));
      holdTail = tv;
      save();
      print("SYSTEM", "VOICE :: AN UNFINISHED TAIL NOW WAITS AN EXTRA " + tv + "MS :: " + holdMs + "MS + " + tv + "MS = " + (holdMs + tv) + "MS OF QUIET BEFORE WHAT YOU SAID IS SENT (WHEN THE TAIL IS COMMITTED, JUST " + holdMs + "MS).");
      return;
    }
    if (verb === "level" || verb === "meter" || verb === "room") {
      var cur = levelOn();
      if (!rest) {
        print("SYSTEM", "VOICE :: THE ROOM HEARS YOU :: " + (levelCtx
          ? "MEASURING - " + String(levelRms).slice(0, 5) + " IN THE ROOM RIGHT NOW, AND " + cur + " IS SOUND."
          : (cur ? "NOT RUNNING YET (IT OPENS WHEN THE MICROPHONE DOES)." : "OFF - THE ROOM IS NOT MEASURED."))
          + (levelOff ? "\n" + levelOff : "")
          + "\nTHE RECOGNISER FINALISES AT EVERY BREATH, SO IT CANNOT TELL A PAUSE INSIDE A SENTENCE FROM THE END OF ONE. THE ROOM ITSELF CAN: WHILE THE MICROPHONE IS OPEN A SECOND STREAM IS READ THROUGH AN ANALYSER SIXTEEN TIMES A SECOND, AND ANY SOUND AT OR ABOVE THE THRESHOLD RESETS THE END-OF-TURN CLOCK THE SAME WAY A WORD OF YOURS DOES - SO NOTHING OF YOURS IS SENT WHILE THERE IS STILL A VOICE IN THE ROOM, AND SHE DOES NOT START SPEAKING UNTIL THE ROOM IS ACTUALLY QUIET EITHER. THE MICROPHONE KEYS GO GREEN WHILE IT HEARS YOU. NOTHING IS RECORDED AND NOTHING IS UPLOADED - IT IS A NUMBER."
          + "\n/voice level <0-1> SETS THE THRESHOLD (A QUIET ROOM SITS UNDER 0.01; 0.02 IS A VOICE AT SPEAKING DISTANCE; A FAN MAY SIT NEAR IT). /voice level off STOPS THE METER BEING USED AND LEAVES THE HOLDS AS THE ONLY RULE."
          + "\nA NOISE CANNOT HOLD YOUR TURN FOREVER: AFTER " + Math.round(LEVEL_MAX / 1000) + " SECONDS OF UNBROKEN LOUDNESS THE ORDINARY HOLDS TAKE OVER.");
        return;
      }
      if (/^(off|no|none|0)$/i.test(String(rest).trim())) {
        store.level = 0; save(); levelStop();
        print("SYSTEM", "VOICE :: THE ROOM IS NOT MEASURED ANY MORE :: THE HOLDS (/" + "voice hold " + holdMs + "MS) ARE THE ONLY END-OF-TURN RULE. /voice level " + cur + " PUTS THE METER BACK.");
        return;
      }
      var lv2 = Number(String(rest).trim());
      if (!isFinite(lv2) || lv2 <= 0 || lv2 >= 1) {
        print("SYSTEM", "VOICE :: /voice level <0-1> - HOW LOUD THE ROOM HAS TO BE TO COUNT AS SOUND (0.005 IS A VERY QUIET ROOM, 0.02 A VOICE AT SPEAKING DISTANCE, 0.1 IS LOUD). /voice level off STOPS THE METER BEING USED.");
        return;
      }
      store.level = lv2; save();
      if (levelCtx) { levelLoudAt = 0; levelQuietAt = Date.now(); }
      print("SYSTEM", "VOICE :: SOUND NOW MEANS " + lv2 + " OR MORE IN THE ROOM. " + (levelCtx ? "THE METER IS RUNNING - IT READS " + String(levelRms).slice(0, 5) + " AT THIS MOMENT." : "IT OPENS WITH THE MICROPHONE."));
      return;
    }
    if (verb === "silence" || verb === "pause") {
      var sv = String(rest || "").trim().split(/\s+/).filter(Boolean);
      var onoff = (sv[0] || "").toLowerCase();
      if (onoff === "on" || onoff === "off") {
        store.silence = (onoff === "on");
        save();
        print("SYSTEM", "VOICE :: THE PREGNANT PAUSE IS " + (store.silence ? "ON - HER LAMP STAYS LIT PAST THE LAST SOUND UNTIL THE METER YIELDS." : "OFF - HER LAMP FALLS THE MOMENT THE SOUND STOPS.") + " /voice silence status READS THE METER.");
        return;
      }
      var knob = function (name, key, lo, hi, unit) {
        var v = Number(sv[1]);
        if (!isFinite(v) || v < lo || v > hi) {
          print("SYSTEM", "VOICE :: /voice silence " + name + " <" + lo + "-" + hi + "> - " + unit + ". NOW " + silenceKnobs()[key] + ".");
          return;
        }
        if (key === "poeticMs" && v >= silenceKnobs().awkwardMs) { print("SYSTEM", "VOICE :: THE POETIC LINE MUST SIT BEFORE THE AWKWARD ONE (" + silenceKnobs().awkwardMs + "MS)."); return; }
        if (key === "awkwardMs" && v <= silenceKnobs().poeticMs) { print("SYSTEM", "VOICE :: THE AWKWARD LINE MUST SIT PAST THE POETIC ONE (" + silenceKnobs().poeticMs + "MS)."); return; }
        if (key === "poeticMs") store.silencePoetic = v;
        else if (key === "awkwardMs") store.silenceAwkward = v;
        else if (key === "thresh") store.silenceThresh = v;
        else store.silenceGate = v;
        save();
        print("SYSTEM", "VOICE :: THE PAUSE NOW " + (key === "poeticMs" ? "TURNS POETIC AT " + v + "MS" : (key === "awkwardMs" ? "TURNS AWKWARD AT " + v + "MS" : (key === "thresh" ? "YIELDS AT " + v : "GATES BELOW " + v))) + ". IT APPLIES TO THE NEXT THING SHE SAYS ON THE STREAM ROAD.");
      };
      if (onoff === "poetic") { knob("poetic", "poeticMs", 200, 1500, "MS OF QUIET THAT READS AS POETRY"); return; }
      if (onoff === "awkward") { knob("awkward", "awkwardMs", 1000, 4000, "MS OF QUIET THAT FORCES THE YIELD"); return; }
      if (onoff === "thresh" || onoff === "threshold") { knob("thresh", "thresh", 0.5, 0.95, "TURN-YIELD SCORE THAT OPENS THE FLOOR"); return; }
      if (onoff === "gate") { knob("gate", "minSem", 0.3, 0.8, "SEMANTIC COMPLETENESS BELOW WHICH NOTHING YIELDS"); return; }
      var sk = silenceKnobs();
      var ls = lastSilence;
      print("SYSTEM", "VOICE :: THE PREGNANT PAUSE :: " + (silenceOn() ? "ON - HER LAMP STAYS LIT PAST THE LAST SOUND UNTIL THE METER YIELDS" : "OFF - HER LAMP FALLS THE MOMENT THE SOUND STOPS")
        + "\nPOETIC " + sk.poeticMs + "MS · AWKWARD " + sk.awkwardMs + "MS · THRESH " + sk.thresh + " · GATE " + sk.minSem
        + (ls ? "\nLAST TURN " + ls.score + " (" + (ls.yield ? "YIELDED" + (ls.forced ? ", FORCED" : "") : (ls.gated ? "GATED" : "HELD")) + " :: SEM " + ls.parts.sem + " PAUSE " + ls.parts.pause + " FALL " + ls.parts.fall + ")" : "\nNO TURN SCORED YET ON THE STREAM ROAD.")
        + "\n/voice silence on|off · poetic <MS> · awkward <MS> · thresh <0-1> · gate <0-1>.");
      return;
    }
    if (verb === "live" || verb === "channel" || verb === "conversation") {
      var lv = String(rest || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (lv[0] === "text" || lv[0] === "transcript" || lv[0] === "print") {
        var show = lv[1] ? /^(on|yes|true|1|show)$/.test(lv[1]) : !liveTextOn();
        store.liveText = show;
        save();
        paintLiveText();
        print("SYSTEM", "VOICE :: IN THE LIVE CHANNEL THE CONVERSATION " + (show
          ? "IS PRINTED AS USUAL :: YOUR WORDS AS HITL, HERS AS LIA ID."
          : "IS NOT PRINTED - VOICE ONLY :: WHILE THE CHANNEL IS OPEN THE CONVERSATION IS HELD BACK FROM THE SCREEN (ALL OF IT, NOT JUST THE NEW LINES) AND COMES BACK THE MOMENT IT CLOSES. NOTHING IS LOST - STILL THE RECORD, STILL IN THE ARCHIVE AND IN HER CONTEXT, STILL HER OWN REPLY. ANYTHING CARRYING AN IMAGE STILL SHOWS, AND IF HER VOICE FAILS HER WORDS ARE PRINTED AFTER ALL. /voice live text on PUTS IT BACK NOW."));
        return;
      }
      if (rest && /^(on|yes|true|1)$/i.test(rest)) { await startLive(); return; }
      if (rest && /^(off|no|false|0)$/i.test(rest)) { stopLive(); return; }
      toggleLive();
      return;
    }
    if (verb === "mode" || verb === "scene" || verb === "preset") {
      var modes = {
        companion: { text: true, hold: 5000, tail: null, level: null, poetic: 700, awkward: 2200, thresh: 0.72,
          why: "THE BALANCED ROOM :: PATIENT ENOUGH FOR MID-SENTENCE PAUSES, PRINTED AS USUAL." },
        drive: { text: false, hold: 1800, tail: 500, level: 0.05, poetic: 500, awkward: 1500, thresh: 0.65,
          why: "THE CAR :: SHORT HOLDS, ROAD NOISE IGNORED, NOTHING ON THE SCREEN - EYES ON THE ROAD." },
        night: { text: false, hold: 5000, tail: null, level: 0.008, poetic: 900, awkward: 3000, thresh: 0.72,
          why: "THE BEDSIDE :: WHISPERS HEARD, LONG PAUSES WELCOME, SCREEN DARK." },
        studio: { text: true, hold: 2500, tail: null, level: 0.008, poetic: 700, awkward: 2200, thresh: 0.72,
          why: "THE QUIET DESK :: QUICK AND PRINTED, FOR READING ALONG AND DICTATION." }
      };
      var alias = { home: "companion", room: "companion", default: "companion", car: "drive", road: "drive", cockpit: "drive",
        bedside: "night", sleep: "night", whisper: "night", quiet: "studio", desk: "studio", dictation: "studio" };
      var listModes = function () { return "companion (home) · drive (car) · night (bedside) · studio (desk)"; };
      var want = String(rest || "").toLowerCase().split(/\s+/).filter(Boolean)[0] || "";
      if (alias[want]) want = alias[want];
      if (!want) {
        print("SYSTEM", "VOICE :: MODE " + (store.mode ? String(store.mode).toUpperCase() + " :: " : "") + "ONE WORD SETS THE WHOLE CHANNEL FOR THE ROOM YOU ARE IN - HOLD, TAIL, ROOM THRESHOLD, PRINTED OR VOICE-ONLY, AND HER PAUSE. NEVER HER VOICE (ENGINE, RATE, PITCH) AND NEVER THE CAPS - THOSE STAY YOURS.\n" + listModes() + "\n/voice mode <NAME> KEEPS IT ON THIS DEVICE.");
        return;
      }
      var mp = modes[want];
      if (!mp) { print("SYSTEM", "VOICE :: NO MODE " + want.toUpperCase() + " :: " + listModes() + "."); return; }
      store.mode = want;
      store.micAuto = true; store.autoRead = true; store.speechAdd = "append";
      store.liveText = mp.text;
      holdMs = mp.hold; holdTail = mp.tail; store.level = mp.level;
      store.silence = true; store.silencePoetic = mp.poetic; store.silenceAwkward = mp.awkward; store.silenceThresh = mp.thresh;
      save(); paintLiveText();
      print("SYSTEM", "VOICE :: MODE " + want.toUpperCase() + " :: " + mp.why
        + "\nHOLD " + mp.hold + "MS" + (mp.tail == null ? " · TAIL FOLLOWS THE HOLD" : " · TAIL +" + mp.tail + "MS")
        + " · ROOM " + (mp.level == null ? "SHIPPED" : mp.level) + " · " + (mp.text ? "PRINTED" : "VOICE ONLY")
        + " · PAUSE " + mp.poetic + "/" + mp.awkward + "MS@" + mp.thresh
        + "\nSHE SENDS WHAT SHE HEARS AT ONCE AND SPEAKS EVERY REPLY. /voice mode SAYS WHAT IS SET; ANY SINGLE KNOB AFTER THIS STILL MOVES ON ITS OWN.");
      return;
    }
    if (verb === "wire" || verb === "livewire") {
      var W = liveWire();
      if (!W) { print("SYSTEM", "VOICE :: src/js/live.js IS NOT LOADED ON THIS PAGE, SO THERE IS NO WIRE. /backup diag NAMES THE FILES THAT DID NOT ARRIVE."); return; }
      if (!ready) await load();
      if (!(await W.load())) { /* the shipped defaults stand */ }
      var wv = String(rest || "").trim().split(/\s+/).filter(Boolean);
      var one = (wv[0] || "").toLowerCase();
      var two = wv.slice(1).join(" ").trim();
      if (!one) { print("SYSTEM", W.describe()); return; }
      if (one === "status") { print("SYSTEM", W.describe()); return; }
      if (one === "on" || one === "off") {
        var want = one === "on";
        await W.setSetting("on", want);
        print("SYSTEM", "VOICE :: THE LIVE WIRE IS " + (want ? "PREFERRED" : "NOT PREFERRED") + " FOR THE LIVE CHANNEL."
          + "\nIT IS READ WHEN THE CHANNEL OPENS, SO PRESS THE MICROPHONE TWICE (CLOSE, REOPEN) TO MAKE IT SO NOW."
          + (want && !W.available() ? "\nIT CANNOT BE OPENED YET :: " + String(W.reason()) : ""));
        return;
      }
      if (one === "quiet" || one === "silence" || one === "hold") {
        if (!two) {
          print("SYSTEM", "VOICE :: ON THE WIRE THE END OF YOUR TURN IS THE MODEL'S OWN VOICE-ACTIVITY: " + wireQuietMs() + "MS OF QUIET IS THE WHOLE RULE."
            + "\nTHE MODEL IS LISTENING TO THE AUDIO ITSELF, SO THIS IS A MEASUREMENT AND NOT A GUESS - THERE IS NO BREATH THAT CAN LOOK LIKE THE END OF A SENTENCE, AND NO RECOGNISER SESSION THAT ENDS ON ITS OWN."
            + "\n/voice wire quiet <MS> (500-8000) MOVES IT, AND IT APPLIES THE NEXT TIME THE CHANNEL OPENS. SHORTER FEELS MORE IMMEDIATE; LONGER IS MORE FORGIVING OF A PAUSE MID-SENTENCE. END-OF-SPEECH SENSITIVITY IS SET TO LOW AS WELL, WHICH IS THE \"ENDS SPEECH LESS OFTEN\" DIRECTION.");
          return;
        }
        var qv = Math.max(500, Math.min(8000, parseInt(two, 10) || 2800));
        await W.setSetting("silenceMs", qv);
        print("SYSTEM", "VOICE :: THE WIRE NOW CALLS YOUR TURN FINISHED AFTER " + qv + "MS OF QUIET. IT APPLIES THE NEXT TIME THE CHANNEL OPENS (PRESS THE MICROPHONE TWICE).");
        return;
      }
      if (one === "voice") {
        if (!two) {
          print("SYSTEM", "VOICE :: HER VOICE ON THE WIRE IS \"" + String(W.settings().voice).toUpperCase() + "\"."
            + (W.hiddenVoices().length ? "\n" + W.hiddenVoices().length + " OF THE MODEL'S VOICES ARE OFF THE LIST AND NOT OFFERED (/voice wire hidden SHOWS THEM, /voice wire show <NAME> PUTS ONE BACK)." : "")
            + "\nTHESE ARE THE MODEL'S OWN PREBUILT VOICES - NOT THE BROWSER'S LIST AND NOT ELEVENLABS - AND THEY ARE WHAT A STREAMED, INTERRUPTIBLE LINE CAN BE MADE OF, EACH WITH THE ONE-WORD CHARACTER THE API GIVES IT:"
            + "\n" + W.voicesText()
            + "\n/voice wire voice <NAME> CHOOSES ONE; /voice wire try <NAME> HEARS IT FIRST (IT SPEAKS A LINE WITHOUT TOUCHING WHAT LISTEN REPLAYS); /voice wire audition SAYS THEM ALL IN TURN. THE VOICE ONLY EXISTS WHERE THE WIRE'S MOUTH IS OPENING - IN THE LIVE CHANNEL - AND IN try/audition.");
          return;
        }
        if (W.isHidden(two)) {
          print("SYSTEM", "VOICE :: \"" + String(two).toUpperCase() + "\" IS OFF THE LIST - IT WAS HIDDEN ON THIS DEVICE, SO THE WIRE WILL NOT KEEP IT. /voice wire show " + String(two).toUpperCase() + " PUTS IT BACK (THE CODE NEVER LOST IT), OR PICK ONE OF THESE:"
            + "\n" + W.voicesText());
          return;
        }
        var before = W.settings().voice;
        await W.setSetting("voice", two);
        print("SYSTEM", "VOICE :: HER VOICE ON THE WIRE IS \"" + String(W.settings().voice).toUpperCase() + "\" (WAS \"" + String(before).toUpperCase() + "\"). IF THE MODEL REFUSES A NAME IT SAYS SO THE FIRST TIME IT IS ASKED TO SPEAK WITH IT, AND THE VOICE BEFORE IT IS ONLY A /voice wire voice AWAY.");
        if (live) { print("SYSTEM", "VOICE :: THE CHANNEL IS OPEN ON THE WIRE'S MOUTH ALREADY - PRESS THE MICROPHONE TWICE (CLOSE, REOPEN) TO SPEAK IN THE NEW VOICE."); }
        return;
      }
      if (one === "try") {
        if (!two) { print("SYSTEM", "VOICE :: /voice wire try <NAME> [TEXT] - HEARS THE WIRE SAY A LINE IN ONE OF THE MODEL'S VOICES, WITHOUT SAVING IT. /voice wire voices LISTS THEM WITH WHAT EACH ONE SOUNDS LIKE, AND /voice wire audition HEARS THEM ALL IN TURN."); return; }
        var bits = two.split(/\s+/);
        var name = bits[0];
        if (W.isHidden(name)) {
          print("SYSTEM", "VOICE :: \"" + String(name).toUpperCase() + "\" IS OFF THE LIST - IT WAS HIDDEN ON THIS DEVICE, SO THE WIRE WILL NOT SAY A LINE IN IT. /voice wire show " + String(name).toUpperCase() + " PUTS IT BACK IN THE LIST (THE CODE NEVER LOST IT), OR HEAR ONE OF THESE:"
            + "\n" + W.voicesText());
          return;
        }
        var line = bits.slice(1).join(" ") || "Patrikios, this is the voice of the wire, and it is streaming to you in pieces as it is made.";
        print("SYSTEM", "VOICE :: THE WIRE SAYS :: \"" + line.toUpperCase() + "\" IN \"" + name.toUpperCase() + "\" \u00b7 " + String(W.voiceNote(name)).toUpperCase() + ". NOTHING IS SAVED - /voice wire voice " + name.toUpperCase() + " KEEPS IT.");
        var wasLive = live;
        live = true;
        await speakIn(name, line);
        live = wasLive;
        return;
      }
      if (one === "audition") {
        var argA = String(two || "").trim();
        if (/^(stop|halt|end|enough|no)$/i.test(argA)) { stopWireAudition(true); return; }
        var namesA = W.voices();
        var fromA = 0;
        // WHERE TO START: nothing (the whole set), a count, `from <NAME>`, or a name on its own. A NAME
        // THAT IS NOT ONE OF THE WIRE'S IS REFUSED - the first version of this ignored anything it did
        // not recognise and ran all thirty, which turns a typo into a two-minute recital.
        var startName = "";
        if (/^from\s+/i.test(argA)) startName = argA.replace(/^from\s+/i, "").trim().toLowerCase();
        else if (argA && !/^\d+$/.test(argA)) startName = argA.toLowerCase();
        if (startName) {
          var foundA = false;
          for (var fi = 0; fi < namesA.length; fi++) if (namesA[fi].toLowerCase() === startName) { fromA = fi; foundA = true; break; }
          if (!foundA && W.isHidden(startName)) {
            print("SYSTEM", "VOICE :: \"" + startName.toUpperCase() + "\" IS OFF THE LIST - IT WAS HIDDEN ON THIS DEVICE, SO THE AUDITION SKIPS IT. /voice wire show " + startName.toUpperCase() + " PUTS IT BACK IN THE LIST, AND /voice wire hidden SHOWS WHAT IS OFF.");
            return;
          }
          if (!foundA) {
            print("SYSTEM", "VOICE :: \"" + startName.toUpperCase() + "\" IS NOT ONE OF THE WIRE'S VOICES. /voice wire voices LISTS THEM ALL, WITH WHAT EACH ONE SOUNDS LIKE; /voice wire audition ON ITS OWN HEARS THE LOT.");
            return;
          }
        }
        var listA = namesA.slice(fromA);
        if (/^\d+$/.test(argA)) listA = listA.slice(0, Math.max(1, parseInt(argA, 10)));
        await auditionWire(listA);
        return;
      }
      if (one === "voices") {
        print("SYSTEM", "VOICE :: THE WIRE'S VOICES :: THE MODEL'S OWN PREBUILT SET - NOT THE BROWSER'S LIST AND NOT ELEVENLABS - EACH WITH THE ONE-WORD CHARACTER THE API GIVES IT. THE ONE IN FORCE IS \"" + String(W.settings().voice).toUpperCase() + "\"."
          + "\n" + W.voicesText()
          + (W.hiddenVoices().length ? "\n" + W.hiddenVoices().length + " OF THE " + W.voicesAll().length + " VOICES ARE OFF THE LIST AND NOT OFFERED - /voice wire hidden SHOWS THEM, /voice wire show <NAME> PUTS ONE BACK." : "")
          + "\n/voice wire voice <NAME> KEEPS ONE \u00b7 /voice wire try <NAME> HEARS ONE \u00b7 /voice wire audition SAYS THE LOT IN TURN (/voice wire audition stop ENDS IT). A WORD IS A POOR WAY TO CHOOSE A VOICE, SO THE AUDITION IS THE HONEST ONE.");
        return;
      }
      if (one === "hide" || one === "show") {
        // WHICH VOICES ARE ON THE MENU (src/js/live.js, the `hidden` setting). Patrikios: *"Give the
        // ability to disable some voices from being selected. The code remains, but some options are
        // available."* So nothing is deleted from the table - hiding only takes a voice OFF THE LIST
        // of what may be chosen: /voice wire voices does not print it, the audition skips it, and
        // /voice wire voice will not keep it. A voice already in force is never changed by hiding it.
        var wantHide = one === "hide";
        var hv = W.hiddenVoices();
        var allN = W.voicesAll();
        if (!two) {
          print("SYSTEM", "VOICE :: /voice wire hide <NAME|all> TAKES A VOICE OFF THE LIST OF WHAT MAY BE CHOSEN. THE CODE STILL CARRIES EVERY ONE OF THEM - ITS CHARACTER AND ITS PLACE IN THE TABLE ARE UNTOUCHED - AND NOTHING ELSE ABOUT THE VOICE CHANGES: WHAT IS NARROWED IS ONLY WHAT THE WIRE WILL OFFER OR KEEP. /voice wire show <NAME|all> PUTS ONE BACK, AND /voice wire hidden PRINTS WHAT IS OFF."
            + (hv.length ? "\nRIGHT NOW OFF THE LIST (" + hv.length + " OF " + allN.length + ") :: " + hv.map(function (n) { return String(n).toUpperCase(); }).join(", ") + "." : "\nRIGHT NOW NOTHING IS OFF THE LIST - ALL " + allN.length + " ARE OFFERED."));
          return;
        }
        if (/^(all|every|everything)$/i.test(two)) {
          var resAll = W.setHidden(wantHide ? allN : []);
          print("SYSTEM", "VOICE :: ALL " + resAll.total + " OF THE WIRE'S VOICES ARE " + (wantHide
            ? "OFF THE LIST :: NOTHING CAN BE CHOSEN OR AUDITIONED, AND NOTHING HAS BEEN DELETED - THE TABLE IN src/js/live.js IS UNTOUCHED. /voice wire show <NAME> PUTS ONE BACK."
            : "OFFERED AGAIN :: THE WHOLE " + resAll.total + " ARE BACK IN THE LIST.")
            + (wantHide && W.isHidden(resAll.voice) ? "\nTHE VOICE IN FORCE, \"" + String(resAll.voice).toUpperCase() + "\", IS ONE OF THEM AND STAYS IN FORCE - HIDING NEVER TAKES HER VOICE AWAY - BUT IT IS NOT OFFERED AGAIN." : ""));
          return;
        }
        var want2 = String(two).trim().toLowerCase(), hit2 = "";
        for (var h1 = 0; h1 < allN.length; h1++) if (allN[h1].toLowerCase() === want2) hit2 = allN[h1];
        if (!hit2) for (var h2 = 0; h2 < allN.length; h2++) if (allN[h2].toLowerCase().indexOf(want2) !== -1) hit2 = allN[h2];
        if (!hit2) {
          print("SYSTEM", "VOICE :: \"" + String(two).toUpperCase() + "\" IS NOT ONE OF THE WIRE'S VOICES :: /voice wire voices LISTS WHAT IS OFFERED AND /voice wire hidden WHAT IS OFF.");
          return;
        }
        var nextHidden = hv.slice();
        var at2 = nextHidden.indexOf(hit2);
        if (wantHide) { if (at2 === -1) nextHidden.push(hit2); }
        else if (at2 !== -1) nextHidden.splice(at2, 1);
        var res2 = W.setHidden(nextHidden);
        print("SYSTEM", "VOICE :: \"" + hit2.toUpperCase() + "\" IS " + (wantHide ? "OFF THE LIST" : "BACK IN THE LIST") + " :: " + res2.visible.length + " OF " + res2.total + " VOICES CAN BE CHOSEN NOW."
          + (wantHide && String(res2.voice).toLowerCase() === hit2.toLowerCase()
            ? "\nIT IS THE VOICE IN FORCE AND IT STAYS IN FORCE - HIDING NEVER TAKES HER VOICE AWAY, IT ONLY NARROWS WHAT CAN BE CHOSEN. /voice wire show " + hit2.toUpperCase() + " PUTS IT BACK IN THE LIST."
            : "\nNOT ONE LINE OF CODE CHANGED: THE VOICE IS STILL IN THE TABLE, WITH ITS CHARACTER, AND /voice wire show " + hit2.toUpperCase() + " PUTS IT BACK."));
        return;
      }
      if (one === "hidden") {
        var hid2 = W.hiddenVoices();
        var tot2 = W.voicesAll().length;
        print("SYSTEM", "VOICE :: THE WIRE'S VOICES THAT ARE OFF THE LIST (" + hid2.length + " OF " + tot2 + ") ::"
          + (hid2.length
            ? "\\n" + hid2.map(function (n, i) { return "   " + (i + 1) + ". " + String(n).toUpperCase() + " \\u00b7 " + String(W.voiceNote(n)).toUpperCase(); }).join("\\n")
              + "\\nTHEY ARE NOT DELETED - EVERY ONE IS STILL IN THE TABLE IN src/js/live.js - THEY ARE SIMPLY NOT OFFERED: /voice wire voices DOES NOT PRINT THEM, /voice wire audition SKIPS THEM, AND /voice wire voice WILL NOT KEEP THEM. /voice wire show <NAME|#> PUTS ONE BACK, /voice wire show all PUTS THE LOT BACK."
            : "\\n   NOTHING - EVERY ONE OF THE " + tot2 + " IS OFFERED."));
        return;
      }
      if (one === "models") {
        print("SYSTEM", "VOICE :: ASKING THE KEY WHICH LIVE MODELS IT CAN REACH ...");
        try {
          var list = await W.models(two === "refresh");
          print("SYSTEM", "VOICE :: THE LIVE MODELS THIS KEY CAN REACH (" + list.length + ") ::"
            + (list.length ? "\n   " + list.join("\n   ").toUpperCase() : "\n   NONE :: THIS KEY CAN HOLD NO LIVE SESSION.")
            + "\nTHE EARS USE " + String(W.settings().earModel).toUpperCase() + " AND HER MOUTH " + String(W.settings().mouthModel).toUpperCase() + "."
            + "\n/voice wire ear <MODEL> AND /voice wire mouth <MODEL> OVERRIDE EITHER; A NAME THIS KEY CANNOT REACH IS REPORTED WHEN THE CHANNEL OPENS.");
        } catch (e) {
          print("SYSTEM", "VOICE :: THE MODEL LIST COULD NOT BE READ :: " + String((e && e.message) || e).toUpperCase());
        }
        return;
      }
      if (one === "ear" || one === "mouth") {
        if (!two) { print("SYSTEM", "VOICE :: /voice wire " + one + " <MODEL-ID> - " + (one === "ear" ? "THE MODEL THAT WRITES YOUR WORDS DOWN. IT MUST BE ONE THAT CAN HOLD A LIVE SESSION; A TEXT-ONLY ONE CANNOT ANSWER, WHICH IS WHY THE EAR CANNOT TALK BACK." : "THE MODEL THAT SPEAKS HER LINE. IT MUST ACCEPT AUDIO OUTPUT.") + " /voice wire models LISTS THEM."); return; }
        await W.setSetting(one === "ear" ? "earModel" : "mouthModel", two);
        print("SYSTEM", "VOICE :: THE WIRE'S " + (one === "ear" ? "EARS" : "MOUTH") + " WILL USE \"" + String(two).toUpperCase() + "\" THE NEXT TIME IT OPENS.");
        return;
      }
      if (one === "check") {
        var cw = two ? /^(on|yes|true|1)$/i.test(two) : !W.settings().check;
        await W.setSetting("check", cw);
        print("SYSTEM", "VOICE :: WHAT THE WIRE'S MOUTH ACTUALLY SAYS " + (cw ? "IS" : "IS NOT") + " TRANSCRIBED BACK AND COMPARED WITH WHAT IT WAS GIVEN."
          + (cw ? " A PARAPHRASE IS REPORTED IN HER OWN WORDS RATHER THAN PASSED OFF - HER REPLY AND THE RECORD ARE THE WRITTEN WORDS EITHER WAY." : ""));
        return;
      }
      if (one === "now" || one === "reopen") {
        var wasOpen = live;
        if (wasOpen) stopLive(true);
        if (!wasOpen) { print("SYSTEM", "VOICE :: THE CHANNEL IS NOT OPEN. /voice live on OPENS IT ON THE WIRE."); return; }
        var okNow = await startLive();
        print("SYSTEM", okNow ? "VOICE :: THE CHANNEL IS OPEN AGAIN." : "VOICE :: THE CHANNEL COULD NOT BE OPENED AGAIN.");
        return;
      }
      print("SYSTEM", "VOICE :: /voice wire [status] \u00b7 on|off \u00b7 quiet <MS> \u00b7 voice [<NAME>] \u00b7 voices \u00b7 hide|show <NAME|all> \u00b7 hidden \u00b7 try <NAME> [TEXT] \u00b7 audition [<N>|<NAME>|from <NAME>|stop] \u00b7 models [refresh] \u00b7 ear <MODEL> \u00b7 mouth <MODEL> \u00b7 check on|off \u00b7 now");
      return;
    }
    if (verb === "voices" || verb === "voice" && rest === "list") { listVoices(rest === "list" ? true : false); return; }
    if (verb === "voice") {
      if (!rest) { print("SYSTEM", "USAGE: /voice voice <ID|NAME> (ELEVENLABS) \u00b7 /voice browser <NAME> \u00b7 /voice voices"); return; }
      setElevenVoice(rest, roleId);
      return;
    }
    // WHICH MODEL, AND WHICH PROFILE. Two halves of the same question: the model is what earns the
    // words and the profile is the whole voice as Patrikios configured it elsewhere. Both are
    // per-role overrides on this device; the shipped design is one `/voice model default` or
    // `/voice profile reset` away.
    if (verb === "models" || verb === "model") {
      if (!rest || verb === "models") { print("SYSTEM", modelReport(roleId)); return; }
      setModel(rest, roleId);
      return;
    }
    if (verb === "profiles" || verb === "profile") {
      if (!rest || verb === "profiles") { print("SYSTEM", profileReport(roleId)); return; }
      applyProfile(rest, roleId);
      return;
    }
    if (verb === "browser") {
      if (!rest) { print("SYSTEM", "USAGE: /voice browser <NAME|#> - A NAME OR NUMBER FROM /voice voices. /voice try <NAME|#> HEARS ONE FIRST, /voice reset PUTS THE DESIGN BACK."); return; }
      setBrowserVoice(rest, roleId);
      return;
    }
    // WHICH VOICES ARE ON THE MENU (Patrikios, 2026-09-29: *"Give the ability to disable some voices
    // from being selected. The code remains, but some options are available."*). Hiding takes a voice
    // OFF THE LIST OF WHAT MAY BE CHOSEN and changes nothing else: /voice voices stops printing it and
    // its number goes with it, /voice try, /voice browser and /voice best will not reach it, and the
    // voice itself is untouched and still in the machine's list. A voice she is already speaking with
    // is NEVER taken away by hiding it - no command here may silently change her voice.
    if (verb === "hide" || verb === "show") {
      var wantHide = verb === "hide";
      if (!rest) {
        print("SYSTEM", "VOICE :: /voice hide <NAME|#> TAKES ONE OF THIS MACHINE'S VOICES OFF THE LIST OF WHAT MAY BE CHOSEN - /voice voices STOPS PRINTING IT, ITS NUMBER GOES WITH IT, AND /voice try, /voice browser AND /voice best WILL NOT REACH IT. NOTHING IS DELETED AND NOTHING ABOUT THE VOICE ITSELF CHANGES; A VOICE SHE IS ALREADY SPEAKING WITH IS NEVER TAKEN AWAY BY HIDING IT. /voice show <NAME|#> PUTS ONE BACK, /voice show all PUTS THE LOT BACK, /voice hidden PRINTS WHAT IS OFF."
          + (hiddenVoices().length ? "\nOFF THE LIST RIGHT NOW (" + hiddenVoices().length + " OF " + allHeld().length + ") :: " + hiddenVoices().map(function (v) { return String(v.name).toUpperCase(); }).join(", ") + "." : "\nRIGHT NOW NOTHING IS OFF THE LIST."));
        return;
      }
      if (/^(all|every|everything|the lot)$/i.test(rest)) {
        var ra = setHiddenVoices(wantHide ? allHeld() : []);
        print("SYSTEM", "VOICE :: " + (wantHide
          ? "ALL " + ra.total + " OF THIS MACHINE'S VOICES ARE OFF THE LIST :: /voice voices WILL PRINT NOTHING, /voice best HAS NOTHING TO CHOOSE, AND SHE KEEPS WHATEVER VOICE SHE IS ALREADY SPEAKING WITH. NOTHING HAS BEEN DELETED - /voice show all PUTS THEM ALL BACK."
          : "ALL " + ra.total + " OF THIS MACHINE'S VOICES ARE OFFERED AGAIN."));
        return;
      }
      var hit = null;
      var dig = /^#?\d+$/.test(String(rest).trim());
      if (wantHide) {
        hit = dig ? (voicesHeld()[parseInt(String(rest).replace("#", ""), 10) - 1] || null) : offeredMatch(rest);
        if (!hit && !dig) {
          var already = hiddenMatch(rest);
          if (already) { print("SYSTEM", "VOICE :: " + String(already.name).toUpperCase() + " IS ALREADY OFF THE LIST - /voice show " + String(already.name).toUpperCase() + " PUTS IT BACK."); return; }
        }
        if (!hit) {
          print("SYSTEM", "VOICE :: NO BROWSER VOICE MATCHED \"" + String(rest).toUpperCase() + "\" - /voice voices LISTS THEM BY NUMBER, AND /voice hidden PRINTS THE ONES THAT ARE OFF.");
          return;
        }
        setHiddenVoices(hiddenVoices().concat([hit]));
        print("SYSTEM", "VOICE :: " + voiceTag(hit) + " IS OFF THE LIST :: " + voicesHeld().length + " OF " + allHeld().length + " VOICES MAY BE CHOSEN NOW."
          + (hit === pickBrowserVoice(roleVoice(roleIdNow()).browser) ? "\nIT IS THE VOICE IN USE RIGHT NOW AND IT STAYS IN USE - HIDING NEVER TAKES HER VOICE AWAY, IT ONLY NARROWS WHAT CAN BE CHOSEN NEXT. /voice show " + String(hit.name).toUpperCase() + " PUTS IT BACK." : "")
          + "\nNOTHING WAS DELETED: THE VOICE IS STILL IN THIS MACHINE'S LIST AND /voice show " + String(hit.name).toUpperCase() + " PUTS IT STRAIGHT BACK.");
        return;
      }
      hit = dig ? (hiddenVoices()[parseInt(String(rest).replace("#", ""), 10) - 1] || null) : hiddenMatch(rest);
      if (!hit) {
        var still = offeredMatch(rest);
        if (still) { print("SYSTEM", "VOICE :: " + voiceTag(still) + " IS ALREADY OFFERED - NOTHING TO PUT BACK. /voice hide " + String(still.name).toUpperCase() + " TAKES IT OFF THE LIST."); return; }
      }
      if (!hit) { print("SYSTEM", "VOICE :: NOTHING OFF THE LIST MATCHED \"" + String(rest).toUpperCase() + "\". /voice hidden PRINTS THEM BY NUMBER, AND /voice voices PRINTS WHAT IS OFFERED."); return; }
      setHiddenVoices(hiddenVoices().filter(function (v) { return v !== hit; }));
      print("SYSTEM", "VOICE :: " + voiceTag(hit) + " IS BACK IN THE LIST :: " + voicesHeld().length + " OF " + allHeld().length + " VOICES MAY BE CHOSEN. /voice try " + (indexOfVoice(hit) || hit.name) + " HEARS IT, /voice browser " + (indexOfVoice(hit) || hit.name) + " KEEPS IT.");
      return;
    }
    if (verb === "hidden" || verb === "masked" || verb === "disabled") {
      var masked = hiddenVoices(), every = allHeld();
      print("SYSTEM", "VOICE :: THIS MACHINE'S VOICES THAT ARE OFF THE LIST (" + masked.length + " OF " + every.length + ") ::"
        + (masked.length
          ? "\n" + masked.map(function (v, i) { return "   " + (i + 1) + ". " + v.name + " \u00b7 " + v.lang + " \u00b7 " + qualityWord(v); }).join("\n")
            + "\nNOTHING IS DELETED AND NOTHING ABOUT THE VOICE CHANGED - IT IS SIMPLY NOT OFFERED: /voice voices DOES NOT PRINT IT, THE NUMBERS SKIP IT, AND /voice try, /voice browser AND /voice best WILL NOT REACH IT. /voice show <NAME|#> PUTS ONE BACK, /voice show all PUTS THE LOT BACK."
          : "\n   NOTHING - EVERY VOICE THIS MACHINE HAS IS OFFERED."));
      return;
    }
    // THE BEST THIS MACHINE HAS, WITHOUT HAVING TO HUNT FOR IT. On a phone the voice list is a wall
    // of names that mean nothing (and the good ones are named "Enhanced"/"Premium"), so this picks
    // the highest tier available in her own language and keeps it.
    if (verb === "best" || verb === "quality" || verb === "better") {
      var list = voicesHeld();
      if (!list.length) { print("SYSTEM", "VOICE :: THE VOICE LIST IS EMPTY HERE. ON AN IPHONE IT STAYS EMPTY UNTIL THE PAGE HAS BEEN TOUCHED ONCE - TAP ANYWHERE, THEN TRY AGAIN. /voice voices SHOWS WHAT IT FINDS."); return; }
      var top = bestForRole(roleId);
      if (!top) { print("SYSTEM", "VOICE :: NO VOICE COULD BE CHOSEN FROM THIS MACHINE'S LIST."); return; }
      store.roles[roleId] = store.roles[roleId] || {};
      store.roles[roleId].browser = store.roles[roleId].browser || {};
      store.roles[roleId].browser.name = top.name;
      save();
      print("SYSTEM", "VOICE :: THE BEST THIS MACHINE HAS :: " + voiceTag(top) + " \u00b7 " + qualityWord(top)
        + "\n" + roleLabel(roleId) + " WILL SPEAK IN IT ON THIS BROWSER'S ENGINE."
        + (engineNow(roleId) === "elevenlabs" ? " (ELEVENLABS IS STILL THE ENGINE IN USE - /voice engine browser MAKES THIS THE ONE SHE ACTUALLY SPEAKS WITH, AND IT COSTS NOTHING.)" : "")
        + "\n/voice try " + (indexOfVoice(top) || top.name) + " HEARS IT. /voice voices SHOWS EVERY TIER THIS MACHINE HAS"
        + (isIos() ? " - ON AN IPHONE THE HIGHER ONES COME FROM SETTINGS > ACCESSIBILITY > SPOKEN CONTENT > VOICES, DOWNLOADED AS \"ENHANCED\" OR \"PREMIUM\"." : "."));
      return;
    }
    if (verb === "try" || verb === "preview" || verb === "hear") {
      if (!rest) { print("SYSTEM", "USAGE: /voice try <NAME|#> [TEXT] - HEARS THIS BROWSER'S VOICE SAY A SAMPLE (OR YOUR OWN WORDS) AT HER RATE AND PITCH. NOTHING IS SAVED; /voice browser <#> KEEPS IT. /voice audition SWEEPS THE BRITISH FEMALE ONES."); return; }
      auditionOne(rest, roleId);
      return;
    }
    if (verb === "audition" || verb === "british" || verb === "uk") { audition(roleId); return; }
    if (verb === "rate" || verb === "pitch") {
      var bits = rest.split(/\s+/).filter(Boolean);
      var clear = /^(clear|default|shipped|none)$/i.test(bits[0] || "");
      if (clear) bits.shift();
      var who = "", n = NaN;
      if (clear) who = bits.join(" ");
      else if (verb === "pitch" && bits.length > 1 && isFinite(Number(bits[0]))) { n = Number(bits[0]); who = bits.slice(1).join(" "); }
      else n = Number(bits.join(" "));
      if (!who) {
        if (!isFinite(n)) {
          print("SYSTEM", "USAGE: /voice " + verb + " <NUMBER> (RATE 0.5-2, PITCH 0-2)"
            + (verb === "pitch" ? " \u00b7 /voice pitch <N> <NAME|#> GIVES ONE VOICE ITS OWN PITCH \u00b7 /voice pitch clear <NAME|#> PUTS IT BACK" : ""));
          return;
        }
        store.roles[roleId] = store.roles[roleId] || {};
        store.roles[roleId].browser = store.roles[roleId].browser || {};
        store.roles[roleId].browser[verb] = num(n, verb === "rate" ? 1 : 1, verb === "rate" ? 0.5 : 0, 2);
        save();
        print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " " + verb.toUpperCase() + " SET TO " + store.roles[roleId].browser[verb] + " (BROWSER ENGINE).");
        return;
      }
      var hit = resolveBrowser(who);
      if (!hit) {
        print("SYSTEM", "VOICE :: NO BROWSER VOICE MATCHED \"" + String(who).toUpperCase() + "\". /voice voices LISTS THEM BY NUMBER; /voice try <#> HEARS ONE.");
        return;
      }
      if (!clear && !isFinite(n)) {
        print("SYSTEM", "USAGE: /voice pitch <NUMBER> <NAME|#> (PITCH 0-2) \u00b7 /voice pitch clear <NAME|#>");
        return;
      }
      store.roles[roleId] = store.roles[roleId] || {};
      store.roles[roleId].browser = store.roles[roleId].browser || {};
      var vp = Object.assign({}, store.roles[roleId].browser.voicePitch || {});
      if (clear) delete vp[hit.name];
      else vp[hit.name] = num(n, 1, 0, 2);
      store.roles[roleId].browser.voicePitch = vp;
      save();
      var roleP = num((roleVoice(roleId).browser || {}).pitch, 1, 0, 2);
      var eff = voicePitchFor(roleVoice(roleId).browser, hit);
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " :: " + (clear
        ? "THE PITCH OVERRIDE FOR " + voiceTag(hit) + " IS CLEARED :: IT SITS AT " + (eff == null ? roleP : eff)
          + (eff == null ? " (THE ROLE'S OWN)." : " AGAIN (THE SHIPPED DESIGN'S OWN).")
        : voiceTag(hit) + " SPEAKS AT PITCH " + vp[hit.name] + " :: EVERY OTHER VOICE KEEPS THE ROLE'S " + roleP + ".")
        + " /voice try " + (indexOfVoice(hit) || hit.name) + " HEARS IT.");
      return;
    }
    if (verb === "list") { listVoices(true); return; }
    if (verb === "reset") {
      delete store.roles[roleId];
      delete store.resolved[roleId];
      save();
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " RESET TO THE SHIPPED DESIGN (src/voice/voices.json).");
      return;
    }
    print("SYSTEM", "USAGE: /voice \u00b7 /voice speak [TEXT] \u00b7 /voice stop \u00b7 /voice engine <auto|browser|elevenlabs> \u00b7 /voice auto on|off"
      + "\n/voice voices [refresh] \u00b7 /voice best \u00b7 /voice voice <ID|NAME> \u00b7 /voice browser <NAME|#> \u00b7 /voice hide|show <NAME|#> \u00b7 /voice hidden \u00b7 /voice try <NAME|#> [TEXT] \u00b7 /voice audition"
      + "\n/voice rate <n> \u00b7 /voice pitch <n> \u00b7 /voice pitch <n> <NAME|#> \u00b7 /voice pitch clear <NAME|#> \u00b7 /voice live [on|off] \u00b7 /voice live text [on|off] \u00b7 /voice mic [on|off] \u00b7 /voice reset"
      + "\n/voice hold <MS> (THE END OF YOUR TURN) \u00b7 /voice tail <MS> \u00b7 /voice level [<0-1>|off] (THE ROOM HEARS YOU - WHAT COUNTS AS SOUND)"
      + "\n/voice models \u00b7 /voice model <ID|default> (WHICH MODEL ELEVENLABS SPEAKS WITH, AND WHAT IT COSTS) \u00b7 /voice profile [<NAME>] (THE IDEAL VOICE, AS CONFIGURED ELSEWHERE)");
  }

  async function listVoices(force) {
    var out = [];
    var held = voicesHeld();
    var masked = hiddenVoices();
    var cands = auditionCandidates();
    var isCand = {};
    cands.forEach(function (v) { isCand[v.name + "|" + v.lang] = 1; });
    out.push("BROWSER VOICES (" + held.length + (masked.length ? " OFFERED, " + masked.length + " OFF THE LIST" : "") + ") - /voice try <#> TO HEAR ONE, /voice browser <#> TO KEEP IT, /voice pitch <N> <#> FOR ONE VOICE'S OWN PITCH:");
    var roleV = roleVoice(roleIdNow()).browser || {};
    var best = bestForRole(roleIdNow());
    var inUse = pickBrowserVoice(roleV);
    held.forEach(function (v, i) {
      var pv = voicePitchFor(roleV, v);
      out.push("  " + (i + 1) + ". " + v.name + " \u00b7 " + v.lang + (v.localService ? " \u00b7 LOCAL" : " \u00b7 ONLINE")
        + " \u00b7 " + qualityWord(v)
        + (v === best ? " \u00b7 \u2605 BEST HERE" : "")
        + (v === inUse ? " \u00b7 \u25c0 IN USE" : "")
        + (pv == null ? "" : " \u00b7 PITCH " + pv)
        + (isCand[v.name + "|" + v.lang] ? " \u00b7 *" : ""));
    });
    if (!held.length) {
      out.push("  NONE YET. ON AN IPHONE THE LIST IS EMPTY UNTIL THE PAGE HAS BEEN TOUCHED ONCE - TAP ANYWHERE, THEN TYPE /voice voices AGAIN.");
    }
    if (masked.length) {
      var names8 = masked.slice(0, 8).map(function (v) { return String(v.name).toUpperCase(); });
      out.push("  " + masked.length + " OF THE " + allHeld().length + " VOICES THIS MACHINE HAS ARE OFF THE LIST AND NOT OFFERED :: "
        + names8.join(", ") + (masked.length > names8.length ? ", +" + (masked.length - names8.length) + " MORE" : "")
        + "\n  THEY ARE NOT DELETED AND NOTHING ABOUT THEM CHANGED - THEY ARE SIMPLY NOT OFFERED: NO NUMBER, NO /voice try, NO /voice browser, AND /voice best WILL NOT PICK ONE. /voice hidden PRINTS THEM, /voice show <NAME|#> PUTS ONE BACK.");
      var usedV = pickBrowserVoice(roleVoice(roleIdNow()).browser);
      if (usedV && isHiddenVoice(usedV)) out.push("  THE VOICE IN USE (" + String(usedV.name).toUpperCase() + ") IS ONE OF THEM :: SHE STILL SPEAKS WITH IT UNTIL ANOTHER IS CHOSEN - HIDING NEVER TAKES HER VOICE AWAY.");
    }
    if (cands.length) out.push("  * = BRITISH FEMALE BY LOCALE AND NAME. /voice audition PLAYS THE WHOLE SET, ONE AFTER ANOTHER, AT HER RATE AND PITCH.");
    if (best) out.push("  \u2605 = THE HIGHEST TIER SHE COULD SPEAK WITH ON THIS MACHINE (" + best.name + ", " + qualityWord(best) + " - HER OWN LANGUAGE, AND HER OWN LOCALE PREFERRED AT THAT TIER). /voice best KEEPS IT WITHOUT A NUMBER. \u25c0 = WHAT SHE WOULD SPEAK WITH RIGHT NOW.");
    out.push("  THE TIERS ARE THE NAME'S: THE VOICES A PHONE SHIPS ARE \"COMPACT\", AND THE GOOD ONES HAVE TO BE DOWNLOADED FIRST - ON AN IPHONE, SETTINGS > ACCESSIBILITY > SPOKEN CONTENT > VOICES, PICK A VOICE AND TAKE THE \"ENHANCED\" OR \"PREMIUM\" ONE. IT THEN APPEARS HERE AS \"<NAME> (ENHANCED)\" AND THE TERMINAL PREFERS IT BY ITSELF, WITH NO SETTING TO CHANGE. SIRI'S OWN VOICE IS NOT IN THIS LIST AND CANNOT BE - APPLE DOES NOT GIVE IT TO WEB PAGES. FOR A VOICE THAT IS HERS RATHER THAN THE MACHINE'S, ELEVENLABS IS THE ANSWER (KEYS \u25be).");
    var kr = keyring();
    if (kr && kr.has("elevenlabs")) {
      try {
        var list = await fetchVoices(!!force);
        out.push("ELEVENLABS VOICES (" + list.length + ") - /voice voice <ID>:");
        list.forEach(function (v) { out.push("  " + v.id + " \u00b7 " + v.name + (v.category ? " \u00b7 " + v.category : "")); });
      } catch (e) {
        out.push("THE ACCOUNT'S ELEVENLABS VOICE LIST IS UNAVAILABLE :: " + (kr.scrub(String((e && e.message) || e), "elevenlabs"))
          + "\n(READING IT NEEDS A KEY CREATED WITH THE \"VOICES READ\" PERMISSION. SPEAKING DOES NOT.)");
        var pal = shippedVoices();
        if (pal.length) {
          out.push("SHIPPED PALETTE (" + pal.length + ") - MEASURED TO WORK ON A FREE PLAN - /voice voice <NAME|ID>:");
          pal.forEach(function (v) { out.push("  " + v.name + " \u00b7 " + v.id + " \u00b7 " + v.note); });
        }
      }
    } else {
      out.push("NO ELEVENLABS KEY IS HELD (KEYS \u25be) - ONLY THIS BROWSER'S VOICES ARE AVAILABLE.");
    }
    print("SYSTEM", out.join("\n"));
  }

  function setElevenVoice(nameOrId, roleId) {
    var want = String(nameOrId).trim();
    var match = function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].id === want) return list[i];
      for (var j = 0; j < list.length; j++) if (String(list[j].name).toLowerCase().indexOf(want.toLowerCase()) !== -1) return list[j];
      return null;
    };
    // WHERE THE NAME CAME FROM decides what is said about it afterwards, because the four sources are
    // not equal: the account's own list, the shipped palette (premade voices a free plan may speak),
    // a PROFILE (the ideal voice, which may not be speakable on this plan yet), or a bare voice id
    // pasted in by hand (nothing to check it against).
    var doIt = function (list, source) {
      var hit = match(list);
      var src = source;
      if (!hit) {
        var ph = findProfile(want);
        if (ph && ph.profile && ph.profile.voiceId) { hit = { id: ph.profile.voiceId, name: String(ph.profile.title || ph.key) }; src = "profile"; }
      }
      if (!hit) { var pv = profileVoice(want); if (pv) { hit = pv; src = "profile"; } }
      if (!hit && /^[A-Za-z0-9]{18,26}$/.test(want)) { hit = { id: want, name: "" }; src = "raw"; }
      if (!hit) {
        print("SYSTEM", "VOICE :: NO ELEVENLABS VOICE MATCHED \"" + want.toUpperCase() + "\". /voice voices LISTS THEM, /voice profile LISTS THE PROFILES ON FILE.");
        return;
      }
      store.roles[roleId] = store.roles[roleId] || {};
      store.roles[roleId].elevenlabs = store.roles[roleId].elevenlabs || {};
      store.roles[roleId].elevenlabs.voiceId = hit.id;
      store.resolved[roleId] = { id: hit.id, name: hit.name || "", at: Date.now() };
      save();
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " WILL SPEAK IN \"" + String(hit.name || hit.id).toUpperCase() + "\" (" + hit.id + ") WHEN THE ELEVENLABS ENGINE IS USED."
        + (src === "palette" ? "\nTHAT NAME CAME FROM THE SHIPPED PALETTE, NOT THE ACCOUNT'S OWN LIST (READING THAT NEEDS A KEY WITH THE \"VOICES READ\" PERMISSION). IT WORKS ON A FREE PLAN - A VOICE FROM THE WIDER LIBRARY NEEDS A PAID ONE." : "")
        + (src === "profile" ? "\nTHAT ID CAME FROM A PROFILE - IF IT IS A LIBRARY VOICE, A FREE PLAN WILL REFUSE IT (HTTP 402) AND SAY SO. /voice profile SHOWS WHAT WAS MEASURED FOR IT." : "")
        + (src === "raw" ? "\nTHAT LOOKS LIKE A VOICE ID PASTED IN BY HAND AND WAS TAKEN AS GIVEN - THERE WAS NO LIST TO CHECK IT AGAINST. IF ELEVENLABS DOES NOT HAVE IT, SPEAKING WILL ANSWER voice_not_found AND NAME THE ID." : ""));
    };
    if (store.voices && store.voices.length) { doIt(store.voices, "account"); return; }
    fetchVoices(false).then(function (list) { doIt(list, "account"); }).catch(function (e) {
      var kr = keyring();
      var pal = shippedVoices();
      if (pal.length) {
        print("SYSTEM", "VOICE :: THE ACCOUNT'S VOICE LIST IS UNAVAILABLE :: " + (kr ? kr.scrub(String((e && e.message) || e), "elevenlabs") : String((e && e.message) || e))
          + "\nUSING THE SHIPPED PALETTE INSTEAD.");
        doIt(pal, "palette");
        return;
      }
      print("SYSTEM", "VOICE :: COULD NOT READ THE VOICE LIST :: " + (kr ? kr.scrub(String((e && e.message) || e), "elevenlabs") : String((e && e.message) || e)));
    });
  }

  // ---- which model, and which profile --------------------------------------

  // Leaves no empty boxes behind in kv. An override object that has lost everything it held is
  // removed rather than saved as `{}`, so what is on the device reads exactly like the commands that
  // put it there - and `/voice reset` (which removes the whole role entry) is not the only way back.
  function pruneRole(roleId) {
    var ov = store.roles[roleId];
    if (!ov) return;
    if (ov.elevenlabs && !Object.keys(ov.elevenlabs).length) delete ov.elevenlabs;
    if (!Object.keys(ov).length) delete store.roles[roleId];
  }

  // What she speaks with, what was measured, and what each one costs. The table is a RECORD, not a
  // gate: an id that is not in it is still tried, because the provider adds models faster than
  // `src/voice/voices.json` is edited - it just arrives with the warning that it was unverified.
  // THE LOCAL VOICE, IN WORDS. Three helpers, all read-only: the roster as a numbered table (the
  // numbers are what /voice kokoro voice <#> takes), one voice by that number, and the full report
  // the bare command prints. Nothing here changes anything - every one of them is a reader, so a
  // wrong guess about the road cannot be made by looking at it.
  function kokoroByIdx(i) {
    var K = kokoroEngine();
    if (!K || !K.ready()) return null;
    var fem = K.roster().filter(function (v) { return String(v.gender).toLowerCase() === "female"; });
    if (!(i >= 1 && i <= fem.length)) return null;
    return fem[i - 1];
  }

  function kokoroRosterText(roleId) {
    var K = kokoroEngine();
    var inForce = kokoroVoice(roleId);
    var head = ["VOICE :: THE LOCAL VOICE'S OWN VOICES :: " + roleLabel(roleId) + " WEARS \"" + String(inForce).toUpperCase() + "\" ON THIS ROAD."];
    if (!K || !K.ready()) {
      var d = design().kokoro || {};
      head.push("");
      head.push("THE MODEL IS NOT FETCHED ON THIS DEVICE YET (ABOUT 90MB, ONCE PER BROWSER), SO THIS IS THE DOCUMENTED SET FROM src/voice/voices.json - WHAT SHIPS WITH THE SHIPPED MODEL, WITH THE PROVIDER'S OWN GRADES - AND NOTHING BELOW MAY BE CHOSEN UNTIL IT IS HERE:");
      head.push("");
      (d.voices || []).forEach(function (v, i) {
        head.push("  " + (i + 1) + ") " + v.id + "  \"" + v.name + "\" \u00b7 " + String(v.language).toUpperCase() + " \u00b7 GRADE " + (v.grade || "?") + (v.traits ? " \u00b7 " + v.traits : "") + (v.id === inForce ? "   <- IN FORCE" : ""));
      });
      head.push("");
      head.push("/voice kokoro warm FETCHES IT NOW (OR IT COMES BY ITSELF THE FIRST TIME SHE SPEAKS ON THIS ROAD), AND THEN THIS LIST IS THE MODEL'S OWN - WHICH IS THE ONE THAT COUNTS, BECAUSE A MODEL THAT ADDS OR RENAMES A VOICE CANNOT LEAVE THIS FILE LYING.");
      return head.join("\n");
    }
    var fem = K.roster().filter(function (v) { return String(v.gender).toLowerCase() === "female"; });
    var male = K.roster().filter(function (v) { return String(v.gender).toLowerCase() !== "female"; });
    head.push("");
    head.push("THE " + fem.length + " FEMALE VOICES, BEST-GRADED FIRST (THE GRADES ARE THE PROVIDER'S OWN, READ OFF THE MODEL):");
    head.push("");
    fem.forEach(function (v, i) {
      head.push("  " + (i + 1) + ") " + v.id + "  \"" + v.name + "\" \u00b7 " + String(v.language).toUpperCase() + " \u00b7 GRADE " + (v.grade || "?") + (v.traits ? " \u00b7 " + v.traits : "") + (v.id === inForce ? "   <- IN FORCE" : ""));
    });
    head.push("");
    head.push("AND " + male.length + " MALE VOICES IN THE SAME MODEL (" + male.map(function (v) { return v.id; }).join(", ") + ") - NOT OFFERED BY THIS TERMINAL's OWN SHORTHAND, BUT /voice kokoro voice <ID> TAKES ANY OF THEM.");
    head.push("");
    head.push("/voice kokoro voice <#>|NAME KEEPS ONE \u00b7 /voice kokoro say <TEXT> HEARS ONE WITHOUT KEEPING IT \u00b7 /voice kokoro audition SAYS THEM ALL IN TURN (A WORD IS A POOR WAY TO CHOOSE A VOICE, SO THE AUDITION IS THE HONEST ONE) \u00b7 /voice kokoro voice default CLEARS THE PICK BACK TO THE SHIPPED ONE.");
    return head.join("\n");
  }

  function kokoroReport(roleId) {
    var K = kokoroEngine();
    var d = design().kokoro || {};
    var L = limitsNow();
    var inForce = state().engineSetting === "kokoro";
    var lines = ["VOICE :: THE LOCAL VOICE (KOKORO) :: " + (inForce ? "SHE IS SPEAKING ON IT" : "NOT HER ROAD RIGHT NOW - /voice engine kokoro TAKES IT, /voice engine auto LEAVES IT")];
    if (!K) {
      lines.push("  THE MODULE IS NOT ON THIS PAGE (src/js/kokoro.js) :: NOTHING ELSE IN THE TERMINAL IS AFFECTED.");
      return lines.join("\n");
    }
    var s = K.state();
    lines.push("  WHAT IT IS :: A NEURAL NARRATOR THAT RUNS INSIDE THIS PAGE IN A WORKER. NO KEY, NO ACCOUNT, NO PLAN, NO PER-CHARACTER BILL, AND NO NETWORK AT ALL ONCE THE MODEL IS HERE - NOTHING IT SAYS LEAVES THIS MACHINE. IT IS ALSO SLOWER THAN REAL TIME, WHICH IS WHY IT IS OPT-IN AND CAPPED.");
    lines.push("  THE MODEL :: " + String(d.model || "").toUpperCase() + " :: " + String(s.dtype).toUpperCase() + " ON " + String(s.device).toUpperCase()
      + (store.kokoroDevice ? " (CHOSEN ON THIS DEVICE - /voice kokoro device default PUTS THE SHIPPED BUILD BACK)" : " (THE SHIPPED BUILD)")
      + " :: THE LIBRARY IS PINNED AT " + String(d.cdn || "").replace(/^https:\/\/esm\.sh\//, "") + ", NEVER \"LATEST\", BECAUSE A SILENT MODEL SWAP UNDER THE SAME ID WOULD CHANGE HER VOICE WITH NOTHING WRITTEN DOWN.");
    lines.push("  WHAT IT IS DOING :: " + (s.ready
      ? "READY :: " + s.voiceCount + " VOICES IN MEMORY" + (s.ms ? ", LOADED IN " + (s.ms / 1000).toFixed(1) + "S" : "") + (s.threads && s.threads !== "?" ? " ON " + s.threads + " THREADS" : "") + (s.progress ? " (A FETCH IS RUNNING: " + Math.round(Number(s.progress.progress) || 0) + "%)" : "")
      : (s.loading ? "FETCHING THE MODEL NOW (ABOUT 90MB, ONCE PER BROWSER)" + (s.progress ? " :: " + Math.round(Number(s.progress.progress) || 0) + "%" : "") : "NOT FETCHED YET :: ABOUT 90MB, ONCE PER BROWSER, AND THEN OFFLINE FOREVER. /voice kokoro warm FETCHES IT WITHOUT SAYING ANYTHING."))
      + (s.error ? "\n    LAST FAILURE :: " + s.error : ""));
    lines.push("  HER VOICE ON THIS ROAD :: \"" + String(kokoroVoice(roleId)).toUpperCase() + "\" FOR " + roleLabel(roleId) + " :: SPEED " + kokoroSpeed(roleId)
      + " (THE ROLE'S OWN RATE, HANDED TO THE GENERATOR - AND THE MODEL HAS NO PITCH CONTROL AT ALL, SO /voice pitch DOES NOTHING HERE)");
    lines.push("  HOW MUCH SHE MAY SAY :: " + L.kokoroMaxChars + " CHARACTERS A REPLY, BECAUSE THE ROAD RUNS AT ABOUT 2x REAL TIME (ABOUT TWO MINUTES OF MAKING FOR A MINUTE OF SPEECH). THE OTHER TWO ROADS ARE NOT CAPPED THIS WAY AND DO NOT SHARE THE NUMBER: /voice max kokoro <N> MOVES IT, /voice max PRINTS EVERY CEILING.");
    lines.push("  WHAT WAS MEASURED (" + ((d.measured && d.measured.at) || "2026-09-30") + ", ON THIS MACHINE) :: LOAD 1.6S WARM / ~10S COLD; SPEECH ABOUT 2x REAL TIME (33 CHARACTERS -> 5.4-7.2S, 118 CHARACTERS -> 17.3S FOR 8.3S OF AUDIO); q4f16 ON WebGPU IS FASTER (~1.34x) AND LOWER FIDELITY. IMPORTED INTO THE PAGE ITSELF IT FROZE THE WHOLE TERMINAL - IT LIVES IN A WORKER FOR THAT REASON, AND IT MUST STAY THERE.");
    lines.push("  THE ROAD IN PRACTICE :: /voice kokoro voices (THE ROSTER WITH GRADES) \u00b7 /voice kokoro audition (HEAR THEM ALL, ONE SHAPE AT A TIME) \u00b7 /voice kokoro say <TEXT> (HEAR ONE LINE WITH NOTHING SAVED) \u00b7 /voice kokoro voice <#|NAME> (KEEP ONE) \u00b7 /voice kokoro warm \u00b7 /voice kokoro release (DROP IT FROM MEMORY).");
    if (inForce) lines.push("  AND WHAT IT MEANS FOR HER :: EVERY REPLY SHE READS ALOUD IS MADE ON THIS MACHINE, CAPPED AT " + L.kokoroMaxChars + " CHARACTERS, AND SLOWER TO START THAN THE OTHER TWO ROADS. /voice engine browser OR /voice engine auto TAKES HER OFF IT IN ONE WORD.");
    return lines.join("\n");
  }

  function modelReport(roleId) {
    var cur = modelNow(roleId);
    var chosen = !!(store.roles[roleId] && store.roles[roleId].elevenlabs && store.roles[roleId].elevenlabs.model);
    var t = modelTable();
    var out = ["VOICE :: " + roleLabel(roleId) + " SPEAKS WITH MODEL \"" + cur + "\"" + (chosen ? " (CHOSEN ON THIS DEVICE)" : " (THE SHIPPED DEFAULT)") + "."];
    if (t && (t.accepted || []).length) {
      out.push("ACCEPTED BY THE TEXT-TO-SPEECH ENDPOINT, WITH THE CREDIT FIGURE THE PROVIDER ITSELF QUOTED FOR A THREE-CHARACTER PROBE (SO IT IS THE RATE AND THE MINIMUM, NOT AN ESTIMATE):");
      (t.accepted || []).forEach(function (m) {
        out.push("  " + m.id + (m.creditsPer3Chars ? " \u00b7 " + m.creditsPer3Chars + " CREDITS / 3 CHARS" : "") + (m.id === cur ? " \u00b7 \u25c0 IN USE" : "") + (m.note ? " \u00b7 " + m.note : ""));
      });
    }
    if (t && (t.refused || []).length) {
      out.push("REFUSED OUTRIGHT (NO LONGER SPOKEN AT ALL):");
      (t.refused || []).forEach(function (m) { out.push("  " + m.id + (m.status ? " \u00b7 HTTP " + m.status + (m.code ? " " + m.code : "") : "") + (m.note ? " \u00b7 " + m.note : "")); });
    }
    out.push("/voice model <ID> SETS ONE FOR " + roleLabel(roleId) + " ONLY (AN ID THIS TABLE DOES NOT HOLD IS STILL SENT AS GIVEN). /voice model default PUTS THE SHIPPED ONE BACK. THE MODEL IS HALF OF THE COST: A REFUSAL NOW NAMES THE MODEL IT WAS ASKED TO SPEND ON.");
    return out.join("\n");
  }

  function setModel(id, roleId) {
    var want = String(id == null ? "" : id).trim();
    if (!want) return;
    if (/^(default|shipped|reset|none|off)$/i.test(want)) {
      if (store.roles[roleId] && store.roles[roleId].elevenlabs) delete store.roles[roleId].elevenlabs.model;
      pruneRole(roleId);
      save();
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " IS BACK ON THE SHIPPED MODEL \"" + modelNow(roleId) + "\" (src/voice/voices.json).");
      return;
    }
    store.roles[roleId] = store.roles[roleId] || {};
    store.roles[roleId].elevenlabs = store.roles[roleId].elevenlabs || {};
    store.roles[roleId].elevenlabs.model = want;
    save();
    print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " WILL SPEAK WITH MODEL \"" + want + "\" ON THE ELEVENLABS ENGINE."
      + (modelKnown(want) ? "" : "\nTHAT ID IS NOT IN THE MEASURED TABLE - IT IS SENT AS GIVEN, AND ELEVENLABS WILL SAY model_not_found IF IT DOES NOT HAVE IT.")
      + "\n/voice models SHOWS WHAT EACH MODEL WAS QUOTED AT. THE MODEL IS THE SECOND HALF OF THE COST, BESIDE THE VOICE.");
  }

  // The profiles on file, and what was measured about each. Printed rather than applied when bare, so
  // looking costs nothing and changes nothing.
  function profileReport(roleId) {
    var all = shippedProfiles();
    var keys = profileKeys();
    var out = ["VOICE :: PROFILES ON FILE (" + keys.length + ") - /voice profile <NAME> APPLIES ONE TO " + roleLabel(roleId) + ":"];
    keys.forEach(function (k) {
      var p = all[k] || {};
      out.push("  " + k.toUpperCase() + " \u00b7 " + String(p.title || "").toUpperCase()
        + "\n    VOICE " + (p.voiceId || "(THE SHIPPED ONE)") + " \u00b7 MODEL " + (p.model || "(THE SHIPPED ONE)")
        + (p.settings ? " \u00b7 " + Object.keys(p.settings).map(function (n) { return n + " " + p.settings[n]; }).join(" / ") : ""));
      if (p.measured && p.measured.status) {
        out.push("    MEASURED " + (p.measured.at || "") + " \u00b7 " + String(p.measured.status).split(" :: ")[0]);
        if (p.measured.whenUnblocked) out.push("    WHEN IT IS UNBLOCKED \u00b7 " + p.measured.whenUnblocked);
      }
    });
    out.push("A PROFILE IS THE WHOLE VOICE AT ONCE - VOICE ID, MODEL AND SETTINGS - AND ITS SETTINGS ARE TAKEN EXACTLY AS GIVEN. /voice reset PUTS THE SHIPPED DESIGN BACK.");
    return out.join("\n");
  }

  function applyProfile(name, roleId) {
    var want = String(name == null ? "" : name).trim();
    if (/^(none|off|clear|reset|default|shipped)$/i.test(want)) {
      if (store.roles[roleId]) delete store.roles[roleId].elevenlabs;
      pruneRole(roleId);
      delete store.resolved[roleId];
      save();
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " IS BACK ON THE SHIPPED DESIGN (src/voice/voices.json) - NO PROFILE, THE DESIGN'S OWN VOICE, MODEL AND SETTINGS. /voice reset CLEARS EVERYTHING FOR THE ROLE AT ONCE.");
      return;
    }
    var hit = findProfile(want);
    if (!hit) {
      print("SYSTEM", "VOICE :: NO PROFILE MATCHED \"" + want.toUpperCase() + "\". /voice profile LISTS THE ONES ON FILE.");
      return;
    }
    var p = hit.profile || {};
    store.roles[roleId] = store.roles[roleId] || {};
    store.roles[roleId].elevenlabs = {
      voiceId: p.voiceId || "",
      model: p.model || "",
      settings: Object.assign({}, p.settings || {}),
      settingsExact: true,          // the profile means what it says: nothing merges in from underneath
      profile: hit.key
    };
    if (p.voiceId) store.resolved[roleId] = { id: p.voiceId, name: String(p.title || hit.key), at: Date.now() };
    save();
    var lines = ["VOICE :: PROFILE \"" + hit.key.toUpperCase() + "\" APPLIED TO " + roleLabel(roleId) + " :: " + String(p.title || "").toUpperCase()
      + "\n  VOICE " + (p.voiceId || "(THE SHIPPED ONE)") + " \u00b7 MODEL " + (p.model || "(THE SHIPPED ONE)")
      + (p.settings ? "\n  SETTINGS ARE TAKEN EXACTLY AS THE PROFILE GIVES THEM :: " + Object.keys(p.settings).map(function (n) { return n + " " + p.settings[n]; }).join(" / ") : "")];
    if (p.measured && p.measured.status) {
      // THE HONEST HALF. A profile is where she SHOULD sound, not a promise that this account can speak
      // it, so the measurement travels with the profile and is printed the moment it is applied -
      // rather than waiting to be discovered as a refusal in the middle of a sentence.
      lines.push("  MEASURED " + (p.measured.at || "") + " :: " + p.measured.status);
      if (p.measured.whenUnblocked) lines.push("  WHEN IT IS UNBLOCKED :: " + p.measured.whenUnblocked);
    }
    if (p.agent && p.agent.measured && p.agent.measured.status) {
      lines.push("  THE AGENT AROUND IT :: " + p.agent.measured.status);
    }
    lines.push("  IF ELEVENLABS REFUSES IT SHE FALLS BACK TO THIS BROWSER'S VOICE AND SAYS WHY - WHICH IS THE POINT OF APPLYING IT NOW. /voice reset PUTS THE SHIPPED DESIGN BACK.");
    print("SYSTEM", lines.join("\n"));
  }

  // Finds one of the machine's voices by exact name, by substring, by loose word match ("uk
  // female"), or by the number /voice voices prints. Returns null rather than a fallback, so a
  // mistyped name is reported instead of silently auditioning something else.
  // The search itself, over any list of voices: exact name, then substring, then a loose word match
  // ("uk female"), then the number the printed list gave it. Returns null rather than a fallback, so a
  // mistyped name is reported instead of silently auditioning something else.
  function resolveIn(list, want) {
    var w = String(want == null ? "" : want).trim().replace(/^#/, "");
    if (!w) return null;
    if (/^\d+$/.test(w)) { var n = parseInt(w, 10) - 1; return (n >= 0 && n < list.length) ? list[n] : null; }
    var low = w.toLowerCase(), i;
    for (i = 0; i < list.length; i++) if (String(list[i].name).toLowerCase() === low) return list[i];
    for (i = 0; i < list.length; i++) if (String(list[i].name).toLowerCase().indexOf(low) !== -1) return list[i];
    var toks = low.split(/\s+/);
    for (i = 0; i < list.length; i++) {
      var hay = String(list[i].name).toLowerCase() + " " + String(list[i].lang || "").toLowerCase();
      var all = true;
      for (var t = 0; t < toks.length; t++) if (hay.indexOf(toks[t]) === -1) { all = false; break; }
      if (all) return list[i];
    }
    return null;
  }

  // WHAT SHE CAN BE GIVEN: the machine's list with the voices he has hidden taken out of it.
  function resolveBrowser(want) { return resolveIn(voicesHeld(), want); }
  function indexOfVoice(v) {
    var held = voicesHeld();
    for (var i = 0; i < held.length; i++) if (held[i] === v || (held[i].name === v.name && held[i].lang === v.lang)) return i + 1;
    return 0;
  }

  function voiceTag(v) { return String(v.name).toUpperCase() + " (" + v.lang + (v.localService ? " · LOCAL" : " · ONLINE") + ")"; }

  // A voice that EXISTS BUT IS OFF THE LIST is worth saying so about: "no such voice" would be a lie,
  // and the way back is one command. Empty when the name is not a hidden voice at all.
  function hiddenInstead(want) {
    var h = hiddenMatch(want);
    return h ? " (IT IS NOT GONE - IT IS OFF THE LIST: /voice show " + String(h.name).toUpperCase() + " PUTS IT BACK.)" : "";
  }

  function sampleText() {
    var d = design();
    return String((d.audition && d.audition.sample) || "The archive is open, Patrikios. Nothing that has lived here is lost, and nothing is forgotten.").trim();
  }

  // "Microsoft Hazel - English (United Kingdom)" -> "Microsoft Hazel". The locale is printed beside
  // it anyway, and a spoken announcement should not read out a parenthetical.
  function shortName(v) { return String(v.name || "").replace(/\s+-\s+.*$/, "").replace(/\s*\(.*\)$/, "").trim() || String(v.name || ""); }

  function looksFemale(name) {
    return /(female|hazel|susan|serena|kate|stephanie|libby|sonia|samantha|victoria|catherine|zira|amelia|olivia|maisie|emily|joanna|salli|amy|emma|fiona|moira|tessa|karen|serena)/i.test(String(name || ""));
  }

  // The voices worth hearing when the prize is a British female: the design file's hints that this
  // machine actually has, then any other en-GB voice with a female name it has. Candidates the
  // machine lacks are skipped silently - the same command works on any machine.
  function auditionCandidates() {
    var held = voicesHeld();
    var out = [], seen = {};
    var add = function (v) {
      if (!v) return;
      var k = v.name + "|" + v.lang;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(v);
    };
    var hints = (design().audition && design().audition.britishFemale) || [];
    for (var h = 0; h < hints.length; h++) add(resolveBrowser(hints[h]));
    for (var i = 0; i < held.length; i++) if (/^en[-_]gb/i.test(held[i].lang || "") && looksFemale(held[i].name)) add(held[i]);
    return out;
  }

  function keepHint(v) {
    var n = indexOfVoice(v);
    return n ? "/voice browser " + n : "/voice browser " + v.name;
  }

  // Hears one voice without keeping it: the current role's rate and pitch (so it is what she would
  // actually sound like), an optional line of Patrikios' own instead of the sample, and no write to
  // kv and no change to what LISTEN replays.
  async function preview(nameOrIndex, roleId, text) {
    if (!ready) await load();
    if (guestUp()) { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); return { ok: false }; }
    if (typeof speechSynthesis === "undefined") { print("SYSTEM", "VOICE :: THIS BROWSER HAS NO SPEECH ENGINE."); return { ok: false }; }
    var hit = resolveBrowser(nameOrIndex);
    if (!hit) {
      print("SYSTEM", "VOICE :: NO BROWSER VOICE MATCHED \"" + String(nameOrIndex).toUpperCase() + "\". /voice voices LISTS THEM BY NUMBER." + hiddenInstead(nameOrIndex)
        + "\n(AN ELEVENLABS VOICE IS SET WITH /voice voice <NAME>, NOT /voice try - TRY IS THIS BROWSER ONLY.)");
      return { ok: false };
    }
    if (listening) stopListen(true);
    var v = roleVoice(roleId || roleIdNow()).browser;
    var spec = browserSpec(hit, v);
    var lim = Math.min(limitsNow().maxChars, 1600);   // a try/preview is a SAMPLE, not a reading
    var head = truncate(prepare(text && text.trim() ? text : sampleText()), lim);
    stopSpeakingInternal();
    var token = ++playToken;
    print("SYSTEM", "VOICE :: TRYING " + voiceTag(hit) + " AT RATE " + spec.rate + " PITCH " + spec.pitch
      + " :: " + head.text.length + " CHARS :: NOTHING IS SAVED."
      + "\n" + keepHint(hit).toUpperCase() + " KEEPS IT FOR " + roleLabel(roleId || roleIdNow()) + ".");
    var res = await browserSpeak(head.text, spec, token);
    if (token !== playToken) return { ok: false, cancelled: true };
    if (!res.ok && res.error && !res.cancelled) print("SYSTEM", "VOICE :: " + String(res.error.message || res.error).toUpperCase());
    return res;
  }

  async function auditionOne(rest, roleId) {
    var words = String(rest).trim().split(/\s+/);
    var name = "", text = "";
    for (var n = words.length; n >= 1; n--) {
      var cand = words.slice(0, n).join(" ");
      if (resolveBrowser(cand)) { name = cand; text = words.slice(n).join(" "); break; }
    }
    if (!name) {
      print("SYSTEM", "VOICE :: NO BROWSER VOICE MATCHED \"" + String(rest).toUpperCase() + "\". /voice voices LISTS THEM BY NUMBER, /voice audition HEARS THE BRITISH FEMALE ONES." + hiddenInstead(rest));
      return;
    }
    return preview(name, roleId, text);
  }

  // One after another, each candidate says its own name and then the sample - so the name is heard
  // in the voice it names - all at the current role's rate and pitch. LISTEN stops it. Nothing saved.
  async function audition(roleId) {
    if (!ready) await load();
    if (guestUp()) { print("SYSTEM", "GUESTCOMM :: PRIVATE - " + (guestWho() || "THE GUEST") + " IS ON THE LINE (HITL<>MAYA ONLY). BARBELO STAYS DARK WHILE IT IS UP."); return { ok: false }; }
    if (typeof speechSynthesis === "undefined") { print("SYSTEM", "VOICE :: THIS BROWSER HAS NO SPEECH ENGINE."); return { ok: false }; }
    var list = auditionCandidates();
    if (!list.length) { print("SYSTEM", "VOICE :: NO BRITISH FEMALE VOICE EXISTS ON THIS MACHINE. /voice voices SHOWS EVERYTHING IT HAS."); return { ok: false }; }
    if (listening) stopListen(true);
    var rid = roleId || roleIdNow();
    var v = roleVoice(rid).browser;
    stopSpeakingInternal();
    var token = ++playToken;
    holding = true;
    setUi();
    print("SYSTEM", "VOICE :: AUDITION :: " + list.length + " CANDIDATE" + (list.length === 1 ? "" : "S") + " :: EACH SAYS ITS NAME, THEN A SAMPLE,"
      + " AT " + roleLabel(rid) + "'S RATE " + num(v.rate, 1, 0.5, 2) + " AND PITCH " + num(v.pitch, 1, 0, 2) + "."
      + "\nPRESS LISTEN TO STOP. /voice try <#> REPEATS ONE. /voice browser <#> KEEPS IT. NOTHING IS SAVED UNTIL YOU DO.");
    for (var i = 0; i < list.length; i++) {
      if (token !== playToken) break;
      var spec = browserSpec(list[i], v);
      print("SYSTEM", "VOICE :: " + (i + 1) + "/" + list.length + " :: " + voiceTag(list[i]));
      var a = await browserSpeak((i + 1) + ". " + shortName(list[i]) + ".", spec, token);
      if (token !== playToken) break;
      if (!a.ok && a.error && !a.cancelled) { print("SYSTEM", "VOICE :: " + String(a.error.message || a.error).toUpperCase() + " :: THE AUDITION STOPS HERE."); break; }
      var b = await browserSpeak(sampleText(), spec, token);
      if (token !== playToken) break;
      if (!b.ok && b.error && !b.cancelled) { print("SYSTEM", "VOICE :: " + String(b.error.message || b.error).toUpperCase() + " :: THE AUDITION STOPS HERE."); break; }
    }
    if (holding) {
      holding = false;
      setUi();
      print("SYSTEM", "VOICE :: AUDITION OVER. /voice try <#> HEARS ONE AGAIN, /voice browser <#> KEEPS IT.");
    }
    return { ok: true, candidates: list.length };
  }

  function setBrowserVoice(name, roleId) {
    var hit = resolveBrowser(name);
    if (!hit) { print("SYSTEM", "VOICE :: NO BROWSER VOICE MATCHED \"" + String(name).toUpperCase() + "\". /voice voices LISTS THEM BY NUMBER - /voice try <#> HEARS ONE WITHOUT KEEPING IT." + hiddenInstead(name)); return; }
    store.roles[roleId] = store.roles[roleId] || {};
    store.roles[roleId].browser = store.roles[roleId].browser || {};
    store.roles[roleId].browser.name = hit.name;
    save();
    print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " WILL SPEAK IN " + voiceTag(hit) + " ON THIS BROWSER'S ENGINE."
      + (engineNow(roleId) === "elevenlabs" ? "\n(ELEVENLABS IS STILL THE ENGINE IN USE - /voice engine browser MAKES THIS BROWSER'S VOICE THE ONE SHE ACTUALLY SPEAKS WITH, AND IT COSTS NOTHING.)" : ""));
  }

  // ---- the buttons ---------------------------------------------------------

  // SHE IS HOLDING YOUR WORDS. While something he said is waiting for him to finish, the microphone
  // says so: a slower, darker pulse than an open microphone, and a title that spells it out. It is the visible
  // half of the hold - the answer to "is she going to cut me off?" asked before it happens.
  // STEADY UNDER THE PTT KEY: while the intercom finger is down the recogniser sessions end and
  // re-open behind it, so `listening` flaps - and without the pttHeld term below the holding
  // pulse would restart on every flap. The key owns the mic, so it counts as the mic in play.
  function pttHeld() {
    try { return !!(window.intercom && typeof window.intercom.held === "function" && window.intercom.held()); } catch (e) { return false; }
  }
  function paintHold() {
    var mic = el("liveBtn");
    if (!mic) return;
    var on = !!(holdParts.length && !speaking && (live || listening || pttHeld()));
    mic.classList.toggle("holding", on);
    if (live) {
      mic.title = speaking
        ? "she is speaking - press to hush her (the channel stays open)"
        : (on ? "she heard you and is waiting for you to finish - " + holdQuietMs() + "ms of quiet sends it, or press to send it now"
              : "the live channel is open - press to close it (with words held, the press sends them)");
    }
  }

  function setUi() {
    // THE TWO KEYS, NAMED FROM HIS SIDE OF THE GLASS (2026-09-24). `#talkBtn` is the MICROPHONE and
    // `#listenBtn` is her mouth: the ids, the labels on the keys and the wiring all agree. They did
    // not before the rename - the microphone lived on `#listenBtn` and her reply on `#talkBtn`, so
    // every press was a small act of translation. src/js/main.js wires them, in that order, to
    // voice.toggleMic() and voice.toggleSpeak().
    var talk = el("talkBtn"), listen = el("listenBtn");
    var mic = el("liveBtn");
    // WHOSE VOICE IS ON THE LINE. Everything below is one intercom: the lamp names the state, and a
    // key that is not his to press at this moment is LOCKED (disabled + aria-disabled + the .air
    // look), not merely dimmed. toggleMic()/toggleSpeak() refuse the press as well, so this is the
    // visible half of a rule that is actually enforced.
    var air = airState();
    airLast = air;
    var canT = canMic();
    var canL = canSpeak() && mode() !== "radio";
    if (talk) {
      // THE MICROPHONE. STOP while a one-shot session of his is open - and that key is the session's
      // own off switch (see canMic), so STOP here is pressable, which is what "push to talk, press
      // again to stop" means. The live channel reads LIVE in the title instead, because its own key
      // does the stopping there.
      // STEADY UNDER THE PTT KEY: the intercom's held sessions end and re-open behind the finger,
      // so `listening` flaps - and each flap used to flip this key's text TALK<->STOP and restart
      // its pulse, which is the jitter. While the finger is down the mic is his, session or gap.
      var heldPtt = pttHeld();
      var micOpen = !!((listening && !live) || heldPtt);
      talk.textContent = micOpen ? "STOP" : "TALK";
      talk.classList.toggle("live", micOpen);
      talk.disabled = !canT;
      talk.setAttribute("aria-disabled", canT ? "false" : "true");
      talk.classList.toggle("air", !canT);
      talk.title = !canT
        ? (live
          ? "the live channel owns the microphone - press the microphone to close it"
          : (air === "HER VOICE"
            ? "she has the floor - an intercom does not talk over her, and her own voice is never fed back into an open microphone. press the microphone (live channel) to hush her, or /voice stop"
            : "the line is busy (" + air + ") - TALK opens when it is clear"))
        : (micOpen
          ? "stop the microphone - what it heard is kept" + (micAutoOn() ? " and goes to her when you stop" : " in the input box, for you to edit")
          : "push to talk: the microphone opens, and what you say lands in the input box");
    }
    if (listen) {
      // HER MOUTH. STOP while an audition is playing - the one thing this key has always stopped.
      listen.textContent = holding ? "STOP" : "LISTEN";
      listen.classList.toggle("live", !!holding);
      listen.disabled = !canL;
      listen.setAttribute("aria-disabled", canL ? "false" : "true");
      listen.classList.toggle("air", !canL);
      listen.title = !canL
        ? (air === "HER VOICE"
          ? "she has the floor - an intercom does not talk over her. /voice stop silences her if you mean it"
          : "the line is busy (" + air + ") - LISTEN opens when it is clear")
        : (holding
          ? "stop the audition"
          : "she reads her newest reply out loud" + (engineNow(roleIdNow()) === "elevenlabs" ? " (ElevenLabs)" : " (this browser's voice)"));
    }
    if (mic) {
      // Off: an open outline. On: green and pulsing (the channel is open). While she speaks: solid,
      // no pulse - the ears are shut on purpose. While your words are held: a slow, dark pulse.
      mic.classList.toggle("on", live);
      mic.classList.toggle("speaking", live && speaking);
      mic.setAttribute("aria-pressed", live ? "true" : "false");
      var radioDark = (mode() === "radio");
      mic.disabled = radioDark;
      mic.title = live
        ? (speaking ? "she is speaking - press to hush her (the channel stays open)" : "the live channel is open - press to close it")
        : "live conversation: open the microphone and leave it open - she answers aloud, then listens again";
    }
    // THE MODE LAMP - the left panel's switch, painted here because every lane change
    // already repaints the keys through here.
    var mlamp = el("modeLamp");
    if (mlamp) {
      var mm = mode();
      mlamp.textContent = "MODE :: " + (mm === "radio" ? "RADIO SILENCE" : (mm === "talk" ? "TALK" : "TEXT"));
      mlamp.className = "modeLamp " + (mm === "radio" ? "silent" : (mm === "talk" ? "talk" : "text"));
      mlamp.title = "the conversation's mode: TEXT (type, she texts), RADIO SILENCE (text turns only - no microphone, no voice), TALK (the speech conversation). /mode SAYS IT IN WORDS.";
    }
    // THE AIR LAMP - the same state, in words.
    var lamp = el("airLamp");
    if (lamp) {
      lamp.textContent = air;
      lamp.className = "airLamp " + (air === "HER VOICE" ? "her"
        : (air === "YOUR VOICE" ? "you" : (air === "HER TURN" ? "busy" : (air === "HOLDING" ? "holding" : "standby"))));
      lamp.title = "whose voice is on the line: " + air + ". TALK and LISTEN are one intercom - one voice at a time, and the key that is not yours is locked.";
    }
    paintHold();
    levelSync();   // the meter only ever runs while the microphone is in play (see THE ROOM HEARS YOU)
  }

  // THE ONE STATE WITH NO EVENT OF ITS OWN is HER TURN: a reply is being made, and nothing about the
  // voice module changes while it is. So the lamp and the locks are also repainted on a slow tick, and
  // only when the state string actually changes - a lamp that lies about who has the line is worse
  // than no lamp at all. It reads the same airState() the buttons do, so there is one answer.
  var airLast = "";
  var airTimer = null;
  function airTick() { if (airState() !== airLast) setUi(); }
  function watchAir() {
    if (airTimer) return;
    airTimer = setInterval(airTick, 400);
  }

  // ---- THE VOX PANEL'S DOOR (src/js/vox.js) --------------------------------
  //
  // ONE PLACE A VOICE OF ANY ROAD CAN BE HEARD AND KEPT. The panel is a FRONT-END and nothing more:
  // every list below is read from the module that OWNS that road (this browser's own list, the wire's
  // thirty, the local model's roster, the ElevenLabs account's voices), and every write goes through
  // the same stored shape the /voice verbs write - so the panel cannot drift from the commands. That
  // is the rule /story sample already follows: there is no second way of setting a voice.
  //
  // THE FOUR ROADS, AND WHAT EACH CAN DO. All four can be HEARD and KEPT; two of them can also be
  // turned into BYTES, which is what a clone sample is:
  //   browser     NOT clippable: the Web Speech API plays into the speakers and exposes no audio at
  //               all - no stream, no buffer, nothing to capture (measured, not assumed).
  //   wire        NOT clippable: those voices are synthesized INSIDE the live socket, and what
  //               arrives is speech being streamed, not a file.
  //   kokoro      CLIPPABLE: the model runs in a worker and hands back a WAV.
  //   elevenlabs  CLIPPABLE: the endpoint answers with mp3 bytes - and bills by the character, so a
  //               preview on that road costs exactly what saying the line costs.
  // `clippable` is a property of the ROAD and not a choice, so the panel says so in words rather than
  // offering a button that cannot work.
  function voxClippable(road) { return road === "kokoro" || road === "elevenlabs"; }

  // ---- MALE OR FEMALE (the tag in every VOX row) ---------------------------
  //
  // Patrikios, 2026-09-30: *"For the moment, I ask that the available voices be TAGGED - Male or
  // Female - in the VOX system."* Two of the four roads SAY it and nothing is guessed there: the
  // local model's roster carries `gender` for every voice, and the ElevenLabs palette states it in
  // each voice's own note (an account's list carries it in `labels.gender`). Two roads say NOTHING -
  // this browser's list and the live wire expose no such field - so there the NAME is read against
  // the table in src/voice/voices.json -> sex.map: the whole lowercased name first, then each word of
  // it. That is the same modest inference every voice picker makes, and it is marked as inference
  // wherever it is shown. A voice that is neither labelled nor named is left UNTAGGED rather than
  // guessed - the star-named wire voices carry no sex in any official listing, and River is 'neutral'
  // on purpose - so a missing tag means "we do not know", never "we forgot".
  function sexMap() {
    try {
      var d = design();
      if (d && d.sex && d.sex.map) return d.sex.map;
    } catch (e) { }
    return {};
  }
  // A gender WORD, as a road states it ("Female", "male, deep and calm", "f"). Female is tried first
  // because "female" contains "male".
  function sexHint(h) {
    h = String(h == null ? "" : h).toLowerCase();
    if (!h) return "";
    if (/female|feminine|woman|girl|madame|(^|[^a-z])lady([^a-z]|$)/.test(h)) return "F";
    if (/(^|[^a-z])male([^a-z]|$)|masculine|(^|[^a-z])man([^a-z]|$)|(^|[^a-z])boy([^a-z]|$)|gentleman/.test(h)) return "M";
    if (/(^|[^a-z])f([^a-z]|$)/.test(h)) return "F";
    if (/(^|[^a-z])m([^a-z]|$)/.test(h)) return "M";
    return "";
  }
  // The NAME, against the table. A name that literally contains "female"/"male" (the Google pair) is
  // settled by its own words; otherwise the table decides.
  function sexFromName(name) {
    var n = String(name == null ? "" : name).toLowerCase();
    if (!n) return "";
    if (/female/.test(n)) return "F";
    if (/(^|[^a-z])male([^a-z]|$)/.test(n)) return "M";
    var map = sexMap();
    if (map[n]) return map[n];
    var toks = n.split(/[^a-z0-9\u00c0-\u024f\u0370-\u03ff]+/);
    for (var i = 0; i < toks.length; i++) if (toks[i] && map[toks[i]]) return map[toks[i]];
    return "";
  }
  // "F", "M", or "" - the road's own word when it has one, the name otherwise.
  function sexOf(name, hint) {
    var h = sexHint(hint);
    return h || sexFromName(name);
  }

  // THE WHOLE MENU, ROAD BY ROAD, for one role (the one on stage unless another is named). Each row
  // carries the ROAD'S OWN handle in `ref` - a browser voice's name or number, a wire voice's name, a
  // model voice's id, an ElevenLabs id - so the panel never has to know how a road is addressed.
  function voxRoster(roleId) {
    roleId = (roleId === undefined) ? roleIdNow() : roleId;
    var v = roleVoice(roleId);
    var eng = engineNow(roleId);
    var roads = [];
    // THIS BROWSER
    var cur = pickBrowserVoice(v.browser);
    roads.push({
      id: "browser", label: "THIS BROWSER", clippable: false, live: eng === "browser",
      note: allHeld().length + " VOICE" + (allHeld().length === 1 ? "" : "S") + " IN THIS MACHINE'S LIST"
        + (hiddenVoices().length ? " :: " + hiddenVoices().length + " OFF THE MENU" : ""),
      voices: allHeld().map(function (b) {
        var lang = String(b.lang || "");
        return {
          ref: String(indexOfVoice(b) || b.name), id: b.name, label: shortName(b),
          note: lang + (/^en/i.test(lang) ? " \u00b7 " + qualityWord(b) : ""),
          sex: sexOf(b.name, ""),
          current: !!cur && b.name === cur.name, off: isHiddenVoice(b)
        };
      })
    });
    // THE WIRE (the thirty the live session speaks with)
    var W = liveWire();
    var wcur = W ? String((W.settings() || {}).voice || "") : "";
    var table = (W && W.voicesTable) ? W.voicesTable() : (W ? W.voices().map(function (n) { return { name: n, character: "" }; }) : []);
    var offered = W ? W.voices() : [];
    var every = (W && W.voicesAll) ? W.voicesAll() : offered;
    roads.push({
      id: "wire", label: "THE WIRE", clippable: false, live: eng === "wire",
      note: W ? (table.length + " VOICES, SPOKEN INSIDE THE LIVE CHANNEL :: IT NEEDS A GOOGLE KEY TO BE HEARD AT ALL")
        : "THE WIRE IS NOT ON THIS PAGE",
      voices: every.map(function (n) {
        var row = null;
        for (var i = 0; i < table.length; i++) if (table[i].name === n) row = table[i];
        return { ref: n, id: n, label: n, note: (row && row.character) ? row.character : "", sex: sexOf(n, ""), current: n === wcur, off: !!(W && W.isHidden(n)) };
      })
    });
    // THE LOCAL VOICE (kokoro). Its list comes from the MODEL, so until the model is fetched there is
    // nothing to show but the picks the design already names.
    var K = kokoroEngine();
    var kready = !!(K && K.ready());
    var kcur = kokoroVoice(roleId);
    var kroster = kready ? K.roster() : [];
    roads.push({
      id: "kokoro", label: "THE LOCAL VOICE", clippable: true, live: eng === "kokoro" || eng === "stream",
      note: kready ? (kroster.length + " VOICES, " + kroster.filter(function (x) { return String(x.gender).toLowerCase() === "female"; }).length + " FEMALE AND " + kroster.filter(function (x) { return String(x.gender).toLowerCase() === "male"; }).length + " MALE :: FREE, OFFLINE, AND ABOUT 2x REAL TIME ON THIS MACHINE")
        : "THE MODEL IS NOT FETCHED YET (ABOUT 90MB, ONCE PER BROWSER) - /voice kokoro warm",
      voices: kroster.map(function (x) {
        return {
          ref: x.id, id: x.id, label: x.name,
          note: [String(x.gender || "").toLowerCase(), x.grade ? "GRADE " + x.grade : "", x.traits || ""].filter(Boolean).join(" \u00b7 "),
          sex: sexOf(x.name, x.gender),
          current: x.id === kcur, off: false
        };
      })
    });
    // ELEVENLABS (her real voice, through the keyring)
    var kr = keyring();
    var accounts = (store.voices && store.voices.length) ? store.voices : shippedVoices();
    var fromAccount = !!(store.voices && store.voices.length);
    var ecur = String(v.elevenlabs.voiceId || (store.resolved[roleId] && store.resolved[roleId].id) || "");
    roads.push({
      id: "elevenlabs", label: "ELEVENLABS", clippable: true, live: eng === "elevenlabs",
      note: (kr && kr.has("elevenlabs"))
        ? (fromAccount ? accounts.length + " VOICES IN THE ACCOUNT" : accounts.length + " IN THE SHIPPED PALETTE - THE ACCOUNT'S OWN LIST NEEDS A KEY WITH THE \"VOICES READ\" PERMISSION")
        : "NO KEY IS HELD, SO THIS ROAD CANNOT SPEAK (AND CANNOT BE RECORDED) - THE KEYS PANEL TAKES ONE",
      voices: accounts.map(function (x) {
        return { ref: String(x.id || x.voiceId), id: String(x.id || x.voiceId), label: String(x.name || x.voiceId || x.id), note: String(x.category || x.note || ""), sex: sexOf(x.name, (x.gender || "") + " " + (x.note || "")), current: String(x.id || x.voiceId) === ecur, off: false };
      })
    });
    return { role: roleId, roleLabel: roleLabel(roleId), engine: eng, roads: roads, clippable: { kokoro: true, elevenlabs: true, browser: false, wire: false } };
  }

  // HEAR ONE, CHANGE NOTHING. Browser and wire go through their own preview doors - the same ones
  // /voice try and /voice wire try use. The two clippable roads are heard by MAKING THE BYTES and
  // playing them, so a preview there is exactly what keeping it would produce (and on ElevenLabs it
  // costs a credit per character, which the panel says before you press it).
  async function voxPreview(road, ref, roleId, text) {
    if (!ready) await load();
    roleId = (roleId === undefined) ? roleIdNow() : roleId;
    var what = String(text == null ? "" : text).trim() || sampleText();
    if (road === "browser") return preview(ref, roleId, text);
    if (road === "wire") {
      var W = liveWire();
      if (!W) throw new Error("THE WIRE IS NOT ON THIS PAGE");
      if (W.isHidden(ref)) throw new Error("\"" + String(ref).toUpperCase() + "\" IS OFF THE WIRE'S LIST ON THIS DEVICE - /voice wire show " + String(ref).toUpperCase() + " PUTS IT BACK IN THE LIST");
      return speakIn(String(ref), what);
    }
    var made = await mint(what, road, { voice: ref, role: roleId });
    return playPiece(made.blob);
  }

  // KEEP ONE. Each road's write is the write its own verb makes, so what the panel sets is exactly
  // what the command sets. `ref` is the road's own handle (see voxRoster).
  function voxSet(road, ref, roleId) {
    roleId = (roleId === undefined) ? roleIdNow() : roleId;
    ref = String(ref == null ? "" : ref).trim();
    if (!ref) return false;
    if (road === "browser") { setBrowserVoice(ref, roleId); return true; }
    if (road === "elevenlabs") { setElevenVoice(ref, roleId); return true; }
    if (road === "wire") {
      var W = liveWire();
      if (!W) { print("SYSTEM", "VOICE :: THE WIRE IS NOT ON THIS PAGE."); return false; }
      if (W.isHidden(ref)) { print("SYSTEM", "VOICE :: \"" + ref.toUpperCase() + "\" IS OFF THE WIRE'S LIST ON THIS DEVICE - /voice wire show " + ref.toUpperCase() + " PUTS IT BACK."); return false; }
      W.setSetting("voice", ref).then(function () {
        print("SYSTEM", "VOICE :: HER VOICE ON THE WIRE IS \"" + String((W.settings() || {}).voice).toUpperCase() + "\". IT IS ONLY HEARD WHERE THE WIRE'S MOUTH IS OPEN - THE LIVE CHANNEL - AND IN /voice wire try.");
      }).catch(function (e) { print("SYSTEM", "VOICE :: THE WIRE REFUSED THAT VOICE :: " + String((e && e.message) || e)); });
      return true;
    }
    if (road === "kokoro") {
      var K = kokoroEngine();
      if (!K || !K.ready()) { print("SYSTEM", "VOICE :: THE LOCAL VOICE'S LIST COMES FROM THE MODEL, SO IT HAS TO BE FETCHED FIRST: /voice kokoro warm (ABOUT 90MB, ONCE PER BROWSER)."); return false; }
      var hit = K.pick(ref);
      if (!hit) { print("SYSTEM", "VOICE :: \"" + ref.toUpperCase() + "\" IS NOT ONE OF THE MODEL'S VOICES - /voice kokoro voices LISTS THEM."); return false; }
      if (!store.roles[roleId]) store.roles[roleId] = {};
      store.roles[roleId].kokoro = Object.assign({}, store.roles[roleId].kokoro || {}, { voice: hit.id, at: Date.now() });
      save(); setUi();
      print("SYSTEM", "VOICE :: " + roleLabel(roleId) + " WEARS \"" + String(hit.name).toUpperCase() + "\" (" + hit.id + (hit.grade ? ", GRADE " + hit.grade : "") + ") ON THE LOCAL VOICE. NOTHING ELSE ABOUT THE ROLE CHANGED. /voice kokoro voice default CLEARS IT BACK.");
      return true;
    }
    return false;
  }

  function voxHide(road, ref, hide) {
    ref = String(ref == null ? "" : ref).trim();
    if (!ref) return { ok: false, error: "NO VOICE NAMED" };
    if (road === "browser") {
      var hit = null;
      try { hit = resolveIn(allHeld(), ref); } catch (e) { hit = null; }
      if (!hit) return { ok: false, error: "NO BROWSER VOICE MATCHED \"" + ref.toUpperCase() + "\"" };
      var rest = hiddenVoices().filter(function (x) { return x !== hit; });
      if (hide) rest = rest.concat([hit]);
      var r = setHiddenVoices(rest);
      var kept = (hit === pickBrowserVoice(roleVoice(roleIdNow()).browser));
      return { ok: true, kept: kept, hidden: r.hidden.length, offered: r.offered.length };
    }
    if (road === "wire") {
      var W = liveWire();
      if (!W) return { ok: false, error: "THE WIRE IS NOT ON THIS PAGE" };
      var list = W.hiddenVoices().slice();
      var at = -1, canon = String(ref).toLowerCase();
      for (var i = 0; i < list.length; i++) if (String(list[i]).toLowerCase() === canon) at = i;
      if (hide && at === -1) list.push(ref);
      if (!hide && at !== -1) list.splice(at, 1);
      var done = W.setHidden(list);
      return { ok: true, hidden: done.hidden.length, offered: done.visible.length };
    }
    return { ok: false, error: "ONLY THE BROWSER AND THE WIRE TAKE VOICES OFF THE LIST" };
  }

  // THE BYTES BEHIND A VOICE - the one road between the voice lane and the story lane, because a
  // clone sample IS bytes. TWO ROADS ANSWER AND TWO CANNOT, and the reason is not a choice: the Web
  // Speech API exposes nothing to capture, and the wire's voices are spoken inside a live socket.
  // Everything else about the record (its name, its folder, its tags) belongs to the caller.
  async function mint(text, road, opts) {
    opts = opts || {};
    var what = String(text == null ? "" : text).trim() || sampleText();
    if (!voxClippable(road)) throw new Error("THE " + String(road).toUpperCase() + " ROAD CANNOT BE RECORDED - IT PLAYS INTO THE SPEAKERS AND OFFERS NO AUDIO TO KEEP. THE LOCAL VOICE AND ELEVENLABS DO.");
    var role = (opts.role === undefined) ? roleIdNow() : opts.role;
    if (road === "kokoro") {
      var K = kokoroEngine();
      if (!K) throw new Error("THE LOCAL VOICE IS NOT ON THIS PAGE");
      if (!K.ready()) await K.warm();
      var kv2 = String(opts.voice || kokoroVoice(role));
      var t0 = Date.now();
      var out = await K.say(what, kv2, { speed: kokoroSpeed(role) });
      return { blob: out.blob, mime: "audio/wav", ext: "wav", road: "kokoro", voice: kv2, name: K.name(kv2), secs: out.secs, ms: out.ms || (Date.now() - t0) };
    }
    // ELEVENLABS
    var kr = keyring();
    if (!kr || !kr.has("elevenlabs")) throw new Error("NO ELEVENLABS KEY IS HELD, SO THERE IS NOTHING TO RECORD");
    var rv = roleVoice(role);
    var vid = String(opts.voice || rv.elevenlabs.voiceId || (store.resolved[role] && store.resolved[role].id) || "").trim();
    if (!vid) { var acc = (store.voices && store.voices.length) ? store.voices : shippedVoices(); if (acc.length) vid = String(acc[0].id || acc[0].voiceId || ""); }
    if (!vid) throw new Error("NO ELEVENLABS VOICE IS CHOSEN AND NONE COULD BE READ - /voice voices LISTS THEM");
    var d = design();
    var fmt = (d.elevenlabs && d.elevenlabs.outputFormat) || "mp3_44100_128";
    var settings = rv.elevenlabs.settingsExact
      ? Object.assign({}, rv.elevenlabs.settings || {})
      : Object.assign({}, (d.elevenlabs && d.elevenlabs.settings) || {}, rv.elevenlabs.settings || {});
    var t1 = Date.now();
    var res = await kr.request("elevenlabs", EL + "/v1/text-to-speech/" + encodeURIComponent(vid) + "?output_format=" + encodeURIComponent(fmt), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({ text: what, model_id: modelNow(role), voice_settings: settings })
    });
    if (!res.ok) {
      var raw = "";
      try { raw = String(await res.text()).replace(/\s+/g, " ").trim(); } catch (e) { raw = ""; }
      var safe = kr.scrub(raw, "elevenlabs");
      var facts = refusalFacts(res.status, safe.slice(0, 4000));
      var err = new Error(facts.message || safe.slice(0, 220) || ("HTTP " + res.status));
      err.status = res.status; err.refusal = facts;
      throw err;
    }
    var blob = await res.blob();
    return { blob: blob, mime: "audio/mpeg", ext: "mp3", road: "elevenlabs", voice: vid, name: nameOfVoice(vid) || "", secs: 0, ms: Date.now() - t1 };
  }

  return {
    load: load, ready: function () { return ready; },
    speak: speak, speakLast: speakLast, onReply: onReply, stop: stop, toggleSpeak: toggleSpeak,
    preview: preview, audition: audition, candidates: auditionCandidates, sample: sampleText,
    // For the terminal's own tests: how good a voice is, the best one this machine holds, and whether
    // this is an iPhone (where the voice list and the speech engine are both gesture-gated).
    qualityOf: voiceQuality, qualityWord: qualityWord,
    bestVoice: function (roleId) { return bestForRole(roleId); },
    isIos: isIos, chunkChars: chunkChars,
    // The room meter, for the terminal's own tests (and for any lane that wants to know whether there
    // is a voice in the room): the newest reading, the threshold in use, and whether it is loud now.
    level: function () { return { rms: levelRms, on: levelOn(), loud: levelLoud(), meter: !!levelCtx, down: levelOff }; },
    levelSample: levelSample,
    // The text-preparation pair the story lane borrows: `clean` is the same filter her replies go
    // through before they are spoken (directives and markdown out, whitespace normalised), and
    // `chunk` is the sentence-aware splitter the browser engine speaks in pieces with - a story of
    // twenty minutes is split by the same code, just with a much bigger piece size.
    clean: prepare, chunk: chunk,
    // The provider side of the voice, for the terminal's own tests: which model she speaks with,
    // the profiles on file, and the translation of an ElevenLabs refusal (so the wording can be
    // checked against a real measured body rather than guessed at).
    model: modelNow, models: modelTable, modelKnown: modelKnown,
    profiles: function () { return shippedProfiles(); }, profile: findProfile,
    explainRefusal: explainRefusal, refusalFacts: refusalFacts,
    // THE LOCAL VOICE, for the engine module (src/js/kokoro.js reads its settings from here so there
    // is one reader of src/voice/voices.json) and for the terminal's own tests: which voice the role
    // on stage would wear on that road, and how fast it would be asked to speak.
    kokoroDesign: function () { return (design().kokoro) || {}; },
    kokoroVoice: kokoroVoice, kokoroSpeed: kokoroSpeed,
    // THE VOX PANEL'S DOOR (src/js/vox.js): the whole menu road by road, hearing one without keeping
    // it, keeping one, and the bytes behind a voice - which is what the story lane clones from.
    voxRoster: voxRoster, voxPreview: voxPreview, voxSet: voxSet, voxHide: voxHide, mint: mint, voxClippable: voxClippable, sexOf: sexOf,
    listen: startListen, stopListen: stopListen, toggleMic: toggleMic, micTest: micTest, freeStuckSend: freeStuckSend,
    mode: mode, modeName: modeName, setMode: setMode,
    hushMic: function () { micHush = true; return true; },
    deferTake: function (v) { takeDefer = (v == null ? true : !!v); return takeDefer; },
    dropHold: function () { try { clearHold(); } catch (e) {} takeDefer = false; return true; },
    // THE KEY'S PRESS-CHECK reads this 900ms after the press: a held re-open scheduled (or still
    // waited out) within the last three seconds means the voice lane owns liveness, so the check
    // must not stand the finger down. A refusal schedules nothing, so a truly dead microphone
    // still puts the lamp back by itself.
    heldReopen: function () { return !!(takeDefer && heldReopenAt && (Date.now() - heldReopenAt < 3000)); },
    live: startLive, stopLive: stopLive, toggleLive: toggleLive,
    state: state, summary: summary, describe: describe, report: report, setUi: setUi,
    // THE INTERCOM, for the terminal's own tests: whose voice is on the line right now, and whether
    // each key would be obeyed. `air()` is the same answer the lamp and the locks are painted from.
    air: airState, canSpeak: canSpeak, canMic: canMic, airLine: airLine,
    isSpeaking: function () { return speaking; }, isListening: function () { return listening; },
    isLive: function () { return live; },
    barbCallsign: barbCallsign,
    // The pregnant pause, for the terminal's own tests: the last turn the meter scored.
    silence: {
      scored: function () { return lastSilence; }
    },
    // The echo guard, for the terminal's own tests: what she has said aloud, and whether a transcript
    // would be refused as a re-hearing of it. `clear` empties the memory of her voice.
    echo: {
      remember: rememberVoiced,
      refuse: looksLikeHerOwn,
      plausible: echoPlausible,
      heard: function () { try { return guard().state(); } catch (e) { return { ok: false }; } },
      clear: function () { try { guard().forget(); } catch (e) {} return true; }
    },
    // The hold, for the terminal's own tests: what is waiting, how long the quiet must be, and a way
    // to take it now instead of waiting.
    held: {
      text: holdText,
      // A session id of its own, so a test hold can never be merged into a real one.
      heard: function (text, settled, from, suspect) { return holdHeard("test", text, from || "talk", settled, suspect); },
      ms: function (v) { if (v != null) holdMs = Math.max(HOLD_MIN, Math.min(HOLD_MAX, Number(v) || holdMs)); return holdMs; },
      tail: function (v) {
        if (v === "auto" || v === "default" || v === false) holdTail = null;
        else if (v != null) holdTail = Math.max(0, Math.min(TAIL_MAX, Number(v) || 0));
        return holdTailMs();
      },
      derived: function () { return holdTail == null; },
      quietMs: holdQuietMs,
      settled: function (v) { if (v != null) holdSettled = !!v; return holdSettled; },
      take: takeHold,
      tick: holdTick,
      strip: stripHerWords,
      clear: clearHold
    }
  };
})();
