window.amute = (function () {
  "use strict";

  var on = true;
  var FLAG = "data-amuted-by-switch";

  function btn() { return document.getElementById("auMuteBtn"); }
  function fill() { return document.getElementById("auMeterFill"); }
  function meter() { return document.getElementById("auMeter"); }

  function paint() {
    var b = btn();
    if (!b) return;
    b.textContent = on ? "AUDIO" : "MUTED";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = on
      ? "audio everywhere is ON - her voice, the audition bus, clips and previews all sound. Press to kill every sound."
      : "every sound is KILLED - her voice is held, players are silent. Press to let it all back.";
  }

  function kill() {
    var nodes = document.querySelectorAll("audio, video");
    for (var i = 0; i < nodes.length; i++) {
      (function (n) {
        try {
          if (n.tagName === "AUDIO") { n.pause(); }
          else { if (!n.muted) n.setAttribute(FLAG, "1"); n.muted = true; }
        } catch (e) {}
      })(nodes[i]);
    }
    try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) {}
    try { if (window.voice && window.voice.stop) window.voice.stop(); } catch (e) {}
  }

  function restore() {
    var nodes = document.querySelectorAll("video[" + FLAG + "]");
    for (var i = 0; i < nodes.length; i++) {
      try { nodes[i].muted = false; nodes[i].removeAttribute(FLAG); } catch (e) {}
    }
  }

  function set(v) {
    // THE KILLSWITCH GUARD: AUDIO kills every <audio> on the page - including
    // her ears and the mic feed while the private line is up. With a guest ON
    // AIR that press needs a LOUD confirmation, never a reflex. Line down:
    // one press, as before.
    if (!v && on && guestUp()) { confirmKill(); return on; }
    return doSet(v);
  }

  function doSet(v) {
    on = !!v;
    if (on) restore(); else kill();
    paint();
    return on;
  }

  function guestUp() {
    try { if (window.guest && typeof window.guest.isUp === "function" && window.guest.isUp()) return true; } catch (e) {}
    return false;
  }

  function guestWho() {
    try { if (window.guest && typeof window.guest.guestLabel === "function") return String(window.guest.guestLabel() || "GUEST"); } catch (e) {}
    return "GUEST";
  }

  // THE KILLSWITCH MODAL. A fixed overlay above the terminal layers: her name,
  // what the press does, and two honest buttons. KEEP is focused; Esc and the
  // backdrop keep the line too - only KILL IT ANYWAY drops the audio.
  var killModal = null, killEsc = false;
  function confirmKill() {
    try {
      if (!killModal || !killModal.isConnected) killModal = buildKillModal();
      var body = killModal.querySelector(".auKillBody");
      if (body) body.textContent = "THE PRIVATE LINE IS UP - " + guestWho() + " IS ON AIR. KILLING AUDIO STOPS HER EARS AND YOUR MIC FEED COLD: SHE WILL NOT HEAR YOU AND YOU WILL NOT HEAR HER UNTIL YOU CALL AGAIN. THIS NUKES THE SESSION.";
      killModal.hidden = false;
      var no = killModal.querySelector("#auKillNo");
      if (no) { try { no.focus(); } catch (e) {} }
    } catch (e) {}
  }

  function buildKillModal() {
    var m = document.createElement("div");
    m.id = "auKillModal";
    m.hidden = true;
    var sheet = document.createElement("div");
    sheet.className = "auKillSheet";
    sheet.setAttribute("role", "alertdialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "AUDIO KILLS THE LIVE SESSION");
    var title = document.createElement("div");
    title.className = "auKillTitle";
    title.textContent = "NUKING THE SESSION";
    var body = document.createElement("div");
    body.className = "auKillBody";
    var row = document.createElement("div");
    row.className = "auKillRow";
    var yes = document.createElement("button");
    yes.type = "button";
    yes.id = "auKillYes";
    yes.textContent = "KILL IT ANYWAY";
    yes.title = "kill every sound, including the live guest line";
    var no = document.createElement("button");
    no.type = "button";
    no.id = "auKillNo";
    no.textContent = "KEEP THE LINE";
    no.title = "leave the audio alone - the call stays up";
    row.appendChild(yes);
    row.appendChild(no);
    sheet.appendChild(title);
    sheet.appendChild(body);
    sheet.appendChild(row);
    m.appendChild(sheet);
    m.addEventListener("click", function (e) { if (e.target === m) { try { m.hidden = true; } catch (x) {} } });
    yes.addEventListener("click", function () { try { m.hidden = true; } catch (e) {} doSet(false); });
    no.addEventListener("click", function () { try { m.hidden = true; } catch (e) {} });
    try { document.body.appendChild(m); } catch (e) {}
    if (!killEsc) {
      killEsc = true;
      try {
        document.addEventListener("keydown", function (e) {
          if (e && e.key === "Escape" && killModal && !killModal.hidden) { try { killModal.hidden = true; } catch (x) {} }
        });
      } catch (e) {}
    }
    return m;
  }

  (function () {
    var proto = (typeof window.HTMLMediaElement !== "undefined") ? window.HTMLMediaElement.prototype : null;
    if (!proto || proto.__amuteWrapped) return;
    var raw = proto.play;
    if (typeof raw !== "function") return;
    proto.__amuteWrapped = true;
    proto.play = function () {
      if (!on) {
        if (this && this.tagName === "VIDEO") { try { this.muted = true; } catch (e) {} }
        else {
          var d = null;
          try { d = Promise.reject(new Error("MUTED")); d.catch(function () {}); } catch (e) { d = null; }
          return d;
        }
      }
      return raw.apply(this, arguments);
    };
  })();

  if (typeof window.MutationObserver !== "undefined") {
    new MutationObserver(function (muts) {
      if (on) return;
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          var hits = [];
          try {
            if (n.tagName === "AUDIO" || n.tagName === "VIDEO") hits.push(n);
            var kids = n.getElementsByTagName ? n.getElementsByTagName("video") : [];
            for (var k = 0; k < kids.length; k++) hits.push(kids[k]);
          } catch (e) {}
          for (var m = 0; m < hits.length; m++) {
            try { if (hits[m].tagName === "VIDEO") hits[m].muted = true; else hits[m].pause(); } catch (e) {}
          }
        }
      }
    }).observe(document.documentElement || document, { childList: true, subtree: true });
  }

  function sample() {
    var rms = 0, speaking = false;
    try { if (window.voice && window.voice.level) rms = Number(window.voice.level().rms) || 0; } catch (e) {}
    try { if (window.voice && window.voice.isSpeaking) speaking = !!window.voice.isSpeaking(); } catch (e) {}
    var out = 0;
    try {
      var nodes = document.querySelectorAll("audio, video");
      for (var i = 0; i < nodes.length; i++) { if (!nodes[i].paused && !nodes[i].ended) out++; }
    } catch (e) {}
    return { rms: rms, speaking: speaking, out: out };
  }

  var lastW = -1, lastHot = null;
  setInterval(function () {
    var f = fill(), m = meter();
    if (!f || !m) return;
    var s = sample();
    var w = Math.round(Math.max(0, Math.min(1, Math.max(s.rms * 3, s.speaking ? 0.45 : 0, s.out ? 0.6 : 0))) * 100);
    if (w !== lastW) { lastW = w; try { f.style.width = w + "%"; } catch (e) {} }
    var hot = (s.speaking || s.out > 0 || s.rms > 0.05);
    if (hot !== lastHot) { lastHot = hot; try { m.classList.toggle("hot", hot); } catch (e) {} }
  }, 150);

  function wire() {
    var b = btn();
    if (!b || b.__amuteWired) return;
    b.__amuteWired = true;
    b.addEventListener("click", function () { set(!on); });
  }
  if (document.readyState !== "loading") { paint(); wire(); }
  else document.addEventListener("DOMContentLoaded", function () { paint(); wire(); });

  return {
    on: function () { return on; },
    allowed: function () { return on; },
    set: set,
    toggle: function () { return set(!on); },
    sample: sample,
    paint: paint
  };
})();
