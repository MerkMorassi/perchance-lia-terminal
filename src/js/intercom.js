(function () {
  /* ---- THE PUSH-TO-TALK KEY ----------------------------------------------------
     The prototype Patrikios handed over (scratch/message-attachments/intercom.zip, a ZOE FILMS
     intercom) is one big key with three states: WAITING, HITL (he holds it and speaks, the
     transcript showing), AI (his words go to the model and her answer comes back spoken). This
     lane is that key, worn on this terminal's own intercom instead of a server round-trip -
     with one pilot's rule: nothing leaves the cockpit until he says so.

       HOLD IT   the microphone opens and the lamp reads TRANSMITTING. What it hears streams
                 into the input box LIVE, word for word, and no silence and no stop takes it
                 anywhere. While the key is down the rest of the deck goes dark - SEND, TALK,
                 LISTEN, the live channel and the other key are disabled until it lifts. The
                 microphone re-opens behind every session that ends by itself - pauses, no-speech
                 errors, her floor waited out - past any session count: the finger owns the
                 microphone until it lifts, and only a real lift lets go (sliding off the key, or
                 a touch scroll stealing the gesture, never sends).
       LET GO    the microphone closes and YOUR WORDS GO TO HER AT ONCE - the send fires on
                 release, and the lamp reads RECEIVING until her reply is in and SPOKEN - on an
                 intercom her answer comes back over voice, so if auto-read is off this lane
                 reads it aloud itself, once, and only the new reply. LET GO SILENT and her
                 newest reply is read back (say again).
       LOCKED    while she has the floor (her voice, her turn being made) the key refuses, the
                 same law as TALK and LISTEN: an intercom does not talk over her.

     RADIO DISCIPLINE. A turn that went in over the key is answered briefly and radio-plain:
     the CLOCK block carries one line for three minutes after he lets go (while brevity is on,
     which it is unless /intercom brevity off says otherwise). Manual hands are never gated -
     no duty level touches this key.
      Commands: /intercom · /intercom brevity on|off · /intercom style [<ID>]
     --------------------------------------------------------------------------- */

  var FOLDER = "lia_settings", KEY = "intercom";
  var BRIEF_MS = 5 * 60 * 1000;
  var WATCH_MS = 500, REPLY_WAIT_MS = 4 * 60 * 1000, END_WAIT_MS = 60000;

  // SPEECH STYLES (src/voxpack/styles/). Each style is one tiny file - the instruction she
  // reads for an intercom turn. The dropdown on the LIACOMM page is populated from index.json,
  // so adding a style is adding a file plus one manifest line. The built-in line below is the
  // fallback when no file has loaded yet (or none can be read); it matches plain-brief.md.
  var STYLE_INDEX = "src/voxpack/styles/index.json";
  var STYLE_DIR = "src/voxpack/styles/";
  var STYLE_CUSTOM_KEY = "intercom_styles";
  var STYLE_ID_RULE = /^[a-z0-9-]{1,32}$/;
  var STYLE_TEXT_CAP = 2000;
  var STYLE_FALLBACK = "He is on LIACOMM, speaking over the house intercom. Answer like a normal back-and-forth: ordinary words, no prowords (no roger, copy, wilco, say again), no 'over' or sign-offs, and no naming him every turn. The reply is spoken aloud, so write what speaks cleanly.";
  var styleId = "plain-brief";
  var styleText = "";
  var styleList = [{ id: "plain-brief", file: "plain-brief.md", title: "PLAIN BRIEF" }];
  // YOUR OWN STYLES. Small adjustments he writes himself - kept in kv (lia_settings /
  // intercom_styles), never in the shipped tree, so a SAVE or an update cannot eat them.
  // They ride the same list as the file styles (marked mine:true) and the same roads:
  // the dropdown, /intercom style <ID>, and the intercom turn itself.
  var customStyles = [];

  var brief = true;
  var held = false;
  var sending = false;
  var receiving = false;
  var snapBox = "";
  var releaseT = 0, replyT = 0, briefUntil = 0;
  var watchTimer = null, waitPhase = "";
  var lampText = "";
  var wrapped = false;

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }
  function vox() { return window.voice || null; }

  // THE INFINITY STANDS DOWN WHILE THIS KEY OWNS THE ROOM (src/js/proactive.js). park(true)
  // is not the switch: her setting, ceilings and persisted state are untouched and nothing is
  // printed - the lane's next tick simply refuses to open an act. park(false) hands the room
  // back, and a kick left behind opens the moment the room is actually free.
  function parkInf(on) {
    try { if (window.proactive && typeof window.proactive.park === "function") window.proactive.park(on); } catch (e) {}
  }
  function infBusy() {
    try {
      if (window.proactive && typeof window.proactive.state === "function") {
        var st = window.proactive.state();
        if (st && st.busy) return true;
      }
    } catch (e) {}
    return false;
  }

  function air() {
    try { return (vox() && vox().air) ? vox().air() : "STANDBY"; }
    catch (e) { return "STANDBY"; }
  }

  async function save() {
    var k = kv();
    if (!k) return;
    try { await k.set(KEY, { brief: !!brief, style: styleId }); } catch (e) {}
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var rec = await k.get(KEY);
        if (rec && typeof rec === "object") {
          if (typeof rec.brief === "boolean") brief = rec.brief;
          if (typeof rec.style === "string" && rec.style.trim()) styleId = rec.style.trim().toLowerCase();
        }
      } catch (e) {}
      // Your own styles come back with everything else - sanitised, so a half-written
      // row from an older build can never break the list.
      try {
        var saved = await k.get(STYLE_CUSTOM_KEY);
        if (saved && Object.prototype.toString.call(saved) === "[object Array]") {
          var clean = [];
          saved.forEach(function (s) {
            if (!s || typeof s !== "object") return;
            var id = String(s.id || "").trim().toLowerCase();
            var text = String(s.text == null ? "" : s.text).trim();
            if (!STYLE_ID_RULE.test(id) || !text) return;
            clean.push({ id: id, title: String(s.title || id).trim().toUpperCase().slice(0, 48) || id.toUpperCase(), text: text.slice(0, STYLE_TEXT_CAP), mine: true, ts: Number(s.ts) || 0 });
          });
          customStyles = clean;
        }
      } catch (e) {}
    }
    try { paint(); } catch (e) {}
    loadStyles();
    return { brief: brief, style: styleId };
  }

  // Read the manifest, then the selected style's file. Silent and best-effort: clockLine()
  // falls back to STYLE_FALLBACK when nothing has loaded, so a missing manifest or an unsaved
  // tree never breaks a turn.
  var stylesLoading = null;
  function styleEntry(id) {
    var want = String(id == null ? "" : id).trim().toLowerCase();
    var i;
    for (i = 0; i < styleList.length; i++) {
      if (String(styleList[i].id).toLowerCase() === want) return styleList[i];
    }
    for (i = 0; i < customStyles.length; i++) {
      if (String(customStyles[i].id).toLowerCase() === want) return customStyles[i];
    }
    return null;
  }
  // The whole list, file styles first and yours after - what the dropdown and the
  // /intercom style list both read.
  function allStyles() {
    return styleList.slice().concat(customStyles.slice());
  }
  async function loadStyles() {
    if (stylesLoading) return stylesLoading;
    stylesLoading = (async function () {
      try {
        var res = await fetch(STYLE_INDEX, { cache: "no-store" });
        if (res && res.ok) {
          var man = await res.json();
          if (man && Array.isArray(man.styles) && man.styles.length) {
            var next = [];
            man.styles.forEach(function (s) {
              if (!s || !s.id) return;
              next.push({ id: String(s.id), file: String(s.file || (s.id + ".md")), title: String(s.title || s.id).toUpperCase() });
            });
            if (next.length) styleList = next;
          }
        }
      } catch (e) {}
      if (!styleEntry(styleId)) styleId = (styleList[0] && styleList[0].id) || "plain-brief";
      await loadStyleText();
      try { paint(); } catch (e) {}
      try { if (window.liacomm && window.liacomm.paintStyles) window.liacomm.paintStyles(); } catch (e) {}
      return { styles: styleList, style: styleId };
    })();
    return stylesLoading;
  }
  async function loadStyleText() {
    var e = styleEntry(styleId);
    // Yours never touches the file storage: the words are already here, in kv.
    if (e && e.mine) { styleText = String(e.text || ""); return styleText; }
    var file = e ? (STYLE_DIR + e.file) : null;
    if (!file) { styleText = ""; return ""; }
    try {
      var res = await fetch(file, { cache: "no-store" });
      if (res && res.ok) {
        var t = await res.text();
        t = String(t == null ? "" : t).trim();
        if (t) { styleText = t; return t; }
      }
    } catch (e2) {}
    styleText = "";
    return "";
  }
  async function setStyle(id) {
    var e = styleEntry(String(id == null ? "" : id).trim());
    if (!e) return null;
    styleId = e.id;
    await loadStyleText();
    await save();
    try { paint(); } catch (ex) {}
    try { if (window.liacomm && window.liacomm.paintStyles) window.liacomm.paintStyles(); } catch (ex) {}
    return e;
  }

  // THE WORKBENCH ROADS. saveStyle() writes one of yours (create or update - the id
  // decides), dropStyle() removes one of yours. Both throw plain sentences the caller
  // prints; nothing is half-written, and a file style is never touched by either.
  async function saveCustom() {
    var k = kv();
    if (!k) throw new Error("LIACOMM :: THE DEVICE STORAGE IS OFFLINE - YOUR STYLE WAS NOT KEPT. NOTHING WAS WRITTEN.");
    await k.set(STYLE_CUSTOM_KEY, customStyles.slice());
  }
  function cleanStyleId(id) {
    return String(id == null ? "" : id).trim().toLowerCase();
  }
  async function saveStyle(id, title, text) {
    id = cleanStyleId(id);
    if (!STYLE_ID_RULE.test(id)) throw new Error("LIACOMM :: NAME IT FIRST - a style name is 1-32 lowercase letters, numbers or hyphens (e.g. my-brief). NOTHING WAS KEPT.");
    text = String(text == null ? "" : text).trim();
    if (!text) throw new Error("LIACOMM :: THE STYLE IS EMPTY - write the instruction first. NOTHING WAS KEPT.");
    if (text.length > STYLE_TEXT_CAP) throw new Error("LIACOMM :: TOO LONG (" + text.length + " CHARS, " + STYLE_TEXT_CAP + " MAX) - a style is a small adjustment, not a chapter. NOTHING WAS KEPT.");
    title = String(title == null ? "" : title).trim().toUpperCase().slice(0, 48) || id.toUpperCase();
    var created = true;
    for (var i = 0; i < customStyles.length; i++) {
      if (customStyles[i].id === id) {
        customStyles[i].title = title;
        customStyles[i].text = text;
        customStyles[i].ts = Date.now();
        created = false;
        break;
      }
    }
    if (created) customStyles.push({ id: id, title: title, text: text, mine: true, ts: Date.now() });
    await saveCustom();
    // Saving the one she is already reading re-reads it at once - no stale words.
    if (styleId === id) await loadStyleText();
    try { paint(); } catch (e) {}
    try { if (window.liacomm && window.liacomm.paintStyles) window.liacomm.paintStyles(); } catch (e) {}
    var e = styleEntry(id);
    return { entry: e, created: created };
  }
  async function dropStyle(id) {
    id = cleanStyleId(id);
    var e = styleEntry(id);
    if (!e) throw new Error("LIACOMM :: NO SPEECH STYLE " + (id || "?").toUpperCase() + ". NOTHING WAS DROPPED.");
    if (!e.mine) throw new Error("LIACOMM :: " + e.id.toUpperCase() + " SHIPS WITH THE TERMINAL - file styles cannot be dropped. Copy it with NEW and adjust the copy. NOTHING WAS DROPPED.");
    customStyles = customStyles.filter(function (s) { return s.id !== id; });
    await saveCustom();
    if (styleId === id) {
      styleId = (styleList[0] && styleList[0].id) || "plain-brief";
      await loadStyleText();
      await save();
    }
    try { paint(); } catch (ex) {}
    try { if (window.liacomm && window.liacomm.paintStyles) window.liacomm.paintStyles(); } catch (ex) {}
    return "LIACOMM :: SPEECH STYLE " + e.id.toUpperCase() + " DROPPED - YOUR OWN WORDS, GONE FROM THIS DEVICE. " + styleId.toUpperCase() + " IS IN FORCE.";
  }

  // HER NEWEST REPLY, SEEN NOT GUESSED. The lane wraps voice.onReply once: every reply is
  // still spoken and handled exactly as before, and the wrapper only writes down when the
  // newest one landed - so the speak-back at the end of a turn reads that reply, never an
  // older one and never silence.
  function wrapReplies() {
    if (wrapped) return;
    try {
      var v = vox();
      if (!v || typeof v.onReply !== "function" || v.onReply.__intercom) return;
      var orig = v.onReply;
      var fn = function (text, meta) {
        replyT = Date.now();
        return orig.call(v, text, meta);
      };
      fn.__intercom = true;
      v.onReply = fn;
      wrapped = true;
    } catch (e) {}
  }

  function boxText() {
    try { var b = el("userInput"); return b ? String(b.value || "") : ""; }
    catch (e) { return ""; }
  }

  var locked = [];
  function lockDeck(on, except) {
    if (on) {
      if (!locked.length) {
        ["sendBtn", "talkBtn", "listenBtn", "liveBtn", "icomBtn", "icomSideBtn", "pttBtn"].forEach(function (id) {
          var b = el(id);
          if (!b || b === except || locked.indexOf(b) >= 0) return;
          if (!b.disabled) { b.disabled = true; locked.push(b); }
        });
        return;
      }
      locked.forEach(function (b) { try { if (b && !b.disabled) b.disabled = true; } catch (e) {} });
      return;
    }
    locked.forEach(function (b) { try { if (b.disabled) b.disabled = false; } catch (e) {} });
    locked = [];
  }

  // HOLD IT. STANDBY or nothing: the same lock as the TALK key, said in the line's own words.
  function press(from) {
    var v = vox();
    if (!v) { try { print("SYSTEM", "LIACOMM :: THE VOICE MODULE IS OFFLINE (src/js/voice.js)."); } catch (e) {} return false; }
    if (held || receiving || sending) return false;
    try { if (v.mode && v.mode() === "radio") { var guNm = ""; try { guNm = (window.guest && window.guest.isUp && window.guest.isUp() && window.guest.guestName) ? String(window.guest.guestName() || "") : ""; } catch (e) {} print("SYSTEM", guNm ? ("GUESTCOMM :: GUESTMODE - " + guNm + " IS ON THE LINE. THE KEY STAYS DARK - HANG UP FIRST.") : "LIACOMM :: RADIO SILENCE - THE KEY STAYS DARK. /mode text OR /mode talk TO OPEN IT."); return false; } } catch (e) { return false; }
    try {
      if (window.tricom && typeof window.tricom.floor === "function") {
        var tf = window.tricom.floor();
        if (tf && tf !== "OPERATOR") { print("SYSTEM", "LIACOMM :: THE FLOOR IS " + tf + " - YOUR MIC GOES TO THE BROWSER ONLY ON YOUR TURN. NEXT TURN OR WAIT FOR IT."); return false; }
      }
    } catch (e) {}
    try { if (v.freeStuckSend) v.freeStuckSend(); } catch (e) {}
    var a = air();
    if (a !== "STANDBY") {
      try { print("SYSTEM", "LIACOMM :: THE LINE IS HERS - " + airLineSay() + " LET GO OF NOTHING: HOLD THE KEY WHEN THE LAMP READS STANDBY."); } catch (e) {}
      return false;
    }
    // AN INFINITY ACT IN FLIGHT OWNS WHAT COMES NEXT: it will speak while the finger is down,
    // and the voice lane drops anything heard while she speaks - which reads as a lost
    // transcript. Refuse the press and say so, rather than open a mic that is about to be wiped.
    if (infBusy()) {
      try { print("SYSTEM", "LIACOMM :: SHE IS MID-ACT ON THE INFINITY - HOLD THE KEY WHEN SHE IS DONE."); } catch (e) {}
      return false;
    }
    // From here the key owns the room: the infinity parks until this exchange is fully done.
    parkInf(true);
    snapBox = boxText();
    // A hushed opening: the lamp and the transcript already say the microphone is open.
    try { if (v.hushMic) v.hushMic(); } catch (e) {}
    // A fresh clause - but yesterday's hold rides into the box first (2026-10-21: pressing the
    // key with an unsent hold used to eat it). The snap is taken after the carry, so letting go
    // silent with nothing new still reads her reply back instead of re-sending the old words.
    try {
      var ht = (v.held && v.held.text) ? String(v.held.text() || "") : "";
      if (ht) {
        var bx0 = el("userInput");
        if (bx0) { var cv0 = String(bx0.value || ""); if (cv0.indexOf(ht) === -1) bx0.value = ((cv0 ? cv0 + " " : "") + ht).replace(/\s+/g, " ").trim(); }
        snapBox = boxText();
      }
    } catch (e) {}
    try { if (v.dropHold) v.dropHold(); } catch (e) {}
    try { v.listen(); } catch (e) {}
    // The review latch goes up AFTER the session opens (dropHold clears it): from here until he
    // sends or the watch gives up, no silence and no stop takes his words anywhere.
    try { if (v.deferTake) v.deferTake(true); } catch (e) {}
    // The microphone opens a beat after the press (the recogniser's own onstart), so the finger
    // is taken at its word first and checked after: a press that opened nothing (no speech
    // recognition in this browser, the channel owned elsewhere) puts the lamp back by itself -
    // UNLESS the voice lane is already re-opening behind an ended session (see heldReopen): a
    // pause landing in the same beat as this check must not stand the finger down.
    held = true;
    lockDeck(true, from || null);
    paint();
    setTimeout(function () {
      if (!held) return;
      var open = false;
      try { open = !!(v.isListening && v.isListening()); } catch (e) {}
      if (!open) {
        var pending = false;
        try { pending = !!(v.heldReopen && v.heldReopen()); } catch (e) {}
        if (pending) return;
      }
      // A press that opened nothing puts everything back: the lamp, the latch, the hold -
      // and the infinity's park, since no exchange follows.
      if (!open) { held = false; lockDeck(false); try { if (v.dropHold) v.dropHold(); } catch (e) {} parkInf(false); paint(); }
    }, 900);
    return true;
  }

  function airLineSay() {
    try {
      var v = vox();
      if (v && v.airLine) return String(v.airLine() || "").replace(/\s+/g, " ").trim() + " ";
    } catch (e) {}
    return "";
  }

  // LET GO. Two roads, one key. Words on the frequency stay where he can see them: the
  // microphone closes and NOTHING sends - he reads the streamed transcript in the input box,
  // edits it if he wants, and hits SEND himself. The brevity flag and the watch start now, so
  // when his send goes her answer comes back over voice, brief and plain. Silence on release is SAY
  // AGAIN: it reads back her newest reply, exactly like LISTEN - and the latch comes down, since
  // there is nothing of his to protect. Either way the whole exchange lives on this key: it is
  // what triggers the intercom.
  function release() {
    if (!held) return false;
    held = false;
    sending = true;
    lockDeck(false);
    var v = vox();
    try { if (v && v.stopListen) v.stopListen(true); } catch (e) {}
    paint();
    setTimeout(function () { releaseSend(v); }, 700);
    return true;
  }

  function releaseSend(v) {
    var words = boxText().trim();
    // SALVAGE (2026-10-21: letting go ate his turn). Words that only arrived with the closing
    // session - no interim ever streamed them into the box - sit in the hold behind the review
    // latch, so an empty box is not yet silence. They ride into the box and go the words road.
    if (!words || words === snapBox.trim()) {
      try {
        var ht = (v && v.held && v.held.text) ? String(v.held.text() || "").trim() : "";
        if (ht && ht !== snapBox.trim()) {
          var bx = el("userInput");
          if (bx) bx.value = ((words ? words + " " : "") + ht).replace(/\s+/g, " ").trim();
          words = boxText().trim();
        }
      } catch (e) {}
    }
    if (!words || words === snapBox.trim()) {
      sending = false;
      try { if (v && v.dropHold) v.dropHold(); } catch (e) {}
      try { if (v && v.toggleSpeak) v.toggleSpeak(); } catch (e) {}
      parkInf(false);
      paint();
      return;
    }
    var btn = el("sendBtn");
    try {
      if (window.voxcont && window.voxcont.route(words)) {
        sending = false;
        try { var bx = el("userInput"); if (bx) bx.value = ""; } catch (x) {}
        try { if (v && v.dropHold) v.dropHold(); } catch (x) {}
        parkInf(false);
        paint();
        return;
      }
    } catch (e) {}
    if (!btn || btn.disabled) {
      sending = false;
      try { print("SYSTEM", "LIACOMM :: YOUR WORDS ARE IN THE BOX - THE SEND IS DARK, SO NOTHING LEFT ON ITS OWN. HIT SEND YOURSELF."); } catch (e) {}
      parkInf(false);
      paint();
      return;
    }
    try { if (v && v.dropHold) v.dropHold(); } catch (e) {}
    briefUntil = Date.now() + BRIEF_MS;
    receiving = true;
    sending = false;
    releaseT = Date.now();
    waitPhase = "reply";
    watchStart();
    paint();
    try { if (window.send) window.send(); } catch (e) {}
    setTimeout(function () {
      if (words && boxText().trim() === words) {
        watchEnd();
        try { print("SYSTEM", "LIACOMM :: THE SEND DID NOT TAKE IT - YOUR WORDS ARE STILL IN THE BOX. HIT SEND YOURSELF."); } catch (e) {}
        paint();
      }
    }, 2000);
  }

  function watchStop() {
    if (watchTimer) { try { clearInterval(watchTimer); } catch (e) {} watchTimer = null; }
  }

  function watchStart() {
    watchStop();
    var t0 = Date.now();
    watchTimer = setInterval(function () {
      try { watchTick(t0); } catch (e) {}
    }, WATCH_MS);
  }

  function watchTick(t0) {
    if (!receiving) { watchStop(); return; }
    var now = Date.now();
    if (waitPhase === "reply") {
      if (replyT > releaseT) waitPhase = "end";
      // He never sent, or the reply never came: stand down and drop the latch with the stale
      // hold - but never his box text, which stays his until he sends or clears it himself.
      else if (now - t0 > REPLY_WAIT_MS) { watchEnd(); return; }
      else return;
    }
    var a = air();
    if (a === "STANDBY" || now - t0 > REPLY_WAIT_MS + END_WAIT_MS) {
      receiving = false;
      watchStop();
      if (a === "STANDBY") speakBack();
      try { var v = vox(); if (v && v.dropHold) v.dropHold(); } catch (e) {}
      // Her reply is in and spoken: the exchange is done, hand the room back to the infinity.
      // (Her voice tail itself is still covered by the speaking guard in roomQuiet.)
      parkInf(false);
      paint();
    }
  }

  function watchEnd() {
    receiving = false;
    watchStop();
    try { var v = vox(); if (v && v.dropHold) v.dropHold(); } catch (e) {}
    parkInf(false);
    paint();
  }

  // THE KILL SWITCH (MASTER OFF = FULL MANUAL MODE, src/js/duty.js). Abort a held key
  // without sending: finger up, deck unlocked, held words dropped, latch down. A turn
  // already sent (receiving) is manual conversation and is left alone. Returns true when
  // anything was held.
  function abort() {
    if (!held) return false;
    held = false;
    sending = false;
    try { lockDeck(false); } catch (e) {}
    try { var v = vox(); if (v && v.dropHold) v.dropHold(); } catch (e) {}
    try { var v2 = vox(); if (v2 && v2.deferTake) v2.deferTake(false); } catch (e) {}
    parkInf(false);
    try { paint(); } catch (e) {}
    return true;
  }

  // HER ANSWER, OVER VOICE. Only the reply this turn grew (replyT past the release), and only
  // when auto-read has not already spoken it - otherwise the lane would read it twice.
  function speakBack() {
    if (!(replyT > releaseT)) return false;
    try {
      var v = vox();
      if (!v || !v.speakLast) return false;
      var auto = false;
      try { auto = !!(v.state && v.state().autoRead); } catch (e) {}
      if (auto) return true;
      v.speakLast();
      return true;
    } catch (e) { return false; }
  }

  // AN AGENT'S TURN, OVER THE KEY. aiTurn(who, text) speaks one agent turn
  // through the floor: the turn controller grants it (or queues it behind
  // whoever holds the line), her mouth says it, and the floor is released the
  // moment she is done - which triggers whoever is next. Two (or more) AI
  // audio streams alternate this way and never overlap: STT stays held deaf
  // while she speaks, a second stream queues instead of filing, and the VAD +
  // timeout end a turn whose end never arrives. The finger always wins: while
  // it is down this refuses.
  function aiTurn(who, text, opts) {
    who = String(who || "ai");
    text = String(text == null ? "" : text);
    if (!text.trim()) return { ok: false, receipt: "LIACOMM :: NOTHING TO SAY - NO TURN TAKEN." };
    var v = vox();
    if (!v || typeof v.speak !== "function") return { ok: false, receipt: "LIACOMM :: THE VOICE MODULE IS OFFLINE (src/js/voice.js)." };
    if (held) return { ok: false, receipt: "LIACOMM :: YOUR FINGER IS DOWN - AN INTERCOM DOES NOT TALK OVER YOU." };
    if (!window.turn || typeof window.turn.request !== "function") return { ok: false, receipt: "LIACOMM :: THE TURN CONTROLLER IS OFFLINE (src/js/turn.js)." };
    var role = (opts && opts.role != null) ? opts.role : undefined;
    var begin = function () {
      receiving = true;
      paint();
      var p = null;
      try { p = v.speak(text, { quiet: true, role: role }); } catch (e) { p = null; }
      var done = function () {
        receiving = false;
        try { if (window.turn && window.turn.release) window.turn.release(who); } catch (e) {}
        try { paint(); } catch (e) {}
      };
      if (p && typeof p.then === "function") p.then(function () { done(); }, function () { done(); });
      else done();
    };
    var r = null;
    try { r = window.turn.request(who, begin, { ai: true }); } catch (e) { r = null; }
    if (!r) {
      receiving = false;
      try { paint(); } catch (e) {}
      return { ok: false, receipt: "LIACOMM :: THE FLOOR REFUSED " + who.toUpperCase() + "." };
    }
    return { ok: true, receipt: "LIACOMM :: " + who.toUpperCase() + (r.granted ? " HAS THE FLOOR - SPEAKING NOW." : " QUEUED" + (r.pos ? " #" + r.pos : "") + " - SPEAKS WHEN THE FLOOR FREES."), floor: r };
  }

  // THE LAMP. The prototype's three states in this terminal's words, following the air
  // underneath: TRANSMITTING while his finger is down, RECEIVING while her turn is on its
  // way back, and the line's own states whenever the key is idle.
  function paint() {
    var lamp = el("icomLamp");
    var btn = el("icomBtn");
    var side = el("icomSideBtn");
    var ptt = el("pttBtn");
    var text = "STANDBY", cls = "airLamp standby";
    var a = air();
    if (held) { text = "TRANSMITTING"; cls = "airLamp you"; }
    else if (receiving) {
      if (a === "HER VOICE") { text = "SHE SPEAKS"; cls = "airLamp her"; }
      else { text = "RECEIVING"; cls = "airLamp busy"; }
    }
    else if (a === "HER VOICE") { text = "SHE SPEAKS"; cls = "airLamp her"; }
    else if (a === "HER TURN") { text = "THINKING"; cls = "airLamp busy"; }
    else if (a === "YOUR VOICE" || a === "HOLDING") { text = "ON THE LINE"; cls = "airLamp you"; }
    if (btn) {
      btn.setAttribute("aria-pressed", held ? "true" : "false");
      btn.classList.toggle("icomHot", held);
    }
    if (side) {
      side.setAttribute("aria-pressed", held ? "true" : "false");
      side.classList.toggle("icomHot", held);
    }
    // The lower-deck TALK key: the same press, lit the same way.
    if (ptt) {
      ptt.setAttribute("aria-pressed", held ? "true" : "false");
      ptt.classList.toggle("icomHot", held);
    }
    if (lamp && text !== lampText) {
      lampText = text;
      lamp.textContent = text;
      lamp.className = cls;
      lamp.setAttribute("title", "the push-to-talk line: " + text + " - hold the LIACOMM key to speak, let go to send, her answer comes back over voice");
    }
  }

  function clockLine() {
    if (!brief) return "";
    if (Date.now() > briefUntil) return "";
    return styleText || STYLE_FALLBACK;
  }

  function describe() {
    var out = ["THE LIACOMM KEY :: " + up(air()) + (held ? " (YOUR FINGER IS DOWN)" : "") + (receiving ? " (HER ANSWER IS ON ITS WAY BACK)" : "") + "."];
    out.push("  HOLD THE KEY TO SPEAK - the microphone opens and what it hears streams into the input box LIVE, and no silence takes it anywhere. While the key is down SEND, TALK, LISTEN and the live channel go dark. LET GO TO SEND - the microphone closes and your words go to her at once; when her answer comes back it arrives OVER VOICE (spoken aloud even when auto-read is off). LET GO SILENT TO SAY AGAIN - her newest reply is read back. WHILE SHE HAS THE FLOOR THE KEY REFUSES - an intercom does not talk over her.");
    var cur = styleEntry(styleId) || { id: styleId, title: String(styleId).toUpperCase() };
    out.push("  SPEECH STYLE :: " + cur.title + " (" + cur.id + ") - the instruction she reads for an intercom turn, from one tiny file in src/voxpack/styles/ (the dropdown on the LIACOMM page lists them; /intercom style <ID> keeps one). Your own adjustments live beside them: the workbench on the LIACOMM page, or /intercom style save <id> :: <text>.");
    out.push("  RADIO DISCIPLINE :: BREVITY " + (brief ? "ON - she answers in the style above for three minutes after every intercom turn" : "OFF - she answers an intercom turn the way she answers anything") + ". /intercom brevity on|off.");
    out.push("  THIS KEY IS A MANUAL HAND: NO DUTY LEVEL TOUCHES IT, AND IT NEVER MOVES ON ITS OWN. IT STANDS IN TWO PLACES - THE LOWER DECK'S TALK KEY (WAVEFORM, TALK, INPUT BOX: THE COMMS FLOW) AND THE LIACOMM PAGE - AND THAT IS THE WHOLE INTERCOM.");
    out.push("  WHILE THIS KEY OWNS THE ROOM THE INFINITY IS PARKED: no act opens from press until her reply is spoken (her setting and ceilings untouched, nothing printed). A press while she is mid-act on the infinity is refused - hold when she is done.");
    out.push("  AN AGENT'S TURN: intercom.aiTurn(who, text) speaks one agent turn over this key through the turn controller - granted or queued, spoken by her mouth, floor released when she is done so the next voice is triggered. That is how two AI audio streams hold a conversation here without talking over each other.");
    return out.join("\n");
  }

  function stylesText() {
    var lines = ["LIACOMM :: SPEECH STYLE :: " + String(styleId).toUpperCase() + " IN FORCE."];
    allStyles().forEach(function (s) {
      lines.push("  " + (s.id === styleId ? ">" : " ") + " " + s.id + " :: " + s.title + (s.mine ? " (YOURS)" : ""));
    });
    lines.push("FILE STYLES SHIP WITH THE TERMINAL (src/voxpack/styles/ + index.json). YOUR OWN: /intercom style save <id> :: <text> WRITES ONE ON THIS DEVICE (OR THE WORKBENCH ON THE LIACOMM PAGE); /intercom style new <id> COPIES THE ONE IN FORCE FOR ADJUSTING; /intercom style drop <id> REMOVES ONE OF YOURS. /intercom style <ID> KEEPS ONE.");
    var cur = styleText || STYLE_FALLBACK;
    lines.push("IN FORCE NOW :: " + cur.slice(0, 400) + (cur.length > 400 ? "..." : ""));
    return lines.join("\n");
  }

  async function words(arg) {
    var t = String(arg || "").trim();
    if (!t) return describe();
    var low = t.toLowerCase();
    if (/^(style|styles|voice-style|speech)([\s].*)?$/.test(low)) {
      var rest = t.replace(/^(style|styles|voice-style|speech)[\s]*/i, "").trim();
      if (!rest || /^(status|state|list|all|show)$/i.test(rest)) {
        await loadStyles();
        try { if (typeof print === "function") print("SYSTEM", stylesText()); } catch (e) {}
        return stylesText();
      }
      // YOUR OWN, IN WORDS. save writes one (create or update), new copies the one in
      // force for adjusting, drop removes one of yours. All three print their own line.
      var mSave = rest.match(/^save\s+(\S+)\s*::\s*([\s\S]+)$/i);
      if (mSave) {
        await loadStyles();
        try {
          var kept = await saveStyle(mSave[1], "", mSave[2]);
          var msg = "LIACOMM :: SPEECH STYLE " + kept.entry.title + " (" + kept.entry.id + ") " + (kept.created ? "WRITTEN" : "REWRITTEN") + " - KEPT ON THIS DEVICE. /intercom style " + kept.entry.id + " KEEPS IT.";
          try { if (typeof print === "function") print("SYSTEM", msg); } catch (e) {}
          return msg;
        } catch (e) {
          var em = String((e && e.message) || e);
          try { if (typeof print === "function") print("SYSTEM", em); } catch (e2) {}
          return em;
        }
      }
      var mNew = rest.match(/^new\s+(\S+)\s*$/i);
      if (mNew) {
        await loadStyles();
        try {
          var from = styleText || STYLE_FALLBACK;
          var made = await saveStyle(mNew[1], "", from);
          var nm = "LIACOMM :: SPEECH STYLE " + made.entry.id.toUpperCase() + " COPIED FROM " + styleId.toUpperCase() + " - ADJUST IT ON THE LIACOMM PAGE OR WITH /intercom style save " + made.entry.id + " :: <text>.";
          try { if (typeof print === "function") print("SYSTEM", nm); } catch (e) {}
          return nm;
        } catch (e) {
          var em2 = String((e && e.message) || e);
          try { if (typeof print === "function") print("SYSTEM", em2); } catch (e2) {}
          return em2;
        }
      }
      var mDrop = rest.match(/^drop\s+(\S+)\s*$/i);
      if (mDrop) {
        await loadStyles();
        try {
          var dm = await dropStyle(mDrop[1]);
          try { if (typeof print === "function") print("SYSTEM", dm); } catch (e) {}
          return dm;
        } catch (e) {
          var em3 = String((e && e.message) || e);
          try { if (typeof print === "function") print("SYSTEM", em3); } catch (e2) {}
          return em3;
        }
      }
      await loadStyles();
      var hit = styleEntry(rest) || (function () {
        var w = rest.toLowerCase();
        for (var i = 0; i < styleList.length; i++) {
          if (String(styleList[i].title).toLowerCase().indexOf(w) !== -1) return styleList[i];
        }
        return null;
      })();
      if (!hit) {
        var msg = "LIACOMM :: NO SPEECH STYLE " + rest.toUpperCase() + " :: " + styleList.map(function (s) { return s.id; }).join(" · ") + ".";
        try { if (typeof print === "function") print("SYSTEM", msg); } catch (e) {}
        return msg;
      }
      await setStyle(hit.id);
      var ok = "LIACOMM :: SPEECH STYLE " + String(hit.title).toUpperCase() + " (" + hit.id + ") - KEPT ON THIS DEVICE. HER NEXT INTERCOM TURN READS IT.";
      try { if (typeof print === "function") print("SYSTEM", ok); } catch (e) {}
      return ok;
    }
    var m = low.match(/^brevity\s+(on|off|yes|no|true|false|1|0)$/);
    if (m) {
      brief = /^(on|yes|true|1)$/.test(m[1]);
      await save();
      try { paint(); } catch (e) {}
      return "LIACOMM :: RADIO DISCIPLINE BREVITY " + (brief ? "ON - LIACOMM TURNS ARE ANSWERED IN THE STYLE ABOVE." : "OFF - LIACOMM TURNS ARE ANSWERED LIKE ANYTHING ELSE.");
    }
    return "USAGE: /intercom · /intercom brevity on|off · /intercom style [<ID>] · /intercom style save <id> :: <text> · /intercom style new <id> · /intercom style drop <id>\n" + describe();
  }

  function holdKey(b) {
    if (!b || b.__icom) return;
    b.__icom = true;
    b.addEventListener("pointerdown", function (e) {
      try { e.preventDefault(); } catch (x) {}
      // The press is captured to the key: sliding off it mid-sentence is not a lift, so it
      // neither sends nor cancels - only a real pointerup lets go.
      try { if (b.setPointerCapture && e.pointerId != null) b.setPointerCapture(e.pointerId); } catch (x) {}
      press(b);
    });
    var up2 = function (e) { release(); };
    b.addEventListener("pointerup", up2);
    // pointercancel (a touch scroll stealing the gesture, the browser pre-empting the press) is NOT
    // a lift: the finger is still down, so the microphone stays open until a real pointerup. The old
    // wiring sent mid-sentence here.
    b.addEventListener("pointercancel", function (e) {});
    // Sliding off the key is not a lift either - and with capture held it does not even fire.
    b.addEventListener("pointerleave", function (e) {});
    b.addEventListener("contextmenu", function (e) { try { e.preventDefault(); } catch (x) {} });
  }

  function wire() {
    holdKey(el("icomBtn"));
    holdKey(el("icomSideBtn"));
    holdKey(el("pttBtn"));
    setInterval(function () { try { paint(); } catch (e) {} }, 800);
  }

  (function () {
    var p = load();
    if (p && p.then) p.then(function () {}, function () {});
    wrapReplies();
    if (document.readyState !== "loading") wire();
    else document.addEventListener("DOMContentLoaded", wire);
    setTimeout(function () { try { wrapReplies(); } catch (e) {} }, 4000);
  })();

  window.intercom = {
    press: press,
    release: release,
    abort: abort,
    aiTurn: aiTurn,
    held: function () { return held; },
    receiving: function () { return receiving; },
    air: air,
    clockLine: clockLine,
    describe: describe,
    words: words,
    paint: paint,
    brevity: function (v) {
      if (v != null) { brief = !!v; save(); }
      return brief;
    },
    load: load,
    styles: function () { return allStyles(); },
    style: function () { return styleId; },
    styleTextNow: function () { return styleText || STYLE_FALLBACK; },
    setStyle: setStyle,
    saveStyle: saveStyle,
    dropStyle: dropStyle,
    loadStyles: loadStyles,
    state: function () { return { held: held, sending: sending, receiving: receiving, air: air(), brief: brief, briefFor: Math.max(0, briefUntil - Date.now()), replySeen: replyT > releaseT, style: styleId }; }
  };
})();
