// src/js/vox.js - THE VOX PANEL.
//
// Patrikios, 2026-09-30: *"Create 'VOX' button so I can preview all the voices and select which one I
// want for the default voice."* And, in the same breath, a question about the story lane: *"Are we able
// add a sample for a cloned voice from any of the voices?"*
//
// A BUTTON, A PANEL, AND THE ONE ROAD BETWEEN THE TWO VOICE LANES. The terminal already has four sets of
// voices, each owned by the module that knows how to speak through it - this browser's own list
// (src/js/voice.js), the wire's thirty (src/js/live.js), the local model's roster (src/js/kokoro.js) and
// the ElevenLabs account (the keyring). What it did not have was ONE PLACE to walk all four, hear any of
// them, and keep one. That is this panel, and it is deliberately a FRONT-END: every list comes from the
// module that owns it and every write goes through voice.voxSet(), which makes the same write its own
// /voice verb makes. There is no second way of setting a voice here.
//
// AND THE CLONE SAMPLE. The story lane (src/js/story.js) clones an agent's voice from a CLIP in the
// vault - until now he had to find or record one himself. Two of the four roads hand back BYTES (the
// local model a WAV, ElevenLabs an mp3), so from those two a clip can be MADE: the panel synthesizes the
// sample line, files it in the VOX tree under the agent it is for, and sets it as what that agent is
// cloned from. The other two roads cannot: the Web Speech API plays into the speakers and exposes no
// audio to capture at all, and the wire's voices are synthesized inside a live socket - what arrives is
// speech being streamed, not a file. That is a property of the road, not a choice, and the panel says so
// in words rather than showing a button that cannot work.
//
// WHERE IT SITS. Same rules as every other deck panel (src/css/terminal.css): it hangs above the lower
// deck, one panel at a time, and the deck below it is hidden while it is up.
window.vox = (function () {
  "use strict";

  var target = "";          // "" = follow the role on stage; otherwise a role id (or "default")
  var busy = false;         // a preview or a mint is in flight
  var lastLine = "";        // the last thing said here, so the panel can show it
  var facBusy = false;      // a factory render is in flight
  var facAudio = null;      // what the factory last spoke through
  var facLast = null;       // { blob, text } - what KEEP files
  var roadLive = {};
  var facTxFor = "";        // sample id the transcript box was painted for

  function el(id) { return document.getElementById(id); }
  function say(text) { if (typeof window.print === "function" && text) window.print("SYSTEM", text); }
  function V() { return window.voice || null; }
  function M() { return window.media || null; }
  function S() { return window.story || null; }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }

  // THE SAMPLE LINE. The same sentence the audition uses, so a clip made here is the same shape as the
  // one he has already heard - and it is short on purpose: ElevenLabs bills by the character, and the
  // Space only listens to the first seconds of a clip anyway.
  function sampleLine() {
    var v = V();
    try { return v && v.sample ? String(v.sample()) : ""; } catch (e) { return ""; }
  }

  // ---- the target ---------------------------------------------------------
  //
  // "THE DEFAULT VOICE" is a real slot in this terminal - the `default` role covers LIA off stage and
  // every agent without an entry of its own - so the panel offers exactly two targets and says which is
  // in force. Anything finer is one command away (/voice ... for <ROLE>).
  function targets() {
    var out = [{ id: "default", label: "THE DEFAULT", note: "LIA OFF STAGE AND ANY AGENT WITHOUT ITS OWN" }];
    var now = "";
    try { now = window.roles && window.roles.currentId ? String(window.roles.currentId() || "") : ""; } catch (e) { now = ""; }
    if (now) {
      var title = now;
      try { var r = window.roles.get(now); if (r) title = String(r.title || r.id || now); } catch (e) { }
      out.push({ id: now, label: "ON STAGE · " + up(title), note: "THE AGENT SHE IS WEARING RIGHT NOW" });
    }
    return out;
  }
  function targetId() {
    var list = targets();
    for (var i = 0; i < list.length; i++) if (list[i].id === target) return target;
    return list[0].id;
  }
  function targetRoleId() { var t = targetId(); return t === "default" ? "default" : t; }

  // ---- the panel ----------------------------------------------------------

  function isOpen() { var p = el("voxPanel"); return !!(p && !p.hidden); }

  function open() {
    var p = el("voxPanel");
    if (!p) return;
    // one deck panel at a time (the same courtesy every other panel extends)
    if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close();
    if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close();
    if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close();
    if (window.sync && window.sync.isOpen && window.sync.isOpen()) window.sync.close();
    if (window.pair && window.pair.isOpen && window.pair.isOpen()) window.pair.panelClose();
    p.hidden = false;
    paint();
    if (typeof syncDeckSpace === "function") syncDeckSpace();
    say(report());
  }

  function close() {
    var p = el("voxPanel");
    if (p) p.hidden = true;
    if (typeof syncDeckSpace === "function") syncDeckSpace();
  }

  function toggle() { if (isOpen()) close(); else open(); }

  function onBtn() {
    var b = el("voxBtn");
    if (!b) return;
    b.classList.toggle("on", isOpen());
    b.setAttribute("aria-pressed", isOpen() ? "true" : "false");
  }

  function paintTargets() {
    var box = el("vxTargets");
    if (!box) return;
    var list = targets(), cur = targetId();
    box.innerHTML = "";
    var lab = document.createElement("span");
    lab.className = "cpLabel";
    lab.textContent = "VOICE FOR";
    box.appendChild(lab);
    list.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.target = t.id;
      b.textContent = t.label;
      b.title = t.note;
      if (t.id === cur) b.className = "on";
      b.addEventListener("click", function () { target = t.id; paint(); });
      box.appendChild(b);
    });
  }

  function rowFor(road, v) {
    var row = document.createElement("div");
    row.className = "vxRow" + (v.current ? " current" : "") + (v.off ? " off" : "");

    var play = document.createElement("button");
    play.type = "button";
    play.className = "vxPlay";
    play.textContent = "\u25B6";
    play.title = "hear it say the sample line - nothing is saved"
      + (road === "elevenlabs" ? " (ELEVENLABS BILLS ONE CREDIT PER CHARACTER, SO A PREVIEW HERE COSTS WHAT SAYING IT COSTS)" : "");
    play.addEventListener("click", function () { hear(road, v, play); });
    row.appendChild(play);

    var name = document.createElement("span");
    name.className = "vxName";
    name.textContent = v.label;
    row.appendChild(name);

    // MALE OR FEMALE (src/voice/voices.json -> sex). The chip is drawn only where the sex is KNOWN:
    // the local model and ElevenLabs state it themselves (and the title says so), while this browser's
    // list and the wire publish no such field and are read from the NAME (and the title says that
    // instead). No chip means nobody has sexed that voice - never that it was forgotten.
    if (v.sex === "F" || v.sex === "M") {
      var sx = document.createElement("span");
      sx.className = "vxSex " + (v.sex === "F" ? "f" : "m");
      sx.textContent = v.sex;
      sx.title = (v.sex === "F" ? "female" : "male") + (road === "kokoro" || road === "elevenlabs"
        ? " - the voice's own provider says so, not a guess"
        : " - read from the voice's name; the engine publishes no such field, so correct it in src/voice/voices.json if it is wrong");
      row.appendChild(sx);
    }

    var note = document.createElement("span");
    note.className = "vxNote";
    note.textContent = v.note || "";
    row.appendChild(note);

    if (v.current && roadLive[road]) {
      var tag = document.createElement("span");
      tag.className = "vxOn";
      tag.textContent = "IN USE";
      tag.title = "the voice she actually speaks with - this is the road the engine is set to";
      row.appendChild(tag);
    } else if (v.current) {
      var kept = document.createElement("span");
      kept.className = "vxKept";
      kept.textContent = "KEPT";
      kept.title = "kept for this road, but the engine is set elsewhere - silent until that road speaks";
      row.appendChild(kept);
    }

    var keep = document.createElement("button");
    keep.type = "button";
    keep.className = "vxKeep";
    keep.textContent = "KEEP";
    keep.title = "keep it as the voice for this target (the same write /voice makes - nothing else about the role changes)";
    keep.addEventListener("click", function () { keepIt(road, v, keep); });
    row.appendChild(keep);

    if ((road === "browser" || road === "wire") && V().voxHide) {
      var hb = document.createElement("button");
      hb.type = "button";
      hb.className = "vxKeep";
      hb.textContent = v.off ? "SHOW" : "HIDE";
      hb.title = v.off ? "put it back in the list of what may be chosen"
        : "take it off the list of what may be chosen - nothing is deleted, and a kept voice stays kept";
      hb.addEventListener("click", function () { hideIt(road, v, hb); });
      row.appendChild(hb);
    }

    if (road === "kokoro" || road === "elevenlabs") {
      var clip = document.createElement("button");
      clip.type = "button";
      clip.className = "vxClip";
      clip.textContent = "\u25C6 SAMPLE";
      clip.title = "say the sample line in this voice, KEEP THE AUDIO, file it in the VOX tree, and set it as what this agent is CLONED from (the story lane)";
      clip.addEventListener("click", function () { makeSample(road, v, clip); });
      row.appendChild(clip);
    }
    return row;
  }

  function paint() {
    var list = el("vxList");
    if (!list) return;
    var v = V();
    if (!v || !v.voxRoster) {
      list.innerHTML = "<div class=\"vxRoad\"><div class=\"vxRoadHead\">THE VOICE MODULE IS OFFLINE.</div></div>";
      return;
    }
    if (busy) { list.dataset.busy = "1"; } else { delete list.dataset.busy; }
    paintTargets();
    paintFactory();
    var roster;
    try { roster = v.voxRoster(targetRoleId()); } catch (e) {
      list.innerHTML = "<div class=\"vxRoad\"><div class=\"vxRoadHead\">" + up("THE VOICE LIST COULD NOT BE READ :: " + ((e && e.message) || e)) + "</div></div>";
      return;
    }
    var note = el("vxNote");
    if (note) {
      note.textContent = "HEARD ON EVERY ROAD · KEPT FOR " + up(roster.roleLabel)
        + (v.state && v.state().engineNow ? " · THE ROAD SHE ACTUALLY SPEAKS ON IS " + up(v.state().engineNow) : "")
        + " · \u25C6 SAMPLE MEANS THE VOICE CAN BE MADE INTO A CLIP (THE LOCAL VOICE AND ELEVENLABS); THE BROWSER'S OWN VOICES AND THE WIRE CANNOT BE RECORDED, SO THERE IS NO BUTTON THAT LIES."
        + " · F IS FEMALE AND M IS MALE: THE LOCAL MODEL AND ELEVENLABS SAY IT THEMSELVES, WHILE THIS BROWSER'S LIST AND THE WIRE PUBLISH NO SUCH FIELD AND ARE READ FROM THE NAMES. A VOICE WITH NO CHIP IS ONE NOTHING HAS SEXED YET - TAG IT IN src/voice/voices.json.";
    }
    list.innerHTML = "";
    roadLive = {};
    roster.roads.forEach(function (road) { roadLive[road.id] = !!road.live; });
    roster.roads.forEach(function (road) {
      var box = document.createElement("div");
      box.className = "vxRoad";
      var head = document.createElement("div");
      head.className = "vxRoadHead";
      head.innerHTML = "";
      var t = document.createElement("b");
      t.textContent = road.label;
      head.appendChild(t);
      var n = document.createElement("span");
      var tally = { F: 0, M: 0, u: 0 };
      road.voices.forEach(function (x) { if (x.sex === "F") tally.F++; else if (x.sex === "M") tally.M++; else tally.u++; });
      n.textContent = (road.clippable ? "\u25C6 CLIPPABLE · " : "") + (road.note || "")
        + (road.voices.length ? " · F " + tally.F + " · M " + tally.M + (tally.u ? " · UNTAGGED " + tally.u : "") : "");
      head.appendChild(n);
      box.appendChild(head);
      if (!road.voices.length) {
        var empty = document.createElement("div");
        empty.className = "vxEmpty";
        empty.textContent = "NOTHING TO LIST HERE YET.";
        box.appendChild(empty);
      } else {
        road.voices.forEach(function (v2) { box.appendChild(rowFor(road.id, v2)); });
      }
      list.appendChild(box);
    });
    var st = el("vxState");
    if (st) {
      var all = 0, sf = 0, sm = 0;
      roster.roads.forEach(function (r) { r.voices.forEach(function (x) { all++; if (x.sex === "F") sf++; else if (x.sex === "M") sm++; }); });
      st.textContent = all + " VOICES ON FOUR ROADS · F " + sf + " · M " + sm;
    }
  }

  // ---- the three acts -----------------------------------------------------

  function flash(btn, text, ms) {
    if (!btn) return;
    var was = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(function () { btn.textContent = was; btn.disabled = false; }, ms || 1400);
  }

  async function hear(road, v, btn) {
    if (busy) return;
    busy = true;
    flash(btn, "\u2026", 4000);
    try {
      await V().voxPreview(road, v.ref, targetRoleId());
    } catch (e) {
      say("VOX :: THAT VOICE WOULD NOT SPEAK :: " + up((e && e.message) || e));
    }
    busy = false;
    if (isOpen()) paint();
  }

  function hideIt(road, v, btn) {
    var r = null;
    try { r = V().voxHide(road, v.ref, !v.off); }
    catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
    if (!r || !r.ok) { say("VOX :: THAT VOICE WOULD NOT " + (v.off ? "COME BACK" : "GO") + " :: " + up(String((r && r.error) || "REFUSED"))); return; }
    flash(btn, v.off ? "BACK" : "OFF");
    if (r.kept) say("VOX :: IT STAYS THE KEPT VOICE - HIDING NEVER TAKES HER VOICE AWAY, IT ONLY NARROWS WHAT CAN BE CHOSEN NEXT.");
    setTimeout(function () { if (isOpen()) paint(); }, 600);
  }
  function keepIt(road, v, btn) {
    flash(btn, "KEPT");
    try { V().voxSet(road, v.ref, targetRoleId()); }
    catch (e) { say("VOX :: THAT VOICE WOULD NOT STICK :: " + up((e && e.message) || e)); }
    setTimeout(function () { if (isOpen()) paint(); }, 1600);
  }

  // THE CLONE SAMPLE. Say the line, keep the audio, file it in the VOX tree, and set it as what the
  // target is cloned from. The filing is the vault's own: the record is born `kind: "vox"` (so it is a
  // voice and not music), it lands in the agent's own folder when the target names one, and it carries
  // the words this house files voices by (LIA_VOX_TAGS: the agent, the kind, the engine) - so it can be
  // found again by #sample, by #<agent>, and on the gallery's VOX tab.
  async function makeSample(road, v, btn) {
    if (busy) return;
    busy = true;
    flash(btn, "\u2026", 60000);
    var media = M(), story = S(), voice = V();
    var tid = targetId();
    var agent = (tid === "default") ? "" : tid;
    var label = up(tid === "default" ? "THE DEFAULT (ANY AGENT WITH NO SAMPLE OF ITS OWN)" : (window.roles && window.roles.get && window.roles.get(tid) ? (window.roles.get(tid).title || tid) : tid));
    try {
      if (!media) throw new Error("THE VAULT IS OFFLINE");
      say("VOX :: MAKING A SAMPLE WITH \"" + up(v.label) + "\" (" + up(road) + ") FOR " + label + " :: THE SAMPLE LINE IS " + String(sampleLine()).length + " CHARACTERS, AND "
        + (road === "elevenlabs" ? "ELEVENLABS BILLS ONE CREDIT PER CHARACTER FOR IT." : "THE LOCAL VOICE IS FREE - IT COSTS TIME, NOT MONEY."));
      var made = await voice.mint(sampleLine(), road, { voice: v.ref, role: targetRoleId() });
      var folder = "";
      try { folder = media.voxFolder ? media.voxFolder({ agent: agent }) : ""; } catch (e) { folder = ""; }
      var tags = ["sample"];
      if (agent) tags.push(agent);
      tags.push(road === "kokoro" ? "kokoro" : (road === "elevenlabs" ? "elevenlabs" : road));
      var name = String(v.label).replace(/[\\/:*?"<>|]+/g, "-").trim() + " sample." + made.ext;
      var id = await media.add(made.blob, {
        kind: "vox",
        name: name,
        folder: folder,
        tags: tags,
        duration: made.secs || 0,
        prompt: "KEPT FROM THE VOX PANEL :: " + v.label + " (" + (v.id || v.ref) + ") ON THE " + road.toUpperCase()
          + " ROAD, SAYING: " + sampleLine(),
        note: "the voice sample the story lane clones " + (agent ? up(agent) : "the fallback") + " from"
      });
      var rec = media.get ? media.get(id) : null;
      var kb = rec && rec.bytes ? Math.round(rec.bytes / 1024) + " KB" : "SIZE UNKNOWN";
      var line = "VOX :: KEPT :: \"" + up(rec ? rec.name : name) + "\" (" + id + " \u00b7 " + kb + (made.secs ? " \u00b7 " + made.secs.toFixed(1) + "S" : "") + ") IS IN " + up(folder || "/audio/vox") + ".";
      if (story && story.setSample) {
        var res = story.setSample(agent ? (id + " for " + agent) : (id + " as default"));
        line += "\nAND IT IS NOW WHAT " + label + " IS CLONED FROM - THE SAME CALL (/story sample " + id + (agent ? " for " + agent : " as default") + ") MADE IT, SO THERE IS NO SECOND OPINION ABOUT WHAT IS IN FORCE.";
        if (res === false) line += "\n(THE STORY LANE REFUSED THAT - ITS OWN REPORT ABOVE SAYS WHY.)";
      } else {
        line += "\nTHE STORY LANE IS OFFLINE, SO NOTHING WAS SET: /story sample " + id + (agent ? " for " + agent : " as default") + " TAKES IT.";
      }
      line += "\nTHE CLIP LEAVES THIS DEVICE ONLY WHEN A STORY IS RENDERED IN THAT VOICE - THE SPACE LISTENS TO THE FIRST SECONDS OF IT AND NOTHING ELSE IS SENT.";
      lastLine = line;
      say(line);
    } catch (e) {
      say("VOX :: NO SAMPLE WAS MADE :: " + up((e && e.message) || e) + "\nNOTHING WAS FILED AND NOTHING WAS SET.");
    }
    busy = false;
    flash(btn, "\u25C6 SAMPLE", 1);
    if (isOpen()) paint();
  }

  // ---- the text -----------------------------------------------------------

  // ---- the factory: sample > sesame > speech ----------------------------------

  function stopFac() {
    if (facAudio) { try { facAudio.pause(); } catch (e) {} facAudio = null; }
  }

  function paintFactory() {
    var eng = el("vxFacEngines");
    if (!eng) return;
    var story = S();
    eng.innerHTML = "";
    var lab = document.createElement("span");
    lab.className = "cpLabel";
    lab.textContent = "ENGINE";
    eng.appendChild(lab);
    if (story && story.spaces) {
      var cur = "";
      try { cur = story.engine().space; } catch (e) {}
      story.spaces().forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = s.id.toUpperCase();
        b.title = s.label + " - " + s.base + " - " + s.maxChars + " CHARS A CALL";
        if (s.id === cur) b.className = "on";
        b.addEventListener("click", function () {
          try { story.setHost(s.id); }
          catch (e) { say("VOX :: THAT ENGINE WOULD NOT TAKE :: " + up((e && e.message) || e)); }
          paint();
        });
        eng.appendChild(b);
      });
    }
    var rec = null;
    try { rec = story && story.sampleFor ? story.sampleFor(targetRoleId()) : null; } catch (e) { rec = null; }
    var samp = el("vxFacSample");
    if (samp) samp.textContent = rec ? rec.name + (rec.own ? "" : " (THE FALLBACK)") : "NONE - THE SPACE'S OWN VOICE";
    var tx = el("vxFacTranscript");
    if (tx) {
      if (rec && facTxFor !== rec.id) {
        facTxFor = rec.id;
        try { tx.value = story.transcript(rec.id); } catch (e) { tx.value = ""; }
      } else if (!rec) facTxFor = "";
    }
    var st = el("vxFacState");
    if (st) {
      var hasTx = false, engId = "?";
      try { engId = story.engine().space; } catch (e) {}
      try { hasTx = !!(rec && story.transcript(rec.id)); } catch (e) {}
      st.textContent = up(engId) + " - " + (rec ? (hasTx ? "CLONE READY" : "SOURCE SET, NO TRANSCRIPT (WEAKER)") : "NO SOURCE");
    }
    var keep = el("vxFacKeep");
    if (keep) keep.disabled = !facLast;
  }

  async function sayIt(line) {
    var story = S();
    var text = String(line == null ? "" : line).trim();
    var note = el("vxFacNote");
    if (facBusy || busy) return null;
    if (!story || !story.render) { say("VOX :: THE STORY LANE IS OFFLINE, SO NOTHING CAN RENDER."); return null; }
    if (!text) { if (note) note.textContent = "TYPE THE WORDS FIRST."; return null; }
    facBusy = true; busy = true;
    var engId = "?";
    try { engId = story.engine().space; } catch (e) {}
    if (note) note.textContent = "RENDERING ON " + up(engId) + " - A REAL JOB ON A REAL GPU, HOLD THE LINE.";
    try {
      var samp = null;
      try { samp = story.sampleFor(targetRoleId()); } catch (e) {}
      var r = await story.render(text, samp || undefined);
      stopFac();
      facAudio = new Audio(URL.createObjectURL(r.blob));
      facLast = { blob: r.blob, text: text };
      try { await facAudio.play(); } catch (e) {}
      if (note) note.textContent = "SPOKE " + text.length + " CHARACTERS IN " + Math.round((r.ms || 0) / 1000) + "S ON THE " + up(r.road || "") + " ROAD (" + up(r.transport || "") + " DOOR) - KEEP FILES IT.";
      say("VOX :: FACTORY SPOKE " + text.length + " CHARACTERS" + (r.ms ? " IN " + Math.round(r.ms / 1000) + "S" : "") + " ON THE " + up(r.road || "") + " ROAD.");
    } catch (e) {
      if (note) note.textContent = up((e && e.message) || e);
      say("VOX :: THE FACTORY COULD NOT SPEAK :: " + up((e && e.message) || e));
    }
    facBusy = false; busy = false;
    if (isOpen()) paint();
    return facLast;
  }

  async function keepFac() {
    var media = M(), story = S();
    if (!facLast) { say("VOX :: NOTHING TO KEEP - SPEAK FIRST."); return; }
    if (!media) { say("VOX :: THE VAULT IS OFFLINE, SO NOTHING CAN BE FILED."); return; }
    if (facBusy || busy) return;
    busy = true;
    try {
      var tid = targetId();
      var agent = (tid === "default") ? "" : tid;
      var folder = "";
      try { folder = media.voxFolder ? media.voxFolder({ agent: agent }) : ""; } catch (e) { folder = ""; }
      var eng = "factory";
      try { eng = story.engine().space; } catch (e) {}
      var tags = ["take"];
      if (agent) tags.push(agent);
      tags.push(eng);
      var type = String((facLast.blob && facLast.blob.type) || "");
      var ext = /mpeg|mp3/i.test(type) ? "mp3" : "wav";
      var id = await media.add(facLast.blob, {
        kind: "vox",
        name: "factory take." + ext,
        folder: folder,
        tags: tags,
        prompt: "KEPT FROM THE VOX FACTORY :: " + eng.toUpperCase() + " ROAD, SAYING: " + facLast.text
      });
      say("VOX :: KEPT :: \"FACTORY TAKE\" (" + id + ") IS IN " + up(folder || "/audio/vox") + ".");
    } catch (e) {
      say("VOX :: NOTHING WAS KEPT :: " + up((e && e.message) || e));
    }
    busy = false;
    if (isOpen()) paint();
  }

  function facUpload(file) {
    var media = M(), story = S();
    if (!file) return;
    if (facBusy || busy) return;
    busy = true;
    (async function () {
      try {
        if (!media) throw new Error("THE VAULT IS OFFLINE");
        if (!story || !story.setSample) throw new Error("THE STORY LANE IS OFFLINE");
        if (file.size > 40 * 1024 * 1024) throw new Error("THAT CLIP IS " + Math.round(file.size / 1048576) + " MB - OVER THE 40 MB CEILING");
        var tid = targetId();
        var agent = (tid === "default") ? "" : tid;
        var folder = "";
        try { folder = media.voxFolder ? media.voxFolder({ agent: agent }) : ""; } catch (e) { folder = ""; }
        var tags = ["sample", "factory"];
        if (agent) tags.splice(1, 0, agent);
        var id = await media.add(file, {
          kind: "vox",
          name: file.name || "factory-sample.wav",
          folder: folder,
          tags: tags,
          prompt: "FILED FROM THE VOX FACTORY AS A CLONE SOURCE"
        });
        var res = story.setSample(agent ? (id + " for " + agent) : (id + " as default"));
        if (res === false) throw new Error("THE STORY LANE REFUSED THAT CLIP (ITS OWN REPORT ABOVE SAYS WHY)");
        var box = el("vxFacTranscript");
        var tx = box ? box.value.trim().slice(0, 400) : "";
        story.setTranscript(id, tx);
        facTxFor = "";
        say("VOX :: FACTORY SOURCE SET :: \"" + up(file.name || "factory-sample.wav") + "\" (" + id + ") IS NOW WHAT " + up(agent || "THE DEFAULT") + " IS CLONED FROM"
          + (tx ? " - TRANSCRIPT KEPT (" + tx.length + " CHARS)." : " - NO TRANSCRIPT GIVEN, SO THE CLONE IS WEAKER UNTIL ONE IS SET."));
      } catch (e) {
        say("VOX :: NO SOURCE WAS SET :: " + up((e && e.message) || e) + "\nNOTHING WAS FILED AND NOTHING WAS SET.");
      }
      busy = false;
      if (isOpen()) paint();
    })();
  }

  function report() {
    var v = V();
    if (!v || !v.voxRoster) return "VOX :: THE VOICE MODULE IS OFFLINE.";
    var r = v.voxRoster(targetRoleId());
    var out = ["VOX :: EVERY VOICE, ROAD BY ROAD :: FOR " + up(r.roleLabel) + " :: THE PANEL IS THE VOX BUTTON ON THE DECK (/vox open)."];
    r.roads.forEach(function (road) {
      out.push("  " + up(road.label) + (road.clippable ? " \u00b7 \u25C6 SAMPLES CAN BE MADE HERE" : "") + " :: " + (road.voices.length ? road.voices.length + " VOICES" : "NOTHING LISTED") + " :: " + road.note);
      var cur = road.voices.filter(function (x) { return x.current; })[0];
      out.push("      IN FORCE :: " + (cur ? up(cur.label) : "NONE SET ON THIS ROAD"));
      if (road.voices.length) {
        var sf = road.voices.filter(function (x) { return x.sex === "F"; }).length;
        var sm = road.voices.filter(function (x) { return x.sex === "M"; }).length;
        var su = road.voices.length - sf - sm;
        out.push("      SEX :: " + sf + " FEMALE \u00b7 " + sm + " MALE" + (su ? " \u00b7 " + su + " UNTAGGED" : "") + " - THE LOCAL MODEL AND ELEVENLABS STATE IT THEMSELVES; THIS BROWSER'S LIST AND THE WIRE ARE READ FROM THE NAMES (src/voice/voices.json -> sex).");
      }
      var cl = road.voices.filter(function (x) { return road.clippable; }).length;
      if (cl) out.push("      CLIPPABLE :: " + cl + " - \u25C6 SAMPLE MAKES A CLIP FROM ONE AND SETS IT AS THE CLONE SOURCE. THE BROWSER'S OWN VOICES AND THE WIRE CANNOT BE RECORDED AT ALL (NO AUDIO IS EXPOSED), SO THEY ARE HEARD AND KEPT ONLY.");
    });
    out.push("  ACTIONS :: \u25B6 HEARS ONE (NOTHING SAVED) \u00b7 KEEP MAKES IT THE VOICE FOR THIS TARGET \u00b7 \u25C6 SAMPLE MAKES A CLIP, FILES IT IN THE VOX TREE AND SETS IT AS WHAT THE TARGET IS CLONED FROM");
    out.push("  TARGET :: " + up(r.roleLabel) + " - SWITCH IT WITH THE CHIPS AT THE TOP OF THE PANEL. THE DEFAULT IS LIA OFF STAGE AND EVERY AGENT WITH NO ENTRY OF ITS OWN.");
    out.push("  FACTORY :: SAMPLE > ENGINE > SPEECH, IN THE PANEL BELOW THE LIST (/vox open) - ENGINE BUTTONS SWITCH THE STORY LANE, UPLOAD FILES A CLIP AND SETS IT AS THE CLONE SOURCE, SAMPLE SAYS HOLDS ITS TRANSCRIPT, SAY IT SPEAKS, KEEP FILES THE TAKE. /vox say <WORDS> DOES IT FROM THE KEYBOARD.");
    out.push("  WORDS :: /vox open \u00b7 /vox sample <ROAD> <REF> [for <ROLE>] \u00b7 /vox say <WORDS> [for <ROLE>] \u00b7 /voice voices \u00b7 /voice kokoro voices \u00b7 /voice wire voices \u00b7 /story sample");
    return out.join("\n");
  }

  // ---- the command --------------------------------------------------------

  async function command(arg) {
    var raw = String(arg == null ? "" : arg).trim();
    var low = raw.toLowerCase();
    if (!raw || low === "status" || low === "list" || low === "report") { say(report()); return; }
    if (low === "open" || low === "show") { open(); return; }
    if (low === "close" || low === "hide") { close(); return; }
    if (low === "sample" || low.indexOf("sample ") === 0) {
      var rest = raw.slice(6).trim();
      var m = rest.match(/^(browser|wire|kokoro|local|elevenlabs|eleven|11)\s+(.+)$/i);
      if (!m) { say("VOX :: /vox sample <ROAD> <VOICE> [for <ROLE>] :: A ROAD IS browser, wire, kokoro OR elevenlabs, AND THE VOICE IS ITS NAME (OR ITS NUMBER IN THE PANEL). THE BROWSER'S OWN VOICES AND THE WIRE CANNOT BE RECORDED AT ALL."); return; }
      var road = /^(kokoro|local)$/i.test(m[1]) ? "kokoro" : (/^(elevenlabs|eleven|11)$/i.test(m[1]) ? "elevenlabs" : (/^wire$/i.test(m[1]) ? "wire" : "browser"));
      var tail = m[2].trim(), who = "";
      var mFor = tail.match(/^(.*?)\s+for\s+([a-z0-9_-]+)$/i);
      if (mFor) { tail = mFor[1].trim(); who = mFor[2]; }
      var roster = V().voxRoster(targetRoleId());
      var found = null, roadRow = null;
      roster.roads.forEach(function (r) { if (r.id === road) roadRow = r; });
      if (roadRow) roadRow.voices.forEach(function (x) {
        if (found) return;
        if (String(x.ref).toLowerCase() === tail.toLowerCase() || String(x.label).toLowerCase() === tail.toLowerCase() || String(x.id).toLowerCase() === tail.toLowerCase()) found = x;
      });
      if (!found && roadRow) roadRow.voices.forEach(function (x) { if (!found && String(x.label).toLowerCase().indexOf(tail.toLowerCase()) !== -1) found = x; });
      if (!found) { say("VOX :: NO VOICE ON THE " + up(road) + " ROAD MATCHED \"" + up(tail) + "\". /vox LISTS THE ROADS AND /vox open SHOWS EVERY VOICE IN ONE PLACE."); return; }
      if (who) target = who;
      await makeSample(road, found, null);
      return;
    }
    if (low === "say" || low.indexOf("say ") === 0) {
      var words = raw.slice(3).trim();
      var mf = words.match(/^(.*?)\s+for\s+([a-z0-9_-]+)$/i);
      if (mf && window.roles) {
        try { if (window.roles.get && window.roles.get(mf[2])) { target = mf[2]; words = mf[1].trim(); } } catch (e) {}
      }
      if (!words) { say("VOX :: /vox say <WORDS> [for <ROLE>] :: SPEAKS THE WORDS IN THE TARGET'S CLONED VOICE ON THE FACTORY ENGINE (/vox open SHOWS IT)."); return; }
      await sayIt(words);
      return;
    }
    if (low === "factory" || low === "factory open") {
      if (window.voxfactory) window.voxfactory.open();
      else say("VOX :: THE FACTORY MODULE IS OFFLINE.");
      return;
    }
    say(report());
  }

  // ---- start --------------------------------------------------------------

  function start() {
    var b = el("voxBtn");
    if (b) b.addEventListener("click", function () { toggle(); onBtn(); });
    var p = el("voxPanel");
    if (p) {
      var closeBtn = el("vxClose");
      if (closeBtn) closeBtn.addEventListener("click", function () { close(); onBtn(); });
      var ref = el("vxRefresh");
      if (ref) ref.addEventListener("click", function () { paint(); });
      var fUp = el("vxFacUpload"), fFile = el("vxFacFile");
      if (fUp && fFile) {
        fUp.addEventListener("click", function () { fFile.click(); });
        fFile.addEventListener("change", function () {
          var file = fFile.files && fFile.files[0];
          fFile.value = "";
          facUpload(file);
        });
      }
      var fTx = el("vxFacTranscript");
      if (fTx) fTx.addEventListener("change", function () {
        var story = S();
        if (!story || !story.setTranscript) return;
        var rec = null;
        try { rec = story.sampleFor(targetRoleId()); } catch (e) {}
        if (rec) story.setTranscript(rec.id, fTx.value);
        paint();
      });
      var fSp = el("vxFacSpeak");
      if (fSp) fSp.addEventListener("click", function () { var t = el("vxFacText"); sayIt(t ? t.value : ""); });
      var fKp = el("vxFacKeep");
      if (fKp) fKp.addEventListener("click", function () { keepFac(); });
      p.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); onBtn(); } });
    }
    if (V() && V().load) { try { V().load(); } catch (e) { } }
    onBtn();
  }

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  return {
    open: open, close: close, toggle: toggle, isOpen: isOpen,
    report: report, command: command, run: command,
    targets: targets, target: function (v) { if (v != null) target = String(v); return targetId(); },
    make: makeSample, last: function () { return lastLine; }
  };
})();
