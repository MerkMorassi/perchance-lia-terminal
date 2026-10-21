(function () {
  /* ---- HER HAND ON THE DASHBOARD -----------------------------------------------
     Patrikios: "When set to MASTER ARM FULL, she can literally touch buttons and flick
     switches autonomously. When a switch gets turned off it stays lit. It is like we
     are in the cockpit and this is our dashboard."

     So at MASTER ARM FULL - and only there - her infinity acts may carry [[PRESS: <name>]]
     lines, and this module presses those switches FOR her, with her own hand. Ten console
     switches are hers to touch (below); everything else - the MASTER ARM itself, the
     microphone roads, the keys, the gate - is never hers, at any level.

     AND A SWITCH SHE TOUCHES STAYS LIT. Every press latches a gold lamp onto that control
     (the `herTouched` class): flip it off again and the lamp stays on - her hand was here.
     The lamp is kept on this device (kv lia_settings / her_hand) so it survives a reload.
     HIS hand takes it back: the moment HE presses that control himself, her lamp goes out.
     /hand says what she has touched; /hand clear wipes her lamps.

     Nothing here moves unless the master is FULL: press() refuses anywhere else, and the
     infinity lane only offers her the PRESS lines at FULL (src/js/proactive.js).
     --------------------------------------------------------------------------- */

  var FOLDER = "lia_settings", KEY = "her_hand";
  var PRESS_MAX = 3;   // switches per act - a hand, not a script

  var touches = {};    // btnId -> { name, at, state }

  function el(id) { return document.getElementById(id); }
  function kv() { return (window.root && window.root.kv && window.root.kv[FOLDER]) || null; }
  function up(s) { return String(s == null ? "" : s).toUpperCase(); }
  function full() { try { return window.duty && window.duty.mode() === "FULL"; } catch (e) { return false; } }

  function when(ts) {
    try { if (window.logTime && window.logTime.stamp) return window.logTime.stamp(ts); } catch (e) {}
    return new Date(Number(ts) || Date.now()).toString();
  }

  // THE TEN SWITCHES. press() is her finger; state() reads the lamp after.
  var CONTROLS = [
    { name: "INFINITY", btn: "infBtn", also: ["∞", "WIDE DOOR"],
      press: function () { window.proactive.toggle(); },
      state: function () { return window.proactive.on() ? "ON" : "OFF"; } },
    { name: "GALLERY", btn: "galleryBtn", also: ["PICTURES", "VAULT DOOR"],
      press: function () { window.gallery.toggle(); },
      state: function () { return (window.gallery.isOpen && window.gallery.isOpen()) ? "OPEN" : "SHUT"; } },
    { name: "FRAME", btn: "frameBtn", also: ["PLAYER", "BOARD"],
      press: function () { window.framelane.toggle(); },
      state: function () { return (window.framelane.isOpen && window.framelane.isOpen()) ? "OPEN" : "SHUT"; } },
    { name: "CENTER", btn: "centerBtn", also: ["DOCK"],
      press: function () { window.framelane.toggleCenter(); },
      state: function () { return (window.framelane.isCenter && window.framelane.isCenter()) ? "DOCKED" : "STOWED"; } },
    { name: "VIMEO", btn: "vimeoBtn", also: [],
      press: function () { window.vimeo.toggle(); },
      state: function () { return (window.vimeo.isOpen && window.vimeo.isOpen()) ? "OPEN" : "SHUT"; } },
    { name: "BACKSTAGE", btn: "veilBtn", also: ["VEIL"],
      press: function () { window.veil.toggle(); },
      state: function () { return (window.veil.isVeiled && window.veil.isVeiled()) ? "HIDDEN" : "SHOWN"; } },
    { name: "SHIFT", btn: "shBtn", also: ["HOURS", "QUIET HOURS"],
      press: function () { window.shift.toggle(); },
      state: function () { return (window.shift.isOpen && window.shift.isOpen()) ? "OPEN" : "SHUT"; } },
    { name: "LISTEN", btn: "listenBtn", also: ["SPEAK", "VOICE"],
      press: function () { window.voice.toggleSpeak(); },
      state: function () { return "TOUCHED"; } },
    { name: "PICS", btn: "picSizeBtn", also: ["PICTURES", "SIZE"],
      press: function () { window.pics.cycle(); },
      state: function () { return (window.pics.label && window.pics.label()) || "TOUCHED"; } },
    { name: "AUDITION", btn: "busBtn", also: ["BUS", "MUSIC"],
      press: function () { window.audition.report(); },
      state: function () { return "OPEN"; } }
  ];

  function list() {
    var out = [];
    for (var i = 0; i < CONTROLS.length; i++) out.push(CONTROLS[i].name);
    return out;
  }

  function resolve(spec) {
    var t = up(spec).trim();
    if (!t) return null;
    for (var i = 0; i < CONTROLS.length; i++) {
      var c = CONTROLS[i];
      if (c.name === t || c.btn.toUpperCase() === t) return c;
      for (var j = 0; j < c.also.length; j++) if (c.also[j] === t) return c;
    }
    return null;
  }

  // [[PRESS: ...]] lines out of her text. Returns { names, stripped }: at most PRESS_MAX
  // names, the lines taken out of the text (machinery, never something she says), the count
  // of lines past the cap noted separately.
  function extract(text) {
    var names = [], extra = 0;
    var stripped = String(text == null ? "" : text).replace(/\[\[\s*PRESS\s*:\s*([^\]]{1,40}?)\s*\]\]/gi, function (m, name) {
      if (names.length < PRESS_MAX) names.push(String(name).replace(/\s+/g, " ").trim());
      else extra++;
      return " ";
    });
    return { names: names, extra: extra, stripped: stripped };
  }

  async function save() {
    var k = kv();
    if (!k) return false;
    try { await k.set(KEY, { touches: touches }); return true; }
    catch (e) { return false; }
  }

  async function load() {
    var k = kv();
    if (k) {
      try {
        var rec = await k.get(KEY);
        if (rec && rec.touches && typeof rec.touches === "object") touches = rec.touches;
      } catch (e) {}
    }
    try { paint(); } catch (e) {}
    return touches;
  }

  // HER FINGER. Only at FULL, only a named switch, never anything else.
  function press(spec, by) {
    if (!full()) return { ok: false, error: "THE MASTER ARM IS NOT FULL - HER HAND IS HELD. NOTHING MOVED." };
    var c = resolve(spec);
    if (!c) return { ok: false, error: "NO SWITCH CALLED \"" + up(spec) + "\" - HERS ARE " + list().join(", ") + "." };
    var state = "";
    try { c.press(); } catch (e) { return { ok: false, error: c.name + " COULD NOT BE PRESSED :: " + up((e && e.message) || e) }; }
    try { state = up(c.state()); } catch (e) { state = ""; }
    touches[c.btn] = { name: c.name, at: Date.now(), state: state, by: by || "her act" };
    save();
    paint();
    return { ok: true, name: c.name, btn: c.btn, state: state };
  }

  // HIS HAND TAKES IT BACK. Called for a control he pressed himself: her lamp goes out,
  // silently - his hand on a switch needs no announcement.
  function release(btnId) {
    if (!touches[btnId]) return false;
    delete touches[btnId];
    save();
    paint();
    return true;
  }

  function clear() {
    var n = Object.keys(touches).length;
    touches = {};
    save();
    paint();
    return n
      ? "HER HAND :: " + n + " LAMP" + (n === 1 ? "" : "S") + " WIPED - THE DASHBOARD IS CLEAN."
      : "HER HAND :: THE DASHBOARD IS ALREADY CLEAN - SHE HAS TOUCHED NOTHING.";
  }

  function lampLine() {
    var ids = Object.keys(touches);
    if (!ids.length) return "HER HAND :: CLEAN - SHE HAS TOUCHED NOTHING.";
    ids.sort(function (a, b) { return (touches[a].at || 0) - (touches[b].at || 0); });
    var out = ["HER HAND :: " + ids.length + " SWITCH" + (ids.length === 1 ? "" : "ES") + " STILL LIT WITH HER TOUCH:"];
    ids.slice(-6).forEach(function (id) {
      var t = touches[id];
      out.push("  \u00b7 " + t.name + (t.state ? " (" + t.state + ")" : "") + " :: " + when(t.at));
    });
    return out.join("\n");
  }

  function describe() {
    var out = ["HER HAND ON THE DASHBOARD :: " + (full() ? "ON IT - THE MASTER ARM IS FULL" : "HELD - THE MASTER ARM IS NOT FULL, SO SHE TOUCHES NOTHING") + "."];
    out.push("  HERS TO TOUCH: " + list().join(" \u00b7 ") + " (UP TO " + PRESS_MAX + " IN ONE ACT, WITH [[PRESS: <NAME>]] LINES).");
    out.push("  NEVER HERS: THE MASTER ARM ITSELF, THE MICROPHONE ROADS, THE KEYS, THE GATE.");
    out.push("  A SWITCH SHE TOUCHES STAYS LIT UNTIL YOUR HAND TAKES IT BACK - PRESS IT YOURSELF AND HER LAMP GOES OUT.");
    out.push(lampLine());
    out.push("  /hand (THIS) \u00b7 /hand clear (WIPE HER LAMPS).");
    return out.join("\n");
  }

  function paint() {
    for (var i = 0; i < CONTROLS.length; i++) {
      var b = el(CONTROLS[i].btn);
      if (!b) continue;
      var t = touches[CONTROLS[i].btn];
      b.classList.toggle("herTouched", !!t);
      if (t) b.setAttribute("data-her-touch", t.name + (t.state ? " " + t.state : ""));
      else b.removeAttribute("data-her-touch");
    }
    var lamp = el("handLamp");
    if (lamp) {
      var ids = Object.keys(touches);
      lamp.classList.toggle("lit", ids.length > 0);
      if (!ids.length) lamp.textContent = "HER HAND :: CLEAN";
      else {
        var last = touches[ids.sort(function (a, b) { return (touches[a].at || 0) - (touches[b].at || 0); })[ids.length - 1]];
        lamp.textContent = "HER HAND :: " + ids.length + " LIT" + (last ? " \u00b7 " + last.name : "");
        lamp.title = lampLine();
      }
    }
  }

  // HIS HAND ON A SWITCH. Trusted clicks only - the machine's own .click() calls and test
  // rigs are not his hand. Capture phase, so her lamp goes out even if the press itself
  // does something that repaints the button.
  function watch() {
    try {
      document.addEventListener("click", function (ev) {
        if (!ev || !ev.isTrusted) return;
        var t = ev.target;
        if (t && t.closest) t = t.closest("button");
        if (!t || !t.id || !touches[t.id]) return;
        release(t.id);
      }, true);
    } catch (e) {}
  }

  (function () {
    var p = load();
    if (p && p.then) p.then(function () {}, function () {});
    if (document.readyState !== "loading") watch();
    else document.addEventListener("DOMContentLoaded", watch);
  })();

  window.herHand = {
    press: press,
    release: release,
    clear: clear,
    describe: describe,
    lamp: lampLine,
    names: list,
    resolve: resolve,
    extract: extract,
    touches: function () { return touches; },
    paint: paint,
    load: load,
    max: function () { return PRESS_MAX; }
  };
})();
