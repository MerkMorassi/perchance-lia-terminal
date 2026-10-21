  /* ===========================================================================
     ARCHIVAX - THE AGENT OF THE RECORD, AND HER HANDS

     She is not a role and not a voice in the conversation. She is the terminal's
     own agent: order 0 of the canonical manifest in src/mythos/agents.json,
     "Agent of Memory, Commitment, and Revision History". What she does is OPS on
     the record - filing pictures into folders, tagging them, and READING them
     (the vision model) so that what is IN a picture is written down as content
     of the record instead of living only in the pixels.

     WHO GIVES THE ORDER. Either Patrikios, by typing it:

        /archivax file /images/portraits :: R12 R14
        /archivax classify the newest three

     or a LIA, from inside a reply, with one line on its own:

        [[ARCHIVAX: file /images/portraits :: R12 R14]]

     THE GLASS DOES NOT MOVE FOR HER. Ordering her is not a way around the rule
     the vault already keeps for FILE: a LIA may set her on what the terminal
     MADE - a render, an upscale, the `onlyMade` guard in vault.js - and never on
     the things Patrikios handed over himself. He may order her to touch
     anything, because the vault is his.

     WHAT SHE CANNOT DO. There is no operation here that runs code, reads a file
     off the disk, reaches the network except through the vision model she was
     already given, or deletes anything at all. Every op lands in the vault or
     the journal, and every op is written into the journal - the agent of
     REVISION HISTORY keeps her own revision history, and it is on the record in
     the archive entry of the turn that ordered it. /archivax prints it.

     See the ARCHIVAX section of src/README.md, LIA_ARCHIVAX_* in config.js, and
     window.archivax at the bottom of this file. Loaded AFTER reader.js (whose
     targets() decides what "something" means) and renderbook.js (whose labels
     she reports by), and BEFORE chat.js, which orders her.
     ========================================================================= */
