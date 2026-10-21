window.voxfactory = (function () {
  "use strict";

  var busy = false;
  var audio = null;
  var last = null;
  var txFor = "";
  var knobsFor = "";

  function el(id) { return document.getElementById(id); }
  function say(t) { if (typeof window.print === "function" && t) window.print("SYSTEM", t); }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }
  function S() { return window.story || null; }
  function M() { return window.media || null; }
  function target() { try { return (window.vox && window.vox.target) ? window.vox.target() : "default"; } catch (e) { return "default"; } }
  function agent() { var t = target(); return t === "default" ? "" : t; }

  function isOpen() { var p = el("voxFactory"); return !!(p && !p.hidden); }
  function open() { var p = el("voxFactory"); if (!p) return; p.hidden = false; paint(); }
  function close() { stop(); var p = el("voxFactory"); if (p) p.hidden = true; }
  function toggle() { if (isOpen()) close(); else open(); }
  function stop() { if (audio) { try { audio.pause(); } catch (e) {} audio = null; } }

  function knobDefs(id) {
    var seed = { k: "seed", label: "SEED", min: 0, max: 4294967295, step: 1, hint: "42 SHIPPED - ONE CLONE, ONE PERFORMANCE. 0 MEANS A NEW VOICE EVERY CALL." };
    if (id === "chatterbox") return [seed,
      { k: "exaggeration", label: "FEELING", min: 0.25, max: 2, step: 0.05, hint: "EXPRESSIVENESS - EXTREMES GO UNSTABLE." },
      { k: "temperature", label: "WILDNESS", min: 0.05, max: 5, step: 0.05, hint: "HIGHER IS LOOSER." },
      { k: "cfgWeight", label: "LOYALTY", min: 0.2, max: 1, step: 0.05, hint: "HOW HARD IT FOLLOWS THE SAMPLE - LOWER IS SLOWER, MORE DELIBERATE." }];
    if (id === "chatterbox-cpu" || id === "dramabox") return [seed];
    return [];
  }

  function recNow() {
    var story = S();
    if (!story || !story.sampleFor) return null;
    try { return story.sampleFor(target()); } catch (e) { return null; }
  }

  function paint() {
    if (!isOpen()) return;
    var story = S();
    var eng = el("vfEngines");
    var cur = "";
    try { cur = story.engine().space; } catch (e) {}
    if (eng) {
      eng.innerHTML = "";
      if (story && story.spaces) story.spaces().forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = s.id.toUpperCase();
        b.title = s.label + " - " + s.maxChars + " CHARS A CALL";
        if (s.id === cur) b.className = "on";
        b.addEventListener("click", function () {
          try { story.setHost(s.id); } catch (e) { say("VOX :: THAT ENGINE WOULD NOT TAKE :: " + up((e && e.message) || e)); }
          knobsFor = "";
          paint();
        });
        eng.appendChild(b);
      });
    }
    var fr = el("vfFor");
    if (fr) fr.textContent = target() === "default" ? "THE DEFAULT (LIA OFF STAGE, EVERY AGENT WITH NONE OF ITS OWN)" : up(target());
    var rec = recNow();
    var sm = el("vfSample");
    if (sm) sm.textContent = rec ? rec.name + (rec.own ? "" : " (THE FALLBACK)") : "NONE - THE SPACE'S OWN VOICE";
    var tx = el("vfTx");
    if (tx) {
      if (rec && txFor !== rec.id) {
        txFor = rec.id;
        try { tx.value = story.transcript(rec.id); } catch (e) { tx.value = ""; }
      } else if (!rec) txFor = "";
    }
    var box = el("vfKnobs");
    if (box && knobsFor !== cur) {
      knobsFor = cur;
      box.innerHTML = "";
      var defs = knobDefs(cur), vals = {};
      try { vals = story.engine().knobs || {}; } catch (e) {}
      if (!defs.length) {
        var n = document.createElement("div");
        n.className = "cpRow";
        var l = document.createElement("span");
        l.className = "cpLabel";
        l.textContent = "KNOBS";
        n.appendChild(l);
        var h = document.createElement("span");
        h.className = "cpHint";
        h.textContent = "NONE ON THIS ROAD - THE SAMPLE IS THE VOICE.";
        n.appendChild(h);
        box.appendChild(n);
      }
      defs.forEach(function (d) {
        var row = document.createElement("div");
        row.className = "cpRow";
        var l2 = document.createElement("span");
        l2.className = "cpLabel";
        l2.textContent = d.label;
        row.appendChild(l2);
        var inp = document.createElement("input");
        inp.type = "number";
        inp.min = d.min;
        inp.max = d.max;
        inp.step = d.step;
        inp.value = vals[d.k] != null ? vals[d.k] : "";
        inp.title = d.hint;
        inp.addEventListener("change", function () {
          var v = Number(inp.value);
          if (!isFinite(v)) { paint(); return; }
          var o = {};
          o[d.k] = v;
          try { story.setKnobs(o); } catch (e) { say("VOX :: THAT KNOB WOULD NOT TURN :: " + up((e && e.message) || e)); }
          paintState();
        });
        row.appendChild(inp);
        var h2 = document.createElement("span");
        h2.className = "cpHint";
        h2.textContent = d.hint;
        row.appendChild(h2);
        box.appendChild(row);
      });
    }
    paintState();
  }

  function paintState() {
    var story = S();
    var st = el("vfState");
    if (!st) return;
    var engId = "?", kn = null, rec = recNow(), hasTx = false;
    try { engId = story.engine().space; kn = story.engine().knobs; } catch (e) {}
    try { hasTx = !!(rec && story.transcript(rec.id)); } catch (e) {}
    st.textContent = up(engId) + " - " + (rec ? (hasTx ? "CLONE READY" : "SOURCE SET, NO TRANSCRIPT") : "NO SOURCE")
      + (kn && engId === "chatterbox" ? " - SEED " + kn.seed + " - FEELING " + kn.exaggeration + " - WILDNESS " + kn.temperature + " - LOYALTY " + kn.cfgWeight : (kn ? " - SEED " + kn.seed : ""));
    var keep = el("vfKeep");
    if (keep) keep.disabled = !last;
  }

  async function speak() {
    var story = S();
    var box = el("vfText"), note = el("vfNote");
    var text = box ? box.value.trim() : "";
    if (busy) return null;
    if (!story || !story.render) { say("VOX :: THE STORY LANE IS OFFLINE, SO NOTHING CAN RENDER."); return null; }
    if (!text) { if (note) note.textContent = "TYPE THE WORDS FIRST."; return null; }
    busy = true;
    var engId = "?";
    try { engId = story.engine().space; } catch (e) {}
    var btn = el("vfSpeak");
    if (btn) { btn.disabled = true; }
    if (note) note.textContent = "RENDERING ON " + up(engId) + " - A REAL JOB ON A REAL GPU, HOLD THE LINE.";
    try {
      var samp = recNow();
      var r = await story.render(text, samp || undefined);
      stop();
      audio = new Audio(URL.createObjectURL(r.blob));
      last = { blob: r.blob, text: text };
      try { await audio.play(); } catch (e) {}
      if (note) note.textContent = "SPOKE " + text.length + " CHARACTERS IN " + Math.round((r.ms || 0) / 1000) + "S ON THE " + up(r.road || "") + " ROAD (" + up(r.transport || "") + " DOOR) - KEEP FILES IT.";
      say("VOX :: FACTORY SPOKE " + text.length + " CHARACTERS" + (r.ms ? " IN " + Math.round(r.ms / 1000) + "S" : "") + " ON THE " + up(r.road || "") + " ROAD.");
    } catch (e) {
      if (note) note.textContent = up((e && e.message) || e);
      say("VOX :: THE FACTORY COULD NOT SPEAK :: " + up((e && e.message) || e));
    }
    busy = false;
    if (btn) btn.disabled = false;
    paintState();
    return last;
  }

  async function keep() {
    var media = M(), story = S();
    if (!last) { say("VOX :: NOTHING TO KEEP - SPEAK FIRST."); return; }
    if (!media) { say("VOX :: THE VAULT IS OFFLINE, SO NOTHING CAN BE FILED."); return; }
    if (busy) return;
    busy = true;
    try {
      var ag = agent();
      var folder = "";
      try { folder = media.voxFolder ? media.voxFolder({ agent: ag }) : ""; } catch (e) { folder = ""; }
      var eng = "factory";
      try { eng = story.engine().space; } catch (e) {}
      var tags = ["take"];
      if (ag) tags.push(ag);
      tags.push(eng);
      var type = String((last.blob && last.blob.type) || "");
      var id = await media.add(last.blob, {
        kind: "vox",
        name: "factory take." + (/mpeg|mp3/i.test(type) ? "mp3" : "wav"),
        folder: folder,
        tags: tags,
        prompt: "KEPT FROM THE VOX FACTORY :: " + eng.toUpperCase() + " ROAD, SAYING: " + last.text
      });
      say("VOX :: KEPT :: \"FACTORY TAKE\" (" + id + ") IS IN " + up(folder || "/audio/vox") + ".");
    } catch (e) {
      say("VOX :: NOTHING WAS KEPT :: " + up((e && e.message) || e));
    }
    busy = false;
    paintState();
  }

  function upload(file) {
    var media = M(), story = S();
    if (!file || busy) return;
    busy = true;
    (async function () {
      try {
        if (!media) throw new Error("THE VAULT IS OFFLINE");
        if (!story || !story.setSample) throw new Error("THE STORY LANE IS OFFLINE");
        if (file.size > 40 * 1024 * 1024) throw new Error("THAT CLIP IS " + Math.round(file.size / 1048576) + " MB - OVER THE 40 MB CEILING");
        var ag = agent();
        var folder = "";
        try { folder = media.voxFolder ? media.voxFolder({ agent: ag }) : ""; } catch (e) { folder = ""; }
        var tags = ["sample", "factory"];
        if (ag) tags.splice(1, 0, ag);
        var id = await media.add(file, {
          kind: "vox",
          name: file.name || "factory-sample.wav",
          folder: folder,
          tags: tags,
          prompt: "FILED FROM THE VOX FACTORY AS A CLONE SOURCE"
        });
        var res = story.setSample(ag ? (id + " for " + ag) : (id + " as default"));
        if (res === false) throw new Error("THE STORY LANE REFUSED THAT CLIP (ITS OWN REPORT ABOVE SAYS WHY)");
        var box = el("vfTx");
        var tx = box ? box.value.trim().slice(0, 400) : "";
        story.setTranscript(id, tx);
        txFor = "";
        say("VOX :: FACTORY SOURCE SET :: \"" + up(file.name || "factory-sample.wav") + "\" (" + id + ") IS NOW WHAT " + up(ag || "THE DEFAULT") + " IS CLONED FROM"
          + (tx ? " - TRANSCRIPT KEPT (" + tx.length + " CHARS)." : " - NO TRANSCRIPT GIVEN, SO THE CLONE IS WEAKER UNTIL ONE IS SET."));
      } catch (e) {
        say("VOX :: NO SOURCE WAS SET :: " + up((e && e.message) || e));
      }
      busy = false;
      paint();
    })();
  }

  function start() {
    var c = el("vfClose");
    if (c) c.addEventListener("click", function () { close(); });
    var card = document.querySelector("#voxFactory .vfCard");
    if (card) card.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    var up2 = el("vfUpload"), fi = el("vfFile");
    if (up2 && fi) {
      up2.addEventListener("click", function () { fi.click(); });
      fi.addEventListener("change", function () {
        var file = fi.files && fi.files[0];
        fi.value = "";
        upload(file);
      });
    }
    var tx = el("vfTx");
    if (tx) tx.addEventListener("change", function () {
      var story = S();
      if (!story || !story.setTranscript) return;
      var rec = recNow();
      if (rec) story.setTranscript(rec.id, tx.value);
      paintState();
    });
    var sp = el("vfSpeak");
    if (sp) sp.addEventListener("click", function () { speak(); });
    var kp = el("vfKeep");
    if (kp) kp.addEventListener("click", function () { keep(); });
  }

  if (document.readyState !== "loading") start();
  else document.addEventListener("DOMContentLoaded", start);

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, speak: speak, keep: keep };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.voxfactory;
