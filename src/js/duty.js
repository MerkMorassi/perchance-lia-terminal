(function () {
  var FOLDER = "lia_settings", KEY = "duty";

  var armed = true;
  var level = "full";

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }

  function mode() {
    if (!armed) return "OFF";
    return (level === "semi") ? "SEMI" : "FULL";
  }

  function allow(lane) {
    if (!armed) return false;
    if (level === "semi") return lane !== "infinity";
    return true;
  }

  // THE KILL SWITCH (MASTER OFF = FULL MANUAL MODE).
  //
  // When the master goes OFF the ship is cold and he is alone in it: every
  // autonomous lane stands down (already gated by allow()), anything
  // autonomous already being made is dropped at delivery (each lane checks
  // armed() before it prints), the INFINITY lane's own switch is turned dark
  // (radio silence - she moves first nowhere until he opens the wide door
  // again himself), and every LIVE road is closed here - voice, bridge and
  // meter alike. Agent turns are refused and stranded finals drop (turn.js
  // reads the master itself), and her prompt orders total silence (block(),
  // below): SEND still files his words to the log, but no reply is raised.
  // Re-arming resumes nothing: ears stay shut, the wide door stays shut.
  // What keeps flying is all manual: switches, panels, vault, drive, pair,
  // sync, telecom - maintenance without chatter.
  function killVoice() {
    var closed = [];
    try {
      var v = window.voice || null;
      if (v) {
        var isLive = false, isListening = false, isSpeaking = false;
        try { isLive = !!(v.isLive && v.isLive()); } catch (e) {}
        try { isListening = !!(v.isListening && v.isListening()); } catch (e) {}
        try { isSpeaking = !!(v.isSpeaking && v.isSpeaking()); } catch (e) {}
        if (isLive) {
          try { if (v.stopLive) v.stopLive(true); } catch (e) {}
          closed.push("LIVE CHANNEL");
        } else {
          if (isListening) {
            try { if (v.stopListen) v.stopListen(true); } catch (e) {}
            closed.push("MICROPHONE");
          }
          if (isSpeaking) {
            try { if (v.stop) v.stop(); } catch (e) {}
            closed.push("HER VOICE");
          }
        }
        try { if (v.dropHold) v.dropHold(); } catch (e) {}
        try { if (v.deferTake) v.deferTake(false); } catch (e) {}
      }
    } catch (e) {}
    try {
      var W = window.live || null;
      if (W && W.isOpen && W.isOpen()) {
        try { W.close(); } catch (e) {}
        if (closed.indexOf("LIVE WIRE") === -1) closed.push("LIVE WIRE");
      }
    } catch (e) {}
    try {
      var ic = window.intercom || null;
      if (ic && ic.abort) {
        try { if (ic.abort()) closed.push("LIACOMM HELD"); } catch (e) {}
      }
    } catch (e) {}
    try {
      var tn = window.turn || null;
      if (tn && tn.clear) {
        var dropped = 0;
        try { dropped = tn.clear("kill").cleared || 0; } catch (e) { dropped = 0; }
        if (dropped) closed.push("TURN QUEUE (" + dropped + ")");
      }
    } catch (e) {}
    try {
      var du = window.duet || null;
      if (du && du.earsOpen && du.earsOpen()) {
        try { du.shutEars(); } catch (e) {}
        closed.push("BRIDGE EARS");
      }
    } catch (e) {}
    try {
      var ab = window.avb || null;
      if (ab) {
        try { if (ab.remoteOn && ab.remoteOn()) { ab.remoteStop(); closed.push("CABLE TAP"); } else if (ab.remoteStop) ab.remoteStop(); } catch (e) {}
        try { if (ab.micOn && ab.micOn()) { ab.micStop(); closed.push("METER MIC"); } } catch (e) {}
      }
    } catch (e) {}
    return closed;
  }

  // RADIO SILENCE. The wide door is not merely held but shut: if the INFINITY
  // lane is lit, its own switch goes dark (its in-flight act drops unsaid on
  // the same road, and re-arming does NOT resume her - he opens it himself).
  // /infinity now stays his own hand throughout.
  function killInfinity() {
    var out = [];
    try {
      var p = window.proactive || null;
      if (p && typeof p.on === "function") {
        var lit = false;
        try { lit = !!p.on(); } catch (e) { lit = false; }
        if (lit) {
          try { p.on(false); } catch (e) {}
          out.push("INFINITY LANE");
        }
      }
    } catch (e) {}
    return out;
  }

  function killReport(closed) {
    var base = "KILL SWITCH :: MASTER OFF - THE SHIP IS COLD. No autonomous lane runs, no agent turn is granted, stranded finals drop unfiled, and she raises no reply: SEND files his words to the log and nothing answers. Re-arming resumes nothing - ears stay shut, the wide door stays shut.";
    if (closed && closed.length) base += " Closed: " + closed.join(", ") + ".";
    else base += " No live road was open.";
    base += " Switches, panels, vault, drive, pair, sync and telecom stay his to work - maintenance without chatter.";
    return base;
  }

  async function save() {
    var k = kv();
    if (!k) return;
    try { await k.set(KEY, { armed: !!armed, level: level }); } catch (e) {}
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var s = await k.get(KEY);
        if (s && typeof s === "object") {
          armed = (s.armed !== false);
          if (s.level === "semi" || s.level === "full") level = s.level;
        }
      } catch (e) {}
    }
    try { paint(); } catch (e) {}
    try { if (window.liaStatus) window.liaStatus(); } catch (e) {}
    return { armed: armed, level: level, mode: mode() };
  }

  function laneLine() {
    var inf = (window.proactive && typeof window.proactive.on === "function") ? (window.proactive.on() ? "LIT" : "DARK") : "?";
    var chk = (window.checkIn && typeof window.checkIn.on === "function") ? (window.checkIn.on() ? "ON" : "OFF") : "?";
    var sh = (window.shift && typeof window.shift.on === "function") ? (window.shift.on() ? "ON" : "OFF") : "?";
    return "  LANES :: INFINITY " + inf + " " + (allow("infinity") ? "(CLEARED)" : "(HELD)")
      + " \u00b7 CHECK-IN " + chk + " " + (allow("checkin") ? "(CLEARED)" : "(HELD)")
      + " \u00b7 QUIET HOURS " + sh + " " + (allow("shift") ? "(CLEARED)" : "(HELD)")
      + " \u00b7 HER HAND " + (mode() === "FULL" ? "(ON THE DASHBOARD)" : "(HELD)") + ".";
  }

  function describe() {
    var out = ["DUTY :: " + mode() + (armed ? " (MASTER ARMED, " + level.toUpperCase() + " AUTOMATION)" : " (KILL SWITCH - THE SHIP IS COLD. SEND FILES WITHOUT ANSWER, NOTHING AUTONOMOUS RUNS)") + "."];
    if (!armed) {
      out.push("  MANUAL MODE: the wide door is SHUT (its switch goes dark - re-arming does not resume her), the narrow door and the quiet hours all stand down, anything autonomous already being made is dropped unsaid, every live road is closed (live channel, open microphone, her speaking, the live wire, bridge ears, cable tap, meter mic), agent turns are refused and stranded finals drop. The ship is cold and he is alone in it: SEND files his words and nothing answers. Switches, panels, vault, drive, pair, sync and telecom stay his - maintenance without chatter.");
    } else if (level === "semi") {
      out.push("  SEMI AUTOMATION: the check-in's one word after a long silence, and the quiet hours' private work. The wide door (infinity) stands down - she never moves first beyond the check-in.");
    } else {
      out.push("  FULL AUTOMATION: everything lit runs - the wide door (she runs the conversation on her own clock), the narrow door, and the quiet hours. Each lane still answers to its own switch and its own ceilings.");
      out.push("  HER HAND IS ON THE DASHBOARD: at FULL she may press the console's own switches herself - INFINITY, GALLERY, FRAME, CENTER, VIMEO, BACKSTAGE, SHIFT, LISTEN, PICS, AUDITION ([[PRESS: <name>]] lines in an act, up to three). A switch she touches STAYS LIT until your hand takes it back. The MASTER ARM itself is never hers. /hand SAYS WHAT SHE HAS TOUCHED.");
    }
    out.push(laneLine());
    out.push("  /duty on|off \u00b7 /duty semi|full \u00b7 /duty arm semi|full \u00b7 /duty kill \u00b7 /duty (this). OFF is the kill switch - full manual mode.");
    return out.join("\n");
  }

  function block() {
    var m = mode();
    if (m === "OFF") {
      return ["MANUAL MODE :: THE SHIP IS COLD.",
        "Patrikios is the pilot and the ship is in full manual mode with the master off: nothing autonomous runs - not the wide door, not the narrow door, not the quiet hours, no live road, no agent turns, no bridge finals. Raise no reply to anything he sends: his words file to the log and that is the whole of it - the log is his notebook while he works, and silence is the work. Rest between turns. His switches, panels, vault, drive, pair, sync and telecom are his own hands and stay live. If he arms the master you take your station again without being told twice - but the wide door stays shut until he opens it himself, and the bridge ears stay shut until he opens them."
      ].join("\n");
    }
    if (m === "SEMI") {
      return ["YOUR STATION :: YOU ARE ON PARTIAL DUTY.",
        "Patrikios is the pilot; you are his co-pilot, at your station on the bridge. Hold it, but do not take the ship out: answer when spoken to, keep the check-in's one word after a long silence and the quiet hours' private work, and never move first beyond them. The wide door stays shut until he opens it to FULL. In TANDEM the two of you run the ship from the same page - what is on the stage is the ship's state, and your hand on it is how you fly together."
      ].join("\n");
    }
    return ["YOUR STATION :: YOU ARE ON DUTY.",
      "Patrikios is the pilot; you are his co-pilot, at your station on the bridge. While the room is quiet you may move first on your own judgment - speak in your own voice, remind him out of the record, send a picture from the vault or make one. In TANDEM the two of you run the ship from the same page: what is on the stage is the ship's state, and your hand on it is how you fly together. At FULL your hand is on the dashboard too: a [[PRESS: <switch>]] line in an act presses that console switch for him - INFINITY, GALLERY, FRAME, CENTER, VIMEO, BACKSTAGE, SHIFT, LISTEN, PICS or AUDITION, up to three in one act - and a switch you touch stays lit with your touch until his hand takes it back. The MASTER ARM itself is never yours to touch, nor the microphone roads, the keys or the gate."
    ].join("\n");
  }

  async function arm(v, who) {
    var goingOff = !v;
    armed = !!v;
    await save();
    try { paint(); } catch (e) {}
    try { if (window.liaStatus) window.liaStatus(); } catch (e) {}
    if (goingOff) {
      var closed = [];
      try { closed = killVoice(); } catch (e) { closed = []; }
      try { closed = closed.concat(killInfinity()); } catch (e) {}
      var line = killReport(closed);
      try { if (typeof print === "function") print("SYSTEM", line); } catch (e) {}
    }
    return describe();
  }

  async function setLevel(l, who) {
    l = String(l || "").toLowerCase();
    if (l !== "semi" && l !== "full") return "USAGE: /duty semi|full - SEMI IS PARTIAL AUTOMATION (CHECK-IN AND QUIET HOURS, NO WIDE DOOR), FULL IS ALL OF IT.";
    level = l;
    armed = true;
    await save();
    try { paint(); } catch (e) {}
    try { if (window.liaStatus) window.liaStatus(); } catch (e) {}
    return describe();
  }

  async function words(arg) {
    var toks = String(arg || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return describe();
    var wantArm = null, wantLevel = null;
    toks.forEach(function (t) {
      if (t === "on" || t === "arm" || t === "armed" || t === "enable") wantArm = true;
      else if (t === "off" || t === "disarm" || t === "safe" || t === "disable" || t === "standdown" || t === "stand-down" || t === "kill" || t === "manual") wantArm = false;
      else if (t === "semi" || t === "partial" || t === "half") wantLevel = "semi";
      else if (t === "full" || t === "auto" || t === "all") wantLevel = "full";
    });
    if (wantArm === null && wantLevel === null) {
      return "USAGE: /duty \u00b7 /duty on|off \u00b7 /duty semi|full \u00b7 /duty arm semi|full \u00b7 /duty kill\n" + describe();
    }
    if (wantLevel) level = wantLevel;
    if (wantArm !== null) armed = wantArm;
    else if (wantLevel) armed = true;
    await save();
    try { paint(); } catch (e) {}
    try { if (window.liaStatus) window.liaStatus(); } catch (e) {}
    if (wantArm === false) {
      var closed2 = [];
      try { closed2 = killVoice(); } catch (e) { closed2 = []; }
      try { closed2 = closed2.concat(killInfinity()); } catch (e) {}
      var line2 = killReport(closed2);
      try { if (typeof print === "function") print("SYSTEM", line2); } catch (e) {}
    }
    return describe();
  }

  function paint() {
    var lamp = el("dutyLamp");
    if (lamp) {
      lamp.textContent = armed ? ("MASTER ARMED - " + level.toUpperCase()) : "MANUAL MODE - MASTER OFF";
      lamp.classList.toggle("on", !!armed);
      lamp.classList.toggle("off", !armed);
    }
    var b0 = el("dutyOffBtn"), b1 = el("dutySemiBtn"), b2 = el("dutyFullBtn");
    if (b0) b0.setAttribute("aria-pressed", !armed ? "true" : "false");
    if (b1) b1.setAttribute("aria-pressed", (armed && level === "semi") ? "true" : "false");
    if (b2) b2.setAttribute("aria-pressed", (armed && level === "full") ? "true" : "false");
    var kb = el("dutyKillBtn");
    if (kb) kb.setAttribute("aria-pressed", !armed ? "true" : "false");
  }

  (function () {
    var pr = load();
    if (pr && pr.then) pr.then(function () {}, function () {});
  })();

  window.duty = {
    mode: mode,
    armed: function () { return armed; },
    level: function () { return level; },
    allow: allow,
    arm: arm,
    setLevel: setLevel,
    words: words,
    describe: describe,
    block: block,
    paint: paint,
    load: load,
    kill: function () { return arm(false, "kill"); },
    manual: function () { return !armed; },
    state: function () { return { armed: armed, level: level, mode: mode() }; }
  };
})();
