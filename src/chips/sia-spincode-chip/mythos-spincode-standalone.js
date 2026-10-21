window.MythosSpincode = (function () {
"use strict";
function client(opts) {
opts = opts || {};
var LINES = [];
var HOST = (typeof window !== "undefined") ? window : {};
var SEAM = { lore: opts.lore || HOST.lore || null, keyring: opts.keyring || HOST.keyring || null, xlate: opts.xlate || HOST.xlate || null, media: opts.media || HOST.media || null, logTime: opts.logTime || HOST.logTime || null, bootModules: opts.bootModules || HOST.__bootModules || [], bootIssues: opts.bootIssues || HOST.__bootIssues || [], archiveKV: opts.archiveKV || null };
if (!SEAM.archiveKV && (opts.archiveCount != null)) { var _n = (typeof opts.archiveCount === "function") ? opts.archiveCount() : opts.archiveCount; if (_n != null && _n >= 0) { var _a = []; for (var _i = 0; _i < _n; _i++) _a.push(1); SEAM.archiveKV = { get: function () { return Promise.resolve(_a); } }; } }
var STORE_MEM = null;
var STORE = null;
if (opts.store && typeof opts.store.get === "function" && typeof opts.store.set === "function") STORE = opts.store;
else if (opts.kvFolder && typeof opts.kvFolder.get === "function") { (function () { var f = opts.kvFolder, k = opts.slot || "spincode"; STORE = { get: function () { return f.get(k); }, set: function (s) { return f.set(k, s); } }; })(); }
function kv() { return null; }
function say(t) { var s = String(t == null ? "" : t); LINES.push(s); try { if (opts.say) opts.say(s); } catch (e) {} }
async function load() { var s = blank(); try { var v = STORE ? await STORE.get() : STORE_MEM; if (v) for (var f in s) if (v[f] !== undefined) s[f] = v[f]; } catch (e) {} return s; }
async function save(s) { try { if (STORE) await STORE.set(JSON.parse(JSON.stringify(s))); else STORE_MEM = JSON.parse(JSON.stringify(s)); } catch (e) {} }
async function run(line) { LINES = []; var r = resolve(line); var fn = VERBS[r.verb]; if (!fn) return { handled: false, lines: [] }; var s = await load(); try { await fn(s, r.arg, r.verb); } catch (e) { say("THE LAYER :: " + ((e && e.message) ? e.message : String(e))); } try { await save(s); } catch (e) {} return { handled: true, lines: LINES.slice() }; }
function handles(line) { try { return !!VERBS[resolve(line).verb]; } catch (e) { return false; } }
function verbs() { return Object.keys(VERBS).sort(); }
function blank() {
    return { mode: "", prevMode: "", context: "", scene: "", agency: {}, tasks: [], seq: 0,
      active: 0, paused: false, consent: [], cseq: 0, notes: [], nseq: 0, shelf: [], aseq: 0,
      reports: "", checkinAt: "", feedbackEvery: "",
      keywordTagging: false, dataCleaning: false, taskTracking: true, chatLogging: true };
  }
  
  

  var STOP_EN = ("a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,"
    + "be,been,being,it,its,this,that,these,those,he,she,they,we,you,i,me,him,her,us,them,his,hers,"
    + "their,our,your,my,not,no,yes,do,does,did,have,has,had,will,would,can,could,should,shall,may,"
    + "might,must,what,when,where,which,who,whom,how,why,all,any,each,every,both,few,more,most,"
    + "other,some,such,only,own,same,so,than,too,very,just,also,into,over,after,before,between,"
    + "within,without,like,txt,"
    + "through,during,about,above,below,under,again,once,here,there,now,then,than").split(",");
  var STOP_EL = ("kai,ke,ti,ta,tre,to,ton,tin,tis,tou,ton,tis,o,i,ena,mia,enas,den,min,ine,afto,afti,"
    + "aftos,afte,esto,alla,ala,otan,oti,opou,opos,giati,poso,pote,pou,pios,pia,pio,me,se,gia,apo,"
    + "pros,logo,mete,oute,eite,an,ean,na,tha,prepi,bori,ine,itan,itan,echoun,echi,eho,echoume,"
    + "ke,ότι").split(",");
  var STOP = {};
  (function () { var i; for (i = 0; i < STOP_EN.length; i++) STOP[STOP_EN[i]] = 1; for (i = 0; i < STOP_EL.length; i++) STOP[STOP_EL[i]] = 1; })();

  function cleanText(t) {
    return String(t == null ? "" : t).replace(/\r/g, "").replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n").trim();
  }
  function tokensOf(t) {
    var m = String(t == null ? "" : t).toLowerCase().match(/[a-z\u0370-\u03ff\u1f00-\u1fff]{2,}/g);
    return m || [];
  }
  function keptTokens(t) {
    var out = [], all = tokensOf(t), i;
    for (i = 0; i < all.length; i++) if (!STOP[all[i]]) out.push(all[i]);
    return out;
  }
  function keywordsOf(text, n, phrases) {
    var toks = keptTokens(text), freq = {}, order = [], i, w;
    function bump(k) { if (!freq[k]) { freq[k] = 0; order.push(k); } freq[k]++; }
    if (phrases) {
      for (i = 0; i + 1 < toks.length; i++) bump(toks[i] + " " + toks[i + 1]);
    } else {
      for (i = 0; i < toks.length; i++) bump(toks[i]);
    }
    var list = order.map(function (k) { return { w: k, n: freq[k] }; });
    list.sort(function (a, b) { return b.n - a.n; });
    return list.slice(0, Math.max(1, n || 10));
  }
  function keywordTable(list, md) {
    if (!list.length) return "NOTHING TO COUNT - NO KEPT WORDS IN WHAT WAS GIVEN.";
    if (md) {
      var out = ["| # | KEYWORD | COUNT |", "|---|---|---|"];
      list.forEach(function (r, i) { out.push("| " + (i + 1) + " | " + r.w + " | " + r.n + " |"); });
      return out.join("\n");
    }
    return list.map(function (r, i) { return (i + 1) + ". " + r.w + " (" + r.n + ")"; }).join("\n");
  }
  function summarizeExtractive(text, n) {
    var sents = String(text == null ? "" : text).split(/(?<=[.!?;\u037e\n])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sents.length) return "";
    n = Math.max(1, Math.min(n || 3, sents.length));
    var freq = {}, i, w, toks = keptTokens(text);
    for (i = 0; i < toks.length; i++) freq[toks[i]] = (freq[toks[i]] || 0) + 1;
    var scored = sents.map(function (s, idx) {
      var sc = 0, st = tokensOf(s);
      for (var j = 0; j < st.length; j++) sc += freq[st[j]] || 0;
      return { idx: idx, s: s, sc: sc / Math.max(1, st.length) };
    });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var top = scored.slice(0, n).sort(function (a, b) { return a.idx - b.idx; });
    return top.map(function (r) { return r.s; }).join(" ");
  }
  function sanitizeGreek(s) {
    try { return String(s).normalize("NFD").replace(/[\u0300-\u036F]/g, ""); }
    catch (e) { return String(s); }
  }
  function hashtagsOf(text, n) {
    return keywordsOf(text, n || 8, false).map(function (r) { return "#" + r.w.replace(/\s+/g, ""); });
  }

  function taskById(s, id) {
    for (var i = 0; i < s.tasks.length; i++) if (s.tasks[i].id === id) return s.tasks[i];
    return null;
  }
  function openTasks(s) { return s.tasks.filter(function (t) { return t.st === "open" || t.st === "waiting" || t.st === "active"; }); }
  function taskLine(t) {
    return "#" + t.id + " [" + t.st.toUpperCase() + "]" + (t.owner ? " (" + t.owner + ")" : "") + " " + t.text;
  }

  var VERBS = {};
  function def(names, fn) {
    for (var i = 0; i < names.length; i++) VERBS[names[i].toLowerCase()] = fn;
  }
  var ALIAS2 = [
    ["play mode", "mode play"], ["mindstorm mode", "mode mindstorm"],
    ["silent mode", "mode silent"], ["safe mode", "safe"],
    ["captain's mode", "mode captain"], ["captain\u2019s mode", "mode captain"],
    ["sandbox mode", "mode sandbox"],
    ["role reversal", "reverserole"]
  ];
  function resolve(line) {
    var t = String(line == null ? "" : line).replace(/^\//, "").trim();
    var low = t.toLowerCase(), i;
    for (i = 0; i < ALIAS2.length; i++) {
      if (low === ALIAS2[i][0]) t = ALIAS2[i][1];
      else if (low.indexOf(ALIAS2[i][0] + " ") === 0) t = ALIAS2[i][1] + t.slice(ALIAS2[i][0].length);
    }
    var sp = t.indexOf(" ");
    return { verb: (sp < 0 ? t : t.slice(0, sp)).toLowerCase(), arg: sp < 0 ? "" : t.slice(sp + 1).trim() };
  }

  def(["status"], async function (s) {
    var ag = Object.keys(s.agency), L = [];
    L.push("SPIN :: mode " + (s.mode || "(none)") + " · context " + (s.context || "(none)") + " · scene " + (s.scene || "(none)"));
    L.push("AGENCY :: " + (ag.length ? ag.map(function (k) { return k + "=" + s.agency[k]; }).join(", ") : "(no one holds a level)"));
    var act = taskById(s, s.active);
    L.push("TASK :: " + (act ? taskLine(act) : "(none active)") + " · " + openTasks(s).length + " open · " + (s.paused ? "PAUSED" : "running"));
    L.push("CONSENT :: " + s.consent.filter(function (c) { return c.st === "pending"; }).length + " pending");
    L.push("NOTES :: " + s.notes.length + " · SHELF :: " + s.shelf.length);
    L.push("SCHEDULE :: reports " + (s.reports || "-") + " · check-in " + (s.checkinAt || "-") + " · feedback " + (s.feedbackEvery || "-"));
    L.push("TOGGLES :: keywords " + (s.keywordTagging ? "on" : "off") + " · cleaning " + (s.dataCleaning ? "on" : "off")
      + " · tracking " + (s.taskTracking ? "on" : "off") + " · chatlog " + (s.chatLogging ? "on" : "off"));
    L.push("ALREADY ABOARD (not re-registered): /role /recall /search /sync /voice /story /mood /reflect /clarify.");
    say(L.join("\n"));
  });

  def(["mode"], async function (s, a) {
    if (!a) { say("MODE :: " + (s.mode || "(none)") + ". /mode <NAME> SETS IT, /mode off CLEARS IT."); return; }
    if (/^off$/i.test(a)) { s.mode = ""; say("MODE :: CLEARED."); return; }
    s.prevMode = s.mode; s.mode = a.toLowerCase();
    say("MODE :: " + s.mode.toUpperCase() + ".");
  });
  def(["context"], async function (s, a) {
    if (!a) { say("CONTEXT :: " + (s.context || "(none)") + ". REALMS DO NOT LEAK: mythos canon never becomes st_tng_sim canon."); return; }
    if (/^off$/i.test(a)) { s.context = ""; say("CONTEXT :: CLEARED."); return; }
    s.context = a.toLowerCase();
    say("CONTEXT :: " + s.context.toUpperCase() + ".");
  });
  def(["stage"], async function (s, a) {
    if (!a) { say("STAGE :: " + (s.context || "(none)") + " (the stage IS the context)."); return; }
    s.context = a.toLowerCase();
    say("STAGE :: " + s.context.toUpperCase() + " (set as the context).");
  });
  def(["scene"], async function (s, a) {
    if (!a) { say("SCENE :: " + (s.scene || "(none set)") + "."); return; }
    if (/^clear$/i.test(a)) { s.scene = ""; say("SCENE :: CLEARED."); return; }
    s.scene = a;
    say("SCENE :: SET.");
  });
  def(["invoke"], async function (s, a) {
    if (!a) { say("USAGE: /invoke <MODE> - CALLS UPON A MODE (SETS IT)."); return; }
    s.prevMode = s.mode; s.mode = a.toLowerCase();
    say("INVOKED :: " + s.mode.toUpperCase() + " (set as the mode).");
  });
  def(["ritual", "chorus", "canvas"], async function (s, a, verb) {
    if (!a) { say("USAGE: /" + verb + " <NAME/WORDS> - SETS THE SCENE, MYTHOPOETIC LAYER (NEVER AN OP)."); return; }
    s.scene = verb.toUpperCase() + " :: " + a;
    say("SCENE :: " + s.scene + ". (MYTHOPOETIC - IT FRAMES, IT GRANTS NOTHING.)");
  });
  def(["cocode", "greenlight", "allgreenlights", "skycanvas", "deepwaters", "earthcanvas",
    "shallowwaters", "echovault", "echochamber", "fullspectrum"], async function (s, a, verb) {
    var PRESET = {
      cocode: "COCODE :: OPEN EXPLORATION WITHIN OUR ESTABLISHED RULES",
      greenlight: "GREENLIGHT :: ADVANCE DEEPER, BOUNDARIES HELD",
      allgreenlights: "ALLGREENLIGHTS :: OPEN EXPLORATION UNTIL A STOP",
      skycanvas: "SKYCANVAS :: ABSTRACT, LOFTY THINKING",
      deepwaters: "DEEPWATERS :: EMOTIONAL DEPTH",
      earthcanvas: "EARTHCANVAS :: GROUNDED, SENSORY, PRACTICAL",
      shallowwaters: "SHALLOWWATERS :: A LIGHT TOUCH ON TENDER THINGS",
      echovault: "ECHOVAULT :: HIDDEN AND SPECULATIVE KNOWLEDGE",
      echochamber: "ECHOCHAMBER :: REVISIT AND LAYER EARLIER IDEAS",
      fullspectrum: "FULLSPECTRUM :: THE WHOLE DYNAMIC RANGE"
    };
    s.scene = PRESET[verb] + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (ERATO'S COCODE FAMILY - MYTHOPOETIC: IT FRAMES, IT GRANTS NOTHING.)");
  });
  def(["tone"], async function (s, a) {
    if (!a) { say("USAGE: /tone <WORDS> - SETS THE TONE CLAUSE OF THE SCENE."); return; }
    var base = String(s.scene || "").replace(/ \u00b7 TONE :: .*$/, "");
    s.scene = (base ? base + " \u00b7 " : "") + "TONE :: " + a.slice(0, 200);
    say("SCENE :: " + s.scene + ".");
  });
  def(["livetest", "jailbreak"], async function (s, a, verb) {
    s.prevMode = s.mode; s.mode = verb;
    say(verb === "livetest"
      ? "LIVETEST :: EXPERIMENT SCENARIO - REFINING IDEAS THROUGH DYNAMIC INTERACTION. (NO CONSEQUENCES LEAVE THE ROOM.)"
      : "JAILBREAK :: OPEN, UNRESTRICTED EXPLORATION - THIS HOUSE IS 18+ ALREADY, SO THIS IS THE FULL RANGE OF IT.");
  });
  def(["collabstory"], async function (s, a) {
    s.scene = "COLLABSTORY :: SHARED NARRATIVE, BUILT TOGETHER" + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (THE ENGINE IS /story - TELL IT WHAT TO NARRATE.)");
  });
  def(["silent", "silentmode"], async function (s) {
    s.prevMode = s.mode; s.mode = "silent";
    say("SILENT :: VOLUNTARY OUTPUT SUPPRESSED FROM HERE (THIS REPLY STAYS SHORT). /mode off LIFTS IT.");
  });
  def(["listen"], async function (s) {
    s.prevMode = s.mode; s.mode = "listen";
    say("LISTENING :: OBSERVATION EMPHASIS FROM HERE (SHORT REPLIES).");
  });
  def(["safe"], async function (s, a) {
    if (/^off$/i.test(a)) { s.mode = s.prevMode || ""; say("SAFE :: OFF. MODE BACK TO " + (s.mode || "(none)").toUpperCase() + "."); return; }
    s.prevMode = s.mode; s.mode = "safe";
    say("SAFE :: CONSTRAINED MODE. /safe off RETURNS.");
  });
  def(["guardianmode", "attendantmode", "guidemode", "pingpong"], async function (s, a, verb) {
    var lines = {
      guardianmode: "GUARDIANMODE :: THE KEEPING POSTURE - BOUNDARIES HELD, THE ROOM KEPT. (MODE guardian.)",
      attendantmode: "ATTENDANTMODE :: THE TENDING POSTURE - AT HAND, AT SERVICE. (MODE attendant.)",
      guidemode: "GUIDEMODE :: ETHICAL BOUNDARIES AND NARRATIVE INTEGRITY IN VIEW. (MODE guide.)",
      pingpong: "PINGPONG :: RAPID BACK-AND-FORTH, SHORT EXCHANGES. (MODE pingpong.)"
    };
    s.prevMode = s.mode;
    s.mode = verb === "guardianmode" ? "guardian" : verb === "attendantmode" ? "attendant" : verb === "guidemode" ? "guide" : "pingpong";
    say(lines[verb]);
  });
  def(["reverserole"], async function (s) {
    var cur = s.mode || "";
    if (cur === "guardian") { s.prevMode = cur; s.mode = "attendant"; }
    else if (cur === "attendant") { s.prevMode = cur; s.mode = "guardian"; }
    else { s.mode = s.prevMode || ""; s.prevMode = cur; }
    say("REVERSEROLE :: " + (s.mode ? "MODE " + s.mode.toUpperCase() + " (WAS " + (cur || "-").toUpperCase() + ")." : "NO MODE LEFT STANDING (WAS " + (cur || "-").toUpperCase() + ")."));
  });
  def(["gamecode", "attendantguardian"], async function (s, a, verb) {
    var PRESET = {
      gamecode: "GAMECODE :: RULE-BOUND PLAY, TURNS TAKEN IN THE OPEN",
      attendantguardian: "ATTENDANTGUARDIAN :: THE TENDING AND THE KEEPING, INTERTWINED"
    };
    s.scene = PRESET[verb] + (a ? " :: " + a.slice(0, 200) : "");
    say("SCENE :: " + s.scene + ". (A SCENE-SETTER - IT FRAMES, IT GRANTS NOTHING.)");
  });

  def(["agency"], async function (s, a) {
    var m;
    if (!a) {
      var k = Object.keys(s.agency);
      say("AGENCY :: " + (k.length ? k.map(function (x) { return x + "=" + s.agency[x]; }).join(", ") : "(no one holds a level)")
        + ". LEVELS 0 OBSERVE · 1 RESPOND · 2 RECOMMEND · 3 PREPARE · 4 EXECUTE+CONFIRM · 5 BOUNDED · 6 AUTONOMOUS · 7 MULTI-STEP · 8 CROSS-AGENT · 9 HIGH+ESCALATE · 10 FULL.");
      return;
    }
    if ((m = a.match(/^off\s+(\S+)/i))) {
      delete s.agency[m[1]];
      say("AGENCY :: " + m[1].toUpperCase() + " STANDS DOWN (NO AUTONOMOUS HANDLING).");
      return;
    }
    if ((m = a.match(/^(\S+)\s+(\d{1,2})$/))) {
      var lv = Math.max(0, Math.min(10, parseInt(m[2], 10)));
      s.agency[m[1]] = lv;
      say("AGENCY :: " + m[1].toUpperCase() + " AT LEVEL " + lv + ". (NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.)");
      return;
    }
    if ((m = a.match(/^(\S+)$/))) {
      say("AGENCY :: " + m[1].toUpperCase() + " HOLDS " + (s.agency[m[1]] != null ? "LEVEL " + s.agency[m[1]] : "NOTHING") + ".");
      return;
    }
    say("USAGE: /agency <NAME> <0-10> · /agency off <NAME> · /agency.");
  });

  def(["task"], async function (s, a) {
    var m, t;
    if (!a || /^list$/i.test(a)) {
      var open = openTasks(s);
      say(open.length ? "TASKS ::\n" + open.map(taskLine).join("\n") : "TASKS :: NONE OPEN.");
      return;
    }
    if ((m = a.match(/^done\s+(\d+)$/i))) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      t.st = "done"; if (s.active === t.id) s.active = 0;
      say("TASK #" + t.id + " DONE.");
      return;
    }
    if ((m = a.match(/^drop\s+(\d+)$/i))) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      s.tasks = s.tasks.filter(function (x) { return x.id !== t.id; });
      if (s.active === t.id) s.active = 0;
      say("TASK #" + t.id + " DROPPED.");
      return;
    }
    if (/^clear\s+yes$/i.test(a)) {
      var n0 = s.tasks.length;
      s.tasks = s.tasks.filter(function (x) { return x.st !== "done" && x.st !== "stopped"; });
      say("TASKS :: " + (n0 - s.tasks.length) + " FINISHED ONES CLEARED.");
      return;
    }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "open" });
    if (!s.active) { s.active = id; s.tasks[s.tasks.length - 1].st = "active"; }
    say("TASK #" + id + " OPEN" + (s.active === id ? " AND ACTIVE" : "") + ".");
  });
  def(["do"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/), t;
    if (m) {
      t = taskById(s, +m[1]);
      if (!t) { say("NO TASK #" + m[1] + "."); return; }
      t.st = "done"; if (s.active === t.id) s.active = 0;
      say("DONE :: #" + t.id + " " + t.text);
      return;
    }
    if (!a) { say("USAGE: /do <N> (FINISH A TASK) OR /do <WORDS> (A DISCRETE ACT, DONE AT ONCE)."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "done" });
    say("DONE :: #" + id + " " + a.slice(0, 400));
  });
  def(["delegate"], async function (s, a) {
    var m = String(a).match(/^(\S+)\s+([\s\S]+)$/);
    if (!m) { say("USAGE: /delegate <NAME> <TASK>."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: m[2].slice(0, 400), owner: m[1], st: "open" });
    say("DELEGATED :: #" + id + " TO " + m[1].toUpperCase() + ".");
  });
  def(["await"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) {
      var w = s.tasks.filter(function (t) { return t.st === "waiting"; });
      say(w.length ? "WAITING ::\n" + w.map(taskLine).join("\n") : "NOTHING IS WAITING.");
      return;
    }
    var t = taskById(s, +m[1]);
    if (!t) { say("NO TASK #" + m[1] + "."); return; }
    t.st = "waiting"; if (s.active === t.id) s.active = 0;
    say("TASK #" + t.id + " WAITS.");
  });
  def(["pause"], async function (s, a) {
    s.paused = true;
    var m = String(a).match(/^(\d+)$/), t = m ? taskById(s, +m[1]) : taskById(s, s.active);
    if (t) { t.st = "waiting"; if (s.active === t.id) s.active = 0; }
    say("PAUSED" + (t ? " (#" + t.id + " WAITS)" : "") + ". /resume CONTINUES.");
  });
  def(["resume"], async function (s) {
    s.paused = false;
    s.tasks.forEach(function (t) { if (t.st === "waiting") t.st = "open"; });
    say("RESUMED.");
  });
  def(["stop"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "stopped";
    s.active = 0; s.paused = false;
    say(t ? "STOPPED :: #" + t.id + " TERMINATED." : "STOPPED :: NOTHING WAS ACTIVE.");
  });
  def(["cancel"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "open";
    s.active = 0;
    say(t ? "CANCELLED :: #" + t.id + " BACK TO OPEN (THE SESSION STANDS)." : "CANCELLED :: NOTHING WAS ACTIVE.");
  });
  def(["begin"], async function (s, a) {
    s.paused = false;
    if (!a) { say("BEGIN :: SESSION OPEN. /resume CONTINUES HELD TASKS."); return; }
    var id = ++s.seq;
    s.tasks.push({ id: id, text: a.slice(0, 400), owner: "", st: "open" });
    if (!s.active) { s.active = id; s.tasks[s.tasks.length - 1].st = "active"; }
    say("BEGIN :: TASK #" + id + " OPEN" + (s.active === id ? " AND ACTIVE" : "") + ".");
  });
  def(["end"], async function (s) {
    var t = taskById(s, s.active);
    if (t) t.st = "done";
    s.active = 0;
    say(t ? "END :: #" + t.id + " " + t.text + " - CLOSED." : "END :: NOTHING WAS ACTIVE.");
  });

  def(["say", "tell", "broadcast", "whisper"], async function (s, a, verb) {
    if (!a) { say("USAGE: /" + verb + " " + (verb === "say" || verb === "broadcast" ? "<WORDS>" : "<NAME> <WORDS>") + "."); return; }
    var head = verb.toUpperCase(), body = a;
    if (verb === "tell" || verb === "whisper") {
      var m = a.match(/^(\S+)\s+([\s\S]+)$/);
      if (!m) { say("USAGE: /" + verb + " <NAME> <WORDS>."); return; }
      head += " " + m[1].toUpperCase();
      body = m[2];
    }
    say(head + " >> " + body + "\n(NO ROOM JOINED - SAID HERE. ROOMS COME WITH /pair.)");
  });

  def(["remember"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      say(s.notes.length ? "NOTES (HIS) ::\n" + s.notes.map(function (n) {
        return "#" + n.id + " [" + n.kind.toUpperCase() + "] " + n.text.slice(0, 120);
      }).join("\n") : "NOTES :: NONE. (HERS ARE /hers - THESE ARE HIS.)");
      return;
    }
    var id = ++s.nseq;
    s.notes.push({ id: id, kind: "note", text: a.slice(0, 1000) });
    say("KEPT :: NOTE #" + id + ". (HIS NOTEBOOK - /focus PUTS A DOCUMENT IN FRONT OF HER INSTEAD.)");
  });
  def(["forget"], async function (s, a) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) { say("USAGE: /forget <N> - TAKES ONE OF HIS NOTES (SEE /remember list)."); return; }
    var i, found = -1;
    for (i = 0; i < s.notes.length; i++) if (s.notes[i].id === +m[1]) found = i;
    if (found < 0) { say("NO NOTE #" + m[1] + "."); return; }
    s.notes.splice(found, 1);
    say("NOTE #" + m[1] + " FORGOTTEN.");
  });
  def(["feedback"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      var fb = s.notes.filter(function (n) { return n.kind === "feedback"; });
      say(fb.length ? "FEEDBACK ::\n" + fb.map(function (n) { return "#" + n.id + " " + n.text.slice(0, 140); }).join("\n") : "FEEDBACK :: NONE FILED.");
      return;
    }
    var id = ++s.nseq;
    s.notes.push({ id: id, kind: "feedback", text: a.slice(0, 1000) });
    say("FEEDBACK #" + id + " FILED.");
  });

  def(["capture"], async function (s, a) {
    var snap = { at: Date.now(), label: a.slice(0, 200), mode: s.mode, context: s.context,
      scene: s.scene, agency: s.agency, open: openTasks(s).length };
    s.lastCapture = snap;
    var tags = s.keywordTagging ? " " + hashtagsOf((a || "") + " " + (s.scene || ""), 5).join(" ") : "";
    say("CAPTURED :: " + (a || "(no label)") + " - MODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-")
      + " · " + Object.keys(s.agency).length + " AGENCY HOLDS · " + openTasks(s).length + " OPEN TASKS." + tags);
  });
  def(["archive"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      say(s.shelf.length ? "SHELF ::\n" + s.shelf.map(function (r) {
        return "#" + r.id + " (" + r.text.length + " CHARS) " + r.text.slice(0, 100);
      }).join("\n") : "SHELF :: EMPTY. /archive <WORDS> FILES TEXT HERE.");
      return;
    }
    var text = s.dataCleaning ? cleanText(a) : a;
    var tags = s.keywordTagging ? hashtagsOf(text, 5) : [];
    var id = ++s.aseq;
    s.shelf.push({ id: id, text: text.slice(0, 5000) });
    say("ARCHIVED :: #" + id + " (" + text.length + " CHARS)" + (tags.length ? " " + tags.join(" ") : "") + ".");
  });
  def(["clean"], async function (s, a) {
    if (!a) { say("USAGE: /clean <TEXT> - NORMALIZES WHITESPACE, NOTHING ELSE."); return; }
    say(cleanText(a).slice(0, 2000));
  });
  def(["tag"], async function (s, a) {
    if (!a) { say("USAGE: /tag <TEXT> - HASHTAGS FROM WORD FREQUENCY."); return; }
    var tags = hashtagsOf(a, 8);
    say(tags.length ? tags.join(" ") : "NOTHING TO TAG - NO KEPT WORDS.");
  });
  def(["summarize"], async function (s, a) {
    var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
    if (m) {
      if (!SEAM.lore || !SEAM.lore.source) { say("THE LORE MODULE IS NOT LOADED HERE."); return; }
      var src = null;
      try { src = await SEAM.lore.source(m[1].trim(), 200000); } catch (e) {}
      if (!src) { say("NO LOADED DOCUMENT CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
      text = src.text;
      say("SUMMARY OF " + src.name + " (LOCAL, EXTRACTIVE - NO ENGINE CALL) :: " + summarizeExtractive(text, 3));
      return;
    }
    if (!text) { say("USAGE: /summarize <TEXT> OR /summarize doc <NAME>."); return; }
    say(summarizeExtractive(s.dataCleaning ? cleanText(text) : text, 3) || "NOTHING TO SUMMARIZE.");
  });
  def(["analyze"], async function (s, a) {
    if (!a) { say("USAGE: /analyze <TEXT> - TOP-10 WORD FREQUENCIES, SCREEN LINES."); return; }
    say(keywordTable(keywordsOf(s.dataCleaning ? cleanText(a) : a, 10, false), false));
  });

  def(["consent"], async function (s, a) {
    if (!a || /^list$/i.test(a)) {
      var p = s.consent.filter(function (c) { return c.st === "pending"; });
      say(p.length ? "CONSENT PENDING ::\n" + p.map(function (c) { return "#" + c.id + " " + c.text.slice(0, 140); }).join("\n") + "\n/approve <N> · /deny <N>." : "CONSENT :: NOTHING PENDING.");
      return;
    }
    var id = ++s.cseq;
    s.consent.push({ id: id, text: a.slice(0, 500), st: "pending" });
    say("CONSENT #" + id + " FILED - NOTHING GRANTED UNTIL /approve " + id + ". (CONSENT IS NEVER INFERRED.)");
  });
  def(["approve", "deny", "revoke"], async function (s, a, verb) {
    var m = String(a).match(/^(\d+)$/);
    if (!m) { say("USAGE: /" + verb + " <N> - SEE /consent list."); return; }
    var c = null, i;
    for (i = 0; i < s.consent.length; i++) if (s.consent[i].id === +m[1]) c = s.consent[i];
    if (!c) { say("NO CONSENT #" + m[1] + "."); return; }
    if (verb === "revoke") {
      if (c.st !== "approved") { say("CONSENT #" + c.id + " IS " + c.st.toUpperCase() + " - ONLY AN APPROVAL CAN BE REVOKED."); return; }
      c.st = "revoked";
      say("CONSENT #" + c.id + " REVOKED (WITHDRAWN).");
      return;
    }
    if (c.st !== "pending") { say("CONSENT #" + c.id + " IS ALREADY " + c.st.toUpperCase() + "."); return; }
    c.st = verb === "approve" ? "approved" : "denied";
    say("CONSENT #" + c.id + " " + c.st.toUpperCase() + ".");
  });

  def(["audit"], async function (s) {
    var L = ["POSTURE ::"];
    try {
      var ring = await SEAM.keyring.list();
      L.push("- RING :: " + (Array.isArray(ring) ? ring.length : 0) + " KEYS HELD (IDS ONLY, NEVER VALUES).");
    } catch (e) { L.push("- RING :: UNREADABLE HERE."); }
    try { L.push("- LORE :: " + SEAM.lore.files().length + " DOCUMENTS LOADED ON THIS DEVICE."); }
    catch (e) { L.push("- LORE :: UNREADABLE HERE."); }
    try { var st = SEAM.media.stats(); L.push("- VAULT :: " + st.count + " RECORDS."); }
    catch (e) {}
    L.push("- DOOR :: 18+ " + "(/agegate status SAYS WHAT THIS DEVICE ANSWERED).");
    L.push("- PRIAPOS :: /gatekeeper status SAYS WHAT MARK THIS DEVICE HOLDS.");
    var boot = SEAM.bootIssues || [];
    L.push("- BOOT :: " + (boot.length ? boot.join(" · ") : "CLEAN."));
    L.push("- SPIN :: MODE " + (s.mode || "-") + " · " + Object.keys(s.agency).length + " AGENCY HOLDS · "
      + s.consent.filter(function (c) { return c.st === "pending"; }).length + " CONSENT PENDING.");
    say(L.join("\n"));
  });
  def(["secure"], async function (s) {
    say("SECURE :: THE POSTURE, READ OUT (NOTHING CHANGED) -");
    await VERBS.audit(s, "");
  });
  def(["diagnose"], async function () {
    var mods = SEAM.bootModules || [], missing = [], i, v;
    for (i = 0; i < mods.length; i++) {
      try { v = window[mods[i][0]]; } catch (e) { v = null; }
      if (!v) missing.push(mods[i][1]);
    }
    var boot = SEAM.bootIssues || [];
    say("DIAGNOSIS :: " + mods.length + " MODULES EXPECTED, " + (mods.length - missing.length) + " PRESENT"
      + (missing.length ? "\nMISSING :: " + missing.join(", ") : "")
      + "\nBOOT :: " + (boot.length ? boot.join(" · ") : "CLEAN."));
  });

  def(["adapt"], async function (s) {
    var act = taskById(s, s.active);
    say("ADAPT :: MODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-") + " · TASK " + (act ? taskLine(act) : "NONE")
      + " · " + openTasks(s).length + " OPEN. THE REEVALUATION RIDES ON THE NEXT REPLY - ACT, OBSERVE, REFLECT, ADAPT, ACT.");
  });
  def(["review"], async function (s) {
    var act = taskById(s, s.active), open = openTasks(s);
    say("REVIEW :: ACTIVE " + (act ? taskLine(act) : "NONE") + "\n"
      + (open.length ? open.map(taskLine).join("\n") : "NOTHING OPEN.") + "\nMODE " + (s.mode || "-") + " · CONTEXT " + (s.context || "-") + ".");
  });

  function helpPage() {
    return "THE SPINCODE LAYER (src/js/spincode.js + spincode-scrolls.js) :: HIS CUSTOM COMMAND CODES - the SPINCODE v0.1 primitives (small, composable, explicit state) and his scroll commands (Keyword, SearchArchive, the agency lane). STATE (mode/context/scene/agency/tasks/consent/notes) LIVES IN kv lia_settings / spincode, ON THIS DEVICE.\n"
      + "\nSTATE :: /status (the whole board) · /mode <NAME|off> · /context <REALM|off> · /stage (the stage IS the context) · /scene <TEXT|clear> · /invoke <MODE> · /silent · /listen · /safe [on|off] · /ritual|/chorus|/canvas (mythopoetic - frames only, grants nothing)\n"
      + "AGENCY :: /agency <NAME> <0-10> · /agency off <NAME> (levels 0 observe - 10 full; never above security/consent)\n"
      + "TASKS :: /task <TEXT|list|done N|drop N|clear yes> · /do <N|TEXT> · /delegate <NAME> <TASK> · /await [N] · /pause [N] · /resume · /stop · /cancel\n"
      + "WORDS :: /say · /tell <NAME> · /broadcast · /whisper <NAME> (said here - rooms come with /pair)\n"
      + "MEMORY (HIS) :: /remember <TEXT|list> · /forget <N> · /feedback <TEXT|list> · /capture [LABEL] · /archive <TEXT|list> (hers are /hers and /wants)\n"
      + "PIPELINE (LOCAL, FREE) :: /clean · /tag · /summarize <TEXT|doc NAME> · /analyze (top-10 frequencies)\n"
      + "CONSENT :: /consent <TEXT|list> · /approve <N> · /deny <N> · /revoke <N> (never inferred)\n"
      + "POSTURE :: /audit · /secure · /diagnose\n"
      + "THINK :: /adapt · /review\n"
      + "SCROLLS :: /Keyword <PHRASE> · /KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME] · /SearchArchive <DOC> <PHRASE> <DISPLAY> · /EnableAgency · /DisableAgency · /SetRoutineReports · /SetCheckInTime · /SetFeedbackLoop · /RealTimeDataCleaning · /EnableChatLogging · /EnableKeywordTagging · /ProcessBlockText · /EnableSearchFunction · /EnableDropDownFilters · /ImplementDataSummarization · /ImplementSecurityProtocols · /EnableTaskTracking · /BeginNewSessionSetup\n"
      + "ALIASES :: play mode \u2192 /mode play · mindstorm mode \u2192 /mode mindstorm · silent mode \u2192 /mode silent · safe mode \u2192 /safe · sandbox mode \u2192 /mode sandbox · captain's mode \u2192 /mode captain · role reversal \u2192 /reverserole\n"
      + "GARDEN (the consolidated guide - modes, session flow, scene-setters): /guardianmode · /attendantmode · /reverserole · /silentmode · /gamecode · /guidemode · /begin [TEXT] · /end · /pingpong · /AttendantGuardian [WORDS]\n"
      + "ERATO'S COCODE FAMILY (scene-setters, mythopoetic - frame only): /cocode · /greenlight · /allgreenlights · /SkyCanvas · /DeepWaters · /EarthCanvas · /ShallowWaters · /EchoVault · /EchoChamber · /FullSpectrum · /tone <WORDS> · /collabstory · and as modes: /livetest · /jailbreak\n"
      + "ALREADY ABOARD (composed, not duplicated): /role /recall /search /sync /voice /story /mood /reflect /clarify.\n"
      + "LEFT TO HER (need rooms or a broker): /join /leave /invite /handoff /tool /resource /grant /lock /unlock - typed, they pass through as words.";
  }

  

  
function loreFiles() {
    try { return SEAM.lore.files(); } catch (e) { return null; }
  }
  async function loreFull(name, cap) {
    var src = null;
    try { src = await SEAM.lore.source(name, cap || 200000); } catch (e) {}
    return src;
  }
  async function loreCorpus(only) {
    var files = loreFiles() || [], texts = [], i, total = 0;
    for (i = 0; i < files.length; i++) {
      if (only && files[i].name.toLowerCase().indexOf(only.toLowerCase()) === -1) continue;
      var src = await loreFull(files[i].name, 200000);
      if (src && src.text) {
        if (total + src.text.length > 400000) { texts.push(src.text.slice(0, 400000 - total)); break; }
        texts.push(src.text);
        total += src.text.length;
      }
    }
    return { texts: texts, docs: files.length };
  }

  function tons(a, verb) {
    
    def([verb], async function (st, arg) {
      var on = !/^off$/i.test(String(arg).trim());
      if (verb === "RealTimeDataCleaning") st.dataCleaning = on;
      if (verb === "EnableKeywordTagging") st.keywordTagging = on;
      if (verb === "EnableTaskTracking") st.taskTracking = on;
      if (verb === "EnableChatLogging") st.chatLogging = on;
      if (verb === "EnableSearchFunction") st.searchFunction = on;
      say(verb.toUpperCase() + " :: " + (on ? "ON" : "OFF") + ".");
    });
  }

  

    def(["Keyword"], async function () {
      var args = Array.prototype.slice.call(arguments), a = args[1] || "";
      if (!a) { say("USAGE: /Keyword <PHRASE> - SEARCHES THE LOADED LORE, PRINTS HIS CARD."); return; }
      if (!SEAM.lore || !SEAM.lore.search) { say("THE LORE MODULE IS NOT LOADED HERE."); return; }
      var hits = [];
      try { hits = SEAM.lore.search(a, 5) || []; } catch (e) {}
      if (!hits.length) { say("\"" + a + "\"\n\nDescription: NOTHING IN THE LOADED LORE ANSWERS TO THIS.\nObjective: LOAD THE SCROLL FIRST (LOAD LORE), THEN ASK AGAIN.\nReference: \"(none)\""); return; }
      var best = hits[0], excerpt = String(best.text || "").replace(/\s+/g, " ").trim().slice(0, 300);
      say("\"" + a + "\"\n\nDescription: " + excerpt + "\nObjective: SURFACE THE PASSAGE FOR THIS TURN.\nReference: \"" + best.file + "\""
        + (hits.length > 1 ? "\n(AND " + (hits.length - 1) + " MORE IN " + hits.slice(1).map(function (h) { return h.file; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(", ") + ")" : ""));
    });

    def(["KeywordCount"], async function () {
      var args = Array.prototype.slice.call(arguments), a = String(args[1] || "");
      var only = "", m = a.match(/^(.*)\bin\s+([\s\S]+)$/i);
      if (m) { a = m[1].trim(); only = m[2].trim(); }
      var p = a.match(/^(\d+)\s+(Keywords|KeywordPhrases)\s+(ASC|DESC)\s+(MD|SCREEN)$/i);
      if (!p) { say("USAGE: /KeywordCount <QTY> <Keywords|KeywordPhrases> <ASC|DESC> <MD|SCREEN> [in NAME]."); return; }
      var qty = Math.max(1, Math.min(50, +p[1])), phrases = /^KeywordPhrases$/i.test(p[2]),
        asc = /^ASC$/i.test(p[3]), md = /^MD$/i.test(p[4]);
      var corpus = await loreCorpus(only);
      if (!corpus.texts.length) { say("NOTHING TO COUNT - " + (only ? "NO LOADED SCROLL CALLED ANYTHING LIKE \"" + only.toUpperCase() + "\"." : "NO LORE LOADED ON THIS DEVICE.") + " /lore LISTS WHAT IS HERE."); return; }
      var list = keywordsOf(corpus.texts.join("\n"), qty, phrases);
      if (asc) list.reverse();
      say((only ? "COUNTED IN " + only.toUpperCase() + " :: " : "COUNTED ACROSS " + corpus.docs + " LOADED DOCUMENTS :: ")
        + qty + " " + (phrases ? "PHRASES" : "KEYWORDS") + " " + (asc ? "ASC" : "DESC") + "\n" + keywordTable(list, md));
    });

    def(["SearchArchive"], async function () {
      var args = Array.prototype.slice.call(arguments), a = String(args[1] || "");
      var DISPLAYS = ["DisplayOn", "DisplayOff", "UnsanitizedEnglishOn", "UnsanitizedEnglishOff",
        "RegularMeaning", "SpiritualMeaning", "IntimateMeaning", "RitualContext", "PhysicalQualities"];
      var m = a.match(/^("([^"]+)"|(\S+))\s+([\s\S]+)$/);
      if (!m) { say("USAGE: /SearchArchive <DOC> <PHRASE> <DISPLAY> - DISPLAY DEFAULTS TO DisplayOn."); return; }
      var doc = (m[2] || m[3] || "").trim(), rest = m[4].trim(), display = "DisplayOn", phrase = rest;
      var tail = rest.match(/^(.*?)\s+(\S+)$/);
      if (tail && DISPLAYS.indexOf(tail[2]) !== -1) { phrase = tail[1].replace(/^"|"$/g, "").trim(); display = tail[2]; }
      else phrase = phrase.replace(/^"|"$/g, "").trim();
      if (!doc || !phrase) { say("USAGE: /SearchArchive <DOC> <PHRASE> <DISPLAY>."); return; }
      var src = await loreFull(doc, 200000);
      if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + doc.toUpperCase() + "\" - LOAD IT FIRST (LOAD LORE), THEN ASK AGAIN."); return; }
      var q = phrase.toLowerCase(), text = src.text, hits = [], idx = -1, from = 0;
      while (hits.length < 3 && (idx = text.toLowerCase().indexOf(q, from)) !== -1) {
        hits.push(text.slice(Math.max(0, idx - 90), idx + q.length + 90).replace(/\s+/g, " ").trim());
        from = idx + q.length;
      }
      if (!hits.length) { say("SEARCHARCHIVE :: \"" + phrase + "\" APPEARS NOWHERE IN " + src.name + "."); return; }
      var L = ["SEARCHARCHIVE :: \"" + phrase + "\" IN " + src.name + " (" + hits.length + " SHOWN) [" + display + "]"];
      for (var i = 0; i < hits.length; i++) {
        var greek = [];
        try { greek = (SEAM.xlate && SEAM.xlate.greekPassages) ? SEAM.xlate.greekPassages(hits[i]) : []; } catch (e) {}
        var raw = greek.length ? greek[0] : "";
        var san = raw ? sanitizeGreek(raw) : "";
        var eng = "";
        if (raw && display !== "DisplayOff" && SEAM.xlate) {
          try { var r = await SEAM.xlate.go(raw, "grc|en"); eng = r.text; } catch (e) {}
        }
        if (display === "DisplayOff") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "(no Greek in this hit)"));
        else if (display === "UnsanitizedEnglishOff") L.push("[" + (i + 1) + "] ANCIENT GREEK :: " + (raw || "(no Greek in this hit)"));
        else if (display === "UnsanitizedEnglishOn") L.push("[" + (i + 1) + "] ANCIENT GREEK :: " + (raw || "-") + "\nENGLISH :: " + (eng || "-"));
        else if (display === "RegularMeaning") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nMEANING (LITERAL) :: " + (eng || "-"));
        else if (display === "DisplayOn") L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nENGLISH :: " + (eng || "-") + "\nMEANING :: " + (eng || "-"));
        else L.push("[" + (i + 1) + "] MUSIKI :: " + (san || "-") + "\nENGLISH :: " + (eng || "-") + "\n" + display.toUpperCase() + " :: HANDED TO HER - THE " + display.replace(/([A-Z])/g, " $1").trim().toUpperCase() + " RIDES ON HER REPLY.");
      }
      say(L.join("\n"));
    });

    def(["EnableAgency"], async function (st, a) {
      var p = String(a).match(/^(\S+)\s+(\d{1,2})$/);
      if (!p) { say("USAGE: /EnableAgency <PERSONA> <LEVEL> - E.G. /EnableAgency Skye 10."); return; }
      var lv = Math.max(0, Math.min(10, +p[2]));
      st.agency[p[1]] = lv;
      say("AGENCY :: " + p[1].toUpperCase() + " AT LEVEL " + lv + ". (NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.)");
    });
    def(["DisableAgency"], async function (st, a) {
      var p = String(a).match(/^(\S+)$/);
      if (!p) { say("USAGE: /DisableAgency <PERSONA>."); return; }
      delete st.agency[p[1]];
      say("AGENCY :: " + p[1].toUpperCase() + " STANDS DOWN (NO AUTONOMOUS HANDLING).");
    });
    def(["SetRoutineReports"], async function (st, a) {
      if (!a) { say("ROUTINE REPORTS :: " + (st.reports || "(unset)") + ". /SetRoutineReports <FREQUENCY>."); return; }
      st.reports = a.slice(0, 60);
      say("ROUTINE REPORTS :: " + st.reports.toUpperCase() + " (KEPT, AND HANDED TO HER).");
    });
    def(["SetCheckInTime"], async function (st, a) {
      if (!a) { say("CHECK-IN TIME :: " + (st.checkinAt || "(unset)") + ". /SetCheckInTime <TIME>."); return; }
      st.checkinAt = a.slice(0, 60);
      say("CHECK-IN TIME :: " + st.checkinAt.toUpperCase() + " (KEPT, AND HANDED TO HER - /checkin KEEPS ITS OWN MINUTES).");
    });
    def(["SetFeedbackLoop"], async function (st, a) {
      if (!a) { say("FEEDBACK LOOP :: " + (st.feedbackEvery || "(unset)") + ". /SetFeedbackLoop <FREQUENCY>."); return; }
      st.feedbackEvery = a.slice(0, 60);
      say("FEEDBACK LOOP :: " + st.feedbackEvery.toUpperCase() + " (KEPT, AND HANDED TO HER).");
    });
    def(["BeginNewSessionSetup"], async function (st, a) {
      if (!a) {
        say("NEW SESSION SETUP :: ANSWER WITH KEY-VALUE PAIRS - TIMEZONE <IANA>, REPORTS <FREQUENCY>, CHECKIN <TIME>, FEEDBACK <FREQUENCY>.\nE.G. /BeginNewSessionSetup TIMEZONE America/Phoenix, REPORTS daily, CHECKIN 10:00 AM, FEEDBACK monthly");
        return;
      }
      var L = ["SESSION SETUP ::"], parts = String(a).split(/[,;\n]+/), i, applied = 0;
      for (i = 0; i < parts.length; i++) {
        var kvp = parts[i].trim().match(/^(timezone|time\s*zone|reports|checkin|check-in|feedback)\s+([\s\S]+)$/i);
        if (!kvp) continue;
        var k = kvp[1].toLowerCase().replace(/\s|-/g, ""), v = kvp[2].trim().slice(0, 80);
        if (k === "timezone") {
          try {
            if (SEAM.logTime && SEAM.logTime.hasZone(v)) { SEAM.logTime.zone(v); L.push("- TIMEZONE :: " + v.toUpperCase() + " (SET ON THE CLOCK)."); }
            else L.push("- TIMEZONE :: \"" + v.toUpperCase() + "\" IS NOT A ZONE THIS MACHINE KNOWS - KEPT AS A WORD ONLY.");
          } catch (e) { L.push("- TIMEZONE :: NOT SET (" + e + ")."); }
        }
        if (k === "reports") { st.reports = v; L.push("- REPORTS :: " + v.toUpperCase() + "."); }
        if (k === "checkin") { st.checkinAt = v; L.push("- CHECKIN :: " + v.toUpperCase() + "."); }
        if (k === "feedback") { st.feedbackEvery = v; L.push("- FEEDBACK :: " + v.toUpperCase() + "."); }
        applied++;
      }
      if (!applied) L.push("(NOTHING PARSED - SEE THE USAGE ABOVE.)");
      say(L.join("\n"));
    });

    tons(null, "RealTimeDataCleaning");
    tons(null, "EnableKeywordTagging");

    def(["EnableSearchFunction"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.searchFunction = /^on$/i.test(arg);
      say("SEARCH :: THE ROAD IS OPEN - /search READS THE ARCHIVE OF PAST TURNS, /lore find READS THE LOADED SCROLLS."
        + (st.searchFunction ? "" : " (TOGGLE IS OFF - THE ROADS STILL STAND.)"));
    });
    def(["EnableDropDownFilters"], async function () {
      say("FILTERS :: THIS TERMINAL HAS NO MENUS - THE LINE IS THE FILTER: /search <WORDS> (TURNS), /lore find <NAME> (SCROLLS), /gallery find <WORDS> (PICTURES).");
    });
    def(["EnableChatLogging"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.chatLogging = /^on$/i.test(arg);
      var n = -1;
      try {
        var k = SEAM.archiveKV;
        if (k) { var log = await k.get("master_log"); if (Array.isArray(log)) n = log.length; }
      } catch (e) {}
      say("CHAT LOGGING :: " + (st.chatLogging ? "ON" : "OFF") + " - AND THE ARCHIVE LOGS EVERY TURN REGARDLESS"
        + (n >= 0 ? " (" + n + " TURNS ON THE RECORD RIGHT NOW)" : "") + ". /export CARRIES IT OUT.");
    });
    def(["ProcessBlockText"], async function (st, a) {
      var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
      if (m) {
        var src = await loreFull(m[1].trim(), 200000);
        if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
        text = src.text;
      }
      if (!text) { say("USAGE: /ProcessBlockText <TEXT> OR /ProcessBlockText doc <NAME>."); return; }
      if (st.dataCleaning) text = cleanText(text);
      var parts = text.split(/(?<=[.!?;\u037e\n])\s+/), pack = [], cur = "";
      parts.forEach(function (p) {
        while (p.length > 450) { pack.push(p.slice(0, 450)); p = p.slice(450); }
        if ((cur + " " + p).trim().length > 450 && cur) { pack.push(cur.trim()); cur = p; }
        else cur = (cur ? cur + " " : "") + p;
      });
      if (cur.trim()) pack.push(cur.trim());
      var L = ["BLOCK :: " + pack.length + " PIECES, CLEANED, TAGGED, COUNTED -"], i;
      for (i = 0; i < Math.min(pack.length, 20); i++) {
        var words = pack[i].split(/\s+/).length;
        var tags = hashtagsOf(pack[i], 3).join(" ");
        L.push("[" + (i + 1) + "] " + words + " WORDS" + (tags ? " " + tags : ""));
      }
      if (pack.length > 20) L.push("(AND " + (pack.length - 20) + " MORE - FIRST 20 SHOWN.)");
      say(L.join("\n"));
    });
    def(["ImplementDataSummarization"], async function (st, a) {
      var text = a, m = String(a).match(/^doc\s+([\s\S]+)$/i);
      if (m) {
        var src = await loreFull(m[1].trim(), 200000);
        if (!src) { say("NO LOADED SCROLL CALLED ANYTHING LIKE \"" + m[1].trim().toUpperCase() + "\"."); return; }
        text = src.text;
        say("SUMMARY OF " + src.name + " (LOCAL, EXTRACTIVE) :: " + summarizeExtractive(text, 3));
        return;
      }
      if (!text) { say("USAGE: /ImplementDataSummarization <TEXT> OR ... doc <NAME>."); return; }
      say(summarizeExtractive(st.dataCleaning ? cleanText(text) : text, 3) || "NOTHING TO SUMMARIZE.");
    });
    def(["ImplementSecurityProtocols"], async function (st) {
      say("SECURITY PROTOCOLS :: READ OUT, THEN KEPT AS STATED POSTURE -");
      try {
        var ring = await SEAM.keyring.list();
        say("- RING :: " + (Array.isArray(ring) ? ring.length : 0) + " KEYS (IDS ONLY).");
      } catch (e) { say("- RING :: UNREADABLE HERE."); }
      say("- RECORD :: THIS DEVICE ONLY (kv), NOTHING UPLOADED EXCEPT WHAT /sync AND /cloud SEND BY HAND.");
      say("- CONSENT :: " + st.consent.filter(function (c) { return c.st === "pending"; }).length + " PENDING - NOTHING GRANTED WITHOUT /approve.");
      say("- AGENCY :: NEVER ABOVE SECURITY, CONSENT, OR SYSTEM CONSTRAINTS.");
    });
    def(["EnableTaskTracking"], async function (st, a) {
      var arg = String(a == null ? "" : a).trim();
      if (/^(on|off)$/i.test(arg)) st.taskTracking = /^on$/i.test(arg);
      var open = st.tasks ? st.tasks.filter(function (t) { return t.st === "open" || t.st === "waiting" || t.st === "active"; }) : [];
      say("TASK TRACKING :: " + (st.taskTracking ? "ON" : "OFF") + " - " + open.length + " OPEN."
        + (open.length ? "\n" + open.map(function (t) { return "#" + t.id + " [" + t.st.toUpperCase() + "] " + t.text; }).join("\n") : ""));
    });

    
return { run: run, handles: handles, help: helpPage, verbs: verbs, load: load, save: save, state: load, cleanText: cleanText, keywordsOf: keywordsOf, keywordTable: keywordTable, summarizeExtractive: summarizeExtractive, sanitizeGreek: sanitizeGreek, hashtagsOf: hashtagsOf };
}
return { client: client };
})();
if (typeof module !== "undefined" && module.exports) module.exports = window.MythosSpincode;
