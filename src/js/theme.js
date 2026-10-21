(function () {
  "use strict";

  var REC_KEY = "theme";
  var TAG_ID = "themeSkin";
  var BODY_CLASS = "theme-skinned";

  var COLOR_KEYS = ["bgObsidian", "bgSlate", "border", "primary", "secondary",
    "accent", "alert", "gold", "live", "text", "textMuted"];

  var CRT = {
    bgObsidian: "#000000", bgSlate: "#001100", border: "#005500",
    primary: "#00ff00", secondary: "#009933", accent: "#00ffcc",
    alert: "#ff4444", gold: "#f59e0b", live: "#00ff00",
    text: "#00ff00", textMuted: "#008800"
  };

  var kept = null;

  function el(id) { return document.getElementById(id); }
  function say(t) { if (window.print && t) window.print("SYSTEM", String(t)); }

  function loadRec() {
    var r = null;
    try { r = window.root.kv.lia_settings.get(REC_KEY); } catch (e) { r = null; }
    return Promise.resolve(r).then(function (v) { return (v && typeof v === "object") ? v : {}; });
  }
  function saveRec(rec) {
    try { window.root.kv.lia_settings.set(REC_KEY, rec || {}); } catch (e) {}
  }

  function okColor(s) {
    return typeof s === "string" && (/^#[0-9a-fA-F]{3,8}$/.test(s)
      || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(s));
  }
  function okFont(s) {
    return typeof s === "string" && s.length > 0 && s.length <= 120 && /^[\w\s,'"\-!]+$/.test(s);
  }
  function okId(s) {
    return typeof s === "string" && /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/.test(s) && s.length <= 40;
  }

  function sanitize(raw) {
    var warnings = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { theme: null, warnings: ["NOT AN OBJECT"] };
    var src = raw.theme && typeof raw.theme === "object" ? raw.theme : raw;
    var colors = (src.colors && typeof src.colors === "object") ? src.colors : {};
    var out = { colors: {} };
    var i, k;
    out.id = okId(src.id) ? src.id : ("import-" + new Date().toISOString().slice(0, 10));
    if (!okId(src.id)) warnings.push("ID REBUILT");
    out.name = String(src.name || out.id).slice(0, 80) || out.id;
    out.era = String(src.era || "").slice(0, 80);
    for (i = 0; i < COLOR_KEYS.length; i++) {
      k = COLOR_KEYS[i];
      if (colors[k] == null) { out.colors[k] = CRT[k]; warnings.push(k.toUpperCase() + " FELL BACK TO CRT"); }
      else if (!okColor(colors[k])) { out.colors[k] = CRT[k]; warnings.push(k.toUpperCase() + " REJECTED, CRT KEPT"); }
      else out.colors[k] = String(colors[k]);
    }
    if (src.glowColor != null) {
      if (okColor(src.glowColor)) out.glowColor = String(src.glowColor);
      else warnings.push("GLOW REJECTED");
    }
    if (src.fonts && typeof src.fonts === "object") {
      var f = {};
      ["display", "mono", "body"].forEach(function (fk) {
        if (src.fonts[fk] != null) {
          if (okFont(src.fonts[fk])) f[fk] = String(src.fonts[fk]);
          else warnings.push("FONT " + fk.toUpperCase() + " REJECTED");
        }
      });
      if (f.display || f.mono || f.body) out.fonts = f;
    }
    var seen = {};
    ["id", "name", "era", "colors", "glowColor", "fonts", "source", "isCustom", "archHeaderClass",
     "elbowClass", "pillboxPrimaryClass", "pillboxSecondaryClass", "theme", "layoutId"].forEach(function (k) { seen[k] = true; });
    var dropped = 0;
    for (k in src) if (src.hasOwnProperty(k) && !seen[k]) dropped++;
    if (dropped) warnings.push(dropped + " UNKNOWN KEY" + (dropped === 1 ? "" : "S") + " IGNORED");
    if (src.theme && typeof src.theme === "object") warnings.push("DESIGNER WRAPPER UNWRAPPED");
    return { theme: out, warnings: warnings };
  }

  function buildCSS(t) {
    var C = t.colors, F = t.fonts || {};
    var L = [];
    L.push("body." + BODY_CLASS + " { background: " + C.bgObsidian + " !important; color: " + C.text + " !important;"
      + (F.mono ? " font-family: " + F.mono + " !important;" : "") + " }");
    L.push("body." + BODY_CLASS + " #output { color: " + C.text + " !important; }");
    L.push("body." + BODY_CLASS + " #output a, body." + BODY_CLASS + " .dmsRead a { color: " + C.accent + " !important; }");
    L.push("body." + BODY_CLASS + " #command-deck { background: " + C.bgObsidian + " !important; border-top: 1px solid " + C.primary + " !important; }");
    L.push("body." + BODY_CLASS + " button { background: " + C.bgObsidian + " !important; border: 1px solid " + C.primary + " !important; color: " + C.primary + " !important; }");
    L.push("body." + BODY_CLASS + " button:hover { background: " + C.primary + " !important; color: " + C.bgObsidian + " !important; }");
    L.push("body." + BODY_CLASS + " button:disabled { color: " + C.border + " !important; border-color: " + C.border + " !important; }");
    L.push("body." + BODY_CLASS + " textarea, body." + BODY_CLASS + " input, body." + BODY_CLASS + " select { background: " + C.bgObsidian + " !important; border: 1px solid " + C.primary + " !important; color: " + C.text + " !important; }");
    L.push("body." + BODY_CLASS + " textarea::placeholder, body." + BODY_CLASS + " input::placeholder { color: " + C.textMuted + " !important; }");
    L.push("body." + BODY_CLASS + " textarea:focus, body." + BODY_CLASS + " input:focus, body." + BODY_CLASS + " select:focus { background: " + C.bgSlate + " !important; }");
    L.push("body." + BODY_CLASS + " select option { background: " + C.bgObsidian + " !important; color: " + C.text + " !important; }");
    L.push("body." + BODY_CLASS + " .deckPanel { background: " + C.bgSlate + " !important; border-color: " + C.border + " !important; color: " + C.text + " !important; }");
    L.push("body." + BODY_CLASS + " .sidePanel { background: " + C.bgObsidian + " !important; }");
    L.push("body." + BODY_CLASS + " .cpLabel, body." + BODY_CLASS + " .cpHint, body." + BODY_CLASS + " .cpNote, body." + BODY_CLASS + " .cpHead span { color: " + C.textMuted + " !important; }");
    L.push("body." + BODY_CLASS + " .deckKey { color: " + C.secondary + " !important; border-color: " + C.border + " !important; }");
    L.push("body." + BODY_CLASS + " .deckKey:hover { color: " + C.primary + " !important; border-color: " + C.primary + " !important; }");
    L.push("body." + BODY_CLASS + " .deckTab { background: " + C.bgSlate + " !important; color: " + C.primary + " !important; border: 1px solid " + C.primary + " !important; }");
    L.push("body." + BODY_CLASS + " .deckTab:hover { background: " + C.primary + " !important; color: " + C.bgObsidian + " !important; }");
    L.push("body." + BODY_CLASS + " .airLamp { border-color: " + C.border + " !important; color: " + C.textMuted + " !important; }");
    L.push("body." + BODY_CLASS + " .airLamp.her { background: " + C.live + " !important; color: " + C.bgObsidian + " !important; border-color: " + C.live + " !important; }");
    L.push("body." + BODY_CLASS + " .airLamp.you, body." + BODY_CLASS + " .airLamp.holding { background: " + C.secondary + " !important; color: " + C.bgObsidian + " !important; border-color: " + C.secondary + " !important; }");
    L.push("body." + BODY_CLASS + " .airLamp.busy { color: " + C.live + " !important; border-color: " + C.live + " !important; }");
    L.push("body." + BODY_CLASS + " button.live, body." + BODY_CLASS + " button.micBtn.on, body." + BODY_CLASS + " button.micBtn.speaking { background: " + C.live + " !important; color: " + C.bgObsidian + " !important; }");
    L.push("body." + BODY_CLASS + " button.micBtn.holding, body." + BODY_CLASS + " #icomBtn.icomHot, body." + BODY_CLASS + " #icomSideBtn.icomHot { background: " + C.secondary + " !important; color: " + C.bgObsidian + " !important; border-color: " + C.secondary + " !important; }");
    L.push("body." + BODY_CLASS + " button.micBtn.hearing, body." + BODY_CLASS + " button.iconBtn.has { box-shadow: 0 0 0 2px " + C.live + ", 0 0 9px " + C.live + " !important; }");
    L.push("body." + BODY_CLASS + " #output::-webkit-scrollbar-thumb { background: " + C.primary + " !important; }");
    L.push("body." + BODY_CLASS + " .imgTile { border-color: " + C.primary + " !important; background: " + C.bgObsidian + " !important; }");
    L.push("body." + BODY_CLASS + " .dmsTalkRow .dmsWho.alia, body." + BODY_CLASS + " .dmsMark.alia { color: " + C.accent + " !important; }");
    L.push("body." + BODY_CLASS + " .voxPulse { outline-color: " + C.accent + " !important; }");
    L.push("body." + BODY_CLASS + " .handLamp.lit { color: " + C.gold + " !important; border-color: " + C.gold + " !important; }");
    if (t.glowColor) L.push("body." + BODY_CLASS + " #output { text-shadow: 0 0 8px " + t.glowColor + "; }");
    return L.join("\n");
  }

  function tag() {
    var s = document.getElementById(TAG_ID);
    if (!s) {
      s = document.createElement("style");
      s.id = TAG_ID;
      s.setAttribute("type", "text/css");
      document.head.appendChild(s);
    }
    return s;
  }

  function apply(rec, quiet) {
    kept = rec;
    try {
      tag().textContent = buildCSS(rec.theme);
      document.body.classList.add(BODY_CLASS);
    } catch (e) {
      say("THEME :: THE SKIN WOULD NOT TAKE - " + String((e && e.message) || e).toUpperCase());
      return false;
    }
    saveRec({ kept: kept });
    try { paint(); } catch (e) {}
    if (!quiet) say("THEME :: " + String(rec.theme.name || rec.theme.id).toUpperCase() + " ON. /theme crt TAKES IT BACK OFF.");
    return true;
  }

  function wearCRT(loud) {
    kept = null;
    try {
      var s = document.getElementById(TAG_ID);
      if (s) s.textContent = "";
      document.body.classList.remove(BODY_CLASS);
    } catch (e) {}
    saveRec({ kept: null });
    try { paint(); } catch (e) {}
    if (loud !== false) say("THEME :: CRT GREEN - THE SHIPPED PHOSPHOR.");
  }

  function importText(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) { say("THEME :: NOTHING TO READ - PASTE A DESIGNER ThemeConfig JSON AFTER /theme import."); return false; }
    var m = /^\s*'[^']+'\s*:\s*(\{[\s\S]*\}),?\s*$/.exec(raw);
    if (m) raw = m[1];
    var parsed = null;
    try { parsed = JSON.parse(raw); }
    catch (e) { say("THEME :: THAT IS NOT JSON - " + String((e && e.message) || e).toUpperCase()); return false; }
    var r = sanitize(parsed);
    if (!r.theme) { say("THEME :: NOTHING USABLE IN THAT (" + r.warnings.join(" + ") + ")."); return false; }
    var rec = { id: r.theme.id, theme: r.theme };
    if (!apply(rec)) return false;
    if (r.warnings.length) say("THEME :: TOLERANCES - " + r.warnings.join(" + ") + ".");
    return true;
  }

  function importURL(url) {
    url = String(url == null ? "" : url).trim();
    if (!/^https?:\/\//i.test(url)) { say("THEME :: GIVE AN http(s) URL TO A ThemeConfig JSON."); return false; }
    var sf = null;
    try { sf = window.root.superFetch; } catch (e) { sf = null; }
    if (!sf) { say("THEME :: THE FETCH ROAD IS OFFLINE (super-fetch-plugin)."); return false; }
    say("THEME :: FETCHING THE SKIN...");
    Promise.resolve(sf(url)).then(function (r) { return r.text(); }).then(function (t) {
      importText(t);
    }).catch(function (e) {
      say("THEME :: THE FETCH FAILED - " + String((e && e.message) || e).toUpperCase());
    });
    return true;
  }

  function importFile(file) {
    if (!file) { say("THEME :: NO FILE GIVEN."); return false; }
    var fr = new FileReader();
    fr.onload = function () { importText(String(fr.result || "")); };
    fr.onerror = function () { say("THEME :: THE FILE COULD NOT BE READ."); };
    try { fr.readAsText(file); } catch (e) { say("THEME :: THE FILE COULD NOT BE READ."); return false; }
    return true;
  }

  function crtConfig() {
    var colors = {};
    for (var i = 0; i < COLOR_KEYS.length; i++) colors[COLOR_KEYS[i]] = CRT[COLOR_KEYS[i]];
    return { id: "crt-green", name: "CRT Green (shipped phosphor)", era: "SIA TERMINAL // STOCK", colors: colors };
  }

  function status() {
    return "THEME :: " + (kept ? String(kept.theme.name || kept.theme.id).toUpperCase() + " (" + kept.id + ") ON THE CONSOLE" : "CRT GREEN - THE SHIPPED PHOSPHOR")
      + "\nTAKES :: A DESIGNER ThemeConfig JSON - id, name, era, colors{bgObsidian bgSlate border primary secondary accent alert gold live text textMuted}, glowColor, fonts{display mono body}. MISSING COLORS FALL BACK TO CRT PER KEY, UNKNOWN KEYS ARE IGNORED, ONLY #hex/rgba COLORS PASS."
      + "\nROADS :: PASTE AFTER /theme import (COMPACT JSON, OR THE DESIGNER'S 'id': {...} COPY SNIPPET) - /theme url <http(s)> - THE THEME PANEL (TEXTAREA, FILE, URL) - RAW CSS IS REFUSED (STRUCTURED TOKENS ONLY)."
      + "\nBACK :: /theme crt, /theme forget. OUT :: /theme export PRINTS THIS SKIN AS DESIGNER JSON.";
  }

  function describe() {
    return "THE SKINS (src/js/theme.js) :: THE CONSOLE WEARS ITS SHIPPED CRT GREEN, AND TAKES DESIGNER SKINS AS AN OVERRIDE LAYER - NEVER A REWRITE."
      + "\n" + status()
      + "\nUSAGE: /theme [status|list|crt|import <JSON>|url <URL>|export [crt]|forget|help]";
  }

  function list() {
    var L = ["THEME :: CRT-GREEN (SHIPPED PHOSPHOR)" + (kept ? "" : " - ON THE CONSOLE NOW")];
    if (kept) L.push("  " + kept.id + " :: " + String(kept.theme.name || "") + " - ON THE CONSOLE NOW");
    return L.join("\n");
  }

  function words(arg) {
    var t = String(arg == null ? "" : arg).trim();
    var low = t.toLowerCase();
    if (!low || low === "status" || low === "state" || low === "where") { say(status()); return; }
    if (low === "help" || low === "?") { say(describe()); return; }
    if (low === "list") { say(list()); return; }
    if (low === "crt" || low === "green" || low === "stock" || low === "revert") { wearCRT(true); return; }
    if (low === "forget") {
      if (!kept) { say("THEME :: NOTHING KEPT - THE CONSOLE IS ALREADY CRT."); return; }
      var id = kept.id;
      wearCRT(false);
      say("THEME :: " + String(id).toUpperCase() + " DROPPED OFF THE DEVICE. CRT GREEN.");
      return;
    }
    var m = low.match(/^(import|wear|apply|load)\s*([\s\S]*)$/);
    if (m) { importText(t.slice(m[1].length).trim()); return; }
    m = low.match(/^url\s+(\S+)\s*$/);
    if (m) { importURL(t.slice(3).trim()); return; }
    m = low.match(/^export(\s+crt)?\s*$/);
    if (m) {
      var cfg = (/crt/.test(low) || !kept) ? crtConfig() : kept.theme;
      var box = el("thText");
      var json = JSON.stringify(cfg);
      if (box) { box.value = JSON.stringify(cfg, null, 2); }
      say("THEME :: DESIGNER JSON" + (box ? " IN THE PANEL BOX" : "") + " - " + json.slice(0, 400) + (json.length > 400 ? "..." : ""));
      return;
    }
    say("USAGE: /theme [status|list|crt|import <JSON>|url <URL>|export [crt]|forget|help]");
  }

  function paint() {
    var s = el("thState");
    if (s) s.textContent = kept ? (kept.theme.name || kept.id) + " ON" : "CRT GREEN ON";
    var box = el("thSkins");
    if (box) {
      while (box.firstChild) box.removeChild(box.firstChild);
      var mk = function (label, fn, on) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label + (on ? " ON" : "");
        b.addEventListener("click", fn);
        box.appendChild(b);
      };
      mk("CRT GREEN", function () { wearCRT(true); }, !kept);
      if (kept) mk(String(kept.theme.name || kept.id).toUpperCase(), function () { apply(kept); }, true);
    }
  }

  function toggle() {
    var p = el("themePanel");
    if (!p) return;
    p.hidden = !p.hidden;
    try { paint(); } catch (e) {}
  }

  function wire() {
    var b = el("themeBtn");
    if (b && !b.__theme) {
      b.__theme = true;
      b.addEventListener("click", toggle);
    }
    var a = el("thApply");
    if (a && !a.__theme) {
      a.__theme = true;
      a.addEventListener("click", function () {
        var x = el("thText");
        importText(x ? x.value : "");
      });
    }
    var f = el("thFile");
    if (f && !f.__theme) {
      f.__theme = true;
      f.addEventListener("change", function () {
        if (f.files && f.files[0]) importFile(f.files[0]);
        try { f.value = ""; } catch (e) {}
      });
    }
    var u = el("thUrlGo");
    if (u && !u.__theme) {
      u.__theme = true;
      u.addEventListener("click", function () {
        var x = el("thUrl");
        importURL(x ? x.value : "");
      });
    }
    var x2 = el("thExport");
    if (x2 && !x2.__theme) {
      x2.__theme = true;
      x2.addEventListener("click", function () { words("export"); });
    }
    var c = el("thCrt");
    if (c && !c.__theme) {
      c.__theme = true;
      c.addEventListener("click", function () { wearCRT(true); });
    }
    var cl = el("thClose");
    if (cl && !cl.__theme) {
      cl.__theme = true;
      cl.addEventListener("click", toggle);
    }
    paint();
  }

  loadRec().then(function (r) {
    if (r && r.kept && r.kept.theme) {
      var s = sanitize(r.kept.theme);
      if (s.theme) apply({ id: r.kept.id || s.theme.id, theme: s.theme }, true);
    }
    try { paint(); } catch (e) {}
  });
  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  window.theme = {
    toggle: toggle,
    apply: apply,
    crt: wearCRT,
    importText: importText,
    importURL: importURL,
    words: words,
    status: status,
    describe: describe,
    list: list,
    state: function () { return { kept: kept ? kept.id : null, skinned: document.body.classList.contains(BODY_CLASS) }; },
    _sanitize: sanitize,
    _buildCSS: buildCSS,
    _tokens: function () { return { keys: COLOR_KEYS, crt: CRT }; }
  };
})();
