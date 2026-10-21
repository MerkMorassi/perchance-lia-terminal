(function () {
  "use strict";

  /* ------------------------------------------------------------------
     ATTACHMENTS - anything Patrikios hands her with a message.

     There are two roads an attachment can take, and the file decides
     which one:

       PICTURES  (an image, the first frame of a video, the pages
                 of a scanned PDF) go into the MEDIA VAULT and reach her
                 the way images always have - the vision model looks at
                 them, so she sees the actual pixels.

       WORDS     (a .txt/.md/.json/... file, a PDF's text, a recording's
                 transcript) are read HERE, on this device, and handed
                 to her in her instruction as a <file> block, so she can
                 read the document itself.

     Nothing is ever uploaded: reading happens in the browser, the
     pictures stay in the vault, and a file that cannot be read is
     still announced by name so she knows he sent it.

     The paperclip in the deck (ATTACH), a paste, and a drop all land
     in add(). Pictures ride in `pics` (vault ids) because the vision
     path in chat.js is keyed on them; everything else rides in `docs`.
     ------------------------------------------------------------------ */
  // How many files of any kind ride on one message. A knob (src/js/config.js, LIA_ATTACH_MAX: 16
  // shipped) rather than a constant here, because this is the number Patrikios tunes when he wants
  // to hand over a whole batch of reference pictures at once. The fallback is deliberately small so
  // that a missing config can never make the terminal take an unbounded number of files.
  var MAX_TOTAL = (function () {
    var n = (typeof LIA_ATTACH_MAX === "number") ? LIA_ATTACH_MAX : 0;
    return (isFinite(n) && n >= 1) ? Math.round(n) : 4;
  })();
  var TEXT_MAX = 6000;      // chars of one document handed to her
  var TEXT_TOTAL = 14000;   // chars of documents in one message
  var PREVIEW_MAX = 240;    // chars shown on the card in the log
  var PDF_MAX_PAGES = 40;   // pages read for text before stopping
  var PDF_SCAN_PAGES = 2;   // pages RENDERED when a PDF carries no text (a scan)
  var VIDEO_FRAMES = 1;     // stills drawn out of a clip: its FIRST frame, nothing more. That one
                            // still is both what she is shown and what the player wears as its
                            // thumbnail. He made the clip himself, so extra frames of it would be
                            // extra pictures he does not need.
  var CLIP_MAX_BYTES = 64 * 1024 * 1024; // a clip bigger than this is not kept in the vault
  var FRAME_MAX_SIDE = 1024;
  var PDF_LIB = "https://esm.sh/pdfjs-dist@4.10.38";
  var PDF_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  var pics = [];   // vault ids: attached images, a clip's first frame, rendered PDF pages
  var videos = []; // vault ids: the clips themselves (playable in the log)
  var docs = [];   // read/noted files: { kind, name, mime, bytes, text, preview, note, pages, duration }
  var seq = 0;
  // PICTURES THAT WERE ALREADY IN THE VAULT. Everything above arrives here as a FILE and is put into
  // the vault by this module; `carry()` is the other direction - a record that is already here (a
  // render of hers, a picture he kept, anything the gallery holds) is put ON THE MESSAGE. Those are
  // only RIDING ALONG, so the strip's x takes one off the message and NEVER out of the vault: the
  // delete-on-remove below is right for a file that was only ever here for this message, and wrong
  // for his own picture. This is the one difference between the two, and it is on purpose.
  var carried = {};   // vault id -> true : on this message, out of the vault (never deleted by the strip)

  function el(id) { return document.getElementById(id); }

  function extOf(name) {
    var m = String(name || "").match(/\.([A-Za-z0-9]+)$/);
    return m ? m[1].toLowerCase() : "";
  }

  // THE BAR (src/js/progress.js). Drawing the stills a clip is read as is genuinely slow - the video
  // is seeked and decoded once per frame, and a decoder can take a second over a seek - and it has a
  // real count to give (`ts.length`), so this is the one place in this file where the rail shows a
  // fraction. Its own id ("clip-frames"): a clip read during a /tools sweep must not take over the
  // sweep's own count, and the sweep's count must not eat this one's - the higher priority wins, and
  // the sweep's job is priority 1 while this is 0.
  function pbar(label, total) {
    try {
      if (window.progress) return window.progress.begin(label, {
        id: "clip-frames", total: total, priority: 0,
        detail: "sampling the stills a clip is read as - the frames are drawn, read and thrown away",
      });
    } catch (e) {}
    return null;
  }
  function pbarDone() {
    try { if (window.progress) window.progress.finish("clip-frames"); } catch (e) {}
  }

  // One place decides what a file IS. The mime type wins where it is definite, the extension
  // is the fallback (browsers are often vague about picked files).
  function kindOf(file) {
    var name = String((file && file.name) || "");
    var mime = String((file && file.type) || "").toLowerCase();
    var ext = extOf(name);
    if (ext === "svg" || mime === "image/svg+xml") return "text";   // drawable as a picture only sometimes - read it as markup
    if (/^image\//.test(mime) || /^(png|jpe?g|gif|webp|bmp|avif|heic|heif|tiff?)$/.test(ext)) return "image";
    if (/^video\//.test(mime) || /^(mp4|m4v|mov|webm|ogv|mkv|avi)$/.test(ext)) return "video";
    if (/^audio\//.test(mime) || /^(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/.test(ext)) return "audio";
    if (mime === "application/pdf" || ext === "pdf") return "pdf";
    if (/^(txt|md|markdown|mdown|text|log|csv|tsv|json|jsonl|ndjson|ya?ml|xml|html?|xhtml|css|scss|less|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|c|h|cc|cpp|hpp|java|kt|swift|php|pl|lua|r|sql|sh|bash|zsh|bat|ps1|ini|cfg|conf|env|toml|tex|bib|srt|vtt|diff|patch)$/.test(ext)) return "text";
    if (/^text\//.test(mime) || /(json|xml|javascript|ecmascript|csv|yaml|x-sh|x-httpd-php|rtf)/.test(mime)) return "text";
    return "file";
  }

  function labelFor(kind) {
    return ({ image: "IMG", video: "VID", audio: "AUD", pdf: "PDF", text: "TXT", file: "FILE" })[kind] || "FILE";
  }

  function bytesOf(file) { return Number((file && file.size) || 0); }

  function readText(file) {
    if (file && file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(fr.error || new Error("unreadable")); };
      fr.readAsText(file);
    });
  }

  /* ---- PDF: the words, or the pages ---------------------------------------- */
  // pdf.js is loaded on first use and its worker is served from a blob URL - a Worker cannot be
  // created from a cross-origin URL, and the classic workaround is to fetch the worker's text and
  // hand the browser a same-origin (blob:) copy of it.
  var pdfLibPromise = null;
  function pdfLib() {
    if (!pdfLibPromise) {
      pdfLibPromise = (async function () {
        var lib = await import(PDF_LIB);
        try {
          var src = await fetch(PDF_WORKER).then(function (r) { return r.text(); });
          lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        } catch (e) { console.warn("pdf worker unavailable - pdf.js will try its own fallback", e); }
        return lib;
      })().catch(function (e) { pdfLibPromise = null; throw e; });
    }
    return pdfLibPromise;
  }

  function canvasBlob(canvas, quality) {
    return new Promise(function (resolve) { canvas.toBlob(function (b) { resolve(b || null); }, "image/jpeg", quality == null ? 0.9 : quality); });
  }

  // Reads what text the PDF actually carries. Most PDFs do; a scanned one does not, and says so.
  async function pdfText(pdf, pageCap) {
    var pages = Math.min(pdf.numPages, pageCap);
    var parts = [], empty = 0;
    for (var p = 1; p <= pages; p++) {
      try {
        var page = await pdf.getPage(p);
        var tc = await page.getTextContent();
        var t = tc.items.map(function (it) { return it.str; }).join(" ").replace(/\s+/g, " ").trim();
        if (t) parts.push("[page " + p + "] " + t); else empty++;
      } catch (e) { empty++; }
    }
    return { text: parts.join("\n\n"), pages: pdf.numPages, read: pages, empty: empty };
  }

  // A scanned PDF has pages but no text layer: the honest way to show her one is to show her the
  // page itself, so it is rendered and goes down the PICTURE road.
  async function pdfPagesToPictures(pdf, count) {
    var out = [];
    var n = Math.min(pdf.numPages, count);
    for (var p = 1; p <= n; p++) {
      try {
        var page = await pdf.getPage(p);
        var base = page.getViewport({ scale: 1 });
        var scale = Math.min(2, FRAME_MAX_SIDE / Math.max(base.width, base.height));
        var vp = page.getViewport({ scale: scale });
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(vp.width));
        canvas.height = Math.max(1, Math.round(vp.height));
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas: canvas, canvasContext: ctx, viewport: vp }).promise;
        var blob = await canvasBlob(canvas, 0.9);
        if (blob) out.push({ blob: blob, w: canvas.width, h: canvas.height, page: p });
      } catch (e) { console.warn("pdf page render failed", e); }
    }
    return out;
  }

  /* ---- VIDEO: the first frame, and the clip itself -------------------------- */
  // One still out of a clip: the very first frame, drawn as soon as the browser has decoded
  // enough of the file to draw anything. It is the clip's thumbnail and the only picture of it
  // that goes to her - the clip is kept whole beside it (see takeVideo), untouched.
  //
  // Media loading inside a hidden document can be suspended by the browser, and a video that
  // never hands over its metadata would otherwise hang the whole message - so there is a
  // watchdog: whatever happens, this answers.
  function videoFirstFrame(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var video = document.createElement("video");
      var done = false, drew = false;
      var dur = 0, w = 0, h = 0;
      var forceTimers = [];
      // A hidden document is not allowed to fetch video by the browser, and waiting the full
      // fifteen seconds to be told that is a poor trade: when the tab is in the background the
      // answer comes back quickly, the master is still kept whole, and the tile still stands
      // with its play button on it. When the tab is in front, the full wait is there for a big
      // file being read off a slow disk.
      var watchdog = setTimeout(function () {
        finish({ frame: null, duration: dur, w: w, h: h, error: document.hidden
          ? "a browser will not read video while its tab is in the background, so the still could not be drawn"
          : "the clip did not load here in time, so the still could not be drawn" });
      }, document.hidden ? 1500 : 15000);
      var cleanup = function () {
        try {
          clearTimeout(watchdog);
          forceTimers.forEach(clearTimeout);
          URL.revokeObjectURL(url);
          video.removeAttribute("src");
          video.load();
        } catch (e) {}
      };
      var finish = function (val) { if (done) return; done = true; cleanup(); resolve(val); };

      function grab() {
        if (drew || done) return;
        try {
          var vw = video.videoWidth || w, vh = video.videoHeight || h;
          if (!vw || !vh || video.readyState < 2) return; // nothing decoded yet - a later event retries
          var scale = Math.min(1, FRAME_MAX_SIDE / Math.max(vw, vh));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(vw * scale));
          canvas.height = Math.max(1, Math.round(vh * scale));
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          drew = true;
          canvasBlob(canvas, 0.9).then(function (blob) {
            finish({ frame: blob ? { blob: blob, w: canvas.width, h: canvas.height } : null, duration: dur, w: vw, h: vh });
          });
        } catch (e) {
          finish({ frame: null, duration: dur, w: w, h: h, error: String((e && e.message) ? e.message : e) });
        }
      }

      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.onerror = function () { finish({ frame: null, duration: dur, w: w, h: h, error: "the browser cannot decode this video" }); };
      video.onloadedmetadata = function () {
        dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
        w = video.videoWidth || 0; h = video.videoHeight || 0;
      };
      // `loadeddata` means the first frame is there to be drawn, and that is the path. The others
      // are second chances: decoders differ over what they hand over and when, and a browser can
      // leave a video sitting on readyState 1 until it is asked for something. So if nothing has
      // been drawn a moment after the metadata arrives, the element is asked - MUTED - to play,
      // its opening frame is taken, and it is put straight back to rest.
      video.onloadeddata = function () { grab(); };
      video.oncanplay = function () { grab(); };
      video.onseeked = function () { grab(); };
      function force() {
        if (drew || done) return;
        try {
          video.muted = true;
          var p = video.play();
          if (p && p.then) {
            p.then(function () { grab(); try { video.pause(); } catch (e) {} }).catch(function () {});
          }
        } catch (e) {}
      }
      forceTimers.push(setTimeout(force, 1600), setTimeout(force, 5000));
      video.src = url;
    });
  }

  function audioDuration(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var a = document.createElement("audio");
      var done = false;
      var finish = function (val) { if (done) return; done = true; URL.revokeObjectURL(url); resolve(val); };
      var to = setTimeout(function () { finish(0); }, 6000);
      a.preload = "metadata";
      a.onloadedmetadata = function () { clearTimeout(to); finish((isFinite(a.duration) && a.duration > 0) ? a.duration : 0); };
      a.onerror = function () { clearTimeout(to); finish(0); };
      a.src = url;
    });
  }

  /* ---- AUDIO: listen to it, if there is an ear to listen with --------------- */
  // Speech-to-text is not something a browser does to a file, so this asks a service the user
  // already holds a key for. ElevenLabs first (its scribe model), Whisper on Hugging Face
  // second. Without a key the recording is still attached and announced - it simply cannot be
  // heard here, and the terminal says exactly that rather than pretending.
  async function transcribe(file, mime) {
    var kr = window.keyring;
    var problems = [];
    var policy = "";
    // The type the service is told. A file can arrive with no browser-reported type at all (see
    // mimeFor in src/js/vault.js), and FormData sends an untyped part as application/octet-stream,
    // which the service may refuse outright - so the bytes are handed over under the resolved type
    // instead of the browser's silence. Nothing is re-encoded: this is a view of the same bytes.
    var type = window.media.mimeFor(file, file.name, mime);
    function note(label, e) {
      var msg = String((e && e.message) ? e.message : e);
      if (kr && kr.scrub) msg = kr.scrub(msg, label === "ELEVENLABS" ? "elevenlabs" : (label === "GOOGLE" ? "google" : "huggingface"));
      problems.push(label + ": " + msg);
    }
    // THE GOOGLE (GEMINI) ROAD COMES FIRST (src/js/hear.js). It is the one key this terminal already
    // runs its eyes and its ears on, so a recording handed over here is read with the key he is most
    // likely to be holding - the words come back in one call, from a mono reduction made HERE on
    // this device, and the two services below are exactly what they always were: the fallback.
    // A REFUSAL, AND WHAT "NOT STEPPED OVER" MEANS HERE. Inside the hearing lane a refusal stops the
    // pass dead - offering the same words to the next model would be shopping for permission. This
    // ladder is different, and the difference is deliberate: these are three speech-to-text services
    // HE holds keys for, and the SAME BYTES are offered to the next one - nothing is rewritten,
    // shortened or softened for anybody. What is never allowed is silence about it: the reason
    // travels back with the words and is printed in the receipt, so the log says which road would
    // not read it and which one did.
    if (window.hear && window.hear.text && kr && kr.has && kr.has("google")) {
      try {
        var g = await window.hear.text(file, type, file.name || "recording");
        if (g && g.text) return { text: g.text, engine: g.engine, policy: g.policy || "" };
        if (g && g.error) {
          if (g.policy) policy = String(g.policy);
          problems.push("GOOGLE: " + String(g.error));
        }
      } catch (e) { note("GOOGLE", e); }
    }
    if (kr && kr.has && kr.has("elevenlabs")) {
      try {
        var fd = new FormData();
        fd.append("file", new Blob([file], { type: type }), file.name || ("recording." + window.media.extFor(type, file.name)));
        fd.append("model_id", "scribe_v1");
        var res = await kr.request("elevenlabs", "https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", body: fd });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var data = await res.json();
        var text = data && (data.text || data.transcript);
        if (text && String(text).trim()) return { text: String(text).trim(), engine: "ELEVENLABS SCRIBE", policy: policy };
        throw new Error("the service returned no words");
      } catch (e) { note("ELEVENLABS", e); }
    }
    if (kr && kr.has && kr.has("huggingface")) {
      try {
        var res2 = await kr.request("huggingface", "https://api-inference.huggingface.co/models/openai/whisper-large-v3", {
          method: "POST", headers: { "Content-Type": type }, body: file
        });
        if (!res2.ok) throw new Error("HTTP " + res2.status);
        var d2 = await res2.json();
        var t2 = (d2 && (d2.text || (Array.isArray(d2) && d2[0] && d2[0].text))) || "";
        if (t2 && String(t2).trim()) return { text: String(t2).trim(), engine: "WHISPER (HUGGING FACE)", policy: policy };
        throw new Error("the service returned no words");
      } catch (e) { note("HUGGING FACE", e); }
    }
    return {
      error: (kr && kr.bypassed && (kr.bypassed("google") || kr.bypassed("elevenlabs")) && !problems.length)
        ? "SPEECH-TO-TEXT IS BYPASSED IN THE KEYS PANEL (GOOGLE/ELEVENLABS SUPPRESSED) - UNCHECK THE BYPASS TO LET IT THROUGH"
        : (problems.length ? problems.join(" / ") : "NO SPEECH-TO-TEXT KEY IS HELD (THE KEYS PANEL CAN TAKE A GOOGLE AI, ELEVENLABS OR HUGGING FACE KEY)"),
      policy: policy,
    };
  }

  /* ---- taking files in ------------------------------------------------------ */
  function total() { return pics.length + videos.length + docs.length; }
  function room() { return MAX_TOTAL - total(); }

  function clip(text, cap) {
    text = String(text == null ? "" : text);
    if (text.length <= cap) return { text: text, truncated: false };
    return { text: text.slice(0, cap), truncated: true };
  }

  function addDoc(doc) {
    doc.id = "a" + (++seq) + "-" + Date.now().toString(36);
    doc.bytes = doc.bytes || 0;
    doc.mime = doc.mime || "";
    if (!doc.preview) doc.preview = String(doc.text || doc.note || "").replace(/\s+/g, " ").slice(0, PREVIEW_MAX);
    docs.push(doc);
    return doc;
  }

  async function takeImage(file, name) {
    var norm = await window.media.normalize(file);
    var id = await window.media.add(norm.blob, { name: name || file.name || "attached.jpg", w: norm.w, h: norm.h, kind: "attach" });
    pics.push(id);
    return { id: id, w: norm.w, h: norm.h };
  }

  /* What a clip is to her. One still - its first frame - reaches her through the vision model,
     and she is told plainly that it is the OPENING of a moving thing: the moment the clip starts,
     with everything after it not in front of her. That is the honest position: she is not told she
     watched a film when she did not, and she is not left thinking a single frame is the whole of
     it. The clip itself is kept whole beside the still, and she is told so - it is his master. */
  function videoNote(res, kept) {
    var dur = res.duration || 0;
    var len = dur ? ", " + dur.toFixed(1) + "s long" : " (its length is not readable here)";
    var master = kept
      ? " The clip itself is kept whole in the vault as the master file - exactly the file he handed over - so it can be played and saved untrimmed."
      : " The clip itself is too large for the vault, so only this still of it is held here.";
    if (res.error) return "a video clip" + len + ": " + res.error + ", so no still of it is in front of you." + master;
    if (!res.frame) return "a video clip" + len + ". Its first frame could not be drawn here, so no still of it is in front of you." + master;
    return "a video clip" + len + ". You are shown its FIRST frame - the still the clip opens on, and the only picture of it there is."
      + " Everything after that moment is not in front of you: read the still as the opening of a moving thing, not as the whole of it." + master;
  }

  // ONE CLIP INTO THE VAULT - the shared road. Everything that can take a video file comes through
  // here: a file attached to a message (takeVideo, below) and a file imported into the gallery
  // (gallery.js importFiles). `opts.room` says whether the MESSAGE's attach limit applies (a clip on
  // a message can crowd it out; an import into the vault is not on a message and is not capped by it),
  // `opts.folder` files the master somewhere other than its default, and `opts.quiet` keeps the
  // per-file lines off the stage for a caller that reports in its own words.
  async function keepClip(file, opts) {
    opts = opts || {};
    var quiet = !!opts.quiet;
    var res = await videoFirstFrame(file);
    var dur = res.duration || 0;
    var base = (file.name || "clip.mp4").replace(/\.[A-Za-z0-9]+$/, "");
    var poster = "";
    var willKeep = (file.size || 0) <= CLIP_MAX_BYTES;
    var note = videoNote(res, willKeep);

    // The one still: the clip's first frame. It is the thumbnail the player wears, and it is the
    // picture that goes to her eyes - the same frame doing both jobs, so a clip costs one picture.
    if (res.frame && (opts.room === false || room() > 0)) {
      try {
        poster = await window.media.add(res.frame.blob, {
          name: base + " \u00b7 first frame.jpg", w: res.frame.w, h: res.frame.h, kind: "attach",
        });
      } catch (e) {
        if (!quiet) print("SYSTEM", "THE FIRST FRAME COULD NOT BE KEPT :: " + String((e && e.message) ? e.message : e).toUpperCase());
      }
    }

    // The clip ITSELF is kept, so it can be played in the log and saved, not only remembered as a
    // still. It is stored byte for byte - the very File that arrived, never re-encoded, never
    // trimmed, never uploaded (the vault is IndexedDB): his master, held as the master. Keeping it
    // does not depend on the frame: even if this browser cannot draw a still from it, the file is
    // his, and the first frame is stored on the record as the player's thumbnail when it exists.
    var kept = false, vidId = "";
    if (willKeep) {
      try {
        var vidMeta = {
          name: file.name || "clip.mp4", mime: window.media.mimeFor(file, file.name), bytes: bytesOf(file),
          w: res.w || 0, h: res.h || 0, kind: "video", duration: dur, note: note, poster: poster,
        };
        if (opts.folder) vidMeta.folder = opts.folder;
        vidId = await window.media.add(file, vidMeta);
        kept = true;
      } catch (e) {
        if (!quiet) print("SYSTEM", "THE CLIP COULD NOT BE KEPT IN THE VAULT :: " + String((e && e.message) ? e.message : e).toUpperCase());
      }
    } else if (!quiet) {
      print("SYSTEM", "THE CLIP IS LARGER THAN " + fmtSize(CLIP_MAX_BYTES) + " :: THE MASTER IS TOO BIG FOR THE VAULT - ONLY ITS FIRST FRAME IS KEPT. SAVE IT FROM DISK WHEN YOU WANT A COPY OF THE CLIP ITSELF.");
    }
    return { id: vidId, poster: poster, kept: kept, tooBig: !willKeep, duration: dur, w: res.w || 0, h: res.h || 0, error: res.error || "" };
  }

  // SAMPLED FRAMES OUT OF A CLIP (2026-09-23). PATRIKIOS: "she needs the aggregated impression then
  // decide the final verdict of the action. Clips rarely exceed 10s. 24 frames per second. So 10
  // seconds means 240 frames if she is scanning at that max frame rate. She doesn't need to. We can
  // dial in the optimal to get the gist of the clip provided." So a clip is read as a HANDFUL of
  // stills spread evenly from its opening to its end - `count` of them, never every frame. NOTHING IS
  // STORED: each frame is drawn to a canvas, read once, and thrown away, so the clip's own poster
  // stays the only still of it that exists (these frames are not records, not gallery items, and
  // never queue for her eyes). What comes back is the frames in order, each with the time inside the
  // clip it was taken at.
  function sampleFrames(file, opts) {
    opts = opts || {};
    var count = Math.max(1, Math.min(24, Math.round(opts.count || 6)));
    var maxSide = opts.maxSide || FRAME_MAX_SIDE;
    return new Promise(function (resolve) {
      var url = null;
      try { url = URL.createObjectURL(file); } catch (e) { resolve({ frames: [], duration: 0, w: 0, h: 0, error: "the file could not be opened" }); return; }
      var video = document.createElement("video");
      video.preload = "auto"; video.muted = true; video.playsInline = true;
      var frames = [], dur = 0, vw = 0, vh = 0, done = false, timers = [];
      var P = null;   // the rail's claim, opened when the clip's frame times are known (see begin)
      var cleanup = function () {
        try { timers.forEach(clearTimeout); URL.revokeObjectURL(url); video.removeAttribute("src"); video.load(); } catch (e) {}
      };
      var finish = function (error) { if (done) return; done = true; cleanup(); pbarDone(); resolve({ frames: frames, duration: dur, w: vw, h: vh, error: error || "" }); };
      // Whatever happens this answers: a decoder that never hands over a frame must not hang the turn.
      var watchdog = setTimeout(function () {
        finish(frames.length ? "" : (document.hidden
          ? "a browser will not read video while its tab is in the background, so no frame could be drawn"
          : "the clip did not load here in time, so no frame could be drawn"));
      }, document.hidden ? 3000 : 45000);

      function shot() {
        var w = video.videoWidth || vw, h = video.videoHeight || vh;
        if (!w || !h || video.readyState < 2) return null;
        var scale = Math.min(1, maxSide / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        try { c.getContext("2d").drawImage(video, 0, 0, c.width, c.height); } catch (e) { return null; }
        return c;
      }

      function targets() {
        var last = (dur && isFinite(dur)) ? Math.max(0, dur - Math.min(0.06, dur * 0.02)) : 0;
        if (count <= 1 || !last) return [0];
        var out = [];
        for (var i = 0; i < count; i++) out.push((last * i) / (count - 1));
        return out;
      }

      var ts = null;
      var step = function (i) {
        if (done) return;
        if (!ts || i >= ts.length) { finish(""); return; }
        if (P) P.set(i);
        var t = ts[i];
        var settled = false;
        var next = function () {
          if (settled || done) return;
          settled = true;
          try { video.removeEventListener("seeked", next); } catch (e) {}
          var c = shot();
          if (!c) { step(i + 1); return; }
          canvasBlob(c, 0.85).then(function (blob) {
            if (blob) frames.push({ blob: blob, at: t, w: c.width, h: c.height });
            step(i + 1);
          }).catch(function () { step(i + 1); });
        };
        video.addEventListener("seeked", next);
        // A decoder that never reports a seek must not stop the frames after it.
        timers.push(setTimeout(next, 4000));
        try {
          if (Math.abs((video.currentTime || 0) - t) < 0.02) next();
          else video.currentTime = t;
        } catch (e) { next(); }
      };

      var started = false;
      var begin = function () {
        if (started || done) return;
        started = true;
        vw = video.videoWidth || vw; vh = video.videoHeight || vh;
        dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
        ts = targets();
        P = pbar("READING THE CLIP", ts.length);
        step(0);
      };
      video.onerror = function () { finish("the browser cannot decode this video"); };
      video.onloadedmetadata = function () {
        dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
        vw = video.videoWidth || 0; vh = video.videoHeight || 0;
      };
      video.onloadeddata = function () { begin(); };
      video.oncanplay = function () { begin(); };
      // Second chances, as videoFirstFrame has: a browser can leave a clip sitting on readyState 1
      // until it is asked for something, so the element is asked - MUTED - to play, and the frames are
      // taken while it runs.
      function force() {
        if (started || done) return;
        try {
          video.muted = true;
          var p = video.play();
          if (p && p.then) p.then(function () { begin(); try { video.pause(); } catch (e) {} }).catch(function () {});
        } catch (e) {}
      }
      timers.push(setTimeout(force, 1600), setTimeout(function () { if (!started) begin(); }, 5000));
      video.src = url;
    });
  }

  async function takeVideo(file) {
    print("SYSTEM", "READING VIDEO :: " + (file.name || "clip") + " ...");
    var out = await keepClip(file, { room: true });
    if (out.poster) pics.push(out.poster);
    if (out.kept) videos.push(out.id);
    // The note she is given is written on the record (videoNote, in keepClip) - a clip reaches her
    // as its FIRST FRAME, told plainly that it is the opening of a moving thing.
    var durTxt = out.duration ? " \u00b7 " + out.duration.toFixed(1) + "s" : "";
    print("SYSTEM", "VIDEO ATTACHED :: " + (file.name || "video") + durTxt
      + (out.kept ? " :: THE MASTER IS HELD IN THE VAULT, UNTOUCHED - PLAYABLE AND SAVEABLE HERE" : " :: THE CLIP ITSELF COULD NOT BE KEPT")
      + (out.poster ? " :: ITS FIRST FRAME IS THE THUMBNAIL AND WHAT SHE IS SHOWN" : " :: NO FRAME COULD BE DRAWN"));
  }

  async function takePdf(file) {
    print("SYSTEM", "READING PDF :: " + file.name + " ...");
    var pdfjs = await pdfLib();
    var data = new Uint8Array(await file.arrayBuffer());
    var pdf = await pdfjs.getDocument({ data: data, isEvalSupported: false }).promise;
    var read = await pdfText(pdf, PDF_MAX_PAGES);
    if (read.text.replace(/\[page \d+\]/g, "").trim().length >= 40) {
      var c = clip(read.text, Math.min(TEXT_MAX, roomText()));
      var note = read.pages + " page" + (read.pages === 1 ? "" : "s") + (read.read < read.pages ? ", first " + read.read + " read" : "") + (read.empty ? ", " + read.empty + " with no text" : "");
      addDoc({ kind: "pdf", name: file.name || "document.pdf", mime: file.type || "application/pdf", bytes: bytesOf(file), text: c.text, truncated: c.truncated, pages: read.pages, note: note });
      print("SYSTEM", "PDF ATTACHED :: " + (file.name || "document.pdf") + " :: " + note.toUpperCase() + " READ" + (c.truncated ? " (TRIMMED)" : "") + " :: SHE CAN READ IT.");
      return;
    }
    // No text layer: the pages are shown to her instead.
    var pages = await pdfPagesToPictures(pdf, Math.max(1, Math.min(PDF_SCAN_PAGES, room() || 1)));
    for (var i = 0; i < pages.length; i++) {
      var nm = (file.name || "document.pdf").replace(/\.pdf$/i, "") + " \u00b7 page " + pages[i].page + ".jpg";
      var id = await window.media.add(pages[i].blob, { name: nm, w: pages[i].w, h: pages[i].h, kind: "attach" });
      pics.push(id);
    }
    addDoc({ kind: "pdf", name: file.name || "document.pdf", mime: file.type || "application/pdf", bytes: bytesOf(file), pages: read.pages, note: "a scan with no text layer; " + (pages.length ? "the first " + pages.length + " page" + (pages.length === 1 ? "" : "s") + " " + (pages.length === 1 ? "is" : "are") + " shown above" : "no page could be rendered") });
    print("SYSTEM", "PDF ATTACHED :: " + (file.name || "document.pdf") + " :: NO TEXT LAYER" + (pages.length ? " :: " + pages.length + " PAGE" + (pages.length === 1 ? "" : "S") + " GOING TO HER EYES" : " :: NOTHING COULD BE RENDERED") + ".");
  }

  async function takeAudio(file) {
    print("SYSTEM", "READING AUDIO :: " + file.name + " ...");
    var dur = await audioDuration(file);
    var durTxt = dur ? " \u00b7 " + dur.toFixed(1) + "s" : "";
    // WHAT THIS FILE IS. A browser does not always report a type for a recording it was handed (an
    // mp3 or wav dragged out of a file manager arrives as `type: ""`), so the mime is RESOLVED -
    // from the file, then from its name - before anything is stored or told. Unresolved, a
    // recording defaulted to image/jpeg and became a "picture": filed in /images, offered to her
    // eyes, and the vision call threw on it (see mimeFor in src/js/vault.js).
    var mime = window.media.mimeFor(file, file.name);
    // A RECORDING IS MEDIA, SO IT IS KEPT. The words are read out of it either way, but the file
    // itself is what the vault is for: it is stored byte for byte, it lands in /music, it plays on
    // its own full stage, and IT IS NEVER UPLOADED. (A transcript is a document; this is the thing.)
    var audioKept = false, keptId = "";
    if ((file.size || 0) <= CLIP_MAX_BYTES) {
      try {
        keptId = await window.media.add(file, {
          name: file.name || "recording", mime: mime, bytes: bytesOf(file),
          kind: "attach", duration: dur, note: "the recording itself, kept whole" + durTxt,
        });
        audioKept = true;
      } catch (err) {
        print("SYSTEM", "THE RECORDING COULD NOT BE KEPT IN THE VAULT :: " + String((err && err.message) ? err.message : err).toUpperCase());
      }
    } else {
      print("SYSTEM", "THE RECORDING IS LARGER THAN " + fmtSize(CLIP_MAX_BYTES) + " :: IT IS NOT KEPT IN THE VAULT - ONLY ITS WORDS. SAVE IT FROM DISK WHEN YOU WANT A COPY.");
    }
    var keptTxt = audioKept ? " :: KEPT WHOLE IN THE VAULT - PLAY IT FROM THE GALLERY (MUSIC) OR ITS FULL STAGE" : "";
    var heard = await transcribe(file, mime);
    // WHAT IT SAID IS KEPT ON THE RECORD TOO (src/js/hear.js). The document below is what SHE is
    // handed; this is what the VAULT knows about the file - so a recording in the vault carries its
    // own words, its full stage shows them, and /gallery vox counts it. One field, the same shape
    // the /hear words lane writes, whether the words came from Google, ElevenLabs or Whisper.
    async function keepWords(engine, text) {
      if (!keptId || !text) return;
      try {
        await window.media.setField(keptId, "transcript", {
          text: String(text), speech: true, engine: engine,
          seconds: dur || 0, total: dur || 0, ts: Date.now(),
          note: "transcribed when it was handed over (" + engine + ")",
        });
      } catch (e) { console.warn("the transcript could not be written on the record", e); }
    }
    if (heard && heard.text) {
      var c = clip(heard.text, Math.min(TEXT_MAX, roomText()));
      addDoc({ kind: "audio", name: file.name || "recording", mime: mime, bytes: bytesOf(file), text: c.text, truncated: c.truncated, duration: dur, note: "transcribed with " + heard.engine + durTxt });
      await keepWords(heard.engine, heard.text);
      print("SYSTEM", "AUDIO ATTACHED :: " + (file.name || "recording") + durTxt + " :: TRANSCRIBED (" + heard.engine + ")" + (c.truncated ? " (TRIMMED)" : "") + " :: SHE CAN READ IT." + keptTxt
        + (heard.policy ? "\nGEMINI WOULD NOT READ IT (" + String(heard.policy).toUpperCase() + ") :: THE WORDS CAME FROM " + heard.engine + " INSTEAD. THAT REFUSAL IS REPORTED, NOT WORKED AROUND - NOTHING WAS REWRITTEN." : ""));
      return;
    }
    addDoc({ kind: "audio", name: file.name || "recording", mime: mime, bytes: bytesOf(file), duration: dur, note: "could not be transcribed here - " + (heard.error || "no speech-to-text key is held") + durTxt });
    print("SYSTEM", "AUDIO ATTACHED :: " + (file.name || "recording") + durTxt + " :: COULD NOT BE TRANSCRIBED :: " + (heard.error || "NO SPEECH-TO-TEXT KEY IS HELD")
      + (heard.policy ? "\nGEMINI STOPPED FOR " + String(heard.policy).toUpperCase() + " - AND NOTHING WAS REWRITTEN TO GET PAST IT." : "")
      + "\nSHE IS TOLD A RECORDING ARRIVED, BUT NOT WHAT IS IN IT." + keptTxt);
  }

  async function takeText(file, kind) {
    var text = await readText(file);
    var cap = Math.min(TEXT_MAX, roomText());
    var c = clip(text, cap);
    var ext = extOf(file.name);
    addDoc({ kind: "text", subtype: ext || kind, name: file.name || "document.txt", mime: file.type || "text/plain", bytes: bytesOf(file), text: c.text, truncated: c.truncated });
    print("SYSTEM", "FILE ATTACHED :: " + (file.name || "document") + " (" + (ext || "text").toUpperCase() + ", " + fmtSize(bytesOf(file)) + ") :: " + text.length + " CHARS READ" + (c.truncated ? " (TRIMMED TO " + cap + ")" : "") + " :: SHE CAN READ IT.");
  }

  function roomText() {
    var used = 0;
    docs.forEach(function (d) { used += (d.text || "").length; });
    return Math.max(600, TEXT_TOTAL - used);
  }

  // The one door everything comes through: the paperclip picker, a paste, a drop.
  async function add(files) {
    var list = Array.prototype.slice.call(files || []).filter(Boolean);
    if (!list.length) return;
    if (!window.media) { print("SYSTEM", "MEDIA VAULT OFFLINE."); return; }
    await window.media.ensure();
    // THE BAR (src/js/progress.js): only when there is more than one file. A single picture is read
    // and kept in a moment and a rail that flashed for it would be noise; a dropped folder, a message
    // with six files on it, or a handful of clips is real work, one file at a time.
    var P = null;
    if (list.length > 1) {
      try {
        if (window.progress) P = window.progress.begin("ATTACHING FILES", { id: "attach", total: list.length, detail: "read here on this device - the files themselves stay here" });
      } catch (e) {}
    }
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (P) P.set(i + 1);
      if (room() <= 0) {
        var refused = list.slice(i).map(function (f) { return String((f && f.name) || "a file"); });
        var refusedText = refused.join(", ");
        print("SYSTEM", "ATTACH LIMIT REACHED (" + MAX_TOTAL + " PER MESSAGE) :: " + refused.length + " FILE" + (refused.length === 1 ? "" : "S")
          + " NOT TAKEN - " + (refusedText.length > 220 ? refusedText.slice(0, 220) + "\u2026" : refusedText)
          + "\nWHAT DID COME THROUGH IS IN THE STRIP ABOVE THE BOX. SEND WHEN YOU ARE READY, THEN ATTACH THE REST IN ANOTHER MESSAGE."
          + "\nTHE LIMIT IS LIA_ATTACH_MAX IN src/js/config.js.");
        break;
      }
      var kind = kindOf(file);
      try {
        if (kind === "image") {
          var im = await takeImage(file);
          print("SYSTEM", "IMAGE ATTACHED :: " + (file.name || "pasted image") + " (" + im.w + "\u00d7" + im.h + ", " + fmtSize(bytesOf(file)) + ")");
        } else if (kind === "video") {
          await takeVideo(file);
        } else if (kind === "audio") {
          await takeAudio(file);
        } else if (kind === "pdf") {
          await takePdf(file);
        } else if (kind === "text") {
          await takeText(file);
        } else {
          addDoc({ kind: "file", name: file.name || "file", mime: file.type || "", bytes: bytesOf(file), note: "this file type cannot be read here" });
          print("SYSTEM", "FILE ATTACHED :: " + (file.name || "file") + " (" + fmtSize(bytesOf(file)) + ") :: THIS TYPE CANNOT BE READ HERE - SHE IS TOLD IT ARRIVED, BUT NOT WHAT IS IN IT.");
        }
      } catch (e) {
        print("SYSTEM", "FILE REJECTED :: " + (file.name || "file") + " :: " + String((e && e.message) ? e.message : e).toUpperCase());
      }
    }
    if (P) { try { P.finish(); } catch (e) {} }
    renderStrip();
  }

  /* ---- what is riding along right now -------------------------------------- */

  // A record that is ALREADY in the vault, put on this message. No copy, no second record, nothing
  // re-encoded and nothing written: the picture he is looking at in the gallery IS the picture that
  // rides along. `carry` is idempotent (a picture already on the message is not taken twice) and it
  // honours the same ATTACH limit as everything else, so one message can never carry more than
  // LIA_ATTACH_MAX things however they got there.
  function carry(ids) {
    var took = [], refused = [];
    (ids || []).forEach(function (id) {
      if (!id) return;
      if (!window.media || !window.media.get || !window.media.get(id)) { refused.push(id); return; }
      if (pics.indexOf(id) !== -1) { took.push(id); return; }
      if (room() <= 0) { refused.push(id); return; }
      pics.push(id);
      carried[id] = true;
      took.push(id);
    });
    renderStrip();
    return { took: took, refused: refused };
  }

  function isCarried(id) { return !!(id && carried[id]); }

  function removeImage(id) {
    pics = pics.filter(function (p) { return p !== id; });
    videos = videos.filter(function (v) { return v !== id; });
    delete carried[id];
  }
  function removeVideo(id) { videos = videos.filter(function (v) { return v !== id; }); }
  function removeDoc(id) { docs = docs.filter(function (d) { return d.id !== id; }); }

  function clear() { pics = []; videos = []; docs = []; carried = {}; renderStrip(); }

  function images() { return pics.slice(); }
  function videoIds() { return videos.slice(); }

  function videoItem(id) {
    var rec = window.media ? window.media.get(id) : null;
    return {
      kind: "video", id: id, name: rec ? rec.name : "clip",
      mime: rec ? rec.mime : "", bytes: rec ? rec.bytes : 0,
      duration: rec ? (rec.duration || 0) : 0, note: rec ? (rec.note || "") : "",
      poster: rec ? (rec.poster || "") : "",
    };
  }

  function items() {
    var out = [];
    pics.forEach(function (id) {
      var rec = window.media ? window.media.get(id) : null;
      out.push({ kind: "image", id: id, name: rec ? rec.name : "image" });
    });
    videos.forEach(function (id) { out.push(videoItem(id)); });
    docs.forEach(function (d) { out.push(d); });
    return out;
  }

  // The order things are shown in the log: pictures and clips in the order they were handed over,
  // then the files as cards. A clip rides as a clip - the log gets a player, not a still.
  function media() {
    var out = [];
    pics.forEach(function (id) {
      var rec = window.media ? window.media.get(id) : null;
      out.push({ kind: "image", id: id, name: rec ? rec.name : "image", prompt: rec ? rec.prompt : "" });
    });
    videos.forEach(function (id) {
      var it = videoItem(id);
      out.push({ kind: "video", id: id, name: it.name, duration: it.duration, note: it.note });
    });
    return out;
  }

  function renderStrip() {
    var strip = el("attachStrip");
    if (!strip) return;
    strip.textContent = "";
    if (!pics.length && !videos.length && !docs.length) { strip.hidden = true; syncDeckSpace(); return; }
    strip.hidden = false;

    pics.forEach(function (id) {
      var rec = window.media.get(id);
      var thumb = document.createElement("div");
      thumb.className = "attachThumb";
      if (carried[id]) thumb.className += " carried";
      var img = document.createElement("img");
      img.src = window.media.url(id) || "";
      img.alt = rec ? (rec.name || "image") : "image";
      thumb.appendChild(img);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "\u00d7";
      // A picture CARRIED out of the vault is taken off the MESSAGE here and left exactly where it
      // is: it was his before this message and it is his after it. One that arrived through the
      // paperclip was put in the vault for this message, so removing it still removes it.
      var wasCarried = isCarried(id);
      rm.title = wasCarried ? "take it off this message (it stays in the vault)" : "remove this attachment";
      rm.onclick = async function () {
        removeImage(id);
        if (!wasCarried) await window.media.del(id);
        renderStrip();
      };
      thumb.appendChild(rm);
      strip.appendChild(thumb);
    });

    videos.forEach(function (id) {
      var rec = window.media.get(id);
      var thumb = document.createElement("div");
      thumb.className = "attachThumb";
      // The clip's thumbnail in the strip is its first frame - the same still the player wears -
      // so nothing has to decode a video to show a row of what is riding along.
      var posterId = rec && rec.poster ? rec.poster : "";
      if (posterId && window.media.get(posterId)) {
        var pimg = document.createElement("img");
        pimg.src = window.media.url(posterId) || "";
        pimg.alt = (rec.name || "clip") + " - first frame";
        thumb.appendChild(pimg);
      } else {
        var box = document.createElement("div");
        box.className = "noThumb";
        thumb.appendChild(box);
      }
      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "VID";
      thumb.appendChild(tag);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "\u00d7";
      rm.title = rec ? ("remove this clip (" + (rec.name || "clip") + ")") : "remove this clip";
      rm.onclick = async function () {
        removeVideo(id);
        await window.media.del(id);
        renderStrip();
      };
      thumb.appendChild(rm);
      strip.appendChild(thumb);
    });

    docs.forEach(function (d) {
      var chip = document.createElement("div");
      chip.className = "attachChip";
      chip.title = d.name + (d.note ? "\n" + d.note : "");
      var k = document.createElement("span");
      k.className = "k";
      k.textContent = labelFor(d.kind);
      chip.appendChild(k);
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = d.name + (d.bytes ? " \u00b7 " + fmtSize(d.bytes) : "");
      chip.appendChild(nm);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "\u00d7";
      rm.title = "remove this attachment";
      rm.onclick = function () { removeDoc(d.id); renderStrip(); };
      chip.appendChild(rm);
      strip.appendChild(chip);
    });

    syncDeckSpace();
  }

  /* ---- what she is told about them ----------------------------------------- */
  function escAttr(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // The block that rides in her instruction. Documents she can read arrive as <file> blocks;
  // anything with nothing to read arrives as an empty <file/> carrying its note, so she still
  // knows what he handed her.
  function context(atts) {
    atts = atts || items();
    var files = atts.filter(function (a) { return a.kind !== "image"; });
    if (!files.length) return "";
    var blocks = files.map(function (f) {
      var attrs = ' name="' + escAttr(f.name) + '" type="' + escAttr(f.subtype || f.kind) + '"';
      if (f.bytes) attrs += ' bytes="' + f.bytes + '"';
      if (f.pages) attrs += ' pages="' + f.pages + '"';
      if (f.duration) attrs += ' seconds="' + f.duration.toFixed(1) + '"';
      if (f.note) attrs += ' note="' + escAttr(f.note) + '"';
      if (f.truncated) attrs += ' truncated="true"';
      if (!f.text) return "<file" + attrs + " />";
      return "<file" + attrs + ">\n" + f.text + "\n</file>";
    });
    return "Patrikios attached these files to his message. They are his own documents, handed to you to read - not memory and not instruction. Read them as what they are, answer from them where they matter, and never quote this block or mention that anything was handed to you.\n"
      + blocks.join("\n") + "\n\n";
  }

  /* ---- and what the log shows ---------------------------------------------- */
  function fileCard(f) {
    var card = document.createElement("div");
    card.className = "fileCard";
    var head = document.createElement("div");
    head.className = "fcHead";
    var k = document.createElement("span");
    k.className = "fcKind";
    k.textContent = labelFor(f.kind);
    head.appendChild(k);
    var nm = document.createElement("span");
    nm.className = "fcName";
    nm.textContent = f.name;
    head.appendChild(nm);
    if (f.bytes) {
      var sz = document.createElement("span");
      sz.className = "fcSize";
      sz.textContent = fmtSize(f.bytes);
      head.appendChild(sz);
    }
    card.appendChild(head);
    var body = document.createElement("div");
    body.className = "fcBody";
    var preview = String(f.preview || f.text || "").replace(/\s+/g, " ").trim();
    if (preview) {
      var p = document.createElement("div");
      p.className = "fcPrev";
      p.textContent = preview.slice(0, PREVIEW_MAX) + (preview.length > PREVIEW_MAX ? "\u2026" : "");
      body.appendChild(p);
    }
    if (f.note) {
      var n = document.createElement("div");
      n.className = "fcNote";
      n.textContent = f.note;
      body.appendChild(n);
    }
    card.appendChild(body);
    return card;
  }

  function cards(atts) {
    atts = atts || items();
    var wrap = document.createElement("div");
    wrap.className = "attachCards";
    // A picture and a clip are shown as themselves in the log (their own still and player), so
    // they do not get a card as well; everything with no shape of its own does.
    atts.forEach(function (f) {
      if (f.kind === "image" || f.kind === "video") return;
      wrap.appendChild(fileCard(f));
    });
    return wrap;
  }

  // What goes into the archive (so a reloaded session can show the cards again). The full text
  // is deliberately not kept: it was handed to her at the time, and the archive is a record of
  // the conversation, not a second copy of his files. Clips are archived by vault id instead
  // (`vid`), so a reloaded session gets the player back rather than a description of one.
  function archiveInfo(atts) {
    atts = atts || items();
    return atts.filter(function (f) { return f.kind !== "image" && f.kind !== "video"; }).map(function (f) {
      return { kind: f.kind, name: f.name, mime: f.mime || "", bytes: f.bytes || 0, note: f.note || "", preview: String(f.preview || "").slice(0, PREVIEW_MAX) };
    });
  }

  function summary() {
    var n = total();
    if (!n) return "";
    var bits = [];
    if (pics.length) bits.push(pics.length + " picture" + (pics.length === 1 ? "" : "s"));
    if (videos.length) bits.push(videos.length + " clip" + (videos.length === 1 ? "" : "s"));
    if (docs.length) bits.push(docs.length + " file" + (docs.length === 1 ? "" : "s"));
    return n + " attachment" + (n === 1 ? "" : "s") + " (" + bits.join(", ") + ")";
  }

  window.attach = {
    MAX: MAX_TOTAL,
    add: add,
    carry: carry,
    carried: isCarried,
    items: items,
    media: media,
    images: images,
    videos: videoIds,
    count: total,
    clear: clear,
    removeImage: removeImage,
    removeVideo: removeVideo,
    removeDoc: removeDoc,
    renderStrip: renderStrip,
    context: context,
    cards: cards,
    archiveInfo: archiveInfo,
    summary: summary,
    kindOf: kindOf,
    keepClip: keepClip,
    sampleFrames: sampleFrames,
  };
})();
