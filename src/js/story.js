window.story = (function () {
  "use strict";

  /* THE STORY LANE - longform narration, rendered elsewhere and played in here.

     WHY IT EXISTS
     The live voice (ElevenLabs, or this browser's own) is built for a sentence or two: it costs per
     character, it answers immediately, and it is the wrong tool for a chapter. A story is minutes of
     speech, it is written once, and nobody needs it the instant it is written. So LONGFORM LEAVES THE
     LIVE ENGINE ENTIRELY: the text goes to a free ZeroGPU Space on HuggingFace (Resemble AI's own
     Chatterbox - TTS with real voice cloning) and comes back as audio that plays here, in the log,
     while the two of them listen. The live engine stays what it is: the mouth she answers with.

     THE PIPELINE (measured end to end from this page, 2026-09-21)
        her words (a reply she just gave, or text he handed over)
          -> cleaned and split at sentence ends into PARTS of about LIA_STORY_CHUNK characters
     The shape is the same for every Gradio Space, and both spaces this lane knows are named in HOSTS
     below; Chatterbox's endpoint is /gradio_api/call/generate_tts_audio.
          -> POST {base}{call}          -> { event_id }
          -> GET  {base}{call}/{event_id}    (SSE)
                 "event: complete"  -> [ { url: .../file=.../dramabox_x.wav } ]
                 "event: error"     -> { "error": "<why>", ... }
          -> the .wav is fetched (CORS is open, measured) -> a Blob -> <audio> -> played
     Parts are rendered ONE AT A TIME and the next is rendered while the current one plays, so speech
     begins as soon as the first part exists instead of waiting for the whole chapter.

     THE SWITCH (Patrikios, 2026-09-21: "if interrupted or asked a question, switch to LIVE CHAT TTS.
     then keeps playing back audio. when done, she returns to LIVE Text-to-Speech")
     While a story plays she is LISTENING, not speaking - the words were rendered earlier. So if he
     talks over it, or a turn is in flight, the story PAUSES (the live voice needs the room), her reply
     goes out on the live engine exactly as any other reply does, and when the room is free again the
     story CARRIES ON from the word it stopped at. When the story ends the terminal is simply live
     again. `/story on` is the standing version of that: while it is armed, a longform reply is
     rendered here instead of being spoken on the live engine.

     WHAT IT DOES NOT DO
     Nothing here writes a word. What is rendered is what she already said, or text he handed over -
     this module is a mouth for text that exists, never a second author. It also never touches her
     instructions: there is no prompt in this file and no rule telling her to write at length. Length
     is his to ask for, and hers to decide.

     THE ECHO GUARD IS FED (this matters)
     A story is minutes of her voice going straight into the room with the microphone possibly open.
     SpeechRecognition has no echo cancellation, so the recogniser WILL transcribe it - and the guard
     that refuses her own voice coming back (voice.js, `looksLikeHerOwn`) can only refuse what it has
     been told she said. So every part is fed to the guard BEFORE it is heard, a sentence at a time,
     paced by the playhead (a whole part at once would make a word-pool so big that his own short
     questions started matching it).

     THE VOICE IT SPEAKS IN (his "CUSTOM AUDIO SAMPLE > CLONE > TTS")
     Chatterbox clones from a reference clip: the clip becomes speaker conditionals and the speech is
     generated from them, so the sample IS the voice. `/story sample <ID|NAME>` takes one from the vault (an
     audio record - the same vault ATTACHMENTS already fills), and the clip is uploaded to the Space
     once per session, silently, the first time a part is rendered. Nothing is uploaded until a story
     is actually rendered, and the upload leaves the device - it is a public Space, so the sample goes
     to HuggingFace's hardware and nowhere else. With no sample set the Space speaks in its own
     default voice and says so.

     AN AGENT HAS A SAMPLE OF ITS OWN (Patrikios, 2026-09-21: "You'll need a audio sample per Agent
     LIA."). The sample is the voice, so it belongs to the ROLE the way the voice does - Barbelo's
     clip for Barbelo, hers for her off stage - and the lane keeps ONE SAMPLE PER AGENT rather than
     one for the terminal. `/story sample <ID|NAME>` sets it FOR THE ROLE ON STAGE; `for <ROLE>`
     aims it at an agent who is not on stage, `as default` sets the FALLBACK that answers for any
     agent with no sample of its own (the single sample this lane used to keep became exactly that
     fallback, so nothing set before this changed its meaning). A story CAPTURES the voice it
     begins in: the sample is fixed into the job when the story is made, so shifting her onto
     another layer mid-chapter does not change the voice of the chapter - one story, one
     performance (the same reason the seed is fixed). `/story sample` with no argument is the table:
     every agent, what it speaks in, and the audio records in the vault to choose from.

     NO KEY IS REQUIRED, AND A KEY IS USED IF THERE IS ONE
     Measured 2026-09-21: the Space answers anonymous calls - the start, the SSE stream, the .wav and
     the reference upload all answered this page with CORS open. A held Hugging Face key IS sent when
     there is one, so the ZeroGPU minutes are charged to his account rather than to a shared address;
     and if the keyed road fails, the same call is retried anonymously rather than failing, because a
     mistyped or revoked token must not cost him the feature. `state().road` says which road actually
     worked, and `state().keyNote` says what happened to the attempted one.

     THE STRIP
     `#storyStrip` above the input is the transport (play, pause, part back/forward, a scrub inside the
     current part, volume, and a close). It borrows the audition bus's own class names on purpose:
     there is one visual language for "something is playing here" and it is already written in
     src/css/terminal.css. The bus itself ducks under a story - a story is her voice, so the music
     comes down for it exactly as it does for her live voice.

     Commands: /story · /story on|off · /story read <TEXT> · /story tell <REQUEST>
               /story pause · /story resume · /story stop · /story next · /story back
               /story sample [<ID|NAME> [for <ROLE> | as default]] | [off [<ROLE>|default|all]]
               /story parts · /story road · /story space [<NAME>] · /story keep [on|off] · /story split <TEXT>
     ------------------------------------------------------------------ */

  // THE SPACES (both measured from this page, see src/TODO.md §1z).
  //
  // CHATTERBOX is the one he named, and it is the right one: it is Resemble AI's own TTS with real
  // voice cloning - the reference clip is turned into speaker conditionals (`prepare_conditionals`)
  // and the whole utterance is generated from them, so the sample DEFINES the voice. Its demo hands
  // every clip to `generate(text[:300], audio_prompt_path=...)`, with exaggeration/temperature/cfg
  // weight/vad-trim as the only knobs, and it HARD-TRUNCATES the text at 300 characters - so a part
  // is never allowed to exceed that here (see piecesFor), because a silent truncation would drop
  // words out of a story without saying so.
  //
  // DRAMABOX was the first road, wired to its published schema, and it DID receive the reference
  // (measured: audio_ref -> RE-USE denoise -> VAE encode). It is kept as a fallback, not as the
  // default: its cloning is a style/denoise pass over a reference rather than a speaker-conditioned
  // synthesis, and /story space dramabox switches to it.
  var HOSTS = {
    chatterbox: {
      id: "chatterbox",
      label: "HUGGINGFACE CHATTERBOX",
      base: "https://resembleai-chatterbox.hf.space",
      name: "generate_tts_audio",
      call: "/gradio_api/call/generate_tts_audio",
      upload: "/gradio_api/upload",
      maxChars: 300,
      what: "RESEMBLE AI'S OWN TTS - THE REFERENCE CLIP IS THE VOICE (SPEAKER CONDITIONALS), 300 CHARACTERS A CALL",
      params: function (text, ref) { return [text, ref || null, EXAG, TEMP, SEED, CFGW, VAD]; }
    },
    "chatterbox-cpu": {
      id: "chatterbox-cpu",
      label: "CHATTERBOX ON CPU (A THIRD-PARTY SPACE)",
      base: "https://olavaud-chatterbox-unlimited.hf.space",
      name: "generate",
      call: "/gradio_api/call/generate",
      upload: "/gradio_api/upload",
      maxChars: 2000,
      what: "THE SAME MODEL RUN BY A STRANGER ON A PLAIN CPU - NO GPU QUOTA AT ALL, AND SLOW (MEASURED: A SHORT LINE TOOK 32-39 SECONDS)",
      params: function (text, ref) { return [text, ref || null, EXAG, TEMP, SEED, CFGW]; }
    },
    sesame: {
      id: "sesame",
      label: "SESAME CSM-1B (VOICE CLONE)",
      base: "https://sesame-csm-1b.hf.space",
      name: "infer",
      call: "/gradio_api/call/infer",
      upload: "/gradio_api/upload",
      maxChars: 1200,
      what: "SESAME'S OWN CONVERSATIONAL MODEL - THE SAMPLE PLAYS BOTH SPEAKERS, SO ONE LINE COMES BACK IN ONE CLONED VOICE, 1200 CHARACTERS A CALL",
      params: function (text, ref) { var t = String(transcriptFor(lastSamp) || "").slice(0, 400); return [t, t, ref || null, ref || null, text]; }
    },
    dramabox: {
      id: "dramabox",
      label: "HUGGINGFACE DRAMABOX",
      base: "https://resembleai-dramabox.hf.space",
      name: "generate_audio",
      call: "/gradio_api/call/generate_audio",
      upload: "/gradio_api/upload",
      maxChars: 2000,
      what: "EXPRESSIVE TTS - THE REFERENCE SHAPES STYLE AND TIMBRE RATHER THAN DEFINING THE SPEAKER",
      // Its own controls at the values its UI ships (read off its index.html, 2026-09-21):
      // cfg, stg, dur_mult, gen_dur (0 = decide from the text), ref_dur, seed, denoise_ref,
      // max_chunk_duration, target_chunk_duration, crossfade_ms.
      params: function (text, ref) { return [text, ref || null, 2.5, 1.5, 1.1, 0.0, 10.0, SEED, true, 45, 37, 50]; }
    }
  };
  function pickHost(id) {
    var k = String(id == null ? "" : id).trim().toLowerCase();
    return HOSTS[k] || HOSTS.chatterbox;
  }
  var HOST = pickHost(typeof LIA_STORY_SPACE !== "undefined" ? LIA_STORY_SPACE : "chatterbox");
  var BASE = String((typeof LIA_STORY_BASE !== "undefined" && LIA_STORY_BASE) || HOST.base).replace(/\/+$/, "");
  var CALL = HOST.call;
  var UPLOAD = HOST.upload;
  var FOLDER = "lia_settings";
  var KEY = "story";

  function num(v, def, lo, hi) { v = Number(v); if (!isFinite(v)) v = def; return Math.max(lo, Math.min(hi, v)); }

  // How much text one render carries. Chatterbox cuts the text at its own 300-character ceiling and
  // 300 characters is about 22 seconds of speech: long enough that the first part is worth hearing,
  // short enough that it arrives quickly and that a part left un-played costs little.
  var CHUNK = Math.round(num(typeof LIA_STORY_CHUNK !== "undefined" ? LIA_STORY_CHUNK : HOST.maxChars, HOST.maxChars, 80, 2000));
  // Under this length a reply is NOT the lane's business when it is merely armed: a sentence or two is
  // what the live engine is for, and that is the cost cut working in both directions.
  var MIN_ARM = Math.round(num(typeof LIA_STORY_MIN !== "undefined" ? LIA_STORY_MIN : 400, 400, 0, 100000));
  var MAX_CHARS = Math.round(num(typeof LIA_STORY_MAX_CHARS !== "undefined" ? LIA_STORY_MAX_CHARS : 24000, 24000, 500, 400000));
  var MAX_PARTS = Math.round(num(typeof LIA_STORY_PARTS !== "undefined" ? LIA_STORY_PARTS : 80, 80, 1, 500));
  // How many rendered parts are kept in hand while speech is playing. One is enough to be gapless; two
  // covers a slow render without rendering the whole chapter into memory.
  var AHEAD = Math.round(num(typeof LIA_STORY_AHEAD !== "undefined" ? LIA_STORY_AHEAD : 2, 2, 1, 8));
  // The reference clip that leaves the device. The Space and the upload are public; a 40 MB sample is
  // already an album, and anything larger is refused with the number rather than silently sent.
  var SAMPLE_MAX = Math.round(num(typeof LIA_STORY_SAMPLE_MAX !== "undefined" ? LIA_STORY_SAMPLE_MAX : 40 * 1024 * 1024, 40 * 1024 * 1024, 1000, 400 * 1024 * 1024));
  var VOLUME_DEF = num(typeof LIA_STORY_VOLUME !== "undefined" ? LIA_STORY_VOLUME : 1, 1, 0, 1);

  // Chatterbox's controls at the values its own UI ships (read off its app.py, 2026-09-21):
  // exaggeration 0.5 (expressiveness - extreme values are unstable), temperature 0.8, cfg_weight 0.5
  // ("CFG/Pace" - how hard it follows the reference, lower is slower/more deliberate), vad_trim false
  // (trim silence off the reference first). The seed is DELIBERATELY fixed rather than 0: the Space
  // treats 0 as "pick a new one every call", which would give every part of one story a different
  // delivery. One fixed seed makes the parts sound like one performance. Set LIA_STORY_SEED = 0 in
  // config.js to go back to the Space's own behaviour.
  var EXAG = num(typeof LIA_STORY_EXAG !== "undefined" ? LIA_STORY_EXAG : 0.5, 0.5, 0.25, 2);
  var TEMP = num(typeof LIA_STORY_TEMP !== "undefined" ? LIA_STORY_TEMP : 0.8, 0.8, 0.05, 5);
  var CFGW = num(typeof LIA_STORY_CFGW !== "undefined" ? LIA_STORY_CFGW : 0.5, 0.5, 0.2, 1);
  var VAD = (typeof LIA_STORY_VAD !== "undefined") ? !!LIA_STORY_VAD : false;
  var SEED = Math.round(num(typeof LIA_STORY_SEED !== "undefined" ? LIA_STORY_SEED : 42, 42, 0, 4294967295));
  // How much of the reference the Space listens to, for the Dramabox road only.
  var REF_DUR = num(typeof LIA_STORY_REF_DUR !== "undefined" ? LIA_STORY_REF_DUR : 10, 10, 3, 30);

  var TICK = 300;             // how often the room is looked at (pause, resume, render ahead)
  var RESUME_QUIET_MS = 900;  // how long the room must be quiet after her live voice before a story resumes
  var CHARS_PER_SECOND = 13.5; // measured: 146 characters came back as 10.9 s of speech

  var ready = false, loadP = null;
  var armed = false;          // her longform replies come here (the standing switch)
  var once = 0;               // one-shot claims: /story tell renders the NEXT reply here whatever
  // ONE SAMPLE PER AGENT. The key is the role id (normalised; "" is LIA herself, off stage) and the
  // value is { id, name, bytes } - a record in the vault. FALLBACK_KEY is the sample that answers for
  // ANY role with none of its own, which is exactly what this lane's single sample used to be (see
  // load(), which moves an old one here so nothing he had set before changes meaning).
  var samples = {};
  var FALLBACK_KEY = "*";
  var transcripts = {};
  var lastSamp = null;
  function transcriptFor(samp) {
    var id = samp && samp.id ? String(samp.id) : "";
    return (id && transcripts[id]) || "";
  }
  function transcript(id) { id = String(id == null ? "" : id); return transcripts[id] || ""; }
  function setTranscript(id, text) {
    id = String(id == null ? "" : id).trim();
    if (!id) return "";
    text = String(text == null ? "" : text).trim().slice(0, 400);
    if (text) transcripts[id] = text; else delete transcripts[id];
    save();
    return transcripts[id] || "";
  }
  var job = null;             // the story being rendered/played
  var el = null;              // THE one <audio> this lane owns
  var current = null;         // the part loaded in it right now (playing, or paused where it stopped)
  var busy = false;           // a render is in flight
  var manual = false;         // HE paused it: nothing resumes it but him
  var resumeAt = 0;           // when a story paused BY THE ROOM may speak again
  var lastWhy = "";           // the reason last given for an automatic pause (so it is said once)
  var road = "";              // "keyed" or "anonymous" - the road the last call actually took
  var keyNote = "";           // what happened to the keyed attempt, if there was one
  var refPath = "";           // the reference's path INSIDE the space (this session only)
  var keyDown = false;        // the held Hugging Face key was refused once: do not offer it again this session
  var refFor = "";            // which sample that path was uploaded for
  var volume = VOLUME_DEF;
  var lastError = "";
  var keepAuto = false;
  var ticker = null;
  var seq = 0;                // job counter: a stale render can never be taken for the current one

  function elOf(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function keyring() { return window.keyring || null; }
  function say(msg) { if (typeof print === "function") print("SYSTEM", "STORY :: " + msg); }
  function hostLabel() { return HOST.label; }
  function hostWhat() { return HOST.what; }
  function hostIds() { return Object.keys(HOSTS); }
  function spaces() {
    return hostIds().map(function (i) { return { id: HOSTS[i].id, label: HOSTS[i].label, base: HOSTS[i].base, maxChars: HOSTS[i].maxChars }; });
  }
  function otherHosts() {
    return hostIds().filter(function (i) { return i !== HOST.id; }).map(function (i) { return HOSTS[i].label + " (" + i + ")"; }).join(" \u00b7 ");
  }
  function knobLine() {
    if (HOST.id === "sesame") return "NO KNOBS ON THIS ROAD - THE SAMPLE (AND ITS TRANSCRIPT) IS THE VOICE, AND THE LINE IS THE REST";
    if (HOST.id === "chatterbox") return "EXAGGERATION " + EXAG + " (EXPRESSIVENESS) · TEMPERATURE " + TEMP + " · CFG/PACE " + CFGW + " (HOW HARD IT FOLLOWS THE REFERENCE) · REF VAD TRIM " + (VAD ? "ON" : "OFF") + " · SEED " + SEED + (SEED ? " (FIXED, SO THE PARTS OF ONE STORY SOUND LIKE ONE PERFORMANCE)" : " (THE SPACE PICKS A NEW ONE EVERY PART)");
    return "SEED " + SEED + " · THE REST AT THE SPACE'S OWN SHIPPED VALUES";
  }

  // Switching spaces is a session-level move: the reference clip was uploaded to the OLD space's disk,
  // so its path means nothing to the new one - the sample record stays, the upload is simply redone
  // (once, on the first part rendered after the switch). Nothing already rendered is touched.
  function applyHost(id) {
    HOST = pickHost(id);
    BASE = String((typeof LIA_STORY_BASE !== "undefined" && LIA_STORY_BASE) || HOST.base).replace(/\/+$/, "");
    CALL = HOST.call;
    UPLOAD = HOST.upload;
    queueShape = null;        // each space has its own event index
    preferTransport = "";     // and its own working door - nothing is assumed about a space we have not tried
    refPath = ""; refFor = "";
  }

  function setKnobs(o) {
    o = o || {};
    if (o.exaggeration != null) EXAG = num(o.exaggeration, EXAG, 0.25, 2);
    if (o.temperature != null) TEMP = num(o.temperature, TEMP, 0.05, 5);
    if (o.cfgWeight != null) CFGW = num(o.cfgWeight, CFGW, 0.2, 1);
    if (o.vadTrim != null) VAD = !!o.vadTrim;
    if (o.seed != null) SEED = Math.round(num(o.seed, SEED, 0, 4294967295));
    return { exaggeration: EXAG, temperature: TEMP, cfgWeight: CFGW, vadTrim: VAD, seed: SEED, refDur: REF_DUR };
  }
  function setHost(id) {
    if (!HOSTS[String(id == null ? "" : id).trim().toLowerCase()]) {
      say("NO SUCH SPACE HERE :: " + hostIds().join(" \u00b7 ") + ". /story space <" + hostIds().join("|") + "> SWITCHES.");
      return null;
    }
    applyHost(id);
    save();
    say("THE STORY LANE RENDERS ON " + hostLabel() + " NOW :: " + BASE + "\n  " + hostWhat() + "."
      + "\n  A PART IS UP TO " + HOST.maxChars + " CHARACTERS ON THIS ROAD, AND THE SAMPLE IS RE-SENT TO IT THE FIRST TIME A PART IS RENDERED. THE NEXT PART TAKES THIS ROAD - WHAT IS ALREADY RENDERED STAYS AS IT IS.");
    paint();
    return HOST.id;
  }

  // A render is a real job on someone's GPU, and a Space that is asleep, cold or queued can hold the
  // connection open indefinitely. Nothing here waits forever: the call is aborted and says so, rather
  // than leaving the strip reading "RENDERING" until the tab is closed.
  var RENDER_TIMEOUT_MS = 300000;
  function timeoutGuard(ms) {
    var ctl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return { signal: ctl ? ctl.signal : undefined, stop: function () { clearTimeout(t); } };
  }
  function guardError(e) {
    var m = String((e && e.message) || e);
    if (e && (e.name === "AbortError" || /aborted|abort/i.test(m))) {
      return new Error("THE SPACE DID NOT ANSWER WITHIN " + Math.round(RENDER_TIMEOUT_MS / 60000) + " MINUTES - IT MAY BE ASLEEP OR QUEUED. TRY AGAIN, OR /story stop AND START THE PART AGAIN.");
    }
    return new Error(m);
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function readSample(v) {
    return (v && v.id) ? { id: String(v.id), name: String(v.name || ""), bytes: Number(v.bytes) || 0 } : null;
  }
  function readSamples(raw) {
    var out = {};
    Object.keys(raw || {}).forEach(function (k) {
      var rec = readSample(raw[k]);
      if (rec) out[String(k)] = rec;
    });
    return out;
  }
  function writeSamples() {
    var out = {};
    Object.keys(samples).forEach(function (k) {
      var r = samples[k];
      if (r && r.id) out[k] = { id: r.id, name: r.name, bytes: r.bytes };
    });
    return out;
  }

  // ---- loading, saving ------------------------------------------------------

  async function load() {
    if (loadP) return loadP;
    loadP = (async function () {
      var k = kv();
      if (k) {
        try {
          var saved = await k.get(KEY);
          if (saved && typeof saved === "object") {
            if (typeof saved.armed === "boolean") armed = saved.armed;
            if (typeof saved.keep === "boolean") keepAuto = saved.keep;
            if (saved.samples && typeof saved.samples === "object") samples = readSamples(saved.samples);
            if (saved.transcripts && typeof saved.transcripts === "object") {
              Object.keys(saved.transcripts).forEach(function (k) {
                var v = String(saved.transcripts[k] || "").slice(0, 400);
                if (v) transcripts[String(k)] = v;
              });
            }
            // ONE SAMPLE, BEFORE THERE WAS ONE PER AGENT (kept, so nothing changes meaning): what the
            // lane used to hold for "her voice" is now the FALLBACK - the sample that answers for any
            // agent with none of its own. It stays in force until he sets an agent's own.
            if (readSample(saved.sample) && !samples[FALLBACK_KEY]) samples[FALLBACK_KEY] = readSample(saved.sample);
            if (saved.volume != null) volume = num(saved.volume, VOLUME_DEF, 0, 1);
            // The space he last chose, if config.js has not been given an explicit base URL (an
            // explicit LIA_STORY_BASE is a deliberate hand-aim at one host and outranks a memory).
            if (saved.space && HOSTS[String(saved.space)] && !(typeof LIA_STORY_BASE !== "undefined" && LIA_STORY_BASE)) applyHost(saved.space);
          }
        } catch (e) { console.warn("story settings unreadable", e); }
      }
      ensureEl();
      ready = true;
      return state();
    })();
    return loadP;
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try {
      await k.set(KEY, { armed: armed, keep: keepAuto, space: HOST.id, samples: writeSamples(), transcripts: transcripts, volume: volume });
      return true;
    } catch (e) { console.warn("story settings not saved", e); return false; }
  }

  // ---- the audio element ----------------------------------------------------

  function ensureEl() {
    if (el) return el;
    var host = elOf("storyAudioHost") || document.body;
    el = document.createElement("audio");
    el.id = "storyAudio";
    el.setAttribute("playsinline", "");
    el.preload = "auto";
    el.volume = volume;
    el.onended = onEnded;
    el.onerror = function () {
      if (!current) return;
      var p = current;
      p.state = "failed";
      p.error = "THE BROWSER COULD NOT PLAY THE AUDIO IT WAS GIVEN";
      say("PART " + (p.i + 1) + " COULD NOT BE PLAYED :: " + p.error);
      current = null;
      advance();
    };
    el.addEventListener("timeupdate", function () { rememberAt(); paint(); });
    el.addEventListener("loadedmetadata", function () { if (current) current.seconds = el.duration || 0; paint(); });
    host.appendChild(el);
    return el;
  }

  // ---- the space ------------------------------------------------------------

  function partData(text, ref) {
    // The parameter list is the HOST's business: each Space declares its own, in its own order, and
    // the whole point of the table at the top of this file is that this call never has to know which
    // one answered. (Chatterbox: text, reference, exaggeration, temperature, seed, cfg_weight,
    // vad_trim. Dramabox: prompt, reference, cfg, stg, dur_mult, gen_dur, ref_dur, seed, denoise_ref,
    // max/target chunk, crossfade.) Both orders were read off the spaces' own sources and the calls
    // that carry the reference were measured against them.
    return HOST.params(String(text).slice(0, HOST.maxChars), ref);
  }

  function fileData(path, name, bytes, mime) {
    // The shape the Space's schema requires for a file input (all keys present; nulls where unknown).
    return { path: path, url: null, size: bytes || null, orig_name: name || null, mime_type: mime || null, is_stream: false, meta: { _type: "gradio.FileData" } };
  }

  function parseSse(text) {
    // The stream is a handful of `event: x` / `data: {...}` pairs. Both shapes were measured: complete
    // carries the file list, error carries the Space's own sentence.
    var out = { event: "", data: null, error: "" };
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^event:\s*(.+)$/);
      if (m) { out.event = m[1].trim(); return; }
      var d = line.match(/^data:\s*(.+)$/);
      if (!d) return;
      var raw = d[1].trim();
      if (raw === "[DONE]") return;
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (out.event === "error") {
        // A refusal does not always carry a sentence: measured 2026-09-21, a Space that could not read
        // its input answers `event: error` with `data: null`. "null" is not a diagnosis - it is left
        // empty here so the caller can say what it actually means and what to do about it.
        var why = (parsed && (parsed.error || parsed.message)) ? String(parsed.error || parsed.message) : (parsed === null ? "" : raw.slice(0, 300));
        if (why && why !== "null" && why !== "undefined") out.error = why;
      } else if (out.event === "complete" || parsed) {
        out.data = parsed;
      }
    });
    if (!out.event && !out.error && out.data) out.event = "complete";
    return out;
  }

  async function uploadRef(blob, name) {
    var fd = new FormData();
    fd.append("files", blob, name || "reference.wav");
    var res = await fetch(BASE + UPLOAD, { method: "POST", body: fd });
    if (!res.ok) throw new Error("THE REFERENCE COULD NOT BE UPLOADED (HTTP " + res.status + ")");
    var paths = await res.json();
    var path = paths && paths.length ? String(paths[0]) : "";
    if (!path) throw new Error("THE REFERENCE UPLOAD ANSWERED WITH NOTHING");
    return path;
  }

  async function refBlobOf(samp) {
    // The sample lives in the vault as a record; its bytes come back through the object URL the vault
    // already serves. Nothing is cached to disk: the clip is uploaded, used, and forgotten.
    if (!samp || !samp.id || !window.media) return null;
    var rec = null;
    try { rec = window.media.get(samp.id); } catch (e) { rec = null; }
    // `media.url()` takes the ID (it is a lookup in the vault's own object-URL table) - handing it the
    // record itself matched nothing and made every sample look like it had vanished.
    var url = (rec && window.media.url) ? window.media.url(samp.id) : "";
    if (!url) return null;
    var res = await fetch(url);
    if (!res.ok) throw new Error("THE SAMPLE COULD NOT BE READ BACK OUT OF THE VAULT (HTTP " + res.status + ")");
    var blob = await res.blob();
    if (blob.size > SAMPLE_MAX) throw new Error("THE SAMPLE \"" + String(samp.name).toUpperCase() + "\" IS " + Math.round(blob.size / 1048576) + " MB - TOO BIG TO SEND, SO IT WAS NOT UPLOADED (LIMIT " + Math.round(SAMPLE_MAX / 1048576) + " MB). /story sample <A SMALLER ONE> FOR THAT AGENT, OR /story sample off.");
    return blob;
  }

  async function ensureRef(samp) {
    if (!samp || !samp.id) { refPath = ""; refFor = ""; lastSamp = null; return null; }
    lastSamp = samp;
    if (refPath && refFor === samp.id) return fileData(refPath, samp.name, samp.bytes, "");
    var blob = await refBlobOf(samp);
    if (!blob) throw new Error("THE SAMPLE \"" + String(samp.name).toUpperCase() + "\" IS NOT IN THE VAULT ANY MORE - /story sample <ID|NAME> PICKS ANOTHER, OR /story sample OFF.");
    refPath = await uploadRef(blob, samp.name || "sample.wav");
    refFor = samp.id;
    say("HER VOICE SAMPLE \"" + String(samp.name).toUpperCase() + "\" (" + Math.round(blob.size / 1024) + " KB) WAS SENT TO THE SPACE FOR THIS SESSION - THAT IS THE ONLY THING THAT LEAVES THIS DEVICE, AND ONLY WHEN A STORY IS RENDERED.");
    return fileData(refPath, samp.name, blob.size, blob.type || "");
  }

  // THE SHORTCUT CALL (Gradio's `/call/<name>` + event stream). Dramabox answered this, the live
  // Chatterbox fork answered this - and the official Chatterbox and the Gradio-5 style spaces answer it
  // with "Session not found", so it is tried first and the queue below is the fallback.
  async function apiCall(data, ref, keyed) {
    var headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (keyed) {
      var kr = keyring();
      if (!kr || !kr.has("huggingface")) throw new Error("NO HUGGING FACE KEY IS HELD");
      headers = Object.assign(headers, kr.attach("huggingface", BASE + CALL).headers);
    }
    // A render is a real job on someone's GPU, and a Space that is asleep or queued can hold the
    // connection open indefinitely. Nothing here waits forever: the call is aborted with a sentence
    // he can act on rather than leaving the lane reading "RENDERING" until the tab is closed.
    var watch = timeoutGuard(RENDER_TIMEOUT_MS);
    // The room is told before anything is spent: a render is a real job on someone's GPU.
    var res;
    try {
      res = await fetch(BASE + CALL, { method: "POST", headers: headers, body: JSON.stringify({ data: data }), signal: watch.signal });
    } catch (e) { watch.stop(); throw guardError(e); }
    if (res.status === 401 || res.status === 403) { var e = new Error("HTTP " + res.status); e.auth = true; throw e; }
    var head = "";
    try { head = await res.text(); } catch (e) { }
    var id = "";
    try { id = String((JSON.parse(head) || {}).event_id || ""); } catch (e) { }
    if (!id) {
      watch.stop();
      if (res.status >= 500) { var e2 = new Error("HTTP " + res.status + (head ? " :: " + head.replace(/\s+/g, " ").slice(0, 200) : "")); e2.busy = true; throw e2; }
      throw new Error("THE SPACE DID NOT START A JOB (HTTP " + res.status + (head ? " :: " + head.replace(/\s+/g, " ").slice(0, 200) : "") + ")");
    }
    var body = "";
    try {
      var stream = await fetch(BASE + CALL + "/" + id, { headers: { "Accept": "text/event-stream" }, signal: watch.signal });
      body = await stream.text();
    } catch (e) { watch.stop(); throw guardError(e); }
    var got = parseSse(body);
    watch.stop();
    if (got.event === "error") {
      // The likeliest cause by far, and the only one he can act on from here, is the reference clip: a
      // file the Space cannot decode as audio fails the whole job. Say that instead of "null".
      var err = new Error(got.error || ("THE SPACE REFUSED THE JOB WITHOUT SAYING WHY" + (ref
        ? " - WITH A SAMPLE SET, THAT IS USUALLY THE SAMPLE ITSELF (IT MAY NOT BE READABLE AS AUDIO OR MAY BE TOO SHORT): /story sample <ANOTHER>, OR /story sample OFF TO USE THE SPACE'S OWN VOICE."
        : ".")));
      // A refusal with no sentence at all is marked, because it is the shape a broken shortcut call
      // takes: the space cannot say what went wrong because nothing in its own function ran. The road
      // that can still work is its own queue (measured), so it is worth trying before giving up.
      if (!got.error) err.silent = true;
      throw err;
    }
    if (!got.data) throw new Error(got.error || "THE SPACE FINISHED WITHOUT HANDING BACK AUDIO");
    var file = got.data && got.data[0];
    var url = file && (file.url || (file.path ? BASE + "/gradio_api/file=" + file.path : ""));
    if (!url) throw new Error("THE SPACE FINISHED BUT HANDED BACK NO AUDIO");
    var audio = await fetch(url);
    if (!audio.ok) throw new Error("THE AUDIO COULD NOT BE COLLECTED (HTTP " + audio.status + ")");
    var blob = await audio.blob();
    if (!blob.size) throw new Error("THE AUDIO CAME BACK EMPTY");
    return blob;
  }

  // THE QUEUE (the flow the Space's OWN PAGE uses: join the queue, then listen on the session's stream).
  // Measured 2026-09-21, and this is what made a real Chatterbox render possible: the official Space and
  // the Gradio-5 style spaces refuse the `/call` shortcut with "Session not found" while this flow goes
  // straight through. The one trap is ORDER - the session is registered by the JOIN, so a stream opened
  // before the join is told the session does not exist. Join first, then listen.
  var queueShape = null;    // { idx } - which dependency in the space's /config is the renderer
  function sessionHash() {
    var out = "";
    try {
      var a = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(a);
      for (var i = 0; i < a.length; i++) out += (a[i] % 36).toString(36);
    } catch (e) {
      while (out.length < 10) out += Math.floor(Math.random() * 36).toString(36);
    }
    return out || "lia" + Date.now().toString(36);
  }
  async function queueIndexOf() {
    if (queueShape) return queueShape;
    var res = await fetch(BASE + "/config");
    if (!res.ok) throw new Error("THE SPACE'S OWN CONFIG COULD NOT BE READ (HTTP " + res.status + ")");
    var cfg = await res.json();
    var deps = cfg.dependencies || [];
    var idx = -1;
    for (var i = 0; i < deps.length; i++) { if (deps[i].api_name === HOST.name) { idx = i; break; } }
    if (idx < 0) idx = deps.length ? 0 : 0;   // one-event spaces (the usual case): the event is the first
    queueShape = { idx: idx, count: deps.length };
    return queueShape;
  }
  async function queueCall(data, keyed, watch) {
    var qi = await queueIndexOf();
    var session = sessionHash();
    var headers = { "Content-Type": "application/json" };
    if (keyed) {
      var kr = keyring();
      if (kr && kr.has("huggingface")) headers = Object.assign(headers, kr.attach("huggingface", BASE + "/gradio_api/queue/join").headers);
    }
    var join = await fetch(BASE + "/gradio_api/queue/join", {
      method: "POST", headers: headers, signal: watch.signal,
      body: JSON.stringify({ data: data, event_data: null, fn_index: qi.idx, trigger_id: 0, session_hash: session })
    });
    var jbody = "";
    try { jbody = await join.text(); } catch (e) { }
    if (!join.ok) throw new Error("THE SPACE WOULD NOT TAKE THE JOB (HTTP " + join.status + (jbody ? " :: " + jbody.replace(/\s+/g, " ").slice(0, 180) : "") + ")");
    await new Promise(function (r) { setTimeout(r, 600); });   // let the join land before the stream opens
    var res = await fetch(BASE + "/gradio_api/queue/data?session_hash=" + session, { headers: { "Accept": "text/event-stream" }, signal: watch.signal });
    if (!res.body) throw new Error("THE SPACE'S STREAM COULD NOT BE OPENED (HTTP " + res.status + ")");
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", file = "";
    while (!file) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var parts = buf.split("\n\n");
      buf = parts.pop();
      for (var i = 0; i < parts.length && !file; i++) {
        var m = parts[i].match(/^data:\s*(.+)$/m);
        if (!m) continue;
        var j = null;
        try { j = JSON.parse(m[1]); } catch (e) { continue; }
        if (!j || !j.msg) continue;
        if (j.msg === "unexpected_error" || j.session_not_found) {
          throw new Error(String(j.message || "THE JOB FAILED WITHOUT SAYING WHY"));
        }
        if (j.msg === "process_completed") {
          // A FINISHED JOB IS NOT NECESSARILY A SUCCESSFUL ONE. Gradio reports a failure as
          // process_completed with success:false and the Space's own sentence in output.error - and that
          // sentence IS the diagnosis (measured 2026-09-21 on the official Chatterbox: "ZeroGPU quota
          // exceeded. Authenticate with a Hugging Face token for more quota"). Swallowing it turned a
          // one-line fix into "the Space handed back no audio".
          var why = (j.success === false || (j.output && j.output.error))
            ? String((j.output && (j.output.error || j.output.title)) || "THE SPACE REPORTED A FAILED JOB WITHOUT SAYING WHY") : "";
          if (why) throw new Error(why);
          var out = (j.output && j.output.data) || [];
          // The file is the output element that HAS a file in it - not blindly the first one, so a Space
          // that gains a second output cannot make the audio invisible. If none has one, the SHAPE of
          // what came back is reported, because "no audio" alone is not a diagnosis.
          var f = null;
          for (var q = 0; q < out.length && !f; q++) {
            var cand = out[q];
            if (cand && (cand.url || cand.path)) f = cand;
          }
          file = (f && (f.url || (f.path ? BASE + "/gradio_api/file=" + f.path : ""))) || "";
          if (!file) {
            var shape = out.map(function (v) {
              if (v == null) return "null";
              if (Array.isArray(v)) return "array[" + v.length + "]";
              if (typeof v === "object") return "{" + Object.keys(v).join(",") + "}";
              return typeof v;
            }).join(" ");
            throw new Error("THE SPACE FINISHED BUT HANDED BACK NO AUDIO (IT ANSWERED WITH: " + (shape || "nothing") + ")");
          }
        }
      }
    }
    try { reader.cancel(); } catch (e) { }
    if (!file) throw new Error("THE SPACE'S STREAM ENDED BEFORE THE AUDIO WAS READY");
    var audio = await fetch(file, { signal: watch.signal });
    if (!audio.ok) throw new Error("THE AUDIO COULD NOT BE COLLECTED (HTTP " + audio.status + ")");
    var blob = await audio.blob();
    if (!blob.size) throw new Error("THE AUDIO CAME BACK EMPTY");
    return blob;
  }

  // Which way a render travelled, for /story road and the finish line (the shortcut, or the space's own
  // queue). It is said out loud because the two behave differently under load.
  var transport = "";
  function looksLikeSession(e) { return /session|404|not found|not_found/i.test(String((e && e.message) || e)); }
  // Which door a space opened last time. A space that refused the shortcut once will refuse it again
  // (that is a property of the space, not of the moment), so the road that worked is used FIRST from
  // then on - and if it ever stops working, the other one is tried before anything is called failed.
  var preferTransport = "";
  async function startCall(prompt, ref, keyed) {
    var data = partData(prompt, ref);
    var watch = timeoutGuard(RENDER_TIMEOUT_MS);
    var queueFirst = (preferTransport === "queue");
    try {
      var blob = queueFirst ? await queueCall(data, keyed, watch) : await apiCall(data, ref, keyed);
      transport = queueFirst ? "queue" : "call";
      preferTransport = transport;
      watch.stop();
      return blob;
    } catch (e) {
      // A refusal that named a real problem with the input (a bad sample, a bad model, a spent quota)
      // is the truth and is passed straight up. Only a broken DOOR is worth a second try: the shortcut's
      // "session not found", a refusal with no reason at all, or the preferred road failing this time.
      if (!looksLikeSession(e) && !e.silent && !queueFirst) { watch.stop(); throw e; }
      try {
        var blob2 = queueFirst ? await apiCall(data, ref, keyed) : await queueCall(data, keyed, watch);
        transport = queueFirst ? "call" : "queue";
        preferTransport = transport;
        watch.stop();
        return blob2;
      } catch (e2) {
        watch.stop();
        throw new Error(String((e && e.message) || e) + " || " + String((e2 && e2.message) || e2));
      }
    }
  }

  // One part: her text in, a Blob out. The keyed road is tried first when a key is held, and a refusal
  // from it is not the end of the call - it is retried anonymously, because an invalid token must not
  // cost him the feature. `samp` is the sample to clone from; omitted, it is the one belonging to the
  // agent ON STAGE right now (a running story passes its own, captured when the story was made).
  async function render(text, samp) {
    if (samp === undefined) samp = resolveSample().rec;
    var started = Date.now();
    var ref = null;
    var refErr = "";
    try { ref = await ensureRef(samp); }
    catch (e) { refErr = String((e && e.message) || e); }
    if (refErr) { say(refErr + "\n  THE STORY GOES AHEAD WITHOUT IT, IN THE SPACE'S OWN VOICE."); }
    var attempts = [];
    var kr = keyring();
    var keyed = !keyDown && !!(kr && typeof kr.has === "function" && kr.has("huggingface"));
    try {
      var blob = await startCall(text, ref, keyed);
      if (keyed) { road = "keyed"; keyNote = ""; }
      else { road = "anonymous"; }
      return { blob: blob, ms: Date.now() - started, road: road, transport: transport };
    } catch (e) {
      attempts.push(String((e && e.message) || e));
      // THE REFUSAL THAT SAYS "ANONYMOUS QUOTA" WHILE A KEY IS HELD IS USUALLY THE KEY ITSELF: checked
      // once, so the log carries a one-line fix instead of a mystery.
      if (/quota|runs limit|authenticate|401|403|unauthor|invalid/i.test(attempts.join(" "))) {
        var verdict = await checkKey();
        if (verdict === "invalid") attempts.push("AND THE HUGGING FACE TOKEN IN KEYS \u25be WAS REFUSED BY HUGGING FACE ITSELF (HTTP 401) - A FRESH ONE PUTS THE RUNS BACK ON YOUR OWN ACCOUNT");
      }
      if (!keyed) throw new Error(friendly(attempts));
      // THE KEY IS DOWN, THE ROAD IS NOT. Retry without it before giving up - measured 2026-09-21: the
      // Space answers anonymous calls happily, so a dead token should cost him nothing but the retry.
      try {
        var blob2 = await startCall(text, ref, false);
        // The anonymous road worked and the keyed one did not: the key was the problem, so it is put
        // down for the rest of the session instead of costing a failed call on every part.
        keyDown = true;
        keyNote = "THE HUGGING FACE KEY WAS TRIED AND THE CALL FELL OVER (" + attempts[0] + "), SO THE CALL WAS RETRIED WITHOUT IT AND WORKED. THE KEY IS NOT BEING OFFERED AGAIN THIS SESSION - RE-COPY IT FROM huggingface.co/settings/tokens TO PUT THE GPU MINUTES ON YOUR OWN ACCOUNT.";
        say(keyNote);
        road = "anonymous";
        return { blob: blob2, ms: Date.now() - started, road: road, transport: transport, keyed: false };
      } catch (e2) {
        attempts.push(String((e2 && e2.message) || e2));
        // Both roads failed. If the keyed failure looked like a refusal of the KEY, remember that and
        // stop offering it; if not, the Space itself is down and the key deserves another try next time.
        if (/401|403|unauthor|forbidden|invalid|token|credential/i.test(attempts[0])) keyDown = true;
        throw new Error(friendly(attempts));
      }
    }
  }

  function friendly(list) {
    // The same failure arrives once from the keyed road and once from the anonymous one; a page of the
    // same sentence twice is not a diagnosis, so the repeats are dropped before anything is reported.
    var uniq = [];
    (list || []).forEach(function (m) {
      m = String(m == null ? "" : m).trim();
      if (!m || uniq.indexOf(m) >= 0) return;
      uniq.push(m);
    });
    var all = uniq.join("\n  ") || "THE CALL FAILED WITHOUT SAYING WHY";
    var gpuNote = (/gpu duration|maximum allowed/i.test(all) && HOST.id === "sesame") ? "\n  SESAME'S SPACE HOLDS ITS GPU DOOR TIGHTER THAN THE OTHERS - ANONYMOUS RENDERS ARE REFUSED MORE OFTEN HERE, AND A KEY OR A SELF-HOSTED BASE IS THE STEADY ROAD." : "";
    if (/zerogpu|gpu quota|gpu duration|maximum allowed|runs limit|quota|exceeded|too many|rate limit/i.test(all)) {
      return all + gpuNote + "\n  THAT IS THE ANONYMOUS GPU QUOTA: ZeroGPU RUNS ARE COUNTED PER ACCOUNT, OR PER ADDRESS WHEN NO KEY IS USED - AND THE ANONYMOUS SHARE IS SMALL AND SHARED. A HUGGING FACE KEY IN KEYS \u25be PUTS THE RUNS ON YOUR OWN ACCOUNT (an EXPIRED key looks exactly like no key here) :: /story key CHECKS THE HELD TOKEN AGAINST HUGGING FACE ITSELF AND SAYS WHETHER IT IS STILL GOOD. /story space chatterbox-cpu RENDERS ON A PLAIN CPU INSTEAD - NO QUOTA AT ALL, ONLY SLOW.";
    }
    if (/session|not_found|not found|refused the job|handed back no audio|finished but/i.test(all)) {
      return all + "\n  THAT IS THE SPACE REFUSING THIS PAGE - BOTH OF ITS DOORS WERE TRIED (THE SHORTCUT CALL AND THE SPACE'S OWN QUEUE), AND THE SAME THING HAPPENS TO ANY CLIENT WHILE IT IS IN THAT STATE. IT IS NOT A REFUSAL OF YOUR TEXT"
        + (Object.keys(samples).length ? ", THOUGH WITH A SAMPLE SET IT IS WORTH /story sample off TO RULE THE SAMPLE OUT FOR THIS AGENT" : "") + "."
        + "\n  THE ROADS THAT ARE OPEN: /story space chatterbox-cpu - THE SAME MODEL ON A PLAIN CPU, MEASURED WORKING AND WITH NO QUOTA TO SPEND - AND /story space dramabox. /story test SHOWS WHICH ONE ANSWERS.";
    }
    if (/fetch|network|cors|load failed|failed to fetch/i.test(all)) {
      return all + "\n  THAT IS A NETWORK FAILURE RATHER THAN A REFUSAL - THE SPACE'S HOST IS NOT ANSWERING, SO IT IS ASLEEP OR DOWN. TRY AGAIN IN A MINUTE, OR /story space <ANOTHER>.";
    }
    return all;
  }

  // ---- the held key, checked against Hugging Face itself --------------------

  // A KEY THAT IS HELD IS NOT ALWAYS A KEY THAT WORKS. Measured 2026-09-21: the token in the keyring
  // answered `GET /api/whoami-v2` with **HTTP 401 "Invalid username or password"**, so every call to a
  // Space went out ANONYMOUS - and the anonymous ZeroGPU share was spent, which is exactly why the
  // official Chatterbox looked broken from here while it works perfectly in a logged-in browser. So when
  // a call comes back with the anonymous-quota sentence while a key is held, the key is checked ONCE, and
  // what Hugging Face says about it is said out loud - a one-line fix rather than a mystery. `/story key`
  // runs the check on demand.
  var keyVerdict = "";   // "" never checked, "ok", "invalid", "none" (no key held)
  async function checkKey() {
    if (keyVerdict) return keyVerdict;
    var kr = keyring();
    if (!kr || typeof kr.has !== "function" || !kr.has("huggingface")) { keyVerdict = "none"; return keyVerdict; }
    var res = null;
    try {
      var a = kr.attach("huggingface", "https://huggingface.co/api/whoami-v2");
      res = await fetch("https://huggingface.co/api/whoami-v2", { headers: (a && a.headers) || {}, cache: "no-store" });
    } catch (e) {
      return "";   // Hugging Face itself was unreachable: that is not a verdict about the key, so it is not remembered
    }
    if (res.ok) { keyVerdict = "ok"; return keyVerdict; }
    var body = "";
    try { body = String(await res.text()).replace(/\s+/g, " ").slice(0, 160); } catch (e) { }
    if (res.status === 401 || res.status === 403) {
      keyVerdict = "invalid";
      keyDown = true;   // a refused key is not offered again this session
      keyNote = "THE HUGGING FACE TOKEN HELD IN KEYS \u25be WAS CHECKED AGAINST HUGGING FACE AND REFUSED (HTTP " + res.status + (body ? " :: " + body : "") + "). EVERY CALL TO A SPACE IS THEREFORE ANONYMOUS, AND THE ANONYMOUS ZeroGPU SHARE IS SMALL AND SHARED - WHICH IS WHY THE ROAD LOOKS CLOSED. COPY A FRESH TOKEN FROM huggingface.co/settings/tokens (A 'READ' TOKEN IS ENOUGH), PASTE IT INTO KEYS \u25be, THEN /story test.";
      say(keyNote);
      return keyVerdict;
    }
    keyVerdict = "unreachable";
    return keyVerdict;
  }
  function keyLine() {
    // A KEY BEING HELD AND A KEY BEING GOOD ARE TWO DIFFERENT FACTS, and this line must never
    // confuse them: a held-but-unchecked token is not "no token", or he would be told to paste one
    // he has already pasted. Only the ring itself says what is HELD; keyVerdict says what was
    // MEASURED about it (and is "" until whoami has been asked).
    var held = false;
    try { held = !!(window.keyring && window.keyring.has("huggingface")); } catch (e) {}
    if (keyVerdict === "invalid") return keyNote || "THE HELD TOKEN WAS REFUSED BY HUGGING FACE.";
    if (keyVerdict === "ok") return "THE TOKEN IN KEYS \u25be IS VALID (HUGGING FACE'S OWN whoami ANSWERED) - SO ANY QUOTA MESSAGE IS THE ACCOUNT'S ALLOWANCE, NOT A DEAD KEY.";
    if (keyVerdict === "unreachable") return "HUGGING FACE'S OWN whoami COULD NOT BE REACHED, SO THE HELD TOKEN COULD NOT BE CHECKED. CALLS STILL CARRY IT, AND A 401 FROM A SPACE IS THE TRUTH WHEN IT COMES."
      + (held ? "" : " NO TOKEN IS HELD - GET ONE AT huggingface.co/settings/tokens (A 'READ' TOKEN IS ENOUGH).");
    if (keyVerdict === "none" || !held) return "NO HUGGING FACE TOKEN IS HELD, SO EVERY CALL GOES OUT ANONYMOUS AND THE ZeroGPU QUOTA IS THE SHARED ONE. A KEY IN KEYS \u25be PUTS THE RUNS ON YOUR OWN ACCOUNT.";
    return "A HUGGING FACE TOKEN IS HELD BUT HAS NOT BEEN CHECKED YET :: /story key ASKS HUGGING FACE WHOAMI WHETHER IT IS STILL GOOD.";
  }

  // ---- the parts, the queue, the playhead -----------------------------------

  function estimateSeconds(chars) { return Math.max(4, chars / CHARS_PER_SECOND); }
  function totalSeconds() {
    if (!job) return 0;
    var known = 0, chars = 0;
    job.parts.forEach(function (p) { if (p.seconds) known += p.seconds; else chars += p.text.length; });
    return known + estimateSeconds(chars);
  }
  function waitingPart() { return job ? job.parts.filter(function (p) { return p.state === "waiting"; })[0] : null; }
  function readyParts() { return job ? job.parts.filter(function (p) { return p.state === "ready"; }) : []; }
  function playingNow() { return (el && current && !el.paused) ? current : null; }

  function makeJob(text, why) {
    var clean = (window.voice && window.voice.clean) ? window.voice.clean(text) : String(text == null ? "" : text);
    clean = String(clean).replace(/\s+/g, " ").trim();
    if (!clean) return null;
    var cut = false;
    if (clean.length > MAX_CHARS) { clean = clean.slice(0, MAX_CHARS); cut = true; }
    var pieces = (window.voice && window.voice.chunk) ? window.voice.chunk(clean, CHUNK) : [clean];
    if (!pieces.length) return null;
    // NOTHING IS EVER SILENTLY SHORTENED. Both spaces cut the text on their own - Chatterbox at 300
    // characters - and a cut that arrives unannounced is a story with words missing. `chunk` already
    // breaks at sentence ends and at word boundaries, so a piece can only exceed the ceiling if a
    // single word does; that is caught here and said out loud rather than swallowed.
    var over = pieces.filter(function (t) { return t.length > HOST.maxChars; }).length;
    if (pieces.length > MAX_PARTS) { pieces = pieces.slice(0, MAX_PARTS); cut = true; }
    if (job) freeJob();
    // THE VOICE IS LOCKED IN HERE. The agent on stage at this moment supplies it - its own sample, or
    // the fallback - and that is what every part of THIS story is cloned from, even if she is shifted
    // onto another layer before the last part is rendered. One story, one performance (the same
    // reason the seed is fixed). The next story picks up whatever is on stage then.
    var v = resolveSample();
    var who = roleNameOf(v.role);
    job = {
      n: ++seq, why: why || "", text: clean, cut: cut, at: Date.now(), doneAt: 0,
      role: v.role, roleLabel: who, sample: v.rec, sampleOwn: v.own, roleNote: false, parts:
        pieces.map(function (t, i) { return { i: i, text: t, state: "waiting", blob: null, url: "", seconds: 0, ms: 0, error: "", note: "" }; })
    };
    current = null; manual = false; resumeAt = 0; lastWhy = ""; lastError = "";
    try { if (el) { el.pause(); el.removeAttribute("src"); el.load(); } } catch (e) { }
    openStrip();
    say((why === "reply" ? "TAKING HER REPLY IN HER OWN VOICE" : "READING THIS IN HER OWN VOICE")
      + " :: " + job.parts.length + " PART" + (job.parts.length === 1 ? "" : "S") + ", ABOUT " + mmss(totalSeconds()) + " ALL TOLD, RENDERED BY " + hostLabel() + " AND PLAYED HERE AS IT ARRIVES."
      + (cut ? "\n  (TRIMMED TO " + MAX_CHARS + " CHARACTERS / " + MAX_PARTS + " PARTS.)" : "")
      + (over ? "\n  " + over + " PART" + (over === 1 ? " IS" : "S ARE") + " LONGER THAN " + hostLabel() + " WILL READ IN ONE CALL (" + HOST.maxChars + " CHARACTERS) - THE TAIL OF " + (over === 1 ? "IT" : "THEM") + " WILL BE CUT BY THE SPACE." : "")
      + "\n  " + voiceLine());
    pump();
    return job;
  }

  function freeJob() {
    if (!job) return;
    current = null;
    try { if (el) { el.pause(); el.removeAttribute("src"); el.load(); } } catch (e) { }
    job.parts.forEach(function (p) { if (p.url) { try { URL.revokeObjectURL(p.url); } catch (e) { } p.url = ""; } });
    job = null;
  }

  async function pump() {
    if (!job || busy) return;
    if (readyParts().length >= AHEAD) return;
    var p = waitingPart();
    if (!p) return;
    var token = job.n;
    var voice = job.sample;                        // the voice THIS story was locked to when it was made
    busy = true; p.state = "rendering"; paint();
    var out = null, err = "";
    try { out = await render(p.text, voice); }
    catch (e) { err = String((e && e.message) || e); }
    busy = false;
    if (!job || job.n !== token) return;          // stopped, or replaced by a newer story: what came back is worthless
    if (err) {
      p.state = "failed"; p.error = err; lastError = err;
      say("PART " + (p.i + 1) + " OF " + job.parts.length + " FAILED :: " + err
        + "\n  THE REST OF THE STORY IS UNAFFECTED - THE LANE CARRIES ON WITH THE NEXT PART.");
    } else {
      p.blob = out.blob; p.url = URL.createObjectURL(out.blob); p.ms = out.ms; p.note = out.road + (out.transport === "queue" ? "/queue" : ""); p.state = "ready";
      if (keepAuto && !p.vaultId && !p.keeping) {
        p.keeping = true;
        keepPart(p.blob, p.text, p.i, job.parts.length, { role: job.role, roleLabel: job.roleLabel, road: p.note }).then(function (id) {
          if (job && job.n === token) p.vaultId = id || "";
          p.keeping = false;
        }).catch(function () { p.keeping = false; });
      }
    }
    paint();
    if (!current) advance();                       // the first part that exists starts the story
    pump();                                        // keep the next one coming while this one plays
  }

  function advance() {
    if (!job) return;
    if (manual) return;
    if (current) return;
    if (liveFloor().busy) return;
    var p = readyParts()[0];
    if (!p) return;
    playPart(p);
  }

  function playPart(p) {
    ensureEl();
    current = p;
    p.state = "playing";
    p.rem = 0;
    el.volume = volume;
    el.src = p.url;
    try { el.currentTime = 0; } catch (e) { }
    var play = el.play();
    if (play && play.then) {
      play.then(function () { rememberAt(); paint(); }, function (e) {
        p.state = "ready";
        say("THE BROWSER WOULD NOT START PART " + (p.i + 1) + " :: " + String((e && e.message) || e).toUpperCase()
          + "\n  THAT IS USUALLY THE FIRST-TOUCH RULE ON A PHONE - PRESS PLAY ON THE STRIP JUST ABOVE THE INPUT AND IT WILL RUN.");
        current = null;
        paint();
      });
    }
    paint();
  }

  function onEnded() {
    if (current) { current.state = "played"; current.rem = 0; }
    current = null;
    var next = readyParts()[0];
    if (next) { playPart(next); return; }
    if (waitingPart() || busy) { paint(); return; }   // still rendering: the playhead waits for it
    finish();
  }

  function finish() {
    if (!job) return;
    job.doneAt = Date.now();
    var heard = job.parts.filter(function (p) { return p.state === "played"; }).length;
    var failed = job.parts.filter(function (p) { return p.state === "failed"; }).length;
    var ms = job.parts.reduce(function (a, p) { return a + (p.ms || 0); }, 0);
    say("THE STORY IS TOLD :: " + heard + " OF " + job.parts.length + " PARTS, ABOUT " + mmss(totalSeconds()) + " IN HER VOICE"
      + (ms ? ", RENDERED IN " + mmss(ms / 1000) + " BY " + hostLabel() : "")
      + (road === "anonymous" ? " (NO HUGGING FACE KEY WAS USED)" : "")
      + (failed ? "\n  " + failed + " PART" + (failed === 1 ? "" : "S") + " FAILED AND " + (failed === 1 ? "WAS" : "WERE") + " SKIPPED." : "")
      + "\n  THE TERMINAL IS LIVE AGAIN - HER NEXT REPLY IS SPOKEN ON THE LIVE ENGINE. /story next PLAYS THE STORY AGAIN, /story stop CLEARS IT.");
    paint();
    if (keepAuto) keepNow();
  }

  // ---- her own voice, remembered as it is heard -----------------------------

  function sentencesOf(p) {
    if (p._sents) return p._sents;
    var text = p.text, m = text.match(/[^.!?\u2026]+[.!?\u2026]*\s*/g) || [text];
    var seen = 0, out = [];
    m.forEach(function (s) {
      var t = s.trim();
      if (t) out.push({ text: t, at: seen / Math.max(1, text.length) });
      seen += s.length;
    });
    if (!out.length) out = [{ text: text, at: 0 }];
    p._sents = out;
    if (p.rem == null) p.rem = 0;
    return out;
  }

  // THE GUARD IS FED A SENTENCE AT A TIME, PACED BY THE PLAYHEAD. A whole part at once would put eighty
  // words in the guard's pool, and the guard refuses a transcript that is 60% her words in any order -
  // so a short question of HIS that happened to use her nouns would be thrown away. One sentence at a
  // time is both accurate (the echo arrives within a second of the sound) and safe.
  function rememberAt() {
    if (!current || !el || !window.voice || !window.voice.echo) return;
    var dur = el.duration;
    if (!dur) return;
    var frac = el.currentTime / dur;
    var sents = sentencesOf(current);
    for (var i = current.rem || 0; i < sents.length; i++) {
      if (sents[i].at > frac + 0.02) break;
      try { window.voice.echo.remember(sents[i].text); } catch (e) { }
      current.rem = i + 1;
    }
  }

  // ---- who has the room -----------------------------------------------------

  // What the LIVE side is doing. While any of this is true she has the room: her live voice is in it,
  // or she is holding his words waiting for him to finish, or he is dictating into a one-shot LISTEN
  // session, or a turn is in flight. A LIVE CHANNEL sitting open and idle is NOT one of these - that is
  // exactly the posture a story is meant to play under, so he can talk over it and interrupt.
  function liveFloor() {
    var vs = null;
    try { vs = (window.voice && window.voice.state) ? window.voice.state() : null; } catch (e) { }
    if (vs) {
      if (vs.speaking) return { busy: true, why: "her live voice has the room" };
      if (vs.holding) return { busy: true, why: "she is holding your words" };
      if (vs.listening && !vs.live) return { busy: true, why: "you are dictating" };
    }
    var btn = elOf("sendBtn");
    if (btn && btn.disabled) return { busy: true, why: "a turn is in flight" };
    return { busy: false, why: "" };
  }

  function hasFloor() { return !!playingNow(); }

  function autoPause(why) {
    if (!el || el.paused) { paint(); return; }
    try { el.pause(); } catch (e) { }
    resumeAt = 0;
    if (lastWhy !== why) {
      lastWhy = why;
      say("HELD - " + String(why).toUpperCase() + ". SHE ANSWERS ON THE LIVE ENGINE, AND THE STORY CARRIES ON FROM THE WORD IT STOPPED AT THE MOMENT THE ROOM IS FREE.");
    }
    paint();
  }

  function tick() {
    if (!job) return;
    var floor = liveFloor();
    // SHIFTING HER MID-STORY DOES NOT CHANGE THE CHAPTER'S VOICE - it was locked in when the story was
    // made (one story, one performance) - and that is said once rather than left as a silent puzzle.
    if (!job.roleNote && job.role !== roleNow()) {
      job.roleNote = true;
      say("THE STORY STAYS IN " + job.roleLabel + "'S VOICE :: THE VOICE WAS FIXED WHEN THE STORY WAS MADE, SO A CHAPTER IS ONE PERFORMANCE AND NEVER CHANGES VOICE MID-SENTENCE. THE ROLE YOU HAVE ON NOW TAKES HER NEXT SPOKEN REPLY, AND THE NEXT STORY. /story sample for <ROLE> SETS A SAMPLE FOR AN AGENT WITHOUT SHIFTING ONTO IT.");
    }
    if (el && current && !el.paused && floor.busy) {
      autoPause(floor.why);
    } else if (el && current && el.paused && !manual && !floor.busy && !floor.busy) {
      if (!resumeAt) resumeAt = Date.now() + RESUME_QUIET_MS;
      else if (Date.now() >= resumeAt) {
        resumeAt = 0; lastWhy = "";
        say("CARRYING ON.");
        var play = el.play();
        if (play && play.catch) play.catch(function () { });
      }
    } else if (!current && !floor.busy && !manual) {
      advance();
    }
    if (el && current && !el.paused) rememberAt();
    pump();
    paint();
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(tick, TICK);
  }

  // ---- the strip: the transport above the input -----------------------------

  // The strip borrows the audition bus's class names on purpose - there is ONE visual language for
  // "something is playing in this terminal" and it already exists in src/css/terminal.css. The bus's
  // own selector is `[data-bus-rack]`, so nothing here can ever be mistaken for the bus.
  function kitFor(host) {
    if (host.__storyKit) return host.__storyKit;
    var kit = {};
    host.textContent = "";
    host.classList.add("busRack");
    host.classList.add("storyRack");

    var head = document.createElement("div");
    head.className = "busHead";
    kit.name = document.createElement("span"); kit.name.className = "busName"; head.appendChild(kit.name);
    kit.state = document.createElement("span"); kit.state.className = "busState"; head.appendChild(kit.state);
    host.appendChild(head);

    var row = document.createElement("div");
    row.className = "busRow";
    kit.back = document.createElement("button");
    kit.back.type = "button"; kit.back.textContent = "\u23ee"; kit.back.title = "back to the start of this part";
    kit.back.onclick = function () { back(); };
    row.appendChild(kit.back);
    kit.play = document.createElement("button");
    kit.play.type = "button"; kit.play.className = "busPlay";
    kit.play.onclick = function () { if (el && !el.paused) userPause(); else resume(); };
    row.appendChild(kit.play);
    kit.fwd = document.createElement("button");
    kit.fwd.type = "button"; kit.fwd.textContent = "\u23ed"; kit.fwd.title = "the next part";
    kit.fwd.onclick = function () { next(); };
    row.appendChild(kit.fwd);

    kit.seek = document.createElement("input");
    kit.seek.type = "range"; kit.seek.className = "busSeek"; kit.seek.min = "0"; kit.seek.max = "1000"; kit.seek.step = "1"; kit.seek.value = "0";
    kit.seek.title = "where you are inside this part";
    kit.seek.oninput = function () { if (el && el.duration) { try { el.currentTime = (Number(kit.seek.value) / 1000) * el.duration; } catch (e) { } } };
    row.appendChild(kit.seek);

    kit.time = document.createElement("span"); kit.time.className = "busTime"; row.appendChild(kit.time);

    kit.vol = document.createElement("input");
    kit.vol.type = "range"; kit.vol.className = "busVol"; kit.vol.min = "0"; kit.vol.max = "1"; kit.vol.step = "0.05";
    kit.vol.title = "how loud her story is";
    kit.vol.oninput = function () { volume = num(kit.vol.value, 1, 0, 1); if (el) el.volume = volume; save(); };
    row.appendChild(kit.vol);

    kit.line = document.createElement("span"); kit.line.className = "busLine"; row.appendChild(kit.line);

    kit.close = document.createElement("button");
    kit.close.type = "button"; kit.close.className = "busClose"; kit.close.textContent = "\u00d7"; kit.close.title = "stop the story and clear the strip";
    kit.close.onclick = function () { stop(); };
    row.appendChild(kit.close);

    host.appendChild(row);      // the transport itself (the head above is only the name and the state)
    host.__storyKit = kit;
    return kit;
  }

  function openStrip() { var h = elOf("storyStrip"); if (h) { h.hidden = false; } paint(); }
  function closeStrip() { var h = elOf("storyStrip"); if (h) { h.hidden = true; } }

  function paint() {
    var host = elOf("storyStrip");
    if (!host || host.hidden) return;
    var kit = kitFor(host);
    if (!job) {
      var v = resolveSample();
      var idleRole = roleNameOf(v.role);
      kit.name.textContent = "HER VOICE \u00b7 " + idleRole + " \u00b7 " + voiceTag(v.rec, v.own);
      kit.state.textContent = (armed ? "ARMED" : "IDLE") + " \u00b7 NOTHING ON THE LINE";
      kit.time.textContent = "-:-- / -:--";
      kit.line.textContent = (armed ? "HER NEXT LONGFORM REPLY COMES HERE" : "/story on ARMS IT")
        + (v.rec ? "" : " \u00b7 NO SAMPLE FOR " + idleRole + " YET");
      kit.play.textContent = "\u25b6";
      kit.seek.disabled = true; kit.back.disabled = true; kit.fwd.disabled = true;
      return;
    }
    var done = job.parts.filter(function (p) { return p.state === "played"; }).length;
    var failed = job.parts.filter(function (p) { return p.state === "failed"; }).length;
    var now = playingNow();
    // "RENDERING" only when something IS being rendered: a job whose every part failed would otherwise
    // sit there claiming to be working on a part that will never come.
    var more = (busy || !!waitingPart());
    var state = job.doneAt ? "TOLD" : (now ? "PLAYING" : (current ? "HELD" : (more ? "RENDERING" : "NOTHING LEFT")));
    kit.name.textContent = "HER VOICE \u00b7 " + job.roleLabel + " \u00b7 " + voiceTag(job.sample, job.sampleOwn);
    kit.state.textContent = "PART " + Math.min(done + (job.doneAt ? 0 : 1), job.parts.length) + " / " + job.parts.length + " \u00b7 " + state
      + (failed ? " \u00b7 " + failed + " LOST" : "") + (armed ? " \u00b7 ARMED" : "");
    var pos = (current && el && el.duration) ? el.currentTime : 0;
    var dur = (current && el && el.duration) ? el.duration : (current ? current.seconds : 0);
    kit.time.textContent = mmss(pos) + " / " + (current ? mmss(dur) : "-:--");
    kit.play.textContent = (!el || el.paused) ? "\u25b6" : "\u2016";
    kit.play.disabled = !current && !readyParts().length && !job.doneAt;
    kit.seek.disabled = !current;
    kit.seek.value = String(dur ? Math.round((pos / dur) * 1000) : 0);
    kit.back.disabled = !current && !job.doneAt;
    kit.fwd.disabled = job.parts.length < 2;
    kit.vol.value = String(volume);
    var line = "";
    if (job.doneAt) line = "TOLD \u00b7 " + mmss(totalSeconds()) + " \u00b7 /story stop CLEARS IT";
    else if (current && el && el.paused) line = lastWhy ? "HELD WHILE " + String(lastWhy).toUpperCase() : "HELD WHERE SHE STOPPED";
    else if (more) line = "RENDERING THE NEXT PART";
    else if (failed) line = "NOTHING WAS RENDERED \u00b7 /story test CHECKS THE ROAD, /story read <TEXT> TRIES AGAIN";
    else line = "RENDERED BY " + hostLabel() + (road ? " \u00b7 " + road.toUpperCase() : "");
    kit.line.textContent = line;
    kit.line.title = line;
  }

  // ---- the switch: her reply, claimed --------------------------------------

  // Called from voice.onReply before anything is spoken. True means "this reply is mine to voice".
  function takeReply(text, meta) {
    var t = String(text == null ? "" : text);
    var forced = once > 0;
    if (!forced) {
      if (!armed) return false;
      if (t.replace(/\s+/g, " ").trim().length < MIN_ARM) return false;      // a sentence or two: the live engine
      if (job && !job.doneAt) return false;                                  // a story is on: this reply IS the interruption, and it is live
    }
    if (forced) once--;
    var made = makeJob(t, "reply");
    return !!made;
  }

  function arm(on) {
    armed = !!on;
    save();
    say(armed
      ? "THE STORY LANE IS ARMED. A LONGFORM REPLY (OVER " + MIN_ARM + " CHARACTERS) IS RENDERED BY " + hostLabel() + " AND PLAYED HERE INSTEAD OF BEING SPOKEN ON THE LIVE ENGINE - WHICH IS THE WHOLE SAVING. A QUESTION ASKED WHILE A STORY IS PLAYING IS STILL ANSWERED LIVE."
      : "THE STORY LANE IS OFF. HER REPLIES GO BACK TO THE LIVE ENGINE. /story read <TEXT> AND /story tell <REQUEST> STILL WORK ONE AT A TIME.");
    paint();
    return armed;
  }

  function read(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) { say("USAGE: /story read <TEXT> - THIS EXACT TEXT, IN HER VOICE, THROUGH THE SPACE. NOTHING IS ASKED OF HER AND NOTHING IS ADDED TO THE RECORD."); return false; }
    var made = makeJob(t, "read");
    if (!made) say("THERE IS NOTHING TO READ.");
    return !!made;
  }

  function tell(request) {
    var t = String(request == null ? "" : request).trim();
    if (!t) { say("USAGE: /story tell <WHAT YOU WANT TOLD> - IT IS SENT TO HER AS A TURN, AND HER REPLY IS RENDERED HERE INSTEAD OF SPOKEN LIVE."); return false; }
    once++;
    var input = elOf("userInput");
    if (input) input.value = t;
    if (typeof window.send === "function") {
      say("ASKED. HER REPLY COMES BACK THROUGH " + hostLabel() + " AND PLAYS HERE.");
      window.send();
      return true;
    }
    once--;
    say("THE INPUT IS NOT AVAILABLE - TYPE IT AND TYPE /story ON FIRST INSTEAD.");
    return false;
  }

  // ---- the transport, by hand ----------------------------------------------

  function userPause() {
    if (!el || !current) { say("NOTHING IS PLAYING."); return false; }
    manual = true;
    try { el.pause(); } catch (e) { }
    say("HELD WHERE IT STANDS (NOT A STOP) - /story resume CARRIES ON FROM HERE.");
    paint();
    return true;
  }

  function resume() {
    if (!job) { say("THERE IS NO STORY ON THE LINE. /story read <TEXT> OR /story ON, THEN ASK HER FOR ONE."); return false; }
    manual = false; resumeAt = 0; lastWhy = "";
    if (current) {
      var play = el.play();
      if (play && play.catch) play.catch(function () { say("THE BROWSER WOULD NOT START IT - PRESS PLAY ON THE STRIP."); });
      say("CARRYING ON.");
    } else if (readyParts().length || waitingPart()) {
      say("RENDERING AHEAD - IT STARTS THE MOMENT THERE IS SOMETHING TO PLAY.");
    } else {
      say("THE STORY IS TOLD. /story next PLAYS IT AGAIN.");
    }
    paint();
    return true;
  }

  function stop() {
    if (!job) { say("NOTHING IS ON THE LINE."); return false; }
    var parts = job.parts.length;
    var heard = job.parts.filter(function (p) { return p.state === "played"; }).length;
    var keptN = job.parts.filter(function (p) { return p.vaultId; }).length;
    freeJob();
    manual = false; resumeAt = 0; lastWhy = "";
    say("THE STORY STOPS HERE :: " + heard + " OF " + parts + " PARTS WERE HEARD. " + (keptN ? keptN + " PART" + (keptN === 1 ? " STAYS" : "S STAY") + " IN THE VAULT (/clips) - REPLAY THEM FROM THE KEEP LINE, OR THE GALLERY." : "NOTHING WAS KEPT - THE AUDIO NEVER LEFT THIS SESSION, AND THE TEXT IS STILL WHEREVER IT CAME FROM."));
    paint(); closeStrip();
    return true;
  }

  function next() {
    if (!job) { say("NOTHING IS ON THE LINE."); return false; }
    if (job.doneAt) { replay(); return true; }
    if (current) { current.state = "played"; }
    current = null;
    var p = readyParts()[0];
    if (p) { playPart(p); return true; }
    if (waitingPart()) { say("THE NEXT PART IS STILL RENDERING - IT PLAYS AS SOON AS IT LANDS."); advance(); return true; }
    finish();
    return true;
  }

  function back() {
    if (!job) { say("NOTHING IS ON THE LINE."); return false; }
    if (current) { try { el.currentTime = 0; } catch (e) { } current.rem = 0; playPart(current); return true; }
    var played = job.parts.filter(function (p) { return p.state === "played"; });
    var p = played.length ? played[played.length - 1] : job.parts[0];
    if (p && p.url) { playPart(p); return true; }
    say("NOTHING HAS BEEN PLAYED YET.");
    return false;
  }

  function replay() {
    if (!job) return false;
    job.parts.forEach(function (p) { if (p.state === "played" || p.state === "failed") p.state = p.url ? "ready" : "waiting"; });
    job.doneAt = 0;
    manual = false;
    say("FROM THE TOP.");
    advance();
    pump();
    paint();
    return true;
  }

  // ---- the samples: ONE PER AGENT (his CUSTOM AUDIO SAMPLE > CLONE > TTS) ----

  // The agent on stage right now, as the lane keys samples: a normalised role id, "" when she is off
  // stage (LIA herself). `window.roles` is the authority on that; if it is not loaded yet the lane
  // simply reads it as off stage, and the samples he has set are untouched by that.
  function norm(id) { return String(id == null ? "" : id).trim().toLowerCase(); }
  function roleNow() { return (window.roles && window.roles.currentId) ? norm(window.roles.currentId()) : ""; }
  function roleNameOf(id) {
    id = norm(id);
    if (!id) return "LIA HERSELF (OFF STAGE)";
    if (window.roles && window.roles.get) {
      var r = window.roles.get(id);
      if (r) return String(r.title || r.id || id).toUpperCase();
    }
    return id.toUpperCase();
  }
  function pad(s, n) { s = String(s == null ? "" : s); while (s.length < n) s += " "; return s; }

  // WHICH SAMPLE SPEAKS FOR AN AGENT. The agent's OWN clip wins; with none of its own the FALLBACK
  // answers (that is the single sample this lane used to keep); with neither, no sample at all - the
  // Space's own default voice, which is said out loud rather than dressed up as hers. `role` is the
  // agent being voiced; `key` is where the clip came from ("*" when it is the fallback).
  function resolveSample(roleId) {
    var role = (roleId === undefined) ? roleNow() : norm(roleId);
    var own = samples[role] || null;
    if (own) return { key: role, role: role, rec: own, own: true };
    return { key: FALLBACK_KEY, role: role, rec: samples[FALLBACK_KEY] || null, own: false };
  }

  function voiceTag(rec, own) {
    if (!rec) return "SPACE DEFAULT VOICE";
    return String(rec.name).toUpperCase() + (own ? "" : " (THE FALLBACK)");
  }

  // One line saying whose voice the lane would speak in, and out of which clip - the line makeJob()
  // prints when a story is taken on.
  function voiceLine(v) {
    v = v || resolveSample();
    var who = roleNameOf(v.role);
    if (!v.rec) {
      return "HER VOICE :: " + who + " HAS NO SAMPLE OF ITS OWN AND NO FALLBACK IS SET, SO THE SPACE SPEAKS IN ITS OWN VOICE. /story sample <ID|NAME> SETS ONE FOR THE AGENT ON STAGE, AND /story sample <ID|NAME> as default SETS THE ONE EVERY OTHER AGENT FALLS BACK TO.";
    }
    return "HER VOICE :: " + who + " IS CLONED FROM \"" + String(v.rec.name).toUpperCase() + "\" (A VAULT RECORD" + (v.rec.bytes ? ", " + Math.round(v.rec.bytes / 1024) + " KB" : "") + ")"
      + (v.own ? "" : " - THE FALLBACK SAMPLE, SINCE " + who + " HAS NONE OF ITS OWN")
      + " - IT IS SENT TO THE SPACE ONCE PER SESSION, THE FIRST TIME A PART IS RENDERED IN THAT VOICE, AND GOES NOWHERE ELSE.";
  }

  // ---- the vault's audio, and the agent it could belong to ------------------

  function audioRecs() {
    var out = [];
    if (!window.media || !window.media.list) return out;
    try {
      window.media.list().forEach(function (id) {
        var r = window.media.get(id);
        if (r && /^audio\//.test(String(r.mime || ""))) out.push(r);
      });
    } catch (e) { }
    return out;
  }
  function recLabel(r) {
    if (window.media && window.media.recordLabel) { try { return String(window.media.recordLabel(r)) || String((r && r.id) || ""); } catch (e) { } }
    return String((r && (r.name || r.id)) || "");
  }
  function recBytes(r) {
    var b = Number((r && (r.bytes || r.size)) || 0) || 0;
    return b ? Math.round(b / 1024) + " KB" : "SIZE UNKNOWN";
  }
  function recLine(r) {
    // THE TAGS RIDE WITH THE NAME. A voice is filed by word on its own full stage (#barbelo, #tender,
    // #sample - see LIA_VOX_TAGS), and a sample being chosen here is the moment those words are worth
    // seeing: they are what he filed it as when he put it in the tree.
    var tags = (r && r.tags || []).slice(0, 4);
    return "\"" + recLabel(r).toUpperCase() + "\" (" + r.id + " \u00b7 " + recBytes(r) + (r.duration ? " \u00b7 " + mmss(r.duration) : "") + ")"
      + (tags.length ? " " + tags.map(function (t) { return "#" + t; }).join(" ") : "");
  }

  // What he typed, turned into a vault record: the id exactly, then the name exactly, then any part of
  // the name. AUDIO ONLY - a picture handed to the Space fails a whole render, so it is refused here,
  // where the reason can be said and where nothing has left the device yet.
  function findAudio(want) {
    var w = String(want == null ? "" : want).trim();
    if (!w) return null;
    var list = audioRecs(), w2 = w.toLowerCase(), hit = null;
    list.forEach(function (r) { if (!hit && String(r.id) === w) hit = r; });
    if (!hit) list.forEach(function (r) { if (!hit && String(r.name || "").toLowerCase() === w2) hit = r; });
    if (!hit) list.forEach(function (r) { if (!hit && recLabel(r).toLowerCase().indexOf(w2) !== -1) hit = r; });
    return hit;
  }
  // A record that answered to that id or name but is NOT audio (said out loud, so the refusal is useful).
  function findRecord(want) {
    var w = String(want == null ? "" : want).trim();
    if (!w || !window.media || !window.media.list) return null;
    var w2 = w.toLowerCase(), hit = null;
    try {
      window.media.list().forEach(function (id) {
        if (hit) return;
        var r = window.media.get(id);
        if (!r) return;
        if (String(r.id) === w || String(r.name || "").toLowerCase() === w2) hit = r;
      });
    } catch (e) { }
    return hit;
  }

  // What a role reference means: an agent, the fallback, or LIA off stage. Unknown, with a real roster
  // loaded, is null - a typo must not quietly create an agent of its own.
  function targetRole(spec) {
    var s = norm(spec).replace(/^(for|as|to)\s+/, "");
    if (!s) return null;
    if (/^(default|fallback|any|anyone|every|everyone|the-default)$/.test(s)) {
      return { key: FALLBACK_KEY, label: "EVERY AGENT WITH NO SAMPLE OF ITS OWN" };
    }
    if (/^(off-?stage|actor|lia|herself|her|no-role)$/.test(s)) {
      return { key: "", label: "LIA HERSELF, NO ROLE ON" };
    }
    if (window.roles && window.roles.get) {
      var r = window.roles.get(s);
      if (r) return { key: norm(r.id), label: roleNameOf(r.id) };
    }
    var roster = (window.roles && window.roles.all) ? window.roles.all() : [];
    if (!roster.length) return { key: s, label: s.toUpperCase() };   // roles not loaded: take it as given
    return null;                                                     // a real roster, and no such agent
  }
  function targetName(t) {
    return (t.key === FALLBACK_KEY) ? "THE FALLBACK" : (t.key === "" ? "LIA HERSELF (OFF STAGE)" : String(t.label || roleNameOf(t.key)));
  }
  function agentRefList() {
    var list = ((window.roles && window.roles.all) ? window.roles.all() : []).map(function (r) {
      return (norm(r.id) === roleNow() ? "  * " : "    ") + pad(r.id, 15) + String(r.title || r.id).toUpperCase() + (resolveSample(r.id).own ? " :: HAS ITS OWN SAMPLE" : "");
    });
    if (!list.length) list = ["    (NO ROSTER READ YET - src/roles/roles.json IS THE LIST OF AGENTS.)"];
    list.push("    " + pad("default", 15) + "THE FALLBACK - ANY AGENT WITH NO SAMPLE OF ITS OWN");
    list.push("    " + pad("offstage", 15) + "LIA HERSELF, NO ROLE ON");
    return list.join("\n");
  }

  // THE TABLE: every agent, what it speaks in, and the audio there is to choose from. Suggestions are
  // called out - a record whose name carries an agent's id or title - but nothing is ever uploaded by
  // suggestion: a sample leaves this device only when a story is rendered in that voice.
  function sampleReport() {
    var keys = Object.keys(samples);
    var audios = audioRecs();
    var out = ["THE VOICE, AGENT BY AGENT :: " + (keys.length ? keys.length + " SAMPLE" + (keys.length === 1 ? "" : "S") + " SET" : "NOTHING SET YET") + " :: ON STAGE " + roleNameOf(roleNow())];
    var roster = (window.roles && window.roles.all) ? window.roles.all() : [];
    roster.forEach(function (r) {
      var v = resolveSample(r.id);
      out.push((norm(r.id) === roleNow() ? "  * " : "    ") + pad(norm(r.id), 15) + String(r.title || r.id).toUpperCase() + " :: " + (v.rec ? recLine(v.rec) + (v.own ? "" : " - THE FALLBACK") : "NO SAMPLE - THE SPACE'S OWN VOICE"));
    });
    out.push("    " + pad("offstage", 15) + "LIA HERSELF, NO ROLE ON :: " + (function () { var v = resolveSample(""); return v.rec ? recLine(v.rec) + (v.own ? "" : " - THE FALLBACK") : "NO SAMPLE - THE SPACE'S OWN VOICE"; })());
    out.push("    " + pad("default", 15) + "THE FALLBACK (any agent with no sample of its own) :: " + (samples[FALLBACK_KEY] ? recLine(samples[FALLBACK_KEY]) : "NOT SET"));
    out.push("  AUDIO IN THE VAULT :: " + (audios.length ? audios.length + " RECORD" + (audios.length === 1 ? "" : "S") : "NONE YET - a clip dropped on the audition bus, or attached with the paperclip, lands here"));
    // AND THE PROMPT IS PRINTED UNDER IT. A voice carries the words that describe it (its full stage's
    // VOICE PROMPT row) - what it is, how it sounds, its accent, how it was caught - so that a better
    // sample can be asked for later. Here is where that matters: choosing a voice is exactly when he
    // needs to remember what it was made of.
    audios.slice(-12).forEach(function (r) {
      var pr = String(r.prompt || "").replace(/\s+/g, " ").trim();
      out.push("    " + pad(r.id, 15) + recLabel(r) + " \u00b7 " + recBytes(r) + (r.duration ? " \u00b7 " + mmss(r.duration) : "")
        + ((r.tags || []).length ? " \u00b7 " + r.tags.map(function (t) { return "#" + t; }).join(" ") : "")
        + (pr ? "\n        PROMPT :: " + pr.slice(0, 120) + (pr.length > 120 ? "\u2026" : "") : ""));
    });
    if (audios.length > 12) out.push("    ... AND " + (audios.length - 12) + " MORE (/media LISTS THEM ALL)");
    roster.forEach(function (r) {
      if (resolveSample(r.id).own) return;
      var id = norm(r.id), title = String(r.title || "").toLowerCase();
      var m = audios.filter(function (a) {
        var n = (recLabel(a) + " " + String(a.name || "")).toLowerCase();
        return n.indexOf(id) !== -1 || (!!title && n.indexOf(title) !== -1);
      });
      if (m.length) out.push("  " + String(r.title || r.id).toUpperCase() + " HAS NO SAMPLE OF ITS OWN, AND THE VAULT HOLDS " + m.map(function (a) { return "\"" + recLabel(a) + "\""; }).join(", ") + " - /story sample " + m[0].id + " for " + id + " TAKES IT.");
    });
    out.push("  SET IT :: /story sample <ID|NAME> (for the agent ON STAGE) \u00b7 /story sample <ID|NAME> for <AGENT> \u00b7 /story sample <ID|NAME> as default, or default <ID> (the fallback)");
    out.push("  CLEAR IT :: /story sample off \u00b7 /story sample off for <AGENT> \u00b7 /story sample off default \u00b7 /story sample off all");
    out.push("  AGENTS ::\n" + agentRefList());
    out.push("  A SAMPLE IS ONE VOICE, CLEANLY RECORDED, 10-30 SECONDS - the Space listens to the first " + REF_DUR + " seconds of it. Whatever is set for the agent on stage is what a story of hers is cloned from; one story keeps the voice it began in.");
    say(out.join("\n"));
    return true;
  }

  // `/story sample ...` - a vault pick plus a target: the agent on stage unless another was named.
  function setSample(arg) {
    var raw = String(arg == null ? "" : arg).trim();
    if (!raw) { sampleReport(); return null; }

    var clear = raw.match(/^(off|none|clear|forget|unset)\b/i);
    if (clear) return clearSample(raw.slice(clear[0].length).trim());

    // "default" and "offstage" ON THEIR OWN are the two named slots when no record answers to them, and
    // in front ("default <ID>") they read the same as "... as default <ID>" - the same intent, the other
    // word order, because that is how he would say it out loud.
    var pre = raw.match(/^(default|fallback|off-?stage|actor|lia)\s+(.+)$/i);
    var preTarget = pre ? targetRole(pre[1]) : null;

    // A SET. The sample is everything except an optional trailing target ("... for <AGENT>" / "... as
    // default"). The WHOLE argument is tried against the vault first when the tail names no agent, so
    // a record whose own name contains "for" still resolves.
    var want = raw, target = null;
    if (preTarget && findAudio(pre[2].trim())) { target = preTarget; want = pre[2].trim(); }
    var m = target ? null : raw.match(/^(.*?)\s+(?:for|as|to)\s+(.+)$/i);
    if (m) {
      var t = targetRole(m[2].trim());
      if (t) { target = t; want = m[1].trim(); }
      else if (!findAudio(raw)) {
        say("NO SUCH AGENT :: " + m[2].trim().toUpperCase() + ". THE AGENTS ARE:\n" + agentRefList());
        return false;
      }
    }
    // A bare "default" / "fallback" that is not a record name is a question about the fallback: the
    // table answers it, rather than a fruitless hunt for audio called "default".
    if (!target && /^(default|fallback)$/i.test(raw) && !findAudio(raw)) { sampleReport(); return null; }
    if (!target) target = { key: roleNow(), label: roleNameOf(roleNow()) };
    if (!window.media) { say("THE VAULT IS OFFLINE, SO THERE IS NOTHING TO CLONE FROM."); return false; }
    var hit = findAudio(want);
    if (!hit) {
      var other = findRecord(want);
      if (other) {
        say("\"" + want.toUpperCase() + "\" IS IN THE VAULT BUT IT IS NOT AUDIO (" + String(other.mime || "unknown type") + ") :: THE SPACE CLONES FROM A CLIP, AND HANDING IT A PICTURE FAILS THE WHOLE RENDER. /media LISTS WHAT IS IN THE VAULT.");
        return false;
      }
      var audios = audioRecs();
      say("NO VAULT AUDIO MATCHED \"" + want.toUpperCase() + "\"."
        + "\n  AUDIO IN THE VAULT :: " + (audios.length ? audios.slice(-8).map(function (r) { return "\"" + recLabel(r) + "\" (" + r.id + ")"; }).join(" \u00b7 ") + (audios.length > 8 ? " \u00b7 AND " + (audios.length - 8) + " MORE" : "") : "NONE YET - drop a clip on the audition bus, or attach one with the paperclip, and it lands here.")
        + "\n  /story sample LISTS THE AGENTS AND EVERY RECORD.");
      return false;
    }
    var rec = { id: String(hit.id), name: recLabel(hit) || String(hit.id), bytes: Number(hit.bytes) || Number(hit.size) || 0 };
    samples[target.key] = rec;
    refPath = ""; refFor = "";   // the path in the space was for another clip: it is sent again on the next render
    save();
    var line = "HER VOICE FOR " + targetName(target) + " IS NOW CLONED FROM \"" + String(rec.name).toUpperCase() + "\" (" + rec.id + (rec.bytes ? ", " + Math.round(rec.bytes / 1024) + " KB" : "") + ")."
      + "\nIT IS SENT TO THE SPACE ONCE PER SESSION, THE FIRST TIME A PART IS RENDERED IN THAT VOICE - A PUBLIC SPACE, SO THE CLIP LEAVES THIS DEVICE AND GOES NOWHERE ELSE, AND NOTHING IS SENT UNTIL THEN."
      + "\nA GOOD SAMPLE IS ONE VOICE, CLEANLY RECORDED, 10-30 SECONDS - THE SPACE LISTENS TO THE FIRST " + REF_DUR + " SECONDS OF IT.";
    if (target.key === FALLBACK_KEY) line += "\nTHE FALLBACK ANSWERS FOR ANY AGENT THAT HAS NO SAMPLE OF ITS OWN.";
    else if (target.key !== roleNow()) line += "\nTHAT AGENT IS NOT ON STAGE RIGHT NOW - IT TAKES EFFECT WHEN SHE WEARS IT (/role " + target.key + " SHIFTS NOW).";
    else line += "\n" + voiceLine();
    say(line);
    paint();
    return rec;
  }

  function clearSample(spec) {
    spec = String(spec == null ? "" : spec).replace(/^(for|as|to)\s+/i, "").trim();
    if (/^all$/i.test(spec)) {
      var n = Object.keys(samples).length;
      samples = {}; refPath = ""; refFor = "";
      save(); paint();
      say(n ? "EVERY VOICE SAMPLE IS CLEARED (" + n + " " + (n === 1 ? "WAS" : "WERE") + " SET) - THE SPACE SPEAKS IN ITS OWN VOICE UNTIL YOU SET ONE AGAIN. /story sample <ID|NAME> PUTS ONE BACK."
            : "NOTHING WAS SET, SO NOTHING CHANGED.");
      return true;
    }
    var target = spec ? targetRole(spec) : { key: roleNow(), label: roleNameOf(roleNow()) };
    if (!target) { say("NO SUCH AGENT :: " + String(spec).toUpperCase() + ". THE AGENTS ARE:\n" + agentRefList()); return false; }
    var who = targetName(target);
    var had = samples[target.key];
    delete samples[target.key];
    refPath = ""; refFor = "";
    save(); paint();
    if (!had) {
      say("NOTHING WAS SET FOR " + who + ", SO NOTHING CHANGED." + (target.key === FALLBACK_KEY ? "" : " " + roleNameOf(target.key) + (samples[FALLBACK_KEY] ? " FALLS BACK TO \"" + String(samples[FALLBACK_KEY].name).toUpperCase() + "\"." : " HAS NOTHING TO FALL BACK TO EITHER, SO THE SPACE'S OWN VOICE ANSWERS.")));
      return true;
    }
    say("THE SAMPLE FOR " + who + " IS CLEARED (WAS \"" + String(had.name).toUpperCase() + "\")."
      + (target.key === FALLBACK_KEY ? " ANY AGENT WITH NO SAMPLE OF ITS OWN NOW GETS THE SPACE'S OWN VOICE."
        : " " + roleNameOf(target.key) + (samples[FALLBACK_KEY] ? " FALLS BACK TO \"" + String(samples[FALLBACK_KEY].name).toUpperCase() + "\"." : " HAS NOTHING TO FALL BACK TO, SO THE SPACE'S OWN VOICE ANSWERS.")));
    return true;
  }

  // ---- state, text, commands -----------------------------------------------

  function state() {
    var done = job ? job.parts.filter(function (p) { return p.state === "played"; }).length : 0;
    var failed = job ? job.parts.filter(function (p) { return p.state === "failed"; }).length : 0;
    return {
      ready: ready, armed: armed, once: once,
      space: HOST.id, host: HOST.label, base: BASE,
      road: road, transport: transport, keyNote: keyNote, keyDown: keyDown,
      keyVerdict: keyVerdict || "unchecked",
      // THE VOICE IN FORCE. With a story on the line this is the sample THAT STORY was cloned from
      // (fixed when it was made); otherwise it is what the agent on stage would speak in right now.
      sample: (function () { var r = (job ? job.sample : resolveSample().rec); return r ? { id: r.id, name: r.name, bytes: r.bytes } : null; })(),
      sampleOwn: !!(job ? job.sampleOwn : resolveSample().own),
      sampleFallback: !(job ? job.sampleOwn : resolveSample().own) && !!(job ? job.sample : resolveSample().rec),
      sampleRole: job ? job.role : roleNow(),
      sampleRoleLabel: job ? job.roleLabel : roleNameOf(roleNow()),
      samples: writeSamples(),
      lockedVoice: !!job,
      role: roleNow(), roleLabel: roleNameOf(roleNow()),
      sampling: !!refPath,
      parts: job ? job.parts.length : 0,
      played: done, failed: failed,
      kept: job ? job.parts.filter(function (p) { return p.vaultId; }).length : 0, keepAuto: keepAuto,
      rendering: !!busy,
      playing: !!playingNow(), held: !!(current && el && el.paused), manual: manual,
      part: current ? current.i + 1 : Math.min(done + 1, job ? job.parts.length : 0),
      position: (el && current) ? Number((el.currentTime || 0).toFixed(1)) : 0,
      duration: (el && current && el.duration) ? Number(el.duration.toFixed(1)) : (current ? current.seconds : 0),
      total: job ? Number(totalSeconds().toFixed(1)) : 0,
      volume: volume,
      done: !!(job && job.doneAt),
      chars: job ? job.text.length : 0,
      chunk: CHUNK, maxChars: HOST.maxChars, ahead: AHEAD,
      lastError: lastError
    };
  }

  function summary() {
    var s = state();
    // No "STORY ::" prefix here: everything that prints this already does so through the lane's own
    // `say()` (or the help topic), which adds the speaker.
    return (s.armed ? "ARMED" : "OFF")
      + (s.parts ? " :: PART " + s.part + "/" + s.parts + (s.playing ? " PLAYING" : (s.held ? " HELD" : (s.done ? " TOLD" : " RENDERING"))) : " :: NOTHING ON THE LINE")
      + " :: " + (s.sample ? "CLONED FROM \"" + String(s.sample.name).toUpperCase() + "\"" + (s.sampleOwn ? "" : " (THE FALLBACK)") : "THE SPACE'S OWN VOICE")
      + " :: " + s.sampleRoleLabel
      + " :: " + hostLabel();
  }

  function describe() {
    var s = state();
    var out = [summary()];
    out.push("  A STORY IS NOT SPOKEN BY THE LIVE ENGINE. IT IS RENDERED BY " + hostLabel() + " AND PLAYED HERE, IN THE LOG, WHILE YOU BOTH LISTEN - WHICH IS THE ONLY WAY A CHAPTER IS AFFORDABLE. /story on ARMS IT FOR HER REPLIES; /story read <TEXT> AND /story tell <REQUEST> DO ONE AT A TIME.");
    out.push("  THE SWITCH :: IF YOU TALK OVER IT OR A TURN IS IN FLIGHT, THE STORY HOLDS WHERE IT STANDS, SHE ANSWERS ON THE LIVE ENGINE, AND IT CARRIES ON FROM THE WORD IT STOPPED AT. NOTHING IS LOST AND NOTHING IS REPEATED.");
    out.push("  PARTS :: " + s.parts + " ON THE LINE, " + s.played + " PLAYED" + (s.failed ? ", " + s.failed + " FAILED" : "") + " :: EACH PART IS ABOUT " + CHUNK + " CHARACTERS OF TEXT (≈" + mmss(estimateSeconds(CHUNK)) + " OF SPEECH), RENDERED ONE AT A TIME, THE NEXT WHILE THE CURRENT PLAYS"
      + (s.total ? " :: ABOUT " + mmss(s.total) + " ALL TOLD" : "") + ".");
    out.push("  KEEP :: " + (keepAuto ? "ON - EVERY RENDERED PART IS FILED AS IT LANDS" : "OFF - NOTHING IS FILED UNTIL ASKED") + " :: /story keep FILES THE CURRENT STORY'S RENDERED PARTS IN THE VAULT (/clips), TAGGED #story #voice #longform, WITH REPLAYS INLINE UNDER THE RECEIPT" + (s.kept ? " :: " + s.kept + " OF " + s.parts + " PARTS KEPT." : "") + " :: /story split <TEXT> SHOWS THE SPLIT WITHOUT RENDERING ANYTHING.");
    out.push("  " + voiceLine(job ? { role: job.role, rec: job.sample, own: job.sampleOwn } : resolveSample()));
    out.push("  THE SAMPLES ARE PER AGENT :: each RoleLayer has a clip of its own, because the clip IS the voice - /story sample LISTS every agent, what it speaks in, and the audio in the vault. A STORY KEEPS THE VOICE IT BEGAN IN (" + (job ? "this one is " + job.roleLabel + "'s" : "locked in when the story is made") + "), so shifting her onto another layer never changes voice mid-chapter." + (s.sampling ? " THE CLIP IN FORCE IS ALREADY UP ON THE SPACE THIS SESSION." : ""));
    out.push("  THE ROAD :: " + hostLabel() + " :: " + (s.road ? s.road.toUpperCase() : "NOT TRIED YET") + (s.transport ? "/" + s.transport.toUpperCase() : "") + (s.road === "anonymous" ? " - NO HUGGING FACE KEY WAS USED, SO THE GPU MINUTES ARE SHARED (A WORKING KEY IN KEYS \u25be PUTS THEM ON YOUR OWN ACCOUNT)" : "") + (keyDown ? " - THE HELD KEY WAS PUT DOWN THIS SESSION" : "") + ". /story test RENDERS ONE SHORT LINE TO FIND OUT WHETHER THE ROAD IS OPEN AT ALL.");
    out.push("  THE KNOBS :: " + knobLine() + ".");
    if (s.keyNote) out.push("  THE KEY :: " + s.keyNote);
    else if (s.keyVerdict === "ok") out.push("  THE KEY :: " + keyLine());
    out.push("  NOTES :: " + hostLabel() + " IS A FREE ZeroGPU SPACE ON HUGGINGFACE :: " + hostWhat() + ". EVERY CLIP IT RETURNS CARRIES AN INAUDIBLE RESEMBLE PERTH WATERMARK. " + PACE_NOTE);
    out.push("  /story on|off \u00b7 /story read <TEXT> \u00b7 /story tell <REQUEST> \u00b7 /story pause \u00b7 /story resume \u00b7 /story stop \u00b7 /story next \u00b7 /story back \u00b7 /story parts \u00b7 /story keep [on|off] \u00b7 /story split <TEXT> \u00b7 /story key \u00b7 /story sample [<ID|NAME> [for <AGENT>|as default]] [off [<AGENT>|default|all]] \u00b7 /story test \u00b7 /story road \u00b7 /story space <" + hostIds().join("|") + ">");
    return out.join("\n");
  }

  var PACE_NOTE = "MEASURED 2026-09-21 :: 146 CHARACTERS CAME BACK AS 10.9 SECONDS OF 48 kHz STEREO AUDIO IN 10.9 SECONDS OF WALL TIME - ONE PART IS ROUGHLY REAL TIME, WHICH IS WHY THE NEXT ONE IS RENDERED WHILE THE CURRENT ONE PLAYS.";

  // A one-word way to find out whether the lane can render AT ALL right now, without asking her for a
  // story first: it spends one short render, reports the road, the transport and the time - or the exact
  // refusal, which is the whole point (a quota that is spent and a space whose queue is down look
  // identical from the outside until something tries).
  async function testRoad(text) {
    if (busy) { say("A RENDER IS ALREADY IN FLIGHT - THE PROBE WAITS FOR IT. /story parts SHOWS WHERE IT IS."); return false; }
    var line = String(text == null ? "" : text).trim() || "The harbor was quiet that night.";
    var v = resolveSample();
    say("PROBING " + hostLabel() + " WITH ONE SHORT LINE (" + line.length + " CHARACTERS) IN "
      + (v.rec ? "THE VOICE OF " + roleNameOf(v.role) + " - \"" + String(v.rec.name).toUpperCase() + "\"" + (v.own ? "" : " (THE FALLBACK)") : "THE SPACE'S OWN VOICE, SINCE " + roleNameOf(v.role) + " HAS NO SAMPLE") + " ...");
    var t0 = Date.now();
    try {
      var got = await render(line, v.rec);
      say("THE ROAD IS OPEN :: " + hostLabel() + " ANSWERED IN " + mmss((Date.now() - t0) / 1000) + " WITH " + Math.round(got.blob.size / 1024) + " KB OF AUDIO"
        + "\n  ROAD " + String(got.road).toUpperCase() + " \u00b7 TRANSPORT " + (got.transport === "queue" ? "THE SPACE'S OWN QUEUE (its shortcut call was refused, so this is the road that works here)" : "THE SHORTCUT CALL") + " \u00b7 KNOBS " + knobLine()
        + "\n  NOTHING WAS PLAYED AND NOTHING WAS KEPT - /story read <TEXT> RENDERS ONE FOR REAL, OR /story ON ARMS IT FOR HER REPLIES.");
      return true;
    } catch (e) {
      say("THE ROAD IS CLOSED :: " + String((e && e.message) || e));
      return false;
    }
  }

  function partReport() {
    if (!job) { say("NOTHING IS ON THE LINE."); return; }
    var out = ["STORY :: " + job.parts.length + " PART" + (job.parts.length === 1 ? "" : "S") + " OF " + mmss(totalSeconds()) + " :: \"" + job.text.slice(0, 60) + (job.text.length > 60 ? "\u2026" : "") + "\""];
    job.parts.forEach(function (p) {
      out.push("  " + (p.i + 1) + ". " + p.state.toUpperCase().padEnd(9)
        + (p.seconds ? mmss(p.seconds) : (p.state === "played" || p.state === "playing" ? "? " : "≈" + mmss(estimateSeconds(p.text.length))))
        + (p.ms ? " \u00b7 RENDERED IN " + mmss(p.ms / 1000) : "") + (p.note ? " \u00b7 " + p.note.toUpperCase() : "")
        + (p.error ? " \u00b7 " + p.error.split("\n")[0] : "")
        + " :: " + p.text.slice(0, 70) + (p.text.length > 70 ? "\u2026" : ""));
    });
    say(out.join("\n"));
  }

  function keepStamp() {
    var d = new Date();
    function p(x) { x = String(x); return x.length < 2 ? "0" + x : x; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  async function keepPart(blob, text, i, n, meta) {
    meta = meta || {};
    if (!blob || !blob.size) return null;
    if (!window.media || !window.media.add) { say("THE VAULT IS OFFLINE - NOTHING WAS KEPT."); return null; }
    var role = norm(meta.role != null ? meta.role : (job ? job.role : roleNow()));
    var who = meta.roleLabel || roleNameOf(role);
    var road = meta.road ? " (" + String(meta.road).toUpperCase() + ")" : "";
    return (await window.media.add(blob, {
      name: "her-voice-" + (role || "offstage") + "-p" + (i + 1) + "of" + n + "-" + keepStamp() + ".wav",
      kind: "gen", folder: "/clips",
      tags: ["story", "voice", role || "offstage", "longform"],
      prompt: String(text == null ? "" : text).slice(0, 400),
      note: "PART " + (i + 1) + " OF " + n + " :: " + who + " :: RENDERED BY " + hostLabel() + road + " :: A REPLAY - THE STRIP ABOVE THE INPUT STAYS HER LIVE FLOOR."
    })) || null;
  }

  function keepBlock(entry, list) {
    var box = document.createElement("div");
    box.className = "storyKeep";
    list.forEach(function (p) {
      var url = null;
      try { url = window.media.url(p.vaultId); } catch (e) { url = null; }
      if (!url) return;
      var row = document.createElement("div");
      row.className = "storyKeepRow";
      var lab = document.createElement("span");
      lab.className = "storyKeepLab";
      lab.textContent = "PART " + (p.i + 1) + " \u00b7 " + p.vaultId;
      row.appendChild(lab);
      var a = document.createElement("audio");
      a.controls = true;
      a.preload = "metadata";
      a.src = url;
      a.title = "replay part " + (p.i + 1) + " - a replay, not her live floor";
      row.appendChild(a);
      box.appendChild(row);
    });
    if (box.childNodes.length) entry.appendChild(box);
    return box.childNodes.length;
  }

  async function keepNow() {
    if (!job) { say("NOTHING IS ON THE LINE - /story read <TEXT> OR /story ON, THEN ASK HER FOR ONE."); return []; }
    for (var w = 0; w < 40; w++) {
      if (!job.parts.some(function (p) { return p.keeping; })) break;
      await new Promise(function (r) { setTimeout(r, 250); });
    }
    if (!job) return [];
    var fresh = [];
    for (var k = 0; k < job.parts.length; k++) {
      var p = job.parts[k];
      if (!p.blob || p.vaultId || p.keeping) continue;
      var id = null;
      try { id = await keepPart(p.blob, p.text, p.i, job.parts.length, { role: job.role, roleLabel: job.roleLabel, road: p.note }); }
      catch (e) { say("PART " + (p.i + 1) + " WAS NOT KEPT :: " + String((e && e.message) || e).toUpperCase()); }
      if (id) { p.vaultId = id; fresh.push(p); }
    }
    var kept = job.parts.filter(function (q) { return q.vaultId; });
    if (!kept.length) { say("NOTHING WAS KEPT - NO PART HAS RENDERED YET. /story parts SHOWS WHERE IT IS."); return []; }
    var lines = ["KEPT :: " + kept.length + " OF " + job.parts.length + " PARTS IN THE VAULT (/clips) :: #story #voice #" + (norm(job.role) || "offstage") + " #longform"];
    kept.forEach(function (q) { lines.push("  PART " + (q.i + 1) + " :: " + q.vaultId + (fresh.indexOf(q) >= 0 ? " (JUST NOW)" : " (EARLIER)")); });
    lines.push("REPLAY THEM UNDER THIS LINE - THE STRIP ABOVE THE INPUT STAYS HER LIVE FLOOR.");
    var entry = null;
    try { entry = (typeof print === "function") ? print("SYSTEM", lines.join("\n")) : null; } catch (e) { entry = null; }
    if (!entry) { say(lines.join("\n")); return kept.map(function (q) { return q.vaultId; }); }
    keepBlock(entry, kept);
    return kept.map(function (q) { return q.vaultId; });
  }

  function autoKeep(on) {
    if (on === undefined) return keepAuto;
    keepAuto = !!on;
    save();
    say(keepAuto ? "KEEP IS ON - EVERY RENDERED PART IS FILED IN THE VAULT (/clips) AS IT LANDS, TAGGED #story #voice #longform. /story keep FILES WHAT IS ALREADY THERE." : "KEEP IS OFF - RENDERED PARTS PLAY AND LEAVE. /story keep FILES THE CURRENT STORY BY HAND.");
    paint();
    return keepAuto;
  }

  function split(text) {
    var clean = (window.voice && window.voice.clean) ? window.voice.clean(text) : String(text == null ? "" : text);
    clean = String(clean).replace(/\s+/g, " ").trim();
    var pieces = (window.voice && window.voice.chunk) ? window.voice.chunk(clean, CHUNK) : (clean ? [clean] : []);
    return {
      chars: clean.length, chunk: CHUNK, maxChars: HOST.maxChars,
      parts: pieces.map(function (t, i) { return { i: i, chars: t.length, over: t.length > HOST.maxChars, text: t }; })
    };
  }

  function splitReport(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) { say("USAGE: /story split <TEXT> - SHOWS HOW THE TEXT SPLITS INTO RENDERED PARTS. NOTHING IS RENDERED AND NOTHING IS KEPT."); return null; }
    var s = split(t);
    var out = ["SPLIT :: " + s.parts.length + " PART" + (s.parts.length === 1 ? "" : "S") + " OF ABOUT " + CHUNK + " CHARACTERS, " + s.chars + " CHARACTERS ALL TOLD - RENDERED ONE AT A TIME, THE NEXT WHILE THE CURRENT PLAYS."];
    s.parts.forEach(function (q) {
      out.push("  " + (q.i + 1) + ". " + q.chars + " CHARS" + (q.over ? " :: LONGER THAN " + hostLabel() + " READS IN ONE CALL (" + HOST.maxChars + ") - THE TAIL WOULD BE CUT" : "") + " :: " + q.text.slice(0, 70) + (q.text.length > 70 ? "\u2026" : ""));
    });
    say(out.join("\n"));
    return s;
  }

  function command(arg) {
    var a = String(arg == null ? "" : arg).trim();
    var parts = a.split(/\s+/);
    var verb = String(parts[0] || "").toLowerCase();
    var rest = parts.slice(1).join(" ").trim();
    if (!verb) { say(describe()); return; }
    if (verb === "test" || verb === "probe") { testRoad(rest); return; }
    if (verb === "on" || verb === "arm") { arm(true); return; }
    if (verb === "off" || verb === "disarm") { arm(false); return; }
    if (verb === "read" || verb === "say") { read(rest); return; }
    if (verb === "tell" || verb === "ask") { tell(rest); return; }
    if (verb === "pause" || verb === "hold") { userPause(); return; }
    if (verb === "resume" || verb === "play" || verb === "carryon") { resume(); return; }
    if (verb === "stop" || verb === "clear" || verb === "off-line") { stop(); return; }
    if (verb === "next" || verb === "skip") { next(); return; }
    if (verb === "back" || verb === "again" || verb === "replay" || verb === "restart") { back(); return; }
    if (verb === "parts" || verb === "list") { partReport(); return; }
    if (verb === "keep" || verb === "save" || verb === "file") {
      if (/^(on|arm|auto|always)$/i.test(rest)) { autoKeep(true); return; }
      if (/^(off|disarm|manual|never)$/i.test(rest)) { autoKeep(false); return; }
      keepNow(); return;
    }
    if (verb === "split" || verb === "chunk" || verb === "cut") { splitReport(rest); return; }
    if (verb === "sample" || verb === "samples") {
      // "list"/"agents"/"table" on their own is the TABLE, not a vault lookup for a record so named.
      if (/^(list|all|table|agents|voices)$/i.test(rest)) { sampleReport(); return; }
      setSample(rest); return;
    }
    if (verb === "voice" || verb === "clone") { setSample(rest); return; }
    if (verb === "key" || verb === "token" || verb === "huggingface") {
      // "again" forgets a verdict from earlier in this session, so a token pasted a moment ago is
      // checked fresh instead of being judged by the one that was there before it.
      if (/^(again|clear|reset|recheck|refresh)$/i.test(rest)) { keyVerdict = ""; keyDown = false; keyNote = ""; }
      say("THE HUGGING FACE KEY :: " + (keyring() && keyring().has("huggingface") ? "ONE IS HELD IN KEYS \u25be" : "NONE IS HELD") + ".\n  CHECKING IT AGAINST HUGGING FACE ITSELF ...");
      checkKey().then(function (v) { say("THE HUGGING FACE KEY :: " + keyLine() + (v === "ok" ? "" : "\n  (A SPACE ANSWERS WITHOUT A KEY TOO - MEASURED - SO A SPENT ANONYMOUS QUOTA AND A DEAD KEY LOOK ALIKE UNTIL THE KEY IS CHECKED. /story key again RE-CHECKS AFTER A NEW TOKEN; /story test RENDERS ONE SHORT LINE.)")); });
      return;
    }
    if (verb === "road" || verb === "engine") {
      say(hostLabel() + ((typeof LIA_STORY_BASE !== "undefined" && LIA_STORY_BASE) ? " (HAND-AIMED IN CONFIG)" : " (ITS OWN URL)") + " :: " + BASE + CALL
        + "\n  WHAT IT IS :: " + hostWhat() + "."
        + "\n  THE ROAD " + (road ? road.toUpperCase() : "NOT TRIED YET") + (transport ? " VIA " + (transport === "queue" ? "THE SPACE'S OWN QUEUE" : "THE SHORTCUT CALL") : "") + (keyNote ? "\n  KEY :: " + keyNote : "")
        + "\n  A HUGGING FACE KEY IS " + ((keyring() && keyring().has("huggingface")) ? "HELD" + (keyDown ? " (AND PUT DOWN THIS SESSION - SEE ABOVE)" : "") : "NOT HELD") + " :: " + keyLine()
        + "\n  KNOBS :: " + knobLine()
        + "\n  " + voiceLine()
        + "\n  THE OTHER SPACES :: " + otherHosts() + " - /story space <NAME> SWITCHES. /story test RENDERS ONE SHORT LINE ON THE CURRENT ONE. /story key CHECKS THE HELD TOKEN.");
      return;
    }
    if (verb === "space" || verb === "host") {
      if (!rest) { say("THE STORY LANE RENDERS ON " + hostLabel() + " (" + HOST.id + ") :: " + BASE + "\n  THE OTHERS :: " + otherHosts() + ". /story space <NAME> SWITCHES. A SWITCH TOUCHES NOTHING ALREADY RENDERED - IT APPLIES TO THE NEXT PART."); return; }
      setHost(rest);
      return;
    }
    if (verb === "volume" || verb === "vol") {
      if (!rest) { say("VOLUME " + volume + "."); return; }
      volume = num(rest, volume, 0, 1); if (el) el.volume = volume; save();
      say("VOLUME " + volume + ".");
      return;
    }
    say("USAGE: /story \u00b7 /story on|off \u00b7 /story read <TEXT> \u00b7 /story tell <REQUEST> \u00b7 /story pause \u00b7 /story resume \u00b7 /story stop \u00b7 /story next \u00b7 /story back \u00b7 /story parts \u00b7 /story keep [on|off] \u00b7 /story split <TEXT> \u00b7 /story key \u00b7 /story sample [<ID|NAME> [for <AGENT>|as default]] [off [<AGENT>|default|all]] \u00b7 /story test \u00b7 /story road \u00b7 /story space [<NAME>]");
  }

  function start() {
    ensureEl();
    startTicker();
    load();
  }

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  return {
    load: load, ready: function () { return ready; },
    state: state, summary: summary, describe: describe, report: function (arg) { command(arg); },
    command: command, takeReply: takeReply, arm: arm, isArmed: function () { return armed; },
    read: read, tell: tell, stop: stop, pause: userPause, resume: resume, next: next, back: back, replay: replay,
    // What the rest of the terminal asks: does a story have the room (the bus ducks under it, unasked
    // comments wait, and the check-in does not speak over it)? And the one call to the Space, exposed
    // so the transport can be exercised on its own.
    hasFloor: hasFloor, isSpeaking: hasFloor, isHeld: function () { return !!(current && el && el.paused); },
    parts: function () { return job ? job.parts.map(function (p) { return { i: p.i, state: p.state, seconds: p.seconds, ms: p.ms, chars: p.text.length, error: p.error, note: p.note, vaultId: p.vaultId || "" }; }) : []; },
    text: function () { return job ? job.text : ""; },
    split: split, keep: keepNow, keepPart: keepPart, keepBlock: keepBlock, autoKeep: autoKeep,
    // THE SAMPLES, PER AGENT. `sample()` is the one that speaks for the agent on stage (or the one the
    // story on the line was actually cloned from), `sampleFor(role)` asks about a named agent,
    // `samples()` is the whole table, and `sampleReport()` is the table as the terminal prints it.
    sample: function (roleId) {
      var v = resolveSample(roleId);
      return v.rec ? { id: v.rec.id, name: v.rec.name, bytes: v.rec.bytes, role: v.role, own: v.own } : null;
    },
    sampleFor: function (roleId) {
      var v = resolveSample(roleId);
      return v.rec ? { id: v.rec.id, name: v.rec.name, bytes: v.rec.bytes, role: v.role, own: v.own } : null;
    },
    samples: function () { return writeSamples(); },
    voiceLine: voiceLine, sampleReport: sampleReport,
    setSample: setSample, render: render, setHost: setHost, setKnobs: setKnobs, spaces: spaces,
    setTranscript: setTranscript, transcript: transcript,
    engine: function () {
      return {
        space: HOST.id, host: HOST.label, base: BASE, call: CALL, upload: UPLOAD, maxChars: HOST.maxChars,
        road: road, keyNote: keyNote, keyDown: keyDown, keyVerdict: keyVerdict || "unchecked", refUploaded: !!refPath, chunk: CHUNK,
        samples: writeSamples(), lockedRole: job ? job.role : "", role: roleNow(),
        knobs: { exaggeration: EXAG, temperature: TEMP, cfgWeight: CFGW, vadTrim: VAD, seed: SEED, refDur: REF_DUR }
      };
    }
  };
})();
