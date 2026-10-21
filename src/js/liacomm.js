(function () {
  /* ---- LIACOMM ---------------------------------------------------------------
     THE HOUSE INTERCOM, ON ITS OWN PAGE IN THIS DASH. The standalone PWA
     (https://perchance.org/mythos-intercom) stays outside; this panel is the
     same key worn inside - full CRT branding, and every feature is the app's
     own: the key below IS window.intercom (hold to speak, let go to send,
     her answer back over voice), the lamp mirrors its air, the line mirrors
     the input box while the finger is down. Turns file through the normal
     send, so memory, brevity discipline and the voice roads all come along -
     nothing here is a second intercom beside the first.
     --------------------------------------------------------------------------- */

  function el(id) { return document.getElementById(id); }
  function ic() { return window.intercom || null; }

  function isOpen() { var p = el("liacommPanel"); return !!(p && !p.hidden); }

  function closeOthers() {
    try { if (window.duet && window.duet.isOpen && window.duet.isOpen()) window.duet.close(); } catch (e) {}
    try { if (window.tricom && window.tricom.isOpen && window.tricom.isOpen()) window.tricom.close(); } catch (e) {}
    try { if (window.vox && window.vox.isOpen && window.vox.isOpen()) window.vox.close(); } catch (e) {}
    try { if (window.instr && window.instr.isOpen && window.instr.isOpen()) window.instr.close(); } catch (e) {}
    try { if (window.keyring && window.keyring.isOpen && window.keyring.isOpen()) window.keyring.close(); } catch (e) {}
    try { if (window.tools && window.tools.isOpen && window.tools.isOpen()) window.tools.close(); } catch (e) {}
    try { if (window.sync && window.sync.isOpen && window.sync.isOpen()) window.sync.close(); } catch (e) {}
    try { if (window.pair && window.pair.isOpen && window.pair.isOpen()) window.pair.panelClose(); } catch (e) {}
  }

  function show() {
    var p = el("liacommPanel");
    if (!p) return false;
    closeOthers();
    setCenter(true);
    p.hidden = false;
    paint();
    try { paintStyles(); } catch (e) {}
    try { var i = ic(); if (i && i.loadStyles) i.loadStyles().then(function () { paintStyles(); }, function () {}); } catch (e) {}
    return true;
  }

  function close() {
    setCenter(false);
    var p = el("liacommPanel");
    if (p) p.hidden = true;
    try { if (ic() && ic().held && ic().held()) ic().abort(); } catch (e) {}
  }

  function toggle() {
    if (isOpen()) { close(); return false; }
    return show();
  }

  function isCenter() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("liacommCenter")); }
    catch (e) { return false; }
  }

  var homeParent = null, homeNext = null;

  function setCenter(on) {
    on = !!on;
    var p = el("liacommPanel");
    var row = el("stageRow");
    var out = el("output");
    if (on) {
      if (p && row) {
        if (!homeParent) { homeParent = p.parentNode; homeNext = p.nextSibling; }
        try { row.insertBefore(p, el("rightPanel") || null); } catch (e) {}
      }
      if (out) out.hidden = true;
    } else {
      if (p && homeParent) {
        try { homeParent.insertBefore(p, homeNext); } catch (e) {}
        homeParent = null;
        homeNext = null;
      }
      if (out) out.hidden = false;
    }
    try { document.body.classList.toggle("liacommCenter", on); } catch (e) {}
    return on;
  }

  function boxText() {
    try { var b = el("userInput"); return b ? String(b.value || "") : ""; }
    catch (e) { return ""; }
  }

  function paint() {
    var lamp = el("lcLamp"), key = el("lcKey"), line = el("lcLine"), brief = el("lcBrief");
    var i = ic();
    var held = false, receiving = false, a = "STANDBY";
    try {
      if (i) {
        held = !!(i.held && i.held());
        receiving = !!(i.receiving && i.receiving());
        a = String((i.air && i.air()) || "STANDBY");
      }
    } catch (e) {}
    var text = "STANDBY", cls = "lcLamp standby";
    if (held) { text = "TRANSMITTING"; cls = "lcLamp you"; }
    else if (receiving) {
      if (a === "HER VOICE") { text = "SHE SPEAKS"; cls = "lcLamp her"; }
      else { text = "RECEIVING"; cls = "lcLamp busy"; }
    }
    else if (a === "HER VOICE") { text = "SHE SPEAKS"; cls = "lcLamp her"; }
    else if (a === "HER TURN") { text = "THINKING"; cls = "lcLamp busy"; }
    else if (a === "YOUR VOICE" || a === "HOLDING") { text = "ON THE LINE"; cls = "lcLamp you"; }
    if (lamp && lamp.textContent !== text) { lamp.textContent = text; lamp.className = cls; }
    if (key) {
      key.setAttribute("aria-pressed", held ? "true" : "false");
      key.classList.toggle("lcHot", held);
    }
    if (line) {
      var t = boxText();
      if (held) line.textContent = t || "(LISTENING ...)";
      else if (receiving) line.textContent = "HER ANSWER IS ON ITS WAY BACK.";
      else if (line.textContent === "(LISTENING ...)") line.textContent = t || "HOLD THE KEY AND SPEAK - YOUR WORDS SHOW HERE, THEN GO TO HER WHEN YOU LET GO.";
    }
    if (brief) {
      var on = true;
      try { on = i ? !!i.brevity() : true; } catch (e) {}
      brief.textContent = "BREVITY: " + (on ? "ON" : "OFF");
    }
  }

  // THE SPEECH STYLE DROPDOWN. Populated from the intercom's own style list (which it reads
  // off src/voxpack/styles/index.json), so adding a tiny file plus one manifest line adds a row
  // here with no code change. Keeping one saves it on this device (kv lia_settings / intercom).
  function paintStyles() {
    var sel = el("lcStyle");
    if (!sel) return;
    var list = [];
    var cur = "";
    try {
      var i = ic();
      if (i && i.styles) list = i.styles() || [];
      if (i && i.style) cur = String(i.style() || "");
    } catch (e) {}
    if (!list.length) list = [{ id: "plain-brief", title: "PLAIN BRIEF" }];
    var want = String(cur || (list[0] && list[0].id) || "plain-brief");
    var html = "";
    for (var k = 0; k < list.length; k++) {
      var id = String(list[k].id), title = String(list[k].title || id) + (list[k].mine ? " (YOURS)" : "");
      html += '<option value="' + id.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"' + (id === want ? " selected" : "") + ">" + title.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</option>";
    }
    if (sel.__lcKeys !== html) {
      sel.__lcKeys = html;
      sel.innerHTML = html;
    }
    if (sel.value !== want) { try { sel.value = want; } catch (e) {} }
  }

  function wireKey() {
    var b = el("lcKey");
    if (!b || b.__lc) return;
    b.__lc = true;
    b.addEventListener("pointerdown", function (e) {
      try { e.preventDefault(); } catch (x) {}
      // The press is captured to the key: sliding off it mid-sentence is not a lift, so it
      // neither sends nor cancels - only a real pointerup lets go.
      try { if (b.setPointerCapture && e.pointerId != null) b.setPointerCapture(e.pointerId); } catch (x) {}
      try {
        var i = ic();
        if (!i) { try { print("SYSTEM", "LIACOMM :: THE INTERCOM IS OFFLINE (src/js/intercom.js)."); } catch (y) {} return; }
        if (!isOpen()) show();
        i.press(b);
        paint();
      } catch (x) {}
    });
    var up = function () { try { if (ic()) ic().release(); } catch (x) {} paint(); };
    b.addEventListener("pointerup", up);
    // pointercancel (a touch scroll stealing the gesture, the browser pre-empting the press) is NOT
    // a lift: the finger is still down, so the microphone stays open until a real pointerup. The old
    // wiring sent mid-sentence here.
    b.addEventListener("pointercancel", function (e) {});
    // Sliding off the key is not a lift either - and with capture held it does not even fire.
    b.addEventListener("pointerleave", function (e) {});
    b.addEventListener("contextmenu", function (e) { try { e.preventDefault(); } catch (x) {} });
  }

  function wire() {
    wireKey();
    var c = el("lcClose");
    if (c && !c.__lc) { c.__lc = true; c.addEventListener("click", function () { close(); }); }
    var br = el("lcBrief");
    if (br && !br.__lc) {
      br.__lc = true;
      br.addEventListener("click", function () {
        try {
          var i = ic();
          if (i && i.brevity) i.brevity(!i.brevity());
        } catch (e) {}
        paint();
      });
    }
    var st = el("lcStyle");
    if (st && !st.__lc) {
      st.__lc = true;
      st.addEventListener("change", function () {
        try {
          var i = ic();
          if (i && i.setStyle) i.setStyle(st.value).then(function (hit) {
            try { if (typeof print === "function" && hit) print("SYSTEM", "LIACOMM :: SPEECH STYLE " + String(hit.title).toUpperCase() + " (" + hit.id + ") - KEPT ON THIS DEVICE. HER NEXT INTERCOM TURN READS IT."); } catch (e) {}
            paintStyles();
          }, function () {});
        } catch (e) {}
      });
    }
    var vw = el("lcStyleView");
    if (vw && !vw.__lc) {
      vw.__lc = true;
      vw.addEventListener("click", function () {
        try {
          var i = ic();
          var txt = "";
          try { txt = i && i.styleTextNow ? String(i.styleTextNow() || "") : ""; } catch (e) {}
          var id = "";
          try { id = i && i.style ? String(i.style() || "") : ""; } catch (e) {}
          if (typeof print === "function") print("SYSTEM", "LIACOMM :: SPEECH STYLE " + (id || "?").toUpperCase() + " :: " + (txt || "(NOT LOADED YET)"));
        } catch (e) {}
      });
    }
    // THE STYLE WORKBENCH. NEW FROM CURRENT copies the style in force into the box for
    // adjusting; SAVE keeps the box under the name beside it (rewriting one of yours
    // under the same name); DROP removes the named one of yours. File styles are never
    // touched - the engine refuses them, and the receipt says so.
    var nw = el("lcStyleNew");
    if (nw && !nw.__lc) {
      nw.__lc = true;
      nw.addEventListener("click", function () {
        try {
          var i = ic();
          if (!i) { try { print("SYSTEM", "LIACOMM :: THE INTERCOM IS OFFLINE (src/js/intercom.js)."); } catch (e) {} return; }
          var txt = "";
          try { txt = i.styleTextNow ? String(i.styleTextNow() || "") : ""; } catch (e) {}
          var box = el("lcStyleEdit");
          if (box) box.value = txt;
          var nm = el("lcStyleName");
          if (nm && !String(nm.value || "").trim()) {
            var cur = "";
            try { cur = i.style ? String(i.style() || "") : ""; } catch (e) {}
            nm.value = cur ? (cur + "-mine") : "";
          }
          if (box) box.focus();
        } catch (e) {}
      });
    }
    var sv = el("lcStyleSave");
    if (sv && !sv.__lc) {
      sv.__lc = true;
      sv.addEventListener("click", function () {
        try {
          var i = ic();
          if (!i || !i.saveStyle) { try { print("SYSTEM", "LIACOMM :: THE INTERCOM IS OFFLINE (src/js/intercom.js)."); } catch (e) {} return; }
          var nm = el("lcStyleName");
          var box = el("lcStyleEdit");
          var name = nm ? String(nm.value || "") : "";
          var text = box ? String(box.value || "") : "";
          i.saveStyle(name, "", text).then(function (kept) {
            try { if (typeof print === "function") print("SYSTEM", "LIACOMM :: SPEECH STYLE " + kept.entry.title + " (" + kept.entry.id + ") " + (kept.created ? "WRITTEN" : "REWRITTEN") + " - KEPT ON THIS DEVICE. KEEP IT IN THE DROPDOWN AND HER NEXT INTERCOM TURN READS IT."); } catch (e) {}
            try { paintStyles(); } catch (e) {}
            var sel = el("lcStyle");
            if (sel) { try { sel.value = kept.entry.id; } catch (e) {} }
          }, function (e) {
            try { if (typeof print === "function") print("SYSTEM", String((e && e.message) || e)); } catch (e2) {}
          });
        } catch (e) {}
      });
    }
    var dr = el("lcStyleDrop");
    if (dr && !dr.__lc) {
      dr.__lc = true;
      dr.addEventListener("click", function () {
        try {
          var i = ic();
          if (!i || !i.dropStyle) { try { print("SYSTEM", "LIACOMM :: THE INTERCOM IS OFFLINE (src/js/intercom.js)."); } catch (e) {} return; }
          var nm = el("lcStyleName");
          var name = nm ? String(nm.value || "").trim() : "";
          if (!name) {
            var sel = el("lcStyle");
            name = sel ? String(sel.value || "") : "";
          }
          if (!name) { try { print("SYSTEM", "LIACOMM :: NAME THE STYLE TO DROP - the workbench name, or keep it in the dropdown first."); } catch (e) {} return; }
          i.dropStyle(name).then(function (msg) {
            try { if (typeof print === "function") print("SYSTEM", msg); } catch (e) {}
            try { paintStyles(); } catch (e) {}
          }, function (e) {
            try { if (typeof print === "function") print("SYSTEM", String((e && e.message) || e)); } catch (e2) {}
          });
        } catch (e) {}
      });
    }
    try { paintStyles(); } catch (e) {}
    try { var ii = ic(); if (ii && ii.loadStyles) ii.loadStyles().then(function () { paintStyles(); }, function () {}); } catch (e) {}
    setInterval(function () { try { if (isOpen()) paint(); } catch (e) {} }, 600);
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);

  window.liacomm = { show: show, close: close, toggle: toggle, isOpen: isOpen, isCenter: isCenter, paint: paint, paintStyles: paintStyles };
})();
