(function () {
  "use strict";

  var REC_KEY = "msd";
  var PREFIX = "terminal:";
  var DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:4173",
    "http://127.0.0.1:5173", "http://127.0.0.1:4173"];
  var MAX_NODES = 60, MAX_NAV = 12, MAX_WIDGETS = 12, MAX_KPI = 12;

  var board = null;
  var origins = null;

  function el(id) { return document.getElementById(id); }
  function say(t) { if (window.print && t) window.print("SYSTEM", String(t)); }
  function lastReceipt() {
    var es = [];
    try { es = document.querySelectorAll(".entry"); } catch (e) {}
    return es.length ? es[es.length - 1].textContent.slice(0, 220) : "(none)";
  }

  function loadRec() {
    var r = null;
    try { r = window.root.kv.lia_settings.get(REC_KEY); } catch (e) { r = null; }
    return Promise.resolve(r).then(function (v) { return (v && typeof v === "object") ? v : {}; });
  }
  function saveRec() {
    try { window.root.kv.lia_settings.set(REC_KEY, { board: board, origins: origins }); } catch (e) {}
  }

  function vox() {
    try { return window.voxcont || null; } catch (e) { return null; }
  }

  function runBinding(spec) {
    var v = vox();
    if (!v || !v._run) { say("MSD :: VOICE CONTROL IS OFFLINE - NOTHING MOVED."); return false; }
    var s = String(spec == null ? "" : spec).trim();
    if (s.toLowerCase().indexOf(PREFIX) !== 0) {
      say("MSD :: UNBOUND - THAT NODE CARRIES NO terminal: BINDING.");
      return false;
    }
    var hit = false;
    try { hit = v._run(s.slice(PREFIX.length)); } catch (e) { hit = false; }
    if (!hit) say("MSD :: NO COMMAND IN THAT BINDING - NOTHING MOVED.");
    return hit;
  }

  function num(n, dflt) {
    n = Number(n);
    return (isFinite(n) ? n : dflt);
  }

  function sanitize(raw) {
    var warnings = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { manifest: null, warnings: ["NOT AN OBJECT"] };
    var m = { navigation: [], kpiCards: [], widgets: [] };
    if (typeof raw.layoutId !== "string" || !raw.layoutId) return { manifest: null, warnings: ["NO layoutId"] };
    m.layoutId = raw.layoutId.slice(0, 60);
    if (typeof raw.name === "string" && raw.name) m.name = raw.name.slice(0, 80);
    m.theme = (typeof raw.theme === "string" && raw.theme) ? raw.theme.slice(0, 60) : "crt-green";
    if (!raw.header || typeof raw.header !== "object") return { manifest: null, warnings: ["NO header"] };
    m.header = {
      title: String(raw.header.title || m.layoutId).slice(0, 80),
      authorizationCode: String(raw.header.authorizationCode || "").slice(0, 40),
      stardate: String(raw.header.stardate || "").slice(0, 40)
    };
    if (!raw.msdCanvas || typeof raw.msdCanvas !== "object") return { manifest: null, warnings: ["NO msdCanvas"] };
    var nodes = Array.isArray(raw.msdCanvas.nodes) ? raw.msdCanvas.nodes : [];
    m.nodes = [];
    for (var i = 0; i < nodes.length && m.nodes.length < MAX_NODES; i++) {
      var n = nodes[i];
      if (!n || typeof n !== "object" || typeof n.id !== "string" || !n.id) continue;
      m.nodes.push({
        id: n.id.slice(0, 40),
        label: String(n.label || n.id).slice(0, 40),
        x: Math.max(0, Math.min(100, num(n.x, 50))),
        y: Math.max(0, Math.min(100, num(n.y, 50))),
        status: /^(nominal|warning|critical|standby)$/.test(String(n.status || "")) ? n.status : "nominal",
        description: (typeof n.description === "string" ? n.description : "").slice(0, 140),
        targetSection: (typeof n.targetSection === "string" ? n.targetSection : "").slice(0, 160)
      });
    }
    if (nodes.length > m.nodes.length) warnings.push("NODES CAPPED AT " + MAX_NODES);
    var nav = Array.isArray(raw.navigation) ? raw.navigation : [];
    for (var j = 0; j < nav.length && m.navigation.length < MAX_NAV; j++) {
      var a = nav[j];
      if (!a || typeof a !== "object") continue;
      m.navigation.push({
        id: String(a.id || ("nav" + j)).slice(0, 40),
        label: String(a.label || a.id || ("NAV" + j)).slice(0, 40),
        target: (typeof a.target === "string" ? a.target : "").slice(0, 160)
      });
    }
    var kpi = Array.isArray(raw.kpiCards) ? raw.kpiCards : [];
    for (var k = 0; k < kpi.length && m.kpiCards.length < MAX_KPI; k++) {
      var c = kpi[k];
      if (!c || typeof c !== "object") continue;
      m.kpiCards.push({
        id: String(c.id || ("kpi" + k)).slice(0, 40),
        label: String(c.label || c.id || ("KPI" + k)).slice(0, 40),
        value: String(c.value == null ? "-" : c.value).slice(0, 40),
        unit: String(c.unit || "").slice(0, 20)
      });
    }
    var wg = Array.isArray(raw.widgets) ? raw.widgets : [];
    for (var w = 0; w < wg.length && m.widgets.length < MAX_WIDGETS; w++) {
      var g = wg[w];
      if (!g || typeof g !== "object") continue;
      var term = null;
      try {
        if (g.data && typeof g.data === "object" && typeof g.data.terminal === "string") term = g.data.terminal.slice(0, 160);
        else if (typeof g.data === "string" && g.data.toLowerCase().indexOf(PREFIX) === 0) term = g.data.slice(0, 160);
      } catch (e) {}
      m.widgets.push({
        id: String(g.id || ("w" + w)).slice(0, 40),
        title: String(g.title || g.id || ("W" + w)).slice(0, 60),
        type: String(g.type || "status-grid").slice(0, 40),
        terminal: term
      });
    }
    return { manifest: m, warnings: warnings };
  }

  function feedValue(kind) {
    if (kind === "vault") {
      try { return String(window.media.list().length) + " RECORDS"; } catch (e) { return "?"; }
    }
    if (kind === "panels") {
      var v = vox();
      if (v && v.state) {
        try {
          var o = v.state().open || [];
          return o.length ? o.join(", ").toUpperCase() : "NONE OPEN";
        } catch (e) {}
      }
      return "?";
    }
    if (kind === "voice") {
      var v2 = vox();
      try { return (v2 && v2.isArmed && v2.isArmed()) ? "ARMED" : "OFF"; } catch (e) { return "?"; }
    }
    if (kind === "theme") {
      try { return (window.theme && window.theme.state().kept) || "CRT"; } catch (e) { return "?"; }
    }
    if (kind === "log") return lastReceipt();
    return "-";
  }

  function render() {
    var box = el("msdBoard");
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!board) {
      var d = document.createElement("div");
      d.className = "cpNote";
      d.textContent = "NO BOARD - /msd import <MANIFEST JSON> BUILDS ONE FROM A DESIGNER EXPORT.";
      box.appendChild(d);
      return;
    }
    var head = document.createElement("div");
    head.className = "cpHead";
    var t = document.createElement("span");
    t.textContent = board.header.title + (board.header.authorizationCode ? " \u00b7 " + board.header.authorizationCode : "");
    head.appendChild(t);
    var st = document.createElement("span");
    st.textContent = (board.name || board.layoutId) + " \u00b7 THEME " + board.theme.toUpperCase();
    head.appendChild(st);
    box.appendChild(head);
    if (board.navigation.length) {
      var nav = document.createElement("div");
      nav.className = "cpChips";
      board.navigation.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = a.label;
        b.title = a.target || a.id;
        b.addEventListener("click", function () { runBinding(a.target); });
        nav.appendChild(b);
      });
      box.appendChild(nav);
    }
    var cv = document.createElement("div");
    cv.className = "msdCanvas";
    board.nodes.forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "msdNode msd-" + n.status;
      b.style.left = n.x + "%";
      b.style.top = n.y + "%";
      b.textContent = n.label;
      b.title = (n.description ? n.description + " - " : "") + (n.targetSection || "unbound");
      b.addEventListener("click", function () { runBinding(n.targetSection); });
      cv.appendChild(b);
    });
    box.appendChild(cv);
    if (board.kpiCards.length) {
      var kr = document.createElement("div");
      kr.className = "msdKpiRow";
      board.kpiCards.forEach(function (c) {
        var k = document.createElement("div");
        k.className = "msdKpi";
        var l = document.createElement("div");
        l.className = "msdKpiLabel";
        l.textContent = c.label;
        var v = document.createElement("div");
        v.className = "msdKpiVal";
        v.textContent = c.value + (c.unit ? " " + c.unit : "");
        k.appendChild(l);
        k.appendChild(v);
        kr.appendChild(k);
      });
      box.appendChild(kr);
    }
    board.widgets.forEach(function (g) {
      var w = document.createElement("div");
      w.className = "msdWidget";
      var h = document.createElement("div");
      h.className = "msdWidgetHead";
      h.textContent = g.title;
      w.appendChild(h);
      var p = document.createElement("div");
      p.className = "msdWidgetBody";
      if (g.type === "event-log") {
        var es = [];
        try { es = document.querySelectorAll(".entry"); } catch (e) {}
        var show = [];
        for (var i = es.length - 1; i >= 0 && show.length < 5; i--) {
          var tx = es[i].textContent || "";
          if (/^(SYSTEM|HITL|LIA)/.test(tx.trim())) show.push(tx.trim().slice(0, 90));
        }
        p.textContent = show.length ? show.join("\n") : "(quiet)";
      } else if (g.terminal) {
        p.textContent = "BOUND :: " + g.terminal;
      } else {
        p.textContent = g.type.toUpperCase() + " :: VAULT " + feedValue("vault") + " \u00b7 PANELS " + feedValue("panels")
          + " \u00b7 VOICE " + feedValue("voice") + " \u00b7 SKIN " + feedValue("theme");
      }
      w.appendChild(p);
      if (g.terminal) {
        var b2 = document.createElement("button");
        b2.type = "button";
        b2.textContent = "RUN";
        b2.addEventListener("click", function () { runBinding(g.terminal); });
        w.appendChild(b2);
      }
      box.appendChild(w);
    });
  }

  function importText(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) { say("MSD :: NOTHING TO READ - PASTE A DESIGNER MSDLayoutManifest JSON AFTER /msd import."); return false; }
    var parsed = null;
    try { parsed = JSON.parse(raw); }
    catch (e) { say("MSD :: THAT IS NOT JSON - " + String((e && e.message) || e).toUpperCase()); return false; }
    var r = sanitize(parsed);
    if (!r.manifest) { say("MSD :: NOT A BOARD (" + r.warnings.join(" + ") + ") - NEEDS layoutId, header, msdCanvas."); return false; }
    board = r.manifest;
    saveRec();
    render();
    var p = el("msdPanel");
    if (p) p.hidden = false;
    say("MSD :: " + String(board.header.title).toUpperCase() + " ON THE STAGE - " + board.nodes.length + " NODES, "
      + board.navigation.length + " NAV" + (r.warnings.length ? " (" + r.warnings.join(" + ") + ")" : "") + ".");
    return true;
  }

  function originOk(origin) {
    if (origin === window.location.origin) return true;
    var list = origins || [];
    for (var i = 0; i < list.length; i++) if (list[i] === origin) return true;
    return false;
  }

  function onMessage(e) {
    var d = e.data;
    if (!d || typeof d !== "object" || d.k !== "sia") return;
    var origin = String(e.origin || "");
    if (d.hello === 1) {
      if (!originOk(origin)) return;
      try { e.source.postMessage({ k: "sia", ready: 1, surface: 1 }, origin === window.location.origin ? origin : e.origin); } catch (x) {}
      return;
    }
    if (typeof d.terminal !== "string") return;
    if (!originOk(origin)) return;
    var hit = runBinding(d.terminal);
    try {
      e.source.postMessage({ k: "sia", ok: !!hit, receipt: lastReceipt(), token: (d.token == null ? null : d.token) }, e.origin);
    } catch (x) {}
  }

  function status() {
    return "MSD :: " + (board ? String(board.header.title).toUpperCase() + " (" + board.nodes.length + " NODES)" : "NO BOARD")
      + "\nORIGINS :: " + (origins && origins.length ? origins.join(", ") : "(localhost presets)")
      + "\nBINDINGS RIDE terminal: COMMAND-TEXT (src/bridge/terminal-surface.json) - /msd import BUILDS THE BOARD.";
  }

  function words(arg) {
    var t = String(arg == null ? "" : arg).trim();
    var low = t.toLowerCase();
    if (!low || low === "status" || low === "state") { say(status()); return; }
    if (low === "help" || low === "?") {
      say("MSD :: THE DESIGNER'S BOARDS, RUNNING HERE. /msd import <MANIFEST JSON> BUILDS THE BOARD (NODES AT x/y, NAV, KPI, WIDGETS - terminal: BINDINGS WORK THE CONSOLE THROUGH THE SAME GATES AS VOICE CONTROL). /msd board OPENS IT, /msd close PUTS IT AWAY, /msd forget DROPS IT. /msd origins LISTS THE POSTMESSAGE ORIGINS A DESIGNER TAB MAY DRIVE FROM (VITE PRESETS SHIPPED) - /msd origin add|drop <ORIGIN>. /msd run <COMMAND-TEXT> TRIES ONE BINDING FROM TEXT.");
      return;
    }
    if (low === "board" || low === "open" || low === "show") {
      render();
      var p = el("msdPanel");
      if (p) p.hidden = false;
      if (!board) say("MSD :: NO BOARD YET - /msd import FIRST.");
      return;
    }
    if (low === "close" || low === "hide" || low === "shut") {
      var p2 = el("msdPanel");
      if (p2) p2.hidden = true;
      return;
    }
    if (low === "forget") {
      board = null;
      saveRec();
      render();
      say("MSD :: BOARD DROPPED.");
      return;
    }
    if (low === "origins" || low === "origin") {
      var list = (origins && origins.length ? origins : DEFAULT_ORIGINS);
      say("MSD :: ORIGINS - " + list.join(", "));
      return;
    }
    var m = low.match(/^origin\s+(add|drop)\s+(\S+)\s*$/);
    if (m) {
      if (!origins || !origins.length) origins = DEFAULT_ORIGINS.slice();
      if (m[1] === "add") {
        if (origins.indexOf(m[2]) < 0) origins.push(m[2]);
        saveRec();
        say("MSD :: ORIGIN ADDED - " + m[2]);
      } else {
        origins = origins.filter(function (o) { return o !== m[2]; });
        saveRec();
        say("MSD :: ORIGIN DROPPED - " + m[2]);
      }
      return;
    }
    m = low.match(/^(import|wear|apply|load)\s*([\s\S]*)$/);
    if (m) { importText(t.slice(m[1].length).trim()); return; }
    m = low.match(/^run\s+([\s\S]+)$/);
    if (m) { runBinding(m[1]); return; }
    say("USAGE: /msd [status|import <JSON>|board|close|run <COMMAND-TEXT>|origins|origin add|drop <ORIGIN>|forget|help]");
  }

  function paint() {
    var s = el("msdState");
    if (s) s.textContent = board ? (board.header.title + " - " + board.nodes.length + " NODES") : "NO BOARD";
  }

  function toggle() {
    var p = el("msdPanel");
    if (!p) return;
    if (p.hidden) render();
    p.hidden = !p.hidden;
    try { paint(); } catch (e) {}
  }

  loadRec().then(function (r) {
    if (r) {
      if (r.board && r.board.layoutId) board = r.board;
      if (Array.isArray(r.origins) && r.origins.length) origins = r.origins;
    }
    try { paint(); } catch (e) {}
  });
  window.addEventListener("message", onMessage);
  if (document.readyState !== "loading") {
    var b = el("msdBtn");
    if (b) b.addEventListener("click", toggle);
    var c = el("msdClose");
    if (c) c.addEventListener("click", toggle);
    paint();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      var b2 = el("msdBtn");
      if (b2) b2.addEventListener("click", toggle);
      var c2 = el("msdClose");
      if (c2) c2.addEventListener("click", toggle);
      paint();
    });
  }

  window.msd = {
    toggle: toggle,
    importText: importText,
    run: runBinding,
    words: words,
    status: status,
    paint: paint,
    state: function () { return { board: board ? board.layoutId : null, nodes: board ? board.nodes.length : 0 }; },
    _sanitize: sanitize,
    _origins: function () { return (origins && origins.length ? origins : DEFAULT_ORIGINS).slice(); }
  };
})();