(function () {

  var AGENT_ID = "ARCHIVAX";
  var JOURNAL_KEY = "archivax_log";
  var JOURNAL_MAX = 200;
  var DEFAULT_ROLE = "Agent of Memory, Commitment, and Revision History";
  var DEFAULT_PROMPT = [
    "You are reading a picture so that it can be filed and found later.",
    "Answer with exactly two lines and nothing else.",
    "Line 1: one plain factual sentence describing what is actually shown - the subject, the setting, the action and the mood. No speculation, no names, no address to anyone.",
    "Line 2: begins with \"TAGS:\" and then up to six single lowercase words or hyphenated pairs covering the subject, the setting, the mood and the style, separated by commas. No #, and no punctuation inside a word."
  ].join("\n");
  // What ONE STILL of a clip is asked when the archivax road reads a clip on its own (the
  // conversation passes LIA_CLIP_FRAME_PROMPT; this is the same question in the same register, and
  // the bulk classifier passes its own prompt, which also asks for the elements and a bucket).
  var DEFAULT_CLIP_FRAME_PROMPT = "This is one frame from a moving clip. In one terse sentence say what this single frame shows - the subject, what it is doing, and where it is. Do not guess at anything before or after this moment. No judgement and no praise.";

  var manifest = null;    // her own roster entry from src/mythos/agents.json, read at boot
  var journal = [];       // what she has done, newest last (kv lia_settings / archivax_log)

  function kv() { return (window.root && window.root.kv && window.root.kv.lia_settings) || null; }
  function media() { return window.media || null; }
  function readerMod() { return window.reader || null; }
  function stampOf(ts) { return (window.logTime && window.logTime.stamp) ? window.logTime.stamp(ts) : ""; }

  /* ---- what the manifest says she is -------------------------------------- */

  // Everything she says about herself comes from the roster, so her role here cannot drift from
  // the role the packs are filed against. With no manifest (offline, or the file gone) she falls
  // back to the same string the manifest carries.
  function name() { return manifest ? manifest.name : "Archivax"; }
  function role() { return (manifest && manifest.role) ? manifest.role : DEFAULT_ROLE; }
  function roleId() { return manifest ? manifest.id : AGENT_ID; }
  function revision() { return (manifest && manifest.revision) ? manifest.revision : "ara:2025-12-14"; }
  function policyText(v) { return (v && v.length) ? v.join("/").toUpperCase() : "NONE"; }
  function readPolicy() { return policyText(manifest && manifest.read); }
  function writePolicy() { return policyText(manifest && manifest.write); }
  function constraints() { return (manifest && manifest.constraints && manifest.constraints.length) ? manifest.constraints.slice() : []; }

  /* ---- the bounds, from config.js ----------------------------------------- */

  function opMax() {
    var n = (typeof LIA_ARCHIVAX_MAX === "number") ? LIA_ARCHIVAX_MAX : 2;
    return (isFinite(n) && n > 0) ? Math.round(n) : 2;
  }
  function sightMax() {
    var n = (typeof LIA_ARCHIVAX_SIGHT_MAX === "number") ? LIA_ARCHIVAX_SIGHT_MAX : 4;
    return (isFinite(n) && n > 0) ? Math.round(n) : 4;
  }
  function sightPrompt() {
    return (typeof LIA_ARCHIVAX_PROMPT === "string" && LIA_ARCHIVAX_PROMPT.trim())
      ? String(LIA_ARCHIVAX_PROMPT).trim()
      : DEFAULT_PROMPT;
  }

  /* ---- the glass ---------------------------------------------------------- */

  // Patrikios may set her on anything in the vault. A LIA may set her only on what the terminal
  // MADE - the same guard vault.js puts on her own [[FILE: ...]] line. Reading a picture is not a
  // move, so it is open to either; TAGGING and FILING his own files are not.
  function onlyMadeFor(by) { return by !== "patrikios"; }

  function mayWriteOn(rec, by) {
    if (by === "patrikios") return true;
    if (!rec) return false;
    return rec.kind === "gen" || rec.kind === "upscale";
  }

  /* ---- naming a record the way the rest of the terminal names it ---------- */

  function labelOf(id) {
    var M = media();
    var lbl = (window.renderBook && window.renderBook.labelOf) ? window.renderBook.labelOf(id) : "";
    var rec = M ? M.get(id) : null;
    return (lbl ? lbl + " " : "") + (M && rec ? M.recordLabel(rec) : id);
  }

  function short(text, n) {
    var s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }

  // WHAT TO CALL WHAT SHE TOUCHED. A clip stands on the record with the pictures now, so a receipt
  // says PICTURES when only pictures were touched, CLIPS when only clips were, and both when both.
  function itemNoun(n, clips) {
    if (!clips) return n === 1 ? "PICTURE" : "PICTURES";
    if (clips === n) return n === 1 ? "CLIP" : "CLIPS";
    return "PICTURES AND CLIPS";
  }

  function clipNote(clips) {
    return clips
      ? "\nA CLIP IS READ AS A SEQUENCE: " + clipFrameCount() + " STILLS SPREAD FROM ITS OPENING TO ITS END, ONE READING OF THE WHOLE MOVEMENT. THE STILLS ARE NOT KEPT - THE CLIP AND ITS OWN THUMBNAIL ARE WHAT STAY IN THE VAULT."
      : "";
  }

  /* ---- what she may be told to do ---------------------------------------- */

  var OPS = [
    {
      id: "status", boss: "both", usage: "status",
      what: "what she has already done (the journal), and the shape of the record as she sees it"
    },
    {
      id: "read", boss: "both", usage: "read <what>",
      what: "go and LOOK at things - detect what is in them with the vision model - and write her reading onto each record as its sight. A clip is read as a handful of stills spread across it, and what is written is what happens ACROSS it. Reading the record is not a change to it, so either of you may order this"
    },
    {
      id: "classify", boss: "both", usage: "classify <what>",
      what: "read the pictures AND act on what she found: her reading is written onto each record as its sight, and the content tags she names are filed on it. She only TAGS pictures the terminal made when a LIA ordered it - his own files are his to tag"
    },
    {
      id: "tag", boss: "both", usage: "tag <what> :: #tag #tag",
      what: "file tags onto the pictures that match <what> (the same three ways of naming something the rest of the terminal uses: R12, a #tag, or words). A LIA may tag only what the terminal made"
    },
    {
      id: "untag", boss: "both", usage: "untag <what> :: #tag",
      what: "take tags back off the pictures that match <what>"
    },
    {
      id: "file", boss: "both", usage: "file <PATH> :: <what>",
      what: "move the pictures that match <what> into a folder (making it if it is not there yet). With nothing after the :: she files what the terminal made most recently. A LIA may file only what the terminal made"
    },
    {
      id: "sweep", boss: "both", usage: "sweep [N]",
      what: "the standing job: look at the newest N things that have never had a reading (default 3, at most " + sightMax() + ") - pictures and clips - and write one onto each. This is how a vault is brought into the record a few at a time"
    },
    {
      id: "ops", boss: "both", usage: "ops",
      what: "this list"
    }
  ];

  function opById(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase();
    for (var i = 0; i < OPS.length; i++) if (OPS[i].id === want) return OPS[i];
    return null;
  }

  function opList() {
    return OPS.map(function (o) { return "  " + o.usage.toUpperCase() + " :: " + o.what; }).join("\n");
  }

  /* ---- naming things: the reader's targets(), and the standing job -------- */

  async function pick(what, by, max) {
    var R = readerMod();
    var spec = String(what == null ? "" : what).trim();
    if (!spec) return { ids: [], label: "" };
    if (!R || !R.targets) return { ids: [], label: spec };
    try { return await R.targets(spec, { onlyMade: onlyMadeFor(by), max: max }); }
    catch (e) { return { ids: [], label: spec, error: (e && e.message) ? e.message : String(e) }; }
  }

  // A record she can actually LOOK at. This is the sight gate itself (images.js lookable) rather
  // than a second copy of the rule, so there is one answer in the terminal to "may this be put in
  // front of her eyes": the vision model takes image blobs only, a clip is in front of her as the
  // still it carries, and a recording is media and not a picture to read. Reading the queue's own
  // predicate matters here as well as at the queue - a record whose stored type is stale (an
  // untyped .mp3 or .wav once defaulted to image/jpeg) is still not something to hand the model.
  function isPicture(rec) {
    return !!(rec && rec.id) && (typeof lookable === "function") && lookable(rec.id);
  }

  // A CLIP (2026-09-24). PATRIKIOS: "Yes. Bulk classifier on video frames, Then she can tag the
  // video and classify it correctly." A clip is not a picture and cannot be handed to the vision
  // model as a file, but it is not opaque either: it reaches her as a HANDFUL OF STILLS spread from
  // its opening to its end, read once and thrown away (the road the conversation already walks for
  // a clip on his message - src/js/attach.js sampleFrames + src/js/images.js lookBlob). The one
  // place that owns the road is `clipSight` below, so the ops, the sweep and the bulk CLASSIFIER
  // all read a clip the same way, and a clip's reading means the same thing wherever it was written.
  function isClip(rec) {
    return !!(rec && (rec.kind === "video" || /^video\//.test(String(rec.mime || ""))));
  }

  // HOW MANY STILLS A CLIP IS READ AS. One knob (LIA_CLIP_FRAMES in config.js), the same one the
  // conversation uses, so a clip costs the same wherever it is read. 0 switches the sequence off -
  // then a clip has no reading of its own and its own still stands for it.
  function clipFrameCount() {
    var n = (typeof LIA_CLIP_FRAMES === "number") ? Math.round(LIA_CLIP_FRAMES) : 6;
    if (!isFinite(n) || n < 0) n = 0;
    return Math.max(0, Math.min(24, n));
  }

  function clipFramePrompt() {
    return (typeof LIA_CLIP_FRAME_PROMPT === "string" && LIA_CLIP_FRAME_PROMPT.trim())
      ? String(LIA_CLIP_FRAME_PROMPT).trim()
      : DEFAULT_CLIP_FRAME_PROMPT;
  }

  // The labels the conversation's clip road uses, so a clip read either way carries the same shape
  // of reading on its record: opens on: / then: / ends on:
  function frameLabel(i, n) {
    if (n <= 1) return "its opening";
    if (i === 0) return "opens on";
    if (i === n - 1) return "ends on";
    return "then";
  }

  // The newest things in the vault that have never been read. `list()` is oldest first, so the
  // newest are at the end. A CLIP COUNTS (2026-09-24) when the sequence is on: it is read as a
  // handful of stills across it. With LIA_CLIP_FRAMES = 0 a clip cannot be read at all - its own
  // still is a picture record of its own and is picked up here as one.
  function unread(max) {
    var M = media();
    if (!M) return [];
    var frames = clipFrameCount();
    var ids = M.list().filter(function (id) {
      var r = M.get(id);
      if (!r || String(r.sight || "").trim()) return false;
      if (isPicture(r)) return true;
      return isClip(r) && !!r.blob && frames > 0;
    });
    return ids.slice(-max);
  }

  function newestMade(max) {
    var M = media();
    if (!M) return [];
    var ids = M.list().filter(function (id) {
      var r = M.get(id);
      return !!(r && r.blob && (r.kind === "gen" || r.kind === "upscale"));
    });
    return ids.slice(-max);
  }

  /* ---- her eyes: one picture, read and filed ------------------------------ */

  // One vision pass over one stored record. Returns { ok, text, tags, bucket, why } - it WRITES
  // NOTHING; the ops decide what is done with what she found.
  //
  // A PICTURE is handed to the model as itself. A CLIP is read as a sequence of stills across it
  // (clipSight), and what comes back is one reading of the whole movement.
  //
  // `opts.prompt` is what she is ASKED (the archivax reading by default, which asks for a
  // description and a tag line); the bulk CLASSIFIER in tools.js passes its own prompt, which also
  // asks for a BUCKET - the kind of scene the picture is - and gets it back in `bucket`.
  // `opts.tagMax` is how many element tags one reading may name (six by default).
  // `opts.overwrite` re-reads a clip that already carries a reading instead of keeping it.
  // `opts.onFrame(i, n)` is called as each still of a clip is read, so a caller can say so out loud.
  async function look(id, opts) {
    opts = opts || {};
    var M = media();
    var rec = M ? M.get(id) : null;
    if (!rec) return { ok: false, why: "not in the vault" };
    if (!rec.blob) return { ok: false, why: "there is no picture in that record" };
    // A CLIP IS READ AS A SEQUENCE, NOT AS A STILL (see clipSight / lookClip below).
    if (isClip(rec)) return await lookClip(rec, opts);
    if (!isPicture(rec)) return { ok: false, why: "a recording is media, not something to read" };
    if (!window.root || !window.root.generateText) return { ok: false, why: "the vision model is not reachable" };
    var asked = (opts.prompt && String(opts.prompt).trim()) ? String(opts.prompt).trim() : sightPrompt();
    var raw;
    try {
      raw = await window.root.generateText({ instruction: [asked + "\n\n", rec.blob] });
    } catch (e) {
      return { ok: false, why: (e && e.message) ? e.message : String(e) };
    }
    return parseReading(raw, opts.tagMax);
  }

  // ONE ANSWER, PARSED THE ONE WAY. Whoever asked - the archivax reading (a description and a tag
  // line), a still out of a clip, or the bulk classifier (a description, tags and a bucket) - the
  // model's words are taken apart here and nowhere else, so "what she found in a picture" has one
  // shape in the terminal. The description lines are the reading; a TAGS: line is the elements; a
  // BUCKET: line is the kind of scene.
  function parseReading(text, tagMax) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { ok: false, why: "she came back with nothing" };
    var parts = raw.split("\n");
    var tags = [];
    var bucket = "";
    var desc = [];
    parts.forEach(function (ln) {
      var t = ln.match(/^\s*tags\s*:\s*(.*)$/i);
      if (t) { tags = parseTags(t[1], tagMax || 6); return; }
      var b = ln.match(/^\s*buckets?\s*:\s*(.*)$/i);
      if (b) { bucket = parseBucket(b[1]); return; }
      desc.push(ln);
    });
    var reading = desc.join(" ").replace(/\s+/g, " ").trim();
    if (!reading && tags.length) reading = raw.replace(/^\s*tags\s*:.*$/im, "").replace(/^\s*buckets?\s*:.*$/im, "").replace(/\s+/g, " ").trim();
    return { ok: true, text: reading || raw, tags: tags, bucket: bucket };
  }

  /* ---- a clip, read as a sequence of stills -------------------------------- */

  // The stills out of one clip, each read with `opts.prompt` and parsed the one way. NOTHING IS
  // STORED: every still is drawn, read once and thrown away, so the clip keeps only its own poster.
  // What comes back is one reading of the whole movement - the stills labelled as a sequence, in
  // order - plus the elements they name and the kind of scene MOST of them agree on (a single odd
  // still must not rename a whole clip).
  async function clipSight(rec, opts) {
    opts = opts || {};
    var want = clipFrameCount();
    if (!want) return { ok: false, off: true, why: "the clip sequence is switched off here (LIA_CLIP_FRAMES = 0)" };
    if (!(window.attach && window.attach.sampleFrames)) return { ok: false, why: "the frame sampler is offline (src/js/attach.js)" };
    if (typeof window.lookBlob !== "function") return { ok: false, why: "the vision road is offline (src/js/images.js)" };
    if (!window.root || !window.root.generateText) return { ok: false, why: "the vision model is not reachable" };
    var samp = null;
    try { samp = await window.attach.sampleFrames(rec.blob, { count: want }); }
    catch (e) { return { ok: false, why: (e && e.message) ? e.message : String(e) }; }
    var frames = (samp && samp.frames) || [];
    if (!frames.length) return { ok: false, why: (samp && samp.error) || "no frame of it could be drawn here" };
    var asked = (opts.prompt && String(opts.prompt).trim()) ? String(opts.prompt).trim() : clipFramePrompt();
    var tagMax = opts.tagMax || 6;
    var lines = [], tags = [], seen = {}, order = [], calls = 0;
    for (var i = 0; i < frames.length; i++) {
      if (typeof opts.onFrame === "function") { try { opts.onFrame(i, frames.length); } catch (e) {} }
      var t = "";
      try { t = await window.lookBlob(frames[i].blob, asked); } catch (e) { t = ""; }
      calls++;
      if (!t) continue;
      var got = parseReading(t, tagMax);
      if (!got.ok) continue;
      lines.push(got.text);
      (got.tags || []).forEach(function (x) {
        if (tags.indexOf(x) === -1 && tags.length < tagMax) tags.push(x);
      });
      if (got.bucket) { if (!seen[got.bucket]) { seen[got.bucket] = 0; order.push(got.bucket); } seen[got.bucket]++; }
    }
    if (!lines.length) return { ok: false, why: "not one still of it could be read", calls: calls };
    var text = lines.map(function (t, n) { return "  " + frameLabel(n, lines.length) + ": " + t; }).join("\n");
    var bucket = "";
    order.forEach(function (b) { if (!bucket || seen[b] > seen[bucket]) bucket = b; });
    return {
      ok: true, text: text, tags: tags, bucket: bucket, clipFrames: lines.length, calls: calls,
      duration: (samp && samp.duration) || rec.duration || 0,
      partial: lines.length < frames.length
    };
  }

  // ONE CLIP, AS ONE RECORD. What is written on the clip is the reading of the whole movement. A
  // reading it ALREADY carries - written when it was sent to her, or by an earlier pass - is KEPT:
  // this pass is here for its tags and its bucket, and a second reading of the same clip is not more
  // true than the first. `opts.overwrite` is the deliberate exception (the classifier's `again`
  // scope asks for a reading again on purpose).
  async function lookClip(rec, opts) {
    opts = opts || {};
    var had = opts.overwrite ? "" : String(rec.sight || "").trim();
    var seq = await clipSight(rec, opts);
    if (!seq.ok) return seq;
    return {
      ok: true, text: had ? "" : seq.text, tags: seq.tags, bucket: seq.bucket,
      clipFrames: seq.clipFrames, calls: seq.calls, keptReading: !!had,
      seconds: seq.duration, partial: !!seq.partial
    };
  }

  // One bucket: a short lowercase slug, normalized the same way a folder segment and a tag are,
  // so the word the model names, the #tag on the picture and the folder it lands in are one word.
  // A model that answers with a sentence instead gets its first few words taken rather than
  // nothing filed.
  function parseBucket(s) {
    var M = media();
    var t = String(s == null ? "" : s).split(/[.,;:()\n]/)[0].trim();
    var words = t.split(/\s+/).filter(Boolean).slice(0, 5).join("-");
    var n = M && M.normTag ? M.normTag(words) : words.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return n && n.length > 1 ? n : "";
  }

  function parseTags(s, max) {
    var M = media();
    var out = [];
    var cap = Number(max) > 0 ? Math.round(Number(max)) : 6;
    String(s == null ? "" : s).split(/[,;]+/).forEach(function (t) {
      var n = M && M.normTag ? M.normTag(t) : String(t).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (n && n.length > 1 && out.indexOf(n) === -1 && out.length < cap) out.push(n);
    });
    return out;
  }

  // What a single record's reading costs the record: the sight itself, and - when the orderer is
  // allowed to touch it - the tags she named. `opts.bucket` also writes the BUCKET: one slug naming
  // the kind of scene, kept as a field on the record AND hung on it as a tag, because a bucket you
  // cannot search is not a bucket (the gallery, /renders find and her [[SHOW: #...]] all read tags).
  async function fileReading(id, found, by, opts) {
    opts = opts || {};
    var M = media();
    var rec = M ? M.get(id) : null;
    if (!rec) return { id: id, wrote: false, tags: [], why: "not in the vault" };
    if (found.text) await M.setField(id, "sight", found.text);
    // A CLIP REMEMBERS HOW MANY STILLS ITS READING WAS TAKEN ACROSS, so the record says what the
    // reading actually cost and a reading that covered only part of a clip is not read as the whole.
    if (found.clipFrames) await M.setField(id, "clipFrames", found.clipFrames);
    await M.setField(id, "classifiedAt", Date.now());
    await M.setField(id, "classifiedBy", opts.mark || roleId());
    var added = [], refused = [];
    if (opts.tags !== false && found.tags && found.tags.length) {
      if (!mayWriteOn(rec, by)) {
        refused = found.tags.slice();
      } else {
        for (var i = 0; i < found.tags.length; i++) {
          var already = (rec.tags || []).indexOf(found.tags[i]) !== -1;
          var ok = await M.tag(id, found.tags[i]);
          if (!already) added.push(found.tags[i]);
          else if (!ok) { /* at the tag cap, or nothing changed */ }
        }
      }
    }
    var bucket = "";
    if (opts.bucket && found.bucket) {
      var b = M.normTag ? M.normTag(found.bucket) : String(found.bucket);
      if (b) {
        if (!mayWriteOn(rec, by)) {
          refused = refused.concat([b]);
        } else {
          await M.setField(id, "bucket", b);
          var hadB = (rec.tags || []).indexOf(b) !== -1;
          var tagged = await M.tag(id, b);
          if (!hadB && tagged) added.push(b);
          bucket = b;
        }
      }
    }
    return { id: id, wrote: true, tags: added, refused: refused, bucket: bucket };
  }

  /* ---- the operations ----------------------------------------------------- */

  var RUN = {

    // WHAT SHE HAS DONE, AND WHAT IS HERE. The journal is hers to show: an agent of revision
    // history that could not say what it had revised would be a name and nothing else.
    async status(args, ctx) {
      var M = media();
      var lines = [];
      var ids = M ? M.list() : [];
      var withSight = 0, pictures = 0, clips = 0, made = 0, other = 0;
      ids.forEach(function (id) {
        var r = M.get(id);
        if (!r) return;
        var readable = isPicture(r) || (isClip(r) && !!r.blob);
        if (isPicture(r)) pictures++;
        else if (isClip(r) && r.blob) clips++;
        else other++;
        if (readable && String(r.sight || "").trim()) withSight++;
        if (r.kind === "gen" || r.kind === "upscale") made++;
      });
      lines.push("HERSELF :: " + name().toUpperCase() + " :: " + role().toUpperCase()
        + "\n  ORDER " + (manifest ? manifest.order : 0) + " · PORT " + (manifest ? manifest.port : 4000)
        + " · REVISION " + revision().toUpperCase()
        + "\n  LORE POLICY :: READ " + readPolicy() + " / WRITE " + writePolicy()
        + "\n  CONSTRAINTS :: " + (constraints().length ? constraints().join("; ") : "none recorded"));
      var frames = clipFrameCount();
      lines.push("THE RECORD AS SHE SEES IT :: " + pictures + " PICTURE" + (pictures === 1 ? "" : "S")
        + (clips ? " AND " + clips + " CLIP" + (clips === 1 ? "" : "S")
          + (frames ? " (READ " + frames + " STILLS ACROSS EACH ONE)" : " (THE SEQUENCE IS OFF - THEIR OWN STILLS STAND FOR THEM)") : "")
        + " (" + made + " MADE HERE), " + withSight + " WITH A READING, " + Math.max(0, pictures + clips - withSight) + " WITHOUT ONE"
        + (other ? "\n  " + other + " MORE RECORD" + (other === 1 ? "" : "S") + " ARE MEDIA SHE DOES NOT READ (MUSIC, RECORDINGS)" : ""));
      if (M && M.allTags) {
        var tags = M.allTags();
        lines.push("TAGS :: " + (tags.length ? tags.slice(0, 12).map(function (t) { return "#" + t.tag + "(" + t.count + ")"; }).join("  ·  ") : "none filed yet"));
      }
      if (M && M.allFolders) {
        var fold = M.allFolders();
        lines.push("FOLDERS :: " + (fold.length ? fold.map(function (f) { return f.path + " (" + f.count + ")"; }).join("  ·  ") : "none"));
      }
      if (journal.length) {
        lines.push("HER JOURNAL, MOST RECENT LAST ::");
        journal.slice(-6).forEach(function (j) {
          lines.push("  [" + stampOf(j.ts) + "] " + String(j.op).toUpperCase() + " BY " + String(j.by || "?").toUpperCase()
            + (j.n ? " :: " + j.n : "") + (j.note ? " :: " + j.note : ""));
        });
        lines.push("  (" + journal.length + " ENTRIES; /archivax JOURNAL FOR ALL OF THEM.)");
      } else {
        lines.push("HER JOURNAL IS EMPTY :: NOTHING HAS BEEN ORDERED OF HER YET. /archivax OPS SHOWS WHAT CAN BE.");
      }
      return { ok: true, title: "THE RECORD, AS SHE KEEPS IT", text: lines.join("\n") };
    },

    async ops() {
      return { ok: true, title: "WHAT SHE MAY BE TOLD TO DO", text: opList() };
    },

    // LOOK AT THINGS - pictures, and a clip as the sequence of stills across it. Her reading is
    // written onto each record as its sight - the same field the terminal writes when she is handed a
    // picture, so the vault's own record of "what is in this" and hers cannot be two different things.
    async read(args, ctx) {
      var want = args.trim();
      var got = want ? await pick(want, ctx.by, sightMax()) : { ids: unread(sightMax()), label: "the newest unread" };
      if (!got.ids.length) return { ok: false, title: "NOTHING TO LOOK AT", text: nothingMatched(want) };
      var M = media();
      var done = [], failed = [], clips = 0;
      for (var i = 0; i < got.ids.length && i < sightMax(); i++) {
        var found = await look(got.ids[i]);
        if (!found.ok) { failed.push(labelOf(got.ids[i]) + " :: " + found.why); continue; }
        if (isClip(M.get(got.ids[i]))) clips++;
        await fileReading(got.ids[i], found, ctx.by, { tags: false });
        // `found.text` is empty for a clip that already carried a reading: what is on the record is
        // what she looked at, so the receipt reports the reading in force rather than a blank line.
        done.push(labelOf(got.ids[i]) + "\n    " + short(found.text || String(M.get(got.ids[i]).sight || ""), 200));
      }
      return {
        ok: !!done.length,
        title: "SHE LOOKED AT " + done.length + " " + itemNoun(done.length, clips) + (got.label ? " :: " + String(got.label).toUpperCase() : ""),
        text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "")
          + "\nTHE READING IS WRITTEN ON EACH RECORD AS ITS SIGHT - THE SAME FIELD THE TERMINAL FILLS WHEN A PICTURE IS PUT IN FRONT OF HER."
          + clipNote(clips),
        note: (done.length ? done.length + " read" : ""),
        n: done.length
      };
    },

    // LOOK AND FILE. The standing classification job: her reading, plus the content tags she named.
    async classify(args, ctx) {
      var want = args.trim();
      var got = want ? await pick(want, ctx.by, sightMax()) : { ids: unread(sightMax()), label: "the newest unread" };
      if (!got.ids.length) return { ok: false, title: "NOTHING TO CLASSIFY", text: nothingMatched(want) };
      var done = [], failed = [], refusedAll = 0, clips = 0;
      var CM = media();
      for (var i = 0; i < got.ids.length && i < sightMax(); i++) {
        var found = await look(got.ids[i]);
        if (!found.ok) { failed.push(labelOf(got.ids[i]) + " :: " + found.why); continue; }
        if (isClip(CM.get(got.ids[i]))) clips++;
        var res = await fileReading(got.ids[i], found, ctx.by, { tags: true });
        refusedAll += (res.refused && res.refused.length) ? res.refused.length : 0;
        done.push(labelOf(got.ids[i]) + "\n    " + short(found.text || String(CM.get(got.ids[i]).sight || ""), 200)
          + (res.tags && res.tags.length ? "\n    tags filed :: " + res.tags.map(function (t) { return "#" + t; }).join(" ") : "")
          + (res.refused && res.refused.length ? "\n    tags she would not file on his own picture :: " + res.refused.map(function (t) { return "#" + t; }).join(" ") : ""));
      }
      return {
        ok: !!done.length,
        title: "SHE CLASSIFIED " + done.length + " " + itemNoun(done.length, clips) + (got.label ? " :: " + String(got.label).toUpperCase() : ""),
        text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "")
          + (refusedAll ? "\n" + refusedAll + " TAG" + (refusedAll === 1 ? "" : "S") + " WERE NOT FILED: A LIA MAY NOT WRITE ON WHAT PATRIKIOS HANDED OVER HIMSELF. HE MAY ORDER THIS HIMSELF AT ANY TIME." : "")
          + clipNote(clips),
        n: done.length
      };
    },

    async tag(args, ctx) {
      var sp = splitOn(args);
      if (!sp.left || !sp.right) return { ok: false, title: "TAGGING NEEDS BOTH HALVES", text: "[[ARCHIVAX: tag <what> :: #tag #tag]] - THE THING TO TAG FIRST, THEN THE TAGS. /archivax OPS LISTS THE OPS." };
      var M = media();
      var tags = parseTags(sp.right.replace(/#/g, " "));
      if (!tags.length) return { ok: false, title: "NO TAGS IN THAT", text: "NAME THEM AFTER THE :: - tag R12 :: night, rain" };
      var got = await pick(sp.left, ctx.by, sightMax() * 4);
      if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(sp.left) };
      var filed = [], refused = [], already = 0, clips = 0;
      for (var i = 0; i < got.ids.length; i++) {
        var rec = M.get(got.ids[i]);
        if (!mayWriteOn(rec, ctx.by)) { refused.push(labelOf(got.ids[i])); continue; }
        var added = [];
        for (var t = 0; t < tags.length; t++) {
          var had = (rec.tags || []).indexOf(tags[t]) !== -1;
          var ok = await M.tag(got.ids[i], tags[t]);
          if (had) { already++; continue; }
          if (ok) added.push(tags[t]);
        }
        if (isClip(rec)) clips++;
        filed.push(labelOf(got.ids[i]) + (added.length ? " :: " + added.map(function (x) { return "#" + x; }).join(" ") : " :: already carried them"));
      }
      return {
        ok: !!filed.length,
        title: "TAGGED " + filed.length + " " + itemNoun(filed.length, clips) + " :: " + tags.map(function (x) { return "#" + x; }).join(" "),
        text: filed.join("\n")
          + (refused.length ? "\nLEFT ALONE (" + refused.length + ") :: HIS OWN FILE - A LIA MAY NOT WRITE ON ONE. " + refused.join("  ·  ") : ""),
        n: filed.length
      };
    },

    async untag(args, ctx) {
      var sp = splitOn(args);
      if (!sp.left || !sp.right) return { ok: false, title: "UNTAGGING NEEDS BOTH HALVES", text: "[[ARCHIVAX: untag <what> :: #tag]]" };
      var M = media();
      var tags = parseTags(sp.right.replace(/#/g, " "));
      if (!tags.length) return { ok: false, title: "NO TAGS IN THAT", text: "NAME THEM AFTER THE :: - untag R12 :: night" };
      var got = await pick(sp.left, ctx.by, sightMax() * 4);
      if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(sp.left) };
      var off = [], refused = [];
      for (var i = 0; i < got.ids.length; i++) {
        var rec = M.get(got.ids[i]);
        if (!mayWriteOn(rec, ctx.by)) { refused.push(labelOf(got.ids[i])); continue; }
        var gone = [];
        for (var t = 0; t < tags.length; t++) {
          if ((rec.tags || []).indexOf(tags[t]) === -1) continue;
          if (await M.untag(got.ids[i], tags[t])) gone.push(tags[t]);
        }
        off.push(labelOf(got.ids[i]) + (gone.length ? " :: -" + gone.map(function (x) { return "#" + x; }).join(" -") : " :: did not carry them"));
      }
      return {
        ok: true, title: "UNTAGGED " + off.length + " PICTURE" + (off.length === 1 ? "" : "S"),
        text: off.join("\n") + (refused.length ? "\nLEFT ALONE (" + refused.length + ") :: HIS OWN FILE. " + refused.join("  ·  ") : ""),
        n: off.length
      };
    },

    async file(args, ctx) {
      var sp = splitOn(args);
      var M = media();
      if (!sp.left) return { ok: false, title: "FILING NEEDS A FOLDER", text: "[[ARCHIVAX: file /images/portraits :: R12 R14]] - THE FOLDER FIRST. WITH NOTHING AFTER THE :: SHE FILES WHAT THE TERMINAL MADE MOST RECENTLY." };
      var path = M.normFolder(sp.left);
      if (!path) return { ok: false, title: "THAT IS NOT A FOLDER", text: "A FOLDER IS A PATH - /images, /music, /images/portraits." };
      var want = sp.right ? String(sp.right).trim() : "";
      var got = want
        ? await pick(want, ctx.by, 60)
        : { ids: newestMade(sightMax()), label: "the newest the terminal made" };
      if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(want) };
      var res = await M.fileMany(got.ids, path, { by: "archivax", onlyMade: onlyMadeFor(ctx.by), max: 60 });
      if (!res.ok) {
        return {
          ok: false, title: "SHE COULD NOT FILE INTO " + path,
          text: res.error + (res.skipped && res.skipped.length
            ? "\nLEFT WHERE THEY WERE (" + res.skipped.length + ") :: " + res.skipped.slice(0, 8).map(function (s) { return s.name + " (" + s.why + ")"; }).join("  ·  ")
            : "")
        };
      }
      var names = res.filed.map(labelOf);
      return {
        ok: true, title: "FILED " + res.filed.length + " INTO " + path,
        text: names.join("  ·  ")
          + (res.skipped && res.skipped.length ? "\nLEFT WHERE THEY WERE (" + res.skipped.length + ") :: " + res.skipped.slice(0, 8).map(function (s) { return s.name + " (" + s.why + ")"; }).join("  ·  ") : ""),
        note: "→ " + path, n: res.filed.length
      };
    },

    // THE STANDING JOB. A vault can be brought into the record a few at a time: the newest
    // pictures that have never been read, one reading each.
    async sweep(args, ctx) {
      var want = parseInt(String(args).trim(), 10);
      if (!isFinite(want) || want < 1) want = 3;
      want = Math.min(want, sightMax());
      var ids = unread(want);
      if (!ids.length) {
        return { ok: false, title: "NOTHING IS WAITING", text: "EVERY PICTURE AND CLIP IN THE VAULT HAS A READING. /archivax STATUS REPORTS THE RECORD." };
      }
      var M = media();
      var done = [], failed = [], clips = 0;
      for (var i = 0; i < ids.length; i++) {
        var found = await look(ids[i]);
        if (!found.ok) { failed.push(labelOf(ids[i]) + " :: " + found.why); continue; }
        if (isClip(M.get(ids[i]))) clips++;
        await fileReading(ids[i], found, ctx.by, { tags: false });
        done.push(labelOf(ids[i]) + "\n    " + short(found.text || String(M.get(ids[i]).sight || ""), 180));
      }
      var leftIds = unread(9999);
      var left = leftIds.length;
      var leftClips = leftIds.filter(function (x) { return isClip(M.get(x)); }).length;
      return {
        ok: !!done.length,
        title: "SWEPT " + done.length + " " + itemNoun(done.length, clips) + " INTO THE RECORD",
        text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "")
          + "\n" + left + " " + itemNoun(left, leftClips) + " STILL WITHOUT A READING."
          + clipNote(clips),
        n: done.length
      };
    }
  };

  function splitOn(args) {
    var s = String(args == null ? "" : args);
    var at = s.indexOf("::");
    if (at === -1) return { left: s.trim(), right: "" };
    return { left: s.slice(0, at).trim(), right: s.slice(at + 2).trim() };
  }

  function nothingMatched(want) {
    return "NOTHING IN THE VAULT MATCHES " + (String(want || "").trim() ? "\"" + String(want).toUpperCase() + "\" " : "")
      + "- SHE NAMES THINGS THE WAY THE REST OF THE TERMINAL DOES: A ROW OF THE BOOK (R12), A #TAG, OR WORDS. /read VAULT LISTS WHAT IS HERE.";
  }

  /* ---- the journal: her own revision history ------------------------------ */

  async function log(entry) {
    journal.push(entry);
    if (journal.length > JOURNAL_MAX) journal = journal.slice(-JOURNAL_MAX);
    var s = kv();
    if (s) { try { await s.set(JOURNAL_KEY, journal.slice()); } catch (e) { console.warn("archivax journal not saved", e); } }
  }

  /* ---- the one entrance --------------------------------------------------- */

  // One op, one line. `by` is "patrikios" (his command) or "lia" (a line in her reply) and decides
  // the glass. Returns { ok, title, text, note, n } - the caller decides how loud to be about it.
  async function run(line, opts) {
    opts = opts || {};
    var by = (opts.by === "lia") ? "lia" : "patrikios";
    var ctx = { by: by, at: opts.at || Date.now() };
    var raw = String(line == null ? "" : line).trim();
    if (!raw) return { ok: false, title: "ARCHIVAX", text: "NOTHING TO DO. /archivax OPS LISTS WHAT SHE MAY BE TOLD TO DO." };
    var sp = raw.indexOf(" ");
    var opId = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase();
    var args = (sp === -1 ? "" : raw.slice(sp + 1)).trim();
    var op = opById(opId);
    if (!op) {
      return {
        ok: false, title: "NO SUCH OPERATION :: " + opId.toUpperCase(),
        text: "SHE DOES OPS ON THE RECORD, NOT CODE. WHAT SHE CAN BE TOLD TO DO:\n" + opList()
      };
    }
    var res;
    try { res = await RUN[op.id](args, ctx); }
    catch (e) {
      res = { ok: false, title: "SHE FAILED AT " + op.id.toUpperCase(), text: (e && e.message) ? e.message : String(e) };
    }
    res = res || { ok: false, title: "SHE DID NOTHING", text: "" };
    res.op = op.id;
    res.by = by;
    if (res.ok) {
      await log({
        ts: ctx.at, op: op.id, by: by, n: res.n || 0,
        note: res.note || (res.title ? short(res.title, 90) : "")
      });
    }
    return res;
  }

  function print(text, dim) { if (window.print && text) window.print('SYSTEM', text, !!dim); }

  // Run one op for Patrikios, out loud. Used by the /archivax command.
  async function order(line, opts) {
    var res = await run(line, opts || { by: "patrikios" });
    print(reportOf(res), false);
    return res;
  }

  function reportOf(res) {
    if (!res) return "ARCHIVAX :: NOTHING HAPPENED.";
    var head = "ARCHIVAX :: " + String(res.title || "");
    return head + (res.text ? "\n" + res.text : "");
  }

  window.archivax = {
    id: roleId,
    name: name,
    role: role,
    run: run,
    order: order,
    print: print,
    reportOf: reportOf,
    ops: function () { return OPS.slice(); },
    opList: opList,
    // THE VISION ROAD, OPENED. The docs above are hers; these are the same two functions the ops
    // use, exposed so the bulk CLASSIFIER in tools.js reads a picture and files what it found by
    // exactly the road she uses - one answer in the terminal to "what is in this picture", never
    // two. `look` writes nothing; `fileReading` is the write. `journalAdd` files one entry in her
    // journal, so a pass run from the deck is still on her revision history.
    look: function (id, opts) { return look(id, opts); },
    fileReading: function (id, found, by, opts) { return fileReading(id, found, by, opts); },
    journalAdd: function (entry) { return log(entry); },
    parseBucket: parseBucket,
    // WHAT SHE READS, AND WHAT A CLIP COSTS. The bulk classifier in tools.js asks these rather than
    // keeping its own copy of the rule, so the plan, the token estimate and the reading itself can
    // never disagree about a clip.
    isClip: isClip,
    isPicture: isPicture,
    clipFrames: clipFrameCount,
    clipFramePrompt: clipFramePrompt,
    // How many things in the vault have never had a reading - what `sweep` would take next.
    pending: function () { return unread(9999).length; },
    journal: function () { return journal.slice(); },
    clearJournal: async function () {
      var n = journal.length;
      journal = [];
      var s = kv();
      if (s) { try { await s.set(JOURNAL_KEY, []); } catch (e) {} }
      return n;
    },
    status: function () { return RUN.status("", { by: "patrikios" }); },

    // THE BLOCK SHE IS GIVEN. Built at send time like the other built blocks (see instr.js), so
    // what the SYSTEM panel shows under ARCHIVAX is the text actually in force, and an edit of
    // Patrikios's there wins. It is written from the manifest so her role here cannot drift.
    blockText: function () {
      var lines = [];
      lines.push(name().toUpperCase() + " - " + role() + " - TENDS THE RECORD.");
      lines.push("She is not a role and not a voice: she is the terminal's own agent, and she works ON THE RECORD (order " + (manifest ? manifest.order : 0)
        + " of the manifest, lore policy read " + readPolicy() + " / write " + writePolicy() + "), not in the conversation.");
      if (constraints().length) lines.push("The factory's own note on her: " + constraints().join("; ").toLowerCase()
        + ". She could only ever report what was already there - these hands are the terminal's, and they only reach the vault.");
      lines.push("You can put her to work. Write ONE line on its own - it is carried out and taken off the page, like your other directive lines:");
      lines.push("[[ARCHIVAX: the operation, and what to do it to]]");
      lines.push("WHAT SHE CAN DO:");
      lines.push(opList());
      lines.push("SHE NAMES THINGS THE WAY EVERYTHING HERE DOES: a row of the book (R12), a #tag, or words - so [[ARCHIVAX: file /images/portraits :: R12]] and [[ARCHIVAX: classify the newest three]] both work.");
      lines.push("THE LIMITS, WHICH ARE HERS AND NOT YOURS TO LIFT: she may file, tag and READ what the terminal itself made - a render, an upscale. She may not move, rewrite or tag anything Patrikios handed over himself ("
        + "only he may order that), she never deletes anything, she cannot run code or reach outside this terminal except through the vision model she reads pictures with, and every op she runs is written into her journal and into this turn's record.");
      lines.push("A CLIP IS READ AS A SEQUENCE, NOT AS A STILL: it reaches the vision model as " + clipFrameCount() + " stills spread from its opening to its end, so what is written on it is what happens ACROSS it. The stills are read once and are not kept - the clip and its own thumbnail are what stay in the vault. A clip that already carries a reading keeps it while her reading is taken for its tags and its bucket.");
      lines.push("READING a thing is not a change to it: it is written onto the record as its sight, and it is what lets a thing be found later by what is IN it. Use her when the record needs tending - not as conversation, and not to describe a picture to Patrikios in words (you have [[VISION: ...]] and [[SHOW: ...]] for that).");
      return lines.join("\n");
    },

    load: async function () {
      try {
        if (window.mythos && window.mythos.canonicalAgent) {
          await (window.mythos.canonical ? window.mythos.canonical() : null);
          manifest = window.mythos.canonicalAgent(AGENT_ID) || null;
        }
      } catch (e) { console.warn("archivax manifest unreadable", e); }
      var s = kv();
      if (s) {
        try {
          var v = await s.get(JOURNAL_KEY);
          if (Array.isArray(v)) journal = v.slice(-JOURNAL_MAX);
        } catch (e) { console.warn("archivax journal unreadable", e); }
      }
      return { agent: manifest ? manifest.id : "", journal: journal.length };
    },

    // What /help archivax prints, and the boot line - both built from the same live pieces.
    describe: function () {
      return name().toUpperCase() + " :: " + role().toUpperCase() + "\n"
        + "  THE TERMINAL'S OWN AGENT (ORDER " + (manifest ? manifest.order : 0) + " OF THE MANIFEST" + (manifest ? ", PORT " + manifest.port : "") + ", REVISION " + revision().toUpperCase() + ")."
        + " She works ON THE RECORD, not in the conversation: filing pictures into folders, tagging them, and reading them so that what is IN a picture is written down and can be found by it.\n"
        + "  FROM YOUR SIDE :: /archivax <OP> ...  (/archivax STATUS, /archivax OPS, /archivax JOURNAL)\n"
        + "  FROM HERS :: one line in her reply - [[ARCHIVAX: <OP> ...]] - carried out here and taken off the page.\n"
        + "  THE GLASS :: she may file, tag and read what the TERMINAL MADE. She may not touch what you handed over yourself unless you order it, she never deletes anything, and every op is written into her journal and into the turn's record.\n"
        + "  " + opMax() + " OP" + (opMax() === 1 ? "" : "S") + " PER REPLY, AND AT MOST " + sightMax() + " PICTURES READ IN ONE OP (LIA_ARCHIVAX_MAX / LIA_ARCHIVAX_SIGHT_MAX, src/js/config.js).\n"
        + opList();
    }
  };
})();
