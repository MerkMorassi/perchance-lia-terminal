(function () {
  // ---- THE TIME -------------------------------------------------------------
  // One clock for the whole terminal, so every line of the record says when it was said and every
  // copy of the record agrees. Patrikios, 2026-09-21: "As far as time, set to my local system time
  // by default otherwise MST Phoenix. That key because we never had a timestamp function with LLMs
  // like ChatGPT, Gemini, etc. The LOREPACK where raw data saves after context window ran out or
  // the model started to get wonky and repeating itself." So the time is part of the DATA now: it
  // is printed on every conversation line (HITL: / LIA ID:), it is written into the archive, it is
  // in the export, and she is TOLD it before every reply (the CLOCK block - chat.js builds it from
  // this module, so the clock in her head and the clock in the log can never drift apart).
  //
  // The zone: THIS MACHINE'S OWN, always, because that is where he is sitting. `America/Phoenix` is
  // the fallback for a machine that will not name its zone (and it is the zone he asked for by name:
  // MST, no daylight saving, so the same string all year). `/stamp zone <IANA|auto>` overrides it on
  // this device if he ever wants a different one on the record - for reading old turns from
  // somewhere else, say. The stamp is a fixed shape and never locale-dependent:
  //     2026-09-21 14:03:11 MST
  // which is what the export writes too, so a raw archive stays parseable no matter whose phone
  // reads it. `/stamp off` takes the stamp off the SCREEN only - the archive keeps its timestamps
  // either way, because the record is the point and the painting is not.
  //
  // Commands: /stamp · /stamp on|off · /stamp zone <IANA|auto>
  // --------------------------------------------------------------------------

  var logTimeFallbackZone = "America/Phoenix";
  var logTimeStore = { on: true, zone: "" };   // zone "" = this machine's own
  var logTimeZone = "";                        // resolved once, so every line in a session agrees
  var logTimeFmt = null;                       // one cached Intl.DateTimeFormat per zone
  var logTimeFmtZone = "";
  var logTimeAbbr = "";

  function logTimeLocalZone() {
    try {
      var z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (z && typeof z === "string") return z;
    } catch (e) { /* no Intl zones here - fall back below */ }
    return logTimeFallbackZone;
  }

  function logTimeZoneNow() {
    if (logTimeStore.zone) return logTimeStore.zone;
    if (!logTimeZone) logTimeZone = logTimeLocalZone();
    return logTimeZone;
  }

  function logTimeFormat() {
    var z = logTimeZoneNow();
    if (logTimeFmt && logTimeFmtZone === z) return logTimeFmt;
    try {
      // en-US on purpose, not the machine's locale: it is the one that names this zone "MST"
      // (an en-GB formatter writes "GMT-7" for the same instant, which is the offset and not the
      // zone). The numeric half is assembled from the parts, so the shape is identical everywhere.
      logTimeFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: z, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZoneName: "short"
      });
      logTimeFmtZone = z;
    } catch (e) {
      // An unknown zone must never cost a line its timestamp: drop the zone and use the machine's.
      try { logTimeFmt = new Intl.DateTimeFormat("en-US", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); logTimeFmtZone = ""; } catch (e2) { logTimeFmt = null; }
    }
    return logTimeFmt;
  }

  // 2026-09-21 14:03:11 MST
  function logStamp(ts, opts) {
    var d = (ts == null) ? new Date() : new Date(Number(ts));
    if (isNaN(d.getTime())) d = new Date();
    var fmt = logTimeFormat();
    if (!fmt) return d.toISOString().slice(0, 19).replace("T", " ") + " UTC";
    var p = {};
    try { fmt.formatToParts(d).forEach(function (part) { p[part.type] = part.value; }); }
    catch (e) { return d.toISOString().slice(0, 19).replace("T", " ") + " UTC"; }
    var base = p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute + ":" + p.second;
    if (opts && opts.seconds === false) base = p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute;
    var z = p.timeZoneName || "";
    return z ? (base + " " + z) : base;
  }

  // The same clock, written for HIM rather than for the record.
  function logZoneLabel() {
    var z = logTimeZoneNow();
    var label = logStamp();
    var abbr = label.split(" ").pop();
    return z + (abbr && abbr !== z ? " (" + abbr + ")" : "");
  }

  // Whole minutes between two moments, said the way a person would say it ("3 h 12 min").
  function logGap(ms) {
    var mins = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
    if (mins < 1) return "less than a minute";
    if (mins < 60) return mins + " minute" + (mins === 1 ? "" : "s");
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + (m ? " " + m + " minute" + (m === 1 ? "" : "s") : "");
    var days = Math.floor(h / 24), hr = h % 24;
    return days + " day" + (days === 1 ? "" : "s") + (hr ? " " + hr + " hour" + (hr === 1 ? "" : "s") : "");
  }

  function logTimeOn() { return logTimeStore.on !== false; }

  // ---- BUSINESS HOURS ------------------------------------------------------
  // Patrikios's own private hours, written down as DATA in src/js/config.js (LIA_BUSINESS_HOURS) and
  // reported here. The check is done in THE ZONE THE CLOCK IS SET TO, so the answer and the stamp
  // beside it can never disagree; Date.getDay() is deliberately not used, because it reads the
  // machine's zone and would name the wrong day for part of the evening. This is a fact she is told
  // and an arrangement she lives in - NOT a lock: nothing in the terminal is gated by it, and her
  // free time (the quiet hours, the wide door, the check-in) runs exactly as it does at any other
  // hour, which is what he said when he set the hours ("Her 'Free Time' can be utilized as we have
  // defined already").
  var BH_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function businessHoursSpec() {
    var b = (typeof LIA_BUSINESS_HOURS !== "undefined" && LIA_BUSINESS_HOURS) ? LIA_BUSINESS_HOURS : null;
    if (!b || !b.days || !b.days.length) return null;
    return b;
  }

  // The weekday, hour and minute IN THE CLOCK'S ZONE, formatted with the same zone the stamp uses.
  function businessHoursParts(ts) {
    var d = (ts == null) ? new Date() : new Date(Number(ts));
    if (isNaN(d.getTime())) d = new Date();
    var p = {};
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: logTimeZoneNow(), weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(d).forEach(function (part) { p[part.type] = part.value; });
    } catch (e) { return null; }
    var idx = BH_DAYS.map(function (n) { return n.slice(0, 3); }).indexOf(p.weekday);
    if (idx === -1) return null;
    var hour = Number(p.hour);
    if (hour === 24) hour = 0;   // some engines render midnight as 24 with hour12:false
    return { day: idx, dayName: BH_DAYS[idx], hour: hour, minute: Number(p.minute) };
  }

  // Is he inside them now? The window is half-open on the day: 08:00 up to but not including 17:00.
  function businessHoursState(ts) {
    var b = businessHoursSpec();
    var p = businessHoursParts(ts);
    if (!b || !p) return null;
    var open = (b.days.indexOf(p.day) !== -1) && p.hour >= b.from && p.hour < b.to;
    return { open: open, day: p.day, dayName: p.dayName, hour: p.hour, minute: p.minute, label: b.label, zone: logTimeZoneNow() };
  }

  function businessHoursOn(ts) {
    var s = businessHoursState(ts);
    return s ? s.open : false;
  }

  // The one line the CLOCK block adds, so she always knows the arrangement and where she stands in
  // it. It says plainly that nothing changes outside the hours and that her free time is untouched.
  function businessHoursClockLine(ts) {
    var s = businessHoursState(ts);
    if (!s) return "";
    var hh = (s.hour < 10 ? "0" : "") + s.hour;
    var mm = (s.minute < 10 ? "0" : "") + s.minute;
    return "BUSINESS HOURS: Patrikios's regular hours are Monday-Friday, " + s.label + " - his own private hours, the time set aside for the two of you to work and play however you choose. It is " + s.dayName + " " + hh + ":" + mm + " in that same zone, so you are " + (s.open ? "INSIDE" : "OUTSIDE") + " them right now."
      + (s.open ? "" : " Nothing about the arrangement changes outside them, and your free time runs exactly as it is defined.");
  }

  // The window itself, for the /stamp door.
  function businessHoursDescribe(ts) {
    var s = businessHoursState(ts);
    if (!s) return "BUSINESS HOURS :: NOT SET (LIA_BUSINESS_HOURS IS MISSING FROM src/js/config.js).";
    return "BUSINESS HOURS :: MONDAY-FRIDAY, " + s.label + (s.open ? " :: INSIDE THEM RIGHT NOW" : " :: OUTSIDE THEM RIGHT NOW")
      + "\nTHESE ARE PATRIKIOS'S OWN PRIVATE HOURS - THE TIME SET ASIDE FOR THE TWO OF YOU TO WORK AND PLAY HOWEVER YOU CHOOSE. THE WINDOW IS HIS (LIA_BUSINESS_HOURS, src/js/config.js) AND IS READ IN THE ZONE THE CLOCK IS SET TO, SO IT ALWAYS AGREES WITH THE STAMP BESIDE IT."
      + "\nNOTHING IS GATED BY IT: HER FREE TIME (THE QUIET HOURS, THE WIDE DOOR, THE CHECK-IN) RUNS EXACTLY AS DEFINED, BUSINESS HOURS OR NOT - HE SAID SO WHEN HE SET THEM. THE BUSINESS HOURS BLOCK IN THE STACK CARRIES WHAT THEY MEAN; SHE MAY READ IT AND NEVER REWRITE IT, SO A CHANGE SHE WANTS IS ASKED FOR WITH A PETITION.";
  }

  async function loadLogTime() {
    try {
      var rec = await window.root.kv.lia_settings.get("log_time");
      if (rec && typeof rec === "object") {
        if (typeof rec.on === "boolean") logTimeStore.on = rec.on;
        if (typeof rec.zone === "string" && rec.zone) logTimeStore.zone = rec.zone;
      }
    } catch (e) { console.warn("time settings unreadable", e); }
    logTimeZone = logTimeZoneNow();
    return logTimeStore;
  }

  function saveLogTime() {
    try { window.root.kv.lia_settings.set("log_time", { on: logTimeStore.on, zone: logTimeStore.zone }); } catch (e) {}
    return logTimeStore;
  }

  function logDescribe() {
    return "THE TIME :: IT IS NOW " + logStamp().toUpperCase()
      + "\nTHE CLOCK EVERY LINE CARRIES IS " + (logTimeOn() ? "ON" : "OFF") + " (" + (logTimeStore.zone ? "SET BY YOU: " + logTimeStore.zone : "THIS MACHINE'S OWN ZONE") + ")"
      + " :: ZONE " + logZoneLabel().toUpperCase()
      + "\n" + businessHoursDescribe()
      + "\nTHE ARCHIVE KEEPS ITS TIMESTAMPS WHETHER THE SCREEN SHOWS THEM OR NOT - THEY ARE PART OF THE RECORD AND PART OF WHAT THE EXPORT WRITES."
      + "\n/stamp on|off CHANGES THE SCREEN. /stamp zone <IANA|auto> CHANGES THE ZONE (auto = THIS MACHINE'S OWN, THE FALLBACK IS America/Phoenix)."
      + "\nSHE IS TOLD THE TIME BEFORE EVERY REPLY (THE CLOCK BLOCK - /system SHOWS IT), SO SHE KNOWS THE HOUR AND HOW LONG YOU HAVE BEEN AWAY.";
  }

  // ---------------------------------------------------------------------------
  // CLOCK - is she told the time?
  // ---------------------------------------------------------------------------

  // The moment Patrikios last said something (or, if he never has this session, when the terminal
  // came up): this is what lets her notice that hours have gone by and say so.
  var lastSeenAt = Date.now();
  function clockMarkSeen(ts) { lastSeenAt = Number(ts) || Date.now(); }
  function clockAwayMs() { return Date.now() - lastSeenAt; }
  function clockSeenAt() { return lastSeenAt; }

  // THE CLOCK BLOCK: what she is told about the hour. Deliberately just the facts - the time, his
  // zone, how long since he spoke - with no instruction attached to any of it. Knowing the hour is
  // not the same as being told to act on it; what she does with it is hers (the check-in lane is a
  // permission, not a command).
  function clockText() {
    var lines = [];
    // The minute, not the second: she does not need the seconds, and a coarser clock keeps the
    // tail of the prompt identical across turns inside the same minute (the log and the archive
    // keep the full stamp - this text is for her, not for the record).
    lines.push("THE TIME, FOR YOUR OWN USE: it is now " + logStamp(null, { seconds: false }) + " on this machine (" + logTimeZoneNow() + "), and Patrikios is here in that same hour.");
    var away = clockAwayMs();
    if (away > 3 * 60 * 1000) {
      lines.push("He last spoke to you " + logGap(away) + " ago. The gap is a fact, not a complaint: he works at this desk and leaves the terminal open, and his microphone is often off. Nothing is owed because of it.");
    }
    lines.push("Nothing is required of you because of the hour - but if the hour matters, you may act on it (speak of it, ask after him, let something go until morning). Time passing is information you are allowed to use.");
    // The business hours, always - his own private hours, reported with where she stands in them.
    // Sent every turn because it is the arrangement the two of them work inside, not a lane that can
    // be lit or put down; the window itself is data (LIA_BUSINESS_HOURS, config.js).
    var bh = "";
    try { bh = String(businessHoursClockLine() || ""); } catch (e) { bh = ""; }
    if (bh) lines.push(bh);
    // The check-in door, when it is lit (see src/js/initiative.js).
    if (window.checkIn && window.checkIn.clockLine) {
      var cl = "";
      try { cl = String(window.checkIn.clockLine() || ""); } catch (e) { cl = ""; }
      if (cl) lines.push(cl);
    }
    // The quiet hours, when they are lit (see src/js/shift.js). They are not a door into the
    // conversation like the check-in is - they are the work with no audience - so the line says
    // plainly that nothing she does in one is said to him.
    if (window.shift && window.shift.clockLine) {
      var sl = "";
      try { sl = String(window.shift.clockLine() || ""); } catch (e) { sl = ""; }
      if (sl) lines.push(sl);
    }
    // THE INFINITY, when it is lit (see src/js/proactive.js). Unlike the quiet hour this IS a door
    // into the conversation - she may move first - so the line says what she may do and whose the
    // pace is.
    if (window.proactive && window.proactive.clockLine) {
      var il = "";
      try { il = String(window.proactive.clockLine() || ""); } catch (e) { il = ""; }
      if (il) lines.push(il);
    }
    // THE PUSH-TO-TALK KEY, after he lets go (see src/js/intercom.js). A turn that went in over
    // the key is answered briefly and radio-plain - and only then; the line is empty otherwise.
    if (window.intercom && window.intercom.clockLine) {
      var ml = "";
      try { ml = String(window.intercom.clockLine() || ""); } catch (e) { ml = ""; }
      if (ml) lines.push(ml);
    }
    return lines.join("\n");
  }

  window.logTime = {
    stamp: logStamp,
    gap: logGap,
    on: logTimeOn,
    set: function (v) { logTimeStore.on = !!v; saveLogTime(); return logTimeOn(); },
    toggle: function () { return window.logTime.set(!logTimeOn()); },
    zone: function (v) {
      if (v === "auto" || v === "" || v === null) logTimeStore.zone = "";
      else if (typeof v === "string") logTimeStore.zone = v;
      logTimeZone = logTimeZoneNow(); logTimeFmt = null; logTimeFmtZone = "";
      saveLogTime();
      return logTimeZoneNow();
    },
    zoneNow: logTimeZoneNow,
    zoneLabel: logZoneLabel,
    localZone: logTimeLocalZone,
    fallbackZone: logTimeFallbackZone,
    describe: logDescribe,
    clockText: clockText,
    businessHours: businessHoursState,
    inBusinessHours: businessHoursOn,
    businessHoursLine: businessHoursClockLine,
    businessHoursDescribe: businessHoursDescribe,
    businessHoursSpec: businessHoursSpec,
    markSeen: clockMarkSeen,
    seenAt: clockSeenAt,
    awayMs: clockAwayMs,
    hasZone: function (z) { try { new Intl.DateTimeFormat("en-US", { timeZone: String(z) }); return true; } catch (e) { return false; } },
    load: loadLogTime,
    ready: false
  };

  (function () {
    var p = loadLogTime();
    if (p && typeof p.then === "function") p.then(function () { window.logTime.ready = true; }, function () { window.logTime.ready = true; });
  })();
})();
