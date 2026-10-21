var MythosArt = (function () {
  "use strict";

  var PREFIX = "mythos-art-";
  var STYLE_ID = "mythos-art-style";

  var THEMES = {
    terminal: [
      "%T% { background:#031103; color:#33ff66; font-family:\"Courier New\",monospace; }",
      "%T% button { background:#031103; color:#33ff66; border:1px solid #33ff66; font-family:inherit; }",
      "%T% button:hover { background:#33ff66; color:#031103; }",
      "%T% input { background:#010a01; color:#33ff66; border:1px solid #1a7a33; font-family:inherit; }"
    ].join("\n"),
    typewriter: [
      "%T% { background:#f4f1ea; color:#111; font-family:\"Courier New\",monospace; }",
      "%T% button { background:#f4f1ea; color:#111; border:1px solid #111; font-family:inherit; }",
      "%T% button:hover { background:#111; color:#f4f1ea; }",
      "%T% input { background:#fff; color:#111; border:1px solid #999; font-family:inherit; }"
    ].join("\n"),
    midnight: [
      "%T% { background:#0d1321; color:#c9d6ff; font-family:Georgia,serif; }",
      "%T% button { background:#0d1321; color:#c9d6ff; border:1px solid #3e4c6d; font-family:inherit; }",
      "%T% button:hover { background:#3e4c6d; color:#fff; }",
      "%T% input { background:#080c16; color:#c9d6ff; border:1px solid #3e4c6d; font-family:inherit; }"
    ].join("\n"),
    parchment: [
      "%T% { background:#e8dcc3; color:#3b2f1e; font-family:Georgia,serif; }",
      "%T% button { background:#e8dcc3; color:#3b2f1e; border:1px solid #3b2f1e; font-family:inherit; }",
      "%T% button:hover { background:#3b2f1e; color:#e8dcc3; }",
      "%T% input { background:#f6efe0; color:#3b2f1e; border:1px solid #a08c5b; font-family:inherit; }"
    ].join("\n")
  };

  var APPLIED = {};

  function repaint() {
    var st = document.getElementById(STYLE_ID);
    if (!st) {
      st = document.createElement("style");
      st.id = STYLE_ID;
      document.head.appendChild(st);
    }
    st.textContent = Object.keys(APPLIED).map(function (k) { return APPLIED[k]; }).join("\n");
    return st;
  }

  function cssFor(name) {
    var t = THEMES[name];
    if (!t) throw new Error("NO SUCH THEME :: " + name + " :: " + Object.keys(THEMES).join(" | "));
    return t.split("%T%").join("." + PREFIX + name);
  }

  function client(opts) {
    opts = opts || {};
    var theme = String(opts.theme || "terminal");
    var target = typeof opts.target === "string" ? document.getElementById(opts.target) : (opts.target || document.body);

    function current() {
      if (!target) return null;
      var list = (target.className || "").split(/\s+/);
      for (var i = 0; i < list.length; i++) {
        if (list[i].indexOf(PREFIX) === 0) return list[i].slice(PREFIX.length);
      }
      return null;
    }

    function apply(name) {
      if (name) theme = String(name);
      APPLIED[theme] = cssFor(theme);
      repaint();
      if (target) {
        var cur = current();
        if (cur) target.classList.remove(PREFIX + cur);
        target.classList.add(PREFIX + theme);
      }
      return theme;
    }

    function remove() {
      var cur = current();
      if (cur) delete APPLIED[cur];
      repaint();
      if (target && cur) target.classList.remove(PREFIX + cur);
      return true;
    }

    return { apply: apply, remove: remove, theme: function () { return theme; } };
  }

  function register(name, css) {
    if (!name || !css) throw new Error("DENIED - REGISTER NEEDS A NAME AND CSS :: NOTHING WAS ADDED.");
    THEMES[String(name)] = String(css);
    return String(name);
  }

  function themes() { return Object.keys(THEMES); }

  var SYSTEM_STACK = "\"Courier New\",Courier,Georgia,serif,system-ui,sans-serif";

  function extract(target) {
    var el = typeof target === "string" ? document.getElementById(target) : target;
    if (!el) throw new Error("DENIED - EXTRACT NEEDS A TARGET :: NOTHING WAS READ.");
    var out = [], skipped = 0, inlines = 0;
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules = null;
      try { rules = document.styleSheets[i].cssRules; } catch (e) { skipped++; continue; }
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r.selectorText) continue;
        var hit = false;
        try { hit = el.matches(r.selectorText) || !!el.querySelector(r.selectorText); } catch (e) {}
        if (hit) out.push(r.cssText);
      }
    }
    var nodes = el.querySelectorAll("[style]");
    var n = 0;
    var inlineCss = [];
    for (var k = 0; k < nodes.length; k++) {
      var decl = String(nodes[k].getAttribute("style") || "").trim();
      if (!decl) continue;
      if (decl.charAt(decl.length - 1) !== ";") decl += ";";
      inlineCss.push(".artx" + n + " { " + decl + " }");
      n++;
    }
    var selfDecl = String(el.getAttribute("style") || "").trim();
    if (selfDecl) {
      if (selfDecl.charAt(selfDecl.length - 1) !== ";") selfDecl += ";";
      inlineCss.unshift("%T% { " + selfDecl + " }");
      n++;
    }
    inlines = n;
    return { css: out.concat(inlineCss).join("\n"), rules: out.length, inlines: inlines, skippedSheets: skipped };
  }

  function refactor(cssText, prefix) {
    var report = { scoped: 0, layoutStripped: 0, fontsNormalized: 0, importsRemoved: 0, urlsFlagged: 0 };
    var pre = "." + String(prefix || "adopted").replace(/^\.+/, "");
    var lines = String(cssText || "").split("\n");
    var body = [];
    lines.forEach(function (ln) {
      if (/^\s*@import/i.test(ln)) { report.importsRemoved++; return; }
      body.push(ln);
    });
    var css = body.join("\n");
    css = css.replace(/url\(\s*["']?https?:[^)]+\)/gi, function (m) { report.urlsFlagged++; return "none"; });
    css = css.replace(/font-family\s*:[^;}]+/gi, function (m) { report.fontsNormalized++; return "font-family:" + SYSTEM_STACK; });
    css = css.replace(/position\s*:\s*(fixed|absolute|sticky)\s*;?/gi, function (m) { report.layoutStripped++; return ""; });
    css = css.replace(/%T%/g, pre);
    css = css.replace(/(^|\})\s*([^@{}\n][^{}\n]*)\{/g, function (m, before, sel) {
      var parts = sel.split(",").map(function (s) {
        s = s.trim();
        if (!s || s.indexOf(pre) === 0) return s;
        report.scoped++;
        return pre + " " + s;
      });
      return before + parts.join(", ") + "{";
    });
    return { css: css, prefix: pre, report: report };
  }

  function adopt(name, cssText) {
    var tag = "ADOPT-" + String(name);
    var r = refactor(cssText, tag);
    register(name, r.css.split("." + tag).join("%T%"));
    return { name: name, report: r.report };
  }

  return { client: client, register: register, themes: themes, extract: extract, refactor: refactor, adopt: adopt };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MythosArt;
