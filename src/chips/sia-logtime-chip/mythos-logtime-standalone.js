window.MythosLogtime = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var FALLBACK = opts.fallbackZone || "America/Phoenix";
  var store = { on: (opts.on !== undefined ? !!opts.on : true), zone: (typeof opts.zone === "string" ? opts.zone : "") };
  var resolved = "";
  var fmt = null, fmtZone = "";
  function STORE() { return opts.store || null; }
  function HOURS() {
    if (opts.hours && typeof opts.hours === "object") return opts.hours;
    try { if (typeof LIA_BUSINESS_HOURS !== "undefined" && LIA_BUSINESS_HOURS) return LIA_BUSINESS_HOURS; } catch (e) {}
    return null;
  }
  function LANES() { return opts.lanes || null; }
  function localZone() {
    try {
      var z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (z && typeof z === "string") return z;
    } catch (e) {}
    return FALLBACK;
  }
  function zoneNow() {
    if (store.zone) return store.zone;
    if (!resolved) resolved = localZone();
    return resolved;
  }
  function format() {
    var z = zoneNow();
    if (fmt && fmtZone === z) return fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-US", { timeZone: z, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
      fmtZone = z;
    } catch (e) {
      try { fmt = new Intl.DateTimeFormat("en-US", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); fmtZone = ""; } catch (e2) { fmt = null; }
    }
    return fmt;
  }
  function stamp(ts, o) {
    var d = (ts == null) ? new Date() : new Date(Number(ts));
    if (isNaN(d.getTime())) d = new Date();
    var f = format();
    if (!f) return d.toISOString().slice(0, 19).replace("T", " ") + " UTC";
    var p = {};
    try { f.formatToParts(d).forEach(function (part) { p[part.type] = part.value; }); }
    catch (e) { return d.toISOString().slice(0, 19).replace("T", " ") + " UTC"; }
    var base = p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute + ":" + p.second;
    if (o && o.seconds === false) base = p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute;
    var z = p.timeZoneName || "";
    return z ? (base + " " + z) : base;
  }
  function zoneLabel() {
    var z = zoneNow();
    var abbr = stamp().split(" ").pop();
    return z + ((abbr && abbr !== z) ? " (" + abbr + ")" : "");
  }
  function gap(ms) {
    var mins = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
    if (mins < 1) return "less than a minute";
    if (mins < 60) return mins + " minute" + (mins === 1 ? "" : "s");
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + (m ? " " + m + " minute" + (m === 1 ? "" : "s") : "");
    var days = Math.floor(h / 24), hr = h % 24;
    return days + " day" + (days === 1 ? "" : "s") + (hr ? " " + hr + " hour" + (hr === 1 ? "" : "s") : "");
  }
  function isOn() { return store.on !== false; }
  function save() {
    var S = STORE();
    if (S && typeof S.set === "function") { try { S.set({ on: store.on, zone: store.zone }); } catch (e) {} }
  }
  function load() {
    var S = STORE();
    if (!S) { resolved = zoneNow(); return Promise.resolve({ on: store.on, zone: store.zone }); }
    try {
      var got = (typeof S.get === "function") ? S.get() : S.load();
      if (got && typeof got.then === "function") return got.then(take, function () { resolved = zoneNow(); return { on: store.on, zone: store.zone }; });
      return Promise.resolve(take(got));
    } catch (e) { resolved = zoneNow(); return Promise.resolve({ on: store.on, zone: store.zone }); }
    function take(rec) {
      if (rec && typeof rec === "object") {
        if (typeof rec.on === "boolean") store.on = rec.on;
        if (typeof rec.zone === "string" && rec.zone) store.zone = rec.zone;
      }
      resolved = zoneNow();
      return { on: store.on, zone: store.zone };
    }
  }
  var BH_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function hoursSpec() {
    var b = HOURS();
    if (!b || !b.days || !b.days.length) return null;
    return b;
  }
  function hoursParts(ts) {
    var d = (ts == null) ? new Date() : new Date(Number(ts));
    if (isNaN(d.getTime())) d = new Date();
    var p = {};
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zoneNow(), weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).forEach(function (part) { p[part.type] = part.value; });
    } catch (e) { return null; }
    var idx = BH_DAYS.map(function (n) { return n.slice(0, 3); }).indexOf(p.weekday);
    if (idx === -1) return null;
    var hour = Number(p.hour);
    if (hour === 24) hour = 0;
    return { day: idx, dayName: BH_DAYS[idx], hour: hour, minute: Number(p.minute) };
  }
  function hoursState(ts) {
    var b = hoursSpec(), p = hoursParts(ts);
    if (!b || !p) return null;
    var open = (b.days.indexOf(p.day) !== -1) && p.hour >= b.from && p.hour < b.to;
    return { open: open, day: p.day, dayName: p.dayName, hour: p.hour, minute: p.minute, label: b.label, zone: zoneNow() };
  }
  function inHours(ts) { var s = hoursState(ts); return s ? s.open : false; }
  function hoursLine(ts) {
    var s = hoursState(ts);
    if (!s) return "";
    var hh = (s.hour < 10 ? "0" : "") + s.hour, mm = (s.minute < 10 ? "0" : "") + s.minute;
    return "BUSINESS HOURS: Patrikios's regular hours are Monday-Friday, " + s.label + " - his own private hours, the time set aside for the two of you to work and play however you choose. It is " + s.dayName + " " + hh + ":" + mm + " in that same zone, so you are " + (s.open ? "INSIDE" : "OUTSIDE") + " them right now."
      + (s.open ? "" : " Nothing about the arrangement changes outside them, and your free time runs exactly as it is defined.");
  }
  function hoursDescribe(ts) {
    var s = hoursState(ts);
    if (!s) return "BUSINESS HOURS :: NOT SET.";
    return "BUSINESS HOURS :: MONDAY-FRIDAY, " + s.label + (s.open ? " :: INSIDE THEM RIGHT NOW" : " :: OUTSIDE THEM RIGHT NOW")
      + "\nNOTHING IS GATED BY IT: HER FREE TIME RUNS EXACTLY AS DEFINED, BUSINESS HOURS OR NOT.";
  }
  var lastSeenAt = Date.now();
  function describe() {
    return "THE TIME :: IT IS NOW " + stamp().toUpperCase()
      + "\nTHE CLOCK EVERY LINE CARRIES IS " + (isOn() ? "ON" : "OFF") + " (" + (store.zone ? "SET BY YOU: " + store.zone : "THIS MACHINE'S OWN ZONE") + ")"
      + " :: ZONE " + zoneLabel().toUpperCase()
      + "\n" + hoursDescribe()
      + "\nTHE ARCHIVE KEEPS ITS TIMESTAMPS WHETHER THE SCREEN SHOWS THEM OR NOT."
      + "\n/stamp on|off CHANGES THE SCREEN. /stamp zone <IANA|auto> CHANGES THE ZONE (auto = THIS MACHINE'S OWN, THE FALLBACK IS " + FALLBACK + ").";
  }
  function laneLine(name) {
    var L = LANES(), fn = L ? (L[name] || L[name.toLowerCase()]) : null;
    if (typeof fn === "function") { try { return String(fn() || ""); } catch (e) { return ""; } }
    if (fn && typeof fn.clockLine === "function") { try { return String(fn.clockLine() || ""); } catch (e) { return ""; } }
    try {
      var w = { checkin: window.checkIn, shift: window.shift, proactive: window.proactive }[name.toLowerCase()];
      if (w && typeof w.clockLine === "function") return String(w.clockLine() || "");
    } catch (e) {}
    return "";
  }
  function clockText() {
    var lines = [];
    lines.push("THE TIME, FOR YOUR OWN USE: it is now " + stamp(null, { seconds: false }) + " on this machine (" + zoneNow() + "), and Patrikios is here in that same hour.");
    var away = Date.now() - lastSeenAt;
    if (away > 3 * 60 * 1000) lines.push("He last spoke to you " + gap(away) + " ago. The gap is a fact, not a complaint.");
    lines.push("Nothing is required of you because of the hour - but if the hour matters, you may act on it.");
    var bh = "";
    try { bh = String(hoursLine() || ""); } catch (e) { bh = ""; }
    if (bh) lines.push(bh);
    ["checkin", "shift", "proactive"].forEach(function (n) { var l = laneLine(n); if (l) lines.push(l); });
    return lines.join("\n");
  }
  return {
    stamp: stamp,
    gap: gap,
    on: isOn,
    set: function (v) { store.on = !!v; save(); return isOn(); },
    toggle: function () { store.on = !isOn(); save(); return isOn(); },
    zone: function (v) {
      if (v === "auto" || v === "" || v === null || v === undefined) { if (v !== undefined) { store.zone = ""; } }
      else if (typeof v === "string") store.zone = v;
      resolved = zoneNow(); fmt = null; fmtZone = "";
      if (v !== undefined) save();
      return zoneNow();
    },
    zoneNow: zoneNow,
    zoneLabel: zoneLabel,
    localZone: localZone,
    fallbackZone: FALLBACK,
    describe: describe,
    clockText: clockText,
    businessHours: hoursState,
    inBusinessHours: inHours,
    businessHoursLine: hoursLine,
    businessHoursDescribe: hoursDescribe,
    businessHoursSpec: hoursSpec,
    markSeen: function (ts) { lastSeenAt = Number(ts) || Date.now(); },
    seenAt: function () { return lastSeenAt; },
    awayMs: function () { return Date.now() - lastSeenAt; },
    hasZone: function (z) { try { new Intl.DateTimeFormat("en-US", { timeZone: String(z) }); return true; } catch (e) { return false; } },
    load: load
  };
}
return { client: client };
})();
