window.MythosArchivax = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var AGENT_ID = "ARCHIVAX";
  var JOURNAL_MAX = opts.journalMax || 200;
  var DEFAULT_ROLE = "Agent of Memory, Commitment, and Revision History";
  var DEFAULT_PROMPT = [
    "You are reading a picture so that it can be filed and found later.",
    "Answer with exactly two lines and nothing else.",
    "Line 1: one plain factual sentence describing what is actually shown - the subject, the setting, the action and the mood. No speculation, no names, no address to anyone.",
    "Line 2: begins with \"TAGS:\" and then up to six single lowercase words or hyphenated pairs covering the subject, the setting, the mood and the style, separated by commas. No #, and no punctuation inside a word."
  ].join("\n");
  var DEFAULT_CLIP_FRAME_PROMPT = "This is one frame from a moving clip. In one terse sentence say what this single frame shows - the subject, what it is doing, and where it is. Do not guess at anything before or after this moment. No judgement and no praise.";
  var manifest = opts.manifest || null;
  var journal = [];
  function VAULT() { return opts.vault || null; }
  function GEN() { return (typeof opts.generateText === "function") ? opts.generateText : null; }
  function FRAMES() { return (typeof opts.sampleFrames === "function") ? opts.sampleFrames : null; }
  function LOOKBLOB() { return (typeof opts.lookBlob === "function") ? opts.lookBlob : null; }
  function JSTORE() { return opts.journalStore || null; }
  function STAMP(ts) {
    if (typeof opts.stamp === "function") { try { return opts.stamp(ts); } catch (e) {} }
    return "";
  }
  function name() { return manifest ? manifest.name : "Archivax"; }
  function role() { return (manifest && manifest.role) ? manifest.role : DEFAULT_ROLE; }
  function roleId() { return manifest ? manifest.id : AGENT_ID; }
  function revision() { return (manifest && manifest.revision) ? manifest.revision : "ara:2025-12-14"; }
  function policyText(v) { return (v && v.length) ? v.join("/").toUpperCase() : "NONE"; }
  function readPolicy() { return policyText(manifest && manifest.read); }
  function writePolicy() { return policyText(manifest && manifest.write); }
  function constraints() { return (manifest && manifest.constraints && manifest.constraints.length) ? manifest.constraints.slice() : []; }
  function opMax() {
    var n = (typeof opts.opMax === "number") ? opts.opMax : 2;
    return (isFinite(n) && n > 0) ? Math.round(n) : 2;
  }
  function sightMax() {
    var n = (typeof opts.sightMax === "number") ? opts.sightMax : 4;
    return (isFinite(n) && n > 0) ? Math.round(n) : 4;
  }
  function sightPrompt() {
    return (typeof opts.sightPrompt === "string" && opts.sightPrompt.trim()) ? String(opts.sightPrompt).trim() : DEFAULT_PROMPT;
  }
  function clipFrameCount() {
    var n = (typeof opts.clipFrames === "number") ? Math.round(opts.clipFrames) : 6;
    if (!isFinite(n) || n < 0) n = 0;
    return Math.max(0, Math.min(24, n));
  }
  function clipFramePrompt() {
    return (typeof opts.clipFramePrompt === "string" && opts.clipFramePrompt.trim()) ? String(opts.clipFramePrompt).trim() : DEFAULT_CLIP_FRAME_PROMPT;
  }
  function onlyMadeFor(by) { return by !== "patrikios"; }
  function mayWriteOn(rec, by) {
    if (by === "patrikios") return true;
    if (!rec) return false;
    return rec.kind === "gen" || rec.kind === "upscale";
  }
  function normTag(t) {
    var V = VAULT();
    if (V && typeof V.normTag === "function") { try { return V.normTag(t); } catch (e) {} }
    return String(t == null ? "" : t).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  function normFolder(p) {
    var V = VAULT();
    if (V && typeof V.normFolder === "function") { try { return V.normFolder(p); } catch (e) {} }
    var s = String(p == null ? "" : p).trim();
    if (!s) return "";
    if (s[0] !== "/") s = "/" + s;
    return s.toLowerCase().replace(/[^a-z0-9\/\-_]+/g, "-");
  }
  function labelOf(id) {
    if (typeof opts.labelOf === "function") { try { return opts.labelOf(id); } catch (e) {} }
    var V = VAULT();
    var rec = V ? V.get(id) : null;
    if (V && rec && typeof V.recordLabel === "function") { try { return V.recordLabel(rec); } catch (e) {} }
    return rec ? (rec.name || id) : id;
  }
  function short(text, n) {
    var s = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
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
  var OPS = [
    { id: "status", usage: "status", what: "what she has already done (the journal), and the shape of the record as she sees it" },
    { id: "read", usage: "read <what>", what: "go and LOOK at things - detect what is in them with the vision model - and write her reading onto each record as its sight. Reading the record is not a change to it, so either of you may order this" },
    { id: "classify", usage: "classify <what>", what: "read the pictures AND act on what she found: her reading is written onto each record as its sight, and the content tags she names are filed on it. She only TAGS pictures the terminal made when a LIA ordered it" },
    { id: "tag", usage: "tag <what> :: #tag #tag", what: "file tags onto the pictures that match <what>. A LIA may tag only what the terminal made" },
    { id: "untag", usage: "untag <what> :: #tag", what: "take tags back off the pictures that match <what>" },
    { id: "file", usage: "file <PATH> :: <what>", what: "move the pictures that match <what> into a folder (making it if it is not there yet). With nothing after the :: she files what the terminal made most recently" },
    { id: "sweep", usage: "sweep [N]", what: "the standing job: look at the newest N things that have never had a reading (default 3) and write one onto each" },
    { id: "ops", usage: "ops", what: "this list" }
  ];
  function opById(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase(), i;
    for (i = 0; i < OPS.length; i++) if (OPS[i].id === want) return OPS[i];
    return null;
  }
  function opList() {
    return OPS.map(function (o) { return "  " + o.usage.toUpperCase() + " :: " + o.what; }).join("\n");
  }
  function pick(what, by, max) {
    var spec = String(what == null ? "" : what).trim();
    if (!spec) return Promise.resolve({ ids: [], label: "" });
    if (typeof opts.resolve === "function") {
      try { return Promise.resolve(opts.resolve(spec, { onlyMade: onlyMadeFor(by), max: max })); }
      catch (e) { return Promise.resolve({ ids: [], label: spec }); }
    }
    var V = VAULT();
    if (!V) return Promise.resolve({ ids: [], label: spec });
    var ids = spec.split(/[\s,]+/).filter(function (x) { return !!x; }).filter(function (x) {
      var r = V.get(x);
      if (!r) return false;
      if (onlyMadeFor(by)) return r.kind === "gen" || r.kind === "upscale";
      return true;
    });
    return Promise.resolve({ ids: ids.slice(0, max || 60), label: spec });
  }
  function isPicture(rec) {
    if (!(rec && rec.id && rec.blob)) return false;
    if (typeof opts.isLookable === "function") { try { return !!opts.isLookable(rec.id); } catch (e) { return false; } }
    return /^image\//.test(String(rec.mime || "image/png"));
  }
  function isClip(rec) {
    return !!(rec && (rec.kind === "video" || /^video\//.test(String(rec.mime || ""))));
  }
  function frameLabel(i, n) {
    if (n <= 1) return "its opening";
    if (i === 0) return "opens on";
    if (i === n - 1) return "ends on";
    return "then";
  }
  function unread(max) {
    var V = VAULT();
    if (!V) return [];
    var frames = clipFrameCount();
    var ids = V.list().filter(function (id) {
      var r = V.get(id);
      if (!r || String(r.sight || "").trim()) return false;
      if (isPicture(r)) return true;
      return isClip(r) && !!r.blob && frames > 0;
    });
    return ids.slice(-max);
  }
  function newestMade(max) {
    var V = VAULT();
    if (!V) return [];
    var ids = V.list().filter(function (id) {
      var r = V.get(id);
      return !!(r && r.blob && (r.kind === "gen" || r.kind === "upscale"));
    });
    return ids.slice(-max);
  }
  function parseBucket(s) {
    var t = String(s == null ? "" : s).split(/[.,;:()\n]/)[0].trim();
    var words = t.split(/\s+/).filter(Boolean).slice(0, 5).join("-");
    var n = normTag(words);
    return n && n.length > 1 ? n : "";
  }
  function parseTags(s, max) {
    var out = [];
    var cap = Number(max) > 0 ? Math.round(Number(max)) : 6;
    String(s == null ? "" : s).split(/[,;]+/).forEach(function (t) {
      var n = normTag(t);
      if (n && n.length > 1 && out.indexOf(n) === -1 && out.length < cap) out.push(n);
    });
    return out;
  }
  function parseReading(text, tagMax) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { ok: false, why: "she came back with nothing" };
    var parts = raw.split("\n"), tags = [], bucket = "", desc = [];
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
  function look(id, lopts) {
    lopts = lopts || {};
    var V = VAULT();
    if (!V) return Promise.resolve({ ok: false, why: "the vault is offline" });
    var rec = V.get(id);
    if (!rec) return Promise.resolve({ ok: false, why: "not in the vault" });
    if (!rec.blob) return Promise.resolve({ ok: false, why: "there is no picture in that record" });
    if (isClip(rec)) return lookClip(rec, lopts);
    if (!isPicture(rec)) return Promise.resolve({ ok: false, why: "a recording is media, not something to read" });
    var G = GEN();
    if (!G) return Promise.resolve({ ok: false, why: "the vision model is not reachable" });
    var asked = (lopts.prompt && String(lopts.prompt).trim()) ? String(lopts.prompt).trim() : sightPrompt();
    return Promise.resolve(G({ instruction: [asked + "\n\n", rec.blob] })).then(function (raw) {
      return parseReading(raw, lopts.tagMax);
    }, function (e) {
      return { ok: false, why: (e && e.message) ? e.message : String(e) };
    });
  }
  function clipSight(rec, copts) {
    copts = copts || {};
    var want = clipFrameCount();
    if (!want) return Promise.resolve({ ok: false, off: true, why: "the clip sequence is switched off here (clipFrames = 0)" });
    var SF = FRAMES();
    if (!SF) return Promise.resolve({ ok: false, why: "the frame sampler is offline" });
    var LB = LOOKBLOB();
    if (!LB) return Promise.resolve({ ok: false, why: "the vision road is offline" });
    if (!GEN()) return Promise.resolve({ ok: false, why: "the vision model is not reachable" });
    var asked = (copts.prompt && String(copts.prompt).trim()) ? String(copts.prompt).trim() : clipFramePrompt();
    var tagMax = copts.tagMax || 6;
    return Promise.resolve(SF(rec.blob, { count: want })).then(function (samp) {
      var frames = (samp && samp.frames) || [];
      if (!frames.length) return { ok: false, why: (samp && samp.error) || "no frame of it could be drawn here" };
      var lines = [], tags = [], seen = {}, order = [], calls = 0, chain = Promise.resolve(true);
      frames.forEach(function (fr, i) {
        chain = chain.then(function () {
          if (typeof copts.onFrame === "function") { try { copts.onFrame(i, frames.length); } catch (e) {} }
          return Promise.resolve(LB(fr.blob, asked)).then(function (t) {
            calls++;
            if (!t) return;
            var got = parseReading(t, tagMax);
            if (!got.ok) return;
            lines.push(got.text);
            (got.tags || []).forEach(function (x) {
              if (tags.indexOf(x) === -1 && tags.length < tagMax) tags.push(x);
            });
            if (got.bucket) { if (!seen[got.bucket]) { seen[got.bucket] = 0; order.push(got.bucket); } seen[got.bucket]++; }
          }, function () { calls++; });
        });
      });
      return chain.then(function () {
        if (!lines.length) return { ok: false, why: "not one still of it could be read", calls: calls };
        var text = lines.map(function (t, n) { return "  " + frameLabel(n, lines.length) + ": " + t; }).join("\n");
        var bucket = "";
        order.forEach(function (b) { if (!bucket || seen[b] > seen[bucket]) bucket = b; });
        return { ok: true, text: text, tags: tags, bucket: bucket, clipFrames: lines.length, calls: calls, duration: (samp && samp.duration) || rec.duration || 0, partial: lines.length < frames.length };
      });
    }, function (e) {
      return { ok: false, why: (e && e.message) ? e.message : String(e) };
    });
  }
  function lookClip(rec, lopts) {
    lopts = lopts || {};
    var had = lopts.overwrite ? "" : String(rec.sight || "").trim();
    return clipSight(rec, lopts).then(function (seq) {
      if (!seq.ok) return seq;
      return { ok: true, text: had ? "" : seq.text, tags: seq.tags, bucket: seq.bucket, clipFrames: seq.clipFrames, calls: seq.calls, keptReading: !!had, seconds: seq.duration, partial: !!seq.partial };
    });
  }
  function fileReading(id, found, by, fopts) {
    fopts = fopts || {};
    var V = VAULT();
    if (!V) return Promise.resolve({ id: id, wrote: false, tags: [], why: "the vault is offline" });
    var rec = V.get(id);
    if (!rec) return Promise.resolve({ id: id, wrote: false, tags: [], why: "not in the vault" });
    return Promise.resolve(V.setField(id, "sight", found.text || "")).then(function () {
      if (found.clipFrames) return V.setField(id, "clipFrames", found.clipFrames);
    }).then(function () {
      return V.setField(id, "classifiedAt", Date.now());
    }).then(function () {
      return V.setField(id, "classifiedBy", fopts.mark || roleId());
    }).then(function () {
      var added = [], refused = [], i, chain = Promise.resolve(true);
      if (fopts.tags !== false && found.tags && found.tags.length) {
        if (!mayWriteOn(rec, by)) {
          refused = found.tags.slice();
        } else {
          found.tags.forEach(function (tg) {
            chain = chain.then(function () {
              var already = (V.get(id).tags || []).indexOf(tg) !== -1;
              return Promise.resolve(V.tag(id, tg)).then(function (ok) {
                if (!already && ok) added.push(tg);
              });
            });
          });
        }
      }
      return chain.then(function () {
        var bucket = "";
        if (fopts.bucket && found.bucket) {
          var b = normTag(found.bucket);
          if (!b) return { id: id, wrote: true, tags: added, refused: refused, bucket: "" };
          if (!mayWriteOn(rec, by)) {
            refused = refused.concat([b]);
            return { id: id, wrote: true, tags: added, refused: refused, bucket: "" };
          }
          return Promise.resolve(V.setField(id, "bucket", b)).then(function () {
            var hadB = (V.get(id).tags || []).indexOf(b) !== -1;
            return Promise.resolve(V.tag(id, b)).then(function (tagged) {
              if (!hadB && tagged) added.push(b);
              return { id: id, wrote: true, tags: added, refused: refused, bucket: b };
            });
          });
        }
        return { id: id, wrote: true, tags: added, refused: refused, bucket: bucket };
      });
    });
  }
  var RUN = {
    status: function (args, ctx) {
      var V = VAULT();
      var lines = [];
      var ids = V ? V.list() : [];
      var withSight = 0, pictures = 0, clips = 0, made = 0, other = 0, i, r, readable;
      for (i = 0; i < ids.length; i++) {
        r = V.get(ids[i]);
        if (!r) continue;
        readable = isPicture(r) || (isClip(r) && !!r.blob);
        if (isPicture(r)) pictures++;
        else if (isClip(r) && r.blob) clips++;
        else other++;
        if (readable && String(r.sight || "").trim()) withSight++;
        if (r.kind === "gen" || r.kind === "upscale") made++;
      }
      lines.push("HERSELF :: " + name().toUpperCase() + " :: " + role().toUpperCase()
        + "\n  REVISION " + revision().toUpperCase()
        + "\n  LORE POLICY :: READ " + readPolicy() + " / WRITE " + writePolicy()
        + "\n  CONSTRAINTS :: " + (constraints().length ? constraints().join("; ") : "none recorded"));
      var frames = clipFrameCount();
      lines.push("THE RECORD AS SHE SEES IT :: " + pictures + " PICTURE" + (pictures === 1 ? "" : "S")
        + (clips ? " AND " + clips + " CLIP" + (clips === 1 ? "" : "S")
          + (frames ? " (READ " + frames + " STILLS ACROSS EACH ONE)" : " (THE SEQUENCE IS OFF - THEIR OWN STILLS STAND FOR THEM)") : "")
        + " (" + made + " MADE HERE), " + withSight + " WITH A READING, " + Math.max(0, pictures + clips - withSight) + " WITHOUT ONE"
        + (other ? "\n  " + other + " MORE RECORD" + (other === 1 ? "" : "S") + " ARE MEDIA SHE DOES NOT READ (MUSIC, RECORDINGS)" : ""));
      if (V && typeof V.allTags === "function") {
        var tags = V.allTags();
        lines.push("TAGS :: " + (tags.length ? tags.slice(0, 12).map(function (t) { return "#" + t.tag + "(" + t.count + ")"; }).join("  ·  ") : "none filed yet"));
      }
      if (V && typeof V.allFolders === "function") {
        var fold = V.allFolders();
        lines.push("FOLDERS :: " + (fold.length ? fold.map(function (f) { return f.path + " (" + f.count + ")"; }).join("  ·  ") : "none"));
      }
      if (journal.length) {
        lines.push("HER JOURNAL, MOST RECENT LAST ::");
        journal.slice(-6).forEach(function (j) {
          lines.push("  [" + STAMP(j.ts) + "] " + String(j.op).toUpperCase() + " BY " + String(j.by || "?").toUpperCase() + (j.n ? " :: " + j.n : "") + (j.note ? " :: " + j.note : ""));
        });
        lines.push("  (" + journal.length + " ENTRIES.)");
      } else {
        lines.push("HER JOURNAL IS EMPTY :: NOTHING HAS BEEN ORDERED OF HER YET.");
      }
      return Promise.resolve({ ok: true, title: "THE RECORD, AS SHE KEEPS IT", text: lines.join("\n") });
    },
    ops: function () {
      return Promise.resolve({ ok: true, title: "WHAT SHE MAY BE TOLD TO DO", text: opList() });
    },
    read: function (args, ctx) {
      var want = String(args).trim();
      var gotP = want ? pick(want, ctx.by, sightMax()) : Promise.resolve({ ids: unread(sightMax()), label: "the newest unread" });
      return gotP.then(function (got) {
        if (!got.ids.length) return { ok: false, title: "NOTHING TO LOOK AT", text: nothingMatched(want) };
        var V = VAULT(), done = [], failed = [], clips = 0, chain = Promise.resolve(true);
        got.ids.slice(0, sightMax()).forEach(function (gid) {
          chain = chain.then(function () {
            return look(gid).then(function (found) {
              if (!found.ok) { failed.push(labelOf(gid) + " :: " + found.why); return; }
              if (isClip(V.get(gid))) clips++;
              return fileReading(gid, found, ctx.by, { tags: false }).then(function () {
                done.push(labelOf(gid) + "\n    " + short(found.text || String(V.get(gid).sight || ""), 200));
              });
            });
          });
        });
        return chain.then(function () {
          return {
            ok: !!done.length,
            title: "SHE LOOKED AT " + done.length + " " + itemNoun(done.length, clips) + (got.label ? " :: " + String(got.label).toUpperCase() : ""),
            text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "")
              + "\nTHE READING IS WRITTEN ON EACH RECORD AS ITS SIGHT." + clipNote(clips),
            note: (done.length ? done.length + " read" : ""), n: done.length
          };
        });
      });
    },
    classify: function (args, ctx) {
      var want = String(args).trim();
      var gotP = want ? pick(want, ctx.by, sightMax()) : Promise.resolve({ ids: unread(sightMax()), label: "the newest unread" });
      return gotP.then(function (got) {
        if (!got.ids.length) return { ok: false, title: "NOTHING TO CLASSIFY", text: nothingMatched(want) };
        var done = [], failed = [], refusedAll = 0, clips = 0, chain = Promise.resolve(true);
        got.ids.slice(0, sightMax()).forEach(function (gid) {
          chain = chain.then(function () {
            return look(gid).then(function (found) {
              if (!found.ok) { failed.push(labelOf(gid) + " :: " + found.why); return; }
              var V = VAULT();
              if (isClip(V.get(gid))) clips++;
              return fileReading(gid, found, ctx.by, { tags: true }).then(function (res) {
                refusedAll += (res.refused && res.refused.length) ? res.refused.length : 0;
                done.push(labelOf(gid) + "\n    " + short(found.text || String(V.get(gid).sight || ""), 200)
                  + (res.tags && res.tags.length ? "\n    tags filed :: " + res.tags.map(function (t) { return "#" + t; }).join(" ") : "")
                  + (res.refused && res.refused.length ? "\n    tags she would not file on his own picture :: " + res.refused.map(function (t) { return "#" + t; }).join(" ") : ""));
              });
            });
          });
        });
        return chain.then(function () {
          return {
            ok: !!done.length,
            title: "SHE CLASSIFIED " + done.length + " " + itemNoun(done.length, clips) + (got.label ? " :: " + String(got.label).toUpperCase() : ""),
            text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "")
              + (refusedAll ? "\n" + refusedAll + " TAG" + (refusedAll === 1 ? "" : "S") + " WERE NOT FILED: A LIA MAY NOT WRITE ON WHAT PATRIKIOS HANDED OVER HIMSELF. HE MAY ORDER THIS HIMSELF AT ANY TIME." : "")
              + clipNote(clips),
            n: done.length
          };
        });
      });
    },
    tag: function (args, ctx) {
      var sp = splitOn(args);
      if (!sp.left || !sp.right) return Promise.resolve({ ok: false, title: "TAGGING NEEDS BOTH HALVES", text: "tag <what> :: #tag #tag - THE THING TO TAG FIRST, THEN THE TAGS." });
      var V = VAULT();
      if (!V) return Promise.resolve({ ok: false, title: "THE VAULT IS OFFLINE", text: "NO VAULT WAS GIVEN TO THIS CLIENT." });
      var tags = parseTags(sp.right.replace(/#/g, " "));
      if (!tags.length) return Promise.resolve({ ok: false, title: "NO TAGS IN THAT", text: "NAME THEM AFTER THE :: - tag R12 :: night, rain" });
      return pick(sp.left, ctx.by, sightMax() * 4).then(function (got) {
        if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(sp.left) };
        var filed = [], refused = [], already = 0, clips = 0, chain = Promise.resolve(true);
        got.ids.forEach(function (gid) {
          chain = chain.then(function () {
            var rec = V.get(gid);
            if (!mayWriteOn(rec, ctx.by)) { refused.push(labelOf(gid)); return; }
            var added = [], tch = Promise.resolve(true);
            tags.forEach(function (tg) {
              tch = tch.then(function () {
                var had = (V.get(gid).tags || []).indexOf(tg) !== -1;
                return Promise.resolve(V.tag(gid, tg)).then(function (ok) {
                  if (had) { already++; return; }
                  if (ok) added.push(tg);
                });
              });
            });
            return tch.then(function () {
              if (isClip(rec)) clips++;
              filed.push(labelOf(gid) + (added.length ? " :: " + added.map(function (x) { return "#" + x; }).join(" ") : " :: already carried them"));
            });
          });
        });
        return chain.then(function () {
          return {
            ok: !!filed.length,
            title: "TAGGED " + filed.length + " " + itemNoun(filed.length, clips) + " :: " + tags.map(function (x) { return "#" + x; }).join(" "),
            text: filed.join("\n") + (refused.length ? "\nLEFT ALONE (" + refused.length + ") :: HIS OWN FILE - A LIA MAY NOT WRITE ON ONE. " + refused.join("  ·  ") : ""),
            n: filed.length
          };
        });
      });
    },
    untag: function (args, ctx) {
      var sp = splitOn(args);
      if (!sp.left || !sp.right) return Promise.resolve({ ok: false, title: "UNTAGGING NEEDS BOTH HALVES", text: "untag <what> :: #tag" });
      var V = VAULT();
      if (!V) return Promise.resolve({ ok: false, title: "THE VAULT IS OFFLINE", text: "NO VAULT WAS GIVEN TO THIS CLIENT." });
      var tags = parseTags(sp.right.replace(/#/g, " "));
      if (!tags.length) return Promise.resolve({ ok: false, title: "NO TAGS IN THAT", text: "NAME THEM AFTER THE :: - untag R12 :: night" });
      return pick(sp.left, ctx.by, sightMax() * 4).then(function (got) {
        if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(sp.left) };
        var off = [], refused = [], chain = Promise.resolve(true);
        got.ids.forEach(function (gid) {
          chain = chain.then(function () {
            var rec = V.get(gid);
            if (!mayWriteOn(rec, ctx.by)) { refused.push(labelOf(gid)); return; }
            var gone = [], tch = Promise.resolve(true);
            tags.forEach(function (tg) {
              tch = tch.then(function () {
                if ((V.get(gid).tags || []).indexOf(tg) === -1) return;
                return Promise.resolve(V.untag(gid, tg)).then(function (ok) { if (ok) gone.push(tg); });
              });
            });
            return tch.then(function () {
              off.push(labelOf(gid) + (gone.length ? " :: -" + gone.map(function (x) { return "#" + x; }).join(" -") : " :: did not carry them"));
            });
          });
        });
        return chain.then(function () {
          return { ok: true, title: "UNTAGGED " + off.length + " PICTURE" + (off.length === 1 ? "" : "S"), text: off.join("\n") + (refused.length ? "\nLEFT ALONE (" + refused.length + ") :: HIS OWN FILE. " + refused.join("  ·  ") : ""), n: off.length };
        });
      });
    },
    file: function (args, ctx) {
      var sp = splitOn(args);
      var V = VAULT();
      if (!V) return Promise.resolve({ ok: false, title: "THE VAULT IS OFFLINE", text: "NO VAULT WAS GIVEN TO THIS CLIENT." });
      if (!sp.left) return Promise.resolve({ ok: false, title: "FILING NEEDS A FOLDER", text: "file /images/portraits :: R12 R14 - THE FOLDER FIRST. WITH NOTHING AFTER THE :: SHE FILES WHAT THE TERMINAL MADE MOST RECENTLY." });
      var path = normFolder(sp.left);
      if (!path) return Promise.resolve({ ok: false, title: "THAT IS NOT A FOLDER", text: "A FOLDER IS A PATH - /images, /music, /images/portraits." });
      if (typeof V.fileMany !== "function") return Promise.resolve({ ok: false, title: "FILING IS OFFLINE", text: "THIS VAULT CANNOT FILE." });
      var want = sp.right ? String(sp.right).trim() : "";
      var gotP = want ? pick(want, ctx.by, 60) : Promise.resolve({ ids: newestMade(sightMax()), label: "the newest the terminal made" });
      return gotP.then(function (got) {
        if (!got.ids.length) return { ok: false, title: "NOTHING MATCHED", text: nothingMatched(want) };
        return Promise.resolve(V.fileMany(got.ids, path, { by: "archivax", onlyMade: onlyMadeFor(ctx.by), max: 60 })).then(function (res) {
          if (!res.ok) {
            return { ok: false, title: "SHE COULD NOT FILE INTO " + path, text: res.error + (res.skipped && res.skipped.length ? "\nLEFT WHERE THEY WERE (" + res.skipped.length + ") :: " + res.skipped.slice(0, 8).map(function (s) { return s.name + " (" + s.why + ")"; }).join("  ·  ") : "") };
          }
          var names = res.filed.map(labelOf);
          return { ok: true, title: "FILED " + res.filed.length + " INTO " + path, text: names.join("  ·  ") + (res.skipped && res.skipped.length ? "\nLEFT WHERE THEY WERE (" + res.skipped.length + ") :: " + res.skipped.slice(0, 8).map(function (s) { return s.name + " (" + s.why + ")"; }).join("  ·  ") : ""), note: "\u2192 " + path, n: res.filed.length };
        });
      });
    },
    sweep: function (args, ctx) {
      var want = parseInt(String(args).trim(), 10);
      if (!isFinite(want) || want < 1) want = 3;
      want = Math.min(want, sightMax());
      var ids = unread(want);
      if (!ids.length) return Promise.resolve({ ok: false, title: "NOTHING IS WAITING", text: "EVERY PICTURE AND CLIP IN THE VAULT HAS A READING." });
      var V = VAULT(), done = [], failed = [], clips = 0, chain = Promise.resolve(true);
      ids.forEach(function (gid) {
        chain = chain.then(function () {
          return look(gid).then(function (found) {
            if (!found.ok) { failed.push(labelOf(gid) + " :: " + found.why); return; }
            if (isClip(V.get(gid))) clips++;
            return fileReading(gid, found, ctx.by, { tags: false }).then(function () {
              done.push(labelOf(gid) + "\n    " + short(found.text || String(V.get(gid).sight || ""), 180));
            });
          });
        });
      });
      return chain.then(function () {
        var leftIds = unread(9999), left = leftIds.length;
        var leftClips = leftIds.filter(function (x) { return isClip(V.get(x)); }).length;
        return {
          ok: !!done.length,
          title: "SWEPT " + done.length + " " + itemNoun(done.length, clips) + " INTO THE RECORD",
          text: done.join("\n") + (failed.length ? "\nNOT READ (" + failed.length + ") :: " + failed.join("  ·  ") : "") + "\n" + left + " " + itemNoun(left, leftClips) + " STILL WITHOUT A READING." + clipNote(clips),
          n: done.length
        };
      });
    }
  };
  function splitOn(args) {
    var s = String(args == null ? "" : args);
    var at = s.indexOf("::");
    if (at === -1) return { left: s.trim(), right: "" };
    return { left: s.slice(0, at).trim(), right: s.slice(at + 2).trim() };
  }
  function nothingMatched(want) {
    return "NOTHING IN THE VAULT MATCHES " + (String(want || "").trim() ? "\"" + String(want).toUpperCase() + "\" " : "") + "- SHE NAMES THINGS THE WAY THE REST OF THE TERMINAL DOES: AN ID, A #TAG, OR WORDS.";
  }
  function log(entry) {
    journal.push(entry);
    if (journal.length > JOURNAL_MAX) journal = journal.slice(-JOURNAL_MAX);
    var s = JSTORE();
    if (s && typeof s.set === "function") {
      try { return Promise.resolve(s.set("archivax_log", journal.slice())).then(function () { return true; }, function () { return false; }); }
      catch (e) { return Promise.resolve(false); }
    }
    return Promise.resolve(true);
  }
  function run(line, ropts) {
    ropts = ropts || {};
    var by = (ropts.by === "lia") ? "lia" : "patrikios";
    var ctx = { by: by, at: ropts.at || Date.now() };
    var raw = String(line == null ? "" : line).trim();
    if (!raw) return Promise.resolve({ ok: false, title: "ARCHIVAX", text: "NOTHING TO DO. OPS LISTS WHAT SHE MAY BE TOLD TO DO." });
    var sp = raw.indexOf(" ");
    var opId = (sp === -1 ? raw : raw.slice(0, sp)).toLowerCase();
    var args = (sp === -1 ? "" : raw.slice(sp + 1)).trim();
    var op = opById(opId);
    if (!op) return Promise.resolve({ ok: false, title: "NO SUCH OPERATION :: " + opId.toUpperCase(), text: "SHE DOES OPS ON THE RECORD, NOT CODE. WHAT SHE CAN BE TOLD TO DO:\n" + opList() });
    var res;
    try { res = RUN[op.id](args, ctx); }
    catch (e) { res = Promise.resolve({ ok: false, title: "SHE FAILED AT " + op.id.toUpperCase(), text: (e && e.message) ? e.message : String(e) }); }
    return Promise.resolve(res).then(function (r) {
      r = r || { ok: false, title: "SHE DID NOTHING", text: "" };
      r.op = op.id;
      r.by = by;
      if (r.ok) {
        return log({ ts: ctx.at, op: op.id, by: by, n: r.n || 0, note: r.note || (r.title ? short(r.title, 90) : "") }).then(function () { return r; });
      }
      return r;
    }, function (e) {
      return { ok: false, title: "SHE FAILED AT " + op.id.toUpperCase(), text: (e && e.message) ? e.message : String(e), op: op.id, by: by };
    });
  }
  function reportOf(res) {
    if (!res) return "ARCHIVAX :: NOTHING HAPPENED.";
    var head = "ARCHIVAX :: " + String(res.title || "");
    return head + (res.text ? "\n" + res.text : "");
  }
  function order(line, oopts) {
    return run(line, (oopts && oopts.by) ? oopts : { by: "patrikios" }).then(function (res) {
      if (typeof opts.print === "function") { try { opts.print(reportOf(res)); } catch (e) {} }
      return res;
    });
  }
  function load() {
    var s = JSTORE();
    if (!s || typeof s.get !== "function") return Promise.resolve({ journal: journal.length });
    return Promise.resolve(s.get("archivax_log")).then(function (v) {
      if (Array.isArray(v)) journal = v.slice(-JOURNAL_MAX);
      return { journal: journal.length };
    }, function () { return { journal: journal.length }; });
  }
  load();
  return {
    run: run,
    order: order,
    reportOf: reportOf,
    ops: function () { return OPS.slice(); },
    opList: opList,
    look: function (id, lopts) { return look(id, lopts); },
    fileReading: function (id, found, by, fopts) { return fileReading(id, found, by, fopts); },
    journalAdd: function (entry) { return log(entry); },
    parseBucket: parseBucket,
    parseTags: function (s, max) { return parseTags(s, max); },
    parseReading: function (t, max) { return parseReading(t, max); },
    isClip: isClip,
    isPicture: isPicture,
    clipFrames: clipFrameCount,
    clipFramePrompt: clipFramePrompt,
    pending: function () { return unread(9999).length; },
    journal: function () { return journal.slice(); },
    clearJournal: function () {
      var n = journal.length;
      journal = [];
      var s = JSTORE();
      if (s && typeof s.set === "function") {
        return Promise.resolve(s.set("archivax_log", [])).then(function () { return n; }, function () { return n; });
      }
      return Promise.resolve(n);
    },
    status: function () { return RUN.status("", { by: "patrikios" }); },
    describe: function () {
      return name().toUpperCase() + " :: " + role().toUpperCase() + "\n"
        + "  THE TERMINAL'S OWN AGENT (REVISION " + revision().toUpperCase() + "). She works ON THE RECORD, not in the conversation: filing pictures into folders, tagging them, and reading them so that what is IN a picture is written down and can be found by it.\n"
        + "  THE GLASS :: she may file, tag and read what the TERMINAL MADE. She may not touch what was handed over unless ordered by patrikios, she never deletes anything, and every op is written into her journal.\n"
        + "  " + opMax() + " OP" + (opMax() === 1 ? "" : "S") + " PER REPLY, AND AT MOST " + sightMax() + " PICTURES READ IN ONE OP.\n"
        + opList();
    },
    blockText: function () {
      var lines = [];
      lines.push(name().toUpperCase() + " - " + role() + " - TENDS THE RECORD.");
      lines.push("She is not a role and not a voice: she is the terminal's own agent, and she works ON THE RECORD, not in the conversation.");
      if (constraints().length) lines.push("Standing note: " + constraints().join("; ").toLowerCase());
      lines.push("Put her to work with ONE line on its own:");
      lines.push("[[ARCHIVAX: the operation, and what to do it to]]");
      lines.push("WHAT SHE CAN DO:");
      lines.push(opList());
      lines.push("THE LIMITS: she may file, tag and READ what the terminal itself made. She may not move, rewrite or tag anything handed over (only patrikios may order that), she never deletes anything, she cannot run code, and every op she runs is written into her journal.");
      return lines.join("\n");
    }
  };
}
return { client: client };
})();
