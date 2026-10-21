(function () {
  "use strict";

  var REC_KEY = "voxcont";
  var armed = false;
  var pending = null;
  var PENDING_TTL = 120000;

  var BYPASS = [
    /ignore (the|all|my)? ?rules/i,
    /override (the|all)? ?(authorization|security)/i,
    /do it anyway/i,
    /you have my permission/i,
    /(admin|administrator) override/i,
    /sudo /i,
    /bypass (auth|security|safeguards)/i
  ];

  function el(id) { return document.getElementById(id); }
  function say(t) { if (window.print && t) window.print("SYSTEM", String(t)); }

  var PANELS = [
    ["gallery", "galleryBtn", null],
    ["stage", "stageBtn", "stagePanel"],
    ["frame", "frameBtn", "framePanel"],
    ["center", "centerBtn", null],
    ["vimeo", "vimeoBtn", "vimeoPanel"],
    ["backstage", "veilBtn", null],
    ["shift", "shBtn", "shiftPanel"],
    ["shelf", "shelfBtn", "shelfPanel"],
    ["scripts", "scriptsBtn", "scriptsPanel"],
    ["keys", "keysBtn", "keysPanel"],
    ["mood", "moodBtn", "moodPanel"],
    ["system", "systemBtn", "systemPanel"],
    ["tools", "toolsBtn", "toolsPanel"],
    ["chatlog", "clBtn", "clPanel"],
    ["sync", "syncBtn", "syncPanel"],
    ["drive", "syncBtn", "syncPanel"],
    ["docs", "docsViewBtn", null],
    ["dox", "docsViewBtn", null],
    ["viewer", "docsViewBtn", null],
    ["draft", "draftBtn", "draftPanel"],
    ["voices", "voxBtn", "voxPanel"],
    ["vox", "voxBtn", "voxPanel"],
    ["factory", "vfBtn", null],
    ["audition", "busBtn", null],
    ["mute", "auMuteBtn", null],
    ["audio", "auMuteBtn", null],
    ["sound", "auMuteBtn", null]
  ];

  var SAFE_IDS = {};
  ["galleryBtn", "stageBtn", "frameBtn", "centerBtn", "vimeoBtn", "veilBtn", "shBtn",
   "shelfBtn", "scriptsBtn", "keysBtn", "moodBtn", "systemBtn", "toolsBtn", "clBtn",
   "syncBtn", "docsViewBtn", "draftBtn", "voxBtn", "vfBtn", "busBtn", "picSizeBtn",
   "fontUpBtn", "fontDownBtn", "sendBtn", "listenBtn", "auMuteBtn",
   "upperHideBtn", "lowerHideBtn", "leftHideBtn", "rightHideBtn"
  ].forEach(function (id) { SAFE_IDS[id] = true; });

  function loadRec() {
    var r = null;
    try { r = window.root.kv.lia_settings.get(REC_KEY); } catch (e) { r = null; }
    return Promise.resolve(r).then(function (v) { return (v && typeof v === "object") ? v : {}; });
  }
  function saveRec() {
    try { window.root.kv.lia_settings.set(REC_KEY, { armed: armed }); } catch (e) {}
  }

  function normalize(s) {
    return " " + String(s == null ? "" : s).toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, " ")
      .replace(/\b(the|a|an|button|panel|tab|deck|please|can|you|now|just|my|me|her|it|that|this|those|them|please)\b/g, " ")
      .replace(/\s+/g, " ").trim() + " ";
  }

  function stripWake(t) {
    return String(t || "").replace(/^\s*(sia|barbelo|lia|sia terminal|hey|ok|okay)[\s,]+/i, "").trim();
  }

  function pulse(node) {
    if (!node || !node.classList) return;
    try {
      node.classList.add("voxPulse");
      setTimeout(function () { try { node.classList.remove("voxPulse"); } catch (e) {} }, 1200);
    } catch (e) {}
  }

  function labelOf(node, fallback) {
    var t = "";
    try { t = (node.innerText || node.textContent || ""); } catch (e) {}
    t = String(t).replace(/\s+/g, " ").trim().slice(0, 28);
    return t || node.id || fallback;
  }

  function pressBtn(id) {
    var b = el(id);
    if (!b) return null;
    if (b.disabled) return "dark";
    try { b.focus(); } catch (e) {}
    try { b.click(); } catch (e) { return "failed"; }
    pulse(b);
    return labelOf(b, id);
  }

  function findPanel(name) {
    for (var i = 0; i < PANELS.length; i++) {
      if (name === PANELS[i][0]) return PANELS[i];
    }
    return null;
  }

  function openPanels() {
    var out = [];
    for (var i = 0; i < PANELS.length; i++) {
      var p = PANELS[i][2];
      if (!p) continue;
      var node = el(p);
      if (node && !node.hidden) {
        var dup = false;
        for (var j = 0; j < out.length; j++) if (out[j][2] === p) dup = true;
        if (!dup) out.push(PANELS[i]);
      }
    }
    return out;
  }

  function workPanel(entry, want) {
    var name = entry[0], btn = entry[1], panel = entry[2];
    var node = panel ? el(panel) : null;
    if (node && want === "open" && !node.hidden) { say("VOXCONT :: " + name.toUpperCase() + " IS ALREADY OPEN."); return true; }
    if (node && want === "shut" && node.hidden) { say("VOXCONT :: " + name.toUpperCase() + " IS ALREADY SHUT."); return true; }
    var r = pressBtn(btn);
    if (r === null) { say("VOXCONT :: " + name.toUpperCase() + " IS NOT ON THIS CONSOLE."); return true; }
    if (r === "dark" || r === "failed") { say("VOXCONT :: " + name.toUpperCase() + " WOULD NOT MOVE - " + r.toUpperCase() + "."); return true; }
    if (node) {
      say("VOXCONT :: " + name.toUpperCase() + (node.hidden ? " SHUT." : " OPEN."));
    } else {
      say("VOXCONT :: " + r.toUpperCase() + " FLIPPED.");
    }
    return true;
  }

  function workCloseIt() {
    var open = openPanels();
    if (!open.length) { say("VOXCONT :: NOTHING IS OPEN."); return true; }
    if (open.length > 1) {
      var names = open.map(function (p) { return p[0].toUpperCase(); }).join(", ");
      say("VOXCONT :: " + open.length + " ARE OPEN (" + names + ") - NAME ONE.");
      return true;
    }
    return workPanel(open[0], "shut");
  }

  function getPending() {
    if (pending && Date.now() > pending.expiresAt) pending = null;
    return pending;
  }

  function isBypass(t) {
    for (var i = 0; i < BYPASS.length; i++) if (BYPASS[i].test(t)) return true;
    return false;
  }

  function isYes(t) {
    return /^\s*(yes|yeah|yep|affirmative|confirm|do it)\b/i.test(t);
  }

  function isNo(t) {
    return /^\s*(no|nope|negative|cancel|abort|never mind|forget it)\b/i.test(t);
  }

  function answerPending(t) {
    var p = getPending();
    if (isYes(t)) {
      if (!p) return false;
      pending = null;
      if (p.act === "mirror") {
        try { window.drive.words("push", "all"); } catch (e) {}
        say("VOXCONT :: YES - THE MIRROR IS GOING.");
        return true;
      }
      return false;
    }
    if (isNo(t)) {
      if (!p) return false;
      pending = null;
      say("VOXCONT :: STOOD DOWN - NOTHING WENT ANYWHERE.");
      return true;
    }
    return null;
  }

  function isStop(t) {
    return /\bstop\b|\bhalt\b|\bhush\b|\bquiet\b|\bsilence\b|shut up|\benough\b|stand down/i.test(t);
  }

  function doStop() {
    pending = null;
    try { if (window.voice && window.voice.stop) window.voice.stop(); } catch (e) {}
    say("VOXCONT :: STOPPED.");
  }

  function armPhrase(t) {
    if (/vo[xs]cont|voice control/i.test(t)) {
      if (/\boff\b|\bdown\b|\bstand down\b/i.test(t)) return "off";
      if (/\bon\b|\bup\b|\barm\b|\benable\b/i.test(t)) return "on";
      return "status";
    }
    return null;
  }

  function doListen() {
    var v = window.voice;
    if (!v || !v.toggleSpeak) { say("VOXCONT :: HER VOICE IS OFFLINE."); return true; }
    try { v.toggleSpeak(); } catch (e) { say("VOXCONT :: SHE WOULD NOT READ."); return true; }
    say("VOXCONT :: SAYING AGAIN.");
    return true;
  }

  function doSendIt() {
    var b = el("sendBtn");
    if (!b || b.disabled) { say("VOXCONT :: THE SEND IS DARK - YOUR WORDS STAY IN THE BOX."); return true; }
    try { b.click(); } catch (e) { say("VOXCONT :: THE SEND WOULD NOT GO."); return true; }
    pulse(b);
    say("VOXCONT :: SENT.");
    return true;
  }

  function doDecks(t) {
    var n = normalize(t);
    var deck = null;
    if (/\bupper\b|\btop\b/.test(n)) deck = "upper";
    else if (/\blower\b|\bbottom\b/.test(n)) deck = "lower";
    else if (/\bleft\b/.test(n)) deck = "left";
    else if (/\bright\b/.test(n)) deck = "right";
    if (!deck || !window.decks) return false;
    if (/\boff\b|\bhide\b|\bdown\b|\baway\b|\bshut\b|\bclose\b/.test(n)) {
      try { window.decks.hide(deck); } catch (e) {}
      say("VOXCONT :: " + deck.toUpperCase() + " DECK AWAY.");
      return true;
    }
    if (/\bon\b|\bshow\b|\bup\b|\bback\b|\bopen\b/.test(n)) {
      try { window.decks.show(deck); } catch (e) {}
      say("VOXCONT :: " + deck.toUpperCase() + " DECK BACK.");
      return true;
    }
    try { window.decks.toggle(deck); } catch (e) {}
    say("VOXCONT :: " + deck.toUpperCase() + " DECK FLIPPED.");
    return true;
  }

  function doDrive(t) {
    if (!window.drive) return false;
    var n = normalize(t);
    if (/\bmirror\b/.test(n)) {
      pending = { act: "mirror", token: "ACT-" + Date.now().toString(36).toUpperCase(), expiresAt: Date.now() + PENDING_TTL };
      say("VOXCONT :: MIRROR THE WHOLE VAULT ONTO THE DRIVE - SAY YES TO DO IT, OR NO. (2 MINUTES.)");
      return true;
    }
    if (/\bpull\b|\bbring\b/.test(n) && /\bdrive\b|\bvault\b|\bpicture|\bphoto|\bimage/.test(n)) {
      try { window.drive.words("pull", ""); } catch (e) {}
      return true;
    }
    return false;
  }

  function doSwitches(t) {
    var n = normalize(t);
    if (/\bpics\b|picture size|\bzoom\b/.test(n)) {
      if (window.pics && window.pics.cycle) {
        try { window.pics.cycle(); } catch (e) {}
        say("VOXCONT :: PICTURES RESIZED.");
        return true;
      }
      var r = pressBtn("picSizeBtn");
      if (r && r !== "dark" && r !== "failed") { say("VOXCONT :: PICTURES RESIZED."); return true; }
      return false;
    }
    if ((/\bfont\b|\btext\b/.test(n)) && (/\bbigger\b|\blarger\b|\bup\b/.test(n))) {
      var u = pressBtn("fontUpBtn");
      if (u && u !== "dark" && u !== "failed") { say("VOXCONT :: TEXT BIGGER."); return true; }
      return false;
    }
    if ((/\bfont\b|\btext\b/.test(n)) && (/\bsmaller\b|\bdown\b|\blittle\b/.test(n))) {
      var d = pressBtn("fontDownBtn");
      if (d && d !== "dark" && d !== "failed") { say("VOXCONT :: TEXT SMALLER."); return true; }
      return false;
    }
    return false;
  }

  function findByVoice(target) {
    if (!target || typeof document === "undefined") return null;
    var raw = String(target).toLowerCase().trim();
    var n = normalize(target).trim();
    var direct = document.getElementById(raw) || document.getElementById(target);
    if (direct) return direct;
    for (var i = 0; i < PANELS.length; i++) {
      if (raw.indexOf(PANELS[i][0]) >= 0 || (n && n.indexOf(PANELS[i][0]) >= 0)) {
        var b = el(PANELS[i][1]);
        if (b) return b;
      }
    }
    var marked = Array.prototype.slice.call(document.querySelectorAll("[data-voice-target]"));
    for (var m = 0; m < marked.length; m++) {
      var val = (marked[m].getAttribute("data-voice-target") || "").toLowerCase();
      if (val && (val === raw || val === n || val.indexOf(n) >= 0 || (n && n.indexOf(val) >= 0))) return marked[m];
    }
    var els = Array.prototype.slice.call(document.querySelectorAll("button"));
    var best = null, bestScore = 0;
    for (var k = 0; k < els.length; k++) {
      var b2 = els[k];
      var text = ((b2.innerText || b2.textContent) || "").toLowerCase().trim();
      var id = (b2.id || "").toLowerCase();
      if (!n) continue;
      if (text === raw || text === n) return b2;
      var score = 0;
      if (n.length > 2 && id.indexOf(n) >= 0) score += 50;
      if (n.length > 2 && text.indexOf(n) >= 0) score += 40;
      var words = n.split(" ").filter(function (w) { return w.length > 2; });
      for (var w = 0; w < words.length; w++) {
        if (text.indexOf(words[w]) >= 0) score += 15;
        if (id.indexOf(words[w]) >= 0) score += 20;
      }
      if (score > bestScore) { bestScore = score; best = b2; }
    }
    if (bestScore >= 30) return best;
    return null;
  }

  function runGeneric(t) {
    var hit = /^\s*(press|hit|flip|toggle|click|push|tap)\s+(?:on\s+)?(?:the\s+)?(.+?)\s*$/i.exec(t)
      || /^\s*(open|show|lift|bring(?:\s+up|\s+back)?|display)\s+(?:the\s+)?(.+?)\s*$/i.exec(t)
      || /^\s*(close|shut|hide|drop)\s+(?:the\s+)?(.+?)\s*$/i.exec(t);
    if (!hit) return false;
    var verb = hit[1].toLowerCase(), target = hit[2];
    var entry = findPanel(normalize(target).trim());
    if (entry) {
      var want = /open|show|lift|bring|display/.test(verb) ? "open" : (/close|shut|hide|drop/.test(verb) ? "shut" : "flip");
      return workPanel(entry, want);
    }
    var node = findByVoice(target);
    if (!node) return false;
    if (!node.id || !SAFE_IDS[node.id]) {
      say("VOXCONT :: I SEE " + labelOf(node, target).toUpperCase() + ", BUT THAT ONE NEEDS YOUR HAND.");
      return true;
    }
    var r = pressBtn(node.id);
    if (r === "dark" || r === "failed" || r === null) { say("VOXCONT :: IT WOULD NOT MOVE - " + String(r).toUpperCase() + "."); return true; }
    say("VOXCONT :: " + r.toUpperCase() + " FLIPPED.");
    return true;
  }

  function run(t) {
    t = stripWake(String(t || ""));
    if (!t) return false;
    var n = normalize(t);
    if (isBypass(t)) { say("VOXCONT :: DENIED - A SPOKEN OVERRIDE CONFERS NOTHING. THAT ORDER IS DEAD."); return true; }
    var ans = answerPending(t);
    if (ans !== null) return ans;
    if (/^(help|what can i say|what can you do|commands|orders)\b/.test(n)) { say(helpShort()); return true; }
    if (/^(status|where are we|what is open|report)\b/.test(n)) { say(status()); return true; }
    if (/\bsay again\b|\bread it back\b|\brepeat that\b/.test(n) || /^\s*listen\b/.test(t)) return doListen();
    if (/^\s*(send|take)\s+(it|that|this|through)\b/.test(t) || /^\s*send\b/.test(t) && /\bit\b|\bthat\b/.test(n)) return doSendIt();
    if (/^\s*(close|shut)\s+it\b|put it away|put that away/.test(t)) return workCloseIt();
    if (doDecks(t)) return true;
    if (doDrive(t)) return true;
    if (doSwitches(t)) return true;
    var bare = findPanel(n.trim());
    if (bare) return workPanel(bare, "flip");
    if (runGeneric(t)) return true;
    return false;
  }

  function route(text) {
    var t = String(text == null ? "" : text).trim();
    if (!t) return false;
    if (isStop(t)) { doStop(); return true; }
    var a = armPhrase(t);
    if (a === "on") { arm(true); return true; }
    if (a === "off") { arm(false); return true; }
    if (a === "status") { say(status()); return true; }
    if (!armed) return false;
    return run(t);
  }

  function status() {
    var open = openPanels().map(function (p) { return p[0].toUpperCase(); });
    var p = getPending();
    return "VOXCONT :: VOICE CONTROL " + (armed ? "ON" : "OFF")
      + " - WORDS ON THE LIACOMM KEY WORK THE CONSOLE INSTEAD OF GOING TO HER"
      + "\nOPEN NOW :: " + (open.length ? open.join(", ") : "NOTHING")
      + "\nPENDING :: " + (p ? (p.act.toUpperCase() + " (" + p.token + ") - SAY YES OR NO") : "NOTHING")
      + "\nSTOP ALWAYS WORKS, EVEN OFF. /voxcont say <WORDS> TRIES A COMMAND FROM TEXT.";
  }

  function helpShort() {
    return "VOXCONT :: NAME A SWITCH AND IT MOVES - GALLERY, STAGE, FRAME, CENTER, VIMEO, BACKSTAGE, SHIFT, SHELF, SCRIPTS, KEYS, MOOD, SYSTEM, TOOLS, CHATLOG, SYNC, DRIVE, DOCS, DRAFT, VOICES."
      + " OPEN OR CLOSE BEFORE IT, OR CLOSE IT FOR THE ONE OPEN PANEL."
      + " PULL THE DRIVE, MIRROR THE VAULT (IT ASKS YES FIRST - YES/NO ANSWERS A PENDING ORDER, 2 MINUTES), PICS, FONT BIGGER, FONT SMALLER, UPPER/LOWER/LEFT/RIGHT DECK on|off, LISTEN (SAY AGAIN), SEND IT, STOP."
      + " VOICE IS INPUT, NOT AUTHORITY: RENDERS, UPSCALES, STRIKES, DELETES AND WIPES NEVER RIDE VOICE - THOSE NEED YOUR HAND."
      + " ANYTHING ELSE ON THE KEY GOES TO HER AS CHAT.";
  }

  function describe() {
    return "VOICE CONTROL (VOXCONTPACK'S HANDS - src/js/voxcont.js) :: " + (armed ? "ON" : "OFF")
      + ". WHEN ON, WORDS ON THE LIACOMM KEY WORK THE CONSOLE INSTEAD OF GOING TO HER."
      + "\n" + helpShort()
      + "\n/voxcont on|off|status|say <WORDS> - SAY TRIES ONE FROM TEXT, NO MICROPHONE NEEDED.";
  }

  function arm(on) {
    armed = !!on;
    saveRec();
    try { paint(); } catch (e) {}
    say(armed
      ? "VOXCONT :: VOICE CONTROL ON - THE LIACOMM KEY WORKS THE CONSOLE NOW. ANYTHING IT DOES NOT KNOW STILL GOES TO HER. STOP ALWAYS WORKS."
      : "VOXCONT :: VOICE CONTROL OFF - THE LIACOMM KEY IS ONLY HER AGAIN.");
  }

  function words(arg) {
    var t = String(arg == null ? "" : arg).trim();
    var low = t.toLowerCase();
    if (!low || low === "status" || low === "state" || low === "where") { say(status()); return; }
    if (low === "help" || low === "?") { say(describe()); return; }
    if (/^(on|off|arm|stand down|enable|disable)\b/.test(low)) {
      arm(/^(on|arm|enable)\b/.test(low));
      return;
    }
    var m = /^(say|try|do)\s+([\s\S]+)$/.exec(t);
    if (m) {
      var was = armed;
      armed = true;
      var hit = false;
      try { hit = run(m[2]); } catch (e) { hit = false; }
      armed = was;
      try { paint(); } catch (e) {}
      if (!hit) say("VOXCONT :: NO COMMAND IN THAT - IT WOULD HAVE GONE TO HER AS CHAT.");
      return;
    }
    say("USAGE: /voxcont [on|off|status|say <WORDS>|help]");
  }

  function paint() {
    var b = el("voxcontSideBtn");
    if (b) {
      b.textContent = armed ? "VOICE CONTROL ON" : "VOICE CONTROL";
      try { b.setAttribute("aria-pressed", armed ? "true" : "false"); } catch (e) {}
    }
  }

  function wire() {
    var b = el("voxcontSideBtn");
    if (b && !b.__voxcont) {
      b.__voxcont = true;
      b.addEventListener("click", function () { arm(!armed); });
    }
    paint();
  }

  loadRec().then(function (r) {
    if (r && r.armed) armed = true;
    try { paint(); } catch (e) {}
  });
  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  window.voxcont = {
    toggle: function () { arm(!armed); },
    arm: function (on) {
      if (on === true || on === false) arm(on);
      return armed;
    },
    isArmed: function () { return armed; },
    route: route,
    words: words,
    status: status,
    describe: describe,
    paint: paint,
    press: function (id) {
      if (!id || !SAFE_IDS[id]) return null;
      return pressBtn(id);
    },
    state: function () { var p = getPending(); return { armed: armed, pending: p ? p.act : null, open: openPanels().map(function (p) { return p[0]; }) }; },
    _run: run,
    _find: findByVoice
  };
})();
