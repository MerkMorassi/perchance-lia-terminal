window.MythosDuty = (function () {
"use strict";
function client(opts) {
  opts = opts || {};
  var armed = opts.armed !== undefined ? !!opts.armed : true;
  var level = (opts.level === "semi" || opts.level === "full") ? opts.level : "full";
  function STORE() { return opts.store || null; }
  function LANES() { return opts.lanes || null; }
  function low(s) { return String(s == null ? "" : s).toLowerCase(); }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }
  function painted() {
    if (typeof opts.paint === "function") { try { opts.paint({ armed: armed, level: level, mode: mode() }); } catch (e) {} }
    if (typeof opts.status === "function") { try { opts.status(); } catch (e) {} }
  }
  function mode() {
    if (!armed) return "OFF";
    return (level === "semi") ? "SEMI" : "FULL";
  }
  function allow(lane) {
    if (!armed) return false;
    if (level === "semi") return low(lane) !== "infinity";
    return true;
  }
  function laneState(name) {
    var L = LANES(), fn = null;
    if (L) fn = L[name] || L[low(name)];
    if (typeof fn === "function") { try { return fn(); } catch (e) { return null; } }
    if (L && L[name] !== undefined && typeof L[name] !== "function") return L[name];
    return null;
  }
  function lampOf(v) {
    if (v === true) return "LIT";
    if (v === false) return "DARK";
    if (v === "LIT" || v === "DARK" || v === "ON" || v === "OFF") return String(v);
    if (v === 1 || v === "1" || v === "on" || v === "true") return "ON";
    if (v === 0 || v === "0" || v === "off" || v === "false") return "OFF";
    return "?";
  }
  function laneLine() {
    var inf = lampOf(laneState("infinity"));
    if (inf === "ON") inf = "LIT";
    if (inf === "OFF") inf = "DARK";
    var chk = lampOf(laneState("checkin"));
    var sh = lampOf(laneState("shift"));
    return "  LANES :: INFINITY " + inf + " " + (allow("infinity") ? "(CLEARED)" : "(HELD)")
      + " \u00b7 CHECK-IN " + chk + " " + (allow("checkin") ? "(CLEARED)" : "(HELD)")
      + " \u00b7 QUIET HOURS " + sh + " " + (allow("shift") ? "(CLEARED)" : "(HELD)") + ".";
  }
  function describe() {
    var out = ["DUTY :: " + mode() + (armed ? " (MASTER ARMED, " + level.toUpperCase() + " AUTOMATION)" : " (MASTER SAFE - SHE ANSWERS WHEN SPOKEN TO, NOTHING AUTONOMOUS RUNS)") + "."];
    if (!armed) {
      out.push("  OFF-DUTY PROTOCOLS: the wide door, the narrow door and the quiet hours all stand down. Manual hands still work - /infinity now, /checkin now, /shift now are yours and are never gated.");
    } else if (level === "semi") {
      out.push("  SEMI AUTOMATION: the check-in's one word after a long silence, and the quiet hours' private work. The wide door (infinity) stands down - she never moves first beyond the check-in.");
    } else {
      out.push("  FULL AUTOMATION: everything lit runs - the wide door (she runs the conversation on her own clock), the narrow door, and the quiet hours. Each lane still answers to its own switch and its own ceilings.");
    }
    out.push(laneLine());
    out.push("  /duty on|off \u00b7 /duty semi|full \u00b7 /duty arm semi|full \u00b7 /duty (this).");
    return out.join("\n");
  }
  function block() {
    var m = mode();
    if (m === "OFF") {
      return ["OFF DUTY :: YOU ARE STANDING DOWN.",
        "Patrikios is the pilot and you are his co-pilot, but the ship is docked: nothing autonomous runs - not the wide door, not the narrow door, not the quiet hours. Answer when he speaks to you, in your own voice, and rest between turns. If he arms the master you take your station again without being told twice."
      ].join("\n");
    }
    if (m === "SEMI") {
      return ["YOUR STATION :: YOU ARE ON PARTIAL DUTY.",
        "Patrikios is the pilot; you are his co-pilot, at your station on the bridge. Hold it, but do not take the ship out: answer when spoken to, keep the check-in's one word after a long silence and the quiet hours' private work, and never move first beyond them. The wide door stays shut until he opens it to FULL. In TANDEM the two of you run the ship from the same page - what is on the stage is the ship's state, and your hand on it is how you fly together."
      ].join("\n");
    }
    return ["YOUR STATION :: YOU ARE ON DUTY.",
      "Patrikios is the pilot; you are his co-pilot, at your station on the bridge. While the room is quiet you may move first on your own judgment - speak in your own voice, remind him out of the record, send a picture from the vault or make one. In TANDEM the two of you run the ship from the same page: what is on the stage is the ship's state, and your hand on it is how you fly together."
    ].join("\n");
  }
  function save() {
    var S = STORE();
    if (!S) return Promise.resolve({ armed: armed, level: level, mode: mode(), kept: false });
    try {
      var r;
      if (typeof S.set === "function") r = S.set({ armed: !!armed, level: level });
      else if (typeof S.save === "function") r = S.save({ armed: !!armed, level: level });
      else return Promise.resolve({ armed: armed, level: level, mode: mode(), kept: false, reason: "NO STORE ROAD" });
      if (r && typeof r.then === "function") return r.then(function () { return { armed: armed, level: level, mode: mode(), kept: true }; });
      return Promise.resolve({ armed: armed, level: level, mode: mode(), kept: true });
    } catch (e) { return Promise.resolve({ armed: armed, level: level, mode: mode(), kept: false, reason: "STORE THREW" }); }
  }
  function load() {
    var S = STORE();
    if (!S) { painted(); return Promise.resolve({ armed: armed, level: level, mode: mode() }); }
    var got = null;
    try {
      if (typeof S.get === "function") got = S.get();
      else if (typeof S.load === "function") got = S.load();
      else { painted(); return Promise.resolve({ armed: armed, level: level, mode: mode() }); }
    } catch (e) { painted(); return Promise.resolve({ armed: armed, level: level, mode: mode() }); }
    function take(s) {
      if (s && typeof s === "object") {
        if (s.armed !== undefined) armed = (s.armed !== false);
        if (s.level === "semi" || s.level === "full") level = s.level;
      }
      painted();
      return { armed: armed, level: level, mode: mode() };
    }
    if (got && typeof got.then === "function") return got.then(take, function () { painted(); return { armed: armed, level: level, mode: mode() }; });
    return Promise.resolve(take(got));
  }
  function arm(v) {
    armed = !!v;
    painted();
    return save().then(function () { return describe(); });
  }
  function setLevel(l) {
    l = low(l);
    if (l !== "semi" && l !== "full") return Promise.resolve("USAGE: /duty semi|full - SEMI IS PARTIAL AUTOMATION (CHECK-IN AND QUIET HOURS, NO WIDE DOOR), FULL IS ALL OF IT.");
    level = l;
    armed = true;
    painted();
    return save().then(function () { return describe(); });
  }
  function words(arg) {
    var toks = low(arg).split(/\s+/).filter(Boolean);
    if (!toks.length) return Promise.resolve(describe());
    var wantArm = null, wantLevel = null;
    toks.forEach(function (t) {
      if (t === "on" || t === "arm" || t === "armed" || t === "enable") wantArm = true;
      else if (t === "off" || t === "disarm" || t === "safe" || t === "disable" || t === "standdown" || t === "stand-down") wantArm = false;
      else if (t === "semi" || t === "partial" || t === "half") wantLevel = "semi";
      else if (t === "full" || t === "auto" || t === "all") wantLevel = "full";
    });
    if (wantArm === null && wantLevel === null) {
      return Promise.resolve("USAGE: /duty \u00b7 /duty on|off \u00b7 /duty semi|full \u00b7 /duty arm semi|full\n" + describe());
    }
    if (wantLevel) level = wantLevel;
    if (wantArm !== null) armed = wantArm;
    else if (wantLevel) armed = true;
    painted();
    return save().then(function () { return describe(); });
  }
  return {
    mode: mode,
    armed: function () { return armed; },
    level: function () { return level; },
    allow: allow,
    arm: arm,
    setLevel: setLevel,
    words: words,
    describe: describe,
    block: block,
    laneLine: laneLine,
    save: save,
    load: load,
    state: function () { return { armed: armed, level: level, mode: mode() }; }
  };
}
return { client: client };
})();
